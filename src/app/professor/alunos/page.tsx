'use client';

import React, { useEffect, useState, useMemo } from 'react';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    const fetchHorarios = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');

        const res = await fetch('/api/me/horarios', {
          headers: { Authorization: token ? `Bearer ${token}` : '' }
        });

        if (!res.ok) throw new Error('Erro ao buscar horários');

        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.data || []);

        setHorarios(list.filter((h: HorarioFixo) => h.ativo));
      } catch (err: any) {
        console.error('Erro ao buscar horários:', err);
        setError(err.message || 'Erro ao carregar alunos');
      } finally {
        setLoading(false);
      }
    };

    fetchHorarios();
  }, []);

  const alunosComAulas = useMemo(() => {
    const mapa = new Map<string, AlunoComAulas>();

    horarios.forEach(horario => {
      if (horario.alunos && Array.isArray(horario.alunos)) {
        horario.alunos.forEach(aluno => {
          const chave = aluno._id;

          if (!mapa.has(chave)) {
            mapa.set(chave, {
              aluno,
              aulas: []
            });
          }

          mapa.get(chave)!.aulas.push(horario);
        });
      }
    });

    return Array.from(mapa.values());
  }, [horarios]);

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

  if (loading) {
    return (
      <Layout title="Meus Alunos - Superação Flux">
        <div className="p-6 max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-gray-900">
              <i className="fas fa-users mr-3 text-primary-600"></i>
              Meus Alunos
            </h1>
            <p className="text-gray-600 mt-1">Carregando lista de alunos...</p>
          </div>

          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-md shadow-sm border border-gray-200 p-4 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-md bg-gray-200"></div>
                  <div className="flex-1">
                    <div className="h-4 w-32 bg-gray-200 rounded mb-2"></div>
                    <div className="h-3 w-48 bg-gray-100 rounded"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
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
    );
  }

  return (
    <Layout title="Meus Alunos - Superação Flux">
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8 fade-in-1">
            <h1 className="text-2xl font-semibold text-gray-900">
              <i className="fas fa-users mr-3 text-primary-600"></i>
              Meus Alunos
            </h1>
            <p className="text-gray-600 mt-1">
              Total de alunos: <span className="font-semibold text-gray-900">{alunosComAulas.length}</span>
            </p>
          </div>

          <div className="bg-white rounded-md shadow-sm border border-gray-200 p-4 mb-6 fade-in-2">
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

          {alunosFiltrados.length === 0 ? (
            <div className="bg-white rounded-md shadow-sm border border-gray-200 p-12 text-center">
              <i className="fas fa-inbox text-gray-300 text-4xl mb-4 block"></i>
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
                  className={`bg-white rounded-md shadow-sm border border-gray-200 overflow-hidden fade-in-${Math.min((alunosFiltrados.indexOf(item) % 8) + 1, 8)}`}
                >
                  <div className="p-4 border-b border-gray-100">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-md bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                        {item.aluno.nome.charAt(0).toUpperCase()}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-gray-900 truncate">
                          {item.aluno.nome}
                        </h3>
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

                        {item.aluno.modalidades && item.aluno.modalidades.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {item.aluno.modalidades.map((mod) => (
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
                        )}
                      </div>

                      <div className="text-right flex-shrink-0">
                        <div className="text-2xl font-bold text-primary-600">
                          {item.aulas.length}
                        </div>
                        <div className="text-xs text-gray-600 font-medium">
                          {item.aulas.length === 1 ? 'Aula' : 'Aulas'}
                        </div>
                      </div>
                    </div>
                  </div>

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
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
