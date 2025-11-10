const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI;

// Schema do Aluno
const AlunoSchema = new mongoose.Schema({
  nome: String,
  email: String,
  telefone: String,
  modalidadeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Modalidade' }
});

// Schema do Professor
const ProfessorSchema = new mongoose.Schema({
  nome: String,
  email: String
});

// Schema da Modalidade
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

async function checkHorarios() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado ao MongoDB');

    // Total de horários
    const total = await HorarioFixo.countDocuments();
    console.log(`\n📊 Total de horários fixos: ${total}`);

    // Horários COM aluno
    const comAluno = await HorarioFixo.countDocuments({ alunoId: { $exists: true, $ne: null } });
    console.log(`👥 Horários COM aluno: ${comAluno}`);

    // Horários SEM aluno
    const semAluno = await HorarioFixo.countDocuments({ $or: [{ alunoId: { $exists: false } }, { alunoId: null }] });
    console.log(`❌ Horários SEM aluno: ${semAluno}`);

    // Horários ativos
    const ativos = await HorarioFixo.countDocuments({ ativo: true });
    console.log(`✅ Horários ativos: ${ativos}`);
    
    // Horários ativos COM aluno
    const ativosComAluno = await HorarioFixo.countDocuments({ ativo: true, alunoId: { $exists: true, $ne: null } });
    console.log(`👥 Horários ATIVOS com aluno: ${ativosComAluno}`);
    
    // Horários ativos SEM aluno
    const ativosSemAluno = await HorarioFixo.countDocuments({ ativo: true, $or: [{ alunoId: { $exists: false } }, { alunoId: null }] });
    console.log(`❌ Horários ATIVOS sem aluno: ${ativosSemAluno}`);

    // Amostra de horários COM aluno
    console.log('\n📋 Amostra de horários ATIVOS COM aluno:');
    const horariosComAluno = await HorarioFixo.find({ ativo: true, alunoId: { $exists: true, $ne: null } })
      .populate('alunoId', 'nome email')
      .populate('professorId', 'nome')
      .populate('modalidadeId', 'nome')
      .limit(5)
      .lean();

    horariosComAluno.forEach((h, i) => {
      console.log(`${i + 1}. Dia ${h.diaSemana} ${h.horarioInicio}-${h.horarioFim}`);
      console.log(`   Aluno: ${h.alunoId?.nome || 'N/A'}`);
      console.log(`   Professor: ${h.professorId?.nome || 'N/A'}`);
      console.log(`   Modalidade: ${h.modalidadeId?.nome || 'N/A'}`);
      console.log(`   Ativo: ${h.ativo}`);
      console.log('');
    });

    // Amostra de horários SEM aluno
    console.log('📋 Amostra de horários SEM aluno:');
    const horariosSemAluno = await HorarioFixo.find({ $or: [{ alunoId: { $exists: false } }, { alunoId: null }] })
      .populate('professorId', 'nome')
      .populate('modalidadeId', 'nome')
      .limit(5)
      .lean();

    horariosSemAluno.forEach((h, i) => {
      console.log(`${i + 1}. Dia ${h.diaSemana} ${h.horarioInicio}-${h.horarioFim}`);
      console.log(`   Professor: ${h.professorId?.nome || 'N/A'}`);
      console.log(`   Modalidade: ${h.modalidadeId?.nome || 'N/A'}`);
      console.log(`   Ativo: ${h.ativo}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Desconectado do MongoDB');
  }
}

checkHorarios();
