const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI;

const AlunoSchema = new mongoose.Schema({}, { strict: false, collection: 'alunos' });
const ProfessorSchema = new mongoose.Schema({}, { strict: false, collection: 'professors' });
const HorarioFixoSchema = new mongoose.Schema({}, { strict: false, collection: 'horariofixos' });

const Aluno = mongoose.models.Aluno || mongoose.model('Aluno', AlunoSchema);
const Professor = mongoose.models.Professor || mongoose.model('Professor', ProfessorSchema);
const HorarioFixo = mongoose.models.HorarioFixo || mongoose.model('HorarioFixo', HorarioFixoSchema);

async function inspect(profName='Bruno', diaSemana=1, horarioInicio='05:30', onlyActive=false){
  try{
    await mongoose.connect(MONGODB_URI);
    console.log('Conectado ao MongoDB');

    const prof = await Professor.findOne({ nome: new RegExp('^'+profName+'$', 'i') }).lean();
    if(!prof) {
      console.log('Professor não encontrado:', profName);
      return;
    }
    console.log('Professor:', prof._id.toString(), prof.nome);

  const filter = { professorId: prof._id, diaSemana: diaSemana, horarioInicio: horarioInicio };
  if (onlyActive) filter.ativo = true;
  const list = await HorarioFixo.find(filter).lean();
    console.log('\nRegistros encontrados para', profName, diaSemana, horarioInicio, ':', list.length);

    const alunoIds = list.map(h => h.alunoId).filter(Boolean).map(a => String(a));
    console.log('alunoId raw count:', alunoIds.length);
    const uniqueAlunoIds = Array.from(new Set(alunoIds));
    console.log('alunoId unique count:', uniqueAlunoIds.length);

    if(uniqueAlunoIds.length > 0){
      const alunos = await Aluno.find({ _id: { $in: uniqueAlunoIds } }).select('nome email').lean();
      console.log('\nAlunos únicos:');
      alunos.forEach((a,i) => console.log(`${i+1}. ${a._id} - ${a.nome}`));
    }

    console.log('\nDetalhes (primeiros 30 registros):');
    list.slice(0,30).forEach((h,i) => {
      console.log(`${i+1}. _id:${h._id} alunoId:${h.alunoId || 'null'} ativo:${h.ativo} observacoes:${h.observacoes || ''}`);
    });

  }catch(e){
    console.error('Erro:', e);
  }finally{
    await mongoose.disconnect();
    console.log('Desconectado');
  }
}

const prof = process.argv[2] || 'Bruno';
const dia = process.argv[3] ? parseInt(process.argv[3],10) : 1;
const hora = process.argv[4] || '05:30';
const onlyActive = (process.argv[5] === 'active');
inspect(prof, dia, hora, onlyActive);
