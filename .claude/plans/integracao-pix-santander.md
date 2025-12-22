# Plano de Implementação: Integração PIX Santander

> **Objetivo:** Integrar a API PIX do Santander para geração automática de cobranças PIX com vencimento, multa e juros.

---

## 1. Contexto Atual

### 1.1 Estrutura Existente

**Tabela `cobrancas`** já possui campos para PIX:
- `qr_code_pix` - Código copia-e-cola
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

---

## 2. Arquitetura Proposta

### 2.1 Novos Componentes

```
backend/
├── pix/                          # NOVO módulo
│   ├── __init__.py
│   ├── santander/
│   │   ├── __init__.py
│   │   ├── client.py            # Cliente HTTP para API Santander
│   │   ├── auth.py              # Autenticação OAuth2 + mTLS (certificado PFX)
│   │   ├── schemas.py           # Modelos de request/response
│   │   └── exceptions.py        # Exceções específicas
│   ├── service.py               # Serviço principal de PIX
│   ├── schemas.py               # Schemas Pydantic
│   └── router.py                # Endpoints (se necessário)
├── webhooks/                     # FUTURO
│   ├── __init__.py
│   ├── pix/
│   │   ├── handler.py           # Handler do webhook PIX
│   │   └── validator.py         # Validação de assinatura
│   └── router.py
```

### 2.2 Alterações no Banco de Dados

Nova migration para adicionar campos PIX Santander:

```sql
-- Migration: Campos PIX Santander na tabela cobrancas
ALTER TABLE cobrancas
ADD COLUMN IF NOT EXISTS pix_txid VARCHAR(35),           -- TXID gerado pelo Santander
ADD COLUMN IF NOT EXISTS pix_location TEXT,              -- URL do payload PIX
ADD COLUMN IF NOT EXISTS pix_criado_em TIMESTAMPTZ,      -- Data de criação do PIX
ADD COLUMN IF NOT EXISTS pix_expiracao INT,              -- Segundos até expirar
ADD COLUMN IF NOT EXISTS pix_multa_percentual DECIMAL(5,2),   -- % de multa
ADD COLUMN IF NOT EXISTS pix_juros_percentual DECIMAL(5,2),   -- % de juros ao mês
ADD COLUMN IF NOT EXISTS pix_e2e_id VARCHAR(100),        -- End-to-end ID (confirmação)
ADD COLUMN IF NOT EXISTS pix_pago_em TIMESTAMPTZ,        -- Quando foi pago via webhook
ADD COLUMN IF NOT EXISTS pix_valor_pago DECIMAL(10,2);   -- Valor efetivamente pago

CREATE INDEX IF NOT EXISTS idx_cobrancas_pix_txid ON cobrancas(pix_txid);
CREATE INDEX IF NOT EXISTS idx_cobrancas_pix_e2e_id ON cobrancas(pix_e2e_id);

COMMENT ON COLUMN cobrancas.pix_txid IS 'Identificador único da cobrança PIX no Santander';
COMMENT ON COLUMN cobrancas.pix_location IS 'URL do payload PIX (para gerar QR Code)';
COMMENT ON COLUMN cobrancas.pix_e2e_id IS 'End-to-end ID retornado quando o PIX é pago';
```

Nova tabela para configurações PIX:

```sql
-- Tabela de configuração PIX por usina/gestor
CREATE TABLE IF NOT EXISTS configuracoes_pix (
    id SERIAL PRIMARY KEY,
    usina_id INT REFERENCES usinas(id),

    -- Configurações Santander
    client_id VARCHAR(100) NOT NULL,
    client_secret_encrypted TEXT NOT NULL,     -- Encrypted
    certificado_pfx_path VARCHAR(500),         -- Path do arquivo PFX
    certificado_senha_encrypted TEXT,          -- Senha do PFX (encrypted)
    chave_pix VARCHAR(100) NOT NULL,           -- Chave PIX recebedora

    -- Configurações de cobrança
    multa_percentual DECIMAL(5,2) DEFAULT 2.00,
    juros_mensal_percentual DECIMAL(5,2) DEFAULT 1.00,
    dias_expiracao INT DEFAULT 30,

    -- Webhook
    webhook_url TEXT,
    webhook_secret TEXT,

    ativo BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 3. Fluxo de Implementação

### Fase 1: Cliente API Santander (Prioridade Alta)

**Objetivo:** Criar cliente HTTP para comunicação com API PIX Santander

#### 3.1.1 Autenticação mTLS + OAuth2

```python
# backend/pix/santander/auth.py

