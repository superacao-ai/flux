#!/usr/bin/env node
// Script de limpeza: remove horários inválidos (sem professorId) e deduplica templates sem alunoId
// Executar: node scripts/cleanup-invalid-horarios.js

const path = require('path');
const fs = require('fs');

// Ajuste o NODE_ENV para carregar variáveis de ambiente se necessário
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

async function main() {
  // Conectar diretamente usando variável de ambiente (sem importar TS do projeto)
  require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
  const mongoose = require('mongoose');
  const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL;
  if (!MONGODB_URI) {
    console.error('MONGODB_URI não definida. Crie .env.local ou exporte a variável.');
    process.exit(1);
  }
  await mongoose.connect(MONGODB_URI, { bufferCommands: false });

  // Definir um modelo flexível para acessar a coleção existente
  let HorarioFixo;
  try {
    HorarioFixo = mongoose.model('HorarioFixo');
  } catch (e) {
    const schema = new mongoose.Schema({}, { strict: false, collection: 'horariofixos', timestamps: false });
    HorarioFixo = mongoose.model('HorarioFixo', schema);
  }

  // 1) Encontrar horários sem professorId
  const semProfessor = await HorarioFixo.find({ $or: [{ professorId: { $exists: false } }, { professorId: null }] });
  console.log('Registros sem professorId encontrados:', semProfessor.length);
  if (semProfessor.length > 0) {
    const ids = semProfessor.map(s => s._id.toString());
    fs.writeFileSync(path.join(__dirname, 'backup-sem-professor-ids.json'), JSON.stringify(ids, null, 2));
    console.log('IDs salvos em scripts/backup-sem-professor-ids.json');

    // Deletar ou desativar? Vamos desativar (set ativo=false) por segurança
    const res = await HorarioFixo.updateMany({ _id: { $in: ids } }, { $set: { ativo: false } });
    console.log('Registros sem professorId desativados:', res.modifiedCount || res.nModified || 0);
  }

  // 2) Deduplicar templates (horários sem alunoId) que tenham mesmo diaSemana/horaInicio/professorId/modalidadeId
  // Encontrar todos templates agrupados por chave
  const templates = await HorarioFixo.aggregate([
    { $match: { $or: [{ alunoId: { $exists: false } }, { alunoId: null }] } },
    { $group: {
      _id: { professorId: '$professorId', diaSemana: '$diaSemana', horarioInicio: '$horarioInicio', horarioFim: '$horarioFim', modalidadeId: '$modalidadeId' },
      count: { $sum: 1 },
      ids: { $push: '$_id' }
    }},
    { $match: { count: { $gt: 1 } } }
  ]).allowDiskUse(true);

  console.log('Grupos de templates duplicados encontrados:', templates.length);
  const duplicatesToRemove = [];
  for (const group of templates) {
    // vamos manter o primeiro e desativar os outros
    const [keep, ...rest] = group.ids;
    for (const r of rest) duplicatesToRemove.push(r);
  }

  if (duplicatesToRemove.length > 0) {
    fs.writeFileSync(path.join(__dirname, 'backup-duplicate-templates-ids.json'), JSON.stringify(duplicatesToRemove.map(id => id.toString()), null, 2));
    const res2 = await HorarioFixo.updateMany({ _id: { $in: duplicatesToRemove } }, { $set: { ativo: false } });
    console.log('Templates duplicados desativados:', res2.modifiedCount || res2.nModified || 0);
  }

  console.log('Limpeza concluída.');
  process.exit(0);
}

main().catch(err => {
  console.error('Erro no script de limpeza:', err);
  process.exit(1);
});
