const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/superacao-flux';

const presencaSchema = new mongoose.Schema({}, { strict: false, collection: 'presencas' });
const Presenca = mongoose.model('Presenca', presencaSchema);

async function countPresencas() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado ao MongoDB');

    const total = await Presenca.countDocuments();
    console.log('\n📊 Total de presenças no banco:', total);

    const presencas = await Presenca.find().limit(10).lean();
    console.log('\n🔍 Primeiras 10 presenças:');
    presencas.forEach((p, i) => {
      console.log(`\n${i + 1}. ID: ${p._id}`);
      console.log(`   Data: ${p.data}`);
      console.log(`   Presente: ${p.presente}`);
      console.log(`   AlunoId: ${p.alunoId}`);
    });

    // Contar por status
    const presentes = await Presenca.countDocuments({ presente: true });
    const faltas = await Presenca.countDocuments({ presente: false });
    console.log(`\n✅ Presenças: ${presentes}`);
    console.log(`❌ Faltas: ${faltas}`);

    await mongoose.disconnect();
    console.log('\n✅ Desconectado');
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

countPresencas();