class SantanderAuth:
    """
    Gerencia autenticação com API Santander.

    Fluxo:
    1. Carrega certificado PFX
    2. Obtém access_token via OAuth2 (client_credentials)
    3. Renova token automaticamente antes de expirar
    """

    def __init__(self, client_id, client_secret, pfx_path, pfx_password):
        self.client_id = client_id
        self.client_secret = client_secret
        self.pfx_path = pfx_path
        self.pfx_password = pfx_password
        self._access_token = None
        self._token_expires_at = None

    def get_ssl_context(self):
        """Cria contexto SSL com certificado mTLS."""
        pass

    async def get_access_token(self):
        """Obtém ou renova access token."""
        pass
```

#### 3.1.2 Cliente PIX

```python
# backend/pix/santander/client.py

class SantanderPixClient:
    """
    Cliente para API PIX Santander.

    Endpoints:
    - POST /cob/{txid} - Criar cobrança
    - GET /cob/{txid} - Consultar cobrança
    - PATCH /cob/{txid} - Atualizar cobrança
    - DELETE /cob/{txid} - Cancelar cobrança
    """

    BASE_URL = "https://pix.santander.com.br/api/v2"  # Produção
    # BASE_URL_SANDBOX = "https://pix-h.santander.com.br/api/v2"  # Homologação

    async def criar_cobranca(
        self,
        txid: str,
        valor: Decimal,
        cpf_devedor: str,
        nome_devedor: str,
        chave_pix: str,
        vencimento: date,
        multa_percentual: Decimal = Decimal("2.00"),
        juros_mensal: Decimal = Decimal("1.00"),
        descricao: str = None
    ) -> CobrancaCriadaResponse:
        """Cria cobrança PIX com vencimento."""
        pass

    async def consultar_cobranca(self, txid: str) -> CobrancaResponse:
        """Consulta status de uma cobrança."""
        pass

    async def cancelar_cobranca(self, txid: str) -> bool:
        """Cancela uma cobrança PIX."""
        pass
```

### Fase 2: Serviço PIX (Prioridade Alta)

**Objetivo:** Orquestrar geração de PIX integrado com cobranças

```python
# backend/pix/service.py

class PixService:
    """Serviço de alto nível para geração de PIX."""

    async def gerar_pix_cobranca(
        self,
        cobranca_id: int,
        usina_id: int
    ) -> dict:
        """
        Gera PIX para uma cobrança existente.

        Fluxo:
        1. Buscar cobrança e beneficiário
        2. Buscar configuração PIX da usina
        3. Gerar TXID único
        4. Criar cobrança via API Santander
        5. Salvar TXID, QR Code e location na cobrança
        6. Atualizar status para EMITIDA

        Returns:
            {
                "txid": "...",
                "qr_code": "...",
                "qr_code_image": "base64...",
                "location": "...",
                "vencimento": "..."
            }
        """
        pass

    async def consultar_status_pix(self, cobranca_id: int) -> dict:
        """Consulta status atual do PIX no Santander."""
        pass

    async def cancelar_pix(self, cobranca_id: int) -> bool:
        """Cancela PIX e atualiza cobrança."""
        pass

    def _gerar_txid(self, cobranca_id: int) -> str:
        """
        Gera TXID único para a cobrança.
        Formato sugerido: GE{cobranca_id:010d}{timestamp_hex}
        Máximo 35 caracteres.
        """
        pass
```

### Fase 3: Integração com Fluxo de Cobranças (Prioridade Alta)

**Objetivo:** Integrar geração de PIX no fluxo existente

#### 3.3.1 Alterações em `CobrancasService`

Modificar método `aprovar_cobranca`:

```python
# backend/cobrancas/service.py

async def aprovar_cobranca(self, cobranca_id, enviar_email, user_id, perfis):
    """
    Aprova cobrança e gera PIX.

    Fluxo atualizado:
    1. Validar que cobrança está em RASCUNHO
    2. Gerar PIX via PixService  # NOVO
    3. Atualizar cobrança com dados do PIX
    4. Mudar status para EMITIDA
    5. Enviar email (se solicitado)
    """
    # ... código existente ...

    # NOVO: Gerar PIX Santander
    from backend.pix.service import pix_service

    try:
        pix_data = await pix_service.gerar_pix_cobranca(
            cobranca_id=cobranca_id,
            usina_id=usina_id
        )

        # Atualizar cobrança com dados do PIX
        update_data["qr_code_pix"] = pix_data["qr_code"]
        update_data["qr_code_pix_image"] = pix_data["qr_code_image"]
        update_data["pix_txid"] = pix_data["txid"]
        update_data["pix_location"] = pix_data["location"]
        update_data["pix_criado_em"] = datetime.now(timezone.utc)

    except Exception as e:
        logger.error(f"Erro ao gerar PIX: {e}")
        # Decidir: falhar aprovação ou aprovar sem PIX?
        raise ValidationError(f"Erro ao gerar PIX: {str(e)}")
```

### Fase 4: Configuração e Segurança (Prioridade Média)

#### 3.4.1 Variáveis de Ambiente

```env
# .env

