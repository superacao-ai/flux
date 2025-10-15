#!/usr/bin/env node
// scripts/aggregate-horarios.js
// Usa aggregation com $lookup para juntar alunos e professores e inspecionar os horários

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

  const agg = [
    { $match: { ativo: true } },
    { $lookup: { from: 'alunos', localField: 'alunoId', foreignField: '_id', as: 'aluno' } },
    { $unwind: { path: '$aluno', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'professors', localField: 'professorId', foreignField: '_id', as: 'prof' } },
    { $unwind: { path: '$prof', preserveNullAndEmptyArrays: true } },
    { $project: { _id:1, aluno: { _id: '$aluno._id', nome: '$aluno.nome' }, prof: { _id: '$prof._id', nome: '$prof.nome' }, diaSemana:1, horarioInicio:1, horarioFim:1, modalidadeId:1, observacoes:1 } },
    { $sort: { diaSemana:1, horarioInicio:1 } }
  ];

  const res = await col.aggregate(agg).toArray();
  console.log('Horários (aggregate) count:', res.length);
  res.forEach(r => {
    console.log('---');
    console.log('_id:', r._id.toString());
    console.log('diaSemana:', r.diaSemana, 'horario:', r.horarioInicio + ' - ' + r.horarioFim);
    console.log('professor:', r.prof && r.prof.nome, 'profId:', r.prof && r.prof._id);
    console.log('aluno:', r.aluno && r.aluno.nome, 'alunoId:', r.aluno && r.aluno._id);
    console.log('modalidadeId:', r.modalidadeId);
    if (r.observacoes) console.log('observacoes:', r.observacoes);
  });

  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
