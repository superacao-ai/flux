// Script para verificar permissões de um usuário no banco
const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

async function checkUserPermissions() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Conectado ao MongoDB');

    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');
    
    // Buscar todos os usuários e mostrar suas permissões
    const users = await User.find({}).select('nome email permissoes').lean();
    
    console.log('\n=== Permissões dos Usuários ===\n');
    
    for (const user of users) {
      console.log(`\n👤 ${user.nome} (${user.email})`);
      console.log('   Permissões:', JSON.stringify(user.permissoes, null, 2));
    }
    
    await mongoose.disconnect();
    console.log('\nDesconectado do MongoDB');
  } catch (error) {
    console.error('Erro:', error);
    process.exit(1);
  }
}

checkUserPermissions();
