// Tipos de permissões
export interface Permissoes {
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
    removerAluno?: boolean;
    bloquearHorarios?: boolean;
    importarLote?: boolean;
  };
  alunos?: {
    criar?: boolean;
    editar?: boolean;
    excluir?: boolean;
    verDetalhes?: boolean;
  };
}

// Função para obter usuário do localStorage
export function getUser(): { tipo?: string; permissoes?: Permissoes } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Verifica se o usuário é root ou admin (tem todas as permissões)
export function isRootOrAdmin(): boolean {
  const user = getUser();
  const tipo = user?.tipo?.toLowerCase();
  return tipo === 'root' || tipo === 'admin' || tipo === 'adm';
}

// Verifica uma permissão específica
export function temPermissao(
  modulo: keyof Permissoes,
  acao: string
): boolean {
  // Root e admin sempre têm todas as permissões
  if (isRootOrAdmin()) return true;
  
  const user = getUser();
  if (!user?.permissoes) return true; // Se não tem permissões definidas, permite tudo (compatibilidade)
  
  const permissoesModulo = user.permissoes[modulo];
  if (!permissoesModulo) return true; // Se módulo não está definido, permite
  
  const valor = (permissoesModulo as any)[acao];
  return valor !== false; // Permite se não está explicitamente definido como false
}

// Helpers específicos para cada módulo

// Calendário
export const permissoesCalendario = {
  verDetalhes: () => temPermissao('calendario', 'verDetalhes'),
  registrarPresenca: () => temPermissao('calendario', 'registrarPresenca'),
  registrarFalta: () => temPermissao('calendario', 'registrarFalta'),
  reagendar: () => temPermissao('calendario', 'reagendar'),
  reposicao: () => temPermissao('calendario', 'reposicao'),
  aulaExperimental: () => temPermissao('calendario', 'aulaExperimental'),
};

// Horários
export const permissoesHorarios = {
  gerenciarTurmas: () => temPermissao('horarios', 'gerenciarTurmas'),
  adicionarAluno: () => temPermissao('horarios', 'adicionarAluno'),
  removerAluno: () => temPermissao('horarios', 'removerAluno'),
  bloquearHorarios: () => temPermissao('horarios', 'bloquearHorarios'),
  importarLote: () => temPermissao('horarios', 'importarLote'),
};

// Alunos
export const permissoesAlunos = {
  criar: () => temPermissao('alunos', 'criar'),
  editar: () => temPermissao('alunos', 'editar'),
  excluir: () => temPermissao('alunos', 'excluir'),
  verDetalhes: () => temPermissao('alunos', 'verDetalhes'),
};
