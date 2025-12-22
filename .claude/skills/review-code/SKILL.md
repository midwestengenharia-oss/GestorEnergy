---
name: review-code
description: |
  Revisar codigo do projeto GestorEnergy. Use quando o usuario pedir para revisar codigo, fazer code review, verificar qualidade do codigo, ou analisar mudancas.
---

# Code Review

Revisar codigo do projeto GestorEnergy seguindo boas praticas.

## Checklist de Review

### Seguranca
- [ ] Sem credenciais hardcoded
- [ ] Sem SQL injection (usar queries parametrizadas)
- [ ] Sem XSS (sanitizar inputs)
- [ ] Autenticacao em endpoints sensiveis
- [ ] Validacao de inputs com Pydantic

### Qualidade
- [ ] Codigo legivel e bem organizado
- [ ] Nomes de variaveis descritivos
- [ ] Funcoes pequenas e focadas
- [ ] Sem codigo duplicado
- [ ] Tratamento de erros adequado

### Performance
- [ ] Sem N+1 queries
- [ ] Indices em colunas filtradas
- [ ] Sem loops desnecessarios
- [ ] Paginacao em listas grandes

### Testes
- [ ] Testes para novos endpoints
- [ ] Testes para casos de erro
- [ ] Cobertura adequada

### TypeScript (Frontend)
- [ ] Tipos definidos (sem `any`)
- [ ] Interfaces para props
- [ ] Null checks adequados

### Python (Backend)
- [ ] Type hints em funcoes
- [ ] Docstrings em funcoes publicas
- [ ] Schemas Pydantic para request/response

## Padroes do Projeto

### Backend (Python/FastAPI)
```python
# Bom - com type hints e docstring
async def listar_faturas(
    page: int = 1,
    limit: int = 20,
    supabase = Depends(get_supabase)
) -> List[FaturaResponse]:
    """Lista faturas com paginacao."""
    ...

# Ruim - sem tipos
def listar_faturas(page, limit, supabase):
    ...
```

### Frontend (React/TypeScript)
```tsx
// Bom - com tipos e interface
interface Props {
  fatura: Fatura;
  onEdit: (id: string) => void;
}

export function FaturaCard({ fatura, onEdit }: Props) {
  ...
}

// Ruim - sem tipos
export function FaturaCard(props: any) {
  ...
}
```

## Comandos para Review

```bash
# Ver diff de um arquivo
git diff <arquivo>

# Ver diff de um commit
git show <commit>

# Ver historico de um arquivo
git log --oneline -10 -- <arquivo>

# Ver blame (quem alterou cada linha)
git blame <arquivo>
```

## Feedback de Review

Usar formato construtivo:

```
[Tipo] Descricao

Sugestao: ...
```

Tipos:
- `[Bug]` - Erro que precisa ser corrigido
- `[Sugestao]` - Melhoria opcional
- `[Duvida]` - Precisa de esclarecimento
- `[Elogio]` - Codigo bem feito

## Anti-patterns a Evitar

### Backend
- Logica de negocio em routers (mover para services)
- Queries sem paginacao
- Exceptions genericas (usar HTTPException)
- Commits sem validacao de dados

### Frontend
- useEffect sem deps array
- Estado global desnecessario
- Componentes muito grandes (>200 linhas)
- Fetch direto sem tratamento de erro
