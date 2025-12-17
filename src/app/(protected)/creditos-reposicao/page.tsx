'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import ProtectedPage from '@/components/ProtectedPage';
import UsarCreditoModal from '@/components/UsarCreditoModal';

interface Aluno {
  _id: string;
  nome: string;
  email?: string;
}

interface Modalidade {
  _id: string;
  nome: string;
  cor?: string;
}

interface User {
  _id: string;
  nome: string;
  email?: string;
}

interface UsoCredito {
  _id: string;
  creditoId: string;
  alunoId: string;
  agendamentoId?: {
    _id: string;
    diaSemana?: number;
    horarioInicio?: string;
    horarioFim?: string;
    modalidadeId?: Modalidade;
    professorId?: { nome?: string; cor?: string };
  };
  tipoAgendamento: string;
  dataUso: string;
  observacao?: string;
  criadoEm: string;
}

interface CreditoReposicao {
  _id: string;
  alunoId: Aluno;
  quantidade: number;
  quantidadeUsada: number;
  modalidadeId?: Modalidade;
  motivo: string;
  validade: string;
  concedidoPor: User;
  ativo: boolean;
  criadoEm: string;
  usos?: UsoCredito[];
}

export default function CreditosReposicaoPage() {
  const [mounted, setMounted] = useState(false);
  const [creditos, setCreditos] = useState<CreditoReposicao[]>([]);
  const [creditosFiltrados, setCreditosFiltrados] = useState<CreditoReposicao[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showUsarModal, setShowUsarModal] = useState(false);
  const [creditoSelecionado, setCreditoSelecionado] = useState<CreditoReposicao | null>(null);
  const [salvando, setSalvando] = useState(false);
  
  // Form states
  const [alunoIdForm, setAlunoIdForm] = useState('');
  const [buscaAluno, setBuscaAluno] = useState('');
  const [quantidade, setQuantidade] = useState('1');
  const [modalidadeId, setModalidadeId] = useState('');
  const [motivo, setMotivo] = useState('');
  const [validade, setValidade] = useState('');
  
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [modalidades, setModalidades] = useState<Modalidade[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchCreditos = useCallback(async () => {
    try {
      // Busca todos os créditos (sem filtro) para exibir histórico completo
      const res = await fetch('/api/creditos-reposicao');
      
      if (res.ok) {
        const data = await res.json();
        setCreditos(data);
      } else {
        toast.error('Erro ao carregar créditos');
      }
    } catch (error) {
      console.error('Erro ao buscar créditos:', error);
      toast.error('Erro ao buscar créditos');
    } finally {
      setInitialLoading(false);
    }
  }, []);

  const fetchAlunos = async () => {
    try {
      const res = await fetch('/api/alunos');
      if (res.ok) {
        const data = await res.json();
        const alunosArray = Array.isArray(data) ? data : (data.data || []);
        setAlunos(alunosArray.filter((a: any) => a.ativo));
      }
    } catch (error) {
      console.error('Erro ao buscar alunos:', error);
    }
  };

  const fetchModalidades = async () => {
    try {
      const res = await fetch('/api/modalidades');
      if (res.ok) {
        const data = await res.json();
        const modalidadesArray = Array.isArray(data) ? data : (data.data || []);
        setModalidades(modalidadesArray.filter((m: any) => m.ativo));
      }
    } catch (error) {
      console.error('Erro ao buscar modalidades:', error);
    }
  };

  useEffect(() => {
    fetchCreditos();
    fetchAlunos();
    fetchModalidades();
  }, [fetchCreditos]);

  // Filtrar créditos
  useEffect(() => {
    // Primeiro filtra créditos com alunoId válido
    let filtered = creditos.filter(c => c.alunoId && c.alunoId._id && c.alunoId.nome);

    // Filtro por busca
    if (busca) {
      const buscaLower = busca.toLowerCase();
      filtered = filtered.filter(c => 
        (c.alunoId?.nome || '').toLowerCase().includes(buscaLower) ||
        (c.motivo || '').toLowerCase().includes(buscaLower) ||
        (c.modalidadeId?.nome || '').toLowerCase().includes(buscaLower)
      );
    }

    setCreditosFiltrados(filtered);
  }, [creditos, busca]);

  const resetForm = () => {
    setAlunoIdForm('');
    setBuscaAluno('');
    setQuantidade('1');
    setModalidadeId('');
    setMotivo('');
    setValidade('');
  };

  const abrirModalNovo = () => {
    resetForm();
    
    // Data padrão: 3 meses a partir de hoje
    const dataFutura = new Date();
    dataFutura.setMonth(dataFutura.getMonth() + 3);
    setValidade(dataFutura.toISOString().split('T')[0]);
    
    setShowModal(true);
  };

  const fecharModal = () => {
    setShowModal(false);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!alunoIdForm || !quantidade || !motivo || !validade) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setSalvando(true);

    try {
      const body = {
        alunoId: alunoIdForm,
        quantidade: parseInt(quantidade),
        modalidadeId: modalidadeId || null,
        motivo,
        validade
      };

      const res = await fetch('/api/creditos-reposicao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        toast.success('Crédito concedido!');
        fecharModal();
        fetchCreditos();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Erro ao salvar crédito');
      }
    } catch (error) {
      console.error('Erro ao salvar crédito:', error);
      toast.error('Erro ao salvar crédito');
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async (credito: CreditoReposicao) => {
    const result = await Swal.fire({
      title: 'Confirmar exclusão',
      html: `
        <p>Deseja remover o crédito de <strong>${credito.alunoId.nome}</strong>?</p>
        ${credito.quantidadeUsada > 0 
          ? `<p class="text-amber-600 text-sm mt-2">⚠️ Este crédito já foi usado ${credito.quantidadeUsada}x e será apenas desativado.</p>`
          : ''
        }
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sim, remover',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        const res = await fetch(`/api/creditos-reposicao?id=${credito._id}`, {
          method: 'DELETE'
        });

        if (res.ok) {
          toast.success('Crédito removido!');
          fetchCreditos();
        } else {
          const data = await res.json();
          toast.error(data.error || 'Erro ao remover crédito');
        }
      } catch (error) {
        console.error('Erro ao remover crédito:', error);
        toast.error('Erro ao remover crédito');
      }
    }
  };

  const handleAbrirUsarModal = (credito: CreditoReposicao) => {
    setCreditoSelecionado(credito);
    setShowUsarModal(true);
  };

  const handleCancelarUso = async (uso: UsoCredito) => {
    const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const dataUso = new Date(uso.dataUso);
    const dataFormatada = dataUso.toLocaleDateString('pt-BR');
    const horario = uso.agendamentoId?.horarioInicio || '';
    const diaSemana = uso.agendamentoId?.diaSemana !== undefined ? diasSemana[uso.agendamentoId.diaSemana] : '';
    
    const result = await Swal.fire({
      title: 'Cancelar agendamento?',
      html: `
        <p>Deseja cancelar a aula agendada para:</p>
        <p class="font-semibold mt-2">${diaSemana}, ${dataFormatada} às ${horario}</p>
        <p class="text-green-600 text-sm mt-2">✓ O crédito será devolvido ao aluno</p>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sim, cancelar',
      cancelButtonText: 'Manter'
    });

    if (result.isConfirmed) {
      try {
        const res = await fetch(`/api/creditos-reposicao/usar?usoId=${uso._id}`, {
          method: 'DELETE'
        });

        if (res.ok) {
          toast.success('Agendamento cancelado! Crédito devolvido.');
          fetchCreditos();
        } else {
          const data = await res.json();
          toast.error(data.error || 'Erro ao cancelar');
        }
      } catch (error) {
        console.error('Erro ao cancelar uso:', error);
        toast.error('Erro ao cancelar uso');
      }
    }
  };

  // Helper para parsear data sem problema de timezone UTC
  const parseDataLocal = (dataStr: string): Date => {
    if (!dataStr) return new Date();
    const str = dataStr.split('T')[0];
    const [ano, mes, dia] = str.split('-').map(Number);
    return new Date(ano, mes - 1, dia, 12, 0, 0);
  };

  const formatarData = (dataStr: string) => {
    const data = parseDataLocal(dataStr);
    return data.toLocaleDateString('pt-BR');
  };

  const isExpirado = (validadeStr: string) => {
    return parseDataLocal(validadeStr) <= new Date();
  };

  // Agrupar créditos por aluno (filtrando créditos com alunoId nulo)
  const creditosAgrupados = creditosFiltrados
    .filter(credito => credito.alunoId && credito.alunoId._id)
    .reduce((acc, credito) => {
    const alunoId = credito.alunoId._id;
    if (!acc[alunoId]) {
      acc[alunoId] = {
        aluno: credito.alunoId,
        creditos: []
      };
    }
    acc[alunoId].creditos.push(credito);
    return acc;
  }, {} as Record<string, { aluno: Aluno; creditos: CreditoReposicao[] }>);

  const gruposAlunos = Object.values(creditosAgrupados);

  // Skeleton loading
  if (!mounted || initialLoading) {
    return (
      <ProtectedPage tab="creditos" title="Créditos de Reposição - Superação Flux" fullWidth customLoading>
        <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
          {/* Header skeleton - Desktop */}
          <div className="hidden md:flex items-center justify-between gap-4 mb-6">
            <div>
              <div className="h-6 bg-gray-200 rounded w-48 mb-2 animate-pulse" />
              <div className="h-4 bg-gray-200 rounded w-80 animate-pulse" />
            </div>
            <div className="h-10 w-36 bg-gray-200 rounded-full animate-pulse" />
          </div>
          
          {/* Header skeleton - Mobile */}
          <div className="md:hidden flex items-center justify-between mb-4">
            <div className="h-5 bg-gray-200 rounded w-32 animate-pulse" />
            <div className="w-9 h-9 bg-gray-200 rounded-full animate-pulse" />
          </div>
          
          {/* Tabs skeleton - Desktop */}
          <div className="hidden md:block mb-6 border-b border-gray-200 pb-2">
            <div className="flex gap-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-6 bg-gray-200 rounded w-24 animate-pulse" />
              ))}
            </div>
          </div>
          
          {/* Tabs skeleton - Mobile */}
          <div className="md:hidden mb-4">
            <div className="flex gap-2">
              {[1, 2, 3, 4].map(i => (
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
                      <div className="h-5 bg-gray-200 rounded w-32 animate-pulse" />
                      <div className="h-5 bg-gray-200 rounded-full w-20 animate-pulse" />
                    </div>
                    <div className="h-4 bg-gray-200 rounded w-24 animate-pulse" />
                  </div>
                  <div className="flex-1 grid grid-cols-3 gap-4">
                    <div className="bg-gray-50 rounded p-3 space-y-2">
                      <div className="h-3 bg-gray-200 rounded w-16 animate-pulse" />
                      <div className="h-4 bg-gray-200 rounded w-20 animate-pulse" />
                    </div>
                    <div className="bg-gray-50 rounded p-3 space-y-2">
                      <div className="h-3 bg-gray-200 rounded w-16 animate-pulse" />
                      <div className="h-4 bg-gray-200 rounded w-20 animate-pulse" />
                    </div>
                    <div className="bg-gray-50 rounded p-3 space-y-2">
                      <div className="h-3 bg-gray-200 rounded w-16 animate-pulse" />
                      <div className="h-4 bg-gray-200 rounded w-20 animate-pulse" />
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
                  <div className="h-5 bg-gray-200 rounded-full w-16" />
                </div>
                <div className="grid grid-cols-2 gap-1.5 mb-2">
                  <div className="bg-gray-50 rounded p-2 text-center">
                    <div className="h-2 bg-gray-200 rounded w-10 mx-auto mb-1" />
                    <div className="h-3 bg-gray-200 rounded w-14 mx-auto" />
                  </div>
                  <div className="bg-gray-50 rounded p-2 text-center">
                    <div className="h-2 bg-gray-200 rounded w-10 mx-auto mb-1" />
                    <div className="h-3 bg-gray-200 rounded w-14 mx-auto" />
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
    <ProtectedPage tab="creditos" title="Créditos de Reposição - Superação Flux" fullWidth>
      <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
        {/* Header Desktop */}
        <div className="hidden md:flex items-center justify-between gap-4 mb-6 fade-in-1">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <i className="fas fa-ticket-alt text-green-600"></i>
              Créditos de Reposição
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Gerencie créditos de aulas extras concedidos aos alunos
            </p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={abrirModalNovo}
              className="inline-flex transition-colors duration-200 items-center justify-center rounded-full bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 sm:w-auto"
            >
              <i className="fas fa-plus mr-2"></i>
              Conceder Crédito
            </button>
          </div>
        </div>

        {/* Header Mobile */}
        <div className="md:hidden flex items-center justify-between mb-4 fade-in-1">
          <h1 className="text-lg font-semibold text-gray-900">Créditos</h1>
          <button
            type="button"
            onClick={abrirModalNovo}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-green-600 text-white"
          >
            <i className="fas fa-plus text-sm"></i>
          </button>
        </div>

        {/* Campo de Busca - Desktop */}
        <div className="hidden md:block mb-4 fade-in-2">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <i className="fas fa-search text-gray-400"></i>
            </div>
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome do aluno, motivo ou modalidade..."
              className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg text-sm outline-none"
            />
            {busca && (
              <button
                onClick={() => setBusca('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                <i className="fas fa-times"></i>
              </button>
            )}
          </div>
        </div>

        {/* Campo de Busca - Mobile */}
        <div className="md:hidden mb-3 fade-in-2">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <i className="fas fa-search text-gray-400 text-sm"></i>
            </div>
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar aluno..."
              className="block w-full pl-9 pr-9 py-2 border border-gray-200 rounded-lg text-sm outline-none"
            />
            {busca && (
              <button
                onClick={() => setBusca('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                <i className="fas fa-times text-sm"></i>
              </button>
            )}
          </div>
        </div>

        {/* Lista de créditos */}
        <div className="md:bg-white md:shadow md:rounded-lg fade-in-3">
          <div className="md:px-4 md:py-5 md:p-6">
            {creditosFiltrados.length === 0 ? (
              <div className="text-center py-12">
                <i className="fas fa-ticket-alt text-4xl text-gray-400 mb-3"></i>
                <p className="text-gray-600">
                  {busca
                    ? 'Nenhum crédito encontrado com os filtros aplicados'
                    : 'Nenhum crédito de reposição cadastrado'
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-3 md:space-y-4">
                {gruposAlunos.map((grupo) => {
                  // Calcular totais do aluno
                  const totalCreditos = grupo.creditos.reduce((sum, c) => sum + c.quantidade, 0);
                  const totalUsados = grupo.creditos.reduce((sum, c) => sum + c.quantidadeUsada, 0);
                  const totalDisponiveis = totalCreditos - totalUsados;
                  const temExpirados = grupo.creditos.some(c => isExpirado(c.validade));
                  const todosExpirados = grupo.creditos.every(c => isExpirado(c.validade));
                  
                  return (
                    <div key={grupo.aluno._id} className={`border rounded-xl md:rounded-lg shadow-sm md:shadow-none p-3 md:p-5 transition-colors ${
                      todosExpirados
                        ? 'bg-white md:bg-gray-100 border-gray-200 md:border-gray-300'
                        : totalDisponiveis === 0
                        ? 'bg-white md:bg-gray-50 border-gray-200'
                        : 'border-green-200 md:border-green-300 bg-white md:bg-green-50'
                    }`}>
                      
                      {/* Layout Mobile */}
                      <div className="block lg:hidden">
                        {/* Header */}
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-900 truncate">{grupo.aluno.nome}</p>
                            <p className="text-[10px] text-gray-500 mt-0.5">
                              <i className="fas fa-layer-group mr-0.5"></i>
                              {grupo.creditos.length} concessão{grupo.creditos.length > 1 ? 'ões' : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                              todosExpirados
                                ? 'bg-red-100 text-red-700'
                                : totalDisponiveis === 0
                                ? 'bg-gray-200 text-gray-600'
                                : 'bg-green-100 text-green-700'
                            }`}>
                              {todosExpirados ? 'EXPIRADO' : totalDisponiveis === 0 ? 'ESGOTADO' : `${totalDisponiveis} DISP`}
                            </span>
                          </div>
                        </div>

                        {/* Info Grid */}
                        <div className="bg-blue-50 border border-blue-200 rounded p-2 text-center mb-2">
                          <div className="text-[10px] text-gray-500 mb-0.5">Total de Créditos</div>
                          <div className="text-lg font-bold text-gray-800">
                            {totalDisponiveis}<span className="text-sm text-gray-400">/{totalCreditos}</span>
                          </div>
                        </div>

                        {/* Lista de créditos individuais com scroll */}
                        <div className="max-h-[180px] overflow-y-auto space-y-1.5 mb-2">
                          {grupo.creditos.flatMap((credito) => {
                            const expirado = isExpirado(credito.validade);
                            const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
                            const usos = credito.usos || [];
                            
                            // Criar array com cada unidade de crédito
                            const unidades = [];
                            for (let i = 0; i < credito.quantidade; i++) {
                              const uso = usos[i]; // Uso correspondente (se existir)
                              const isUsado = !!uso;
                              
                              unidades.push(
                                <div 
                                  key={`credito-${credito._id}-unidade-${i}`} 
                                  className={`rounded p-2 border ${
                                    expirado 
                                      ? 'bg-red-50 border-red-200' 
                                      : isUsado 
                                        ? 'bg-blue-50 border-blue-200' 
                                        : 'bg-green-50 border-green-200'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold flex-shrink-0 ${
                                        expirado
                                          ? 'bg-red-200 text-red-700'
                                          : isUsado
                                            ? 'bg-blue-200 text-blue-700'
                                            : 'bg-green-200 text-green-700'
                                      }`}>
                                        {i + 1}
                                      </span>
                                      
                                      {isUsado ? (
                                        <div className="flex-1 min-w-0">
                                          <p className="text-[10px] text-blue-700 font-medium">
                                            <i className="fas fa-calendar-check mr-1"></i>
                                            {diasSemana[uso.agendamentoId?.diaSemana ?? 0]}, {new Date(uso.dataUso).toLocaleDateString('pt-BR')} às {uso.agendamentoId?.horarioInicio || '--:--'}
                                          </p>
                                          <div className="flex flex-wrap gap-1 mt-0.5">
                                            {uso.agendamentoId?.modalidadeId && (
                                              <span className="inline-flex items-center gap-1 px-1 py-0.5 rounded text-[8px] font-medium bg-gray-200 text-gray-700">
                                                <span 
                                                  className="w-2 h-2 rounded-full flex-shrink-0"
                                                  style={{ backgroundColor: uso.agendamentoId.modalidadeId.cor || '#6B7280' }}
                                                ></span>
                                                {uso.agendamentoId.modalidadeId.nome}
                                              </span>
                                            )}
                                            {uso.agendamentoId?.professorId?.nome && (
                                              <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-medium bg-gray-200 text-gray-700">
                                                <i className="fas fa-user-tie text-[6px] text-gray-500"></i>
                                                {uso.agendamentoId.professorId.nome}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="flex-1 min-w-0">
                                          <p className={`text-[10px] font-medium ${expirado ? 'text-red-600' : 'text-green-700'}`}>
                                            <i className={`fas ${expirado ? 'fa-clock' : 'fa-ticket-alt'} mr-1`}></i>
                                            {expirado ? 'Expirado' : 'Disponível'}
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                    
                                    <div className="flex items-center gap-0.5 flex-shrink-0">
                                      {isUsado ? (
                                        <button
                                          onClick={() => handleCancelarUso(uso)}
                                          className="w-6 h-6 inline-flex items-center justify-center text-red-500 hover:text-red-600 rounded transition-colors"
                                          title="Cancelar uso"
                                        >
                                          <i className="fas fa-times-circle text-[10px]"></i>
                                        </button>
                                      ) : !expirado ? (
                                        <button
                                          onClick={() => handleAbrirUsarModal(credito)}
                                          className="w-6 h-6 inline-flex items-center justify-center text-green-600 hover:text-green-700 rounded transition-colors"
                                          title="Usar crédito"
                                        >
                                          <i className="fas fa-calendar-plus text-[10px]"></i>
                                        </button>
                                      ) : null}
                                      <button
                                        onClick={() => handleExcluir(credito)}
                                        className="w-6 h-6 inline-flex items-center justify-center text-gray-400 hover:text-red-600 rounded transition-colors"
                                        title="Excluir crédito"
                                      >
                                        <i className="fas fa-trash text-[10px]"></i>
                                      </button>
                                    </div>
                                  </div>
                                  {/* Justificativa */}
                                  <p className="text-[9px] text-gray-500 italic mt-1 line-clamp-1" title={credito.motivo}>
                                    <i className="fas fa-info-circle mr-0.5"></i>
                                    {credito.motivo}
                                  </p>
                                </div>
                              );
                            }
                            
                            return unidades;
                          })}
                        </div>
                      </div>

                      {/* Layout Desktop */}
                      <div className="hidden lg:flex items-start gap-6">
                        
                        {/* Coluna 1: Aluno + Status */}
                        <div className="flex-shrink-0 w-56">
                          <p className="text-lg font-bold text-gray-900 mb-2">{grupo.aluno.nome}</p>
                          <p className="text-xs text-gray-500 mb-3">
                            <i className="fas fa-layer-group mr-1"></i>
                            {grupo.creditos.length} concess{grupo.creditos.length > 1 ? 'ões' : 'ão'}
                          </p>
                          <div className="flex flex-col gap-2">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-semibold ${
                              todosExpirados
                                ? 'bg-red-100 text-red-800 border border-red-200'
                                : totalDisponiveis === 0
                                ? 'bg-gray-200 text-gray-700 border border-gray-300'
                                : 'bg-green-100 text-green-800 border border-green-200'
                            }`}>
                              <i className={`fas ${todosExpirados ? 'fa-clock' : totalDisponiveis === 0 ? 'fa-times-circle' : 'fa-check-circle'}`}></i>
                              {todosExpirados ? 'Expirado' : totalDisponiveis === 0 ? 'Esgotado' : 'Disponível'}
                            </span>
                            <div className="flex items-center justify-between px-3 py-2 bg-blue-50 border border-blue-200 rounded">
                              <span className="text-xs text-gray-600">Total</span>
                              <span className="text-lg font-bold text-blue-800">
                                {totalDisponiveis}<span className="text-sm text-gray-500">/{totalCreditos}</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Coluna 2: Lista de Créditos com Scroll */}
                        <div className="flex-1">
                          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                            <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 flex items-center justify-between">
                              <span className="text-sm font-semibold text-gray-700">
                                <i className="fas fa-ticket-alt mr-2"></i>
                                Créditos Individuais
                              </span>
                              <span className="text-xs text-gray-500">
                                {totalDisponiveis} disponíveis de {totalCreditos}
                              </span>
                            </div>
                            <div className="max-h-[200px] overflow-y-auto">
                              <table className="w-full">
                                <thead className="bg-gray-50 sticky top-0 z-10">
                                  <tr className="border-b border-gray-200">
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 w-10">#</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 w-24">Status</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Aula Agendada</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Modalidade</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Professor</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Justificativa</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 w-24">Validade</th>
                                    <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 w-20">Ações</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {grupo.creditos.flatMap((credito) => {
                                    const expirado = isExpirado(credito.validade);
                                    const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
                                    const usos = credito.usos || [];
                                    
                                    // Criar array com cada unidade de crédito
                                    const linhas = [];
                                    for (let i = 0; i < credito.quantidade; i++) {
                                      const uso = usos[i];
                                      const isUsado = !!uso;
                                      
                                      linhas.push(
                                        <tr 
                                          key={`credito-${credito._id}-unidade-${i}`} 
                                          className={`hover:bg-gray-50 transition-colors ${
                                            expirado 
                                              ? 'bg-red-50/30' 
                                              : isUsado 
                                                ? 'bg-blue-50/30' 
                                                : 'bg-green-50/30'
                                          }`}
                                        >
                                          <td className="px-3 py-2 text-xs">
                                            <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
                                              expirado
                                                ? 'bg-red-200 text-red-700'
                                                : isUsado
                                                  ? 'bg-blue-200 text-blue-700'
                                                  : 'bg-green-200 text-green-700'
                                            }`}>
                                              {i + 1}
                                            </span>
                                          </td>
                                          <td className="px-3 py-2 text-xs whitespace-nowrap">
                                            {isUsado ? (
                                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-medium">
                                                <i className="fas fa-calendar-check text-[8px]"></i>
                                                Usado
                                              </span>
                                            ) : expirado ? (
                                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-medium">
                                                <i className="fas fa-clock text-[8px]"></i>
                                                Expirado
                                              </span>
                                            ) : (
                                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-medium">
                                                <i className="fas fa-ticket-alt text-[8px]"></i>
                                                Disponível
                                              </span>
                                            )}
                                          </td>
                                          <td className="px-3 py-2 text-xs text-gray-700">
                                            {isUsado ? (
                                              <p className="font-medium text-[10px]">
                                                <i className="fas fa-calendar text-gray-400 mr-1"></i>
                                                {diasSemana[uso.agendamentoId?.diaSemana ?? 0]}, {new Date(uso.dataUso).toLocaleDateString('pt-BR')} às {uso.agendamentoId?.horarioInicio || '--:--'}
                                              </p>
                                            ) : (
                                              <span className="text-gray-400 italic text-[10px]">
                                                {expirado ? 'Não utilizado' : 'Aguardando'}
                                              </span>
                                            )}
                                          </td>
                                          <td className="px-3 py-2 text-xs">
                                            {isUsado && uso.agendamentoId?.modalidadeId ? (
                                              <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-200 text-gray-700">
                                                <span 
                                                  className="w-2 h-2 rounded-full flex-shrink-0"
                                                  style={{ backgroundColor: uso.agendamentoId.modalidadeId.cor || '#6B7280' }}
                                                ></span>
                                                {uso.agendamentoId.modalidadeId.nome}
                                              </span>
                                            ) : (
                                              <span className="text-gray-400 italic text-[10px]">-</span>
                                            )}
                                          </td>
                                          <td className="px-3 py-2 text-xs">
                                            {isUsado && uso.agendamentoId?.professorId?.nome ? (
                                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-700">
                                                <i className="fas fa-user-tie text-[8px] text-gray-500"></i>
                                                {uso.agendamentoId.professorId.nome}
                                              </span>
                                            ) : (
                                              <span className="text-gray-400 italic text-[10px]">-</span>
                                            )}
                                          </td>
                                          <td className="px-3 py-2 text-xs text-gray-600">
                                            <p className="text-[10px] italic text-gray-500 line-clamp-2" title={credito.motivo}>
                                              {credito.motivo}
                                            </p>
                                          </td>
                                          <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                                            <span className={`text-[10px] ${expirado ? 'text-red-500' : ''}`}>
                                              {formatarData(credito.validade)}
                                            </span>
                                          </td>
                                          <td className="px-3 py-2 text-center">
                                            <div className="flex items-center justify-center gap-0.5">
                                              {isUsado ? (
                                                <button
                                                  onClick={() => handleCancelarUso(uso)}
                                                  className="inline-flex items-center justify-center w-6 h-6 text-red-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                  title="Cancelar uso"
                                                >
                                                  <i className="fas fa-times-circle text-[10px]"></i>
                                                </button>
                                              ) : !expirado ? (
                                                <button
                                                  onClick={() => handleAbrirUsarModal(credito)}
                                                  className="inline-flex items-center justify-center w-6 h-6 text-green-600 hover:text-green-700 hover:bg-green-50 rounded transition-colors"
                                                  title="Usar crédito"
                                                >
                                                  <i className="fas fa-calendar-plus text-[10px]"></i>
                                                </button>
                                              ) : null}
                                              <button
                                                onClick={() => handleExcluir(credito)}
                                                className="inline-flex items-center justify-center w-6 h-6 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                title="Excluir crédito"
                                              >
                                                <i className="fas fa-trash text-[10px]"></i>
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    }
                                    
                                    return linhas;
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

        {/* Modal de Concessão */}
        {showModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="relative w-full max-w-lg mx-auto bg-white rounded-2xl shadow-lg border border-gray-200 max-h-[90vh] overflow-y-auto" role="dialog" aria-modal="true">
              {/* Header */}
              <div className="px-5 py-4 border-b">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <i className="fas fa-ticket-alt text-green-600" aria-hidden="true"></i>
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">Conceder Crédito de Reposição</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        <i className="fas fa-info-circle text-primary-600 mr-1"></i>
                        O aluno poderá usar este crédito para agendar uma aula de reposição
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={fecharModal}
                    className="p-2 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                    title="Fechar"
                  >
                    <i className="fas fa-times" aria-hidden="true"></i>
                  </button>
                </div>
              </div>

              {/* Body */}
              <form onSubmit={handleSubmit} className="p-5 space-y-4">
                {/* Aluno - Chips style */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Aluno <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Buscar aluno..."
                      value={buscaAluno}
                      onChange={(e) => setBuscaAluno(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    {alunoIdForm && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                          <i className="fas fa-check"></i>
                          {alunos.find(a => a._id === alunoIdForm)?.nome}
                          <button
                            type="button"
                            onClick={() => setAlunoIdForm('')}
                            className="ml-1 hover:text-green-900"
                          >
                            <i className="fas fa-times text-[10px]"></i>
                          </button>
                        </span>
                      </div>
                    )}
                  </div>
                  {!alunoIdForm && buscaAluno && (
                    <div className="mt-2 max-h-32 overflow-y-auto border rounded-lg divide-y">
                      {alunos
                        .filter(a => a.nome.toLowerCase().includes(buscaAluno.toLowerCase()))
                        .slice(0, 10)
                        .map(a => (
                          <button
                            key={a._id}
                            type="button"
                            onClick={() => {
                              setAlunoIdForm(a._id);
                              setBuscaAluno('');
                            }}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                          >
                            <i className="fas fa-user text-gray-400 text-xs"></i>
                            {a.nome}
                          </button>
                        ))}
                      {alunos.filter(a => a.nome.toLowerCase().includes(buscaAluno.toLowerCase())).length === 0 && (
                        <div className="px-3 py-2 text-sm text-gray-500">Nenhum aluno encontrado</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Quantidade e Validade - Flex row */}
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Quantidade <span className="text-red-500">*</span>
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setQuantidade(String(Math.max(1, parseInt(quantidade || '1') - 1)))}
                        className="w-9 h-9 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-gray-50 transition-colors flex-shrink-0"
                      >
                        <i className="fas fa-minus text-gray-600 text-sm"></i>
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={quantidade}
                        onChange={(e) => setQuantidade(e.target.value)}
                        className="w-14 px-2 py-2 border border-gray-300 rounded-lg text-center text-lg font-semibold"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setQuantidade(String(parseInt(quantidade || '1') + 1))}
                        className="w-9 h-9 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-gray-50 transition-colors flex-shrink-0"
                      >
                        <i className="fas fa-plus text-gray-600 text-sm"></i>
                      </button>
                    </div>
                  </div>

                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Validade <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={validade}
                      onChange={(e) => setValidade(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full h-[42px] px-3 py-2 border border-gray-300 rounded-lg"
                      required
                    />
                  </div>
                </div>

                {/* Modalidade - Chips */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Modalidade <span className="text-xs text-gray-400 font-normal">(opcional)</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setModalidadeId('')}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-all ${
                        !modalidadeId
                          ? 'bg-gray-800 text-white border-gray-800'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      Qualquer
                    </button>
                    {modalidades.map(m => (
                      <button
                        key={m._id}
                        type="button"
                        onClick={() => setModalidadeId(m._id)}
                        style={{
                          backgroundColor: modalidadeId === m._id ? m.cor : 'white',
                          borderColor: modalidadeId === m._id ? m.cor : '#E5E7EB',
                          color: modalidadeId === m._id ? 'white' : '#4B5563'
                        }}
                        className="px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-all hover:opacity-90"
                      >
                        {m.nome}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Motivo */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Motivo <span className="text-red-500">*</span>
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {['Falta justificada', 'Problema técnico', 'Compensação', 'Cortesia'].map(opcao => (
                      <button
                        key={opcao}
                        type="button"
                        onClick={() => setMotivo(opcao)}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                          motivo === opcao
                            ? 'bg-green-100 text-green-700 border-green-300'
                            : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-400'
                        }`}
                      >
                        {opcao}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="Descreva o motivo da concessão..."
                    required
                  />
                </div>

                {/* Footer com botões */}
                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={fecharModal}
                    disabled={salvando}
                    className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={salvando || !alunoIdForm}
                    className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 font-medium flex items-center justify-center gap-2"
                  >
                    {salvando ? (
                      <>
                        <i className="fas fa-spinner fa-spin"></i>
                        Salvando...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-check"></i>
                        Conceder Crédito
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal de Uso de Crédito */}
        {/* Modal de Uso de Crédito */}
        <UsarCreditoModal
          open={showUsarModal}
          onClose={() => {
            setShowUsarModal(false);
            setCreditoSelecionado(null);
          }}
          credito={creditoSelecionado}
          onSuccess={() => {
            fetchCreditos();
          }}
        />
      </div>
    </ProtectedPage>
  );
}
