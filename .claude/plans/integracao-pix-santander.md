# Plano de Implementação: Integração PIX Santander

> **Objetivo:** Integrar a API PIX do Santander para geração automática de cobranças PIX com vencimento, multa e juros.

---

## 1. Contexto Atual

### 1.1 Estrutura Existente

**Tabela `cobrancas`** já possui campos para PIX:
- `qr_code_pix` - Código copia-e-cola (EMV)
- `qr_code_pix_image` - QR Code em base64
- `status` - RASCUNHO, EMITIDA, PENDENTE, PAGA, VENCIDA, CANCELADA
- `vencimento` - Data de vencimento
- `valor_total` - Valor a ser cobrado

**Fluxo atual:**
1. Fatura é sincronizada da Energisa (com PIX da distribuidora)
2. Cobrança é calculada automaticamente
3. Status: RASCUNHO → EMITIDA → (aguarda pagamento manual)

**O que falta:**
- [ ] Gerar PIX próprio via API Santander (não usar o da distribuidora)
- [ ] Armazenar TXID para rastreamento
- [ ] Configurar multa e juros
- [ ] (Futuro) Webhook para confirmação automática

### 1.2 Decisões de Arquitetura

| Decisão | Escolha | Justificativa |
|---------|---------|---------------|
| **Conta recebedora** | Centralizada (Midwest) | Simplifica v1; expansão futura por usina |
| **Chave PIX** | CNPJ `61902316000163` | Chave única da Midwest |
| **Ambiente** | Produção | Já testado e validado no n8n |
| **Certificado** | Arquivo PFX local | Path configurável via env |
| **Multi-banco (futuro)** | Interface abstrata | Permitirá outros bancos além do Santander |

---

## 2. API Santander - Especificação Real

### 2.1 URLs e Endpoints

| Ambiente | Base URL |
|----------|----------|
| **Produção** | `https://trust-pix.santander.com.br` |

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/oauth/token?grant_type=client_credentials` | Obter access token |
| PUT | `/api/v1/cobv/{txid}` | Criar cobrança com vencimento |
| GET | `/api/v1/cobv/{txid}` | Consultar cobrança |
| PATCH | `/api/v1/cobv/{txid}` | Atualizar cobrança |

### 2.2 Autenticação

```bash
# Obter token (expira rapidamente - ~5 min)
curl -X POST "https://trust-pix.santander.com.br/oauth/token?grant_type=client_credentials" \
  --cert-type P12 \
  --cert "/path/to/certificado.pfx:SENHA" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data "client_id=CLIENT_ID&client_secret=CLIENT_SECRET"
```

**Resposta:**
```json
{
  "access_token": "eyJ...",
  "token_type": "Bearer",
  "expires_in": 300
}
```

### 2.3 Criação de Cobrança com Vencimento (COBV)

```bash
curl -X PUT "https://trust-pix.santander.com.br/api/v1/cobv/{txid}" \
  --cert-type P12 \
  --cert "/path/to/certificado.pfx:SENHA" \
  -H "Authorization: Bearer {access_token}" \
  -H "Content-Type: application/json" \
  --data '{
    "calendario": {
      "dataDeVencimento": "2025-01-15",
      "validadeAposVencimento": 30
    },
    "devedor": {
      "cpf": "12345678901",
      "nome": "João da Silva"
    },
    "valor": {
      "original": "150.00",
      "multa": { "modalidade": "2", "valorPerc": "1.00" },
      "juros": { "modalidade": "3", "valorPerc": "1.00" }
    },
    "chave": "61902316000163",
    "solicitacaoPagador": "Cobrança dos serviços prestados."
  }'
