// Script para diagnosticar horários sem professor
const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI não definida no .env.local');
  process.exit(1);
}

async function run() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado ao MongoDB');

    const HorarioFixo = mongoose.model('HorarioFixo', new mongoose.Schema({}, { strict: false, collection: 'horariofixos' }));
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false, collection: 'users' }));
    const Professor = mongoose.model('Professor', new mongoose.Schema({}, { strict: false, collection: 'professores' }));

    // Buscar todos os horários ativos
    const horarios = await HorarioFixo.find({ ativo: true }).lean();
    console.log(`\n📊 Total de horários ativos: ${horarios.length}`);

    // Verificar horários sem professorId
    const semProfessor = horarios.filter(h => !h.professorId);
    console.log(`\n❌ Horários SEM professorId: ${semProfessor.length}`);
    if (semProfessor.length > 0) {
      console.log('Primeiros 5:');
      semProfessor.slice(0, 5).forEach(h => {
        console.log(`  - ID: ${h._id}, Dia: ${h.diaSemana}, Horário: ${h.horarioInicio}-${h.horarioFim}`);
      });
    }

    // Verificar horários com professorId que não existe em Professor
    const comProfessor = horarios.filter(h => h.professorId);
    const professorIds = [...new Set(comProfessor.map(h => String(h.professorId)))];
    console.log(`\n🔍 IDs únicos de professores referenciados: ${professorIds.length}`);

    // Verificar quais existem em Professor
    const professoresExistentes = await Professor.find({ _id: { $in: professorIds.map(id => new mongoose.Types.ObjectId(id)) } }).lean();
    const professoresExistentesIds = new Set(professoresExistentes.map(p => String(p._id)));
    console.log(`📋 Professores encontrados na coleção 'professores': ${professoresExistentes.length}`);

    // Verificar quais são na verdade Users
    const professorIdsFaltando = professorIds.filter(id => !professoresExistentesIds.has(id));
    console.log(`\n🔄 IDs de professor que NÃO existem em 'professores': ${professorIdsFaltando.length}`);
    
    if (professorIdsFaltando.length > 0) {
      const usuariosProfessores = await User.find({ _id: { $in: professorIdsFaltando.map(id => new mongoose.Types.ObjectId(id)) } }).lean();
      console.log(`👤 Desses, encontrados na coleção 'users': ${usuariosProfessores.length}`);
      
      if (usuariosProfessores.length > 0) {
        console.log('\nUsuários sendo usados como professores:');
        usuariosProfessores.forEach(u => {
          console.log(`  - ${u.nome} (${u.email}) - tipo: ${u.tipo}`);
        });
      }

      const naoEncontrados = professorIdsFaltando.length - usuariosProfessores.length;
      if (naoEncontrados > 0) {
        console.log(`\n⚠️  ${naoEncontrados} IDs não encontrados em NENHUMA coleção (dados órfãos)`);
      }
    }

    // Estatísticas por modalidade
    console.log('\n📈 Horários por situação de professor:');
    console.log(`  - Com professor válido em 'professores': ${comProfessor.filter(h => professoresExistentesIds.has(String(h.professorId))).length}`);
    console.log(`  - Com ID referenciando 'users': ${professorIdsFaltando.length > 0 ? comProfessor.filter(h => professorIdsFaltando.includes(String(h.professorId))).length : 0}`);
    console.log(`  - Sem professorId: ${semProfessor.length}`);

    mongoose.connection.close();
    console.log('\n✅ Diagnóstico concluído');
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

run();
