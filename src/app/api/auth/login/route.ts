import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/mongodb';
import { User } from '@/models/User';
import { JWT_SECRET, generateAdminToken } from '@/lib/auth';
import { 
  checkRateLimitEnhanced, 
  resetRateLimitEnhanced, 
  logSecurityEvent, 
  extractClientIp,
  detectSuspiciousActivity,
  sanitizeInput 
} from '@/lib/security';

export async function POST(request: NextRequest) {
  try {
    const { email, senha, remember } = await request.json();

    // Extrair IP do cliente
    const clientIp = extractClientIp(
      request.headers.get('x-forwarded-for'),
      request.headers.get('x-real-ip')
    );

    // Validações básicas
    if (!email || !senha) {
      logSecurityEvent('LOGIN_INVALID_CREDENTIALS', {
        email: sanitizeInput(email),
        ip: clientIp,
        reason: 'missing_fields'
      });
      
      return NextResponse.json(
        {
          success: false,
          error: 'Email e senha são obrigatórios'
        },
        { status: 400 }
      );
    }

    const emailLower = sanitizeInput(email.toLowerCase());
    
    // Verificar rate limiting por email
    const rateCheck = checkRateLimitEnhanced(emailLower, clientIp);
    if (!rateCheck.allowed) {
      logSecurityEvent('LOGIN_RATE_LIMIT_EXCEEDED', {
        email: emailLower,
        ip: clientIp,
        blockTimeRemaining: rateCheck.blockTimeRemaining
      });

      // Detectar atividade suspeita (múltiplos IPs)
      const suspicious = detectSuspiciousActivity(emailLower);
      if (suspicious.isSuspicious) {
        logSecurityEvent('SUSPICIOUS_ACTIVITY_DETECTED', {
          email: emailLower,
          ipCount: suspicious.ipCount,
          message: suspicious.message
        });
      }

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
      logSecurityEvent('LOGIN_USER_NOT_FOUND', {
        email: emailLower,
        ip: clientIp
      });

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
      logSecurityEvent('LOGIN_INVALID_PASSWORD', {
        email: emailLower,
        ip: clientIp,
        userId: user._id.toString()
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Credenciais inválidas'
        },
        { status: 401 }
      );
    }

    // Login bem sucedido - resetar rate limiting e registrar sucesso
    resetRateLimitEnhanced(emailLower);
    logSecurityEvent('LOGIN_SUCCESS', {
      email: emailLower,
      ip: clientIp,
      userId: user._id.toString(),
      tipo: user.tipo
    });

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
    // Se remember=true, cookie dura 30 dias; senão dura 24 horas
    const cookieMaxAge = remember ? 60 * 60 * 24 * 30 : 60 * 60 * 24;
    
    res.cookies.set('token', token, { 
      httpOnly: true, 
      path: '/', 
      maxAge: cookieMaxAge, 
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