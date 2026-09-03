-- =============================================================
-- CORREÇÃO DEFINITIVA: RLS policies para BonusCred
-- Problema: políticas sobrepostas bloqueavam leitura de profiles e finance
-- Solução: limpar TODAS as políticas existentes e recriar de forma limpa
-- =============================================================

-- =========== PROFILES ===========
-- Remover TODAS as políticas existentes em profiles
DROP POLICY IF EXISTS "Acesso Total Admin" ON public.profiles;
DROP POLICY IF EXISTS "Leitura Perfis Próprios" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Allow all authenticated to update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;

-- Políticas limpas: todo usuário autenticado pode ler e atualizar profiles
CREATE POLICY "profiles_authenticated_select" ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "profiles_authenticated_update" ON public.profiles
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "profiles_authenticated_insert" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "profiles_authenticated_delete" ON public.profiles
  FOR DELETE TO authenticated USING (true);

-- =========== FINANCE ===========
-- Remover TODAS as políticas existentes em finance
DROP POLICY IF EXISTS "Permitir tudo para usuários autenticados" ON public.finance;
DROP POLICY IF EXISTS "finance_select_policy" ON public.finance;
DROP POLICY IF EXISTS "finance_insert_policy" ON public.finance;
DROP POLICY IF EXISTS "finance_update_policy" ON public.finance;
DROP POLICY IF EXISTS "finance_delete_policy" ON public.finance;
DROP POLICY IF EXISTS "Allow all authenticated on finance" ON public.finance;

-- Política limpa: todo usuário autenticado tem acesso total a finance
CREATE POLICY "finance_authenticated_all" ON public.finance
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =========== LOANS ===========
-- Remover políticas conflitantes de loans
DROP POLICY IF EXISTS "Apenas Admin pode editar ou excluir empréstimos" ON public.loans;
DROP POLICY IF EXISTS "Allow all authenticated to delete loans" ON public.loans;

-- Políticas limpas para loans
DROP POLICY IF EXISTS "Leitura total para autenticados" ON public.loans;
DROP POLICY IF EXISTS "Consultores podem inserir empréstimos" ON public.loans;

CREATE POLICY "loans_authenticated_select" ON public.loans
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "loans_authenticated_insert" ON public.loans
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "loans_authenticated_update" ON public.loans
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "loans_authenticated_delete" ON public.loans
  FOR DELETE TO authenticated USING (true);

-- =========== LEADS ===========
DROP POLICY IF EXISTS "Permitir tudo para usuários autenticados" ON public.leads;
DROP POLICY IF EXISTS "leads_all_policy" ON public.leads;

CREATE POLICY "leads_authenticated_all" ON public.leads
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =========== CUSTOMERS ===========
DROP POLICY IF EXISTS "Permitir tudo para usuários autenticados" ON public.customers;
DROP POLICY IF EXISTS "customers_all_policy" ON public.customers;

CREATE POLICY "customers_authenticated_all" ON public.customers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =========== BANKS ===========
DROP POLICY IF EXISTS "Leitura total bancos" ON public.banks;
DROP POLICY IF EXISTS "Apenas Admin gerencia bancos" ON public.banks;
DROP POLICY IF EXISTS "Allow all authenticated on banks" ON public.banks;

CREATE POLICY "banks_authenticated_all" ON public.banks
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =========== MACHINES ===========
DROP POLICY IF EXISTS "Leitura total maquininhas" ON public.machines;
DROP POLICY IF EXISTS "Apenas Admin gerencia máquinas e taxas" ON public.machines;
DROP POLICY IF EXISTS "Allow all authenticated on machines" ON public.machines;
DROP POLICY IF EXISTS "Super Admin can do everything on machines" ON public.machines;

CREATE POLICY "machines_authenticated_all" ON public.machines
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =========== GARANTIR COLUNA commission_percentage ===========
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS commission_percentage NUMERIC(5,2) DEFAULT 0;

-- =========== GARANTIR COLUNAS DE FINANCE ===========
ALTER TABLE public.finance
  ADD COLUMN IF NOT EXISTS bank_id BIGINT REFERENCES public.banks(id) ON DELETE SET NULL;

ALTER TABLE public.finance
  ADD COLUMN IF NOT EXISTS machine_id BIGINT REFERENCES public.machines(id) ON DELETE SET NULL;

ALTER TABLE public.finance
  ADD COLUMN IF NOT EXISTS gross_amount NUMERIC(15,2) DEFAULT 0;

-- =========== GARANTIR COLUNAS DE LOANS ===========
ALTER TABLE public.loans
  ADD COLUMN IF NOT EXISTS consultant_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.loans
  ADD COLUMN IF NOT EXISTS consultant_commission_amount NUMERIC(15,2) DEFAULT 0;

ALTER TABLE public.loans
  ADD COLUMN IF NOT EXISTS company_net_profit NUMERIC(15,2) DEFAULT 0;

ALTER TABLE public.loans
  ADD COLUMN IF NOT EXISTS gross_amount NUMERIC(15,2) DEFAULT 0;

-- =========== ROLE CHECK ATUALIZADO ===========
ALTER TABLE public.profiles 
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles 
  ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('admin', 'manager', 'operator', 'consultant'));
