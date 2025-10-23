import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import connectDB from '@/lib/mongodb';
import mongoose from 'mongoose';
import { Aula } from '@/models/Aula';
import { Professor } from '@/models/Professor';

const JWT_SECRET = process.env.JWT_SECRET || 'sua_chave_secreta_super_forte';

export async function POST(request: NextRequest) {
  try {
    const auth = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!auth || !auth.startsWith('Bearer ')) return NextResponse.json({ success: false, error: 'Token não fornecido' }, { status: 401 });
    const token = auth.split(' ')[1];
    let payload: any;
    try { payload = jwt.verify(token, JWT_SECRET); } catch (err) { return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 }); }

    await connectDB();

    // Resolve professor id: token.userId may be user._id; try to resolve by email if needed
    let professorId = payload.userId;
    if (!mongoose.Types.ObjectId.isValid(professorId) && payload.email) {
      const prof = await Professor.findOne({ email: String(payload.email).toLowerCase(), ativo: true }).select('_id');
      if (prof) professorId = prof._id;
    }

    const body = await request.json();
    const { horarioFixoId, data, ministrada = true, presencas = [] } = body;

    const horarioObjId = horarioFixoId && mongoose.Types.ObjectId.isValid(horarioFixoId) ? new mongoose.Types.ObjectId(horarioFixoId) : undefined;
    const profObjId = professorId && mongoose.Types.ObjectId.isValid(String(professorId)) ? new mongoose.Types.ObjectId(String(professorId)) : undefined;
    const aulaDate = data ? new Date(data) : new Date();

    // Normalize presencas
    const presencasNormalized = (presencas || []).map((p: any) => ({
      alunoId: mongoose.Types.ObjectId.isValid(p.alunoId) ? new mongoose.Types.ObjectId(p.alunoId) : undefined,
      presente: !!p.presente
    })).filter((p: any) => p.alunoId);

    // Try to find existing Aula for the same horarioFixoId and same day
    if (horarioObjId) {
      const startOfDay = new Date(aulaDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(startOfDay);
      endOfDay.setDate(endOfDay.getDate() + 1);

      const existing = await Aula.findOne({ horarioFixoId: horarioObjId, data: { $gte: startOfDay, $lt: endOfDay } });
      if (existing) {
        // update existing
        existing.ministrada = ministrada;
        existing.professorId = existing.professorId || profObjId;
        existing.data = aulaDate;
        // Replace presencas (could be improved to merge)
        existing.presencas = presencasNormalized;
        await existing.save();
        return NextResponse.json({ success: true, data: existing, message: 'Aula atualizada' });
      }
    }

    const aula = new Aula({
      horarioFixoId: horarioObjId,
      professorId: profObjId,
      data: aulaDate,
      ministrada,
      presencas: presencasNormalized
    });

    await aula.save();

    return NextResponse.json({ success: true, data: aula });
  } catch (err) {
    console.error('Erro em /api/me/aulas:', err);
    return NextResponse.json({ success: false, error: 'Erro interno' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!auth || !auth.startsWith('Bearer ')) return NextResponse.json({ success: false, error: 'Token não fornecido' }, { status: 401 });
    const token = auth.split(' ')[1];
    let payload: any;
    try { payload = jwt.verify(token, JWT_SECRET); } catch (err) { return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 }); }

    await connectDB();

    const url = new URL(request.url);
    const horarioFixoId = url.searchParams.get('horarioFixoId');
    const dateStr = url.searchParams.get('date');

    if (!horarioFixoId) return NextResponse.json({ success: false, error: 'horarioFixoId é obrigatório' }, { status: 400 });

    const day = dateStr ? new Date(dateStr) : new Date();
    const startOfDay = new Date(day);
    startOfDay.setHours(0,0,0,0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const aula = await Aula.findOne({ horarioFixoId: new mongoose.Types.ObjectId(horarioFixoId), data: { $gte: startOfDay, $lt: endOfDay } }).lean();

    return NextResponse.json({ success: true, data: aula || null });
  } catch (err) {
    console.error('Erro GET /api/me/aulas:', err);
    return NextResponse.json({ success: false, error: 'Erro interno' }, { status: 500 });
  }
}
