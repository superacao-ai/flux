import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import connectDB from '@/lib/mongodb';
import { User } from '@/models/User';

const JWT_SECRET = process.env.JWT_SECRET || 'sua_chave_secreta_super_forte';

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    
    const { email, senha } = await request.json();

    // Validações básicas
    if (!email || !senha) {
      return NextResponse.json(
        {
          success: false,
          error: 'Email e senha são obrigatórios'
        },
        { status: 400 }
      );
    }

    // Buscar usuário por email
    const user = await User.findOne({ 
      email: email.toLowerCase(),
      ativo: true 
    }).select('+senha');

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Credenciais inválidas'
        },
        { status: 401 }
      );
    }

    // Verificar senha
    const senhaValida = await bcrypt.compare(senha, user.senha);

    if (!senhaValida) {
      return NextResponse.json(
        {
          success: false,
          error: 'Credenciais inválidas'
        },
        { status: 401 }
      );
    }

    // Gerar token JWT
    const token = jwt.sign(
      { 
        userId: user._id,
        email: user.email,
        tipo: user.tipo 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Dados do usuário (sem a senha)
    const userData = {
      id: user._id,
      nome: user.nome,
      email: user.email,
      tipo: user.tipo,
      abas: user.abas || [],
      permissoes: user.permissoes || {},
      cor: user.cor || '#3B82F6'
    };

    // Return token in an HttpOnly cookie (so middleware / server-side checks can use it)
    const res = NextResponse.json({
      success: true,
      message: 'Login realizado com sucesso',
      token,
      user: userData
    });
    // cookie options: keep for 24h, httpOnly, secure in production
    res.cookies.set('token', token, { httpOnly: true, path: '/', maxAge: 60 * 60 * 24, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
    return res;

  } catch (error) {
    // Log full error server-side for debugging
    console.error('Erro no login:', error);

    // If the error is due to a missing MongoDB URI, return a specific message
    const msg = (error instanceof Error && /MONGODB_URI/i.test(error.message))
      ? 'MONGODB_URI não definida. Configure .env.local com a variável de conexão ao MongoDB.'
      : (error instanceof Error ? error.message : 'Erro interno do servidor');

    return NextResponse.json(
      {
        success: false,
        error: msg
      },
      { status: 500 }
    );
  }
}