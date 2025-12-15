-- Migration: Tabela de Configurações de Impostos
-- Descrição: Armazena histórico de impostos (PIS, COFINS, ICMS) com vigência

-- Criar tabela de configurações de impostos
CREATE TABLE IF NOT EXISTS configuracoes_impostos (
    id SERIAL PRIMARY KEY,
    pis DECIMAL(10, 6) NOT NULL,           -- Ex: 0.012102 (1.2102%)
    cofins DECIMAL(10, 6) NOT NULL,        -- Ex: 0.055743 (5.5743%)
    icms DECIMAL(10, 6) NOT NULL,          -- Ex: 0.17 (17%)
    vigencia_inicio DATE NOT NULL,
    vigencia_fim DATE,                      -- NULL = vigente
    criado_por UUID REFERENCES usuarios(id),
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    observacao TEXT,

    -- Constraint para garantir que não haja sobreposição de vigências
    CONSTRAINT vigencia_valida CHECK (vigencia_fim IS NULL OR vigencia_fim >= vigencia_inicio)
);

-- Índice para busca por vigência
CREATE INDEX idx_impostos_vigencia ON configuracoes_impostos(vigencia_inicio, vigencia_fim);

-- Inserir valores atuais (vigência a partir de 2025)
INSERT INTO configuracoes_impostos (pis, cofins, icms, vigencia_inicio, observacao)
VALUES (0.012102, 0.055743, 0.17, '2025-01-01', 'Valores iniciais do sistema');

-- Comentários
COMMENT ON TABLE configuracoes_impostos IS 'Histórico de configurações de impostos (PIS, COFINS, ICMS)';
COMMENT ON COLUMN configuracoes_impostos.pis IS 'Percentual PIS em decimal (ex: 0.012102 = 1.2102%)';
COMMENT ON COLUMN configuracoes_impostos.cofins IS 'Percentual COFINS em decimal (ex: 0.055743 = 5.5743%)';
COMMENT ON COLUMN configuracoes_impostos.icms IS 'Percentual ICMS em decimal (ex: 0.17 = 17%)';
COMMENT ON COLUMN configuracoes_impostos.vigencia_inicio IS 'Data de início da vigência';
COMMENT ON COLUMN configuracoes_impostos.vigencia_fim IS 'Data de fim da vigência (NULL = vigente)';
