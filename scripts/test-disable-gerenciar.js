// Script para desabilitar gerenciarTurmas do Lucas para teste
const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

async function disableGerenciarTurmas() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Conectado ao MongoDB');

    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');
    
    await User.updateOne(
      { email: 'lucas@gmail.com' },
      { $set: { 'permissoes.horarios.gerenciarTurmas': false } }
    );
    
    const u = await User.findOne({ email: 'lucas@gmail.com' }).lean();
    console.log('Atualizado!');
    console.log('Permissoes horarios:', JSON.stringify(u.permissoes.horarios, null, 2));
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Erro:', error);
    process.exit(1);
  }
}

disableGerenciarTurmas();
