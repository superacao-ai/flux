# Mapeamento de Fluxos do Sistema - Studio Superação

## Visão Geral das Entidades

| Entidade | Descrição | Relacionamentos |
|----------|-----------|-----------------|
| **Aluno** | Cadastro do aluno | Horários, Reagendamentos, Créditos, Presenças |
| **HorarioFixo** | Horário semanal de aula | Aluno, Professor, Modalidade |
| **Reagendamento** | Solicitação de troca de dia/horário | Aluno, HorárioOrigem, HorárioDestino |
| **AulaRealizada** | Registro de presença/falta | HorarioFixo, Aluno, Professor |
| **CreditoReposicao** | Créditos para aulas extras | Aluno, UsoCredito |
| **UsoCredito** | Uso de um crédito | CreditoReposicao, HorarioFixo |
| **AulaExperimental** | Aula de teste | Aluno (potencial), Professor, Modalidade |
| **AlteracaoHorario** | Solicitação de mudança permanente | Aluno, HorárioAtual, NovoHorário |
| **Aviso** | Comunicados | Alunos destinatários |
| **User** | Usuários do sistema | (Admin, Professor, Root) |
| **Modalidade** | Tipo de aula | Horários, Alunos |

---

## Fluxos Principais

### 1. REAGENDAMENTO

```
┌─────────────────────────────────────────────────────────────────┐
│                      FLUXO DE REAGENDAMENTO                      │
└─────────────────────────────────────────────────────────────────┘

ORIGEM (quem pode criar):
  ├── Admin/Root → via Calendário (/calendario)
  ├── Professor → via Minha Agenda (/professor/minhaagenda)
  └── Aluno → via Portal do Aluno (/aluno)

CRIAÇÃO:
  └── POST /api/reagendamentos
      ├── alunoId (obrigatório)
      ├── horarioOrigemId (horário que será trocado)
      ├── dataOrigem (data específica)
      ├── novaData (data desejada)
      ├── novoHorario (horário desejado)
      └── status: 'pendente'

ONDE APARECE (pendente):
  ├── Sidebar → Badge vermelho em "Reagendamentos"
  ├── /reagendamentos → Lista para aprovação (Admin)
  ├── /professor/minhaagenda → Se for do professor logado
  └── /aluno → Status da solicitação (Aluno)

APROVAÇÃO/RECUSA:
  └── PUT /api/reagendamentos/[id]
      ├── Aprovado:
      │   ├── Atualiza status → 'aprovado'
      │   ├── Cria aula na nova data (opcional)
      │   └── Marca aula original como 'reagendado'
      └── Recusado:
          └── Atualiza status → 'recusado'

AFETA APÓS APROVAÇÃO:
  ├── /calendario → Mostra aluno na nova data
  ├── /professor/minhaagenda → Atualiza agenda
  ├── /aulas-realizadas → Considera reagendamento
  └── /aluno → Exibe nova data confirmada
```

### 2. AULA EXPERIMENTAL

```
┌─────────────────────────────────────────────────────────────────┐
│                    FLUXO DE AULA EXPERIMENTAL                    │
└─────────────────────────────────────────────────────────────────┘

ORIGEM:
  └── Admin/Root → via /aulas-experimentais (botão "Nova")

CRIAÇÃO:
  └── POST /api/aulas-experimentais
      ├── nomeAluno, telefone, email
      ├── modalidadeId
      ├── professorId
      ├── data, horario
      └── status: 'agendada'

ONDE APARECE:
  ├── Sidebar → Badge vermelho em "Experimentais"
  ├── /aulas-experimentais → Lista completa (Admin)
  ├── /calendario → Marcação especial no dia
  ├── /professor/minhaagenda → Na agenda do professor designado
  └── Dashboard → Contador de pendentes

STATUS POSSÍVEIS:
  ├── agendada → Aguardando a data
  ├── realizada → Aluno compareceu
  ├── convertida → Virou aluno regular
  ├── nao_compareceu → Faltou
  └── cancelada → Cancelada

CONVERSÃO PARA ALUNO:
  └── Ação "Converter" em /aulas-experimentais
      ├── Cria novo Aluno
      ├── Cria HorarioFixo
      └── Atualiza status → 'convertida'
```

### 3. CRÉDITOS DE REPOSIÇÃO

```
┌─────────────────────────────────────────────────────────────────┐
│                   FLUXO DE CRÉDITOS/REPOSIÇÃO                    │
└─────────────────────────────────────────────────────────────────┘

ORIGEM (concessão):
  └── Admin → via /creditos-reposicao (botão "Conceder")
      OU via modal do aluno

CRIAÇÃO:
  └── POST /api/creditos-reposicao
      ├── alunoId
      ├── quantidade (número de créditos)
      ├── motivo
      ├── validade (data de expiração)
      └── quantidadeUsada: 0

ONDE APARECE:
  ├── /creditos-reposicao → Lista por aluno (Admin)
  ├── /aluno → "Meus Créditos" (Aluno)
  └── Modal do aluno → Seção de créditos

USO DO CRÉDITO:
  └── POST /api/creditos-reposicao/usar
      ├── creditoId
      ├── horarioFixoId (turma escolhida)
      ├── data (data da aula extra)
      └── Cria UsoCredito + incrementa quantidadeUsada

CANCELAMENTO DE USO:
  └── DELETE /api/creditos-reposicao/usar
      ├── usoId
      └── Decrementa quantidadeUsada

AFETA:
  ├── /calendario → Aluno aparece na turma extra
  ├── /professor/minhaagenda → Aluno extra na agenda
  └── /aulas-realizadas → Registrar presença da aula extra
```

