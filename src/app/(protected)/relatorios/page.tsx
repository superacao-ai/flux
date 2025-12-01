 'use client';

import Swal from 'sweetalert2';
import { toast } from 'react-toastify';
import ProtectedPage from '@/components/ProtectedPage';
import { useEffect, useState, useMemo } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  BarController,
  Filler,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  BarController,
  Filler,
  Title,
  Tooltip,
  Legend
);
interface AulaRealizada {
  _id: string;
  data: string;
  modalidade: string;
  status?: 'pendente' | 'enviada' | 'corrigida';
  professorId?: string;
  professorNome?: string;
  horarioFixoId?: string;
  alunos: Array<{
    alunoId: string | { _id: string; nome: string };
    nome: string;
    presente: boolean | null;
    era_reagendamento: boolean;
  }>;
  total_presentes: number;
  total_faltas: number;
}

interface Aluno {
  _id: string;
  nome: string;
  email?: string;
  plano?: string;
  modalidadeId?: {
    nome: string;
    cor?: string;
    id?: string;
  };
  modalidades?: Array<{
    _id: string;
    nome: string;
  }>;
}

interface Reagendamento {
  _id: string;
  status: string;
}

interface RelatorioDados {
  totalAulas: number;
  totalFaltas: number;
  totalPresencas: number;
  reagendamentos: number;
  frequenciaPercentual: number;
  aulasEnviadas: number;
  aulasPendentes: number;
  alunosComMaisFaltas: Array<{
    alunoId: string;
    nome: string;
    plano?: string;
    planoColor?: string;
    modalidades?: string[];
    faltas: number;
    presencas: number;
    frequencia: number;
  }>;
  faltasPorPlano: Array<{
    plano: string;
    planoColor?: string;
    totalFaltas: number;
    totalPresencas: number;
    frequencia: number;
  }>;
  faltasPorProfessor: Array<{
    professorId: string;
    professorNome: string;
    totalFaltas: number;
    totalPresencas: number;
    frequencia: number;
  }>;
}

