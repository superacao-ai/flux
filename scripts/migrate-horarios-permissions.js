// Script para migrar permissões antigas de horários para as novas
const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

async function migratePermissions() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Conectado ao MongoDB');

    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');
    
    // Buscar todos os usuários com permissões
    const users = await User.find({ permissoes: { $exists: true } }).lean();
    
    console.log(`\n=== Migrando permissões de ${users.length} usuários ===\n`);
    
    for (const user of users) {
      if (!user.permissoes) continue;
      
      const oldHorarios = user.permissoes.horarios || {};
      
      // Migrar: se tinha criarTurma, editarTurma ou excluirTurma, usa o valor deles para gerenciarTurmas
      // Se qualquer um deles era false, gerenciarTurmas será false
      const gerenciarTurmas = (oldHorarios.criarTurma !== false && 
                               oldHorarios.editarTurma !== false && 
                               oldHorarios.excluirTurma !== false);
      
      // Para bloquearHorarios, não existia antes, então será true por padrão
      const bloquearHorarios = true;
      
      // importarLote mantém o valor que tinha
      const importarLote = oldHorarios.importarLote !== false;
      
      const newHorarios = {
        gerenciarTurmas,
        bloquearHorarios,
        importarLote
      };
      
      console.log(`👤 ${user.nome} (${user.email})`);
      console.log(`   Antigo:`, JSON.stringify(oldHorarios));
      console.log(`   Novo:`, JSON.stringify(newHorarios));
      
      // Atualizar no banco
      await User.updateOne(
        { _id: user._id },
        { 
          $set: { 
            'permissoes.horarios': newHorarios 
          }
        }
      );
      
      console.log(`   ✅ Atualizado!\n`);
    }
    
    await mongoose.disconnect();
    console.log('Desconectado do MongoDB');
    console.log('\n✅ Migração concluída!');
  } catch (error) {
    console.error('Erro:', error);
    process.exit(1);
  }
}

migratePermissions();
