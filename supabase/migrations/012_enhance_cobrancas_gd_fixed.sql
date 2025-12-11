-- ===================================================================
-- Migração 012 (CORRIGIDA): Melhorias na Tabela de Cobranças para Suportar GD I/II
-- ===================================================================
-- Adiciona campos detalhados para armazenar cálculos completos de cobranças
-- baseados em dados extraídos de faturas

-- Adicionar campos de modelo GD e detalhamento
ALTER TABLE cobrancas
ADD COLUMN IF NOT EXISTS fatura_dados_extraidos_id INTEGER REFERENCES faturas(id),
ADD COLUMN IF NOT EXISTS tipo_modelo_gd VARCHAR(20),
ADD COLUMN IF NOT EXISTS tipo_ligacao VARCHAR(20),
ADD COLUMN IF NOT EXISTS consumo_kwh INTEGER,
ADD COLUMN IF NOT EXISTS injetada_kwh INTEGER,
ADD COLUMN IF NOT EXISTS compensado_kwh INTEGER,
ADD COLUMN IF NOT EXISTS gap_kwh INTEGER;

-- Tarifas
ALTER TABLE cobrancas
ADD COLUMN IF NOT EXISTS tarifa_base DECIMAL(10, 6),
ADD COLUMN IF NOT EXISTS tarifa_assinatura DECIMAL(10, 6),
ADD COLUMN IF NOT EXISTS fio_b_valor DECIMAL(10, 2);

-- Valores de energia
ALTER TABLE cobrancas
ADD COLUMN IF NOT EXISTS valor_energia_base DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS valor_energia_assinatura DECIMAL(10, 2);

-- GD I - Taxa mínima ou energia excedente
ALTER TABLE cobrancas
ADD COLUMN IF NOT EXISTS taxa_minima_kwh INTEGER,
ADD COLUMN IF NOT EXISTS taxa_minima_valor DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS energia_excedente_kwh INTEGER,
ADD COLUMN IF NOT EXISTS energia_excedente_valor DECIMAL(10, 2);

-- GD II - Disponibilidade
ALTER TABLE cobrancas
ADD COLUMN IF NOT EXISTS disponibilidade_valor DECIMAL(10, 2);

-- Extras detalhados
ALTER TABLE cobrancas
ADD COLUMN IF NOT EXISTS bandeiras_valor DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS iluminacao_publica_valor DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS servicos_valor DECIMAL(10, 2);

-- Valores totais e economia
ALTER TABLE cobrancas
ADD COLUMN IF NOT EXISTS valor_sem_assinatura DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS valor_com_assinatura DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS economia_mes DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS economia_acumulada DECIMAL(10, 2);

-- PIX detalhado
ALTER TABLE cobrancas
ADD COLUMN IF NOT EXISTS qr_code_pix TEXT,
ADD COLUMN IF NOT EXISTS qr_code_pix_image TEXT;

-- Relatório HTML gerado
ALTER TABLE cobrancas
ADD COLUMN IF NOT EXISTS html_relatorio TEXT;

-- Controle de edição
ALTER TABLE cobrancas
ADD COLUMN IF NOT EXISTS vencimento_editavel BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS observacoes_internas TEXT,
ADD COLUMN IF NOT EXISTS data_calculo TIMESTAMPTZ;

