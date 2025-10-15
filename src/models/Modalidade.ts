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
  diasSemana: {
    type: [Number], // Array de dias da semana (0=Domingo, 6=Sábado)
    default: [] // Por padrão, nenhum dia selecionado
  },
  horariosDisponiveis: [{
    diasSemana: [Number], // Array de dias da semana (0=Domingo, 6=Sábado)
    horaInicio: String,   // Ex: "06:00"
    horaFim: String       // Ex: "09:00"
  }],
  // Horário de funcionamento padrão para a modalidade (manhã e tarde)
  horarioFuncionamento: {
    manha: {
      inicio: { type: String, default: null },
      fim: { type: String, default: null }
    },
    tarde: {
      inicio: { type: String, default: null },
      fim: { type: String, default: null }
    }
  },
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

// Adiciona transform para produzir JSON limpo (útil para enviar ao cliente e evitar diferenças que parecem "cache")
modalidadeSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc: any, ret: any) => {
    if (ret._id) {
      ret.id = String(ret._id);
      delete ret._id;
    }
    return ret;
  }
});

// Método estático para adicionar um horário e retornar a modalidade atualizada
// Uso: await Modalidade.addHorario(modalidadeId, horario);
modalidadeSchema.statics.addHorario = async function (modalidadeId: string, horario: any) {
  const modalidade = await this.findById(modalidadeId);
  if (!modalidade) throw new Error('Modalidade not found');

  modalidade.horariosDisponiveis = modalidade.horariosDisponiveis || [];
  modalidade.horariosDisponiveis.push(horario);

  await modalidade.save();
  return modalidade.toJSON ? modalidade.toJSON() : modalidade;
};

export const Modalidade = mongoose.models.Modalidade || mongoose.model('Modalidade', modalidadeSchema);