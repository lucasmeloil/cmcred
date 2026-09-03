-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabela de Perfis (Vinculada ao Auth.Users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  role TEXT CHECK (role IN ('admin', 'manager', 'operator')) DEFAULT 'operator',
  status TEXT CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Tabela de Leads
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  cpf TEXT,
  phone TEXT,
  email TEXT,
  source TEXT,
  status TEXT CHECK (status IN ('new', 'contacted', 'qualified', 'lost')) DEFAULT 'new',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. Tabela de Clientes
CREATE TABLE IF NOT EXISTS customers (
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. Tabela de Bancos
CREATE TABLE IF NOT EXISTS banks (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

-- 5. Tabela de Maquininhas
CREATE TABLE IF NOT EXISTS machines (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  bank_id BIGINT REFERENCES banks(id) ON DELETE SET NULL,
  fee_percentage NUMERIC(5,2),
  liquidation_days INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 6. Tabela de Empréstimos (Loans)
CREATE TABLE IF NOT EXISTS loans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  type TEXT CHECK (type IN ('cartão', 'consignado', 'FGTS', 'pessoal')) NOT NULL,
  requested_amount NUMERIC(15,2) NOT NULL,
  approved_amount NUMERIC(15,2),
  installments INTEGER,
  interest_rate NUMERIC(5,2),
  bank_id BIGINT REFERENCES banks(id),
  machine_id BIGINT REFERENCES machines(id),
  status TEXT CHECK (status IN ('pending', 'in analysis', 'approved', 'rejected', 'completed')) DEFAULT 'pending',
  observations TEXT,
  profit NUMERIC(15,2) DEFAULT 0,
  gross_amount NUMERIC(15,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 7. Tabela Financeira
CREATE TABLE IF NOT EXISTS finance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  description TEXT NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  due_date TIMESTAMP WITH TIME ZONE NOT NULL,
  type TEXT CHECK (type IN ('payable', 'receivable')) NOT NULL,
  status TEXT CHECK (status IN ('pending', 'paid', 'overdue')) DEFAULT 'pending',
  category TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 8. Tabela de Auditoria (Audit Logs)
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  description TEXT,
  ip TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 9. Tabela de Notificações
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  tipo TEXT,
  mensagem TEXT NOT NULL,
  lida BOOLEAN DEFAULT FALSE,
  data_hora TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Habilitar RLS em todas as tabelas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Políticas Básicas (Acesso total para administradores e leitura para autenticados)
-- Nota: Em produção, estas políticas devem ser mais restritivas.

CREATE POLICY "Acesso Total Admin" ON profiles FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "Leitura Perfis Próprios" ON profiles FOR SELECT USING (auth.uid() = id);

-- Trigger para atualizar profiles ao criar usuário no Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, status)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.email, 'operator', 'active');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
