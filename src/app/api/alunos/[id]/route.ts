import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Aluno } from '@/models/Aluno';
import { HorarioFixo } from '@/models/HorarioFixo';
import { Matricula } from '@/models/Matricula';
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

    // Validar e verificar CPF se fornecido
    if (body.cpf) {
      const cpfLimpo = String(body.cpf).replace(/\D/g, '');
      if (cpfLimpo && cpfLimpo.length !== 11) {
        return NextResponse.json(
          {
            success: false,
            error: 'CPF deve ter 11 dígitos'
          },
          { status: 400 }
        );
      }
      // Verificar se CPF já existe em outro aluno
      if (cpfLimpo) {
        const alunoComCpf = await Aluno.findOne({ 
          cpf: cpfLimpo, 
          _id: { $ne: id } 
        });
        if (alunoComCpf) {
          return NextResponse.json(
            {
              success: false,
              error: 'CPF já está em uso por outro aluno'
            },
            { status: 400 }
          );
        }
        // Atualizar o CPF limpo no body
        body.cpf = cpfLimpo;
      }
    }

    // Converter dataNascimento se fornecida
    if (body.dataNascimento && typeof body.dataNascimento === 'string') {
      body.dataNascimento = new Date(body.dataNascimento);
    }

    console.log(`[PUT /api/alunos/${id}] Body recebido:`, body);
    console.log(`[PUT /api/alunos/${id}] CPF no body:`, body.cpf, typeof body.cpf);
    console.log(`[PUT /api/alunos/${id}] dataNascimento no body:`, body.dataNascimento, typeof body.dataNascimento);

    // If attempting to unfreeze (congelado: false), check for substitutes
    // If client provides forceUnfreeze=true, skip the substitute check (admin override)
    if (Object.prototype.hasOwnProperty.call(body, 'congelado') && body.congelado === false && !body.forceUnfreeze) {
      try {
        // Find active matriculas for this aluno
        const alunoObjectId = mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null;
        if (alunoObjectId) {
          const matriculas = await Matricula.find({ alunoId: alunoObjectId, ativo: true }).lean();
          const substitutes: any[] = [];

          for (const m of matriculas) {
            const sub = await Matricula.findOne({ replacesMatriculaId: m._id, ativo: true }).lean();
            if (sub) {
              substitutes.push(sub);
            }
          }

          if (substitutes.length > 0) {
            // Return conflict with substitute info; UI should prompt admin for resolution
            return NextResponse.json({ success: false, error: 'substitute_exists', substitutes }, { status: 409 });
          }
        }
      } catch (e) {
        console.error('Erro ao verificar substitutos antes de descongelar:', e);
        // fallthrough to attempt update (but safer to fail)
        return NextResponse.json({ success: false, error: 'Erro ao verificar substitutos' }, { status: 500 });
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

    console.log(`[PUT /api/alunos/${id}] Aluno atualizado:`, {
      cpf: alunoAtualizado.cpf,
      dataNascimento: alunoAtualizado.dataNascimento,
      congelado: alunoAtualizado.congelado,
      ausente: alunoAtualizado.ausente,
      emEspera: alunoAtualizado.emEspera
    });

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

// DELETE - Deletar aluno (soft delete ou permanente)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const permanent = searchParams.get('permanent') === 'true';

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

    // Se permanent=true, fazer exclusão permanente do banco
    if (permanent) {
      const aluno = await Aluno.findByIdAndDelete(id);

      if (!aluno) {
        return NextResponse.json(
          {
            success: false,
            error: 'Aluno não encontrado'
          },
          { status: 404 }
        );
      }

      // Também remover matriculas e limpar horários
      try {
        const alunoObjectId = mongoose.Types.ObjectId.isValid(String(id)) ? new mongoose.Types.ObjectId(String(id)) : null;
        if (alunoObjectId) {
          // Deletar matriculas permanentemente
          await Matricula.deleteMany({ alunoId: alunoObjectId });
          
          // Limpar referências em horários
          await HorarioFixo.updateMany(
            { alunoId: alunoObjectId },
            { $unset: { alunoId: '' } }
          );
        }
      } catch (e) {
        console.warn('Erro ao limpar registros relacionados:', e);
      }

      return NextResponse.json({
        success: true,
        message: 'Aluno excluído permanentemente'
      });
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

    // Also remove the aluno from related records:
    // - soft-delete Matricula documents where alunoId == id (set ativo=false)
    // - clean backward-compat HorarioFixo.alunoId fields (unset)
    try {
      const alunoObjectId = mongoose.Types.ObjectId.isValid(String(id)) ? new mongoose.Types.ObjectId(String(id)) : null;
      let matriculasModified = 0;
      let horariosUpdated = 0;

      if (alunoObjectId) {
        // Try to run in a transaction if the server supports it
        const session = await mongoose.startSession();
        let usedTransaction = false;

        try {
          session.startTransaction();
          usedTransaction = true;

          const mRes = await Matricula.updateMany(
            { alunoId: alunoObjectId, ativo: true },
            { $set: { ativo: false } },
            { session }
          );
          matriculasModified = (mRes as any).modifiedCount ?? (mRes as any).nModified ?? 0;

          const hRes = await HorarioFixo.updateMany(
            { alunoId: alunoObjectId },
            { $unset: { alunoId: '' } },
            { session }
          );
          horariosUpdated = (hRes as any).modifiedCount ?? (hRes as any).nModified ?? 0;

          await session.commitTransaction();
        } catch (txErr) {
          // If transactions are not supported or fail, abort and fallback to non-transactional updates
          try {
            if (usedTransaction) await session.abortTransaction();
          } catch (abortErr) {
            console.warn('Erro ao abortar transação:', abortErr);
          }
          // Fallback: perform updates without transaction
          const mRes = await Matricula.updateMany({ alunoId: alunoObjectId, ativo: true }, { $set: { ativo: false } });
          matriculasModified = (mRes as any).modifiedCount ?? (mRes as any).nModified ?? 0;

          const hRes = await HorarioFixo.updateMany({ alunoId: alunoObjectId }, { $unset: { alunoId: '' } });
          horariosUpdated = (hRes as any).modifiedCount ?? (hRes as any).nModified ?? 0;
        } finally {
          try {
            session.endSession();
          } catch (e) {
            // ignore
          }
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Aluno desativado com sucesso',
        removedMatriculas: matriculasModified,
        horariosUpdated: horariosUpdated
      });
    } catch (e) {
      console.warn('Falha ao remover matriculas/limpar horários do aluno:', e);
      return NextResponse.json({ success: true, message: 'Aluno desativado, mas ocorreu erro ao limpar registros relacionados' });
    }
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