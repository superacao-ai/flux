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

// GET - Listar histórico de uso de créditos
export async function GET(req: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    await connectDB();

    const searchParams = req.nextUrl.searchParams;
    const alunoId = searchParams.get('alunoId');
    const creditoId = searchParams.get('creditoId');

    const filter: any = {};
    if (alunoId) filter.alunoId = alunoId;
    if (creditoId) filter.creditoId = creditoId;

    const usos = await UsoCredito.find(filter)
      .populate('alunoId', 'nome email')
      .populate('creditoId')
      .sort({ dataUso: -1 })
      .lean();

    return NextResponse.json(usos);
  } catch (error) {
    console.error('Erro ao buscar histórico:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar histórico' },
      { status: 500 }
    );
  }
}
