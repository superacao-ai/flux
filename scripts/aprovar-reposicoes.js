// Script para aprovar reposições pendentes
require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('MONGODB_URI não definida');
  process.exit(1);
}

async function aprovarReposicoes() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Conectado ao MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('reagendamentos');

    // Aprovar todas as reposições pendentes
    const result = await collection.updateMany(
      { isReposicao: true, status: 'pendente' },
      { $set: { status: 'aprovado' } }
    );

    console.log(`✅ Reposições aprovadas: ${result.modifiedCount}`);

    // Verificar estado atual
    const todas = await collection.find({}).toArray();
    console.log('\n📊 Status atual:');
    todas.forEach((r, i) => {
      console.log(`  ${i + 1}. status: ${r.status}, isReposicao: ${r.isReposicao}, motivo: "${r.motivo?.substring(0, 50)}..."`);
    });

  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDesconectado do MongoDB');
  }
}

aprovarReposicoes();
