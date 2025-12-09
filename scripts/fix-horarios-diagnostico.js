/**
 * Script para analisar e corrigir problemas nos horários
 * Execute: node scripts/fix-horarios-diagnostico.js
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI não definida');
  process.exit(1);
}

async function main() {
  try {
    console.log('🔌 Conectando ao MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado!\n');

    const db = mongoose.connection.db;
    const horariosCollection = db.collection('horariofixos');
    const usersCollection = db.collection('users');
    const modalidadesCollection = db.collection('modalidades');

    // Buscar todos os horários
    const horarios = await horariosCollection.find({}).toArray();
    console.log(`📊 Total de horários: ${horarios.length}\n`);

    // Buscar professores e modalidades válidos
    const professores = await usersCollection.find({ tipo: { $in: ['professor', 'Professor'] } }).toArray();
    const modalidades = await modalidadesCollection.find({}).toArray();
    
    const professorIds = new Set(professores.map(p => p._id.toString()));
    const modalidadeIds = new Set(modalidades.map(m => m._id.toString()));

    console.log(`👨‍🏫 Professores válidos: ${professorIds.size}`);
    console.log(`🏊 Modalidades válidas: ${modalidadeIds.size}\n`);

    // Analisar problemas
    const problemas = {
      semDiaSemana: [],
      semHorarioInicio: [],
      semProfessor: [],
      professorInvalido: [],
      semModalidade: [],
      modalidadeInvalida: [],
      matriculasInvalidas: [],
      inativos: []
    };

    for (const h of horarios) {
      const id = h._id.toString();
      const label = `${h.horarioInicio || 'sem-hora'} (dia ${h.diaSemana ?? 'null'})`;

      // Verificar dia da semana
      if (h.diaSemana === undefined || h.diaSemana === null) {
        problemas.semDiaSemana.push({ id, label, h });
      }

      // Verificar horário início
      if (!h.horarioInicio) {
        problemas.semHorarioInicio.push({ id, label, h });
      }

      // Verificar professor
      if (!h.professorId) {
        problemas.semProfessor.push({ id, label, h });
      } else {
        const profId = typeof h.professorId === 'object' ? h.professorId.toString() : h.professorId;
        if (!professorIds.has(profId)) {
          problemas.professorInvalido.push({ id, label, profId, h });
        }
      }

      // Verificar modalidade
      if (!h.modalidadeId) {
        problemas.semModalidade.push({ id, label, h });
      } else {
        const modId = typeof h.modalidadeId === 'object' ? h.modalidadeId.toString() : h.modalidadeId;
        if (!modalidadeIds.has(modId)) {
          problemas.modalidadeInvalida.push({ id, label, modId, h });
        }
      }

      // Verificar matrículas
      if (h.matriculas && Array.isArray(h.matriculas)) {
        for (const m of h.matriculas) {
          if (!m.alunoId) {
            problemas.matriculasInvalidas.push({ id, label, matricula: m });
          }
        }
      }

      // Verificar inativos
      if (h.ativo === false) {
        problemas.inativos.push({ id, label, h });
      }
    }

    // Relatório
    console.log('═══════════════════════════════════════════════');
    console.log('📋 RELATÓRIO DE PROBLEMAS NOS HORÁRIOS');
    console.log('═══════════════════════════════════════════════\n');

    console.log(`❌ Sem dia da semana: ${problemas.semDiaSemana.length}`);
    console.log(`❌ Sem horário início: ${problemas.semHorarioInicio.length}`);
    console.log(`❌ Sem professor: ${problemas.semProfessor.length}`);
    console.log(`❌ Professor inválido: ${problemas.professorInvalido.length}`);
    console.log(`❌ Sem modalidade: ${problemas.semModalidade.length}`);
    console.log(`❌ Modalidade inválida: ${problemas.modalidadeInvalida.length}`);
    console.log(`⚠️ Matrículas inválidas: ${problemas.matriculasInvalidas.length}`);
    console.log(`ℹ️ Inativos: ${problemas.inativos.length}`);

    const totalProblemas = 
      problemas.semDiaSemana.length +
      problemas.semHorarioInicio.length +
      problemas.semProfessor.length +
      problemas.professorInvalido.length +
      problemas.semModalidade.length +
      problemas.modalidadeInvalida.length +
      problemas.matriculasInvalidas.length;

    console.log(`\n📊 Total de problemas: ${totalProblemas}`);

    // Mostrar exemplos
    if (problemas.semDiaSemana.length > 0) {
      console.log('\n--- Exemplos sem dia da semana (primeiros 5) ---');
      problemas.semDiaSemana.slice(0, 5).forEach(p => {
        console.log(`  - ${p.id}: ${p.label}`);
      });
    }

    if (problemas.semProfessor.length > 0) {
      console.log('\n--- Exemplos sem professor (primeiros 5) ---');
      problemas.semProfessor.slice(0, 5).forEach(p => {
        console.log(`  - ${p.id}: ${p.label}`);
      });
    }

    if (problemas.professorInvalido.length > 0) {
      console.log('\n--- Exemplos com professor inválido (primeiros 5) ---');
      problemas.professorInvalido.slice(0, 5).forEach(p => {
        console.log(`  - ${p.id}: ${p.label} (prof: ${p.profId})`);
      });
    }

    // Perguntar se quer corrigir
    console.log('\n═══════════════════════════════════════════════');
    console.log('🔧 OPÇÕES DE CORREÇÃO');
    console.log('═══════════════════════════════════════════════\n');

    // Deletar horários completamente inválidos (sem dia, sem hora, sem professor E sem modalidade)
    const horariosTotalmenteInvalidos = horarios.filter(h => {
      const semDia = h.diaSemana === undefined || h.diaSemana === null;
      const semHora = !h.horarioInicio;
      const semProf = !h.professorId;
      const semMod = !h.modalidadeId;
      // Sem matrículas ativas
      const semMatriculas = !h.matriculas || h.matriculas.length === 0;
      
      return (semDia || semHora) && semProf && semMod && semMatriculas;
    });

    console.log(`🗑️ Horários totalmente inválidos (candidatos a exclusão): ${horariosTotalmenteInvalidos.length}`);

    // Horários inativos sem matrículas
    const inativosSemMatriculas = problemas.inativos.filter(p => {
      return !p.h.matriculas || p.h.matriculas.length === 0;
    });

    console.log(`🗑️ Horários inativos sem matrículas: ${inativosSemMatriculas.length}`);

    // Executar limpeza automática
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question('\n❓ Deseja DELETAR os horários totalmente inválidos e inativos sem matrículas? (s/n): ', async (answer) => {
      if (answer.toLowerCase() === 's') {
        // Coletar IDs para deletar
        const idsParaDeletar = [
          ...horariosTotalmenteInvalidos.map(h => h._id),
          ...inativosSemMatriculas.map(p => new mongoose.Types.ObjectId(p.id))
        ];

        // Remover duplicatas
        const idsUnicos = [...new Set(idsParaDeletar.map(id => id.toString()))].map(id => new mongoose.Types.ObjectId(id));

        if (idsUnicos.length > 0) {
          console.log(`\n🗑️ Deletando ${idsUnicos.length} horários...`);
          const result = await horariosCollection.deleteMany({ _id: { $in: idsUnicos } });
          console.log(`✅ Deletados: ${result.deletedCount} horários`);
        } else {
          console.log('ℹ️ Nenhum horário para deletar.');
        }
      } else {
        console.log('❌ Operação cancelada.');
      }

      rl.close();
      await mongoose.disconnect();
      console.log('\n👋 Desconectado do MongoDB');
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

main();
