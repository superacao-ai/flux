import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import AulaRealizada from '@/models/AulaRealizada';
import { Reagendamento } from '@/models/Reagendamento';
import Feriado from '@/models/Feriado';
import { getFeriadosNacionais } from '@/lib/feriados';
import mongoose from 'mongoose';

// GET /api/alunos/[id]/faltas - Buscar faltas de um aluno com status de reposição
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    
    const { id: alunoId } = await params;
    
    if (!alunoId || !mongoose.Types.ObjectId.isValid(alunoId)) {
      return NextResponse.json(
        { success: false, error: 'ID do aluno inválido' },
        { status: 400 }
      );
    }

    // Buscar feriados para exclusão
    const feriadosPersonalizados = await Feriado.find({}).lean();
    const anoAtual = new Date().getFullYear();
    const feriadosNacionais = getFeriadosNacionais(anoAtual);
    
    // Criar set de datas de feriados (formato YYYY-MM-DD)
    const feriadosSet = new Set<string>();
    for (const f of feriadosPersonalizados) {
      const d = new Date(f.data);
      feriadosSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }
    for (const f of feriadosNacionais) {
      const d = new Date(f.data);
      feriadosSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }

    const alunoObjectId = new mongoose.Types.ObjectId(alunoId);

    // 1) Buscar todas as aulas onde o aluno teve falta (presente === false)
    const aulasComFalta = await AulaRealizada.find({
      'alunos.alunoId': alunoObjectId,
      'alunos': {
        $elemMatch: {
          alunoId: alunoObjectId,
          presente: false
        }
      }
    })
    .populate('horarioFixoId', 'horarioInicio horarioFim diaSemana')
    .populate('professorId', 'nome cor')
    .sort({ data: -1 })
    .lean();

    // 2) Buscar todas as reposições (isReposicao=true) para este aluno
    const reposicoes = await Reagendamento.find({
      alunoId: alunoObjectId,
      isReposicao: true
    }).lean();

    // Criar um mapa de reposições por aulaRealizadaId
    const reposicoesMap = new Map<string, any>();
    for (const rep of reposicoes) {
      if (rep.aulaRealizadaId) {
        reposicoesMap.set(String(rep.aulaRealizadaId), rep);
      }
    }

    // 3) Montar resposta com status de cada falta
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const faltas = aulasComFalta
      .filter((aula: any) => {
        // Excluir faltas em feriados
        const dataFalta = new Date(aula.data);
        const dataKey = `${dataFalta.getFullYear()}-${String(dataFalta.getMonth() + 1).padStart(2, '0')}-${String(dataFalta.getDate()).padStart(2, '0')}`;
        return !feriadosSet.has(dataKey);
      })
      .map((aula: any) => {
      const dataFalta = new Date(aula.data);
      dataFalta.setHours(0, 0, 0, 0);
      
      // Calcular prazo de 7 dias
      const prazoFinal = new Date(dataFalta);
      prazoFinal.setDate(prazoFinal.getDate() + 7);
      
      const diasRestantes = Math.ceil((prazoFinal.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
      const dentroDoPrazo = diasRestantes > 0;
      
      // Verificar se já existe reposição
      const reposicao = reposicoesMap.get(String(aula._id));
      
      let statusReposicao: 'disponivel' | 'pendente' | 'aprovada' | 'rejeitada' | 'expirada' = 'disponivel';
      
      if (reposicao) {
        if (reposicao.status === 'aprovado') {
          statusReposicao = 'aprovada';
        } else if (reposicao.status === 'pendente') {
          statusReposicao = 'pendente';
        } else if (reposicao.status === 'rejeitado') {
          statusReposicao = 'rejeitada';
        }
      } else if (!dentroDoPrazo) {
        statusReposicao = 'expirada';
      }

      return {
        _id: aula._id,
        aulaRealizadaId: aula._id,
        data: aula.data,
        dataFormatada: new Date(aula.data).toLocaleDateString('pt-BR'),
        modalidade: aula.modalidade,
        horarioInicio: aula.horarioInicio,
        horarioFim: aula.horarioFim,
        horarioFixoId: aula.horarioFixoId?._id || aula.horarioFixoId,
        professorNome: aula.professorId?.nome || 'Não informado',
        professorCor: aula.professorId?.cor,
        // Status da reposição
        statusReposicao,
        diasRestantes: Math.max(0, diasRestantes),
        dentroDoPrazo,
        prazoFinal: prazoFinal.toLocaleDateString('pt-BR'),
        // Dados da reposição se existir
        reposicao: reposicao ? {
          _id: reposicao._id,
          status: reposicao.status,
          novaData: reposicao.novaData,
          novoHorarioInicio: reposicao.novoHorarioInicio,
          novoHorarioFim: reposicao.novoHorarioFim,
        } : null
      };
    });

    // Resumo
    const resumo = {
      totalFaltas: faltas.length,
      disponiveis: faltas.filter(f => f.statusReposicao === 'disponivel').length,
      pendentes: faltas.filter(f => f.statusReposicao === 'pendente').length,
      aprovadas: faltas.filter(f => f.statusReposicao === 'aprovada').length,
      expiradas: faltas.filter(f => f.statusReposicao === 'expirada').length,
    };

    return NextResponse.json({
      success: true,
      data: faltas,
      resumo
    });

  } catch (error: any) {
    console.error('Erro ao buscar faltas do aluno:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
