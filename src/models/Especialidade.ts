import mongoose, { Schema, model, models } from 'mongoose';

// Interface para Especialidade
export interface IEspecialidade {
  _id?: string;
  nome: string;
  descricao?: string;
  ativo: boolean;
  criadoEm?: Date;
  atualizadoEm?: Date;
}

// Schema da Especialidade
const EspecialidadeSchema = new Schema<IEspecialidade>({
  nome: {
    type: String,
    required: [true, 'Nome da especialidade é obrigatório'],
    unique: true,
    trim: true,
    maxlength: [50, 'Nome deve ter no máximo 50 caracteres']
  },
  descricao: {
    type: String,
    trim: true,
    maxlength: [200, 'Descrição deve ter no máximo 200 caracteres']
  },
  ativo: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: { createdAt: 'criadoEm', updatedAt: 'atualizadoEm' }
});

// Índices
EspecialidadeSchema.index({ nome: 1 });
EspecialidadeSchema.index({ ativo: 1 });

export const Especialidade = models.Especialidade || model<IEspecialidade>('Especialidade', EspecialidadeSchema);