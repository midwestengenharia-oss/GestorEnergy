---
name: sync
description: |
  Trabalhar com sincronizacao automatica do GestorEnergy. Use quando o usuario pedir para debugar sincronizacao, verificar scheduler, forcar sync manual, ou resolver problemas de sincronizacao de faturas.
---

# Sincronizacao Automatica

Sistema de sincronizacao automatica de faturas da Energisa.

## Arquivos Principais

- `backend/sync/scheduler.py` - Scheduler principal
- `backend/sync/service.py` - Servico de sincronizacao
- `backend/routers/sync.py` - Endpoints API

## Como Funciona

O scheduler roda a cada 10 minutos e:
1. Busca todas UCs com token Energisa valido
2. Para cada UC, busca ultimas 3 faturas
3. Extrai dados com LLM/OCR
4. Armazena em `faturas`

## Configuracao

```python
# Em scheduler.py
SYNC_INTERVAL_MINUTES = 10  # Intervalo entre sincronizacoes
MAX_FATURAS_POR_UC = 3      # Quantas faturas buscar por UC
```

## Endpoints

| Endpoint | Descricao |
|----------|-----------|
| `GET /api/sync/status` | Status da ultima sincronizacao |
| `POST /api/sync/trigger` | Forcar sincronizacao manual |
| `GET /api/sync/logs` | Logs de sincronizacao |

## Forcar Sincronizacao

```bash
curl -X POST http://localhost:8000/api/sync/trigger \
  -H "Authorization: Bearer <token>"
```

## Status de Sincronizacao

```python
class SyncStatus(BaseModel):
    ultima_execucao: datetime
    proxima_execucao: datetime
    ucs_sincronizadas: int
    faturas_novas: int
    erros: List[str]
    em_execucao: bool
```

## Logs de Sincronizacao

```python
# Tabela sync_logs
class SyncLog(BaseModel):
    id: UUID
    inicio: datetime
    fim: datetime
    ucs_processadas: int
    faturas_criadas: int
    erros: List[dict]
    status: str  # SUCESSO, PARCIAL, FALHA
```

## Debugar Sincronizacao

Adicionar logs detalhados:

```python
import logging
logger = logging.getLogger("sync")
logger.setLevel(logging.DEBUG)

# Em service.py
logger.debug(f"Processando UC {uc.numero_instalacao}")
logger.debug(f"Faturas encontradas: {len(faturas)}")
logger.debug(f"Extracao concluida: {dados}")
```

## Scheduler com APScheduler

```python
from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler()

@scheduler.scheduled_job('interval', minutes=10)
async def job_sincronizacao():
    """Job de sincronizacao automatica."""
    logger.info("Iniciando sincronizacao...")
    try:
        await sync_service.sincronizar_todas_ucs()
        logger.info("Sincronizacao concluida")
    except Exception as e:
        logger.error(f"Erro na sincronizacao: {e}")

# Iniciar scheduler
scheduler.start()
```

## Erros Comuns

| Erro | Causa | Solucao |
|------|-------|---------|
| Token expirado | Token Energisa invalido | Renovar token |
| Timeout | Energisa lenta | Aumentar timeout |
| Rate limit | Muitas requisicoes | Adicionar delay entre UCs |
| Extracao falhou | PDF nao legivel | Tentar OCR ou manual |

## Metricas

Monitorar:
- Tempo de execucao total
- UCs processadas vs total
- Taxa de sucesso de extracao
- Erros por tipo

```python
metricas = {
    "duracao_segundos": 120,
    "ucs_total": 50,
    "ucs_sucesso": 48,
    "ucs_erro": 2,
    "faturas_novas": 30,
    "taxa_sucesso": 0.96
}
```
