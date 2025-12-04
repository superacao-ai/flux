import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Aviso } from '@/models/Aviso';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

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
      id: decoded.id || decoded.userId // Compatibilidade com diferentes formatos de token
    };
  } catch {
    return null;
  }
}

// GET - Listar todos os avisos
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    
    const { searchParams } = new URL(req.url);
    const apenasAtivos = searchParams.get('ativos') === 'true';
    
    const filtro: any = {};
    if (apenasAtivos) {
      filtro.ativo = true;
      filtro.dataFim = { $gte: new Date() };
    }
    
    const avisos = await Aviso.find(filtro)
      .populate('modalidadesAfetadas', 'nome cor')
      .populate('criadoPor', 'nome')
      .sort({ criadoEm: -1 })
      .lean();
    
    return NextResponse.json({
      success: true,
      avisos
    });
    
  } catch (error) {
    console.error('[API Avisos GET] Erro:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar avisos' },
      { status: 500 }
    );
  }
}

// POST - Criar novo aviso
export async function POST(req: NextRequest) {
  try {
    const admin = await getAdminFromToken();
    
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }
    
    const body = await req.json();
    const { titulo, mensagem, tipo, dataInicio, dataFim, modalidadesAfetadas } = body;
    
    if (!titulo || !mensagem || !dataInicio || !dataFim) {
      return NextResponse.json(
        { success: false, error: 'Campos obrigatórios: titulo, mensagem, dataInicio, dataFim' },
        { status: 400 }
      );
    }
    
    await connectDB();
    
    const novoAviso = await Aviso.create({
      titulo,
      mensagem,
      tipo: tipo || 'info',
      dataInicio: new Date(dataInicio),
      dataFim: new Date(dataFim),
      modalidadesAfetadas: modalidadesAfetadas || [],
      criadoPor: admin.id,
      ativo: true
    });
    
    return NextResponse.json({
      success: true,
      aviso: novoAviso,
      message: 'Aviso criado com sucesso'
    }, { status: 201 });
    
  } catch (error: any) {
    console.error('[API Avisos POST] Erro:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err: any) => err.message);
      return NextResponse.json(
        { success: false, error: messages.join(', ') },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: 'Erro ao criar aviso' },
      { status: 500 }
    );
  }
}
