'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';

interface HorarioDisponivel {
  diasSemana: number[];
  horaInicio: string;
  horaFim: string;
}

interface Modalidade {
  _id: string;
  nome: string;
  descricao?: string;
  cor: string;
  duracao: number;
  limiteAlunos: number;
  horariosDisponiveis: HorarioDisponivel[];
  ativo: boolean;
}

export default function ModalidadesPage() {
  const [modalidades, setModalidades] = useState<Modalidade[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingModalidade, setEditingModalidade] = useState<Modalidade | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    cor: '#3B82F6',
    duracao: 60,
    limiteAlunos: 5
  });
  const [loading, setLoading] = useState(false);

  // Cores predefinidas para as modalidades
  const coresPredefinidas = [
    '#3B82F6', // Blue
    '#10B981', // Emerald
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#8B5CF6', // Violet
    '#06B6D4', // Cyan
    '#84CC16', // Lime
    '#F97316', // Orange
    '#EC4899', // Pink
    '#6366F1'  // Indigo
  ];

  useEffect(() => {
    fetchModalidades();
  }, []);

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
    setLoading(true);

    try {
      const url = editingModalidade 
        ? `/api/modalidades/${editingModalidade._id}` 
        : '/api/modalidades';
      const method = editingModalidade ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        alert(editingModalidade ? 'Modalidade atualizada com sucesso!' : 'Modalidade criada com sucesso!');
        setShowModal(false);
        setEditingModalidade(null);
        setFormData({
          nome: '',
          descricao: '',
          cor: '#3B82F6',
          duracao: 60,
          limiteAlunos: 5
        });
        fetchModalidades();
      } else {
        alert('Erro: ' + data.error);
      }
    } catch (error) {
      console.error('Erro ao salvar modalidade:', error);
      alert('Erro ao salvar modalidade');
    } finally {
      setLoading(false);
    }
  };

  const editModalidade = (modalidade: Modalidade) => {
    setEditingModalidade(modalidade);
    setFormData({
      nome: modalidade.nome,
      descricao: modalidade.descricao || '',
      cor: modalidade.cor,
      duracao: modalidade.duracao,
      limiteAlunos: modalidade.limiteAlunos
    });
    setShowModal(true);
  };

  const deleteModalidade = async (id: string) => {
    if (confirm('Tem certeza que deseja desativar esta modalidade?')) {
      try {
        const response = await fetch(`/api/modalidades/${id}`, {
          method: 'DELETE',
        });

        const data = await response.json();
        if (data.success) {
          alert('Modalidade desativada com sucesso!');
          fetchModalidades();
        } else {
          alert('Erro ao desativar modalidade');
        }
      } catch (error) {
        console.error('Erro ao desativar modalidade:', error);
        alert('Erro ao desativar modalidade');
      }
    }
  };

  const getDiasSemanaNomes = (dias: number[]) => {
    const nomes = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    return dias.map(dia => nomes[dia]).join(', ');
  };

  return (
    <Layout title="Modalidades - Superação Flux">
      <div className="px-4 py-6 sm:px-0">
        <div className="sm:flex sm:items-center mb-6">
          <div className="sm:flex-auto">
            <h1 className="text-xl font-semibold text-gray-900">Modalidades</h1>
            <p className="mt-2 text-sm text-gray-700">
              Gerencie as modalidades disponíveis no seu studio.
            </p>
          </div>
          <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="inline-flex items-center justify-center rounded-md border border-transparent bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 sm:w-auto"
            >
              Nova Modalidade
            </button>
          </div>
        </div>

        {/* Grid de modalidades */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {modalidades.map((modalidade) => (
            <div key={modalidade._id} className="bg-white rounded-lg shadow border border-gray-200 p-6">
              <div className="flex items-center">
                <div
                  className="w-4 h-4 rounded-full mr-3"
                  style={{ backgroundColor: modalidade.cor }}
                ></div>
                <h3 className="text-lg font-medium text-gray-900">{modalidade.nome}</h3>
              </div>
              
              {modalidade.descricao && (
                <p className="mt-2 text-sm text-gray-600">{modalidade.descricao}</p>
              )}
              
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Duração:</span>
                  <span className="font-medium">{modalidade.duracao} min</span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Limite de alunos:</span>
                  <span className="font-medium">{modalidade.limiteAlunos} alunos</span>
                </div>
                
                {modalidade.horariosDisponiveis && modalidade.horariosDisponiveis.length > 0 && (
                  <div className="mt-3">
                    <span className="text-gray-500 text-sm block mb-2">Horários disponíveis:</span>
                    <div className="space-y-1">
                      {modalidade.horariosDisponiveis.map((horario, index) => (
                        <div key={index} className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                          {getDiasSemanaNomes(horario.diasSemana)}: {horario.horaInicio} às {horario.horaFim}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="mt-4 flex justify-end space-x-2">
                <button 
                  onClick={() => editModalidade(modalidade)}
                  className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                >
                  Editar
                </button>
                <button 
                  onClick={() => deleteModalidade(modalidade._id)}
                  className="text-red-600 hover:text-red-900 text-sm font-medium"
                >
                  Desativar
                </button>
              </div>
            </div>
          ))}
          
          {modalidades.length === 0 && (
            <div className="col-span-full text-center text-gray-500 py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhuma modalidade</h3>
              <p className="mt-1 text-sm text-gray-500">Comece criando sua primeira modalidade.</p>
              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  Nova Modalidade
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal para nova modalidade */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingModalidade ? 'Editar Modalidade' : 'Nova Modalidade'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nome *</label>
                  <input
                    type="text"
                    value={formData.nome}
                    onChange={(e) => setFormData({...formData, nome: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Ex: Natação, Treino, Hidroginástica..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Descrição</label>
                  <textarea
                    value={formData.descricao}
                    onChange={(e) => setFormData({...formData, descricao: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    rows={2}
                    placeholder="Descrição da modalidade..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Cor</label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {coresPredefinidas.map((cor) => (
                      <button
                        key={cor}
                        type="button"
                        onClick={() => setFormData({...formData, cor})}
                        className={`w-8 h-8 rounded-full border-2 ${
                          formData.cor === cor ? 'border-gray-800' : 'border-gray-300'
                        }`}
                        style={{ backgroundColor: cor }}
                      />
                    ))}
                  </div>
                  <input
                    type="color"
                    value={formData.cor}
                    onChange={(e) => setFormData({...formData, cor: e.target.value})}
                    className="mt-2 h-10 w-20 border border-gray-300 rounded cursor-pointer"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Duração (min)</label>
                    <input
                      type="number"
                      value={formData.duracao}
                      onChange={(e) => setFormData({...formData, duracao: parseInt(e.target.value) || 60})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      min="15"
                      max="180"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Limite de Alunos</label>
                    <input
                      type="number"
                      value={formData.limiteAlunos}
                      onChange={(e) => setFormData({...formData, limiteAlunos: parseInt(e.target.value) || 5})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      min="1"
                      max="20"
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingModalidade(null);
                      setFormData({
                        nome: '',
                        descricao: '',
                        cor: '#3B82F6',
                        duracao: 60,
                        limiteAlunos: 5
                      });
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                  >
                    {loading ? (editingModalidade ? 'Atualizando...' : 'Criando...') : (editingModalidade ? 'Atualizar' : 'Criar')}
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