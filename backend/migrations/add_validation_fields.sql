-- Migration: Adicionar campos de validação nas faturas
-- Data: 2025-12-09
-- Descrição: Adiciona campos para armazenar score de validação e avisos da extração com IA

-- Adicionar campo para armazenar avisos de validação (JSONB)
ALTER TABLE faturas
ADD COLUMN IF NOT EXISTS extracao_avisos JSONB DEFAULT NULL;

-- Adicionar campo para armazenar score de confiança (0-100)
ALTER TABLE faturas
ADD COLUMN IF NOT EXISTS extracao_score INTEGER DEFAULT NULL;

-- Comentários nas colunas
COMMENT ON COLUMN faturas.extracao_avisos IS 'Avisos e alertas da validação dos dados extraídos (JSON array)';
COMMENT ON COLUMN faturas.extracao_score IS 'Score de confiança da extração (0-100), onde 100 = sem problemas';

-- Criar índice para facilitar queries por score
CREATE INDEX IF NOT EXISTS idx_faturas_extracao_score ON faturas(extracao_score);

-- Criar índice GIN para queries JSONB nos avisos
CREATE INDEX IF NOT EXISTS idx_faturas_extracao_avisos ON faturas USING GIN (extracao_avisos);
