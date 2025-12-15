# Changelog - Plataforma GD Midwest

Registro de alterações, implementações e decisões técnicas do projeto.

---

## [2025-12-14] Reprocessamento de Cobranças

### Funcionalidade
Permite reprocessar cobranças já geradas, excluindo a existente e criando nova.

### Arquivos Modificados
- `backend/cobrancas/router.py` - Novo parâmetro `forcar_reprocessamento`
- `backend/cobrancas/service.py` - Lógica de exclusão e recriação

### Como Usar
```
POST /api/cobrancas/gerar-automatica?fatura_id=213&beneficiario_id=1&forcar_reprocessamento=true
```

### Regras
- Cobranças com status `PAGA` não podem ser reprocessadas
- Cobranças em `RASCUNHO`, `EMITIDA`, `PENDENTE` ou `CANCELADA` podem ser reprocessadas
- A cobrança antiga é excluída antes de criar a nova

### Interface
- Botão "Reprocessar" adicionado na aba "Relatório Gerado" do Processamento de Cobranças
- Cor laranja para diferenciar do botão de aprovar
- Confirmação antes de executar
- Oculto para cobranças já pagas

---

## [2025-12-14] Cálculo Proporcional de Bandeira Tarifária

### Problema
O cálculo de bandeira tarifária estava incorreto porque usava apenas o valor fixo de `bandeira_tarifaria`, ignorando o campo `bandeiraTarifariaDetalhamento` da API Energisa que contém os períodos de cada bandeira.

### Solução Implementada

#### Novos Arquivos
- `supabase/migrations/017_configuracoes_impostos.sql` - Tabela para histórico de impostos
- `backend/configuracoes/` - Módulo completo (schemas, service, router)
- `frontend/src/api/configuracoes.ts` - API client para impostos
- `frontend/src/pages/admin/Impostos.tsx` - Tela de gestão de impostos

#### Arquivos Modificados
- `backend/energisa/constants.py` - Valores das bandeiras (Verde, Amarela, Vermelha P1/P2)
- `backend/cobrancas/calculator.py` - Novo método `_calcular_bandeira_proporcional()`
- `backend/cobrancas/service.py` - Busca impostos do banco e usa dados_api
- `frontend/src/routes/index.tsx` - Rota /admin/impostos
- `frontend/src/components/layout/Sidebar.tsx` - Menu Impostos no admin
- `frontend/src/pages/admin/index.ts` - Export do componente Impostos

#### Fórmula de Cálculo
```
Para cada período de bandeira:
  consumo_periodo = consumo_diario × dias_periodo
  valor_sem_impostos = consumo_periodo × tarifa_bandeira
  valor_com_impostos = valor_sem_impostos / ((1 - PIS_COFINS) × (1 - ICMS))

Total = soma de todos os períodos
```

#### Valores das Bandeiras (R$/kWh sem impostos)
- Verde: R$ 0,00
- Amarela: R$ 0,0188
- Vermelha P1: R$ 0,0446
- Vermelha P2: R$ 0,0787

### Como Testar
1. Executar migration 017 no Supabase
2. Acessar /app/admin/impostos como superadmin
3. Gerar cobrança para fatura com `dados_api.bandeiraTarifariaDetalhamento`

---

## [2025-12-14] Correção Kanban Faturas 500 Error

### Problema
Endpoint `/api/faturas/kanban` retornava erro 500: `column gestores_usina.usuario_id does not exist`

### Solução
Alterado `usuario_id` para `gestor_id` nas queries à tabela `gestores_usina` em `backend/faturas/router.py`

---

## [2025-12-14] Correção Leads API 422 Error

### Problema
API de leads retornava 422 quando `per_page > 100`

### Solução
Aumentado limite máximo de `per_page` no schema de paginação

---

## Próximas Implementações

- [x] Reprocessamento de cobranças já concluídas
- [ ] Verificação automática de mudança de impostos na extração
- [ ] Envio de email com cobrança ao beneficiário
- [ ] Dashboard de métricas para admin

---

## Decisões Técnicas

### Vermelha Padrão = P1
Quando `bandeiraTarifariaDetalhamento` contém apenas "Vermelha" (sem especificar patamar), usa-se Vermelha P1 (R$ 0,0446) como padrão.

### Impostos com Vigência
A tabela `configuracoes_impostos` mantém histórico com `vigencia_inicio` e `vigencia_fim`. Ao criar novo registro, a vigência do anterior é encerrada automaticamente.

### Fallback de Bandeira
Se não houver `bandeiraTarifariaDetalhamento` nos dados_api, o sistema usa o valor de `totais.adicionais_bandeira` extraído do PDF como fallback.
