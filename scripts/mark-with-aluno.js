const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const mongoUri = process.env.MONGODB_URI;

async function markWithAluno() {
  try {
    await mongoose.connect(mongoUri);
    console.log('✓ Conectado ao MongoDB');

    const db = mongoose.connection;
    const horarioCollection = db.collection('horariofixos');

    // Encontrar um horário COM aluno (não precisa ser ativo)
    const horario = await horarioCollection.findOne({ 
      alunoId: { $exists: true, $ne: null }
    });

    if (!horario) {
      console.log('✗ Nenhum horário encontrado com aluno');
      await mongoose.disconnect();
      process.exit(0);
    }

    console.log(`\n📌 Marcando horário COM ALUNO como CONGELADO:`);
    console.log(`   ID: ${horario._id}`);
    console.log(`   Aluno ID: ${horario.alunoId}`);
    console.log(`   Professor ID: ${horario.professorId}`);
    console.log(`   Dia: ${horario.diaSemana} - ${horario.horarioInicio}`);

    // Buscar nome do aluno
    const alunoCollection = db.collection('alunos');
    const aluno = await alunoCollection.findOne({ _id: horario.alunoId });
    console.log(`   Aluno: ${aluno?.nome || 'Nome não encontrado'}`);

    // Atualizar para congelado
    const result = await horarioCollection.updateOne(
      { _id: horario._id },
      { $set: { congelado: true, ausente: false, emEspera: false } }
    );

    console.log(`✓ Atualizado com sucesso`);
    
    // Verificar
    const updated = await horarioCollection.findOne({ _id: horario._id });
    console.log(`\n✓ Verificação: congelado=${updated.congelado}, ausente=${updated.ausente}, emEspera=${updated.emEspera}`);
    
    console.log(`\n🔍 Agora teste no browser:`);
    console.log(`   1. Recarregue http://localhost:3000/horarios`);
    console.log(`   2. Procure pelo aluno: ${aluno?.nome || 'Nome não encontrado'}`);
    console.log(`   3. Você verá o ícone ❄️ abaixo do nome`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('✗ Erro:', error.message);
    process.exit(1);
  }
}

markWithAluno();
