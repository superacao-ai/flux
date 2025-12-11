import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import connectDB from '@/lib/mongodb';
import { Aluno } from '@/models/Aluno';
import { JWT_SECRET } from '@/lib/auth';
import jwt from 'jsonwebtoken';
import { 
  checkRateLimitEnhanced, 
  resetRateLimitEnhanced, 
  logSecurityEvent, 
  extractClientIp,
  detectSuspiciousActivity,
  sanitizeInput 
} from '@/lib/security';

// POST - Login do aluno
export async function POST(req: NextRequest) {
  try {
    // Extrair IP do cliente
    const clientIp = extractClientIp(
      req.headers.get('x-forwarded-for'),
      req.headers.get('x-real-ip')
    );
    
    const body = await req.json();
    const { cpf, dataNascimento, remember } = body;
    
    if (!cpf || !dataNascimento) {
      logSecurityEvent('ALUNO_LOGIN_INVALID_CREDENTIALS', {
        cpf: sanitizeInput(cpf?.substring(0, 5) || '***'), // Esconder CPF completo
        ip: clientIp,
        reason: 'missing_fields'
      });

      return NextResponse.json(
        { success: false, error: 'CPF e data de nascimento são obrigatórios' },
        { status: 400 }
      );
    }
    
    // Limpar CPF (apenas números)
    const cpfLimpo = cpf.replace(/\D/g, '');
    
    if (cpfLimpo.length !== 11) {
      logSecurityEvent('ALUNO_LOGIN_INVALID_CPF', {
        cpf: sanitizeInput(cpfLimpo?.substring(0, 5) || '***'),
        ip: clientIp
      });

      return NextResponse.json(
        { success: false, error: 'CPF inválido' },
        { status: 400 }
      );
    }

    // Verificar rate limit - usando CPF como identificador
    const rateCheck = checkRateLimitEnhanced(`aluno:${cpfLimpo}`, clientIp);
    if (!rateCheck.allowed) {
      logSecurityEvent('ALUNO_LOGIN_RATE_LIMIT', {
        cpf: cpfLimpo.substring(0, 5) + '****',
        ip: clientIp,
        blockTimeRemaining: rateCheck.blockTimeRemaining
      });

      // Detectar atividade suspeita
      const suspicious = detectSuspiciousActivity(`aluno:${cpfLimpo}`);
      if (suspicious.isSuspicious) {
        logSecurityEvent('ALUNO_SUSPICIOUS_ACTIVITY', {
          cpf: cpfLimpo.substring(0, 5) + '****',
          ipCount: suspicious.ipCount,
          message: suspicious.message
        });
      }

      return NextResponse.json(
        { success: false, error: `Muitas tentativas. Tente novamente em ${rateCheck.blockTimeRemaining} minutos.` },
        { status: 429 }
      );
    }
    
    await connectDB();
    
    // Buscar aluno por CPF
    const aluno = await Aluno.findOne({ 
      cpf: cpfLimpo,
      ativo: true 
    }).populate('modalidadeId', 'nome cor linkWhatsapp');
    
    if (!aluno) {
      logSecurityEvent('ALUNO_LOGIN_NOT_FOUND', {
        cpf: cpfLimpo.substring(0, 5) + '****',
        ip: clientIp
      });

      return NextResponse.json(
        { success: false, error: 'CPF não encontrado ou inativo' },
        { status: 401 }
      );
    }
    
    // Verificar data de nascimento
    if (!aluno.dataNascimento) {
      logSecurityEvent('ALUNO_LOGIN_NO_BIRTHDATE', {
        cpf: cpfLimpo.substring(0, 5) + '****',
        ip: clientIp,
        alunoId: aluno._id.toString()
      });

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
    
    if (dataInformadaStr !== dataCadastradaStr) {
      logSecurityEvent('ALUNO_LOGIN_INVALID_BIRTHDATE', {
        cpf: cpfLimpo.substring(0, 5) + '****',
        ip: clientIp,
        alunoId: aluno._id.toString()
      });

      return NextResponse.json(
        { success: false, error: 'Data de nascimento incorreta' },
        { status: 401 }
      );
    }
    
    // Login bem-sucedido - resetar tentativas
    resetRateLimitEnhanced(`aluno:${cpfLimpo}`);
    logSecurityEvent('ALUNO_LOGIN_SUCCESS', {
      cpf: cpfLimpo.substring(0, 5) + '****',
      ip: clientIp,
      alunoId: aluno._id.toString()
    });
    
    // Definir expiração baseado no remember
    // Se remember=true, token dura 30 dias; senão 7 dias
    const tokenExpiry = remember ? '30d' : '7d';
    const cookieMaxAge = remember ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60;
    
    // Gerar token JWT para o aluno
    const token = jwt.sign(
      { 
        id: aluno._id.toString(),
        nome: aluno.nome,
        tipo: 'aluno'
      },
      JWT_SECRET,
      { expiresIn: tokenExpiry }
    );
    
    // Setar cookie httpOnly
    const cookieStore = await cookies();
    cookieStore.set('alunoToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: cookieMaxAge,
      path: '/'
    });
    
    // Retornar dados do aluno (sem dados sensíveis e sem token no body)
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
          cor: (aluno.modalidadeId as any).cor,
          linkWhatsapp: (aluno.modalidadeId as any).linkWhatsapp || ''
        } : null,
        congelado: aluno.congelado,
        ausente: aluno.ausente,
        emEspera: aluno.emEspera
      }
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
