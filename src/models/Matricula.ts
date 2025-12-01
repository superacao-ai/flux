import mongoose from 'mongoose';

const MatriculaSchema = new mongoose.Schema({
  horarioFixoId: { type: mongoose.Schema.Types.ObjectId, ref: 'HorarioFixo', required: true, index: true },
  alunoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Aluno', required: true, index: true },
  ativo: { type: Boolean, default: true },
  criadoEm: { type: Date, default: () => new Date() },
  // Substitution fields
  isSubstitute: { type: Boolean, default: false, index: true },
  replacesMatriculaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Matricula', default: null, index: true }
  ,
  // Reposição tickets: número de vales reposição disponíveis para essa matrícula
  reposicoesDisponiveis: { type: Number, default: 0 },
  // Histórico simples de usos (opcional): [{ reagendamentoId, usadoEm, usadoPor }]
  reposicoesHistorico: [{
    reagendamentoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Reagendamento', default: null },
    usadoEm: { type: Date, default: null },
    usadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  }]
});

export const Matricula = mongoose.models.Matricula || mongoose.model('Matricula', MatriculaSchema);
