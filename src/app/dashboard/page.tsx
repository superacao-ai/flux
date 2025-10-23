'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';

interface User {
  id: string;
  nome: string;
  email: string;
  tipo: 'admin' | 'professor';
}

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState({
    totalAlunos: 0,
    totalProfessores: 0,
    totalHorarios: 0
  });
  const [hydrated, setHydrated] = useState(false);
  const router = useRouter();

  // Admin-specific state
  const [pendingReags, setPendingReags] = useState<number>(0);
  const [incompleteAlunos, setIncompleteAlunos] = useState<number>(0);

  useEffect(() => {
    // Verificar se está logado
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/login');
      return;
    }

    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);
    // Carregar estatísticas conforme tipo
    if (parsedUser.tipo === 'professor') {
      loadProfessorStats(parsedUser);
    } else {
      loadStats();
      loadAdminExtras();
    }
    // mark hydrated after we've read localStorage and started loading
    setHydrated(true);
  }, [router]);

  const loadStats = async () => {
    try {
      const [alunosRes, professoresRes, horariosRes] = await Promise.all([
        fetch('/api/alunos'),
        fetch('/api/professores'),
        fetch('/api/horarios')
      ]);

      const alunos = await alunosRes.json();
      const professores = await professoresRes.json();
      const horarios = await horariosRes.json();

      setStats({
        totalAlunos: alunos.data?.length || 0,
        totalProfessores: professores.data?.length || 0,
        totalHorarios: horarios.data?.length || 0
      });
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
  }

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    router.push('/login');
  };

  // Professor-specific state
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [recentStudents, setRecentStudents] = useState<any[]>([]);

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

      // Upcoming: next 7 days sorted
      const now = new Date();
      const upcomingList = horarios
        .map(h => ({ ...h }))
        .filter(h => h.diaSemana !== undefined)
        .sort((a, b) => new Date(a.horarioInicio).getTime() - new Date(b.horarioInicio).getTime())
        .slice(0, 8);

      // Recent students: last 8 distinct by last modified _id or alunoId
      const recent = Array.from(alunoMap.values()).slice(0, 8);

      setStats({
        totalAlunos: alunoMap.size,
        totalProfessores: 1,
        totalHorarios: horarios.length
      });
      setUpcoming(upcomingList);
      setRecentStudents(recent);
    } catch (error) {
      console.error('Erro ao carregar dados do professor:', error);
    }
  }

  // Render the dashboard immediately; client-side effect will redirect if there's no user.
  // To avoid hydration mismatch, render a neutral skeleton until we've read the user/token on the client.
  if (!hydrated) {
    return (
      <Layout title="Dashboard - Superação Flux">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white overflow-hidden shadow rounded-lg mb-6">
            <div className="p-6">
              <div className="h-6 bg-gray-200 rounded w-1/3 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-1/4" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-8">
            <div className="h-28 bg-white shadow rounded-lg p-5" />
            <div className="h-28 bg-white shadow rounded-lg p-5" />
            <div className="h-28 bg-white shadow rounded-lg p-5" />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Dashboard - Superação Flux">
      <div className="px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">Painel</h2>
            <p className="text-sm text-gray-500">Visão geral rápida das operações do Studio</p>
          </div>
        </div>

        {user?.tipo === 'professor' ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            <div className="bg-white p-4 rounded-lg shadow flex items-center gap-4">
              <div className="p-3 bg-blue-50 rounded-md">
                <i className="fas fa-user-graduate text-blue-600 text-xl" aria-hidden="true" />
              </div>
              <div>
                <div className="text-sm text-gray-500">Meus Alunos</div>
                <div className="text-2xl font-bold text-gray-800">{stats.totalAlunos}</div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow flex items-center gap-4">
              <div className="p-3 bg-yellow-50 rounded-md">
                <i className="fas fa-clock text-yellow-600 text-xl" aria-hidden="true" />
              </div>
              <div>
                <div className="text-sm text-gray-500">Horários</div>
                <div className="text-2xl font-bold text-gray-800">{stats.totalHorarios}</div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow flex items-center gap-4">
              <div className="p-3 bg-green-50 rounded-md">
                <i className="fas fa-calendar-check text-green-600 text-xl" aria-hidden="true" />
              </div>
              <div>
                <div className="text-sm text-gray-500">Aulas próximas</div>
                <div className="text-2xl font-bold text-gray-800">{upcoming.length}</div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow flex items-center gap-4">
              <div className="p-3 bg-indigo-50 rounded-md">
                <i className="fas fa-users text-indigo-600 text-xl" aria-hidden="true" />
              </div>
              <div>
                <div className="text-sm text-gray-500">Atividades recentes</div>
                <div className="text-2xl font-bold text-gray-800">{recentStudents.length}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            <div className="bg-white p-4 rounded-lg shadow flex items-center gap-4">
              <div className="p-3 bg-blue-50 rounded-md">
                <i className="fas fa-users text-blue-600 text-xl" aria-hidden="true" />
              </div>
              <div>
                <div className="text-sm text-gray-500">Alunos</div>
                <div className="text-2xl font-bold text-gray-800">{stats.totalAlunos}</div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow flex items-center gap-4">
              <div className="p-3 bg-yellow-50 rounded-md">
                <i className="fas fa-calendar-alt text-yellow-600 text-xl" aria-hidden="true" />
              </div>
              <div>
                <div className="text-sm text-gray-500">Horários</div>
                <div className="text-2xl font-bold text-gray-800">{stats.totalHorarios}</div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow flex items-center gap-4">
              <div className="p-3 bg-green-50 rounded-md">
                <i className="fas fa-chalkboard-teacher text-green-600 text-xl" aria-hidden="true" />
              </div>
              <div>
                <div className="text-sm text-gray-500">Professores</div>
                <div className="text-2xl font-bold text-gray-800">{stats.totalProfessores}</div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow flex items-center gap-4">
              <div className="p-3 bg-indigo-50 rounded-md">
                <i className="fas fa-exchange-alt text-indigo-600 text-xl" aria-hidden="true" />
              </div>
              <div>
                <div className="text-sm text-gray-500">Reagendamentos Pendentes</div>
                <div className="text-2xl font-bold text-gray-800">{pendingReags}</div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-lg shadow p-4">
            <h3 className="text-lg font-medium text-gray-800 mb-4">Alunos incompletos</h3>
            {incompleteAlunos === 0 ? (
              <div className="text-sm text-gray-500">Nenhum aluno com cadastro incompleto.</div>
            ) : (
              <div className="text-sm text-gray-600">Existem <strong>{incompleteAlunos}</strong> alunos com informações faltando (nome ou email). Verifique a lista de alunos.</div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            {user?.tipo === 'professor' ? (
              <>
                <h3 className="text-lg font-medium text-gray-800 mb-4">Atividades recentes</h3>
                {recentStudents.length === 0 ? (
                  <div className="text-sm text-gray-500">Nenhuma atividade recente.</div>
                ) : (
                  <ul className="space-y-3">
                    {recentStudents.map((s: any, i: number) => (
                      <li key={i} className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-600">{(s.nome || '').charAt(0).toUpperCase()}</div>
                        <div>
                          <div className="text-sm font-medium text-gray-800">{s.nome || s.email || 'Aluno'}</div>
                          <div className="text-xs text-gray-500">{s.email || ''}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <>
                <h3 className="text-lg font-medium text-gray-800 mb-4">Configurações rápidas</h3>
                <div className="space-y-2">
                  <a href="/backup" className="block text-sm text-primary-600 hover:underline">Backups e restauração</a>
                  <a href="/seed" className="block text-sm text-primary-600 hover:underline">Seed / Importar dados</a>
                  <a href="/config" className="block text-sm text-primary-600 hover:underline">Configurações do sistema</a>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}