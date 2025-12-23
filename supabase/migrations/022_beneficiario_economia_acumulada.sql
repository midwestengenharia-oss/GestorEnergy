-- ===================================================================
-- Migration 022: Adiciona economia_acumulada à tabela beneficiarios
-- ===================================================================
-- Permite rastrear a economia total acumulada de cada beneficiário
-- Atualizada automaticamente ao aprovar cobranças

-- Adicionar coluna economia_acumulada
ALTER TABLE beneficiarios
ADD COLUMN IF NOT EXISTS economia_acumulada DECIMAL(12, 2) DEFAULT 0;

-- Comentário
COMMENT ON COLUMN beneficiarios.economia_acumulada IS 'Economia total acumulada do beneficiário (soma de economia_mes de todas as cobranças aprovadas)';

-- Índice para queries de dashboard
CREATE INDEX IF NOT EXISTS idx_beneficiarios_economia ON beneficiarios(economia_acumulada);

-- Atualizar valores existentes baseado nas cobranças já aprovadas/pagas
UPDATE beneficiarios b
SET economia_acumulada = COALESCE((
    SELECT SUM(COALESCE(c.economia_mes, 0))
    FROM cobrancas c
    WHERE c.beneficiario_id = b.id
    AND c.status IN ('EMITIDA', 'PAGA')
), 0);
