(async () => {
  const base = 'http://localhost:3000';
  try {
    console.log('GET /api/horarios');
    const res = await fetch(base + '/api/horarios');
    const text = await res.text();
    try {
      var horarios = JSON.parse(text);
    } catch (e) {
      console.error('Resposta não é JSON:', text.slice(0, 500));
      process.exit(1);
    }
    if (!horarios.success) {
      console.error('GET /api/horarios returned success:false', horarios);
      process.exit(1);
    }
    const list = horarios.data || [];
    console.log('horarios count:', list.length);
    const origin = list.find(h => h.alunoId && h.alunoId._id);
    const target = list.find(h => !h.alunoId);
    if (!origin || !target) {
      console.error('Could not find origin or target for test. origin?', !!origin, 'target?', !!target);
      process.exit(1);
    }
    console.log('origin id:', origin._id, 'alunoId:', origin.alunoId ? origin.alunoId._id : null);
    console.log('target id:', target._id);

    // Create reagendamento
    const createBody = {
      horarioFixoId: origin._id,
      dataOriginal: new Date().toISOString(),
      novaData: new Date().toISOString(),
      novoHorarioInicio: target.horarioInicio,
      novoHorarioFim: target.horarioFim,
      novoHorarioFixoId: target._id,
      motivo: 'e2e-test'
    };
    console.log('POST /api/reagendamentos', createBody);
    const postRes = await fetch(base + '/api/reagendamentos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createBody)
    });
    const postJson = await postRes.json();
    console.log('POST result:', postJson);
    if (!postJson.success) {
      console.error('Failed to create reagendamento');
      process.exit(1);
    }
    const reag = postJson.data;

    // Approve
    console.log('PUT /api/reagendamentos/' + reag._id + ' approve');
    const putRes = await fetch(base + '/api/reagendamentos/' + reag._id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'aprovado' })
    });
    const putJson = await putRes.json();
    console.log('PUT result:', putJson);
    if (!putJson.success) {
      console.error('Failed to approve reagendamento');
      process.exit(1);
    }

    // Re-fetch horarios
    const res2 = await fetch(base + '/api/horarios');
    const json2 = await res2.json();
    const after = json2.data || [];
    const newTarget = after.find(h => h._id === target._id || String(h._id) === String(target._id));
    if (!newTarget) {
      console.error('Target not found after approval');
      process.exit(1);
    }
    console.log('after target alunoId:', newTarget.alunoId ? (newTarget.alunoId._id || newTarget.alunoId) : null);

    if (newTarget.alunoId && (String(newTarget.alunoId._id || newTarget.alunoId) === String(origin.alunoId._id || origin.alunoId))) {
      console.log('\u2705 E2E SUCCESS: aluno attached to target');
      process.exit(0);
    } else {
      console.error('E2E FAIL: aluno not attached to target');
      process.exit(1);
    }

  } catch (e) {
    console.error('Unexpected error:', e);
    process.exit(1);
  }
})();