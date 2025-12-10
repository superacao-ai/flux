import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import connectDB from '@/lib/mongodb';
import { Aluno } from '@/models/Aluno';
import { JWT_SECRET } from '@/lib/auth';

async function getAlunoFromToken(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('alunoToken')?.value;
    
    if (!token) return null;
    
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; nome: string; tipo: string };
    
    if (decoded.tipo !== 'aluno') return null;
    
    return decoded;
  } catch {
    return null;
  }
}

// GET - Buscar dados cadastrais do aluno
export async function GET(req: NextRequest) {
  try {
    const alunoToken = await getAlunoFromToken(req);
    
    if (!alunoToken) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }
    
    await connectDB();
    
    const aluno = await Aluno.findById(alunoToken.id)
      .select('nome email telefone endereco cpf dataNascimento')
      .lean();
    
    if (!aluno) {
      return NextResponse.json(
        { success: false, error: 'Aluno não encontrado' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      dados: aluno
    });
    
  } catch (error) {
    console.error('[API Aluno Perfil GET] Erro:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar dados' },
      { status: 500 }
    );
  }
}

// PUT - Atualizar dados cadastrais do aluno
export async function PUT(req: NextRequest) {
  try {
    const alunoToken = await getAlunoFromToken(req);
    
    if (!alunoToken) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }
    
    const body = await req.json();
    const { email, telefone, endereco } = body;
    
    await connectDB();
    
    // Campos que o aluno pode alterar
    const updateData: any = {};
    
    if (email !== undefined) {
      // Validar formato do email
      if (email && !/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email)) {
        return NextResponse.json(
          { success: false, error: 'Email inválido' },
          { status: 400 }
        );
      }
      // Verificar se email já existe em outro aluno
      if (email) {
        const emailExiste = await Aluno.findOne({ 
          email, 
          _id: { $ne: alunoToken.id } 
        });
        if (emailExiste) {
          return NextResponse.json(
            { success: false, error: 'Email já está em uso' },
            { status: 400 }
          );
        }
      }
      updateData.email = email || null;
    }
    
    if (telefone !== undefined) {
      updateData.telefone = telefone || 'Não informado';
    }
    
    if (endereco !== undefined) {
      updateData.endereco = endereco || null;
    }
    
    const alunoAtualizado = await Aluno.findByIdAndUpdate(
      alunoToken.id,
      { ...updateData, atualizadoEm: new Date() },
      { new: true, runValidators: true }
    ).select('nome email telefone endereco');
    
    if (!alunoAtualizado) {
      return NextResponse.json(
        { success: false, error: 'Aluno não encontrado' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      dados: alunoAtualizado,
      message: 'Dados atualizados com sucesso'
    });
    
  } catch (error: any) {
    console.error('[API Aluno Perfil PUT] Erro:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err: any) => err.message);
      return NextResponse.json(
        { success: false, error: messages.join(', ') },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: 'Erro ao atualizar dados' },
      { status: 500 }
    );
  }
}
