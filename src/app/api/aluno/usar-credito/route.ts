import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import connectDB from '@/lib/mongodb';
import CreditoReposicao from '@/models/CreditoReposicao';
import UsoCredito from '@/models/UsoCredito';
import { HorarioFixo } from '@/models/HorarioFixo';
import { Reagendamento } from '@/models/Reagendamento';
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

// POST - Solicitar uso de crédito (cria um reagendamento pendente)
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
    const { creditoId, horarioDestinoId, dataAula } = body;
    
    // Validações
    if (!creditoId || !horarioDestinoId || !dataAula) {
      return NextResponse.json(
        { success: false, error: 'Crédito, horário e data são obrigatórios' },
        { status: 400 }
      );
    }
    
    // Buscar o crédito
    const credito = await CreditoReposicao.findOne({
      _id: creditoId,
      alunoId: aluno.id,
      ativo: true
    });
    
    if (!credito) {
      return NextResponse.json(
        { success: false, error: 'Crédito não encontrado ou não pertence a você' },
        { status: 404 }
      );
    }
    
    // Verificar se tem créditos disponíveis
    const creditosDisponiveis = credito.quantidade - credito.quantidadeUsada;
    if (creditosDisponiveis <= 0) {
      return NextResponse.json(
        { success: false, error: 'Não há créditos disponíveis neste pacote' },
        { status: 400 }
      );
    }
    
    // Verificar se o crédito está válido (não expirado)
    if (new Date(credito.validade) <= new Date()) {
      return NextResponse.json(
        { success: false, error: 'Este crédito já expirou' },
        { status: 400 }
      );
    }
    
    // Verificar se a data é futura
    const [ano, mes, dia] = dataAula.split('-').map(Number);
    const dataAulaDate = new Date(ano, mes - 1, dia);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    if (dataAulaDate < hoje) {
      return NextResponse.json(
        { success: false, error: 'A data da aula deve ser futura' },
        { status: 400 }
      );
    }
    
    // Verificar se a data está dentro da validade do crédito
    const validadeDate = new Date(credito.validade);
    validadeDate.setHours(23, 59, 59, 999);
    
    if (dataAulaDate > validadeDate) {
      return NextResponse.json(
        { success: false, error: 'A data selecionada excede a validade do crédito' },
        { status: 400 }
      );
    }
    
    // Buscar o horário destino
    const horarioDestino = await HorarioFixo.findById(horarioDestinoId)
      .populate('modalidadeId', 'nome cor')
      .populate('professorId', 'nome');
    
    if (!horarioDestino) {
      return NextResponse.json(
        { success: false, error: 'Horário não encontrado' },
        { status: 404 }
      );
    }
    
    // Verificar se o dia da semana corresponde
    const diaSemanaData = dataAulaDate.getDay();
    if (horarioDestino.diaSemana !== diaSemanaData) {
      return NextResponse.json(
        { success: false, error: 'A data selecionada não corresponde ao dia da semana do horário' },
        { status: 400 }
      );
    }
    
    // Verificar se já existe solicitação pendente para esta data/horário
    const solicitacaoExistente = await Reagendamento.findOne({
      alunoId: aluno.id,
      novaData: dataAulaDate,
      novoHorarioFixoId: horarioDestinoId,
      status: 'pendente'
    });
    
    if (solicitacaoExistente) {
      return NextResponse.json(
        { success: false, error: 'Já existe uma solicitação pendente para este horário e data' },
        { status: 400 }
      );
    }
    
    // Criar uso do crédito
    const usoCredito = new UsoCredito({
      creditoId: credito._id,
      alunoId: aluno.id,
      agendamentoId: horarioDestinoId,
      dataUso: dataAulaDate,
      observacao: `Solicitação via área do aluno para ${dataAulaDate.toLocaleDateString('pt-BR')} às ${horarioDestino.horarioInicio}`
    });
    
    await usoCredito.save();
    
    // Incrementar quantidade usada
    await CreditoReposicao.findByIdAndUpdate(credito._id, {
      $inc: { quantidadeUsada: 1 }
    });
    
    // Criar reagendamento como reposição por crédito para aparecer na agenda do professor
    const reagendamento = new Reagendamento({
      horarioFixoId: horarioDestinoId,
      dataOriginal: new Date(), // Data atual como referência
      novaData: dataAulaDate,
      novoHorarioInicio: horarioDestino.horarioInicio,
      novoHorarioFim: horarioDestino.horarioFim,
      novoHorarioFixoId: horarioDestinoId,
      alunoId: aluno.id,
      professorOrigemId: horarioDestino.professorId?._id || null,
      motivo: `[Uso de Crédito] Crédito: ${credito.motivo}`,
      status: 'aprovado', // Créditos já são pré-aprovados
      isReposicao: true,
      usoCreditoId: usoCredito._id,
      solicitadoPor: 'aluno'
    });
    
    await reagendamento.save();
    
    return NextResponse.json({
      success: true,
      message: 'Crédito utilizado com sucesso! Sua aula de reposição foi agendada.',
      usoCredito,
      reagendamento
    });
    
  } catch (error) {
    console.error('[API Aluno Usar Crédito] Erro:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao usar crédito' },
      { status: 500 }
    );
  }
}
