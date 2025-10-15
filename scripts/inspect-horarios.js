#!/usr/bin/env node
// scripts/inspect-horarios.js
// Lista documentos da coleção horariofixos para inspeção rápida

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
  const col = db.collection('horariofixos');

  const docs = await col.find({}).limit(500).toArray();
  console.log(`Encontrados ${docs.length} documentos em horariofixos`);
  docs.forEach(d => {
    console.log('---');
    console.log('_id:', d._id);
    console.log('alunoId:', d.alunoId);
    console.log('professorId:', d.professorId);
    console.log('diaSemana:', d.diaSemana, 'horario:', d.horarioInicio, '-', d.horarioFim);
    console.log('modalidadeId:', d.modalidadeId);
    console.log('ativo:', d.ativo);
    if (d.observacoes) console.log('observacoes:', d.observacoes);
  });

  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
