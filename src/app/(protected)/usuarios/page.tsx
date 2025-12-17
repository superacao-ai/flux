'use client';

import Swal from 'sweetalert2';
import { toast } from 'react-toastify';
import { useState, useEffect, useCallback, useMemo } from 'react';
import ProtectedPage from '@/components/ProtectedPage';

// Interface para permissões granulares
interface Permissoes {
  calendario?: {
    verDetalhes?: boolean;
    registrarPresenca?: boolean;
    registrarFalta?: boolean;
    reagendar?: boolean;
    reposicao?: boolean;
    aulaExperimental?: boolean;
  };
  horarios?: {
    gerenciarTurmas?: boolean;
    adicionarAluno?: boolean;
    bloquearHorarios?: boolean;
    importarLote?: boolean;
    removerAluno?: boolean;
  };
  alunos?: {
    criar?: boolean;
    editar?: boolean;
    excluir?: boolean;
    verDetalhes?: boolean;
  };
}

interface Usuario {
  _id: string;
  nome: string;
  email?: string;
  telefone?: string;
  cor?: string;
  ativo: boolean;
  tipo?: string;
  abas?: string[];
  permissoes?: Permissoes;
  criadoEm?: string;
  atualizadoEm?: string;
  especialidades?: { _id: string; nome: string }[];
}

interface UsuarioForm {
  nome: string;
  email: string;
  telefone: string;
  cor: string;
  ativo: boolean;
  senha?: string;
  tipo?: string;
  abas?: string[];
  permissoes?: Permissoes;
  especialidades?: string[];
}

interface Especialidade {
  _id: string;
  nome: string;
  descricao?: string;
}

