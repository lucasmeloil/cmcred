-- =========================================================================
-- CORREÇÃO DEFINITIVA DE ROW LEVEL SECURITY (RLS) NA TABELA CUSTOMERS
-- Data: 2026-09-09
-- =========================================================================

-- 1. Remover policies antigas restritivas de customers
DROP POLICY IF EXISTS "customers_auth" ON public.customers;
DROP POLICY IF EXISTS "customers_all_authenticated" ON public.customers;
DROP POLICY IF EXISTS "customers_select_anon" ON public.customers;
DROP POLICY IF EXISTS "customers_authenticated_all" ON public.customers;
DROP POLICY IF EXISTS "customers_all_policy" ON public.customers;
DROP POLICY IF EXISTS "customers_authenticated_access" ON public.customers;
DROP POLICY IF EXISTS "customers_all_auth" ON public.customers;
DROP POLICY IF EXISTS "customers_public_all" ON public.customers;

-- 2. Criar política universal e irrestrita para customers (authenticated e anon)
CREATE POLICY "customers_public_all" ON public.customers
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- 3. Garantir permissões completas de GRANT para as roles anon, authenticated e service_role
GRANT ALL ON public.customers TO anon, authenticated, service_role;
