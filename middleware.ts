import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
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

  // Rotas da área do aluno (precisam de alunoToken)
  if (pathname.startsWith('/aluno')) {
    const alunoToken = req.cookies.get('alunoToken')?.value;
    if (!alunoToken) {
      const loginUrl = new URL('/', req.url);
      return NextResponse.redirect(loginUrl);
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
    return NextResponse.next();
  }

  // Demais rotas (admin/funcionários) - precisam de token normal
  const token = req.cookies.get('token')?.value;
  if (!token) {
    const loginUrl = new URL('/admin/login', req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
