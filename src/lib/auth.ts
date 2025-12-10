import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';

// JWT_SECRET obrigatório - não usar fallback em produção
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  
  if (!secret) {
    // Em desenvolvimento, usar um secret padrão com aviso
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ JWT_SECRET não definido. Usando secret de desenvolvimento.');
      return 'dev-secret-key-nao-usar-em-producao-2025';
    }
    // Em produção, lançar erro
    throw new Error('JWT_SECRET não está definido. Configure a variável de ambiente.');
  }
  
  return secret;
}

export const JWT_SECRET = getJwtSecret();

// Interface para payload do token de admin/professor
export interface AdminTokenPayload {
  userId: string;
  email: string;
  tipo: 'admin' | 'professor';
}

// Interface para payload do token de aluno
export interface AlunoTokenPayload {
  alunoId: string;
  nome: string;
  cpf: string;
}

// Verifica e decodifica token de admin/professor
export function verifyAdminToken(token: string): AdminTokenPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AdminTokenPayload;
    return decoded;
  } catch {
    throw new Error('Token inválido ou expirado');
  }
}

// Verifica e decodifica token de aluno
export function verifyAlunoToken(token: string): AlunoTokenPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AlunoTokenPayload;
    return decoded;
  } catch {
    throw new Error('Token inválido ou expirado');
  }
}

// Gera token de admin/professor
export function generateAdminToken(payload: AdminTokenPayload, expiresIn: string = '24h'): string {
  return jwt.sign(payload as object, JWT_SECRET, { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] });
}

// Gera token de aluno
export function generateAlunoToken(payload: AlunoTokenPayload, expiresIn: string = '7d'): string {
  return jwt.sign(payload as object, JWT_SECRET, { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] });
}

// Extrai token do request (cookie ou header)
export function getTokenFromRequest(request: NextRequest, cookieName: string = 'token'): string | null {
  // Tentar cookie primeiro
  const cookieToken = request.cookies.get(cookieName)?.value;
  if (cookieToken) return cookieToken;
  
  // Tentar Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  return null;
}

// Rate limiting em memória (para login)
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_ATTEMPTS = 5;
const BLOCK_DURATION = 15 * 60 * 1000; // 15 minutos

export function checkRateLimit(identifier: string): { allowed: boolean; remainingAttempts: number; blockTimeRemaining?: number } {
  const now = Date.now();
  const attempts = loginAttempts.get(identifier);
  
  if (!attempts) {
    loginAttempts.set(identifier, { count: 1, lastAttempt: now });
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS - 1 };
  }
  
  // Se passou o tempo de bloqueio, resetar
  if (now - attempts.lastAttempt > BLOCK_DURATION) {
    loginAttempts.set(identifier, { count: 1, lastAttempt: now });
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS - 1 };
  }
  
  // Se atingiu o limite
  if (attempts.count >= MAX_ATTEMPTS) {
    const blockTimeRemaining = BLOCK_DURATION - (now - attempts.lastAttempt);
    return { 
      allowed: false, 
      remainingAttempts: 0, 
      blockTimeRemaining: Math.ceil(blockTimeRemaining / 1000 / 60) // minutos
    };
  }
  
  // Incrementar tentativas
  attempts.count++;
  attempts.lastAttempt = now;
  loginAttempts.set(identifier, attempts);
  
  return { allowed: true, remainingAttempts: MAX_ATTEMPTS - attempts.count };
}

export function resetRateLimit(identifier: string): void {
  loginAttempts.delete(identifier);
}

// Limpar tentativas antigas periodicamente (evitar memory leak)
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of loginAttempts.entries()) {
    if (now - value.lastAttempt > BLOCK_DURATION * 2) {
      loginAttempts.delete(key);
    }
  }
}, 60 * 60 * 1000); // A cada hora
