"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import Logo from './Logo';
import PWAInstallPrompt from './PWAInstallPrompt';
import { useUser } from '@/contexts/UserContext';
import { getFeriadosPeriodo, fetchFeriadosPersonalizados, type Feriado } from '@/lib/feriados';

interface AppShellProps {
  children: React.ReactNode;
}

interface PendingCounts {
  experimentais: number;
  reagendamentos: number;
  alteracoesHorario: number;
  aulas: number;
  creditosAtivos: number;
  totalAlunos: number;
  totalUsuarios: number;
  totalHorarios: number;
}

export default function AppShell({ children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [pendingCounts, setPendingCounts] = useState<PendingCounts>({ 
    experimentais: 0, 
    reagendamentos: 0, 
    alteracoesHorario: 0, 
    aulas: 0,
    creditosAtivos: 0,
    totalAlunos: 0,
    totalUsuarios: 0,
    totalHorarios: 0
  });
  const pathname = usePathname();
  const router = useRouter();
  const { user, displayName, mounted, logout } = useUser();

  // Buscar contagem de pendentes
  const fetchPendingCounts = useCallback(async () => {
    try {
      // Buscar aulas experimentais pendentes (status = 'agendada')
      let experimentaisPendentes = 0;
      try {
        const expRes = await fetch('/api/aulas-experimentais');
        if (expRes.ok) {
          const expData = await expRes.json();
          experimentaisPendentes = expData.success 
            ? expData.data.filter((a: any) => a.status === 'agendada' && a.ativo !== false).length 
            : 0;
        }
      } catch (e) {
        console.error('Erro ao buscar aulas experimentais:', e);
      }

      // Buscar reagendamentos pendentes
      let reagendamentosPendentes = 0;
      try {
        const reagRes = await fetch('/api/reagendamentos');
        if (reagRes.ok) {
          const reagData = await reagRes.json();
          reagendamentosPendentes = reagData.success 
            ? reagData.data.filter((r: any) => r.status === 'pendente').length 
            : 0;
        }
      } catch (e) {
        console.error('Erro ao buscar reagendamentos:', e);
      }

      // Buscar alterações de horário pendentes
      let alteracoesHorarioPendentes = 0;
      try {
        const altRes = await fetch('/api/alteracoes-horario?status=pendente');
        if (altRes.ok) {
          const altData = await altRes.json();
          alteracoesHorarioPendentes = altData.success 
            ? altData.pendentes || 0
            : 0;
        }
      } catch (e) {
        console.error('Erro ao buscar alterações de horário:', e);
      }

      // Buscar total de alunos com créditos disponíveis
      let creditosAtivos = 0;
      try {
        const credRes = await fetch('/api/creditos-reposicao?disponiveis=true');
        if (credRes.ok) {
          const credData = await credRes.json();
          if (Array.isArray(credData)) {
            // Contar quantos alunos únicos têm créditos (filtrando créditos com alunoId válido)
            const alunosComCreditos = new Set(
              credData
                .filter((c: any) => c.alunoId && c.alunoId._id && c.alunoId.nome)
                .map((c: any) => c.alunoId._id)
            );
            creditosAtivos = alunosComCreditos.size;
          }
        }
      } catch (e) {
        console.error('Erro ao buscar créditos:', e);
      }

      // Buscar total de alunos ativos
      let totalAlunos = 0;
      try {
        const alunosRes = await fetch('/api/alunos');
        if (alunosRes.ok) {
          const alunosData = await alunosRes.json();
          const alunosArray = Array.isArray(alunosData) ? alunosData : (alunosData.data || []);
          totalAlunos = alunosArray.filter((a: any) => a.ativo !== false).length;
        }
      } catch (e) {
        console.error('Erro ao buscar alunos:', e);
      }

      // Buscar total de usuários ativos
      let totalUsuarios = 0;
      try {
        const usuariosRes = await fetch('/api/usuarios');
        if (usuariosRes.ok) {
          const usuariosData = await usuariosRes.json();
          const usuariosArray = Array.isArray(usuariosData) ? usuariosData : (usuariosData.data || []);
          totalUsuarios = usuariosArray.filter((u: any) => u.ativo !== false).length;
        }
      } catch (e) {
        console.error('Erro ao buscar usuários:', e);
      }

      // Buscar aulas pendentes (horários passados sem registro)
      let aulasPendentes = 0;
      let totalHorarios = 0;
      try {
        const horariosRes = await fetch('/api/horarios');
        const aulasRes = await fetch('/api/aulas-realizadas?listarTodas=true');
        
        if (horariosRes.ok && aulasRes.ok) {
          const horariosData = await horariosRes.json();
          const aulasData = await aulasRes.json();
          
          // aulasData é um array direto quando usa listarTodas=true
          const aulasArray = Array.isArray(aulasData) ? aulasData : (aulasData.data || []);
          
          // Obter data de início da plataforma do localStorage (igual à página de aulas-realizadas)
          const dataInicioPlataforma = typeof window !== 'undefined' 
            ? localStorage.getItem('dataInicioPlataforma') || ''
            : '';
          
          if (horariosData.success && aulasArray) {
            // Contar total de horários ativos
            totalHorarios = horariosData.data.filter((h: any) => h.ativo !== false).length;
            
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);
            
            // Buscar feriados dos últimos 30 dias
            const dataInicio = new Date(hoje);
            dataInicio.setDate(dataInicio.getDate() - 30);
            const inicioStr = dataInicio.toISOString().split('T')[0];
            const fimStr = hoje.toISOString().split('T')[0];
            
            const feriadosNacionais = getFeriadosPeriodo(inicioStr, fimStr);
            const feriadosPersonalizados = await fetchFeriadosPersonalizados(inicioStr, fimStr);
            const todosFeriados = new Set([
              ...feriadosNacionais.map(f => f.data),
              ...feriadosPersonalizados.map(f => f.data)
            ]);
            
            // Criar set de aulas já registradas (horarioFixoId + data) - apenas enviadas ou corrigidas
            const aulasRegistradas = new Set(
              aulasArray
                .filter((a: any) => a.status === 'enviada' || a.status === 'corrigida')
                .map((a: any) => {
                  const horarioId = typeof a.horarioFixoId === 'string' ? a.horarioFixoId : a.horarioFixoId?._id;
                  const dataStr = a.data?.split('T')[0];
                  return `${horarioId}_${dataStr}`;
                })
            );
            
            // Verificar últimos 30 dias (igual à página de aulas-realizadas)
            for (let i = 1; i <= 30; i++) {
              const data = new Date(hoje);
              data.setDate(data.getDate() - i);
              const diaSemana = data.getDay();
              const dataStr = data.toISOString().split('T')[0];
              
              // Verificar se a data é anterior à data de início da plataforma
              if (dataInicioPlataforma && dataStr < dataInicioPlataforma) {
                continue; // Ignorar datas anteriores ao início da plataforma
              }
              
              // Ignorar feriados
              if (todosFeriados.has(dataStr)) {
                continue;
              }
              
              // Filtrar horários deste dia da semana
              const horariosNoDia = horariosData.data.filter((h: any) => 
                h.diaSemana === diaSemana && h.ativo !== false
              );
              
              // Contar horários sem registro
              horariosNoDia.forEach((h: any) => {
                const chave = `${h._id}_${dataStr}`;
                if (!aulasRegistradas.has(chave)) {
                  aulasPendentes++;
                }
              });
            }
          }
        }
      } catch (e) {
        console.error('Erro ao calcular aulas pendentes:', e);
      }

      setPendingCounts({
        experimentais: experimentaisPendentes,
        reagendamentos: reagendamentosPendentes,
        alteracoesHorario: alteracoesHorarioPendentes,
        aulas: aulasPendentes,
        creditosAtivos,
        totalAlunos,
        totalUsuarios,
        totalHorarios
      });
      console.log('[AppShell] Pending counts:', { experimentaisPendentes, reagendamentosPendentes, alteracoesHorarioPendentes, aulasPendentes, creditosAtivos });
    } catch (error) {
      console.error('Erro ao buscar contagens pendentes:', error);
    }
  }, []);

  // Buscar contagens ao montar e quando pathname mudar
  useEffect(() => {
    if (mounted && user) {
      console.log('[AppShell] Fetching pending counts...');
      fetchPendingCounts();
    }
  }, [mounted, user, pathname, fetchPendingCounts]);

  // Escutar evento customizado para atualizar contagens (disparado após ações)
  useEffect(() => {
    const handleRefreshCounts = () => {
      console.log('[AppShell] Refresh counts event received');
      fetchPendingCounts();
    };
    
    // Atualizar quando voltar para a aba/janela
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && mounted && user) {
        fetchPendingCounts();
      }
    };
    
    window.addEventListener('refreshPendingCounts', handleRefreshCounts);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('refreshPendingCounts', handleRefreshCounts);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [mounted, user, fetchPendingCounts]);

  const handleOpenMobile = () => {
    setMobileOpen(true);
    setIsOpening(true);
    setTimeout(() => setIsOpening(false), 50);
  };

  const handleCloseMobile = () => {
    setIsClosing(true);
    setTimeout(() => {
      setMobileOpen(false);
      setIsClosing(false);
    }, 400);
  };

  const handleLogout = () => {
    // Esconder conteúdo imediatamente para evitar flash
    setLoggingOut(true);
    // Redirecionar imediatamente ANTES de limpar o estado
    router.replace('/admin/login');
    // Limpar estado após iniciar navegação
    setTimeout(() => {
      logout();
    }, 100);
  };

  // Fechar menu mobile ao navegar
  useEffect(() => {
    if (mobileOpen) {
      handleCloseMobile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Memoizar lista de abas para evitar re-cálculo
  const userAbas = useMemo(() => user?.abas || [], [user?.abas]);
  
  // Função inline para checar acesso
  const hasAccess = (tab: string) => userAbas.includes(tab);

  // Estilos para esconder conteúdo até montar ou durante logout (evita piscar)
  const contentStyle = (mounted && !loggingOut) ? {} : { visibility: 'hidden' as const };

  // Se está fazendo logout, mostra uma tela em branco com fundo
  if (loggingOut) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-500 text-sm">Saindo...</div>
      </div>
    );
  }

  const sidebar = (
    <div className="flex flex-col h-full bg-white text-gray-700 border-r border-gray-200 animate-in fade-in slide-in-from-left-4 duration-300">
      <div className="px-3 py-2 border-b border-gray-200 animate-in fade-in duration-500 flex-shrink-0">
        <div className="flex items-center justify-center">
          <Logo size="sm" />
        </div>
      </div>

      <nav className="flex-1 px-2 py-2 overflow-y-auto sidebar-scroll" style={contentStyle}>
        {/* Seção Professor */}
        {(hasAccess('professor:minhaagenda') || hasAccess('professor:alunos') || hasAccess('professor:aulas')) && (
          <div className="mb-2 animate-in fade-in slide-in-from-left-2 duration-500">
            <div className="px-2 text-[10px] font-semibold uppercase text-gray-400 tracking-wide">Professor</div>
            <div className="mt-1 space-y-0.5">
              {hasAccess('professor:minhaagenda') && (
                <Link href="/professor/minhaagenda" className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm font-medium transition-all duration-200 hover:translate-x-1 ${pathname?.startsWith('/professor/minhaagenda') ? 'bg-primary-50 text-primary-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}><i className="fas fa-calendar-alt w-4 text-sm text-gray-400" aria-hidden="true" /> <span>Minha Agenda</span></Link>
              )}
              {hasAccess('professor:alunos') && (
                <Link href="/professor/alunos" className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm font-medium transition-all duration-200 hover:translate-x-1 ${pathname?.startsWith('/professor/alunos') ? 'bg-primary-50 text-primary-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}><i className="fas fa-user-graduate w-4 text-sm text-gray-400" aria-hidden="true" /> <span>Meus Alunos</span></Link>
              )}
              {hasAccess('professor:aulas') && (
                <Link href="/professor/aulas" className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm font-medium transition-all duration-200 hover:translate-x-1 ${pathname?.startsWith('/professor/aulas') ? 'bg-primary-50 text-primary-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}><i className="fas fa-clipboard-list w-4 text-sm text-gray-400" aria-hidden="true" /> <span>Minhas Aulas</span></Link>
              )}
            </div>
          </div>
        )}

        {/* Seção Agenda */}
        {(hasAccess('calendario') || hasAccess('horarios')) && (
          <div className="mb-2 animate-in fade-in slide-in-from-left-2 duration-500 delay-75">
            <div className="px-2 text-[10px] font-semibold uppercase text-gray-400 tracking-wide">Agenda</div>
            <div className="mt-1 space-y-0.5">
              {hasAccess('calendario') && (
                <Link href="/calendario" className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm font-medium transition-all duration-200 hover:translate-x-1 ${pathname?.startsWith('/calendario') ? 'bg-primary-50 text-primary-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}><i className="fas fa-calendar-alt w-4 text-sm text-gray-400" aria-hidden="true" /> <span>Calendário</span></Link>
              )}
              {hasAccess('horarios') && (
                <Link href="/horarios" className={`flex items-center justify-between px-2 py-1.5 rounded-md text-sm font-medium transition-all duration-200 hover:translate-x-1 ${pathname?.startsWith('/horarios') ? 'bg-primary-50 text-primary-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}>
                  <div className="flex items-center gap-2">
                    <i className="fas fa-clock w-4 text-sm text-gray-400" aria-hidden="true" />
                    <span>Horários</span>
                  </div>
                  {pendingCounts.totalHorarios > 0 && (
                    <span className="text-[10px] text-gray-400">
                      {pendingCounts.totalHorarios}
                    </span>
                  )}
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Seção Aulas */}
        {(hasAccess('aulas') || hasAccess('aulas-experimentais')) && (
          <div className="mb-2 animate-in fade-in slide-in-from-left-2 duration-500 delay-100">
            <div className="px-2 text-[10px] font-semibold uppercase text-gray-400 tracking-wide">Aulas</div>
            <div className="mt-1 space-y-0.5">
              {hasAccess('aulas') && (
                <Link href="/aulas-realizadas" className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm font-medium transition-all duration-200 hover:translate-x-1 ${pathname?.startsWith('/aulas-realizadas') ? 'bg-primary-50 text-primary-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}>
                  <i className="fas fa-clipboard-check w-4 text-sm text-gray-400" aria-hidden="true" />
                  <span className="relative">
                    Pendentes
                    {pendingCounts.aulas > 0 && (
                      <span className="absolute -top-2 -right-5 min-w-[16px] h-[16px] flex items-center justify-center bg-red-500 text-white text-[8px] font-bold rounded-full px-0.5">
                        {pendingCounts.aulas > 99 ? '99+' : pendingCounts.aulas}
                      </span>
                    )}
                  </span>
                </Link>
              )}
              {hasAccess('aulas-experimentais') && (
                <Link href="/aulas-experimentais" className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm font-medium transition-all duration-200 hover:translate-x-1 ${pathname?.startsWith('/aulas-experimentais') ? 'bg-primary-50 text-primary-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}>
                  <i className="fas fa-user-plus w-4 text-sm text-gray-400" aria-hidden="true" />
                  <span className="relative">
                    Experimentais
                    {pendingCounts.experimentais > 0 && (
                      <span className="absolute -top-2 -right-5 min-w-[16px] h-[16px] flex items-center justify-center bg-red-500 text-white text-[8px] font-bold rounded-full px-0.5">
                        {pendingCounts.experimentais > 99 ? '99+' : pendingCounts.experimentais}
                      </span>
                    )}
                  </span>
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Seção Cadastros */}
        {(hasAccess('alunos') || hasAccess('usuarios') || hasAccess('modalidades')) && (
          <div className="mb-2 animate-in fade-in slide-in-from-left-2 duration-500 delay-150">
            <div className="px-2 text-[10px] font-semibold uppercase text-gray-400 tracking-wide">Cadastros</div>
            <div className="mt-1 space-y-0.5">
              {hasAccess('alunos') && (
                <Link href="/alunos" className={`flex items-center justify-between px-2 py-1.5 rounded-md text-sm font-medium transition-all duration-200 hover:translate-x-1 ${pathname?.startsWith('/alunos') ? 'bg-primary-50 text-primary-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}>
                  <div className="flex items-center gap-2">
                    <i className="fas fa-user-graduate w-4 text-sm text-gray-400" aria-hidden="true" />
                    <span>Alunos</span>
                  </div>
                  {pendingCounts.totalAlunos > 0 && (
                    <span className="text-[10px] text-gray-400">
                      {pendingCounts.totalAlunos}
                    </span>
                  )}
                </Link>
              )}
              {hasAccess('usuarios') && (
                <Link href="/usuarios" className={`flex items-center justify-between px-2 py-1.5 rounded-md text-sm font-medium transition-all duration-200 hover:translate-x-1 ${pathname?.startsWith('/usuarios') ? 'bg-primary-50 text-primary-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}>
                  <div className="flex items-center gap-2">
                    <i className="fas fa-users-cog w-4 text-sm text-gray-400" aria-hidden="true" />
                    <span>Usuários</span>
                  </div>
                  {pendingCounts.totalUsuarios > 0 && (
                    <span className="text-[10px] text-gray-400">
                      {pendingCounts.totalUsuarios}
                    </span>
                  )}
                </Link>
              )}
              {hasAccess('modalidades') && (
                <Link href="/modalidades" className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm font-medium transition-all duration-200 hover:translate-x-1 ${pathname?.startsWith('/modalidades') ? 'bg-primary-50 text-primary-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}><i className="fas fa-layer-group w-4 text-sm text-gray-400" aria-hidden="true" /> <span>Modalidades</span></Link>
              )}
            </div>
          </div>
        )}

        {/* Seção Solicitações */}
        {(hasAccess('reagendamentos') || hasAccess('creditos') || hasAccess('reposicao-faltas') || hasAccess('creditos-reposicao')) && (
          <div className="mb-2 animate-in fade-in slide-in-from-left-2 duration-500 delay-200">
            <div className="px-2 text-[10px] font-semibold uppercase text-gray-400 tracking-wide">Solicitações</div>
            <div className="mt-1 space-y-0.5">
              {hasAccess('reagendamentos') && (
                <Link href="/reagendamentos" className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm font-medium transition-all duration-200 hover:translate-x-1 ${pathname?.startsWith('/reagendamentos') ? 'bg-primary-50 text-primary-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}>
                  <i className="fas fa-exchange-alt w-4 text-sm text-gray-400" aria-hidden="true" />
                  <span className="relative">
                    Reagendamentos
                    {pendingCounts.reagendamentos > 0 && (
                      <span className="absolute -top-2 -right-5 min-w-[16px] h-[16px] flex items-center justify-center bg-red-500 text-white text-[8px] font-bold rounded-full px-0.5">
                        {pendingCounts.reagendamentos > 99 ? '99+' : pendingCounts.reagendamentos}
                      </span>
                    )}
                  </span>
                </Link>
              )}
              {hasAccess('reagendamentos') && (
                <Link href="/alteracoes-horario" className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm font-medium transition-all duration-200 hover:translate-x-1 ${pathname?.startsWith('/alteracoes-horario') ? 'bg-primary-50 text-primary-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}>
                  <i className="fas fa-clock w-4 text-sm text-gray-400" aria-hidden="true" />
                  <span className="relative">
                    Alterações Horário
                    {pendingCounts.alteracoesHorario > 0 && (
                      <span className="absolute -top-2 -right-5 min-w-[16px] h-[16px] flex items-center justify-center bg-red-500 text-white text-[8px] font-bold rounded-full px-0.5">
                        {pendingCounts.alteracoesHorario > 99 ? '99+' : pendingCounts.alteracoesHorario}
                      </span>
                    )}
                  </span>
                </Link>
              )}
              {(hasAccess('creditos') || hasAccess('creditos-reposicao')) && (
                <Link href="/creditos-reposicao" className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm font-medium transition-all duration-200 hover:translate-x-1 ${pathname?.startsWith('/creditos-reposicao') ? 'bg-primary-50 text-primary-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}>
                  <i className="fas fa-ticket w-4 text-sm text-gray-400" aria-hidden="true" />
                  <span>Créditos</span>
                </Link>
              )}
              {(hasAccess('reposicao-faltas') || hasAccess('creditos-reposicao')) && (
                <Link href="/reposicao-faltas" className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm font-medium transition-all duration-200 hover:translate-x-1 ${pathname?.startsWith('/reposicao-faltas') ? 'bg-primary-50 text-primary-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}>
                  <i className="fas fa-history w-4 text-sm text-gray-400" aria-hidden="true" />
                  <span>Reposição</span>
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Seção Comunicação */}
        {hasAccess('avisos') && (
          <div className="mb-2 animate-in fade-in slide-in-from-left-2 duration-500 delay-225">
            <div className="px-2 text-[10px] font-semibold uppercase text-gray-400 tracking-wide">Comunicação</div>
            <div className="mt-1 space-y-0.5">
              <Link href="/avisos" className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm font-medium transition-all duration-200 hover:translate-x-1 ${pathname?.startsWith('/avisos') ? 'bg-primary-50 text-primary-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}>
                <i className="fas fa-bullhorn w-4 text-sm text-gray-400" aria-hidden="true" />
                <span>Avisos</span>
              </Link>
            </div>
          </div>
        )}

        {/* Seção Sistema */}
        {(hasAccess('relatorios') || hasAccess('backup') || hasAccess('diagnostico') || hasAccess('configuracoes')) && (
          <div className="mb-2 animate-in fade-in slide-in-from-left-2 duration-500 delay-250">
            <div className="px-2 text-[10px] font-semibold uppercase text-gray-400 tracking-wide">Sistema</div>
            <div className="mt-1 space-y-0.5">
              {hasAccess('relatorios') && (
                <Link href="/relatorios" className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm font-medium transition-all duration-200 hover:translate-x-1 ${pathname?.startsWith('/relatorios') ? 'bg-primary-50 text-primary-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}><i className="fas fa-chart-line w-4 text-sm text-gray-400" aria-hidden="true" /> <span>Relatórios</span></Link>
              )}
              {hasAccess('backup') && (
                <Link href="/backup" className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm font-medium transition-all duration-200 hover:translate-x-1 ${pathname?.startsWith('/backup') ? 'bg-primary-50 text-primary-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}><i className="fas fa-database w-4 text-sm text-gray-400" aria-hidden="true" /> <span>Backups</span></Link>
              )}
              {hasAccess('diagnostico') && (
                <Link href="/diagnostico" className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm font-medium transition-all duration-200 hover:translate-x-1 ${pathname?.startsWith('/diagnostico') ? 'bg-primary-50 text-primary-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}><i className="fas fa-stethoscope w-4 text-sm text-gray-400" aria-hidden="true" /> <span>Diagnóstico</span></Link>
              )}
              {hasAccess('configuracoes') && (
                <Link href="/configuracoes" className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm font-medium transition-all duration-200 hover:translate-x-1 ${pathname?.startsWith('/configuracoes') ? 'bg-primary-50 text-primary-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}><i className="fas fa-cog w-4 text-sm text-gray-400" aria-hidden="true" /> <span>Configurações</span></Link>
              )}
            </div>
          </div>
        )}
      </nav>

      <div className="px-2 py-2 border-t bg-gray-50 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-300 flex-shrink-0" style={contentStyle}>
        <div className="flex items-center gap-2 mb-2 px-1">
          {user?.tipo === 'root' ? (
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 text-sm shadow-sm border border-amber-300 transition-transform duration-200 hover:scale-110">
              <i className="fas fa-shield" aria-hidden="true" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white font-bold text-sm shadow-sm transition-transform duration-200 hover:scale-110">
              {(displayName || 'U').charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-gray-900 truncate">{displayName || 'Usuário'}</div>
            <div className="text-[10px] text-gray-500">{user?.tipo === 'professor' ? 'Professor' : user?.tipo === 'root' ? 'Root' : 'Admin'}</div>
          </div>
        </div>
        <button onClick={handleLogout} className="w-full bg-white hover:bg-gray-100 text-gray-700 px-2 py-1.5 rounded-md text-xs font-medium transition-all duration-200 border border-gray-300 inline-flex items-center justify-center gap-1.5 hover:shadow-md hover:scale-[1.02]">
          <i className="fas fa-sign-out-alt text-xs" aria-hidden="true" />
          <span>Sair</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile top bar */}
      <div className="md:hidden bg-white border-b border-gray-200 fixed top-0 left-0 right-0 z-30">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center">
              <button onClick={handleOpenMobile} className="p-2 text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
              <div className="ml-3">
                <Logo size="sm" />
              </div>
            </div>
            <button onClick={handleLogout} className="bg-white hover:bg-gray-100 text-gray-700 px-3 py-1 rounded-md text-sm font-medium border border-gray-300 inline-flex items-center gap-1" style={contentStyle}>
              <i className="fas fa-sign-out-alt" aria-hidden="true" />
              Sair
            </button>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Botão toggle sidebar desktop */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className={`hidden md:flex fixed top-3 z-30 p-2 bg-white border border-gray-200 rounded-md shadow-sm hover:bg-gray-50 text-gray-600 transition-all duration-300 ${sidebarCollapsed ? 'left-3' : 'left-[232px]'}`}
          title={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          <svg className={`w-5 h-5 transition-transform duration-300 ${sidebarCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>

        {/* Sidebar fixa para desktop */}
        <aside className={`hidden md:fixed md:inset-y-0 md:flex md:flex-col z-20 transition-all duration-300 overflow-hidden ${sidebarCollapsed ? 'md:w-0 md:opacity-0' : 'md:w-56 md:opacity-100'}`}>
          <div className="w-56 h-full flex-shrink-0">
            {sidebar}
          </div>
        </aside>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div 
              className={`absolute inset-0 bg-black transition-opacity duration-300 ease-in-out ${isOpening ? 'opacity-0' : isClosing ? 'opacity-0' : 'opacity-50'}`}
              onClick={handleCloseMobile} 
            />
            <div className={`absolute inset-y-0 left-0 w-72 bg-white shadow-lg transform transition-transform duration-400 ease-out ${isOpening ? '-translate-x-full' : isClosing ? '-translate-x-full' : 'translate-x-0'}`}>
              <div className="h-full">{sidebar}</div>
            </div>
          </div>
        )}

        {/* Área de conteúdo principal */}
        <div className={`flex-1 pt-14 md:pt-0 transition-all duration-300 ${sidebarCollapsed ? 'md:ml-0' : 'md:ml-56'}`}>
          {children}
        </div>

        <PWAInstallPrompt />
      </div>
    </div>
  );
}
