import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Professor } from '@/models/Professor';
import { Especialidade } from '@/models/Especialidade';
import mongoose from 'mongoose';

// GET - Buscar professor por ID
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

    const professor = await Professor.findById(params.id)
      .populate('especialidades', 'nome')
      .select('-__v');
    
    if (!professor) {
      return NextResponse.json(
        { success: false, error: 'Professor não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: professor
    });
  } catch (error) {
    console.error('Erro ao buscar professor:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// PUT - Atualizar professor
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
    const { nome, email, telefone, especialidades, ativo } = body;

    // Validações básicas
    if (!nome) {
      return NextResponse.json(
        { success: false, error: 'Nome é obrigatório' },
        { status: 400 }
      );
    }

    // Verificar se email já existe (apenas se email foi fornecido e exceto para o próprio professor)
    if (email && email.trim()) {
      const professorExistente = await Professor.findOne({ 
        email, 
        _id: { $ne: params.id } 
      });
      
      if (professorExistente) {
        return NextResponse.json(
          { success: false, error: 'Email já está em uso por outro professor' },
          { status: 400 }
        );
      }
    }

    // Preparar dados para atualização
    const dadosAtualizacao: any = {
      nome,
      especialidades: especialidades || [],
      ativo: ativo !== undefined ? ativo : true,
      updatedAt: new Date()
    };

    // Adicionar email apenas se fornecido
    if (email && email.trim()) {
      dadosAtualizacao.email = email;
    } else {
      dadosAtualizacao.$unset = { email: 1 }; // Remove o campo se vazio
    }

    // Adicionar telefone apenas se fornecido
    if (telefone && telefone.trim()) {
      dadosAtualizacao.telefone = telefone;
    } else {
      dadosAtualizacao.$unset = { ...dadosAtualizacao.$unset, telefone: 1 }; // Remove o campo se vazio
    }

    // Atualizar professor
    const professorAtualizado = await Professor.findByIdAndUpdate(
      params.id,
      dadosAtualizacao,
      { new: true, runValidators: true }
    )
    .populate('especialidades', 'nome')
    .select('-__v');

    if (!professorAtualizado) {
      return NextResponse.json(
        { success: false, error: 'Professor não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: professorAtualizado,
      message: 'Professor atualizado com sucesso'
    });
  } catch (error: any) {
    console.error('Erro ao atualizar professor:', error);
    
    // Erro de validação do Mongoose
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

// DELETE - Excluir professor
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

    // Verificar se o professor existe
    const professor = await Professor.findById(params.id);
    if (!professor) {
      return NextResponse.json(
        { success: false, error: 'Professor não encontrado' },
        { status: 404 }
      );
    }

    // TODO: Verificar se o professor possui horários ou alunos associados
    // Por enquanto, permitir exclusão direta

    // Excluir professor
    await Professor.findByIdAndDelete(params.id);

    return NextResponse.json({
      success: true,
      message: 'Professor excluído com sucesso'
    });
  } catch (error) {
    console.error('Erro ao excluir professor:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}