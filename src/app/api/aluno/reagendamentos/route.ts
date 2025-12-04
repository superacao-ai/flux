import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import connectDB from '@/lib/mongodb';
import { Reagendamento } from '@/models/Reagendamento';
import { HorarioFixo } from '@/models/HorarioFixo';
import { Matricula } from '@/models/Matricula';

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
    
    // Buscar novo horário
    const novoHorario = await HorarioFixo.findById(novoHorarioFixoId);
    
    if (!novoHorario) {
      return NextResponse.json(
        { success: false, error: 'Novo horário não encontrado' },
        { status: 404 }
      );
    }
    
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