### 4. REGISTRO DE AULAS (PRESENÇAS/FALTAS)

```
┌─────────────────────────────────────────────────────────────────┐
│                    FLUXO DE AULAS REALIZADAS                     │
└─────────────────────────────────────────────────────────────────┘

ORIGEM:
  ├── Admin → via /aulas-realizadas
  ├── Professor → via /professor/minhaagenda ou /professor/aulas
  └── Calendário → Click no aluno do dia

CRIAÇÃO:
  └── POST /api/aulas-realizadas
      ├── horarioFixoId
      ├── alunoId (pode ter múltiplos na turma)
      ├── data
      ├── presente: true/false
      ├── professorId
      └── observacao (opcional)

ONDE APARECE:
  ├── Sidebar → Badge vermelho se há aulas pendentes
  ├── /aulas-realizadas → Histórico completo
  ├── /professor/aulas → Aulas do professor
  ├── /aluno → Histórico de presenças
  └── /relatorios → Estatísticas

VALIDAÇÕES:
  ├── Não duplicar (mesmo horário + data + aluno)
  ├── Considerar reagendamentos
  ├── Considerar uso de créditos
  └── Considerar aulas experimentais
```

### 5. ALTERAÇÃO DE HORÁRIO PERMANENTE

```
┌─────────────────────────────────────────────────────────────────┐
│                  FLUXO DE ALTERAÇÃO DE HORÁRIO                   │
└─────────────────────────────────────────────────────────────────┘

ORIGEM:
  └── Aluno → via Portal (/aluno) - "Solicitar Alteração"

CRIAÇÃO:
  └── POST /api/alteracoes-horario
      ├── alunoId
      ├── horarioAtualId
      ├── novoDiaSemana
      ├── novoHorario
      ├── motivo
      └── status: 'pendente'

ONDE APARECE:
  ├── Sidebar → Badge em "Alterações Horário"
  ├── /alteracoes-horario → Lista para aprovação (Admin)
  └── /aluno → Status da solicitação

APROVAÇÃO:
  └── PUT /api/alteracoes-horario/[id]/aprovar
      ├── Atualiza HorarioFixo do aluno
      └── status → 'aprovado'

AFETA:
  ├── /horarios → Novo horário do aluno
  ├── /calendario → Aluno muda de posição
  └── /professor/minhaagenda → Atualiza agenda
```

---

## Matriz de Dependências

| Ação | Afeta | Precisa Verificar |
|------|-------|-------------------|
| Criar Aluno | Nada ainda | - |
| Criar Horário | Calendário, Agenda Professor | Professor existe, Modalidade existe |
| Reagendamento Aprovado | Calendário, Agenda, Presenças | Horário destino disponível |
| Aula Experimental | Calendário, Agenda Professor | Professor disponível |
| Converter Experimental | Alunos, Horários | Horário disponível |
| Conceder Crédito | Lista Créditos | Aluno existe |
| Usar Crédito | Calendário, Agenda, Presenças | Crédito válido, Horário existe |
| Registrar Presença | Relatórios, Histórico Aluno | Horário existe, Não duplicar |
| Alterar Horário | Calendário, Agenda, Horários | Novo horário disponível |
| Inativar Aluno | Horários, Calendário | Remover das turmas |

---

## Checklist de Integridade

### Para cada REAGENDAMENTO:
- [ ] Aparece na lista de pendentes (/reagendamentos)?
- [ ] Professor consegue ver na agenda dele?
- [ ] Após aprovar, aluno aparece na nova data no calendário?
- [ ] Aluno vê status atualizado no portal?
- [ ] Aula original é marcada como "reagendado"?

### Para cada AULA EXPERIMENTAL:
- [ ] Aparece no badge da sidebar?
- [ ] Professor vê na agenda dele?
- [ ] Aparece no calendário na data correta?
- [ ] Ao converter, cria aluno e horário corretos?

### Para cada CRÉDITO:
- [ ] Aluno consegue ver no portal?
- [ ] Ao usar, aparece na turma escolhida?
- [ ] Professor vê o aluno extra na agenda?
- [ ] Uso aparece listado com opção de cancelar?
- [ ] Validade é respeitada?

### Para cada AULA REALIZADA:
- [ ] Considera reagendamentos do dia?
- [ ] Considera créditos usados?
- [ ] Não permite duplicar?
- [ ] Aparece no histórico do aluno?

---

## Testes E2E Sugeridos

```javascript
// Teste: Fluxo completo de reagendamento
1. Login como aluno
2. Solicitar reagendamento
3. Verificar status "pendente"
4. Login como admin
5. Verificar badge na sidebar
6. Aprovar reagendamento
7. Verificar calendário (nova data)
8. Login como aluno
9. Verificar status "aprovado"
10. Verificar calendário pessoal

// Teste: Fluxo completo de crédito
1. Login como admin
2. Conceder crédito ao aluno X
3. Login como aluno X
4. Verificar crédito disponível
5. Usar crédito em turma Y
6. Verificar que aparece na turma Y
7. Login como professor da turma Y
8. Verificar aluno extra na agenda
9. Registrar presença
10. Verificar histórico
```

---

## Ferramentas Profissionais para Isso

1. **Documentação**: Notion, Confluence, ou este Markdown
2. **Diagramas**: draw.io, Miro, Excalidraw
3. **Testes E2E**: Playwright, Cypress
4. **Monitoramento**: Logs estruturados, Sentry
5. **Matriz de rastreabilidade**: Planilha/Jira

---

*Última atualização: Dezembro 2025*
