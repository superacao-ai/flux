import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import connectDB from '@/lib/mongodb';
import { HorarioFixo } from '@/models/HorarioFixo';
import { Professor } from '@/models/Professor';
import { Matricula } from '@/models/Matricula';
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
        select: 'nome email modalidadeId periodoTreino parceria observacoes',
        populate: {
          path: 'modalidadeId',
          select: 'nome cor linkWhatsapp',
          options: { strictPopulate: false }
        },
        options: { strictPopulate: false }
      })
      .populate('professorId', 'nome especialidade')
      .populate('modalidadeId', 'nome cor linkWhatsapp') // Adicionar populate da modalidade do horário
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
              select: 'nome email modalidadeId periodoTreino parceria observacoes',
              populate: {
                path: 'modalidadeId',
                select: 'nome cor linkWhatsapp',
                options: { strictPopulate: false }
              },
              options: { strictPopulate: false }
            })
            .populate('professorId', 'nome especialidade')
            .populate('modalidadeId', 'nome cor linkWhatsapp') // Adicionar populate da modalidade do horário
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
    
    // Buscar matrículas para adicionar os alunos aos horários
    if (horarios && horarios.length > 0) {
      const horarioIds = horarios.map(h => h._id);
      const matriculas = await Matricula.find({ 
        horarioFixoId: { $in: horarioIds },
        ativo: true 
      })
        .populate({
          path: 'alunoId',
          select: 'nome email telefone modalidadeId congelado ausente emEspera observacoes periodoTreino parceria',
          populate: {
            path: 'modalidadeId',
            select: 'nome cor linkWhatsapp'
          }
        })
        .lean();
      
      console.log('[/api/me/horarios] matrículas encontradas:', matriculas.length);
      
      // Agrupar matrículas por horarioFixoId
      const matriculasPorHorario = new Map();
      matriculas.forEach(m => {
        const horarioId = String(m.horarioFixoId);
        if (!matriculasPorHorario.has(horarioId)) {
          matriculasPorHorario.set(horarioId, []);
        }
        matriculasPorHorario.get(horarioId).push(m.alunoId);
      });
      
      // Adicionar alunos aos horários
      horarios = horarios.map(h => {
        const horarioId = String(h._id);
        const alunosMatriculados = matriculasPorHorario.get(horarioId) || [];
        
        return {
          ...h,
          alunos: alunosMatriculados
        };
      });
    }
    
    return NextResponse.json({ success: true, data: horarios });
  } catch (error) {
    console.error('Erro em /api/me/horarios:', error);
    return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 });
  }
}
