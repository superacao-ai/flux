import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Reagendamento } from '@/models/Reagendamento';
import { User } from '@/models/User';
import fs from 'fs';
import path from 'path';

// GET - Listar reagendamentos
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    
    let filter = {};
    if (status) {
      filter = { status };
    }
    
    const reagendamentos = await Reagendamento.find(filter)
      .populate({
        path: 'horarioFixoId',
        populate: [
          { path: 'alunoId', select: 'nome email' },
          { path: 'professorId', model: 'User', select: 'nome email cor' }
        ]
      })
      .populate({
        path: 'matriculaId',
        populate: {
          path: 'alunoId',
          select: 'nome email'
        }
      })
      .populate({
        path: 'novoHorarioFixoId',
        populate: {
          path: 'professorId',
          model: 'User',
          select: 'nome email cor'
        }
      })
      .populate('aprovadoPor', 'nome')
      .populate('alunoId', 'nome email')
      .sort({ criadoEm: -1 })
      .select('-__v');
    
    // Debug: log reagendamentos com isReposicao
    const reposicoes = reagendamentos.filter((r: any) => r.isReposicao === true);
    if (reposicoes.length > 0) {
      console.log('[API Reagendamentos] Reposições encontradas:', reposicoes.map((r: any) => ({
        _id: r._id,
        isReposicao: r.isReposicao,
        alunoId: r.alunoId,
        motivo: r.motivo?.substring(0, 50)
      })));
    }
    
    return NextResponse.json({
      success: true,
      data: reagendamentos
    });
  } catch (error) {
    console.error('Erro ao buscar reagendamentos:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro interno do servidor' 
      },
      { status: 500 }
    );
  }
}

// POST - Criar novo reagendamento
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    
  const body = await request.json();
  const { 
    horarioFixoId, 
    dataOriginal, 
    novaData, 
    novoHorarioInicio, 
    novoHorarioFim, 
    motivo, 
    novoHorarioFixoId, 
    matriculaId,
    // Campos de reposição
    isReposicao,
    aulaRealizadaId,
    alunoId,
    // Status pode ser passado para aprovar automaticamente (admin)
    status: statusFromBody
  } = body;

    // Validações básicas
    if (!horarioFixoId || !dataOriginal || !novaData || !novoHorarioInicio || !novoHorarioFim || !motivo) {
      return NextResponse.json(
        {
          success: false,
          error: 'Todos os campos são obrigatórios'
        },
        { status: 400 }
      );
    }

    // Enforce that the new target references an existing HorarioFixo (no creation via POST)
    if (!novoHorarioFixoId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Selecione uma turma existente como destino (novoHorarioFixoId) ao solicitar reagendamento.'
        },
        { status: 400 }
      );
    }

    // Diagnostic logging for reproduction: write payload+stack to logs/debug-reagendamentos.log
    try {
      const logDir = path.resolve(process.cwd(), 'logs');
      try { if (!fs.existsSync(logDir)) fs.mkdirSync(logDir); } catch(e) {}
      const logfile = path.join(logDir, 'debug-reagendamentos.log');
      const logEntry = { ts: new Date().toISOString(), route: 'POST /api/reagendamentos', body };
  fs.appendFileSync(logfile, JSON.stringify(logEntry) + '\n');
  console.warn('[DEBUG REAG] POST payload logged to', logfile, 'payload:', body);
    } catch (logErr:any) {
      console.warn('Failed to write debug log for POST /api/reagendamentos', String(logErr?.message || logErr));
    }

    // Criar reagendamento
    const novoReagendamentoData: any = {
      horarioFixoId,
      dataOriginal: new Date(dataOriginal),
      novaData: new Date(novaData),
      novoHorarioInicio,
      novoHorarioFim,
      motivo
    };
    if (novoHorarioFixoId) novoReagendamentoData.novoHorarioFixoId = novoHorarioFixoId;
    if (matriculaId) novoReagendamentoData.matriculaId = matriculaId;
    
    // Campos de reposição de falta
    if (isReposicao) {
      novoReagendamentoData.isReposicao = true;
      if (aulaRealizadaId) novoReagendamentoData.aulaRealizadaId = aulaRealizadaId;
      if (alunoId) novoReagendamentoData.alunoId = alunoId;
      
      // Validar prazo de 7 dias para reposição
      const dataFalta = new Date(dataOriginal);
      dataFalta.setHours(0, 0, 0, 0);
      const prazoFinal = new Date(dataFalta);
      prazoFinal.setDate(prazoFinal.getDate() + 7);
      
      const dataReposicao = new Date(novaData);
      dataReposicao.setHours(0, 0, 0, 0);
      
      if (dataReposicao > prazoFinal) {
        return NextResponse.json(
          {
            success: false,
            error: 'O prazo de 7 dias para solicitar reposição expirou'
          },
          { status: 400 }
        );
      }
      
      // Verificar se já existe reposição pendente ou aprovada para esta aula/aluno
      if (aulaRealizadaId && alunoId) {
        const reposicaoExistente = await Reagendamento.findOne({
          aulaRealizadaId,
          alunoId,
          isReposicao: true,
          status: { $in: ['pendente', 'aprovado'] }
        });
        
        if (reposicaoExistente) {
          return NextResponse.json(
            {
              success: false,
              error: reposicaoExistente.status === 'aprovado' 
                ? 'Esta falta já foi reposta' 
                : 'Já existe uma solicitação de reposição pendente para esta falta'
            },
            { status: 400 }
          );
        }
      }
    }

    // populate professorOrigemId from HorarioFixo to keep origin audit
    try {
      const { HorarioFixo } = await import('@/models/HorarioFixo');
      const origem: any = await HorarioFixo.findById(horarioFixoId).select('professorId').lean();
      if (origem && origem.professorId) {
        novoReagendamentoData.professorOrigemId = origem.professorId;
      }
    } catch (e) {
      console.warn('Não foi possível popular professorOrigemId ao criar reagendamento:', e && (e as any).message ? (e as any).message : e);
    }

    // Reposições de falta são aprovadas automaticamente (feitas pelo admin/professor)
    // Também aprovar automaticamente se o status 'aprovado' foi passado no body (admin criando reagendamento)
    if (isReposicao || statusFromBody === 'aprovado') {
      novoReagendamentoData.status = 'aprovado';
    }

    const novoReagendamento = new Reagendamento(novoReagendamentoData);

    const reagendamentoSalvo = await novoReagendamento.save();

    // NOTA: Reagendamentos são temporários (para uma data específica)
    // O aluno permanece na turma de origem e a lógica de exibição no calendário
    // controla quando ele aparece cinza (origem) e quando aparece no destino
    
    // Buscar com populate para retornar dados completos
    const reagendamentoCompleto = await Reagendamento.findById(reagendamentoSalvo._id)
      .populate({
        path: 'horarioFixoId',
        populate: [
          { path: 'alunoId', select: 'nome email' },
          { path: 'professorId', select: 'nome especialidade cor' }
        ]
      })
      .populate({
        path: 'matriculaId',
        populate: {
          path: 'alunoId',
          select: 'nome email'
        }
      })
      .populate({
        path: 'novoHorarioFixoId',
        populate: {
          path: 'professorId',
          select: 'nome especialidade cor'
        }
      })
      .select('-__v');

    return NextResponse.json(
      {
        success: true,
        data: reagendamentoCompleto,
        message: 'Reagendamento criado com sucesso'
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Erro ao criar reagendamento:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err: any) => err.message);
      return NextResponse.json(
        {
          success: false,
          error: messages.join(', ')
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Erro interno do servidor'
      },
      { status: 500 }
    );
  }
}