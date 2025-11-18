'use client';

import { useState, useEffect, useMemo } from 'react';
import Layout from '@/components/Layout';
import RequireAuth from '@/components/RequireAuth';

interface Modalidade {
  _id: string;
  nome: string;
  cor?: string;
  limiteAlunos?: number;
}

interface Professor {
  _id: string;
  nome: string;
  cor?: string;
}

interface Aluno {
  _id: string;
  nome: string;
  email?: string;
  telefone?: string;
  endereco?: string;
  observacoes?: string;
  periodoTreino?: string | null;
  parceria?: string | null;
  congelado?: boolean;
  ausente?: boolean;
  emEspera?: boolean;
}

interface Matricula {
  _id: string;
  alunoId: Aluno;
  observacoes?: string;
  emEspera?: boolean;
}

interface HorarioFixo {
  _id: string;
  professorId: Professor;
  diaSemana: number;
  horarioInicio: string;
  horarioFim: string;
  modalidadeId: string;
  ativo: boolean;
  matriculas: Matricula[];
  observacaoTurma?: string;
}

interface Reagendamento {
  _id: string;
  horarioFixoId: HorarioFixo;
  dataOriginal: string;
  novaData: string;
  novoHorarioInicio: string;
  novoHorarioFim: string;
  novoHorarioFixoId: HorarioFixo;
  matriculaId: Matricula;
  motivo: string;
  status: 'pendente' | 'aprovado' | 'rejeitado';
}

// Função para ajustar o brilho de uma cor hex
function adjustColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + percent));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + percent));
  const b = Math.min(255, Math.max(0, (num & 0x0000FF) + percent));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

