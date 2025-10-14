import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Especialidade, IEspecialidade } from '@/models/Especialidade';

// GET - Listar todas as especialidades
export async function GET() {
  try {
    await connectDB();
    
    const especialidades = await Especialidade.find({ ativo: true })
      .sort({ nome: 1 })
      .select('-__v');
    
    return NextResponse.json({
      success: true,
      data: especialidades
    });
  } catch (error) {
    console.error('Erro ao buscar especialidades:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro interno do servidor' 
      },
      { status: 500 }
    );
  }
}

// POST - Criar nova especialidade
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    
    const body = await request.json();
    const { nome, descricao } = body;

    // Validações básicas
    if (!nome) {
      return NextResponse.json(
        {
          success: false,
          error: 'Nome da especialidade é obrigatório'
        },
        { status: 400 }
      );
    }

    // Verificar se especialidade já existe
    const especialidadeExistente = await Especialidade.findOne({ 
      nome: { $regex: new RegExp(`^${nome}$`, 'i') }
    });
    
    if (especialidadeExistente) {
      return NextResponse.json(
        {
          success: false,
          error: 'Especialidade já existe'
        },
        { status: 400 }
      );
    }

    // Criar especialidade
    const novaEspecialidade = new Especialidade({
      nome,
      descricao
    });

    const especialidadeSalva = await novaEspecialidade.save();

    return NextResponse.json(
      {
        success: true,
        data: especialidadeSalva,
        message: 'Especialidade criada com sucesso'
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Erro ao criar especialidade:', error);
    
    // Erro de validação do Mongoose
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err: any) => err.message);
      return NextResponse.json(
        {
          success: false,
          error: messages.join(', ')
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