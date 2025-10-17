import mongoose, { Schema, model, models } from 'mongoose';

// Interface para Horário Fixo
export interface IHorarioFixo {
  _id?: string;
  alunoId?: mongoose.Types.ObjectId | null;
  modalidadeId?: mongoose.Types.ObjectId | null;
  professorId: mongoose.Types.ObjectId;
  diaSemana: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Domingo
  horarioInicio: string; // HH:MM
  horarioFim: string; // HH:MM
  ativo: boolean;
  observacoes?: string;
  observacaoTurma?: string;
  criadoEm?: Date;
  atualizadoEm?: Date;
}

// Schema do Horário Fixo
const HorarioFixoSchema = new Schema<IHorarioFixo>({
  alunoId: {
    type: Schema.Types.ObjectId,
    ref: 'Aluno',
    required: false
  },
  modalidadeId: {
    type: Schema.Types.ObjectId,
    ref: 'Modalidade',
    required: false
  },
  professorId: {
    type: Schema.Types.ObjectId,
    ref: 'Professor',
    required: [true, 'ID do professor é obrigatório']
  },
  diaSemana: {
    type: Number,
    required: [true, 'Dia da semana é obrigatório'],
    min: [0, 'Dia da semana deve ser entre 0 (Domingo) e 6 (Sábado)'],
    max: [6, 'Dia da semana deve ser entre 0 (Domingo) e 6 (Sábado)']
  },
  horarioInicio: {
    type: String,
    required: [true, 'Horário de início é obrigatório'],
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Horário deve estar no formato HH:MM']
  },
  horarioFim: {
    type: String,
    required: [true, 'Horário de fim é obrigatório'],
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Horário deve estar no formato HH:MM']
  },
  ativo: {
    type: Boolean,
    default: true
  },
  observacoes: {
    type: String,
    trim: true,
    maxlength: [300, 'Observações devem ter no máximo 300 caracteres']
  }
  ,
  observacaoTurma: {
    type: String,
    trim: true,
    maxlength: [300, 'Observações da turma devem ter no máximo 300 caracteres']
  }
}, {
  timestamps: { createdAt: 'criadoEm', updatedAt: 'atualizadoEm' }
});

// Índices
HorarioFixoSchema.index({ alunoId: 1 });
HorarioFixoSchema.index({ professorId: 1 });
HorarioFixoSchema.index({ diaSemana: 1, horarioInicio: 1 });
HorarioFixoSchema.index({ ativo: 1 });

// Validação para evitar que o MESMO ALUNO tenha conflito de horário (não professor)
// Unique constraint only when alunoId exists (prevents duplicate aluno entries for same slot)
// Make the unique constraint include modalidadeId so the same aluno can have
// slots at the same dia/hora for different modalidades without hitting a duplicate key.
HorarioFixoSchema.index(
  { alunoId: 1, diaSemana: 1, horarioInicio: 1, modalidadeId: 1 },
  { 
    unique: true,
    // Only apply uniqueness when alunoId exists and is not null, and the record is active.
    partialFilterExpression: { alunoId: { $exists: true, $ne: null }, ativo: true }
  }
);

export const HorarioFixo = models.HorarioFixo || model<IHorarioFixo>('HorarioFixo', HorarioFixoSchema);