import mongoose from 'mongoose';

const modalidadeSchema = new mongoose.Schema({
  nome: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  descricao: {
    type: String,
    trim: true
  },
  cor: {
    type: String,
    default: '#3B82F6' // Cor padrão em hex para identificação visual
  },
  duracao: {
    type: Number,
    default: 60 // Duração padrão em minutos
  },
  limiteAlunos: {
    type: Number,
    default: 5 // Limite máximo de alunos por horário
  },
  horariosDisponiveis: [{
    diasSemana: [Number], // Array de dias da semana (0=Domingo, 6=Sábado)
    horaInicio: String,   // Ex: "06:00"
    horaFim: String       // Ex: "09:00"
  }],
  ativo: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Índices
modalidadeSchema.index({ nome: 1 });
modalidadeSchema.index({ ativo: 1 });

export const Modalidade = mongoose.models.Modalidade || mongoose.model('Modalidade', modalidadeSchema);