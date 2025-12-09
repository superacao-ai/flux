'use client';

import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallAppPrompt() {
  const [mounted, setMounted] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Primeiro useEffect: apenas marca como montado
  useEffect(() => {
    setMounted(true);
  }, []);

  // Segundo useEffect: lógica do prompt (só roda após mount)
  useEffect(() => {
    if (!mounted) return;

    // Verificar se já está instalado (standalone mode)
    const standalone = window.matchMedia('(display-mode: standalone)').matches 
      || (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    // Verificar se é iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(ios);

    // Verificar se é dispositivo móvel
    const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
      || window.innerWidth < 768;
    setIsMobile(mobile);

    // Verificar se o usuário já dispensou o prompt recentemente (24 horas)
    const lastDismissed = localStorage.getItem('pwa-prompt-dismissed');
    const dismissedRecently = lastDismissed && (Date.now() - parseInt(lastDismissed)) < 24 * 60 * 60 * 1000;

    // Verificar se já instalou
    const alreadyInstalled = localStorage.getItem('appInstalled') === 'true';

    if (standalone || alreadyInstalled) {
      setShowPrompt(false);
      return;
    }

    if (!dismissedRecently) {
      // Mostrar prompt após um pequeno delay para não ser intrusivo imediatamente
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 1500);
      return () => clearTimeout(timer);
    }

    // Capturar o evento beforeinstallprompt (Android/Desktop Chrome)
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, [mounted]);

  const handleInstall = async () => {
    if (deferredPrompt) {
      // Android/Desktop Chrome - usar o prompt nativo
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        localStorage.setItem('appInstalled', 'true');
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    } else if (isIOS) {
      // iOS - mostrar instruções
      // O prompt já mostra as instruções para iOS
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('pwa-prompt-dismissed', Date.now().toString());
    setShowPrompt(false);
  };

  // Não renderizar nada até montar (evita hydration mismatch)
  if (!mounted) {
    return null;
  }

  if (!showPrompt || isStandalone || !isMobile) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 flex flex-col items-center justify-center p-6">
      {/* Logo e Branding */}
      <div className="text-center mb-10">
        <div className="w-16 h-16 flex items-center justify-center mx-auto mb-4">
          <img src="/s.png" alt="Logo Superação" className="w-full h-full object-contain drop-shadow-lg" />
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Studio Superação</h1>
      </div>

      {/* Benefícios */}
      <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-8 max-w-sm w-full">
        <h2 className="text-white font-semibold text-lg mb-4 text-center">
          Instale o app para uma experiência melhor
        </h2>
        <ul className="space-y-3">
          <li className="flex items-center gap-3 text-white/90">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
              <i className="fas fa-bolt text-yellow-300 text-sm"></i>
            </div>
            <span className="text-sm">Acesso rápido direto da tela inicial</span>
          </li>
          <li className="flex items-center gap-3 text-white/90">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
              <i className="fas fa-bell text-yellow-300 text-sm"></i>
            </div>
            <span className="text-sm">Receba notificações de suas aulas</span>
          </li>
          <li className="flex items-center gap-3 text-white/90">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
              <i className="fas fa-expand text-yellow-300 text-sm"></i>
            </div>
            <span className="text-sm">Tela cheia sem barra do navegador</span>
          </li>
          <li className="flex items-center gap-3 text-white/90">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
              <i className="fas fa-wifi text-yellow-300 text-sm"></i>
            </div>
            <span className="text-sm">Funciona mesmo offline</span>
          </li>
        </ul>
      </div>

      {/* Botão de instalação */}
      {isIOS ? (
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl mb-6">
          <h3 className="font-semibold text-gray-900 mb-4 text-center">
            Como instalar no iPhone/iPad:
          </h3>
          <ol className="space-y-3 text-sm text-gray-600">
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-xs">1</span>
              <span>Toque no botão <i className="fas fa-share-from-square text-blue-500"></i> compartilhar na barra inferior</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-xs">2</span>
              <span>Role e toque em <strong>&quot;Adicionar à Tela de Início&quot;</strong></span>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-xs">3</span>
              <span>Toque em <strong>&quot;Adicionar&quot;</strong> no canto superior direito</span>
            </li>
          </ol>
          <button
            onClick={() => {
              localStorage.setItem('appInstalled', 'true');
              setShowPrompt(false);
            }}
            className="w-full mt-4 py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition"
          >
            <i className="fas fa-check mr-2"></i>
            Entendi, vou instalar!
          </button>
        </div>
      ) : (
        <button
          onClick={handleInstall}
          className="w-full max-w-sm py-4 bg-white text-primary-700 rounded-2xl font-bold text-lg shadow-2xl hover:bg-gray-50 transition flex items-center justify-center gap-3 mb-6"
        >
          <i className="fas fa-download"></i>
          Instalar Aplicativo
        </button>
      )}

      {/* Link discreto para continuar no navegador */}
      <button
        onClick={handleDismiss}
        className="text-white/40 text-xs hover:text-white/60 transition underline"
      >
        continuar no navegador
      </button>
    </div>
  );
}
