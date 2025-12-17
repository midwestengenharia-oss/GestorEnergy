-- Migration 019: Suporte a Múltiplas UCs por Beneficiário e Troca de Titularidade
--
-- Contexto: Quando um lead é convertido em beneficiário, ocorre troca de titularidade
-- na Energisa. A UC original (no nome do cliente) é INATIVADA e uma NOVA UC é criada
-- no nome da geradora. Esta migration adiciona suporte para:
-- 1. Múltiplas UCs por beneficiário (N:N)
-- 2. Rastreamento de UC origem vs UC atual
-- 3. Status de UC na Energisa (ATIVA, INATIVA, MIGRADA)

-- ============================================================================
-- PARTE 1: Alterações na tabela unidades_consumidoras
-- ============================================================================

-- Adicionar campo para status na Energisa
ALTER TABLE unidades_consumidoras
ADD COLUMN IF NOT EXISTS status_energisa VARCHAR(20) DEFAULT 'ATIVA';

-- Adicionar referência para UC que substituiu esta (em caso de migração)
ALTER TABLE unidades_consumidoras
ADD COLUMN IF NOT EXISTS uc_substituta_id INTEGER REFERENCES unidades_consumidoras(id);

-- Motivo da inativação (para auditoria)
ALTER TABLE unidades_consumidoras
ADD COLUMN IF NOT EXISTS motivo_inativacao VARCHAR(100);

-- Comentários
COMMENT ON COLUMN unidades_consumidoras.status_energisa IS 'Status na Energisa: ATIVA, INATIVA, MIGRADA';
COMMENT ON COLUMN unidades_consumidoras.uc_substituta_id IS 'Se MIGRADA, aponta para a nova UC que a substituiu';
COMMENT ON COLUMN unidades_consumidoras.motivo_inativacao IS 'Motivo da inativação: TROCA_TITULARIDADE, CANCELAMENTO, etc';

-- Constraint para valores válidos
ALTER TABLE unidades_consumidoras
DROP CONSTRAINT IF EXISTS check_status_energisa;

ALTER TABLE unidades_consumidoras
ADD CONSTRAINT check_status_energisa
CHECK (status_energisa IN ('ATIVA', 'INATIVA', 'MIGRADA'));

-- ============================================================================
-- PARTE 2: Alterações na tabela beneficiarios
-- ============================================================================

-- Adicionar campo para UC origem (antes da troca de titularidade)
ALTER TABLE beneficiarios
ADD COLUMN IF NOT EXISTS uc_id_origem INTEGER REFERENCES unidades_consumidoras(id);

-- Data da migração de titularidade
ALTER TABLE beneficiarios
ADD COLUMN IF NOT EXISTS data_migracao_titularidade TIMESTAMP;

-- Comentários
COMMENT ON COLUMN beneficiarios.uc_id IS 'UC principal atual (pós-titularidade se houve migração)';
COMMENT ON COLUMN beneficiarios.uc_id_origem IS 'UC original do cliente antes da troca de titularidade';
COMMENT ON COLUMN beneficiarios.data_migracao_titularidade IS 'Data em que ocorreu a troca de titularidade';

-- ============================================================================
-- PARTE 2.5: Alterações na tabela cobrancas
-- ============================================================================

-- Adicionar campo para rastrear qual UC foi usada em cada cobrança
-- Importante: com troca de titularidade, a UC da cobrança pode ser diferente
-- da UC atual do beneficiário
ALTER TABLE cobrancas
ADD COLUMN IF NOT EXISTS uc_id INTEGER REFERENCES unidades_consumidoras(id);

COMMENT ON COLUMN cobrancas.uc_id IS 'UC usada para esta cobrança (pode diferir da UC atual do beneficiário devido a troca de titularidade)';

-- Índice para buscar cobranças por UC
CREATE INDEX IF NOT EXISTS idx_cobrancas_uc_id ON cobrancas(uc_id);

-- ============================================================================
-- PARTE 3: Nova tabela beneficiario_ucs (relação N:N)
-- ============================================================================

