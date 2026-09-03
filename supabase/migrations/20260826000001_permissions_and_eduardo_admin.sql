-- =========================================================================
-- MIGRATION: GRANULAR PERMISSIONS & EDUARDO SUPER ADMIN
-- =========================================================================

-- 1. Adicionar coluna permissions (JSONB) na tabela profiles se não existir
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{
    "dashboard": true,
    "create_loan": true,
    "loans": true,
    "delete_loans": false,
    "finance": false,
    "machines": false,
    "card_flags": false,
    "leads": true,
    "customers": true,
    "reports": false,
    "users": false,
    "audit": false
  }'::jsonb;

-- 2. Garantir que eduardo@bonuscred.com.br (e variações com eduardo/admin) sejam SUPER ADMIN com permissão total
UPDATE public.profiles
SET role = 'admin',
    status = 'active',
    permissions = '{
      "dashboard": true,
      "create_loan": true,
      "loans": true,
      "delete_loans": true,
      "finance": true,
      "machines": true,
      "card_flags": true,
      "leads": true,
      "customers": true,
      "reports": true,
      "users": true,
      "audit": true
    }'::jsonb
WHERE email ILIKE '%eduardo%' 
   OR email = 'eduardo@bonuscred.com.br' 
   OR email = 'admin@bonuscred.com'
   OR role = 'admin';

-- 3. Atualizar o trigger para que novos cadastros com o email eduardo@bonuscred.com.br ou admin sejam automaticamente ADMIN
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_role TEXT := 'operator';
  v_perms JSONB;
BEGIN
  IF new.email ILIKE '%eduardo%' OR new.email ILIKE 'admin@%' OR new.raw_user_meta_data->>'role' = 'admin' THEN
    v_role := 'admin';
    v_perms := '{
      "dashboard": true, "create_loan": true, "loans": true, "delete_loans": true,
      "finance": true, "machines": true, "card_flags": true, "leads": true,
      "customers": true, "reports": true, "users": true, "audit": true
    }'::jsonb;
  ELSE
    v_role := COALESCE(new.raw_user_meta_data->>'role', 'consultant');
    v_perms := '{
      "dashboard": true, "create_loan": true, "loans": true, "delete_loans": false,
      "finance": false, "machines": false, "card_flags": false, "leads": true,
      "customers": true, "reports": false, "users": false, "audit": false
    }'::jsonb;
  END IF;

  INSERT INTO public.profiles (id, full_name, email, role, status, permissions)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    v_role,
    'active',
    v_perms
  )
  ON CONFLICT (id) DO UPDATE
  SET full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
      email = EXCLUDED.email,
      role = CASE WHEN public.profiles.email ILIKE '%eduardo%' OR public.profiles.email ILIKE 'admin@%' THEN 'admin' ELSE public.profiles.role END;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Função auxiliar para verificar se o usuário é Admin no banco
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean AS $$
BEGIN
  RETURN (
    auth.jwt() ->> 'email' ILIKE '%eduardo%' OR 
    auth.jwt() ->> 'email' ILIKE 'admin@%' OR
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
