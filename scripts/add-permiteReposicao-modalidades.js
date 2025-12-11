/**
 * Script para adicionar o campo permiteReposicao às modalidades existentes
 * Por padrão, todas as modalidades permitirão reposição (permiteReposicao: true)
 * 
 * Uso: node scripts/add-permiteReposicao-modalidades.js
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI não encontrada no .env.local');
  process.exit(1);
}

async function main() {
  try {
    console.log('🔗 Conectando ao MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado!\n');

    const db = mongoose.connection.db;
    const collection = db.collection('modalidades');

    // Buscar todas as modalidades
    const modalidades = await collection.find({}).toArray();
    console.log(`📋 Total de modalidades encontradas: ${modalidades.length}\n`);

    // Contar quantas já tem o campo definido
    const comCampo = modalidades.filter(m => m.permiteReposicao !== undefined);
    const semCampo = modalidades.filter(m => m.permiteReposicao === undefined);

    console.log(`✅ Modalidades com permiteReposicao definido: ${comCampo.length}`);
    console.log(`⚠️  Modalidades sem permiteReposicao: ${semCampo.length}\n`);

    if (semCampo.length === 0) {
      console.log('✨ Todas as modalidades já possuem o campo permiteReposicao!');
    } else {
      console.log('🔄 Atualizando modalidades sem o campo...\n');

      // Atualizar todas que não tem o campo, definindo como true
      const result = await collection.updateMany(
        { permiteReposicao: { $exists: false } },
        { $set: { permiteReposicao: true } }
      );

      console.log(`✅ ${result.modifiedCount} modalidades atualizadas com permiteReposicao: true`);
    }

    // Listar todas as modalidades com seus valores
    console.log('\n📋 Status atual das modalidades:');
    console.log('─'.repeat(60));
    
    const modalidadesAtualizadas = await collection.find({}).toArray();
    for (const m of modalidadesAtualizadas) {
      const status = m.permiteReposicao === false ? '🚫 NÃO permite' : '✅ Permite';
      const ativo = m.ativo === false ? '(inativa)' : '';
      console.log(`  ${m.nome} ${ativo}: ${status} reposição`);
    }

    console.log('─'.repeat(60));
    console.log('\n✨ Script finalizado com sucesso!');
    console.log('\n💡 Para desabilitar reposição de uma modalidade específica:');
    console.log('   - Acesse a tela de Modalidades no sistema');
    console.log('   - Edite a modalidade desejada (ex: Natação)');
    console.log('   - Desative o toggle "Permite Reposição"');

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Desconectado do MongoDB');
  }
}

main();
