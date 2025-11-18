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
    <div className="min-h-screen bg-gradient-to-br from-primary-700 via-primary-900 to-gray-900 flex items-center justify-center p-0">
      {/* Esquerda: Informativo profissional, sem logo */}
      <div className="hidden lg:flex w-1/2 flex-col justify-center items-center px-12 py-16 from-primary-800 to-primary-950 text-white fade-in-1">
        <div className="max-w-md w-full text-left">
          <div className="mb-6 fade-in-2">
            <Logo size="lg" noLink useLogo2 className="mb-2" />
          </div>
          <h2 className="text-3xl font-bold mb-4 tracking-tight fade-in-3">Bem-vindo ao Superação Flux</h2>
          <p className="text-lg text-primary-100 mb-6 fade-in-4">Sistema de gestão do Studio Superação. Gerencie horários, alunos e professores com agilidade e segurança.</p>
          <ul className="space-y-3 text-base fade-in-5">
            <li className="flex items-center gap-2"><i className="fas fa-calendar-check text-primary-300" /> Horários flexíveis e reagendamentos</li>
            <li className="flex items-center gap-2"><i className="fas fa-user-graduate text-primary-300" /> Cadastro de alunos e professores</li>
            <li className="flex items-center gap-2"><i className="fas fa-chart-line text-primary-300" /> Relatórios gerenciais</li>
          </ul>
          <div className="mt-8 bg-white bg-opacity-10 p-4 rounded-lg border border-white/10 shadow-lg fade-in-6">
            <p className="text-sm text-primary-100">Dica: Não marque &apos;Lembrar-me&apos; em dispositivos públicos.</p>
          </div>
        </div>
      </div>

      {/* Direita: Login form */}
      <div className="flex-1 flex items-center justify-center p-6 backdrop-blur-md">
        <div className="max-w-md w-full rounded-xl shadow-2xl bg-white p-8 border border-gray-100 fade-in-1">
          <div className="mb-6 text-center fade-in-2">
            <h1 className=" text-2xl font-bold text-gray-900 mb-2">Entrar na sua conta</h1>
            <p className="text-sm text-gray-500">Informe seu email e senha para acessar o painel.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {erro && <div className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded fade-in-5">{erro}</div>}

            <div className="fade-in-6">
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

            <div className="fade-in-7">
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

            <div className="flex items-center justify-between fade-in-8">
              <label className="flex items-center text-sm">
                <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} className="h-4 w-4 text-primary-600 border-gray-300 rounded" />
                <span className="ml-2 text-gray-700">Lembrar-me</span>
              </label>
              <a href="#" className="text-sm text-primary-600 hover:underline">Esqueceu a senha?</a>
            </div>

            <div className="fade-in-8">
              <button type="submit" disabled={carregando} className=" w-full inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 fade-in-10">
                {carregando ? 'Entrando...' : 'Entrar'}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500">
            <div className="fade-in-8">
              <span>Não tem uma conta? </span><a href="#" className="text-primary-600 hover:underline">Peça acesso ao administrador</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}