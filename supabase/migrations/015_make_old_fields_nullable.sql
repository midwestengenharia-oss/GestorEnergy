-- ===================================================================
-- Migração 015: Tornar campos antigos de cobranças opcionais
-- ===================================================================
-- Os campos antigos não são mais usados pela nova lógica de cálculo,
-- então precisam ser nullable para compatibilidade

-- Remover NOT NULL dos campos antigos
ALTER TABLE cobrancas
ALTER COLUMN kwh_creditado DROP NOT NULL,
ALTER COLUMN tarifa_energisa DROP NOT NULL,
ALTER COLUMN desconto_aplicado DROP NOT NULL,
ALTER COLUMN valor_energia DROP NOT NULL,
ALTER COLUMN valor_total DROP NOT NULL;

-- Comentar que esses campos são legados
COMMENT ON COLUMN cobrancas.kwh_creditado IS 'LEGADO: kWh creditado (substituído por injetada_kwh e compensado_kwh)';
COMMENT ON COLUMN cobrancas.tarifa_energisa IS 'LEGADO: Tarifa Energisa (substituído por tarifa_base e tarifa_assinatura)';
COMMENT ON COLUMN cobrancas.desconto_aplicado IS 'LEGADO: Desconto aplicado (substituído por economia_mes)';
COMMENT ON COLUMN cobrancas.valor_energia IS 'LEGADO: Valor da energia (substituído por valor_energia_base e valor_energia_assinatura)';
