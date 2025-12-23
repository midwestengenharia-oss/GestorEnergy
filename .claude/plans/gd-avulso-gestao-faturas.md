# Plano: Incluir UCs com GD Avulso na Gestão de Faturas

## Problema

UCs que possuem créditos GD por transferência pontual (não participam de rateio de usina) não aparecem na gestão de faturas porque:
1. `beneficiarios.usina_id` é `NOT NULL`
2. `listar_gestao` filtra apenas beneficiários com `usina_id`
3. Sem beneficiário → sem cobrança

## Cenário Real

```
João (titular) → UC 004 com créditos transferidos
Carlos (gestor de João) → Precisa cobrar Paulo (que usa os créditos)
```

- UC aparece via sync normal (está no CPF do João)
- Mas não aparece na gestão de faturas
- Não é possível gerar cobrança

## Solução Proposta

### 1. Alteração no Schema (Migration)

```sql
-- Permitir beneficiários sem usina (GD avulso)
ALTER TABLE beneficiarios
  ALTER COLUMN usina_id DROP NOT NULL;

-- Adicionar tipo de beneficiário
ALTER TABLE beneficiarios
  ADD COLUMN tipo VARCHAR(20) DEFAULT 'USINA'
  CHECK (tipo IN ('USINA', 'AVULSO'));

-- Índice para consultas
CREATE INDEX idx_beneficiarios_tipo ON beneficiarios(tipo);
```

### 2. Detecção Automática de GD Avulso

**No sync de UCs (`sync/service.py`):**

```python
# Para cada UC do usuário:
# 1. Chama gd_info → verifica se é beneficiária ativa
# 2. Se gd_info retorna NULL/vazio:
#    - Chama gd_details
#    - Se gd_details retorna saldo > 0:
#      - Marca UC como tem_gd_avulso = true
#      - Salva historico_gd
```

**Novo campo na UC:**
```sql
ALTER TABLE unidades_consumidoras
  ADD COLUMN tem_gd_avulso BOOLEAN DEFAULT FALSE;
```

### 3. Cadastro de Beneficiário Avulso

**Endpoint: `POST /beneficiarios/avulso`**

```python
@router.post("/avulso")
async def criar_beneficiario_avulso(
    uc_id: int,
    cliente_nome: str,
    cliente_cpf: str,
    cliente_email: str = None,
    cliente_telefone: str = None
):
    """
    Cria beneficiário para UC com GD avulso.
    - Não requer usina_id
    - tipo = 'AVULSO'
    - Vincula ao gestor que criou
    """
```

### 4. Alteração na Gestão de Faturas

**`listar_gestao` deve incluir:**

```python
# Além dos beneficiários de usinas gerenciadas:
# - Incluir beneficiários AVULSO onde:
#   - UC pertence a usuário gerenciado pelo gestor
#   - OU beneficiário foi criado pelo gestor
```

**Nova lógica:**
```python
# 1. Beneficiários de usinas gerenciadas (atual)
beneficiarios_usina = query.in_("usina_id", usina_ids)

# 2. Beneficiários avulsos de UCs do gestor
beneficiarios_avulsos = query.eq("tipo", "AVULSO").in_("uc_id", ucs_gerenciadas)

# 3. Combinar resultados
beneficiarios = beneficiarios_usina + beneficiarios_avulsos
```

### 5. Fluxo de Uso

```
1. João sincroniza UCs → UC 004 aparece (tem créditos via gd_details)

2. Carlos (gestor) vê UC 004 com flag "GD Avulso"

3. Carlos cadastra beneficiário avulso:
   - UC: 004
   - Cliente: Paulo
   - Tipo: AVULSO

4. Fatura da UC 004 aparece na gestão de faturas

5. Carlos gera cobrança para Paulo

6. Paulo paga → João recebe
```

### 6. Alterações no Frontend

**Gestão de Faturas:**
- Adicionar filtro "Tipo: Usina | Avulso | Todos"
- Badge indicando "GD Avulso" nas faturas
- Botão "Cadastrar Beneficiário" para UCs com GD avulso sem beneficiário

**Cadastro de Beneficiário:**
- Novo formulário para beneficiário avulso
- Não requer seleção de usina
- Campo "Cliente" (quem vai pagar)

## Arquivos a Modificar

### Backend
- [ ] `supabase/migrations/XXX_gd_avulso.sql` - Nova migration
- [ ] `backend/sync/service.py` - Detectar GD avulso no sync
- [ ] `backend/beneficiarios/router.py` - Endpoint criar avulso
- [ ] `backend/beneficiarios/service.py` - Lógica criar avulso
- [ ] `backend/beneficiarios/schemas.py` - Schema com tipo
- [ ] `backend/faturas/service.py` - listar_gestao incluir avulsos
- [ ] `backend/cobrancas/service.py` - Permitir cobrança sem usina

### Frontend
- [ ] `frontend/src/api/beneficiarios.ts` - API criar avulso
- [ ] `frontend/src/pages/gestor/GestaoFaturas.tsx` - Filtro e badge
- [ ] `frontend/src/components/CadastrarBeneficiarioAvulso.tsx` - Modal

## Considerações

1. **Permissões**: Gestor só pode criar avulso para UCs de usuários que ele gerencia
2. **Histórico**: Manter rastreabilidade de quem criou o beneficiário avulso
3. **Economia**: Cálculo de economia pode ser diferente (sem comparativo de usina)
4. **Relatório**: Indicar claramente que é cobrança de "créditos transferidos"

## Alternativa Simplificada

Se quiser uma solução mais rápida sem mudar o schema:

1. Criar uma "Usina Virtual" chamada "Créditos Avulsos"
2. Beneficiários avulsos ficam vinculados a essa usina
3. Gestores que precisam gerenciar avulsos são adicionados a essa usina

**Prós**: Menor impacto no código
**Contras**: Menos semântico, mistura conceitos
