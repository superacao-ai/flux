import mongoose, { Schema, model, models } from 'mongoose';

export interface ICreditoReposicao {
  _id?: string;
  alunoId: mongoose.Types.ObjectId;
  quantidade: number; // Número de créditos concedidos
  quantidadeUsada: number; // Número de créditos já utilizados
  modalidadeId?: mongoose.Types.ObjectId; // Modalidade específica (opcional - se null, vale para qualquer)
  motivo: string; // Motivo da concessão (ex: "Compensação por problema técnico")
  validade: Date; // Data de expiração dos créditos
  concedidoPor: mongoose.Types.ObjectId; // Referência ao User (admin que concedeu)
  aulaRealizadaId?: mongoose.Types.ObjectId; // Referência à aula cancelada que gerou o crédito (opcional)
  ativo: boolean; // Se false, crédito foi cancelado
  criadoEm: Date;
  atualizadoEm: Date;
}

const CreditoReposicaoSchema = new Schema<ICreditoReposicao>(
  {
    alunoId: {
      type: Schema.Types.ObjectId,
      ref: 'Aluno',
      required: [true, 'Aluno é obrigatório'],
      index: true
    },
    quantidade: {
      type: Number,
      required: [true, 'Quantidade é obrigatória'],
      min: [1, 'Quantidade mínima é 1'],
      validate: {
        validator: Number.isInteger,
        message: 'Quantidade deve ser um número inteiro'
      }
    },
    quantidadeUsada: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Quantidade usada não pode ser negativa'],
      validate: {
        validator: Number.isInteger,
        message: 'Quantidade usada deve ser um número inteiro'
      }
    },
    modalidadeId: {
      type: Schema.Types.ObjectId,
      ref: 'Modalidade',
      required: false,
      index: true
    },
    motivo: {
      type: String,
      required: [true, 'Motivo é obrigatório'],
      trim: true,
      maxlength: [500, 'Motivo deve ter no máximo 500 caracteres']
    },
    validade: {
      type: Date,
      required: [true, 'Validade é obrigatória'],
      validate: {
        validator: function(v: Date) {
          return v > new Date();
        },
        message: 'Validade deve ser uma data futura'
      },
      index: true
    },
    concedidoPor: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Usuário que concedeu é obrigatório']
    },
    aulaRealizadaId: {
      type: Schema.Types.ObjectId,
      ref: 'AulaRealizada',
      required: false,
      index: true
    },
    ativo: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  {
    timestamps: { createdAt: 'criadoEm', updatedAt: 'atualizadoEm' }
  }
);

// Índice composto para queries eficientes
CreditoReposicaoSchema.index({ alunoId: 1, ativo: 1, validade: 1 });

// Virtual para créditos disponíveis
CreditoReposicaoSchema.virtual('creditosDisponiveis').get(function() {
  return this.quantidade - this.quantidadeUsada;
});

// Método para verificar se tem créditos disponíveis
CreditoReposicaoSchema.methods.temCreditosDisponiveis = function(): boolean {
  return this.ativo && this.validade > new Date() && (this.quantidade - this.quantidadeUsada) > 0;
};

export default models.CreditoReposicao || model<ICreditoReposicao>('CreditoReposicao', CreditoReposicaoSchema);
