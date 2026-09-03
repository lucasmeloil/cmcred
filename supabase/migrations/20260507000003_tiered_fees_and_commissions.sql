-- Adicionar suporte a taxas por parcelas (JSONB)
ALTER TABLE public.machines 
  ADD COLUMN IF NOT EXISTS installment_fees JSONB DEFAULT '{"1": 2.5, "6": 4.5, "12": 8.0}';

-- Adicionar campo para salvar a comissão do consultor no empréstimo
ALTER TABLE public.loans 
  ADD COLUMN IF NOT EXISTS consultant_commission_amount NUMERIC(12,2) DEFAULT 0;

-- Garantir que o lucro da empresa e o lucro do consultor sejam rastreados
ALTER TABLE public.loans
  ADD COLUMN IF NOT EXISTS company_net_profit NUMERIC(12,2) DEFAULT 0;
