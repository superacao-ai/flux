const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI;

const HorarioFixoSchema = new mongoose.Schema({
  alunoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Aluno' },
  modalidadeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Modalidade' },
  professorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Professor' },
  diaSemana: Number,
  horarioInicio: String,
  horarioFim: String,
  ativo: Boolean,
  congelado: Boolean,
  ausente: Boolean,
  emEspera: Boolean,
  observacoes: String
}, { timestamps: { createdAt: 'criadoEm', updatedAt: 'atualizadoEm' } });

const HorarioFixo = mongoose.models.HorarioFixo || mongoose.model('HorarioFixo', HorarioFixoSchema);

async function reativarHorarios() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado ao MongoDB');

    // Encontrar horários INATIVOS que TÊM alunos
    const horariosInativosComAluno = await HorarioFixo.find({ 
      ativo: false, 
      alunoId: { $exists: true, $ne: null },
      professorId: { $exists: true, $ne: null } // Garantir que tem professor
    }).countDocuments();

    console.log(`\n📊 Horários INATIVOS com aluno encontrados: ${horariosInativosComAluno}`);

    if (horariosInativosComAluno === 0) {
      console.log('✅ Nenhum horário para reativar!');
      return;
    }

    // Perguntar confirmação
    console.log(`\n⚠️  Você quer REATIVAR ${horariosInativosComAluno} horários que têm alunos vinculados?`);
    console.log('   Isso vai marcar esses horários como ativo: true');
    console.log('\n   Execute novamente com --confirm para confirmar a operação\n');

    // Verificar se tem flag de confirmação
    if (process.argv.includes('--confirm')) {
      const resultado = await HorarioFixo.updateMany(
        { 
          ativo: false, 
          alunoId: { $exists: true, $ne: null },
          professorId: { $exists: true, $ne: null }
        },
        { $set: { ativo: true } }
      );

      console.log(`\n✅ Horários reativados: ${resultado.modifiedCount}`);
      console.log('✅ Operação concluída com sucesso!');
      
      // Verificar resultado
      const agora = await HorarioFixo.countDocuments({ ativo: true });
      console.log(`\n📊 Total de horários ATIVOS agora: ${agora}`);
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDesconectado do MongoDB');
  }
}

reativarHorarios();