CREATE TABLE IF NOT EXISTS beneficiario_ucs (
    id SERIAL PRIMARY KEY,
    beneficiario_id INTEGER NOT NULL REFERENCES beneficiarios(id) ON DELETE CASCADE,
    uc_id INTEGER NOT NULL REFERENCES unidades_consumidoras(id),

    -- Tipo de UC nesta relação
    tipo VARCHAR(20) NOT NULL DEFAULT 'ATIVA',
    -- ORIGEM: UC original do cliente (antes da troca de titularidade)
    -- ATIVA: UC atual em uso para cobranças
    -- INATIVA: UC que foi desativada/removida

    -- Período de vigência
    data_inicio TIMESTAMP DEFAULT NOW(),
    data_fim TIMESTAMP, -- NULL = ainda vigente

    -- Rastreamento
    motivo_transicao VARCHAR(100),
    -- CONVERSAO_LEAD: UC adicionada na conversão do lead
    -- TROCA_TITULARIDADE: Migração devido a troca de titularidade
    -- ADICAO_MANUAL: UC adicional vinculada manualmente
    -- REMOCAO: UC removida do beneficiário

    criado_por UUID REFERENCES auth.users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- Constraints
    CONSTRAINT check_tipo_beneficiario_uc CHECK (tipo IN ('ORIGEM', 'ATIVA', 'INATIVA'))
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_beneficiario_ucs_benef ON beneficiario_ucs(beneficiario_id);
CREATE INDEX IF NOT EXISTS idx_beneficiario_ucs_uc ON beneficiario_ucs(uc_id);
CREATE INDEX IF NOT EXISTS idx_beneficiario_ucs_tipo ON beneficiario_ucs(tipo);

-- Índice parcial para UCs ativas (mais consultado)
CREATE INDEX IF NOT EXISTS idx_beneficiario_ucs_ativas
ON beneficiario_ucs(beneficiario_id)
WHERE tipo = 'ATIVA' AND data_fim IS NULL;

-- Unique constraint: um beneficiário não pode ter a mesma UC duplicada com mesmo tipo ativo
CREATE UNIQUE INDEX IF NOT EXISTS idx_beneficiario_ucs_unique_ativa
ON beneficiario_ucs(beneficiario_id, uc_id, tipo)
WHERE data_fim IS NULL;

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_beneficiario_ucs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_beneficiario_ucs_updated_at ON beneficiario_ucs;
CREATE TRIGGER trigger_beneficiario_ucs_updated_at
    BEFORE UPDATE ON beneficiario_ucs
    FOR EACH ROW
    EXECUTE FUNCTION update_beneficiario_ucs_updated_at();

-- Comentários na tabela
COMMENT ON TABLE beneficiario_ucs IS 'Relacionamento N:N entre beneficiários e UCs, com histórico de migrações';
COMMENT ON COLUMN beneficiario_ucs.tipo IS 'ORIGEM=UC do cliente antes da troca, ATIVA=UC em uso, INATIVA=removida';
COMMENT ON COLUMN beneficiario_ucs.data_fim IS 'NULL indica relação ainda vigente';
COMMENT ON COLUMN beneficiario_ucs.motivo_transicao IS 'Motivo da criação/mudança: CONVERSAO_LEAD, TROCA_TITULARIDADE, ADICAO_MANUAL, REMOCAO';

-- ============================================================================
-- PARTE 4: Migrar dados existentes para nova tabela
-- ============================================================================

-- Para beneficiários existentes que têm uc_id, criar registro em beneficiario_ucs
INSERT INTO beneficiario_ucs (beneficiario_id, uc_id, tipo, data_inicio, motivo_transicao)
SELECT
    b.id as beneficiario_id,
    b.uc_id as uc_id,
    'ATIVA' as tipo,
    COALESCE(b.criado_em, NOW()) as data_inicio,
    'MIGRACAO_LEGADO' as motivo_transicao
FROM beneficiarios b
WHERE b.uc_id IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM beneficiario_ucs bu
    WHERE bu.beneficiario_id = b.id AND bu.uc_id = b.uc_id
);

-- ============================================================================
-- PARTE 5: RLS Policies para beneficiario_ucs
-- ============================================================================

ALTER TABLE beneficiario_ucs ENABLE ROW LEVEL SECURITY;

-- Política de leitura: gestores, proprietários, admins ou próprio beneficiário
CREATE POLICY "beneficiario_ucs_select_policy" ON beneficiario_ucs
    FOR SELECT
    USING (
        is_superadmin()
        OR has_perfil('gestor')
        OR has_perfil('proprietario')
        OR EXISTS (
            SELECT 1 FROM beneficiarios b
            WHERE b.id = beneficiario_ucs.beneficiario_id
            AND b.usuario_id = auth.uid()
        )
    );

-- Política de inserção: gestores, proprietários e admins
CREATE POLICY "beneficiario_ucs_insert_policy" ON beneficiario_ucs
    FOR INSERT
    WITH CHECK (
        is_superadmin()
        OR has_perfil('gestor')
        OR has_perfil('proprietario')
    );

-- Política de atualização: gestores, proprietários e admins
CREATE POLICY "beneficiario_ucs_update_policy" ON beneficiario_ucs
    FOR UPDATE
    USING (
        is_superadmin()
        OR has_perfil('gestor')
        OR has_perfil('proprietario')
    );

-- Política de deleção: apenas admins
CREATE POLICY "beneficiario_ucs_delete_policy" ON beneficiario_ucs
    FOR DELETE
    USING (is_superadmin());

-- ============================================================================
-- PARTE 6: View útil para consultas
-- ============================================================================

