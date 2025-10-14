# SuperAgenda - Sistema de Gestão para Personal Training

## 📋 Sobre o Projeto

O SuperAgenda é um sistema web completo para gerenciamento de agenda em studios de personal training. Foi desenvolvido especificamente para ser usado internamente por administradores e professores, permitindo o controle total da agenda, reagendamentos, faltas e geração de relatórios detalhados.

## 🚀 Funcionalidades

### ✅ Gestão de Usuários
- **Autenticação segura** para administradores e professores
- **Controle de permissões** baseado em perfis de usuário

### 👥 Cadastro de Alunos
- **CRUD completo** para gerenciar informações dos alunos
- **Controle de status** (ativo/inativo)
- **Informações de contato** e observações

### 👨‍🏫 Gestão de Professores
- **Cadastro da equipe** de personal trainers
- **Especialidades** e informações de contato
- **Status ativo/inativo**

### 📅 Sistema de Horários
- **Horários fixos** para alunos regulares
- **Grade visual** semanal intuitiva
- **Visualização por professor** e por horário

### 🔄 Reagendamentos
- **Sistema de solicitações** de reagendamento
- **Aprovação/rejeição** pelos administradores
- **Histórico completo** de alterações

### ❌ Controle de Faltas
- **Registro de faltas** pelos professores
- **Classificação** (justificada/injustificada)
- **Observações** e motivos

### 📊 Relatórios Gerenciais
- **Métricas de frequência** dos alunos
- **Performance dos professores**
- **Análises temporais** (mensal, semanal)
- **Exportação de dados**

## 🛠️ Tecnologias Utilizadas

- **Frontend**: Next.js 15 + React 18
- **Backend**: API Routes do Next.js
- **Database**: MongoDB Atlas
- **ODM**: Mongoose
- **Styling**: Tailwind CSS
- **Linguagem**: TypeScript
- **Autenticação**: bcryptjs + JWT
- **Linting**: ESLint

## 🚦 Como Executar

### Pré-requisitos
- Node.js 18+ 
- npm ou yarn
- Conta no MongoDB Atlas (gratuita)

### Configuração do Banco de Dados

1. **Crie uma conta no MongoDB Atlas**:
   - Acesse: https://www.mongodb.com/atlas
   - Crie um cluster gratuito
   - Anote a string de conexão

2. **Configure as variáveis de ambiente**:
   ```bash
   # Copie o arquivo de exemplo
   cp .env.local.example .env.local
   
   # Edite o arquivo .env.local com suas credenciais
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/superagenda
   ```

### Instalação
```bash
# Clone o repositório (se aplicável)
git clone [seu-repositório]

# Instale as dependências
npm install

# Configure o banco de dados (após configurar .env.local)
npm run seed

# Execute em modo desenvolvimento
npm run dev
```

### Scripts Disponíveis
```bash
# Desenvolvimento
npm run dev

# Build para produção
npm run build

# Iniciar servidor de produção
npm run start

# Linting
npm run lint

# Popular banco com dados iniciais
npm run seed
```

## 🌐 Acesso ao Sistema

Após executar `npm run dev`, acesse:
- **URL Local**: http://localhost:3000

### Páginas Disponíveis
- `/` - Página inicial
- `/dashboard` - Dashboard principal
- `/alunos` - Gestão de alunos
- `/professores` - Gestão de professores
- `/horarios` - Grade de horários
- `/relatorios` - Relatórios gerenciais

## 📁 Estrutura do Projeto

```
src/
├── app/                 # App Router do Next.js
│   ├── dashboard/       # Dashboard principal
│   ├── alunos/         # Gestão de alunos
│   ├── professores/    # Gestão de professores
│   ├── horarios/       # Grade de horários
│   └── relatorios/     # Relatórios
├── components/         # Componentes reutilizáveis
│   └── Layout.tsx      # Layout principal
├── types/             # Definições TypeScript
│   └── index.ts       # Interfaces e tipos
└── globals.css        # Estilos globais
```

## 🎨 Design System

O projeto utiliza Tailwind CSS com uma paleta de cores personalizada:
- **Primary**: Tons de azul (#0ea5e9, #0284c7, #0369a1)
- **Success**: Verde para confirmações
- **Warning**: Amarelo para alertas
- **Error**: Vermelho para erros

## 🔐 Segurança

- Sistema preparado para autenticação JWT
- Controle de permissões baseado em roles
- Validação de dados no frontend e backend
- Senhas criptografadas com bcryptjs
- Sanitização de dados de entrada

## 🗄️ Banco de Dados

### Models Implementados:
- **User**: Usuários (admin/professor)
- **Aluno**: Cadastro de alunos
- **Professor**: Cadastro de professores
- **HorarioFixo**: Horários regulares
- **Reagendamento**: Solicitações de reagendamento
- **Falta**: Registro de faltas

### APIs Disponíveis:
- `GET/POST /api/alunos` - CRUD de alunos
- `GET/PUT/DELETE /api/alunos/[id]` - Operações por ID
- `GET/POST /api/professores` - CRUD de professores
- `GET/POST /api/horarios` - CRUD de horários
- `GET/POST /api/reagendamentos` - CRUD de reagendamentos

### Dados Iniciais:
Após executar `npm run seed`, o sistema terá:
- **1 Administrador**: admin@superagenda.com / admin123
- **3 Professores**: com login individual (senha: professor123)
- **5 Alunos** de exemplo
- **5 Horários fixos** configurados

## 📈 Próximos Passos

### Backend (Recomendado)
- [ ] Implementar API REST com Node.js/Express
- [ ] Configurar banco de dados (MongoDB/PostgreSQL)
- [ ] Sistema de autenticação completo
- [ ] Middleware de autorização

### Features Avançadas
- [ ] Sistema de notificações
- [ ] Integração com calendário
- [ ] App mobile (React Native)
- [ ] Sistema de pagamentos

## 🤝 Contribuição

Este é um projeto interno desenvolvido para uso específico em studios de personal training. Para modificações ou melhorias, entre em contato com a equipe de desenvolvimento.

## 📧 Suporte

Para suporte técnico ou dúvidas sobre o sistema, entre em contato através dos canais internos da empresa.

---

**SuperAgenda** - Desenvolvido com ❤️ para otimizar a gestão do seu studio de personal training.