-- Migration 021: Campos para integração PIX Santander
-- Adiciona campos para armazenar dados do PIX gerado via API Santander

-- ========================
-- Novos campos na tabela cobrancas
-- ========================

ALTER TABLE cobrancas
ADD COLUMN IF NOT EXISTS pix_txid VARCHAR(35),
ADD COLUMN IF NOT EXISTS pix_location TEXT,
ADD COLUMN IF NOT EXISTS pix_criado_em TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS pix_status VARCHAR(50),
ADD COLUMN IF NOT EXISTS pix_expiracao_dias INT DEFAULT 30,
ADD COLUMN IF NOT EXISTS pix_multa_percentual DECIMAL(5,2) DEFAULT 1.00,
ADD COLUMN IF NOT EXISTS pix_juros_mensal_percentual DECIMAL(5,2) DEFAULT 1.00,
ADD COLUMN IF NOT EXISTS pix_e2e_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS pix_pago_em TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS pix_valor_pago DECIMAL(10,2);

-- ========================
-- Índices para performance
-- ========================

CREATE INDEX IF NOT EXISTS idx_cobrancas_pix_txid ON cobrancas(pix_txid);
CREATE INDEX IF NOT EXISTS idx_cobrancas_pix_status ON cobrancas(pix_status);
CREATE INDEX IF NOT EXISTS idx_cobrancas_pix_e2e_id ON cobrancas(pix_e2e_id);

-- ========================
-- Comentários
-- ========================

COMMENT ON COLUMN cobrancas.pix_txid IS 'TXID único da cobrança PIX no Santander (formato MW... 26-35 chars)';
COMMENT ON COLUMN cobrancas.pix_location IS 'URL do payload PIX retornado pelo Santander';
COMMENT ON COLUMN cobrancas.pix_criado_em IS 'Data/hora de criação do PIX no Santander';
COMMENT ON COLUMN cobrancas.pix_status IS 'Status no Santander: ATIVA, CONCLUIDA, REMOVIDA_PELO_USUARIO_RECEBEDOR, REMOVIDA_PELO_PSP';
COMMENT ON COLUMN cobrancas.pix_expiracao_dias IS 'Dias de validade após vencimento (default 30)';
COMMENT ON COLUMN cobrancas.pix_multa_percentual IS 'Percentual de multa configurado (ex: 1.00 = 1%)';
COMMENT ON COLUMN cobrancas.pix_juros_mensal_percentual IS 'Percentual de juros ao mês configurado (ex: 1.00 = 1%)';
COMMENT ON COLUMN cobrancas.pix_e2e_id IS 'End-to-end ID retornado quando o PIX é pago (identificador único do pagamento)';
COMMENT ON COLUMN cobrancas.pix_pago_em IS 'Data/hora em que o PIX foi pago (via webhook ou consulta)';
COMMENT ON COLUMN cobrancas.pix_valor_pago IS 'Valor efetivamente pago via PIX';

-- ========================
-- Nota sobre campos existentes
-- ========================

-- Os campos qr_code_pix e qr_code_pix_image já existem na tabela cobrancas
-- (adicionados na migration 012_enhance_cobrancas_gd_fixed.sql)
-- Eles serão usados para armazenar o EMV e QR Code gerados pelo Santander
