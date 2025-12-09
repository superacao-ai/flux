"use client";

import { useState, useEffect, useRef, useMemo, useId } from 'react';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import StudentDetailModal from '@/components/StudentDetailModal';
import AlunoRowModal from '@/components/AlunoRowModal';
import ProtectedPage from '@/components/ProtectedPage';
import { permissoesHorarios } from '@/lib/permissoes';

interface Aluno {
  _id: string;
  nome: string;
  email: string;
  modalidadeId: {
    _id: string;
    nome: string;
    cor: string;
  };
  periodoTreino?: string | null;
  parceria?: string | null;
  congelado?: boolean;
  ausente?: boolean;
  emEspera?: boolean;
}

interface Professor {
  _id: string;
  nome: string;
  especialidade: string;
  cor?: string;
}

interface Modalidade {
  _id: string;
  nome: string;
  cor: string;
  duracao: number;
  limiteAlunos: number;
  modalidadesVinculadas?: string[];
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
  congelado?: boolean;
  ausente?: boolean;
  emEspera?: boolean;
  limiteAlunos?: number; // Limite específico da turma (sobrescreve modalidade)
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
  // Don't read localStorage during render — initialize to safe default and hydrate on mount
  const [modalidadeSelecionada, setModalidadeSelecionada] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  // Estado para modal de detalhes do aluno (linha da tabela)
  const [showAlunoRowModal, setShowAlunoRowModal] = useState(false);
  const [alunoRowModalId, setAlunoRowModalId] = useState<string | null>(null);
  // blocked slots state: keyed by `${horarioSlot}-${dayIndex}`
  const [blockedSlots, setBlockedSlots] = useState<Record<string, boolean>>({});
  
  // Horários de modalidades vinculadas (conflito de espaço)
  // Estrutura: { [slotKey: string]: { modalidadeNome: string, modalidadeCor: string, horarioInicio: string, horarioFim: string } }
  const [horariosVinculados, setHorariosVinculados] = useState<Record<string, { modalidadeNome: string; modalidadeCor: string; horarioInicio: string; horarioFim: string }>>({});

  // Load persisted blocked slots from server when modalidade changes
  useEffect(() => {
    if (!modalidadeSelecionada) {
      setBlockedSlots({});
      return;
    }
    
    (async () => {
      try {
        const resp = await fetch(`/api/blocked-slots?modalidadeId=${modalidadeSelecionada}`);
        const j = await resp.json();
        if (j && j.success && j.data) {
          // j.data expected as map { slotKey: { horarioSlot, dayIndex, modalidadeId } }
          const map: Record<string, boolean> = {};
          for (const k of Object.keys(j.data)) map[k] = true;
          setBlockedSlots(map);
        } else {
          setBlockedSlots({});
        }
      } catch (e) {
        console.error('Erro ao buscar blocked-slots:', e);
        setBlockedSlots({});
      }
    })();
  }, [modalidadeSelecionada]);

  const toggleBlockSlot = async (horarioSlot: string, dayIndex: number) => {
    if (!modalidadeSelecionada) return;
    
    // slotKey agora inclui modalidadeId para ser único por modalidade
    const slotKey = `${horarioSlot}-${dayIndex}-${modalidadeSelecionada}`;
    
    try {
      const currently = !!blockedSlots[slotKey];
      if (currently) {
        const resp = await fetch(`/api/blocked-slots?slotKey=${encodeURIComponent(slotKey)}`, { method: 'DELETE' });
        const j = await resp.json();
        if (j && j.success) {
          setBlockedSlots(prev => {
            const next = { ...(prev || {}) };
            delete next[slotKey];
            return next;
          });
        } else {
          toast.error('Erro ao desbloquear horário');
        }
      } else {
        const resp = await fetch('/api/blocked-slots', {
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify({ slotKey, horarioSlot, dayIndex, modalidadeId: modalidadeSelecionada })
        });
        const j = await resp.json();
        if (j && j.success) {
          setBlockedSlots(prev => ({ ...(prev || {}), [slotKey]: true }));
        } else {
          toast.error('Erro ao bloquear horário');
        }
      }
    } catch (e) {
      console.error('toggleBlockSlot error', e);
      toast.error('Erro ao atualizar bloqueio');
    }
  };

