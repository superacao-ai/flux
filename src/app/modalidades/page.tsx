'use client';

import { useState, useEffect, useMemo } from 'react';
import Layout from '@/components/Layout';

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
      const response = await fetch('/api/modalidades');

      // Se a resposta não for OK, logue o corpo (pode ser HTML de erro)
      if (!response.ok) {
        const text = await response.text();
        console.error('Erro na requisição /api/modalidades:', response.status, text);
        return;
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Resposta /api/modalidades não é JSON:', text);
        return;
      }

      const data = await response.json();
      if (data && data.success) {
        setModalidades(data.data || []);
      } else {
        console.error('API /api/modalidades retornou erro ou formato inesperado:', data);
      }
    } catch (error) {
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
          // sucesso silencioso: recarregar lista
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
        // sucesso silencioso: recarregar lista
        fetchModalidades();
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
    <Layout title="Modalidades - Superação Flux">
      <div className="px-4 py-6 sm:px-0">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Modalidades</h1>
            <p className="mt-1 text-sm text-gray-600 max-w-xl">Gerencie as modalidades disponíveis no seu studio — nome, cor, duração e horários.</p>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="h-10 inline-flex items-center gap-2 rounded-md bg-primary-600 text-white px-4 text-sm font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
              Nova Modalidade
            </button>
          </div>
        </div>

        {/* Search row above grid */}
        <div className="mb-6">
          <div className="relative w-full sm:w-1/2">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" /></svg>
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
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredModalidades.map((modalidade, idx) => (
            <div key={(modalidade as any).id || (modalidade as any)._id || idx} className="bg-white rounded-lg shadow border border-gray-200 p-6">
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

                {/* Exibir dias da semana */}
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

                {/* Mostrar horário de funcionamento da modalidade, se definido */}
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
                
                {/* Horários disponíveis removidos do card para simplificar a visualização */}
              </div>
              
              <div className="mt-4 flex justify-end gap-3">
                <button onClick={() => editModalidade(modalidade)} className="inline-flex items-center gap-2 h-8 px-3 rounded-md bg-white border border-gray-100 hover:bg-gray-50 text-primary-600 text-sm">
                  <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536M9 11l6-6 3 3-6 6H9v-3z"/></svg>
                  <span>Editar</span>
                </button>
                <button onClick={() => deleteModalidade((modalidade as any).id || (modalidade as any)._id)} className="inline-flex items-center gap-2 h-8 px-3 rounded-md bg-red-50 border border-red-100 text-red-700 hover:bg-red-100 text-sm">
                  <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M10 3h4l1 4H9l1-4z"/></svg>
                  <span>Desativar</span>
                </button>
                <button onClick={() => deleteModalidadeHard((modalidade as any).id || (modalidade as any)._id)} className="inline-flex items-center gap-2 h-8 px-3 rounded-md bg-red-600 text-white hover:bg-red-700 text-sm">
                  <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9"/></svg>
                  <span>Apagar</span>
                </button>
              </div>
            </div>
          ))}
          
          {filteredModalidades.length === 0 && (
            <div className="col-span-full text-center text-gray-500 py-12">
              <div className="mx-auto h-12 w-12 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center">
                <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhuma modalidade</h3>
              <p className="mt-1 text-sm text-gray-500">Comece criando sua primeira modalidade.</p>
              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(true)}
                  className="h-10 inline-flex items-center gap-2 rounded-md bg-primary-600 text-white px-4 text-sm font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
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

                {/* Blocos separados: Manhã e Tarde (cada um com dias + horários abaixo) */}
                <div className="space-y-4">
                  {/* Manhã block */}
                  <div className="border rounded-md p-3 bg-gray-50">
                    <div className="mb-2 flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-700">Manhã</label>
                      <span className="text-xs text-gray-500">Selecione dias e horário</span>
                    </div>
                    <div className="grid grid-cols-7 gap-2 mb-3">
                      {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((dia, index) => (
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
                          className={`px-2 py-2 text-xs font-medium rounded-md transition-colors ${
                            ((formData as any).diasSemanaManha || []).includes(index)
                              ? 'bg-primary-600 text-white border-2 border-primary-600'
                              : 'bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {dia}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
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
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
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
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Tarde block */}
                  <div className="border rounded-md p-3 bg-gray-50">
                    <div className="mb-2 flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-700">Tarde</label>
                      <span className="text-xs text-gray-500">Selecione dias e horário</span>
                    </div>
                    <div className="grid grid-cols-7 gap-2 mb-3">
                      {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((dia, index) => (
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
                          className={`px-2 py-2 text-xs font-medium rounded-md transition-colors ${
                            ((formData as any).diasSemanaTarde || []).includes(index)
                              ? 'bg-primary-600 text-white border-2 border-primary-600'
                              : 'bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {dia}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Início</label>
                        <input
                          type="time"
                          value={(formData as any).horarioFuncionamento?.tarde?.inicio || ''}
                          onChange={(e) => setFormData({...formData, horarioFuncionamento: { ...(formData as any).horarioFuncionamento, tarde: { ...(formData as any).horarioFuncionamento?.tarde, inicio: e.target.value } } })}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Fim</label>
                        <input
                          type="time"
                          value={(formData as any).horarioFuncionamento?.tarde?.fim || ''}
                          onChange={(e) => setFormData({...formData, horarioFuncionamento: { ...(formData as any).horarioFuncionamento, tarde: { ...(formData as any).horarioFuncionamento?.tarde, fim: e.target.value } } })}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* (Horários já apresentados nos blocos Manhã e Tarde acima) */}

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
                        limiteAlunos: 5,
                        diasSemana: [],
                        diasSemanaManha: [],
                        diasSemanaTarde: [],
                        horarioFuncionamento: { manha: { inicio: '', fim: '' }, tarde: { inicio: '', fim: '' } }
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
