import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import connectDB from '@/lib/mongodb';
import { Reagendamento } from '@/models/Reagendamento';
import { HorarioFixo } from '@/models/HorarioFixo';
import { Matricula } from '@/models/Matricula';
import { Modalidade } from '@/models/Modalidade';

const JWT_SECRET = process.env.JWT_SECRET || 'aluno-secret-key-2025';

async function getAlunoFromToken(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('alunoToken')?.value;
    
    if (!token) return null;
    
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; nome: string; tipo: string };
    
    if (decoded.tipo !== 'aluno') return null;
    
    return decoded;
  } catch {
    return null;
  }
}

// GET - Buscar reagendamentos do aluno logado
export async function GET(req: NextRequest) {
  try {
    const aluno = await getAlunoFromToken(req);
    
    if (!aluno) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }
    
    await connectDB();
    
    // Buscar reagendamentos do aluno (tanto por alunoId quanto por matriculaId)
    const matriculas = await Matricula.find({
      alunoId: aluno.id,
      ativo: true
    });
    
    const matriculaIds = matriculas.map((m: any) => m._id);
    
    const reagendamentos = await Reagendamento.find({
      $or: [
        { alunoId: aluno.id },
        { matriculaId: { $in: matriculaIds } }
      ]
    })
      .populate({
        path: 'horarioFixoId',
        populate: [
          { path: 'modalidadeId', select: 'nome cor' },
          { path: 'professorId', select: 'nome' }
        ]
      })
      .populate({
        path: 'novoHorarioFixoId',
        populate: [
          { path: 'modalidadeId', select: 'nome cor' },
          { path: 'professorId', select: 'nome' }
        ]
      })
      .sort({ criadoEm: -1 });
    
    return NextResponse.json({
      success: true,
      reagendamentos
    });
    
  } catch (error) {
    console.error('[API Aluno Reagendamentos] Erro ao buscar:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar reagendamentos' },
      { status: 500 }
    );
  }
}

