const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI;

// Schema do Professor
const ProfessorSchema = new mongoose.Schema({
  nome: String,
  email: String
});

const HorarioFixoSchema = new mongoose.Schema({
  alunoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Aluno' },
  modalidadeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Modalidade' },
  professorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Professor' },
  diaSemana: Number,
  horarioInicio: String,
  horarioFim: String,
  ativo: Boolean
}, { timestamps: { createdAt: 'criadoEm', updatedAt: 'atualizadoEm' } });

const Professor = mongoose.models.Professor || mongoose.model('Professor', ProfessorSchema);
const HorarioFixo = mongoose.models.HorarioFixo || mongoose.model('HorarioFixo', HorarioFixoSchema);

async function checkDuplicates() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado ao MongoDB');

    // Buscar professor Bruno
    const bruno = await Professor.findOne({ nome: /bruno/i });
    if (!bruno) {
      console.log('❌ Professor Bruno não encontrado');
      return;
    }
    
    console.log('👤 Professor encontrado:', bruno.nome, '- ID:', bruno._id);

    // Buscar horários do Bruno às 5:30 (segunda-feira = 1)
    const horarios = await HorarioFixo.find({
      professorId: bruno._id,
      diaSemana: 1,
      horarioInicio: '05:30',
      ativo: true
    }).populate('alunoId', 'nome');

    console.log(`\n📊 Total de registros HorarioFixo para Bruno às 5:30 (segunda): ${horarios.length}`);
    
    // Contar quantos TÊM aluno
    const comAluno = horarios.filter(h => h.alunoId);
    const semAluno = horarios.filter(h => !h.alunoId);
    
    console.log(`👥 Com aluno: ${comAluno.length}`);
    console.log(`❌ Sem aluno (templates): ${semAluno.length}`);

    if (comAluno.length > 0) {
      console.log('\n📋 Alunos encontrados:');
      comAluno.forEach((h, i) => {
        console.log(`${i + 1}. ${h.alunoId?.nome || 'Sem nome'}`);
      });
    }

    // Verificar se há duplicatas do mesmo aluno
    const alunoIds = comAluno.map(h => h.alunoId?._id?.toString()).filter(Boolean);
    const unique = new Set(alunoIds);
    
    if (alunoIds.length !== unique.size) {
      console.log(`\n⚠️  ATENÇÃO: Existem ${alunoIds.length - unique.size} alunos DUPLICADOS no mesmo horário!`);
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDesconectado do MongoDB');
  }
}

checkDuplicates();
