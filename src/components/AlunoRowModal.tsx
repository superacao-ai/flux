"use client";

import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import ReagendarAulaModal from '@/components/ReagendarAulaModal';

interface Modalidade {
  _id: string;
  nome: string;
  cor?: string;
}

interface AlunoHorario {
  diaSemana: number;
  horarioInicio: string;
  horarioFim: string;
  professorNome?: string;
  modalidadeNome?: string;
  horarioId?: string;
  matriculaId?: string;
}

interface Aluno {
  _id: string;
  nome: string;
  email?: string;
  telefone?: string;
  endereco?: string;
  cpf?: string;
  dataNascimento?: string;
  modalidadeId?: Modalidade;
  plano?: string;
  observacoes?: string;
  ativo?: boolean;
  modalidades?: { _id: string; nome: string; cor?: string }[];
  horarios?: AlunoHorario[];
  congelado?: boolean;
  ausente?: boolean;
  periodoTreino?: string | null;
  parceria?: string | null;
  caracteristicas?: string[];
  frequencia?: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  alunoId: string;
  onRefresh?: () => void;
}

const AlunoRowModal: React.FC<Props> = ({ isOpen, onClose, alunoId, onRefresh }) => {
  const [aluno, setAluno] = useState<Aluno | null>(null);
  const [loading, setLoading] = useState(false);
  const [modalidades, setModalidades] = useState<Modalidade[]>([]);
  
  // Estado para modal de edição
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState({ nome: '', email: '', telefone: '', endereco: '', observacoes: '', cpf: '', dataNascimento: '' });
  const [editFlags, setEditFlags] = useState<{ congelado: boolean; ausente: boolean; periodoTreino: string | null; parceria: string | null; ativo: boolean }>({ congelado: false, ausente: false, periodoTreino: null, parceria: null, ativo: true });
  const [editCaracteristicas, setEditCaracteristicas] = useState<string[]>([]);
  
  // Estado para reagendamento
  const [showReagendarModal, setShowReagendarModal] = useState(false);
  const [reagendarData, setReagendarData] = useState<any>(null);

  const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  // Buscar dados do aluno
  const fetchAluno = async () => {
    if (!alunoId) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      
      // Buscar aluno
      const res = await fetch(`/api/alunos/${alunoId}`, { headers });
      const data = await res.json();
      
      // Buscar modalidades
      const modRes = await fetch('/api/modalidades', { headers });
      const modData = await modRes.json();
      if (modData.success) {
        setModalidades(modData.data || []);
      }
      
      // Buscar horários para obter as modalidades e horários do aluno
      const horRes = await fetch('/api/horarios', { headers });
      const horData = await horRes.json();
      const horarios = (horData && horData.success) ? (horData.data as any[]) : [];
      
      if (data.success && data.data) {
        const alunoData = data.data;
        
        // Mapear horários do aluno
        const alunoHorarios: AlunoHorario[] = [];
        const modalidadesSet = new Map<string, { _id: string; nome: string; cor?: string }>();
        
        // Adicionar modalidade principal do aluno se existir
        if (alunoData.modalidadeId && alunoData.modalidadeId._id) {
          modalidadesSet.set(String(alunoData.modalidadeId._id), {
            _id: String(alunoData.modalidadeId._id),
            nome: alunoData.modalidadeId.nome || 'N/A',
            cor: alunoData.modalidadeId.cor || '#3B82F6'
          });
        }
        
        // Buscar horários onde este aluno está matriculado
        horarios.forEach((h: any) => {
          try {
            const ms = h.matriculas;
            if (Array.isArray(ms) && ms.length > 0) {
              for (const m of ms) {
                const alunoRef = m.alunoId || null;
                const alunoIdMatricula = alunoRef && (typeof alunoRef === 'string' ? alunoRef : (alunoRef._id || alunoRef)) || null;
                
                if (String(alunoIdMatricula) === String(alunoId)) {
                  const mod = h.modalidadeId || null;
                  let professorNome = h.professorId?.nome || '';
                  // Verificar se é ObjectId de professor apagado
                  if (!professorNome && h.professorId && typeof h.professorId === 'string' && /^[0-9a-f]{24}$/i.test(h.professorId)) {
                    professorNome = 'Sem professor';
                  }
                  const modalidadeNome = mod?.nome || '';
                  
                  alunoHorarios.push({
                    diaSemana: h.diaSemana,
                    horarioInicio: h.horarioInicio,
                    horarioFim: h.horarioFim,
                    professorNome: professorNome,
                    modalidadeNome: modalidadeNome,
                    horarioId: h._id,
                    matriculaId: m._id || m.id
                  });
                  
                  if (modalidadeNome) {
                    const modId = mod?._id || modalidadeNome;
                    modalidadesSet.set(String(modId), {
                      _id: String(modId),
                      nome: modalidadeNome,
                      cor: mod?.cor || '#3B82F6'
                    });
                  }
                }
              }
            } else {
              // Legacy: horario com alunoId direto
              const alunoRef = h.alunoId;
              if (alunoRef && String(alunoRef._id || alunoRef) === String(alunoId)) {
                const mod = h.modalidadeId || alunoRef.modalidadeId || null;
                let professorNome = h.professorId?.nome || '';
                // Verificar se é ObjectId de professor apagado
                if (!professorNome && h.professorId && typeof h.professorId === 'string' && /^[0-9a-f]{24}$/i.test(h.professorId)) {
                  professorNome = 'Sem professor';
                }
                const modalidadeNome = mod?.nome || '';
                
                alunoHorarios.push({
                  diaSemana: h.diaSemana,
                  horarioInicio: h.horarioInicio,
                  horarioFim: h.horarioFim,
                  professorNome: professorNome,
                  modalidadeNome: modalidadeNome,
                  horarioId: h._id
                });
                
                if (modalidadeNome) {
                  const modId = mod?._id || modalidadeNome;
                  modalidadesSet.set(String(modId), {
                    _id: String(modId),
                    nome: modalidadeNome,
                    cor: mod?.cor || '#3B82F6'
                  });
                }
              }
            }
          } catch (e) {
            console.warn('Erro ao processar horario:', e);
          }
        });
        
        // Enriquecer aluno com modalidades e horários
        alunoData.modalidades = Array.from(modalidadesSet.values());
        alunoData.horarios = alunoHorarios;
        
        setAluno(alunoData);
      }
    } catch (err) {
      console.error('Erro ao buscar aluno:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && alunoId) {
      fetchAluno();
    }
  }, [isOpen, alunoId]);

  // Handle ESC key
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

  const getModalidadeColor = (m: any) => {
    if (!m) return '#3B82F6';
    const found = modalidades.find(md => md._id === m._id || md.nome === m.nome);
    return found?.cor || m.cor || '#3B82F6';
  };

  // Função para abrir modal de edição
  const abrirEdicao = () => {
    if (!aluno) return;
    // Formatar data de nascimento para input date (YYYY-MM-DD)
    let dataNascimentoFormatted = '';
    if (aluno.dataNascimento) {
      try {
        const d = new Date(aluno.dataNascimento);
        dataNascimentoFormatted = d.toISOString().split('T')[0];
      } catch { /* ignore */ }
    }
    // Formatar CPF com máscara (XXX.XXX.XXX-XX)
    let cpfFormatted = '';
    if (aluno.cpf) {
      const cpfLimpo = String(aluno.cpf).replace(/\D/g, '');
      if (cpfLimpo.length === 11) {
        cpfFormatted = `${cpfLimpo.slice(0,3)}.${cpfLimpo.slice(3,6)}.${cpfLimpo.slice(6,9)}-${cpfLimpo.slice(9)}`;
      } else {
        cpfFormatted = aluno.cpf;
      }
    }
    setEditFormData({
      nome: aluno.nome,
      email: aluno.email || '',
      telefone: aluno.telefone || '',
      endereco: aluno.endereco || '',
      observacoes: aluno.observacoes || '',
      cpf: cpfFormatted,
      dataNascimento: dataNascimentoFormatted
    });
    setEditFlags({
      congelado: aluno.congelado === true,
      ausente: aluno.ausente === true,
      periodoTreino: aluno.periodoTreino || null,
      parceria: aluno.parceria || null,
      ativo: aluno.ativo !== undefined ? aluno.ativo : true,
    });
    setEditCaracteristicas(Array.isArray(aluno.caracteristicas) ? aluno.caracteristicas.slice() : []);
    setShowEditModal(true);
  };

  // Função para salvar edição
  const salvarEdicao = async () => {
    if (!aluno) return;
    try {
      if (!editFormData.nome || String(editFormData.nome).trim() === '') {
        toast.warning('Nome é obrigatório');
        return;
      }

      // Limpar CPF (apenas números)
      const cpfLimpo = editFormData.cpf ? editFormData.cpf.replace(/\D/g, '') : '';
      if (cpfLimpo && cpfLimpo.length !== 11) {
        toast.warning('CPF deve ter 11 dígitos');
        return;
      }

      const payload: any = {
        nome: editFormData.nome,
        email: editFormData.email?.trim() || undefined,
        telefone: editFormData.telefone?.trim() || undefined,
        endereco: editFormData.endereco?.trim() || undefined,
        observacoes: editFormData.observacoes?.trim() ?? '',
        cpf: cpfLimpo || undefined,
        dataNascimento: editFormData.dataNascimento || undefined,
        congelado: !!editFlags.congelado,
        ausente: !!editFlags.ausente,
        periodoTreino: editFlags.periodoTreino,
        parceria: editFlags.parceria,
        ativo: !!editFlags.ativo,
        caracteristicas: editCaracteristicas.length > 0 ? editCaracteristicas : undefined,
      };

      // Remove empty fields, but keep observacoes even if empty (to allow clearing)
      Object.keys(payload).forEach(key => {
        if (key === 'observacoes') {
          // Keep observacoes even if empty string
          if (payload[key] === undefined) delete payload[key];
        } else if (payload[key] === undefined || payload[key] === '') {
          delete payload[key];
        }
      });

      const response = await fetch(`/api/alunos/${aluno._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (data && data.success) {
        setShowEditModal(false);
        await fetchAluno();
        if (onRefresh) onRefresh();
        toast.success('Aluno salvo com sucesso!');
      } else {
        toast.error(`Erro: ${data.error || 'Erro ao salvar'}`);
      }
    } catch (error) {
      console.error('Erro ao salvar aluno:', error);
      toast.error('Erro ao salvar aluno');
    }
  };

  if (!isOpen) return null;

  const isMuted = !!(aluno?.congelado || aluno?.ausente);

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="relative mx-auto w-full max-w-4xl bg-white rounded-2xl shadow-lg border max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-2">
            <i className="fas fa-user text-lg text-primary-600" aria-hidden="true" />
            <h3 className="text-base font-semibold text-gray-900">Detalhes do Aluno</h3>
          </div>
          <button onClick={onClose} aria-label="Fechar" title="Fechar" className="w-9 h-9 rounded-full bg-white text-gray-600 flex items-center justify-center hover:bg-gray-100">
            <i className="fas fa-times" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1">
          {loading ? (
            <div className="space-y-4 animate-pulse">
              {/* Skeleton for header info */}
              <div className="flex items-start justify-between p-4 rounded-lg border border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="h-6 w-12 bg-gray-200 rounded"></div>
                  <div className="h-6 w-48 bg-gray-200 rounded"></div>
                </div>
                <div className="h-8 w-8 bg-gray-200 rounded"></div>
              </div>
              {/* Skeleton for table rows */}
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-gray-100 rounded-lg"></div>
                ))}
              </div>
            </div>
          ) : aluno ? (
            <>
            {/* Versão Mobile - Card */}
            <div className="block lg:hidden space-y-4">
              {/* Info principal */}
              <div className={`p-4 rounded-lg border ${isMuted ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-200'}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {typeof aluno.frequencia !== 'undefined' && (
                      <span className="inline-flex items-center justify-center px-2 py-0.5 text-[11px] font-semibold rounded-md bg-gray-100 text-gray-800">
                        {aluno.frequencia}%
                      </span>
                    )}
                    <div className={`font-medium text-lg ${isMuted ? 'text-gray-500' : 'text-gray-900'}`}>{aluno.nome}</div>
                  </div>
                  <button onClick={abrirEdicao} className="p-2 rounded-md bg-white border border-gray-100 hover:bg-gray-50 text-primary-600" title="Editar aluno">
                    <i className="fas fa-edit" aria-hidden="true" />
                  </button>
                </div>

                {aluno.observacoes && (
                  <div className={`mb-3 px-3 py-2 rounded-lg text-sm ${isMuted ? 'bg-gray-100 text-gray-500' : 'bg-yellow-50 text-yellow-800 border border-yellow-200'}`}>
                    <i className="fas fa-sticky-note mr-2" />
                    {aluno.observacoes}
                  </div>
                )}

                {aluno.telefone && (
                  <div className="text-sm text-gray-600 mb-3">
                    <i className="fas fa-phone mr-2 text-gray-400" />
                    {aluno.telefone}
                  </div>
                )}

                {/* CPF e Data de Nascimento */}
                {(aluno.cpf || aluno.dataNascimento) && (
                  <div className="flex flex-wrap gap-3 mb-3">
                    {aluno.cpf && (
                      <div className="text-sm text-gray-600">
                        <i className="fas fa-id-card mr-2 text-gray-400" />
                        {aluno.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}
                      </div>
                    )}
                    {aluno.dataNascimento && (
                      <div className="text-sm text-gray-600">
                        <i className="fas fa-birthday-cake mr-2 text-gray-400" />
                        {new Date(aluno.dataNascimento).toLocaleDateString('pt-BR')}
                      </div>
                    )}
                  </div>
                )}

                {/* Modalidades e Horários */}
                <div className="border-t border-gray-100 pt-3">
                  <div className="text-xs font-medium text-gray-500 uppercase mb-2">Modalidades / Horários</div>
                  {(aluno.modalidades && aluno.modalidades.length > 0) ? (
                    aluno.modalidades.map(m => {
                      const hs = (aluno.horarios || []).filter(h => String(h.modalidadeNome || '').toLowerCase() === String(m.nome || '').toLowerCase());
                      return (
                        <div key={(m._id || m.nome)} className="mb-2">
                          <div className={`inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs font-medium ${isMuted ? 'bg-gray-100 text-gray-500' : 'bg-gray-100 text-gray-700'}`}>
                            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: isMuted ? '#D1D5DB' : getModalidadeColor(m) }} />
                            {m.nome}
                          </div>
                          {hs && hs.length > 0 && (
                            <div className="ml-4 mt-1 space-y-0.5">
                              {hs.map((h, i) => (
                                <div key={i} className="text-xs text-gray-500">
                                  {diasSemana[h.diaSemana]} {h.horarioInicio}–{h.horarioFim}
                                  {h.professorNome && <span className="text-gray-400"> — {h.professorNome}</span>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-xs text-gray-400">—</div>
                  )}
                </div>

                {/* Características */}
                <div className="border-t border-gray-100 pt-3 mt-3">
                  <div className="text-xs font-medium text-gray-500 uppercase mb-2">Características</div>
                  <div className="flex flex-wrap gap-1.5">
                    {aluno.congelado && (
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${isMuted ? 'bg-gray-100 text-gray-400' : 'bg-sky-50 text-sky-700'}`}>
                        <i className="fas fa-snowflake" /> Congelado
                      </span>
                    )}
                    {aluno.ausente && (
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${isMuted ? 'bg-gray-100 text-gray-400' : 'bg-rose-50 text-rose-700'}`}>
                        <i className="fas fa-user-clock" /> Parou de Vir
                      </span>
                    )}
                    {aluno.periodoTreino === '12/36' && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700">
                        <i className="fas fa-clock" /> 12/36
                      </span>
                    )}
                    {aluno.parceria === 'TOTALPASS' && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700">
                        TOTALPASS
                      </span>
                    )}
                    {(!aluno.congelado && !aluno.ausente && aluno.periodoTreino !== '12/36' && !aluno.parceria) && (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Versão Desktop - Tabela */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider text-center border-b">Aluno</th>
                    <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider text-center border-b">Modalidade / Horários</th>
                    <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider text-center border-b">Características</th>
                    <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider text-center border-b">Telefone</th>
                    <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider text-center border-b">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className={`${isMuted ? 'bg-gray-50 text-gray-500' : ''}`}>
                    {/* Coluna: Aluno */}
                    <td className="px-3 py-3 text-sm border-r border-b border-gray-200 text-center">
                      <div className="flex flex-col items-center">
                        <div className="flex items-center gap-2 justify-center w-full">
                          {typeof aluno.frequencia !== 'undefined' && (
                            <span className="inline-flex items-center justify-center px-2 py-0.5 text-[11px] font-semibold rounded-md bg-gray-100 text-gray-800">
                              {aluno.frequencia}%
                            </span>
                          )}
                          <div className={`truncate font-medium ${isMuted ? 'text-gray-500' : 'text-gray-900'}`} title={aluno.nome}>{aluno.nome}</div>
                        </div>

                        {aluno.observacoes && (
                          <span className={`inline-block mt-2 px-3 py-1.5 rounded-full text-xs font-semibold border max-w-[12rem] truncate ${isMuted ? 'bg-gray-50 text-gray-500 border-gray-200' : 'bg-yellow-100 text-yellow-800 border-yellow-200'}`} title={aluno.observacoes}>
                            <i className="fas fa-sticky-note mr-1" />
                            {aluno.observacoes}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Coluna: Modalidade / Horários */}
                    <td className="px-3 py-3 text-sm text-gray-500 border-r border-b border-gray-200 text-center align-middle">
                      <div className="flex flex-col items-center gap-3">
                        {(aluno.modalidades && aluno.modalidades.length > 0) ? (
                          aluno.modalidades.map(m => {
                            const hs = (aluno.horarios || []).filter(h => String(h.modalidadeNome || '').toLowerCase() === String(m.nome || '').toLowerCase());
                            return (
                              <div key={(m._id || m.nome)} className="w-full">
                                <div className={`inline-flex items-center gap-2 px-2 py-0.5 rounded-full text-xs font-medium ${isMuted ? 'bg-gray-50 border-gray-200 text-gray-500' : 'bg-gray-100 border border-gray-200 text-gray-700'}`}>
                                  <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: isMuted ? '#D1D5DB' : getModalidadeColor(m) }} />
                                  <span className="truncate max-w-[12rem] text-sm">{m.nome}</span>
                                </div>
                                {hs && hs.length > 0 ? (
                                  <div className="mt-1 text-[10px] text-gray-600 space-y-0.5">
                                    {hs.map((h, i) => (
                                      <div key={`${h.diaSemana}-${h.horarioInicio}-${h.horarioFim}-${i}`} className="text-[10px] text-gray-500">
                                        {diasSemana[h.diaSemana]} {h.horarioInicio}–{h.horarioFim}{h.professorNome ? (<span className="text-[10px] text-gray-400"> — {h.professorNome}</span>) : null}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="mt-1 text-xs text-gray-400">—</div>
                                )}
                              </div>
                            );
                          })
                        ) : (
                          <div>
                            {aluno.horarios && aluno.horarios.length > 0 ? (
                              <div className="mt-1 text-[10px] text-gray-600 space-y-0.5">
                                {aluno.horarios.map((h, i) => (
                                  <div key={i} className="text-[10px] text-gray-500">
                                    {diasSemana[h.diaSemana]} {h.horarioInicio}–{h.horarioFim}{h.professorNome ? (<span className="text-[10px] text-gray-400"> — {h.professorNome}</span>) : null}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="mt-1 text-xs text-gray-400">—</div>
                            )}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Coluna: Características */}
                    <td className="px-3 py-3 text-sm text-gray-500 border-r border-b border-gray-200 text-center">
                      <div className="flex items-center justify-center gap-2 flex-wrap">
                        {aluno.congelado && (
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${isMuted ? 'bg-gray-50 border-gray-200 text-gray-400' : 'bg-sky-50 border-sky-200 text-sky-700'}`}>
                            <i className="fas fa-snowflake" />
                            <span>Congelado</span>
                          </span>
                        )}

                        {aluno.ausente && (
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${isMuted ? 'bg-gray-50 border-gray-200 text-gray-400' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
                            <i className="fas fa-user-clock" />
                            <span>Parou de Vir</span>
                          </span>
                        )}

                        {aluno.periodoTreino === '12/36' && (
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${isMuted ? 'bg-gray-50 border-gray-200 text-gray-400' : 'bg-green-50 border-green-200 text-green-700'}`}>
                            <i className="fas fa-clock" />
                            <span>12/36</span>
                          </span>
                        )}

                        {aluno.parceria === 'TOTALPASS' && (
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${isMuted ? 'bg-gray-50 border-gray-200 text-gray-400' : 'bg-purple-50 border-purple-200 text-purple-700'}`}>
                            <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAC1UlEQVR4AbyWg5LlQBiFY3uSu7Zt27Zt27Zt27Zt60G2tC8w/3aWk/qvkkGqzuU53V+7qSwPQ6S5rttM07Sptm3PJZqXQ5pLypwci8UakjoUIpoo8HDE1EgQhC/kcyYR5IZoms6UJOmtaZo1/zT418OSypuwLPsDh3JHpK7vlmXV+NsTBmn5N2zMXZGeeEneZcpxnLYpA7k0HGS+1aZUVZ336wdZAGNNHzDX9wupvmCs6gVsASs0hKIooykyO5f6X4RaxcH7sCya3i4BRpdDAxiGMeUfgDqyWWQA+9Q4VHhoAHP74MgA2uyO2QfQF3cDi0D8077hcStzzk0M+nYMBnNtX1CHN/0lZWhjUAY1DEjuXgv4qkWA5piEAHitFs2IC8CVzR/0kcnnvU+vpzKuTgOhXqn0AKTO1VEB7qN5QLNM0Neharghe70Y+IoFUwPoS7qhsLllIPbN7xx6zpgb+qUAoClwLk1BQWVwIwTgnJ8UGiDj1ozkAIyrxx1XvnLhoM9WwXu3NDzAvdnJAcRWlVDIfbYAaJ4N+pqVj7ZvHB6VHECb1QGFrF1DAPmmtY0EoI5qlhyA7Gw4NLIpIN/R0aErdx/P84cuMQCjS+C9WYKCfM3iwdNMFcF7HfClFpkvYpvKyfcBoWEZTP1yEdASDwFfnZLhWv5wLogtK6beCdUJrVDY2j8Cdb86tgWu6D2R33u+Xi8G98l8sMiEU4Y1AcZU/FxqAOvACFSwOr4lClt7h+FDaU4nv6d+S+CAommUSwkgtqgIcrdaWYUuG37h7vOFCIAs3+inYRjxVYrE7X7G0/MGgGzJ+Ji+MtXfwvMGwNw8AAHoy7pHu5Coqjo3bNDfKX8OvXHKZqlCVqN0wJvlA98xAQImYNfMBthd+kDnrpkBcieVBRgVVsCQOEPrzinQjqPQfiETAzKACnCLioragbrSwFAppSYGmpkF7J5bQoId4XMA6lRclYDTIrUAAAAASUVORK5CYII=" alt="TOTALPASS" className={`w-3 h-3 ${isMuted ? 'opacity-50 filter grayscale' : ''}`} />
                            <span>TOTALPASS</span>
                          </span>
                        )}

                        {/* Custom características */}
                        {Array.isArray(aluno.caracteristicas) && aluno.caracteristicas.length > 0 && (
                          aluno.caracteristicas.map((c, i) => (
                            <span key={String(c) + i} className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${isMuted ? 'bg-gray-50 border-gray-200 text-gray-500' : 'bg-gray-50 border-gray-200 text-gray-700'}`}>
                              {c}
                            </span>
                          ))
                        )}

                        {(!aluno.congelado && !aluno.ausente && aluno.periodoTreino !== '12/36' && !aluno.parceria && (!Array.isArray(aluno.caracteristicas) || aluno.caracteristicas.length === 0)) && (
                          <div className="text-xs text-gray-400">—</div>
                        )}
                      </div>
                    </td>

                    {/* Coluna: Telefone */}
                    <td className="px-3 py-3 text-sm text-gray-500 border-r border-b border-gray-200 text-center">
                      {aluno.telefone || '—'}
                    </td>

                    {/* Coluna: Ações */}
                    <td className="px-3 py-3 text-sm border-b border-gray-200">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={abrirEdicao} className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-white border border-gray-100 hover:bg-gray-50 text-primary-600" title="Editar aluno">
                          <i className="fas fa-edit w-3" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Aluno não encontrado
            </div>
          )}
        </div>
      </div>

      {/* Modal de Edição */}
      {showEditModal && aluno && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-600 bg-opacity-50 p-4" style={{ zIndex: 10000 }}>
          <div className="relative w-full max-w-lg mx-auto bg-white rounded-2xl shadow-lg border border-gray-200 p-4 sm:p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* Header + Info */}
            <div className="mb-2 border-b pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <i className="fas fa-edit text-primary-600 text-lg" aria-hidden="true" />
                  <h3 className="text-base font-semibold text-gray-900">Editar Aluno</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="text-gray-400 hover:text-gray-600 focus:outline-none"
                  title="Fechar"
                >
                  <i className="fas fa-times text-lg" aria-hidden="true" />
                </button>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <i className="fas fa-info-circle text-primary-600 text-xs" aria-hidden="true" />
                <span className="text-xs text-gray-500">Edite os dados do aluno abaixo.</span>
              </div>
            </div>
            {/* Form */}
            <form
              className="space-y-3"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                salvarEdicao();
              }}
            >
              <div className="grid grid-cols-1 gap-3 sm:gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                  <input
                    type="text"
                    value={editFormData.nome}
                    onChange={(e) => setEditFormData({...editFormData, nome: e.target.value})}
                    className="block w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-medium focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Nome completo"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                  <input
                    type="tel"
                    value={editFormData.telefone}
                    onChange={(e) => {
                      const input = e.target.value;
                      // Se começar com letra, permitir texto livre (ex: "Não informado")
                      if (/^[a-zA-ZÀ-ÿ]/.test(input)) {
                        setEditFormData({...editFormData, telefone: input});
                        return;
                      }
                      // Aceitar apenas números e limitar a 11 dígitos
                      const value = input.replace(/\D/g, '').slice(0, 11);
                      // Formatar com máscara (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
                      let formatted = value;
                      if (value.length > 10) {
                        formatted = `(${value.slice(0,2)}) ${value.slice(2,7)}-${value.slice(7)}`;
                      } else if (value.length > 6) {
                        formatted = `(${value.slice(0,2)}) ${value.slice(2,6)}-${value.slice(6)}`;
                      } else if (value.length > 2) {
                        formatted = `(${value.slice(0,2)}) ${value.slice(2)}`;
                      } else if (value.length > 0) {
                        formatted = `(${value}`;
                      }
                      setEditFormData({...editFormData, telefone: formatted});
                    }}
                    className="block w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-medium focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    placeholder="(11) 99999-9999 ou Não informado"
                  />
                </div>
              </div>

              {/* Dados para Acesso ao Sistema */}
              <div className="relative border border-gray-200 rounded-md p-4 mt-3">
                <div className="absolute -top-3 left-4 bg-white px-2 text-sm font-medium text-gray-700">
                  <i className="fas fa-key mr-1 text-primary-600" /> Dados para Acesso
                </div>
                <p className="text-xs text-gray-500 mb-3">
                  Preencha estes campos para permitir que o aluno acesse o sistema e solicite reagendamentos.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      CPF <span className="text-gray-400 text-xs">(apenas números)</span>
                    </label>
                    <input
                      type="text"
                      value={editFormData.cpf}
                      onChange={(e) => {
                        // Aceitar apenas números e limitar a 11 dígitos
                        const value = e.target.value.replace(/\D/g, '').slice(0, 11);
                        // Formatar com máscara
                        let formatted = value;
                        if (value.length > 9) {
                          formatted = `${value.slice(0,3)}.${value.slice(3,6)}.${value.slice(6,9)}-${value.slice(9)}`;
                        } else if (value.length > 6) {
                          formatted = `${value.slice(0,3)}.${value.slice(3,6)}.${value.slice(6)}`;
                        } else if (value.length > 3) {
                          formatted = `${value.slice(0,3)}.${value.slice(3)}`;
                        }
                        setEditFormData({...editFormData, cpf: formatted});
                      }}
                      className="block w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-medium focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      placeholder="000.000.000-00"
                      maxLength={14}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data de Nascimento</label>
                    <input
                      type="date"
                      value={editFormData.dataNascimento}
                      onChange={(e) => setEditFormData({...editFormData, dataNascimento: e.target.value})}
                      className="block w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-medium focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>
              </div>

              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                <textarea
                  value={editFormData.observacoes}
                  onChange={(e) => setEditFormData({...editFormData, observacoes: e.target.value})}
                  className="block w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-medium h-10 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  rows={1}
                  placeholder="Observações sobre o aluno"
                />
              </div>
              {/* Status do plano */}
              <div className="relative border border-gray-200 rounded-md p-4 mb-3 mt-0">
                <div className="absolute -top-3 left-4 bg-white px-2 text-sm font-medium text-gray-700">Status do plano</div>
                <div className="mt-1 flex flex-wrap gap-2 pb-1 items-center">
                  <button type="button" onClick={() => setEditFlags({...editFlags, congelado: !editFlags.congelado})} className={`px-2 py-1 rounded-full border text-xs font-medium inline-flex items-center gap-1 ${editFlags.congelado ? 'bg-sky-50 border-sky-300 text-sky-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                    <i className="fas fa-snowflake text-xs" />
                    <span className="whitespace-nowrap">Congelado</span>
                  </button>

                  <button type="button" onClick={() => setEditFlags({...editFlags, ausente: !editFlags.ausente})} className={`px-2 py-1 rounded-full border text-xs font-medium inline-flex items-center gap-1 ${editFlags.ausente ? 'bg-rose-50 border-rose-300 text-rose-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                    <i className="fas fa-user-clock text-xs" />
                    <span className="whitespace-nowrap">Parou de Vir</span>
                  </button>

                  <button type="button" onClick={() => setEditFlags({...editFlags, periodoTreino: editFlags.periodoTreino === '12/36' ? null : '12/36'})} className={`px-2 py-1 rounded-full border text-xs font-medium inline-flex items-center gap-1 ${editFlags.periodoTreino === '12/36' ? 'bg-green-50 border-green-300 text-green-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                    <i className="fas fa-clock text-xs" />
                    <span className="whitespace-nowrap">12/36</span>
                  </button>

                  <button type="button" onClick={() => setEditFlags({...editFlags, parceria: editFlags.parceria === 'TOTALPASS' ? null : 'TOTALPASS'})} className={`px-2 py-1 rounded-full border text-xs font-medium inline-flex items-center gap-1 ${editFlags.parceria === 'TOTALPASS' ? 'bg-purple-50 border-purple-300 text-purple-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                    <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAC1UlEQVR4AbyWg5LlQBiFY3uSu7Zt27Zt27Zt27Zt60G2tC8w/3aWk/qvkkGqzuU53V+7qSwPQ6S5rttM07Sptm3PJZqXQ5pLypwci8UakjoUIpoo8HDE1EgQhC/kcyYR5IZoms6UJOmtaZo1/zT418OSypuwLPsDh3JHpK7vlmXV+NsTBmn5N2zMXZGeeEneZcpxnLYpA7k0HGS+1aZUVZ336wdZAGNNHzDX9wupvmCs6gVsASs0hKIooykyO5f6X4RaxcH7sCya3i4BRpdDAxiGMeUfgDqyWWQA+9Q4VHhoAHP74MgA2uyO2QfQF3cDi0D8077hcStzzk0M+nYMBnNtX1CHN/0lZWhjUAY1DEjuXgv4qkWA5piEAHitFs2IC8CVzR/0kcnnvU+vpzKuTgOhXqn0AKTO1VEB7qN5QLNM0Neharghe70Y+IoFUwPoS7qhsLllIPbN7xx6zpgb+qUAoClwLk1BQWVwIwTgnJ8UGiDj1ozkAIyrxx1XvnLhoM9WwXu3NDzAvdnJAcRWlVDIfbYAaJ4N+pqVj7ZvHB6VHECb1QGFrF1DAPmmtY0EoI5qlhyA7Gw4NLIpIN/R0aErdx/P84cuMQCjS+C9WYKCfM3iwdNMFcF7HfClFpkvYpvKyfcBoWEZTP1yEdASDwFfnZLhWv5wLogtK6beCdUJrVDY2j8Cdb86tgWu6D2R33u+Xi8G98l8sMiEU4Y1AcZU/FxqAOvACFSwOr4lClt7h+FDaU4nv6d+S+CAommUSwkgtqgIcrdaWYUuG37h7vOFCIAs3+inYRjxVYrE7X7G0/MGgGzJ+Ji+MtXfwvMGwNw8AAHoy7pHu5Coqjo3bNDfKX8OvXHKZqlCVqN0wJvlA98xAQImYNfMBthd+kDnrpkBcieVBRgVVsCQOEPrzinQjqPQfiETAzKACnCLioragbrSwFAppSYGmpkF7J5bQoId4XMA6lRclYDTIrUAAAAASUVORK5CYII=" alt="TOTALPASS" className="w-3 h-3" />
                    <span>TOTALPASS</span>
                  </button>
                </div>

                {Array.isArray(editCaracteristicas) && editCaracteristicas.length > 0 && (
                  <div className="w-full flex gap-2 flex-wrap mt-2">
                    {editCaracteristicas.map((c, i) => (
                      <span key={i} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100 border border-gray-200 text-xs">
                        <span className="truncate max-w-[10rem]">{c}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {/* Action Buttons */}
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-3 border-t mt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="w-full sm:w-auto px-4 py-2.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 flex items-center justify-center gap-2"
                >
                  <i className="fas fa-times text-black" aria-hidden="true" /> Cancelar
                </button>
                <button
                  type="submit"
                  className="w-full sm:w-auto px-4 py-2.5 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 flex items-center justify-center gap-2"
                >
                  <i className="fas fa-save text-white" aria-hidden="true" /> Atualizar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Reagendamento */}
      {showReagendarModal && reagendarData && (
        <ReagendarAulaModal
          isOpen={showReagendarModal}
          onClose={() => { setShowReagendarModal(false); setReagendarData(null); }}
          alunoId={reagendarData.alunoId}
          alunoNome={reagendarData.alunoNome}
          horarioOriginal={reagendarData.horarioOriginal}
          dataOriginal={reagendarData.dataOriginal}
          matriculaId={reagendarData.matriculaId}
          modalidadeId={reagendarData.modalidadeId}
          onSuccess={() => {
            setShowReagendarModal(false);
            setReagendarData(null);
            if (onRefresh) onRefresh();
          }}
        />
      )}
    </div>
  );
};

export default AlunoRowModal;
