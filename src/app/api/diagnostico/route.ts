import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import connectDB from '@/lib/mongodb';
import { Aluno } from '@/models/Aluno';
import { HorarioFixo } from '@/models/HorarioFixo';
import CreditoReposicao from '@/models/CreditoReposicao';
import UsoCredito from '@/models/UsoCredito';
import { Reagendamento } from '@/models/Reagendamento';
import AulaRealizada from '@/models/AulaRealizada';
import { User } from '@/models/User';
import { Modalidade } from '@/models/Modalidade';
import { AlteracaoHorario } from '@/models/AlteracaoHorario';
import { Aviso } from '@/models/Aviso';
import Feriado from '@/models/Feriado';
import Presenca from '@/models/Presenca';
import { Falta } from '@/models/Falta';
import { Matricula } from '@/models/Matricula';
import { JWT_SECRET } from '@/lib/auth';

async function isAdmin() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    
    if (!token) return false;
    
    const decoded = jwt.verify(token, JWT_SECRET) as { tipo: string };
    const tipoLower = decoded.tipo?.toLowerCase() || '';
    
    return tipoLower === 'adm' || tipoLower === 'root' || tipoLower === 'admin';
  } catch (err) {
    console.error('[Diagnostico] Erro ao verificar admin:', err);
    return false;
  }
}

interface DiagnosticoItem {
  nome: string;
  total: number;
  ok: number;
  problemas: number;
  detalhes: string[];
  status: 'ok' | 'warning' | 'error';
}

