'use client';

import Swal from 'sweetalert2';
import { toast } from 'react-toastify';
import { useState, useEffect, useMemo } from 'react';
import ProtectedPage from '@/components/ProtectedPage';

export interface HorarioDisponivel {
  diasSemana: number[];
  horaInicio: string;
  horaFim: string;
}

export interface Modalidade {
  _id: string;
  nome: string;
  descricao?: string;
  cor: string;
  duracao: number;
  limiteAlunos: number;
  diasSemana?: number[]; // Dias da semana que a modalidade tem aula
  horariosDisponiveis: HorarioDisponivel[];
  linkWhatsapp?: string; // Link do grupo do WhatsApp da modalidade
  modalidadesVinculadas?: string[]; // IDs das modalidades que compartilham o mesmo espaço
  permiteReposicao?: boolean; // Se a modalidade permite reposição de faltas
  ativo: boolean;
}

export default function ModalidadesPage() {
  const [mounted, setMounted] = useState(false);
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
  const [modalidades, setModalidades] = useState<Modalidade[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [editingModalidade, setEditingModalidade] = useState<Modalidade | null>(null);
  const [query, setQuery] = useState('');
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    cor: '#3B82F6',
    duracao: 60,
    limiteAlunos: 5,
    diasSemana: [] as number[], // Array de dias da semana (0=Domingo, 6=Sábado) - kept for compatibility
    diasSemanaManha: [] as number[],
    diasSemanaTarde: [] as number[],
    horarioFuncionamento: {
      manha: { inicio: '', fim: '' },
      tarde: { inicio: '', fim: '' }
    },
    linkWhatsapp: '',
    modalidadesVinculadas: [] as string[],
    permiteReposicao: true
  });
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Marcar como montado
  useEffect(() => {
    setMounted(true);
  }, []);

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
  }, [showInactive]);

  const fetchModalidades = async () => {
    try {
      setLoading(true);
      const urlParam = showInactive ? 'onlyInactive=true' : '';
      const response = await fetch(`/api/modalidades?${urlParam}`);

      // Se a resposta não for OK, mostre alerta ao usuário e logue o corpo
      if (!response.ok) {
        const text = await response.text();
        toast.error('Erro ao buscar modalidades: ' + response.status);
        console.error('Erro na requisição /api/modalidades:', response.status, text);
        return;
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await response.text();
        toast.error('Resposta da API de modalidades não está em formato JSON.');
        console.error('Resposta /api/modalidades não é JSON:', text);
        return;
      }

      const data = await response.json();
      if (data && data.success) {
        setModalidades(data.data || []);
      } else {
        toast.error('Erro ao buscar modalidades: ' + (data && data.error ? data.error : 'Formato inesperado.'));
        console.error('API /api/modalidades retornou erro ou formato inesperado:', data);
      }
    } catch (error) {
      toast.error('Erro ao buscar modalidades: ' + String(error));
      console.error('Erro ao buscar modalidades:', error);
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Client-side validation
      const nomeTrim = (formData.nome || '').trim();
      if (!nomeTrim) {
        toast.warning('Nome é obrigatório');
        setLoading(false);
        return;
      }

      // If morning days selected, require morning start/end
      const diasManha = (formData as any).diasSemanaManha || [];
      const diasTarde = (formData as any).diasSemanaTarde || [];
      const manhaInicio = (formData as any).horarioFuncionamento?.manha?.inicio || '';
      const manhaFim = (formData as any).horarioFuncionamento?.manha?.fim || '';
      const tardeInicio = (formData as any).horarioFuncionamento?.tarde?.inicio || '';
      const tardeFim = (formData as any).horarioFuncionamento?.tarde?.fim || '';

      if (diasManha.length > 0 && (!manhaInicio || !manhaFim)) {
        toast.warning('Você selecionou dias para a Manhã, defina o horário de Início e Fim para Manhã (ou desmarque os dias).');
        setLoading(false);
        return;
      }

      if (diasTarde.length > 0 && (!tardeInicio || !tardeFim)) {
        toast.warning('Você selecionou dias para a Tarde, defina o horário de Início e Fim para Tarde (ou desmarque os dias).');
        setLoading(false);
        return;
      }
      if (editingModalidade) {
        const id = (editingModalidade as any).id || (editingModalidade as any)._id;
        if (!id) {
          console.error('Tentativa de atualizar modalidade sem ID válido:', editingModalidade);
          toast.error('Erro interno: modalidade sem ID. Reabra o modal e tente novamente.');
          setLoading(false);
          return;
        }
      }
      const url = editingModalidade
        ? `/api/modalidades/${(editingModalidade as any).id || (editingModalidade as any)._id}`
        : '/api/modalidades';
      const method = editingModalidade ? 'PUT' : 'POST';

      // Log do payload para debug (será visível no console do navegador)
      try { console.debug('POST /api/modalidades payload:', formData); } catch (e) {}

      // Build payload: include horariosDisponiveis from morning/tarde selections
      const payload: any = {
        nome: nomeTrim,
        descricao: formData.descricao,
        cor: formData.cor,
        duracao: formData.duracao,
        limiteAlunos: formData.limiteAlunos,
        // keep top-level diasSemana as the union of both selections for backward compatibility
        diasSemana: Array.from(new Set([...(formData.diasSemana || []), ...(formData.diasSemanaManha || []), ...(formData.diasSemanaTarde || [])])).sort(),
        horarioFuncionamento: formData.horarioFuncionamento,
        horariosDisponiveis: [] as any[],
        linkWhatsapp: formData.linkWhatsapp?.trim() || '',
        modalidadesVinculadas: formData.modalidadesVinculadas || [],
        permiteReposicao: formData.permiteReposicao,
      };

      // If morning times and days provided, add to horariosDisponiveis
      if ((formData as any).horarioFuncionamento?.manha?.inicio && (formData as any).horarioFuncionamento?.manha?.fim && (formData as any).diasSemanaManha && (formData as any).diasSemanaManha.length > 0) {
        payload.horariosDisponiveis.push({ diasSemana: (formData as any).diasSemanaManha, horaInicio: (formData as any).horarioFuncionamento.manha.inicio, horaFim: (formData as any).horarioFuncionamento.manha.fim });
      }

      // If afternoon times and days provided, add to horariosDisponiveis
      if ((formData as any).horarioFuncionamento?.tarde?.inicio && (formData as any).horarioFuncionamento?.tarde?.fim && (formData as any).diasSemanaTarde && (formData as any).diasSemanaTarde.length > 0) {
        payload.horariosDisponiveis.push({ diasSemana: (formData as any).diasSemanaTarde, horaInicio: (formData as any).horarioFuncionamento.tarde.inicio, horaFim: (formData as any).horarioFuncionamento.tarde.fim });
      }

      try { console.debug('POST /api/modalidades payload:', payload); } catch (e) {}

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      // Handle non-OK responses with clearer messaging
      if (!response.ok) {
        let errBody: any = null;
        try { errBody = await response.json(); } catch (e) { errBody = await response.text(); }
        console.error('API /api/modalidades returned error', response.status, errBody);
        const message = (errBody && (errBody.error || errBody.message)) ? (errBody.error || errBody.message) : `HTTP ${response.status}`;
        toast.error('Erro ao salvar modalidade: ' + message);
        return;
      }

      const data = await response.json();

      if (data && data.success) {
        // sucesso silencioso: fechar modal e recarregar lista
        setShowModal(false);
        setEditingModalidade(null);
        setFormData({
          nome: '',
          descricao: '',
          cor: '#3B82F6',
          duracao: 60,
          limiteAlunos: 5,
          diasSemana: [],
          diasSemanaManha: [],
          diasSemanaTarde: [],
          horarioFuncionamento: { manha: { inicio: '', fim: '' }, tarde: { inicio: '', fim: '' } },
          linkWhatsapp: '',
          modalidadesVinculadas: [],
          permiteReposicao: true
        });
        fetchModalidades();
        try {
          if (typeof window !== 'undefined') {
            // notify other tabs/pages that modalidades changed
            localStorage.setItem('modalidadesUpdated', Date.now().toString());
          }
        } catch (e) {
          // ignore
        }
      } else {
        toast.error('Erro: ' + (data?.error || 'Resposta inesperada do servidor'));
      }
    } catch (error) {
      console.error('Erro ao salvar modalidade:', error);
      toast.error('Erro ao salvar modalidade');
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
      limiteAlunos: modalidade.limiteAlunos,
      diasSemana: modalidade.diasSemana || [],
      // Derive morning/afternoon day selections from horariosDisponiveis if present
      diasSemanaManha: ((modalidade as any).horariosDisponiveis || []).length > 0 ? (((modalidade as any).horariosDisponiveis[0]?.diasSemana) || []) : (modalidade.diasSemana || []),
      diasSemanaTarde: ((modalidade as any).horariosDisponiveis || []).length > 1 ? (((modalidade as any).horariosDisponiveis[1]?.diasSemana) || []) : [],
      horarioFuncionamento: {
        manha: { inicio: (modalidade as any).horarioFuncionamento?.manha?.inicio || '', fim: (modalidade as any).horarioFuncionamento?.manha?.fim || '' },
        tarde: { inicio: (modalidade as any).horarioFuncionamento?.tarde?.inicio || '', fim: (modalidade as any).horarioFuncionamento?.tarde?.fim || '' }
      },
      linkWhatsapp: modalidade.linkWhatsapp || '',
      modalidadesVinculadas: modalidade.modalidadesVinculadas || [],
      permiteReposicao: modalidade.permiteReposicao !== false // default true se não definido
    });
    setShowModal(true);
  };

  const deleteModalidade = async (id: string) => {
    if (!id) {
      console.error('deleteModalidade chamado sem id válido:', id);
      toast.error('Erro interno: id da modalidade inválido. Recarregue a página e tente novamente.');
      return;
    }

    const result = await Swal.fire({
      title: 'Mover para lixeira?',
      text: 'A modalidade será desativada mas os dados serão mantidos',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#f97316',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sim, desativar!',
      cancelButtonText: 'Cancelar'
    });
    if (result.isConfirmed) {
      try {
        const response = await fetch(`/api/modalidades/${id}`, {
          method: 'DELETE',
        });

        const data = await response.json();
        if (data.success) {
          toast.success('Modalidade movida para lixeira!');
          fetchModalidades();
          try {
            if (typeof window !== 'undefined') {
              // notify other tabs/pages that modalidades changed
              localStorage.setItem('modalidadesUpdated', Date.now().toString());
            }
          } catch (e) {}
        } else {
          toast.error('Erro ao desativar modalidade');
        }
      } catch (error) {
        console.error('Erro ao desativar modalidade:', error);
        toast.error('Erro ao desativar modalidade');
      }
    }
  };

  // Hard delete helper for card-level deletion (permanent)
  const deleteModalidadeHard = async (id: string) => {
    if (!id) {
      console.error('deleteModalidadeHard chamado sem id válido:', id);
      toast.error('Erro interno: id da modalidade inválido. Recarregue a página e tente novamente.');
      return;
    }

    const result = await Swal.fire({
      title: 'Confirmar Exclusão Permanente',
      text: 'Tem certeza que deseja apagar esta modalidade permanentemente? Esta ação não pode ser desfeita.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sim, apagar',
      cancelButtonText: 'Cancelar'
    });
    if (!result.isConfirmed) return;
    try {
      const response = await fetch(`/api/modalidades/${id}?permanent=true`, { method: 'DELETE' });
      let data: any = null;
      try { data = await response.json(); } catch (e) { data = null; }
      if (response.ok && data && data.success) {
        toast.success('Modalidade excluída permanentemente!');
        fetchModalidades();
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem('modalidadesUpdated', Date.now().toString());
          }
        } catch (e) {}
      } else if (!response.ok) {
        const msg = data?.error || data?.message || `HTTP ${response.status}`;
        toast.error('Erro ao apagar modalidade: ' + msg);
      } else {
        toast.error('Erro ao apagar modalidade');
      }
    } catch (err) {
      console.error('Erro ao apagar modalidade:', err);
      toast.error('Erro ao apagar modalidade');
    }
  };

  // Reactivate a previously deactivated modalidade
  const activateModalidade = async (id: string) => {
    if (!id) return;
    try {
      const response = await fetch(`/api/modalidades/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: true })
      });
      const data = await response.json();
      if (data && data.success) {
        toast.success('Modalidade restaurada com sucesso!');
        fetchModalidades();
        try { if (typeof window !== 'undefined') localStorage.setItem('modalidadesUpdated', Date.now().toString()); } catch (e) {}
      } else {
        toast.error('Erro ao restaurar modalidade');
      }
    } catch (err) {
      console.error('Erro ao restaurar modalidade:', err);
      toast.error('Erro ao restaurar modalidade');
    }
  };

  const getDiasSemanaNomes = (dias: number[]) => {
    const nomes = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    return dias.map(dia => nomes[dia]).join(', ');
  };

  const filteredModalidades = useMemo(() => {
    if (!query) return modalidades;
    const q = String(query).trim().toLowerCase();
    return modalidades.filter(m => {
      const nome = String(m.nome || '').toLowerCase();
      const desc = String(m.descricao || '').toLowerCase();
      return nome.includes(q) || desc.includes(q);
    });
  }, [modalidades, query]);

  // Skeleton loading enquanto não está montado ou carregando dados iniciais
  if (!mounted || initialLoading) {
    return (
      <ProtectedPage tab="modalidades" title="Modalidades - Superação Flux" fullWidth customLoading>
        <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
          {/* Header skeleton - Desktop */}
          <div className="hidden md:flex items-center justify-between gap-4 mb-6">
            <div>
              <div className="h-6 bg-gray-200 rounded w-36 mb-2 animate-pulse" />
              <div className="h-4 bg-gray-200 rounded w-64 animate-pulse" />
            </div>
            <div className="flex gap-3">
              <div className="h-10 w-40 bg-gray-200 rounded-full animate-pulse" />
              <div className="h-10 w-32 bg-gray-200 rounded-full animate-pulse" />
            </div>
          </div>
          
          {/* Header skeleton - Mobile */}
          <div className="md:hidden flex items-center justify-between mb-4">
            <div className="h-5 bg-gray-200 rounded w-28 animate-pulse" />
            <div className="flex gap-2">
              <div className="h-9 w-9 bg-gray-200 rounded-full animate-pulse" />
              <div className="h-9 w-9 bg-gray-200 rounded-full animate-pulse" />
            </div>
          </div>
          
          {/* Search skeleton - Desktop */}
          <div className="hidden md:block mb-6">
            <div className="h-10 bg-gray-200 rounded-lg w-full max-w-md animate-pulse" />
          </div>
          
          {/* Search skeleton - Mobile */}
          <div className="md:hidden mb-4">
            <div className="h-10 bg-gray-200 rounded-lg w-full animate-pulse" />
          </div>
          
          {/* Cards grid skeleton - Desktop */}
          <div className="hidden md:grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-pulse">
                {/* Barra colorida no topo */}
                <div className="h-2 bg-gray-300" />
                
                <div className="p-5">
                  {/* Cabeçalho */}
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 bg-gray-200 rounded-xl" />
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded w-24 mb-1" />
                    </div>
                  </div>
                  
                  {/* Descrição */}
                  <div className="h-3 bg-gray-100 rounded w-full mb-1" />
                  <div className="h-3 bg-gray-100 rounded w-3/4 mb-4" />
                  
                  {/* Info Grid */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-gray-50 rounded-lg px-3 py-2">
                      <div className="h-3 bg-gray-200 rounded w-12 mb-1" />
                      <div className="h-4 bg-gray-200 rounded w-16" />
                    </div>
                    <div className="bg-gray-50 rounded-lg px-3 py-2">
                      <div className="h-3 bg-gray-200 rounded w-10 mb-1" />
                      <div className="h-4 bg-gray-200 rounded w-14" />
                    </div>
                  </div>
                  
                  {/* Dias da semana */}
                  <div className="flex gap-1.5 mb-4">
                    {[1, 2, 3, 4, 5].map(j => (
                      <div key={j} className="h-6 bg-gray-100 rounded-md w-9" />
                    ))}
                  </div>
                  
                  {/* Botões de ação */}
                  <div className="flex gap-2 pt-4 border-t border-gray-100">
                    <div className="flex-1 h-9 bg-gray-200 rounded-lg" />
                    <div className="w-10 h-9 bg-gray-200 rounded-lg" />
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Lista skeleton - Mobile */}
          <div className="md:hidden space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-pulse">
                {/* Header com cor de fundo */}
                <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-200 rounded-lg" />
                    <div>
                      <div className="h-3.5 bg-gray-200 rounded w-20 mb-1" />
                      <div className="h-2.5 bg-gray-200 rounded w-24" />
                    </div>
                  </div>
                </div>
                
                <div className="px-4 py-3">
                  {/* Dias da semana */}
                  <div className="flex gap-1 mb-3">
                    {[1, 2, 3, 4, 5].map(j => (
                      <div key={j} className="h-5 bg-gray-100 rounded w-7" />
                    ))}
                  </div>
                  
                  {/* Botões */}
                  <div className="flex gap-2 pt-3 border-t border-gray-100">
                    <div className="flex-1 h-8 bg-gray-200 rounded-lg" />
                    <div className="w-8 h-8 bg-gray-200 rounded-lg" />
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
    <ProtectedPage tab="modalidades" title="Modalidades - Superação Flux" fullWidth>
      <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
        {/* Header Desktop */}
        <div className="hidden md:flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <i className="fas fa-layer-group text-green-600"></i>
              Modalidades
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Gerencie as modalidades do studio
            </p>
          </div>

          {/* Botões de ação */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="h-10 transition-colors duration-200 inline-flex items-center gap-2 rounded-full bg-primary-600 text-white px-4 text-sm font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <i className="fas fa-plus w-4 text-white" aria-hidden="true" />
              Nova Modalidade
            </button>
            <button
              type="button"
              onClick={() => {
                setShowInactive(!showInactive);
              }}
              className={`h-10 inline-flex items-center justify-center rounded-full px-4 text-sm font-medium transition-colors ${
                showInactive
                  ? 'bg-gray-700 text-white hover:bg-gray-800'
                  : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
              title={showInactive ? 'Voltar para ativos' : 'Ver modalidades excluídas/inativas'}
            >
              <i className={`fas ${showInactive ? 'fa-arrow-left' : 'fa-trash'} mr-2`} aria-hidden="true"></i>
              {showInactive ? 'Voltar' : 'Excluídos'}
            </button>
          </div>
        </div>

        {/* Header Mobile */}
        <div className="md:hidden mb-4 fade-in-1">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold text-gray-900">Modalidades</h1>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowInactive(!showInactive)}
                className={`h-8 w-8 inline-flex items-center justify-center rounded-full transition-colors ${
                  showInactive
                    ? 'bg-gray-700 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                <i className={`fas ${showInactive ? 'fa-arrow-left' : 'fa-trash'} text-xs`}></i>
              </button>
              <button 
                type="button" 
                onClick={() => setShowModal(true)} 
                className="h-8 w-8 inline-flex items-center justify-center rounded-full bg-green-600 text-white"
              >
                <i className="fas fa-plus text-xs"></i>
              </button>
            </div>
          </div>
        </div>

        {/* Busca */}
        <div className="mb-4 fade-in-2">
          <div className="relative w-full">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pesquisar modalidade..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-0 focus:border-gray-300 outline-none text-sm"
            />
          </div>
        </div>

        {/* Contador Mobile */}
        <div className="md:hidden mb-4 text-xs text-gray-500 fade-in-2">
          {filteredModalidades.length} {filteredModalidades.length === 1 ? 'modalidade' : 'modalidades'}
        </div>

        {/* Grid de modalidades */}
        {filteredModalidades.length === 0 ? (
          <div className="text-center py-12">
            <i className={`fas ${showInactive ? 'fa-trash' : 'fa-layer-group'} text-4xl text-gray-300 mb-4`}></i>
            <p className="text-gray-500 text-lg font-medium mb-2">
              {showInactive 
                ? 'Nenhuma modalidade excluída' 
                : query 
                  ? 'Nenhuma modalidade encontrada'
                  : 'Nenhuma modalidade cadastrada'
              }
            </p>
            {!showInactive && !query && (
              <p className="text-gray-400 text-sm mb-4">
                Comece criando uma nova modalidade
              </p>
            )}
          </div>
        ) : (
          <>
            {/* Grid Desktop */}
            <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 fade-in-3">
              {filteredModalidades.map((modalidade, idx) => {
                const isInativo = (modalidade as any).ativo === false;
                const fadeClass = `fade-in-${Math.min((idx % 8) + 3, 8)}`;
                
                return (
                  <div
                    key={(modalidade as any).id || (modalidade as any)._id || idx}
                    className={`relative rounded-xl border shadow-sm overflow-hidden ${fadeClass} ${
                      isInativo 
                        ? 'bg-gray-50 border-gray-200 opacity-70' 
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    {/* Barra colorida no topo */}
                    <div 
                      className="h-2"
                      style={{ backgroundColor: isInativo ? '#d1d5db' : modalidade.cor }}
                    />
                    
                    <div className="p-5">
                      {/* Cabeçalho */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-10 h-10 rounded-xl flex items-center justify-center"
                            style={{ backgroundColor: isInativo ? '#E5E7EB' : `${modalidade.cor}20` }}
                          >
                            <i 
                              className="fas fa-layer-group text-lg"
                              style={{ color: isInativo ? '#9CA3AF' : modalidade.cor }}
                            />
                          </div>
                          <div>
                            <h3 className={`text-base font-bold ${isInativo ? 'text-gray-500' : 'text-gray-900'}`}>
                              {modalidade.nome}
                            </h3>
                            {isInativo && (
                              <span className="text-[10px] bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-bold uppercase">
                                Inativa
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Descrição */}
                      {modalidade.descricao && (
                        <p className="text-sm text-gray-500 mb-4 line-clamp-2">{modalidade.descricao}</p>
                      )}

                      {/* Info Grid */}
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                          <i className="fas fa-clock text-green-500 text-sm"></i>
                          <div>
                            <p className="text-xs text-gray-500">Duração</p>
                            <p className="text-sm font-semibold text-gray-900">{modalidade.duracao} min</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                          <i className="fas fa-users text-green-500 text-sm"></i>
                          <div>
                            <p className="text-xs text-gray-500">Limite</p>
                            <p className="text-sm font-semibold text-gray-900">{modalidade.limiteAlunos} alunos</p>
                          </div>
                        </div>
                      </div>

                      {/* Dias da semana */}
                      {modalidade.diasSemana && modalidade.diasSemana.length > 0 && (
                        <div className="mb-4">
                          <p className="text-xs text-gray-500 mb-2">Dias de funcionamento</p>
                          <div className="flex flex-wrap gap-1.5">
                            {([...modalidade.diasSemana].sort()).map(dia => (
                              <span 
                                key={dia}
                                className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded-md font-semibold"
                              >
                                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][dia]}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Horários de funcionamento */}
                      {((modalidade as any).horarioFuncionamento && (((modalidade as any).horarioFuncionamento.manha?.inicio) || ((modalidade as any).horarioFuncionamento.tarde?.inicio))) && (
                        <div className="flex flex-wrap gap-2 mb-4">
                          {(modalidade as any).horarioFuncionamento.manha?.inicio && (modalidade as any).horarioFuncionamento.manha?.fim && (
                            <div className="flex items-center gap-1.5 text-xs bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg font-medium">
                              <i className="fas fa-sun"></i>
                              <span>{(modalidade as any).horarioFuncionamento.manha.inicio} – {(modalidade as any).horarioFuncionamento.manha.fim}</span>
                            </div>
                          )}
                          {(modalidade as any).horarioFuncionamento.tarde?.inicio && (modalidade as any).horarioFuncionamento.tarde?.fim && (
                            <div className="flex items-center gap-1.5 text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg font-medium">
                              <i className="fas fa-moon"></i>
                              <span>{(modalidade as any).horarioFuncionamento.tarde.inicio} – {(modalidade as any).horarioFuncionamento.tarde.fim}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Aviso de modalidades vinculadas */}
                      {modalidade.modalidadesVinculadas && modalidade.modalidadesVinculadas.length > 0 && (
                        <div className="mb-4 p-2 bg-orange-50 border border-orange-200 rounded-lg">
                          <div className="flex items-start gap-2">
                            <i className="fas fa-link text-orange-500 text-xs mt-0.5"></i>
                            <div>
                              <p className="text-xs font-medium text-orange-700">Espaço compartilhado com:</p>
                              <p className="text-xs text-orange-600">
                                {modalidade.modalidadesVinculadas
                                  .map(vinculadaId => {
                                    const vinculada = modalidades.find(m => m._id === vinculadaId);
                                    return vinculada?.nome || '';
                                  })
                                  .filter(Boolean)
                                  .join(', ')}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Botões de ação */}
                      <div className="flex gap-2 pt-4 border-t border-gray-100">
                        {showInactive ? (
                          <>
                            <button 
                              onClick={() => activateModalidade((modalidade as any).id || (modalidade as any)._id)} 
                              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors"
                            >
                              <i className="fas fa-undo"></i>
                              <span>Restaurar</span>
                            </button>
                            <button 
                              onClick={() => deleteModalidadeHard((modalidade as any).id || (modalidade as any)._id)} 
                              className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                              title="Apagar permanentemente"
                            >
                              <i className="fas fa-trash-alt"></i>
                            </button>
                          </>
                        ) : (
                          <>
                            <button 
                              onClick={() => editModalidade(modalidade)} 
                              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 hover:border-green-300 transition-colors"
                            >
                              <i className="fas fa-edit text-green-600"></i>
                              <span>Editar</span>
                            </button>
                            <button 
                              onClick={() => deleteModalidade((modalidade as any).id || (modalidade as any)._id)} 
                              className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-white border border-gray-200 text-red-500 hover:bg-red-50 hover:border-red-300 transition-colors"
                              title="Mover para lixeira"
                            >
                              <i className="fas fa-trash"></i>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Lista Mobile */}
            <div className="md:hidden space-y-3 fade-in-3">
              {filteredModalidades.map((modalidade, idx) => {
                const isInativo = (modalidade as any).ativo === false;
                const fadeClass = `fade-in-${Math.min((idx % 8) + 3, 8)}`;
                
                return (
                  <div
                    key={(modalidade as any).id || (modalidade as any)._id || idx}
                    className={`relative rounded-xl border overflow-hidden ${fadeClass} ${
                      isInativo 
                        ? 'bg-gray-50 border-gray-200 opacity-70' 
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    {/* Header com cor */}
                    <div 
                      className="px-4 py-3 flex items-center justify-between"
                      style={{ backgroundColor: isInativo ? '#F3F4F6' : `${modalidade.cor}10` }}
                    >
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: isInativo ? '#E5E7EB' : `${modalidade.cor}30` }}
                        >
                          <i 
                            className="fas fa-layer-group text-sm"
                            style={{ color: isInativo ? '#9CA3AF' : modalidade.cor }}
                          />
                        </div>
                        <div>
                          <h3 className={`text-sm font-bold ${isInativo ? 'text-gray-500' : 'text-gray-900'}`}>
                            {modalidade.nome}
                          </h3>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>{modalidade.duracao}min</span>
                            <span>•</span>
                            <span>{modalidade.limiteAlunos} alunos</span>
                          </div>
                        </div>
                      </div>
                      {isInativo && (
                        <span className="text-[10px] bg-gray-300 text-gray-600 px-2 py-0.5 rounded-full font-bold">
                          INATIVA
                        </span>
                      )}
                    </div>
                    
                    <div className="px-4 py-3">
                      {/* Dias da semana - compact */}
                      {modalidade.diasSemana && modalidade.diasSemana.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {([...modalidade.diasSemana].sort()).map(dia => (
                            <span 
                              key={dia}
                              className="text-[10px] px-1.5 py-0.5 bg-green-50 text-green-700 rounded font-semibold"
                            >
                              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][dia]}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Horários de funcionamento - Mobile */}
                      {((modalidade as any).horarioFuncionamento && (((modalidade as any).horarioFuncionamento.manha?.inicio) || ((modalidade as any).horarioFuncionamento.tarde?.inicio))) && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {(modalidade as any).horarioFuncionamento.manha?.inicio && (modalidade as any).horarioFuncionamento.manha?.fim && (
                            <div className="flex items-center gap-1 text-[10px] bg-amber-50 text-amber-700 px-2 py-1 rounded-lg font-medium">
                              <i className="fas fa-sun text-[9px]"></i>
                              <span>{(modalidade as any).horarioFuncionamento.manha.inicio} – {(modalidade as any).horarioFuncionamento.manha.fim}</span>
                            </div>
                          )}
                          {(modalidade as any).horarioFuncionamento.tarde?.inicio && (modalidade as any).horarioFuncionamento.tarde?.fim && (
                            <div className="flex items-center gap-1 text-[10px] bg-indigo-50 text-indigo-700 px-2 py-1 rounded-lg font-medium">
                              <i className="fas fa-moon text-[9px]"></i>
                              <span>{(modalidade as any).horarioFuncionamento.tarde.inicio} – {(modalidade as any).horarioFuncionamento.tarde.fim}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Aviso de modalidades vinculadas - Mobile */}
                      {modalidade.modalidadesVinculadas && modalidade.modalidadesVinculadas.length > 0 && (
                        <div className="mb-3 p-1.5 bg-orange-50 border border-orange-200 rounded-lg">
                          <div className="flex items-start gap-1.5">
                            <i className="fas fa-link text-orange-500 text-[10px] mt-0.5"></i>
                            <div>
                              <p className="text-[10px] font-medium text-orange-700">Espaço compartilhado:</p>
                              <p className="text-[10px] text-orange-600">
                                {modalidade.modalidadesVinculadas
                                  .map(vinculadaId => {
                                    const vinculada = modalidades.find(m => m._id === vinculadaId);
                                    return vinculada?.nome || '';
                                  })
                                  .filter(Boolean)
                                  .join(', ')}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Botões de ação - compact */}
                      <div className="flex gap-2">
                        {showInactive ? (
                          <>
                            <button 
                              onClick={() => activateModalidade((modalidade as any).id || (modalidade as any)._id)} 
                              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-green-600 text-white text-xs font-medium"
                            >
                              <i className="fas fa-undo text-[10px]"></i>
                              <span>Restaurar</span>
                            </button>
                            <button 
                              onClick={() => deleteModalidadeHard((modalidade as any).id || (modalidade as any)._id)} 
                              className="w-9 h-9 flex items-center justify-center rounded-lg bg-red-100 text-red-600"
                            >
                              <i className="fas fa-trash-alt text-xs"></i>
                            </button>
                          </>
                        ) : (
                          <>
                            <button 
                              onClick={() => editModalidade(modalidade)} 
                              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-gray-700 text-xs font-medium"
                            >
                              <i className="fas fa-edit text-green-600 text-[10px]"></i>
                              <span>Editar</span>
                            </button>
                            <button 
                              onClick={() => deleteModalidade((modalidade as any).id || (modalidade as any)._id)} 
                              className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 text-red-500"
                            >
                              <i className="fas fa-trash text-xs"></i>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Modal para nova modalidade */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-600 bg-opacity-50 p-3 sm:p-4">
            <div className="relative w-full max-w-xl bg-white rounded-lg shadow-lg border flex flex-col max-h-[90vh]">
              {/* Header Fixo */}
              <div className="flex items-start justify-between p-4 sm:p-6 border-b bg-white rounded-t-lg flex-shrink-0">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">
                    {editingModalidade ? (
                      <span className="flex items-center gap-2">
                        <i className="fas fa-edit text-primary-600" />
                        Editar Modalidade
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <i className="fas fa-plus text-primary-600" />
                        Nova Modalidade
                      </span>
                    )}
                  </h3>
                  <p className="text-sm font-medium text-gray-500 mt-1 flex items-center gap-2">
                    <i className="fas fa-info-circle text-primary-600" />
                    Defina as informações principais e os horários de funcionamento.
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Fechar"
                  onClick={() => { setShowModal(false); setEditingModalidade(null); }}
                  className="ml-4 text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  <i className="fas fa-times w-4" aria-hidden="true" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                {/* Conteúdo com scroll */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">Nome *</label>
                    <input
                      type="text"
                      value={formData.nome}
                      onChange={(e) => setFormData({...formData, nome: e.target.value})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      placeholder="Ex: Natação, Treino, Hidroginástica..."
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Duração (min)</label>
                    <input
                      type="number"
                      value={formData.duracao}
                      onChange={(e) => setFormData({...formData, duracao: parseInt(e.target.value) || 60})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-primary-500 focus:border-primary-500"
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
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      min="1"
                      max="20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cor</label>
                  <div className="inline-flex flex-wrap gap-1 p-1.5 bg-gray-50 border border-gray-200 rounded-md">
                    {coresSugeridas.map((cor) => (
                      <button
                        key={cor}
                        type="button"
                        onClick={() => setFormData({...formData, cor})}
                        className={`relative h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all duration-150 hover:scale-110 hover:border-primary-400 focus:outline-none ${formData.cor === cor ? 'border-primary-600 ring-2 ring-primary-400' : 'border-gray-300'}`}
                        style={{ backgroundColor: cor }}
                        title={cor}
                      >
                        {formData.cor === cor && (
                          <i className="fas fa-check text-white text-[6px] drop-shadow" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Descrição</label>
                  <textarea
                    value={formData.descricao}
                    onChange={(e) => setFormData({...formData, descricao: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    rows={2}
                    placeholder="Descrição da modalidade..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    <i className="fab fa-whatsapp text-green-500 mr-1"></i>
                    Link do Grupo do WhatsApp
                  </label>
                  <input
                    type="url"
                    value={formData.linkWhatsapp}
                    onChange={(e) => setFormData({...formData, linkWhatsapp: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    placeholder="https://chat.whatsapp.com/..."
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Cole aqui o link de convite do grupo da modalidade (ex: https://chat.whatsapp.com/AbCdEf123)
                  </p>
                </div>

                {/* Toggle Permite Reposição */}
                <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <i className="fas fa-redo text-blue-500"></i>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Permite Reposição</label>
                      <p className="text-xs text-gray-500">Se desativado, alunos não poderão repor faltas desta modalidade</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, permiteReposicao: !formData.permiteReposicao})}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      formData.permiteReposicao ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        formData.permiteReposicao ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    <i className="fas fa-link text-gray-500 mr-1"></i>
                    Modalidades Vinculadas (mesmo espaço)
                  </label>
                  <div className="mt-1 flex flex-wrap gap-2 p-2 bg-gray-50 border border-gray-200 rounded-md min-h-[42px]">
                    {modalidades
                      .filter(m => m.ativo && m._id !== editingModalidade?._id)
                      .map(m => {
                        const isSelected = formData.modalidadesVinculadas.includes(m._id);
                        return (
                          <button
                            key={m._id}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setFormData({
                                  ...formData,
                                  modalidadesVinculadas: formData.modalidadesVinculadas.filter(id => id !== m._id)
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  modalidadesVinculadas: [...formData.modalidadesVinculadas, m._id]
                                });
                              }
                            }}
                            className={`px-2 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${
                              isSelected
                                ? 'text-white border-2'
                                : 'bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-100'
                            }`}
                            style={isSelected ? { backgroundColor: m.cor, borderColor: m.cor } : {}}
                          >
                            {isSelected && <i className="fas fa-check text-[10px]" />}
                            {m.nome}
                          </button>
                        );
                      })}
                    {modalidades.filter(m => m.ativo && m._id !== editingModalidade?._id).length === 0 && (
                      <span className="text-xs text-gray-400 italic">Nenhuma outra modalidade disponível</span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Selecione modalidades que usam o mesmo espaço físico (não poderão ter aulas simultâneas)
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="border rounded-md p-2 bg-gray-50">
                    <div className="mb-2 flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <i className="fas fa-sun text-yellow-400" aria-hidden="true" />
                        Manhã
                      </label>
                      <span className="text-xs text-gray-500">Selecione dias e horário</span>
                    </div>
                    <div className="grid grid-cols-7 gap-2 mb-2">
                      {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((dia, index) => (
                        <button
                          key={`manha-${index}`}
                          type="button"
                          onClick={() => {
                            const dias = (formData as any).diasSemanaManha || [];
                            if (dias.includes(index)) {
                              setFormData({ ...formData, diasSemanaManha: dias.filter((d: number) => d !== index) });
                            } else {
                              setFormData({ ...formData, diasSemanaManha: [...[...dias, index].sort()] });
                            }
                          }}
                          className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                            ((formData as any).diasSemanaManha || []).includes(index)
                              ? 'bg-primary-600 text-white border-2 border-primary-600'
                              : 'bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {dia}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Início</label>
                        <input
                          type="time"
                          value={(formData as any).horarioFuncionamento?.manha?.inicio || ''}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              horarioFuncionamento: {
                                ...(formData as any).horarioFuncionamento,
                                manha: {
                                  ...( (formData as any).horarioFuncionamento?.manha || {} ),
                                  inicio: e.target.value,
                                },
                              },
                            })
                          }
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Fim</label>
                        <input
                          type="time"
                          value={(formData as any).horarioFuncionamento?.manha?.fim || ''}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              horarioFuncionamento: {
                                ...(formData as any).horarioFuncionamento,
                                manha: {
                                  ...( (formData as any).horarioFuncionamento?.manha || {} ),
                                  fim: e.target.value,
                                },
                              },
                            })
                          }
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border rounded-md p-2 bg-gray-50">
                    <div className="mb-2 flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <i className="fas fa-moon text-indigo-400" aria-hidden="true" />
                        Tarde
                      </label>
                      <span className="text-xs text-gray-500">Selecione dias e horário</span>
                    </div>
                    <div className="grid grid-cols-7 gap-2 mb-2">
                      {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((dia, index) => (
                        <button
                          key={`tarde-${index}`}
                          type="button"
                          onClick={() => {
                            const dias = (formData as any).diasSemanaTarde || [];
                            if (dias.includes(index)) {
                              setFormData({ ...formData, diasSemanaTarde: dias.filter((d: number) => d !== index) });
                            } else {
                              setFormData({ ...formData, diasSemanaTarde: [...[...dias, index].sort()] });
                            }
                          }}
                          className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                            ((formData as any).diasSemanaTarde || []).includes(index)
                              ? 'bg-primary-600 text-white border-2 border-primary-600'
                              : 'bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {dia}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Início</label>
                        <input
                          type="time"
                          value={(formData as any).horarioFuncionamento?.tarde?.inicio || ''}
                          onChange={(e) => setFormData({...formData, horarioFuncionamento: { ...(formData as any).horarioFuncionamento, tarde: { ...(formData as any).horarioFuncionamento?.tarde, inicio: e.target.value } } })}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Fim</label>
                        <input
                          type="time"
                          value={(formData as any).horarioFuncionamento?.tarde?.fim || ''}
                          onChange={(e) => setFormData({...formData, horarioFuncionamento: { ...(formData as any).horarioFuncionamento, tarde: { ...(formData as any).horarioFuncionamento?.tarde, fim: e.target.value } } })}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                </div>

                {/* Footer Fixo */}
                <div className="flex justify-end gap-3 p-4 sm:p-6 border-t bg-gray-50 rounded-b-lg flex-shrink-0">
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
                        limiteAlunos: 5,
                        diasSemana: [],
                        diasSemanaManha: [],
                        diasSemanaTarde: [],
                        horarioFuncionamento: { manha: { inicio: '', fim: '' }, tarde: { inicio: '', fim: '' } },
                        linkWhatsapp: '',
                        modalidadesVinculadas: [],
                        permiteReposicao: true
                      });
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none"
                  >
                    <i className="fas fa-times mr-2" />
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-3 py-2 rounded-md text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none disabled:opacity-50"
                  >
                    <i className={`fas ${editingModalidade ? 'fa-save' : 'fa-plus'} mr-2`} />
                    {loading ? (editingModalidade ? 'Atualizando...' : 'Criando...') : (editingModalidade ? 'Atualizar' : 'Criar')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </ProtectedPage>
  );
}
