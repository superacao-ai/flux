/**
 * Script para adicionar o campo linkWhatsapp nas modalidades existentes
 * 
 * Uso: node scripts/add-link-whatsapp-modalidades.js
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI não encontrada no .env.local');
  process.exit(1);
}

async function addLinkWhatsappField() {
  try {
    console.log('🔌 Conectando ao MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado ao MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('modalidades');

    // Buscar todas as modalidades
    const modalidades = await collection.find({}).toArray();
    console.log(`📋 Encontradas ${modalidades.length} modalidades`);

    let atualizadas = 0;
    let jaTemCampo = 0;

    for (const modalidade of modalidades) {
      // Verificar se já tem o campo linkWhatsapp
      if (modalidade.linkWhatsapp !== undefined) {
        jaTemCampo++;
        console.log(`  ⏭️  ${modalidade.nome}: já possui campo linkWhatsapp`);
        continue;
      }

      // Adicionar o campo linkWhatsapp vazio
      await collection.updateOne(
        { _id: modalidade._id },
        { $set: { linkWhatsapp: '' } }
      );
      
      atualizadas++;
      console.log(`  ✅ ${modalidade.nome}: campo linkWhatsapp adicionado`);
    }

    console.log('\n📊 Resumo:');
    console.log(`   - Total de modalidades: ${modalidades.length}`);
    console.log(`   - Atualizadas: ${atualizadas}`);
    console.log(`   - Já tinham o campo: ${jaTemCampo}`);

    console.log('\n✅ Script concluído com sucesso!');

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado do MongoDB');
  }
}

addLinkWhatsappField();
