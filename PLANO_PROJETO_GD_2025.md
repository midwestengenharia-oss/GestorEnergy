# Plataforma GD Midwest - Plano de Projeto

**Ultima atualizacao:** 2025-12-16
**Documento para continuidade de trabalho com Claude**

---

## 1. ESTADO ATUAL

### Funcionalidades Concluidas

| Modulo | Funcionalidade | Status |
|--------|----------------|--------|
| **Auth** | Login/SignUp via Supabase, JWT, refresh tokens | Concluido |
| **Gateway Energisa** | Scraping, login automatico, sync de UCs/faturas | Concluido |
| **Usuarios** | CRUD, 6 perfis (superadmin, proprietario, gestor, beneficiario, usuario, parceiro) | Concluido |
| **UCs** | Vinculacao com Energisa, dados de GD | Concluido |
| **Usinas** | Gestao de usinas, rateio de creditos | Concluido |
| **Beneficiarios** | Cadastro, convites, vinculos com UCs | Concluido |
| **Faturas** | Extracao via LLM/OCR, sincronizacao automatica (10 min) | Concluido |
| **Cobrancas** | Geracao automatica, calculo proporcional de bandeira | Concluido |
| **Contratos** | Gestao de contratos digitais, assinatura | Concluido |
| **Saques** | Solicitacao e aprovacao | Concluido |
| **Leads/CRM** | Captacao, simulacao, conversao | Concluido |
| **Admin** | Dashboard, gestao de usuarios/leads, logs | Concluido |
| **Notificacoes** | Sistema multi-canal | Concluido |
| **Configuracoes** | Gestao de impostos (PIS/COFINS/ICMS) | Concluido |

### Ultimas Implementacoes (Dezembro 2025)

- [x] Calculo proporcional de bandeira tarifaria
- [x] Botao de reprocessamento de cobrancas
- [x] Tela de gestao de impostos no admin (`/app/admin/impostos`)
- [x] Migration 017 - tabela `configuracoes_impostos`
- [x] Correcao: Kanban Faturas erro 500 (`usuario_id` -> `gestor_id`)
- [x] Correcao: Leads API erro 422 (`per_page > 100`)
- [x] Correcao: Imports incorretos em `configuracoes/`

---

## 2. ARQUIVOS IMPORTANTES

### Backend (Python/FastAPI)

| Modulo | Arquivo Principal | Descricao |
|--------|-------------------|-----------|
| Core | `backend/main.py` | Aplicacao FastAPI principal |
| Config | `backend/config.py` | Variaveis de ambiente |
| Auth | `backend/auth/service.py` | Logica de autenticacao |
| Energisa | `backend/energisa/service.py` | Gateway scraping Energisa |
| Faturas | `backend/faturas/service.py` | Extracao e sync de faturas |
| Cobrancas | `backend/cobrancas/service.py` | Geracao de cobrancas |
| Cobrancas | `backend/cobrancas/calculator.py` | Calculadora com bandeira proporcional |
| Config Impostos | `backend/configuracoes/service.py` | CRUD de impostos |
| Constantes | `backend/energisa/constants.py` | Valores das bandeiras |
| Sync | `backend/sync/service.py` | Scheduler de sincronizacao |

### Frontend (React/TypeScript)

| Funcionalidade | Arquivo Principal | Rota |
|----------------|-------------------|------|
| Rotas | `frontend/src/routes/index.tsx` | Definicao de rotas |
| Layout | `frontend/src/components/layout/Sidebar.tsx` | Menu lateral |
| Auth Context | `frontend/src/contexts/AuthContext.tsx` | Estado de autenticacao |
| Processar Cobrancas | `frontend/src/pages/gestor/ProcessamentoCobrancas.tsx` | `/app/gestor/processar-cobrancas` |
| Kanban Faturas | `frontend/src/pages/gestor/KanbanFaturas.tsx` | `/app/gestor/kanban-faturas` |
| Kanban Leads | `frontend/src/pages/gestor/KanbanLeads.tsx` | `/app/gestor/kanban-leads` |
| Admin Impostos | `frontend/src/pages/admin/Impostos.tsx` | `/app/admin/impostos` |
| API Cobrancas | `frontend/src/api/cobrancas.ts` | Cliente HTTP cobrancas |
| API Config | `frontend/src/api/configuracoes.ts` | Cliente HTTP impostos |

### Banco de Dados (Supabase)

