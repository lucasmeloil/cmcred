-- =========================================================================
-- MIGRAÇÃO: CONTROLE DE LIQUIDAÇÃO D+1 / D+0 E CONFIRMAÇÃO DE RECEBÍVEIS
-- CM CRED - SISTEMA FINANCEIRO DE ADQUIRENTES
-- =========================================================================

-- 1. Garantir coluna de prazo de liquidação em machines (0 = na hora / D+0, 1 = D+1 útil, etc.)
ALTER TABLE public.machines 
  ADD COLUMN IF NOT EXISTS liquidation_days INTEGER DEFAULT 1;

-- 2. Adicionar colunas de controle de liquidação em public.loans
ALTER TABLE public.loans 
  ADD COLUMN IF NOT EXISTS settlement_status VARCHAR(20) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS settlement_due_date DATE NULL,
  ADD COLUMN IF NOT EXISTS settled_at TIMESTAMP WITH TIME ZONE NULL,
  ADD COLUMN IF NOT EXISTS settled_by UUID NULL;

-- 3. Backfill para operações existentes
DO $$
BEGIN
  -- Se a máquina for D+0 (0 dias), marcar operações como liquidadas (settled)
  UPDATE public.loans l
  SET 
    settlement_status = 'settled',
    settled_at = COALESCE(l.created_at, now())
  FROM public.machines m
  WHERE l.machine_id = m.id AND COALESCE(m.liquidation_days, 1) = 0
    AND l.settlement_status IS NULL;

  -- Para máquinas D+1 ou mais, definir settlement_due_date caso nulo
  UPDATE public.loans
  SET 
    settlement_status = COALESCE(settlement_status, 'pending'),
    settlement_due_date = COALESCE(settlement_due_date, (created_at::date + interval '1 day')::date)
  WHERE settlement_due_date IS NULL;
END $$;
