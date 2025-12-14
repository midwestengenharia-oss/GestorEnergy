-- ============================================================================
-- MIGRACAO 016: EXPANSAO DO MODULO CRM/LEADS
-- Adiciona campos para processo completo de onboarding de clientes
-- ============================================================================

-- 1. Adicionar novos valores ao enum lead_status
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'VINCULANDO';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'VINCULADO';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'AGUARDANDO_ACEITE';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'ACEITO';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'AGUARDANDO_ASSINATURA';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'ASSINADO';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'TROCA_TITULARIDADE';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'CADASTRANDO';

-- 2. Criar enum para tipo de pessoa
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_pessoa') THEN
        CREATE TYPE tipo_pessoa AS ENUM ('FISICA', 'JURIDICA');
    END IF;
END;
$$;

-- 3. Criar enum para status de titularidade
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'titularidade_status') THEN
        CREATE TYPE titularidade_status AS ENUM (
            'PENDENTE',
            'SOLICITADO',
            'EM_ANALISE',
            'APROVADO',
            'REJEITADO'
        );
    END IF;
END;
$$;

-- 4. Adicionar novos campos na tabela leads
DO $$
BEGIN
    -- Tipo de pessoa (PF ou PJ)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'leads' AND column_name = 'tipo_pessoa') THEN
        ALTER TABLE leads ADD COLUMN tipo_pessoa VARCHAR(10) DEFAULT 'FISICA';
    END IF;

    -- Nome/Razao Social (renomear nome para nome_razao seria breaking change, manter nome)

    -- CNPJ (para PJ)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'leads' AND column_name = 'cnpj') THEN
        ALTER TABLE leads ADD COLUMN cnpj VARCHAR(18);
    END IF;

    -- Documentos PF
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'leads' AND column_name = 'rg') THEN
        ALTER TABLE leads ADD COLUMN rg VARCHAR(20);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'leads' AND column_name = 'data_nascimento') THEN
        ALTER TABLE leads ADD COLUMN data_nascimento DATE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'leads' AND column_name = 'nacionalidade') THEN
        ALTER TABLE leads ADD COLUMN nacionalidade VARCHAR(50) DEFAULT 'Brasileira';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'leads' AND column_name = 'nome_mae') THEN
        ALTER TABLE leads ADD COLUMN nome_mae VARCHAR(200);
    END IF;

    -- Endereco completo
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'leads' AND column_name = 'logradouro') THEN
        ALTER TABLE leads ADD COLUMN logradouro VARCHAR(200);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'leads' AND column_name = 'numero') THEN
        ALTER TABLE leads ADD COLUMN numero VARCHAR(20);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'leads' AND column_name = 'complemento') THEN
        ALTER TABLE leads ADD COLUMN complemento VARCHAR(100);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'leads' AND column_name = 'bairro') THEN
        ALTER TABLE leads ADD COLUMN bairro VARCHAR(100);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'leads' AND column_name = 'cep') THEN
        ALTER TABLE leads ADD COLUMN cep VARCHAR(10);
    END IF;

    -- Concessionaria
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'leads' AND column_name = 'concessionaria') THEN
        ALTER TABLE leads ADD COLUMN concessionaria VARCHAR(50);
    END IF;

    -- Renda/Faturamento
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'leads' AND column_name = 'renda_faturamento') THEN
        ALTER TABLE leads ADD COLUMN renda_faturamento DECIMAL(15, 2);
    END IF;

    -- Telefones adicionais (JSON array)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'leads' AND column_name = 'telefones_adicionais') THEN
        ALTER TABLE leads ADD COLUMN telefones_adicionais JSONB DEFAULT '[]';
    END IF;

    -- Dados do processo de titularidade
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'leads' AND column_name = 'titularidade_status') THEN
        ALTER TABLE leads ADD COLUMN titularidade_status VARCHAR(20);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'leads' AND column_name = 'titularidade_protocolo') THEN
        ALTER TABLE leads ADD COLUMN titularidade_protocolo VARCHAR(50);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'leads' AND column_name = 'titularidade_data_solicitacao') THEN
        ALTER TABLE leads ADD COLUMN titularidade_data_solicitacao DATE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'leads' AND column_name = 'titularidade_data_conclusao') THEN
        ALTER TABLE leads ADD COLUMN titularidade_data_conclusao DATE;
    END IF;

    -- Dados da proposta aceita
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'leads' AND column_name = 'proposta_aceita_em') THEN
        ALTER TABLE leads ADD COLUMN proposta_aceita_em TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'leads' AND column_name = 'proposta_dados') THEN
        ALTER TABLE leads ADD COLUMN proposta_dados JSONB;
    END IF;

    -- Contrato gerado
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'leads' AND column_name = 'contrato_id') THEN
        ALTER TABLE leads ADD COLUMN contrato_id INTEGER REFERENCES contratos(id);
    END IF;

    -- Motivo de perda categorizado
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'leads' AND column_name = 'motivo_perda_categoria') THEN
        ALTER TABLE leads ADD COLUMN motivo_perda_categoria VARCHAR(50);
    END IF;
END;
$$;

