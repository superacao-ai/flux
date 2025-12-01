'use client';

import Swal from 'sweetalert2';
import { toast } from 'react-toastify';
import { useState, useEffect, useCallback, useMemo } from 'react';
import ProtectedPage from '@/components/ProtectedPage';

interface Usuario {
  _id: string;
  nome: string;
  email?: string;
  telefone?: string;
  cor?: string;
  ativo: boolean;
  tipo?: string;
  abas?: string[];
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
  const allTabs = [
    'calendario', 'horarios', 'alunos', 'usuarios', 'modalidades', 'aulas', 'reagendamentos', 'relatorios', 'backup',
    ...professorTabs
  ];
  const adminExcludedTabs = ['relatorios', 'backup', 'usuarios'];

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
  const [formData, setFormData] = useState<UsuarioForm>({
    nome: '',
    email: '',
    telefone: '',
    cor: '#3B82F6',
    ativo: true,
    senha: ''
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
    setFormData(prev => ({...prev, telefone: e.target.value}));
  }, []);
  const handleAtivoChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({...prev, ativo: e.target.checked}));
  }, []);

  const handleTipoChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const tipo = e.target.value as any;
    setFormData(prev => {
      // when selecting professor, pre-select professor tabs
      if (tipo === 'professor') {
        return { ...prev, tipo, abas: professorTabs };
      }
      if (tipo === 'admin') {
        // select default admin tabs but exclude sensitive tabs (reports, backups, usuarios)
        const adminTabs = allTabs.filter(t => !professorTabs.includes(t) && !adminExcludedTabs.includes(t));
        return { ...prev, tipo, abas: adminTabs };
      }
      if (tipo === 'root') {
        // root should not select professor-only tabs by default (same as admin)
        const adminTabs = allTabs.filter(t => !professorTabs.includes(t));
        return { ...prev, tipo, abas: adminTabs };
      }
      return { ...prev, tipo };
    });
  }, []);

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
    setFormData({ nome: '', email: '', telefone: '', cor: '#3B82F6', ativo: true, senha: '', tipo: '', abas: [], especialidades: [] });
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
    setFormData({ 
      nome: usuario.nome, 
      email: usuario.email || '', 
      telefone: usuario.telefone || '', 
      cor: usuario.cor || '#3B82F6', 
      ativo: usuario.ativo, 
      tipo: (usuario.tipo || 'admin'), 
      abas: usuario.abas || [],
      especialidades: especialidadesIds
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
        <div className="px-4 py-6 sm:px-0">
          <div className="flex items-center justify-between gap-4 fade-in-1">
            <div>
              <h1 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <i className="fas fa-users-cog text-primary-600"></i>
                Usuários
              </h1>
              <p className="mt-2 text-sm text-gray-600 max-w-xl">Gerencie os usuários administradores do sistema — adicione, edite e defina senhas.</p>
            </div>

            <div className="flex items-center gap-3">
              <div>
                <button type="button" onClick={abrirModalNovo} className="transition-colors duration-200 h-10 inline-flex items-center gap-2  rounded-full bg-primary-600 text-white px-4 text-sm font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <i className="fas fa-user-plus w-4 text-white " aria-hidden="true" />
                  Novo Usuário
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 sm:mt-6 fade-in-2">
            <div className="flex items-center justify-between gap-4">
              <div className="relative w-full sm:w-1/2">
                <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 w-4 text-gray-400" aria-hidden="true" />
                <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Pesquisar por nome, email ou telefone..." className="block w-full pl-10 pr-3 border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 bg-white" />
              </div>
              <div className="hidden sm:flex items-center text-sm text-gray-600">
                <div>Resultados: {filteredUsuarios.length}</div>
              </div>
            </div>
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
              <button onClick={abrirModalNovo} className="h-10 inline-flex items-center gap-2 rounded-md bg-primary-600 text-white px-4 text-sm font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500">
                <i className="fas fa-user-plus" aria-hidden="true" /> Cadastrar Usuário
              </button>
            </div>
          ) : (
            <div className="mt-8 flex flex-col fade-in-3">
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
                                <span className={`inline-flex items-center gap-2 justify-center text-sm ${usuario.tipo === 'professor' ? 'text-primary-700' : 'text-gray-700'}`}>
                                  {usuario.tipo === 'professor' ? 'Professor' : 'Admin'}
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
          )}

          {/* Modal de Cadastro/Edição */}
          {showModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-700 bg-opacity-50">
              <div className="relative w-full max-w-lg mx-auto bg-white rounded-lg shadow-lg border border-gray-200 p-6">
                <div className="mb-2 border-b pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {editingId ? (
                        <i className="fas fa-edit text-green-600 text-lg" aria-hidden="true" />
                      ) : (
                        <i className="fas fa-users-cog text-green-600 text-lg" aria-hidden="true" />
                      )}
                      <h3 className="text-base font-semibold text-gray-900">{editingId ? 'Editar Usuário' : 'Novo Usuário'}</h3>
                    </div>
                    <button type="button" onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 focus:outline-none" title="Fechar"><i className="fas fa-times text-lg" aria-hidden="true" /></button>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <i className="fas fa-info-circle text-green-600 text-sm" aria-hidden="true" />
                    <span className="text-sm font-medium text-gray-500">Preencha os dados do usuário administrador.</span>
                  </div>
                </div>
                <form className="space-y-1" noValidate onSubmit={(e) => { e.preventDefault(); salvarUsuario(); }}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                      <input type="text" value={formData.nome} onChange={handleNomeChange} className="block w-full h-10 border border-gray-300 rounded-md px-3 py-2 text-sm font-medium focus:outline-none focus:ring-primary-500 focus:border-primary-500" placeholder="Nome completo" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                      <input type="email" value={formData.email} onChange={handleEmailChange} className="block w-full h-10 border border-gray-300 rounded-md px-3 py-2 text-sm font-medium focus:outline-none focus:ring-primary-500 focus:border-primary-500" placeholder="email@exemplo.com" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de usuário *</label>
                      <select value={formData.tipo || ''} onChange={handleTipoChange} className="block w-full h-10 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500">
                        <option value="">— selecione —</option>
                        <option value="admin">Administrador</option>
                        <option value="professor">Professor</option>
                        {currentUserTipo === 'root' && <option value="root">ROOT</option>}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Telefone <span className="text-gray-400 text-sm font-medium">(opcional)</span></label>
                      <input type="tel" value={formData.telefone} onChange={handleTelefoneChange} className="block w-full h-10 border border-gray-300 rounded-md px-3 py-2 text-sm font-medium focus:outline-none focus:ring-primary-500 focus:border-primary-500" placeholder="(11) 99999-9999" />
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
                    <input type="password" value={formData.senha || ''} onChange={(e) => setFormData(prev => ({ ...prev, senha: e.target.value }))} className="block w-full h-10 border border-gray-300 rounded-md px-3 py-2 text-sm font-medium focus:outline-none focus:ring-primary-500 focus:border-primary-500" placeholder={editingId ? 'Deixe em branco para manter a atual' : 'Senha (mín 6 caracteres)'} />
                  </div>

                  <div className="mt-6">
                    <div className="flex items-center gap-2">
                      <label className="block text-sm font-medium text-gray-700">Cor</label>
                      <div className="flex flex-wrap gap-1 p-1 bg-gray-50 border border-gray-200 rounded-md">
                        {coresSugeridas.map((cor) => (
                          <button key={cor} type="button" onClick={() => setFormData(prev => ({ ...prev, cor: cor }))} className={`relative h-6 w-6 rounded-full border flex items-center justify-center transition-all duration-150 hover:scale-105 hover:border-primary-400 focus:outline-none ${formData.cor === cor ? 'border-primary-600 ring-2 ring-primary-400' : 'border-gray-300'}`} style={{ backgroundColor: cor }} title={cor}>
                            {formData.cor === cor && (<span className="absolute inset-0 flex items-center justify-center"><i className="fas fa-check text-white text-[10px] drop-shadow" /></span>)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <fieldset className="mt-6 border border-gray-300 rounded-md px-3 pt-4 pb-3">
                    <legend className="text-xs font-medium text-gray-700 px-1 -mx-1">Acesso às abas</legend>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { key: 'calendario', label: 'Calendário' },
                        { key: 'horarios', label: 'Horários' },
                        { key: 'alunos', label: 'Alunos' },
                        { key: 'usuarios', label: 'Usuários' },
                        { key: 'modalidades', label: 'Modalidades' },
                        { key: 'aulas', label: 'Aulas' },
                        { key: 'reagendamentos', label: 'Reagendamentos' },
                        { key: 'relatorios', label: 'Relatórios' },
                        { key: 'backup', label: 'Backups' },
                        { key: 'professor:minhaagenda', label: 'P: Minha Agenda' },
                        { key: 'professor:alunos', label: 'P: Meus Alunos' },
                        { key: 'professor:aulas', label: 'P: Minhas Aulas' }
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
                            className={`inline-flex items-center gap-2 text-xs px-2 py-1 rounded-full transition-colors border ${selected ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-2 text-xs text-gray-500">Clique para selecionar as abas que o usuário pode acessar.</div>
                  </fieldset>

                  {editingId && (
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-sm font-medium text-gray-700">Usuário ativo</span>
                      <button type="button" aria-pressed={formData.ativo} onClick={() => setFormData(prev => ({ ...prev, ativo: !prev.ativo }))} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none border ${formData.ativo ? 'bg-green-500 border-green-500' : 'bg-gray-300 border-gray-300'}`}>
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${formData.ativo ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-4 border-t mt-2">
                    <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">Cancelar</button>
                    <button type="submit" className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700">{editingId ? 'Atualizar' : 'Cadastrar'}</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
    </ProtectedPage>
  );
}
