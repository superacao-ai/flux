const { createServer } = require('http');

const server = createServer((req, res) => {
  console.log('Requisição recebida:', req.method, req.url);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'servidor funcionando' }));
});

server.listen(3001, () => {
  console.log('Servidor teste rodando na porta 3001');
});

// Teste com Next.js
console.log('Testando importação dos modelos...');
try {
  require('../src/models/Aluno');
  console.log('✅ Modelo Aluno importado com sucesso');
} catch (error) {
  console.log('❌ Erro ao importar Modelo Aluno:', error.message);
}

try {
  require('../src/models/HorarioFixo');
  console.log('✅ Modelo HorarioFixo importado com sucesso');
} catch (error) {
  console.log('❌ Erro ao importar Modelo HorarioFixo:', error.message);
}