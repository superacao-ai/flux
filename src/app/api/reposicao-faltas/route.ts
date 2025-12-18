import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import AulaRealizada from '@/models/AulaRealizada';
import { Reagendamento } from '@/models/Reagendamento';
import { Aluno } from '@/models/Aluno';
import Feriado from '@/models/Feriado';
import { getFeriadosNacionais } from '@/lib/feriados';

// GET /api/reposicao-faltas - Buscar todas as faltas de todos os alunos com status de reposição
export async function GET(request: NextRequest) {
  try {
    await connectDB();

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

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    // 1) Buscar todas as aulas com pelo menos uma falta
    const aulasComFalta = await AulaRealizada.find({
      'alunos': {
        $elemMatch: {
          presente: false
        }
      }
    })
    .populate({
      path: 'horarioFixoId',
      select: 'horarioInicio horarioFim diaSemana modalidadeId',
      populate: {
        path: 'modalidadeId',
        select: 'nome cor'
      }
    })
    .populate({
      path: 'professorId',
      model: 'User',
      select: 'nome cor'
    })
    .sort({ data: -1 })
    .lean();

    // 2) Buscar todos os alunos para ter os nomes
    const alunosData = await Aluno.find({}).select('nome email ativo').lean();
    const alunosMap = new Map((alunosData as any[]).map((a: any) => [a._id.toString(), a]));

    // 3) Buscar todas as reposições
    const reposicoes = await Reagendamento.find({
      isReposicao: true
    }).lean();

    // Criar um mapa de reposições por aulaRealizadaId + alunoId
    // TAMBÉM criar por alunoId + dataOriginal para capturar reposições de avisos de ausência
    const reposicoesMap = new Map<string, any>();
    for (const rep of reposicoes) {
      // Mapear por aulaRealizadaId + alunoId (quando vem de falta registrada)
      if (rep.aulaRealizadaId && rep.alunoId) {
        const aulaId = typeof rep.aulaRealizadaId === 'string' ? rep.aulaRealizadaId : rep.aulaRealizadaId.toString();
        const alunoId = typeof rep.alunoId === 'string' ? rep.alunoId : rep.alunoId.toString();
        const key = `${aulaId}_${alunoId}`;
        reposicoesMap.set(key, rep);
      }
      // NOVO: Mapear também por alunoId + dataOriginal (para avisos de ausência)
      if (rep.alunoId && rep.dataOriginal) {
        try {
          const alunoId = typeof rep.alunoId === 'string' ? rep.alunoId : rep.alunoId.toString();
          const dataStr = new Date(rep.dataOriginal).toISOString().split('T')[0];
          const key2 = `${alunoId}_${dataStr}`;
          if (!reposicoesMap.has(key2)) {
            reposicoesMap.set(key2, rep);
          }
        } catch (e) {
          // Ignorar se houver erro na conversão de data
        }
      }
    }

    // 4) Extrair cada falta individual (aluno + aula)
    const faltas: any[] = [];

    for (const aula of aulasComFalta as any[]) {
      const dataFalta = new Date(aula.data);
      dataFalta.setHours(0, 0, 0, 0);
      
      // NOVO: Verificar se a data é feriado - pular se for
      const dataKey = `${dataFalta.getFullYear()}-${String(dataFalta.getMonth() + 1).padStart(2, '0')}-${String(dataFalta.getDate()).padStart(2, '0')}`;
      if (feriadosSet.has(dataKey)) {
        continue; // Pular faltas em feriados
      }
      
      // Calcular prazo de 7 dias
      const prazoFinal = new Date(dataFalta);
      prazoFinal.setDate(prazoFinal.getDate() + 7);
      
      const diasRestantes = Math.ceil((prazoFinal.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
      const dentroDoPrazo = diasRestantes > 0;

      // Para cada aluno que faltou nesta aula
      for (const alunoAula of aula.alunos || []) {
        if (alunoAula.presente === false) {
          const alunoId = alunoAula.alunoId?.toString() || alunoAula.alunoId;
          const aluno = alunosMap.get(alunoId);
          
          if (!aluno) continue; // Aluno não encontrado (pode ter sido excluído)

          // Verificar se já existe reposição para esta falta específica
          const repoKey = `${aula._id}_${alunoId}`;
          const dataStr = typeof aula.data === 'string' 
            ? aula.data.split('T')[0] 
            : new Date(aula.data).toISOString().split('T')[0];
          const repoKey2 = `${alunoId}_${dataStr}`;
          const reposicao = reposicoesMap.get(repoKey) || reposicoesMap.get(repoKey2);

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

          faltas.push({
            _id: `${aula._id}_${alunoId}`, // ID único para cada falta
            aulaRealizadaId: aula._id,
            alunoId: {
              _id: aluno._id,
              nome: aluno.nome,
              email: aluno.email,
              ativo: aluno.ativo
            },
            data: aula.data,
            dataFormatada: (() => {
              if (typeof aula.data === 'string') {
                const str = aula.data.split('T')[0];
                const [ano, mes, dia] = str.split('-').map(Number);
                const d = new Date(ano, mes - 1, dia, 12, 0, 0);
                return d.toLocaleDateString('pt-BR');
              } else {
                const d = new Date(aula.data);
                const str = d.toISOString().split('T')[0];
                const [ano, mes, dia] = str.split('-').map(Number);
                const d2 = new Date(ano, mes - 1, dia, 12, 0, 0);
                return d2.toLocaleDateString('pt-BR');
              }
            })(),
            modalidade: aula.modalidade,
            modalidadeCor: (aula.horarioFixoId as any)?.modalidadeId?.cor || '#999999',
            horarioInicio: aula.horarioInicio,
            horarioFim: aula.horarioFim,
            horarioFixoId: aula.horarioFixoId?._id || aula.horarioFixoId,
            professorId: aula.professorId ? {
              _id: aula.professorId._id,
              nome: aula.professorId.nome,
              cor: aula.professorId.cor
            } : null,
            professorNome: aula.professorId?.nome || 'Não informado',
            // Status da reposição
            statusReposicao,
            diasRestantes: Math.max(0, diasRestantes),
            dentroDoPrazo,
            prazoFinal: prazoFinal.toLocaleDateString('pt-BR'),
            prazoFinalDate: prazoFinal,
            // Dados da reposição se existir
            reposicao: reposicao ? {
              _id: reposicao._id,
              status: reposicao.status,
              novaData: reposicao.novaData,
              novoHorarioInicio: reposicao.novoHorarioInicio,
              novoHorarioFim: reposicao.novoHorarioFim,
              horarioFixoId: reposicao.horarioFixoId,
            } : null
          });
        }
      }
    }

    // Ordenar por data mais recente primeiro
    faltas.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

    // Resumo geral
    const resumo = {
      totalFaltas: faltas.length,
      disponiveis: faltas.filter(f => f.statusReposicao === 'disponivel').length,
      pendentes: faltas.filter(f => f.statusReposicao === 'pendente').length,
      aprovadas: faltas.filter(f => f.statusReposicao === 'aprovada').length,
      expiradas: faltas.filter(f => f.statusReposicao === 'expirada').length,
      rejeitadas: faltas.filter(f => f.statusReposicao === 'rejeitada').length,
    };

    return NextResponse.json({
      success: true,
      data: faltas,
      resumo
    });

  } catch (error: any) {
    console.error('Erro ao buscar faltas:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
