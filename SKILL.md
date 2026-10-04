---
name: cmcred-ecosystem-rule
description: Regras mestre de governança, restrição estrita de escopo de prompts e arquitetura completa do sistema CM CRED Soluções Financeiras.
---

# 🛡️ SKILL & GOVERNANÇA MESTRA — CM CRED ECOSYSTEM

Este documento é a diretriz suprema de desenvolvimento, arquitetura e operação técnica do ecossistema **CM CRED Soluções Financeiras**. Qualquer agente de IA ou desenvolvedor atuando neste repositório está **estritamente obrigado** a seguir as regras aqui estabelecidas.

---

## ⛔ REGRA DE OURO: RESTRIÇÃO ABSOLUTA AO ESCOPO DO PROMPT

> ### 🚨 MANDATO MANDATÓRIO E INEGOCIÁVEL:
> 1. **SOMENTE FAZER O QUE ESTIVER DIRETO NO PROMPT E NADA MAIS QUE ISSO.**
> 2. **NUNCA ALTERAR, REMOVER OU ADICIONAR NADA ALÉM DO QUE O USUÁRIO PEDIU.**
> 3. **SE TIVER ALGUMA SUGESTÃO OU ENCONTRAR ALGUM ERRO, VOCÊ DEVE APENAS ME FALAR E PERGUNTAR SE EU QUERO OU NÃO ALTERAR ANTES DE MEXER EM QUALQUER CÓDIGO.**
> 4. **NUNCA DESATIVAR, BURLAR OU AFROUXAR A PROTEÇÃO DE SEGURANÇA (F12, DevTools, Ctrl+Shift+I, etc.). O bloqueio de inspeção de código e DevTools é ABSOLUTO e deve permanecer SEMPRE 100% ATIVO.**
> 5. **NÃO CRIAR LOGINS DE DESENVOLVEDOR, ATALHOS SECRETOS OU BRECHAS DE SEGURANÇA SEM ORDEM EXPRESSA.**
> 6. **TODA ALTERAÇÃO EM CÁLCULOS FINANCEIROS DEVE PRESERVAR 100% DA EXATIDÃO MATEMÁTICA.**
> 7. Se o usuário pedir para analisar, **apenas analise e relate**. Não aplique alterações sem ordem explícita.
> 8. Se o usuário mandar alterar uma função ou componente específico, **limite-se estritamente àquele componente/função**.

---

## 🏗️ 1. STACK TECNOLÓGICA E AMBIENTE

- **Frontend:** React 19.2 + TypeScript 5.8 + Vite 6.2.
- **Porta Local:** O servidor Vite roda obrigatoriamente na porta `3000` (`http://localhost:3000`), configurado em `vite.config.ts`.
- **Rotas:**
  - `/` ou `#site`: Landing Page institucional pública voltada a clientes.
  - `/admin` ou `#admin`: Painel Administrativo interno para gestão de empréstimos, taxas e finanças.
- **Estilização:** Vanilla CSS + Tailwind CSS (via script CDN) com paleta Premium Gold (`#D4AF37`, `#F59E0B`), Dark Mode (`#050608`, `#0a0b0e`, `#161922`) e efeitos Glassmorphism.
- **Backend & Database:** Supabase (PostgreSQL + Auth + Realtime WebSocket).
- **Relatórios:** jsPDF + autoTable (comprovantes e auditoria em PDF).
- **Gráficos e BI:** Recharts (análise de margem, faturamento, lucros e evolução).
- **Ícones:** Lucide React.

---

## 🔒 2. SEGURANÇA E PROTEÇÃO DE CÓDIGO (`lib/security.ts`)

A CM CRED lida com dados financeiros, taxas de juros competitivas, contratos e informações pessoais protegidas pela LGPD. Por isso, a aplicação conta com defesas ativas:

1. **Bloqueio de Inspeção e DevTools (`useDevToolsProtection`):**
   - **F12:** Totalmente bloqueado (`preventDefault` e `stopPropagation`).
   - **Atalhos de Desenvolvedor:** Bloqueio de `Ctrl+Shift+I`, `Ctrl+Shift+J`, `Ctrl+Shift+C`.
   - **Exibição de Código-Fonte:** Bloqueio de `Ctrl+U`.
   - **Salvamento de Tela:** Bloqueio de `Ctrl+S`.
   - **Desativação de Sourcemaps:** `vite.config.ts` roda com `sourcemap: false` e minificação ativa para não expor código original no build.
2. **Rate Limiting & Anti-Brute Force (`checkLoginRateLimit`):**
   - Máximo de 5 tentativas de login incorretas.
   - Bloqueio temporário de 5 minutos caso excedido.
3. **Auto-Logout por Inatividade (`useInactivityTimeout`):**
   - Monitoramento contínuo de cliques, toques, rolagem e digitação.
   - Desconexão automática após 30 minutos sem interação.
4. **Mascaramento de Dados Sensíveis:**
   - Telefones: `(79) 9****-7907` (`maskPhone`).
   - E-mails: `c***e@cmcred.com.br` (`maskEmail`).
   - Chaves PIX e CPFs protegidos na visualização padrão.

---

## 📈 3. MOTOR DE TAXAS E CÁLCULOS FINANCEIROS (`lib/rates.ts`)

### Tabelas Oficiais do Sistema
1. **Tabela 1 Oficial (Padrão):**
   - Taxas de 7,00% (1x) a 19,99% (18x) para VISA/MASTER.
   - Taxas de 8,00% a 24,75% para BANESE/ELO e AMEX.
