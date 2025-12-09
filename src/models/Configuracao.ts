import mongoose, { Schema, Document } from 'mongoose';

export interface IConfiguracao extends Document {
  chave: string;
  valor: boolean;
  descricao?: string;
  atualizadoEm: Date;
}

const ConfiguracaoSchema = new Schema({
  chave: {
    type: String,
    required: true,
    unique: true,
    enum: [
      'aprovacaoAutomaticaReagendamento',
      'aprovacaoAutomaticaCreditos', 
      'aprovacaoAutomaticaReposicao',
      'aprovacaoAutomaticaAlteracaoHorario'
    ]
  },
  valor: {
    type: Boolean,
    default: false
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

export const Configuracao = mongoose.models.Configuracao || mongoose.model<IConfiguracao>('Configuracao', ConfiguracaoSchema);
