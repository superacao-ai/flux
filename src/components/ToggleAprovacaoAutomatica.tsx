'use client';

import { useState, useEffect } from 'react';

interface ToggleAprovacaoAutomaticaProps {
  chave: string;
  label?: string;
}

export default function ToggleAprovacaoAutomatica({ chave, label = 'Aprovação Automática' }: ToggleAprovacaoAutomaticaProps) {
  const [ativo, setAtivo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, [chave]);

  const fetchConfig = async () => {
    try {
      const res = await fetch(`/api/configuracoes?chave=${chave}`);
      const data = await res.json();
      if (data.success) {
        setAtivo(data.data?.valor || false);
      }
    } catch (error) {
      console.error('Erro ao buscar configuração:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleConfig = async () => {
    setSaving(true);
    try {
      const novoValor = !ativo;
      const res = await fetch('/api/configuracoes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chave, valor: novoValor })
      });
      const data = await res.json();
      if (data.success) {
        setAtivo(novoValor);
      }
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-3 bg-gray-50 rounded-lg px-4 py-3 animate-pulse">
        <div className="w-12 h-6 bg-gray-200 rounded-full"></div>
        <div className="h-4 w-32 bg-gray-200 rounded"></div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 bg-gray-50 rounded-lg px-4 py-3">
      <button
        onClick={toggleConfig}
        disabled={saving}
        className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
          ativo ? 'bg-green-500' : 'bg-gray-300'
        } ${saving ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
            ativo ? 'translate-x-6' : 'translate-x-0.5'
          }`}
        />
      </button>
      <div className="flex flex-col">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-xs text-gray-500">
          {ativo ? (
            <span className="text-green-600">
              <i className="fas fa-check-circle mr-1"></i>
              Requisições são aprovadas automaticamente
            </span>
          ) : (
            <span className="text-gray-500">
              <i className="fas fa-clock mr-1"></i>
              Requisições aguardam aprovação manual
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
