import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { Professor } from '@/models/Professor';
import { User } from '@/models/User';

export async function POST(request: NextRequest, context: any) {
  try {
    await connectDB();
    const params = context?.params || {};
    const { id } = params;
    if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 });

    const body = await request.json();
    const senha = String(body && body.senha || '').trim();
    if (!senha || senha.length < 6) return NextResponse.json({ success: false, error: 'Senha inválida (mínimo 6 caracteres)' }, { status: 400 });

    const professor = await Professor.findById(id);
    if (!professor) return NextResponse.json({ success: false, error: 'Professor não encontrado' }, { status: 404 });

    if (!professor.email || String(professor.email).trim() === '') {
      return NextResponse.json({ success: false, error: 'Professor não possui email — adicione um email antes de criar a senha' }, { status: 400 });
    }

    const email = String(professor.email).toLowerCase().trim();
    const hashed = await bcrypt.hash(senha, 10);

    // Try to find existing user with same email
    let user = await User.findOne({ email });
    if (user) {
      // If user exists but has different tipo, avoid overwriting
      if (user.tipo && user.tipo !== 'professor') {
        return NextResponse.json({ success: false, error: 'Já existe um usuário com esse email com tipo diferente' }, { status: 400 });
      }
      user.senha = hashed;
      user.nome = professor.nome || user.nome;
      user.ativo = true;
      await user.save();
    } else {
      // Create new User record for this professor
      user = new User({ nome: professor.nome || '', email, senha: hashed, tipo: 'professor', ativo: true });
      await user.save();
    }

    return NextResponse.json({ success: true, message: 'Senha configurada com sucesso' });
  } catch (error) {
    console.error('Erro ao setar senha do professor:', error);
    return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 });
  }
}
