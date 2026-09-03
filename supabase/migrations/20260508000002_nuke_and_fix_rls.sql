DO $$ 
DECLARE 
    pol RECORD;
BEGIN 
    -- Nuke all policies in the public schema
    FOR pol IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- Recriar as políticas limpas (Acesso Total para usuários autenticados enquanto em desenvolvimento)

-- PROFILES
CREATE POLICY "profiles_all_auth" ON public.profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- FINANCE
CREATE POLICY "finance_all_auth" ON public.finance FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- LOANS
CREATE POLICY "loans_all_auth" ON public.loans FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- LEADS
CREATE POLICY "leads_all_auth" ON public.leads FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- CUSTOMERS
CREATE POLICY "customers_all_auth" ON public.customers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- BANKS
CREATE POLICY "banks_all_auth" ON public.banks FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- MACHINES
CREATE POLICY "machines_all_auth" ON public.machines FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- NOTIFICATIONS
CREATE POLICY "notifications_all_auth" ON public.notifications FOR ALL TO authenticated USING (true) WITH CHECK (true);
