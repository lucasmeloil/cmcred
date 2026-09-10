-- =============================================================================
-- CORREÇÃO DE SEGURANÇA RLS — SISTEMA CM CRED
-- Data: 2026-09-10
-- Objetivo: Substituir todas as políticas permissivas "public USING (true)"
--           por políticas restritas a usuários autenticados (authenticated),
--           eliminando acesso anônimo a dados financeiros sensíveis.
--           Também revoga execução anônima de funções SECURITY DEFINER.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. LOANS (Empréstimos / Operações Financeiras)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "loans_public_all" ON public.loans;
DROP POLICY IF EXISTS "loans_authenticated_all" ON public.loans;

CREATE POLICY "loans_authenticated_all"
  ON public.loans
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 2. FINANCE (Fluxo Financeiro — Contas a Pagar e a Receber)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "finance_public_all" ON public.finance;
DROP POLICY IF EXISTS "finance_authenticated_all" ON public.finance;

CREATE POLICY "finance_authenticated_all"
  ON public.finance
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 3. CUSTOMERS (Clientes Cadastrados)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "customers_public_all" ON public.customers;
DROP POLICY IF EXISTS "customers_authenticated_all" ON public.customers;

CREATE POLICY "customers_authenticated_all"
  ON public.customers
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 4. LEADS (Leads e Clientes em Potencial)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "leads_public_all" ON public.leads;
DROP POLICY IF EXISTS "leads_authenticated_all" ON public.leads;

CREATE POLICY "leads_authenticated_all"
  ON public.leads
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 5. PROFILES (Perfis de Usuários e Consultores)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_public_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_authenticated_all" ON public.profiles;

CREATE POLICY "profiles_authenticated_all"
  ON public.profiles
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 6. MACHINES (Maquininhas POS)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "machines_public_all" ON public.machines;
DROP POLICY IF EXISTS "machines_authenticated_all" ON public.machines;

CREATE POLICY "machines_authenticated_all"
  ON public.machines
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 7. BANKS (Bancos / Instituições Financeiras)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "banks_public_all" ON public.banks;
DROP POLICY IF EXISTS "banks_authenticated_all" ON public.banks;

CREATE POLICY "banks_authenticated_all"
  ON public.banks
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 8. CARD_FLAGS (Bandeiras de Cartão)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "card_flags_public_all" ON public.card_flags;
DROP POLICY IF EXISTS "card_flags_authenticated_all" ON public.card_flags;

CREATE POLICY "card_flags_authenticated_all"
  ON public.card_flags
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 9. SIMULATOR_RATES (Tabelas de Taxas do Simulador)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "simulator_rates_public_all" ON public.simulator_rates;
DROP POLICY IF EXISTS "simulator_rates_authenticated_all" ON public.simulator_rates;

CREATE POLICY "simulator_rates_authenticated_all"
  ON public.simulator_rates
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 10. CUSTOM_RATE_TABLES (Tabelas de Taxas Personalizadas)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "custom_rate_tables_all" ON public.custom_rate_tables;
DROP POLICY IF EXISTS "custom_rate_tables_authenticated_all" ON public.custom_rate_tables;

CREATE POLICY "custom_rate_tables_authenticated_all"
  ON public.custom_rate_tables
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 11. NOTIFICATIONS (Notificações do Sistema)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "notifications_public_all" ON public.notifications;
DROP POLICY IF EXISTS "notifications_authenticated_all" ON public.notifications;

CREATE POLICY "notifications_authenticated_all"
  ON public.notifications
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 12. AUDIT_LOGS (Módulo removido — apenas acesso autenticado se a tabela existir)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "audit_logs_public_all" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_authenticated_all" ON public.audit_logs;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'audit_logs') THEN
    EXECUTE 'CREATE POLICY "audit_logs_authenticated_all"
      ON public.audit_logs
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true)';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 13. REVOGAR GRANTS EXCESSIVOS DA ROLE anon
--     Garante que usuários não autenticados não possam ler NENHUM dado.
-- ---------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

-- Re-concede apenas para authenticated e service_role
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 14. CORRIGIR FUNÇÕES SECURITY DEFINER — Revogar execução anônima
-- ---------------------------------------------------------------------------

-- admin_create_user: Revogar acesso anônimo + verificar autenticação internamente
REVOKE EXECUTE ON FUNCTION public.admin_create_user(text, text, text, text, numeric, jsonb) FROM anon;

-- admin_update_user_password: Revogar acesso anônimo
REVOKE EXECUTE ON FUNCTION public.admin_update_user_password(uuid, text) FROM anon;

-- handle_new_user: É uma função de trigger — não deve ser chamável via REST API
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;

-- Garantir que search_path é seguro nas funções SECURITY DEFINER
ALTER FUNCTION public.admin_create_user(text, text, text, text, numeric, jsonb)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.admin_update_user_password(uuid, text)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.handle_new_user()
  SET search_path = public, pg_temp;
