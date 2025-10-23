'use client';

import { useState, useEffect, useMemo } from 'react';
import Layout from '@/components/Layout';
import RequireAuth from '@/components/RequireAuth';
import StudentDetailModal from '@/components/StudentDetailModal';

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
  // Avoid calling new Date() during SSR render — initialize to safe defaults and set on mount
  const [year, setYear] = useState<number>(1970);
  const [month, setMonth] = useState<number>(0); // 0-11
  const [showModal, setShowModal] = useState(false);
  const [selectedAvailableDate, setSelectedAvailableDate] = useState<string>('');
  const [form, setForm] = useState({ horarioFixoId: '', dataOriginal: '', novaData: '', novoHorarioInicio: '', novoHorarioFim: '', novoHorarioProfessorId: '', novoHorarioFixoId: '', motivo: '' });
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [formErrors, setFormErrors] = useState<{ novaData?: string; novoHorarioInicio?: string }>(() => ({}));

  // Local student-detail modal state (so we can open the aluno modal inside the calendar page)
  const [showStudentDetailModal, setShowStudentDetailModal] = useState(false);
  const [selectedStudentHorario, setSelectedStudentHorario] = useState<any | null>(null);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<any | null>(null);
  const [modalEditing, setModalEditing] = useState<boolean>(false);
  const [modalEditName, setModalEditName] = useState<string>('');
  const [modalEditObservacoes, setModalEditObservacoes] = useState<string>('');
  const [localFlags, setLocalFlags] = useState<Record<string, { congelado?: boolean; ausente?: boolean; emEspera?: boolean }>>({});
  const [todayString, setTodayString] = useState<string>('');
  const [pendingNavigate, setPendingNavigate] = useState<any | null>(null);
  // pagination for slot-picker date cards (page index)
  const [datePageIndex, setDatePageIndex] = useState<number>(0);

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
  // Set real current year/month only on client mount to avoid SSR/CSR mismatch
  useEffect(() => {
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth());
    setTodayString(now.toDateString());
  }, []);

  // Only fetch horarios when a modalidade is selected to avoid loading all modalidades on entry
  useEffect(() => { if (!modalidadeSelecionada) return; fetchData(); }, [modalidadeSelecionada, month, year]);

  // Close modals when the user presses Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        if (showModal) setShowModal(false);
        if (showGroupModal) setShowGroupModal(false);
        if (showStudentDetailModal) setShowStudentDetailModal(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showModal, showGroupModal, showStudentDetailModal]);

  const fetchModalidades = async () => {
    try {
      const res = await fetch('/api/modalidades');
      const data = await res.json();
      if (data.success) {
        setModalidades(data.data || []);
        // Try to restore previously selected modalidade from localStorage (session persistence)
        try {
          const saved = (typeof window !== 'undefined') ? localStorage.getItem('calendar.modalidadeSelecionada') : null;
          if (saved) {
            const found = Array.isArray(data.data) && data.data.find((m: any) => ((m && ((m._id) || m.id)) || '') === saved);
            if (found) {
              setModalidadeSelecionada(String(saved));
              return;
            }
          }
        } catch (e) { /* ignore localStorage errors */ }

        // Fallback: automatically pick the first modalidade (require selection)
        if (Array.isArray(data.data) && data.data.length > 0) {
          const first = data.data[0];
          const mid = (first && ((first._id) || first.id)) || '';
          setModalidadeSelecionada(String(mid));
          // Immediately fetch horarios for the chosen modalidade so the calendar shows data
          try { if (mid) fetchData(String(mid)); } catch(e) { /* ignore */ }
        }
      }
    } catch (e) { console.error(e); }
  };

  const fetchData = async (modalidadeIdArg?: string) => {
    try {
      // Only include modalidadeId when a modalidade is selected. Sending an empty param
      // can sometimes cause unexpected server-side behavior, so omit it for clarity.
      const chosen = modalidadeIdArg || modalidadeSelecionada;
      const url = chosen ? `/api/horarios?modalidadeId=${encodeURIComponent(chosen)}` : '/api/horarios';
      console.debug('[Calendar] fetchData -> URL:', url);
      const resp = await fetch(url);
      const hd = await resp.json();
      if (hd && hd.success) {
        console.debug('[Calendar] /api/horarios returned', Array.isArray(hd.data) ? hd.data.length : hd.data);
        setHorarios(hd.data || []);
      }

      const r = await fetch('/api/reagendamentos');
      const rd = await r.json();
      if (rd && rd.success) setReagendamentos((rd.data || []).filter((x: any) => String(x.status) !== 'rejeitado'));
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
    // Novo: para cada HorarioFixo, se tem matriculas, expandir cada aluno como item; senão, usar alunoId
    const fixed: any[] = [];
    for (const h of horarios) {
      if (h.diaSemana !== dow) continue;
      if (h.ativo === false) continue;
      const ms = (h as any).matriculas;
      if (Array.isArray(ms) && ms.length > 0) {
        for (const m of ms) {
          // Só exibe se aluno existe e tem nome
          const aluno = m.alunoId as any;
          if (!aluno || typeof aluno === 'string' || !aluno.nome) continue;
          fixed.push({ ...h, alunoId: aluno, matriculaId: m._id, observacoes: m.observacoes || h.observacoes, emEspera: m.emEspera === true });
        }
      } else {
        // Fallback: lógica antiga para alunoId direto
        const aluno = h.alunoId as any;
        if (!aluno || typeof aluno === 'string' || !aluno.nome) continue;
        fixed.push(h);
      }
    }

    // reagendamentos that target this date (novaData) and reference a student
    const dateStr = date.toISOString().slice(0,10);
    const r = reagendamentos.filter(rr => {
      if (!rr.novaData || rr.novaData.slice(0,10) !== dateStr) return false;
      const hf = rr.horarioFixoId as any;
      if (!hf) return false;
      // Novo: se reagendamento referencia matricula, buscar aluno via matricula
      if (rr.matriculaId) {
        const ms = (hf as any).matriculas;
        if (Array.isArray(ms)) {
          const m = ms.find((mat:any) => String(mat._id) === String(rr.matriculaId));
          const aluno = m && m.alunoId;
          if (!aluno || typeof aluno === 'string' || !aluno.nome) return false;
        }
      } else {
        const aluno = hf.alunoId as any;
        if (!aluno || typeof aluno === 'string' || !aluno.nome) return false;
      }
      // If a modalidade is selected, ensure the reagendamento belongs to that modalidade
      if (modalidadeSelecionada) {
        const hfModalidade = (hf && ((hf.modalidadeId && ((hf.modalidadeId as any)._id || hf.modalidadeId)) || hf.modalidadeId));
        if (!hfModalidade) return false;
        if (String(hfModalidade) !== String(modalidadeSelecionada)) return false;
      }
      return true;
    });
    return { fixed, reagend: r };
  };

  // Precompute all groups (turma slots) visible in the current month view so we can offer them as
  // selectable targets when creating a reagendamento. Each entry has: date (YYYY-MM-DD), dateObj,
  // start, end, professorNome and items[]. We reuse the same grouping logic used for rendering cells.
  const allGroupsInMonth = useMemo(() => {
    const out: Array<any> = [];
    for (const dObj of monthData) {
      try {
        const { fixed, reagend } = horariosForDate(dObj.date);
        const groups: Record<string, any> = {};
        for (const f of fixed) {
          const start = (f as any).horarioInicio || '';
          const end = (f as any).horarioFim || '';
            // prefer real professorId, but fall back to _professorId (server keeps it for debugging)
            const rawProf = (f as any).professorId || (f as any)._professorId || null;
          let profId: string | null = null;
          let profNome = '';
          if (!rawProf) profId = null;
          else if (typeof rawProf === 'string') profId = rawProf;
          else if (rawProf._id) { profId = String(rawProf._id); profNome = rawProf.nome || ''; }
          else { profId = String(rawProf); }
          const key = `${start}::${end}::${profId || 'noprof'}`;
          if (!groups[key]) groups[key] = { key, start, end, professorId: profId, professorNome: profNome || ((f as any).professorId && ((f as any).professorId as any).nome) || '', items: [] };
                        // If the server returned a HorarioFixo template with an attached
                        // `matriculas` array (newer shape), expand each matricula into
                        // a per-student item so the calendar UI renders all alunos.
                        try {
                          const ms = (f as any).matriculas;
                          if (Array.isArray(ms) && ms.length > 0) {
                            for (let i = 0; i < ms.length; i++) {
                              const m = ms[i] || {};
                              // Build an item that resembles the old per-horario-per-aluno shape
                              const item = {
                                // Prefer matricula._id if present so items are stable
                                _id: m._id || `${String((f as any)._id)}::mat::${i}`,
                                horarioInicio: (f as any).horarioInicio || '',
                                horarioFim: (f as any).horarioFim || '',
                                observacoes: m.observacoes || (f as any).observacoes || '',
                                // include alunoId populated from matricula
                                alunoId: m.alunoId || null,
                                // keep a reference to the source HorarioFixo so reagendamentos/reschedules
                                // that reference the HorarioFixo id can still be matched
                                horarioFixoId: (f as any)._id,
                                // propagate any emEspera flag if present on the matricula
                                emEspera: m.emEspera === true || (m as any).emEspera === true
                              };
                              groups[key].items.push(item);
                            }
                          } else {
                            groups[key].items.push(f);
                          }
                        } catch (e) {
                          // fallback to pushing the original document if anything fails
                          groups[key].items.push(f);
                        }
        }
        // include reagendamentos for this date
          for (const r of (reagend || [])) {
            const start = (r as any).novoHorarioInicio || '';
            const end = (r as any).novoHorarioFim || '';
            // Determine the professor for the NEW slot (destination)
            // Prefer explicit novoHorarioProfessorId, then try novoHorarioFixoId -> lookup target horario's professor
            let rawProf: any = null;
            try {
              if ((r as any).novoHorarioProfessorId) {
                rawProf = (r as any).novoHorarioProfessorId;
              } else if ((r as any).novoHorarioFixoId) {
                const targetHf = (horarios || []).find((h:any) => String((h as any)._id) === String((r as any).novoHorarioFixoId));
                rawProf = (targetHf && ((targetHf as any).professorId || (targetHf as any)._professorId)) || null;
              } else {
                rawProf = (r.horarioFixoId && (r.horarioFixoId.professorId || r.horarioFixoId._professorId)) || ((r as any).professorId || (r as any)._professorId) || null;
              }
            } catch(e) { rawProf = (r.horarioFixoId && (r.horarioFixoId.professorId)) || ((r as any).professorId) || null; }
            let profId: string | null = null;
            let profNome = '';
            if (!rawProf) profId = null;
            else if (typeof rawProf === 'string') profId = rawProf;
            else if (rawProf._id) { profId = String(rawProf._id); profNome = rawProf.nome || ''; }
            else { profId = String(rawProf); }
          const tentativeKey = `${start}::${end}::${profId || 'noprof'}`;
          // Use exact key matching including professor id so we don't merge groups from different professors
          const existingKey = Object.keys(groups).find(k => k === tentativeKey);
          const key = existingKey || tentativeKey;
          if (!groups[key]) groups[key] = { key, start, end, professorId: profId, professorNome: profNome || ((r.horarioFixoId && (r.horarioFixoId as any).professorId && (r.horarioFixoId as any).professorId.nome) || ''), items: [] };
          const synthetic = {
            _id: `reag-${(r as any)._id}`,
            __isReagendamento: true,
            reagendamentoId: (r as any)._id,
            horarioInicio: start,
            horarioFim: end,
            observacoes: r.motivo || '',
            alunoId: (r.horarioFixoId && (r.horarioFixoId.alunoId)) || null,
            professorId: rawProf
          };
          groups[key].items.push(synthetic);
          (groups[key] as any).hasReag = true;
        }
        Object.values(groups).forEach((g: any) => {
          out.push({ ...g, date: dObj.date.toISOString().slice(0,10), dateObj: dObj.date });
        });
      } catch (e) { /* ignore per-date grouping errors */ }
    }
    return out;
  }, [monthData, horarios, reagendamentos]);

  // Try to navigate to an original turma when requested. We store a small object
  // with { originalDate: 'YYYY-MM-DD', horarioInicio, horarioFim, professorId }
  // and when groups are recomputed we search for that group and open it.
  const navigateToOriginalTurma = (info: { originalDate: string; horarioInicio?: string; horarioFim?: string; professorId?: string | null }) => {
    try {
      const parts = (info.originalDate || '').split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0],10);
        const m = parseInt(parts[1],10) - 1;
        setYear(y);
        setMonth(m);
        // set a pending navigation request — effect will try to resolve it after groups recompute
        setPendingNavigate(info);
      }
    } catch(e) { console.error(e); }
  };

  // When groups refresh, check if we have a pendingNavigate and open the matching group
  useEffect(() => {
    if (!pendingNavigate) return;
    try {
      const targetDate = pendingNavigate.originalDate;
      const targetStart = pendingNavigate.horarioInicio || '';
      const targetEnd = pendingNavigate.horarioFim || '';
      const targetProf = pendingNavigate.professorId || 'noprof';
      // find group in allGroupsInMonth matching exact key
      let g = allGroupsInMonth.find((gg:any) => gg.date === targetDate && gg.start === targetStart && ( (String(gg.professorId || 'noprof')) === String(targetProf) ) );
      // fallback: if exact professor match not found, try to match by date+start only (professor may differ)
      if (!g) {
        g = allGroupsInMonth.find((gg:any) => gg.date === targetDate && gg.start === targetStart);
      }
      if (g) {
        // build reag match array for that group
        try {
          const hfIds = (g.items || []).map((it:any) => String((it as any)._id));
          const groupReag = (reagendamentos || []).filter((rr:any) => {
            try {
              const hf = rr.horarioFixoId || {};
              const hfId = hf && (hf._id || hf.id || hf);
              return hfId && hfIds.includes(String(hfId));
            } catch(e) { return false; }
          });
          setSelectedGroup({ ...g, date: g.date, dateObj: g.dateObj, reagendamentos: groupReag, hasReag: g.hasReag });
          setShowGroupModal(true);
        } catch(e) { setSelectedGroup({ ...g, date: g.date, dateObj: g.dateObj }); setShowGroupModal(true); }
        setPendingNavigate(null);
      }
    } catch(e) { console.error(e); }
  }, [allGroupsInMonth, pendingNavigate, reagendamentos]);

  const prevMonth = () => { const dt = new Date(year, month - 1, 1); setYear(dt.getFullYear()); setMonth(dt.getMonth()); };
  const nextMonth = () => { const dt = new Date(year, month + 1, 1); setYear(dt.getFullYear()); setMonth(dt.getMonth()); };

  const handleOpenModalForHorario = (horarioId: string, dataOriginal?: string) => {
    // Find the fixed horario to prefill times and calculate duration
    const hf = horarios.find(h => String((h as any)._id) === String(horarioId));
        if (hf) {
          const start = (hf as any).horarioInicio || '';
          const end = (hf as any).horarioFim || '';
          const dur = calcMinutesBetween(start, end) || 60;
          const novoFim = addMinutesToTime(start, dur);
          setDurationMinutes(dur);
          // Do NOT prefill the target (novaData/novoHorarioInicio/novoHorarioFim) here.
          // Leave them empty so the user must explicitly select a destination slot.
          setForm({ ...form, horarioFixoId: horarioId, dataOriginal: dataOriginal || '', novaData: '', novoHorarioInicio: '', novoHorarioFim: '', motivo: '' });
          setFormErrors({});
        } else {
          setForm({ ...form, horarioFixoId: horarioId, dataOriginal: dataOriginal || '' });
        }
    setShowModal(true);
  };

  // Helpers to validate modalidade availability
  const timeToMinutes = (t: string) => {
    const p = t.split(':'); if (p.length < 2) return 0; return parseInt(p[0],10)*60 + parseInt(p[1],10);
  };

  const modalidadeAllowsDayForModalidade = (modalidade: any, dow: number) => {
    if (!modalidade) return true;
    if (Array.isArray(modalidade.diasSemana) && modalidade.diasSemana.length > 0) {
      if (modalidade.diasSemana.map((n: number) => (n===7?0:n)).includes(dow)) return true;
    }
    const hdisp = modalidade.horariosDisponiveis || [];
    if (Array.isArray(hdisp) && hdisp.length > 0) {
      for (const hd of hdisp) {
        const days = Array.isArray(hd.diasSemana) ? hd.diasSemana.map((n: number) => (n===7?0:n)) : [];
        if (days.includes(dow)) return true;
      }
    }
    return false;
  };

  const modalidadeAllowsTime = (modalidade: any, dow: number, inicio: string, fim: string) => {
    if (!modalidade) return true;
    const hdisp = modalidade.horariosDisponiveis || [];
    if (Array.isArray(hdisp) && hdisp.length > 0) {
      for (const hd of hdisp) {
        const days = Array.isArray(hd.diasSemana) ? hd.diasSemana.map((n: number) => (n===7?0:n)) : [];
        if (!days.includes(dow)) continue;
        // check overlap: inicio >= hd.horaInicio and fim <= hd.horaFim
        if (!hd.horaInicio || !hd.horaFim) continue;
        const s = timeToMinutes(hd.horaInicio);
        const e = timeToMinutes(hd.horaFim);
        const si = timeToMinutes(inicio);
        const ei = timeToMinutes(fim);
        if (si >= s && ei <= e) return true;
      }
      return false;
    }
    // fallback: if modalidade has horarioFuncionamento, try to use it
    const hf = modalidade.horarioFuncionamento || {};
    const ranges = [] as Array<{inicio?:string;fim?:string}>;
    if (hf.manha && hf.manha.inicio && hf.manha.fim) ranges.push({inicio: hf.manha.inicio, fim: hf.manha.fim});
    if (hf.tarde && hf.tarde.inicio && hf.tarde.fim) ranges.push({inicio: hf.tarde.inicio, fim: hf.tarde.fim});
    for (const r of ranges) {
      const s = timeToMinutes(r.inicio || '00:00');
      const e = timeToMinutes(r.fim || '23:59');
      const si = timeToMinutes(inicio);
      const ei = timeToMinutes(fim);
      if (si >= s && ei <= e) return true;
    }
    return false;
  };

  // Return min/max time strings (HH:MM) allowed for modalidade on dow.
  const getModalidadeMinMax = (modalidade: any, dow: number) => {
    if (!modalidade) return { min: undefined, max: undefined };
    const hdisp = modalidade.horariosDisponiveis || [];
    let minM: number | null = null;
    let maxM: number | null = null;
    if (Array.isArray(hdisp) && hdisp.length > 0) {
      for (const hd of hdisp) {
        const days = Array.isArray(hd.diasSemana) ? hd.diasSemana.map((n: number) => (n===7?0:n)) : [];
        if (!days.includes(dow)) continue;
        if (!hd.horaInicio || !hd.horaFim) continue;
        const s = timeToMinutes(hd.horaInicio);
        const e = timeToMinutes(hd.horaFim);
        if (minM === null || s < minM) minM = s;
        if (maxM === null || e > maxM) maxM = e;
      }
    }
    if (minM === null && maxM === null) {
      const hf = modalidade.horarioFuncionamento || {};
      const ranges = [] as Array<{inicio?:string;fim?:string}>;
      if (hf.manha && hf.manha.inicio && hf.manha.fim) ranges.push({inicio: hf.manha.inicio, fim: hf.manha.fim});
      if (hf.tarde && hf.tarde.inicio && hf.tarde.fim) ranges.push({inicio: hf.tarde.inicio, fim: hf.tarde.fim});
      for (const r of ranges) {
        const s = timeToMinutes(r.inicio || '00:00');
        const e = timeToMinutes(r.fim || '23:59');
        if (minM === null || s < minM) minM = s;
        if (maxM === null || e > maxM) maxM = e;
      }
    }
    const minutesToTime = (m: number) => {
      const hh = Math.floor(m / 60) % 24;
      const mm = m % 60;
      return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
    };
    return { min: minM !== null ? minutesToTime(minM) : undefined, max: maxM !== null ? minutesToTime(maxM) : undefined };
  };

  // Helpers: parse time "HH:MM" to minutes since 00:00
  const parseTimeToMinutes = (t: string) => {
    if (!t || typeof t !== 'string') return 0;
    const parts = t.split(':');
    if (parts.length < 2) return 0;
    const hh = parseInt(parts[0], 10) || 0;
    const mm = parseInt(parts[1], 10) || 0;
    return hh * 60 + mm;
  };

  const pad2 = (n: number) => n.toString().padStart(2, '0');

  const minutesToTime = (m: number) => {
    const mm = ((m % 60) + 60) % 60;
    const hh = Math.floor(((m - mm) / 60) % 24 + 24) % 24;
    return `${pad2(hh)}:${pad2(mm)}`;
  };

  const calcMinutesBetween = (start: string, end: string) => {
    const s = parseTimeToMinutes(start);
    const e = parseTimeToMinutes(end);
    if (e >= s) return e - s;
    // if end before start assume next day
    return (24 * 60 - s) + e;
  };

  const addMinutesToTime = (time: string, minutesToAdd: number) => {
    const base = parseTimeToMinutes(time);
    return minutesToTime(base + minutesToAdd);
  };

  // Parse a date-only string like 'YYYY-MM-DD' into a local Date at midnight.
  // Avoid using `new Date('YYYY-MM-DD')` which is parsed as UTC and can shift
  // the day depending on the user's timezone.
  const parseDateOnlyToLocal = (dateStr?: string | null) => {
    if (!dateStr) return null as Date | null;
    try {
      const s = String(dateStr).slice(0, 10);
      const parts = s.split('-');
      if (parts.length !== 3) return null;
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);
      if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return null;
      return new Date(y, m - 1, d);
    } catch (e) { return null; }
  };

  const handleSubmitReag = async (e: any) => {
    e.preventDefault();
    // Client-side validation
  const errors: any = {};
  if (!form.horarioFixoId) errors.novaData = 'Horário fixo não selecionado';
  if (!form.novaData) errors.novaData = 'Nova data é obrigatória';
  if (!form.novoHorarioInicio) errors.novoHorarioInicio = 'Novo horário de início é obrigatório';
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }

    try {
      const resp = await fetch('/api/reagendamentos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await resp.json();
    if (data && data.success) {
    setShowModal(false);
  setForm({ horarioFixoId: '', dataOriginal: '', novaData: '', novoHorarioInicio: '', novoHorarioFim: '', novoHorarioProfessorId: '', novoHorarioFixoId: '', motivo: '' });
        setFormErrors({});
        fetchData();
      } else {
        // Show server error to user instead of console.error which triggers overlay
        const msg = (data && data.error) ? String(data.error) : 'Erro ao criar reagendamento';
        alert(msg);
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao criar reagendamento');
    }
  };

  const cancelReagendamento = async (id: string) => {
    if (!confirm('Cancelar este reagendamento?')) return;
    try {
      const resp = await fetch(`/api/reagendamentos/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'rejeitado' }) });
      let data: any = null;
      try { data = await resp.json(); } catch (e) { /* non-json response */ }

      if (resp.ok && data && data.success) {
        fetchData();
      } else {
        const serverMsg = data && data.error ? data.error : `HTTP ${resp.status}`;
        console.error('Erro cancelando reagendamento:', serverMsg, data);
        alert('Erro ao cancelar reagendamento: ' + serverMsg);
      }
    } catch (e) { console.error(e); alert('Erro ao cancelar reagendamento'); }
  };

  return (
    <RequireAuth>
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
                      onClick={() => {
                        try {
                          // toggle selection
                          const newVal = active ? '' : String(mid);
                          setModalidadeSelecionada(newVal);
                          if (typeof window !== 'undefined') {
                            if (newVal) localStorage.setItem('calendar.modalidadeSelecionada', String(newVal));
                            else localStorage.removeItem('calendar.modalidadeSelecionada');
                          }
                        } catch (e) { setModalidadeSelecionada(String(mid)); }
                      }}
                      className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${active ? 'bg-primary-600 text-white' : 'bg-white border'}`}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.cor || '#3B82F6' }} />
                      <span>{m.nome}</span>
                    </button>
                  );
                })}
            </div>
            {/* selection is persisted to localStorage but no banner shown (silent persistence) */}
          </div>

          {/* month selector moved below and centered */}
        </div>

        

        <div className="grid grid-cols-7 gap-1 text-xs">
          {diasSemana.map((d, idx) => {
            const allowed = modalidadeAllowsDay(idx);
            return (
              <div key={`dow-${idx}-${d}`} className={`text-center font-medium py-2 ${allowed ? '' : 'text-red-600'}`}>{d}</div>
            );
          })}

          {monthData.map((dObj) => {
            const { fixed, reagend } = horariosForDate(dObj.date);
            const dateKey = dObj.date.toISOString().slice(0,10);
            // Novo agrupamento: contar alunos via matriculas (se existir), senão alunoId
            let nonEsperaCount = 0;
            for (const f of fixed || []) {
              // Se o HorarioFixo tem array matriculas, contar cada aluno
              const ms = (f as any).matriculas;
              if (Array.isArray(ms) && ms.length > 0) {
                for (const m of ms) {
                  try {
                    const obsRaw = String(m.observacoes || (f as any).observacoes || '');
                    const docEmEspera = m.emEspera === true;
                    const local = localFlags[m._id || ''] || {};
                    const isEmEspera = docEmEspera || local.emEspera === true || obsRaw.includes('[EM_ESPERA]');
                    // Se reagendamento moveu este aluno para outro dia, não contar
                    const rescheduledAway = (reagendamentos || []).some((r: any) => {
                      try {
                        const hfRef = r.horarioFixoId && (r.horarioFixoId._id || r.horarioFixoId);
                        const original = (r.dataOriginal && String(r.dataOriginal).slice(0,10)) || '';
                        // Matrícula pode ser referenciada por reagendamento
                        return hfRef && String(hfRef) === String(f._id) && original === dateKey && r.matriculaId && String(r.matriculaId) === String(m._id);
                      } catch (e) { return false; }
                    });
                    if (!isEmEspera && !rescheduledAway) nonEsperaCount++;
                  } catch (e) { nonEsperaCount++; }
                }
              } else {
                // Fallback: lógica antiga para alunoId direto
                try {
                  const obsRaw = String((f as any).observacoes || '');
                  const docEmEspera = (f as any).emEspera === true;
                  const local = localFlags[(f as any)._id] || {};
                  const isEmEspera = docEmEspera || local.emEspera === true || obsRaw.includes('[EM_ESPERA]');
                  const rescheduledAway = (reagendamentos || []).some((r: any) => {
                    try {
                      const hfRef = r.horarioFixoId && (r.horarioFixoId._id || r.horarioFixoId);
                      const original = (r.dataOriginal && String(r.dataOriginal).slice(0,10)) || '';
                      return hfRef && String(hfRef) === String(f._id) && original === dateKey;
                    } catch (e) { return false; }
                  });
                  if (!isEmEspera && !rescheduledAway) nonEsperaCount++;
                } catch (e) { nonEsperaCount++; }
              }
            }
          const isToday = (todayString === dObj.date.toDateString());
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
                  <div className={`${!allowed && inCurrentMonth ? 'text-red-700' : 'text-[10px] text-gray-500'}`}>{nonEsperaCount}</div>
                </div>
                  <div className="mt-1 space-y-0.5 flex flex-col items-center min-h-0">
                  {/* show explicit unavailable badge when modalidade disallows this weekday */}
                  {!allowed && inCurrentMonth ? (
                    <div className="text-center text-[11px] text-red-700 bg-red-100 border border-red-200 rounded px-1 py-0.5 w-full max-w-[140px]">INDISPONÍVEL</div>
                  ) : null}
                    <div className="w-full flex-1 min-h-0 overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-gray-300">
                      {/* Group fixed horarios by slot (professor + start+end) */}
                      {(() => {
                        const groups: Record<string, { key: string; start: string; end: string; professorId: string | null; professorNome: string; items: any[] } > = {};
                        for (const f of fixed) {
                          const start = (f as any).horarioInicio || '';
                          const end = (f as any).horarioFim || '';
                          const rawProf = (f as any).professorId;
                          let profId: string | null = null;
                          let profNome = '';
                          if (!rawProf) profId = null;
                          else if (typeof rawProf === 'string') profId = rawProf;
                          else if (rawProf._id) { profId = String(rawProf._id); profNome = rawProf.nome || ''; }
                          else { profId = String(rawProf); }
                          const key = `${start}::${end}::${profId || 'noprof'}`;
                          if (!groups[key]) groups[key] = { key, start, end, professorId: profId, professorNome: profNome || ((f as any).professorId && ((f as any).professorId as any).nome) || '', items: [] };
                          groups[key].items.push(f);
                        }
                        // Also include reagendamentos that map to this date as synthetic items
                        try {
                          for (const r of (reagend || [])) {
                            // Use the new horario times for grouping
                            const start = (r as any).novoHorarioInicio || '';
                            const end = (r as any).novoHorarioFim || '';
                            const rawProf = (r.horarioFixoId && (r.horarioFixoId.professorId)) || ((r as any).professorId) || null;
                            let profId: string | null = null;
                            let profNome = '';
                            if (!rawProf) profId = null;
                            else if (typeof rawProf === 'string') profId = rawProf;
                            else if (rawProf._id) { profId = String(rawProf._id); profNome = rawProf.nome || ''; }
                            else { profId = String(rawProf); }
                            const tentativeKey = `${start}::${end}::${profId || 'noprof'}`;
                            // Use exact key matching (start::end::profId) to avoid merging groups belonging to different professors
                            const existingKey = Object.keys(groups).find(k => k === tentativeKey);
                            const key = existingKey || tentativeKey;
                            // create group if missing
                            if (!groups[key]) groups[key] = { key, start, end, professorId: profId, professorNome: profNome || ((r.horarioFixoId && (r.horarioFixoId as any).professorId && (r.horarioFixoId as any).professorId.nome) || ''), items: [] };
                            // Create a synthetic item representing this reagendamento and add it to the chosen group
                            const synthetic = {
                              _id: `reag-${(r as any)._id}`,
                              __isReagendamento: true,
                              reagendamentoId: (r as any)._id,
                              horarioInicio: start,
                              horarioFim: end,
                              observacoes: r.motivo || '',
                              alunoId: (r.horarioFixoId && (r.horarioFixoId.alunoId)) || null,
                              professorId: rawProf
                            };
                            groups[key].items.push(synthetic);
                            (groups[key] as any).hasReag = true;
                          }
                        } catch (e) { /* ignore reag grouping errors */ }
                        return Object.values(groups).map((g, groupIdx) => {
                          // ...existing code...
                          const count = (g.items || []).filter((f: any) => {
                            // ...existing code...
                          }).length;
                          // ...existing code...
                          const vagas = Math.max(0, (capacity || 0) - count);
                          const stateClasses = vagas === 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-100 border-emerald-200';
                          const textColor = vagas === 0 ? 'text-red-700' : 'text-emerald-800';

                          return (
                            <button key={g.key + '-' + groupIdx} onClick={() => {
                              // ...existing code...
                            }} className={`w-full text-left px-2 py-1 rounded ${stateClasses} hover:bg-gray-50 flex items-center justify-between text-[12px]`}>
                              <div className="truncate">
                                <div className={`font-semibold ${textColor}`}>{g.start}{g.end ? ` – ${g.end}` : ''}</div>
                                <div className="text-[11px] text-gray-500 truncate">{g.professorNome ? 'Personal ' + g.professorNome : ''}</div>
                              </div>
                              <div className={`ml-2 text-[12px] ${textColor} flex items-center gap-2`}>
                                <span>{count}/{capacity}</span>
                              </div>
                              {/* Renderizar itens internos com key única */}
                              <div style={{display:'none'}}>
                                {(g.items || []).map((item:any, idx:number) => (
                                  <div key={String(item._id)+'-'+idx} />
                                ))}
                              </div>
                            </button>
                          );
                        })
                        });
                      })()}

                    {/* reagendamentos are shown in the group modal, not directly in the calendar cell */}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal para criar reagendamento */}
        {showModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 z-[90] flex items-start justify-center pt-24">
            <div className="bg-white p-6 rounded shadow w-[520px] z-[91]">
              <form onSubmit={handleSubmitReag} className="space-y-3">
                {/* Prominent header: student avatar, name and horario being rescheduled */}
                <div className="mb-2">
                  {(() => {
                    const hf = horarios.find(h => String((h as any)._id) === String(form.horarioFixoId));
                    const studentName = hf ? ((hf.alunoId && (hf.alunoId as any).nome) || '') : '';
                    const horarioText = hf ? `${(hf as any).horarioInicio || ''}${(hf as any).horarioFim ? ` – ${(hf as any).horarioFim}` : ''}` : '';
                    const initials = studentName ? studentName.split(' ').map((s:any)=>s[0]).slice(0,2).join('').toUpperCase() : '—';
                    return (
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium text-gray-700">{initials}</div>
                        <div className="flex-1">
                          <div className="text-lg font-semibold leading-tight">{studentName || 'Aluno'}</div>
                          <div className="text-sm text-gray-500 mt-0.5">
                            {/* Removed redundant 'Reagendando horário' line as requested. */}
                            {/* Highlighted summary: original -> target */}
                            {(() => {
                              // original start/end from the fixed horario (hf), original date from form.dataOriginal
                              const origStart = (hf && (hf as any).horarioInicio) || '';
                              const origEnd = (hf && (hf as any).horarioFim) || '';
                              const origDate = parseDateOnlyToLocal(form.dataOriginal) || null;
                              const origWeek = origDate ? diasSemana[origDate.getDay()] : '';
                              const formatShort = (d: Date | null) => {
                                if (!d) return '';
                                const dd = String(d.getDate()).padStart(2,'0');
                                const mm = String(d.getMonth() + 1).padStart(2,'0');
                                const yy = String(d.getFullYear()).slice(-2);
                                return `${dd}/${mm}/${yy}`;
                              };
                              const origShort = formatShort(origDate);

                              // target (destination) from form.novaData and form.novoHorarioInicio/Final
                              const targetStart = form.novoHorarioInicio || '';
                              const targetEnd = form.novoHorarioFim || '';
                              const targetDateObj = parseDateOnlyToLocal(form.novaData) || null;
                              const targetWeek = targetDateObj ? diasSemana[targetDateObj.getDay()] : '';
                              const targetShort = formatShort(targetDateObj);

                              // If we don't have meaningful values, don't render an empty block
                              if ((!origStart && !origEnd && !origShort) && (!targetStart && !targetEnd && !targetShort)) return null;

                              return (
                                <div className="mt-3 p-3 bg-white border rounded shadow-sm">
                                  <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-4">
                                    <div>
                                      <div className="text-xs text-gray-500">De</div>
                                      <div className="mt-1">
                                        <div className="text-sm font-semibold text-gray-800">{origStart}{origEnd ? ` – ${origEnd}` : ''}</div>
                                        <div className="text-xs text-gray-500">{origWeek ? `${origWeek}, ` : ''}{origShort}</div>
                                      </div>
                                    </div>

                                    <div className="flex justify-center">
                                      <i className="fas fa-exchange-alt text-lg text-primary-600" aria-hidden="true" />
                                    </div>

                                    <div>
                                      <div className="text-xs text-gray-500">Para</div>
                                      <div className="mt-1">
                                        { (targetStart || targetEnd || targetShort) ? (
                                          <>
                                            <div className="text-sm font-semibold text-gray-800">{targetStart}{targetEnd ? ` – ${targetEnd}` : ''}</div>
                                            <div className="text-xs text-gray-500">{targetWeek ? `${targetWeek}, ` : ''}{targetShort}</div>
                                          </>
                                        ) : (
                                          <div className="text-sm text-gray-400 italic">Nenhum horário selecionado</div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                        <input type="hidden" value={form.horarioFixoId} />
                      </div>
                    );
                  })()}
                </div>
                {/* If there are precomputed groups/slots for the current month, present them as selectable options.
                    This prevents users from choosing arbitrary dates/times and guides them to actual turma slots. */}
                {allGroupsInMonth && allGroupsInMonth.length > 0 ? (
                  <div>
                    <label className="block text-sm">Escolha uma data com turmas disponíveis (próximos 30 dias)</label>
                    <div className="mt-2">
                      {/* compute unique dates within next 30 days */}
                      {(() => {
                        // Build available dates by scanning the 30-day window starting
                        // from the reagendada date (`form.dataOriginal`) or today. We
                        // normalize the chosen start to local midnight (year,month,day)
                        // to avoid timezone/UTC shifting when comparing date-only strings.
                        const start = (() => {
                          try {
                            if (form.dataOriginal) {
                              const parsed = (typeof parseDateOnlyToLocal === 'function') ? parseDateOnlyToLocal(form.dataOriginal) : new Date(form.dataOriginal);
                              if (parsed && !isNaN((parsed as Date).getTime())) {
                                return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
                              }
                            }
                          } catch (e) { /* fallback to today */ }
                          const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate());
                        })();
                        const end = new Date(start);
                        end.setDate(start.getDate() + 30);
                        const datesSet = new Set<string>();
                        for (let dIter = new Date(start); dIter <= end; dIter.setDate(dIter.getDate() + 1)) {
                          try {
                            // Make a fresh Date instance for horariosForDate
                            const checkDate = new Date(dIter.getFullYear(), dIter.getMonth(), dIter.getDate());
                            const { fixed: fForDate, reagend: rForDate } = horariosForDate(checkDate);
                            if ((fForDate && fForDate.length > 0) || (rForDate && rForDate.length > 0)) {
                              datesSet.add(checkDate.toISOString().slice(0,10));
                            }
                          } catch (e) { /* ignore per-day errors */ }
                        }
                          const availableDates = Array.from(datesSet).sort();
                          // client-side pagination variables (page size = 3)
                          const pageSize = 3;
                          const totalPages = Math.max(1, Math.ceil(availableDates.length / pageSize));
                          // track page in component state via datePageIndex (defined near top)
                          const startIdx = datePageIndex * pageSize;
                          const paged = availableDates.slice(startIdx, startIdx + pageSize);
                          return (
                            <>
                              <div className="flex items-center justify-between mb-2">
                                <div className="text-sm text-gray-600">Mostrando {Math.min(availableDates.length, startIdx + 1)}-{Math.min(availableDates.length, startIdx + pageSize)} de {availableDates.length} dias</div>
                                <div className="flex items-center gap-2">
                                  <button type="button" onClick={() => setDatePageIndex(Math.max(0, datePageIndex - 1))} disabled={datePageIndex <= 0} className="px-2 py-1 border rounded disabled:opacity-50" aria-label="Anterior"><i className="fas fa-chevron-left" aria-hidden="true" /></button>
                                  <button type="button" onClick={() => setDatePageIndex(Math.min(totalPages - 1, datePageIndex + 1))} disabled={datePageIndex >= totalPages - 1} className="px-2 py-1 border rounded disabled:opacity-50" aria-label="Próxima"><i className="fas fa-chevron-right" aria-hidden="true" /></button>
                                </div>
                              </div>
                              <div className="grid grid-cols-1 gap-2">
                                {paged.map(d => {
                                const isOpen = selectedAvailableDate === d;
                                // compute if this paged date equals the original date being rescheduled (form.dataOriginal)
                                const isOriginalCard = (() => {
                                  try {
                                    if (!form.dataOriginal) return false;
                                    const parsedOrig = parseDateOnlyToLocal(form.dataOriginal) || new Date(form.dataOriginal);
                                    const parsed = parseDateOnlyToLocal(d) || new Date(d);
                                    return parsed.getFullYear() === parsedOrig.getFullYear() && parsed.getMonth() === parsedOrig.getMonth() && parsed.getDate() === parsedOrig.getDate();
                                  } catch (e) { return false; }
                                })();
                                const groupsForDate = allGroupsInMonth.filter((g:any) => g.date === d);
                                // compute available vagas for the date by summing (capacity - occupied) for each group
                                const vagasForDate = groupsForDate.reduce((acc: number, g: any) => {
                                  try {
                                    // determine capacity for this group: prefer modalidade.limiteAlunos if available
                                    let capacity: number | undefined = undefined;
                                    try {
                                      const candidate = (g.items || []).find((it: any) => (it && ((it.modalidadeId && ((it.modalidadeId as any)._id || it.modalidadeId)) || (it.horarioFixoId && it.horarioFixoId.modalidadeId))));
                                      let mid: any = null;
                                      if (candidate) {
                                        if (candidate.modalidadeId) mid = (candidate.modalidadeId && (candidate.modalidadeId._id || candidate.modalidadeId)) || candidate.modalidadeId;
                                        else if (candidate.horarioFixoId && candidate.horarioFixoId.modalidadeId) mid = (candidate.horarioFixoId.modalidadeId && (candidate.horarioFixoId.modalidadeId._id || candidate.horarioFixoId.modalidadeId)) || candidate.horarioFixoId.modalidadeId;
                                      }
                                      if (mid) {
                                        const mod = modalidades.find(m => String((m as any)._id || (m as any).id) === String(mid));
                                        if (mod && typeof (mod as any).limiteAlunos === 'number') capacity = (mod as any).limiteAlunos;
                                      }
                                    } catch (e) { /* ignore capacity lookup errors */ }

                                    // fallback default capacity if not found
                                    if (capacity === undefined) capacity = 5;

                                    // count occupied seats for this group (exclude emEspera and students rescheduled away)
                                    const occupied = (g.items || []).filter((f: any) => {
                                      try {
                                        const obsRaw = String((f as any).observacoes || '');
                                        const docEmEspera = (f as any).emEspera === true;
                                        const local = localFlags[(f as any)._id] || {};
                                        const isEmEspera = docEmEspera || local.emEspera === true || obsRaw.includes('[EM_ESPERA]');
                                        const dateKeyLocal = d;
                                        const rescheduledAwayLocal = (reagendamentos || []).some((r: any) => {
                                          try { const hfRef = r.horarioFixoId && (r.horarioFixoId._id || r.horarioFixoId); const original = (r.dataOriginal && String(r.dataOriginal).slice(0,10)) || ''; return hfRef && String(hfRef) === String(f._id) && original === dateKeyLocal; } catch(e) { return false; }
                                        });
                                        return !isEmEspera && !rescheduledAwayLocal;
                                      } catch (e) { return true; }
                                    }).length;

                                    const vagas = Math.max(0, (capacity || 0) - occupied);
                                    return acc + vagas;
                                  } catch (e) { return acc; }
                                }, 0);

                                return (
                                  <div key={`card-${d}`} className={`border rounded ${vagasForDate === 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-100 border-emerald-200'}`}>
                                    <button type="button" onClick={() => setSelectedAvailableDate(isOpen ? '' : d)} className="w-full px-3 py-2 flex items-center justify-between">
                                      <div className="flex items-center gap-3">
                                              <div className="font-semibold text-sm flex items-center gap-2">
                                                <i className="fas fa-calendar-alt text-gray-500" aria-hidden="true" />
                                                <span>{(parseDateOnlyToLocal(d) || new Date(d)).toLocaleDateString('pt-BR')}</span>
                                                {isOriginalCard ? (<span className="inline-block text-[10px] bg-primary-600 text-white px-2 py-0.5 rounded">Atual</span>) : null}
                                              </div>
                                              <div className="text-xs text-gray-500 flex items-center gap-2">
                                                <i className="fas fa-user-friends text-gray-500" aria-hidden="true" />
                                                <span>{vagasForDate} vagas</span>
                                              </div>
                                      </div>
                                      <div className="text-sm text-gray-500">{isOpen ? '▾' : '▸'}</div>
                                    </button>
                                      {isOpen && (
                                      <div className="p-3 space-y-2 border-t max-h-40 overflow-auto">
                                        {groupsForDate.map((g: any, gi: number) => {
                                          const profIdForKey = (g.professorId || 'noprof');
                                          const selected = form.novaData === g.date && form.novoHorarioInicio === g.start && form.novoHorarioFim === g.end && String(form.novoHorarioProfessorId || '') === String(profIdForKey);

                                          // determine origin horario object for preventing selecting the same slot
                                          const originHorario = horarios.find(h => String((h as any)._id) === String(form.horarioFixoId));
                                          // Only consider this group the same-as-origin if the group's items include the exact origin horario id
                                          const groupContainsOrigin = !!(originHorario && (g.items || []).some((it: any) => String((it && (it._id || it)) || '') === String(originHorario._id)));
                                          const isSameAsOrigin = form.dataOriginal && String(form.dataOriginal).slice(0,10) === String(g.date) && groupContainsOrigin;

                                          // determine capacity for this group
                                          let capacity: number | undefined = undefined;
                                          try {
                                            const candidate = (g.items || []).find((it: any) => (it && ((it.modalidadeId && ((it.modalidadeId as any)._id || it.modalidadeId)) || (it.horarioFixoId && it.horarioFixoId.modalidadeId))));
                                            let mid: any = null;
                                            if (candidate) {
                                              if (candidate.modalidadeId) mid = (candidate.modalidadeId && (candidate.modalidadeId._id || candidate.modalidadeId)) || candidate.modalidadeId;
                                              else if (candidate.horarioFixoId && candidate.horarioFixoId.modalidadeId) mid = (candidate.horarioFixoId.modalidadeId && (candidate.horarioFixoId.modalidadeId._id || candidate.horarioFixoId.modalidadeId)) || candidate.horarioFixoId.modalidadeId;
                                            }
                                            if (mid) {
                                              const mod = modalidades.find(m => String((m as any)._id || (m as any).id) === String(mid));
                                              if (mod && typeof (mod as any).limiteAlunos === 'number') capacity = (mod as any).limiteAlunos;
                                            }
                                          } catch (e) { /* ignore */ }
                                          if (capacity === undefined) capacity = 5;

                                          // count occupied seats (exclude emEspera and rescheduled-away)
                                          const occupied = (g.items || []).filter((f: any) => {
                                            try {
                                              const obsRaw = String((f as any).observacoes || '');
                                              const docEmEspera = (f as any).emEspera === true;
                                              const local = localFlags[(f as any)._id] || {};
                                              const isEmEspera = docEmEspera || local.emEspera === true || obsRaw.includes('[EM_ESPERA]');
                                              const dateKeyLocal = g.date;
                                              const rescheduledAwayLocal = (reagendamentos || []).some((r: any) => {
                                                try { const hfRef = r.horarioFixoId && (r.horarioFixoId._id || r.horarioFixoId); const original = (r.dataOriginal && String(r.dataOriginal).slice(0,10)) || ''; return hfRef && String(hfRef) === String(f._id) && original === dateKeyLocal; } catch(e) { return false; }
                                              });
                                              return !isEmEspera && !rescheduledAwayLocal;
                                            } catch (e) { return true; }
                                          }).length;

                                          const vagas = Math.max(0, (capacity || 0) - occupied);

                                          const stateClasses = vagas === 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200';
                                          const textColor = vagas === 0 ? 'text-red-700' : 'text-emerald-700';

                                            return (
                                            <button key={`${g.key}-${gi}`} type="button" onClick={() => {
                                              if (isSameAsOrigin) return;
                                              // pick a real horarioFixo id from group items to use as novoHorarioFixoId
                                              const rep = (g.items || []).find((it: any) => it && it._id && !(String(it._id).startsWith('reag-')));
                                              // If no real horario exists for this group, prevent selection (we don't allow creating new turma)
                                              if (!rep) {
                                                // show a small alert to clarify why selection is disabled
                                                alert('Esta turma não representa uma turma existente para anexar o aluno. Escolha outra turma com um HorarioFixo real.');
                                                return;
                                              }
                                              const novoHorarioFixoId = String((rep as any)._id);
                                              setForm({ ...form, novaData: g.date, novoHorarioInicio: g.start, novoHorarioFim: g.end, novoHorarioProfessorId: profIdForKey, novoHorarioFixoId });
                                              setFormErrors(prev => { const c = { ...prev }; delete c.novaData; delete c.novoHorarioInicio; return c; });
                                            }} aria-pressed={selected} aria-disabled={isSameAsOrigin ? true : undefined} className={`w-full text-left px-3 py-2 rounded border flex items-center justify-between ${selected ? 'ring-2 ring-primary-500 bg-primary-50' : 'hover:bg-gray-50'} ${stateClasses} ${isSameAsOrigin ? 'opacity-60 cursor-not-allowed' : ''}`}>
                                              <div className="truncate">
                                                      <div className={`font-medium ${textColor} flex items-center gap-2`}>
                                                        <i className="fas fa-clock text-gray-500" aria-hidden="true" />
                                                        {/* show subtle badge 'Atual' for the original horario date */}
                                                        {groupContainsOrigin ? (<span className="inline-block text-[10px] bg-primary-100 text-primary-800 px-1 py-0.5 rounded mr-1">Atual</span>) : null}
                                                        <span>{g.start}{g.end ? ` – ${g.end}` : ''}</span>
                                                      </div>
                                                <div className="text-xs text-gray-500 truncate">{g.professorNome ? 'Personal ' + g.professorNome : '—'}</div>
                                              </div>
                                              <div className={`ml-2 text-sm font-medium ${textColor}`}>{occupied}/{capacity}</div>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                            
                          </>
                        );
                      })()}
                    </div>
                    {formErrors.novaData ? <div className="text-xs text-red-600 mt-1">{formErrors.novaData}</div> : null}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm">Nova data</label>
                      <input type="date" value={form.novaData} onChange={e => {
                        const v = e.target.value;
                        setForm({...form, novaData: v});
                        // validate against modalidade availability
                        const hf = horarios.find(h => String((h as any)._id) === String(form.horarioFixoId));
                        const hfModalidadeId = hf ? ( (hf.modalidadeId && ((hf.modalidadeId as any)._id || (hf.modalidadeId as any).id)) || hf.modalidadeId ) : null;
                        const mod = hfModalidadeId ? modalidades.find(m => String((m as any)._id || (m as any).id) === String(hfModalidadeId)) : null;
                        if (v && mod) {
                          const dow = new Date(v).getDay();
                          if (!modalidadeAllowsDayForModalidade(mod, dow)) {
                            setFormErrors(prev => ({...prev, novaData: 'A modalidade não tem aulas neste dia da semana.'}));
                          } else {
                            setFormErrors(prev => { const copy = {...prev}; delete copy.novaData; return copy; });
                          }
                        }
                      }} className="w-full border rounded px-2 py-1" />
                      {formErrors.novaData ? <div className="text-xs text-red-600 mt-1">{formErrors.novaData}</div> : null}
                    </div>
                    <div>
                      <label className="block text-sm">Novo horário início</label>
                      {(() => {
                        const hf = horarios.find(h => String((h as any)._id) === String(form.horarioFixoId));
                        const hfModalidadeId = hf ? ( (hf.modalidadeId && ((hf.modalidadeId as any)._id || (hf.modalidadeId as any).id)) || hf.modalidadeId ) : null;
                        const mod = hfModalidadeId ? modalidades.find(m => String((m as any)._id || (m as any).id) === String(hfModalidadeId)) : null;
                        const dow = form.novaData ? new Date(form.novaData).getDay() : null;
                        const mm = (mod && dow !== null) ? getModalidadeMinMax(mod, dow) : { min: undefined, max: undefined };
                        return (
                          <input
                            type="time"
                            step={1800}
                            min={mm.min}
                            max={mm.max}
                            value={form.novoHorarioInicio}
                            onChange={e => {
                              const v = e.target.value;
                              const novoFim = addMinutesToTime(v, durationMinutes || 60);
                              setForm({ ...form, novoHorarioInicio: v, novoHorarioFim: novoFim });
                              // validate time against modalidade
                              const hf2 = horarios.find(h => String((h as any)._id) === String(form.horarioFixoId));
                              const mod2 = hf2 ? modalidades.find(m => String((m as any)._id || (m as any).id) === String(hf2.modalidadeId)) : null;
                              if (mod2 && form.novaData) {
                                const dow2 = new Date(form.novaData).getDay();
                                if (!modalidadeAllowsTime(mod2, dow2, v, novoFim)) {
                                  setFormErrors(prev => ({ ...prev, novoHorarioInicio: 'Horário fora dos horários disponíveis da modalidade.' }));
                                } else {
                                  setFormErrors(prev => { const copy = { ...prev }; delete copy.novoHorarioInicio; return copy; });
                                }
                              }
                            }}
                            className="w-full border rounded px-2 py-1"
                          />
                        );
                      })()}
                      {formErrors.novoHorarioInicio ? <div className="text-xs text-red-600 mt-1">{formErrors.novoHorarioInicio}</div> : null}
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-sm">Motivo</label>
                  <textarea value={form.motivo} onChange={e => setForm({...form, motivo: e.target.value})} className="w-full border rounded px-2 py-1" />
                </div>
                <div className="flex justify-end gap-2">
                                <button type="button" onClick={() => { setShowModal(false); setShowGroupModal(true); }} className="px-4 py-2 border rounded hover:bg-gray-50">Voltar</button>
                                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded hover:bg-gray-50">Cancelar</button>
                  <button type="submit" disabled={!(form.novaData && form.novoHorarioInicio && form.novoHorarioFixoId)} className={`px-4 py-2 rounded shadow ${form.novaData && form.novoHorarioInicio && form.novoHorarioFixoId ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}>Salvar</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showStudentDetailModal && selectedStudentHorario && (
          <StudentDetailModal isOpen={showStudentDetailModal} onClose={() => setShowStudentDetailModal(false)} horario={selectedStudentHorario} modalidades={modalidades} horarios={horarios} onRefresh={fetchData} />
        )}

        {showGroupModal && selectedGroup && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 z-50 flex items-start justify-center pt-24">
            {/* use flex-col so header stays fixed and only the content scrolls */}
            <div className="bg-white p-6 rounded shadow w-[520px] max-h-[70vh] flex flex-col">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    {(() => {
                      const d = selectedGroup && selectedGroup.date ? parseDateOnlyToLocal(selectedGroup.date) : null;
                      const weekday = d ? diasSemana[d.getDay()] : '';
                      const dateFormatted = d ? d.toLocaleDateString('pt-BR') : '';
                      return (
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                          <i className="fas fa-calendar-alt w-4 text-gray-600" aria-hidden="true" />
                          {`Turma das ${selectedGroup.start}${selectedGroup.end ? ` – ${selectedGroup.end}` : ''} (${weekday ? `${weekday}, ` : ''}${dateFormatted})`}
                        </h3>
                      );
                    })()}
                  </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-50 border text-sm text-gray-700">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A9 9 0 1118.879 6.196 9 9 0 015.12 17.804z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span className="font-medium">{selectedGroup.professorNome ? 'Personal ' + selectedGroup.professorNome : '—'}</span>
                        </div>

                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-50 border text-sm text-gray-700">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-4-4h-1" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20H4v-2a4 4 0 014-4h1" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 12a4 4 0 100-8 4 4 0 000 8z" />
                        </svg>
                        <span className="font-medium">{(selectedGroup.items || []).length} alunos</span>
                      </div>
                    </div>
                </div>

                <div className="flex-shrink-0">
                  <button onClick={() => setShowGroupModal(false)} className="inline-flex items-center justify-center h-9 w-9 rounded-lg text-slate-600 hover:bg-gray-100" aria-label="Fechar">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="mt-4 border-t pt-4 space-y-2 overflow-auto max-h-[50vh]">
                {(() => {
                  const extractProfId = (rawProf: any) => {
                    if (!rawProf) return null;
                    if (typeof rawProf === 'string') return String(rawProf);
                    if ((rawProf as any)._id) return String((rawProf as any)._id);
                    return String(rawProf);
                  };
                  const selProfId = extractProfId((selectedGroup as any).professorId);
                  const itemsToShow = (selectedGroup.items || []).filter((it: any) => {
                    try {
                      const raw = (it as any).professorId || ((it as any).horarioFixoId && (it as any).horarioFixoId.professorId) || null;
                      const pid = extractProfId(raw);
                      if (selProfId == null) return pid == null;
                      return pid != null && String(pid) === String(selProfId);
                    } catch (e) { return false; }
                  });
                  const groupReagsAll = (selectedGroup && (selectedGroup as any).reagendamentos) || [];
                  const groupReags = groupReagsAll.filter((r: any) => {
                    try {
                      const raw = (r.horarioFixoId && ((r.horarioFixoId as any).professorId)) || (r.professorId || null);
                      const pid = extractProfId(raw);
                      if (selProfId == null) return pid == null;
                      return pid != null && String(pid) === String(selProfId);
                    } catch (e) { return false; }
                  });
                  return (
                    <>
                      {itemsToShow.map((f: any) => {
                        const obsRaw = String((f as any).observacoes || '');
                        const obs = obsRaw.replace(/\[CONGELADO\]|\[AUSENTE\]|\[EM_ESPERA\]/g, '').trim();
                        const docCongelado = (f as any).congelado === true;
                        const docAusente = (f as any).ausente === true;
                        const docEmEspera = (f as any).emEspera === true;
                        const local = localFlags[(f as any)._id] || {};
                        const isCongelado = docCongelado || local.congelado === true || obsRaw.includes('[CONGELADO]');
                        const isAusente = docAusente || local.ausente === true || obsRaw.includes('[AUSENTE]');
                        const isEmEspera = docEmEspera || local.emEspera === true || obsRaw.includes('[EM_ESPERA]');
                        const alunoNome = (f.alunoId && (f.alunoId as any).nome) || '—';
                        const matchedReagById = groupReags.find((r: any) => {
                          try {
                            const hfRef = r.horarioFixoId && (r.horarioFixoId._id || r.horarioFixoId);
                            if (f && (f as any).__isReagendamento) {
                              return String((f as any).reagendamentoId) === String(r._id);
                            }
                            return String(hfRef) === String(f._id);
                          } catch (e) { return false; }
                        });
                        const isReagItem = Boolean(matchedReagById) || Boolean((f as any).__isReagendamento);
                        const dateKeyLocal = (selectedGroup && (selectedGroup as any).date) || ((selectedGroup && (selectedGroup as any).dateObj) ? (function(){ const dd = parseDateOnlyToLocal(((selectedGroup as any).dateObj && (selectedGroup as any).dateObj.toISOString && (selectedGroup as any).dateObj.toISOString().slice(0,10)) || String((selectedGroup as any).dateObj)); const iso = dd ? dd.toISOString().slice(0,10) : ((selectedGroup as any).dateObj && (selectedGroup as any).dateObj.toISOString && (selectedGroup as any).dateObj.toISOString().slice(0,10)) || ''; return iso; })() : '');
                        const rescheduledAwayForItem = (!(f as any).__isReagendamento) && (reagendamentos || []).some((r: any) => {
                          try { const hfRef = r.horarioFixoId && (r.horarioFixoId._id || r.horarioFixoId); const original = (r.dataOriginal && String(r.dataOriginal).slice(0,10)) || ''; return hfRef && String(hfRef) === String(f._id) && original === dateKeyLocal; } catch(e){ return false; }
                        });
                        const effectiveIsReag = isReagItem || rescheduledAwayForItem;
                        const rowClass = `flex items-center justify-between bg-white border border-gray-100 rounded p-3 ${effectiveIsReag ? 'bg-yellow-50 border-yellow-200' : ''}`;
                        return (
                          <div key={String(f._id)} className={rowClass}>
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 text-sm font-medium text-gray-700">{alunoNome.split(' ').map((s:any)=>s[0]).slice(0,2).join('').toUpperCase()}</div>
                              <div>
                                <button onClick={() => {
                                  const enriched = { ...f, professorNome: selectedGroup.professorNome };
                                  setSelectedStudentHorario(enriched);
                                  setModalEditName((enriched.alunoId && (enriched.alunoId as any).nome) || enriched.nome || '');
                                  setModalEditObservacoes(String(enriched.observacoes || ''));
                                  setModalEditing(false);
                                  setShowStudentDetailModal(true);
                                  setShowGroupModal(false);
                                }} className="text-left font-medium hover:underline">{alunoNome}</button>
                                { matchedReagById ? (
                                  <div className="text-xs text-yellow-800 mt-1 flex items-center gap-2">
                                    <span>Reagendado para {(parseDateOnlyToLocal(matchedReagById.novaData) || new Date(matchedReagById.novaData)).toLocaleDateString('pt-BR')} • {matchedReagById.novoHorarioInicio}{matchedReagById.novoHorarioFim ? ` – ${matchedReagById.novoHorarioFim}` : ''}</span>
                                    <button onClick={() => {
                                      try {
                                        const nd = (matchedReagById.novaData || '').slice(0,10);
                                        const start = matchedReagById.novoHorarioInicio || '';
                                        const end = matchedReagById.novoHorarioFim || '';
                                        setShowGroupModal(false);
                                        setPendingNavigate({ originalDate: nd, horarioInicio: start, horarioFim: end, professorId: null });
                                      } catch(e) { console.error(e); }
                                    }} className="text-xs text-primary-600 hover:underline">Ir para turma</button>
                                  </div>
                                ) : ( effectiveIsReag ? <div className="text-xs text-yellow-800 mt-1">Reagendado</div> : null )}
                                { obs ? <div className="text-xs text-gray-600 mt-1">{obs}</div> : null }
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2">
                                {isCongelado && <span className="text-sky-500 text-xs">⛄</span>}
                                {isAusente && <span className="text-rose-500 text-xs">⏰</span>}
                                {isEmEspera && <span className="text-yellow-600 text-xs">⌛</span>}
                              </div>
                              <div className="flex items-center gap-2">
                                {!isReagItem && (
                                  <button onClick={() => { try { setShowGroupModal(false); handleOpenModalForHorario(String((f as any)._id), (selectedGroup && (selectedGroup as any).date) || ''); } catch(e) {} }} className="text-xs text-primary-600 hover:underline" title="Reagendar">Reagendar</button>
                                )}
                                { isReagItem ? (
                                  <>
                                    <button onClick={() => { try { const rid = (matchedReagById || (f as any).reagendamentoId); if (rid) { cancelReagendamento(rid); } } catch(e) { console.error(e); } }} className="text-xs text-red-600 hover:underline">Cancelar</button>
                                  </>
                                ) : null }
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {groupReags.length > 0 && (
                        <div className="mt-4">
                          <h4 className="text-sm font-semibold mb-2">Reagendamentos desta turma</h4>
                          <div className="space-y-2">
                            {groupReags.map((r: any) => (
                                <div key={String(r._id)} className="p-2 border rounded bg-yellow-50">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <div className="text-sm font-medium">{r.horarioFixoId?.alunoId?.nome || 'Reagendamento'}</div>
                                      <div className="text-xs text-gray-600 flex items-center gap-2">
                                        <i className="fas fa-calendar-alt w-3 text-gray-500" aria-hidden="true" />
                                        <span>Destino: {(parseDateOnlyToLocal(r.novaData) || new Date(r.novaData)).toLocaleDateString('pt-BR')} • {r.novoHorarioInicio}{r.novoHorarioFim ? ` – ${r.novoHorarioFim}` : ''}</span>
                                      </div>
                                      {r.dataOriginal ? (
                                        <div className="text-xs text-gray-700 mt-1 flex items-center gap-2">
                                          <i className="fas fa-calendar-alt w-3 text-gray-500" aria-hidden="true" />
                                          <span>Origem: { (parseDateOnlyToLocal(r.dataOriginal) || new Date(r.dataOriginal)).toLocaleDateString('pt-BR') } • {r.horarioOriginal || r.horarioFixoOriginal || r.horarioFixoHora || '—'}</span>
                                        </div>
                                      ) : null}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button onClick={() => cancelReagendamento(r._id)} className="text-xs text-red-600 hover:underline">Cancelar</button>
                                      <button onClick={() => {
                                        try {
                                          setForm({ horarioFixoId: String(r.horarioFixoId && (r.horarioFixoId._id || r.horarioFixoId)), dataOriginal: r.dataOriginal || '', novaData: r.novaData ? r.novaData.slice(0,10) : '', novoHorarioInicio: r.novoHorarioInicio || '', novoHorarioFim: r.novoHorarioFim || '', novoHorarioProfessorId: '', novoHorarioFixoId: '', motivo: r.motivo || '' });
                                          setFormErrors({});
                                          setShowModal(true);
                                          setShowGroupModal(false);
                                        } catch (e) { console.error(e); }
                                      }} className="text-xs text-primary-600 hover:underline">Editar</button>
                                      {/* Button to navigate to the destination turma */}
                                      <button onClick={() => {
                                        try {
                                          // navigate to novaData and horarioInicio of this reagendamento
                                          const nd = (r.novaData || '').slice(0,10);
                                          const start = r.novoHorarioInicio || '';
                                          const end = r.novoHorarioFim || '';
                                          // clear group modal and set pending navigation to destination
                                          setShowGroupModal(false);
                                          setPendingNavigate({ originalDate: nd, horarioInicio: start, horarioFim: end, professorId: null });
                                        } catch (e) { console.error(e); }
                                      }} className="text-xs text-primary-600 hover:underline">Ir para destino</button>
                                    </div>
                                  </div>
                                </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

      </div>
    </Layout>
    </RequireAuth>
  );
}
