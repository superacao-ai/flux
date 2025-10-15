#!/usr/bin/env node
/**
 * scripts/list-modalidades.js
 *
 * Lista todos os documentos da coleção `modalidades` e imprime como JSON.
 * Uso: node scripts/list-modalidades.js
 * 
 * Lê a variável de ambiente MONGODB_URI (ou NEXT_PUBLIC_MONGODB_URI / MONGO_URI)
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || process.env.NEXT_PUBLIC_MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL;
if (!uri) {
  console.error('ERRO: MONGODB_URI não definido. Configure no .env (MONGODB_URI).');
  process.exit(1);
}

async function main() {
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  try {
    await client.connect();
    const db = process.env.MONGODB_DBNAME ? client.db(process.env.MONGODB_DBNAME) : client.db();
    const col = db.collection('modalidades');
    const docs = await col.find({}).toArray();
    console.log(JSON.stringify({ count: docs.length, modalidades: docs }, null, 2));
  } catch (err) {
    console.error('Erro ao listar modalidades:', err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
