-- =========================================================================
-- MIGRATION: RPC FOR CREATING/LOGGING IN USERS INSTANTLY WITH DIRECT AUTH
-- =========================================================================

CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_email TEXT,
  p_password TEXT,
  p_full_name TEXT,
  p_role TEXT DEFAULT 'consultant',
  p_commission NUMERIC DEFAULT 0,
  p_permissions JSONB DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_user_id UUID;
  v_encrypted_pw TEXT;
  v_existing_id UUID;
BEGIN
  -- Normalizar email
  p_email := LOWER(TRIM(p_email));
  
  -- Verificar se o usuário já existe no auth.users
  SELECT id INTO v_existing_id FROM auth.users WHERE email = p_email;
  
  IF v_existing_id IS NOT NULL THEN
    -- Atualizar senha e metadados
    UPDATE auth.users
    SET encrypted_password = crypt(p_password, gen_salt('bf')),
        raw_user_meta_data = json_build_object('full_name', p_full_name, 'role', p_role)::jsonb,
        updated_at = now(),
        email_confirmed_at = COALESCE(email_confirmed_at, now())
    WHERE id = v_existing_id;
    
    -- Atualizar perfil correspondente
    INSERT INTO public.profiles (id, full_name, email, role, status, commission_percentage, permissions)
    VALUES (v_existing_id, p_full_name, p_email, p_role, 'active', p_commission, p_permissions)
    ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        commission_percentage = EXCLUDED.commission_percentage,
        permissions = EXCLUDED.permissions,
        status = 'active';
        
    RETURN json_build_object('success', true, 'user_id', v_existing_id, 'message', 'Usuário existente atualizado com sucesso');
  END IF;

  v_user_id := gen_random_uuid();
  v_encrypted_pw := crypt(p_password, gen_salt('bf'));

  -- Inserir diretamente na tabela auth.users com e-mail já confirmado para login imediato
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    is_super_admin
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    p_email,
    v_encrypted_pw,
    now(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    json_build_object('full_name', p_full_name, 'role', p_role)::jsonb,
    now(),
    now(),
    encode(gen_random_bytes(32), 'hex'),
    false
  );

  -- Inserir perfil na tabela public.profiles
  INSERT INTO public.profiles (id, full_name, email, role, status, commission_percentage, permissions)
  VALUES (v_user_id, p_full_name, p_email, p_role, 'active', p_commission, p_permissions)
  ON CONFLICT (id) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      role = EXCLUDED.role,
      commission_percentage = EXCLUDED.commission_percentage,
      permissions = EXCLUDED.permissions,
      status = 'active';

  RETURN json_build_object('success', true, 'user_id', v_user_id, 'message', 'Usuário criado com sucesso');
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_user(TEXT, TEXT, TEXT, TEXT, NUMERIC, JSONB) TO authenticated, anon;

-- RPC para atualizar senha se necessário
CREATE OR REPLACE FUNCTION public.admin_update_user_password(
  p_user_id UUID,
  p_new_password TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf')),
      updated_at = now()
  WHERE id = p_user_id;

  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_user_password(UUID, TEXT) TO authenticated, anon;
