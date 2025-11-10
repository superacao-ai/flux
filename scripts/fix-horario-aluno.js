const mongoose = require('mongoose');
const { HorarioFixo } = require('../src/models/HorarioFixo');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/superagenda';

async function fixHorarioAluno() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado ao MongoDB');

    const horarioId = '69092554af3a77384ad22c50';
    const alunoId = '6909255baf3a77384ad22c58';

    // Verificar o horário antes
    const horarioAntes = await HorarioFixo.findById(horarioId);
    console.log('\n📋 Horário ANTES:');
    console.log('  alunoId:', horarioAntes?.alunoId);
    console.log('  professorId:', horarioAntes?.professorId);

    // Vincular o aluno ao horário
    const resultado = await HorarioFixo.findByIdAndUpdate(
      horarioId,
      { $set: { alunoId: new mongoose.Types.ObjectId(alunoId) } },
      { new: true }
    );

    console.log('\n✅ Horário atualizado!');
    console.log('  alunoId:', resultado?.alunoId);

    // Verificar com populate
    const horarioPopulado = await HorarioFixo.findById(horarioId)
      .populate('alunoId', 'nome congelado ausente emEspera periodoTreino parceria');
    
    console.log('\n📋 Horário DEPOIS (populado):');
    console.log('  aluno.nome:', horarioPopulado?.alunoId?.nome);
    console.log('  aluno.congelado:', horarioPopulado?.alunoId?.congelado);
    console.log('  aluno.ausente:', horarioPopulado?.alunoId?.ausente);
    console.log('  aluno.emEspera:', horarioPopulado?.alunoId?.emEspera);

    await mongoose.disconnect();
    console.log('\n✅ Concluído!');
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

fixHorarioAluno();
