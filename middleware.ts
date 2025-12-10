import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// Função para obter secret como Uint8Array (necessário para jose)
function getJwtSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // Em desenvolvimento, usar secret padrão
    if (process.env.NODE_ENV === 'development') {
      return new TextEncoder().encode('dev-secret-key-nao-usar-em-producao-2025');
    }
    throw new Error('JWT_SECRET não definido');
  }
  return new TextEncoder().encode(secret);
}

// Valida token JWT
async function validateToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, getJwtSecretKey());
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Rotas públicas (não precisam de autenticação)
  const publicPaths = [
    '/',                    // Login do aluno (página inicial)
    '/admin/login',         // Login administrativo
    '/login',               // Manter compatibilidade (redireciona)
    '/api/auth/login',      // API login admin
    '/api/auth/logout',     // API logout admin
    '/api/aluno/auth',      // API login/logout aluno
    '/api/public',          // APIs públicas
    '/_next',
    '/favicon.ico',
    '/icons',
    '/manifest.json',
    '/sw.js',
    '/workbox'
  ];
  
  if (publicPaths.some(p => pathname === p || pathname.startsWith(p + '/') || pathname.startsWith(p + '.'))) {
    return NextResponse.next();
  }

  // API de configurações - GET é público, PUT precisa de auth (a própria API valida)
  if (pathname === '/api/configuracoes' && req.method === 'GET') {
    return NextResponse.next();
  }

  // Rotas da área do aluno (precisam de alunoToken válido)
  if (pathname.startsWith('/aluno')) {
    const alunoToken = req.cookies.get('alunoToken')?.value;
    if (!alunoToken) {
      const loginUrl = new URL('/', req.url);
      return NextResponse.redirect(loginUrl);
    }
    
    // Validar token
    const isValid = await validateToken(alunoToken);
    if (!isValid) {
      const loginUrl = new URL('/', req.url);
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete('alunoToken');
      return response;
    }
    
    return NextResponse.next();
  }

  // Rotas da área do aluno via API
  if (pathname.startsWith('/api/aluno/') && !pathname.startsWith('/api/aluno/auth')) {
    const alunoToken = req.cookies.get('alunoToken')?.value;
    if (!alunoToken) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }
    
    // Validar token
    const isValid = await validateToken(alunoToken);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Token inválido ou expirado' },
        { status: 401 }
      );
    }
    
    return NextResponse.next();
  }

  // Demais rotas (admin/funcionários) - precisam de token válido
  const token = req.cookies.get('token')?.value;
  if (!token) {
    const loginUrl = new URL('/admin/login', req.url);
    return NextResponse.redirect(loginUrl);
  }

  // Validar token admin
  const isValid = await validateToken(token);
  if (!isValid) {
    const loginUrl = new URL('/admin/login', req.url);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete('token');
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
