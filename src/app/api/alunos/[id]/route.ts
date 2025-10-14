import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Aluno } from '@/models/Aluno';
import mongoose from 'mongoose';

// GET - Buscar aluno por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    
    const { id } = await params;

    // Validar ObjectId
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json(
        {
          success: false,
          error: 'ID inválido'
        },
        { status: 400 }
      );
    }

    const aluno = await Aluno.findById(id).select('-__v');
    
    if (!aluno) {
      return NextResponse.json(
        {
          success: false,
          error: 'Aluno não encontrado'
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: aluno
    });
  } catch (error) {
    console.error('Erro ao buscar aluno:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erro interno do servidor'
      },
      { status: 500 }
    );
  }
}

// PUT - Atualizar aluno
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    
    const { id } = await params;
    const body = await request.json();

    // Validar ObjectId
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json(
        {
          success: false,
          error: 'ID inválido'
        },
        { status: 400 }
      );
    }

    // Verificar se email já existe em outro aluno (apenas se email foi fornecido)
    if (body.email && body.email.trim()) {
      const alunoExistente = await Aluno.findOne({ 
        email: body.email, 
        _id: { $ne: id } 
      });
      
      if (alunoExistente) {
        return NextResponse.json(
          {
            success: false,
            error: 'Email já está em uso por outro aluno'
          },
          { status: 400 }
        );
      }
    }

    const alunoAtualizado = await Aluno.findByIdAndUpdate(
      id,
      { ...body, atualizadoEm: new Date() },
      { 
        new: true, 
        runValidators: true,
        select: '-__v'
      }
    );

    if (!alunoAtualizado) {
      return NextResponse.json(
        {
          success: false,
          error: 'Aluno não encontrado'
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: alunoAtualizado,
      message: 'Aluno atualizado com sucesso'
    });
  } catch (error: any) {
    console.error('Erro ao atualizar aluno:', error);
    
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

// DELETE - Deletar aluno (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    
    const { id } = await params;

    // Validar ObjectId
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json(
        {
          success: false,
          error: 'ID inválido'
        },
        { status: 400 }
      );
    }

    // Soft delete - apenas marca como inativo
    const aluno = await Aluno.findByIdAndUpdate(
      id,
      { 
        ativo: false,
        atualizadoEm: new Date()
      },
      { 
        new: true,
        select: '-__v'
      }
    );

    if (!aluno) {
      return NextResponse.json(
        {
          success: false,
          error: 'Aluno não encontrado'
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Aluno desativado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao deletar aluno:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erro interno do servidor'
      },
      { status: 500 }
    );
  }
}