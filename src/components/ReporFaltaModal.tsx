"use client";

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { toast } from 'react-toastify';

interface ReporFaltaModalProps {
  open: boolean;
  onClose: () => void;
  alunoId: string;
  alunoNome: string;
  falta: {
    aulaRealizadaId: string;
    avisoAusenciaId?: string;
    data: string;
    horarioInicio: string;
    horarioFim: string;
    horarioFixoId: string;
    modalidade: string;
    diasRestantes: number;
    prazoFinal: string;
  };
  onSuccess?: () => void;
}

interface HorarioDisponivel {
  id: string;
  horarioId: string;
  label: string;
  horarioInicio: string;
  horarioFim: string;
  professorNome: string;
  professorCor: string;
  alunosCount: number;
  limiteAlunos: number;
  temVaga: boolean;
  diaSemana: number;
  raw: any;
}

interface DiaCalendario {
  data: Date;
  diaDoMes: number;
  mesAtual: boolean;
}

interface Reagendamento {
  _id: string;
  novaData: string;
  dataOriginal: string;
  status: string;
  horarioFixoId?: { _id: string };
}

interface CreditoUso {
  dataUso: string;
}

interface Credito {
  usos?: CreditoUso[];
}

interface HorarioAluno {
  _id: string;
  diaSemana: number;
}

interface Feriado {
  data: string;
  nome: string;
}