# Santander PIX API
SANTANDER_PIX_CLIENT_ID=seu_client_id
SANTANDER_PIX_CLIENT_SECRET=sua_secret
SANTANDER_PIX_PFX_PATH=/path/to/certificado.pfx
SANTANDER_PIX_PFX_PASSWORD=senha_do_pfx
SANTANDER_PIX_CHAVE=sua_chave_pix
SANTANDER_PIX_AMBIENTE=producao  # ou homologacao

# Webhook (futuro)
PIX_WEBHOOK_URL=https://api.gestorenergy.com.br/webhooks/pix
PIX_WEBHOOK_SECRET=secret_para_validacao
```

#### 3.4.2 Criptografia de Credenciais

```python
# backend/core/crypto.py

from cryptography.fernet import Fernet

def encrypt_secret(value: str, key: bytes) -> str:
    """Criptografa valor sensível."""
    pass

def decrypt_secret(encrypted: str, key: bytes) -> str:
    """Descriptografa valor sensível."""
    pass
```

---

## 4. API Santander - Referência

### 4.1 Endpoints Utilizados

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/oauth/token` | Obter access token |
| PUT | `/cob/{txid}` | Criar cobrança com vencimento |
| GET | `/cob/{txid}` | Consultar cobrança |
| PATCH | `/cob/{txid}` | Atualizar cobrança |

### 4.2 Payload de Criação de Cobrança

```json
{
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
    "multa": {
      "modalidade": 2,
      "valorPerc": "2.00"
    },
    "juros": {
      "modalidade": 2,
      "valorPerc": "1.00"
    }
  },
  "chave": "sua-chave-pix",
  "solicitacaoPagador": "Cobrança referente a energia - 01/2025"
}
```

### 4.3 Resposta da Criação

```json
{
  "txid": "GE00000001234abcdef",
  "revisao": 0,
  "loc": {
    "id": 123456,
    "location": "pix.santander.com.br/qr/v2/..."
  },
  "status": "ATIVA",
  "calendario": {
    "criacao": "2025-01-01T10:00:00Z",
    "dataDeVencimento": "2025-01-15",
    "validadeAposVencimento": 30
  },
  "pixCopiaECola": "00020126...5802BR..."
}
```

---

## 5. Checklist de Implementação

### Fase 1: Fundação (1-2 dias)
- [ ] Criar estrutura de diretórios `backend/pix/`
- [ ] Implementar `SantanderAuth` (mTLS + OAuth2)
- [ ] Implementar `SantanderPixClient` (criar, consultar, cancelar)
- [ ] Criar schemas Pydantic para request/response
- [ ] Testes unitários com mocks

### Fase 2: Integração (1-2 dias)
- [ ] Criar migration para novos campos
- [ ] Implementar `PixService`
- [ ] Criar tabela `configuracoes_pix`
- [ ] Integrar com `aprovar_cobranca`
- [ ] Atualizar regeneração de HTML do relatório

### Fase 3: UI/Frontend (1 dia)
- [ ] Exibir QR Code e copia-cola na tela de cobrança
- [ ] Botão "Consultar Status PIX"
- [ ] Indicador visual de status do PIX

### Fase 4: Testes e Homologação (1-2 dias)
- [ ] Testar em ambiente sandbox Santander
- [ ] Validar geração de QR Code
- [ ] Testar fluxo completo: criar → consultar → simular pagamento
- [ ] Documentar erros e edge cases

### Fase 5: Webhook (Futuro)
- [ ] Criar endpoint `POST /webhooks/pix`
- [ ] Validar assinatura do Santander
- [ ] Atualizar cobrança quando pago
- [ ] Enviar notificação ao beneficiário

---

## 6. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Certificado expirar | Média | Alto | Alerta 30 dias antes |
| API Santander fora | Baixa | Alto | Retry com backoff, status "PIX_PENDENTE" |
| Token OAuth expirar durante request | Média | Médio | Renovação automática antes de expirar |
| Webhook não chegar | Média | Médio | Consulta periódica + reconciliação manual |

---

## 7. Cronograma Sugerido

| Fase | Atividade | Dependência |
|------|-----------|-------------|
| 1 | Cliente API Santander | - |
| 2 | Serviço PIX + Migrations | Fase 1 |
| 3 | Integração com Cobranças | Fase 2 |
| 4 | Testes em Sandbox | Fase 3 |
| 5 | Deploy em Produção | Fase 4 |
| 6 | Webhook (futuro) | Fase 5 |

---

## 8. Próximos Passos

1. **Obter credenciais Santander** - client_id, client_secret, certificado PFX
2. **Configurar ambiente sandbox** - Testar antes de produção
3. **Iniciar Fase 1** - Implementar cliente de autenticação

---

*Documento criado em: 2025-12-22*
*Última atualização: 2025-12-22*
