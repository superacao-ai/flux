/**
 * Script para adicionar a permissão adicionarAluno aos usuários existentes
 * Execução: node scripts/add-adicionarAluno-permission.js
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://contatosuperacaotreino_db_user:nk98JOOIl2xgOh3l@cluster0.lsfahx1.mongodb.net/superagenda?retryWrites=true&w=majority&appName=Cluster0';

async function run() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Conectado ao MongoDB');
    
    const db = client.db();
    const usersCollection = db.collection('users');
    
    // Buscar todos os usuários
    const users = await usersCollection.find({}).toArray();
    console.log(`📊 Total de usuários encontrados: ${users.length}`);
    
    let atualizados = 0;
    let jaTemPermissao = 0;
    
    for (const user of users) {
      const permissoes = user.permissoes || {};
      const horarios = permissoes.horarios || {};
      
      // Verificar se já tem adicionarAluno definido
      if (horarios.adicionarAluno !== undefined) {
        jaTemPermissao++;
        console.log(`⏭️  ${user.nome} (${user.tipo}) - já tem adicionarAluno: ${horarios.adicionarAluno}`);
        continue;
      }
      
      // Adicionar adicionarAluno = true (padrão)
      const novasPermissoes = {
        ...permissoes,
        horarios: {
          ...horarios,
          adicionarAluno: true
        }
      };
      
      await usersCollection.updateOne(
        { _id: user._id },
        { $set: { permissoes: novasPermissoes } }
      );
      
      atualizados++;
      console.log(`✅ ${user.nome} (${user.tipo}) - adicionado adicionarAluno: true`);
    }
    
    console.log('\n📊 Resumo:');
    console.log(`   - Usuários atualizados: ${atualizados}`);
    console.log(`   - Já tinham a permissão: ${jaTemPermissao}`);
    console.log(`   - Total processados: ${users.length}`);
    
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await client.close();
    console.log('\n🔌 Conexão fechada');
  }
}

run();
