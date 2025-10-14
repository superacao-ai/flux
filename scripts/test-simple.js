const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

async function testSimple() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado ao MongoDB');

    // Teste 1: Criar aluno simples
    console.log('\n🧪 Teste 1: Criar aluno simples');
    
    const response1 = await fetch('http://localhost:3000/api/alunos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: 'Teste Simples',
        telefone: 'Não informado'
      })
    });

    const result1 = await response1.json();
    console.log('📤 Resultado criação aluno:', result1);

    if (!result1.success) {
      console.log('❌ ERRO na criação do aluno:', result1.error);
      process.exit(1);
    }

    // Teste 2: Buscar um professor
    console.log('\n🧪 Teste 2: Buscar professor');
    const professores = await mongoose.connection.db.collection('professores').findOne({});
    console.log('📍 Professor encontrado:', professores ? professores.nome : 'nenhum');

    if (!professores) {
      console.log('❌ Nenhum professor encontrado');
      process.exit(1);
    }

    // Teste 3: Criar horário
    console.log('\n🧪 Teste 3: Criar horário');
    
    const response2 = await fetch('http://localhost:3000/api/horarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alunoId: result1.data._id,
        professorId: professores._id.toString(),
        diaSemana: 2, // Terça-feira
        horarioInicio: '10:00',
        horarioFim: '11:00',
        observacoes: 'Teste simples'
      })
    });

    const result2 = await response2.json();
    console.log('📤 Resultado criação horário:', result2);

    if (result2.success) {
      console.log('✅ SUCESSO! Tudo funcionando');
    } else {
      console.log('❌ ERRO na criação do horário:', result2.error);
    }

    process.exit(0);

  } catch (error) {
    console.error('❌ Erro inesperado:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testSimple();