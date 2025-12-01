// scripts/delete-all-aulas-realizadas.js
// Script para apagar todos os registros de aulas realizadas

const mongoose = require('mongoose');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/superagenda';

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log('Conectado ao MongoDB');

  const AulaRealizada = mongoose.model(
    'AulaRealizada',
    new mongoose.Schema({}, { strict: false }),
    'aulasrealizadas' // nome da coleção
  );

  const result = await AulaRealizada.deleteMany({});
  console.log(`Registros apagados: ${result.deletedCount}`);

  await mongoose.disconnect();
  console.log('Desconectado do MongoDB');
}

main().catch(err => {
  console.error('Erro ao apagar aulas realizadas:', err);
  process.exit(1);
});
