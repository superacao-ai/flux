import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import connectDB from '@/lib/mongodb';
import { User } from '@/models/User';
import { JWT_SECRET } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Pegar token do header ou cookie
    let token = request.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!token) {
      token = request.cookies.get('token')?.value;
    }
    
    if (!token) {
      return NextResponse.json({ success: false, error: 'Token não fornecido' }, { status: 401 });
    }

    // Decodificar token
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    
    if (!decoded?.userId) {
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 });
    }

    await connectDB();

    // Buscar usuário atualizado do banco
    const usuario = await User.findById(decoded.userId).select('-senha');
    
    if (!usuario) {
      return NextResponse.json({ success: false, error: 'Usuário não encontrado' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      user: {
        _id: usuario._id,
        id: usuario._id,
        nome: usuario.nome,
        email: usuario.email,
        tipo: usuario.tipo,
        abas: usuario.abas || [],
        ativo: usuario.ativo,
      }
    });

  } catch (error: any) {
    console.error('Erro ao buscar usuário:', error);
    
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return NextResponse.json({ success: false, error: 'Token inválido ou expirado' }, { status: 401 });
    }
    
    return NextResponse.json({ success: false, error: 'Erro interno' }, { status: 500 });
  }
}
