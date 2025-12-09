import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import connectDB from '@/lib/mongodb';
import CreditoReposicao from '@/models/CreditoReposicao';
import UsoCredito from '@/models/UsoCredito';
import { User } from '@/models/User';
import { HorarioFixo } from '@/models/HorarioFixo';

const JWT_SECRET = process.env.JWT_SECRET || 'sua_chave_secreta_super_forte';

async function isAdmin() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    
    if (!token) return false;
    
    const decoded = jwt.verify(token, JWT_SECRET) as { userId?: string; id?: string; tipo: string };
    const tipoLower = decoded.tipo?.toLowerCase() || '';
    return tipoLower === 'adm' || tipoLower === 'professor' || tipoLower === 'root' || tipoLower === 'admin';
  } catch (error) {
    console.error('[API Créditos] Erro ao verificar admin:', error);
    return false;
  }
}

async function getUserId() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    
    if (!token) return null;
    
    const decoded = jwt.verify(token, JWT_SECRET) as { userId?: string; id?: string };
    return decoded.userId || decoded.id || null;
  } catch (error) {
    return null;
  }
}

// GET - Listar créditos (com filtros opcionais)
export async function GET(req: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    await connectDB();

    const searchParams = req.nextUrl.searchParams;
    const alunoId = searchParams.get('alunoId');
    const somenteAtivos = searchParams.get('ativos') === 'true';
    const somenteValidos = searchParams.get('validos') === 'true';
    const somenteDisponiveis = searchParams.get('disponiveis') === 'true';

    const filter: any = {};

    if (alunoId) {
      filter.alunoId = alunoId;
    }

    if (somenteAtivos) {
      filter.ativo = true;
    }

    if (somenteValidos) {
      filter.validade = { $gt: new Date() };
    }

    const creditos = await CreditoReposicao.find(filter)
      .populate('alunoId', 'nome email')
      .populate('modalidadeId', 'nome cor')
      .populate('concedidoPor', 'nome email')
      .sort({ criadoEm: -1 })
      .lean() as any[];

    // Buscar todos os usos de créditos
    const creditoIds = creditos.map(c => c._id);
    const usos = await UsoCredito.find({ creditoId: { $in: creditoIds } })
      .sort({ dataUso: -1 })
      .lean() as any[];

    // Buscar horários para popular manualmente os usos
    const agendamentoIds = usos
      .filter(u => u.agendamentoId)
      .map(u => u.agendamentoId);
    
    const horarios = await HorarioFixo.find({ _id: { $in: agendamentoIds } })
      .populate({ path: 'professorId', model: 'User', select: 'nome cor' })
      .populate('modalidadeId', 'nome cor')
      .lean() as any[];
    
    const horariosMap = new Map(horarios.map(h => [h._id.toString(), h]));

    // Mapear usos por creditoId com horários populados
    const usosPorCredito: Record<string, any[]> = {};
    for (const uso of usos) {
      const creditoIdStr = uso.creditoId.toString();
      if (!usosPorCredito[creditoIdStr]) {
        usosPorCredito[creditoIdStr] = [];
      }
      
      const usoComHorario = {
        ...uso,
        agendamentoId: uso.agendamentoId ? horariosMap.get(uso.agendamentoId.toString()) : null
      };
      
      usosPorCredito[creditoIdStr].push(usoComHorario);
    }

    // Adicionar usos a cada crédito
    const creditosComUsos = creditos.map(c => ({
      ...c,
      usos: usosPorCredito[c._id.toString()] || []
    }));

    // Filtrar créditos com alunoId válido (aluno pode ter sido excluído)
    let creditosFiltrados = creditosComUsos.filter(
      (c: any) => c.alunoId && c.alunoId._id && c.alunoId.nome
    );
    
    // Filtrar apenas com créditos disponíveis se solicitado
    if (somenteDisponiveis) {
      creditosFiltrados = creditosFiltrados.filter(
        (c: any) => (c.quantidade - c.quantidadeUsada) > 0
      );
    }

    return NextResponse.json(creditosFiltrados);
  } catch (error) {
    console.error('Erro ao buscar créditos:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar créditos' },
      { status: 500 }
    );
  }
}

// POST - Conceder novos créditos
export async function POST(req: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Usuário não identificado' }, { status: 401 });
    }

    await connectDB();

    const body = await req.json();
    const { alunoId, quantidade, modalidadeId, motivo, validade } = body;

    // Validações
    if (!alunoId || !quantidade || !motivo || !validade) {
      return NextResponse.json(
        { error: 'Dados incompletos' },
        { status: 400 }
      );
    }

    if (quantidade < 1) {
      return NextResponse.json(
        { error: 'Quantidade mínima é 1' },
        { status: 400 }
      );
    }

    const dataValidade = new Date(validade);
    if (dataValidade <= new Date()) {
      return NextResponse.json(
        { error: 'Validade deve ser uma data futura' },
        { status: 400 }
      );
    }

    const novoCredito = await CreditoReposicao.create({
      alunoId,
      quantidade,
      quantidadeUsada: 0,
      modalidadeId: modalidadeId || undefined,
      motivo,
      validade: dataValidade,
      concedidoPor: userId,
      ativo: true
    });

    const creditoPopulado = await CreditoReposicao.findById(novoCredito._id)
      .populate('alunoId', 'nome email')
      .populate('modalidadeId', 'nome cor')
      .populate('concedidoPor', 'nome email')
      .lean();

    return NextResponse.json(creditoPopulado, { status: 201 });
  } catch (error) {
    console.error('Erro ao conceder crédito:', error);
    return NextResponse.json(
      { error: 'Erro ao conceder crédito' },
      { status: 500 }
    );
  }
}

// DELETE - Remover crédito
export async function DELETE(req: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    await connectDB();

    const searchParams = req.nextUrl.searchParams;
    const id = searchParams.get('id');
    const aulaRealizadaId = searchParams.get('aulaRealizadaId');

    // Se for por aulaRealizadaId, deletar todos os créditos associados
    if (aulaRealizadaId) {
      const resultado = await CreditoReposicao.deleteMany({ aulaRealizadaId });
      return NextResponse.json({ 
        message: `${resultado.deletedCount} crédito(s) removido(s)`,
        deletedCount: resultado.deletedCount
      });
    }

    if (!id) {
      return NextResponse.json(
        { error: 'ID do crédito é obrigatório' },
        { status: 400 }
      );
    }

    const credito = await CreditoReposicao.findById(id);
    if (!credito) {
      return NextResponse.json(
        { error: 'Crédito não encontrado' },
        { status: 404 }
      );
    }

    // Verifica se o crédito já foi usado
    if (credito.quantidadeUsada > 0) {
      // Apenas desativa, não remove
      await CreditoReposicao.findByIdAndUpdate(id, { ativo: false });
      return NextResponse.json({ 
        message: 'Crédito desativado (possui usos registrados)'
      });
    }

    // Se nunca foi usado, pode remover completamente
    await CreditoReposicao.findByIdAndDelete(id);

    return NextResponse.json({ 
      message: 'Crédito removido com sucesso' 
    });
  } catch (error) {
    console.error('Erro ao remover crédito:', error);
    return NextResponse.json(
      { error: 'Erro ao remover crédito' },
      { status: 500 }
    );
  }
}
