(async ()=>{
  const base = 'http://localhost:3000';
  try{
    console.log('GET /api/reagendamentos');
    const listRes = await fetch(base + '/api/reagendamentos');
    const listText = await listRes.text();
    let listJson;
    try{ listJson = JSON.parse(listText); } catch(e){ console.error('GET /api/reagendamentos returned non-JSON:', listText.slice(0,1000)); process.exit(1); }
    const items = listJson.data || [];
    const r = items.find(i=> i.motivo==='e2e-test' && i.status==='pendente');
    if(!r){ console.error('No pending e2e-test reag found'); process.exit(1); }
    console.log('Found reag:', r._id);
    const id = r._id;
    console.log('PUT /api/reagendamentos/' + id);
    const putRes = await fetch(base + '/api/reagendamentos/' + id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'aprovado' })
    });
    const text = await putRes.text();
    console.log('HTTP', putRes.status, putRes.statusText);
    console.log('Response body:\n', text.slice(0,2000));
    if(putRes.headers.get('content-type') && putRes.headers.get('content-type').includes('application/json')){
      try{ console.log('Parsed JSON:', JSON.parse(text)); }catch(e){ console.error('Failed to parse JSON:', e); }
    }
  }catch(e){ console.error('Unexpected error in debug script:', e); process.exit(1); }
})();