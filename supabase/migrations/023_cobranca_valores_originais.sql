-- ===================================================================
-- Migration 023: Adiciona valores_originais à tabela cobrancas
-- ===================================================================
-- Armazena os valores originais dos campos antes de edição manual
-- Permite reverter edições para os valores calculados originalmente

ALTER TABLE cobrancas
ADD COLUMN IF NOT EXISTS valores_originais JSONB DEFAULT NULL;

COMMENT ON COLUMN cobrancas.valores_originais IS 'Valores originais dos campos antes de edição manual (para permitir reversão)';