export default function UsuariosPage() {
  const coresSugeridas = [
    '#ff887c',
    '#dc2127',
    '#ffb878',
    '#fbd75b',
    '#7ae7bf',
    '#51b749',
    '#46d6db',
    '#5484ed',
    '#a4bdfc',
    '#dbadff',
    '#e1e1e1'
  ];

  const professorTabs = ['professor:minhaagenda', 'professor:alunos', 'professor:aulas'];
  
  // Ordem das abas igual à sidebar
  const allTabs = [
    // Agenda
    'calendario', 'horarios',
    // Aulas
    'aulas', 'aulas-experimentais',
    // Cadastros
    'alunos', 'usuarios', 'modalidades',
    // Solicitações
    'reagendamentos', 'alteracoes-horario', 'creditos', 'reposicao-faltas',
    // Comunicação
    'avisos',
    // Sistema
    'relatorios', 'backup', 'diagnostico', 'configuracoes',
    // Professor
    ...professorTabs
  ];
  
  // Ícones FontAwesome para cada aba
  const tabIcons: Record<string, string> = {
    'calendario': 'fa-calendar-alt',
    'horarios': 'fa-clock',
    'aulas': 'fa-clipboard-check',
    'aulas-experimentais': 'fa-user-plus',
    'alunos': 'fa-user-graduate',
    'usuarios': 'fa-users-cog',
    'modalidades': 'fa-layer-group',
    'reagendamentos': 'fa-exchange-alt',
    'alteracoes-horario': 'fa-clock',
    'creditos': 'fa-ticket',
    'reposicao-faltas': 'fa-history',
    'avisos': 'fa-bullhorn',
    'relatorios': 'fa-chart-line',
    'backup': 'fa-database',
    'diagnostico': 'fa-stethoscope',
    'configuracoes': 'fa-cog',
    'professor:minhaagenda': 'fa-calendar-alt',
    'professor:alunos': 'fa-user-graduate',
    'professor:aulas': 'fa-clipboard-list'
  };
  
  // Labels amigáveis para as abas
  const tabLabels: Record<string, string> = {
    'calendario': 'Calendário',
    'horarios': 'Horários',
    'aulas': 'Aulas Realizadas',
    'aulas-experimentais': 'Experimentais',
    'alunos': 'Alunos',
    'usuarios': 'Usuários',
    'modalidades': 'Modalidades',
    'reagendamentos': 'Reagendamentos',
    'alteracoes-horario': 'Alterações Horário',
    'creditos': 'Créditos',
    'reposicao-faltas': 'Reposição de Faltas',
    'avisos': 'Avisos',
    'relatorios': 'Relatórios',
    'backup': 'Backups',
    'diagnostico': 'Diagnóstico',
    'configuracoes': 'Configurações',
    'professor:minhaagenda': 'P: Minha Agenda',
    'professor:alunos': 'P: Meus Alunos',
    'professor:aulas': 'P: Minhas Aulas'
  };

  // Padrões iniciais para cada tipo de usuário
  const defaultTabsPorTipo: Record<string, string[]> = {
    admin: ['calendario', 'horarios', 'alunos', 'usuarios', 'modalidades', 'aulas', 'aulas-experimentais', 'avisos', 'reagendamentos', 'creditos', 'reposicao-faltas', 'relatorios', 'alteracoes-horario'],
    professor: ['professor:minhaagenda', 'professor:alunos', 'professor:aulas', 'aulas-experimentais', 'calendario'],
    vendedor: ['calendario', 'horarios', 'alunos', 'aulas-experimentais'],
    root: ['calendario', 'horarios', 'alunos', 'usuarios', 'modalidades', 'aulas', 'aulas-experimentais', 'avisos', 'reagendamentos', 'creditos', 'reposicao-faltas', 'relatorios', 'backup', 'diagnostico', 'configuracoes', 'alteracoes-horario']
  };

  // Permissões padrão por tipo
  const defaultPermissoesPorTipo: Record<string, Permissoes> = {
    admin: {
      calendario: { verDetalhes: true, registrarPresenca: true, registrarFalta: true, reagendar: true, reposicao: true, aulaExperimental: true },
      horarios: { gerenciarTurmas: true, adicionarAluno: true, bloquearHorarios: true, importarLote: true, removerAluno: true },
      alunos: { criar: true, editar: true, excluir: true, verDetalhes: true }
    },
    professor: {
      calendario: { verDetalhes: true, registrarPresenca: true, registrarFalta: true, reagendar: true, reposicao: true, aulaExperimental: true },
      horarios: { gerenciarTurmas: false, adicionarAluno: true, bloquearHorarios: false, importarLote: false, removerAluno: false },
      alunos: { criar: true, editar: true, excluir: false, verDetalhes: true }
    },
    vendedor: {
      calendario: { verDetalhes: true, registrarPresenca: true, registrarFalta: true, reagendar: false, reposicao: false, aulaExperimental: true },
      horarios: { gerenciarTurmas: false, adicionarAluno: true, bloquearHorarios: false, importarLote: false, removerAluno: false },
      alunos: { criar: true, editar: true, excluir: true, verDetalhes: true }
    },
    root: {
      calendario: { verDetalhes: true, registrarPresenca: true, registrarFalta: true, reagendar: true, reposicao: true, aulaExperimental: true },
      horarios: { gerenciarTurmas: true, adicionarAluno: true, bloquearHorarios: true, importarLote: true, removerAluno: true },
      alunos: { criar: true, editar: true, excluir: true, verDetalhes: true }
    }
  };

  // Estado para configurações de padrões por tipo (carregados do localStorage)
  const [configPadroes, setConfigPadroes] = useState<Record<string, { abas: string[]; permissoes: Permissoes }>>(
    () => {
      if (typeof window === 'undefined') return {};
      try {
        const saved = localStorage.getItem('configPadroesUsuarios');
        if (saved) return JSON.parse(saved);
      } catch {}
      return {};
    }
  );
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showMenuPadroes, setShowMenuPadroes] = useState(false);
  const [tipoConfigurando, setTipoConfigurando] = useState<string>('admin');
  const [configTemp, setConfigTemp] = useState<{ abas: string[]; permissoes: Permissoes }>({ abas: [], permissoes: {} });

  // Função para obter abas padrão de um tipo (considera configuração salva)
  const getAbasPadrao = (tipo: string): string[] => {
    if (configPadroes[tipo]?.abas) return configPadroes[tipo].abas;
    return defaultTabsPorTipo[tipo] || [];
  };

  // Função para obter permissões padrão de um tipo (considera configuração salva)
  const getPermissoesPadrao = (tipo: string): Permissoes => {
    if (configPadroes[tipo]?.permissoes) return configPadroes[tipo].permissoes;
    return defaultPermissoesPorTipo[tipo] || permissoesPadrao;
  };

  // Abrir modal de configuração
  const abrirConfigPadroes = (tipo: string) => {
    setTipoConfigurando(tipo);
    setConfigTemp({
      abas: [...getAbasPadrao(tipo)],
      permissoes: JSON.parse(JSON.stringify(getPermissoesPadrao(tipo)))
    });
    setShowConfigModal(true);
  };

  // Salvar configuração de padrões
  const salvarConfigPadroes = () => {
    const novoConfig = {
      ...configPadroes,
      [tipoConfigurando]: configTemp
    };
    setConfigPadroes(novoConfig);
    localStorage.setItem('configPadroesUsuarios', JSON.stringify(novoConfig));
    toast.success(`Padrões de ${tipoConfigurando} atualizados!`);
    setShowConfigModal(false);
  };

  // Resetar para padrões originais
  const resetarPadroes = (tipo: string) => {
    const novoConfig = { ...configPadroes };
    delete novoConfig[tipo];
    setConfigPadroes(novoConfig);
    localStorage.setItem('configPadroesUsuarios', JSON.stringify(novoConfig));
    setConfigTemp({
      abas: [...defaultTabsPorTipo[tipo]],
      permissoes: JSON.parse(JSON.stringify(defaultPermissoesPorTipo[tipo]))
    });
    toast.info(`Padrões de ${tipo} restaurados!`);
  };

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [especialidades, setEspecialidades] = useState<Especialidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [currentUserTipo, setCurrentUserTipo] = useState<string>('');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('tipo');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  // Permissões padrão (tudo habilitado)
  const permissoesPadrao: Permissoes = {
    calendario: {
      verDetalhes: true,
      registrarPresenca: true,
      registrarFalta: true,
      reagendar: true,
      reposicao: true,
      aulaExperimental: true
    },
    horarios: {
      gerenciarTurmas: true,
      adicionarAluno: true,
      bloquearHorarios: true,
      importarLote: true,
      removerAluno: true
    },
    alunos: {
      criar: true,
      editar: true,
      excluir: true,
      verDetalhes: true
    }
  };
  
  const [formData, setFormData] = useState<UsuarioForm>({
    nome: '',
    email: '',
    telefone: '',
    cor: '#3B82F6',
    ativo: true,
    senha: '',
    permissoes: permissoesPadrao
  });

  // Verificar permissão de acesso à aba usuarios
  useEffect(() => {
    try {
      const raw = localStorage.getItem('user');
      const user = raw ? JSON.parse(raw) : null;
      if (user?._id) {
        setCurrentUserId(user._id);  // Guardar o ID do usuário logado
        console.log('Current user ID set to:', user._id);
      }
      setCurrentUserTipo(user?.tipo || '');  // Guardar o tipo do usuário logado
      if (!user) {
        setHasPermission(false);
        return;
      }
      // root sempre tem acesso
      if (user.tipo === 'root') {
        setHasPermission(true);
        return;
      }
      // verificar se tem a aba 'usuarios' nas abas permitidas
      const abas = user.abas || [];
      setHasPermission(abas.includes('usuarios'));
    } catch {
      setHasPermission(false);
    }
  }, []);

  // Carregar usuários (administradores)
  const carregarUsuarios = async () => {
    try {
      const response = await fetch('/api/usuarios');
      const data = await response.json();
      if (data.success) {
        setUsuarios(data.data);
      } else {
        console.error('Erro ao carregar usuários:', data.error);
      }
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    } finally {
      setLoading(false);
    }
  };

  const carregarEspecialidades = async () => {
    try {
      const response = await fetch('/api/especialidades');
      const data = await response.json();
      if (data && data.success) setEspecialidades(data.data || []);
    } catch (error) {
      console.error('Erro ao carregar especialidades:', error);
    }
  };

  useEffect(() => {
    carregarUsuarios();
    carregarEspecialidades();
  }, []);

  // Fechar modal com ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showMenuPadroes) {
          setShowMenuPadroes(false);
          return;
        }
        if (showConfigModal) {
          setShowConfigModal(false);
          return;
        }
        if (showModal) {
          setShowModal(false);
        }
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [showModal, showConfigModal, showMenuPadroes]);

  const handleEspecialidadeChange = useCallback((especialidadeId: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      // ensure especialidades exists on the form data
      // @ts-ignore
      especialidades: checked ? ([...(prev as any).especialidades || [] , especialidadeId]) : ((prev as any).especialidades || []).filter((id: string) => id !== especialidadeId)
    }));
  }, []);

  const criarEspecialidade = async (nome: string) => {
    try {
      const response = await fetch('/api/especialidades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome })
      });
      const data = await response.json();
      if (data.success) {
        await carregarEspecialidades();
        toast.success('Especialidade criada com sucesso');
      }
      else toast.error('Erro ao criar especialidade: ' + data.error);
    } catch (error) {
      console.error('Erro ao criar especialidade:', error);
      toast.error('Erro ao criar especialidade');
    }
  };

  const excluirEspecialidade = async (id: string) => {
    try {
      const response = await fetch(`/api/especialidades/${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        await carregarEspecialidades();
        toast.success('Especialidade excluída');
      }
      else toast.error('Erro ao excluir especialidade: ' + data.error);
    } catch (error) {
      console.error('Erro ao excluir especialidade:', error);
      toast.error('Erro ao excluir especialidade');
    }
  };

  // Handlers
  const handleNomeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({...prev, nome: e.target.value}));
  }, []);
  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({...prev, email: e.target.value}));
  }, []);
  const handleTelefoneChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    // Aplica máscara de telefone (xx) xxxxx-xxxx ou (xx) xxxx-xxxx
    let value = e.target.value.replace(/\D/g, ''); // Remove tudo que não é dígito
    if (value.length > 11) value = value.slice(0, 11); // Limita a 11 dígitos
    
    if (value.length > 0) {
      value = '(' + value;
    }
    if (value.length > 3) {
      value = value.slice(0, 3) + ') ' + value.slice(3);
    }
    if (value.length > 10) {
      // Celular com 9 dígitos: (xx) xxxxx-xxxx
      value = value.slice(0, 10) + '-' + value.slice(10);
    } else if (value.length > 9) {
      // Fixo com 8 dígitos: (xx) xxxx-xxxx
      value = value.slice(0, 9) + '-' + value.slice(9);
    }
    
    setFormData(prev => ({...prev, telefone: value}));
  }, []);
  const handleAtivoChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({...prev, ativo: e.target.checked}));
  }, []);

  const handleTipoChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const tipo = e.target.value as any;
    if (!tipo) return setFormData(prev => ({ ...prev, tipo }));
    
    // Usar padrões configurados
    const abasPadrao = getAbasPadrao(tipo);
    const permissoesTipo = getPermissoesPadrao(tipo);
    
    setFormData(prev => ({
      ...prev,
      tipo,
      abas: [...abasPadrao],
      permissoes: JSON.parse(JSON.stringify(permissoesTipo))
    }));
  }, [configPadroes]);

  const filteredUsuarios = useMemo(() => {
    let result = usuarios;
    
    // Filtro por query
    if (query) {
      const q = String(query).trim().toLowerCase();
      result = result.filter(u => {
        const nome = String(u.nome || '').toLowerCase();
        const email = String(u.email || '').toLowerCase();
        const telefone = String(u.telefone || '').toLowerCase();
        return nome.includes(q) || email.includes(q) || telefone.includes(q);
      });
    }
    
    // Ordenação
    result.sort((a, b) => {
      let aVal: any = '';
      let bVal: any = '';
      
      switch (sortBy) {
        case 'nome':
          aVal = String(a.nome || '').toLowerCase();
          bVal = String(b.nome || '').toLowerCase();
          break;
        case 'tipo':
          aVal = String(a.tipo || '').toLowerCase();
          bVal = String(b.tipo || '').toLowerCase();
          break;
        case 'email':
          aVal = String(a.email || '').toLowerCase();
          bVal = String(b.email || '').toLowerCase();
          break;
        case 'telefone':
          aVal = String(a.telefone || '').toLowerCase();
          bVal = String(b.telefone || '').toLowerCase();
          break;
        case 'status':
          aVal = a.ativo ? 'ativo' : 'inativo';
          bVal = b.ativo ? 'ativo' : 'inativo';
          break;
        default:
          return 0;
      }
      
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    
    return result;
  }, [usuarios, query, sortBy, sortOrder]);

  const abrirModalNovo = () => {
    setEditingId(null);
    // leave tipo blank so user must choose explicitly
    setFormData({ nome: '', email: '', telefone: '', cor: '#3B82F6', ativo: true, senha: '', tipo: '', abas: [], especialidades: [], permissoes: permissoesPadrao });
    setShowModal(true);
  };

  const toggleSort = (column: string) => {
    if (sortBy === column) {
      // Se já está ordenando por essa coluna, inverte a ordem
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // Se está ordenando por outra coluna, muda para essa coluna com ordem crescente
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const renderSortIcon = (column: string) => {
    if (sortBy !== column) return null;
    return (
      <i className={`fas ${sortOrder === 'asc' ? 'fa-arrow-up' : 'fa-arrow-down'} ml-1 text-xs`} aria-hidden="true" />
    );
  };

  const abrirModalEditar = (usuario: Usuario) => {
    setEditingId(usuario._id);
    // Extrair IDs das especialidades (que vêm como objetos populados)
    const especialidadesIds = (usuario.especialidades || []).map(e => e._id);
    
    // Mesclar permissões do usuário com permissões padrão para garantir que novas permissões tenham valor
    const permissoesMescladas: Permissoes = {
      calendario: {
        ...permissoesPadrao.calendario,
        ...(usuario.permissoes?.calendario || {})
      },
      horarios: {
        ...permissoesPadrao.horarios,
        ...(usuario.permissoes?.horarios || {})
      },
      alunos: {
        ...permissoesPadrao.alunos,
        ...(usuario.permissoes?.alunos || {})
      }
    };
    
    setFormData({ 
      nome: usuario.nome, 
      email: usuario.email || '', 
      telefone: usuario.telefone || '', 
      cor: usuario.cor || '#3B82F6', 
      ativo: usuario.ativo, 
      tipo: (usuario.tipo || 'admin'), 
      abas: usuario.abas || [],
      especialidades: especialidadesIds,
      permissoes: permissoesMescladas
    });
    setShowModal(true);
  };

  const salvarUsuario = async () => {
    try {
      // Validar se nome foi preenchido
      if (!formData.nome || String(formData.nome).trim().length === 0) {
        toast.warning('Por favor, preencha o nome');
        return;
      }

      // Validar se email foi preenchido
      if (!formData.email || String(formData.email).trim().length === 0) {
        toast.warning('Por favor, preencha o email');
        return;
      }

      // Validar se tipo foi selecionado
      if (!formData.tipo || formData.tipo === '') {
        toast.warning('Por favor, selecione um tipo de usuário');
        return;
      }

      // Validar senha: obrigatória apenas ao criar novo usuário
      const senhaPreenchida = formData.senha && String(formData.senha).trim().length > 0;
      if (!editingId && !senhaPreenchida) {
        toast.warning('Por favor, preencha a senha');
        return;
      }

      // Validar se senha tem no mínimo 6 caracteres (se foi preenchida)
      if (senhaPreenchida && String(formData.senha).trim().length < 6) {
        toast.warning('A senha deve ter no mínimo 6 caracteres');
        return;
      }

      const body: any = { ...formData } as any;
      
      // Se não escolheu cor, escolhe uma aleatória
      if (!body.cor || body.cor === '') {
        const coresSugeridas = [
          '#ff887c',
          '#dc2127',
          '#ffb878',
          '#fbd75b',
          '#7ae7bf',
          '#51b749',
          '#46d6db',
          '#5484ed',
          '#a4bdfc',
          '#dbadff',
          '#e1e1e1'
        ];
        body.cor = coresSugeridas[Math.floor(Math.random() * coresSugeridas.length)];
      }

      if (formData.tipo === 'professor') {
        // @ts-ignore
        body.especialidades = (formData as any).especialidades || [];
      }

      console.log('📤 Enviando para API:', body);

      const token = localStorage.getItem('token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const url = editingId ? `/api/usuarios/${editingId}` : '/api/usuarios';
      const method = editingId ? 'PUT' : 'POST';
      const response = await fetch(url, { method, headers, body: JSON.stringify(body) });
      const data = await response.json();
      console.log('📥 Resposta da API:', data);
      console.log('📥 Abas retornadas:', data?.data?.abas);
      if (data.success) {
        await carregarUsuarios();
        const savedId = editingId || (data.data && data.data._id) || null;
        if (savedId && formData.senha && String(formData.senha).trim().length > 0) {
          try {
            const resp = await fetch(`/api/usuarios/${savedId}/senha`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ senha: formData.senha }) });
            const sd = await resp.json();
            if (!sd || !sd.success) {
              toast.warning('Usuário salvo, mas falha ao definir senha: ' + (sd && sd.error ? sd.error : 'Erro'));
            }
          } catch (e) {
            console.error('Erro ao setar senha:', e);
            toast.warning('Usuário salvo, mas falha ao definir senha');
          }
        }
        toast.success(editingId ? 'Usuário atualizado com sucesso' : 'Usuário criado com sucesso');
        setShowModal(false);
      } else {
        toast.error(`Erro: ${data.error}`);
      }
    } catch (error) {
      console.error('Erro ao salvar usuário:', error);
      toast.error('Erro ao salvar usuário');
    }
  };

  const excluirUsuario = async (id: string) => {
    const result = await Swal.fire({
      title: 'Excluir usuário?',
      text: 'Tem certeza que deseja excluir este usuário?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sim, excluir',
      cancelButtonText: 'Cancelar'
    });
    if (!result.isConfirmed) return;
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      
      const response = await fetch(`/api/usuarios/${id}`, { method: 'DELETE', headers });
      const data = await response.json();
      if (data.success) {
        await carregarUsuarios();
        toast.success('Usuário excluído com sucesso');
      } else {
        toast.error(`Erro: ${data.error}`);
      }
    } catch (error) {
      console.error('Erro ao excluir usuário:', error);
      toast.error('Erro ao excluir usuário');
    }
  };

  // Verificando permissão
  if (hasPermission === null) {
    return (
      <ProtectedPage tab="usuarios" title="Usuários - Superação Flux" fullWidth>
        <div className="px-4 py-6 sm:px-0">
          {/* Header skeleton */}
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <div className="h-5 bg-gray-200 rounded w-32 mb-2 animate-pulse" />
              <div className="h-4 bg-gray-200 rounded w-64 animate-pulse" />
            </div>
            <div className="h-10 w-32 bg-gray-200 rounded-full animate-pulse" />
          </div>
          
          {/* Table skeleton */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="border-b border-gray-200 px-4 py-4 flex gap-4 items-center">
                <div className="h-4 bg-gray-200 rounded w-32 animate-pulse" />
                <div className="h-4 bg-gray-200 rounded w-40 animate-pulse" />
                <div className="h-4 bg-gray-200 rounded w-24 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </ProtectedPage>
    );
  }

  // Sem permissão - o ProtectedPage já mostra AccessDenied, retornar null
  if (hasPermission === false) {
    return (
      <ProtectedPage tab="usuarios" title="Usuários - Superação Flux">
          <div></div>
      </ProtectedPage>
    );
  }

  if (loading) {
    return (
      <ProtectedPage tab="usuarios" title="Usuários - Superação Flux" fullWidth>
        <div className="px-4 py-6 sm:px-0">
          {/* Header skeleton */}
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <div className="h-5 bg-gray-200 rounded w-32 mb-2 animate-pulse" />
              <div className="h-4 bg-gray-200 rounded w-64 animate-pulse" />
            </div>
            <div className="h-10 w-32 bg-gray-200 rounded-full animate-pulse" />
          </div>
          
          {/* Search skeleton */}
          <div className="mb-6">
            <div className="h-10 bg-gray-200 rounded-lg w-full max-w-md animate-pulse" />
          </div>
          
          {/* Table skeleton */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
              <div className="flex gap-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-4 bg-gray-200 rounded w-20 animate-pulse" />
                ))}
              </div>
            </div>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="border-b border-gray-200 px-4 py-4 flex gap-4 items-center">
                <div className="h-4 bg-gray-200 rounded w-32 animate-pulse" />
                <div className="h-4 bg-gray-200 rounded w-40 animate-pulse" />
                <div className="h-4 bg-gray-200 rounded w-24 animate-pulse" />
                <div className="h-4 bg-gray-200 rounded w-16 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </ProtectedPage>
    );
  }

  return (
    <ProtectedPage tab="usuarios" title="Usuários - Superação Flux" fullWidth>
        <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
          {/* Header Desktop */}
          <div className="hidden md:flex items-center justify-between gap-4 mb-6 fade-in-1">
            <div>
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <i className="fas fa-users-cog text-green-600"></i>
                Usuários
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Gerencie os usuários administradores do sistema
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <button 
                  type="button" 
                  onClick={() => setShowMenuPadroes(!showMenuPadroes)}
                  className="transition-colors duration-200 h-10 inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white text-gray-700 px-4 text-sm font-medium hover:bg-gray-50"
                  title="Configurar padrões por tipo de usuário"
                >
                  <i className="fas fa-sliders-h w-4" aria-hidden="true" />
                  Padrões
                </button>
              </div>
              <div>
                <button type="button" onClick={abrirModalNovo} className="transition-colors duration-200 h-10 inline-flex items-center gap-2  rounded-full bg-primary-600 text-white px-4 text-sm font-medium hover:bg-primary-700">
                  <i className="fas fa-user-plus w-4 text-white " aria-hidden="true" />
                  Novo Usuário
                </button>
              </div>
            </div>
          </div>

          {/* Menu dropdown de padrões - Renderizado fora do fluxo normal */}
          {showMenuPadroes && (
            <>
              <div className="fixed inset-0 z-[999]" onClick={() => setShowMenuPadroes(false)} />
              <div className="fixed top-20 right-8 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-[1000]">
                <div className="px-3 py-2 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-500">Configurar padrões para:</p>
                </div>
                {['admin', 'professor', 'vendedor', 'root'].map(tipo => (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() => {
                      setShowMenuPadroes(false);
                      abrirConfigPadroes(tipo);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <i className={`fas ${tipo === 'admin' ? 'fa-user-shield' : tipo === 'professor' ? 'fa-chalkboard-teacher' : tipo === 'vendedor' ? 'fa-user-tie' : 'fa-shield-alt text-amber-500'} text-xs`}></i>
                    {tipo.charAt(0).toUpperCase() + tipo.slice(1)}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Header Mobile */}
          <div className="md:hidden mb-4 fade-in-1">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-semibold text-gray-900">Usuários</h1>
              <button 
                type="button" 
                onClick={abrirModalNovo} 
                className="h-8 w-8 inline-flex items-center justify-center rounded-full bg-green-600 text-white"
              >
                <i className="fas fa-plus text-xs"></i>
              </button>
            </div>
          </div>

          {/* Busca */}
          <div className="mb-4 fade-in-2">
            <div className="relative w-full">
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
              <input 
                type="text" 
                value={query} 
                onChange={(e) => setQuery(e.target.value)} 
                placeholder="Pesquisar usuário..." 
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg outline-none text-sm" 
              />
            </div>
          </div>

          {/* Contador Mobile */}
          <div className="md:hidden mb-4 text-xs text-gray-500 fade-in-2">
            {filteredUsuarios.length} {filteredUsuarios.length === 1 ? 'usuário' : 'usuários'}
          </div>

          {filteredUsuarios.length === 0 ? (
            <div className="text-center py-12">
              <div className="mb-4">
                <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-primary-50 text-primary-600">
                  <i className="fas fa-users-cog text-primary-600 text-lg" aria-hidden="true" />
                </div>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum usuário encontrado</h3>
              <p className="text-gray-500 mb-6">Não há usuários que correspondam à sua busca.</p>
              <button onClick={abrirModalNovo} className="h-10 inline-flex items-center gap-2 rounded-md bg-primary-600 text-white px-4 text-sm font-medium hover:bg-primary-700">
                <i className="fas fa-user-plus" aria-hidden="true" /> Cadastrar Usuário
              </button>
            </div>
          ) : (
            <>
            {/* Versão Mobile - Cards */}
            <div className="md:hidden space-y-3 fade-in-3">
              {filteredUsuarios.map((usuario, idx) => {
                const isRoot = usuario.tipo === 'root';
                const isProfessor = usuario.tipo === 'professor';
                const isVendedor = usuario.tipo === 'vendedor';
                const tipoLabel = isRoot ? 'ROOT' : isProfessor ? 'Professor' : isVendedor ? 'Vendedor' : 'Admin';
                const fadeClass = `fade-in-${Math.min((idx % 8) + 1, 8)}`;
                
                return (
                  <div 
                    key={usuario._id} 
                    className={`bg-white rounded-xl border shadow-sm overflow-hidden ${fadeClass} ${isRoot ? 'border-amber-300' : 'border-gray-200'} ${!usuario.ativo ? 'opacity-60' : ''}`}
                  >
                    {/* Header do Card */}
                    <div className={`px-4 py-3 ${isRoot ? 'bg-gradient-to-r from-amber-50 to-white' : isProfessor ? 'bg-gradient-to-r from-blue-50 to-white' : isVendedor ? 'bg-gradient-to-r from-green-50 to-white' : 'bg-gradient-to-r from-gray-50 to-white'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {isRoot ? (
                            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                              <i className="fas fa-shield text-amber-500"></i>
                            </div>
                          ) : (
                            <div 
                              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm border-2 border-white shadow-sm" 
                              style={{ backgroundColor: usuario.ativo ? (usuario.cor || '#3B82F6') : '#9CA3AF' }}
                            >
                              {usuario.nome.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className={`font-semibold text-sm ${!usuario.ativo ? 'text-gray-500' : isRoot ? 'text-amber-800' : 'text-gray-900'}`}>
                              {usuario.nome}
                              {currentUserId && usuario._id === currentUserId && (
                                <span className="ml-1 text-[10px] font-bold text-green-600">(VOCÊ)</span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 truncate max-w-[180px]">
                              {usuario.email || 'Sem email'}
                            </div>
                          </div>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                          !usuario.ativo 
                            ? 'bg-gray-200 text-gray-600' 
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {usuario.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                    </div>

                    {/* Conteúdo do Card */}
                    <div className="px-4 py-3 space-y-3">
                      {/* Tipo Badge */}
                      <div className="flex flex-wrap gap-1.5">
                        {isRoot ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            <i className="fas fa-shield-alt"></i> ROOT
                          </span>
                        ) : (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${isProfessor ? 'bg-blue-100 text-blue-700' : isVendedor ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                            <i className={`fas ${isProfessor ? 'fa-chalkboard-teacher' : isVendedor ? 'fa-user-tie' : 'fa-user-shield'} text-[9px]`}></i>
                            {tipoLabel}
                          </span>
                        )}
                      </div>

                      {/* Especialidades (se professor) */}
                      {isProfessor && usuario.especialidades && usuario.especialidades.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Especialidades</div>
                          <div className="flex flex-wrap gap-1">
                            {usuario.especialidades.map((esp) => (
                              <span key={esp._id} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700">
                                {esp.nome}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Telefone */}
                      {usuario.telefone && (
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <i className="fas fa-phone text-[10px] text-gray-400"></i>
                          {usuario.telefone}
                        </div>
                      )}
                    </div>

                    {/* Footer - Ações */}
                    {!(isRoot && currentUserTipo !== 'root') && (
                      <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
                        <div className="flex items-center justify-end gap-1.5">
                          <button 
                            onClick={() => abrirModalEditar(usuario)} 
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 text-green-600 hover:bg-green-50 transition-colors"
                          >
                            <i className="fas fa-edit text-xs"></i>
                          </button>
                          <button 
                            onClick={() => excluirUsuario(usuario._id)} 
                            disabled={!usuario.ativo}
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${usuario.ativo ? 'bg-white border border-gray-200 text-red-500 hover:bg-red-50' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                          >
                            <i className="fas fa-trash text-xs"></i>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Versão Desktop - Tabela */}
            <div className="mt-6 hidden md:flex flex-col fade-in-3">
              <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
                <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
                  <div className="overflow-hidden rounded-md border border-gray-200">
                    <table className="w-full text-sm border-collapse text-center">
                      <thead className="bg-white border-b border-gray-200">
                        <tr>
                          <th className="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200 w-[15%] cursor-pointer hover:bg-gray-50 select-none" onClick={() => toggleSort('nome')}>
                            Nome {renderSortIcon('nome')}
                          </th>
                          <th className="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200 w-[10%] cursor-pointer hover:bg-gray-50 select-none" onClick={() => toggleSort('tipo')}>
                            Tipo {renderSortIcon('tipo')}
                          </th>
                          <th className="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200 w-[18%]">Especialidades</th>
                          <th className="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200 w-[20%] cursor-pointer hover:bg-gray-50 select-none" onClick={() => toggleSort('email')}>
                            Email {renderSortIcon('email')}
                          </th>
                          <th className="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200 w-[12%] cursor-pointer hover:bg-gray-50 select-none" onClick={() => toggleSort('telefone')}>
                            Telefone {renderSortIcon('telefone')}
                          </th>
                          <th className="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200 w-[10%] cursor-pointer hover:bg-gray-50 select-none" onClick={() => toggleSort('status')}>
                            Status {renderSortIcon('status')}
                          </th>
                          <th className="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase tracking-wider w-[10%]">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white">
                        {filteredUsuarios.map((usuario, idx) => (
                          <tr key={usuario._id} className={`fade-in-${Math.min((idx % 8) + 1, 8)} ${usuario.tipo === 'root' ? 'bg-amber-50' : ''} ${!usuario.ativo ? 'bg-gray-100 text-gray-400' : ''}`}>
                            <td className="px-3 py-3 text-sm border-r border-b border-gray-200 text-center">
                              <div className="flex items-center justify-center gap-2">
                                {usuario.tipo === 'root' ? (
                                  <i className="fas fa-shield text-amber-500 text-sm flex-shrink-0" title="Usuário Root" aria-hidden="true" />
                                ) : (
                                  <div className="h-4 w-4 rounded-full border border-gray-300 flex-shrink-0" style={{ backgroundColor: usuario.ativo ? (usuario.cor || '#3B82F6') : '#e5e7eb' }} title={usuario.ativo ? `Cor: ${usuario.cor || '#3B82F6'}` : 'Inativo'} />
                                )}
                                <span className={`font-medium ${usuario.tipo === 'root' ? 'text-amber-800' : (usuario.ativo ? 'text-gray-900' : 'text-gray-400')}`}>
                                  {usuario.nome}
                                  {currentUserId && usuario._id === currentUserId && (
                                    <>
                                      <span className="ml-1 text-xs font-bold text-primary-600">(VOCÊ)</span>
                                    </>
                                  )}
                                </span>
                              </div>
                            </td>
                            <td className={`px-3 py-3 text-sm border-r border-b border-gray-200 text-center ${!usuario.ativo ? 'text-gray-400' : 'text-gray-500'}`}>
                              {usuario.tipo === 'root' ? (
                                <span className="inline-flex items-center gap-1 justify-center text-xs font-bold px-2 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                                  <i className="fas fa-shield-alt text-[10px]" aria-hidden="true" />
                                  ROOT
                                </span>
                              ) : (
                                <span className={`inline-flex items-center gap-2 justify-center text-sm ${usuario.tipo === 'professor' ? 'text-primary-700' : usuario.tipo === 'vendedor' ? 'text-green-700' : 'text-gray-700'}`}>
                                  {usuario.tipo === 'professor' ? 'Professor' : usuario.tipo === 'vendedor' ? 'Vendedor' : 'Admin'}
                                </span>
                              )}
                            </td>
                            <td className={`px-3 py-3 text-sm border-r border-b border-gray-200 text-center ${!usuario.ativo ? 'text-gray-400' : 'text-gray-500'}`}>
                              {usuario.tipo === 'professor' && usuario.especialidades && usuario.especialidades.length > 0 ? (
                                <span className="inline-flex flex-wrap justify-center gap-1">
                                  {usuario.especialidades.map((esp, i) => (
                                    <span key={esp._id} className="bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full text-xs">{esp.nome}</span>
                                  ))}
                                </span>
                              ) : usuario.tipo === 'professor' ? (
                                <span className="text-gray-400 italic">—</span>
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                            <td className={`px-3 py-3 text-sm border-r border-b border-gray-200 text-center overflow-hidden ${!usuario.ativo ? 'text-gray-400' : 'text-gray-500'}`}>
                              <span className="block truncate" title={usuario.email || ''}>{usuario.email || <span className="text-gray-400 italic">Não informado</span>}</span>
                            </td>
                            <td className={`px-3 py-3 text-sm border-r border-b border-gray-200 text-center overflow-hidden ${!usuario.ativo ? 'text-gray-400' : 'text-gray-500'}`}>
                              <span className="block truncate">{usuario.telefone || <span className="text-gray-400 italic">Não informado</span>}</span>
                            </td>
                            <td className="px-3 py-3 text-sm border-r border-b border-gray-200 text-center"><span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${usuario.ativo ? 'bg-green-100 text-green-800' : 'bg-gray-300 text-gray-500'}`}>{usuario.ativo ? 'Ativo' : 'Inativo'}</span></td>
                            <td className={`px-3 py-3 text-sm border-b border-gray-200 text-center ${!usuario.ativo ? 'text-gray-400' : ''}`}>
                              {/* Se o usuário é root e o logado não é root, não mostrar botões */}
                              {usuario.tipo === 'root' && currentUserTipo !== 'root' ? (
                                <span className="text-gray-400 text-xs italic">—</span>
                              ) : (
                                <div className="flex items-center justify-center gap-2">
                                  <button onClick={() => abrirModalEditar(usuario)} className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-white border border-gray-100 hover:bg-gray-50 text-primary-600"><i className="fas fa-edit w-3" aria-hidden="true" /></button>
                                  <button onClick={() => excluirUsuario(usuario._id)} className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border ${usuario.ativo ? 'bg-red-50 border-red-100 text-red-700 hover:bg-red-100' : 'bg-gray-200 border-gray-300 text-gray-400 cursor-not-allowed'}`} disabled={!usuario.ativo}><i className="fas fa-trash w-3" aria-hidden="true" /></button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
            </>
          )}

          {/* Modal de Cadastro/Edição */}
          {showModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-700 bg-opacity-50 p-3 sm:p-4">
              <div className="relative w-full max-w-lg mx-auto bg-white rounded-lg shadow-lg border border-gray-200 flex flex-col max-h-[90vh]">
                {/* Header Fixo */}
                <div className="flex-shrink-0 p-4 sm:p-6 pb-4 border-b">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {editingId ? (
                        <i className="fas fa-edit text-green-600 text-lg" aria-hidden="true" />
                      ) : (
                        <i className="fas fa-users-cog text-green-600 text-lg" aria-hidden="true" />
                      )}
                      <h3 className="text-base font-semibold text-gray-900">{editingId ? 'Editar Usuário' : 'Novo Usuário'}</h3>
                    </div>
                    <button type="button" onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600" title="Fechar"><i className="fas fa-times text-lg" aria-hidden="true" /></button>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <i className="fas fa-info-circle text-green-600 text-sm" aria-hidden="true" />
                    <span className="text-sm font-medium text-gray-500">Preencha os dados do usuário administrador.</span>
                  </div>
                </div>
                
                {/* Conteúdo com Scroll */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 pt-4">
                <form id="formUsuario" className="space-y-4" noValidate onSubmit={(e) => { e.preventDefault(); salvarUsuario(); }}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                      <input type="text" value={formData.nome} onChange={handleNomeChange} className="block w-full h-10 border border-gray-300 rounded-md px-3 py-2 text-sm font-medium" placeholder="Nome completo" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                      <input type="email" value={formData.email} onChange={handleEmailChange} className="block w-full h-10 border border-gray-300 rounded-md px-3 py-2 text-sm font-medium" placeholder="email@exemplo.com" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de usuário *</label>
                      <select value={formData.tipo || ''} onChange={handleTipoChange} className="block w-full h-10 border border-gray-300 rounded-md px-3 py-2 text-sm">
                        <option value="">— selecione —</option>
                        <option value="admin">Administrador</option>
                        <option value="professor">Professor</option>
                        <option value="vendedor">Vendedor</option>
                        {currentUserTipo === 'root' && <option value="root">ROOT</option>}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Telefone <span className="text-gray-400 text-sm font-medium">(opcional)</span></label>
                      <input type="tel" value={formData.telefone} onChange={handleTelefoneChange} className="block w-full h-10 border border-gray-300 rounded-md px-3 py-2 text-sm font-medium" placeholder="(11) 99999-9999" />
                    </div>
                  </div>
                  {formData.tipo === 'professor' && (
                    <fieldset className="border border-gray-300 rounded-md px-3 pt-4 pb-3">
                      <legend className="text-xs font-medium text-gray-700 px-1 -mx-1">Especialidades</legend>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const nome = prompt('Nome da nova especialidade:');
                            if (nome) criarEspecialidade(nome);
                          }}
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-colors border bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                          title="Adicionar nova especialidade"
                        >
                          <i className="fas fa-plus" aria-hidden="true" />
                        </button>
                        {especialidades.length === 0 ? (
                          <p className="text-gray-500 text-sm font-medium italic">Nenhuma especialidade cadastrada</p>
                        ) : (
                          especialidades.map((especialidade) => {
                            const isSelected = ((formData as any).especialidades || []).includes(especialidade._id);
                            return (
                              <div key={especialidade._id} className="relative">
                                <button
                                  type="button"
                                  onClick={() => handleEspecialidadeChange(especialidade._id, !isSelected)}
                                  aria-pressed={isSelected}
                                  className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-colors border ${isSelected ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                                >
                                  {especialidade.nome}
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const result = await Swal.fire({
                                      title: 'Excluir especialidade?',
                                      text: `Tem certeza que deseja excluir a especialidade "${especialidade.nome}"?`,
                                      icon: 'warning',
                                      showCancelButton: true,
                                      confirmButtonColor: '#d33',
                                      cancelButtonColor: '#6b7280',
                                      confirmButtonText: 'Sim, excluir',
                                      cancelButtonText: 'Cancelar'
                                    });
                                    if (result.isConfirmed) {
                                      excluirEspecialidade(especialidade._id);
                                    }
                                  }}
                                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-bold"
                                  title="Excluir especialidade"
                                >
                                  ×
                                </button>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </fieldset>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{editingId ? 'Senha' : 'Senha *'}</label>
                    <input type="password" value={formData.senha || ''} onChange={(e) => setFormData(prev => ({ ...prev, senha: e.target.value }))} className="block w-full h-10 border border-gray-300 rounded-md px-3 py-2 text-sm font-medium" placeholder={editingId ? 'Deixe em branco para manter a atual' : 'Senha (mín 6 caracteres)'} />
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <label className="block text-sm font-medium text-gray-700">Cor</label>
                      <div className="flex flex-wrap gap-0.5 p-1 bg-gray-50 border border-gray-200 rounded-md">
                        {coresSugeridas.map((cor) => (
                          <button key={cor} type="button" onClick={() => setFormData(prev => ({ ...prev, cor: cor }))} className={`relative h-5 w-5 rounded-full border flex items-center justify-center transition-all duration-150 hover:scale-105 hover:border-primary-400 ${formData.cor === cor ? 'border-primary-600 ring-2 ring-primary-400' : 'border-gray-300'}`} style={{ backgroundColor: cor }} title={cor}>
                            {formData.cor === cor && (<span className="absolute inset-0 flex items-center justify-center"><i className="fas fa-check text-white text-[8px] drop-shadow" /></span>)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <fieldset className="border border-gray-300 rounded-md px-3 pt-4 pb-3">
                    <legend className="text-xs font-medium text-gray-700 px-1 -mx-1">Acesso às abas</legend>
                    <div className="flex flex-wrap gap-2">
                      {[
                        // Agenda
                        { key: 'calendario', label: 'Calendário', icon: 'fa-calendar-alt' },
                        { key: 'horarios', label: 'Horários', icon: 'fa-clock' },
                        // Aulas
                        { key: 'aulas', label: 'Aulas', icon: 'fa-clipboard-check' },
                        { key: 'aulas-experimentais', label: 'Experimentais', icon: 'fa-user-plus' },
                        // Cadastros
                        { key: 'alunos', label: 'Alunos', icon: 'fa-user-graduate' },
                        { key: 'usuarios', label: 'Usuários', icon: 'fa-users-cog' },
                        { key: 'modalidades', label: 'Modalidades', icon: 'fa-layer-group' },
                        // Solicitações
                        { key: 'reagendamentos', label: 'Reagendamentos', icon: 'fa-exchange-alt' },
                        { key: 'alteracoes-horario', label: 'Alterações Horário', icon: 'fa-clock' },
                        { key: 'creditos', label: 'Créditos', icon: 'fa-ticket' },
                        { key: 'reposicao-faltas', label: 'Reposição de Faltas', icon: 'fa-history' },
                        // Comunicação
                        { key: 'avisos', label: 'Avisos', icon: 'fa-bullhorn' },
                        // Sistema
                        { key: 'relatorios', label: 'Relatórios', icon: 'fa-chart-line' },
                        { key: 'backup', label: 'Backups', icon: 'fa-database' },
                        { key: 'diagnostico', label: 'Diagnóstico', icon: 'fa-stethoscope' },
                        { key: 'configuracoes', label: 'Configurações', icon: 'fa-cog' },
                        // Professor (condicional)
                        ...(formData.tipo === 'professor' ? [
                          { key: 'professor:minhaagenda', label: 'P: Minha Agenda', icon: 'fa-calendar-alt' },
                          { key: 'professor:alunos', label: 'P: Meus Alunos', icon: 'fa-user-graduate' },
                          { key: 'professor:aulas', label: 'P: Minhas Aulas', icon: 'fa-clipboard-list' }
                        ] : [])
                      ].map(opt => {
                        const selected = Array.isArray(formData.abas) ? formData.abas.includes(opt.key) : false;
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => {
                              setFormData(prev => {
                                const current = Array.isArray(prev.abas) ? [...prev.abas] : [];
                                const idx = current.indexOf(opt.key);
                                if (idx >= 0) current.splice(idx, 1);
                                else current.push(opt.key);
                                return { ...prev, abas: current };
                              });
                            }}
                            aria-pressed={selected}
                            className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full transition-colors border ${selected ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                          >
                            <i className={`fas ${opt.icon} text-[10px] ${selected ? 'text-white' : 'text-gray-400'}`} aria-hidden="true" />
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-2 text-xs text-gray-500">Clique para selecionar as abas que o usuário pode acessar.</div>
                  </fieldset>

                  {/* Permissões Granulares */}
                  <fieldset className="border border-gray-300 rounded-md px-3 pt-4 pb-3">
                    <legend className="text-xs font-medium text-gray-700 px-1 -mx-1">Permissões por Módulo</legend>
                    
                    {/* Calendário */}
                    {Array.isArray(formData.abas) && formData.abas.includes('calendario') && (
                      <div className="mb-4">
                        <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1">
                          <i className="fas fa-calendar text-gray-400"></i> Calendário
                        </p>
                        <div className="flex flex-wrap gap-2 pl-4">
                          {[
                            { key: 'reagendar', label: 'Criar Reagendamento' },
                            { key: 'reposicao', label: 'Agendar Reposição por Falta' },
                            { key: 'aulaExperimental', label: 'Agendar Aula Experimental' }
                          ].map(perm => {
                            const checked = formData.permissoes?.calendario?.[perm.key as keyof typeof formData.permissoes.calendario] ?? true;
                            return (
                              <label key={perm.key} className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    setFormData(prev => ({
                                      ...prev,
                                      permissoes: {
                                        ...prev.permissoes,
                                        calendario: {
                                          ...prev.permissoes?.calendario,
                                          [perm.key]: e.target.checked
                                        }
                                      }
                                    }));
                                  }}
                                  className="w-3.5 h-3.5 rounded border-gray-300 text-primary-600"
                                />
                                <span className={checked ? 'text-gray-700' : 'text-gray-400'}>{perm.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Horários */}
                    {Array.isArray(formData.abas) && formData.abas.includes('horarios') && (
                      <div className="mb-4">
                        <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1">
                          <i className="fas fa-clock text-gray-400"></i> Horários
                        </p>
                        <div className="flex flex-wrap gap-2 pl-4">
                          {[
                            { key: 'gerenciarTurmas', label: 'Gerenciar Turmas (criar/editar/excluir)' },
                            { key: 'adicionarAluno', label: 'Adicionar Aluno em Turma' },
                            { key: 'removerAluno', label: 'Remover Aluno da Turma' },
                            { key: 'bloquearHorarios', label: 'Bloquear/Desbloquear Horários' },
                            { key: 'importarLote', label: 'Adicionar Alunos em Lote' }
                          ].map(perm => {
                            const checked = formData.permissoes?.horarios?.[perm.key as keyof typeof formData.permissoes.horarios] ?? true;
                            return (
                              <label key={perm.key} className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    setFormData(prev => ({
                                      ...prev,
                                      permissoes: {
                                        ...prev.permissoes,
                                        horarios: {
                                          ...prev.permissoes?.horarios,
                                          [perm.key]: e.target.checked
                                        }
                                      }
                                    }));
                                  }}
                                  className="w-3.5 h-3.5 rounded border-gray-300 text-primary-600"
                                />
                                <span className={checked ? 'text-gray-700' : 'text-gray-400'}>{perm.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Alunos */}
                    {Array.isArray(formData.abas) && formData.abas.includes('alunos') && (
                      <div className="mb-2">
                        <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1">
                          <i className="fas fa-users text-gray-400"></i> Alunos
                        </p>
                        <div className="flex flex-wrap gap-2 pl-4">
                          {[
                            { key: 'criar', label: 'Criar Aluno' },
                            { key: 'editar', label: 'Editar Aluno' },
                            { key: 'excluir', label: 'Excluir Aluno' }
                          ].map(perm => {
                            const checked = formData.permissoes?.alunos?.[perm.key as keyof typeof formData.permissoes.alunos] ?? true;
                            return (
                              <label key={perm.key} className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    setFormData(prev => ({
                                      ...prev,
                                      permissoes: {
                                        ...prev.permissoes,
                                        alunos: {
                                          ...prev.permissoes?.alunos,
                                          [perm.key]: e.target.checked
                                        }
                                      }
                                    }));
                                  }}
                                  className="w-3.5 h-3.5 rounded border-gray-300 text-primary-600"
                                />
                                <span className={checked ? 'text-gray-700' : 'text-gray-400'}>{perm.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Mensagem se nenhuma aba com permissões está selecionada */}
                    {(!Array.isArray(formData.abas) || 
                      (!formData.abas.includes('calendario') && 
                       !formData.abas.includes('horarios') && 
                       !formData.abas.includes('alunos'))) && (
                      <p className="text-xs text-gray-400 italic">
                        Selecione as abas Calendário, Horários ou Alunos para configurar permissões específicas.
                      </p>
                    )}
                  </fieldset>

                  {editingId && (
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-700">Usuário ativo</span>
                      <button type="button" aria-pressed={formData.ativo} onClick={() => setFormData(prev => ({ ...prev, ativo: !prev.ativo }))} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors border ${formData.ativo ? 'bg-green-500 border-green-500' : 'bg-gray-300 border-gray-300'}`}>
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${formData.ativo ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                  )}
                </form>
                </div>

                {/* Footer Fixo */}
                <div className="flex-shrink-0 p-4 sm:p-6 pt-4 border-t bg-gray-50 rounded-b-lg">
                  <div className="flex justify-end gap-3">
                    <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">Cancelar</button>
                    <button type="submit" form="formUsuario" className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700">{editingId ? 'Atualizar' : 'Cadastrar'}</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Modal de Configuração de Padrões */}
          {showConfigModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-700 bg-opacity-50 p-3 sm:p-4">
              <div className="relative w-full max-w-lg mx-auto bg-white rounded-lg shadow-lg border border-gray-200 flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex-shrink-0 p-4 sm:p-6 pb-4 border-b">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <i className="fas fa-sliders-h text-primary-600 text-lg" aria-hidden="true" />
                      <h3 className="text-base font-semibold text-gray-900">
                        Padrões para {tipoConfigurando.charAt(0).toUpperCase() + tipoConfigurando.slice(1)}
                      </h3>
                    </div>
                    <button type="button" onClick={() => setShowConfigModal(false)} className="text-gray-400 hover:text-gray-600" title="Fechar">
                      <i className="fas fa-times text-lg" aria-hidden="true" />
                    </button>
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    Configure as abas e permissões padrão para novos usuários do tipo <strong>{tipoConfigurando}</strong>.
                  </p>
                </div>

                {/* Conteúdo */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 pt-4 space-y-4">
                  {/* Abas Padrão */}
                  <fieldset className="border border-gray-300 rounded-md px-3 pt-4 pb-3">
                    <legend className="text-xs font-medium text-gray-700 px-1 -mx-1">Abas Padrão</legend>
                    <div className="flex flex-wrap gap-2">
                      {allTabs
                        .filter(t => tipoConfigurando === 'professor' || !professorTabs.includes(t))
                        .map(tab => {
                          const selected = configTemp.abas.includes(tab);
                          const icon = tabIcons[tab];
                          return (
                            <button
                              key={tab}
                              type="button"
                              onClick={() => {
                                setConfigTemp(prev => {
                                  const abas = [...prev.abas];
                                  const idx = abas.indexOf(tab);
                                  if (idx >= 0) abas.splice(idx, 1);
                                  else abas.push(tab);
                                  return { ...prev, abas };
                                });
                              }}
                              className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full transition-colors border ${selected ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                            >
                              {icon && <i className={`fas ${icon} text-[10px] ${selected ? 'text-white' : 'text-gray-400'}`} aria-hidden="true" />}
                              {tabLabels[tab] || tab}
                            </button>
                          );
                        })}
                    </div>
                  </fieldset>

                  {/* Permissões de Calendário */}
                  {configTemp.abas.includes('calendario') && (
                  <fieldset className="border border-gray-300 rounded-md px-3 pt-4 pb-3">
                    <legend className="text-xs font-medium text-gray-700 px-1 -mx-1 flex items-center gap-1">
                      <i className="fas fa-calendar text-gray-400"></i> Calendário
                    </legend>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { key: 'reagendar', label: 'Criar Reagendamento' },
                        { key: 'reposicao', label: 'Agendar Reposição por Falta' },
                        { key: 'aulaExperimental', label: 'Agendar Aula Experimental' }
                      ].map(perm => {
                        const checked = configTemp.permissoes?.calendario?.[perm.key as keyof typeof configTemp.permissoes.calendario] ?? true;
                        return (
                          <label key={perm.key} className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                setConfigTemp(prev => ({
                                  ...prev,
                                  permissoes: {
                                    ...prev.permissoes,
                                    calendario: {
                                      ...prev.permissoes?.calendario,
                                      [perm.key]: e.target.checked
                                    }
                                  }
                                }));
                              }}
                              className="rounded border-gray-300 text-primary-600"
                            />
                            <span className="text-gray-700">{perm.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                  )}

                  {/* Permissões de Horários */}
                  {configTemp.abas.includes('horarios') && (
                  <fieldset className="border border-gray-300 rounded-md px-3 pt-4 pb-3">
                    <legend className="text-xs font-medium text-gray-700 px-1 -mx-1 flex items-center gap-1">
                      <i className="fas fa-clock text-gray-400"></i> Horários
                    </legend>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { key: 'gerenciarTurmas', label: 'Gerenciar Turmas (criar/editar/excluir)' },
                        { key: 'adicionarAluno', label: 'Adicionar Aluno em Turma' },
                        { key: 'removerAluno', label: 'Remover Aluno da Turma' },
                        { key: 'bloquearHorarios', label: 'Bloquear/Desbloquear Horários' },
                        { key: 'importarLote', label: 'Adicionar Alunos em Lote' }
                      ].map(perm => {
                        const checked = configTemp.permissoes?.horarios?.[perm.key as keyof typeof configTemp.permissoes.horarios] ?? true;
                        return (
                          <label key={perm.key} className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                setConfigTemp(prev => ({
                                  ...prev,
                                  permissoes: {
                                    ...prev.permissoes,
                                    horarios: {
                                      ...prev.permissoes?.horarios,
                                      [perm.key]: e.target.checked
                                    }
                                  }
                                }));
                              }}
                              className="rounded border-gray-300 text-primary-600"
                            />
                            <span className="text-gray-700">{perm.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                  )}

                  {/* Permissões de Alunos */}
                  {configTemp.abas.includes('alunos') && (
                  <fieldset className="border border-gray-300 rounded-md px-3 pt-4 pb-3">
                    <legend className="text-xs font-medium text-gray-700 px-1 -mx-1 flex items-center gap-1">
                      <i className="fas fa-users text-gray-400"></i> Alunos
                    </legend>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { key: 'criar', label: 'Criar Aluno' },
                        { key: 'editar', label: 'Editar Aluno' },
                        { key: 'excluir', label: 'Excluir Aluno' }
                      ].map(perm => {
                        const checked = configTemp.permissoes?.alunos?.[perm.key as keyof typeof configTemp.permissoes.alunos] ?? true;
                        return (
                          <label key={perm.key} className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                setConfigTemp(prev => ({
                                  ...prev,
                                  permissoes: {
                                    ...prev.permissoes,
                                    alunos: {
                                      ...prev.permissoes?.alunos,
                                      [perm.key]: e.target.checked
                                    }
                                  }
                                }));
                              }}
                              className="rounded border-gray-300 text-primary-600"
                            />
                            <span className="text-gray-700">{perm.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                  )}
                </div>

                {/* Footer */}
                <div className="flex-shrink-0 p-4 sm:p-6 pt-4 border-t bg-gray-50 rounded-b-lg">
                  <div className="flex justify-between">
                    <button 
                      type="button" 
                      onClick={() => resetarPadroes(tipoConfigurando)} 
                      className="px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 flex items-center gap-1"
                    >
                      <i className="fas fa-undo text-xs"></i>
                      Restaurar Padrões
                    </button>
                    <div className="flex gap-3">
                      <button type="button" onClick={() => setShowConfigModal(false)} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
                        Cancelar
                      </button>
                      <button type="button" onClick={salvarConfigPadroes} className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700">
                        Salvar Padrões
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
    </ProtectedPage>
  );
}
