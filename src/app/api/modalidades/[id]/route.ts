import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Modalidade } from '@/models/Modalidade';

// PUT - Atualizar modalidade
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const body = await request.json();
  const { nome, descricao, cor, duracao, preco, diasSemana, limiteAlunos, horarioFuncionamento } = body;

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

    // Verificar se já existe outra modalidade com esse nome
    const modalidadeExistente = await Modalidade.findOne({ 
      nome: { $regex: new RegExp(`^${nome}$`, 'i') }, 
      ativo: true,
      _id: { $ne: id }
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

    // Atualizar modalidade
    const modalidade = await Modalidade.findByIdAndUpdate(
      id,
      {
        nome: nome.trim(),
        descricao: descricao?.trim() || '',
        cor: cor || '#3B82F6',
        duracao: duracao || 60,
        limiteAlunos: limiteAlunos || 5,
        diasSemana: diasSemana || [],
        preco: preco || 0,
        horarioFuncionamento: {
          manha: {
            inicio: horarioFuncionamento?.manha?.inicio || null,
            fim: horarioFuncionamento?.manha?.fim || null
          },
          tarde: {
            inicio: horarioFuncionamento?.tarde?.inicio || null,
            fim: horarioFuncionamento?.tarde?.fim || null
          }
        }
      },
      { new: true }
    );

    if (!modalidade) {
      return NextResponse.json(
        {
          success: false,
          error: 'Modalidade não encontrada'
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: modalidade,
      message: 'Modalidade atualizada com sucesso'
    });
    
  } catch (error: any) {
    console.error('Erro ao atualizar modalidade:', error);
    
    if (error.code === 11000) {
      return NextResponse.json(
        {
          success: false,
          error: 'Já existe outra modalidade com este nome'
        },
        { status: 400 }
      );
    }

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

// DELETE - Desativar modalidade
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const url = new URL(request.url);
    const hard = url.searchParams.get('hard') === 'true';

    if (hard) {
      // Hard delete (remove document from collection)
      const removed = await Modalidade.findByIdAndDelete(id);
      if (!removed) {
        return NextResponse.json(
          {
            success: false,
            error: 'Modalidade não encontrada'
          },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, message: 'Modalidade apagada permanentemente', data: removed });
    }

    const modalidade = await Modalidade.findByIdAndUpdate(
      id,
      { ativo: false },
      { new: true }
    );

    if (!modalidade) {
      return NextResponse.json(
        {
          success: false,
          error: 'Modalidade não encontrada'
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Modalidade desativada com sucesso'
    });
  } catch (error) {
    console.error('Erro ao desativar modalidade:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro interno do servidor' 
      },
      { status: 500 }
    );
  }
}
