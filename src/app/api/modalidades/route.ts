import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Modalidade } from '@/models/Modalidade';

// GET - Listar todas as modalidades
export async function GET() {
  try {
    await connectDB();
    
    const modalidades = await Modalidade.find({ ativo: true })
      .sort({ nome: 1 })
      .select('-__v');
    
    return NextResponse.json({
      success: true,
      data: modalidades
    });
  } catch (error) {
    console.error('Erro ao buscar modalidades:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro interno do servidor' 
      },
      { status: 500 }
    );
  }
}

// POST - Criar nova modalidade
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    
    const body = await request.json();
    const { nome, descricao, cor, duracao, limiteAlunos } = body;

    // Validações básicas
    if (!nome) {
      return NextResponse.json(
        {
          success: false,
          error: 'Nome é obrigatório'
        },
        { status: 400 }
      );
    }

    // Verificar se já existe modalidade com esse nome
    const modalidadeExistente = await Modalidade.findOne({ 
      nome: { $regex: new RegExp(`^${nome}$`, 'i') }, 
      ativo: true 
    });
    
    if (modalidadeExistente) {
      return NextResponse.json(
        {
          success: false,
          error: 'Já existe uma modalidade com este nome'
        },
        { status: 400 }
      );
    }

    // Criar nova modalidade
    const novaModalidade = new Modalidade({
      nome: nome.trim(),
      descricao: descricao?.trim() || '',
      cor: cor || '#3B82F6',
      duracao: duracao || 60,
      limiteAlunos: limiteAlunos || 5
    });

    await novaModalidade.save();

    return NextResponse.json({
      success: true,
      data: novaModalidade,
      message: 'Modalidade criada com sucesso'
    }, { status: 201 });
    
  } catch (error: any) {
    console.error('Erro ao criar modalidade:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err: any) => err.message);
      return NextResponse.json(
        {
          success: false,
          error: 'Dados inválidos',
          details: errors
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro interno do servidor' 
      },
      { status: 500 }
    );
  }
}