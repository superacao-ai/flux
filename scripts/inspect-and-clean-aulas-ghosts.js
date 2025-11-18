#!/usr/bin/env node
/**
 * scripts/inspect-and-clean-aulas-ghosts.js
 *
 * Lista possíveis "aulas fantasmas" na coleção `AulaRealizada` e permite
 * que o usuário escolha quais documentos apagar. Faz backup dos documentos
 * a serem apagados em `scripts/backup-aulas-ghosts-<timestamp>.json` antes.
 *
 * Critérios usados para sugerir candidatos:
 *  - `alunos` vazio OU `total_alunos === 0`
 *  - `data` inválida ou com ano < 2000 ou > nextYear
 *  - duplicatas: mesma `horarioFixoId` + mesma `data` (mantém o mais recente)
 *
 * Uso:
 *  node scripts/inspect-and-clean-aulas-ghosts.js
 *
 * Segurança: o script NÃO apaga nada sem confirmação explícita.
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

function isoDate(d) {
  try { return new Date(d).toISOString(); } catch (e) { return String(d); }
}

async function main() {
  console.log('Conectando ao MongoDB...');
  await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

  // Tentar importar o model; se falhar, usar coleção direta
  let AulaRealizadaModel;
  try {
    AulaRealizadaModel = require(path.join(__dirname, '..', 'src', 'models', 'aularealizada'));
    AulaRealizadaModel = AulaRealizadaModel && AulaRealizadaModel.default ? AulaRealizadaModel.default : AulaRealizadaModel;
  } catch (err) {
    AulaRealizadaModel = null;
    console.warn('Não foi possível importar model AulaRealizada; usarei coleção direta:', err.message);
  }

  const db = mongoose.connection.db;
  const collectionName = AulaRealizadaModel && AulaRealizadaModel.collection ? AulaRealizadaModel.collection.name : 'aularealizadas';
  const col = db.collection(collectionName);

  const all = await col.find({}).toArray();
  console.log(`Total de documentos na coleção ${collectionName}: ${all.length}`);

  const now = new Date();
  const nextYear = now.getFullYear() + 1;

  // Identificar candidatos
  const candidatesMap = new Map();
  const duplicatesMap = new Map();

  for (const doc of all) {
    const id = String(doc._id);
    let flagged = false;
    const reasons = [];

    // alunos vazio OR total_alunos zero
    const alunosLen = Array.isArray(doc.alunos) ? doc.alunos.length : 0;
    if (alunosLen === 0 || (doc.total_alunos !== undefined && Number(doc.total_alunos) === 0)) {
      flagged = true;
      reasons.push('zero-alunos');
    }

    // data inválida ou ano fora de intervalo
    let dataDate = null;
    if (doc.data) {
      try { dataDate = new Date(doc.data); } catch (e) { dataDate = null; }
    }
    if (!dataDate || isNaN(dataDate.getTime())) {
      flagged = true;
      reasons.push('data-invalida');
    } else {
      const y = dataDate.getFullYear();
      if (y < 2000 || y > nextYear) {
        flagged = true;
        reasons.push('data-out-of-range');
      }
    }

    // marcar para duplicates map (horarioFixoId + date part)
    const horarioId = doc.horarioFixoId ? String(doc.horarioFixoId) : (doc.horario ? String(doc.horario) : 'no-horario');
    const datePart = dataDate ? dataDate.toISOString().slice(0,10) : 'no-date';
    const dupKey = `${horarioId}::${datePart}`;
    if (!duplicatesMap.has(dupKey)) duplicatesMap.set(dupKey, []);
    duplicatesMap.get(dupKey).push(doc);

    if (flagged) {
      candidatesMap.set(id, { doc, reasons });
    }
  }

  // Add duplicates with more than 1 entry as candidates (keep the most recent by `enviouEm` or `updatedAt`)
  for (const [key, docs] of duplicatesMap.entries()) {
    if (docs.length > 1) {
      // sort by enviouEm or updatedAt or createdAt descending
      docs.sort((a,b) => {
        const ta = (a.enviouEm || a.updatedAt || a.createdAt || 0).valueOf ? new Date(a.enviouEm || a.updatedAt || a.createdAt).valueOf() : 0;
        const tb = (b.enviouEm || b.updatedAt || b.createdAt || 0).valueOf ? new Date(b.enviouEm || b.updatedAt || b.createdAt).valueOf() : 0;
        return tb - ta;
      });
      // keep index 0, mark others as duplicates
      for (let i = 1; i < docs.length; i++) {
        const id = String(docs[i]._id);
        if (!candidatesMap.has(id)) candidatesMap.set(id, { doc: docs[i], reasons: ['duplicate'] });
        else candidatesMap.get(id).reasons.push('duplicate');
      }
    }
  }

  if (candidatesMap.size === 0) {
    console.log('Nenhum candidato a "aula fantasma" encontrado com os critérios aplicados.');
    await mongoose.disconnect();
    process.exit(0);
  }

  const candidates = Array.from(candidatesMap.values()).map(c => c.doc);

  console.log('\nPossíveis aulas fantasmas encontradas (id, data, horarioFixoId, total_alunos, alunos.length, motivos):\n');
  candidates.forEach((doc, idx) => {
    const id = String(doc._id);
    const dataStr = doc.data ? (new Date(doc.data).toISOString().slice(0,10)) : 'no-date';
    const horarioId = doc.horarioFixoId ? String(doc.horarioFixoId) : (doc.horario || 'no-horario');
    const total = doc.total_alunos !== undefined ? doc.total_alunos : (Array.isArray(doc.alunos) ? doc.alunos.length : 'unknown');
    const alunosLen = Array.isArray(doc.alunos) ? doc.alunos.length : 0;
    const reasons = candidatesMap.get(id).reasons.join(',');
    console.log(`${idx + 1}) ${id} | ${dataStr} | ${horarioId} | total_alunos=${total} | alunos=${alunosLen} | motivos=${reasons}`);
  });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(__dirname, `backup-aulas-ghosts-${timestamp}.json`);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const prompt = `\nDigite números separados por vírgula para apagar (ex: 1,3), ou 'all' para apagar todos os ${candidates.length} listados, ou 'quit' para sair: `;

  rl.question(prompt, async (answer) => {
    rl.close();
    const ans = String(answer || '').trim();
    if (!ans || ans.toLowerCase() === 'quit') {
      console.log('Nenhuma ação realizada. Saindo.');
      await mongoose.disconnect();
      process.exit(0);
    }

    let toDelete = [];
    if (ans.toLowerCase() === 'all') {
      toDelete = candidates;
    } else {
      const parts = ans.split(',').map(s => s.trim()).filter(Boolean);
      for (const p of parts) {
        const n = Number(p);
        if (!isNaN(n) && n >= 1 && n <= candidates.length) {
          toDelete.push(candidates[n-1]);
        } else {
          console.warn(`Ignorando entrada inválida: ${p}`);
        }
      }
    }

    if (toDelete.length === 0) {
      console.log('Nenhum documento selecionado para exclusão. Saindo.');
      await mongoose.disconnect();
      process.exit(0);
    }

    // backup selected docs
    fs.writeFileSync(backupPath, JSON.stringify(toDelete, null, 2), 'utf8');
    console.log(`Backup dos documentos selecionados salvo em: ${backupPath}`);

    const rl2 = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl2.question(`Confirme a exclusão de ${toDelete.length} documentos digitando 'SIM': `, async (confirm) => {
      rl2.close();
      if (confirm !== 'SIM') {
        console.log('Exclusão cancelada pelo usuário. Nenhuma alteração feita.');
        await mongoose.disconnect();
        process.exit(0);
      }

      const ids = toDelete.map(d => ({ _id: new mongoose.Types.ObjectId(String(d._id)) }));
      try {
        const idsOnly = toDelete.map(d => String(d._id));
        const delRes = await col.deleteMany({ _id: { $in: idsOnly.map(id => new mongoose.Types.ObjectId(id)) } });
        console.log(`Documentos apagados: ${delRes.deletedCount}`);
      } catch (err) {
        console.error('Erro ao apagar documentos:', err);
      } finally {
        await mongoose.disconnect();
        process.exit(0);
      }
    });
  });
}

main().catch(err => {
  console.error('Erro no script:', err);
  process.exit(1);
});
