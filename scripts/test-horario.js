const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

// Definir schemas
const alunoSchema = new mongoose.Schema({
  nome: String,
  email: String,
  telefone: String,
  ativo: { type: Boolean, default: true }
});

const professorSchema = new mongoose.Schema({
  nome: String,
  email: String,
  telefone: String,
  ativo: { type: Boolean, default: true }
});

async function testHorario() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Conectado ao MongoDB');

    // Registrar modelos
    const Aluno = mongoose.model('Aluno', alunoSchema);
    const Professor = mongoose.model('Professor', professorSchema);
    
    const aluno = await Aluno.findOne();
    const professor = await Professor.findOne();
    
    if (!aluno || !professor) {
      console.log('❌ Precisa ter pelo menos um aluno e um professor no banco');
      process.exit(1);
    }
    
    console.log('📍 Usando:', {
      aluno: aluno.nome,
      alunoId: aluno._id,
      professor: professor.nome,
      professorId: professor._id
    });

    // Teste da API
    const horarioData = {
      alunoId: aluno._id.toString(),
      professorId: professor._id.toString(),
      diaSemana: 1,
      horarioInicio: '09:00',
      horarioFim: '10:00',
      observacoes: 'Teste de horário'
    };

    console.log('📤 Enviando dados:', horarioData);

    const response = await fetch('http://localhost:3000/api/horarios', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(horarioData)
    });

    const result = await response.json();
    console.log('📥 Resposta da API:', result);

    if (!result.success) {
      console.log('❌ Erro na API:', result.error);
    } else {
      console.log('✅ Horário criado com sucesso!');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

testHorario();