'use client';

import { useState, useEffect, useMemo } from 'react';
import Layout from '@/components/Layout';

interface Modalidade {
  _id: string;
  nome: string;
  cor: string;
  duracao: number;
  limiteAlunos: number;
}

interface Professor {
  _id: string;
  nome: string;
  especialidade: string;
}

interface Aluno {
  _id: string;
  nome: string;
  email: string;
  telefone: string;
  endereco?: string;
  modalidadeId: Modalidade;
  plano?: string;
  observacoes?: string;
  ativo: boolean;
  modalidades?: { _id: string; nome: string; cor?: string }[];
  horarios?: AlunoHorario[];
}

interface AlunoHorario {
  diaSemana: number;
  horarioInicio: string;
  horarioFim: string;
  professorNome?: string;
  modalidadeNome?: string;
}

export default function AlunosPage() {
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [modalidades, setModalidades] = useState<Modalidade[]>([]);
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [loading, setLoading] = useState(true);
  

  useEffect(() => {
    fetchAlunos();
    fetchModalidades();
    fetchProfessores();
  }, []);

  // Fetch all alunos and attach their horarios (so students without horarios are included)
  const fetchAlunos = async () => {
    try {
      // Fetch all alunos
      const respAlunos = await fetch('/api/alunos');
      const dataAlunos = await respAlunos.json();
      let alunosList: any[] = [];
      if (dataAlunos && dataAlunos.success) {
        alunosList = dataAlunos.data || [];
      }

      // Fetch all horarios to attach schedule info per aluno
      const respHor = await fetch('/api/horarios');
      const dataHor = await respHor.json();
      const horarios = (dataHor && dataHor.success) ? (dataHor.data as any[]) : [];

      // Build a map of alunoId -> horarios
      // Prefer the newer `matriculas` shape on HorarioFixo: expand matriculas into per-aluno entries.
      // Fallback to legacy HorarioFixo.alunoId when present (for older seeds/backups).
      const horariosMap: Record<string, AlunoHorario[]> = {};
      horarios.forEach(h => {
        try {
          const ms = (h as any).matriculas;
          if (Array.isArray(ms) && ms.length > 0) {
            // expand each matricula into a horario entry for the referenced aluno
            for (let i = 0; i < ms.length; i++) {
              const m = ms[i] || {};
              // matricula.alunoId may be populated or just an id string
              const alunoRef = m.alunoId || null;
              const alunoId = alunoRef && (typeof alunoRef === 'string' ? alunoRef : (alunoRef._id || alunoRef)) || null;
              if (!alunoId) continue;

              const mod = (h.modalidadeId && (h.modalidadeId.nome || h.modalidadeId._id)) ? h.modalidadeId : ((m && (m.modalidadeId || null)) || null);
              const professorNome = (m && (m.professorNome || m.professorNome === '') && m.professorNome) ? m.professorNome : (h.professorId && (h.professorId.nome || h.professorId) ? (h.professorId.nome || String(h.professorId)) : '');
              const horarioEntry: AlunoHorario = {
                diaSemana: h.diaSemana,
                horarioInicio: h.horarioInicio,
                horarioFim: h.horarioFim,
                professorNome: professorNome,
                modalidadeNome: mod ? (mod.nome || '') : ''
              };
              horariosMap[String(alunoId)] = horariosMap[String(alunoId)] || [];
              horariosMap[String(alunoId)].push(horarioEntry);
            }
          } else {
            // legacy shape: horario has a single alunoId field
            const aluno = h.alunoId;
            if (aluno && aluno._id) {
              const mod = (h.modalidadeId && (h.modalidadeId.nome || h.modalidadeId._id)) ? h.modalidadeId : (aluno.modalidadeId || null);
              const professorNome = h.professorId && (h.professorId.nome || h.professorId) ? (h.professorId.nome || String(h.professorId)) : '';
              const horarioEntry: AlunoHorario = {
                diaSemana: h.diaSemana,
                horarioInicio: h.horarioInicio,
                horarioFim: h.horarioFim,
                professorNome: professorNome,
                modalidadeNome: mod ? (mod.nome || '') : ''
              };
              horariosMap[String(aluno._id)] = horariosMap[String(aluno._id)] || [];
              horariosMap[String(aluno._id)].push(horarioEntry);
            }
          }
        } catch (e) {
          // ignore problematic horario entries
          console.warn('Erro ao processar horario para map de alunos:', e);
        }
      });

      // Compose final alunos array: ensure every aluno appears, attach modalidade(s) and horarios
      const finalAlunos = alunosList.map(a => {
        // collect modalidades: combine aluno.modalidadeId and any modalidade info from horarios
        const modalidadesSet = new Map<string, { _id: string; nome: string; cor?: string }>();
        if (a.modalidadeId && a.modalidadeId._id) {
          modalidadesSet.set(String(a.modalidadeId._id), { _id: String(a.modalidadeId._id), nome: a.modalidadeId.nome || 'N/A', cor: a.modalidadeId.cor || '#3B82F6' });
        }
        const alunoHorarios = horariosMap[String(a._id)] || [];
        alunoHorarios.forEach(h => {
          if (h.modalidadeNome) {
            // we don't have modalidade _id here, use name as key
            modalidadesSet.set(h.modalidadeNome, { _id: h.modalidadeNome, nome: h.modalidadeNome, cor: '#3B82F6' });
          }
        });

        return {
          _id: a._id,
          nome: a.nome,
          email: a.email || '',
          telefone: a.telefone || 'Não informado',
          endereco: a.endereco || '',
          modalidadeId: a.modalidadeId || { _id: '', nome: 'N/A', cor: '#3B82F6', duracao: 0, limiteAlunos: 0 },
          plano: a.plano,
          observacoes: a.observacoes,
          ativo: a.ativo !== undefined ? a.ativo : true,
          modalidades: Array.from(modalidadesSet.values()),
          horarios: alunoHorarios
        } as Aluno;
      });

      setAlunos(finalAlunos);
    } catch (error) {
      console.error('Erro ao buscar alunos:', error);
    } finally {
      setLoading(false);
    }
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

  // Resolve a canonical color for a modalidade entry using the global modalidades list
  const getModalidadeColor = (m: any) => {
    if (!m) return '#3B82F6';
    // try find by id or name in global modalidades state
    const id = (m && ((m._id || (m as any).id))) || null;
    const nome = m && (m.nome || '');
    const found = modalidades.find(md => (id && String(md._id) === String(id)) || (md.nome && md.nome === nome));
    return (found && found.cor) || m.cor || '#3B82F6';
  };

  // Função para padronizar nomes: converter para MAIÚSCULAS
  const padronizarNome = (nome: string): string => {
    return String(nome || '').trim().toUpperCase();
  };

  

  // Estados para edição
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAluno, setEditingAluno] = useState<Aluno | null>(null);
  const [editFormData, setEditFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    endereco: '',
    observacoes: ''
  });

  // Estados para seleção múltipla
  const [selectedAlunos, setSelectedAlunos] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [query, setQuery] = useState('');

  // Função para abrir modal de edição
  const abrirEdicao = (aluno: Aluno) => {
    setEditingAluno(aluno);
    setEditFormData({
      nome: aluno.nome,
      email: aluno.email || '',
      telefone: aluno.telefone,
      endereco: aluno.endereco || '',
      observacoes: aluno.observacoes || ''
    });
    setShowEditModal(true);
  };

  // Função para salvar edição
  const salvarEdicao = async () => {
    if (!editingAluno) return;

    try {
      // Only send editable fields — modalidade is derived from horarios and should not be manually changed here
      const payload = {
        nome: editFormData.nome,
        email: editFormData.email,
        telefone: editFormData.telefone,
        endereco: editFormData.endereco,
        observacoes: editFormData.observacoes
      };

      const response = await fetch(`/api/alunos/${editingAluno._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success) {
        await fetchAlunos();
        setShowEditModal(false);
        // sucesso silencioso: modal fechado e lista atualizada
      } else {
        alert(`Erro: ${data.error}`);
      }
    } catch (error) {
      console.error('Erro ao atualizar aluno:', error);
      alert('Erro ao atualizar aluno');
    }
  };

  // Função para excluir aluno individual
  const excluirAluno = async (id: string, nome: string) => {
    if (!confirm(`Tem certeza que deseja excluir o aluno "${nome}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/alunos/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        await fetchAlunos();
        // sucesso silencioso: lista recarregada
      } else {
        alert(`Erro: ${data.error}`);
      }
    } catch (error) {
      console.error('Erro ao excluir aluno:', error);
      alert('Erro ao excluir aluno');
    }
  };

  // Filter alunos by query (name, email, phone, modalidades, modalidadeId.nome, plano)
  const filteredAlunos = useMemo(() => {
    if (!query) return alunos;
    const q = String(query).trim().toLowerCase();
    return alunos.filter(aluno => {
      const nome = String(aluno.nome || '').toLowerCase();
      const email = String(aluno.email || '').toLowerCase();
      const telefone = String(aluno.telefone || '').toLowerCase();
      const plano = String(aluno.plano || '').toLowerCase();
      const modIdNome = String(aluno.modalidadeId?.nome || '').toLowerCase();
      const modalidadesStr = (aluno.modalidades || []).map(m => String(m.nome || '').toLowerCase()).join(' ');
      return nome.includes(q) || email.includes(q) || telefone.includes(q) || plano.includes(q) || modIdNome.includes(q) || modalidadesStr.includes(q);
    });
  }, [alunos, query]);

  // Função para selecionar/deselecionar todos os alunos
  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedAlunos([]);
    } else {
      setSelectedAlunos(filteredAlunos.map(aluno => aluno._id));
    }
  };

  // Função para selecionar/deselecionar aluno individual
  const toggleSelectAluno = (alunoId: string) => {
    setSelectedAlunos(prev => {
      const newSelected = prev.includes(alunoId)
        ? prev.filter(id => id !== alunoId)
        : [...prev, alunoId];
      return newSelected;
    });
  };

  // Keep selectAll in sync with current selection and filtered list
  useEffect(() => {
    setSelectAll(selectedAlunos.length > 0 && filteredAlunos.length > 0 && selectedAlunos.length === filteredAlunos.length);
  }, [selectedAlunos, filteredAlunos]);

  

  // Função para excluir alunos selecionados em massa
  const excluirSelecionados = async () => {
    if (selectedAlunos.length === 0) {
      alert('Nenhum aluno selecionado');
      return;
    }

    if (!confirm(`Tem certeza que deseja excluir ${selectedAlunos.length} aluno(s) selecionado(s)?`)) {
      return;
    }

    try {
      const promises = selectedAlunos.map(id => 
        fetch(`/api/alunos/${id}`, { method: 'DELETE' })
      );

      const responses = await Promise.all(promises);
      const results = await Promise.all(responses.map(r => r.json()));

      const sucessos = results.filter(r => r.success).length;
      const erros = results.length - sucessos;

      await fetchAlunos();
      setSelectedAlunos([]);
      setSelectAll(false);

      // sucesso silencioso para exclusão em massa — registrar no console
      console.log('Exclusão em massa:', { sucessos, erros });
    } catch (error) {
      console.error('Erro ao excluir alunos:', error);
      alert('Erro ao excluir alunos selecionados');
    }
  };

  return (
  <Layout title="Alunos - Superação Flux" fullWidth>
      <div className="px-4 py-6 sm:px-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 fade-in-1">
          <div className="sm:flex sm:items-center sm:space-x-6">
            <div>
                <h1 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <i className="fas fa-users text-primary-600"></i>
                  Alunos
                </h1>
                <p className="mt-2 text-sm text-gray-600 max-w-xl">Gerencie o cadastro de alunos do studio — pesquise, edite e organize seus alunos.</p>
            </div>
            <div className="mt-3 sm:mt-0 grid grid-cols-3 gap-3 sm:gap-4 ml-0 sm:ml-6">
              <div className="bg-white border border-gray-100 rounded-md p-3 shadow-sm">
                <div className="text-xs text-gray-500">Total</div>
                <div className="text-lg font-semibold text-gray-900">{alunos.length}</div>
              </div>
              <div className="bg-white border border-gray-100 rounded-md p-3 shadow-sm">
                <div className="text-xs text-gray-500">Ativos</div>
                <div className="text-lg font-semibold text-green-700">{alunos.filter(a => a.ativo).length}</div>
              </div>
              <div className="bg-white border border-gray-100 rounded-md p-3 shadow-sm">
                <div className="text-xs text-gray-500">Com horário</div>
                <div className="text-lg font-semibold text-gray-900">{alunos.filter(a => a.horarios && a.horarios.length > 0).length}</div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {selectedAlunos.length > 0 && (
              <button
                type="button"
                onClick={excluirSelecionados}
                className="h-10 inline-flex items-center justify-center rounded-md border border-red-200 bg-red-50 px-4 text-sm font-medium text-red-700 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <span className="hidden sm:inline">🗑️</span>
                <span>Excluir ({selectedAlunos.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Search row placed above the table for clearer layout */}
        <div className="mt-4 sm:mt-6 fade-in-2">
          <div className="flex items-center justify-between gap-4">
            <div className="relative w-full sm:w-1/2">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" /></svg>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Pesquisar por nome, email, telefone, modalidade ou plano..."
                className="block w-full pl-10 pr-3 border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 bg-white"
              />
            </div>
            <div className="hidden sm:flex items-center text-sm text-gray-600">
              {/* reserve space for potential stats/filters */}
              <div>Resultados: {filteredAlunos.length}</div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col">
          <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8 fade-in-3">
            <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
              <div className="overflow-hidden rounded-md border border-gray-200">
                <table className="w-full table-fixed text-sm border-collapse">
                  <thead className="bg-white border-b border-gray-200">
                    <tr className="text-center">
                      <th scope="col" className="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          checked={selectAll}
                          onChange={toggleSelectAll}
                        />
                      </th>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                        Nome
                      </th>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                        Email
                      </th>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                        Modalidades
                      </th>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                        Horários
                      </th>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                        Telefone
                      </th>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                        Status
                      </th>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        <span className="sr-only">Ações</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="px-3 py-4 text-center text-sm text-gray-500 border-b border-gray-200">
                          Carregando alunos...
                        </td>
                      </tr>
                    ) : filteredAlunos.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-3 py-4 text-center text-sm text-gray-500 border-b border-gray-200">
                          Nenhum aluno encontrado.
                        </td>
                      </tr>
                    ) : (
                      filteredAlunos.map((aluno, idx) => (
                        <tr key={aluno._id} className={`fade-in-${Math.min((idx % 8) + 1, 8)}`}>
                          <td className="px-3 py-3 text-sm border-r border-b border-gray-200 text-center">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                              checked={selectedAlunos.includes(aluno._id)}
                              onChange={() => toggleSelectAluno(aluno._id)}
                            />
                          </td>
                          <td className="px-3 py-3 text-sm font-medium text-gray-900 border-r border-b border-gray-200">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-700">{(aluno.nome || '').split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase()}</div>
                              <div className="truncate" title={aluno.nome}>{aluno.nome}</div>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-sm text-gray-500 border-r border-b border-gray-200">
                            {aluno.email}
                          </td>
                          <td className="px-3 py-3 text-sm text-gray-500 border-r border-b border-gray-200">
                            <div className="flex items-center space-x-2">
                              {(aluno.modalidades && aluno.modalidades.length > 0) ? (
                                aluno.modalidades.map(m => (
                                  <div key={(m._id || m.nome)} className="flex items-center space-x-2">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getModalidadeColor(m) }}></div>
                                    <span className="text-xs">{m.nome}</span>
                                  </div>
                                ))
                              ) : (
                                <div className="flex items-center">
                                  <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: getModalidadeColor(aluno.modalidadeId) }}></div>
                                  <span className="text-xs">{aluno.modalidadeId?.nome || 'N/A'}</span>
                                </div>
                              )}
                            </div>
                          </td>

                          <td className="px-3 py-3 text-sm text-gray-500 border-r border-b border-gray-200">
                            {aluno.horarios && aluno.horarios.length > 0 ? (
                              <div className="space-y-0.5">
                                <div className="text-xs font-semibold text-gray-700">Treinos: {aluno.horarios.length}</div>
                                {aluno.horarios.slice(0,2).map((h,i) => (
                                  <div key={`${h.diaSemana}-${h.horarioInicio}-${h.horarioFim}-${h.professorNome || ''}`} className="text-xs text-gray-600">
                                    {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][h.diaSemana]} {h.horarioInicio}–{h.horarioFim}
                                  </div>
                                ))}
                                {aluno.horarios.length > 2 && <div className="text-xs text-gray-400">+{aluno.horarios.length - 2} outros</div>}
                              </div>
                            ) : (
                              <div className="text-xs text-gray-400">—</div>
                            )}
                          </td>
                          <td className="px-3 py-3 text-sm text-gray-500 border-r border-b border-gray-200">
                            {aluno.telefone}
                          </td>
                          <td className="px-3 py-3 text-sm border-r border-b border-gray-200">
                            <span
                              className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                                aluno.ativo
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {aluno.ativo ? 'Ativo' : 'Inativo'}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-sm border-b border-gray-200">
                            <div className="flex items-center justify-center gap-2">
                              <button onClick={() => abrirEdicao(aluno)} className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-white border border-gray-100 hover:bg-gray-50 text-primary-600">
                                <svg className="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536M9 11l6-6 3 3-6 6H9v-3z"/></svg>
                              </button>
                              <button onClick={() => excluirAluno(aluno._id, aluno.nome)} className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-red-50 border border-red-100 text-red-700 hover:bg-red-100">
                                <svg className="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M10 3h4l1 4H9l1-4z"/></svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      

      {/* Modal de Edição */}
      {showEditModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-0 border w-11/12 max-w-md shadow-lg rounded-md bg-white fade-in-4">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-medium text-gray-900">Editar Aluno</h3>
            </div>
            <div className="p-6">
              <form noValidate>
                <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome *
                  </label>
                  <input
                    type="text"
                    value={editFormData.nome}
                    onChange={(e) => setEditFormData({...editFormData, nome: e.target.value})}
                    className="block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email <span className="text-gray-400 text-xs">(opcional)</span>
                  </label>
                  <input
                    type="email"
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({...editFormData, email: e.target.value})}
                    className="block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    placeholder="email@exemplo.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Telefone <span className="text-gray-400 text-xs">(pode ser &quot;Não informado&quot;)</span>
                  </label>
                  <input
                    type="tel"
                    value={editFormData.telefone}
                    onChange={(e) => setEditFormData({...editFormData, telefone: e.target.value})}
                    className="block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    placeholder="(11) 99999-9999 ou Não informado"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Endereço
                  </label>
                  <input
                    type="text"
                    value={editFormData.endereco}
                    onChange={(e) => setEditFormData({...editFormData, endereco: e.target.value})}
                    className="block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Endereço completo"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Modalidade
                  </label>
                  <div>
                    {editingAluno && (editingAluno.modalidades && editingAluno.modalidades.length > 0) ? (
                      <div className="flex flex-wrap gap-2">
                        {editingAluno.modalidades.map(m => (
                          <span key={(m._id || m.nome)} className="inline-flex items-center gap-2 px-3 py-0.5 bg-gray-50 border border-gray-100 rounded-full text-xs">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getModalidadeColor(m) }} />
                            <span className="text-xs text-gray-700">{m.nome}</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-50 border border-gray-100 rounded-md text-sm text-gray-600">{editingAluno?.modalidadeId?.nome || '—'}</div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Observações
                  </label>
                  <textarea
                    value={editFormData.observacoes}
                    onChange={(e) => setEditFormData({...editFormData, observacoes: e.target.value})}
                    className="block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    rows={3}
                    placeholder="Observações sobre o aluno"
                  />
                </div>
              </div>

                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={salvarEdicao}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    Salvar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

    </Layout>
  );
}