import Logo from '@/components/Logo';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900">
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <Logo size="xl" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">
            Superação Flux
          </h1>
          <p className="text-xl text-gray-300 mb-8">
            Sistema de Gestão do Studio Superação
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-12">
            <div className="bg-white p-6 rounded-lg shadow-lg hover:shadow-xl transition-shadow border-l-4 border-primary-500">
              <h3 className="text-lg font-semibold mb-2 text-dark-900">Alunos</h3>
              <p className="text-gray-600">Cadastro e gerenciamento de alunos</p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-lg hover:shadow-xl transition-shadow border-l-4 border-primary-500">
              <h3 className="text-lg font-semibold mb-2 text-dark-900">Professores</h3>
              <p className="text-gray-600">Gestão da equipe de professores</p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-lg hover:shadow-xl transition-shadow border-l-4 border-primary-500">
              <h3 className="text-lg font-semibold mb-2 text-dark-900">Horários</h3>
              <p className="text-gray-600">Agendamento e controle de horários</p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-lg hover:shadow-xl transition-shadow border-l-4 border-primary-500">
              <h3 className="text-lg font-semibold mb-2 text-dark-900">Relatórios</h3>
              <p className="text-gray-600">Análises e relatórios gerenciais</p>
            </div>
          </div>
          
          <div className="mt-12">
            <a href="/login" className="bg-primary-500 hover:bg-primary-600 text-white px-8 py-3 rounded-lg font-medium inline-block transition-colors shadow-lg hover:shadow-xl">
              Fazer Login
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}