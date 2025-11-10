const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const mongoUri = process.env.MONGODB_URI;

async function listCollections() {
  try {
    await mongoose.connect(mongoUri);
    console.log('✓ Conectado ao MongoDB');

    const db = mongoose.connection;
    const collections = await db.db.listCollections().toArray();
    
    console.log('\n📚 Coleções disponíveis:');
    collections.forEach(c => console.log(`   - ${c.name}`));

    // Tentar buscar em horariofixos
    let collection = db.collection('horariofixos');
    let count = await collection.countDocuments();
    console.log(`\n📊 horariofixos: ${count} documentos`);

    if (count > 0) {
      const first = await collection.findOne({});
      console.log(`\n🔍 Primeiro documento:`);
      console.log(JSON.stringify(first, null, 2).substring(0, 500));
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('✗ Erro:', error.message);
    process.exit(1);
  }
}

listCollections();
