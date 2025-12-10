'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log do erro para monitoramento (futuramente Sentry)
    console.error('Erro na aplicação:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        {/* Ícone de Erro */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-red-100 rounded-full mb-4">
            <i className="fas fa-exclamation-triangle text-4xl text-red-600"></i>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Algo deu errado</h1>
          <h2 className="text-lg text-gray-600">Ocorreu um erro inesperado</h2>
        </div>

        {/* Mensagem */}
        <p className="text-gray-500 mb-6">
          Pedimos desculpas pelo inconveniente. Nossa equipe foi notificada e está trabalhando para resolver o problema.
        </p>

        {/* Detalhes do erro (apenas em desenvolvimento) */}
        {process.env.NODE_ENV === 'development' && error.message && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-left">
            <p className="text-xs font-mono text-red-700 break-all">
              {error.message}
            </p>
            {error.digest && (
              <p className="text-xs text-red-500 mt-2">
                ID: {error.digest}
              </p>
            )}
          </div>
        )}

        {/* Ações */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
          >
            <i className="fas fa-redo"></i>
            Tentar Novamente
          </button>
          <button
            onClick={() => window.location.href = '/'}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            <i className="fas fa-home"></i>
            Página Inicial
          </button>
        </div>

        {/* Suporte */}
        <p className="text-xs text-gray-400 mt-8">
          Se o problema persistir, entre em contato com o suporte técnico.
        </p>
      </div>
    </div>
  );
}
