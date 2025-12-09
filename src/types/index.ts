export interface User {
  id: string;
  nome: string;
  email: string;
  senha: string;
  tipo: 'admin' | 'professor';
  ativo: boolean;
  criadoEm: Date;
  atualizadoEm: Date;
}

export interface Aluno {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  endereco?: string;
  observacoes?: string;
  periodoTreino?: string | null;
  parceria?: string | null;
  congelado?: boolean;
  ausente?: boolean;
  emEspera?: boolean;
  ativo: boolean;
  criadoEm: Date;
  atualizadoEm: Date;
}

export interface Professor {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  especialidade?: string;
  ativo: boolean;
  criadoEm: Date;
  atualizadoEm: Date;
}

export interface HorarioFixo {
  id: string;
  alunoId: string;
  professorId: string;
  diaSemana: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Domingo
  horarioInicio: string; // HH:MM
  horarioFim: string; // HH:MM
  ativo: boolean;
  observacoes?: string;
  limiteAlunos?: number; // Limite específico da turma (sobrescreve modalidade)
  criadoEm: Date;
  atualizadoEm: Date;
}

export interface Reagendamento {
  id: string;
  horarioFixoId: string;
  dataOriginal: Date;
  novaData: Date;
  novoHorarioInicio: string;
  novoHorarioFim: string;
  motivo: string;
  status: 'pendente' | 'aprovado' | 'rejeitado';
  criadoEm: Date;
  atualizadoEm: Date;
}

export interface Falta {
  id: string;
  horarioFixoId: string;
  data: Date;
  motivo: string;
  justificada: boolean;
  observacoes?: string;
  registradoPor: string; // ID do usuário
  criadoEm: Date;
}

export interface Relatorio {
  periodo: {
    inicio: Date;
    fim: Date;
  };
  totalAulas: number;
  totalFaltas: number;
  totalReagendamentos: number;
  percentualFrequencia: number;
  alunosAtivos: number;
  professoresAtivos: number;
}