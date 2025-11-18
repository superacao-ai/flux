#!/usr/bin/env node
// scripts/find-suspect-aulas.js
// Lista aulas-realizadas suspeitas para revisão antes de exclusão

const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI || process.env.NEXT_PUBLIC_MONGODB_URI || process.env.DATABASE_URL;
if (!MONGODB_URI) {
  console.error('MONGODB_URI não encontrado em .env.local');
  process.exit(1);
}

async function main() {
  await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  const db = mongoose.connection.db;
  const aulasCol = db.collection('aulasrealizadas');
  const horariosCol = db.collection('horariofixos');

  // Criteria:
  // 1) Missing or falsy horarioFixoId
  // 2) horarioFixoId present but no matching horariofixos document
  // 3) No alunos or alunos array empty

  console.log('Procurando aulas com horarioFixoId ausente...');
  const noHorario = await aulasCol.find({ $or: [{ horarioFixoId: { $exists: false } }, { horarioFixoId: null }, { horarioFixoId: '' }] }).toArray();
  console.log(`Encontradas ${noHorario.length} aulas sem horarioFixoId`);
  noHorario.forEach(a => console.log('-', a._id?.toString(), 'data:', a.data, 'modalidade:', a.modalidade));

  console.log('\nProcurando aulas com alunos vazios...');
  const semAlunos = await aulasCol.find({ $or: [{ alunos: { $exists: false } }, { alunos: { $size: 0 } }] }).toArray();
  console.log(`Encontradas ${semAlunos.length} aulas com lista de alunos vazia ou ausente`);
  semAlunos.forEach(a => console.log('-', a._id?.toString(), 'data:', a.data, 'modalidade:', a.modalidade));

  console.log('\nProcurando aulas cujo horarioFixoId não existe em horariofixos... (isso pode ser lento)');
  const allWithHorario = await aulasCol.find({ horarioFixoId: { $exists: true, $ne: null, $ne: '' } }).toArray();
  const missingHorarioRefs = [];
  for (const a of allWithHorario) {
    try {
      const hfId = a.horarioFixoId;
      const exists = await horariosCol.findOne({ _id: hfId });
      if (!exists) missingHorarioRefs.push(a);
    } catch (e) {
      // if lookup fails, treat as missing
      missingHorarioRefs.push(a);
    }
  }
  console.log(`Encontradas ${missingHorarioRefs.length} aulas referenciando horariofixos ausente`);
  missingHorarioRefs.forEach(a => console.log('-', a._id?.toString(), 'data:', a.data, 'horarioFixoId:', a.horarioFixoId));

  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
