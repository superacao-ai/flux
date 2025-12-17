"use client";

import React, { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { toast } from 'react-toastify';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  horario: any;
  modalidades: any[];
  horarios: any[];
  onRefresh?: () => void;
}

interface CreditoReposicao {
  _id: string;
  quantidade: number;
  quantidadeUsada: number;
  modalidadeId?: { _id: string; nome: string };
  motivo: string;
  validade: string;
  concedidoPor: { _id: string; name: string };
  ativo: boolean;
  criadoEm: string;
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
  
  // Estados para créditos
  const [creditos, setCreditos] = useState<CreditoReposicao[]>([]);
  const [loadingCreditos, setLoadingCreditos] = useState(false);
  const [showCreditoModal, setShowCreditoModal] = useState(false);
  const [salvandoCredito, setSalvandoCredito] = useState(false);
  const [quantidadeCredito, setQuantidadeCredito] = useState('1');
  const [modalidadeCreditoId, setModalidadeCreditoId] = useState('');
  const [motivoCredito, setMotivoCredito] = useState('');
  const [validadeCredito, setValidadeCredito] = useState('');

  const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

  // Buscar créditos do aluno
  const fetchCreditos = async () => {
    const aluno = horario.alunoId || horario.aluno;
    if (!aluno || !aluno._id) return;
    
    try {
      setLoadingCreditos(true);
      const res = await fetch(`/api/creditos-reposicao?alunoId=${aluno._id}&disponiveis=true`);
      if (res.ok) {
        const data = await res.json();
        setCreditos(data);
      }
    } catch (error) {
      console.error('Erro ao buscar créditos:', error);
    } finally {
      setLoadingCreditos(false);
    }
  };

  // Abrir modal para conceder crédito
  const abrirConcederCredito = () => {
    setQuantidadeCredito('1');
    setModalidadeCreditoId('');
    setMotivoCredito('');
    
    // Data padrão: 3 meses a partir de hoje
    const dataFutura = new Date();
    dataFutura.setMonth(dataFutura.getMonth() + 3);
    setValidadeCredito(dataFutura.toISOString().split('T')[0]);
    
    setShowCreditoModal(true);
  };

  // Salvar novo crédito
  const handleSalvarCredito = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const aluno = horario.alunoId || horario.aluno;
    if (!aluno || !aluno._id) {
      toast.error('Aluno não encontrado');
      return;
    }

    if (!quantidadeCredito || !motivoCredito || !validadeCredito) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setSalvandoCredito(true);

    try {
      const body = {
        alunoId: aluno._id,
        quantidade: parseInt(quantidadeCredito),
        modalidadeId: modalidadeCreditoId || null,
        motivo: motivoCredito,
        validade: validadeCredito
      };

      const res = await fetch('/api/creditos-reposicao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        toast.success('Crédito concedido com sucesso!');
        setShowCreditoModal(false);
        fetchCreditos();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Erro ao conceder crédito');
      }
    } catch (error) {
      console.error('Erro ao conceder crédito:', error);
      toast.error('Erro ao conceder crédito');
    } finally {
      setSalvandoCredito(false);
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
    return data.toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
  };

  const isExpirado = (validadeStr: string) => {
    return parseDataLocal(validadeStr) <= new Date();
  };

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
      
