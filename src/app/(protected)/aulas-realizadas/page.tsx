'use client';

import Swal from 'sweetalert2';
import { toast } from 'react-toastify';
import ProtectedPage from '@/components/ProtectedPage';
import { useEffect, useState } from 'react';

interface AulaRealizada {
  _id: string;
  data: string;
  modalidade: string;
  status?: 'pendente' | 'enviada' | 'corrigida';
  professorId?: any;
  professorNome?: string;
  horarioFixoId?: string;
  horarioInicio?: string;
  horarioFim?: string;
  alunos: Array<{
    alunoId: string | { _id: string; nome: string };
    nome: string;
    presente: boolean | null;
    era_reagendamento: boolean;
    tipoReagendamento?: 'reagendamento' | 'reposicao_falta' | 'reposicao_credito';
    reagendou_para_outro?: boolean;
    reagendamento_info?: {
      novaData: string;
      novoHorario: string;
    };
  }>;
  total_presentes: number;
  total_faltas: number;
}

export default function AulasRealizadasPage() {
  const [mounted, setMounted] = useState(false);
  const [aulas, setAulas] = useState<AulaRealizada[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [filtros, setFiltros] = useState({
    dataInicio: '',
    dataFim: '',
    professor: '',
    modalidade: '',
    tipoAula: 'todas' // 'todas', 'realizadas', 'pendentes'
  });
  const [todayStr, setTodayStr] = useState<string>('');
  const [filtrosDesativados, setFiltrosDesativados] = useState(false);
  const [professores, setProfessores] = useState<any[]>([]);
  const [modalidades, setModalidades] = useState<any[]>([]);
  const [horarios, setHorarios] = useState<any[]>([]);
  const [aulaParaEditar, setAulaParaEditar] = useState<AulaRealizada | null>(null);
  const [aulaEditarEnriquecida, setAulaEditarEnriquecida] = useState<AulaRealizada | null>(null);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);
  const [aulaParaExcluir, setAulaParaExcluir] = useState<AulaRealizada | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [aulasPendentes, setAulasPendentes] = useState<Array<{
    data: string;
    horario: string;
    modalidade: string;
    professor: string;
    professorId: string;
    horarioFixoId: string;
  }>>([]);
  const [pendenteCancelar, setPendenteCancelar] = useState<{
    data: string;
    horario: string;
    modalidade: string;
    professor: string;
    professorId: string;
    horarioFixoId: string;
  } | null>(null);
  const [motivoCancelamento, setMotivoCancelamento] = useState('');
  const [aulaCanceladaParaDesfazer, setAulaCanceladaParaDesfazer] = useState<AulaRealizada | null>(null);

  // Pagination state
  const ITENS_POR_PAGINA = 8;
  const [pendentesPage, setPendentesPage] = useState(1);
  const [realizadasPage, setRealizadasPage] = useState(1);
  const [canceladasPage, setCanceladasPage] = useState(1);

  // Marcar como montado
  useEffect(() => {
    setMounted(true);
  }, []);

  // Helpers to resolve colors for modalidade and professor (fallbacks provided)
  const getModalidadeColor = (nome: string) => {
    if (!nome) return '#3B82F6';
    const mod = modalidades.find(m => String(m.nome || '').toLowerCase() === String(nome || '').toLowerCase());
    return (mod && (mod.cor || mod.color)) || '#3B82F6';
  };

  const getProfessorColor = (idOrName: any) => {
    if (!idOrName) return '#9CA3AF';
    
    // Se já é um objeto com cor, retorna direto
    if (typeof idOrName === 'object' && idOrName !== null) {
      if (idOrName.cor) return idOrName.cor;
      // Se é objeto mas não tem cor, busca pelo _id
      if (idOrName._id) {
        const prof = professores.find(p => String(p._id) === String(idOrName._id));
        return (prof && prof.cor) || '#9CA3AF';
      }
    }
    
    const searchValue = String(idOrName || '').toLowerCase().trim();
    const prof = professores.find(p => 
      String(p._id) === String(idOrName) || 
      String((p.nome || '')).toLowerCase().trim() === searchValue
    );
    return (prof && prof.cor) || '#9CA3AF';
  };

  const getProfessorName = (aula: any) => {
    // Primeiro tenta nome direto no objeto professorId (se veio populado da API)
    if (aula.professorId) {
      if (typeof aula.professorId === 'object' && aula.professorId !== null) {
        if (aula.professorId.nome) {
          return aula.professorId.nome;
        }
      }
      
      // Se professorId é um string (ID), procura no array de professores
      if (typeof aula.professorId === 'string') {
        const prof = professores.find(p => String(p._id) === String(aula.professorId));
        if (prof && prof.nome) return prof.nome;
        // Verificar se é um ObjectId de professor apagado
        if (/^[0-9a-f]{24}$/i.test(aula.professorId)) return 'Sem professor';
      }
    }
    
    // Fallback para professorNome
    if (aula.professorNome && typeof aula.professorNome === 'string') {
      // Verificar se professorNome é um ObjectId
      if (/^[0-9a-f]{24}$/i.test(aula.professorNome)) return 'Sem professor';
      return aula.professorNome;
    }
    
    // Se ainda não encontrou, tentar buscar do horário fixo
    if (aula.horarioFixoId && horarios.length > 0) {
      const horario = horarios.find((h: any) => {
        const hId = String(h._id || h.horarioFixoId || '');
        const aulaHId = String(aula.horarioFixoId || '');
        return hId === aulaHId;
      });
      
      if (horario) {
        // Tentar pegar nome do professor do horário
        if (horario.professor) {
          if (typeof horario.professor === 'object' && horario.professor.nome) {
            return horario.professor.nome;
          }
        }
        
        if (horario.professorId) {
          if (typeof horario.professorId === 'object' && horario.professorId.nome) {
            return horario.professorId.nome;
          }
          
          // Buscar nos professores carregados
          const prof = professores.find(p => String(p._id) === String(horario.professorId));
          if (prof && prof.nome) return prof.nome;
          // Verificar se é ObjectId de professor apagado
          if (typeof horario.professorId === 'string' && /^[0-9a-f]{24}$/i.test(horario.professorId)) return 'Sem professor';
        }
        
        if (horario.professorNome) {
          // Verificar se professorNome é um ObjectId
          if (/^[0-9a-f]{24}$/i.test(horario.professorNome)) return 'Sem professor';
          return horario.professorNome;
        }
      }
    }
    
    return 'Não informado';
  };

  const getProfessorLookupKey = (aula: any) => {
    // Primeiro tentar pegar o professorId da aula (retorna objeto inteiro para ter acesso à cor)
    if (aula.professorId) {
      if (typeof aula.professorId === 'object' && aula.professorId !== null) {
        // Retorna o objeto inteiro para que getProfessorColor possa pegar a cor direto
        return aula.professorId;
      }
      if (typeof aula.professorId === 'string') {
        return aula.professorId;
      }
    }
    
    // Tentar buscar do horário fixo
    if (aula.horarioFixoId && horarios.length > 0) {
      const horario = horarios.find((h: any) => {
        const hId = String(h._id || h.horarioFixoId || '');
        const aulaHId = String(aula.horarioFixoId || '');
        return hId === aulaHId;
      });
      
      if (horario) {
        if (horario.professorId) {
          if (typeof horario.professorId === 'object' && horario.professorId._id) {
            // Retorna o objeto inteiro
            return horario.professorId;
          }
          if (typeof horario.professorId === 'string') {
            return horario.professorId;
          }
        }
        if (horario.professor && horario.professor._id) {
          return horario.professor;
        }
      }
    }
    
    return aula.professorNome || '';
  };

  // Parse date strings safely: treat 'YYYY-MM-DD' as local date (avoid UTC shift)
  const parseLocalDate = (s?: string | null) => {
    if (!s) return new Date();
    // plain date format YYYY-MM-DD -> force local midnight
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s + 'T00:00:00');

    // ISO with time at midnight (e.g. 2025-11-20T00:00:00 or 2025-11-20T00:00:00.000Z)
    const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?Z?)?$/);
    if (m) {
      const year = Number(m[1]);
      const month = Number(m[2]);
      const day = Number(m[3]);
      const hh = m[4];
      const mm = m[5];
      const ss = m[6];
      // if no time part or time is exactly 00:00:00, treat as local date
      if (!hh || (hh === '00' && mm === '00' && ss === '00')) {
        return new Date(year, month - 1, day);
      }
    }

    return new Date(s);
  };

  const localDateYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // Inicializar datas de filtro após montagem do componente (evita erro de hidratação)
  useEffect(() => {
    const today = new Date();
    const dataFimDefault = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const past = new Date();
    past.setDate(past.getDate() - 30);
    const dataInicioDefault = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, '0')}-${String(past.getDate()).padStart(2, '0')}`;
    
    setTodayStr(dataFimDefault);
    setFiltros(prev => ({
      ...prev,
      dataInicio: dataInicioDefault,
      dataFim: dataFimDefault
    }));
  }, []);

  useEffect(() => {
    if (filtrosDesativados || (filtros.dataInicio && filtros.dataFim)) {
      carregarDados();
    }
  }, [filtros, filtrosDesativados]);

  const carregarDados = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

      // Buscar aulas realizadas
      const resAulas = await fetch('/api/aulas-realizadas?listarTodas=true', { headers });
      const aulasData: AulaRealizada[] = resAulas.ok ? await resAulas.json() : [];

      // Buscar horários fixos para aulas pendentes
      const resHorarios = await fetch('/api/horarios');
      const horariosData = resHorarios.ok ? await resHorarios.json() : { data: [] };
      const horariosList: any[] = Array.isArray(horariosData) ? horariosData : (horariosData.data || []);
      setHorarios(horariosList);

      // Buscar professores a partir de usuários
      const resUsuarios = await fetch('/api/usuarios');
      const usuariosData = resUsuarios.ok ? await resUsuarios.json() : { data: [] };
      let usuariosList: any[] = [];
      if (Array.isArray(usuariosData)) usuariosList = usuariosData;
      else if (usuariosData && usuariosData.data) usuariosList = usuariosData.data;
      const professoresList = usuariosList
        .filter((u: any) => String(u.tipo || '').toLowerCase() === 'professor')
        .map((u: any) => ({ _id: u._id, nome: u.nome, cor: u.cor, ...u }));
      setProfessores(professoresList || []);

      // Buscar modalidades
      const resModalidades = await fetch('/api/modalidades');
      const modalidadesData = resModalidades.ok ? await resModalidades.json() : { data: [] };
      setModalidades(modalidadesData.data || []);

      // Calcular aulas pendentes
      const aulasMap = new Map<string, AulaRealizada>();
      aulasData.forEach(aula => {
        const dataKey = aula.data ? localDateYMD(parseLocalDate(aula.data)) : '';
        const key = `${aula.horarioFixoId || ''}_${dataKey}`;
        aulasMap.set(key, aula);
      });

      function getDatesForDayOfWeek(start: string, end: string, dayOfWeek: number) {
        const dates = [];
        let current = parseLocalDate(start);
        const endDate = parseLocalDate(end);
        current.setHours(0, 0, 0, 0);
        endDate.setHours(0, 0, 0, 0);
        while (current.getDay() !== dayOfWeek) {
          current.setDate(current.getDate() + 1);
        }
        while (current <= endDate) {
          dates.push(new Date(current));
          current.setDate(current.getDate() + 7);
        }
        return dates;
      }

      const pendentesList: Array<{
        data: string;
        horario: string;
        modalidade: string;
        professor: string;
        professorId: string;
        horarioFixoId: string;
      }> = [];

      // Obter data de início da plataforma do localStorage
      const dataInicioPlataforma = typeof window !== 'undefined' 
        ? localStorage.getItem('dataInicioPlataforma') || ''
        : '';

      horariosList.forEach(horario => {
        // Ignore malformed horario entries: require an _id and a valid diaSemana and at least one time field.
        if (!horario || !horario._id) return;
        if (typeof horario.diaSemana !== 'number') return;
        if (!horario.horarioInicio && !horario.horario) return;
        const dias = getDatesForDayOfWeek(filtros.dataInicio, filtros.dataFim, horario.diaSemana);
        dias.forEach(dateObj => {
          const dataStr = localDateYMD(dateObj);
          const key = `${horario._id}_${dataStr}`;
          
          // Verificar se a data é anterior à data de início da plataforma
          const dentroDataPlataforma = !dataInicioPlataforma || dataStr >= dataInicioPlataforma;
          
          if (dataStr < localDateYMD(new Date()) && !aulasMap.has(key) && dentroDataPlataforma) {
            // Extrair professor (pode vir populado como objeto ou apenas ID)
            let professorNome = 'Não informado';
            let professorId = '';
            
            if (horario.professorId) {
              if (typeof horario.professorId === 'object' && horario.professorId.nome) {
                professorNome = horario.professorId.nome;
                professorId = horario.professorId._id || '';
              } else if (typeof horario.professorId === 'string') {
                professorId = horario.professorId;
              }
            }
            
            // Extrair modalidade (pode vir populado como objeto ou apenas ID)
            let modalidadeNome = 'Não informada';
            
            if (horario.modalidadeId) {
              if (typeof horario.modalidadeId === 'object' && horario.modalidadeId.nome) {
                modalidadeNome = horario.modalidadeId.nome;
              }
            } else if (horario.modalidade) {
              if (typeof horario.modalidade === 'object' && horario.modalidade.nome) {
                modalidadeNome = horario.modalidade.nome;
              } else if (typeof horario.modalidade === 'string') {
                modalidadeNome = horario.modalidade;
              }
            }
            
            const horarioTexto = horario.horarioInicio && horario.horarioFim 
              ? `${horario.horarioInicio} - ${horario.horarioFim}`
              : horario.horario || 'Não informado';
            
            // Aplicar filtros
            const dentroProfessor = !filtros.professor || professorId === filtros.professor;
            const dentroModalidade = !filtros.modalidade || modalidadeNome === filtros.modalidade;
            
            if (dentroProfessor && dentroModalidade) {
              pendentesList.push({
                data: dataStr,
                horario: horarioTexto,
                modalidade: modalidadeNome,
                professor: professorNome,
                professorId: professorId,
                horarioFixoId: horario._id
              });
            }
          }
        });
      });

      // Ordenar pendentes por data (mais antiga primeiro)
      pendentesList.sort((a, b) => parseLocalDate(a.data).getTime() - parseLocalDate(b.data).getTime());
      setAulasPendentes(pendentesList);

      // Aplicar filtros nas aulas realizadas
      let aulasFiltradas = aulasData.filter((aula) => {
        // Se filtros desativados, retorna todas
        if (filtrosDesativados) return true;
        
        const dataAula = aula.data ? localDateYMD(parseLocalDate(aula.data)) : '';
        const dentroDataInicio = !filtros.dataInicio || dataAula >= filtros.dataInicio;
        const dentroDataFim = !filtros.dataFim || dataAula <= filtros.dataFim;
        
        const professorId = String((aula.professorId as any)?._id || aula.professorId || '');
        const dentroProfessor = !filtros.professor || professorId === filtros.professor;
        
        const dentroModalidade = !filtros.modalidade || aula.modalidade === filtros.modalidade;
        return dentroDataInicio && dentroDataFim && dentroProfessor && dentroModalidade;
      });

      // Ordenar por data (mais antiga primeiro)
      aulasFiltradas.sort((a, b) => parseLocalDate(a.data).getTime() - parseLocalDate(b.data).getTime());

      setAulas(aulasFiltradas);
    } catch (error) {
      console.error('Erro ao carregar aulas:', error);
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  };

  // Função para devolver aula realizada (DELETE - remove do banco para voltar como pendente)
  const handleDevolverAula = async () => {
    if (!aulaParaExcluir) return;

    try {
      setSalvando(true);
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };

      const response = await fetch(`/api/aulas-realizadas/${aulaParaExcluir._id}`, {
        method: 'DELETE',
        headers
      });

      if (response.ok) {
        setAulaParaExcluir(null);
        carregarDados();
        toast.success('Aula devolvida com sucesso! Ela voltará a aparecer como pendente.');
      } else {
        toast.error('Erro ao devolver aula');
      }
    } catch (error) {
      console.error('Erro ao devolver aula:', error);
      toast.error('Erro ao devolver aula');
    } finally {
      setSalvando(false);
    }
  };

  // Função para cancelar aula pendente (gera crédito de reposição para todos os alunos)
  const handleCancelarPendente = async () => {
    if (!pendenteCancelar) return;

    try {
      setSalvando(true);
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };

      // Chamar a API de cancelamento
      const response = await fetch('/api/aulas-realizadas/cancelar', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          horarioFixoId: pendenteCancelar.horarioFixoId,
          data: pendenteCancelar.data,
          motivoCancelamento: motivoCancelamento.trim() || 'Aula cancelada - crédito gerado'
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setPendenteCancelar(null);
        setMotivoCancelamento('');
        carregarDados();
        toast.success(result.message || 'Aula cancelada com sucesso!');
      } else {
        toast.error(result.error || 'Erro ao cancelar aula');
      }
    } catch (error) {
      console.error('Erro ao cancelar aula pendente:', error);
      toast.error('Erro ao cancelar aula');
    } finally {
      setSalvando(false);
    }
  };

  // Função para desfazer cancelamento de aula (remove a aula cancelada e devolve créditos)
  const handleDesfazerCancelamento = async () => {
    if (!aulaCanceladaParaDesfazer) return;

    try {
      setSalvando(true);
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };

      // Deletar a aula cancelada (voltará como pendente)
      const response = await fetch(`/api/aulas-realizadas/${aulaCanceladaParaDesfazer._id}`, {
        method: 'DELETE',
        headers
      });

      if (response.ok) {
        // Remover os créditos de reposição gerados pelo cancelamento
        const resCreditos = await fetch(`/api/creditos-reposicao?aulaRealizadaId=${aulaCanceladaParaDesfazer._id}`, {
          method: 'DELETE',
          headers
        });

        setAulaCanceladaParaDesfazer(null);
        carregarDados();
        toast.success('Cancelamento desfeito! A aula voltou a aparecer como pendente.');
      } else {
        toast.error('Erro ao desfazer cancelamento');
      }
    } catch (error) {
      console.error('Erro ao desfazer cancelamento:', error);
      toast.error('Erro ao desfazer cancelamento');
    } finally {
      setSalvando(false);
    }
  };

  const handleSalvarEdicao = async () => {
    if (!aulaEditarEnriquecida) return;

    try {
      setSalvando(true);
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };

      const response = await fetch(`/api/aulas-realizadas/${aulaEditarEnriquecida._id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          alunos: aulaEditarEnriquecida.alunos,
          total_presentes: aulaEditarEnriquecida.alunos.filter(a => a.presente === true).length,
          total_faltas: aulaEditarEnriquecida.alunos.filter(a => a.presente === false).length
        })
      });

      if (response.ok) {
        setAulaParaEditar(null);
        setAulaEditarEnriquecida(null);
        carregarDados();
        toast.success('Alterações salvas com sucesso!');
      } else {
        toast.error('Erro ao salvar alterações');
      }
    } catch (error) {
      console.error('Erro ao salvar aula:', error);
      toast.error('Erro ao salvar alterações');
    } finally {
      setSalvando(false);
    }
  };

  // Fechar modais com ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (aulaEditarEnriquecida) {
          setAulaParaEditar(null);
          setAulaEditarEnriquecida(null);
        } else if (aulaParaExcluir) {
          setAulaParaExcluir(null);
        }
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [aulaEditarEnriquecida, aulaParaExcluir]);

  const togglePresenca = (alunoIndex: number) => {
    if (!aulaEditarEnriquecida) return;

    const novosAlunos = [...aulaEditarEnriquecida.alunos];
    const alunoAtual = novosAlunos[alunoIndex];
    
    // Ciclo: null -> true -> false -> null
    if (alunoAtual.presente === null) {
      alunoAtual.presente = true;
    } else if (alunoAtual.presente === true) {
      alunoAtual.presente = false;
    } else {
      alunoAtual.presente = null;
    }

    setAulaEditarEnriquecida({
      ...aulaEditarEnriquecida,
      alunos: novosAlunos
    });
  };

  // Função para buscar reagendamentos e enriquecer dados da aula
  const enriquecerAulaParaEditar = async (aula: AulaRealizada) => {
    setCarregandoDetalhe(true);
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      
      // Buscar reagendamentos aprovados
      const dataStr = aula.data ? localDateYMD(parseLocalDate(aula.data)) : '';
      
      const resReagendamentos = await fetch('/api/reagendamentos', { headers });
      const reagendamentosData = resReagendamentos.ok ? await resReagendamentos.json() : { data: [] };
      const todosReagendamentos = Array.isArray(reagendamentosData) ? reagendamentosData : (reagendamentosData.data || []);
      
      // Filtrar apenas aprovados
      const reagendamentos = todosReagendamentos.filter((r: any) => r.status === 'aprovado');
      
      // ========== ALUNOS QUE SAÍRAM DESTE HORÁRIO ==========
      const alunosQueReagendaram = new Map<string, { novaData: string; novoHorario: string }>();
      
      for (const reag of reagendamentos) {
        const dataOriginalStr = reag.dataOriginal ? localDateYMD(parseLocalDate(reag.dataOriginal)) : '';
        const horarioFixoIdReag = String(reag.horarioFixoId?._id || reag.horarioFixoId || '');
        const horarioFixoIdAula = String(aula.horarioFixoId || '');
        
        if (dataOriginalStr === dataStr && horarioFixoIdReag === horarioFixoIdAula) {
          let alunoId = '';
          
          if (reag.matriculaId) {
            if (typeof reag.matriculaId === 'object' && reag.matriculaId !== null) {
              if (reag.matriculaId.alunoId) {
                alunoId = typeof reag.matriculaId.alunoId === 'object' 
                  ? String(reag.matriculaId.alunoId._id || reag.matriculaId.alunoId)
                  : String(reag.matriculaId.alunoId);
              }
            } else if (typeof reag.matriculaId === 'string') {
              try {
                const resMatricula = await fetch(`/api/matriculas/${reag.matriculaId}`, { headers });
                if (resMatricula.ok) {
                  const matriculaData = await resMatricula.json();
                  if (matriculaData.alunoId) {
                    alunoId = typeof matriculaData.alunoId === 'object'
                      ? String(matriculaData.alunoId._id || matriculaData.alunoId)
                      : String(matriculaData.alunoId);
                  }
                }
              } catch (e) {
                console.warn('[enriquecerAulaParaEditar] Erro ao buscar matrícula:', e);
              }
            }
          }
          
          if (alunoId) {
            const novaDataStr = reag.novaData ? localDateYMD(parseLocalDate(reag.novaData)) : '';
            const novoHorario = reag.novoHorarioInicio && reag.novoHorarioFim 
              ? `${reag.novoHorarioInicio} - ${reag.novoHorarioFim}` 
              : reag.novoHorarioInicio || '';
            
            alunosQueReagendaram.set(alunoId, { 
              novaData: novaDataStr, 
              novoHorario 
            });
          }
        }
      }
      
      // ========== ALUNOS QUE ENTRARAM NESTE HORÁRIO (Reagendamentos/Reposições) ==========
      const alunosQueEntraram: Array<{
        alunoId: string;
        nome: string;
        tipoReagendamento: 'reagendamento' | 'reposicao_falta' | 'reposicao_credito';
        dataOriginal: string;
      }> = [];
      
      for (const reag of reagendamentos) {
        const novaDataStr = reag.novaData ? localDateYMD(parseLocalDate(reag.novaData)) : '';
        const novoHorarioFixoId = String(reag.novoHorarioFixoId?._id || reag.novoHorarioFixoId || '');
        const horarioFixoIdAula = String(aula.horarioFixoId || '');
        
        // Se a novaData do reagendamento bate com a data desta aula
        // E o novoHorarioFixoId bate com o horário desta aula
        if (novaDataStr === dataStr && novoHorarioFixoId === horarioFixoIdAula) {
          let alunoId = '';
          let alunoNome = '';
          
          // Tentar pegar alunoId diretamente do reagendamento
          if (reag.alunoId) {
            alunoId = typeof reag.alunoId === 'object' 
              ? String(reag.alunoId._id || reag.alunoId)
              : String(reag.alunoId);
            alunoNome = typeof reag.alunoId === 'object' ? reag.alunoId.nome || '' : '';
          }
          
          // Se não tem, buscar pela matrícula
          if (!alunoId && reag.matriculaId) {
            if (typeof reag.matriculaId === 'object' && reag.matriculaId !== null) {
              if (reag.matriculaId.alunoId) {
                alunoId = typeof reag.matriculaId.alunoId === 'object' 
                  ? String(reag.matriculaId.alunoId._id || reag.matriculaId.alunoId)
                  : String(reag.matriculaId.alunoId);
              }
            }
          }
          
          if (alunoId) {
            // Buscar nome do aluno se não temos
            if (!alunoNome) {
              try {
                const resAluno = await fetch(`/api/alunos/${alunoId}`, { headers });
                if (resAluno.ok) {
                  const alunoData = await resAluno.json();
                  alunoNome = alunoData.nome || 'Aluno';
                }
              } catch (e) {
                alunoNome = 'Aluno';
              }
            }
            
            // Determinar o tipo de reagendamento
            let tipoReagendamento: 'reagendamento' | 'reposicao_falta' | 'reposicao_credito' = 'reagendamento';
            if (reag.isReposicao) {
              if (reag.usoCreditoId) {
                tipoReagendamento = 'reposicao_credito';
              } else {
                tipoReagendamento = 'reposicao_falta';
              }
            }
            
            alunosQueEntraram.push({
              alunoId,
              nome: alunoNome,
              tipoReagendamento,
              dataOriginal: reag.dataOriginal ? localDateYMD(parseLocalDate(reag.dataOriginal)) : ''
            });
          }
        }
      }
      
      // Enriquecer os alunos da aula com informação de reagendamento (saída)
      const alunosEnriquecidos = aula.alunos.map(aluno => {
        const alunoIdStr = typeof aluno.alunoId === 'object' 
          ? String((aluno.alunoId as any)._id || aluno.alunoId)
          : String(aluno.alunoId);
        const reagInfo = alunosQueReagendaram.get(alunoIdStr);
        
        // Verificar se este aluno também entrou como reagendamento (não deve duplicar)
        const entrou = alunosQueEntraram.find(a => a.alunoId === alunoIdStr);
        
        return {
          ...aluno,
          reagendou_para_outro: !!reagInfo,
          reagendamento_info: reagInfo || undefined,
          // Se já está na lista e entrou, atualizar o tipo
          tipoReagendamento: entrou?.tipoReagendamento || aluno.tipoReagendamento
        };
      });
      
      // Adicionar alunos que entraram mas não estão na lista de alunos (não deveriam estar na aula original)
      const alunoIdsExistentes = new Set(alunosEnriquecidos.map(a => 
        typeof a.alunoId === 'object' ? String((a.alunoId as any)._id || a.alunoId) : String(a.alunoId)
      ));
      
      const alunosExtras = alunosQueEntraram
        .filter(a => !alunoIdsExistentes.has(a.alunoId))
        .map(a => ({
          alunoId: a.alunoId,
          nome: a.nome,
          presente: null,
          era_reagendamento: true,
          tipoReagendamento: a.tipoReagendamento,
          reagendou_para_outro: false
        }));
      
      setAulaEditarEnriquecida({
        ...aula,
        alunos: [...alunosEnriquecidos, ...alunosExtras]
      });
    } catch (error) {
      console.error('Erro ao enriquecer aula:', error);
      setAulaEditarEnriquecida(aula);
    } finally {
      setCarregandoDetalhe(false);
    }
  };

  // Efeito para enriquecer aula quando selecionada para edição
  useEffect(() => {
    if (aulaParaEditar) {
      enriquecerAulaParaEditar(aulaParaEditar);
    } else {
      setAulaEditarEnriquecida(null);
    }
  }, [aulaParaEditar]);

  // Filtrar aulas (separando canceladas)
  const aulasAtivas = aulas.filter((a: any) => !a.cancelada);
  const aulasCanceladas = aulas.filter((a: any) => a.cancelada);
  
  const aulasParaExibir = filtros.tipoAula === 'realizadas' ? aulasAtivas : 
                          filtros.tipoAula === 'pendentes' ? [] : 
                          filtros.tipoAula === 'canceladas' ? [] :
                          aulasAtivas;
  
  const pendentesFiltradas = filtros.tipoAula === 'pendentes' ? aulasPendentes :
                             filtros.tipoAula === 'todas' ? aulasPendentes :
                             [];

  const canceladasFiltradas = filtros.tipoAula === 'canceladas' ? aulasCanceladas :
                              filtros.tipoAula === 'todas' ? aulasCanceladas :
                              [];

  // Reset pagination when filters change
  useEffect(() => {
    setPendentesPage(1);
    setRealizadasPage(1);
    setCanceladasPage(1);
  }, [filtros]);

  const totalPendentesPages = Math.max(1, Math.ceil(pendentesFiltradas.length / ITENS_POR_PAGINA));
  const totalRealizadasPages = Math.max(1, Math.ceil(aulasParaExibir.length / ITENS_POR_PAGINA));
  const totalCanceladasPages = Math.max(1, Math.ceil(canceladasFiltradas.length / ITENS_POR_PAGINA));

  const pendentesParaExibir = pendentesFiltradas.slice((pendentesPage - 1) * ITENS_POR_PAGINA, pendentesPage * ITENS_POR_PAGINA);
  const realizadasParaExibir = aulasParaExibir.slice((realizadasPage - 1) * ITENS_POR_PAGINA, realizadasPage * ITENS_POR_PAGINA);
  const canceladasParaExibir = canceladasFiltradas.slice((canceladasPage - 1) * ITENS_POR_PAGINA, canceladasPage * ITENS_POR_PAGINA);

  // Skeleton loading enquanto não está montado ou carregando dados iniciais
  if (!mounted || initialLoading) {
    return (
      <ProtectedPage tab="aulas" title="Aulas - Superação Flux" customLoading>
        <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
          {/* Header skeleton - Desktop */}
          <div className="hidden md:block mb-6">
            <div className="h-6 bg-gray-200 rounded w-24 mb-2 animate-pulse" />
            <div className="h-4 bg-gray-200 rounded w-64 animate-pulse" />
          </div>
          
          {/* Header skeleton - Mobile */}
          <div className="md:hidden mb-4">
            <div className="h-5 bg-gray-200 rounded w-16 animate-pulse" />
          </div>
          
          {/* Filtros skeleton - Desktop */}
          <div className="hidden md:block bg-white rounded-md border border-gray-200 p-4 mb-6">
            <div className="flex gap-2 mb-4 pb-4 border-b border-gray-200">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-10 bg-gray-200 rounded-full w-28 animate-pulse" />
              ))}
            </div>
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i}>
                  <div className="h-4 bg-gray-200 rounded w-16 mb-2 animate-pulse" />
                  <div className="h-10 bg-gray-200 rounded w-full animate-pulse" />
                </div>
              ))}
            </div>
          </div>
          
          {/* Filtros skeleton - Mobile (tabs) */}
          <div className="md:hidden mb-4">
            <div className="flex gap-1 overflow-x-auto pb-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-8 bg-gray-200 rounded-full w-20 animate-pulse flex-shrink-0" />
              ))}
            </div>
          </div>
          
          {/* Tabela skeleton - Desktop */}
          <div className="hidden md:block bg-white rounded-md border border-gray-200 overflow-hidden">
            <div className="bg-yellow-50 px-4 py-3 border-b border-yellow-200">
              <div className="h-4 bg-yellow-200 rounded w-36 animate-pulse" />
            </div>
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3"><div className="h-3 bg-gray-200 rounded w-32 animate-pulse" /></th>
                  <th className="px-4 py-3"><div className="h-3 bg-gray-200 rounded w-24 animate-pulse" /></th>
                  <th className="px-4 py-3"><div className="h-3 bg-gray-200 rounded w-24 animate-pulse" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {[1, 2, 3, 4].map(i => (
                  <tr key={i}>
                    <td className="px-4 py-3">
                      <div className="h-4 bg-gray-200 rounded w-24 mb-1 animate-pulse" />
                      <div className="h-3 bg-gray-100 rounded w-32 animate-pulse" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-gray-200 rounded-full animate-pulse" />
                        <div className="h-4 bg-gray-200 rounded w-20 animate-pulse" />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-gray-200 rounded-full animate-pulse" />
                        <div className="h-4 bg-gray-200 rounded w-24 animate-pulse" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Cards skeleton - Mobile */}
          <div className="md:hidden space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-yellow-800 mb-2">
              <div className="h-4 bg-yellow-200 rounded w-28 animate-pulse" />
            </div>
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden animate-pulse">
                <div className="h-1 bg-gray-300" />
                <div className="p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="h-4 bg-gray-200 rounded w-24 mb-1" />
                      <div className="h-3 bg-gray-100 rounded w-32" />
                    </div>
                    <div className="h-5 bg-yellow-100 rounded-full w-16" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 bg-gray-200 rounded-full" />
                      <div className="h-3 bg-gray-200 rounded w-16" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 bg-gray-200 rounded-full" />
                      <div className="h-3 bg-gray-200 rounded w-20" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </ProtectedPage>
    );
  }

  return (
    <ProtectedPage tab="aulas" title="Aulas - Superação Flux">
      <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
        {/* Header Desktop */}
        <div className="hidden md:block mb-6 fade-in-1">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <i className="fas fa-clipboard-check text-green-600"></i>
            Aulas
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Gerencie as aulas realizadas e pendentes do sistema
          </p>
        </div>

        {/* Header Mobile */}
        <div className="md:hidden mb-4 fade-in-1">
          <h1 className="text-lg font-semibold text-gray-900">Aulas</h1>
        </div>

        {/* Filtros Mobile - Tabs */}
        <div className="md:hidden mb-4 fade-in-2">
          <div className="flex gap-1 overflow-x-auto pb-2">
            <button
              onClick={() => setFiltros({ ...filtros, tipoAula: 'todas' })}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filtros.tipoAula === 'todas' 
                  ? 'bg-green-600 text-white' 
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setFiltros({ ...filtros, tipoAula: 'realizadas' })}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filtros.tipoAula === 'realizadas' 
                  ? 'bg-green-600 text-white' 
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              <i className="fas fa-check mr-1"></i>{aulasAtivas.length}
            </button>
            <button
              onClick={() => setFiltros({ ...filtros, tipoAula: 'pendentes' })}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filtros.tipoAula === 'pendentes' 
                  ? 'bg-yellow-600 text-white' 
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              <i className="fas fa-clock mr-1"></i>{aulasPendentes.length}
            </button>
            <button
              onClick={() => setFiltros({ ...filtros, tipoAula: 'canceladas' })}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filtros.tipoAula === 'canceladas' 
                  ? 'bg-red-600 text-white' 
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              <i className="fas fa-ban mr-1"></i>{aulasCanceladas.length}
            </button>
          </div>
          <div className="flex gap-2 mt-2">
            <select
              value={filtros.professor}
              onChange={(e) => setFiltros({ ...filtros, professor: e.target.value })}
              className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-xs bg-white"
            >
              <option value="">Professor</option>
              {professores.map((prof) => (
                <option key={prof._id} value={prof._id}>{prof.nome}</option>
              ))}
            </select>
            <select
              value={filtros.modalidade}
              onChange={(e) => setFiltros({ ...filtros, modalidade: e.target.value })}
              className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-xs bg-white"
            >
              <option value="">Modalidade</option>
              {modalidades.map((mod) => (
                <option key={mod._id} value={mod.nome}>{mod.nome}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Filtros Desktop */}
        <div className="hidden md:block bg-white rounded-md border border-gray-200 p-4 mb-6 fade-in-2">
          {/* Filtro de Tipo de Aula - Botões de Tab */}
          <div className="flex gap-2 mb-4 pb-4 border-b border-gray-200">
            <button
              onClick={() => setFiltros({ ...filtros, tipoAula: 'todas' })}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                filtros.tipoAula === 'todas' 
                  ? 'bg-green-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <i className="fas fa-list mr-2"></i>
              Todas
            </button>
            <button
              onClick={() => setFiltros({ ...filtros, tipoAula: 'realizadas' })}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                filtros.tipoAula === 'realizadas' 
                  ? 'bg-green-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <i className="fas fa-check-circle mr-2"></i>
              Realizadas ({aulasAtivas.length})
            </button>
            <button
              onClick={() => setFiltros({ ...filtros, tipoAula: 'pendentes' })}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                filtros.tipoAula === 'pendentes' 
                  ? 'bg-yellow-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <i className="fas fa-clock mr-2"></i>
              Pendentes ({aulasPendentes.length})
            </button>
            <button
              onClick={() => setFiltros({ ...filtros, tipoAula: 'canceladas' })}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                filtros.tipoAula === 'canceladas' 
                  ? 'bg-red-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <i className="fas fa-ban mr-2"></i>
              Canceladas ({aulasCanceladas.length})
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Data Início</label>
              <input
                type="date"
                value={filtros.dataInicio}
                disabled={filtrosDesativados}
                onChange={(e) => {
                  const value = e.target.value;
                  // Validar se o ano tem no máximo 4 dígitos
                  if (value && value.length <= 10) {
                    const year = value.split('-')[0];
                    if (year && year.length <= 4) {
                      setFiltros({ ...filtros, dataInicio: value });
                    }
                  } else if (!value) {
                    setFiltros({ ...filtros, dataInicio: value });
                  }
                }}
                max="9999-12-31"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Data Fim</label>
              <input
                type="date"
                value={filtros.dataFim}
                disabled={filtrosDesativados}
                onChange={(e) => {
                  const value = e.target.value;
                  // Validar se o ano tem no máximo 4 dígitos
                  if (value && value.length <= 10) {
                    const year = value.split('-')[0];
                    if (year && year.length <= 4) {
                      setFiltros({ ...filtros, dataFim: value });
                    }
                  } else if (!value) {
                    setFiltros({ ...filtros, dataFim: value });
                  }
                }}
                className={`w-full px-3 py-2 border border-gray-300 rounded-md text-sm ${filtrosDesativados ? 'bg-gray-100 text-gray-400' : ''}`}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Professor</label>
              <select
                value={filtros.professor}
                disabled={filtrosDesativados}
                onChange={(e) => setFiltros({ ...filtros, professor: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="">Todos</option>
                {professores.map((prof) => (
                  <option key={prof._id} value={prof._id}>{prof.nome}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Modalidade</label>
              <select
                value={filtros.modalidade}
                disabled={filtrosDesativados}
                onChange={(e) => setFiltros({ ...filtros, modalidade: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="">Todas</option>
                {modalidades.map((mod) => (
                  <option key={mod._id} value={mod.nome}>{mod.nome}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1 invisible">Filtros</label>
              <button
                onClick={() => setFiltrosDesativados(!filtrosDesativados)}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  filtrosDesativados 
                    ? 'bg-red-100 text-red-700 hover:bg-red-200 border border-red-300' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
                }`}
                title={filtrosDesativados ? 'Ativar filtros' : 'Desativar todos os filtros e mostrar tudo'}
              >
                <i className={`fas ${filtrosDesativados ? 'fa-filter-circle-xmark' : 'fa-filter'}`}></i>
                {filtrosDesativados ? 'Ativar' : 'Desativar'}
              </button>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-gray-600">
              {filtros.tipoAula === 'realizadas' && `${aulasParaExibir.length} aula${aulasParaExibir.length !== 1 ? 's' : ''} realizada${aulasParaExibir.length !== 1 ? 's' : ''}`}
              {filtros.tipoAula === 'pendentes' && `${pendentesFiltradas.length} aula${pendentesFiltradas.length !== 1 ? 's' : ''} pendente${pendentesFiltradas.length !== 1 ? 's' : ''}`}
              {filtros.tipoAula === 'todas' && `${aulasParaExibir.length} realizada${aulasParaExibir.length !== 1 ? 's' : ''} | ${pendentesFiltradas.length} pendente${pendentesFiltradas.length !== 1 ? 's' : ''}`}
            </p>
            <button
              onClick={() => {
                const today = new Date();
                const dataFim = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                const past = new Date();
                past.setDate(past.getDate() - 30);
                const dataInicio = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, '0')}-${String(past.getDate()).padStart(2, '0')}`;
                
                setFiltros({
                  dataInicio,
                  dataFim,
                  professor: '',
                  modalidade: '',
                  tipoAula: 'todas'
                });
              }}
              className="text-xs text-green-600 hover:text-green-700 font-medium"
            >
              Limpar filtros
            </button>
          </div>
        </div>

        {/* Lista de Aulas */}
        {(filtros.tipoAula === 'realizadas' && aulasParaExibir.length === 0) || 
            (filtros.tipoAula === 'pendentes' && pendentesFiltradas.length === 0) || 
            (filtros.tipoAula === 'todas' && aulasParaExibir.length === 0 && pendentesFiltradas.length === 0) ? (
          <div className="bg-white rounded-md border border-gray-200 p-12 text-center fade-in-3">
            <i className="fas fa-clipboard-list text-gray-300 text-5xl mb-4"></i>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma aula encontrada</h3>
            <p className="text-sm text-gray-600">Ajuste os filtros para ver mais resultados</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Aulas Pendentes */}
            {(filtros.tipoAula === 'pendentes' || filtros.tipoAula === 'todas') && pendentesFiltradas.length > 0 && (
              <>
              {/* Cards Mobile - Pendentes */}
              <div className="md:hidden space-y-3 fade-in-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-yellow-800 mb-2">
                  <i className="fas fa-clock"></i>
                  Pendentes ({pendentesFiltradas.length})
                </div>
                {pendentesParaExibir.map((aula, index) => {
                  const fadeClass = `fade-in-${Math.min((index % 8) + 1, 8)}`;
                  return (
                    <div key={`${aula.horarioFixoId}-${aula.data}`} className={`bg-white rounded-xl border border-yellow-200 shadow-sm overflow-hidden ${fadeClass}`}>
                      <div className="h-1 bg-yellow-400"></div>
                      <div className="p-3">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="text-sm font-semibold text-gray-900">
                              {parseLocalDate(aula.data).toLocaleDateString('pt-BR')}
                            </div>
                            <div className="text-xs text-gray-500">
                              {(() => {
                                try {
                                  const d = parseLocalDate(aula.data);
                                  const wd = d.toLocaleDateString('pt-BR', { weekday: 'long' });
                                  return wd ? wd.charAt(0).toUpperCase() + wd.slice(1) : '';
                                } catch (e) { return ''; }
                              })()} • {aula.horario || '—'}
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-yellow-100 text-yellow-700">
                            Pendente
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getModalidadeColor(aula.modalidade) }}></span>
                            {aula.modalidade}
                          </span>
                          <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getProfessorColor(aula.professorId || aula.professor) }}></span>
                            {aula.professor}
                          </span>
                        </div>
                        <div className="flex justify-end mt-2">
                          <button
                            onClick={() => setPendenteCancelar(aula)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] rounded-lg bg-red-50 text-red-700 font-medium hover:bg-red-100"
                          >
                            <i className="fas fa-ban"></i> Cancelar
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {/* Paginação Mobile Pendentes */}
                {pendentesFiltradas.length > ITENS_POR_PAGINA && (
                  <div className="flex items-center justify-between text-xs text-gray-600 pt-2">
                    <span>{pendentesPage}/{totalPendentesPages}</span>
                    <div className="flex gap-2">
                      <button disabled={pendentesPage === 1} onClick={() => setPendentesPage(p => Math.max(1, p - 1))} className="px-2 py-1 border rounded bg-white disabled:opacity-50">Ant</button>
                      <button disabled={pendentesPage >= totalPendentesPages} onClick={() => setPendentesPage(p => Math.min(totalPendentesPages, p + 1))} className="px-2 py-1 border rounded bg-white disabled:opacity-50">Próx</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Tabela Desktop - Pendentes */}
              <div className="hidden md:block bg-white rounded-md border border-gray-200 overflow-hidden fade-in-3">
                <div className="bg-yellow-50 px-4 py-3 border-b border-yellow-200">
                  <h3 className="text-sm font-semibold text-yellow-800 flex items-center gap-2">
                    <i className="fas fa-clock"></i>
                    Aulas Pendentes ({pendentesFiltradas.length})
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data / Dia / Horário</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Modalidade</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Professor</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {pendentesParaExibir.map((aula, index) => (
                        <tr key={`${aula.horarioFixoId}-${aula.data}`} className={`hover:bg-gray-50 fade-in-${Math.min((index % 8) + 1, 8)}`}>
                                        <td className="px-4 py-3 text-sm text-gray-900">
                                          <div className="font-medium">{parseLocalDate(aula.data).toLocaleDateString('pt-BR')}</div>
                                          <div className="text-xs text-gray-500 mt-0.5">
                                            {(() => {
                                              try {
                                                const d = parseLocalDate(aula.data);
                                                const wd = d.toLocaleDateString('pt-BR', { weekday: 'long' });
                                                const weekday = wd ? wd.charAt(0).toUpperCase() + wd.slice(1) : '';
                                                const horarioStr = aula.horario || '—';
                                                return `${weekday} • ${horarioStr}`;
                                              } catch (e) { return '' }
                                            })()}
                                          </div>
                                        </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            <span className="inline-flex items-center gap-2">
                              <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: getModalidadeColor(aula.modalidade) }} />
                              <span>{aula.modalidade}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            <span className="inline-flex items-center gap-2">
                              <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: getProfessorColor(aula.professorId || aula.professor) }} />
                              <span>{aula.professor}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-center">
                            <button
                              onClick={() => setPendenteCancelar(aula)}
                              className="inline-flex items-center gap-2 px-2 py-1 text-xs rounded-md border bg-red-50 border-red-100 text-red-800 hover:bg-red-100"
                              title="Cancelar aula e gerar crédito"
                            >
                              <i className="fas fa-ban w-3" aria-hidden="true" />
                              <span className="hidden sm:inline">Cancelar</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Paginação Pendentes Desktop */}
                {pendentesFiltradas.length > ITENS_POR_PAGINA && (
                  <div className="px-4 py-3 bg-white border-t border-gray-200 flex items-center justify-between text-sm">
                    <div className="text-gray-600">Mostrando {Math.min(ITENS_POR_PAGINA, pendentesFiltradas.length - (pendentesPage - 1) * ITENS_POR_PAGINA)} de {pendentesFiltradas.length}</div>
                    <div className="flex items-center gap-2">
                      <button disabled={pendentesPage === 1} onClick={() => setPendentesPage(p => Math.max(1, p - 1))} className="px-3 py-1 border rounded-md bg-white disabled:opacity-50">Anterior</button>
                      <div className="text-sm text-gray-700">Página {pendentesPage} de {totalPendentesPages}</div>
                      <button disabled={pendentesPage >= totalPendentesPages} onClick={() => setPendentesPage(p => Math.min(totalPendentesPages, p + 1))} className="px-3 py-1 border rounded-md bg-white disabled:opacity-50">Próxima</button>
                    </div>
                  </div>
                )}
              </div>
              </>
            )}

            {/* Aulas Realizadas */}
            {(filtros.tipoAula === 'realizadas' || filtros.tipoAula === 'todas') && aulasParaExibir.length > 0 && (
              <>
              {/* Cards Mobile - Realizadas */}
              <div className="md:hidden space-y-3 fade-in-3">
                {filtros.tipoAula === 'todas' && (
                  <div className="flex items-center gap-2 text-sm font-semibold text-green-800 mb-2">
                    <i className="fas fa-check-circle"></i>
                    Realizadas ({aulasParaExibir.length})
                  </div>
                )}
                {realizadasParaExibir.map((aula, index) => {
                  const fadeClass = `fade-in-${Math.min((index % 8) + 1, 8)}`;
                  return (
                    <div 
                      key={aula._id} 
                      onClick={() => setAulaParaEditar(aula)}
                      className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden cursor-pointer ${fadeClass}`}
                    >
                      <div className="h-1" style={{ backgroundColor: getModalidadeColor(aula.modalidade || '') }}></div>
                      <div className="p-3">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="text-sm font-semibold text-gray-900">
                              {parseLocalDate(aula.data).toLocaleDateString('pt-BR')}
                            </div>
                            <div className="text-xs text-gray-500">
                              {(() => {
                                try {
                                  const d = parseLocalDate(aula.data);
                                  const wd = d.toLocaleDateString('pt-BR', { weekday: 'long' });
                                  const hi = (aula as any).horarioInicio || '';
                                  const hf = (aula as any).horarioFim || '';
                                  const horarioStr = (hi && hf) ? `${hi} - ${hf}` : (hi || hf || '—');
                                  return `${wd ? wd.charAt(0).toUpperCase() + wd.slice(1) : ''} • ${horarioStr}`;
                                } catch (e) { return ''; }
                              })()}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-semibold">
                              <i className="fas fa-check"></i>{aula.total_presentes || 0}
                            </span>
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-semibold">
                              <i className="fas fa-times"></i>{aula.total_faltas || 0}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 mb-2">
                          <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getModalidadeColor(aula.modalidade || '') }}></span>
                            {aula.modalidade || 'Não informada'}
                          </span>
                          <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getProfessorColor(getProfessorLookupKey(aula)) }}></span>
                            {getProfessorName(aula)}
                          </span>
                        </div>
                        <div className="flex justify-end">
                          <button
                            onClick={(e) => { e.stopPropagation(); setAulaParaExcluir(aula); }}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] rounded-lg bg-yellow-50 text-yellow-700 font-medium"
                          >
                            <i className="fas fa-undo"></i> Devolver
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {/* Paginação Mobile Realizadas */}
                {aulasParaExibir.length > ITENS_POR_PAGINA && (
                  <div className="flex items-center justify-between text-xs text-gray-600 pt-2">
                    <span>{realizadasPage}/{totalRealizadasPages}</span>
                    <div className="flex gap-2">
                      <button disabled={realizadasPage === 1} onClick={() => setRealizadasPage(p => Math.max(1, p - 1))} className="px-2 py-1 border rounded bg-white disabled:opacity-50">Ant</button>
                      <button disabled={realizadasPage >= totalRealizadasPages} onClick={() => setRealizadasPage(p => Math.min(totalRealizadasPages, p + 1))} className="px-2 py-1 border rounded bg-white disabled:opacity-50">Próx</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Tabela Desktop - Realizadas */}
              <div className="hidden md:block bg-white rounded-md border border-gray-200 overflow-hidden fade-in-3">
                {filtros.tipoAula === 'todas' && (
                  <div className="bg-green-50 px-4 py-3 border-b border-green-200">
                    <h3 className="text-sm font-semibold text-green-800 flex items-center gap-2">
                      <i className="fas fa-check-circle"></i>
                      Aulas Realizadas ({aulasParaExibir.length})
                    </h3>
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data / Dia / Horário</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Modalidade</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Professor</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Presentes</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Faltas</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {realizadasParaExibir.map((aula, index) => (
                        <tr
                          key={aula._id}
                          onClick={() => setAulaParaEditar(aula)}
                          className={`hover:bg-gray-50 cursor-pointer fade-in-${Math.min((index % 8) + 1, 8)}`}
                        >
                          <td className="px-4 py-3 text-sm text-gray-900">
                            <div className="font-medium">{parseLocalDate(aula.data).toLocaleDateString('pt-BR')}</div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {(() => {
                                try {
                                  const d = parseLocalDate(aula.data);
                                  const wd = d.toLocaleDateString('pt-BR', { weekday: 'long' });
                                  const weekday = wd ? wd.charAt(0).toUpperCase() + wd.slice(1) : '';
                                  const hi = (aula as any).horarioInicio || '';
                                  const hf = (aula as any).horarioFim || '';
                                  const horarioStr = (hi && hf) ? `${hi} - ${hf}` : (hi || hf || '—');
                                  return `${weekday} • ${horarioStr}`;
                                } catch (e) { return ''; }
                              })()}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            <span className="inline-flex items-center gap-2">
                              <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: getModalidadeColor(aula.modalidade || '') }} />
                              <span>{aula.modalidade || 'Não informada'}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            <span className="inline-flex items-center gap-2">
                              <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: getProfessorColor(getProfessorLookupKey(aula)) }} />
                              <span>{getProfessorName(aula)}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-center">
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-50 text-green-700 font-medium text-xs">
                              <i className="fas fa-check text-xs"></i>
                              {aula.total_presentes || 0}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-center">
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-50 text-red-700 font-medium text-xs">
                              <i className="fas fa-times text-xs"></i>
                              {aula.total_faltas || 0}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); setAulaParaExcluir(aula); }}
                                className={`inline-flex items-center gap-2 px-2 py-1 text-xs rounded-md border bg-yellow-50 border-yellow-100 text-yellow-800 hover:bg-yellow-100`}
                                title="Devolver aula"
                              >
                                <i className="fas fa-undo w-3" aria-hidden="true" />
                                <span className="hidden sm:inline">Devolver</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Paginação Realizadas Desktop */}
                {aulasParaExibir.length > ITENS_POR_PAGINA && (
                  <div className="px-4 py-3 bg-white border-t border-gray-200 flex items-center justify-between text-sm">
                    <div className="text-gray-600">Mostrando {Math.min(ITENS_POR_PAGINA, aulasParaExibir.length - (realizadasPage - 1) * ITENS_POR_PAGINA)} de {aulasParaExibir.length}</div>
                    <div className="flex items-center gap-2">
                      <button disabled={realizadasPage === 1} onClick={() => setRealizadasPage(p => Math.max(1, p - 1))} className="px-3 py-1 border rounded-md bg-white disabled:opacity-50">Anterior</button>
                      <div className="text-sm text-gray-700">Página {realizadasPage} de {totalRealizadasPages}</div>
                      <button disabled={realizadasPage >= totalRealizadasPages} onClick={() => setRealizadasPage(p => Math.min(totalRealizadasPages, p + 1))} className="px-3 py-1 border rounded-md bg-white disabled:opacity-50">Próxima</button>
                    </div>
                  </div>
                )}
              </div>
              </>
            )}

            {/* Aulas Canceladas */}
            {(filtros.tipoAula === 'canceladas' || filtros.tipoAula === 'todas') && canceladasFiltradas.length > 0 && (
              <>
              {/* Cards Mobile - Canceladas */}
              <div className="md:hidden space-y-3 fade-in-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-red-800 mb-2">
                  <i className="fas fa-ban"></i>
                  Canceladas ({canceladasFiltradas.length})
                </div>
                {canceladasParaExibir.map((aula, index) => {
                  const fadeClass = `fade-in-${Math.min((index % 8) + 1, 8)}`;
                  return (
                    <div key={aula._id} className={`bg-white rounded-xl border border-red-200 shadow-sm overflow-hidden ${fadeClass}`}>
                      <div className="h-1 bg-red-400"></div>
                      <div className="p-3">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="text-sm font-semibold text-gray-900">
                              {parseLocalDate(aula.data).toLocaleDateString('pt-BR')}
                            </div>
                            <div className="text-xs text-gray-500">
                              {(() => {
                                try {
                                  const d = parseLocalDate(aula.data);
                                  const wd = d.toLocaleDateString('pt-BR', { weekday: 'long' });
                                  const hi = (aula as any).horarioInicio || '';
                                  const hf = (aula as any).horarioFim || '';
                                  const horarioStr = (hi && hf) ? `${hi} - ${hf}` : (hi || hf || '—');
                                  return `${wd ? wd.charAt(0).toUpperCase() + wd.slice(1) : ''} • ${horarioStr}`;
                                } catch (e) { return ''; }
                              })()}
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-100 text-red-700">
                            Cancelada
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2 mb-2">
                          <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getModalidadeColor(aula.modalidade || '') }}></span>
                            {aula.modalidade || 'Não informada'}
                          </span>
                          <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getProfessorColor(getProfessorLookupKey(aula)) }}></span>
                            {getProfessorName(aula)}
                          </span>
                        </div>
                        {(aula as any).motivoCancelamento && (
                          <div className="text-xs text-gray-500 italic mb-2">
                            <i className="fas fa-info-circle mr-1"></i>
                            {(aula as any).motivoCancelamento}
                          </div>
                        )}
                        <div className="flex justify-end">
                          <button
                            onClick={() => setAulaCanceladaParaDesfazer(aula)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] rounded-lg bg-yellow-50 text-yellow-700 font-medium hover:bg-yellow-100"
                          >
                            <i className="fas fa-undo"></i> Desfazer
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {/* Paginação Mobile Canceladas */}
                {canceladasFiltradas.length > ITENS_POR_PAGINA && (
                  <div className="flex items-center justify-between text-xs text-gray-600 pt-2">
                    <span>{canceladasPage}/{totalCanceladasPages}</span>
                    <div className="flex gap-1">
                      <button
                        disabled={canceladasPage === 1}
                        onClick={() => setCanceladasPage(p => Math.max(1, p - 1))}
                        className="px-2 py-1 border border-gray-300 rounded bg-white disabled:opacity-50"
                      >
                        <i className="fas fa-chevron-left"></i>
                      </button>
                      <button
                        disabled={canceladasPage >= totalCanceladasPages}
                        onClick={() => setCanceladasPage(p => Math.min(totalCanceladasPages, p + 1))}
                        className="px-2 py-1 border border-gray-300 rounded bg-white disabled:opacity-50"
                      >
                        <i className="fas fa-chevron-right"></i>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Tabela Desktop - Canceladas */}
              <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden fade-in-3">
                <div className="p-4 border-b border-gray-200">
                  <h2 className="font-semibold text-red-800 flex items-center gap-2">
                    <i className="fas fa-ban"></i>
                    Aulas Canceladas ({canceladasFiltradas.length})
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Modalidade</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Professor</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Motivo</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {canceladasParaExibir.map(aula => (
                        <tr key={aula._id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-gray-900">
                              {parseLocalDate(aula.data).toLocaleDateString('pt-BR')}
                            </div>
                            <div className="text-xs text-gray-500">
                              {(() => {
                                try {
                                  const d = parseLocalDate(aula.data);
                                  const wd = d.toLocaleDateString('pt-BR', { weekday: 'long' });
                                  const hi = (aula as any).horarioInicio || '';
                                  const hf = (aula as any).horarioFim || '';
                                  const horarioStr = (hi && hf) ? `${hi} - ${hf}` : (hi || hf || '—');
                                  return `${wd ? wd.charAt(0).toUpperCase() + wd.slice(1) : ''} • ${horarioStr}`;
                                } catch (e) { return '' }
                              })()}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            <span className="inline-flex items-center gap-2">
                              <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: getModalidadeColor(aula.modalidade || '') }} />
                              <span>{aula.modalidade || 'Não informada'}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            <span className="inline-flex items-center gap-2">
                              <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: getProfessorColor(getProfessorLookupKey(aula)) }} />
                              <span>{getProfessorName(aula)}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                            {(aula as any).motivoCancelamento || 'Não informado'}
                          </td>
                          <td className="px-4 py-3 text-sm text-center">
                            <button
                              onClick={() => setAulaCanceladaParaDesfazer(aula)}
                              className="inline-flex items-center gap-2 px-2 py-1 text-xs rounded-md border bg-yellow-50 border-yellow-100 text-yellow-800 hover:bg-yellow-100"
                              title="Desfazer cancelamento"
                            >
                              <i className="fas fa-undo w-3" aria-hidden="true" />
                              <span className="hidden sm:inline">Desfazer</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Paginação Desktop Canceladas */}
                {canceladasFiltradas.length > ITENS_POR_PAGINA && (
                  <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-200">
                    <div className="text-sm text-gray-500">
                      Mostrando {(canceladasPage - 1) * ITENS_POR_PAGINA + 1} a {Math.min(canceladasPage * ITENS_POR_PAGINA, canceladasFiltradas.length)} de {canceladasFiltradas.length}
                    </div>
                    <div className="flex items-center gap-2">
                      <button disabled={canceladasPage === 1} onClick={() => setCanceladasPage(p => Math.max(1, p - 1))} className="px-3 py-1 border rounded-md bg-white disabled:opacity-50">Anterior</button>
                      <div className="text-sm text-gray-700">Página {canceladasPage} de {totalCanceladasPages}</div>
                      <button disabled={canceladasPage >= totalCanceladasPages} onClick={() => setCanceladasPage(p => Math.min(totalCanceladasPages, p + 1))} className="px-3 py-1 border rounded-md bg-white disabled:opacity-50">Próxima</button>
                    </div>
                  </div>
                )}
              </div>
              </>
            )}
          </div>
        )}

        {/* Modal de Edição */}
        {aulaParaEditar && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
            <div className="bg-white rounded-lg shadow-lg border p-4 sm:p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                    <i className="fas fa-edit text-primary-600"></i>
                    Editar Aula - {parseLocalDate(aulaParaEditar.data).toLocaleDateString('pt-BR')}
                  </h3>
                  <div className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                    <i className="fas fa-info-circle text-primary-600"></i>
                    <span>Atualize presenças e confirme as alterações da aula</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setAulaParaEditar(null);
                    setAulaEditarEnriquecida(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Fechar"
                >
                  <i className="fas fa-times text-lg"></i>
                </button>
              </div>

              {carregandoDetalhe ? (
                <div className="p-6">
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                        <div className="h-10 bg-gray-200 rounded w-full"></div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : aulaEditarEnriquecida ? (
                <>
                  <div className="p-4 overflow-y-auto max-h-[calc(90vh-200px)] space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
                      <div>
                        <label className="text-sm font-medium text-gray-700">Modalidade</label>
                        <div className="mt-1 text-sm text-gray-900">
                          <span className="inline-flex items-center gap-2">
                            <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: getModalidadeColor(aulaEditarEnriquecida.modalidade || '') }} />
                            <span>{aulaEditarEnriquecida.modalidade}</span>
                          </span>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">Professor</label>
                        <div className="mt-1 text-sm text-gray-900">
                          <span className="inline-flex items-center gap-2">
                            <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: getProfessorColor(getProfessorLookupKey(aulaEditarEnriquecida)) }} />
                            <span>{getProfessorName(aulaEditarEnriquecida)}</span>
                          </span>
                        </div>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-sm font-medium text-gray-700">Data</label>
                        <div className="mt-1 text-sm text-gray-900">{parseLocalDate(aulaEditarEnriquecida.data).toLocaleDateString('pt-BR')}</div>
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <h4 className="text-sm font-semibold text-gray-900 mb-3">Alunos da Aula</h4>
                      <div className="space-y-2">
                        {aulaEditarEnriquecida.alunos
                          .filter(aluno => !aluno.reagendou_para_outro)
                          .map((aluno, index) => {
                            // Encontrar o índice original para manter a funcionalidade de toggle
                            const indexOriginal = aulaEditarEnriquecida.alunos.findIndex(a => 
                              (typeof a.alunoId === 'object' ? a.alunoId._id : a.alunoId) === 
                              (typeof aluno.alunoId === 'object' ? aluno.alunoId._id : aluno.alunoId)
                            );
                            
                            return (
                              <div key={indexOriginal} className="p-3 bg-gray-50 rounded-md border border-gray-100">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <div className="text-sm font-medium text-gray-900 truncate flex items-center gap-2">
                                      {aluno.nome}
                                      {aluno.era_reagendamento ? (
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                          aluno.tipoReagendamento === 'reposicao_falta' ? 'bg-purple-100 text-purple-700' :
                                          aluno.tipoReagendamento === 'reposicao_credito' ? 'bg-orange-100 text-orange-700' :
                                          'bg-blue-100 text-blue-700'
                                        }`}>
                                          <i className={`fas ${
                                            aluno.tipoReagendamento === 'reposicao_falta' ? 'fa-redo' :
                                            aluno.tipoReagendamento === 'reposicao_credito' ? 'fa-gift' :
                                            'fa-arrow-right'
                                          } text-[10px]`}></i>
                                          {aluno.tipoReagendamento === 'reposicao_falta' ? 'Reposição de falta' :
                                           aluno.tipoReagendamento === 'reposicao_credito' ? 'Reposição por crédito' :
                                           'Reagendado para cá'}
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                                          <i className="fas fa-user text-[10px]"></i>
                                          Aluno fixo
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div>
                                    <button
                                      onClick={() => togglePresenca(indexOriginal)}
                                      className={`flex items-center gap-2 px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                                        aluno.presente === true ? 'bg-green-100 text-green-700' :
                                        aluno.presente === false ? 'bg-red-100 text-red-700' :
                                        'bg-gray-200 text-gray-600'
                                      }`}
                                    >
                                      {aluno.presente === true ? (
                                        <><i className="fas fa-check"></i> Presente</>
                                      ) : aluno.presente === false ? (
                                        <><i className="fas fa-times"></i> Faltou</>
                                      ) : (
                                        <><i className="fas fa-minus"></i> Não registrado</>
                                      )}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t flex items-center justify-end gap-3">
                    <button
                      onClick={() => {
                        setAulaParaEditar(null);
                        setAulaEditarEnriquecida(null);
                      }}
                      className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                      disabled={salvando}
                    >
                      <i className="fas fa-times text-gray-500"></i>
                      <span>Cancelar</span>
                    </button>
                    <button
                      onClick={handleSalvarEdicao}
                      className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={salvando}
                    >
                      {salvando ? (
                        <><i className="fas fa-spinner fa-spin"></i> Salvando...</>
                      ) : (
                        <><i className="fas fa-save"></i> Atualizar</>
                      )}
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        )}

        {/* Modal de Confirmação de Devolução */}
        {aulaParaExcluir && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
            <div className="bg-white rounded-lg shadow-lg border p-4 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                          <i className="fas fa-undo text-yellow-600"></i>
                          Devolver Aula
                        </h3>
                        <div className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                          <i className="fas fa-info-circle text-primary-600"></i>
                          <span>A aula será removida e voltará a aparecer como pendente.</span>
                        </div>
                      </div>
                <button
                  onClick={() => setAulaParaExcluir(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Fechar"
                >
                  <i className="fas fa-times text-lg"></i>
                </button>
              </div>

              <div className="p-4 space-y-3">
                  <div className="bg-gray-50 p-3 rounded-md text-sm">
                  <p><strong>Data:</strong> {parseLocalDate(aulaParaExcluir.data).toLocaleDateString('pt-BR')}</p>
                  <p><strong>Modalidade:</strong> {aulaParaExcluir.modalidade}</p>
                  <p><strong>Professor:</strong> {typeof (aulaParaExcluir.professorId as any)?.nome === 'string' 
                    ? (aulaParaExcluir.professorId as any).nome 
                    : aulaParaExcluir.professorNome || 'Não informado'}</p>
                </div>
              </div>

              <div className="pt-3 border-t flex items-center justify-end gap-3">
                <button
                  onClick={() => setAulaParaExcluir(null)}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  disabled={salvando}
                >
                  <i className="fas fa-times text-gray-500"></i>
                  <span>Voltar</span>
                </button>
                <button
                  onClick={handleDevolverAula}
                  className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-md text-sm font-medium hover:bg-yellow-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={salvando}
                >
                  {salvando ? (
                    <><i className="fas fa-spinner fa-spin"></i> Devolvendo...</>
                  ) : (
                    <><i className="fas fa-undo"></i> Confirmar Devolução</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Cancelamento de Aula Pendente */}
        {pendenteCancelar && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
            <div className="bg-white rounded-lg shadow-lg border p-4 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                    <i className="fas fa-ban text-red-600"></i>
                    Cancelar Aula Pendente
                  </h3>
                  <div className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                    <i className="fas fa-info-circle text-primary-600"></i>
                    <span>A aula será marcada como cancelada e crédito de reposição será gerado para todos os alunos.</span>
                  </div>
                </div>
                <button
                  onClick={() => { setPendenteCancelar(null); setMotivoCancelamento(''); }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Fechar"
                >
                  <i className="fas fa-times text-lg"></i>
                </button>
              </div>

              <div className="p-4 space-y-3">
                <div className="bg-gray-50 p-3 rounded-md text-sm">
                  <p><strong>Data:</strong> {parseLocalDate(pendenteCancelar.data).toLocaleDateString('pt-BR')}</p>
                  <p><strong>Modalidade:</strong> {pendenteCancelar.modalidade}</p>
                  <p><strong>Horário:</strong> {pendenteCancelar.horario}</p>
                  <p><strong>Professor:</strong> {pendenteCancelar.professor}</p>
                </div>
                
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                  <div className="flex items-start gap-2">
                    <i className="fas fa-exclamation-triangle text-yellow-600 mt-0.5"></i>
                    <div className="text-xs text-yellow-800">
                      <strong>Atenção:</strong> Ao cancelar esta aula, todos os alunos matriculados neste horário receberão um crédito de reposição automaticamente.
                    </div>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Motivo do cancelamento <span className="text-gray-400 font-normal">(opcional)</span>
                  </label>
                  <textarea
                    value={motivoCancelamento}
                    onChange={(e) => setMotivoCancelamento(e.target.value)}
                    placeholder="Ex.: Professor não compareceu, Feriado não previsto, Problema nas instalações..."
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    rows={2}
                  />
                </div>
              </div>

              <div className="pt-3 border-t flex items-center justify-end gap-3">
                <button
                  onClick={() => { setPendenteCancelar(null); setMotivoCancelamento(''); }}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  disabled={salvando}
                >
                  <i className="fas fa-times text-gray-500"></i>
                  <span>Voltar</span>
                </button>
                <button
                  onClick={handleCancelarPendente}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={salvando}
                >
                  {salvando ? (
                    <><i className="fas fa-spinner fa-spin"></i> Cancelando...</>
                  ) : (
                    <><i className="fas fa-ban"></i> Confirmar Cancelamento</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Desfazer Cancelamento */}
        {aulaCanceladaParaDesfazer && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
            <div className="bg-white rounded-lg shadow-lg border p-4 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                    <i className="fas fa-undo text-yellow-600"></i>
                    Desfazer Cancelamento
                  </h3>
                  <div className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                    <i className="fas fa-info-circle text-primary-600"></i>
                    <span>A aula voltará para o status de pendente e os créditos gerados serão removidos.</span>
                  </div>
                </div>
                <button
                  onClick={() => setAulaCanceladaParaDesfazer(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Fechar"
                >
                  <i className="fas fa-times text-lg"></i>
                </button>
              </div>

              <div className="p-4 space-y-3">
                <div className="bg-gray-50 p-3 rounded-md text-sm">
                  <p><strong>Data:</strong> {parseLocalDate(aulaCanceladaParaDesfazer.data).toLocaleDateString('pt-BR')}</p>
                  <p><strong>Modalidade:</strong> {aulaCanceladaParaDesfazer.modalidade || 'Não informada'}</p>
                  <p><strong>Horário:</strong> {(aulaCanceladaParaDesfazer as any).horarioInicio} - {(aulaCanceladaParaDesfazer as any).horarioFim}</p>
                  <p><strong>Professor:</strong> {getProfessorName(aulaCanceladaParaDesfazer)}</p>
                  {(aulaCanceladaParaDesfazer as any).motivoCancelamento && (
                    <p><strong>Motivo original:</strong> {(aulaCanceladaParaDesfazer as any).motivoCancelamento}</p>
                  )}
                </div>
                
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                  <div className="flex items-start gap-2">
                    <i className="fas fa-exclamation-triangle text-yellow-600 mt-0.5"></i>
                    <div className="text-xs text-yellow-800">
                      <strong>Atenção:</strong> Ao desfazer o cancelamento, os créditos de reposição gerados para os alunos desta aula serão removidos automaticamente. A aula voltará a aparecer como pendente.
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t flex items-center justify-end gap-3">
                <button
                  onClick={() => setAulaCanceladaParaDesfazer(null)}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  disabled={salvando}
                >
                  <i className="fas fa-times text-gray-500"></i>
                  <span>Voltar</span>
                </button>
                <button
                  onClick={handleDesfazerCancelamento}
                  className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-md text-sm font-medium hover:bg-yellow-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={salvando}
                >
                  {salvando ? (
                    <><i className="fas fa-spinner fa-spin"></i> Processando...</>
                  ) : (
                    <><i className="fas fa-undo"></i> Confirmar</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedPage>
  );
}
