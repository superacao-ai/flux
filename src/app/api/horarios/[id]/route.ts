import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { HorarioFixo } from '@/models/HorarioFixo';

// DELETE - Excluir horário
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;

    const horario = await HorarioFixo.findByIdAndUpdate(
      id,
      { ativo: false },
      { new: true }
    );

    if (!horario) {
      return NextResponse.json(
        {
          success: false,
          error: 'Horário não encontrado'
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Horário excluído com sucesso'
    });
  } catch (error) {
    console.error('Erro ao excluir horário:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro interno do servidor' 
      },
      { status: 500 }
    );
  }
}