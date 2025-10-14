import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Reagendamento } from '@/models/Reagendamento';

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
          { path: 'professorId', select: 'nome especialidade' }
        ]
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
    const { horarioFixoId, dataOriginal, novaData, novoHorarioInicio, novoHorarioFim, motivo } = body;

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

    // Criar reagendamento
    const novoReagendamento = new Reagendamento({
      horarioFixoId,
      dataOriginal: new Date(dataOriginal),
      novaData: new Date(novaData),
      novoHorarioInicio,
      novoHorarioFim,
      motivo
    });

    const reagendamentoSalvo = await novoReagendamento.save();
    
    // Buscar com populate para retornar dados completos
    const reagendamentoCompleto = await Reagendamento.findById(reagendamentoSalvo._id)
      .populate({
        path: 'horarioFixoId',
        populate: [
          { path: 'alunoId', select: 'nome email' },
          { path: 'professorId', select: 'nome especialidade' }
        ]
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