  // Função para centralizar elemento clicado na tela
  const scrollToCenter = (event: React.MouseEvent<HTMLElement>) => {
    const element = event.currentTarget;
    const rect = element.getBoundingClientRect();
    const elementCenter = rect.top + rect.height / 2;
    const viewportCenter = window.innerHeight / 2;
    const scrollOffset = elementCenter - viewportCenter;
    
    window.scrollBy({
      top: scrollOffset,
      behavior: 'smooth'
    });
  };

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
    modalidadeId: '',
    limiteAlunos: '' as string | number // Limite específico da turma (opcional)
  });
  const [loading, setLoading] = useState(false);
  const [bulkAlunoText, setBulkAlunoText] = useState('');
  const [showAddAlunoModal, setShowAddAlunoModal] = useState(false);
  const [showAddSingleAlunoModal, setShowAddSingleAlunoModal] = useState(false);
  const [singleAlunoSearch, setSingleAlunoSearch] = useState('');
  const [singleAlunoSelectedId, setSingleAlunoSelectedId] = useState<string | null>(null);
  const [singleAlunoName, setSingleAlunoName] = useState('');
  const [singleAlunoObservacoes, setSingleAlunoObservacoes] = useState('');
  
  const [showStudentDetailModal, setShowStudentDetailModal] = useState(false);
  const [selectedStudentHorario, setSelectedStudentHorario] = useState<any | null>(null);
  const [mobileDiaSelecionado, setMobileDiaSelecionado] = useState<number>(new Date().getDay()); // Dia atual por padrão
  const [mobileExpandedCards, setMobileExpandedCards] = useState<Set<string>>(new Set()); // Cards expandidos no mobile
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

  // Expose a global helper so other pages (calendar) can open the student modal
  useEffect(() => {
    (window as any).openStudentDetailModal = (horario: any) => {
      try {
        setSelectedStudentHorario(horario);
        setShowStudentDetailModal(true);
        // Scroll modal into view
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (e) {
        console.error('openStudentDetailModal error', e);
      }
    };

    // If another page set window.selectedStudentHorario and navigated here, open the modal
    try {
      const pending = (window as any).selectedStudentHorario;
      if (pending) {
        setSelectedStudentHorario(pending);
        setShowStudentDetailModal(true);
        // clear
        delete (window as any).selectedStudentHorario;
      }
    } catch (e) {}

    return () => {
      try { delete (window as any).openStudentDetailModal; } catch (e) {}
    };
  }, []);
  
  const [novoHorarioAlunosText, setNovoHorarioAlunosText] = useState('');
  const [addAlunoTurma, setAddAlunoTurma] = useState<{professorId?: string, diaSemana?: number, horarioInicio?: string, horarioFim?: string} | null>(null);
  const [bulkAlunoTextAdd, setBulkAlunoTextAdd] = useState('');
  // parsed entries for the per-turma bulk add modal
  const [bulkImportEntries, setBulkImportEntries] = useState<Array<{ id: string; name: string; obs?: string; selected: boolean; alunoId?: string; observacoesAluno?: string; parceria?: string | null; congelado?: boolean; ausente?: boolean; emEspera?: boolean }>>([]);
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
      const nameLower = name.toLowerCase();
      
      // Busca inteligente: primeiro tenta correspondência exata, depois por similaridade
      let found = alunos.find(a => String(a.nome || '').trim().toLowerCase() === nameLower);
      
      // Se não encontrou exato, tentar busca por similaridade (todas as palavras coincidem)
      if (!found && nameLower.length >= 3) {
        const nameWords = nameLower.split(/\s+/).filter(w => w.length >= 2);
        if (nameWords.length > 0) {
          found = alunos.find(a => {
            const alunoWords = String(a.nome || '').toLowerCase().split(/\s+/);
            // Todas as palavras do nome digitado devem estar presentes no nome do aluno
            return nameWords.every(w => alunoWords.some(aw => aw.includes(w) || w.includes(aw)));
          });
        }
      }
      
      return { 
        id: `bulk-${idCounter.current++}-${idx}`, 
        name, 
        obs, 
        selected: true, 
        alunoId: found ? found._id : undefined,
        observacoesAluno: found ? (found as any).observacoes || '' : '',
        parceria: found ? (found as any).parceria || null : null,
        congelado: found ? (found as any).congelado || false : false,
        ausente: found ? (found as any).ausente || false : false,
        emEspera: found ? (found as any).emEspera || false : false
      };
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
  
  // Estado para modal de montar grade do professor em lote
  const [showGradeProfessorModal, setShowGradeProfessorModal] = useState(false);
  const [gradeProfessorId, setGradeProfessorId] = useState<string>('');
  const [gradeSlotsSelected, setGradeSlotsSelected] = useState<Set<string>>(new Set());
  const [gradeLoading, setGradeLoading] = useState(false);
  // parsed entries for import modal: allow selecting which lines to import and mapping to existing alunos
  const [importEntries, setImportEntries] = useState<Array<{ id: string; name: string; selected: boolean; alunoId?: string }>>([]);

  // parse importText into importEntries when text changes or modal opens
  useEffect(() => {
    if (!showImportModal) return;
    const lines = String(importText || '').split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    const parsed = lines.map((ln, idx) => {
      // try to find an exact aluno match
      const found = alunos.find(a => String(a.nome || '').trim().toLowerCase() === ln.trim().toLowerCase());
      return { id: `entry-${idCounter.current++}-${idx}`, name: ln, selected: true, alunoId: found ? found._id : undefined };
    });
    setImportEntries(parsed);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showImportModal, importText]);
  const [mounted, setMounted] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  // Contador para gerar IDs previsíveis
  const idCounter = useRef(0);
  // local visual flags for quick toggles (not persisted) keyed by horarioId
  const [localFlags, setLocalFlags] = useState<Record<string, { congelado?: boolean; ausente?: boolean; emEspera?: boolean }>>({});
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
  // Helper to resolve modalidade color (accepts modalidade object, id or nome)
  const getModalidadeColor = (m: any) => {
    try {
      if (!m) return '#3B82F6';
      // If m is an object with id/_id, try to match by id
      const mid = (m && ((m as any).id || (m as any)._id)) || m;
      if (!modalidades || modalidades.length === 0) return '#3B82F6';
      const found = modalidades.find(md => {
        const mdId = (md as any).id || (md as any)._id || '';
        if (mdId && String(mdId) === String(mid)) return true;
        if ((md as any).nome && String((md as any).nome).toLowerCase() === String(m).toLowerCase()) return true;
        return false;
      });
      return (found && ((found as any).cor || (found as any).color)) || '#3B82F6';
    } catch (e) {
      return '#3B82F6';
    }
  };
  // Horário de funcionamento (início/fim) - usados para filtrar linhas exibidas na grade
  // Avoid client-only APIs during SSR render — use defaults and sync from storage on mount
  const [openTime, setOpenTime] = useState<string>('06:00');
  const [closeTime, setCloseTime] = useState<string>('22:00');

      // ...existing code...



  // ...existing code...




  const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const todayIndex = new Date().getDay(); // 0=Domingo .. 6=Sábado
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
  // Return the step in minutes to use for the schedule grid based on modalidade.duracao.
  // Falls back to 30 if not available or invalid. Allowed steps: 5,10,15,20,30,60.
  const getCurrentStep = (modalidadeId?: string) => {
    try {
      const mid = modalidadeId || formData.modalidadeId || modalidadeSelecionada || '';
      if (!mid) return 30;
      const mod = modalidades.find(m => getMid(m) === mid) as any;
      if (!mod) return 30;
      const dur = typeof mod.duracao === 'number' ? Number(mod.duracao) : parseInt(String(mod.duracao || '30'));
      const allowed = [5, 10, 15, 20, 30, 60];
      return allowed.includes(dur) ? dur : 30;
    } catch (e) {
      return 30;
    }
  };

  const horariosDisponiveis = generateTimes('00:00', '23:30', getCurrentStep());

  const timeToMinutes = (t: string) => {
    const [hh, mm] = (t || '00:00').split(':').map(Number);
    return hh * 60 + mm;
  };

  

  const getVisibleHorarios = () => {
    try {
      const o = timeToMinutes(openTime);
      const c = timeToMinutes(closeTime);
    if (o >= c) return horariosDisponiveis; // If interval is invalid (open >= close) show full day
    return horariosDisponiveis.filter(h => {
      const m = timeToMinutes(h);
      return m >= o && m <= c; // include slots that start within operating hours (include endpoint)
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
          const slots = generateTimes(start, end, getCurrentStep(mod._id || mid));
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

  // Marcar como montado imediatamente
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch data inicial
  useEffect(() => {
    const loadInitialData = async () => {
      setInitialLoading(true);
      try {
        await Promise.all([
          fetchHorarios(),
          fetchAlunos(),
          fetchProfessores(),
          fetchModalidades()
        ]);
      } catch (error) {
        console.error('Erro ao carregar dados iniciais:', error);
      } finally {
        setInitialLoading(false);
      }
    };
    loadInitialData();
  }, []);

  // Hydrate persisted UI state from localStorage on client mount
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const hOpen = localStorage.getItem('horarioOpen');
      const hClose = localStorage.getItem('horarioClose');
      if (hOpen) setOpenTime(hOpen);
      if (hClose) setCloseTime(hClose);
      const savedModal = localStorage.getItem('modalidadeSelecionada');
      if (savedModal) setModalidadeSelecionada(savedModal);
    } catch (e) {
      // ignore
    }
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

  // Buscar horários das modalidades vinculadas (conflito de espaço)
  useEffect(() => {
    if (!modalidadeSelecionada || modalidades.length === 0) {
      setHorariosVinculados({});
      return;
    }
    
    const mod = modalidades.find(m => getMid(m) === modalidadeSelecionada) as any;
    if (!mod || !mod.modalidadesVinculadas || mod.modalidadesVinculadas.length === 0) {
      setHorariosVinculados({});
      return;
    }
    
    // Buscar horários das modalidades vinculadas
    const fetchHorariosVinculados = async () => {
      try {
        const vinculadasIds = mod.modalidadesVinculadas;
        const horariosMap: Record<string, { modalidadeNome: string; modalidadeCor: string; horarioInicio: string; horarioFim: string }> = {};
        
        for (const vinculadaId of vinculadasIds) {
          const vinculadaMod = modalidades.find(m => getMid(m) === vinculadaId);
          if (!vinculadaMod) continue;
          
          // Buscar horários dessa modalidade
          const resp = await fetch(`/api/horarios?modalidadeId=${vinculadaId}`);
          const json = await resp.json();
          const horariosData = (json && json.success && Array.isArray(json.data)) ? json.data : [];
          
          for (const h of horariosData) {
            if (!h.ativo) continue;
            const key = `${h.horarioInicio}-${h.diaSemana}`;
            horariosMap[key] = {
              modalidadeNome: vinculadaMod.nome,
              modalidadeCor: vinculadaMod.cor,
              horarioInicio: h.horarioInicio,
              horarioFim: h.horarioFim
            };
          }
        }
        
        setHorariosVinculados(horariosMap);
      } catch (err) {
        console.error('Erro ao buscar horários vinculados:', err);
        setHorariosVinculados({});
      }
    };
    
    fetchHorariosVinculados();
  }, [modalidadeSelecionada, modalidades]);

  // Ajustar mobileDiaSelecionado quando a modalidade mudar para garantir que seja um dia válido
  useEffect(() => {
    if (!modalidadeSelecionada || modalidades.length === 0) return;
    const mod = modalidades.find(m => getMid(m) === modalidadeSelecionada) as any;
    if (!mod) return;
    const diasDisponiveis: number[] = mod.diasSemana || [];
    // Se a modalidade tem dias definidos e o dia atual não está incluído, selecionar o primeiro dia disponível
    if (diasDisponiveis.length > 0 && !diasDisponiveis.includes(mobileDiaSelecionado)) {
      setMobileDiaSelecionado(diasDisponiveis[0]);
    }
  }, [modalidadeSelecionada, modalidades]);

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

  // When modality data changes elsewhere (another tab or page), re-fetch modalidades and horarios.
  // Also re-fetch when the tab becomes visible again (user returned after editing modalidades).
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        // re-sync latest modalidades and horarios when user returns to this tab
        fetchModalidades();
        fetchHorarios();
      }
    };

    const onStorageUpdated = (e: StorageEvent) => {
      // Convention: when /modalidades modifies data it should set localStorage.setItem('modalidadesUpdated', Date.now().toString())
      if (e.key === 'modalidadesUpdated') {
        try {
          fetchModalidades();
          fetchHorarios();
        } catch (err) {
          // ignore
        }
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('storage', onStorageUpdated);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('storage', onStorageUpdated);
    };
  }, []);

  const fetchHorarios = async () => {
    try {
      const url = modalidadeSelecionada ? `/api/horarios?modalidadeId=${modalidadeSelecionada}` : '/api/horarios';
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      if (data.success) {
        setHorarios(data.data);
        try { if (typeof window !== 'undefined') localStorage.setItem('horariosUpdated', Date.now().toString()); } catch(e) {}
        return data.data;
      }
    } catch (error) {
      // Silently ignore fetch errors (network issues, tab switching, etc.)
      if (error instanceof Error && error.message !== 'Failed to fetch') {
        console.error('Erro ao buscar horários:', error);
      }
    }
    return null;
  };

  // Função para abrir modal com dados atualizados do banco
  const openStudentDetailModal = async (horario: any, turma: any) => {
    setShowAddAlunoModal(false);
    setShowImportModal(false);
    setShowModalLote({open: false});
    
    const horarioFixoId = (horario as any).horarioFixoId || horario._id;
    try {
      const resp = await fetch(`/api/horarios/${horarioFixoId}`);
      if (!resp.ok) throw new Error('Falha ao buscar horário');
      const data = await resp.json();
      const fetchedHorario = data.data || data;
      
      const rawProfName = (turma && (turma.professorNome || (turma.professorId && (turma.professorId.nome || turma.professorId))) ) || '';
      // Verificar se rawProfName é um objeto válido ou apenas um ID (string de números)
      const isProfessorValid = rawProfName && typeof rawProfName === 'object' && rawProfName.nome;
      const isProfessorName = rawProfName && typeof rawProfName === 'string' && !/^[0-9a-f]{24}$/i.test(rawProfName);
      const professorDisplay = isProfessorValid ? rawProfName.nome : (isProfessorName ? rawProfName : 'Sem professor');
      
      const enriched = { 
        ...horario,
        ...fetchedHorario,
        professorNome: (professorDisplay && professorDisplay !== 'Sem professor') ? (String(professorDisplay).startsWith('Personal') ? String(professorDisplay) : 'Personal ' + String(professorDisplay)) : 'Sem professor',
        congelado: fetchedHorario.congelado === true,
        ausente: fetchedHorario.ausente === true,
        emEspera: fetchedHorario.emEspera === true
      };
      
      // Filtrar horários do aluno - verificar tanto alunoId direto quanto matriculas
      const alunoId = enriched.alunoId?._id || enriched.alunoId;
      const studentHorarios = horarios.filter((h: any) => {
        // Verificar alunoId direto
        const hAlunoId = h.alunoId?._id || h.alunoId;
        if (hAlunoId && String(hAlunoId) === String(alunoId)) return true;
        
        // Verificar em matriculas (para horários que só têm dados lá)
        if (h.matriculas && Array.isArray(h.matriculas)) {
          return h.matriculas.some((m: any) => {
            const mAlunoId = m.alunoId?._id || m.alunoId;
            return mAlunoId && String(mAlunoId) === String(alunoId);
          });
        }
        return false;
      });
      
      setSelectedStudentHorario(enriched);
      setShowStudentDetailModal(true);
    } catch (err) {
      console.error('Erro ao buscar horário:', err);
      // Fallback: usar o horário da grade mesmo assim
      const rawProfName = (turma && (turma.professorNome || (turma.professorId && (turma.professorId.nome || turma.professorId))) ) || '';
      // Verificar se rawProfName é um objeto válido ou apenas um ID (string de números)
      const isProfessorValid = rawProfName && typeof rawProfName === 'object' && rawProfName.nome;
      const isProfessorName = rawProfName && typeof rawProfName === 'string' && !/^[0-9a-f]{24}$/i.test(rawProfName);
      const professorDisplay = isProfessorValid ? rawProfName.nome : (isProfessorName ? rawProfName : 'Sem professor');
      
      const enriched = { 
        ...horario, 
        professorNome: (professorDisplay && professorDisplay !== 'Sem professor') ? (String(professorDisplay).startsWith('Personal') ? String(professorDisplay) : 'Personal ' + String(professorDisplay)) : 'Sem professor'
      };
      
      // Filtrar horários do aluno mesmo no fallback - verificar tanto alunoId direto quanto matriculas
      const alunoId = enriched.alunoId?._id || enriched.alunoId;
      const studentHorarios = horarios.filter((h: any) => {
        // Verificar alunoId direto
        const hAlunoId = h.alunoId?._id || h.alunoId;
        if (hAlunoId && String(hAlunoId) === String(alunoId)) return true;
        
        // Verificar em matriculas (para horários que só têm dados lá)
        if (h.matriculas && Array.isArray(h.matriculas)) {
          return h.matriculas.some((m: any) => {
            const mAlunoId = m.alunoId?._id || m.alunoId;
            return mAlunoId && String(mAlunoId) === String(alunoId);
          });
        }
        return false;
      });
      
      setSelectedStudentHorario(enriched);
      setShowStudentDetailModal(true);
    }
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
      // Buscar professores a partir de usuários (usuarios.tipo === 'professor')
      const respUsuarios = await fetch('/api/usuarios');
      const dataUsuarios = await respUsuarios.json();
      const usuariosList = (dataUsuarios && dataUsuarios.success && Array.isArray(dataUsuarios.data)) ? dataUsuarios.data : [];
      const normalized = usuariosList
        .filter((u: any) => String(u.tipo || '').toLowerCase() === 'professor')
        .map((u: any) => ({
          ...u,
          _id: String(u._id || u.id || ''),
          nome: u.nome || u.nome_completo || u.email || '—',
          cor: u.cor || u.color || '#3B82F6'
        }));
      setProfessores(normalized);
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
      professorId: String((rep as any).professorId?._id || (rep as any).professorId || ''),
      diaSemana: rep.diaSemana,
      horarioInicio: rep.horarioInicio,
      horarioFim: rep.horarioFim,
      observacoes: '',
      observacaoTurma: (turma as any).observacaoTurma || '',
      modalidadeId: '',
      limiteAlunos: rep.limiteAlunos || ''
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
      else toast.error('Erro ao excluir turma: ' + (data.error || 'erro'));
    } catch (err) {
      console.error('Erro ao excluir turma:', err);
      toast.error('Erro ao excluir turma');
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
    const prof = professores.find(p => String((p as any)._id || (p as any).id || '') === String(professorId || ''));
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

      // Prefer creating a Matricula for an existing HorarioFixo. If none exists, create a HorarioFixo (without alunoId) then matricula.
      try {
        const existing = horarios.find(h => {
          try {
            const rawProf = (h as any).professorId;
            const profId = rawProf && (rawProf._id || rawProf) ? String(rawProf._id || rawProf) : undefined;
            return profId === String(formData.professorId) && h.diaSemana === formData.diaSemana && h.horarioInicio === formData.horarioInicio && h.horarioFim === formData.horarioFim;
          } catch (e) { return false; }
        });

        let enrollResp: any = null;
        if (existing && existing._id) {
          const matResp = await fetch('/api/matriculas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ horarioFixoId: existing._id, alunoId: (resolvedAluno as Aluno)._id, observacoes: formData.observacoes || '' }) });
          enrollResp = await matResp.json();
        } else {
          // ensure professorId is a string and present
          const createPayload: any = { professorId: String(formData.professorId || ''), diaSemana: formData.diaSemana, horarioInicio: formData.horarioInicio, horarioFim: formData.horarioFim, observacoes: formData.observacoes || '', modalidadeId: formData.modalidadeId || modalidadeSelecionada || undefined };
          if (!createPayload.professorId) { failures.push({ name, reason: 'Professor não selecionado' }); continue; }
          const createResp = await fetch('/api/horarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(createPayload) });
          const created = await createResp.json();
          if (created && created.success && created.data && created.data._id) {
            const matResp = await fetch('/api/matriculas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ horarioFixoId: created.data._id, alunoId: (resolvedAluno as Aluno)._id, observacoes: formData.observacoes || '' }) });
            enrollResp = await matResp.json();
          } else {
            enrollResp = { success: false, error: created && created.error ? created.error : 'Falha ao criar horario' };
          }
        }

        if (enrollResp && enrollResp.success) {
          successes++;
        } else {
          failures.push({ name, reason: enrollResp && (enrollResp.error || enrollResp.message) ? (enrollResp.error || enrollResp.message) : 'Erro desconhecido' });
        }
      } catch (err:any) {
        failures.push({name, reason: err.message || 'Erro de requisição'});
      }
    }

    setLoading(false);
    setShowModal(false);
    setBulkAlunoText('');
    await fetchHorarios();

    // Mostrar resumo
    if (failures.length > 0) {
      Swal.fire({
        title: 'Importação Concluída',
        html: `<p>Importados: <strong>${successes}</strong></p><p>Falhas: <strong>${failures.length}</strong></p><ul style="text-align:left;max-height:200px;overflow:auto;">${failures.map(f => `<li>${f.name}: ${f.reason}</li>`).join('')}</ul>`,
        icon: successes > 0 ? 'warning' : 'error',
        confirmButtonColor: '#22c55e'
      });
    } else {
      toast.success(`Importados: ${successes} alunos com sucesso!`);
    }
  };

  const fetchModalidades = async () => {
    try {
      const response = await fetch('/api/modalidades');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      if (data.success) {
        setModalidades(data.data);
      }
    } catch (error) {
      // Silently ignore fetch errors (network issues, tab switching, etc.)
      if (error instanceof Error && error.message !== 'Failed to fetch') {
        console.error('Erro ao buscar modalidades:', error);
      }
    }
  };

  // NOTE: previously we converted usuario entries into canonical `professores` here.
  // That behavior was removed: we now send the selected `professorId` (which may be a User id)
  // and let the server resolve/populate it appropriately.

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check required fields before proceeding
    if (!formData.professorId) {
      toast.warning('Selecione um professor');
      return;
    }
    if (!formData.horarioInicio || !formData.horarioFim) {
      toast.warning('Selecione os horários de início e fim');
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
            observacaoTurma: (formData.observacaoTurma !== undefined ? formData.observacaoTurma : undefined),
            limiteAlunos: formData.limiteAlunos ? Number(formData.limiteAlunos) : undefined
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
            setFormData({ alunoId: '', professorId: '', diaSemana: 1, horarioInicio: '', horarioFim: '', observacoes: '', observacaoTurma: '', modalidadeId: '', limiteAlunos: '' });
            await fetchHorarios();
          } else {
            toast.error('Erro: ' + data.error);
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

            // Prefer creating a Matricula for an existing HorarioFixo. If none exists,
            // create the HorarioFixo without alunoId and then create the Matricula.
            try {
              const existing = horarios.find(h => {
                try {
                  const rawProf = (h as any).professorId;
                  const profId = rawProf && (rawProf._id || rawProf) ? String(rawProf._id || rawProf) : undefined;
                  return profId === String(formData.professorId) && h.diaSemana === formData.diaSemana && h.horarioInicio === formData.horarioInicio && h.horarioFim === formData.horarioFim;
                } catch (e) { return false; }
              });

              let enrollResp: any = null;
              if (existing && existing._id) {
                const matResp = await fetch('/api/matriculas', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ horarioFixoId: existing._id, alunoId: (aluno as Aluno)._id, observacoes: obsPart || formData.observacoes || '' })
                });
                enrollResp = await matResp.json();
              } else {
                // create HorarioFixo template without alunoId
                // create HorarioFixo template without alunoId
                const createPayload: any = { professorId: String(formData.professorId || ''), diaSemana: formData.diaSemana, horarioInicio: formData.horarioInicio, horarioFim: formData.horarioFim, observacoes: formData.observacoes || '', modalidadeId: formData.modalidadeId || modalidadeSelecionada || undefined };
                if (!createPayload.professorId) { failures.push({ name: namePart, reason: 'Professor não selecionado' }); continue; }
                const createResp = await fetch('/api/horarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(createPayload) });
                const created = await createResp.json();
                if (created && created.success && created.data && created.data._id) {
                  const matResp = await fetch('/api/matriculas', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ horarioFixoId: created.data._id, alunoId: (aluno as Aluno)._id, observacoes: obsPart || formData.observacoes || '' })
                  });
                  enrollResp = await matResp.json();
                } else {
                  enrollResp = { success: false, error: created && created.error ? created.error : 'Falha ao criar horario' };
                }
              }

              if (enrollResp && enrollResp.success) {
                successes++;
              } else {
                failures.push({ name: namePart, reason: enrollResp && (enrollResp.error || enrollResp.message) ? (enrollResp.error || enrollResp.message) : 'Erro desconhecido' });
              }
            } catch (err:any) {
              failures.push({name: namePart, reason: err.message || 'Erro de requisição'});
            }
          }

          setLoading(false);
          setShowModal(false);
          setNovoHorarioAlunosText('');
          setFormData({ alunoId: '', professorId: '', diaSemana: 1, horarioInicio: '', horarioFim: '', observacoes: '', observacaoTurma: '', modalidadeId: '', limiteAlunos: '' });
          await fetchHorarios();
          
          if (failures.length === 0) {
            toast.success(`${successes} aluno${successes !== 1 ? 's' : ''} adicionado${successes !== 1 ? 's' : ''} com sucesso!`);
          } else if (successes > 0) {
            toast.warning(`${successes} adicionado${successes !== 1 ? 's' : ''}, ${failures.length} falha${failures.length !== 1 ? 's' : ''}: ${failures.map(f => f.name).join(', ')}`);
          } else {
            toast.error(`Falha ao adicionar: ${failures.map(f => `${f.name} (${f.reason})`).join(', ')}`);
          }
          return;
        }

        // If a specific alunoId was provided, prefer enrolling via Matricula.
        // This prevents creating a HorarioFixo that carries alunoId directly.
        if (formData.alunoId && String(formData.alunoId).trim() !== '') {
          try {
            const existing = horarios.find(h => {
              try {
                const rawProf = (h as any).professorId;
                const profId = rawProf && (rawProf._id || rawProf) ? String(rawProf._id || rawProf) : undefined;
                return profId === String(formData.professorId) && h.diaSemana === formData.diaSemana && h.horarioInicio === formData.horarioInicio && h.horarioFim === formData.horarioFim;
              } catch (e) { return false; }
            });

            let enrollResp: any = null;
            if (existing && existing._id) {
              const matResp = await fetch('/api/matriculas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ horarioFixoId: existing._id, alunoId: formData.alunoId, observacoes: formData.observacoes || '' }) });
              enrollResp = await matResp.json();
            } else {
                  // ensure professorId references a canonical professor document
                  const createPayload: any = { professorId: String(formData.professorId || ''), diaSemana: formData.diaSemana, horarioInicio: formData.horarioInicio, horarioFim: formData.horarioFim, observacoes: formData.observacoes || '', modalidadeId: formData.modalidadeId || modalidadeSelecionada || undefined };
                  if (!createPayload.professorId) { toast.warning('Selecione um professor antes de criar a turma'); setLoading(false); return; }
              const createResp = await fetch('/api/horarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(createPayload) });
              const created = await createResp.json();
              if (created && created.success && created.data && created.data._id) {
                const matResp = await fetch('/api/matriculas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ horarioFixoId: created.data._id, alunoId: formData.alunoId, observacoes: formData.observacoes || '' }) });
                enrollResp = await matResp.json();
              } else {
                enrollResp = { success: false, error: created && created.error ? created.error : 'Falha ao criar horario' };
              }
            }

            if (!enrollResp || !enrollResp.success) {
              const message = enrollResp && (enrollResp.error || enrollResp.message) ? (enrollResp.error || enrollResp.message) : 'Erro ao criar/inscrever aluno';
              toast.error('Erro ao criar horário: ' + message);
              setLoading(false);
              return;
            }

            // Success: close modal and refresh
            setShowModal(false);
            setFormData({ alunoId: '', professorId: '', diaSemana: 1, horarioInicio: '', horarioFim: '', observacoes: '', observacaoTurma: '', modalidadeId: '', limiteAlunos: '' });
            await fetchHorarios();
            setLoading(false);
            return;
          } catch (err:any) {
            console.error('Erro ao criar horario/matricula:', err);
            toast.error('Erro ao criar horário: ' + (err && err.message ? err.message : 'erro'));
            setLoading(false);
            return;
          }
        }

        // otherwise fallback to creating a HorarioFixo template (no alunoId)
        const payload: any = { ...formData, alunoId: undefined, modalidadeId: formData.modalidadeId || modalidadeSelecionada };
        payload.professorId = String(payload.professorId || '');
        if (!payload.professorId) {
          toast.warning('Selecione um professor antes de criar o horário');
          return;
        }
        const response = await fetch('/api/horarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });

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
            Swal.fire({
              title: 'Conflito ao criar horário',
              html: `<p>${message}</p><p><strong>Registro existente:</strong></p><ul style="text-align:left;"><li>ID: ${data.existingId || ex._id}</li><li>Aluno: ${alunoName}</li><li>Professor: ${profName}</li><li>Dia: ${dia}</li><li>Horário: ${hora}</li></ul><p>Verifique o registro existente ou escolha outro horário.</p>`,
              icon: 'warning',
              confirmButtonColor: '#22c55e'
            });
            console.log('Registro conflitado (detalhe):', ex);
          } else {
            toast.error('Erro ao criar horário: ' + message);
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
          toast.error('Erro: ' + data.error);
        }
      }
    } catch (error) {
      console.error('Erro ao cadastrar/atualizar horário:', error);
      toast.error('Erro ao cadastrar/atualizar horário');
    } finally {
      setLoading(false);
    }
  };

  const deleteHorario = async (id: string) => {
    const result = await Swal.fire({
      title: 'Excluir horário?',
      text: 'Tem certeza que deseja excluir este horário?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sim, excluir',
      cancelButtonText: 'Cancelar'
    });
    if (!result.isConfirmed) return;
    try {
      const response = await fetch(`/api/horarios/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.success) {
        // refresh list after delete (no success alert)
        fetchHorarios();
      } else {
        toast.error('Erro ao excluir horário');
      }
    } catch (error) {
      console.error('Erro ao excluir horário:', error);
      toast.error('Erro ao excluir horário');
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
        toast.error('Erro ao atualizar observações: ' + (data.error || 'erro'));
      }
    } catch (err) {
      console.error('Erro ao atualizar observações:', err);
      toast.error('Erro ao atualizar observações');
    }
  };

  // Edit a student's name and propagate change across horarios and alunos list
  const editAlunoName = async (horario: any) => {
    try {
      const aluno = horario?.alunoId;
      if (!aluno || !aluno._id) {
        toast.error('Aluno não encontrado para este horário');
        return;
      }
      const current = String(aluno.nome || '');
      const { value: novo, isConfirmed } = await Swal.fire({
        title: 'Editar nome do aluno',
        input: 'text',
        inputValue: current,
        showCancelButton: true,
        confirmButtonColor: '#22c55e',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Salvar',
        cancelButtonText: 'Cancelar',
        inputValidator: (value) => {
          if (!value || !value.trim()) {
            return 'Nome não pode ficar vazio';
          }
          return null;
        }
      });
      if (!isConfirmed || !novo) return;
      const novoTrim = String(novo || '').trim();

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
        toast.error('Erro ao atualizar aluno: ' + (data && data.error ? data.error : 'erro'));
      }
    } catch (err) {
      console.error('Erro ao editar aluno:', err);
      toast.error('Erro ao editar aluno');
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
    // Compute new value from current localFlags to avoid stale closure
    let newCongelado = false;
    setLocalFlags(prev => {
      const cur = prev[id] || {};
      newCongelado = !cur.congelado;
      return { ...prev, [id]: { ...cur, congelado: newCongelado, ausente: cur.ausente ? cur.ausente : false } };
    });
    (async () => {
      try {
      const body: any = { congelado: newCongelado };
      if (newCongelado) body.ausente = false;
        // debug logs removed
        const patch = await fetch(`/api/horarios/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const patchData = await patch.json();
        if (!patchData || !patchData.success) throw new Error(patchData && patchData.error ? patchData.error : 'Erro ao atualizar');
        // Sync local flags with server-returned document when available
        const returned = patchData.data || {};
        const serverCongelado = returned.congelado === true;
        const serverAusente = returned.ausente === true;
        setLocalFlags(prev => ({ ...prev, [id]: { congelado: serverCongelado, ausente: serverAusente, emEspera: returned.emEspera === true } }));
        // Refresh horarios after server update
        await fetchHorarios();
      } catch (err) {
        console.error('Erro ao togglear congelado:', err);
        toast.error('Erro ao marcar congelado.');
        // revert local flag
        setLocalFlags(prev => {
          const cur = prev[id] || {};
          return { ...prev, [id]: { ...cur, congelado: !cur.congelado, ausente: cur.ausente ? cur.ausente : false } };
        });
      }
    })();
  };

  const toggleAusente = (id: string) => {
    let newAusente = false;
    setLocalFlags(prev => {
      const cur = prev[id] || {};
      newAusente = !cur.ausente;
      return { ...prev, [id]: { ...cur, ausente: newAusente, congelado: cur.congelado ? cur.congelado : false } };
    });
    (async () => {
      try {
  const body: any = { ausente: newAusente };
  if (newAusente) body.congelado = false;
  // debug logs removed
  const patch = await fetch(`/api/horarios/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const patchData = await patch.json();
        if (!patchData || !patchData.success) throw new Error(patchData && patchData.error ? patchData.error : 'Erro ao atualizar');
  const returned = patchData.data || {};
  const serverCongelado = returned.congelado === true;
  const serverAusente = returned.ausente === true;
  setLocalFlags(prev => ({ ...prev, [id]: { congelado: serverCongelado, ausente: serverAusente, emEspera: returned.emEspera === true } }));
        await fetchHorarios();
      } catch (err) {
        console.error('Erro ao togglear ausente:', err);
        toast.error('Erro ao marcar ausente.');
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
      professorId: String((representativeHorario as any).professorId?._id || (representativeHorario as any).professorId || ''),
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
    horarioInicio: string;
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

      // Procurar turma do mesmo professor nesse slot usando o id string (precisa ter mesmo horarioInicio e horarioFim)
      let turma = grade[key].find(t => t.professorId === professorIdStr && t.horarioInicio === horario.horarioInicio && t.horarioFim === horario.horarioFim);
      if (!turma) {
        // Resolve professorNome: prefer populated nome, otherwise lookup in fetched `professores` list by id, fallback to id string
        let professorNome = '';
        try {
          const raw = (horario as any).professorId;
          if (raw && typeof raw === 'object' && raw.nome) {
            professorNome = raw.nome;
          } else {
            const found = professores.find(p => String((p as any)._id || (p as any).id || '') === String(professorIdStr || ''));
            if (found && found.nome) {
              professorNome = found.nome;
            } else {
              // Verificar se é um ObjectId de professor apagado (24 caracteres hexadecimais)
              const isObjectId = /^[0-9a-f]{24}$/i.test(String(professorIdStr || ''));
              professorNome = isObjectId ? 'Sem professor' : String(professorIdStr || '');
            }
          }
        } catch (e) {
          professorNome = String(professorIdStr || '');
        }

        turma = {
          professorId: professorIdStr,
          professorNome: professorNome,
          horarioInicio: horario.horarioInicio,
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
      // Group by professor + horarioInicio + horarioFim to form turmas similar to criarGradeHorarios
      const groups: Record<string, any> = {};
      covering.forEach(h => {
        const rawProf = (h as any).professorId;
        let professorIdStr: string | null = null;
        if (!rawProf) professorIdStr = null;
        else if (typeof rawProf === 'string') professorIdStr = rawProf;
        else if (rawProf._id) professorIdStr = String(rawProf._id);
        else professorIdStr = String(rawProf);
        const key = `${professorIdStr}::${h.horarioInicio}::${h.horarioFim}`;
  if (!groups[key]) {
    // Resolve professorNome similarly to criarGradeHorarios: prefer populated nome, otherwise lookup in professores state
    let profNome = '';
    try {
      const raw = (h as any).professorId;
      if (raw && typeof raw === 'object' && raw.nome) {
        profNome = raw.nome;
      } else {
        const found = professores.find(p => String((p as any)._id || (p as any).id || '') === String(professorIdStr || ''));
        if (found && found.nome) {
          profNome = found.nome;
        } else {
          // Verificar se é um ObjectId de professor apagado (24 caracteres hexadecimais)
          const isObjectId = /^[0-9a-f]{24}$/i.test(String(professorIdStr || ''));
          profNome = isObjectId ? 'Sem professor' : String(professorIdStr || '');
        }
      }
    } catch (e) {
      profNome = String(professorIdStr || '');
    }
    groups[key] = { professorId: professorIdStr, professorNome: (profNome && profNome !== 'Sem professor') ? (String(profNome).startsWith('Personal') ? String(profNome) : 'Personal ' + String(profNome)) : 'Sem professor', horarioInicio: h.horarioInicio, horarioFim: h.horarioFim, alunos: [], observacaoTurma: (h as any).observacaoTurma || '' };
  }
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
          let isOpen = o < c ? (m >= o && m <= c) : true;
          if (modalidadeSelecionada) {
            const mod = modalidades.find(mo => getMid(mo) === modalidadeSelecionada) as any;
            if (mod) {
              const dayAllowed = Array.isArray(mod.diasSemana) && mod.diasSemana.length > 0 ? (mod.diasSemana.map((d:number)=> d>6? d-1: d).includes(dayIdx)) : true;
              if (!dayAllowed) return false;
              if (Array.isArray(mod.horariosDisponiveis) && mod.horariosDisponiveis.length > 0) {
                const match = mod.horariosDisponiveis.some((hd: any) => {
                  const hdDaysRaw = Array.isArray(hd.diasSemana) && hd.diasSemana.length > 0 ? hd.diasSemana : [dayIdx];
                  const hdDays = hdDaysRaw.map((d:number)=> d>6? d-1: d);
                  if (!hdDays.includes(dayIdx)) return false;
                  const hi = timeToMinutes(hd.horaInicio);
                  const hf = timeToMinutes(hd.horaFim);
                  // incluir o horário final (ex.: se termina às 09:00, também mostrar a linha 09:00)
                  return m >= hi && m <= hf;
                });
                return !!match;
              } else if (mod.horarioFuncionamento) {
                const hf = mod.horarioFuncionamento || {};
                const manhaInicio = hf?.manha?.inicio ? timeToMinutes(hf.manha.inicio) : null;
                const manhaFim = hf?.manha?.fim ? timeToMinutes(hf.manha.fim) : null;
                const tardeInicio = hf?.tarde?.inicio ? timeToMinutes(hf.tarde.inicio) : null;
                const tardeFim = hf?.tarde?.fim ? timeToMinutes(hf.tarde.fim) : null;
                const inManha = manhaInicio !== null && manhaFim !== null ? (m >= manhaInicio && m <= manhaFim) : false;
                const inTarde = tardeInicio !== null && tardeFim !== null ? (m >= tardeInicio && m <= tardeFim) : false;
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
      // DISABLED: rowspan was causing incorrect cell merging
      // Each cell now renders independently without merging
      // This ensures each time slot shows its own content correctly

      return { visibleDays, visibleTimes: visibleTimesArr, startRowSpanMap, skipCellsSet };
    } catch (e) {
      return { visibleDays: [0,1,2,3,4,5,6], visibleTimes: horariosDisponiveis, startRowSpanMap: new Map(), skipCellsSet: new Set() };
    }
  }, [horariosFiltrados, horariosDisponiveis, modalidades, modalidadeSelecionada, openTime, closeTime]);

  // Handler moved out of JSX to avoid large inline blocks and JSX parse issues
  const handleImportClick = async () => {
    // Prevent double-click
    if (importing) return;
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

      // Prefer creating a Matricula on an existing HorarioFixo. If none exists create a HorarioFixo
      // (without alunoId) and then create the Matricula.
      try {
        const existing = horarios.find(h => {
          try {
            const rawProf = (h as any).professorId;
            const profId = rawProf && (rawProf._id || rawProf) ? String(rawProf._id || rawProf) : undefined;
            return profId === String(importProfessorId) && h.diaSemana === importDiaSemana && h.horarioInicio === importHorarioInicio && h.horarioFim === importHorarioFim;
          } catch (e) { return false; }
        });

        let enrollResp: any = null;
        if (existing && existing._id) {
          const matResp = await fetch('/api/matriculas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ horarioFixoId: existing._id, alunoId: alunoIdToUse, observacoes: 'Importado em lote' }) });
          enrollResp = await matResp.json();
        } else {
          const createPayload: any = { professorId: String(importProfessorId || ''), diaSemana: importDiaSemana, horarioInicio: importHorarioInicio, horarioFim: importHorarioFim, observacoes: '', modalidadeId: importModalidadeId || modalidadeSelecionada || undefined };
          if (!createPayload.professorId) { failures.push({ name, reason: 'Professor não selecionado' }); continue; }
          const createResp = await fetch('/api/horarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(createPayload) });
          const created = await createResp.json();
          if (created && created.success && created.data && created.data._id) {
            const matResp = await fetch('/api/matriculas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ horarioFixoId: created.data._id, alunoId: alunoIdToUse, observacoes: 'Importado em lote' }) });
            enrollResp = await matResp.json();
          } else {
            enrollResp = { success: false, error: created && created.error ? created.error : 'Falha ao criar horario' };
          }
        }

        if (enrollResp && enrollResp.success) {
          successes++;
        } else {
          failures.push({ name, reason: enrollResp && (enrollResp.error || enrollResp.message) ? (enrollResp.error || enrollResp.message) : 'Erro desconhecido' });
        }
      } catch (err:any) {
        failures.push({name, reason: err.message || 'Erro de requisição'});
      }
    }
    setImportResults({successes, failures});
    setImporting(false);
    await fetchHorarios();
  };

  // Skeleton loading enquanto não está montado ou dados iniciais carregando
  if (!mounted || initialLoading) {
    return (
      <ProtectedPage tab="horarios" title="Horários - Superação Flux" fullWidth customLoading>
        <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
          {/* Header skeleton - Desktop */}
          <div className="hidden md:flex items-center justify-between gap-4 mb-6">
            <div>
              <div className="h-6 bg-gray-200 rounded w-32 mb-2 animate-pulse" />
              <div className="h-4 bg-gray-200 rounded w-72 animate-pulse" />
            </div>
            <div className="flex gap-3">
              <div className="h-10 w-36 bg-gray-200 rounded-full animate-pulse" />
              <div className="h-10 w-32 bg-gray-200 rounded-full animate-pulse" />
            </div>
          </div>
          
          {/* Header skeleton - Mobile */}
          <div className="md:hidden mb-4">
            <div className="h-5 bg-gray-200 rounded w-24 animate-pulse" />
          </div>
          
          {/* Modalidades pills skeleton - Desktop */}
          <div className="hidden md:flex mb-6 flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-9 bg-gray-200 rounded-full w-28 animate-pulse" />
            ))}
          </div>
          
          {/* Modalidades pills skeleton - Mobile */}
          <div className="md:hidden mb-4 flex flex-wrap gap-1.5">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-7 bg-gray-200 rounded-full w-20 animate-pulse" />
            ))}
          </div>
          
          {/* Table skeleton - Desktop */}
          <div className="hidden md:block bg-white rounded-lg border border-gray-200 overflow-hidden">
            {/* Table Header */}
            <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
              <div className="grid grid-cols-7 gap-2">
                <div className="h-4 bg-gray-200 rounded w-16 animate-pulse" />
                {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((_, i) => (
                  <div key={i} className="h-4 bg-gray-200 rounded w-full animate-pulse" />
                ))}
              </div>
            </div>
            {/* Table Rows */}
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <div key={i} className="border-b border-gray-200 px-4 py-3">
                <div className="grid grid-cols-7 gap-2 items-center">
                  <div className="h-4 bg-gray-200 rounded w-14 animate-pulse" />
                  {[1, 2, 3, 4, 5, 6].map(j => (
                    <div key={j} className="h-16 bg-gray-100 rounded animate-pulse" />
                  ))}
                </div>
              </div>
            ))}
          </div>
          
          {/* Cards skeleton - Mobile */}
          <div className="md:hidden space-y-3">
            {/* Day selector skeleton */}
            <div className="grid grid-cols-6 gap-1 mb-4">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="h-10 bg-gray-200 rounded-lg animate-pulse" />
              ))}
            </div>
            {/* Cards */}
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-gray-200 rounded-full" />
                    <div className="h-4 bg-gray-200 rounded w-20" />
                  </div>
                  <div className="h-5 bg-gray-200 rounded w-16" />
                </div>
                <div className="space-y-2">
                  <div className="h-10 bg-gray-100 rounded-lg" />
                  <div className="h-10 bg-gray-100 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </ProtectedPage>
    );
  }

  return (
    <>
      {showModalLote.open && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="relative w-full max-w-sm mx-auto p-5 bg-white shadow-lg rounded-2xl max-h-[90vh] overflow-y-auto fade-in-4">
            <div className="mt-3">
          <h3 className="text-base font-semibold text-gray-900 mb-2">Adicionar Alunos em Lotee</h3>
          <p className="text-sm text-gray-700 mb-3">Modalidade aplicada: <span className="font-semibold">{(modalidades.find(m => getMid(m) === modalidadeSelecionada)?.nome) || '— nenhuma selecionada —'}</span>. Os alunos selecionados serão adicionados a esta modalidade — verifique se está correta antes de confirmar.</p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Selecione os alunos:</label>
                <div className="max-h-40 overflow-y-auto border rounded-md p-2">
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
                  className="px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={alunosSelecionadosLote.length === 0}
                  className="px-3 py-1.5 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-600 bg-opacity-50 p-4">
          <div className="relative w-full max-w-lg mx-auto bg-white rounded-2xl shadow-lg border border-gray-200 p-4 sm:p-6 max-h-[90vh] overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="bulkAddTitle" aria-describedby="bulkAddDesc" tabIndex={-1}>
            {/* Header + Info */}
            <div className="mb-4 border-b pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <i className="fas fa-users text-primary-600 text-lg" aria-hidden="true"></i>
                  <h3 id="bulkAddTitle" className="text-lg font-semibold text-gray-900">Adicionar Alunos Em Lote</h3>
                </div>
                <button
                  type="button"
                  onClick={() => { setShowAddAlunoModal(false); setBulkAlunoTextAdd(''); setAddAlunoTurma(null); }}
                  className="text-gray-400 hover:text-gray-600 focus:outline-none"
                  aria-label="Fechar modal adicionar alunos"
                  title="Fechar"
                >
                  <i className="fas fa-times text-lg" aria-hidden="true" />
                </button>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <i className="fas fa-info-circle text-primary-600" aria-hidden="true" />
                <span id="bulkAddDesc" className="text-sm text-gray-500">Turma: {professores.find(p => p._id === addAlunoTurma.professorId)?.nome} • {diasSemana[addAlunoTurma.diaSemana || 0]} {addAlunoTurma.horarioInicio}-{addAlunoTurma.horarioFim}</span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Cole os nomes dos alunos (um por linha)</label>
                <textarea
                  value={bulkAlunoTextAdd}
                  onChange={e => {
                    // Keep raw text for editing
                    setBulkAlunoTextAdd(String(e.target.value || ''));
                  }}
                  className="block w-full h-32 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 transition-all"
                  rows={5}
                  placeholder={`Ex:\nJOÃO SILVA\nMARIA SOUZA\nPEDRO SANTOS`}
                />
              </div>
              <p className="text-xs text-gray-500">{bulkImportEntries.length} linha{bulkImportEntries.length !== 1 ? 's' : ''} detectada{bulkImportEntries.length !== 1 ? 's' : ''}</p>
              <div className="flex items-center gap-3">
                <label htmlFor="bulk-allow-create" className="flex items-center gap-2 cursor-pointer">
                  <span className="text-sm text-gray-600">Criar alunos automaticamente se não existirem</span>
                  <span className="relative inline-block w-10 align-middle select-none transition duration-200 ease-in">
                    <input type="checkbox" id="bulk-allow-create" checked={bulkAllowCreateNew} onChange={e => setBulkAllowCreateNew(e.target.checked)} className="sr-only" />
                    <span className={`block w-10 h-6 rounded-full ${bulkAllowCreateNew ? 'bg-primary-500' : 'bg-gray-300'}`}></span>
                    <span className={`dot absolute left-1 top-1 w-4 h-4 rounded-full transition ${bulkAllowCreateNew ? 'translate-x-4 bg-white' : 'bg-white'}`}></span>
                  </span>
                </label>
              </div>
              <div className="max-h-48 overflow-y-auto border rounded-md p-3 bg-gray-50">
                {bulkImportEntries.length === 0 && <div className="text-sm text-gray-400 py-4 text-center">Nenhuma linha detectada</div>}
                {bulkImportEntries.map(entry => {
                  // Ordenar alunos por similaridade com o nome digitado
                  const entryNameLower = (entry.name || '').toLowerCase().trim();
                  const sortedAlunos = [...alunos].sort((a, b) => {
                    const aName = (a.nome || '').toLowerCase();
                    const bName = (b.nome || '').toLowerCase();
                    // Prioridade 1: nome começa com o texto digitado
                    const aStarts = aName.startsWith(entryNameLower);
                    const bStarts = bName.startsWith(entryNameLower);
                    if (aStarts && !bStarts) return -1;
                    if (!aStarts && bStarts) return 1;
                    // Prioridade 2: nome contém o texto digitado
                    const aContains = aName.includes(entryNameLower);
                    const bContains = bName.includes(entryNameLower);
                    if (aContains && !bContains) return -1;
                    if (!aContains && bContains) return 1;
                    // Prioridade 3: similaridade por palavras (ex: "vinicius lime" vs "vinicius lima")
                    const entryWords = entryNameLower.split(/\s+/);
                    const aWords = aName.split(/\s+/);
                    const bWords = bName.split(/\s+/);
                    const aMatches = entryWords.filter(w => aWords.some(aw => aw.includes(w) || w.includes(aw))).length;
                    const bMatches = entryWords.filter(w => bWords.some(bw => bw.includes(w) || w.includes(bw))).length;
                    if (aMatches !== bMatches) return bMatches - aMatches;
                    // Ordem alfabética como fallback
                    return aName.localeCompare(bName);
                  }).slice(0, 50);
                  
                  return (
                    <div key={entry.id} className="py-2 border-b border-gray-100 last:border-b-0">
                      {/* Linha principal: checkbox, nome, select, badge */}
                      <div className="flex items-center gap-2">
                        <input type="checkbox" checked={entry.selected} onChange={e => setBulkImportEntries(prev => prev.map(p => p.id === entry.id ? {...p, selected: e.target.checked} : p))} className="w-4 h-4 rounded border-gray-300" />
                        <input value={entry.name} onChange={e => setBulkImportEntries(prev => prev.map(p => p.id === entry.id ? {...p, name: e.target.value} : p))} className="flex-1 h-8 border border-gray-200 rounded px-2 py-1 text-sm" />
                        <select 
                          value={entry.alunoId || ''} 
                          onChange={e => {
                            const selectedId = e.target.value || undefined;
                            const selectedAluno = selectedId ? alunos.find(a => a._id === selectedId) : null;
                            setBulkImportEntries(prev => prev.map(p => p.id === entry.id ? {
                              ...p, 
                              alunoId: selectedId,
                              observacoesAluno: selectedAluno ? (selectedAluno as any).observacoes || '' : '',
                              parceria: selectedAluno ? (selectedAluno as any).parceria || null : null,
                              congelado: selectedAluno ? (selectedAluno as any).congelado || false : false,
                              ausente: selectedAluno ? (selectedAluno as any).ausente || false : false,
                              emEspera: selectedAluno ? (selectedAluno as any).emEspera || false : false
                            } : p));
                          }} 
                          className="h-8 text-sm border border-gray-200 rounded px-2 py-1 max-w-[150px]"
                        >
                          <option value="">Novo</option>
                          {sortedAlunos.map(a => (
                            <option key={a._id} value={a._id}>{a.nome}</option>
                          ))}
                        </select>
                        {entry.alunoId ? (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded whitespace-nowrap">Existente</span>
                        ) : (
                          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded whitespace-nowrap">Novo</span>
                        )}
                      </div>
                      {/* Linha secundária: observações e características (só aparece quando selecionado) */}
                      {entry.selected && (
                        <div className="mt-2 ml-6 flex items-center gap-2 flex-wrap">
                          <input 
                            value={entry.observacoesAluno || ''} 
                            onChange={e => setBulkImportEntries(prev => prev.map(p => p.id === entry.id ? {...p, observacoesAluno: e.target.value} : p))} 
                            placeholder="Observações do aluno..." 
                            className="flex-1 min-w-[120px] h-8 border border-gray-200 rounded px-2 py-1 text-sm bg-gray-50"
                          />
                          {/* Botão TOTALPASS */}
                          <button
                            type="button"
                            onClick={() => setBulkImportEntries(prev => prev.map(p => p.id === entry.id ? {...p, parceria: p.parceria === 'TOTALPASS' ? null : 'TOTALPASS'} : p))}
                            className={`flex items-center justify-center w-8 h-8 rounded border text-xs font-medium transition-all ${entry.parceria === 'TOTALPASS' ? 'bg-purple-100 border-purple-300 text-purple-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                            title={entry.parceria === 'TOTALPASS' ? 'Remover TOTALPASS' : 'Marcar TOTALPASS'}
                          >
                            <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAC1UlEQVR4AbyWg5LlQBiFY3uSu7Zt27Zt27Zt27Zt60G2tC8w/3aWk/qvkkGqzuU53V+7qSwPQ6S5rttM07Sptm3PJZqXQ5pLypwci8UakjoUIpoo8HDE1EgQhC/kcyYR5IZoms6UJOmtaZo1/zT418OSypuwLPsDh3JHpK7vlmXV+NsTBmn5N2zMXZGeeEneZcpxnLYpA7k0HGS+1aZUVZ336wdZAGNNHzDX9wupvmCs6gVsASs0hKIooykyO5f6X4RaxcH7sCya3i4BRpdDAxiGMeUfgDqyWWQA+9Q4VHhoAHP74MgA2uyO2QfQF3cDi0D8077hcStzzk0M+nYMBnNtX1CHN/0lZWhjUAY1DEjuXgv4qkWA5piEAHitFs2IC8CVzR/0kcnnvU+vpzKuTgOhXqn0AKTO1VEB7qN5QLNM0Neharghe70Y+IoFUwPoS7qhsLllIPbN7xx6zpgb+qUAoClwLk1BQWVwIwTgnJ8UGiDj1ozkAIyrxx1XvnLhoM9WwXu3NDzAvdnJAcRWlVDIfbYAaJ4N+pqVj7ZvHB6VHECb1QGFrF1DAPmmtY0EoI5qlhyA7Gw4NLIpIN/R0aErdx/P84cuMQCjS+C9WYKCfM3iwdNMFcF7HfClFpkvYpvKyfcBoWEZTP1yEdASDwFfnZLhWv5wLogtK6beCdUJrVDY2j8Cdb86tgWu6D2R33u+Xi8G98l8sMiEU4Y1AcZU/FxqAOvACFSwOr4lClt7h+FDaU4nv6d+S+CAommUSwkgtqgIcrdaWYUuG37h7vOFCIAs3+inYRjxVYrE7X7G0/MGgGzJ+Ji+MtXfwvMGwNw8AAHoy7pHu5Coqjo3bNDfKX8OvXHKZqlCVqN0wJvlA98xAQImYNfMBthd+kDnrpkBcieVBRgVVsCQOEPrzinQjqPQfiETAzKACnCLioragbrSwFAppSYGmpkF7J5bQoId4XMA6lRclYDTIrUAAAAASUVORK5CYII=" alt="TP" className="w-4 h-4" />
                          </button>
                          {/* Botão Congelado */}
                          <button
                            type="button"
                            onClick={() => setBulkImportEntries(prev => prev.map(p => p.id === entry.id ? {...p, congelado: !p.congelado} : p))}
                            className={`flex items-center justify-center w-8 h-8 rounded border text-xs font-medium transition-all ${entry.congelado ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                            title={entry.congelado ? 'Descongelar' : 'Congelar'}
                          >
                            <i className="fas fa-snowflake" />
                          </button>
                          {/* Botão Ausente */}
                          <button
                            type="button"
                            onClick={() => setBulkImportEntries(prev => prev.map(p => p.id === entry.id ? {...p, ausente: !p.ausente} : p))}
                            className={`flex items-center justify-center w-8 h-8 rounded border text-xs font-medium transition-all ${entry.ausente ? 'bg-red-100 border-red-300 text-red-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                            title={entry.ausente ? 'Presente' : 'Ausente'}
                          >
                            <i className="fas fa-user-slash" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t mt-4">
                <button
                  type="button"
                  onClick={() => { setShowAddAlunoModal(false); setBulkAlunoTextAdd(''); setAddAlunoTurma(null); }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 flex items-center gap-2"
                >
                  <i className="fas fa-times text-gray-500" aria-hidden="true" />
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                      setLoading(true);
                      const entriesToAdd = bulkImportEntries.filter(e => e.selected);
                      const failures: Array<{name:string, reason:string}> = [];
                      let successes = 0;
                      for (const entry of entriesToAdd) {
                        const name = String(entry.name || '').trim();
                        if (!name) {
                          failures.push({ name: '(vazio)', reason: 'Nome vazio' });
                          continue;
                        }

                        let alunoIdToUse = entry.alunoId;
                        
                        // Se aluno existente, atualizar observações, parceria e flags se modificados
                        if (alunoIdToUse) {
                          try {
                            const existingAluno = alunos.find(a => a._id === alunoIdToUse);
                            const needsUpdate = existingAluno && (
                              (entry.observacoesAluno !== ((existingAluno as any).observacoes || '')) ||
                              (entry.parceria !== ((existingAluno as any).parceria || null)) ||
                              (entry.congelado !== ((existingAluno as any).congelado || false)) ||
                              (entry.ausente !== ((existingAluno as any).ausente || false)) ||
                              (entry.emEspera !== ((existingAluno as any).emEspera || false))
                            );
                            if (needsUpdate) {
                              const updatePayload: any = {};
                              if (entry.observacoesAluno !== ((existingAluno as any).observacoes || '')) {
                                updatePayload.observacoes = entry.observacoesAluno || '';
                              }
                              if (entry.parceria !== ((existingAluno as any).parceria || null)) {
                                updatePayload.parceria = entry.parceria || null;
                              }
                              if (entry.congelado !== ((existingAluno as any).congelado || false)) {
                                updatePayload.congelado = entry.congelado || false;
                              }
                              if (entry.ausente !== ((existingAluno as any).ausente || false)) {
                                updatePayload.ausente = entry.ausente || false;
                              }
                              if (entry.emEspera !== ((existingAluno as any).emEspera || false)) {
                                updatePayload.emEspera = entry.emEspera || false;
                              }
                              await fetch(`/api/alunos/${alunoIdToUse}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(updatePayload)
                              });
                            }
                          } catch (err) {
                            // Silently fail update, continue with enrollment
                          }
                        }
                        
                        if (!alunoIdToUse) {
                          if (!bulkAllowCreateNew) {
                            failures.push({ name, reason: 'Aluno não selecionado e criação automática desativada' });
                            continue;
                          }
                          // create aluno
                          try {
                            const payload: any = { nome: String(name).toUpperCase() };
                            if (modalidadeSelecionada) payload.modalidadeId = modalidadeSelecionada;
                            if (entry.observacoesAluno) payload.observacoes = entry.observacoesAluno;
                            if (entry.parceria) payload.parceria = entry.parceria;
                            if (entry.congelado) payload.congelado = entry.congelado;
                            if (entry.ausente) payload.ausente = entry.ausente;
                            if (entry.emEspera) payload.emEspera = entry.emEspera;
                            const resp = await fetch('/api/alunos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                            const data = await resp.json();
                            if (data && data.success && data.data && data.data._id) {
                              alunoIdToUse = data.data._id;
                              setAlunos(prev => [...prev, data.data]);
                            } else {
                              failures.push({ name, reason: 'Falha ao criar aluno: ' + (data && (data.error || data.message) ? (data.error || data.message) : 'resposta inválida') });
                              continue;
                            }
                          } catch (err:any) {
                            failures.push({ name, reason: 'Erro ao criar aluno: ' + (err && err.message ? err.message : 'erro') });
                            continue;
                          }
                        }

                        // Now enroll the aluno: prefer existing HorarioFixo if present
                        try {
                          const profId = addAlunoTurma.professorId;
                          const dia = addAlunoTurma.diaSemana || 1;
                          const inicio = addAlunoTurma.horarioInicio || '';
                          const fim = addAlunoTurma.horarioFim || '';

                          const existing = horarios.find(h => {
                            try {
                              const rawProf = (h as any).professorId;
                              const pid = rawProf && (rawProf._id || rawProf) ? String(rawProf._id || rawProf) : undefined;
                              return pid === String(profId) && h.diaSemana === dia && h.horarioInicio === inicio && h.horarioFim === fim;
                            } catch (e) { return false; }
                          });

                          let enrollResp: any = null;
                          if (existing && existing._id) {
                            const matResp = await fetch('/api/matriculas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ horarioFixoId: existing._id, alunoId: alunoIdToUse, observacoes: entry.obs || '' }) });
                            enrollResp = await matResp.json();
                          } else {
                            const createPayload: any = { professorId: String(profId || ''), diaSemana: dia, horarioInicio: inicio, horarioFim: fim, observacoes: '', modalidadeId: modalidadeSelecionada || undefined };
                            if (!createPayload.professorId) { failures.push({ name, reason: 'Professor não selecionado' }); continue; }
                            const createResp = await fetch('/api/horarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(createPayload) });
                            const created = await createResp.json();
                            if (created && created.success && created.data && created.data._id) {
                              const matResp = await fetch('/api/matriculas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ horarioFixoId: created.data._id, alunoId: alunoIdToUse, observacoes: entry.obs || '' }) });
                              enrollResp = await matResp.json();
                            } else {
                              enrollResp = { success: false, error: created && created.error ? created.error : 'Falha ao criar horario' };
                            }
                          }

                          if (enrollResp && enrollResp.success) {
                            successes++;
                          } else {
                            failures.push({ name, reason: enrollResp && (enrollResp.error || enrollResp.message) ? (enrollResp.error || enrollResp.message) : 'Erro desconhecido' });
                          }
                        } catch (err:any) {
                          failures.push({ name, reason: err && err.message ? err.message : 'Erro de requisição' });
                        }
                      }

                      setLoading(false);
                      setShowAddAlunoModal(false);
                      setBulkAlunoTextAdd('');
                      setBulkImportEntries([]);
                      await fetchHorarios();
                      
                      if (failures.length === 0) {
                        toast.success(`${successes} aluno${successes !== 1 ? 's' : ''} adicionado${successes !== 1 ? 's' : ''} com sucesso!`);
                      } else if (successes > 0) {
                        toast.warning(`${successes} adicionado${successes !== 1 ? 's' : ''}, ${failures.length} falha${failures.length !== 1 ? 's' : ''}: ${failures.map(f => f.name).join(', ')}`);
                      } else {
                        toast.error(`Falha ao adicionar: ${failures.map(f => `${f.name}`).join(', ')}`);
                      }
                    }}
                  className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 ${bulkImportEntries.filter(e=>e.selected).length===0 || (bulkImportEntries.filter(e=>e.selected && !e.alunoId).length>0 && !bulkAllowCreateNew) ? 'bg-gray-400 text-gray-200 cursor-not-allowed' : 'text-white bg-primary-600 hover:bg-primary-700'}`}
                  disabled={bulkImportEntries.filter(e=>e.selected).length===0 || (bulkImportEntries.filter(e=>e.selected && !e.alunoId).length>0 && !bulkAllowCreateNew)}
                >
                  <i className="fas fa-check" aria-hidden="true" /> Adicionar selecionados
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
  <ProtectedPage tab="horarios" title="Horários - Superação Flux" fullWidth customLoading>
  <div className="w-full px-4 py-6 sm:px-6 lg:px-8 overflow-x-hidden">
        {/* Header Desktop */}
        <div className="hidden md:flex items-center justify-between gap-4 mb-6 fade-in-1">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <i className="fas fa-calendar-alt text-green-600"></i>
              Grade de Horários
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Gerencie os horários fixos dos alunos de forma organizada
            </p>
          </div>
          <div>
            {permissoesHorarios.gerenciarTurmas() && (
              <button
                type="button"
                onClick={() => { setShowGradeProfessorModal(true); setGradeProfessorId(''); setGradeSlotsSelected(new Set()); }}
                className="inline-flex items-center gap-2 px-4 py-2 border border-primary-600 rounded-md text-sm font-medium text-primary-600 bg-white hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all"
              >
                <i className="fas fa-th text-primary-600" aria-hidden="true" />
                Montar Grade Professor
              </button>
            )}
          </div>
        </div>

        {/* Header Mobile */}
        <div className="md:hidden mb-4 fade-in-1">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <i className="fas fa-calendar-alt text-green-600"></i>
              Grade de Horários
            </h1>
            <button
              type="button"
              onClick={() => { setShowGradeProfessorModal(true); setGradeProfessorId(''); setGradeSlotsSelected(new Set()); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-primary-600 rounded-lg text-xs font-medium text-primary-600 bg-white hover:bg-primary-50 transition-all"
            >
              <i className="fas fa-th" aria-hidden="true" />
              Grade
            </button>
          </div>
        </div>

        {/* Seletor de Modalidade (buttons) - moved outside the white card */}
        <div className="mb-6 fade-in-2">
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            <i className="fas fa-filter mr-2 text-primary-600"></i>
            Selecione a Modalidade
          </label>
          <div className="flex flex-wrap gap-3">
            {(modalidades || []).map((modalidade, idx) => {
              const mid = (modalidade as any).id || (modalidade as any)._id || '';
              const color = (modalidade as any)?.cor || '#3B82F6';
              const isSelected = String(mid) === String(modalidadeSelecionada);
              return (
                <button
                  key={(modalidade as any).id ?? (modalidade as any)._id ?? idx}
                  onClick={() => setModalidadeSelecionada(String(mid))}
                  style={{
                    backgroundColor: isSelected ? color : 'white',
                    borderColor: isSelected ? color : '#E5E7EB',
                    color: isSelected ? 'white' : '#374151'
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all`}
                >
                  <span className="w-2.5 h-2.5 rounded-full border border-white" style={{ backgroundColor: color }} />
                  <span>{modalidade.nome}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Aviso de modalidades vinculadas */}
        {(() => {
          const mod = modalidades.find(m => getMid(m) === modalidadeSelecionada) as any;
          const vinculadas = mod?.modalidadesVinculadas || [];
          if (vinculadas.length === 0) return null;
          
          const nomesVinculadas = vinculadas
            .map((vid: string) => modalidades.find(m => getMid(m) === vid)?.nome)
            .filter(Boolean);
          
          if (nomesVinculadas.length === 0) return null;
          
          return (
            <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg flex items-start gap-3 fade-in-2">
              <i className="fas fa-link text-orange-500 mt-0.5"></i>
              <div>
                <p className="text-sm font-medium text-orange-800">
                  Espaço compartilhado com: <span className="font-bold">{nomesVinculadas.join(', ')}</span>
                </p>
                <p className="text-xs text-orange-600 mt-0.5">
                  Os horários ocupados por essas modalidades são exibidos na grade e não podem receber novas aulas.
                </p>
              </div>
            </div>
          );
        })()}

        {/* Grade de horários - Versão Desktop */}
        {/* Only render the heavy schedule after hydration on client to avoid SSR/CSR mismatch */}
        {mounted && (
          <div className="hidden md:block bg-white rounded-md overflow-hidden border border-gray-200 fade-in-3">
            {/* Horário de funcionamento removido da UI por decisão do produto; a lógica de filtragem por openTime/closeTime permanece. */}
            <div className="overflow-auto max-h-[75vh]">{/* table scrolls internally */}
              <table className="w-full table-fixed text-sm border-collapse">
            <thead className="bg-white border-b border-gray-200">
              <tr>
                <th scope="col" className="sticky top-0 left-0 z-20 px-2 py-2 text-center text-xs font-bold text-gray-700 uppercase tracking-wider w-20 bg-white border-r border-gray-200">
                  Horário
                </th>
                {visibleDays.map((dayIndex) => (
                  <th
                    key={dayIndex}
                    scope="col"
                    className="sticky top-0 z-10 px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase tracking-wider min-w-[88px] bg-white border-r border-gray-200"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <span>{diasSemana[dayIndex]}</span>
                      {dayIndex === todayIndex && (
                        <span title="Hoje" className="ml-1 inline-flex items-center text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-800 font-semibold">Hoje</span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white">
              {visibleTimes.map((horarioSlot, idx) => (
                <tr key={horarioSlot} className={`align-top`}>
                  <td className="sticky left-0 z-10 p-2 whitespace-nowrap text-sm font-medium text-gray-900 bg-white border-r border-gray-200 h-full">
                    <div className="h-full flex items-center justify-center text-sm font-medium text-center">{horarioSlot}</div>
                  </td>
                  {visibleDays.map((dayIndex) => {
                    const key = `${horarioSlot}-${dayIndex}`;
                    const blockedKey = `${horarioSlot}-${dayIndex}-${modalidadeSelecionada}`;
                    const isBlocked = !!blockedSlots[blockedKey];
                    // If this cell is covered by a rowspan from a previous slot, don't render a td here
                    if (skipCellsSet.has(key)) return null;
                    const turmas = getTurmasForSlot(horarioSlot, dayIndex); // Array de turmas neste slot (covers multi-slot turmas)
                    const rowSpan = (startRowSpanMap.get(key) || 1) > 1 ? (startRowSpanMap.get(key) as number) : undefined;
                    // Determine if any turma is over capacity so we can color the entire cell
                    let anyExceeded = false;
                    try {
                      for (const turma of turmas) {
                        // Support two data shapes:
                        // 1) legacy: turma.alunos is an array of HorarioFixo member documents (each with alunoId)
                        // 2) new: turma.alunos is an array with a single HorarioFixo template that carries a `matriculas` array
                        const visibleAlunos = (() => {
                          try {
                            if (Array.isArray(turma.alunos) && turma.alunos.length === 1 && Array.isArray(turma.alunos[0].matriculas) && turma.alunos[0].matriculas.length > 0) {
                              // Use matriculas (each item has alunoId populated)
                              return (turma.alunos[0].matriculas || []).filter((m: any) => m && m.alunoId && (m.alunoId.nome || m.alunoId._id));
                            }
                          } catch (e) {}
                          return (turma.alunos || []).filter((h: any) => h && h.alunoId && (h.alunoId.nome || h.alunoId._id));
                        })();
                        let capacity: number | undefined = undefined;
                        // Prioridade: 1) limite da turma, 2) limite da modalidade selecionada, 3) limite da modalidade do aluno
                        const turmaTemplate = turma.alunos && turma.alunos[0];
                        if (turmaTemplate && typeof turmaTemplate.limiteAlunos === 'number') {
                          capacity = turmaTemplate.limiteAlunos;
                        } else if (modalidadeSelecionada) {
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
                        // Exclude students flagged as emEspera, congelado, or ausente from capacity counts
                        const count = visibleAlunos.filter((h: any) => {
                          try {
                            const local = localFlags[h._id] || {};
                            // Check both alunoId fields and direct fields (for backward compatibility)
                            const isEmEspera = (h.alunoId?.emEspera === true || h.emEspera === true) || local.emEspera === true;
                            const isCongelado = (h.alunoId?.congelado === true || h.congelado === true) || local.congelado === true;
                            const isAusente = (h.alunoId?.ausente === true || h.ausente === true) || local.ausente === true;
                            return !(isEmEspera || isCongelado || isAusente);
                          } catch (e) { return true; }
                        }).length;
                        if (capacity !== undefined && count >= capacity) { anyExceeded = true; break; }
                      }
                    } catch (e) {
                      // ignore
                    }
                    const o = timeToMinutes(openTime);
                    const c = timeToMinutes(closeTime);
                    const m = timeToMinutes(horarioSlot);
                    // default page-wide availability
                    let isOpen = o < c ? (m >= o && m <= c) : true;

                    // If a modalidade is selected, determine availability from the modalidade
                    if (modalidadeSelecionada) {
                      const mod = modalidades.find(mo => getMid(mo) === modalidadeSelecionada) as any;
                      if (mod) {
                        // Check day availability: if modalidade defines diasSemana, require the day to be included
                        const dayAllowed = Array.isArray(mod.diasSemana) && mod.diasSemana.length > 0 ? (mod.diasSemana.map((d:number)=> d>6? d-1: d).includes(dayIndex)) : true;

                        if (!dayAllowed) {
                          isOpen = false;
                        } else if (Array.isArray(mod.horariosDisponiveis) && mod.horariosDisponiveis.length > 0) {
                          // If modalidade has explicit horariosDisponiveis, use them (they include diasSemana + horaInicio/horaFim)
                          const match = mod.horariosDisponiveis.some((hd: any) => {
                            const hdDaysRaw = Array.isArray(hd.diasSemana) && hd.diasSemana.length > 0 ? hd.diasSemana : [dayIndex];
                            const hdDays = hdDaysRaw.map((d:number)=> d>6? d-1: d);
                              if (!hdDays.includes(dayIndex)) return false;
                            const hi = timeToMinutes(hd.horaInicio);
                            const hf = timeToMinutes(hd.horaFim);
                            // incluir o horário final (ex.: se termina às 09:00, também mostrar a linha 09:00)
                            return m >= hi && m <= hf;
                          });
                          isOpen = !!match;
                        } else if (mod.horarioFuncionamento) {
                          // Fallback to horarioFuncionamento (manha/tarde)
                          const hf = mod.horarioFuncionamento || {};
                          const manhaInicio = hf?.manha?.inicio ? timeToMinutes(hf.manha.inicio) : null;
                          const manhaFim = hf?.manha?.fim ? timeToMinutes(hf.manha.fim) : null;
                          const tardeInicio = hf?.tarde?.inicio ? timeToMinutes(hf.tarde.inicio) : null;
                          const tardeFim = hf?.tarde?.fim ? timeToMinutes(hf.tarde.fim) : null;
                          const inManha = manhaInicio !== null && manhaFim !== null ? (m >= manhaInicio && m <= manhaFim) : false;
                          const inTarde = tardeInicio !== null && tardeFim !== null ? (m >= tardeInicio && m <= tardeFim) : false;
                          isOpen = inManha || inTarde;
                        } else {
                          // No horario info on modalidade: keep page-wide interval
                          isOpen = o < c ? (m >= o && m <= c) : true;
                        }
                      }
                    }
                    // Respect manual blocked slots - guardamos separadamente para diferenciar na UI
                    const isManuallyBlocked = isBlocked;
                    const isOutsideSchedule = !isOpen; // fora do horário de funcionamento da modalidade
                    if (isBlocked) isOpen = false;

                    // Verificar se há conflito com modalidade vinculada
                    const conflitoVinculado = horariosVinculados[key];
                    const hasConflito = !!conflitoVinculado;

                    return (
                      <td
                        key={key}
                        rowSpan={rowSpan}
                        onClick={(e) => {
                          scrollToCenter(e);
                          if (!isOpen) return; // blocked slot
                          if (hasConflito) return; // conflito com modalidade vinculada
                          // Se não tem permissão de gerenciar turmas, não faz nada
                          if (!permissoesHorarios.gerenciarTurmas()) return;
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
                        className={`border-r border-b border-gray-200 ${(!isOpen || hasConflito) ? 'cursor-not-allowed opacity-90' : ''} ${hasConflito ? 'bg-orange-50' : (!isOpen ? 'bg-red-50' : '')} ${(isOpen && !hasConflito && (!turmas || turmas.length === 0) && permissoesHorarios.gerenciarTurmas()) ? 'cursor-pointer' : 'cursor-default'}`}
                        style={{ verticalAlign: 'middle' }}
                      >
                            <div className={`h-full ${!isOpen ? '' : (turmas && turmas.length > 0) ? 'bg-white p-2 w-full' : ''} ${!isOpen ? 'p-4 flex items-center justify-center' : (turmas && turmas.length > 0) ? 'rounded-md flex flex-col w-full' : ''}`}>
                          {isOpen ? (
                            // open interval: show turmas or 'TURMA VAGA'
                            (turmas && turmas.length > 0) ? (
                              <div className="flex flex-col w-full">
                                <div className="flex flex-col space-y-2 w-full">
                                  {turmas.map((turma, turmaIdx) => {
                                    const visibleAlunos = (() => {
                                      try {
                                        if (Array.isArray(turma.alunos) && turma.alunos.length === 1 && Array.isArray(turma.alunos[0].matriculas) && turma.alunos[0].matriculas.length > 0) {
                                          return (turma.alunos[0].matriculas || []).filter((m: any) => m && m.alunoId && (m.alunoId.nome || m.alunoId._id));
                                        }
                                      } catch (e) {}
                                      return (turma.alunos || []).filter((h: any) => h && h.alunoId && (h.alunoId.nome || h.alunoId._id));
                                    })();
                                    // Determine capacity: prefer turma-specific limit, then selected modalidade, otherwise infer from first aluno
                                    let capacity: number | undefined = undefined;
                                    try {
                                      // Prioridade: 1) limite da turma, 2) limite da modalidade
                                      const turmaTemplate = turma.alunos && turma.alunos[0];
                                      if (turmaTemplate && typeof turmaTemplate.limiteAlunos === 'number') {
                                        capacity = turmaTemplate.limiteAlunos;
                                      } else if (modalidadeSelecionada) {
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
                                    // Exclude emEspera, congelado, and ausente from displayed capacity count (they free up spots)
                                    const count = visibleAlunos.filter((h: any) => {
                                      try {
                                        const local = localFlags[h._id] || {};
                                        // Check both alunoId fields and direct fields (for backward compatibility)
                                        const isEmEspera = (h.alunoId?.emEspera === true || h.emEspera === true) || local.emEspera === true;
                                        const isCongelado = (h.alunoId?.congelado === true || h.congelado === true) || local.congelado === true;
                                        const isAusente = (h.alunoId?.ausente === true || h.ausente === true) || local.ausente === true;
                                        return !(isEmEspera || isCongelado || isAusente);
                                      } catch (e) { return true; }
                                    }).length;
                                    const exceeded = capacity !== undefined && count >= capacity;
                                    const over = capacity !== undefined && count > capacity; // aluno a mais
                                    // Verificar se o limite é personalizado da turma
                                    const turmaTemplate = turma.alunos && turma.alunos[0];
                                    const isCustomLimit = turmaTemplate && typeof turmaTemplate.limiteAlunos === 'number';
                                    const explicitTurmaObs = (turma as any).observacaoTurma;
                                    const turmaObsStr = explicitTurmaObs ? String(explicitTurmaObs).trim() : '';
                                    // determine professor/modalidade color (fallback to primary) and compute a pastel background
                                    let cor = turma.professorCor;
                                    if (!cor && turma.professorId) {
                                      const profObj = professores.find(p => p._id === turma.professorId);
                                      cor = profObj?.cor || '#3B82F6';
                                    }
                                    const pastelBg = (() => {
                                      try {
                                        const hex = (String(cor || '#3B82F6').replace('#', '')).padStart(6, '0');
                                        const r = parseInt(hex.substring(0,2), 16);
                                        const g = parseInt(hex.substring(2,4), 16);
                                        const b = parseInt(hex.substring(4,6), 16);
                                        const mix = (v: number) => Math.round(v + (255 - v) * 0.8); // 80% toward white for pastel
                                        return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
                                      } catch (e) { return undefined; }
                                    })();

                                    // Determine styling for vacancy vs full
                                    const isFull = capacity !== undefined && count >= capacity; // lotado
                                    const hasVacancy = capacity !== undefined && count < capacity;
                                    let bgStyle: any = undefined;
                                    let borderCls = 'border-gray-200';
                                    let textCls = 'text-primary-800';

                                    if (isFull) {
                                      // pastel red background and stronger red border
                                      bgStyle = { backgroundColor: 'rgb(254, 226, 226)' };
                                      borderCls = 'border-red-400';
                                      textCls = 'text-red-800 font-semibold';
                                    } else if (hasVacancy) {
                                      // pastel green background and stronger green border
                                      bgStyle = { backgroundColor: 'rgb(236, 253, 245)' };
                                      borderCls = 'border-green-400';
                                      textCls = 'text-green-800';
                                    } else {
                                      // fallback: use professor-based pastel if available
                                      if (pastelBg) bgStyle = { backgroundColor: pastelBg };
                                    }

                                    const turmaClass = `${borderCls} ${textCls} border px-3 py-2 rounded-md text-xs mb-1 flex flex-col w-full`;
                                    try { if (typeof window !== 'undefined') console.debug('renderTurma: turma', { professor: turma.professorNome, turmaObs: turma.observacaoTurma, visibleAlunos: visibleAlunos.map((a:any)=>({id:a._id, obs: a.observacoes})) }); } catch(e) {}

                                    return (
                                      <div key={turma.professorId + turma.horarioFim} className={turmaClass} style={bgStyle}>
                                          <div className="flex items-center justify-between mb-1">
                                          <div className="font-medium text-left">
                                            {turma.professorNome && (
                                              (() => {
                                                // Try to get the color from turma.professorCor, else from professores array
                                                let cor = turma.professorCor;
                                                if (!cor && turma.professorId) {
                                                  const profObj = professores.find(p => p._id === turma.professorId);
                                                  cor = profObj?.cor || '#3B82F6';
                                                }
                                                return (
                                                  <>
                                                    <span
                                                      className="inline-block px-2 py-0.5 rounded-md font-medium text-white text-[11px] border border-gray-200 shadow-sm transition-colors duration-150"
                                                      style={{ backgroundColor: cor }}
                                                    >
                                                      {turma.professorNome.replace(/^Personal\s*/i, '')}
                                                    </span>
                                                    {over && (
                                                      <div className="mt-1">
                                                        <span className="inline-flex items-center text-[11px] text-yellow-800 bg-yellow-100 px-2 py-0.5 rounded-md" title="Turma com aluno a mais">
                                                          <i className="fas fa-exclamation-triangle mr-1" aria-hidden></i>
                                                          Aluno a mais
                                                        </span>
                                                      </div>
                                                    )}
                                                  </>
                                                );
                                              })()
                                            )}
                                          </div>
                                          <div 
                                            className={`text-[11px] ${exceeded ? 'text-red-700 font-semibold' : 'text-gray-600'}`}
                                            title={isCustomLimit ? 'Limite personalizado desta turma' : 'Limite da modalidade'}
                                          >
                                            {count}{capacity ? `/${capacity}` : ''}{isCustomLimit ? ' ✱' : ''}
                                          </div>
                                        </div>
                                        {turmaObsStr ? (
                                          <div className="mb-2 text-left">
                                            <span className="inline-block text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md font-semibold">
                                              {turmaObsStr.replace(/\[CONGELADO\]|\[AUSENTE\]/g, '').trim()}
                                            </span>
                                          </div>
                                        ) : null}
                                        <div className="space-y-0.5 max-h-40 overflow-y-auto text-xs">
                                          {visibleAlunos.map((horario: any) => {
                                            const aluno = horario.alunoId || horario.aluno || {};
                                            const studentName = String(aluno.nome || '').trim();
                                            const studentObsRaw = String(horario.observacoes || '');
                                            const studentObs = studentObsRaw.replace(/\[CONGELADO\]|\[AUSENTE\]/g, '').trim();
                                            const isCongelado = aluno?.congelado === true || localFlags[horario._id]?.congelado === true;
                                            const isAusente = aluno?.ausente === true || localFlags[horario._id]?.ausente === true;
                                            const isEmEspera = aluno?.emEspera === true || localFlags[horario._id]?.emEspera === true;
                                            // compact card: no avatar to save horizontal space
                                            const alunoIdForModal = aluno?._id || (typeof horario.alunoId === 'string' ? horario.alunoId : horario.alunoId?._id);

                                            return (
                                              <div key={horario._id} className="flex items-center gap-1 rounded-md px-0.5 py-0.5">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1">
                                                      <i className="fas fa-user text-[11px] text-gray-500" aria-hidden="true" />
                                                      <div 
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          if (alunoIdForModal) {
                                                            setAlunoRowModalId(alunoIdForModal);
                                                            setShowAlunoRowModal(true);
                                                          }
                                                        }}
                                                        className={`font-medium text-[11px] truncate cursor-pointer hover:underline ${(isAusente || isCongelado) ? 'text-gray-400 line-through' : 'text-gray-800'}`}
                                                      >
                                                        {studentName || '— sem nome —'}
                                                      </div>
                                                    </div>
                                                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-600">
                                                    {aluno?.periodoTreino && (
                                                      <span className="inline-flex items-center px-1" title={`Período: ${aluno.periodoTreino}`}>
                                                        <i className="fas fa-clock text-xs" aria-hidden="true" />
                                                      </span>
                                                    )}
                                                    {aluno?.parceria && (
                                                      <span className="inline-flex items-center px-1" title={`Parceria: ${aluno.parceria}`}>
                                                        <i className="fas fa-handshake text-xs" aria-hidden="true" />
                                                      </span>
                                                    )}
                                                    {isCongelado && (
                                                      <span className="inline-flex items-center px-1" title="Congelado">
                                                        <i className="fas fa-snowflake text-xs" aria-hidden="true" />
                                                      </span>
                                                    )}
                                                    {isAusente && (
                                                      <span className="inline-flex items-center px-1" title="Ausente">
                                                        <i className="fas fa-user-clock text-xs" aria-hidden="true" />
                                                      </span>
                                                    )}
                                                  </div>
                                                  {studentObs ? <div className="text-[11px] text-gray-500 mt-0.5 truncate">{studentObs}</div> : null}
                                                </div>

                                                {permissoesHorarios.removerAluno() && (
                                                <div className="flex-shrink-0">
                                                  <button
                                                    onClick={async (e) => {
                                                      e.stopPropagation();
                                                      try {
                                                        const result = await Swal.fire({
                                                          title: 'Remover aluno?',
                                                          text: 'Remover este aluno desta turma?',
                                                          icon: 'warning',
                                                          showCancelButton: true,
                                                          confirmButtonColor: '#ef4444',
                                                          cancelButtonColor: '#6b7280',
                                                          confirmButtonText: 'Sim, remover',
                                                          cancelButtonText: 'Cancelar'
                                                        });
                                                        if (!result.isConfirmed) return;
                                                        let deleted = false;
                                                        if (horario._id) {
                                                          try {
                                                            const respMat = await fetch(`/api/matriculas/${horario._id}`, { method: 'DELETE' });
                                                            if (respMat.ok) {
                                                              const j = await respMat.json();
                                                              if (j && j.success) deleted = true;
                                                            }
                                                          } catch (e) {}
                                                        }
                                                        if (!deleted && horario._id) {
                                                          try {
                                                            const respHor = await fetch(`/api/horarios/${horario._id}`, { method: 'DELETE' });
                                                            if (respHor.ok) {
                                                              const j2 = await respHor.json();
                                                              if (j2 && j2.success) deleted = true;
                                                            }
                                                          } catch (e) {}
                                                        }
                                                        if (deleted) await fetchHorarios(); else toast.error('Falha ao remover aluno.');
                                                      } catch (err) {
                                                        console.error('Erro ao remover aluno:', err);
                                                        toast.error('Erro ao remover aluno');
                                                      }
                                                    }}
                                                    title="Remover aluno"
                                                    className="p-0.5 rounded-md hover:bg-gray-100"
                                                  >
                                                    <span className={`text-xs ${(isAusente || isCongelado) ? 'text-gray-400' : 'text-gray-800'}`} aria-hidden>×</span>
                                                  </button>
                                                </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                        {/* Botões de ação da turma */}
                                        <div className="mt-2 flex items-center justify-center gap-1.5">
                                          
                                          {permissoesHorarios.adicionarAluno() && (
                                          <button
                                            onClick={(e) => { e.stopPropagation(); if (exceeded) return; setAddAlunoTurma({ professorId: String((turma as any).professorId?._id || (turma as any).professorId || ''), diaSemana: dayIndex, horarioInicio: turma.horarioInicio, horarioFim: turma.horarioFim }); setShowAddSingleAlunoModal(true); setSingleAlunoSearch(''); setSingleAlunoSelectedId(null); setSingleAlunoName(''); setSingleAlunoObservacoes(''); }}
                                            title={exceeded ? 'Turma lotada' : 'Adicionar 1 aluno'}
                                            type="button"
                                            disabled={exceeded}
                                            aria-disabled={exceeded}
                                            className={`p-1 w-7 h-7 flex items-center justify-center rounded-md ${exceeded ? 'text-gray-400 cursor-not-allowed' : 'text-gray-500'}`}
                                          >
                                            <i className="fas fa-user-plus text-xs" aria-hidden="true" />
                                          </button>
                                          )}

                                          {permissoesHorarios.gerenciarTurmas() && (
                                          <button
                                            onClick={(e) => { e.stopPropagation(); openEditTurmaGroup(turma); }}
                                            title="Editar turma"
                                            className="p-1 w-7 h-7 flex items-center justify-center text-gray-500"
                                          >
                                            <i className="fas fa-edit text-xs" aria-hidden="true" />
                                          </button>
                                          )}

                                          {permissoesHorarios.gerenciarTurmas() && (
                                          <button
                                            onClick={async (e) => { 
                                              e.stopPropagation(); 
                                              const result = await Swal.fire({
                                                title: 'Excluir turma?',
                                                text: 'Excluir TODA a turma? Isso removerá todos os alunos deste horário.',
                                                icon: 'warning',
                                                showCancelButton: true,
                                                confirmButtonColor: '#ef4444',
                                                cancelButtonColor: '#6b7280',
                                                confirmButtonText: 'Sim, excluir tudo',
                                                cancelButtonText: 'Cancelar'
                                              });
                                              if (!result.isConfirmed) return; 
                                              handleDeleteTurma(turma); 
                                            }}
                                            title="Excluir turma inteira"
                                            className="p-1 w-7 h-7 flex items-center justify-center text-gray-500"
                                          >
                                            <i className="fas fa-trash text-xs" aria-hidden="true" />
                                          </button>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                                {/* add-button: render outside the turma card list so it visually indicates adding another turma for this slot */}
                                {permissoesHorarios.gerenciarTurmas() && (
                                <div className="mt-2 w-full flex items-center justify-center">
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); if (isBlocked) { toast.warning('Horário bloqueado'); return; } /* open create modal prefilled for this slot */
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
                                    className="p-1 w-7 h-7 flex items-center justify-center text-gray-500"
                                    title="Adicionar nova turma neste horário"
                                  >
                                    <i className="fas fa-plus text-xs"></i>
                                  </button>
                                </div>
                                )}
                              </div>
                            ) : hasConflito ? (
                              // Célula com conflito de modalidade vinculada
                              <div className="h-full w-full flex items-center justify-center p-2">
                                <div 
                                  className="text-center p-3 rounded-lg border-2 border-dashed w-full"
                                  style={{ 
                                    backgroundColor: `${conflitoVinculado.modalidadeCor}15`,
                                    borderColor: conflitoVinculado.modalidadeCor
                                  }}
                                >
                                  <i 
                                    className="fas fa-link text-base mb-1"
                                    style={{ color: conflitoVinculado.modalidadeCor }}
                                  ></i>
                                  <p 
                                    className="text-xs font-bold"
                                    style={{ color: conflitoVinculado.modalidadeCor }}
                                  >
                                    {conflitoVinculado.modalidadeNome}
                                  </p>
                                  <p className="text-[10px] text-gray-600 mt-0.5">
                                    {conflitoVinculado.horarioInicio} - {conflitoVinculado.horarioFim}
                                  </p>
                                  <p className="text-[9px] text-orange-600 font-medium mt-1">
                                    <i className="fas fa-exclamation-triangle mr-1"></i>
                                    Espaço ocupado
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <div className="h-full w-full flex items-center justify-center p-4">
                                <div className="text-center">
                                  <i className="fas fa-check-circle text-green-600 text-base mb-1"></i>
                                  <p className="text-xs font-semibold text-green-700">TURMA VAGA</p>
                                  {permissoesHorarios.gerenciarTurmas() && (
                                    <p className="text-xs text-gray-500 mt-1">Clique para adicionar</p>
                                  )}
                                  <div className="mt-2 flex items-center justify-center">
                                    {permissoesHorarios.bloquearHorarios() && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); toggleBlockSlot(horarioSlot, dayIndex); }}
                                      className="text-xs text-gray-600 px-2 py-1 border rounded-md hover:bg-gray-50"
                                      title="Bloquear horário"
                                    >
                                      Bloquear
                                    </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          ) : (
                            // blocked slot - diferencia bloqueio manual vs fora do horário
                            isManuallyBlocked ? (
                              // Bloqueio manual - mostra opção de desbloquear
                              <div className="h-full w-full flex items-center justify-center p-4">
                                <div className="text-center">
                                  <i className="fas fa-ban text-red-600 text-base mb-1"></i>
                                  <p className="text-xs font-semibold text-red-700">BLOQUEADO</p>
                                  <p className="text-[10px] text-gray-500 mt-0.5">Bloqueio manual</p>
                                  <div className="mt-2 flex items-center justify-center">
                                    {permissoesHorarios.bloquearHorarios() && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); toggleBlockSlot(horarioSlot, dayIndex); }}
                                      className="text-xs text-primary-600 px-2 py-1 border rounded-md bg-white hover:bg-gray-50"
                                      title="Desbloquear horário"
                                    >
                                      Desbloquear
                                    </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              // Fora do horário de funcionamento - não mostra opção de desbloquear
                              <div className="h-full w-full flex items-center justify-center p-4">
                                <div className="text-center">
                                  <i className="fas fa-clock text-gray-400 text-base mb-1"></i>
                                  <p className="text-xs font-semibold text-gray-500">SEM AULA</p>
                                  <p className="text-[10px] text-gray-400 mt-0.5">Fora do horário</p>
                                </div>
                              </div>
                            )
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

        {/* Grade de horários - Versão Mobile */}
        {mounted && (
          <div className="md:hidden fade-in-3">
            {/* Seletor de dia da semana - Mobile */}
            {(() => {
              // Obter dias disponíveis da modalidade selecionada
              const modalidadeAtual = modalidades.find(m => getMid(m) === modalidadeSelecionada) as any;
              const diasDisponiveis: number[] = modalidadeAtual?.diasSemana || [0, 1, 2, 3, 4, 5, 6];
              const diasLabels = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
              const diasVisiveis = diasLabels.filter((_, idx) => diasDisponiveis.length === 0 || diasDisponiveis.includes(idx));
              
              return (
                <div className="bg-white rounded-lg border border-gray-200 p-3 mb-4">
                  <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${diasVisiveis.length}, 1fr)` }}>
                    {diasLabels.map((dia, idx) => {
                      // Se a modalidade tem diasSemana definidos e este dia não está incluído, não exibir
                      if (diasDisponiveis.length > 0 && !diasDisponiveis.includes(idx)) {
                        return null;
                      }
                      
                      const isToday = idx === todayIndex;
                      const isSelected = idx === mobileDiaSelecionado;
                      // Contar horários neste dia
                      const horariosNoDia = horariosFiltrados.filter(h => h.diaSemana === idx).length;
                      
                      return (
                        <button
                          key={idx}
                          onClick={() => setMobileDiaSelecionado(idx)}
                          className={`flex flex-col items-center py-2 rounded-lg text-xs font-medium transition-all ${
                            isSelected 
                              ? 'bg-primary-600 text-white shadow-md' 
                              : isToday 
                                ? 'bg-green-100 text-green-800 border border-green-300'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          <span className="font-semibold">{dia}</span>
                          {horariosNoDia > 0 && (
                            <span className={`text-[10px] mt-0.5 ${isSelected ? 'text-white/80' : 'text-gray-500'}`}>
                              {horariosNoDia}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Lista de horários do dia selecionado */}
            <div className="space-y-3">
              {(() => {
                // Agrupar horários do dia por horarioInicio
                const horariosNoDia = horariosFiltrados
                  .filter(h => h.diaSemana === mobileDiaSelecionado)
                  .sort((a, b) => a.horarioInicio.localeCompare(b.horarioInicio));

                  if (horariosNoDia.length === 0) {
                  return (
                    <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                      <i className="fas fa-calendar-times text-3xl text-gray-300 mb-3"></i>
                      <p className="text-gray-500">Nenhum horário cadastrado para {diasSemana[mobileDiaSelecionado]}</p>
                      {permissoesHorarios.gerenciarTurmas() && (
                      <button
                        onClick={() => {
                          setEditingMode('create');
                          setFormData({
                            alunoId: '',
                            professorId: '',
                            diaSemana: mobileDiaSelecionado,
                            horarioInicio: '06:00',
                            horarioFim: '07:00',
                            observacoes: '',
                            observacaoTurma: '',
                            modalidadeId: modalidadeSelecionada || ''
                          });
                          setSelectedHorarioId(null);
                          setEditingMemberIds([]);
                          setShowModal(true);
                        }}
                        className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium"
                      >
                        <i className="fas fa-plus"></i>
                        Adicionar Horário
                      </button>
                      )}
                    </div>
                  );
                }                // Agrupar por horário de início + professor
                const grupos: Record<string, typeof horariosNoDia> = {};
                horariosNoDia.forEach(h => {
                  const profId = typeof h.professorId === 'object' ? h.professorId?._id : h.professorId;
                  const key = `${h.horarioInicio}-${h.horarioFim}-${profId || 'sem-prof'}`;
                  if (!grupos[key]) grupos[key] = [];
                  grupos[key].push(h);
                });

                return Object.entries(grupos).map(([key, horarios]) => {
                  const primeiro = horarios[0];
                  const profObj = typeof primeiro.professorId === 'object' ? primeiro.professorId : professores.find(p => p._id === primeiro.professorId);
                  const profNome = profObj?.nome || 'Sem professor';
                  const profCor = profObj?.cor || '#3B82F6';

                  // Coletar alunos de todas as matrículas
                  const todosAlunos: any[] = [];
                  horarios.forEach(h => {
                    const matriculas = (h as any).matriculas || [];
                    if (Array.isArray(matriculas) && matriculas.length > 0) {
                      matriculas.forEach((m: any) => {
                        if (m.alunoId) todosAlunos.push({ ...m, horarioId: h._id });
                      });
                    } else if (h.alunoId) {
                      todosAlunos.push({ alunoId: h.alunoId, horarioId: h._id });
                    }
                  });

                  // Determinar capacidade
                  let capacity: number | undefined = undefined;
                  if (modalidadeSelecionada) {
                    const mod = modalidades.find(m => (m as any)._id === modalidadeSelecionada || (m as any).id === modalidadeSelecionada) as any;
                    if (mod?.limiteAlunos) capacity = mod.limiteAlunos;
                  }

                  const alunosAtivos = todosAlunos.filter(a => {
                    const aluno = a.alunoId;
                    return !(aluno?.congelado || aluno?.ausente || aluno?.emEspera);
                  });

                  const isFull = capacity !== undefined && alunosAtivos.length >= capacity;
                  const isExpanded = mobileExpandedCards.has(key);

                  const toggleExpand = () => {
                    setMobileExpandedCards(prev => {
                      // Se já está aberto, fecha. Senão, abre apenas este (fechando os outros)
                      if (prev.has(key)) {
                        return new Set();
                      } else {
                        return new Set([key]);
                      }
                    });
                  };

                  return (
                    <div 
                      key={key} 
                      className={`bg-white rounded-xl border ${isFull ? 'border-red-300' : 'border-gray-200'} overflow-hidden shadow-sm`}
                    >
                      {/* Header do card - Clicável para expandir */}
                      <div 
                        className="px-4 py-3 flex items-center justify-between cursor-pointer active:bg-gray-50 transition-colors"
                        style={{ backgroundColor: isFull ? '#FEE2E2' : `${profCor}10` }}
                        onClick={toggleExpand}
                      >
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-1 h-10 rounded-full"
                            style={{ backgroundColor: profCor }}
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-base font-bold text-gray-900">
                                {primeiro.horarioInicio}
                              </span>
                              <span className="text-xs text-gray-400">-</span>
                              <span className="text-sm text-gray-600">
                                {primeiro.horarioFim}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span 
                                className="text-xs font-medium"
                                style={{ color: profCor }}
                              >
                                {profNome.replace(/^Personal\s*/i, '')}
                              </span>
                              <span className="text-xs text-gray-400">•</span>
                              <span className={`text-xs font-medium ${isFull ? 'text-red-600' : 'text-gray-500'}`}>
                                {alunosAtivos.length}{capacity ? `/${capacity}` : ''} alunos
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isFull && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-semibold rounded-full">
                              LOTADA
                            </span>
                          )}
                          <i className={`fas fa-chevron-down text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}></i>
                        </div>
                      </div>

                      {/* Conteúdo expandível */}
                      {isExpanded && (
                        <>
                          {/* Lista de alunos */}
                          <div className="divide-y divide-gray-100 border-t border-gray-100">
                            {todosAlunos.length === 0 ? (
                              <div className="px-4 py-4 text-sm text-gray-500 italic text-center flex flex-col items-center justify-center">
                                <i className="fas fa-users text-gray-300 text-lg mb-2"></i>
                                <span>Nenhum aluno matriculado</span>
                              </div>
                            ) : (
                              todosAlunos.map((item, idx) => {
                                const aluno = item.alunoId || {};
                                const isCongelado = aluno.congelado;
                                const isAusente = aluno.ausente;
                                const isEmEspera = aluno.emEspera;
                                const isMuted = isCongelado || isAusente || isEmEspera;

                                return (
                                  <div 
                                    key={`${aluno._id || idx}-${idx}`}
                                    className={`px-4 py-2.5 flex items-center justify-between ${isMuted ? 'bg-gray-50' : ''}`}
                                  >
                                    <div 
                                      className="flex items-center gap-2 min-w-0 flex-1"
                                      onClick={() => {
                                        if (aluno._id) {
                                          setAlunoRowModalId(aluno._id);
                                          setShowAlunoRowModal(true);
                                        }
                                      }}
                                    >
                                      <i className={`fas fa-user text-xs ${isMuted ? 'text-gray-300' : 'text-gray-400'}`}></i>
                                      <span className={`text-sm truncate ${isMuted ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                                        {aluno.nome || '— sem nome —'}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                      {isCongelado && (
                                        <span className="text-sky-500" title="Congelado">
                                          <i className="fas fa-snowflake text-xs"></i>
                                        </span>
                                      )}
                                      {isAusente && (
                                        <span className="text-rose-500" title="Ausente">
                                          <i className="fas fa-user-clock text-xs"></i>
                                        </span>
                                      )}
                                      {isEmEspera && (
                                        <span className="text-amber-500" title="Em Espera">
                                          <i className="fas fa-clock text-xs"></i>
                                        </span>
                                      )}
                                      {aluno.parceria === 'TOTALPASS' && (
                                        <span className="text-purple-500" title="TOTALPASS">
                                          <i className="fas fa-id-badge text-xs"></i>
                                        </span>
                                      )}
                                      {/* Botão remover aluno */}
                                      {permissoesHorarios.removerAluno() && (
                                      <button
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          try {
                                            const result = await Swal.fire({
                                              title: 'Remover aluno?',
                                              text: `Remover ${aluno.nome || 'este aluno'} desta turma?`,
                                              icon: 'warning',
                                              showCancelButton: true,
                                              confirmButtonColor: '#ef4444',
                                              cancelButtonColor: '#6b7280',
                                              confirmButtonText: 'Sim, remover',
                                              cancelButtonText: 'Cancelar'
                                            });
                                            if (!result.isConfirmed) return;
                                            
                                            let deleted = false;
                                            const matriculaId = item._id || item.horarioId;
                                            
                                            if (matriculaId) {
                                              // Tentar deletar como matrícula primeiro
                                              try {
                                                const respMat = await fetch(`/api/matriculas/${matriculaId}`, { method: 'DELETE' });
                                                if (respMat.ok) {
                                                  const j = await respMat.json();
                                                  if (j && j.success) deleted = true;
                                                }
                                              } catch (e) {}
                                              
                                              // Se não conseguiu, tentar como horário
                                              if (!deleted) {
                                                try {
                                                  const respHor = await fetch(`/api/horarios/${matriculaId}`, { method: 'DELETE' });
                                                  if (respHor.ok) {
                                                    const j2 = await respHor.json();
                                                    if (j2 && j2.success) deleted = true;
                                                  }
                                                } catch (e) {}
                                              }
                                            }
                                            
                                            if (deleted) {
                                              toast.success('Aluno removido da turma');
                                              await fetchHorarios();
                                            } else {
                                              toast.error('Falha ao remover aluno.');
                                            }
                                          } catch (err) {
                                            console.error('Erro ao remover aluno:', err);
                                            toast.error('Erro ao remover aluno');
                                          }
                                        }}
                                        className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                        title="Remover aluno"
                                      >
                                        <i className="fas fa-trash-alt text-xs"></i>
                                      </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>

                          {/* Footer com ações */}
                          <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex justify-between gap-2">
                            {permissoesHorarios.gerenciarTurmas() && (
                              <button
                                onClick={() => {
                                  // Editar turma - abre o modal de edição
                                  const profId = typeof primeiro.professorId === 'object' ? primeiro.professorId?._id : primeiro.professorId;
                                  setEditingMode('turma');
                                  setFormData({
                                    alunoId: '',
                                    professorId: profId || '',
                                  diaSemana: primeiro.diaSemana,
                                  horarioInicio: primeiro.horarioInicio,
                                  horarioFim: primeiro.horarioFim,
                                  observacoes: '',
                                  observacaoTurma: (primeiro as any).observacaoTurma || '',
                                  modalidadeId: modalidadeSelecionada || ''
                                });
                                // Coletar IDs de todos os membros da turma
                                const memberIds = horarios.map(h => h._id).filter(Boolean) as string[];
                                setEditingMemberIds(memberIds);
                                setSelectedHorarioId(primeiro._id);
                                setShowModal(true);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200 bg-white"
                            >
                              <i className="fas fa-edit"></i>
                              Editar Turma
                            </button>
                            )}
                            {permissoesHorarios.adicionarAluno() && (
                            <button
                              onClick={() => {
                                setAddAlunoTurma({
                                  professorId: typeof primeiro.professorId === 'object' ? primeiro.professorId?._id : primeiro.professorId,
                                  diaSemana: primeiro.diaSemana,
                                  horarioInicio: primeiro.horarioInicio,
                                  horarioFim: primeiro.horarioFim
                                });
                                setSingleAlunoSearch('');
                                setSingleAlunoSelectedId(null);
                                setSingleAlunoName('');
                                setSingleAlunoObservacoes('');
                                setShowAddSingleAlunoModal(true);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
                            >
                              <i className="fas fa-user-plus"></i>
                              Adicionar Aluno
                            </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                });
              })()}
            </div>

            {/* Botão para adicionar novo horário no dia selecionado */}
            {permissoesHorarios.gerenciarTurmas() && (
            <button
              onClick={() => {
                setEditingMode('create');
                setFormData({
                  alunoId: '',
                  professorId: '',
                  diaSemana: mobileDiaSelecionado,
                  horarioInicio: '06:00',
                  horarioFim: '07:00',
                  observacoes: '',
                  observacaoTurma: '',
                  modalidadeId: modalidadeSelecionada || ''
                });
                setSelectedHorarioId(null);
                setEditingMemberIds([]);
                setShowModal(true);
              }}
              className="w-full mt-4 inline-flex items-center justify-center gap-2 px-4 py-3 bg-white text-primary-600 border-2 border-dashed border-primary-300 rounded-lg text-sm font-medium hover:bg-primary-50 transition-colors"
            >
              <i className="fas fa-plus-circle"></i>
              Adicionar Nova Turma em {['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][mobileDiaSelecionado]}
            </button>
            )}
          </div>
        )}

        {/* Lista de horários removida conforme solicitado pelo usuário */}

        {/* legenda removida */}

      </div>

      {/* Modal para cadastrar novo horário */}
      {/* Modal de confirmação quando encontra aluno similar */}
      {confirmAlunoDialog && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 z-50 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
          <div className="relative w-full max-w-sm mx-auto p-5 bg-white shadow-lg rounded-2xl max-h-[90vh] overflow-y-auto">
            <div className="mt-3">
              <h3 className="text-base font-semibold text-gray-900 mb-2">Confirmação de Aluno Similar</h3>
              <p className="text-sm text-gray-700 mb-3">O nome &quot;{confirmAlunoDialog.name}&quot; parece corresponder a um aluno já cadastrado. O que deseja fazer?</p>
              <div className="mb-3">
                {confirmAlunoDialog.candidates.map(c => (
                  <div key={c.aluno._id} className="p-2 border rounded-md mb-2">
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
                  className="px-3 py-1 border rounded-md text-sm"
                >Criar novo</button>
                <button
                  onClick={() => {
                    // skip this name
                    if (pendingAlunoResolve.current) pendingAlunoResolve.current({ action: 'skip' });
                    setConfirmAlunoDialog(null);
                    pendingAlunoResolve.current = null;
                  }}
                  className="px-3 py-1 border rounded-md text-sm"
                >Pular</button>
                <button
                  onClick={() => {
                    // use existing (first candidate)
                    const chosen = confirmAlunoDialog.candidates[0];
                    if (pendingAlunoResolve.current) pendingAlunoResolve.current({ action: 'use', alunoId: chosen.aluno._id });
                    setConfirmAlunoDialog(null);
                    pendingAlunoResolve.current = null;
                  }}
                  className="px-3 py-1 bg-primary-600 text-white rounded-md text-sm"
                >Usar: {confirmAlunoDialog.candidates[0].aluno.nome}</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-600 bg-opacity-50 p-4">
          <div className="relative w-full max-w-lg mx-auto bg-white rounded-2xl shadow-lg border border-gray-200 p-4 sm:p-6 max-h-[90vh] overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="horarioModalTitle" aria-describedby="horarioModalDesc" tabIndex={-1}>
            {/* Header + Info */}
            <div className="mb-2 border-b pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <i className={`fas ${editingMode === 'create' ? 'fa-plus' : 'fa-edit'} text-primary-600 text-lg`} aria-hidden="true"></i>
                  <h3 id="horarioModalTitle" className="text-base font-semibold text-gray-900">{editingMode === 'turma' ? 'Editar Turma' : editingMode === 'single' ? 'Editar Horário' : 'Cadastrar Nova Turma'}</h3>
                </div>
                <button
                  onClick={() => {
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
                  }}
                  className="text-gray-400 hover:text-gray-600 focus:outline-none"
                  aria-label="Fechar modal"
                  title="Fechar"
                >
                  <i className="fas fa-times text-lg" aria-hidden="true" />
                </button>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <i className="fas fa-info-circle text-primary-600" aria-hidden="true" />
                <span className="text-xs text-gray-500">
                  {editingMode === 'turma' 
                    ? 'As alterações serão aplicadas a todos os alunos dessa turma.' 
                    : editingMode === 'single' 
                      ? 'Editando o horário individual selecionado.'
                      : 'Preencha os campos para cadastrar uma nova turma.'}
                </span>
              </div>
            </div>

            {/* Turma summary (kept minimal) */}
            {editingMode === 'turma' && (
              <div className="mb-3 p-3 bg-gray-50 rounded-md">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    <div className="font-medium">{professores.find(p => String((p as any)._id || (p as any).id || '') === String(formData.professorId || ''))?.nome || '— professor não selecionado —'}</div>
                    <div className="text-xs text-gray-500">{diasSemana[formData.diaSemana || 0]} • {formData.horarioInicio || '—'} — {formData.horarioFim || '—'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">{(editingMemberIds && editingMemberIds.length) || 0} aluno{(editingMemberIds && editingMemberIds.length) === 1 ? '' : 's'}</div>
                    <div className="text-xs text-gray-500">{(() => {
                      try {
                        // Prioridade: limite da turma (formData) > limite da modalidade
                        if (formData.limiteAlunos && Number(formData.limiteAlunos) > 0) {
                          return `Limite: ${formData.limiteAlunos} (turma)`;
                        }
                        const mid = formData.modalidadeId || modalidadeSelecionada || '';
                        const mod = modalidades.find(m => getMid(m) === mid) as any;
                        return mod && typeof mod.limiteAlunos === 'number' ? `Limite: ${mod.limiteAlunos}` : 'Limite: —';
                      } catch (e) { return 'Limite: —'; }
                    })()}</div>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Professor</label>
                <div className="flex flex-wrap gap-1.5">
                  {professores.map((professor) => {
                    const pid = String((professor as any)._id || (professor as any).id || '');
                    const selected = String(formData.professorId || '') === pid;
                    const professorCor = (professor as any).cor || '#3B82F6';
                    return (
                      <button
                        key={pid}
                        type="button"
                        onClick={() => setFormData({...formData, professorId: pid})}
                        style={{
                          backgroundColor: selected ? professorCor : 'white',
                          borderColor: selected ? professorCor : '#E5E7EB',
                          color: selected ? 'white' : '#374151'
                        }}
                        className={`px-2.5 py-0.5 text-xs rounded-full border transition-all ${selected ? '' : 'hover:border-gray-400'}`}
                        aria-pressed={selected}
                      >
                        {professor.nome}
                      </button>
                    );
                  })}
                </div>
                {!formData.professorId && (
                  <div className="text-red-600 text-xs mt-1">Selecione um professor</div>
                )}
                <input type="hidden" name="modalidadeId" value={formData.modalidadeId || modalidadeSelecionada || ''} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dia da Semana</label>
                  {(() => {
                    const avail = getModalidadeAvailability();
                    return (
                      <div className="flex flex-wrap gap-1">
                        {avail.days.map((index: number) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => setFormData({ ...formData, diaSemana: index })}
                            aria-pressed={formData.diaSemana === index}
                            className={`px-2.5 py-0.5 text-xs font-medium rounded-full border transition-all ${formData.diaSemana === index ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'}`}
                          >
                            {diasSemana[index].substring(0,3)}
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Horário Início</label>
                  <select
                    value={formData.horarioInicio}
                    onChange={(e) => {
                      const newInicio = e.target.value;
                      let defaultFim = formData.horarioFim;
                      try {
                        const modId = formData.modalidadeId || modalidadeSelecionada || '';
                        const mod = modalidades.find(m => getMid(m) === modId) as any;
                        const dur = mod && typeof mod.duracao === 'number' ? mod.duracao : undefined;
                        if (dur && newInicio) {
                          const startMinutes = timeToMinutes(newInicio);
                          const endMinutes = startMinutes + dur;
                          const candidate = horariosDisponiveis.find(h => timeToMinutes(h) >= endMinutes);
                          if (candidate) defaultFim = candidate;
                        }
                      } catch (err) { }
                      setFormData({...formData, horarioInicio: newInicio, horarioFim: defaultFim});
                    }}
                    className="block w-full h-8 border border-gray-300 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-primary-500 focus:border-primary-500 transition-all"
                    required
                  >
                    <option value="">Selecione</option>
                    {getModalidadeAvailability().times.map((horario) => (
                      <option key={horario} value={horario}>{horario}</option>
                    ))}
                  </select>
                  <div className="mt-1 text-xs text-gray-500">Término: <span className="font-medium">{formData.horarioFim || '—'}</span></div>
                </div>
              </div>

              {editingMode === 'single' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Observações do Aluno</label>
                  <textarea
                    value={formData.observacoes}
                    onChange={(e) => setFormData({...formData, observacoes: e.target.value})}
                    className="mt-1 block w-full h-10 border border-gray-300 rounded-md px-3 py-2 text-sm font-medium focus:outline-none focus:ring-primary-500 focus:border-primary-500 transition-all"
                    placeholder="Ex.: Problema no joelho, restrição de movimento..."
                  />
                </div>
              )}

              {(editingMode === 'turma' || editingMode === 'create') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Observação da Turma</label>
                  <textarea
                    value={formData.observacaoTurma}
                    onChange={(e) => setFormData({...formData, observacaoTurma: e.target.value})}
                    className="mt-1 block w-full h-10 border border-gray-300 rounded-md px-3 py-2 text-sm font-medium focus:outline-none focus:ring-primary-500 focus:border-primary-500 transition-all"
                    placeholder="Ex.: Turma iniciante, foco em cardio, aquecimento de 10min..."
                  />
                </div>
              )}

              {(editingMode === 'turma' || editingMode === 'create') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Limite de Alunos da Turma
                    <span className="text-gray-400 font-normal ml-1">(opcional - sobrescreve limite da modalidade)</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.limiteAlunos}
                    onChange={(e) => setFormData({...formData, limiteAlunos: e.target.value})}
                    className="mt-1 block w-full h-10 border border-gray-300 rounded-md px-3 py-2 text-sm font-medium focus:outline-none focus:ring-primary-500 focus:border-primary-500 transition-all"
                    placeholder="Ex.: 10 (turma com pais) ou 5 (turma normal)"
                  />
                  {modalidadeSelecionada && (() => {
                    const mod = modalidades.find(m => (m as any)._id === modalidadeSelecionada || (m as any).id === modalidadeSelecionada) as any;
                    if (mod && typeof mod.limiteAlunos === 'number') {
                      return <p className="text-xs text-gray-500 mt-1">Limite padrão da modalidade: {mod.limiteAlunos} alunos</p>;
                    }
                    return null;
                  })()}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t mt-2">
                <button
                  type="button"
                  onClick={() => { 
                    setShowModal(false); 
                    setEditingMode('create'); 
                    setEditingMemberIds(null); 
                    setSelectedHorarioId(null); 
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 flex items-center gap-2"
                >
                  <i className="fas fa-times text-gray-600" aria-hidden="true" /> Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <i className="fas fa-spinner fa-spin" aria-hidden="true" />
                      Salvando...
                    </>
                  ) : editingMode === 'create' ? (
                    <>
                      <i className="fas fa-plus" aria-hidden="true" />
                      Criar
                    </>
                  ) : (
                    <>
                      <i className="fas fa-save" aria-hidden="true" />
                      Atualizar
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de importação em lote */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-600 bg-opacity-50">
          <div className="relative w-full max-w-lg mx-auto bg-white rounded-lg shadow-lg border border-gray-200 p-6">
            {/* Header + Info */}
            <div className="mb-2 border-b pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <i className="fas fa-file-import text-primary-600 text-lg" aria-hidden="true" />
                  <h3 className="text-base font-semibold text-gray-900">Importar Turma em Lote</h3>
                </div>
                <button
                  type="button"
                  onClick={() => { setShowImportModal(false); setImportText(''); setImportResults(null); }}
                  className="text-gray-400 hover:text-gray-600 focus:outline-none"
                  title="Fechar"
                >
                  <i className="fas fa-times text-lg" aria-hidden="true" />
                </button>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <i className="fas fa-info-circle text-primary-600" aria-hidden="true" />
                <span className="text-xs text-gray-500">Cole a lista de nomes e configure a turma.</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                {/* Coluna esquerda - Lista de nomes */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Nomes (um por linha)</label>
                  <textarea
                    value={importText}
                    onChange={e => setImportText(e.target.value)}
                    className="block w-full h-20 border border-gray-300 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-primary-500 focus:border-primary-500 transition-all"
                    placeholder={`João Silva\nMaria Souza\n...`}
                  />
                  <div className="mt-1 flex items-center justify-between">
                    <p className="text-xs text-gray-500">{importEntries.length} detectados</p>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setImportEntries(prev => prev.map(p => ({...p, selected: true})))} className="text-xs text-primary-600 hover:underline">Todos</button>
                      <button type="button" onClick={() => setImportEntries(prev => prev.map(p => ({...p, selected: false})))} className="text-xs text-gray-500 hover:underline">Limpar</button>
                    </div>
                  </div>
                  <div className="mt-2 max-h-32 overflow-y-auto border rounded-md p-2 bg-gray-50">
                    {importEntries.length === 0 && <div className="text-xs text-gray-500">Nenhuma linha detectada.</div>}
                    {importEntries.map((entry) => (
                      <div key={entry.id} className="flex items-center gap-2 mb-1">
                        <input type="checkbox" checked={entry.selected} onChange={e => setImportEntries(prev => prev.map(p => p.id === entry.id ? {...p, selected: e.target.checked} : p))} className="w-3 h-3" />
                        <input value={entry.name} onChange={e => setImportEntries(prev => prev.map(p => p.id === entry.id ? {...p, name: e.target.value} : p))} className="flex-1 border border-gray-200 rounded-md px-2 py-1 text-xs" />
                        <select value={entry.alunoId || ''} onChange={e => setImportEntries(prev => prev.map(p => p.id === entry.id ? {...p, alunoId: e.target.value || undefined} : p))} className="text-xs border border-gray-200 rounded-md px-1 py-1 max-w-[100px]">
                          <option value="">Novo</option>
                          {alunos.slice(0,200).map(a => (
                            <option key={a._id} value={a._id}>{a.nome}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Coluna direita - Configurações */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Professor</label>
                    <select
                      value={importProfessorId}
                      onChange={e => handleImportProfessorChange(e.target.value)}
                      className="block w-full h-8 border border-gray-300 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-primary-500 focus:border-primary-500 transition-all"
                    >
                      <option value="">Selecione</option>
                      {professores.map(p => (
                        <option key={p._id} value={p._id}>{p.nome}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Modalidade</label>
                    <select
                      value={importModalidadeId}
                      onChange={e => setImportModalidadeId(e.target.value)}
                      className="block w-full h-8 border border-gray-300 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-primary-500 focus:border-primary-500 transition-all"
                    >
                      <option value="">Nenhuma</option>
                      {modalidades.map(m => (
                        <option key={m._id} value={m._id}>{m.nome}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Dia da semana</label>
                    <select
                      value={importDiaSemana}
                      onChange={e => setImportDiaSemana(parseInt(e.target.value))}
                      className="block w-full h-8 border border-gray-300 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-primary-500 focus:border-primary-500 transition-all"
                    >
                      {diasSemana.map((d, i) => (
                        <option key={i} value={i}>{d}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Início</label>
                      <select
                        value={importHorarioInicio}
                        onChange={e => setImportHorarioInicio(e.target.value)}
                        className="block w-full h-8 border border-gray-300 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-primary-500 focus:border-primary-500 transition-all"
                      >
                        <option value="">--:--</option>
                        {horariosDisponiveis.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Término</label>
                      <select
                        value={importHorarioFim}
                        onChange={e => setImportHorarioFim(e.target.value)}
                        className="block w-full h-8 border border-gray-300 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-primary-500 focus:border-primary-500 transition-all"
                      >
                        <option value="">--:--</option>
                        {horariosDisponiveis.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {importResults && (
                <div className="p-3 bg-gray-50 rounded-md">
                  <div className="text-sm">Sucesso: {importResults.successes} | Falhas: {importResults.failures.length}</div>
                  {importResults.failures.length > 0 && (
                    <div className="mt-1 text-xs text-red-600">
                      {importResults.failures.map(f => <div key={f.name}>{f.name}: {f.reason}</div>)}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t mt-2">
                <button
                  type="button"
                  onClick={() => { setShowImportModal(false); setImportText(''); setImportResults(null); }}
                  className="px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 flex items-center gap-1.5"
                >
                  <i className="fas fa-times text-gray-600" aria-hidden="true" /> Cancelar
                </button>
                <button
                  type="button"
                  disabled={importing || !importProfessorId || !importHorarioInicio || !importHorarioFim || importEntries.filter(e=>e.selected).length===0}
                  onClick={handleImportClick}
                  className="px-3 py-1.5 border border-transparent rounded-md shadow-sm text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {importing ? (
                    <>
                      <i className="fas fa-spinner fa-spin" aria-hidden="true" />
                      Importando...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-file-import" aria-hidden="true" />
                      Importar ({importEntries.filter(e=>e.selected).length})
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: adicionar um aluno individualmente (search/create) */}
      {showAddSingleAlunoModal && addAlunoTurma && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-600 bg-opacity-50 p-4">
          <div className="relative w-full max-w-lg mx-auto bg-white rounded-2xl shadow-lg border border-gray-200 p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
            {/* Header + Info */}
            <div className="mb-4 border-b pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <i className="fas fa-user-plus text-primary-600 text-lg" aria-hidden="true" />
                  <h3 className="text-base font-semibold text-gray-900">Adicionar Aluno</h3>
                </div>
                <button
                  type="button"
                  onClick={() => { setShowAddSingleAlunoModal(false); setSingleAlunoSearch(''); setSingleAlunoSelectedId(null); setSingleAlunoName(''); setSingleAlunoObservacoes(''); }}
                  className="text-gray-400 hover:text-gray-600 focus:outline-none"
                  title="Fechar"
                >
                  <i className="fas fa-times text-lg" aria-hidden="true" />
                </button>
              </div>
              <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                <i className="fas fa-info-circle text-primary-600" aria-hidden="true" />
                <span>Turma: {professores.find(p => p._id === addAlunoTurma.professorId)?.nome || 'Professor'} • {diasSemana[addAlunoTurma.diaSemana || 0]} {addAlunoTurma.horarioInicio}-{addAlunoTurma.horarioFim}</span>
              </div>
            </div>
            
            <div className="space-y-4">
              {/* Pesquisar aluno */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pesquisar aluno existente</label>
                <input
                  value={singleAlunoSearch}
                  onChange={(e) => { setSingleAlunoSearch(String(e.target.value || '')); setSingleAlunoSelectedId(null); }}
                  placeholder="Digite o nome do aluno..."
                  className="block w-full h-10 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 transition-all"
                />
                {singleAlunoSearch && (
                  <div className="mt-2 max-h-40 overflow-y-auto border rounded-lg bg-white">
                    {(alunos || []).filter(a => String(a.nome || '').toLowerCase().includes(singleAlunoSearch.toLowerCase())).slice(0,10).map(a => (
                      <div 
                        key={a._id} 
                        className={`p-3 border-b last:border-b-0 cursor-pointer transition-colors ${singleAlunoSelectedId === a._id ? 'bg-primary-50 border-primary-200' : 'hover:bg-gray-50'}`} 
                        onClick={() => { setSingleAlunoSelectedId(a._id); setSingleAlunoName(a.nome); }}
                      >
                        <div className="text-sm font-medium">{a.nome}</div>
                        {a.email && <div className="text-xs text-gray-500">{a.email}</div>}
                      </div>
                    ))}
                    {(alunos || []).filter(a => String(a.nome || '').toLowerCase().includes(singleAlunoSearch.toLowerCase())).length === 0 && (
                      <div className="p-3 text-xs text-gray-500 text-center">
                        <i className="fas fa-search text-gray-300 mb-1"></i>
                        <p>Nenhum aluno encontrado</p>
                      </div>
                    )}
                  </div>
                )}
                {singleAlunoSelectedId && (
                  <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                    <i className="fas fa-check-circle text-green-600"></i>
                    <span className="text-sm text-green-800 font-medium">{singleAlunoName}</span>
                  </div>
                )}
              </div>

              {/* Observações */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observações (opcional)</label>
                <textarea 
                  placeholder="Ex.: Problema no joelho" 
                  value={singleAlunoObservacoes} 
                  onChange={(e) => setSingleAlunoObservacoes(String(e.target.value || ''))} 
                  rows={2}
                  className="block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 transition-all" 
                />
              </div>

              {/* Botão para adicionar em lote */}
              {permissoesHorarios.importarLote() && (
              <button
                type="button"
                onClick={() => { 
                  setShowAddSingleAlunoModal(false); 
                  setBulkAlunoTextAdd(''); 
                  setBulkImportEntries([]);
                  setShowAddAlunoModal(true); 
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:border-primary-400 hover:text-primary-600 hover:bg-primary-50 transition-all"
              >
                <i className="fas fa-users" aria-hidden="true" />
                Adicionar vários alunos de uma vez
              </button>
              )}

              {/* Botões de ação */}
              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => { setShowAddSingleAlunoModal(false); setSingleAlunoSearch(''); setSingleAlunoSelectedId(null); setSingleAlunoName(''); setSingleAlunoObservacoes(''); }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    // Prevent double-click
                    if (loading) return;
                    
                    try {
                      setLoading(true);
                      // Require an existing aluno to be selected
                      if (!singleAlunoSelectedId) { toast.warning('Selecione um aluno existente antes de prosseguir.'); setLoading(false); return; }
                      const alunoId = singleAlunoSelectedId as string;

                      // Prefer creating a Matricula on existing HorarioFixo. If none exists, create HorarioFixo then Matricula.
                      const existing = horarios.find(h => {
                        try {
                          const rawProf = (h as any).professorId;
                          const profId = rawProf && (rawProf._id || rawProf) ? String(rawProf._id || rawProf) : undefined;
                          return profId === String(addAlunoTurma.professorId) && h.diaSemana === addAlunoTurma.diaSemana && h.horarioInicio === addAlunoTurma.horarioInicio && h.horarioFim === addAlunoTurma.horarioFim;
                        } catch (e) { return false; }
                      });

                      let horarioData: any = null;
                      if (existing && existing._id) {
                        const matResp = await fetch('/api/matriculas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ horarioFixoId: existing._id, alunoId, observacoes: singleAlunoObservacoes || '' }) });
                        horarioData = await matResp.json();
                        } else {
                        const createPayload: any = { professorId: String(addAlunoTurma.professorId || ''), diaSemana: addAlunoTurma.diaSemana, horarioInicio: addAlunoTurma.horarioInicio, horarioFim: addAlunoTurma.horarioFim, observacoes: '', modalidadeId: modalidadeSelecionada || undefined };
                        if (!createPayload.professorId) { toast.warning('Selecione um professor antes de criar a turma'); setLoading(false); return; }
                        const createResp = await fetch('/api/horarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(createPayload) });
                        const created = await createResp.json();
                        if (created && created.success && created.data && created.data._id) {
                          const matResp = await fetch('/api/matriculas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ horarioFixoId: created.data._id, alunoId, observacoes: singleAlunoObservacoes || '' }) });
                          horarioData = await matResp.json();
                        } else {
                          horarioData = { success: false, error: created && created.error ? created.error : 'Falha ao criar horario' };
                        }
                      }
                      if (!horarioData || !horarioData.success) throw new Error(horarioData && horarioData.error ? horarioData.error : 'Erro ao adicionar horário');

                      // cleanup and refresh
                      setShowAddSingleAlunoModal(false);
                      setSingleAlunoSearch(''); setSingleAlunoSelectedId(null); setSingleAlunoName(''); setSingleAlunoObservacoes('');
                      await fetchHorarios();
                    } catch (err:any) {
                      toast.error('Erro: ' + (err.message || 'erro'));
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 transition-colors flex items-center gap-2 ${(!singleAlunoSelectedId || loading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                  disabled={!singleAlunoSelectedId || loading}
                >
                  {loading ? (
                    <>
                      <i className="fas fa-spinner fa-spin" /> Salvando...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-check" aria-hidden="true" /> Adicionar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Student detail modal (cleaned up) */}
      {showStudentDetailModal && selectedStudentHorario && (
        <StudentDetailModal 
          isOpen={showStudentDetailModal} 
          onClose={() => setShowStudentDetailModal(false)} 
          horario={selectedStudentHorario} 
          modalidades={modalidades} 
          horarios={[]} 
          onRefresh={fetchHorarios} 
        />
      )}

      {/* Modal de detalhes do aluno (linha da tabela como em /alunos) */}
      {showAlunoRowModal && alunoRowModalId && (
        <AlunoRowModal
          isOpen={showAlunoRowModal}
          onClose={() => { setShowAlunoRowModal(false); setAlunoRowModalId(null); }}
          alunoId={alunoRowModalId}
          onRefresh={fetchHorarios}
        />
      )}

      {/* Modal para montar grade do professor em lote */}
      {showGradeProfessorModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-lg border border-gray-200 max-h-[90vh] overflow-y-auto" role="dialog" aria-modal="true">
            <div className="px-5 py-4 border-b">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <i className="fas fa-th text-primary-600 text-lg" aria-hidden="true"></i>
                      <h3 className="text-base font-semibold text-gray-900">Montar Grade do Professor</h3>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      <i className="fas fa-info-circle text-primary-600 mr-1"></i>
                      Selecione o professor e clique nos horários para marcar os dias em que ele dá aula. Depois clique em &quot;Aplicar&quot; para criar todos os horários de uma vez.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => { setShowGradeProfessorModal(false); setGradeProfessorId(''); setGradeSlotsSelected(new Set()); }}
                  className="p-2 rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-800 transition-colors"
                  title="Fechar"
                >
                  <i className="fas fa-times" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="p-5">
              {/* Seleção do professor */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Professor</label>
                <div className="flex flex-wrap gap-2">
                  {professores.map((professor) => {
                    const pid = String((professor as any)._id || (professor as any).id || '');
                    const selected = gradeProfessorId === pid;
                    const professorCor = (professor as any).cor || '#3B82F6';
                    return (
                      <button
                        key={pid}
                        type="button"
                        onClick={() => setGradeProfessorId(pid)}
                        style={{
                          backgroundColor: selected ? professorCor : 'white',
                          borderColor: selected ? professorCor : '#E5E7EB',
                          color: selected ? 'white' : '#374151'
                        }}
                        className={`px-3 py-1.5 text-sm rounded-full border-2 transition-all ${selected ? 'ring-offset-1' : 'hover:border-gray-400'}`}
                      >
                        {professor.nome}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Grade reduzida */}
              {gradeProfessorId && (
                <div className="border rounded-md overflow-hidden">
                  <div className="overflow-auto max-h-[50vh]">
                    <table className="w-full table-fixed text-sm border-collapse">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-2 py-2 text-center text-xs font-bold text-gray-700 uppercase w-20 border-r border-gray-200">
                            Horário
                          </th>
                          {visibleDays.filter(d => d > 0).map((dayIndex) => (
                            <th key={dayIndex} className="px-2 py-2 text-center text-xs font-bold text-gray-700 uppercase border-r border-gray-200">
                              {diasSemana[dayIndex]?.substring(0, 3)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {visibleTimes.map((horarioSlot) => (
                          <tr key={horarioSlot}>
                            <td className="px-2 py-1 text-center text-xs font-medium text-gray-700 bg-gray-50 border-r border-b border-gray-200">
                              {horarioSlot}
                            </td>
                            {visibleDays.filter(d => d > 0).map((dayIndex) => {
                              const slotKey = `${horarioSlot}-${dayIndex}`;
                              const isSelected = gradeSlotsSelected.has(slotKey);
                              const professorCor = professores.find(p => String((p as any)._id || '') === gradeProfessorId)?.cor || '#3B82F6';
                              
                              // Check if there's already a turma in this slot
                              const turmasNoSlot = getTurmasForSlot(horarioSlot, dayIndex);
                              const hasTurma = turmasNoSlot && turmasNoSlot.length > 0;
                              const alunosCount = hasTurma ? turmasNoSlot.reduce((acc: number, t: any) => {
                                const alunos = t.alunos || [];
                                if (alunos.length === 1 && Array.isArray(alunos[0]?.matriculas)) {
                                  return acc + alunos[0].matriculas.length;
                                }
                                return acc + alunos.length;
                              }, 0) : 0;
                              
                              return (
                                <td
                                  key={dayIndex}
                                  onClick={() => {
                                    setGradeSlotsSelected(prev => {
                                      const next = new Set(prev);
                                      if (next.has(slotKey)) {
                                        next.delete(slotKey);
                                      } else {
                                        next.add(slotKey);
                                      }
                                      return next;
                                    });
                                  }}
                                  className={`px-2 py-2 text-center border-r border-b border-gray-200 cursor-pointer transition-all ${isSelected ? 'text-white' : hasTurma ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-gray-100'}`}
                                  style={{ backgroundColor: isSelected ? professorCor : undefined }}
                                  title={hasTurma ? `${alunosCount} aluno(s) neste horário` : 'Horário vago'}
                                >
                                  {isSelected ? (
                                    <i className="fas fa-check text-xs" aria-hidden="true" />
                                  ) : hasTurma ? (
                                    <span className="text-amber-600 text-xs font-medium">{alunosCount}</span>
                                  ) : null}
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

              {/* Resumo e ações */}
              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  {gradeSlotsSelected.size > 0 ? (
                    <span><strong>{gradeSlotsSelected.size}</strong> horário(s) selecionado(s)</span>
                  ) : (
                    <span className="text-gray-400">Clique nos horários para selecionar</span>
                  )}
                </div>
                <div className="flex gap-2">
                  {gradeSlotsSelected.size > 0 && (
                    <button
                      type="button"
                      onClick={() => setGradeSlotsSelected(new Set())}
                      className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                    >
                      Limpar seleção
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="px-5 py-4 border-t bg-gray-50 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setShowGradeProfessorModal(false); setGradeProfessorId(''); setGradeSlotsSelected(new Set()); }}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={gradeLoading || !gradeProfessorId || gradeSlotsSelected.size === 0}
                onClick={async () => {
                  // Prevent double-click
                  if (gradeLoading) return;
                  if (!gradeProfessorId || gradeSlotsSelected.size === 0) return;
                  
                  setGradeLoading(true);
                  let successes = 0;
                  let failures = 0;
                  
                  const step = getCurrentStep();
                  
                  // Criar um horário para CADA slot selecionado (não agrupar consecutivos)
                  for (const slotKey of gradeSlotsSelected) {
                    const [horario, dia] = slotKey.split('-');
                    const dayNum = parseInt(dia);
                    
                    const horarioInicio = horario;
                    const horarioFimMinutes = timeToMinutes(horario) + step;
                    const horarioFim = `${String(Math.floor(horarioFimMinutes / 60)).padStart(2, '0')}:${String(horarioFimMinutes % 60).padStart(2, '0')}`;
                    
                    try {
                      const payload = {
                        professorId: gradeProfessorId,
                        diaSemana: dayNum,
                        horarioInicio,
                        horarioFim,
                        modalidadeId: modalidadeSelecionada || undefined
                      };
                      
                      const resp = await fetch('/api/horarios', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                      });
                      
                      const data = await resp.json();
                      if (data && data.success) {
                        successes++;
                      } else {
                        // Se o erro for "já existe turma", considerar como sucesso (turma já criada)
                        if (data && data.error && data.error.includes('Já existe uma turma')) {
                          // Turma já existe, não contar como falha
                        } else {
                          failures++;
                        }
                      }
                    } catch (err) {
                      failures++;
                    }
                  }
                  
                  setGradeLoading(false);
                  await fetchHorarios();
                  
                  if (failures === 0) {
                    setShowGradeProfessorModal(false);
                    setGradeProfessorId('');
                    setGradeSlotsSelected(new Set());
                    if (successes > 0) {
                      toast.success(`${successes} horário${successes !== 1 ? 's' : ''} criado${successes !== 1 ? 's' : ''} com sucesso!`);
                    } else {
                      toast.info('Todos os horários já existiam');
                    }
                  } else {
                    toast.warning(`Criados: ${successes}. Falhas: ${failures}`);
                  }
                }}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {gradeLoading ? (
                  <>
                    <i className="fas fa-spinner fa-spin" aria-hidden="true" />
                    Criando...
                  </>
                ) : (
                  <>
                    <i className="fas fa-check" aria-hidden="true" />
                    Aplicar ({gradeSlotsSelected.size})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      </ProtectedPage>
    </>
  );
}