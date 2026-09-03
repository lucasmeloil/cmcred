-- =========================================================================
-- CRIAR TABELA DE TAXAS DO SIMULADOR (SIMULATOR_RATES)
-- Permite que qualquer edição de taxas seja persistida no banco de dados Supabase
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.simulator_rates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '💳',
  color TEXT DEFAULT '#1a1f71',
  installment_rates JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.simulator_rates ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas se existirem
DO $$ 
BEGIN 
  DROP POLICY IF EXISTS "simulator_rates_read" ON public.simulator_rates;
  DROP POLICY IF EXISTS "simulator_rates_all" ON public.simulator_rates;
  DROP POLICY IF EXISTS "simulator_rates_anon_read" ON public.simulator_rates;
  DROP POLICY IF EXISTS "simulator_rates_auth_all" ON public.simulator_rates;
END $$;

-- Permitir leitura pública/anônima (para simulador da landing page)
CREATE POLICY "simulator_rates_anon_read" ON public.simulator_rates 
  FOR SELECT TO anon USING (true);

-- Permitir leitura para autenticados
CREATE POLICY "simulator_rates_auth_read" ON public.simulator_rates 
  FOR SELECT TO authenticated USING (true);

-- Permitir INSERT, UPDATE e DELETE para usuários autenticados (Admin/Operadores)
CREATE POLICY "simulator_rates_auth_all" ON public.simulator_rates 
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Inserir / Atualizar taxas padrão
INSERT INTO public.simulator_rates (id, name, icon, color, installment_rates)
VALUES 
  ('VISA_MASTER', 'VISA / MASTER', '💳', '#1a1f71', '{"1": 5.50, "2": 6.00, "3": 7.00, "4": 8.00, "5": 8.50, "6": 9.00, "7": 9.50, "8": 10.00, "9": 10.50, "10": 11.00, "11": 13.00, "12": 13.00, "13": 14.00, "14": 16.00, "15": 17.00, "16": 18.50, "17": 18.50, "18": 18.50}'),
  ('BANESE/ELO', 'BANESE / ELO', '🏦', '#00a859', '{"1": 6.50, "2": 7.50, "3": 8.50, "4": 9.00, "5": 10.50, "6": 11.00, "7": 11.50, "8": 11.50, "9": 12.50, "10": 13.00, "11": 13.50, "12": 15.00, "13": 15.50, "14": 16.50, "15": 17.00, "16": 20.00, "17": 20.00, "18": 21.00}'),
  ('AMEX', 'AMERICAN EXPRESS - AMEX', '💎', '#006fcf', '{"1": 6.00, "2": 7.00, "3": 8.00, "4": 9.00, "5": 10.00, "6": 10.00, "7": 11.00, "8": 11.50, "9": 12.00, "10": 12.50, "11": 13.00, "12": 14.00, "13": 15.00, "14": 16.00, "15": 17.00, "16": 20.00, "17": 20.00, "18": 20.00}')
ON CONFLICT (id) DO NOTHING;
