#!/usr/bin/env node
/**
 * scripts/clear-db-except-users.js
 *
 * Faz backup de todas as coleções do banco e apaga todos os documentos
 * exceto os da coleção `users` (dados de login).
 *
 * Uso:
 *   node scripts/clear-db-except-users.js [--yes]
 *
 * - Sem flags: pedirá confirmação interativa (digite SIM).
 * - --yes: pula confirmação e executa.
 *
 * Segurança: operação destrutiva. O script faz backup JSON antes de apagar.
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

// coleções a preservar (dados de login e professores)
const PRESERVE = ['users', 'professors', 'professores'];

async function backupAndClear(skipConfirm) {
  console.log('Conectando ao MongoDB...');
  await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  const db = mongoose.connection.db;

  const collections = await db.listCollections().toArray();
  const colNames = collections.map(c => c.name).filter(n => !n.startsWith('system.'));

  console.log('Coleções encontradas:', colNames.join(', '));

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(__dirname, `backups-${timestamp}`);
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);

  // Backup each collection
  for (const name of colNames) {
    console.log(`Fazendo backup da coleção: ${name}`);
    const col = db.collection(name);
    // For safety, limit huge exports? We'll export all but warn
    const count = await col.countDocuments();
    console.log(`  Documentos: ${count}`);
    const outPath = path.join(backupDir, `${name}-${timestamp}.json`);
    const docs = await col.find({}).toArray();
    fs.writeFileSync(outPath, JSON.stringify(docs, null, 2), 'utf8');
    console.log(`  Backup gravado em: ${outPath}`);
  }

  // Show summary and confirm
  console.log('\nBackup completo. Resumo:');
  console.log(fs.readdirSync(backupDir).map(f => `  - ${f}`).join('\n'));

  const doDelete = async () => {
    for (const name of colNames) {
      if (PRESERVE.includes(name)) {
        console.log(`Pulando coleção preservada: ${name}`);
        continue;
      }
      const col = db.collection(name);
      const before = await col.countDocuments();
      if (before === 0) {
        console.log(`Coleção ${name} já vazia.`);
        continue;
      }
      const res = await col.deleteMany({});
      console.log(`Coleção ${name}: documentos apagados = ${res.deletedCount}`);
    }
    console.log('\nLimpeza concluída. Coleções preservadas:', PRESERVE.join(', '));
    await mongoose.disconnect();
  };

  if (skipConfirm) {
    console.log('Flag --yes detectada, executando limpeza sem confirmação.');
    await doDelete();
    return;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question("ESTA AÇÃO APAGARÁ TODOS OS DOCUMENTOS (exceto 'users'). Digite 'SIM' para confirmar: ", async (answer) => {
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
