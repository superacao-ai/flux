const fs = require('fs');
const path = require('path');

const reporFaltaContent = `"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';

interface ReporFaltaModalProps {
  open: boolean;
  onClose: () => void;
  alunoId: string;
  alunoNome: string;
  falta: {
    aulaRealizadaId: string;
    data: string;
    horarioInicio: string;
    horarioFim: string;
    horarioFixoId: string;
    modalidade: string;
    diasRestantes: number;
    prazoFinal: string;
  };
  onSuccess?: () => void;
}

interface HorarioDisponivel {
  id: string;
  horarioId: string;
  label: string;
  horarioInicio: string;
  horarioFim: string;
  professorNome: string;
  professorCor: string;
  alunosCount: number;
  limiteAlunos: number;
  temVaga: boolean;
  raw: any;
}

interface DiaCalendario {
  data: Date;
  diaDoMes: number;
  mesAtual: boolean;
}

export default function ReporFaltaModal({ 
  open, 
  onClose, 
  alunoId, 
  alunoNome, 
  falta, 
  onSuccess 
}: ReporFaltaModalProps) {
  const [horariosDisponiveis, setHorariosDisponiveis] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedHorarioId, setSelectedHorarioId] = useState<string>('');
  const [calMes, setCalMes] = useState<number>(new Date().getMonth());
  const [calAno, setCalAno] = useState<number>(new Date().getFullYear());

  const diasSemana = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const diasSemanaAbrev = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

  const parseDataLocal = (dataStr: string): Date => {
    if (!dataStr) return new Date();
    const str = dataStr.split('T')[0];
    const [ano, mes, dia] = str.split('-').map(Number);
    return new Date(ano, mes - 1, dia, 12, 0, 0);
  };

  const dataFalta = useMemo(() => parseDataLocal(falta.data), [falta.data]);
  const prazoFinal = useMemo(() => {
    const d = new Date(dataFalta);
    d.setDate(d.getDate() + 7);
    return d;
  }, [dataFalta]);

  useEffect(() => {
    const fetchHorarios = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/horarios');
        const json = res.ok ? await res.json() : null;
        const data = (json && json.success && Array.isArray(json.data)) ? json.data : (Array.isArray(json) ? json : []);
        setHorariosDisponiveis(data || []);
      } catch (err) {
        setHorariosDisponiveis([]);
      } finally {
        setLoading(false);
      }
    };
    if (open) {
      fetchHorarios();
      setSelectedDate('');
      setSelectedHorarioId('');
      const hoje = new Date();
      setCalMes(hoje.getMonth());
      setCalAno(hoje.getFullYear());
    }
  }, [open]);

  const diasCalendario = useMemo((): DiaCalendario[] => {
    const primeiroDia = new Date(calAno, calMes, 1);
    const ultimoDia = new Date(calAno, calMes + 1, 0);
    const dias: DiaCalendario[] = [];
    const diaSemanaInicio = primeiroDia.getDay();
    for (let i = diaSemanaInicio - 1; i >= 0; i--) {
      const d = new Date(calAno, calMes, -i);
      dias.push({ data: d, diaDoMes: d.getDate(), mesAtual: false });
    }
    for (let d = 1; d <= ultimoDia.getDate(); d++) {
      dias.push({ data: new Date(calAno, calMes, d), diaDoMes: d, mesAtual: true });
    }
    while (dias.length < 42) {
      const d = new Date(calAno, calMes + 1, dias.length - ultimoDia.getDate() - diaSemanaInicio + 1);
      dias.push({ data: d, diaDoMes: d.getDate(), mesAtual: false });
    }
    return dias;
  }, [calMes, calAno]);

  const getHorariosDisponiveisNoDia = (data: Date): HorarioDisponivel[] => {
    if (!Array.isArray(horariosDisponiveis) || horariosDisponiveis.length === 0) return [];
    const jsDay = data.getDay();
    const dateISO = data.toISOString().slice(0, 10);
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
      return normalize(diaRaw) === jsDay;
    });
    return matching.map((h: any) => {
      const inicioH = h.horarioInicio || h.inicio || '';
      const fim = h.horarioFim || h.fim || '';
      let professorNome = '';
      let professorCor = '#3B82F6';
      if (h.professorId && typeof h.professorId === 'object') {
        professorNome = h.professorId.nome || '';
        professorCor = h.professorId.cor || '#3B82F6';
      }
      const matriculas = h.matriculas || [];
      const alunosCount = matriculas.filter((m: any) => !m.emEspera).length;
      const limiteAlunos = typeof h.modalidadeId === 'string' ? 0 : (h.modalidadeId?.limiteAlunos || 0);
      const temVaga = limiteAlunos === 0 || alunosCount < limiteAlunos;
      return { id: String(h._id || h.id || dateISO + '_' + inicioH), horarioId: String(h._id || h.id || ''), label: inicioH && fim ? inicioH + ' - ' + fim : (inicioH || fim || 'Horário'), horarioInicio: inicioH, horarioFim: fim, professorNome, professorCor, alunosCount, limiteAlunos, temVaga, raw: h };
    }).filter(h => h.temVaga);
  };

  const selecionarDestino = (data: Date, horario: HorarioDisponivel) => {
    setSelectedDate(data.toISOString().slice(0, 10));
    setSelectedHorarioId(horario.id);
  };

  const horarioSelecionado = useMemo(() => {
    if (!selectedDate || !selectedHorarioId) return null;
    const data = parseDataLocal(selectedDate);
    const horarios = getHorariosDisponiveisNoDia(data);
    return horarios.find(h => h.id === selectedHorarioId) || null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, selectedHorarioId, horariosDisponiveis]);

  if (!open) return null;

  const handleConfirm = async () => {
    if (!selectedDate || !selectedHorarioId || !horarioSelecionado) {
      toast.warning('Selecione uma data e um horário');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/reagendamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          horarioFixoId: falta.horarioFixoId,
          dataOriginal: falta.data,
          novaData: selectedDate,
          novoHorarioInicio: horarioSelecionado.horarioInicio,
          novoHorarioFim: horarioSelecionado.horarioFim,
          novoHorarioFixoId: horarioSelecionado.horarioId || horarioSelecionado.raw?._id,
          isReposicao: true,
          aulaRealizadaId: falta.aulaRealizadaId,
          alunoId: alunoId,
          motivo: 'Reposição de falta do dia ' + parseDataLocal(falta.data).toLocaleDateString('pt-BR') + ' (' + falta.horarioInicio + '-' + falta.horarioFim + ')'
        })
      });
      const json = await res.json();
      if (json && json.success) {
        toast.success('Solicitação de reposição enviada com sucesso!');
        if (typeof onSuccess === 'function') onSuccess();
        onClose();
      } else {
        toast.error('Falha ao solicitar reposição: ' + (json?.error || json?.message || 'erro desconhecido'));
      }
    } catch (err) {
      toast.error('Erro ao enviar solicitação de reposição');
    } finally {
      setSubmitting(false);
    }
  };

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 max-w-lg w-full p-6 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex-shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <i className="fas fa-redo text-orange-600" />Repor Falta
              </h2>
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                <i className="fas fa-user text-orange-600" />{alunoNome}
              </p>
              <div className="mt-3 mb-1 p-2 bg-gradient-to-r from-orange-50 via-gray-50 to-green-50 border border-gray-300 rounded-md">
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-white/80 rounded-md px-3 py-2 border border-orange-200">
                    <div className="text-xs">
                      <div className="font-semibold text-orange-700 flex items-center gap-1">
                        <i className="far fa-calendar text-orange-400"></i>
                        {diasSemana[parseDataLocal(falta.data).getDay()]} {parseDataLocal(falta.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                      </div>
                      <div className="text-gray-700 font-medium flex items-center gap-1">
                        <i className="far fa-clock text-gray-400"></i>{falta.horarioInicio}-{falta.horarioFim}
                      </div>
                      <div className="text-gray-600 text-[10px] mt-0.5">{falta.modalidade}</div>
                    </div>
                  </div>
                  <div className="flex-shrink-0"><i className="fas fa-arrow-right text-gray-400 text-lg"></i></div>
                  <div className={\`flex-1 bg-white/80 rounded-md px-3 py-2 border \${selectedDate && selectedHorarioId ? 'border-green-400' : 'border-gray-300'}\`}>
                    {selectedDate && horarioSelecionado ? (
                      <div className="text-xs">
                        <div className="font-semibold text-green-700 flex items-center gap-1">
                          <i className="far fa-calendar text-green-400"></i>
                          {diasSemana[parseDataLocal(selectedDate).getDay()]} {parseDataLocal(selectedDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                        </div>
                        <div className="text-gray-700 font-medium flex items-center gap-1">
                          <i className="far fa-clock text-gray-400"></i>{horarioSelecionado.horarioInicio}-{horarioSelecionado.horarioFim}
                        </div>
                        {horarioSelecionado.professorNome && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="inline-block px-1.5 py-0.5 rounded-md text-white text-[10px] font-medium" style={{ backgroundColor: horarioSelecionado.professorCor }}>{horarioSelecionado.professorNome}</span>
                          </div>
                        )}
                      </div>
                    ) : (<div className="text-xs text-gray-500 italic">Selecione abaixo</div>)}
                  </div>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><i className="fas fa-times text-lg" /></button>
          </div>
          <div className="border-t border-gray-200 mt-4 mb-4" />
          <div className={\`mb-4 p-3 rounded-md border \${falta.diasRestantes <= 2 ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}\`}>
            <div className="flex items-center gap-2">
              <i className={\`fas fa-clock \${falta.diasRestantes <= 2 ? 'text-red-500' : 'text-yellow-600'}\`} />
              <div className="text-sm">
                <span className="font-semibold">{falta.diasRestantes === 0 ? 'Último dia!' : falta.diasRestantes === 1 ? 'Falta 1 dia!' : \`Faltam \${falta.diasRestantes} dias\`}</span>
                <span className="text-gray-600 ml-1">para repor (até {falta.prazoFinal})</span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => { if (calMes === 0) { setCalMes(11); setCalAno(calAno - 1); } else { setCalMes(calMes - 1); } }} className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><i className="fas fa-chevron-left text-gray-600"></i></button>
            <h4 className="text-sm font-bold text-gray-900 capitalize">{new Date(calAno, calMes).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</h4>
            <button onClick={() => { if (calMes === 11) { setCalMes(0); setCalAno(calAno + 1); } else { setCalMes(calMes + 1); } }} className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><i className="fas fa-chevron-right text-gray-600"></i></button>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {diasSemanaAbrev.map((dia, idx) => (<div key={idx} className="text-center text-[10px] font-semibold text-gray-500 py-1">{dia}</div>))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (<div className="flex items-center justify-center py-8"><i className="fas fa-spinner fa-spin text-orange-600 text-xl" /></div>) : (
            <div className="grid grid-cols-7 gap-1 mb-4">
              {diasCalendario.map((diaObj, idx) => {
                const diaObjDate = new Date(diaObj.data);
                diaObjDate.setHours(0, 0, 0, 0);
                const limiteMinimo = new Date(dataFalta);
                limiteMinimo.setDate(limiteMinimo.getDate() + 1);
                limiteMinimo.setHours(0, 0, 0, 0);
                const isPassado = diaObjDate < hoje;
                const isAntesDoLimite = diaObjDate < limiteMinimo;
                const isForaDoLimite = diaObjDate > prazoFinal;
                const isMesmoDia = diaObj.data.toDateString() === dataFalta.toDateString();
                const horariosDisp = diaObj.mesAtual && !isPassado && !isAntesDoLimite && !isForaDoLimite && !isMesmoDia ? getHorariosDisponiveisNoDia(diaObj.data) : [];
                const temHorario = horariosDisp.length > 0;
                return (
                  <div key={idx} className={\`min-h-[80px] max-h-[120px] p-1 rounded-lg border transition-all text-center \${!diaObj.mesAtual ? 'bg-gray-50 opacity-40' : 'bg-white'} \${(isPassado || isAntesDoLimite || isForaDoLimite) && diaObj.mesAtual ? 'opacity-40' : ''} \${isMesmoDia ? 'bg-red-50 border-red-300 opacity-60' : ''} \${temHorario ? 'border-green-300 bg-green-50' : 'border-gray-200'}\`} title={isMesmoDia ? 'Não é possível repor no mesmo dia da falta' : undefined}>
                    <div className={\`text-xs font-semibold \${temHorario ? 'text-green-700' : 'text-gray-500'}\`}>{diaObj.diaDoMes}</div>
                    {temHorario && (
                      <div className="mt-0.5 space-y-0.5 overflow-y-auto max-h-[44px] scrollbar-thin">
                        {horariosDisp.map((h, hIdx) => (
                          <button key={hIdx} onClick={() => selecionarDestino(diaObj.data, h)} className={\`w-full px-0.5 py-0.5 rounded text-[9px] font-medium transition-colors truncate \${selectedDate === diaObj.data.toISOString().slice(0, 10) && selectedHorarioId === h.id ? 'bg-orange-600 text-white' : 'bg-green-600 text-white hover:bg-green-700'}\`}>{h.horarioInicio}</button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <div className="text-xs text-gray-500 text-center"><i className="fas fa-info-circle mr-1"></i>Escolha uma data até 7 dias após a falta. Dias verdes têm vagas.</div>
        </div>
        <div className="mt-4 pt-3 border-t border-gray-200 flex justify-end gap-3 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50" disabled={submitting}>Cancelar</button>
          <button onClick={handleConfirm} disabled={!selectedDate || !selectedHorarioId || submitting} className="px-4 py-2 rounded-md text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
            {submitting ? (<><i className="fas fa-spinner fa-spin" />Enviando...</>) : (<><i className="fas fa-paper-plane" />Solicitar Reposição</>)}
          </button>
        </div>
      </div>
    </div>
  );
}
`;

