# API Energisa - Documentação Completa

> Módulo de integração com o portal da Energisa para consulta de UCs, faturas, geração distribuída e simulação de economia.

**Prefixo:** `/energisa`
**Autenticação:** JWT Bearer Token (exceto endpoints de simulação pública)

---

## Índice

1. [Autenticação (Login)](#1-autenticação-login)
2. [Unidades Consumidoras (UCs)](#2-unidades-consumidoras-ucs)
3. [Faturas](#3-faturas)
4. [Geração Distribuída (GD)](#4-geração-distribuída-gd)
5. [Simulação Pública](#5-simulação-pública)
6. [Modelos de Dados](#6-modelos-de-dados)
7. [Calculadora de Economia](#7-calculadora-de-economia)
8. [Integração ANEEL](#8-integração-aneel)
9. [Gerenciamento de Sessões](#9-gerenciamento-de-sessões)
10. [Códigos de Erro](#10-códigos-de-erro)

---

## 1. Autenticação (Login)

O login na Energisa é feito em 3 etapas via automação de navegador (Playwright).

### POST `/energisa/login/start`

Inicia o processo de login e retorna lista de telefones/emails para verificação SMS.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "cpf": "123.456.789-00"
}
```

**Response 200:**
```json
{
  "transaction_id": "12345678900_1703275200",
  "listaTelefone": [
    {
      "celular": "(**) *****-1234",
      "cdc": 0,
      "posicao": 1
    }
  ],
  "listaEmail": [
    {
      "email": "e***@gmail.com",
      "codigoEmpresaWeb": 6,
      "cdc": 0,
      "digitoVerificador": 0,
      "posicao": 0
    }
  ]
}
```

---

### POST `/energisa/login/select-option`

Seleciona o telefone/email para receber o código SMS.

**Request Body:**
```json
{
  "transaction_id": "12345678900_1703275200",
  "opcao_selecionada": "(**) *****-1234"
}
```

**Response 200:**
```json
{
  "message": "SMS enviado com sucesso"
}
```

---

### POST `/energisa/login/finish`

Finaliza o login com o código SMS recebido.

**Request Body:**
```json
{
  "transaction_id": "12345678900_1703275200",
  "sms_code": "123456"
}
```

**Response 200:**
```json
{
  "success": true,
  "tokens": ["accessTokenEnergisa", "udk", "rtk"],
  "message": "Login OK"
}
```

---

## 2. Unidades Consumidoras (UCs)

### POST `/energisa/ucs`

Lista todas as UCs vinculadas ao CPF com informações enriquecidas de GD.

**Request Body:**
```json
{
  "cpf": "12345678900",
  "codigoEmpresaWeb": 6
}
```

**Response 200:**
```json
[
  {
    "numeroUc": 1234567,
    "digitoVerificador": 8,
    "codigoEmpresaWeb": 6,
    "endereco": "RUA EXEMPLO, 123",
    "cidade": "CUIABÁ",
    "ucAtiva": true,
    "isGD": true,
    "gdInfo": {
      "possuiGD": true,
      "ucGeradora": false,
      "tipoGD": "BENEFICIARIA",
      "percentualCompensacao": 100
    },
    "badge": {
      "tipo": "gd",
      "texto": "Geração Distribuída",
      "cor": "green"
    }
  }
]
```

**Campos Enriquecidos:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `isGD` | boolean | Se a UC participa de Geração Distribuída |
| `gdInfo` | object | Detalhes da GD (se aplicável) |
| `badge` | object | Badge de status visual |
| `badges` | array | Múltiplos badges (quando aplicável) |

---

### POST `/energisa/ucs/info`

Busca informações cadastrais detalhadas de uma UC específica.

**Request Body:**
```json
{
  "cpf": "12345678900",
  "codigoEmpresaWeb": 6,
  "cdc": 1234567,
  "digitoVerificadorCdc": 8
}
```

**Response 200:**
```json
{
  "errored": false,
  "infos": {
    "dadosInstalacao": {
      "tipoLigacao": "BIFASICO",
      "grupoLeitura": "B",
      "classeConsumo": "RESIDENCIAL"
    },
    "dadosTitular": {
      "nome": "FULANO DE TAL",
      "cpfCnpj": "***456789**"
    },
    "endereco": {
      "logradouro": "RUA EXEMPLO",
      "numero": "123",
      "cidade": "CUIABÁ",
      "uf": "MT"
    }
  }
}
```

---

## 3. Faturas

### POST `/energisa/faturas/listar`

Lista faturas de uma UC específica.

**Request Body:**
```json
{
  "cpf": "12345678900",
  "codigoEmpresaWeb": 6,
  "cdc": 1234567,
  "digitoVerificadorCdc": 8
}
```

**Response 200:**
```json
[
  {
    "anoReferencia": 2024,
    "mesReferencia": 12,
    "numeroFatura": 123456789,
    "dataVencimento": "2024-12-15",
    "valorFatura": 245.67,
    "consumo": 350,
    "leituraAtual": 12500,
    "leituraAnterior": 12150,
    "bandeiraTarifaria": "VERDE",
    "iluminacaoPublica": 15.50,
    "situacao": "ABERTA"
  }
]
```

---

### POST `/energisa/faturas/pdf`

Baixa o PDF de uma fatura específica.

**Request Body:**
```json
{
  "cpf": "12345678900",
  "codigoEmpresaWeb": 6,
  "cdc": 1234567,
  "digitoVerificadorCdc": 8,
  "ano": 2024,
  "mes": 12,
  "numeroFatura": 123456789
}
```

**Response 200:**
```json
{
  "filename": "fatura_1234567_12-2024.pdf",
  "content_type": "application/pdf",
  "file_base64": "JVBERi0xLjQKJeLjz9MKMSAwIG9..."
}
```

---

## 4. Geração Distribuída (GD)

### POST `/energisa/gd/info`

Busca informações de Geração Distribuída da UC.

**Request Body:**
```json
{
  "cpf": "12345678900",
  "codigoEmpresaWeb": 6,
  "cdc": 1234567,
  "digitoVerificadorCdc": 8
}
```

**Response 200:**
```json
{
  "errored": false,
  "infos": {
    "possuiGD": true,
    "ucGeradora": true,
    "tipoGD": "AUTOCONSUMO_REMOTO",
    "percentualCompensacao": 100,
    "tipoCompartilhamento": "AR"
  }
}
```

---

### POST `/energisa/gd/details`

Busca histórico detalhado de créditos e geração (últimos 13 meses).

**Request Body:**
```json
{
  "cpf": "12345678900",
  "codigoEmpresaWeb": 6,
  "cdc": 1234567,
  "digitoVerificadorCdc": 8
}
```

**Response 200:**
```json
{
  "errored": false,
  "infos": [
    {
      "mesReferencia": "12/2024",
      "energiaInjetada": 450.5,
      "energiaConsumida": 320.0,
      "creditoGerado": 130.5,
      "creditoUtilizado": 100.0,
      "saldoCreditos": 500.0,
      "creditoExpirar60Dias": 50.0
    }
  ]
}
```

---

### POST `/energisa/gd/alterar-beneficiaria`

Realiza alteração das UCs beneficiárias do rateio de créditos.

**Request Body:**
```json
{
  "cpf": "12345678900",
  "codigoEmpresaWeb": 6,
  "cdc": 1234567,
  "digitoVerificador": 8,
  "cpfCnpj": "12345678900",
  "aceiteTermosAltaDistribuicao": true,
  "tipoCompartilhamento": "AR",
  "percentualCompensacao": 100,
  "beneficiarias": [
    {
      "codigoEmpresaWeb": 6,
      "cdc": 7654321,
      "digitoVerificador": 5,
      "percentualDistribuicao": 50.0
    }
  ],
  "anexos": {
    "documento1": "base64_do_anexo"
  }
}
```

**Response 200:**
```json
{
  "errored": false,
  "message": "Solicitação de alteração enviada com sucesso",
  "protocolo": "2024123456789"
}
```

---

## 5. Simulação Pública

Endpoints públicos para a landing page (não requerem autenticação JWT).

### POST `/energisa/simulacao/iniciar`

Inicia simulação pública.

**Request Body:**
```json
{
  "cpf": "12345678900"
}
```

**Response 200:**
```json
{
  "transaction_id": "pub_12345678900_1703275200",
  "listaTelefone": [...],
  "listaEmail": [...]
}
```

---

### POST `/energisa/simulacao/enviar-sms`

Envia SMS para telefone selecionado.

**Request Body:**
```json
{
  "transactionId": "pub_12345678900_1703275200",
  "telefone": "(**) *****-1234"
}
```

---

### POST `/energisa/simulacao/validar-sms`

Valida código SMS.

**Request Body:**
```json
{
  "sessionId": "pub_12345678900_1703275200",
  "codigo": "123456"
}
```

---

### GET `/energisa/simulacao/ucs/{session_id}`

Busca UCs após autenticação.

**Response 200:**
```json
{
  "success": true,
  "ucs": [...]
}
```

---

### GET `/energisa/simulacao/faturas/{session_id}/{codigo_uc}`

Busca faturas com cálculo de economia completo.

**Response 200:**
```json
{
  "success": true,
  "faturas": [...],
  "uc_info": {
    "tipo_ligacao": "BIFASICO",
    "grupo_leitura": "B"
  },
  "faturas_resumo": {
    "consumo_kwh": 350,
    "total_pago_12_meses": 2940.00,
    "iluminacao_publica": 15.50,
    "tem_bandeira_vermelha": false
  },
  "calculo_economia": {
    "custo_energisa_consumo": 280.00,
    "valor_midwest_consumo": 196.00,
    "economia": {
      "mensal": 84.00,
      "anual": 1008.00,
      "faturas_economizadas_ano": 5.1
    }
  },
  "projecao_10_anos": [
    {
      "ano": 1,
      "custo_energisa": 3360.00,
      "valor_midwest": 2352.00,
      "economia_anual": 1008.00,
      "economia_acumulada": 1008.00
    }
  ],
  "total_pago_12_meses": 2940.00
}
```

---

## 6. Modelos de Dados

### LoginStartRequest
```python
class LoginStartRequest(BaseModel):
    cpf: str
```

### UcRequest
```python
class UcRequest(BaseModel):
    cpf: str
    codigoEmpresaWeb: Optional[int] = 6
    cdc: Optional[int] = None
    digitoVerificadorCdc: Optional[int] = None
```

### FaturaRequest
```python
class FaturaRequest(UcRequest):
    ano: int
    mes: int
    numeroFatura: int
```

### BeneficiariaItem
```python
class BeneficiariaItem(BaseModel):
    codigoEmpresaWeb: int
    cdc: int
    digitoVerificador: int
    percentualDistribuicao: float
```

### AlteracaoGdRequest
```python
class AlteracaoGdRequest(BaseModel):
    cpf: str
    codigoEmpresaWeb: int
    cdc: int
    digitoVerificador: int
    cpfCnpj: str
    aceiteTermosAltaDistribuicao: bool
    tipoCompartilhamento: str = "AR"
    percentualCompensacao: Optional[int] = 100
    beneficiarias: List[BeneficiariaItem]
    anexos: Dict[str, str]
```

---

## 7. Calculadora de Economia

### Funções Disponíveis

#### `calcular_economia_mensal()`

Calcula economia mensal comparando conta atual vs Midwest.

**Parâmetros:**
| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `consumo_kwh` | float | Consumo médio mensal em kWh |
| `tipo_ligacao` | str | MONOFASICO, BIFASICO ou TRIFASICO |
| `iluminacao_publica` | float | Valor da CIP em R$ |
| `tem_bandeira_vermelha` | bool | Se aplica bandeira vermelha |
| `tarifa_b1_kwh_com_impostos` | float | Tarifa B1 COM impostos |
| `fiob_base_kwh` | float | Fio B base SEM impostos |

**Retorno:**
```python
{
    "custo_energisa_consumo": 280.00,      # Apenas consumo × tarifa
    "valor_midwest_consumo": 196.00,       # Consumo × tarifa com 30% desconto
    "economia": {
        "mensal": 84.00,
        "anual": 1008.00,
        "faturas_economizadas_ano": 5.1
    },
    "conta_atual": {
        "energia": 280.00,
        "iluminacao_publica": 15.50,
        "bandeira": 0.00,
        "total": 295.50
    },
    "conta_midwest": {
        "energia_com_desconto": 196.00,
        "piso_regulatorio": 45.00,
        "iluminacao_publica": 15.50,
        "total": 256.50
    }
}
```

---

#### `calcular_projecao_10_anos()`

Projeta economia para 10 anos com reajuste anual de 8%.

**Retorno:**
```python
[
    {"ano": 1, "custo_energisa": 3360, "valor_midwest": 2352, "economia_anual": 1008, "economia_acumulada": 1008},
    {"ano": 2, "custo_energisa": 3629, "valor_midwest": 2540, "economia_anual": 1089, "economia_acumulada": 2097},
    ...
]
```

---

### Constantes Utilizadas

| Constante | Valor | Descrição |
|-----------|-------|-----------|
| `PIS_COFINS` | 6.7845% | PIS + COFINS |
| `ICMS` | 17% | ICMS |
| `DESCONTO_MIDWEST` | 30% | Desconto sobre tarifa |
| `REAJUSTE_ANUAL` | 8% | Reajuste para projeção |
| `BANDEIRA_VERMELHA_P1` | R$ 0,0446/kWh | Bandeira vermelha patamar 1 |

**Taxa Mínima por Tipo de Ligação:**
| Tipo | kWh/mês |
|------|---------|
| Monofásico | 30 |
| Bifásico | 50 |
| Trifásico | 100 |

**Fio B Escalonado:**
| Ano | Percentual |
|-----|------------|
| 2023 | 15% |
| 2024 | 30% |
| 2025 | 45% |
| 2026 | 60% |
| 2027 | 75% |
| 2028+ | 90% |

---

## 8. Integração ANEEL

### API de Dados Abertos

O módulo consulta tarifas em tempo real da API ANEEL:

**URL Base:** `https://dadosabertos.aneel.gov.br/api/3/action/datastore_search`

### `buscar_tarifa_b1(sigla_agente)`

Busca tarifa B1 Residencial Convencional.

**Retorno:**
```python
{
    "tusd_kwh": 0.25000,
    "te_kwh": 0.33500,
    "total_kwh": 0.58500,  # SEM impostos
    "vigencia_inicio": "2024-04-01",
    "vigencia_fim": "2025-03-31",
    "resolucao": "REH 3.440/2024"
}
```

### `buscar_fiob(sigla_agente)`

Busca componente Fio B.

**Retorno:**
```python
{
    "valor_kwh": 0.18500,  # SEM impostos
    "vigencia_inicio": "2024-04-01",
    "vigencia_fim": "2025-03-31"
}
```

### `get_tarifas_com_fallback(sigla_agente)`

Busca tarifas com fallback para valores hardcoded caso a API falhe.

---

## 9. Gerenciamento de Sessões

### SessionManager

Gerencia sessões da Energisa no banco de dados Supabase.

**Tabela:** `sessoes_energisa`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `cpf` | VARCHAR | CPF (chave primária) |
| `cookies` | JSONB | Cookies da sessão |
| `atualizado_em` | TIMESTAMPTZ | Última atualização |

### Métodos

#### `save_session(cpf, cookies)`
Salva/atualiza sessão no banco (upsert).

#### `load_session(cpf)`
Carrega sessão se válida (máx 24 horas).

#### `delete_session(cpf)`
Remove sessão do banco.

#### `session_exists(cpf)`
Verifica se existe sessão válida.

**Tempo máximo de sessão:** 24 horas

---

## 10. Códigos de Erro

| Código | Descrição | Ação Recomendada |
|--------|-----------|------------------|
| 400 | Dados inválidos | Verificar payload |
| 401 | Não autenticado / Token expirado | Fazer login novamente |
| 404 | Sessão não encontrada | Iniciar nova sessão |
| 500 | Erro interno / Timeout | Tentar novamente |

### Erros Específicos

| Erro | Causa | Solução |
|------|-------|---------|
| "Não autenticado na Energisa" | Sessão expirada | Refazer login |
| "Campo CPF não encontrado" | Layout da Energisa mudou | Atualizar seletores |
| "Bloqueio WAF detectado" | Akamai bloqueou acesso | Aguardar ou usar proxy |
| "Timeout aguardando lista de telefones" | Servidor lento | Aumentar timeout |
| "Falha ao capturar tokens" | Login interrompido | Refazer login |

---

## Arquitetura do Módulo

```
backend/energisa/
├── __init__.py          # Exports
├── router.py            # Endpoints FastAPI (este arquivo)
├── service.py           # EnergisaService - lógica de integração
├── session_manager.py   # Gerenciamento de sessões
├── calculadora.py       # Cálculos de economia
├── aneel_api.py         # Integração com API ANEEL
└── constants.py         # Constantes (tarifas, impostos, etc.)
```

---

## Fluxo de Autenticação

```
┌─────────────┐    ┌──────────────┐    ┌──────────────┐
│ login/start │───►│ select-option│───►│ login/finish │
└─────────────┘    └──────────────┘    └──────────────┘
       │                  │                   │
       ▼                  ▼                   ▼
  Abre browser      Seleciona tel       Digita SMS
  Digita CPF        Envia SMS           Captura tokens
  Lista telefones   Aguarda             Salva sessão
```

---

## Exemplos de Uso

### Fluxo Completo de Simulação

```python
# 1. Iniciar simulação
POST /energisa/simulacao/iniciar
{"cpf": "12345678900"}

# 2. Enviar SMS
POST /energisa/simulacao/enviar-sms
{"transactionId": "pub_xxx", "telefone": "(**) *****-1234"}

# 3. Validar SMS
POST /energisa/simulacao/validar-sms
{"sessionId": "pub_xxx", "codigo": "123456"}

# 4. Buscar UCs
GET /energisa/simulacao/ucs/pub_xxx

# 5. Calcular economia
GET /energisa/simulacao/faturas/pub_xxx/1234567
```

### Consulta de Faturas (Autenticado)

```python
# 1. Login
POST /energisa/login/start
POST /energisa/login/select-option
POST /energisa/login/finish

# 2. Listar UCs
POST /energisa/ucs

# 3. Listar faturas
POST /energisa/faturas/listar

# 4. Baixar PDF
POST /energisa/faturas/pdf
```

---

*Documentação gerada automaticamente pelo Claude Code*
*Última atualização: Dezembro 2024*
