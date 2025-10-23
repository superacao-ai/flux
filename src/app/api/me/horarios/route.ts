import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import connectDB from '@/lib/mongodb';
import { HorarioFixo } from '@/models/HorarioFixo';
import { Professor } from '@/models/Professor';
import mongoose from 'mongoose';

const JWT_SECRET = process.env.JWT_SECRET || 'sua_chave_secreta_super_forte';

export async function GET(request: NextRequest) {
  try {
    const auth = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!auth || !auth.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Token não fornecido' }, { status: 401 });
    }
    const token = auth.split(' ')[1];

    let payload: any;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 });
    }

    if (!payload || !payload.userId) {
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 });
    }

    // Optional: allow admins to call this too, but usually only professors should use it
    // if (payload.tipo !== 'professor') return NextResponse.json({ success: false, error: 'Acesso negado' }, { status: 403 });

    await connectDB();

    const userId = String(payload.userId);
    console.log('[/api/me/horarios] token payload:', { userId: payload.userId, email: payload.email, tipo: payload.tipo });

    // First attempt: treat payload.userId as Professor._id (most direct)
    let professorObjectId: mongoose.Types.ObjectId | null = null;
    if (mongoose.Types.ObjectId.isValid(userId)) {
      professorObjectId = new mongoose.Types.ObjectId(userId);
    }

    let query: any = { ativo: true };
    if (professorObjectId) query.professorId = professorObjectId;

    let horarios = await HorarioFixo.find(query)
      .populate({
        path: 'alunoId',
        select: 'nome email modalidadeId',
        populate: {
          path: 'modalidadeId',
          select: 'nome cor',
          options: { strictPopulate: false }
        },
        options: { strictPopulate: false }
      })
      .populate('professorId', 'nome especialidade')
      .sort({ diaSemana: 1, horarioInicio: 1 })
      .select('-__v')
      .lean();

    // If nothing found and we used userId as professor _id, try to resolve professor by email (common case when token.userId is User._id)
    if ((!horarios || horarios.length === 0) && payload.email) {
      try {
        const prof = await Professor.findOne({ email: String(payload.email).toLowerCase(), ativo: true }).select('_id nome email');
        if (prof) {
          console.log('[/api/me/horarios] resolved professor by email:', prof._id.toString());
          horarios = await HorarioFixo.find({ ativo: true, professorId: prof._id })
            .populate({
              path: 'alunoId',
              select: 'nome email modalidadeId',
              populate: {
                path: 'modalidadeId',
                select: 'nome cor',
                options: { strictPopulate: false }
              },
              options: { strictPopulate: false }
            })
            .populate('professorId', 'nome especialidade')
            .sort({ diaSemana: 1, horarioInicio: 1 })
            .select('-__v')
            .lean();
        } else {
          console.log('[/api/me/horarios] no Professor found for email:', payload.email);
        }
      } catch (err) {
        console.error('[/api/me/horarios] error resolving professor by email:', err);
      }
    }

    console.log('[/api/me/horarios] documentos encontrados:', Array.isArray(horarios) ? horarios.length : 0);
    return NextResponse.json({ success: true, data: horarios });
  } catch (error) {
    console.error('Erro em /api/me/horarios:', error);
    return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 });
  }
}
