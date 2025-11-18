import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const res = NextResponse.json({ success: true, message: 'Desconectado' });
    // clear cookie
    res.cookies.set('token', '', { httpOnly: true, path: '/', maxAge: 0 });
    return res;
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Erro ao desconectar' }, { status: 500 });
  }
}
