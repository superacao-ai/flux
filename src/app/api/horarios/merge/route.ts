import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { HorarioFixo } from '@/models/HorarioFixo';
import { Aluno } from '@/models/Aluno';
import mongoose from 'mongoose';

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { fromAlunoId, toAlunoId } = body;

    // Validar IDs
    if (!fromAlunoId || !toAlunoId) {
      return NextResponse.json(
        { success: false, error: 'fromAlunoId e toAlunoId são obrigatórios' },
        { status: 400 }
      );
    }

    // Validar se são ObjectIds válidos
    if (!mongoose.Types.ObjectId.isValid(String(fromAlunoId)) || !mongoose.Types.ObjectId.isValid(String(toAlunoId))) {
      return NextResponse.json(
        { success: false, error: 'IDs inválidos' },
        { status: 400 }
      );
    }

    const fromAlunoObjectId = new mongoose.Types.ObjectId(String(fromAlunoId));
    const toAlunoObjectId = new mongoose.Types.ObjectId(String(toAlunoId));

    // Verificar se ambos os alunos existem
    const fromAluno = await Aluno.findById(fromAlunoObjectId);
    const toAluno = await Aluno.findById(toAlunoObjectId);

    if (!fromAluno) {
      return NextResponse.json(
        { success: false, error: 'Aluno de origem não encontrado' },
        { status: 404 }
      );
    }

    if (!toAluno) {
      return NextResponse.json(
        { success: false, error: 'Aluno de destino não encontrado' },
        { status: 404 }
      );
    }

    // Atualizar todos os horários do aluno de origem para apontar para o de destino
    const result = await HorarioFixo.updateMany(
      { alunoId: fromAlunoObjectId },
      { alunoId: toAlunoObjectId }
    );

    console.log(`Merge: Updated ${result.modifiedCount} horários from ${fromAlunoId} to ${toAlunoId}`);

    // Opcionalmente, pode-se marcar o aluno de origem como inativo ou deletá-lo
    // Por enquanto, deixaremos ele como está para não perder histórico

    return NextResponse.json(
      {
        success: true,
        data: {
          updatedCount: result.modifiedCount,
          fromAlunoId: String(fromAlunoObjectId),
          toAlunoId: String(toAlunoObjectId),
          message: `${result.modifiedCount} horário(s) vinculado(s) com sucesso`
        }
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Erro ao fazer merge de alunos:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao vincular alunos' },
      { status: 500 }
    );
  }
}