export async function GET() {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    await connectDB();

    const resultado: Record<string, DiagnosticoItem> = {};

    // ========== ALUNOS ==========
    const alunos = await Aluno.find().lean() as any[];
    const alunosProblemas: string[] = [];
    
    for (const aluno of alunos) {
      if (!aluno.nome) alunosProblemas.push(`Aluno ${aluno._id}: sem nome`);
      if (!aluno.email && !aluno.telefone) alunosProblemas.push(`${aluno.nome || aluno._id}: sem email nem telefone`);
    }
    
    resultado.alunos = {
      nome: 'Alunos',
      total: alunos.length,
      ok: alunos.length - alunosProblemas.length,
      problemas: alunosProblemas.length,
      detalhes: alunosProblemas,
      status: alunosProblemas.length === 0 ? 'ok' : alunosProblemas.length < 3 ? 'warning' : 'error'
    };

    // ========== HORÁRIOS FIXOS ==========
    // Nota: professorId referencia 'Professor' no schema, mas os IDs são de 'User'
    // Por isso usamos { path: 'professorId', model: 'User' } para popular corretamente
    const horarios = await HorarioFixo.find()
      .populate({ path: 'professorId', model: 'User', select: 'nome' })
      .populate('modalidadeId')
      .lean() as any[];
    const horariosProblemas: string[] = [];
    
    for (const h of horarios) {
      if (h.diaSemana === undefined || h.diaSemana === null) {
        horariosProblemas.push(`Horário ${h._id}: sem dia da semana`);
      }
      if (!h.horarioInicio) {
        horariosProblemas.push(`Horário ${h._id}: sem horário de início`);
      }
      if (!h.professorId) {
        horariosProblemas.push(`Horário ${h.horarioInicio || h._id}: sem professor`);
      }
      if (!h.modalidadeId) {
        horariosProblemas.push(`Horário ${h.horarioInicio || h._id}: sem modalidade`);
      }
      // Verificar matrículas com alunoId inválido
      if (h.matriculas && Array.isArray(h.matriculas)) {
        for (const m of h.matriculas) {
          if (m.alunoId && typeof m.alunoId === 'object' && !m.alunoId._id) {
            horariosProblemas.push(`Horário ${h.horarioInicio}: matrícula com alunoId inválido`);
          }
        }
      }
    }
    
    resultado.horarios = {
      nome: 'Horários',
      total: horarios.length,
      ok: horarios.length - horariosProblemas.length,
      problemas: horariosProblemas.length,
      detalhes: horariosProblemas,
      status: horariosProblemas.length === 0 ? 'ok' : horariosProblemas.length < 5 ? 'warning' : 'error'
    };

    // ========== CRÉDITOS DE REPOSIÇÃO ==========
    const creditos = await CreditoReposicao.find().populate('alunoId').lean() as any[];
    const creditosProblemas: string[] = [];
    
    for (const c of creditos) {
      if (!c.alunoId || !c.alunoId._id) {
        creditosProblemas.push(`Crédito ${c._id}: aluno não encontrado`);
      }
      if (c.quantidadeUsada > c.quantidade) {
        creditosProblemas.push(`Crédito ${c._id}: quantidade usada (${c.quantidadeUsada}) maior que total (${c.quantidade})`);
      }
      if (c.quantidade < 1) {
        creditosProblemas.push(`Crédito ${c._id}: quantidade inválida (${c.quantidade})`);
      }
    }
    
    resultado.creditos = {
      nome: 'Créditos',
      total: creditos.length,
      ok: creditos.length - creditosProblemas.length,
      problemas: creditosProblemas.length,
      detalhes: creditosProblemas,
      status: creditosProblemas.length === 0 ? 'ok' : creditosProblemas.length < 3 ? 'warning' : 'error'
    };

    // ========== USOS DE CRÉDITO ==========
    const usos = await UsoCredito.find().populate('creditoId').populate('alunoId').lean() as any[];
    const usosProblemas: string[] = [];
    
    for (const u of usos) {
      if (!u.creditoId) {
        usosProblemas.push(`Uso ${u._id}: crédito não encontrado (órfão)`);
      }
      if (!u.alunoId) {
        usosProblemas.push(`Uso ${u._id}: aluno não encontrado`);
      }
      if (!u.dataUso) {
        usosProblemas.push(`Uso ${u._id}: sem data de uso`);
      }
    }
    
    resultado.usos = {
      nome: 'Usos de Crédito',
      total: usos.length,
      ok: usos.length - usosProblemas.length,
      problemas: usosProblemas.length,
      detalhes: usosProblemas,
      status: usosProblemas.length === 0 ? 'ok' : usosProblemas.length < 3 ? 'warning' : 'error'
    };

    // ========== REAGENDAMENTOS ==========
    const reagendamentos = await Reagendamento.find().lean() as any[];
    const reagendamentosProblemas: string[] = [];
    
    for (const r of reagendamentos) {
      if (!r.horarioFixoId) {
        reagendamentosProblemas.push(`Reagendamento ${r._id}: sem horário fixo original`);
      }
      if (!r.dataOriginal) {
        reagendamentosProblemas.push(`Reagendamento ${r._id}: sem data original`);
      }
      if (r.status === 'aprovado' && !r.novaData) {
        reagendamentosProblemas.push(`Reagendamento ${r._id}: aprovado mas sem nova data`);
      }
    }
    
    resultado.reagendamentos = {
      nome: 'Reagendamentos',
      total: reagendamentos.length,
      ok: reagendamentos.length - reagendamentosProblemas.length,
      problemas: reagendamentosProblemas.length,
      detalhes: reagendamentosProblemas,
      status: reagendamentosProblemas.length === 0 ? 'ok' : reagendamentosProblemas.length < 3 ? 'warning' : 'error'
    };

    // ========== AULAS REALIZADAS ==========
    const aulas = await AulaRealizada.find().lean() as any[];
    const aulasProblemas: string[] = [];
    
    for (const a of aulas) {
      if (!a.horarioId && !a.horarioFixoId) {
        aulasProblemas.push(`Aula ${a._id}: sem referência de horário`);
      }
      if (!a.data) {
        aulasProblemas.push(`Aula ${a._id}: sem data`);
      }
    }
    
    resultado.aulasRealizadas = {
      nome: 'Aulas Realizadas',
      total: aulas.length,
      ok: aulas.length - aulasProblemas.length,
      problemas: aulasProblemas.length,
      detalhes: aulasProblemas,
      status: aulasProblemas.length === 0 ? 'ok' : aulasProblemas.length < 5 ? 'warning' : 'error'
    };

    // ========== USUÁRIOS ==========
    const usuarios = await User.find().lean() as any[];
    const usuariosProblemas: string[] = [];
    
    for (const u of usuarios) {
      if (!u.nome) usuariosProblemas.push(`Usuário ${u._id}: sem nome`);
      if (!u.email) usuariosProblemas.push(`Usuário ${u.nome || u._id}: sem email`);
      if (!u.tipo) usuariosProblemas.push(`Usuário ${u.nome || u._id}: sem tipo definido`);
    }
    
    resultado.usuarios = {
      nome: 'Usuários',
      total: usuarios.length,
      ok: usuarios.length - usuariosProblemas.length,
      problemas: usuariosProblemas.length,
      detalhes: usuariosProblemas,
      status: usuariosProblemas.length === 0 ? 'ok' : usuariosProblemas.length < 2 ? 'warning' : 'error'
    };

    // ========== MODALIDADES ==========
    const modalidades = await Modalidade.find().lean() as any[];
    const modalidadesProblemas: string[] = [];
    
    for (const m of modalidades) {
      if (!m.nome) modalidadesProblemas.push(`Modalidade ${m._id}: sem nome`);
      if (m.limiteAlunos !== undefined && m.limiteAlunos < 0) {
        modalidadesProblemas.push(`Modalidade ${m.nome || m._id}: limite de alunos negativo`);
      }
    }
    
    resultado.modalidades = {
      nome: 'Modalidades',
      total: modalidades.length,
      ok: modalidades.length - modalidadesProblemas.length,
      problemas: modalidadesProblemas.length,
      detalhes: modalidadesProblemas,
      status: modalidadesProblemas.length === 0 ? 'ok' : modalidadesProblemas.length < 2 ? 'warning' : 'error'
    };

    // ========== ALTERAÇÕES DE HORÁRIO ==========
    const alteracoes = await AlteracaoHorario.find()
      .populate('alunoId')
      .populate('horarioAtualId')
      .populate('novoHorarioId')
      .lean() as any[];
    const alteracoesProblemas: string[] = [];
    
    for (const a of alteracoes) {
      if (!a.alunoId || !a.alunoId._id) {
        alteracoesProblemas.push(`Alteração ${a._id}: aluno não encontrado`);
      }
      if (!a.horarioAtualId || !a.horarioAtualId._id) {
        alteracoesProblemas.push(`Alteração ${a._id}: horário atual não encontrado`);
      }
      if (!a.novoHorarioId || !a.novoHorarioId._id) {
        alteracoesProblemas.push(`Alteração ${a._id}: novo horário não encontrado`);
      }
      if (a.status === 'pendente') {
        // Contar pendentes para alerta
        const diasPendente = a.criadoEm ? Math.floor((Date.now() - new Date(a.criadoEm).getTime()) / (1000 * 60 * 60 * 24)) : 0;
        if (diasPendente > 7) {
          alteracoesProblemas.push(`Alteração ${a._id}: pendente há ${diasPendente} dias`);
        }
      }
    }
    
    resultado.alteracoesHorario = {
      nome: 'Alterações de Horário',
      total: alteracoes.length,
      ok: alteracoes.length - alteracoesProblemas.length,
      problemas: alteracoesProblemas.length,
      detalhes: alteracoesProblemas,
      status: alteracoesProblemas.length === 0 ? 'ok' : alteracoesProblemas.length < 3 ? 'warning' : 'error'
    };

    // ========== AVISOS ==========
    const avisos = await Aviso.find().lean() as any[];
    const avisosProblemas: string[] = [];
    const agora = new Date();
    
    for (const av of avisos) {
      if (!av.titulo) avisosProblemas.push(`Aviso ${av._id}: sem título`);
      if (!av.mensagem) avisosProblemas.push(`Aviso ${av._id}: sem mensagem`);
      if (av.dataFim && new Date(av.dataFim) < agora && av.ativo) {
        avisosProblemas.push(`Aviso "${av.titulo || av._id}": expirado mas ainda ativo`);
      }
    }
    
    resultado.avisos = {
      nome: 'Avisos',
      total: avisos.length,
      ok: avisos.length - avisosProblemas.length,
      problemas: avisosProblemas.length,
      detalhes: avisosProblemas,
      status: avisosProblemas.length === 0 ? 'ok' : avisosProblemas.length < 3 ? 'warning' : 'error'
    };

    // ========== FERIADOS ==========
    const feriados = await Feriado.find().lean() as any[];
    const feriadosProblemas: string[] = [];
    
    for (const f of feriados) {
      if (!f.data) feriadosProblemas.push(`Feriado ${f._id}: sem data`);
    }
    
    resultado.feriados = {
      nome: 'Feriados',
      total: feriados.length,
      ok: feriados.length - feriadosProblemas.length,
      problemas: feriadosProblemas.length,
      detalhes: feriadosProblemas,
      status: feriadosProblemas.length === 0 ? 'ok' : 'warning'
    };

    // ========== PRESENÇAS ==========
    const presencas = await Presenca.find()
      .populate('alunoId')
      .populate('horarioFixoId')
      .lean() as any[];
    const presencasProblemas: string[] = [];
    
    for (const p of presencas) {
      if (!p.alunoId || !p.alunoId._id) {
        presencasProblemas.push(`Presença ${p._id}: aluno não encontrado (órfão)`);
      }
      if (!p.horarioFixoId || !p.horarioFixoId._id) {
        presencasProblemas.push(`Presença ${p._id}: horário não encontrado (órfão)`);
      }
      if (!p.data) {
        presencasProblemas.push(`Presença ${p._id}: sem data`);
      }
    }
    
    resultado.presencas = {
      nome: 'Presenças',
      total: presencas.length,
      ok: presencas.length - presencasProblemas.length,
      problemas: presencasProblemas.length,
      detalhes: presencasProblemas,
      status: presencasProblemas.length === 0 ? 'ok' : presencasProblemas.length < 5 ? 'warning' : 'error'
    };

    // ========== FALTAS ==========
    const faltas = await Falta.find()
      .populate('horarioFixoId')
      .lean() as any[];
    const faltasProblemas: string[] = [];
    
    for (const f of faltas) {
      if (!f.horarioFixoId || !f.horarioFixoId._id) {
        faltasProblemas.push(`Falta ${f._id}: horário não encontrado (órfão)`);
      }
      if (!f.data) {
        faltasProblemas.push(`Falta ${f._id}: sem data`);
      }
    }
    
    resultado.faltas = {
      nome: 'Faltas',
      total: faltas.length,
      ok: faltas.length - faltasProblemas.length,
      problemas: faltasProblemas.length,
      detalhes: faltasProblemas,
      status: faltasProblemas.length === 0 ? 'ok' : faltasProblemas.length < 5 ? 'warning' : 'error'
    };

    // ========== MATRÍCULAS ==========
    const matriculas = await Matricula.find()
      .populate('alunoId')
      .populate('horarioFixoId')
      .lean() as any[];
    const matriculasProblemas: string[] = [];
    
    for (const m of matriculas) {
      if (!m.alunoId || !m.alunoId._id) {
        matriculasProblemas.push(`Matrícula ${m._id}: aluno não encontrado`);
      }
      if (!m.horarioFixoId || !m.horarioFixoId._id) {
        matriculasProblemas.push(`Matrícula ${m._id}: horário não encontrado`);
      }
      // Verificar substituições inválidas
      if (m.isSubstitute && m.replacesMatriculaId) {
        // Verificar se a matrícula substituída existe
        const matriculaSubstituida = matriculas.find((mat: any) => String(mat._id) === String(m.replacesMatriculaId));
        if (!matriculaSubstituida) {
          matriculasProblemas.push(`Matrícula ${m._id}: substituição aponta para matrícula inexistente`);
        }
      }
    }
    
    resultado.matriculas = {
      nome: 'Matrículas',
      total: matriculas.length,
      ok: matriculas.length - matriculasProblemas.length,
      problemas: matriculasProblemas.length,
      detalhes: matriculasProblemas,
      status: matriculasProblemas.length === 0 ? 'ok' : matriculasProblemas.length < 5 ? 'warning' : 'error'
    };

    return NextResponse.json(resultado);
  } catch (error) {
    console.error('Erro no diagnóstico:', error);
    return NextResponse.json(
      { error: 'Erro ao executar diagnóstico' },
      { status: 500 }
    );
  }
}
