-- =========================================================================
-- BONUSCRED DATABASE INITIALIZATION & COMPLETE SCHEMA MIGRATION
-- Project Ref: zhwkphzjzkichnamsjll
-- Generated on: 2026-08-26
-- =========================================================================

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. TABELA DE PERFIS (PROFILES) - Vinculada ao auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  role TEXT CHECK (role IN ('admin', 'manager', 'operator', 'consultant')) DEFAULT 'operator',
  status TEXT CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
  avatar_url TEXT,
  commission_percentage NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. TABELA DE LEADS
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  cpf TEXT,
  phone TEXT,
  email TEXT,
  source TEXT,
  status TEXT CHECK (status IN ('new', 'contacted', 'qualified', 'lost')) DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. TABELA DE CLIENTES (CUSTOMERS)
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  cpf TEXT UNIQUE,
  phone TEXT,
  email TEXT,
  birth_date DATE,
  address TEXT,
  status TEXT CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
  person_type TEXT CHECK (person_type IN ('customer', 'employee', 'admin')) DEFAULT 'customer',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. TABELA DE BANCOS (BANKS)
CREATE TABLE IF NOT EXISTS public.banks (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

-- 5. TABELA DE MAQUININHAS (MACHINES)
CREATE TABLE IF NOT EXISTS public.machines (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  bank_id BIGINT REFERENCES public.banks(id) ON DELETE SET NULL,
  fee_percentage NUMERIC(5,2) DEFAULT 0,
  installment_fees JSONB DEFAULT '{"1": 2.5, "2": 3.0, "3": 3.5, "4": 4.0, "5": 4.5, "6": 5.0, "7": 5.5, "8": 6.0, "9": 6.5, "10": 7.0, "11": 7.5, "12": 8.0, "13": 8.5, "14": 9.0, "15": 9.5, "16": 10.0, "17": 10.5, "18": 11.0}',
  liquidation_days INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. TABELA DE BANDEIRAS DE CARTÃO (CARD_FLAGS)
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

-- 7. TABELA DE EMPRÉSTIMOS / OPERAÇÕES (LOANS)
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

-- 8. TABELA FINANCEIRA (FINANCE)
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

-- 9. TABELA DE AUDITORIA (AUDIT_LOGS)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  description TEXT,
  ip TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. TABELA DE NOTIFICAÇÕES (NOTIFICATIONS)
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tipo TEXT,
  mensagem TEXT NOT NULL,
  lida BOOLEAN DEFAULT FALSE,
  data_hora TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =========================================================================
-- TRIGGERS E FUNÇÕES
-- =========================================================================

-- Trigger para criar perfil automaticamente quando um usuário se cadastra no Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, status)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    COALESCE(new.raw_user_meta_data->>'role', 'operator'),
    'active'
  )
  ON CONFLICT (id) DO UPDATE
  SET full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
      email = EXCLUDED.email;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- =========================================================================
-- ROW LEVEL SECURITY (RLS) & POLÍTICAS
-- =========================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Limpar quaisquer políticas existentes
DO $$ 
DECLARE 
    pol RECORD;
BEGIN 
    FOR pol IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- Políticas para usuários autenticados (Gestão completa do sistema)
CREATE POLICY "profiles_authenticated_access" ON public.profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "leads_authenticated_access" ON public.leads FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "customers_authenticated_access" ON public.customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "banks_authenticated_access" ON public.banks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "machines_authenticated_access" ON public.machines FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "card_flags_authenticated_access" ON public.card_flags FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "loans_authenticated_access" ON public.loans FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "finance_authenticated_access" ON public.finance FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "audit_logs_authenticated_access" ON public.audit_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "notifications_authenticated_access" ON public.notifications FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Políticas para acesso público/anônimo (Simulador da landing page e envio de Leads)
CREATE POLICY "machines_public_read" ON public.machines FOR SELECT TO anon USING (true);
CREATE POLICY "card_flags_public_read" ON public.card_flags FOR SELECT TO anon USING (true);
CREATE POLICY "banks_public_read" ON public.banks FOR SELECT TO anon USING (true);
CREATE POLICY "leads_public_insert" ON public.leads FOR INSERT TO anon WITH CHECK (true);

-- =========================================================================
-- DADOS INICIAIS (SEED DATA)
-- =========================================================================

-- Inserir bandeiras padrão
INSERT INTO public.card_flags (id, name, color, icon, fee_percentage, special) VALUES
  ('visa', 'Visa', '#1a1f71', '💳', 0, false),
  ('mastercard', 'Mastercard', '#eb001b', '💳', 0, false),
  ('elo', 'Elo', '#00a1e4', '💳', 1.0, false),
  ('hipercard', 'Hipercard', '#b3131b', '💳', 1.5, false),
  ('banese', 'Banese Card', '#00a859', '🏦', 3.0, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  color = EXCLUDED.color,
  icon = EXCLUDED.icon,
  fee_percentage = EXCLUDED.fee_percentage,
  special = EXCLUDED.special;

-- Inserir bancos principais
INSERT INTO public.banks (name) VALUES
  ('Banco do Brasil'),
  ('Bradesco'),
  ('Caixa Econômica'),
  ('Itaú Unibanco'),
  ('Santander'),
  ('Banese'),
  ('Nubank'),
  ('Inter'),
  ('C6 Bank'),
  ('PagBank / PagSeguro'),
  ('Stone')
ON CONFLICT (name) DO NOTHING;

-- Inserir maquininhas iniciais padrão
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
