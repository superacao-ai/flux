import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import connectDB from '@/lib/mongodb';
import { AlteracaoHorario } from '@/models/AlteracaoHorario';
import { Matricula } from '@/models/Matricula';
import { Aluno } from '@/models/Aluno';
import { User } from '@/models/User';

const JWT_SECRET = process.env.JWT_SECRET || 'sua_chave_secreta_super_forte';

async function isAdmin() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    
    console.log('[API Alterações] Token encontrado:', !!token);
    
    if (!token) {
      console.log('[API Alterações] Sem token');
      return false;
    }
    
    const decoded = jwt.verify(token, JWT_SECRET) as { userId?: string; id?: string; tipo: string };
    console.log('[API Alterações] Token decodificado:', decoded);
    
    const tipoLower = decoded.tipo?.toLowerCase() || '';
    const isAuthorized = tipoLower === 'adm' || tipoLower === 'professor' || tipoLower === 'root' || tipoLower === 'admin';
    console.log('[API Alterações] Tipo:', decoded.tipo, '| Autorizado:', isAuthorized);
    
    return isAuthorized;
  } catch (error) {
    console.error('[API Alterações] Erro ao verificar admin:', error);
    return false;
  }
}

// GET - Listar todas as solicitações de alteração de horário
export async function GET(req: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }
    
    await connectDB();
    
    // Garantir que os modelos estejam registrados
    void User;
    void Aluno;
    
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'pendente';
    
    console.log('[API Alterações GET] Status filtro:', status);
    
    const query: Record<string, unknown> = {};
    if (status !== 'todas') {
      query.status = status;
    }
    
    console.log('[API Alterações GET] Query:', query);
    
    // Contar total de documentos na collection
    const totalDocs = await AlteracaoHorario.countDocuments({});
    console.log('[API Alterações GET] Total de documentos na collection:', totalDocs);
    
    const solicitacoes = await AlteracaoHorario.find(query)
      .populate({
        path: 'alunoId',
        model: 'Aluno',
        select: 'nome email telefone'
      })
      .populate({
        path: 'horarioAtualId',
        populate: [
          { path: 'modalidadeId', select: 'nome cor' },
          { path: 'professorId', model: 'User', select: 'nome' }
        ]
      })
      .populate({
        path: 'novoHorarioId',
        populate: [
          { path: 'modalidadeId', select: 'nome cor' },
          { path: 'professorId', model: 'User', select: 'nome' }
        ]
      })
      .sort({ criadoEm: -1 })
      .limit(100);
    
    console.log('[API Alterações GET] Solicitações encontradas:', solicitacoes.length);
    
    // Contar pendentes
    const pendentes = await AlteracaoHorario.countDocuments({ status: 'pendente' });
    
    console.log('[API Alterações GET] Pendentes:', pendentes);
    
    return NextResponse.json({
      success: true,
      solicitacoes,
      pendentes
    });
    
  } catch (error) {
    console.error('[API Alterações Horário GET] Erro:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar solicitações' },
      { status: 500 }
    );
  }
}

// PUT - Aprovar ou rejeitar solicitação
export async function PUT(req: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }
    
    await connectDB();
    
    const body = await req.json();
    const { solicitacaoId, acao, motivoRejeicao } = body;
    
    if (!solicitacaoId || !acao) {
      return NextResponse.json(
        { success: false, error: 'Dados incompletos' },
        { status: 400 }
      );
    }
    
    if (!['aprovar', 'rejeitar'].includes(acao)) {
      return NextResponse.json(
        { success: false, error: 'Ação inválida' },
        { status: 400 }
      );
    }
    
    const solicitacao = await AlteracaoHorario.findById(solicitacaoId);
    
    if (!solicitacao) {
      return NextResponse.json(
        { success: false, error: 'Solicitação não encontrada' },
        { status: 404 }
      );
    }
    
    if (solicitacao.status !== 'pendente') {
      return NextResponse.json(
        { success: false, error: 'Solicitação já foi processada' },
        { status: 400 }
      );
    }
    
    if (acao === 'aprovar') {
      // Verificar se ainda existe a matrícula
      const matricula = await Matricula.findById(solicitacao.matriculaId);
      
      if (!matricula || !matricula.ativo) {
        return NextResponse.json(
          { success: false, error: 'Matrícula não encontrada ou inativa' },
          { status: 400 }
        );
      }
      
      // Verificar se ainda tem vaga no novo horário
      const matriculasNoNovoHorario = await Matricula.countDocuments({
        horarioFixoId: solicitacao.novoHorarioId,
        ativo: true,
        emEspera: { $ne: true }
      });
      
      // TODO: Verificar limite de alunos da modalidade
      
      // Atualizar a matrícula com o novo horário
      await Matricula.findByIdAndUpdate(solicitacao.matriculaId, {
        horarioFixoId: solicitacao.novoHorarioId,
        atualizadoEm: new Date()
      });
      
      // Atualizar a solicitação
      solicitacao.status = 'aprovado';
      solicitacao.atualizadoEm = new Date();
      await solicitacao.save();
      
      return NextResponse.json({
        success: true,
        message: 'Solicitação aprovada! O horário do aluno foi alterado.'
      });
      
    } else {
      // Rejeitar
      solicitacao.status = 'rejeitado';
      solicitacao.motivoRejeicao = motivoRejeicao || 'Solicitação rejeitada pela administração';
      solicitacao.atualizadoEm = new Date();
      await solicitacao.save();
      
      return NextResponse.json({
        success: true,
        message: 'Solicitação rejeitada.'
      });
    }
    
  } catch (error) {
    console.error('[API Alterações Horário PUT] Erro:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao processar solicitação' },
      { status: 500 }
    );
  }
}

// DELETE - Excluir uma solicitação de alteração de horário
export async function DELETE(req: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const solicitacaoId = searchParams.get('id');

    if (!solicitacaoId) {
      return NextResponse.json(
        { success: false, error: 'ID da solicitação não informado' },
        { status: 400 }
      );
    }

    const solicitacao = await AlteracaoHorario.findById(solicitacaoId);

    if (!solicitacao) {
      return NextResponse.json(
        { success: false, error: 'Solicitação não encontrada' },
        { status: 404 }
      );
    }

    await AlteracaoHorario.findByIdAndDelete(solicitacaoId);

    return NextResponse.json({
      success: true,
      message: 'Solicitação excluída com sucesso'
    });

  } catch (error) {
    console.error('[API Alterações Horário DELETE] Erro:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao excluir solicitação' },
      { status: 500 }
    );
  }
}