```

**Modalidades de Multa:**
- `1` = Valor fixo
- `2` = Percentual sobre valor original

**Modalidades de Juros:**
- `1` = Valor por dia (fixo)
- `2` = Percentual por dia
- `3` = Percentual por mês

**Resposta:**
```json
{
  "txid": "MW12345678901JOAO1A2B3C",
  "revisao": 0,
  "status": "ATIVA",
  "calendario": {
    "criacao": "2025-01-01T10:00:00Z",
    "dataDeVencimento": "2025-01-15",
    "validadeAposVencimento": 30
  },
  "location": "pix.santander.com.br/qr/v2/cobv/...",
  "pixCopiaECola": "00020126...5802BR..."
}
```

### 2.4 Geração do TXID

Formato validado do n8n:

```javascript
// Prefixo: MW (Midwest)
// Estrutura: MW + doc + nome + timestamp + random
// Tamanho: 26-35 caracteres (target 32)

const PREFIX = 'MW';
const MIN_LEN = 26, MAX_LEN = 35, TARGET_LEN = 32;

function makeTxid({ nomeRaw, docRaw, ucRaw }) {
  const nome = firstName(nomeRaw).slice(0, 8);        // Primeiro nome, max 8 chars
  const doc = onlyDigits(docRaw);                     // CPF/CNPJ só dígitos
  const uc = onlyDigits(ucRaw);                       // UC como fallback
  const docPart = doc || uc || '000000';
  const ts = Date.now().toString(36).toUpperCase().slice(-6);  // Timestamp base36

  let core = PREFIX + docPart + nome + ts;
  // Preencher com random até TARGET_LEN
  const fill = Math.max(0, TARGET_LEN - core.length);
  core += randBase36(fill);

  return core.slice(0, MAX_LEN);
}

// Exemplo: MW12345678901JOAO1A2B3CXYZABC
```

### 2.5 Geração do EMV (QR Code)

Se o Santander retornar `pixCopiaECola`, usar diretamente. Caso contrário, montar a partir do `location`:

```javascript
function gerarEMV({ location, valor, recebedorNome, recebedorCidade }) {
  // Usar pixCopiaECola do Santander se disponível
  // Fallback: montar EMV manualmente com CRC16-CCITT

  const mai = tlv('00', 'br.gov.bcb.pix') + tlv('25', location.slice(0, 77));

  let payload =
    tlv('00', '01') +           // Formato
    tlv('01', '12') +           // QR dinâmico
    tlv('26', mai) +            // MAI
    tlv('52', '0000') +         // MCC
    tlv('53', '986') +          // Moeda BRL
    tlv('54', valor) +          // Valor
    tlv('58', 'BR') +           // País
    tlv('59', recebedorNome) +  // Nome recebedor (max 25)
    tlv('60', recebedorCidade); // Cidade (max 15)

  payload += tlv('62', tlv('05', '***'));  // Dados adicionais

  const toCrc = payload + '6304';
  const crc = crc16ccitt(toCrc);

  return toCrc + crc;
}
```

---

## 3. Arquitetura Proposta

### 3.1 Estrutura de Diretórios

```
backend/
├── pix/                              # NOVO módulo
│   ├── __init__.py
│   ├── santander/
│   │   ├── __init__.py
│   │   ├── client.py                 # Cliente HTTP para API
│   │   ├── auth.py                   # mTLS + OAuth2
│   │   ├── schemas.py                # Request/Response models
│   │   └── exceptions.py             # Exceções específicas
│   ├── emv.py                        # Geração de EMV/QR Code
│   ├── txid.py                       # Geração de TXID
│   ├── service.py                    # Orquestração
│   ├── schemas.py                    # Schemas públicos
│   └── router.py                     # Endpoints opcionais
├── webhooks/                         # FUTURO
│   ├── pix/
│   │   ├── handler.py
│   │   └── validator.py
│   └── router.py
```

### 3.2 Alterações no Banco de Dados

```sql
-- Migration 021: Campos PIX Santander
ALTER TABLE cobrancas
ADD COLUMN IF NOT EXISTS pix_txid VARCHAR(35),
ADD COLUMN IF NOT EXISTS pix_location TEXT,
ADD COLUMN IF NOT EXISTS pix_criado_em TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS pix_expiracao_dias INT DEFAULT 30,
ADD COLUMN IF NOT EXISTS pix_multa_percentual DECIMAL(5,2) DEFAULT 1.00,
ADD COLUMN IF NOT EXISTS pix_juros_mensal_percentual DECIMAL(5,2) DEFAULT 1.00,
ADD COLUMN IF NOT EXISTS pix_e2e_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS pix_pago_em TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS pix_valor_pago DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS pix_status VARCHAR(20);  -- ATIVA, CONCLUIDA, REMOVIDA