-- 5. Criar tabela de relacionamento leads <-> UCs
CREATE TABLE IF NOT EXISTS leads_ucs (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    uc_id INTEGER NOT NULL REFERENCES unidades_consumidoras(id) ON DELETE CASCADE,

    -- Tipo de vinculo
    tipo VARCHAR(20) DEFAULT 'BENEFICIARIA', -- GERADORA, BENEFICIARIA, SIMULACAO

    -- Status do vinculo
    status VARCHAR(20) DEFAULT 'ATIVO', -- ATIVO, INATIVO, PENDENTE

    -- Dados da vinculacao
    vinculado_em TIMESTAMPTZ DEFAULT NOW(),
    vinculado_por UUID REFERENCES usuarios(id),

    -- Dados extras (ex: percentual de rateio previsto)
    dados_extras JSONB,

    criado_em TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(lead_id, uc_id)
);

CREATE INDEX IF NOT EXISTS idx_leads_ucs_lead ON leads_ucs(lead_id);
CREATE INDEX IF NOT EXISTS idx_leads_ucs_uc ON leads_ucs(uc_id);

-- 6. Criar tabela de documentos do lead
CREATE TABLE IF NOT EXISTS leads_documentos (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,

    -- Tipo do documento
    tipo VARCHAR(50) NOT NULL, -- RG, CPF, COMPROVANTE_RESIDENCIA, CONTA_ENERGIA, PROCURACAO, CONTRATO, OUTROS
    nome_arquivo VARCHAR(255) NOT NULL,

    -- Storage
    url_arquivo VARCHAR(500),
    tamanho_bytes INTEGER,
    mime_type VARCHAR(100),

    -- Metadados
    descricao TEXT,
    dados_extraidos JSONB, -- Se o documento foi processado por OCR/LLM

    -- Controle
    enviado_por UUID REFERENCES usuarios(id),
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_docs_lead ON leads_documentos(lead_id);
CREATE INDEX IF NOT EXISTS idx_leads_docs_tipo ON leads_documentos(tipo);

-- 7. Criar tabela de propostas (historico)
CREATE TABLE IF NOT EXISTS leads_propostas (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,

    -- Dados da proposta
    versao INTEGER DEFAULT 1,

    -- Dados de entrada
    consumo_kwh INTEGER,
    valor_fatura DECIMAL(10, 2),
    quantidade_ucs INTEGER DEFAULT 1,

    -- Calculos
    tarifa_aplicada DECIMAL(10, 6),
    desconto_aplicado DECIMAL(5, 4) DEFAULT 0.30,
    custo_atual DECIMAL(10, 2),
    custo_com_desconto DECIMAL(10, 2),
    economia_mensal DECIMAL(10, 2),
    economia_anual DECIMAL(10, 2),
    economia_10_anos DECIMAL(12, 2),

    -- Status
    status VARCHAR(20) DEFAULT 'GERADA', -- GERADA, ENVIADA, VISUALIZADA, ACEITA, RECUSADA, EXPIRADA

    -- Tracking
    enviada_em TIMESTAMPTZ,
    visualizada_em TIMESTAMPTZ,
    aceita_em TIMESTAMPTZ,
    recusada_em TIMESTAMPTZ,
    motivo_recusa TEXT,

    -- HTML da proposta
    html_proposta TEXT,

    criado_em TIMESTAMPTZ DEFAULT NOW(),
    criado_por UUID REFERENCES usuarios(id)
);

CREATE INDEX IF NOT EXISTS idx_leads_propostas_lead ON leads_propostas(lead_id);
CREATE INDEX IF NOT EXISTS idx_leads_propostas_status ON leads_propostas(status);

-- 8. Adicionar indices para novos campos
CREATE INDEX IF NOT EXISTS idx_leads_tipo_pessoa ON leads(tipo_pessoa);
CREATE INDEX IF NOT EXISTS idx_leads_concessionaria ON leads(concessionaria);
CREATE INDEX IF NOT EXISTS idx_leads_titularidade ON leads(titularidade_status);

-- 9. Comentarios nas colunas
COMMENT ON COLUMN leads.tipo_pessoa IS 'FISICA ou JURIDICA';
COMMENT ON COLUMN leads.concessionaria IS 'Energisa MT, Energisa MS, etc';
COMMENT ON COLUMN leads.titularidade_status IS 'Status do processo de troca de titularidade';
COMMENT ON COLUMN leads.proposta_dados IS 'JSON com dados da ultima proposta aceita';
COMMENT ON COLUMN leads.motivo_perda_categoria IS 'PRECO, LOCALIZACAO, UC_INCOMPATIVEL, DESISTENCIA, CONCORRENCIA, OUTROS';

COMMENT ON TABLE leads_ucs IS 'Relacionamento entre leads e UCs (vinculadas via Energisa)';
COMMENT ON TABLE leads_documentos IS 'Documentos enviados pelo lead (RG, comprovante, etc)';
COMMENT ON TABLE leads_propostas IS 'Historico de propostas geradas para o lead';

-- ============================================================================
-- Verificacao
-- ============================================================================
DO $$
DECLARE
    qtd_colunas INTEGER;
BEGIN
    SELECT COUNT(*) INTO qtd_colunas
    FROM information_schema.columns
    WHERE table_name = 'leads'
      AND column_name IN ('tipo_pessoa', 'concessionaria', 'titularidade_status', 'contrato_id');

    RAISE NOTICE 'Migracao 016 concluida! Novas colunas em leads: %', qtd_colunas;
END;
$$;
