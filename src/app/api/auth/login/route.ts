import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/mongodb';
import { User } from '@/models/User';
import { JWT_SECRET, generateAdminToken, checkRateLimit, resetRateLimit } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
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

    const emailLower = email.toLowerCase();
    
    // Verificar rate limiting por email
    const rateCheck = checkRateLimit(emailLower);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Muitas tentativas de login. Tente novamente em ${rateCheck.blockTimeRemaining} minutos.`
        },
        { status: 429 }
      );
    }

    await connectDB();

    // Buscar usuário por email
    const user = await User.findOne({ 
      email: emailLower,
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

    // Login bem sucedido - resetar rate limiting
    resetRateLimit(emailLower);

    // Gerar token JWT usando lib centralizada
    const token = generateAdminToken({
      userId: user._id.toString(),
      email: user.email,
      tipo: user.tipo
    });

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

    // Retornar token no body para o frontend salvar no localStorage
    const res = NextResponse.json({
      success: true,
      message: 'Login realizado com sucesso',
      user: userData,
      token: token
    });
    
    // Também salvar no cookie HttpOnly para APIs que preferem cookies
    res.cookies.set('token', token, { 
      httpOnly: true, 
      path: '/', 
      maxAge: 60 * 60 * 24, 
      sameSite: 'lax', 
      secure: process.env.NODE_ENV === 'production' 
    });
    
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