CREATE INDEX IF NOT EXISTS idx_cobrancas_pix_txid ON cobrancas(pix_txid);
CREATE INDEX IF NOT EXISTS idx_cobrancas_pix_status ON cobrancas(pix_status);

COMMENT ON COLUMN cobrancas.pix_txid IS 'TXID único da cobrança no Santander (formato MW...)';
COMMENT ON COLUMN cobrancas.pix_location IS 'URL do payload para gerar QR Code';
COMMENT ON COLUMN cobrancas.pix_e2e_id IS 'End-to-end ID quando PIX é pago';
COMMENT ON COLUMN cobrancas.pix_status IS 'Status no Santander: ATIVA, CONCLUIDA, REMOVIDA';
```

### 3.3 Variáveis de Ambiente

```env
# Santander PIX - Credenciais Midwest (centralizado)
SANTANDER_PIX_CLIENT_ID=GyvyrLfNGNEiArXoPPhp5v2KbxtmjySG
SANTANDER_PIX_CLIENT_SECRET=***ENCRYPTED***
SANTANDER_PIX_PFX_PATH=/app/certs/midwest.pfx
SANTANDER_PIX_PFX_PASSWORD=***ENCRYPTED***
SANTANDER_PIX_CHAVE=61902316000163
SANTANDER_PIX_RECEBEDOR_NOME=MIDWEST ENERGIAS LTDA
SANTANDER_PIX_RECEBEDOR_CIDADE=CUIABA

# Configurações de cobrança
PIX_MULTA_PERCENTUAL=1.00
PIX_JUROS_MENSAL_PERCENTUAL=1.00
PIX_VALIDADE_APOS_VENCIMENTO=30

# Webhook (futuro)
PIX_WEBHOOK_URL=https://api.gestorenergy.com.br/webhooks/pix
PIX_WEBHOOK_SECRET=***SECRET***
```

---

## 4. Implementação Detalhada

### 4.1 Autenticação (auth.py)

```python
import httpx
import ssl
from cryptography.hazmat.primitives.serialization import pkcs12
from datetime import datetime, timedelta
import asyncio

