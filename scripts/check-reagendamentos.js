const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI;

const ReagendamentoSchema = new mongoose.Schema({
  alunoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Aluno' },
  horarioOriginalId: { type: mongoose.Schema.Types.ObjectId, ref: 'HorarioFixo' },
  horarioNovoId: { type: mongoose.Schema.Types.ObjectId, ref: 'HorarioFixo' },
  data: Date,
  status: String,
  motivo: String
});

const Reagendamento = mongoose.models.Reagendamento || mongoose.model('Reagendamento', ReagendamentoSchema);

async function checkReagendamentos() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado ao MongoDB\n');

    const total = await Reagendamento.countDocuments();
    console.log(`📊 Total de reagendamentos: ${total}`);

    const aprovados = await Reagendamento.countDocuments({ status: 'aprovado' });
    console.log(`✅ Reagendamentos aprovados: ${aprovados}`);

    const pendentes = await Reagendamento.countDocuments({ status: 'pendente' });
    console.log(`⏳ Reagendamentos pendentes: ${pendentes}`);

    if (aprovados > 0) {
      console.log('\n📋 Primeiros 5 reagendamentos aprovados:');
      const reags = await Reagendamento.find({ status: 'aprovado' })
        .populate('alunoId', 'nome')
        .populate('horarioOriginalId', 'diaSemana horarioInicio')
        .populate('horarioNovoId', 'diaSemana horarioInicio')
        .limit(5)
        .lean();

      reags.forEach((r, i) => {
        console.log(`\n${i + 1}.`);
        console.log(`   Aluno: ${r.alunoId?.nome || 'N/A'}`);
        console.log(`   Data: ${r.data}`);
        console.log(`   De: Dia ${r.horarioOriginalId?.diaSemana} às ${r.horarioOriginalId?.horarioInicio}`);
        console.log(`   Para: Dia ${r.horarioNovoId?.diaSemana} às ${r.horarioNovoId?.horarioInicio}`);
        console.log(`   Status: ${r.status}`);
      });
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDesconectado do MongoDB');
  }
}

checkReagendamentos();