// POST - Criar solicitação de reagendamento
export async function POST(req: NextRequest) {
  try {
    const aluno = await getAlunoFromToken(req);
    
    if (!aluno) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }
    
    await connectDB();
    
    const body = await req.json();
    const { horarioFixoId, dataOriginal, novoHorarioFixoId, novaData, motivo } = body;
    
    // Validações
    if (!horarioFixoId || !dataOriginal || !novoHorarioFixoId || !novaData || !motivo) {
      return NextResponse.json(
        { success: false, error: 'Todos os campos são obrigatórios' },
        { status: 400 }
      );
    }
    
    // Verificar se o aluno está matriculado no horário original
    const matricula = await Matricula.findOne({
      alunoId: aluno.id,
      horarioFixoId: horarioFixoId,
      ativo: true
    });
    
    if (!matricula) {
      return NextResponse.json(
        { success: false, error: 'Você não está matriculado neste horário' },
        { status: 403 }
      );
    }
    
    // Buscar horário original
    const horarioOriginal = await HorarioFixo.findById(horarioFixoId)
      .populate('professorId', 'nome');
    
    if (!horarioOriginal) {
      return NextResponse.json(
        { success: false, error: 'Horário original não encontrado' },
        { status: 404 }
      );
    }

    // ========== VALIDAÇÃO DE ANTECEDÊNCIA MÍNIMA DE 15 MINUTOS ==========
    const agora = new Date();
    const dataOriginalParaValidacao = new Date(dataOriginal);
    const [horaAula, minutoAula] = horarioOriginal.horarioInicio.split(':').map(Number);
    const dataHoraAula = new Date(dataOriginalParaValidacao);
    dataHoraAula.setHours(horaAula, minutoAula, 0, 0);
    
    const diffMs = dataHoraAula.getTime() - agora.getTime();
    const diffMinutos = Math.floor(diffMs / (1000 * 60));
    
    if (diffMinutos < 15) {
      const motivo = diffMinutos < 0 
        ? 'Esta aula já começou' 
        : `Faltam apenas ${diffMinutos} minutos para a aula. É necessário no mínimo 15 minutos de antecedência.`;
      return NextResponse.json(
        { success: false, error: motivo },
        { status: 400 }
      );
    }
    // ========== FIM VALIDAÇÃO DE ANTECEDÊNCIA ==========
    
    // Buscar novo horário
    const novoHorario = await HorarioFixo.findById(novoHorarioFixoId);
    
    if (!novoHorario) {
      return NextResponse.json(
        { success: false, error: 'Novo horário não encontrado' },
        { status: 404 }
      );
    }

    // ========== VERIFICAÇÃO DE CONFLITO ENTRE MODALIDADES VINCULADAS ==========
    // Se a modalidade do novo horário tem modalidades vinculadas (compartilham espaço físico),
    // verificar se há aulas no mesmo dia/horário nessas modalidades
    if (novoHorario.modalidadeId) {
      try {
        const modalidade = await Modalidade.findById(novoHorario.modalidadeId).lean();
        const vinculadas = (modalidade as any)?.modalidadesVinculadas || [];
        
        if (vinculadas.length > 0) {
          // Calcular o dia da semana da nova data
          const novaDataObj = new Date(novaData);
          const diaSemanaNovaData = novaDataObj.getDay();
          
          // Buscar aulas nas modalidades vinculadas no mesmo dia e horário
          const conflitoVinculada = await HorarioFixo.findOne({
            modalidadeId: { $in: vinculadas },
            diaSemana: diaSemanaNovaData,
            ativo: true,
            $or: [
              // Horário sobrepõe
              { horarioInicio: { $lt: novoHorario.horarioFim }, horarioFim: { $gt: novoHorario.horarioInicio } }
            ]
          }).populate('modalidadeId', 'nome');
          
          if (conflitoVinculada) {
            const nomeModalidadeConflito = (conflitoVinculada.modalidadeId as any)?.nome || 'outra modalidade';
            return NextResponse.json(
              {
                success: false,
                error: `Conflito de espaço: já existe aula de "${nomeModalidadeConflito}" neste horário. As modalidades compartilham o mesmo espaço físico.`
              },
              { status: 400 }
            );
          }
        }
      } catch (err) {
        console.warn('Erro ao verificar conflito de modalidades vinculadas:', err);
        // Não bloquear o reagendamento por erro na verificação
      }
    }
    // ========== FIM VERIFICAÇÃO DE CONFLITO ==========

    // ========== VERIFICAÇÃO DE LIMITE DE VAGAS NO DESTINO ==========
    // Verificar quantos alunos já estão na turma destino + reagendamentos aprovados/pendentes para a mesma data
    try {
      // Contar alunos fixos na turma destino
      const matriculasDestino = await Matricula.countDocuments({
        horarioFixoId: novoHorarioFixoId,
        ativo: true
      });
      
      // Contar reagendamentos aprovados ou pendentes para a mesma turma e data
      const reagendamentosParaDestino = await Reagendamento.countDocuments({
        novoHorarioFixoId: novoHorarioFixoId,
        novaData: new Date(novaData),
        status: { $in: ['pendente', 'aprovado'] }
      });
      
      // Limite padrão de vagas por turma (pode ser configurável no futuro)
      const LIMITE_VAGAS = novoHorario.limiteAlunos || 10; // usar limite do horário ou padrão 10
      
      const totalOcupacao = matriculasDestino + reagendamentosParaDestino;
      
      if (totalOcupacao >= LIMITE_VAGAS) {
        return NextResponse.json(
          { 
            success: false, 
            error: `Esta turma já está lotada para esta data. Vagas ocupadas: ${totalOcupacao}/${LIMITE_VAGAS}` 
          },
          { status: 400 }
        );
      }
    } catch (err) {
      console.warn('Erro ao verificar limite de vagas:', err);
      // Continuar mesmo com erro - melhor permitir do que bloquear por erro
    }
    // ========== FIM VERIFICAÇÃO DE LIMITE DE VAGAS ==========
    
    // Verificar se não há reagendamento pendente para o mesmo horário e data
    const reagendamentoExistente = await Reagendamento.findOne({
      horarioFixoId,
      dataOriginal: new Date(dataOriginal),
      alunoId: aluno.id,
      status: 'pendente'
    });
    
    if (reagendamentoExistente) {
      return NextResponse.json(
        { success: false, error: 'Já existe uma solicitação pendente para este horário e data' },
        { status: 400 }
      );
    }
    
    // Validar prazo de 7 dias - a nova data deve ser no máximo 7 dias após a data original
    const dataOriginalDate = new Date(dataOriginal);
    dataOriginalDate.setHours(0, 0, 0, 0);
    const novaDataDate = new Date(novaData);
    novaDataDate.setHours(0, 0, 0, 0);
    
    const limiteMaximo = new Date(dataOriginalDate);
    limiteMaximo.setDate(limiteMaximo.getDate() + 7);
    
    if (novaDataDate > limiteMaximo) {
      return NextResponse.json(
        { success: false, error: 'A nova data deve ser no máximo 7 dias após a data original' },
        { status: 400 }
      );
    }
    
    // Criar reagendamento com status PENDENTE
    const reagendamento = new Reagendamento({
      horarioFixoId,
      dataOriginal: new Date(dataOriginal),
      novaData: new Date(novaData),
      novoHorarioInicio: novoHorario.horarioInicio,
      novoHorarioFim: novoHorario.horarioFim,
      novoHorarioFixoId,
      matriculaId: matricula._id,
      alunoId: aluno.id,
      professorOrigemId: horarioOriginal.professorId?._id || null,
      motivo: `[Solicitado pelo aluno] ${motivo}`,
      status: 'pendente',
      isReposicao: false,
      solicitadoPor: 'aluno'
    });
    
    await reagendamento.save();
    
    return NextResponse.json({
      success: true,
      message: 'Solicitação de reagendamento enviada! Aguarde a aprovação da administração.',
      reagendamento
    });
    
  } catch (error) {
    console.error('[API Aluno Reagendamentos] Erro ao criar:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao criar solicitação de reagendamento' },
      { status: 500 }
    );
  }
}
