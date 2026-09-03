-- Tornar a função de super admin sempre verdadeira para testes
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean AS $$
BEGIN
  -- Temporariamente liberado para todos os usuários logados
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Garantir que as políticas de RLS permitam acesso total a usuários autenticados
DROP POLICY IF EXISTS "Super Admin can do everything on machines" ON public.machines;
CREATE POLICY "Allow all authenticated on machines" ON public.machines
  FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Admin can delete loans" ON public.loans;
CREATE POLICY "Allow all authenticated to delete loans" ON public.loans
  FOR DELETE TO authenticated USING (true);
