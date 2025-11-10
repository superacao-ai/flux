"use client";

import React, { useEffect, useState, useMemo } from 'react';

type Horario = {
  _id: string;
  diaSemana: number;
  horarioInicio: string;
  horarioFim: string;
  professorId?: { _id?: string; nome?: string } | string;
  alunoId?: { 
    _id?: string; 
    nome?: string;
    modalidadeId?: { _id?: string; nome?: string; cor?: string } | string;
  } | Array<any> | null;
  modalidadeId?: { _id?: string; nome?: string; cor?: string } | string;
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
        console.error('[ProfessorAgenda] Erro:', e);
        setError(e?.message || 'Erro desconhecido');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="p-6">Carregando agenda...</div>;
  if (error) return <div className="p-6 text-red-600">Erro: {error}</div>;

  if (horarios.length === 0) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <h3 className="text-yellow-800 font-semibold mb-2">Nenhum horário encontrado</h3>
          <p className="text-yellow-700 text-sm">
            Não foram encontrados horários fixos para este professor. 
            Verifique se:
          </p>
          <ul className="list-disc list-inside text-yellow-700 text-sm mt-2 space-y-1">
            <li>O professor está cadastrado no sistema</li>
            <li>O email do login coincide com o email do cadastro do professor</li>
            <li>Existem horários fixos atribuídos a este professor</li>
          </ul>
        </div>
      </div>
    );
  }

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

        {entries.map((g) => {
          // Não filtrar mais - mostrar todos os horários, mesmo sem alunos
          const validItems = g.items || [];
          const sample = validItems[0] || g.items[0];
          const key = g.key;
          
          // Pegar modalidade do primeiro horário
          const getModalidade = (h: Horario) => {
            // Tentar pegar da modalidade do aluno primeiro
            if (h.alunoId && !Array.isArray(h.alunoId) && typeof h.alunoId === 'object') {
              const modalidade = h.alunoId.modalidadeId;
              if (modalidade && typeof modalidade === 'object') {
                return { nome: modalidade.nome || 'Modalidade', cor: modalidade.cor || '#3B82F6' };
              }
            }
            // Senão, tentar pegar do horário fixo
            if (h.modalidadeId && typeof h.modalidadeId === 'object') {
              return { nome: h.modalidadeId.nome || 'Modalidade', cor: h.modalidadeId.cor || '#3B82F6' };
            }
            return { nome: 'Modalidade não definida', cor: '#6B7280' };
          };
          
          const modalidade = getModalidade(sample);
          const totalAlunos = validItems.reduce((acc, h) => {
            const alunos = Array.isArray(h.alunoId) ? h.alunoId : (h.alunoId ? [h.alunoId] : []);
            return acc + alunos.length;
          }, 0);
          
          return (
            <div key={key} className="bg-white rounded-lg shadow-sm border-l-4 p-4" style={{ borderLeftColor: modalidade.cor }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="text-lg font-semibold text-gray-900">{sample.horarioInicio} — {sample.horarioFim}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span 
                        className="inline-block px-3 py-1 rounded-md text-white text-sm font-medium"
                        style={{ backgroundColor: modalidade.cor }}
                      >
                        {modalidade.nome}
                      </span>
                      <span className="text-sm text-gray-500">
                        {totalAlunos} {totalAlunos === 1 ? 'aluno' : 'alunos'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => toggleOpenKey(key, g.items)} className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors text-sm font-medium">
                    <i className="fas fa-check mr-2"></i>
                    Registrar Presença
                  </button>
                </div>
              </div>
                <div className="space-y-2">
                {totalAlunos === 0 ? (
                  <div className="p-3 bg-gray-50 rounded-md text-center">
                    <i className="fas fa-users text-gray-300 text-2xl mb-2"></i>
                    <p className="text-sm text-gray-500">Nenhum aluno matriculado neste horário</p>
                  </div>
                ) : (
                  validItems.map((h) => (
                    <div key={h._id} className="p-3 bg-gray-50 rounded-md">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm" style={{ backgroundColor: modalidade.cor }}>
                            {(() => {
                              const alunos = Array.isArray(h.alunoId) ? h.alunoId : (h.alunoId ? [h.alunoId] : []);
                              if (alunos.length === 0) return '?';
                              const first = alunos[0];
                              const nome = typeof first === 'string' ? first : (first?.nome || first?.email || '?');
                              return nome.charAt(0).toUpperCase();
                            })()}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {(() => {
                                const alunos = Array.isArray(h.alunoId) ? h.alunoId : (h.alunoId ? [h.alunoId] : []);
                                if (alunos.length === 0) return <span className="text-gray-400">Sem aluno</span>;
                                const safeName = (a: any) => (a && (a.nome || a.email || a.telefone) ? (a.nome || a.email || a.telefone) : '—');
                                if (alunos.length === 1) return safeName(alunos[0]);
                                const names = alunos.slice(0, 2).map((a: any) => safeName(a));
                                return `${names.join(', ')}${alunos.length > 2 ? ` +${alunos.length - 2}` : ''}`;
                              })()}
                            </div>
                            <div className="flex items-center gap-2 text-xs mt-1">
                              {h.congelado && <span className="px-2 py-0.5 bg-sky-100 text-sky-700 rounded-md border border-sky-200">
                                <i className="fas fa-snowflake mr-1"></i>Congelado
                              </span>}
                              {h.ausente && <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded-md border border-rose-200">
                                <i className="fas fa-user-clock mr-1"></i>Parou de Vir
                              </span>}
                              {h.emEspera && <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-md border border-amber-200">
                                <i className="fas fa-hourglass-half mr-1"></i>Em Espera
                              </span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {openKey === key && (
                <div className="mt-4 border-t pt-4">
                  <div className="mb-3 text-sm font-semibold text-gray-900">Marcar presenças para esta aula</div>
                  <div className="space-y-2">
                    {validItems.flatMap(h => (Array.isArray(h.alunoId) ? h.alunoId : (h.alunoId ? [h.alunoId] : []))).map((a: any) => {
                      const aid = typeof a === 'string' ? a : (a._id || '');
                      const mapKey = `${key}::${aid}`;
                      const display = typeof a === 'string' ? a : (a && (a.nome || a.email || a.telefone) ? (a.nome || a.email || a.telefone) : '—');
                      return (
                        <label key={aid || display} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-md cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={!!attendanceMap[mapKey]} 
                            onChange={(e) => setAttendanceMap(prev => ({ ...prev, [mapKey]: e.target.checked }))}
                            className="w-4 h-4 text-primary-600 rounded"
                          />
                          <span className="text-sm font-medium">{display}</span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button 
                      disabled={submitting} 
                      onClick={() => submitAttendance(key, g.items)} 
                      className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                      {submitting ? 'Salvando...' : 'Salvar Presenças'}
                    </button>
                    <button 
                      disabled={submitting} 
                      onClick={() => setOpenKey(null)} 
                      className="px-4 py-2 rounded-md border border-gray-300 hover:bg-gray-50 transition-colors font-medium"
                    >
                      Cancelar
                    </button>
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
