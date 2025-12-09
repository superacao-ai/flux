'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'react-toastify';
import { refreshPendingCounts } from '@/lib/events';

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
  presente: boolean | null;
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
  linkWhatsapp?: string;
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
  isReposicao?: boolean;
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
  alunoId?: {
    _id: string;
    nome: string;
    email?: string;
  };
}

interface AulaExperimental {
  _id: string;
  horarioFixoId: string;
  data: string;
  nomeExperimental: string;
  telefoneExperimental: string;
  emailExperimental?: string;
  observacoesExperimental?: string;
  status: 'agendada' | 'aprovada' | 'realizada' | 'cancelada';
  compareceu: boolean | null;
}

interface UsoCredito {
  _id: string;
  alunoId: {
    _id: string;
    nome: string;
    email?: string;
    telefone?: string;
  };
  agendamentoId: string; // HorarioFixoId
  dataUso: string;
  observacao?: string;
}

export default function MinhaAgendaClient() {
  const [horarios, setHorarios] = useState<HorarioFixo[]>([]);
  const [reagendamentos, setReagendamentos] = useState<Reagendamento[]>([]);
  const [aulasExperimentais, setAulasExperimentais] = useState<AulaExperimental[]>([]);
  const [usosCredito, setUsosCredito] = useState<UsoCredito[]>([]);
  const [presencasExperimentais, setPresencasExperimentais] = useState<Map<string, boolean>>(new Map()); // Presença local das experimentais
  const [presencas, setPresencas] = useState<Presenca[]>([]); // Rascunho local
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState('');
  const [dataSelecionada, setDataSelecionada] = useState(new Date());
  const [aulaStatus, setAulaStatus] = useState<Map<string, AulaStatus>>(new Map());
  const [enviandoAula, setEnviandoAula] = useState(false);
  const [horariosExpandidos, setHorariosExpandidos] = useState<Set<string>>(new Set());
  const [aulasPendentes, setAulasPendentes] = useState<any[]>([]);
  const [aulasHoje, setAulasHoje] = useState<any[]>([]);
  const searchParams = useSearchParams();

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

  // setMounted on client
  useEffect(() => {
    setMounted(true);
  }, []);

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

        // If a date was provided in the query params, use it; otherwise choose next available day
        const queryDate = searchParams?.get('date');
        const queryHorario = searchParams?.get('horarioFixoId');

        if (queryDate) {
          // Parse YYYY-MM-DD safely to avoid timezone shifts
          try {
            const raw = String(queryDate || '');
            const dateOnly = raw.slice(0, 10);
            const parts = dateOnly.split('-');
            if (parts.length === 3) {
              const y = Number(parts[0]);
              const m = Number(parts[1]) - 1;
              const day = Number(parts[2]);
              if (!isNaN(y) && !isNaN(m) && !isNaN(day)) {
                setDataSelecionada(new Date(y, m, day));
              } else {
                const parsed = new Date(raw);
                if (!isNaN(parsed.getTime())) setDataSelecionada(parsed);
              }
            } else {
              const parsed = new Date(raw);
              if (!isNaN(parsed.getTime())) setDataSelecionada(parsed);
            }
          } catch (e) {
            const parsed = new Date(queryDate);
            if (!isNaN(parsed.getTime())) setDataSelecionada(parsed);
          }
        } else if (list.length > 0) {
          const proximoDia = encontrarProximoDiaComHorarios(list, new Date());
          setDataSelecionada(proximoDia);
        }

        // If a horarioFixoId was requested, expand it when available
        if (queryHorario) {
          setHorariosExpandidos(new Set([queryHorario]));
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

  // Buscar reagen damentos
  useEffect(() => {
    const fetchReagendamentos = async () => {
      try {
        const res = await fetch('/api/reagendamentos');
        
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : (data.data || []);

          // Mostrar reagendamentos que não foram rejeitados (inclui 'pendente' e 'aprovado')
          const visiveis = list.filter((r: Reagendamento) => r.status !== 'rejeitado');

          setReagendamentos(visiveis);
        }
      } catch (err) {
        console.error('[MinhaAgenda] Erro ao buscar reagendamentos:', err);
      }
    };

    fetchReagendamentos();
  }, []);

  // Buscar aulas experimentais do dia selecionado (agendadas OU aprovadas)
  useEffect(() => {
    const fetchAulasExperimentais = async () => {
      if (!dataSelecionada) return;
      
      try {
        const dataFormatada = dataSelecionada.toISOString().split('T')[0];
        const res = await fetch(`/api/aulas-experimentais?data=${dataFormatada}`);
        
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : (data.data || []);
          console.log('[MinhaAgenda] Aulas experimentais do dia:', list);
          // Filtrar aulas agendadas OU aprovadas (não canceladas, não realizadas)
          const ativas = list.filter((a: AulaExperimental) => a.status === 'agendada' || a.status === 'aprovada');
          console.log('[MinhaAgenda] Aulas experimentais ativas:', ativas);
          setAulasExperimentais(ativas);
        }
      } catch (err) {
        console.error('[MinhaAgenda] Erro ao buscar aulas experimentais:', err);
      }
    };

    fetchAulasExperimentais();
  }, [dataSelecionada]);

  // Buscar usos de crédito do dia selecionado (alunos extras)
  useEffect(() => {
    const fetchUsosCredito = async () => {
      if (!dataSelecionada) return;
      
      try {
        const dataFormatada = dataSelecionada.toISOString().split('T')[0];
        const res = await fetch(`/api/creditos-reposicao/usos?data=${dataFormatada}`);
        
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : (data.usos || []);
          console.log('[MinhaAgenda] Usos de crédito do dia:', list);
          setUsosCredito(list);
        }
      } catch (err) {
        console.error('[MinhaAgenda] Erro ao buscar usos de crédito:', err);
      }
    };

    fetchUsosCredito();
  }, [dataSelecionada]);

  // Buscar presenças do dia selecionado
  useEffect(() => {
    const fetchPresencas = async () => {
      if (!dataSelecionada) return;
      
      try {
        const dataFormatada = dataSelecionada.toISOString().split('T')[0];
        const res = await fetch(`/api/presencas?data=${dataFormatada}`);
        
        if (res.ok) {
          const data = await res.json();
          // Merge server presencas with local draft presencas saved in localStorage
          const serverPresencas: Presenca[] = Array.isArray(data) ? data : [];
          const draftKey = `minhaagenda:presencas:${dataFormatada}`;
          try {
            const raw = localStorage.getItem(draftKey);
            if (raw) {
              const drafts: Presenca[] = JSON.parse(raw) || [];
              // Build map by alunoId+horario to let drafts override server values
              const map = new Map<string, Presenca>();
              serverPresencas.forEach(p => map.set(`${p.alunoId}::${p.horarioFixoId}`, p));
              drafts.forEach(p => map.set(`${p.alunoId}::${p.horarioFixoId}`, p));
              setPresencas(Array.from(map.values()));
            } else {
              setPresencas(serverPresencas);
            }
          } catch (e) {
            console.warn('[MinhaAgenda] Falha ao parsear drafts de presencas:', e);
            setPresencas(serverPresencas);
          }
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

  // Buscar aulas pendentes e calcular aulas do dia
  useEffect(() => {
    const fetchAulasPendentes = async () => {
      if (horarios.length === 0) return;
      
      try {
        const token = localStorage.getItem('token');
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
        
        // Buscar todas as aulas enviadas
        const resEnviadas = await fetch('/api/aulas-realizadas?listarTodas=true', { headers });
        const dataEnviadas = await resEnviadas.json();
        
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const inicioDate = new Date(hoje);
        inicioDate.setDate(hoje.getDate() - 30);
        
        // Data de início da plataforma
        const dataInicioPlataforma = typeof window !== 'undefined' 
          ? localStorage.getItem('dataInicioPlataforma') || ''
          : '';
        
        const pendentes: any[] = [];
        const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
        const aulasMap = new Map<string, boolean>();
        
        // Map aulas enviadas
        (Array.isArray(dataEnviadas) ? dataEnviadas : (dataEnviadas.data || [])).forEach((a: any) => {
          if (a.status === 'enviada' || a.status === 'corrigida') {
            const dStr = (a.data || '').split('T')[0] || '';
            const key = `${a.horarioFixoId || ''}_${dStr}`;
            aulasMap.set(key, true);
          }
        });
        
        // Calcular pendentes
        horarios.filter((h: any) => h.ativo !== false).forEach((h: any) => {
          const horarioId = h._id || h.horarioFixoId;
          if (!horarioId) return;
          
          const raw = Number(h.diaSemana);
          const candidateDays = new Set<number>();
          if (!isNaN(raw)) {
            if (raw >= 0 && raw <= 6) candidateDays.add(raw);
            if (raw >= 1 && raw <= 7) candidateDays.add(raw % 7);
          }
          if (candidateDays.size === 0) candidateDays.add(0);
          
          for (let cur = new Date(inicioDate); cur <= hoje; cur.setDate(cur.getDate() + 1)) {
            if (candidateDays.has(cur.getDay())) {
              const dateStr = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
              const dentroDataPlataforma = !dataInicioPlataforma || dateStr >= dataInicioPlataforma;
              
              if (dentroDataPlataforma) {
                const key = `${horarioId}_${dateStr}`;
                if (!aulasMap.has(key)) {
                  pendentes.push({
                    data: dateStr,
                    horario: h.horarioInicio && h.horarioFim ? `${h.horarioInicio} - ${h.horarioFim}` : 'N/A',
                    modalidade: h.modalidadeId?.nome || 'N/A',
                    horarioFixoId: horarioId
                  });
                }
              }
            }
          }
        });
        
        // Ordenar por data
        pendentes.sort((a, b) => b.data.localeCompare(a.data));
        setAulasPendentes(pendentes);
        
        // Aulas de hoje (horários do dia atual)
        const diaHoje = hoje.getDay();
        const aulasDeHoje = horarios.filter((h: any) => h.diaSemana === diaHoje && h.ativo);
        setAulasHoje(aulasDeHoje);
        
      } catch (err) {
        console.error('[MinhaAgenda] Erro ao buscar aulas pendentes:', err);
      }
    };
    
    fetchAulasPendentes();
  }, [horarios]);

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
  const hojeFormatado = new Date().toISOString().split('T')[0];
  const isHoje = dataFormatada === hojeFormatado;
  
  // Reagendamentos que TÊM DESTINO nesta data (alunos vindo de outros dias)
  // Só mostra como "efetivamente trocado" se status for aprovado
  const reagendamentosParaDentro = reagendamentos.filter(r => {
    if (!r.novaData) return false;
    if (r.status !== 'aprovado') return false; // Só aprovados aparecem no destino
    const reagData = r.novaData.split('T')[0];
    return reagData === dataFormatada;
  });
  
  // Reagendamentos que TÊM ORIGEM nesta data (alunos saindo para outros dias)
  // Só mostra como "efetivamente trocado" se status for aprovado
  const reagendamentosParaFora = reagendamentos.filter(r => {
    if (!r.dataOriginal) return false;
    if (r.status !== 'aprovado') return false; // Só aprovados saem da origem
    const reagData = r.dataOriginal.split('T')[0];
    return reagData === dataFormatada;
  });

  // Função para verificar se um aluno foi reagendado PARA FORA deste horário
  const alunoReagendadoParaFora = (alunoId: string, horarioId?: string) => {
    if (!horarioId) return null;
    return reagendamentosParaFora.find(r => {
      const rAlunoId = (r.matriculaId && typeof r.matriculaId !== 'string' && r.matriculaId.alunoId && typeof r.matriculaId.alunoId !== 'string')
        ? (r.matriculaId.alunoId._id || '')
        : (r.horarioFixoId && typeof r.horarioFixoId !== 'string' && r.horarioFixoId.alunoId && typeof r.horarioFixoId.alunoId !== 'string')
          ? (r.horarioFixoId.alunoId._id || '')
          : '';

      const rHorarioFixoId = typeof r.horarioFixoId === 'string' ? r.horarioFixoId : (r.horarioFixoId?._id || '');

      return rAlunoId === alunoId && rHorarioFixoId === horarioId;
    });
  };

  // Função para buscar alunos reagendados PARA DENTRO deste horário  
  const alunosReagendadosParaDentro = (horarioId?: string) => {
    if (!horarioId) return [];
    return reagendamentosParaDentro
      .filter(r => {
        const novoHorarioFixoId = typeof r.novoHorarioFixoId === 'string' ? r.novoHorarioFixoId : (r.novoHorarioFixoId?._id || '');
        return novoHorarioFixoId === horarioId;
      })
      .map(r => {
        // Para reposições, o aluno vem direto do campo alunoId
        // Para reagendamentos normais, vem da matrícula ou do horarioFixo
        let aluno = null;
        
        if (r.alunoId && typeof r.alunoId !== 'string' && r.alunoId._id) {
          aluno = r.alunoId;
        } else if (r.matriculaId && typeof r.matriculaId !== 'string' && r.matriculaId.alunoId && typeof r.matriculaId.alunoId !== 'string') {
          aluno = r.matriculaId.alunoId;
        } else if (r.horarioFixoId && typeof r.horarioFixoId !== 'string' && r.horarioFixoId.alunoId && typeof r.horarioFixoId.alunoId !== 'string') {
          aluno = r.horarioFixoId.alunoId;
        }

        return {
          _id: aluno?._id || '',
          nome: aluno?.nome || 'Aluno',
          email: aluno?.email,
          _reagendamento: r
        };
      })
      .filter(a => a._id); // Remover alunos inválidos
  };

  // Função para buscar aulas experimentais aprovadas para este horário
  const aulasExperimentaisDoHorario = (horarioId?: string) => {
    if (!horarioId) return [];
    // Comparar strings para evitar problemas de tipo ObjectId vs string
    const result = aulasExperimentais.filter(a => String(a.horarioFixoId) === String(horarioId));
    if (aulasExperimentais.length > 0) {
      console.log('[MinhaAgenda] aulasExperimentaisDoHorario:', { 
        horarioId, 
        totalExperimentais: aulasExperimentais.length,
        horarioIds: aulasExperimentais.map(a => a.horarioFixoId),
        matched: result.length 
      });
    }
    return result;
  };

  // Função para buscar alunos com crédito usado neste horário
  const alunosComCreditoDoHorario = (horarioId?: string) => {
    if (!horarioId) return [];
    return usosCredito
      .filter(u => String(u.agendamentoId) === String(horarioId))
      .map(u => ({
        _id: u.alunoId._id,
        nome: u.alunoId.nome,
        email: u.alunoId.email,
        telefone: u.alunoId.telefone,
        _usoCredito: u
      }));
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
    
    // Bloquear envio de aulas futuras
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataAula = new Date(dataSelecionada);
    dataAula.setHours(0, 0, 0, 0);
    
    if (dataAula > hoje) {
      toast.warning('Não é possível enviar aulas de datas futuras.');
      return;
    }
    
    setEnviandoAula(true);

    try {
      const dataFormatada = dataSelecionada.toISOString().split('T')[0];
      const token = localStorage.getItem('token');
      
      if (!token) {
        toast.error('Sessão expirada. Por favor, faça login novamente.');
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
          return reags.map(r => {
            const reagId = (r as any)._reagendamento?._id || '';
            return {
              reagendamentoId: reagId,
              // buscar presença gravada usando o ID do reagendamento (presenças de reagendados são salvas com esse id)
              presente: reagId ? getPresencaStatus(reagId, h.horarioFixoId || '') ?? null : null,
              observacoes: '',
            };
          });
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

        // Enviar presenças das aulas experimentais deste horário
        const aulasExpDoHorario = aulasExperimentaisDoHorario(horarioFixoId);
        for (const aulaExp of aulasExpDoHorario) {
          const presente = getPresencaExperimentalStatus(aulaExp._id);
          try {
            await fetch('/api/aulas-experimentais', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                _id: aulaExp._id,
                compareceu: presente,
                status: 'realizada'
              })
            });
            // Atualizar estado local das aulas experimentais
            setAulasExperimentais(prev => 
              prev.map(a => a._id === aulaExp._id ? { ...a, compareceu: presente, status: 'realizada' } : a)
            );
          } catch (e) {
            console.error('Erro ao registrar presença experimental:', e);
          }
        }

        // Remover rascunhos locais para este horário na data enviada
        try {
          const dataFormatada = dataSelecionada.toISOString().split('T')[0];
          const draftKey = `minhaagenda:presencas:${dataFormatada}`;
          const raw = localStorage.getItem(draftKey);
          if (raw) {
            const drafts: Presenca[] = JSON.parse(raw) || [];
            const filtered = drafts.filter(p => String(p.horarioFixoId) !== String(horarioFixoId));
            if (filtered.length === 0) localStorage.removeItem(draftKey);
            else localStorage.setItem(draftKey, JSON.stringify(filtered));
          }
        } catch (e) {
          console.warn('[MinhaAgenda] Falha ao limpar drafts após envio:', e);
        }

        toast.success('Aula enviada com sucesso!');
        refreshPendingCounts();
      } else {
        console.error('Erro na API:', data);
        console.error('Status:', res.status);
        console.error('Response completo:', res);
        toast.error(`Erro ao enviar aula: ${data.error || 'Erro desconhecido'}`);
      }
    } catch (err) {
      console.error('Erro ao enviar aula:', err);
      toast.error(`Erro ao enviar aula: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
    } finally {
      setEnviandoAula(false);
    }
  };

  // Marcar presença/falta (apenas local, sem salvar ainda)
  // NOTE: default behavior: when no explicit marking exists, we consider the aluno as 'falta' (presente = false).
  // The switch now toggles between true (presente) and false (falta) — we no longer use `null` as uninitialized state.
  const marcarPresenca = (alunoId: string, horarioFixoId: string, presente: boolean) => {
    setPresencas(prev => {
      const index = prev.findIndex(
        p => String(p.alunoId) === String(alunoId) && String(p.horarioFixoId) === String(horarioFixoId)
      );
      
      if (index >= 0) {
        // Já existe, atualizar
        const updated = [...prev];
        updated[index].presente = presente;
        // salvar rascunho no localStorage
        try {
          const dataFormatada = dataSelecionada.toISOString().split('T')[0];
          const draftKey = `minhaagenda:presencas:${dataFormatada}`;
          const raw = localStorage.getItem(draftKey);
          const drafts: Presenca[] = raw ? (JSON.parse(raw) || []) : [];
          const idx = drafts.findIndex(d => String(d.alunoId) === String(alunoId) && String(d.horarioFixoId) === String(horarioFixoId));
          const novo = { alunoId, horarioFixoId, data: dataFormatada, presente } as Presenca;
          if (idx >= 0) { drafts[idx] = novo; } else { drafts.push(novo); }
          localStorage.setItem(draftKey, JSON.stringify(drafts));
        } catch (e) { console.warn('[MinhaAgenda] Falha ao salvar draft de presenca:', e); }
        return updated;
      } else {
        // Novo registro
        const dataFormatada = dataSelecionada.toISOString().split('T')[0];
        const novo = { alunoId, horarioFixoId, data: dataFormatada, presente } as Presenca;
        // persistir rascunho
        try {
          const draftKey = `minhaagenda:presencas:${dataFormatada}`;
          const raw = localStorage.getItem(draftKey);
          const drafts: Presenca[] = raw ? (JSON.parse(raw) || []) : [];
          drafts.push(novo);
          localStorage.setItem(draftKey, JSON.stringify(drafts));
        } catch (e) { console.warn('[MinhaAgenda] Falha ao salvar draft de presenca:', e); }

        return [...prev, novo];
      }
    });
  };

  // Verificar status de presença de um aluno
  // Default: if no explicit marking exists, return false (falta)
  const getPresencaStatus = (alunoId: string, horarioFixoId: string): boolean => {
    if (!alunoId || !horarioFixoId) return false;

    const presenca = presencas.find(
      p => String(p.alunoId) === String(alunoId) && String(p.horarioFixoId) === String(horarioFixoId)
    );

    return presenca ? (presenca.presente === true) : false;
  };

  // Marcar presença/falta de aula experimental (salva localmente, envia só ao confirmar aula)
  const marcarPresencaExperimental = (aulaId: string, presente: boolean) => {
    setPresencasExperimentais(prev => {
      const newMap = new Map(prev);
      newMap.set(aulaId, presente);
      return newMap;
    });
  };

  // Obter status de presença de aula experimental (padrão: false = falta)
  const getPresencaExperimentalStatus = (aulaId: string): boolean => {
    return presencasExperimentais.get(aulaId) ?? false;
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
    
    // Obter data de início da plataforma
    const dataInicioPlataforma = localStorage.getItem('dataInicioPlataforma') || '';
    
    let tentativas = 0;
    const maxTentativas = 7; // Procurar nos próximos 7 dias
    
    while (tentativas < maxTentativas) {
      dataAtual.setDate(dataAtual.getDate() + direcao);
      const novoDia = dataAtual.getDay();
      
      // Verificar se a data está dentro do período permitido
      if (dataInicioPlataforma) {
        const dataAtualStr = `${dataAtual.getFullYear()}-${String(dataAtual.getMonth() + 1).padStart(2, '0')}-${String(dataAtual.getDate()).padStart(2, '0')}`;
        
        // Se estiver tentando ir para antes da data de início
        if (direcao < 0 && dataAtualStr < dataInicioPlataforma) {
          toast.info('Você chegou à data de início do sistema: ' + dataInicioPlataforma.split('-').reverse().join('/'));
          return;
        }
      }
      
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
  // Parse YYYY-MM-DD (or ISO) into a local Date at midnight to avoid timezone shifts
  const parseDateOnly = (s?: string) => {
    if (!s) return new Date(NaN);
    const dateOnly = String(s).split('T')[0];
    const parts = dateOnly.split('-');
    if (parts.length === 3) {
      const y = Number(parts[0]);
      const m = Number(parts[1]) - 1;
      const d = Number(parts[2]);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        return new Date(y, m, d);
      }
    }
    const parsed = new Date(s);
    return parsed;
  };

  const formatDateFromString = (s?: string) => {
    const d = parseDateOnly(s);
    if (isNaN(d.getTime())) return s ? String(s).split('T')[0] : '';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatarData = (data: Date) => {
    return data.toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
  };

  // Skeleton loading
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 sm:p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header skeleton */}
          <div className="mb-8">
            <div className="h-7 bg-gray-200 rounded w-36 mb-2 animate-pulse" />
            <div className="h-4 bg-gray-200 rounded w-56 animate-pulse" />
          </div>
          {/* Date selector skeleton */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 animate-pulse">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 bg-gray-200 rounded-lg" />
              <div className="text-center">
                <div className="h-6 bg-gray-200 rounded w-40 mx-auto mb-2" />
                <div className="h-4 bg-gray-100 rounded w-28 mx-auto" />
              </div>
              <div className="w-10 h-10 bg-gray-200 rounded-lg" />
            </div>
          </div>
          {/* Cards skeleton */}
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gray-200 rounded-lg" />
                    <div>
                      <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
                      <div className="h-3 bg-gray-100 rounded w-32" />
                    </div>
                  </div>
                  <div className="w-24 h-8 bg-gray-200 rounded-lg" />
                </div>
                <div className="space-y-3">
                  <div className="h-12 bg-gray-100 rounded-lg" />
                  <div className="h-12 bg-gray-100 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header Desktop */}
        <div className="hidden md:block mb-6 fade-in-1">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <i className="fas fa-calendar-alt text-primary-600"></i>
            Minha Agenda
          </h1>
          <p className="text-sm text-gray-600 mt-1">Gerenciamento de aulas e alunos</p>
        </div>
        
        {/* Header Mobile - Compacto */}
        <div className="md:hidden mb-3 fade-in-1">
          <h1 className="text-lg font-bold text-gray-900">
            <i className="fas fa-calendar-alt text-primary-600 mr-1.5"></i>
            Minha Agenda
          </h1>
        </div>

      {/* Cards de Dashboard */}
      <div className="grid grid-cols-2 gap-3 md:gap-4 mb-6 fade-in-2">
        {/* Card Aulas de Hoje */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <i className="fas fa-calendar-day text-green-600 text-lg md:text-xl"></i>
            </div>
            <div>
              <div className="text-2xl md:text-3xl font-bold text-gray-900">{aulasHoje.length}</div>
              <div className="text-xs md:text-sm text-gray-500">Aulas Hoje</div>
            </div>
          </div>
        </div>
        
        {/* Card Aulas Pendentes */}
        <a 
          href="/professor/aulas"
          className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 md:w-12 md:h-12 rounded-lg flex items-center justify-center ${aulasPendentes.length > 0 ? 'bg-yellow-100' : 'bg-gray-100'}`}>
              <i className={`fas fa-clock text-lg md:text-xl ${aulasPendentes.length > 0 ? 'text-yellow-600' : 'text-gray-400'}`}></i>
            </div>
            <div>
              <div className={`text-2xl md:text-3xl font-bold ${aulasPendentes.length > 0 ? 'text-yellow-600' : 'text-gray-900'}`}>
                {aulasPendentes.length}
              </div>
              <div className="text-xs md:text-sm text-gray-500">Pendentes</div>
            </div>
          </div>
          {aulasPendentes.length > 0 && (
            <div className="mt-2 text-xs text-yellow-600 font-medium flex items-center gap-1">
              <i className="fas fa-exclamation-circle"></i>
              Clique para preencher
            </div>
          )}
        </a>
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
            <div className="flex items-center justify-center gap-2">
              <div className="text-2xl font-bold text-gray-900">{formatarData(dataSelecionada)}</div>
              {isHoje && (
                <div className="inline-flex items-center px-2 py-0.5 rounded-full bg-green-100 text-green-800 text-xs font-semibold">
                  Hoje
                </div>
              )}
            </div>
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
                  ? 'bg-gray-50 border-gray-300' 
                  : 'bg-white border-gray-200'
              }`}
            >
              {/* Cabeçalho - Barra colorida e clicável */}
              <button
                onClick={() => toggleHorario(horario.horarioFixoId || '')}
                className="w-full text-left transition-all hover:shadow-lg"
                style={{
                  backgroundColor: aulaStatus.get(horario.horarioFixoId || '')?.enviada ? '#E5E7EB' : horario.modalidade.cor,
                }}
              >
                <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                    {/* Ícone de dropdown */}
                    <div className="flex-shrink-0">
                      <i className={`fas fa-chevron-${horariosExpandidos.has(horario.horarioFixoId || '') ? 'down' : 'right'} text-lg transition-transform ${aulaStatus.get(horario.horarioFixoId || '')?.enviada ? 'text-gray-600' : 'text-white'}`}></i>
                    </div>

                    {/* Tempo e Modalidade */}
                    <div className="flex-1">
                      <div className={`font-bold text-lg flex items-baseline gap-2 ${aulaStatus.get(horario.horarioFixoId || '')?.enviada ? 'text-gray-700' : 'text-white'}`}>
                        <i className={`fas ${aulaStatus.get(horario.horarioFixoId || '')?.enviada ? 'fa-check-circle text-gray-400' : 'fa-clock opacity-80'} text-sm`}></i>
                        <span>{horario.horarioInicio}</span>
                        <span className="text-xs opacity-70 font-normal">às</span>
                        <span>{horario.horarioFim}</span>
                      </div>
                      <div className={`text-xs opacity-90 mt-0.5 font-medium ${aulaStatus.get(horario.horarioFixoId || '')?.enviada ? 'text-gray-600' : 'text-white'}`}>
                        {horario.modalidade.nome}
                      </div>
                    </div>
                  </div>

                  {/* Status e Métricas */}
                  <div className="flex flex-col gap-2">
                    {/* Contador de alunos FIXOS */}
                    <div className="text-center bg-white rounded-md px-2.5 py-1.5 shadow-sm">
                      <div className={`text-sm font-bold ${aulaStatus.get(horario.horarioFixoId || '')?.enviada ? 'text-gray-600' : 'text-gray-900'}`}>
                        {(() => {
                          // Contar alunos matriculados nesse horário (fixos)
                          // Observação: não incluímos reagendamentos vindos de outros horários (reagendamentosParaDentro)
                          // e contamos todos os alunos que pertencem a este horário, mesmo que tenham um reagendamento para fora.
                          try {
                            return (horario.alunos && Array.isArray(horario.alunos)) ? horario.alunos.length : 0;
                          } catch (e) {
                            return 0;
                          }
                        })()}
                      </div>
                      <div className={`text-xs ${aulaStatus.get(horario.horarioFixoId || '')?.enviada ? 'text-gray-500' : 'text-gray-600'} font-medium`}>Fixos</div>
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
                          <div className={`text-sm font-bold ${aulaStatus.get(horario.horarioFixoId || '')?.enviada ? 'text-gray-400' : 'text-green-600'}`}>
                            {presentes}
                            <span className="text-xs font-normal text-gray-400">/{total}</span>
                          </div>
                            <div className={`text-xs ${aulaStatus.get(horario.horarioFixoId || '')?.enviada ? 'text-gray-500' : 'text-gray-600'} font-medium`}>Presentes</div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </button>

              {/* Conteúdo expandido */}
              {horariosExpandidos.has(horario.horarioFixoId || '') && (
                <div className={`border-t ${aulaStatus.get(horario.horarioFixoId || '')?.enviada ? 'border-gray-300 bg-gray-50' : 'border-gray-200 bg-white'}`}>
                  <div className="p-4">{horario.alunos.length === 0 && alunosReagendadosParaDentro(horario.horarioFixoId).length === 0 && aulasExperimentaisDoHorario(horario.horarioFixoId).length === 0 && alunosComCreditoDoHorario(horario.horarioFixoId).length === 0 ? (
                    <div className="p-6 text-center">
                      <i className="fas fa-inbox text-gray-300 text-4xl mb-3 mx-auto"></i>
                      <p className="text-gray-500 font-medium">Nenhum aluno neste horário</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {/* Alunos regulares */}
                      {horario.alunos.map((aluno) => {
                        const reagendamento = alunoReagendadoParaFora(aluno._id, horario.horarioFixoId);
                        const foiReagendado = !!reagendamento;
                        const aulaEnviada = aulaStatus.get(horario.horarioFixoId || '')?.enviada ?? false;

                        // Definir estilo baseado no status
                        let bgColor = 'bg-white';
                        let badgeClass = '';
                        let badgeIcon = '';
                        const inactive = aluno.congelado || aluno.ausente;

                        if (foiReagendado) {
                          bgColor = 'bg-gray-100';
                          badgeClass = aulaEnviada ? 'bg-gray-100 text-gray-600 border-gray-200' : 'bg-amber-100 text-amber-800 border-amber-200';
                          badgeIcon = 'fa-exchange-alt';
                        } else if (aluno.ausente) {
                          bgColor = 'bg-red-50';
                          badgeClass = aulaEnviada ? 'bg-gray-100 text-gray-600 border-gray-200' : 'bg-red-100 text-red-800 border-red-200';
                          badgeIcon = 'fa-ban';
                        } else if (aluno.congelado) {
                          bgColor = 'bg-blue-50';
                          badgeClass = aulaEnviada ? 'bg-gray-100 text-gray-600 border-gray-200' : 'bg-blue-100 text-blue-800 border-blue-200';
                          badgeIcon = 'fa-snowflake';
                        } else if (aluno.emEspera) {
                          bgColor = 'bg-yellow-50';
                          badgeClass = aulaEnviada ? 'bg-gray-100 text-gray-600 border-gray-200' : 'bg-yellow-100 text-yellow-800 border-yellow-200';
                          badgeIcon = 'fa-hourglass-half';
                        }

                        return (
                          <div
                            key={aluno._id}
                            className={`p-3 rounded-md border shadow-sm ${inactive ? 'bg-gray-100 text-gray-500 filter grayscale' : bgColor} border-gray-200 transition-all`}
                          >
                            <div className="flex items-center gap-3">
                              {/* Avatar (rounded) */}
                              <div
                                className={`w-10 h-10 rounded-full overflow-hidden flex items-center justify-center font-bold text-sm flex-shrink-0 ${aulaStatus.get(horario.horarioFixoId || '')?.enviada ? 'bg-gray-100 text-gray-600' : (inactive ? 'bg-gray-400 text-gray-700' : 'text-white')}`}
                                style={{ backgroundColor: aulaStatus.get(horario.horarioFixoId || '')?.enviada ? undefined : (inactive ? undefined : (foiReagendado ? '#9CA3AF' : horario.modalidade.cor)) }}
                              >
                                {((aluno as any).foto) ? (
                                  <img src={(aluno as any).foto} alt={aluno.nome} className={`${aulaStatus.get(horario.horarioFixoId || '')?.enviada ? 'filter grayscale opacity-70 bg-gray-100' : 'bg-transparent'} w-full h-full object-cover`} />
                                ) : (
                                  <span className={`${aulaStatus.get(horario.horarioFixoId || '')?.enviada ? 'text-gray-600' : 'text-white'} text-sm`}>{aluno.nome?.charAt(0).toUpperCase() || '?'}</span>
                                )}
                              </div>

                              {/* Informações do aluno */}
                              <div className="flex-1 min-w-0">
                                <div className={`${inactive ? 'line-through text-gray-500' : 'font-semibold text-gray-900'} text-sm truncate`}>{aluno.nome}</div>

                                {/* Observação abaixo do nome */}
                                {aluno.observacoes && (
                                  <div className="text-xs text-gray-500 mt-1 truncate">{aluno.observacoes}</div>
                                )}

                                {/* Presença/Falta abaixo do nome */}
                                {!foiReagendado && !aluno.emEspera && !aluno.ausente && !aluno.congelado && (
                                  (() => {
                                    const status = getPresencaStatus(aluno._id, horario.horarioFixoId || '');
                                    const aulaEnviada = aulaStatus.get(horario.horarioFixoId || '')?.enviada ?? false;
                                    const checked = status === true;

                                    return (
                                      <div className="flex items-center gap-2 mt-2">
                                        <span className={`${aulaEnviada ? 'text-gray-400' : 'text-gray-700'} text-xs font-semibold`}>FALTOU</span>

                                        <label className={`relative inline-flex items-center ${aulaEnviada ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                                          <input
                                            type="checkbox"
                                            className="sr-only"
                                            checked={checked}
                                            disabled={aulaEnviada}
                                            onChange={(e) => marcarPresenca(aluno._id, horario.horarioFixoId || '', e.target.checked)}
                                            aria-label={`Marcar presença de ${aluno.nome}`}
                                          />

                                          <div className={`w-12 h-6 rounded-full transition-colors ${checked ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                          <div className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow transform transition-transform ${checked ? 'translate-x-6' : ''}`}></div>
                                        </label>

                                        <span className={`${aulaEnviada ? 'text-gray-400' : (checked ? 'text-green-600' : 'text-gray-700')} text-xs font-semibold`}>PRESENTE</span>
                                      </div>
                                    );
                                  })()
                                )}

                                {/* Badges adicionais (congelado, ausente, periodoTreino, parceria) */}
                                <div className="mt-2 flex items-center gap-2 flex-wrap">
                                  {/* Se o aluno foi reagendado para fora, mostrar badge indicando para qual data foi reagendado */}
                                  {foiReagendado && reagendamento && (
                                    <span className="inline-flex items-center gap-2 px-2 py-0.5 rounded text-xs font-medium border bg-gray-100 text-gray-600 border-gray-200">
                                      <i className="fas fa-exchange-alt text-gray-600 text-sm" />
                                      <span>Reagendado para {formatDateFromString(reagendamento.novaData)} às {reagendamento.novoHorarioInicio}</span>
                                    </span>
                                  )}
                                  {aluno.congelado && (
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-md font-medium border ${aulaStatus.get(horario.horarioFixoId || '')?.enviada ? 'bg-gray-100 text-gray-600 border-gray-200' : 'bg-sky-100 text-sky-700 border-sky-200'}`}>
                                      <i className={`fas fa-snowflake ${aulaStatus.get(horario.horarioFixoId || '')?.enviada ? 'text-gray-600' : ''}`}></i>
                                      <span>Congelado</span>
                                    </span>
                                  )}

                                  {aluno.ausente && (
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-md font-medium border ${aulaStatus.get(horario.horarioFixoId || '')?.enviada ? 'bg-gray-100 text-gray-600 border-gray-200' : 'bg-rose-100 text-rose-700 border-rose-200'}`}>
                                      <i className={`fas fa-user-clock ${aulaStatus.get(horario.horarioFixoId || '')?.enviada ? 'text-gray-600' : ''}`}></i>
                                      <span>Parou de Vir</span>
                                    </span>
                                  )}

                                  {aluno.periodoTreino === '12/36' && (
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${aulaStatus.get(horario.horarioFixoId || '')?.enviada ? 'bg-gray-100 text-gray-600 border-gray-200' : 'bg-green-50 text-green-700 border-green-100'}`}>
                                      <i className={`fas fa-clock text-xs ${aulaStatus.get(horario.horarioFixoId || '')?.enviada ? 'text-gray-600' : ''}`}></i>
                                      <span>12/36</span>
                                    </span>
                                  )}

                                  {String(aluno.parceria || '').toLowerCase() === 'totalpass' && (
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${aulaStatus.get(horario.horarioFixoId || '')?.enviada ? 'bg-gray-100 text-gray-600 border-gray-200' : 'bg-purple-50 text-purple-700 border-purple-100'}`}>
                                      <img
                                        src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAC1UlEQVR4AbyWg5LlQBiFY3uSu7Zt27Zt27Zt27Zt60G2tC8w/3aWk/qvkkGqzuU53V+7qSwPQ6S5rttM07Sptm3PJZqXQ5pLypwci8UakjoUIpoo8HDE1EgQhC/kcyYR5IZoms6UJOmtaZo1/zT418OSypuwLPsDh3JHpK7vlmXV+NsTBmn5N2zMXZGeeEneZcpxnLYpA7k0HGS+1aZUVZ336wdZAGNNHzDX9wupvmCs6gVsASs0hKIooykyO5f6X4RaxcH7sCya3i4BRpdDAxiGMeUfgDqyWWQA+9Q4VHhoAHP74MgA2uyO2QfQF3cDi0D8077hcStzzk0M+nYMBnNtX1CHN/0lZWhjUAY1DEjuXgv4qkWA5piEAHitFs2IC8CVzR/0kcnnvU+vpzKuTgOhXqn0AKTO1VEB7qN5QLNM0Neharghe70Y+IoFUwPoS7qhsLllIPbN7xx6zpgb+qUAoClwLk1BQWVwIwTgnJ8UGiDj1ozkAIyrxx1XvnLhoM9WwXu3NDzAvdnJAcRWlVDIfbYAaJ4N+pqVj7ZvHB6VHECb1QGFrF1DAPmmtY0EoI5qlhyA7Gw4NLIpIN/R0aErdx/P84cuMQCjS+C9WYKCfM3iwdNMFcF7HfClFpkvYpvKyfcBoWEZTP1yEdASDwFfnZLhWv5wLogtK6beCdUJrVDY2j8Cdb86tgWu6D2R33u+Xi8G98l8sMiEU4Y1AcZU/FxqAOvACFSwOr4lClt7h+FDaU4nv6d+S+CAommUSwkgtqgIcrdaWYUuG37h7vOFCIAs3+inYRjxVYrE7X7G0/MGgGzJ+Ji+MtXfwvMGwNw8AAHoy7pHu5Coqjo3bNDfKX8OvXHKZqlCVqN0wJvlA98xAQImYNfMBthd+kDnrpkBcieVBRgVVsCQOEPrzinQjqPQfiETAzKACnCLioragbrSwFAppSYGmpkF7J5bQoId4XMA6lRclYDTIrUAAAAASUVORK5CYII="
                                        alt="TOTALPASS"
                                        className="w-3 h-3 bg-gray-100 rounded-sm"
                                        style={{ width: '12px', height: '12px' }}
                                      />
                                      <span>TOTALPASS</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {/* Reagendados PARA DENTRO */}
                      {alunosReagendadosParaDentro(horario.horarioFixoId).map((aluno: any) => {
                        const reag = (aluno as any)._reagendamento;
                        const reagId = reag?._id || '';
                        // Para reposições, usar o ID do aluno, para reagendamentos usar o ID do reagendamento
                        const alunoIdentifier = (reag?.isReposicao === true && aluno._id) ? aluno._id : reagId;
                        const statusPresenca = getPresencaStatus(alunoIdentifier, horario.horarioFixoId || '');
                        const aulaEnviada = aulaStatus.get(horario.horarioFixoId || '')?.enviada ?? false;
                        const isReposicao = reag?.isReposicao === true;

                        return (
                          <div
                            key={`reag-${reagId || aluno._id}`}
                            className={`p-3 rounded-md border shadow-sm transition-all ${aulaEnviada ? 'bg-gray-100 text-gray-500 filter grayscale border-gray-200' : isReposicao ? 'border-orange-200 bg-orange-50' : 'border-green-200 bg-green-50'}`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-10 h-10 rounded-full overflow-hidden flex items-center justify-center font-bold text-sm flex-shrink-0 ${aulaEnviada ? 'bg-gray-100 text-gray-600' : 'text-white'}`}
                                style={{ backgroundColor: aulaEnviada ? undefined : (isReposicao ? '#f97316' : '#22c55e') }}
                              >
                                {aluno.nome.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className={`${aulaEnviada ? 'text-gray-600 line-through' : 'font-semibold text-gray-900'} text-sm`}>{aluno.nome}</div>
                                
                                {/* Badge de reagendamento/reposição */}
                                <div className="mt-1">
                                  <span className={`${aulaEnviada ? 'inline-flex items-center gap-2 px-2 py-0.5 rounded text-xs font-medium bg-white text-gray-600 border border-gray-200' : isReposicao ? 'inline-flex items-center gap-2 px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 border border-orange-300' : 'inline-flex items-center gap-2 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 border border-green-300'}`}>
                                    <i className={`fas ${isReposicao ? 'fa-redo' : 'fa-exchange-alt'} ${aulaEnviada ? 'text-gray-600' : isReposicao ? 'text-orange-600' : 'text-green-600'} text-sm`} />
                                    {isReposicao ? 'Reposição' : 'Reagendamento'} de {formatDateFromString(reag?.dataOriginal)} às {(typeof reag?.horarioFixoId === 'object' ? reag.horarioFixoId.horarioInicio : (reag.horarioFixoId || '--:--'))}
                                  </span>
                                </div>

                                {/* Presença/Falta abaixo do badge */}
                                <div className="flex items-center gap-2 mt-2">
                                  <span className={`${aulaEnviada ? 'text-gray-400' : 'text-gray-700'} text-xs font-semibold`}>FALTOU</span>

                                  <label className={`relative inline-flex items-center ${aulaEnviada ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                                    <input
                                      type="checkbox"
                                      className="sr-only"
                                      checked={statusPresenca === true}
                                      disabled={aulaEnviada}
                                      onChange={(e) => marcarPresenca(alunoIdentifier, horario.horarioFixoId || '', e.target.checked)}
                                      aria-label={`Marcar presença de ${aluno.nome}`}
                                    />

                                    <div className={`w-12 h-6 rounded-full transition-colors ${statusPresenca ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                    <div className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow transform transition-transform ${statusPresenca ? 'translate-x-6' : ''}`}></div>
                                  </label>

                                  <span className={`${aulaEnviada ? 'text-gray-400' : (statusPresenca ? 'text-green-600' : 'text-gray-700')} text-xs font-semibold`}>PRESENTE</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Aulas Experimentais Aprovadas */}
                      {aulasExperimentaisDoHorario(horario.horarioFixoId).map((aulaExp) => {
                        const aulaEnviada = aulaStatus.get(horario.horarioFixoId || '')?.enviada ?? false;
                        const jaRegistrada = aulaExp.compareceu !== null;
                        const statusPresenca = getPresencaExperimentalStatus(aulaExp._id);

                        return (
                          <div
                            key={`exp-${aulaExp._id}`}
                            className={`p-3 rounded-md border shadow-sm transition-all ${
                              aulaEnviada || jaRegistrada
                                ? 'bg-gray-100 border-gray-200' 
                                : 'border-purple-300 bg-purple-50'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-10 h-10 rounded-full overflow-hidden flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                                  aulaEnviada || jaRegistrada ? 'bg-gray-200 text-gray-600' : 'bg-purple-500 text-white'
                                }`}
                              >
                                <i className="fas fa-user-plus text-sm"></i>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className={`${aulaEnviada || jaRegistrada ? 'text-gray-600' : 'font-semibold text-gray-900'} text-sm`}>
                                  {aulaExp.nomeExperimental}
                                </div>
                                
                                {/* Badge de Aula Experimental */}
                                <div className="mt-1 flex items-center gap-2 flex-wrap">
                                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${
                                    aulaEnviada || jaRegistrada
                                      ? 'bg-gray-200 text-gray-600 border border-gray-300'
                                      : 'bg-purple-100 text-purple-800 border border-purple-300'
                                  }`}>
                                    <i className={`fas fa-star ${aulaEnviada || jaRegistrada ? 'text-gray-500' : 'text-purple-600'}`}></i>
                                    Aula Experimental
                                  </span>
                                  
                                  {aulaExp.telefoneExperimental && (
                                    <a
                                      href={`https://wa.me/55${aulaExp.telefoneExperimental.replace(/\D/g, '')}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 border border-green-200 hover:bg-green-200 transition-colors"
                                    >
                                      <i className="fab fa-whatsapp"></i>
                                      {aulaExp.telefoneExperimental}
                                    </a>
                                  )}
                                </div>

                                {/* Observações */}
                                {aulaExp.observacoesExperimental && (
                                  <div className="text-xs text-gray-500 mt-1 italic">
                                    <i className="fas fa-comment text-gray-400 mr-1"></i>
                                    {aulaExp.observacoesExperimental}
                                  </div>
                                )}

                                {/* Status de presença já registrada */}
                                {jaRegistrada ? (
                                  <div className="mt-2">
                                    {aulaExp.compareceu ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold bg-green-100 text-green-700 border border-green-300">
                                        <i className="fas fa-check-circle"></i>
                                        Compareceu à aula experimental
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold bg-red-100 text-red-700 border border-red-300">
                                        <i className="fas fa-times-circle"></i>
                                        Não compareceu à aula experimental
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  /* Switch de Presença/Falta igual aos outros alunos */
                                  <div className="flex items-center gap-2 mt-2">
                                    <span className={`${aulaEnviada ? 'text-gray-400' : 'text-gray-700'} text-xs font-semibold`}>FALTOU</span>

                                    <label className={`relative inline-flex items-center ${aulaEnviada ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                                      <input
                                        type="checkbox"
                                        className="sr-only"
                                        checked={statusPresenca}
                                        disabled={aulaEnviada}
                                        onChange={(e) => marcarPresencaExperimental(aulaExp._id, e.target.checked)}
                                        aria-label={`Marcar presença de ${aulaExp.nomeExperimental}`}
                                      />

                                      <div className={`w-12 h-6 rounded-full transition-colors ${statusPresenca ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                      <div className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow transform transition-transform ${statusPresenca ? 'translate-x-6' : ''}`}></div>
                                    </label>

                                    <span className={`${aulaEnviada ? 'text-gray-400' : (statusPresenca ? 'text-green-600' : 'text-gray-700')} text-xs font-semibold`}>PRESENTE</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Alunos usando Crédito de Reposição */}
                      {alunosComCreditoDoHorario(horario.horarioFixoId).map((alunoCredito) => {
                        const aulaEnviada = aulaStatus.get(horario.horarioFixoId || '')?.enviada ?? false;
                        const presencaAtual = getPresencaStatus(alunoCredito._id, horario.horarioFixoId || '');

                        return (
                          <div
                            key={`credito-${alunoCredito._id}`}
                            className={`p-3 rounded-md border shadow-sm transition-all ${
                              aulaEnviada
                                ? 'bg-gray-100 border-gray-200' 
                                : 'border-teal-300 bg-teal-50'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-10 h-10 rounded-full overflow-hidden flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                                  aulaEnviada ? 'bg-gray-200 text-gray-600' : 'bg-teal-500 text-white'
                                }`}
                              >
                                <i className="fas fa-ticket text-sm"></i>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className={`${aulaEnviada ? 'text-gray-600' : 'font-semibold text-gray-900'} text-sm`}>
                                  {alunoCredito.nome}
                                </div>
                                
                                {/* Badge de Crédito */}
                                <div className="mt-1 flex items-center gap-2 flex-wrap">
                                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${
                                    aulaEnviada
                                      ? 'bg-gray-200 text-gray-600 border border-gray-300'
                                      : 'bg-teal-100 text-teal-800 border border-teal-300'
                                  }`}>
                                    <i className={`fas fa-ticket ${aulaEnviada ? 'text-gray-500' : 'text-teal-600'}`}></i>
                                    Usando Crédito
                                  </span>
                                  
                                  {alunoCredito.telefone && (
                                    <a
                                      href={`https://wa.me/55${alunoCredito.telefone.replace(/\D/g, '')}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 border border-green-200 hover:bg-green-200 transition-colors"
                                    >
                                      <i className="fab fa-whatsapp"></i>
                                      {alunoCredito.telefone}
                                    </a>
                                  )}
                                </div>

                                {/* Switch de Presença/Falta */}
                                <div className="flex items-center gap-2 mt-2">
                                  <span className={`${aulaEnviada ? 'text-gray-400' : 'text-gray-700'} text-xs font-semibold`}>FALTOU</span>

                                  <label className={`relative inline-flex items-center ${aulaEnviada ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                                    <input
                                      type="checkbox"
                                      className="sr-only"
                                      checked={presencaAtual}
                                      disabled={aulaEnviada}
                                      onChange={(e) => marcarPresenca(alunoCredito._id, horario.horarioFixoId || '', e.target.checked)}
                                      aria-label={`Marcar presença de ${alunoCredito.nome}`}
                                    />

                                    <div className={`w-12 h-6 rounded-full transition-colors ${presencaAtual ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                    <div className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow transform transition-transform ${presencaAtual ? 'translate-x-6' : ''}`}></div>
                                  </label>

                                  <span className={`${aulaEnviada ? 'text-gray-400' : (presencaAtual ? 'text-green-600' : 'text-gray-700')} text-xs font-semibold`}>PRESENTE</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  </div>

                  {/* Card de Aula Enviada */}
                  {aulaStatus.get(horario.horarioFixoId || '')?.enviada && (
                    <div className="p-4 border-t bg-gray-50">
                      <div className="flex items-center justify-center gap-2 text-gray-700">
                        <i className="fas fa-check-circle text-gray-600 text-lg"></i>
                        <span className="font-semibold text-sm">Aula Enviada com Sucesso</span>
                      </div>
                    </div>
                  )}

                  {/* Botão de Enviar Aula */}
                  {horariosExpandidos.has(horario.horarioFixoId || '') && !aulaStatus.get(horario.horarioFixoId || '')?.enviada && (() => {
                    const hoje = new Date();
                    hoje.setHours(0, 0, 0, 0);
                    const dataAula = new Date(dataSelecionada);
                    dataAula.setHours(0, 0, 0, 0);
                    const isAulaFutura = dataAula > hoje;
                    
                    return (
                      <div className="p-4 border-t bg-blue-50">
                        {isAulaFutura ? (
                          <div className="text-center py-3 px-4 rounded-md bg-yellow-100 border border-yellow-300 text-yellow-800">
                            <i className="fas fa-clock mr-2"></i>
                            Não é possível enviar aulas de datas futuras
                          </div>
                        ) : (
                          <button
                            onClick={() => enviarAula(horario.horarioFixoId || '')}
                            disabled={enviandoAula}
                            className={`w-full py-3 px-4 rounded-md font-bold transition-all flex items-center justify-center gap-2 ${enviandoAula ? 'cursor-not-allowed' : 'shadow-sm hover:opacity-95 active:scale-95'}`}
                            style={enviandoAula ? { backgroundColor: '#D1D5DB', color: '#6B7280' } : { backgroundColor: horario.modalidade?.cor || '#2563EB', color: '#FFFFFF' }}
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
                        )}
                      </div>
                    );
                  })()}
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
