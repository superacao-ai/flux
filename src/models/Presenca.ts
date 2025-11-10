import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPresenca extends Document {
  alunoId: mongoose.Types.ObjectId;
  horarioFixoId: mongoose.Types.ObjectId;
  professorId: mongoose.Types.ObjectId;
  data: Date;
  presente: boolean;
  observacoes?: string;
  registradoEm: Date;
  registradoPor: mongoose.Types.ObjectId;
}

const PresencaSchema = new Schema<IPresenca>(
  {
    alunoId: {
      type: Schema.Types.ObjectId,
      ref: 'Aluno',
      required: true,
    },
    horarioFixoId: {
      type: Schema.Types.ObjectId,
      ref: 'HorarioFixo',
      required: true,
    },
    professorId: {
      type: Schema.Types.ObjectId,
      ref: 'Professor',
      required: true,
    },
    data: {
      type: Date,
      required: true,
    },
    presente: {
      type: Boolean,
      required: true,
    },
    observacoes: {
      type: String,
      default: '',
    },
    registradoEm: {
      type: Date,
      default: Date.now,
    },
    registradoPor: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Índices para performance
PresencaSchema.index({ alunoId: 1, data: 1 });
PresencaSchema.index({ horarioFixoId: 1, data: 1 });
PresencaSchema.index({ professorId: 1, data: 1 });
PresencaSchema.index({ data: 1 });

// Índice composto único para evitar duplicatas
PresencaSchema.index(
  { alunoId: 1, horarioFixoId: 1, data: 1 },
  { unique: true }
);

const Presenca: Model<IPresenca> =
  mongoose.models.Presenca || mongoose.model<IPresenca>('Presenca', PresencaSchema);

export default Presenca;
