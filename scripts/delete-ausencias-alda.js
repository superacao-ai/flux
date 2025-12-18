// Script para apagar ausências confirmadas da aluna Alda

const mongoose = require('mongoose');

// Models
const AvisoAusenciaSchema = new mongoose.Schema({}, { strict: false, collection: 'avisoausencias' });
const AvisoAusencia = mongoose.models.AvisoAusencia || mongoose.model('AvisoAusencia', AvisoAusenciaSchema);

const AlunoSchema = new mongoose.Schema({}, { strict: false, collection: 'alunos' });
const Aluno = mongoose.models.Aluno || mongoose.model('Aluno', AlunoSchema);

async function main() {
  try {
    // Conectar ao MongoDB
    require('dotenv').config({ path: '.env.local' });
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/superagenda';
    await mongoose.connect(mongoUri);
    console.log('✅ Conectado ao MongoDB');

    // Buscar aluna Alda
    const alda = await Aluno.findOne({ nome: /alda/i });
    
    if (!alda) {
      console.log('❌ Aluna Alda não encontrada');
      process.exit(1);
    }

    console.log(`\n📋 Aluna encontrada: ${alda.nome} (ID: ${alda._id})`);

    // Buscar ausências confirmadas da Alda
    const ausencias = await AvisoAusencia.find({
      alunoId: alda._id,
      status: 'confirmada'
    });

    console.log(`\n📊 Encontradas ${ausencias.length} ausências confirmadas:`);
    
    if (ausencias.length === 0) {
      console.log('Nenhuma ausência confirmada encontrada.');
      await mongoose.disconnect();
      return;
    }

    // Mostrar as ausências
    ausencias.forEach((a, i) => {
      console.log(`  ${i + 1}. ID: ${a._id}, Data: ${a.dataAusencia}, Motivo: ${a.motivo || 'sem motivo'}`);
    });

    // Apagar as ausências
    console.log('\n🗑️  Apagando ausências...');
    const resultado = await AvisoAusencia.deleteMany({
      alunoId: alda._id,
      status: 'confirmada'
    });

    console.log(`✅ ${resultado.deletedCount} ausências apagadas com sucesso!`);

    await mongoose.disconnect();
    console.log('✅ Desconectado do MongoDB');
    
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

main();
