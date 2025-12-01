'use client';

import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    // Check if it's iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (isStandalone) {
      return; // Already installed, don't show prompt
    }

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallButton(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // For iOS, show instructions after a delay if not installed
    if (isIOSDevice && !isStandalone) {
      const dismissed = localStorage.getItem('pwa-ios-dismissed');
      if (!dismissed) {
        setTimeout(() => setShowIOSInstructions(true), 3000);
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setShowInstallButton(false);
    }
    setDeferredPrompt(null);
  };

  const dismissIOSInstructions = () => {
    setShowIOSInstructions(false);
    localStorage.setItem('pwa-ios-dismissed', 'true');
  };

  // Android/Desktop install button
  if (showInstallButton && !isIOS) {
    return (
      <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-50 animate-slide-up">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
            <i className="fas fa-mobile-alt text-green-600 text-xl"></i>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">Instalar App</h3>
            <p className="text-sm text-gray-600 mt-1">
              Instale o Superação Flux para acesso rápido na tela inicial
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleInstallClick}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 transition-colors"
              >
                Instalar
              </button>
              <button
                onClick={() => setShowInstallButton(false)}
                className="px-4 py-2 text-gray-600 text-sm hover:text-gray-800"
              >
                Depois
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // iOS instructions
  if (showIOSInstructions && isIOS) {
    return (
      <div className="fixed bottom-20 left-4 right-4 bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-50 animate-slide-up">
        <button 
          onClick={dismissIOSInstructions}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
        >
          <i className="fas fa-times"></i>
        </button>
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
            <i className="fab fa-apple text-blue-600 text-xl"></i>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">Instalar no iPhone</h3>
            <p className="text-sm text-gray-600 mt-1">
              Para instalar o app:
            </p>
            <ol className="text-sm text-gray-600 mt-2 space-y-1">
              <li>1. Toque em <i className="fas fa-share-square text-blue-500"></i> (Compartilhar)</li>
              <li>2. Role e toque em <strong>&quot;Adicionar à Tela de Início&quot;</strong></li>
              <li>3. Toque em <strong>&quot;Adicionar&quot;</strong></li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
