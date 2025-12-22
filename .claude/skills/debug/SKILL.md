---
name: debug
description: |
  Debugar problemas no sistema GestorEnergy. Use quando o usuario reportar erro, bug, problema, comportamento inesperado, ou pedir para investigar algum issue.
---

# Debug do Sistema

Guia para debugar problemas no GestorEnergy.

## Passo 1: Identificar o Problema

Perguntas importantes:
- Frontend ou Backend?
- Qual endpoint/pagina?
- Qual mensagem de erro?
- Quando comecou a acontecer?

## Debug Backend (FastAPI)

### Ver Logs

```bash
# Logs do uvicorn
cd "C:/Users/ewerton.pria/Documents/Aplicações/GestorEnergy/backend"
uvicorn main:app --reload --log-level debug
```

### Adicionar Logs

```python
import logging
logger = logging.getLogger(__name__)

# Em qualquer funcao
logger.debug(f"Valor da variavel: {variavel}")
logger.info(f"Processando item: {item.id}")
logger.warning(f"Situacao inesperada: {situacao}")
logger.error(f"Erro ao processar: {e}")
```

### Testar Endpoint Isolado

```bash
# Testar com curl
curl -X GET http://localhost:8000/api/faturas \
  -H "Authorization: Bearer <token>"

# Ver response detalhado
curl -v -X GET http://localhost:8000/api/faturas \
  -H "Authorization: Bearer <token>"
```

### Debug com Breakpoint

```python
# Adicionar breakpoint em qualquer lugar
import pdb; pdb.set_trace()

# Ou usar IPython
import IPython; IPython.embed()
```

## Debug Frontend (React)

### Console do Browser

```tsx
// Adicionar logs
console.log('Estado atual:', state);
console.log('Props:', props);
console.log('Response:', response);

// Objeto formatado
console.dir(objeto);

// Com trace
console.trace('Chegou aqui');
```

### React DevTools

1. Instalar extensao React DevTools
2. Abrir DevTools (F12)
3. Aba "Components" - ver arvore de componentes
4. Aba "Profiler" - performance

### Debug de Estado

```tsx
useEffect(() => {
  console.log('Estado mudou:', estado);
}, [estado]);
```

## Debug de Queries Supabase

```python
# Ver query gerada
result = supabase.table("faturas").select("*").eq("status", "EMITIDA")
print(result.params)  # Ver parametros
print(result.data)    # Ver resultado
```

## Debug de Extracao de PDF

```python
# Em llm_extractor.py
import pdfplumber

with pdfplumber.open(pdf_path) as pdf:
    for i, page in enumerate(pdf.pages):
        print(f"=== Pagina {i+1} ===")
        print(page.extract_text())
        print("=" * 50)
```

## Erros Comuns

### Backend

| Erro | Causa Provavel | Verificar |
|------|----------------|-----------|
| 401 Unauthorized | Token invalido/expirado | Verificar JWT |
| 403 Forbidden | Sem permissao | Verificar RLS/perfil |
| 404 Not Found | Recurso nao existe | Verificar ID |
| 422 Validation Error | Dados invalidos | Ver detalhes do erro |
| 500 Internal Error | Bug no codigo | Ver logs/traceback |

### Frontend

| Erro | Causa Provavel | Verificar |
|------|----------------|-----------|
| CORS Error | Backend nao permite | Verificar config CORS |
| Network Error | Backend offline | Verificar se esta rodando |
| Type Error | Dado undefined | Verificar null checks |
| Render Error | Componente quebrado | Ver stack trace |

## Checklist de Debug

1. [ ] Ler mensagem de erro completa
2. [ ] Verificar logs do backend
3. [ ] Verificar console do browser
4. [ ] Reproduzir o problema
5. [ ] Isolar a causa (API, BD, frontend)
6. [ ] Adicionar logs temporarios
7. [ ] Testar fix localmente
8. [ ] Remover logs de debug
