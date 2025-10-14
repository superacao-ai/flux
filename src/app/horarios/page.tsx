'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';

interface Aluno {
  _id: string;
  nome: string;
  email: string;
  modalidadeId: {
    _id: string;
    nome: string;
    cor: string;
  };
}

interface Professor {
  _id: string;
  nome: string;
  especialidade: string;
}

interface Modalidade {
  _id: string;
  nome: string;
  cor: string;
  duracao: number;
  limiteAlunos: number;
}

interface HorarioFixo {
  _id: string;
  alunoId: Aluno;
  professorId: Professor;
  diaSemana: number;
  horarioInicio: string;
  horarioFim: string;
  observacoes?: string;
  ativo: boolean;
}

export default function HorariosPage() {
  const [horarios, setHorarios] = useState<HorarioFixo[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [modalidades, setModalidades] = useState<Modalidade[]>([]);
  const [modalidadeSelecionada, setModalidadeSelecionada] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    alunoId: '',
    professorId: '',
    diaSemana: 1,
    horarioInicio: '',
    horarioFim: '',
    observacoes: ''
  });
  const [loading, setLoading] = useState(false);
  // Estado para modal de lote
  const [showModalLote, setShowModalLote] = useState<{open: boolean, turma?: any, diaSemana?: number, horarioInicio?: string, horarioFim?: string}>({open: false});
  const [alunosSelecionadosLote, setAlunosSelecionadosLote] = useState<string[]>([]);

      // ...existing code...



  // ...existing code...




  const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const horariosDisponiveis = ['06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];

  useEffect(() => {
    fetchHorarios();
    fetchAlunos();
    fetchProfessores();
    fetchModalidades();
  }, []);

  useEffect(() => {
    if (modalidades.length > 0 && !modalidadeSelecionada) {
      setModalidadeSelecionada(modalidades[0]._id);
    }
  }, [modalidades]);

  const fetchHorarios = async () => {
    try {
      const response = await fetch('/api/horarios');
      const data = await response.json();
      if (data.success) {
        setHorarios(data.data);
      }
    } catch (error) {
      console.error('Erro ao buscar horários:', error);
    }
  };

  const fetchAlunos = async () => {
    try {
      const response = await fetch('/api/alunos');
      const data = await response.json();
      if (data.success) {
        setAlunos(data.data);
      }
    } catch (error) {
      console.error('Erro ao buscar alunos:', error);
    }
  };

  const fetchProfessores = async () => {
    try {
      const response = await fetch('/api/professores');
      const data = await response.json();
      if (data.success) {
        setProfessores(data.data);
      }
    } catch (error) {
      console.error('Erro ao buscar professores:', error);
    }
  };

  const fetchModalidades = async () => {
    try {
      const response = await fetch('/api/modalidades');
      const data = await response.json();
      if (data.success) {
        setModalidades(data.data);
      }
    } catch (error) {
      console.error('Erro ao buscar modalidades:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/horarios', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        alert('Horário cadastrado com sucesso!');
        setShowModal(false);
        setFormData({
          alunoId: '',
          professorId: '',
          diaSemana: 1,
          horarioInicio: '',
          horarioFim: '',
          observacoes: ''
        });
        fetchHorarios();
      } else {
        alert('Erro: ' + data.error);
      }
    } catch (error) {
      console.error('Erro ao cadastrar horário:', error);
      alert('Erro ao cadastrar horário');
    } finally {
      setLoading(false);
    }
  };

  const deleteHorario = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este horário?')) {
      try {
        const response = await fetch(`/api/horarios/${id}`, {
          method: 'DELETE',
        });

        const data = await response.json();
        if (data.success) {
          alert('Horário excluído com sucesso!');
          fetchHorarios();
        } else {
          alert('Erro ao excluir horário');
        }
      } catch (error) {
        console.error('Erro ao excluir horário:', error);
        alert('Erro ao excluir horário');
      }
    }
  };

  // Filtrar horários por modalidade selecionada (garantir que todos aparecem se não houver modalidade no aluno)
  const horariosFiltrados = horarios.filter(horario => {
    if (!modalidadeSelecionada) return true;
    // Se o aluno não tem modalidade, não filtra
    if (!horario.alunoId || !horario.alunoId.modalidadeId) return true;
    return horario.alunoId.modalidadeId._id === modalidadeSelecionada;
  });

  // Filtrar alunos por modalidade selecionada
  const alunosFiltrados = alunos.filter(aluno => 
    modalidadeSelecionada ? aluno.modalidadeId?._id === modalidadeSelecionada : true
  );

  // Organizar horários por grade com múltiplas turmas por célula
  type Turma = {
    professorId: string;
    professorNome: string;
    horarioFim: string;
    alunos: HorarioFixo[];
  };

  const criarGradeHorarios = () => {
    // grade[horario-dia] = array de turmas
    const grade: { [key: string]: Turma[] } = {};
    horariosDisponiveis.forEach(horario => {
      diasSemana.forEach((_, index) => {
        const key = `${horario}-${index}`;
        grade[key] = [];
      });
    });

    // Agrupar horários por slot (horário, dia, professor)
    horariosFiltrados.forEach(horario => {
      const key = `${horario.horarioInicio}-${horario.diaSemana}`;
      if (!grade[key]) {
        grade[key] = [];
      }
      // Procurar turma do mesmo professor nesse slot
      let turma = grade[key].find(t => t.professorId === horario.professorId._id && t.horarioFim === horario.horarioFim);
      if (!turma) {
        turma = {
          professorId: horario.professorId._id,
          professorNome: horario.professorId.nome,
          horarioFim: horario.horarioFim,
          alunos: []
        };
        grade[key].push(turma);
      }
      turma.alunos.push(horario);
    });
    return grade;
  };

  const grade = criarGradeHorarios();

  return (
    <>
      {showModalLote.open && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Adicionar Alunos em Lote</h3>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Selecione os alunos:</label>
                <div className="max-h-40 overflow-y-auto border rounded p-2">
                  {alunosFiltrados.map(aluno => (
                    <div key={aluno._id} className="flex items-center mb-1">
                      <input
                        type="checkbox"
                        checked={alunosSelecionadosLote.includes(aluno._id)}
                        onChange={e => {
                          if (e.target.checked) {
                            setAlunosSelecionadosLote([...alunosSelecionadosLote, aluno._id]);
                          } else {
                            setAlunosSelecionadosLote(alunosSelecionadosLote.filter(id => id !== aluno._id));
                          }
                        }}
                        className="mr-2"
                      />
                      <span>{aluno.nome}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModalLote({open: false})}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={alunosSelecionadosLote.length === 0}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                >
                  Adicionar selecionados
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <Layout title="Horários - Superação Flux">
      <div className="px-4 py-6 sm:px-0">
        <div className="sm:flex sm:items-center mb-6">
          <div className="sm:flex-auto">
            <h1 className="text-xl font-semibold text-gray-900">Grade de Horários</h1>
            <p className="mt-2 text-sm text-gray-700">
              Visualize e gerencie os horários fixos dos alunos por modalidade.
            </p>
          </div>
          <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none space-x-3">
            <button
              type="button"
              onClick={() => window.location.href = '/alunos'}
              className="inline-flex items-center justify-center rounded-md border border-primary-600 bg-white px-4 py-2 text-sm font-medium text-primary-600 shadow-sm hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 sm:w-auto"
            >
              👤 Novo Aluno
            </button>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="inline-flex items-center justify-center rounded-md border border-transparent bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 sm:w-auto"
            >
              📅 Novo Horário
            </button>
          </div>
        </div>

        {/* Seletor de Modalidade */}
        <div className="mb-6 bg-white p-4 rounded-lg shadow border border-gray-200">
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium text-gray-700">Modalidade:</label>
            <select
              value={modalidadeSelecionada}
              onChange={(e) => setModalidadeSelecionada(e.target.value)}
              className="block w-64 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Todas as modalidades</option>
              {modalidades.map((modalidade) => (
                <option key={modalidade._id} value={modalidade._id}>
                  {modalidade.nome}
                </option>
              ))}
            </select>
            {modalidadeSelecionada && (
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ 
                      backgroundColor: modalidades.find(m => m._id === modalidadeSelecionada)?.cor || '#3B82F6' 
                    }}
                  ></div>
                  <span className="text-sm text-gray-600">
                    Limite: {modalidades.find(m => m._id === modalidadeSelecionada)?.limiteAlunos} alunos
                  </span>
                </div>
                <div className="text-sm text-gray-600">
                  Duração: {modalidades.find(m => m._id === modalidadeSelecionada)?.duracao} min
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Grade de horários */}
        <div className="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
          <table className="min-w-full divide-y divide-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                  Horário
                </th>
                {diasSemana.map((dia) => (
                  <th
                    key={dia}
                    scope="col"
                    className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-48"
                  >
                    {dia}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {horariosDisponiveis.map((horarioSlot) => (
                <tr key={horarioSlot}>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 bg-gray-50">
                    {horarioSlot}
                  </td>
                  {diasSemana.map((_, index) => {
                    const key = `${horarioSlot}-${index}`;
                    const turmas = grade[key]; // Array de turmas neste slot
                    return (
                      <td key={key} className="px-3 py-2 text-sm text-gray-500 align-top">
                        {turmas && turmas.length > 0 && (
                          <div className="space-y-2">
                            {turmas.map((turma, turmaIdx) => (
                              <div key={turma.professorId + turma.horarioFim} className="bg-primary-100 text-primary-800 px-2 py-1 rounded text-xs mb-1">
                                <div className="font-medium text-center mb-1">
                                  👨‍🏫 {turma.professorNome}
                                </div>
                                <div className="text-center text-xs text-gray-600 mb-2">
                                  {turma.alunos.length} aluno{turma.alunos.length > 1 ? 's' : ''}
                                </div>
                                {/* Lista de alunos da turma */}
                                <div className="space-y-1 max-h-24 overflow-y-auto">
                                  {turma.alunos.map((horario, idx) => (
                                    <div key={horario._id} className="flex items-center justify-between bg-white bg-opacity-60 px-1 py-0.5 rounded text-xs">
                                      <span className="font-medium">
                                        👤 {horario.alunoId?.nome}
                                      </span>
                                      <button
                                        onClick={() => deleteHorario(horario._id)}
                                        className="text-red-500 hover:text-red-700 ml-1"
                                        title="Remover aluno da turma"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  ))}
                                </div>
                                {/* Botão para adicionar aluno à turma */}
                                <button
                                  onClick={() => {
                                    setFormData({
                                      ...formData,
                                      professorId: turma.professorId,
                                      diaSemana: index,
                                      horarioInicio: horarioSlot,
                                      horarioFim: turma.horarioFim
                                    });
                                    setShowModal(true);
                                  }}
                                  className="w-full mt-1 text-xs bg-green-500 hover:bg-green-600 text-white px-1 py-0.5 rounded"
                                  title="Adicionar aluno à turma"
                                >
                                  + Aluno
                                </button>
                                {/* Botão para adicionar alunos em lote */}
                                <button
                                  onClick={() => {
                                    setFormData({
                                      ...formData,
                                      professorId: turma.professorId,
                                      diaSemana: index,
                                      horarioInicio: horarioSlot,
                                      horarioFim: turma.horarioFim
                                    });
                                    setShowModalLote({
                                      open: true,
                                      turma: turma,
                                      diaSemana: index,
                                      horarioInicio: horarioSlot,
                                      horarioFim: turma.horarioFim
                                    });
                                  }}
                                  className="w-full mt-1 text-xs bg-blue-500 hover:bg-blue-600 text-white px-1 py-0.5 rounded"
                                  title="Adicionar alunos em lote"
                                >
                                  + Alunos em lote
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Lista de horários em formato de lista */}
        <div className="mt-8 bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Horários Cadastrados ({horariosFiltrados.length})
            </h3>
            <div className="space-y-3">
              {horariosFiltrados.map((horario) => (
                <div key={horario._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">
                      {horario.alunoId?.nome} - {diasSemana[horario.diaSemana]}
                    </div>
                    <div className="text-sm text-gray-500">
                      {horario.horarioInicio} às {horario.horarioFim} com {horario.professorId?.nome}
                    </div>
                    {horario.observacoes && (
                      <div className="text-xs text-gray-400 mt-1">{horario.observacoes}</div>
                    )}
                  </div>
                  <button
                    onClick={() => deleteHorario(horario._id)}
                    className="ml-4 text-red-500 hover:text-red-700 text-sm"
                  >
                    Excluir
                  </button>
                </div>
              ))}
              {horariosFiltrados.length === 0 && (
                <div className="text-center text-gray-500 py-8">
                  {modalidadeSelecionada 
                    ? `Nenhum horário cadastrado para ${modalidades.find(m => m._id === modalidadeSelecionada)?.nome || 'esta modalidade'}.`
                    : 'Nenhum horário cadastrado ainda.'
                  }
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Legenda */}
        <div className="mt-6 bg-gray-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-gray-900 mb-2">Legenda:</h3>
          <div className="flex flex-wrap gap-4 text-xs">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-primary-100 rounded mr-2"></div>
              <span>Horário Regular</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-100 rounded mr-2"></div>
              <span>Reagendado</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-yellow-100 rounded mr-2"></div>
              <span>Pendente</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-red-100 rounded mr-2"></div>
              <span>Falta</span>
            </div>
          </div>
        </div>

      </div>

      {/* Modal para cadastrar novo horário */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Cadastrar Novo Horário</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Aluno</label>
                  <select
                    value={formData.alunoId}
                    onChange={(e) => setFormData({...formData, alunoId: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    required
                  >
                    <option value="">Selecione um aluno</option>
                    {alunosFiltrados.map((aluno) => (
                      <option key={aluno._id} value={aluno._id}>
                        {aluno.nome} ({aluno.modalidadeId?.nome})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Professor</label>
                  <select
                    value={formData.professorId}
                    onChange={(e) => setFormData({...formData, professorId: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    required
                  >
                    <option value="">Selecione um professor</option>
                    {professores.map((professor) => (
                      <option key={professor._id} value={professor._id}>
                        {professor.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Dia da Semana</label>
                  <select
                    value={formData.diaSemana}
                    onChange={(e) => setFormData({...formData, diaSemana: parseInt(e.target.value)})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    required
                  >
                    {diasSemana.map((dia, index) => (
                      <option key={index} value={index}>
                        {dia}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Horário Início</label>
                    <select
                      value={formData.horarioInicio}
                      onChange={(e) => setFormData({...formData, horarioInicio: e.target.value})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      required
                    >
                      <option value="">Selecione</option>
                      {horariosDisponiveis.map((horario) => (
                        <option key={horario} value={horario}>
                          {horario}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Horário Fim</label>
                    <select
                      value={formData.horarioFim}
                      onChange={(e) => setFormData({...formData, horarioFim: e.target.value})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      required
                    >
                      <option value="">Selecione</option>
                      {horariosDisponiveis.map((horario) => (
                        <option key={horario} value={horario}>
                          {horario}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Observações</label>
                  <textarea
                    value={formData.observacoes}
                    onChange={(e) => setFormData({...formData, observacoes: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    rows={2}
                    placeholder="Observações opcionais..."
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                  >
                    {loading ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      </Layout>
    </>
  );
}