---
name: db-migrate
description: |
  Criar e gerenciar migrations do banco de dados Supabase/PostgreSQL. Use quando o usuario pedir para criar migration, alterar tabela, adicionar coluna, criar tabela nova, ou modificar schema do banco.
---

# Migrations Supabase

Criar e gerenciar migrations SQL para o banco PostgreSQL via Supabase.

## Estrutura

Migrations ficam em: `supabase/migrations/`

Padrao de nomenclatura: `NNN_nome_descritivo.sql`
- NNN = numero sequencial (001, 002, etc)
- Proxima migration: verificar ultimo numero e incrementar

## Verificar Ultima Migration

```bash
ls "C:/Users/ewerton.pria/Documents/Aplicações/GestorEnergy/supabase/migrations" | sort -r | head -1
```

## Criar Nova Migration

1. Verificar ultimo numero
2. Criar arquivo com proximo numero
3. Escrever SQL

Exemplo de migration:

```sql
-- 022_adiciona_campo_exemplo.sql

-- Adiciona campo novo na tabela
ALTER TABLE cobrancas
ADD COLUMN IF NOT EXISTS novo_campo VARCHAR(100);

-- Adiciona indice se necessario
CREATE INDEX IF NOT EXISTS idx_cobrancas_novo_campo ON cobrancas(novo_campo);

-- Comentario sobre a coluna
COMMENT ON COLUMN cobrancas.novo_campo IS 'Descricao do campo';
```

## Padroes SQL

### Criar Tabela
```sql
CREATE TABLE IF NOT EXISTS nome_tabela (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- outros campos
);

-- Trigger para updated_at
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON nome_tabela
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
```

### Adicionar Coluna
```sql
ALTER TABLE tabela ADD COLUMN IF NOT EXISTS coluna TIPO;
```

### Criar ENUM
```sql
DO $$ BEGIN
    CREATE TYPE status_tipo AS ENUM ('VALOR1', 'VALOR2');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
```

### RLS (Row Level Security)
```sql
ALTER TABLE tabela ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nome_policy" ON tabela
    FOR ALL
    USING (auth.uid() = user_id);
```

## Tabelas Existentes

Principais tabelas do sistema:
- `usuarios`, `perfis_usuario`
- `unidades_consumidoras`, `usinas`
- `beneficiarios`, `beneficiario_ucs`
- `faturas`, `cobrancas`
- `contratos`, `saques`
- `leads`, `notificacoes`
- `config_plataforma`

## Aplicar Migration

Migrations sao aplicadas automaticamente pelo Supabase ao fazer push.
Para ambiente local, usar Supabase CLI:

```bash
supabase db push
```
