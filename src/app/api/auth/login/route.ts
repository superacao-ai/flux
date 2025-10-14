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
      tipo: user.tipo
    };

    return NextResponse.json({
      success: true,
      message: 'Login realizado com sucesso',
      token,
      user: userData
    });

  } catch (error) {
    console.error('Erro no login:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erro interno do servidor'
      },
      { status: 500 }
    );
  }
}