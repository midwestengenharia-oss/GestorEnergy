# Plano: Unificação Clientes/Beneficiários e Melhorias UCs

> **STATUS: SUBSTITUÍDO** ⚠️
> Este plano foi substituído por `arquitetura-paginas-gestor.md`
> Data: 2026-01-06

---

## Contexto

Atualmente existem 3 páginas com sobreposição:
- **Leads** → Funil de vendas (OK, mantém separado)
- **Clientes** → Visão CRM/portfólio
- **Beneficiários** → Gestão técnica GD

Além disso:
- UCs Gerenciadas redireciona para `/usuario/ucs/:id` (perfil errado)
- Histórico de faturas limitado
- FaturasGestor mostra UC como `#ID` em vez de `6/00000-0`

---

## Estrutura Proposta

```
/app/gestor/
├── leads/                 # Funil de vendas (mantém)
├── kanban-leads/          # Kanban do funil (mantém)
│
├── clientes/              # Lista de clientes (GestaoClientes melhorada)
│   └── :id/              # NOVO: Detalhe completo do cliente
│       ├── Dados         # Info pessoal, documentos
│       ├── UC            # UC vinculada, endereço
│       ├── Contrato      # Contrato, assinatura
│       └── Financeiro    # Cobranças, economia
│
├── ucs/                   # NOVO: Lista de UCs gerenciadas
│   └── :id/              # NOVO: Detalhe da UC (não redireciona para /usuario)
│       ├── Info          # Dados da UC, titular, endereço
│       ├── Faturas       # Histórico completo com mais dados
│       └── GD            # Créditos, saldo, compensação
│
├── faturas/               # Lista de faturas (corrigir UC formatada)
├── gestao-faturas/        # Kanban de processamento (mantém)
├── cobrancas/             # Cobranças (mantém)
├── rateio/                # Rateio (mantém)
└── ...
```

---

## Tarefas Detalhadas

### 1. Página ClienteDetalhe (`/gestor/clientes/:id`)

**Objetivo:** Visão 360° do cliente/beneficiário

**Abas:**

#### Aba "Dados"
- Nome, CPF, Email, Telefone
- Status do beneficiário (badge colorido)
- Origem (Lead convertido ou Legado)
- Data de conversão/ativação
- **Documentos** (lista de leads_documentos):
  - Tipo, nome do arquivo, data de upload
  - Botão de visualizar/baixar
  - Status de extração OCR

#### Aba "Unidade Consumidora"
- Código UC formatado (6/00000-0)
- Endereço completo (logradouro, número, cidade, UF)
- Titular da UC
- Status (ATIVA/INATIVA)
- Tipo de ligação
- Classe de consumo
- Link para detalhe da UC (`/gestor/ucs/:id`)

#### Aba "Contrato"
- Status do contrato (badge)
- Data de início/vigência
- Percentual de rateio
- Desconto aplicado
- Usina vinculada
- Visualizar/baixar contrato PDF
- Histórico de alterações

#### Aba "Financeiro"
- **Cards de resumo:**
  - Economia acumulada (total)
  - Economia último mês
  - Total de cobranças
  - Cobranças pendentes
- **Lista de cobranças:**
  - Referência (mês/ano)
  - Valor
  - Status (badge)
  - PIX (se disponível)
  - Link para fatura

**Dados necessários (backend):**
```typescript
GET /beneficiarios/:id/completo
{
  beneficiario: { id, cpf, nome, email, telefone, status, economia_acumulada, ... },
  uc: { id, cdc, endereco, numero, cidade, uf, titular_nome, status, ... },
  usina: { id, nome },
  contrato: { id, status, data_inicio, vigencia, ... },
  documentos: [{ id, tipo, nome_arquivo, url_arquivo, criado_em }],
  cobrancas: [{ id, mes_ref, ano_ref, valor, status, economia_mes }],
  metricas: { economia_acumulada, economia_ultimo_mes, total_cobrancas, pendentes }
}
```

---

### 2. Página UCsGestor (`/gestor/ucs`)

**Objetivo:** Lista de UCs das usinas gerenciadas (substitui redirecionamento para /usuario/ucs)

**Features:**
- Filtro por usina
- Filtro por status (Todas/Ativas/Inativas/Geradoras)
- Busca por código UC, endereço, titular
- Tabela com:
  - UC (código formatado)
  - Endereço
  - Titular
  - Usina vinculada
  - Beneficiário (se houver)
  - Status
  - Ações (Ver detalhes)

---

