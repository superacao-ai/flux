#!/usr/bin/env node

/**
 * Script para marcar um horário como congelado/ausente/emEspera para teste
 * Uso: npm run dev em outro terminal, depois node scripts/test-set-flags.js
 */

async function main() {
  try {
    // Primeiro, buscar um horário
    console.log('Buscando horários...');
    let res = await fetch('http://localhost:3000/api/horarios');
    let data = await res.json();
    
    if (!data.success || !data.data || data.data.length === 0) {
      console.log('✗ Nenhum horário encontrado');
      process.exit(0);
    }

    const horario = data.data[0];
    console.log(`✓ Encontrado horário: ${horario._id} (${horario.alunoId?.nome || 'sem aluno'})`);
    console.log(`  Status atual: congelado=${horario.congelado}, ausente=${horario.ausente}, emEspera=${horario.emEspera}`);

    // Atualizar para congelado
    console.log('\nMarcando como CONGELADO...');
    res = await fetch(`http://localhost:3000/api/horarios/${horario._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ congelado: true })
    });
    
    data = await res.json();
    if (data.success) {
      console.log('✓ Horário atualizado com sucesso');
      console.log(`  Novo status: congelado=${data.data?.congelado}, ausente=${data.data?.ausente}, emEspera=${data.data?.emEspera}`);
    } else {
      console.log('✗ Erro:', data.error);
    }

    process.exit(0);
  } catch (error) {
    console.error('✗ Erro:', error.message);
    process.exit(1);
  }
}

main();
