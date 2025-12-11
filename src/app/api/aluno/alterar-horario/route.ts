import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import connectDB from '@/lib/mongodb';
import { Matricula } from '@/models/Matricula';
import { HorarioFixo } from '@/models/HorarioFixo';
import { AlteracaoHorario } from '@/models/AlteracaoHorario';
import { Modalidade } from '@/models/Modalidade';
import { JWT_SECRET } from '@/lib/auth';

async function getAlunoFromToken() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('alunoToken')?.value;
    
    if (!token) return null;
    
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; nome: string; tipo: string };
    
    if (decoded.tipo !== 'aluno') return null;
    
    return decoded;
  } catch {
    return null;
  }
}

// GET - Listar solicitações de alteração de horário do aluno
export async function GET() {
  try {
    const aluno = await getAlunoFromToken();
    
    if (!aluno) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }
    
    await connectDB();
    
    const solicitacoes = await AlteracaoHorario.find({
      alunoId: aluno.id
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
      .limit(20);
    
    return NextResponse.json({
      success: true,
      solicitacoes
    });
    
  } catch (error) {
    console.error('[API Alterar Horário GET] Erro:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar solicitações' },
      { status: 500 }
    );
  }
}

// POST - Solicitar alteração de horário fixo
export async function POST(req: NextRequest) {
  try {
    const aluno = await getAlunoFromToken();
    
    if (!aluno) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }
    
    await connectDB();
    
    const body = await req.json();
    const { horarioAtualId, novoHorarioId, motivo } = body;
    
    // Validações
    if (!horarioAtualId || !novoHorarioId) {
      return NextResponse.json(
        { success: false, error: 'Horário atual e novo horário são obrigatórios' },
        { status: 400 }
      );
    }
    
    if (horarioAtualId === novoHorarioId) {
      return NextResponse.json(
        { success: false, error: 'O novo horário deve ser diferente do atual' },
        { status: 400 }
      );
    }
    
    // Verificar se o aluno está matriculado no horário atual
    const matriculaAtual = await Matricula.findOne({
      alunoId: aluno.id,
      horarioFixoId: horarioAtualId,
      ativo: true
    });
    
    if (!matriculaAtual) {
      return NextResponse.json(
        { success: false, error: 'Você não está matriculado neste horário' },
        { status: 403 }
      );
    }
    
    // Buscar o horário atual
    const horarioAtual = await HorarioFixo.findById(horarioAtualId)
      .populate('modalidadeId', 'nome cor limiteAlunos');
    
    if (!horarioAtual) {
      return NextResponse.json(
        { success: false, error: 'Horário atual não encontrado' },
        { status: 404 }
      );
    }
    
    // Buscar o novo horário
    const novoHorario = await HorarioFixo.findById(novoHorarioId)
      .populate('modalidadeId', 'nome cor limiteAlunos');
    
    if (!novoHorario) {
      return NextResponse.json(
        { success: false, error: 'Novo horário não encontrado' },
        { status: 404 }
      );
    }
    
    // Verificar se o novo horário é da mesma modalidade
    const modalidadeAtualId = (horarioAtual.modalidadeId as any)?._id?.toString();
    const modalidadeNovaId = (novoHorario.modalidadeId as any)?._id?.toString();
    
    if (modalidadeAtualId !== modalidadeNovaId) {
      return NextResponse.json(
        { success: false, error: 'O novo horário deve ser da mesma modalidade' },
        { status: 400 }
      );
    }

    // ========== VERIFICAÇÃO DE CONFLITO ENTRE MODALIDADES VINCULADAS ==========
    // Se a modalidade tem modalidades vinculadas (compartilham espaço físico),
    // verificar se há aulas no mesmo dia/horário nessas modalidades
    if (novoHorario.modalidadeId) {
      try {
        const modalidade = await Modalidade.findById((novoHorario.modalidadeId as any)?._id || novoHorario.modalidadeId).lean();
        const vinculadas = (modalidade as any)?.modalidadesVinculadas || [];
        
        if (vinculadas.length > 0) {
          // Buscar aulas nas modalidades vinculadas no mesmo dia e horário
          const conflitoVinculada = await HorarioFixo.findOne({
            modalidadeId: { $in: vinculadas },
            diaSemana: novoHorario.diaSemana,
            ativo: true,
            $or: [
              { horarioInicio: { $lt: novoHorario.horarioFim }, horarioFim: { $gt: novoHorario.horarioInicio } }
            ]
          }).populate('modalidadeId', 'nome');
          
          if (conflitoVinculada) {
            const nomeModalidadeConflito = (conflitoVinculada.modalidadeId as any)?.nome || 'outra modalidade';
            return NextResponse.json(
              {
                success: false,
                error: `Conflito de espaço: já existe aula de "${nomeModalidadeConflito}" neste horário. As modalidades compartilham o mesmo espaço físico.`
              },
              { status: 400 }
            );
          }
        }
      } catch (err) {
        console.warn('Erro ao verificar conflito de modalidades vinculadas:', err);
      }
    }
    // ========== FIM VERIFICAÇÃO DE CONFLITO ==========
    
    // Verificar se tem vaga no novo horário
    const matriculasNoNovoHorario = await Matricula.countDocuments({
      horarioFixoId: novoHorarioId,
      ativo: true,
      emEspera: { $ne: true }
    });
    
    const limiteAlunos = (novoHorario.modalidadeId as any)?.limiteAlunos || 0;
    if (limiteAlunos > 0 && matriculasNoNovoHorario >= limiteAlunos) {
      return NextResponse.json(
        { success: false, error: 'Não há vagas disponíveis neste horário' },
        { status: 400 }
      );
    }
    
    // Verificar se já existe solicitação pendente para este horário
    const solicitacaoExistente = await AlteracaoHorario.findOne({
      alunoId: aluno.id,
      horarioAtualId,
      status: 'pendente'
    });
    
    if (solicitacaoExistente) {
      return NextResponse.json(
        { success: false, error: 'Já existe uma solicitação pendente para este horário' },
        { status: 400 }
      );
    }
    
    // Criar solicitação de alteração
    const solicitacao = new AlteracaoHorario({
      alunoId: aluno.id,
      matriculaId: matriculaAtual._id,
      horarioAtualId,
      novoHorarioId,
      motivo: motivo || 'Solicitação de alteração de horário pelo aluno',
      status: 'pendente'
    });
    
    await solicitacao.save();
    
    return NextResponse.json({
      success: true,
      message: 'Solicitação de alteração de horário enviada! Aguarde a aprovação da administração.',
      solicitacao
    });
    
  } catch (error) {
    console.error('[API Alterar Horário POST] Erro:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao solicitar alteração de horário' },
      { status: 500 }
    );
  }
}

// DELETE - Cancelar solicitação pendente
export async function DELETE(req: NextRequest) {
  try {
    const aluno = await getAlunoFromToken();
    
    if (!aluno) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }
    
    const { searchParams } = new URL(req.url);
    const solicitacaoId = searchParams.get('id');
    
    if (!solicitacaoId) {
      return NextResponse.json(
        { success: false, error: 'ID da solicitação é obrigatório' },
        { status: 400 }
      );
    }
    
    await connectDB();
    
    const solicitacao = await AlteracaoHorario.findOne({
      _id: solicitacaoId,
      alunoId: aluno.id,
      status: 'pendente'
    });
    
    if (!solicitacao) {
      return NextResponse.json(
        { success: false, error: 'Solicitação não encontrada ou não pode ser cancelada' },
        { status: 404 }
      );
    }
    
    await AlteracaoHorario.deleteOne({ _id: solicitacaoId });
    
    return NextResponse.json({
      success: true,
      message: 'Solicitação cancelada com sucesso'
    });
    
  } catch (error) {
    console.error('[API Alterar Horário DELETE] Erro:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao cancelar solicitação' },
      { status: 500 }
    );
  }
}
