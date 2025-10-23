"use client";

import React, { useEffect, useState, useMemo } from 'react';

type Horario = {
  _id: string;
  diaSemana: number;
  horarioInicio: string;
  horarioFim: string;
  professorId?: { _id?: string; nome?: string } | string;
  alunoId?: { _id?: string; nome?: string } | Array<any> | null;
  congelado?: boolean;
  ausente?: boolean;
  emEspera?: boolean;
};

const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

const formatDate = (d: Date) => {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export default function ProfessorAgendaClient() {
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // attendance modal state (hooks must be declared unconditionally at top)
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // compute which weekdays the professor has classes on (0..6)
  const availableWeekdays = useMemo(() => {
    const s = new Set<number>();
    horarios.forEach(h => {
      if (typeof h.diaSemana === 'number') s.add(h.diaSemana);
    });
    return s;
  }, [horarios]);

  const isAvailableDate = (d: Date) => availableWeekdays.has(d.getDay());

  const findNextAvailableDate = (from: Date, direction = 1) => {
    // direction: 1 => forward, -1 => backward
    const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    const maxDays = 365; // safety limit
    for (let i = 1; i <= maxDays; i++) {
      const candidate = new Date(start);
      candidate.setDate(start.getDate() + i * direction);
      if (isAvailableDate(candidate)) return candidate;
    }
    return start; // fallback to original date
  };

  // When horarios load, snap selectedDate to the nearest available date (forward) if current isn't available
  useEffect(() => {
    if (!horarios || horarios.length === 0) return;
    setSelectedDate((prev) => {
      if (isAvailableDate(prev)) return prev;
      return findNextAvailableDate(prev, 1);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [horarios.length]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        const res = await fetch('/api/me/horarios', { headers: { Authorization: token ? `Bearer ${token}` : '' } });
        if (!res.ok) throw new Error('Falha ao buscar horários');
        const payload = await res.json();
        const list = Array.isArray(payload) ? payload : (Array.isArray(payload.data) ? payload.data : []);
        setHorarios(list);
      } catch (e: any) {
        setError(e?.message || 'Erro desconhecido');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="p-6">Carregando agenda...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;

  if (horarios.length === 0) return <div className="p-6 text-gray-500">Nenhum horário encontrado.</div>;

  // Filter horarios by selectedDate's dayOfWeek
  const dayOfWeek = selectedDate.getDay();
  const filtered = horarios.filter(h => h.diaSemana === dayOfWeek);

  // Group by day/time
  const grouped: Record<string, Horario[]> = {};
  filtered.forEach((h) => {
    const key = `${h.diaSemana}-${h.horarioInicio}-${h.horarioFim}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(h);
  });

  const entries = Object.keys(grouped).map((k) => ({ key: k, items: grouped[k] }));

  // (moved to top)

  const submitAttendance = async (key: string, items: Horario[]) => {
    try {
      setSubmitting(true);
      const token = localStorage.getItem('token');
      // build presencas from attendanceMap
      const presencas = items.flatMap(h => {
        if (!h.alunoId) return [];
        const alunos = Array.isArray(h.alunoId) ? h.alunoId : [h.alunoId];
        return alunos.map(a => ({ alunoId: typeof a === 'string' ? a : (a._id || ''), presente: !!attendanceMap[`${key}::${String(a._id || a)}`] }));
      });

      const body = { horarioFixoId: items[0]._id, data: new Date().toISOString(), ministrada: true, presencas };
      const res = await fetch('/api/me/aulas', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Erro ao salvar aula');
      setOpenKey(null);
      alert('Aula registrada com sucesso');
    } catch (err: any) {
      alert(err?.message || 'Erro ao salvar');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleOpenKey = async (key: string, items: Horario[]) => {
    if (openKey === key) {
      setOpenKey(null);
      return;
    }

    // open: try to fetch existing Aula for first item's horarioFixoId and selectedDate
    const horarioFixoId = items[0]._id;
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({ horarioFixoId, date: selectedDate.toISOString() });
      const res = await fetch(`/api/me/aulas?${params.toString()}`, { headers: { Authorization: token ? `Bearer ${token}` : '' } });
      const json = await res.json();
      if (json.success && json.data) {
        const aula = json.data;
        // build attendanceMap from aula.presencas
        const newMap: Record<string, boolean> = {};
        (aula.presencas || []).forEach((p: any) => {
          const mapKey = `${key}::${String(p.alunoId)}`;
          newMap[mapKey] = !!p.presente;
        });
        setAttendanceMap(prev => ({ ...prev, ...newMap }));
      }
    } catch (err) {
      console.error('Erro ao buscar aula existente', err);
    }

    setOpenKey(key);
  };

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h1 className="text-xl font-semibold mb-4">Minha Agenda</h1>
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <button onClick={() => setSelectedDate(d => findNextAvailableDate(d, -1))} className="px-2 py-1 border rounded">←</button>
            <span className="px-3 font-medium">{formatDate(selectedDate)}</span>
            <button onClick={() => setSelectedDate(d => findNextAvailableDate(d, 1))} className="px-2 py-1 border rounded">→</button>
          </div>
          <div className="text-sm text-gray-500">{dayNames[dayOfWeek]}</div>
        </div>

        {/* compact upcoming dates */}
        <div className="mb-4">
          <div className="flex gap-2 flex-wrap">
            {(() => {
              const list: Date[] = [];
              const today = new Date();
              for (let i = 0; i < 30; i++) {
                const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
                if (isAvailableDate(d)) list.push(d);
              }
              if (list.length === 0) return null;
              return list.map(d => {
                const isSelected = selectedDate.toDateString() === d.toDateString();
                return (
                  <button key={d.toISOString()} onClick={() => setSelectedDate(d)} className={`px-2 py-1 rounded text-sm ${isSelected ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
                    {formatDate(d)}
                  </button>
                );
              });
            })()}
          </div>
        </div>

        {entries.map((g) => {
          // filter out horario items that don't reference any valid student (avoid rendering empty placeholders)
          const validItems = (g.items || []).filter(h => {
            const alunos = Array.isArray(h.alunoId) ? h.alunoId : (h.alunoId ? [h.alunoId] : []);
            return alunos.some(a => {
              if (!a) return false;
              if (typeof a === 'string') return String(a).trim().length > 0;
              return Boolean(a && (a._id || a.nome || a.email || a.telefone));
            });
          });
          const sample = validItems[0] || g.items[0];
          const key = g.key;
          return validItems.length === 0 ? null : (
            <div key={key} className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-sm text-gray-500">{sample.horarioInicio} — {sample.horarioFim}</div>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => toggleOpenKey(key, g.items)} className="text-sm text-primary-600">Registrar</button>
                </div>
              </div>
                <div className="divide-y">
                {validItems.map((h) => (
                  <div key={h._id} className="py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-sm font-medium flex items-center gap-2">
                          <i className="fas fa-user w-4 text-gray-400" aria-hidden="true" />
                          {(() => {
                            const alunos = Array.isArray(h.alunoId) ? h.alunoId : (h.alunoId ? [h.alunoId] : []);
                            if (alunos.length === 0) return <span className="text-gray-400">—</span>;
                            const safeName = (a: any) => (a && (a.nome || a.email || a.telefone) ? (a.nome || a.email || a.telefone) : '—');
                            if (alunos.length === 1) return safeName(alunos[0]);
                            const names = alunos.slice(0, 2).map((a: any) => safeName(a));
                            return `${names.join(', ')}${alunos.length > 2 ? ` +${alunos.length - 2}` : ''}`;
                          })()}
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          {h.congelado && <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded">Congelado</span>}
                          {h.ausente && <span className="px-2 py-0.5 bg-yellow-50 text-yellow-800 rounded">Ausente</span>}
                          {h.emEspera && <span className="px-2 py-0.5 bg-gray-50 text-gray-700 rounded">Em espera</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {openKey === key && (
                <div className="mt-3 border-t pt-3">
                  <div className="mb-2 text-sm font-medium">Marcar presenças</div>
                  {validItems.flatMap(h => (Array.isArray(h.alunoId) ? h.alunoId : (h.alunoId ? [h.alunoId] : []))).map((a: any) => {
                    const aid = typeof a === 'string' ? a : (a._id || '');
                    const mapKey = `${key}::${aid}`;
                    const display = typeof a === 'string' ? a : (a && (a.nome || a.email || a.telefone) ? (a.nome || a.email || a.telefone) : '—');
                    return (
                      <label key={aid || display} className="flex items-center gap-3 mb-2">
                        <input type="checkbox" checked={!!attendanceMap[mapKey]} onChange={(e) => setAttendanceMap(prev => ({ ...prev, [mapKey]: e.target.checked }))} />
                        <span className="text-sm">{display}</span>
                      </label>
                    );
                  })}
                  <div className="flex gap-2 mt-3">
                    <button disabled={submitting} onClick={() => submitAttendance(key, g.items)} className="bg-primary-600 text-white px-3 py-1 rounded">Salvar</button>
                    <button disabled={submitting} onClick={() => setOpenKey(null)} className="px-3 py-1 rounded border">Cancelar</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
