/**
 * Script de Verificação de Integridade dos Fluxos
 * 
 * Verifica se todas as conexões entre entidades estão funcionando
 * 
 * Uso: node scripts/verificar-fluxos.js
 */

require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

// Schemas simplificados
const AlunoSchema = new mongoose.Schema({}, { strict: false });
const HorarioFixoSchema = new mongoose.Schema({}, { strict: false });
const ReagendamentoSchema = new mongoose.Schema({}, { strict: false });
const AulaRealizadaSchema = new mongoose.Schema({}, { strict: false });
const CreditoReposicaoSchema = new mongoose.Schema({}, { strict: false });
const UsoCreditoSchema = new mongoose.Schema({}, { strict: false });
const AulaExperimentalSchema = new mongoose.Schema({}, { strict: false });
const AlteracaoHorarioSchema = new mongoose.Schema({}, { strict: false });
const UserSchema = new mongoose.Schema({}, { strict: false });
const ModalidadeSchema = new mongoose.Schema({}, { strict: false });

const Aluno = mongoose.models.Aluno || mongoose.model('Aluno', AlunoSchema);
const HorarioFixo = mongoose.models.HorarioFixo || mongoose.model('HorarioFixo', HorarioFixoSchema);
const Reagendamento = mongoose.models.Reagendamento || mongoose.model('Reagendamento', ReagendamentoSchema);
const AulaRealizada = mongoose.models.AulaRealizada || mongoose.model('AulaRealizada', AulaRealizadaSchema);
const CreditoReposicao = mongoose.models.CreditoReposicao || mongoose.model('CreditoReposicao', CreditoReposicaoSchema);
const UsoCredito = mongoose.models.UsoCredito || mongoose.model('UsoCredito', UsoCreditoSchema);
const AulaExperimental = mongoose.models.AulaExperimental || mongoose.model('AulaExperimental', AulaExperimentalSchema);
const AlteracaoHorario = mongoose.models.AlteracaoHorario || mongoose.model('AlteracaoHorario', AlteracaoHorarioSchema);
const User = mongoose.models.User || mongoose.model('User', UserSchema);
const Modalidade = mongoose.models.Modalidade || mongoose.model('Modalidade', ModalidadeSchema);

