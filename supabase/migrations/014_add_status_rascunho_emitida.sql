-- ===================================================================
-- Migração 014: Adicionar status RASCUNHO e EMITIDA ao enum cobranca_status
-- ===================================================================

-- Adicionar novos valores ao enum cobranca_status de forma segura
DO $$
BEGIN
    -- Adicionar RASCUNHO se não existir
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'RASCUNHO' AND enumtypid = 'cobranca_status'::regtype) THEN
        ALTER TYPE cobranca_status ADD VALUE 'RASCUNHO';
    END IF;

    -- Adicionar EMITIDA se não existir
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'EMITIDA' AND enumtypid = 'cobranca_status'::regtype) THEN
        ALTER TYPE cobranca_status ADD VALUE 'EMITIDA';
    END IF;

    -- Adicionar PARCIAL se não existir
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'PARCIAL' AND enumtypid = 'cobranca_status'::regtype) THEN
        ALTER TYPE cobranca_status ADD VALUE 'PARCIAL';
    END IF;
END
$$;

-- Comentário sobre os status
COMMENT ON TYPE cobranca_status IS 'Status das cobranças: RASCUNHO (gerada mas não aprovada), EMITIDA (aprovada e enviada), PENDENTE (aguardando pagamento), PARCIAL (pagamento parcial), PAGA (paga totalmente), VENCIDA (passou do vencimento), CANCELADA (cancelada)';
