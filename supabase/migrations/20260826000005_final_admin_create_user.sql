-- =========================================================================
-- MIGRATION: FINAL WORKING ADMIN_CREATE_USER WITH GOTRUE REPLICATION
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
  p_email := LOWER(TRIM(p_email));
  v_encrypted_pw := crypt(p_password, gen_salt('bf'));
  
  -- Verificar se o usuário já existe
  SELECT id INTO v_existing_id FROM auth.users WHERE email = p_email;
  
  IF v_existing_id IS NOT NULL THEN
    -- Atualizar senha e metadados
    UPDATE auth.users
    SET encrypted_password = v_encrypted_pw,
        raw_user_meta_data = json_build_object('full_name', p_full_name, 'role', p_role)::jsonb,
        updated_at = now(),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        confirmation_token = '',
        email_change_token_current = '',
        email_change_token_new = '',
        reauthentication_token = '',
        phone_change_token = ''
    WHERE id = v_existing_id;

    -- Upsert profile
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

  -- Inserir no auth.users
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
    is_super_admin,
    is_sso_user,
    is_anonymous,
    email_change_confirm_status,
    phone_change,
    phone_change_token,
    email_change_token_current,
    reauthentication_token
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
    '',
    null,
    false,
    false,
    0,
    '',
    '',
    '',
    ''
  );

  -- Inserir identidade correspondente no auth.identities
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    v_user_id,
    json_build_object('sub', v_user_id::text, 'email', p_email, 'email_verified', false, 'phone_verified', false)::jsonb,
    'email',
    v_user_id::text,
    now(),
    now(),
    now()
  );

  -- Inserir em public.profiles
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
