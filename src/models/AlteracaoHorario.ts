import mongoose, { Schema, model, models, Document } from 'mongoose';

export interface IAlteracaoHorario extends Document {
  alunoId: mongoose.Types.ObjectId;
  matriculaId: mongoose.Types.ObjectId;
  horarioAtualId: mongoose.Types.ObjectId;
  novoHorarioId: mongoose.Types.ObjectId;
  motivo?: string;
  status: 'pendente' | 'aprovado' | 'rejeitado';
  motivoRejeicao?: string;
  aprovadoPor?: mongoose.Types.ObjectId;
  criadoEm: Date;
  atualizadoEm: Date;
}

const AlteracaoHorarioSchema = new Schema<IAlteracaoHorario>({
  alunoId: {
    type: Schema.Types.ObjectId,
    ref: 'Aluno',
    required: [true, 'Aluno é obrigatório']
  },
  matriculaId: {
    type: Schema.Types.ObjectId,
    ref: 'Matricula',
    required: [true, 'Matrícula é obrigatória']
  },
  horarioAtualId: {
    type: Schema.Types.ObjectId,
    ref: 'HorarioFixo',
    required: [true, 'Horário atual é obrigatório']
  },
  novoHorarioId: {
    type: Schema.Types.ObjectId,
    ref: 'HorarioFixo',
    required: [true, 'Novo horário é obrigatório']
  },
  motivo: {
    type: String,
    trim: true,
    maxlength: [300, 'Motivo deve ter no máximo 300 caracteres']
  },
  status: {
    type: String,
    enum: ['pendente', 'aprovado', 'rejeitado'],
    default: 'pendente'
  },
  motivoRejeicao: {
    type: String,
    trim: true
  },
  aprovadoPor: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: { createdAt: 'criadoEm', updatedAt: 'atualizadoEm' }
});

// Índices
AlteracaoHorarioSchema.index({ alunoId: 1, status: 1 });
AlteracaoHorarioSchema.index({ status: 1, criadoEm: -1 });
AlteracaoHorarioSchema.index({ horarioAtualId: 1 });

export const AlteracaoHorario = models.AlteracaoHorario || model<IAlteracaoHorario>('AlteracaoHorario', AlteracaoHorarioSchema);
