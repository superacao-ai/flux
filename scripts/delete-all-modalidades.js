#!/usr/bin/env node
require('dotenv').config();
const { MongoClient } = require('mongodb');
const readline = require('readline');

const uri = process.env.MONGODB_URI || process.env.NEXT_PUBLIC_MONGODB_URI || process.env.MONGO_URI;
if (!uri) {
  console.error('ERRO: MONGODB_URI não definido. Configure no .env (MONGODB_URI).');
  process.exit(1);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

console.log('ATENÇÃO: Isto irá REMOVER TODOS os documentos da coleção "modalidades".');
rl.question('Digite "DELETE" para confirmar: ', async (answer) => {
  rl.close();
  if (answer !== 'DELETE') {
    console.log('Operação abortada pelo usuário.');
    process.exit(0);
  }

  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  try {
    await client.connect();
    const db = process.env.MONGODB_DBNAME ? client.db(process.env.MONGODB_DBNAME) : client.db();
    const res = await db.collection('modalidades').deleteMany({});
    console.log(`Operação concluída. Documentos removidos: ${res.deletedCount}`);
  } catch (err) {
    console.error('Erro durante a operação:', err);
    process.exit(1);
  } finally {
    await client.close();
    process.exit(0);
  }
});
