import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAlunoAula {
  alunoId: mongoose.Types.ObjectId;
  nome: string;
  presente: boolean | null;
  statusNaEpoca: {
    congelado: boolean;
    ausente: boolean;
    emEspera: boolean;
  };
  era_reagendamento: boolean;
  observacoes?: string;
  avisouComAntecedencia?: boolean;
}

export interface ICorrecao {
  dataCorrecao: Date;
  corrigidoPor: mongoose.Types.ObjectId;
  motivo: string;
  alunoAlterado: mongoose.Types.ObjectId;
  alteracaoAntes: boolean;
  alteracaoDepois: boolean;
}

export interface IAulaRealizada extends Document {
  horarioFixoId: mongoose.Types.ObjectId;
  professorId: mongoose.Types.ObjectId;
  data: Date;
  diaSemana: number;
  modalidade: string;
  horarioInicio: string;
  horarioFim: string;
  
  // Alunos da aula com snapshot
  alunos: IAlunoAula[];
  
  // Metadados do envio
  status: 'pendente' | 'enviada' | 'corrigida' | 'cancelada';
  enviouEm?: Date;
  enviadoPor?: mongoose.Types.ObjectId;
  
  // Cancelamento retroativo
  cancelada?: boolean;
  canceladaEm?: Date;
  canceladaPor?: mongoose.Types.ObjectId;
  motivoCancelamento?: string;
  
  // Histórico de correções
  historicoCorrecoes: ICorrecao[];
  
  // Resumo para queries rápidas
  total_alunos: number;
  total_presentes: number;
  total_faltas: number;
  total_reagendamentos: number;
}

const IAlunoAulaSchema = new Schema<IAlunoAula>(
  {
    alunoId: {
      type: Schema.Types.ObjectId,
      ref: 'Aluno',
      required: true,
    },
    nome: {
      type: String,
      required: true,
    },
    presente: {
      type: Schema.Types.Mixed,
      default: null,
    },
    statusNaEpoca: {
      congelado: Boolean,
      ausente: Boolean,
      emEspera: Boolean,
    },
    era_reagendamento: {
      type: Boolean,
      default: false,
    },
    observacoes: String,
    avisouComAntecedencia: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const ICorrecaoSchema = new Schema<ICorrecao>(
  {
    dataCorrecao: {
      type: Date,
      default: Date.now,
    },
    corrigidoPor: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    motivo: {
      type: String,
      required: true,
    },
    alunoAlterado: {
      type: Schema.Types.ObjectId,
      ref: 'Aluno',
      required: true,
    },
    alteracaoAntes: {
      type: Boolean,
      required: true,
    },
    alteracaoDepois: {
      type: Boolean,
      required: true,
    },
  },
  { _id: false }
);

const AulaRealizadaSchema = new Schema<IAulaRealizada>(
  {
    horarioFixoId: {
      type: Schema.Types.ObjectId,
      ref: 'HorarioFixo',
      required: true,
    },
    professorId: {
      type: Schema.Types.ObjectId,
      ref: 'Professor',
      required: false,
    },
    data: {
      type: Date,
      required: true,
    },
    diaSemana: {
      type: Number,
      required: true,
    },
    modalidade: {
      type: String,
      required: true,
    },
    horarioInicio: {
      type: String,
      required: true,
    },
    horarioFim: {
      type: String,
      required: true,
    },
    
    alunos: [IAlunoAulaSchema],
    
    status: {
      type: String,
      enum: ['pendente', 'enviada', 'corrigida', 'cancelada'],
      default: 'pendente',
    },
    enviouEm: Date,
    enviadoPor: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    
    // Cancelamento retroativo
    cancelada: {
      type: Boolean,
      default: false,
    },
    canceladaEm: Date,
    canceladaPor: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    motivoCancelamento: {
      type: String,
      trim: true,
    },
    
    historicoCorrecoes: [ICorrecaoSchema],
    
    // Resumo denormalizado para queries rápidas
    total_alunos: {
      type: Number,
      default: 0,
    },
    total_presentes: {
      type: Number,
      default: 0,
    },
    total_faltas: {
      type: Number,
      default: 0,
    },
    total_reagendamentos: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Índices para queries de relatório
AulaRealizadaSchema.index({ alunoId: 1, data: 1 }); // Para buscar aulas de um aluno
AulaRealizadaSchema.index({ horarioFixoId: 1, data: 1 }); // Para buscar aula específica
AulaRealizadaSchema.index({ professorId: 1, data: 1 }); // Para relatório do professor
AulaRealizadaSchema.index({ data: 1 }); // Para buscar por período
AulaRealizadaSchema.index({ status: 1, data: 1 }); // Para aulas pendentes
AulaRealizadaSchema.index({ 'alunos.alunoId': 1 }); // Para buscar um aluno em qualquer aula

const AulaRealizada: Model<IAulaRealizada> =
  mongoose.models.AulaRealizada || mongoose.model<IAulaRealizada>('AulaRealizada', AulaRealizadaSchema);

export default AulaRealizada;