const usarCreditoContent = `"use client";

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

interface HorarioDisponivel {
  id: string;
  horarioId: string;
  label: string;
  horarioInicio: string;
  horarioFim: string;
  professorNome: string;
  professorCor: string;
  modalidadeNome: string;
  modalidadeCor: string;
  alunosCount: number;
  limiteAlunos: number;
  temVaga: boolean;
  raw: any;
}

interface DiaCalendario {
  data: Date;
  diaDoMes: number;
  mesAtual: boolean;
}

export default function UsarCreditoModal({ open, onClose, credito, onSuccess }: UsarCreditoModalProps) {
  const [horariosDisponiveis, setHorariosDisponiveis] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedHorarioId, setSelectedHorarioId] = useState<string>('');
  const [calMes, setCalMes] = useState<number>(new Date().getMonth());
  const [calAno, setCalAno] = useState<number>(new Date().getFullYear());

  const diasSemana = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const diasSemanaAbrev = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

  const parseDataLocal = (dataStr: string): Date => {
    if (!dataStr) return new Date();
    const str = dataStr.split('T')[0];
    const [ano, mes, dia] = str.split('-').map(Number);
    return new Date(ano, mes - 1, dia, 12, 0, 0);
  };

  const validadeDate = useMemo(() => {
    if (!credito) return new Date();
    const d = new Date(credito.validade);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [credito]);

  useEffect(() => {
    const fetchHorarios = async () => {
      if (!credito) return;
      try {
        setLoading(true);
        const res = await fetch('/api/horarios');
        const json = res.ok ? await res.json() : null;
        const data = (json && json.success && Array.isArray(json.data)) ? json.data : (Array.isArray(json) ? json : []);
        
        const alunoId = credito.alunoId._id;
        const filtered = data.filter((h: any) => {
          const matriculas = h.matriculas || [];
          const alunoMatriculado = matriculas.some((m: any) => {
            const mAlunoId = m.alunoId?._id || m.alunoId;
            return String(mAlunoId) === String(alunoId);
          });
          if (alunoMatriculado) return false;
          const alunosCount = matriculas.filter((m: any) => !m.emEspera).length;
          const limiteAlunos = typeof h.modalidadeId === 'string' ? 0 : (h.modalidadeId?.limiteAlunos || 0);
          const temVaga = limiteAlunos === 0 || alunosCount < limiteAlunos;
          return temVaga && h.ativo !== false;
        });
        setHorariosDisponiveis(filtered);
      } catch (err) {
        setHorariosDisponiveis([]);
      } finally {
        setLoading(false);
      }
    };
    if (open) {
      fetchHorarios();
      setSelectedDate('');
      setSelectedHorarioId('');
      const hoje = new Date();
      setCalMes(hoje.getMonth());
      setCalAno(hoje.getFullYear());
    }
  }, [open, credito]);

  const diasCalendario = useMemo((): DiaCalendario[] => {
    const primeiroDia = new Date(calAno, calMes, 1);
    const ultimoDia = new Date(calAno, calMes + 1, 0);
    const dias: DiaCalendario[] = [];
    const diaSemanaInicio = primeiroDia.getDay();
    for (let i = diaSemanaInicio - 1; i >= 0; i--) {
      const d = new Date(calAno, calMes, -i);
      dias.push({ data: d, diaDoMes: d.getDate(), mesAtual: false });
    }
    for (let d = 1; d <= ultimoDia.getDate(); d++) {
      dias.push({ data: new Date(calAno, calMes, d), diaDoMes: d, mesAtual: true });
    }
    while (dias.length < 42) {
      const d = new Date(calAno, calMes + 1, dias.length - ultimoDia.getDate() - diaSemanaInicio + 1);
      dias.push({ data: d, diaDoMes: d.getDate(), mesAtual: false });
    }
    return dias;
  }, [calMes, calAno]);

  const getHorariosDisponiveisNoDia = (data: Date): HorarioDisponivel[] => {
    if (!Array.isArray(horariosDisponiveis) || horariosDisponiveis.length === 0) return [];
    const jsDay = data.getDay();
    const dateISO = data.toISOString().slice(0, 10);
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
      return normalize(diaRaw) === jsDay;
    });
    return matching.map((h: any) => {
      const inicio = h.horarioInicio || h.inicio || '';
      const fim = h.horarioFim || h.fim || '';
      let professorNome = '';
      let professorCor = '#3B82F6';
      if (h.professorId && typeof h.professorId === 'object') {
        professorNome = h.professorId.nome || '';
        professorCor = h.professorId.cor || '#3B82F6';
      }
      let modalidadeNome = '';
      let modalidadeCor = '#3B82F6';
      if (h.modalidadeId && typeof h.modalidadeId === 'object') {
        modalidadeNome = h.modalidadeId.nome || '';
        modalidadeCor = h.modalidadeId.cor || '#3B82F6';
      }
      const matriculas = h.matriculas || [];
      const alunosCount = matriculas.filter((m: any) => !m.emEspera).length;
      const limiteAlunos = typeof h.modalidadeId === 'string' ? 0 : (h.modalidadeId?.limiteAlunos || 0);
      return { id: String(h._id || h.id || dateISO + '_' + inicio), horarioId: String(h._id || h.id || ''), label: inicio && fim ? inicio + ' - ' + fim : (inicio || fim || 'Horário'), horarioInicio: inicio, horarioFim: fim, professorNome, professorCor, modalidadeNome, modalidadeCor, alunosCount, limiteAlunos, temVaga: true, raw: h };
    });
  };

  const selecionarDestino = (data: Date, horario: HorarioDisponivel) => {
    setSelectedDate(data.toISOString().slice(0, 10));
    setSelectedHorarioId(horario.id);
  };

  const horarioSelecionado = useMemo(() => {
    if (!selectedDate || !selectedHorarioId) return null;
    const data = parseDataLocal(selectedDate);
    const horarios = getHorariosDisponiveisNoDia(data);
    return horarios.find(h => h.id === selectedHorarioId) || null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, selectedHorarioId, horariosDisponiveis]);

  if (!open || !credito) return null;

  const creditosDisponiveis = credito.quantidade - credito.quantidadeUsada;

  const handleConfirm = async () => {
    if (!selectedDate || !selectedHorarioId || !horarioSelecionado) {
      toast.warning('Selecione uma data e um horário');
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
          horarioDestinoId: horarioSelecionado.horarioId,
          dataAula: selectedDate,
          observacao: 'Aula extra - ' + horarioSelecionado.label
        })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success('Aula agendada com sucesso!');
        if (typeof onSuccess === 'function') onSuccess();
        onClose();
      } else {
        toast.error(json.error || 'Erro ao usar crédito');
      }
    } catch (err) {
      toast.error('Erro ao usar crédito');
    } finally {
      setSubmitting(false);
    }
  };

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 max-w-lg w-full p-6 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex-shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <i className="fas fa-ticket-alt text-green-600" />Usar Crédito de Reposição
              </h2>
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                <i className="fas fa-user text-green-600" />{credito.alunoId.nome}
              </p>
              <div className="mt-3 mb-1 p-2 bg-gradient-to-r from-green-50 via-gray-50 to-blue-50 border border-gray-300 rounded-md">
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-white/80 rounded-md px-3 py-2 border border-green-200">
                    <div className="text-xs">
                      <div className="font-semibold text-green-700 flex items-center gap-1">
                        <i className="fas fa-coins text-green-400"></i>
                        {creditosDisponiveis} crédito{creditosDisponiveis !== 1 ? 's' : ''} disponível{creditosDisponiveis !== 1 ? 'eis' : ''}
                      </div>
                      {credito.modalidadeId && (
                        <div className="text-gray-700 font-medium flex items-center gap-1 mt-0.5">
                          <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: credito.modalidadeId.cor || '#3B82F6' }} />
                          {credito.modalidadeId.nome}
                        </div>
                      )}
                      <div className="text-gray-600 text-[10px] mt-0.5">Válido até {parseDataLocal(credito.validade).toLocaleDateString('pt-BR')}</div>
                    </div>
                  </div>
                  <div className="flex-shrink-0"><i className="fas fa-arrow-right text-gray-400 text-lg"></i></div>
                  <div className={\`flex-1 bg-white/80 rounded-md px-3 py-2 border \${selectedDate && selectedHorarioId ? 'border-green-400' : 'border-gray-300'}\`}>
                    {selectedDate && horarioSelecionado ? (
                      <div className="text-xs">
                        <div className="font-semibold text-green-700 flex items-center gap-1">
                          <i className="far fa-calendar text-green-400"></i>
                          {diasSemana[parseDataLocal(selectedDate).getDay()]} {parseDataLocal(selectedDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                        </div>
                        <div className="text-gray-700 font-medium flex items-center gap-1">
                          <i className="far fa-clock text-gray-400"></i>{horarioSelecionado.horarioInicio}-{horarioSelecionado.horarioFim}
                        </div>
                        {horarioSelecionado.professorNome && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="inline-block px-1.5 py-0.5 rounded-md text-white text-[10px] font-medium" style={{ backgroundColor: horarioSelecionado.professorCor }}>{horarioSelecionado.professorNome}</span>
                          </div>
                        )}
                      </div>
                    ) : (<div className="text-xs text-gray-500 italic">Selecione abaixo</div>)}
                  </div>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><i className="fas fa-times text-lg" /></button>
          </div>
          <div className="border-t border-gray-200 mt-4 mb-4" />
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => { if (calMes === 0) { setCalMes(11); setCalAno(calAno - 1); } else { setCalMes(calMes - 1); } }} className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><i className="fas fa-chevron-left text-gray-600"></i></button>
            <h4 className="text-sm font-bold text-gray-900 capitalize">{new Date(calAno, calMes).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</h4>
            <button onClick={() => { if (calMes === 11) { setCalMes(0); setCalAno(calAno + 1); } else { setCalMes(calMes + 1); } }} className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><i className="fas fa-chevron-right text-gray-600"></i></button>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {diasSemanaAbrev.map((dia, idx) => (<div key={idx} className="text-center text-[10px] font-semibold text-gray-500 py-1">{dia}</div>))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (<div className="flex items-center justify-center py-8"><i className="fas fa-spinner fa-spin text-green-600 text-xl" /></div>) : (
            <div className="grid grid-cols-7 gap-1 mb-4">
              {diasCalendario.map((diaObj, idx) => {
                const diaObjDate = new Date(diaObj.data);
                diaObjDate.setHours(0, 0, 0, 0);
                const isPassado = diaObjDate < hoje;
                const isForaValidade = diaObjDate > validadeDate;
                const horariosDisp = diaObj.mesAtual && !isPassado && !isForaValidade ? getHorariosDisponiveisNoDia(diaObj.data) : [];
                const temHorario = horariosDisp.length > 0;
                return (
                  <div key={idx} className={\`min-h-[80px] max-h-[120px] p-1 rounded-lg border transition-all text-center \${!diaObj.mesAtual ? 'bg-gray-50 opacity-40' : 'bg-white'} \${(isPassado || isForaValidade) && diaObj.mesAtual ? 'opacity-40' : ''} \${temHorario ? 'border-green-300 bg-green-50' : 'border-gray-200'}\`}>
                    <div className={\`text-xs font-semibold \${temHorario ? 'text-green-700' : 'text-gray-500'}\`}>{diaObj.diaDoMes}</div>
                    {temHorario && (
                      <div className="mt-0.5 space-y-0.5 overflow-y-auto max-h-[44px] scrollbar-thin">
                        {horariosDisp.map((h, hIdx) => (
                          <button key={hIdx} onClick={() => selecionarDestino(diaObj.data, h)} className={\`w-full px-0.5 py-0.5 rounded text-[9px] font-medium transition-colors truncate \${selectedDate === diaObj.data.toISOString().slice(0, 10) && selectedHorarioId === h.id ? 'bg-orange-600 text-white' : 'bg-green-600 text-white hover:bg-green-700'}\`}>{h.horarioInicio}</button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <div className="text-xs text-gray-500 text-center"><i className="fas fa-info-circle mr-1"></i>Escolha uma data até a validade do crédito. Dias verdes têm vagas.</div>
        </div>
        <div className="mt-4 pt-3 border-t border-gray-200 flex justify-end gap-3 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50" disabled={submitting}>Cancelar</button>
          <button onClick={handleConfirm} disabled={!selectedDate || !selectedHorarioId || submitting} className="px-4 py-2 rounded-md text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
            {submitting ? (<><i className="fas fa-spinner fa-spin" />Agendando...</>) : (<><i className="fas fa-calendar-check" />Agendar Aula</>)}
          </button>
        </div>
      </div>
    </div>
  );
}
`;

// Write files
const componentsDir = path.join(__dirname, '..', 'src', 'components');

fs.writeFileSync(path.join(componentsDir, 'ReporFaltaModal.tsx'), reporFaltaContent, 'utf8');
console.log('✅ ReporFaltaModal.tsx atualizado com calendário visual');

fs.writeFileSync(path.join(componentsDir, 'UsarCreditoModal.tsx'), usarCreditoContent, 'utf8');
console.log('✅ UsarCreditoModal.tsx atualizado com calendário visual');

console.log('\n🎉 Ambos os modais foram atualizados com sucesso!');
