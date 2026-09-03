-- Remover as políticas antigas estritas
DROP POLICY IF EXISTS "Card flags are viewable by everyone" ON public.card_flags;
DROP POLICY IF EXISTS "Card flags are insertable by admins" ON public.card_flags;
DROP POLICY IF EXISTS "Card flags are updatable by admins" ON public.card_flags;
DROP POLICY IF EXISTS "Card flags are deletable by admins" ON public.card_flags;

-- Criar política de acesso total para usuários autenticados (mesmo padrão do resto do sistema)
CREATE POLICY "card_flags_all_auth" ON public.card_flags FOR ALL TO authenticated USING (true) WITH CHECK (true);
