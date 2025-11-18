import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import mongoose from 'mongoose';
import { Matricula } from '@/models/Matricula';
import { HorarioFixo } from '@/models/HorarioFixo';

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();
    const { horarioFixoId, alunoId, isSubstitute, replacesMatriculaId } = body || {};

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

    // If this is a substitute, validate the replacesMatriculaId
    let novaPayload: any = { horarioFixoId: hfId, alunoId: aId, ativo: true };
    if (isSubstitute && replacesMatriculaId) {
      if (!mongoose.Types.ObjectId.isValid(replacesMatriculaId)) {
        return NextResponse.json({ success: false, error: 'replacesMatriculaId inválido' }, { status: 400 });
      }

      const replacedId = new mongoose.Types.ObjectId(replacesMatriculaId);
      const originalMat = await Matricula.findById(replacedId).lean();
      if (!originalMat) {
        return NextResponse.json({ success: false, error: 'Matricula original não encontrada' }, { status: 404 });
      }
      // Ensure the original matricula belongs to the same horario
      if (String(originalMat.horarioFixoId) !== String(hfId)) {
        return NextResponse.json({ success: false, error: 'Matricula original não pertence a este horário' }, { status: 400 });
      }

      // Optional safety: ensure original aluno is congelado or inactive
      // We consider it safer to allow substitute only when original is congelado
      const AlunoModel = mongoose.model('Aluno');
      const originalAluno = await AlunoModel.findById(originalMat.alunoId).lean();
      if (originalAluno && !originalAluno.congelado) {
        return NextResponse.json({ success: false, error: 'Aluno original não está congelado; não é permitido criar substituto' }, { status: 400 });
      }

      novaPayload.isSubstitute = true;
      novaPayload.replacesMatriculaId = replacedId;
    }

    // Create matricula
    const nova = new Matricula(novaPayload);
    await nova.save();

    // Não atualizar mais o campo alunoId em HorarioFixo. O vínculo é sempre pela tabela Matricula.
    // Se necessário para compatibilidade visual, pode ser populado apenas na consulta, nunca salvo.

    // return matricula + horario atualizado (populated)
    const horarioAtual = await HorarioFixo.findById(hfId).populate('alunoId', 'nome email periodoTreino parceria observacoes').populate('professorId', 'nome especialidade').lean();

    return NextResponse.json({ success: true, data: { matricula: nova, horario: horarioAtual } }, { status: 201 });
  } catch (error: any) {
    console.error('Erro em POST /api/matriculas', error);
    return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 });
  }
}
