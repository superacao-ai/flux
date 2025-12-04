import mongoose, { Schema, models, model } from 'mongoose';

// Interface para o Aviso de Ausência
export interface IAvisoAusencia {
  _id?: string;
  alunoId: mongoose.Types.ObjectId | string;
  matriculaId: mongoose.Types.ObjectId | string;
  horarioFixoId: mongoose.Types.ObjectId | string;
  dataAusencia: Date;
  motivo: string;
  // Status: pendente (ainda não ocorreu), confirmada (falta registrada), cancelada (aluno veio), usada (já usou reposição)
  status: 'pendente' | 'confirmada' | 'cancelada' | 'usada';
  // Indica se o aluno tem direito a reposição (avisou com antecedência de 24h)
  temDireitoReposicao: boolean;
  // Quantas reposições foram usadas deste aviso
  reposicoesUsadas: number;
  criadoEm?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

// Schema do Aviso de Ausência
const AvisoAusenciaSchema = new Schema<IAvisoAusencia>({
  alunoId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Aluno', 
    required: [true, 'ID do aluno é obrigatório'] 
  },
  matriculaId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Matricula', 
    required: [true, 'ID da matrícula é obrigatório'] 
  },
  horarioFixoId: { 
    type: Schema.Types.ObjectId, 
    ref: 'HorarioFixo', 
    required: [true, 'ID do horário é obrigatório'] 
  },
  dataAusencia: { 
    type: Date, 
    required: [true, 'Data da ausência é obrigatória'] 
  },
  motivo: { 
    type: String, 
    required: [true, 'Motivo é obrigatório'],
    maxlength: [200, 'Motivo deve ter no máximo 200 caracteres'],
    trim: true
  },
  status: { 
    type: String, 
    enum: {
      values: ['pendente', 'confirmada', 'cancelada', 'usada'],
      message: 'Status inválido'
    },
    default: 'pendente' 
  },
  temDireitoReposicao: { 
    type: Boolean, 
    default: true 
  },
  reposicoesUsadas: { 
    type: Number, 
    default: 0,
    min: [0, 'Reposições usadas não pode ser negativo']
  },
  criadoEm: { 
    type: Date, 
    default: Date.now 
  }
}, { 
  timestamps: true 
});

// Índices para performance
AvisoAusenciaSchema.index({ alunoId: 1, dataAusencia: 1 });
AvisoAusenciaSchema.index({ alunoId: 1, status: 1 });
AvisoAusenciaSchema.index({ status: 1, dataAusencia: 1 });
AvisoAusenciaSchema.index({ matriculaId: 1 });

// Método para verificar se ainda pode usar reposição
AvisoAusenciaSchema.methods.podeUsarReposicao = function(): boolean {
  return this.temDireitoReposicao && 
         this.status === 'confirmada' && 
         this.reposicoesUsadas < 1;
};

// Método estático para buscar faltas disponíveis para reposição
AvisoAusenciaSchema.statics.buscarFaltasParaReposicao = function(alunoId: string) {
  return this.find({
    alunoId,
    status: 'confirmada',
    temDireitoReposicao: true,
    reposicoesUsadas: { $lt: 1 }
  })
  .populate({
    path: 'horarioFixoId',
    populate: [
      { path: 'modalidadeId', select: 'nome cor' },
      { path: 'professorId', select: 'nome' }
    ]
  })
  .sort({ dataAusencia: -1 });
};

export const AvisoAusencia = models.AvisoAusencia || model<IAvisoAusencia>('AvisoAusencia', AvisoAusenciaSchema);
