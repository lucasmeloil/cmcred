-- =========================================================================
-- MIGRAÇÃO: CAMPOS EXPLÍCITOS DE RETENÇÃO DA MAQUININHA EM PUBLIC.LOANS
-- Permite armazenar com exatidão a taxa % e o valor R$ de retenção da adquirente
-- =========================================================================

ALTER TABLE public.loans 
  ADD COLUMN IF NOT EXISTS machine_fee_percentage NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS machine_fee_amount NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_bank_amount NUMERIC(15,2) DEFAULT 0;

-- Backfill de dados para contratos legados a partir do texto em observations
DO $$
BEGIN
  -- Atualizar percentual e valor de retenção se existirem em observations
  UPDATE public.loans
  SET 
    machine_fee_percentage = COALESCE(NULLIF(regexp_replace(substring(observations from '(?i)Retenção\s*([\d.,]+)%'), ',', '.'), '')::numeric, 0),
    machine_fee_amount = COALESCE(NULLIF(regexp_replace(substring(observations from '(?i)Retenção\s*[\d.,]+%\s*=\s*R\$\s*([\d.,]+)'), ',', '.'), '')::numeric, 0)
  WHERE observations ILIKE '%Retenção%' 
    AND (machine_fee_amount IS NULL OR machine_fee_amount = 0);

  -- Atualizar net_bank_amount (Valor que entra na conta da empresa)
  UPDATE public.loans
  SET net_bank_amount = COALESCE(approved_amount, gross_amount, requested_amount) - COALESCE(machine_fee_amount, 0)
  WHERE net_bank_amount IS NULL OR net_bank_amount = 0;
END $$;
