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
  const [localFlags, setLocalFlags] = useState<Record<string, { congelado?: boolean; ausente?: boolean; emEspera?: boolean }>>({});

  const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

  // getMid is already declared below; keep a single definition further down

  const getModalidadeColor = (m: any) => {
    if (!m) return '#3B82F6';
    const id = getMid(m) || (m && m.nome) || '';
    const found = modalidades.find(md => ((md as any)._id && String((md as any)._id) === String(id)) || (md.nome && md.nome === (m.nome || id)));
    return (found && ((found as any).cor || '#3B82F6')) || m.cor || '#3B82F6';
  };

  useEffect(() => {
    if (!horario) return;
    const name = horario.alunoId?.nome || horario.aluno?.nome || horario.nome || '';
    setModalEditName(name);
    setModalEditObservacoes(String(horario.observacoes || ''));
    setModalEditing(false);
    // initialize flags based on observacoes markers if present
    const obsRaw = String(horario.observacoes || '');
    // Prefer explicit boolean fields when present on the horario document
    const fromDocCongelado = horario.congelado === true;
    const fromDocAusente = horario.ausente === true;
    const fromDocEmEspera = horario.emEspera === true;
    setLocalFlags({ [horario._id]: { congelado: fromDocCongelado || obsRaw.includes('[CONGELADO]'), ausente: fromDocAusente || obsRaw.includes('[AUSENTE]'), emEspera: fromDocEmEspera || obsRaw.includes('[EM_ESPERA]') } });
  }, [horario]);

  const getMid = (m: any) => (m && ((m as any).id || (m as any)._id)) || '';

  const fetchAndRefresh = async () => {
    try { if (onRefresh) await onRefresh(); } catch (e) { console.error(e); }
  };

  const toggleCongelado = async (id: string) => {
    // compute new value from previous state to avoid stale reads
    let newCongelado = false;
    setLocalFlags(prev => {
      const cur = prev[id] || {};
      newCongelado = !cur.congelado;
      return { ...prev, [id]: { ...cur, congelado: newCongelado } };
    });
    try {
      const body: any = { congelado: newCongelado };
    // no-op: debug log removed
      const resp = await fetch(`/api/horarios/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await resp.json();
      if (!data || !data.success) throw new Error(data && data.error ? data.error : 'Erro');
      // If the server returned the updated document, use its flags to sync UI immediately
      const returned = data.data || {};
      const serverCongelado = returned.congelado === true;
      const serverAusente = returned.ausente === true;
      const serverEmEspera = returned.emEspera === true;
      setLocalFlags(prev => ({ ...prev, [id]: { congelado: serverCongelado, ausente: serverAusente, emEspera: serverEmEspera } }));
      await fetchAndRefresh();
    } catch (err) {
  console.error('Erro ao togglear congelado:', err);
  alert('Erro ao marcar congelado.');
      // revert local flag
      setLocalFlags(prev => { const cur = prev[id] || {}; return { ...prev, [id]: { ...cur, congelado: !cur.congelado } }; });
    }
  };

  const toggleAusente = async (id: string) => {
    // compute new value first to avoid stale reads
    let newAusente = false;
    setLocalFlags(prev => {
      const cur = prev[id] || {};
      newAusente = !cur.ausente;
      return { ...prev, [id]: { ...cur, ausente: newAusente } };
    });
    try {
      const body: any = { ausente: newAusente };
    // no-op: debug log removed
    const resp = await fetch(`/api/horarios/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await resp.json();
      if (!data || !data.success) throw new Error(data && data.error ? data.error : 'Erro');
      const returned = data.data || {};
      const serverCongelado = returned.congelado === true;
      const serverAusente = returned.ausente === true;
      const serverEmEspera = returned.emEspera === true;
      setLocalFlags(prev => ({ ...prev, [id]: { congelado: serverCongelado, ausente: serverAusente, emEspera: serverEmEspera } }));
      await fetchAndRefresh();
    } catch (err) {
  console.error('Erro ao togglear ausente:', err);
  alert('Erro ao marcar ausente.');
      // revert local flag
      setLocalFlags(prev => { const cur = prev[id] || {}; return { ...prev, [id]: { ...cur, ausente: !cur.ausente } }; });
    }
  };

  const toggleEmEspera = async (id: string) => {
    let newEm = false;
    setLocalFlags(prev => {
      const cur = prev[id] || {};
      newEm = !cur.emEspera;
      return { ...prev, [id]: { ...cur, emEspera: newEm } };
    });
    try {
      const body: any = { emEspera: newEm };
  // no-op: debug log removed
  const resp = await fetch(`/api/horarios/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await resp.json();
      if (!data || !data.success) throw new Error(data && data.error ? data.error : 'Erro');
      const returned = data.data || {};
      const serverCongelado = returned.congelado === true;
      const serverAusente = returned.ausente === true;
      const serverEmEspera = returned.emEspera === true;
      setLocalFlags(prev => ({ ...prev, [id]: { congelado: serverCongelado, ausente: serverAusente, emEspera: serverEmEspera } }));
      await fetchAndRefresh();
    } catch (err) {
      console.error('Erro ao togglear emEspera:', err);
      alert('Erro ao marcar em espera.');
      setLocalFlags(prev => { const cur = prev[id] || {}; return { ...prev, [id]: { ...cur, emEspera: !cur.emEspera } }; });
    }
  };

  const updateHorarioObservacoes = async (id: string, newObservacoes?: string) => {
    if (typeof newObservacoes === 'undefined') return;
    try {
      const resp = await fetch(`/api/horarios/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ observacoes: newObservacoes }) });
      const data = await resp.json();
      if (data && data.success) {
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
      const response = await fetch(`/api/horarios/${id}`, { method: 'DELETE' });
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
        await fetchAndRefresh();
        setModalEditing(false);
      } else {
        alert('Erro ao atualizar aluno: ' + (data && data.error ? data.error : 'erro'));
      }
    } catch (err) {
      console.error('Erro ao editar aluno:', err);
      alert('Erro ao editar aluno');
    }
  };

  if (!isOpen || !horario) return null;

  // derive student horarios
  const studentId = (horario.alunoId && (horario.alunoId as any)._id) || (horario.aluno && (horario.aluno as any)?._id) || null;
  const studentHorarios = studentId ? (horarios || []).filter((h: any) => {
    try { const aid = (h.alunoId && (h.alunoId as any)._id) || h.alunoId; return aid && String(aid) === String(studentId); } catch { return false; }
  }) : [];

  const modalidadeId = horario.modalidadeId || horario.aluno?.modalidadeId || horario.modalidade || null;
  const modalidadeObj = modalidades.find(m => getMid(m) === String(modalidadeId));

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" style={{ zIndex: 9999 }} onClick={() => onClose()}>
      <div className="relative top-24 mx-auto p-6 border w-96 max-w-full shadow-lg rounded-md bg-white" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-slate-800">Detalhes do aluno</h3>
            <button onClick={() => setModalEditing(prev => !prev)} title={modalEditing ? 'Cancelar edição' : 'Editar'} aria-label={modalEditing ? 'Cancelar edição' : 'Editar'} className={`p-1 rounded ${modalEditing ? 'text-primary-700 bg-primary-100' : 'text-gray-500 hover:bg-gray-100'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>
            </button>
          </div>
          <div className="ml-4">
            <button onClick={() => onClose()} className="text-slate-500 hover:text-slate-700" aria-label="Fechar"><i className="fas fa-times" /></button>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm text-gray-500">Nome</div>
              {!modalEditing ? (
                <div className="font-medium text-slate-800">{horario.alunoId?.nome || horario.aluno?.nome || horario.nome || <span className="text-gray-400 italic">Nome não informado</span>}</div>
              ) : (
                <input value={modalEditName} onChange={e => setModalEditName(e.target.value)} className="w-full border rounded px-2 py-1" />
              )}

              <div className="mt-2 flex items-center gap-2">
                <button onClick={() => toggleCongelado(horario._id)} aria-pressed={!!localFlags[horario._id]?.congelado} title={localFlags[horario._id]?.congelado ? 'Descongelar' : 'Congelar'} className={`px-3 py-1 border rounded text-sm flex items-center gap-2 ${localFlags[horario._id]?.congelado ? 'bg-sky-100 border-sky-300 text-sky-800' : 'bg-white hover:bg-gray-50'}`}>{localFlags[horario._id]?.congelado ? 'Descongelar' : 'Congelar'}</button>
                <button onClick={() => toggleAusente(horario._id)} aria-pressed={!!localFlags[horario._id]?.ausente} title={localFlags[horario._id]?.ausente ? 'Presente' : 'Ausente'} className={`px-3 py-1 border rounded text-sm flex items-center gap-2 ${localFlags[horario._id]?.ausente ? 'bg-rose-100 border-rose-300 text-rose-700' : 'bg-white hover:bg-gray-50'}`}>{localFlags[horario._id]?.ausente ? 'Presente' : 'Ausente'}</button>
                <button onClick={() => toggleEmEspera(horario._id)} aria-pressed={!!localFlags[horario._id]?.emEspera} title={localFlags[horario._id]?.emEspera ? 'Remover da espera' : 'Colocar em espera'} className={`px-3 py-1 border rounded text-sm flex items-center gap-2 ${localFlags[horario._id]?.emEspera ? 'bg-yellow-100 border-yellow-300 text-yellow-800' : 'bg-white hover:bg-gray-50'}`}>{localFlags[horario._id]?.emEspera ? 'Remover espera' : 'Em espera'}</button>
              </div>
              {/* server response debug removed from modal UI */}
            </div>
          </div>

          <div className="mt-3 text-sm text-gray-500">Observações</div>
          {!modalEditing ? (
            <div className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{horario.observacoes ? horario.observacoes : <span className="text-gray-400 italic">Sem observações</span>}</div>
          ) : (
            <div className="mt-1">
              <textarea value={modalEditObservacoes} onChange={e => setModalEditObservacoes(e.target.value)} className="w-full border rounded px-2 py-1 text-sm" rows={4} />
              <div className="mt-2 flex gap-2 justify-end">
                <button onClick={async () => {
                  try {
                    // First save observations
                    await updateHorarioObservacoes(horario._id, modalEditObservacoes);
                    // If the user also edited the name, save it too
                    if (modalEditing) {
                      await editAlunoName(horario);
                    }
                    setModalEditing(false);
                  } catch (e) { console.error(e); alert('Erro ao salvar observações'); }
                }} className="px-3 py-1 bg-primary-600 text-white rounded text-sm">Salvar</button>
                <button onClick={() => { setModalEditObservacoes(String(horario.observacoes || '')); setModalEditName(horario.alunoId?.nome || horario.aluno?.nome || ''); setModalEditing(false); }} className="px-3 py-1 border rounded text-sm">Cancelar</button>
              </div>
            </div>
          )}

          <div className="mt-4">
            <div className="mt-3 text-sm text-gray-500">Horários do aluno</div>
            <div className="mt-2 space-y-2">
              {studentHorarios.length === 0 ? (
                <div className="text-[12px] text-gray-500">Nenhum horário encontrado</div>
              ) : (
                studentHorarios.map((sh: any) => {
                  const mod = modalidades.find(m => getMid(m) === (sh.modalidadeId && ((sh.modalidadeId.id || sh.modalidadeId._id) || sh.modalidadeId)));
                  return (
                    <div key={String(sh._id)} className="p-2 rounded border border-gray-100 bg-white text-sm">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <div className="text-[12px] text-gray-600">{diasSemana[sh.diaSemana]} • {sh.horarioInicio}{sh.horarioFim ? ' — ' + sh.horarioFim : ''}</div>
                          <div className="text-[12px] text-gray-600">{sh.professorNome || (sh.professorId && (sh.professorId as any)?.nome) || ''}</div>
                        </div>
                        <div className="ml-2 text-[12px] text-gray-700 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getModalidadeColor(mod || { nome: sh.modalidadeNome }) }} />
                          <span>{mod?.nome || (sh.modalidadeNome || '')}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 border-t pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => { if (confirm('REMOVER ALUNO DA TURMA?')) { deleteHorario(horario._id); } }} className="px-3 py-1 bg-red-600 text-white rounded text-sm">REMOVER ALUNO DA TURMA</button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Edits are saved via the buttons under Observações; no duplicate Save/Cancel here */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDetailModal;
