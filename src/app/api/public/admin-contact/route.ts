import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { User } from '@/models/User';

// GET - Busca o telefone do usuário root/admin para contato
export async function GET() {
  try {
    await connectDB();
    
    // Primeiro tenta buscar usuário root
    let admin = await User.findOne({ 
      tipo: 'root',
      ativo: true 
    }).select('telefone nome');

    // Se não encontrar root, busca admin
    if (!admin) {
      admin = await User.findOne({ 
        tipo: 'admin',
        ativo: true 
      }).select('telefone nome');
    }

    if (!admin || !admin.telefone) {
      return NextResponse.json({
        success: false,
        error: 'Contato do administrador não disponível'
      }, { status: 404 });
    }

    // Formata o telefone para WhatsApp (remove caracteres não numéricos)
    const telefoneFormatado = admin.telefone.replace(/\D/g, '');
    
    // Adiciona código do país se não tiver
    const whatsapp = telefoneFormatado.startsWith('55') 
      ? telefoneFormatado 
      : `55${telefoneFormatado}`;

    return NextResponse.json({
      success: true,
      whatsapp,
      nome: admin.nome
    });
  } catch (error) {
    console.error('Erro ao buscar contato admin:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro ao buscar contato'
    }, { status: 500 });
  }
}
