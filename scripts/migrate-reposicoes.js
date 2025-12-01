#!/usr/bin/env node
/*
  Script para inicializar o campo `reposicoesDisponiveis` em Matricula
  Regra: reposicoesDisponiveis = totalFaltasRegistradas - totalReposicoesUsadas

  Usage: node scripts/migrate-reposicoes.js
  Make sure .env.local is present or env vars set for DB connection.
*/

const connectDB = require('../src/lib/mongodb').default;
const mongoose = require('mongoose');

async function run() {
  try {
    await connectDB();
    const Matricula = require('../src/models/Matricula').Matricula;
    const Presenca = require('../src/models/Presenca').default;
    const Reagendamento = require('../src/models/Reagendamento').Reagendamento;

    const all = await Matricula.find({}).lean();
    console.log('Total matriculas:', all.length);

    let updated = 0;
    for (const m of all) {
      try {
        const faltas = await Presenca.countDocuments({ alunoId: m.alunoId, horarioFixoId: m.horarioFixoId, presente: false });
        const reposUsadas = await Reagendamento.countDocuments({ matriculaId: m._id, isReposicao: true });
        const saldo = Math.max(0, faltas - reposUsadas);
        if ((m.reposicoesDisponiveis || 0) !== saldo) {
          await Matricula.updateOne({ _id: m._id }, { $set: { reposicoesDisponiveis: saldo } });
          updated++;
        }
      } catch (e) {
        console.error('Erro ao processar matricula', m._id, e);
      }
    }

    console.log('Atualizadas:', updated);
    process.exit(0);
  } catch (err) {
    console.error('Erro no migration:', err);
    process.exit(1);
  } finally {
    try { await mongoose.disconnect(); } catch (e) {}
  }
}

run();
