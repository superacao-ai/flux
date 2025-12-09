require('dotenv').config({ path: '../.env.local' });
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error('MONGODB_URI não encontrada');
  process.exit(1);
}

MongoClient.connect(uri)
  .then(async client => {
    const db = client.db();
    
    // Listar collections
    const collections = await db.listCollections().toArray();
    console.log('\n=== Collections no banco ===');
    collections.forEach(c => console.log('-', c.name));
    
    // Tentar encontrar alterações
    console.log('\n=== Buscando alterações de horário ===');
    
    const names = ['alteracoeshorarios', 'alteracaohorarios', 'alteracao_horarios', 'alteracoes_horarios'];
    
    for (const name of names) {
      try {
        const count = await db.collection(name).countDocuments();
        if (count > 0) {
          console.log(`\n✓ Collection "${name}" encontrada com ${count} documentos`);
          const docs = await db.collection(name).find({}).limit(5).toArray();
          docs.forEach(d => {
            console.log('\nDocumento:');
            console.log('  ID:', d._id.toString());
            console.log('  Status:', d.status);
            console.log('  AlunoID:', d.alunoId?.toString());
            console.log('  HorarioAtualId:', d.horarioAtualId?.toString());
            console.log('  NovoHorarioId:', d.novoHorarioId?.toString());
            console.log('  Motivo:', d.motivo);
          });
        }
      } catch (e) {
        // Collection não existe
      }
    }
    
    client.close();
  })
  .catch(err => {
    console.error('Erro:', err);
    process.exit(1);
  });
