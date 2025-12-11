'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import Logo from '@/components/Logo';
import ReporFaltaModal from '@/components/ReporFaltaModal';
import UsarCreditoModal from '@/components/UsarCreditoModal';

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
    linkWhatsapp?: string;
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
    telefone?: string;
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
  horarioFixoId?: {
    _id: string;
    horarioInicio: string;
    horarioFim: string;
    diaSemana: number;
    modalidadeId?: { _id: string; nome: string; cor: string };
    professorId?: { _id: string; nome: string };
  };
  novoHorarioFixoId?: {
    _id: string;
    horarioInicio: string;
    horarioFim: string;
    diaSemana: number;
    modalidadeId?: { _id: string; nome: string; cor: string };
    professorId?: { _id: string; nome: string };
  };
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

interface CreditoReposicao {
  _id: string;
  quantidade: number;
  quantidadeUsada: number;
  motivo: string;
  validade: string;
  ativo: boolean;
  criadoEm: string;
  usos?: {
    _id: string;
    dataUso: string;
    agendamentoId?: {
      _id?: string;
      horarioInicio: string;
      horarioFim?: string;
      diaSemana?: number;
      modalidadeId?: { _id?: string; nome: string; cor?: string };
      professorId?: { _id?: string; nome: string };
    };
  }[];
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
    modalidadeId?: { _id: string; nome: string; cor: string; permiteReposicao?: boolean };
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
  modalidade?: { _id: string; nome: string; cor: string; permiteReposicao?: boolean };
  professorId?: { _id: string; nome: string }; // Referencia User
  temDireitoReposicao: boolean;
  motivo?: string;
  avisouComAntecedencia?: boolean;
}

interface AlteracaoHorario {
  _id: string;
  horarioAtualId: {
    _id: string;
    diaSemana: number;
    horarioInicio: string;
    horarioFim: string;
    modalidadeId?: { _id: string; nome: string; cor: string };
    professorId?: { _id: string; nome: string };
  };
  novoHorarioId: {
    _id: string;
    diaSemana: number;
    horarioInicio: string;
    horarioFim: string;
    modalidadeId?: { _id: string; nome: string; cor: string };
    professorId?: { _id: string; nome: string };
  };
  motivo?: string;
  motivoRejeicao?: string;
  status: 'pendente' | 'aprovado' | 'rejeitado';
  criadoEm: string;
}

// Interface para feriado/sem expediente
interface FeriadoInfo {
  data: string;
  nome: string;
  tipo: 'nacional' | 'municipal' | 'personalizado';
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
  // Flags de reagendamento
  eReagendamento?: boolean; // Esta aula é um reagendamento (nova data)
  reagendamentoId?: string; // ID do reagendamento relacionado
  foiReagendada?: boolean; // A aula original foi reagendada para outra data
  // Flag de uso de crédito
  eUsoCredito?: boolean; // Esta aula é um uso de crédito de reposição
  usoCreditoId?: string; // ID do uso de crédito
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
  const [showAlteracaoHorarioModal, setShowAlteracaoHorarioModal] = useState(false);
  const [showSuporteModal, setShowSuporteModal] = useState(false);
  const [showProfessorModal, setShowProfessorModal] = useState(false);
  
  // Configurações de WhatsApp
  const [whatsappSuporte, setWhatsappSuporte] = useState('');
  const [whatsappFinanceiro, setWhatsappFinanceiro] = useState('');
  
  // Mensagens de descanso (quando não tem aula)
  const [mensagensDescanso, setMensagensDescanso] = useState<string[]>([
    "Aproveite o dia para descansar.",
    "Dia de recuperação. Cuide-se!",
    "Sem compromissos hoje. Até a próxima!",
    "Dia livre. Nos vemos em breve!",
    "Descanse bem. Até a próxima aula!",
    "Aproveite seu dia de folga.",
    "Sem aulas programadas. Bom descanso!",
    "Dia de pausa. Recupere as energias.",
    "Nenhuma aula agendada. Até breve!",
    "Aproveite para relaxar. Nos vemos logo!"
  ]);
  const [mensagemDescansoHoje] = useState(() => Math.floor(Math.random() * 10));
  
  // Estados de créditos
  const [creditos, setCreditos] = useState<CreditoReposicao[]>([]);
  
  // Estados de ausência e reposição
  const [avisosAusencia, setAvisosAusencia] = useState<AvisoAusencia[]>([]);
  const [faltasComDireito, setFaltasComDireito] = useState<FaltaReposicao[]>([]);
  const [faltasSemDireito, setFaltasSemDireito] = useState<FaltaReposicao[]>([]);
  const [reposicoesDisponiveis, setReposicoesDisponiveis] = useState(0);
  const [alteracoesHorario, setAlteracoesHorario] = useState<AlteracaoHorario[]>([]);
  
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
  
  // Estados do modal de usar crédito
  const [showUsarCreditoModal, setShowUsarCreditoModal] = useState(false);
  const [creditoSelecionado, setCreditoSelecionado] = useState<CreditoReposicao | null>(null);
  const [creditoNovaData, setCreditoNovaData] = useState('');
  const [creditoHorarioId, setCreditoHorarioId] = useState('');
  const [enviandoCredito, setEnviandoCredito] = useState(false);
  
  // Estados do modal de alteração de horário fixo
  const [horarioParaAlterar, setHorarioParaAlterar] = useState<Horario | null>(null);
  const [novoHorarioFixoId, setNovoHorarioFixoId] = useState('');
  const [motivoAlteracao, setMotivoAlteracao] = useState('');
  const [enviandoAlteracao, setEnviandoAlteracao] = useState(false);
  
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
  const [abaAtiva, setAbaAtiva] = useState<'hoje' | 'calendario' | 'horarios' | 'faltas' | 'reagendamentos' | 'creditos'>('hoje');
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
  
  // Estados do calendário de presença
  const [presencaCalMes, setPresencaCalMes] = useState(() => new Date().getMonth());
  const [presencaCalAno, setPresencaCalAno] = useState(() => new Date().getFullYear());
  const [feriados, setFeriados] = useState<FeriadoInfo[]>([]);
  
  // Estado para banner do grupo WhatsApp
  const [jaEntrouGrupo, setJaEntrouGrupo] = useState(false);
  const [showConfirmGrupo, setShowConfirmGrupo] = useState(false);
  
  // Carregar estado de "já entrou no grupo" do localStorage
  useEffect(() => {
    const grupoKey = aluno?.modalidade?._id ? `jaEntrouGrupo_${aluno.modalidade._id}` : null;
    if (grupoKey) {
      const saved = localStorage.getItem(grupoKey);
      if (saved === 'true') {
        setJaEntrouGrupo(true);
      }
    }
  }, [aluno?.modalidade?._id]);
  
  const handleConfirmJaEntreiGrupo = () => {
    if (aluno?.modalidade?._id) {
      localStorage.setItem(`jaEntrouGrupo_${aluno.modalidade._id}`, 'true');
      setJaEntrouGrupo(true);
      setShowConfirmGrupo(false);
    }
  };

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

