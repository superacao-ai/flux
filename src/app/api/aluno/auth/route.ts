import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import connectDB from '@/lib/mongodb';
import { Aluno } from '@/models/Aluno';
import { JWT_SECRET, checkRateLimit, resetRateLimit } from '@/lib/auth';
import jwt from 'jsonwebtoken';

// POST - Login do aluno
export async function POST(req: NextRequest) {
  try {
    // Pegar IP para rate limiting
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    
    // Verificar rate limit usando lib centralizada
    const rateCheck = checkRateLimit(`aluno:${ip}`);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { success: false, error: `Muitas tentativas. Tente novamente em ${rateCheck.blockTimeRemaining} minutos.` },
        { status: 429 }
      );
    }
    
    const body = await req.json();
    const { cpf, dataNascimento } = body;
    
    if (!cpf || !dataNascimento) {
      return NextResponse.json(
        { success: false, error: 'CPF e data de nascimento são obrigatórios' },
        { status: 400 }
      );
    }
    
    // Limpar CPF (apenas números)
    const cpfLimpo = cpf.replace(/\D/g, '');
    
    if (cpfLimpo.length !== 11) {
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
    }).populate('modalidadeId', 'nome cor linkWhatsapp');
    
    if (!aluno) {
      return NextResponse.json(
        { success: false, error: 'CPF não encontrado ou inativo' },
        { status: 401 }
      );
    }
    
    // Verificar data de nascimento
    if (!aluno.dataNascimento) {
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
      return NextResponse.json(
        { success: false, error: 'Data de nascimento incorreta' },
        { status: 401 }
      );
    }
    
    // Login bem-sucedido - resetar tentativas
    resetRateLimit(`aluno:${ip}`);
    
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
