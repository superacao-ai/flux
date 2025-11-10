// Execute este script via API route ou configure MONGODB_URI manualmente

// Opção 1: Execute direto no navegador console depois de fazer login
// Copie e cole este código no console do navegador (F12):

/*
async function ativarTodos() {
  console.log('🔄 Iniciando atualização de alunos...');
  const alunosRes = await fetch('/api/admin/ativar-registros', { 
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tipo: 'alunos' })
  });
  const alunosData = await alunosRes.json();
  console.log('✅ Alunos:', alunosData);
  
  console.log('🔄 Iniciando atualização de horários...');
  const horariosRes = await fetch('/api/admin/ativar-registros', {
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tipo: 'horarios' })
  });
  const horariosData = await horariosRes.json();
  console.log('✅ Horários:', horariosData);
  
  console.log('🎉 Concluído! Recarregue a página.');
}

ativarTodos();
*/

// Opção 2: Configure a URI do MongoDB e use este script
require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI não definida!');
  console.log('\n💡 Opções:');
  console.log('1. Crie um arquivo .env.local com MONGODB_URI');
  console.log('2. Use: MONGODB_URI="sua-uri" node scripts/ativar-todos-registros.js');
  console.log('3. Copie o código de "Opção 1" acima e execute no console do navegador');
  process.exit(1);
}

async function ativarTodosRegistros() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado ao MongoDB');
    
    const db = mongoose.connection.db;
    
    // Ativar todos os alunos
    const resultAlunos = await db.collection('alunos').updateMany(
      { $or: [{ ativo: { $exists: false } }, { ativo: false }] },
      { $set: { ativo: true } }
    );
    console.log(`📝 Alunos atualizados: ${resultAlunos.modifiedCount}`);
    
    // Ativar todos os horários
    const resultHorarios = await db.collection('horariofixos').updateMany(
      { $or: [{ ativo: { $exists: false } }, { ativo: false }] },
      { $set: { ativo: true } }
    );
    console.log(`📅 Horários fixos atualizados: ${resultHorarios.modifiedCount}`);
    
    // Verificar totais
    const totalAlunos = await db.collection('alunos').countDocuments({ ativo: true });
    const totalHorarios = await db.collection('horariofixos').countDocuments({ ativo: true });
    
    console.log('\n📊 Resumo:');
    console.log(`   Total de alunos ativos: ${totalAlunos}`);
    console.log(`   Total de horários ativos: ${totalHorarios}`);
    
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Conexão fechada');
  }
}

ativarTodosRegistros();
