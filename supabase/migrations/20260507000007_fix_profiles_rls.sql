-- Garantir que todos os usuários autenticados possam ver os perfis
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles
  FOR SELECT TO authenticated USING (true);

-- Garantir que todos possam atualizar (pelo menos por enquanto, conforme pedido)
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
CREATE POLICY "Allow all authenticated to update profiles" ON public.profiles
  FOR UPDATE TO authenticated USING (true);
