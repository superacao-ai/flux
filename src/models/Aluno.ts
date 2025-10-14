import mongoose, { Schema, model, models } from 'mongoose';

// Interface para o Aluno
export interface IAluno {
  _id?: string;
  nome: string;
  email?: string;
  telefone?: string;
  endereco?: string;
  modalidadeId?: mongoose.Types.ObjectId; // Referência à modalidade (opcional)
  plano?: string; // Para modalidades que têm planos diferentes (ex: treino)
  observacoes?: string;
  ativo: boolean;
  criadoEm?: Date;
  atualizadoEm?: Date;
}

// Schema do Aluno
const AlunoSchema = new Schema<IAluno>({
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
    default: 'Não informado',
    trim: true,
    validate: {
      validator: function(v: string) {
        // Se estiver vazio, null ou "Não informado", é válido
        if (!v || v.trim() === '' || v === 'Não informado') return true;
        // Se tiver valor, deve seguir o formato
        return /^\(\d{2}\)\s\d{4,5}-\d{4}$/.test(v);
      },
      message: 'Telefone deve estar no formato (11) 99999-9999 ou "Não informado"'
    }
  },
  endereco: {
    type: String,
    trim: true,
    maxlength: [200, 'Endereço deve ter no máximo 200 caracteres']
  },
  modalidadeId: {
    type: Schema.Types.ObjectId,
    ref: 'Modalidade',
    required: false // Permite ser opcional durante criação
  },
  plano: {
    type: String,
    trim: true,
    maxlength: [50, 'Plano deve ter no máximo 50 caracteres']
  },
  observacoes: {
    type: String,
    trim: true,
    maxlength: [500, 'Observações devem ter no máximo 500 caracteres']
  },
  ativo: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: { createdAt: 'criadoEm', updatedAt: 'atualizadoEm' }
});

// Índices
AlunoSchema.index({ email: 1 });
AlunoSchema.index({ nome: 1 });
AlunoSchema.index({ ativo: 1 });

export const Aluno = models.Aluno || model<IAluno>('Aluno', AlunoSchema);