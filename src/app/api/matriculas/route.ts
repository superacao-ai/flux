import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import mongoose from 'mongoose';
import { Matricula } from '@/models/Matricula';
import { HorarioFixo } from '@/models/HorarioFixo';

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();
    const { horarioFixoId, alunoId } = body || {};

    if (!horarioFixoId || !alunoId) {
      return NextResponse.json({ success: false, error: 'Campos obrigatórios: horarioFixoId e alunoId' }, { status: 400 });
    }

    if (!mongoose.Types.ObjectId.isValid(horarioFixoId) || !mongoose.Types.ObjectId.isValid(alunoId)) {
      return NextResponse.json({ success: false, error: 'IDs inválidos' }, { status: 400 });
    }

    const hfId = new mongoose.Types.ObjectId(horarioFixoId);
    const aId = new mongoose.Types.ObjectId(alunoId);

    // Ensure the target horario exists and is active
    const target = await HorarioFixo.findById(hfId).where('ativo').equals(true);
    if (!target) {
      return NextResponse.json({ success: false, error: 'Horario alvo não encontrado ou inativo' }, { status: 404 });
    }

    // Basic conflict check: if the aluno already has an active matricula for this horario, return 409
    const exists = await Matricula.findOne({ horarioFixoId: hfId, alunoId: aId, ativo: true }).lean();
    if (exists) {
      return NextResponse.json({ success: false, error: 'Aluno já matriculado neste horário', existing: exists }, { status: 409 });
    }

    // Create matricula
    const nova = new Matricula({ horarioFixoId: hfId, alunoId: aId, ativo: true });
    await nova.save();

    // Keep HorarioFixo.alunoId compatible: if after insert there's only one active matricula, set alunoId on horario
    try {
      const count = await Matricula.countDocuments({ horarioFixoId: hfId, ativo: true });
      if (count === 1) {
        target.alunoId = aId as any;
        await target.save();
      } else {
        // multiple students -> clear alunoId for backward compatibility avoidance
        target.alunoId = undefined as any;
        await target.save();
      }
    } catch (e) {
      // non-fatal
      console.warn('Failed to sync HorarioFixo.alunoId after matricula create', e);
    }

    // return matricula + horario atualizado (populated)
    const horarioAtual = await HorarioFixo.findById(hfId).populate('alunoId', 'nome email').populate('professorId', 'nome especialidade').lean();

    return NextResponse.json({ success: true, data: { matricula: nova, horario: horarioAtual } }, { status: 201 });
  } catch (error: any) {
    console.error('Erro em POST /api/matriculas', error);
    return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 });
  }
}
