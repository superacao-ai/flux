import mongoose, { Schema, model, models } from 'mongoose';

// Interface para permissões granulares por módulo
export interface IPermissoes {
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

// Interface para o Usuário
export interface IUser {
  _id?: string;
  nome: string;
  email: string;
  senha: string;
  tipo: 'admin' | 'professor' | 'root' | 'vendedor';
  ativo: boolean;
  abas?: string[];
  permissoes?: IPermissoes;
  telefone?: string;
  cor?: string;
  especialidades?: string[];
  modalidadeId?: string | null;
  criadoEm?: Date;
  atualizadoEm?: Date;
}

// Schema de permissões
const PermissoesSchema = new Schema({
  calendario: {
    verDetalhes: { type: Boolean, default: true },
    registrarPresenca: { type: Boolean, default: true },
    registrarFalta: { type: Boolean, default: true },
    reagendar: { type: Boolean, default: true },
    reposicao: { type: Boolean, default: true },
    aulaExperimental: { type: Boolean, default: true }
  },
  horarios: {
    gerenciarTurmas: { type: Boolean, default: true },
    adicionarAluno: { type: Boolean, default: true },
    removerAluno: { type: Boolean, default: true },
    bloquearHorarios: { type: Boolean, default: true },
    importarLote: { type: Boolean, default: true }
  },
  alunos: {
    criar: { type: Boolean, default: true },
    editar: { type: Boolean, default: true },
    excluir: { type: Boolean, default: true },
    verDetalhes: { type: Boolean, default: true }
  }
}, { _id: false });

// Schema do Usuário
const UserSchema = new Schema<IUser>({
  nome: {
    type: String,
    required: [true, 'Nome é obrigatório'],
    trim: true,
    maxlength: [100, 'Nome deve ter no máximo 100 caracteres']
  },
  email: {
    type: String,
    required: [true, 'Email é obrigatório'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Email inválido']
  },
  senha: {
    type: String,
    required: [true, 'Senha é obrigatória'],
    minlength: [6, 'Senha deve ter no mínimo 6 caracteres']
  },
  tipo: {
    type: String,
    required: [true, 'Tipo de usuário é obrigatório'],
    enum: ['admin', 'professor', 'root', 'vendedor'],
    default: 'professor'
  },
  ativo: {
    type: Boolean,
    default: true
  },
  abas: {
    type: [String],
    default: []
  },
  permissoes: {
    type: PermissoesSchema,
    default: () => ({})
  },
  telefone: {
    type: String,
    trim: true,
    default: ''
  },
  especialidades: [{
    type: Schema.Types.ObjectId,
    ref: 'Especialidade',
    default: []
  }],
  modalidadeId: {
    type: Schema.Types.ObjectId,
    ref: 'Modalidade',
    default: null
  },
  cor: {
    type: String,
    trim: true,
    default: ''
  }
}, {
  timestamps: { createdAt: 'criadoEm', updatedAt: 'atualizadoEm' }
});

// Índices
// `email` field already has unique:true; avoid duplicate index declaration
UserSchema.index({ tipo: 1, ativo: 1 });

export const User = models.User || model<IUser>('User', UserSchema);