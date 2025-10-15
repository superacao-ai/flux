#!/usr/bin/env node
/**
 * scripts/restore-from-backup.js
 *
 * Restaura coleções a partir de um diretório de backup gerado pelo script
 * `clear-db-except-users.js` (ou parecido). O diretório de backup contém
 * arquivos JSON nomeados <collection>-<timestamp>.json.
 *
 * Uso:
 *   node scripts/restore-from-backup.js <backup-directory> [--yes]
 *
 * O script converte campos `_id` e campos terminados em `Id` que sejam
 * strings hex para ObjectId antes de inserir no MongoDB.
 *
 * Segurança: por padrão o script limpa (deleteMany) a coleção alvo antes de
 * inserir os documentos do backup. Use --yes para pular a confirmação.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI || process.env.NEXT_PUBLIC_MONGODB_URI || process.env.DATABASE_URL;
if (!MONGODB_URI) {
  console.error('MONGODB_URI não encontrado em .env.local');
  process.exit(1);
}

function isHexStringId(val) {
  return typeof val === 'string' && /^[a-fA-F0-9]{24}$/.test(val);
}

function convertIds(obj) {
  if (Array.isArray(obj)) return obj.map(convertIds);
  if (obj === null || typeof obj !== 'object') return obj;
  const out = {};
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (k === '_id' && isHexStringId(v)) {
      out[k] = new mongoose.Types.ObjectId(v);
    } else if (k.endsWith('Id') && isHexStringId(v)) {
      out[k] = new mongoose.Types.ObjectId(v);
    } else if (typeof v === 'object' && v !== null) {
      out[k] = convertIds(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

async function restoreFromDir(backupDir, skipConfirm) {
  if (!fs.existsSync(backupDir) || !fs.statSync(backupDir).isDirectory()) {
    console.error('Diretório de backup não encontrado:', backupDir);
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  const db = mongoose.connection.db;

  const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.json'));
  if (files.length === 0) {
    console.error('Nenhum arquivo JSON encontrado no diretório de backup');
    process.exit(1);
  }

  console.log('Arquivos encontrados para restaurar:');
  files.forEach(f => console.log(' -', f));

  const doRestore = async () => {
    for (const file of files) {
      const full = path.join(backupDir, file);
      const raw = fs.readFileSync(full, 'utf8');
      let docs;
      try {
        docs = JSON.parse(raw);
      } catch (err) {
        console.error('Erro ao parsear JSON:', file, err);
        continue;
      }
      if (!Array.isArray(docs)) {
        console.warn('Arquivo não contém um array, pulando:', file);
        continue;
      }

      // derive collection name from filename
      const name = file.split('-')[0];
      const col = db.collection(name);

      console.log(`\nRestaurando coleção '${name}' (${docs.length} documentos)`);
      // Convert IDs
      const converted = docs.map(d => convertIds(d));

      // Clear collection then insert
      const before = await col.countDocuments();
      if (before > 0) {
        console.log(`  Coleção '${name}' já tem ${before} documentos. Limpando antes de restaurar.`);
      }
      await col.deleteMany({});
      if (converted.length > 0) {
        const res = await col.insertMany(converted);
        console.log(`  Inseridos: ${res.insertedCount}`);
      }
    }

    console.log('\nRestauração concluída.');
    await mongoose.disconnect();
  };

  if (skipConfirm) {
    await doRestore();
    return;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question("Irá limpar e restaurar as coleções a partir do backup. Digite 'SIM' para confirmar: ", async (answer) => {
    rl.close();
    if (answer !== 'SIM') {
      console.log('Operação cancelada.');
      await mongoose.disconnect();
      process.exit(0);
    }
    await doRestore();
  });
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Uso: node scripts/restore-from-backup.js <backup-directory> [--yes]');
  process.exit(1);
}
const backupDir = args[0];
const skip = args.includes('--yes') || args.includes('-y');
restoreFromDir(backupDir, skip).catch(err => { console.error('Erro:', err); process.exit(1); });
