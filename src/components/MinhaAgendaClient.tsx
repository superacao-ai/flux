'use client';

import { useEffect, useState } from 'react';

// Tipos
interface Aluno {
  _id: string;
  nome: string;
  email?: string;
  telefone?: string;
  modalidadeId?: {
    _id: string;
    nome: string;
    cor: string;
  };
  congelado?: boolean;
  ausente?: boolean;
  emEspera?: boolean;
  observacoes?: string;
  periodoTreino?: string;
  parceria?: string;
}

interface Presenca {
  _id?: string;
  alunoId: string;
  horarioFixoId: string;
  data: string;
  presente: boolean;
  observacoes?: string;
}

interface AulaStatus {
  enviada: boolean;
  status?: 'pendente' | 'enviada' | 'corrigida';
  total_alunos?: number;
  total_presentes?: number;
  total_faltas?: number;
}

interface Modalidade {
  _id: string;
  nome: string;
  cor: string;
}

interface HorarioFixo {
  _id: string;
  diaSemana: number;
  horarioInicio: string;
  horarioFim: string;
  ativo: boolean;
  alunoId?: Aluno | null;
  alunos?: Aluno[]; // Alunos vindos das matrículas
  modalidadeId?: Modalidade | null;
  congelado?: boolean;
  ausente?: boolean;
  emEspera?: boolean;
  observacoes?: string;
}

interface HorarioAgrupado {
  diaSemana: number;
  horarioInicio: string;
  horarioFim: string;
  modalidade: Modalidade;
  alunos: Aluno[];
  horarioFixoId?: string; // ID do primeiro horário fixo do grupo
}

interface Reagendamento {
  _id: string;
  dataOriginal: string;
  novaData: string;
  novoHorarioInicio: string;
  novoHorarioFim: string;
  status: string;
  horarioFixoId: {
    _id: string;
    diaSemana: number;
    horarioInicio: string;
    horarioFim: string;
    alunoId?: {
      _id: string;
      nome: string;
      email?: string;
    };
  };
  novoHorarioFixoId?: {
    _id: string;
    diaSemana: number;
    horarioInicio: string;
    horarioFim: string;
    professorId: any;
  };
  matriculaId?: {
    alunoId: {
      _id: string;
      nome: string;
      email?: string;
    };
  };
}

