import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Reagendamento } from '@/models/Reagendamento';

// PUT - Atualizar status do reagendamento (aprovar/rejeitar)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    // Validações
    if (!status || !['aprovado', 'rejeitado'].includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Status inválido'
        },
        { status: 400 }
      );
    }

    const reagendamento = await Reagendamento.findByIdAndUpdate(
      id,
      { 
        status,
        // TODO: Implementar autenticação para capturar o usuário que aprovou
        // aprovadoPor: userId (quando implementarmos autenticação completa)
      },
      { new: true }
    ).populate({
      path: 'horarioFixoId',
      populate: [
        { path: 'alunoId', select: 'nome email' },
        { path: 'professorId', select: 'nome especialidade' }
      ]
    });

    if (!reagendamento) {
      return NextResponse.json(
        {
          success: false,
          error: 'Reagendamento não encontrado'
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: reagendamento,
      message: `Reagendamento ${status} com sucesso`
    });
  } catch (error) {
    console.error('Erro ao atualizar reagendamento:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro interno do servidor' 
      },
      { status: 500 }
    );
  }
}