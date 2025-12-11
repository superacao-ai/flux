import fs from 'fs';
import path from 'path';

/**
 * Sistema de Segurança - Proteção contra força bruta
 */

// Configurações de rate limiting (via env ou defaults)
const MAX_LOGIN_ATTEMPTS = parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5');
const BLOCK_DURATION_MS = parseInt(process.env.BLOCK_DURATION_MINUTES || '15') * 60 * 1000;
const LOG_SECURITY_EVENTS = process.env.LOG_SECURITY_EVENTS !== 'false'; // True por padrão

// Rate limiting em memória
interface RateLimitData {
  count: number;
  lastAttempt: number;
  ips?: Set<string>; // Para rastrear diferentes IPs tentando
}

const loginAttempts = new Map<string, RateLimitData>();

/**
 * Registra evento de segurança em arquivo
 */
export function logSecurityEvent(eventType: string, data: any): void {
  if (!LOG_SECURITY_EVENTS) return;

  try {
    const logDir = path.resolve(process.cwd(), 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const logFile = path.join(logDir, 'security-events.log');
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      eventType,
      data,
    };

    fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n', 'utf-8');
  } catch (error) {
    console.error('[Security] Erro ao registrar evento de segurança:', error);
  }
}

/**
 * Verifica rate limit com suporte a múltiplas identidades (email + IP)
 * Retorna informações sobre tentativas restantes e tempo de bloqueio
 */
export function checkRateLimitEnhanced(
  identifier: string,
  ipAddress: string
): { 
  allowed: boolean;
  remainingAttempts: number;
  blockedUntil?: number; // timestamp
  blockTimeRemaining?: number; // minutos
} {
  const now = Date.now();
  const attempts = loginAttempts.get(identifier);

  // Se não há registros, criar novo
  if (!attempts) {
    loginAttempts.set(identifier, {
      count: 1,
      lastAttempt: now,
      ips: new Set([ipAddress]),
    });
    return { allowed: true, remainingAttempts: MAX_LOGIN_ATTEMPTS - 1 };
  }

  // Se passou o tempo de bloqueio, resetar
  if (now - attempts.lastAttempt > BLOCK_DURATION_MS) {
    loginAttempts.set(identifier, {
      count: 1,
      lastAttempt: now,
      ips: new Set([ipAddress]),
    });
    return { allowed: true, remainingAttempts: MAX_LOGIN_ATTEMPTS - 1 };
  }

  // Adicionar IP ao conjunto de tentativas
  if (attempts.ips) {
    attempts.ips.add(ipAddress);
  }

  // Se atingiu o limite, bloquear
  if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
    const blockedUntil = attempts.lastAttempt + BLOCK_DURATION_MS;
    const blockTimeRemaining = Math.ceil((blockedUntil - now) / 1000 / 60);

    return {
      allowed: false,
      remainingAttempts: 0,
      blockedUntil,
      blockTimeRemaining,
    };
  }

  // Incrementar tentativas
  attempts.count++;
  attempts.lastAttempt = now;
  loginAttempts.set(identifier, attempts);

  return { allowed: true, remainingAttempts: MAX_LOGIN_ATTEMPTS - attempts.count };
}

/**
 * Resetar tentativas de login (ao ter sucesso)
 */
export function resetRateLimitEnhanced(identifier: string): void {
  loginAttempts.delete(identifier);
}

/**
 * Validar força da senha
 * Requisitos:
 * - Mínimo 8 caracteres
 * - Pelo menos 1 letra maiúscula
 * - Pelo menos 1 letra minúscula
 * - Pelo menos 1 número
 * - Pelo menos 1 caractere especial (!@#$%^&*)
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  score: number; // 0-5
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;

  if (!password) {
    return { isValid: false, score: 0, feedback: ['Senha é obrigatória'] };
  }

  // Verificar comprimento
  if (password.length >= 8) {
    score++;
  } else {
    feedback.push('Mínimo 8 caracteres');
  }

  // Verificar letra maiúscula
  if (/[A-Z]/.test(password)) {
    score++;
  } else {
    feedback.push('Adicione pelo menos 1 letra maiúscula');
  }

  // Verificar letra minúscula
  if (/[a-z]/.test(password)) {
    score++;
  } else {
    feedback.push('Adicione pelo menos 1 letra minúscula');
  }

  // Verificar número
  if (/\d/.test(password)) {
    score++;
  } else {
    feedback.push('Adicione pelo menos 1 número');
  }

  // Verificar caractere especial
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    score++;
  } else {
    feedback.push('Adicione pelo menos 1 caractere especial (!@#$%^&*)');
  }

  return {
    isValid: score >= 4, // Pelo menos 4 requisitos (mínimo é comprimento + 3 outros)
    score,
    feedback,
  };
}

/**
 * Detectar tentativas suspeitas de acesso (múltiplos IPs em curto período)
 */
export function detectSuspiciousActivity(
  identifier: string
): {
  isSuspicious: boolean;
  ipCount: number;
  message?: string;
} {
  const attempts = loginAttempts.get(identifier);

  if (!attempts || !attempts.ips || attempts.ips.size <= 1) {
    return { isSuspicious: false, ipCount: attempts?.ips?.size || 0 };
  }

  const ipCount = attempts.ips.size;
  const suspiciousThreshold = 3; // Mais de 3 IPs diferentes em curto período

  if (ipCount > suspiciousThreshold) {
    return {
      isSuspicious: true,
      ipCount,
      message: `Detectadas tentativas de acesso de ${ipCount} IPs diferentes`,
    };
  }

  return { isSuspicious: false, ipCount };
}

/**
 * Extrair IP real do request (considerar proxies)
 */
export function extractClientIp(
  xForwardedFor?: string | null,
  xRealIp?: string | null,
  remoteAddr?: string
): string {
  // x-forwarded-for pode conter múltiplos IPs (último é o mais recente)
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim();
  }
  if (xRealIp) {
    return xRealIp;
  }
  return remoteAddr || 'unknown';
}

/**
 * Limpar tentativas antigas periodicamente (evitar memory leak)
 */
export function cleanupOldAttempts(): void {
  const now = Date.now();
  const entriesToDelete: string[] = [];

  for (const [key, value] of loginAttempts.entries()) {
    // Se passou 2x o tempo de bloqueio desde a última tentativa, remover
    if (now - value.lastAttempt > BLOCK_DURATION_MS * 2) {
      entriesToDelete.push(key);
    }
  }

  entriesToDelete.forEach((key) => loginAttempts.delete(key));

  if (entriesToDelete.length > 0) {
    console.log(`[Security] Limpeza: ${entriesToDelete.length} entradas de rate limit removidas`);
  }
}

/**
 * Sanitizar entrada para prevenir XSS (básico)
 */
export function sanitizeInput(input: string): string {
  if (!input) return '';
  return input
    .replace(/[<>]/g, '') // Remove < e >
    .trim();
}

// Executar limpeza a cada 30 minutos
setInterval(cleanupOldAttempts, 30 * 60 * 1000);
