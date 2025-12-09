import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Configuracao } from '@/models/Configuracao';

// GET - Buscar configurações
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    
    const { searchParams } = new URL(req.url);
    const chave = searchParams.get('chave');
    
    if (chave) {
      const config = await Configuracao.findOne({ chave });
      return NextResponse.json({
        success: true,
        data: config || { chave, valor: false }
      });
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

// PUT - Atualizar configuração
export async function PUT(req: NextRequest) {
  try {
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