class SantanderAuth:
    """Gerencia autenticação mTLS + OAuth2 com Santander."""

    TOKEN_URL = "https://trust-pix.santander.com.br/oauth/token"
    TOKEN_MARGIN_SECONDS = 60  # Renovar 1 min antes de expirar

    def __init__(self, client_id: str, client_secret: str,
                 pfx_path: str, pfx_password: str):
        self.client_id = client_id
        self.client_secret = client_secret
        self.pfx_path = pfx_path
        self.pfx_password = pfx_password
        self._token: str | None = None
        self._expires_at: datetime | None = None
        self._lock = asyncio.Lock()

    def _create_ssl_context(self) -> ssl.SSLContext:
        """Cria contexto SSL com certificado PFX."""
        with open(self.pfx_path, 'rb') as f:
            pfx_data = f.read()

        private_key, certificate, chain = pkcs12.load_key_and_certificates(
            pfx_data,
            self.pfx_password.encode()
        )

        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        # Configurar certificado no contexto
        # ... (detalhes de implementação)
        return ctx

    async def get_token(self) -> str:
        """Obtém token válido, renovando se necessário."""
        async with self._lock:
            if self._is_token_valid():
                return self._token

            await self._refresh_token()
            return self._token

    def _is_token_valid(self) -> bool:
        if not self._token or not self._expires_at:
            return False
        return datetime.now() < self._expires_at - timedelta(seconds=self.TOKEN_MARGIN_SECONDS)

    async def _refresh_token(self):
        """Obtém novo token do Santander."""
        ssl_context = self._create_ssl_context()

        async with httpx.AsyncClient(verify=ssl_context) as client:
            response = await client.post(
                f"{self.TOKEN_URL}?grant_type=client_credentials",
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
            response.raise_for_status()

            data = response.json()
            self._token = data["access_token"]
            expires_in = data.get("expires_in", 300)
            self._expires_at = datetime.now() + timedelta(seconds=expires_in)
```

### 4.2 Cliente PIX (client.py)

```python
from decimal import Decimal
from datetime import date

class SantanderPixClient:
    """Cliente para API PIX Santander."""

    BASE_URL = "https://trust-pix.santander.com.br/api/v1"

    def __init__(self, auth: SantanderAuth):
        self.auth = auth

    async def criar_cobranca_vencimento(
        self,
        txid: str,
        valor: Decimal,
        cpf_devedor: str,
        nome_devedor: str,
        chave_pix: str,
        data_vencimento: date,
        validade_apos_vencimento: int = 30,
        multa_percentual: Decimal = Decimal("1.00"),
        juros_mensal: Decimal = Decimal("1.00"),
        descricao: str = "Cobrança dos serviços prestados."
    ) -> dict:
        """Cria cobrança PIX com vencimento (COBV)."""

        token = await self.auth.get_token()
        ssl_context = self.auth._create_ssl_context()

        payload = {
            "calendario": {
                "dataDeVencimento": data_vencimento.isoformat(),
                "validadeAposVencimento": validade_apos_vencimento
            },
            "devedor": {
                "cpf": cpf_devedor.replace(".", "").replace("-", ""),
                "nome": nome_devedor[:200]  # Limite API
            },
            "valor": {
                "original": f"{valor:.2f}",
                "multa": {"modalidade": "2", "valorPerc": f"{multa_percentual:.2f}"},
                "juros": {"modalidade": "3", "valorPerc": f"{juros_mensal:.2f}"}
            },
            "chave": chave_pix,
            "solicitacaoPagador": descricao[:140]
        }

        async with httpx.AsyncClient(verify=ssl_context) as client:
            response = await client.put(
                f"{self.BASE_URL}/cobv/{txid}",
                json=payload,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json"
                }
            )
            response.raise_for_status()
            return response.json()

    async def consultar_cobranca(self, txid: str) -> dict:
        """Consulta status de uma cobrança."""
        token = await self.auth.get_token()
        ssl_context = self.auth._create_ssl_context()

        async with httpx.AsyncClient(verify=ssl_context) as client:
            response = await client.get(
                f"{self.BASE_URL}/cobv/{txid}",
                headers={"Authorization": f"Bearer {token}"}
            )
            response.raise_for_status()
            return response.json()
```

### 4.3 Geração de TXID (txid.py)

```python
import time
import random
import string
import unicodedata

PREFIX = "MW"
MIN_LEN = 26
MAX_LEN = 35
TARGET_LEN = 32

def _only_digits(s: str) -> str:
    return ''.join(c for c in str(s or '') if c.isdigit())

def _sanitize_name(s: str) -> str:
    """Remove acentos e caracteres especiais, retorna uppercase."""
    if not s:
        return ''
    normalized = unicodedata.normalize('NFD', s)
    ascii_only = ''.join(c for c in normalized if unicodedata.category(c) != 'Mn')
    return ''.join(c for c in ascii_only if c.isalnum()).upper()

def _first_name(full_name: str) -> str:
    parts = _sanitize_name(full_name).split()
    return parts[0][:8] if parts else ''

def _base36_now() -> str:
    """Timestamp atual em base36."""
    return hex(int(time.time() * 1000))[2:].upper()[-6:]

