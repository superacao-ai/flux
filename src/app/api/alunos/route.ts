import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Aluno, IAluno } from '@/models/Aluno';

// GET - Listar todos os alunos
export async function GET() {
  try {
    await connectDB();
    
    const alunos = await Aluno.find({ ativo: true })
      .populate('modalidadeId', 'nome cor')
      .sort({ nome: 1 })
      .select('-__v');
    
    return NextResponse.json({
      success: true,
      data: alunos
    });
  } catch (error) {
    console.error('Erro ao buscar alunos:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro interno do servidor' 
      },
      { status: 500 }
    );
  }
}

// POST - Criar novo aluno
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    
    const body = await request.json();
    const { nome, email, telefone, endereco, modalidadeId, observacoes } = body;

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

    // Normalize name: trim and convert to uppercase for consistency
    const nomeNormalizado = String(nome).trim().toUpperCase();

    // Validar modalidadeId se fornecido
    if (modalidadeId && !modalidadeId.match(/^[0-9a-fA-F]{24}$/)) {
      return NextResponse.json(
        {
          success: false,
          error: 'ID da modalidade inválido'
        },
        { status: 400 }
      );
    }

    // Verificar se email já existe (apenas se email foi fornecido)
    if (email && email.trim()) {
      const alunoExistente = await Aluno.findOne({ email });
      if (alunoExistente) {
        return NextResponse.json(
          {
            success: false,
            error: 'Email já está em uso'
          },
          { status: 400 }
        );
      }
    }

    // Criar dados do aluno
    const dadosAluno: any = {
      nome: nomeNormalizado,
      telefone: telefone && telefone.trim() ? telefone : 'Não informado',
      endereco,
      modalidadeId,
      observacoes
    };

    // Adicionar email apenas se fornecido
    if (email && email.trim()) {
      dadosAluno.email = email;
    }

    // Criar aluno
    const novoAluno = new Aluno(dadosAluno);

    const alunoSalvo = await novoAluno.save();

    return NextResponse.json(
      {
        success: true,
        data: alunoSalvo,
        message: 'Aluno criado com sucesso'
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Erro ao criar aluno:', error);
    
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