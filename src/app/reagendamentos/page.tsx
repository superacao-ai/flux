'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';

interface Aluno {
  _id: string;
  nome: string;
  email: string;
}

interface Professor {
  _id: string;
  nome: string;
  especialidade: string;
}

interface HorarioFixo {
  _id: string;
  alunoId: Aluno;
  professorId: Professor;
  diaSemana: number;
  horarioInicio: string;
  horarioFim: string;
  observacoes?: string;
  ativo: boolean;
}

interface Reagendamento {
  _id: string;
  horarioFixoId: HorarioFixo;
  dataOriginal: string;
  novaData: string;
  motivo: string;
  status: 'pendente' | 'aprovado' | 'rejeitado';
  criadoEm: string;
  aprovadoPor?: {
    nome: string;
  };
}

export default function ReagendamentosPage() {
  const [reagendamentos, setReagendamentos] = useState<Reagendamento[]>([]);
  const [horarios, setHorarios] = useState<HorarioFixo[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    horarioFixoId: '',
    dataOriginal: '',
    novaData: '',
    motivo: ''
  });
  const [loading, setLoading] = useState(false);

  const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

  useEffect(() => {
    fetchReagendamentos();
    fetchHorarios();
  }, []);

  const fetchReagendamentos = async () => {
    try {
      const response = await fetch('/api/reagendamentos');
      const data = await response.json();
      if (data.success) {
        setReagendamentos(data.data);
      }
    } catch (error) {
      console.error('Erro ao buscar reagendamentos:', error);
    }
  };

  const fetchHorarios = async () => {
    try {
      const response = await fetch('/api/horarios');
      const data = await response.json();
      if (data.success) {
        setHorarios(data.data);
      }
    } catch (error) {
      console.error('Erro ao buscar horários:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/reagendamentos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        alert('Reagendamento solicitado com sucesso!');
        setShowModal(false);
        setFormData({
          horarioFixoId: '',
          dataOriginal: '',
          novaData: '',
          motivo: ''
        });
        fetchReagendamentos();
      } else {
        alert('Erro: ' + data.error);
      }
    } catch (error) {
      console.error('Erro ao solicitar reagendamento:', error);
      alert('Erro ao solicitar reagendamento');
    } finally {
      setLoading(false);
    }
  };

  const aprovarReagendamento = async (id: string) => {
    try {
      const response = await fetch(`/api/reagendamentos/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'aprovado' }),
      });

      const data = await response.json();
      if (data.success) {
        alert('Reagendamento aprovado!');
        fetchReagendamentos();
      } else {
        alert('Erro ao aprovar reagendamento');
      }
    } catch (error) {
      console.error('Erro ao aprovar reagendamento:', error);
      alert('Erro ao aprovar reagendamento');
    }
  };

  const rejeitarReagendamento = async (id: string) => {
    try {
      const response = await fetch(`/api/reagendamentos/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'rejeitado' }),
      });

      const data = await response.json();
      if (data.success) {
        alert('Reagendamento rejeitado!');
        fetchReagendamentos();
      } else {
        alert('Erro ao rejeitar reagendamento');
      }
    } catch (error) {
      console.error('Erro ao rejeitar reagendamento:', error);
      alert('Erro ao rejeitar reagendamento');
    }
  };

  const formatarData = (dataStr: string) => {
    const data = new Date(dataStr);
    return data.toLocaleDateString('pt-BR');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pendente': return 'bg-yellow-100 text-yellow-800';
      case 'aprovado': return 'bg-green-100 text-green-800';
      case 'rejeitado': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Layout title="Reagendamentos - Superação Flux">
      <div className="px-4 py-6 sm:px-0">
        <div className="sm:flex sm:items-center mb-6">
          <div className="sm:flex-auto">
            <h1 className="text-xl font-semibold text-gray-900">Reagendamentos</h1>
            <p className="mt-2 text-sm text-gray-700">
              Gerencie as solicitações de reagendamento de aulas.
            </p>
          </div>
          <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="inline-flex items-center justify-center rounded-md border border-transparent bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 sm:w-auto"
            >
              Novo Reagendamento
            </button>
          </div>
        </div>

        {/* Tabs para filtrar por status */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <a href="#" className="border-primary-500 text-primary-600 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm">
                Todos ({reagendamentos.length})
              </a>
              <a href="#" className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm">
                Pendentes ({reagendamentos.filter(r => r.status === 'pendente').length})
              </a>
              <a href="#" className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm">
                Aprovados ({reagendamentos.filter(r => r.status === 'aprovado').length})
              </a>
            </nav>
          </div>
        </div>

        {/* Lista de reagendamentos */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="space-y-4">
              {reagendamentos.map((reagendamento) => (
                <div key={reagendamento._id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <h3 className="text-lg font-medium text-gray-900">
                          {reagendamento.horarioFixoId?.alunoId?.nome}
                        </h3>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(reagendamento.status)}`}>
                          {reagendamento.status.charAt(0).toUpperCase() + reagendamento.status.slice(1)}
                        </span>
                      </div>
                      
                      <div className="mt-2 text-sm text-gray-600">
                        <p><strong>Professor:</strong> {reagendamento.horarioFixoId?.professorId?.nome}</p>
                        <p><strong>Horário fixo:</strong> {diasSemana[reagendamento.horarioFixoId?.diaSemana]} às {reagendamento.horarioFixoId?.horarioInicio}</p>
                        <p><strong>Data original:</strong> {formatarData(reagendamento.dataOriginal)}</p>
                        <p><strong>Nova data:</strong> {formatarData(reagendamento.novaData)}</p>
                        <p><strong>Motivo:</strong> {reagendamento.motivo}</p>
                        <p className="text-xs text-gray-400 mt-2">
                          Solicitado em: {formatarData(reagendamento.criadoEm)}
                        </p>
                        {reagendamento.aprovadoPor && (
                          <p className="text-xs text-gray-400">
                            Aprovado por: {reagendamento.aprovadoPor.nome}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {reagendamento.status === 'pendente' && (
                      <div className="flex space-x-2 ml-4">
                        <button
                          onClick={() => aprovarReagendamento(reagendamento._id)}
                          className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm font-medium"
                        >
                          Aprovar
                        </button>
                        <button
                          onClick={() => rejeitarReagendamento(reagendamento._id)}
                          className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm font-medium"
                        >
                          Rejeitar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {reagendamentos.length === 0 && (
                <div className="text-center text-gray-500 py-8">
                  Nenhum reagendamento encontrado.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal para novo reagendamento */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Solicitar Reagendamento</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Horário Fixo</label>
                  <select
                    value={formData.horarioFixoId}
                    onChange={(e) => setFormData({...formData, horarioFixoId: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    required
                  >
                    <option value="">Selecione um horário</option>
                    {horarios.map((horario) => (
                      <option key={horario._id} value={horario._id}>
                        {horario.alunoId?.nome} - {diasSemana[horario.diaSemana]} às {horario.horarioInicio} com {horario.professorId?.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Data Original (que ficou em haver)</label>
                  <input
                    type="date"
                    value={formData.dataOriginal}
                    onChange={(e) => setFormData({...formData, dataOriginal: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Nova Data</label>
                  <input
                    type="date"
                    value={formData.novaData}
                    onChange={(e) => setFormData({...formData, novaData: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Motivo</label>
                  <textarea
                    value={formData.motivo}
                    onChange={(e) => setFormData({...formData, motivo: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    rows={3}
                    placeholder="Descreva o motivo do reagendamento..."
                    required
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                  >
                    {loading ? 'Salvando...' : 'Solicitar'}
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