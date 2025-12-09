'use client';

import { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import ProtectedPage from '@/components/ProtectedPage';
import { refreshPendingCounts } from '@/lib/events';

interface AulaExperimental {
  _id: string;
  horarioFixoId: string;
  data: string;
  nomeExperimental: string;
  telefoneExperimental: string;
  emailExperimental?: string;
  observacoesExperimental?: string;
  status: 'agendada' | 'aprovada' | 'realizada' | 'cancelada';
  compareceu: boolean | null;
  dataCadastro: string;
  ativo: boolean;
  // Dados populados
  horario?: {
    horarioInicio: string;
    horarioFim: string;
    diaSemana: number;
    modalidadeId?: {
      _id: string;
      nome: string;
      cor?: string;
    };
    professorId?: {
      _id: string;
      nome: string;
    };
  };
}

export default function AulasExperimentaisPage() {
  const [aulasExperimentais, setAulasExperimentais] = useState<AulaExperimental[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<string>('todas');
  const [filtroPresenca, setFiltroPresenca] = useState<string>('todas');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingAula, setEditingAula] = useState<AulaExperimental | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

  useEffect(() => {
    carregarAulas();
  }, []);

  // Fechar modal com ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showModal) {
        setShowModal(false);
        setEditingAula(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [showModal]);

  const carregarAulas = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/aulas-experimentais');
      const data = await res.json();

      if (data.success) {
        // Buscar dados dos horários para enriquecer
        const horariosRes = await fetch('/api/horarios');
        const horariosData = await horariosRes.json();
        const horariosMap = new Map();
        
        if (horariosData.success) {
          horariosData.data.forEach((h: any) => {
            horariosMap.set(h._id, h);
          });
        }

        // Enriquecer aulas com dados do horário
        const aulasEnriquecidas = data.data.map((aula: AulaExperimental) => ({
          ...aula,
          horario: horariosMap.get(aula.horarioFixoId) || null
        }));

        setAulasExperimentais(aulasEnriquecidas);
      }
    } catch (error) {
      console.error('Erro ao carregar aulas experimentais:', error);
      toast.error('Erro ao carregar aulas experimentais');
    } finally {
      setLoading(false);
    }
  };

  const filteredAulas = useMemo(() => {
    return aulasExperimentais.filter(aula => {
      // Filtro de status
      if (filtroStatus !== 'todas' && aula.status !== filtroStatus) return false;

      // Filtro de presença
      if (filtroPresenca === 'compareceu' && aula.compareceu !== true) return false;
      if (filtroPresenca === 'naoCompareceu' && aula.compareceu !== false) return false;
      if (filtroPresenca === 'pendente' && aula.compareceu !== null) return false;

      // Busca por nome ou telefone
      if (searchTerm) {
        const termo = searchTerm.toLowerCase();
        const matchNome = aula.nomeExperimental?.toLowerCase().includes(termo);
        const matchTelefone = aula.telefoneExperimental?.includes(termo);
        if (!matchNome && !matchTelefone) return false;
      }

      return true;
    });
  }, [aulasExperimentais, filtroStatus, filtroPresenca, searchTerm]);

  // Estatísticas
  const stats = useMemo(() => {
    const total = aulasExperimentais.length;
    const agendadas = aulasExperimentais.filter(a => a.status === 'agendada').length;
    const aprovadas = aulasExperimentais.filter(a => a.status === 'aprovada').length;
    const realizadas = aulasExperimentais.filter(a => a.status === 'realizada').length;
    const canceladas = aulasExperimentais.filter(a => a.status === 'cancelada').length;
    const compareceram = aulasExperimentais.filter(a => a.compareceu === true).length;
    const naoCompareceram = aulasExperimentais.filter(a => a.compareceu === false).length;

    return { total, agendadas, aprovadas, realizadas, canceladas, compareceram, naoCompareceram };
  }, [aulasExperimentais]);

  const atualizarStatus = async (aula: AulaExperimental, novoStatus: string) => {
    try {
      setSaving(true);
      const res = await fetch('/api/aulas-experimentais', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          _id: aula._id,
          status: novoStatus
        })
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Status atualizado!');
        carregarAulas();
        refreshPendingCounts();
      } else {
        toast.error(data.error || 'Erro ao atualizar');
      }
    } catch (error) {
      toast.error('Erro ao atualizar status');
    } finally {
      setSaving(false);
    }
  };

  const aprovarAula = async (aula: AulaExperimental) => {
    const result = await Swal.fire({
      title: 'Aprovar Aula Experimental?',
      text: `Confirmar a aula experimental de ${aula.nomeExperimental}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#10B981',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sim, aprovar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      await atualizarStatus(aula, 'aprovada');
    }
  };

  const desaprovarAula = async (aula: AulaExperimental) => {
    const result = await Swal.fire({
      title: 'Desaprovar Aula?',
      text: `Voltar a aula de ${aula.nomeExperimental} para pendente?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#f59e0b',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sim, desaprovar',
      cancelButtonText: 'Não'
    });

    if (result.isConfirmed) {
      await atualizarStatus(aula, 'agendada');
    }
  };

  const cancelarAula = async (aula: AulaExperimental) => {
    const result = await Swal.fire({
      title: 'Cancelar Aula Experimental?',
      text: `Deseja cancelar a aula de ${aula.nomeExperimental}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sim, cancelar',
      cancelButtonText: 'Não'
    });

    if (result.isConfirmed) {
      await atualizarStatus(aula, 'cancelada');
    }
  };

  const excluirAula = async (aula: AulaExperimental) => {
    const result = await Swal.fire({
      title: 'Excluir Aula Experimental?',
      html: `<p>Deseja <strong>excluir permanentemente</strong> a aula experimental de <strong>${aula.nomeExperimental}</strong>?</p><p class="text-sm text-gray-500 mt-2">Esta ação não pode ser desfeita.</p>`,
      icon: 'error',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sim, excluir',
      cancelButtonText: 'Não'
    });

    if (result.isConfirmed) {
      try {
        setSaving(true);
        const res = await fetch(`/api/aulas-experimentais?id=${aula._id}`, {
          method: 'DELETE'
        });

        const data = await res.json();
        if (data.success) {
          toast.success('Aula excluída com sucesso!');
          carregarAulas();
        } else {
          toast.error(data.error || 'Erro ao excluir');
        }
      } catch (error) {
        toast.error('Erro ao excluir aula');
      } finally {
        setSaving(false);
      }
    }
  };

  const abrirWhatsApp = (telefone: string, nome: string) => {
    const numeroLimpo = telefone.replace(/\D/g, '');
    const numero = numeroLimpo.startsWith('55') ? numeroLimpo : `55${numeroLimpo}`;
    const mensagem = encodeURIComponent(`Olá ${nome}! Tudo bem? Aqui é do Studio Superação.`);
    window.open(`https://wa.me/${numero}?text=${mensagem}`, '_blank');
  };

  const converterEmAluno = (aula: AulaExperimental) => {
    // Redirecionar para página de alunos com dados pré-preenchidos
    const params = new URLSearchParams({
      nome: aula.nomeExperimental,
      telefone: aula.telefoneExperimental,
      email: aula.emailExperimental || '',
      novo: 'true'
    });
    window.location.href = `/alunos?${params.toString()}`;
  };

  const formatarData = (dataStr: string) => {
    // Evitar problema de fuso horário - adicionar T12:00:00 para garantir que a data não mude
    const dataISO = dataStr.includes('T') ? dataStr : `${dataStr.split('T')[0]}T12:00:00`;
    const data = new Date(dataISO);
    return data.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const isAulaPassada = (dataStr: string) => {
    // Evitar problema de fuso horário
    const dataISO = dataStr.includes('T') ? dataStr : `${dataStr.split('T')[0]}T12:00:00`;
    const dataAula = new Date(dataISO);
    dataAula.setHours(23, 59, 59, 999);
    const hoje = new Date();
    return dataAula < hoje;
  };

  const isAulaHoje = (dataStr: string) => {
    // Evitar problema de fuso horário
    const dataISO = dataStr.includes('T') ? dataStr : `${dataStr.split('T')[0]}T12:00:00`;
    const dataAula = new Date(dataISO);
    const hoje = new Date();
    return dataAula.toDateString() === hoje.toDateString();
  };

  // Skeleton loading
  if (loading) {
    return (
      <ProtectedPage tab="aulas-experimentais" title="Aulas Experimentais - Superação Flux" fullWidth>
        <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-6">
            <div className="h-6 bg-gray-200 rounded w-48 mb-2 animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded w-80 animate-pulse"></div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white rounded-lg border p-4 animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-12 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-20"></div>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-lg border p-4 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </ProtectedPage>
    );
  }

  return (
    <ProtectedPage tab="aulas-experimentais" title="Aulas Experimentais - Superação Flux" fullWidth>
      <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
        {/* Header Desktop */}
        <div className="hidden md:block mb-6 fade-in-1">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <i className="fas fa-user-plus text-green-600"></i>
            Aulas Experimentais
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Gerencie as aulas experimentais de potenciais alunos
          </p>
        </div>

        {/* Header Mobile */}
        <div className="md:hidden mb-4 fade-in-1">
          <h1 className="text-lg font-semibold text-gray-900">Experimentais</h1>
        </div>

        {/* Stats Cards Mobile */}
        <div className="md:hidden grid grid-cols-4 gap-1.5 mb-4 fade-in-2">
          <div className="bg-yellow-50 rounded-lg px-2 py-1.5 border border-yellow-100 text-center">
            <div className="text-sm font-bold text-yellow-700">{stats.agendadas}</div>
            <div className="text-[9px] text-yellow-600">Pendente</div>
          </div>
          <div className="bg-blue-50 rounded-lg px-2 py-1.5 border border-blue-100 text-center">
            <div className="text-sm font-bold text-blue-700">{stats.aprovadas}</div>
            <div className="text-[9px] text-blue-600">Aprovada</div>
          </div>
          <div className="bg-green-50 rounded-lg px-2 py-1.5 border border-green-100 text-center">
            <div className="text-sm font-bold text-green-700">{stats.compareceram}</div>
            <div className="text-[9px] text-green-600">Veio</div>
          </div>
          <div className="bg-red-50 rounded-lg px-2 py-1.5 border border-red-100 text-center">
            <div className="text-sm font-bold text-red-700">{stats.naoCompareceram}</div>
            <div className="text-[9px] text-red-600">Faltou</div>
          </div>
        </div>

        {/* Stats Cards Desktop */}
        <div className="hidden md:grid grid-cols-4 gap-4 mb-6 fade-in-2">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                <i className="fas fa-clock text-yellow-600"></i>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.agendadas}</p>
                <p className="text-xs text-gray-500">Pendentes</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <i className="fas fa-thumbs-up text-blue-600"></i>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.aprovadas}</p>
                <p className="text-xs text-gray-500">Aprovadas</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <i className="fas fa-check text-green-600"></i>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.compareceram}</p>
                <p className="text-xs text-gray-500">Compareceram</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <i className="fas fa-times text-red-600"></i>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.naoCompareceram}</p>
                <p className="text-xs text-gray-500">Não Compareceram</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filtros Mobile */}
        <div className="md:hidden mb-4 fade-in-3">
          <div className="relative mb-2">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
            <input
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-xs bg-white"
            >
              <option value="todas">Status</option>
              <option value="agendada">Pendentes</option>
              <option value="aprovada">Aprovadas</option>
              <option value="realizada">Realizadas</option>
              <option value="cancelada">Canceladas</option>
            </select>
            <select
              value={filtroPresenca}
              onChange={(e) => setFiltroPresenca(e.target.value)}
              className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-xs bg-white"
            >
              <option value="todas">Presença</option>
              <option value="compareceu">Compareceram</option>
              <option value="naoCompareceu">Faltaram</option>
              <option value="pendente">Pendente</option>
            </select>
          </div>
          <div className="text-xs text-gray-500 mt-2">
            {filteredAulas.length} {filteredAulas.length === 1 ? 'aula' : 'aulas'}
          </div>
        </div>

        {/* Filtros Desktop */}
        <div className="hidden md:block bg-white rounded-lg border border-gray-200 p-4 mb-6 fade-in-3">
          <div className="flex flex-row gap-3">
            {/* Busca */}
            <div className="flex-1">
              <div className="relative">
                <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                <input
                  type="text"
                  placeholder="Buscar por nome ou telefone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                />
              </div>
            </div>

            {/* Filtro Status */}
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
            >
              <option value="todas">Todos os status</option>
              <option value="agendada">Pendentes</option>
              <option value="aprovada">Aprovadas</option>
              <option value="realizada">Realizadas</option>
              <option value="cancelada">Canceladas</option>
            </select>

            {/* Filtro Presença */}
            <select
              value={filtroPresenca}
              onChange={(e) => setFiltroPresenca(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
            >
              <option value="todas">Todas as presenças</option>
              <option value="compareceu">Compareceram</option>
              <option value="naoCompareceu">Não compareceram</option>
              <option value="pendente">Pendente</option>
            </select>
          </div>
        </div>

        {/* Lista de Aulas */}
        {filteredAulas.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center fade-in-4">
            <i className="fas fa-calendar-times text-4xl text-gray-300 mb-4"></i>
            <p className="text-gray-500">Nenhuma aula experimental encontrada</p>
            <p className="text-sm text-gray-400 mt-1">
              As aulas experimentais podem ser agendadas no calendário
            </p>
          </div>
        ) : (
          <>
            {/* Cards Mobile */}
            <div className="md:hidden space-y-3 fade-in-4">
              {filteredAulas.map((aula, idx) => {
                const passada = isAulaPassada(aula.data);
                const hoje = isAulaHoje(aula.data);
                const modalidade = aula.horario?.modalidadeId;
                const fadeClass = `fade-in-${Math.min((idx % 8) + 1, 8)}`;
                const situacaoResolvida = aula.compareceu === true || aula.compareceu === false;

                return (
                  <div
                    key={aula._id}
                    className={`rounded-xl border shadow-sm overflow-hidden ${fadeClass} ${
                      situacaoResolvida ? 'bg-gray-100 border-gray-300' :
                      aula.status === 'cancelada' ? 'bg-white opacity-60 border-gray-200' : 
                      hoje ? 'bg-white border-purple-300 ring-1 ring-purple-200' : 'bg-white border-gray-200'
                    }`}
                  >
                    {/* Barra colorida */}
                    <div 
                      className="h-1" 
                      style={{ backgroundColor: situacaoResolvida ? '#9CA3AF' : (modalidade?.cor || '#8B5CF6') }}
                    ></div>
                    
                    <div className="p-3">
                      {/* Header do Card */}
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className={`font-semibold text-sm truncate ${
                              situacaoResolvida ? 'text-gray-400' :
                              aula.status === 'cancelada' ? 'text-gray-900 line-through' : 'text-gray-900'
                            }`}>
                              {aula.nomeExperimental}
                            </h3>
                            {hoje && !situacaoResolvida && (
                              <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-bold rounded-full uppercase">
                                Hoje
                              </span>
                            )}
                          </div>
                          <div className={`text-xs mt-0.5 ${situacaoResolvida ? 'text-gray-400' : 'text-gray-500'}`}>
                            <i className={`fas fa-phone text-[10px] mr-1 ${situacaoResolvida ? 'text-gray-400' : ''}`}></i>
                            {aula.telefoneExperimental}
                          </div>
                        </div>
                        
                        {/* Status Badge */}
                        {aula.status === 'cancelada' ? (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-bold rounded-full uppercase">
                            Cancelada
                          </span>
                        ) : aula.compareceu === true ? (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded-full">
                            <i className="fas fa-check mr-0.5"></i>Veio
                          </span>
                        ) : aula.compareceu === false ? (
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded-full">
                            <i className="fas fa-times mr-0.5"></i>Faltou
                          </span>
                        ) : aula.status === 'aprovada' ? (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full uppercase">
                            Aprovada
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-[10px] font-bold rounded-full uppercase">
                            Pendente
                          </span>
                        )}
                      </div>

                      {/* Data e Modalidade */}
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={`text-xs font-medium ${
                          situacaoResolvida ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          <i className={`fas fa-calendar text-[10px] mr-1 text-gray-400`}></i>
                          {formatarData(aula.data)}
                        </span>
                        {aula.horario && (
                          <span className={`text-xs ${situacaoResolvida ? 'text-gray-400' : 'text-gray-500'}`}>
                            {aula.horario.horarioInicio} - {aula.horario.horarioFim}
                          </span>
                        )}
                        {modalidade && (
                          <span 
                            className="px-1.5 py-0.5 rounded text-[10px] font-medium text-white"
                            style={{ backgroundColor: situacaoResolvida ? '#9CA3AF' : (modalidade.cor || '#6B7280') }}
                          >
                            {modalidade.nome}
                          </span>
                        )}
                      </div>

                      {/* Professor */}
                      {aula.horario?.professorId && (
                        <div className={`text-xs mb-2 ${situacaoResolvida ? 'text-gray-400' : 'text-gray-600'}`}>
                          <i className={`fas fa-user-tie text-[10px] mr-1 text-gray-400`}></i>
                          <span className="font-medium">Prof:</span> {aula.horario.professorId.nome}
                        </div>
                      )}

                      {/* Observações */}
                      {aula.observacoesExperimental && (
                        <div className={`text-xs mb-2 p-2 rounded ${situacaoResolvida ? 'text-gray-400 bg-gray-100' : 'text-gray-500 bg-gray-50'}`}>
                          <i className={`fas fa-comment mr-1 ${situacaoResolvida ? 'text-gray-400' : 'text-gray-400'}`}></i>
                          {aula.observacoesExperimental}
                        </div>
                      )}

                      {/* Ações */}
                      <div className="flex items-center justify-end gap-1 pt-2 border-t border-gray-100">
                        <button
                          onClick={() => abrirWhatsApp(aula.telefoneExperimental, aula.nomeExperimental)}
                          className={`w-8 h-8 inline-flex items-center justify-center rounded-lg transition-colors ${
                            situacaoResolvida ? 'text-gray-400 hover:bg-gray-200' : 'text-green-600 hover:bg-green-50'
                          }`}
                          title="WhatsApp"
                        >
                          <i className="fab fa-whatsapp"></i>
                        </button>

                        {/* Aprovar aula pendente */}
                        {aula.status === 'agendada' && (
                          <button
                            onClick={() => aprovarAula(aula)}
                            disabled={saving}
                            className="w-8 h-8 inline-flex items-center justify-center text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Aprovar"
                          >
                            <i className="fas fa-thumbs-up"></i>
                          </button>
                        )}

                        {/* Desaprovar aula aprovada */}
                        {aula.status === 'aprovada' && aula.compareceu === null && (
                          <button
                            onClick={() => desaprovarAula(aula)}
                            disabled={saving}
                            className="w-8 h-8 inline-flex items-center justify-center text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                            title="Desaprovar"
                          >
                            <i className="fas fa-thumbs-down"></i>
                          </button>
                        )}

                        {/* Converter em aluno (quando compareceu) */}
                        {aula.compareceu === true && (
                          <button
                            onClick={() => converterEmAluno(aula)}
                            className="w-8 h-8 inline-flex items-center justify-center text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                            title="Converter em Aluno"
                          >
                            <i className="fas fa-user-plus"></i>
                          </button>
                        )}

                        {/* Cancelar (pendente ou aprovada) */}
                        {(aula.status === 'agendada' || aula.status === 'aprovada') && (
                          <button
                            onClick={() => cancelarAula(aula)}
                            disabled={saving}
                            className="w-8 h-8 inline-flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Cancelar"
                          >
                            <i className="fas fa-ban"></i>
                          </button>
                        )}

                        {/* Excluir */}
                        <button
                          onClick={() => excluirAula(aula)}
                          disabled={saving}
                          className="w-8 h-8 inline-flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Excluir"
                        >
                          <i className="fas fa-trash-alt"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Lista Desktop */}
            <div className="hidden md:block space-y-3 fade-in-4">
              {filteredAulas.map((aula, idx) => {
                const passada = isAulaPassada(aula.data);
                const hoje = isAulaHoje(aula.data);
                const modalidade = aula.horario?.modalidadeId;
                const professor = aula.horario?.professorId;
                const situacaoResolvida = aula.compareceu === true || aula.compareceu === false;

                return (
                  <div
                    key={aula._id}
                    className={`rounded-lg border p-4 transition-all hover:shadow-md ${
                      situacaoResolvida ? 'bg-gray-100 border-gray-300' :
                      aula.status === 'cancelada' ? 'bg-white opacity-60 border-gray-200' : 
                      'bg-white border-gray-200'
                    } ${hoje && !situacaoResolvida ? 'ring-2 ring-purple-500' : ''}`}
                  >
                    <div className="flex flex-row items-center gap-4">
                      {/* Avatar e Info Principal */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 ${
                          situacaoResolvida ? 'bg-gray-400' :
                          aula.status === 'cancelada' ? 'bg-gray-400' :
                          aula.status === 'aprovada' ? 'bg-blue-500' :
                          'bg-yellow-500'
                        }`}>
                          {aula.nomeExperimental.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className={`font-semibold truncate ${
                              situacaoResolvida ? 'text-gray-400' :
                              aula.status === 'cancelada' ? 'text-gray-900 line-through' : 'text-gray-900'
                            }`}>
                              {aula.nomeExperimental}
                            </h3>
                            {hoje && !situacaoResolvida && (
                              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                                HOJE
                              </span>
                            )}
                            {aula.status === 'cancelada' && (
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                                CANCELADA
                              </span>
                            )}
                            {aula.status === 'agendada' && !situacaoResolvida && (
                              <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">
                                PENDENTE
                              </span>
                            )}
                            {aula.status === 'aprovada' && aula.compareceu === null && (
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                                <i className="fas fa-thumbs-up mr-1"></i>APROVADA
                              </span>
                            )}
                            {aula.compareceu === true && (
                              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                                <i className="fas fa-check mr-1"></i>COMPARECEU
                              </span>
                            )}
                            {aula.compareceu === false && (
                              <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                                <i className="fas fa-times mr-1"></i>FALTOU
                              </span>
                            )}
                          </div>
                          <div className={`flex items-center gap-3 text-sm mt-1 flex-wrap ${situacaoResolvida ? 'text-gray-400' : 'text-gray-500'}`}>
                            <span className="flex items-center gap-1">
                              <i className={`fas fa-phone text-xs ${situacaoResolvida ? 'text-gray-400' : ''}`}></i>
                              {aula.telefoneExperimental}
                            </span>
                            {aula.emailExperimental && (
                              <span className="flex items-center gap-1">
                                <i className={`fas fa-envelope text-xs ${situacaoResolvida ? 'text-gray-400' : ''}`}></i>
                                {aula.emailExperimental}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Data e Horário */}
                      <div className="flex items-center gap-4 text-sm">
                        <div className="text-center min-w-[80px]">
                          <p className={`font-semibold ${
                            situacaoResolvida ? 'text-gray-400' : 'text-gray-700'
                          }`}>
                            {formatarData(aula.data)}
                          </p>
                          <p className={`text-xs ${situacaoResolvida ? 'text-gray-400' : 'text-gray-500'}`}>
                            {aula.horario ? `${aula.horario.horarioInicio} - ${aula.horario.horarioFim}` : 'Horário não definido'}
                          </p>
                        </div>

                        {/* Modalidade */}
                        {modalidade && (
                          <div>
                            <span
                              className="px-2 py-1 rounded-md text-white text-xs font-medium"
                              style={{ backgroundColor: situacaoResolvida ? '#9CA3AF' : (modalidade.cor || '#6B7280') }}
                            >
                              {modalidade.nome}
                            </span>
                          </div>
                        )}

                        {/* Professor */}
                        {professor && (
                          <div className="text-center min-w-[100px]">
                            <p className={`text-xs ${situacaoResolvida ? 'text-gray-400' : 'text-gray-500'}`}>Professor</p>
                            <p className={`font-medium text-sm ${situacaoResolvida ? 'text-gray-400' : 'text-gray-700'}`}>
                              <i className="fas fa-user-tie mr-1 text-gray-400"></i>
                              {professor.nome}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Ações */}
                      <div className="flex items-center gap-2 flex-nowrap">
                        {/* WhatsApp */}
                        <button
                          onClick={() => abrirWhatsApp(aula.telefoneExperimental, aula.nomeExperimental)}
                          className={`p-2 rounded-lg transition-colors ${
                            situacaoResolvida ? 'text-gray-400 hover:bg-gray-200' : 'text-green-600 hover:bg-green-50'
                          }`}
                          title="Abrir WhatsApp"
                        >
                          <i className="fab fa-whatsapp text-lg"></i>
                        </button>

                        {/* Aprovar aula pendente */}
                        {aula.status === 'agendada' && (
                          <button
                            onClick={() => aprovarAula(aula)}
                            disabled={saving}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Aprovar aula experimental"
                          >
                            <i className="fas fa-thumbs-up"></i>
                          </button>
                        )}

                        {/* Desaprovar aula aprovada */}
                        {aula.status === 'aprovada' && aula.compareceu === null && (
                          <button
                            onClick={() => desaprovarAula(aula)}
                            disabled={saving}
                            className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                            title="Desaprovar aula (voltar para pendente)"
                          >
                            <i className="fas fa-thumbs-down"></i>
                          </button>
                        )}

                        {/* Converter em aluno (somente se compareceu) */}
                        {aula.compareceu === true && (
                          <button
                            onClick={() => converterEmAluno(aula)}
                            className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                            title="Converter em aluno"
                          >
                            <i className="fas fa-user-plus"></i>
                          </button>
                        )}

                        {/* Cancelar (pendente ou aprovada, e situação não resolvida) */}
                        {(aula.status === 'agendada' || aula.status === 'aprovada') && !situacaoResolvida && (
                          <button
                            onClick={() => cancelarAula(aula)}
                            disabled={saving}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Cancelar aula"
                          >
                            <i className="fas fa-ban"></i>
                          </button>
                        )}

                        {/* Excluir */}
                        <button
                          onClick={() => excluirAula(aula)}
                          disabled={saving}
                          className={`p-2 rounded-lg transition-colors ${
                            situacaoResolvida ? 'text-gray-400 hover:text-gray-600 hover:bg-gray-200' : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                          }`}
                          title="Excluir aula"
                        >
                          <i className="fas fa-trash-alt"></i>
                        </button>
                      </div>
                    </div>

                    {/* Observações */}
                    {aula.observacoesExperimental && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className={`text-sm ${situacaoResolvida ? 'text-gray-400' : 'text-gray-600'}`}>
                          <i className="fas fa-comment text-gray-400 mr-2"></i>
                          {aula.observacoesExperimental}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </ProtectedPage>
  );
}
