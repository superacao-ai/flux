"use client";

import React, { useEffect, useState } from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  horario: any;
  modalidades: any[];
  horarios: any[];
  onRefresh?: () => void;
}

const StudentDetailModal: React.FC<Props> = ({ isOpen, onClose, horario, modalidades, horarios, onRefresh }) => {
  const [modalEditing, setModalEditing] = useState(false);
  const [modalEditName, setModalEditName] = useState('');
  const [modalEditObservacoes, setModalEditObservacoes] = useState('');
  const [alunoPeriodo, setAlunoPeriodo] = useState<string | null>(null);
  const [alunoParceria, setAlunoParceria] = useState<string | null>(null);
  const [alunoCongelado, setAlunoCongelado] = useState<boolean>(false);
  const [alunoAusente, setAlunoAusente] = useState<boolean>(false);
  const [alunoEmEspera, setAlunoEmEspera] = useState<boolean>(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictSubstitutes, setConflictSubstitutes] = useState<any[] | null>(null);
  const [conflictLoading, setConflictLoading] = useState(false);
  const [alunos, setAlunos] = useState<any[]>([]);
  const [selectedAlunoToMerge, setSelectedAlunoToMerge] = useState<string | null>(null);
  const [loadingAlunos, setLoadingAlunos] = useState(false);
  const [mergeSearchText, setMergeSearchText] = useState<string>('');

  const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

  // getMid is already declared below; keep a single definition further down

  const getModalidadeColor = (m: any) => {
    if (!m) return '#3B82F6';
    const id = getMid(m) || (m && m.nome) || '';
    const found = modalidades.find(md => ((md as any)._id && String((md as any)._id) === String(id)) || (md.nome && md.nome === (m.nome || id)));
    return (found && ((found as any).cor || '#3B82F6')) || m.cor || '#3B82F6';
  };

  // Retorna a cor do status do aluno
  const getStatusColor = (): string => {
    if (alunoAusente) return '#ef4444'; // vermelho
    if (alunoCongelado) return '#0ea5e9'; // azul
    if (alunoEmEspera) return '#eab308'; // amarelo
    return '#1f2937'; // cinza (padrão)
  };

  useEffect(() => {
    if (!horario) return;
    const name = horario.alunoId?.nome || horario.aluno?.nome || horario.nome || '';
    setModalEditName(name);
    setModalEditObservacoes(String(horario.alunoId?.observacoes || horario.aluno?.observacoes || ''));
    setModalEditing(false);
    
    // initialize aluno linked info if present
    const aluno = horario.alunoId || horario.aluno;
    
    if (aluno) {
      setAlunoPeriodo(aluno.periodoTreino || null);
      setAlunoParceria(aluno.parceria || aluno.parceriaNome || null);
      setAlunoCongelado(aluno.congelado === true);
      setAlunoAusente(aluno.ausente === true);
      setAlunoEmEspera(aluno.emEspera === true);
    } else {
      // Reset states se não há aluno
      setAlunoCongelado(false);
      setAlunoAusente(false);
      setAlunoEmEspera(false);
    }
  }, [horario]);

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const getMid = (m: any) => (m && ((m as any).id || (m as any)._id)) || '';

  const fetchAndRefresh = async () => {
    try { if (onRefresh) await onRefresh(); } catch (e) { console.error(e); }
  };

  // Toggle / persist aluno.congelado (mutuamente exclusivo com ausente e emEspera)
  const toggleAlunoCongelado = async () => {
    try {
      const aluno = horario.alunoId || horario.aluno;
      if (!aluno || !aluno._id) { alert('Aluno não encontrado'); return; }
      const alunoId = String(aluno._id);
      const newValue = !alunoCongelado;

      // Se ativando congelado, desativa ausente e emEspera
      const updateBody: any = { congelado: newValue };
      if (newValue) {
        updateBody.ausente = false;
        updateBody.emEspera = false;
      }
      
      const resp = await fetch(`/api/alunos/${alunoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateBody)
      });

      // If backend reports substitutes (conflict 409), surface a decision modal
      if (resp.status === 409) {
        const data = await resp.json().catch(() => null);
        if (data && data.error === 'substitute_exists' && Array.isArray(data.substitutes)) {
          setConflictSubstitutes(data.substitutes);
          setShowConflictModal(true);
          return; // do not proceed further
        }
        throw new Error((data && data.error) ? data.error : 'Conflito ao atualizar aluno');
      }

      const data = await resp.json();
      if (!data || !data.success) {
        throw new Error(data?.error || 'Erro ao atualizar aluno');
      }
      
      // Sync UI
      const congelado = data.data?.congelado === true;
      setAlunoCongelado(congelado);
      setAlunoAusente(data.data?.ausente === true);
      setAlunoEmEspera(data.data?.emEspera === true);
      
      // Atualizar o objeto aluno no horario
      if (horario.alunoId) {
        Object.assign(horario.alunoId, data.data);
      }
      
      await fetchAndRefresh();
    } catch (err: any) {
      console.error('Erro ao atualizar congelado:', err);
      alert('Erro ao atualizar informação do aluno: ' + (err?.message || 'erro'));
    }
  };

  // Toggle / persist aluno.ausente (mutuamente exclusivo com congelado e emEspera)
  const toggleAlunoAusente = async () => {
    try {
      const aluno = horario.alunoId || horario.aluno;
      if (!aluno || !aluno._id) { alert('Aluno não encontrado'); return; }
      const alunoId = String(aluno._id);
      const newValue = !alunoAusente;

      // Se ativando ausente, desativa congelado e emEspera
      const updateBody: any = { ausente: newValue };
      if (newValue) {
        updateBody.congelado = false;
        updateBody.emEspera = false;
      }

      const resp = await fetch(`/api/alunos/${alunoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateBody)
      });

      if (resp.status === 409) {
        const data = await resp.json().catch(() => null);
        if (data && data.error === 'substitute_exists' && Array.isArray(data.substitutes)) {
          setConflictSubstitutes(data.substitutes);
          setShowConflictModal(true);
          return;
        }
        throw new Error((data && data.error) ? data.error : 'Conflito ao atualizar aluno');
      }

      const data = await resp.json();
      if (!data || !data.success) {
        throw new Error(data?.error || 'Erro ao atualizar aluno');
      }

      // Sync UI
      const ausente = data.data?.ausente === true;
      setAlunoAusente(ausente);
      setAlunoCongelado(data.data?.congelado === true);
      setAlunoEmEspera(data.data?.emEspera === true);
      if (horario.alunoId) Object.assign(horario.alunoId, data.data);
      await fetchAndRefresh();
    } catch (err: any) {
      console.error('Erro ao atualizar ausente:', err);
      alert('Erro ao atualizar informação do aluno: ' + (err?.message || 'erro'));
    }
  };

  // Toggle / persist aluno.emEspera (mutuamente exclusivo com congelado e ausente)
  const toggleAlunoEmEspera = async () => {
    try {
      const aluno = horario.alunoId || horario.aluno;
      if (!aluno || !aluno._id) { alert('Aluno não encontrado'); return; }
      const alunoId = String(aluno._id);
      const newValue = !alunoEmEspera;

      // Se ativando emEspera, desativa congelado e ausente
      const updateBody: any = { emEspera: newValue };
      if (newValue) {
        updateBody.congelado = false;
        updateBody.ausente = false;
      }

      const resp = await fetch(`/api/alunos/${alunoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateBody)
      });

      if (resp.status === 409) {
        const data = await resp.json().catch(() => null);
        if (data && data.error === 'substitute_exists' && Array.isArray(data.substitutes)) {
          setConflictSubstitutes(data.substitutes);
          setShowConflictModal(true);
          return;
        }
        throw new Error((data && data.error) ? data.error : 'Conflito ao atualizar aluno');
      }

      const data = await resp.json();
      if (!data || !data.success) {
        throw new Error(data?.error || 'Erro ao atualizar aluno');
      }

      // Sync UI
      const emEspera = data.data?.emEspera === true;
      setAlunoEmEspera(emEspera);
      setAlunoCongelado(data.data?.congelado === true);
      setAlunoAusente(data.data?.ausente === true);
      if (horario.alunoId) Object.assign(horario.alunoId, data.data);
      await fetchAndRefresh();
    } catch (err: any) {
      console.error('Erro ao atualizar emEspera:', err);
      alert('Erro ao atualizar informação do aluno: ' + (err?.message || 'erro'));
    }
  };

  // Handle force-unfreeze (admin override)
  const handleForceUnfreeze = async () => {
    try {
      const aluno = horario.alunoId || horario.aluno;
      if (!aluno || !aluno._id) { alert('Aluno não encontrado'); return; }
      setConflictLoading(true);
      const resp = await fetch(`/api/alunos/${aluno._id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ congelado: false, forceUnfreeze: true }) });
      const data = await resp.json();
      if (!resp.ok || !data || !data.success) throw new Error(data?.error || 'Erro ao forçar descongelar');
      setAlunoCongelado(false);
      setAlunoAusente(data.data?.ausente === true);
      setAlunoEmEspera(data.data?.emEspera === true);
      if (horario.alunoId) Object.assign(horario.alunoId, data.data);
      setShowConflictModal(false);
      setConflictSubstitutes(null);
      await fetchAndRefresh();
    } catch (err: any) {
      console.error('Erro ao forçar descongelar:', err);
      alert('Erro ao forçar descongelar: ' + (err?.message || 'erro'));
    } finally {
      setConflictLoading(false);
    }
  };

  // Handle reclaiming a vacancy by removing the substitute matricula and unfreezing original (server does both)
  const handleReclaim = async (sub: any) => {
    try {
      if (!sub || !sub._id || !sub.replacesMatriculaId) { alert('Dados inválidos da substituição'); return; }
      if (!confirm('Reaver esta vaga removerá o substituto e reativará o aluno original. Continuar?')) return;
      setConflictLoading(true);
      const resp = await fetch('/api/matriculas/reclaim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originalMatriculaId: sub.replacesMatriculaId, substituteMatriculaId: sub._id })
      });
      const data = await resp.json();
      if (!resp.ok || !data || !data.success) throw new Error(data?.error || 'Erro ao reaver vaga');
      alert('Vaga reavida com sucesso. Aluno original reativado.');
      setShowConflictModal(false);
      setConflictSubstitutes(null);
      await fetchAndRefresh();
    } catch (err: any) {
      console.error('Erro ao reaver vaga:', err);
      alert('Erro ao reaver vaga: ' + (err?.message || 'erro'));
    } finally {
      setConflictLoading(false);
    }
  };

  const updateAlunoObservacoes = async (newObservacoes?: string) => {
    if (typeof newObservacoes === 'undefined') return;
    try {
      const aluno = horario.alunoId || horario.aluno;
      if (!aluno || !aluno._id) { alert('Aluno não encontrado'); return; }
      
      const alunoId = String(aluno._id);
      const resp = await fetch(`/api/alunos/${alunoId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ observacoes: newObservacoes }) });
      const data = await resp.json();
      if (data && data.success) {
        // Atualizar o aluno com os dados atualizados
        if (data.data) {
          if (horario.alunoId) {
            Object.assign(horario.alunoId, data.data);
          }
          setModalEditObservacoes(String(data.data.observacoes || ''));
        }
        await fetchAndRefresh();
      } else {
        alert('Erro ao atualizar observações: ' + (data.error || 'erro'));
      }
    } catch (err) {
      console.error('Erro ao atualizar observações:', err);
      alert('Erro ao atualizar observações');
    }
  };

  const deleteHorario = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este horário?')) return;
    try {
      const response = await fetch(`/api/horarios/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.success) {
        await fetchAndRefresh();
        onClose();
      } else {
        alert('Erro ao excluir horário');
      }
    } catch (error) {
      console.error('Erro ao excluir horário:', error);
      alert('Erro ao excluir horário');
    }
  };

  const editAlunoName = async (horarioObj: any) => {
    try {
      const aluno = horarioObj?.alunoId;
      if (!aluno || !aluno._id) { alert('Aluno não encontrado para este horário'); return; }
      const current = String(aluno.nome || '');
      const novo = modalEditName;
      if (!novo || novo.trim() === '') { alert('Nome não pode ficar vazio'); return; }
      const resp = await fetch(`/api/alunos/${aluno._id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: novo.trim() }) });
      const data = await resp.json();
      if (data && data.success) {
        // Atualizar o modal com o nome atualizado imediatamente
        if (data.data && horario.alunoId) {
          Object.assign(horario.alunoId, data.data);
          // if backend returned periodo/parceria keep in sync
          if (data.data.periodoTreino) setAlunoPeriodo(data.data.periodoTreino);
          if (data.data.parceria) setAlunoParceria(data.data.parceria);
        }
        await fetchAndRefresh();
      } else {
        alert('Erro ao atualizar aluno: ' + (data && data.error ? data.error : 'erro'));
      }
    } catch (err) {
      console.error('Erro ao editar aluno:', err);
      alert('Erro ao editar aluno');
    }
  };

  const fetchAlunos = async () => {
    setLoadingAlunos(true);
    try {
      const resp = await fetch('/api/alunos');
      const data = await resp.json();
      if (data && data.success) {
        const currentAlunoId = horario.alunoId?._id || horario.alunoId;
        const filtered = (data.data || []).filter((a: any) => String(a._id) !== String(currentAlunoId));
        setAlunos(filtered);
      }
    } catch (err) {
      console.error('Erro ao carregar alunos:', err);
      alert('Erro ao carregar lista de alunos');
    } finally {
      setLoadingAlunos(false);
    }
  };

  const handleOpenMergeModal = async () => {
    setShowMergeModal(true);
    await fetchAlunos();
  };

  const mergeStudent = async () => {
    if (!selectedAlunoToMerge) {
      alert('Selecione um aluno para vincular');
      return;
    }

    if (!confirm(`Tem certeza que deseja vincular todos os horários deste aluno ao selecionado? Esta ação não pode ser desfeita.`)) {
      return;
    }

    try {
      setLoadingAlunos(true);
      const currentAlunoId = horario.alunoId?._id || horario.alunoId;
      
      // Atualizar todos os horários do aluno atual para apontar para o novo aluno
      const resp = await fetch('/api/horarios/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromAlunoId: String(currentAlunoId),
          toAlunoId: selectedAlunoToMerge
        })
      });

      const data = await resp.json();
      if (data && data.success) {
        alert(`Sucesso! ${data.data.updatedCount || 0} horário(s) vinculado(s).`);
        setShowMergeModal(false);
        setSelectedAlunoToMerge(null);
        await fetchAndRefresh();
        onClose();
      } else {
        alert('Erro ao vincular alunos: ' + (data.error || 'erro'));
      }
    } catch (err) {
      console.error('Erro ao vincular alunos:', err);
      alert('Erro ao vincular alunos');
    } finally {
      setLoadingAlunos(false);
    }
  };

  // Toggle / persist aluno.periodoTreino (e.g., '12/36')
  const toggleAlunoPeriodo = async () => {
    try {
      const aluno = horario.alunoId || horario.aluno;
      if (!aluno || !aluno._id) { alert('Aluno não encontrado'); return; }
      const alunoId = String(aluno._id);
      const newValue = alunoPeriodo === '12/36' ? null : '12/36';
      
      const resp = await fetch(`/api/alunos/${alunoId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ periodoTreino: newValue }) });
      const data = await resp.json();
      
      if (!data || !data.success) {
        throw new Error(data?.error || 'Erro ao atualizar aluno');
      }
      // Sync UI
      const periodo = data.data?.periodoTreino || null;
      setAlunoPeriodo(periodo);
      if (horario.alunoId) Object.assign(horario.alunoId, data.data);
      await fetchAndRefresh();
    } catch (err: any) {
      console.error('Erro ao atualizar periodoTreino:', err);
      alert('Erro ao atualizar informação do aluno: ' + (err?.message || 'erro'));
    }
  };

  // Toggle / persist aluno.parceria (e.g., 'TOTALPASS')
  const toggleAlunoParceria = async () => {
    try {
      const aluno = horario.alunoId || horario.aluno;
      if (!aluno || !aluno._id) { alert('Aluno não encontrado'); return; }
      const alunoId = String(aluno._id);
      const newValue = alunoParceria === 'TOTALPASS' ? null : 'TOTALPASS';

      const resp = await fetch(`/api/alunos/${alunoId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ parceria: newValue }) });
      const data = await resp.json();
      
      if (!data || !data.success) {
        throw new Error(data?.error || 'Erro ao atualizar aluno');
      }
      // Sync UI
      const parceria = data.data?.parceria || data.data?.parceriaNome || null;
      setAlunoParceria(parceria);
      if (horario.alunoId) Object.assign(horario.alunoId, data.data);
      await fetchAndRefresh();
    } catch (err: any) {
      console.error('Erro ao atualizar parceria:', err);
      alert('Erro ao atualizar informação do aluno: ' + (err?.message || 'erro'));
    }
  };

  if (!isOpen || !horario) return null;

  const modalidadeId = horario.modalidadeId || horario.aluno?.modalidadeId || horario.modalidade || null;
  const modalidadeObj = modalidades.find(m => getMid(m) === String(modalidadeId));

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center" style={{ zIndex: 9999 }} onClick={() => onClose()}>
      <div className="relative mx-auto w-full max-w-2xl bg-white rounded-lg shadow-lg border p-6" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="studentDetailTitle">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-gray-200">
          <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <i className="fas fa-user text-lg text-primary-600" aria-hidden="true" />
                <h3 id="studentDetailTitle" className="text-base font-semibold text-gray-900">Detalhes do Aluno</h3>
              </div>
              <div>
                <p className="text-sm text-gray-500 mt-1"><i className="fas fa-info-circle text-primary-600 mr-2" aria-hidden="true" />Informações e status deste aluno</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); handleOpenMergeModal(); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); handleOpenMergeModal(); } }}
              className="text-sm font-medium text-primary-600 cursor-pointer hover:underline"
            >
              Mesclar
            </span>
            <button onClick={() => onClose()} aria-label="Fechar" title="Fechar" className="w-9 h-9 rounded-full bg-white text-gray-600 flex items-center justify-center">
              <i className="fas fa-times" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="pt-4 pb-4 space-y-6">
          {modalEditing ? (
            // MODO EDIÇÃO
            <>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
                <div className="sm:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nome do Aluno</label>
                  <input 
                    value={modalEditName} 
                    onChange={e => setModalEditName(e.target.value)} 
                    className="w-full h-10 px-3 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent" 
                    placeholder="Nome do aluno"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <div className="text-sm text-gray-500">Editar</div>
                </div>
                <div className="sm:col-span-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Observações</label>
                  <textarea 
                    value={modalEditObservacoes} 
                    onChange={e => setModalEditObservacoes(e.target.value)} 
                    className="w-full px-3 py-2 h-28 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent" 
                    rows={4}
                    placeholder="Adicione observações sobre o aluno..."
                  />
                </div>
              </div>
            </>
          ) : (
            // MODO VISUALIZAÇÃO
            <>
              {/* Informações Básicas */}
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-primary-600 text-white rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0">
                  {(horario.alunoId?.nome || horario.aluno?.nome || horario.nome || '?').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <h4 className="text-lg font-semibold" style={{ color: getStatusColor() }}>
                    {horario.alunoId?.nome || horario.aluno?.nome || horario.nome || 'Nome não informado'}
                  </h4>
                  {(horario.alunoId?.observacoes || horario.aluno?.observacoes) && (
                    <div className="mt-3">
                      <span className="inline-block px-3 py-1.5 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold border border-yellow-200">
                        <i className="fas fa-sticky-note mr-1"></i>
                        {horario.alunoId?.observacoes || horario.aluno?.observacoes}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Status Flags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Status do Aluno</label>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={toggleAlunoCongelado}
                    title={alunoCongelado ? 'Remover congelado' : 'Marcar congelado'}
                    className={`px-3 h-10 py-2 rounded-md border transition-all text-sm font-medium flex items-center gap-2 ${alunoCongelado ? 'bg-sky-50 border-sky-300 text-sky-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                  >
                    <i className="fas fa-snowflake"></i>
                    Congelado
                  </button>

                  <button
                    onClick={toggleAlunoAusente}
                    title={alunoAusente ? 'Remover ausente' : 'Marcar ausente'}
                    className={`px-3 py-2 rounded-md border transition-all text-sm font-medium flex items-center gap-2 ${alunoAusente ? 'bg-rose-50 border-rose-300 text-rose-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                  >
                    <i className="fas fa-user-clock"></i>
                    Parou de Vir
                  </button>

                  {/* 'Em Espera' button removed as requested */}

                  <button
                    onClick={toggleAlunoPeriodo}
                    title={alunoPeriodo === '12/36' ? 'Remover 12/36' : 'Marcar 12/36'}
                    className={`px-3 py-2 rounded-md border transition-all text-sm font-medium flex items-center gap-2 ${alunoPeriodo === '12/36' ? 'bg-green-50 border-green-300 text-green-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                  >
                    <i className="fas fa-clock"></i>
                    12/36
                  </button>

                  <button
                    onClick={toggleAlunoParceria}
                    title={alunoParceria === 'TOTALPASS' ? 'Remover TOTALPASS' : 'Marcar TOTALPASS'}
                    className={`px-3 py-2 rounded-md border transition-all text-sm font-medium flex items-center gap-2 ${alunoParceria === 'TOTALPASS' ? 'bg-purple-50 border-purple-300 text-purple-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                  >
                    <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAC1UlEQVR4AbyWg5LlQBiFY3uSu7Zt27Zt27Zt27Zt60G2tC8w/3aWk/qvkkGqzuU53V+7qSwPQ6S5rttM07Sptm3PJZqXQ5pLypwci8UakjoUIpoo8HDE1EgQhC/kcyYR5IZoms6UJOmtaZo1/zT418OSypuwLPsDh3JHpK7vlmXV+NsTBmn5N2zMXZGeeEneZcpxnLYpA7k0HGS+1aZUVZ336wdZAGNNHzDX9wupvmCs6gVsASs0hKIooykyO5f6X4RaxcH7sCya3i4BRpdDAxiGMeUfgDqyWWQA+9Q4VHhoAHP74MgA2uyO2QfQF3cDi0D8077hcStzzk0M+nYMBnNtX1CHN/0lZWhjUAY1DEjuXgv4qkWA5piEAHitFs2IC8CVzR/0kcnnvU+vpzKuTgOhXqn0AKTO1VEB7qN5QLNM0Neharghe70Y+IoFUwPoS7qhsLllIPbN7xx6zpgb+qUAoClwLk1BQWVwIwTgnJ8UGiDj1ozkAIyrxx1XvnLhoM9WwXu3NDzAvdnJAcRWlVDIfbYAaJ4N+pqVj7ZvHB6VHECb1QGFrF1DAPmmtY0EoI5qlhyA7Gw4NLIpIN/R0aErdx/P84cuMQCjS+C9WYKCfM3iwdNMFcF7HfClFpkvYpvKyfcBoWEZTP1yEdASDwFfnZLhWv5wLogtK6beCdUJrVDY2j8Cdb86tgWu6D2R33u+Xi8G98l8sMiEU4Y1AcZU/FxqAOvACFSwOr4lClt7h+FDaU4nv6d+S+CAommUSwkgtqgIcrdaWYUuG37h7vOFCIAs3+inYRjxVYrE7X7G0/MGgGzJ+Ji+MtXfwvMGwNw8AAHoy7pHu5Coqjo3bNDfKX8OvXHKZqlCVqN0wJvlA98xAQImYNfMBthd+kDnrpkBcieVBRgVVsCQOEPrzinQjqPQfiETAzKACnCLioragbrSwFAppSYGmpkF7J5bQoId4XMA6lRclYDTIrUAAAAASUVORK5CYII=" alt="TOTALPASS" style={{ width: '16px', height: '16px' }} />
                    TOTALPASS
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 pt-4 mt-4 flex items-center justify-end gap-3">
          {modalEditing ? (
            <>
              <button 
                onClick={() => { setModalEditObservacoes(String(horario.observacoes || '')); setModalEditName(horario.alunoId?.nome || horario.aluno?.nome || ''); setModalEditing(false); }} 
                className="px-4 h-10 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <i className="fas fa-times text-gray-600" />
                <span>Cancelar</span>
              </button>
              <button 
                onClick={async () => {
                  try {
                    const originalName = horario.alunoId?.nome || horario.aluno?.nome || '';
                    if (modalEditName !== originalName) {
                      await editAlunoName(horario);
                    }
                    await updateAlunoObservacoes(modalEditObservacoes);
                    setModalEditing(false);
                  } catch (e) { console.error(e); alert('Erro ao salvar edições'); }
                }} 
                className="px-4 h-10 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors text-sm font-medium flex items-center gap-2"
              >
                <i className="fas fa-save" />
                <span>Salvar</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => { onClose(); }}
                className="px-4 h-10 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <i className="fas fa-times text-gray-600" />
                <span>Cancelar</span>
              </button>

              <button 
                onClick={() => { setModalEditing(true); }} 
                className="px-4 h-10 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors text-sm font-medium flex items-center gap-2"
              >
                <i className="fas fa-edit" />
                <span>Editar</span>
              </button>
              <button 
                onClick={() => { if (confirm('Tem certeza que deseja remover este aluno da turma?')) { deleteHorario(horario._id); } }} 
                className="px-4 h-10 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium flex items-center gap-2"
              >
                <i className="fas fa-trash" />
                <span>Remover</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Conflict Modal: substitutes found when attempting to unfreeze original */}
      {showConflictModal && conflictSubstitutes && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center" style={{ zIndex: 10000 }}>
          <div className="relative mx-auto w-full max-w-lg bg-white rounded-md shadow-xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Conflito ao Descongelar Aluno</h3>
              <button onClick={() => { setShowConflictModal(false); setConflictSubstitutes(null); }} className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Fechar">
                <i className="fas fa-times text-lg" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
                <p className="text-sm text-amber-900 font-medium mb-1">Existem substitutos ativos para este aluno.</p>
                <p className="text-xs text-amber-800">Para evitar ultrapassar o limite da turma, escolha como deseja proceder:</p>
              </div>

              <div className="space-y-3 max-h-60 overflow-y-auto">
                {conflictSubstitutes.map((sub:any) => (
                  <div key={sub._id} className="p-3 border border-gray-200 rounded-md flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">{(sub.alunoId && (sub.alunoId.nome || sub.alunoId)) || sub.alunoNome || 'Substituto'}</div>
                      <div className="text-xs text-gray-500">Horário: {sub.horarioFixoId || sub.horario || '—'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleReclaim(sub)} disabled={conflictLoading} className="px-3 py-1 bg-primary-600 text-white rounded-md text-sm hover:bg-primary-700 disabled:opacity-50">Reaver vaga</button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2">
                <p className="text-xs text-gray-600">Ou:</p>
                <div className="mt-2 flex gap-2">
                  <button onClick={handleForceUnfreeze} disabled={conflictLoading} className="px-3 py-2 bg-yellow-600 text-white rounded-md text-sm hover:bg-yellow-700 disabled:opacity-50">Forçar descongelar</button>
                  <button onClick={() => { setShowConflictModal(false); setConflictSubstitutes(null); }} disabled={conflictLoading} className="px-3 py-2 border border-gray-300 rounded-md text-sm">Cancelar</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Merge Modal */}
      {showMergeModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center" style={{ zIndex: 10000 }}>
          <div className="relative mx-auto w-full max-w-md bg-white rounded-md shadow-xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            {/* Header */}
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Mesclar Aluno</h3>
              <button onClick={() => { setShowMergeModal(false); setSelectedAlunoToMerge(null); setMergeSearchText(''); }} className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Fechar">
                <i className="fas fa-times text-lg" />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-4 space-y-4">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-md">
                <p className="text-sm text-amber-900 font-medium mb-2">
                  <i className="fas fa-exclamation-triangle mr-2"></i>
                  Atenção: Mesclagem Irreversível
                </p>
                <p className="text-xs text-amber-800">
                  Todos os horários de <strong>{horario.alunoId?.nome || horario.aluno?.nome || 'este aluno'}</strong> serão transferidos para o aluno selecionado. <strong>Este aluno será removido do sistema.</strong>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Pesquisar Aluno</label>
                <input
                  type="text"
                  placeholder="Digite o nome do aluno..."
                  value={mergeSearchText}
                  onChange={(e) => setMergeSearchText(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>

              {loadingAlunos ? (
                <div className="text-center py-8">
                  <i className="fas fa-spinner fa-spin text-2xl text-blue-600" />
                  <p className="text-sm text-gray-500 mt-2">Carregando alunos...</p>
                </div>
              ) : alunos.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">Nenhum outro aluno disponível</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {alunos.filter((aluno: any) => 
                    !mergeSearchText || aluno.nome.toLowerCase().includes(mergeSearchText.toLowerCase())
                  ).map((aluno: any) => (
                    <label key={aluno._id} className="flex items-center p-3 border border-gray-200 rounded-md hover:bg-blue-50 cursor-pointer transition-colors">
                      <input 
                        type="radio" 
                        name="merge-aluno" 
                        value={aluno._id} 
                        checked={selectedAlunoToMerge === aluno._id}
                        onChange={(e) => setSelectedAlunoToMerge(e.target.value)}
                        className="w-4 h-4 text-blue-600 cursor-pointer"
                      />
                      <span className="ml-3 text-sm text-gray-900 font-medium">{aluno.nome}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
              <button 
                onClick={() => { setShowMergeModal(false); setSelectedAlunoToMerge(null); setMergeSearchText(''); }} 
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors text-sm font-medium"
              >
                Cancelar
              </button>
              <button 
                onClick={mergeStudent}
                disabled={!selectedAlunoToMerge || loadingAlunos}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                Mesclar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDetailModal;