def _rand_base36(n: int) -> str:
    chars = string.ascii_uppercase + string.digits
    return ''.join(random.choices(chars, k=n))

def gerar_txid(nome: str, documento: str, uc: str = None) -> str:
    """
    Gera TXID único para cobrança PIX.

    Formato: MW + doc + nome + timestamp + random
    Tamanho: 26-35 caracteres

    Args:
        nome: Nome completo do devedor
        documento: CPF ou CNPJ
        uc: Código da UC (fallback se documento vazio)

    Returns:
        TXID válido (ex: MW12345678901JOAO1A2B3CXYZ)
    """
    nome_part = _first_name(nome)
    doc_part = _only_digits(documento) or _only_digits(uc) or '000000'
    ts_part = _base36_now()

    core = f"{PREFIX}{doc_part}{nome_part}{ts_part}"
    core = ''.join(c for c in core if c.isalnum()).upper()

    # Preencher até TARGET_LEN
    fill_needed = max(0, TARGET_LEN - len(core))
    core += _rand_base36(fill_needed)

    # Garantir limites
    txid = core[:MAX_LEN]
    if len(txid) < MIN_LEN:
        txid += _rand_base36(MIN_LEN - len(txid))

    return txid
```

### 4.4 Geração de EMV (emv.py)

```python
def _tlv(tag: str, value: str) -> str:
    """Monta TLV (Tag-Length-Value)."""
    return f"{tag}{len(value):02d}{value}"

def _crc16_ccitt(data: str) -> str:
    """Calcula CRC16-CCITT."""
    crc = 0xFFFF
    for char in data:
        crc ^= (ord(char) & 0xFF) << 8
        for _ in range(8):
            if crc & 0x8000:
                crc = ((crc << 1) ^ 0x1021) & 0xFFFF
            else:
                crc = (crc << 1) & 0xFFFF
    return f"{crc:04X}"

def gerar_emv(
    pix_copia_cola: str = None,
    location: str = None,
    valor: str = None,
    recebedor_nome: str = "MIDWEST ENERGIAS LTDA",
    recebedor_cidade: str = "CUIABA"
) -> str:
    """
    Gera string EMV para QR Code PIX.

    Se pix_copia_cola fornecido, retorna diretamente.
    Caso contrário, monta a partir do location.
    """
    if pix_copia_cola:
        return pix_copia_cola.strip()

    if not location:
        raise ValueError("Necessário pixCopiaECola ou location")

    # Sanitizar nome e cidade
    nome = _sanitize_name(recebedor_nome)[:25]
    cidade = _sanitize_name(recebedor_cidade)[:15]

    # Montar MAI (Merchant Account Information)
    loc_capped = location.lower()[:77]
    mai = _tlv('00', 'br.gov.bcb.pix') + _tlv('25', loc_capped)

    # Montar payload
    payload = (
        _tlv('00', '01') +        # Formato
        _tlv('01', '12') +        # QR dinâmico
        _tlv('26', mai) +         # MAI
        _tlv('52', '0000') +      # MCC
        _tlv('53', '986') +       # Moeda BRL
        _tlv('54', valor) +       # Valor
        _tlv('58', 'BR') +        # País
        _tlv('59', nome) +        # Recebedor
        _tlv('60', cidade)        # Cidade
    )

    # Dados adicionais
    payload += _tlv('62', _tlv('05', '***'))

    # Adicionar CRC
    to_crc = payload + '6304'
    crc = _crc16_ccitt(to_crc)

    return to_crc + crc
```

### 4.5 Serviço Principal (service.py)

```python
from backend.pix.santander.client import SantanderPixClient
from backend.pix.santander.auth import SantanderAuth
from backend.pix.txid import gerar_txid
from backend.pix.emv import gerar_emv
from backend.core.database import get_supabase_admin
from backend.config import settings
import qrcode
import base64
from io import BytesIO

