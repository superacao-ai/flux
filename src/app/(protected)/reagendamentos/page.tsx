'use client';

import Swal from 'sweetalert2';
import { toast } from 'react-toastify';
import { useState, useEffect } from 'react';
import ProtectedPage from '@/components/ProtectedPage';

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
  novoHorarioInicio: string;
  novoHorarioFim: string;
  status: 'pendente' | 'aprovado' | 'rejeitado';
  criadoEm: string;
  aprovadoPor?: {
    nome: string;
  };
  isReposicao?: boolean;
  alunoId?: Aluno;
  matriculaId?: {
    _id: string;
    alunoId?: Aluno;
  };
  novoHorarioFixoId?: {
    _id: string;
    professorId?: Professor;
  };
}

export default function ReagendamentosPage() {
  const [reagendamentos, setReagendamentos] = useState<Reagendamento[]>([]);
  const [horarios, setHorarios] = useState<HorarioFixo[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'todos' | 'pendente' | 'aprovado'>('todos');
  const [formData, setFormData] = useState({
    horarioFixoId: '',
    dataOriginal: '',
    novaData: ''
  });
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);

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
        toast.success('Reagendamento criado com sucesso!');
        setShowModal(false);
        setFormData({
          horarioFixoId: '',
          dataOriginal: '',
          novaData: ''
        });
        fetchReagendamentos();
      } else {
        toast.error('Erro: ' + data.error);
      }
    } catch (error) {
      console.error('Erro ao solicitar reagendamento:', error);
      toast.error('Erro ao solicitar reagendamento');
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
        toast.success('Reagendamento aprovado!');
        fetchReagendamentos();
      } else {
        toast.error('Erro ao aprovar reagendamento');
      }
    } catch (error) {
      console.error('Erro ao aprovar reagendamento:', error);
      toast.error('Erro ao aprovar reagendamento');
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
        toast.success('Reagendamento rejeitado!');
        fetchReagendamentos();
      } else {
        toast.error('Erro ao rejeitar reagendamento');
      }
    } catch (error) {
      console.error('Erro ao rejeitar reagendamento:', error);
      toast.error('Erro ao rejeitar reagendamento');
    }
  };

  const voltarParaPendente = async (id: string) => {
    try {
      const response = await fetch(`/api/reagendamentos/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'pendente' }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Reagendamento voltou para pendente!');
        fetchReagendamentos();
      } else {
        toast.error('Erro ao alterar status do reagendamento');
      }
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      toast.error('Erro ao alterar status do reagendamento');
    }
  };

  const excluirReagendamento = async (id: string) => {
    const result = await Swal.fire({
      title: 'Confirmar Exclusão',
      text: 'Tem certeza que deseja excluir este reagendamento?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sim, excluir',
      cancelButtonText: 'Cancelar'
    });
    if (!result.isConfirmed) {
      return;
    }
    
    try {
      const response = await fetch(`/api/reagendamentos/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Reagendamento excluído!');
        fetchReagendamentos();
      } else {
        toast.error('Erro ao excluir reagendamento: ' + (data.error || ''));
      }
    } catch (error) {
      console.error('Erro ao excluir reagendamento:', error);
      toast.error('Erro ao excluir reagendamento');
    }
  };

  const limparHistorico = async () => {
    setClearing(true);
    try {
      const response = await fetch('/api/reagendamentos/limpar/historico', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Histórico de reagendamentos limpo com sucesso!');
        fetchReagendamentos();
        setShowClearModal(false);
      } else {
        toast.error('Erro ao limpar histórico: ' + data.error);
      }
    } catch (error) {
      console.error('Erro ao limpar histórico:', error);
      toast.error('Erro ao limpar histórico');
    } finally {
      setClearing(false);
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
    <ProtectedPage tab="reagendamentos" title="Reagendamentos - Superação Flux" fullWidth>
      <div className="px-4 py-6 sm:px-0">
        <div className="sm:flex sm:items-center mb-6 fade-in-1">
          <div className="sm:flex-auto">
            <h1 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <i className="fas fa-exchange-alt text-primary-600"></i>
              Reagendamentos
            </h1>
            <p className="mt-2 text-sm text-gray-700">
              Gerencie as solicitações de reagendamento de aulas.
            </p>
          </div>
          <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none flex gap-3">
            <button
              type="button"
              onClick={() => setShowClearModal(true)}
              className="inline-flex transition-colors duration-200 items-center justify-center rounded-full border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 shadow-sm hover:bg-red-100 focus:outline-none  focus:ring-offset-2 sm:w-auto"
              title="Limpar todo o histórico de reagendamentos"
            >
              <i className="fas fa-trash-alt mr-2"></i>
              Limpar Histórico
            </button>
          </div>
        </div>

        {/* Tabs para filtrar por status */}
        <div className="mb-6 fade-in-2">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button 
                onClick={() => setFilterStatus('todos')}
                className={`${filterStatus === 'todos' ? 'border-primary-500 text-primary-600 border-b-2' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 border-b-2'} whitespace-nowrap py-2 px-1 font-medium text-sm transition-colors`}>
                Todos ({reagendamentos.length})
              </button>
              <button 
                onClick={() => setFilterStatus('pendente')}
                className={`${filterStatus === 'pendente' ? 'border-primary-500 text-primary-600 border-b-2' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 border-b-2'} whitespace-nowrap py-2 px-1 font-medium text-sm transition-colors`}>
                Pendentes ({reagendamentos.filter(r => r.status === 'pendente').length})
              </button>
              <button 
                onClick={() => setFilterStatus('aprovado')}
                className={`${filterStatus === 'aprovado' ? 'border-primary-500 text-primary-600 border-b-2' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 border-b-2'} whitespace-nowrap py-2 px-1 font-medium text-sm transition-colors`}>
                Aprovados ({reagendamentos.filter(r => r.status === 'aprovado').length})
              </button>
            </nav>
          </div>
        </div>

        {/* Lista de reagendamentos */}
        <div className="bg-white shadow rounded-lg fade-in-3">
          <div className="px-4 py-5 sm:p-6">
            <div className="space-y-4">
              {reagendamentos
                .filter((r) => {
                  if (filterStatus === 'todos') return true;
                  return r.status === filterStatus;
                })
                .map((reagendamento) => {
                const isReposicao = (reagendamento as any).isReposicao === true;
                const alunoNome = isReposicao 
                  ? ((reagendamento as any).alunoId?.nome || 'Aluno')
                  : ((reagendamento as any).matriculaId?.alunoId?.nome || reagendamento.horarioFixoId?.alunoId?.nome || 'Aluno');
                
                const professorOrigem = reagendamento.horarioFixoId?.professorId?.nome || 'N/A';
                const professorDestino = (reagendamento as any).novoHorarioFixoId?.professorId?.nome || 'N/A';
                
                return (
                  <div key={reagendamento._id} className={`border rounded-lg p-5 transition-colors ${
                    reagendamento.status === 'aprovado'
                      ? 'bg-gray-100 border-gray-300'
                      : (isReposicao ? 'border-blue-300 bg-blue-50' : 'border-orange-300 bg-orange-50')
                  }`}>
                    
                    {/* Layout Desktop: Tudo em linha */}
                    <div className="flex items-center gap-6">
                      
                      {/* Coluna 1: Informações do Aluno e Tipo */}
                      <div className="flex-shrink-0 w-64">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold transition-colors ${
                            reagendamento.status === 'aprovado'
                              ? 'bg-gray-300 text-gray-700 border border-gray-400'
                              : (isReposicao 
                                ? 'bg-blue-100 text-blue-800 border border-blue-200' 
                                : 'bg-orange-100 text-orange-800 border border-orange-200')
                          }`}>
                            <i className={`fas ${isReposicao ? 'fa-redo' : 'fa-exchange-alt'} text-[9px]`}></i>
                            {isReposicao ? 'Reposição' : 'Reagendamento'}
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            reagendamento.status === 'aprovado'
                              ? 'bg-green-100 text-green-800 border border-green-200'
                              : getStatusColor(reagendamento.status)
                          }`}>
                            {reagendamento.status.charAt(0).toUpperCase() + reagendamento.status.slice(1)}
                          </span>
                        </div>
                        <p className="text-base font-bold text-gray-900 mb-1">{alunoNome}</p>
                        <p className="text-xs text-gray-500">{formatarData(reagendamento.criadoEm)}</p>
                        {reagendamento.aprovadoPor && (
                          <p className={`text-xs mt-2 transition-colors ${
                            reagendamento.status === 'aprovado'
                              ? 'text-gray-600'
                              : 'text-gray-500'
                          }`}>
                            <i className="fas fa-user-check mr-1"></i>Aprovado por: {reagendamento.aprovadoPor.nome}
                          </p>
                        )}
                      </div>

                      {/* Coluna 2: Horário Original */}
                      <div className="flex-1">
                        <div className={`bg-white rounded border p-3 transition-colors h-full ${
                          reagendamento.status === 'aprovado'
                            ? 'border-gray-300'
                            : 'border-gray-300'
                        }`}>
                          <div className="flex items-center gap-1.5 mb-2">
                            <i className={`fas fa-calendar-times transition-colors ${
                              reagendamento.status === 'aprovado'
                                ? 'text-gray-400'
                                : 'text-red-500'
                            }`}></i>
                            <span className={`font-semibold text-sm transition-colors ${
                              reagendamento.status === 'aprovado'
                                ? 'text-gray-600'
                                : 'text-gray-700'
                            }`}>Horário Original</span>
                          </div>
                          <div className="space-y-1 text-sm transition-colors">
                            <p className={reagendamento.status === 'aprovado' ? 'text-gray-500' : 'text-gray-700'}>
                              <i className="fas fa-calendar-day w-4 text-gray-400"></i> {formatarData(reagendamento.dataOriginal)}
                            </p>
                            <p className={reagendamento.status === 'aprovado' ? 'text-gray-500' : 'text-gray-700'}>
                              <i className="fas fa-clock w-4 text-gray-400"></i> {reagendamento.horarioFixoId?.horarioInicio} - {reagendamento.horarioFixoId?.horarioFim}
                            </p>
                            <p className={reagendamento.status === 'aprovado' ? 'text-gray-500' : 'text-gray-700'}>
                              <i className="fas fa-user w-4 text-gray-400"></i> {professorOrigem}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Seta */}
                      <div className="flex-shrink-0">
                        <i className={`fas fa-arrow-right text-2xl transition-colors ${
                          reagendamento.status === 'aprovado'
                            ? 'text-gray-300'
                            : 'text-gray-400'
                        }`}></i>
                      </div>

                      {/* Coluna 3: Novo Horário */}
                      <div className="flex-1">
                        <div className={`bg-white rounded p-3 transition-colors h-full ${
                          reagendamento.status === 'aprovado'
                            ? 'border-gray-300 border-2'
                            : 'border-2 border-green-400'
                        }`}>
                          <div className="flex items-center gap-1.5 mb-2">
                            <i className={`fas fa-calendar-check transition-colors ${
                              reagendamento.status === 'aprovado'
                                ? 'text-gray-400'
                                : 'text-green-500'
                            }`}></i>
                            <span className={`font-semibold text-sm transition-colors ${
                              reagendamento.status === 'aprovado'
                                ? 'text-gray-600'
                                : 'text-gray-700'
                            }`}>Novo Horário</span>
                          </div>
                          <div className="space-y-1 text-sm transition-colors">
                            <p className={reagendamento.status === 'aprovado' ? 'text-gray-500' : 'text-gray-700'}>
                              <i className="fas fa-calendar-day w-4 text-gray-400"></i> {formatarData(reagendamento.novaData)}
                            </p>
                            <p className={reagendamento.status === 'aprovado' ? 'text-gray-500' : 'text-gray-700'}>
                              <i className="fas fa-clock w-4 text-gray-400"></i> {reagendamento.novoHorarioInicio} - {reagendamento.novoHorarioFim}
                            </p>
                            <p className={reagendamento.status === 'aprovado' ? 'text-gray-500' : 'text-gray-700'}>
                              <i className="fas fa-user w-4 text-gray-400"></i> {professorDestino}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Coluna 4: Botões de Ação */}
                      <div className="flex-shrink-0 flex flex-col gap-2 min-w-[120px]">
                      {reagendamento.status === 'pendente' && (
                        <>
                          <button
                            onClick={() => aprovarReagendamento(reagendamento._id)}
                            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded text-sm font-medium transition-colors w-full"
                          >
                            <i className="fas fa-check mr-1"></i>Aprovar
                          </button>
                          <button
                            onClick={() => rejeitarReagendamento(reagendamento._id)}
                            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded text-sm font-medium transition-colors w-full"
                          >
                            <i className="fas fa-times mr-1"></i>Rejeitar
                          </button>
                          <button
                            onClick={() => excluirReagendamento(reagendamento._id)}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded text-sm font-medium border border-gray-300 transition-colors w-full"
                          >
                            <i className="fas fa-trash mr-1"></i>Excluir
                          </button>
                        </>
                      )}
                    
                      {reagendamento.status === 'aprovado' && (
                        <>
                          <button
                            onClick={() => voltarParaPendente(reagendamento._id)}
                            className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded text-sm font-medium transition-colors w-full"
                          >
                            <i className="fas fa-undo mr-1"></i>Desaprovar
                          </button>
                          <button
                            onClick={() => excluirReagendamento(reagendamento._id)}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded text-sm font-medium border border-gray-300 transition-colors w-full"
                          >
                            <i className="fas fa-trash mr-1"></i>Excluir
                          </button>
                        </>
                      )}
                    
                      {reagendamento.status === 'rejeitado' && (
                        <>
                          <button
                            onClick={() => voltarParaPendente(reagendamento._id)}
                            className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded text-sm font-medium transition-colors w-full"
                          >
                            <i className="fas fa-undo mr-1"></i>Voltar
                          </button>
                          <button
                            onClick={() => excluirReagendamento(reagendamento._id)}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded text-sm font-medium border border-gray-300 transition-colors w-full"
                          >
                            <i className="fas fa-trash mr-1"></i>Excluir
                          </button>
                        </>
                      )}
                      </div>
                    </div>
                  </div>
                );
              })}
              
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
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white fade-in-4">
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

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-full text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 border border-transparent rounded-full shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                  >
                    {loading ? 'Salvando...' : 'Solicitar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmação para limpar histórico */}
      {showClearModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="relative mx-auto p-6 border w-96 shadow-lg rounded-md bg-white">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <i className="fas fa-exclamation-triangle text-red-600 text-lg"></i>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Limpar Histórico de Reagendamentos</h3>
              <p className="text-sm text-gray-500 mb-6">
                Tem certeza de que deseja limpar todo o histórico de reagendamentos? Esta ação <strong>não pode ser desfeita</strong>.
              </p>
              
              <div className="space-y-2 mb-6 text-left bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-800">
                  <i className="fas fa-info-circle mr-2"></i>
                  Todos os reagendamentos (pendentes, aprovados e rejeitados) serão removidos do sistema.
                </p>
              </div>

              <div className="flex justify-center space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowClearModal(false)}
                  disabled={clearing}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={limparHistorico}
                  disabled={clearing}
                  className="px-4 py-2 transition-colors duration-200 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 flex items-center gap-2"
                >
                  {clearing ? (
                    <>
                      <i className="fas fa-spinner fa-spin"></i>
                      Limpando...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-trash-alt"></i>
                      Limpar Histórico
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </ProtectedPage>
  );
}