| Migration | Arquivo | Descricao |
|-----------|---------|-----------|
| 001 | `supabase/migrations/001_initial_schema.sql` | Schema inicial (28 tabelas) |
| 002 | `supabase/migrations/002_rls_policies.sql` | Politicas RLS |
| 012 | `supabase/migrations/012_*.sql` | Aprimoramento cobrancas GD |
| 013 | `supabase/migrations/013_*.sql` | Dados extraidos de faturas |
| 016 | `supabase/migrations/016_*.sql` | Expansao CRM leads |
| 017 | `supabase/migrations/017_configuracoes_impostos.sql` | Tabela de impostos |

---

## 3. PROXIMOS PASSOS

### Fase 1: Verificacao Automatica de Impostos
**Prioridade:** Alta
**Objetivo:** Detectar automaticamente quando os impostos mudam na fatura

| Tarefa | Arquivos Envolvidos | Status |
|--------|---------------------|--------|
| Extrair PIS/COFINS/ICMS do PDF durante extracao | `backend/faturas/service.py`, `backend/faturas/extractor.py` | Pendente |
| Comparar com impostos vigentes no banco | `backend/configuracoes/service.py` | Pendente |
| Criar novo registro se diferenca > 0.1% | `backend/configuracoes/service.py` | Pendente |
| Log de auditoria para alteracoes | `supabase/migrations/018_*.sql` | Pendente |
| Notificar admin sobre mudanca detectada | `backend/notificacoes/service.py` | Pendente |

### Fase 2: Envio de Email
**Prioridade:** Alta
**Objetivo:** Enviar cobranca por email ao beneficiario

| Tarefa | Arquivos Envolvidos | Status |
|--------|---------------------|--------|
| Integrar servico de email (SendGrid/SES) | `backend/email/service.py` (criar) | Pendente |
| Template HTML para email de cobranca | `backend/email/templates/` (criar) | Pendente |
| Botao "Aprovar e Enviar" funcional | `frontend/src/pages/gestor/ProcessamentoCobrancas.tsx` | Pendente |
| Historico de envios no banco | `supabase/migrations/019_*.sql` | Pendente |
| Endpoint POST `/api/cobrancas/{id}/enviar-email` | `backend/cobrancas/router.py` | Pendente |

### Fase 3: Dashboard Admin
**Prioridade:** Media
**Objetivo:** Metricas e visao geral do sistema

| Tarefa | Arquivos Envolvidos | Status |
|--------|---------------------|--------|
| Total de usinas/beneficiarios/UCs | `backend/admin/service.py` | Pendente |
| Receita mensal/anual | `backend/admin/service.py` | Pendente |
| Taxa de inadimplencia | `backend/admin/service.py` | Pendente |
| Graficos de evolucao (Recharts) | `frontend/src/pages/admin/Dashboard.tsx` | Pendente |
| Cards de metricas principais | `frontend/src/pages/admin/Dashboard.tsx` | Pendente |

### Fase 4: Melhorias de UX
**Prioridade:** Media
**Objetivo:** Melhorar experiencia do usuario

| Tarefa | Arquivos Envolvidos | Status |
|--------|---------------------|--------|
| Notificacoes push/toast | `frontend/src/components/Toast.tsx` (criar) | Pendente |
| Filtros avancados em listagens | Multiplas paginas | Pendente |
| Export de relatorios (PDF/Excel) | `backend/relatorios/` (criar) | Pendente |
| Dark mode persistente | `frontend/src/contexts/ThemeContext.tsx` | Pendente |

### Fase 5: Integracoes (Futuro)
**Prioridade:** Baixa
**Objetivo:** Integracoes externas

| Tarefa | Arquivos Envolvidos | Status |
|--------|---------------------|--------|
| Webhook para pagamentos (PIX) | `backend/webhooks/` (criar) | Pendente |
| Integracao bancaria | `backend/integracoes/` (criar) | Pendente |
| API publica para parceiros | `backend/api_publica/` (criar) | Pendente |

### Fase 6: Marketplace (Futuro)
**Prioridade:** Baixa
**Objetivo:** Marketplace de parceiros e projetos

| Tarefa | Arquivos Envolvidos | Status |
|--------|---------------------|--------|
| Cadastro de integradores | `backend/marketplace/parceiros/` (criar) | Pendente |
| Catalogo de equipamentos | `backend/marketplace/produtos/` (criar) | Pendente |
| Gestao de projetos | `backend/marketplace/projetos/` (criar) | Pendente |
| Board de acompanhamento | `backend/marketplace/kanban/` (criar) | Pendente |

---

## 4. DECISOES TECNICAS

