-- =========================================================================
-- LIBERAÇÃO DEFINITIVA DE RLS PARA OPERAÇÕES DO SISTEMA (CONSULTOR E ADMIN)
-- Data: 2026-09-09
-- =========================================================================

-- 1. LOANS (Empréstimos / Operações)
DROP POLICY IF EXISTS "loans_auth" ON public.loans;
DROP POLICY IF EXISTS "loans_all_authenticated" ON public.loans;
DROP POLICY IF EXISTS "loans_select_anon" ON public.loans;
DROP POLICY IF EXISTS "loans_public_all" ON public.loans;
CREATE POLICY "loans_public_all" ON public.loans FOR ALL TO public USING (true) WITH CHECK (true);

-- 2. FINANCE (Fluxo Financeiro / Contas a Pagar e Receber)
DROP POLICY IF EXISTS "finance_auth" ON public.finance;
DROP POLICY IF EXISTS "finance_all_authenticated" ON public.finance;
DROP POLICY IF EXISTS "finance_public_all" ON public.finance;
CREATE POLICY "finance_public_all" ON public.finance FOR ALL TO public USING (true) WITH CHECK (true);

-- 3. AUDIT_LOGS (Logs de Auditoria)
DROP POLICY IF EXISTS "audit_logs_auth" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_all_authenticated" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_public_all" ON public.audit_logs;
CREATE POLICY "audit_logs_public_all" ON public.audit_logs FOR ALL TO public USING (true) WITH CHECK (true);

-- 4. NOTIFICATIONS (Notificações)
DROP POLICY IF EXISTS "notifications_auth" ON public.notifications;
DROP POLICY IF EXISTS "notifications_all_authenticated" ON public.notifications;
DROP POLICY IF EXISTS "notifications_public_all" ON public.notifications;
CREATE POLICY "notifications_public_all" ON public.notifications FOR ALL TO public USING (true) WITH CHECK (true);

-- 5. LEADS (Leads e Clientes em Potencial)
DROP POLICY IF EXISTS "leads_auth" ON public.leads;
DROP POLICY IF EXISTS "leads_all_authenticated" ON public.leads;
DROP POLICY IF EXISTS "leads_insert_anon" ON public.leads;
DROP POLICY IF EXISTS "leads_public_all" ON public.leads;
CREATE POLICY "leads_public_all" ON public.leads FOR ALL TO public USING (true) WITH CHECK (true);

-- 6. MACHINES, BANKS, CARD_FLAGS, SIMULATOR_RATES
DROP POLICY IF EXISTS "machines_manage_authenticated" ON public.machines;
DROP POLICY IF EXISTS "machines_read_public" ON public.machines;
DROP POLICY IF EXISTS "machines_public_all" ON public.machines;
CREATE POLICY "machines_public_all" ON public.machines FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "banks_manage_authenticated" ON public.banks;
DROP POLICY IF EXISTS "banks_read_public" ON public.banks;
DROP POLICY IF EXISTS "banks_public_all" ON public.banks;
CREATE POLICY "banks_public_all" ON public.banks FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "card_flags_manage_authenticated" ON public.card_flags;
DROP POLICY IF EXISTS "card_flags_read_public" ON public.card_flags;
DROP POLICY IF EXISTS "card_flags_public_all" ON public.card_flags;
CREATE POLICY "card_flags_public_all" ON public.card_flags FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "simulator_rates_manage_authenticated" ON public.simulator_rates;
DROP POLICY IF EXISTS "simulator_rates_read_public" ON public.simulator_rates;
DROP POLICY IF EXISTS "simulator_rates_public_all" ON public.simulator_rates;
CREATE POLICY "simulator_rates_public_all" ON public.simulator_rates FOR ALL TO public USING (true) WITH CHECK (true);

-- 7. PROFILES
DROP POLICY IF EXISTS "profiles_delete_authenticated" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_authenticated" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_anon" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_authenticated" ON public.profiles;
DROP POLICY IF EXISTS "profiles_public_all" ON public.profiles;
CREATE POLICY "profiles_public_all" ON public.profiles FOR ALL TO public USING (true) WITH CHECK (true);

-- 8. Permissões globais de GRANT
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;
