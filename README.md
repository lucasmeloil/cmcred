# 🏦 CM CRED — Soluções Financeiras

> **Sistema Completo de Gestão de Empréstimos, Simulações Financeiras, Tabelas de Taxas e Operações Corporativas.**

---

## ⚠️ DIRETRIZ FUNDAMENTAL PARA AGENTES E DESENVOLVEDORES

> ### 🚨 REGRA DE OURO (ESCOPO ESTRITO DE PROMPT):
> - **AS ALTERAÇÕES NO SISTEMA SÓ PODEM SER FEITAS EXATAMENTE NO QUE O USUÁRIO SOLICITAR NO PROMPT.**
> - **É TERMINANTEMENTE PROIBIDO ALTERAR, REMOVER OU INCLUIR QUALQUER ARQUIVO OU CÓDIGO ALÉM DO QUE FOI EXPLICITAMENTE PEDIDO.**
> - **NÃO MODIFICAR A SEGURANÇA (F12, DevTools, Ctrl+Shift+I, etc.):** A proteção contra inspeção de código e DevTools é obrigatória e deve permanecer sempre 100% ativa.
> - **MANTER A EXATIDÃO DOS CÁLCULOS FINANCEIROS:** Toda regra de taxas, retenções de maquininhas e lucros deve bater rigorosamente com os centavos calculados.

---

## 🚀 Como Executar o Projeto Localmente

### 1. Pré-requisitos
- **Node.js** (v18 ou superior).
- Gerenciador de pacotes **npm**.

### 2. Configuração de Variáveis de Ambiente (`.env`)
Crie um arquivo `.env` na raiz do projeto com as credenciais do Supabase:
```env
# URL do projeto Supabase da CM CRED
VITE_SUPABASE_URL=https://afwjrjmstxtqhbnxtyjw.supabase.co

# Chave pública (Anon / Publishable)
VITE_SUPABASE_PUBLISHABLE_KEY=sua_chave_publica_aqui

# Chave administrativa (Service Role) para operações do sistema
VITE_SUPABASE_SERVICE_ROLE_KEY=sua_chave_service_role_aqui
```

### 3. Instalação e Execução
```bash
# Instalar dependências
npm install

# Iniciar o servidor de desenvolvimento
npm run dev
```

### 4. Acesso no Navegador
- **Porta:** O Vite está configurado para a **porta 3000** (`vite.config.ts`).
- **Site Institucional (Landing Page Pública):**
  👉 `http://localhost:3000`
- **Painel Administrativo Interno:**
  👉 `http://localhost:3000/admin` (ou `http://localhost:3000/#admin`)

---

## 📐 Arquitetura do Sistema

```
d:/cmcred/
├── admin/                     # Painel Administrativo Corporativo
│   ├── AdminLogin.tsx         # Tela de autenticação com proteção brute-force
│   ├── AdminPanel.tsx         # Shell principal do painel com navegação e sidebar
│   ├── AuthContext.tsx        # Contexto de autenticação, permissões e sessões
│   ├── CardFlagsManager.tsx   # Gerenciamento global de bandeiras de cartão
│   ├── CreateLoan.tsx         # Criação de novo empréstimo (Cartão, FGTS, Consignado)
│   ├── CustomersManager.tsx   # Gestão de clientes e histórico financeiro
│   ├── Dashboard.tsx          # Painel de BI, gráficos de faturamento e lucro líquido
│   ├── DataContext.tsx        # Cache e sincronização de dados operacionais
│   ├── Financeiro.tsx         # DRE, fluxo de caixa, contas a pagar e receber
│   ├── LeadsManager.tsx       # Gestão de leads originados pelo simulador público
│   ├── LoanRequests.tsx       # Fila de solicitações de empréstimos e aprovações
│   ├── MachinesManager.tsx    # Cadastro de maquininhas POS e taxas MDR de retenção
│   ├── PeopleManager.tsx      # Cadastro unificado de clientes e contatos
│   ├── RatesSettingsManager.tsx # Gestor de tabelas de taxas oficiais e customizadas
│   ├── ReportsManager.tsx     # Emissão de relatórios e fechamentos em PDF/Excel
│   ├── Simulator.tsx          # Simulador financeiro avançado interno
│   ├── Tutorials.tsx          # Manuais, vídeos e tutoriais da equipe
│   └── UsersManager.tsx       # Gestão de usuários, consultores e níveis de acesso
├── components/                # Componentes da Landing Page Pública
│   ├── Hero.tsx               # Banner principal e chamada para ação
│   ├── CompanyServices.tsx    # Vitrine de produtos (Cartão, FGTS, Consignado)
│   ├── HowItWorks.tsx         # Passo a passo da contratação
│   ├── Simulator.tsx          # Simulador público para captação de clientes
│   ├── Locations.tsx          # Unidades físicas e endereços
│   ├── Testimonials.tsx       # Depoimentos e prova social
│   ├── Contact.tsx            # Formulário de contato direto
│   ├── Navbar.tsx             # Menu de navegação fixo com efeito gold luxury
│   ├── Footer.tsx             # Rodapé institucional e links LGPD
│   └── WhatsAppFloating.tsx   # Botão flutuante de atendimento WhatsApp
├── lib/                       # Motores de Lógica, Cálculos e Segurança
│   ├── connectionManager.ts   # Auto-heal de conexão, visibilidade de aba e JWT
│   ├── dataCache.ts           # Cache local tolerante a falhas
│   ├── liveSyncBus.ts         # Barramento de eventos em tempo real
│   ├── pixValidator.ts        # Validação de chaves PIX (CPF, CNPJ, e-mail, telefone)
│   ├── rates.ts               # Motor de cálculo oficial de taxas e retenções
│   ├── security.ts            # Bloqueio de F12, DevTools, inatividade e mascaramento
│   ├── supabase.ts            # Cliente Supabase singleton com persistência
│   └── supabaseAdmin.ts       # Cliente Supabase com permissões elevadas
├── index.html                 # Template base com Tailwind, fontes Inter e Orbitron
├── vite.config.ts             # Configuração do Vite (porta 3000, alias, chunks)
└── SKILL.md                   # Diretriz mestra de regras do ecossistema
```

