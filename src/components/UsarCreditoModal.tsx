"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';

interface UsarCreditoModalProps {
  open: boolean;
  onClose: () => void;
  credito: {
    _id: string;
    alunoId: { _id: string; nome: string };
    quantidade: number;
    quantidadeUsada: number;
    modalidadeId?: { _id: string; nome: string; cor?: string };
    validade: string;
  } | null;
  onSuccess?: () => void;
}

export default function UsarCreditoModal({ open, onClose, credito, onSuccess }: UsarCreditoModalProps) {
  const [horariosDisponiveis, setHorariosDisponiveis] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedHorarioId, setSelectedHorarioId] = useState<string>('');
  const [datasExpandidas, setDatasExpandidas] = useState<Set<string>>(new Set());
  const [paginaDias, setPaginaDias] = useState<number>(0);

  const diasSemana = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

  // Helper para parsear data sem problema de timezone UTC
  const parseDataLocal = (dataStr: string): Date => {
    if (!dataStr) return new Date();
    const str = dataStr.split('T')[0];
    const [ano, mes, dia] = str.split('-').map(Number);
    return new Date(ano, mes - 1, dia, 12, 0, 0);
  };

  // Fetch horários quando abrir o modal
  useEffect(() => {
    const fetchHorarios = async () => {
      if (!credito) return;
      
      try {
        setLoading(true);
        
        // Buscar TODOS os horários disponíveis
        const res = await fetch('/api/horarios');
        const json = res.ok ? await res.json() : null;
        const data = (json && json.success && Array.isArray(json.data)) ? json.data : (Array.isArray(json) ? json : []);
        
        // Filtrar horários onde o aluno NÃO está matriculado e que têm vaga
        const alunoId = credito.alunoId._id;
        const horariosDisponiveis = data.filter((h: any) => {
          // Verificar se o aluno está matriculado neste horário
          const matriculas = h.matriculas || [];
          const alunoMatriculado = matriculas.some((m: any) => {
            const mAlunoId = m.alunoId?._id || m.alunoId;
            return String(mAlunoId) === String(alunoId);
          });
          
          // Só incluir se o aluno NÃO está matriculado
          if (alunoMatriculado) return false;
          
          // Verificar se tem vaga
          const alunosCount = matriculas.filter((m: any) => !m.emEspera).length;
          const limiteAlunos = typeof h.modalidadeId === 'string' 
            ? 0 
            : (h.modalidadeId?.limiteAlunos || 0);
          const temVaga = limiteAlunos === 0 || alunosCount < limiteAlunos;
          
          return temVaga && h.ativo !== false;
        });
        
        setHorariosDisponiveis(horariosDisponiveis);
      } catch (err) {
        console.warn('Falha ao buscar horários', err);
        setHorariosDisponiveis([]);
      } finally {
        setLoading(false);
      }
    };
    
    if (open) {
      fetchHorarios();
      setSelectedDate('');
      setSelectedHorarioId('');
      setDatasExpandidas(new Set());
      setPaginaDias(0);
    }
  }, [open, credito]);

  // Gerar datas disponíveis baseado nos horários e validade do crédito
  const availableDates = useMemo(() => {
    const out: { dateISO: string; data: Date; horarios: any[] }[] = [];
    if (!Array.isArray(horariosDisponiveis) || horariosDisponiveis.length === 0 || !credito) {
      return out;
    }
    
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const validadeDate = new Date(credito.validade);
    validadeDate.setHours(23, 59, 59, 999); // Considerar o dia inteiro da validade
    const daysToGenerate = 60;
    
    for (let i = 0; i < daysToGenerate; i++) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + i);
      
      // Não mostrar datas após a validade do crédito
      if (d > validadeDate) break;
      
      const jsDay = d.getDay();
      
      // Filtrar horários que correspondem a este dia da semana
      const matching = horariosDisponiveis.filter(h => {
        const diaRaw = h.diaSemana !== undefined ? h.diaSemana : h.dia;
        if (diaRaw === null || diaRaw === undefined) return false;
        
        const normalize = (val: any): number | null => {
          if (val === null || val === undefined) return null;
          if (typeof val === 'number') {
            if (val >= 0 && val <= 6) return val;
            if (val >= 1 && val <= 7) return val - 1;
            return null;
          }
          if (typeof val === 'string') {
            const n = parseInt(val, 10);
            if (!isNaN(n)) {
              if (n >= 0 && n <= 6) return n;
              if (n >= 1 && n <= 7) return n - 1;
            }
          }
          return null;
        };

        const dia = normalize(diaRaw);
        return dia === jsDay;
      });
      
      if (matching.length > 0) {
        const dateISO = d.toISOString().slice(0, 10);
        
        const horariosForDate = matching.map((h: any) => {
          const inicio = h.horarioInicio || h.inicio || '';
          const fim = h.horarioFim || h.fim || '';
          
          // Extrair professor
          let professorNome = '';
          let professorCor = '#3B82F6';
          
          if (h.professorId && typeof h.professorId === 'object') {
            professorNome = h.professorId.nome || '';
            professorCor = h.professorId.cor || '#3B82F6';
          }
          
          const matriculas = h.matriculas || [];
          const alunosCount = matriculas.filter((m: any) => !m.emEspera).length;
          
          const limiteAlunos = typeof h.modalidadeId === 'string' 
            ? 0 
            : (h.modalidadeId?.limiteAlunos || 0);
          
          // Extrair modalidade
          let modalidadeNome = '';
          let modalidadeCor = '#3B82F6';
          if (h.modalidadeId && typeof h.modalidadeId === 'object') {
            modalidadeNome = h.modalidadeId.nome || '';
            modalidadeCor = h.modalidadeId.cor || '#3B82F6';
          }
          
          return {
            id: String(h._id || h.id || `${dateISO}_${inicio}`),
            horarioId: String(h._id || h.id || ''),
            label: inicio && fim ? `${inicio} - ${fim}` : (inicio || fim || 'Horário'),
            horarioInicio: inicio,
            horarioFim: fim,
            professorNome,
            professorCor,
            modalidadeNome,
            modalidadeCor,
            alunosCount,
            limiteAlunos,
            temVaga: true, // Já filtramos acima
            raw: h,
          };
        });
        
        out.push({ dateISO, data: new Date(d), horarios: horariosForDate });
      }
    }
    return out;
  }, [horariosDisponiveis, credito]);

  useEffect(() => {
    setSelectedHorarioId('');
  }, [selectedDate]);

  const toggleDataExpandida = (dateISO: string) => {
    setDatasExpandidas(prev => {
      if (prev.has(dateISO)) return new Set();
      return new Set([dateISO]);
    });
  };

  const selectedDateObj = useMemo(() => availableDates.find(d => d.dateISO === selectedDate) || null, [availableDates, selectedDate]);

  if (!open || !credito) return null;

  const creditosDisponiveis = credito.quantidade - credito.quantidadeUsada;

  const handleConfirm = async () => {
    if (!selectedDate || !selectedHorarioId) {
      toast.warning('Selecione uma data e um horário');
      return;
    }

    const chosen = (selectedDateObj?.horarios || []).find((h: any) => 
      String(h.id) === String(selectedHorarioId) || 
      String(h.horarioId) === String(selectedHorarioId)
    );

    if (!chosen) {
      toast.error('Horário não encontrado');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/creditos-reposicao/usar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creditoId: credito._id,
          alunoId: credito.alunoId._id,
          horarioDestinoId: chosen.horarioId,
          dataAula: selectedDate,
          observacao: `Aula extra - ${chosen.label}`
        })
      });

      const json = await res.json();
      
      if (res.ok && json.success) {
        toast.success('Aula agendada com sucesso!');
        if (typeof onSuccess === 'function') {
          onSuccess();
        }
        onClose();
      } else {
        toast.error(json.error || 'Erro ao usar crédito');
      }
    } catch (err) {
      console.error('Erro ao usar crédito:', err);
      toast.error('Erro ao usar crédito');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 max-w-lg w-full p-6 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <i className="fas fa-ticket-alt text-green-600" />
              Usar Crédito de Reposição
            </h2>
            <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
              <i className="fas fa-user text-green-600" />
              {credito.alunoId.nome}
            </p>
            {/* Info do crédito no header */}
            <div className="mt-3 mb-1 p-2 bg-gradient-to-r from-green-50 via-gray-50 to-blue-50 border border-gray-300 rounded-md">
              <div className="flex items-center gap-2">
                {/* Info do Crédito */}
                <div className="flex-1 bg-white/80 rounded-md px-3 py-2 border border-green-200">
                  <div className="text-xs">
                    <div className="font-semibold text-green-700 flex items-center gap-1">
                      <i className="fas fa-coins text-green-400"></i>
                      {creditosDisponiveis} crédito{creditosDisponiveis !== 1 ? 's' : ''} disponível{creditosDisponiveis !== 1 ? 'eis' : ''}
                    </div>
                    {credito.modalidadeId && (
                      <div className="text-gray-700 font-medium flex items-center gap-1 mt-0.5">
                        <span 
                          className="inline-block w-2 h-2 rounded-full"
                          style={{ backgroundColor: credito.modalidadeId.cor || '#3B82F6' }}
                        />
                        {credito.modalidadeId.nome}
                      </div>
                    )}
                    <div className="text-gray-600 text-[10px] mt-0.5">
                      Válido até {parseDataLocal(credito.validade).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                </div>
                {/* Seta */}
                <div className="flex-shrink-0">
                  <i className="fas fa-arrow-right text-gray-400 text-lg"></i>
                </div>
                {/* Horário Novo (se selecionado) */}
                <div className={`flex-1 bg-white/80 rounded-md px-3 py-2 border ${
                  selectedDate && selectedHorarioId 
                    ? 'border-green-400' 
                    : 'border-gray-300'
                }`}>
                  {selectedDate && selectedHorarioId ? (
                    (() => {
                      const diaObj = availableDates.find(d => d.dateISO === selectedDate);
                      const horarioObj = diaObj?.horarios.find((h: any) => String(h.id) === selectedHorarioId);
                      if (!diaObj || !horarioObj) return <div className="text-xs text-gray-500 italic">Selecione abaixo</div>;
                      return (
                        <div className="text-xs">
                          <div className="font-semibold text-green-700 flex items-center gap-1">
                            <i className="far fa-calendar text-green-400"></i>
                            {diasSemana[diaObj.data.getDay()]} {diaObj.data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                          </div>
                          <div className="text-gray-700 font-medium flex items-center gap-1">
                            <i className="far fa-clock text-gray-400"></i>
                            {horarioObj.horarioInicio}-{horarioObj.horarioFim}
                          </div>
                          {horarioObj.professorNome && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <i className="fas fa-user text-gray-400 text-[10px]"></i>
                              <span 
                                className="inline-block px-1.5 py-0.5 rounded-md text-white text-[10px] font-medium"
                                style={{ backgroundColor: horarioObj.professorCor }}
                              >
                                {horarioObj.professorNome}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })()
                  ) : (
                    <div className="text-xs text-gray-500 italic">Selecione abaixo</div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Fechar">
            <i className="fas fa-times text-lg" />
          </button>
        </div>

        <div className="border-t border-gray-200 mt-4 mb-4" />

        <h3 className="font-semibold text-gray-900 mb-3 text-sm">Selecione a data e horário para a aula extra</h3>

        <div className="flex-1 overflow-y-auto text-sm space-y-2 pr-1 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <i className="fas fa-spinner fa-spin text-green-600 text-xl" />
            </div>
          ) : availableDates.length > 0 ? (
            <>
              {/* Paginação */}
              {availableDates.length > 4 && (
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm text-gray-600">
                    Mostrando {paginaDias * 4 + 1} - {Math.min((paginaDias + 1) * 4, availableDates.length)} de {availableDates.length} dias
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPaginaDias(p => Math.max(0, p - 1))}
                      disabled={paginaDias === 0}
                      className="px-2 py-1 text-sm border rounded disabled:opacity-50"
                    >
                      Anterior
                    </button>
                    <button
                      onClick={() => setPaginaDias(p => Math.min(Math.ceil(availableDates.length / 4) - 1, p + 1))}
                      disabled={paginaDias >= Math.ceil(availableDates.length / 4) - 1}
                      className="px-2 py-1 text-sm border rounded disabled:opacity-50"
                    >
                      Próximo
                    </button>
                  </div>
                </div>
              )}

              {availableDates.slice(paginaDias * 4, (paginaDias + 1) * 4).map((dia) => {
                const expanded = datasExpandidas.has(dia.dateISO);
                const temHorarioDisponivel = dia.horarios.some(h => h.temVaga);
                
                return (
                  <div key={dia.dateISO} className={`border rounded-md overflow-hidden transition-all ${
                    temHorarioDisponivel 
                      ? 'border-gray-200 hover:border-green-300' 
                      : 'border-gray-200 hover:border-red-300'
                  }`}>
                    {/* Header - clicável para expandir/retrair */}
                    <button 
                      type="button" 
                      onClick={() => toggleDataExpandida(dia.dateISO)} 
                      className={`w-full px-4 py-3 border-b flex items-center justify-between transition-colors ${
                        temHorarioDisponivel 
                          ? 'bg-gray-50 border-gray-200 hover:bg-green-50' 
                          : 'bg-gray-50 border-gray-200 hover:bg-red-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <svg 
                          className={`w-5 h-5 transition-all ${expanded ? 'rotate-90' : ''} text-gray-600`}
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900 text-left">
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
                    {expanded && (
                      <div className="p-2 space-y-2">
                        {dia.horarios.map((h: any) => {
                          const selecionado = selectedHorarioId === String(h.id) && selectedDate === dia.dateISO;
                          const chaveUnica = `${dia.dateISO}-${h.id}`;
                          
                          return (
                            <label 
                              key={h.id} 
                              className={`flex items-center justify-between p-3 rounded-md border-2 transition-all ${
                                selecionado
                                  ? 'border-green-400 bg-green-50 shadow-sm'
                                  : !h.temVaga
                                  ? 'border-red-300 bg-red-50 text-red-800 opacity-95 cursor-not-allowed'
                                  : 'border-gray-200 bg-white hover:border-green-300 hover:bg-green-50 cursor-pointer'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <input 
                                  type="checkbox" 
                                  name="horarioCredito" 
                                  value={chaveUnica}
                                  checked={selecionado}
                                  onChange={() => {
                                    if (selecionado) {
                                      setSelectedDate('');
                                      setSelectedHorarioId('');
                                    } else {
                                      setSelectedDate(dia.dateISO);
                                      setSelectedHorarioId(String(h.id));
                                    }
                                  }}
                                  className="h-4 w-4 text-green-500 focus:ring-green-500"
                                  disabled={!h.temVaga}
                                />
                                <div>
                                  <p className="font-medium text-gray-900">{h.label}</p>
                                  {h.professorNome && (
                                    <p className="text-sm text-gray-600 mt-1">
                                      <span 
                                        className="inline-block px-2 py-0.5 rounded-md text-white text-xs font-medium"
                                        style={{ backgroundColor: h.professorCor }}
                                      >
                                        {h.professorNome}
                                      </span>
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                <span className={`text-sm font-semibold ${
                                  h.temVaga ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  {h.alunosCount}/{h.limiteAlunos || '∞'}
                                </span>
                                <p className="text-[10px] text-gray-500 uppercase tracking-wide">
                                  {h.temVaga ? 'vagas' : 'lotado'}
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
            <div className="text-center py-8">
              <i className="fas fa-calendar-times text-gray-300 text-3xl mb-3" />
              <p className="text-gray-500 text-sm">
                Nenhum horário disponível até a validade do crédito.
              </p>
              <p className="text-gray-400 text-xs mt-1">
                O crédito é válido até {parseDataLocal(credito.validade).toLocaleDateString('pt-BR')}.
              </p>
            </div>
          )}
        </div>

        {/* Footer - sempre visível */}
        <div className="mt-4 pt-3 border-t border-gray-200 flex justify-end gap-3 flex-shrink-0">
          <button 
            onClick={onClose} 
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            disabled={submitting}
          >
            Cancelar
          </button>
          <button 
            onClick={handleConfirm} 
            disabled={!selectedDate || !selectedHorarioId || submitting} 
            className="px-4 py-2 rounded-md text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {submitting ? (
              <>
                <i className="fas fa-spinner fa-spin" />
                Agendando...
              </>
            ) : (
              <>
                <i className="fas fa-calendar-check" />
                Agendar Aula
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
