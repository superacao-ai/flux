import mongoose, { Schema, model, models } from 'mongoose';

// Interface para Falta
export interface IFalta {
  _id?: string;
  horarioFixoId: mongoose.Types.ObjectId;
  data: Date;
  motivo: string;
  justificada: boolean;
  observacoes?: string;
  registradoPor: mongoose.Types.ObjectId; // ID do usuário que registrou
  criadoEm?: Date;
}

// Schema da Falta
const FaltaSchema = new Schema<IFalta>({
  horarioFixoId: {
    type: Schema.Types.ObjectId,
    ref: 'HorarioFixo',
    required: [true, 'ID do horário fixo é obrigatório']
  },
  data: {
    type: Date,
    required: [true, 'Data da falta é obrigatória']
  },
  motivo: {
    type: String,
    required: [true, 'Motivo é obrigatório'],
    trim: true,
    maxlength: [200, 'Motivo deve ter no máximo 200 caracteres']
  },
  justificada: {
    type: Boolean,
    default: false
  },
  observacoes: {
    type: String,
    trim: true,
    maxlength: [300, 'Observações devem ter no máximo 300 caracteres']
  },
  registradoPor: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Usuário que registrou é obrigatório']
  }
}, {
  timestamps: { createdAt: 'criadoEm', updatedAt: false }
});

// Índices
FaltaSchema.index({ horarioFixoId: 1 });
FaltaSchema.index({ data: 1 });
FaltaSchema.index({ registradoPor: 1 });
FaltaSchema.index({ justificada: 1 });

// Índice composto para evitar duplicatas
FaltaSchema.index({ horarioFixoId: 1, data: 1 }, { unique: true });

export const Falta = models.Falta || model<IFalta>('Falta', FaltaSchema);