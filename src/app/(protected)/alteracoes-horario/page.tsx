'use client';

import Swal from 'sweetalert2';
import { toast } from 'react-toastify';
import { useState, useEffect, useCallback } from 'react';
import { refreshPendingCounts } from '@/lib/events';
import ProtectedPage from '@/components/ProtectedPage';
import ToggleAprovacaoAutomatica from '@/components/ToggleAprovacaoAutomatica';

interface AlteracaoHorario {
  _id: string;
  alunoId: {
    _id: string;
    nome: string;
    email?: string;
    telefone?: string;
  };
  horarioAtualId: {
    _id: string;
    diaSemana: number;
    horarioInicio: string;
    horarioFim: string;
    modalidadeId?: { _id: string; nome: string; cor: string };
    professorId?: { _id: string; nome: string };
  };
  novoHorarioId: {
    _id: string;
    diaSemana: number;
    horarioInicio: string;
    horarioFim: string;
    modalidadeId?: { _id: string; nome: string; cor: string };
    professorId?: { _id: string; nome: string };
  };
  motivo?: string;
  status: 'pendente' | 'aprovado' | 'rejeitado';
  criadoEm: string;
}

const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export default function AlteracoesHorarioPage() {
  const [mounted, setMounted] = useState(false);
  const [alteracoes, setAlteracoes] = useState<AlteracaoHorario[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<'pendente' | 'aprovado' | 'rejeitado' | 'todas'>('pendente');
  const [pendentes, setPendentes] = useState(0);
  const [processando, setProcessando] = useState<string | null>(null);
  const [showRejeicaoModal, setShowRejeicaoModal] = useState(false);
  const [solicitacaoParaRejeitar, setSolicitacaoParaRejeitar] = useState<AlteracaoHorario | null>(null);
  const [motivoRejeicao, setMotivoRejeicao] = useState('');
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearing, setClearing] = useState(false);

  // Marcar como montado imediatamente
  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchAlteracoes = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/alteracoes-horario?status=${filtroStatus}`);
      
      if (res.ok) {
        const data = await res.json();
        setAlteracoes(data.solicitacoes || []);
        setPendentes(data.pendentes || 0);
      }
    } catch (error) {
      console.error('Erro ao buscar alterações:', error);
    } finally {
      setLoading(false);
    }
  }, [filtroStatus]);

  useEffect(() => {
    fetchAlteracoes();
  }, [fetchAlteracoes]);

  const processarSolicitacao = async (solicitacaoId: string, acao: 'aprovar' | 'rejeitar', motivoRejeicao?: string) => {
    setProcessando(solicitacaoId);
    try {
      const res = await fetch('/api/alteracoes-horario', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ solicitacaoId, acao, motivoRejeicao })
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Erro ao processar');
        setProcessando(null);
        return;
      }

      const data = await res.json();
      
      if (acao === 'aprovar') {
        toast.success('Alteração de horário aprovada!');
      } else {
        toast.success('Solicitação rejeitada!');
      }
      fetchAlteracoes();
      refreshPendingCounts();
      setShowRejeicaoModal(false);
      setSolicitacaoParaRejeitar(null);
      setMotivoRejeicao('');
    } catch (error) {
      console.error('Erro ao processar solicitação:', error);
      toast.error('Erro ao processar solicitação');
    } finally {
      setProcessando(null);
    }
  };

  const abrirModalRejeicao = (solicitacao: AlteracaoHorario) => {
    setSolicitacaoParaRejeitar(solicitacao);
    setMotivoRejeicao('');
    setShowRejeicaoModal(true);
  };

  const excluirAlteracao = async (solicitacaoId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta solicitação de alteração de horário?')) return;

    try {
      const res = await fetch(`/api/alteracoes-horario?id=${solicitacaoId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        toast.success('Solicitação excluída com sucesso!');
        fetchAlteracoes();
        refreshPendingCounts();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Erro ao excluir');
      }
    } catch {
      toast.error('Erro ao excluir solicitação');
    }
  };

  const limparHistorico = async () => {
    setClearing(true);
    try {
      const res = await fetch('/api/alteracoes-horario/clear', {
        method: 'DELETE'
      });

      if (res.ok) {
        toast.success('Histórico limpo com sucesso!');
        setShowClearModal(false);
        fetchAlteracoes();
        refreshPendingCounts();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Erro ao limpar histórico');
      }
    } catch {
      toast.error('Erro ao limpar histórico');
    } finally {
      setClearing(false);
    }
  };

  // Helper para parsear data sem problema de timezone UTC (para datas simples)
  const parseDataLocal = (dataStr: string): Date => {
    if (!dataStr) return new Date();
    // Se tem hora (timestamp), usar Date normal
    if (dataStr.includes('T') && dataStr.length > 10) {
      return new Date(dataStr);
    }
    // Se é só data YYYY-MM-DD
    const str = dataStr.split('T')[0];
    const [ano, mes, dia] = str.split('-').map(Number);
    return new Date(ano, mes - 1, dia, 12, 0, 0);
  };

  const formatarData = (dataStr: string) => {
    return parseDataLocal(dataStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!mounted || loading) {
    return (
      <ProtectedPage tab="reagendamentos" title="Alterações de Horário - Superação Flux" fullWidth customLoading>
        <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
          {/* Header skeleton - Desktop */}
          <div className="hidden md:flex items-center justify-between gap-4 mb-6">
            <div>
              <div className="h-6 bg-gray-200 rounded w-48 mb-2 animate-pulse" />
              <div className="h-4 bg-gray-200 rounded w-80 animate-pulse" />
            </div>
            <div className="h-10 w-40 bg-gray-200 rounded-full animate-pulse" />
          </div>
          
          {/* Header skeleton - Mobile */}
          <div className="md:hidden flex items-center justify-between mb-4">
            <div className="h-5 bg-gray-200 rounded w-40 animate-pulse" />
            <div className="w-9 h-9 bg-gray-200 rounded-full animate-pulse" />
          </div>
          
          {/* Tabs skeleton - Desktop */}
          <div className="hidden md:block mb-6 border-b border-gray-200 pb-2">
            <div className="flex gap-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-6 bg-gray-200 rounded w-28 animate-pulse" />
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
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-5">
                <div className="flex items-center gap-6">
                  <div className="w-64 space-y-2">
                    <div className="flex gap-2">
                      <div className="h-5 bg-gray-200 rounded w-24 animate-pulse" />
                      <div className="h-5 bg-gray-200 rounded-full w-20 animate-pulse" />
                    </div>
                    <div className="h-5 bg-gray-200 rounded w-36 animate-pulse" />
                    <div className="h-3 bg-gray-100 rounded w-28 animate-pulse" />
                  </div>
                  <div className="flex-1 grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded p-3 space-y-2">
                      <div className="h-3 bg-gray-200 rounded w-20 animate-pulse" />
                      <div className="h-4 bg-gray-200 rounded w-28 animate-pulse" />
                    </div>
                    <div className="bg-gray-50 rounded p-3 space-y-2">
                      <div className="h-3 bg-gray-200 rounded w-20 animate-pulse" />
                      <div className="h-4 bg-gray-200 rounded w-28 animate-pulse" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 w-32">
                    <div className="h-9 bg-gray-200 rounded animate-pulse" />
                    <div className="h-9 bg-gray-200 rounded animate-pulse" />
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
                    <div className="h-4 bg-gray-200 rounded w-32 mb-1" />
                    <div className="h-3 bg-gray-100 rounded w-24" />
                  </div>
                  <div className="flex gap-1">
                    <div className="h-5 bg-gray-200 rounded w-10" />
                    <div className="h-5 bg-gray-200 rounded-full w-14" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5 mb-2">
                  <div className="bg-gray-50 rounded p-2 text-center">
                    <div className="h-2 bg-gray-200 rounded w-8 mx-auto mb-1" />
                    <div className="h-3 bg-gray-200 rounded w-20 mx-auto mb-1" />
                    <div className="h-2 bg-gray-100 rounded w-12 mx-auto" />
                  </div>
                  <div className="bg-gray-50 rounded p-2 text-center">
                    <div className="h-2 bg-gray-200 rounded w-10 mx-auto mb-1" />
                    <div className="h-3 bg-gray-200 rounded w-20 mx-auto mb-1" />
                    <div className="h-2 bg-gray-100 rounded w-12 mx-auto" />
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
    <ProtectedPage tab="reagendamentos" title="Alterações de Horário - Superação Flux" fullWidth>
      <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
        {/* Header Desktop */}
        <div className="hidden md:flex items-center justify-between gap-4 mb-6 fade-in-1">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <i className="fas fa-clock text-green-600"></i>
              Alterações de Horário
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Gerencie solicitações de alteração de horário fixo dos alunos
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowClearModal(true)}
            className="inline-flex transition-colors duration-200 items-center justify-center rounded-full border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 shadow-sm hover:bg-red-100 sm:w-auto"
            title="Limpar todo o histórico de alterações de horário"
          >
            <i className="fas fa-trash-alt mr-2"></i>
            Limpar Histórico
          </button>
        </div>

        {/* Header Mobile */}
        <div className="md:hidden flex items-center justify-between mb-4 fade-in-1">
          <h1 className="text-lg font-semibold text-gray-900">Alterações de Horário</h1>
          <button
            type="button"
            onClick={() => setShowClearModal(true)}
            className="w-9 h-9 flex items-center justify-center rounded-full border border-red-300 bg-red-50 text-red-600"
          >
            <i className="fas fa-trash-alt text-sm"></i>
          </button>
        </div>

        {/* Toggle Aprovação Automática */}
        <div className="mb-4 fade-in-2">
          <ToggleAprovacaoAutomatica 
            chave="aprovacaoAutomaticaAlteracaoHorario" 
            label="Aprovação Automática de Alterações de Horário" 
          />
        </div>

        {/* Tabs Mobile */}
        <div className="md:hidden mb-4 fade-in-2">
          <div className="flex gap-2">
            <button 
              onClick={() => setFiltroStatus('todas')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors ${
                filtroStatus === 'todas' 
                  ? 'bg-green-600 text-white' 
                  : 'bg-gray-100 text-gray-600'
              }`}>
              Todas ({alteracoes.length})
            </button>
            <button 
              onClick={() => setFiltroStatus('pendente')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors ${
                filtroStatus === 'pendente' 
                  ? 'bg-yellow-500 text-white' 
                  : 'bg-gray-100 text-gray-600'
              }`}>
              Pend. ({alteracoes.filter(r => r.status === 'pendente').length})
            </button>
            <button 
              onClick={() => setFiltroStatus('aprovado')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors ${
                filtroStatus === 'aprovado' 
                  ? 'bg-green-500 text-white' 
                  : 'bg-gray-100 text-gray-600'
              }`}>
              Aprov. ({alteracoes.filter(r => r.status === 'aprovado').length})
            </button>
          </div>
        </div>

        {/* Tabs Desktop */}
        <div className="hidden md:block mb-6 fade-in-2">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button 
                onClick={() => setFiltroStatus('todas')}
                className={`${filtroStatus === 'todas' ? 'border-primary-500 text-primary-600 border-b-2' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 border-b-2'} whitespace-nowrap py-2 px-1 font-medium text-sm transition-colors`}>
                Todas ({alteracoes.length})
              </button>
              <button 
                onClick={() => setFiltroStatus('pendente')}
                className={`${filtroStatus === 'pendente' ? 'border-primary-500 text-primary-600 border-b-2' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 border-b-2'} whitespace-nowrap py-2 px-1 font-medium text-sm transition-colors`}>
                Pendentes ({alteracoes.filter(r => r.status === 'pendente').length})
              </button>
              <button 
                onClick={() => setFiltroStatus('aprovado')}
                className={`${filtroStatus === 'aprovado' ? 'border-primary-500 text-primary-600 border-b-2' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 border-b-2'} whitespace-nowrap py-2 px-1 font-medium text-sm transition-colors`}>
                Aprovadas ({alteracoes.filter(r => r.status === 'aprovado').length})
              </button>
              <button 
                onClick={() => setFiltroStatus('rejeitado')}
                className={`${filtroStatus === 'rejeitado' ? 'border-primary-500 text-primary-600 border-b-2' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 border-b-2'} whitespace-nowrap py-2 px-1 font-medium text-sm transition-colors`}>
                Rejeitadas ({alteracoes.filter(r => r.status === 'rejeitado').length})
              </button>
            </nav>
          </div>
        </div>

        {/* Lista */}
        <div className="md:bg-white md:shadow md:rounded-lg fade-in-3">
          <div className="md:px-4 md:py-5 md:p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : alteracoes.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <i className="fas fa-exchange-alt text-gray-300 text-4xl mb-4"></i>
                <p className="text-gray-500">Nenhuma solicitação encontrada</p>
              </div>
            ) : (
              <div className="space-y-3 md:space-y-4">
                {alteracoes
                  .filter((alt) => {
                    if (filtroStatus === 'todas') return true;
                    return alt.status === filtroStatus;
                  })
                  .map((alt) => (
                    <div 
                      key={alt._id}
                      className={`border rounded-xl md:rounded-lg shadow-sm md:shadow-none p-3 md:p-5 transition-colors ${
                        alt.status === 'aprovado'
                          ? 'bg-white md:bg-gray-100 border-gray-200 md:border-gray-300'
                          : alt.status === 'rejeitado'
                          ? 'border-red-200 md:border-red-300 bg-white md:bg-red-50'
                          : 'border-orange-200 md:border-orange-300 bg-white md:bg-orange-50'
                      }`}
                    >
                      {/* Layout Mobile: Cards compactos */}
                      <div className="block lg:hidden">
                        {/* Header com nome e badges */}
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-900 truncate">{alt.alunoId?.nome || 'Aluno'}</p>
                            <p className="text-[10px] text-gray-500">{formatarData(alt.criadoEm)}</p>
                            {alt.alunoId?.telefone && (
                              <p className="text-[10px] text-gray-500 mt-0.5">
                                <i className="fas fa-phone text-[8px] mr-0.5"></i>{alt.alunoId.telefone}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              alt.status === 'aprovado'
                                ? 'bg-gray-200 text-gray-600'
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                              ALT
                            </span>
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                              alt.status === 'aprovado'
                                ? 'bg-green-100 text-green-700'
                                : alt.status === 'pendente'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {alt.status === 'pendente' ? 'PEND' : alt.status === 'aprovado' ? 'APROV' : 'REJ'}
                            </span>
                          </div>
                        </div>

                        {/* Cards de horários compactos */}
                        <div className="grid grid-cols-2 gap-1.5 mb-2">
                          {/* Horário Atual */}
                          <div className={`rounded p-2 text-center ${
                            alt.status === 'aprovado' ? 'bg-gray-100' : 'bg-red-50 border border-red-200'
                          }`}>
                            <div className="text-[10px] text-gray-500 mb-0.5">De</div>
                            <div className="text-xs font-semibold text-gray-800">
                              {alt.horarioAtualId?.diaSemana !== undefined && diasSemana[alt.horarioAtualId.diaSemana]}
                            </div>
                            <div className="text-[10px] text-gray-600">
                              {alt.horarioAtualId?.horarioInicio} - {alt.horarioAtualId?.horarioFim}
                            </div>
                            {alt.horarioAtualId?.professorId?.nome && (
                              <div className="text-[10px] text-gray-500 mt-0.5">
                                <i className="fas fa-user-tie text-[8px] mr-0.5"></i>
                                {alt.horarioAtualId.professorId.nome}
                              </div>
                            )}
                          </div>

                          {/* Novo Horário */}
                          <div className={`rounded p-2 text-center ${
                            alt.status === 'aprovado' ? 'bg-gray-100' : 'bg-green-50 border border-green-300'
                          }`}>
                            <div className="text-[10px] text-gray-500 mb-0.5">Para</div>
                            <div className="text-xs font-semibold text-gray-800">
                              {alt.novoHorarioId?.diaSemana !== undefined && diasSemana[alt.novoHorarioId.diaSemana]}
                            </div>
                            <div className="text-[10px] text-gray-600">
                              {alt.novoHorarioId?.horarioInicio} - {alt.novoHorarioId?.horarioFim}
                            </div>
                            {alt.novoHorarioId?.professorId?.nome && (
                              <div className="text-[10px] text-gray-500 mt-0.5">
                                <i className="fas fa-user-tie text-[8px] mr-0.5"></i>
                                {alt.novoHorarioId.professorId.nome}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Motivo (se houver) */}
                        {alt.motivo && (
                          <div className="bg-blue-50 rounded p-1.5 mb-2 border-l-2 border-blue-400">
                            <p className="text-[10px] text-gray-600">
                              <i className="fas fa-comment mr-1 text-blue-500"></i>
                              {alt.motivo}
                            </p>
                          </div>
                        )}

                        {/* Botões de ação compactos */}
                        <div className="flex items-center justify-end gap-1 pt-2 border-t border-gray-100">
                          {alt.status === 'pendente' && (
                            <>
                              <button
                                onClick={() => processarSolicitacao(alt._id, 'aprovar')}
                                disabled={processando === alt._id}
                                className="w-8 h-8 inline-flex items-center justify-center bg-green-500 text-white rounded-lg text-sm"
                              >
                                {processando === alt._id ? (
                                  <i className="fas fa-spinner fa-spin"></i>
                                ) : (
                                  <i className="fas fa-check"></i>
                                )}
                              </button>
                              <button
                                onClick={() => abrirModalRejeicao(alt)}
                                disabled={processando === alt._id}
                                className="w-8 h-8 inline-flex items-center justify-center bg-red-500 text-white rounded-lg text-sm"
                              >
                                <i className="fas fa-times"></i>
                              </button>
                              <button
                                onClick={() => excluirAlteracao(alt._id)}
                                className="w-8 h-8 inline-flex items-center justify-center text-gray-400 hover:text-red-600 rounded-lg text-sm"
                              >
                                <i className="fas fa-trash"></i>
                              </button>
                            </>
                          )}
                          {alt.status !== 'pendente' && (
                            <button
                              onClick={() => excluirAlteracao(alt._id)}
                              className="w-8 h-8 inline-flex items-center justify-center text-gray-400 hover:text-red-600 rounded-lg text-sm"
                            >
                              <i className="fas fa-trash"></i>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Layout Desktop - Horizontal */}
                      <div className="hidden lg:flex items-center gap-6">
                        
                        {/* Coluna 1: Informações do Aluno e Tipo */}
                        <div className="flex-shrink-0 w-64">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold transition-colors ${
                              alt.status === 'aprovado'
                                ? 'bg-gray-300 text-gray-700 border border-gray-400'
                                : 'bg-blue-100 text-blue-800 border border-blue-200'
                            }`}>
                              <i className="fas fa-clock text-[9px]"></i>
                              Alteração Horário
                            </span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              alt.status === 'aprovado'
                                ? 'bg-green-100 text-green-800 border border-green-200'
                                : alt.status === 'pendente'
                                ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                                : 'bg-red-100 text-red-800 border border-red-200'
                            }`}>
                              {alt.status.charAt(0).toUpperCase() + alt.status.slice(1)}
                            </span>
                          </div>
                          <p className="text-base font-bold text-gray-900 mb-1">{alt.alunoId?.nome || 'Aluno não encontrado'}</p>
                          <p className="text-xs text-gray-500">{formatarData(alt.criadoEm)}</p>
                          {alt.alunoId?.telefone && (
                            <p className="text-xs text-gray-500 mt-1">
                              <i className="fas fa-phone mr-1"></i>{alt.alunoId.telefone}
                            </p>
                          )}
                        </div>

                        {/* Coluna 2: Horário Atual */}
                        <div className="flex-1">
                          <div className={`bg-white rounded border p-3 transition-colors h-full ${
                            alt.status === 'aprovado'
                              ? 'border-gray-300'
                              : 'border-gray-300'
                          }`}>
                            <div className="flex items-center gap-1.5 mb-2">
                              <i className={`fas fa-calendar-times transition-colors ${
                                alt.status === 'aprovado'
                                  ? 'text-gray-400'
                                  : 'text-red-500'
                              }`}></i>
                              <span className={`font-semibold text-sm transition-colors ${
                                alt.status === 'aprovado'
                                  ? 'text-gray-600'
                                  : 'text-gray-700'
                              }`}>Horário Atual</span>
                            </div>
                            <div className="space-y-1 text-sm transition-colors">
                              <p className={alt.status === 'aprovado' ? 'text-gray-500' : 'text-gray-700'}>
                                <i className="fas fa-calendar-day w-4 text-gray-400"></i> {alt.horarioAtualId?.diaSemana !== undefined && diasSemana[alt.horarioAtualId.diaSemana]}
                              </p>
                              <p className={alt.status === 'aprovado' ? 'text-gray-500' : 'text-gray-700'}>
                                <i className="fas fa-clock w-4 text-gray-400"></i> {alt.horarioAtualId?.horarioInicio} - {alt.horarioAtualId?.horarioFim}
                              </p>
                              <p className={alt.status === 'aprovado' ? 'text-gray-500' : 'text-gray-700'}>
                                <i className="fas fa-user w-4 text-gray-400"></i> {alt.horarioAtualId?.professorId?.nome || 'N/A'}
                              </p>
                              {alt.horarioAtualId?.modalidadeId?.nome && (
                                <p className={alt.status === 'aprovado' ? 'text-gray-500' : 'text-gray-700'}>
                                  <i className="fas fa-dumbbell w-4 text-gray-400"></i> {alt.horarioAtualId.modalidadeId.nome}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Seta */}
                        <div className="flex-shrink-0">
                          <i className={`fas fa-arrow-right text-2xl transition-colors ${
                            alt.status === 'aprovado'
                              ? 'text-gray-300'
                              : 'text-gray-400'
                          }`}></i>
                        </div>

                        {/* Coluna 3: Novo Horário */}
                        <div className="flex-1">
                          <div className={`bg-white rounded p-3 transition-colors h-full ${
                            alt.status === 'aprovado'
                              ? 'border-gray-300 border-2'
                              : 'border-2 border-green-400'
                          }`}>
                            <div className="flex items-center gap-1.5 mb-2">
                              <i className={`fas fa-calendar-check transition-colors ${
                                alt.status === 'aprovado'
                                  ? 'text-gray-400'
                                  : 'text-green-500'
                              }`}></i>
                              <span className={`font-semibold text-sm transition-colors ${
                                alt.status === 'aprovado'
                                  ? 'text-gray-600'
                                  : 'text-gray-700'
                              }`}>Novo Horário</span>
                            </div>
                            <div className="space-y-1 text-sm transition-colors">
                              <p className={alt.status === 'aprovado' ? 'text-gray-500' : 'text-gray-700'}>
                                <i className="fas fa-calendar-day w-4 text-gray-400"></i> {alt.novoHorarioId?.diaSemana !== undefined && diasSemana[alt.novoHorarioId.diaSemana]}
                              </p>
                              <p className={alt.status === 'aprovado' ? 'text-gray-500' : 'text-gray-700'}>
                                <i className="fas fa-clock w-4 text-gray-400"></i> {alt.novoHorarioId?.horarioInicio} - {alt.novoHorarioId?.horarioFim}
                              </p>
                              <p className={alt.status === 'aprovado' ? 'text-gray-500' : 'text-gray-700'}>
                                <i className="fas fa-user w-4 text-gray-400"></i> {alt.novoHorarioId?.professorId?.nome || 'N/A'}
                              </p>
                              {alt.novoHorarioId?.modalidadeId?.nome && (
                                <p className={alt.status === 'aprovado' ? 'text-gray-500' : 'text-gray-700'}>
                                  <i className="fas fa-dumbbell w-4 text-gray-400"></i> {alt.novoHorarioId.modalidadeId.nome}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Coluna 4: Botões de Ação */}
                        <div className="flex-shrink-0 flex flex-col gap-2 min-w-[120px]">
                          {alt.status === 'pendente' && (
                            <>
                              <button
                                onClick={() => processarSolicitacao(alt._id, 'aprovar')}
                                disabled={processando === alt._id}
                                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded text-sm font-medium transition-colors w-full"
                              >
                                {processando === alt._id ? (
                                  <><i className="fas fa-spinner fa-spin mr-1"></i>Processando...</>
                                ) : (
                                  <><i className="fas fa-check mr-1"></i>Aprovar</>
                                )}
                              </button>
                              <button
                                onClick={() => abrirModalRejeicao(alt)}
                                disabled={processando === alt._id}
                                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded text-sm font-medium transition-colors w-full"
                              >
                                <i className="fas fa-times mr-1"></i>Rejeitar
                              </button>
                              <button
                                onClick={() => excluirAlteracao(alt._id)}
                                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded text-sm font-medium border border-gray-300 transition-colors w-full"
                              >
                                <i className="fas fa-trash mr-1"></i>Excluir
                              </button>
                            </>
                          )}
                          {alt.status !== 'pendente' && (
                            <button
                              onClick={() => excluirAlteracao(alt._id)}
                              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded text-sm font-medium border border-gray-300 transition-colors w-full"
                            >
                              <i className="fas fa-trash mr-1"></i>Excluir
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Motivo (abaixo em desktop se houver) */}
                      {alt.motivo && (
                        <div className="hidden lg:block bg-blue-50 border-l-4 border-blue-400 rounded-r-lg p-2 mt-3">
                          <p className="text-xs text-gray-700">
                            <i className="fas fa-comment mr-2 text-blue-500"></i>
                            <strong className="text-blue-700">Motivo:</strong> {alt.motivo}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>      {/* Modal de Rejeição */}
      {showRejeicaoModal && solicitacaoParaRejeitar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Rejeitar Solicitação</h3>
              <button onClick={() => setShowRejeicaoModal(false)} className="text-gray-400 hover:text-gray-600">
                <i className="fas fa-times"></i>
              </button>
            </div>

            <p className="text-gray-600 mb-4">
              Rejeitar a alteração de horário de <strong>{solicitacaoParaRejeitar.alunoId?.nome}</strong>?
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Motivo da rejeição (opcional)
              </label>
              <textarea
                value={motivoRejeicao}
                onChange={e => setMotivoRejeicao(e.target.value)}
                placeholder="Ex: Não há vaga disponível no horário solicitado..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setShowRejeicaoModal(false)} 
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button 
                onClick={() => processarSolicitacao(solicitacaoParaRejeitar._id, 'rejeitar', motivoRejeicao)}
                disabled={processando === solicitacaoParaRejeitar._id}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg disabled:opacity-50"
              >
                {processando === solicitacaoParaRejeitar._id ? (
                  <><i className="fas fa-spinner fa-spin mr-2"></i>Processando...</>
                ) : (
                  'Rejeitar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Limpar Histórico */}
      {showClearModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Limpar Histórico</h3>
              <button onClick={() => setShowClearModal(false)} className="text-gray-400 hover:text-gray-600">
                <i className="fas fa-times"></i>
              </button>
            </div>

            <p className="text-gray-600 mb-4">
              Tem certeza que deseja <strong className="text-red-600">limpar todo o histórico</strong> de alterações de horário?
            </p>
            
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mb-4">
              <p className="text-sm text-yellow-800">
                <i className="fas fa-exclamation-triangle mr-2"></i>
                Esta ação irá remover <strong>todas as solicitações aprovadas e rejeitadas</strong>, mantendo apenas as pendentes.
              </p>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setShowClearModal(false)} 
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button 
                onClick={limparHistorico}
                disabled={clearing}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg disabled:opacity-50"
              >
                {clearing ? (
                  <><i className="fas fa-spinner fa-spin mr-2"></i>Limpando...</>
                ) : (
                  'Limpar Histórico'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </ProtectedPage>
  );
}
