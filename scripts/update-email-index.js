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

async function updateEmailIndex() {
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

    console.log('\n🗑️  Tentando remover índice único do email...');
    
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

    console.log('\n📋 Criando novo índice sparse para email...');
    
    try {
      await collection.createIndex({ email: 1 }, { unique: true, sparse: true });
      console.log('✅ Novo índice sparse para email criado');
    } catch (error) {
      console.log('ℹ️  Índice sparse já existe ou erro:', error.message);
    }

    console.log('\n📋 Listando índices após atualização...');
    const indexesAfter = await collection.listIndexes().toArray();
    console.log('Índices atuais:');
    indexesAfter.forEach(index => {
      console.log(`   - ${index.name}: ${JSON.stringify(index.key)} ${index.sparse ? '(sparse)' : ''}`);
    });

    console.log('\n✅ Atualização de índices concluída!');

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Conexão com MongoDB encerrada');
  }
}

// Executar
updateEmailIndex();