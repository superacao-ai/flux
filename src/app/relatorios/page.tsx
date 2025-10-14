import Layout from '@/components/Layout';

export default function RelatoriosPage() {
  return (
    <Layout title="Relatórios - Superação Flux">
      <div className="px-4 py-6 sm:px-0">
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-gray-900">Relatórios Gerenciais</h1>
          <p className="mt-2 text-sm text-gray-700">
            Análises e métricas do seu studio de personal training.
          </p>
        </div>

        {/* Filtros */}
        <div className="bg-white p-6 rounded-lg shadow mb-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Filtros</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data Início
              </label>
              <input
                type="date"
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data Fim
              </label>
              <input
                type="date"
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Professor
              </label>
              <select className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500">
                <option>Todos os Professores</option>
                <option>Carlos Oliveira</option>
                <option>Ana Paula</option>
                <option>Roberto Silva</option>
              </select>
            </div>
            <div className="flex items-end">
              <button className="w-full bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700">
                Gerar Relatório
              </button>
            </div>
          </div>
        </div>

        {/* Métricas Principais */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                  <span className="text-white text-sm font-medium">📅</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total de Aulas
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    1,247
                  </dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-red-500 rounded-md flex items-center justify-center">
                  <span className="text-white text-sm font-medium">❌</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total de Faltas
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    89
                  </dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center">
                  <span className="text-white text-sm font-medium">🔄</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Reagendamentos
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    156
                  </dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                  <span className="text-white text-sm font-medium">📊</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    % Frequência
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    92.8%
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Gráficos e Tabelas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Frequência por Mês */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Frequência por Mês
            </h3>
            <div className="h-64 flex items-center justify-center bg-gray-50 rounded">
              <p className="text-gray-500">Gráfico de frequência mensal</p>
            </div>
          </div>

          {/* Top Professores */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Professores - Aulas Ministradas
            </h3>
            <div className="space-y-4">
              {[
                { nome: 'Carlos Oliveira', aulas: 324, percentual: 35 },
                { nome: 'Ana Paula', aulas: 298, percentual: 32 },
                { nome: 'Roberto Silva', aulas: 245, percentual: 26 },
              ].map((professor, index) => (
                <div key={index}>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-gray-900">{professor.nome}</span>
                    <span className="text-gray-500">{professor.aulas} aulas</span>
                  </div>
                  <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-primary-600 h-2 rounded-full"
                      style={{ width: `${professor.percentual}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Faltas por Aluno */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Alunos com Mais Faltas
            </h3>
            <div className="overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Aluno
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Faltas
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      % Frequência
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {[
                    { nome: 'Pedro Costa', faltas: 12, frequencia: 78 },
                    { nome: 'Maria Silva', faltas: 8, frequencia: 85 },
                    { nome: 'João Santos', faltas: 6, frequencia: 89 },
                  ].map((aluno, index) => (
                    <tr key={index}>
                      <td className="px-3 py-2 text-sm text-gray-900">{aluno.nome}</td>
                      <td className="px-3 py-2 text-sm text-gray-500">{aluno.faltas}</td>
                      <td className="px-3 py-2 text-sm text-gray-500">{aluno.frequencia}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Resumo Semanal */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Resumo da Semana
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Aulas Realizadas:</span>
                <span className="text-sm font-medium text-gray-900">47</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Faltas:</span>
                <span className="text-sm font-medium text-red-600">3</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Reagendamentos:</span>
                <span className="text-sm font-medium text-yellow-600">8</span>
              </div>
              <div className="flex justify-between border-t pt-3">
                <span className="text-sm font-medium text-gray-900">Taxa de Frequência:</span>
                <span className="text-sm font-bold text-green-600">94.0%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}