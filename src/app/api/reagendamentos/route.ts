import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Reagendamento } from '@/models/Reagendamento';
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
      .populate('aprovadoPor', 'nome')
      .sort({ criadoEm: -1 })
      .select('-__v');
    
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
  const { horarioFixoId, dataOriginal, novaData, novoHorarioInicio, novoHorarioFim, motivo, novoHorarioFixoId, matriculaId } = body;

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

    const novoReagendamento = new Reagendamento(novoReagendamentoData);

    const reagendamentoSalvo = await novoReagendamento.save();
    
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
        message: 'Reagendamento solicitado com sucesso'
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