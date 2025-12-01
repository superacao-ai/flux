import mongoose, { Schema, model, models } from 'mongoose';

// Interface para o Usuário
export interface IUser {
  _id?: string;
  nome: string;
  email: string;
  senha: string;
  tipo: 'admin' | 'professor' | 'root';
  ativo: boolean;
  abas?: string[];
  telefone?: string;
  cor?: string;
  especialidades?: string[];
  modalidadeId?: string | null;
  criadoEm?: Date;
  atualizadoEm?: Date;
}

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
    enum: ['admin', 'professor', 'root'],
    default: 'professor'
  },
  ativo: {
    type: Boolean,
    default: true
  }
  ,
  abas: {
    type: [String],
    default: []
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