### Valores das Bandeiras Tarifarias (R$/kWh sem impostos)

```python
BANDEIRAS_TARIFARIAS = {
    "verde": 0.0,
    "amarela": 0.0188,
    "vermelha_p1": 0.0446,  # Padrao quando nao especificado
    "vermelha_p2": 0.0787
}
```

Arquivo: `backend/energisa/constants.py`

### Formula de Calculo de Impostos

```
valor_com_impostos = valor_base / ((1 - PIS_COFINS) × (1 - ICMS))
```

Onde:
- PIS_COFINS = PIS + COFINS (ex: 0.012102 + 0.055743 = 0.067845)
- ICMS = 0.17 (17%)

### Impostos Vigentes (desde 01/01/2025)

| Imposto | Valor |
|---------|-------|
| PIS | 1.2102% |
| COFINS | 5.5743% |
| ICMS | 17% |

Tabela: `configuracoes_impostos`
Tela: `/app/admin/impostos`

### Padroes de Codigo

**Backend:**
- Cada modulo tem: `__init__.py`, `schemas.py`, `service.py`, `router.py`
- Validacao com Pydantic
- Autenticacao via `get_current_user` dependency

**Frontend:**
- Componentes em `src/components/`
- Paginas por perfil em `src/pages/{perfil}/`
- API clients em `src/api/`
- Contexts para estado global

### Estrutura de Arquivos Backend

```
backend/
├── main.py              # Aplicacao FastAPI principal
├── config.py            # Variaveis de ambiente
├── dependencies.py      # Dependencias globais
├── core/                # Infraestrutura (database, security, exceptions)
├── auth/                # Autenticacao (schemas, service, router)
├── energisa/            # Gateway scraping Energisa
├── usuarios/            # CRUD usuarios
├── ucs/                 # Unidades Consumidoras
├── usinas/              # Gestao de usinas GD
├── beneficiarios/       # CRUD beneficiarios
├── faturas/             # Extracao e sync de faturas
├── cobrancas/           # Geracao e calculo de cobrancas
├── contratos/           # Contratos digitais
├── saques/              # Solicitacoes de saque
├── leads/               # CRM para landing page
├── notificacoes/        # Sistema multi-canal
├── admin/               # Dashboard e configuracoes
├── configuracoes/       # Gestao de impostos
└── tests/               # Testes automatizados
```

### Endpoints Principais (Resumo)

| Modulo | Rotas | Endpoints |
|--------|-------|-----------|
| Auth | `/api/auth` | signup, signin, refresh, logout, me |
| Energisa | `/api/energisa` | simulacao, login, ucs, faturas, gd |
| Usuarios | `/api/usuarios` | CRUD, perfis, ativacao |
| UCs | `/api/ucs` | vincular, gd, beneficiarias |
| Usinas | `/api/usinas` | CRUD, gestores, beneficiarios |
| Beneficiarios | `/api/beneficiarios` | CRUD, convites, status |
| Faturas | `/api/faturas` | listagem, kanban, estatisticas |
| Cobrancas | `/api/cobrancas` | geracao, pagamento, lote |
| Contratos | `/api/contratos` | CRUD, assinatura, rescisao |
| Saques | `/api/saques` | solicitacao, aprovacao |
| Leads | `/api/leads` | captura, simulacao, funil |
| Notificacoes | `/api/notificacoes` | CRUD, preferencias |
| Admin | `/api/admin` | dashboard, configuracoes, logs |

**Documentacao completa:** `http://localhost:8000/docs` (Swagger)

---

## 5. CONTEXTO RAPIDO

### Stack Tecnologico

| Camada | Tecnologia |
|--------|------------|
| Backend | FastAPI 0.109+, Python 3.11 |
| Frontend | React 19, TypeScript 5.9, Vite 7.2 |
| Banco de Dados | Supabase (PostgreSQL) |
| Estilizacao | TailwindCSS 3.4 |
| Autenticacao | Supabase Auth + JWT |
| IA/Extracao | OpenAI + LLMWhisperer |
| Graficos | Recharts |
| Mapas | Leaflet |

### Perfis de Usuario

1. `superadmin` - Acesso total
2. `proprietario` - Dono de usinas
3. `gestor` - Gerencia usinas e beneficiarios
4. `beneficiario` - Recebe energia GD
5. `usuario` - Usuario comum
6. `parceiro` - Parceiro comercial

### URLs Importantes

- **Supabase:** `https://supabase.midwestengenharia.com.br`
- **Backend local:** `http://localhost:8000`
- **Frontend local:** `http://localhost:3000`
- **Swagger:** `http://localhost:8000/docs`

