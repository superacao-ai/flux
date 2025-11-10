'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Logo from '@/components/Logo';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [remember, setRemember] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setCarregando(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha }),
      });
      const data = await response.json();
      if (response.ok) {
        try { localStorage.setItem('user', JSON.stringify(data.user)); localStorage.setItem('token', data.token); } catch (e) { /* ignore storage errors */ }
        router.push('/dashboard');
      } else {
        setErro(data.error || 'Erro ao fazer login');
      }
    } catch (error) {
      setErro('Erro de conexão');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <div className="hidden lg:flex w-1/2 bg-gradient-to-b from-primary-700 to-primary-900 text-white items-center justify-center p-12">
        <div className="max-w-md">
          <div className="flex items-center justify-center mb-4">
            <Logo size="xl" noLink useLogo2 />
          </div>
          {/* Removed the 'FLUX' title as requested; logo remains */}
          <p className="text-lg text-primary-100">Sistema de gestão do Studio Superação. Acesse os horários, gerencie alunos e professores com rapidez e segurança.</p>
          <div className="mt-8 bg-white bg-opacity-5 p-4 rounded-lg border border-white/10">
            <p className="text-sm">Se estiver usando um dispositivo público, não marque 'Lembrar-me'.</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <div className="mb-6 text-center">
            <div className="flex justify-center mb-4">
              <Logo size="lg" noLink useLogo2 />
            </div>
            <h1 className="text-2xl font-semibold">Entrar na sua conta</h1>
            <p className="text-sm text-gray-500 mt-1">Informe seu email e senha para acessar o painel.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {erro && <div className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded">{erro}</div>}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                placeholder="seu@email.com"
              />
            </div>

            <div>
              <label htmlFor="senha" className="block text-sm font-medium text-gray-700">Senha</label>
              <input
                id="senha"
                name="senha"
                type="password"
                autoComplete="current-password"
                required
                value={senha}
                onChange={e => setSenha(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                placeholder="Sua senha"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center text-sm">
                <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} className="h-4 w-4 text-primary-600 border-gray-300 rounded" />
                <span className="ml-2 text-gray-700">Lembrar-me</span>
              </label>
              <a href="#" className="text-sm text-primary-600 hover:underline">Esqueceu a senha?</a>
            </div>

            <div>
              <button type="submit" disabled={carregando} className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50">
                {carregando ? 'Entrando...' : 'Entrar'}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500">
            <span>Não tem uma conta? </span><a href="#" className="text-primary-600 hover:underline">Peça acesso ao administrador</a>
          </div>
        </div>
      </div>
    </div>
  );
}