// Função para fazer parse correto de data ISO sem problemas de timezone
function parseDateISO(dateString: string): Date {
  const [year, month, day] = dateString.split('T')[0].split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Função para converter Date em string YYYY-MM-DD sem problemas de timezone
function formatDateToISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function CalendarioPage() {
  const [modalidades, setModalidades] = useState<Modalidade[]>([]);
  const [modalidadeSelecionada, setModalidadeSelecionada] = useState<string>('');
  const [horarios, setHorarios] = useState<HorarioFixo[]>([]);
  const [reagendamentos, setReagendamentos] = useState<Reagendamento[]>([]);
  const [horarioSelecionado, setHorarioSelecionado] = useState<HorarioFixo | null>(null);
  const [dataClicada, setDataClicada] = useState<Date | null>(null);
  const [reagendamentoModal, setReagendamentoModal] = useState<{
    aluno: Aluno;
    matricula: Matricula;
    horarioOriginal: HorarioFixo;
    dataOriginal: Date;
  } | null>(null);
  const [horariosDisponiveis, setHorariosDisponiveis] = useState<HorarioFixo[]>([]);
  const [dataSelecionadaReagendamento, setDataSelecionadaReagendamento] = useState<string>('');
  const [horarioNovoSelecionado, setHorarioNovoSelecionado] = useState<string>('');
  const [datasExpandidas, setDatasExpandidas] = useState<Set<string>>(new Set());
  const [year, setYear] = useState<number>(2025);
  const [month, setMonth] = useState<number>(10);
  const [todayString, setTodayString] = useState<string>('');

  const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  // Debug: log modalidadeSelecionada changes
  useEffect(() => {
    // Modalidade selecionada mudou
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

  // Salvar modalidade selecionada no localStorage quando mudar
  useEffect(() => {
    if (modalidadeSelecionada) {
      localStorage.setItem('calendario-modalidade-selecionada', modalidadeSelecionada);
    }
  }, [modalidadeSelecionada]);

  // Buscar modalidades separadamente
  useEffect(() => {
    const fetchModalidades = async () => {
      try {
        const res = await fetch('/api/modalidades');
        const data = await res.json();
        
        if (data.success) {
          const modalidadesData = data.data || [];
          
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
  }, []);

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
    
    fetchHorarios();
    fetchReagendamentos();
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
    const dataStr = date.toISOString().split('T')[0];
    
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

  const abrirReagendamento = (aluno: Aluno, matricula: Matricula, horarioOriginal: HorarioFixo, dataOriginal: Date) => {
    // Validar se aluno pode ser reagendado
    if (aluno?.congelado || aluno?.ausente || aluno?.emEspera) {
      const motivo = aluno?.congelado 
        ? 'congelado' 
        : (aluno?.ausente ? 'parou de vir' : 'em espera');
      alert(`Não é possível reagendar este aluno. O aluno está ${motivo}.`);
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
    if (!confirm('Tem certeza que deseja cancelar este reagendamento?')) {
      return;
    }

    try {
      console.log('[Reagendamento] Cancelando:', reagendamentoId);

      const res = await fetch(`/api/reagendamentos/${reagendamentoId}`, {
        method: 'DELETE'
      });

      const data = await res.json();

      if (data.success) {
        setHorarioSelecionado(null);
        setDataClicada(null);
        // Recarregar a página para atualizar os dados
        window.location.reload();
      } else {
        alert(`Erro: ${data.error || 'Não foi possível cancelar o reagendamento'}`);
      }
    } catch (e) {
      console.error('[Reagendamento] Erro ao cancelar:', e);
      alert('Erro ao cancelar reagendamento');
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

  // Gerar próximos 30 dias com horários disponíveis
  const gerarProximosDias = () => {
    if (!reagendamentoModal) return [];

    const dias: Array<{ data: Date; horarios: HorarioFixo[] }> = [];
    const hoje = new Date();
    const dataLimite = new Date(reagendamentoModal.dataOriginal.getTime() + 30 * 24 * 60 * 60 * 1000);

    for (let i = 0; i < 30; i++) {
      const data = new Date(hoje);
      data.setDate(hoje.getDate() + i);
      
      if (data > dataLimite) break;

      const dow = data.getDay();
      const horariosNoDia = horariosDisponiveis.filter(h => h.diaSemana === dow);
      
      if (horariosNoDia.length > 0) {
        dias.push({ data, horarios: horariosNoDia });
      }
    }

    return dias;
  };

  const confirmarReagendamento = async () => {
    if (!reagendamentoModal || !dataSelecionadaReagendamento || !horarioNovoSelecionado) {
      alert('Por favor, selecione uma data e um horário');
      return;
    }

    try {
      const horarioNovo = horariosDisponiveis.find(h => h._id === horarioNovoSelecionado);
      if (!horarioNovo) {
        alert('Horário não encontrado');
        return;
      }

      const body = {
        horarioFixoId: reagendamentoModal.horarioOriginal._id,
        dataOriginal: formatDateToISO(reagendamentoModal.dataOriginal),
        novaData: dataSelecionadaReagendamento,
        novoHorarioInicio: horarioNovo.horarioInicio,
        novoHorarioFim: horarioNovo.horarioFim,
        novoHorarioFixoId: horarioNovo._id,
        matriculaId: reagendamentoModal.matricula._id,
        motivo: `Reagendamento de ${reagendamentoModal.horarioOriginal.horarioInicio}-${reagendamentoModal.horarioOriginal.horarioFim} para ${horarioNovo.horarioInicio}-${horarioNovo.horarioFim}`
      };

      console.log('[Reagendamento] Enviando:', body);

      const res = await fetch('/api/reagendamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (data.success) {
        alert('Reagendamento criado com sucesso!');
        setReagendamentoModal(null);
        setHorarioSelecionado(null);
        // Recarregar a página para atualizar os dados
        window.location.reload();
      } else {
        alert(`Erro: ${data.error || 'Não foi possível criar o reagendamento'}`);
      }
    } catch (e) {
      console.error('[Reagendamento] Erro ao confirmar:', e);
      alert('Erro ao criar reagendamento');
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

  return (
    <RequireAuth showLoginRedirect={false}>
      <Layout title="Calendário - Superação Flux" fullWidth>
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
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-semibold text-gray-700">
                <i className="fas fa-filter mr-2 text-primary-600"></i>
                Selecione a Modalidade
              </label>
              {/* Navegação de mês - compacta */}
              <div className="flex items-center gap-2">
                <button 
                  onClick={prevMonth}
                  className="px-3 py-2 rounded-full text-sm font-medium border border-gray-300 bg-white hover:bg-gray-100 transition-all"
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
                <div className="flex items-center gap-1.5 border border-gray-300 rounded-md px-3 py-2 bg-white text-sm">
                  <select
                    value={month}
                    onChange={(e) => setMonth(parseInt(e.target.value))}
                    className="bg-transparent text-sm font-medium outline-none cursor-pointer"
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
                    className="w-14 text-sm font-medium text-right outline-none"
                  />
                </div>
                <button 
                  onClick={nextMonth}
                  className="px-3 py-2 rounded-full text-sm font-medium border border-gray-300 bg-white hover:bg-gray-100 transition-all"
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
                  className="px-3 py-2 rounded-full text-sm font-medium border border-primary-600 bg-primary-600 text-white hover:bg-primary-700 transition-all"
                  title="Ir para hoje"
                >
                  Hoje
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 fade-in-3">
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
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full border border-white" style={{ backgroundColor: m.cor || '#3B82F6' }} />
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
          <div className="grid grid-cols-7 gap-2 text-xs fade-in-4">
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
              const cellBg = inCurrentMonth ? 'bg-white' : 'bg-gray-200 text-gray-500';
              const hoverClass = inCurrentMonth ? 'hover:bg-gray-50' : '';
              const dateKey = `${dObj.date.getFullYear()}-${dObj.date.getMonth()}-${dObj.date.getDate()}`;

              return (
                <div
                  key={dateKey}
                  className={`p-2 h-48 flex flex-col min-h-0 ${cellBg} ${
                    isToday ? 'ring-2 ring-primary-500' : ''
                  } border rounded-sm ${hoverClass} transition-colors`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className={`font-medium text-sm ${inCurrentMonth ? 'text-gray-900' : 'text-gray-500'}`}>
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
                        ? '' 
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
                      
                      return (
                        <button
                          key={horarioKey}
                          onClick={() => {
                            if (inCurrentMonth) {
                              setHorarioSelecionado(horario);
                              setDataClicada(dObj.date);
                            }
                          }}
                          disabled={!inCurrentMonth}
                          className={`w-full border rounded-md px-2 py-1 text-xs transition-colors text-left ${
                            !inCurrentMonth
                              ? 'bg-gray-100 border-gray-300 opacity-50 cursor-default'
                              : temReagendamentoOrigem 
                                ? 'bg-red-50 border-red-300 opacity-60 hover:opacity-90 cursor-pointer' 
                                : numAlunos >= limiteAlunos
                                  ? 'bg-red-50 border-red-300 hover:opacity-90 cursor-pointer'
                                  : 'bg-green-50 border-green-300 hover:opacity-90 cursor-pointer'
                          }`}
                        >
                          <div className={`font-semibold ${
                            !inCurrentMonth
                              ? 'text-gray-500'
                              : temReagendamentoOrigem 
                                ? 'text-red-900 line-through' 
                                : numAlunos >= limiteAlunos
                                  ? 'text-red-900'
                                  : 'text-green-900'
                          }`}>
                            {horario.horarioInicio} - {horario.horarioFim}
                          </div>
                          {professorNome && (
                            <div className="text-[10px] mt-0.5 flex items-center justify-between gap-1">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-md font-medium text-white text-[9px] border border-gray-200 shadow-sm transition-colors duration-150`}
                                style={{ 
                                  backgroundColor: !inCurrentMonth ? '#9CA3AF' : (temReagendamentoOrigem ? '#DC2626' : professorCor), 
                                  opacity: !inCurrentMonth ? 0.7 : (temReagendamentoOrigem ? 0.7 : 1) 
                                }}
                              >
                                {professorNome}
                              </span>
                              <span className={`text-[10px] font-medium ${
                                temReagendamentoOrigem
                                  ? 'text-red-700'
                                  : numAlunos >= limiteAlunos
                                    ? 'text-red-700'
                                    : 'text-green-700'
                              }`}>
                                {numAlunos}/{limiteAlunos}
                                {temReagendamentoOrigem && ' ⚠️'}
                              </span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                    
                    {/* Exibir reagendamentos de destino (alunos que virão neste dia) */}
                    {inCurrentMonth && getReagendamentosForDate(dObj.date).destino.map((reag, rIdx) => {
                      const matriculaId = reag.matriculaId;
                      const aluno = matriculaId && typeof matriculaId === 'object' && matriculaId.alunoId && typeof matriculaId.alunoId !== 'string'
                        ? matriculaId.alunoId
                        : null;
                      const alunoNome = aluno?.nome || 'Aluno';
                      const inactive = !!(aluno?.congelado || aluno?.ausente);
                      
                      const novoHorarioFixoId = reag.novoHorarioFixoId;
                      const professorNome = novoHorarioFixoId && typeof novoHorarioFixoId === 'object' && novoHorarioFixoId.professorId
                        ? (typeof novoHorarioFixoId.professorId === 'string' ? '' : (novoHorarioFixoId.professorId?.nome || ''))
                        : '';
                      
                      return (
                        <div
                          key={`reag-${rIdx}`}
                          className={`w-full border rounded-md px-2 py-1 text-xs ${inactive ? 'bg-gray-100 border-gray-300 text-gray-500 filter grayscale' : 'bg-orange-50 border-orange-300'}`}
                        >
                          <div className={`font-semibold ${inactive ? 'text-gray-600' : 'text-orange-900'}`}>
                            {reag.novoHorarioInicio} - {reag.novoHorarioFim}
                          </div>
                          {professorNome && (
                            <div className="text-[10px] mt-0.5">
                              <span className={`inline-block px-1.5 py-0.5 rounded-md ${inactive ? 'bg-gray-300 text-gray-700' : 'bg-orange-600 text-white'} text-[9px] font-medium`}>
                                {professorNome}
                              </span>
                            </div>
                          )}
                          <div className={`text-[10px] mt-0.5 ${inactive ? 'text-gray-500 line-through' : 'text-orange-700'}`}>
                            {alunoNome} (Reagendado)
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal de detalhes do horário */}
        {horarioSelecionado && (
          <div
            className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => {
              setHorarioSelecionado(null);
              setDataClicada(null);
            }}
          >
            <div
              className="bg-white rounded-lg shadow-lg border border-gray-200 max-w-2xl w-full max-h-[80vh] overflow-hidden p-6"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                    <i className="fas fa-edit text-primary-600"></i>
                    {horarioSelecionado.horarioInicio} - {horarioSelecionado.horarioFim}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                    <i className="fas fa-info-circle text-primary-600"></i>
                    <span>{diasSemana[horarioSelecionado.diaSemana]}</span>
                    {dataClicada && (
                      <>
                        <span>•</span>
                        <span>{dataClicada.toLocaleDateString('pt-BR')}</span>
                      </>
                    )}
                    {(typeof horarioSelecionado.professorId === 'string'
                      ? ''
                      : horarioSelecionado.professorId?.nome) && (
                      <>
                        <span>•</span>
                        <span
                          className="inline-block px-2 py-1 rounded-md text-white text-xs font-medium"
                          style={{
                            backgroundColor: typeof horarioSelecionado.professorId === 'string'
                              ? '#3B82F6'
                              : (horarioSelecionado.professorId?.cor || '#3B82F6')
                          }}
                        >
                          {typeof horarioSelecionado.professorId === 'string'
                            ? ''
                            : horarioSelecionado.professorId?.nome || 'Professor não definido'}
                        </span>
                      </>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setHorarioSelecionado(null);
                    setDataClicada(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Fechar"
                >
                  <i className="fas fa-times text-base"></i>
                </button>
              </div>

              {/* Separator between header and content */}
              <div className="border-t border-gray-200 mt-4 mb-4" />

              {/* Conteúdo */}
              <div className="overflow-y-auto max-h-[calc(80vh-100px)]">
                {horarioSelecionado.observacaoTurma && (
                  <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <p className="text-sm text-yellow-800">
                      <strong>Observação:</strong> {horarioSelecionado.observacaoTurma}
                    </p>
                  </div>
                )}

                {(() => {
                  const dataAula = dataClicada || new Date();
                  const dataAulaStr = dataAula.toISOString().split('T')[0];
                  
                  // Contar alunos que faltarão (reagendados para outro horário)
                  const alunosFaltarao = reagendamentos.filter(r => {
                    const horarioFixoId = typeof r.horarioFixoId === 'string' 
                      ? r.horarioFixoId 
                      : r.horarioFixoId?._id;
                    const dataOriginalNormalizada = r.dataOriginal?.split('T')[0];
                    
                    return horarioFixoId === horarioSelecionado._id &&
                      dataOriginalNormalizada === dataAulaStr &&
                      r.status !== 'rejeitado';
                  }).length;
                  
                  // Contar alunos que virão (reagendados de outros horários)
                  const alunosVirao = reagendamentos.filter(r => {
                    const novoHorarioFixoId = typeof r.novoHorarioFixoId === 'string'
                      ? r.novoHorarioFixoId
                      : r.novoHorarioFixoId?._id;
                    const novaDataNormalizada = r.novaData?.split('T')[0];
                    
                    return novoHorarioFixoId === horarioSelecionado._id &&
                      novaDataNormalizada === dataAulaStr &&
                      r.status !== 'rejeitado';
                  }).length;
                  
                  // Contar apenas alunos ativos (não em espera, não congelados, não ausentes)
                  const totalMatriculados = horarioSelecionado.matriculas?.filter(m => {
                    const isEmEspera = m.emEspera || m.alunoId?.emEspera;
                    const isCongelado = m.alunoId?.congelado;
                    const isAusente = m.alunoId?.ausente;
                    return !isEmEspera && !isCongelado && !isAusente;
                  }).length || 0;
                  const totalPresentes = totalMatriculados - alunosFaltarao + alunosVirao;
                  
                  return (
                    <h3 className="font-semibold text-gray-900 mb-3">
                      Alunos Fixos ({totalMatriculados})
                    </h3>
                  );
                })()}

                {horarioSelecionado.matriculas && horarioSelecionado.matriculas.length > 0 ? (
                  <div className="space-y-2">
                    {horarioSelecionado.matriculas
                      .filter(m => !m.emEspera)
                      .map((matricula, idx) => {
                        // Usar a data clicada ao invés de calcular a próxima ocorrência
                        const dataAula = dataClicada || new Date();
                        const dataAulaStr = dataAula.toISOString().split('T')[0];
                        
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
                        
                        // Determine inactive state for consistent styling
                        const inactive = !!(matricula.alunoId?.congelado || matricula.alunoId?.ausente);

                        return (
                          <div 
                            key={matricula._id || `aluno-${idx}`}
                            className={`flex items-center justify-between p-3 rounded-md border transition-colors ${
                              inactive
                                ? 'bg-gray-100 border-gray-300 text-gray-500 filter grayscale'
                                : (matricula.alunoId?.emEspera
                                    ? 'bg-amber-100 border-amber-300'
                                    : (reagendamentoAluno ? 'bg-gray-100 border-gray-300' : 'bg-gray-50 border-gray-200'))
                            }`}
                          >
                            <div className="flex items-center gap-3 flex-1">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-white ${
                                inactive ? 'bg-gray-400' : (reagendamentoAluno ? 'bg-gray-400' : (matricula.alunoId?.emEspera ? 'bg-amber-500' : 'bg-green-500'))
                              }`}>
                                {matricula.alunoId?.nome?.charAt(0).toUpperCase() || '?'}
                              </div>
                              <div className="flex-1">
                                {reagendamentoAluno && (
                                  <button
                                    onClick={async () => {
                                      if (typeof reagendamentoAluno.novoHorarioFixoId !== 'string' && reagendamentoAluno.novoHorarioFixoId) {
                                        try {
                                          // Buscar o horário completo com matrículas
                                          const horarioId = reagendamentoAluno.novoHorarioFixoId._id;
                                          const res = await fetch(`/api/horarios?modalidadeId=${modalidadeSelecionada}`);
                                          const data = await res.json();
                                          if (data.success) {
                                            const horarioCompleto = data.data.find((h: any) => h._id === horarioId);
                                            if (horarioCompleto) {
                                              const novaData = parseDateISO(reagendamentoAluno.novaData);
                                              setHorarioSelecionado(horarioCompleto);
                                              setDataClicada(novaData);
                                            }
                                          }
                                        } catch (error) {
                                          console.error('Erro ao buscar horário:', error);
                                        }
                                      }
                                    }}
                                    className="inline-flex items-center gap-1.5 px-2 py-1 bg-gray-200 text-gray-600 text-[11px] rounded-md font-medium border border-gray-300 hover:bg-gray-300 transition-colors cursor-pointer mb-2"
                                    title="Clique para ver o novo horário"
                                  >
                                    <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                    </svg>
                                    <span className="font-semibold">Reagendado:</span>
                                    <span className="flex items-center gap-1">
                                      <i className="far fa-calendar text-gray-500"></i>
                                      {parseDateISO(reagendamentoAluno.novaData).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <i className="far fa-clock text-gray-500"></i>
                                      {reagendamentoAluno.novoHorarioInicio}
                                    </span>
                                    {(typeof reagendamentoAluno.novoHorarioFixoId !== 'string' && 
                                      reagendamentoAluno.novoHorarioFixoId?.professorId &&
                                      typeof reagendamentoAluno.novoHorarioFixoId.professorId !== 'string') && (
                                      <span className="flex items-center gap-1">
                                        <i className="fas fa-user text-gray-500 text-[10px]"></i>
                                        <span className="text-gray-600">
                                          {reagendamentoAluno.novoHorarioFixoId.professorId.nome}
                                        </span>
                                      </span>
                                    )}
                                  </button>
                                )}
                                <div className="flex items-center gap-2">
                                  {(() => {
                                    const isCongelado = matricula.alunoId?.congelado;
                                    const isAusente = matricula.alunoId?.ausente;
                                    const isEmEspera = matricula.alunoId?.emEspera;
                                    const nameColor = isAusente ? '#ef4444' : (isCongelado ? '#0ea5e9' : (isEmEspera ? '#eab308' : undefined));
                                    const hasStatus = isCongelado || isAusente;
                                    
                                    let reagendadoColor = '#9CA3AF';
                                    if (reagendamentoAluno) {
                                      if (matricula.alunoId?.ausente) reagendadoColor = '#dc2626';
                                      else if (matricula.alunoId?.congelado) reagendadoColor = '#0369a1';
                                      else if (matricula.alunoId?.emEspera) reagendadoColor = '#b45309';
                                    }
                                    
                                    return (
                                      <p 
                                        className={`font-medium ${hasStatus ? 'line-through text-gray-500' : (reagendamentoAluno ? 'text-gray-600' : 'text-gray-900')}`}
                                        style={{ 
                                          color: reagendamentoAluno ? reagendadoColor : (nameColor || undefined)
                                        }}
                                      >
                                        {matricula.alunoId?.nome || 'Nome não disponível'}
                                      </p>
                                    );
                                  })()}
                                </div>
                                {matricula.alunoId?.observacoes && (
                                  <p className="text-xs text-gray-600 mt-1 italic">
                                    <i className="fas fa-sticky-note mr-1"></i>
                                    {matricula.alunoId.observacoes}
                                  </p>
                                )}
                                {/* Badges de status do aluno */}
                                <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                                  {matricula.alunoId?.congelado && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-sky-100 text-sky-700 text-[10px] rounded-md font-medium border border-sky-200">
                                      <i className="fas fa-snowflake"></i>
                                      Congelado
                                    </span>
                                  )}
                                  {matricula.alunoId?.ausente && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-100 text-rose-700 text-[10px] rounded-md font-medium border border-rose-200">
                                      <i className="fas fa-user-clock"></i>
                                      Parou de Vir
                                    </span>
                                  )}
                                  {matricula.alunoId?.emEspera && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] rounded-md font-medium border border-amber-200">
                                      <i className="fas fa-hourglass-half"></i>
                                      Em Espera
                                    </span>
                                  )}
                                  {matricula.alunoId?.periodoTreino && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-[10px] rounded-md font-medium border border-green-200">
                                      <i className="fas fa-clock"></i>
                                      {matricula.alunoId.periodoTreino}
                                    </span>
                                  )}
                                  {matricula.alunoId?.parceria && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px] rounded-md font-medium border border-purple-200">
                                      <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAC1UlEQVR4AbyWg5LlQBiFY3uSu7Zt27Zt27Zt27Zt60G2tC8w/3aWk/qvkkGqzuU53V+7qSwPQ6S5rttM07Sptm3PJZqXQ5pLypwci8UakjoUIpoo8HDE1EgQhC/kcyYR5IZoms6UJOmtaZo1/zT418OSypuwLPsDh3JHpK7vlmXV+NsTBmn5N2zMXZGeeEneZcpxnLYpA7k0HGS+1aZUVZ336wdZAGNNHzDX9wupvmCs6gVsASs0hKIooykyO5f6X4RaxcH7sCya3i4BRpdDAxiGMeUfgDqyWWQA+9Q4VHhoAHP74MgA2uyO2QfQF3cDi0D8077hcStzzk0M+nYMBnNtX1CHN/0lZWhjUAY1DEjuXgv4qkWA5piEAHitFs2IC8CVzR/0kcnnvU+vpzKuTgOhXqn0AKTO1VEB7qN5QLNM0Neharghe70Y+IoFUwPoS7qhsLllIPbN7xx6zpgb+qUAoClwLk1BQWVwIwTgnJ8UGiDj1ozkAIyrxx1XvnLhoM9WwXu3NDzAvdnJAcRWlVDIfbYAaJ4N+pqVj7ZvHB6VHECb1QGFrF1DAPmmtY0EoI5qlhyA7Gw4NLIpIN/R0aErdx/P84cuMQCjS+C9WYKCfM3iwdNMFcF7HfClFpkvYpvKyfcBoWEZTP1yEdASDwFfnZLhWv5wLogtK6beCdUJrVDY2j8Cdb86tgWu6D2R33u+Xi8G98l8sMiEU4Y1AcZU/FxqAOvACFSwOr4lClt7h+FDaU4nv6d+S+CAommUSwkgtqgIcrdaWYUuG37h7vOFCIAs3+inYRjxVYrE7X7G0/MGgGzJ+Ji+MtXfwvMGwNw8AAHoy7pHu5Coqjo3bNDfKX8OvXHKZqlCVqN0wJvlA98xAQImYNfMBthd+kDnrpkBcieVBRgVVsCQOEPrzinQjqPQfiETAzKACnCLioragbrSwFAppSYGmpkF7J5bQoId4XMA6lRclYDTIrUAAAAASUVORK5CYII=" alt="TOTALPASS" style={{ width: '12px', height: '12px' }} />
                                      {matricula.alunoId.parceria}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {reagendamentoAluno ? (
                                <>
                                  <button
                                    onClick={() => cancelarReagendamento(reagendamentoAluno._id)}
                                    className="px-3 py-1.5 text-white text-xs rounded-md transition-colors flex items-center gap-1 bg-red-500 hover:bg-red-600"
                                    title="Cancelar reagendamento"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                    Cancelar
                                  </button>
                                </>
                              ) : (
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
                                  className={`px-3 py-1.5 text-white text-xs rounded-md transition-colors flex items-center gap-1 ${
                                    matricula.alunoId?.congelado || matricula.alunoId?.ausente || matricula.alunoId?.emEspera
                                      ? 'bg-gray-400 cursor-not-allowed'
                                      : 'bg-orange-500 hover:bg-orange-600'
                                  }`}
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                  </svg>
                                  Reagendar
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">Nenhum aluno matriculado neste horário.</p>
                )}

                {/* Alunos Reagendados para este horário nesta data */}
                {(() => {
                  const dataAula = dataClicada || new Date();
                  const dataAulaStr = dataAula.toISOString().split('T')[0];
                  
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
                    <>
                      <h3 className="font-semibold text-gray-900 mb-3 mt-6">
                        Alunos Reagendados para este Horário ({alunosReagendadosParaCa.length})
                      </h3>
                      <div className="space-y-2">
                        {alunosReagendadosParaCa.map((reag, idx) => {
                          const matricula = typeof reag.matriculaId === 'object' ? reag.matriculaId : null;
                          const aluno = matricula && typeof matricula.alunoId === 'object' 
                            ? matricula.alunoId 
                            : null;
                          const alunoNome = aluno?.nome || 'Aluno';
                          
                          const horarioOriginal = typeof reag.horarioFixoId === 'object' 
                            ? reag.horarioFixoId 
                            : null;
                          const professorOriginal = horarioOriginal && typeof horarioOriginal.professorId === 'object'
                            ? horarioOriginal.professorId?.nome
                            : '';
                          
                          return (
                            <div 
                              key={reag._id || `reag-temp-${idx}`}
                              className="flex items-center justify-between p-3 rounded-md border bg-green-50 border-green-300"
                            >
                              <div className="flex items-center gap-3 flex-1">
                                <div className="w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center font-semibold">
                                  {alunoNome.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1">
                                  <button
                                    onClick={async () => {
                                      if (horarioOriginal) {
                                        try {
                                          // Buscar o horário completo com matrículas
                                          const horarioId = horarioOriginal._id;
                                          const res = await fetch(`/api/horarios?modalidadeId=${modalidadeSelecionada}`);
                                          const data = await res.json();
                                          if (data.success) {
                                            const horarioCompleto = data.data.find((h: any) => h._id === horarioId);
                                            if (horarioCompleto) {
                                              const dataOriginal = parseDateISO(reag.dataOriginal);
                                              setHorarioSelecionado(horarioCompleto);
                                              setDataClicada(dataOriginal);
                                            }
                                          }
                                        } catch (error) {
                                          console.error('Erro ao buscar horário:', error);
                                        }
                                      }
                                    }}
                                    className="inline-flex items-center gap-1.5 px-2 py-1 bg-green-100 text-green-800 text-[11px] rounded-md font-medium border border-green-200 hover:bg-green-200 transition-colors cursor-pointer mb-2"
                                    title="Clique para ver o horário original"
                                  >
                                    <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                    </svg>
                                    <span className="font-semibold">Reagendado:</span>
                                    <span className="flex items-center gap-1">
                                      <i className="far fa-calendar text-green-600"></i>
                                      {parseDateISO(reag.dataOriginal).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <i className="far fa-clock text-green-600"></i>
                                      {horarioOriginal?.horarioInicio || '--:--'}
                                    </span>
                                    {professorOriginal && (
                                      <span className="flex items-center gap-1">
                                        <i className="fas fa-user text-green-600 text-[10px]"></i>
                                        <span className="text-green-800">
                                          {professorOriginal}
                                        </span>
                                      </span>
                                    )}
                                    {/* external link icon removed for cleaner modal */}
                                  </button>
                                  <div className="flex items-center gap-2">
                                    {(() => {
                                      const isCongelado = aluno?.congelado;
                                      const isAusente = aluno?.ausente;
                                      const isEmEspera = aluno?.emEspera;
                                      const nameColor = isAusente ? '#ef4444' : (isCongelado ? '#0ea5e9' : (isEmEspera ? '#eab308' : undefined));
                                      const hasStatus = isCongelado || isAusente;
                                      return (
                                        <p 
                                          className={`font-medium ${hasStatus ? 'line-through text-gray-500' : 'text-gray-900'}`}
                                          style={{ color: nameColor || undefined }}
                                        >
                                          {alunoNome}
                                        </p>
                                      );
                                    })()}
                                  </div>
                                  {reag.motivo && (
                                    <p className="text-xs text-gray-600 mt-1 italic">
                                      Motivo: {reag.motivo}
                                    </p>
                                  )}
                                  {aluno?.observacoes && (
                                    <p className="text-xs text-gray-600 mt-1 italic">
                                      <i className="fas fa-sticky-note mr-1"></i>
                                      {aluno.observacoes}
                                    </p>
                                  )}
                                  {/* Badges de status do aluno */}
                                  <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                                    {aluno?.congelado && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-sky-100 text-sky-700 text-[10px] rounded-md font-medium border border-sky-200">
                                        <i className="fas fa-snowflake"></i>
                                        Congelado
                                      </span>
                                    )}
                                    {aluno?.ausente && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-100 text-rose-700 text-[10px] rounded-md font-medium border border-rose-200">
                                        <i className="fas fa-user-clock"></i>
                                        Parou de Vir
                                      </span>
                                    )}
                                    {aluno?.emEspera && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] rounded-md font-medium border border-amber-200">
                                        <i className="fas fa-hourglass-half"></i>
                                        Em Espera
                                      </span>
                                    )}
                                    {aluno?.periodoTreino && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-[10px] rounded-md font-medium border border-green-200">
                                        <i className="fas fa-clock"></i>
                                        {aluno.periodoTreino}
                                      </span>
                                    )}
                                    {aluno?.parceria && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px] rounded-md font-medium border border-purple-200">
                                        <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAC1UlEQVR4AbyWg5LlQBiFY3uSu7Zt27Zt27Zt27Zt60G2tC8w/3aWk/qvkkGqzuU53V+7qSwPQ6S5rttM07Sptm3PJZqXQ5pLypwci8UakjoUIpoo8HDE1EgQhC/kcyYR5IZoms6UJOmtaZo1/zT418OSypuwLPsDh3JHpK7vlmXV+NsTBmn5N2zMXZGeeEneZcpxnLYpA7k0HGS+1aZUVZ336wdZAGNNHzDX9wupvmCs6gVsASs0hKIooykyO5f6X4RaxcH7sCya3i4BRpdDAxiGMeUfgDqyWWQA+9Q4VHhoAHP74MgA2uyO2QfQF3cDi0D8077hcStzzk0M+nYMBnNtX1CHN/0lZWhjUAY1DEjuXgv4qkWA5piEAHitFs2IC8CVzR/0kcnnvU+vpzKuTgOhXqn0AKTO1VEB7qN5QLNM0Neharghe70Y+IoFUwPoS7qhsLllIPbN7xx6zpgb+qUAoClwLk1BQWVwIwTgnJ8UGiDj1ozkAIyrxx1XvnLhoM9WwXu3NDzAvdnJAcRWlVDIfbYAaJ4N+pqVj7ZvHB6VHECb1QGFrF1DAPmmtY0EoI5qlhyA7Gw4NLIpIN/R0aErdx/P84cuMQCjS+C9WYKCfM3iwdNMFcF7HfClFpkvYpvKyfcBoWEZTP1yEdASDwFfnZLhWv5wLogtK6beCdUJrVDY2j8Cdb86tgWu6D2R33u+Xi8G98l8sMiEU4Y1AcZU/FxqAOvACFSwOr4lClt7h+FDaU4nv6d+S+CAommUSwkgtqgIcrdaWYUuG37h7vOFCIAs3+inYRjxVYrE7X7G0/MGgGzJ+Ji+MtXfwvMGwNw8AAHoy7pHu5Coqjo3bNDfKX8OvXHKZqlCVqN0wJvlA98xAQImYNfMBthd+kDnrpkBcieVBRgVVsCQOEPrzinQjqPQfiETAzKACnCLioragbrSwFAppSYGmpkF7J5bQoId4XMA6lRclYDTIrUAAAAASUVORK5CYII=" alt="TOTALPASS" style={{ width: '12px', height: '12px' }} />
                                        {aluno.parceria}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <button
                                onClick={() => cancelarReagendamento(reag._id)}
                                className="px-3 py-1.5 text-white text-xs rounded-md transition-colors flex items-center gap-1 ml-2 bg-red-500 hover:bg-red-600"
                                title="Cancelar reagendamento"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                Cancelar
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </>
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
                {/* Resumo do Reagendamento - Compacto */}
                <div className="mb-6 p-3 bg-gradient-to-r from-red-50 via-gray-50 to-green-50 border border-gray-300 rounded-md">
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
                              style={{ backgroundColor: reagendamentoModal.horarioOriginal.professorId.cor || '#3B82F6' }}
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
                    
                    {/* Horário Novo */}
                    <div className={`flex-1 bg-white/80 rounded-md px-3 py-2 border ${
                      dataSelecionadaReagendamento && horarioNovoSelecionado 
                        ? 'border-green-400' 
                        : 'border-gray-300'
                    }`}>
                      {dataSelecionadaReagendamento && horarioNovoSelecionado ? (
                        <>
                          {(() => {
                            const horarioSelecionado = horariosDisponiveis.find(h => h._id === horarioNovoSelecionado);
                            // Parse the date correctly to avoid timezone issues
                            const [year, month, day] = dataSelecionadaReagendamento.split('-').map(Number);
                            const dataSelecionada = new Date(year, month - 1, day);
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
                                      style={{ backgroundColor: professorCor }}
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

                <h3 className="font-semibold text-gray-900 mb-3">
                  Selecione a nova data e horário
                </h3>

                {/* Lista de dias com horários disponíveis */}
                <div className="space-y-2">
                  {gerarProximosDias().length > 0 ? (
                    gerarProximosDias().map((dia, idx) => {
                      const dataStr = dia.data.toISOString().split('T')[0];
                      const expandido = datasExpandidas.has(dataStr);
                      
                      // Verificar se tem pelo menos 1 horário com vaga disponível no dia
                      const temHorarioDisponivel = dia.horarios.some(horario => {
                        const numAlunos = horario.matriculas?.filter(m => !m.emEspera).length || 0;
                        const limiteAlunos = typeof horario.modalidadeId === 'string' 
                          ? 0 
                          : ((horario.modalidadeId as Modalidade)?.limiteAlunos || 0);
                        return numAlunos < limiteAlunos;
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
                                const numAlunos = horario.matriculas?.filter(m => !m.emEspera).length || 0;
                                const limiteAlunos = typeof horario.modalidadeId === 'string' 
                                  ? 0 
                                  : ((horario.modalidadeId as Modalidade)?.limiteAlunos || 0);
                                const temVaga = numAlunos < limiteAlunos;
                                const chaveUnica = `${dataStr}-${horario._id}`;
                                const selecionado = dataSelecionadaReagendamento === dataStr && horarioNovoSelecionado === horario._id;
                                
                                return (
                                  <label
                                    key={horario._id}
                                    className={`flex items-center justify-between p-3 rounded-md border-2 cursor-pointer transition-all ${
                                      selecionado
                                        ? 'border-blue-400 bg-blue-50 shadow-sm'
                                        : temVaga
                                        ? 'border-gray-200 bg-white hover:border-green-300 hover:bg-green-50'
                                        : 'border-gray-200 bg-gray-50 hover:border-red-300 opacity-60'
                                    }`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <input
                                        type="radio"
                                        name="horarioReagendamento"
                                        value={chaveUnica}
                                        checked={selecionado}
                                        onChange={() => {
                                          setDataSelecionadaReagendamento(dataStr);
                                          setHorarioNovoSelecionado(horario._id);
                                        }}
                                        className="text-blue-500 focus:ring-blue-500"
                                        disabled={!temVaga}
                                      />
                                      <div>
                                        <p className="font-medium text-gray-900">
                                          {horario.horarioInicio} - {horario.horarioFim}
                                        </p>
                                        {professorNome && (
                                          <p className="text-sm text-gray-600 mt-1">
                                            <span 
                                              className="inline-block px-2 py-0.5 rounded-md text-white text-xs font-medium"
                                              style={{ backgroundColor: professorCor }}
                                            >
                                              {professorNome}
                                            </span>
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <span className={`text-sm font-semibold ${
                                        temVaga ? 'text-green-600' : 'text-red-600'
                                      }`}>
                                        {numAlunos}/{limiteAlunos}
                                      </span>
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
                    })
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
      </Layout>
    </RequireAuth>
  );
}