class PixService:
    """Serviço de geração de PIX integrado com cobranças."""

    def __init__(self):
        self.auth = SantanderAuth(
            client_id=settings.SANTANDER_PIX_CLIENT_ID,
            client_secret=settings.SANTANDER_PIX_CLIENT_SECRET,
            pfx_path=settings.SANTANDER_PIX_PFX_PATH,
            pfx_password=settings.SANTANDER_PIX_PFX_PASSWORD
        )
        self.client = SantanderPixClient(self.auth)
        self.supabase = get_supabase_admin()

    async def gerar_pix_cobranca(self, cobranca_id: int) -> dict:
        """
        Gera PIX para uma cobrança existente.

        Fluxo:
        1. Buscar cobrança e beneficiário
        2. Gerar TXID único
        3. Criar cobrança via API Santander
        4. Gerar EMV e QR Code
        5. Atualizar cobrança no banco

        Returns:
            {
                "txid": "...",
                "qr_code_pix": "EMV string",
                "qr_code_pix_image": "base64...",
                "location": "...",
                "status": "ATIVA"
            }
        """
        # 1. Buscar cobrança
        cobranca = self.supabase.table("cobrancas").select(
            "*, beneficiarios(nome, cpf)"
        ).eq("id", cobranca_id).single().execute()

        if not cobranca.data:
            raise ValueError(f"Cobrança {cobranca_id} não encontrada")

        data = cobranca.data
        beneficiario = data.get("beneficiarios", {})

        # 2. Gerar TXID
        txid = gerar_txid(
            nome=beneficiario.get("nome", ""),
            documento=beneficiario.get("cpf", "")
        )

        # 3. Criar cobrança no Santander
        resultado = await self.client.criar_cobranca_vencimento(
            txid=txid,
            valor=Decimal(str(data["valor_total"])),
            cpf_devedor=beneficiario.get("cpf", ""),
            nome_devedor=beneficiario.get("nome", ""),
            chave_pix=settings.SANTANDER_PIX_CHAVE,
            data_vencimento=data["vencimento"],
            multa_percentual=Decimal(settings.PIX_MULTA_PERCENTUAL),
            juros_mensal=Decimal(settings.PIX_JUROS_MENSAL_PERCENTUAL)
        )

        # 4. Gerar EMV e QR Code
        emv = gerar_emv(
            pix_copia_cola=resultado.get("pixCopiaECola"),
            location=resultado.get("location"),
            valor=f"{data['valor_total']:.2f}",
            recebedor_nome=settings.SANTANDER_PIX_RECEBEDOR_NOME,
            recebedor_cidade=settings.SANTANDER_PIX_RECEBEDOR_CIDADE
        )

        qr_image_base64 = self._gerar_qrcode_base64(emv)

        # 5. Atualizar cobrança no banco
        self.supabase.table("cobrancas").update({
            "pix_txid": txid,
            "pix_location": resultado.get("location"),
            "pix_status": resultado.get("status", "ATIVA"),
            "pix_criado_em": datetime.now(timezone.utc).isoformat(),
            "qr_code_pix": emv,
            "qr_code_pix_image": qr_image_base64
        }).eq("id", cobranca_id).execute()

        return {
            "txid": txid,
            "qr_code_pix": emv,
            "qr_code_pix_image": qr_image_base64,
            "location": resultado.get("location"),
            "status": resultado.get("status", "ATIVA")
        }

    def _gerar_qrcode_base64(self, emv: str) -> str:
        """Gera imagem QR Code em base64."""
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4
        )
        qr.add_data(emv)
        qr.make(fit=True)

        img = qr.make_image(fill_color="black", back_color="white")
        buffer = BytesIO()
        img.save(buffer, format='PNG')
        return base64.b64encode(buffer.getvalue()).decode()

    async def consultar_status(self, cobranca_id: int) -> dict:
        """Consulta status atual do PIX no Santander."""
        cobranca = self.supabase.table("cobrancas").select(
            "pix_txid"
        ).eq("id", cobranca_id).single().execute()

        if not cobranca.data or not cobranca.data.get("pix_txid"):
            raise ValueError("Cobrança sem PIX gerado")

        resultado = await self.client.consultar_cobranca(cobranca.data["pix_txid"])

        # Atualizar status no banco
        self.supabase.table("cobrancas").update({
            "pix_status": resultado.get("status")
        }).eq("id", cobranca_id).execute()

        return resultado

