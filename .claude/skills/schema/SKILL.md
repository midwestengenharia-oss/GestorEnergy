---
name: schema
description: |
  Criar e gerenciar schemas Pydantic (backend) e tipos TypeScript (frontend). Use quando o usuario pedir para criar schema, definir tipo, adicionar campo em modelo, ou trabalhar com validacao de dados.
---

# Schemas e Tipos

Guia para criar schemas Pydantic (backend) e tipos TypeScript (frontend).

## Schemas Pydantic (Backend)

### Localizacao

Schemas ficam em `{dominio}/schemas.py`:
- `backend/faturas/schemas.py`
- `backend/cobrancas/schemas.py`
- `backend/beneficiarios/schemas.py`

### Criar Schema de Request

```python
from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime
from uuid import UUID

class ItemCreate(BaseModel):
    """Schema para criacao de item."""
    nome: str = Field(..., min_length=1, max_length=100)
    descricao: Optional[str] = None
    valor: float = Field(..., gt=0)
    status: str = Field(default="RASCUNHO")

    @validator('status')
    def validar_status(cls, v):
        validos = ['RASCUNHO', 'ATIVO', 'INATIVO']
        if v not in validos:
            raise ValueError(f'Status deve ser um de: {validos}')
        return v

class ItemUpdate(BaseModel):
    """Schema para atualizacao (campos opcionais)."""
    nome: Optional[str] = Field(None, min_length=1, max_length=100)
    descricao: Optional[str] = None
    valor: Optional[float] = Field(None, gt=0)
    status: Optional[str] = None
```

### Criar Schema de Response

```python
class ItemResponse(BaseModel):
    """Schema de resposta."""
    id: UUID
    nome: str
    descricao: Optional[str]
    valor: float
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True  # Permite criar de ORM/dict
```

### Validadores Customizados

```python
from pydantic import validator, root_validator

class FaturaCreate(BaseModel):
    mes_referencia: str
    consumo_kwh: int
    valor_total: float

    @validator('mes_referencia')
    def validar_mes(cls, v):
        # Formato: MM/YYYY
        import re
        if not re.match(r'^\d{2}/\d{4}$', v):
            raise ValueError('Formato deve ser MM/YYYY')
        return v

    @root_validator
    def validar_valores(cls, values):
        consumo = values.get('consumo_kwh', 0)
        valor = values.get('valor_total', 0)
        if valor < 0:
            raise ValueError('Valor total nao pode ser negativo')
        return values
```

## Tipos TypeScript (Frontend)

### Localizacao

Tipos ficam em `frontend/src/types/`:
- `frontend/src/types/fatura.ts`
- `frontend/src/types/cobranca.ts`

### Criar Interface

```typescript
// types/fatura.ts

export interface Fatura {
  id: string;
  uc_id: string;
  mes_referencia: string;
  consumo_kwh: number;
  valor_total: number;
  status: FaturaStatus;
  created_at: string;
  updated_at: string;
}

export type FaturaStatus = 'RASCUNHO' | 'EMITIDA' | 'PAGA' | 'VENCIDA';

export interface FaturaCreate {
  uc_id: string;
  mes_referencia: string;
  consumo_kwh: number;
  valor_total: number;
}

export interface FaturaUpdate {
  consumo_kwh?: number;
  valor_total?: number;
  status?: FaturaStatus;
}
```

### Tipos para API

```typescript
// types/api.ts

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface ApiError {
  detail: string;
  status_code: number;
}
```

### Usar com API Client

```typescript
// api/faturas.ts
import { Fatura, FaturaCreate } from '../types/fatura';
import { PaginatedResponse } from '../types/api';

export const faturasApi = {
  listar: async (page = 1): Promise<PaginatedResponse<Fatura>> => {
    const response = await fetch(`/api/faturas?page=${page}`);
    return response.json();
  },

  criar: async (data: FaturaCreate): Promise<Fatura> => {
    const response = await fetch('/api/faturas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return response.json();
  }
};
```

## Sincronizar Backend/Frontend

Garantir que schemas Pydantic e tipos TypeScript estejam sincronizados:

```python
# Backend: FaturaResponse
class FaturaResponse(BaseModel):
    id: UUID
    consumo_kwh: int
    valor_total: float
    status: str
```

```typescript
// Frontend: Fatura (deve espelhar)
interface Fatura {
  id: string;        // UUID -> string
  consumo_kwh: number;
  valor_total: number;
  status: string;
}
```

## Campos Opcionais

```python
# Pydantic
from typing import Optional
campo: Optional[str] = None
```

```typescript
// TypeScript
campo?: string;
```
