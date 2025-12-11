'use client';

import { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';

interface Horario {
  _id: string;
  diaSemana: number;
  horarioInicio: string;
  horarioFim: string;
  modalidadeId?: {
    _id: string;
    nome: string;
    cor: string;
    limiteAlunos?: number;
  };
  professorId?: {
    _id: string;
    nome: string;
    cor?: string;
  };
  matriculas?: any[];
}

interface ModalCalendarioReagendamentoProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (novoHorarioId: string, novaData: string) => Promise<void>;
  tipo: 'reagendamento' | 'reposicao';
  faltaSelecionada?: {
    _id: string;
    data: string;
    horarioInicio: string;
    horarioFim: string;
    modalidade?: { nome: string; cor: string };
    professorId?: { nome: string };
    avisouComAntecedencia?: boolean;
  };
  dataOriginal?: Date;
  horarioOriginal?: any;
  alunoNome?: string;
  modalidadeId?: string;
  alunoId?: string;
}

const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export default function ModalCalendarioReagendamento({
  isOpen,
  onClose,
  onConfirm,
  tipo,
  faltaSelecionada,
  dataOriginal,
  horarioOriginal,
  alunoNome,
  modalidadeId,
  alunoId
}: ModalCalendarioReagendamentoProps) {
  const [horariosDisponiveis, setHorariosDisponiveis] = useState<Horario[]>([]);
  const [dataSelecionada, setDataSelecionada] = useState<string>('');
  const [horarioSelecionado, setHorarioSelecionado] = useState<string>('');
  const [datasExpandidas, setDatasExpandidas] = useState<Set<string>>(new Set());
  const [paginaAtual, setPaginaAtual] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [aulasRealizadas, setAulasRealizadas] = useState<any[]>([]);
  const [reagendamentos, setReagendamentos] = useState<any[]>([]);

  const ITENS_POR_PAGINA = 4;

  useEffect(() => {
    if (isOpen) {
      setCarregando(true);
      Promise.all([
        fetchHorariosDisponiveis(),
        fetchAulasRealizadas(),
        fetchReagendamentos()
      ]).finally(() => setCarregando(false));
      
      setPaginaAtual(0);
      setDataSelecionada('');
      setHorarioSelecionado('');
      setDatasExpandidas(new Set());
    }
  }, [isOpen, modalidadeId]);

  const fetchHorariosDisponiveis = async () => {
    try {
      const res = await fetch(`/api/horarios`);
      const data = await res.json();
      
      // Suportar múltiplos formatos de resposta
      const horarios = (data && data.success && Array.isArray(data.data)) 
        ? data.data 
        : (Array.isArray(data.horarios) ? data.horarios : (Array.isArray(data) ? data : []));
      
      if (horarios && horarios.length > 0) {
        // Filtrar por modalidade se necessário
        let filtered = horarios;
        if (modalidadeId) {
          filtered = horarios.filter((h: Horario) => {
            const hModalidade = typeof h.modalidadeId === 'string' 
              ? h.modalidadeId 
              : h.modalidadeId?._id;
            return hModalidade === modalidadeId;
          });
        }
        setHorariosDisponiveis(filtered);
      } else {
        setHorariosDisponiveis([]);
      }
    } catch (error) {
      console.error('Erro ao buscar horários:', error);
      toast.error('Erro ao carregar horários disponíveis');
      setHorariosDisponiveis([]);
    }
  };

  const fetchAulasRealizadas = async () => {
    try {
      const res = await fetch('/api/aulas-realizadas');
      const data = await res.json();
      // Suportar múltiplos formatos
      const aulas = (data && data.success && Array.isArray(data.aulas)) 
        ? data.aulas 
        : (Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : []));
      setAulasRealizadas(aulas || []);
    } catch (error) {
      console.error('Erro ao buscar aulas realizadas:', error);
      setAulasRealizadas([]);
    }
  };

  const fetchReagendamentos = async () => {
    try {
      const res = await fetch('/api/reagendamentos');
      const data = await res.json();
      // Suportar múltiplos formatos
      const reags = (data && data.success && Array.isArray(data.reagendamentos)) 
        ? data.reagendamentos 
        : (Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : []));
      setReagendamentos(reags || []);
    } catch (error) {
      console.error('Erro ao buscar reagendamentos:', error);
      setReagendamentos([]);
    }
  };

  const formatDateToISO = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatarData = (data: Date | string) => {
    let dataObj: Date;
    
    if (typeof data === 'string') {
      // Se for string, extrai apenas a parte da data (YYYY-MM-DD)
      const partes = data.split('T')[0];
      dataObj = new Date(partes + 'T12:00:00');
    } else {
      dataObj = data;
    }
    
    if (isNaN(dataObj.getTime())) {
      console.error('Data inválida:', data);
      return 'Data inválida';
    }
    
    return dataObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const contarAlunosNoHorario = (horario: Horario, data: Date) => {
    const dataStr = formatDateToISO(data);
    
    // Contar alunos matriculados ativos
    const matriculasAtivas = (horario.matriculas || []).filter(m => {
      const alunoAtivo = !m.alunoId?.congelado && !m.alunoId?.ausente && !m.alunoId?.emEspera;
      return m.ativo && alunoAtivo;
    }).length;

    // Contar reagendamentos aprovados para este horário/data (não reposições)
    const reagendamentosAprovados = reagendamentos.filter((r: any) => {
      const novoHorarioId = typeof r.novoHorarioFixoId === 'string' 
        ? r.novoHorarioFixoId 
        : r.novoHorarioFixoId?._id;
      const novaDataStr = r.novaData?.split('T')[0];
      const status = r.status === 'aprovado' || r.status === 'aprovada';
      const naoEReposicao = !r.isReposicao;
      return status && naoEReposicao && novoHorarioId === horario._id && novaDataStr === dataStr;
    }).length;

    // Contar reposições aprovadas para este horário/data
    const reposicoesAprovadas = reagendamentos.filter((r: any) => {
      const novoHorarioId = typeof r.novoHorarioFixoId === 'string' 
        ? r.novoHorarioFixoId 
        : r.novoHorarioFixoId?._id;
      const novaDataStr = r.novaData?.split('T')[0];
      const status = r.status === 'aprovado' || r.status === 'aprovada';
      return status && r.isReposicao === true && novoHorarioId === horario._id && novaDataStr === dataStr;
    }).length;

    return matriculasAtivas + reagendamentosAprovados + reposicoesAprovadas;
  };

  const verificarAulaRegistrada = (horarioId: string, data: Date) => {
    const dataStr = formatDateToISO(data);
    return aulasRealizadas.some((aula: any) => {
      const aulaHorarioId = typeof aula.horarioFixoId === 'string' 
        ? aula.horarioFixoId 
        : aula.horarioFixoId?._id;
      const aulaDataStr = aula.data?.split('T')[0];
      return aulaHorarioId === horarioId && aulaDataStr === dataStr;
    });
  };

  const diasDisponiveis = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    let dataInicio = new Date(hoje);
    const diasAdiante = tipo === 'reposicao' ? 7 : 30;
    let dataFim = new Date(hoje);
    dataFim.setDate(dataFim.getDate() + diasAdiante);

    const dias: { data: Date; horarios: Horario[] }[] = [];

    // Iterar por cada dia no intervalo
    for (let d = new Date(dataInicio); d <= dataFim; d.setDate(d.getDate() + 1)) {
      const diaSemana = d.getDay();
      const horariosNoDia = horariosDisponiveis.filter((h: Horario) => h.diaSemana === diaSemana);
      
      if (horariosNoDia.length > 0) {
        dias.push({
          data: new Date(d),
          horarios: horariosNoDia
        });
      }
    }

    return dias;
  }, [horariosDisponiveis, tipo]);

  const totalPaginas = Math.ceil(diasDisponiveis.length / ITENS_POR_PAGINA);
  const diasMostrados = diasDisponiveis.slice(
    paginaAtual * ITENS_POR_PAGINA,
    (paginaAtual + 1) * ITENS_POR_PAGINA
  );

  const toggleDataExpandida = (dataStr: string) => {
    const novoSet = new Set(datasExpandidas);
    if (novoSet.has(dataStr)) {
      novoSet.delete(dataStr);
    } else {
      novoSet.add(dataStr);
    }
    setDatasExpandidas(novoSet);
  };

  const handleConfirmar = async () => {
    if (!dataSelecionada || !horarioSelecionado) {
      toast.warning('Selecione a data e horário');
      return;
    }

    setEnviando(true);
    try {
      await onConfirm(horarioSelecionado, dataSelecionada);
      onClose();
    } catch (error: any) {
      console.error('Erro ao confirmar:', error);
      // Erro já foi mostrado pela função onConfirm
    } finally {
      setEnviando(false);
    }
  };

  if (!isOpen) return null;

  let dataOriginalFormatada: Date | null = null;
  
  if (dataOriginal) {
    dataOriginalFormatada = dataOriginal;
  } else if (faltaSelecionada?.data) {
    // Extrair apenas a data (YYYY-MM-DD) em caso de timestamp ISO
    const dataParte = faltaSelecionada.data.split('T')[0];
    dataOriginalFormatada = new Date(dataParte + 'T12:00:00');
  }

  const horarioSelecionadoObj = horariosDisponiveis.find(h => h._id === horarioSelecionado);

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] md:p-4 top-0 left-0"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-t-2xl rounded-b-2xl md:rounded-2xl shadow-xl border border-gray-200 w-full md:max-w-lg max-h-[90vh] md:max-h-[85vh] overflow-hidden p-4 md:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <i className={`fas ${tipo === 'reposicao' ? 'fa-redo' : 'fa-edit'} text-primary-600`}></i>
              {tipo === 'reposicao' ? 'Solicitar Reposição' : 'Reagendar Aula'}
            </h2>
            {alunoNome && (
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                <i className="fas fa-user text-primary-600"></i>
                {alunoNome}
              </p>
            )}
            
            {/* Resumo */}
            <div className="mt-3 mb-1 p-2 bg-gradient-to-r from-red-50 via-gray-50 to-green-50 border border-gray-300 rounded-md">
              <div className="flex items-center gap-2">
                {/* Horário Original/Falta */}
                <div className={`flex-1 bg-white/80 rounded-md px-3 py-2 border ${
                  faltaSelecionada?.avisouComAntecedencia === false ? 'border-orange-300' : 'border-red-200'
                }`}>
                  <div className="text-xs">
                    <div className="font-semibold text-red-700 flex items-center gap-1">
                      <i className="far fa-calendar text-red-400"></i>
                      {dataOriginalFormatada && formatarData(dataOriginalFormatada)}
                    </div>
                    <div className="text-gray-700 font-medium flex items-center gap-1">
                      <i className="far fa-clock text-gray-400"></i>
                      {faltaSelecionada ? faltaSelecionada.horarioInicio : horarioOriginal?.horarioInicio}
                      {faltaSelecionada?.horarioFim && ` - ${faltaSelecionada.horarioFim}`}
                    </div>
                    {faltaSelecionada?.professorId && (
                      <div className="text-[10px] text-gray-500 mt-0.5">
                        <i className="fas fa-user mr-1"></i>
                        {faltaSelecionada.professorId.nome}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Seta */}
                <div className="flex-shrink-0">
                  <i className="fas fa-arrow-right text-gray-400 text-lg"></i>
                </div>
                
                {/* Novo Horário */}
                <div className={`flex-1 bg-white/80 rounded-md px-3 py-2 border ${
                  dataSelecionada && horarioSelecionado ? 'border-green-400' : 'border-gray-300'
                }`}>
                  {dataSelecionada && horarioSelecionadoObj ? (
                    <div className="text-xs">
                      <div className="font-semibold text-green-700 flex items-center gap-1">
                        <i className="far fa-calendar text-green-400"></i>
                        {formatarData(dataSelecionada)}
                      </div>
                      <div className="text-gray-700 font-medium flex items-center gap-1">
                        <i className="far fa-clock text-gray-400"></i>
                        {horarioSelecionadoObj.horarioInicio}-{horarioSelecionadoObj.horarioFim}
                      </div>
                      {horarioSelecionadoObj.professorId && (
                        <div className="text-[10px] text-gray-500 mt-0.5">
                          <i className="fas fa-user mr-1"></i>
                          {horarioSelecionadoObj.professorId.nome}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500 italic">Selecione abaixo</div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <i className="fas fa-times text-base"></i>
          </button>
        </div>

        <div className="border-t border-gray-200 mt-4 mb-4" />

        {/* Conteúdo */}
        <div className="max-h-[60vh] overflow-y-auto">
          <h3 className="font-semibold text-gray-900 mb-3 text-sm">
            Selecione a nova data e horário
          </h3>

          {carregando ? (
            <div className="text-center py-8">
              <i className="fas fa-spinner fa-spin text-2xl text-gray-400 mb-2"></i>
              <p className="text-gray-500">Carregando horários disponíveis...</p>
            </div>
          ) : horariosDisponiveis.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <i className="fas fa-exclamation-triangle text-3xl mb-2"></i>
              <p>Nenhum horário disponível</p>
              <p className="text-sm text-gray-400 mt-1">Verifique os horários cadastrados da sua modalidade</p>
            </div>
          ) : diasDisponiveis.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <i className="fas fa-calendar-times text-3xl mb-2"></i>
              <p>Nenhum horário disponível encontrado</p>
            </div>
          ) : (
            <>
              {totalPaginas > 1 && (
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm text-gray-600">
                    {paginaAtual * ITENS_POR_PAGINA + 1} - {Math.min((paginaAtual + 1) * ITENS_POR_PAGINA, diasDisponiveis.length)} de {diasDisponiveis.length}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPaginaAtual(p => Math.max(0, p - 1))}
                      disabled={paginaAtual === 0}
                      className="px-2 py-1 text-sm border rounded disabled:opacity-50"
                    >
                      Anterior
                    </button>
                    <button
                      onClick={() => setPaginaAtual(p => Math.min(totalPaginas - 1, p + 1))}
                      disabled={paginaAtual === totalPaginas - 1}
                      className="px-2 py-1 text-sm border rounded disabled:opacity-50"
                    >
                      Próximo
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {diasMostrados.map((dia, idx) => {
                  const dataStr = formatDateToISO(dia.data);
                  const expandido = datasExpandidas.has(dataStr);
                  const hoje = new Date();
                  hoje.setHours(0, 0, 0, 0);
                  const diaDate = new Date(dia.data);
                  diaDate.setHours(0, 0, 0, 0);

                  const horariosComVaga = dia.horarios.filter(horario => {
                    const count = contarAlunosNoHorario(horario, dia.data);
                    const limite = horario.modalidadeId?.limiteAlunos || 0;
                    const aulaJaEnviada = verificarAulaRegistrada(horario._id, dia.data);
                    return count < limite && !aulaJaEnviada;
                  });

                  const temVaga = horariosComVaga.length > 0;

                  return (
                    <div key={idx} className={`border rounded-md overflow-hidden ${
                      temVaga ? 'border-gray-200 hover:border-green-300' : 'border-gray-200'
                    }`}>
                      <button
                        onClick={() => toggleDataExpandida(dataStr)}
                        className={`w-full px-4 py-3 flex items-center justify-between ${
                          temVaga ? 'bg-gray-50 hover:bg-green-50' : 'bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <i className={`fas fa-chevron-right text-sm transition-transform ${expandido ? 'rotate-90' : ''}`}></i>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900 text-sm">
                              {diasSemana[dia.data.getDay()]} - {dia.data.toLocaleDateString('pt-BR')}
                            </p>
                            {temVaga ? (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                Disponível
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                Lotado
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-sm text-gray-600">
                          {horariosComVaga.length}/{dia.horarios.length}
                        </span>
                      </button>

                      {expandido && (
                        <div className="border-t bg-white p-3 space-y-2">
                          {horariosComVaga.length === 0 ? (
                            <p className="text-sm text-gray-500 text-center py-2">Nenhum horário disponível</p>
                          ) : (
                            horariosComVaga.map(horario => {
                              const count = contarAlunosNoHorario(horario, dia.data);
                              const limite = horario.modalidadeId?.limiteAlunos || 0;
                              const selecionado = dataSelecionada === dataStr && horarioSelecionado === horario._id;

                              return (
                                <button
                                  key={horario._id}
                                  onClick={() => {
                                    setDataSelecionada(dataStr);
                                    setHorarioSelecionado(horario._id);
                                  }}
                                  className={`w-full p-3 border rounded-lg text-left transition-colors ${
                                    selecionado 
                                      ? 'border-green-500 bg-green-50' 
                                      : 'border-gray-200 hover:bg-gray-50'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                      <p className="font-medium text-gray-900 text-sm">
                                        {horario.horarioInicio} - {horario.horarioFim}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        {horario.modalidadeId?.nome}
                                      </p>
                                      {horario.professorId && (
                                        <p className="text-xs text-gray-400">
                                          <i className="fas fa-user mr-1"></i>
                                          {horario.professorId.nome}
                                        </p>
                                      )}
                                    </div>
                                    <div className="text-right">
                                      <span className="text-xs text-gray-500">
                                        {count}/{limite} alunos
                                      </span>
                                      {selecionado && (
                                        <i className="fas fa-check-circle text-green-600 ml-2"></i>
                                      )}
                                    </div>
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 mt-4 pt-4">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmar}
              disabled={!dataSelecionada || !horarioSelecionado || enviando}
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {enviando ? (
                <><i className="fas fa-spinner fa-spin mr-2"></i>Enviando...</>
              ) : (
                tipo === 'reposicao' ? 'Solicitar' : 'Reagendar'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
