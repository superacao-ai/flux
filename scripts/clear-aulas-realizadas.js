#!/usr/bin/env node
/**
 * scripts/clear-aulas-realizadas.js
 *
 * Faz backup de todos os documentos da coleção `AulaRealizada` em
 * `scripts/backup-aulas-realizadas-<timestamp>.json` e, após confirmação,
 * deleta todos os documentos da coleção.
 *
 * Uso:
 *   node scripts/clear-aulas-realizadas.js
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

  // Importar o model para garantir schema/collection correto
  let AulaRealizada;
  try {
    AulaRealizada = require(path.join(__dirname, '..', 'src', 'models', 'aularealizada'));
    AulaRealizada = AulaRealizada && AulaRealizada.default ? AulaRealizada.default : AulaRealizada;
  } catch (err) {
    // fallback para coleção direta
    AulaRealizada = null;
    console.warn('Não foi possível importar o model AulaRealizada, usarei acesso direto à coleção:', err.message);
  }

  const db = mongoose.connection.db;
  const collectionName = AulaRealizada && AulaRealizada.collection ? AulaRealizada.collection.name : 'aularealizadas';
  const col = db.collection(collectionName);

  const count = await col.countDocuments();
  console.log(`Registros encontrados na coleção ${collectionName}: ${count}`);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(__dirname, `backup-aulas-realizadas-${timestamp}.json`);

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
  rl.question("ESTA AÇÃO IRREVERSÍVEL apagará TODOS os registros de aulas realizadas. Digite 'SIM' para confirmar: ", async (answer) => {
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
