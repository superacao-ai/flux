import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Professor, IProfessor } from '@/models/Professor';

// GET - Listar todos os professores
export async function GET() {
  try {
    await connectDB();
    // Garantir que o modelo Especialidade esteja registrado antes de usar populate
    try {
      await import('@/models/Especialidade');
    } catch (err) {
      console.warn('Aviso: falha ao importar Especialidade dinamicamente:', err);
    }
    
    const professores = await Professor.find({})
      .populate('especialidades', 'nome')
      .sort({ nome: 1 })
      .select('-__v');
    
    return NextResponse.json({
      success: true,
      data: professores
    });
  } catch (error) {
    console.error('Erro ao buscar professores:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro interno do servidor' 
      },
      { status: 500 }
    );
  }
}

// POST - Criar novo professor
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    
    const body = await request.json();
    const { nome, email, telefone, especialidades } = body;

    console.log('📨 Dados recebidos na API:', { nome, email, telefone, especialidades });

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

    // Verificar se email já existe (apenas se email foi fornecido)
    if (email && email.trim()) {
      const professorExistente = await Professor.findOne({ email });
      if (professorExistente) {
        return NextResponse.json(
          {
            success: false,
            error: 'Email já está em uso'
          },
          { status: 400 }
        );
      }
    }

    // Criar professor
    const dadosProfessor: any = {
      nome,
      especialidades: especialidades || []
    };

    // Adicionar email apenas se fornecido
    if (email && email.trim()) {
      dadosProfessor.email = email;
    }

    // Adicionar telefone apenas se fornecido
    if (telefone && telefone.trim()) {
      dadosProfessor.telefone = telefone;
    }

    const novoProfessor = new Professor(dadosProfessor);

    const professorSalvo = await novoProfessor.save();

    return NextResponse.json(
      {
        success: true,
        data: professorSalvo,
        message: 'Professor criado com sucesso'
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Erro ao criar professor:', error);
    
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