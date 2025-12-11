'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Logo from '@/components/Logo';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [remember, setRemember] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [showModalSenha, setShowModalSenha] = useState(false);
  const [showModalAcesso, setShowModalAcesso] = useState(false);
  const [adminContact, setAdminContact] = useState<{ whatsapp: string; nome: string } | null>(null);
  const router = useRouter();

  // Carregar email salvo se existir (lembrar-me)
  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem('rememberedEmail');
      const savedRemember = localStorage.getItem('rememberLogin') === 'true';
      if (savedEmail && savedRemember) {
        setEmail(savedEmail);
        setRemember(true);
      }
    } catch (e) {
      // Ignorar erros de localStorage
    }
  }, []);

  // Buscar contato do admin ao montar
  useEffect(() => {
    fetch('/api/public/admin-contact')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setAdminContact({ whatsapp: data.whatsapp, nome: data.nome });
        }
      })
      .catch(() => {
        // Silenciar erro - botão ficará desabilitado
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setCarregando(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha, remember }),
      });
      const data = await response.json();
      if (response.ok) {
        try { 
          localStorage.setItem('user', JSON.stringify(data.user)); 
          localStorage.setItem('token', data.token);
          
          // Salvar email se lembrar-me estiver ativado
          if (remember) {
            localStorage.setItem('rememberedEmail', email);
            localStorage.setItem('rememberLogin', 'true');
          } else {
            localStorage.removeItem('rememberedEmail');
            localStorage.removeItem('rememberLogin');
          }
        } catch (e) { /* ignore storage errors */ }
        // Força reload completo para garantir que o UserContext seja reiniciado com os novos dados
        window.location.href = '/dashboard';
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
    <div className="min-h-screen flex overflow-x-hidden">
      {/* Lado esquerdo - Hero com informações */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-green-600 via-green-700 to-green-900 relative overflow-hidden">
        {/* Elementos decorativos de fundo */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-48 h-48 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-10 right-10 w-64 h-64 bg-green-300 rounded-full blur-3xl"></div>
        </div>
        
        {/* Conteúdo */}
        <div className="relative z-10 flex flex-col justify-center items-center px-8 xl:px-12 py-8 w-full">
          <div className="max-w-md text-left">
            {/* Logo */}
            <div className="mb-6">
              <Logo size="md" noLink useLogo2 className="brightness-0 invert" />
            </div>
            
            {/* Título e descrição */}
            <h1 className="text-2xl xl:text-3xl font-bold text-white mb-3 leading-tight">
              Gerencie seu studio com <span className="text-green-300">eficiência</span>
            </h1>
            <p className="text-sm text-green-100 mb-6 leading-relaxed">
              Sistema completo de gestão para o Studio Superação.
            </p>
            
            {/* Features */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/10">
                <div className="flex-shrink-0 w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center">
                  <i className="fas fa-calendar-check text-white text-sm"></i>
                </div>
                <div>
                  <h3 className="text-white font-medium text-sm">Agenda Inteligente</h3>
                  <p className="text-green-200 text-xs">Reagendamentos e horários flexíveis</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/10">
                <div className="flex-shrink-0 w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center">
                  <i className="fas fa-users text-white text-sm"></i>
                </div>
                <div>
                  <h3 className="text-white font-medium text-sm">Gestão de Pessoas</h3>
                  <p className="text-green-200 text-xs">Alunos e professores integrados</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/10">
                <div className="flex-shrink-0 w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center">
                  <i className="fas fa-chart-line text-white text-sm"></i>
                </div>
                <div>
                  <h3 className="text-white font-medium text-sm">Relatórios Completos</h3>
                  <p className="text-green-200 text-xs">Métricas e insights do seu negócio</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lado direito - Formulário de login */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 bg-gray-50">
        <div className="w-full max-w-sm">
          {/* Logo mobile */}
          <div className="lg:hidden mb-6 text-center">
            <Logo size="sm" noLink className="mx-auto" />
          </div>
          
          {/* Card de login */}
          <div className=" rounded-xl p-6 sm:p-8 ">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-xl mb-3">
                <i className="fas fa-lock text-green-600 text-lg"></i>
              </div>
              <h2 className="text-xl font-bold text-gray-900">Bem-vindo de volta!</h2>
              <p className="text-gray-500 text-sm mt-1">Entre com suas credenciais</p>
            </div>

            {/* Erro */}
            {erro && (
              <div className="mb-4 flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
                <i className="fas fa-exclamation-circle"></i>
                <span>{erro}</span>
              </div>
            )}

            {/* Formulário */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-xs font-medium text-gray-700 mb-1.5">
                  Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <i className="fas fa-envelope text-gray-400 text-sm"></i>
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="block w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    placeholder="seu@email.com"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="senha" className="block text-xs font-medium text-gray-700 mb-1.5">
                  Senha
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <i className="fas fa-key text-gray-400 text-sm"></i>
                  </div>
                  <input
                    id="senha"
                    name="senha"
                    type={mostrarSenha ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={senha}
                    onChange={e => setSenha(e.target.value)}
                    className="block w-full pl-9 pr-10 py-2.5 text-sm border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha(!mostrarSenha)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <i className={`fas ${mostrarSenha ? 'fa-eye-slash' : 'fa-eye'} text-sm`}></i>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={remember} 
                    onChange={e => setRemember(e.target.checked)} 
                    className="w-3.5 h-3.5 text-green-600 border-gray-300 rounded focus:ring-green-500 cursor-pointer" 
                  />
                  <span className="ml-2 text-xs text-gray-600 group-hover:text-gray-800 transition-colors">Lembrar-me</span>
                </label>
                <button 
                  type="button"
                  onClick={() => setShowModalSenha(true)}
                  className="text-xs text-green-600 hover:text-green-700 font-medium transition-colors"
                >
                  Esqueceu a senha?
                </button>
              </div>

              <button 
                type="submit" 
                disabled={carregando} 
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white text-sm font-semibold rounded-lg shadow-md shadow-green-500/25 hover:shadow-green-500/35 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {carregando ? (
                  <>
                    <i className="fas fa-circle-notch fa-spin text-sm"></i>
                    <span>Entrando...</span>
                  </>
                ) : (
                  <>
                    <span>Entrar</span>
                    <i className="fas fa-arrow-right text-sm"></i>
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-3 bg-white text-gray-400">ou</span>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center">
              <p className="text-xs text-gray-500">
                Não tem uma conta?{' '}
                <button 
                  type="button"
                  onClick={() => setShowModalAcesso(true)}
                  className="text-green-600 hover:text-green-700 font-medium transition-colors"
                >
                  Solicite acesso
                </button>
              </p>
            </div>
          </div>

          {/* Copyright */}
          <p className="text-center text-xs text-gray-400 mt-6">
            © 2025 Studio Superação
          </p>
        </div>
      </div>

      {/* Modal Esqueceu a Senha */}
      {showModalSenha && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl">
            <div className="text-center mb-4">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-yellow-100 rounded-full mb-3">
                <i className="fas fa-key text-yellow-600 text-xl"></i>
              </div>
              <h3 className="text-lg font-bold text-gray-900">Esqueceu sua senha?</h3>
              <p className="text-sm text-gray-500 mt-2">
                Entre em contato com o administrador do sistema para redefinir sua senha.
              </p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="text-xs text-gray-600 mb-2">
                <i className="fas fa-info-circle text-gray-400 mr-1"></i>
                Envie uma mensagem informando:
              </p>
              <ul className="text-xs text-gray-600 space-y-1 ml-4">
                <li>• Seu nome completo</li>
                <li>• Email de acesso</li>
                <li>• Solicitação de nova senha</li>
              </ul>
            </div>

            <div className="flex flex-col gap-2">
              {adminContact ? (
                <a
                  href={`https://wa.me/${adminContact.whatsapp}?text=${encodeURIComponent('Olá! Esqueci minha senha do sistema Superação Flux.\n\nMeu email de acesso é: ')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  <i className="fab fa-whatsapp text-lg"></i>
                  Contatar {adminContact.nome || 'Admin'}
                </a>
              ) : (
                <button
                  disabled
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gray-300 text-gray-500 text-sm font-semibold rounded-lg cursor-not-allowed"
                >
                  <i className="fas fa-spinner fa-spin"></i>
                  Carregando contato...
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowModalSenha(false)}
                className="w-full py-2.5 px-4 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Solicitar Acesso */}
      {showModalAcesso && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl">
            <div className="text-center mb-4">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-3">
                <i className="fas fa-user-plus text-blue-600 text-xl"></i>
              </div>
              <h3 className="text-lg font-bold text-gray-900">Solicitar Acesso</h3>
              <p className="text-sm text-gray-500 mt-2">
                Para obter acesso ao sistema, entre em contato com o administrador.
              </p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="text-xs text-gray-600 mb-2">
                <i className="fas fa-info-circle text-gray-400 mr-1"></i>
                Informe ao administrador:
              </p>
              <ul className="text-xs text-gray-600 space-y-1 ml-4">
                <li>• Seu nome completo</li>
                <li>• Email para cadastro</li>
                <li>• Função (Professor ou Outro)</li>
                <li>• Telefone para contato</li>
              </ul>
            </div>

            <div className="flex flex-col gap-2">
              {adminContact ? (
                <a
                  href={`https://wa.me/${adminContact.whatsapp}?text=${encodeURIComponent('Olá! Gostaria de solicitar acesso ao sistema Superação Flux.\n\nMeus dados:\nNome: \nEmail: \nFunção: \nTelefone: ')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  <i className="fab fa-whatsapp text-lg"></i>
                  Solicitar para {adminContact.nome || 'Admin'}
                </a>
              ) : (
                <button
                  disabled
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gray-300 text-gray-500 text-sm font-semibold rounded-lg cursor-not-allowed"
                >
                  <i className="fas fa-spinner fa-spin"></i>
                  Carregando contato...
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowModalAcesso(false)}
                className="w-full py-2.5 px-4 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}