  // Buscar contato do admin e configurações de WhatsApp
  useEffect(() => {
    fetch('/api/public/admin-contact')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setAdminContact({ whatsapp: data.whatsapp, nome: data.nome });
        }
      })
      .catch(() => {});
    
    // Buscar configurações de WhatsApp (suporte e financeiro) e mensagens de descanso
    fetch('/api/configuracoes')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          const configs = data.data;
          const suporte = configs.find((c: any) => c.chave === 'whatsapp_suporte');
          const financeiro = configs.find((c: any) => c.chave === 'whatsapp_financeiro');
          const mensagens = configs.find((c: any) => c.chave === 'mensagens_descanso');
          if (suporte?.valor) setWhatsappSuporte(String(suporte.valor));
          if (financeiro?.valor) setWhatsappFinanceiro(String(financeiro.valor));
          if (mensagens?.valor) {
            try {
              const msgs = JSON.parse(mensagens.valor);
              if (Array.isArray(msgs) && msgs.length > 0) {
                setMensagensDescanso(msgs);
              }
            } catch {
              // mantém as mensagens default
            }
          }
        }
      })
      .catch(() => {});
  }, []);

  // Buscar feriados/sem expediente para o calendário de presenças
  useEffect(() => {
    const fetchFeriados = async () => {
      try {
        // Buscar feriados do banco de dados (sem expediente personalizados)
        const inicioAno = `${presencaCalAno}-01-01`;
        const fimAno = `${presencaCalAno}-12-31`;
        const res = await fetch(`/api/feriados?inicio=${inicioAno}&fim=${fimAno}`);
        
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            const feriadosPersonalizados: FeriadoInfo[] = json.data.map((f: any) => ({
              data: new Date(f.data).toISOString().split('T')[0],
              nome: f.motivo || 'Sem Expediente',
              tipo: 'personalizado' as const
            }));
            setFeriados(feriadosPersonalizados);
          }
        }
      } catch (err) {
        console.error('Erro ao buscar feriados:', err);
      }
    };
    
    fetchFeriados();
  }, [presencaCalAno]);

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

      // Buscar horários disponíveis (todos, para alteração de horário fixo)
      const dispRes = await fetch(`/api/aluno/horarios-disponiveis?todos=true`);
      if (dispRes.ok) {
        const data = await dispRes.json();
        setHorariosDisponiveis(data.horarios || []);
      }

      // Buscar avisos
      const avisosRes = await fetch(`/api/aluno/avisos`);
      if (avisosRes.ok) {
        const data = await avisosRes.json();
        setAvisos(data.avisos || []);
        setTemCancelamentoHoje(data.temCancelamentoHoje || false);
      }

      // Buscar histórico de presenças (limite maior para calendário)
      const presencasRes = await fetch(`/api/aluno/presencas?limite=100`);
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

      // Buscar créditos de reposição do aluno
      const creditosRes = await fetch(`/api/aluno/creditos`);
      if (creditosRes.ok) {
        const data = await creditosRes.json();
        setCreditos(data.creditos || []);
      }

      // Buscar solicitações de alteração de horário
      const alteracoesRes = await fetch(`/api/aluno/alterar-horario`);
      if (alteracoesRes.ok) {
        const data = await alteracoesRes.json();
        setAlteracoesHorario(data.solicitacoes || []);
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
      localStorage.removeItem('pwa-prompt-dismissed'); // Reset para mostrar prompt de instalação novamente
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

  // Calcular streak de treinos (dias consecutivos sem faltar injustificadamente)
  const streakData = useMemo(() => {
    if (horarios.length === 0) {
      return { streak: 0, proximosTreinos: [] as { diaSemana: number; diaMes: number; status: 'presente' | 'falta' | 'pendente' | 'justificado' | 'reagendado' | 'reposicao' | 'credito' }[] };
    }

    // Dias que o aluno treina (baseado nos horários fixos) - ordenados
    const diasQueTreina = [...new Set(horarios.map(h => h.diaSemana))].sort((a, b) => a - b);
    
    // Criar set de datas com ausência justificada (avisou com antecedência)
    const datasJustificadas = new Set(
      avisosAusencia
        .filter(a => a.status === 'confirmada' || a.status === 'usada')
        .map(a => a.dataAusencia.split('T')[0])
    );
    
    // Criar set de datas originais que foram reagendadas (não conta como falta)
    const datasReagendadas = new Set(
      reagendamentos
        .filter(r => r.status === 'aprovado')
        .map(r => r.dataOriginal.split('T')[0])
    );
    
    // Criar mapa de novas datas de reagendamento (para mostrar no calendário)
    const novasDatasReagendamento = new Map<string, boolean>();
    reagendamentos
      .filter(r => r.status === 'aprovado')
      .forEach(r => {
        const novaData = r.novaData.split('T')[0];
        novasDatasReagendamento.set(novaData, true);
      });
    
    // Criar mapa de datas de uso de crédito (aulas extras agendadas com crédito)
    const datasCredito = new Map<string, boolean>();
    creditos.forEach(c => {
      c.usos?.forEach(uso => {
        if (uso.dataUso) {
          const dataUso = uso.dataUso.split('T')[0];
          datasCredito.set(dataUso, true);
        }
      });
    });
    
    // Ordenar presenças por data (mais recente primeiro)
    const presencasOrdenadas = [...presencas]
      .filter(p => p.presente !== null) // Apenas aulas que já aconteceram
      .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
    
    // Calcular streak: quantos dias de treino consecutivos sem falta injustificada
    let streak = 0;
    for (const presenca of presencasOrdenadas) {
      const dataPresenca = presenca.data.split('T')[0];
      
      if (presenca.presente === true) {
        // Compareceu (incluindo reposições/reagendamentos)
        streak++;
      } else if (presenca.presente === false) {
        // Verificar se foi justificada ou reagendada
        if (datasJustificadas.has(dataPresenca) || datasReagendadas.has(dataPresenca)) {
          // Falta justificada ou reagendada - não quebra o streak, mas também não soma
          continue;
        }
        // Falta injustificada - quebra o streak
        break;
      }
    }

    // Buscar os próximos dias de treino (incluindo hoje se for dia de treino)
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    const proximosTreinos: { diaSemana: number; diaMes: number; status: 'presente' | 'falta' | 'pendente' | 'justificado' | 'reagendado' | 'reposicao' | 'credito'; data: Date }[] = [];
    
    // Coletar todas as datas relevantes: dias fixos + novas datas de reagendamento + datas de crédito
    const datasParaMostrar: Date[] = [];
    let datasVerificadas = 0;
    
    while (datasParaMostrar.length < 7 && datasVerificadas < 28) {
      const dataVerificar = new Date(hoje);
      dataVerificar.setDate(hoje.getDate() + datasVerificadas);
      const diaSemana = dataVerificar.getDay();
      const dataStr = dataVerificar.toISOString().split('T')[0];
      
      // Incluir se é dia fixo de treino OU se tem reagendamento OU se tem crédito usado para este dia
      if (diasQueTreina.includes(diaSemana) || novasDatasReagendamento.has(dataStr) || datasCredito.has(dataStr)) {
        datasParaMostrar.push(new Date(dataVerificar));
      }
      
      datasVerificadas++;
    }
    
    // Processar cada data
    for (const dataVerificar of datasParaMostrar) {
      const diaSemana = dataVerificar.getDay();
      const dataStr = dataVerificar.toISOString().split('T')[0];
      const presencaDoDia = presencas.find(p => p.data.startsWith(dataStr));
      
      let status: 'presente' | 'falta' | 'pendente' | 'justificado' | 'reagendado' | 'reposicao' | 'credito' = 'pendente';
      
      // É uma data de reposição/reagendamento (nova data)?
      const ehReposicao = novasDatasReagendamento.has(dataStr);
      // É uma data de aula com crédito?
      const ehCredito = datasCredito.has(dataStr);
      
      // Verificar se tem reagendamento aprovado SAINDO desta data (data original)
      if (datasReagendadas.has(dataStr)) {
        status = 'reagendado';
      } else if (datasJustificadas.has(dataStr)) {
        status = 'justificado';
      } else if (presencaDoDia && presencaDoDia.presente === true) {
        status = 'presente';
      } else if (presencaDoDia && presencaDoDia.presente === false) {
        status = 'falta';
      } else if (ehReposicao) {
        status = 'reposicao'; // Reposição agendada mas ainda não aconteceu
      } else if (ehCredito) {
        status = 'credito'; // Aula com crédito agendada mas ainda não aconteceu
      }
      
      proximosTreinos.push({
        diaSemana,
        diaMes: dataVerificar.getDate(),
        status,
        data: dataVerificar
      });
    }

    return { streak, proximosTreinos };
  }, [presencas, horarios, avisosAusencia, reagendamentos, creditos]);

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
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const isHoje = dataSelecionada.toDateString() === hoje.toDateString();
    
    return horariosDisponiveis.filter(h => {
      if (h.diaSemana !== diaSemana || !h.temVaga) return false;
      
      // Se é hoje, verificar se o horário ainda não passou (mínimo 15min de antecedência)
      if (isHoje) {
        const agora = new Date();
        const [hora, minuto] = h.horarioInicio.split(':').map(Number);
        const horaAula = new Date();
        horaAula.setHours(hora, minuto, 0, 0);
        
        const diffMs = horaAula.getTime() - agora.getTime();
        const diffMinutos = Math.floor(diffMs / (1000 * 60));
        
        if (diffMinutos < 15) return false;
      }
      
      return true;
    });
  }, [novaData, horariosDisponiveis]);

  const enviarReagendamento = async () => {
    if (!horarioSelecionado || !dataOriginal || !novaData || !novoHorarioId) {
      toast.warning('Preencha todos os campos obrigatórios');
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
        toast.success('Solicitação enviada! Aguarde a aprovação.');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Erro ao solicitar reagendamento');
      }
    } catch {
      toast.error('Erro ao enviar solicitação');
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
        toast.success('Dados atualizados com sucesso!');
      } else {
        toast.error(data.error || 'Erro ao atualizar dados');
      }
    } catch {
      toast.error('Erro ao salvar dados');
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
      toast.warning('Preencha todos os campos');
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
        toast.success(data.message);
        setShowAvisarAusenciaModal(false);
        fetchDados();
      } else {
        toast.error(data.error || 'Erro ao registrar ausência');
      }
    } catch {
      toast.error('Erro ao enviar aviso de ausência');
    } finally {
      setEnviandoAusencia(false);
    }
  };

  // Cancelar aviso de ausência
  const cancelarAvisoAusencia = async (avisoId: string, isConfirmada: boolean = false) => {
    const mensagemConfirmacao = isConfirmada 
      ? 'Tem certeza que deseja cancelar este aviso confirmado? (Ação para testes)'
      : 'Confirma que você vai comparecer a esta aula?';
    
    if (!confirm(mensagemConfirmacao)) return;
    
    try {
      const res = await fetch(`/api/aluno/avisar-ausencia?id=${avisoId}`, {
        method: 'DELETE'
      });

      const data = await res.json();
      
      if (res.ok) {
        toast.success(data.message);
        fetchDados();
      } else {
        toast.error(data.error || 'Erro ao cancelar aviso');
      }
    } catch {
      toast.error('Erro ao cancelar aviso');
    }
  };

  // Abrir modal de solicitar reposição
  const abrirModalReposicao = (falta: FaltaReposicao) => {
    setFaltaSelecionada(falta);
    setShowReposicaoModal(true);
  };

  // Enviar solicitação de reposição com o novo modal
  const enviarSolicitacaoReposicaoCalendario = async (novoHorarioId: string, novaData: string) => {
    if (!faltaSelecionada) return;

    try {
      const res = await fetch('/api/aluno/solicitar-reposicao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          faltaId: faltaSelecionada._id,
          tipoFalta: faltaSelecionada.tipo,
          novoHorarioFixoId: novoHorarioId,
          novaData: novaData
        })
      });

      const data = await res.json();
      
      if (res.ok) {
        toast.success(data.message);
        setShowReposicaoModal(false);
        setFaltaSelecionada(null);
        fetchDados();
      } else {
        toast.error(data.error || 'Erro ao solicitar reposição');
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Erro ao solicitar reposição:', error);
      throw error;
    }
  };

  // Abrir modal de usar crédito
  const abrirModalUsarCredito = (credito: CreditoReposicao) => {
    setCreditoSelecionado(credito);
    setCreditoNovaData('');
    setCreditoHorarioId('');
    setShowUsarCreditoModal(true);
  };

  // Enviar solicitação de uso de crédito
  const enviarUsarCredito = async () => {
    if (!creditoSelecionado || !creditoNovaData || !creditoHorarioId) {
      toast.warning('Selecione a data e horário para usar o crédito');
      return;
    }

    setEnviandoCredito(true);
    try {
      const res = await fetch('/api/aluno/usar-credito', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creditoId: creditoSelecionado._id,
          horarioDestinoId: creditoHorarioId,
          dataAula: creditoNovaData
        })
      });

      const data = await res.json();
      
      if (res.ok) {
        toast.success(data.message);
        setShowUsarCreditoModal(false);
        fetchDados();
      } else {
        toast.error(data.error || 'Erro ao usar crédito');
      }
    } catch {
      toast.error('Erro ao enviar solicitação');
    } finally {
      setEnviandoCredito(false);
    }
  };

  // Abrir modal de alteração de horário fixo
  const abrirModalAlteracaoHorario = (horario: Horario) => {
    setHorarioParaAlterar(horario);
    setNovoHorarioFixoId('');
    setMotivoAlteracao('');
    setShowAlteracaoHorarioModal(true);
  };

  // Enviar solicitação de alteração de horário fixo
  const enviarAlteracaoHorario = async () => {
    if (!horarioParaAlterar || !novoHorarioFixoId) {
      toast.warning('Selecione o novo horário');
      return;
    }

    setEnviandoAlteracao(true);
    try {
      const res = await fetch('/api/aluno/alterar-horario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          horarioAtualId: horarioParaAlterar._id,
          novoHorarioId: novoHorarioFixoId,
          motivo: motivoAlteracao || 'Solicitação de alteração de horário fixo'
        })
      });

      const data = await res.json();
      
      if (res.ok) {
        toast.success(data.message);
        setShowAlteracaoHorarioModal(false);
        fetchDados();
      } else {
        toast.error(data.error || 'Erro ao solicitar alteração');
      }
    } catch {
      toast.error('Erro ao enviar solicitação');
    } finally {
      setEnviandoAlteracao(false);
    }
  };

  // Cancelar solicitação de alteração de horário
  const cancelarAlteracaoHorario = async (solicitacaoId: string) => {
    if (!confirm('Deseja cancelar esta solicitação?')) return;
    
    try {
      const res = await fetch(`/api/aluno/alterar-horario?id=${solicitacaoId}`, {
        method: 'DELETE'
      });

      const data = await res.json();
      
      if (res.ok) {
        toast.success(data.message);
        fetchDados();
      } else {
        toast.error(data.error || 'Erro ao cancelar');
      }
    } catch {
      toast.error('Erro ao cancelar solicitação');
    }
  };

  // Horários disponíveis da mesma modalidade para alteração
  const horariosParaAlteracao = useMemo(() => {
    if (!horarioParaAlterar) return [];
    
    // Suporta tanto _id quanto id (a API pode retornar ambos)
    const modalidadeObj = horarioParaAlterar.modalidadeId;
    const modalidadeAtualId = (modalidadeObj?._id || (modalidadeObj as any)?.id)?.toString();
    
    if (!modalidadeAtualId) {
      console.log('[Alteração Horário] Modalidade atual não encontrada:', modalidadeObj);
      return [];
    }
    
    // Filtrar horários da mesma modalidade (exceto o atual) e com vaga
    const resultado = horariosDisponiveis.filter(h => {
      // Suporta tanto _id quanto id
      const modalidadeIdDisp = (h.modalidade?._id || (h.modalidade as any)?.id)?.toString();
      const horarioIdAtual = horarioParaAlterar._id?.toString();
      const horarioIdDisp = h._id?.toString();
      
      const modalidadeMatch = modalidadeIdDisp === modalidadeAtualId;
      const naoEhAtual = horarioIdDisp !== horarioIdAtual;
      const temVagaOk = h.temVaga === true;
      
      return modalidadeMatch && naoEhAtual && temVagaOk;
    });
    
    // Ordenar por dia da semana e depois por horário
    resultado.sort((a, b) => {
      // Primeiro por dia da semana (1=segunda, 2=terça, ..., 0=domingo no final)
      const diaA = a.diaSemana === 0 ? 7 : a.diaSemana;
      const diaB = b.diaSemana === 0 ? 7 : b.diaSemana;
      if (diaA !== diaB) return diaA - diaB;
      // Depois por horário
      return a.horarioInicio.localeCompare(b.horarioInicio);
    });
    
    return resultado;
  }, [horarioParaAlterar, horariosDisponiveis]);

  // Helper para verificar se um horário ainda pode ser usado hoje (pelo menos 15min de antecedência)
  const horarioPodeSerUsadoHoje = useCallback((horarioInicio: string): boolean => {
    const agora = new Date();
    const [hora, minuto] = horarioInicio.split(':').map(Number);
    const horaAula = new Date();
    horaAula.setHours(hora, minuto, 0, 0);
    
    const diffMs = horaAula.getTime() - agora.getTime();
    const diffMinutos = Math.floor(diffMs / (1000 * 60));
    
    return diffMinutos >= 15;
  }, []);

  // Filtrar horários disponíveis pelo dia da semana da data selecionada E mesma modalidade da falta
  const horariosParaReposicao = useMemo(() => {
    if (!reposicaoNovaData) return [];
    const dataReposicao = new Date(reposicaoNovaData + 'T12:00:00');
    const diaSemana = dataReposicao.getDay();
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const isHoje = dataReposicao.toDateString() === hoje.toDateString();
    
    return horariosDisponiveis.filter(h => {
      if (h.diaSemana !== diaSemana || !h.temVaga) return false;
      
      // Se é hoje, verificar se o horário ainda não passou
      if (isHoje && !horarioPodeSerUsadoHoje(h.horarioInicio)) return false;
      
      // Se tem falta selecionada, só mostrar horários da mesma modalidade
      if (faltaSelecionada?.modalidade?._id) {
        return h.modalidade?._id === faltaSelecionada.modalidade._id;
      }
      
      return true;
    });
  }, [reposicaoNovaData, horariosDisponiveis, faltaSelecionada, horarioPodeSerUsadoHoje]);

  // Filtrar horários disponíveis pelo dia da semana da data selecionada para uso de crédito
  const horariosParaCredito = useMemo(() => {
    if (!creditoNovaData) return [];
    const dataCredito = new Date(creditoNovaData + 'T12:00:00');
    const diaSemana = dataCredito.getDay();
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const isHoje = dataCredito.toDateString() === hoje.toDateString();
    
    return horariosDisponiveis.filter(h => {
      if (h.diaSemana !== diaSemana || !h.temVaga) return false;
      
      // Se é hoje, verificar se o horário ainda não passou
      if (isHoje && !horarioPodeSerUsadoHoje(h.horarioInicio)) return false;
      
      return true;
    });
  }, [creditoNovaData, horariosDisponiveis, horarioPodeSerUsadoHoje]);

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
    // Extrair apenas a parte da data (YYYY-MM-DD) e adicionar T12:00:00 para evitar problemas de fuso horário
    const apenasData = dataStr.split('T')[0];
    const data = new Date(apenasData + 'T12:00:00');
    return data.toLocaleDateString('pt-BR');
  };

  const formatarDataCompleta = (dataStr: string) => {
    // Extrair apenas a parte da data (YYYY-MM-DD) e adicionar T12:00:00 para evitar problemas de fuso horário
    const apenasData = dataStr.split('T')[0];
    const data = new Date(apenasData + 'T12:00:00');
    return data.toLocaleDateString('pt-BR', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long' 
    });
  };

  // Calendário de presença - dados do mês
  const calendarioPresenca = useMemo(() => {
    const primeiroDia = new Date(presencaCalAno, presencaCalMes, 1);
    const ultimoDia = new Date(presencaCalAno, presencaCalMes + 1, 0);
    const diasNoMes = ultimoDia.getDate();
    const primeiroDiaSemana = primeiroDia.getDay();
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    // Mapear presenças por data (aulas já realizadas)
    const presencasPorData: Record<string, { presente: boolean | null; count: number; reposicao: boolean }> = {};
    presencas.forEach(p => {
      const dataKey = p.data.split('T')[0];
      if (!presencasPorData[dataKey]) {
        presencasPorData[dataKey] = { presente: p.presente, count: 1, reposicao: p.eraReagendamento };
      } else {
        presencasPorData[dataKey].count++;
        // Se tiver mais de uma aula no dia, prioriza falta
        if (p.presente === false) {
          presencasPorData[dataKey].presente = false;
        }
      }
    });

    // Mapear feriados por data
    const feriadosPorData: Record<string, string> = {};
    feriados.forEach(f => {
      feriadosPorData[f.data] = f.nome;
    });

    // Verificar quais dias da semana o aluno tem aula (horários fixos)
    const diasSemanaComAula = new Set(horarios.map(h => h.diaSemana));
    
    // Mapear dias com reagendamentos aprovados futuros
    const diasComReagendamento = new Set<string>();
    reagendamentos
      .filter(r => r.status === 'aprovado' && r.novoHorarioFixoId)
      .forEach(r => {
        const novaDataStr = r.novaData.split('T')[0];
        const novaData = new Date(novaDataStr + 'T12:00:00');
        if (novaData >= hoje) {
          diasComReagendamento.add(novaDataStr);
        }
      });
    
    // Mapear dias com uso de crédito agendado
    const diasComCredito = new Set<string>();
    creditos.forEach(credito => {
      credito.usos?.forEach(uso => {
        if (uso.agendamentoId) {
          const dataUsoStr = uso.dataUso.split('T')[0];
          const dataUso = new Date(dataUsoStr + 'T12:00:00');
          if (dataUso >= hoje) {
            diasComCredito.add(dataUsoStr);
          }
        }
      });
    });
    
    const dias: { 
      data: Date; 
      diaDoMes: number; 
      mesAtual: boolean;
      presenca?: { presente: boolean | null; count: number; reposicao: boolean };
      temAulaFutura?: boolean;
      feriado?: string;
    }[] = [];
    
    // Dias do mês anterior
    for (let i = primeiroDiaSemana - 1; i >= 0; i--) {
      const data = new Date(presencaCalAno, presencaCalMes, -i);
      dias.push({ data, diaDoMes: data.getDate(), mesAtual: false });
    }
    
    // Dias do mês atual
    for (let d = 1; d <= diasNoMes; d++) {
      const data = new Date(presencaCalAno, presencaCalMes, d);
      data.setHours(0, 0, 0, 0);
      const dataKey = data.toISOString().split('T')[0];
      const diaSemana = data.getDay();
      const isFuturo = data >= hoje;
      
      // Verificar se tem aula neste dia (horário fixo OU reagendamento OU uso de crédito)
      const temAulaFixa = diasSemanaComAula.has(diaSemana);
      const temReagendamento = diasComReagendamento.has(dataKey);
      const temCredito = diasComCredito.has(dataKey);
      const temAulaFutura = isFuturo && (temAulaFixa || temReagendamento || temCredito);
      
      dias.push({ 
        data, 
        diaDoMes: d, 
        mesAtual: true,
        presenca: presencasPorData[dataKey],
        temAulaFutura,
        feriado: feriadosPorData[dataKey]
      });
    }
    
    // Preencher até completar 6 semanas
    const diasFaltando = 42 - dias.length;
    for (let i = 1; i <= diasFaltando; i++) {
      const data = new Date(presencaCalAno, presencaCalMes + 1, i);
      dias.push({ data, diaDoMes: i, mesAtual: false });
    }
    
    return dias;
  }, [presencaCalAno, presencaCalMes, presencas, horarios, feriados, reagendamentos, creditos]);

  // Estatísticas do mês do calendário de presença
  const estatisticasMes = useMemo(() => {
    const mesStr = `${presencaCalAno}-${String(presencaCalMes + 1).padStart(2, '0')}`;
    const presencasMes = presencas.filter(p => p.data.startsWith(mesStr));
    const presentes = presencasMes.filter(p => p.presente === true).length;
    const faltas = presencasMes.filter(p => p.presente === false).length;
    const reposicoes = presencasMes.filter(p => p.eraReagendamento).length;
    return { total: presencasMes.length, presentes, faltas, reposicoes };
  }, [presencaCalAno, presencaCalMes, presencas]);

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
    
    // Reagendamentos aprovados ou pendentes para marcar aulas
    const reagendamentosAtivos = reagendamentos.filter(r => 
      r.status === 'aprovado' || r.status === 'pendente'
    );
    
    // Criar mapa de datas originais reagendadas (horarioFixoId + dataOriginal)
    const datasReagendadas = new Set<string>();
    reagendamentosAtivos.forEach(r => {
      if (r.horarioFixoId?._id) {
        const dataOriginalStr = r.dataOriginal.split('T')[0];
        datasReagendadas.add(`${r.horarioFixoId._id}-${dataOriginalStr}`);
      }
    });
    
    for (let i = 0; i < 60; i++) {
      const data = new Date(hoje);
      data.setDate(hoje.getDate() + i);
      const diaSemana = data.getDay();
      
      // Verificar se tenho aula neste dia
      const horariosNoDia = horarios.filter(h => h.diaSemana === diaSemana);
      
      horariosNoDia.forEach(h => {
        const dataStr = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
        const chaveReagendamento = `${h._id}-${dataStr}`;
        
        // Verificar se esta aula foi reagendada
        const foiReagendada = datasReagendadas.has(chaveReagendamento);
        
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
          tipo: 'minha',
          foiReagendada
        });
      });
    }
    
    // Adicionar aulas de reagendamento aprovados (novas datas)
    reagendamentosAtivos
      .filter(r => r.status === 'aprovado' && r.novoHorarioFixoId)
      .forEach(r => {
        const novaDataStr = r.novaData.split('T')[0];
        const novaData = new Date(novaDataStr + 'T12:00:00');
        
        aulas.push({
          _id: `reag-${r._id}`,
          data: novaData,
          dataStr: novaDataStr,
          diaSemana: novaData.getDay(),
          horarioInicio: r.novoHorarioFixoId!.horarioInicio || r.novoHorarioInicio,
          horarioFim: r.novoHorarioFixoId!.horarioFim || r.novoHorarioFim,
          horarioFixoId: r.novoHorarioFixoId!._id,
          modalidade: r.novoHorarioFixoId!.modalidadeId,
          professor: r.novoHorarioFixoId!.professorId,
          tipo: 'minha',
          eReagendamento: true,
          reagendamentoId: r._id
        });
      });
    
    // Adicionar aulas de uso de crédito (reposições agendadas)
    creditos.forEach(credito => {
      credito.usos?.forEach(uso => {
        if (uso.agendamentoId) {
          const dataUsoStr = uso.dataUso.split('T')[0];
          const dataUso = new Date(dataUsoStr + 'T12:00:00');
          
          // Só adicionar se a data for futura ou hoje
          if (dataUso >= hoje) {
            aulas.push({
              _id: `credito-${uso._id}`,
              data: dataUso,
              dataStr: dataUsoStr,
              diaSemana: dataUso.getDay(),
              horarioInicio: uso.agendamentoId.horarioInicio,
              horarioFim: uso.agendamentoId.horarioFim || '',
              horarioFixoId: uso.agendamentoId._id || '',
              modalidade: uso.agendamentoId.modalidadeId ? {
                _id: uso.agendamentoId.modalidadeId._id || '',
                nome: uso.agendamentoId.modalidadeId.nome,
                cor: uso.agendamentoId.modalidadeId.cor || '#6B7280'
              } : undefined,
              professor: uso.agendamentoId.professorId ? {
                _id: uso.agendamentoId.professorId._id || '',
                nome: uso.agendamentoId.professorId.nome
              } : undefined,
              tipo: 'minha',
              eUsoCredito: true,
              usoCreditoId: uso._id
            });
          }
        }
      });
    });
    
    return aulas;
  }, [horarios, reagendamentos, creditos]);

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
    
    const isHoje = data.toDateString() === hoje.toDateString();
    
    // Filtrar por dia da semana, vaga disponível E mesma modalidade da aula selecionada
    return horariosDisponiveis.filter(h => {
      if (h.diaSemana !== diaSemana || !h.temVaga) return false;
      
      // Se é hoje, verificar se o horário ainda não passou (mínimo 15min de antecedência)
      if (isHoje) {
        const agora = new Date();
        const [hora, minuto] = h.horarioInicio.split(':').map(Number);
        const horaAula = new Date();
        horaAula.setHours(hora, minuto, 0, 0);
        
        const diffMs = horaAula.getTime() - agora.getTime();
        const diffMinutos = Math.floor(diffMs / (1000 * 60));
        
        if (diffMinutos < 15) return false;
      }
      
      // Se tem aula selecionada, só mostrar horários da mesma modalidade
      if (aulaSelecionada?.modalidade?._id) {
        return h.modalidade?._id === aulaSelecionada.modalidade._id;
      }
      
      return true;
    });
  }, [horariosDisponiveis, aulaSelecionada]);

  // Verificar se já existe aviso de ausência para esta aula nesta data
  const temAvisoAusencia = useCallback((aula: AulaCalendario): boolean => {
    return avisosAusencia.some(aviso => 
      aviso.status === 'pendente' && 
      aviso.horarioFixoId?._id === aula.horarioFixoId &&
      aviso.dataAusencia.split('T')[0] === aula.dataStr
    );
  }, [avisosAusencia]);

  // Verificar se a aula pode ser reagendada (mínimo 15 minutos de antecedência)
  const podeReagendarAula = useCallback((aula: AulaCalendario): { pode: boolean; motivo?: string; jaAvisou?: boolean; eReagendamento?: boolean; foiReagendada?: boolean; eUsoCredito?: boolean } => {
    // Verificar se é um uso de crédito - não pode reagendar
    if (aula.eUsoCredito) {
      return { 
        pode: false, 
        motivo: 'Esta é uma aula de reposição (crédito). Não pode ser reagendada.',
        eUsoCredito: true
      };
    }
    
    // Verificar se é um reagendamento (nova data) - não pode reagendar
    if (aula.eReagendamento) {
      return { 
        pode: false, 
        motivo: 'Esta é uma aula de reposição. Não pode ser reagendada.',
        eReagendamento: true
      };
    }
    
    // Verificar se a aula original foi reagendada para outra data
    if (aula.foiReagendada) {
      return { 
        pode: false, 
        motivo: 'Esta aula já foi reagendada para outra data.',
        foiReagendada: true
      };
    }
    
    // Verificar se já avisou ausência
    if (temAvisoAusencia(aula)) {
      return { 
        pode: false, 
        motivo: 'Você já avisou ausência para esta aula.',
        jaAvisou: true
      };
    }
    
    const agora = new Date();
    const [horaAula, minutoAula] = aula.horarioInicio.split(':').map(Number);
    const dataAula = new Date(aula.dataStr + 'T00:00:00');
    dataAula.setHours(horaAula, minutoAula, 0, 0);
    
    // Calcular diferença em minutos
    const diffMs = dataAula.getTime() - agora.getTime();
    const diffMinutos = Math.floor(diffMs / (1000 * 60));
    
    if (diffMinutos < 15) {
      return { 
        pode: false, 
        motivo: diffMinutos < 0 
          ? 'Esta aula já começou' 
          : `Faltam apenas ${diffMinutos} minutos para a aula. É necessário no mínimo 15 minutos de antecedência.`
      };
    }
    
    return { pode: true };
  }, [temAvisoAusencia]);

  // Abrir modal de troca de aula
  const iniciarTrocaAula = (aula: AulaCalendario) => {
    // Verificar antecedência mínima de 15 minutos
    const { pode, motivo } = podeReagendarAula(aula);
    if (!pode) {
      alert(motivo);
      return;
    }
    
    setAulaSelecionada(aula);
    setEtapaReagendamento('selecionar');
    setHorarioDestino(null);
    setMotivoTroca('');
  };

  // Verificar se uma data é válida para destino (não pode ser o mesmo dia da aula original)
  const podeEscolherDestino = useCallback((dataDestino: Date, aulaOriginal: AulaCalendario | null): boolean => {
    if (!aulaOriginal) return true;
    
    const dataOriginalStr = aulaOriginal.dataStr;
    const dataDestinoStr = `${dataDestino.getFullYear()}-${String(dataDestino.getMonth() + 1).padStart(2, '0')}-${String(dataDestino.getDate()).padStart(2, '0')}`;
    
    // Não pode reagendar para o mesmo dia
    return dataOriginalStr !== dataDestinoStr;
  }, []);

  // Selecionar horário de destino
  const selecionarDestino = (data: Date, horario: HorarioDisponivel) => {
    // Verificar se não é o mesmo dia
    if (!podeEscolherDestino(data, aulaSelecionada)) {
      alert('Não é possível reagendar para o mesmo dia. Escolha outro dia.');
      return;
    }
    
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
      <div className="min-h-screen bg-gray-50 pb-20">
        {/* Header Skeleton */}
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="w-24 h-8 bg-gray-200 rounded animate-pulse"></div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gray-200 rounded-lg animate-pulse"></div>
              <div className="w-8 h-8 bg-gray-200 rounded-lg animate-pulse"></div>
            </div>
          </div>
        </header>

        {/* Content Skeleton */}
        <main className="max-w-4xl mx-auto px-4 py-4 animate-pulse">
          {/* Saudação Skeleton */}
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="h-6 bg-gray-200 rounded w-36 mb-2"></div>
              <div className="h-4 bg-gray-100 rounded w-48"></div>
            </div>
            <div className="text-right">
              <div className="h-8 bg-gray-200 rounded w-16 mb-1"></div>
              <div className="h-3 bg-gray-100 rounded w-14"></div>
            </div>
          </div>

          {/* Card Status Skeleton */}
          <div className="rounded-xl p-4 mb-4 bg-gray-100 border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gray-300 rounded-full"></div>
              <div className="flex-1">
                <div className="h-5 bg-gray-300 rounded w-40 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-56"></div>
              </div>
            </div>
          </div>

          {/* Abas Skeleton */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex-1 py-4 px-2">
                <div className="w-6 h-6 bg-gray-300 rounded-full mx-auto mb-2"></div>
                <div className="h-3 bg-gray-300 rounded w-10 mx-auto"></div>
              </div>
            ))}
          </div>

          {/* Content Skeleton */}
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-3 flex items-center gap-3">
                <div className="w-14 h-14 bg-gray-200 rounded-lg"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-24"></div>
                  <div className="h-3 bg-gray-100 rounded w-32"></div>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Logo size="sm" noLink />
          <span className="text-base font-bold text-primary-600">
            {abaAtiva === 'hoje' && 'Início'}
            {abaAtiva === 'calendario' && 'Reagendar'}
            {abaAtiva === 'horarios' && 'Meu Horário'}
            {abaAtiva === 'faltas' && 'Reposições'}
            {abaAtiva === 'creditos' && 'Créditos'}
          </span>
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
        {/* Conteúdo exclusivo da aba Início */}
        {abaAtiva === 'hoje' && (
          <>
            {/* Saudação simples */}
            <div className="mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-800">Olá, {aluno.nome.split(' ')[0]}!</h1>
              <p className="text-gray-500 text-sm">
                {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
            
            {estatisticas && estatisticas.totalAulas > 0 && (
              <div className="text-right">
                <p className="text-2xl font-bold text-primary-600">{estatisticas.percentualPresenca}%</p>
                <p className="text-xs text-gray-500">frequência</p>
              </div>
            )}
          </div>
          
          {(aluno.congelado || aluno.ausente || aluno.emEspera) && (
            <div className="mt-2 flex flex-wrap gap-2">
              {aluno.congelado && (
                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                  <i className="fas fa-snowflake mr-1"></i> Congelado
                </span>
              )}
              {aluno.ausente && (
                <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                  <i className="fas fa-user-slash mr-1"></i> Ausente
                </span>
              )}
              {aluno.emEspera && (
                <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">
                  <i className="fas fa-clock mr-1"></i> Em Espera
                </span>
              )}
            </div>
          )}
        </div>

        {/* Card de Streak / Sequência de Treinos - OCULTO POR ENQUANTO */}
        {/* {horarios.length > 0 && (
          <div className="mb-4 bg-white rounded-xl px-4 py-3 border border-gray-200">
            {/* Header compacto */}
            {/* <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <i className={`fas fa-fire text-lg ${streakData.streak > 0 ? 'text-orange-500' : 'text-gray-300'}`}></i>
                <span className="text-sm font-medium text-gray-700">Sua Sequência</span>
              </div>
              <span className={`text-sm font-bold ${streakData.streak > 0 ? 'text-orange-500' : 'text-gray-400'}`}>
                {streakData.streak} {streakData.streak === 1 ? 'dia' : 'dias'}
              </span>
            </div>
            
            {/* Dias de treino em linha */}
            {/* <div className="flex justify-between">
              {streakData.proximosTreinos.map((item, idx) => (
                <div key={idx} className="flex flex-col items-center" title={
                  item.status === 'justificado' ? 'Falta justificada' :
                  item.status === 'reagendado' ? 'Aula reagendada para outro dia' :
                  item.status === 'reposicao' ? 'Reposição agendada' :
                  item.status === 'credito' ? 'Aula extra (crédito)' : ''
                }>
                  <span className="text-[10px] text-gray-400 mb-1">{diasSemanaAbrev[item.diaSemana]}</span>
                  {item.status === 'presente' ? (
                    <i className="fas fa-fire text-orange-500 text-base"></i>
                  ) : item.status === 'falta' ? (
                    <i className="fas fa-times text-red-400 text-base"></i>
                  ) : item.status === 'justificado' ? (
                    <i className="fas fa-user-clock text-blue-400 text-base"></i>
                  ) : item.status === 'reagendado' ? (
                    <i className="fas fa-arrow-right text-purple-400 text-base"></i>
                  ) : item.status === 'reposicao' ? (
                    <i className="fas fa-redo text-green-500 text-base"></i>
                  ) : item.status === 'credito' ? (
                    <i className="fas fa-star text-yellow-500 text-base"></i>
                  ) : (
                    <span className="text-gray-300 font-semibold text-sm">{item.diaMes}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )} */}

        {/* Banner WhatsApp do Grupo da Modalidade */}
        {aluno.modalidade?.linkWhatsapp && aluno.modalidade.linkWhatsapp.trim() !== '' && !jaEntrouGrupo && (
          <div className="mb-4">
            <div 
              className="rounded-xl shadow-lg p-4"
              style={{ 
                background: `linear-gradient(135deg, #25D366 0%, #25D366 60%, ${aluno.modalidade.cor || '#128C7E'} 100%)`
              }}
            >
              <style jsx>{`
                @keyframes shake-loop {
                  0%, 85%, 100% { transform: translateX(0); }
                  87%, 91%, 95% { transform: translateX(-3px); }
                  89%, 93%, 97% { transform: translateX(3px); }
                }
              `}</style>
              <div className="flex flex-col gap-3">
                {/* Título com ícone grande */}
                <div className="flex items-center gap-3">
                  <i className="fab fa-whatsapp text-white text-3xl"></i>
                  <div>
                    <h3 className="text-white font-bold text-base">Grupo do WhatsApp</h3>
                    <p className="text-white/80 text-xs">{aluno.modalidade.nome} • Avisos e comunicados</p>
                  </div>
                </div>
                
                {/* Botão de entrar */}
                <a 
                  href={aluno.modalidade.linkWhatsapp}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 bg-white hover:bg-gray-100 rounded-xl py-3 px-4 transition-colors font-bold text-sm shadow-lg w-full"
                  style={{ 
                    animation: 'shake-loop 4s ease-in-out infinite',
                    color: aluno.modalidade.cor || '#128C7E'
                  }}
                >
                  <i className="fab fa-whatsapp text-lg"></i>
                  <span>Entrar no Grupo</span>
                </a>
              </div>
              
              <button
                onClick={() => setShowConfirmGrupo(true)}
                className="w-full mt-3 text-center text-xs text-white/60 hover:text-white py-1 transition-colors border-t border-white/20 pt-3"
              >
                <i className="fas fa-check-circle mr-1"></i>
                Já entrei no grupo
              </button>
            </div>
          </div>
        )}

        {/* Modal de confirmação - Já entrei no grupo */}
        {showConfirmGrupo && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-2xl">
              <div className="text-center mb-4">
                <div className="bg-green-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3">
                  <i className="fab fa-whatsapp text-green-600 text-3xl"></i>
                </div>
                <h3 className="text-lg font-bold text-gray-800">Confirmar entrada no grupo</h3>
                <p className="text-gray-600 text-sm mt-2">
                  Você realmente já entrou no grupo do WhatsApp? Este aviso não aparecerá novamente.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmGrupo(false)}
                  className="flex-1 py-2.5 px-4 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmJaEntreiGrupo}
                  className="flex-1 py-2.5 px-4 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 transition-colors"
                >
                  Sim, já entrei
                </button>
              </div>
            </div>
          </div>
        )}

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
                    : 'fa-couch'
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
              {!temCancelamentoHoje && aulasHoje.length === 0 && (
                <p className="text-sm text-gray-500">{mensagensDescanso[mensagemDescansoHoje % mensagensDescanso.length]}</p>
              )}
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
          </>
        )}

        {loading ? (
          /* Skeleton Loading - Específico por aba */
          <div className="animate-pulse space-y-4">
            {/* Skeleton para Aba "Hoje" - Início */}
            {abaAtiva === 'hoje' && (
              <>
                {/* Próximas Aulas */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-4 h-4 bg-gray-200 rounded"></div>
                    <div className="h-4 bg-gray-200 rounded w-32"></div>
                  </div>
                  <div className="space-y-2">
                    {[1, 2].map(i => (
                      <div key={i} className="bg-white rounded-lg border border-gray-200 p-3 flex items-center gap-3">
                        <div className="w-14 h-14 bg-gray-200 rounded-lg flex-shrink-0"></div>
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-gray-200 rounded w-24"></div>
                          <div className="h-3 bg-gray-100 rounded w-32"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Calendário de presenças */}
                <div className="mt-6">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-4 h-4 bg-gray-200 rounded"></div>
                    <div className="h-4 bg-gray-200 rounded w-40"></div>
                  </div>
                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="grid grid-cols-7 gap-2">
                      {[...Array(21)].map((_, i) => (
                        <div key={i} className="aspect-square bg-gray-100 rounded"></div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Skeleton para Aba "Reagendar" */}
            {abaAtiva === 'calendario' && (
              <>
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="h-5 bg-gray-200 rounded w-48 mb-4"></div>
                  <div className="space-y-3">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                        <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-gray-200 rounded w-28"></div>
                          <div className="h-3 bg-gray-100 rounded w-20"></div>
                        </div>
                        <div className="w-20 h-8 bg-gray-200 rounded"></div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Skeleton para Aba "Meu Horário" */}
            {abaAtiva === 'horarios' && (
              <>
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="bg-white rounded-lg border border-gray-200 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="h-5 bg-gray-200 rounded w-24"></div>
                        <div className="w-16 h-6 bg-gray-200 rounded-full"></div>
                      </div>
                      <div className="space-y-2">
                        <div className="h-3 bg-gray-100 rounded w-full"></div>
                        <div className="h-3 bg-gray-100 rounded w-3/4"></div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Skeleton para Aba "Reposições" */}
            {abaAtiva === 'faltas' && (
              <>
                <div className="space-y-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="bg-white rounded-lg border border-gray-200 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 bg-gray-200 rounded-lg"></div>
                          <div className="space-y-1">
                            <div className="h-4 bg-gray-200 rounded w-32"></div>
                            <div className="h-3 bg-gray-100 rounded w-20"></div>
                          </div>
                        </div>
                        <div className="w-20 h-8 bg-gray-200 rounded"></div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <div className="h-3 bg-gray-100 rounded w-40"></div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Skeleton para Aba "Créditos" */}
            {abaAtiva === 'creditos' && (
              <>
                <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <div className="h-3 bg-gray-100 rounded w-24"></div>
                      <div className="h-6 bg-gray-200 rounded w-16"></div>
                    </div>
                    <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                  </div>
                </div>
                <div className="space-y-2">
                  {[1, 2].map(i => (
                    <div key={i} className="bg-white rounded-lg border border-gray-200 p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-gray-200 rounded w-28"></div>
                          <div className="h-3 bg-gray-100 rounded w-full"></div>
                          <div className="h-3 bg-gray-100 rounded w-2/3"></div>
                        </div>
                        <div className="w-20 h-8 bg-gray-200 rounded ml-3"></div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Conteúdo das abas */}

            {/* Aba Início - Continuação (Próximas Aulas e Calendário de Presenças) */}
            {abaAtiva === 'hoje' && (
              <div className="space-y-4">
                {/* Próximas aulas */}
                <section>
                  <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-2">
                    <i className="fas fa-clock mr-2 text-gray-400"></i>
                    Próximas Aulas
                  </h2>
                  {proximasAulas.length === 0 ? (
                    <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
                      <i className="fas fa-calendar-times text-gray-300 text-2xl mb-1"></i>
                      <p className="text-gray-500 text-xs">Nenhum horário cadastrado</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {proximasAulas.map((aula, idx) => (
                        <div
                          key={aula._id}
                          className={`bg-white rounded-lg border p-2.5 flex items-center gap-3 ${
                            idx === 0 ? 'border-primary-200 bg-primary-50/30' : 'border-gray-200'
                          }`}
                        >
                          <div 
                            className="w-10 h-10 rounded-md flex flex-col items-center justify-center text-white font-bold flex-shrink-0"
                            style={{ backgroundColor: aula.modalidadeId?.cor || '#6B7280' }}
                          >
                            <span className="text-[9px] leading-none">{diasSemanaAbrev[aula.diaSemana]}</span>
                            <span className="text-sm leading-none">{aula.dataAula.getDate()}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-sm text-gray-900 truncate">
                                {aula.horarioInicio} - {aula.horarioFim}
                              </span>
                              {aula.diasAte === 0 && (
                                <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] rounded-full flex-shrink-0">Hoje</span>
                              )}
                              {aula.diasAte === 1 && (
                                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded-full flex-shrink-0">Amanhã</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              {aula.modalidadeId && (
                                <span className="text-xs text-gray-600">{aula.modalidadeId.nome}</span>
                              )}
                              {aula.professorId && (
                                <>
                                  <span className="text-xs text-gray-400">• Prof. {aula.professorId.nome}</span>
                                  {aula.professorId.telefone && (
                                    <a
                                      href={`https://wa.me/${aula.professorId.telefone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá professor(a) ${aula.professorId.nome}! Sou ${aluno.nome}, aluno do Studio Superação.\n\n`)}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-green-600 hover:text-green-700 transition-colors"
                                      title="Falar com professor"
                                    >
                                      <i className="fab fa-whatsapp text-sm"></i>
                                    </a>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Calendário de Presença */}
                <section className="mt-8">
                  <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">
                    <i className="fas fa-calendar-check mr-2 text-gray-400"></i>
                    Calendário de Presenças
                  </h2>
                  
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    {/* Header do calendário */}
                    <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-primary-500 to-primary-600">
                      <button
                        onClick={() => {
                          if (presencaCalMes === 0) {
                            setPresencaCalMes(11);
                            setPresencaCalAno(presencaCalAno - 1);
                          } else {
                            setPresencaCalMes(presencaCalMes - 1);
                          }
                        }}
                        className="p-1.5 hover:bg-white/20 rounded-lg transition-colors text-white"
                      >
                        <i className="fas fa-chevron-left"></i>
                      </button>
                      
                      <h3 className="text-white font-bold capitalize">
                        {new Date(presencaCalAno, presencaCalMes).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                      </h3>
                      
                      <button
                        onClick={() => {
                          if (presencaCalMes === 11) {
                            setPresencaCalMes(0);
                            setPresencaCalAno(presencaCalAno + 1);
                          } else {
                            setPresencaCalMes(presencaCalMes + 1);
                          }
                        }}
                        className="p-1.5 hover:bg-white/20 rounded-lg transition-colors text-white"
                      >
                        <i className="fas fa-chevron-right"></i>
                      </button>
                    </div>

                    {/* Dias da semana */}
                    <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
                      {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((dia, i) => (
                        <div key={i} className="py-2 text-center text-xs font-semibold text-gray-500">
                          {dia}
                        </div>
                      ))}
                    </div>

                    {/* Grid de dias */}
                    <div className="grid grid-cols-7">
                      {calendarioPresenca.map((dia, idx) => {
                        const hoje = new Date();
                        hoje.setHours(0, 0, 0, 0);
                        const isHoje = dia.data.toDateString() === hoje.toDateString();
                        const isFalta = dia.mesAtual && dia.presenca?.presente === false;
                        const isPresente = dia.mesAtual && dia.presenca?.presente === true;
                        const isFeriado = dia.mesAtual && dia.feriado;
                        const temAulaFutura = dia.mesAtual && !dia.presenca && dia.temAulaFutura && !isFeriado;
                        
                        return (
                          <div
                            key={idx}
                            className={`relative aspect-square flex items-center justify-center border-b border-r border-gray-100 ${
                              !dia.mesAtual ? 'bg-gray-100' :
                              isFeriado ? 'bg-gray-200' :
                              isPresente ? 'bg-green-100' :
                              isFalta ? 'bg-red-100' :
                              temAulaFutura ? 'bg-blue-50' : ''
                            }`}
                            title={dia.feriado || undefined}
                          >
                            {/* Número do dia */}
                            <span className={`text-sm flex items-center justify-center w-7 h-7 rounded-full ${
                              isHoje && dia.mesAtual 
                                ? 'bg-green-500 text-white font-bold shadow-sm' 
                                : !dia.mesAtual
                                  ? 'text-gray-300'
                                  : isFeriado
                                    ? 'text-gray-500 font-medium'
                                    : isPresente
                                      ? 'text-green-700 font-medium'
                                      : isFalta 
                                        ? 'text-red-700 font-medium'
                                        : temAulaFutura
                                          ? 'text-blue-600 font-medium'
                                          : 'text-gray-700'
                            }`}>
                              {dia.diaDoMes}
                            </span>
                            
                            {/* Ícone de feriado/sem expediente centralizado embaixo */}
                            {isFeriado && (
                              <span className="absolute bottom-1 left-1/2 -translate-x-1/2">
                                <i className="fas fa-ban text-gray-500 text-[10px]"></i>
                              </span>
                            )}
                            
                            {/* Ícone de presença (check) centralizado embaixo */}
                            {isPresente && !isHoje && !isFeriado && (
                              <span className="absolute bottom-1 left-1/2 -translate-x-1/2">
                                <i className="fas fa-check text-green-600 text-[10px]"></i>
                              </span>
                            )}
                            
                            {/* Ícone de falta (X) centralizado embaixo */}
                            {isFalta && !isFeriado && (
                              <span className="absolute bottom-1 left-1/2 -translate-x-1/2">
                                <i className="fas fa-times text-red-600 text-[10px]"></i>
                              </span>
                            )}
                            
                            {/* Ícone de relógio para aula futura */}
                            {temAulaFutura && (
                              <span className="absolute bottom-1 left-1/2 -translate-x-1/2">
                                <i className="fas fa-clock text-blue-500 text-[10px]"></i>
                              </span>
                            )}
                            
                            {/* Indicador de reposição */}
                            {dia.presenca?.reposicao && (
                              <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-purple-500 rounded-full"></span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Legenda e estatísticas do mês */}
                    <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        <div className="flex items-center gap-1">
                          <i className="fas fa-check text-green-600 text-[10px]"></i>
                          <span className="text-gray-600">Presente</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <i className="fas fa-times text-red-600 text-[10px]"></i>
                          <span className="text-gray-600">Falta</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <i className="fas fa-clock text-blue-500 text-[10px]"></i>
                          <span className="text-gray-600">Aula agendada</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <i className="fas fa-ban text-gray-500 text-[10px]"></i>
                          <span className="text-gray-600">Sem expediente</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                          <span className="text-gray-600">Reposição</span>
                        </div>
                      </div>
                      
                      {estatisticasMes.total > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-200 flex items-center justify-between">
                          <span className="text-xs text-gray-500">
                            Este mês: <span className="font-semibold text-green-600">{estatisticasMes.presentes}</span> presenças, 
                            <span className="font-semibold text-red-600 ml-1">{estatisticasMes.faltas}</span> faltas
                          </span>
                          {estatisticasMes.total > 0 && (
                            <span className={`text-sm font-bold ${
                              (estatisticasMes.presentes / estatisticasMes.total) >= 0.8 ? 'text-green-600' :
                              (estatisticasMes.presentes / estatisticasMes.total) >= 0.5 ? 'text-yellow-600' :
                              'text-red-600'
                            }`}>
                              {Math.round((estatisticasMes.presentes / estatisticasMes.total) * 100)}%
                            </span>
                          )}
                        </div>
                      )}
                      
                      {/* Mensagem motivacional */}
                      {estatisticasMes.total > 0 && (
                        <div className={`mt-2 p-2 rounded-lg text-xs text-center ${
                          (estatisticasMes.presentes / estatisticasMes.total) >= 0.8 
                            ? 'bg-green-100 text-green-700' 
                            : (estatisticasMes.presentes / estatisticasMes.total) >= 0.5 
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-red-100 text-red-700'
                        }`}>
                          {(estatisticasMes.presentes / estatisticasMes.total) >= 0.8 ? (
                            <>🎉 Excelente frequência! Continue assim!</>
                          ) : (estatisticasMes.presentes / estatisticasMes.total) >= 0.5 ? (
                            <>💪 Você está indo bem! Tente não faltar nas próximas aulas!</>
                          ) : (
                            <>⚠️ Sua frequência está baixa. Cada aula conta para seu progresso!</>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                {/* Contato */}
                <section className="mt-8">
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <i className="fab fa-whatsapp text-green-600 text-xl"></i>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Precisa de ajuda?</p>
                        <p className="text-xs text-gray-500">Fale pelo WhatsApp</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowSuporteModal(true)}
                        className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors text-center"
                      >
                        <i className="fas fa-headset mr-1.5"></i>
                        Suporte
                      </button>
                      {horarios.length > 0 && (
                        <button
                          onClick={() => setShowProfessorModal(true)}
                          className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors text-center"
                        >
                          <i className="fas fa-user-tie mr-1.5"></i>
                          Professor
                        </button>
                      )}
                    </div>
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
                        {temAula && diaObj.mesAtual && (
                          <div className="mt-1 space-y-0.5">
                            {aulas
                              .filter(aula => !aula.foiReagendada) // Não mostrar aulas que foram reagendadas
                              .slice(0, 2)
                              .map((aula, aIdx) => {
                              // Verificar se a aula pode ser reagendada (15min antecedência)
                              const { pode, jaAvisou, eReagendamento, foiReagendada, eUsoCredito } = podeReagendarAula(aula);
                              const bloqueada = jaAvisou || eReagendamento || foiReagendada || eUsoCredito;
                              
                              // Verificar se é uma aula fixa do aluno
                              const eAulaFixa = aula.tipo === 'minha' && !eReagendamento && !eUsoCredito;
                              
                              // Determinar estilo e ícone baseado no estado
                              let bgColor = aula.modalidade?.cor || '#6B7280';
                              let icone = '';
                              let titulo = pode ? `${aula.horarioInicio} - Clique para reagendar` : 'Aula já passou ou muito próxima';
                              let aplicarGrayscale = !eAulaFixa; // Aplicar grayscale se não for aula fixa
                              
                              if (eUsoCredito) {
                                bgColor = '#8B5CF6'; // Roxo - uso de crédito
                                icone = 'fas fa-ticket-alt';
                                titulo = 'Reposição com crédito';
                              } else if (eReagendamento) {
                                bgColor = '#10B981'; // Verde - reposição
                                icone = 'fas fa-sync-alt';
                                titulo = 'Aula de reposição';
                              } else if (jaAvisou) {
                                bgColor = '#F59E0B'; // Amarelo - avisou ausência
                                icone = 'fas fa-bell';
                                titulo = 'Ausência já avisada';
                              }
                              
                              return (
                                <button
                                  key={aIdx}
                                  onClick={() => !bloqueada && eAulaFixa && iniciarTrocaAula(aula)}
                                  disabled={bloqueada || !eAulaFixa}
                                  className={`w-full text-left px-1 py-0.5 rounded text-[10px] font-medium truncate transition-opacity text-white ${
                                    bloqueada || !eAulaFixa ? 'cursor-not-allowed' : pode ? 'hover:opacity-80' : 'opacity-50 cursor-not-allowed'
                                  } ${aplicarGrayscale ? 'saturate-[0.7] opacity-60' : ''}`}
                                  style={{ backgroundColor: bgColor }}
                                  title={titulo}
                                >
                                  {icone ? <><i className={`${icone} mr-0.5`}></i>{aula.horarioInicio}</> : aula.horarioInicio}
                                </button>
                              );
                            })}
                            {aulas.filter(a => !a.foiReagendada).length > 2 && (
                              <div className="text-[9px] text-gray-500 text-center">
                                +{aulas.filter(a => !a.foiReagendada).length - 2}
                              </div>
                            )}
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

                {/* Legenda */}
                <div className="flex flex-wrap gap-3 mt-3 text-xs text-gray-600">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-green-500"></div>
                    <span>Reposição</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-purple-500"></div>
                    <span>Crédito</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-yellow-500"></div>
                    <span>Ausência avisada</span>
                  </div>
                </div>

                {/* Histórico de Reagendamentos */}
                <section className="mt-6">
                  <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">
                    <i className="fas fa-history mr-2"></i>Minhas Solicitações
                  </h2>
                  
                  {reagendamentos.length === 0 ? (
                    <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
                      <i className="fas fa-exchange-alt text-gray-300 text-3xl mb-2"></i>
                      <p className="text-gray-500 text-sm">Nenhum reagendamento solicitado</p>
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
              </div>
            )}

            {/* Aba Meus Horários */}
            {abaAtiva === 'horarios' && (
              <div className="space-y-6">
                {/* Meus horários fixos */}
                <section>
                  <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">
                    <i className="fas fa-clock mr-2"></i>Meus Horários Fixos
                  </h2>
                  
                  {horarios.length === 0 ? (
                    <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                      <i className="fas fa-calendar-times text-gray-300 text-4xl mb-3"></i>
                      <p className="text-gray-600 font-medium">Nenhum horário cadastrado</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {horarios.map(horario => (
                        <div 
                          key={horario._id}
                          className="bg-white rounded-xl border border-gray-200 p-4"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div 
                                className="w-14 h-14 rounded-lg flex flex-col items-center justify-center text-white font-bold"
                                style={{ backgroundColor: horario.modalidadeId?.cor || '#6B7280' }}
                              >
                                <span className="text-xs">{diasSemanaAbrev[horario.diaSemana]}</span>
                                <span className="text-sm">{horario.horarioInicio}</span>
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900">
                                  {diasSemana[horario.diaSemana]}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {horario.horarioInicio} - {horario.horarioFim}
                                </p>
                                {horario.modalidadeId && (
                                  <span 
                                    className="inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded text-white"
                                    style={{ backgroundColor: horario.modalidadeId.cor || '#6B7280' }}
                                  >
                                    {horario.modalidadeId.nome}
                                  </span>
                                )}
                                {horario.professorId && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    <i className="fas fa-user-tie mr-1"></i>Prof. {horario.professorId.nome}
                                  </p>
                                )}
                              </div>
                            </div>
                            
                            <button
                              onClick={() => abrirModalAlteracaoHorario(horario)}
                              className="px-3 py-2 bg-primary-50 hover:bg-primary-100 text-primary-700 font-medium rounded-lg text-sm transition-colors"
                              title="Alterar para outro horário"
                            >
                              <i className="fas fa-exchange-alt mr-1"></i>
                              Alterar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Solicitações de alteração pendentes */}
                {alteracoesHorario.filter(a => a.status === 'pendente').length > 0 && (
                  <section>
                    <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">
                      <i className="fas fa-hourglass-half text-orange-500 mr-2"></i>Alterações Pendentes
                    </h2>
                    <div className="space-y-2">
                      {alteracoesHorario.filter(a => a.status === 'pendente').map(alt => (
                        <div key={alt._id} className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900">
                                {alt.horarioAtualId?.diaSemana !== undefined && diasSemana[alt.horarioAtualId.diaSemana]} {alt.horarioAtualId?.horarioInicio}
                                <i className="fas fa-arrow-right mx-2 text-orange-500"></i>
                                {alt.novoHorarioId?.diaSemana !== undefined && diasSemana[alt.novoHorarioId.diaSemana]} {alt.novoHorarioId?.horarioInicio}
                              </p>
                              <p className="text-sm text-gray-500 mt-1">
                                {alt.novoHorarioId?.modalidadeId?.nome} • Prof. {alt.novoHorarioId?.professorId?.nome}
                              </p>
                              {alt.motivo && (
                                <p className="text-xs text-gray-400 mt-1">
                                  <i className="fas fa-comment mr-1"></i>{alt.motivo}
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => cancelarAlteracaoHorario(alt._id)}
                              className="ml-2 p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              title="Cancelar solicitação"
                            >
                              <i className="fas fa-times"></i>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Histórico de alterações (aprovadas/rejeitadas) */}
                {alteracoesHorario.filter(a => a.status !== 'pendente').length > 0 && (
                  <section>
                    <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">
                      <i className="fas fa-history mr-2"></i>Histórico de Alterações
                    </h2>
                    <div className="space-y-2">
                      {alteracoesHorario.filter(a => a.status !== 'pendente').slice(0, 10).map(alt => (
                        <div 
                          key={alt._id} 
                          className={`rounded-xl border p-4 ${
                            alt.status === 'aprovado' 
                              ? 'bg-green-50 border-green-200' 
                              : 'bg-red-50 border-red-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900">
                                {alt.horarioAtualId?.diaSemana !== undefined && diasSemana[alt.horarioAtualId.diaSemana]} {alt.horarioAtualId?.horarioInicio}
                                <i className={`fas fa-arrow-right mx-2 ${alt.status === 'aprovado' ? 'text-green-500' : 'text-red-500'}`}></i>
                                {alt.novoHorarioId?.diaSemana !== undefined && diasSemana[alt.novoHorarioId.diaSemana]} {alt.novoHorarioId?.horarioInicio}
                              </p>
                              {alt.status === 'rejeitado' && alt.motivoRejeicao && (
                                <p className="text-sm text-red-600 mt-1">
                                  <i className="fas fa-exclamation-circle mr-1"></i>{alt.motivoRejeicao}
                                </p>
                              )}
                            </div>
                            {getStatusBadge(alt.status)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Dica */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-700">
                    <i className="fas fa-info-circle mr-2"></i>
                    Alterações de horário fixo precisam ser aprovadas pela administração. 
                    Você só pode trocar para horários da mesma modalidade que tenham vaga disponível.
                  </p>
                </div>
              </div>
            )}

            {/* Aba Faltas e Reposições */}
            {abaAtiva === 'faltas' && (
              <div className="space-y-6">
                {/* Título da seção */}
                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">
                  <i className="fas fa-redo text-gray-400 mr-2"></i>
                  Minhas Faltas e Reposições
                </h2>
                
                {/* Ausências pendentes (ainda não ocorreram) */}
                {avisosAusencia.filter(a => a.status === 'pendente').length > 0 && (
                  <section>
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">
                      Ausências Agendadas
                    </h3>
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
                                <p className="text-sm text-gray-600">
                                  <i className="fas fa-user-tie mr-1"></i>
                                  Prof. {aviso.horarioFixoId?.professorId?.nome}
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

                {/* Ausências confirmadas (já ocorreram) */}
                {avisosAusencia.filter(a => a.status === 'confirmada').length > 0 && (
                  <section>
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">
                      Ausências Confirmadas
                    </h3>
                    <div className="space-y-2">
                      {avisosAusencia.filter(a => a.status === 'confirmada').slice(0, 5).map(aviso => (
                        <div key={aviso._id} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1">
                              <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center">
                                <i className="fas fa-check text-gray-600"></i>
                              </div>
                              <div className="flex-1">
                                <p className="font-semibold text-gray-900">
                                  {formatarData(aviso.dataAusencia)} - {aviso.horarioFixoId?.horarioInicio}
                                </p>
                                <p className="text-sm text-gray-600">
                                  <i className="fas fa-user-tie mr-1"></i>
                                  Prof. {aviso.horarioFixoId?.professorId?.nome}
                                </p>
                                <p className="text-sm text-gray-500">{aviso.motivo}</p>
                                {aviso.temDireitoReposicao && (
                                  <p className="text-xs text-green-600 mt-1">
                                    <i className="fas fa-check-circle mr-1"></i>
                                    Avisou com antecedência - Direito a reposição
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {aviso.temDireitoReposicao && aviso.horarioFixoId?.modalidadeId?.permiteReposicao !== false && (
                                <button
                                  onClick={() => {
                                    // Converter AvisoAusencia para FaltaReposicao
                                    const falta: FaltaReposicao = {
                                      _id: aviso._id,
                                      tipo: 'aviso_ausencia',
                                      data: aviso.dataAusencia,
                                      horarioFixoId: aviso.horarioFixoId?._id || '',
                                      horarioInicio: aviso.horarioFixoId?.horarioInicio || '',
                                      horarioFim: aviso.horarioFixoId?.horarioFim || '',
                                      modalidade: aviso.horarioFixoId?.modalidadeId,
                                      professorId: aviso.horarioFixoId?.professorId,
                                      temDireitoReposicao: true,
                                      motivo: aviso.motivo,
                                      avisouComAntecedencia: true
                                    };
                                    abrirModalReposicao(falta);
                                  }}
                                  className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg text-sm transition-colors"
                                >
                                  <i className="fas fa-redo mr-1"></i>
                                  Repor
                                </button>
                              )}
                              {aviso.temDireitoReposicao && aviso.horarioFixoId?.modalidadeId?.permiteReposicao === false && (
                                <span className="px-3 py-1.5 bg-gray-100 text-gray-500 font-medium rounded-lg text-sm">
                                  <i className="fas fa-ban mr-1"></i>
                                  Sem reposição
                                </span>
                              )}
                              <button
                                onClick={() => cancelarAvisoAusencia(aviso._id, true)}
                                className="text-red-500 hover:text-red-700 text-sm px-2 py-1"
                                title="Cancelar aviso (para testes)"
                              >
                                <i className="fas fa-trash"></i>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {avisosAusencia.filter(a => a.status === 'confirmada').length > 5 && (
                      <p className="text-xs text-gray-500 text-center mt-2">
                        Mostrando últimas 5 ausências confirmadas
                      </p>
                    )}
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
                                {falta.professorId && (
                                  <p className="text-xs text-gray-400">
                                    <i className="fas fa-user-tie mr-1"></i>
                                    Prof. {falta.professorId.nome}
                                  </p>
                                )}
                                <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">
                                  <i className="fas fa-check mr-1"></i>
                                  Avisou com antecêdência
                                </span>
                              </div>
                            </div>
                            {falta.modalidade?.permiteReposicao !== false ? (
                              <button
                                onClick={() => abrirModalReposicao(falta)}
                                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg text-sm transition-colors"
                              >
                                Repor
                              </button>
                            ) : (
                              <span className="px-3 py-1.5 bg-gray-100 text-gray-500 font-medium rounded-lg text-sm">
                                <i className="fas fa-ban mr-1"></i>
                                Sem reposição
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Faltas sem direito a reposição (não avisou, mas prof enviou aula) */}
                {faltasSemDireito.length > 0 && (
                  <section>
                    <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">
                      <i className="fas fa-clock text-orange-400 mr-2"></i>
                      Faltas Registradas - Aguardando Reposição
                    </h2>
                    <div className="space-y-2">
                      {faltasSemDireito.map(falta => (
                        <div key={falta._id} className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div 
                                className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
                                style={{ backgroundColor: falta.modalidade?.cor || '#F97316' }}
                              >
                                <i className="fas fa-user-times"></i>
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900">
                                  Falta em {formatarData(falta.data)}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {falta.horarioInicio} - {falta.modalidade?.nome}
                                </p>
                                {falta.professorId && (
                                  <p className="text-xs text-gray-400">
                                    <i className="fas fa-user-tie mr-1"></i>
                                    Prof. {falta.professorId.nome}
                                  </p>
                                )}
                                <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-full bg-orange-100 text-orange-700">
                                  <i className="fas fa-exclamation-triangle mr-1"></i>
                                  Não avisou com antecêdência
                                </span>
                              </div>
                            </div>
                            <button
                              disabled
                              className="px-3 py-1.5 bg-gray-300 text-gray-500 font-medium rounded-lg text-sm cursor-not-allowed"
                              title="Sem direito a reposição - não avisou com antecedência"
                            >
                              <i className="fas fa-ban mr-1"></i>
                              Sem direito
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      <i className="fas fa-info-circle mr-1"></i>
                      Não é possível solicitar reposição para faltas sem aviso prévio.
                    </p>
                  </section>
                )}

                {/* Mensagem quando não há nada */}
                {faltasComDireito.length === 0 && faltasSemDireito.length === 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                    <i className="fas fa-check-circle text-green-400 text-4xl mb-3"></i>
                    <p className="text-gray-600 font-medium">Nenhuma falta registrada!</p>
                    <p className="text-gray-400 text-sm mt-1">Continue assim!</p>
                  </div>
                )}
              </div>
            )}

            {/* Aba Créditos */}
            {abaAtiva === 'creditos' && (
              <section>
                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">
                  <i className="fas fa-ticket text-gray-400 mr-2"></i>
                  Meus Créditos de Reposição
                </h2>
                
                {creditos.length === 0 ? (
                  <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                    <i className="fas fa-ticket text-gray-300 text-4xl mb-3"></i>
                    <p className="text-gray-500">Nenhum crédito disponível</p>
                    <p className="text-xs text-gray-400 mt-2">
                      Créditos são concedidos pela administração para aulas de reposição
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Resumo */}
                    <div className="bg-purple-50 rounded-xl border border-purple-200 p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-purple-500 text-white flex items-center justify-center">
                            <i className="fas fa-ticket text-xl"></i>
                          </div>
                          <div>
                            <p className="text-2xl font-bold text-purple-700">
                              {creditos.reduce((sum, c) => sum + (c.quantidade - c.quantidadeUsada), 0)}
                            </p>
                            <p className="text-sm text-purple-600">créditos disponíveis</p>
                          </div>
                        </div>
                        <div className="text-right text-sm text-purple-600">
                          <p>{creditos.reduce((sum, c) => sum + c.quantidadeUsada, 0)} usados</p>
                          <p>{creditos.reduce((sum, c) => sum + c.quantidade, 0)} total</p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Lista de créditos */}
                    {creditos.map(credito => {
                      const disponivel = credito.quantidade - credito.quantidadeUsada;
                      // Parsear data sem problema de timezone
                      const parseValidade = (dataStr: string): Date => {
                        const str = dataStr.split('T')[0];
                        const [ano, mes, dia] = str.split('-').map(Number);
                        return new Date(ano, mes - 1, dia, 23, 59, 59);
                      };
                      const expirado = parseValidade(credito.validade) < new Date();
                      
                      return (
                        <div
                          key={credito._id}
                          className={`bg-white rounded-xl border p-4 ${
                            expirado ? 'border-gray-200 opacity-60' : disponivel > 0 ? 'border-purple-200' : 'border-gray-200'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                expirado 
                                  ? 'bg-gray-100 text-gray-500'
                                  : disponivel > 0 
                                    ? 'bg-purple-100 text-purple-700' 
                                    : 'bg-orange-100 text-orange-700'
                              }`}>
                                {expirado ? 'EXPIRADO' : disponivel > 0 ? `${disponivel} DISPONÍVEL` : 'ESGOTADO'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {!expirado && disponivel > 0 && (
                                <button
                                  onClick={() => abrirModalUsarCredito(credito)}
                                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg text-sm transition-colors"
                                >
                                  <i className="fas fa-plus mr-1"></i>
                                  Usar
                                </button>
                              )}
                              <span className="text-xs text-gray-400">
                                <i className="fas fa-calendar-alt mr-1"></i>
                                Válido até {formatarData(credito.validade)}
                              </span>
                            </div>
                          </div>
                          
                          <p className="text-sm text-gray-700 mb-2">
                            <i className="fas fa-info-circle mr-1 text-gray-400"></i>
                            {credito.motivo}
                          </p>
                          
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span>
                              <i className="fas fa-ticket mr-1"></i>
                              {credito.quantidadeUsada}/{credito.quantidade} usados
                            </span>
                            <span>
                              <i className="fas fa-calendar-plus mr-1"></i>
                              Concedido em {formatarData(credito.criadoEm)}
                            </span>
                          </div>
                          
                          {/* Usos */}
                          {credito.usos && credito.usos.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-100">
                              <p className="text-xs font-medium text-gray-500 mb-2">Histórico de uso:</p>
                              <div className="space-y-1">
                                {credito.usos.map(uso => (
                                  <div key={uso._id} className="text-xs text-gray-500 flex items-center gap-2">
                                    <i className="fas fa-check-circle text-green-500"></i>
                                    <span>
                                      {formatarData(uso.dataUso)}
                                      {uso.agendamentoId && (
                                        <> - {uso.agendamentoId.horarioInicio} 
                                        {uso.agendamentoId.modalidadeId && ` (${uso.agendamentoId.modalidadeId.nome})`}
                                        </>
                                      )}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
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
                    
                    // Verificar se é o mesmo dia da aula original (não permitido)
                    const isMesmoDia = aulaSelecionada && diaObj.data.toDateString() === new Date(aulaSelecionada.dataStr + 'T12:00:00').toDateString();
                    
                    // Não permitir datas passadas (antes de hoje)
                    const isPassado = diaObjDate < hoje;
                    // Não permitir datas antes da aula selecionada
                    const isAntesDoLimite = diaObjDate < limiteMinimo;
                    // Não permitir datas mais de 7 dias após a aula
                    const isForaDoLimite = diaObjDate > limiteMaximo;
                    
                    const horariosDisp = diaObj.mesAtual && !isPassado && !isAntesDoLimite && !isForaDoLimite && !isMesmoDia ? getHorariosDisponiveisNoDia(diaObj.data) : [];
                    const temHorario = horariosDisp.length > 0;
                    
                    return (
                      <div
                        key={idx}
                        className={`
                          min-h-[40px] p-1 rounded-lg border transition-all text-center
                          ${!diaObj.mesAtual ? 'bg-gray-50 opacity-40' : 'bg-white'}
                          ${(isPassado || isAntesDoLimite || isForaDoLimite) && diaObj.mesAtual ? 'opacity-40' : ''}
                          ${isMesmoDia ? 'bg-red-50 border-red-300 opacity-60' : ''}
                          ${temHorario ? 'border-green-300 bg-green-50 cursor-pointer hover:bg-green-100' : 'border-gray-200'}
                        `}
                        title={isMesmoDia ? 'Não é possível reagendar para o mesmo dia' : undefined}
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
                  Escolha uma data até 7 dias após a aula (não pode ser no mesmo dia). Dias verdes têm vagas.
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
                Avise com pelo menos <strong>15 minutos</strong> de antecedência para ter direito a reposição.
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
      {/* Modal de Usar Crédito - Componente dedicado */}
      {creditoSelecionado && (
        <UsarCreditoModal
          open={showUsarCreditoModal}
          onClose={() => {
            setShowUsarCreditoModal(false);
            setCreditoSelecionado(null);
          }}
          credito={creditoSelecionado ? {
            _id: creditoSelecionado._id,
            alunoId: { _id: aluno?._id || '', nome: aluno?.nome || '' },
            quantidade: creditoSelecionado.quantidade,
            quantidadeUsada: creditoSelecionado.quantidadeUsada,
            validade: creditoSelecionado.validade
          } : null}
          onSuccess={() => {
            setShowUsarCreditoModal(false);
            setCreditoSelecionado(null);
            fetchDados();
          }}
        />
      )}

      {/* Modal de Solicitar Reposição - Usando ReporFaltaModal */}
      {faltaSelecionada && (
        <ReporFaltaModal
          open={showReposicaoModal}
          onClose={() => {
            setShowReposicaoModal(false);
            setFaltaSelecionada(null);
          }}
          alunoId={aluno?._id || ''}
          alunoNome={aluno?.nome || ''}
          falta={{
            aulaRealizadaId: faltaSelecionada._id,
            data: faltaSelecionada.data,
            horarioInicio: faltaSelecionada.horarioInicio,
            horarioFim: faltaSelecionada.horarioFim || '',
            horarioFixoId: faltaSelecionada.horarioFixoId,
            modalidade: faltaSelecionada.modalidade?.nome || '',
            diasRestantes: 7,
            prazoFinal: (() => {
              // Parsear data local sem problema de timezone
              const str = faltaSelecionada.data.split('T')[0];
              const [ano, mes, dia] = str.split('-').map(Number);
              const dataFalta = new Date(ano, mes - 1, dia, 12, 0, 0);
              dataFalta.setDate(dataFalta.getDate() + 7);
              return dataFalta.toLocaleDateString('pt-BR');
            })()
          }}
          onSuccess={() => {
            setShowReposicaoModal(false);
            setFaltaSelecionada(null);
            fetchDados();
          }}
        />
      )}

      {/* Modal de Alteração de Horário Fixo */}
      {showAlteracaoHorarioModal && horarioParaAlterar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Alterar Horário Fixo</h3>
              <button onClick={() => setShowAlteracaoHorarioModal(false)} className="text-gray-400 hover:text-gray-600">
                <i className="fas fa-times"></i>
              </button>
            </div>

            {/* Horário atual */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Horário Atual</p>
              <div className="flex items-center gap-3">
                <div 
                  className="w-12 h-12 rounded-lg flex flex-col items-center justify-center text-white font-bold"
                  style={{ backgroundColor: horarioParaAlterar.modalidadeId?.cor || '#6B7280' }}
                >
                  <span className="text-[10px]">{diasSemanaAbrev[horarioParaAlterar.diaSemana]}</span>
                  <span className="text-sm">{horarioParaAlterar.horarioInicio}</span>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">
                    {diasSemana[horarioParaAlterar.diaSemana]}
                  </p>
                  <p className="text-sm text-gray-500">
                    {horarioParaAlterar.horarioInicio} - {horarioParaAlterar.horarioFim}
                  </p>
                  {horarioParaAlterar.professorId && (
                    <p className="text-xs text-gray-500">
                      Prof. {horarioParaAlterar.professorId.nome}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Seleção do novo horário */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Novo Horário <span className="text-red-500">*</span>
              </label>
              
              {horariosParaAlteracao.length === 0 ? (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-700">
                    <i className="fas fa-exclamation-triangle mr-2"></i>
                    Não há outros horários disponíveis para esta modalidade no momento.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {horariosParaAlteracao.map(h => (
                    <label
                      key={h._id}
                      className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                        novoHorarioFixoId === h._id 
                          ? 'border-primary-500 bg-primary-50' 
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="novoHorarioFixo"
                        value={h._id}
                        checked={novoHorarioFixoId === h._id}
                        onChange={e => setNovoHorarioFixoId(e.target.value)}
                        className="text-primary-600"
                      />
                      <div 
                        className="w-10 h-10 rounded-lg flex flex-col items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundColor: h.modalidade?.cor || '#6B7280' }}
                      >
                        <span className="text-[8px]">{diasSemanaAbrev[h.diaSemana]}</span>
                        <span>{h.horarioInicio}</span>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">
                          {diasSemana[h.diaSemana]} - {h.horarioInicio}
                        </p>
                        <p className="text-xs text-gray-500">
                          {h.horarioInicio} - {h.horarioFim} • Prof. {h.professor?.nome || 'A definir'}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Motivo */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Motivo (opcional)
              </label>
              <textarea
                value={motivoAlteracao}
                onChange={e => setMotivoAlteracao(e.target.value)}
                placeholder="Ex: Mudança de horário no trabalho..."
                rows={2}
                maxLength={300}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 resize-none"
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-blue-700">
                <i className="fas fa-info-circle mr-2"></i>
                Esta alteração é <strong>permanente</strong>. Seu horário fixo será alterado após aprovação da administração.
              </p>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setShowAlteracaoHorarioModal(false)} 
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button 
                onClick={enviarAlteracaoHorario} 
                disabled={enviandoAlteracao || !novoHorarioFixoId}
                className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg disabled:opacity-50"
              >
                {enviandoAlteracao ? <><i className="fas fa-spinner fa-spin mr-2"></i>Enviando...</> : 'Solicitar Alteração'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Suporte/Financeiro */}
      {showSuporteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Suporte</h3>
              <button onClick={() => setShowSuporteModal(false)} className="text-gray-400 hover:text-gray-600">
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-xs text-blue-700">
                <i className="fas fa-info-circle mr-2"></i>
                <strong>Suporte:</strong> Dúvidas sobre horários, aulas e funcionalidades.
              </p>
              <p className="text-xs text-blue-700 mt-2">
                <i className="fas fa-info-circle mr-2"></i>
                <strong>Financeiro:</strong> Informações sobre pagamentos, boletos e planos.
              </p>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">Escolha o setor que deseja contatar:</p>
            
            <div className="space-y-3">
              {whatsappSuporte && (
                <a
                  href={`https://wa.me/${whatsappSuporte}?text=${encodeURIComponent(`Olá! Sou ${aluno.nome}, aluno do Studio Superação.\n\nPreciso de suporte com:\n`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setShowSuporteModal(false)}
                  className="flex items-center gap-3 p-4 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-colors"
                >
                  <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
                    <i className="fas fa-headset text-white text-xl"></i>
                  </div>
                  <div>
                    <p className="font-medium text-green-800">Suporte</p>
                    <p className="text-xs text-green-600">Dúvidas, horários, informações</p>
                  </div>
                  <i className="fab fa-whatsapp text-green-600 text-2xl ml-auto"></i>
                </a>
              )}
              
              {whatsappFinanceiro && (
                <a
                  href={`https://wa.me/${whatsappFinanceiro}?text=${encodeURIComponent(`Olá! Sou ${aluno.nome}, aluno do Studio Superação.\n\nPreciso de informações sobre:\n`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setShowSuporteModal(false)}
                  className="flex items-center gap-3 p-4 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
                >
                  <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                    <i className="fas fa-dollar-sign text-white text-xl"></i>
                  </div>
                  <div>
                    <p className="font-medium text-blue-800">Financeiro</p>
                    <p className="text-xs text-blue-600">Pagamentos, boletos, planos</p>
                  </div>
                  <i className="fab fa-whatsapp text-blue-600 text-2xl ml-auto"></i>
                </a>
              )}
              
              {!whatsappSuporte && !whatsappFinanceiro && adminContact && (
                <a
                  href={`https://wa.me/${adminContact.whatsapp}?text=${encodeURIComponent(`Olá! Sou ${aluno.nome}, aluno do Studio Superação.\n\n`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setShowSuporteModal(false)}
                  className="flex items-center gap-3 p-4 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-colors"
                >
                  <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
                    <i className="fas fa-headset text-white text-xl"></i>
                  </div>
                  <div>
                    <p className="font-medium text-green-800">Atendimento</p>
                    <p className="text-xs text-green-600">Fale com a recepção</p>
                  </div>
                  <i className="fab fa-whatsapp text-green-600 text-2xl ml-auto"></i>
                </a>
              )}
              
              {!whatsappSuporte && !whatsappFinanceiro && !adminContact && (
                <div className="text-center py-4 text-gray-500">
                  <i className="fas fa-exclamation-circle text-2xl mb-2"></i>
                  <p className="text-sm">Contatos não configurados</p>
                </div>
              )}
            </div>
            
            <button
              onClick={() => setShowSuporteModal(false)}
              className="w-full mt-4 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Modal de Professor */}
      {showProfessorModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Falar com Professor</h3>
              <button onClick={() => setShowProfessorModal(false)} className="text-gray-400 hover:text-gray-600">
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">Selecione o professor que deseja contatar:</p>
            
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {(() => {
                // Pegar professores únicos dos horários
                const professoresUnicos = horarios
                  .filter(h => h.professorId?.telefone)
                  .reduce((acc: any[], h) => {
                    const prof = h.professorId;
                    if (prof && !acc.find(p => p._id === prof._id)) {
                      acc.push(prof);
                    }
                    return acc;
                  }, []);
                
                if (professoresUnicos.length === 0) {
                  return (
                    <div className="text-center py-4 text-gray-500">
                      <i className="fas fa-user-slash text-2xl mb-2"></i>
                      <p className="text-sm">Nenhum professor com telefone cadastrado</p>
                    </div>
                  );
                }
                
                return professoresUnicos.map((prof: any) => (
                  <a
                    key={prof._id}
                    href={`https://wa.me/${prof.telefone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá professor(a) ${prof.nome}! Sou ${aluno.nome}, aluno do Studio Superação.\n\n`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setShowProfessorModal(false)}
                    className="flex items-center gap-3 p-4 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
                  >
                    <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                      <i className="fas fa-user-tie text-white text-xl"></i>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-blue-800">{prof.nome}</p>
                      <p className="text-xs text-blue-600">
                        {horarios.filter(h => h.professorId?._id === prof._id).map(h => h.modalidadeId?.nome).filter((v, i, a) => a.indexOf(v) === i).join(', ')}
                      </p>
                    </div>
                    <i className="fab fa-whatsapp text-blue-600 text-2xl"></i>
                  </a>
                ));
              })()}
            </div>
            
            <button
              onClick={() => setShowProfessorModal(false)}
              className="w-full mt-4 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Barra de navegação fixa no footer */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 safe-area-pb">
        <div className="max-w-4xl mx-auto">
          <div className="flex">
            <button
              onClick={() => setAbaAtiva('hoje')}
              className={`flex-1 py-2 flex flex-col items-center gap-0.5 transition-colors ${
                abaAtiva === 'hoje' ? 'text-primary-600' : 'text-gray-400'
              }`}
            >
              <i className="fas fa-home text-xl"></i>
              <span className="text-[10px] font-medium">Início</span>
            </button>
          
            <button
              onClick={() => setAbaAtiva('calendario')}
              className={`flex-1 py-2 flex flex-col items-center gap-0.5 transition-colors ${
                abaAtiva === 'calendario' ? 'text-primary-600' : 'text-gray-400'
              }`}
            >
              <i className="fas fa-calendar-alt text-xl"></i>
              <span className="text-[10px] font-medium">Reagendar</span>
            </button>
          
            <button
              onClick={() => setAbaAtiva('horarios')}
              className={`flex-1 py-2 flex flex-col items-center gap-0.5 transition-colors relative ${
                abaAtiva === 'horarios' ? 'text-primary-600' : 'text-gray-400'
              }`}
            >
              <i className="fas fa-clock text-xl"></i>
              <span className="text-[10px] font-medium">Horário</span>
              {alteracoesHorario.filter(a => a.status === 'pendente').length > 0 && (
                <span className="absolute top-1 right-1/4 w-4 h-4 bg-orange-500 text-white text-[10px] rounded-full flex items-center justify-center">
                  {alteracoesHorario.filter(a => a.status === 'pendente').length}
                </span>
              )}
            </button>
          
            <button
              onClick={() => setAbaAtiva('faltas')}
              className={`flex-1 py-2 flex flex-col items-center gap-0.5 transition-colors relative ${
                abaAtiva === 'faltas' ? 'text-primary-600' : 'text-gray-400'
              }`}
            >
              <i className="fas fa-redo text-xl"></i>
              <span className="text-[10px] font-medium">Repor</span>
              {reposicoesDisponiveis > 0 && (
                <span className="absolute top-1 right-1/4 w-4 h-4 bg-green-500 text-white text-[10px] rounded-full flex items-center justify-center">
                  {reposicoesDisponiveis}
                </span>
              )}
            </button>
          
            <button
              onClick={() => setAbaAtiva('creditos')}
              className={`flex-1 py-2 flex flex-col items-center gap-0.5 transition-colors relative ${
                abaAtiva === 'creditos' ? 'text-primary-600' : 'text-gray-400'
              }`}
            >
              <i className="fas fa-ticket text-xl"></i>
              <span className="text-[10px] font-medium">Créditos</span>
              {creditos.reduce((sum, c) => sum + (c.quantidade - c.quantidadeUsada), 0) > 0 && (
                <span className="absolute top-1 right-1/4 w-4 h-4 bg-teal-500 text-white text-[10px] rounded-full flex items-center justify-center">
                  {creditos.reduce((sum, c) => sum + (c.quantidade - c.quantidadeUsada), 0)}
                </span>
              )}
            </button>
          </div>
        </div>
      </nav>
    </div>
  );
}
