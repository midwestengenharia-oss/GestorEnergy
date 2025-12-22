---
name: energisa
description: |
  Trabalhar com integracao Energisa via scraping. Use quando o usuario pedir para debugar login Energisa, verificar sincronizacao de UCs, trabalhar com tokens Energisa, ou resolver problemas de conexao com Energisa.
---

# Integracao Energisa

Sistema de scraping automatizado para obter dados da Energisa usando Playwright.

## Arquivos Principais

- `backend/energisa/gateway.py` - Gateway principal de scraping
- `backend/energisa/service.py` - Servico de integracao
- `backend/routers/energisa.py` - Endpoints API
- `backend/energisa/schemas.py` - Schemas Pydantic

## Fluxo de Login

O login da Energisa usa verificacao em 3 etapas:

1. **Start Login**: Envia CPF/CNPJ
   ```
   POST /api/energisa/login/start
   Body: { "documento": "12345678900" }
   Response: { "opcoes": ["(11) 9****-1234", "email@*****.com"] }
   ```

2. **Select Option**: Escolhe metodo de verificacao
   ```
   POST /api/energisa/login/select-option
   Body: { "documento": "12345678900", "opcao_index": 0 }
   Response: { "message": "Codigo enviado por SMS" }
   ```

3. **Finish Login**: Envia codigo SMS
   ```
   POST /api/energisa/login/finish
   Body: { "documento": "12345678900", "codigo": "123456" }
   Response: { "token": "...", "ucs": [...] }
   ```

## Tokens Energisa

Tokens sao armazenados em `tokens_energisa`:
- `access_token` - Token JWT da Energisa
- `refresh_token` - Token para renovacao
- `expires_at` - Data de expiracao

## Scraping com Playwright

```python
from playwright.async_api import async_playwright

async with async_playwright() as p:
    browser = await p.chromium.launch(headless=True)
    page = await browser.new_page()

    # Login
    await page.goto("https://energisa.com.br/login")
    await page.fill("#cpf", documento)
    await page.click("#btn-login")

    # Aguardar SMS
    await page.wait_for_selector("#codigo-sms")
    await page.fill("#codigo-sms", codigo)

    # Extrair dados
    await page.goto("https://energisa.com.br/faturas")
    faturas = await page.query_selector_all(".fatura")
```

## Endpoints Disponiveis

| Endpoint | Descricao |
|----------|-----------|
| `POST /api/energisa/login/start` | Iniciar login |
| `POST /api/energisa/login/select-option` | Selecionar verificacao |
| `POST /api/energisa/login/finish` | Finalizar login |
| `GET /api/energisa/ucs` | Listar UCs |
| `GET /api/energisa/ucs/{id}/faturas` | Faturas de uma UC |
| `GET /api/energisa/ucs/{id}/gd` | Dados de GD |
| `POST /api/energisa/sync` | Forcar sincronizacao |

## Debugar Scraping

Rodar Playwright em modo visivel:

```python
browser = await p.chromium.launch(headless=False, slow_mo=1000)
```

Adicionar screenshots:

```python
await page.screenshot(path="debug.png")
```

## Erros Comuns

| Erro | Causa | Solucao |
|------|-------|---------|
| Token expirado | Token JWT invalido | Renovar com refresh_token |
| Login falhou | Credenciais invalidas | Verificar CPF/CNPJ |
| Timeout | Pagina demorou | Aumentar timeout |
| Elemento nao encontrado | HTML mudou | Atualizar seletores |

## Renovar Token

```python
async def renovar_token(refresh_token: str):
    # Chamar endpoint de refresh da Energisa
    response = await httpx.post(
        "https://api.energisa.com.br/auth/refresh",
        json={"refresh_token": refresh_token}
    )
    return response.json()["access_token"]
```
