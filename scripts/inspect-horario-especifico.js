const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI;

const AlunoSchema = new mongoose.Schema({
  nome: String,
  email: String,
  telefone: String,
  modalidadeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Modalidade' },
  ativo: Boolean
});

const ProfessorSchema = new mongoose.Schema({
  nome: String,
  email: String,
  ativo: Boolean
});

const ModalidadeSchema = new mongoose.Schema({
  nome: String,
  cor: String
});

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

const Aluno = mongoose.models.Aluno || mongoose.model('Aluno', AlunoSchema);
const Professor = mongoose.models.Professor || mongoose.model('Professor', ProfessorSchema);
const Modalidade = mongoose.models.Modalidade || mongoose.model('Modalidade', ModalidadeSchema);
const HorarioFixo = mongoose.models.HorarioFixo || mongoose.model('HorarioFixo', HorarioFixoSchema);

async function inspecionar() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado ao MongoDB\n');

    // Buscar o professor Bruno
    const prof = await Professor.findOne({ nome: /bruno/i });
    if (!prof) {
      console.log('❌ Professor Bruno não encontrado');
      return;
    }
    console.log(`👤 Professor encontrado: ${prof.nome} (ID: ${prof._id})\n`);

    // Buscar horários do Bruno no dia 3 (quarta) às 05:30
    const horarios = await HorarioFixo.find({
      professorId: prof._id,
      diaSemana: 3,
      horarioInicio: '05:30'
    })
    .populate('alunoId', 'nome email ativo')
    .populate('modalidadeId', 'nome cor')
    .lean();

    console.log(`📊 Total de registros encontrados: ${horarios.length}\n`);

    // Separar por status
    const ativos = horarios.filter(h => h.ativo === true);
    const inativos = horarios.filter(h => h.ativo !== true);

    console.log(`✅ Horários ATIVOS: ${ativos.length}`);
    console.log(`❌ Horários INATIVOS: ${inativos.length}\n`);

    // Mostrar horários ativos
    if (ativos.length > 0) {
      console.log('📋 HORÁRIOS ATIVOS:');
      console.log('='.repeat(80));
      ativos.forEach((h, i) => {
        console.log(`${i + 1}. ${h.horarioInicio}-${h.horarioFim}`);
        console.log(`   Aluno: ${h.alunoId?.nome || 'SEM ALUNO'}`);
        console.log(`   Modalidade: ${h.modalidadeId?.nome || 'N/A'}`);
        console.log(`   Ativo: ${h.ativo}`);
        console.log(`   ID: ${h._id}`);
        console.log(`   Criado em: ${h.criadoEm}`);
        console.log('');
      });
    }

    // Mostrar horários inativos
    if (inativos.length > 0) {
      console.log('\n📋 HORÁRIOS INATIVOS (primeiros 10):');
      console.log('='.repeat(80));
      inativos.slice(0, 10).forEach((h, i) => {
        console.log(`${i + 1}. ${h.horarioInicio}-${h.horarioFim}`);
        console.log(`   Aluno: ${h.alunoId?.nome || 'SEM ALUNO'}`);
        console.log(`   Modalidade: ${h.modalidadeId?.nome || 'N/A'}`);
        console.log(`   Ativo: ${h.ativo}`);
        console.log(`   ID: ${h._id}`);
        console.log(`   Criado em: ${h.criadoEm}`);
        console.log('');
      });
    }

    // Contar alunos únicos
    const alunosAtivos = ativos.filter(h => h.alunoId).map(h => h.alunoId._id.toString());
    const alunosUnicos = [...new Set(alunosAtivos)];
    console.log(`\n👥 Alunos únicos nos horários ATIVOS: ${alunosUnicos.length}`);
    
    if (alunosUnicos.length > 0) {
      console.log('\nLista de alunos:');
      const nomes = ativos
        .filter(h => h.alunoId)
        .map(h => h.alunoId.nome)
        .filter((v, i, a) => a.indexOf(v) === i);
      nomes.forEach((nome, i) => console.log(`${i + 1}. ${nome}`));
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDesconectado do MongoDB');
  }
}

inspecionar();
