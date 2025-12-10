import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import connectDB from '@/lib/mongodb';
import UsoCredito from '@/models/UsoCredito';
import { JWT_SECRET } from '@/lib/auth';

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

// PUT - Atualizar uso de crédito (registrar presença)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verificarAutenticacao();
    if (!user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }
    
    await connectDB();
    
    const { id } = await params;
    const body = await req.json();
    const { compareceu } = body;
    
    if (typeof compareceu !== 'boolean') {
      return NextResponse.json(
        { error: 'Campo compareceu é obrigatório (boolean)' },
        { status: 400 }
      );
    }
    
    const uso = await UsoCredito.findByIdAndUpdate(
      id,
      { compareceu },
      { new: true }
    );
    
    if (!uso) {
      return NextResponse.json(
        { error: 'Uso de crédito não encontrado' },
        { status: 404 }
      );
    }
    
    console.log(`[API Usos Crédito] Atualizado uso ${id}: compareceu=${compareceu}`);
    
    return NextResponse.json({
      success: true,
      uso
    });
    
  } catch (error) {
    console.error('[API Usos Crédito PUT] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar uso de crédito' },
      { status: 500 }
    );
  }
}
