const mongoose = require('mongoose');

// Conectar ao MongoDB
async function connectDB() {
  try {
    await mongoose.connect('mongodb+srv://contatosuperacaotreino_db_user:nk98JOOIl2xgOh3l@cluster0.lsfahx1.mongodb.net/superagenda?retryWrites=true&w=majority&appName=Cluster0');
    console.log('✅ Conectado ao MongoDB');
  } catch (error) {
    console.error('❌ Erro ao conectar ao MongoDB:', error);
    process.exit(1);
  }
}

// Schema do Professor (novo, sem email)
const ProfessorSchema = new mongoose.Schema({
  nome: {
    type: String,
    required: [true, 'Nome é obrigatório'],
    trim: true,
    maxlength: [100, 'Nome deve ter no máximo 100 caracteres']
  },
  telefone: {
    type: String,
    required: [true, 'Telefone é obrigatório'],
    trim: true,
    match: [/^\(\d{2}\)\s\d{4,5}-\d{4}$/, 'Telefone deve estar no formato (11) 99999-9999']
  },
  especialidades: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Especialidade'
  }],
  ativo: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: { createdAt: 'criadoEm', updatedAt: 'atualizadoEm' }
});

const Professor = mongoose.models.Professor || mongoose.model('Professor', ProfessorSchema);

async function migrateProfessores() {
  try {
    await connectDB();

    console.log('🗑️  Removendo todos os professores existentes...');
    await Professor.deleteMany({});

    console.log('📋 Criando professores de exemplo (sem email)...');
    
    // Buscar especialidades para associar
    const Especialidade = mongoose.models.Especialidade || mongoose.model('Especialidade', new mongoose.Schema({
      nome: String,
      descricao: String,
      ativo: { type: Boolean, default: true }
    }));

    const especialidades = await Especialidade.find({ ativo: true });
    console.log(`📚 Encontradas ${especialidades.length} especialidades`);

    // Professores de exemplo
    const professores = [
      {
        nome: 'Ana Silva',
        telefone: '(11) 99999-1001',
        especialidades: especialidades.filter(e => e.nome === 'Natação').map(e => e._id),
        ativo: true
      },
      {
        nome: 'Carlos Santos',
        telefone: '(11) 99999-1002', 
        especialidades: especialidades.filter(e => e.nome === 'Corrida').map(e => e._id),
        ativo: true
      },
      {
        nome: 'Maria Costa',
        telefone: '(11) 99999-1003',
        especialidades: especialidades.filter(e => e.nome === 'Personal').map(e => e._id),
        ativo: true
      }
    ];

    const professoresSalvos = await Professor.insertMany(professores);
    
    console.log(`✅ ${professoresSalvos.length} professores criados com sucesso:`);
    professoresSalvos.forEach((prof, index) => {
      console.log(`   ${index + 1}. ${prof.nome} - ${prof.telefone}`);
    });

  } catch (error) {
    console.error('❌ Erro na migração:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Conexão com MongoDB encerrada');
  }
}

// Executar a migração
migrateProfessores();