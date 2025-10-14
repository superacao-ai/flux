import mongoose, { Schema, model, models } from 'mongoose';

// Interface para o Professor
export interface IProfessor {
  _id?: string;
  nome: string;
  email?: string;
  telefone?: string;
  especialidades: mongoose.Types.ObjectId[]; // Array de especialidades
  ativo: boolean;
  criadoEm?: Date;
  atualizadoEm?: Date;
}

// Schema do Professor
const ProfessorSchema = new Schema<IProfessor>({
  nome: {
    type: String,
    required: [true, 'Nome é obrigatório'],
    trim: true,
    maxlength: [100, 'Nome deve ter no máximo 100 caracteres']
  },
  email: {
    type: String,
    required: false,
    unique: true,
    sparse: true, // Permite múltiplos valores null/undefined
    lowercase: true,
    trim: true,
    validate: {
      validator: function(v: string) {
        // Se o email estiver vazio ou null, é válido
        if (!v || v.trim() === '') return true;
        // Se tiver valor, deve seguir o formato
        return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(v);
      },
      message: 'Email inválido'
    }
  },
  telefone: {
    type: String,
    required: false,
    trim: true,
    validate: {
      validator: function(v: string) {
        // Se o telefone estiver vazio ou null, é válido
        if (!v || v.trim() === '') return true;
        // Se tiver valor, deve seguir o formato
        return /^\(\d{2}\)\s\d{4,5}-\d{4}$/.test(v);
      },
      message: 'Telefone deve estar no formato (11) 99999-9999'
    }
  },
  especialidades: [{
    type: Schema.Types.ObjectId,
    ref: 'Especialidade'
  }],
  ativo: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: { createdAt: 'criadoEm', updatedAt: 'atualizadoEm' }
});

// Índices
ProfessorSchema.index({ email: 1 });
ProfessorSchema.index({ nome: 1 });
ProfessorSchema.index({ ativo: 1 });

export const Professor = models.Professor || model<IProfessor>('Professor', ProfessorSchema);