"use client";

import { useRouter } from 'next/navigation';

export default function AccessDenied() {
  const router = useRouter();

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-md w-full">
        {/* Card principal */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header com gradiente */}
          <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-8 text-center">
            <div className="w-20 h-20 mx-auto bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mb-4">
              <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white">Acesso Restrito</h1>
            <p className="text-red-100 mt-2 text-sm">
              Código de erro: 403
            </p>
          </div>

          {/* Conteúdo */}
          <div className="px-6 py-8">
            <div className="text-center mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                Permissão Negada
              </h2>
              <p className="text-gray-600 text-sm leading-relaxed">
                Você não possui as credenciais necessárias para acessar esta área do sistema. 
                Este recurso está disponível apenas para usuários autorizados.
              </p>
            </div>

            {/* Dicas */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
              <div className="flex gap-3">
                <div className="flex-shrink-0">
                  <svg className="w-5 h-5 text-amber-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="text-sm text-amber-800">
                  <p className="font-medium mb-1">O que você pode fazer:</p>
                  <ul className="space-y-1 text-amber-700">
                    <li>• Verifique se está logado com a conta correta</li>
                    <li>• Solicite acesso ao administrador do sistema</li>
                    <li>• Retorne à página anterior ou ao início</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Botões */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => router.back()}
                className="flex-1 px-4 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Voltar
              </button>
              <button
                onClick={() => router.replace('/admin/login')}
                className="flex-1 px-4 py-3 rounded-xl bg-primary-600 text-white font-medium hover:bg-primary-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-primary-600/25"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                Fazer Login
              </button>
            </div>
          </div>
        </div>

        {/* Footer discreto */}
        <p className="text-center text-xs text-gray-400 mt-6">
          Se você acredita que isso é um erro, entre em contato com o suporte técnico.
        </p>
      </div>
    </div>
  );
}
