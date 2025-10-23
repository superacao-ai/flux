(async ()=>{
  const base = 'http://localhost:3000';
  try{
    // pick an existing aluno and professor from the API lists
    const alunosRes = await fetch(base + '/api/alunos');
    const alunos = await alunosRes.json();
    const professoresRes = await fetch(base + '/api/professores');
    const professores = await professoresRes.json();
    const aluno = (alunos.data || [])[0];
    const prof = (professores.data || [])[0];
    if(!aluno || !prof) { console.error('missing aluno or professor'); process.exit(1); }
    // 1. Criar HorarioFixo sem alunoId
    const horarioPayload = { professorId: String(prof._id), diaSemana: 1, horarioInicio: '12:00', horarioFim: '13:00', observacoes: 'debug-create' };
    console.log('POST /api/horarios payload:', horarioPayload);
    const horarioRes = await fetch(base + '/api/horarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(horarioPayload) });
    const horarioData = await horarioRes.json();
    if (!horarioRes.ok || !horarioData?.data?._id) {
      console.error('Falha ao criar HorarioFixo:', horarioData);
      process.exit(1);
    }
    // 2. Criar Matricula para o aluno nesse HorarioFixo
    const matriculaPayload = { horarioFixoId: horarioData.data._id, alunoId: String(aluno._id), observacoes: 'debug-create' };
    console.log('POST /api/matriculas payload:', matriculaPayload);
    const matRes = await fetch(base + '/api/matriculas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(matriculaPayload) });
    const matText = await matRes.text();
    console.log('HTTP', matRes.status, 'body:', matText.slice(0,1000));
    process.exit(0);
  }catch(e){ console.error('err', e); process.exit(1); }
})();