#!/usr/bin/env node
/**
 * scripts/find-problematic-horarios.js
 *
 * Lista e exporta documentos problemáticos na coleção `horariofixos`:
 * - documentos sem `professorId` ou com `professorId` null/empty
 * - documentos cujo `professorId` não existe na coleção `professores` (órfãos)
 * - documentos com `alunoId` armazenado como string vazia ou tipo inesperado
 * - grupos duplicados por (alunoId, diaSemana, horarioInicio) ativos
 *
 * Gera arquivos JSON em `scripts/` com os resultados para inspeção.
 *
 * Uso:
 *   node scripts/find-problematic-horarios.js
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI || process.env.NEXT_PUBLIC_MONGODB_URI || process.env.DATABASE_URL;
if (!MONGODB_URI) {
  console.error('MONGODB_URI não encontrado em .env.local. Abortando.');
  process.exit(1);
}

async function main() {
  await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  const db = mongoose.connection.db;
  const collectionName = 'horariofixos';
  const horariosCol = db.collection(collectionName);
  const professoresCol = db.collection('professors');
  const alunosCol = db.collection('alunos');

  const total = await horariosCol.countDocuments();
  console.log(`Total de documentos em ${collectionName}: ${total}`);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(__dirname);

  // Backup completo (small sample if too large?) - we'll dump all but warn if >10000
  if (total > 10000) {
    console.log(`Coleção muito grande (${total}) - criando backup parcial (primeiros 10000).`);
    const sample = await horariosCol.find({}).limit(10000).toArray();
    fs.writeFileSync(path.join(outDir, `backup-horariofixos-sample-${timestamp}.json`), JSON.stringify(sample, null, 2), 'utf8');
  } else {
    const all = await horariosCol.find({}).toArray();
    fs.writeFileSync(path.join(outDir, `backup-horariofixos-all-${timestamp}.json`), JSON.stringify(all, null, 2), 'utf8');
  }

  // 1) documentos sem professorId (missing/null/empty)
  const noProfessor = await horariosCol.find({ $or: [ { professorId: { $exists: false } }, { professorId: null }, { professorId: '' } ] }).toArray();
  fs.writeFileSync(path.join(outDir, `problem-no-professor-${timestamp}.json`), JSON.stringify(noProfessor, null, 2), 'utf8');
  console.log(`Documentos sem professorId: ${noProfessor.length}`);

  // 2) documentos com professorId órfão (referência não existe)
  // coletar distinct professorIds presentes
  const distinctProfIds = await horariosCol.distinct('professorId', { professorId: { $exists: true, $ne: null } });
  const orphanProfIds = [];
  for (const pid of distinctProfIds) {
    try {
      // skip non-objectid values
      if (!pid) continue;
      const exists = await professoresCol.findOne({ _id: pid });
      if (!exists) orphanProfIds.push(pid);
    } catch (err) {
      // ignore invalid id types
      orphanProfIds.push(pid);
    }
  }
  let orphanDocs = [];
  if (orphanProfIds.length > 0) {
    orphanDocs = await horariosCol.find({ professorId: { $in: orphanProfIds } }).toArray();
  }
  fs.writeFileSync(path.join(outDir, `problem-orphan-professor-${timestamp}.json`), JSON.stringify(orphanDocs, null, 2), 'utf8');
  console.log(`Documentos com professorId órfão (referência inexistente): ${orphanDocs.length}`);

  // 3) documentos com alunoId tipo string ou vazio (potencial origem de conflito)
  const invalidAlunoIdDocs = await horariosCol.find({ $or: [ { alunoId: '' }, { alunoId: { $type: 'string' } } ] }).toArray();
  fs.writeFileSync(path.join(outDir, `problem-invalid-alunoId-${timestamp}.json`), JSON.stringify(invalidAlunoIdDocs, null, 2), 'utf8');
  console.log(`Documentos com alunoId inválido (string/empty): ${invalidAlunoIdDocs.length}`);

  // 4) duplicatas por (alunoId, diaSemana, horarioInicio) quando ativo = true
  const dupAgg = await horariosCol.aggregate([
    { $match: { alunoId: { $exists: true, $ne: null }, ativo: true } },
    { $group: { _id: { alunoId: '$alunoId', diaSemana: '$diaSemana', horarioInicio: '$horarioInicio' }, count: { $sum: 1 }, ids: { $push: '$_id' } } },
    { $match: { count: { $gt: 1 } } }
  ]).toArray();

  const dupGroups = [];
  for (const g of dupAgg) {
    const docs = await horariosCol.find({ _id: { $in: g.ids } }).toArray();
    dupGroups.push({ group: g._id, count: g.count, docs });
  }
  fs.writeFileSync(path.join(outDir, `problem-duplicate-aluno-${timestamp}.json`), JSON.stringify(dupGroups, null, 2), 'utf8');
  console.log(`Grupos duplicados por (alunoId, diaSemana, horarioInicio): ${dupGroups.length}`);

  // 5) listar registros ativos por dia/horario/professor que não aparecem na grade? We can sample active records and print summary
  const activeCount = await horariosCol.countDocuments({ ativo: true });
  console.log(`Registros ativos: ${activeCount}`);

  console.log('Arquivos gerados em scripts/:');
  console.log(fs.readdirSync(outDir).filter(f => f.startsWith('problem-') || f.startsWith('backup-horariofixos')));

  await mongoose.disconnect();
  console.log('Concluído. Verifique os arquivos JSON em scripts/ para análise.');
}

main().catch(err => {
  console.error('Erro no script:', err);
  process.exit(1);
});
