require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Models (usando require para compatibilidade)
const UserSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  senha: { type: String, required: true },
  tipo: { type: String, enum: ['admin', 'professor'], default: 'professor' },
  ativo: { type: Boolean, default: true }
}, { timestamps: { createdAt: 'criadoEm', updatedAt: 'atualizadoEm' } });

const AlunoSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  telefone: { type: String, required: true },
  endereco: String,
  modalidadeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Modalidade', required: true },
  plano: String,
  observacoes: String,
  ativo: { type: Boolean, default: true }
}, { timestamps: { createdAt: 'criadoEm', updatedAt: 'atualizadoEm' } });

const ProfessorSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  telefone: { type: String, required: true },
  especialidade: String,
  ativo: { type: Boolean, default: true }
}, { timestamps: { createdAt: 'criadoEm', updatedAt: 'atualizadoEm' } });

const ModalidadeSchema = new mongoose.Schema({
  nome: { type: String, required: true, unique: true },
  descricao: String,
  cor: { type: String, default: '#3B82F6' },
  duracao: { type: Number, default: 60 },
  limiteAlunos: { type: Number, default: 5 },
  horariosDisponiveis: [{
    diasSemana: [Number],
    horaInicio: String,
    horaFim: String
  }],
  ativo: { type: Boolean, default: true }
}, { timestamps: true });

const HorarioFixoSchema = new mongoose.Schema({
  alunoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Aluno', required: true },
  professorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Professor', required: true },
  diaSemana: { type: Number, required: true, min: 0, max: 6 },
  horarioInicio: { type: String, required: true },
  horarioFim: { type: String, required: true },
  ativo: { type: Boolean, default: true },
  observacoes: String
}, { timestamps: { createdAt: 'criadoEm', updatedAt: 'atualizadoEm' } });

const User = mongoose.model('User', UserSchema);
const Aluno = mongoose.model('Aluno', AlunoSchema);
const Professor = mongoose.model('Professor', ProfessorSchema);
const Modalidade = mongoose.model('Modalidade', ModalidadeSchema);
const HorarioFixo = mongoose.model('HorarioFixo', HorarioFixoSchema);

const MONGODB_URI = process.env.MONGODB_URI;

