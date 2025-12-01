import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { HorarioFixo } from '@/models/HorarioFixo';
import { User } from '@/models/User';
import { Aluno } from '@/models/Aluno';
import mongoose from 'mongoose';

// GET - Buscar um horário por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: 'ID inválido' },
        { status: 400 }
      );
    }

    const horario = await HorarioFixo.findById(id)
      .populate('alunoId', 'nome email periodoTreino parceria observacoes congelado ausente emEspera')
      .populate('professorId', 'nome especialidade')
      .lean();

    if (!horario) {
      return NextResponse.json(
        { success: false, error: 'Horário não encontrado' },
        { status: 404 }
      );
    }

    // Garantir que os campos booleanos sempre existem - LENDO DO ALUNO
    const horarioData: any = horario; // already .lean() above
    // If professorId lacks nome, try resolving from User collection
    try {
      const p = horarioData && horarioData.professorId;
      const pid = p && (p._id || p) ? String(p._id || p) : '';
      if (pid && (!(p && typeof p === 'object' && (p.nome || p.nome === '')))) {
        const u: any = await User.findById(pid).select('nome cor tipo').lean();
        if (u) {
          const ua: any = u;
          horarioData.professorId = { _id: pid, nome: ua.nome, cor: ua.cor || '#3B82F6', tipo: ua.tipo };
        }
      }
    } catch (e) {
      // ignore
    }
    const alunoData = horarioData.alunoId || {};
    const enrichedHorario = {
      ...horarioData,
      congelado: alunoData.congelado === true,
      ausente: alunoData.ausente === true,
      emEspera: alunoData.emEspera === true
    };

    return NextResponse.json({ success: true, data: enrichedHorario });
  } catch (error) {
    console.error('Erro ao buscar horário:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

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
    console.log('PATCH /api/horarios/[id] - ID recebido:', id);
    console.log('PATCH /api/horarios/[id] - ID é ObjectId válido?', mongoose.Types.ObjectId.isValid(id));
    
    const body = await request.json();
    console.log('PATCH /api/horarios/[id] - Body recebido:', body);

    const updates: any = {};
    // Removido congelado, ausente, emEspera - esses campos agora são do ALUNO
    const allowed = ['professorId', 'diaSemana', 'horarioInicio', 'horarioFim', 'observacoes'];
    for (const key of allowed) {
      if (body[key] !== undefined) updates[key] = body[key];
    }
    
    console.log('PATCH /api/horarios/[id] - Updates:', updates);

    // Validate and coerce professorId if provided
    if (updates.professorId) {
      const mongoose = (await import('mongoose')).default;
      if (!mongoose.Types.ObjectId.isValid(updates.professorId)) {
        return NextResponse.json({ success: false, error: 'professorId inválido' }, { status: 400 });
      }
      updates.professorId = new mongoose.Types.ObjectId(updates.professorId);
    }

  const horario = await HorarioFixo.findByIdAndUpdate(id, { $set: updates }, { new: true, runValidators: true });

    console.log('PATCH /api/horarios/[id] - Horário encontrado:', horario ? 'SIM' : 'NÃO');
    if (horario) {
      console.log('PATCH /api/horarios/[id] - Valores salvos:', {
        _id: horario._id,
        congelado: horario.congelado,
        ausente: horario.ausente,
        emEspera: horario.emEspera
      });
    }
    
    if (!horario) {
      console.error('PATCH /api/horarios/[id] - Horário não encontrado com ID:', id);
      return NextResponse.json({ success: false, error: 'Horário não encontrado' }, { status: 404 });
    }

  const horarioPop = await HorarioFixo.findById(horario._id).populate('alunoId', 'nome email periodoTreino parceria observacoes congelado ausente emEspera').populate('professorId', 'nome especialidade').lean();

  // Debug: verificar se os valores estão no banco
  console.log('PATCH /api/horarios/[id] - Após populate:', {
    _id: (horarioPop as any)?._id,
    congelado: (horarioPop as any)?.congelado,
    ausente: (horarioPop as any)?.ausente,
    emEspera: (horarioPop as any)?.emEspera
  });

  // Also fetch a plain JS object (lean) and the raw collection document to verify persistence
  try {
  const horarioLean = await HorarioFixo.findById(horario._id).lean();
  } catch (e) {}
  try {
  const raw = await HorarioFixo.collection.findOne({ _id: horario._id });
  } catch (e) {}

  // Garantir que os campos booleanos sempre existem - LENDO DO ALUNO
  let horarioData: any = horarioPop;
  // horarioPop is lean() so it's a plain object
  // If professorId lacks nome, try resolving from User collection
  try {
    const p = horarioData && horarioData.professorId;
    const pid = p && (p._id || p) ? String(p._id || p) : '';
    if (pid && (!(p && typeof p === 'object' && (p.nome || p.nome === '')))) {
      const u: any = await User.findById(pid).select('nome cor tipo').lean();
      if (u) {
        const ua: any = u;
        horarioData.professorId = { _id: pid, nome: ua.nome, cor: ua.cor || '#3B82F6', tipo: ua.tipo };
      }
    }
  } catch (e) {
    // ignore
  }

  const alunoData = horarioData?.alunoId || {};
  const enrichedHorario = {
    ...horarioData,
    congelado: alunoData.congelado === true,
    ausente: alunoData.ausente === true,
    emEspera: alunoData.emEspera === true
  };

  return NextResponse.json({ success: true, data: enrichedHorario });
  } catch (error) {
    console.error('Erro ao atualizar horário:', error);
    return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 });
  }
}