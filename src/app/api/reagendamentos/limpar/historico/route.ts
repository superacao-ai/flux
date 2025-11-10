import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Reagendamento } from '@/models/Reagendamento';

// DELETE - Limpar histórico de reagendamentos
export async function DELETE(request: NextRequest) {
  try {
    await connectDB();

    // Deletar todos os reagendamentos
    const result = await Reagendamento.deleteMany({});

    if (result.deletedCount === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nenhum reagendamento para limpar',
        deletedCount: 0
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Histórico de reagendamentos limpo com sucesso',
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Erro ao limpar histórico de reagendamentos:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao limpar histórico'
    }, { status: 500 });
  }
}

