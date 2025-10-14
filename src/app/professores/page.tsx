'use client';

import { useState, useEffect, useCallback } from 'react';
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
  ativo: boolean;
  criadoEm?: string;
  atualizadoEm?: string;
}

interface ProfessorForm {
  nome: string;
  email: string;
  telefone: string;
  especialidades: string[];
  ativo: boolean;
}

export default function ProfessoresPage() {
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [especialidades, setEspecialidades] = useState<Especialidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ProfessorForm>({
    nome: '',
    email: '',
    telefone: '',
    especialidades: [],
    ativo: true
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
        alert('Especialidade criada com sucesso!');
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
        alert('Especialidade excluída com sucesso!');
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
      ativo: true
    });
    setShowModal(true);
  };

  // Abrir modal para editar professor
  const abrirModalEditar = (professor: Professor) => {
    setEditingId(professor._id);
    setFormData({
      nome: professor.nome,
      email: professor.email || '',
      telefone: professor.telefone || '',
      especialidades: professor.especialidades?.map(esp => esp._id) || [],
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
        await carregarProfessores();
        setShowModal(false);
        alert(data.message || 'Professor salvo com sucesso!');
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
        alert(data.message || 'Professor excluído com sucesso!');
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
      <Layout title="Professores - Superação Flux">
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-500">Carregando professores...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Professores - Superação Flux">
      <div className="px-4 py-6 sm:px-0">
        <div className="sm:flex sm:items-center">
          <div className="sm:flex-auto">
            <h1 className="text-xl font-semibold text-gray-900">Professores</h1>
            <p className="mt-2 text-sm text-gray-700">
              Gerencie a equipe de professores do studio.
            </p>
          </div>
          <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
            <button
              type="button"
              onClick={abrirModalNovo}
              className="inline-flex items-center justify-center rounded-md border border-transparent bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 sm:w-auto"
            >
              👨‍🏫 Novo Professor
            </button>
          </div>
        </div>

        {professores.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">👨‍🏫</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum professor cadastrado</h3>
            <p className="text-gray-500 mb-6">
              Comece cadastrando o primeiro professor do studio.
            </p>
            <button
              onClick={abrirModalNovo}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              👨‍🏫 Cadastrar Primeiro Professor
            </button>
          </div>
        ) : (
          <div className="mt-8 flex flex-col">
            <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
              <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
                <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                  <table className="min-w-full divide-y divide-gray-300">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                          Nome
                        </th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                          Email
                        </th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                          Telefone
                        </th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                          Especialidades
                        </th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                          Status
                        </th>
                        <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                          <span className="sr-only">Ações</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {professores.map((professor) => (
                        <tr key={professor._id}>
                          <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                            {professor.nome}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {professor.email || <span className="text-gray-400 italic">Não informado</span>}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {professor.telefone || <span className="text-gray-400 italic">Não informado</span>}
                          </td>
                          <td className="px-3 py-4 text-sm text-gray-500">
                            <div className="flex flex-wrap gap-1">
                              {professor.especialidades?.map((esp) => (
                                <span 
                                  key={esp._id}
                                  className="inline-flex rounded-full bg-blue-100 px-2 text-xs font-semibold leading-5 text-blue-800"
                                >
                                  {esp.nome}
                                </span>
                              ))}
                              {(!professor.especialidades || professor.especialidades.length === 0) && (
                                <span className="text-gray-400 italic">Nenhuma</span>
                              )}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                              professor.ativo 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {professor.ativo ? 'Ativo' : 'Inativo'}
                            </span>
                          </td>
                          <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                            <button 
                              onClick={() => abrirModalEditar(professor)}
                              className="text-primary-600 hover:text-primary-900 mr-4"
                            >
                              ✏️ Editar
                            </button>
                            <button 
                              onClick={() => excluirProfessor(professor._id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              🗑️ Excluir
                            </button>
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

        {/* Modal de Cadastro/Edição */}
        {showModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-[600px] shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  {editingId ? '✏️ Editar Professor' : '👨‍🏫 Novo Professor'}
                </h3>
                
                <form 
                  className="space-y-4" 
                  noValidate
                  onSubmit={(e) => {
                    e.preventDefault();
                    salvarProfessor();
                  }}
                >
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nome *
                      </label>
                      <input
                        type="text"
                        value={formData.nome}
                        onChange={handleNomeChange}
                        className="block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                        placeholder="Nome completo"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email <span className="text-gray-400 text-xs">(opcional)</span>
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={handleEmailChange}
                        className="block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                        placeholder="email@exemplo.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Telefone <span className="text-gray-400 text-xs">(opcional)</span>
                    </label>
                    <input
                      type="tel"
                      value={formData.telefone}
                      onChange={handleTelefoneChange}
                      className="block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      placeholder="(11) 99999-9999"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Especialidades
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const nome = prompt('Nome da nova especialidade:');
                          if (nome) {
                            criarEspecialidade(nome);
                          }
                        }}
                        className="text-sm bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded"
                      >
                        + Adicionar
                      </button>
                    </div>
                    <div className="space-y-2 max-h-32 overflow-y-auto border border-gray-200 rounded-md p-2">
                      {especialidades.length === 0 ? (
                        <p className="text-gray-500 text-sm italic text-center py-2">
                          Nenhuma especialidade cadastrada
                        </p>
                      ) : (
                        especialidades.map((especialidade) => (
                        <div key={especialidade._id} className="flex items-center justify-between">
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={formData.especialidades.includes(especialidade._id)}
                              onChange={(e) => handleEspecialidadeChange(especialidade._id, e.target.checked)}
                              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                            />
                            <span className="ml-2 text-sm text-gray-700">
                              {especialidade.nome}
                              {especialidade.descricao && (
                                <span className="text-gray-500 text-xs block">{especialidade.descricao}</span>
                              )}
                            </span>
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Tem certeza que deseja excluir a especialidade "${especialidade.nome}"?`)) {
                                excluirEspecialidade(especialidade._id);
                              }
                            }}
                            className="text-red-500 hover:text-red-700 text-xs ml-2"
                            title="Excluir especialidade"
                          >
                            🗑️
                          </button>
                        </div>
                        ))
                      )}
                    </div>
                  </div>

                  {editingId && (
                    <div>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.ativo}
                          onChange={handleAtivoChange}
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">Professor ativo</span>
                      </label>
                    </div>
                  )}

                  <div className="flex justify-end space-x-3 pt-4 border-t">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                    >
                      {editingId ? '💾 Atualizar' : '👨‍🏫 Cadastrar'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}