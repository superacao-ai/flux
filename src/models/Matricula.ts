import mongoose from 'mongoose';

const MatriculaSchema = new mongoose.Schema({
  horarioFixoId: { type: mongoose.Schema.Types.ObjectId, ref: 'HorarioFixo', required: true, index: true },
  alunoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Aluno', required: true, index: true },
  ativo: { type: Boolean, default: true },
  criadoEm: { type: Date, default: () => new Date() },
  // Substitution fields
  isSubstitute: { type: Boolean, default: false, index: true },
  replacesMatriculaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Matricula', default: null, index: true }
});

export const Matricula = mongoose.models.Matricula || mongoose.model('Matricula', MatriculaSchema);
