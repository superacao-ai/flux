import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import mongoose from 'mongoose';
import { Matricula } from '@/models/Matricula';

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await connectDB();
    const { id } = params || {};
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 });
    }

    const mat = await Matricula.findById(id);
    if (!mat) {
      return NextResponse.json({ success: false, error: 'Matricula não encontrada' }, { status: 404 });
    }

    // Soft-delete: mark as inactive so horário queries (which filter ativo:true) stop returning it
    mat.ativo = false;
    await mat.save();

    return NextResponse.json({ success: true, message: 'Matricula removida' });
  } catch (error: any) {
    console.error('Erro em DELETE /api/matriculas/:id', error);
    return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 });
  }
}
