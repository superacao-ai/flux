import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { HorarioFixo } from '@/models/HorarioFixo';
import { Aluno } from '@/models/Aluno';
import mongoose from 'mongoose';

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

    // If this horario was linked to an aluno, check whether that aluno has any
    // other active horários. If not, soft-delete the aluno (mark ativo=false).
    try {
      const alunoId = horario.alunoId as any;
      if (alunoId) {
        const alunoObjectId = mongoose.Types.ObjectId.isValid(String(alunoId)) ? new mongoose.Types.ObjectId(String(alunoId)) : null;
        if (alunoObjectId) {
          const remaining = await HorarioFixo.countDocuments({ alunoId: alunoObjectId, ativo: true });
          if (remaining === 0) {
            await Aluno.findByIdAndUpdate(alunoObjectId, { ativo: false, atualizadoEm: new Date() });
          }
        }
      }
    } catch (e) {
      // don't block deletion on aluno cleanup failures
      console.warn('Aviso: falha ao verificar/excluir aluno órfão após excluir horário', e);
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

// PATCH - Atualizar um horário por ID
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const body = await request.json();

    const updates: any = {};
  const allowed = ['professorId', 'diaSemana', 'horarioInicio', 'horarioFim', 'observacoes', 'congelado', 'ausente', 'emEspera'];
    for (const key of allowed) {
      if (body[key] !== undefined) updates[key] = body[key];
    }

    // Validate and coerce professorId if provided
    if (updates.professorId) {
      const mongoose = (await import('mongoose')).default;
      if (!mongoose.Types.ObjectId.isValid(updates.professorId)) {
        return NextResponse.json({ success: false, error: 'professorId inválido' }, { status: 400 });
      }
      updates.professorId = new mongoose.Types.ObjectId(updates.professorId);
    }

  const horario = await HorarioFixo.findByIdAndUpdate(id, { $set: updates }, { new: true, runValidators: true });

    if (!horario) {
      return NextResponse.json({ success: false, error: 'Horário não encontrado' }, { status: 404 });
    }

  const horarioPop = await HorarioFixo.findById(horario._id).populate('alunoId', 'nome email').populate('professorId', 'nome especialidade');

  // Also fetch a plain JS object (lean) and the raw collection document to verify persistence
  try {
  const horarioLean = await HorarioFixo.findById(horario._id).lean();
  } catch (e) {}
  try {
  const raw = await HorarioFixo.collection.findOne({ _id: horario._id });
  } catch (e) {}

  return NextResponse.json({ success: true, data: horarioPop });
  } catch (error) {
    console.error('Erro ao atualizar horário:', error);
    return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 });
  }
}