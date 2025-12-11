import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import connectDB from '@/lib/mongodb';
import UsoCredito from '@/models/UsoCredito';
import { JWT_SECRET } from '@/lib/auth';

async function isAdmin() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    
    if (!token) return false;
    
    const decoded = jwt.verify(token, JWT_SECRET) as { userId?: string; id?: string; tipo: string };
    const tipoLower = decoded.tipo?.toLowerCase() || '';
    return tipoLower === 'adm' || tipoLower === 'professor' || tipoLower === 'root' || tipoLower === 'admin';
  } catch (error) {
    return false;
  }
}

// GET - Listar usos de crédito
export async function GET(req: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    await connectDB();

    const searchParams = req.nextUrl.searchParams;
    const alunoId = searchParams.get('alunoId');
    const horarioId = searchParams.get('horarioId');
    const data = searchParams.get('data');

    const filter: any = {};

    if (alunoId) {
      filter.alunoId = alunoId;
    }

    if (horarioId) {
      filter.agendamentoId = horarioId;
    }

    if (data) {
      // Filtrar por data específica
      const startDate = new Date(data);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(data);
      endDate.setHours(23, 59, 59, 999);
      filter.dataUso = { $gte: startDate, $lte: endDate };
    }

    const usos = await UsoCredito.find(filter)
      .populate('alunoId', 'nome email')
      .populate('creditoId', 'motivo modalidadeId')
      .populate({
        path: 'agendamentoId',
        select: 'diaSemana horarioInicio horarioFim modalidadeId professorId',
        populate: [
          { path: 'modalidadeId', select: 'nome cor' },
          { path: 'professorId', model: 'User', select: 'nome cor' }
        ]
      })
      .sort({ dataUso: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      data: usos
    });
  } catch (error) {
    console.error('Erro ao buscar usos de crédito:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar usos de crédito' },
      { status: 500 }
    );
  }
}
