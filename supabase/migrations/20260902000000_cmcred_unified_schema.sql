-- CM CRED - DATABASE INITIALIZATION & COMPLETE UNIFIED SCHEMA
-- Script completo: Tabelas, Extensões, Triggers, RPCs, RLS e Carga Inicial
-- =========================================================================

-- 0. Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================================================
-- 1. TABELAS DE AUTENTICAÇÃO E CADASTRO
-- =========================================================================

-- 1.1 Perfis de Usuários (Profiles)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  role TEXT CHECK (role IN ('admin', 'manager', 'operator', 'consultant')) DEFAULT 'operator',
  status TEXT CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
  avatar_url TEXT,
  commission_percentage NUMERIC(5,2) DEFAULT 0,
  permissions JSONB DEFAULT '{
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
  }'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 1.2 Leads (Captação Landing Page e Operadores)
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  cpf TEXT,
  phone TEXT,
  email TEXT,
  source TEXT DEFAULT 'simulador_cmcred',
  status TEXT CHECK (status IN ('new', 'contacted', 'qualified', 'lost')) DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 1.3 Clientes (Customers)
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  cpf TEXT UNIQUE,
  phone TEXT,
  email TEXT,
  birth_date DATE,
  address TEXT,
  pix_key TEXT,
  status TEXT CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
  person_type TEXT CHECK (person_type IN ('customer', 'employee', 'admin')) DEFAULT 'customer',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =========================================================================
-- 2. TABELAS DE CONFIGURAÇÃO DE TAXAS E MAQUININHAS
-- =========================================================================

