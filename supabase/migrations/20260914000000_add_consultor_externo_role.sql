-- ================================================================
-- MIGRATION: Adicionar perfil 'consultor_externo' ao sistema
-- Data: 2026-09-14
-- Descrição: Cria novo role 'consultor_externo' com restrições
--            idênticas ao 'consultant' (salário fixo, sem acesso
--            a módulos financeiros/acessos).
-- ================================================================

-- 1. Remover o CHECK constraint existente na coluna role
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

-- 2. Recriar o CHECK constraint incluindo 'consultor_externo'
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role = ANY (ARRAY[
    'admin'::text,
    'manager'::text,
    'operator'::text,
    'consultant'::text,
    'consultor_externo'::text
  ]));

-- 3. Confirmar alteração
DO $$
BEGIN
  RAISE NOTICE 'CHECK constraint de profiles.role atualizado com sucesso para incluir consultor_externo.';
END $$;
