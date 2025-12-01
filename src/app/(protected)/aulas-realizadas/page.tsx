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
    horarioFixoId: string;
  }>>([]);

  // Pagination state
  const ITENS_POR_PAGINA = 8;
  const [pendentesPage, setPendentesPage] = useState(1);
  const [realizadasPage, setRealizadasPage] = useState(1);

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

  const getProfessorColor = (idOrName: string) => {
    if (!idOrName) return '#9CA3AF';
    const prof = professores.find(p => String(p._id) === String(idOrName) || String((p.nome || '').toLowerCase()) === String((idOrName || '').toLowerCase()));
    return (prof && (prof.cor || prof.color)) || '#9CA3AF';
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
    // Primeiro tentar pegar o ID do professorId da aula
    if (aula.professorId) {
      if (typeof aula.professorId === 'object' && aula.professorId !== null) {
        return aula.professorId._id || '';
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
            return horario.professorId._id;
          }
          if (typeof horario.professorId === 'string') {
            return horario.professorId;
          }
        }
        if (horario.professor && horario.professor._id) {
          return horario.professor._id;
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
        .map((u: any) => ({ _id: u._id, nome: u.nome, cor: u.cor || '#3B82F6' , ...u }));
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
        horarioFixoId: string;
      }> = [];

      // Obter data de início da plataforma do localStorage
      const dataInicioPlataforma = typeof window !== 'undefined' 
        ? localStorage.getItem('dataInicioPlataforma') || ''
        : '';

      horariosList.forEach(horario => {
        // Se filtros desativados, pular cálculo de pendentes (muito pesado)
        if (filtrosDesativados) return;
        
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
    }
  };

  const handleExcluir = async () => {
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
        toast.success('Aula excluída com sucesso!');
      } else {
        toast.error('Erro ao excluir aula');
      }
    } catch (error) {
      console.error('Erro ao excluir aula:', error);
      toast.error('Erro ao excluir aula');
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
      
      // Buscar reagendamentos aprovados que SAÍRAM deste horário nesta data
      const dataStr = aula.data ? localDateYMD(parseLocalDate(aula.data)) : '';
      
      const resReagendamentos = await fetch('/api/reagendamentos', { headers });
      const reagendamentosData = resReagendamentos.ok ? await resReagendamentos.json() : { data: [] };
      const todosReagendamentos = Array.isArray(reagendamentosData) ? reagendamentosData : (reagendamentosData.data || []);
      
      // Filtrar apenas aprovados
      const reagendamentos = todosReagendamentos.filter((r: any) => r.status === 'aprovado');
      
      // Criar mapa de alunos que reagendaram PARA outro horário (saíram deste horário)
      const alunosQueReagendaram = new Map<string, { novaData: string; novoHorario: string }>();
      
      for (const reag of reagendamentos) {
        const dataOriginalStr = reag.dataOriginal ? localDateYMD(parseLocalDate(reag.dataOriginal)) : '';
        const horarioFixoIdReag = String(reag.horarioFixoId?._id || reag.horarioFixoId || '');
        const horarioFixoIdAula = String(aula.horarioFixoId || '');
        
        // Se a dataOriginal do reagendamento bate com a data desta aula
        // E o horarioFixoId de origem bate com o horário desta aula
        if (dataOriginalStr === dataStr && horarioFixoIdReag === horarioFixoIdAula) {
          // Buscar o alunoId a partir da matricula
          let alunoId = '';
          
          if (reag.matriculaId) {
            if (typeof reag.matriculaId === 'object' && reag.matriculaId !== null) {
              if (reag.matriculaId.alunoId) {
                alunoId = typeof reag.matriculaId.alunoId === 'object' 
                  ? String(reag.matriculaId.alunoId._id || reag.matriculaId.alunoId)
                  : String(reag.matriculaId.alunoId);
              }
            } else if (typeof reag.matriculaId === 'string') {
              // Se só temos o ID da matrícula, precisamos buscar a matrícula
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
      
      // Enriquecer os alunos da aula com informação de reagendamento
      const alunosEnriquecidos = aula.alunos.map(aluno => {
        const alunoIdStr = typeof aluno.alunoId === 'object' 
          ? String((aluno.alunoId as any)._id || aluno.alunoId)
          : String(aluno.alunoId);
        const reagInfo = alunosQueReagendaram.get(alunoIdStr);
        
        return {
          ...aluno,
          reagendou_para_outro: !!reagInfo,
          reagendamento_info: reagInfo || undefined
        };
      });
      
      setAulaEditarEnriquecida({
        ...aula,
        alunos: alunosEnriquecidos
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

  // Filtrar por tipo de aula
  const aulasParaExibir = filtros.tipoAula === 'realizadas' ? aulas : 
                          filtros.tipoAula === 'pendentes' ? [] : 
                          aulas;
  
  const pendentesFiltradas = filtros.tipoAula === 'pendentes' ? aulasPendentes :
                             filtros.tipoAula === 'todas' ? aulasPendentes :
                             [];

  // Reset pagination when filters change
  useEffect(() => {
    setPendentesPage(1);
    setRealizadasPage(1);
  }, [filtros]);

  const totalPendentesPages = Math.max(1, Math.ceil(pendentesFiltradas.length / ITENS_POR_PAGINA));
  const totalRealizadasPages = Math.max(1, Math.ceil(aulasParaExibir.length / ITENS_POR_PAGINA));

  const pendentesParaExibir = pendentesFiltradas.slice((pendentesPage - 1) * ITENS_POR_PAGINA, pendentesPage * ITENS_POR_PAGINA);
  const realizadasParaExibir = aulasParaExibir.slice((realizadasPage - 1) * ITENS_POR_PAGINA, realizadasPage * ITENS_POR_PAGINA);

  // Skeleton loading enquanto não está montado
  if (!mounted) {
    return (
      <ProtectedPage tab="aulas" title="Aulas - Superação Flux">
        <div className="px-4 py-6 sm:px-0">
          {/* Header skeleton */}
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <div className="h-5 bg-gray-200 rounded w-24 mb-2 animate-pulse" />
              <div className="h-4 bg-gray-200 rounded w-64 animate-pulse" />
            </div>
          </div>
          
          {/* Filtros skeleton */}
          <div className="bg-white rounded-md border border-gray-200 p-4 mb-6">
            <div className="flex gap-2 mb-4 pb-4 border-b border-gray-200">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-10 bg-gray-200 rounded-full w-24 animate-pulse" />
              ))}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i}>
                  <div className="h-4 bg-gray-200 rounded w-16 mb-2 animate-pulse" />
                  <div className="h-10 bg-gray-200 rounded w-full animate-pulse" />
                </div>
              ))}
            </div>
          </div>
          
          {/* Cards skeleton */}
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-2 flex-1">
                    <div className="h-5 bg-gray-200 rounded w-32 animate-pulse" />
                    <div className="h-4 bg-gray-200 rounded w-48 animate-pulse" />
                    <div className="h-4 bg-gray-200 rounded w-40 animate-pulse" />
                  </div>
                  <div className="h-6 bg-gray-200 rounded-full w-20 animate-pulse" />
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
      <div className="px-4 py-6 sm:px-0">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 fade-in-1">
          <div>
            <h1 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <i className="fas fa-clipboard-check text-primary-600"></i>
              Aulas
            </h1>
            <p className="mt-2 text-sm text-gray-600">Gerencie as aulas realizadas e pendentes do sistema</p>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-md border border-gray-200 p-4 mb-6 fade-in-2">
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
              Realizadas ({aulas.length})
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
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
                className={`w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${filtrosDesativados ? 'bg-gray-100 text-gray-400' : ''}`}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Professor</label>
              <select
                value={filtros.professor}
                disabled={filtrosDesativados}
                onChange={(e) => setFiltros({ ...filtros, professor: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
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
            {/* Tabela de Aulas Pendentes */}
            {(filtros.tipoAula === 'pendentes' || filtros.tipoAula === 'todas') && pendentesFiltradas.length > 0 && (
              <div className="bg-white rounded-md border border-gray-200 overflow-hidden fade-in-3">
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
                              <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: getProfessorColor(aula.professor) }} />
                              <span>{aula.professor}</span>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Paginação Pendentes */}
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
            )}

            {/* Tabela de Aulas Realizadas */}
            {(filtros.tipoAula === 'realizadas' || filtros.tipoAula === 'todas') && aulasParaExibir.length > 0 && (
              <div className="bg-white rounded-md border border-gray-200 overflow-hidden fade-in-3">
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
                {/* Paginação Realizadas */}
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
            )}
          </div>
        )}

        {/* Modal de Edição */}
        {aulaParaEditar && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-lg border p-6 max-w-3xl w-full max-h-[90vh] overflow-hidden">
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
                <div className="p-12 text-center">
                  <i className="fas fa-spinner fa-spin text-3xl text-primary-600 mb-3"></i>
                  <p className="text-sm text-gray-600">Carregando detalhes da aula...</p>
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
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                          <i className="fas fa-arrow-right text-[10px]"></i>
                                          Reagendado para cá
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

        {/* Modal de Confirmação de Exclusão */}
        {aulaParaExcluir && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-lg border p-6 max-w-md w-full">
              <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                          <i className="fas fa-undo text-primary-600"></i>
                          Confirmar Devolução
                        </h3>
                        <div className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                          <i className="fas fa-info-circle text-primary-600"></i>
                          <span>Esta ação devolverá a aula (removerá o registro de aula realizada).</span>
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

              <div className="p-4">
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
                  <span>Cancelar</span>
                </button>
                <button
                  onClick={handleExcluir}
                  className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-md text-sm font-medium hover:bg-yellow-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={salvando}
                >
                  {salvando ? (
                    <><i className="fas fa-spinner fa-spin"></i> Devolvendo...</>
                  ) : (
                    <><i className="fas fa-undo"></i> Devolver</>
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