### Comandos Uteis

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload

# Frontend
cd frontend
npm install
npm run dev

# Docker
docker-compose up -d

# Testes
pytest tests/ -v
```

---

## 6. COMO RETOMAR O TRABALHO

Ao iniciar uma nova sessao com Claude, informe:

1. **Qual fase quer implementar** (1-5)
2. **Qual tarefa especifica** da fase
3. **Se ha bugs ou problemas** a resolver primeiro

Claude pode ler este documento para entender o contexto e continuar de onde paramos.

---

## 7. HISTORICO DE SESSOES

| Data | Implementacao | Status |
|------|---------------|--------|
| 2025-12-14 | Calculo proporcional de bandeira tarifaria | Concluido |
| 2025-12-14 | Botao de reprocessamento de cobrancas | Concluido |
| 2025-12-14 | Tela de gestao de impostos | Concluido |
| 2025-12-14 | Correcoes de bugs (Kanban, Leads, imports) | Concluido |
| 2025-12-15 | Criacao deste documento de planejamento | Concluido |
| 2025-12-16 | Correcoes exibicao faturas GD (7 itens) | Concluido |
| 2025-12-16 | Reorganizacao arquivos de plano | Concluido |
| 2025-12-16 | Correcoes adicionais mapeamento energia injetada | Concluido |
| 2026-01-06 | Nova arquitetura de paginas do gestor (GD, Clientes, UCs) | Planejado |

### Detalhes Sessao 16/12/2025 (Manha)

**Correcoes implementadas no ProcessamentoCobrancas:**
1. Unificar logica GD usando `FaturaExtraidaSchema.detectar_modelo_gd()`
2. Garantir mapeamento energia injetada (oUC/mUC)
3. Adicionar campos faltantes (datas, leituras)
4. Preview cobranca (como relatorio)
5. Clarificar consumo bruto vs liquido
6. Exibir taxa minima GD1 (30/50/100 kWh)
7. Indicadores contextuais (INFO azul)

### Detalhes Sessao 16/12/2025 (Tarde)

**Organizacao:**
- Movido `PROJETO_PLATAFORMA_GD.md` para `docs/ESPECIFICACAO_REQUISITOS.md`

**Backend (`backend/faturas/router.py`):**
- Adicionado campos `bandeira_extraida` e `bandeira_tarifaria_pdf` no endpoint `/faturas/kanban`

**Frontend (`frontend/src/pages/gestor/ProcessamentoCobrancas.tsx`):**
1. Criado helpers para acessar energia injetada com ambos formatos de chave (espaço e underscore):
   - `getEnergiaInjetadaOUC()`, `getEnergiaInjetadaMUC()`
   - `calcularInjetadaOUC()`, `calcularInjetadaMUC()`
   - `calcularValorInjetadaOUC()`, `calcularValorInjetadaMUC()`
   - `getLancamentosSemIluminacao()`, `getValorIluminacaoPublica()`
   - `getTaxaMinima()` - retorna 30/50/100 kWh por tipo de ligacao
2. Corrigido mapeamento de energia injetada (oUC + mUC) - problema era chave com espaco vs underscore
3. Corrigido exibicao de bandeira extraida do PDF (usando `fatura.bandeira_extraida`)
4. Corrigido duplicacao iluminacao vs outros servicos (filtro correto)
5. Corrigido label taxa minima vs energia excedente (GD1) - mostra label correto baseado no consumo liquido
6. Economia GD agora calcula corretamente usando os novos helpers

### Detalhes Sessao 06/01/2026

**Nova Arquitetura de Paginas do Gestor:**
- Criado plano `.claude/plans/arquitetura-paginas-gestor.md`
- Substitui plano `unificacao-clientes-ucs.md`
- Estrutura de 3 paginas:
  1. **GD (Geracao Distribuida)** - Usinas + Beneficiarias + Avulsas em abas
  2. **Clientes** - Relacionamento comercial (mantido)
  3. **UCs Gerenciadas** - Todas as UCs (corrigido para mostrar todas)
- Depreca pagina Beneficiarios (redundante com Clientes)
- Corrige problema: UCsGestor mostrava apenas 8 de 19 UCs

---

**Proximo passo sugerido:**
- Arquitetura de Paginas (`.claude/plans/arquitetura-paginas-gestor.md`)
- OU Fase 1 (Verificacao Automatica de Impostos)
- OU Fase 2 (Envio de Email)