-- 2.1 Bancos e Adquirentes
CREATE TABLE IF NOT EXISTS public.banks (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

-- 2.2 Maquininhas POS
CREATE TABLE IF NOT EXISTS public.machines (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  bank_id BIGINT REFERENCES public.banks(id) ON DELETE SET NULL,
  fee_percentage NUMERIC(5,2) DEFAULT 0,
  installment_fees JSONB DEFAULT '{"1": 2.5, "2": 3.0, "3": 3.5, "4": 4.0, "5": 4.5, "6": 5.0, "7": 5.5, "8": 6.0, "9": 6.5, "10": 7.0, "11": 7.5, "12": 8.0, "13": 8.5, "14": 9.0, "15": 9.5, "16": 10.0, "17": 10.5, "18": 11.0}',
  liquidation_days INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2.3 Bandeiras de Cartão
CREATE TABLE IF NOT EXISTS public.card_flags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  icon TEXT NOT NULL,
  fee_percentage NUMERIC NOT NULL DEFAULT 0,
  special BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2.4 Matriz de Taxas Oficiais do Simulador CM CRED (Tabela 1 e 2 de 1x a 18x)
CREATE TABLE IF NOT EXISTS public.simulator_rates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '💳',
  color TEXT DEFAULT '#1a1f71',
  installment_rates JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =========================================================================
-- 3. OPERAÇÕES, FINANCEIRO E AUDITORIA
-- =========================================================================

-- 3.1 Empréstimos e Operações (Loans)
CREATE TABLE IF NOT EXISTS public.loans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  consultant_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  type TEXT CHECK (type IN ('cartão', 'consignado', 'FGTS', 'pessoal')) NOT NULL,
  requested_amount NUMERIC(15,2) NOT NULL,
  approved_amount NUMERIC(15,2),
  installments INTEGER,
  interest_rate NUMERIC(5,2),
  bank_id BIGINT REFERENCES public.banks(id) ON DELETE SET NULL,
  machine_id BIGINT REFERENCES public.machines(id) ON DELETE SET NULL,
  status TEXT CHECK (status IN ('pending', 'in analysis', 'approved', 'rejected', 'completed')) DEFAULT 'pending',
  observations TEXT,
  profit NUMERIC(15,2) DEFAULT 0,
  gross_amount NUMERIC(15,2) DEFAULT 0,
  consultant_commission_amount NUMERIC(12,2) DEFAULT 0,
  company_net_profit NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3.2 Financeiro (Fluxo de Caixa / DRE)
CREATE TABLE IF NOT EXISTS public.finance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loan_id UUID REFERENCES public.loans(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  gross_amount NUMERIC(15,2),
  due_date TIMESTAMPTZ NOT NULL,
  type TEXT CHECK (type IN ('payable', 'receivable')) NOT NULL,
  status TEXT CHECK (status IN ('pending', 'paid', 'overdue')) DEFAULT 'pending',
  category TEXT,
  bank_id BIGINT REFERENCES public.banks(id) ON DELETE SET NULL,
  machine_id BIGINT REFERENCES public.machines(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3.3 Logs de Auditoria
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  description TEXT,
  ip TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3.4 Notificações
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tipo TEXT,
  mensagem TEXT NOT NULL,
  lida BOOLEAN DEFAULT FALSE,
  data_hora TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =========================================================================
-- 4. FUNÇÕES, TRIGGERS E RPCS DE SEGURANÇA
-- =========================================================================

-- 4.1 Trigger para auto-criação de perfil ao cadastrar no Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_role TEXT := 'operator';
  v_perms JSONB;
BEGIN
  IF new.email ILIKE 'admin@%' OR new.email ILIKE '%cmcred%' OR new.raw_user_meta_data->>'role' = 'admin' THEN
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
      role = CASE WHEN public.profiles.email ILIKE 'admin@%' OR public.profiles.email ILIKE '%cmcred%' THEN 'admin' ELSE public.profiles.role END;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4.2 RPC para Criação de Usuários via Painel de Gestão (sem confirmação de email necessária)
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
  
  -- Verificar se usuário já existe
  SELECT id INTO v_existing_id FROM auth.users WHERE email = p_email;
  
  IF v_existing_id IS NOT NULL THEN
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

  -- Inserção no auth.users
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

  -- Inserção no auth.identities
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

  -- Inserção em public.profiles
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

-- =========================================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- =========================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulator_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Limpeza preventiva de policies
DO $$ 
DECLARE 
    pol RECORD;
BEGIN 
    FOR pol IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- Acesso total a usuários logados (Operação do Sistema)
CREATE POLICY "profiles_auth" ON public.profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "leads_auth" ON public.leads FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "customers_auth" ON public.customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "banks_auth" ON public.banks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "machines_auth" ON public.machines FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "card_flags_auth" ON public.card_flags FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "simulator_rates_auth" ON public.simulator_rates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "loans_auth" ON public.loans FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "finance_auth" ON public.finance FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "audit_logs_auth" ON public.audit_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "notifications_auth" ON public.notifications FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Acesso público anônimo (Landing Page e Simulador CM CRED)
CREATE POLICY "simulator_rates_anon_read" ON public.simulator_rates FOR SELECT TO anon USING (true);
CREATE POLICY "card_flags_anon_read" ON public.card_flags FOR SELECT TO anon USING (true);
CREATE POLICY "machines_anon_read" ON public.machines FOR SELECT TO anon USING (true);
CREATE POLICY "banks_anon_read" ON public.banks FOR SELECT TO anon USING (true);
CREATE POLICY "leads_anon_insert" ON public.leads FOR INSERT TO anon WITH CHECK (true);

-- =========================================================================
-- 6. CARGA DE DADOS INICIAIS (SEED DATA CM CRED)
-- =========================================================================

-- 6.1 Bandeiras Padrão
INSERT INTO public.card_flags (id, name, color, icon, fee_percentage, special) VALUES
  ('visa', 'Visa', '#1a1f71', '💳', 0, false),
  ('mastercard', 'Mastercard', '#eb001b', '💳', 0, false),
  ('elo', 'Elo', '#00a1e4', '💳', 1.0, false),
  ('hipercard', 'Hipercard', '#b3131b', '💳', 1.5, false),
  ('banese', 'Banese Card', '#00a859', '🏦', 3.0, true),
  ('amex', 'American Express', '#006fcf', '💎', 0, false)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  color = EXCLUDED.color,
  icon = EXCLUDED.icon;

-- 6.2 Bancos Principais
INSERT INTO public.banks (name) VALUES
  ('Banco do Brasil'),
  ('Bradesco'),
  ('Caixa Econômica Federal'),
  ('Itaú Unibanco'),
  ('Santander'),
  ('Banese'),
  ('Nubank'),
  ('Inter'),
  ('C6 Bank'),
  ('PagBank / PagSeguro'),
  ('Stone'),
  ('Cielo')
ON CONFLICT (name) DO NOTHING;

-- 6.3 Maquininhas Iniciais
DO $$
DECLARE
  v_bank_id BIGINT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.machines LIMIT 1) THEN
    SELECT id INTO v_bank_id FROM public.banks WHERE name = 'PagBank / PagSeguro' LIMIT 1;
    IF v_bank_id IS NULL THEN
      SELECT id INTO v_bank_id FROM public.banks LIMIT 1;
    END IF;

    INSERT INTO public.machines (name, bank_id, fee_percentage, liquidation_days, installment_fees)
    VALUES 
      ('Moderninha Pro PagBank', v_bank_id, 2.50, 1, '{"1": 2.5, "2": 3.2, "3": 3.8, "4": 4.5, "5": 5.0, "6": 5.5, "7": 6.2, "8": 6.8, "9": 7.3, "10": 7.9, "11": 8.5, "12": 9.0, "13": 9.5, "14": 10.0, "15": 10.5, "16": 11.0, "17": 11.5, "18": 12.0}'),
      ('Stone Smart POS', v_bank_id, 2.30, 1, '{"1": 2.3, "2": 3.0, "3": 3.6, "4": 4.2, "5": 4.8, "6": 5.3, "7": 6.0, "8": 6.5, "9": 7.0, "10": 7.6, "11": 8.2, "12": 8.8, "13": 9.3, "14": 9.8, "15": 10.3, "16": 10.8, "17": 11.3, "18": 11.8}');
  END IF;
END $$;

-- 6.4 Matriz Oficial de Taxas do Simulador (Tabela 1 e Tabela 2 de 1x a 18x)
INSERT INTO public.simulator_rates (id, name, icon, color, installment_rates)
VALUES 
  (
    'VISA_MASTER',
    'VISA / MASTER',
    '💳',
    '#1a1f71',
    '{
      "t1": {"1": 7.00, "2": 8.25, "3": 8.75, "4": 9.50, "5": 9.99, "6": 10.75, "7": 11.25, "8": 11.75, "9": 12.25, "10": 12.99, "11": 13.75, "12": 14.49, "13": 16.50, "14": 17.00, "15": 17.49, "16": 18.00, "17": 19.00, "18": 19.99},
      "t2": {"1": 5.50, "2": 6.00, "3": 7.00, "4": 8.00, "5": 8.50, "6": 9.00, "7": 9.50, "8": 10.00, "9": 10.50, "10": 11.00, "11": 13.00, "12": 13.00, "13": 14.00, "14": 16.00, "15": 17.00, "16": 18.50, "17": 18.50, "18": 18.50}
    }'::jsonb
  ),
  (
    'BANESE/ELO',
    'BANESE / ELO',
    '🏦',
    '#00a859',
    '{
      "t1": {"1": 8.00, "2": 9.00, "3": 10.00, "4": 10.50, "5": 11.50, "6": 12.50, "7": 13.00, "8": 14.00, "9": 14.50, "10": 14.99, "11": 15.75, "12": 16.75, "13": 17.50, "14": 17.75, "15": 22.50, "16": 21.00, "17": 21.50, "18": 24.75},
      "t2": {"1": 6.50, "2": 7.50, "3": 8.50, "4": 9.00, "5": 10.50, "6": 11.00, "7": 11.50, "8": 11.50, "9": 12.50, "10": 13.00, "11": 13.50, "12": 15.00, "13": 15.50, "14": 16.50, "15": 17.00, "16": 20.00, "17": 20.00, "18": 21.00}
    }'::jsonb
  ),
  (
    'AMEX',
    'AMERICAN EXPRESS - AMEX',
    '💎',
    '#006fcf',
    '{
      "t1": {"1": 8.00, "2": 9.00, "3": 10.00, "4": 10.50, "5": 11.50, "6": 12.50, "7": 13.00, "8": 14.00, "9": 14.50, "10": 14.99, "11": 15.75, "12": 16.75, "13": 17.50, "14": 17.75, "15": 22.50, "16": 21.00, "17": 21.50, "18": 24.75},
      "t2": {"1": 6.00, "2": 7.00, "3": 8.00, "4": 9.00, "5": 10.00, "6": 10.00, "7": 11.00, "8": 11.50, "9": 12.00, "10": 12.50, "11": 13.00, "12": 14.00, "13": 15.00, "14": 16.00, "15": 17.00, "16": 20.00, "17": 20.00, "18": 20.00}
    }'::jsonb
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  installment_rates = EXCLUDED.installment_rates;
