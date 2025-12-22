---
name: api-create
description: |
  Criar novos endpoints API no backend FastAPI. Use quando o usuario pedir para criar endpoint, adicionar rota, criar API nova, ou implementar nova funcionalidade no backend.
---

# Criar Endpoints API

Guia para criar novos endpoints no backend FastAPI do GestorEnergy.

## Estrutura do Backend

```
backend/
├── main.py              # App FastAPI + registro de routers
├── config.py            # Configuracoes
├── dependencies.py      # Dependencias (auth, db)
├── routers/             # Endpoints por dominio
│   ├── auth.py
│   ├── faturas.py
│   ├── cobrancas.py
│   └── ...
├── {dominio}/           # Pacotes por dominio
│   ├── service.py       # Logica de negocio
│   ├── schemas.py       # Schemas Pydantic
│   └── models.py        # Modelos (se necessario)
└── tests/               # Testes
```

## Criar Novo Router

1. Criar arquivo em `routers/novo_dominio.py`:

```python
from fastapi import APIRouter, Depends, HTTPException
from dependencies import get_current_user, get_supabase
from typing import List
from pydantic import BaseModel

router = APIRouter(prefix="/api/novo-dominio", tags=["novo-dominio"])

# Schema de resposta
class ItemResponse(BaseModel):
    id: str
    nome: str
    created_at: str

# GET - Listar
@router.get("/", response_model=List[ItemResponse])
async def listar_items(
    supabase = Depends(get_supabase),
    user = Depends(get_current_user)
):
    """Lista todos os items do usuario."""
    result = supabase.table("items").select("*").eq("user_id", user.id).execute()
    return result.data

# GET - Buscar por ID
@router.get("/{id}", response_model=ItemResponse)
async def buscar_item(
    id: str,
    supabase = Depends(get_supabase),
    user = Depends(get_current_user)
):
    """Busca item por ID."""
    result = supabase.table("items").select("*").eq("id", id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Item nao encontrado")
    return result.data

# POST - Criar
@router.post("/", response_model=ItemResponse)
async def criar_item(
    data: ItemCreate,
    supabase = Depends(get_supabase),
    user = Depends(get_current_user)
):
    """Cria novo item."""
    payload = data.model_dump()
    payload["user_id"] = user.id
    result = supabase.table("items").insert(payload).execute()
    return result.data[0]

# PUT - Atualizar
@router.put("/{id}", response_model=ItemResponse)
async def atualizar_item(
    id: str,
    data: ItemUpdate,
    supabase = Depends(get_supabase),
    user = Depends(get_current_user)
):
    """Atualiza item existente."""
    result = supabase.table("items").update(data.model_dump(exclude_unset=True)).eq("id", id).execute()
    return result.data[0]

# DELETE - Remover
@router.delete("/{id}")
async def deletar_item(
    id: str,
    supabase = Depends(get_supabase),
    user = Depends(get_current_user)
):
    """Remove item."""
    supabase.table("items").delete().eq("id", id).execute()
    return {"message": "Item removido"}
```

2. Registrar em `main.py`:

```python
from routers import novo_dominio

app.include_router(novo_dominio.router)
```

## Padroes

### Autenticacao
- `get_current_user` - Usuario autenticado (JWT)
- `get_current_admin` - Apenas admin

### Respostas
- 200: Sucesso
- 201: Criado
- 400: Erro de validacao
- 401: Nao autenticado
- 403: Nao autorizado
- 404: Nao encontrado
- 500: Erro interno

### Query Parameters
```python
@router.get("/")
async def listar(
    page: int = 1,
    limit: int = 20,
    status: str = None
):
    ...
```

## Criar Servico

Para logica complexa, criar `{dominio}/service.py`:

```python
from dependencies import get_supabase

class NovoDominioService:
    def __init__(self, supabase):
        self.supabase = supabase

    async def processar(self, dados):
        # Logica de negocio aqui
        pass
```
