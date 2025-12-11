'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Logo from '@/components/Logo';
import Link from 'next/link';
import InstallAppPrompt from '@/components/InstallAppPrompt';

export default function AlunoLoginPage() {
  const [cpf, setCpf] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [remember, setRemember] = useState(false);
  const [adminContact, setAdminContact] = useState<{ whatsapp: string; nome: string } | null>(null);
  const [showModalAjuda, setShowModalAjuda] = useState(false);
  const router = useRouter();

  // Carregar CPF salvo se existir (lembrar-me)
  useEffect(() => {
    try {
      const savedCpf = localStorage.getItem('rememberedAlunoCpf');
      const savedRemember = localStorage.getItem('rememberAlunoLogin') === 'true';
      if (savedCpf && savedRemember) {
        setCpf(savedCpf);
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
      .catch(() => {});
  }, []);

  // Formatar CPF enquanto digita
  const formatarCPF = (valor: string) => {
    const apenasNumeros = valor.replace(/\D/g, '');
    if (apenasNumeros.length <= 3) return apenasNumeros;
    if (apenasNumeros.length <= 6) return `${apenasNumeros.slice(0, 3)}.${apenasNumeros.slice(3)}`;
    if (apenasNumeros.length <= 9) return `${apenasNumeros.slice(0, 3)}.${apenasNumeros.slice(3, 6)}.${apenasNumeros.slice(6)}`;
    return `${apenasNumeros.slice(0, 3)}.${apenasNumeros.slice(3, 6)}.${apenasNumeros.slice(6, 9)}-${apenasNumeros.slice(9, 11)}`;
  };

  const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatarCPF(e.target.value);
    if (formatted.length <= 14) {
      setCpf(formatted);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');

    // Validação básica
    const cpfLimpo = cpf.replace(/\D/g, '');
    if (cpfLimpo.length !== 11) {
      setErro('CPF deve ter 11 dígitos');
      return;
    }

    if (!dataNascimento) {
      setErro('Data de nascimento é obrigatória');
      return;
    }

    setCarregando(true);

    try {
      const response = await fetch('/api/aluno/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          cpf: cpfLimpo, 
          dataNascimento,
          remember
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // Salvar dados do aluno no localStorage
        try { 
          localStorage.setItem('aluno', JSON.stringify(data.aluno)); 
          localStorage.setItem('alunoToken', data.token);
          
          // Salvar CPF se lembrar-me estiver ativado
          if (remember) {
            localStorage.setItem('rememberedAlunoCpf', cpf);
            localStorage.setItem('rememberAlunoLogin', 'true');
          } else {
            localStorage.removeItem('rememberedAlunoCpf');
            localStorage.removeItem('rememberAlunoLogin');
          }
        } catch (e) { /* ignore storage errors */ }
        
        // Redirecionar para área do aluno
        window.location.href = '/aluno';
      } else {
        setErro(data.error || 'CPF ou data de nascimento incorretos');
      }
    } catch (error) {
      setErro('Erro de conexão. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <>
      {/* Prompt de instalação do app - aparece antes do login */}
      <InstallAppPrompt />
      
      <div className="min-h-screen flex overflow-x-hidden">
      {/* Lado esquerdo - Hero com informações */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 relative overflow-hidden">
        {/* Elementos decorativos de fundo */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-48 h-48 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-10 right-10 w-64 h-64 bg-primary-300 rounded-full blur-3xl"></div>
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
              Área do <span className="text-primary-300">Aluno</span>
            </h1>
            <p className="text-sm text-primary-100 mb-6 leading-relaxed">
              Acesse sua agenda, solicite reagendamentos e acompanhe suas aulas no Studio Superação.
            </p>
            
            {/* Features para alunos */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/10">
                <div className="flex-shrink-0 w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center">
                  <i className="fas fa-calendar-alt text-white text-sm"></i>
                </div>
                <div>
                  <h3 className="text-white font-medium text-sm">Sua Agenda</h3>
                  <p className="text-primary-200 text-xs">Veja seus horários de aula</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/10">
                <div className="flex-shrink-0 w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center">
                  <i className="fas fa-exchange-alt text-white text-sm"></i>
                </div>
                <div>
                  <h3 className="text-white font-medium text-sm">Reagendamentos</h3>
                  <p className="text-primary-200 text-xs">Solicite mudanças de horário</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/10">
                <div className="flex-shrink-0 w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center">
                  <i className="fas fa-history text-white text-sm"></i>
                </div>
                <div>
                  <h3 className="text-white font-medium text-sm">Histórico</h3>
                  <p className="text-primary-200 text-xs">Acompanhe suas presenças</p>
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
          <div className="rounded-xl p-6 sm:p-8">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-primary-100 rounded-xl mb-3">
                <i className="fas fa-user-graduate text-primary-600 text-xl"></i>
              </div>
              <h2 className="text-xl font-bold text-gray-900">Olá, Aluno!</h2>
              <p className="text-gray-500 text-sm mt-1">Entre com seu CPF e data de nascimento</p>
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
                <label htmlFor="cpf" className="block text-xs font-medium text-gray-700 mb-1.5">
                  CPF
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <i className="fas fa-id-card text-gray-400 text-sm"></i>
                  </div>
                  <input
                    id="cpf"
                    name="cpf"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    required
                    value={cpf}
                    onChange={handleCPFChange}
                    className="block w-full pl-9 pr-3 py-3 text-base border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                    placeholder="000.000.000-00"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="dataNascimento" className="block text-xs font-medium text-gray-700 mb-1.5">
                  Data de Nascimento
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <i className="fas fa-calendar text-gray-400 text-sm"></i>
                  </div>
                  <input
                    id="dataNascimento"
                    name="dataNascimento"
                    type="date"
                    required
                    value={dataNascimento}
                    onChange={e => setDataNascimento(e.target.value)}
                    className="block w-full max-w-full pl-9 pr-3 py-3 text-base border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all appearance-none [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                    style={{ minWidth: 0 }}
                  />
                </div>
              </div>

              {/* Checkbox Lembrar-me */}
              <div className="flex items-center">
                <label className="flex items-center cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={remember} 
                    onChange={e => setRemember(e.target.checked)} 
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500 cursor-pointer" 
                  />
                  <span className="ml-2 text-sm text-gray-600 group-hover:text-gray-800 transition-colors">
                    Lembrar meu CPF neste dispositivo
                  </span>
                </label>
              </div>

              <button 
                type="submit" 
                disabled={carregando} 
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white text-sm font-semibold rounded-lg shadow-md shadow-primary-500/25 hover:shadow-primary-500/35 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {carregando ? (
                  <>
                    <i className="fas fa-circle-notch fa-spin text-sm"></i>
                    <span>Entrando...</span>
                  </>
                ) : (
                  <>
                    <span>Acessar Minha Área</span>
                    <i className="fas fa-arrow-right text-sm"></i>
                  </>
                )}
              </button>
            </form>

            {/* Ajuda */}
            <div className="mt-4 text-center">
              <button 
                type="button"
                onClick={() => setShowModalAjuda(true)}
                className="text-xs text-gray-500 hover:text-primary-600 transition-colors"
              >
                <i className="fas fa-question-circle mr-1"></i>
                Precisa de ajuda?
              </button>
            </div>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-3 bg-gray-50 text-gray-400">acesso interno</span>
              </div>
            </div>

            {/* Link para login administrativo */}
            <Link
              href="/admin/login"
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-gray-300 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-100 hover:border-gray-400 transition-all"
            >
              <i className="fas fa-user-shield text-gray-400 text-xs"></i>
              <span>Sou Funcionário / Admin</span>
            </Link>

            {/* Links de Privacidade e Termos */}
            <div className="flex items-center justify-center gap-3 mt-4 text-xs text-gray-400">
              <Link href="/privacidade" className="hover:text-primary-600 transition-colors">
                Privacidade
              </Link>
              <span>•</span>
              <Link href="/termos" className="hover:text-primary-600 transition-colors">
                Termos de Uso
              </Link>
            </div>
          </div>

          {/* Copyright */}
          <p className="text-center text-xs text-gray-400 mt-6">
            © 2025 Studio Superação
          </p>
        </div>
      </div>

      {/* Modal de Ajuda */}
      {showModalAjuda && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl">
            <div className="text-center mb-4">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-3">
                <i className="fas fa-question-circle text-blue-600 text-xl"></i>
              </div>
              <h3 className="text-lg font-bold text-gray-900">Precisa de ajuda?</h3>
            </div>
            
            <div className="space-y-3 mb-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-600">
                  <i className="fas fa-id-card text-primary-500 mr-2"></i>
                  <strong>CPF não cadastrado?</strong><br />
                  Informe seu CPF na recepção para ter acesso.
                </p>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-600">
                  <i className="fas fa-calendar text-primary-500 mr-2"></i>
                  <strong>Data incorreta?</strong><br />
                  Use a data de nascimento cadastrada no sistema.
                </p>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-600">
                  <i className="fas fa-exclamation-triangle text-yellow-500 mr-2"></i>
                  <strong>Continua com problema?</strong><br />
                  Entre em contato com a equipe do studio.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {adminContact ? (
                <a
                  href={`https://wa.me/${adminContact.whatsapp}?text=${encodeURIComponent('Olá! Estou com dificuldade para acessar a área do aluno no sistema.\n\nMeu nome é: ')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  <i className="fab fa-whatsapp text-lg"></i>
                  Falar no WhatsApp
                </a>
              ) : (
                <button
                  disabled
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gray-300 text-gray-500 text-sm font-semibold rounded-lg cursor-not-allowed"
                >
                  <i className="fas fa-spinner fa-spin"></i>
                  Carregando...
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowModalAjuda(false)}
                className="w-full py-2.5 px-4 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}