export default function RelatoriosPage() {
  const [mounted, setMounted] = useState(false);
  const [dados, setDados] = useState<RelatorioDados | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paginaAlunosComFaltas, setPaginaAlunosComFaltas] = useState(1);
  const [filtros, setFiltros] = useState({
    dataInicio: new Date(new Date().setDate(new Date().getDate() - 90)).toISOString().split('T')[0],
    dataFim: new Date().toISOString().split('T')[0],
    professor: '',
    modalidade: ''
  });
  const [professores, setProfessores] = useState<any[]>([]);
  const [modalidades, setModalidades] = useState<any[]>([]);
  const [filtrosDesativados, setFiltrosDesativados] = useState(false);
  const [freqEvolucao, setFreqEvolucao] = useState<{ labels: string[]; data: number[] }>({ labels: [], data: [] });
  const [faltasSemanaHorario, setFaltasSemanaHorario] = useState<{ dias: string[]; horarios: string[]; matriz: number[][] }>({ dias: [], horarios: [], matriz: [] });
  const [faltasPorDia, setFaltasPorDia] = useState<number[]>([]);
  const [faltasPorHorario, setFaltasPorHorario] = useState<number[]>([]);
  
  // Estados para modais
  const [showModalAulasEnviadas, setShowModalAulasEnviadas] = useState(false);
  const [showModalAulasPendentes, setShowModalAulasPendentes] = useState(false);
  const [aulasEnviadas, setAulasEnviadas] = useState<AulaRealizada[]>([]);
  const [aulasPendentes, setAulasPendentes] = useState<Array<{
    data: string;
    horario: string;
    modalidade: string;
    professor: string;
  }>>([]);
  // IDs de aulas em processo de devolução (exclusão)
  const [deletingAulas, setDeletingAulas] = useState<string[]>([]);

  // Marcar como montado
  useEffect(() => {
    setMounted(true);
  }, []);

  const devolverAula = async (aulaId: string) => {
    const result = await Swal.fire({
      title: 'Confirmar Devolução',
      text: 'Confirma devolver/excluir esta aula para que o professor possa reenviar?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sim, devolver',
      cancelButtonText: 'Cancelar'
    });
    if (!result.isConfirmed) return;

    try {
      setDeletingAulas(prev => [...prev, aulaId]);
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await fetch(`/api/aulas-realizadas/${aulaId}`, {
        method: 'DELETE',
        headers,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Erro ao devolver aula');
      }

      // Remover da lista local para atualizar a UI
      setAulasEnviadas(prev => prev.filter(a => String(a._id) !== String(aulaId)));
      toast.success('Aula devolvida com sucesso. O professor poderá enviar novamente.');
    } catch (err) {
      console.error('Erro ao devolver aula:', err);
      toast.error('Erro ao devolver aula. Verifique o console para mais detalhes.');
    } finally {
      setDeletingAulas(prev => prev.filter(id => id !== aulaId));
    }
  };

  const ITENS_POR_PAGINA = 10;

  useEffect(() => {
    const fetchRelatorios = async () => {
      try {
        setLoading(true);

        const token = localStorage.getItem('token');
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

        // Buscar aulas realizadas
        const resAulas = await fetch('/api/aulas-realizadas?listarTodas=true', { headers });
        const aulasRealizadas: AulaRealizada[] = resAulas.ok ? await resAulas.json() : [];

        // Buscar horários fixos
        const resHorarios = await fetch('/api/horarios');
        const horariosData = resHorarios.ok ? await resHorarios.json() : { data: [] };
        const horarios: any[] = Array.isArray(horariosData) ? horariosData : (horariosData.data || []);

        // Buscar alunos
        const resAlunos = await fetch('/api/alunos');
        const alunosResponse = resAlunos.ok ? await resAlunos.json() : { data: [] };
        const alunos: Aluno[] = alunosResponse.data || [];
        
        // Buscar professores a partir de usuários
        const resUsuarios = await fetch('/api/usuarios');
        const usuariosData = resUsuarios.ok ? await resUsuarios.json() : { data: [] };
        let usuariosList: any[] = [];
        if (Array.isArray(usuariosData)) usuariosList = usuariosData;
        else if (usuariosData && usuariosData.data) usuariosList = usuariosData.data;
        const professoresList = usuariosList
          .filter((u: any) => String(u.tipo || '').toLowerCase() === 'professor')
          .map((u: any) => ({ _id: u._id, nome: u.nome, cor: u.cor || '#3B82F6', ...u }));
        setProfessores(professoresList || []);

        // Buscar modalidades
        const resModalidades = await fetch('/api/modalidades');
        const modalidadesData = resModalidades.ok ? await resModalidades.json() : { data: [] };
        setModalidades(modalidadesData.data || []);

        // Buscar reagendamentos
        const resReagendamentos = await fetch('/api/reagendamentos');
        const reagendamentosData = resReagendamentos.ok ? await resReagendamentos.json() : [];
        const reagendamentos: Reagendamento[] = Array.isArray(reagendamentosData) 
          ? reagendamentosData 
          : (reagendamentosData.data || []);

        // Filtrar aulas por data, professor e modalidade
        const aulasFiltradas = aulasRealizadas.filter((aula) => {
          const dataAula = aula.data ? aula.data.split('T')[0] : '';
          const dentroPeriodo = dataAula >= filtros.dataInicio && dataAula <= filtros.dataFim;
          
          const professorId = String((aula.professorId as any)?._id || aula.professorId || '');
          const dentroProfessor = !filtros.professor || professorId === filtros.professor;
          
          const dentroModalidade = !filtros.modalidade || aula.modalidade === filtros.modalidade;
          
          return dentroPeriodo && dentroProfessor && dentroModalidade;
        });

        // 1. Evolução da frequência ao longo do tempo (por semana)
        // Função para calcular a semana ISO e retornar um label legível
        function getWeekLabel(date: Date): { key: string; label: string } {
          const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
          const dayNum = d.getUTCDay() || 7;
          d.setUTCDate(d.getUTCDate() + 4 - dayNum);
          const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
          const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
          const key = `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
          
          // Calcular início e fim da semana para o label
          const startOfWeek = new Date(date);
          const dayOffset = date.getDay() === 0 ? 6 : date.getDay() - 1; // Segunda = início
          startOfWeek.setDate(date.getDate() - dayOffset);
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 6);
          
          const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
          const startDay = startOfWeek.getDate();
          const endDay = endOfWeek.getDate();
          const startMonth = meses[startOfWeek.getMonth()];
          const endMonth = meses[endOfWeek.getMonth()];
          
          // Se mesmo mês: "18-24 Nov", senão "28 Nov-4 Dez"
          const label = startMonth === endMonth 
            ? `${startDay}-${endDay} ${startMonth}`
            : `${startDay} ${startMonth}-${endDay} ${endMonth}`;
          
          return { key, label };
        }

        const freqPorSemana = new Map<string, { presencas: number; total: number; label: string }>();
        aulasFiltradas.forEach(aula => {
          const data = new Date(aula.data);
          const { key, label } = getWeekLabel(data);
          if (!freqPorSemana.has(key)) freqPorSemana.set(key, { presencas: 0, total: 0, label });
          aula.alunos.forEach(alunoAula => {
            if (alunoAula.presente === true) freqPorSemana.get(key)!.presencas++;
            if (alunoAula.presente !== null) freqPorSemana.get(key)!.total++;
          });
        });
        const freqKeys = Array.from(freqPorSemana.keys()).sort();
        const freqLabels = freqKeys.map(key => freqPorSemana.get(key)!.label);
        const freqData = freqKeys.map(key => {
          const { presencas, total } = freqPorSemana.get(key)!;
          return total > 0 ? Math.round((presencas / total) * 100) : 0;
        });
        setFreqEvolucao({ labels: freqLabels, data: freqData });

        // 2. Faltas por dia da semana e horário
        const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        const horariosSet = new Set<string>();
        aulasFiltradas.forEach(aula => {
          if ((aula as any).horarioInicio) horariosSet.add((aula as any).horarioInicio);
        });
        const horariosArr = Array.from(horariosSet).sort();
        // Matriz dias x horários
        const matriz: number[][] = Array(7).fill(0).map(() => Array(horariosArr.length).fill(0));
        aulasFiltradas.forEach(aula => {
          const data = new Date(aula.data);
          const dia = data.getDay();
          const horarioIdx = (aula as any).horarioInicio ? horariosArr.indexOf((aula as any).horarioInicio) : -1;
          if (horarioIdx >= 0) {
            const faltas = aula.alunos.filter(a => a.presente === false).length;
            matriz[dia][horarioIdx] += faltas;
          }
        });
        setFaltasSemanaHorario({ dias: diasSemana, horarios: horariosArr, matriz });
        // Map para lookup rápido de aulas realizadas por horarioFixoId+data
        const aulasMap = new Map<string, AulaRealizada>();
        aulasRealizadas.forEach(aula => {
          const key = `${aula.horarioFixoId || ''}_${aula.data ? aula.data.split('T')[0] : ''}`;
          aulasMap.set(key, aula);
        });

        // Gerar datas esperadas para cada horário fixo no período
        function getDatesForDayOfWeek(start: string, end: string, dayOfWeek: number) {
          const dates = [];
          let current = new Date(start);
          const endDate = new Date(end);
          current.setHours(0,0,0,0);
          endDate.setHours(0,0,0,0);
          // Avançar até o primeiro dia da semana desejado
          while (current.getDay() !== dayOfWeek) {
            current.setDate(current.getDate() + 1);
          }
          while (current <= endDate) {
            dates.push(new Date(current));
            current.setDate(current.getDate() + 7);
          }
          return dates;
        }

        let aulasPendentes = 0;
        const aulasPendentesDetalhadas: Array<{
          data: string;
          horario: string;
          modalidade: string;
          professor: string;
        }> = [];
        
        horarios.forEach(horario => {
          const dias = getDatesForDayOfWeek(filtros.dataInicio, filtros.dataFim, horario.diaSemana);
          dias.forEach(dateObj => {
            const dataStr = dateObj.toISOString().split('T')[0];
            const key = `${horario._id}_${dataStr}`;
            // Só conta como pendente se a data já passou (menor que hoje) e não existe aula realizada
            if (dataStr < new Date().toISOString().split('T')[0] && !aulasMap.has(key)) {
              aulasPendentes++;
              aulasPendentesDetalhadas.push({
                data: dataStr,
                horario: horario.horario || 'Não informado',
                modalidade: horario.modalidade?.nome || 'Não informada',
                professor: horario.professor?.nome || 'Não informado'
              });
            }
          });
        });

        // Contar aulas enviadas normalmente
        const aulasEnviadasFiltradas = aulasFiltradas.filter(a => a.status !== 'pendente');
        const aulasEnviadas = aulasEnviadasFiltradas.length;
        
        // Armazenar detalhes das aulas enviadas e pendentes
        setAulasEnviadas(aulasEnviadasFiltradas);
        setAulasPendentes(aulasPendentesDetalhadas);

        // Calcular faltas por aluno a partir das aulas
        const alunosMap = new Map<string, Aluno>();
        alunos.forEach(a => {
          const id = String(a._id);
          alunosMap.set(id, a);
        });

        const faltasPorAluno = new Map<string, { faltas: number; presencas: number }>();
        
        aulasFiltradas.forEach((aula) => {
          aula.alunos.forEach((alunoAula) => {
            // Extrair ID do aluno (pode vir como string ou objeto)
            const alunoId = typeof alunoAula.alunoId === 'string' 
              ? alunoAula.alunoId 
              : (alunoAula.alunoId as any)?._id || String(alunoAula.alunoId);
            
            if (!faltasPorAluno.has(alunoId)) {
              faltasPorAluno.set(alunoId, { faltas: 0, presencas: 0 });
            }
            
            const stats = faltasPorAluno.get(alunoId)!;
            
            // presente pode ser true, false ou null
            if (alunoAula.presente === true) {
              stats.presencas++;
            } else if (alunoAula.presente === false) {
              stats.faltas++;
            }
          });
        });

        // Calcular métricas totais
        let totalFaltas = 0;
        let totalPresencas = 0;
        faltasPorAluno.forEach(stats => {
          totalFaltas += stats.faltas;
          totalPresencas += stats.presencas;
        });
        const totalAulas = totalFaltas + totalPresencas;
        const frequenciaPercentual = totalAulas > 0 ? ((totalPresencas / totalAulas) * 100).toFixed(1) : 0;

        // Top 10 alunos com mais faltas
        const alunosComMaisFaltas = Array.from(faltasPorAluno.entries())
          .map(([alunoId, stats]) => {
            const aluno = alunosMap.get(alunoId);
            
            // Se não encontrou o aluno no mapa, retornar null
            if (!aluno) {
              return null;
            }
            
            const total = stats.faltas + stats.presencas;
            const frequencia = total > 0 ? ((stats.presencas / total) * 100).toFixed(0) : 0;
            const modalidades = aluno?.modalidades?.map(m => m.nome) || [];
            const plano = aluno?.modalidadeId?.nome || aluno?.plano || 'Sem plano';
            const planoColor = aluno?.modalidadeId?.cor || '#6B7280'; // cor padrão cinza
            
            return {
              alunoId,
              nome: aluno.nome,
              plano,
              planoColor,
              modalidades,
              faltas: stats.faltas,
              presencas: stats.presencas,
              frequencia: Number(frequencia)
            };
          })
          .filter((item): item is NonNullable<typeof item> => item !== null) // Filtrar nulos e garantir tipo
          .sort((a, b) => b.faltas - a.faltas);

        // Calcular faltas por plano
        const faltasPorPlanoMap = new Map<string, { faltas: number; presencas: number; cor?: string }>();
        
        Array.from(faltasPorAluno.entries()).forEach(([alunoId, stats]) => {
          const aluno = alunosMap.get(alunoId);
          if (!aluno) return; // Pular alunos que não existem
          
          const plano = aluno?.modalidadeId?.nome || aluno?.plano || 'Sem plano';
          const cor = aluno?.modalidadeId?.cor;
          
          if (!faltasPorPlanoMap.has(plano)) {
            faltasPorPlanoMap.set(plano, { faltas: 0, presencas: 0, cor });
          }
          
          const planoStats = faltasPorPlanoMap.get(plano)!;
          planoStats.faltas += stats.faltas;
          planoStats.presencas += stats.presencas;
        });

        const faltasPorPlano = Array.from(faltasPorPlanoMap.entries())
          .map(([plano, stats]) => {
            const total = stats.faltas + stats.presencas;
            const frequencia = total > 0 ? ((stats.presencas / total) * 100).toFixed(1) : 0;
            return {
              plano,
              planoColor: stats.cor || '#6B7280',
              totalFaltas: stats.faltas,
              totalPresencas: stats.presencas,
              frequencia: Number(frequencia)
            };
          })
          .sort((a, b) => b.totalFaltas - a.totalFaltas);

        // Calcular faltas por professor
        const faltasPorProfessorMap = new Map<string, { professorNome: string; faltas: number; presencas: number }>();
        
        aulasFiltradas.forEach((aula) => {
          const professorId = String((aula.professorId as any)?._id || aula.professorId) || 'Desconhecido';
          const professorNome = typeof (aula.professorId as any)?.nome === 'string' 
            ? (aula.professorId as any).nome 
            : (typeof aula.professorNome === 'string' ? aula.professorNome : 'Professor Desconhecido');
          
          if (!faltasPorProfessorMap.has(professorId)) {
            faltasPorProfessorMap.set(professorId, { professorNome, faltas: 0, presencas: 0 });
          }
          
          aula.alunos.forEach((alunoAula) => {
            const stats = faltasPorProfessorMap.get(professorId)!;
            
            if (alunoAula.presente === true) {
              stats.presencas++;
            } else if (alunoAula.presente === false) {
              stats.faltas++;
            }
          });
        });

        const faltasPorProfessor = Array.from(faltasPorProfessorMap.entries())
          .map(([professorId, stats]) => {
            const total = stats.faltas + stats.presencas;
            const frequencia = total > 0 ? ((stats.presencas / total) * 100).toFixed(1) : 0;
            return {
              professorId,
              professorNome: stats.professorNome,
              totalFaltas: stats.faltas,
              totalPresencas: stats.presencas,
              frequencia: Number(frequencia)
            };
          })
          .sort((a, b) => b.totalFaltas - a.totalFaltas);

        // Contar reagendamentos aprovados
        const reagendamentosAprovados = reagendamentos.filter(r => r.status === 'aprovado').length;

        setDados({
          totalAulas,
          totalFaltas,
          totalPresencas,
          reagendamentos: reagendamentosAprovados,
          frequenciaPercentual: Number(frequenciaPercentual),
          aulasEnviadas,
          aulasPendentes,
          alunosComMaisFaltas,
          faltasPorPlano,
          faltasPorProfessor
        });
      } catch (err) {
        console.error('Erro ao buscar relatórios:', err);
        setError('Erro ao carregar dados de relatório');
      } finally {
        setLoading(false);
      }
    };

    fetchRelatorios();
  }, [filtros]);

  // Recalcular somas quando a matriz de faltas por semana/horario mudar
  useEffect(() => {
    const matriz = faltasSemanaHorario.matriz || [];
    if (!matriz || matriz.length === 0) {
      setFaltasPorDia([]);
      setFaltasPorHorario([]);
      return;
    }

    // Faltas por dia da semana (soma por linha da matriz)
    setFaltasPorDia(matriz.map(linha => linha.reduce((a, b) => a + b, 0)));
    // Faltas por horário (soma por coluna da matriz)
    const colSums = (faltasSemanaHorario.horarios || []).map((_, j) => matriz.reduce((a, linha) => a + (linha[j] || 0), 0));
    setFaltasPorHorario(colSums);
  }, [faltasSemanaHorario]);

  // Skeleton loading enquanto não está montado
  if (!mounted) {
    return (
      <ProtectedPage tab="relatorios" title="Relatórios - Superação Flux" fullWidth>
        <div className="px-4 py-6 sm:px-0">
          {/* Header skeleton */}
          <div className="mb-8">
            <div className="h-5 bg-gray-200 rounded w-44 mb-2 animate-pulse" />
            <div className="h-4 bg-gray-200 rounded w-72 animate-pulse" />
          </div>
          
          {/* Filtros skeleton */}
          <div className="bg-white rounded-md border border-gray-200 p-4 mb-6">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i}>
                  <div className="h-4 bg-gray-200 rounded w-16 mb-2 animate-pulse" />
                  <div className="h-10 bg-gray-200 rounded w-full animate-pulse" />
                </div>
              ))}
            </div>
          </div>
          
          {/* Stats cards skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="h-4 bg-gray-200 rounded w-24 mb-3 animate-pulse" />
                <div className="h-8 bg-gray-200 rounded w-16 animate-pulse" />
              </div>
            ))}
          </div>
          
          {/* Charts skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1, 2].map(i => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="h-5 bg-gray-200 rounded w-48 mb-4 animate-pulse" />
                <div className="h-48 bg-gray-100 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </ProtectedPage>
    );
  }

  if (error) {
    return (
      <ProtectedPage tab="relatorios" title="Relatórios - Superação Flux">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-600">{error}</p>
          </div>

          {/* Gráficos gerais (separados de 'Faltas por Plano') */}
          <div className="space-y-6">
            {/* Gráfico de evolução da frequência */}
            <div className="bg-white rounded-md shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                <i className="fas fa-chart-line mr-2 text-primary-600"></i>
                Evolução da Frequência (%) por Semana
              </h3>
              <div className="w-full max-w-2xl mx-auto">
                <Line
                  data={{
                    labels: freqEvolucao.labels,
                    datasets: [
                      {
                        label: 'Frequência (%)',
                        data: freqEvolucao.data,
                        borderColor: '#2563eb',
                        backgroundColor: 'rgba(37,99,235,0.1)',
                        fill: true,
                        tension: 0.3,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: { display: false },
                    },
                    scales: {
                      y: { min: 0, max: 100, ticks: { stepSize: 10 } },
                    },
                  }}
                />
              </div>
            </div>

            {/* Gráfico de barra: Faltas por Dia da Semana */}
            <div className="bg-white rounded-md shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                <i className="fas fa-calendar-day mr-2 text-primary-600"></i>
                Faltas por Dia da Semana
              </h3>
              <div className="w-full max-w-2xl mx-auto">
                <Bar
                  data={{
                    labels: faltasSemanaHorario.dias,
                    datasets: [
                      {
                        label: 'Faltas',
                        data: faltasPorDia,
                        backgroundColor: '#f87171',
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: { display: false },
                    },
                    scales: {
                      y: { beginAtZero: true },
                    },
                  }}
                />
              </div>
            </div>

            {/* Gráfico de barra: Faltas por Horário */}
            <div className="bg-white rounded-md shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                <i className="fas fa-clock mr-2 text-primary-600"></i>
                Faltas por Horário
              </h3>
              <div className="w-full max-w-2xl mx-auto">
                <Bar
                  data={{
                    labels: faltasSemanaHorario.horarios,
                    datasets: [
                      {
                        label: 'Faltas',
                        data: faltasPorHorario,
                        backgroundColor: '#fbbf24',
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: { display: false },
                    },
                    scales: {
                      y: { beginAtZero: true },
                    },
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </ProtectedPage>
    );
  }

  return (
    <ProtectedPage tab="relatorios" title="Relatórios - Superação Flux" fullWidth>
      <div className="px-4 py-6 sm:px-0">
        <div className="mb-8 fade-in-1">
          <h1 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <i className="fas fa-chart-bar text-primary-600"></i>
            Relatórios Gerenciais
          </h1>
          <p className="mt-2 text-xs text-gray-600">
            Análises e métricas de frequência, faltas e reagendamentos
          </p>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-md border border-gray-200 p-4 mb-6 fade-in-2">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Data Início</label>
              <input
                type="date"
                value={filtros.dataInicio}
                disabled={filtrosDesativados}
                onChange={(e) => {
                  const value = e.target.value;
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
                className={`w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${filtrosDesativados ? 'bg-gray-100 text-gray-400' : ''}`}
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
                  if (value && value.length <= 10) {
                    const year = value.split('-')[0];
                    if (year && year.length <= 4) {
                      setFiltros({ ...filtros, dataFim: value });
                    }
                  } else if (!value) {
                    setFiltros({ ...filtros, dataFim: value });
                  }
                }}
                max="9999-12-31"
                className={`w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${filtrosDesativados ? 'bg-gray-100 text-gray-400' : ''}`}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Professor</label>
              <select
                value={filtros.professor}
                disabled={filtrosDesativados}
                onChange={(e) => setFiltros({ ...filtros, professor: e.target.value })}
                className={`w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${filtrosDesativados ? 'bg-gray-100 text-gray-400' : ''}`}
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
                className={`w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${filtrosDesativados ? 'bg-gray-100 text-gray-400' : ''}`}
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

          <div className="mt-3 flex items-center justify-end">
            <button
              onClick={() => {
                setFiltros({
                  dataInicio: new Date(new Date().setDate(new Date().getDate() - 90)).toISOString().split('T')[0],
                  dataFim: new Date().toISOString().split('T')[0],
                  professor: '',
                  modalidade: ''
                });
              }}
              className="text-xs text-green-600 hover:text-green-700 font-medium"
            >
              Limpar filtros
            </button>
          </div>
        </div>

        {/* Resumo do Período (cards de Aulas Realizadas/Pendentes removidos por solicitação) */}

  {/* Gráficos de Análise - Todos lado a lado */}
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 fade-in-3">
          {/* Gráfico de Evolução da Frequência */}
          <div className="bg-white rounded-md shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <i className="fas fa-chart-line text-green-600"></i>
              Evolução Frequência
            </h3>
            <div className="w-full">
              {freqEvolucao.labels.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-md flex flex-col items-center justify-center min-h-[200px]">
                  <i className="fas fa-chart-line text-gray-300 text-3xl mb-2"></i>
                  <p className="text-gray-500 text-sm">Sem dados de frequência</p>
                </div>
              ) : (
              <Line
                data={{
                  labels: freqEvolucao.labels,
                  datasets: [
                    {
                      label: 'Frequência (%)',
                      data: freqEvolucao.data,
                      borderColor: '#16a34a',
                      backgroundColor: 'rgba(22,163,74,0.1)',
                      fill: true,
                      tension: 0.3,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: true,
                  plugins: {
                    legend: { display: false },
                  },
                  scales: {
                    y: { min: 0, max: 100, ticks: { stepSize: 20 } },
                  },
                }}
              />
              )}
            </div>
          </div>

          {/* Gráfico de barra: Faltas por Dia da Semana */}
          <div className="bg-white rounded-md shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <i className="fas fa-calendar-day text-green-600"></i>
              Faltas por Dia
            </h3>
            <div className="w-full">
              {faltasPorDia.every(v => v === 0) ? (
                <div className="text-center py-8 bg-gray-50 rounded-md flex flex-col items-center justify-center min-h-[200px]">
                  <i className="fas fa-calendar-day text-gray-300 text-3xl mb-2"></i>
                  <p className="text-gray-500 text-sm">Sem dados de faltas</p>
                </div>
              ) : (
              <Bar
                data={{
                  labels: faltasSemanaHorario.dias,
                  datasets: [
                    {
                      label: 'Faltas',
                      data: faltasPorDia,
                      backgroundColor: '#16a34a',
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: true,
                  plugins: {
                    legend: { display: false },
                  },
                  scales: {
                    y: { beginAtZero: true },
                  },
                }}
              />
              )}
            </div>
          </div>

          {/* Gráfico de barra: Faltas por Horário */}
          <div className="bg-white rounded-md shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <i className="fas fa-clock text-green-600"></i>
              Faltas por Horário
            </h3>
            <div className="w-full">
              {faltasPorHorario.length === 0 || faltasPorHorario.every(v => v === 0) ? (
                <div className="text-center py-8 bg-gray-50 rounded-md flex flex-col items-center justify-center min-h-[200px]">
                  <i className="fas fa-clock text-gray-300 text-3xl mb-2"></i>
                  <p className="text-gray-500 text-sm">Sem dados de faltas</p>
                </div>
              ) : (
              <Bar
                data={{
                  labels: faltasSemanaHorario.horarios,
                  datasets: [
                    {
                      label: 'Faltas',
                      data: faltasPorHorario,
                      backgroundColor: '#16a34a',
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: true,
                  plugins: {
                    legend: { display: false },
                  },
                  scales: {
                    y: { beginAtZero: true },
                  },
                }}
              />
              )}
            </div>
          </div>
        </div>

        {/* Gráficos e Tabelas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 fade-in-5">
          {/* Faltas por Aluno */}
          <div className="bg-white rounded-md shadow-sm border border-gray-200 p-6 lg:col-span-2">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <i className="fas fa-list text-green-600"></i>
              Alunos com Mais Faltas
            </h3>
            {!dados?.alunosComMaisFaltas || dados.alunosComMaisFaltas.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-md flex flex-col items-center justify-center">
                <i className="fas fa-inbox text-gray-300 text-4xl mb-3"></i>
                <p className="text-gray-600 text-sm">Nenhum registro de faltas encontrado no período selecionado</p>
                <p className="text-gray-500 text-xs mt-1">Marque presenças nas aulas para visualizar os dados</p>
              </div>
            ) : (
              <div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">#</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Aluno</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Plano</th>
                        <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700 uppercase">Faltas</th>
                        <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700 uppercase">Presenças</th>
                        <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700 uppercase">Frequência</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {(() => {
                        const inicio = (paginaAlunosComFaltas - 1) * ITENS_POR_PAGINA;
                        const fim = inicio + ITENS_POR_PAGINA;
                        const alunosPaginados = dados.alunosComMaisFaltas.slice(inicio, fim);
                        
                        return alunosPaginados.map((aluno, index) => {
                          const numeroPosicao = inicio + index + 1;
                          const uniqueKey = `aluno-${String(aluno.alunoId)}-${numeroPosicao}`;
                          return (
                            <tr key={uniqueKey} className="hover:bg-gray-50">
                            <td className="px-4 py-2 text-xs">
                              <span className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                                {numeroPosicao}
                              </span>
                            </td>
                            <td className="px-4 py-2">
                              <div>
                                <div className="font-medium text-gray-900 text-xs">{aluno.nome}</div>
                                {aluno.modalidades && aluno.modalidades.length > 0 && (
                                  <div className="text-xs text-gray-500 mt-0.5">
                                    {aluno.modalidades.join(', ')}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-2 text-xs">
                              <span 
                                className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium"
                                style={{
                                  backgroundColor: `${aluno.planoColor}20`,
                                  color: aluno.planoColor
                                }}
                              >
                                {aluno.plano}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-xs text-center">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50 text-red-700 font-medium text-xs">
                                <i className="fas fa-times text-xs"></i>
                                {aluno.faltas}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-xs text-center">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-green-50 text-green-700 font-medium text-xs">
                                <i className="fas fa-check text-xs"></i>
                                {aluno.presencas}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-xs text-center">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-medium text-xs ${
                                aluno.frequencia >= 80 ? 'bg-green-50 text-green-700' : 
                                aluno.frequencia >= 70 ? 'bg-yellow-50 text-yellow-700' : 
                                'bg-red-50 text-red-700'
                              }`}>
                                {aluno.frequencia}%
                              </span>
                            </td>
                          </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>

                {/* Paginação */}
                {dados.alunosComMaisFaltas.length > ITENS_POR_PAGINA && (
                  <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-200 pt-6">
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Página {paginaAlunosComFaltas} de {Math.ceil(dados.alunosComMaisFaltas.length / ITENS_POR_PAGINA)}</span>
                      <span className="mx-2">•</span>
                      <span>Exibindo {((paginaAlunosComFaltas - 1) * ITENS_POR_PAGINA) + 1}-{Math.min(paginaAlunosComFaltas * ITENS_POR_PAGINA, dados.alunosComMaisFaltas.length)} de {dados.alunosComMaisFaltas.length} alunos</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPaginaAlunosComFaltas(1)}
                        disabled={paginaAlunosComFaltas === 1}
                        className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        title="Primeira página"
                      >
                        <i className="fas fa-step-backward"></i>
                      </button>
                      <button
                        onClick={() => setPaginaAlunosComFaltas(p => Math.max(1, p - 1))}
                        disabled={paginaAlunosComFaltas === 1}
                        className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        title="Página anterior"
                      >
                        <i className="fas fa-chevron-left"></i>
                      </button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.ceil(dados.alunosComMaisFaltas.length / ITENS_POR_PAGINA) }).map((_, i) => {
                          const pagina = i + 1;
                          const totalPaginas = Math.ceil(dados.alunosComMaisFaltas.length / ITENS_POR_PAGINA);
                          
                          // Mostrar sempre primeira e última, e páginas ao redor da atual
                          if (pagina === 1 || pagina === totalPaginas || (pagina >= paginaAlunosComFaltas - 1 && pagina <= paginaAlunosComFaltas + 1)) {
                            return (
                              <button
                                key={pagina}
                                onClick={() => setPaginaAlunosComFaltas(pagina)}
                                className={`w-9 h-9 rounded-lg text-sm font-medium transition-all ${
                                  paginaAlunosComFaltas === pagina
                                    ? 'bg-green-600 text-white shadow-md'
                                    : 'border border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400'
                                }`}
                              >
                                {pagina}
                              </button>
                            );
                          } else if (pagina === paginaAlunosComFaltas - 2 || pagina === paginaAlunosComFaltas + 2) {
                            return <span key={`ellipsis-${pagina}`} className="text-gray-400 px-1">...</span>;
                          }
                          return null;
                        })}
                      </div>
                      <button
                        onClick={() => setPaginaAlunosComFaltas(p => p + 1)}
                        disabled={paginaAlunosComFaltas * ITENS_POR_PAGINA >= dados.alunosComMaisFaltas.length}
                        className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        title="Próxima página"
                      >
                        <i className="fas fa-chevron-right"></i>
                      </button>
                      <button
                        onClick={() => setPaginaAlunosComFaltas(Math.ceil(dados.alunosComMaisFaltas.length / ITENS_POR_PAGINA))}
                        disabled={paginaAlunosComFaltas * ITENS_POR_PAGINA >= dados.alunosComMaisFaltas.length}
                        className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        title="Última página"
                      >
                        <i className="fas fa-step-forward"></i>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Aulas Enviadas */}
      {showModalAulasEnviadas && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="bg-green-600 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <i className="fas fa-check"></i>
                Aulas Enviadas ({aulasEnviadas.length})
              </h3>
              <button
                onClick={() => setShowModalAulasEnviadas(false)}
                className="text-white hover:text-gray-200 transition-colors"
              >
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {aulasEnviadas.length === 0 ? (
                <div className="text-center py-12">
                  <i className="fas fa-inbox text-gray-300 text-5xl mb-4"></i>
                  <p className="text-gray-500">Nenhuma aula enviada no período</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Modalidade</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Professor</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Presentes</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Faltas</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {aulasEnviadas.map((aula, index) => (
                          <tr key={aula._id} className={`hover:bg-gray-50 fade-in-${Math.min((index % 8) + 1, 8)}`}>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {new Date(aula.data).toLocaleDateString('pt-BR')}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {aula.modalidade || 'Não informada'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {typeof (aula.professorId as any)?.nome === 'string' 
                                ? (aula.professorId as any).nome 
                                : aula.professorNome || 'Não informado'}
                            </td>
                            <td className="px-4 py-3 text-sm text-center">
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-50 text-green-700 font-medium">
                                <i className="fas fa-check text-xs"></i>
                                {aula.total_presentes || 0}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-center">
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-50 text-red-700 font-medium">
                                <i className="fas fa-times text-xs"></i>
                                {aula.total_faltas || 0}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-center">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                aula.status === 'enviada' ? 'bg-green-50 text-green-700' :
                                aula.status === 'corrigida' ? 'bg-blue-50 text-blue-700' :
                                'bg-gray-50 text-gray-700'
                              }`}>
                                {aula.status || 'enviada'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-center">
                              <button
                                onClick={() => devolverAula(String(aula._id))}
                                disabled={deletingAulas.includes(String(aula._id))}
                                className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-medium transition-colors border ${deletingAulas.includes(String(aula._id)) ? 'opacity-50 cursor-not-allowed bg-gray-100 border-gray-200 text-gray-500' : 'bg-white hover:bg-red-50 border-red-200 text-red-700'}`}
                                title="Devolver aula ao professor"
                              >
                                <i className="fas fa-undo-alt text-sm"></i>
                                <span>Devolver</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Aulas Pendentes */}
      {showModalAulasPendentes && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="bg-yellow-600 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <i className="fas fa-clock"></i>
                Aulas Pendentes ({aulasPendentes.length})
              </h3>
              <button
                onClick={() => setShowModalAulasPendentes(false)}
                className="text-white hover:text-gray-200 transition-colors"
              >
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {aulasPendentes.length === 0 ? (
                <div className="text-center py-12">
                  <i className="fas fa-check-circle text-green-300 text-5xl mb-4"></i>
                  <p className="text-gray-500">Nenhuma aula pendente! 🎉</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Horário</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Modalidade</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Professor</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {aulasPendentes.map((aula, index) => (
                        <tr key={index} className={`hover:bg-gray-50 fade-in-${Math.min((index % 8) + 1, 8)}`}>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {new Date(aula.data).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {aula.horario}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {aula.modalidade}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {aula.professor}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </ProtectedPage>
  );
}