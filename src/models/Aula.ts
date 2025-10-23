import mongoose, { Schema, model, models } from 'mongoose';

export interface IAula {
  horarioFixoId?: mongoose.Types.ObjectId;
  professorId?: mongoose.Types.ObjectId;
  data?: Date;
  ministrada?: boolean;
  presencas?: Array<{ alunoId: mongoose.Types.ObjectId; presente: boolean }>;
  criadoEm?: Date;
  atualizadoEm?: Date;
}

const AulaSchema = new Schema<IAula>({
  horarioFixoId: { type: Schema.Types.ObjectId, ref: 'HorarioFixo' },
  professorId: { type: Schema.Types.ObjectId, ref: 'Professor' },
  data: { type: Date, default: () => new Date() },
  ministrada: { type: Boolean, default: false },
  presencas: [{ alunoId: { type: Schema.Types.ObjectId, ref: 'Aluno' }, presente: { type: Boolean, default: false } }]
}, {
  timestamps: { createdAt: 'criadoEm', updatedAt: 'atualizadoEm' }
});

export const Aula = models.Aula || model<IAula>('Aula', AulaSchema);
