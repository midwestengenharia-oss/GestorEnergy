-- Migration 020: Adiciona campo para rastrear edição manual de cobranças
-- Usado quando gestor edita campos da cobrança manualmente

-- Adicionar campo editado_manualmente
ALTER TABLE cobrancas
ADD COLUMN IF NOT EXISTS editado_manualmente BOOLEAN DEFAULT FALSE;

-- Comentário
COMMENT ON COLUMN cobrancas.editado_manualmente IS 'Indica se a cobrança foi editada manualmente pelo gestor';

-- Índice para filtrar cobranças editadas
CREATE INDEX IF NOT EXISTS idx_cobrancas_editado_manualmente
ON cobrancas(editado_manualmente)
WHERE editado_manualmente = TRUE;
