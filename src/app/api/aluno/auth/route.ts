import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import connectDB from '@/lib/mongodb';
import { Aluno } from '@/models/Aluno';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'aluno-secret-key-2025';

// Rate limiting simples em memória (em produção, usar Redis)
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_ATTEMPTS = 5;
const BLOCK_DURATION = 15 * 60 * 1000; // 15 minutos

function checkRateLimit(ip: string): { blocked: boolean; remainingAttempts: number } {
  const now = Date.now();
  const attempts = loginAttempts.get(ip);
  
  if (!attempts) {
    return { blocked: false, remainingAttempts: MAX_ATTEMPTS };
  }
  
  // Reset se passou o tempo de bloqueio
  if (now - attempts.lastAttempt > BLOCK_DURATION) {
    loginAttempts.delete(ip);
    return { blocked: false, remainingAttempts: MAX_ATTEMPTS };
  }
  
  if (attempts.count >= MAX_ATTEMPTS) {
    const remainingTime = Math.ceil((BLOCK_DURATION - (now - attempts.lastAttempt)) / 60000);
    return { blocked: true, remainingAttempts: 0 };
  }
  
  return { blocked: false, remainingAttempts: MAX_ATTEMPTS - attempts.count };
}

function recordAttempt(ip: string) {
  const now = Date.now();
  const attempts = loginAttempts.get(ip);
  
  if (!attempts) {
    loginAttempts.set(ip, { count: 1, lastAttempt: now });
  } else {
    loginAttempts.set(ip, { count: attempts.count + 1, lastAttempt: now });
  }
}

function resetAttempts(ip: string) {
  loginAttempts.delete(ip);
}

// POST - Login do aluno
export async function POST(req: NextRequest) {
  try {
    // Pegar IP para rate limiting
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    
    // Verificar rate limit
    const { blocked, remainingAttempts } = checkRateLimit(ip);
    if (blocked) {
      return NextResponse.json(
        { success: false, error: 'Muitas tentativas. Tente novamente em 15 minutos.' },
        { status: 429 }
      );
    }
    
    const body = await req.json();
    const { cpf, dataNascimento } = body;
    
    console.log('[API Aluno Auth] Tentativa de login:', { cpf, dataNascimento });
    
    if (!cpf || !dataNascimento) {
      return NextResponse.json(
        { success: false, error: 'CPF e data de nascimento são obrigatórios' },
        { status: 400 }
      );
    }
    
    // Limpar CPF (apenas números)
    const cpfLimpo = cpf.replace(/\D/g, '');
    console.log('[API Aluno Auth] CPF limpo:', cpfLimpo);
    
    if (cpfLimpo.length !== 11) {
      recordAttempt(ip);
      return NextResponse.json(
        { success: false, error: 'CPF inválido' },
        { status: 400 }
      );
    }
    
    await connectDB();
    
    // Buscar aluno por CPF
    const aluno = await Aluno.findOne({ 
      cpf: cpfLimpo,
      ativo: true 
    }).populate('modalidadeId', 'nome cor');
    
    console.log('[API Aluno Auth] Aluno encontrado:', aluno ? { id: aluno._id, nome: aluno.nome, cpf: aluno.cpf, dataNascimento: aluno.dataNascimento } : null);
    
    if (!aluno) {
      recordAttempt(ip);
      return NextResponse.json(
        { success: false, error: 'CPF não encontrado ou inativo' },
        { status: 401 }
      );
    }
    
    // Verificar data de nascimento
    if (!aluno.dataNascimento) {
      recordAttempt(ip);
      return NextResponse.json(
        { success: false, error: 'Data de nascimento não cadastrada. Procure a recepção.' },
        { status: 401 }
      );
    }
    
    // Comparar datas (ignorando horário)
    const dataInformada = new Date(dataNascimento);
    const dataCadastrada = new Date(aluno.dataNascimento);
    
    const dataInformadaStr = dataInformada.toISOString().split('T')[0];
    const dataCadastradaStr = dataCadastrada.toISOString().split('T')[0];
    
    console.log('[API Aluno Auth] Comparando datas:', { dataInformadaStr, dataCadastradaStr });
    
    if (dataInformadaStr !== dataCadastradaStr) {
      recordAttempt(ip);
      return NextResponse.json(
        { success: false, error: 'Data de nascimento incorreta' },
        { status: 401 }
      );
    }
    
    // Login bem-sucedido - resetar tentativas
    resetAttempts(ip);
    
    // Gerar token JWT para o aluno
    const token = jwt.sign(
      { 
        id: aluno._id.toString(),
        nome: aluno.nome,
        tipo: 'aluno'
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    // Setar cookie httpOnly
    const cookieStore = await cookies();
    cookieStore.set('alunoToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 dias
      path: '/'
    });
    
    // Retornar dados do aluno (sem dados sensíveis)
    return NextResponse.json({
      success: true,
      aluno: {
        _id: aluno._id,
        nome: aluno.nome,
        email: aluno.email,
        telefone: aluno.telefone,
        modalidade: aluno.modalidadeId ? {
          _id: (aluno.modalidadeId as any)._id,
          nome: (aluno.modalidadeId as any).nome,
          cor: (aluno.modalidadeId as any).cor
        } : null,
        congelado: aluno.congelado,
        ausente: aluno.ausente,
        emEspera: aluno.emEspera
      },
      token
    });
    
  } catch (error) {
    console.error('[API Aluno Auth] Erro:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// DELETE - Logout do aluno
export async function DELETE() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete('alunoToken');
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Erro ao fazer logout' },
      { status: 500 }
    );
  }
}
