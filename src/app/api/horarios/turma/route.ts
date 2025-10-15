import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { HorarioFixo } from '@/models/HorarioFixo';
import mongoose from 'mongoose';

export async function PATCH(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();

    const { originalGroup } = body;
    if (!originalGroup) {
      return NextResponse.json({ success: false, error: 'originalGroup é obrigatório' }, { status: 400 });
    }

    // If memberIds provided, use them to target exact docs
    const memberIds: string[] | undefined = (body.memberIds && Array.isArray(body.memberIds)) ? body.memberIds : undefined;
    let filter: any;
    if (memberIds && memberIds.length > 0) {
      filter = { _id: { $in: memberIds.map((id: string) => new mongoose.Types.ObjectId(id)) }, ativo: true };
    } else {
      filter = {
        professorId: new mongoose.Types.ObjectId(originalGroup.professorId),
        diaSemana: originalGroup.diaSemana,
        horarioInicio: originalGroup.horarioInicio,
        horarioFim: originalGroup.horarioFim,
        ativo: true
      };
    }

    const updates: any = {};
    const allowed = ['professorId', 'diaSemana', 'horarioInicio', 'horarioFim', 'observacoes'];
    for (const key of allowed) {
      if (body[key] !== undefined) {
        if (key === 'professorId') {
          if (!mongoose.Types.ObjectId.isValid(body[key])) {
            return NextResponse.json({ success: false, error: 'professorId inválido' }, { status: 400 });
          }
          updates[key] = new mongoose.Types.ObjectId(body[key]);
        } else {
          updates[key] = body[key];
        }
      }
    }

    await HorarioFixo.updateMany(filter, { $set: updates });

    // Return updated docs
    const updated = await HorarioFixo.find(filter).populate('alunoId', 'nome email').populate('professorId', 'nome especialidade');

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Erro ao atualizar turma:', error);
    return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();

    const { originalGroup } = body || {};
    const memberIds: string[] | undefined = (body && body.memberIds && Array.isArray(body.memberIds)) ? body.memberIds : undefined;

    let filter: any;
    if (memberIds && memberIds.length > 0) {
      filter = { _id: { $in: memberIds.map((id: string) => new mongoose.Types.ObjectId(id)) }, ativo: true };
    } else if (originalGroup) {
      filter = {
        professorId: new mongoose.Types.ObjectId(originalGroup.professorId),
        diaSemana: originalGroup.diaSemana,
        horarioInicio: originalGroup.horarioInicio,
        horarioFim: originalGroup.horarioFim,
        ativo: true
      };
    } else {
      return NextResponse.json({ success: false, error: 'memberIds ou originalGroup obrigatório' }, { status: 400 });
    }

    const res = await HorarioFixo.updateMany(filter, { $set: { ativo: false } });

    return NextResponse.json({ success: true, data: { modifiedCount: res.modifiedCount } });
  } catch (error) {
    console.error('Erro ao deletar turma:', error);
    return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 });
  }
}
