const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const HorarioFixoSchema = require('../src/models/HorarioFixo').HorarioFixo;
const mongoUri = process.env.MONGODB_URI;

async function testFrozenStudent() {
  try {
    await mongoose.connect(mongoUri);
    console.log('✓ Conectado ao MongoDB');

    // Encontrar um horário com aluno
    const horario = await HorarioFixoSchema.findOne({ alunoId: { $ne: null }, ativo: true })
      .populate('alunoId', 'nome')
      .lean();

    if (!horario) {
      console.log('✗ Nenhum horário encontrado com aluno');
      process.exit(0);
    }

    console.log(`Marcando horário ${horario._id} (${horario.alunoId?.nome}) como congelado...`);

    // Atualizar para congelado
    await HorarioFixoSchema.updateOne(
      { _id: horario._id },
      { congelado: true }
    );

    // Verificar
    const updated = await HorarioFixoSchema.findOne({ _id: horario._id }).lean();
    console.log('✓ Horário atualizado:', {
      congelado: updated.congelado,
      ausente: updated.ausente,
      emEspera: updated.emEspera
    });

    process.exit(0);
  } catch (error) {
    console.error('✗ Erro:', error.message);
    process.exit(1);
  }
}

testFrozenStudent();
