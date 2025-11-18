'use client';

import Layout from '@/components/Layout';
import RequireAuth from '@/components/RequireAuth';
import { useEffect, useState } from 'react';

interface AulaRealizada {
  _id: string;
  data: string;
  modalidade: string;
  status?: 'pendente' | 'enviada' | 'corrigida';
  professorId?: any;
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

export default function AulasRealizadasPage() {
  const [aulas, setAulas] = useState<AulaRealizada[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState({
    dataInicio: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    dataFim: new Date().toISOString().split('T')[0],
    professor: '',
    modalidade: '',
    status: '',
    tipoAula: 'todas' // 'todas', 'realizadas', 'pendentes'
  });
  const [professores, setProfessores] = useState<any[]>([]);
  const [modalidades, setModalidades] = useState<any[]>([]);
  const [aulaParaEditar, setAulaParaEditar] = useState<AulaRealizada | null>(null);
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
    return typeof (aula.professorId as any)?.nome === 'string'
      ? (aula.professorId as any).nome
      : aula.professorNome || 'Não informado';
  };

  const getProfessorLookupKey = (aula: any) => {
    if (aula.professorId) {
      if (typeof aula.professorId === 'object') return aula.professorId._id || aula.professorId.nome || '';
      return String(aula.professorId || '');
    }
    return aula.professorNome || '';
  };

  useEffect(() => {
    carregarDados();
  }, [filtros]);

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
      const horarios: any[] = Array.isArray(horariosData) ? horariosData : (horariosData.data || []);

      // Buscar professores
      const resProfessores = await fetch('/api/professores');
      const professoresData = resProfessores.ok ? await resProfessores.json() : { data: [] };
      setProfessores(professoresData.data || []);

      // Buscar modalidades
      const resModalidades = await fetch('/api/modalidades');
      const modalidadesData = resModalidades.ok ? await resModalidades.json() : { data: [] };
      setModalidades(modalidadesData.data || []);

      // Calcular aulas pendentes
      const aulasMap = new Map<string, AulaRealizada>();
      aulasData.forEach(aula => {
        const key = `${aula.horarioFixoId || ''}_${aula.data ? aula.data.split('T')[0] : ''}`;
        aulasMap.set(key, aula);
      });

      function getDatesForDayOfWeek(start: string, end: string, dayOfWeek: number) {
        const dates = [];
        let current = new Date(start);
        const endDate = new Date(end);
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

      horarios.forEach(horario => {
        // Ignore malformed horario entries: require an _id and a valid diaSemana and at least one time field.
        if (!horario || !horario._id) return;
        if (typeof horario.diaSemana !== 'number') return;
        if (!horario.horarioInicio && !horario.horario) return;
        const dias = getDatesForDayOfWeek(filtros.dataInicio, filtros.dataFim, horario.diaSemana);
        dias.forEach(dateObj => {
          const dataStr = dateObj.toISOString().split('T')[0];
          const key = `${horario._id}_${dataStr}`;
          
          // Verificar se a data é anterior à data de início da plataforma
          const dentroDataPlataforma = !dataInicioPlataforma || dataStr >= dataInicioPlataforma;
          
          if (dataStr < new Date().toISOString().split('T')[0] && !aulasMap.has(key) && dentroDataPlataforma) {
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

      setAulasPendentes(pendentesList);

      // Aplicar filtros nas aulas realizadas
      let aulasFiltradas = aulasData.filter((aula) => {
        const dataAula = aula.data ? aula.data.split('T')[0] : '';
        const dentroDataInicio = !filtros.dataInicio || dataAula >= filtros.dataInicio;
        const dentroDataFim = !filtros.dataFim || dataAula <= filtros.dataFim;
        
        const professorId = String((aula.professorId as any)?._id || aula.professorId || '');
        const dentroProfessor = !filtros.professor || professorId === filtros.professor;
        
        const dentroModalidade = !filtros.modalidade || aula.modalidade === filtros.modalidade;
        const dentroStatus = !filtros.status || aula.status === filtros.status;

        return dentroDataInicio && dentroDataFim && dentroProfessor && dentroModalidade && dentroStatus;
      });

      // Ordenar por data (mais recente primeiro)
      aulasFiltradas.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

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
      } else {
        alert('Erro ao excluir aula');
      }
    } catch (error) {
      console.error('Erro ao excluir aula:', error);
      alert('Erro ao excluir aula');
    } finally {
      setSalvando(false);
    }
  };

  const handleSalvarEdicao = async () => {
    if (!aulaParaEditar) return;

    try {
      setSalvando(true);
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };

      const response = await fetch(`/api/aulas-realizadas/${aulaParaEditar._id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          alunos: aulaParaEditar.alunos,
          total_presentes: aulaParaEditar.alunos.filter(a => a.presente === true).length,
          total_faltas: aulaParaEditar.alunos.filter(a => a.presente === false).length
        })
      });

      if (response.ok) {
        setAulaParaEditar(null);
        carregarDados();
      } else {
        alert('Erro ao salvar alterações');
      }
    } catch (error) {
      console.error('Erro ao salvar aula:', error);
      alert('Erro ao salvar alterações');
    } finally {
      setSalvando(false);
    }
  };

  const togglePresenca = (alunoIndex: number) => {
    if (!aulaParaEditar) return;

    const novosAlunos = [...aulaParaEditar.alunos];
    const alunoAtual = novosAlunos[alunoIndex];
    
    // Ciclo: null -> true -> false -> null
    if (alunoAtual.presente === null) {
      alunoAtual.presente = true;
    } else if (alunoAtual.presente === true) {
      alunoAtual.presente = false;
    } else {
      alunoAtual.presente = null;
    }

    setAulaParaEditar({
      ...aulaParaEditar,
      alunos: novosAlunos
    });
  };

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

  return (
    <RequireAuth showLoginRedirect={false}>
      <Layout title="Aulas - Superação Flux">
      <div className="px-4 py-6 sm:px-0">
        {/* Header */}
        <div className="mb-6 fade-in-1">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Aulas</h1>
          <p className="text-sm text-gray-600">Gerencie as aulas realizadas e pendentes do sistema</p>
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
                onChange={(e) => setFiltros({ ...filtros, dataInicio: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Data Fim</label>
              <input
                type="date"
                value={filtros.dataFim}
                onChange={(e) => setFiltros({ ...filtros, dataFim: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Professor</label>
              <select
                value={filtros.professor}
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
              <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filtros.status}
                onChange={(e) => setFiltros({ ...filtros, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">Todos</option>
                <option value="enviada">Enviada</option>
                <option value="corrigida">Corrigida</option>
                <option value="pendente">Pendente</option>
              </select>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-gray-600">
              {filtros.tipoAula === 'realizadas' && `${aulasParaExibir.length} aula${aulasParaExibir.length !== 1 ? 's' : ''} realizada${aulasParaExibir.length !== 1 ? 's' : ''}`}
              {filtros.tipoAula === 'pendentes' && `${pendentesFiltradas.length} aula${pendentesFiltradas.length !== 1 ? 's' : ''} pendente${pendentesFiltradas.length !== 1 ? 's' : ''}`}
              {filtros.tipoAula === 'todas' && `${aulasParaExibir.length} realizada${aulasParaExibir.length !== 1 ? 's' : ''} | ${pendentesFiltradas.length} pendente${pendentesFiltradas.length !== 1 ? 's' : ''}`}
            </p>
            <button
              onClick={() => setFiltros({
                dataInicio: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
                dataFim: new Date().toISOString().split('T')[0],
                professor: '',
                modalidade: '',
                status: '',
                tipoAula: 'todas'
              })}
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
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Horário</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Modalidade</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Professor</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {pendentesParaExibir.map((aula, index) => (
                        <tr key={`${aula.horarioFixoId}-${aula.data}`} className={`hover:bg-gray-50 fade-in-${Math.min((index % 8) + 1, 8)}`}>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {new Date(aula.data).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {aula.horario}
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
                      {realizadasParaExibir.map((aula, index) => (
                        <tr key={aula._id} className={`hover:bg-gray-50 fade-in-${Math.min((index % 8) + 1, 8)}`}>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {new Date(aula.data).toLocaleDateString('pt-BR')}
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
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              aula.status === 'enviada' ? 'bg-green-50 text-green-700' :
                              aula.status === 'corrigida' ? 'bg-blue-50 text-blue-700' :
                              'bg-gray-50 text-gray-700'
                            }`}>
                              {aula.status || 'enviada'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => setAulaParaEditar(aula)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-white border border-gray-100 hover:bg-gray-50 text-primary-600"
                                title="Editar"
                              >
                                <i className="fas fa-edit w-3" aria-hidden="true" />
                              </button>
                              <button
                                onClick={() => setAulaParaExcluir(aula)}
                                className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border bg-red-50 border-red-100 text-red-700 hover:bg-red-100`}
                                title="Excluir"
                              >
                                <i className="fas fa-trash w-3" aria-hidden="true" />
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
                    Editar Aula - {new Date(aulaParaEditar.data).toLocaleDateString('pt-BR')}
                  </h3>
                  <div className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                    <i className="fas fa-info-circle text-primary-600"></i>
                    <span>Atualize presenças e confirme as alterações da aula</span>
                  </div>
                </div>
                <button
                  onClick={() => setAulaParaEditar(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Fechar"
                >
                  <i className="fas fa-times text-lg"></i>
                </button>
              </div>

              <div className="p-4 overflow-y-auto max-h-[calc(90vh-200px)] space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Modalidade</label>
                    <div className="mt-1 text-sm text-gray-900">
                      <span className="inline-flex items-center gap-2">
                        <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: getModalidadeColor(aulaParaEditar.modalidade || '') }} />
                        <span>{aulaParaEditar.modalidade}</span>
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Professor</label>
                    <div className="mt-1 text-sm text-gray-900">
                      <span className="inline-flex items-center gap-2">
                        <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: getProfessorColor(getProfessorLookupKey(aulaParaEditar)) }} />
                        <span>{getProfessorName(aulaParaEditar)}</span>
                      </span>
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-sm font-medium text-gray-700">Data</label>
                    <div className="mt-1 text-sm text-gray-900">{new Date(aulaParaEditar.data).toLocaleDateString('pt-BR')}</div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Alunos da Aula</h4>
                  <div className="space-y-2">
                    {aulaParaEditar.alunos.map((aluno, index) => (
                      <div key={index} className="p-3 bg-gray-50 rounded-md border border-gray-100 flex items-center justify-between">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{aluno.nome}</div>
                        </div>
                        <div>
                          <button
                            onClick={() => togglePresenca(index)}
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
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t flex items-center justify-end gap-3">
                <button
                  onClick={() => setAulaParaEditar(null)}
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
                    <i className="fas fa-exclamation-triangle text-primary-600"></i>
                    Confirmar Exclusão
                  </h3>
                  <div className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                    <i className="fas fa-info-circle text-primary-600"></i>
                    <span>Esta ação removerá a aula do sistema e não poderá ser desfeita.</span>
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
                  <p><strong>Data:</strong> {new Date(aulaParaExcluir.data).toLocaleDateString('pt-BR')}</p>
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
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={salvando}
                >
                  {salvando ? (
                    <><i className="fas fa-spinner fa-spin"></i> Excluindo...</>
                  ) : (
                    <><i className="fas fa-trash"></i> Sim, Excluir</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      </Layout>
    </RequireAuth>
  );
}
