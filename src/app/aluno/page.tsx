'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Logo from '@/components/Logo';

interface Aluno {
  _id: string;
  nome: string;
  email?: string;
  telefone?: string;
  endereco?: string;
  modalidade?: {
    _id: string;
    nome: string;
    cor: string;
  };
  congelado?: boolean;
  ausente?: boolean;
  emEspera?: boolean;
}

interface Horario {
  _id: string;
  diaSemana: number;
  horarioInicio: string;
  horarioFim: string;
  modalidadeId?: {
    _id: string;
    nome: string;
    cor: string;
  };
  professorId?: {
    _id: string;
    nome: string;
  };
}

interface HorarioDisponivel {
  _id: string;
  diaSemana: number;
  horarioInicio: string;
  horarioFim: string;
  modalidade?: {
    _id: string;
    nome: string;
    cor: string;
  };
  professor?: {
    _id: string;
    nome: string;
  };
  temVaga: boolean;
}

interface Reagendamento {
  _id: string;
  dataOriginal: string;
  novaData: string;
  novoHorarioInicio: string;
  novoHorarioFim: string;
  status: 'pendente' | 'aprovado' | 'rejeitado';
  motivo?: string;
  criadoEm: string;
}

interface Presenca {
  _id: string;
  data: string;
  diaSemana: number;
  modalidade: string;
  horarioInicio: string;
  horarioFim: string;
  presente: boolean | null;
  eraReagendamento: boolean;
  observacoes?: string;
}

interface Aviso {
  _id: string;
  titulo: string;
  mensagem: string;
  tipo: 'info' | 'alerta' | 'cancelamento' | 'urgente';
  dataInicio: string;
  dataFim: string;
  modalidadesAfetadas?: { _id: string; nome: string; cor: string }[];
}

interface Estatisticas {
  totalAulas: number;
  presencas: number;
  faltas: number;
  reagendamentos: number;
  percentualPresenca: number;
}

interface AvisoAusencia {
  _id: string;
  dataAusencia: string;
  motivo: string;
  status: 'pendente' | 'confirmada' | 'cancelada' | 'usada';
  temDireitoReposicao: boolean;
  horarioFixoId?: {
    _id: string;
    horarioInicio: string;
    horarioFim: string;
    diaSemana: number;
    modalidadeId?: { _id: string; nome: string; cor: string };
    professorId?: { _id: string; nome: string };
  };
}

interface FaltaReposicao {
  _id: string;
  tipo: 'aviso_ausencia' | 'falta_registrada';
  data: string;
  horarioFixoId: string;
  horarioInicio: string;
  horarioFim: string;
  modalidade?: { _id: string; nome: string; cor: string };
  temDireitoReposicao: boolean;
  motivo?: string;
}

const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const diasSemanaAbrev = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// Interface para aula no calendário
interface AulaCalendario {
  _id: string;
  data: Date;
  dataStr: string;
  diaSemana: number;
  horarioInicio: string;
  horarioFim: string;
  horarioFixoId: string;
  modalidade?: { _id: string; nome: string; cor: string };
  professor?: { _id: string; nome: string };
  tipo: 'minha' | 'disponivel';
  temVaga?: boolean;
}

