/**
 * Script para adicionar o campo modalidadesVinculadas às modalidades existentes
 * Executar com: node scripts/add-modalidades-vinculadas.js
 */

require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/superagenda';

async function main() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Conectado ao MongoDB');
    
    const db = client.db();
    const collection = db.collection('modalidades');
    
    // Atualizar todas as modalidades que não têm o campo modalidadesVinculadas
    const result = await collection.updateMany(
      { modalidadesVinculadas: { $exists: false } },
      { $set: { modalidadesVinculadas: [] } }
    );
    
    console.log(`Modalidades atualizadas: ${result.modifiedCount}`);
    
    // Listar modalidades após atualização
    const modalidades = await collection.find({}).toArray();
    console.log('\nModalidades no banco:');
    modalidades.forEach(m => {
      console.log(`- ${m.nome}: modalidadesVinculadas = ${JSON.stringify(m.modalidadesVinculadas || [])}`);
    });
    
  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await client.close();
    console.log('\nConexão fechada');
  }
}

main();
