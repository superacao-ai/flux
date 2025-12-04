import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Aviso } from '@/models/Aviso';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

const JWT_SECRET = process.env.JWT_SECRET || 'secret-key-super-segura-2024';

async function getAdminFromToken() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    
    if (!token) return null;
    
    const decoded = jwt.verify(token, JWT_SECRET) as { id?: string; userId?: string; nome: string; tipo: string };
    
    // Aceitar admin ou root
    if (decoded.tipo !== 'admin' && decoded.tipo !== 'root') return null;
    
    return {
      ...decoded,
      id: decoded.id || decoded.userId
    };
  } catch {
    return null;
  }
}

// GET - Buscar aviso por ID
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json(
        { success: false, error: 'ID inválido' },
        { status: 400 }
      );
    }
    
    await connectDB();
    
    const aviso = await Aviso.findById(id)
      .populate('modalidadesAfetadas', 'nome cor')
      .populate('criadoPor', 'nome')
      .lean();
    
    if (!aviso) {
      return NextResponse.json(
        { success: false, error: 'Aviso não encontrado' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      aviso
    });
    
  } catch (error) {
    console.error('[API Avisos GET ID] Erro:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar aviso' },
      { status: 500 }
    );
  }
}

// PUT - Atualizar aviso
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminFromToken();
    
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }
    
    const { id } = await params;
    
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json(
        { success: false, error: 'ID inválido' },
        { status: 400 }
      );
    }
    
    const body = await req.json();
    
    await connectDB();
    
    const avisoAtualizado = await Aviso.findByIdAndUpdate(
      id,
      { ...body, atualizadoEm: new Date() },
      { new: true, runValidators: true }
    );
    
    if (!avisoAtualizado) {
      return NextResponse.json(
        { success: false, error: 'Aviso não encontrado' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      aviso: avisoAtualizado,
      message: 'Aviso atualizado com sucesso'
    });
    
  } catch (error: any) {
    console.error('[API Avisos PUT] Erro:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err: any) => err.message);
      return NextResponse.json(
        { success: false, error: messages.join(', ') },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: 'Erro ao atualizar aviso' },
      { status: 500 }
    );
  }
}

// DELETE - Deletar aviso
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminFromToken();
    
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }
    
    const { id } = await params;
    
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json(
        { success: false, error: 'ID inválido' },
        { status: 400 }
      );
    }
    
    await connectDB();
    
    const avisoRemovido = await Aviso.findByIdAndDelete(id);
    
    if (!avisoRemovido) {
      return NextResponse.json(
        { success: false, error: 'Aviso não encontrado' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Aviso removido com sucesso'
    });
    
  } catch (error) {
    console.error('[API Avisos DELETE] Erro:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao remover aviso' },
      { status: 500 }
    );
  }
}
