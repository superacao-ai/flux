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
  solicitadoPor?: 'aluno' | 'admin';
}

export default function ReagendamentosPage() {
  const [mounted, setMounted] = useState(false);
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
  const [initialLoading, setInitialLoading] = useState(true);

  const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

  // Marcar como montado imediatamente
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch data
  useEffect(() => {
    fetchReagendamentos();
    fetchHorarios();
  }, []);

  const fetchReagendamentos = async () => {
    try {
      const response = await fetch('/api/reagendamentos');
      const data = await response.json();
      if (data.success) {
        console.log('[Reagendamentos] Dados recebidos:', data.data.map((r: any) => ({
          _id: r._id,
          horarioFixoId: r.horarioFixoId,
          professorOrigem: r.horarioFixoId?.professorId,
          novoHorarioFixoId: r.novoHorarioFixoId,
          professorDestino: r.novoHorarioFixoId?.professorId
        })));
        setReagendamentos(data.data);
      }
    } catch (error) {
      console.error('Erro ao buscar reagendamentos:', error);
    } finally {
      setInitialLoading(false);
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

  // Skeleton loading enquanto não está montado ou carregando dados iniciais
  if (!mounted || initialLoading) {
    return (
      <ProtectedPage tab="reagendamentos" title="Reagendamentos - Superação Flux" fullWidth customLoading>
        <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
          {/* Header skeleton - Desktop */}
          <div className="hidden md:flex items-center justify-between gap-4 mb-6">
            <div>
              <div className="h-6 bg-gray-200 rounded w-40 mb-2 animate-pulse" />
              <div className="h-4 bg-gray-200 rounded w-72 animate-pulse" />
            </div>
            <div className="h-10 w-40 bg-gray-200 rounded-full animate-pulse" />
          </div>
          
          {/* Header skeleton - Mobile */}
          <div className="md:hidden flex items-center justify-between mb-4">
            <div className="h-5 bg-gray-200 rounded w-32 animate-pulse" />
            <div className="w-9 h-9 bg-gray-200 rounded-full animate-pulse" />
          </div>
          
          {/* Tabs skeleton - Desktop */}
          <div className="hidden md:block mb-6 border-b border-gray-200 pb-2">
            <div className="flex gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-6 bg-gray-200 rounded w-24 animate-pulse" />
              ))}
            </div>
          </div>
          
          {/* Tabs skeleton - Mobile */}
          <div className="md:hidden mb-4">
            <div className="flex gap-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex-1 h-9 bg-gray-200 rounded-lg animate-pulse" />
              ))}
            </div>
          </div>
          
          {/* Cards skeleton - Desktop */}
          <div className="hidden md:block space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center gap-6">
                  <div className="w-64 space-y-2">
                    <div className="flex gap-2">
                      <div className="h-5 bg-gray-200 rounded w-20 animate-pulse" />
                      <div className="h-5 bg-gray-200 rounded-full w-16 animate-pulse" />
                    </div>
                    <div className="h-5 bg-gray-200 rounded w-32 animate-pulse" />
                    <div className="h-3 bg-gray-100 rounded w-24 animate-pulse" />
                  </div>
                  <div className="flex-1 grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded p-3 space-y-2">
                      <div className="h-3 bg-gray-200 rounded w-16 animate-pulse" />
                      <div className="h-4 bg-gray-200 rounded w-24 animate-pulse" />
                    </div>
                    <div className="bg-gray-50 rounded p-3 space-y-2">
                      <div className="h-3 bg-gray-200 rounded w-16 animate-pulse" />
                      <div className="h-4 bg-gray-200 rounded w-24 animate-pulse" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="w-9 h-9 bg-gray-200 rounded-lg animate-pulse" />
                    <div className="w-9 h-9 bg-gray-200 rounded-lg animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Cards skeleton - Mobile */}
          <div className="md:hidden space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-3 animate-pulse">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="h-4 bg-gray-200 rounded w-28 mb-1" />
                    <div className="h-3 bg-gray-100 rounded w-20" />
                  </div>
                  <div className="flex gap-1">
                    <div className="h-5 bg-gray-200 rounded w-10" />
                    <div className="h-5 bg-gray-200 rounded-full w-12" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5 mb-2">
                  <div className="bg-gray-50 rounded p-2 text-center">
                    <div className="h-2 bg-gray-200 rounded w-6 mx-auto mb-1" />
                    <div className="h-3 bg-gray-200 rounded w-16 mx-auto mb-1" />
                    <div className="h-2 bg-gray-100 rounded w-10 mx-auto" />
                  </div>
                  <div className="bg-gray-50 rounded p-2 text-center">
                    <div className="h-2 bg-gray-200 rounded w-8 mx-auto mb-1" />
                    <div className="h-3 bg-gray-200 rounded w-16 mx-auto mb-1" />
                    <div className="h-2 bg-gray-100 rounded w-10 mx-auto" />
                  </div>
                </div>
                <div className="flex justify-end gap-1 pt-2 border-t border-gray-100">
                  <div className="w-8 h-8 bg-gray-200 rounded-lg" />
                  <div className="w-8 h-8 bg-gray-200 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </ProtectedPage>
    );
  }

  return (
    <ProtectedPage tab="reagendamentos" title="Reagendamentos - Superação Flux" fullWidth>
      <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
        {/* Header Desktop */}
        <div className="hidden md:flex items-center justify-between gap-4 mb-6 fade-in-1">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <i className="fas fa-exchange-alt text-green-600"></i>
              Reagendamentos
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Gerencie as solicitações de reagendamento de aulas
            </p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setShowClearModal(true)}
              className="inline-flex transition-colors duration-200 items-center justify-center rounded-full border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 shadow-sm hover:bg-red-100 focus:outline-none focus:ring-offset-2 sm:w-auto"
              title="Limpar todo o histórico de reagendamentos"
            >
              <i className="fas fa-trash-alt mr-2"></i>
              Limpar Histórico
            </button>
          </div>
        </div>

        {/* Header Mobile */}
        <div className="md:hidden flex items-center justify-between mb-4 fade-in-1">
          <h1 className="text-lg font-semibold text-gray-900">Reagendamentos</h1>
          <button
            type="button"
            onClick={() => setShowClearModal(true)}
            className="w-9 h-9 flex items-center justify-center rounded-full border border-red-300 bg-red-50 text-red-600"
          >
            <i className="fas fa-trash-alt text-sm"></i>
          </button>
        </div>

        {/* Tabs Mobile */}
        <div className="md:hidden mb-4 fade-in-2">
          <div className="flex gap-2">
            <button 
              onClick={() => setFilterStatus('todos')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors ${
                filterStatus === 'todos' 
                  ? 'bg-green-600 text-white' 
                  : 'bg-gray-100 text-gray-600'
              }`}>
              Todos ({reagendamentos.length})
            </button>
            <button 
              onClick={() => setFilterStatus('pendente')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors ${
                filterStatus === 'pendente' 
                  ? 'bg-yellow-500 text-white' 
                  : 'bg-gray-100 text-gray-600'
              }`}>
              Pend. ({reagendamentos.filter(r => r.status === 'pendente').length})
            </button>
            <button 
              onClick={() => setFilterStatus('aprovado')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors ${
                filterStatus === 'aprovado' 
                  ? 'bg-green-500 text-white' 
                  : 'bg-gray-100 text-gray-600'
              }`}>
              Aprov. ({reagendamentos.filter(r => r.status === 'aprovado').length})
            </button>
          </div>
        </div>

        {/* Tabs Desktop */}
        <div className="hidden md:block mb-6 fade-in-2">
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
        <div className="md:bg-white md:shadow md:rounded-lg fade-in-3">
          <div className="md:px-4 md:py-5 md:p-6">
            <div className="space-y-3 md:space-y-4">
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
                  <div key={reagendamento._id} className={`border rounded-xl md:rounded-lg shadow-sm md:shadow-none p-3 md:p-5 transition-colors ${
                    reagendamento.status === 'aprovado'
                      ? 'bg-white md:bg-gray-100 border-gray-200 md:border-gray-300'
                      : (isReposicao ? 'border-blue-200 md:border-blue-300 bg-white md:bg-blue-50' : 'border-orange-200 md:border-orange-300 bg-white md:bg-orange-50')
                  }`}>
                    
                    {/* Layout Mobile: Cards compactos */}
                    <div className="block lg:hidden">
                      {/* Header com nome e badges */}
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-900 truncate">{alunoNome}</p>
                          <p className="text-[10px] text-gray-500">{formatarData(reagendamento.criadoEm)}</p>
                          {/* Quem solicitou */}
                          <p className={`text-[10px] mt-0.5 ${
                            reagendamento.solicitadoPor === 'aluno' 
                              ? 'text-purple-600' 
                              : 'text-gray-500'
                          }`}>
                            <i className={`fas ${reagendamento.solicitadoPor === 'aluno' ? 'fa-user-graduate' : 'fa-user-shield'} mr-0.5`}></i>
                            {reagendamento.solicitadoPor === 'aluno' ? 'Pelo aluno' : 'Pela administração'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            reagendamento.status === 'aprovado'
                              ? 'bg-gray-200 text-gray-600'
                              : (isReposicao 
                                ? 'bg-blue-100 text-blue-700' 
                                : 'bg-orange-100 text-orange-700')
                          }`}>
                            {isReposicao ? 'REP' : 'REA'}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                            reagendamento.status === 'aprovado'
                              ? 'bg-green-100 text-green-700'
                              : reagendamento.status === 'pendente'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {reagendamento.status === 'pendente' ? 'PEND' : reagendamento.status === 'aprovado' ? 'APROV' : 'REJ'}
                          </span>
                        </div>
                      </div>

                      {/* Cards de horários compactos */}
                      <div className="grid grid-cols-2 gap-1.5 mb-2">
                        {/* Horário Original */}
                        <div className={`rounded p-2 text-center ${
                          reagendamento.status === 'aprovado' ? 'bg-gray-100' : 'bg-red-50 border border-red-200'
                        }`}>
                          <div className="text-[10px] text-gray-500 mb-0.5">De</div>
                          <div className="text-xs font-semibold text-gray-800">{formatarData(reagendamento.dataOriginal)}</div>
                          <div className="text-[10px] text-gray-600">{reagendamento.horarioFixoId?.horarioInicio}</div>
                          {professorOrigem !== 'N/A' && (
                            <div className="text-[10px] text-gray-500 mt-0.5">
                              <i className="fas fa-user-tie text-[8px] mr-0.5"></i>{professorOrigem}
                            </div>
                          )}
                        </div>

                        {/* Novo Horário */}
                        <div className={`rounded p-2 text-center ${
                          reagendamento.status === 'aprovado' ? 'bg-gray-100' : 'bg-green-50 border border-green-300'
                        }`}>
                          <div className="text-[10px] text-gray-500 mb-0.5">Para</div>
                          <div className="text-xs font-semibold text-gray-800">{formatarData(reagendamento.novaData)}</div>
                          <div className="text-[10px] text-gray-600">{reagendamento.novoHorarioInicio}</div>
                          {professorDestino !== 'N/A' && (
                            <div className="text-[10px] text-gray-500 mt-0.5">
                              <i className="fas fa-user-tie text-[8px] mr-0.5"></i>{professorDestino}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Botões de ação compactos */}
                      <div className="flex items-center justify-end gap-1 pt-2 border-t border-gray-100">
                        {reagendamento.status === 'pendente' && (
                          <>
                            <button
                              onClick={() => aprovarReagendamento(reagendamento._id)}
                              className="w-8 h-8 inline-flex items-center justify-center bg-green-500 text-white rounded-lg text-sm"
                            >
                              <i className="fas fa-check"></i>
                            </button>
                            <button
                              onClick={() => rejeitarReagendamento(reagendamento._id)}
                              className="w-8 h-8 inline-flex items-center justify-center bg-red-500 text-white rounded-lg text-sm"
                            >
                              <i className="fas fa-times"></i>
                            </button>
                            <button
                              onClick={() => excluirReagendamento(reagendamento._id)}
                              className="w-8 h-8 inline-flex items-center justify-center text-gray-400 hover:text-red-600 rounded-lg text-sm"
                            >
                              <i className="fas fa-trash"></i>
                            </button>
                          </>
                        )}
                        {reagendamento.status === 'aprovado' && (
                          <>
                            <button
                              onClick={() => voltarParaPendente(reagendamento._id)}
                              className="w-8 h-8 inline-flex items-center justify-center bg-yellow-500 text-white rounded-lg text-sm"
                            >
                              <i className="fas fa-undo"></i>
                            </button>
                            <button
                              onClick={() => excluirReagendamento(reagendamento._id)}
                              className="w-8 h-8 inline-flex items-center justify-center text-gray-400 hover:text-red-600 rounded-lg text-sm"
                            >
                              <i className="fas fa-trash"></i>
                            </button>
                          </>
                        )}
                        {reagendamento.status === 'rejeitado' && (
                          <>
                            <button
                              onClick={() => voltarParaPendente(reagendamento._id)}
                              className="w-8 h-8 inline-flex items-center justify-center bg-yellow-500 text-white rounded-lg text-sm"
                            >
                              <i className="fas fa-undo"></i>
                            </button>
                            <button
                              onClick={() => excluirReagendamento(reagendamento._id)}
                              className="w-8 h-8 inline-flex items-center justify-center text-gray-400 hover:text-red-600 rounded-lg text-sm"
                            >
                              <i className="fas fa-trash"></i>
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Layout Desktop: Tudo em linha */}
                    <div className="hidden lg:flex items-center gap-6">
                      
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
                        {/* Quem solicitou */}
                        <p className={`text-xs mt-1 ${
                          reagendamento.solicitadoPor === 'aluno' 
                            ? 'text-purple-600' 
                            : 'text-gray-500'
                        }`}>
                          <i className={`fas ${reagendamento.solicitadoPor === 'aluno' ? 'fa-user-graduate' : 'fa-user-shield'} mr-1`}></i>
                          {reagendamento.solicitadoPor === 'aluno' ? 'Solicitado pelo aluno' : 'Solicitado pela administração'}
                        </p>
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
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="relative mx-auto p-4 sm:p-5 border w-full max-w-sm shadow-lg rounded-md bg-white fade-in-4 max-h-[90vh] overflow-y-auto">
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
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="relative mx-auto p-4 sm:p-6 border w-full max-w-sm shadow-lg rounded-md bg-white max-h-[90vh] overflow-y-auto">
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