async function verificarFluxos() {
  console.log('🔌 Conectando ao MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Conectado!\n');

  const problemas = [];
  const avisos = [];

  // ═══════════════════════════════════════════════════════════
  // 1. VERIFICAR HORÁRIOS
  // ═══════════════════════════════════════════════════════════
  console.log('📋 Verificando HORÁRIOS...');
  
  const horarios = await HorarioFixo.find({ ativo: { $ne: false } }).lean();
  const professoresIds = new Set((await User.find({ tipo: 'professor', ativo: { $ne: false } }).lean()).map(p => p._id.toString()));
  const modalidadesIds = new Set((await Modalidade.find({ ativo: { $ne: false } }).lean()).map(m => m._id.toString()));
  const alunosIds = new Set((await Aluno.find({ ativo: { $ne: false } }).lean()).map(a => a._id.toString()));

  let horariosSemProfessor = 0;
  let horariosSemModalidade = 0;
  let horariosComAlunoInvalido = 0;

  for (const h of horarios) {
    const profId = h.professorId?._id?.toString() || h.professorId?.toString();
    if (profId && !professoresIds.has(profId)) {
      horariosSemProfessor++;
    }
    
    const modId = h.modalidadeId?._id?.toString() || h.modalidadeId?.toString();
    if (!modId || !modalidadesIds.has(modId)) {
      horariosSemModalidade++;
    }

    if (h.matriculas && Array.isArray(h.matriculas)) {
      for (const mat of h.matriculas) {
        const alunoId = mat.alunoId?._id?.toString() || mat.alunoId?.toString();
        if (alunoId && !alunosIds.has(alunoId)) {
          horariosComAlunoInvalido++;
          break;
        }
      }
    }
  }

  if (horariosSemProfessor > 0) problemas.push(`❌ ${horariosSemProfessor} horários com professor inválido/inexistente`);
  if (horariosSemModalidade > 0) problemas.push(`❌ ${horariosSemModalidade} horários sem modalidade válida`);
  if (horariosComAlunoInvalido > 0) avisos.push(`⚠️ ${horariosComAlunoInvalido} horários com alunos inativos/inexistentes`);

  console.log(`   Total: ${horarios.length} horários ativos\n`);

  // ═══════════════════════════════════════════════════════════
  // 2. VERIFICAR REAGENDAMENTOS PENDENTES
  // ═══════════════════════════════════════════════════════════
  console.log('📋 Verificando REAGENDAMENTOS...');
  
  const reagendamentos = await Reagendamento.find({}).lean();
  const reagPendentes = reagendamentos.filter(r => r.status === 'pendente');
  const reagSemAluno = reagendamentos.filter(r => {
    const alunoId = r.alunoId?._id?.toString() || r.alunoId?.toString();
    return !alunoId || !alunosIds.has(alunoId);
  });
  const reagSemHorario = reagendamentos.filter(r => {
    const horId = r.horarioOrigemId?._id?.toString() || r.horarioOrigemId?.toString();
    return horId && !horarios.find(h => h._id.toString() === horId);
  });

  if (reagSemAluno.length > 0) problemas.push(`❌ ${reagSemAluno.length} reagendamentos com aluno inválido`);
  if (reagSemHorario.length > 0) avisos.push(`⚠️ ${reagSemHorario.length} reagendamentos com horário origem inexistente`);

  console.log(`   Total: ${reagendamentos.length} (${reagPendentes.length} pendentes)\n`);

  // ═══════════════════════════════════════════════════════════
  // 3. VERIFICAR CRÉDITOS
  // ═══════════════════════════════════════════════════════════
  console.log('📋 Verificando CRÉDITOS...');
  
  const creditos = await CreditoReposicao.find({}).lean();
  const usos = await UsoCredito.find({}).lean();
  
  const creditosSemAluno = creditos.filter(c => {
    const alunoId = c.alunoId?._id?.toString() || c.alunoId?.toString();
    return !alunoId || !alunosIds.has(alunoId);
  });

  const usosOrfaos = usos.filter(u => {
    const creditoId = u.creditoId?.toString();
    return !creditos.find(c => c._id.toString() === creditoId);
  });

  // Verificar se quantidadeUsada bate com usos reais
  let creditosDesincronizados = 0;
  for (const c of creditos) {
    const usosDoCredito = usos.filter(u => u.creditoId?.toString() === c._id.toString());
    if (usosDoCredito.length !== (c.quantidadeUsada || 0)) {
      creditosDesincronizados++;
    }
  }

  if (creditosSemAluno.length > 0) problemas.push(`❌ ${creditosSemAluno.length} créditos com aluno inválido`);
  if (usosOrfaos.length > 0) problemas.push(`❌ ${usosOrfaos.length} usos de crédito órfãos (crédito deletado)`);
  if (creditosDesincronizados > 0) avisos.push(`⚠️ ${creditosDesincronizados} créditos com quantidadeUsada desincronizada`);

  console.log(`   Total: ${creditos.length} créditos, ${usos.length} usos\n`);

  // ═══════════════════════════════════════════════════════════
  // 4. VERIFICAR AULAS EXPERIMENTAIS
  // ═══════════════════════════════════════════════════════════
  console.log('📋 Verificando AULAS EXPERIMENTAIS...');
  
  const experimentais = await AulaExperimental.find({ ativo: { $ne: false } }).lean();
  const expAgendadas = experimentais.filter(e => e.status === 'agendada');
  const expSemProfessor = experimentais.filter(e => {
    const profId = e.professorId?._id?.toString() || e.professorId?.toString();
    return profId && !professoresIds.has(profId);
  });
  const expSemModalidade = experimentais.filter(e => {
    const modId = e.modalidadeId?._id?.toString() || e.modalidadeId?.toString();
    return !modId || !modalidadesIds.has(modId);
  });

  // Verificar experimentais passadas ainda com status 'agendada'
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const expAtrasadas = expAgendadas.filter(e => {
    const dataExp = new Date(e.data);
    dataExp.setHours(0, 0, 0, 0);
    return dataExp < hoje;
  });

  if (expSemProfessor.length > 0) avisos.push(`⚠️ ${expSemProfessor.length} experimentais com professor inválido`);
  if (expSemModalidade.length > 0) problemas.push(`❌ ${expSemModalidade.length} experimentais sem modalidade válida`);
  if (expAtrasadas.length > 0) avisos.push(`⚠️ ${expAtrasadas.length} experimentais agendadas com data passada (pendentes de atualização)`);

  console.log(`   Total: ${experimentais.length} (${expAgendadas.length} agendadas)\n`);

  // ═══════════════════════════════════════════════════════════
  // 5. VERIFICAR ALTERAÇÕES DE HORÁRIO
  // ═══════════════════════════════════════════════════════════
  console.log('📋 Verificando ALTERAÇÕES DE HORÁRIO...');
  
  const alteracoes = await AlteracaoHorario.find({}).lean();
  const altPendentes = alteracoes.filter(a => a.status === 'pendente');
  const altSemAluno = alteracoes.filter(a => {
    const alunoId = a.alunoId?._id?.toString() || a.alunoId?.toString();
    return !alunoId || !alunosIds.has(alunoId);
  });

  if (altSemAluno.length > 0) avisos.push(`⚠️ ${altSemAluno.length} alterações com aluno inválido/inativo`);

  console.log(`   Total: ${alteracoes.length} (${altPendentes.length} pendentes)\n`);

  // ═══════════════════════════════════════════════════════════
  // 6. VERIFICAR AULAS REALIZADAS
  // ═══════════════════════════════════════════════════════════
  console.log('📋 Verificando AULAS REALIZADAS...');
  
  const aulas = await AulaRealizada.find({}).lean();
  const aulasSemHorario = aulas.filter(a => {
    const horId = a.horarioFixoId?._id?.toString() || a.horarioFixoId?.toString();
    return horId && !horarios.find(h => h._id.toString() === horId);
  });

  // Detectar duplicatas (mesmo horário + data + aluno)
  const chaves = new Map();
  let duplicatas = 0;
  for (const a of aulas) {
    const chave = `${a.horarioFixoId}_${a.data}_${a.alunoId || 'turma'}`;
    if (chaves.has(chave)) {
      duplicatas++;
    } else {
      chaves.set(chave, true);
    }
  }

  if (aulasSemHorario.length > 0) avisos.push(`⚠️ ${aulasSemHorario.length} aulas realizadas com horário inexistente (histórico)`);
  if (duplicatas > 0) problemas.push(`❌ ${duplicatas} registros de aula duplicados`);

  console.log(`   Total: ${aulas.length} registros\n`);

  // ═══════════════════════════════════════════════════════════
  // 7. VERIFICAR CONEXÕES CRÍTICAS
  // ═══════════════════════════════════════════════════════════
  console.log('📋 Verificando CONEXÕES CRÍTICAS...');

  // Alunos com horário mas sem aparecer em nenhum HorarioFixo
  const alunosAtivos = await Aluno.find({ ativo: { $ne: false } }).lean();
  const alunosComHorario = new Set();
  for (const h of horarios) {
    if (h.matriculas) {
      for (const m of h.matriculas) {
        const alunoId = m.alunoId?._id?.toString() || m.alunoId?.toString();
        if (alunoId) alunosComHorario.add(alunoId);
      }
    }
  }

  const alunosSemHorario = alunosAtivos.filter(a => !alunosComHorario.has(a._id.toString()));
  
  // Filtrar alunos que estão em espera, congelados ou ausentes (esses podem não ter horário)
  const alunosSemHorarioReal = alunosSemHorario.filter(a => 
    !a.emEspera && !a.congelado && !a.ausente
  );

  if (alunosSemHorarioReal.length > 0) {
    avisos.push(`⚠️ ${alunosSemHorarioReal.length} alunos ativos sem horário (não estão em espera/congelados/ausentes)`);
  }

  // Professores sem horários
  const professores = await User.find({ tipo: 'professor', ativo: { $ne: false } }).lean();
  const professoresComHorario = new Set();
  for (const h of horarios) {
    const profId = h.professorId?._id?.toString() || h.professorId?.toString();
    if (profId) professoresComHorario.add(profId);
  }
  const professorSemHorario = professores.filter(p => !professoresComHorario.has(p._id.toString()));
  
  if (professorSemHorario.length > 0) {
    avisos.push(`⚠️ ${professorSemHorario.length} professores sem nenhum horário atribuído`);
  }

  console.log('   Verificação concluída!\n');

  // ═══════════════════════════════════════════════════════════
  // RELATÓRIO FINAL
  // ═══════════════════════════════════════════════════════════
  console.log('═══════════════════════════════════════════════════════════');
  console.log('                    RELATÓRIO FINAL                         ');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('📊 RESUMO:');
  console.log(`   Alunos ativos: ${alunosAtivos.length}`);
  console.log(`   Horários ativos: ${horarios.length}`);
  console.log(`   Professores: ${professores.length}`);
  console.log(`   Modalidades: ${modalidadesIds.size}`);
  console.log(`   Reagendamentos pendentes: ${reagPendentes.length}`);
  console.log(`   Alterações pendentes: ${altPendentes.length}`);
  console.log(`   Experimentais agendadas: ${expAgendadas.length}`);
  console.log(`   Créditos disponíveis: ${creditos.filter(c => c.ativo && (c.quantidade - c.quantidadeUsada) > 0).length}`);
  console.log('');

  if (problemas.length === 0 && avisos.length === 0) {
    console.log('✅ TUDO OK! Nenhum problema encontrado.\n');
  } else {
    if (problemas.length > 0) {
      console.log(`❌ PROBLEMAS CRÍTICOS (${problemas.length}):`);
      problemas.forEach(p => console.log(`   ${p}`));
      console.log('');
    }

    if (avisos.length > 0) {
      console.log(`⚠️ AVISOS (${avisos.length}):`);
      avisos.forEach(a => console.log(`   ${a}`));
      console.log('');
    }
  }

  console.log('═══════════════════════════════════════════════════════════\n');

  await mongoose.disconnect();
  console.log('👋 Desconectado do MongoDB');
}

verificarFluxos().catch(console.error);
