// Script para adicionar a permissão 'avisos' a todos os usuários admin e root
// Execute com: node scripts/add-avisos-permission.js

const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI;

async function main() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Conectado ao MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('usuarios');

    // Buscar todos os usuários admin e root
    const usuarios = await collection.find({
      tipo: { $in: ['admin', 'root'] }
    }).toArray();

    console.log(`Encontrados ${usuarios.length} usuários admin/root`);

    let updated = 0;
    for (const user of usuarios) {
      const abas = user.abas || [];
      
      if (!abas.includes('avisos')) {
        await collection.updateOne(
          { _id: user._id },
          { $addToSet: { abas: 'avisos' } }
        );
        console.log(`✓ Adicionado 'avisos' para: ${user.nome} (${user.email})`);
        updated++;
      } else {
        console.log(`- ${user.nome} já tem permissão 'avisos'`);
      }
    }

    console.log(`\nConcluído! ${updated} usuários atualizados.`);
    console.log('Faça logout e login novamente para ver o menu "Avisos".');

  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await mongoose.disconnect();
  }
}

main();
