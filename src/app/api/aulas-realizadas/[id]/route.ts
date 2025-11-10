import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import AulaRealizada from '@/models/AulaRealizada';

// PUT - Atualizar aula realizada
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();
    
    const { id } = params;
    const body = await request.json();

    // Validar ID
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return NextResponse.json(
        { success: false, error: 'ID inválido' },
        { status: 400 }
      );
    }

    // Buscar aula existente
    const aulaExistente = await AulaRealizada.findById(id);
    if (!aulaExistente) {
      return NextResponse.json(
        { success: false, error: 'Aula não encontrada' },
        { status: 404 }
      );
    }

    // Atualizar campos permitidos
    const camposPermitidos = ['alunos', 'total_presentes', 'total_faltas', 'status'];
    const dadosAtualizacao: any = {};
    
    camposPermitidos.forEach(campo => {
      if (body[campo] !== undefined) {
        dadosAtualizacao[campo] = body[campo];
      }
    });

    // Atualizar aula
    const aulaAtualizada = await AulaRealizada.findByIdAndUpdate(
      id,
      { $set: dadosAtualizacao },
      { new: true, runValidators: true }
    );

    return NextResponse.json({
      success: true,
      data: aulaAtualizada,
      message: 'Aula atualizada com sucesso'
    });

  } catch (error: any) {
    console.error('Erro ao atualizar aula:', error);
    
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

// DELETE - Excluir aula realizada
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();
    
    const { id } = params;

    // Validar ID
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return NextResponse.json(
        { success: false, error: 'ID inválido' },
        { status: 400 }
      );
    }

    // Buscar e excluir aula
    const aulaExcluida = await AulaRealizada.findByIdAndDelete(id);

    if (!aulaExcluida) {
      return NextResponse.json(
        { success: false, error: 'Aula não encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Aula excluída com sucesso'
    });

  } catch (error) {
    console.error('Erro ao excluir aula:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
