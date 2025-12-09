require('dotenv').config({ path: '../.env.local' });
const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error('❌ MONGODB_URI não encontrada no .env.local');
  process.exit(1);
}

console.log('🔗 Conectando ao MongoDB...');

mongoose.connect(uri)
  .then(async () => {
    console.log('✅ Conectado ao MongoDB\n');
    
    // Listar todas as collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('📚 Collections disponíveis:');
    collections.forEach(c => console.log(`   - ${c.name}`));
    
    // Procurar por collections de alterações
    console.log('\n🔍 Procurando collections de alterações de horário...');
    const alteracoesCollections = collections.filter(c => 
      c.name.toLowerCase().includes('alterac')
    );
    
    if (alteracoesCollections.length === 0) {
      console.log('❌ Nenhuma collection de alterações encontrada!');
      console.log('💡 Isso significa que nenhuma solicitação foi criada ainda.\n');
    } else {
      console.log(`✅ Encontradas ${alteracoesCollections.length} collection(s):\n`);
      
      for (const col of alteracoesCollections) {
        const count = await mongoose.connection.db.collection(col.name).countDocuments();
        console.log(`📋 Collection: ${col.name}`);
        console.log(`   Documentos: ${count}`);
        
        if (count > 0) {
          const docs = await mongoose.connection.db.collection(col.name).find({}).limit(3).toArray();
          docs.forEach((doc, i) => {
            console.log(`\n   Documento ${i + 1}:`);
            console.log(`   - ID: ${doc._id}`);
            console.log(`   - Status: ${doc.status}`);
            console.log(`   - AlunoId: ${doc.alunoId}`);
            console.log(`   - HorarioAtualId: ${doc.horarioAtualId}`);
            console.log(`   - NovoHorarioId: ${doc.novoHorarioId}`);
            console.log(`   - Motivo: ${doc.motivo || 'N/A'}`);
            console.log(`   - Criado em: ${doc.criadoEm || doc.createdAt}`);
          });
        }
        console.log('');
      }
    }
    
    mongoose.connection.close();
    console.log('✅ Conexão fechada');
  })
  .catch(err => {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  });