      // Buscar créditos do aluno
      fetchCreditos();
    } else {
      // Reset states se não há aluno
      setAlunoCongelado(false);
      setAlunoAusente(false);
      setAlunoEmEspera(false);
      setCreditos([]);
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
      if (!aluno || !aluno._id) { toast.warning('Aluno não encontrado'); return; }
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
      toast.error('Erro ao atualizar informação do aluno: ' + (err?.message || 'erro'));
    }
  };

  // Toggle / persist aluno.ausente (mutuamente exclusivo com congelado e emEspera)
  const toggleAlunoAusente = async () => {
    try {
      const aluno = horario.alunoId || horario.aluno;
      if (!aluno || !aluno._id) { toast.warning('Aluno não encontrado'); return; }
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
      toast.error('Erro ao atualizar informação do aluno: ' + (err?.message || 'erro'));
    }
  };

  // Toggle / persist aluno.emEspera (mutuamente exclusivo com congelado e ausente)
  const toggleAlunoEmEspera = async () => {
    try {
      const aluno = horario.alunoId || horario.aluno;
      if (!aluno || !aluno._id) { toast.warning('Aluno não encontrado'); return; }
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
      toast.error('Erro ao atualizar informação do aluno: ' + (err?.message || 'erro'));
    }
  };

  // Handle force-unfreeze (admin override)
  const handleForceUnfreeze = async () => {
    try {
      const aluno = horario.alunoId || horario.aluno;
      if (!aluno || !aluno._id) { toast.warning('Aluno não encontrado'); return; }
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
      toast.error('Erro ao forçar descongelar: ' + (err?.message || 'erro'));
    } finally {
      setConflictLoading(false);
    }
  };

  // Handle reclaiming a vacancy by removing the substitute matricula and unfreezing original (server does both)
  const handleReclaim = async (sub: any) => {
    try {
      if (!sub || !sub._id || !sub.replacesMatriculaId) { toast.warning('Dados inválidos da substituição'); return; }
      const confirmResult = await Swal.fire({ title: 'Reaver vaga?', text: 'Isso removerá o substituto e reativará o aluno original.', icon: 'warning', showCancelButton: true, confirmButtonColor: '#3085d6', cancelButtonColor: '#d33', confirmButtonText: 'Sim, reaver', cancelButtonText: 'Cancelar' });
      if (!confirmResult.isConfirmed) return;
      setConflictLoading(true);
      const resp = await fetch('/api/matriculas/reclaim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originalMatriculaId: sub.replacesMatriculaId, substituteMatriculaId: sub._id })
      });
      const data = await resp.json();
      if (!resp.ok || !data || !data.success) throw new Error(data?.error || 'Erro ao reaver vaga');
      toast.success('Vaga reavida com sucesso. Aluno original reativado.');
      setShowConflictModal(false);
      setConflictSubstitutes(null);
      await fetchAndRefresh();
    } catch (err: any) {
      console.error('Erro ao reaver vaga:', err);
      toast.error('Erro ao reaver vaga: ' + (err?.message || 'erro'));
    } finally {
      setConflictLoading(false);
    }
  };

  const updateAlunoObservacoes = async (newObservacoes?: string) => {
    if (typeof newObservacoes === 'undefined') return;
    try {
      const aluno = horario.alunoId || horario.aluno;
      if (!aluno || !aluno._id) { toast.warning('Aluno não encontrado'); return; }
      
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
        toast.error('Erro ao atualizar observações: ' + (data.error || 'erro'));
      }
    } catch (err) {
      console.error('Erro ao atualizar observações:', err);
      toast.error('Erro ao atualizar observações');
    }
  };

  const deleteHorario = async (id: string) => {
    const confirmResult = await Swal.fire({ title: 'Excluir horário?', text: 'Tem certeza que deseja excluir este horário?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#6b7280', confirmButtonText: 'Sim, excluir', cancelButtonText: 'Cancelar' });
    if (!confirmResult.isConfirmed) return;
    try {
      const response = await fetch(`/api/horarios/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Horário excluído com sucesso');
        await fetchAndRefresh();
        onClose();
      } else {
        toast.error('Erro ao excluir horário');
      }
    } catch (error) {
      console.error('Erro ao excluir horário:', error);
      toast.error('Erro ao excluir horário');
    }
  };

  const editAlunoName = async (horarioObj: any) => {
    try {
      const aluno = horarioObj?.alunoId;
      if (!aluno || !aluno._id) { toast.warning('Aluno não encontrado para este horário'); return; }
      const current = String(aluno.nome || '');
      const novo = modalEditName;
      if (!novo || novo.trim() === '') { toast.warning('Nome não pode ficar vazio'); return; }
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
        toast.error('Erro ao atualizar aluno: ' + (data && data.error ? data.error : 'erro'));
      }
    } catch (err) {
      console.error('Erro ao editar aluno:', err);
      toast.error('Erro ao editar aluno');
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
      toast.error('Erro ao carregar lista de alunos');
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
      toast.warning('Selecione um aluno para vincular');
      return;
    }

    const confirmResult = await Swal.fire({ title: 'Vincular aluno?', text: 'Tem certeza que deseja vincular todos os horários deste aluno ao selecionado? Esta ação não pode ser desfeita.', icon: 'warning', showCancelButton: true, confirmButtonColor: '#3085d6', cancelButtonColor: '#d33', confirmButtonText: 'Sim, vincular', cancelButtonText: 'Cancelar' });
    if (!confirmResult.isConfirmed) {
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
        toast.success(`Sucesso! ${data.data.updatedCount || 0} horário(s) vinculado(s).`);
        setShowMergeModal(false);
        setSelectedAlunoToMerge(null);
        await fetchAndRefresh();
        onClose();
      } else {
        toast.error('Erro ao vincular alunos: ' + (data.error || 'erro'));
      }
    } catch (err) {
      console.error('Erro ao vincular alunos:', err);
      toast.error('Erro ao vincular alunos');
    } finally {
      setLoadingAlunos(false);
    }
  };

  // Toggle / persist aluno.periodoTreino (e.g., '12/36')
  const toggleAlunoPeriodo = async () => {
    try {
      const aluno = horario.alunoId || horario.aluno;
      if (!aluno || !aluno._id) { toast.warning('Aluno não encontrado'); return; }
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
      toast.error('Erro ao atualizar informação do aluno: ' + (err?.message || 'erro'));
    }
  };

  // Toggle / persist aluno.parceria (e.g., 'TOTALPASS')
  const toggleAlunoParceria = async () => {
    try {
      const aluno = horario.alunoId || horario.aluno;
      if (!aluno || !aluno._id) { toast.warning('Aluno não encontrado'); return; }
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
      toast.error('Erro ao atualizar informação do aluno: ' + (err?.message || 'erro'));
    }
  };

  if (!isOpen || !horario) return null;

  const modalidadeId = horario.modalidadeId || horario.aluno?.modalidadeId || horario.modalidade || null;
  const modalidadeObj = modalidades.find(m => getMid(m) === String(modalidadeId));

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 z-50 flex items-center justify-center p-4" style={{ zIndex: 9999 }} onClick={() => onClose()}>
      <div className="relative mx-auto w-full max-w-2xl bg-white rounded-2xl shadow-lg border p-4 sm:p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="studentDetailTitle">
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
                    className="w-full h-10 px-3 text-sm border border-gray-300 rounded-md" 
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
                    className="w-full px-3 py-2 h-28 text-sm border border-gray-300 rounded-md" 
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

              {/* Créditos de Reposição */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700">Créditos de Reposição</label>
                  <button
                    onClick={abrirConcederCredito}
                    className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex items-center gap-1"
                    title="Conceder novo crédito"
                  >
                    <i className="fas fa-plus"></i>
                    <span>Conceder</span>
                  </button>
                </div>

                {loadingCreditos ? (
                  <div className="text-center py-4">
                    <i className="fas fa-spinner fa-spin text-green-600"></i>
                    <p className="text-xs text-gray-500 mt-1">Carregando créditos...</p>
                  </div>
                ) : creditos.length === 0 ? (
                  <div className="text-center py-4 bg-gray-50 rounded-md border border-gray-200">
                    <i className="fas fa-ticket text-2xl text-gray-400 mb-1"></i>
                    <p className="text-xs text-gray-500">Nenhum crédito disponível</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {creditos.map((credito) => {
                      const creditosDisponiveis = credito.quantidade - credito.quantidadeUsada;
                      const expirado = isExpirado(credito.validade);
                      
                      return (
                        <div
                          key={credito._id}
                          className={`p-3 border rounded-md ${
                            expirado 
                              ? 'bg-red-50 border-red-200' 
                              : creditosDisponiveis > 0 
                                ? 'bg-green-50 border-green-200' 
                                : 'bg-gray-50 border-gray-200'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <i className={`fas fa-ticket text-lg ${
                                expirado 
                                  ? 'text-red-600' 
                                  : creditosDisponiveis > 0 
                                    ? 'text-green-600' 
                                    : 'text-gray-600'
                              }`}></i>
                              <span className="font-semibold text-sm">
                                {creditosDisponiveis} de {credito.quantidade} créditos
                              </span>
                            </div>
                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                              expirado 
                                ? 'bg-red-100 text-red-800' 
                                : creditosDisponiveis > 0 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-gray-100 text-gray-800'
                            }`}>
                              {expirado ? 'EXPIRADO' : creditosDisponiveis === 0 ? 'ESGOTADO' : 'DISPONÍVEL'}
                            </span>
                          </div>
                          
                          <div className="space-y-1 text-xs">
                            {credito.modalidadeId && (
                              <div className="flex items-center gap-1">
                                <i className="fas fa-tag text-gray-500"></i>
                                <span className="text-gray-600">Modalidade:</span>
                                <span className="font-medium text-gray-900">{credito.modalidadeId.nome}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1">
                              <i className="fas fa-calendar text-gray-500"></i>
                              <span className="text-gray-600">Validade:</span>
                              <span className={`font-medium ${expirado ? 'text-red-600' : 'text-gray-900'}`}>
                                {formatarData(credito.validade)}
                              </span>
                            </div>
                            <div className="flex items-start gap-1 mt-1 pt-1 border-t border-gray-200">
                              <i className="fas fa-comment-dots text-gray-500 mt-0.5"></i>
                              <span className="text-gray-700">{credito.motivo}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Status Flags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Status do Aluno</label>
                <div className="grid grid-cols-2 sm:flex gap-2 sm:flex-wrap">
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
        <div className="border-t border-gray-200 pt-4 mt-4 flex flex-col sm:flex-row items-stretch sm:items-center sm:justify-end gap-2 sm:gap-3">
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
                  } catch (e) { console.error(e); toast.error('Erro ao salvar edições'); }
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
                onClick={() => { deleteHorario(horario._id); }} 
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
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 z-50 flex items-center justify-center p-4" style={{ zIndex: 10000 }}>
          <div className="relative mx-auto w-full max-w-lg bg-white rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
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

      {/* Modal de Concessão de Crédito */}
      {showCreditoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" style={{ zIndex: 10001 }}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <i className="fas fa-ticket text-green-600"></i>
                Conceder Crédito
              </h2>

              <form onSubmit={handleSalvarCredito} className="space-y-4">
                {/* Quantidade */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quantidade de créditos *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={quantidadeCredito}
                    onChange={(e) => setQuantidadeCredito(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>

                {/* Modalidade */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Modalidade (opcional)
                  </label>
                  <select
                    value={modalidadeCreditoId}
                    onChange={(e) => setModalidadeCreditoId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Qualquer modalidade</option>
                    {modalidades.filter(m => m.ativo).map(m => (
                      <option key={m._id || m.id} value={m._id || m.id}>{m.nome}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Deixe em branco para permitir uso em qualquer modalidade
                  </p>
                </div>

                {/* Motivo */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Motivo *
                  </label>
                  <textarea
                    value={motivoCredito}
                    onChange={(e) => setMotivoCredito(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Ex: Compensação por problema técnico"
                    required
                  />
                </div>

                {/* Validade */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Validade *
                  </label>
                  <input
                    type="date"
                    value={validadeCredito}
                    onChange={(e) => setValidadeCredito(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>

                {/* Botões */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreditoModal(false)}
                    disabled={salvandoCredito}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={salvandoCredito}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {salvandoCredito ? (
                      <>
                        <i className="fas fa-spinner fa-spin"></i>
                        Salvando...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-check"></i>
                        Conceder
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Merge Modal */}
      {showMergeModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 z-50 flex items-center justify-center p-4" style={{ zIndex: 10000 }}>
          <div className="relative mx-auto w-full max-w-md bg-white rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
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
