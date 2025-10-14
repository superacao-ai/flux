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

// Schema da Especialidade
const EspecialidadeSchema = new mongoose.Schema({
  nome: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  descricao: {
    type: String,
    trim: true
  },
  ativo: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: { createdAt: 'criadoEm', updatedAt: 'atualizadoEm' }
});

const Especialidade = mongoose.models.Especialidade || mongoose.model('Especialidade', EspecialidadeSchema);

async function seedEspecialidades() {
  try {
    await connectDB();

    // Especialidades iniciais
    const especialidades = [
      {
        nome: 'Corrida',
        descricao: 'Treinos de corrida e preparação física para corredores'
      },
      {
        nome: 'Natação',
        descricao: 'Aulas de natação para todas as idades e níveis'
      },
      {
        nome: 'Personal',
        descricao: 'Treinamento personalizado individual'
      }
    ];

    // Limpar especialidades existentes
    await Especialidade.deleteMany({});
    console.log('🗑️  Especialidades existentes removidas');

    // Inserir novas especialidades
    const especialidadesSalvas = await Especialidade.insertMany(especialidades);
    console.log(`✅ ${especialidadesSalvas.length} especialidades criadas:`);
    
    especialidadesSalvas.forEach(esp => {
      console.log(`   - ${esp.nome}: ${esp.descricao}`);
    });

  } catch (error) {
    console.error('❌ Erro ao popular especialidades:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Conexão com MongoDB encerrada');
  }
}

// Executar o seed
seedEspecialidades();