export default function AlunoAreaPage() {
  const [aluno, setAluno] = useState<Aluno | null>(null);
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [horariosDisponiveis, setHorariosDisponiveis] = useState<HorarioDisponivel[]>([]);
  const [reagendamentos, setReagendamentos] = useState<Reagendamento[]>([]);
  const [presencas, setPresencas] = useState<Presenca[]>([]);
  const [estatisticas, setEstatisticas] = useState<Estatisticas | null>(null);
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [temCancelamentoHoje, setTemCancelamentoHoje] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Modais
  const [showReagendamentoModal, setShowReagendamentoModal] = useState(false);
  const [showPerfilModal, setShowPerfilModal] = useState(false);
  const [showHistoricoModal, setShowHistoricoModal] = useState(false);
  const [showAvisarAusenciaModal, setShowAvisarAusenciaModal] = useState(false);
  const [showReposicaoModal, setShowReposicaoModal] = useState(false);
  
  // Estados de ausência e reposição
  const [avisosAusencia, setAvisosAusencia] = useState<AvisoAusencia[]>([]);
  const [faltasComDireito, setFaltasComDireito] = useState<FaltaReposicao[]>([]);
  const [faltasSemDireito, setFaltasSemDireito] = useState<FaltaReposicao[]>([]);
  const [reposicoesDisponiveis, setReposicoesDisponiveis] = useState(0);
  
  // Estados do modal de avisar ausência
  const [ausenciaHorarioId, setAusenciaHorarioId] = useState('');
  const [ausenciaData, setAusenciaData] = useState('');
  const [ausenciaMotivo, setAusenciaMotivo] = useState('');
  const [enviandoAusencia, setEnviandoAusencia] = useState(false);
  
  // Estados do modal de reposição
  const [faltaSelecionada, setFaltaSelecionada] = useState<FaltaReposicao | null>(null);
  const [reposicaoNovaData, setReposicaoNovaData] = useState('');
  const [reposicaoNovoHorarioId, setReposicaoNovoHorarioId] = useState('');
  const [enviandoReposicao, setEnviandoReposicao] = useState(false);
  
  // Estados do modal de reagendamento
  const [horarioSelecionado, setHorarioSelecionado] = useState<Horario | null>(null);
  const [dataOriginal, setDataOriginal] = useState('');
  const [novaData, setNovaData] = useState('');
  const [novoHorarioId, setNovoHorarioId] = useState('');
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  
  // Estados do modal de perfil
  const [perfilForm, setPerfilForm] = useState({ email: '', telefone: '', endereco: '' });
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);
  
  const [adminContact, setAdminContact] = useState<{ whatsapp: string; nome: string } | null>(null);
  const [abaAtiva, setAbaAtiva] = useState<'hoje' | 'calendario' | 'faltas' | 'reagendamentos'>('hoje');
  const router = useRouter();
  
  // Estados do calendário visual
  const [calMes, setCalMes] = useState(() => new Date().getMonth());
  const [calAno, setCalAno] = useState(() => new Date().getFullYear());
  const [aulaSelecionada, setAulaSelecionada] = useState<AulaCalendario | null>(null);
  const [etapaReagendamento, setEtapaReagendamento] = useState<'selecionar' | 'destino' | 'confirmar'>('selecionar');
  const [destinoMes, setDestinoMes] = useState(() => new Date().getMonth());
  const [destinoAno, setDestinoAno] = useState(() => new Date().getFullYear());
  const [horarioDestino, setHorarioDestino] = useState<AulaCalendario | null>(null);
  const [motivoTroca, setMotivoTroca] = useState('');

  // Carregar dados do aluno do localStorage
  useEffect(() => {
    try {
      const alunoData = localStorage.getItem('aluno');
      if (alunoData) {
        setAluno(JSON.parse(alunoData));
      } else {
        router.push('/');
      }
    } catch {
      router.push('/');
    }
  }, [router]);

  // Buscar contato do admin
  useEffect(() => {
    fetch('/api/public/admin-contact')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setAdminContact({ whatsapp: data.whatsapp, nome: data.nome });
        }
      })
      .catch(() => {});
  }, []);

  // Buscar todos os dados
  const fetchDados = useCallback(async () => {
    if (!aluno?._id) return;
    
    setLoading(true);
    try {
      // Buscar horários
      const horariosRes = await fetch(`/api/aluno/horarios`);
      if (horariosRes.ok) {
        const data = await horariosRes.json();
        setHorarios(data.horarios || []);
      }

      // Buscar reagendamentos
      const reagRes = await fetch(`/api/aluno/reagendamentos`);
      if (reagRes.ok) {
        const data = await reagRes.json();
        setReagendamentos(data.reagendamentos || []);
      }

      // Buscar horários disponíveis
      const dispRes = await fetch(`/api/aluno/horarios-disponiveis`);
      if (dispRes.ok) {
        const data = await dispRes.json();
        setHorariosDisponiveis(data.horarios || []);
      }

      // Buscar avisos
      const avisosRes = await fetch(`/api/aluno/avisos`);
      console.log('[Aluno Page] Resposta avisos:', avisosRes.status);
      if (avisosRes.ok) {
        const data = await avisosRes.json();
        console.log('[Aluno Page] Avisos recebidos:', data);
        setAvisos(data.avisos || []);
        setTemCancelamentoHoje(data.temCancelamentoHoje || false);
      } else {
        console.log('[Aluno Page] Erro ao buscar avisos:', await avisosRes.text());
      }

      // Buscar histórico de presenças
      const presencasRes = await fetch(`/api/aluno/presencas?limite=30`);
      if (presencasRes.ok) {
        const data = await presencasRes.json();
        setPresencas(data.historico || []);
        setEstatisticas(data.estatisticas || null);
      }

      // Buscar avisos de ausência e reposições
      const ausenciasRes = await fetch(`/api/aluno/avisar-ausencia`);
      if (ausenciasRes.ok) {
        const data = await ausenciasRes.json();
        setAvisosAusencia(data.avisos || []);
      }

      // Buscar faltas disponíveis para reposição
      const faltasRes = await fetch(`/api/aluno/faltas-reposicao`);
      if (faltasRes.ok) {
        const data = await faltasRes.json();
        setFaltasComDireito(data.faltasComDireito || []);
        setFaltasSemDireito(data.faltasSemDireito || []);
        setReposicoesDisponiveis(data.totalReposicoesDisponiveis || 0);
      }

    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      setLoading(false);
    }
  }, [aluno?._id]);

  useEffect(() => {
    if (aluno?._id) {
      fetchDados();
    }
  }, [aluno?._id, fetchDados]);

  const handleLogout = async () => {
    try {
      await fetch('/api/aluno/auth', { method: 'DELETE' });
      localStorage.removeItem('aluno');
      localStorage.removeItem('alunoToken');
    } catch {
      // ignorar
    }
    window.location.href = '/';
  };

  // Próximas aulas da semana
  const proximasAulas = useMemo(() => {
    const hoje = new Date();
    const diaHoje = hoje.getDay();
    const horaAtual = hoje.getHours() * 60 + hoje.getMinutes();
    
    const aulasOrdenadas = horarios.map(h => {
      let diasAte = h.diaSemana - diaHoje;
      if (diasAte < 0) diasAte += 7;
      
      if (diasAte === 0) {
        const [horaAula, minAula] = h.horarioInicio.split(':').map(Number);
        const minutoAula = horaAula * 60 + minAula;
        if (minutoAula < horaAtual) {
          diasAte = 7;
        }
      }
      
      const dataAula = new Date(hoje);
      dataAula.setDate(hoje.getDate() + diasAte);
      
      return { ...h, diasAte, dataAula };
    }).sort((a, b) => a.diasAte - b.diasAte);
    
    return aulasOrdenadas.slice(0, 3);
  }, [horarios]);

  // Verificar se tem aula hoje
  const aulasHoje = useMemo(() => {
    const hoje = new Date().getDay();
    return horarios.filter(h => h.diaSemana === hoje);
  }, [horarios]);

  const abrirModalReagendamento = (horario: Horario) => {
    setHorarioSelecionado(horario);
    setDataOriginal('');
    setNovaData('');
    setNovoHorarioId('');
    setMotivo('');
    setShowReagendamentoModal(true);
  };

  const horariosParaDataSelecionada = useMemo(() => {
    if (!novaData) return [];
    const dataSelecionada = new Date(novaData + 'T12:00:00');
    const diaSemana = dataSelecionada.getDay();
    return horariosDisponiveis.filter(h => h.diaSemana === diaSemana && h.temVaga);
  }, [novaData, horariosDisponiveis]);

  const enviarReagendamento = async () => {
    if (!horarioSelecionado || !dataOriginal || !novaData || !novoHorarioId) {
      alert('Preencha todos os campos obrigatórios');
      return;
    }
    
    setEnviando(true);
    try {
      const res = await fetch('/api/aluno/reagendamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          horarioFixoId: horarioSelecionado._id,
          dataOriginal,
          novaData,
          novoHorarioFixoId: novoHorarioId,
          motivo: motivo || 'Solicitação de reagendamento pelo aluno'
        })
      });

      if (res.ok) {
        setShowReagendamentoModal(false);
        fetchDados();
        alert('Solicitação enviada! Aguarde a aprovação.');
      } else {
        const data = await res.json();
        alert(data.error || 'Erro ao solicitar reagendamento');
      }
    } catch {
      alert('Erro ao enviar solicitação');
    } finally {
      setEnviando(false);
    }
  };

  const abrirModalPerfil = async () => {
    try {
      const res = await fetch('/api/aluno/perfil');
      if (res.ok) {
        const data = await res.json();
        setPerfilForm({
          email: data.dados?.email || '',
          telefone: data.dados?.telefone || '',
          endereco: data.dados?.endereco || ''
        });
      }
    } catch {
      setPerfilForm({
        email: aluno?.email || '',
        telefone: aluno?.telefone || '',
        endereco: aluno?.endereco || ''
      });
    }
    setShowPerfilModal(true);
  };

  const salvarPerfil = async () => {
    setSalvandoPerfil(true);
    try {
      const res = await fetch('/api/aluno/perfil', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(perfilForm)
      });

      const data = await res.json();
      
      if (res.ok) {
        const alunoAtualizado = { ...aluno, ...perfilForm };
        localStorage.setItem('aluno', JSON.stringify(alunoAtualizado));
        setAluno(alunoAtualizado as Aluno);
        setShowPerfilModal(false);
        alert('Dados atualizados com sucesso!');
      } else {
        alert(data.error || 'Erro ao atualizar dados');
      }
    } catch {
      alert('Erro ao salvar dados');
    } finally {
      setSalvandoPerfil(false);
    }
  };

  // Abrir modal de avisar ausência
  const abrirModalAvisarAusencia = (horario?: Horario) => {
    if (horario) {
      setAusenciaHorarioId(horario._id);
    } else {
      setAusenciaHorarioId('');
    }
    setAusenciaData('');
    setAusenciaMotivo('');
    setShowAvisarAusenciaModal(true);
  };

  // Enviar aviso de ausência
  const enviarAvisoAusencia = async () => {
    if (!ausenciaHorarioId || !ausenciaData || !ausenciaMotivo) {
      alert('Preencha todos os campos');
      return;
    }

    setEnviandoAusencia(true);
    try {
      const res = await fetch('/api/aluno/avisar-ausencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          horarioFixoId: ausenciaHorarioId,
          dataAusencia: ausenciaData,
          motivo: ausenciaMotivo
        })
      });

      const data = await res.json();
      
      if (res.ok) {
        alert(data.message);
        setShowAvisarAusenciaModal(false);
        fetchDados();
      } else {
        alert(data.error || 'Erro ao registrar ausência');
      }
    } catch {
      alert('Erro ao enviar aviso de ausência');
    } finally {
      setEnviandoAusencia(false);
    }
  };

  // Cancelar aviso de ausência
  const cancelarAvisoAusencia = async (avisoId: string) => {
    if (!confirm('Confirma que você vai comparecer a esta aula?')) return;
    
    try {
      const res = await fetch(`/api/aluno/avisar-ausencia?id=${avisoId}`, {
        method: 'DELETE'
      });

      const data = await res.json();
      
      if (res.ok) {
        alert(data.message);
        fetchDados();
      } else {
        alert(data.error || 'Erro ao cancelar aviso');
      }
    } catch {
      alert('Erro ao cancelar aviso');
    }
  };

  // Abrir modal de solicitar reposição
  const abrirModalReposicao = (falta: FaltaReposicao) => {
    setFaltaSelecionada(falta);
    setReposicaoNovaData('');
    setReposicaoNovoHorarioId('');
    setShowReposicaoModal(true);
  };

  // Enviar solicitação de reposição
  const enviarSolicitacaoReposicao = async () => {
    if (!faltaSelecionada || !reposicaoNovaData || !reposicaoNovoHorarioId) {
      alert('Selecione a data e horário da reposição');
      return;
    }

    setEnviandoReposicao(true);
    try {
      const res = await fetch('/api/aluno/solicitar-reposicao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          avisoAusenciaId: faltaSelecionada._id,
          novoHorarioFixoId: reposicaoNovoHorarioId,
          novaData: reposicaoNovaData
        })
      });

      const data = await res.json();
      
      if (res.ok) {
        alert(data.message);
        setShowReposicaoModal(false);
        fetchDados();
      } else {
        alert(data.error || 'Erro ao solicitar reposição');
      }
    } catch {
      alert('Erro ao enviar solicitação');
    } finally {
      setEnviandoReposicao(false);
    }
  };

  // Filtrar horários disponíveis pelo dia da semana da data selecionada E mesma modalidade da falta
  const horariosParaReposicao = useMemo(() => {
    if (!reposicaoNovaData) return [];
    const diaSemana = new Date(reposicaoNovaData + 'T12:00:00').getDay();
    
    return horariosDisponiveis.filter(h => {
      if (h.diaSemana !== diaSemana || !h.temVaga) return false;
      
      // Se tem falta selecionada, só mostrar horários da mesma modalidade
      if (faltaSelecionada?.modalidade?._id) {
        return h.modalidade?._id === faltaSelecionada.modalidade._id;
      }
      
      return true;
    });
  }, [reposicaoNovaData, horariosDisponiveis, faltaSelecionada]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pendente':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">Pendente</span>;
      case 'aprovado':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">Aprovado</span>;
      case 'rejeitado':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">Rejeitado</span>;
      default:
        return null;
    }
  };

  const getTipoAvisoBadge = (tipo: string) => {
    switch (tipo) {
      case 'urgente':
        return { bg: 'bg-red-500', icon: 'fas fa-exclamation-circle', text: 'text-white' };
      case 'cancelamento':
        return { bg: 'bg-orange-500', icon: 'fas fa-times-circle', text: 'text-white' };
      case 'alerta':
        return { bg: 'bg-yellow-500', icon: 'fas fa-exclamation-triangle', text: 'text-white' };
      default:
        return { bg: 'bg-blue-500', icon: 'fas fa-info-circle', text: 'text-white' };
    }
  };

  const formatarData = (dataStr: string) => {
    const data = new Date(dataStr);
    return data.toLocaleDateString('pt-BR');
  };

  const formatarDataCompleta = (dataStr: string) => {
    const data = new Date(dataStr);
    return data.toLocaleDateString('pt-BR', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long' 
    });
  };

  // Gerar dias do calendário do mês
  const diasCalendario = useMemo(() => {
    const primeiroDia = new Date(calAno, calMes, 1);
    const ultimoDia = new Date(calAno, calMes + 1, 0);
    const diasNoMes = ultimoDia.getDate();
    const primeiroDiaSemana = primeiroDia.getDay();
    
    const dias: { data: Date; diaDoMes: number; mesAtual: boolean }[] = [];
    
    // Dias do mês anterior
    for (let i = primeiroDiaSemana - 1; i >= 0; i--) {
      const data = new Date(calAno, calMes, -i);
      dias.push({ data, diaDoMes: data.getDate(), mesAtual: false });
    }
    
    // Dias do mês atual
    for (let i = 1; i <= diasNoMes; i++) {
      const data = new Date(calAno, calMes, i);
      dias.push({ data, diaDoMes: i, mesAtual: true });
    }
    
    // Dias do próximo mês para completar a grid
    const diasRestantes = 42 - dias.length;
    for (let i = 1; i <= diasRestantes; i++) {
      const data = new Date(calAno, calMes + 1, i);
      dias.push({ data, diaDoMes: i, mesAtual: false });
    }
    
    return dias;
  }, [calMes, calAno]);

  // Gerar minhas aulas no calendário (próximos 60 dias)
  const minhasAulasCalendario = useMemo(() => {
    const aulas: AulaCalendario[] = [];
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < 60; i++) {
      const data = new Date(hoje);
      data.setDate(hoje.getDate() + i);
      const diaSemana = data.getDay();
      
      // Verificar se tenho aula neste dia
      const horariosNoDia = horarios.filter(h => h.diaSemana === diaSemana);
      
      horariosNoDia.forEach(h => {
        const dataStr = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
        aulas.push({
          _id: `${h._id}-${dataStr}`,
          data: new Date(data),
          dataStr,
          diaSemana,
          horarioInicio: h.horarioInicio,
          horarioFim: h.horarioFim,
          horarioFixoId: h._id,
          modalidade: h.modalidadeId,
          professor: h.professorId,
          tipo: 'minha'
        });
      });
    }
    
    return aulas;
  }, [horarios]);

  // Verificar se um dia tem aula
  const getAulasNoDia = useCallback((data: Date) => {
    const dataStr = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
    return minhasAulasCalendario.filter(a => a.dataStr === dataStr);
  }, [minhasAulasCalendario]);

  // Gerar dias do calendário de destino
  const diasCalendarioDestino = useMemo(() => {
    const primeiroDia = new Date(destinoAno, destinoMes, 1);
    const ultimoDia = new Date(destinoAno, destinoMes + 1, 0);
    const diasNoMes = ultimoDia.getDate();
    const primeiroDiaSemana = primeiroDia.getDay();
    
    const dias: { data: Date; diaDoMes: number; mesAtual: boolean }[] = [];
    
    for (let i = primeiroDiaSemana - 1; i >= 0; i--) {
      const data = new Date(destinoAno, destinoMes, -i);
      dias.push({ data, diaDoMes: data.getDate(), mesAtual: false });
    }
    
    for (let i = 1; i <= diasNoMes; i++) {
      const data = new Date(destinoAno, destinoMes, i);
      dias.push({ data, diaDoMes: i, mesAtual: true });
    }
    
    const diasRestantes = 42 - dias.length;
    for (let i = 1; i <= diasRestantes; i++) {
      const data = new Date(destinoAno, destinoMes + 1, i);
      dias.push({ data, diaDoMes: i, mesAtual: false });
    }
    
    return dias;
  }, [destinoMes, destinoAno]);

  // Horários disponíveis para uma data específica (filtrados pela mesma modalidade da aula selecionada)
  const getHorariosDisponiveisNoDia = useCallback((data: Date) => {
    const diaSemana = data.getDay();
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    if (data < hoje) return [];
    
    // Filtrar por dia da semana, vaga disponível E mesma modalidade da aula selecionada
    return horariosDisponiveis.filter(h => {
      if (h.diaSemana !== diaSemana || !h.temVaga) return false;
      
      // Se tem aula selecionada, só mostrar horários da mesma modalidade
      if (aulaSelecionada?.modalidade?._id) {
        return h.modalidade?._id === aulaSelecionada.modalidade._id;
      }
      
      return true;
    });
  }, [horariosDisponiveis, aulaSelecionada]);

  // Abrir modal de troca de aula
  const iniciarTrocaAula = (aula: AulaCalendario) => {
    setAulaSelecionada(aula);
    setEtapaReagendamento('selecionar');
    setHorarioDestino(null);
    setMotivoTroca('');
  };

  // Selecionar horário de destino
  const selecionarDestino = (data: Date, horario: HorarioDisponivel) => {
    const dataStr = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
    setHorarioDestino({
      _id: horario._id,
      data,
      dataStr,
      diaSemana: data.getDay(),
      horarioInicio: horario.horarioInicio,
      horarioFim: horario.horarioFim,
      horarioFixoId: horario._id,
      modalidade: horario.modalidade,
      professor: horario.professor,
      tipo: 'disponivel',
      temVaga: horario.temVaga
    });
    setEtapaReagendamento('confirmar');
  };

  // Confirmar reagendamento visual
  const confirmarReagendamentoVisual = async () => {
    if (!aulaSelecionada || !horarioDestino) return;
    
    setEnviando(true);
    try {
      const res = await fetch('/api/aluno/reagendamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          horarioFixoId: aulaSelecionada.horarioFixoId,
          dataOriginal: aulaSelecionada.dataStr,
          novaData: horarioDestino.dataStr,
          novoHorarioFixoId: horarioDestino.horarioFixoId,
          motivo: motivoTroca || 'Solicitação de reagendamento pelo aluno'
        })
      });

      const data = await res.json();
      
      if (res.ok) {
        alert('Solicitação enviada! Aguarde a aprovação.');
        setAulaSelecionada(null);
        setHorarioDestino(null);
        setEtapaReagendamento('selecionar');
        fetchDados();
      } else {
        alert(data.error || 'Erro ao solicitar reagendamento');
      }
    } catch {
      alert('Erro ao enviar solicitação');
    } finally {
      setEnviando(false);
    }
  };

  // Avisar ausência de uma aula selecionada
  const avisarAusenciaAula = async () => {
    if (!aulaSelecionada || !ausenciaMotivo) {
      alert('Informe o motivo da ausência');
      return;
    }

    setEnviandoAusencia(true);
    try {
      const res = await fetch('/api/aluno/avisar-ausencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          horarioFixoId: aulaSelecionada.horarioFixoId,
          dataAusencia: aulaSelecionada.dataStr,
          motivo: ausenciaMotivo
        })
      });

      const data = await res.json();
      
      if (res.ok) {
        alert(data.message);
        setAulaSelecionada(null);
        setAusenciaMotivo('');
        fetchDados();
      } else {
        alert(data.error || 'Erro ao registrar ausência');
      }
    } catch {
      alert('Erro ao enviar aviso de ausência');
    } finally {
      setEnviandoAusencia(false);
    }
  };

  if (!aluno) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Logo size="sm" noLink />
          <div className="flex items-center gap-2">
            <button
              onClick={abrirModalPerfil}
              className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
              title="Meus Dados"
            >
              <i className="fas fa-user-cog"></i>
            </button>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Sair"
            >
              <i className="fas fa-sign-out-alt"></i>
            </button>
          </div>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="max-w-4xl mx-auto px-4 py-4">
        {/* Card de Boas Vindas */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-xl p-4 text-white mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <span className="text-lg font-bold">{aluno.nome.charAt(0).toUpperCase()}</span>
              </div>
              <div>
                <h1 className="text-lg font-bold">Olá, {aluno.nome.split(' ')[0]}!</h1>
                <p className="text-primary-100 text-xs">
                  {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
              </div>
            </div>
            
            {estatisticas && estatisticas.totalAulas > 0 && (
              <div className="text-right">
                <p className="text-2xl font-bold">{estatisticas.percentualPresenca}%</p>
                <p className="text-xs text-primary-100">frequência</p>
              </div>
            )}
          </div>
          
          {(aluno.congelado || aluno.ausente || aluno.emEspera) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {aluno.congelado && (
                <span className="px-2 py-1 bg-blue-500/30 text-white text-xs font-medium rounded-full">
                  <i className="fas fa-snowflake mr-1"></i> Congelado
                </span>
              )}
              {aluno.ausente && (
                <span className="px-2 py-1 bg-red-500/30 text-white text-xs font-medium rounded-full">
                  <i className="fas fa-user-slash mr-1"></i> Ausente
                </span>
              )}
              {aluno.emEspera && (
                <span className="px-2 py-1 bg-yellow-500/30 text-white text-xs font-medium rounded-full">
                  <i className="fas fa-clock mr-1"></i> Em Espera
                </span>
              )}
            </div>
          )}
        </div>

        {/* Avisos importantes */}
        {avisos.length > 0 && (
          <div className="mb-4 space-y-2">
            {avisos.map(aviso => {
              const badge = getTipoAvisoBadge(aviso.tipo);
              return (
                <div
                  key={aviso._id}
                  className={`${badge.bg} rounded-xl p-4 ${badge.text}`}
                >
                  <div className="flex items-start gap-3">
                    <i className={`${badge.icon} text-xl mt-0.5`}></i>
                    <div className="flex-1">
                      <h3 className="font-bold">{aviso.titulo}</h3>
                      <p className="text-sm opacity-90 mt-1">{aviso.mensagem}</p>
                      <p className="text-xs opacity-75 mt-2">
                        <i className="fas fa-calendar-alt mr-1"></i>
                        {formatarData(aviso.dataInicio)}
                        {aviso.dataInicio !== aviso.dataFim && ` até ${formatarData(aviso.dataFim)}`}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Card de status do dia */}
        <div className={`rounded-xl p-4 mb-4 ${
          temCancelamentoHoje 
            ? 'bg-red-50 border-2 border-red-200' 
            : aulasHoje.length > 0 
              ? 'bg-green-50 border border-green-200'
              : 'bg-gray-100 border border-gray-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              temCancelamentoHoje 
                ? 'bg-red-500 text-white' 
                : aulasHoje.length > 0 
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-400 text-white'
            }`}>
              <i className={`fas ${
                temCancelamentoHoje 
                  ? 'fa-times' 
                  : aulasHoje.length > 0 
                    ? 'fa-check'
                    : 'fa-minus'
              } text-xl`}></i>
            </div>
            <div className="flex-1">
              <h3 className={`font-bold ${
                temCancelamentoHoje ? 'text-red-700' : aulasHoje.length > 0 ? 'text-green-700' : 'text-gray-700'
              }`}>
                {temCancelamentoHoje 
                  ? 'Aulas Canceladas Hoje!' 
                  : aulasHoje.length > 0 
                    ? `Você tem ${aulasHoje.length} aula${aulasHoje.length > 1 ? 's' : ''} hoje`
                    : 'Sem aulas hoje'
                }
              </h3>
              {!temCancelamentoHoje && aulasHoje.length > 0 && (
                <div className="text-sm text-green-600">
                  {aulasHoje.map((a, idx) => (
                    <span key={a._id}>
                      {idx > 0 && ' • '}
                      {a.horarioInicio}{a.professorId ? ` (${a.professorId.nome})` : ''}
                    </span>
                  ))}
                </div>
              )}
              {temCancelamentoHoje && (
                <p className="text-sm text-red-600">Verifique os avisos acima</p>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          <>
            {/* Abas */}
            <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg overflow-x-auto">
              <button
                onClick={() => setAbaAtiva('hoje')}
                className={`flex-1 min-w-0 px-2 py-2 text-xs font-medium rounded-md transition-colors ${
                  abaAtiva === 'hoje' 
                    ? 'bg-white text-primary-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <i className="fas fa-home mr-1"></i>Início
              </button>
              <button
                onClick={() => setAbaAtiva('calendario')}
                className={`flex-1 min-w-0 px-2 py-2 text-xs font-medium rounded-md transition-colors ${
                  abaAtiva === 'calendario' 
                    ? 'bg-white text-primary-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <i className="fas fa-calendar-alt mr-1"></i>Calendário
              </button>
              <button
                onClick={() => setAbaAtiva('faltas')}
                className={`flex-1 min-w-0 px-2 py-2 text-xs font-medium rounded-md transition-colors relative ${
                  abaAtiva === 'faltas' 
                    ? 'bg-white text-primary-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <i className="fas fa-user-clock mr-1"></i>Faltas
                {reposicoesDisponiveis > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 text-white text-xs rounded-full flex items-center justify-center">
                    {reposicoesDisponiveis}
                  </span>
                )}
              </button>
              <button
                onClick={() => setAbaAtiva('reagendamentos')}
                className={`flex-1 min-w-0 px-2 py-2 text-xs font-medium rounded-md transition-colors relative ${
                  abaAtiva === 'reagendamentos' 
                    ? 'bg-white text-primary-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <i className="fas fa-exchange-alt mr-1"></i>Reposições
                {reagendamentos.filter(r => r.status === 'pendente').length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-500 text-white text-xs rounded-full flex items-center justify-center">
                    {reagendamentos.filter(r => r.status === 'pendente').length}
                  </span>
                )}
              </button>
            </div>

            {/* Aba Início */}
            {abaAtiva === 'hoje' && (
              <div className="space-y-4">
                {/* Próximas aulas */}
                <section>
                  <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">
                    Próximas Aulas
                  </h2>
                  {proximasAulas.length === 0 ? (
                    <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
                      <i className="fas fa-calendar-times text-gray-300 text-3xl mb-2"></i>
                      <p className="text-gray-500 text-sm">Nenhum horário cadastrado</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {proximasAulas.map((aula, idx) => (
                        <div
                          key={aula._id}
                          className={`bg-white rounded-xl border p-4 flex items-center gap-4 ${
                            idx === 0 ? 'border-primary-200 bg-primary-50/30' : 'border-gray-200'
                          }`}
                        >
                          <div 
                            className="w-14 h-14 rounded-lg flex flex-col items-center justify-center text-white font-bold"
                            style={{ backgroundColor: aula.modalidadeId?.cor || '#6B7280' }}
                          >
                            <span className="text-xs">{diasSemanaAbrev[aula.diaSemana]}</span>
                            <span className="text-lg">{aula.dataAula.getDate()}</span>
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900">
                              {diasSemana[aula.diaSemana]}
                              {aula.diasAte === 0 && (
                                <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">Hoje</span>
                              )}
                              {aula.diasAte === 1 && (
                                <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">Amanhã</span>
                              )}
                            </p>
                            <p className="text-sm text-gray-500">{aula.horarioInicio} - {aula.horarioFim}</p>
                            {aula.modalidadeId && (
                              <span 
                                className="inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded text-white"
                                style={{ backgroundColor: aula.modalidadeId.cor || '#6B7280' }}
                              >
                                {aula.modalidadeId.nome}
                              </span>
                            )}
                            {aula.professorId && (
                              <p className="text-xs text-gray-500 mt-1">
                                <i className="fas fa-user-tie mr-1"></i>Prof. {aula.professorId.nome}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Histórico resumido */}
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide">
                      Últimas Presenças
                    </h2>
                    {presencas.length > 0 && (
                      <button
                        onClick={() => setShowHistoricoModal(true)}
                        className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                      >
                        Ver tudo <i className="fas fa-arrow-right ml-1"></i>
                      </button>
                    )}
                  </div>
                  
                  {presencas.length === 0 ? (
                    <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
                      <i className="fas fa-clipboard-list text-gray-300 text-3xl mb-2"></i>
                      <p className="text-gray-500 text-sm">Nenhum registro ainda</p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      {presencas.slice(0, 5).map((p, idx) => (
                        <div 
                          key={p._id}
                          className={`flex items-center gap-3 p-3 ${idx !== 0 ? 'border-t border-gray-100' : ''}`}
                        >
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            p.presente === true ? 'bg-green-100 text-green-600' :
                            p.presente === false ? 'bg-red-100 text-red-600' :
                            'bg-gray-100 text-gray-400'
                          }`}>
                            <i className={`fas ${
                              p.presente === true ? 'fa-check' :
                              p.presente === false ? 'fa-times' :
                              'fa-minus'
                            }`}></i>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {formatarData(p.data)} - {p.horarioInicio}
                            </p>
                            <p className="text-xs text-gray-500">{p.modalidade}</p>
                          </div>
                          {p.eraReagendamento && (
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                              Reposição
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Estatísticas */}
                  {estatisticas && estatisticas.totalAulas > 0 && (
                    <div className="grid grid-cols-4 gap-2 mt-3">
                      <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
                        <p className="text-lg font-bold text-gray-900">{estatisticas.totalAulas}</p>
                        <p className="text-xs text-gray-500">Total</p>
                      </div>
                      <div className="bg-green-50 rounded-lg border border-green-200 p-3 text-center">
                        <p className="text-lg font-bold text-green-600">{estatisticas.presencas}</p>
                        <p className="text-xs text-green-600">Presenças</p>
                      </div>
                      <div className="bg-red-50 rounded-lg border border-red-200 p-3 text-center">
                        <p className="text-lg font-bold text-red-600">{estatisticas.faltas}</p>
                        <p className="text-xs text-red-600">Faltas</p>
                      </div>
                      <div className="bg-purple-50 rounded-lg border border-purple-200 p-3 text-center">
                        <p className="text-lg font-bold text-purple-600">{estatisticas.reagendamentos}</p>
                        <p className="text-xs text-purple-600">Reposições</p>
                      </div>
                    </div>
                  )}
                </section>

                {/* Contato */}
                <section className="mt-4">
                  <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <i className="fab fa-whatsapp text-green-600 text-xl"></i>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Precisa de ajuda?</p>
                        <p className="text-xs text-gray-500">Fale pelo WhatsApp</p>
                      </div>
                    </div>
                    {adminContact && (
                      <a
                        href={`https://wa.me/${adminContact.whatsapp}?text=${encodeURIComponent(`Olá! Sou ${aluno.nome}, aluno do Studio Superação.\n\n`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        Contato
                      </a>
                    )}
                  </div>
                </section>
              </div>
            )}

            {/* Aba Calendário - Visual */}
            {abaAtiva === 'calendario' && (
              <div className="space-y-4">
                {/* Navegação do calendário */}
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => {
                      if (calMes === 0) {
                        setCalMes(11);
                        setCalAno(calAno - 1);
                      } else {
                        setCalMes(calMes - 1);
                      }
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <i className="fas fa-chevron-left text-gray-600"></i>
                  </button>
                  
                  <h2 className="text-lg font-bold text-gray-900 capitalize">
                    {new Date(calAno, calMes).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                  </h2>
                  
                  <button
                    onClick={() => {
                      if (calMes === 11) {
                        setCalMes(0);
                        setCalAno(calAno + 1);
                      } else {
                        setCalMes(calMes + 1);
                      }
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <i className="fas fa-chevron-right text-gray-600"></i>
                  </button>
                </div>

                {/* Legenda */}
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-primary-500"></div>
                    <span>Sua aula</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                    <span>Sem aula</span>
                  </div>
                </div>

                {/* Dias da semana */}
                <div className="grid grid-cols-7 gap-1">
                  {diasSemanaAbrev.map((dia, idx) => (
                    <div key={idx} className="text-center text-xs font-semibold text-gray-500 py-2">
                      {dia}
                    </div>
                  ))}
                </div>

                {/* Grid do calendário */}
                <div className="grid grid-cols-7 gap-1">
                  {diasCalendario.map((diaObj, idx) => {
                    const hoje = new Date();
                    hoje.setHours(0, 0, 0, 0);
                    const isHoje = diaObj.data.toDateString() === hoje.toDateString();
                    const isPassado = diaObj.data < hoje;
                    const aulas = diaObj.mesAtual ? getAulasNoDia(diaObj.data) : [];
                    const temAula = aulas.length > 0;
                    
                    return (
                      <div
                        key={idx}
                        className={`
                          relative min-h-[60px] p-1 rounded-lg border transition-all
                          ${!diaObj.mesAtual ? 'bg-gray-50 opacity-40' : 'bg-white'}
                          ${isHoje ? 'ring-2 ring-primary-500 border-primary-500' : 'border-gray-200'}
                          ${isPassado && diaObj.mesAtual ? 'opacity-60' : ''}
                        `}
                      >
                        {/* Número do dia */}
                        <div className={`text-xs font-semibold ${isHoje ? 'text-primary-600' : 'text-gray-700'}`}>
                          {diaObj.diaDoMes}
                        </div>
                        
                        {/* Aulas do dia */}
                        {temAula && diaObj.mesAtual && !isPassado && (
                          <div className="mt-1 space-y-0.5">
                            {aulas.slice(0, 2).map((aula, aIdx) => (
                              <button
                                key={aIdx}
                                onClick={() => iniciarTrocaAula(aula)}
                                className="w-full text-left px-1 py-0.5 rounded text-[10px] font-medium text-white truncate hover:opacity-80 transition-opacity"
                                style={{ backgroundColor: aula.modalidade?.cor || '#6B7280' }}
                              >
                                {aula.horarioInicio}
                              </button>
                            ))}
                            {aulas.length > 2 && (
                              <div className="text-[9px] text-gray-500 text-center">
                                +{aulas.length - 2}
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Indicador de aula passada */}
                        {temAula && isPassado && diaObj.mesAtual && (
                          <div className="mt-1">
                            <div className="w-2 h-2 rounded-full bg-gray-300 mx-auto"></div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Dica */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
                  <p className="text-sm text-blue-700">
                    <i className="fas fa-info-circle mr-2"></i>
                    Clique em uma aula para <strong>avisar ausência</strong> ou <strong>trocar a data</strong>.
                  </p>
                </div>
              </div>
            )}

            {/* Aba Faltas e Reposições */}
            {abaAtiva === 'faltas' && (
              <div className="space-y-6">
                {/* Dica para usar o calendário */}
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-200 rounded-lg flex items-center justify-center flex-shrink-0">
                      <i className="fas fa-calendar-alt text-blue-600"></i>
                    </div>
                    <div>
                      <h3 className="font-bold text-blue-800">Vai faltar?</h3>
                      <p className="text-sm text-blue-600">
                        Acesse o <strong>Calendário</strong> e clique na aula para avisar sua ausência com antecedência
                      </p>
                    </div>
                  </div>
                </div>

                {/* Ausências pendentes (ainda não ocorreram) */}
                {avisosAusencia.filter(a => a.status === 'pendente').length > 0 && (
                  <section>
                    <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">
                      Ausências Agendadas
                    </h2>
                    <div className="space-y-2">
                      {avisosAusencia.filter(a => a.status === 'pendente').map(aviso => (
                        <div key={aviso._id} className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                                <i className="fas fa-calendar-times text-yellow-600"></i>
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900">
                                  {formatarData(aviso.dataAusencia)} - {aviso.horarioFixoId?.horarioInicio}
                                </p>
                                <p className="text-sm text-gray-500">{aviso.motivo}</p>
                                {aviso.temDireitoReposicao && (
                                  <p className="text-xs text-green-600 mt-1">
                                    <i className="fas fa-check-circle mr-1"></i>
                                    Terá direito a reposição
                                  </p>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => cancelarAvisoAusencia(aviso._id)}
                              className="text-red-500 hover:text-red-700 text-sm"
                              title="Cancelar - Vou comparecer"
                            >
                              <i className="fas fa-times"></i>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Faltas com direito a reposição */}
                {faltasComDireito.length > 0 && (
                  <section>
                    <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">
                      <i className="fas fa-redo text-green-500 mr-2"></i>
                      Reposições Disponíveis ({faltasComDireito.length})
                    </h2>
                    <div className="space-y-2">
                      {faltasComDireito.map(falta => (
                        <div key={falta._id} className="bg-green-50 border border-green-200 rounded-xl p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div 
                                className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
                                style={{ backgroundColor: falta.modalidade?.cor || '#10B981' }}
                              >
                                <i className="fas fa-redo"></i>
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900">
                                  Falta em {formatarData(falta.data)}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {falta.horarioInicio} - {falta.modalidade?.nome}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => abrirModalReposicao(falta)}
                              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg text-sm transition-colors"
                            >
                              Repor
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Faltas sem direito a reposição */}
                {faltasSemDireito.length > 0 && (
                  <section>
                    <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">
                      <i className="fas fa-times-circle text-red-400 mr-2"></i>
                      Faltas sem Reposição
                    </h2>
                    <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                      <p className="text-sm text-gray-500 mb-3">
                        Estas faltas não foram avisadas com antecedência e não geram direito a reposição.
                      </p>
                      <div className="space-y-2">
                        {faltasSemDireito.slice(0, 5).map(falta => (
                          <div key={falta._id} className="flex items-center gap-2 text-sm text-gray-600">
                            <i className="fas fa-times text-red-400"></i>
                            <span>{formatarData(falta.data)} - {falta.horarioInicio}</span>
                          </div>
                        ))}
                        {faltasSemDireito.length > 5 && (
                          <p className="text-xs text-gray-400">
                            E mais {faltasSemDireito.length - 5} falta(s)...
                          </p>
                        )}
                      </div>
                    </div>
                  </section>
                )}

                {/* Mensagem quando não há nada */}
                {faltasComDireito.length === 0 && faltasSemDireito.length === 0 && avisosAusencia.length === 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                    <i className="fas fa-check-circle text-green-400 text-4xl mb-3"></i>
                    <p className="text-gray-600 font-medium">Nenhuma falta registrada!</p>
                    <p className="text-gray-400 text-sm mt-1">Continue assim!</p>
                  </div>
                )}
              </div>
            )}

            {/* Aba Reagendamentos */}
            {abaAtiva === 'reagendamentos' && (
              <section>
                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">
                  Minhas Solicitações
                </h2>
                
                {reagendamentos.length === 0 ? (
                  <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                    <i className="fas fa-exchange-alt text-gray-300 text-4xl mb-3"></i>
                    <p className="text-gray-500">Nenhum reagendamento solicitado</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {reagendamentos.map(reag => (
                      <div
                        key={reag._id}
                        className="bg-white rounded-xl border border-gray-200 p-4"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <i className="fas fa-calendar text-gray-400"></i>
                            <p className="font-medium text-gray-900">
                              {formatarData(reag.dataOriginal)} → {formatarData(reag.novaData)}
                            </p>
                          </div>
                          {getStatusBadge(reag.status)}
                        </div>
                        <p className="text-sm text-gray-500">
                          <i className="fas fa-clock mr-1"></i>
                          {reag.novoHorarioInicio} - {reag.novoHorarioFim}
                        </p>
                        {reag.motivo && (
                          <p className="text-xs text-gray-400 mt-2">
                            <i className="fas fa-comment mr-1"></i> {reag.motivo}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </main>

      {/* Modal de Seleção de Aula (Calendário Visual) */}
      {aulaSelecionada && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full shadow-xl max-h-[90vh] overflow-y-auto">
            
            {/* Etapa: Selecionar ação */}
            {etapaReagendamento === 'selecionar' && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900">O que deseja fazer?</h3>
                  <button onClick={() => setAulaSelecionada(null)} className="text-gray-400 hover:text-gray-600">
                    <i className="fas fa-times"></i>
                  </button>
                </div>
                
                {/* Info da aula */}
                <div className="mb-6 p-4 rounded-lg border-2" style={{ borderColor: aulaSelecionada.modalidade?.cor || '#6B7280', backgroundColor: `${aulaSelecionada.modalidade?.cor}10` }}>
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: aulaSelecionada.modalidade?.cor || '#6B7280' }}
                    >
                      {diasSemanaAbrev[aulaSelecionada.diaSemana]}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">
                        {diasSemana[aulaSelecionada.diaSemana]}, {new Date(aulaSelecionada.dataStr + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}
                      </p>
                      <p className="text-sm text-gray-600">
                        {aulaSelecionada.horarioInicio} - {aulaSelecionada.horarioFim}
                      </p>
                      {aulaSelecionada.modalidade && (
                        <span 
                          className="inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded text-white"
                          style={{ backgroundColor: aulaSelecionada.modalidade.cor || '#6B7280' }}
                        >
                          {aulaSelecionada.modalidade.nome}
                        </span>
                      )}
                      {aulaSelecionada.professor && (
                        <p className="text-xs text-gray-500 mt-1">
                          <i className="fas fa-user-tie mr-1"></i>Prof. {aulaSelecionada.professor.nome}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Opções */}
                <div className="space-y-3">
                  <button
                    onClick={() => setEtapaReagendamento('destino')}
                    className="w-full p-4 rounded-xl border-2 border-primary-200 bg-primary-50 hover:bg-primary-100 transition-colors text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary-600 text-white flex items-center justify-center">
                        <i className="fas fa-exchange-alt text-lg"></i>
                      </div>
                      <div>
                        <p className="font-bold text-primary-900">Trocar Data</p>
                        <p className="text-sm text-primary-700">Escolher outro dia para esta aula</p>
                      </div>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => {
                      setAusenciaMotivo('');
                      setShowAvisarAusenciaModal(true);
                    }}
                    className="w-full p-4 rounded-xl border-2 border-yellow-200 bg-yellow-50 hover:bg-yellow-100 transition-colors text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-yellow-500 text-white flex items-center justify-center">
                        <i className="fas fa-bell text-lg"></i>
                      </div>
                      <div>
                        <p className="font-bold text-yellow-900">Avisar Ausência</p>
                        <p className="text-sm text-yellow-700">Vou faltar mas quero repor depois</p>
                      </div>
                    </div>
                  </button>
                </div>
              </>
            )}
            
            {/* Etapa: Escolher destino */}
            {etapaReagendamento === 'destino' && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setEtapaReagendamento('selecionar')}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <i className="fas fa-arrow-left text-gray-600"></i>
                    </button>
                    <h3 className="text-lg font-bold text-gray-900">Escolha a nova data</h3>
                  </div>
                  <button onClick={() => setAulaSelecionada(null)} className="text-gray-400 hover:text-gray-600">
                    <i className="fas fa-times"></i>
                  </button>
                </div>
                
                {/* Info da aula original */}
                <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm">
                  <p className="text-gray-600">
                    <strong>Trocando:</strong> {diasSemana[aulaSelecionada.diaSemana]}, {new Date(aulaSelecionada.dataStr + 'T12:00:00').toLocaleDateString('pt-BR')} às {aulaSelecionada.horarioInicio}
                  </p>
                </div>
                
                {/* Navegação do calendário destino */}
                <div className="flex items-center justify-between mb-3">
                  <button
                    onClick={() => {
                      if (destinoMes === 0) {
                        setDestinoMes(11);
                        setDestinoAno(destinoAno - 1);
                      } else {
                        setDestinoMes(destinoMes - 1);
                      }
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <i className="fas fa-chevron-left text-gray-600"></i>
                  </button>
                  
                  <h4 className="text-sm font-bold text-gray-900 capitalize">
                    {new Date(destinoAno, destinoMes).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                  </h4>
                  
                  <button
                    onClick={() => {
                      if (destinoMes === 11) {
                        setDestinoMes(0);
                        setDestinoAno(destinoAno + 1);
                      } else {
                        setDestinoMes(destinoMes + 1);
                      }
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <i className="fas fa-chevron-right text-gray-600"></i>
                  </button>
                </div>

                {/* Dias da semana */}
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {diasSemanaAbrev.map((dia, idx) => (
                    <div key={idx} className="text-center text-[10px] font-semibold text-gray-500 py-1">
                      {dia}
                    </div>
                  ))}
                </div>

                {/* Grid do calendário destino */}
                <div className="grid grid-cols-7 gap-1 mb-4">
                  {diasCalendarioDestino.map((diaObj, idx) => {
                    const hoje = new Date();
                    hoje.setHours(0, 0, 0, 0);
                    
                    // Calcular limite: a nova data deve ser entre a data da aula e 7 dias após
                    const dataOriginalDate = aulaSelecionada ? new Date(aulaSelecionada.dataStr + 'T12:00:00') : new Date();
                    dataOriginalDate.setHours(0, 0, 0, 0);
                    
                    const limiteMinimo = dataOriginalDate; // A partir da data da aula
                    const limiteMaximo = new Date(dataOriginalDate);
                    limiteMaximo.setDate(limiteMaximo.getDate() + 7);
                    
                    const diaObjDate = new Date(diaObj.data);
                    diaObjDate.setHours(0, 0, 0, 0);
                    
                    // Não permitir datas passadas (antes de hoje)
                    const isPassado = diaObjDate < hoje;
                    // Não permitir datas antes da aula selecionada
                    const isAntesDoLimite = diaObjDate < limiteMinimo;
                    // Não permitir datas mais de 7 dias após a aula
                    const isForaDoLimite = diaObjDate > limiteMaximo;
                    
                    const horariosDisp = diaObj.mesAtual && !isPassado && !isAntesDoLimite && !isForaDoLimite ? getHorariosDisponiveisNoDia(diaObj.data) : [];
                    const temHorario = horariosDisp.length > 0;
                    
                    return (
                      <div
                        key={idx}
                        className={`
                          min-h-[40px] p-1 rounded-lg border transition-all text-center
                          ${!diaObj.mesAtual ? 'bg-gray-50 opacity-40' : 'bg-white'}
                          ${(isPassado || isAntesDoLimite || isForaDoLimite) && diaObj.mesAtual ? 'opacity-40' : ''}
                          ${temHorario ? 'border-green-300 bg-green-50 cursor-pointer hover:bg-green-100' : 'border-gray-200'}
                        `}
                      >
                        <div className={`text-xs font-semibold ${temHorario ? 'text-green-700' : 'text-gray-500'}`}>
                          {diaObj.diaDoMes}
                        </div>
                        
                        {/* Horários disponíveis */}
                        {temHorario && (
                          <div className="mt-0.5 space-y-0.5">
                            {horariosDisp.slice(0, 2).map((h, hIdx) => (
                              <button
                                key={hIdx}
                                onClick={() => selecionarDestino(diaObj.data, h)}
                                className="w-full px-0.5 py-0.5 rounded text-[9px] font-medium bg-green-600 text-white hover:bg-green-700 transition-colors truncate"
                              >
                                {h.horarioInicio}
                              </button>
                            ))}
                            {horariosDisp.length > 2 && (
                              <div className="text-[8px] text-green-600">+{horariosDisp.length - 2}</div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                
                <div className="text-xs text-gray-500 text-center">
                  <i className="fas fa-info-circle mr-1"></i>
                  Escolha uma data até 7 dias após a aula selecionada. Dias verdes têm vagas.
                </div>
              </>
            )}
            
            {/* Etapa: Confirmar */}
            {etapaReagendamento === 'confirmar' && horarioDestino && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        setHorarioDestino(null);
                        setEtapaReagendamento('destino');
                      }}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <i className="fas fa-arrow-left text-gray-600"></i>
                    </button>
                    <h3 className="text-lg font-bold text-gray-900">Confirmar Troca</h3>
                  </div>
                  <button onClick={() => setAulaSelecionada(null)} className="text-gray-400 hover:text-gray-600">
                    <i className="fas fa-times"></i>
                  </button>
                </div>
                
                {/* Resumo da troca */}
                <div className="space-y-4 mb-6">
                  {/* De */}
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-xs font-semibold text-red-600 uppercase mb-2">
                      <i className="fas fa-times-circle mr-1"></i> Não vai comparecer
                    </p>
                    <p className="font-semibold text-gray-900">
                      {diasSemana[aulaSelecionada.diaSemana]}, {new Date(aulaSelecionada.dataStr + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}
                    </p>
                    <p className="text-sm text-gray-600">{aulaSelecionada.horarioInicio} - {aulaSelecionada.horarioFim}</p>
                    {aulaSelecionada.professor && (
                      <p className="text-xs text-gray-500 mt-1">Prof. {aulaSelecionada.professor.nome}</p>
                    )}
                  </div>
                  
                  <div className="flex justify-center">
                    <i className="fas fa-arrow-down text-primary-500 text-xl"></i>
                  </div>
                  
                  {/* Para */}
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-xs font-semibold text-green-600 uppercase mb-2">
                      <i className="fas fa-check-circle mr-1"></i> Nova data
                    </p>
                    <p className="font-semibold text-gray-900">
                      {diasSemana[horarioDestino.diaSemana]}, {new Date(horarioDestino.dataStr + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}
                    </p>
                    <p className="text-sm text-gray-600">{horarioDestino.horarioInicio} - {horarioDestino.horarioFim}</p>
                    {horarioDestino.professor && (
                      <p className="text-xs text-gray-500 mt-1">Prof. {horarioDestino.professor.nome}</p>
                    )}
                  </div>
                </div>
                
                {/* Motivo */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Motivo (opcional)
                  </label>
                  <textarea
                    value={motivoTroca}
                    onChange={e => setMotivoTroca(e.target.value)}
                    placeholder="Ex: Compromisso de trabalho..."
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 resize-none text-sm"
                  />
                </div>
                
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-yellow-700">
                    <i className="fas fa-info-circle mr-2"></i>
                    A solicitação será enviada para aprovação.
                  </p>
                </div>
                
                <div className="flex gap-3">
                  <button 
                    onClick={() => setAulaSelecionada(null)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmarReagendamentoVisual}
                    disabled={enviando}
                    className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg disabled:opacity-50"
                  >
                    {enviando ? <><i className="fas fa-spinner fa-spin mr-2"></i>Enviando...</> : 'Confirmar Troca'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal de Avisar Ausência (do calendário) */}
      {showAvisarAusenciaModal && aulaSelecionada && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Avisar Ausência</h3>
              <button onClick={() => {
                setShowAvisarAusenciaModal(false);
                setAulaSelecionada(null);
              }} className="text-gray-400 hover:text-gray-600">
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-blue-700">
                <i className="fas fa-info-circle mr-2"></i>
                Avise com pelo menos <strong>24 horas</strong> de antecedência para ter direito a reposição.
              </p>
            </div>
            
            {/* Info da aula */}
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="font-semibold text-gray-900">
                {diasSemana[aulaSelecionada.diaSemana]}, {new Date(aulaSelecionada.dataStr + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}
              </p>
              <p className="text-sm text-gray-600">{aulaSelecionada.horarioInicio} - {aulaSelecionada.horarioFim}</p>
              {aulaSelecionada.professor && (
                <p className="text-xs text-gray-500 mt-1">Prof. {aulaSelecionada.professor.nome}</p>
              )}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Motivo <span className="text-red-500">*</span>
              </label>
              <textarea
                value={ausenciaMotivo}
                onChange={e => setAusenciaMotivo(e.target.value)}
                placeholder="Ex: Consulta médica, viagem..."
                rows={2}
                maxLength={200}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => {
                  setShowAvisarAusenciaModal(false);
                  setAulaSelecionada(null);
                }} 
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button 
                onClick={avisarAusenciaAula} 
                disabled={enviandoAusencia || !ausenciaMotivo}
                className="flex-1 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white font-medium rounded-lg disabled:opacity-50"
              >
                {enviandoAusencia ? <><i className="fas fa-spinner fa-spin mr-2"></i>Enviando...</> : 'Confirmar Ausência'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Reagendamento */}
      {showReagendamentoModal && horarioSelecionado && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Solicitar Reposição</h3>
              <button onClick={() => setShowReagendamentoModal(false)} className="text-gray-400 hover:text-gray-600">
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                <strong>Aula:</strong> {diasSemana[horarioSelecionado.diaSemana]} - {horarioSelecionado.horarioInicio} às {horarioSelecionado.horarioFim}
              </p>
              {horarioSelecionado.professorId && (
                <p className="text-xs text-gray-500 mt-1">Prof. {horarioSelecionado.professorId.nome}</p>
              )}
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data que NÃO vai comparecer <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={dataOriginal}
                  onChange={e => setDataOriginal(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nova Data <span className="text-red-500">*</span>
                  <span className="text-xs text-gray-400 font-normal ml-1">(até 7 dias após a original)</span>
                </label>
                {(() => {
                  const hoje = new Date();
                  hoje.setHours(0, 0, 0, 0);
                  let minDate = hoje;
                  let maxDate = new Date(hoje);
                  maxDate.setDate(maxDate.getDate() + 30); // default 30 dias
                  
                  if (dataOriginal) {
                    const dataOrig = new Date(dataOriginal + 'T12:00:00');
                    dataOrig.setHours(0, 0, 0, 0);
                    maxDate = new Date(dataOrig);
                    maxDate.setDate(maxDate.getDate() + 7);
                    if (dataOrig > hoje) {
                      minDate = hoje;
                    }
                  }
                  
                  return (
                    <input
                      type="date"
                      value={novaData}
                      onChange={e => { setNovaData(e.target.value); setNovoHorarioId(''); }}
                      min={minDate.toISOString().split('T')[0]}
                      max={maxDate.toISOString().split('T')[0]}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  );
                })()}
              </div>

              {novaData && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Horário <span className="text-red-500">*</span>
                  </label>
                  {horariosParaDataSelecionada.length === 0 ? (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 text-sm">
                      <i className="fas fa-exclamation-triangle mr-2"></i>
                      Nenhum horário disponível nesta data.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {horariosParaDataSelecionada.map(h => (
                        <label
                          key={h._id}
                          className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                            novoHorarioId === h._id ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="novoHorario"
                            value={h._id}
                            checked={novoHorarioId === h._id}
                            onChange={e => setNovoHorarioId(e.target.value)}
                            className="text-primary-600"
                          />
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{h.horarioInicio} - {h.horarioFim}</p>
                            {h.professor && <p className="text-xs text-gray-500">Prof. {h.professor.nome}</p>}
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Motivo (opcional)</label>
                <textarea
                  value={motivo}
                  onChange={e => setMotivo(e.target.value)}
                  rows={2}
                  placeholder="Explique o motivo..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowReagendamentoModal(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50">
                Cancelar
              </button>
              <button
                onClick={enviarReagendamento}
                disabled={!dataOriginal || !novaData || !novoHorarioId || enviando}
                className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg disabled:opacity-50"
              >
                {enviando ? <><i className="fas fa-spinner fa-spin mr-2"></i>Enviando...</> : 'Solicitar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Perfil */}
      {showPerfilModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Meus Dados</h3>
              <button onClick={() => setShowPerfilModal(false)} className="text-gray-400 hover:text-gray-600">
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="mb-4 p-3 bg-primary-50 rounded-lg">
              <p className="text-sm text-primary-700">
                <i className="fas fa-info-circle mr-2"></i>
                Para alterar nome ou CPF, procure a recepção.
              </p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input type="text" value={aluno.nome} disabled className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={perfilForm.email}
                  onChange={e => setPerfilForm({ ...perfilForm, email: e.target.value })}
                  placeholder="seu@email.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                <input
                  type="tel"
                  value={perfilForm.telefone}
                  onChange={e => setPerfilForm({ ...perfilForm, telefone: e.target.value })}
                  placeholder="(11) 99999-9999"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Endereço</label>
                <input
                  type="text"
                  value={perfilForm.endereco}
                  onChange={e => setPerfilForm({ ...perfilForm, endereco: e.target.value })}
                  placeholder="Rua, número, bairro"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowPerfilModal(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={salvarPerfil} disabled={salvandoPerfil} className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg disabled:opacity-50">
                {salvandoPerfil ? <><i className="fas fa-spinner fa-spin mr-2"></i>Salvando...</> : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Histórico */}
      {showHistoricoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Histórico de Presenças</h3>
              <button onClick={() => setShowHistoricoModal(false)} className="text-gray-400 hover:text-gray-600">
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            {estatisticas && (
              <div className="grid grid-cols-4 gap-2 mb-4">
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-gray-900">{estatisticas.totalAulas}</p>
                  <p className="text-xs text-gray-500">Total</p>
                </div>
                <div className="bg-green-50 rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-green-600">{estatisticas.presencas}</p>
                  <p className="text-xs text-green-600">Presenças</p>
                </div>
                <div className="bg-red-50 rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-red-600">{estatisticas.faltas}</p>
                  <p className="text-xs text-red-600">Faltas</p>
                </div>
                <div className="bg-primary-50 rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-primary-600">{estatisticas.percentualPresenca}%</p>
                  <p className="text-xs text-primary-600">Frequência</p>
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              {presencas.map(p => (
                <div key={p._id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    p.presente === true ? 'bg-green-100 text-green-600' :
                    p.presente === false ? 'bg-red-100 text-red-600' :
                    'bg-gray-200 text-gray-400'
                  }`}>
                    <i className={`fas ${p.presente === true ? 'fa-check' : p.presente === false ? 'fa-times' : 'fa-minus'}`}></i>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{formatarDataCompleta(p.data)}</p>
                    <p className="text-sm text-gray-500">{p.horarioInicio} - {p.horarioFim} • {p.modalidade}</p>
                  </div>
                  <div className="text-right">
                    {p.presente === true && <span className="text-green-600 text-sm font-medium">Presente</span>}
                    {p.presente === false && <span className="text-red-600 text-sm font-medium">Falta</span>}
                    {p.eraReagendamento && <p className="text-xs text-purple-600">Reposição</p>}
                  </div>
                </div>
              ))}
            </div>
            
            <button onClick={() => setShowHistoricoModal(false)} className="w-full mt-4 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50">
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Modal de Solicitar Reposição */}
      {showReposicaoModal && faltaSelecionada && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Solicitar Reposição</h3>
              <button onClick={() => setShowReposicaoModal(false)} className="text-gray-400 hover:text-gray-600">
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <p className="text-sm text-gray-600">
                <strong>Falta em:</strong> {formatarData(faltaSelecionada.data)}
              </p>
              <p className="text-sm text-gray-500">
                {faltaSelecionada.horarioInicio} - {faltaSelecionada.modalidade?.nome}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data da reposição <span className="text-red-500">*</span>
                  <span className="text-xs text-gray-400 font-normal ml-1">(até 7 dias após a falta)</span>
                </label>
                {(() => {
                  const hoje = new Date();
                  hoje.setHours(0, 0, 0, 0);
                  const dataFalta = new Date(faltaSelecionada.data + 'T12:00:00');
                  dataFalta.setHours(0, 0, 0, 0);
                  const limiteMax = new Date(dataFalta);
                  limiteMax.setDate(limiteMax.getDate() + 7);
                  const minDate = hoje > dataFalta ? hoje : dataFalta;
                  return (
                    <input
                      type="date"
                      value={reposicaoNovaData}
                      onChange={e => {
                        setReposicaoNovaData(e.target.value);
                        setReposicaoNovoHorarioId('');
                      }}
                      min={minDate.toISOString().split('T')[0]}
                      max={limiteMax.toISOString().split('T')[0]}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  );
                })()}
              </div>

              {reposicaoNovaData && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Horário disponível <span className="text-red-500">*</span>
                  </label>
                  {horariosParaReposicao.length === 0 ? (
                    <p className="text-sm text-yellow-600 bg-yellow-50 p-3 rounded-lg">
                      <i className="fas fa-exclamation-triangle mr-2"></i>
                      Nenhum horário disponível neste dia. Tente outra data.
                    </p>
                  ) : (
                    <select
                      value={reposicaoNovoHorarioId}
                      onChange={e => setReposicaoNovoHorarioId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Selecione o horário...</option>
                      {horariosParaReposicao.map(h => (
                        <option key={h._id} value={h._id}>
                          {h.horarioInicio} - {h.horarioFim} • {h.modalidade?.nome} ({h.professor?.nome})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-4">
              <p className="text-sm text-yellow-700">
                <i className="fas fa-info-circle mr-2"></i>
                A reposição precisa ser aprovada pela administração.
              </p>
            </div>

            <div className="flex gap-3 mt-6">
              <button 
                onClick={() => setShowReposicaoModal(false)} 
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button 
                onClick={enviarSolicitacaoReposicao} 
                disabled={enviandoReposicao || !reposicaoNovoHorarioId}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg disabled:opacity-50"
              >
                {enviandoReposicao ? <><i className="fas fa-spinner fa-spin mr-2"></i>Enviando...</> : 'Solicitar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
