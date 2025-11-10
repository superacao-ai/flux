const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const mongoUri = process.env.MONGODB_URI;

async function markFrozen() {
  try {
    await mongoose.connect(mongoUri);
    console.log('✓ Conectado ao MongoDB');

    const db = mongoose.connection;
    const horarioCollection = db.collection('horariofixos');

    // Encontrar um horário com aluno e ativo
    let horario = await horarioCollection.findOne({ 
      alunoId: { $exists: true, $ne: null },
      ativo: true 
    });

    if (!horario) {
      console.log('✗ Nenhum horário encontrado com aluno e ativo=true');
      
      // Tentar sem o filtro ativo
      horario = await horarioCollection.findOne({ 
        alunoId: { $exists: true, $ne: null }
      });
      
      if (!horario) {
        console.log('✗ Nenhum horário encontrado com aluno');
        await mongoose.disconnect();
        process.exit(0);
      }
    }

    console.log(`\n📌 Marcando horário como CONGELADO:`);
    console.log(`   ID: ${horario._id}`);
    console.log(`   Aluno ID: ${horario.alunoId}`);
    console.log(`   Ativo: ${horario.ativo}`);

    // Atualizar para congelado
    const result = await horarioCollection.updateOne(
      { _id: horario._id },
      { $set: { congelado: true } }
    );

    console.log(`✓ Atualizado com sucesso`);
    
    // Verificar
    const updated = await horarioCollection.findOne({ _id: horario._id });
    console.log(`\n✓ Verificação: congelado = ${updated.congelado}`);
    
    console.log(`\n🔍 Agora teste no browser:`);
    console.log(`   1. Recarregue http://localhost:3000/horarios`);
    console.log(`   2. Procure pelo aluno`);
    console.log(`   3. Você verá o ícone ❄️ abaixo do nome`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('✗ Erro:', error.message);
    process.exit(1);
  }
}

markFrozen();