### 3. Página UCDetalheGestor (`/gestor/ucs/:id`)

**Objetivo:** Detalhe da UC com histórico completo (substitui /usuario/ucs/:id)

**Seções:**

#### Informações Gerais
- Código UC formatado
- Endereço completo
- Titular (nome, CPF se disponível)
- Classe de consumo
- Tipo de ligação
- Status (ATIVA/INATIVA)
- É geradora? (badge)

#### Beneficiário Vinculado
- Nome, status
- Usina
- Link para ClienteDetalhe

#### Histórico de Faturas (melhorado)
- **Cards de resumo:**
  - Consumo médio (últimos 12 meses)
  - Valor médio
  - Economia total GD
- **Tabela com mais dados:**
  - Referência
  - Vencimento
  - Consumo (kWh)
  - Leitura anterior/atual
  - Energia injetada (oUC + mUC)
  - Bandeira
  - Valor
  - Status pagamento
  - Ações (PDF, detalhes)

#### Geração Distribuída
- Tipo GD (GDI/GDII)
- Saldo acumulado
- A expirar próximo ciclo
- Gráfico de compensação (últimos 12 meses)

---

### 4. Correções FaturasGestor

**Problemas:**
1. UC aparece como `#232` quando `uc_formatada` está vazio
2. Modal de detalhes tem poucos dados

**Correções:**

#### UC Formatada
```typescript
// Garantir que sempre mostra formatado
const getUCFormatada = (fatura: FaturaGestao) => {
  if (fatura.uc_formatada && !fatura.uc_formatada.startsWith('#')) {
    return fatura.uc_formatada;
  }
  // Fallback: buscar da UC se disponível
  return `UC #${fatura.uc_id}`;
};
```

#### Modal com Mais Dados
Adicionar ao modal:
- Leitura anterior/atual
- Quantidade de dias
- Consumo bruto vs faturado
- Energia injetada (oUC + mUC)
- Bandeira tarifária (nome + valor)
- Iluminação pública
- Dados extraídos vs API (comparação)

---

### 5. Ajustar GestaoClientes

**Mudanças:**
- Ao clicar em um cliente, navega para `/gestor/clientes/:id` (nova página)
- Manter cards expansíveis como preview rápido
- Adicionar botão "Ver perfil completo"

---

### 6. Deprecar BeneficiariosGestor

**Opções:**
1. **Redirecionar** `/gestor/beneficiarios` → `/gestor/clientes`
2. **Manter temporariamente** com banner "Esta página será descontinuada"
3. **Remover** após migração completa

**Recomendação:** Opção 2 (transição gradual)

---

## Ordem de Implementação

| # | Tarefa | Dependência | Estimativa |
|---|--------|-------------|------------|
| 1 | Backend: endpoint `/beneficiarios/:id/completo` | - | Backend |
| 2 | Página UCsGestor (lista) | - | Simples |
| 3 | Página UCDetalheGestor | UCsGestor | Média |
| 4 | Página ClienteDetalhe (abas) | Endpoint backend | Complexa |
| 5 | Correções FaturasGestor | - | Simples |
| 6 | Ajustar GestaoClientes (links) | ClienteDetalhe | Simples |
| 7 | Deprecar BeneficiariosGestor | Tudo acima | Simples |

---

## Perguntas para Validação

1. **Documentos:** O upload de novos documentos deve ser possível na página de detalhe do cliente?

2. **Contrato:** Há funcionalidade de assinatura digital já implementada? Ou é apenas visualização?

3. **Múltiplas UCs:** Um beneficiário pode ter mais de uma UC? Como deve ser exibido?

4. **Economia:** Além do valor total, quer ver economia por mês em gráfico?

5. **BeneficiariosGestor:** Prefere manter por um tempo ou remover imediatamente?

---

## Arquivos a Criar/Modificar

### Novos Arquivos
- `frontend/src/pages/gestor/ClienteDetalhe.tsx`
- `frontend/src/pages/gestor/UCsGestor.tsx`
- `frontend/src/pages/gestor/UCDetalheGestor.tsx`
- `frontend/src/api/clientes.ts` (se necessário novo endpoint)

### Modificar
- `frontend/src/pages/gestor/FaturasGestor.tsx`
- `frontend/src/pages/gestor/GestaoClientes.tsx`
- `frontend/src/pages/gestor/index.ts`
- `frontend/src/routes/index.tsx`
- `backend/beneficiarios/router.py` (novo endpoint completo)
- `backend/beneficiarios/service.py`
