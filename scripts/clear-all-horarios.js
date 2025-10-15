#!/usr/bin/env node
/**
 * scripts/clear-all-horarios.js
 *
 * Faz backup de todos os documentos da coleção `horariofixos` em
 * `scripts/backup-all-horarios-<timestamp>.json` e, após confirmação,
 * deleta todos os documentos da coleção.
 *
 * Uso:
 *   node scripts/clear-all-horarios.js
 *
 * Atenção: operação destrutiva. Certifique-se do backup antes de rodar.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI || process.env.NEXT_PUBLIC_MONGODB_URI || process.env.DATABASE_URL;

if (!MONGODB_URI) {
  console.error('MONGODB_URI não encontrado em .env.local. Abortando.');
  process.exit(1);
}

async function main() {
  console.log('Conectando ao MongoDB...');
  await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  const db = mongoose.connection.db;

  const collectionName = 'horariofixos';
  const col = db.collection(collectionName);

  const count = await col.countDocuments();
  console.log(`Registros encontrados na coleção ${collectionName}: ${count}`);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(__dirname, `backup-all-horarios-${timestamp}.json`);

  if (count === 0) {
    console.log('Nenhum registro para apagar. Saindo.');
    await mongoose.disconnect();
    process.exit(0);
  }

  console.log(`Fazendo backup de todos os documentos para: ${backupPath}`);
  const docs = await col.find({}).toArray();
  fs.writeFileSync(backupPath, JSON.stringify(docs, null, 2), 'utf8');
  console.log('Backup concluído.');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question("ESTA AÇÃO IRREVERSÍVEL apagará TODOS os horários. Digite 'SIM' para confirmar: ", async (answer) => {
    rl.close();
    if (answer !== 'SIM') {
      console.log('Operação cancelada pelo usuário. Nenhuma alteração foi feita.');
      await mongoose.disconnect();
      process.exit(0);
    }

    try {
      const delResult = await col.deleteMany({});
      console.log(`Documentos apagados: ${delResult.deletedCount}`);
      console.log('Operação concluída com sucesso.');
    } catch (err) {
      console.error('Erro ao apagar documentos:', err);
    } finally {
      await mongoose.disconnect();
      process.exit(0);
    }
  });
}

main().catch(err => {
  console.error('Erro no script:', err);
  process.exit(1);
});
