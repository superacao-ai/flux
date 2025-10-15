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
    modalidadeId: ''
  });
  const [loading, setLoading] = useState(false);
  const [bulkAlunoText, setBulkAlunoText] = useState('');
  const [showAddAlunoModal, setShowAddAlunoModal] = useState(false);
  const [novoHorarioAlunosText, setNovoHorarioAlunosText] = useState('');
  const [addAlunoTurma, setAddAlunoTurma] = useState<{professorId?: string, diaSemana?: number, horarioInicio?: string, horarioFim?: string} | null>(null);
  const [bulkAlunoTextAdd, setBulkAlunoTextAdd] = useState('');
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
  const [mounted, setMounted] = useState(false);
  // Confirmation dialog state for handling similar-aluno decisions
  const pendingAlunoResolve = useRef<((res: {action: 'use'|'create'|'skip'|'choose', alunoId?: string}) => void) | null>(null);
  const [confirmAlunoDialog, setConfirmAlunoDialog] = useState<null | { name: string; candidates: Array<{ aluno: Aluno; score: number }> }>(null);
  const getMid = (m: Modalidade) => (m && ((m as any).id || (m as any)._id)) || '';
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
      }
    } catch (error) {
      console.error('Erro ao buscar horários:', error);
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
    setSelectedHorarioId(rep._id || null);
    setFormData({
      alunoId: '',
      professorId: typeof rep.professorId === 'string' ? rep.professorId : (rep.professorId?._id || ''),
      diaSemana: rep.diaSemana,
      horarioInicio: rep.horarioInicio,
      horarioFim: rep.horarioFim,
      observacoes: rep.observacoes || '',
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
        // Update entire turma via turma endpoint
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
          observacoes: formData.observacoes
        };

        const response = await fetch('/api/horarios/turma', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (data.success) {
          // Sucesso silencioso: fechar modal, resetar modo e recarregar lista
          setShowModal(false);
          setEditingMode('create');
          setEditingMemberIds(null);
          setFormData({ alunoId: '', professorId: '', diaSemana: 1, horarioInicio: '', horarioFim: '', observacoes: '', modalidadeId: '' });
          fetchHorarios();
        } else {
          alert('Erro: ' + data.error);
        }
      } else {
        // If the optional textarea has content, create alunos and horarios per line
        const lines = String(novoHorarioAlunosText || '').split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length > 0) {
          const failures: Array<{name:string, reason:string}> = [];
          let successes = 0;
          for (const name of lines) {
            // find exact by normalized name
            const nomeNorm = String(name || '').trim().toUpperCase();
            let aluno = alunos.find(a => String(a.nome || '').trim().toUpperCase() === nomeNorm);
            if (!aluno) {
              // similarity check
              const best = findBestAlunoMatch(name);
              if (best.aluno && best.score >= 0.8) {
                const decision = await askAlunoConfirmation(name, [{ aluno: best.aluno, score: best.score }]);
                if (decision.action === 'use' && decision.alunoId) {
                  const found = alunos.find(a => a._id === decision.alunoId);
                  if (found) aluno = found;
                } else if (decision.action === 'create') {
                  // continue to create new below
                } else if (decision.action === 'skip') {
                  failures.push({ name, reason: 'Pulado pelo usuário' });
                  continue;
                }
              }
            }

            if (!aluno) {
              try {
                const alunoPayload: any = { nome: String(name || '').trim().toUpperCase() };
                if (modalidadeSelecionada) alunoPayload.modalidadeId = modalidadeSelecionada;
                const alunoResp = await fetch('/api/alunos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(alunoPayload) });
                const alunoData = await alunoResp.json();
                if (alunoData.success) {
                  aluno = alunoData.data as Aluno;
                  setAlunos(prev => [...prev, aluno as Aluno]);
                } else {
                  failures.push({name, reason: 'Falha ao criar aluno: ' + (alunoData.error || 'erro')});
                  continue;
                }
              } catch (err:any) {
                failures.push({name, reason: 'Erro ao criar aluno: ' + (err.message || 'erro')});
                continue;
              }
            }

            // create horario for this aluno
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
                  observacoes: formData.observacoes || ''
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
          setNovoHorarioAlunosText('');
          setFormData({ alunoId: '', professorId: '', diaSemana: 1, horarioInicio: '', horarioFim: '', observacoes: '', modalidadeId: '' });
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

  // Open modal to edit an entire turma (preserve all aluno entries)
  const handleEditTurma = (representativeHorario: HorarioFixo, turmaMembers: HorarioFixo[]) => {
    setEditingMode('turma');
    setEditingMemberIds(turmaMembers.map(m => m._id));
    setFormData({
      alunoId: '', // not editing a single aluno
      professorId: representativeHorario.professorId._id,
      diaSemana: representativeHorario.diaSemana,
      horarioInicio: representativeHorario.horarioInicio,
      horarioFim: representativeHorario.horarioFim,
      observacoes: representativeHorario.observacoes || '',
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
          alunos: []
        };
        grade[key].push(turma);
      }
      turma.alunos.push(horario);
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
        if (!groups[key]) groups[key] = { professorId: professorIdStr, professorNome: (h as any).professorId?.nome || '', horarioFim: h.horarioFim, alunos: [] };
        groups[key].alunos.push(h);
      });
      return Object.values(groups);
    } catch (e) {
      return grade[`${horarioSlot}-${diaIndex}`] || [];
    }
  };

  // Compute rowSpan map and skip cells so we render a single <td> that spans multiple rows
  const { startRowSpanMap, skipCellsSet } = useMemo(() => {
    const startRowSpanMap = new Map<string, number>();
    const skipCellsSet = new Set<string>();
    try {
      horariosFiltrados.forEach(h => {
        const day = (h as any).diaSemana;
        const startIdx = horariosDisponiveis.indexOf((h as any).horarioInicio);
        const endIdx = horariosDisponiveis.indexOf((h as any).horarioFim);
        if (startIdx === -1 || endIdx === -1) return;
        const span = Math.max(1, endIdx - startIdx);
        const startKey = `${horariosDisponiveis[startIdx]}-${day}`;
        const prev = startRowSpanMap.get(startKey) || 1;
        startRowSpanMap.set(startKey, Math.max(prev, span));
        for (let i = startIdx + 1; i < endIdx; i++) {
          skipCellsSet.add(`${horariosDisponiveis[i]}-${day}`);
        }
      });
    } catch (e) {
      // ignore
    }
    return { startRowSpanMap, skipCellsSet };
  }, [horariosFiltrados, horariosDisponiveis]);

  // Handler moved out of JSX to avoid large inline blocks and JSX parse issues
  const handleImportClick = async () => {
    // iniciar importação
    setImporting(true);
    const lines = importText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    const failures: Array<{name:string, reason:string}> = [];
    let successes = 0;
    for (const name of lines) {
      // procurar aluno pelo nome (exato ou case-insensitive)
      const aluno = alunos.find(a => a.nome.toLowerCase() === name.toLowerCase());
      let resolvedAluno = aluno;
      if (!resolvedAluno) {
        // Try similarity-based match first
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

        // criar aluno automaticamente se não quisermos usar existente
        if (!resolvedAluno) {
          try {
            const alunoPayload: any = { nome: String(name || '').trim().toUpperCase() };
            if (importModalidadeId) alunoPayload.modalidadeId = importModalidadeId;
            // Only include optional fields when they have meaningful values
            // (avoid sending empty strings which could collide with unique indexes)
            const alunoResp = await fetch('/api/alunos', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(alunoPayload)
            });
            const alunoData = await alunoResp.json();
            if (alunoData.success) {
              const created = alunoData.data as Aluno | undefined;
              if (created) {
                resolvedAluno = created;
                // atualizar lista local de alunos
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
      }
      try {
        if (!resolvedAluno) {
          failures.push({name, reason: 'Aluno não resolvido'});
          continue;
        }
        const resp = await fetch('/api/horarios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            alunoId: (resolvedAluno as Aluno)._id,
            professorId: importProfessorId,
            diaSemana: importDiaSemana,
            horarioInicio: importHorarioInicio,
            horarioFim: importHorarioFim,
            observacoes: 'Importado em lote'
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
    setImportResults({successes, failures});
    setImporting(false);
    fetchHorarios();
  };

  return (
    <>
      {showModalLote.open && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Adicionar Alunos em Lote</h3>
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
                const text = String(e.target.value || '');
                // Normalize each line: trim and uppercase
                const normalized = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0).map(l => l.toUpperCase()).join('\n');
                // Keep the textarea content in normalized form but allow empty input
                setBulkAlunoTextAdd(normalized);
              }}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              rows={8}
              placeholder={`Ex:\nJOÃO SILVA\nMARIA SOUZA\n...`}
            />
            <div className="mt-4 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => { setShowAddAlunoModal(false); setBulkAlunoTextAdd(''); setAddAlunoTurma(null); }}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >Cancelar</button>
              <button
                type="button"
                onClick={async () => {
                  // processar linhas
                  const lines = bulkAlunoTextAdd.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
                  const failures: Array<{name:string, reason:string}> = [];
                  let successes = 0;
                  for (const name of lines) {
                    // procurar aluno localmente
                    const aluno = alunos.find(a => a.nome.toLowerCase() === name.toLowerCase());
                    let resolvedAluno = aluno;
                    if (!resolvedAluno) {
                      // criar aluno automaticamente com modalidade selecionada globalmente
                      try {
                        const alunoPayload: any = { nome: String(name || '').trim().toUpperCase() };
                        if (modalidadeSelecionada) alunoPayload.modalidadeId = modalidadeSelecionada;
                        const alunoResp = await fetch('/api/alunos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(alunoPayload) });
                        const alunoData = await alunoResp.json();
                        if (alunoData.success) {
                          resolvedAluno = alunoData.data as Aluno;
                          const createdAluno = resolvedAluno as Aluno;
                          setAlunos(prev => [...prev, createdAluno]);
                        } else {
                          failures.push({name, reason: 'Falha ao criar aluno: ' + (alunoData.error || 'erro')});
                          continue;
                        }
                      } catch (err:any) {
                        failures.push({name, reason: 'Erro ao criar aluno: ' + (err.message || 'erro')});
                        continue;
                      }
                    }
                    // criar horario para o aluno
                    try {
                      const resp = await fetch('/api/horarios', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          alunoId: (resolvedAluno as Aluno)._id,
                          professorId: addAlunoTurma.professorId,
                          diaSemana: addAlunoTurma.diaSemana,
                          horarioInicio: addAlunoTurma.horarioInicio,
                          horarioFim: addAlunoTurma.horarioFim,
                          observacoes: 'Adicionado em lote'
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
                  setShowAddAlunoModal(false);
                  setBulkAlunoTextAdd('');
                  setAddAlunoTurma(null);
                  await fetchHorarios();
                  alert(`Adicionados: ${successes}. Falhas: ${failures.length}` + (failures.length>0 ? '\n' + failures.map(f=> `${f.name}: ${f.reason}`).join('\n') : ''));
                }}
                className="px-4 py-2 bg-primary-600 text-white rounded-md disabled:opacity-50"
              >Adicionar</button>
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

        {/* Seletor de Modalidade (buttons) */}
        <div className="mb-6 bg-white p-4 rounded-lg shadow border border-gray-200">
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium text-gray-700">Modalidade:</label>
            <div className="flex flex-wrap gap-2">
              {(modalidades || []).map((modalidade, idx) => {
                const mid = (modalidade as any).id || (modalidade as any)._id || '';
                return (
                  <button
                    key={(modalidade as any).id ?? (modalidade as any)._id ?? idx}
                    type="button"
                    onClick={() => setModalidadeSelecionada(mid)}
                    className={`px-3 py-1 text-sm rounded border ${modalidadeSelecionada === mid ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200'}`}
                  >
                    {modalidade.nome}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Grade de horários */}
        {/* Only render the heavy schedule after hydration on client to avoid SSR/CSR mismatch */}
        {mounted && (
          <div className="shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
            {/* Horário de funcionamento removido da UI por decisão do produto; a lógica de filtragem por openTime/closeTime permanece. */}
            <div className="overflow-auto max-h-[75vh]">{/* table scrolls internally */}
              <table className="w-full table-fixed divide-y divide-gray-300 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="sticky top-0 px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-20 bg-gray-50">
                  Horário
                </th>
                {diasSemana.map((dia) => (
                  <th
                    key={dia}
                    scope="col"
                    className="sticky top-0 px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[64px] bg-gray-50"
                  >
                    {dia}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {horariosDisponiveis.map((horarioSlot) => (
                <tr key={horarioSlot}>
                  <td className="px-2 py-2 whitespace-nowrap text-sm font-medium text-gray-900 bg-gray-50 w-20">
                    {horarioSlot}
                  </td>
                  {diasSemana.map((_, index) => {
                    const key = `${horarioSlot}-${index}`;
                    // If this cell is covered by a rowspan from a previous slot, don't render a td here
                    if (skipCellsSet.has(key)) return null;
                    const turmas = getTurmasForSlot(horarioSlot, index); // Array de turmas neste slot (covers multi-slot turmas)
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
                        const dayAllowed = Array.isArray(mod.diasSemana) && mod.diasSemana.length > 0 ? (mod.diasSemana.includes(index)) : true;

                        if (!dayAllowed) {
                          isOpen = false;
                        } else if (Array.isArray(mod.horariosDisponiveis) && mod.horariosDisponiveis.length > 0) {
                          // If modalidade has explicit horariosDisponiveis, use them (they include diasSemana + horaInicio/horaFim)
                          const match = mod.horariosDisponiveis.some((hd: any) => {
                            const hdDays = Array.isArray(hd.diasSemana) && hd.diasSemana.length > 0 ? hd.diasSemana : [index];
                            if (!hdDays.includes(index)) return false;
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
                          // If there are existing turmas in this cell, open edit modal for the first turma
                          if (turmas && turmas.length > 0) {
                            try {
                              openEditTurmaGroup(turmas[0]);
                            } catch (e) {
                              // fallback to create modal if something unexpected
                            }
                            return;
                          }
                          // Open the create-new-horario modal prefilled for this slot
                          const idx = horariosDisponiveis.indexOf(horarioSlot);
                          const horarioFimDefault = idx >= 0 && idx < horariosDisponiveis.length - 1 ? horariosDisponiveis[idx + 1] : horarioSlot;
                          setEditingMode('create');
                          setFormData({
                            alunoId: '',
                            professorId: '',
                            diaSemana: index,
                            horarioInicio: horarioSlot,
                            horarioFim: horarioFimDefault,
                            observacoes: '',
                            modalidadeId: modalidadeSelecionada || ''
                          });
                          setSelectedHorarioId(null);
                          setEditingMemberIds([]);
                          setShowModal(true);
                        }}
                        className={`px-3 py-2 text-sm text-gray-500 align-middle ${isOpen ? (anyExceeded ? 'bg-red-50 text-red-700' : 'cursor-pointer hover:bg-gray-100 hover:shadow-sm') : 'bg-red-50 text-red-700 cursor-not-allowed'} transition-colors rounded`}
                      >
                        {isOpen ? (
                          // open interval: show turmas or 'TURMA VAGA'
                          (turmas && turmas.length > 0) ? (
                            <div className="flex flex-col items-center justify-center space-y-2">
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
                                const turmaClass = `${exceeded ? 'bg-red-100 text-red-800 border border-red-300' : 'bg-primary-100 text-primary-800'} px-2 py-1 rounded text-xs mb-1`;
                                return (
                                  <div key={turma.professorId + turma.horarioFim} className={turmaClass}>
                                    <div className="font-medium text-center mb-1">👨‍🏫 {turma.professorNome}</div>
                                    <div className="text-center text-xs text-gray-600 mb-2">
                                      <div className={`${exceeded ? 'text-red-700 font-semibold' : 'text-gray-600'}`}>{count}{capacity ? `/${capacity}` : ''} {count === 1 ? 'aluno' : 'alunos'}</div>
                                      {exceeded && <div className="text-xs text-red-600 font-medium mt-1">⚠️ Lotado</div>}
                                    </div>
                                    <div className="space-y-1 max-h-24 overflow-y-auto">
                                      {visibleAlunos.map((horario: any) => (
                                        <div key={horario._id} className="flex items-center justify-between bg-white bg-opacity-60 px-1 py-0.5 rounded text-xs">
                                          <span className="font-medium">👤 {horario.alunoId?.nome}</span>
                                          <button onClick={(e) => { e.stopPropagation(); deleteHorario(horario._id); }} className="text-red-500 hover:text-red-700 ml-1" title="Remover aluno da turma">✕</button>
                                        </div>
                                      ))}
                                    </div>
                                    {/* Botões de ação da turma */}
                                    <div className="mt-1 flex items-center justify-center gap-2">
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setAddAlunoTurma({ professorId: turma.professorId, diaSemana: index, horarioInicio: horarioSlot, horarioFim: turma.horarioFim }); setShowAddAlunoModal(true); }}
                                        title="Adicionar aluno"
                                        className="p-1 w-8 h-8 flex items-center justify-center text-primary-600 hover:text-primary-700 rounded"
                                      >
                                        <span className="sr-only">Adicionar aluno</span>
                                        <i className="fas fa-plus" aria-hidden="true" />
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
                          ) : (
                            <div className="h-full w-full flex items-center justify-center min-h-[100px]">
                              <span className="text-green-700 font-bold text-sm">TURMA VAGA</span>
                            </div>
                          )
                        ) : (
                          // blocked slot for this modalidade/day/time
                          <div className="h-full w-full flex items-center justify-center text-xs font-semibold text-red-700 bg-red-50 rounded py-3">INDISPONÍVEL</div>
                        )}
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

        {/* Lista de horários em formato de lista (render only after client mount to avoid hydration mismatch) */}
        {mounted && (
          <div className="mt-8 bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Horários Cadastrados ({horariosFiltrados.length})
              </h3>
              <div className="space-y-3">
                {horariosFiltrados.map((horario) => (
                  <div key={horario._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">
                        {horario.alunoId?.nome} - {diasSemana[horario.diaSemana]}
                      </div>
                      <div className="text-sm text-gray-500">
                        {horario.horarioInicio} às {horario.horarioFim} com {horario.professorId?.nome}
                      </div>
                      {horario.observacoes && (
                        <div className="text-xs text-gray-400 mt-1">{horario.observacoes}</div>
                      )}
                    </div>
                    <button
                      onClick={() => deleteHorario(horario._id)}
                      className="ml-4 text-red-500 hover:text-red-700 text-sm"
                    >
                      Excluir
                    </button>
                  </div>
                ))}
                {horariosFiltrados.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    {modalidadeSelecionada 
                      ? `Nenhum horário cadastrado para ${modalidades.find(m => getMid(m) === modalidadeSelecionada)?.nome || 'esta modalidade'}.`
                      : 'Nenhum horário cadastrado ainda.'
                    }
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Legenda */}
        <div className="mt-6 bg-gray-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-gray-900 mb-2">Legenda:</h3>
          <div className="flex flex-wrap gap-4 text-xs">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-primary-100 rounded mr-2"></div>
              <span>Horário Regular</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-100 rounded mr-2"></div>
              <span>Reagendado</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-yellow-100 rounded mr-2"></div>
              <span>Pendente</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-red-100 rounded mr-2"></div>
              <span>Falta</span>
            </div>
          </div>
        </div>

      </div>

      {/* Modal para cadastrar novo horário */}
      {/* Modal de confirmação quando encontra aluno similar */}
      {confirmAlunoDialog && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full" style={{ zIndex: 9999 }}>
          <div className="relative top-24 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Confirmação de Aluno Similar</h3>
              <p className="text-sm text-gray-700 mb-3">O nome "{confirmAlunoDialog.name}" parece corresponder a um aluno já cadastrado. O que deseja fazer?</p>
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
                {editingMode === 'turma' ? 'Editar Turma' : editingMode === 'single' ? 'Editar Horário' : 'Cadastrar Novo Horário'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  {editingMode === 'turma' ? (
                    <p className="text-sm text-gray-600">Editando a turma selecionada. As alterações serão aplicadas a todos os alunos dessa turma.</p>
                  ) : editingMode === 'single' ? (
                    <p className="text-sm text-gray-600">Editando o horário selecionado.</p>
                  ) : (
                    <p className="text-sm text-gray-600">Crie um novo horário (turma). Após criar, use o botão + Aluno na célula para adicionar alunos a essa turma.</p>
                  )}
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
                  <select
                    value={formData.diaSemana}
                    onChange={(e) => setFormData({...formData, diaSemana: parseInt(e.target.value)})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    required
                  >
                    {diasSemana.map((dia, index) => (
                      <option key={index} value={index}>
                        {dia}
                      </option>
                    ))}
                  </select>
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
                      {horariosDisponiveis.map((horario) => (
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
                      {horariosDisponiveis.map((horario) => (
                        <option key={horario} value={horario}>
                          {horario}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

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

                {/* Optional textarea to create students when creating the horario */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Adicionar alunos (opcional)</label>
                  <p className="text-xs text-gray-500 mb-1">Cole nomes, uma por linha. Se preenchido, o sistema criará alunos (ou sugerirá correspondências) e adicionará cada um a este horário.</p>
                  <textarea
                    value={novoHorarioAlunosText}
                    onChange={(e) => setNovoHorarioAlunosText(String(e.target.value || ''))}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    rows={4}
                    placeholder={`Ex:\nJOÃO SILVA\nMARIA SOUZA\n...`}
                  />
                </div>

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
                  rows={10}
                  placeholder={`Ex:\nJoão Silva\nMaria Souza\n...`}
                />
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
                disabled={importing || !importProfessorId || !importHorarioInicio || !importHorarioFim}
                onClick={handleImportClick}
                className="px-4 py-2 bg-primary-600 text-white rounded-md disabled:opacity-50"
              >{importing ? 'Importando...' : 'Importar'}</button>
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
      </Layout>
    </>
  );
}