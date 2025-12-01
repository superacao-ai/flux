"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';

export default function ReagendarAulaModal({ open, onClose, aluno, horarioOriginal, dataOriginal, matricula, onCreated }: any) {
  const [horariosDisponiveis, setHorariosDisponiveis] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedDate, setSelectedDate] = useState<string>(''); // ISO date yyyy-mm-dd
  const [selectedHorarioId, setSelectedHorarioId] = useState<string>('');
  const [datasExpandidas, setDatasExpandidas] = useState<Set<string>>(new Set());

  // Fetch horarios (try by modalidadeId when available, else fetch all)
  useEffect(() => {
    const fetchHorarios = async () => {
      try {
        setLoading(true);
        // Try to use modalidadeId from horarioOriginal if present
        const modalidadeId = horarioOriginal?.modalidadeId || null;
        const url = modalidadeId ? `/api/horarios?modalidadeId=${modalidadeId}` : '/api/horarios';
        const res = await fetch(url);
        const json = res.ok ? await res.json() : null;
        const data = (json && json.success && Array.isArray(json.data)) ? json.data : (Array.isArray(json) ? json : []);
        setHorariosDisponiveis(data || []);
        console.debug('[ReagendarAulaModal] horariosDisponiveis:', { modalidadeId, fetchedCount: (data || []).length, sample: (data || []).slice(0,3) });
      } catch (err) {
        console.warn('Falha ao buscar horariosDisponiveis', err);
        setHorariosDisponiveis([]);
      } finally {
        setLoading(false);
      }
    };
    if (open) fetchHorarios();
  }, [open, horarioOriginal]);

  // Helper: for next N days, find which dates have available horarios
  const availableDates = useMemo(() => {
    const out: { dateISO: string; label: string; horarios: any[] }[] = [];
    if (!Array.isArray(horariosDisponiveis) || horariosDisponiveis.length === 0) return out;
    const today = new Date();
    const daysToGenerate = 30;
    for (let i = 0; i < daysToGenerate; i++) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      const jsDay = d.getDay(); // 0 (Sun) - 6 (Sat)
      const matching = horariosDisponiveis.filter(h => {
        const diaRaw = (h && (h.diaSemana !== undefined ? h.diaSemana : h.dia)) || null;
        if (diaRaw === null || diaRaw === undefined) return false;
        // normalize stored day to 0-6 (JS getDay)
        const normalize = (val: any): number | null => {
          if (val === null || val === undefined) return null;
          if (typeof val === 'number') {
            if (val >= 0 && val <= 6) return val;
            if (val >= 1 && val <= 7) return val - 1; // convert 1-7 -> 0-6
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
        if (dia === null) return false;
        return dia === jsDay;
      });
      if (matching.length > 0) {
        const dateISO = d.toISOString().slice(0, 10);
        const label = `${d.toLocaleDateString('pt-BR')} (${d.toLocaleDateString('pt-BR', { weekday: 'long' })})`;
        const horariosForDate = matching.map((h:any) => {
          const inicio = h.horarioInicio || h.inicio || h.start || '';
          const fim = h.horarioFim || h.fim || h.end || '';
          return {
            id: String(h._id || h.id || `${dateISO}_${inicio}`),
            horarioId: String(h._id || h.id || ''),
            label: inicio && fim ? `${inicio} - ${fim}` : (inicio || fim || 'Horário'),
            horarioInicio: inicio,
            horarioFim: fim,
            raw: h,
          };
        });
        out.push({ dateISO, label, horarios: horariosForDate });
      }
    }
    return out;
  }, [horariosDisponiveis]);

  // When selectedDate changes, reset selectedHorarioId
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

  if (!open) return null;

  const handleConfirm = async () => {
    if (!selectedDate || !selectedHorarioId) {
      toast.warning('Selecione uma data e um horário');
      return;
    }
    const chosen = (selectedDateObj?.horarios || []).find((h:any) => String(h.id || h.horarioId || h._id) === String(selectedHorarioId) || String(h._id) === String(selectedHorarioId) || String(h.horarioId) === String(selectedHorarioId));

    // helper to format date to YYYY-MM-DD (avoid timezone issues)
    const formatDateToISO = (input: any) => {
      try {
        if (!input) return null;
        const d = typeof input === 'string' ? new Date(input) : (input instanceof Date ? input : new Date(String(input)));
        if (isNaN(d.getTime())) return null;
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      } catch (e) {
        return null;
      }
    };

    const horarioFixoId = horarioOriginal?._id || horarioOriginal?.horarioId || horarioOriginal?.id || null;
    const dataOriginalISO = formatDateToISO(dataOriginal);
    const novaData = selectedDate; // already YYYY-MM-DD
    const novoHorarioInicio = chosen?.horarioInicio || chosen?.inicio || (chosen?.label ? String(chosen.label).split('-')[0].trim() : null);
    const novoHorarioFim = chosen?.horarioFim || chosen?.fim || (chosen?.label ? String(chosen.label).split('-')[1]?.trim() : null);
    const novoHorarioFixoId = chosen?._id || chosen?.horarioId || null;
    let matriculaId = typeof matricula === 'string' ? matricula : (matricula?._id || matricula?.id || null);

    // Fallback: try to derive matriculaId from chosen.raw or from horariosDisponiveis
    const tryDeriveMatricula = () => {
      try {
        // Check chosen.raw first (if backend returned horario with matriculas)
        if (chosen && chosen.raw) {
          const raw = chosen.raw;
          const ms = raw.matriculas || raw.matricula || [];
          if (Array.isArray(ms) && ms.length > 0) {
            for (const m of ms) {
              const alunoRef = m.alunoId || m.aluno || null;
              const alunoId = alunoRef && (typeof alunoRef === 'string' ? alunoRef : (alunoRef._id || alunoRef)) || null;
              if (alunoId && aluno && String(alunoId) === String(aluno._id)) {
                return String(m._id || m.id || m.matriculaId || m.matricula || '');
              }
            }
          }
        }

        // Otherwise search in horariosDisponiveis for the horario object
        const horarioObj = horariosDisponiveis.find(h => String(h._id) === String(novoHorarioFixoId) || String(h._id) === String(chosen?.horarioId) || String(h.id) === String(chosen?.horarioId));
        if (horarioObj) {
          const ms = horarioObj.matriculas || horarioObj.matricula || [];
          if (Array.isArray(ms) && ms.length > 0) {
            for (const m of ms) {
              const alunoRef = m.alunoId || m.aluno || null;
              const alunoId = alunoRef && (typeof alunoRef === 'string' ? alunoRef : (alunoRef._id || alunoRef)) || null;
              if (alunoId && aluno && String(alunoId) === String(aluno._id)) {
                return String(m._id || m.id || m.matriculaId || m.matricula || '');
              }
            }
          }
        }
      } catch (e) {
        console.warn('[ReagendarAulaModal] erro ao derivar matriculaId', e);
      }
      return null;
    };

    if (!matriculaId) {
      const derived = tryDeriveMatricula();
      if (derived) matriculaId = derived;
    }

    // Validate required fields (backend expects these top-level keys)
    const missing: string[] = [];
    if (!horarioFixoId) missing.push('horarioFixoId');
    if (!dataOriginalISO) missing.push('dataOriginal');
    if (!novaData) missing.push('novaData');
    if (!novoHorarioInicio) missing.push('novoHorarioInicio');
    if (!novoHorarioFim) missing.push('novoHorarioFim');
    if (!novoHorarioFixoId) missing.push('novoHorarioFixoId');
    if (!matriculaId) missing.push('matriculaId');

    if (missing.length > 0) {
      toast.error('Campos obrigatórios ausentes: ' + missing.join(', '));
      console.warn('[ReagendarAulaModal] missing payload fields', { missing, horarioOriginal, chosen, matricula });
      return;
    }

    const body = {
      horarioFixoId: horarioFixoId,
      dataOriginal: dataOriginalISO,
      novaData: novaData,
      novoHorarioInicio: novoHorarioInicio,
      novoHorarioFim: novoHorarioFim,
      novoHorarioFixoId: novoHorarioFixoId,
      matriculaId: matriculaId,
      motivo: `Reagendamento de ${horarioOriginal?.horarioInicio || ''}-${horarioOriginal?.horarioFim || ''} para ${novoHorarioInicio}-${novoHorarioFim}`
    };

    try {
      const res = await fetch('/api/reagendamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const json = await res.json();
      if (json && json.success) {
        const created = json.data || json.reagendamento || json;
        toast.success('Reagendamento criado com sucesso');
        if (typeof onCreated === 'function') {
          try { onCreated(created); } catch (e) { console.warn('onCreated callback failed', e); }
        }
        onClose();
      } else {
        toast.error('Falha ao criar reagendamento: ' + (json && (json.error || json.message) ? (json.error || json.message) : 'erro'));
        console.warn('[ReagendarAulaModal] response error', json);
      }
    } catch (err) {
      console.error('Erro ao enviar reagendamento', err);
      toast.error('Erro ao enviar reagendamento');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 max-w-lg w-full p-6 max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <i className="fas fa-calendar-alt text-primary-600" />
              Reagendar Aula
            </h2>
            <p className="text-xs text-gray-500 mt-1">Selecione a nova data e horário para a falta.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Fechar">
            <i className="fas fa-times text-lg" />
          </button>
        </div>

        <div className="border-t border-gray-200 mt-4 mb-4" />

        {/* Summary */}
        <div className="mb-4 p-3 bg-gradient-to-r from-red-50 via-gray-50 to-green-50 border border-gray-300 rounded-md">
          <div className="flex items-center gap-2">
            <div className="text-sm text-gray-700">
              <div className="font-semibold">Resumo do reagendamento</div>
              <div className="text-xs text-gray-600 mt-1">
                <div><span className="font-bold">Aluno:</span> {aluno?.nome || '-'}</div>
                <div><span className="font-bold">Data original:</span> {dataOriginal ? new Date(dataOriginal).toLocaleDateString('pt-BR') : '-'}</div>
                <div><span className="font-bold">Horário original:</span> {horarioOriginal?.horarioInicio || '-'} - {horarioOriginal?.horarioFim || '-'}</div>
              </div>
            </div>
          </div>
        </div>

        <h3 className="font-semibold text-gray-900 mb-3">Selecione a nova data e horário</h3>

        <div className="max-h-[calc(80vh-220px)] overflow-y-auto text-sm">
          {availableDates.length > 0 ? (
            availableDates.map((dia, idx) => {
              const expanded = datasExpandidas.has(dia.dateISO);
              return (
                <div key={dia.dateISO} className="mb-2">
                  <button type="button" onClick={() => toggleDataExpandida(dia.dateISO)} className="w-full text-left px-3 py-2 rounded-md border border-gray-200 bg-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-medium">{dia.label}</div>
                      <div className="text-xs text-gray-500">{dia.horarios.length} horário{dia.horarios.length > 1 ? 's' : ''}</div>
                    </div>
                    <div className="text-xs text-gray-400">{expanded ? 'Fechar' : 'Abrir'}</div>
                  </button>

                  {expanded && (
                    <div className="mt-2 px-3">
                      {dia.horarios.map((h:any) => (
                        <label key={h.id} className={`flex items-center gap-3 w-full p-2 rounded-md border ${selectedHorarioId === String(h.id) && selectedDate === dia.dateISO ? 'border-primary-600 bg-primary-50' : 'border-gray-100 bg-white'}`}>
                          <input type="radio" name="horario" value={h.id} checked={selectedHorarioId === String(h.id) && selectedDate === dia.dateISO} onChange={() => { setSelectedDate(dia.dateISO); setSelectedHorarioId(String(h.id)); }} />
                          <div className="flex-1 text-sm text-gray-700">{h.label}</div>
                          <div className="text-xs text-gray-500">Vagas</div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-gray-500">{loading ? 'Carregando horários...' : 'Nenhuma data disponível nos próximos dias.'}</div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 pt-3 border-t border-gray-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">Cancelar</button>
          <button onClick={handleConfirm} disabled={!selectedDate || !selectedHorarioId} className="px-4 py-2 rounded-md text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed">Confirmar</button>
        </div>
      </div>
    </div>
  );
}
