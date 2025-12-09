import mongoose, { Schema, Document } from 'mongoose';

export interface IConfiguracao extends Document {
  chave: string;
  valor: string | boolean;
  descricao?: string;
  atualizadoEm: Date;
}

const ConfiguracaoSchema = new Schema({
  chave: {
    type: String,
    required: true,
    unique: true
  },
  valor: {
    type: Schema.Types.Mixed, // Aceita boolean ou string
    default: ''
  },
  descricao: {
    type: String
  },
  atualizadoEm: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Força recompilação do modelo se já existe (importante após mudar schema)
if (mongoose.models.Configuracao) {
  delete mongoose.models.Configuracao;
}

export const Configuracao = mongoose.model<IConfiguracao>('Configuracao', ConfiguracaoSchema);
