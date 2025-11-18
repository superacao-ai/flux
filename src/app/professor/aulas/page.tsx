'use client';

import Layout from '@/components/Layout';
import RequireAuth from '@/components/RequireAuth';
import { useEffect, useState } from 'react';

interface AulaRealizada {
  _id: string;
  data: string;
  modalidade: string;
  status?: 'pendente' | 'enviada' | 'corrigida';
  professorId?: string | { _id: string; nome?: string };
  professorNome?: string;
  horarioFixoId?: string;
  total_presentes?: number;
  total_faltas?: number;
}

export default function ProfessorAulasPage() {
  const [aulas, setAulas] = useState<AulaRealizada[]>([]);
  const [pendentesDetalhados, setPendentesDetalhados] = useState<Array<{data: string; horario: string; modalidade: string; professor: string; horarioFixoId?: string}>>([]);
  const [horariosState, setHorariosState] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // pagination
  const ITENS_POR_PAGINA = 8;
  const [paginaEnviadas, setPaginaEnviadas] = useState(1);
  const [paginaPendentes, setPaginaPendentes] = useState(1);

  // fetchAulas foi extraída para ser reutilizável e permitir revalidação quando
  // a aba voltar ao foco (por exemplo: após enviar uma aula em MinhaAgenda).
  const fetchAulas = async () => {
    try {
      setLoading(true);
      setError('');

      const token = localStorage.getItem('token');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await fetch('/api/aulas-realizadas?listarTodas=true', { headers });
      if (!res.ok) {
        let bodyText = '';
        try { bodyText = await res.text(); } catch (e) { /* ignore */ }
        console.error('API /api/aulas-realizadas?listarTodas=true returned', res.status, bodyText);

        const all = await fetch('/api/aulas-realizadas', { headers });
        if (!all.ok) {
          let allText = '';
          try { allText = await all.text(); } catch (e) {}
          console.error('Fallback /api/aulas-realizadas returned', all.status, allText);
          throw new Error('Erro ao buscar aulas');
        }
        const dataAll = await all.json();
        setAulas(Array.isArray(dataAll) ? dataAll : (dataAll.data || []));
        return;
      }

      const data = await res.json();
      const lista = Array.isArray(data) ? data : (data.data || []);

      // DEBUG: log first few aulas to inspect raw date values and parsing behavior
      try {
        if (Array.isArray(lista) && lista.length > 0) {
          console.log('[ProfessorAulas] amostra de aulas (raw):', lista.slice(0, 5).map((a: any) => ({ _id: a._id, data: a.data })));
          const sample = lista.slice(0, 5).map((a: any) => {
            const raw = a.data;
            const dateOnly = (typeof raw === 'string' && raw.split('T')[0]) || (raw instanceof Date ? raw.toISOString().split('T')[0] : String(raw || ''));
            const parts = String(dateOnly || '').split('-');
            const y = Number(parts[0]);
            const m = Number(parts[1]) - 1;
            const d = Number(parts[2]);
            return { _id: a._id, raw, dateOnly, localDate: isNaN(y) ? null : new Date(y, m, d).toString() };
          });
          console.log('[ProfessorAulas] amostra parsed:', sample);
        }
      } catch (e) {
        console.warn('[ProfessorAulas] falha ao logar amostra de aulas', e);
      }

      // Resolver id do professor logado.
      let myProfessorId: string | null = null;
      let userIdFromStorage: string | null = null;
      let userEmailFromStorage: string | null = null;
      try {
        const rawUser = localStorage.getItem('user');
        if (rawUser) {
          const parsed = JSON.parse(rawUser);
          userIdFromStorage = parsed?.id || parsed?._id || parsed?.userId || null;
          userEmailFromStorage = parsed?.email || null;
        }
      } catch (e) {
        // ignore
      }

      if (userEmailFromStorage) {
        try {
          const profRes = await fetch('/api/professores', { headers });
          if (profRes.ok) {
            const profData = await profRes.json();
            const profList = Array.isArray(profData) ? profData : (profData.data || []);
            const found = profList.find((p: any) => String(p.email || '').toLowerCase() === String(userEmailFromStorage).toLowerCase());
            if (found) myProfessorId = found._id || found.id || null;
          }
        } catch (e) {
          console.warn('Não foi possível buscar /api/professores para resolver professorId por email', e);
        }
      }

      if (myProfessorId) {
        const filtrado = (lista || []).filter((a: any) => {
          const pid = typeof a.professorId === 'string' ? a.professorId : (a.professorId?._id || String(a.professorId || ''));
          return String(pid) === String(myProfessorId);
        });
        setAulas(filtrado || []);
        return;
      }

      if (userIdFromStorage) {
        const filtrado = (lista || []).filter((a: any) => {
          return String(a.enviadoPor || '') === String(userIdFromStorage);
        });
        if (filtrado.length > 0) {
          setAulas(filtrado || []);
          return;
        }
      }

      console.warn('Não foi possível determinar o professor logado (por email ou userId). Exibindo todas as aulas como fallback.');
      setAulas(lista || []);
    } catch (err) {
      console.error('Erro ao buscar aulas do professor:', err);
      setError('Erro ao carregar aulas. Verifique a conexão.');
    } finally {
      setLoading(false);
    }
  };

  // Buscar aulas inicialmente
  useEffect(() => { fetchAulas(); }, []);

  // Revalidar quando a aba voltar ao foco (por exemplo: após enviar aula em outra rota)
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') fetchAulas();
    };
    const onFocus = () => fetchAulas();

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  // Depois de carregar aulas, buscar horários do professor e gerar pendentes
  useEffect(() => {
    const buildPendentes = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

        // Buscar horários do professor autenticado
        const resHor = await fetch('/api/me/horarios', { headers });
        if (!resHor.ok) {
          // se não conseguir, limpa pendentes
          setPendentesDetalhados([]);
          return;
        }

        const horData = await resHor.json();
        const horarios: any[] = Array.isArray(horData) ? horData : (horData.data || []);

        // guardar horários em state para uso na renderização (detectar dia da semana correto)
        setHorariosState(horarios || []);

        if (!horarios || horarios.length === 0) {
          setPendentesDetalhados([]);
          return;
        }

        // Filtrar apenas horários ativos quando possível
        const horariosAtivos = (horarios || []).filter(h => h.ativo !== false);

        // Helpers para lidar com datas sem problemas de timezone: usar datas locais
        const pad = (n: number) => n.toString().padStart(2, '0');
        const formatLocalDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        const parseDateOnly = (s: string) => {
          // aceita 'YYYY-MM-DD' or full ISO with T
          const parts = (s || '').split('T')[0].split('-');
          if (parts.length === 3) return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
          return new Date(s);
        };

        // Map de aulas realizadas por chave horarioId_data (usar parte da data sem converter para UTC)
        const aulasMap = new Map<string, boolean>();
        (aulas || []).forEach(a => {
          const dStr = (a.data || '').split('T')[0] || '';
          const key = `${a.horarioFixoId || ''}_${dStr}`;
          aulasMap.set(key, true);
        });

        // intervalo de busca (últimos 30 dias)
        const hoje = new Date();
        hoje.setHours(0,0,0,0);
        const inicioDate = new Date(hoje);
        inicioDate.setDate(hoje.getDate() - 30);

        const pendentesAcc: Array<{data: string; horario: string; modalidade: string; professor: string; horarioFixoId?: string}> = [];

        const addedKeys = new Set<string>();
        for (const hOrig of horariosAtivos) {
          const h = hOrig || {};
          // garantir que haja um identificador de horário fixo
          const horarioId = h._id || h.horarioFixoId;
          if (!horarioId) continue;
          // Normalizar dia da semana (aceita 0-6 ou 1-7). Construir conjunto de candidatos
          const raw = Number(h.diaSemana);
          const candidateDays = new Set<number>();
          if (!isNaN(raw)) {
            if (raw >= 0 && raw <= 6) candidateDays.add(raw);
            if (raw >= 1 && raw <= 7) candidateDays.add(raw % 7); // map 7->0
          }
          // Fallback: se não veio número válido, tentar usar 0 (domingo)
          if (candidateDays.size === 0) candidateDays.add(0);

          // iterar por cada dia no intervalo e coletar os que batem com qualquer candidato
          for (let cur = new Date(inicioDate); cur <= hoje; cur.setDate(cur.getDate() + 1)) {
            if (candidateDays.has(cur.getDay())) {
              const dateStr = formatLocalDate(new Date(cur));
              // somente datas anteriores a hoje
              if (dateStr < formatLocalDate(hoje)) {
                const key = `${horarioId}_${dateStr}`;
                if (!aulasMap.has(key) && !addedKeys.has(key)) {
                  // montar texto de horário de forma previsível
                  const horarioStr = h.horario || (h.horarioInicio && h.horarioFim ? `${h.horarioInicio} - ${h.horarioFim}` : (h.horarioInicio || h.horarioFim) || 'Não informado');
                  pendentesAcc.push({
                    data: dateStr,
                    horario: horarioStr,
                    modalidade: (h.modalidade && h.modalidade.nome) || (h.modalidadeId && h.modalidadeId.nome) || 'Não informada',
                    professor: (h.professor && h.professor.nome) || (h.professorNome) || '',
                    horarioFixoId: horarioId
                  });
                  addedKeys.add(key);
                }
              }
            }
          }
        }

        // Ordenar por data asc, e dentro da mesma data por horário de início
        function extractStartTime(horarioText: string) {
          if (!horarioText) return '00:00';
          // tentar extrair padrão HH:MM no início
          const m = horarioText.match(/(\d{1,2}:\d{2})/);
          return m ? m[1].padStart(5, '0') : '00:00';
        }

        pendentesAcc.sort((a,b) => {
          const dateCmp = a.data.localeCompare(b.data);
          if (dateCmp !== 0) return dateCmp;
          const ta = extractStartTime(a.horario || '');
          const tb = extractStartTime(b.horario || '');
          return ta.localeCompare(tb);
        });
        setPendentesDetalhados(pendentesAcc);
      } catch (err) {
        console.error('Erro ao construir pendentes:', err);
        setPendentesDetalhados([]);
      }
    };

    buildPendentes();
  }, [aulas]);

  const enviadas = aulas.filter(a => a.status && a.status !== 'pendente');
  // pendentesDetalhados será preenchido após buscarmos os horários do professor
  const pendentes = pendentesDetalhados;

  const weekdayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

  // Formata a data de uma aula (prefere usar o dia da semana do horário fixo quando disponível)
  const formatAulaDate = (aula: any) => {
    try {
      // Extract a YYYY-MM-DD date regardless of how `aula.data` is represented
      const rawVal = aula?.data;
      let dateOnly = '';

      if (rawVal instanceof Date) {
        dateOnly = rawVal.toISOString().slice(0, 10);
      } else if (typeof rawVal === 'string') {
        const m = rawVal.match(/^(\d{4}-\d{2}-\d{2})/);
        if (m) dateOnly = m[1];
        else {
          const parsed = new Date(rawVal);
          if (!isNaN(parsed.getTime())) dateOnly = parsed.toISOString().slice(0, 10);
        }
      } else if (rawVal) {
        const parsed = new Date(rawVal);
        if (!isNaN(parsed.getTime())) dateOnly = parsed.toISOString().slice(0, 10);
      }

      if (!dateOnly) return String(aula?.data || '');

      const parts = dateOnly.split('-');
      if (parts.length !== 3) return String(aula?.data || '');

      const y = Number(parts[0]);
      const m = Number(parts[1]) - 1;
      const day = Number(parts[2]);

      if ([y, m, day].some(v => isNaN(v))) return String(aula?.data || '');

      // Try to find the horario to determine weekday; otherwise compute from UTC date
      const horarioId = aula?.horarioFixoId || aula?.horarioFixo || aula?.horario?._id;
      let weekdayLabel = null as string | null;
      if (horarioId && horariosState && horariosState.length > 0) {
        const found = horariosState.find((h: any) => String(h._id) === String(horarioId) || String(h.horarioFixoId) === String(horarioId));
        if (found && (found.diaSemana !== undefined && found.diaSemana !== null)) {
          const ds = Number(found.diaSemana) % 7;
          if (!isNaN(ds)) weekdayLabel = weekdayNames[ds];
        }
      }

      const pad = (n: number) => n.toString().padStart(2, '0');
      const dateDisplay = `${pad(day)}/${pad(m + 1)}/${y}`;
      // Use local date to compute weekday to avoid UTC shift (which caused dates to appear one day off)
      const computedWeekday = weekdayLabel ?? weekdayNames[new Date(y, m, day).getDay()];
      return `${dateDisplay} • ${computedWeekday}`;
    } catch (e) {
      return String(aula?.data || '');
    }
  };

  return (
    <RequireAuth showLoginRedirect={true}>
      <Layout title="Minhas Aulas - Professor">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-6 fade-in-1">
            <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-3">
              <i className="fas fa-chalkboard-teacher text-primary-600"></i>
              Minhas Aulas
            </h1>
            <p className="text-gray-600 mt-1">Visão geral das suas aulas: enviadas e pendentes</p>
          </div>

          {/* summary cards removed per UX request - counts shown in section titles */}

          {error ? (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700">{error}</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 fade-in-2">
              {/* Enviadas */}
              <div className="bg-white rounded-md shadow-sm border border-gray-200 p-4 fade-in-3">
                <h2 className="text-sm font-semibold text-gray-900 mb-4">
                  <i className="fas fa-paper-plane text-primary-600 mr-2"></i>
                  Aulas Enviadas ({enviadas.length})
                </h2>
                {enviadas.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">Nenhuma aula enviada</div>
                ) : (
                  <div className="space-y-3">
                    {(() => {
                      const inicio = (paginaEnviadas - 1) * ITENS_POR_PAGINA;
                      return enviadas.slice(inicio, inicio + ITENS_POR_PAGINA).map(aula => (
                        <button
                          key={aula._id}
                          onClick={() => {
                            try {
                              const params = new URLSearchParams();
                              const dateParam = String(aula.data || '');
                              params.set('date', dateParam.includes('T') ? dateParam : `${dateParam}T00:00:00`);
                              if (aula.horarioFixoId) params.set('horarioFixoId', String(aula.horarioFixoId));
                              window.location.href = `/professor/minhaagenda?${params.toString()}`;
                            } catch (e) {
                              window.location.href = `/professor/minhaagenda`;
                            }
                          }}
                          className="w-full text-left flex items-center justify-between gap-3 p-3 rounded-lg border shadow-sm hover:shadow-md transition"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-gray-900">{formatAulaDate(aula)}</div>
                            <div className="text-xs text-gray-500 mt-1 truncate">{aula.modalidade || '—'}</div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-center">
                              <div className="text-lg font-bold text-green-600">{aula.total_presentes ?? 0}</div>
                              <div className="text-xs text-gray-500">Presentes</div>
                            </div>
                            <div className="text-center">
                              <div className="text-lg font-bold text-red-600">{aula.total_faltas ?? 0}</div>
                              <div className="text-xs text-gray-500">Faltas</div>
                            </div>
                          </div>
                        </button>
                      ));
                    })()}

                    {enviadas.length > ITENS_POR_PAGINA && (
                      <div className="mt-2 flex items-center justify-between">
                        <div className="text-sm text-gray-600">Página {paginaEnviadas} de {Math.ceil(enviadas.length / ITENS_POR_PAGINA)}</div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setPaginaEnviadas(1)} disabled={paginaEnviadas === 1} className="px-2 py-1 border rounded">«</button>
                          <button onClick={() => setPaginaEnviadas(p => Math.max(1, p - 1))} disabled={paginaEnviadas === 1} className="px-2 py-1 border rounded">‹</button>
                          <button onClick={() => setPaginaEnviadas(p => Math.min(Math.ceil(enviadas.length / ITENS_POR_PAGINA), p + 1))} disabled={paginaEnviadas === Math.ceil(enviadas.length / ITENS_POR_PAGINA)} className="px-2 py-1 border rounded">›</button>
                          <button onClick={() => setPaginaEnviadas(Math.ceil(enviadas.length / ITENS_POR_PAGINA))} disabled={paginaEnviadas === Math.ceil(enviadas.length / ITENS_POR_PAGINA)} className="px-2 py-1 border rounded">»</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Pendentes */}
              <div className="bg-white rounded-md shadow-sm border border-gray-200 p-4 fade-in-3">
                <h2 className="text-sm font-semibold text-gray-900 mb-4">
                  <i className="fas fa-clock text-yellow-600 mr-2"></i>
                  Aulas Pendentes ({pendentes.length})
                </h2>
                {pendentes.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">Nenhuma aula pendente</div>
                ) : (
                  <div className="space-y-3">
                    {(() => {
                      const inicio = (paginaPendentes - 1) * ITENS_POR_PAGINA;
                      return pendentes.slice(inicio, inicio + ITENS_POR_PAGINA).map((aula) => {
                        const key = `${aula.horarioFixoId || ''}_${aula.data}_${aula.horario || ''}_${aula.modalidade || ''}`;
                        return (
                          <button
                            key={key}
                            onClick={() => {
                              try {
                                const params = new URLSearchParams();
                                // Append local midnight to avoid browser parsing 'YYYY-MM-DD' as UTC
                                // which can shift the date to the previous day in negative timezones.
                                const dateParam = String(aula.data || '');
                                params.set('date', dateParam.includes('T') ? dateParam : `${dateParam}T00:00:00`);
                                if (aula.horarioFixoId) params.set('horarioFixoId', String(aula.horarioFixoId));
                                window.location.href = `/professor/minhaagenda?${params.toString()}`;
                              } catch (e) {
                                window.location.href = `/professor/minhaagenda`;
                              }
                            }}
                            className="w-full text-left flex items-center justify-between gap-3 p-3 rounded-lg border shadow-sm hover:shadow-md transition"
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-gray-900">{formatAulaDate(aula)}</div>
                              <div className="text-xs text-gray-500 mt-1 truncate">{aula.modalidade || '—'}</div>
                            </div>

                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <div className="text-sm font-medium text-gray-600">{aula.horario || '—'}</div>
                                <div className="text-xs text-gray-400">Toque para preencher</div>
                              </div>
                            </div>
                          </button>
                        );
                      });
                    })()}

                    {pendentes.length > ITENS_POR_PAGINA && (
                      <div className="mt-2 flex items-center justify-between">
                        <div className="text-sm text-gray-600">Página {paginaPendentes} de {Math.ceil(pendentes.length / ITENS_POR_PAGINA)}</div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setPaginaPendentes(1)} disabled={paginaPendentes === 1} className="px-2 py-1 border rounded">«</button>
                          <button onClick={() => setPaginaPendentes(p => Math.max(1, p - 1))} disabled={paginaPendentes === 1} className="px-2 py-1 border rounded">‹</button>
                          <button onClick={() => setPaginaPendentes(p => Math.min(Math.ceil(pendentes.length / ITENS_POR_PAGINA), p + 1))} disabled={paginaPendentes === Math.ceil(pendentes.length / ITENS_POR_PAGINA)} className="px-2 py-1 border rounded">›</button>
                          <button onClick={() => setPaginaPendentes(Math.ceil(pendentes.length / ITENS_POR_PAGINA))} disabled={paginaPendentes === Math.ceil(pendentes.length / ITENS_POR_PAGINA)} className="px-2 py-1 border rounded">»</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Layout>
    </RequireAuth>
  );
}
