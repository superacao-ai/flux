import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '@/models/User';

export async function POST(request: NextRequest, context: any) {
  try {
    await connectDB();
    const params = await Promise.resolve(context?.params || {});
    const { id } = params;
    if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 });

    const body = await request.json();
    const senha = String(body && body.senha || '').trim();
    if (!senha || senha.length < 6) return NextResponse.json({ success: false, error: 'Senha inválida (mínimo 6 caracteres)' }, { status: 400 });

    const usuario = await User.findById(id);
    if (!usuario) return NextResponse.json({ success: false, error: 'Usuário não encontrado' }, { status: 404 });

    const hashed = await bcrypt.hash(senha, 10);
    usuario.senha = hashed;
    usuario.ativo = true;
    await usuario.save();

    return NextResponse.json({ success: true, message: 'Senha configurada com sucesso' });
  } catch (error) {
    console.error('Erro ao setar senha do usuário:', error);
    return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 });
  }
}
