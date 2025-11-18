'use client';

import React, { useEffect, useState, useMemo } from 'react';
import RequireAuth from '@/components/RequireAuth';
import Layout from '@/components/Layout';

interface Aluno {
  _id: string;
  nome: string;
  email?: string;
  telefone?: string;
  modalidades?: Array<{
    _id: string;
    nome: string;
    cor?: string;
  }>;
  observacoes?: string;
  periodoTreino?: string | null;
  congelado?: boolean;
  ausente?: boolean;
  emEspera?: boolean;
  parceria?: string | null;
}

interface HorarioFixo {
  _id: string;
  diaSemana: number;
  horarioInicio: string;
  horarioFim: string;
  ativo: boolean;
  alunos?: Aluno[];
  modalidadeId?: {
    _id: string;
    nome: string;
    cor: string;
  };
}

interface AlunoComAulas {
  aluno: Aluno;
  aulas: HorarioFixo[];
}

export default function ProfessorAlunosPage() {
  const [horarios, setHorarios] = useState<HorarioFixo[]>([]);
  const [fullAlunosMap, setFullAlunosMap] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    // moved to top-level function fetchHorarios for reuse
    fetchHorarios();
  }, []);

  // Extracted function so we can revalidate on visibility/storage events
  async function fetchHorarios() {
    try {
      setLoading(true);
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

      const res = await fetch('/api/me/horarios', {
        headers: { Authorization: token ? `Bearer ${token}` : '' }
      });

      if (!res.ok) throw new Error('Erro ao buscar horários');

      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.data || []);

      const active = list.filter((h: HorarioFixo) => h.ativo);
      setHorarios(active);

      // Fetch full aluno records to enrich the minimal aluno objects coming from horarios
      try {
        const resAlunos = await fetch('/api/alunos', { headers: { Authorization: token ? `Bearer ${token}` : '' } });
        if (resAlunos.ok) {
          const ad = await resAlunos.json();
          const alunosList = Array.isArray(ad) ? ad : (ad.data || []);
          const map: Record<string, any> = {};
          alunosList.forEach((a: any) => {
            const id = a._id || a.id;
            if (id) map[id] = a;
          });
          setFullAlunosMap(map);
        }
      } catch (e) {
        // non-fatal: if we can't fetch full alunos, the view will still show whatever came from horarios
        console.warn('Não foi possível buscar alunos completos:', e);
      }
    } catch (err: any) {
      console.error('Erro ao buscar horários:', err);
      setError(err.message || 'Erro ao carregar alunos');
    } finally {
      setLoading(false);
    }
  }

  // Revalidate when the tab becomes visible again or when other pages signal updates via localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onVisibility = () => {
      if (document.visibilityState === 'visible') fetchHorarios();
    };

    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      // convention: other pages set 'alunosUpdated' or 'horariosUpdated' to signal changes
      if (e.key === 'alunosUpdated' || e.key === 'horariosUpdated') {
        try { fetchHorarios(); } catch (err) { /* ignore */ }
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('storage', onStorage as any);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('storage', onStorage as any);
    };
  }, []);

  const alunosComAulas = useMemo(() => {
    const mapa = new Map<string, AlunoComAulas>();

    horarios.forEach(horario => {
      if (horario.alunos && Array.isArray(horario.alunos)) {
        horario.alunos.forEach(aluno => {
          const chave = aluno._id;

          // Merge with full aluno record if available
          const full = (fullAlunosMap && chave && fullAlunosMap[chave]) ? fullAlunosMap[chave] : {};
          const mergedAluno = { ...aluno, ...full } as Aluno;

          if (!mapa.has(chave)) {
            mapa.set(chave, {
              aluno: mergedAluno,
              aulas: []
            });
          }

          mapa.get(chave)!.aulas.push(horario);
        });
      }
    });

    return Array.from(mapa.values());
  }, [horarios, fullAlunosMap]);

  const alunosFiltrados = useMemo(() => {
    if (!query.trim()) return alunosComAulas;

    const q = query.toLowerCase();
    return alunosComAulas.filter(item =>
      item.aluno.nome.toLowerCase().includes(q) ||
      (item.aluno.email || '').toLowerCase().includes(q) ||
      (item.aluno.telefone || '').toLowerCase().includes(q)
    );
  }, [alunosComAulas, query]);

  const diasAbrev = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  // NOTE: removed blocking loading spinner so the alunos page renders immediately.
  // The `loading` state is still tracked internally but no longer blocks rendering.

  if (error) {
    return (
      <RequireAuth showLoginRedirect={false}>
        <Layout title="Meus Alunos - Superação Flux">
          <div className="p-6 max-w-6xl mx-auto">
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex items-center gap-2 text-red-800">
                <i className="fas fa-exclamation-circle"></i>
                <span className="font-semibold">Erro ao carregar alunos</span>
              </div>
              <p className="text-red-600 mt-2">{error}</p>
            </div>
          </div>
        </Layout>
      </RequireAuth>
    );
  }

  return (
    <RequireAuth showLoginRedirect={false}>
      <Layout title="Meus Alunos - Superação Flux">
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
          <div className="max-w-6xl mx-auto">
            <div className="mb-8 fade-in-1 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">
                  <i className="fas fa-users mr-3 text-primary-600"></i>
                  Meus Alunos
                </h1>
              </div>
           
            </div>

            <div className="mb-6 fade-in-2">
              <div className="relative">
                <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Pesquisar por nome, email ou telefone..."
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((n) => (
                <div key={n} className="rounded-md shadow-sm border border-gray-200 overflow-hidden bg-white p-4 animate-pulse">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gray-200" />
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
                      <div className="h-3 bg-gray-200 rounded w-1/2" />
                    </div>
                    <div className="w-12 h-6 bg-gray-200 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : alunosFiltrados.length === 0 ? (
            <div className="bg-white rounded-md shadow-sm border border-gray-200 p-12 text-center flex flex-col items-center justify-center">
              <div className="flex items-center justify-center w-full mb-4">
                <i className="fas fa-inbox text-gray-300 text-4xl"></i>
              </div>
              <p className="text-gray-600 font-medium">
                {query.trim() ? 'Nenhum aluno encontrado' : 'Você ainda não tem alunos'}
              </p>
              {query.trim() && (
                <p className="text-gray-500 text-sm mt-1">Tente pesquisar com outros termos</p>
              )}
            </div>
          ) : (
            <div className="space-y-4 fade-in-3">
              {alunosFiltrados.map((item) => (
                <div
                  key={item.aluno._id}
                  className={`${item.aluno.congelado ? 'bg-gray-100 text-gray-500 filter grayscale' : 'bg-white'} rounded-md shadow-sm border border-gray-200 overflow-hidden fade-in-${Math.min((alunosFiltrados.indexOf(item) % 8) + 1, 8)}`}
                >
                  <div className="p-4 border-b border-gray-100">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                        {item.aluno.nome.charAt(0).toUpperCase()}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-gray-900 truncate">
                          {item.aluno.nome}
                        </h3>

                        {/* resumo compacto removido per request: modality+horário */}

                        <div className="flex items-center gap-4 mt-1 flex-wrap">
                          {item.aluno.email && (
                            <div className="flex items-center gap-1 text-sm text-gray-600">
                              <i className="fas fa-envelope text-gray-400"></i>
                              <span className="truncate">{item.aluno.email}</span>
                            </div>
                          )}
                          {item.aluno.telefone && (
                            <div className="flex items-center gap-1 text-sm text-gray-600">
                              <i className="fas fa-phone text-gray-400"></i>
                              <span>{item.aluno.telefone}</span>
                            </div>
                          )}
                        </div>

                        {(() => {
                          // Only render modality badges when the student actually has aulas.
                          // Derive modalidades from the student's horários instead of relying
                          // on the possibly stale `aluno.modalidades` field. This ensures that
                          // when a horário is deleted the modality badge disappears.
                          if (!Array.isArray(item.aulas) || item.aulas.length === 0) return null;
                          const map = new Map<string, { _id: string; nome: string; cor?: string }>();
                          try {
                            for (const h of item.aulas) {
                              const m: any = (h as any).modalidadeId;
                              if (!m) continue;
                              const id = (m && (m._id || m.id)) ? String(m._id || m.id) : String(m);
                              if (!id) continue;
                              if (!map.has(id)) map.set(id, { _id: id, nome: (m.nome || String(m)), cor: m.cor });
                            }
                          } catch (e) {
                            // ignore and render nothing
                          }
                          const derived = Array.from(map.values());
                          if (!derived || derived.length === 0) return null;
                          return (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {derived.map((mod) => (
                                <span
                                  key={mod._id}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium"
                                  style={{
                                    backgroundColor: mod.cor ? `${mod.cor}20` : '#f3f4f6',
                                    color: mod.cor || '#6b7280'
                                  }}
                                >
                                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: mod.cor || '#9ca3af' }}></span>
                                  {mod.nome}
                                </span>
                              ))}
                            </div>
                          );
                        })()}
                        {/* Student characteristics: frozen/absent/periodoTreino/observations */}
                        <div className="flex flex-wrap gap-2 mt-2">
                          {item.aluno.periodoTreino && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                              <i className="fas fa-calendar-alt text-xs text-gray-500"></i>
                              <span>{item.aluno.periodoTreino}</span>
                            </span>
                          )}

                          {item.aluno.parceria && String(item.aluno.parceria).toLowerCase() === 'totalpass' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700">
                              <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAC1UlEQVR4AbyWg5LlQBiFY3uSu7Zt27Zt27Zt27Zt60G2tC8w/3aWk/qvkkGqzuU53V+7qSwPQ6S5rttM07Sptm3PJZqXQ5pLypwci8UakjoUIpoo8HDE1EgQhC/kcyYR5IZoms6UJOmtaZo1/zT418OSypuwLPsDh3JHpK7vlmXV+NsTBmn5N2zMXZGeeEneZcpxnLYpA7k0HGS+1aZUVZ336wdZAGNNHzDX9wupvmCs6gVsASs0hKIooykyO5f6X4RaxcH7sCya3i4BRpdDAxiGMeUfgDqyWWQA+9Q4VHhoAHP74MgA2uyO2QfQF3cDi0D8077hcStzzk0M+nYMBnNtX1CHN/0lZWhjUAY1DEjuXgv4qkWA5piEAHitFs2IC8CVzR/0kcnnvU+vpzKuTgOhXqn0AKTO1VEB7qN5QLNM0Neharghe70Y+IoFUwPoS7qhsLllIPbN7xx6zpgb+qUAoClwLk1BQWVwIwTgnJ8UGiDj1ozkAIyrxx1XvnLhoM9WwXu3NDzAvdnJAcRWlVDIfbYAaJ4N+pqVj7ZvHB6VHECb1QGFrF1DAPmmtY0EoI5qlhyA7Gw4NLIpIN/R0aErdx/P84cuMQCjS+C9WYKCfM3iwdNMFcF7HfClFpkvYpvKyfcBoWEZTP1yEdASDwFfnZLhWv5wLogtK6beCdUJrVDY2j8Cdb86tgWu6D2R33u+Xi8G98l8sMiEU4Y1AcZU/FxqAOvACFSwOr4lClt7h+FDaU4nv6d+S+CAommUSwkgtqgIcrdaWYUuG37h7vOFCIAs3+inYRjxVYrE7X7G0/MGgGzJ+Ji+MtXfwvMGwNw8AAHoy7pHu5Coqjo3bNDfKX8OvXHKZqlCVqN0wJvlA98xAQImYNfMBthd+kDnrpkBcieVBRgVVsCQOEPrzinQjqPQfiETAzKACnCLioragbrSwFAppSYGmpkF7J5bQoId4XMA6lRclYDTIrUAAAAASUVORK5CYII=" alt="TOTALPASS" className="w-3 h-3" />
                              <span>TOTALPASS</span>
                            </span>
                          )}

                          {item.aluno.congelado && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-50 text-gray-500">
                              <i className="fas fa-snowflake text-xs text-gray-400"></i>
                              <span>Congelado</span>
                            </span>
                          )}

                          {item.aluno.ausente && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">
                              <i className="fas fa-user-slash text-xs text-red-500"></i>
                              <span>Ausente</span>
                            </span>
                          )}

                          {item.aluno.emEspera && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700">
                              <i className="fas fa-clock text-xs text-yellow-600"></i>
                              <span>Em espera</span>
                            </span>
                          )}
                        </div>

                        {item.aluno.observacoes && (
                          <div className="text-xs text-gray-500 mt-2 italic truncate">{item.aluno.observacoes}</div>
                        )}
                      </div>

                      {item.aulas && item.aulas.length > 0 ? (
                        <div className="text-right flex-shrink-0">
                          <div className="text-2xl font-bold text-primary-600">
                            {item.aulas.length}
                          </div>
                          <div className="text-xs text-gray-600 font-medium">
                            {item.aulas.length === 1 ? 'Aula' : 'Aulas'}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {item.aulas && item.aulas.length > 0 ? (
                    <div className="p-4 bg-gray-50">
                      <div className="text-xs font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                        Horários
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {item.aulas
                          .sort((a, b) => a.diaSemana - b.diaSemana || a.horarioInicio.localeCompare(b.horarioInicio))
                          .map((aula) => (
                            <div
                              key={aula._id}
                              className="bg-white rounded-md p-3 border border-gray-200 flex items-start gap-3"
                            >
                              <div
                                className="w-1 h-12 rounded-full flex-shrink-0"
                                style={{ backgroundColor: aula.modalidadeId?.cor || '#d1d5db' }}
                              ></div>

                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-gray-900 text-sm">
                                  {diasAbrev[aula.diaSemana]}
                                </div>
                                <div className="text-xs text-gray-600 mt-0.5">
                                  {aula.horarioInicio} – {aula.horarioFim}
                                </div>
                                {aula.modalidadeId && (
                                  <div className="text-xs font-medium text-gray-700 mt-1">
                                    {aula.modalidadeId.nome}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      </Layout>
    </RequireAuth>
  );
}
