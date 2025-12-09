'use client';

import { useState, useEffect } from 'react';
import ProtectedPage from '@/components/ProtectedPage';

interface DiagnosticoItem {
  nome: string;
  total: number;
  ok: number;
  problemas: number;
  detalhes: string[];
  status: 'ok' | 'warning' | 'error';
}

interface DiagnosticoData {
  alunos: DiagnosticoItem;
  horarios: DiagnosticoItem;
  creditos: DiagnosticoItem;
  usos: DiagnosticoItem;
  reagendamentos: DiagnosticoItem;
  aulasRealizadas: DiagnosticoItem;
  usuarios: DiagnosticoItem;
  modalidades: DiagnosticoItem;
}

export default function DiagnosticoPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DiagnosticoData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDiagnostico = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch('/api/diagnostico');
      if (!res.ok) throw new Error('Erro ao buscar diagnóstico');
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagnostico();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ok': return 'bg-green-100 text-green-800 border-green-200';
      case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'error': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ok': return 'fa-check-circle text-green-500';
      case 'warning': return 'fa-exclamation-triangle text-yellow-500';
      case 'error': return 'fa-times-circle text-red-500';
      default: return 'fa-question-circle text-gray-500';
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'ok': return 'bg-green-50 border-green-200';
      case 'warning': return 'bg-yellow-50 border-yellow-200';
      case 'error': return 'bg-red-50 border-red-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  if (loading) {
    return (
      <ProtectedPage tab="diagnostico" title="Diagnóstico do Sistema" fullWidth>
        <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center py-20">
            <i className="fas fa-spinner fa-spin text-4xl text-blue-500"></i>
            <span className="ml-3 text-gray-600">Analisando integridade dos dados...</span>
          </div>
        </div>
      </ProtectedPage>
    );
  }

  if (error) {
    return (
      <ProtectedPage tab="diagnostico" title="Diagnóstico do Sistema" fullWidth>
        <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <i className="fas fa-exclamation-triangle text-4xl text-red-500 mb-3"></i>
            <p className="text-red-700">{error}</p>
            <button 
              onClick={fetchDiagnostico}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      </ProtectedPage>
    );
  }

  const items = data ? Object.entries(data) : [];
  const totalProblemas = items.reduce((sum, [, item]) => sum + item.problemas, 0);
  const statusGeral = totalProblemas === 0 ? 'ok' : totalProblemas < 5 ? 'warning' : 'error';

  return (
    <ProtectedPage tab="diagnostico" title="Diagnóstico do Sistema" fullWidth>
      <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <i className="fas fa-stethoscope text-blue-600"></i>
              Diagnóstico do Sistema
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Verificação de integridade dos dados
            </p>
          </div>
          <button 
            onClick={fetchDiagnostico}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <i className="fas fa-sync-alt"></i>
            Atualizar
          </button>
        </div>

        {/* Status Geral */}
        <div className={`mb-6 p-4 rounded-lg border ${getStatusBg(statusGeral)}`}>
          <div className="flex items-center gap-3">
            <i className={`fas ${getStatusIcon(statusGeral)} text-2xl`}></i>
            <div>
              <p className="font-semibold text-gray-900">
                {statusGeral === 'ok' && 'Sistema íntegro'}
                {statusGeral === 'warning' && 'Atenção necessária'}
                {statusGeral === 'error' && 'Problemas detectados'}
              </p>
              <p className="text-sm text-gray-600">
                {totalProblemas === 0 
                  ? 'Todos os dados estão consistentes' 
                  : `${totalProblemas} problema${totalProblemas > 1 ? 's' : ''} encontrado${totalProblemas > 1 ? 's' : ''}`
                }
              </p>
            </div>
          </div>
        </div>

        {/* Grid de Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {items.map(([key, item]) => (
            <div 
              key={key} 
              className={`p-4 rounded-lg border ${getStatusBg(item.status)}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-gray-900 capitalize">{item.nome}</span>
                <i className={`fas ${getStatusIcon(item.status)}`}></i>
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">{item.total}</div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-green-600">
                  <i className="fas fa-check mr-1"></i>{item.ok} OK
                </span>
                {item.problemas > 0 && (
                  <span className="text-red-600">
                    <i className="fas fa-times mr-1"></i>{item.problemas} problemas
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Detalhes dos problemas */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <i className="fas fa-list-ul text-gray-500"></i>
              Detalhes da Análise
            </h2>
          </div>
          <div className="divide-y divide-gray-100">
            {items.map(([key, item]) => (
              <div key={key} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <i className={`fas ${getStatusIcon(item.status)}`}></i>
                    <span className="font-medium text-gray-900 capitalize">{item.nome}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                      {item.status === 'ok' ? 'OK' : item.status === 'warning' ? 'Atenção' : 'Erro'}
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">
                    {item.ok}/{item.total} registros OK
                  </span>
                </div>
                
                {item.detalhes.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {item.detalhes.slice(0, 5).map((detalhe: string, i: number) => (
                      <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                        <i className="fas fa-chevron-right text-xs text-gray-400 mt-1"></i>
                        {detalhe}
                      </li>
                    ))}
                    {item.detalhes.length > 5 && (
                      <li className="text-sm text-gray-400 italic">
                        ... e mais {item.detalhes.length - 5} itens
                      </li>
                    )}
                  </ul>
                ) : (
                  <p className="text-sm text-green-600 mt-1">
                    <i className="fas fa-check mr-1"></i>
                    Nenhum problema encontrado
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Legenda */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Legenda</h3>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <i className="fas fa-check-circle text-green-500"></i>
              <span className="text-gray-600">OK - Dados íntegros</span>
            </div>
            <div className="flex items-center gap-2">
              <i className="fas fa-exclamation-triangle text-yellow-500"></i>
              <span className="text-gray-600">Atenção - Pequenos problemas</span>
            </div>
            <div className="flex items-center gap-2">
              <i className="fas fa-times-circle text-red-500"></i>
              <span className="text-gray-600">Erro - Requer correção</span>
            </div>
          </div>
        </div>
      </div>
    </ProtectedPage>
  );
}
