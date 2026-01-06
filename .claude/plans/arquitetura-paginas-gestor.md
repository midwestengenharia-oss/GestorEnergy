# Plano: Nova Arquitetura de Páginas do Gestor

> **STATUS:** Em Planejamento
> **Data:** 2026-01-06
> **Substitui:** `unificacao-clientes-ucs.md`

---

## 1. Contexto e Problema

### 1.1 Situação Atual

O sistema possui 4 páginas na seção "Gestão" do gestor:

| Página | Problema |
|--------|----------|
| **Usinas** | OK - Mostra usinas geradoras |
| **UCs Gerenciadas** | Busca UCs apenas via beneficiários de usinas, ignorando avulsas e monitoradas |
| **Clientes** | OK - Mostra todos os clientes/beneficiários |
| **Beneficiários** | REDUNDANTE - Mesma informação que Clientes |

### 1.2 Modelo de Negócio Complexo

O sistema precisa suportar múltiplos cenários:

```
TIPOS DE UCs:
├── Lead - UC de potencial cliente (só monitoramento)
├── Geradora - UC que produz energia (usina)
├── Beneficiária de Usina - Recebe % do rateio mensal
├── Avulsa - Recebeu créditos por transferência única
└── Monitorada - Só acompanha faturas/consumo

TIPOS DE CLIENTES:
├── Vendedor de energia - Dono de usina que comercializa
├── Comprador de energia - Beneficiário que paga
├── Auto-produtor - Tem usina para consumo próprio
├── Cliente de serviço - Contratou gestão/realocação
└── Lead - Ainda em processo de conversão

* Um cliente pode ter múltiplos papéis simultaneamente
* PJ é representada por PF (contato responsável)
* Toda UC tem um cliente/contato vinculado
```

### 1.3 Objetivo

Reorganizar as páginas para:
1. Eliminar redundância (Beneficiários)
2. Corrigir listagem de UCs (mostrar todas)
3. Criar visões claras para diferentes propósitos
4. Suportar o modelo de negócio complexo

---

## 2. Nova Arquitetura

### 2.1 Estrutura de 3 Páginas

```
/gestor/
│
├── GERAÇÃO DISTRIBUÍDA (GD)
│   │  Foco: Produção e distribuição de energia
│   │
│   ├── [Usinas] [Beneficiárias] [Avulsas]  ← Abas
│   │
│   ├── ABA USINAS:
│   │   ├── Lista de UCs geradoras
│   │   ├── Capacidade, saldo, % rateio alocado
│   │   ├── Geração do mês, beneficiários vinculados
│   │   ├── Tipo: Comercialização / Autoconsumo / Misto
│   │   └── Link para cliente dono
│   │
│   ├── ABA BENEFICIÁRIAS:
│   │   ├── UCs que recebem créditos de usinas
│   │   ├── Filtro por usina
│   │   ├── %, consumo, economia
│   │   └── Tipo: Própria do dono / Terceiro comprador
│   │
│   └── ABA AVULSAS:
│       ├── UCs com GD sem usina vinculada
│       ├── Receberam créditos por transferência
│       └── Saldo, consumo, histórico
│
├── CLIENTES
│   │  Foco: Relacionamento comercial
│   │
│   ├── Lista de todos os clientes/contatos
│   ├── Filtros: Papel, Status, Tipo (PF/PJ)
│   ├── Dados: Nome, contato, UCs, economia, cobranças
│   │
│   └── Detalhe do Cliente:
│       ├── Dados pessoais / empresa
│       ├── Contato responsável (se PJ)
│       ├── UCs vinculadas (todas)
│       ├── Usinas que possui
│       ├── Contratos
│       └── Cobranças e histórico
│
└── UCs GERENCIADAS
    │  Foco: Visão operacional de TODAS as UCs
    │
    ├── TODAS as UCs sob gestão do usuário
    ├── Filtros:
    │   ├── Papel: Geradora / Beneficiária / Avulsa / Consumidora
    │   ├── GD: Com GD / Sem GD
    │   ├── Status: Ativa / Inativa / Cortada
    │   ├── Cliente: Com cliente / Sem cliente
    │   └── Origem: Lead / Cliente
    │
    ├── Ações em massa:
    │   ├── Sincronizar faturas
    │   ├── Sincronizar dados Energisa
    │   └── Exportar relatório
    │
    └── Detalhe da UC:
        ├── Informações técnicas
        ├── Cliente vinculado
        ├── Faturas (histórico)
        ├── GD (saldo, compensação)
        └── Usina vinculada (se beneficiária)
```

### 2.2 Navegação Entre Páginas

