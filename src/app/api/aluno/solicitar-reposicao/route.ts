import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import connectDB from '@/lib/mongodb';
import { Reagendamento } from '@/models/Reagendamento';
import { HorarioFixo } from '@/models/HorarioFixo';
import { Matricula } from '@/models/Matricula';
import { AvisoAusencia } from '@/models/AvisoAusencia';

const JWT_SECRET = process.env.JWT_SECRET || 'aluno-secret-key-2025';

async function getAlunoFromToken() {
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

// POST - Solicitar reposição de aula
export async function POST(req: NextRequest) {
  try {
    const aluno = await getAlunoFromToken();
    
    if (!aluno) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }
    
    await connectDB();
    
    const body = await req.json();
    const { avisoAusenciaId, novoHorarioFixoId, novaData } = body;
    
    // Validações
    if (!avisoAusenciaId || !novoHorarioFixoId || !novaData) {
      return NextResponse.json(
        { success: false, error: 'Falta, novo horário e nova data são obrigatórios' },
        { status: 400 }
      );
    }
    
    // Buscar o aviso de ausência
    const avisoAusencia = await AvisoAusencia.findOne({
      _id: avisoAusenciaId,
      alunoId: aluno.id,
      status: 'confirmada',
      temDireitoReposicao: true,
      reposicoesUsadas: 0
    }).populate('horarioFixoId');
    
    if (!avisoAusencia) {
      return NextResponse.json(
        { success: false, error: 'Falta não encontrada ou sem direito a reposição' },
        { status: 404 }
      );
    }
    
    // Verificar se a nova data é futura
    const novaDataDate = new Date(novaData);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    if (novaDataDate < hoje) {
      return NextResponse.json(
        { success: false, error: 'A data da reposição deve ser futura' },
        { status: 400 }
      );
    }
    
    // Buscar o novo horário
    const novoHorario = await HorarioFixo.findById(novoHorarioFixoId)
      .populate('modalidadeId', 'nome cor')
      .populate('professorId', 'nome');
    
    if (!novoHorario) {
      return NextResponse.json(
        { success: false, error: 'Novo horário não encontrado' },
        { status: 404 }
      );
    }
    
    // Verificar se o dia da semana corresponde
    const diaSemanaNovaData = novaDataDate.getDay();
    if (novoHorario.diaSemana !== diaSemanaNovaData) {
      return NextResponse.json(
        { success: false, error: 'A data selecionada não corresponde ao dia da semana do horário' },
        { status: 400 }
      );
    }
    
    // Verificar se já existe solicitação pendente para esta falta
    const solicitacaoExistente = await Reagendamento.findOne({
      alunoId: aluno.id,
      isReposicao: true,
      status: 'pendente',
      // Vincular pelo aviso de ausência
      motivo: { $regex: avisoAusenciaId }
    });
    
    if (solicitacaoExistente) {
      return NextResponse.json(
        { success: false, error: 'Já existe uma solicitação de reposição pendente para esta falta' },
        { status: 400 }
      );
    }
    
    // Buscar matrícula do aluno
    const matricula = await Matricula.findOne({
      alunoId: aluno.id,
      horarioFixoId: avisoAusencia.horarioFixoId._id,
      ativo: true
    });
    
    // Criar solicitação de reposição
    const reposicao = new Reagendamento({
      horarioFixoId: avisoAusencia.horarioFixoId._id,
      dataOriginal: avisoAusencia.dataAusencia,
      novaData: novaDataDate,
      novoHorarioInicio: novoHorario.horarioInicio,
      novoHorarioFim: novoHorario.horarioFim,
      novoHorarioFixoId: novoHorarioFixoId,
      matriculaId: matricula?._id || avisoAusencia.matriculaId,
      alunoId: aluno.id,
      professorOrigemId: avisoAusencia.horarioFixoId.professorId || null,
      motivo: `[Reposição de falta - Aviso: ${avisoAusenciaId}] Falta do dia ${new Date(avisoAusencia.dataAusencia).toLocaleDateString('pt-BR')}. Motivo original: ${avisoAusencia.motivo}`,
      status: 'pendente',
      isReposicao: true,
      solicitadoPor: 'aluno'
    });
    
    await reposicao.save();
    
    return NextResponse.json({
      success: true,
      message: 'Solicitação de reposição enviada! Aguarde a aprovação da administração.',
      reposicao
    });
    
  } catch (error) {
    console.error('[API Solicitar Reposição] Erro:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao solicitar reposição' },
      { status: 500 }
    );
  }
}