CREATE OR REPLACE VIEW v_beneficiarios_com_ucs AS
SELECT
    b.id as beneficiario_id,
    b.nome as beneficiario_nome,
    b.cpf as beneficiario_cpf,
    b.email as beneficiario_email,
    b.status as beneficiario_status,
    b.usina_id,
    us.nome as usina_nome,

    -- UC principal (campo legado)
    b.uc_id as uc_id_principal,

    -- UC origem (se houve troca)
    b.uc_id_origem,
    b.data_migracao_titularidade,

    -- Contagem de UCs
    (SELECT COUNT(*) FROM beneficiario_ucs bu WHERE bu.beneficiario_id = b.id AND bu.tipo = 'ATIVA' AND bu.data_fim IS NULL) as total_ucs_ativas,

    -- Array de UCs ativas
    (
        SELECT json_agg(json_build_object(
            'id', uc.id,
            'numero', CONCAT(uc.cod_empresa, '/', uc.cdc, '-', uc.digito_verificador),
            'nome_titular', uc.nome_titular,
            'tipo', bu.tipo,
            'data_inicio', bu.data_inicio
        ))
        FROM beneficiario_ucs bu
        JOIN unidades_consumidoras uc ON uc.id = bu.uc_id
        WHERE bu.beneficiario_id = b.id
        AND bu.tipo = 'ATIVA'
        AND bu.data_fim IS NULL
    ) as ucs_ativas

FROM beneficiarios b
LEFT JOIN usinas us ON us.id = b.usina_id;

COMMENT ON VIEW v_beneficiarios_com_ucs IS 'View consolidada de beneficiários com suas UCs ativas e histórico de migração';

-- ============================================================================
-- PARTE 7: Função helper para adicionar UC a beneficiário
-- ============================================================================

CREATE OR REPLACE FUNCTION adicionar_uc_beneficiario(
    p_beneficiario_id INTEGER,
    p_uc_id INTEGER,
    p_tipo VARCHAR(20) DEFAULT 'ATIVA',
    p_motivo VARCHAR(100) DEFAULT 'ADICAO_MANUAL',
    p_user_id UUID DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    v_id INTEGER;
BEGIN
    -- Verificar se já existe relação ativa
    IF EXISTS (
        SELECT 1 FROM beneficiario_ucs
        WHERE beneficiario_id = p_beneficiario_id
        AND uc_id = p_uc_id
        AND tipo = p_tipo
        AND data_fim IS NULL
    ) THEN
        RAISE EXCEPTION 'UC já está vinculada ao beneficiário com este tipo';
    END IF;

    -- Inserir nova relação
    INSERT INTO beneficiario_ucs (
        beneficiario_id, uc_id, tipo, motivo_transicao, criado_por
    ) VALUES (
        p_beneficiario_id, p_uc_id, p_tipo, p_motivo, p_user_id
    ) RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PARTE 8: Função helper para processar troca de titularidade
-- ============================================================================

CREATE OR REPLACE FUNCTION processar_troca_titularidade(
    p_beneficiario_id INTEGER,
    p_uc_origem_id INTEGER,
    p_uc_nova_id INTEGER,
    p_user_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    -- 1. Marcar UC origem como MIGRADA
    UPDATE unidades_consumidoras
    SET
        status_energisa = 'MIGRADA',
        uc_substituta_id = p_uc_nova_id,
        motivo_inativacao = 'TROCA_TITULARIDADE'
    WHERE id = p_uc_origem_id;

    -- 2. Encerrar relação antiga em beneficiario_ucs (se existir)
    UPDATE beneficiario_ucs
    SET
        data_fim = NOW(),
        tipo = 'ORIGEM'
    WHERE beneficiario_id = p_beneficiario_id
    AND uc_id = p_uc_origem_id
    AND data_fim IS NULL;

    -- 3. Se não existia relação, criar como ORIGEM
    IF NOT FOUND THEN
        INSERT INTO beneficiario_ucs (
            beneficiario_id, uc_id, tipo, data_fim, motivo_transicao, criado_por
        ) VALUES (
            p_beneficiario_id, p_uc_origem_id, 'ORIGEM', NOW(), 'TROCA_TITULARIDADE', p_user_id
        );
    END IF;

    -- 4. Criar nova relação com UC nova
    INSERT INTO beneficiario_ucs (
        beneficiario_id, uc_id, tipo, motivo_transicao, criado_por
    ) VALUES (
        p_beneficiario_id, p_uc_nova_id, 'ATIVA', 'TROCA_TITULARIDADE', p_user_id
    );

    -- 5. Atualizar beneficiário
    UPDATE beneficiarios
    SET
        uc_id = p_uc_nova_id,
        uc_id_origem = COALESCE(uc_id_origem, p_uc_origem_id),
        data_migracao_titularidade = NOW()
    WHERE id = p_beneficiario_id;

END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION processar_troca_titularidade IS 'Processa troca de titularidade: marca UC antiga como migrada, cria nova relação';

-- ============================================================================
-- FIM DA MIGRATION
-- ============================================================================
