import mongoose, { Schema, model, models, Document } from 'mongoose';

export interface IAviso extends Document {
  titulo: string;
  mensagem: string;
  tipo: 'info' | 'alerta' | 'cancelamento' | 'urgente';
  dataInicio: Date;
  dataFim: Date;
  modalidadesAfetadas?: mongoose.Types.ObjectId[]; // Se vazio, afeta todas
  ativo: boolean;
  criadoPor: mongoose.Types.ObjectId;
  criadoEm: Date;
  atualizadoEm: Date;
}

const AvisoSchema = new Schema<IAviso>({
  titulo: {
    type: String,
    required: [true, 'Título é obrigatório'],
    trim: true,
    maxlength: [100, 'Título deve ter no máximo 100 caracteres']
  },
  mensagem: {
    type: String,
    required: [true, 'Mensagem é obrigatória'],
    trim: true,
    maxlength: [500, 'Mensagem deve ter no máximo 500 caracteres']
  },
  tipo: {
    type: String,
    enum: ['info', 'alerta', 'cancelamento', 'urgente'],
    default: 'info'
  },
  dataInicio: {
    type: Date,
    required: [true, 'Data de início é obrigatória']
  },
  dataFim: {
    type: Date,
    required: [true, 'Data de fim é obrigatória']
  },
  modalidadesAfetadas: [{
    type: Schema.Types.ObjectId,
    ref: 'Modalidade'
  }],
  ativo: {
    type: Boolean,
    default: true
  },
  criadoPor: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: { createdAt: 'criadoEm', updatedAt: 'atualizadoEm' }
});

// Índices
AvisoSchema.index({ dataInicio: 1, dataFim: 1, ativo: 1 });
AvisoSchema.index({ modalidadesAfetadas: 1 });

export const Aviso = models.Aviso || model<IAviso>('Aviso', AvisoSchema);
