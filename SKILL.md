# 🚀 Skill & Architecture: CM CRED Ecosystem

Este documento serve como a "Skill" mestra do projeto CM CRED, detalhando a arquitetura técnica, o esquema de dados e as lógicas de negócio fundamentais para manutenção e expansão do sistema.

---

## 🛠️ Stack Tecnológica

- **Frontend:** React 19 + TypeScript + Vite
- **Estilização:** CSS Moderno (Vanilla) com foco em *Glassmorphism*, *Gold Luxury* e *Dark Mode*.
- **Estado & Backend:** Supabase (PostgreSQL + Auth + Realtime).
- **Gráficos & BI:** Recharts (Análise de Margem e Evolução).
- **Relatórios:** jsPDF + autoTable (Comprovantes e Auditoria).
- **Ícones:** Lucide React.

---

## 📊 Arquitetura de Dados (Supabase)

### 1. `profiles` (Usuários e Hierarquia)
- `id`: UUID (vinculado ao Auth).
- `full_name`: Nome completo.
- `perfil`: `admin`, `manager`, `operator`, `consultant`.
- `status`: `active`, `inactive`.

### 2. `loans` (Coração da Operação)
- `requested_amount`: Valor que o cliente recebe (Repasse).
- `approved_amount`: Valor total passado na maquininha.
- `profit`: Lucro bruto (Diferença entre aprovado e solicitado - taxas).
- `consultant_commission_amount`: Parte do lucro destinada ao consultor.
- `company_net_profit`: Lucro líquido real da CM CRED.
- `status`: `pending`, `in analysis`, `approved`, `rejected`, `completed`.
- **Relacionamentos:** `lead_id`, `customer_id`, `bank_id`, `machine_id`, `consultant_id`.

### 3. `machines` & `card_flags` (Motor de Taxas)
- `machines`: Cadastra as máquinas (ex: Ton, PagSeguro, Stone) e suas taxas base por parcelamento.
- `card_flags`: Taxas adicionais por bandeira (Visa, Master, Elo, etc.).
- **Lógica de Cálculo:** `Valor Bruto = (Valor Desejado + Margem) / (1 - Taxas Totais)`.

### 4. `finance` (Fluxo de Caixa)
- `type`: `payable` (Despesa) ou `receivable` (Receita).
- `category`: Categorização para gráficos de BI (Aluguel, Marketing, Impostos).
- `amount`: Valor monetário.

---

## 🧠 Lógicas de Negócio Críticas

### Simulação Dinâmica
O simulador na Landing Page não usa valores estáticos. Ele busca em tempo real:
1. Taxa da Máquina selecionada para o parcelamento X.
2. Taxa da Bandeira do cartão selecionada.
3. Margem Administrativa configurada.
*Resultado:* Entrega ao cliente o valor exato que ele pagará no cartão para receber o valor desejado em PIX.

### Análise de Margem (BI)
O dashboard financeiro processa os dados de `loans` e `finance` para calcular:
- **ROI por Operação:** Lucro líquido vs Capital movimentado.
- **D+1 Profit:** Evolução temporal do saldo real da empresa.
- **Ranking de Consultores:** Baseado no lucro real gerado, não apenas no volume bruto.

---

## 📱 Funcionalidades de Comunicação

### WhatsApp Integrado
O sistema utiliza o protocolo `wa.me` com templates dinâmicos:
- **LP:** Envia o resumo da simulação diretamente para o consultor.
- **Admin:** Envia mensagens de sucesso e aprovação editáveis para o cliente final.

---

## 🚀 Como Expandir
1. **Novas Taxas:** Basta atualizar as tabelas `machines` ou `card_flags` no painel Admin; o simulador e o financeiro se ajustam automaticamente.
2. **Novos Relatórios:** Utilize a biblioteca `Recharts` já configurada no `Financeiro.tsx`.
3. **Automação:** As lógicas de auditoria estão centralizadas em `LoanRequests.tsx`.

---
*Documentação gerada automaticamente para o ecossistema CM CRED Soluções Financeiras.*
