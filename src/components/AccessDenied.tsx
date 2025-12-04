"use client";

import { useRouter } from 'next/navigation';

export default function AccessDenied() {
  const router = useRouter();

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-xl w-full bg-white border border-gray-200 rounded-lg shadow p-8 text-center">
        <div className="text-6xl text-red-500 mb-4">⛔</div>
        <h2 className="text-2xl font-semibold text-gray-900">Acesso negado</h2>
        <p className="mt-3 text-sm text-gray-600">Você não tem permissão para acessar esta área. Se acha que deveria ter acesso, faça login com uma conta autorizada ou contate o administrador.</p>

        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={() => router.replace('/admin/login')}
            className="px-4 py-2 rounded-md bg-primary-600 text-white text-sm font-medium hover:bg-primary-700"
          >
            Ir para Login
          </button>

          <button
            onClick={() => router.back()}
            className="px-4 py-2 rounded-md bg-gray-100 text-gray-800 text-sm font-medium hover:bg-gray-200"
          >
            Voltar
          </button>
        </div>
      </div>
    </div>
  );
}
