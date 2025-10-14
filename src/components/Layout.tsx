import React from 'react';
import Logo from './Logo';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
}

export default function Layout({ children, title = 'Superação Flux' }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-dark-900 shadow-sm border-b border-dark-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Logo size="md" />
            </div>
            
            <div className="flex items-center space-x-4">
              <nav className="hidden md:flex space-x-8">
                <a href="/dashboard" className="text-gray-300 hover:text-primary-500 px-3 py-2 rounded-md text-sm font-medium transition-colors">
                  Dashboard
                </a>
                <a href="/modalidades" className="text-gray-300 hover:text-primary-500 px-3 py-2 rounded-md text-sm font-medium transition-colors">
                  Modalidades
                </a>
                <a href="/alunos" className="text-gray-300 hover:text-primary-500 px-3 py-2 rounded-md text-sm font-medium transition-colors">
                  Alunos
                </a>
                <a href="/professores" className="text-gray-300 hover:text-primary-500 px-3 py-2 rounded-md text-sm font-medium transition-colors">
                  Professores
                </a>
                <a href="/horarios" className="text-gray-300 hover:text-primary-500 px-3 py-2 rounded-md text-sm font-medium transition-colors">
                  Horários
                </a>
                <a href="/reagendamentos" className="text-gray-300 hover:text-primary-500 px-3 py-2 rounded-md text-sm font-medium transition-colors">
                  Reagendamentos
                </a>
                <a href="/relatorios" className="text-gray-300 hover:text-primary-500 px-3 py-2 rounded-md text-sm font-medium transition-colors">
                  Relatórios
                </a>
              </nav>
              
              <button className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
                Sair
              </button>
            </div>
          </div>
        </div>
      </nav>
      
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}