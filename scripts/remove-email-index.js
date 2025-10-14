const mongoose = require('mongoose');

// Conectar ao MongoDB
async function connectDB() {
  try {
    await mongoose.connect('mongodb+srv://contatosuperacaotreino_db_user:nk98JOOIl2xgOh3l@cluster0.lsfahx1.mongodb.net/superagenda?retryWrites=true&w=majority&appName=Cluster0');
    console.log('✅ Conectado ao MongoDB');
  } catch (error) {
    console.error('❌ Erro ao conectar ao MongoDB:', error);
    process.exit(1);
  }
}

async function removeEmailIndex() {
  try {
    await connectDB();

    const db = mongoose.connection.db;
    const collection = db.collection('professors');

    console.log('📋 Listando índices atuais...');
    const indexes = await collection.listIndexes().toArray();
    console.log('Índices encontrados:');
    indexes.forEach(index => {
      console.log(`   - ${index.name}: ${JSON.stringify(index.key)}`);
    });

    console.log('\n🗑️  Tentando remover índice do email...');
    
    try {
      await collection.dropIndex('email_1');
      console.log('✅ Índice email_1 removido com sucesso');
    } catch (error) {
      if (error.code === 27) {
        console.log('ℹ️  Índice email_1 não existe (já foi removido)');
      } else {
        throw error;
      }
    }

    console.log('\n🗑️  Removendo todos os documentos da coleção...');
    const deleteResult = await collection.deleteMany({});
    console.log(`✅ ${deleteResult.deletedCount} documentos removidos`);

    console.log('\n📋 Listando índices após limpeza...');
    const indexesAfter = await collection.listIndexes().toArray();
    console.log('Índices restantes:');
    indexesAfter.forEach(index => {
      console.log(`   - ${index.name}: ${JSON.stringify(index.key)}`);
    });

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Conexão com MongoDB encerrada');
  }
}

// Executar
removeEmailIndex();