export default function MinhaAgendaClient() {
  const [horarios, setHorarios] = useState<HorarioFixo[]>([]);
  const [reagendamentos, setReagendamentos] = useState<Reagendamento[]>([]);
  const [presencas, setPresencas] = useState<Presenca[]>([]); // Rascunho local
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dataSelecionada, setDataSelecionada] = useState(new Date());
  const [aulaStatus, setAulaStatus] = useState<Map<string, AulaStatus>>(new Map());
  const [enviandoAula, setEnviandoAula] = useState(false);
  const [horariosExpandidos, setHorariosExpandidos] = useState<Set<string>>(new Set());

  // Encontrar próximo dia com horários
  const encontrarProximoDiaComHorarios = (listaHorarios: HorarioFixo[], dataInicial: Date): Date => {
    const hoje = new Date(dataInicial);
    const diaAtual = hoje.getDay();
    
    // Verificar se hoje tem horários
    const temHojeAtivo = listaHorarios.some(h => h.diaSemana === diaAtual && h.ativo);
    if (temHojeAtivo) return hoje;
    
    // Procurar nos próximos 7 dias
    for (let i = 1; i <= 7; i++) {
      const novaData = new Date(hoje);
      novaData.setDate(hoje.getDate() + i);
      const novoDia = novaData.getDay();
      
      const temHorario = listaHorarios.some(h => h.diaSemana === novoDia && h.ativo);
      if (temHorario) return novaData;
    }
    
    return hoje; // Se não achar, volta para hoje
  };

  // Buscar horários do professor
  useEffect(() => {
    const fetchHorarios = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        
        const res = await fetch('/api/me/horarios', {
          headers: { Authorization: token ? `Bearer ${token}` : '' }
        });

        if (!res.ok) throw new Error('Erro ao buscar horários');
        
        const data = await res.json();
        
        const list = Array.isArray(data) ? data : (data.data || []);
        
        setHorarios(list);
        
        // Ajustar data para o próximo dia com horários
        if (list.length > 0) {
          const proximoDia = encontrarProximoDiaComHorarios(list, new Date());
          setDataSelecionada(proximoDia);
        }
      } catch (err: any) {
        console.error('[MinhaAgenda] Erro ao buscar horários:', err);
        setError(err.message || 'Erro ao carregar agenda');
      } finally {
        setLoading(false);
      }
    };

    fetchHorarios();
  }, []);

  // Buscar reagendamentos
  useEffect(() => {
    const fetchReagendamentos = async () => {
      try {
        const res = await fetch('/api/reagendamentos');
        
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : (data.data || []);
          const aprovados = list.filter((r: Reagendamento) => r.status === 'aprovado');
          
          setReagendamentos(aprovados);
        }
      } catch (err) {
        console.error('[MinhaAgenda] Erro ao buscar reagendamentos:', err);
      }
    };

    fetchReagendamentos();
  }, []);

  // Buscar presenças do dia selecionado
  useEffect(() => {
    const fetchPresencas = async () => {
      if (!dataSelecionada) return;
      
      try {
        const dataFormatada = dataSelecionada.toISOString().split('T')[0];
        const res = await fetch(`/api/presencas?data=${dataFormatada}`);
        
        if (res.ok) {
          const data = await res.json();
          setPresencas(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('[MinhaAgenda] Erro ao buscar presenças:', err);
      }
    };

    fetchPresencas();
  }, [dataSelecionada]);

  // Buscar status de aulas do dia
  useEffect(() => {
    const fetchAulasStatus = async () => {
      if (!dataSelecionada || horarios.length === 0) return;
      
      try {
        const dataFormatada = dataSelecionada.toISOString().split('T')[0];
        const statuses = new Map<string, AulaStatus>();
        
        // Buscar status de cada horário
        for (const horario of horarios) {
          if (horario.diaSemana === dataSelecionada.getDay() && horario.ativo) {
            const res = await fetch(
              `/api/aulas-realizadas?horarioFixoId=${horario._id}&data=${dataFormatada}`
            );
            
            if (res.ok) {
              const data = await res.json();
              statuses.set(horario._id, data);
            }
          }
        }
        
        setAulaStatus(statuses);
      } catch (err) {
        console.error('[MinhaAgenda] Erro ao buscar status das aulas:', err);
      }
    };

    fetchAulasStatus();
  }, [dataSelecionada, horarios]);

  // Agrupar horários por dia/hora e juntar todos os alunos
  const agruparHorarios = (horariosList: HorarioFixo[], diaSemana: number): HorarioAgrupado[] => {
    const grupos = new Map<string, HorarioAgrupado>();

    horariosList
      .filter(h => h.diaSemana === diaSemana && h.ativo)
      .forEach(h => {
        const key = `${h.horarioInicio}-${h.horarioFim}`;
        
        if (!grupos.has(key)) {
          // Pegar modalidade do horário ou do aluno
          let modalidade: Modalidade;
          if (h.modalidadeId && typeof h.modalidadeId === 'object') {
            modalidade = h.modalidadeId;
          } else if (h.alunoId && typeof h.alunoId === 'object' && h.alunoId.modalidadeId) {
            modalidade = h.alunoId.modalidadeId;
          } else {
            modalidade = { _id: '', nome: 'Sem modalidade', cor: '#6B7280' };
          }

          grupos.set(key, {
            diaSemana,
            horarioInicio: h.horarioInicio,
            horarioFim: h.horarioFim,
            modalidade,
            alunos: [],
            horarioFixoId: h._id
          });
        }

        // Adicionar aluno(s) se existir
        // Priorizar campo 'alunos' (matrículas) sobre 'alunoId' (legado)
        if (h.alunos && Array.isArray(h.alunos) && h.alunos.length > 0) {
          h.alunos.forEach(aluno => {
            if (aluno && typeof aluno === 'object') {
              grupos.get(key)!.alunos.push(aluno);
            }
          });
        } else if (h.alunoId && typeof h.alunoId === 'object') {
          grupos.get(key)!.alunos.push(h.alunoId);
        }
      });

    // Ordenar por horário
    return Array.from(grupos.values()).sort((a, b) => 
      a.horarioInicio.localeCompare(b.horarioInicio)
    );
  };

  // Calcular dia da semana da data selecionada
  const diaSemana = dataSelecionada.getDay();
  const horariosAgrupados = agruparHorarios(horarios, diaSemana);

  // Filtrar reagendamentos para a data selecionada
  const dataFormatada = dataSelecionada.toISOString().split('T')[0];
  
  // Reagendamentos que TÊM DESTINO nesta data (alunos vindo de outros dias)
  const reagendamentosParaDentro = reagendamentos.filter(r => {
    if (!r.novaData) return false;
    const reagData = r.novaData.split('T')[0];
    return reagData === dataFormatada;
  });
  
  // Reagendamentos que TÊM ORIGEM nesta data (alunos saindo para outros dias)
  const reagendamentosParaFora = reagendamentos.filter(r => {
    if (!r.dataOriginal) return false;
    const reagData = r.dataOriginal.split('T')[0];
    return reagData === dataFormatada;
  });

  // Função para verificar se um aluno foi reagendado PARA FORA deste horário
  const alunoReagendadoParaFora = (alunoId: string, horarioId?: string) => {
    if (!horarioId) return null;
    return reagendamentosParaFora.find(r => {
      const rAlunoId = r.horarioFixoId?.alunoId?._id || r.matriculaId?.alunoId?._id;
      return rAlunoId === alunoId && r.horarioFixoId?._id === horarioId;
    });
  };

  // Função para buscar alunos reagendados PARA DENTRO deste horário  
  const alunosReagendadosParaDentro = (horarioId?: string) => {
    if (!horarioId) return [];
    return reagendamentosParaDentro
      .filter(r => r.novoHorarioFixoId?._id === horarioId)
      .map(r => {
        const aluno = r.horarioFixoId?.alunoId || r.matriculaId?.alunoId;
        return {
          _id: aluno?._id || '',
          nome: aluno?.nome || 'Aluno',
          email: aluno?.email,
          _reagendamento: r
        };
      })
      .filter(a => a._id); // Remover alunos inválidos
  };

  // Calcular estatísticas do dia
  const calcularEstatisticas = () => {
    let totalAlunos = 0;
    let alunosAtivos = 0;
    let alunosCongelados = 0;
    let alunosAusentes = 0;
    let alunosEmEspera = 0;
    let alunosReagendadosOut = 0;
    let alunosReagendadosIn = 0;

    horariosAgrupados.forEach(horario => {
      // Contar alunos regulares
      horario.alunos.forEach(aluno => {
        const foiReagendado = alunoReagendadoParaFora(aluno._id, horario.horarioFixoId);
        
        if (foiReagendado) {
          alunosReagendadosOut++;
        } else if (aluno.congelado) {
          alunosCongelados++;
        } else if (aluno.ausente) {
          alunosAusentes++;
        } else if (aluno.emEspera) {
          alunosEmEspera++;
        } else {
          alunosAtivos++;
          totalAlunos++; // Contar apenas alunos ativos
        }
      });

      // Contar reagendados para dentro
      const reagIn = alunosReagendadosParaDentro(horario.horarioFixoId);
      alunosReagendadosIn += reagIn.length;
      alunosAtivos += reagIn.length;
      totalAlunos += reagIn.length; // Contar reagendados que chegam
    });

    return {
      totalAlunos,
      alunosAtivos,
      alunosCongelados,
      alunosAusentes,
      alunosEmEspera,
      alunosReagendadosOut,
      alunosReagendadosIn
    };
  };

  const stats = calcularEstatisticas();

  // Enviar aula finalizada
  const enviarAula = async (horarioFixoId: string) => {
    if (enviandoAula) return;
    
    setEnviandoAula(true);

    try {
      const dataFormatada = dataSelecionada.toISOString().split('T')[0];
      const token = localStorage.getItem('token');
      
      if (!token) {
        alert('Sessão expirada. Por favor, faça login novamente.');
        setEnviandoAula(false);
        return;
      }

      // Montar dados de alunos marcados (incluindo inativos com justificativa)
      const alunos_marcados = horariosAgrupados
        .filter(h => h.horarioFixoId === horarioFixoId)
        .flatMap(h => 
          h.alunos
            .filter(a => !alunoReagendadoParaFora(a._id, h.horarioFixoId))
            .map(a => {
              // Se for aluno ativo, usar marcação de presença
              if (!a.emEspera && !a.ausente && !a.congelado) {
                return {
                  alunoId: a._id,
                  presente: getPresencaStatus(a._id, h.horarioFixoId || '') ?? null,
                  observacoes: '',
                };
              }
              
              // Se for aluno inativo, usar justificativa
              let justificativa = '';
              if (a.congelado) justificativa = 'congelado';
              else if (a.ausente) justificativa = 'ausente';
              else if (a.emEspera) justificativa = 'em_espera';
              
              return {
                alunoId: a._id,
                presente: null,
                observacoes: justificativa,
              };
            })
        );

      // Montar dados de reagendados
      const reagendamentos_marcados = horariosAgrupados
        .filter(h => h.horarioFixoId === horarioFixoId)
        .flatMap(h => {
          const reags = alunosReagendadosParaDentro(h.horarioFixoId);
          return reags.map(r => ({
            reagendamentoId: (r as any)._reagendamento?._id,
            presente: getPresencaStatus(r._id, h.horarioFixoId || '') ?? null,
            observacoes: '',
          }));
        });

      console.log('Enviando aula:', {
        horarioFixoId,
        data: dataFormatada,
        alunos_marcados,
        reagendamentos_marcados,
      });

      const res = await fetch('/api/aulas-realizadas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          horarioFixoId,
          data: dataFormatada,
          alunos_marcados,
          reagendamentos_marcados,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        // Atualizar status de aula
        setAulaStatus(prev => {
          const newMap = new Map(prev);
          newMap.set(horarioFixoId, {
            enviada: true,
            status: 'enviada',
            total_alunos: data.aulaRealizada.total_alunos,
            total_presentes: data.aulaRealizada.total_presentes,
            total_faltas: data.aulaRealizada.total_faltas,
          });
          return newMap;
        });

        alert('Aula enviada com sucesso!');
      } else {
        console.error('Erro na API:', data);
        console.error('Status:', res.status);
        console.error('Response completo:', res);
        alert(`Erro ao enviar aula: ${data.error || 'Erro desconhecido'}\n\nDetalhes: ${data.details || ''}\n\nStack: ${data.stack || ''}`);
      }
    } catch (err) {
      console.error('Erro ao enviar aula:', err);
      alert(`Erro ao enviar aula: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
    } finally {
      setEnviandoAula(false);
    }
  };

  // Marcar presença/falta (apenas local, sem salvar ainda)
  const marcarPresenca = (alunoId: string, horarioFixoId: string, presente: boolean) => {
    setPresencas(prev => {
      const index = prev.findIndex(
        p => String(p.alunoId) === String(alunoId) && String(p.horarioFixoId) === String(horarioFixoId)
      );
      
      if (index >= 0) {
        // Já existe, atualizar
        const updated = [...prev];
        updated[index].presente = presente;
        return updated;
      } else {
        // Novo registro
        const dataFormatada = dataSelecionada.toISOString().split('T')[0];
        return [...prev, {
          alunoId,
          horarioFixoId,
          data: dataFormatada,
          presente,
        }];
      }
    });
  };

  // Verificar status de presença de um aluno
  const getPresencaStatus = (alunoId: string, horarioFixoId: string): boolean | null => {
    if (!alunoId || !horarioFixoId) return null;
    
    const presenca = presencas.find(
      p => String(p.alunoId) === String(alunoId) && String(p.horarioFixoId) === String(horarioFixoId)
    );
    
    return presenca ? presenca.presente : null;
  };

  // Calcular estatísticas de presença por horário
  const calcularPresencasHorario = (horario: HorarioAgrupado) => {
    let presentes = 0;
    let faltas = 0;
    let naoRegistrado = 0;
    let total = 0;

    horario.alunos.forEach(aluno => {
      // Ignorar alunos inativos (em espera, parou de vir, congelado)
      if (aluno.emEspera || aluno.ausente || aluno.congelado) {
        return;
      }
      
      total++;
      const status = getPresencaStatus(aluno._id, horario.horarioFixoId || '');
      if (status === true) presentes++;
      else if (status === false) faltas++;
      else naoRegistrado++;
    });

    return { presentes, faltas, naoRegistrado, total };
  };

  // Dias da semana
  const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

  // Toggle para expandir/recolher horários
  const toggleHorario = (horarioFixoId: string) => {
    setHorariosExpandidos(prev => {
      if (prev.has(horarioFixoId)) {
        // Se já está aberto, fecha
        const novo = new Set(prev);
        novo.delete(horarioFixoId);
        return novo;
      } else {
        // Se está fechado, abre este e fecha os outros
        return new Set([horarioFixoId]);
      }
    });
  };

  // Navegar entre dias (apenas dias com horários)
  const mudarDia = (direcao: number) => {
    const dataAtual = new Date(dataSelecionada);
    let tentativas = 0;
    const maxTentativas = 7; // Procurar nos próximos 7 dias
    
    while (tentativas < maxTentativas) {
      dataAtual.setDate(dataAtual.getDate() + direcao);
      const novoDia = dataAtual.getDay();
      
      // Verificar se tem horários ativos neste dia
      const temHorarios = horarios.some(h => h.diaSemana === novoDia && h.ativo);
      
      if (temHorarios) {
        setDataSelecionada(new Date(dataAtual));
        return;
      }
      
      tentativas++;
    }
  };

  // Formatar data
  const formatarData = (data: Date) => {
    return data.toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">
          <i className="fas fa-spinner fa-spin text-3xl text-primary-600 mb-3"></i>
          <p className="text-gray-600">Carregando sua agenda...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-800">
            <i className="fas fa-exclamation-circle"></i>
            <span className="font-semibold">Erro ao carregar agenda</span>
          </div>
          <p className="text-red-600 mt-2">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Cabeçalho */}
        <div className="mb-8 fade-in-1">
          <h1 className="text-2xl font-semibold text-gray-900">
            <i className="fas fa-calendar-alt mr-3 text-primary-600"></i>
            Minha Agenda
          </h1>
          <p className="text-gray-600 mt-1">Gerenciamento de aulas e alunos</p>
        </div>

      {/* Seletor de Data */}
      <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-md shadow-sm border border-blue-200 p-6 mb-6 fade-in-2">
        <div className="flex items-center justify-between gap-4">
          {/* Botão anterior */}
          <button
            onClick={() => mudarDia(-1)}
            className="p-3 hover:bg-blue-200 rounded-lg transition-colors flex-shrink-0"
            title="Dia anterior com aulas"
          >
            <i className="fas fa-chevron-left text-blue-600 font-bold text-lg"></i>
          </button>

          {/* Data atual */}
          <div className="text-center flex-1">
            <div className="text-xs text-blue-600 uppercase font-bold tracking-wide mb-1">Aula selecionada</div>
            <div className="text-2xl font-bold text-gray-900">{formatarData(dataSelecionada)}</div>
            <div className="text-sm text-blue-700 font-semibold mt-1">{diasSemana[diaSemana]}</div>
          </div>

          {/* Botão próximo */}
          <button
            onClick={() => mudarDia(1)}
            className="p-3 hover:bg-blue-200 rounded-lg transition-colors flex-shrink-0"
            title="Próximo dia com aulas"
          >
            <i className="fas fa-chevron-right text-blue-600 font-bold text-lg"></i>
          </button>
        </div>

        {/* Botão de ir para próxima aula */}
        <div className="flex gap-3 mt-5 justify-center">
          <button
            onClick={() => {
              const proximoDia = encontrarProximoDiaComHorarios(horarios, new Date());
              setDataSelecionada(proximoDia);
            }}
            className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold text-sm flex items-center gap-2 shadow-sm"
          >
            <i className="fas fa-calendar-check"></i>
            Ir para Próxima Aula
          </button>
        </div>
      </div>

      {/* Lista de Horários */}
      {horariosAgrupados.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-md p-8 text-center fade-in-3">
          <i className="fas fa-calendar-times text-4xl text-gray-300 mb-3"></i>
          <p className="text-gray-600 font-medium">Nenhum horário agendado para este dia</p>
          <p className="text-gray-500 text-sm mt-1">
            {diasSemana[diaSemana]}, {formatarData(dataSelecionada)}
          </p>
        </div>
      ) : (
        <div className="space-y-4 fade-in-3">
          {horariosAgrupados.map((horario, index) => (
            <div
              key={`${horario.horarioInicio}-${index}`}
              className={`rounded-xl shadow-sm border p-0 overflow-hidden transition-all fade-in-${Math.min((index % 8) + 1, 8)} ${
                aulaStatus.get(horario.horarioFixoId || '')?.enviada 
                  ? 'bg-gradient-to-r from-green-50 to-green-100 border-green-300' 
                  : 'bg-white border-gray-200'
              }`}
            >
              {/* Cabeçalho - Barra colorida e clicável */}
              <button
                onClick={() => toggleHorario(horario.horarioFixoId || '')}
                className="w-full text-left transition-all hover:shadow-lg"
                style={{
                  backgroundColor: aulaStatus.get(horario.horarioFixoId || '')?.enviada ? '#dcfce7' : horario.modalidade.cor,
                }}
              >
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    {/* Ícone de dropdown */}
                    <div className="flex-shrink-0">
                      <i className={`fas fa-chevron-${horariosExpandidos.has(horario.horarioFixoId || '') ? 'down' : 'right'} text-lg transition-transform ${aulaStatus.get(horario.horarioFixoId || '')?.enviada ? 'text-green-700' : 'text-white'}`}></i>
                    </div>

                    {/* Tempo e Modalidade */}
                    <div className="flex-1">
                      <div className={`font-bold text-lg flex items-baseline gap-2 ${aulaStatus.get(horario.horarioFixoId || '')?.enviada ? 'text-green-700' : 'text-white'}`}>
                        <i className={`fas ${aulaStatus.get(horario.horarioFixoId || '')?.enviada ? 'fa-check-circle text-green-400' : 'fa-clock opacity-80'} text-sm`}></i>
                        <span>{horario.horarioInicio}</span>
                        <span className="text-xs opacity-70 font-normal">às</span>
                        <span>{horario.horarioFim}</span>
                      </div>
                      <div className={`text-xs opacity-90 mt-0.5 font-medium ${aulaStatus.get(horario.horarioFixoId || '')?.enviada ? 'text-green-600' : 'text-white'}`}>
                        {horario.modalidade.nome}
                      </div>
                    </div>
                  </div>

                  {/* Status e Métricas */}
                  <div className="flex flex-col gap-2">
                    {/* Contador de alunos FIXOS */}
                    <div className="text-center bg-white rounded-md px-2.5 py-1.5 shadow-sm">
                      <div className="text-sm font-bold text-gray-900">
                        {(() => {
                          // Contar apenas alunos fixos (não reagendados para fora)
                          let count = 0;
                          horario.alunos.forEach(aluno => {
                            if (!alunoReagendadoParaFora(aluno._id, horario.horarioFixoId)) {
                              count++;
                            }
                          });
                          return count;
                        })()}
                      </div>
                      <div className="text-xs text-gray-600 font-medium">Fixos</div>
                    </div>

                    {/* Presentes EFETIVOS da aula */}
                    {(() => {
                      // Contar presentes apenas entre os alunos que estão efetivamente na aula
                      let presentes = 0;
                      let total = 0;
                      
                      horario.alunos.forEach(aluno => {
                        if (!alunoReagendadoParaFora(aluno._id, horario.horarioFixoId) && !aluno.emEspera && !aluno.ausente && !aluno.congelado) {
                          total++;
                          const status = getPresencaStatus(aluno._id, horario.horarioFixoId || '');
                          if (status === true) presentes++;
                        }
                      });
                      
                      // Adicionar reagendados para dentro
                      const reags = alunosReagendadosParaDentro(horario.horarioFixoId);
                      total += reags.length;
                      reags.forEach(reag => {
                        const status = getPresencaStatus(reag._id, horario.horarioFixoId || '');
                        if (status === true) presentes++;
                      });
                      
                      return (
                        <div className="text-center bg-white rounded-md px-2.5 py-1.5 shadow-sm">
                          <div className="text-sm font-bold text-green-600">
                            {presentes}
                            <span className="text-xs font-normal text-gray-400">/{total}</span>
                          </div>
                          <div className="text-xs text-gray-600 font-medium">Presentes</div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </button>

              {/* Conteúdo expandido */}
              {horariosExpandidos.has(horario.horarioFixoId || '') && (
                <div className="border-t border-gray-200 bg-white">
                  <div className="p-4">{horario.alunos.length === 0 && alunosReagendadosParaDentro(horario.horarioFixoId).length === 0 ? (
                    <div className="p-6 text-center">
                      <i className="fas fa-inbox text-gray-300 text-4xl mb-3 block"></i>
                      <p className="text-gray-500 font-medium">Nenhum aluno neste horário</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {/* Alunos regulares */}
                      {horario.alunos.map((aluno) => {
                        const reagendamento = alunoReagendadoParaFora(aluno._id, horario.horarioFixoId);
                        const foiReagendado = !!reagendamento;

                        // Definir estilo baseado no status
                        let bgColor = 'bg-white';
                        let badgeClass = '';
                        let badgeIcon = '';

                        if (foiReagendado) {
                          bgColor = 'bg-gray-100';
                          badgeClass = 'bg-orange-100 text-orange-800 border-orange-200';
                          badgeIcon = 'fa-exchange-alt';
                        } else if (aluno.ausente) {
                          bgColor = 'bg-red-50';
                          badgeClass = 'bg-red-100 text-red-800 border-red-200';
                          badgeIcon = 'fa-ban';
                        } else if (aluno.congelado) {
                          bgColor = 'bg-blue-50';
                          badgeClass = 'bg-blue-100 text-blue-800 border-blue-200';
                          badgeIcon = 'fa-snowflake';
                        } else if (aluno.emEspera) {
                          bgColor = 'bg-yellow-50';
                          badgeClass = 'bg-yellow-100 text-yellow-800 border-yellow-200';
                          badgeIcon = 'fa-hourglass-half';
                        }

                        return (
                          <div
                            key={aluno._id}
                            className={`p-3 rounded-md border shadow-sm ${bgColor} border-gray-200 transition-all flex items-center justify-between gap-3`}
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              {/* Avatar */}
                              <div
                                className="w-10 h-10 rounded-md flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                                style={{ backgroundColor: foiReagendado ? '#9CA3AF' : horario.modalidade.cor }}
                              >
                                {aluno.nome.charAt(0).toUpperCase()}
                              </div>

                              {/* Informações do aluno */}
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-gray-900 text-sm">{aluno.nome}</div>
                                {(foiReagendado || aluno.ausente || aluno.congelado || aluno.emEspera) && (
                                  <div className="mt-1">
                                    {foiReagendado && reagendamento && (
                                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${badgeClass} border`}>
                                        <i className={`fas ${badgeIcon}`}></i>
                                        {new Date(reagendamento.novaData).toLocaleDateString('pt-BR')} às {reagendamento.novoHorarioInicio}
                                      </span>
                                    )}
                                    {!foiReagendado && (aluno.ausente || aluno.congelado || aluno.emEspera) && (
                                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${badgeClass} border`}>
                                        <i className={`fas ${badgeIcon}`}></i>
                                        {aluno.ausente ? 'Parou de vir' : aluno.congelado ? 'Congelado' : 'Em espera'}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-3 flex-shrink-0">
                              {/* Presença/Falta Selector */}
                              {!foiReagendado && !aluno.emEspera && !aluno.ausente && !aluno.congelado && (
                                <div className="flex gap-1">
                                  {(() => {
                                    const status = getPresencaStatus(aluno._id, horario.horarioFixoId || '');
                                    const aulaEnviada = aulaStatus.get(horario.horarioFixoId || '')?.enviada ?? false;
                                    
                                    return (
                                      <>
                                        <button
                                          onClick={() => !aulaEnviada && marcarPresenca(aluno._id, horario.horarioFixoId || '', true)}
                                          disabled={aulaEnviada}
                                          className={`px-2 py-1 rounded-md transition-all font-semibold text-xs flex items-center gap-1 ${
                                            status === true 
                                              ? 'bg-green-500 text-white shadow-md' 
                                              : 'bg-white text-gray-600 hover:bg-green-50'
                                          } ${aulaEnviada ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                                          title={aulaEnviada ? "Aula já foi enviada" : "Marcar como PRESENTE"}
                                        >
                                          <i className="fas fa-check"></i>
                                          <span className="hidden sm:inline">Presente</span>
                                        </button>
                                        <button
                                          onClick={() => !aulaEnviada && marcarPresenca(aluno._id, horario.horarioFixoId || '', false)}
                                          disabled={aulaEnviada}
                                          className={`px-2 py-1 rounded-md transition-all font-semibold text-xs flex items-center gap-1 ${
                                            status === false 
                                              ? 'bg-red-500 text-white shadow-md' 
                                              : 'bg-white text-gray-600 hover:bg-red-50'
                                          } ${aulaEnviada ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                                          title={aulaEnviada ? "Aula já foi enviada" : "Marcar como FALTA"}
                                        >
                                          <i className="fas fa-times"></i>
                                          <span className="hidden sm:inline">Falta</span>
                                        </button>
                                      </>
                                    );
                                  })()}
                                </div>
                              )}

                              {/* Observações */}
                              {aluno.observacoes && (
                                <span 
                                  className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-amber-100 text-amber-700 text-xs font-bold flex-shrink-0"
                                  title={aluno.observacoes}
                                >
                                  !
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {/* Reagendados PARA DENTRO */}
                      {alunosReagendadosParaDentro(horario.horarioFixoId).map((aluno: any) => (
                        <div
                          key={`reag-${aluno._id}`}
                          className="p-3 rounded-md border shadow-sm border-green-200 bg-green-50 transition-all flex items-center gap-3"
                        >
                          <div
                            className="w-10 h-10 rounded-md flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                            style={{ backgroundColor: '#22c55e' }}
                          >
                            {aluno.nome.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-gray-900 text-sm">{aluno.nome}</div>
                            <div className="mt-1">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 border border-green-300">
                                <i className="fas fa-exchange-alt"></i>
                                Para {new Date(aluno._reagendamento.novaData).toLocaleDateString('pt-BR')} às {aluno._reagendamento.novoHorarioInicio}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  </div>

                  {/* Card de Aula Enviada */}
                  {aulaStatus.get(horario.horarioFixoId || '')?.enviada && (
                    <div className="p-4 border-t bg-green-50">
                      <div className="flex items-center justify-center gap-2 text-green-700">
                        <i className="fas fa-check-circle text-green-600 text-lg"></i>
                        <span className="font-semibold text-sm">Aula Enviada com Sucesso</span>
                      </div>
                    </div>
                  )}

                  {/* Botão de Enviar Aula */}
                  {horariosExpandidos.has(horario.horarioFixoId || '') && !aulaStatus.get(horario.horarioFixoId || '')?.enviada && (
                    <div className="p-4 border-t bg-blue-50">
                      <button
                        onClick={() => enviarAula(horario.horarioFixoId || '')}
                        disabled={enviandoAula}
                        className={`w-full py-3 px-4 rounded-md font-bold transition-all flex items-center justify-center gap-2 ${
                          enviandoAula
                            ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95 shadow-sm'
                        }`}
                      >
                        {enviandoAula ? (
                          <>
                            <i className="fas fa-spinner fa-spin"></i>
                            Enviando Aula...
                          </>
                        ) : (
                          <>
                            <i className="fas fa-check-double"></i>
                            Confirmar e Enviar Aula
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
