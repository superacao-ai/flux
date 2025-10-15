#!/usr/bin/env node
/**
 * scripts/clear-modalidades.js
 *
 * Apaga todos os documentos da coleção `modalidades`.
 * Uso: node scripts/clear-modalidades.js [--yes]
 * - sem flags: pede confirmação interativa
 * - --yes: executa sem pedir
 *
 * Faz um backup JSON dos documentos antes de apagar, salvo em ./modalidades-backup-<timestamp>.json
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

async function backupAndClear(skipConfirm) {
  console.log('Conectando ao MongoDB...');
  await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  const db = mongoose.connection.db;
  const col = db.collection('modalidades');
  const count = await col.countDocuments();
  console.log(`Coleção modalidades: ${count} documentos encontrados.`);
  if (count === 0) {
    console.log('Nada a apagar. Saindo.');
    await mongoose.disconnect();
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = path.join(__dirname, `modalidades-backup-${timestamp}.json`);
  const docs = await col.find({}).toArray();
  fs.writeFileSync(outPath, JSON.stringify(docs, null, 2), 'utf8');
  console.log(`Backup gravado em: ${outPath}`);

  const doDelete = async () => {
    const res = await col.deleteMany({});
    console.log(`Coleção modalidades: documentos apagados = ${res.deletedCount}`);
    await mongoose.disconnect();
  };

  if (skipConfirm) {
    console.log('Flag --yes detectada, executando limpeza sem confirmação.');
    await doDelete();
    return;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question("ESTA AÇÃO APAGARÁ TODAS AS MODALIDADES. Digite 'SIM' para confirmar: ", async (answer) => {
    rl.close();
    if (answer !== 'SIM') {
      console.log('Operação cancelada pelo usuário. Nenhuma alteração foi feita.');
      await mongoose.disconnect();
      process.exit(0);
    }
    try {
      await doDelete();
    } catch (err) {
      console.error('Erro durante a limpeza:', err);
      await mongoose.disconnect();
      process.exit(1);
    }
  });
}

const skip = process.argv.includes('--yes') || process.argv.includes('-y');
backupAndClear(skip).catch(err => {
  console.error('Erro no script:', err);
  process.exit(1);
});
