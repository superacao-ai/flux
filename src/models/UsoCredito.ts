import mongoose, { Schema, model, models } from 'mongoose';

export interface IUsoCredito {
  _id?: string;
  creditoId: mongoose.Types.ObjectId;
  alunoId: mongoose.Types.ObjectId; // Denormalizado para facilitar queries
  agendamentoId?: mongoose.Types.ObjectId; // HorarioFixo ou outro tipo de agendamento
  tipoAgendamento: 'horarioFixo' | 'reposicao' | 'aula'; // Tipo de agendamento onde foi usado
  dataUso: Date;
  observacao?: string; // Observações sobre o uso (opcional)
  criadoEm: Date;
}

const UsoCreditoSchema = new Schema<IUsoCredito>(
  {
    creditoId: {
      type: Schema.Types.ObjectId,
      ref: 'CreditoReposicao',
      required: [true, 'Crédito é obrigatório'],
      index: true
    },
    alunoId: {
      type: Schema.Types.ObjectId,
      ref: 'Aluno',
      required: [true, 'Aluno é obrigatório'],
      index: true
    },
    agendamentoId: {
      type: Schema.Types.ObjectId,
      required: false,
      index: true
    },
    tipoAgendamento: {
      type: String,
      enum: ['horarioFixo', 'reposicao', 'aula'],
      default: 'horarioFixo'
    },
    dataUso: {
      type: Date,
      required: [true, 'Data de uso é obrigatória'],
      default: Date.now,
      index: true
    },
    observacao: {
      type: String,
      trim: true,
      maxlength: [300, 'Observação deve ter no máximo 300 caracteres']
    }
  },
  {
    timestamps: { createdAt: 'criadoEm', updatedAt: false }
  }
);

// Índice composto para queries eficientes
UsoCreditoSchema.index({ creditoId: 1, dataUso: -1 });
UsoCreditoSchema.index({ alunoId: 1, dataUso: -1 });

export default models.UsoCredito || model<IUsoCredito>('UsoCredito', UsoCreditoSchema);
