import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import mongoose from 'mongoose';
import { Matricula } from '@/models/Matricula';
import { Aluno } from '@/models/Aluno';

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();
    const { originalMatriculaId, substituteMatriculaId } = body || {};

    if (!originalMatriculaId || !substituteMatriculaId) {
      return NextResponse.json({ success: false, error: 'Campos obrigatórios: originalMatriculaId e substituteMatriculaId' }, { status: 400 });
    }

    if (!mongoose.Types.ObjectId.isValid(originalMatriculaId) || !mongoose.Types.ObjectId.isValid(substituteMatriculaId)) {
      return NextResponse.json({ success: false, error: 'IDs inválidos' }, { status: 400 });
    }

    const origId = new mongoose.Types.ObjectId(originalMatriculaId);
    const subId = new mongoose.Types.ObjectId(substituteMatriculaId);

    const original = await Matricula.findById(origId).lean() as { _id: any; alunoId?: any; horarioFixoId?: any } | null;
    const substitute = await Matricula.findById(subId).lean() as { _id: any; replacesMatriculaId?: any } | null;

    if (!original || !substitute) {
      return NextResponse.json({ success: false, error: 'Matricula original ou substituta não encontrada' }, { status: 404 });
    }

    // Ensure relationship
    if (!substitute.replacesMatriculaId || String(substitute.replacesMatriculaId) !== String(origId)) {
      return NextResponse.json({ success: false, error: 'A matrícula substituta não corresponde à original informada' }, { status: 400 });
    }

    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      // Soft-delete the substitute matricula (set ativo=false)
      await Matricula.updateOne({ _id: subId }, { $set: { ativo: false } }, { session });

      // Unfreeze the original aluno (set congelado=false)
      if (original.alunoId) {
        await Aluno.findByIdAndUpdate(original.alunoId, { $set: { congelado: false, atualizadoEm: new Date() } }, { session });
      }

      await session.commitTransaction();
    } catch (txErr) {
      try { await session.abortTransaction(); } catch (e) { /* ignore */ }
      console.error('Erro na transação reclaim:', txErr);
      return NextResponse.json({ success: false, error: 'Erro ao processar reclaim' }, { status: 500 });
    } finally {
      try { session.endSession(); } catch (e) { /* ignore */ }
    }

    return NextResponse.json({ success: true, message: 'Substituto removido e aluno original reativado' });
  } catch (error) {
    console.error('Erro em POST /api/matriculas/reclaim', error);
    return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 });
  }
}
