'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';

interface Modalidade {
  _id: string;
  nome: string;
  cor: string;
}

interface Aviso {
  _id: string;
  titulo: string;
  mensagem: string;
  tipo: 'info' | 'alerta' | 'cancelamento' | 'urgente';
  dataInicio: string;
  dataFim: string;
  modalidadesAfetadas?: Modalidade[];
  ativo: boolean;
  criadoPor?: { nome: string };
  criadoEm: string;
}

const tiposAviso = [
  { value: 'info', label: 'Informativo', cor: 'bg-blue-500', icon: 'fas fa-info-circle' },
  { value: 'alerta', label: 'Alerta', cor: 'bg-yellow-500', icon: 'fas fa-exclamation-triangle' },
  { value: 'cancelamento', label: 'Cancelamento', cor: 'bg-orange-500', icon: 'fas fa-times-circle' },
  { value: 'urgente', label: 'Urgente', cor: 'bg-red-500', icon: 'fas fa-exclamation-circle' }
];

export default function AvisosPage() {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [modalidades, setModalidades] = useState<Modalidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAviso, setEditingAviso] = useState<Aviso | null>(null);
  const [salvando, setSalvando] = useState(false);
  
  const [form, setForm] = useState({
    titulo: '',
    mensagem: '',
    tipo: 'info' as 'info' | 'alerta' | 'cancelamento' | 'urgente',
    dataInicio: new Date().toISOString().split('T')[0],
    dataFim: new Date().toISOString().split('T')[0],
    modalidadesAfetadas: [] as string[],
    ativo: true
  });

  useEffect(() => {
    fetchAvisos();
    fetchModalidades();
  }, []);

  const fetchAvisos = async () => {
    try {
      const res = await fetch('/api/avisos');
      if (res.ok) {
        const data = await res.json();
        setAvisos(data.avisos || []);
      }
    } catch (error) {
      console.error('Erro ao buscar avisos:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchModalidades = async () => {
    try {
      const res = await fetch('/api/modalidades');
      if (res.ok) {
        const data = await res.json();
        setModalidades(data.data || []);
      }
    } catch (error) {
      console.error('Erro ao buscar modalidades:', error);
    }
  };

  const abrirNovoAviso = () => {
    setEditingAviso(null);
    setForm({
      titulo: '',
      mensagem: '',
      tipo: 'info',
      dataInicio: new Date().toISOString().split('T')[0],
      dataFim: new Date().toISOString().split('T')[0],
      modalidadesAfetadas: [],
      ativo: true
    });
    setShowModal(true);
  };

  const abrirEdicao = (aviso: Aviso) => {
    setEditingAviso(aviso);
    // Pega apenas a parte da data (YYYY-MM-DD) para evitar problemas de timezone
    const dataInicio = aviso.dataInicio.split('T')[0];
    const dataFim = aviso.dataFim.split('T')[0];
    setForm({
      titulo: aviso.titulo,
      mensagem: aviso.mensagem,
      tipo: aviso.tipo,
      dataInicio,
      dataFim,
      modalidadesAfetadas: aviso.modalidadesAfetadas?.map(m => m._id) || [],
      ativo: aviso.ativo
    });
    setShowModal(true);
  };

  const salvarAviso = async () => {
    if (!form.titulo || !form.mensagem || !form.dataInicio || !form.dataFim) {
      toast.warning('Preencha todos os campos obrigatórios');
      return;
    }

    setSalvando(true);
    try {
      // Envia a data no formato YYYY-MM-DD sem converter para UTC
      // O backend vai interpretar como data local
      const payload = {
        ...form,
        dataInicio: form.dataInicio + 'T12:00:00.000Z',
        dataFim: form.dataFim + 'T12:00:00.000Z'
      };

      let res;
      if (editingAviso) {
        res = await fetch(`/api/avisos/${editingAviso._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch('/api/avisos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (res.ok) {
        toast.success(editingAviso ? 'Aviso atualizado!' : 'Aviso criado!');
        setShowModal(false);
        fetchAvisos();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Erro ao salvar aviso');
      }
    } catch {
      toast.error('Erro ao salvar aviso');
    } finally {
      setSalvando(false);
    }
  };

  const excluirAviso = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este aviso?')) return;

    try {
      const res = await fetch(`/api/avisos/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Aviso excluído!');
        fetchAvisos();
      } else {
        toast.error('Erro ao excluir aviso');
      }
    } catch {
      toast.error('Erro ao excluir aviso');
    }
  };

  const toggleAtivo = async (aviso: Aviso) => {
    try {
      const res = await fetch(`/api/avisos/${aviso._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: !aviso.ativo })
      });

      if (res.ok) {
        toast.success(aviso.ativo ? 'Aviso desativado' : 'Aviso ativado');
        fetchAvisos();
      }
    } catch {
      toast.error('Erro ao atualizar aviso');
    }
  };

  const formatarData = (dataStr: string) => {
    // Corrige problema de timezone: pega apenas a parte da data e formata localmente
    const dataLocal = dataStr.split('T')[0];
    const [ano, mes, dia] = dataLocal.split('-');
    return `${dia}/${mes}/${ano}`;
  };

  const getTipoBadge = (tipo: string) => {
    const tipoInfo = tiposAviso.find(t => t.value === tipo);
    return tipoInfo || tiposAviso[0];
  };

  const isVigente = (aviso: Aviso) => {
    const hoje = new Date().toISOString().split('T')[0];
    const inicio = aviso.dataInicio.split('T')[0];
    const fim = aviso.dataFim.split('T')[0];
    return aviso.ativo && inicio <= hoje && fim >= hoje;
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Avisos para Alunos</h1>
          <p className="text-sm text-gray-500 mt-1">Gerencie avisos e cancelamentos de aulas</p>
        </div>
        <button
          onClick={abrirNovoAviso}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
        >
          <i className="fas fa-plus"></i>
          <span>Novo Aviso</span>
        </button>
      </div>

      {/* Avisos ativos no topo */}
      {avisos.filter(a => isVigente(a)).length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">
            Avisos Ativos Agora
          </h2>
          <div className="space-y-2">
            {avisos.filter(a => isVigente(a)).map(aviso => {
              const tipo = getTipoBadge(aviso.tipo);
              return (
                <div key={aviso._id} className={`${tipo.cor} rounded-xl p-4 text-white`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <i className={`${tipo.icon} text-xl mt-0.5`}></i>
                      <div>
                        <h3 className="font-bold">{aviso.titulo}</h3>
                        <p className="text-sm opacity-90 mt-1">{aviso.mensagem}</p>
                        <p className="text-xs opacity-75 mt-2">
                          {formatarData(aviso.dataInicio)} até {formatarData(aviso.dataFim)}
                          {aviso.modalidadesAfetadas && aviso.modalidadesAfetadas.length > 0 && (
                            <span className="ml-2">• {aviso.modalidadesAfetadas.map(m => m.nome).join(', ')}</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => abrirEdicao(aviso)}
                        className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                      >
                        <i className="fas fa-edit"></i>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Lista de todos os avisos */}
      <div>
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">
          Todos os Avisos
        </h2>
        
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : avisos.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <i className="fas fa-bullhorn text-gray-300 text-4xl mb-3"></i>
            <p className="text-gray-500">Nenhum aviso cadastrado</p>
            <button
              onClick={abrirNovoAviso}
              className="mt-4 text-primary-600 hover:text-primary-700 font-medium"
            >
              Criar primeiro aviso
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aviso</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Período</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">Modalidades</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {avisos.map(aviso => {
                  const tipo = getTipoBadge(aviso.tipo);
                  const vigente = isVigente(aviso);
                  
                  return (
                    <tr key={aviso._id} className={`hover:bg-gray-50 ${!aviso.ativo ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg ${tipo.cor} flex items-center justify-center text-white`}>
                            <i className={tipo.icon}></i>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{aviso.titulo}</p>
                            <p className="text-xs text-gray-500 truncate max-w-xs">{aviso.mensagem}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <p className="text-sm text-gray-900">{formatarData(aviso.dataInicio)}</p>
                        <p className="text-xs text-gray-500">até {formatarData(aviso.dataFim)}</p>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {aviso.modalidadesAfetadas && aviso.modalidadesAfetadas.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {aviso.modalidadesAfetadas.slice(0, 2).map(m => (
                              <span key={m._id} className="px-2 py-0.5 text-xs rounded text-white" style={{ backgroundColor: m.cor }}>
                                {m.nome}
                              </span>
                            ))}
                            {aviso.modalidadesAfetadas.length > 2 && (
                              <span className="text-xs text-gray-500">+{aviso.modalidadesAfetadas.length - 2}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">Todas</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {vigente ? (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                            Ativo
                          </span>
                        ) : aviso.ativo ? (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                            Agendado
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">
                            Inativo
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => toggleAtivo(aviso)}
                            className={`p-2 rounded-lg transition-colors ${
                              aviso.ativo ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'
                            }`}
                            title={aviso.ativo ? 'Desativar' : 'Ativar'}
                          >
                            <i className={`fas ${aviso.ativo ? 'fa-toggle-on' : 'fa-toggle-off'}`}></i>
                          </button>
                          <button
                            onClick={() => abrirEdicao(aviso)}
                            className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <i className="fas fa-edit"></i>
                          </button>
                          <button
                            onClick={() => excluirAviso(aviso._id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Excluir"
                          >
                            <i className="fas fa-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                {editingAviso ? 'Editar Aviso' : 'Novo Aviso'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="space-y-4">
              {/* Tipo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo do Aviso</label>
                <div className="grid grid-cols-2 gap-2">
                  {tiposAviso.map(tipo => (
                    <button
                      key={tipo.value}
                      type="button"
                      onClick={() => setForm({ ...form, tipo: tipo.value as typeof form.tipo })}
                      className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                        form.tipo === tipo.value
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded ${tipo.cor} flex items-center justify-center text-white`}>
                        <i className={tipo.icon}></i>
                      </div>
                      <span className="text-sm font-medium text-gray-700">{tipo.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Título */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Título <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.titulo}
                  onChange={e => setForm({ ...form, titulo: e.target.value })}
                  placeholder="Ex: Aulas canceladas por chuva"
                  maxLength={100}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {/* Mensagem */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mensagem <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={form.mensagem}
                  onChange={e => setForm({ ...form, mensagem: e.target.value })}
                  placeholder="Descreva o aviso em detalhes..."
                  rows={3}
                  maxLength={500}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Período */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data Início <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.dataInicio}
                    onChange={e => setForm({ ...form, dataInicio: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data Fim <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.dataFim}
                    onChange={e => setForm({ ...form, dataFim: e.target.value })}
                    min={form.dataInicio}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Modalidades afetadas */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Modalidades Afetadas
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  Deixe vazio para afetar todas as modalidades
                </p>
                <div className="flex flex-wrap gap-2">
                  {modalidades.map(mod => (
                    <button
                      key={mod._id}
                      type="button"
                      onClick={() => {
                        const novas = form.modalidadesAfetadas.includes(mod._id)
                          ? form.modalidadesAfetadas.filter(id => id !== mod._id)
                          : [...form.modalidadesAfetadas, mod._id];
                        setForm({ ...form, modalidadesAfetadas: novas });
                      }}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        form.modalidadesAfetadas.includes(mod._id)
                          ? 'text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                      style={form.modalidadesAfetadas.includes(mod._id) ? { backgroundColor: mod.cor } : {}}
                    >
                      {mod.nome}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ativo */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, ativo: !form.ativo })}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    form.ativo ? 'bg-primary-600' : 'bg-gray-300'
                  }`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    form.ativo ? 'left-7' : 'left-1'
                  }`}></span>
                </button>
                <span className="text-sm font-medium text-gray-700">
                  {form.ativo ? 'Aviso ativo' : 'Aviso inativo'}
                </span>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={salvarAviso}
                disabled={salvando}
                className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg disabled:opacity-50"
              >
                {salvando ? <><i className="fas fa-spinner fa-spin mr-2"></i>Salvando...</> : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