```
GD (Usina)
  └── "Ver dono" → Clientes (detalhe)
  └── "Ver beneficiária" → UCs (detalhe)

Clientes (João)
  └── "Ver UCs" → UCs (filtrado por cliente)
  └── "Ver usinas" → GD (filtrado)

UCs (UC 6/123456-7)
  └── "Ver cliente" → Clientes (detalhe)
  └── "Ver usina" → GD (se beneficiária)
  └── "Cadastrar cliente" → Modal/Página (se sem cliente)
```

### 2.3 Perguntas que Cada Página Responde

| Página | Pergunta Principal |
|--------|-------------------|
| **GD** | "Como está minha produção e distribuição de energia?" |
| **Clientes** | "Quem são meus clientes? Quem está devendo?" |
| **UCs** | "Quais UCs eu gerencio? Preciso baixar faturas?" |

---

## 3. Impacto nos Planos Existentes

### 3.1 `gd-avulso-gestao-faturas.md`
**Status:** ✅ IMPLEMENTADO
**Impacto:** Nenhum - A aba "Avulsas" na página GD reutiliza o trabalho já feito.
O campo `tipo='AVULSO'` em beneficiários continua válido.

### 3.2 `integracao-pix-santander.md`
**Status:** Pendente
**Impacto:** Nenhum - Integração PIX é independente da estrutura de páginas.
Cobrança continua funcionando igual.

### 3.3 `PLANO_PROJETO_GD_2025.md`
**Status:** Em andamento
**Impacto:** Alinhado - A nova arquitetura suporta melhor os próximos passos:
- Verificação automática de impostos → OK
- Envio de email → OK
- Dashboard admin → OK (dados disponíveis)

### 3.4 `unificacao-clientes-ucs.md`
**Status:** ⚠️ SUBSTITUÍDO por este plano
**Impacto:** Este plano expande e substitui o anterior com:
- Página GD com abas (Usinas + Beneficiárias + Avulsas)
- Melhor definição dos propósitos de cada página
- Suporte ao modelo de negócio completo

---

## 4. Alterações Necessárias

### 4.1 Backend

#### Novo Endpoint: Listar UCs do Gestor
```python
# backend/ucs/router.py

@router.get("/gestor/todas", response_model=UCListResponse)
async def listar_ucs_gestor(
    current_user: CurrentUser,
    papel: Optional[str] = Query(None, description="geradora|beneficiaria|avulsa|consumidora"),
    tem_gd: Optional[bool] = Query(None),
    tem_cliente: Optional[bool] = Query(None),
    status: Optional[str] = Query(None, description="ativa|inativa|cortada"),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
):
    """
    Lista TODAS as UCs sob gestão do usuário.
    Inclui: geradoras, beneficiárias, avulsas, monitoradas.
    """
```

#### Novo Endpoint: Beneficiárias com Filtros
```python
# backend/beneficiarios/router.py

@router.get("/gestor/beneficiarias", response_model=BeneficiarioListResponse)
async def listar_beneficiarias_gestor(
    current_user: CurrentUser,
    usina_id: Optional[int] = Query(None),
    tipo: Optional[str] = Query(None, description="USINA|AVULSO"),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
):
    """
    Lista beneficiárias do gestor com filtros.
    Inclui: de usinas + avulsas.
    """
```

### 4.2 Frontend

#### 4.2.1 Nova Página: GD (Geração Distribuída)
```
frontend/src/pages/gestor/GeracaoDistribuida.tsx

Componentes:
├── Abas: Usinas | Beneficiárias | Avulsas
├── TabUsinas (atual UsinasGestor)
├── TabBeneficiarias (lista de beneficiárias)
└── TabAvulsas (beneficiários tipo AVULSO)
```

#### 4.2.2 Ajustar: UCsGestor
```
frontend/src/pages/gestor/UCsGestor.tsx

Mudanças:
├── Usar novo endpoint /ucs/gestor/todas
├── Adicionar filtros: papel, GD, cliente, status
├── Remover lógica de buscar via beneficiários
└── Adicionar ações em massa
```

#### 4.2.3 Deprecar: BeneficiariosGestor
```
frontend/src/pages/gestor/BeneficiariosGestor.tsx

Ação: Redirecionar para /gestor/gd?tab=beneficiarias
Manter banner de deprecação por 2 semanas
```

#### 4.2.4 Ajustar: Sidebar
```
frontend/src/components/layout/Sidebar.tsx

Antes:
├── Usinas
├── UCs Gerenciadas
├── Clientes
└── Beneficiários

Depois:
├── Geração (GD)     ← Nova (substitui Usinas + Beneficiários)
├── Clientes
└── UCs Gerenciadas  ← Corrigida
```

