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
    const allowed = ['professorId', 'diaSemana', 'horarioInicio', 'horarioFim', 'observacoes'];
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

    const horario = await HorarioFixo.findByIdAndUpdate(id, updates, { new: true });

    if (!horario) {
      return NextResponse.json({ success: false, error: 'Horário não encontrado' }, { status: 404 });
    }

    const horarioPop = await HorarioFixo.findById(horario._id).populate('alunoId', 'nome email').populate('professorId', 'nome especialidade');

    return NextResponse.json({ success: true, data: horarioPop });
  } catch (error) {
    console.error('Erro ao atualizar horário:', error);
    return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 });
  }
}