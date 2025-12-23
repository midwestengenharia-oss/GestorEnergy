-- Migration: GD Avulso
-- Permite gerenciar UCs com créditos GD por transferência pontual
-- (UCs que não participam do rateio de uma usina mas possuem créditos)

-- 1. Adicionar campo tipo em beneficiarios
ALTER TABLE beneficiarios
  ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) DEFAULT 'USINA';

-- Adicionar constraint de validação
ALTER TABLE beneficiarios
  DROP CONSTRAINT IF EXISTS beneficiarios_tipo_check;
ALTER TABLE beneficiarios
  ADD CONSTRAINT beneficiarios_tipo_check
  CHECK (tipo IN ('USINA', 'AVULSO'));

-- 2. Permitir usina_id NULL para beneficiários avulsos
ALTER TABLE beneficiarios
  ALTER COLUMN usina_id DROP NOT NULL;

-- Adicionar constraint: se tipo = USINA, usina_id deve ser NOT NULL
-- Se tipo = AVULSO, usina_id pode ser NULL
ALTER TABLE beneficiarios
  DROP CONSTRAINT IF EXISTS beneficiarios_usina_tipo_check;
ALTER TABLE beneficiarios
  ADD CONSTRAINT beneficiarios_usina_tipo_check
  CHECK (
    (tipo = 'USINA' AND usina_id IS NOT NULL) OR
    (tipo = 'AVULSO')
  );

-- 3. Adicionar campo tem_gd_avulso em unidades_consumidoras
-- Indica que a UC tem créditos GD mas não participa de rateio de usina
ALTER TABLE unidades_consumidoras
  ADD COLUMN IF NOT EXISTS tem_gd_avulso BOOLEAN DEFAULT FALSE;

-- 4. Adicionar campo saldo_creditos_gd para cache do saldo atual
ALTER TABLE unidades_consumidoras
  ADD COLUMN IF NOT EXISTS saldo_creditos_gd INTEGER DEFAULT 0;

-- 5. Índices para otimização
CREATE INDEX IF NOT EXISTS idx_beneficiarios_tipo ON beneficiarios(tipo);
CREATE INDEX IF NOT EXISTS idx_ucs_tem_gd_avulso ON unidades_consumidoras(tem_gd_avulso) WHERE tem_gd_avulso = TRUE;

-- 6. Comentários
COMMENT ON COLUMN beneficiarios.tipo IS 'Tipo do beneficiário: USINA (participa de rateio) ou AVULSO (créditos transferidos)';
COMMENT ON COLUMN unidades_consumidoras.tem_gd_avulso IS 'UC possui créditos GD por transferência (não participa de rateio de usina)';
COMMENT ON COLUMN unidades_consumidoras.saldo_creditos_gd IS 'Saldo atual de créditos GD em kWh (cache do gd_details)';