-- Comentários das novas colunas
COMMENT ON COLUMN cobrancas.fatura_dados_extraidos_id IS 'Referência à fatura de onde vieram os dados extraídos';
COMMENT ON COLUMN cobrancas.tipo_modelo_gd IS 'Modelo de geração distribuída: GDI ou GDII';
COMMENT ON COLUMN cobrancas.tipo_ligacao IS 'Tipo de ligação da UC: MONOFASICO, BIFASICO ou TRIFASICO';
COMMENT ON COLUMN cobrancas.consumo_kwh IS 'kWh consumido no período';
COMMENT ON COLUMN cobrancas.injetada_kwh IS 'kWh injetado na rede no período';
COMMENT ON COLUMN cobrancas.compensado_kwh IS 'kWh efetivamente compensado';
COMMENT ON COLUMN cobrancas.gap_kwh IS 'Déficit de energia (consumo - compensado)';
COMMENT ON COLUMN cobrancas.tarifa_base IS 'Tarifa base da ANEEL (R$/kWh)';
COMMENT ON COLUMN cobrancas.tarifa_assinatura IS 'Tarifa com desconto de assinatura (R$/kWh)';
COMMENT ON COLUMN cobrancas.fio_b_valor IS 'Valor do Fio B';
COMMENT ON COLUMN cobrancas.valor_energia_base IS 'Valor da energia sem desconto (injetada × tarifa_base)';
COMMENT ON COLUMN cobrancas.valor_energia_assinatura IS 'Valor da energia com desconto (injetada × tarifa_assinatura)';
COMMENT ON COLUMN cobrancas.taxa_minima_kwh IS 'kWh da taxa mínima (GD I)';
COMMENT ON COLUMN cobrancas.taxa_minima_valor IS 'Valor da taxa mínima (GD I)';
COMMENT ON COLUMN cobrancas.energia_excedente_kwh IS 'kWh excedente cobrado (GD I)';
COMMENT ON COLUMN cobrancas.energia_excedente_valor IS 'Valor da energia excedente (GD I)';
COMMENT ON COLUMN cobrancas.disponibilidade_valor IS 'Valor da disponibilidade Lei 14.300 (GD II)';
COMMENT ON COLUMN cobrancas.bandeiras_valor IS 'Valor de adicionais de bandeira tarifária';
COMMENT ON COLUMN cobrancas.iluminacao_publica_valor IS 'Valor da contribuição de iluminação pública';
COMMENT ON COLUMN cobrancas.servicos_valor IS 'Valor de outros serviços e lançamentos';
COMMENT ON COLUMN cobrancas.valor_sem_assinatura IS 'Quanto seria pago sem o desconto de assinatura';
COMMENT ON COLUMN cobrancas.valor_com_assinatura IS 'Valor com desconto de assinatura aplicado';
COMMENT ON COLUMN cobrancas.economia_mes IS 'Economia no mês (valor_sem - valor_com)';
COMMENT ON COLUMN cobrancas.economia_acumulada IS 'Economia total acumulada até o momento';
COMMENT ON COLUMN cobrancas.qr_code_pix IS 'Código PIX copia-e-cola';
COMMENT ON COLUMN cobrancas.qr_code_pix_image IS 'Imagem do QR Code PIX em base64';
COMMENT ON COLUMN cobrancas.html_relatorio IS 'HTML do relatório de cobrança gerado';
COMMENT ON COLUMN cobrancas.vencimento_editavel IS 'Indica se o vencimento pode ser editado';
COMMENT ON COLUMN cobrancas.observacoes_internas IS 'Observações internas para controle';
COMMENT ON COLUMN cobrancas.data_calculo IS 'Data/hora em que a cobrança foi calculada';

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_cobrancas_modelo_gd ON cobrancas(tipo_modelo_gd);
CREATE INDEX IF NOT EXISTS idx_cobrancas_fatura_dados ON cobrancas(fatura_dados_extraidos_id);
CREATE INDEX IF NOT EXISTS idx_cobrancas_status_data ON cobrancas(status, data_calculo);

-- View auxiliar para cobranças com economia
CREATE OR REPLACE VIEW cobrancas_com_economia AS
SELECT
    c.*,
    b.nome AS beneficiario_nome,
    b.cpf AS beneficiario_cpf,
    b.email AS beneficiario_email,
    u.id AS usina_id,
    u.nome AS usina_nome,
    uc.cod_empresa,
    uc.cdc,
    uc.digito_verificador,
    CONCAT(uc.cod_empresa, '/', uc.cdc, '-', uc.digito_verificador) AS uc_formatada,
    f.numero_fatura,
    f.mes_referencia,
    f.ano_referencia
FROM cobrancas c
LEFT JOIN beneficiarios b ON c.beneficiario_id = b.id
LEFT JOIN usinas u ON b.usina_id = u.id
LEFT JOIN unidades_consumidoras uc ON b.uc_id = uc.id
LEFT JOIN faturas f ON c.fatura_dados_extraidos_id = f.id
WHERE c.economia_mes IS NOT NULL;

COMMENT ON VIEW cobrancas_com_economia IS 'Cobranças detalhadas com informações de economia e relacionamentos';

-- Validação: tipo_modelo_gd só pode ter valores específicos
ALTER TABLE cobrancas
DROP CONSTRAINT IF EXISTS check_tipo_modelo_gd;

ALTER TABLE cobrancas
ADD CONSTRAINT check_tipo_modelo_gd
CHECK (tipo_modelo_gd IN ('GDI', 'GDII', 'DESCONHECIDO', NULL));

-- Validação: tipo_ligacao só pode ter valores específicos
ALTER TABLE cobrancas
DROP CONSTRAINT IF EXISTS check_tipo_ligacao;

ALTER TABLE cobrancas
ADD CONSTRAINT check_tipo_ligacao
CHECK (tipo_ligacao IN ('MONOFASICO', 'BIFASICO', 'TRIFASICO', NULL));
