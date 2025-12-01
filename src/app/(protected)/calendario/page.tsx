'use client';

import { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import ProtectedPage from '@/components/ProtectedPage';
import ReporFaltaModal from '@/components/ReporFaltaModal';
import { usePermission } from '@/hooks/usePermission';

interface Modalidade {
  _id: string;
  nome: string;
  cor?: string;
  limiteAlunos?: number;
}

// Local lightweight types to satisfy TypeScript in this file
interface Aluno {
  _id?: string;
  nome?: string;
  congelado?: boolean;
  ausente?: boolean;
  emEspera?: boolean;
  observacoes?: string;
  periodoTreino?: string | null;
  parceria?: string | null;
}

interface Matricula {
  _id?: string;
  emEspera?: boolean;
  alunoId?: Aluno | string | any;
}

interface Reagendamento {
  _id?: string;
  horarioFixoId?: string | { _id?: string } | any;
  matriculaId?: string | { _id?: string; alunoId?: Aluno | any } | any;
  dataOriginal?: string;
  novaData?: string;
  novoHorarioFixoId?: string | { _id?: string; professorId?: any } | any;
  novoHorarioInicio?: string;
  novoHorarioFim?: string;
  motivo?: string;
  status?: string;
  isReposicao?: boolean;
  alunoId?: Aluno | any;
}

interface HorarioFixo {
  _id?: string;
  diaSemana?: number;
  horarioInicio?: string;
  horarioFim?: string;
  matriculas?: Matricula[];
  modalidadeId?: string | Modalidade | any;
  professorId?: string | { nome?: string; cor?: string } | any;
  observacaoTurma?: string;
}

export default function CalendarioPage() {
  const [modalidades, setModalidades] = useState<Modalidade[]>([]);
  const [modalidadeSelecionada, setModalidadeSelecionada] = useState<string>('');
  const [horarios, setHorarios] = useState<HorarioFixo[]>([]);
  const [reagendamentos, setReagendamentos] = useState<Reagendamento[]>([]);
  const [horariosDisponiveis, setHorariosDisponiveis] = useState<HorarioFixo[]>([]);
  const [datasExpandidas, setDatasExpandidas] = useState<Set<string>>(new Set());
  const [dataSelecionadaReagendamento, setDataSelecionadaReagendamento] = useState<string>('');
  const [horarioNovoSelecionado, setHorarioNovoSelecionado] = useState<string>('');
  const [reagendamentoModal, setReagendamentoModal] = useState<any | null>(null);
  const [horarioSelecionado, setHorarioSelecionado] = useState<HorarioFixo | null>(null);
  const [dataClicada, setDataClicada] = useState<Date | null>(null);
  const [year, setYear] = useState<number>(0);
  const [month, setMonth] = useState<number>(0);
  const [todayString, setTodayString] = useState<string>('');
  const [paginaDiasReagendamento, setPaginaDiasReagendamento] = useState<number>(0);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  // Estado para armazenar faltas de aulas realizadas
  const [aulasRealizadas, setAulasRealizadas] = useState<any[]>([]);
  // Flag para saber se o componente foi montado no cliente
  const [mounted, setMounted] = useState<boolean>(false);
  // Estado para alternar entre visualização calendário e lista
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  // Estado do usuário logado
  const [currentUser, setCurrentUser] = useState<{ id?: string; tipo?: string } | null>(null);
  // Estado para dias expandidos no accordion mobile (array de índices)
  const [diasExpandidos, setDiasExpandidos] = useState<number[]>([]);
  // Estado para modal de reposição de falta
  const [showReporModal, setShowReporModal] = useState(false);
  const [faltaSelecionada, setFaltaSelecionada] = useState<any>(null);
  const [alunoReposicao, setAlunoReposicao] = useState<any>(null);

  const diasSemana = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

  // Detectar se é mobile e setar visualização em lista automaticamente
  useEffect(() => {
    const checkMobile = () => {
      if (window.innerWidth < 768) {
        setViewMode('list');
      }
    };
    
    // Verificar no mount
    checkMobile();
    
    // Adicionar listener para resize (caso usuário mude orientação)
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Carregar dados do usuário logado
  useEffect(() => {
    const userRaw = localStorage.getItem('user');
    if (userRaw) {
      try {
        const user = JSON.parse(userRaw);
        setCurrentUser({ id: user.id || user._id, tipo: user.tipo });
      } catch (e) {
        console.error('Erro ao parsear usuário:', e);
      }
    }
  }, []);

  // Inicializar datas apenas no cliente para evitar hydration mismatch
  useEffect(() => {
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth());
    setTodayString(now.toISOString().split('T')[0]);
    setMounted(true);
  }, []);

  const formatDateToISO = (input: any) => {
    try {
      if (!input) return '';
      const d = typeof input === 'string' ? new Date(input) : (input instanceof Date ? input : new Date(String(input)));
      if (isNaN(d.getTime())) return '';
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    } catch (e) {
      return '';
    }
  };

  const parseDateISO = (s: string) => {
    try {
      return new Date(s);
    } catch (e) {
      return new Date(s);
    }
  };

  // Parse only the date portion (YYYY-MM-DD) into a local Date at midnight
  const parseDateOnly = (s: string) => {
    try {
      if (!s) return new Date('');
      const datePart = (typeof s === 'string' && s.indexOf('T') !== -1) ? s.split('T')[0] : String(s).slice(0, 10);
      const parts = datePart.split('-').map(Number);
      if (parts.length !== 3 || parts.some(isNaN)) return new Date(s);
      const [y, m, d] = parts;
      return new Date(y, m - 1, d);
    } catch (e) {
      return new Date(s);
    }
  };

  // Fade transition when modalidadeSelecionada changes
  useEffect(() => {
    setIsTransitioning(true);
    const timer = setTimeout(() => {
      setIsTransitioning(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [modalidadeSelecionada]);

  // Debug: log horarios state changes
  useEffect(() => {
    // Estado de horarios atualizado
  }, [horarios]);

  // Inicializar data apenas no cliente
  useEffect(() => {
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth());
    setTodayString(now.toDateString());
    
    // Recuperar modalidade selecionada do localStorage
    const savedModalidade = localStorage.getItem('calendario-modalidade-selecionada');
    if (savedModalidade) {
      setModalidadeSelecionada(savedModalidade);
    }
  }, []);

  // Resetar paginação de dias quando o modal de reagendamento abrir/fechar
  useEffect(() => {
    setPaginaDiasReagendamento(0);
  }, [reagendamentoModal]);

  // Salvar modalidade selecionada no localStorage quando mudar
  useEffect(() => {
    if (modalidadeSelecionada) {
      localStorage.setItem('calendario-modalidade-selecionada', modalidadeSelecionada);
    }
  }, [modalidadeSelecionada]);

  // Buscar modalidades separadamente (filtradas por professor se não for admin/root)
  useEffect(() => {
    const fetchModalidades = async () => {
      if (!currentUser) return; // Aguardar currentUser carregar
      
      try {
        const res = await fetch('/api/modalidades');
        const data = await res.json();
        
        if (data.success) {
          let modalidadesData = data.data || [];
          
          // Se for professor, filtrar apenas modalidades onde ele tem horários
          if (currentUser.tipo === 'professor' && currentUser.id) {
            // Buscar todos os horários para descobrir quais modalidades o professor tem
            const horariosRes = await fetch('/api/horarios');
            const horariosData = await horariosRes.json();
            
            if (horariosData.success) {
              const todosHorarios = horariosData.data || [];
              // Pegar IDs das modalidades onde o professor tem horários
              const modalidadesDoProf = new Set<string>();
              todosHorarios.forEach((h: any) => {
                const profId = typeof h.professorId === 'string' ? h.professorId : h.professorId?._id;
                if (String(profId) === String(currentUser.id)) {
                  const modId = typeof h.modalidadeId === 'string' ? h.modalidadeId : h.modalidadeId?._id;
                  if (modId) modalidadesDoProf.add(String(modId));
                }
              });
              
              // Filtrar modalidades
              modalidadesData = modalidadesData.filter((m: Modalidade) => 
                modalidadesDoProf.has(String(m._id))
              );
            }
          }
          
          setModalidades(modalidadesData);
          
          // Verificar se há uma modalidade salva no localStorage
          const savedModalidade = localStorage.getItem('calendario-modalidade-selecionada');
          
          if (savedModalidade && modalidadesData.some((m: Modalidade) => m._id === savedModalidade)) {
            // Se a modalidade salva ainda existe, usar ela
            setModalidadeSelecionada(savedModalidade);
          } else if (modalidadesData.length > 0 && modalidadesData[0]._id) {
            // Caso contrário, selecionar a primeira
            setModalidadeSelecionada(String(modalidadesData[0]._id));
          }
        }
      } catch (e) {
        // Erro ao buscar modalidades
      }
    };
    
    fetchModalidades();
  }, [currentUser]);

  // Buscar horários quando a modalidade mudar
  useEffect(() => {
    const fetchHorarios = async () => {
      if (!modalidadeSelecionada) {
        return;
      }

      try {
        const res = await fetch(`/api/horarios?modalidadeId=${modalidadeSelecionada}`);
        const data = await res.json();

        if (data.success) {
          const horariosData = data.data || [];
          setHorarios(horariosData);
        }
      } catch (e) {
        // Erro ao buscar horários
      }
    };
    
    const fetchReagendamentos = async () => {
      try {
        console.log('[Calendario] Buscando reagendamentos...');
        const res = await fetch('/api/reagendamentos');
        const data = await res.json();
        
        console.log('[Calendario] Resposta reagendamentos:', data);
        
        if (data.success) {
          const reagendamentosData = data.data || [];
          console.log('[Calendario] Reagendamentos recebidos:', reagendamentosData.length);
          console.log('[Calendario] Reagendamentos completos:', reagendamentosData);
          
          // Log detalhado de cada reagendamento
          reagendamentosData.forEach((r: Reagendamento, idx: number) => {
            console.log(`[Calendario] Reagendamento ${idx}:`, {
              id: r._id,
              horarioFixoId: typeof r.horarioFixoId === 'string' ? r.horarioFixoId : r.horarioFixoId?._id,
              matriculaId: typeof r.matriculaId === 'string' ? r.matriculaId : r.matriculaId?._id,
              alunoNome: typeof r.matriculaId === 'object' && r.matriculaId?.alunoId 
                ? (typeof r.matriculaId.alunoId === 'string' ? 'ID apenas' : r.matriculaId.alunoId?.nome)
                : 'N/A',
              dataOriginal: r.dataOriginal,
              novaData: r.novaData,
              status: r.status
            });
          });
          
          setReagendamentos(reagendamentosData);
        }
      } catch (e) {
        console.error('[Calendario] Erro ao buscar reagendamentos:', e);
      }
    };

    // Buscar aulas realizadas para verificar faltas
    const fetchAulasRealizadas = async () => {
      try {
        console.log('[Calendario] Buscando aulas realizadas...');
        const res = await fetch('/api/aulas-realizadas?listarTodas=true');
        const data = await res.json();
        console.log('[Calendario] Resposta aulas-realizadas:', { isArray: Array.isArray(data), length: Array.isArray(data) ? data.length : 'N/A', data });
        // A API retorna diretamente o array quando listarTodas=true
        if (Array.isArray(data)) {
          setAulasRealizadas(data);
          console.log('[Calendario] Aulas realizadas carregadas:', data.length);
        } else if (data.success) {
          setAulasRealizadas(data.data || []);
        } else {
          console.log('[Calendario] Resposta não é array:', data);
        }
      } catch (e) {
        console.error('[Calendario] Erro ao buscar aulas realizadas:', e);
      }
    };
    
    fetchHorarios();
    fetchReagendamentos();
    fetchAulasRealizadas();
  }, [modalidadeSelecionada]);

  // Pegar horários para uma data específica (baseado no dia da semana)
  const getHorariosForDate = (date: Date) => {
    const dow = date.getDay(); // 0 = Domingo, 6 = Sábado
    const horariosNoDia = horarios.filter(h => h.diaSemana === dow);
    console.log(`[Calendario] Data: ${date.toLocaleDateString()}, Dia da semana: ${dow} (${diasSemana[dow]}), Horários: ${horariosNoDia.length}`);
    return horariosNoDia;
  };

  // Verificar se há reagendamentos para uma data específica
  const getReagendamentosForDate = (date: Date) => {
    const dataStr = formatDateToISO(date);
    
    // Reagendamentos de origem (aluno faltará neste dia - aparece riscado)
    const reagendamentosOrigem = reagendamentos.filter(r => 
      r.dataOriginal === dataStr && r.status === 'aprovado'
    );
    
    // Reagendamentos de destino (aluno virá neste dia - aparece como reagendado)
    const reagendamentosDestino = reagendamentos.filter(r => 
      r.novaData === dataStr && r.status === 'aprovado'
    );
    
    return { origem: reagendamentosOrigem, destino: reagendamentosDestino };
  };

  // Verificar se a aula já foi registrada para este horário e data
  const verificarAulaRegistrada = (horarioFixoId: string, data: Date) => {
    const dataStr = formatDateToISO(data);
    
    const found = aulasRealizadas.some((aula: any) => {
      const aulaHorarioId = typeof aula.horarioFixoId === 'string' 
        ? aula.horarioFixoId 
        : aula.horarioFixoId?._id;
      const aulaDataStr = aula.data?.split('T')[0];
      const match = aulaHorarioId === horarioFixoId && aulaDataStr === dataStr;
      if (match) {
        console.log('[Calendario] Aula encontrada para:', { horarioFixoId, dataStr, aulaHorarioId, aulaDataStr });
      }
      return match;
    });
    
    console.log('[Calendario] verificarAulaRegistrada:', { horarioFixoId, dataStr, found, totalAulas: aulasRealizadas.length });
    return found;
  };

  // Obter estatísticas de presença/falta de uma aula realizada
  const obterEstatisticasAula = (horarioFixoId: string, data: Date) => {
    const dataStr = formatDateToISO(data);
    
    const aulaRealizada = aulasRealizadas.find((aula: any) => {
      const aulaHorarioId = typeof aula.horarioFixoId === 'string' 
        ? aula.horarioFixoId 
        : aula.horarioFixoId?._id;
      const aulaDataStr = aula.data?.split('T')[0];
      return aulaHorarioId === horarioFixoId && aulaDataStr === dataStr;
    });
    
    if (!aulaRealizada) return null;
    
    // Usar os totais se disponíveis, senão calcular
    if (aulaRealizada.total_presentes !== undefined && aulaRealizada.total_faltas !== undefined) {
      return {
        presentes: aulaRealizada.total_presentes,
        faltas: aulaRealizada.total_faltas
      };
    }
    
    // Calcular baseado na lista de alunos
    let presentes = 0;
    let faltas = 0;
    aulaRealizada.alunos?.forEach((a: any) => {
      if (a.presente === true) presentes++;
      else if (a.presente === false) faltas++;
    });
    
    return { presentes, faltas };
  };

  // Verificar se um aluno faltou em uma determinada data/horário
  const verificarFaltaAluno = (alunoId: string, horarioFixoId: string, data: Date, reagendamentoId?: string) => {
    const dataStr = formatDateToISO(data);
    
    // Buscar aula realizada para este horário e data
    const aulaRealizada = aulasRealizadas.find((aula: any) => {
      const aulaHorarioId = typeof aula.horarioFixoId === 'string' 
        ? aula.horarioFixoId 
        : aula.horarioFixoId?._id;
      const aulaDataStr = aula.data?.split('T')[0];
      return aulaHorarioId === horarioFixoId && aulaDataStr === dataStr;
    });
    
    if (!aulaRealizada) return null;
    
    // Verificar se o aluno está na lista de alunos e faltou
    // Tentar buscar por alunoId ou reagendamentoId (para reagendamentos normais)
    const alunoNaAula = aulaRealizada.alunos?.find((a: any) => {
      const aId = typeof a.alunoId === 'string' ? a.alunoId : a.alunoId?._id;
      const matchAlunoId = aId === alunoId;
      const matchReagId = reagendamentoId && aId === reagendamentoId;
      return (matchAlunoId || matchReagId) && a.presente === false;
    });
    
    if (!alunoNaAula) return null;
    
    // Verificar se há reposição para esta falta
    const reposicao = reagendamentos.find(r => {
      const rAlunoId = typeof r.alunoId === 'string' ? r.alunoId : (r.alunoId as any)?._id;
      const rDataOriginal = r.dataOriginal?.split('T')[0];
      return r.isReposicao === true && 
             rAlunoId === alunoId && 
             rDataOriginal === dataStr;
    });
    
    return {
      faltou: true,
      aulaRealizadaId: aulaRealizada._id,
      reposicao: reposicao || null
    };
  };

  // Verificar se um aluno esteve presente em uma determinada data/horário
  const verificarPresencaAluno = (alunoId: string, horarioFixoId: string, data: Date, reagendamentoId?: string) => {
    const dataStr = formatDateToISO(data);
    
    // Buscar aula realizada para este horário e data
    const aulaRealizada = aulasRealizadas.find((aula: any) => {
      const aulaHorarioId = typeof aula.horarioFixoId === 'string' 
        ? aula.horarioFixoId 
        : aula.horarioFixoId?._id;
      const aulaDataStr = aula.data?.split('T')[0];
      return aulaHorarioId === horarioFixoId && aulaDataStr === dataStr;
    });
    
    if (!aulaRealizada) return false;
    
    // Verificar se o aluno está na lista de alunos e esteve presente
    // Tentar buscar por alunoId ou reagendamentoId (para reagendamentos normais)
    const alunoNaAula = aulaRealizada.alunos?.find((a: any) => {
      const aId = typeof a.alunoId === 'string' ? a.alunoId : a.alunoId?._id;
      const matchAlunoId = aId === alunoId;
      const matchReagId = reagendamentoId && aId === reagendamentoId;
      return (matchAlunoId || matchReagId) && a.presente === true;
    });
    
    return !!alunoNaAula;
  };

  // Verificar presença/falta em uma reposição
  // Busca pela data nova (data da reposição), não pela data original
  const verificarPresencaEmReposicao = (alunoId: string, reposicao: any) => {
    if (!reposicao || !reposicao.novoHorarioFixoId || !reposicao.novaData) {
      return null;
    }

    const novoHorarioId = typeof reposicao.novoHorarioFixoId === 'string'
      ? reposicao.novoHorarioFixoId
      : reposicao.novoHorarioFixoId._id;
    
    const dataStr = reposicao.novaData?.split('T')[0];

    // Buscar aula realizada para este horário e data da reposição
    const aulaRealizada = aulasRealizadas.find((aula: any) => {
      const aulaHorarioId = typeof aula.horarioFixoId === 'string'
        ? aula.horarioFixoId
        : aula.horarioFixoId?._id;
      const aulaDataStr = aula.data?.split('T')[0];
      return aulaHorarioId === novoHorarioId && aulaDataStr === dataStr;
    });

    if (!aulaRealizada) return null;

    // Verificar se o aluno esteve presente
    const alunoNaAula = aulaRealizada.alunos?.find((a: any) => {
      const aId = typeof a.alunoId === 'string' ? a.alunoId : a.alunoId?._id;
      return aId === alunoId;
    });

    if (!alunoNaAula) return null;

    return {
      presente: alunoNaAula.presente === true,
      faltou: alunoNaAula.presente === false
    };
  };

  const abrirReagendamento = (aluno: Aluno, matricula: Matricula, horarioOriginal: HorarioFixo, dataOriginal: Date) => {
    // Validar se aluno pode ser reagendado
    if (aluno?.congelado || aluno?.ausente || aluno?.emEspera) {
      const motivo = aluno?.congelado 
        ? 'congelado' 
        : (aluno?.ausente ? 'parou de vir' : 'em espera');
      toast.error(`Não é possível reagendar este aluno. O aluno está ${motivo}.`);
      return;
    }

    setReagendamentoModal({
      aluno,
      matricula,
      horarioOriginal,
      dataOriginal
    });
    setDataSelecionadaReagendamento('');
    setHorarioNovoSelecionado('');
    setDatasExpandidas(new Set());
    
    // Buscar todos os horários disponíveis nos próximos 30 dias
    buscarTodosHorariosDisponiveis();
  };

  const cancelarReagendamento = async (reagendamentoId: string) => {
    const result = await Swal.fire({
      title: 'Tem certeza?',
      text: 'Deseja realmente cancelar este reagendamento?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sim, cancelar',
      cancelButtonText: 'Não'
    });
    
    if (!result.isConfirmed) {
      return;
    }

    try {
      console.log('[Reagendamento] Cancelando:', reagendamentoId);

      const res = await fetch(`/api/reagendamentos/${reagendamentoId}`, {
        method: 'DELETE'
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Reagendamento cancelado com sucesso!');
        setHorarioSelecionado(null);
        setDataClicada(null);
        // Recarregar a página para atualizar os dados
        window.location.reload();
      } else {
        toast.error(`Erro: ${data.error || 'Não foi possível cancelar o reagendamento'}`);
      }
    } catch (e) {
      console.error('[Reagendamento] Erro ao cancelar:', e);
      toast.error('Erro ao cancelar reagendamento');
    }
  };

  const toggleDataExpandida = (dataStr: string) => {
    setDatasExpandidas(prev => {
      // Se já está expandido, fecha
      if (prev.has(dataStr)) {
        return new Set();
      }
      // Se não está expandido, fecha todos os outros e abre apenas este
      return new Set([dataStr]);
    });
  };

  const buscarTodosHorariosDisponiveis = async () => {
    if (!modalidadeSelecionada) return;

    try {
      const res = await fetch(`/api/horarios?modalidadeId=${modalidadeSelecionada}`);
      const data = await res.json();
      
      if (data.success) {
        setHorariosDisponiveis(data.data || []);
      }
    } catch (e) {
      console.error('[Reagendamento] Erro ao buscar horários:', e);
    }
  };

  // Gerar próximos 30 dias com horários disponíveis (a partir da data de reagendamento)
  const gerarProximosDias = () => {
    if (!reagendamentoModal) return [];

    const dias: Array<{ data: Date; horarios: HorarioFixo[] }> = [];
    // Começar a partir da data selecionada para reagendamento
    const start = new Date(reagendamentoModal.dataOriginal);
    start.setHours(0, 0, 0, 0);

    for (let i = 0; i < 30; i++) {
      const data = new Date(start);
      data.setDate(start.getDate() + i);

      const dow = data.getDay();
      const horariosNoDia = horariosDisponiveis.filter(h => h.diaSemana === dow);

      if (horariosNoDia.length > 0) {
        dias.push({ data, horarios: horariosNoDia });
      }
    }

    return dias;
  };

  // Retorna o número real de alunos para um horário em uma data específica
  const countAlunosForHorario = (horario: HorarioFixo, date: Date) => {
    const dateStr = formatDateToISO(date);

    const numAlunosFixos = horario.matriculas?.filter((m: any) => {
      const isEmEspera = m.emEspera || m.alunoId?.emEspera;
      const isCongelado = m.alunoId?.congelado;
      const isAusente = m.alunoId?.ausente;
      return !isEmEspera && !isCongelado && !isAusente;
    }).length || 0;

    const alunosQueSaem = reagendamentos.filter((r: any) => {
      const horarioFixoId = typeof r.horarioFixoId === 'string' ? r.horarioFixoId : r.horarioFixoId?._id;
      const dataOriginalNormalizada = r.dataOriginal?.split('T')[0];
      return horarioFixoId === horario._id && dataOriginalNormalizada === dateStr && r.status !== 'rejeitado';
    }).length;

    const alunosQueChegam = reagendamentos.filter((r: any) => {
      const novoHorarioFixoId = typeof r.novoHorarioFixoId === 'string' ? r.novoHorarioFixoId : r.novoHorarioFixoId?._id;
      const novaDataNormalizada = r.novaData?.split('T')[0];
      return novoHorarioFixoId === horario._id && novaDataNormalizada === dateStr && r.status !== 'rejeitado';
    }).length;

    return numAlunosFixos - alunosQueSaem + alunosQueChegam;
  };

  const confirmarReagendamento = async () => {
    if (!reagendamentoModal || !dataSelecionadaReagendamento || !horarioNovoSelecionado) {
      toast.error('Por favor, selecione uma data e um horário');
      return;
    }

    try {
      const horarioNovo = horariosDisponiveis.find(h => h._id === horarioNovoSelecionado);
      if (!horarioNovo) {
        toast.error('Horário não encontrado');
        return;
      }

      // Verificar se o usuário é admin para aprovar automaticamente
      const userRaw = localStorage.getItem('user');
      const user = userRaw ? JSON.parse(userRaw) : null;
      const isAdminOrRoot = user?.tipo === 'admin' || user?.tipo === 'root';

      const body = {
        horarioFixoId: reagendamentoModal.horarioOriginal._id,
        dataOriginal: formatDateToISO(reagendamentoModal.dataOriginal),
        novaData: dataSelecionadaReagendamento,
        novoHorarioInicio: horarioNovo.horarioInicio,
        novoHorarioFim: horarioNovo.horarioFim,
        novoHorarioFixoId: horarioNovo._id,
        matriculaId: reagendamentoModal.matricula._id,
        motivo: `Reagendamento de ${reagendamentoModal.horarioOriginal.horarioInicio}-${reagendamentoModal.horarioOriginal.horarioFim} para ${horarioNovo.horarioInicio}-${horarioNovo.horarioFim}`,
        // Se for admin, já aprova automaticamente
        status: isAdminOrRoot ? 'aprovado' : 'pendente'
      };

      console.log('[Reagendamento] Enviando:', body);

      const res = await fetch('/api/reagendamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Reagendamento criado com sucesso!');
        setReagendamentoModal(null);
        setHorarioSelecionado(null);
        // Recarregar a página para atualizar os dados
        window.location.reload();
      } else {
        toast.error(`Erro: ${data.error || 'Não foi possível criar o reagendamento'}`);
      }
    } catch (e) {
      console.error('[Reagendamento] Erro ao confirmar:', e);
      toast.error('Erro ao criar reagendamento');
    }
  };

  const monthData = useMemo(() => {
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const days: Array<{ date: Date; day: number; dow: number }> = [];
    
    const padStart = first.getDay();
    for (let i = 0; i < padStart; i++) {
      const d = new Date(first);
      d.setDate(d.getDate() - (padStart - i));
      days.push({ date: d, day: d.getDate(), dow: d.getDay() });
    }
    
    for (let d = 1; d <= last.getDate(); d++) {
      const dt = new Date(year, month, d);
      days.push({ date: dt, day: d, dow: dt.getDay() });
    }
    
    while (days.length % 7 !== 0) {
      const lastD = days[days.length - 1].date;
      const dt = new Date(lastD);
      dt.setDate(dt.getDate() + 1);
      days.push({ date: dt, day: dt.getDate(), dow: dt.getDay() });
    }
    
    return days;
  }, [year, month]);

  // Preparar paginação dos próximos dias para reagendamento (4 dias por página)
  const diasDisponiveisReag = gerarProximosDias();
  const totalPagesReag = Math.max(1, Math.ceil(diasDisponiveisReag.length / 4));
  const paginaAtualReag = Math.min(paginaDiasReagendamento, Math.max(0, totalPagesReag - 1));
  const diasMostradosReag = diasDisponiveisReag.slice(paginaAtualReag * 4, paginaAtualReag * 4 + 4);

  const prevMonth = () => {
    const dt = new Date(year, month - 1, 1);
    setYear(dt.getFullYear());
    setMonth(dt.getMonth());
  };

  const nextMonth = () => {
    const dt = new Date(year, month + 1, 1);
    setYear(dt.getFullYear());
    setMonth(dt.getMonth());
  };

  // Alunos do dia para o header (usa data clicada se houver, senão hoje)
  const alunosDoDiaCount = useMemo(() => {
    // Se não há um horário selecionado, retornar 0 (o header do modal mostra só para o horário atual)
    if (!horarioSelecionado) return 0;

    const date = dataClicada || new Date();
    const dataStr = formatDateToISO(date);

    // Contar apenas alunos ativos deste horário
    const totalMatriculados = horarioSelecionado.matriculas?.filter((m: any) => {
      const isEmEspera = m.emEspera || m.alunoId?.emEspera;
      const isCongelado = m.alunoId?.congelado;
      const isAusente = m.alunoId?.ausente;
      return !isEmEspera && !isCongelado && !isAusente;
    }).length || 0;

    // Contar alunos que faltaram (reagendamentos cuja origem é este horário nesta data)
    // Só conta se status for aprovado
    const alunosFaltarao = reagendamentos.filter((r: any) => {
      const horarioFixoId = typeof r.horarioFixoId === 'string' ? r.horarioFixoId : r.horarioFixoId?._id;
      const dataOriginalNormalizada = r.dataOriginal?.split('T')[0];
      return horarioFixoId === horarioSelecionado._id && dataOriginalNormalizada === dataStr && r.status === 'aprovado';
    }).length;

    // Contar alunos que virão (reagendamentos cuja destino é este horário nesta data)
    // Só conta se status for aprovado
    const alunosVirao = reagendamentos.filter((r: any) => {
      const novoHorarioFixoId = typeof r.novoHorarioFixoId === 'string' ? r.novoHorarioFixoId : r.novoHorarioFixoId?._id;
      const novaDataNormalizada = r.novaData?.split('T')[0];
      return novoHorarioFixoId === horarioSelecionado._id && novaDataNormalizada === dataStr && r.status === 'aprovado';
    }).length;

    return totalMatriculados - alunosFaltarao + alunosVirao;
  }, [horarios, reagendamentos, dataClicada, year, month]);

  const headerDateStr = useMemo(() => {
    const dt = dataClicada || new Date();
    return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }, [dataClicada, year, month]);

  // Skeleton loading enquanto não está montado no cliente
  if (!mounted) {
    return (
      <ProtectedPage tab="calendario" title="Calendário - Superação Flux" fullWidth>
        <div className="w-full px-4 py-6 sm:px-0">
          {/* Header skeleton */}
          <div className="mb-6">
            <div className="h-5 bg-gray-200 rounded w-32 mb-2 animate-pulse" />
            <div className="h-4 bg-gray-200 rounded w-64 animate-pulse" />
          </div>
          
          {/* Filtros skeleton */}
          <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="h-4 bg-gray-200 rounded w-40 animate-pulse hidden md:block" />
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 bg-gray-200 rounded-full animate-pulse" />
              <div className="h-9 w-32 bg-gray-200 rounded-md animate-pulse" />
              <div className="h-9 w-9 bg-gray-200 rounded-full animate-pulse" />
            </div>
          </div>
          
          {/* Modalidades skeleton */}
          <div className="mb-6 flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-9 bg-gray-200 rounded-full w-20 animate-pulse" />
            ))}
          </div>
          
          {/* Calendário skeleton */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            {/* Dias da semana header */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((dia, i) => (
                <div key={i} className="h-8 bg-gray-100 rounded flex items-center justify-center">
                  <span className="text-xs text-gray-400 font-medium">{dia}</span>
                </div>
              ))}
            </div>
            {/* Células do calendário */}
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 35 }).map((_, i) => (
                <div key={i} className="h-16 md:h-20 bg-gray-50 rounded border border-gray-100 p-1 animate-pulse">
                  <div className="h-4 w-4 bg-gray-200 rounded mb-1" />
                  <div className="hidden md:block h-2 bg-gray-200 rounded w-full mt-1" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </ProtectedPage>
    );
  }

  return (
    <ProtectedPage tab="calendario" title="Calendário - Superação Flux" fullWidth>
        <div className="w-full px-4 py-6 sm:px-0">
          <div className="sm:flex sm:items-center mb-6 fade-in-1">
            <div className="sm:flex-auto">
              <h1 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <i className="fas fa-calendar-alt text-primary-600"></i>
                Calendário
              </h1>
              <p className="mt-2 text-sm text-gray-600">
                Visualize os horários por modalidade de forma organizada.
              </p>
              
            </div>
          </div>

          {/* Seletor de Modalidade + Navegação de mês */}
          <div className="mb-6 fade-in-2">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-3 gap-3">
              <label className="text-sm font-semibold text-gray-700 hidden md:block">
                <i className="fas fa-filter mr-2 text-primary-600"></i>
                Selecione a Modalidade
              </label>
              {/* Navegação de mês - compacta */}
              <div className="flex items-center gap-1 md:gap-2 md:ml-auto overflow-x-auto pb-1">
                <button 
                  onClick={prevMonth}
                  className="px-2 md:px-3 py-1.5 md:py-2 rounded-full text-sm font-medium border border-gray-300 bg-white hover:bg-gray-100 transition-all flex-shrink-0"
                  aria-label="Mês anterior"
                  title="Mês anterior"
                >
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    className="h-4 w-4" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M15 19l-7-7 7-7" 
                    />
                  </svg>
                </button>
                <div className="flex items-center gap-1 md:gap-1.5 border border-gray-300 rounded-md px-2 md:px-3 py-1.5 md:py-2 bg-white text-xs md:text-sm flex-shrink-0">
                  <select
                    value={month}
                    onChange={(e) => setMonth(parseInt(e.target.value))}
                    className="bg-transparent text-xs md:text-sm font-medium outline-none cursor-pointer"
                  >
                    {Array.from({ length: 12 }).map((_, i) => (
                      <option key={i} value={i}>
                        {new Date(2000, i).toLocaleString('pt-BR', { month: 'short' })}
                      </option>
                    ))}
                  </select>
                  <span className="text-gray-300">/</span>
                  <input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(Math.max(1970, Math.min(2099, parseInt(e.target.value || '2025'))))}
                    className="w-12 md:w-14 text-xs md:text-sm font-medium text-right outline-none"
                  />
                </div>
                <button 
                  onClick={nextMonth}
                  className="px-2 md:px-3 py-1.5 md:py-2 rounded-full text-sm font-medium border border-gray-300 bg-white hover:bg-gray-100 transition-all flex-shrink-0"
                  aria-label="Próximo mês"
                  title="Próximo mês"
                >
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    className="h-4 w-4" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M9 5l7 7-7 7" 
                    />
                  </svg>
                </button>
                <button
                  onClick={() => {
                    const today = new Date();
                    setYear(today.getFullYear());
                    setMonth(today.getMonth());
                  }}
                  className="px-2 md:px-3 py-1.5 md:py-2 rounded-full text-xs md:text-sm font-medium border border-primary-600 bg-primary-600 text-white hover:bg-primary-700 transition-all flex-shrink-0"
                  title="Ir para hoje"
                >
                  Hoje
                </button>
                {/* Toggle Calendário/Lista - oculto no mobile */}
                <div className="hidden md:flex items-center border border-gray-300 rounded-full bg-white overflow-hidden flex-shrink-0">
                  <button
                    onClick={() => setViewMode('calendar')}
                    className={`px-2 md:px-3 py-1.5 md:py-2 text-sm font-medium transition-all flex items-center gap-1 ${
                      viewMode === 'calendar' 
                        ? 'bg-primary-600 text-white' 
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                    title="Visualização em calendário"
                  >
                    <i className="fas fa-calendar-alt"></i>
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-2 md:px-3 py-1.5 md:py-2 text-sm font-medium transition-all flex items-center gap-1 ${
                      viewMode === 'list' 
                        ? 'bg-primary-600 text-white' 
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                    title="Visualização em lista"
                  >
                    <i className="fas fa-list"></i>
                  </button>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 md:gap-3 fade-in-3">
              {modalidades.length > 0 ? (
                modalidades.map((m, index) => {
                  const selecionado = String(m._id) === String(modalidadeSelecionada);
                  return (
                    <button
                      key={m._id || `modalidade-${index}`}
                      onClick={() => setModalidadeSelecionada(String(m._id))}
                      style={{
                        backgroundColor: selecionado ? m.cor || '#16a34a' : 'white',
                        borderColor: selecionado ? m.cor || '#16a34a' : '#E5E7EB',
                        color: selecionado ? 'white' : '#374151'
                      }}
                      className={`flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-1 md:py-1.5 rounded-full text-[10px] md:text-xs font-medium border transition-all`}
                    >
                      <span className="w-2 md:w-2.5 h-2 md:h-2.5 rounded-full border border-white" style={{ backgroundColor: m.cor || '#3B82F6', filter: 'none' }} />
                      <span>{m.nome || 'Sem nome'}</span>
                    </button>
                  );
                })
              ) : (
                <span className="text-sm text-gray-400">Carregando modalidades...</span>
              )}
            </div>
          </div>

          {/* Grid do calendário */}
          {viewMode === 'calendar' && (
          <div className={`grid grid-cols-7 gap-2 text-xs fade-in-4 transition-opacity duration-500 ${isTransitioning ? 'opacity-50' : 'opacity-100'}`}>
            {/* Cabeçalho dos dias da semana */}
            {diasSemana.map((d, idx) => (
              <div key={`header-${d}-${idx}`} className="text-center font-medium py-2 text-gray-600">
                {d}
              </div>
            ))}

            {/* Dias do mês */}
            {monthData.map((dObj, idx) => {
              const isToday = todayString === dObj.date.toDateString();
              const inCurrentMonth = dObj.date.getMonth() === month;
              // determine if this date is before today (local date-only compare)
              const _today = new Date();
              _today.setHours(0, 0, 0, 0);
              const _d = new Date(dObj.date);
              _d.setHours(0, 0, 0, 0);
              const isPast = _d < _today && !isToday;

              // cell background: previous/next month are more muted (bg-gray-200),
              // past days in the current month should be slightly muted but less than prev-month cells
              let cellBg = inCurrentMonth ? 'bg-white' : 'bg-gray-200 text-gray-500';
              let hoverClass = inCurrentMonth ? 'hover:bg-gray-50' : '';
              if (inCurrentMonth && isPast) {
                cellBg = 'bg-gray-50';
                // reduce hover effect for past days
                hoverClass = '';
              }

              const dateKey = `${dObj.date.getFullYear()}-${dObj.date.getMonth()}-${dObj.date.getDate()}`;

              const dayTextCls = !inCurrentMonth
                ? 'text-gray-500'
                : isToday
                  ? 'text-gray-900'
                  : (isPast ? 'text-gray-500' : 'text-gray-900');

              return (
                <div
                  key={dateKey}
                  className={`p-2 h-48 flex flex-col min-h-0 ${cellBg} ${
                    isToday ? 'ring-2 ring-primary-500' : ''
                  } border rounded-sm ${hoverClass} transition-colors`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className={`font-medium text-sm ${dayTextCls}`}>
                      {dObj.day}
                    </span>
                    {isToday && (
                      <span className="inline-block text-[10px] bg-primary-600 text-white px-2 py-0.5 rounded-md">
                        Hoje
                      </span>
                    )}
                  </div>

                  {/* Horários do dia */}
                  <div className="flex-1 min-h-0 overflow-y-auto space-y-1">
                    {getHorariosForDate(dObj.date).map((horario, hIdx) => {
                      const numAlunosFixos = horario.matriculas?.filter(m => !m.emEspera).length || 0;
                      const horarioKey = `horario-${dateKey}-${hIdx}`;
                      const professorNome = typeof horario.professorId === 'string' 
                        ? (/^[0-9a-f]{24}$/i.test(horario.professorId) ? 'Sem professor' : '') 
                        : (horario.professorId?.nome || '');
                      const professorCor = typeof horario.professorId === 'string' 
                        ? '#3B82F6' 
                        : (horario.professorId?.cor || '#3B82F6');
                      
                      // Buscar limite de alunos da modalidade
                      const modalidadeAtual = modalidades.find(m => m._id === horario.modalidadeId);
                      const limiteAlunos = modalidadeAtual?.limiteAlunos || 5;
                      
                      // Verificar reagendamentos para calcular total real
                      const reagendamentosData = getReagendamentosForDate(dObj.date);
                      
                      // Contar alunos que saem (reagendamento de origem)
                      const alunosQueSaem = reagendamentosData.origem.filter(r => {
                        const horarioFixoId = typeof r.horarioFixoId === 'string'
                          ? r.horarioFixoId
                          : r.horarioFixoId?._id;
                        return horarioFixoId === horario._id;
                      }).length;
                      
                      // Contar alunos que chegam (reagendamento de destino)
                      const alunosQueChegam = reagendamentosData.destino.filter(r => {
                        const novoHorarioFixoId = typeof r.novoHorarioFixoId === 'string'
                          ? r.novoHorarioFixoId
                          : r.novoHorarioFixoId?._id;
                        return novoHorarioFixoId === horario._id;
                      }).length;
                      
                      // Total real = fixos - saem + chegam
                      const numAlunos = numAlunosFixos - alunosQueSaem + alunosQueChegam;
                      
                      // Verificar se há reagendamentos de origem (aluno faltará)
                      const temReagendamentoOrigem = alunosQueSaem > 0;
                      // Verificar se há qualquer reagendamento relacionado a este horário nesta data
                      const temReagendamentoRelacionado = (alunosQueSaem + alunosQueChegam) > 0;
                      
                      // Verificar se algum dos reagendamentos relacionados é uma reposição
                      const temReposicao = reagendamentosData.origem.some(r => {
                        const horarioFixoId = typeof r.horarioFixoId === 'string' ? r.horarioFixoId : r.horarioFixoId?._id;
                        return horarioFixoId === horario._id && r.isReposicao === true;
                      }) || reagendamentosData.destino.some(r => {
                        const novoHorarioFixoId = typeof r.novoHorarioFixoId === 'string' ? r.novoHorarioFixoId : r.novoHorarioFixoId?._id;
                        return novoHorarioFixoId === horario._id && r.isReposicao === true;
                      });
                      
                      // Verificar se algum dos reagendamentos está pendente de aprovação
                      const temReagendamentoPendente = reagendamentosData.origem.some(r => {
                        const horarioFixoId = typeof r.horarioFixoId === 'string' ? r.horarioFixoId : r.horarioFixoId?._id;
                        return horarioFixoId === horario._id && r.status === 'pendente';
                      }) || reagendamentosData.destino.some(r => {
                        const novoHorarioFixoId = typeof r.novoHorarioFixoId === 'string' ? r.novoHorarioFixoId : r.novoHorarioFixoId?._id;
                        return novoHorarioFixoId === horario._id && r.status === 'pendente';
                      });
                      
                      // reduce visual saturation for horario cards (muted look)
                      // Apply desaturation only for previous-month cells or days that already passed.
                      const cardFilter = !inCurrentMonth
                        ? 'grayscale(100%)'
                        : (isPast ? 'grayscale(80%) saturate(0.35)' : undefined);

                      // Verificar se a aula foi enviada
                      const aulaFoiEnviada = verificarAulaRegistrada(horario._id || '', dObj.date);

                      return (
                        <div key={horarioKey} className="relative">
                          <button
                          onClick={() => {
                            if (inCurrentMonth) {
                              setHorarioSelecionado(horario);
                              setDataClicada(dObj.date);
                            }
                          }}
                          disabled={!inCurrentMonth}
                          style={{ filter: cardFilter }}
                          className={`w-full border rounded-md px-2 py-1 text-xs transition-colors text-left ${
                              !inCurrentMonth
                                ? 'bg-gray-100 border-gray-300 opacity-50 cursor-default'
                                : 'bg-white border-gray-200 hover:opacity-95 cursor-pointer'
                            }`}>
                            <div className="flex items-center justify-between">
                              <div className={`flex-1 min-w-0`}>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2 min-w-0">
                                    {professorNome ? (
                                      <span
                                        className={`inline-block px-2 py-0.5 rounded-md font-medium text-white text-[9px] truncate`}
                                        style={{ backgroundColor: professorCor, filter: 'none', maxWidth: '120px' }}
                                      >
                                        {professorNome}
                                      </span>
                                    ) : null}
                                    {aulaFoiEnviada && (
                                      <span
                                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-green-100 text-green-700 text-[8px] font-medium border border-green-200"
                                        title="Aula enviada"
                                      >
                                        <i className="fas fa-check-circle"></i>
                                        Enviada
                                      </span>
                                    )}
                                  </div>
                                  {(() => {
                                    const count = countAlunosForHorario(horario, dObj.date);
                                    return (
                                      <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ml-1 ${
                                        count >= limiteAlunos ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'
                                      }`}>
                                        {count}/{limiteAlunos}
                                      </span>
                                    );
                                  })()}
                                </div>

                                <div className={`mt-1 font-semibold ${
                                  !inCurrentMonth
                                    ? 'text-gray-500'
                                    : (temReagendamentoOrigem ? 'text-red-900 line-through' : 'text-gray-900')
                                }`}>
                                  {horario.horarioInicio} - {horario.horarioFim}
                                </div>
                              </div>
                            </div>
                        
                          
                          
                          
                          
                          
                          
                          
                        
                          
                        
                        
                        
                        
                        
                        
                        
                        
                        
                        
                        
                        
                        
                        
                        
                        
                        
                        
                        
                        
                        
                        
                        
                        
                        
                          </button>

                          {temReagendamentoRelacionado && (
                            <div className="absolute top-2 right-2 pointer-events-none flex gap-1">
                              <span 
                                title={temReposicao ? "Reposição" : "Reagendamento"} 
                                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium text-white border shadow-sm ${
                                  temReposicao 
                                    ? 'bg-blue-500 border-blue-600' 
                                    : 'bg-amber-500 border-amber-600'
                                }`} 
                                style={{ zIndex: 50 }}
                              >
                                {temReposicao ? 'RP' : 'R'}
                              </span>
                              {temReagendamentoPendente && (
                                <span 
                                  title="Aguardando aprovação" 
                                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium text-white border shadow-sm bg-yellow-500 border-yellow-600"
                                  style={{ zIndex: 50 }}
                                >
                                  <i className="fas fa-clock text-[8px]"></i>
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    
                    {/* Exibir reagendamentos de destino (alunos que virão neste dia) */}
                    {inCurrentMonth && getReagendamentosForDate(dObj.date).destino.map((reag, rIdx) => {
                      const matriculaId = reag.matriculaId;
                      
                      // Tentar obter nome do aluno de várias formas
                      let alunoNome = 'Aluno';
                      let aluno: any = null;
                      
                      // 1. Via alunoId direto (reposições populadas)
                      if (reag.alunoId && typeof reag.alunoId === 'object' && reag.alunoId.nome) {
                        alunoNome = reag.alunoId.nome;
                        aluno = reag.alunoId;
                      }
                      // 2. Via matriculaId.alunoId (reagendamentos normais)
                      else if (matriculaId && typeof matriculaId === 'object' && matriculaId.alunoId) {
                        if (typeof matriculaId.alunoId === 'object' && matriculaId.alunoId.nome) {
                          alunoNome = matriculaId.alunoId.nome;
                          aluno = matriculaId.alunoId;
                        }
                      }
                      
                      const inactive = !!(aluno?.congelado || aluno?.ausente);
                      const isReposicao = reag.isReposicao === true;
                      const isPendente = reag.status === 'pendente';
                      
                      // Debug: verificar dados
                      if (typeof window !== 'undefined') {
                        console.log('[Calendario] Reagendamento destino:', { 
                          id: reag._id, 
                          alunoNome, 
                          isReposicao: reag.isReposicao,
                          status: reag.status,
                          alunoIdDireto: reag.alunoId,
                          matriculaId: reag.matriculaId
                        });
                      }
                      
                      const novoHorarioFixoId = reag.novoHorarioFixoId;
                      const professorNome = novoHorarioFixoId && typeof novoHorarioFixoId === 'object' && novoHorarioFixoId.professorId
                        ? (typeof novoHorarioFixoId.professorId === 'string' ? (/^[0-9a-f]{24}$/i.test(novoHorarioFixoId.professorId) ? 'Sem professor' : '') : (novoHorarioFixoId.professorId?.nome || ''))
                        : '';
                      
                      return (
                        <div
                          key={`reag-${rIdx}`}
                          className={`w-full border rounded-md px-2 py-1 text-xs relative ${inactive ? 'bg-gray-100 border-gray-300 text-gray-500 filter grayscale' : (isPendente ? 'bg-yellow-50 border-yellow-300' : (isReposicao ? 'bg-blue-50 border-blue-300' : 'bg-orange-50 border-orange-300'))}`}
                        >
                          {isPendente && (
                            <div className="absolute top-1 right-1">
                              <span 
                                title="Aguardando aprovação" 
                                className="inline-flex items-center px-1 py-0.5 rounded text-[8px] font-medium text-yellow-800 bg-yellow-200 border border-yellow-300"
                              >
                                <i className="fas fa-clock mr-0.5"></i>
                                Pendente
                              </span>
                            </div>
                          )}
                          <div className={`font-semibold ${inactive ? 'text-gray-600' : (isPendente ? 'text-yellow-900' : (isReposicao ? 'text-blue-900' : 'text-orange-900'))}`}>
                            {reag.novoHorarioInicio} - {reag.novoHorarioFim}
                          </div>
                          {professorNome && (
                            <div className="text-[10px] mt-0.5">
                              <span className={`inline-block px-1.5 py-0.5 rounded-md ${inactive ? 'bg-gray-300 text-gray-700' : (isPendente ? 'bg-yellow-600 text-white' : (isReposicao ? 'bg-blue-600 text-white' : 'bg-orange-600 text-white'))} text-[9px] font-medium`}>
                                {professorNome}
                              </span>
                            </div>
                          )}
                          <div className={`text-[10px] mt-0.5 flex items-center gap-1 ${inactive ? 'text-gray-500 line-through' : (isPendente ? 'text-yellow-700' : (isReposicao ? 'text-blue-700' : 'text-orange-700'))}`}>
                            {isReposicao && <i className="fas fa-redo text-[8px]" />}
                            {isPendente && <i className="fas fa-clock text-[8px]" />}
                            {alunoNome} ({isPendente ? 'Pendente' : (isReposicao ? 'Reposição' : 'Reagendado')})
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          )}

          {/* Visualização em Lista */}
          {viewMode === 'list' && (
            <div className={`fade-in-4 transition-opacity duration-500 ${isTransitioning ? 'opacity-50' : 'opacity-100'}`}>
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                {/* Cabeçalho da lista */}
                <div className="bg-gray-50 border-b border-gray-200 px-3 md:px-4 py-2 md:py-3">
                  <h3 className="text-xs md:text-sm font-semibold text-gray-900">
                    Horários de {new Date(year, month).toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}
                  </h3>
                </div>
                
                {/* Lista de horários por dia da semana - Accordion no mobile */}
                <div className="divide-y divide-gray-200">
                  {diasSemana.map((diaNome, diaIndex) => {
                    const horariosNoDia = horarios.filter(h => h.diaSemana === diaIndex);
                    if (horariosNoDia.length === 0) return null;
                    
                    // Calcular a próxima data deste dia da semana
                    const hoje = new Date();
                    const diaHoje = hoje.getDay();
                    let diasAte = diaIndex - diaHoje;
                    if (diasAte < 0) diasAte += 7;
                    const proximaData = new Date(hoje);
                    proximaData.setDate(hoje.getDate() + diasAte);
                    const dataFormatada = proximaData.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                    
                    // Verificar se este dia está expandido (para mobile)
                    const isExpandido = diasExpandidos.includes(diaIndex);
                    
                    return (
                      <div key={`lista-dia-${diaIndex}`} className="">
                        {/* Cabeçalho do dia - clicável no mobile */}
                        <button
                          onClick={() => {
                            const newState = diasExpandidos.includes(diaIndex)
                              ? diasExpandidos.filter(d => d !== diaIndex)
                              : [diaIndex]; // Fechar outros e abrir apenas este
                            setDiasExpandidos(newState);
                          }}
                          className="md:hidden w-full p-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-bold">
                              {diaNome.charAt(0)}
                            </span>
                            <span className="text-base font-semibold text-gray-900">{diaNome}</span>
                            <span className="text-sm font-medium text-primary-600 bg-primary-50 px-2 py-1 rounded-full">
                              {dataFormatada}
                            </span>
                            <span className="text-sm font-medium text-gray-600">
                              ({horariosNoDia.length})
                            </span>
                          </div>
                          <i className={`fas fa-chevron-down text-gray-400 transition-transform duration-200 ${isExpandido ? 'rotate-180' : ''}`}></i>
                        </button>
                        
                        {/* Cabeçalho desktop (não clicável) */}
                        <div className="hidden md:block p-4">
                          <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                            <span className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold">
                              {diaNome.charAt(0)}
                            </span>
                            {diaNome}
                            <span className="text-xs font-medium text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">
                              {dataFormatada}
                            </span>
                            <span className="text-xs font-normal text-gray-500">
                              ({horariosNoDia.length} {horariosNoDia.length === 1 ? 'horário' : 'horários'})
                            </span>
                          </h4>
                        </div>
                        
                        {/* Conteúdo - sempre visível no desktop, expansível no mobile */}
                        <div className={`md:block ${isExpandido ? 'block' : 'hidden'}`}>
                          <div className="p-3 pt-0 md:p-4 md:pt-0">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3">
                              {horariosNoDia
                            .sort((a, b) => (a.horarioInicio || '').localeCompare(b.horarioInicio || ''))
                            .map((horario, hIdx) => {
                              const professorNome = typeof horario.professorId === 'string' 
                                ? '' 
                                : (horario.professorId?.nome || '');
                              const professorCor = typeof horario.professorId === 'string' 
                                ? '#3B82F6' 
                                : (horario.professorId?.cor || '#3B82F6');
                              const modalidadeAtual = modalidades.find(m => m._id === horario.modalidadeId);
                              const limiteAlunos = modalidadeAtual?.limiteAlunos || 5;
                              const numAlunos = horario.matriculas?.filter(m => !m.emEspera && !m.alunoId?.congelado && !m.alunoId?.ausente).length || 0;
                              
                              return (
                                <button
                                  key={`lista-horario-${diaIndex}-${hIdx}`}
                                  onClick={() => {
                                    // Calcular próxima ocorrência deste dia
                                    const hoje = new Date();
                                    const diaHoje = hoje.getDay();
                                    let diasAte = diaIndex - diaHoje;
                                    if (diasAte < 0) diasAte += 7;
                                    const proximaData = new Date(hoje);
                                    proximaData.setDate(hoje.getDate() + diasAte);
                                    setHorarioSelecionado(horario);
                                    setDataClicada(proximaData);
                                  }}
                                  className="flex items-center gap-2 md:gap-3 p-2 md:p-3 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors text-left"
                                >
                                  <div className="flex-shrink-0 w-12 md:w-16 text-center">
                                    <p className="text-base md:text-lg font-bold text-gray-900">{horario.horarioInicio}</p>
                                    <p className="text-[10px] md:text-xs text-gray-500">{horario.horarioFim}</p>
                                  </div>
                                  
                                  <div className="flex-1 min-w-0">
                                    {professorNome && (
                                      <span
                                        className="inline-block px-1.5 md:px-2 py-0.5 rounded-md text-white text-[9px] md:text-[10px] font-medium mb-1 truncate max-w-full"
                                        style={{ backgroundColor: professorCor }}
                                      >
                                        {professorNome}
                                      </span>
                                    )}
                                    <div className="flex items-center gap-1 md:gap-2">
                                      <span className={`text-[10px] md:text-xs font-medium px-1.5 md:px-2 py-0.5 rounded-full ${
                                        numAlunos >= limiteAlunos ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'
                                      }`}>
                                        {numAlunos}/{limiteAlunos}
                                      </span>
                                    </div>
                                    
                                    {/* Lista de alunos - oculta no mobile para economizar espaço */}
                                    {horario.matriculas && horario.matriculas.length > 0 && (
                                      <div className="hidden md:block mt-2 text-xs text-gray-600">
                                        {horario.matriculas
                                          .filter(m => !m.emEspera && !m.alunoId?.congelado && !m.alunoId?.ausente)
                                          .slice(0, 3)
                                          .map((m, mIdx) => (
                                            <span key={mIdx} className="inline-block mr-1">
                                              {m.alunoId?.nome?.split(' ')[0] || 'Aluno'}
                                              {mIdx < Math.min(2, horario.matriculas!.filter(m => !m.emEspera && !m.alunoId?.congelado && !m.alunoId?.ausente).length - 1) && ', '}
                                            </span>
                                          ))
                                        }
                                        {horario.matriculas.filter(m => !m.emEspera && !m.alunoId?.congelado && !m.alunoId?.ausente).length > 3 && (
                                          <span className="text-gray-400">
                                            +{horario.matriculas.filter(m => !m.emEspera && !m.alunoId?.congelado && !m.alunoId?.ausente).length - 3}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  
                                  <div className="flex-shrink-0">
                                    <i className="fas fa-chevron-right text-gray-400 text-sm"></i>
                                  </div>
                                </button>
                              );
                            })}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {horarios.length === 0 && (
                    <div className="p-6 md:p-8 text-center text-gray-500">
                      <i className="fas fa-calendar-times text-3xl md:text-4xl mb-3 text-gray-300"></i>
                      <p className="text-sm md:text-base">Nenhum horário cadastrado para esta modalidade.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal de detalhes do horário */}
        {horarioSelecionado && (
          <div
            className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-2 md:p-4"
            onClick={() => {
              setHorarioSelecionado(null);
              setDataClicada(null);
            }}
          >
            <div
              className="bg-white rounded-lg shadow-lg border border-gray-200 max-w-2xl w-full max-h-[90vh] md:max-h-[80vh] overflow-hidden p-3 md:p-6 flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3 md:mb-4">
                <div className="flex-1">
                  {/* Título com horário */}
                  <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-3">
                    <div className="flex items-center gap-2">
                      {(() => {
                        const dataAula = dataClicada || new Date();
                        const hoje = new Date();
                        hoje.setHours(0, 0, 0, 0);
                        const dataAulaDate = new Date(dataAula);
                        dataAulaDate.setHours(0, 0, 0, 0);
                        const aulaPassouOuEnviada = dataAulaDate < hoje || verificarAulaRegistrada(horarioSelecionado._id || '', dataAula);
                        
                        return (
                          <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg flex items-center justify-center ${
                            aulaPassouOuEnviada ? 'bg-gray-200' : 'bg-primary-100'
                          }`}>
                            <i className={`fas fa-clock text-base md:text-lg ${
                              aulaPassouOuEnviada ? 'text-gray-500' : 'text-primary-600'
                            }`}></i>
                          </div>
                        );
                      })()}
                      <div>
                        <h3 className="text-base md:text-lg font-bold text-gray-900">
                          {horarioSelecionado.horarioInicio} - {horarioSelecionado.horarioFim}
                        </h3>
                        <p className="text-[10px] md:text-xs text-gray-500">
                          {diasSemana[(horarioSelecionado.diaSemana ?? 0)]}
                          {dataClicada && `, ${dataClicada.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}`}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Info secundária e badges */}
                  <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
                    {/* Professor */}
                    {(typeof horarioSelecionado.professorId === 'string'
                      ? ''
                      : horarioSelecionado.professorId?.nome) && (() => {
                        const dataAula = dataClicada || new Date();
                        const hoje = new Date();
                        hoje.setHours(0, 0, 0, 0);
                        const dataAulaDate = new Date(dataAula);
                        dataAulaDate.setHours(0, 0, 0, 0);
                        const aulaPassouOuEnviada = dataAulaDate < hoje || verificarAulaRegistrada(horarioSelecionado._id || '', dataAula);
                        
                        return (
                          <span
                            className="inline-flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-1 md:py-1.5 rounded-md text-white text-[10px] md:text-xs font-medium shadow-sm"
                            style={{
                              backgroundColor: aulaPassouOuEnviada 
                                ? '#9CA3AF' 
                                : (typeof horarioSelecionado.professorId === 'string'
                                    ? '#3B82F6'
                                    : (horarioSelecionado.professorId?.cor || '#3B82F6')),
                            }}
                          >
                            <i className="fas fa-user-tie text-[8px] md:text-[10px]"></i>
                            {typeof horarioSelecionado.professorId === 'string'
                              ? 'Professor'
                              : horarioSelecionado.professorId?.nome || 'Professor não definido'}
                          </span>
                        );
                      })()}
                    
                    {/* Contador de alunos */}
                    <span className="inline-flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-1 md:py-1.5 rounded-md bg-gray-100 text-gray-700 text-[10px] md:text-xs font-semibold border border-gray-200">
                      <i className="fas fa-users text-[8px] md:text-[10px]"></i>
                      {alunosDoDiaCount} {alunosDoDiaCount === 1 ? 'Aluno' : 'Alunos'}
                    </span>
                    
                    {/* Badges de status da aula */}
                    {(() => {
                      const dataAula = dataClicada || new Date();
                      const hoje = new Date();
                      hoje.setHours(0, 0, 0, 0);
                      const dataAulaDate = new Date(dataAula);
                      dataAulaDate.setHours(0, 0, 0, 0);
                      const aulaPassou = dataAulaDate < hoje;
                      const aulaRegistrada = verificarAulaRegistrada(horarioSelecionado._id || '', dataAula);
                      const estatisticas = aulaRegistrada ? obterEstatisticasAula(horarioSelecionado._id || '', dataAula) : null;
                      
                      return (
                        <>
                          {aulaPassou && !aulaRegistrada && (
                            <span className="inline-flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-1 md:py-1.5 rounded-md bg-yellow-50 text-yellow-700 text-[10px] md:text-xs font-medium border border-yellow-200">
                              <i className="fas fa-exclamation-triangle text-[8px] md:text-[10px]"></i>
                              <span className="hidden md:inline">Aula </span>pendente
                            </span>
                          )}
                          {aulaPassou && aulaRegistrada && (
                            <span className="inline-flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-1 md:py-1.5 rounded-md bg-gray-100 text-gray-600 text-[10px] md:text-xs font-medium border border-gray-200">
                              <i className="fas fa-history text-[8px] md:text-[10px]"></i>
                              <span className="hidden md:inline">Aula </span>passada
                            </span>
                          )}
                          {aulaRegistrada && (
                            <span className="inline-flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-1 md:py-1.5 rounded-md bg-green-50 text-green-700 text-[10px] md:text-xs font-medium border border-green-200">
                              <i className="fas fa-check-circle text-[8px] md:text-[10px]"></i>
                              <span className="hidden md:inline">Aula </span>enviada
                            </span>
                          )}
                          {/* Estatísticas de presença/falta quando aula foi enviada */}
                          {aulaRegistrada && estatisticas && (
                            <>
                              <span className="inline-flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-1 md:py-1.5 rounded-md bg-green-100 text-green-700 text-[10px] md:text-xs font-medium border border-green-300">
                                <i className="fas fa-check text-[8px] md:text-[10px]"></i>
                                {estatisticas.presentes}
                              </span>
                              <span className="inline-flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-1 md:py-1.5 rounded-md bg-red-100 text-red-700 text-[10px] md:text-xs font-medium border border-red-300">
                                <i className="fas fa-times text-[8px] md:text-[10px]"></i>
                                {estatisticas.faltas}
                              </span>
                            </>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
                
                {/* Botão fechar */}
                <button
                  onClick={() => {
                    setHorarioSelecionado(null);
                    setDataClicada(null);
                  }}
                  className="ml-2 md:ml-4 w-7 h-7 md:w-8 md:h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                  aria-label="Fechar"
                >
                  <i className="fas fa-times text-sm md:text-base"></i>
                </button>
              </div>

              {/* Separator between header and content */}
              <div className="border-t border-gray-200 mt-3 md:mt-4 mb-3 md:mb-4" />

              {/* Conteúdo - flex container to keep footer visible */}
              <div className="overflow-y-auto flex-1 min-h-0">
                {horarioSelecionado.observacaoTurma && (
                  <div className="mb-3 md:mb-4 p-2 md:p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <p className="text-xs md:text-sm text-yellow-800">
                      <strong>Observação:</strong> {horarioSelecionado.observacaoTurma}
                    </p>
                  </div>
                )}

                {(() => {
                  const dataAula = dataClicada || new Date();
                  const dataAulaStr = formatDateToISO(dataAula);
                  // Contar alunos que faltarão (reagendados para outro horário)
                  // Só conta se status for aprovado
                  const alunosFaltarao = reagendamentos.filter(r => {
                    const horarioFixoId = typeof r.horarioFixoId === 'string' 
                      ? r.horarioFixoId 
                      : r.horarioFixoId?._id;
                    const dataOriginalNormalizada = r.dataOriginal?.split('T')[0];
                    return horarioFixoId === horarioSelecionado._id &&
                      dataOriginalNormalizada === dataAulaStr &&
                      r.status === 'aprovado';
                  }).length;
                  // Contar alunos que virão (reagendados de outros horários)
                  // Só conta se status for aprovado
                  const alunosVirao = reagendamentos.filter(r => {
                    const novoHorarioFixoId = typeof r.novoHorarioFixoId === 'string'
                      ? r.novoHorarioFixoId
                      : r.novoHorarioFixoId?._id;
                    const novaDataNormalizada = r.novaData?.split('T')[0];
                    return novoHorarioFixoId === horarioSelecionado._id &&
                      novaDataNormalizada === dataAulaStr &&
                      r.status === 'aprovado';
                  }).length;
                  // Contar apenas alunos ativos (não em espera, não congelados, não ausentes)
                  const totalMatriculados = horarioSelecionado.matriculas?.filter(m => {
                    const isEmEspera = m.emEspera || m.alunoId?.emEspera;
                    const isCongelado = m.alunoId?.congelado;
                    const isAusente = m.alunoId?.ausente;
                    return !isEmEspera && !isCongelado && !isAusente;
                  }).length || 0;
                  const totalPresentes = totalMatriculados - alunosFaltarao + alunosVirao;
                  return null;
                })()}

                {horarioSelecionado.matriculas && horarioSelecionado.matriculas.length > 0 ? (
                  <div className="border border-gray-300 rounded-lg p-4 relative pt-6 mt-4">
                    <h3 className="font-semibold text-gray-900 text-sm md:text-base absolute -top-3 left-4 bg-white px-2">
                      Alunos Fixos ({horarioSelecionado.matriculas?.filter(m => !m.emEspera).length || 0})
                    </h3>
                    <div className="space-y-1.5 md:space-y-2">
                    {horarioSelecionado.matriculas
                      .filter(m => !m.emEspera)
                      .map((matricula, idx) => {
                        // Usar a data clicada ao invés de calcular a próxima ocorrência
                        const dataAula = dataClicada || new Date();
                        const dataAulaStr = formatDateToISO(dataAula);
                        
                        console.log('[Modal] Verificando reagendamento para:', {
                          aluno: matricula.alunoId?.nome,
                          dataAula: dataAulaStr,
                          horarioId: horarioSelecionado._id,
                          matriculaId: matricula._id,
                          totalReagendamentos: reagendamentos.length
                        });
                        
                        // Verificar se este aluno tem reagendamento para esta data específica
                        const reagendamentoAluno = reagendamentos.find(r => {
                          const horarioFixoId = typeof r.horarioFixoId === 'string' 
                            ? r.horarioFixoId 
                            : r.horarioFixoId?._id;
                          const matriculaId = typeof r.matriculaId === 'string'
                            ? r.matriculaId
                            : r.matriculaId?._id;
                          
                          // Normalizar a data original do reagendamento (remover hora)
                          const dataOriginalNormalizada = r.dataOriginal?.split('T')[0];
                          
                          console.log('[Modal] Comparando:', {
                            reagendamentoId: r._id,
                            horarioFixoIdReag: horarioFixoId,
                            horarioFixoIdAtual: horarioSelecionado._id,
                            horarioMatch: horarioFixoId === horarioSelecionado._id,
                            matriculaIdReag: matriculaId,
                            matriculaIdAtual: matricula._id,
                            matriculaMatch: matriculaId === matricula._id,
                            dataOriginalReag: r.dataOriginal,
                            dataOriginalNormalizada: dataOriginalNormalizada,
                            dataAtual: dataAulaStr,
                            dataMatch: dataOriginalNormalizada === dataAulaStr,
                            status: r.status,
                            statusOk: r.status !== 'rejeitado'
                          });
                          
                          const match = horarioFixoId === horarioSelecionado._id &&
                            matriculaId === matricula._id &&
                            dataOriginalNormalizada === dataAulaStr &&
                            r.status !== 'rejeitado';
                          
                          if (match) {
                            console.log('[Modal] ✅ Reagendamento encontrado!', r);
                          }
                          
                          return match;
                        });
                        
                        if (reagendamentoAluno) {
                          console.log('[Modal] ✅ Este aluno tem reagendamento:', matricula.alunoId?.nome);
                        }
                        
                        // Verificar se o aluno faltou nesta aula (via aulas realizadas)
                        const alunoId = typeof matricula.alunoId === 'string' ? matricula.alunoId : matricula.alunoId?._id;
                        const faltaInfo = alunoId ? verificarFaltaAluno(alunoId, horarioSelecionado._id || '', dataAula) : null;
                        const alunoFaltou = faltaInfo?.faltou === true;
                        const temReposicaoAgendada = faltaInfo?.reposicao != null;
                        let alunoPresente = alunoId ? verificarPresencaAluno(alunoId, horarioSelecionado._id || '', dataAula) : false;
                        
                        // Se é uma reposição aprovada, verificar presença/falta na data da reposição
                        let presencaEmReposicao = null;
                        if (reagendamentoAluno?.isReposicao === true && reagendamentoAluno?.status === 'aprovado') {
                          presencaEmReposicao = alunoId ? verificarPresencaEmReposicao(alunoId, reagendamentoAluno) : null;
                          // Se houver registro de presença em reposição, usar isso
                          if (presencaEmReposicao) {
                            alunoPresente = presencaEmReposicao.presente;
                          }
                        }
                        
                        // Determine inactive state for consistent styling
                        const inactive = !!(matricula.alunoId?.congelado || matricula.alunoId?.ausente);
                        // Verificar se é uma reposição aprovada (aluno faltou e tem reposição)
                        const isReposicaoAprovada = reagendamentoAluno?.isReposicao === true && reagendamentoAluno?.status === 'aprovado';

                        // Verificar se a aula passou ou foi enviada (para tornar cards cinzas)
                        const hoje = new Date();
                        hoje.setHours(0, 0, 0, 0);
                        const dataAulaDate = new Date(dataAula);
                        dataAulaDate.setHours(0, 0, 0, 0);
                        const aulaPassouOuEnviada = dataAulaDate < hoje || verificarAulaRegistrada(horarioSelecionado._id || '', dataAula);

                        return (
                          <div 
                            key={matricula._id || `aluno-${idx}`}
                            className={`flex items-center justify-between p-3 rounded-md border transition-colors ${
                              inactive
                                ? 'bg-gray-100 border-gray-300 text-gray-500 filter grayscale'
                                : (aulaPassouOuEnviada
                                    ? 'bg-gray-100 border-gray-300'
                                    : (alunoFaltou
                                        ? 'bg-red-50 border-red-300'
                                        : (matricula.alunoId?.emEspera
                                            ? 'bg-amber-100 border-amber-300'
                                            : (reagendamentoAluno?.status === 'aprovado' ? 'bg-gray-100 border-gray-300' : 'bg-gray-50 border-gray-200'))))
                            }`}
                          >
                            <div className="flex items-center gap-2 md:gap-3 flex-1">
                              <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center font-semibold text-white text-sm md:text-base flex-shrink-0 ${
                                inactive 
                                  ? 'bg-gray-400' 
                                  : (aulaPassouOuEnviada
                                      ? 'bg-gray-400'
                                      : (alunoFaltou ? 'bg-red-500' : (reagendamentoAluno?.status === 'aprovado' ? 'bg-gray-400' : (matricula.alunoId?.emEspera ? 'bg-amber-500' : 'bg-green-500'))))
                              }`}>
                                {matricula.alunoId?.nome?.charAt(0).toUpperCase() || '?'}
                              </div>
                              <div className="flex-1 min-w-0">
                                {/* Nome do aluno primeiro */}
                                <div className="flex items-center gap-2">
                                  {(() => {
                                    const isCongelado = matricula.alunoId?.congelado;
                                    const isAusente = matricula.alunoId?.ausente;
                                    const isEmEspera = matricula.alunoId?.emEspera;
                                    const hasStatus = isCongelado || isAusente;
                                    const shouldStrike = hasStatus || isReposicaoAprovada;
                                    
                                    // Se a aula passou ou foi enviada, nome fica cinza
                                    if (aulaPassouOuEnviada || inactive) {
                                      return (
                                        <p className={`font-medium text-gray-500 ${shouldStrike ? 'line-through' : ''}`}>
                                          {matricula.alunoId?.nome || 'Nome não disponível'}
                                        </p>
                                      );
                                    }
                                    
                                    const nameColor = isAusente ? '#ef4444' : (isCongelado ? '#0ea5e9' : (isEmEspera ? '#eab308' : undefined));
                                    let reagendadoColor = '#9CA3AF';
                                    if (reagendamentoAluno) {
                                      if (matricula.alunoId?.ausente) reagendadoColor = '#dc2626';
                                      else if (matricula.alunoId?.congelado) reagendadoColor = '#0369a1';
                                      else if (matricula.alunoId?.emEspera) reagendadoColor = '#b45309';
                                    }
                                    
                                    return (
                                      <p 
                                        className={`font-medium ${shouldStrike ? 'line-through text-gray-500' : (reagendamentoAluno?.status === 'aprovado' ? 'text-gray-600' : 'text-gray-900')}`}
                                        style={{ 
                                          color: reagendamentoAluno?.status === 'aprovado' ? reagendadoColor : (nameColor || undefined)
                                        }}
                                      >
                                        {matricula.alunoId?.nome || 'Nome não disponível'}
                                      </p>
                                    );
                                  })()}
                                  {/* Badges de Presente/Faltou inline com nome */}
                                  {alunoPresente && (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-green-100 text-green-700 text-[9px] rounded font-medium">
                                      <i className="fas fa-check-circle text-[8px]"></i>
                                      Presente
                                    </span>
                                  )}
                                  {alunoFaltou && (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-red-100 text-red-700 text-[9px] rounded font-medium">
                                      <i className="fas fa-times-circle text-[8px]"></i>
                                      Faltou
                                    </span>
                                  )}
                                  {presencaEmReposicao?.presente && (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-green-100 text-green-700 text-[9px] rounded font-medium">
                                      <i className="fas fa-check-circle text-[8px]"></i>
                                      Presente (repos.)
                                    </span>
                                  )}
                                  {presencaEmReposicao?.faltou && (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-red-100 text-red-700 text-[9px] rounded font-medium">
                                      <i className="fas fa-times-circle text-[8px]"></i>
                                      Faltou (repos.)
                                    </span>
                                  )}
                                </div>
                                
                                {/* Info de reagendamento/reposição compacta abaixo do nome */}
                                {reagendamentoAluno && (
                                  <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                    <a
                                      href="#"
                                      onClick={async (e: any) => {
                                        e.preventDefault();
                                        if (typeof reagendamentoAluno.novoHorarioFixoId !== 'string' && reagendamentoAluno.novoHorarioFixoId) {
                                          try {
                                            const horarioId = reagendamentoAluno.novoHorarioFixoId._id;
                                            const res = await fetch(`/api/horarios?modalidadeId=${modalidadeSelecionada}`);
                                            const data = await res.json();
                                            if (data.success) {
                                              const horarioCompleto = data.data.find((h: any) => h._id === horarioId);
                                              if (horarioCompleto) {
                                                const novaData = parseDateOnly(String(reagendamentoAluno.novaData));
                                                setHorarioSelecionado(horarioCompleto);
                                                setDataClicada(novaData);
                                              }
                                            }
                                          } catch (error) {
                                            console.error('Erro ao buscar horário:', error);
                                          }
                                        }
                                      }}
                                      className={`inline-flex items-center gap-1 text-[10px] cursor-pointer ${
                                        reagendamentoAluno.status === 'aprovado'
                                          ? 'text-gray-500 hover:text-gray-700 hover:underline'
                                          : (reagendamentoAluno.isReposicao 
                                              ? 'px-1.5 py-0.5 rounded font-medium bg-blue-100 text-blue-700 hover:bg-blue-200' 
                                              : 'px-1.5 py-0.5 rounded font-medium bg-orange-100 text-orange-700 hover:bg-orange-200')
                                      }`}
                                      title="Clique para ver horário de destino"
                                    >
                                      {reagendamentoAluno.status !== 'aprovado' && (
                                        <i className={`fas ${reagendamentoAluno.isReposicao ? 'fa-redo' : 'fa-exchange-alt'} text-[8px]`}></i>
                                      )}
                                      <span>
                                        {reagendamentoAluno.isReposicao ? 'Repos. para ' : 'Reag. para '}
                                        {parseDateOnly(String(reagendamentoAluno.novaData)).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                        {' '}
                                        {reagendamentoAluno.novoHorarioInicio}
                                      </span>
                                      <i className="fas fa-external-link-alt text-[7px] opacity-50"></i>
                                    </a>
                                    {reagendamentoAluno.status === 'aprovado' ? (
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-green-100 text-green-700 text-[9px] rounded font-medium">
                                        <i className="fas fa-check text-[7px]"></i>
                                        Aprovado
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-gray-500">
                                        <i className="fas fa-clock text-[8px]"></i> Pendente
                                      </span>
                                    )}
                                  </div>
                                )}
                                
                                {/* Botão de Repor Aula quando faltou */}
                                {alunoFaltou && (
                                  <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                    {faltaInfo && !temReposicaoAgendada && (() => {
                                      const reposicao = faltaInfo.reposicao;
                                      const dataFalta = new Date(dataAula);
                                      dataFalta.setHours(0, 0, 0, 0);
                                      const prazoFinal = new Date(dataFalta);
                                      prazoFinal.setDate(prazoFinal.getDate() + 7);
                                      const hoje = new Date();
                                      hoje.setHours(0, 0, 0, 0);
                                      const prazoPassou = hoje > prazoFinal;
                                      
                                      return (
                                        <button
                                          onClick={() => {
                                            setAlunoReposicao({
                                              _id: alunoId,
                                              nome: matricula.alunoId?.nome
                                            });
                                            
                                            // Buscar nome da modalidade
                                            const modalidadeNome = modalidades.find(m => m._id === horarioSelecionado.modalidadeId)?._id === horarioSelecionado.modalidadeId
                                              ? modalidades.find(m => m._id === horarioSelecionado.modalidadeId)?.nome
                                              : (typeof horarioSelecionado.modalidadeId === 'string' ? horarioSelecionado.modalidadeId : horarioSelecionado.modalidadeId?.nome);
                                            
                                            setFaltaSelecionada({
                                              aulaRealizadaId: faltaInfo.aulaRealizadaId,
                                              data: formatDateToISO(dataAula),
                                              horarioInicio: horarioSelecionado.horarioInicio,
                                              horarioFim: horarioSelecionado.horarioFim,
                                              horarioFixoId: horarioSelecionado._id,
                                              modalidade: modalidadeNome || 'Modalidade',
                                              diasRestantes: Math.max(0, Math.floor((prazoFinal.getTime() - hoje.getTime()) / 86400000)),
                                              prazoFinal: prazoFinal.toISOString()
                                            });
                                            setShowReporModal(true);
                                          }}
                                          className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-md font-medium border cursor-pointer transition-colors ${
                                            prazoPassou
                                              ? 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200'
                                              : (reposicao
                                                  ? 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200'
                                                  : 'bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-200')
                                          }`}
                                          title={prazoPassou ? 'Reposição expirada' : (reposicao ? 'Clique para editar reposição' : 'Clique para agendar reposição')}
                                        >
                                          <i className={`fas ${
                                            prazoPassou ? 'fa-ban' : (reposicao ? 'fa-check-circle' : 'fa-redo')
                                          }`}></i>
                                          {prazoPassou ? 'Expirada' : (reposicao ? 'Agendada' : 'Repor Aula')}
                                        </button>
                                      );
                                    })()}
                                    {temReposicaoAgendada && faltaInfo?.reposicao && (
                                      (() => {
                                        const reposicao = faltaInfo.reposicao;
                                        // Usar a data da aula atual (dataAula) como data da falta
                                        const dataFalta = new Date(dataAula);
                                        dataFalta.setHours(0, 0, 0, 0);
                                        const prazoFinal = new Date(dataFalta);
                                        prazoFinal.setDate(prazoFinal.getDate() + 7);
                                        const hoje = new Date();
                                        hoje.setHours(0, 0, 0, 0);
                                        const prazoPassou = hoje > prazoFinal;
                                        
                                        return (
                                          <a
                                            href="#"
                                            onClick={async (e: React.MouseEvent) => {
                                              e.preventDefault();
                                              if (reposicao && reposicao.novoHorarioFixoId) {
                                                try {
                                                  const horarioId = typeof reposicao.novoHorarioFixoId === 'string' 
                                                    ? reposicao.novoHorarioFixoId 
                                                    : reposicao.novoHorarioFixoId._id;
                                                  const res = await fetch(`/api/horarios?modalidadeId=${modalidadeSelecionada}`);
                                                  const data = await res.json();
                                                  if (data.success) {
                                                    const horarioCompleto = data.data.find((h: any) => h._id === horarioId);
                                                    if (horarioCompleto) {
                                                      const novaData = parseDateOnly(String(reposicao.novaData));
                                                      setHorarioSelecionado(horarioCompleto);
                                                      setDataClicada(novaData);
                                                    }
                                                  }
                                                } catch (error) {
                                                  console.error('Erro ao buscar horário:', error);
                                                }
                                              }
                                            }}
                                            className="inline-flex items-center gap-1.5 px-2 py-1 text-[11px] rounded-md font-medium border cursor-pointer transition-colors bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200"
                                            title="Clique para ir à data da reposição"
                                          >
                                            <i className="fas fa-redo"></i>
                                            Reposição para {parseDateOnly(String(reposicao.novaData)).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                            <span className="flex items-center gap-0.5">
                                              <i className="far fa-clock text-blue-600"></i>
                                              {reposicao.novoHorarioInicio || '--:--'}
                                            </span>
                                            <i className="fas fa-external-link-alt text-[8px] ml-0.5"></i>
                                          </a>
                                        );
                                      })()
                                    )}
                                    {/* Badge de status da reposição */}
                                    {temReposicaoAgendada && faltaInfo?.reposicao && (
                                      faltaInfo.reposicao.status === 'aprovado' ? (
                                        <span className="text-[11px] text-green-600 font-medium">
                                          <i className="fas fa-check-circle text-green-500"></i> Aprovado
                                        </span>
                                      ) : (
                                        <span className="text-[11px] text-gray-600 font-medium">
                                          <i className="fas fa-clock text-gray-500"></i> Aguardando aprovação
                                        </span>
                                      )
                                    )}
                                    {alunoFaltou && !temReposicaoAgendada && (() => {
                                      // Verificar se a aula passou ou foi enviada
                                      const hoje = new Date();
                                      hoje.setHours(0, 0, 0, 0);
                                      const dataAulaDate = new Date(dataAula);
                                      dataAulaDate.setHours(0, 0, 0, 0);
                                      const aulaPassou = dataAulaDate < hoje;
                                      const aulaRegistrada = verificarAulaRegistrada(horarioSelecionado._id || '', dataAula);
                                      
                                      // Não exibir se a aula passou ou foi enviada
                                      if (aulaPassou || aulaRegistrada) {
                                        return null;
                                      }
                                      
                                      const dataFalta = new Date(dataAula);
                                      dataFalta.setHours(0, 0, 0, 0);
                                      const prazoFinal = new Date(dataFalta);
                                      prazoFinal.setDate(prazoFinal.getDate() + 7);
                                      const prazoExpirou = hoje > prazoFinal;
                                      
                                      return (
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-md font-medium border ${
                                          prazoExpirou 
                                            ? 'bg-red-100 text-red-700 border-red-300' 
                                            : 'bg-gray-200 text-gray-700 border-gray-300'
                                        }`}>
                                          <i className={`fas ${prazoExpirou ? 'fa-times-circle' : 'fa-exclamation-circle'}`}></i>
                                          {prazoExpirou ? 'Repos. expirada' : 'Repos. pendente'}
                                        </span>
                                      );
                                    })()}
                                  </div>
                                )}
                                
                                {matricula.alunoId?.observacoes && (
                                  <p className="text-[10px] text-gray-500 mt-0.5 italic truncate">
                                    <i className="fas fa-sticky-note mr-0.5 text-[8px]"></i>
                                    {matricula.alunoId.observacoes}
                                  </p>
                                )}
                                {/* Badges de status do aluno */}
                                {(matricula.alunoId?.congelado || matricula.alunoId?.ausente || matricula.alunoId?.emEspera || matricula.alunoId?.periodoTreino || matricula.alunoId?.parceria) && (
                                  <div className="mt-1 flex items-center gap-1 flex-wrap">
                                    {matricula.alunoId?.congelado && (
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-sky-100 text-sky-700 text-[9px] rounded font-medium">
                                        <i className="fas fa-snowflake text-[8px]"></i>
                                        Congelado
                                      </span>
                                    )}
                                    {matricula.alunoId?.ausente && (
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-rose-100 text-rose-700 text-[9px] rounded font-medium">
                                        <i className="fas fa-user-clock text-[8px]"></i>
                                        Parou
                                      </span>
                                    )}
                                    {matricula.alunoId?.emEspera && (
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[9px] rounded font-medium">
                                        <i className="fas fa-hourglass-half text-[8px]"></i>
                                        Espera
                                      </span>
                                    )}
                                    {matricula.alunoId?.periodoTreino && (
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-green-100 text-green-700 text-[9px] rounded font-medium">
                                        <i className="fas fa-clock text-[8px]"></i>
                                        {matricula.alunoId.periodoTreino}
                                      </span>
                                    )}
                                    {matricula.alunoId?.parceria && (
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[9px] rounded font-medium">
                                        <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAC1UlEQVR4AbyWg5LlQBiFY3uSu7Zt27Zt27Zt27Zt60G2tC8w/3aWk/qvkkGqzuU53V+7qSwPQ6S5rttM07Sptm3PJZqXQ5pLypwci8UakjoUIpoo8HDE1EgQhC/kcyYR5IZoms6UJOmtaZo1/zT418OSypuwLPsDh3JHpK7vlmXV+NsTBmn5N2zMXZGeeEneZcpxnLYpA7k0HGS+1aZUVZ336wdZAGNNHzDX9wupvmCs6gVsASs0hKIooykyO5f6X4RaxcH7sCya3i4BRpdDAxiGMeUfgDqyWWQA+9Q4VHhoAHP74MgA2uyO2QfQF3cDi0D8077hcStzzk0M+nYMBnNtX1CHN/0lZWhjUAY1DEjuXgv4qkWA5piEAHitFs2IC8CVzR/0kcnnvU+vpzKuTgOhXqn0AKTO1VEB7qN5QLNM0Neharghe70Y+IoFUwPoS7qhsLllIPbN7xx6zpgb+qUAoClwLk1BQWVwIwTgnJ8UGiDj1ozkAIyrxx1XvnLhoM9WwXu3NDzAvdnJAcRWlVDIfbYAaJ4N+pqVj7ZvHB6VHECb1QGFrF1DAPmmtY0EoI5qlhyA7Gw4NLIpIN/R0aErdx/P84cuMQCjS+C9WYKCfM3iwdNMFcF7HfClFpkvYpvKyfcBoWEZTP1yEdASDwFfnZLhWv5wLogtK6beCdUJrVDY2j8Cdb86tgWu6D2R33u+Xi8G98l8sMiEU4Y1AcZU/FxqAOvACFSwOr4lClt7h+FDaU4nv6d+S+CAommUSwkgtqgIcrdaWYUuG37h7vOFCIAs3+inYRjxVYrE7X7G0/MGgGzJ+Ji+MtXfwvMGwNw8AAHoy7pHu5Coqjo3bNDfKX8OvXHKZqlCVqN0wJvlA98xAQImYNfMBthd+kDnrpkBcieVBRgVVsCQOEPrzinQjqPQfiETAzKACnCLioragbrSwFAppSYGmpkF7J5bQoId4XMA6lRclYDTIrUAAAAASUVORK5CYII=" alt="" className="w-2.5 h-2.5" />
                                        {matricula.alunoId.parceria}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {(() => {
                                // Verificar se a data da aula já passou
                                const hoje = new Date();
                                hoje.setHours(0, 0, 0, 0);
                                const dataAulaDate = new Date(dataAula);
                                dataAulaDate.setHours(0, 0, 0, 0);
                                const aulaPassou = dataAulaDate < hoje;
                                
                                // Verificar se a aula já foi registrada pelo professor
                                const aulaJaRegistrada = verificarAulaRegistrada(horarioSelecionado._id || '', dataAula);
                                
                                // Não exibir botão se já passou, já tem reagendamento ou aula já foi registrada
                                if (reagendamentoAluno || aulaPassou || aulaJaRegistrada) return null;
                                
                                // Se for professor, verificar se o horário é dele
                                const isProfessor = currentUser?.tipo === 'professor';
                                const professorIdDoHorario = typeof horarioSelecionado.professorId === 'string' 
                                  ? horarioSelecionado.professorId 
                                  : horarioSelecionado.professorId?._id;
                                const podeReagendar = !isProfessor || (isProfessor && String(professorIdDoHorario) === String(currentUser?.id));
                                
                                // Se for professor e não for o dono do horário, não exibir botão
                                if (!podeReagendar) return null;
                                
                                return (
                                  <button
                                    onClick={() => abrirReagendamento(
                                      matricula.alunoId, 
                                      matricula, 
                                      horarioSelecionado,
                                      dataAula
                                    )}
                                    disabled={matricula.alunoId?.congelado || matricula.alunoId?.ausente || matricula.alunoId?.emEspera}
                                    title={
                                      matricula.alunoId?.congelado ? 'Aluno congelado não pode ser reagendado' :
                                      matricula.alunoId?.ausente ? 'Aluno que parou de vir não pode ser reagendado' :
                                      matricula.alunoId?.emEspera ? 'Aluno em espera não pode ser reagendado' :
                                      'Reagendar aluno'
                                    }
                                    className={`text-primary-600 underline text-sm font-medium ${matricula.alunoId?.congelado || matricula.alunoId?.ausente || matricula.alunoId?.emEspera ? 'opacity-50 cursor-not-allowed' : ''}`}
                                  >
                                    Reagendar
                                  </button>
                                );
                              })()}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">Nenhum aluno matriculado neste horário.</p>
                )}

                {/* Alunos Reagendados para este horário nesta data */}
                {(() => {
                  const dataAula = dataClicada || new Date();
                  const dataAulaStr = formatDateToISO(dataAula);
                  
                  // Buscar reagendamentos que vêm PARA este horário nesta data
                  const alunosReagendadosParaCa = reagendamentos.filter(r => {
                    const novoHorarioFixoId = typeof r.novoHorarioFixoId === 'string'
                      ? r.novoHorarioFixoId
                      : r.novoHorarioFixoId?._id;
                    const novaDataNormalizada = r.novaData?.split('T')[0];
                    
                    return novoHorarioFixoId === horarioSelecionado._id &&
                      novaDataNormalizada === dataAulaStr &&
                      r.status !== 'rejeitado';
                  });
                  
                  console.log('[Modal] Alunos reagendados para cá:', {
                    horarioId: horarioSelecionado._id,
                    data: dataAulaStr,
                    total: alunosReagendadosParaCa.length,
                    reagendamentos: alunosReagendadosParaCa
                  });
                  
                  if (alunosReagendadosParaCa.length === 0) return null;
                  
                  return (
                    <div className="border border-gray-300 rounded-lg p-4 relative pt-6 mt-6">
                      <h3 className="font-semibold text-gray-900 text-sm md:text-base absolute -top-3 left-4 bg-white px-2">
                        Alunos Reagendados/Reposições para este Horário ({alunosReagendadosParaCa.length})
                      </h3>
                      <div className="space-y-2">
                        {alunosReagendadosParaCa.map((reag, idx) => {
                          const matricula = typeof reag.matriculaId === 'object' ? reag.matriculaId : null;
                          // Para reposições, o alunoId está direto no reagendamento
                          // Para reagendamentos normais, está em matriculaId.alunoId
                          const alunoFromMatricula = matricula && typeof matricula.alunoId === 'object' 
                            ? matricula.alunoId 
                            : null;
                          const alunoFromReposicao = reag.isReposicao && typeof reag.alunoId === 'object'
                            ? reag.alunoId
                            : null;
                          const aluno = alunoFromReposicao || alunoFromMatricula;
                          const alunoNome = aluno?.nome || 'Aluno';
                          const alunoIdStr = aluno?._id || '';
                          const reagId = reag._id || '';
                          
                          // Verificar se o aluno faltou/veio nesta data (reagendamento/reposição)
                          // Para reposições, o ID usado na aula realizada é o alunoId
                          // Para reagendamentos normais, pode ser o reagId
                          const faltaInfoReag = alunoIdStr ? verificarFaltaAluno(alunoIdStr, horarioSelecionado._id || '', dataAula, reagId) : null;
                          let alunoFaltouReag = faltaInfoReag?.faltou === true;
                          let alunoPresenteReag = alunoIdStr ? verificarPresencaAluno(alunoIdStr, horarioSelecionado._id || '', dataAula, reagId) : false;
                          
                          // Para reposições, também verificar presença/falta usando o próprio reagendamento
                          if (!alunoPresenteReag && !alunoFaltouReag && alunoIdStr) {
                            // Buscar aula realizada para este horário e data
                            const aulaRealizada = aulasRealizadas.find((aula: any) => {
                              const aulaHorarioId = typeof aula.horarioFixoId === 'string' 
                                ? aula.horarioFixoId 
                                : aula.horarioFixoId?._id;
                              const aulaDataStr = aula.data?.split('T')[0];
                              return aulaHorarioId === horarioSelecionado._id && aulaDataStr === dataAulaStr;
                            });
                            
                            if (aulaRealizada) {
                              // Tentar encontrar o aluno na lista de alunos da aula
                              const alunoNaAula = aulaRealizada.alunos?.find((a: any) => {
                                const aId = typeof a.alunoId === 'string' ? a.alunoId : a.alunoId?._id;
                                // Comparar com alunoId ou com reagendamentoId
                                return aId === alunoIdStr || aId === reagId || a.reagendamentoId === reagId;
                              });
                              
                              if (alunoNaAula) {
                                alunoPresenteReag = alunoNaAula.presente === true;
                                alunoFaltouReag = alunoNaAula.presente === false;
                              }
                            }
                          }
                          
                          const horarioOriginal = typeof reag.horarioFixoId === 'object' 
                            ? reag.horarioFixoId 
                            : null;
                          const professorOriginal = horarioOriginal && typeof horarioOriginal.professorId === 'object'
                            ? horarioOriginal.professorId?.nome
                            : '';
                          
                          // Verificar se a aula foi registrada e se a data passou
                          const aulaRegistrada = verificarAulaRegistrada(horarioSelecionado._id || '', dataAula);
                          const hoje = new Date();
                          hoje.setHours(0, 0, 0, 0);
                          const dataAulaDate = new Date(dataAula);
                          dataAulaDate.setHours(0, 0, 0, 0);
                          const dataPassou = dataAulaDate < hoje;
                          
                          // Se for professor, verificar se o horário original é dele
                          const isProfessorReag = currentUser?.tipo === 'professor';
                          const professorIdDoHorarioOriginal = horarioOriginal && typeof horarioOriginal.professorId === 'object'
                            ? horarioOriginal.professorId?._id
                            : (typeof horarioOriginal?.professorId === 'string' ? horarioOriginal.professorId : null);
                          const podeCancelarPorPermissao = !isProfessorReag || (isProfessorReag && String(professorIdDoHorarioOriginal) === String(currentUser?.id));
                          
                          const podeCancelar = !aulaRegistrada && !dataPassou && podeCancelarPorPermissao;
                          const aulaPassouOuEnviadaReag = dataPassou || aulaRegistrada;
                          
                          return (
                            <div 
                              key={reag._id || `reag-temp-${idx}`}
                              className={`flex items-center justify-between p-3 rounded-md border ${
                                aulaPassouOuEnviadaReag
                                  ? 'bg-gray-100 border-gray-300'
                                  : (reag.status === 'aprovado'
                                      ? 'bg-white border-gray-200'
                                      : 'bg-gray-100 border-gray-300')
                              }`}
                            >
                              <div className="flex items-center gap-3 flex-1">
                                <div className={`w-10 h-10 text-white rounded-full flex items-center justify-center font-semibold ${
                                  aulaPassouOuEnviadaReag
                                    ? 'bg-gray-400'
                                    : (reag.status === 'aprovado'
                                        ? 'bg-green-500'
                                        : 'bg-gray-400')
                                }`}>
                                  {alunoNome.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  {/* Nome do aluno primeiro */}
                                  <div className="flex items-center gap-2">
                                    {(() => {
                                      const isCongelado = aluno?.congelado;
                                      const isAusente = aluno?.ausente;
                                      const isEmEspera = aluno?.emEspera;
                                      const nameColor = isAusente ? '#ef4444' : (isCongelado ? '#0ea5e9' : (isEmEspera ? '#eab308' : undefined));
                                      const hasStatus = isCongelado || isAusente;
                                      const shouldStrike = hasStatus || alunoFaltouReag;
                                      return (
                                        <p 
                                          className={`font-medium ${shouldStrike ? 'line-through text-gray-500' : 'text-gray-900'}`}
                                          style={{ color: nameColor || undefined }}
                                        >
                                          {alunoNome}
                                        </p>
                                      );
                                    })()}
                                    {/* Badges de Presente/Faltou inline com nome */}
                                    {alunoPresenteReag && (
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-green-100 text-green-700 text-[9px] rounded font-medium">
                                        <i className="fas fa-check-circle text-[8px]"></i>
                                        Presente
                                      </span>
                                    )}
                                    {alunoFaltouReag && (
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-red-100 text-red-700 text-[9px] rounded font-medium">
                                        <i className="fas fa-times-circle text-[8px]"></i>
                                        Faltou
                                      </span>
                                    )}
                                  </div>
                                  
                                  {/* Info de reagendamento/reposição compacta abaixo do nome */}
                                  <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                    <a
                                      href="#"
                                      onClick={async (e: any) => {
                                        e.preventDefault();
                                        if (horarioOriginal) {
                                          try {
                                            const horarioId = horarioOriginal._id;
                                            const res = await fetch(`/api/horarios?modalidadeId=${modalidadeSelecionada}`);
                                            const data = await res.json();
                                            if (data.success) {
                                              const horarioCompleto = data.data.find((h: any) => h._id === horarioId);
                                              if (horarioCompleto) {
                                                const dataOriginal = parseDateOnly(String(reag.dataOriginal));
                                                setHorarioSelecionado(horarioCompleto);
                                                setDataClicada(dataOriginal);
                                              }
                                            }
                                          } catch (error) {
                                            console.error('Erro ao buscar horário:', error);
                                          }
                                        }
                                      }}
                                      className={`inline-flex items-center gap-1 text-[10px] cursor-pointer ${
                                        reag.status === 'aprovado'
                                          ? 'text-gray-500 hover:text-gray-700 hover:underline'
                                          : (reag.isReposicao 
                                              ? 'px-1.5 py-0.5 rounded font-medium bg-blue-100 text-blue-700 hover:bg-blue-200' 
                                              : 'px-1.5 py-0.5 rounded font-medium bg-orange-100 text-orange-700 hover:bg-orange-200')
                                      }`}
                                      title="Clique para ver horário de origem"
                                    >
                                      {reag.status !== 'aprovado' && (
                                        <i className={`fas ${reag.isReposicao ? 'fa-redo' : 'fa-exchange-alt'} text-[8px]`}></i>
                                      )}
                                      <span>
                                        {reag.isReposicao ? 'Repos. de ' : 'Reag. de '}
                                        {parseDateOnly(String(reag.dataOriginal)).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                        {' '}
                                        {horarioOriginal?.horarioInicio || '--:--'}
                                      </span>
                                      <i className="fas fa-external-link-alt text-[7px] opacity-50"></i>
                                    </a>
                                    {reag.status === 'aprovado' ? (
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-green-100 text-green-700 text-[9px] rounded font-medium">
                                        <i className="fas fa-check text-[7px]"></i>
                                        Aprovado
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-gray-500">
                                        <i className="fas fa-clock text-[8px]"></i> Pendente
                                      </span>
                                    )}
                                  </div>
                              
                                  {aluno?.observacoes && (
                                    <p className="text-[10px] text-gray-500 mt-0.5 italic truncate">
                                      <i className="fas fa-sticky-note mr-0.5 text-[8px]"></i>
                                      {aluno.observacoes}
                                    </p>
                                  )}
                                  
                                  {/* Badges de status do aluno - mais compactos */}
                                  {(aluno?.congelado || aluno?.ausente || aluno?.emEspera || aluno?.periodoTreino || aluno?.parceria) && (
                                    <div className="mt-1 flex items-center gap-1 flex-wrap">
                                      {aluno?.congelado && (
                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-sky-100 text-sky-700 text-[9px] rounded font-medium">
                                          <i className="fas fa-snowflake text-[8px]"></i>
                                          Congelado
                                        </span>
                                      )}
                                      {aluno?.ausente && (
                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-rose-100 text-rose-700 text-[9px] rounded font-medium">
                                          <i className="fas fa-user-clock text-[8px]"></i>
                                          Parou
                                        </span>
                                      )}
                                      {aluno?.emEspera && (
                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[9px] rounded font-medium">
                                          <i className="fas fa-hourglass-half text-[8px]"></i>
                                          Espera
                                        </span>
                                      )}
                                      {aluno?.periodoTreino && (
                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-green-100 text-green-700 text-[9px] rounded font-medium">
                                          <i className="fas fa-clock text-[8px]"></i>
                                          {aluno.periodoTreino}
                                        </span>
                                      )}
                                      {aluno?.parceria && (
                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[9px] rounded font-medium">
                                          <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAC1UlEQVR4AbyWg5LlQBiFY3uSu7Zt27Zt27Zt27Zt60G2tC8w/3aWk/qvkkGqzuU53V+7qSwPQ6S5rttM07Sptm3PJZqXQ5pLypwci8UakjoUIpoo8HDE1EgQhC/kcyYR5IZoms6UJOmtaZo1/zT418OSypuwLPsDh3JHpK7vlmXV+NsTBmn5N2zMXZGeeEneZcpxnLYpA7k0HGS+1aZUVZ336wdZAGNNHzDX9wupvmCs6gVsASs0hKIooykyO5f6X4RaxcH7sCya3i4BRpdDAxiGMeUfgDqyWWQA+9Q4VHhoAHP74MgA2uyO2QfQF3cDi0D8077hcStzzk0M+nYMBnNtX1CHN/0lZWhjUAY1DEjuXgv4qkWA5piEAHitFs2IC8CVzR/0kcnnvU+vpzKuTgOhXqn0AKTO1VEB7qN5QLNM0Neharghe70Y+IoFUwPoS7qhsLllIPbN7xx6zpgb+qUAoClwLk1BQWVwIwTgnJ8UGiDj1ozkAIyrxx1XvnLhoM9WwXu3NDzAvdnJAcRWlVDIfbYAaJ4N+pqVj7ZvHB6VHECb1QGFrF1DAPmmtY0EoI5qlhyA7Gw4NLIpIN/R0aErdx/P84cuMQCjS+C9WYKCfM3iwdNMFcF7HfClFpkvYpvKyfcBoWEZTP1yEdASDwFfnZLhWv5wLogtK6beCdUJrVDY2j8Cdb86tgWu6D2R33u+Xi8G98l8sMiEU4Y1AcZU/FxqAOvACFSwOr4lClt7h+FDaU4nv6d+S+CAommUSwkgtqgIcrdaWYUuG37h7vOFCIAs3+inYRjxVYrE7X7G0/MGgGzJ+Ji+MtXfwvMGwNw8AAHoy7pHu5Coqjo3bNDfKX8OvXHKZqlCVqN0wJvlA98xAQImYNfMBthd+kDnrpkBcieVBRgVVsCQOEPrzinQjqPQfiETAzKACnCLioragbrSwFAppSYGmpkF7J5bQoId4XMA6lRclYDTIrUAAAAASUVORK5CYII=" alt="" className="w-2.5 h-2.5" />
                                          {aluno.parceria}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                              {/* Botão de cancelar */}
                              {reag.status !== 'aprovado' && podeCancelar && (
                                <button
                                  onClick={() => cancelarReagendamento(String(reag._id))}
                                  className="px-3 py-1.5 text-white text-xs rounded-md transition-colors flex flex-col items-center gap-0 ml-2 bg-red-500 hover:bg-red-600 leading-tight"
                                  title={reag.isReposicao ? "Cancelar reposição" : "Cancelar reagendamento"}
                                >
                                  <svg className="w-4 h-4 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                  <span>Cancelar</span>
                                  <span className="text-[10px] opacity-90">{reag.isReposicao ? 'Reposição' : 'Reagendamento'}</span>
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Lista de espera */}
                {horarioSelecionado.matriculas?.some(m => m.emEspera) && (
                  <>
                    <h3 className="font-semibold text-gray-900 mb-3 mt-6">
                      Lista de Espera ({horarioSelecionado.matriculas.filter(m => m.emEspera).length})
                    </h3>
                    <div className="space-y-2">
                      {horarioSelecionado.matriculas
                        .filter(m => m.emEspera)
                        .map((matricula, idx) => (
                          <div 
                            key={matricula._id || `espera-${idx}`}
                            className="flex items-center justify-between p-3 bg-orange-50 rounded-md border border-orange-200"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center font-semibold">
                                {matricula.alunoId?.nome?.charAt(0).toUpperCase() || '?'}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">
                                  {matricula.alunoId?.nome || 'Nome não disponível'}
                                </p>
                                <p className="text-xs text-orange-600">Em espera</p>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal de Reagendamento */}
        {reagendamentoModal && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4"
            onClick={() => setReagendamentoModal(null)}
          >
            <div 
              className="bg-white rounded-lg shadow-lg border border-gray-200 max-w-lg w-full p-6 "
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                    <i className="fas fa-edit text-primary-600"></i>
                    Reagendar Aula
                  </h2>
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                    <i className="fas fa-user text-primary-600"></i>
                    {reagendamentoModal.aluno.nome}
                  </p>
                  {/* Resumo do Reagendamento - Compacto (moved to header) */}
                  <div className="mt-3 mb-1 p-2 bg-gradient-to-r from-red-50 via-gray-50 to-green-50 border border-gray-300 rounded-md">
                    <div className="flex items-center gap-2">
                      {/* Horário Cancelado */}
                      <div className="flex-1 bg-white/80 rounded-md px-3 py-2 border border-red-200">
                        <div className="text-xs">
                          <div className="font-semibold text-red-700 flex items-center gap-1">
                            <i className="far fa-calendar text-red-400"></i>
                            {diasSemana[reagendamentoModal.horarioOriginal.diaSemana]} {reagendamentoModal.dataOriginal.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                          </div>
                          <div className="text-gray-700 font-medium flex items-center gap-1">
                            <i className="far fa-clock text-gray-400"></i>
                            {reagendamentoModal.horarioOriginal.horarioInicio}-{reagendamentoModal.horarioOriginal.horarioFim}
                          </div>
                          {(typeof reagendamentoModal.horarioOriginal.professorId === 'object' && reagendamentoModal.horarioOriginal.professorId?.nome) && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <i className="fas fa-user text-gray-400 text-[10px]"></i>
                              <span 
                                className="inline-block px-1.5 py-0.5 rounded-md text-white text-[10px] font-medium"
                                style={{ backgroundColor: reagendamentoModal.horarioOriginal.professorId.cor || '#3B82F6', filter: 'none' }}
                              >
                                {reagendamentoModal.horarioOriginal.professorId.nome}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Seta */}
                      <div className="flex-shrink-0">
                        <i className="fas fa-arrow-right text-gray-400 text-lg"></i>
                      </div>
                      {/* Horário Novo (se selecionado) */}
                      <div className={`flex-1 bg-white/80 rounded-md px-3 py-2 border ${
                        dataSelecionadaReagendamento && horarioNovoSelecionado 
                          ? 'border-green-400' 
                          : 'border-gray-300'
                      }`}>
                        {dataSelecionadaReagendamento && horarioNovoSelecionado ? (
                          <>
                            {(() => {
                              const horarioSelecionado = horariosDisponiveis.find(h => h._id === horarioNovoSelecionado);
                              const [yearSel, monthSel, daySel] = dataSelecionadaReagendamento.split('-').map(Number);
                              const dataSelecionada = new Date(yearSel, monthSel - 1, daySel);
                              const professorNome = horarioSelecionado && typeof horarioSelecionado.professorId !== 'string' 
                                ? horarioSelecionado.professorId?.nome 
                                : '';
                              const professorCor = horarioSelecionado && typeof horarioSelecionado.professorId !== 'string' 
                                ? horarioSelecionado.professorId?.cor 
                                : '#3B82F6';
                              
                              return horarioSelecionado ? (
                                <div className="text-xs">
                                  <div className="font-semibold text-green-700 flex items-center gap-1">
                                    <i className="far fa-calendar text-green-400"></i>
                                    {diasSemana[dataSelecionada.getDay()]} {dataSelecionada.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                  </div>
                                  <div className="text-gray-700 font-medium flex items-center gap-1">
                                    <i className="far fa-clock text-gray-400"></i>
                                    {horarioSelecionado.horarioInicio}-{horarioSelecionado.horarioFim}
                                  </div>
                                  {professorNome && (
                                    <div className="flex items-center gap-1 mt-0.5">
                                      <i className="fas fa-user text-gray-400 text-[10px]"></i>
                                      <span 
                                        className="inline-block px-1.5 py-0.5 rounded-md text-white text-[10px] font-medium"
                                        style={{ backgroundColor: professorCor, filter: 'none' }}
                                      >
                                        {professorNome}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              ) : null;
                            })()}
                          </>
                        ) : (
                          <div className="text-xs text-gray-500 italic">Selecione abaixo</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setReagendamentoModal(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Fechar"
                >
                  <i className="fas fa-times text-base"></i>
                </button>
              </div>

              {/* Separator between header and content */}
              <div className="border-t border-gray-200 mt-4 mb-4" />

              {/* Conteúdo */}
              <div className="max-h-[70vh] overflow-y-auto text-sm">
                

                <h3 className="font-semibold text-gray-900 mb-3">
                  Selecione a nova data e horário
                </h3>

                {/* Lista de dias com horários disponíveis */}
                <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-2">
                  {diasDisponiveisReag.length > 0 ? (
                    <>
                      {totalPagesReag > 1 && (
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm text-gray-600">
                            Mostrando {paginaAtualReag * 4 + 1} - {Math.min((paginaAtualReag + 1) * 4, diasDisponiveisReag.length)} de {diasDisponiveisReag.length} dias
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setPaginaDiasReagendamento(p => Math.max(0, p - 1))}
                              disabled={paginaAtualReag === 0}
                              className="px-2 py-1 text-sm border rounded disabled:opacity-50"
                            >
                              Anterior
                            </button>
                            <button
                              onClick={() => setPaginaDiasReagendamento(p => Math.min(totalPagesReag - 1, p + 1))}
                              disabled={paginaAtualReag === totalPagesReag - 1}
                              className="px-2 py-1 text-sm border rounded disabled:opacity-50"
                            >
                              Próximo
                            </button>
                          </div>
                        </div>
                      )}

                      {diasMostradosReag.map((dia, idx) => {
                      const dataStr = formatDateToISO(dia.data);
                      const expandido = datasExpandidas.has(dataStr);
                      // determine if this dia (date) is before today (local date-only compare)
                      const _today_chk = new Date();
                      _today_chk.setHours(0, 0, 0, 0);
                      const _d_chk = new Date(dia.data);
                      _d_chk.setHours(0, 0, 0, 0);
                      const diaIsPast = _d_chk < _today_chk;
                      
                      // Verificar se tem pelo menos 1 horário com vaga disponível no dia (considerando reagendamentos)
                      const originalDateStrForDay = reagendamentoModal ? formatDateToISO(reagendamentoModal.dataOriginal) : '';
                      const dayStrForCheck = formatDateToISO(dia.data);
                      const temHorarioDisponivel = dia.horarios.some(horario => {
                        // Ignorar o mesmo dia+horário original do reagendamento (não faz sentido reagendar para o mesmo horário)
                        if (reagendamentoModal && originalDateStrForDay === dayStrForCheck && horario._id === reagendamentoModal.horarioOriginal._id) {
                          return false;
                        }
                        const count = countAlunosForHorario(horario, dia.data);
                        const limiteAlunos = typeof horario.modalidadeId === 'string' 
                          ? 0 
                          : ((horario.modalidadeId as Modalidade)?.limiteAlunos || 0);
                        return count < limiteAlunos;
                      });
                      
                      return (
                        <div key={idx} className={`border rounded-md overflow-hidden transition-all ${
                          temHorarioDisponivel 
                            ? 'border-gray-200 hover:border-green-300' 
                            : 'border-gray-200 hover:border-red-300'
                        }`}>
                          {/* Header - clicável para expandir/retrair */}
                          <button
                            onClick={() => toggleDataExpandida(dataStr)}
                            className={`w-full px-4 py-3 border-b flex items-center justify-between transition-colors ${
                              temHorarioDisponivel 
                                ? 'bg-gray-50 border-gray-200 hover:bg-green-50' 
                                : 'bg-gray-50 border-gray-200 hover:bg-red-50'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <svg 
                                className={`w-5 h-5 transition-all ${expandido ? 'rotate-90' : ''} ${
                                  temHorarioDisponivel ? 'text-gray-600' : 'text-gray-600'
                                }`}
                                fill="none" 
                                stroke="currentColor" 
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-gray-900">
                                  {diasSemana[dia.data.getDay()]} - {dia.data.toLocaleDateString('pt-BR')}
                                </p>
                                {temHorarioDisponivel ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                    Disponível
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                    Lotado
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className="text-sm text-gray-600">
                              {dia.horarios.length} {dia.horarios.length === 1 ? 'horário' : 'horários'}
                            </span>
                          </button>
                          
                          {/* Conteúdo - expansível */}
                          {expandido && (
                            <div className="p-2 space-y-2">
                              {dia.horarios.map((horario) => {
                                const professorNome = typeof horario.professorId === 'string' 
                                  ? '' 
                                  : (horario.professorId?.nome || '');
                                const professorCor = typeof horario.professorId === 'string' 
                                  ? '#3B82F6' 
                                  : (horario.professorId?.cor || '#3B82F6');
                                const count = countAlunosForHorario(horario, dia.data);
                                const limiteAlunos = typeof horario.modalidadeId === 'string' 
                                  ? 0 
                                  : ((horario.modalidadeId as Modalidade)?.limiteAlunos || 0);
                                const originalDateStr = reagendamentoModal ? formatDateToISO(reagendamentoModal.dataOriginal) : '';
                                const isSameOriginal = !!(reagendamentoModal && originalDateStr === dataStr && horario._id === reagendamentoModal.horarioOriginal._id);
                                const temVaga = !isSameOriginal && count < limiteAlunos;
                                const chaveUnica = `${dataStr}-${horario._id}`;
                                const selecionado = dataSelecionadaReagendamento === dataStr && horarioNovoSelecionado === horario._id;
                                
                                return (
                                  <label
                                    key={horario._id}
                                    className={`flex items-center justify-between p-3 rounded-md border-2 transition-all ${
                                      selecionado
                                        ? 'border-blue-400 bg-blue-50 shadow-sm'
                                        : (!temVaga || isSameOriginal)
                                        ? 'border-red-300 bg-red-50 text-red-800 opacity-95 cursor-not-allowed'
                                        : 'border-gray-200 bg-white hover:border-green-300 hover:bg-green-50 cursor-pointer'
                                    }`}
                                    title={isSameOriginal ? 'Mesmo dia e horário da aula original' : undefined}
                                  >
                                    <div className="flex items-center gap-3">
                                      <input
                                        type="checkbox"
                                        name="horarioReagendamento"
                                        value={chaveUnica}
                                        checked={selecionado}
                                        onChange={() => {
                                          if (selecionado) {
                                            setDataSelecionadaReagendamento('');
                                            setHorarioNovoSelecionado('');
                                          } else {
                                            setDataSelecionadaReagendamento(dataStr);
                                            setHorarioNovoSelecionado(String(horario._id));
                                          }
                                        }}
                                        className="h-4 w-4 text-blue-500 focus:ring-blue-500"
                                        disabled={!temVaga || isSameOriginal}
                                      />
                                      <div>
                                        <p className="font-medium text-gray-900">
                                          {horario.horarioInicio} - {horario.horarioFim}
                                        </p>
                                        {professorNome && (
                                          <p className="text-sm text-gray-600 mt-1">
                                            <span 
                                              className="inline-block px-2 py-0.5 rounded-md text-white text-xs font-medium"
                                              style={{ backgroundColor: professorCor, filter: diaIsPast ? 'grayscale(80%) saturate(0.35)' : 'none' }}
                                            >
                                              {professorNome}
                                            </span>
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      {(() => {
                                        const count = countAlunosForHorario(horario, dia.data);
                                        return (
                                          <span className={`text-sm font-semibold ${
                                            count < limiteAlunos ? 'text-green-600' : 'text-red-600'
                                          }`}>
                                            {count}/{limiteAlunos}
                                          </span>
                                        );
                                      })()}
                                      <p className="text-[10px] text-gray-500 uppercase tracking-wide">
                                        {temVaga ? 'vagas' : 'lotado'}
                                      </p>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </>
                ) : (
                    <p className="text-sm text-gray-500 p-4 bg-gray-50 rounded-md text-center">
                      Nenhum horário disponível nos próximos 30 dias
                    </p>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="mt-6 pt-3 border-t border-gray-200 flex justify-end gap-3">
                <button
                  onClick={() => setReagendamentoModal(null)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <i className="fas fa-times text-gray-600"></i>
                  <span>Cancelar</span>
                </button>
                <button
                  onClick={confirmarReagendamento}
                  disabled={!dataSelecionadaReagendamento || !horarioNovoSelecionado}
                  className="px-4 py-2 rounded-md text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <i className="fas fa-save"></i>
                  <span>Confirmar</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Reposição de Falta */}
        {showReporModal && faltaSelecionada && alunoReposicao && (
          <ReporFaltaModal
            open={showReporModal}
            onClose={() => {
              setShowReporModal(false);
              setFaltaSelecionada(null);
              setAlunoReposicao(null);
            }}
            alunoId={alunoReposicao._id}
            alunoNome={alunoReposicao.nome}
            falta={faltaSelecionada}
            onSuccess={() => {
              // Recarregar reagendamentos após sucesso
              setShowReporModal(false);
              setFaltaSelecionada(null);
              setAlunoReposicao(null);
              // Disparar um evento ou recarregar dados se necessário
              window.location.reload();
            }}
          />
        )}
    </ProtectedPage>
  );
}
