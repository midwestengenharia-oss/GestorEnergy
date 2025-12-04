-- Migration: Tabela para armazenar sessões da Energisa no banco
-- Substitui o armazenamento em arquivo local

CREATE TABLE IF NOT EXISTS sessoes_energisa (
    id SERIAL PRIMARY KEY,
    cpf VARCHAR(14) NOT NULL UNIQUE,
    cookies JSONB NOT NULL,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para busca rápida por CPF
CREATE INDEX IF NOT EXISTS idx_sessoes_energisa_cpf ON sessoes_energisa(cpf);

-- Comentários
COMMENT ON TABLE sessoes_energisa IS 'Armazena sessões de login da Energisa por CPF';
COMMENT ON COLUMN sessoes_energisa.cpf IS 'CPF do titular (apenas números)';
COMMENT ON COLUMN sessoes_energisa.cookies IS 'Cookies da sessão em formato JSON';

-- Trigger para atualizar timestamp
CREATE OR REPLACE FUNCTION update_sessoes_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sessoes_timestamp ON sessoes_energisa;
CREATE TRIGGER trigger_sessoes_timestamp
    BEFORE UPDATE ON sessoes_energisa
    FOR EACH ROW
    EXECUTE FUNCTION update_sessoes_timestamp();
