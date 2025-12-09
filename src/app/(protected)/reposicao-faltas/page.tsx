'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'react-toastify';
import ProtectedPage from '@/components/ProtectedPage';
import ReporFaltaModal from '@/components/ReporFaltaModal';

interface Aluno {
  _id: string;
  nome: string;
  email?: string;
  ativo?: boolean;
}

interface Professor {
  _id: string;
  nome: string;
  cor?: string;
}

interface Reposicao {
  _id: string;
  status: string;
  novaData: string;
  novoHorarioInicio: string;
  novoHorarioFim: string;
  horarioFixoId?: string;
}

interface Falta {
  _id: string;
  aulaRealizadaId: string;
  alunoId: Aluno;
  data: string;
  dataFormatada: string;
  modalidade: string;
  horarioInicio: string;
  horarioFim: string;
  horarioFixoId?: string;
  professorId?: Professor;
  professorNome: string;
  statusReposicao: 'disponivel' | 'pendente' | 'aprovada' | 'rejeitada' | 'expirada';
  diasRestantes: number;
  dentroDoPrazo: boolean;
  prazoFinal: string;
  prazoFinalDate: string;
  reposicao: Reposicao | null;
}

interface GrupoAluno {
  aluno: Aluno;
  faltas: Falta[];
}

export default function ReposicaoFaltasPage() {
  const [mounted, setMounted] = useState(false);
  const [faltas, setFaltas] = useState<Falta[]>([]);
  const [faltasFiltradas, setFaltasFiltradas] = useState<Falta[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [busca, setBusca] = useState('');
  
  // Modal de reposição
  const [showReporModal, setShowReporModal] = useState(false);
  const [faltaSelecionada, setFaltaSelecionada] = useState<Falta | null>(null);

  useEffect(() => {
    setMounted(true);
    fetchFaltas();
  }, []);

  const fetchFaltas = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      
      const res = await fetch('/api/reposicao-faltas', { headers });
      const json = await res.json();
      
      if (json.success) {
        setFaltas(json.data || []);
      } else {
        toast.error('Erro ao carregar faltas');
      }
    } catch (error) {
      console.error('Erro ao buscar faltas:', error);
      toast.error('Erro ao carregar faltas');
    } finally {
      setInitialLoading(false);
    }
  };

  // Filtrar faltas
  useEffect(() => {
    let filtered = faltas.filter(f => f.alunoId && f.alunoId._id && f.alunoId.nome);

    // Filtro por busca
    if (busca) {
      const buscaLower = busca.toLowerCase();
      filtered = filtered.filter(f => 
        (f.alunoId?.nome || '').toLowerCase().includes(buscaLower) ||
        (f.modalidade || '').toLowerCase().includes(buscaLower) ||
        (f.professorNome || '').toLowerCase().includes(buscaLower)
      );
    }

    setFaltasFiltradas(filtered);
  }, [faltas, busca]);

  // Agrupar faltas por aluno
  const gruposAlunos = useMemo(() => {
    const grupos: Record<string, GrupoAluno> = {};
    
    for (const falta of faltasFiltradas) {
      const alunoId = falta.alunoId._id;
      if (!grupos[alunoId]) {
        grupos[alunoId] = {
          aluno: falta.alunoId,
          faltas: []
        };
      }
      grupos[alunoId].faltas.push(falta);
    }
    
    // Ordenar faltas de cada aluno por data (mais recente primeiro)
    Object.values(grupos).forEach(grupo => {
      grupo.faltas.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
    });
    
    // Ordenar grupos: primeiro os que têm faltas disponíveis para repor
    return Object.values(grupos).sort((a, b) => {
      const aDisponiveis = a.faltas.filter(f => f.statusReposicao === 'disponivel').length;
      const bDisponiveis = b.faltas.filter(f => f.statusReposicao === 'disponivel').length;
      if (aDisponiveis > 0 && bDisponiveis === 0) return -1;
      if (bDisponiveis > 0 && aDisponiveis === 0) return 1;
      return a.aluno.nome.localeCompare(b.aluno.nome);
    });
  }, [faltasFiltradas]);

  const handleAbrirReporModal = (falta: Falta) => {
    setFaltaSelecionada(falta);
    setShowReporModal(true);
  };

  const handleFecharReporModal = () => {
    setShowReporModal(false);
    setFaltaSelecionada(null);
  };

  const handleReposicaoSuccess = () => {
    handleFecharReporModal();
    fetchFaltas(); // Recarregar faltas
    toast.success('Reposição agendada com sucesso!');
  };

  const getStatusInfo = (status: string, diasRestantes: number) => {
    switch (status) {
      case 'aprovada':
        return { 
          bgColor: 'bg-green-50 border-green-200', 
          badgeColor: 'bg-green-100 text-green-700',
          icon: 'fa-check-circle',
          iconColor: 'text-green-500',
          label: 'Reposta'
        };
      case 'pendente':
        return { 
          bgColor: 'bg-yellow-50 border-yellow-200', 
          badgeColor: 'bg-yellow-100 text-yellow-700',
          icon: 'fa-clock',
          iconColor: 'text-yellow-500',
          label: 'Aguardando'
        };
      case 'rejeitada':
        return { 
          bgColor: 'bg-red-50 border-red-200', 
          badgeColor: 'bg-red-100 text-red-700',
          icon: 'fa-times-circle',
          iconColor: 'text-red-500',
          label: 'Rejeitada'
        };
      case 'expirada':
        return { 
          bgColor: 'bg-gray-50 border-gray-200', 
          badgeColor: 'bg-gray-100 text-gray-500',
          icon: 'fa-ban',
          iconColor: 'text-gray-400',
          label: 'Expirada'
        };
      default: // disponivel
        return { 
          bgColor: 'bg-orange-50 border-orange-200', 
          badgeColor: 'bg-orange-100 text-orange-700',
          icon: 'fa-exclamation-circle',
          iconColor: 'text-orange-500',
          label: `${diasRestantes}d`
        };
    }
  };

  const formatarData = (dataStr: string) => {
    const data = new Date(dataStr);
    return data.toLocaleDateString('pt-BR');
  };

  if (!mounted) return null;

  return (
    <ProtectedPage tab="reposicao-faltas">
      <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
        {/* Header Desktop */}
        <div className="hidden md:flex items-center justify-between gap-4 mb-6 fade-in-1">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <i className="fas fa-history text-orange-500"></i>
              Reposição de Faltas
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Gerencie as reposições de faltas dos alunos
            </p>
          </div>
        </div>

        {/* Header Mobile */}
        <div className="md:hidden flex items-center justify-between mb-4 fade-in-1">
          <h1 className="text-lg font-semibold text-gray-900">Reposição de Faltas</h1>
        </div>

        {/* Campo de Busca - Desktop */}
        <div className="hidden md:block mb-4 fade-in-2">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <i className="fas fa-search text-gray-400"></i>
            </div>
            <input
              type="text"
              placeholder="Buscar por aluno, modalidade ou professor..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-0 focus:border-gray-300 outline-none"
            />
            {busca && (
              <button
                onClick={() => setBusca('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <i className="fas fa-times"></i>
              </button>
            )}
            </div>
          </div>

          {/* Campo de Busca - Mobile */}
          <div className="md:hidden mb-4 fade-in-2">
            <div className="relative">
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
              <input
                type="text"
                placeholder="Buscar aluno..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-sm bg-white"
              />
              {busca && (
                <button
                  onClick={() => setBusca('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  <i className="fas fa-times text-sm"></i>
                </button>
              )}
            </div>
          </div>

          {/* Lista de faltas */}
          <div className="md:bg-white md:shadow md:rounded-lg fade-in-3">
            <div className="md:px-4 md:py-5 md:p-6">
              {initialLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="animate-pulse bg-gray-100 rounded-lg p-4 h-32"></div>
                  ))}
                </div>
              ) : faltasFiltradas.length === 0 ? (
                <div className="text-center py-12">
                  <i className="fas fa-history text-4xl text-gray-400 mb-3"></i>
                  <p className="text-gray-600">
                    {busca
                      ? 'Nenhuma falta encontrada com os filtros aplicados'
                      : 'Nenhuma falta registrada'
                    }
                  </p>
                </div>
              ) : (
                <div className="space-y-3 md:space-y-4">
                  {gruposAlunos.map((grupo) => {
                    // Calcular totais do aluno
                    const totalFaltas = grupo.faltas.length;
                    const disponiveis = grupo.faltas.filter(f => f.statusReposicao === 'disponivel').length;
                    const pendentes = grupo.faltas.filter(f => f.statusReposicao === 'pendente').length;
                    const aprovadas = grupo.faltas.filter(f => f.statusReposicao === 'aprovada').length;
                    const expiradas = grupo.faltas.filter(f => f.statusReposicao === 'expirada').length;
                    
                    const temDisponiveis = disponiveis > 0;
                    const todasExpiradas = expiradas === totalFaltas;
                    const todasRepostas = aprovadas === totalFaltas;
                    
                    return (
                      <div key={grupo.aluno._id} className={`border rounded-xl md:rounded-lg shadow-sm md:shadow-none p-3 md:p-5 transition-colors ${
                        todasRepostas
                          ? 'bg-white md:bg-green-50 border-green-200 md:border-green-300'
                          : todasExpiradas
                          ? 'bg-white md:bg-gray-100 border-gray-200 md:border-gray-300'
                          : temDisponiveis
                          ? 'border-orange-200 md:border-orange-300 bg-white md:bg-orange-50'
                          : 'bg-white md:bg-gray-50 border-gray-200'
                      }`}>
                        
                        {/* Layout Mobile */}
                        <div className="block lg:hidden">
                          {/* Header */}
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-gray-900 truncate">{grupo.aluno.nome}</p>
                              <p className="text-[10px] text-gray-500 mt-0.5">
                                <i className="fas fa-history mr-0.5"></i>
                                {totalFaltas} falta{totalFaltas > 1 ? 's' : ''}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                                todasRepostas
                                  ? 'bg-green-100 text-green-700'
                                  : todasExpiradas
                                  ? 'bg-gray-200 text-gray-600'
                                  : temDisponiveis
                                  ? 'bg-orange-100 text-orange-700'
                                  : 'bg-yellow-100 text-yellow-700'
                              }`}>
                                {todasRepostas ? 'REPOSTAS' : todasExpiradas ? 'EXPIRADAS' : temDisponiveis ? `${disponiveis} DISP` : `${pendentes} PEND`}
                              </span>
                            </div>
                          </div>

                          {/* Info Grid */}
                          <div className="bg-orange-50 border border-orange-200 rounded p-2 text-center mb-2">
                            <div className="text-[10px] text-gray-500 mb-0.5">Faltas para Repor</div>
                            <div className="text-lg font-bold text-gray-800">
                              {disponiveis}<span className="text-sm text-gray-400">/{totalFaltas}</span>
                            </div>
                          </div>

                          {/* Lista de faltas com scroll */}
                          <div className="max-h-[180px] overflow-y-auto space-y-1.5 mb-2">
                            {grupo.faltas.map((falta) => {
                              const statusInfo = getStatusInfo(falta.statusReposicao, falta.diasRestantes);
                              const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
                              const dataFalta = new Date(falta.data);
                              
                              return (
                                <div 
                                  key={falta._id} 
                                  className={`rounded p-2 border ${statusInfo.bgColor}`}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      <i className={`fas ${statusInfo.icon} ${statusInfo.iconColor} text-sm`}></i>
                                      
                                      <div className="flex-1 min-w-0">
                                        <p className="text-[10px] text-gray-700 font-medium">
                                          {diasSemana[dataFalta.getDay()]}, {falta.dataFormatada} às {falta.horarioInicio}
                                        </p>
                                        <div className="flex flex-wrap gap-1 mt-0.5">
                                          {falta.modalidade && (
                                            <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-medium bg-gray-200 text-gray-700">
                                              <i className="fas fa-dumbbell text-[6px] text-gray-500"></i>
                                              {falta.modalidade}
                                            </span>
                                          )}
                                          {falta.professorNome && falta.professorNome !== 'Não informado' && (
                                            <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-medium bg-gray-200 text-gray-700">
                                              <i className="fas fa-user-tie text-[6px] text-gray-500"></i>
                                              {falta.professorNome}
                                            </span>
                                          )}
                                        </div>
                                        
                                        {/* Info da reposição se existir */}
                                        {falta.reposicao && falta.statusReposicao !== 'rejeitada' && (
                                          <p className="text-[8px] text-gray-600 mt-1">
                                            <i className="fas fa-arrow-right mr-0.5"></i>
                                            Repor: {formatarData(falta.reposicao.novaData)} às {falta.reposicao.novoHorarioInicio}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-0.5 flex-shrink-0">
                                      <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium ${statusInfo.badgeColor}`}>
                                        {statusInfo.label}
                                      </span>
                                      {(falta.statusReposicao === 'disponivel' || falta.statusReposicao === 'rejeitada') && (
                                        <button
                                          onClick={() => handleAbrirReporModal(falta)}
                                          className="w-6 h-6 inline-flex items-center justify-center text-orange-600 hover:text-orange-700 rounded transition-colors"
                                          title="Agendar reposição"
                                        >
                                          <i className="fas fa-redo text-[10px]"></i>
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Layout Desktop */}
                        <div className="hidden lg:flex items-start gap-6">
                          
                          {/* Coluna 1: Aluno + Status */}
                          <div className="flex-shrink-0 w-56">
                            <p className="text-lg font-bold text-gray-900 mb-2">{grupo.aluno.nome}</p>
                            <p className="text-xs text-gray-500 mb-3">
                              <i className="fas fa-history mr-1"></i>
                              {totalFaltas} falta{totalFaltas > 1 ? 's' : ''} registrada{totalFaltas > 1 ? 's' : ''}
                            </p>
                            <div className="flex flex-col gap-2">
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-semibold ${
                                todasRepostas
                                  ? 'bg-green-100 text-green-800 border border-green-200'
                                  : todasExpiradas
                                  ? 'bg-gray-200 text-gray-700 border border-gray-300'
                                  : temDisponiveis
                                  ? 'bg-orange-100 text-orange-800 border border-orange-200'
                                  : 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                              }`}>
                                <i className={`fas ${todasRepostas ? 'fa-check-circle' : todasExpiradas ? 'fa-ban' : temDisponiveis ? 'fa-exclamation-circle' : 'fa-clock'}`}></i>
                                {todasRepostas ? 'Repostas' : todasExpiradas ? 'Expiradas' : temDisponiveis ? 'Disponíveis' : 'Pendentes'}
                              </span>
                              <div className="flex items-center justify-between px-3 py-2 bg-orange-50 border border-orange-200 rounded">
                                <span className="text-xs text-gray-600">Para Repor</span>
                                <span className="text-lg font-bold text-orange-800">
                                  {disponiveis}<span className="text-sm text-gray-500">/{totalFaltas}</span>
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Coluna 2: Lista de Faltas com Scroll */}
                          <div className="flex-1">
                            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                              <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 flex items-center justify-between">
                                <span className="text-sm font-semibold text-gray-700">
                                  <i className="fas fa-history mr-2"></i>
                                  Faltas
                                </span>
                                <span className="text-xs text-gray-500">
                                  {disponiveis} disponíveis de {totalFaltas}
                                </span>
                              </div>
                              <div className="max-h-[200px] overflow-y-auto">
                                <table className="w-full">
                                  <thead className="bg-gray-50 sticky top-0 z-10">
                                    <tr className="border-b border-gray-200">
                                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 w-24">Status</th>
                                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Data/Horário</th>
                                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Modalidade</th>
                                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Professor</th>
                                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 w-24">Prazo</th>
                                      <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 w-20">Ações</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {grupo.faltas.map((falta) => {
                                      const statusInfo = getStatusInfo(falta.statusReposicao, falta.diasRestantes);
                                      const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
                                      const dataFalta = new Date(falta.data);
                                      
                                      return (
                                        <tr 
                                          key={falta._id} 
                                          className={`hover:bg-gray-50 transition-colors ${
                                            falta.statusReposicao === 'expirada' 
                                              ? 'bg-gray-50/30' 
                                              : falta.statusReposicao === 'aprovada'
                                                ? 'bg-green-50/30'
                                                : falta.statusReposicao === 'disponivel'
                                                  ? 'bg-orange-50/30'
                                                  : 'bg-yellow-50/30'
                                          }`}
                                        >
                                          <td className="px-3 py-2 text-xs whitespace-nowrap">
                                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${statusInfo.badgeColor}`}>
                                              <i className={`fas ${statusInfo.icon} text-[8px]`}></i>
                                              {statusInfo.label}
                                            </span>
                                          </td>
                                          <td className="px-3 py-2 text-xs text-gray-700">
                                            <p className="font-medium text-[10px]">
                                              <i className="fas fa-calendar text-gray-400 mr-1"></i>
                                              {diasSemana[dataFalta.getDay()]}, {falta.dataFormatada} às {falta.horarioInicio}
                                            </p>
                                            {falta.reposicao && falta.statusReposicao !== 'rejeitada' && (
                                              <p className="text-[9px] text-green-600 mt-0.5">
                                                <i className="fas fa-arrow-right mr-1"></i>
                                                Repor: {formatarData(falta.reposicao.novaData)} às {falta.reposicao.novoHorarioInicio}
                                              </p>
                                            )}
                                          </td>
                                          <td className="px-3 py-2 text-xs">
                                            {falta.modalidade ? (
                                              <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-200 text-gray-700">
                                                <i className="fas fa-dumbbell text-[8px] text-gray-500"></i>
                                                {falta.modalidade}
                                              </span>
                                            ) : (
                                              <span className="text-gray-400 italic text-[10px]">-</span>
                                            )}
                                          </td>
                                          <td className="px-3 py-2 text-xs">
                                            {falta.professorNome && falta.professorNome !== 'Não informado' ? (
                                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-700">
                                                <i className="fas fa-user-tie text-[8px] text-gray-500"></i>
                                                {falta.professorNome}
                                              </span>
                                            ) : (
                                              <span className="text-gray-400 italic text-[10px]">-</span>
                                            )}
                                          </td>
                                          <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                                            <span className={`text-[10px] ${falta.statusReposicao === 'expirada' ? 'text-red-500' : ''}`}>
                                              {falta.prazoFinal}
                                            </span>
                                          </td>
                                          <td className="px-3 py-2 text-center">
                                            <div className="flex items-center justify-center gap-0.5">
                                              {(falta.statusReposicao === 'disponivel' || falta.statusReposicao === 'rejeitada') && (
                                                <button
                                                  onClick={() => handleAbrirReporModal(falta)}
                                                  className="inline-flex items-center justify-center w-6 h-6 text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded transition-colors"
                                                  title="Agendar reposição"
                                                >
                                                  <i className="fas fa-redo text-[10px]"></i>
                                                </button>
                                              )}
                                              {falta.statusReposicao === 'aprovada' && (
                                                <span className="text-green-500">
                                                  <i className="fas fa-check text-[10px]"></i>
                                                </span>
                                              )}
                                              {falta.statusReposicao === 'pendente' && (
                                                <span className="text-yellow-500">
                                                  <i className="fas fa-hourglass-half text-[10px]"></i>
                                                </span>
                                              )}
                                              {falta.statusReposicao === 'expirada' && (
                                                <span className="text-gray-400">
                                                  <i className="fas fa-ban text-[10px]"></i>
                                                </span>
                                              )}
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

      {/* Modal de Reposição */}
      {showReporModal && faltaSelecionada && (
        <ReporFaltaModal
          open={showReporModal}
          onClose={handleFecharReporModal}
          alunoId={faltaSelecionada.alunoId._id}
          alunoNome={faltaSelecionada.alunoId.nome}
          falta={{
            aulaRealizadaId: faltaSelecionada.aulaRealizadaId,
            data: faltaSelecionada.data,
            horarioInicio: faltaSelecionada.horarioInicio,
            horarioFim: faltaSelecionada.horarioFim,
            horarioFixoId: faltaSelecionada.horarioFixoId || '',
            modalidade: faltaSelecionada.modalidade,
            diasRestantes: faltaSelecionada.diasRestantes,
            prazoFinal: faltaSelecionada.prazoFinal,
          }}
          onSuccess={handleReposicaoSuccess}
        />
      )}
    </ProtectedPage>
  );
}