2. **Tabela 2 Oficial (Reduzida / Flex):**
   - Taxas promocionais de 5,50% (1x) a 18,50% (18x) para VISA/MASTER.
   - Taxas diferenciadas para BANESE/ELO e AMEX.
3. **Tabelas Customizadas (Ex: Tabela Delivery, Tabela VIP, etc.):**
   - Criadas e gerenciadas no `RatesSettingsManager`.
   - **Taxas Individuais por Bandeira:** Cada bandeira possui sua própria grade de taxas independente de 1x a 18x.
   - **Edição e Renomeação de Bandeiras:** O CEO pode alterar o nome de qualquer bandeira criada (ex: renomear "MASTER" para "MASTERCARD EXCLUSIVO") sem perder as taxas configuradas.
   - **Suporte a Taxas Superiores a 19,99%:** O sistema aceita qualquer taxa digitada pelo CEO (ex: 19.99%, 22.50%, 25.00% ou mais) expandindo dinamicamente o teto sem travar nem dar erro de "Fora!".

### Fórmula Matemática dos Cálculos
- **Valor Líquido (Repasse ao Cliente):**
  $$\text{Valor Líquido} = \text{Valor Bruto} \times \left(1 - \frac{\text{Taxa da Parcela}}{100}\right)$$
- **Valor Bruto (Passado na Maquininha a partir do Desejado):**
  $$\text{Valor Bruto} = \frac{\text{Valor Desejado}}{1 - \frac{\text{Taxa da Parcela}}{100}}$$
- **Retenção da Maquininha (Custo MDR POS):**
  $$\text{Custo Maquininha} = \text{Valor Bruto} \times \frac{\text{Taxa MDR da Máquina}}{100}$$
- **Lucro Real da CM CRED:**
  $$\text{Lucro Líquido CM CRED} = (\text{Valor Bruto} - \text{Valor Repassado}) - \text{Custo Maquininha} - \text{Comissão Operador}$$

---

## 🎛️ 4. SEÇÕES E MÓDULOS DO PAINEL ADMINISTRATIVO (`/admin`)

| Seção / Rota | Componente | Responsabilidade |
|---|---|---|
| `#dashboard` | `Dashboard.tsx` | BI em tempo real: faturamento do mês, lucro líquido, volume de empréstimos, ticket médio e gráficos. |
| `#solicitacoes` | `LoanRequests.tsx` | Fila de empréstimos: aprovação, reprovação, conferência de comprovantes, estornos e liquidação. |
| `#novo_emprestimo` | `CreateLoan.tsx` | Criação de contratos de empréstimo via Cartão de Crédito, FGTS e Consignado com simulação integrada. |
| `#simulador` | `Simulator.tsx` | Simulador corporativo com seleção de tabelas (T1, T2, Delivery, etc.), bandeiras e impressão de propostas. |
| `#taxas_simulador` | `RatesSettingsManager.tsx` | Gestor de tabelas de taxas oficiais e customizadas, edição de grades 1x-18x, adição e renomeação de bandeiras. |
| `#bandeiras` | `CardFlagsManager.tsx` | Cadastro e gerenciamento global de bandeiras de cartão (ícone, cor, nome, status ativo). |
| `#maquininhas` | `MachinesManager.tsx` | Cadastro de POS (Stone, PagBank, Cielo, Ton), taxas MDR de 1x a 18x, prazo D+0/D+1 e alerta de repasse. |
| `#financeiro` | `Financeiro.tsx` | Fluxo de caixa corporativo: contas a pagar, contas a receber, DRE resumido, categorias e rateios. |
| `#pessoas` | `PeopleManager.tsx` | Gestão unificada de clientes, histórico de operações, score interno e contatos. |
| `#usuarios` | `UsersManager.tsx` | Controle de acessos de equipe: SuperAdmin, Admin, Manager, Operador e Consultor Externo. |
| `#relatorios` | `ReportsManager.tsx` | Exportação de relatórios em PDF/Excel, auditoria de movimentações e fechamento contábil. |
| `#tutoriais` | `Tutorials.tsx` | Vídeos, roteiros e base de conhecimento para treinamento de operadores e consultores. |

---

## 🔄 5. RESILIÊNCIA DE REDE & CONEXÃO SILENCIOSA (`lib/connectionManager.ts`)

- **Auto-Heal sem F5:** Monitora foco da janela (`focus`), retorno da aba (`visibilitychange`) e restabelecimento de rede (`online`).
- **Renovação Preventiva de Token JWT:** Renova silenciosamente a cada 4 minutos ou se o token estiver a menos de 60 segundos do vencimento.
- **WebSocket Realtime:** Reconecta automaticamente os canais do Supabase Realtime sem travar a interface.
- **Fallback Local:** Em caso de perda de internet, os dados são preservados em cache seguro no LocalStorage.

---

## 📋 CHECKLIST OBRIGATÓRIO PARA O AGENTE ANTES DE CONCLUIR QUALQUER TAREFA

- [ ] A alteração realizada corresponde **exatamente e apenas** ao que o usuário pediu no prompt?
- [ ] Nenhum arquivo extra ou funcionalidade não solicitada foi alterado?
- [ ] A proteção de DevTools/F12 em `security.ts` permaneceu **100% ativa e intocada**?
- [ ] Os cálculos matemáticos e financeiros mantêm exatidão centesimal?
- [ ] O código compila limpo sem erros de sintaxe ou tipos quebrados?
