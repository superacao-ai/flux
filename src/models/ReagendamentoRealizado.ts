import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IReagendamentoRealizado extends Document {
  reagendamentoId: mongoose.Types.ObjectId;
  alunoId: mongoose.Types.ObjectId;
  aulaRealizadaId?: mongoose.Types.ObjectId; // Ref para a aula do reagendamento
  
  // Dados do reagendamento
  dataOriginal: Date;
  novaData: Date;
  horarioOriginal: string;
  horarioNovo: string;
  modalidade: string;
  
  // Controle de presença
  presente_no_reagendamento: boolean | null;
  marcadoEm?: Date;
  observacoes?: string;
  
  // Status
  status: 'pendente' | 'realizado' | 'falta_registrada' | 'nao_realizado';
  
  // Rastreamento
  registradoPor?: mongoose.Types.ObjectId;
  registradoEm: Date;
}

const ReagendamentoRealizadoSchema = new Schema<IReagendamentoRealizado>(
  {
    reagendamentoId: {
      type: Schema.Types.ObjectId,
      ref: 'Reagendamento',
      required: true,
    },
    alunoId: {
      type: Schema.Types.ObjectId,
      ref: 'Aluno',
      required: true,
    },
    aulaRealizadaId: {
      type: Schema.Types.ObjectId,
      ref: 'AulaRealizada',
    },
    
    dataOriginal: {
      type: Date,
      required: true,
    },
    novaData: {
      type: Date,
      required: true,
    },
    horarioOriginal: {
      type: String,
      required: true,
    },
    horarioNovo: {
      type: String,
      required: true,
    },
    modalidade: {
      type: String,
      required: true,
    },
    
    presente_no_reagendamento: {
      type: Boolean,
      default: null,
    },
    marcadoEm: Date,
    observacoes: String,
    
    status: {
      type: String,
      enum: ['pendente', 'realizado', 'falta_registrada', 'nao_realizado'],
      default: 'pendente',
    },
    
    registradoPor: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    registradoEm: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Índices para queries de rastreamento
ReagendamentoRealizadoSchema.index({ alunoId: 1 }); // Todos os reagendamentos de um aluno
ReagendamentoRealizadoSchema.index({ alunoId: 1, status: 1 }); // Reagendamentos pendentes de um aluno
ReagendamentoRealizadoSchema.index({ novaData: 1 }); // Reagendamentos por data
ReagendamentoRealizadoSchema.index({ status: 1 }); // Todos os pendentes do sistema
ReagendamentoRealizadoSchema.index({ reagendamentoId: 1, alunoId: 1 }, { unique: true }); // Evita duplicatas

const ReagendamentoRealizado: Model<IReagendamentoRealizado> =
  mongoose.models.ReagendamentoRealizado ||
  mongoose.model<IReagendamentoRealizado>('ReagendamentoRealizado', ReagendamentoRealizadoSchema);

export default ReagendamentoRealizado;
