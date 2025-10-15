#!/usr/bin/env node
// scripts/fetch-horarios-debug.js
// Connecta ao MongoDB e imprime os documentos como a API GET /api/horarios os retornaria

const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });
// Define minimal schema inline to avoid importing project files
const mongooseLib = require('mongoose');
const Schema = mongooseLib.Schema;
const HorarioSchema = new Schema({}, { strict: false });
const HorarioFixo = mongooseLib.models.HorarioFixo || mongooseLib.model('HorarioFixo', HorarioSchema, 'horariofixos');

const MONGODB_URI = process.env.MONGODB_URI || process.env.NEXT_PUBLIC_MONGODB_URI || process.env.DATABASE_URL;
if (!MONGODB_URI) {
  console.error('MONGODB_URI não encontrado em .env.local');
  process.exit(1);
}

async function main() {
  await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  try {
    const horarios = await HorarioFixo.find({ ativo: true, professorId: { $exists: true, $ne: null } })
      .populate({ path: 'alunoId', select: 'nome email modalidadeId', populate: { path: 'modalidadeId', select: 'nome cor' }, options: { strictPopulate: false } })
      .populate({ path: 'professorId', select: 'nome especialidade', options: { strictPopulate: false } })
      .sort({ diaSemana: 1, horarioInicio: 1 })
      .select('-__v')
      .lean();

    console.log('Horários retornados (length):', horarios.length);
    horarios.forEach(h => {
      console.log('---');
      console.log('_id:', h._id);
      console.log('diaSemana:', h.diaSemana, 'horario:', h.horarioInicio, '-', h.horarioFim);
      console.log('professor:', h.professorId && h.professorId.nome);
      console.log('alunoId:', h.alunoId && (h.alunoId.nome || h.alunoId._id));
      console.log('aluno.modalidadeId:', h.alunoId && h.alunoId.modalidadeId && h.alunoId.modalidadeId._id);
      console.log('document.modalidadeId:', h.modalidadeId && h.modalidadeId.toString());
    });
  } catch (err) {
    console.error('Erro:', err);
  } finally {
    await mongoose.disconnect();
  }
}

main();
