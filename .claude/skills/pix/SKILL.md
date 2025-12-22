---
name: pix
description: |
  Trabalhar com integracao PIX Santander. Use quando o usuario pedir para debugar PIX, verificar cobranca PIX, gerar QR Code, implementar webhook PIX, ou trabalhar com API Santander.
---

# Integracao PIX Santander

Sistema de cobranca PIX usando API Santander com mTLS e OAuth2.

## Arquivos Principais

- `backend/pix/santander.py` - Cliente API Santander
- `backend/pix/qrcode.py` - Geracao de QR Code
- `backend/pix/schemas.py` - Schemas Pydantic

## Configuracao

Variaveis de ambiente necessarias:

```env
PIX_SANTANDER_CLIENT_ID=seu_client_id
PIX_SANTANDER_CLIENT_SECRET=seu_client_secret
PIX_SANTANDER_CERT_PATH=/path/to/cert.pem
PIX_SANTANDER_KEY_PATH=/path/to/key.pem
PIX_SANTANDER_CHAVE=sua_chave_pix
```

## Autenticacao mTLS + OAuth2

```python
import httpx

# Certificados mTLS
cert = (CERT_PATH, KEY_PATH)

# Obter access_token
async with httpx.AsyncClient(cert=cert) as client:
    response = await client.post(
        "https://trust-pix.santander.com.br/oauth/token",
        data={
            "grant_type": "client_credentials",
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET
        }
    )
    token = response.json()["access_token"]
```

## Criar Cobranca (COBV)

```python
import uuid
from datetime import datetime, timedelta

txid = str(uuid.uuid4()).replace("-", "")[:35]
vencimento = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")

payload = {
    "calendario": {
        "dataDeVencimento": vencimento,
        "validadeAposVencimento": 30  # dias
    },
    "devedor": {
        "cpf": "12345678900",
        "nome": "Nome do Devedor"
    },
    "valor": {
        "original": "150.00",
        "multa": {"modalidade": 2, "valorPerc": "1.00"},
        "juros": {"modalidade": 2, "valorPerc": "1.00"}
    },
    "chave": CHAVE_PIX,
    "infoAdicionais": [
        {"nome": "Referencia", "valor": f"Cobranca {cobranca_id}"}
    ]
}

response = await client.put(
    f"https://trust-pix.santander.com.br/api/v1/cobv/{txid}",
    json=payload,
    headers={"Authorization": f"Bearer {token}"}
)
```

## Gerar QR Code

```python
import qrcode
import base64
from io import BytesIO

def gerar_qrcode_base64(emv: str) -> str:
    """Gera imagem QR Code em base64."""
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(emv)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode()
```

## Campos na Cobranca

```sql
ALTER TABLE cobrancas ADD COLUMN txid VARCHAR(35);
ALTER TABLE cobrancas ADD COLUMN qr_code_pix TEXT;         -- EMV string
ALTER TABLE cobrancas ADD COLUMN qr_code_pix_image TEXT;   -- Base64 PNG
ALTER TABLE cobrancas ADD COLUMN status_pix VARCHAR(20);   -- ATIVA, PAGA, VENCIDA
```

## Status PIX

| Status | Descricao |
|--------|-----------|
| `ATIVA` | Cobranca ativa aguardando pagamento |
| `CONCLUIDA` | Pagamento confirmado |
| `REMOVIDA_PELO_USUARIO_RECEBEDOR` | Cancelada |
| `REMOVIDA_PELO_PSP` | Removida pelo banco |

## Webhook (Futuro)

Receber notificacoes de pagamento:

```python
@router.post("/api/pix/webhook")
async def webhook_pix(payload: dict):
    """Webhook para receber confirmacoes de pagamento."""
    for pix in payload.get("pix", []):
        txid = pix["txid"]
        valor = pix["valor"]

        # Atualizar cobranca
        await supabase.table("cobrancas").update({
            "status": "PAGA",
            "status_pix": "CONCLUIDA",
            "data_pagamento": datetime.now().isoformat()
        }).eq("txid", txid).execute()
```

## Consultar Cobranca

```python
response = await client.get(
    f"https://trust-pix.santander.com.br/api/v1/cobv/{txid}",
    headers={"Authorization": f"Bearer {token}"}
)
status = response.json()["status"]
```

## Erros Comuns

| Erro | Causa | Solucao |
|------|-------|---------|
| 401 | Token expirado | Renovar access_token |
| 403 | Certificado invalido | Verificar cert/key mTLS |
| 400 | Payload invalido | Verificar campos obrigatorios |
