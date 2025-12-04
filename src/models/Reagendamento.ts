import mongoose, { Schema, model, models } from 'mongoose';

// Interface para Reagendamento
export interface IReagendamento {
  _id?: string;
  horarioFixoId: mongoose.Types.ObjectId;
  dataOriginal: Date;
  novaData: Date;
  novoHorarioInicio: string;
  novoHorarioFim: string;
  matriculaId?: mongoose.Types.ObjectId;
  // Optional: reference to an existing HorarioFixo that will receive the aluno
  novoHorarioFixoId?: mongoose.Types.ObjectId;
  professorOrigemId?: mongoose.Types.ObjectId | null;
  motivo: string;
  status: 'pendente' | 'aprovado' | 'rejeitado';
  aprovadoPor?: mongoose.Types.ObjectId;
  criadoEm?: Date;
  atualizadoEm?: Date;
  // Reposição de falta - quando true, indica que é uma reposição por falta (não reagendamento preventivo)
  isReposicao?: boolean;
  // ID da aula realizada onde a falta foi registrada (para vincular a reposição à falta original)
  aulaRealizadaId?: mongoose.Types.ObjectId;
  // ID do aluno (para reposições, identificamos diretamente o aluno)
  alunoId?: mongoose.Types.ObjectId;
  // Quem solicitou o reagendamento: 'aluno' (autoatendimento) ou 'admin' (administrador/professor)
  solicitadoPor?: 'aluno' | 'admin';
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
  novoHorarioFixoId: {
    type: Schema.Types.ObjectId,
    ref: 'HorarioFixo',
    required: false
  },
  // If the reagendamento references a specific matricula (student instance in a turma), store it
  matriculaId: {
    type: Schema.Types.ObjectId,
    ref: 'Matricula',
    required: false
  },
  // Professor de origem (capturado automaticamente ao criar o reagendamento)
  professorOrigemId: {
    type: Schema.Types.ObjectId,
    ref: 'Professor',
    required: false
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
  isReposicao: { type: Boolean, default: false },
  // Quem solicitou o reagendamento
  solicitadoPor: {
    type: String,
    enum: ['aluno', 'admin'],
    default: 'admin'
  },
  // ID da aula realizada onde a falta foi registrada
  aulaRealizadaId: {
    type: Schema.Types.ObjectId,
    ref: 'AulaRealizada',
    required: false
  },
  // ID do aluno (para reposições)
  alunoId: {
    type: Schema.Types.ObjectId,
    ref: 'Aluno',
    required: false
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