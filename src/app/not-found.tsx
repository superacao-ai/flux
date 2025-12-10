'use client';

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        {/* Ícone 404 */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-primary-100 rounded-full mb-4">
            <i className="fas fa-map-signs text-4xl text-primary-600"></i>
          </div>
          <h1 className="text-6xl font-bold text-gray-800 mb-2">404</h1>
          <h2 className="text-xl font-semibold text-gray-600">Página não encontrada</h2>
        </div>

        {/* Mensagem */}
        <p className="text-gray-500 mb-8">
          A página que você está procurando não existe ou foi movida para outro endereço.
        </p>

        {/* Ações */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
          >
            <i className="fas fa-home"></i>
            Página Inicial
          </Link>
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            <i className="fas fa-arrow-left"></i>
            Voltar
          </button>
        </div>

        {/* Ajuda */}
        <p className="text-xs text-gray-400 mt-8">
          Se você acredita que isso é um erro, entre em contato com o suporte.
        </p>
      </div>
    </div>
  );
}
