(async ()=>{
  const base = 'http://localhost:3000';
  try{
    const res = await fetch(base + '/api/reagendamentos');
    const list = await res.json();
    if (!list || !list.success) { console.error('failed to fetch reagendamentos', list); process.exit(1); }
    const items = list.data || [];
    // find the last created reag with motivo 'e2e-test'
    const e2e = items.filter(i=> i.motivo === 'e2e-test').sort((a,b)=> new Date(b.criadoEm||b.criadoAt||0).getTime() - new Date(a.criadoEm||a.criadoAt||0).getTime())[0];
    if(!e2e) { console.error('no e2e-test reagendamento found'); process.exit(1); }
    console.log('Found reag:', e2e._id, 'status:', e2e.status, 'novoHorarioFixoId:', e2e.novoHorarioFixoId);
    const targetId = e2e.novoHorarioFixoId;
    const hr = await fetch(base + '/api/horarios');
    const hrj = await hr.json();
    if(!hrj || !hrj.success) { console.error('failed to fetch horarios', hrj); process.exit(1); }
    const target = (hrj.data || []).find(h => String(h._id) === String(targetId));
    if(!target) { console.error('target horario not found in /api/horarios list'); console.log('Tip: try GET /api/horarios without filters or query DB directly'); process.exit(1); }
    console.log('Target horario: id=', target._id);
    console.log('Professor:', target.professorId);
    process.exit(0);
  }catch(e){ console.error('error', e); process.exit(1); }
})();