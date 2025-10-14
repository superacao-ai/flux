import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// Modelos
import { User } from '../src/models/User.js';
import { Aluno } from '../src/models/Aluno.js';
import { Professor } from '../src/models/Professor.js';
import { HorarioFixo } from '../src/models/HorarioFixo.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/superagenda';

async function seedDatabase() {
  try {
    console.log('🔗 Conectando ao MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado ao MongoDB!');

    // Limpar dados existentes
    console.log('🧹 Limpando dados existentes...');
    await User.deleteMany({});
    await Aluno.deleteMany({});
    await Professor.deleteMany({});
    await HorarioFixo.deleteMany({});

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
        endereco: 'Rua A, 123 - São Paulo, SP'
      },
      {
        nome: 'Maria Santos',
        email: 'maria@email.com',
        telefone: '(11) 98888-2222',
        endereco: 'Rua B, 456 - São Paulo, SP'
      },
      {
        nome: 'Pedro Costa',
        email: 'pedro@email.com',
        telefone: '(11) 98888-3333',
        endereco: 'Rua C, 789 - São Paulo, SP'
      },
      {
        nome: 'Ana Clara',
        email: 'anaclara@email.com',
        telefone: '(11) 98888-4444',
        endereco: 'Rua D, 101 - São Paulo, SP'
      },
      {
        nome: 'Lucas Pereira',
        email: 'lucas@email.com',
        telefone: '(11) 98888-5555',
        endereco: 'Rua E, 202 - São Paulo, SP'
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

    console.log('🎉 Dados iniciais criados com sucesso!');
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

  } catch (error) {
    console.error('❌ Erro ao popular banco de dados:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado do MongoDB');
  }
}

seedDatabase();