# Singleton
pix_service = PixService()
```

---

## 5. Integração com Fluxo Existente

### 5.1 Modificar `aprovar_cobranca`

```python
# backend/cobrancas/service.py

async def aprovar_cobranca(self, cobranca_id, enviar_email, user_id, perfis):
    """Aprova cobrança e gera PIX Santander."""

    # ... validações existentes ...

    # NOVO: Gerar PIX antes de mudar status
    from backend.pix.service import pix_service

    try:
        pix_data = await pix_service.gerar_pix_cobranca(cobranca_id)
        logger.info(f"PIX gerado para cobrança {cobranca_id}: TXID={pix_data['txid']}")

    except Exception as e:
        logger.error(f"Erro ao gerar PIX para cobrança {cobranca_id}: {e}")
        raise ValidationError(f"Falha ao gerar PIX: {str(e)}")

    # Atualizar para EMITIDA (PIX já atualizado pelo service)
    self.supabase.table("cobrancas").update({
        "status": "EMITIDA",
        "vencimento_editavel": False
    }).eq("id", cobranca_id).execute()

    # ... resto do método (email, etc) ...
```

---

## 6. Checklist de Implementação

### Fase 1: Infraestrutura
- [ ] Criar estrutura `backend/pix/`
- [ ] Implementar `txid.py` - Geração de TXID
- [ ] Implementar `emv.py` - Geração de EMV/QR Code
- [ ] Adicionar dependência `qrcode` no requirements.txt
- [ ] Adicionar dependência `cryptography` (para PFX)

### Fase 2: Cliente Santander
- [ ] Implementar `auth.py` - mTLS + OAuth2
- [ ] Implementar `client.py` - Criar/Consultar cobrança
- [ ] Criar `schemas.py` - Modelos Pydantic
- [ ] Criar `exceptions.py` - Exceções específicas
- [ ] Testes com mocks

### Fase 3: Integração
- [ ] Criar migration para novos campos
- [ ] Implementar `service.py`
- [ ] Modificar `aprovar_cobranca` para gerar PIX
- [ ] Atualizar `report_generator_v3.py` para novo PIX

### Fase 4: Configuração
- [ ] Definir path do certificado PFX
- [ ] Configurar variáveis de ambiente
- [ ] Documentar processo de renovação do certificado

### Fase 5: Testes em Produção
- [ ] Testar geração de PIX real
- [ ] Validar QR Code em apps bancários
- [ ] Testar fluxo completo

### Fase 6: Webhook (Futuro)
- [ ] Endpoint para receber notificações
- [ ] Validação de assinatura
- [ ] Atualização automática de status

---

## 7. Certificado PFX

### Localização Recomendada

```
/app/certs/
├── midwest.pfx          # Certificado atual
└── midwest_backup.pfx   # Backup antes de renovar
```

### Permissões

```bash
chmod 600 /app/certs/midwest.pfx
chown app:app /app/certs/midwest.pfx
```

### Renovação

O certificado A1 expira em 1 ano. Criar alerta para renovação 30 dias antes.

---

## 8. Próximos Passos Imediatos

1. **Aguardar collection Postman** - Validar endpoints e payloads
2. **Definir path do certificado** - Onde será armazenado em produção?
3. **Iniciar implementação** - Começar pelo `txid.py` e `emv.py` (sem dependência externa)

---

*Documento criado em: 2025-12-22*
*Última atualização: 2025-12-22*
*Baseado no código n8n em produção*