### 4.3 Banco de Dados

Nenhuma alteração necessária. Os campos já existem:
- `beneficiarios.tipo` (USINA | AVULSO) ✅
- `beneficiarios.usina_id` (nullable) ✅
- `unidades_consumidoras.is_geradora` ✅
- `unidades_consumidoras.tem_gd_avulso` ✅

---

## 5. Ordem de Implementação

### Fase 1: Backend (1-2 dias)
| # | Tarefa | Arquivo |
|---|--------|---------|
| 1.1 | Endpoint `/ucs/gestor/todas` | `backend/ucs/router.py` |
| 1.2 | Service para listar UCs gestor | `backend/ucs/service.py` |
| 1.3 | Endpoint `/beneficiarios/gestor/beneficiarias` | `backend/beneficiarios/router.py` |
| 1.4 | Service para listar beneficiárias | `backend/beneficiarios/service.py` |

### Fase 2: Frontend - Página GD (2-3 dias)
| # | Tarefa | Arquivo |
|---|--------|---------|
| 2.1 | Criar página GeracaoDistribuida com abas | `pages/gestor/GeracaoDistribuida.tsx` |
| 2.2 | Mover lógica de UsinasGestor para TabUsinas | Componente interno |
| 2.3 | Criar TabBeneficiarias | Componente interno |
| 2.4 | Criar TabAvulsas | Componente interno |
| 2.5 | Atualizar rota /gestor/gd | `routes/index.tsx` |

### Fase 3: Frontend - Corrigir UCsGestor (1-2 dias)
| # | Tarefa | Arquivo |
|---|--------|---------|
| 3.1 | Usar novo endpoint /ucs/gestor/todas | `pages/gestor/UCsGestor.tsx` |
| 3.2 | Adicionar filtros (papel, GD, cliente, status) | - |
| 3.3 | Adicionar ações em massa | - |
| 3.4 | Remover lógica antiga de buscar via beneficiários | - |

### Fase 4: Limpeza (1 dia)
| # | Tarefa | Arquivo |
|---|--------|---------|
| 4.1 | Deprecar BeneficiariosGestor com redirect | `pages/gestor/BeneficiariosGestor.tsx` |
| 4.2 | Atualizar Sidebar | `components/layout/Sidebar.tsx` |
| 4.3 | Remover UsinasGestor (movido para GD) | Opcional |
| 4.4 | Testar navegação entre páginas | - |

---

## 6. APIs do Frontend

### 6.1 Nova API: ucsGestor
```typescript
// frontend/src/api/ucs.ts

interface UCsGestorFilters {
    papel?: 'geradora' | 'beneficiaria' | 'avulsa' | 'consumidora';
    tem_gd?: boolean;
    tem_cliente?: boolean;
    status?: 'ativa' | 'inativa' | 'cortada';
    page?: number;
    per_page?: number;
}

export const ucsApi = {
    // ... existentes ...

    // NOVO: Todas as UCs do gestor
    gestorTodas: (filters?: UCsGestorFilters) =>
        api.get<UCListResponse>('/ucs/gestor/todas', { params: filters }),
};
```

### 6.2 Nova API: beneficiariasGestor
```typescript
// frontend/src/api/beneficiarios.ts

interface BeneficiariasGestorFilters {
    usina_id?: number;
    tipo?: 'USINA' | 'AVULSO';
    page?: number;
    per_page?: number;
}

export const beneficiariosApi = {
    // ... existentes ...

    // NOVO: Beneficiárias do gestor
    gestorBeneficiarias: (filters?: BeneficiariasGestorFilters) =>
        api.get<BeneficiarioListResponse>('/beneficiarios/gestor/beneficiarias', { params: filters }),
};
```

---

## 7. Wireframes

