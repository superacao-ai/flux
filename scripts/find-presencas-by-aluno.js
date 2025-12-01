const mongoose = require('mongoose');
const { Types } = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/superacao-flux';

const presencaSchema = new mongoose.Schema({}, { strict: false, collection: 'presencas' });
const Presenca = mongoose.model('Presenca', presencaSchema);

async function findByAluno(alunoId) {
  try {
    await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Conectado ao MongoDB:', MONGODB_URI);

    let query = {};
    if (alunoId) {
      if (Types.ObjectId.isValid(alunoId)) {
        query.alunoId = Types.ObjectId(alunoId);
      } else {
        query.alunoId = alunoId;
      }
    }

    console.log('Query:', query);
    const total = await Presenca.countDocuments(query);
    console.log('\nTotal encontrados:', total);

    const docs = await Presenca.find(query).limit(50).lean();
    docs.forEach((d, i) => {
      console.log('\n---', i + 1, '---');
      console.log('ID:', d._id);
      console.log('data:', d.data);
      console.log('presente:', d.presente);
      console.log('alunoId:', d.alunoId);
      console.log('horarioFixoId:', d.horarioFixoId);
      console.log('compensadaPor:', d.compensadaPor);
    });

    await mongoose.disconnect();
    console.log('\nDesconectado');
  } catch (err) {
    console.error('Erro:', err);
    process.exit(1);
  }
}

const alunoIdArg = process.argv[2];
if (!alunoIdArg) {
  console.error('Uso: node scripts/find-presencas-by-aluno.js <alunoId>');
  process.exit(1);
}

findByAluno(alunoIdArg);