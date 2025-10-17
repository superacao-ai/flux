'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Layout from '@/components/Layout';

interface Aluno {
  _id: string;
  nome: string;
  email: string;
  modalidadeId: {
    _id: string;
    nome: string;
    cor: string;
  };
}

interface Professor {
  _id: string;
  nome: string;
  especialidade: string;
}

interface Modalidade {
  _id: string;
  nome: string;
  cor: string;
  duracao: number;
  limiteAlunos: number;
  horarioFuncionamento?: {
    inicio?: string | null;
    fim?: string | null;
  };
}

interface HorarioFixo {
  _id: string;
  alunoId: Aluno;
  professorId: Professor;
  diaSemana: number;
  horarioInicio: string;
  horarioFim: string;
  observacoes?: string;
  ativo: boolean;
}

export default function HorariosPage() {
  // --- Utilities: normalization and similarity (Levenshtein ratio) ---
  const normalize = (s: string) => {
    try {
      return String(s || '').trim().toUpperCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
    } catch (e) {
      // If Unicode property escapes aren't supported, fallback to simple uppercase trim
      return String(s || '').trim().toUpperCase();
    }
  };

  const levenshtein = (a: string, b: string) => {
    const A = String(a || '');
    const B = String(b || '');
    const m = A.length;
    const n = B.length;
    if (m === 0) return n;
    if (n === 0) return m;
    const v0 = new Array(n + 1).fill(0);
    const v1 = new Array(n + 1).fill(0);
    for (let j = 0; j <= n; j++) v0[j] = j;
    for (let i = 0; i < m; i++) {
      v1[0] = i + 1;
      for (let j = 0; j < n; j++) {
        const cost = A[i] === B[j] ? 0 : 1;
        v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
      }
      for (let j = 0; j <= n; j++) v0[j] = v1[j];
    }
    return v1[n];
  };

  const similarityRatio = (s1: string, s2: string) => {
    const a = normalize(s1);
    const b = normalize(s2);
    if (!a && !b) return 1;
    const dist = levenshtein(a, b);
    const maxLen = Math.max(a.length, b.length) || 1;
    return 1 - dist / maxLen;
  };

  const findBestAlunoMatch = (name: string) => {
    const nameNorm = normalize(name);
    let best: { aluno?: Aluno; score: number } = { aluno: undefined, score: 0 };
    for (const a of alunos) {
      const score = similarityRatio(nameNorm, String(a.nome || ''));
      if (score > best.score) best = { aluno: a, score };
    }
    return best;
  };

  const [horarios, setHorarios] = useState<HorarioFixo[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [modalidades, setModalidades] = useState<Modalidade[]>([]);
  const [modalidadeSelecionada, setModalidadeSelecionada] = useState<string>(() => {
    try {
      if (typeof window !== 'undefined') {
        return localStorage.getItem('modalidadeSelecionada') || '';
      }
    } catch (e) {
      // ignore
    }
    return '';
  });
  const [showModal, setShowModal] = useState(false);
  const [editingMode, setEditingMode] = useState<'create' | 'single' | 'turma'>('create');
  const [editingMemberIds, setEditingMemberIds] = useState<string[] | null>(null);
  const [selectedHorarioId, setSelectedHorarioId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    alunoId: '',
    professorId: '',
    diaSemana: 1,
    horarioInicio: '',
    horarioFim: '',
    observacoes: '',
    observacaoTurma: '',
    modalidadeId: ''
  });
  const [loading, setLoading] = useState(false);
  const [bulkAlunoText, setBulkAlunoText] = useState('');
  const [showAddAlunoModal, setShowAddAlunoModal] = useState(false);
  const [showAddSingleAlunoModal, setShowAddSingleAlunoModal] = useState(false);
  const [singleAlunoSearch, setSingleAlunoSearch] = useState('');
  const [singleAlunoSelectedId, setSingleAlunoSelectedId] = useState<string | null>(null);
  const [singleAlunoName, setSingleAlunoName] = useState('');
  const [singleAlunoObservacoes, setSingleAlunoObservacoes] = useState('');
  const [singleAddMode, setSingleAddMode] = useState<'select' | 'create'>('select');
  const [showStudentDetailModal, setShowStudentDetailModal] = useState(false);
  const [selectedStudentHorario, setSelectedStudentHorario] = useState<any | null>(null);
  const [modalEditing, setModalEditing] = useState<boolean>(false);
  const [modalEditName, setModalEditName] = useState<string>('');
  const [modalEditObservacoes, setModalEditObservacoes] = useState<string>('');
  
  // Initialize modal edit fields when selection changes (top-level to respect Hooks rules)
  useEffect(() => {
    if (!selectedStudentHorario) return;
    const alunoName = selectedStudentHorario.alunoId?.nome || selectedStudentHorario.aluno?.nome || selectedStudentHorario.nome || '';
    setModalEditName(alunoName);
    setModalEditObservacoes(String(selectedStudentHorario.observacoes || ''));
    setModalEditing(false);
  }, [selectedStudentHorario]);
  
  const [novoHorarioAlunosText, setNovoHorarioAlunosText] = useState('');
  const [addAlunoTurma, setAddAlunoTurma] = useState<{professorId?: string, diaSemana?: number, horarioInicio?: string, horarioFim?: string} | null>(null);
  const [bulkAlunoTextAdd, setBulkAlunoTextAdd] = useState('');
  // parsed entries for the per-turma bulk add modal
  const [bulkImportEntries, setBulkImportEntries] = useState<Array<{ id: string; name: string; obs?: string; selected: boolean; alunoId?: string }>>([]);
  const [bulkAllowCreateNew, setBulkAllowCreateNew] = useState(false);

  // parse bulkAlunoTextAdd into bulkImportEntries when modal opens or text changes
  useEffect(() => {
    if (!showAddAlunoModal) return;
    const lines = String(bulkAlunoTextAdd || '').split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    const parsed = lines.map((ln, idx) => {
      // support optional 'NAME | OBS' format
      const parts = ln.split('|');
      const name = String(parts[0] || '').trim();
      const obs = parts.slice(1).join('|').trim();
      const found = alunos.find(a => String(a.nome || '').trim().toLowerCase() === name.toLowerCase());
      return { id: `bulk-${idx}-${Math.random().toString(36).slice(2,8)}`, name, obs, selected: true, alunoId: found ? found._id : undefined };
    });
    setBulkImportEntries(parsed);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAddAlunoModal, bulkAlunoTextAdd]);
  // Estado para modal de lote
  const [showModalLote, setShowModalLote] = useState<{open: boolean, turma?: any, diaSemana?: number, horarioInicio?: string, horarioFim?: string}>({open: false});
  const [alunosSelecionadosLote, setAlunosSelecionadosLote] = useState<string[]>([]);
  // Estado para importação em lote (colar nomes)
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [importProfessorId, setImportProfessorId] = useState<string>('');
  const [importModalidadeId, setImportModalidadeId] = useState<string>('');
  const [importDiaSemana, setImportDiaSemana] = useState<number>(1);
  const [importHorarioInicio, setImportHorarioInicio] = useState<string>('');
  const [importHorarioFim, setImportHorarioFim] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<{successes: number, failures: Array<{name:string, reason:string}>} | null>(null);
  // parsed entries for import modal: allow selecting which lines to import and mapping to existing alunos
  const [importEntries, setImportEntries] = useState<Array<{ id: string; name: string; selected: boolean; alunoId?: string }>>([]);

  // parse importText into importEntries when text changes or modal opens
  useEffect(() => {
    if (!showImportModal) return;
    const lines = String(importText || '').split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    const parsed = lines.map((ln, idx) => {
      // try to find an exact aluno match
      const found = alunos.find(a => String(a.nome || '').trim().toLowerCase() === ln.trim().toLowerCase());
      return { id: `entry-${idx}-${Math.random().toString(36).slice(2,8)}`, name: ln, selected: true, alunoId: found ? found._id : undefined };
    });
    setImportEntries(parsed);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showImportModal, importText]);
  const [mounted, setMounted] = useState(false);
  // local visual flags for quick toggles (not persisted) keyed by horarioId
  const [localFlags, setLocalFlags] = useState<Record<string, { congelado?: boolean; ausente?: boolean }>>({});
  // Confirmation dialog state for handling similar-aluno decisions
  const pendingAlunoResolve = useRef<((res: {action: 'use'|'create'|'skip'|'choose', alunoId?: string}) => void) | null>(null);
  const [confirmAlunoDialog, setConfirmAlunoDialog] = useState<null | { name: string; candidates: Array<{ aluno: Aluno; score: number }> }>(null);
  const getMid = (m: Modalidade) => (m && ((m as any).id || (m as any)._id)) || '';

  // Helper to pick readable text color (white/black) based on a hex color string
  const getContrastColor = (hex?: string) => {
    if (!hex) return '#000';
    try {
      const h = hex.replace('#', '').trim();
      if (h.length === 3) {
        const r = parseInt(h[0] + h[0], 16);
        const g = parseInt(h[1] + h[1], 16);
        const b = parseInt(h[2] + h[2], 16);
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        return lum < 140 ? '#fff' : '#000';
      }
      const r = parseInt(h.substring(0, 2), 16);
      const g = parseInt(h.substring(2, 4), 16);
      const b = parseInt(h.substring(4, 6), 16);
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      return lum < 140 ? '#fff' : '#000';
    } catch (e) {
      return '#000';
    }
  };
  // Horário de funcionamento (início/fim) - usados para filtrar linhas exibidas na grade
  const [openTime, setOpenTime] = useState<string>(() => {
    try {
      if (typeof window !== 'undefined') return localStorage.getItem('horarioOpen') || '06:00';
    } catch (e) {}
    return '06:00';
  });
  const [closeTime, setCloseTime] = useState<string>(() => {
    try {
      if (typeof window !== 'undefined') return localStorage.getItem('horarioClose') || '22:00';
    } catch (e) {}
    return '22:00';
  });

      // ...existing code...



  // ...existing code...




  const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  // Gerar horários de 30 em 30 minutos entre 00:00 e 23:30 (24 horas)
  const generateTimes = (start: string, end: string, stepMin: number) => {
    const times: string[] = [];
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let cur = new Date();
    cur.setHours(sh, sm, 0, 0);
    const endDate = new Date();
    endDate.setHours(eh, em, 0, 0);
    while (cur <= endDate) {
      const hh = String(cur.getHours()).padStart(2, '0');
      const mm = String(cur.getMinutes()).padStart(2, '0');
      times.push(`${hh}:${mm}`);
      cur = new Date(cur.getTime() + stepMin * 60 * 1000);
    }
    return times;
  };
  const horariosDisponiveis = generateTimes('00:00', '23:30', 30);

  const timeToMinutes = (t: string) => {
    const [hh, mm] = (t || '00:00').split(':').map(Number);
    return hh * 60 + mm;
  };

  const getVisibleHorarios = () => {
    try {
      const o = timeToMinutes(openTime);
      const c = timeToMinutes(closeTime);
      // If interval is invalid (open >= close) show full day
      if (o >= c) return horariosDisponiveis;
      return horariosDisponiveis.filter(h => {
        const m = timeToMinutes(h);
        return m >= o && m < c; // include slots that start within operating hours
      });
    } catch (e) {
      return horariosDisponiveis;
    }
  };

  // compute available days and times for the currently selected modalidade in the modal
  const getModalidadeAvailability = (modalidadeId?: string) => {
    const mid = modalidadeId || formData.modalidadeId || modalidadeSelecionada || '';
    if (!mid) return { days: diasSemana.map((_, i) => i), times: horariosDisponiveis };
    const mod = modalidades.find(m => getMid(m) === mid) as any;
    if (!mod) return { days: diasSemana.map((_, i) => i), times: horariosDisponiveis };
    // normalize diasSemana to 0..6 if needed
    let modDays: number[] = [];
    if (Array.isArray(mod.diasSemana) && mod.diasSemana.length > 0) {
      modDays = mod.diasSemana.map((d: number) => (d > 6 ? d - 1 : d));
    }
    // If modalidade defines horariosDisponiveis (array of {diasSemana, horaInicio, horaFim}), build times intersection
    if (Array.isArray(mod.horariosDisponiveis) && mod.horariosDisponiveis.length > 0) {
      // Collect times that belong to any matching horarioDisponivel entry
      const timesSet = new Set<string>();
      for (const hd of mod.horariosDisponiveis) {
        const hdDays = Array.isArray(hd.diasSemana) && hd.diasSemana.length > 0 ? hd.diasSemana.map((d:number)=> d>6? d-1: d) : (modDays.length>0 ? modDays : diasSemana.map((_,i)=>i));
        for (const d of hdDays) {
          // add all half-hour slots between horaInicio (inclusive) and horaFim (exclusive)
          const start = hd.horaInicio || hd.horaInicio || hd.hora_inicio || '';
          const end = hd.horaFim || hd.horaFim || hd.hora_fim || '';
          if (!start || !end) continue;
          const slots = generateTimes(start, end, 30);
          for (const s of slots) timesSet.add(s);
        }
      }
      const timesArr = Array.from(timesSet).sort((a,b)=> timeToMinutes(a)-timeToMinutes(b));
      return { days: (modDays.length>0 ? modDays : diasSemana.map((_,i)=>i)), times: timesArr.length>0 ? timesArr : horariosDisponiveis };
    }
    // fallback: if mod has horarioFuncionamento or no specific horariosDisponiveis, keep full times range
    return { days: (modDays.length>0 ? modDays : diasSemana.map((_,i)=>i)), times: horariosDisponiveis };
  };

  const visibleHorarios = getVisibleHorarios();

  useEffect(() => {
    fetchHorarios();
    fetchAlunos();
    fetchProfessores();
    fetchModalidades();
    setMounted(true);
  }, []);

  // Persist operating hours selection
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('horarioOpen', openTime || '06:00');
        localStorage.setItem('horarioClose', closeTime || '22:00');
      }
    } catch (e) {
      // ignore
    }
  }, [openTime, closeTime]);

  // Sync operating hours across tabs
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'horarioOpen' && e.newValue) setOpenTime(e.newValue);
      if (e.key === 'horarioClose' && e.newValue) setCloseTime(e.newValue);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Re-fetch horários when modalidadeSelecionada changes so server-side filtering applies
  useEffect(() => {
    if (modalidadeSelecionada !== undefined) {
      fetchHorarios();
    }
  }, [modalidadeSelecionada]);

  useEffect(() => {
    // If we have a saved modalidade in localStorage, prefer it (but verify it exists)
    if (modalidades.length > 0) {
      const exists = modalidades.find(m => getMid(m) === modalidadeSelecionada);
      if (!modalidadeSelecionada || !exists) {
        // try saved value from localStorage
        try {
          const saved = typeof window !== 'undefined' ? localStorage.getItem('modalidadeSelecionada') : null;
          if (saved && modalidades.find(m => getMid(m) === saved)) {
            setModalidadeSelecionada(saved);
            return;
          }
        } catch (e) {
          // ignore
        }
        setModalidadeSelecionada(getMid(modalidades[0]));
      }
    }
  }, [modalidades]);

  // When a modalidade is selected, if it defines horarioFuncionamento, apply it to the schedule
  useEffect(() => {
  if (!modalidadeSelecionada || modalidades.length === 0) return;
  const mod = modalidades.find(m => getMid(m) === modalidadeSelecionada);
    if (!mod) return;
    const hf = (mod as any).horarioFuncionamento || {};
    const candidates: string[] = [];
    if (hf.manha?.inicio) candidates.push(hf.manha.inicio);
    if (hf.manha?.fim) candidates.push(hf.manha.fim);
    if (hf.tarde?.inicio) candidates.push(hf.tarde.inicio);
    if (hf.tarde?.fim) candidates.push(hf.tarde.fim);
    if (candidates.length > 0) {
      try {
        const minutes = candidates.map((t: string) => timeToMinutes(t));
        const min = Math.min(...minutes);
        const max = Math.max(...minutes);
        const minutesToTime = (m: number) => `${String(Math.floor(m/60)).padStart(2, '0')}:${String(m%60).padStart(2, '0')}`;
        const start = minutesToTime(min);
        const end = minutesToTime(max);
        if (typeof window !== 'undefined') {
          setOpenTime(start);
          setCloseTime(end);
          localStorage.setItem('horarioOpen', start);
          localStorage.setItem('horarioClose', end);
        }
      } catch (e) {
        // ignore
      }
    }
  }, [modalidadeSelecionada, modalidades]);

  // Persist selection
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') localStorage.setItem('modalidadeSelecionada', modalidadeSelecionada || '');
    } catch (e) {
      // ignore
    }
  }, [modalidadeSelecionada]);

  // Sync modalidade selection across tabs (storage event)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'modalidadeSelecionada') {
        try {
          setModalidadeSelecionada(e.newValue || '');
        } catch (err) {
          // ignore
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const fetchHorarios = async () => {
    try {
      const url = modalidadeSelecionada ? `/api/horarios?modalidadeId=${modalidadeSelecionada}` : '/api/horarios';
      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        setHorarios(data.data);
        return data.data;
      }
    } catch (error) {
      console.error('Erro ao buscar horários:', error);
    }
    return null;
  };

  const fetchAlunos = async () => {
    try {
      const response = await fetch('/api/alunos');
      const data = await response.json();
      if (data.success) {
        setAlunos(data.data);
      }
    } catch (error) {
      console.error('Erro ao buscar alunos:', error);
    }
  };

  const fetchProfessores = async () => {
    try {
      const response = await fetch('/api/professores');
      const data = await response.json();
      if (data.success) {
        setProfessores(data.data);
      }
    } catch (error) {
      console.error('Erro ao buscar professores:', error);
    }
  };

  // Helper to open edit turma modal for a grouped turma object (avoid name clash)
  const openEditTurmaGroup = (turma: any) => {
    const rep = turma.alunos && turma.alunos[0];
    if (!rep) return;
  setEditingMode('turma');
  setEditingMemberIds(turma.alunos.map((m: any) => m._id));
  // Do not populate editable member names here — we no longer allow editing student names from the turma modal.
  setSelectedHorarioId(rep._id || null);
    setFormData({
      alunoId: '',
      professorId: typeof rep.professorId === 'string' ? rep.professorId : (rep.professorId?._id || ''),
      diaSemana: rep.diaSemana,
      horarioInicio: rep.horarioInicio,
      horarioFim: rep.horarioFim,
      observacoes: '',
      observacaoTurma: (turma as any).observacaoTurma || '',
      modalidadeId: ''
    });
    setShowModal(true);
  };

  // Helper to delete entire turma (array of member horarios)
  const handleDeleteTurma = async (turma: any) => {
    try {
      const memberIds = (turma.alunos || []).map((m: any) => m._id).filter(Boolean);
      if (memberIds.length === 0) return;
      const resp = await fetch('/api/horarios/turma', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberIds })
      });
      const data = await resp.json();
      if (data.success) fetchHorarios();
      else alert('Erro ao excluir turma: ' + (data.error || 'erro'));
    } catch (err) {
      console.error('Erro ao excluir turma:', err);
      alert('Erro ao excluir turma');
    }
  };

  // Helper to ask the user what to do when a potential existing aluno is found
  const askAlunoConfirmation = (name: string, candidates: Array<{ aluno: Aluno; score: number }>) => {
    return new Promise<{action: 'use'|'create'|'skip'|'choose', alunoId?: string}>(resolve => {
      pendingAlunoResolve.current = resolve;
      setConfirmAlunoDialog({ name, candidates });
    });
  };

  // Quando selecionar um professor no modal de importação, tentar definir automaticamente
  // a modalidade correspondente com base na primeira especialidade do professor.
  const handleImportProfessorChange = (professorId: string) => {
    setImportProfessorId(professorId);
    if (!professorId) {
      setImportModalidadeId('');
      return;
    }
    const prof = professores.find(p => (p as any)._id === professorId);
    if (!prof) {
      setImportModalidadeId('');
      return;
    }
    // professor.especialidades pode ser um array de objetos com 'nome'
    const esp = (prof as any).especialidades && (prof as any).especialidades.length > 0
      ? (prof as any).especialidades[0].nome
      : null;
    if (!esp) {
      setImportModalidadeId('');
      return;
    }
    // Tentar encontrar uma modalidade cujo nome coincida com a especialidade (case-insensitive)
    const found = modalidades.find(m => m.nome && m.nome.toLowerCase() === esp.toLowerCase());
    if (found) {
      setImportModalidadeId(found._id);
    } else {
      setImportModalidadeId('');
    }
  };

  // Handle batch submit from the Novo Horário modal: cria alunos (se não existirem) e horários para cada linha
  const handleSubmitBatch = async () => {
    setLoading(true);
    const lines = bulkAlunoText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    const failures: Array<{name:string, reason:string}> = [];
    let successes = 0;

  for (const name of lines) {
      // procurar aluno pelo nome (normalizado)
      const nomeNorm = String(name || '').trim().toUpperCase();
      const aluno = alunos.find(a => String(a.nome || '').trim().toUpperCase() === nomeNorm);
      let resolvedAluno = aluno;
      if (!resolvedAluno) {
        // Try similarity-based match (Levenshtein ratio). If a high-confidence candidate exists, ask to use it.
        const best = findBestAlunoMatch(name);
        if (best.aluno && best.score >= 0.8) {
          // Ask the user what to do: use existing, create new, or skip
          const decision = await askAlunoConfirmation(name, [{ aluno: best.aluno, score: best.score }]);
          if (decision.action === 'use' && decision.alunoId) {
            const found = alunos.find(a => a._id === decision.alunoId);
            if (found) resolvedAluno = found;
          } else if (decision.action === 'create') {
            // continue to create new below
          } else if (decision.action === 'skip') {
            failures.push({ name, reason: 'Pulado pelo usuário' });
            continue;
          }
        }

        if (!resolvedAluno) {
          // criar aluno automaticamente com modalidade do form (se houver)
          try {
            const alunoPayload: any = { nome: nomeNorm };
            // tentar pegar modalidade a partir do estado de seleção global (modalidadeSelecionada)
            if (modalidadeSelecionada) alunoPayload.modalidadeId = modalidadeSelecionada;
            const alunoResp = await fetch('/api/alunos', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(alunoPayload)
            });
            const alunoData = await alunoResp.json();
            if (alunoData.success) {
              resolvedAluno = alunoData.data as Aluno;
              if (resolvedAluno) {
                const createdAluno = resolvedAluno as Aluno;
                setAlunos(prev => [...prev, createdAluno]);
              }
            } else {
              failures.push({name, reason: 'Falha ao criar aluno: ' + (alunoData.error || 'erro')});
              continue;
            }
          } catch (err:any) {
            failures.push({name, reason: 'Erro ao criar aluno: ' + (err.message || 'erro')});
            continue;
          }
        }
      }

      // Criar horário para o aluno
      try {
        const resp = await fetch('/api/horarios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            alunoId: (resolvedAluno as Aluno)._id,
            professorId: formData.professorId,
            diaSemana: formData.diaSemana,
            horarioInicio: formData.horarioInicio,
            horarioFim: formData.horarioFim,
            observacoes: formData.observacoes || '',
            modalidadeId: formData.modalidadeId || modalidadeSelecionada || undefined
          })
        });
        const data = await resp.json();
        if (data.success) {
          successes++;
        } else {
          failures.push({name, reason: data.error || 'Erro desconhecido'});
        }
      } catch (err:any) {
        failures.push({name, reason: err.message || 'Erro de requisição'});
      }
    }

    setLoading(false);
    setShowModal(false);
    setBulkAlunoText('');
    await fetchHorarios();

    // Mostrar resumo simples
    const msg = `Importados: ${successes}. Falhas: ${failures.length}${failures.length>0? '\n' + failures.map(f=> `${f.name}: ${f.reason}`).join('\n') : ''}`;
    alert(msg);
  };

  const fetchModalidades = async () => {
    try {
      const response = await fetch('/api/modalidades');
      const data = await response.json();
      if (data.success) {
        setModalidades(data.data);
      }
    } catch (error) {
      console.error('Erro ao buscar modalidades:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check required fields before proceeding
    if (!formData.professorId) {
      alert('Selecione um professor');
      return;
    }
    if (!formData.horarioInicio || !formData.horarioFim) {
      alert('Selecione os horários de início e fim');
      return;
    }
    
    setLoading(true);

    try {
        if (editingMode === 'turma' && editingMemberIds && editingMemberIds.length > 0) {
          // Update entire turma via turma endpoint. Note: we no longer update student names from this modal.
          const payload: any = {
            originalGroup: {
              professorId: formData.professorId,
              diaSemana: formData.diaSemana,
              horarioInicio: formData.horarioInicio,
              horarioFim: formData.horarioFim
            },
            memberIds: editingMemberIds,
            professorId: formData.professorId,
            diaSemana: formData.diaSemana,
            horarioInicio: formData.horarioInicio,
            horarioFim: formData.horarioFim,
            // Do NOT include per-student `observacoes` here to avoid overwriting individual notes.
            // Only set turma-level observation.
            observacaoTurma: (formData.observacaoTurma !== undefined ? formData.observacaoTurma : undefined)
          };

          const response = await fetch('/api/horarios/turma', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const data = await response.json();
          if (data.success) {
            // Update local state for immediate UI feedback: apply ONLY turma-level observation to all edited members.
            try {
              if (editingMemberIds && editingMemberIds.length > 0) {
                setHorarios(prev => prev.map(h => editingMemberIds.includes(h._id) ? { ...h, observacaoTurma: formData.observacaoTurma } : h));
              }
            } catch (e) {
              // ignore local update errors
            }
            // Sucesso silencioso: fechar modal, resetar modo e recarregar lista
            setShowModal(false);
            setEditingMode('create');
            setEditingMemberIds(null);
            setFormData({ alunoId: '', professorId: '', diaSemana: 1, horarioInicio: '', horarioFim: '', observacoes: '', observacaoTurma: '', modalidadeId: '' });
            await fetchHorarios();
          } else {
            alert('Erro: ' + data.error);
          }
      } else {
        // If the optional textarea has content, create alunos and horarios per line
        const lines = String(novoHorarioAlunosText || '').split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length > 0) {
          const failures: Array<{name:string, reason:string}> = [];
          let successes = 0;
          for (const rawLine of lines) {
            // support 'NOME_ALUNO | OBS' where '|' separates name and optional observation
            const parts = rawLine.split('|');
            const namePart = String(parts[0] || '').trim();
            const obsPart = parts.slice(1).join('|').trim();

            // find exact by normalized name (use namePart only)
            const nomeNorm = String(namePart || '').trim().toUpperCase();
            let aluno = alunos.find(a => String(a.nome || '').trim().toUpperCase() === nomeNorm);
            if (!aluno) {
              // similarity check using the name part
              const best = findBestAlunoMatch(namePart);
              if (best.aluno && best.score >= 0.8) {
                const decision = await askAlunoConfirmation(namePart, [{ aluno: best.aluno, score: best.score }]);
                if (decision.action === 'use' && decision.alunoId) {
                  const found = alunos.find(a => a._id === decision.alunoId);
                  if (found) aluno = found;
                } else if (decision.action === 'create') {
                  // continue to create new below
                } else if (decision.action === 'skip') {
                  failures.push({ name: namePart, reason: 'Pulado pelo usuário' });
                  continue;
                }
              }
            }

            if (!aluno) {
              try {
                const alunoPayload: any = { nome: String(namePart || '').trim().toUpperCase() };
                if (modalidadeSelecionada) alunoPayload.modalidadeId = modalidadeSelecionada;
                const alunoResp = await fetch('/api/alunos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(alunoPayload) });
                const alunoData = await alunoResp.json();
                if (alunoData.success) {
                  aluno = alunoData.data as Aluno;
                  setAlunos(prev => [...prev, aluno as Aluno]);
                } else {
                  failures.push({name: namePart, reason: 'Falha ao criar aluno: ' + (alunoData.error || 'erro')});
                  continue;
                }
              } catch (err:any) {
                failures.push({name: namePart, reason: 'Erro ao criar aluno: ' + (err.message || 'erro')});
                continue;
              }
            }

            // create horario for this aluno; use the parsed observation (obsPart) when present
            try {
              const resp = await fetch('/api/horarios', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  alunoId: (aluno as Aluno)._id,
                  professorId: formData.professorId,
                  diaSemana: formData.diaSemana,
                  horarioInicio: formData.horarioInicio,
                  horarioFim: formData.horarioFim,
                    observacoes: obsPart || formData.observacoes || '',
                    modalidadeId: formData.modalidadeId || modalidadeSelecionada || undefined
                })
              });
              const data = await resp.json();
              if (data.success) {
                successes++;
              } else {
                failures.push({name: namePart, reason: data.error || 'Erro desconhecido'});
              }
            } catch (err:any) {
              failures.push({name: namePart, reason: err.message || 'Erro de requisição'});
            }
          }

          setLoading(false);
          setShowModal(false);
          setNovoHorarioAlunosText('');
          setFormData({ alunoId: '', professorId: '', diaSemana: 1, horarioInicio: '', horarioFim: '', observacoes: '', observacaoTurma: '', modalidadeId: '' });
          await fetchHorarios();
          alert(`Adicionados: ${successes}. Falhas: ${failures.length}` + (failures.length>0 ? '\n' + failures.map(f=> `${f.name}: ${f.reason}`).join('\n') : ''));
          return;
        }

        // otherwise fallback to single horario create as before
        const response = await fetch('/api/horarios', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(
            (formData.alunoId && formData.alunoId.trim() !== '' ? { ...formData, modalidadeId: formData.modalidadeId || modalidadeSelecionada } : { ...formData, alunoId: undefined, modalidadeId: formData.modalidadeId || modalidadeSelecionada })
          ),
        });

        // Parse response and handle errors explicitly
        let data: any = null;
        try {
          data = await response.json();
        } catch (e) {
          console.error('Failed to parse /api/horarios response body', e);
        }

        if (!response.ok) {
          console.error('API /api/horarios returned', response.status, data);
          const message = (data && (data.error || data.message)) ? (data.error || data.message) : `HTTP ${response.status}`;
          if (data && data.existing) {
            const ex = data.existing;
            const alunoName = ex.alunoId?.nome || (ex.alunoId?._id) || (ex.alunoId || 'N/A');
            const profName = ex.professorId?.nome || (ex.professorId?._id) || (ex.professorId || 'N/A');
            const dia = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][ex.diaSemana] || ex.diaSemana;
            const hora = `${ex.horarioInicio || ''}${ex.horarioFim ? ' — ' + ex.horarioFim : ''}`;
            alert(`Conflito ao criar horário: ${message}\nRegistro existente:\n- ID: ${data.existingId || ex._id}\n- Aluno: ${alunoName}\n- Professor: ${profName}\n- Dia: ${dia}\n- Horário: ${hora}\n\n(Verifique o registro existente ou escolha outro horário)`);
            console.log('Registro conflitado (detalhe):', ex);
          } else {
            alert('Erro ao criar horário: ' + message);
          }
          setLoading(false);
          return;
        }

        if (data && data.success) {
          setShowModal(false);
          setFormData({
            alunoId: '',
            professorId: '',
            diaSemana: 1,
            horarioInicio: '',
            horarioFim: '',
            observacoes: '',
            observacaoTurma: '',
            modalidadeId: ''
          });
          fetchHorarios();
        } else {
          alert('Erro: ' + data.error);
        }
      }
    } catch (error) {
      console.error('Erro ao cadastrar/atualizar horário:', error);
      alert('Erro ao cadastrar/atualizar horário');
    } finally {
      setLoading(false);
    }
  };

  const deleteHorario = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este horário?')) return;
    try {
      const response = await fetch(`/api/horarios/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.success) {
        // refresh list after delete (no success alert)
        fetchHorarios();
      } else {
        alert('Erro ao excluir horário');
      }
    } catch (error) {
      console.error('Erro ao excluir horário:', error);
      alert('Erro ao excluir horário');
    }
  };

  // Atualizar observações de um horário (tipicamente usado para anotações por aluno)
  const updateHorarioObservacoes = async (id: string, newObservacoes?: string) => {
    // If caller omitted newObservacoes, do nothing (preserve behavior)
    if (typeof newObservacoes === 'undefined') return;
    try {
      const resp = await fetch(`/api/horarios/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ observacoes: newObservacoes })
      });
      const data = await resp.json();
      if (data.success) {
        // Recarregar horários para refletir a alteração e update selectedStudentHorario
        const updated = await fetchHorarios();
        if (updated) {
          const refreshed = (updated as any).find((h: any) => String(h._id) === String(id));
          if (refreshed && selectedStudentHorario && String(selectedStudentHorario._id) === String(id)) {
            setSelectedStudentHorario(refreshed);
          }
        }
      } else {
        alert('Erro ao atualizar observações: ' + (data.error || 'erro'));
      }
    } catch (err) {
      console.error('Erro ao atualizar observações:', err);
      alert('Erro ao atualizar observações');
    }
  };

  // Edit a student's name and propagate change across horarios and alunos list
  const editAlunoName = async (horario: any) => {
    try {
      const aluno = horario?.alunoId;
      if (!aluno || !aluno._id) {
        alert('Aluno não encontrado para este horário');
        return;
      }
      const current = String(aluno.nome || '');
      const novo = prompt('Editar nome do aluno:', current);
      if (novo === null) return; // canceled
      const novoTrim = String(novo || '').trim();
      if (novoTrim === '') { alert('Nome não pode ficar vazio'); return; }

      const resp = await fetch(`/api/alunos/${aluno._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: novoTrim })
      });
      const data = await resp.json();
      if (data && data.success) {
        // update local alunos list so UI reflects change without full refetch
        setAlunos(prev => prev.map(a => a._id === aluno._id ? { ...a, nome: novoTrim } : a));
        // update all horarios that reference this aluno
        setHorarios(prev => prev.map(h => {
          try {
            if (h.alunoId && ((h.alunoId as any)._id === aluno._id || String((h.alunoId as any)?._id || h.alunoId) === String(aluno._id))) {
              return { ...h, alunoId: { ...(h.alunoId as any), nome: novoTrim } };
            }
          } catch (e) {}
          return h;
        }));
        // Refresh horarios from server to ensure consistency and keep modal open
        const updated = await fetchHorarios();
        if (updated) {
          const refreshed = (updated as any).find((h: any) => (h.alunoId && ((h.alunoId as any)._id === aluno._id || String((h.alunoId as any)?._id || h.alunoId) === String(aluno._id))));
          if (refreshed && selectedStudentHorario && String(selectedStudentHorario._id) === String(refreshed._id)) {
            setSelectedStudentHorario(refreshed);
          }
        }
      } else {
        alert('Erro ao atualizar aluno: ' + (data && data.error ? data.error : 'erro'));
      }
    } catch (err) {
      console.error('Erro ao editar aluno:', err);
      alert('Erro ao editar aluno');
    }
  };

  // Helper to toggle a prefixed tag in observacoes
  const toggleTagInObservacoes = (observacoes: string | undefined, tag: string) => {
    if (!observacoes) return tag;
    const has = observacoes.includes(tag);
    if (has) {
      // remove tag and trim
      return observacoes.replace(new RegExp(tag, 'g'), '').trim();
    }
    // prepend tag
    return `${tag} ${observacoes}`.trim();
  };

  const toggleCongelado = (id: string) => {
    // Optimistically toggle local flag and persist to server by PATCHing explicit flag fields (do NOT touch observacoes)
    setLocalFlags(prev => {
      const cur = prev[id] || {};
      return { ...prev, [id]: { ...cur, congelado: !cur.congelado, ausente: cur.ausente ? cur.ausente : false } };
    });
    (async () => {
      try {
        const cur = localFlags[id] || {};
        const newCongelado = !cur.congelado;
        // When setting congelado=true ensure ausente=false on server
        const body: any = { congelado: newCongelado };
        if (newCongelado) body.ausente = false;
        const patch = await fetch(`/api/horarios/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const patchData = await patch.json();
        if (!patchData || !patchData.success) throw new Error(patchData && patchData.error ? patchData.error : 'Erro ao atualizar');
        // Refresh horarios after server update
        await fetchHorarios();
      } catch (err) {
        console.error('Erro ao togglear congelado:', err);
        alert('Erro ao marcar congelado.');
        // revert local flag
        setLocalFlags(prev => {
          const cur = prev[id] || {};
          return { ...prev, [id]: { ...cur, congelado: !cur.congelado, ausente: cur.ausente ? cur.ausente : false } };
        });
      }
    })();
  };

  const toggleAusente = (id: string) => {
    // Optimistically toggle local flag and persist to server by PATCHing explicit flag fields (do NOT touch observacoes)
    setLocalFlags(prev => {
      const cur = prev[id] || {};
      return { ...prev, [id]: { ...cur, ausente: !cur.ausente, congelado: cur.congelado ? cur.congelado : false } };
    });
    (async () => {
      try {
        const cur = localFlags[id] || {};
        const newAusente = !cur.ausente;
        // When setting ausente=true ensure congelado=false on server
        const body: any = { ausente: newAusente };
        if (newAusente) body.congelado = false;
        const patch = await fetch(`/api/horarios/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const patchData = await patch.json();
        if (!patchData || !patchData.success) throw new Error(patchData && patchData.error ? patchData.error : 'Erro ao atualizar');
        await fetchHorarios();
      } catch (err) {
        console.error('Erro ao togglear ausente:', err);
        alert('Erro ao marcar ausente.');
        setLocalFlags(prev => {
          const cur = prev[id] || {};
          return { ...prev, [id]: { ...cur, ausente: !cur.ausente, congelado: cur.congelado ? cur.congelado : false } };
        });
      }
    })();
  };

  // Open modal to edit an entire turma (preserve all aluno entries)
  const handleEditTurma = (representativeHorario: HorarioFixo, turmaMembers: HorarioFixo[]) => {
    setEditingMode('turma');
    setEditingMemberIds(turmaMembers.map(m => m._id));
    // When editing a turma we MUST NOT touch per-aluno `observacoes` here.
    // The modal should edit only the turma-level observation (`observacaoTurma`).
    setFormData({
      alunoId: '', // not editing a single aluno
      professorId: representativeHorario.professorId._id,
      diaSemana: representativeHorario.diaSemana,
      horarioInicio: representativeHorario.horarioInicio,
      horarioFim: representativeHorario.horarioFim,
      observacoes: '', // keep alumno notes separate
      observacaoTurma: (representativeHorario as any).observacaoTurma || '',
      modalidadeId: ''
    });
  console.debug('abrindo modal editar turma', { editingMode: 'turma', memberIds: turmaMembers.map(m => m._id), representativeHorario });
    setShowModal(true);
  };

  // Filtrar horários por modalidade selecionada (garantir que todos aparecem se não houver modalidade no aluno)
  const horariosFiltrados = horarios.filter(horario => {
    if (!modalidadeSelecionada) return true;
    // If the horario document itself has a modalidadeId (template), use that
    if ((horario as any).modalidadeId && (horario as any).modalidadeId._id) {
  return ((horario as any).modalidadeId && ((((horario as any).modalidadeId as any).id || ((horario as any).modalidadeId as any)._id))) === modalidadeSelecionada;
    }
    // otherwise fall back to aluno's modalidade (for student entries)
    if (!horario.alunoId || !horario.alunoId.modalidadeId) return true;
  return ((horario as any).alunoId && ((((horario as any).alunoId as any).modalidadeId as any)?.id || (((horario as any).alunoId as any).modalidadeId as any)?._id)) === modalidadeSelecionada;
  });

  // Filtrar alunos por modalidade selecionada
  const alunosFiltrados = alunos.filter(aluno => 
  modalidadeSelecionada ? ((((aluno as any).modalidadeId as any)?.id || ((aluno as any).modalidadeId as any)?._id) === modalidadeSelecionada) : true
  );

  // Organizar horários por grade com múltiplas turmas por célula
  type Turma = {
    professorId: string;
    professorNome: string;
    horarioFim: string;
    alunos: HorarioFixo[];
    observacaoTurma?: string;
  };

  const criarGradeHorarios = () => {
    let skippedWithoutProfessor = 0;
    // grade[horario-dia] = array de turmas
    const grade: { [key: string]: Turma[] } = {};
    horariosDisponiveis.forEach(horario => {
      diasSemana.forEach((_, index) => {
        const key = `${horario}-${index}`;
        grade[key] = [];
      });
    });

    // Agrupar horários por slot (horário, dia, professor)
    horariosFiltrados.forEach(horario => {
      const key = `${horario.horarioInicio}-${horario.diaSemana}`;
      if (!grade[key]) {
        grade[key] = [];
      }

      // Defensive: professorId pode ser um ObjectId/string ou um objeto populado.
      // Normalizamos para uma string (professorIdStr) para agrupamento seguro.
      const rawProf = (horario as any).professorId;
      let professorIdStr: string | null = null;
      if (!rawProf) {
        professorIdStr = null;
      } else if (typeof rawProf === 'string') {
        professorIdStr = rawProf;
      } else if (rawProf._id) {
        professorIdStr = String(rawProf._id);
      } else if (rawProf.toString) {
        // fallback for ObjectId instances
        professorIdStr = String(rawProf);
      }

      if (!professorIdStr) {
        skippedWithoutProfessor++;
        return;
      }

      // Procurar turma do mesmo professor nesse slot usando o id string
      let turma = grade[key].find(t => t.professorId === professorIdStr && t.horarioFim === horario.horarioFim);
      if (!turma) {
        turma = {
          professorId: professorIdStr,
          professorNome: (horario as any).professorId && ((horario as any).professorId.nome || (horario as any).professorId)? ( (horario as any).professorId.nome || '' ) : '',
          horarioFim: horario.horarioFim,
          alunos: [],
          // Carry explicit turma-level observation if present on the horario document
          observacaoTurma: (horario as any).observacaoTurma || ''
        };
        try {
          if (typeof window !== 'undefined' && (horario as any).observacaoTurma) {
            console.debug('criarGradeHorarios: new turma.observacaoTurma set', { professor: turma.professorNome, observacaoTurma: (horario as any).observacaoTurma });
          }
        } catch(e) {}
        grade[key].push(turma);
      }
      turma.alunos.push(horario);
      // If this member carries an explicit turma-level observation, prefer it for the grouped object
      try {
        const memberObs = (horario as any).observacaoTurma;
        if (memberObs && !turma.observacaoTurma) turma.observacaoTurma = String(memberObs);
      } catch (e) {
        // ignore
      }
    });
    return grade;
  };
  // Log aggregate once to avoid spamming console
  // (if there were many invalid registros returned by the API, we'd rather fix server-side)
  // eslint-disable-next-line no-console
  if (typeof window !== 'undefined') {
    // Delay to ensure criarGradeHorarios executed above
    setTimeout(() => {
      if ((window as any).__skippedWithoutProfessorCount__ && (window as any).__skippedWithoutProfessorCount__ > 0) return;
      (window as any).__skippedWithoutProfessorCount__ = 1; // mark as logged
    }, 100);
  }

  const grade = criarGradeHorarios();

  // Helper: find turmas that cover a given slot (slot start time falls within turma interval)
  const getTurmasForSlot = (horarioSlot: string, diaIndex: number) => {
    try {
      const m = timeToMinutes(horarioSlot);
      // Find any horariosFiltrados entries where diaSemana matches and horarioInicio <= slot < horarioFim
      const covering = horariosFiltrados.filter(h => {
        if (h.diaSemana !== diaIndex) return false;
        const hi = timeToMinutes(h.horarioInicio);
        const hf = timeToMinutes(h.horarioFim);
        return m >= hi && m < hf;
      });
      // Group by professor + horarioFim to form turmas similar to criarGradeHorarios
      const groups: Record<string, any> = {};
      covering.forEach(h => {
        const rawProf = (h as any).professorId;
        let professorIdStr: string | null = null;
        if (!rawProf) professorIdStr = null;
        else if (typeof rawProf === 'string') professorIdStr = rawProf;
        else if (rawProf._id) professorIdStr = String(rawProf._id);
        else professorIdStr = String(rawProf);
        const key = `${professorIdStr}::${h.horarioFim}`;
        if (!groups[key]) groups[key] = { professorId: professorIdStr, professorNome: (h as any).professorId?.nome || '', horarioFim: h.horarioFim, alunos: [], observacaoTurma: (h as any).observacaoTurma || '' };
        // Prefer any explicit observacaoTurma found among members
        if (!groups[key].observacaoTurma && (h as any).observacaoTurma) groups[key].observacaoTurma = (h as any).observacaoTurma || '';
        groups[key].alunos.push(h);
      });
      return Object.values(groups);
    } catch (e) {
      return grade[`${horarioSlot}-${diaIndex}`] || [];
    }
  };

  // Compute which days and time rows should be visible and build rowspan/skip maps
  const { visibleDays, visibleTimes, startRowSpanMap, skipCellsSet } = useMemo(() => {
    try {
      const visibleDaysSet = new Set<number>();
      const visibleTimesArr: string[] = [];
      const startRowSpanMap = new Map<string, number>();
      const skipCellsSet = new Set<string>();

      const isSlotOpenForDay = (timeStr: string, dayIdx: number) => {
        try {
          const o = timeToMinutes(openTime);
          const c = timeToMinutes(closeTime);
          const m = timeToMinutes(timeStr);
          let isOpen = o < c ? (m >= o && m < c) : true;
          if (modalidadeSelecionada) {
            const mod = modalidades.find(mo => getMid(mo) === modalidadeSelecionada) as any;
            if (mod) {
              const dayAllowed = Array.isArray(mod.diasSemana) && mod.diasSemana.length > 0 ? (mod.diasSemana.includes(dayIdx)) : true;
              if (!dayAllowed) return false;
              if (Array.isArray(mod.horariosDisponiveis) && mod.horariosDisponiveis.length > 0) {
                const match = mod.horariosDisponiveis.some((hd: any) => {
                  const hdDays = Array.isArray(hd.diasSemana) && hd.diasSemana.length > 0 ? hd.diasSemana : [dayIdx];
                  if (!hdDays.includes(dayIdx)) return false;
                  const hi = timeToMinutes(hd.horaInicio);
                  const hf = timeToMinutes(hd.horaFim);
                  return m >= hi && m < hf;
                });
                return !!match;
              } else if (mod.horarioFuncionamento) {
                const hf = mod.horarioFuncionamento || {};
                const manhaInicio = hf?.manha?.inicio ? timeToMinutes(hf.manha.inicio) : null;
                const manhaFim = hf?.manha?.fim ? timeToMinutes(hf.manha.fim) : null;
                const tardeInicio = hf?.tarde?.inicio ? timeToMinutes(hf.tarde.inicio) : null;
                const tardeFim = hf?.tarde?.fim ? timeToMinutes(hf.tarde.fim) : null;
                const inManha = manhaInicio !== null && manhaFim !== null ? (m >= manhaInicio && m < manhaFim) : false;
                const inTarde = tardeInicio !== null && tardeFim !== null ? (m >= tardeInicio && m < tardeFim) : false;
                return inManha || inTarde;
              }
            }
          }
          return isOpen;
        } catch (e) {
          return true;
        }
      };

      // Determine visible days (keep day if any slot is open or any turma covers any slot)
      for (let day = 0; day < diasSemana.length; day++) {
        let keepDay = false;
        for (const t of horariosDisponiveis) {
          const covering = horariosFiltrados.some(h => h.diaSemana === day && timeToMinutes(h.horarioInicio) <= timeToMinutes(t) && timeToMinutes(h.horarioFim) > timeToMinutes(t));
          if (covering) { keepDay = true; break; }
          if (isSlotOpenForDay(t, day)) { keepDay = true; break; }
        }
        if (keepDay) visibleDaysSet.add(day);
      }

      const visibleDays = Array.from(visibleDaysSet).sort((a, b) => a - b);

      // Determine visible times: keep a time row if any visible day has it open or has a covering turma
      for (const t of horariosDisponiveis) {
        let keepTime = false;
        for (const day of visibleDays) {
          const covering = horariosFiltrados.some(h => h.diaSemana === day && timeToMinutes(h.horarioInicio) <= timeToMinutes(t) && timeToMinutes(h.horarioFim) > timeToMinutes(t));
          if (covering) { keepTime = true; break; }
          if (isSlotOpenForDay(t, day)) { keepTime = true; break; }
        }
        if (keepTime) visibleTimesArr.push(t);
      }

      // Build rowspan/skip maps relative to visibleTimesArr
      for (const h of horariosFiltrados) {
        const day = (h as any).diaSemana;
        if (!visibleDaysSet.has(day)) continue;
        const startTime = h.horarioInicio;
        const endTime = h.horarioFim;
        const coveredIndices: number[] = [];
        visibleTimesArr.forEach((vt, idx) => {
          const m = timeToMinutes(vt);
          if (m >= timeToMinutes(startTime) && m < timeToMinutes(endTime)) coveredIndices.push(idx);
        });
        if (coveredIndices.length === 0) continue;
        const span = coveredIndices.length;
        const startKey = `${visibleTimesArr[coveredIndices[0]]}-${day}`;
        const prev = startRowSpanMap.get(startKey) || 1;
        startRowSpanMap.set(startKey, Math.max(prev, span));
        for (let i = 1; i < span; i++) {
          const skipKey = `${visibleTimesArr[coveredIndices[0] + i]}-${day}`;
          skipCellsSet.add(skipKey);
        }
      }

      return { visibleDays, visibleTimes: visibleTimesArr, startRowSpanMap, skipCellsSet };
    } catch (e) {
      return { visibleDays: [0,1,2,3,4,5,6], visibleTimes: horariosDisponiveis, startRowSpanMap: new Map(), skipCellsSet: new Set() };
    }
  }, [horariosFiltrados, horariosDisponiveis, modalidades, modalidadeSelecionada, openTime, closeTime]);

  // Handler moved out of JSX to avoid large inline blocks and JSX parse issues
  const handleImportClick = async () => {
    // iniciar importação
    setImporting(true);
    // Only import entries that are checked
    const entriesToImport = importEntries.filter(e => e.selected);
    const failures: Array<{name:string, reason:string}> = [];
    let successes = 0;
    for (const entry of entriesToImport) {
      const name = String(entry.name || '').trim();
      if (!name) {
        failures.push({name: '(vazio)', reason: 'Nome vazio'});
        continue;
      }
      let alunoIdToUse: string | undefined = entry.alunoId;
      // If an explicit alunoId was provided for this entry, use it directly
      if (!alunoIdToUse) {
        // Try to find exact match first
        const aluno = alunos.find(a => String(a.nome || '').trim().toLowerCase() === name.toLowerCase());
        let resolvedAluno = aluno;
        if (!resolvedAluno) {
          // Try similarity match like before
          const best = findBestAlunoMatch(name);
          if (best.aluno && best.score >= 0.8) {
            const decision = await askAlunoConfirmation(name, [{ aluno: best.aluno, score: best.score }]);
            if (decision.action === 'use' && decision.alunoId) {
              const found = alunos.find(a => a._id === decision.alunoId);
              if (found) resolvedAluno = found;
            } else if (decision.action === 'create') {
              // will create below
            } else if (decision.action === 'skip') {
              failures.push({ name, reason: 'Pulado pelo usuário' });
              continue;
            }
          }
        }
        if (!resolvedAluno) {
          // create aluno
          try {
            const alunoPayload: any = { nome: name.toUpperCase() };
            if (importModalidadeId) alunoPayload.modalidadeId = importModalidadeId;
            const alunoResp = await fetch('/api/alunos', {
              method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(alunoPayload)
            });
            const alunoData = await alunoResp.json();
            if (alunoData.success) {
              const created = alunoData.data as Aluno | undefined;
              if (created) {
                resolvedAluno = created;
                setAlunos(prev => [...prev, created]);
              } else {
                failures.push({name, reason: 'Resposta inválida ao criar aluno'});
                continue;
              }
            } else {
              failures.push({name, reason: 'Falha ao criar aluno: ' + (alunoData.error || 'erro')});
              continue;
            }
          } catch (err:any) {
            failures.push({name, reason: 'Erro ao criar aluno: ' + (err.message || 'erro')});
            continue;
          }
        }
        alunoIdToUse = resolvedAluno?._id;
      }

      if (!alunoIdToUse) {
        failures.push({name, reason: 'Aluno não resolvido'});
        continue;
      }

      // create horario
      try {
        const resp = await fetch('/api/horarios', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ alunoId: alunoIdToUse, professorId: importProfessorId, diaSemana: importDiaSemana, horarioInicio: importHorarioInicio, horarioFim: importHorarioFim, observacoes: 'Importado em lote', modalidadeId: importModalidadeId || modalidadeSelecionada || undefined })
        });
        const data = await resp.json();
        if (data.success) {
          successes++;
        } else {
          failures.push({name, reason: data.error || 'Erro desconhecido'});
        }
      } catch (err:any) {
        failures.push({name, reason: err.message || 'Erro de requisição'});
      }
    }
    setImportResults({successes, failures});
    setImporting(false);
    await fetchHorarios();
  };

  return (
    <>
      {showModalLote.open && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Adicionar Alunos em Lote</h3>
          <p className="text-sm text-gray-700 mb-3">Modalidade aplicada: <span className="font-semibold">{(modalidades.find(m => getMid(m) === modalidadeSelecionada)?.nome) || '— nenhuma selecionada —'}</span>. Os alunos selecionados serão adicionados a esta modalidade — verifique se está correta antes de confirmar.</p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Selecione os alunos:</label>
                <div className="max-h-40 overflow-y-auto border rounded p-2">
                  {alunosFiltrados.map(aluno => (
                    <div key={aluno._id} className="flex items-center mb-1">
                      <input
                        type="checkbox"
                        checked={alunosSelecionadosLote.includes(aluno._id)}
                        onChange={e => {
                          if (e.target.checked) {
                            setAlunosSelecionadosLote([...alunosSelecionadosLote, aluno._id]);
                          } else {
                            setAlunosSelecionadosLote(alunosSelecionadosLote.filter(id => id !== aluno._id));
                          }
                        }}
                        className="mr-2"
                      />
                      <span>{aluno.nome}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModalLote({open: false})}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={alunosSelecionadosLote.length === 0}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                >
                  Adicionar selecionados
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal para adicionar alunos a uma turma (bulk via textarea) */}
      {showAddAlunoModal && addAlunoTurma && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-16 mx-auto p-6 border w-[640px] shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Adicionar Alunos à Turma</h3>
            <p className="text-sm text-gray-600 mb-2">Professor: {professores.find(p => p._id === addAlunoTurma.professorId)?.nome} — {diasSemana[addAlunoTurma.diaSemana || 0]} {addAlunoTurma.horarioInicio} às {addAlunoTurma.horarioFim}</p>
            <label className="block text-sm font-medium text-gray-700">Cole os nomes (uma linha por aluno) — serão convertidos para MAIÚSCULAS automaticamente</label>
            <textarea
              value={bulkAlunoTextAdd}
              onChange={e => {
                // Keep raw text for editing
                setBulkAlunoTextAdd(String(e.target.value || ''));
              }}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              rows={4}
              placeholder={`Ex:\nJOÃO SILVA\nMARIA SOUZA\n...`}
            />
            <p className="text-xs text-gray-500 mt-2">Linhas detectadas: {bulkImportEntries.length}. Desmarque as que não deseja adicionar.</p>
            <div className="mt-2 flex items-center justify-between">
              <div />
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setBulkImportEntries(prev => prev.map(p => ({...p, selected: true})))} className="text-xs text-primary-600">Selecionar todos</button>
                <button type="button" onClick={() => setBulkImportEntries(prev => prev.map(p => ({...p, selected: false})))} className="text-xs text-gray-600">Desmarcar</button>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <input type="checkbox" id="bulk-allow-create" checked={bulkAllowCreateNew} onChange={e => setBulkAllowCreateNew(e.target.checked)} />
              <label htmlFor="bulk-allow-create" className="text-xs">Permitir criação automática de novos alunos (marque com cuidado para evitar duplicatas)</label>
            </div>
            <div className="mt-2 max-h-36 overflow-y-auto border rounded p-2 bg-white">
              {bulkImportEntries.length === 0 && <div className="text-xs text-gray-500">Nenhuma linha detectada ainda.</div>}
              {bulkImportEntries.map(entry => (
                <div key={entry.id} className="flex items-start gap-2 mb-2">
                  <input type="checkbox" checked={entry.selected} onChange={e => setBulkImportEntries(prev => prev.map(p => p.id === entry.id ? {...p, selected: e.target.checked} : p))} className="mt-1" />
                  <div className="flex-1">
                    <div className="flex gap-2">
                      <input value={entry.name} onChange={e => setBulkImportEntries(prev => prev.map(p => p.id === entry.id ? {...p, name: e.target.value} : p))} className="w-full border border-gray-200 rounded px-2 py-1 text-sm" />
                      <input value={entry.obs || ''} onChange={e => setBulkImportEntries(prev => prev.map(p => p.id === entry.id ? {...p, obs: e.target.value} : p))} placeholder="Observação (opcional)" className="w-40 border border-gray-200 rounded px-2 py-1 text-sm" />
                    </div>
                    <div className="mt-1 text-xs text-gray-500">Associe a um aluno existente (opcional):
                      <select value={entry.alunoId || ''} onChange={e => setBulkImportEntries(prev => prev.map(p => p.id === entry.id ? {...p, alunoId: e.target.value || undefined} : p))} className="ml-2 text-xs border border-gray-200 rounded px-2 py-1">
                        <option value="">— nenhum —</option>
                        {alunos.slice(0,200).map(a => (
                          <option key={a._id} value={a._id}>{a.nome}</option>
                        ))}
                      </select>
                      {entry.alunoId ? (
                        <span className="ml-2 inline-block text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">Existente</span>
                      ) : (
                        <span className="ml-2 inline-block text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">Novo (será criado)</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => { setShowAddAlunoModal(false); setBulkAlunoTextAdd(''); setAddAlunoTurma(null); }}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >Cancelar</button>
              <button
                type="button"
                  onClick={async () => {
                  // use only selected entries
                  const entries = bulkImportEntries.filter(e => e.selected);
                  const failures: Array<{name:string, reason:string}> = [];
                  let successes = 0;
                  // If any selected entry has no alunoId and bulkAllowCreateNew is false, block
                  if (entries.some(en => !en.alunoId) && !bulkAllowCreateNew) {
                    alert('Algumas entradas selecionadas não correspondem a alunos existentes. Ative "Permitir criação automática" para criá-las ou associe alunos existentes.');
                    return;
                  }
                  for (const e of entries) {
                    const rawName = String(e.name || '').trim();
                    const obsPart = String(e.obs || '').trim();
                    if (!rawName) { failures.push({name: '(vazio)', reason: 'Nome vazio'}); continue; }
                    // If an alunoId was manually associated, use it
                    let resolvedAluno: Aluno | undefined = undefined;
                    if (e.alunoId) {
                      resolvedAluno = alunos.find(a => a._id === e.alunoId);
                    }
                    if (!resolvedAluno) {
                      // try exact match
                      const lookupName = rawName.toUpperCase();
                      const alunoFound = alunos.find(a => String(a.nome || '').trim().toUpperCase() === lookupName);
                      if (alunoFound) resolvedAluno = alunoFound;
                    }
                    if (!resolvedAluno) {
                      // create only if allowed
                      if (!bulkAllowCreateNew) { failures.push({name: rawName, reason: 'Criação proibida'}); continue; }
                      try {
                        const alunoPayload: any = { nome: rawName.toUpperCase() };
                        if (modalidadeSelecionada) alunoPayload.modalidadeId = modalidadeSelecionada;
                        const alunoResp = await fetch('/api/alunos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(alunoPayload) });
                        const alunoData = await alunoResp.json();
                        if (alunoData.success) {
                          resolvedAluno = alunoData.data as Aluno;
                          if (resolvedAluno) setAlunos(prev => [...prev, resolvedAluno!]);
                        } else {
                          failures.push({name: rawName, reason: 'Falha ao criar aluno: ' + (alunoData.error || 'erro')});
                          continue;
                        }
                      } catch (err:any) {
                        failures.push({name: rawName, reason: 'Erro ao criar aluno: ' + (err.message || 'erro')});
                        continue;
                      }
                    }

                    if (!resolvedAluno) { failures.push({name: rawName, reason: 'Aluno não resolvido'}); continue; }

                    try {
                      const resp = await fetch('/api/horarios', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ alunoId: resolvedAluno._id, professorId: addAlunoTurma.professorId, diaSemana: addAlunoTurma.diaSemana, horarioInicio: addAlunoTurma.horarioInicio, horarioFim: addAlunoTurma.horarioFim, observacoes: obsPart || '', modalidadeId: formData.modalidadeId || modalidadeSelecionada || undefined })
                      });
                      const data = await resp.json();
                      if (data.success) {
                        successes++;
                      } else {
                        failures.push({name: rawName, reason: data.error || 'Erro desconhecido'});
                      }
                    } catch (err:any) {
                      failures.push({name: rawName, reason: err.message || 'Erro de requisição'});
                    }
                  }
                  setShowAddAlunoModal(false);
                  setBulkAlunoTextAdd('');
                  setAddAlunoTurma(null);
                  setBulkImportEntries([]);
                  await fetchHorarios();
                  alert(`Adicionados: ${successes}. Falhas: ${failures.length}` + (failures.length>0 ? '\n' + failures.map(f=> `${f.name}: ${f.reason}`).join('\n') : ''));
                }}
                className="px-4 py-2 bg-primary-600 text-white rounded-md disabled:opacity-50"
                disabled={bulkImportEntries.filter(e=>e.selected).length===0 || (bulkImportEntries.filter(e=>e.selected && !e.alunoId).length>0 && !bulkAllowCreateNew)}
              >Adicionar ({bulkImportEntries.filter(e=>e.selected).length})</button>
            </div>
          </div>
        </div>
      )}
  <Layout title="Horários - Superação Flux" fullWidth>
  <div className="w-full px-4 py-6 sm:px-0">
        <div className="sm:flex sm:items-center mb-6">
          <div className="sm:flex-auto">
            <h1 className="text-xl font-semibold text-gray-900">Grade de Horários</h1>
            <p className="mt-2 text-sm text-gray-700">
              Visualize e gerencie os horários fixos dos alunos por modalidade.
            </p>
          </div>
          <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none space-x-3">
            {/* Import buttons removed as requested */}
          </div>
        </div>

        {/* Seletor de Modalidade (buttons) - moved outside the white card */}
        <div className="mb-4">
          <div className="flex flex-wrap gap-2">
            {(modalidades || []).map((modalidade, idx) => {
              const mid = (modalidade as any).id || (modalidade as any)._id || '';
              const color = (modalidade as any)?.cor || '#3B82F6';
              const isSelected = String(mid) === String(modalidadeSelecionada);
              return (
                <button
                  key={(modalidade as any).id ?? (modalidade as any)._id ?? idx}
                  onClick={() => setModalidadeSelecionada(String(mid))}
                  className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${isSelected ? 'bg-primary-600 text-white' : 'bg-white border'}`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                  <span>{modalidade.nome}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Grade de horários */}
        {/* Only render the heavy schedule after hydration on client to avoid SSR/CSR mismatch */}
        {mounted && (
          <div className="shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
            {/* Horário de funcionamento removido da UI por decisão do produto; a lógica de filtragem por openTime/closeTime permanece. */}
            <div className="overflow-auto max-h-[75vh]">{/* table scrolls internally */}
              <table className="w-full table-fixed text-sm border-collapse">
            <thead className="bg-white border-b">
              <tr>
                <th scope="col" className="sticky top-0 left-0 z-20 px-2 py-2 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-24 bg-white border border-gray-200">
                  Horário
                </th>
                {visibleDays.map((dayIndex) => (
                  <th
                    key={dayIndex}
                    scope="col"
                    className="sticky top-0 z-10 px-3 py-2 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[88px] bg-gray-50 border border-gray-200"
                  >
                    {diasSemana[dayIndex]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white">
              {visibleTimes.map((horarioSlot) => (
                <tr key={horarioSlot} className="align-top">
                  <td className="sticky left-0 z-10 p-2 whitespace-nowrap text-sm font-medium text-gray-900 bg-white border border-gray-200 h-full">
                    <div className="h-full flex items-center justify-center text-sm font-medium text-center">{horarioSlot}</div>
                  </td>
                  {visibleDays.map((dayIndex) => {
                    const key = `${horarioSlot}-${dayIndex}`;
                    // If this cell is covered by a rowspan from a previous slot, don't render a td here
                    if (skipCellsSet.has(key)) return null;
                    const turmas = getTurmasForSlot(horarioSlot, dayIndex); // Array de turmas neste slot (covers multi-slot turmas)
                    const rowSpan = (startRowSpanMap.get(key) || 1) > 1 ? (startRowSpanMap.get(key) as number) : undefined;
                    // Determine if any turma is over capacity so we can color the entire cell
                    let anyExceeded = false;
                    try {
                      for (const turma of turmas) {
                        const visibleAlunos = (turma.alunos || []).filter((h: any) => h && h.alunoId && (h.alunoId.nome || h.alunoId._id));
                        let capacity: number | undefined = undefined;
                        if (modalidadeSelecionada) {
                          const mod = modalidades.find(m => getMid(m) === modalidadeSelecionada) as any;
                          if (mod && typeof mod.limiteAlunos === 'number') capacity = mod.limiteAlunos;
                        }
                        if (capacity === undefined) {
                          const firstAlunoMod = (visibleAlunos[0] && (visibleAlunos[0].alunoId as any)?.modalidadeId) || null;
                          const modId = firstAlunoMod ? ((firstAlunoMod.id || firstAlunoMod._id) as string) : null;
                          if (modId) {
                            const mod2 = modalidades.find(m => getMid(m) === modId) as any;
                            if (mod2 && typeof mod2.limiteAlunos === 'number') capacity = mod2.limiteAlunos;
                          }
                        }
                        const count = visibleAlunos.length;
                        if (capacity !== undefined && count >= capacity) { anyExceeded = true; break; }
                      }
                    } catch (e) {
                      // ignore
                    }
                    const o = timeToMinutes(openTime);
                    const c = timeToMinutes(closeTime);
                    const m = timeToMinutes(horarioSlot);
                    // default page-wide availability
                    let isOpen = o < c ? (m >= o && m < c) : true;

                    // If a modalidade is selected, determine availability from the modalidade
                    if (modalidadeSelecionada) {
                      const mod = modalidades.find(mo => getMid(mo) === modalidadeSelecionada) as any;
                      if (mod) {
                        // Check day availability: if modalidade defines diasSemana, require the day to be included
                        const dayAllowed = Array.isArray(mod.diasSemana) && mod.diasSemana.length > 0 ? (mod.diasSemana.includes(dayIndex)) : true;

                        if (!dayAllowed) {
                          isOpen = false;
                        } else if (Array.isArray(mod.horariosDisponiveis) && mod.horariosDisponiveis.length > 0) {
                          // If modalidade has explicit horariosDisponiveis, use them (they include diasSemana + horaInicio/horaFim)
                          const match = mod.horariosDisponiveis.some((hd: any) => {
                            const hdDays = Array.isArray(hd.diasSemana) && hd.diasSemana.length > 0 ? hd.diasSemana : [dayIndex];
                              if (!hdDays.includes(dayIndex)) return false;
                            const hi = timeToMinutes(hd.horaInicio);
                            const hf = timeToMinutes(hd.horaFim);
                            return m >= hi && m < hf;
                          });
                          isOpen = !!match;
                        } else if (mod.horarioFuncionamento) {
                          // Fallback to horarioFuncionamento (manha/tarde)
                          const hf = mod.horarioFuncionamento || {};
                          const manhaInicio = hf?.manha?.inicio ? timeToMinutes(hf.manha.inicio) : null;
                          const manhaFim = hf?.manha?.fim ? timeToMinutes(hf.manha.fim) : null;
                          const tardeInicio = hf?.tarde?.inicio ? timeToMinutes(hf.tarde.inicio) : null;
                          const tardeFim = hf?.tarde?.fim ? timeToMinutes(hf.tarde.fim) : null;
                          const inManha = manhaInicio !== null && manhaFim !== null ? (m >= manhaInicio && m < manhaFim) : false;
                          const inTarde = tardeInicio !== null && tardeFim !== null ? (m >= tardeInicio && m < tardeFim) : false;
                          isOpen = inManha || inTarde;
                        } else {
                          // No horario info on modalidade: keep page-wide interval
                          isOpen = o < c ? (m >= o && m < c) : true;
                        }
                      }
                    }
                    return (
                      <td
                        key={key}
                        rowSpan={rowSpan}
                        onClick={() => {
                          if (!isOpen) return; // blocked slot
                          // If this cell already has one or more turmas, do NOT open edit/create modal
                          // Clicking the cell should be a no-op in that case. Use the buttons inside
                          // each turma card to edit/add students or the small '+' button to add a new turma.
                          if (turmas && turmas.length > 0) return;
                          // Open the create-new-horario modal prefilled for this slot
                          const idx = horariosDisponiveis.indexOf(horarioSlot);
                          const horarioFimDefault = idx >= 0 && idx < horariosDisponiveis.length - 1 ? horariosDisponiveis[idx + 1] : horarioSlot;
                          setEditingMode('create');
                          setFormData({
                            alunoId: '',
                            professorId: '',
                            diaSemana: dayIndex,
                            horarioInicio: horarioSlot,
                            horarioFim: horarioFimDefault,
                            observacoes: '',
                            observacaoTurma: '',
                            modalidadeId: modalidadeSelecionada || ''
                          });
                          setSelectedHorarioId(null);
                          setEditingMemberIds([]);
                          setShowModal(true);
                        }}
                        className={`p-2 align-top border border-gray-200 h-full ${(isOpen && (!turmas || turmas.length === 0)) ? 'cursor-pointer' : 'cursor-default'}`}
                      >
                            <div className={`${!isOpen ? 'bg-red-50' : (turmas && turmas.length > 0) ? 'bg-white' : 'bg-white hover:bg-gray-50'} rounded-md p-2 flex flex-col h-full`}>
                          {isOpen ? (
                            // open interval: show turmas or 'TURMA VAGA'
                            (turmas && turmas.length > 0) ? (
                              <div className="flex flex-col">
                                <div className="flex flex-col space-y-2">
                                  {turmas.map((turma, turmaIdx) => {
                                    const visibleAlunos = (turma.alunos || []).filter((h: any) => h && h.alunoId && (h.alunoId.nome || h.alunoId._id));
                                    // Determine capacity: prefer selected modalidade, otherwise infer from first aluno
                                    let capacity: number | undefined = undefined;
                                    try {
                                      if (modalidadeSelecionada) {
                                        const mod = modalidades.find(m => getMid(m) === modalidadeSelecionada) as any;
                                        if (mod && typeof mod.limiteAlunos === 'number') capacity = mod.limiteAlunos;
                                      }
                                      if (capacity === undefined) {
                                        const firstAlunoMod = (visibleAlunos[0] && (visibleAlunos[0].alunoId as any)?.modalidadeId) || null;
                                        const modId = firstAlunoMod ? ((firstAlunoMod.id || firstAlunoMod._id) as string) : null;
                                        if (modId) {
                                          const mod2 = modalidades.find(m => getMid(m) === modId) as any;
                                          if (mod2 && typeof mod2.limiteAlunos === 'number') capacity = mod2.limiteAlunos;
                                        }
                                      }
                                    } catch (e) {
                                      // ignore
                                    }
                                    const count = visibleAlunos.length;
                                    const exceeded = capacity !== undefined && count >= capacity;
                                    const explicitTurmaObs = (turma as any).observacaoTurma;
                                    const turmaObsStr = explicitTurmaObs ? String(explicitTurmaObs).trim() : '';
                                    const turmaClass = `${exceeded ? 'border-red-200 bg-red-50 text-red-800' : 'border-gray-200 bg-primary-50 text-primary-800'} border px-3 py-2 rounded text-xs mb-1 shadow-sm flex flex-col`;
                                    try { if (typeof window !== 'undefined') console.debug('renderTurma: turma', { professor: turma.professorNome, turmaObs: turma.observacaoTurma, visibleAlunos: visibleAlunos.map((a:any)=>({id:a._id, obs: a.observacoes})) }); } catch(e) {}

                                    return (
                                      <div key={turma.professorId + turma.horarioFim} className={turmaClass}>
                                        <div className="flex items-center justify-between mb-1">
                                          <div className="font-medium text-left"><span className="text-sm">{turma.professorNome}</span></div>
                                          <div className={`text-[11px] ${exceeded ? 'text-red-700 font-semibold' : 'text-gray-600'}`}>{count}{capacity ? `/${capacity}` : ''}</div>
                                        </div>
                                        {turmaObsStr ? (
                                          <div className="mb-2 text-left">
                                            <span className="inline-block text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-semibold">
                                              {turmaObsStr.replace(/\[CONGELADO\]|\[AUSENTE\]/g, '').trim()}
                                            </span>
                                          </div>
                                        ) : null}
                                        <div className="space-y-2 max-h-40 overflow-y-auto text-xs">
                                          {visibleAlunos.map((horario: any) => (
                                            <div key={horario._id} className="bg-white bg-opacity-60 px-2 py-1 rounded text-xs w-full">
                                              <div className="w-full">
                                                <div className="flex items-center justify-between">
                                                  <div className="flex items-center">
                                                    <i className="fas fa-user fa-xs text-primary-600 mr-2" aria-hidden="true" />
                                                    {
                                                      (() => {
                                                        const obs = String(horario.observacoes || '');
                                                        const local = localFlags[horario._id] || {};
                                                        const isCongelado = (local.congelado === true) || obs.includes('[CONGELADO]');
                                                        const isAusente = (local.ausente === true) || obs.includes('[AUSENTE]');
                                                        const tooltipParts: string[] = [];
                                                        if (isCongelado) tooltipParts.push('CONGELADO: matrícula congelada (não cobra/pausa)');
                                                        if (isAusente) tooltipParts.push('AUSENTE: ausência registrada');
                                                        const tooltip = tooltipParts.join(' • ');
                                                        return (
                                                          <div title={tooltip || undefined} className="flex flex-col">
                                                            <span className={`font-medium text-xs text-gray-800`}>{horario.alunoId?.nome}</span>
                                                            <div className="mt-1 flex items-center gap-2 text-sm">
                                                              {isCongelado && <i className="fas fa-snowflake text-sky-500" aria-hidden="true" title="Congelado" />}
                                                              {isAusente && <i className="fas fa-user-clock text-rose-500" aria-hidden="true" title="Ausente recorrente" />}
                                                            </div>
                                                          </div>
                                                        );
                                                      })()
                                                    }
                                                  </div>
                                                  <div>
                                                    <button
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        /* close other modals/backdrops */
                                                        setShowAddSingleAlunoModal(false);
                                                        setShowAddAlunoModal(false);
                                                        setShowImportModal(false);
                                                        setShowModalLote({open: false});
                                                        // Ensure professorNome from the parent turma is available in the selected object
                                                        const enriched = { ...horario, professorNome: (turma && (turma.professorNome || (turma.professorId && (turma.professorId.nome || turma.professorId))) ) };
                                                        setSelectedStudentHorario(enriched);
                                                        setShowStudentDetailModal(true);
                                                      }}
                                                      className="text-primary-600 hover:text-primary-700 p-1 text-sm rounded"
                                                      title="Ver detalhes do aluno"
                                                      aria-label="Ver detalhes do aluno"
                                                    >
                                                      <i className="fas fa-info-circle" aria-hidden="true" />
                                                    </button>
                                                  </div>
                                                </div>
                                                {/* student observation is shown BELOW the name row and applies only to this aluno */}
                                                {(() => {
                                                  const studentObsRaw = String(horario.observacoes || '');
                                                  const studentObs = studentObsRaw.replace(/\[CONGELADO\]|\[AUSENTE\]/g, '').trim();
                                                  if (studentObs) {
                                                    return (
                                                      <div className="mt-1 mb-1 text-left">
                                                        <span className="inline-block text-xs px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded font-semibold">{studentObs}</span>
                                                      </div>
                                                    );
                                                  }
                                                  return null;
                                                })()}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                        {/* Botões de ação da turma */}
                                        <div className="mt-2 flex items-center justify-center gap-2">
                                          <button
                                            onClick={(e) => { e.stopPropagation(); setAddAlunoTurma({ professorId: turma.professorId, diaSemana: dayIndex, horarioInicio: horarioSlot, horarioFim: turma.horarioFim }); setShowAddAlunoModal(true); }}
                                            title="Adicionar aluno"
                                            className="p-1 w-8 h-8 flex items-center justify-center text-primary-600 hover:text-primary-700 rounded bg-white/30"
                                          >
                                            <span className="sr-only">Adicionar aluno</span>
                                            <i className="fas fa-plus" aria-hidden="true" />
                                          </button>

                                          {/* Single-add button: add one aluno (opens modal with search/create) */}
                                          <button
                                            onClick={(e) => { e.stopPropagation(); setAddAlunoTurma({ professorId: turma.professorId, diaSemana: dayIndex, horarioInicio: horarioSlot, horarioFim: turma.horarioFim }); setShowAddSingleAlunoModal(true); setSingleAlunoSearch(''); setSingleAlunoSelectedId(null); setSingleAlunoName(''); setSingleAlunoObservacoes(''); }}
                                            title="Adicionar 1 aluno"
                                            className="p-1 w-8 h-8 flex items-center justify-center text-primary-600 hover:text-primary-700 rounded"
                                          >
                                            <span className="sr-only">Adicionar um aluno</span>
                                            <i className="fas fa-user-plus" aria-hidden="true" />
                                          </button>

                                          <button
                                            onClick={(e) => { e.stopPropagation(); openEditTurmaGroup(turma); }}
                                            title="Editar turma"
                                            className="p-1 w-8 h-8 flex items-center justify-center text-primary-600 hover:text-primary-700 rounded"
                                          >
                                            <span className="sr-only">Editar turma</span>
                                            <i className="fas fa-edit" aria-hidden="true" />
                                          </button>

                                          <button
                                            onClick={(e) => { e.stopPropagation(); if (!confirm('Excluir TODA a turma? Isso removerá todos os alunos deste horário.')) return; handleDeleteTurma(turma); }}
                                            title="Excluir turma inteira"
                                            className="p-1 w-8 h-8 flex items-center justify-center text-primary-600 hover:text-primary-700 rounded"
                                          >
                                            <span className="sr-only">Excluir turma</span>
                                            <i className="fas fa-trash" aria-hidden="true" />
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                                {/* add-button: render outside the turma card list so it visually indicates adding another turma for this slot */}
                                <div className="mt-2 w-full flex items-center justify-center">
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); /* open create modal prefilled for this slot */
                                      const idx = horariosDisponiveis.indexOf(horarioSlot);
                                      const horarioFimDefault = idx >= 0 && idx < horariosDisponiveis.length - 1 ? horariosDisponiveis[idx + 1] : horarioSlot;
                                      setEditingMode('create');
                                      setFormData({
                                        alunoId: '',
                                        professorId: '',
                                        diaSemana: dayIndex,
                                        horarioInicio: horarioSlot,
                                        horarioFim: horarioFimDefault,
                                        observacoes: '',
                                        observacaoTurma: '',
                                        modalidadeId: modalidadeSelecionada || ''
                                      });
                                      setSelectedHorarioId(null);
                                      setEditingMemberIds([]);
                                      setShowModal(true);
                                    }}
                                    className="inline-flex items-center gap-2 px-2 py-1 text-xs rounded border border-dashed border-gray-300 text-gray-600 hover:bg-gray-50"
                                    title="Adicionar nova turma neste horário"
                                  >
                                    <span className="font-bold text-sm">+</span>
                                    <span>Adicionar turma</span>
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="h-full w-full flex items-center justify-center">
                                <span className="text-sm font-semibold text-green-700 text-center">TURMA VAGA</span>
                              </div>
                            )
                          ) : (
                            // blocked slot for this modalidade/day/time
                            <div className="flex items-center justify-center flex-1">
                              <span className="inline-block px-2 py-1 text-xs font-semibold text-red-700 bg-red-50 rounded text-center">INDISPONÍVEL</span>
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Lista de horários removida conforme solicitado pelo usuário */}

        {/* legenda removida */}

      </div>

      {/* Modal para cadastrar novo horário */}
      {/* Modal de confirmação quando encontra aluno similar */}
      {confirmAlunoDialog && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full" style={{ zIndex: 9999 }}>
          <div className="relative top-24 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Confirmação de Aluno Similar</h3>
              <p className="text-sm text-gray-700 mb-3">O nome &quot;{confirmAlunoDialog.name}&quot; parece corresponder a um aluno já cadastrado. O que deseja fazer?</p>
              <div className="mb-3">
                {confirmAlunoDialog.candidates.map(c => (
                  <div key={c.aluno._id} className="p-2 border rounded mb-2">
                    <div className="font-medium">{c.aluno.nome}</div>
                    <div className="text-xs text-gray-500">Similaridade: {(c.score*100).toFixed(0)}%</div>
                    <div className="text-xs text-gray-500">Modalidade: {c.aluno.modalidadeId?.nome || '—'}</div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => {
                    // choose to create new student
                    if (pendingAlunoResolve.current) pendingAlunoResolve.current({ action: 'create' });
                    setConfirmAlunoDialog(null);
                    pendingAlunoResolve.current = null;
                  }}
                  className="px-3 py-1 border rounded text-sm"
                >Criar novo</button>
                <button
                  onClick={() => {
                    // skip this name
                    if (pendingAlunoResolve.current) pendingAlunoResolve.current({ action: 'skip' });
                    setConfirmAlunoDialog(null);
                    pendingAlunoResolve.current = null;
                  }}
                  className="px-3 py-1 border rounded text-sm"
                >Pular</button>
                <button
                  onClick={() => {
                    // use existing (first candidate)
                    const chosen = confirmAlunoDialog.candidates[0];
                    if (pendingAlunoResolve.current) pendingAlunoResolve.current({ action: 'use', alunoId: chosen.aluno._id });
                    setConfirmAlunoDialog(null);
                    pendingAlunoResolve.current = null;
                  }}
                  className="px-3 py-1 bg-primary-600 text-white rounded text-sm"
                >Usar: {confirmAlunoDialog.candidates[0].aluno.nome}</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingMode === 'turma' ? 'Editar Turma' : editingMode === 'single' ? 'Editar Horário' : 'Cadastrar Nova Turma'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  {editingMode === 'turma' ? (
                    <p className="text-sm text-gray-600">Editando a turma selecionada. As alterações serão aplicadas a todos os alunos dessa turma.</p>
                  ) : editingMode === 'single' ? (
                    <p className="text-sm text-gray-600">Editando o horário selecionado.</p>
                  ) : null }
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Professor</label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {professores.map((professor) => {
                      const selected = formData.professorId === professor._id;
                      return (
                        <button
                          key={professor._id}
                          type="button"
                          onClick={() => setFormData({...formData, professorId: professor._id})}
                          className={`px-3 py-1 text-sm rounded border ${selected ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200'} hover:shadow-sm`}
                          aria-pressed={selected}
                        >
                          {professor.nome}
                        </button>
                      );
                    })}
                  </div>
                  {formData.professorId ? (
                    <input type="hidden" name="professorId" value={formData.professorId} required />
                  ) : (
                    <div className="text-red-500 text-xs mt-1">Selecione um professor</div>
                  )}
                { /* Hidden modalidadeId to be sent on create */ }
                <input type="hidden" name="modalidadeId" value={formData.modalidadeId || modalidadeSelecionada || ''} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Dia da Semana</label>
                  {(() => {
                    const avail = getModalidadeAvailability();
                    return (
                      <select
                        value={formData.diaSemana}
                        onChange={(e) => setFormData({...formData, diaSemana: parseInt(e.target.value)})}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                        required
                      >
                        {avail.days.map((index: number) => (
                          <option key={index} value={index}>
                            {diasSemana[index]}
                          </option>
                        ))}
                      </select>
                    );
                  })()}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Horário Início</label>
                    <select
                      value={formData.horarioInicio}
                      onChange={(e) => {
                        const newInicio = e.target.value;
                        // compute default fim based on modalidade duration (minutes)
                        let defaultFim = formData.horarioFim;
                        try {
                          const modId = formData.modalidadeId || modalidadeSelecionada || '';
                          const mod = modalidades.find(m => getMid(m) === modId) as any;
                          const dur = mod && typeof mod.duracao === 'number' ? mod.duracao : undefined;
                          if (dur && newInicio) {
                            const startMinutes = timeToMinutes(newInicio);
                            const endMinutes = startMinutes + dur;
                            // find the smallest slot in horariosDisponiveis that is >= endMinutes
                            const candidate = horariosDisponiveis.find(h => timeToMinutes(h) >= endMinutes);
                            if (candidate) defaultFim = candidate;
                          }
                        } catch (err) {
                          // ignore and keep existing horarioFim
                        }
                        setFormData({...formData, horarioInicio: newInicio, horarioFim: defaultFim});
                      }}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      required
                    >
                      <option value="">Selecione</option>
                      {getModalidadeAvailability().times.map((horario) => (
                        <option key={horario} value={horario}>
                          {horario}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Horário Fim</label>
                    <select
                      value={formData.horarioFim}
                      onChange={(e) => setFormData({...formData, horarioFim: e.target.value})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      required
                    >
                      <option value="">Selecione</option>
                      {getModalidadeAvailability().times.map((horario) => (
                        <option key={horario} value={horario}>
                          {horario}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Show per-aluno observations only when creating/editing a single aluno, not when editing the whole turma */}
                {editingMode !== 'turma' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Observações</label>
                    <textarea
                      value={formData.observacoes}
                      onChange={(e) => setFormData({...formData, observacoes: e.target.value})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      rows={2}
                      placeholder="Observações opcionais..."
                    />
                  </div>
                )}

                {editingMode === 'turma' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Observação da Turma (visível para toda a turma)</label>
                    <textarea
                      value={formData.observacaoTurma}
                      onChange={(e) => setFormData({...formData, observacaoTurma: e.target.value})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      rows={2}
                      placeholder="Observação que será aplicada à turma inteira..."
                    />
                  </div>
                )}

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => { setShowModal(false); setEditingMode('create'); setEditingMemberIds(null); setSelectedHorarioId(null); }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                  >
                    {loading ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal de importação em lote */}
      {showImportModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-16 mx-auto p-6 border w-[720px] shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Importar Turma (colar nomes)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Cole os nomes (uma linha por aluno)</label>
                <textarea
                  value={importText}
                  onChange={e => setImportText(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  rows={6}
                  placeholder={`Ex:\nJoão Silva\nMaria Souza\n...`}
                />
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-xs text-gray-500">Linhas detectadas: {importEntries.length}.</p>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setImportEntries(prev => prev.map(p => ({...p, selected: true})))} className="text-xs text-primary-600">Selecionar todos</button>
                    <button type="button" onClick={() => setImportEntries(prev => prev.map(p => ({...p, selected: false})))} className="text-xs text-gray-600">Desmarcar</button>
                  </div>
                </div>
                <div className="mt-2 max-h-40 overflow-y-auto border rounded p-2 bg-white">
                  {importEntries.length === 0 && <div className="text-xs text-gray-500">Nenhuma linha detectada ainda.</div>}
                  {importEntries.map((entry, idx) => (
                    <div key={entry.id} className="flex items-start gap-2 mb-2">
                      <input type="checkbox" checked={entry.selected} onChange={e => setImportEntries(prev => prev.map(p => p.id === entry.id ? {...p, selected: e.target.checked} : p))} className="mt-1" />
                      <div className="flex-1">
                        <input value={entry.name} onChange={e => setImportEntries(prev => prev.map(p => p.id === entry.id ? {...p, name: e.target.value} : p))} className="w-full border border-gray-200 rounded px-2 py-1 text-sm" />
                        <div className="mt-1 flex items-center gap-2">
                          <select value={entry.alunoId || ''} onChange={e => setImportEntries(prev => prev.map(p => p.id === entry.id ? {...p, alunoId: e.target.value || undefined} : p))} className="text-xs border border-gray-200 rounded px-2 py-1">
                            <option value="">— selecionar aluno (opcional) —</option>
                            {alunos.slice(0,200).map(a => (
                              <option key={a._id} value={a._id}>{a.nome}</option>
                            ))}
                          </select>
                          <button type="button" onClick={() => setImportEntries(prev => prev.map(p => p.id === entry.id ? {...p, selected: false} : p))} className="text-xs text-red-600">Remover</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Professor</label>
                <select
                  value={importProfessorId}
                  onChange={e => handleImportProfessorChange(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="">Selecione um professor</option>
                  {professores.map(p => (
                    <option key={p._id} value={p._id}>{p.nome}</option>
                  ))}
                </select>

                <label className="block text-sm font-medium text-gray-700 mt-4">Modalidade (opcional)</label>
                <select
                  value={importModalidadeId}
                  onChange={e => setImportModalidadeId(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="">Nenhuma</option>
                  {modalidades.map(m => (
                    <option key={m._id} value={m._id}>{m.nome}</option>
                  ))}
                </select>

                <label className="block text-sm font-medium text-gray-700 mt-4">Dia da semana</label>
                <select
                  value={importDiaSemana}
                  onChange={e => setImportDiaSemana(parseInt(e.target.value))}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  {diasSemana.map((d, i) => (
                    <option key={i} value={i}>{d}</option>
                  ))}
                </select>

                <label className="block text-sm font-medium text-gray-700 mt-4">Horário Início</label>
                <select
                  value={importHorarioInicio}
                  onChange={e => setImportHorarioInicio(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="">Selecione</option>
                  {horariosDisponiveis.map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>

                <label className="block text-sm font-medium text-gray-700 mt-4">Horário Fim</label>
                <select
                  value={importHorarioFim}
                  onChange={e => setImportHorarioFim(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="">Selecione</option>
                  {horariosDisponiveis.map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => { setShowImportModal(false); setImportText(''); setImportResults(null); }}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >Cancelar</button>
              <button
                type="button"
                disabled={importing || !importProfessorId || !importHorarioInicio || !importHorarioFim || importEntries.filter(e=>e.selected).length===0}
                onClick={handleImportClick}
                className="px-4 py-2 bg-primary-600 text-white rounded-md disabled:opacity-50"
              >{importing ? 'Importando...' : `Importar (${importEntries.filter(e=>e.selected).length})`}</button>
            </div>

            {importResults && (
              <div className="mt-4 bg-gray-50 p-3 rounded">
                <div className="text-sm">Sucesso: {importResults.successes}</div>
                <div className="text-sm">Falhas: {importResults.failures.length}</div>
                {importResults.failures.length > 0 && (
                  <div className="mt-2 text-xs text-red-600">
                    {importResults.failures.map(f => <div key={f.name}>{f.name}: {f.reason}</div>)}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      )}

      {/* Modal: adicionar um aluno individualmente (search/create) */}
      {showAddSingleAlunoModal && addAlunoTurma && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-24 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Adicionar um aluno</h3>
            <div className="space-y-3">
              <div className="text-sm text-gray-700">
                Escolha um aluno existente ou crie um novo. Se criar um novo, confirme explicitamente para evitar duplicatas.
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-3">
                  <span className="text-sm">Usar existente</span>
                  <div className="relative">
                    <input
                      type="checkbox"
                      role="switch"
                      aria-checked={singleAddMode === 'create'}
                      checked={singleAddMode === 'create'}
                      onChange={(e) => { setSingleAddMode(e.target.checked ? 'create' : 'select'); if (e.target.checked) { setSingleAlunoSelectedId(null); setSingleAlunoSearch(''); } else { setSingleAlunoName(''); } }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 rounded-full peer-checked:bg-primary-600 peer-focus:ring-2 peer-focus:ring-primary-300 transition-colors"></div>
                    <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow transform transition-transform peer-checked:translate-x-5"></div>
                  </div>
                  <span className="text-sm">Criar novo</span>
                </label>
              </div>
              {singleAddMode === 'select' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Pesquisar aluno existente</label>
                  <input
                    value={singleAlunoSearch}
                    onChange={(e) => { setSingleAlunoSearch(String(e.target.value || '')); setSingleAlunoSelectedId(null); }}
                    placeholder="Digite para pesquisar..."
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                  {singleAlunoSearch && (
                    <div className="mt-2 max-h-40 overflow-y-auto border rounded p-1 bg-white">
                      {(alunos || []).filter(a => String(a.nome || '').toLowerCase().includes(singleAlunoSearch.toLowerCase())).slice(0,10).map(a => (
                        <div key={a._id} className={`p-2 rounded hover:bg-gray-50 ${singleAlunoSelectedId === a._id ? 'bg-primary-50' : 'cursor-pointer'}`} onClick={() => { setSingleAlunoSelectedId(a._id); setSingleAlunoName(a.nome); }}>
                          <div className="text-sm font-medium">{a.nome}</div>
                          <div className="text-xs text-gray-500">{a.email || ''}</div>
                        </div>
                      ))}
                      {(alunos || []).filter(a => String(a.nome || '').toLowerCase().includes(singleAlunoSearch.toLowerCase())).length === 0 && (
                        <div className="p-2 text-xs text-gray-500">Nenhum aluno encontrado — será criado ao salvar</div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {singleAddMode === 'create' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nome do aluno</label>
                  <input value={singleAlunoName} onChange={(e) => setSingleAlunoName(String(e.target.value || ''))} className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2" />
                  <div className="mt-2 text-xs text-yellow-700">Você está prestes a criar um novo aluno — verifique se não existe um registro similar.</div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">Observações</label>
                <input value={singleAlunoObservacoes} onChange={(e) => setSingleAlunoObservacoes(String(e.target.value || ''))} className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2" />
              </div>

              <div className="flex justify-end space-x-2">
                <button onClick={() => { setShowAddSingleAlunoModal(false); setSingleAlunoSearch(''); setSingleAlunoSelectedId(null); setSingleAlunoName(''); setSingleAlunoObservacoes(''); }} className="px-3 py-1 border rounded">Cancelar</button>
                <button
                  onClick={async () => {
                    try {
                      setLoading(true);
                      // Validation: if mode is 'select', require singleAlunoSelectedId
                      if (singleAddMode === 'select') {
                        if (!singleAlunoSelectedId) { alert('Selecione um aluno existente antes de prosseguir.'); return; }
                      }
                      let alunoId = singleAlunoSelectedId;
                      if (singleAddMode === 'create') {
                        if (singleAddMode === 'create' && !singleAlunoName) { alert('Insira o nome do novo aluno antes de prosseguir.'); return; }
                        // create aluno
                        const resp = await fetch('/api/alunos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: (singleAlunoName || singleAlunoSearch || '').toUpperCase() }) });
                        const data = await resp.json();
                        if (!data.success) throw new Error(data.error || 'Falha ao criar aluno');
                        alunoId = data.data._id;
                        setAlunos(prev => [...prev, data.data]);
                      }

                      if (!alunoId) { alert('Aluno não selecionado/criado.'); return; }

                      // create horario record linking aluno to turma slot
                      const horarioResp = await fetch('/api/horarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ alunoId, professorId: addAlunoTurma.professorId, diaSemana: addAlunoTurma.diaSemana, horarioInicio: addAlunoTurma.horarioInicio, horarioFim: addAlunoTurma.horarioFim, observacoes: singleAlunoObservacoes || '', modalidadeId: modalidadeSelecionada || undefined }) });
                      const horarioData = await horarioResp.json();
                      if (!horarioData.success) throw new Error(horarioData.error || 'Erro ao adicionar horário');

                      // cleanup and refresh
                      setShowAddSingleAlunoModal(false);
                      setSingleAlunoSearch(''); setSingleAlunoSelectedId(null); setSingleAlunoName(''); setSingleAlunoObservacoes('');
                      await fetchHorarios();
                    } catch (err:any) {
                      alert('Erro: ' + (err.message || 'erro'));
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="px-3 py-1 bg-primary-600 text-white rounded disabled:opacity-50"
                  disabled={(singleAddMode === 'select' && !singleAlunoSelectedId) || (singleAddMode === 'create' && !singleAlunoName)}
                >Adicionar</button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Student detail modal (cleaned up) */}
      {showStudentDetailModal && selectedStudentHorario && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" style={{ zIndex: 9999 }} onClick={() => setShowStudentDetailModal(false)}>
    <div className="relative top-24 mx-auto p-6 border w-96 max-w-full shadow-lg rounded-md bg-white" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="student-detail-title">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <h3 id="student-detail-title" className="text-lg font-semibold text-slate-800">Detalhes do aluno</h3>
                {/* edit icon next to title */}
                <button
                  onClick={() => setModalEditing(prev => !prev)}
                  title={modalEditing ? 'Cancelar edição' : 'Editar'}
                  aria-label={modalEditing ? 'Cancelar edição' : 'Editar'}
                  className={`p-1 rounded ${modalEditing ? 'text-primary-700 bg-primary-100' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                  </svg>
                </button>
              </div>
              <div className="ml-4">
                <button onClick={() => setShowStudentDetailModal(false)} className="text-slate-500 hover:text-slate-700" aria-label="Fechar">
                  <i className="fas fa-times" />
                </button>
              </div>
            </div>

            {(() => {
              const alunoName = selectedStudentHorario.alunoId?.nome || selectedStudentHorario.aluno?.nome || selectedStudentHorario.nome || null;
              const alunoEmail = selectedStudentHorario.alunoId?.email || selectedStudentHorario.aluno?.email || selectedStudentHorario.email || null;
              const modalidadeId = selectedStudentHorario.modalidadeId || selectedStudentHorario.aluno?.modalidadeId || selectedStudentHorario.modalidade || null;
              const modalidadeObj = modalidades.find(m => getMid(m) === String(modalidadeId));
              const modalidadeNome = modalidadeObj ? (modalidadeObj.nome || '') : (selectedStudentHorario.modalidadeNome || '—');
              const professorNome = selectedStudentHorario.professorNome || selectedStudentHorario.professor?.nome || '—';
              const dia = typeof selectedStudentHorario.diaSemana === 'number' ? diasSemana[selectedStudentHorario.diaSemana] : (selectedStudentHorario.diaSemana || '—');
              const horarioRange = `${selectedStudentHorario.horarioInicio || selectedStudentHorario.horarioInicio || '—'}${selectedStudentHorario.horarioFim ? ' — ' + selectedStudentHorario.horarioFim : ''}`;
              const _toggleId = selectedStudentHorario._id;
              const _isCongelado = !!localFlags[_toggleId]?.congelado;
              const _isAusente = !!localFlags[_toggleId]?.ausente;

              // collect all horarios for this aluno (student can have multiple horarios/modalidades)
              const studentId = (selectedStudentHorario.alunoId && (selectedStudentHorario.alunoId as any)._id) || (selectedStudentHorario.aluno && (selectedStudentHorario.aluno as any)._id) || null;
              const studentHorarios = studentId ? (horarios || []).filter((h: any) => {
                try {
                  const aid = (h.alunoId && (h.alunoId as any)._id) || h.alunoId;
                  return aid && String(aid) === String(studentId);
                } catch (e) { return false; }
              }) : [];
              const studentModalidades = Array.from(new Set(studentHorarios.map((h: any) => {
                const mid = (h.modalidadeId && ((h.modalidadeId.id || h.modalidadeId._id) || h.modalidadeId)) || (h.alunoId && (h.alunoId as any).modalidadeId) || h.modalidadeId || null;
                return mid ? String(mid) : null;
              }).filter(Boolean)));

              {/* modal fields are initialized by a top-level useEffect when selection changes */}

              return (
                <div className="mt-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm text-gray-500">Nome</div>
                      {!modalEditing ? (
                        <div className="font-medium text-slate-800">{alunoName ? alunoName : <span className="text-gray-400 italic">Nome não informado</span>}</div>
                      ) : (
                        <input value={modalEditName} onChange={e => setModalEditName(e.target.value)} className="w-full border rounded px-2 py-1" />
                      )}

                      {/* toggles moved below the name for better layout */}
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          onClick={() => { toggleCongelado(_toggleId); }}
                          aria-pressed={_isCongelado}
                          title={_isCongelado ? 'Descongelar' : 'Congelar'}
                          className={`px-3 py-1 border rounded text-sm flex items-center gap-2 ${_isCongelado ? 'bg-sky-100 border-sky-300 text-sky-800' : 'bg-white hover:bg-gray-50'}`}
                        >
                          {_isCongelado ? 'Descongelar' : 'Congelar'}
                        </button>

                        <button
                          onClick={() => { toggleAusente(_toggleId); }}
                          aria-pressed={_isAusente}
                          title={_isAusente ? 'Presente' : 'Ausente'}
                          className={`px-3 py-1 border rounded text-sm flex items-center gap-2 ${_isAusente ? 'bg-rose-100 border-rose-300 text-rose-700' : 'bg-white hover:bg-gray-50'}`}
                        >
                          {_isAusente ? 'Presente' : 'Ausente'}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {modalEditing ? null : null}
                    </div>
                  </div>

                  {/* Email removed by user request. Aggregated modalidades/horarios remain below. */}

                  <div className="mt-3 text-sm text-gray-500">Observações</div>
                  {!modalEditing ? (
                    <div className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{selectedStudentHorario.observacoes ? selectedStudentHorario.observacoes : <span className="text-gray-400 italic">Sem observações</span>}</div>
                  ) : (
                    <div className="mt-1">
                      <textarea value={modalEditObservacoes} onChange={e => setModalEditObservacoes(e.target.value)} className="w-full border rounded px-2 py-1 text-sm" rows={4} />
                      <div className="mt-2 flex gap-2 justify-end">
                        <button onClick={async () => {
                          // save observations
                          try {
                            await updateHorarioObservacoes(selectedStudentHorario._id, modalEditObservacoes);
                            setModalEditing(false);
                          } catch (e) { alert('Erro ao salvar observações'); }
                        }} className="px-3 py-1 bg-primary-600 text-white rounded text-sm">Salvar</button>
                        <button onClick={() => { setModalEditObservacoes(String(selectedStudentHorario.observacoes || '')); setModalEditing(false); }} className="px-3 py-1 border rounded text-sm">Cancelar</button>
                      </div>
                    </div>
                  )}
                  {/* Student can have multiple modalidades/horarios - list them */}
                  <div className="mt-4">
                    <div className="mt-3 text-sm text-gray-500">Horários do aluno</div>
                    <div className="mt-2 space-y-2">
                      {studentHorarios.length === 0 ? (
                        <div className="text-[12px] text-gray-500">Nenhum horário encontrado</div>
                      ) : (
                        studentHorarios.map((sh: any) => {
                          const mod = modalidades.find(m => getMid(m) === (sh.modalidadeId && ((sh.modalidadeId.id || sh.modalidadeId._id) || sh.modalidadeId)));
                          return (
                            <div key={String(sh._id)} className="p-2 rounded border border-gray-100 bg-white text-sm">
                              <div className="flex items-center justify-between">
                                <div className="min-w-0">
                                  <div className="text-[12px] text-gray-600">{diasSemana[sh.diaSemana]} • {sh.horarioInicio}{sh.horarioFim ? ' — ' + sh.horarioFim : ''}</div>
                                  <div className="text-[12px] text-gray-600">{sh.professorNome || (sh.professorId && (sh.professorId as any)?.nome) || ''}</div>
                                </div>
                                <div className="ml-2 text-[12px] text-gray-700">{mod?.nome || (sh.modalidadeNome || '')}</div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="mt-5 border-t pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Remove button left-aligned */}
                <button onClick={() => { if (confirm('REMOVER ALUNO DA TURMA?')) { deleteHorario(selectedStudentHorario._id); setShowStudentDetailModal(false); } }} className="px-3 py-1 bg-red-600 text-white rounded text-sm">REMOVER ALUNO DA TURMA</button>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* footer has no Save/Close as edits are inline */}
              </div>
            </div>
          </div>
        </div>
      )}

      </Layout>
    </>
  );
}