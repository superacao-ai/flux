'use client';

import { useState, useEffect, useMemo } from 'react';
import Layout from '@/components/Layout';

interface Aluno { _id: string; nome: string; }
interface Professor { _id: string; nome: string; }
interface Modalidade { _id: string; nome: string; cor?: string; }
interface HorarioFixo { _id: string; alunoId?: Aluno | string | null; professorId?: Professor | string | null; diaSemana: number; horarioInicio: string; horarioFim: string; observacoes?: string; observacaoTurma?: string; modalidadeId?: string | any; ativo?: boolean; }
interface Reagendamento { _id: string; horarioFixoId: any; dataOriginal: string; novaData: string; novoHorarioInicio: string; novoHorarioFim: string; motivo: string; status: string; }

export default function CalendarPage() {
  const [modalidades, setModalidades] = useState<Modalidade[]>([]);
  const [modalidadeSelecionada, setModalidadeSelecionada] = useState<string>('');
  const [horarios, setHorarios] = useState<HorarioFixo[]>([]);
  const [reagendamentos, setReagendamentos] = useState<Reagendamento[]>([]);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [month, setMonth] = useState<number>(new Date().getMonth()); // 0-11
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ horarioFixoId: '', novaData: '', novoHorarioInicio: '', novoHorarioFim: '', motivo: '' });

  const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  // Helper: check if currently selected modalidade permits classes on a given weekday (0-6)
  const modalidadeAllowsDay = (dow: number) => {
    if (!modalidadeSelecionada) return true; // if no modalidade selected, treat as allowed
    const mod = modalidades.find(m => ((m as any)._id || (m as any).id) === modalidadeSelecionada);
    if (!mod) return true;
    // Normalize a diasSemana array to 0-6 (JS Date.getDay mapping). Accept both 0-6 and 1-7 encodings.
    const normalizeDays = (arr: any[]) => {
      if (!Array.isArray(arr)) return [];
      const mapped = arr.map((n: number) => {
        if (typeof n !== 'number') return -1;
        // if already 0-6, return as-is; if 1-7, convert to 0-6 (1..7 where 7->0)
        if (n >= 0 && n <= 6) return n;
        if (n >= 1 && n <= 7) return (n % 7); // 7 -> 0 (Sunday)
        return -1;
      });
      return Array.from(new Set(mapped)).filter((x: number) => x >= 0);
    };

    // First, check explicit horariosDisponiveis if present
    const hdisp = (mod as any).horariosDisponiveis || [];
    if (Array.isArray(hdisp) && hdisp.length > 0) {
      for (const hd of hdisp) {
        const days = normalizeDays(hd.diasSemana || []);
        if (days.includes(dow)) return true;
      }
      return false;
    }
    // Fallback to horarioFuncionamento with manha/tarde dias (if present)
    const hf = (mod as any).horarioFuncionamento || {};
    // If hf defines manha/tarde and diasSemana arrays on modalidade, check those
    if ((mod as any).diasSemana && Array.isArray((mod as any).diasSemana) && (mod as any).diasSemana.length > 0) {
      const ds = normalizeDays((mod as any).diasSemana || []);
      return ds.includes(dow);
    }
    // If no specific info, assume allowed
    return true;
  };

  useEffect(() => { fetchModalidades(); }, []);
  useEffect(() => { fetchData(); }, [modalidadeSelecionada, month, year]);

  const fetchModalidades = async () => {
    try {
      const res = await fetch('/api/modalidades');
      const data = await res.json();
      if (data.success) {
        setModalidades(data.data || []);
        // Automatically pick the first modalidade (require selection)
        if (Array.isArray(data.data) && data.data.length > 0) {
          const first = data.data[0];
          const mid = (first && ((first._id) || first.id)) || '';
          setModalidadeSelecionada(String(mid));
        }
      }
    } catch (e) { console.error(e); }
  };

  const fetchData = async () => {
    try {
      // Only include modalidadeId when a modalidade is selected. Sending an empty param
      // can sometimes cause unexpected server-side behavior, so omit it for clarity.
      const url = modalidadeSelecionada ? `/api/horarios?modalidadeId=${encodeURIComponent(modalidadeSelecionada)}` : '/api/horarios';
      console.debug('[Calendar] fetchData -> URL:', url);
      const resp = await fetch(url);
      const hd = await resp.json();
      if (hd && hd.success) {
        console.debug('[Calendar] /api/horarios returned', Array.isArray(hd.data) ? hd.data.length : hd.data);
        setHorarios(hd.data || []);
      }

      const r = await fetch('/api/reagendamentos');
      const rd = await r.json();
      if (rd && rd.success) setReagendamentos(rd.data || []);
    } catch (e) { console.error(e); }
  };

  // Build the days for the month grid
  const monthData = useMemo(() => {
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const days: Array<{ date: Date; day: number; dow: number }> = [];
    // pad start with previous month days
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
    // pad end to full week
    while (days.length % 7 !== 0) {
      const lastD = days[days.length - 1].date;
      const dt = new Date(lastD);
      dt.setDate(dt.getDate() + 1);
      days.push({ date: dt, day: dt.getDate(), dow: dt.getDay() });
    }
    return days;
  }, [year, month]);

  // For a given date, compute which fixed horarios apply (weekday match) and map reagendamentos for that date
  const horariosForDate = (date: Date) => {
    const dow = date.getDay();
    // fixed horarios that match day of week
    // Show only horarios that reference a student with a name (filter out empty/placeholder turmas)
    const fixed = horarios.filter(h => {
      if (h.diaSemana !== dow) return false;
      if (h.ativo === false) return false;
      const aluno = h.alunoId as any;
      // require an object aluno with a nome property
      if (!aluno) return false;
      if (typeof aluno === 'string') return false; // string id only -> skip (no display name)
      if (!aluno.nome) return false;
      return true;
    });

    // reagendamentos that target this date (novaData) and reference a student
    const dateStr = date.toISOString().slice(0,10);
    const r = reagendamentos.filter(rr => {
      if (!rr.novaData || rr.novaData.slice(0,10) !== dateStr) return false;
      const hf = rr.horarioFixoId as any;
      if (!hf) return false;
      const aluno = hf.alunoId as any;
      if (!aluno) return false;
      if (typeof aluno === 'string') return false;
      if (!aluno.nome) return false;
      return true;
    });
    return { fixed, reagend: r };
  };

  const prevMonth = () => { const dt = new Date(year, month - 1, 1); setYear(dt.getFullYear()); setMonth(dt.getMonth()); };
  const nextMonth = () => { const dt = new Date(year, month + 1, 1); setYear(dt.getFullYear()); setMonth(dt.getMonth()); };

  const handleOpenModalForHorario = (horarioId: string) => {
    setForm({ ...form, horarioFixoId: horarioId });
    setShowModal(true);
  };

  const handleSubmitReag = async (e: any) => {
    e.preventDefault();
    try {
      const resp = await fetch('/api/reagendamentos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await resp.json();
      if (data.success) { setShowModal(false); setForm({ horarioFixoId: '', novaData: '', novoHorarioInicio: '', novoHorarioFim: '', motivo: '' }); fetchData(); }
      else alert('Erro: ' + (data.error || '')); 
    } catch (e) { console.error(e); alert('Erro ao criar reagendamento'); }
  };

  return (
    <Layout title="Calendário - Superação Flux" fullWidth>
      <div className="px-4 py-6 sm:px-0">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4">
          <div className="w-full md:w-auto">
            <h1 className="text-xl font-semibold">Calendário</h1>
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-gray-600">Visualize horários fixos por modalidade e alterações (reagendamentos).</p>

              <div className="flex items-center gap-2">
                <button onClick={prevMonth} aria-label="Mes anterior" className="p-2 rounded-md hover:bg-gray-100 border">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                <div className="flex items-center space-x-2 border rounded-md px-2 py-1 bg-white">
                  <select
                    value={month}
                    onChange={(e) => setMonth(parseInt(e.target.value))}
                    className="bg-transparent text-sm outline-none"
                  >
                    {Array.from({ length: 12 }).map((_, i) => (
                      <option key={i} value={i}>{new Date(2000, i).toLocaleString('pt-BR', { month: 'long' })}</option>
                    ))}
                  </select>

                  <input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(Math.max(1970, Math.min(2099, parseInt(e.target.value || '0'))))}
                    className="w-20 text-sm text-right outline-none"
                  />
                </div>

                <button onClick={nextMonth} aria-label="Próximo mês" className="p-2 rounded-md hover:bg-gray-100 border">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                <button onClick={() => { const today = new Date(); setYear(today.getFullYear()); setMonth(today.getMonth()); }} className="ml-2 px-3 py-1 rounded-md border bg-white text-sm">Hoje</button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {modalidades.map(m => {
                const mid = (m && ((m as any)._id || (m as any).id)) || '';
                const active = String(mid) === String(modalidadeSelecionada);
                return (
                  <button
                    key={mid}
                    onClick={() => setModalidadeSelecionada(String(mid))}
                    className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${active ? 'bg-primary-600 text-white' : 'bg-white border'}`}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.cor || '#3B82F6' }} />
                    <span>{m.nome}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* month selector moved below and centered */}
        </div>

        

        <div className="grid grid-cols-7 gap-1 text-xs">
          {modalidadeSelecionada && horarios.length === 0 && (
            <div className="col-span-7 p-3 bg-yellow-50 text-yellow-800 rounded mb-2 text-sm">Nenhum horário encontrado para a modalidade selecionada.</div>
          )}
          {diasSemana.map((d, idx) => {
            const allowed = modalidadeAllowsDay(idx);
            return (
              <div key={`dow-${idx}-${d}`} className={`text-center font-medium py-2 ${allowed ? '' : 'text-red-600'}`}>{d}</div>
            );
          })}

          {monthData.map((dObj) => {
            const { fixed, reagend } = horariosForDate(dObj.date);
            const dateKey = dObj.date.toISOString().slice(0,10);
            const isToday = (new Date()).toDateString() === dObj.date.toDateString();
            const allowed = modalidadeAllowsDay(dObj.dow);
            const inCurrentMonth = dObj.date.getMonth() === month;
            const cellBaseBg = inCurrentMonth ? 'bg-white' : 'bg-gray-100 text-gray-500';
            // If modality explicitly disallows this weekday, mark cell as red (only for current month days)
            const unavailableClasses = (!allowed && inCurrentMonth) ? 'bg-red-50 text-red-700 border border-red-200' : '';
              return (
              <div key={dateKey} className={`p-2 h-44 flex flex-col min-h-0 ${cellBaseBg} ${unavailableClasses} ${isToday ? 'ring-2 ring-primary-500' : ''} border`}>
                <div className="flex justify-between items-center">
                  <div className="font-medium flex items-center gap-2">
                    <span>{dObj.day}</span>
                    {isToday && (
                      <span className="inline-block text-[10px] bg-primary-600 text-white px-2 py-0.5 rounded">Hoje</span>
                    )}
                  </div>
                  <div className={`${!allowed && inCurrentMonth ? 'text-red-700' : 'text-[10px] text-gray-500'}`}>{fixed.length}</div>
                </div>
                  <div className="mt-1 space-y-0.5 flex flex-col items-center min-h-0">
                  {/* show explicit unavailable badge when modalidade disallows this weekday */}
                  {!allowed && inCurrentMonth ? (
                    <div className="text-center text-[11px] text-red-700 bg-red-100 border border-red-200 rounded px-1 py-0.5 w-full max-w-[140px]">INDISPONÍVEL</div>
                  ) : null}
                  <div className="w-full flex-1 min-h-0 overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-gray-300">
                    {fixed.map(f => {
                    const obsRaw = String((f as any).observacoes || '');
                    const obs = obsRaw.replace(/\[CONGELADO\]|\[AUSENTE\]/g, '').trim();
                    const isCongelado = obsRaw.includes('[CONGELADO]');
                    const isAusente = obsRaw.includes('[AUSENTE]');
                    const nameClass = isAusente ? 'text-red-600 font-semibold' : (isCongelado ? 'text-blue-600 font-semibold' : 'text-gray-800');
                    const alunoNome = (f.alunoId && (f.alunoId as any).nome) || 'Turma';
                    return (
                      <div key={`${String(f._id || '')}-${dateKey}-${f.horarioInicio || ''}`} className="px-1 py-0.5 rounded border border-gray-100 bg-primary-50 w-full overflow-hidden">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 w-full overflow-hidden">
                            <div className={`font-semibold text-xs truncate ${nameClass}`}>{alunoNome}</div>
                            {obs ? (
                              <div className="text-[10px] text-yellow-800 truncate">{obs}</div>
                            ) : null}
                            <div className="text-[10px] text-gray-600 mt-0.5 truncate">{(f.professorId as any)?.nome || ''} • {f.horarioInicio}</div>
                          </div>
                          <div className="flex-shrink-0 ml-2">
                            <button onClick={() => handleOpenModalForHorario(f._id)} className="text-primary-600 p-1 rounded hover:bg-gray-100" title="Reagendar" aria-label="Reagendar">
                              {/* calendar + arrow icon (inline SVG) */}
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                <line x1="16" y1="2" x2="16" y2="6" />
                                <line x1="8" y1="2" x2="8" y2="6" />
                                <path d="M3 10h18" />
                                <path d="M12 14l4-4" />
                                <path d="M12 14v-3" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                    })}

                    {reagend.map(r => {
                    const obsRaw = String((r as any).observacoes || '');
                    const obs = obsRaw.replace(/\[CONGELADO\]|\[AUSENTE\]/g, '').trim();
                    const isCongelado = obsRaw.includes('[CONGELADO]');
                    const isAusente = obsRaw.includes('[AUSENTE]');
                    const nameClass = isAusente ? 'text-red-600 font-semibold' : (isCongelado ? 'text-blue-600 font-semibold' : 'text-gray-800');
                    const alunoNome = r.horarioFixoId?.alunoId?.nome || 'Reagendamento';
                    return (
                      <div key={`${String(r._id || '')}-${dateKey}-${String(r.novaData || '')}`} className="px-1 py-0.5 rounded border border-gray-200 bg-yellow-50 text-[11px] w-full overflow-hidden">
                        <div className={`font-semibold text-xs truncate ${nameClass}`}>{alunoNome}</div>
                        {obs ? (
                          <div className="text-[10px] text-gray-500 truncate">{new Date(r.novaData).toLocaleDateString('pt-BR')} — {r.motivo} — {obs}</div>
                        ) : (
                          <div className="text-[10px] text-gray-500 truncate">{new Date(r.novaData).toLocaleDateString('pt-BR')} — {r.motivo}</div>
                        )}
                        <div className="text-[10px] text-gray-600">{(r.horarioFixoId?.professorId as any)?.nome || ''} • {r.novoHorarioInicio}</div>
                      </div>
                    );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal para criar reagendamento */}
        {showModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 z-50 flex items-start justify-center pt-24">
            <div className="bg-white p-6 rounded shadow w-[520px]">
              <h3 className="text-lg font-medium mb-3">Novo Reagendamento</h3>
              <form onSubmit={handleSubmitReag} className="space-y-3">
                <div>
                  <label className="block text-sm">Horário fixo</label>
                  <select value={form.horarioFixoId} onChange={e => setForm({...form, horarioFixoId: e.target.value})} className="w-full border rounded px-2 py-1">
                    <option value="">Selecione</option>
                    {horarios.map(h => <option key={h._id} value={h._id}>{(h.alunoId as any)?.nome || h._id} • {h.horarioInicio}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm">Nova data</label>
                    <input type="date" value={form.novaData} onChange={e => setForm({...form, novaData: e.target.value})} className="w-full border rounded px-2 py-1" />
                  </div>
                  <div>
                    <label className="block text-sm">Novo horário início</label>
                    <input type="time" value={form.novoHorarioInicio} onChange={e => setForm({...form, novoHorarioInicio: e.target.value})} className="w-full border rounded px-2 py-1" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm">Novo horário fim</label>
                  <input type="time" value={form.novoHorarioFim} onChange={e => setForm({...form, novoHorarioFim: e.target.value})} className="w-full border rounded px-2 py-1" />
                </div>
                <div>
                  <label className="block text-sm">Motivo</label>
                  <textarea value={form.motivo} onChange={e => setForm({...form, motivo: e.target.value})} className="w-full border rounded px-2 py-1" />
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setShowModal(false)} className="px-3 py-1 border rounded">Cancelar</button>
                  <button type="submit" className="px-3 py-1 bg-primary-600 text-white rounded">Salvar</button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}
