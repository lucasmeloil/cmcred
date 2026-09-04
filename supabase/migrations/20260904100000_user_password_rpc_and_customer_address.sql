-- =========================================================================
-- MIGRATION: ADMIN UPDATE PASSWORD RPC & CUSTOMER ADDRESS FIELDS
-- =========================================================================

-- 1. RPC para atualização de senha com precisão (Admin & Consultores)
CREATE OR REPLACE FUNCTION public.admin_update_user_password(
  p_user_id UUID,
  p_new_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public, extensions
AS $$
DECLARE
  v_encrypted_pw TEXT;
  v_exists BOOLEAN;
BEGIN
  -- Validar parâmetros
  IF p_user_id IS NULL OR p_new_password IS NULL OR length(trim(p_new_password)) < 6 THEN
    RETURN jsonb_build_object(
      'success', false, 
      'message', 'A senha deve conter no mínimo 6 caracteres.'
    );
  END IF;

  -- Verificar se o usuário existe em auth.users
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = p_user_id) INTO v_exists;
  IF NOT v_exists THEN
    RETURN jsonb_build_object(
      'success', false, 
      'message', 'Usuário não encontrado na base de autenticação.'
    );
  END IF;

  -- Gerar hash bcrypt padrão blowfish
  v_encrypted_pw := crypt(trim(p_new_password), gen_salt('bf', 10));

  -- Atualizar a senha e redefinir tokens em auth.users
  UPDATE auth.users
  SET 
    encrypted_password = v_encrypted_pw,
    updated_at = now(),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    recovery_token = '',
    confirmation_token = '',
    reauthentication_token = '',
    email_change_token_new = '',
    email_change = '',
    phone_change = '',
    phone_change_token = ''
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Senha atualizada com sucesso no banco de dados!'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false, 
    'message', 'Erro ao atualizar senha no banco: ' || SQLERRM
  );
END;
$$;

-- Garantir permissão de execução para usuários autenticados
GRANT EXECUTE ON FUNCTION public.admin_update_user_password(UUID, TEXT) TO authenticated, service_role;

-- 2. Adicionar colunas de endereço completo na tabela customers
ALTER TABLE public.customers 
  ADD COLUMN IF NOT EXISTS cep TEXT,
  ADD COLUMN IF NOT EXISTS address_number TEXT,
  ADD COLUMN IF NOT EXISTS complement TEXT,
  ADD COLUMN IF NOT EXISTS neighborhood TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT;

-- 3. Assegurar índices úteis para consultas
CREATE INDEX IF NOT EXISTS idx_customers_cep ON public.customers (cep);
CREATE INDEX IF NOT EXISTS idx_customers_cpf ON public.customers (cpf);
