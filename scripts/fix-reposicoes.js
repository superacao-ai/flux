// Script para corrigir reposições que não tem o campo isReposicao marcado
// Reagendamentos com aulaRealizadaId são reposições por falta

require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('MONGODB_URI não definida');
  process.exit(1);
}

async function fixReposicoes() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Conectado ao MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('reagendamentos');

    // Buscar reagendamentos que:
    // 1. Têm aulaRealizadaId (são reposições)
    // 2. isReposicao não está true
    const reagendamentosSemFlag = await collection.find({
      aulaRealizadaId: { $exists: true, $ne: null },
      isReposicao: { $ne: true }
    }).toArray();

    console.log(`\n📋 Encontrados ${reagendamentosSemFlag.length} reagendamentos com aulaRealizadaId mas sem isReposicao=true`);

    if (reagendamentosSemFlag.length > 0) {
      console.log('\nExemplos:');
      reagendamentosSemFlag.slice(0, 5).forEach((r, i) => {
        console.log(`  ${i + 1}. ID: ${r._id}, motivo: "${r.motivo}", isReposicao: ${r.isReposicao}`);
      });

      // Atualizar todos
      const result = await collection.updateMany(
        {
          aulaRealizadaId: { $exists: true, $ne: null },
          isReposicao: { $ne: true }
        },
        {
          $set: { isReposicao: true }
        }
      );

      console.log(`\n✅ Atualizados ${result.modifiedCount} reagendamentos com isReposicao=true`);
    }

    // Listar todos os reagendamentos para debug
    console.log('\n📊 Status atual de todos os reagendamentos:');
    const todos = await collection.find({}).toArray();
    console.log(`Total: ${todos.length}`);
    
    const comReposicao = todos.filter(r => r.isReposicao === true);
    const semReposicao = todos.filter(r => !r.isReposicao);
    console.log(`  - Com isReposicao=true: ${comReposicao.length}`);
    console.log(`  - Sem isReposicao (reagendamentos normais): ${semReposicao.length}`);

    // Mostrar detalhes de cada um
    console.log('\n📝 Lista completa:');
    todos.forEach((r, i) => {
      console.log(`  ${i + 1}. Status: ${r.status}, isReposicao: ${r.isReposicao}, aulaRealizadaId: ${r.aulaRealizadaId ? 'SIM' : 'NÃO'}, motivo: "${r.motivo.substring(0, 50)}..."`);
    });

  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDesconectado do MongoDB');
  }
}

fixReposicoes();
