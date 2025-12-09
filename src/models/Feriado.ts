import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IFeriado extends Document {
  data: Date;
  motivo?: string;
  criadoPor: mongoose.Types.ObjectId;
  criadoEm: Date;
}

const FeriadoSchema = new Schema<IFeriado>({
  data: { type: Date, required: true, unique: true },
  motivo: { type: String, default: '' },
  criadoPor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  criadoEm: { type: Date, default: Date.now }
});

// Índice para busca rápida por data
FeriadoSchema.index({ data: 1 });

const Feriado: Model<IFeriado> = mongoose.models.Feriado || mongoose.model<IFeriado>('Feriado', FeriadoSchema);

export default Feriado;
