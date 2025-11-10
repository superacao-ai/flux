'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { useCountAnimation } from '@/hooks/useCountAnimation';

interface User {
  id: string;
  nome: string;
  email: string;
  tipo: 'admin' | 'professor';
}

interface AulaRecente {
  _id: string;
  data: string;
  modalidade: string;
  total_presentes: number;
  total_faltas: number;
  professorId?: { nome: string; cor?: string };
}

interface HorarioProximo {
  _id: string;
  diaSemana: number;
  horarioInicio: string;
  horarioFim: string;
  alunoId?: { nome: string };
  professorId?: { nome: string };
  modalidadeId?: { nome: string; cor?: string };
}

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState({
    totalAlunos: 0,
    totalProfessores: 0,
    totalHorarios: 0,
    alunosAtivos: 0,
    aulasHoje: 0,
    taxaFrequencia: 0,
    modalidades: 0
  });
  const [hydrated, setHydrated] = useState(false);
  const router = useRouter();

  // Admin-specific state
  const [pendingReags, setPendingReags] = useState<number>(0);
  const [incompleteAlunos, setIncompleteAlunos] = useState<number>(0);
  const [aulasRecentes, setAulasRecentes] = useState<AulaRecente[]>([]);
  const [horariosHoje, setHorariosHoje] = useState<HorarioProximo[]>([]);
  const [topModalidades, setTopModalidades] = useState<Array<{nome: string; count: number; cor?: string}>>([]);
  const [dataInicioPlataforma, setDataInicioPlataforma] = useState<string>('');
  const [editandoDataInicio, setEditandoDataInicio] = useState<boolean>(false);

  // Professor-specific state
  const [meusAlunosAtivos, setMeusAlunosAtivos] = useState(0);
  const [minhasAulasHoje, setMinhasAulasHoje] = useState(0);
  const [proximasAulas, setProximasAulas] = useState<HorarioProximo[]>([]);

  // Animated counters
  const animatedTotalAlunos = useCountAnimation(stats.totalAlunos, 800);
  const animatedTotalProfessores = useCountAnimation(stats.totalProfessores, 800);
  const animatedTotalHorarios = useCountAnimation(stats.totalHorarios, 800);
  const animatedTaxaFrequencia = useCountAnimation(stats.taxaFrequencia, 800);
  const animatedAlunosAtivos = useCountAnimation(stats.alunosAtivos, 800);
  const animatedAulasHoje = useCountAnimation(stats.aulasHoje, 800);
  const animatedPendingReags = useCountAnimation(pendingReags, 800);
  const animatedIncompleteAlunos = useCountAnimation(incompleteAlunos, 800);
  const animatedMeusAlunosAtivos = useCountAnimation(meusAlunosAtivos, 800);
  const animatedMinhasAulasHoje = useCountAnimation(minhasAulasHoje, 800);

  useEffect(() => {
    // Verificar se está logado
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/login');
      return;
    }

    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);
    
    // Carregar data de início da plataforma
    const dataInicio = localStorage.getItem('dataInicioPlataforma') || '';
    setDataInicioPlataforma(dataInicio);
    
    if (parsedUser.tipo === 'professor') {
      loadProfessorStats(parsedUser);
    } else {
      loadStats();
      loadAdminExtras();
      loadAulasRecentes();
      loadHorariosHoje();
    }
    
    setHydrated(true);
  }, [router]);

  const loadStats = async () => {
    try {
      const [alunosRes, professoresRes, horariosRes, modalidadesRes] = await Promise.all([
        fetch('/api/alunos'),
        fetch('/api/professores'),
        fetch('/api/horarios'),
        fetch('/api/modalidades')
      ]);

      const alunos = await alunosRes.json();
      const professores = await professoresRes.json();
      const horarios = await horariosRes.json();
      const modalidades = await modalidadesRes.json();

      console.log('📊 Dashboard - Dados recebidos:');
      console.log('Alunos:', alunos);
      console.log('Professores:', professores);
      console.log('Horários:', horarios);
      console.log('Modalidades:', modalidades);

      const alunosList = alunos.data || [];
      const alunosAtivos = alunosList.filter((a: any) => a.ativo !== false).length;
      
      console.log('📊 Total de alunos:', alunosList.length);
      console.log('📊 Alunos ativos:', alunosAtivos);

      // Contar horários de hoje
      const hoje = new Date().getDay();
      const horariosHoje = (horarios.data || []).filter((h: any) => h.diaSemana === hoje && h.ativo).length;

      // Calcular taxa de frequência das últimas aulas
      const aulasRes = await fetch('/api/aulas-realizadas?listarTodas=true');
      const aulasData = await aulasRes.json();
      const aulas = Array.isArray(aulasData) ? aulasData : (aulasData.data || []);
      
      const ultimasAulas = aulas.slice(0, 50);
      const totalPresencas = ultimasAulas.reduce((acc: number, a: any) => acc + (a.total_presentes || 0), 0);
      const totalRegistros = ultimasAulas.reduce((acc: number, a: any) => acc + (a.total_presentes || 0) + (a.total_faltas || 0), 0);
      const taxaFrequencia = totalRegistros > 0 ? Math.round((totalPresencas / totalRegistros) * 100) : 0;

      console.log('📊 Horários totais:', horarios.data?.length || 0);
      console.log('📊 Horários de hoje:', horariosHoje);

      setStats({
        totalAlunos: alunosList.length,
        totalProfessores: professores.data?.length || 0,
        totalHorarios: horarios.data?.length || 0,
        alunosAtivos,
        aulasHoje: horariosHoje,
        taxaFrequencia,
        modalidades: modalidades.data?.length || 0
      });

      console.log('📊 Stats atualizados:', {
        totalAlunos: alunosList.length,
        totalProfessores: professores.data?.length || 0,
        totalHorarios: horarios.data?.length || 0,
        alunosAtivos,
        aulasHoje: horariosHoje,
        taxaFrequencia,
        modalidades: modalidades.data?.length || 0
      });

      // Top modalidades
      const modalidadesMap = new Map<string, {count: number; cor?: string}>();
      (horarios.data || []).forEach((h: any) => {
        const modNome = h.modalidadeId?.nome || 'Sem modalidade';
        const modCor = h.modalidadeId?.cor;
        if (!modalidadesMap.has(modNome)) {
          modalidadesMap.set(modNome, { count: 0, cor: modCor });
        }
        modalidadesMap.get(modNome)!.count++;
      });

      const top = Array.from(modalidadesMap.entries())
        .map(([nome, data]) => ({ nome, count: data.count, cor: data.cor }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      
      setTopModalidades(top);

    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  };

  const loadAdminExtras = async () => {
    try {
      const [reagsRes, alunosRes] = await Promise.all([
        fetch('/api/reagendamentos'),
        fetch('/api/alunos')
      ]);
      const rj = await reagsRes.json().catch(() => ({}));
      const aj = await alunosRes.json().catch(() => ({}));
      const reags = (rj && rj.data) ? rj.data : (Array.isArray(rj) ? rj : []);
      const alunosList = (aj && aj.data) ? aj.data : (Array.isArray(aj) ? aj : []);

      const pending = (reags || []).filter((x: any) => String(x.status) === 'pendente' || String(x.status) === 'criado').length;
      const incomplete = (alunosList || []).filter((a: any) => !a.email || !a.nome).length;

      setPendingReags(pending);
      setIncompleteAlunos(incomplete);
    } catch (e) {
      console.error('Erro ao carregar extras admin', e);
    }
  };

  const loadAulasRecentes = async () => {
    try {
      const res = await fetch('/api/aulas-realizadas?listarTodas=true');
      const data = await res.json();
      const aulas = Array.isArray(data) ? data : (data.data || []);
      
      console.log('📚 Aulas recentes carregadas:', aulas.slice(0, 2));
      console.log('📚 Primeiro professor:', aulas[0]?.professorId);
      
      setAulasRecentes(aulas.slice(0, 5));
    } catch (e) {
      console.error('Erro ao carregar aulas recentes', e);
    }
  };

  const loadHorariosHoje = async () => {
    try {
      const res = await fetch('/api/horarios');
      const data = await res.json();
      const horarios = data.data || [];
      
      const hoje = new Date().getDay();
      const horariosHoje = horarios.filter((h: any) => h.diaSemana === hoje && h.ativo).slice(0, 6);
      
      setHorariosHoje(horariosHoje);
    } catch (e) {
      console.error('Erro ao carregar horários de hoje', e);
    }
  };

  const loadProfessorStats = async (profUser: User) => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/me/horarios', { headers });
      const json = await res.json().catch(() => null);

      let horarios: any[] = [];
      if (Array.isArray(json)) horarios = json;
      else if (json?.data) horarios = json.data;
      else if (json?.horarios) horarios = json.horarios;

      // fallback to all horarios filtered by professor id
      if (!horarios || horarios.length === 0) {
        const allRes = await fetch('/api/horarios');
        const allJson = await allRes.json();
        const all = allJson?.data || [];
        horarios = all.filter((h: any) => {
          const rawProf = h.professorId;
          const profIdStr = rawProf && typeof rawProf === 'object' ? (rawProf._id || rawProf.id || '') : String(rawProf || '');
          return String(profUser.id) === String(profIdStr);
        });
      }

      // Unique students
      const alunoMap = new Map<string, any>();
      horarios.forEach(h => {
        const a = h.alunoId;
        if (!a) return;
        if (Array.isArray(a)) {
          a.forEach((it: any) => {
            const id = typeof it === 'string' ? it : (it._id || it.id || '')
            if (id) alunoMap.set(String(id), it);
          })
        } else {
          const id = typeof a === 'string' ? a : (a._id || a.id || '');
          if (id) alunoMap.set(String(id), a);
        }
      });

      // Horários de hoje
      const hoje = new Date().getDay();
      const horariosHoje = horarios.filter(h => h.diaSemana === hoje && h.ativo);

      // Próximas aulas (ordenadas por horário)
      const proximasAulas = horariosHoje
        .sort((a, b) => a.horarioInicio.localeCompare(b.horarioInicio))
        .slice(0, 5);

      setMeusAlunosAtivos(alunoMap.size);
      setMinhasAulasHoje(horariosHoje.length);
      setProximasAulas(proximasAulas);
      
      setStats({
        totalAlunos: alunoMap.size,
        totalProfessores: 1,
        totalHorarios: horarios.length,
        alunosAtivos: alunoMap.size,
        aulasHoje: horariosHoje.length,
        taxaFrequencia: 0,
        modalidades: 0
      });
    } catch (error) {
      console.error('Erro ao carregar dados do professor:', error);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    } catch {
      return '--/--';
    }
  };

  const salvarDataInicioPlataforma = () => {
    if (!dataInicioPlataforma) {
      alert('Por favor, informe uma data válida.');
      return;
    }
    localStorage.setItem('dataInicioPlataforma', dataInicioPlataforma);
    setEditandoDataInicio(false);
    alert('Data de início da plataforma salva com sucesso!');
  };

  const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  // Skeleton loading
  if (!hydrated) {
    return (
      <Layout title="Dashboard - Superação Flux" fullWidth>
        <div className="p-6">
          <div className="mb-6">
            <div className="h-6 bg-gray-200 rounded w-48 mb-2 animate-pulse" />
            <div className="h-4 bg-gray-200 rounded w-64 animate-pulse" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-24 mb-4" />
                <div className="h-8 bg-gray-200 rounded w-16" />
              </div>
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Dashboard - Superação Flux" fullWidth>
      <div className="p-6 bg-gray-50 min-h-screen">
        {/* Logo and Header */}
        <div className="mb-8 text-center fade-in-1">
          <img src="/logoverde.png" alt="Studio Superação" className="h-12 w-auto mx-auto mb-2" />
          <p className="mt-2 text-sm text-gray-600">
            Bem-vindo(a), <span className="font-semibold">{user?.nome}</span> • {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>

        {user?.tipo === 'professor' ? (
          <>
            {/* Professor Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-gradient-to-br from-green-400 to-green-500 rounded-lg border border-green-400 p-6 text-white fade-in-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-90 mb-1">Meus Alunos</p>
                    <p className="text-3xl font-bold">{animatedMeusAlunosAtivos}</p>
                  </div>
                  <div className="w-12 h-12 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                    <i className="fas fa-users text-2xl"></i>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg border border-green-500 p-6 text-white fade-in-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-90 mb-1">Aulas Hoje</p>
                    <p className="text-3xl font-bold">{animatedMinhasAulasHoje}</p>
                  </div>
                  <div className="w-12 h-12 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                    <i className="fas fa-calendar-check text-2xl"></i>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-lg border border-green-600 p-6 text-white fade-in-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-90 mb-1">Horários</p>
                    <p className="text-3xl font-bold">{animatedTotalHorarios}</p>
                  </div>
                  <div className="w-12 h-12 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                    <i className="fas fa-clock text-2xl"></i>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-green-700 to-green-800 rounded-lg border border-green-700 p-6 text-white fade-in-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-90 mb-1">Próximas</p>
                    <p className="text-3xl font-bold">{proximasAulas.length}</p>
                  </div>
                  <div className="w-12 h-12 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                    <i className="fas fa-hourglass-half text-2xl"></i>
                  </div>
                </div>
              </div>
            </div>

            {/* Próximas Aulas */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 fade-in-3">
              <div className="bg-white rounded-md border border-gray-200">
                <div className="p-4 border-b border-gray-200">
                  <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <img src="/logoverde.png" alt="Studio Superação" className="h-16 w-auto mx-auto" />
                  </h2>
                </div>
                <div className="p-4">
                  {proximasAulas.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 text-sm">
                      <i className="fas fa-calendar-times text-3xl mb-2 block text-gray-300"></i>
                      <p>Nenhuma aula agendada para hoje</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {proximasAulas.map((aula) => (
                        <div key={aula._id} className="flex items-center gap-3 p-3 rounded-md bg-gray-50 border border-gray-200">
                          <div className="w-1 h-14 rounded-full" style={{ backgroundColor: aula.modalidadeId?.cor || '#3B82F6' }}></div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-gray-900">{aula.horarioInicio} - {aula.horarioFim}</p>
                            <p className="text-xs text-gray-600">{aula.modalidadeId?.nome || 'Modalidade'}</p>
                            {aula.alunoId && <p className="text-xs text-gray-500 mt-1">{aula.alunoId.nome}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Ações Rápidas Professor */}
              <div className="bg-white rounded-md border border-gray-200">
                <div className="p-4 border-b border-gray-200">
                  <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <i className="fas fa-bolt text-primary-600"></i>
                    Ações Rápidas
                  </h2>
                </div>
                <div className="p-4 space-y-3">
                  <a href="/professor/minhaagenda" className="flex items-center gap-3 p-3 rounded-md bg-green-50 hover:bg-green-100 transition-colors border border-green-200">
                    <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center text-white">
                      <i className="fas fa-calendar-alt"></i>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">Minha Agenda</p>
                      <p className="text-xs text-gray-600">Ver e gerenciar horários</p>
                    </div>
                    <i className="fas fa-chevron-right text-gray-400"></i>
                  </a>

                  <a href="/professor/alunos" className="flex items-center gap-3 p-3 rounded-md bg-green-50 hover:bg-green-100 transition-colors border border-green-200">
                    <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center text-white">
                      <i className="fas fa-users"></i>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">Meus Alunos</p>
                      <p className="text-xs text-gray-600">Lista completa de alunos</p>
                    </div>
                    <i className="fas fa-chevron-right text-gray-400"></i>
                  </a>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Admin Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-gradient-to-br from-green-400 to-green-500 rounded-lg border border-green-400 p-6 text-white fade-in-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-90 mb-1">Total de Alunos</p>
                    <p className="text-3xl font-bold">{animatedTotalAlunos}</p>
                    <p className="text-xs opacity-75 mt-1">{animatedAlunosAtivos} ativos</p>
                  </div>
                  <div className="w-12 h-12 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                    <i className="fas fa-users text-2xl"></i>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg border border-green-500 p-6 text-white fade-in-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-90 mb-1">Professores</p>
                    <p className="text-3xl font-bold">{animatedTotalProfessores}</p>
                    <p className="text-xs opacity-75 mt-1">Equipe ativa</p>
                  </div>
                  <div className="w-12 h-12 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                    <i className="fas fa-chalkboard-teacher text-2xl"></i>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-lg border border-green-600 p-6 text-white fade-in-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-90 mb-1">Horários Fixos</p>
                    <p className="text-3xl font-bold">{animatedTotalHorarios}</p>
                    <p className="text-xs opacity-75 mt-1">{animatedAulasHoje} aulas hoje</p>
                  </div>
                  <div className="w-12 h-12 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                    <i className="fas fa-clock text-2xl"></i>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-green-700 to-green-800 rounded-lg border border-green-700 p-6 text-white fade-in-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-90 mb-1">Frequência</p>
                    <p className="text-3xl font-bold">{animatedTaxaFrequencia}%</p>
                    <p className="text-xs opacity-75 mt-1">Últimas 50 aulas</p>
                  </div>
                  <div className="w-12 h-12 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                    <i className="fas fa-chart-line text-2xl"></i>
                  </div>
                </div>
              </div>
            </div>

            {/* Alertas e Pendências */}
            {(pendingReags > 0 || incompleteAlunos > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 fade-in-3">
                {pendingReags > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-yellow-500 rounded-lg flex items-center justify-center text-white flex-shrink-0">
                        <i className="fas fa-exclamation-triangle"></i>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-yellow-900">Reagendamentos Pendentes</p>
                        <p className="text-xs text-yellow-700 mt-1">{animatedPendingReags} solicitações aguardando aprovação</p>
                      </div>
                      <a href="/reagendamentos" className="text-sm font-medium text-yellow-700 hover:text-yellow-900">
                        Ver <i className="fas fa-chevron-right ml-1"></i>
                      </a>
                    </div>
                  </div>
                )}

                {incompleteAlunos > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-red-500 rounded-lg flex items-center justify-center text-white flex-shrink-0">
                        <i className="fas fa-user-times"></i>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-red-900">Cadastros Incompletos</p>
                        <p className="text-xs text-red-700 mt-1">{animatedIncompleteAlunos} alunos com dados faltando</p>
                      </div>
                      <a href="/alunos" className="text-sm font-medium text-red-700 hover:text-red-900">
                        Ver <i className="fas fa-chevron-right ml-1"></i>
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Configuração de Data de Início */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 fade-in-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center text-white flex-shrink-0">
                  <i className="fas fa-calendar-check"></i>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-blue-900 mb-2">Data de Início da Plataforma</p>
                  <p className="text-xs text-blue-700 mb-3">
                    Configure a data de início oficial do sistema para evitar cálculo de aulas pendentes anteriores a essa data.
                  </p>
                  
                  {editandoDataInicio ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={dataInicioPlataforma}
                        onChange={(e) => setDataInicioPlataforma(e.target.value)}
                        className="px-3 py-2 border border-blue-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={salvarDataInicioPlataforma}
                        className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
                      >
                        <i className="fas fa-save mr-1"></i> Salvar
                      </button>
                      <button
                        onClick={() => setEditandoDataInicio(false)}
                        className="px-4 py-2 bg-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-400 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      {dataInicioPlataforma ? (
                        <>
                          <span className="text-sm font-medium text-blue-900">
                            <i className="fas fa-calendar mr-2"></i>
                            {new Date(dataInicioPlataforma + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                          </span>
                          <button
                            onClick={() => setEditandoDataInicio(true)}
                            className="text-sm font-medium text-blue-700 hover:text-blue-900"
                          >
                            <i className="fas fa-edit mr-1"></i> Alterar
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setEditandoDataInicio(true)}
                          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
                        >
                          <i className="fas fa-plus mr-1"></i> Definir Data de Início
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Aulas Recentes */}
              <div className="lg:col-span-2 bg-white rounded-md border border-gray-200 fade-in-4">
                <div className="p-4 border-b border-gray-200">
                  <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <i className="fas fa-history text-primary-600"></i>
                    Aulas Recentes
                  </h2>
                </div>
                <div className="p-4">
                  {aulasRecentes.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 text-sm">
                      <i className="fas fa-inbox text-3xl mb-2 block text-gray-300"></i>
                      <p>Nenhuma aula registrada ainda</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {aulasRecentes.map((aula) => (
                        <div key={aula._id} className="flex items-center justify-between p-3 rounded-md bg-gray-50 border border-gray-200">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900">{aula.modalidade}</p>
                            <p className="text-xs text-gray-600 mt-1">
                              {formatDate(aula.data)} • {aula.professorId?.nome || 'Professor'}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                            <div className="text-right">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-green-600 font-medium">
                                  <i className="fas fa-check text-xs mr-1"></i>
                                  {aula.total_presentes}
                                </span>
                                <span className="text-xs text-red-600 font-medium">
                                  <i className="fas fa-times text-xs mr-1"></i>
                                  {aula.total_faltas}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Top Modalidades */}
              <div className="bg-white rounded-md border border-gray-200 fade-in-5">
                <div className="p-4 border-b border-gray-200">
                  <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <i className="fas fa-fire text-primary-600"></i>
                    Modalidades Populares
                  </h2>
                </div>
                <div className="p-4">
                  {topModalidades.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 text-sm">
                      <p>Sem dados disponíveis</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {topModalidades.map((mod, idx) => (
                        <div key={mod.nome} className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: mod.cor || '#3B82F6' }}>
                            {idx + 1}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{mod.nome}</p>
                            <p className="text-xs text-gray-500">{mod.count} horários</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Horários de Hoje */}
            <div className="mt-6 bg-white rounded-md border border-gray-200 fade-in-6">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <i className="fas fa-calendar-day text-primary-600"></i>
                  Horários de Hoje ({diasSemana[new Date().getDay()]})
                </h2>
              </div>
              <div className="p-4">
                {horariosHoje.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    <div className="flex justify-center mb-3">
                      <i className="fas fa-calendar-times text-3xl text-gray-300"></i>
                    </div>
                    <p>Nenhum horário agendado para hoje</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {horariosHoje.map((horario) => (
                      <div key={horario._id} className="flex items-center gap-3 p-3 rounded-md bg-gray-50 border border-gray-200">
                        <div className="w-1 h-14 rounded-full" style={{ backgroundColor: horario.modalidadeId?.cor || '#3B82F6' }}></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{horario.horarioInicio} - {horario.horarioFim}</p>
                          <p className="text-xs text-gray-600 truncate">{horario.modalidadeId?.nome || 'Modalidade'}</p>
                          {horario.professorId && <p className="text-xs text-gray-500 truncate">{horario.professorId.nome}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Ações Rápidas Admin */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 fade-in-7">
              <a href="/alunos" className="flex items-center gap-3 p-4 rounded-md bg-white hover:bg-gray-50 transition-colors border border-gray-200">
                <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center text-white flex-shrink-0">
                  <i className="fas fa-user-plus"></i>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Novo Aluno</p>
                  <p className="text-xs text-gray-600">Cadastrar</p>
                </div>
              </a>

              <a href="/horarios" className="flex items-center gap-3 p-4 rounded-md bg-white hover:bg-gray-50 transition-colors border border-gray-200">
                <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center text-white flex-shrink-0">
                  <i className="fas fa-calendar-plus"></i>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Horários</p>
                  <p className="text-xs text-gray-600">Gerenciar</p>
                </div>
              </a>

              <a href="/relatorios" className="flex items-center gap-3 p-4 rounded-md bg-white hover:bg-gray-50 transition-colors border border-gray-200">
                <div className="w-10 h-10 bg-green-700 rounded-lg flex items-center justify-center text-white flex-shrink-0">
                  <i className="fas fa-chart-bar"></i>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Relatórios</p>
                  <p className="text-xs text-gray-600">Análises</p>
                </div>
              </a>

              <a href="/backup" className="flex items-center gap-3 p-4 rounded-md bg-white hover:bg-gray-50 transition-colors border border-gray-200">
                <div className="w-10 h-10 bg-green-800 rounded-lg flex items-center justify-center text-white flex-shrink-0">
                  <i className="fas fa-database"></i>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Backup</p>
                  <p className="text-xs text-gray-600">Segurança</p>
                </div>
              </a>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
