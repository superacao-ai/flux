const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const alunoSchema = new mongoose.Schema({
  nome: {
    type: String,
    required: [true, 'Nome é obrigatório'],
    trim: true,
    maxlength: [100, 'Nome deve ter no máximo 100 caracteres']
  },
  email: {
    type: String,
    required: false,
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: function(v) {
        if (!v || v.trim() === '') return true;
        return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(v);
      },
      message: 'Email inválido'
    }
  },
  telefone: {
    type: String,
    required: false,
    default: 'Não informado',
    trim: true,
    validate: {
      validator: function(v) {
        if (!v || v.trim() === '' || v === 'Não informado') return true;
        return /^\(\d{2}\)\s\d{4,5}-\d{4}$/.test(v);
      },
      message: 'Telefone deve estar no formato (11) 99999-9999 ou "Não informado"'
    }
  },
  endereco: {
    type: String,
    required: false,
    trim: true,
    maxlength: [200, 'Endereço deve ter no máximo 200 caracteres']
  },
  modalidadeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Modalidade',
    required: false
  },
  plano: {
    type: String,
    required: false
  },
  observacoes: {
    type: String,
    required: false,
    maxlength: [500, 'Observações devem ter no máximo 500 caracteres']
  },
  ativo: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: { createdAt: 'criadoEm', updatedAt: 'atualizadoEm' }
});

const Aluno = mongoose.model('Aluno', alunoSchema);

async function fixValidation() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Conectado ao MongoDB');

    // Testar criação de aluno
    console.log('Testando criação de aluno...');
    
    const testAluno = new Aluno({
      nome: 'Teste Validação',
      email: '', // Email vazio
      telefone: '' // Telefone vazio
    });

    await testAluno.save();
    console.log('✅ Aluno de teste criado:', testAluno.nome, 'telefone:', testAluno.telefone);

    // Remover aluno de teste
    await Aluno.findByIdAndDelete(testAluno._id);
    console.log('✅ Aluno de teste removido');

    console.log('✅ Validação corrigida com sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error.message);
    if (error.errors) {
      Object.keys(error.errors).forEach(key => {
        console.error(`❌ ${key}: ${error.errors[key].message}`);
      });
    }
    process.exit(1);
  }
}

fixValidation();