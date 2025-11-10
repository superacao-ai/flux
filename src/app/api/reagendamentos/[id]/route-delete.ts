import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Reagendamento } from '@/models/Reagendamento';

// DELETE - Cancelar/excluir reagendamento
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;

    const reagendamento = await Reagendamento.findById(id);

    if (!reagendamento) {
      return NextResponse.json(
        {
          success: false,
          error: 'Reagendamento não encontrado'
        },
        { status: 404 }
      );
    }

    // Se o reagendamento foi aprovado e houve movimentação de matrícula, reverter
    if (reagendamento.status === 'aprovado') {
      const matriculaId = (reagendamento as any).matriculaId;
      const horarioOriginalId = (reagendamento as any).horarioFixoId;
      
      if (matriculaId && horarioOriginalId) {
        const { Matricula } = await import('@/models/Matricula');
        
        // Buscar a matrícula original (desativada) e reativar
        const matriculaOriginal = await Matricula.findById(matriculaId);
        if (matriculaOriginal && !matriculaOriginal.ativo) {
          matriculaOriginal.ativo = true;
          await matriculaOriginal.save();
        }
        
        // Buscar e desativar a matrícula criada na turma destino
        const novoHorarioFixoId = (reagendamento as any).novoHorarioFixoId;
        if (novoHorarioFixoId && matriculaOriginal) {
          const matriculaDestino = await Matricula.findOne({
            horarioFixoId: novoHorarioFixoId,
            alunoId: matriculaOriginal.alunoId,
            ativo: true
          });
          
          if (matriculaDestino) {
            matriculaDestino.ativo = false;
            await matriculaDestino.save();
          }
        }
      }
    }

    // Excluir o reagendamento
    await Reagendamento.findByIdAndDelete(id);

    return NextResponse.json({
      success: true,
      message: 'Reagendamento cancelado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao cancelar reagendamento:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro interno do servidor' 
      },
      { status: 500 }
    );
  }
}
