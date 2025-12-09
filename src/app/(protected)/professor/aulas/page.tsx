  "use client";

  import ProtectedPage from '@/components/ProtectedPage';
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
    const [aulasEnviadas, setAulasEnviadas] = useState<any[]>([]);
    const [aulasPendentes, setAulasPendentes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [paginaPendentes, setPaginaPendentes] = useState(1);
    const [paginaEnviadas, setPaginaEnviadas] = useState(1);
    const AULAS_POR_PAGINA = 8;

    // Buscar aulas do professor
    const fetchAulas = async () => {
      setLoading(true);
      setError('');
      try {
        const token = localStorage.getItem('token');
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
        // Buscar todas as aulas enviadas
        const resEnviadas = await fetch('/api/aulas-realizadas?listarTodas=true', { headers });
        const dataEnviadas = await resEnviadas.json();
        // Buscar horários do professor
        const resHorarios = await fetch('/api/me/horarios', { headers });
        const horarios = await resHorarios.json();
        // Montar pendentes: para cada horário ativo, para os últimos 30 dias, se não existe aula enviada para aquele dia/horário
        const hoje = new Date();
        hoje.setHours(0,0,0,0);
        const inicioDate = new Date(hoje);
        inicioDate.setDate(hoje.getDate() - 30);
        
        // Obter data de início da plataforma do localStorage
        const dataInicioPlataforma = typeof window !== 'undefined' 
          ? localStorage.getItem('dataInicioPlataforma') || ''
          : '';
        
        const pendentes: any[] = [];
        const aulasMap = new Map<string, boolean>();
        // Map aulas enviadas by horarioFixoId and date (YYYY-MM-DD)
        (Array.isArray(dataEnviadas) ? dataEnviadas : (dataEnviadas.data || [])).forEach((a: any) => {
          // Only consider aulas with status 'enviada' or 'corrigida'
          if (a.status === 'enviada' || a.status === 'corrigida') {
            const dStr = (a.data || '').split('T')[0] || '';
            const key = `${a.horarioFixoId || ''}_${dStr}`;
            aulasMap.set(key, true);
          }
        });
        (Array.isArray(horarios) ? horarios : (horarios.data || [])).filter((h: any) => h.ativo !== false).forEach((h: any) => {
          const horarioId = h._id || h.horarioFixoId;
          if (!horarioId) return;
          const raw = Number(h.diaSemana);
          const candidateDays = new Set<number>();
          if (!isNaN(raw)) {
            if (raw >= 0 && raw <= 6) candidateDays.add(raw);
            if (raw >= 1 && raw <= 7) candidateDays.add(raw % 7);
          }
          if (candidateDays.size === 0) candidateDays.add(0);
          for (let cur = new Date(inicioDate); cur <= hoje; cur.setDate(cur.getDate() + 1)) {
            if (candidateDays.has(cur.getDay())) {
              const dateStr = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}-${String(cur.getDate()).padStart(2,'0')}`;
              
              // Verificar se a data é anterior à data de início da plataforma
              const dentroDataPlataforma = !dataInicioPlataforma || dateStr >= dataInicioPlataforma;
              
              // Permitir qualquer data (removido bloqueio de data < hoje)
              if (dentroDataPlataforma) {
                const key = `${horarioId}_${dateStr}`;
                // Only show pendente if no enviada/corrigida exists for this slot/date
                if (!aulasMap.has(key)) {
                  pendentes.push({
                    data: dateStr,
                    horario: h.horario || (h.horarioInicio && h.horarioFim ? `${h.horarioInicio} - ${h.horarioFim}` : (h.horarioInicio || h.horarioFim) || 'Não informado'),
                    modalidade: (h.modalidade && h.modalidade.nome) || (h.modalidadeId && h.modalidadeId.nome) || 'Não informada',
                    professor: (h.professor && h.professor.nome) || (h.professorNome) || '',
                    horarioFixoId: horarioId
                  });
                }
              }
            }
          }
        });
        // Ordenar pendentes por data/hora
        pendentes.sort((a: any,b: any) => a.data.localeCompare(b.data));
        setAulasEnviadas(Array.isArray(dataEnviadas) ? dataEnviadas : (dataEnviadas.data || []));
        setAulasPendentes(pendentes);
        setPaginaPendentes(1);
        setPaginaEnviadas(1);
      } catch (err) {
        setError('Erro ao buscar aulas ou horários.');
      } finally {
        setLoading(false);
      }
    };

    // Buscar aulas ao carregar
    useEffect(() => { fetchAulas(); }, []);

    // Atualizar pendentes ao preencher aula (quando volta para esta tela)
    useEffect(() => {
      const onFocus = () => fetchAulas();
      window.addEventListener('focus', onFocus);
      return () => window.removeEventListener('focus', onFocus);
    }, []);

    // Formatar data
    const formatDate = (dateStr: string) => {
      const parts = dateStr.split('-');
      if (parts.length !== 3) return dateStr;
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    };

    // Obter dia da semana
    const getDiaSemana = (dateStr: string) => {
      try {
        const parts = dateStr.split('-');
        if (parts.length !== 3) return '';
        const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        const weekday = date.toLocaleDateString('pt-BR', { weekday: 'long' });
        return weekday.charAt(0).toUpperCase() + weekday.slice(1);
      } catch (e) {
        return '';
      }
    };

    // Calcular paginação
    const totalPaginasPendentes = Math.ceil(aulasPendentes.length / AULAS_POR_PAGINA);
    const totalPaginasEnviadas = Math.ceil(aulasEnviadas.length / AULAS_POR_PAGINA);
    
    const inicioPendentes = (paginaPendentes - 1) * AULAS_POR_PAGINA;
    const fimPendentes = inicioPendentes + AULAS_POR_PAGINA;
    const aulasPendentesPaginadas = aulasPendentes.slice(inicioPendentes, fimPendentes);

    const inicioEnviadas = (paginaEnviadas - 1) * AULAS_POR_PAGINA;
    const fimEnviadas = inicioEnviadas + AULAS_POR_PAGINA;
    const aulasEnviadasPaginadas = aulasEnviadas.slice(inicioEnviadas, fimEnviadas);

    return (
      <ProtectedPage tab="professor:aulas" title="Minhas Aulas - Professor">
          <div className="px-4 py-4 md:py-6 sm:px-6 lg:px-8">
            {/* Header Desktop */}
            <div className="hidden md:block mb-6 fade-in-1">
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <i className="fas fa-chalkboard-teacher text-primary-600"></i>
                Minhas Aulas
              </h1>
              <p className="text-sm text-gray-600 mt-1">Acompanhe e preencha suas aulas pendentes</p>
            </div>
            
            {/* Header Mobile - Compacto */}
            <div className="md:hidden mb-3 fade-in-1">
              <h1 className="text-lg font-bold text-gray-900">
                <i className="fas fa-chalkboard-teacher text-primary-600 mr-1.5"></i>
                Minhas Aulas
              </h1>
            </div>
            
            {error && <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700">{error}</div>}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 fade-in-2">
              {/* Pendentes */}
              <div className="bg-white rounded-md shadow-sm border border-gray-200 p-4 fade-in-3">
                <h2 className="text-sm font-semibold text-gray-900 mb-4">
                  <i className="fas fa-clock text-yellow-600 mr-2"></i>
                  Aulas Pendentes ({aulasPendentes.length})
                </h2>
                {loading ? (
                  <div className="space-y-3">
                    {[1, 2].map(i => (
                      <div key={i} className="p-3 rounded-lg border border-gray-200 animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    ))}
                  </div>
                ) : aulasPendentes.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">Nenhuma aula pendente</div>
                ) : (
                  <>
                    <div className="space-y-3">
                      {aulasPendentesPaginadas.map((aula: any, idx: number) => (
                        <button
                          key={idx}
                          onClick={() => {
                            const params = new URLSearchParams();
                            params.set('date', `${aula.data}T00:00:00`);
                            if (aula.horarioFixoId) params.set('horarioFixoId', String(aula.horarioFixoId));
                            window.location.href = `/professor/minhaagenda?${params.toString()}`;
                          }}
                          className="w-full text-left flex items-center justify-between gap-3 p-3 rounded-lg border shadow-sm hover:shadow-md transition"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                              <i className="fas fa-calendar text-gray-400" aria-hidden="true" />
                              {formatDate(aula.data)}
                            </div>
                            <div className="text-xs text-primary-600 font-medium">{getDiaSemana(aula.data)}</div>
                            <div className="text-xs text-gray-500 mt-1 truncate">{aula.modalidade || '—'}</div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="text-sm font-medium text-gray-600 flex items-center gap-2 justify-end">
                                <i className="fas fa-clock text-gray-400" aria-hidden="true" />
                                {aula.horario || '—'}
                              </div>
                              <div className="text-xs text-gray-400">Toque para preencher</div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                    {totalPaginasPendentes > 1 && (
                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                        <button
                          onClick={() => setPaginaPendentes(p => Math.max(1, p - 1))}
                          disabled={paginaPendentes === 1}
                          className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed hover:bg-gray-100 disabled:hover:bg-transparent transition"
                        >
                          <i className="fas fa-chevron-left" />
                          Anterior
                        </button>
                        <span className="text-sm text-gray-600">
                          Página {paginaPendentes} de {totalPaginasPendentes}
                        </span>
                        <button
                          onClick={() => setPaginaPendentes(p => Math.min(totalPaginasPendentes, p + 1))}
                          disabled={paginaPendentes === totalPaginasPendentes}
                          className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed hover:bg-gray-100 disabled:hover:bg-transparent transition"
                        >
                          Próxima
                          <i className="fas fa-chevron-right" />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
              {/* Enviadas */}
              <div className="bg-white rounded-md shadow-sm border border-gray-200 p-4 fade-in-3">
                <h2 className="text-sm font-semibold text-gray-900 mb-4">
                  <i className="fas fa-paper-plane text-primary-600 mr-2"></i>
                  Aulas Enviadas ({aulasEnviadas.length})
                </h2>
                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="p-3 rounded-lg border border-gray-200 animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    ))}
                  </div>
                ) : aulasEnviadas.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">Nenhuma aula enviada</div>
                ) : (
                  <>
                    <div className="space-y-3">
                      {aulasEnviadasPaginadas.map((aula: any, idx: number) => (
                        <div key={aula._id || idx} className="w-full flex items-center justify-between gap-3 p-3 rounded-lg border shadow-sm hover:shadow-md transition">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                              <i className="fas fa-calendar text-gray-400" aria-hidden="true" />
                              {formatDate((aula.data || '').split('T')[0])}
                            </div>
                            <div className="text-xs text-primary-600 font-medium">{getDiaSemana((aula.data || '').split('T')[0])}</div>
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
                        </div>
                      ))}
                    </div>
                    {totalPaginasEnviadas > 1 && (
                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                        <button
                          onClick={() => setPaginaEnviadas(p => Math.max(1, p - 1))}
                          disabled={paginaEnviadas === 1}
                          className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed hover:bg-gray-100 disabled:hover:bg-transparent transition"
                        >
                          <i className="fas fa-chevron-left" />
                          Anterior
                        </button>
                        <span className="text-sm text-gray-600">
                          Página {paginaEnviadas} de {totalPaginasEnviadas}
                        </span>
                        <button
                          onClick={() => setPaginaEnviadas(p => Math.min(totalPaginasEnviadas, p + 1))}
                          disabled={paginaEnviadas === totalPaginasEnviadas}
                          className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed hover:bg-gray-100 disabled:hover:bg-transparent transition"
                        >
                          Próxima
                          <i className="fas fa-chevron-right" />
                        </button>
                      </div>
                    )}
                  </>
                )}              </div>
            </div>
          </div>
      </ProtectedPage>
    );
  }
