-- Migration: Adiciona suporte a CNPJ para pessoas jurídicas
-- Permite que empresas se cadastrem no sistema

-- =====================
-- TABELA usuarios
-- =====================

-- Adiciona tipo de pessoa (PF = Pessoa Física, PJ = Pessoa Jurídica)
ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS tipo_pessoa VARCHAR(2) DEFAULT 'PF' CHECK (tipo_pessoa IN ('PF', 'PJ'));

-- Adiciona campo CNPJ
ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS cnpj VARCHAR(18);

-- Adiciona razão social (para PJ)
ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS razao_social VARCHAR(300);

-- Adiciona nome fantasia (para PJ)
ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS nome_fantasia VARCHAR(200);

-- Remove constraint NOT NULL do CPF (agora pode ser nulo para PJ)
ALTER TABLE usuarios
ALTER COLUMN cpf DROP NOT NULL;

-- Remove constraint UNIQUE do CPF para recriar com condição
ALTER TABLE usuarios
DROP CONSTRAINT IF EXISTS usuarios_cpf_key;

-- Cria índice único condicional para CPF (apenas quando não é nulo)
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_cpf_unique
ON usuarios(cpf)
WHERE cpf IS NOT NULL;

-- Cria índice único para CNPJ
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_cnpj_unique
ON usuarios(cnpj)
WHERE cnpj IS NOT NULL;

-- Cria índice para tipo_pessoa
CREATE INDEX IF NOT EXISTS idx_usuarios_tipo_pessoa ON usuarios(tipo_pessoa);

-- Constraint: PF deve ter CPF, PJ deve ter CNPJ
ALTER TABLE usuarios
ADD CONSTRAINT check_documento_por_tipo
CHECK (
    (tipo_pessoa = 'PF' AND cpf IS NOT NULL) OR
    (tipo_pessoa = 'PJ' AND cnpj IS NOT NULL)
);

-- Comentários
COMMENT ON COLUMN usuarios.tipo_pessoa IS 'Tipo de pessoa: PF (Física) ou PJ (Jurídica)';
COMMENT ON COLUMN usuarios.cnpj IS 'CNPJ da empresa (apenas para PJ)';
COMMENT ON COLUMN usuarios.razao_social IS 'Razão social da empresa (apenas para PJ)';
COMMENT ON COLUMN usuarios.nome_fantasia IS 'Nome fantasia da empresa (apenas para PJ)';

-- =====================
-- TABELA leads
-- =====================

-- Adiciona tipo de pessoa nos leads também
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS tipo_pessoa VARCHAR(2) DEFAULT 'PF' CHECK (tipo_pessoa IN ('PF', 'PJ'));

ALTER TABLE leads
ADD COLUMN IF NOT EXISTS cnpj VARCHAR(18);

ALTER TABLE leads
ADD COLUMN IF NOT EXISTS razao_social VARCHAR(300);

-- =====================
-- Atualiza registros existentes
-- =====================

-- Marca todos os usuários existentes como PF (já que tinham CPF obrigatório)
UPDATE usuarios SET tipo_pessoa = 'PF' WHERE tipo_pessoa IS NULL;

UPDATE leads SET tipo_pessoa = 'PF' WHERE tipo_pessoa IS NULL;
