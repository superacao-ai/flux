import mongoose, { Schema, model, models } from 'mongoose';

// Interface para Reagendamento
export interface IReagendamento {
  _id?: string;
  horarioFixoId: mongoose.Types.ObjectId;
  dataOriginal: Date;
  novaData: Date;
  novoHorarioInicio: string;
  novoHorarioFim: string;
  motivo: string;
  status: 'pendente' | 'aprovado' | 'rejeitado';
  aprovadoPor?: mongoose.Types.ObjectId;
  criadoEm?: Date;
  atualizadoEm?: Date;
}

// Schema do Reagendamento
const ReagendamentoSchema = new Schema<IReagendamento>({
  horarioFixoId: {
    type: Schema.Types.ObjectId,
    ref: 'HorarioFixo',
    required: [true, 'ID do horário fixo é obrigatório']
  },
  dataOriginal: {
    type: Date,
    required: [true, 'Data original é obrigatória']
  },
  novaData: {
    type: Date,
    required: [true, 'Nova data é obrigatória']
  },
  novoHorarioInicio: {
    type: String,
    required: [true, 'Novo horário de início é obrigatório'],
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Horário deve estar no formato HH:MM']
  },
  novoHorarioFim: {
    type: String,
    required: [true, 'Novo horário de fim é obrigatório'],
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Horário deve estar no formato HH:MM']
  },
  motivo: {
    type: String,
    required: [true, 'Motivo é obrigatório'],
    trim: true,
    maxlength: [200, 'Motivo deve ter no máximo 200 caracteres']
  },
  status: {
    type: String,
    required: [true, 'Status é obrigatório'],
    enum: ['pendente', 'aprovado', 'rejeitado'],
    default: 'pendente'
  },
  aprovadoPor: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: { createdAt: 'criadoEm', updatedAt: 'atualizadoEm' }
});

// Índices
ReagendamentoSchema.index({ horarioFixoId: 1 });
ReagendamentoSchema.index({ status: 1 });
ReagendamentoSchema.index({ dataOriginal: 1 });
ReagendamentoSchema.index({ novaData: 1 });

export const Reagendamento = models.Reagendamento || model<IReagendamento>('Reagendamento', ReagendamentoSchema);