import mongoose, { Schema, model, models } from 'mongoose';

// Interface para o Usuário
export interface IUser {
  _id?: string;
  nome: string;
  email: string;
  senha: string;
  tipo: 'admin' | 'professor';
  ativo: boolean;
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
    enum: ['admin', 'professor'],
    default: 'professor'
  },
  ativo: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: { createdAt: 'criadoEm', updatedAt: 'atualizadoEm' }
});

// Índices
UserSchema.index({ email: 1 });
UserSchema.index({ tipo: 1, ativo: 1 });

export const User = models.User || model<IUser>('User', UserSchema);