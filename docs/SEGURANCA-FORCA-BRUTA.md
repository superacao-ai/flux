# 🔐 Segurança - Proteção contra Força Bruta

## Implementação de Proteção contra Força Bruta

Este documento descreve as medidas de segurança implementadas para proteger o sistema contra ataques de força bruta.

---

## 📋 Resumo das Proteções

### 1. **Rate Limiting (Limitação de Tentativas)**
- **Máximo de tentativas**: 5 tentativas por credencial (configurável)
- **Duração do bloqueio**: 15 minutos (configurável)
- **Identidades rastreadas**:
  - Email (para admin/professor)
  - CPF (para aluno)
  - Endereço IP do cliente
- **Aplicado em**:
  - `/api/auth/login` - Login administrativo
  - `/api/aluno/auth` - Login de aluno

### 2. **Detecção de Atividade Suspeita**
- Rastreia múltiplos IPs tentando acessar a mesma conta
- Alerta quando 3+ IPs diferentes tentam login em curto período
- Eventos registrados em `logs/security-events.log`

### 3. **Logging de Eventos de Segurança**
Todos os eventos relacionados a segurança são registrados:

```json
{
  "timestamp": "2025-12-11T10:30:45.123Z",
  "eventType": "LOGIN_SUCCESS",
  "data": {
    "email": "admin@superacao.com",
    "ip": "192.168.1.100",
    "userId": "507f1f77bcf86cd799439011",
    "tipo": "admin"
  }
}
```

**Tipos de eventos registrados**:
- `LOGIN_SUCCESS` - Login bem-sucedido
- `LOGIN_INVALID_PASSWORD` - Senha incorreta
- `LOGIN_USER_NOT_FOUND` - Usuário não encontrado
- `LOGIN_INVALID_CREDENTIALS` - Credenciais faltando
- `LOGIN_RATE_LIMIT_EXCEEDED` - Bloqueado por muitas tentativas
- `SUSPICIOUS_ACTIVITY_DETECTED` - Múltiplos IPs tentando acessar
- `ALUNO_LOGIN_SUCCESS` - Login de aluno bem-sucedido
- `ALUNO_LOGIN_NOT_FOUND` - Aluno não encontrado
- `ALUNO_LOGIN_INVALID_BIRTHDATE` - Data de nascimento incorreta
- `ALUNO_LOGIN_RATE_LIMIT` - Aluno bloqueado por muitas tentativas
- `ALUNO_SUSPICIOUS_ACTIVITY` - Atividade suspeita detectada

### 4. **Sanitização de Entrada**
- Remoção de caracteres perigosos (`<`, `>`)
- Trimming de espaços em branco
- CPF parcialmente mascarado em logs (apenas 5 primeiros dígitos + ****)

### 5. **Segurança de Cookie**
- `httpOnly: true` - JavaScript não pode acessar o cookie
- `sameSite: lax` - Proteção contra CSRF
- `secure: true` (produção) - Apenas via HTTPS

---

## ⚙️ Configuração

### Variáveis de Ambiente

Adicione ao arquivo `.env.local`:

```env
# Número máximo de tentativas de login (padrão: 5)
MAX_LOGIN_ATTEMPTS=5

# Duração do bloqueio em minutos (padrão: 15)
BLOCK_DURATION_MINUTES=15

# Registrar eventos de segurança em arquivo (padrão: true)
LOG_SECURITY_EVENTS=true
```

### Exemplos de Configuração

**Segurança Aumentada (Ambiente Crítico)**:
```env
MAX_LOGIN_ATTEMPTS=3
BLOCK_DURATION_MINUTES=30
LOG_SECURITY_EVENTS=true
```

**Segurança Padrão (Desenvolvimento)**:
```env
MAX_LOGIN_ATTEMPTS=5
BLOCK_DURATION_MINUTES=15
LOG_SECURITY_EVENTS=true
```

---

## 📊 Monitoramento

### Acessar Logs de Segurança

Os eventos de segurança são registrados em:
```
/logs/security-events.log
```

**Exemplo de conteúdo**:
```json
{"timestamp":"2025-12-11T10:30:45.123Z","eventType":"LOGIN_SUCCESS","data":{"email":"admin@superacao.com","ip":"192.168.1.100"}}
{"timestamp":"2025-12-11T10:31:20.456Z","eventType":"LOGIN_INVALID_PASSWORD","data":{"email":"admin@superacao.com","ip":"192.168.1.100"}}
{"timestamp":"2025-12-11T10:32:15.789Z","eventType":"LOGIN_RATE_LIMIT_EXCEEDED","data":{"email":"admin@superacao.com","ip":"192.168.1.100","blockTimeRemaining":12}}
```

### Analise de Logs com Scripts

Para visualizar os 10 últimos eventos:
```bash
tail -10 logs/security-events.log | jq '.'
```

Para contar tentativas falhadas de um email:
```bash
grep "LOGIN_INVALID_PASSWORD\|LOGIN_INVALID_CREDENTIALS" logs/security-events.log | grep "admin@superacao.com" | wc -l
```

---

## 🛡️ Boas Práticas de Segurança

### Para Administradores

1. **Monitorar logs regularmente**
   - Verificar eventos suspeitos em `logs/security-events.log`
   - Procurar por padrões de múltiplas tentativas falhas

2. **Manter senhas fortes**
   - Mínimo 8 caracteres
   - Incluir maiúsculas, minúsculas, números e caracteres especiais

3. **Usar HTTPS em produção**
   - Sempre ativar `secure: true` nos cookies
   - Configurar certificado SSL válido

### Para Usuários

1. **Não compartilhar credenciais**
2. **Usar "Lembrar-me" com cuidado** em computadores compartilhados
3. **Sair da conta após uso** em computadores públicos

---

## 🔍 Resposta a Incidentes

### Se Detectar Atividade Suspeita

1. **Verificar logs**:
   ```bash
   grep "SUSPICIOUS_ACTIVITY_DETECTED" logs/security-events.log
   ```

2. **Bloquear a conta** (temporariamente):
   - Ir para admin e marcar usuário como inativo

3. **Forçar reset de senha**:
   - Solicitar ao usuário trocar senha
   - Considerar redefinir tokens em uso

4. **Análise posterior**:
   - Verificar padrão de IPs no log
   - Documentar o incidente

---

## 🚀 Funcionalidades Futuras

- [ ] Autenticação de dois fatores (2FA)
- [ ] Captcha após 2 tentativas falhas
- [ ] Integração com sistema de WAF
- [ ] Email de alerta para admin em atividade suspeita
- [ ] Dashboard de estatísticas de segurança
- [ ] Backup automático de logs de segurança

---

## 📞 Suporte

Para questões sobre segurança ou relatar vulnerabilidades:
1. Contactar administrador do sistema
2. Incluir detalhes do evento e timestamp
3. Não publicar vulnerabilidades publicamente

---

**Última atualização**: 11 de dezembro de 2025
**Versão**: 1.0