async function seedDatabase() {
  try {
    console.log('🔗 Conectando ao MongoDB Atlas...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado ao MongoDB Atlas!');

    // Limpar dados existentes
    console.log('🧹 Limpando dados existentes...');
    await User.deleteMany({});
    await Aluno.deleteMany({});
    await Professor.deleteMany({});
    await Modalidade.deleteMany({});
    await HorarioFixo.deleteMany({});

    // Criar modalidades
    console.log('🏊 Criando modalidades...');
    const modalidades = await Modalidade.insertMany([
      {
        nome: 'SKY',
        descricao: 'Treino funcional de alta intensidade (30 min)',
        cor: '#3B82F6',
        duracao: 30,
        limiteAlunos: 10,
        horariosDisponiveis: [
          {
            diasSemana: [1, 2, 3, 4, 5], // Segunda a sexta
            horaInicio: '06:00',
            horaFim: '09:00'
          },
          {
            diasSemana: [1, 2, 3, 4, 5], // Segunda a sexta
            horaInicio: '16:00',
            horaFim: '20:00'
          }
        ]
      },
      {
        nome: 'UP',
        descricao: 'Treino funcional intermediário (30 min)',
        cor: '#10B981',
        duracao: 30,
        limiteAlunos: 5,
        horariosDisponiveis: [
          {
            diasSemana: [1, 2, 3, 4, 5], // Segunda a sexta
            horaInicio: '05:30',
            horaFim: '11:00'
          },
          {
            diasSemana: [1, 2, 3, 4, 5], // Segunda a sexta
            horaInicio: '12:30',
            horaFim: '20:00'
          }
        ]
      },
      {
        nome: 'START',
        descricao: 'Treino inicial e condicionamento (1h)',
        cor: '#F59E0B',
        duracao: 60,
        limiteAlunos: 5,
        horariosDisponiveis: [
          {
            diasSemana: [1, 2, 3, 4, 5], // Segunda a sexta
            horaInicio: '06:00',
            horaFim: '11:00'
          },
          {
            diasSemana: [1, 2, 3, 4, 5], // Segunda a sexta
            horaInicio: '15:00',
            horaFim: '20:00'
          }
        ]
      },
      {
        nome: 'RUNNER - CORRIDA',
        descricao: 'Treino de corrida e condicionamento (1h) 🚀',
        cor: '#EF4444',
        duracao: 60,
        limiteAlunos: 8,
        horariosDisponiveis: [
          {
            diasSemana: [1, 2, 3, 4, 5], // Segunda a sexta
            horaInicio: '05:00',
            horaFim: '07:00'
          },
          {
            diasSemana: [1, 2, 3, 4, 5], // Segunda a sexta
            horaInicio: '17:00',
            horaFim: '20:00'
          },
          {
            diasSemana: [6], // Sábado
            horaInicio: '07:00',
            horaFim: '08:00'
          }
        ]
      },
      {
        nome: 'NATAÇÃO INFANTIL',
        descricao: 'Aulas de natação para crianças (30 min) 🛟',
        cor: '#06B6D4',
        duracao: 30,
        limiteAlunos: 5,
        horariosDisponiveis: [
          {
            diasSemana: [1, 2, 3, 4, 5, 6], // Segunda a sábado
            horaInicio: '09:00',
            horaFim: '12:00'
          },
          {
            diasSemana: [1, 2, 3, 4, 5], // Segunda a sexta
            horaInicio: '13:00',
            horaFim: '20:00'
          }
        ]
      },
      {
        nome: 'HIDROGINÁSTICA SUPERAÇÃO',
        descricao: 'Exercícios aquáticos de baixo impacto (1h)',
        cor: '#8B5CF6',
        duracao: 60,
        limiteAlunos: 8,
        horariosDisponiveis: [
          // Horários flexíveis de acordo com natação infantil
          {
            diasSemana: [1, 2, 3, 4, 5], // Segunda a sexta
            horaInicio: '08:00',
            horaFim: '09:00'
          },
          {
            diasSemana: [1, 2, 3, 4, 5], // Segunda a sexta
            horaInicio: '12:00',
            horaFim: '13:00'
          }
        ]
      }
    ]);

    // Criar usuário administrador
    console.log('👤 Criando usuário administrador...');
    const senhaHasheada = await bcrypt.hash('admin123', 12);
    const admin = await User.create({
      nome: 'Administrador',
      email: 'admin@superagenda.com',
      senha: senhaHasheada,
      tipo: 'admin'
    });

    // Criar professores
    console.log('👨‍🏫 Criando professores...');
    const professores = await Professor.insertMany([
      {
        nome: 'Carlos Oliveira',
        email: 'carlos@superagenda.com',
        telefone: '(11) 99999-1111',
        especialidade: 'Musculação'
      },
      {
        nome: 'Ana Paula Silva',
        email: 'ana@superagenda.com',
        telefone: '(11) 99999-2222',
        especialidade: 'Funcional'
      },
      {
        nome: 'Roberto Santos',
        email: 'roberto@superagenda.com',
        telefone: '(11) 99999-3333',
        especialidade: 'Crossfit'
      }
    ]);

    // Criar usuários professores
    console.log('🔐 Criando contas de acesso para professores...');
    for (const professor of professores) {
      await User.create({
        nome: professor.nome,
        email: professor.email,
        senha: await bcrypt.hash('professor123', 12),
        tipo: 'professor'
      });
    }

    // Criar alunos
    console.log('👥 Criando alunos...');
    const alunos = await Aluno.insertMany([
      {
        nome: 'João Silva',
        email: 'joao@email.com',
        telefone: '(11) 98888-1111',
        endereco: 'Rua A, 123 - São Paulo, SP',
        modalidadeId: modalidades[0]._id, // Natação
      },
      {
        nome: 'Maria Santos',
        email: 'maria@email.com',
        telefone: '(11) 98888-2222',
        endereco: 'Rua B, 456 - São Paulo, SP',
        modalidadeId: modalidades[1]._id, // Treino Básico
      },
      {
        nome: 'Pedro Costa',
        email: 'pedro@email.com',
        telefone: '(11) 98888-3333',
        endereco: 'Rua C, 789 - São Paulo, SP',
        modalidadeId: modalidades[3]._id, // Treino Avançado
      },
      {
        nome: 'Ana Clara',
        email: 'anaclara@email.com',
        telefone: '(11) 98888-4444',
        endereco: 'Rua D, 101 - São Paulo, SP',
        modalidadeId: modalidades[4]._id, // Hidroginástica
      },
      {
        nome: 'Lucas Pereira',
        email: 'lucas@email.com',
        telefone: '(11) 98888-5555',
        endereco: 'Rua E, 202 - São Paulo, SP',
        modalidadeId: modalidades[5]._id, // Corrida
      },
      {
        nome: 'Carla Mendes',
        email: 'carla@email.com',
        telefone: '(11) 98888-6666',
        endereco: 'Rua F, 303 - São Paulo, SP',
        modalidadeId: modalidades[2]._id, // Treino Intermediário
      },
      {
        nome: 'Roberto Lima',
        email: 'roberto@email.com',
        telefone: '(11) 98888-7777',
        endereco: 'Rua G, 404 - São Paulo, SP',
        modalidadeId: modalidades[0]._id, // Natação
      }
    ]);

    // Criar horários fixos
    console.log('📅 Criando horários fixos...');
    const horarios = [
      {
        alunoId: alunos[0]._id, // João Silva
        professorId: professores[0]._id, // Carlos
        diaSemana: 1, // Segunda
        horarioInicio: '08:00',
        horarioFim: '09:00'
      },
      {
        alunoId: alunos[1]._id, // Maria Santos
        professorId: professores[1]._id, // Ana Paula
        diaSemana: 1, // Segunda
        horarioInicio: '09:00',
        horarioFim: '10:00'
      },
      {
        alunoId: alunos[2]._id, // Pedro Costa
        professorId: professores[2]._id, // Roberto
        diaSemana: 3, // Quarta
        horarioInicio: '14:00',
        horarioFim: '15:00'
      },
      {
        alunoId: alunos[3]._id, // Ana Clara
        professorId: professores[0]._id, // Carlos
        diaSemana: 5, // Sexta
        horarioInicio: '18:00',
        horarioFim: '19:00'
      },
      {
        alunoId: alunos[4]._id, // Lucas Pereira
        professorId: professores[1]._id, // Ana Paula
        diaSemana: 2, // Terça
        horarioInicio: '17:00',
        horarioFim: '18:00'
      }
    ];

    await HorarioFixo.insertMany(horarios);

    console.log('🎉 Dados iniciais criados com sucesso no MongoDB Atlas!');
    console.log('\n📋 Credenciais de acesso:');
    console.log('👨‍💼 Administrador:');
    console.log('   Email: admin@superagenda.com');
    console.log('   Senha: admin123');
    console.log('\n👨‍🏫 Professores:');
    console.log('   Email: carlos@superagenda.com | Senha: professor123');
    console.log('   Email: ana@superagenda.com | Senha: professor123');
    console.log('   Email: roberto@superagenda.com | Senha: professor123');
    
    console.log('\n📊 Resumo dos dados criados:');
    console.log(`   ✅ ${await User.countDocuments()} usuários`);
    console.log(`   ✅ ${await Professor.countDocuments()} professores`);
    console.log(`   ✅ ${await Aluno.countDocuments()} alunos`);
    console.log(`   ✅ ${await HorarioFixo.countDocuments()} horários fixos`);
    
    console.log('\n🌐 Acesse: http://localhost:3001');

  } catch (error) {
    console.error('❌ Erro ao popular banco de dados:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado do MongoDB Atlas');
  }
}

seedDatabase();