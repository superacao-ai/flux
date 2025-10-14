const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

async function fixIndexes() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Conectado ao MongoDB');

    const db = mongoose.connection.db;

    // 1. Corrigir índice de email dos alunos (tornar sparse)
    console.log('🔧 Removendo índice antigo de email dos alunos...');
    try {
      await db.collection('alunos').dropIndex('email_1');
      console.log('✅ Índice email_1 removido');
    } catch (error) {
      console.log('ℹ️ Índice email_1 não existia:', error.message);
    }

    console.log('🔧 Criando novo índice sparse para email...');
    await db.collection('alunos').createIndex(
      { email: 1 }, 
      { 
        unique: true, 
        sparse: true,
        name: 'email_sparse'
      }
    );
    console.log('✅ Novo índice sparse criado para email');

    // 2. Remover índice composto de horários que impede múltiplos alunos
    console.log('🔧 Verificando índices de horários...');
    const indexes = await db.collection('horariofixos').indexes();
    console.log('Índices encontrados:', indexes.map(i => i.name));

    for (const index of indexes) {
      if (index.name.includes('professorId_1_diaSemana_1_horarioInicio_1')) {
        console.log('🔧 Removendo índice que impede turmas...');
        await db.collection('horariofixos').dropIndex(index.name);
        console.log('✅ Índice removido:', index.name);
      }
    }

    console.log('✅ Todos os índices corrigidos!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

fixIndexes();