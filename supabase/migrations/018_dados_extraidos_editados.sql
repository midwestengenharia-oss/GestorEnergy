-- Migration 018: Adicionar campos para edições manuais de dados extraídos
-- Permite que gestores salvem correções nos dados extraídos do PDF

-- Adicionar campo para edições manuais
ALTER TABLE faturas ADD COLUMN IF NOT EXISTS dados_extraidos_editados JSONB DEFAULT NULL;

-- Campos de auditoria para edições
ALTER TABLE faturas ADD COLUMN IF NOT EXISTS editado_em TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE faturas ADD COLUMN IF NOT EXISTS editado_por UUID DEFAULT NULL;

-- Index para consultas de faturas editadas
CREATE INDEX IF NOT EXISTS idx_faturas_editado_em ON faturas(editado_em) WHERE editado_em IS NOT NULL;

-- Comentários para documentação
COMMENT ON COLUMN faturas.dados_extraidos_editados IS 'Dados extraídos corrigidos manualmente pelo gestor';
COMMENT ON COLUMN faturas.editado_em IS 'Data/hora da última edição manual';
COMMENT ON COLUMN faturas.editado_por IS 'UUID do usuário que fez a última edição';