---

## ⚙️ Todas as Opções e Configurações Atuais do Sistema

### 1. Gestão de Tabelas de Taxas (`RatesSettingsManager`)
- **Tabela 1 (Oficial Padrão):**
  - Configurada de 1x a 18x parcelas.
  - Taxas oficiais de 7,00% a 19,99% para VISA/MASTER.
  - Taxas oficiais de 8,00% a 24,75% para BANESE/ELO e AMEX.
- **Tabela 2 (Reduzida / Flex):**
  - Taxas promocionais de 5,50% a 18,50% para VISA/MASTER.
  - Taxas diferenciadas para BANESE/ELO e AMEX.
- **Tabelas Customizadas (Ex: Tabela Delivery, Tabela Parceiros):**
  - **Taxas Individuais por Bandeira:** Cada bandeira possui sua própria grade de taxas independente para todas as 18 parcelas.
  - **Edição de Nomes das Bandeiras:** O CEO pode renomear livremente qualquer bandeira clicando no botão de editar nome.
  - **Adição e Remoção de Bandeiras:** Possibilidade de adicionar novas bandeiras à tabela ou excluir bandeiras desnecessárias.
  - **Taxas Superiores a 19,99%:** O teto de taxa aceita valores elevados (20%, 25%, 30%, etc.) expandindo automaticamente a validação sem travar o campo nem apresentar erro de "Fora!".
  - **Simulação em Tempo Real:** Pré-visualização instantânea do repasse líquido do cliente conforme a taxa digitada na parcela.

### 2. Gestão de Maquininhas POS (`MachinesManager`)
- Cadastro de adquirentes (Stone, PagBank, Cielo, Ton, etc.).
- Configuração de taxas MDR por parcela (1x a 18x).
- Prazo de liquidação: **D+0** (mesmo dia) ou **D+1** (próximo dia útil).
- Alerta visual de liquidação pendente e data limite de repasse.

### 3. Simulador Financeiro e Contratos (`Simulator` e `CreateLoan`)
- Entrada de Valor Solicitado (Líquido) ou Valor da Máquina (Bruto).
- Seleção dinâmica de Tabela de Taxas e Bandeira do Cartão.
- Quebra financeira detalhada:
  - **Valor Bruto Passado no Cartão.**
  - **Valor Líquido Depositado via PIX para o Cliente.**
  - **Custo de Retenção da Maquininha.**
  - **Comissão Destinada ao Operador/Consultor.**
  - **Lucro Líquido Real da CM CRED.**
- Emissão de contrato e comprovante em PDF formatado.

### 4. Gestão de Usuários e Permissões (`UsersManager` e `AuthContext`)
- **SuperAdmin:** Acesso irrestrito a configurações, exclusão de registros e taxas globais.
- **Admin:** Gestão completa de empréstimos, maquininhas, relatórios e usuários.
- **Manager:** Gestão operacional, aprovação de empréstimos e visualização de equipe.
- **Operador:** Criação de empréstimos e simulações.
- **Consultor Externo:** Visualização restrita aos seus próprios contratos e comissões.

### 5. Segurança Ativa (`security.ts`)
- **Bloqueio de Tecla F12 e Atalhos:** F12, `Ctrl+Shift+I`, `Ctrl+Shift+J`, `Ctrl+Shift+C`, `Ctrl+U`, `Ctrl+S` permanentemente bloqueados.
- **Rate Limit de Login:** Bloqueio após 5 tentativas consecutivas incorretas.
- **Auto-Logout:** Desconexão por inatividade de 30 minutos.
- **Mascaramento:** Ocultação de dados sensíveis na interface visual.

---

*CM CRED Soluções Financeiras — Todos os direitos reservados.*
