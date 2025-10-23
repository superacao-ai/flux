import mongoose from 'mongoose';

const MatriculaSchema = new mongoose.Schema({
  horarioFixoId: { type: mongoose.Schema.Types.ObjectId, ref: 'HorarioFixo', required: true, index: true },
  alunoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Aluno', required: true, index: true },
  ativo: { type: Boolean, default: true },
  criadoEm: { type: Date, default: () => new Date() }
});

export const Matricula = mongoose.models.Matricula || mongoose.model('Matricula', MatriculaSchema);
