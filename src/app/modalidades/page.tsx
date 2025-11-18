'use client';

import { useState, useEffect, useMemo } from 'react';
import Layout from '@/components/Layout';
import RequireAuth from '@/components/RequireAuth';

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
  ativo: boolean;
}

export default function ModalidadesPage() {
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
    }
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
      // request inactive modalities as well so recently desativadas remain visible on this page
      const response = await fetch('/api/modalidades?includeInactive=true');

      // Se a resposta não for OK, mostre alerta ao usuário e logue o corpo
      if (!response.ok) {
        const text = await response.text();
        alert('Erro ao buscar modalidades: ' + response.status + '\n' + text);
        console.error('Erro na requisição /api/modalidades:', response.status, text);
        return;
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await response.text();
        alert('Resposta da API de modalidades não está em formato JSON.');
        console.error('Resposta /api/modalidades não é JSON:', text);
        return;
      }

      const data = await response.json();
      if (data && data.success) {
        setModalidades(data.data || []);
      } else {
        alert('Erro ao buscar modalidades: ' + (data && data.error ? data.error : 'Formato inesperado.'));
        console.error('API /api/modalidades retornou erro ou formato inesperado:', data);
      }
    } catch (error) {
      alert('Erro ao buscar modalidades: ' + String(error));
      console.error('Erro ao buscar modalidades:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Client-side validation
      const nomeTrim = (formData.nome || '').trim();
      if (!nomeTrim) {
        alert('Nome é obrigatório');
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
        alert('Você selecionou dias para a Manhã, defina o horário de Início e Fim para Manhã (ou desmarque os dias).');
        setLoading(false);
        return;
      }

      if (diasTarde.length > 0 && (!tardeInicio || !tardeFim)) {
        alert('Você selecionou dias para a Tarde, defina o horário de Início e Fim para Tarde (ou desmarque os dias).');
        setLoading(false);
        return;
      }
      if (editingModalidade) {
        const id = (editingModalidade as any).id || (editingModalidade as any)._id;
        if (!id) {
          console.error('Tentativa de atualizar modalidade sem ID válido:', editingModalidade);
          alert('Erro interno: modalidade sem ID. Reabra o modal e tente novamente.');
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
        alert('Erro ao salvar modalidade: ' + message);
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
          horarioFuncionamento: { manha: { inicio: '', fim: '' }, tarde: { inicio: '', fim: '' } }
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
        alert('Erro: ' + (data?.error || 'Resposta inesperada do servidor'));
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
      limiteAlunos: modalidade.limiteAlunos,
      diasSemana: modalidade.diasSemana || [],
      // Derive morning/afternoon day selections from horariosDisponiveis if present
      diasSemanaManha: ((modalidade as any).horariosDisponiveis || []).length > 0 ? (((modalidade as any).horariosDisponiveis[0]?.diasSemana) || []) : (modalidade.diasSemana || []),
      diasSemanaTarde: ((modalidade as any).horariosDisponiveis || []).length > 1 ? (((modalidade as any).horariosDisponiveis[1]?.diasSemana) || []) : [],
      horarioFuncionamento: {
        manha: { inicio: (modalidade as any).horarioFuncionamento?.manha?.inicio || '', fim: (modalidade as any).horarioFuncionamento?.manha?.fim || '' },
        tarde: { inicio: (modalidade as any).horarioFuncionamento?.tarde?.inicio || '', fim: (modalidade as any).horarioFuncionamento?.tarde?.fim || '' }
      }
    });
    setShowModal(true);
  };

  const deleteModalidade = async (id: string) => {
    if (!id) {
      console.error('deleteModalidade chamado sem id válido:', id);
      alert('Erro interno: id da modalidade inválido. Recarregue a página e tente novamente.');
      return;
    }

    if (confirm('Tem certeza que deseja desativar esta modalidade?')) {
      try {
        const response = await fetch(`/api/modalidades/${id}`, {
          method: 'DELETE',
        });

        const data = await response.json();
        if (data.success) {
          // sucesso silencioso: marcar localmente como desativada para manter visível mas em estado inativo
          setModalidades(prev => prev.map(m => {
            const mid = (m as any).id || (m as any)._id || '';
            if (String(mid) === String(id)) return { ...(m as any), ativo: false } as any;
            return m;
          }));
          try {
            if (typeof window !== 'undefined') {
              // notify other tabs/pages that modalidades changed
              localStorage.setItem('modalidadesUpdated', Date.now().toString());
            }
          } catch (e) {}
        } else {
          alert('Erro ao desativar modalidade');
        }
      } catch (error) {
        console.error('Erro ao desativar modalidade:', error);
        alert('Erro ao desativar modalidade');
      }
    }
  };

  // Hard delete helper for card-level deletion (permanent)
  const deleteModalidadeHard = async (id: string) => {
    if (!id) {
      console.error('deleteModalidadeHard chamado sem id válido:', id);
      alert('Erro interno: id da modalidade inválido. Recarregue a página e tente novamente.');
      return;
    }

    if (!confirm('Tem certeza que deseja apagar esta modalidade permanentemente? Esta ação não pode ser desfeita.')) return;
    try {
      // Use the hard=true query param to request permanent deletion on the server
      const response = await fetch(`/api/modalidades/${id}?hard=true`, { method: 'DELETE' });
      let data: any = null;
      try { data = await response.json(); } catch (e) { data = null; }
      if (response.ok && data && data.success) {
        // sucesso silencioso: remover localmente (hard delete)
        setModalidades(prev => prev.filter(m => { const mid = (m as any).id || (m as any)._id || ''; return String(mid) !== String(id); }));
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem('modalidadesUpdated', Date.now().toString());
          }
        } catch (e) {}
      } else if (!response.ok) {
        const msg = data?.error || data?.message || `HTTP ${response.status}`;
        alert('Erro ao apagar modalidade: ' + msg);
      } else {
        alert('Erro ao apagar modalidade');
      }
    } catch (err) {
      console.error('Erro ao apagar modalidade:', err);
      alert('Erro ao apagar modalidade');
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
        // update local state to mark active
        setModalidades(prev => prev.map(m => {
          const mid = (m as any).id || (m as any)._id || '';
          if (String(mid) === String(id)) return { ...(m as any), ativo: true } as any;
          return m;
        }));
        try { if (typeof window !== 'undefined') localStorage.setItem('modalidadesUpdated', Date.now().toString()); } catch (e) {}
      } else {
        alert('Erro ao ativar modalidade');
      }
    } catch (err) {
      console.error('Erro ao ativar modalidade:', err);
      alert('Erro ao ativar modalidade');
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

  return (
    <RequireAuth showLoginRedirect={false}>
    <Layout title="Modalidades - Superação Flux" fullWidth>
      <div className="px-4 py-6 sm:px-0">
        <div className="flex items-center justify-between gap-4 mb-4 fade-in-1">
          <div>
            <h1 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <i className="fas fa-layer-group text-primary-600" />
              Modalidades
            </h1>
            <p className="mt-2 text-sm text-gray-600 max-w-xl">Gerencie as modalidades disponíveis no seu studio — nome, cor, duração e horários.</p>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="h-10 transition-colors duration-200 inline-flex items-center gap-2 rounded-full bg-primary-600 text-white px-4 text-sm font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <i className="fas fa-plus w-4 text-white" aria-hidden="true" />
              Nova Modalidade
            </button>
          </div>
        </div>

        {/* Search row above grid */}
        <div className="mb-6 fade-in-2">
          <div className="relative w-full sm:w-1/2">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 w-4 text-gray-400" aria-hidden="true" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pesquisar por nome ou descrição..."
              className="block w-full pl-10 pr-3 border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 bg-white"
            />
          </div>
        </div>

        {/* Grid de modalidades */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 fade-in-3">
          {filteredModalidades.map((modalidade, idx) => (
            <div
              key={(modalidade as any).id || (modalidade as any)._id || idx}
              className={`relative rounded-lg border p-6 transition-colors transition-opacity duration-200 ease-in-out fade-in-${Math.min((idx % 8) + 3, 8)} ${((modalidade as any).ativo === false) ? 'bg-gray-50 opacity-60 border-gray-200' : 'bg-white border-gray-200'}`}
            >
              {(modalidade as any).ativo === false && (
                <div className="absolute top-3 right-3 text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded transition-opacity duration-200">Desativada</div>
              )}
              <div className="flex items-center">
                <div
                  className={`w-4 h-4 rounded-full mr-3 transition-all duration-200 ease-in-out ${((modalidade as any).ativo === false) ? 'grayscale opacity-40' : ''}`}
                  style={{ backgroundColor: modalidade.cor }}
                />
                <h3 className={`text-lg font-medium transition-colors duration-200 ease-in-out ${((modalidade as any).ativo === false) ? 'text-gray-500' : 'text-gray-900'}`}>{modalidade.nome}</h3>
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

                {modalidade.diasSemana && modalidade.diasSemana.length > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Dias de aula:</span>
                    <span className="font-medium text-xs">
                      {([...modalidade.diasSemana].sort()).map(dia =>
                        ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][dia]
                      ).join(', ')}
                    </span>
                  </div>
                )}

                {((modalidade as any).horarioFuncionamento && (((modalidade as any).horarioFuncionamento.manha?.inicio) || ((modalidade as any).horarioFuncionamento.tarde?.inicio))) && (
                  <div className="mt-2 text-sm text-gray-600">
                    <div className="text-xs text-gray-500 mb-1">Horário de funcionamento:</div>
                    <div className="space-y-1">
                      {(modalidade as any).horarioFuncionamento.manha?.inicio && (modalidade as any).horarioFuncionamento.manha?.fim && (
                        <div className="text-xs bg-gray-50 p-2 rounded">Manhã: {(modalidade as any).horarioFuncionamento.manha.inicio} — {(modalidade as any).horarioFuncionamento.manha.fim}</div>
                      )}
                      {(modalidade as any).horarioFuncionamento.tarde?.inicio && (modalidade as any).horarioFuncionamento.tarde?.fim && (
                        <div className="text-xs bg-gray-50 p-2 rounded">Tarde: {(modalidade as any).horarioFuncionamento.tarde.inicio} — {(modalidade as any).horarioFuncionamento.tarde.fim}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 flex justify-end gap-3">
                {((modalidade as any).ativo === false) ? (
                  <>
                    <button disabled className="inline-flex items-center gap-2 h-8 px-3 rounded-md bg-white border border-gray-100 text-gray-300 text-sm cursor-not-allowed transition-colors duration-200">
                      <i className="fas fa-edit w-4 text-gray-300" aria-hidden="true" />
                      <span>Editar</span>
                    </button>
                    <button onClick={() => activateModalidade((modalidade as any).id || (modalidade as any)._id)} className="inline-flex items-center gap-2 h-8 px-3 rounded-md bg-primary-600 text-white text-sm transition-colors duration-200">
                      <i className="fas fa-toggle-on w-4 text-white" aria-hidden="true" />
                      <span>Ativar</span>
                    </button>
                    <button disabled className="inline-flex items-center gap-2 h-8 px-3 rounded-md bg-white border border-gray-100 text-gray-300 text-sm cursor-not-allowed transition-colors duration-200">
                      <i className="fas fa-trash-alt w-4 text-gray-300" aria-hidden="true" />
                      <span>Apagar</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => editModalidade(modalidade)} className="inline-flex items-center gap-2 h-8 px-3 rounded-md bg-white border border-gray-100 hover:bg-gray-50 text-primary-600 text-sm transition-colors duration-200">
                      <i className="fas fa-edit w-4 text-primary-600" aria-hidden="true" />
                      <span>Editar</span>
                    </button>
                    <button onClick={() => deleteModalidade((modalidade as any).id || (modalidade as any)._id)} className="inline-flex items-center gap-2 h-8 px-3 rounded-md bg-red-50 border border-red-100 text-red-700 hover:bg-red-100 text-sm transition-colors duration-200">
                      <i className="fas fa-toggle-off w-4 text-red-700" aria-hidden="true" />
                      <span>Desativar</span>
                    </button>
                    <button onClick={() => deleteModalidadeHard((modalidade as any).id || (modalidade as any)._id)} className="inline-flex items-center gap-2 h-8 px-3 rounded-md bg-red-600 text-white hover:bg-red-700 text-sm transition-colors duration-200">
                      <i className="fas fa-trash-alt w-4 text-white" aria-hidden="true" />
                      <span>Apagar</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Modal para nova modalidade */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-600 bg-opacity-50 px-4">
            <div className="relative w-full max-w-xl bg-white rounded-lg shadow-lg border p-6">
              <div className="flex items-start justify-between mb-4 border-b pb-4">
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

              <form onSubmit={handleSubmit} className="space-y-3">
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
                  <label className="block text-sm font-medium text-gray-700">Cor</label>
                  <div className="flex items-center justify-center gap-3">
                    <div className="flex flex-wrap gap-2 p-2 bg-gray-50 border border-gray-200 border-t rounded-md justify-center">
                      {coresSugeridas.map((cor) => (
                        <button
                          key={cor}
                          type="button"
                          onClick={() => setFormData({...formData, cor})}
                          className={`relative h-8 w-8 rounded-full border-2 flex items-center justify-center transition-all duration-150 hover:scale-110 hover:border-primary-400 focus:outline-none ${formData.cor === cor ? 'border-primary-600 ring-2 ring-primary-400' : 'border-gray-300'}`}
                          style={{ backgroundColor: cor }}
                          title={cor}
                        >
                          {formData.cor === cor && (
                            <span className="absolute inset-0 flex items-center justify-center">
                              <i className="fas fa-check text-white text-xs drop-shadow" />
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
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

                <div className="flex justify-end gap-3 pt-3 border-t">
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
                        horarioFuncionamento: { manha: { inicio: '', fim: '' }, tarde: { inicio: '', fim: '' } }
                      });
                    }}
                    className="px-3 py-2  border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none"
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
    </Layout>
    </RequireAuth>
  );
}
