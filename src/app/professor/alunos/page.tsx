"use client";

import React, { useEffect, useState, useMemo } from 'react';
import Layout from '@/components/Layout';

type Aluno = { _id: string; nome: string; email?: string; telefone?: string; endereco?: string; modalidadeId?: any; plano?: string; observacoes?: string; modalidades?: { _id: string; nome: string; cor?: string }[] };
type Horario = {
  _id: string;
  diaSemana: number;
  horarioInicio: string;
  horarioFim: string;
  alunoId?: { _id?: string; nome?: string } | Array<any> | null;
  congelado?: boolean;
  ausente?: boolean;
  emEspera?: boolean;
  modalidadeId?: any;
  modalidadeNome?: string;
  professorId?: any;
};

export default function ProfessorAlunosPage() {
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [allAlunos, setAllAlunos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        const [resHor, resAlunos] = await Promise.all([
          fetch('/api/me/horarios', { headers: { Authorization: token ? `Bearer ${token}` : '' } }),
          fetch('/api/alunos')
        ]);

        if (!resHor.ok) throw new Error('Falha ao buscar horários');
        const payload = await resHor.json();
        const list = Array.isArray(payload) ? payload : (Array.isArray(payload.data) ? payload.data : []);
        setHorarios(list);

        const alunosPayload = await resAlunos.json();
        setAllAlunos(Array.isArray(alunosPayload?.data) ? alunosPayload.data : []);
      } catch (e: any) {
        setError(e?.message || 'Erro desconhecido');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const alunosMap = useMemo(() => {
    type ModalidadeBadge = { nome: string; cor?: string };
    type StudentEntry = { aluno: Aluno; horarios: Horario[]; flags: { congelado: boolean; ausente: boolean; emEspera: boolean }; modalidades: ModalidadeBadge[] };
    const m = new Map<string, StudentEntry>();
    // build a lookup of allAlunos by id for quick merge
    const detailsMap = new Map<string, any>();
    allAlunos.forEach(a => { if (a && a._id) detailsMap.set(String(a._id), a); });

    horarios.forEach(h => {
      const alunos = Array.isArray(h.alunoId) ? h.alunoId : (h.alunoId ? [h.alunoId] : []);
      alunos.forEach((a: any) => {
        const id = typeof a === 'string' ? a : (a._id || '');
        const nome = typeof a === 'string' ? a : (a.nome || '');
        if (!id) return;
        let prev = m.get(id);
        if (!prev) {
          const details = detailsMap.get(id) || {};
          prev = { aluno: { _id: id, nome: details.nome || nome || '', email: details.email || '', telefone: details.telefone || '', modalidadeId: details.modalidadeId || { _id: '', nome: '' }, plano: details.plano, modalidades: details.modalidades || [] }, horarios: [], flags: { congelado: false, ausente: false, emEspera: false }, modalidades: [] };
          m.set(id, prev);
        }
        prev.horarios.push(h);
        prev.flags.congelado = prev.flags.congelado || !!h.congelado;
        prev.flags.ausente = prev.flags.ausente || !!h.ausente;
        prev.flags.emEspera = prev.flags.emEspera || !!h.emEspera;
      });
    });
    // compute modalidade badges for each entry using multiple sources (aluno.modalidades, horarios populated fields, aluno.modalidadeId, fallback to plano)
    m.forEach((entry) => {
      const seen = new Map<string, ModalidadeBadge>();
      // 1) explicit aluno.modalidades
      if (entry.aluno.modalidades && entry.aluno.modalidades.length > 0) {
        entry.aluno.modalidades.forEach((mm: any) => {
          if (mm && mm.nome) seen.set(String(mm.nome), { nome: mm.nome, cor: mm.cor });
        });
      }
      // 2) collect from horarios: h.modalidadeNome or h.alunoId.modalidadeId
      (entry.horarios || []).forEach(h => {
        const hh: any = h as any;
        if (hh.modalidadeNome) {
          if (!seen.has(hh.modalidadeNome)) seen.set(hh.modalidadeNome, { nome: hh.modalidadeNome });
        } else if (hh.alunoId && hh.alunoId.modalidadeId && hh.alunoId.modalidadeId.nome) {
          const nm = hh.alunoId.modalidadeId.nome;
          if (!seen.has(nm)) seen.set(nm, { nome: nm, cor: hh.alunoId.modalidadeId.cor });
        } else if (hh.modalidadeId && hh.modalidadeId.nome) {
          const nm = hh.modalidadeId.nome;
          if (!seen.has(nm)) seen.set(nm, { nome: nm, cor: hh.modalidadeId.cor });
        }
      });
      // 3) aluno.modalidadeId
      if (entry.aluno.modalidadeId && (entry.aluno.modalidadeId.nome || entry.aluno.modalidadeId._id)) {
        const nm = entry.aluno.modalidadeId.nome || String(entry.aluno.modalidadeId._id);
        if (!seen.has(nm)) seen.set(nm, { nome: nm, cor: (entry.aluno.modalidadeId && (entry.aluno.modalidadeId as any).cor) });
      }
      // 4) fallback to plano string
      if (seen.size === 0 && entry.aluno.plano) {
        seen.set(String(entry.aluno.plano), { nome: String(entry.aluno.plano) });
      }
      entry.modalidades = Array.from(seen.values());
    });

    // return as array
    return Array.from(m.values()) as StudentEntry[];
  }, [horarios, allAlunos]);

  if (loading) {
    return (
      <Layout title="Meus Alunos - Superação Flux">
        <div className="p-6 max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-lg font-semibold">Meus Alunos</h1>
              <div className="text-sm text-gray-500">Carregando...</div>
            </div>
            <div className="w-64">
              <div className="h-10 bg-gray-100 rounded" />
            </div>
          </div>

          <div className="grid gap-3">
            {[1,2,3].map(i => (
              <div key={i} className="p-4 bg-white rounded-lg shadow-sm">
                <div className="grid grid-cols-1 sm:grid-cols-6 gap-3 items-start">
                  <div className="sm:col-span-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-100" />
                        <div className="space-y-1">
                          <div className="h-4 w-40 bg-gray-100 rounded" />
                          <div className="h-3 w-28 bg-gray-100 rounded" />
                        </div>
                      </div>
                      <div className="text-right text-xs text-gray-400">Aulas: <span className="inline-block h-4 w-6 bg-gray-100" /></div>
                    </div>

                    <div className="mt-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="h-6 w-20 bg-gray-100 rounded" />
                        <div className="h-6 w-20 bg-gray-100 rounded" />
                      </div>
                    </div>
                  </div>

                  <div className="sm:col-span-2 flex flex-col items-end justify-between gap-3">
                    <div className="flex flex-col items-end">
                      <div className="h-3 w-24 bg-gray-100 rounded" />
                      <div className="h-4 w-32 bg-gray-100 rounded mt-1" />
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="h-6 w-16 bg-gray-100 rounded" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Layout>
    );
  }
  if (error) return <div className="p-6 text-red-600">{error}</div>;

  return (
    <Layout title="Meus Alunos - Superação Flux">
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-semibold">Meus Alunos</h1>
            <div className="text-sm text-gray-500">Total: {alunosMap.length}</div>
          </div>
          <div className="w-full sm:w-64">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pesquisar alunos por nome, email ou plano..."
              className="block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>

        {alunosMap.length === 0 ? (
          <div className="text-gray-500">Nenhum aluno encontrado.</div>
        ) : (
          <div className="grid gap-3">
            {alunosMap
              .filter(entry => {
                if (!query) return true;
                const q = query.toLowerCase();
                const p = String(entry.aluno.plano || '').toLowerCase();
                return (entry.aluno.nome || '').toLowerCase().includes(q) || (entry.aluno.email || '').toLowerCase().includes(q) || p.includes(q);
              })
              .map((entry) => (
              <div key={entry.aluno._id} className="p-4 bg-white rounded-lg shadow-sm">
                <div className="grid grid-cols-1 sm:grid-cols-6 gap-3 items-start">
                  {/* left: main details (col-span 4) */}
                  <div className="sm:col-span-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600">
                          <i className="fas fa-user" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-gray-800">{entry.aluno.nome}</div>
                          <div className="text-xs text-gray-500">{entry.aluno.email || entry.aluno.telefone || '—'}</div>
                        </div>
                      </div>
                      <div className="text-right text-xs text-gray-400">Aulas: <span className="font-medium text-gray-700">{entry.horarios.length}</span></div>
                    </div>

                    <div className="mt-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {entry.modalidades && entry.modalidades.length > 0 ? (
                          entry.modalidades.map((m) => (
                            <span key={m.nome} className="inline-flex items-center gap-2 px-3 py-0.5 bg-gray-50 border border-gray-100 rounded-full text-xs">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.cor || '#CBD5E1' }} />
                              <span className="text-xs text-gray-700">{m.nome}</span>
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </div>
                    </div>

                    {entry.horarios && entry.horarios.length > 0 && (
                      <div className="mt-3 text-sm text-gray-600 grid grid-cols-2 gap-2">
                        {entry.horarios.slice(0,4).map((h, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <div className="text-xs text-gray-700 w-14">{['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][h.diaSemana]}</div>
                            <div className="text-xs text-gray-600">{h.horarioInicio}–{h.horarioFim}{h.modalidadeNome ? (<span className="text-gray-500"> · {h.modalidadeNome}</span>) : null}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* right: quick stats and flags (col-span 2) */}
                  <div className="sm:col-span-2 flex flex-col items-end justify-between gap-3">
                    <div className="flex flex-col items-end">
                      <div className="text-xs text-gray-500">Contato</div>
                      <div className="text-sm font-medium text-gray-800">{entry.aluno.email ? entry.aluno.email : (entry.aluno.telefone || '—')}</div>
                    </div>

                    <div className="flex items-center gap-2">
                      {entry.flags.congelado && <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-xs">Congelado</span>}
                      {entry.flags.ausente && <span className="px-2 py-1 bg-yellow-50 text-yellow-800 rounded-md text-xs">Ausente</span>}
                      {entry.flags.emEspera && <span className="px-2 py-1 bg-gray-50 text-gray-700 rounded-md text-xs">Em espera</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
