'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import RequireAuth from '@/components/RequireAuth';
import Layout from '@/components/Layout';

interface Especialidade {
  _id: string;
  nome: string;
  descricao?: string;
}

interface Professor {
  _id: string;
  nome: string;
  email?: string;
  telefone?: string;
  especialidades: Especialidade[];
  cor?: string;
  ativo: boolean;
  criadoEm?: string;
  atualizadoEm?: string;
}

interface ProfessorForm {
  nome: string;
  email: string;
  telefone: string;
  especialidades: string[];
  cor: string;
  ativo: boolean;
  senha?: string;
}

export default function ProfessoresPage() {
    const coresSugeridas = [
      '#ff887c',
      '#dc2127',
      '#ffb878',
      '#fbd75b',
      '#7ae7bf',
      '#51b749',
      '#46d6db',
      '#5484ed',
      '#a4bdfc',
      '#dbadff',
      '#e1e1e1'
    ];
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [especialidades, setEspecialidades] = useState<Especialidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [formData, setFormData] = useState<ProfessorForm>({
    nome: '',
    email: '',
    telefone: '',
    especialidades: [],
    cor: '#3B82F6',
    ativo: true,
    senha: ''
  });

  // Carregar professores
  const carregarProfessores = async () => {
    try {
      const response = await fetch('/api/professores');
      const data = await response.json();
      
      if (data.success) {
        setProfessores(data.data);
      } else {
        console.error('Erro ao carregar professores:', data.error);
      }
    } catch (error) {
      console.error('Erro ao carregar professores:', error);
    } finally {
      setLoading(false);
    }
  };

  // Carregar especialidades
  const carregarEspecialidades = async () => {
    try {
      const response = await fetch('/api/especialidades');
      const data = await response.json();
      
      if (data.success) {
        setEspecialidades(data.data);
      } else {
        console.error('Erro ao carregar especialidades:', data.error);
      }
    } catch (error) {
      console.error('Erro ao carregar especialidades:', error);
    }
  };

  useEffect(() => {
    carregarProfessores();
    carregarEspecialidades();
  }, []);

  // Handlers otimizados
  const handleNomeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({...prev, nome: e.target.value}));
  }, []);

  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({...prev, email: e.target.value}));
  }, []);

  const handleTelefoneChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({...prev, telefone: e.target.value}));
  }, []);

  const handleEspecialidadeChange = useCallback((especialidadeId: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      especialidades: checked 
        ? [...prev.especialidades, especialidadeId]
        : prev.especialidades.filter(id => id !== especialidadeId)
    }));
  }, []);

  const handleAtivoChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({...prev, ativo: e.target.checked}));
  }, []);

  // Criar nova especialidade
  const criarEspecialidade = async (nome: string) => {
    try {
      const response = await fetch('/api/especialidades', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ nome })
      });

      const data = await response.json();

      if (data.success) {
        await carregarEspecialidades(); // Recarregar lista
        // sucesso silencioso: lista recarregada
      } else {
        alert(`Erro: ${data.error}`);
      }
    } catch (error) {
      console.error('Erro ao criar especialidade:', error);
      alert('Erro ao criar especialidade');
    }
  };

  // Excluir especialidade
  const excluirEspecialidade = async (id: string) => {
    try {
      const response = await fetch(`/api/especialidades/${id}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        await carregarEspecialidades(); // Recarregar lista
        // Remover especialidade dos dados do formulário se estiver selecionada
        setFormData(prev => ({
          ...prev,
          especialidades: prev.especialidades.filter(espId => espId !== id)
        }));
        // sucesso silencioso: lista recarregada
      } else {
        alert(`Erro: ${data.error}`);
      }
    } catch (error) {
      console.error('Erro ao excluir especialidade:', error);
      alert('Erro ao excluir especialidade');
    }
  };

  // Abrir modal para novo professor
  const abrirModalNovo = () => {
    setEditingId(null);
    setFormData({
      nome: '',
      email: '',
      telefone: '',
      especialidades: [],
      cor: '#3B82F6',
      ativo: true
    });
    setShowModal(true);
  };

  // Filter professors by query
  const filteredProfessores = useMemo(() => {
    if (!query) return professores;
    const q = String(query).trim().toLowerCase();
    return professores.filter(p => {
      const nome = String(p.nome || '').toLowerCase();
      const email = String(p.email || '').toLowerCase();
      const telefone = String(p.telefone || '').toLowerCase();
      const especialidadesStr = (p.especialidades || []).map(e => String(e.nome || '').toLowerCase()).join(' ');
      return nome.includes(q) || email.includes(q) || telefone.includes(q) || especialidadesStr.includes(q);
    });
  }, [professores, query]);

  // Abrir modal para editar professor
  const abrirModalEditar = (professor: Professor) => {
    setEditingId(professor._id);
    setFormData({
      nome: professor.nome,
      email: professor.email || '',
      telefone: professor.telefone || '',
      especialidades: professor.especialidades?.map(esp => esp._id) || [],
      cor: professor.cor || '#3B82F6',
      ativo: professor.ativo
    });
    setShowModal(true);
  };

  // Salvar professor (criar ou editar)
  const salvarProfessor = async () => {
    try {
      console.log('📝 Dados sendo enviados:', formData);
      
      const url = editingId 
        ? `/api/professores/${editingId}`
        : '/api/professores';
      
      const method = editingId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        // If the save succeeded, and a password was provided, attempt to set it via API
        await carregarProfessores();
        const savedId = editingId || (data.data && data.data._id) || null;
        if (savedId && formData.senha && String(formData.senha).trim().length > 0) {
          try {
            const resp = await fetch(`/api/professores/${savedId}/senha`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ senha: formData.senha }) });
            const sd = await resp.json();
            if (!sd || !sd.success) {
              alert('Professor salvo, mas falha ao definir senha: ' + (sd && sd.error ? sd.error : 'Erro'));
            }
          } catch (e) {
            console.error('Erro ao setar senha:', e);
            alert('Professor salvo, mas falha ao definir senha');
          }
        }
        setShowModal(false);
        // sucesso silencioso: modal fechado e lista recarregada
      } else {
        alert(`Erro: ${data.error}`);
      }
    } catch (error) {
      console.error('Erro ao salvar professor:', error);
      alert('Erro ao salvar professor');
    }
  };

  // Excluir professor
  const excluirProfessor = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este professor?')) {
      return;
    }

    try {
      const response = await fetch(`/api/professores/${id}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        await carregarProfessores();
        // sucesso silencioso: lista recarregada
      } else {
        alert(`Erro: ${data.error}`);
      }
    } catch (error) {
      console.error('Erro ao excluir professor:', error);
      alert('Erro ao excluir professor');
    }
  };

  if (loading) {
    return (
      <RequireAuth showLoginRedirect={false}>
        <Layout title="Professores - Superação Flux">
          <div className="flex justify-center items-center h-64">
            {/* Loading state removed */}
          </div>
        </Layout>
      </RequireAuth>
    );
  }

  return (
    <RequireAuth showLoginRedirect={false}>
      <Layout title="Professores - Superação Flux" fullWidth>
      <div className="px-4 py-6 sm:px-0">
        <div className="flex items-center justify-between gap-4 fade-in-1">
          <div>
            <h1 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <i className="fas fa-chalkboard-teacher text-primary-600"></i>
              Professores
            </h1>
            <p className="mt-2 text-sm text-gray-600 max-w-xl">Gerencie a equipe de professores do studio — adicione, edite e organize especialidades.</p>
          </div>

          <div className="flex items-center gap-3">
            <div>
              <button
                type="button"
                onClick={abrirModalNovo}
                className="transition-colors duration-200 h-10 inline-flex items-center gap-2  rounded-full bg-primary-600 text-white px-4 text-sm font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <i className="fas fa-user-plus w-4 text-white " aria-hidden="true" />
                Novo Professor
              </button>
            </div>
          </div>
        </div>

        {/* Search row above table */}
        <div className="mt-4 sm:mt-6 fade-in-2">
          <div className="flex items-center justify-between gap-4">
            <div className="relative w-full sm:w-1/2">
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 w-4 text-gray-400" aria-hidden="true" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Pesquisar por nome, email, telefone ou especialidade..."
                className="block w-full pl-10 pr-3 border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 bg-white"
              />
            </div>
            <div className="hidden sm:flex items-center text-sm text-gray-600">
              <div>Resultados: {filteredProfessores.length}</div>
            </div>
          </div>
        </div>

        {filteredProfessores.length === 0 ? (
          <div className="text-center py-12">
              <div className="mb-4">
                  <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-primary-50 text-primary-600">
                  <i className="fas fa-chalkboard-teacher text-primary-600 text-lg" aria-hidden="true" />
                </div>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum professor encontrado</h3>
            <p className="text-gray-500 mb-6">
              Não há professores que correspondam à sua busca.
            </p>
            <button
              onClick={abrirModalNovo}
              className="h-10 inline-flex items-center gap-2 rounded-md bg-primary-600 text-white px-4 text-sm font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <i className="fas fa-chalkboard-teacher" aria-hidden="true" /> Cadastrar Professor
            </button>
          </div>
        ) : (
          <div className="mt-8 flex flex-col fade-in-3">
            <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
              <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
              <div className="overflow-hidden rounded-md border border-gray-200">
                  <table className="w-full table-fixed text-sm border-collapse text-center">
                    <thead className="bg-white border-b border-gray-200">
                      <tr>
                        <th scope="col" className="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                          Nome
                        </th>
                        <th scope="col" className="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                          Email
                        </th>
                        <th scope="col" className="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                          Telefone
                        </th>
                        <th scope="col" className="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                          Especialidades
                        </th>
                        <th scope="col" className="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                          Status
                        </th>
                        <th scope="col" className="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {filteredProfessores.map((professor, idx) => (
                        <tr
                          key={professor._id}
                          className={`fade-in-${Math.min((idx % 8) + 1, 8)} ${!professor.ativo ? 'bg-gray-100 text-gray-400' : ''}`}
                        >
                          <td className="px-3 py-3 text-sm border-r border-b border-gray-200 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <div
                                className="h-4 w-4 rounded-full border border-gray-300 flex-shrink-0"
                                style={{ backgroundColor: professor.ativo ? (professor.cor || '#3B82F6') : '#e5e7eb' }}
                                title={professor.ativo ? `Cor: ${professor.cor || '#3B82F6'}` : 'Inativo'}
                              />
                              <span className={`font-medium ${professor.ativo ? 'text-gray-900' : 'text-gray-400'}`}>{professor.nome}</span>
                            </div>
                          </td>
                          <td className={`px-3 py-3 text-sm border-r border-b border-gray-200 text-center ${!professor.ativo ? 'text-gray-400' : 'text-gray-500'}`}>
                            {professor.email || <span className="text-gray-400 italic">Não informado</span>}
                          </td>
                          <td className={`px-3 py-3 text-sm border-r border-b border-gray-200 text-center ${!professor.ativo ? 'text-gray-400' : 'text-gray-500'}`}>
                            {professor.telefone || <span className="text-gray-400 italic">Não informado</span>}
                          </td>
                          <td className={`px-3 py-3 text-sm border-r border-b border-gray-200 text-center ${!professor.ativo ? 'text-gray-400' : 'text-gray-500'}`}>
                            <div className="flex flex-wrap justify-center gap-1">
                              {professor.especialidades?.map((esp) => (
                                <span
                                  key={esp._id}
                                  className={`inline-flex rounded-full px-2 text-xs font-semibold ${professor.ativo ? 'bg-blue-100 text-blue-800' : 'bg-gray-200 text-gray-400'}`}
                                >
                                  {esp.nome}
                                </span>
                              ))}
                              {(!professor.especialidades || professor.especialidades.length === 0) && (
                                <span className="text-gray-400 italic text-xs">Nenhuma</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-sm border-r border-b border-gray-200 text-center">
                            <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                              professor.ativo
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-300 text-gray-500'
                            }`}>
                              {professor.ativo ? 'Ativo' : 'Inativo'}
                            </span>
                          </td>
                          <td className={`px-3 py-3 text-sm border-b border-gray-200 text-center ${!professor.ativo ? 'text-gray-400' : ''}`}>
                            <div className="flex items-center justify-center gap-2">
                              <button onClick={() => abrirModalEditar(professor)} className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-white border border-gray-100 hover:bg-gray-50 text-primary-600">
                                <i className="fas fa-edit w-3" aria-hidden="true" />
                              </button>
                              <button onClick={() => excluirProfessor(professor._id)} className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border ${professor.ativo ? 'bg-red-50 border-red-100 text-red-700 hover:bg-red-100' : 'bg-gray-200 border-gray-300 text-gray-400 cursor-not-allowed'}`} disabled={!professor.ativo}>
                                <i className="fas fa-trash w-3" aria-hidden="true" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Cadastro/Edição - padronizado conforme /modalidades */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-700 bg-opacity-50">
            <div className="relative w-full max-w-lg mx-auto bg-white rounded-lg shadow-lg border border-gray-200 p-6">
              {/* Header + Info */}
              <div className="mb-2 border-b pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {editingId ? (
                      <i className="fas fa-edit text-green-600 text-lg" aria-hidden="true" />
                    ) : (
                      <i className="fas fa-chalkboard-teacher text-green-600 text-lg" aria-hidden="true" />
                    )}
                    <h3 className="text-base font-semibold text-gray-900">
                      {editingId ? 'Editar Professor' : 'Novo Professor'}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="text-gray-400 hover:text-gray-600 focus:outline-none"
                    title="Fechar"
                  >
                    <i className="fas fa-times text-lg" aria-hidden="true" />
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <i className="fas fa-info-circle text-green-600 text-sm" aria-hidden="true" />
                  <span className="text-sm font-medium text-gray-500">Preencha os dados do professor e selecione as especialidades.</span>
                </div>
              </div>
              {/* Form */}
              <form
                className="space-y-4"
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  salvarProfessor();
                }}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                    <input
                      type="text"
                      value={formData.nome}
                      onChange={handleNomeChange}
                      className="block w-full h-10 border border-gray-300 rounded-md px-3 py-2 text-sm font-medium focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      placeholder="Nome completo"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-gray-400 text-sm font-medium">(opcional)</span></label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={handleEmailChange}
                      className="block w-full h-10 border border-gray-300 rounded-md px-3 py-2 text-sm font-medium focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      placeholder="email@exemplo.com"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefone <span className="text-gray-400 text-sm font-medium">(opcional)</span></label>
                  <input
                    type="tel"
                    value={formData.telefone}
                    onChange={handleTelefoneChange}
                    className="block w-full h-10 border border-gray-300 rounded-md px-3 py-2 text-sm font-medium focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    placeholder="(11) 99999-9999"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <label className="block text-sm font-medium text-gray-700">Cor</label>
                    <div className="flex flex-wrap gap-1 p-1 bg-gray-50 border border-gray-200 rounded-md">
                      {coresSugeridas.map((cor) => (
                        <button
                          key={cor}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, cor: cor }))}
                          className={`relative h-6 w-6 rounded-full border flex items-center justify-center transition-all duration-150 hover:scale-105 hover:border-primary-400 focus:outline-none ${formData.cor === cor ? 'border-primary-600 ring-2 ring-primary-400' : 'border-gray-300'}`}
                          style={{ backgroundColor: cor }}
                          title={cor}
                        >
                          {formData.cor === cor && (
                            <span className="absolute inset-0 flex items-center justify-center">
                              <i className="fas fa-check text-white text-[10px] drop-shadow" />
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">Especialidades</label>
                    <button
                      type="button"
                      onClick={() => {
                        const nome = prompt('Nome da nova especialidade:');
                        if (nome) criarEspecialidade(nome);
                      }}
                      className="text-sm font-medium bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded flex items-center gap-1"
                    >
                      <i className="fas fa-plus" aria-hidden="true" /> Adicionar
                    </button>
                  </div>
                  <div className="space-y-2 max-h-32 overflow-y-auto border border-gray-200 rounded-md p-2">
                    {especialidades.length === 0 ? (
                      <p className="text-gray-500 text-sm font-medium italic text-center py-2">Nenhuma especialidade cadastrada</p>
                    ) : (
                      especialidades.map((especialidade) => (
                        <div key={especialidade._id} className="flex items-center justify-between gap-2 py-1">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              aria-pressed={formData.especialidades.includes(especialidade._id)}
                              onClick={() => handleEspecialidadeChange(especialidade._id, !formData.especialidades.includes(especialidade._id))}
                              className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors focus:outline-none border ${formData.especialidades.includes(especialidade._id) ? 'bg-green-500 border-green-500' : 'bg-gray-300 border-gray-300'}`}
                            >
                                <span
                                  className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform duration-200 ${formData.especialidades.includes(especialidade._id) ? 'translate-x-4' : 'translate-x-1'}`}
                                />
                              </button>
                            <span className="text-sm font-medium text-gray-700">
                              {especialidade.nome}
                              {especialidade.descricao && (
                                <span className="text-gray-500 text-sm font-medium block">{especialidade.descricao}</span>
                              )}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Tem certeza que deseja excluir a especialidade \"${especialidade.nome}\"?`)) {
                                excluirEspecialidade(especialidade._id);
                              }
                            }}
                            className="text-red-500 hover:text-red-700 text-sm font-medium ml-2"
                            title="Excluir especialidade"
                          >
                            <i className="fas fa-trash-alt" aria-hidden="true" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Senha <span className="text-gray-400 text-sm font-medium">(opcional)</span></label>
                  <input
                    type="password"
                    value={formData.senha || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, senha: e.target.value }))}
                    className="block w-full h-10 border border-gray-300 rounded-md px-3 py-2 text-sm font-medium focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Definir senha para professor (mín 6)"
                  />
                </div>
                {editingId && (
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-sm font-medium text-gray-700">Professor ativo</span>
                    <button
                      type="button"
                      aria-pressed={formData.ativo}
                      onClick={() => setFormData(prev => ({ ...prev, ativo: !prev.ativo }))}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none border ${formData.ativo ? 'bg-green-500 border-green-500' : 'bg-gray-300 border-gray-300'}`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${formData.ativo ? 'translate-x-5' : 'translate-x-1'}`}
                      />
                    </button>
                  </div>
                )}
                {/* Action Buttons */}
                <div className="flex justify-end gap-3 pt-4 border-t mt-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 flex items-center gap-2"
                  >
                    <i className="fas fa-times text-black" aria-hidden="true" /> Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 flex items-center gap-2"
                  >
                    {editingId ? (
                      <>
                        <i className="fas fa-save text-white mr-2" aria-hidden="true" /> Atualizar
                      </>
                    ) : (
                      <>
                        <i className="fas fa-chalkboard-teacher text-white mr-2" aria-hidden="true" /> Cadastrar
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
    </RequireAuth>
  );
}