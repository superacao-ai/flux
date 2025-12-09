import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import connectDB from '@/lib/mongodb';
import UsoCredito from '@/models/UsoCredito';

const JWT_SECRET = process.env.JWT_SECRET || 'sua_chave_secreta_super_forte';

async function verificarAutenticacao() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    
    if (!token) return null;
    
    const decoded = jwt.verify(token, JWT_SECRET) as { userId?: string; id?: string; tipo: string };
    return decoded;
  } catch {
    return null;
  }
}

// GET - Buscar usos de crédito por data (para MinhaAgenda)
export async function GET(req: NextRequest) {
  try {
    const user = await verificarAutenticacao();
    if (!user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }
    
    await connectDB();
    
    const { searchParams } = new URL(req.url);
    const data = searchParams.get('data'); // YYYY-MM-DD
    
    if (!data) {
      return NextResponse.json(
        { error: 'Data é obrigatória' },
        { status: 400 }
      );
    }
    
    // Buscar usos de crédito para a data específica
    const dataInicio = new Date(data + 'T00:00:00.000Z');
    const dataFim = new Date(data + 'T23:59:59.999Z');
    
    const usos = await UsoCredito.find({
      dataUso: { $gte: dataInicio, $lte: dataFim }
    })
    .populate({
      path: 'alunoId',
      select: 'nome email telefone'
    })
    .lean();
    
    console.log(`[API Usos Crédito] Data: ${data}, Encontrados: ${usos.length}`);
    
    return NextResponse.json(usos);
    
  } catch (error) {
    console.error('[API Usos Crédito GET] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar usos de crédito' },
      { status: 500 }
    );
  }
}
