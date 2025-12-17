'use client';

import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { toast } from 'react-toastify';
import ProtectedPage from '@/components/ProtectedPage';

interface BackupMetadata {
  version: string;
  exportedAt: string;
  collections: string[];
  counts: Record<string, number>;
  totalRecords: number;
}

interface BackupData {
  metadata: BackupMetadata;
  data: Record<string, any[]>;
}

export default function BackupPage() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [selectedCollections, setSelectedCollections] = useState<string[]>(['all']);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [stats, setStats] = useState<Record<string, number> | null>(null);

  const collections = [
    { id: 'all', label: 'Todos os dados', icon: 'fa-database' },
    { id: 'alunos', label: 'Alunos', icon: 'fa-users' },
    { id: 'professores', label: 'Professores', icon: 'fa-chalkboard-teacher' },
    { id: 'modalidades', label: 'Modalidades', icon: 'fa-layer-group' },
    { id: 'horarios', label: 'Horários Fixos', icon: 'fa-calendar-alt' },
    { id: 'matriculas', label: 'Matrículas', icon: 'fa-id-card' },
    { id: 'aulasRealizadas', label: 'Aulas Realizadas', icon: 'fa-check-circle' },
    { id: 'reagendamentos', label: 'Reagendamentos', icon: 'fa-exchange-alt' },
    { id: 'creditos', label: 'Créditos Reposição', icon: 'fa-ticket' },
    { id: 'usosCredito', label: 'Usos de Crédito', icon: 'fa-receipt' },
    { id: 'faltas', label: 'Faltas', icon: 'fa-user-times' },
    { id: 'avisosAusencia', label: 'Avisos Ausência', icon: 'fa-bell-slash' },
    { id: 'alteracoesHorario', label: 'Alterações Horário', icon: 'fa-clock' },
    { id: 'feriados', label: 'Feriados', icon: 'fa-calendar-times' },
    { id: 'blockedSlots', label: 'Slots Bloqueados', icon: 'fa-ban' },
    { id: 'avisos', label: 'Avisos Sistema', icon: 'fa-bullhorn' },
    { id: 'presencas', label: 'Presenças', icon: 'fa-clipboard-check' },
    { id: 'usuarios', label: 'Usuários', icon: 'fa-user-shield' },
  ];

  // Marcar como montado imediatamente
  useEffect(() => {
    setMounted(true);
  }, []);

  // Carregar dados iniciais
  useEffect(() => {
    // Carregar data do último backup do localStorage
    const saved = localStorage.getItem('lastBackupDate');
    if (saved) setLastBackup(saved);

    // Carregar estatísticas do banco
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const response = await fetch('/api/backup?collections=all');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.metadata?.counts) {
          setStats(data.metadata.counts);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    } finally {
      setInitialLoading(false);
    }
  };

  const handleCollectionToggle = (id: string) => {
    if (id === 'all') {
      setSelectedCollections(['all']);
    } else {
      setSelectedCollections(prev => {
        const newSelection = prev.filter(c => c !== 'all');
        if (newSelection.includes(id)) {
          return newSelection.filter(c => c !== id);
        } else {
          return [...newSelection, id];
        }
      });
    }
  };

  const handleExport = async () => {
    try {
      setLoading(true);
      
      const collectionsParam = selectedCollections.join(',');
      const response = await fetch(`/api/backup?collections=${collectionsParam}`);
      
      if (!response.ok) {
        throw new Error('Erro ao exportar backup');
      }

      const data: { success: boolean; metadata: BackupMetadata; data: Record<string, any[]> } = await response.json();
      
      if (!data.success) {
        throw new Error('Falha ao gerar backup');
      }

      // Criar arquivo JSON para download
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
      a.href = url;
      a.download = `backup-superacao-${dateStr}_${timeStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Salvar data do backup
      const backupDate = new Date().toISOString();
      localStorage.setItem('lastBackupDate', backupDate);
      setLastBackup(backupDate);

      toast.success(`Backup exportado com sucesso! ${data.metadata.totalRecords} registros`);
    } catch (error) {
      console.error('Erro ao exportar:', error);
      toast.error('Erro ao exportar backup');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Confirmar antes de importar
    const result = await Swal.fire({
      title: 'Confirmar Importação',
      html: `
        <p>Você está prestes a importar o arquivo:</p>
        <p><strong>${file.name}</strong></p>
        <p class="mt-4">Modo: <strong>${importMode === 'merge' ? 'Mesclar (atualiza existentes)' : 'Substituir (apaga tudo)'}</strong></p>
        ${importMode === 'replace' ? '<p class="text-red-600 mt-2">⚠️ ATENÇÃO: Isso apagará todos os dados atuais!</p>' : ''}
      `,
      icon: importMode === 'replace' ? 'warning' : 'question',
      showCancelButton: true,
      confirmButtonColor: importMode === 'replace' ? '#d33' : '#3085d6',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sim, importar',
      cancelButtonText: 'Cancelar',
    });

    if (!result.isConfirmed) {
      event.target.value = '';
      return;
    }

    try {
      setLoading(true);

      const text = await file.text();
      const backupData: BackupData = JSON.parse(text);

      if (!backupData.data) {
        throw new Error('Arquivo de backup inválido');
      }

      const response = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: backupData.data,
          options: { mode: importMode },
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(result.message);
        loadStats(); // Recarregar estatísticas
      } else {
        throw new Error(result.error || 'Erro ao importar');
      }
    } catch (error: any) {
      console.error('Erro ao importar:', error);
      toast.error('Erro ao importar backup: ' + (error.message || 'Arquivo inválido'));
    } finally {
      setLoading(false);
      event.target.value = '';
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Skeleton loading enquanto não está montado ou carregando dados iniciais
  if (!mounted || initialLoading) {
    return (
      <ProtectedPage tab="backup" title="Backup - Superação Flux" fullWidth customLoading>
        <div className="w-full px-4 py-6 sm:px-6 lg:px-8 max-w-5xl mx-auto">
          {/* Header skeleton - Desktop */}
          <div className="hidden md:block mb-6">
            <div className="h-6 bg-gray-200 rounded w-52 mb-2 animate-pulse" />
            <div className="h-4 bg-gray-200 rounded w-96 mb-1 animate-pulse" />
            <div className="h-3 bg-gray-200 rounded w-48 animate-pulse" />
          </div>
          
          {/* Header skeleton - Mobile */}
          <div className="md:hidden mb-4">
            <div className="h-5 bg-gray-200 rounded w-20 mb-1 animate-pulse" />
            <div className="h-3 bg-gray-200 rounded w-32 animate-pulse" />
          </div>

          {/* Cards skeleton - Desktop */}
          <div className="hidden md:grid grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse" />
                  <div>
                    <div className="h-5 bg-gray-200 rounded w-36 mb-1 animate-pulse" />
                    <div className="h-3 bg-gray-200 rounded w-48 animate-pulse" />
                  </div>
                </div>
                <div className="space-y-2 mb-4">
                  {[1, 2, 3, 4].map((j) => (
                    <div key={j} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
                  ))}
                </div>
                <div className="h-12 bg-gray-200 rounded-lg animate-pulse" />
              </div>
            ))}
          </div>
          
          {/* Cards skeleton - Mobile */}
          <div className="md:hidden space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-full bg-gray-200 animate-pulse" />
                  <div>
                    <div className="h-4 bg-gray-200 rounded w-24 mb-1 animate-pulse" />
                    <div className="h-3 bg-gray-200 rounded w-32 animate-pulse" />
                  </div>
                </div>
                <div className="space-y-2 mb-3">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="h-9 bg-gray-100 rounded-lg animate-pulse" />
                  ))}
                </div>
                <div className="h-10 bg-gray-200 rounded-lg animate-pulse" />
              </div>
            ))}
          </div>

          {/* Stats skeleton - Desktop */}
          <div className="hidden md:block mt-8 bg-white rounded-xl border border-gray-200 p-6">
            <div className="h-6 bg-gray-200 rounded w-48 mb-4 animate-pulse" />
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="h-8 w-8 mx-auto bg-gray-200 rounded mb-2 animate-pulse" />
                  <div className="h-8 bg-gray-200 rounded w-12 mx-auto mb-1 animate-pulse" />
                  <div className="h-3 bg-gray-200 rounded w-16 mx-auto animate-pulse" />
                </div>
              ))}
            </div>
          </div>
          
          {/* Stats skeleton - Mobile */}
          <div className="md:hidden mt-4 bg-white rounded-xl border border-gray-200 p-4">
            <div className="h-5 bg-gray-200 rounded w-36 mb-3 animate-pulse" />
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="h-6 w-6 mx-auto bg-gray-200 rounded mb-1 animate-pulse" />
                  <div className="h-6 bg-gray-200 rounded w-10 mx-auto mb-1 animate-pulse" />
                  <div className="h-2.5 bg-gray-200 rounded w-14 mx-auto animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </ProtectedPage>
    );
  }

  return (
    <ProtectedPage tab="backup" title="Backup - Superação Flux" fullWidth>
      <div className="px-4 py-6 sm:px-0 max-w-5xl mx-auto">
        {/* Header Desktop */}
        <div className="hidden md:block mb-6 fade-in-1">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <i className="fas fa-database text-green-600"></i>
            Backup e Restauração
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Exporte seus dados para backup ou restaure a partir de um arquivo anterior
          </p>
          {lastBackup && (
            <p className="mt-1 text-sm text-gray-500">
              <i className="fas fa-clock mr-1" />
              Último backup: {formatDate(lastBackup)}
            </p>
          )}
        </div>

        {/* Header Mobile */}
        <div className="md:hidden mb-4 fade-in-1">
          <h1 className="text-lg font-semibold text-gray-900">Backup</h1>
          {lastBackup && (
            <p className="text-xs text-gray-500 mt-0.5">
              <i className="fas fa-clock mr-1" />
              {formatDate(lastBackup)}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          {/* Card de Exportação */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6 fade-in-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <i className="fas fa-download text-green-600 text-sm md:text-base" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base md:text-lg font-semibold text-gray-900">Exportar</h2>
                <p className="text-xs md:text-sm text-gray-500 truncate">Baixe seus dados em JSON</p>
              </div>
            </div>

            {/* Seleção de coleções */}
            <div className="mb-4">
              <label className="block text-xs md:text-sm font-medium text-gray-700 mb-2">
                Dados para exportar:
              </label>
              <div className="space-y-1.5 md:space-y-2 max-h-48 md:max-h-64 overflow-y-auto">
                {collections.map((col) => (
                  <label
                    key={col.id}
                    className={`flex items-center gap-2 md:gap-3 p-1.5 md:p-2 rounded-lg cursor-pointer transition-colors ${
                      selectedCollections.includes(col.id)
                        ? 'bg-primary-50 border border-primary-200'
                        : 'hover:bg-gray-50 border border-transparent'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedCollections.includes(col.id) || (col.id !== 'all' && selectedCollections.includes('all'))}
                      onChange={() => handleCollectionToggle(col.id)}
                      disabled={col.id !== 'all' && selectedCollections.includes('all')}
                      className="w-3.5 h-3.5 md:w-4 md:h-4 text-primary-600 rounded"
                    />
                    <i className={`fas ${col.icon} w-4 md:w-5 text-gray-400 text-xs md:text-sm`} />
                    <span className="text-xs md:text-sm text-gray-700 flex-1 truncate">{col.label}</span>
                    {stats && col.id !== 'all' && stats[col.id] !== undefined && (
                      <span className="text-[10px] md:text-xs text-gray-400 flex-shrink-0">
                        {stats[col.id]}
                      </span>
                    )}
                    {stats && col.id === 'all' && (
                      <span className="text-[10px] md:text-xs text-gray-400 flex-shrink-0">
                        {Object.values(stats).reduce((a, b) => a + b, 0)}
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </div>

            <button
              onClick={handleExport}
              disabled={loading || selectedCollections.length === 0}
              className="w-full bg-green-600 text-white py-2.5 md:py-3 px-4 rounded-lg text-sm md:text-base font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <i className="fas fa-spinner fa-spin" />
                  Exportando...
                </>
              ) : (
                <>
                  <i className="fas fa-download" />
                  Exportar Backup
                </>
              )}
            </button>
          </div>

          {/* Card de Importação */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6 fade-in-3">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <i className="fas fa-upload text-blue-600 text-sm md:text-base" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base md:text-lg font-semibold text-gray-900">Restaurar</h2>
                <p className="text-xs md:text-sm text-gray-500 truncate">Importe de um arquivo JSON</p>
              </div>
            </div>

            {/* Modo de importação */}
            <div className="mb-4">
              <label className="block text-xs md:text-sm font-medium text-gray-700 mb-2">
                Modo:
              </label>
              <div className="space-y-1.5 md:space-y-2">
                <label
                  className={`flex items-center gap-2 md:gap-3 p-2 md:p-3 rounded-lg cursor-pointer transition-colors border ${
                    importMode === 'merge'
                      ? 'bg-blue-50 border-blue-200'
                      : 'hover:bg-gray-50 border-gray-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="importMode"
                    value="merge"
                    checked={importMode === 'merge'}
                    onChange={() => setImportMode('merge')}
                    className="w-3.5 h-3.5 md:w-4 md:h-4 text-blue-600"
                  />
                  <div className="min-w-0">
                    <div className="text-xs md:text-sm font-medium text-gray-700">Mesclar</div>
                    <div className="text-[10px] md:text-xs text-gray-500 truncate">
                      Atualiza existentes + adiciona novos
                    </div>
                  </div>
                </label>
                <label
                  className={`flex items-center gap-2 md:gap-3 p-2 md:p-3 rounded-lg cursor-pointer transition-colors border ${
                    importMode === 'replace'
                      ? 'bg-red-50 border-red-200'
                      : 'hover:bg-gray-50 border-gray-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="importMode"
                    value="replace"
                    checked={importMode === 'replace'}
                    onChange={() => setImportMode('replace')}
                    className="w-3.5 h-3.5 md:w-4 md:h-4 text-red-600"
                  />
                  <div className="min-w-0">
                    <div className="text-xs md:text-sm font-medium text-gray-700">Substituir</div>
                    <div className="text-[10px] md:text-xs text-red-500 truncate">
                      ⚠️ Apaga tudo antes de importar
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <label
              className={`w-full border-2 border-dashed rounded-lg py-6 md:py-8 px-4 flex flex-col items-center justify-center cursor-pointer transition-colors ${
                loading
                  ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
                  : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
              }`}
            >
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                disabled={loading}
                className="hidden"
              />
              {loading ? (
                <div className="space-y-2 w-full">
                  {[1, 2].map(i => (
                    <div key={i} className="h-6 bg-gray-200 rounded animate-pulse"></div>
                  ))}
                  <span className="text-xs text-gray-500 block text-center mt-2">Importando...</span>
                </div>
              ) : (
                <>
                  <i className="fas fa-file-upload text-2xl md:text-3xl text-gray-400 mb-2" />
                  <span className="text-xs md:text-sm text-gray-600 font-medium text-center">
                    Clique para selecionar
                  </span>
                  <span className="text-[10px] md:text-xs text-gray-400 mt-1">
                    Apenas .json
                  </span>
                </>
              )}
            </label>
          </div>
        </div>

        {/* Estatísticas do banco */}
        {stats && (
          <div className="mt-6 md:mt-8 bg-white rounded-xl border border-gray-200 p-4 md:p-6 fade-in-4">
            <h3 className="text-sm md:text-lg font-semibold text-gray-900 mb-3 md:mb-4 flex items-center gap-2">
              <i className="fas fa-chart-bar text-primary-600 text-xs md:text-base" />
              Estatísticas
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 md:gap-4">
              {Object.entries(stats).map(([key, count]) => {
                const col = collections.find((c) => c.id === key);
                return (
                  <div
                    key={key}
                    className="bg-gray-50 rounded-lg p-2 md:p-4 text-center"
                  >
                    <i
                      className={`fas ${col?.icon || 'fa-database'} text-lg md:text-2xl text-gray-400 mb-1 md:mb-2`}
                    />
                    <div className="text-lg md:text-2xl font-bold text-gray-900">{count}</div>
                    <div className="text-[10px] md:text-xs text-gray-500 capitalize truncate">
                      {col?.label || key}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Dicas - apenas desktop */}
        <div className="hidden md:block mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4 fade-in-5">
          <h4 className="font-medium text-amber-800 flex items-center gap-2 mb-2">
            <i className="fas fa-lightbulb" />
            Dicas de Backup
          </h4>
          <ul className="text-sm text-amber-700 space-y-1">
            <li>• Faça backups regularmente (recomendado: semanalmente)</li>
            <li>• Guarde os arquivos em local seguro (Google Drive, OneDrive, etc.)</li>
            <li>• Use &quot;Mesclar&quot; para atualizar dados sem perder informações</li>
            <li>• Use &quot;Substituir&quot; apenas para restaurar completamente o sistema</li>
          </ul>
        </div>

        {/* Dicas - mobile compactas */}
        <div className="md:hidden mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 fade-in-5">
          <p className="text-xs text-amber-700">
            <i className="fas fa-lightbulb text-amber-600 mr-1"></i>
            Faça backups semanais e guarde em local seguro
          </p>
        </div>
      </div>
    </ProtectedPage>
  );
}
