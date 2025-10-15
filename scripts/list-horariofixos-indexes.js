// Script rápido para listar índices da coleção horariofixos
require('dotenv').config();
const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI || process.env.MONGODB_URL || process.env.DATABASE_URL;
if (!uri) {
  console.error('ERRO: MONGODB_URI não definido no ambiente. Configure .env.local');
  process.exit(1);
}

(async () => {
  try {
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = mongoose.connection.db;
    const coll = db.collection('horariofixos');
    const indexes = await coll.indexes();
    console.log('Índices em horariofixos:');
    console.dir(indexes, { depth: null });
    await mongoose.disconnect();
  } catch (err) {
    console.error('Erro ao listar índices:', err);
    process.exit(1);
  }
})();
