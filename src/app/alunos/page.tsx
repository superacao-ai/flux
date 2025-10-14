'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';

interface Modalidade {
  _id: string;
  nome: string;
  cor: string;
  duracao: number;
  limiteAlunos: number;
}

interface Professor {
  _id: string;
  nome: string;
  especialidade: string;
}

interface Aluno {
  _id: string;
  nome: string;
  email: string;
  telefone: string;
  endereco?: string;
  modalidadeId: Modalidade;
  plano?: string;
  observacoes?: string;
  ativo: boolean;
}

export default function AlunosPage() {
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [modalidades, setModalidades] = useState<Modalidade[]>([]);
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState({
    listaAlunos: '',
    modalidadeId: '',
    professorId: '',
    diaSemana: 1,
    horarioInicio: '',
    horarioFim: ''
  });
  const [importLoading, setImportLoading] = useState(false);

  useEffect(() => {
    fetchAlunos();
    fetchModalidades();
    fetchProfessores();
  }, []);

  const fetchAlunos = async () => {
    try {
      const response = await fetch('/api/alunos');
      const data = await response.json();
      if (data.success) {
        setAlunos(data.data);
      }
    } catch (error) {
      console.error('Erro ao buscar alunos:', error);
    } finally {
      setLoading(false);
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

  // Função para padronizar nomes (primeira letra maiúscula)
  const padronizarNome = (nome: string): string => {
    return nome
      .toLowerCase()
      .split(' ')
      .map(palavra => palavra.charAt(0).toUpperCase() + palavra.slice(1))
      .join(' ');
  };

  const processarImportacao = async () => {
    if (!importData.listaAlunos.trim() || !importData.modalidadeId || !importData.professorId || !importData.horarioInicio || !importData.horarioFim) {
      alert('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    setImportLoading(true);

    try {
      const linhas = importData.listaAlunos
        .split('\n')
        .map(linha => linha.trim())
        .filter(linha => linha.length > 0);

      let sucessos = 0;
      let erros = 0;
      const detalhesErros: string[] = [];

      for (const linha of linhas) {
        try {
          // Processar linha: formato esperado "Nome do Aluno | email@exemplo.com | (11) 99999-9999"
          const partes = linha.split('|').map(parte => parte.trim());
          
          if (partes.length < 1) {
            detalhesErros.push(`Linha inválida: ${linha}`);
            erros++;
            continue;
          }

          const nomeOriginal = partes[0];
          const nome = padronizarNome(nomeOriginal);
          
          // Email e telefone opcionais - usar apenas se fornecidos
          const email = partes[1]?.trim() || ''; // Vazio se não fornecido
          const telefone = partes[2]?.trim() || 'Não informado';
          const endereco = partes[3]?.trim() || '';

          // Criar aluno
          const alunoResponse = await fetch('/api/alunos', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              nome,
              email,
              telefone,
              endereco,
              modalidadeId: importData.modalidadeId,
            }),
          });

          const alunoData = await alunoResponse.json();
          
          if (alunoData.success) {
            // Criar horário fixo para o aluno
            const horarioResponse = await fetch('/api/horarios', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                alunoId: alunoData.data._id,
                professorId: importData.professorId,
                diaSemana: importData.diaSemana,
                horarioInicio: importData.horarioInicio,
                horarioFim: importData.horarioFim,
                observacoes: 'Importado em lote'
              }),
            });

            const horarioData = await horarioResponse.json();
            
            if (horarioData.success) {
              sucessos++;
            } else {
              detalhesErros.push(`${nome}: Aluno criado, mas erro no horário - ${horarioData.error}`);
              erros++;
            }
          } else {
            detalhesErros.push(`${nome}: ${alunoData.error}`);
            erros++;
          }
        } catch (error) {
          detalhesErros.push(`${linha}: Erro inesperado`);
          erros++;
        }
      }

      // Mostrar resultado
      let mensagem = `Importação concluída!\n✅ ${sucessos} alunos criados com sucesso`;
      if (erros > 0) {
        mensagem += `\n❌ ${erros} erros encontrados:\n${detalhesErros.slice(0, 5).join('\n')}`;
        if (detalhesErros.length > 5) {
          mensagem += `\n... e mais ${detalhesErros.length - 5} erros`;
        }
      }
      
      alert(mensagem);
      
      if (sucessos > 0) {
        setShowImportModal(false);
        setImportData({
          listaAlunos: '',
          modalidadeId: '',
          professorId: '',
          diaSemana: 1,
          horarioInicio: '',
          horarioFim: ''
        });
        fetchAlunos();
      }

    } catch (error) {
      console.error('Erro na importação:', error);
      alert('Erro inesperado durante a importação');
    } finally {
      setImportLoading(false);
    }
  };

  // Estados para edição
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAluno, setEditingAluno] = useState<Aluno | null>(null);
  const [editFormData, setEditFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    endereco: '',
    modalidadeId: '',
    observacoes: ''
  });

  // Estados para seleção múltipla
  const [selectedAlunos, setSelectedAlunos] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);

  // Função para abrir modal de edição
  const abrirEdicao = (aluno: Aluno) => {
    setEditingAluno(aluno);
    setEditFormData({
      nome: aluno.nome,
      email: aluno.email || '',
      telefone: aluno.telefone,
      endereco: aluno.endereco || '',
      modalidadeId: aluno.modalidadeId._id,
      observacoes: aluno.observacoes || ''
    });
    setShowEditModal(true);
  };

  // Função para salvar edição
  const salvarEdicao = async () => {
    if (!editingAluno) return;

    try {
      const response = await fetch(`/api/alunos/${editingAluno._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editFormData),
      });

      const data = await response.json();

      if (data.success) {
        await fetchAlunos();
        setShowEditModal(false);
        alert('Aluno atualizado com sucesso!');
      } else {
        alert(`Erro: ${data.error}`);
      }
    } catch (error) {
      console.error('Erro ao atualizar aluno:', error);
      alert('Erro ao atualizar aluno');
    }
  };

  // Função para excluir aluno individual
  const excluirAluno = async (id: string, nome: string) => {
    if (!confirm(`Tem certeza que deseja excluir o aluno "${nome}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/alunos/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        await fetchAlunos();
        alert('Aluno excluído com sucesso!');
      } else {
        alert(`Erro: ${data.error}`);
      }
    } catch (error) {
      console.error('Erro ao excluir aluno:', error);
      alert('Erro ao excluir aluno');
    }
  };

  // Função para selecionar/deselecionar todos os alunos
  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedAlunos([]);
    } else {
      setSelectedAlunos(alunos.map(aluno => aluno._id));
    }
    setSelectAll(!selectAll);
  };

  // Função para selecionar/deselecionar aluno individual
  const toggleSelectAluno = (alunoId: string) => {
    setSelectedAlunos(prev => {
      const newSelected = prev.includes(alunoId)
        ? prev.filter(id => id !== alunoId)
        : [...prev, alunoId];
      
      setSelectAll(newSelected.length === alunos.length);
      return newSelected;
    });
  };

  // Função para excluir alunos selecionados em massa
  const excluirSelecionados = async () => {
    if (selectedAlunos.length === 0) {
      alert('Nenhum aluno selecionado');
      return;
    }

    if (!confirm(`Tem certeza que deseja excluir ${selectedAlunos.length} aluno(s) selecionado(s)?`)) {
      return;
    }

    try {
      const promises = selectedAlunos.map(id => 
        fetch(`/api/alunos/${id}`, { method: 'DELETE' })
      );

      const responses = await Promise.all(promises);
      const results = await Promise.all(responses.map(r => r.json()));

      const sucessos = results.filter(r => r.success).length;
      const erros = results.length - sucessos;

      await fetchAlunos();
      setSelectedAlunos([]);
      setSelectAll(false);

      if (erros === 0) {
        alert(`${sucessos} aluno(s) excluído(s) com sucesso!`);
      } else {
        alert(`${sucessos} aluno(s) excluído(s) com sucesso. ${erros} erro(s).`);
      }
    } catch (error) {
      console.error('Erro ao excluir alunos:', error);
      alert('Erro ao excluir alunos selecionados');
    }
  };

  return (
    <Layout title="Alunos - Superação Flux">
      <div className="px-4 py-6 sm:px-0">
        <div className="sm:flex sm:items-center">
          <div className="sm:flex-auto">
            <h1 className="text-xl font-semibold text-gray-900">Alunos</h1>
            <p className="mt-2 text-sm text-gray-700">
              Gerencie o cadastro de alunos do studio.
            </p>
          </div>
          <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none space-x-3">
            {selectedAlunos.length > 0 && (
              <button
                type="button"
                onClick={excluirSelecionados}
                className="inline-flex items-center justify-center rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 shadow-sm hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 sm:w-auto"
              >
                🗑️ Excluir Selecionados ({selectedAlunos.length})
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 sm:w-auto"
            >
              📋 Importar Alunos
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md border border-transparent bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 sm:w-auto"
            >
              Novo Aluno
            </button>
          </div>
        </div>

        <div className="mt-8 flex flex-col">
          <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
              <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="relative px-6 sm:w-12 sm:px-6">
                        <input
                          type="checkbox"
                          className="absolute left-4 top-1/2 -mt-2 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          checked={selectAll}
                          onChange={toggleSelectAll}
                        />
                      </th>
                      <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                        Nome
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Email
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Modalidade
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Telefone
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Status
                      </th>
                      <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                        <span className="sr-only">Ações</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                          Carregando alunos...
                        </td>
                      </tr>
                    ) : alunos.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                          Nenhum aluno encontrado.
                        </td>
                      </tr>
                    ) : (
                      alunos.map((aluno) => (
                        <tr key={aluno._id}>
                          <td className="relative px-6 sm:w-12 sm:px-6">
                            <input
                              type="checkbox"
                              className="absolute left-4 top-1/2 -mt-2 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                              checked={selectedAlunos.includes(aluno._id)}
                              onChange={() => toggleSelectAluno(aluno._id)}
                            />
                          </td>
                          <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                            {aluno.nome}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {aluno.email}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            <div className="flex items-center">
                              <div
                                className="w-3 h-3 rounded-full mr-2"
                                style={{ backgroundColor: aluno.modalidadeId?.cor || '#3B82F6' }}
                              ></div>
                              <span>{aluno.modalidadeId?.nome || 'N/A'}</span>
                              {aluno.plano && (
                                <span className="ml-1 text-xs text-gray-400">({aluno.plano})</span>
                              )}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {aluno.telefone}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            <span
                              className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                                aluno.ativo
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {aluno.ativo ? 'Ativo' : 'Inativo'}
                            </span>
                          </td>
                          <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                            <button 
                              onClick={() => abrirEdicao(aluno)}
                              className="text-primary-600 hover:text-primary-900 mr-4"
                            >
                              Editar
                            </button>
                            <button 
                              onClick={() => excluirAluno(aluno._id, aluno.nome)}
                              className="text-red-600 hover:text-red-900"
                            >
                              Excluir
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Importação de Alunos */}
      {showImportModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-[800px] shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Importar Alunos em Lote</h3>
              
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
                <h4 className="text-sm font-medium text-blue-800 mb-2">📋 Formato de Importação:</h4>
                <p className="text-sm text-blue-700 mb-2">Cole uma lista de alunos, um por linha. Formatos aceitos:</p>
                <div className="text-xs font-mono bg-blue-100 p-2 rounded border">
                  <div>João Silva</div>
                  <div>Maria Santos | maria@email.com</div>
                  <div>Pedro Costa | pedro@email.com | (11) 99999-9999</div>
                  <div>Ana Clara | ana@email.com | (11) 88888-8888 | Rua A, 123</div>
                </div>
                <p className="text-xs text-blue-600 mt-2">
                  * Apenas o nome é obrigatório. Email é opcional. Telefone será "Não informado" se não fornecido.
                  * Formato: Nome | email@opcional.com | (11) 99999-9999 | Endereço opcional
                  * Múltiplos alunos podem ser adicionados ao mesmo horário (conceito de turma).
                </p>
              </div>

              <div className="space-y-4">
                {/* Lista de Alunos */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Lista de Alunos *
                  </label>
                  <textarea
                    value={importData.listaAlunos}
                    onChange={(e) => setImportData({...importData, listaAlunos: e.target.value})}
                    className="block w-full h-32 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Cole aqui a lista de alunos, um por linha..."
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {importData.listaAlunos.split('\n').filter(l => l.trim()).length} alunos na lista
                  </p>
                </div>

                {/* Configurações da Turma */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Modalidade *</label>
                    <select
                      value={importData.modalidadeId}
                      onChange={(e) => setImportData({...importData, modalidadeId: e.target.value})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      required
                    >
                      <option value="">Selecione uma modalidade</option>
                      {modalidades.map((modalidade) => (
                        <option key={modalidade._id} value={modalidade._id}>
                          {modalidade.nome}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Professor *</label>
                    <select
                      value={importData.professorId}
                      onChange={(e) => setImportData({...importData, professorId: e.target.value})}
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
                </div>

                {/* Horário da Turma */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Dia da Semana *</label>
                    <select
                      value={importData.diaSemana}
                      onChange={(e) => setImportData({...importData, diaSemana: parseInt(e.target.value)})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      required
                    >
                      {['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'].map((dia, index) => (
                        <option key={index} value={index}>
                          {dia}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Horário Início *</label>
                    <input
                      type="time"
                      value={importData.horarioInicio}
                      onChange={(e) => setImportData({...importData, horarioInicio: e.target.value})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Horário Fim *</label>
                    <input
                      type="time"
                      value={importData.horarioFim}
                      onChange={(e) => setImportData({...importData, horarioFim: e.target.value})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowImportModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={processarImportacao}
                    disabled={importLoading}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                  >
                    {importLoading ? 'Importando...' : '📋 Importar Alunos'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edição */}
      {showEditModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Editar Aluno
              </h3>
              
              <form noValidate>
                <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome *
                  </label>
                  <input
                    type="text"
                    value={editFormData.nome}
                    onChange={(e) => setEditFormData({...editFormData, nome: e.target.value})}
                    className="block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email <span className="text-gray-400 text-xs">(opcional)</span>
                  </label>
                  <input
                    type="email"
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({...editFormData, email: e.target.value})}
                    className="block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    placeholder="email@exemplo.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Telefone <span className="text-gray-400 text-xs">(pode ser "Não informado")</span>
                  </label>
                  <input
                    type="tel"
                    value={editFormData.telefone}
                    onChange={(e) => setEditFormData({...editFormData, telefone: e.target.value})}
                    className="block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    placeholder="(11) 99999-9999 ou Não informado"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Endereço
                  </label>
                  <input
                    type="text"
                    value={editFormData.endereco}
                    onChange={(e) => setEditFormData({...editFormData, endereco: e.target.value})}
                    className="block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Endereço completo"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Modalidade
                  </label>
                  <select
                    value={editFormData.modalidadeId}
                    onChange={(e) => setEditFormData({...editFormData, modalidadeId: e.target.value})}
                    className="block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">Selecione uma modalidade</option>
                    {modalidades.map((modalidade) => (
                      <option key={modalidade._id} value={modalidade._id}>
                        {modalidade.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Observações
                  </label>
                  <textarea
                    value={editFormData.observacoes}
                    onChange={(e) => setEditFormData({...editFormData, observacoes: e.target.value})}
                    className="block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    rows={3}
                    placeholder="Observações sobre o aluno"
                  />
                </div>
              </div>
              </form>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Cancelar
                </button>
                <button
                  onClick={salvarEdicao}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </Layout>
  );
}