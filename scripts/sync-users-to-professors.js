// Script para sincronizar Users (tipo professor) com a collection Professor
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({}, { strict: false, collection: 'users' });
const User = mongoose.model('UserSync', UserSchema);

const ProfessorSchema = new mongoose.Schema({}, { strict: false, collection: 'professores' });
const Professor = mongoose.model('ProfessorSync', ProfessorSchema);

async function syncUsersToprofessors() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://contatosuperacaotreino_db_user:nk98JOOIl2xgOh3l@cluster0.lsfahx1.mongodb.net/superagenda?retryWrites=true&w=majority&appName=Cluster0';
    await mongoose.connect(mongoUri);
    console.log('✅ Conectado ao MongoDB');

    // Buscar todos os usuários do tipo professor
    const professores = await User.find({ tipo: 'professor', ativo: true });
    console.log(`\n📋 Encontrados ${professores.length} professores na collection Users`);

    let criados = 0;
    let atualizados = 0;
    let ignorados = 0;

    for (const user of professores) {
      // Verificar se já existe um professor com este email
      const professorExistente = await Professor.findOne({ email: user.email });

      if (professorExistente) {
        console.log(`⏭️  Professor já existe: ${user.nome} (${user.email})`);
        ignorados++;
      } else {
        // Criar novo professor
        const novoProfessor = await Professor.create({
          nome: user.nome,
          email: user.email,
          telefone: user.telefone || '',
          cor: user.cor || '#3B82F6',
          especialidades: user.especialidades || [],
          ativo: true,
          criadoEm: new Date(),
          atualizadoEm: new Date(),
        });
        console.log(`✅ Professor criado: ${user.nome} (${user.email}) - ID: ${novoProfessor._id}`);
        criados++;
      }
    }

    console.log('\n📊 Resumo:');
    console.log(`   ✅ Criados: ${criados}`);
    console.log(`   ⏭️  Ignorados (já existiam): ${ignorados}`);
    console.log(`   📝 Total processados: ${professores.length}`);

    await mongoose.connection.close();
    console.log('\n✅ Sincronização concluída!');
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

syncUsersToprofessors();
