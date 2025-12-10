import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import connectDB from '@/lib/mongodb';
import { Configuracao } from '@/models/Configuracao';
import { JWT_SECRET } from '@/lib/auth';

// Verifica se é admin autenticado
async function isAdmin(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    
    if (!token) return false;
    
    const decoded = jwt.verify(token, JWT_SECRET) as { tipo?: string };
    const tipoLower = (decoded.tipo || '').toLowerCase();
    
    return tipoLower === 'admin' || tipoLower === 'root' || tipoLower === 'adm';
  } catch {
    return false;
  }
}

// GET - Buscar configurações (público para algumas chaves, protegido para outras)
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    
    const { searchParams } = new URL(req.url);
    const chave = searchParams.get('chave');
    
    // Chaves públicas que não precisam de autenticação
    const chavesPublicas = ['mensagens_descanso', 'whatsapp_admin'];
    
    if (chave) {
      // Se não for chave pública, verificar autenticação
      if (!chavesPublicas.includes(chave)) {
        const admin = await isAdmin();
        if (!admin) {
          return NextResponse.json(
            { success: false, error: 'Não autorizado' },
            { status: 401 }
          );
        }
      }
      
      const config = await Configuracao.findOne({ chave });
      return NextResponse.json({
        success: true,
        data: config || { chave, valor: null }
      });
    }
    
    // Listar todas requer autenticação
    const admin = await isAdmin();
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }
    
    const configs = await Configuracao.find();
    return NextResponse.json({
      success: true,
      data: configs
    });
  } catch (error) {
    console.error('Erro ao buscar configurações:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar configurações' },
      { status: 500 }
    );
  }
}

// PUT - Atualizar configuração (protegido - apenas admin)
export async function PUT(req: NextRequest) {
  try {
    // Verificar autenticação
    const admin = await isAdmin();
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }
    
    await connectDB();
    
    const body = await req.json();
    const { chave, valor } = body;
    
    if (!chave) {
      return NextResponse.json(
        { success: false, error: 'Chave é obrigatória' },
        { status: 400 }
      );
    }
    
    const config = await Configuracao.findOneAndUpdate(
      { chave },
      { valor, atualizadoEm: new Date() },
      { upsert: true, new: true }
    );
    
    return NextResponse.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('Erro ao atualizar configuração:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao atualizar configuração' },
      { status: 500 }
    );
  }
}
