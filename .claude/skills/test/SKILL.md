---
name: test
description: |
  Executar testes automatizados do projeto GestorEnergy. Use quando o usuario pedir para rodar testes, testar, verificar se os testes passam, ou validar o codigo.
---

# Testes GestorEnergy

Executar testes automatizados do backend com pytest.

## Rodar Todos os Testes

```bash
cd "C:/Users/ewerton.pria/Documents/Aplicações/GestorEnergy/backend"
python -m pytest tests/ -v
```

## Rodar Teste Especifico

```bash
# Por arquivo
python -m pytest tests/test_faturas.py -v

# Por funcao
python -m pytest tests/test_faturas.py::test_listar_faturas -v
```

## Arquivos de Teste Disponiveis

| Arquivo | Cobertura |
|---------|-----------|
| `test_auth.py` | Autenticacao, JWT |
| `test_admin.py` | Dashboard admin |
| `test_beneficiarios.py` | CRUD beneficiarios |
| `test_cobrancas.py` | Calculo cobrancas |
| `test_contratos.py` | Contratos digitais |
| `test_faturas.py` | Extracao faturas |
| `test_health.py` | Health check |
| `test_leads.py` | CRM leads |
| `test_notificacoes.py` | Notificacoes |
| `test_saques.py` | Solicitacao saques |
| `test_ucs.py` | Unidades consumidoras |
| `test_usinas.py` | Usinas solares |

## Opcoes Uteis

```bash
# Com cobertura
python -m pytest tests/ --cov=. --cov-report=html

# Parar no primeiro erro
python -m pytest tests/ -x

# Mostrar print/logs
python -m pytest tests/ -s

# Rodar testes que falharam antes
python -m pytest tests/ --lf
```

## Criar Novo Teste

Estrutura padrao:

```python
# tests/test_novo_modulo.py
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_nome_descritivo():
    """Descricao do que esta sendo testado."""
    response = client.get("/api/endpoint")
    assert response.status_code == 200
    assert "campo" in response.json()

@pytest.mark.parametrize("input,expected", [
    ("valor1", "resultado1"),
    ("valor2", "resultado2"),
])
def test_parametrizado(input, expected):
    """Testa multiplos casos."""
    assert funcao(input) == expected
```

## Verificar Sintaxe Python

Antes de testar, verificar sintaxe:

```bash
python -m py_compile backend/modulo.py
```
