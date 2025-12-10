import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Configuracao } from '@/models/Configuracao';

// GET - Busca o telefone do suporte para contato
export async function GET() {
  try {
    await connectDB();
    
    // Buscar configuração de WhatsApp do suporte
    const configSuporte = await Configuracao.findOne({ chave: 'whatsapp_suporte' });

    if (!configSuporte || !configSuporte.valor) {
      return NextResponse.json({
        success: false,
        error: 'Contato do suporte não disponível'
      }, { status: 404 });
    }

    // Formata o telefone para WhatsApp (remove caracteres não numéricos)
    const telefoneFormatado = String(configSuporte.valor).replace(/\D/g, '');
    
    // Adiciona código do país se não tiver
    const whatsapp = telefoneFormatado.startsWith('55') 
      ? telefoneFormatado 
      : `55${telefoneFormatado}`;

    return NextResponse.json({
      success: true,
      whatsapp,
      nome: 'Suporte'
    });
  } catch (error) {
    console.error('Erro ao buscar contato suporte:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro ao buscar contato'
    }, { status: 500 });
  }
}