export default function ReporFaltaModal({ 
  open, 
  onClose, 
  alunoId, 
  alunoNome, 
  falta, 
  onSuccess 
}: ReporFaltaModalProps) {
  const [horariosDisponiveis, setHorariosDisponiveis] = useState<any[]>([]);
  const [horariosAluno, setHorariosAluno] = useState<HorarioAluno[]>([]);
  const [reagendamentos, setReagendamentos] = useState<Reagendamento[]>([]);
  const [creditos, setCreditos] = useState<Credito[]>([]);
  const [feriados, setFeriados] = useState<Feriado[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedHorarioId, setSelectedHorarioId] = useState<string>('');
  const [calMes, setCalMes] = useState<number>(new Date().getMonth());
  const [calAno, setCalAno] = useState<number>(new Date().getFullYear());

  const diasSemana = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const diasSemanaAbrev = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

  const parseDataLocal = (dataStr: string): Date => {
    if (!dataStr) return new Date();
    const str = dataStr.split('T')[0];
    const [ano, mes, dia] = str.split('-').map(Number);
    return new Date(ano, mes - 1, dia, 12, 0, 0);
  };

  const dataFalta = useMemo(() => parseDataLocal(falta.data), [falta.data]);

  useEffect(() => {
    const fetchDados = async () => {
      try {
        setLoading(true);
        
        // Buscar horários disponíveis
        const resHorarios = await fetch('/api/horarios');
        const jsonHorarios = resHorarios.ok ? await resHorarios.json() : null;
        const dataHorarios = (jsonHorarios && jsonHorarios.success && Array.isArray(jsonHorarios.data)) ? jsonHorarios.data : (Array.isArray(jsonHorarios) ? jsonHorarios : []);
        setHorariosDisponiveis(dataHorarios || []);
        
        // Buscar horários do aluno
        const resAlunoHorarios = await fetch('/api/aluno/horarios');
        if (resAlunoHorarios.ok) {
          const dataAluno = await resAlunoHorarios.json();
          setHorariosAluno(dataAluno.horarios || []);
        }
        
        // Buscar reagendamentos do aluno
        const resReag = await fetch('/api/aluno/reagendamentos');
        if (resReag.ok) {
          const dataReag = await resReag.json();
          setReagendamentos(dataReag.reagendamentos || []);
        }
        
        // Buscar créditos do aluno
        const resCreditos = await fetch('/api/aluno/creditos');
        if (resCreditos.ok) {
          const dataCreditos = await resCreditos.json();
          setCreditos(dataCreditos.creditos || []);
        }
        
        // Buscar feriados
        const resFeriados = await fetch('/api/feriados');
        if (resFeriados.ok) {
          const dataFeriados = await resFeriados.json();
          setFeriados(dataFeriados.feriados || []);
        }
      } catch (err) {
        setHorariosDisponiveis([]);
      } finally {
        setLoading(false);
      }
    };
    if (open) {
      fetchDados();
      setSelectedDate('');
      setSelectedHorarioId('');
      const hoje = new Date();
      setCalMes(hoje.getMonth());
      setCalAno(hoje.getFullYear());
    }
  }, [open]);

  // Calcula a data limite: o dia em que se completa 7 dias DISPONÍVEIS para repor
  const calcularLimite7DiasDisponiveis = useCallback((dataInicial: Date): Date => {
    const dataAtual = new Date(dataInicial);
    dataAtual.setHours(0, 0, 0, 0);
    
    // Criar set de datas com reagendamentos/reposições na nova data (destino)
    const datasOcupadas = new Set<string>();
    reagendamentos.forEach(r => {
      if (r.status === 'aprovado' || r.status === 'pendente') {
        const dataStr = r.novaData.split('T')[0];
        datasOcupadas.add(dataStr);
      }
    });
    
    // Adicionar usos de crédito às datas ocupadas
    creditos.forEach(c => {
      c.usos?.forEach(uso => {
        if (uso.dataUso) {
          const dataStr = uso.dataUso.split('T')[0];
          datasOcupadas.add(dataStr);
        }
      });
    });
    
    // Criar set de datas originais que foram reagendadas (libera o dia de aula fixa)
    const datasOriginaisReagendadas = new Map<string, Set<string>>();
    reagendamentos.forEach(r => {
      if ((r.status === 'aprovado' || r.status === 'pendente') && r.horarioFixoId?._id) {
        const dataOrigStr = r.dataOriginal.split('T')[0];
        if (!datasOriginaisReagendadas.has(dataOrigStr)) {
          datasOriginaisReagendadas.set(dataOrigStr, new Set());
        }
        datasOriginaisReagendadas.get(dataOrigStr)!.add(r.horarioFixoId._id);
      }
    });
    
    // Criar set de dias da semana que têm horários disponíveis
    const diasComHorariosDisponiveis = new Set(horariosDisponiveis.map((h: any) => {
      const diaRaw = h.diaSemana !== undefined ? h.diaSemana : h.dia;
      return typeof diaRaw === 'number' ? diaRaw : parseInt(diaRaw, 10);
    }).filter((d: number) => !isNaN(d)));
    
    let diasDisponiveisContados = 0;
    let dataLimite = new Date(dataAtual);
    let tentativas = 0;
    const maxTentativas = 90;
    
    while (diasDisponiveisContados < 7 && tentativas < maxTentativas) {
      dataLimite.setDate(dataLimite.getDate() + 1);
      tentativas++;
      
      const diaSemana = dataLimite.getDay();
      const dataStr = `${dataLimite.getFullYear()}-${String(dataLimite.getMonth() + 1).padStart(2, '0')}-${String(dataLimite.getDate()).padStart(2, '0')}`;
      
      // Pular dias sem horários disponíveis (ex: sábado e domingo)
      if (!diasComHorariosDisponiveis.has(diaSemana)) {
        continue;
      }
      
      // Verificar se é dia de aula fixa do aluno (e não foi reagendada)
      const horariosNoDia = horariosAluno.filter(h => h.diaSemana === diaSemana);
      const todasReagendadas = horariosNoDia.length > 0 && horariosNoDia.every(h => {
        const horariosReagendados = datasOriginaisReagendadas.get(dataStr);
        return horariosReagendados?.has(h._id);
      });
      const eDiaDeAulaFixa = horariosNoDia.length > 0 && !todasReagendadas;
      
      if (eDiaDeAulaFixa) {
        continue;
      }
      
      // Verificar se é feriado ou ocupado
      const eFeriadoData = feriados.some(f => f.data === dataStr);
      const temOcupacao = datasOcupadas.has(dataStr);
      
      // Só contar como disponível se NÃO for feriado E NÃO tiver ocupação
      if (!eFeriadoData && !temOcupacao) {
        diasDisponiveisContados++;
      }
    }
    
    return dataLimite;
  }, [horariosAluno, horariosDisponiveis, feriados, reagendamentos, creditos]);

  // Helper para verificar se uma data está dentro do período
  const estaDentroDoLimite = useCallback((dataVerificar: Date): boolean => {
    const dataAtual = new Date(dataFalta);
    dataAtual.setHours(0, 0, 0, 0);
    
    const dataCheck = new Date(dataVerificar);
    dataCheck.setHours(0, 0, 0, 0);
    
    if (dataCheck <= dataAtual) return false;
    
    const dataLimite = calcularLimite7DiasDisponiveis(dataFalta);
    dataLimite.setHours(0, 0, 0, 0);
    
    return dataCheck <= dataLimite;
  }, [dataFalta, calcularLimite7DiasDisponiveis]);

  // Helper para verificar status de um dia
  const getStatusDia = useCallback((data: Date): { bloqueado: boolean; motivo: string; eDiaDeAulaFixa: boolean; temUsoCreditoNoDia: boolean } => {
    const diaSemana = data.getDay();
    const dataStr = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
    
    // Verificar se é dia de aula fixa do aluno
    const datasOriginaisReagendadas = new Map<string, Set<string>>();
    reagendamentos.forEach(r => {
      if ((r.status === 'aprovado' || r.status === 'pendente') && r.horarioFixoId?._id) {
        const dataOrigStr = r.dataOriginal.split('T')[0];
        if (!datasOriginaisReagendadas.has(dataOrigStr)) {
          datasOriginaisReagendadas.set(dataOrigStr, new Set());
        }
        datasOriginaisReagendadas.get(dataOrigStr)!.add(r.horarioFixoId._id);
      }
    });
    
    const horariosNoDia = horariosAluno.filter(h => h.diaSemana === diaSemana);
    const todasReagendadas = horariosNoDia.length > 0 && horariosNoDia.every(h => {
      const horariosReagendados = datasOriginaisReagendadas.get(dataStr);
      return horariosReagendados?.has(h._id);
    });
    const eDiaDeAulaFixa = horariosNoDia.length > 0 && !todasReagendadas;
    
    // Verificar reagendamentos de destino
    const temReagendamentoNoDia = reagendamentos.some(r => {
      if (r.status !== 'aprovado' && r.status !== 'pendente') return false;
      const novaDataStr = r.novaData.split('T')[0];
      return novaDataStr === dataStr;
    });
    
    // Verificar usos de crédito
    const temUsoCreditoNoDia = creditos.some(c => 
      c.usos?.some(uso => {
        if (!uso.dataUso) return false;
        const dataUso = uso.dataUso.split('T')[0];
        return dataUso === dataStr;
      })
    );
    
    // Verificar feriado
    const eFeriado = feriados.some(f => f.data === dataStr);
    
    if (eFeriado) {
      return { bloqueado: true, motivo: 'Sem Expediente', eDiaDeAulaFixa: false, temUsoCreditoNoDia: false };
    }
    if (eDiaDeAulaFixa) {
      return { bloqueado: true, motivo: 'Aula fixa', eDiaDeAulaFixa: true, temUsoCreditoNoDia: false };
    }
    if (temUsoCreditoNoDia) {
      return { bloqueado: true, motivo: 'Crédito usado', eDiaDeAulaFixa: false, temUsoCreditoNoDia: true };
    }
    if (temReagendamentoNoDia) {
      return { bloqueado: true, motivo: 'Reposição agendada', eDiaDeAulaFixa: false, temUsoCreditoNoDia: false };
    }
    
    return { bloqueado: false, motivo: '', eDiaDeAulaFixa: false, temUsoCreditoNoDia: false };
  }, [horariosAluno, reagendamentos, creditos, feriados]);

  const diasCalendario = useMemo((): DiaCalendario[] => {
    const primeiroDia = new Date(calAno, calMes, 1);
    const ultimoDia = new Date(calAno, calMes + 1, 0);
    const dias: DiaCalendario[] = [];
    const diaSemanaInicio = primeiroDia.getDay();
    
    // Dias do mês anterior (apenas para completar a primeira semana)
    for (let i = diaSemanaInicio - 1; i >= 0; i--) {
      const d = new Date(calAno, calMes, -i);
      dias.push({ data: d, diaDoMes: d.getDate(), mesAtual: false });
    }
    
    // Dias do mês atual
    for (let d = 1; d <= ultimoDia.getDate(); d++) {
      dias.push({ data: new Date(calAno, calMes, d), diaDoMes: d, mesAtual: true });
    }
    
    // Dias do próximo mês (apenas para completar a última semana)
    const ultimoDiaSemana = ultimoDia.getDay();
    if (ultimoDiaSemana < 6) {
      for (let i = 1; i <= (6 - ultimoDiaSemana); i++) {
        const d = new Date(calAno, calMes + 1, i);
        dias.push({ data: d, diaDoMes: d.getDate(), mesAtual: false });
      }
    }
    
    return dias;
  }, [calMes, calAno]);

  const getHorariosDisponiveisNoDia = (data: Date): HorarioDisponivel[] => {
    if (!Array.isArray(horariosDisponiveis) || horariosDisponiveis.length === 0) return [];
    const jsDay = data.getDay();
    const dateISO = data.toISOString().slice(0, 10);
    const matching = horariosDisponiveis.filter(h => {
      const diaRaw = h.diaSemana !== undefined ? h.diaSemana : h.dia;
      if (diaRaw === null || diaRaw === undefined) return false;
      const normalize = (val: any): number | null => {
        if (val === null || val === undefined) return null;
        if (typeof val === 'number') {
          if (val >= 0 && val <= 6) return val;
          if (val >= 1 && val <= 7) return val - 1;
          return null;
        }
        if (typeof val === 'string') {
          const n = parseInt(val, 10);
          if (!isNaN(n)) {
            if (n >= 0 && n <= 6) return n;
            if (n >= 1 && n <= 7) return n - 1;
          }
        }
        return null;
      };
      return normalize(diaRaw) === jsDay;
    });
    return matching.map((h: any) => {
      const inicioH = h.horarioInicio || h.inicio || '';
      const fim = h.horarioFim || h.fim || '';
      let professorNome = '';
      let professorCor = '#3B82F6';
      if (h.professorId && typeof h.professorId === 'object') {
        professorNome = h.professorId.nome || '';
        professorCor = h.professorId.cor || '#3B82F6';
      }
      const matriculas = h.matriculas || [];
      const alunosCount = matriculas.filter((m: any) => !m.emEspera).length;
      const limiteAlunos = typeof h.modalidadeId === 'string' ? 0 : (h.modalidadeId?.limiteAlunos || 0);
      const temVaga = limiteAlunos === 0 || alunosCount < limiteAlunos;
      return { id: String(h._id || h.id || dateISO + '_' + inicioH), horarioId: String(h._id || h.id || ''), label: inicioH && fim ? inicioH + ' - ' + fim : (inicioH || fim || 'Horário'), horarioInicio: inicioH, horarioFim: fim, professorNome, professorCor, alunosCount, limiteAlunos, temVaga, diaSemana: jsDay, raw: h };
    }).filter(h => h.temVaga);
  };

  const selecionarDestino = (data: Date, horario: HorarioDisponivel) => {
    setSelectedDate(data.toISOString().slice(0, 10));
    setSelectedHorarioId(horario.id);
  };

  const horarioSelecionado = useMemo(() => {
    if (!selectedDate || !selectedHorarioId) return null;
    const data = parseDataLocal(selectedDate);
    const horarios = getHorariosDisponiveisNoDia(data);
    return horarios.find(h => h.id === selectedHorarioId) || null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, selectedHorarioId, horariosDisponiveis]);

  if (!open) return null;

  const handleConfirm = async () => {
    if (!selectedDate || !selectedHorarioId || !horarioSelecionado) {
      toast.warning('Selecione uma data e um horário');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/reagendamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          horarioFixoId: falta.horarioFixoId,
          dataOriginal: falta.data,
          novaData: selectedDate,
          novoHorarioInicio: horarioSelecionado.horarioInicio,
          novoHorarioFim: horarioSelecionado.horarioFim,
          novoHorarioFixoId: horarioSelecionado.horarioId || horarioSelecionado.raw?._id,
          isReposicao: true,
          aulaRealizadaId: falta.aulaRealizadaId,
          alunoId: alunoId,
          motivo: 'Reposição de falta do dia ' + parseDataLocal(falta.data).toLocaleDateString('pt-BR') + ' (' + falta.horarioInicio + '-' + falta.horarioFim + ')' + (falta.avisoAusenciaId ? ' [ID: ' + falta.avisoAusenciaId + ']' : '')
        })
      });
      const json = await res.json();
      if (json && json.success) {
        toast.success('Solicitação de reposição enviada com sucesso!');
        if (typeof onSuccess === 'function') onSuccess();
        onClose();
      } else {
        toast.error('Falha ao solicitar reposição: ' + (json?.error || json?.message || 'erro desconhecido'));
      }
    } catch (err) {
      toast.error('Erro ao enviar solicitação de reposição');
    } finally {
      setSubmitting(false);
    }
  };

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 max-w-lg w-full p-6 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex-shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <i className="fas fa-redo text-orange-600" />Repor Falta
              </h2>
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                <i className="fas fa-user text-orange-600" />{alunoNome}
              </p>
              <div className="mt-3 mb-1 p-2 bg-gradient-to-r from-orange-50 via-gray-50 to-green-50 border border-gray-300 rounded-md">
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-white/80 rounded-md px-3 py-2 border border-orange-200">
                    <div className="text-xs">
                      <div className="font-semibold text-orange-700 flex items-center gap-1">
                        <i className="far fa-calendar text-orange-400"></i>
                        {diasSemana[parseDataLocal(falta.data).getDay()]} {parseDataLocal(falta.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                      </div>
                      <div className="text-gray-700 font-medium flex items-center gap-1">
                        <i className="far fa-clock text-gray-400"></i>{falta.horarioInicio}-{falta.horarioFim}
                      </div>
                      <div className="text-gray-600 text-[10px] mt-0.5">{falta.modalidade}</div>
                    </div>
                  </div>
                  <div className="flex-shrink-0"><i className="fas fa-arrow-right text-gray-400 text-lg"></i></div>
                  <div className={`flex-1 bg-white/80 rounded-md px-3 py-2 border ${selectedDate && selectedHorarioId ? 'border-green-400' : 'border-gray-300'}`}>
                    {selectedDate && horarioSelecionado ? (
                      <div className="text-xs">
                        <div className="font-semibold text-green-700 flex items-center gap-1">
                          <i className="far fa-calendar text-green-400"></i>
                          {diasSemana[parseDataLocal(selectedDate).getDay()]} {parseDataLocal(selectedDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                        </div>
                        <div className="text-gray-700 font-medium flex items-center gap-1">
                          <i className="far fa-clock text-gray-400"></i>{horarioSelecionado.horarioInicio}-{horarioSelecionado.horarioFim}
                        </div>
                        {horarioSelecionado.professorNome && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="inline-block px-1.5 py-0.5 rounded-md text-white text-[10px] font-medium" style={{ backgroundColor: horarioSelecionado.professorCor }}>{horarioSelecionado.professorNome}</span>
                          </div>
                        )}
                      </div>
                    ) : (<div className="text-xs text-gray-500 italic">Selecione abaixo</div>)}
                  </div>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><i className="fas fa-times text-lg" /></button>
          </div>
          <div className="border-t border-gray-200 mt-4 mb-4" />
          <div className={`mb-4 p-3 rounded-md border ${falta.diasRestantes <= 2 ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}`}>
            <div className="flex items-center gap-2">
              <i className={`fas fa-clock ${falta.diasRestantes <= 2 ? 'text-red-500' : 'text-yellow-600'}`} />
              <div className="text-sm">
                <span className="font-semibold">{falta.diasRestantes === 0 ? 'Último dia!' : falta.diasRestantes === 1 ? 'Falta 1 dia!' : `Faltam ${falta.diasRestantes} dias`}</span>
                <span className="text-gray-600 ml-1">para repor (até {falta.prazoFinal})</span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => { if (calMes === 0) { setCalMes(11); setCalAno(calAno - 1); } else { setCalMes(calMes - 1); } }} className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><i className="fas fa-chevron-left text-gray-600"></i></button>
            <h4 className="text-sm font-bold text-gray-900 capitalize">{new Date(calAno, calMes).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</h4>
            <button onClick={() => { if (calMes === 11) { setCalMes(0); setCalAno(calAno + 1); } else { setCalMes(calMes + 1); } }} className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><i className="fas fa-chevron-right text-gray-600"></i></button>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {diasSemanaAbrev.map((dia, idx) => (<div key={idx} className="text-center text-[10px] font-semibold text-gray-500 py-1">{dia}</div>))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="grid grid-cols-7 gap-1 mb-4">
              {diasCalendario.map((diaObj, idx) => {
                const diaObjDate = new Date(diaObj.data);
                diaObjDate.setHours(0, 0, 0, 0);
                const limiteMinimo = new Date(dataFalta);
                limiteMinimo.setDate(limiteMinimo.getDate() + 1);
                limiteMinimo.setHours(0, 0, 0, 0);
                const isPassado = diaObjDate < hoje;
                const isAntesDoLimite = diaObjDate < limiteMinimo;
                const isMesmoDia = diaObj.data.toDateString() === dataFalta.toDateString();
                
                // Verificar se está dentro do limite de 7 dias disponíveis
                const dentroDoLimite = estaDentroDoLimite(diaObj.data);
                
                // Verificar status do dia (bloqueado, motivo, etc.)
                const statusDia = getStatusDia(diaObj.data);
                const diaOcupado = statusDia.bloqueado;
                
                // Não mostrar horários se for ocupado ou fora do limite
                const horariosDisp = diaObj.mesAtual && !isPassado && !isAntesDoLimite && dentroDoLimite && !isMesmoDia && !diaOcupado ? getHorariosDisponiveisNoDia(diaObj.data) : [];
                const temHorario = horariosDisp.length > 0;
                
                // Verificar se é feriado
                const eFeriado = feriados.some(f => f.data === `${diaObj.data.getFullYear()}-${String(diaObj.data.getMonth() + 1).padStart(2, '0')}-${String(diaObj.data.getDate()).padStart(2, '0')}`);                
                
                // Para dias do próximo mês: buscar horários disponíveis (para exibir em cinza)
                const horariosProximoMes = !diaObj.mesAtual && !isPassado && dentroDoLimite && !diaOcupado ? getHorariosDisponiveisNoDia(diaObj.data) : [];
                const isDiaProximoMesComHorarios = horariosProximoMes.length > 0;
                
                return (
                  <div key={idx} className={`min-h-[80px] max-h-[120px] p-1 rounded-lg border transition-all text-center 
                    ${!diaObj.mesAtual && !isDiaProximoMesComHorarios && !diaOcupado ? 'bg-gray-50 opacity-40' : ''}
                    ${isDiaProximoMesComHorarios ? 'bg-gray-200 border-gray-400' : ''}
                    ${diaOcupado ? 'bg-gray-100' : ''}
                    ${diaObj.mesAtual && !diaOcupado && !isPassado && !isAntesDoLimite && !isMesmoDia ? 'bg-white' : ''}
                    ${(isPassado || isAntesDoLimite) && diaObj.mesAtual ? 'bg-gray-300 opacity-70' : ''}
                    ${!dentroDoLimite && diaObj.mesAtual && !isPassado && !isAntesDoLimite ? 'opacity-40' : ''} 
                    ${isMesmoDia ? 'bg-red-50 border-red-300 opacity-60' : ''} 
                    ${diaOcupado ? 'border-gray-300' : temHorario ? 'border-green-300 bg-green-50' : 'border-gray-200'}`} 
                    title={isMesmoDia ? 'Não é possível repor no mesmo dia da falta' : isDiaProximoMesComHorarios ? 'Avance para o próximo mês para selecionar' : diaOcupado ? statusDia.motivo : undefined}>
                    <div className={`text-xs font-semibold ${isDiaProximoMesComHorarios ? 'text-gray-500' : diaOcupado ? 'text-gray-400' : temHorario ? 'text-green-700' : 'text-gray-500'}`}>{diaObj.diaDoMes}</div>
                    
                    {/* Horários do próximo mês (cinza, não clicável) */}
                    {isDiaProximoMesComHorarios && (
                      <div className="mt-0.5 space-y-0.5 overflow-y-auto max-h-[44px] scrollbar-thin">
                        {horariosProximoMes.map((h, hIdx) => (
                          <div key={hIdx} className="w-full px-0.5 py-0.5 rounded text-[9px] font-medium bg-gray-400 text-white truncate cursor-not-allowed">{h.horarioInicio}</div>
                        ))}
                      </div>
                    )}
                    
                    {/* Mensagem de dia ocupado */}
                    {diaOcupado && !isDiaProximoMesComHorarios && dentroDoLimite && !isPassado && (
                      <div className="flex flex-col items-center justify-center h-[60px] text-gray-400">
                        <i className={`fas ${eFeriado ? 'fa-calendar-times' : statusDia.eDiaDeAulaFixa ? 'fa-user-clock' : statusDia.temUsoCreditoNoDia ? 'fa-gift' : 'fa-calendar-check'} text-sm mb-0.5`}></i>
                        <span className="text-[8px] font-medium text-center">{statusDia.motivo}</span>
                      </div>
                    )}
                    
                    {temHorario && (
                      <div className="mt-0.5 space-y-0.5 overflow-y-auto max-h-[44px] scrollbar-thin">
                        {horariosDisp.map((h, hIdx) => (
                          <button key={hIdx} onClick={() => selecionarDestino(diaObj.data, h)} className={`w-full px-0.5 py-0.5 rounded text-[9px] font-medium transition-colors truncate ${selectedDate === diaObj.data.toISOString().slice(0, 10) && selectedHorarioId === h.id ? 'bg-orange-600 text-white' : 'bg-green-600 text-white hover:bg-green-700'}`}>{h.horarioInicio}</button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
          <div className="text-xs text-gray-500 text-center"><i className="fas fa-info-circle mr-1"></i>Escolha uma data dentro dos próximos 7 dias livres. Dias verdes têm vagas.</div>
        </div>
        <div className="mt-4 pt-3 border-t border-gray-200 flex justify-end gap-3 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50" disabled={submitting}>Cancelar</button>
          <button onClick={handleConfirm} disabled={!selectedDate || !selectedHorarioId || submitting} className="px-4 py-2 rounded-md text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
            {submitting ? (<><i className="fas fa-spinner fa-spin" />Enviando...</>) : (<><i className="fas fa-paper-plane" />Solicitar Reposição</>)}
          </button>
        </div>
      </div>
    </div>
  );
}
