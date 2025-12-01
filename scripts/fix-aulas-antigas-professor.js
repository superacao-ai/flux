// Script para corrigir professorId das aulas antigas
// Mapeia User._id -> Professor._id e atualiza AulaRealizada
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({}, { strict: false, collection: 'users' });
const User = mongoose.model('UserFix', UserSchema);

const ProfessorSchema = new mongoose.Schema({}, { strict: false, collection: 'professores' });
const Professor = mongoose.model('ProfessorFix', ProfessorSchema);

const AulaRealizadaSchema = new mongoose.Schema({}, { strict: false, collection: 'aulasrealizadas' });
const AulaRealizada = mongoose.model('AulaRealizadaFix', AulaRealizadaSchema);

async function fixAulasAntigas() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://contatosuperacaotreino_db_user:nk98JOOIl2xgOh3l@cluster0.lsfahx1.mongodb.net/superagenda?retryWrites=true&w=majority&appName=Cluster0';
    await mongoose.connect(mongoUri);
    console.log('✅ Conectado ao MongoDB\n');

    // 1. Buscar todas as aulas com professorId preenchido
    const aulasComProfessor = await AulaRealizada.find({ 
      professorId: { $exists: true, $ne: null } 
    });
    
    console.log(`📋 Encontradas ${aulasComProfessor.length} aulas com professorId\n`);

    if (aulasComProfessor.length === 0) {
      console.log('✅ Nenhuma aula para corrigir!');
      await mongoose.connection.close();
      return;
    }

    // 2. Criar mapa User._id -> email
    const userIds = [...new Set(aulasComProfessor.map(a => String(a.professorId)))];
    const users = await User.find({ _id: { $in: userIds } });
    
    const userIdToEmail = new Map();
    users.forEach(u => {
      userIdToEmail.set(String(u._id), u.email);
    });

    console.log(`📧 Mapeados ${userIdToEmail.size} usuários`);

    // 3. Criar mapa email -> Professor._id
    const emails = Array.from(userIdToEmail.values());
    const professores = await Professor.find({ email: { $in: emails } });
    
    const emailToProfessorId = new Map();
    professores.forEach(p => {
      emailToProfessorId.set(p.email, p._id);
    });

    console.log(`👨‍🏫 Mapeados ${emailToProfessorId.size} professores\n`);

    // 4. Atualizar aulas
    let corrigidas = 0;
    let ignoradas = 0;
    let erros = 0;

    for (const aula of aulasComProfessor) {
      const userId = String(aula.professorId);
      const email = userIdToEmail.get(userId);
      
      if (!email) {
        console.log(`⚠️  Aula ${aula._id}: User não encontrado (${userId})`);
        ignoradas++;
        continue;
      }

      const professorId = emailToProfessorId.get(email);
      
      if (!professorId) {
        console.log(`⚠️  Aula ${aula._id}: Professor não encontrado para email ${email}`);
        ignoradas++;
        continue;
      }

      // Verificar se já está correto
      if (String(aula.professorId) === String(professorId)) {
        ignoradas++;
        continue;
      }

      try {
        await AulaRealizada.updateOne(
          { _id: aula._id },
          { $set: { professorId: professorId } }
        );
        console.log(`✅ Aula ${aula._id}: ${email} - User ${userId} → Professor ${professorId}`);
        corrigidas++;
      } catch (err) {
        console.error(`❌ Erro ao atualizar aula ${aula._id}:`, err.message);
        erros++;
      }
    }

    console.log('\n📊 Resumo:');
    console.log(`   ✅ Corrigidas: ${corrigidas}`);
    console.log(`   ⏭️  Ignoradas: ${ignoradas}`);
    console.log(`   ❌ Erros: ${erros}`);
    console.log(`   📝 Total processadas: ${aulasComProfessor.length}`);

    await mongoose.connection.close();
    console.log('\n✅ Migração concluída!');
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

fixAulasAntigas();