### 7.1 Página GD - Aba Usinas
```
┌─────────────────────────────────────────────────────────────────────┐
│  ⚡ Geração Distribuída                                    [Atualizar] │
├─────────────────────────────────────────────────────────────────────┤
│  [Usinas]  [Beneficiárias]  [Avulsas]                               │
├─────────────────────────────────────────────────────────────────────┤
│  📊 Resumo: 4 usinas | 156 beneficiários | 245.000 kWh/mês          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ 🏭 Usina Solar Fazenda                              [Ativa]  │    │
│  │ UC: 6/4242904-3 | 45 kWp | 12 beneficiários                 │    │
│  │ Saldo: 4.500 kWh | Rateio: 95% alocado                      │    │
│  │ Dono: João Silva                          [Ver] [Benefic.]  │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ 🏭 Usina Comercial Centro                           [Ativa]  │    │
│  │ UC: 6/4160693-2 | 22 kWp | 8 beneficiários                  │    │
│  │ Saldo: 1.200 kWh | Rateio: 100% alocado                     │    │
│  │ Dono: Maria Souza                         [Ver] [Benefic.]  │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.2 Página GD - Aba Beneficiárias
```
┌─────────────────────────────────────────────────────────────────────┐
│  ⚡ Geração Distribuída                                    [Atualizar] │
├─────────────────────────────────────────────────────────────────────┤
│  [Usinas]  [Beneficiárias]  [Avulsas]                               │
├─────────────────────────────────────────────────────────────────────┤
│  Filtros: [Todas as usinas ▼] [Buscar...]                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  │ UC           │ Cliente      │ Usina        │ %    │ Economia │   │
│  ├──────────────┼──────────────┼──────────────┼──────┼──────────┤   │
│  │ 6/4160694-0  │ Carlos Lima  │ Solar Fazenda│ 15%  │ R$ 127   │   │
│  │ 6/4160695-8  │ Ana Costa    │ Solar Fazenda│ 10%  │ R$ 85    │   │
│  │ 6/4160696-6  │ Pedro Santos │ Com. Centro  │ 20%  │ R$ 170   │   │
│  │ ...          │ ...          │ ...          │ ...  │ ...      │   │
│                                                                      │
│  Mostrando 1-20 de 156                            [< 1 2 3 4 5 >]   │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.3 Página UCs Gerenciadas (Corrigida)
```
┌─────────────────────────────────────────────────────────────────────┐
│  ⚡ UCs Gerenciadas                                        [Atualizar] │
├─────────────────────────────────────────────────────────────────────┤
│  Filtros:                                                            │
│  [Papel: Todas ▼] [GD: Todas ▼] [Status: Ativas ▼] [Buscar...]      │
├─────────────────────────────────────────────────────────────────────┤
│  Ações: [☐ Selecionar] [Sincronizar Faturas] [Exportar]             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  │ UC           │ Titular       │ Papel       │ Cliente   │ Status │ │
│  ├──────────────┼───────────────┼─────────────┼───────────┼────────┤ │
│  │ 6/4242904-3  │ Midwest LTDA  │ 🏭 Geradora │ João S.   │ Ativa  │ │
│  │ 6/4160693-2  │ Midwest LTDA  │ 🏭 Geradora │ Maria S.  │ Ativa  │ │
│  │ 6/4160694-0  │ Midwest LTDA  │ 📥 Benef.   │ Carlos L. │ Ativa  │ │
│  │ 6/4160700-1  │ Midwest LTDA  │ 🔄 Avulsa   │ Paulo R.  │ Ativa  │ │
│  │ 6/4160701-9  │ João Lead     │ 📊 Monitor. │ -         │ Ativa  │ │
│  │ ...          │ ...           │ ...         │ ...       │ ...    │ │
│                                                                      │
│  Total: 19 UCs (4 geradoras, 8 benef., 2 avulsas, 5 monitoradas)    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 8. Testes

### 8.1 Testes de Backend
```python
# tests/test_ucs_gestor.py

async def test_listar_ucs_gestor_todas():
    """Deve retornar todas as UCs do gestor."""

async def test_listar_ucs_gestor_filtro_papel():
    """Deve filtrar por papel (geradora, beneficiaria, etc)."""

async def test_listar_ucs_gestor_filtro_gd():
    """Deve filtrar UCs com/sem GD."""
```

### 8.2 Testes de Frontend
```
- [ ] Página GD carrega com 3 abas
- [ ] Aba Usinas mostra usinas corretamente
- [ ] Aba Beneficiárias mostra lista filtrada
- [ ] Aba Avulsas mostra apenas tipo AVULSO
- [ ] UCsGestor mostra TODAS as UCs (19 no caso de teste)
- [ ] Filtros funcionam corretamente
- [ ] Navegação entre páginas funciona
```

---

## 9. Rollback

Em caso de problemas:

1. **Frontend:** Reverter Sidebar para versão anterior
2. **Rotas:** Manter rotas antigas funcionando
3. **BeneficiariosGestor:** Não deletar, apenas deprecar

---

## 10. Métricas de Sucesso

- [ ] UCsGestor mostra todas as 19 UCs (não apenas 8)
- [ ] Navegação GD → Clientes → UCs funciona
- [ ] Tempo de carregamento < 2s
- [ ] Nenhum erro 500 nos novos endpoints

---

*Documento criado em: 2026-01-06*
*Autor: Claude*
