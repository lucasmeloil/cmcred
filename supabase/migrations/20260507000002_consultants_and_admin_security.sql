-- 1. Atualizar as Roles permitidas e adicionar campos de comissão
ALTER TABLE public.profiles 
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles 
  ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('admin', 'manager', 'operator', 'consultant'));

ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS commission_percentage NUMERIC(5,2) DEFAULT 0;

-- 2. Vincular empréstimos a consultores
ALTER TABLE public.loans 
  ADD COLUMN IF NOT EXISTS consultant_id UUID REFERENCES public.profiles(id);

-- 3. Criar função para verificar se o usuário é o Super Admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean AS $$
BEGIN
  RETURN (auth.jwt() ->> 'email' = 'admin@bonuscred.com');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Reconfigurar Políticas de RLS para restrição de exclusão e edição de taxas
-- Remover políticas genéricas anteriores para tabelas sensíveis
DROP POLICY IF EXISTS "Permitir tudo para usuários autenticados" ON public.loans;
DROP POLICY IF EXISTS "Permitir tudo para usuários autenticados" ON public.machines;
DROP POLICY IF EXISTS "Permitir tudo para usuários autenticados" ON public.banks;

-- POLÍTICAS PARA LOANS (Empréstimos)
CREATE POLICY "Leitura total para autenticados" ON public.loans
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Consultores podem inserir empréstimos" ON public.loans
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Apenas Admin pode editar ou excluir empréstimos" ON public.loans
    FOR ALL TO authenticated 
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

-- POLÍTICAS PARA MACHINES (Taxas e Máquinas)
CREATE POLICY "Leitura total maquininhas" ON public.machines
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Apenas Admin gerencia máquinas e taxas" ON public.machines
    FOR ALL TO authenticated 
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

-- POLÍTICAS PARA BANKS
CREATE POLICY "Leitura total bancos" ON public.banks
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Apenas Admin gerencia bancos" ON public.banks
    FOR ALL TO authenticated 
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());
