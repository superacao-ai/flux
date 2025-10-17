import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Especialidade } from '@/models/Especialidade';
import mongoose from 'mongoose';

// GET - Buscar especialidade por ID
export async function GET(
  request: NextRequest,
  context: any
) {
  try {
    await connectDB();
    const params = context?.params || {};
    
    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      return NextResponse.json(
        { success: false, error: 'ID inválido' },
        { status: 400 }
      );
    }

    const especialidade = await Especialidade.findById(params.id).select('-__v');
    
    if (!especialidade) {
      return NextResponse.json(
        { success: false, error: 'Especialidade não encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: especialidade
    });
  } catch (error) {
    console.error('Erro ao buscar especialidade:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// PUT - Atualizar especialidade
export async function PUT(
  request: NextRequest,
  context: any
) {
  try {
    await connectDB();
    const params = context?.params || {};
    
    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      return NextResponse.json(
        { success: false, error: 'ID inválido' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { nome, descricao, ativo } = body;

    // Validações básicas
    if (!nome) {
      return NextResponse.json(
        { success: false, error: 'Nome é obrigatório' },
        { status: 400 }
      );
    }

    // Verificar se nome já existe (exceto para a própria especialidade)
    const especialidadeExistente = await Especialidade.findOne({ 
      nome: { $regex: new RegExp(`^${nome}$`, 'i') }, 
      _id: { $ne: params.id } 
    });
    
    if (especialidadeExistente) {
      return NextResponse.json(
        { success: false, error: 'Especialidade com este nome já existe' },
        { status: 400 }
      );
    }

    // Atualizar especialidade
    const especialidadeAtualizada = await Especialidade.findByIdAndUpdate(
      params.id,
      {
        nome,
        descricao,
        ativo: ativo !== undefined ? ativo : true,
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    ).select('-__v');

    if (!especialidadeAtualizada) {
      return NextResponse.json(
        { success: false, error: 'Especialidade não encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: especialidadeAtualizada,
      message: 'Especialidade atualizada com sucesso'
    });
  } catch (error: any) {
    console.error('Erro ao atualizar especialidade:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err: any) => err.message);
      return NextResponse.json(
        { success: false, error: messages.join(', ') },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// DELETE - Excluir especialidade
export async function DELETE(
  request: NextRequest,
  context: any
) {
  try {
    await connectDB();
    const params = context?.params || {};
    
    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      return NextResponse.json(
        { success: false, error: 'ID inválido' },
        { status: 400 }
      );
    }

    const especialidadeExcluida = await Especialidade.findByIdAndDelete(params.id);

    if (!especialidadeExcluida) {
      return NextResponse.json(
        { success: false, error: 'Especialidade não encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Especialidade excluída com sucesso'
    });
  } catch (error) {
    console.error('Erro ao excluir especialidade:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}