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

Lista todas as UCs vinculadas ao CPF.

**Request Body:**
```json
{
  "cpf": "12345678900",
  "codigoEmpresaWeb": 6
}
```

**Response 200 (dados reais da API Energisa):**
```json
[
  {
    "codigoEmpresaWeb": 6,
    "numeroUc": 2711600,
    "digitoVerificador": 3,
    "ucAtiva": true,
    "ucCortada": false,
    "ucDesligada": false,
    "contratoAtivo": true,
    "dataEncerramentoContrato": null,
    "codigoMunicipio": 59,
    "nomeMunicipio": "SINOP",
    "uf": "MT",
    "codigoLocalidade": 59,
    "localidade": "SINOP",
    "bairro": "AQUARELA DAS ARTES",
    "codigoEndereco": 24894,
    "endereco": "RUA PRINCIPAL",
    "numeroImovel": "0",
    "complemento": "QD 37 LT 23",
    "descricao": null,
    "dataProximaLeitura": "15/01/2026 00:00:00",
    "dataProximaLeituraISO": "2026-01-15T00:00:00",
    "medidorInstalado": true,
    "indicadorCorte": false,
    "baixaRenda": false,
    "tarifaBranca": false,
    "clienteIrrigante": false,
    "atividadeEssencial": false,
    "usuarioTitular": false,
    "imovelAlugado": false,
    "indicadorVisitaImprodutiva": false,
    "indicadorDco": false,
    "faturaEmail": true,
    "nomeTitular": "DIRCEU SEZE",
    "latitude": -11.831585,
    "longitude": -55.547806,
    "aptoBonusCriseHidrica": false,
    "ultimaLeituraReal": 10075,
    "dataUltimaLeitura": "2025-12-15T00:00:00",
    "grupoLeitura": "B",
    "classeLeitura": "RESIDENCIAL",
    "geracaoDistribuida": 2711600,
    "isGD": true,
    "gdInfo": {
      "possuiGD": true,
      "ucGeradora": true,
      "ucBeneficiaria": false,
      "ucGeradoraVinculada": null,
      "tipoGD": "Autoconsumo Remoto",
      "tipoGeracao": "Micro Geração",
      "percentualCompensacao": 100
    }
  }
]
```

**Campo Crítico: `geracaoDistribuida`**

Este campo determina a participação em Geração Distribuída:

| Valor | Significado |
|-------|-------------|
| `== numeroUc` | UC é **GERADORA** (usina solar nesta UC) |
| `!= numeroUc` (outro CDC) | UC é **BENEFICIÁRIA** (recebe de outra geradora) |
| `null` | Pode ser SEM GD, beneficiária, ou saldo herdado* |

> *Para UCs com `geracaoDistribuida: null`, é necessário verificar `/gd/details` para determinar se possui saldo de créditos.

---

### POST `/energisa/ucs/info`

Busca informações cadastrais detalhadas de uma UC específica.

**Request Body:**
```json
{
  "cpf": "12345678900",
  "codigoEmpresaWeb": 6,
  "cdc": 2711600,
  "digitoVerificadorCdc": 3
}
```

**Response 200 (dados reais):**
```json
{
  "infos": {
    "dadosUc": {
      "cpfCnpj": 30821282115,
      "codigoEmpresaWeb": 6,
      "numeroCdc": 2711600,
      "numeroUCAneel": 133984701777,
      "digitoVerificador": 3,
      "ucAtiva": true,
      "medidorInstalado": true,
      "indicadorCorte": false,
      "ucCortada": false,
      "ucDesligada": false,
      "baixaRenda": false,
      "tarifaBranca": false,
      "clienteIrrigante": false,
      "atividadeEssencial": false,
      "nomeTitular": "DIRCEU SEZE",
      "usuarioTitular": false,
      "dataLigacao": "21/12/2018 10:21:05",
      "dataLigacaoISO": "2018-12-21T10:21:05",
      "dataDesligamento": null,
      "dataReligacao": null,
      "numeroContrato": 523,
      "indicadorContratoAtivo": true,
      "contratoAtivo": true,
      "optinPixAtivo": true,
      "email": "phseze@gmail.com",
      "telefone1": 66984422688,
      "tipoTelefone1": "C",
      "telefone2": 66996350491,
      "tipoTelefone2": "C",
      "enviaFaturaEmail": true,
      "indicadorDebitoEmConta": false,
      "diaVencimento": null,
      "valorMedioKWH": 320,
      "valorMedioKW": 0,
      "valorMedioKVA": 0
    },
    "dadosInstalacao": {
      "classeLeitura": "RESIDENCIAL",
      "grupoLeitura": "B",
      "tipoLigacao": "BIFASICO",
      "numeroMedidor": "N6164890568",
      "areaRural": true,
      "indicadorRotaRural": false,
      "faturamentoLis": true,
      "indicadorSandboxTarifario": false
    },
    "dadosEndereco": {
      "codigoMunicipio": 59,
      "nomeMunicipio": "SINOP",
      "uf": "MT",
      "codigoLocalidade": 59,
      "localidade": "SINOP",
      "bairro": "AQUARELA DAS ARTES",
      "codigoEndereco": 24894,
      "endereco": "RUA PRINCIPAL",
      "numeroImovel": "0",
      "complemento": "QD 37 LT 23",
      "cep": "78550000",
      "longitude": -55.547806,
      "latitude": -11.831585
    }
  },
  "errored": false
}
```

**Campos importantes de `dadosInstalacao`:**

| Campo | Valores | Uso |
|-------|---------|-----|
| `tipoLigacao` | MONOFASICO, BIFASICO, TRIFASICO | Taxa mínima, cálculo economia |
| `grupoLeitura` | A, B | Grupo tarifário |
| `classeLeitura` | RESIDENCIAL, COMERCIAL, etc | Classe de consumo |

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

### Tipos de UC na Geração Distribuída

| Tipo | Descrição | Como Identificar |
|------|-----------|------------------|
| **GERADORA** | Possui usina solar instalada | `geracaoDistribuida == numeroUc` |
| **BENEFICIÁRIA ATIVA** | Recebe créditos de uma geradora | `/gd/details.consumoRecebidoConv > 0` |
| **SALDO HERDADO** | Tem créditos mas não está vinculada | `/gd/details.saldoAnteriorConv > 0` sem recebimento |
| **SEM GD** | UC comum sem participação | Nenhum dado de GD |

---

### POST `/energisa/gd/info`

Busca informações de Geração Distribuída da UC.

**Request Body:**
```json
{
  "cpf": "12345678900",
  "codigoEmpresaWeb": 6,
  "cdc": 2711600,
  "digitoVerificadorCdc": 3
}
```

**Response 200 - UC GERADORA (dados reais):**
```json
{
  "infos": {
    "objeto": {
      "codigoEmpresaWeb": 6,
      "numeroUc": 2711600,
      "digitoVerificador": 3,
      "ucAtiva": true,
      "ucGeradora": true,
      "ucBeneficiaria": false,
      "tipoPessoa": "F",
      "grupoLeitura": "B",
      "grupoFaturamento": "GD_I",
      "tipoGeracao": "Micro Geração",
      "indicadorTipoCompartilhamento": "AR",
      "tipoCompartilhamento": "Autoconsumo Remoto",
      "percentualCompensacao": 100,
      "kwhExcedente": 314,
      "qtdKwhSaldo": 1707,
      "qtdKwhGeracaoEnergia": 566,
      "qtdKwhCompensacaoInjetado": 248,
      "ultimoConsumo": null,
      "endereco": "RUA PRINCIPAL",
      "numero": "0",
      "complemento": "QD 37 LT 23",
      "bairro": "AQUARELA DAS ARTES",
      "cidade": "SINOP",
      "uf": "MT",
      "listaBeneficiarias": [
        {
          "codigoEmpresaWeb": 6,
          "cdc": 4950311,
          "digitoVerificador": 3,
          "nome": "DIRCEU SEZE",
          "tipoPessoa": "F",
          "percentualRecebido": 99,
          "qtdKwhRecebido": 314,
          "grupoLeitura": "B",
          "endereco": "RUA PROJETADA 14",
          "numero": "581",
          "complemento": "CASA 2",
          "bairro": "RESIDENCIAL PARIS",
          "cidade": "SINOP",
          "uf": "MT",
          "existeOS723ou724": false
        }
      ],
      "listaGeradoras": null,
      "geracaoDistribuida": 2711600,
      "existeOs747Aberta": false,
      "demonstrativoGD": {
        "cdc": 2711600,
        "anoReferencia": 2025,
        "mesReferencia": 11,
        "saldoAnteriorConv": 1703,
        "injetadoConv": 0,
        "totalRecebidoRede": 0,
        "consumoRecebidoConv": 0,
        "consumoInjetadoCompensadoConv": 0,
        "consumoRecebidoCompensadoConv": 0,
        "saldoCompensadoAnteriorConv": 0,
        "consumoTransferidoConv": 0,
        "consumoCompensadoConv": 0,
        "estornoConvecional": 0,
        "composicaoEnergiaInjetadas": [
          {
            "cdc": 2711600,
            "anoReferencia": 2023,
            "mesReferencia": 11,
            "saldoAnteriorConv": 230
          }
        ]
      }
    },
    "codigo": "OK",
    "mensagem": "Consulta realizada com sucesso",
    "categoria": "OK"
  },
  "errored": false
}
```

**Response - UC BENEFICIÁRIA ou SEM GD:**
```json
null
```

**Campos importantes de `/gd/info`:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `ucGeradora` | boolean | Se a UC é geradora (dentro do objeto) |
| `ucBeneficiaria` | boolean | Se a UC é beneficiária (dentro do objeto) |
| `tipoGeracao` | string | "Micro Geração" ou "Mini Geração" |
| `tipoCompartilhamento` | string | "Autoconsumo Remoto", "Geração Compartilhada", etc |
| `percentualCompensacao` | int | Percentual de compensação (geralmente 100) |
| `qtdKwhSaldo` | int | Saldo atual de créditos em kWh |
| `qtdKwhGeracaoEnergia` | int | kWh gerados no período |
| `listaBeneficiarias` | array | Lista de UCs que recebem créditos desta geradora |
| `listaGeradoras` | array | Lista de geradoras (se for beneficiária) |
| `demonstrativoGD` | object | Demonstrativo resumido do último mês |

---

### POST `/energisa/gd/details`

Busca histórico detalhado de créditos (últimos 12 meses).

**Request Body:**
```json
{
  "cpf": "12345678900",
  "codigoEmpresaWeb": 6,
  "cdc": 2711600,
  "digitoVerificadorCdc": 3
}
```

**Response 200 - UC GERADORA (dados reais):**
```json
{
  "infos": [
    {
      "cdc": 2711600,
      "anoReferencia": 2025,
      "mesReferencia": 10,
      "saldoAnteriorConv": 1703,
      "injetadoConv": 485,
      "totalRecebidoRede": 0,
      "consumoRecebidoConv": 0,
      "consumoInjetadoCompensadoConv": 324,
      "consumoRecebidoCompensadoConv": 0,
      "saldoCompensadoAnteriorConv": 0,
      "consumoTransferidoConv": 161,
      "consumoCompensadoConv": 324,
      "estornoConvecional": 0,
      "composicaoEnergiaInjetadas": [
        {
          "cdc": 2711600,
          "anoReferencia": 2023,
          "mesReferencia": 11,
          "saldoAnteriorConv": 230
        },
        {
          "cdc": 2711600,
          "anoReferencia": 2024,
          "mesReferencia": 5,
          "saldoAnteriorConv": 307
        }
      ],
      "discriminacaoEnergiaInjetadas": [
        {
          "cdc": 2711600,
          "anoReferencia": 2025,
          "mesReferencia": 10,
          "numUcMovimento": 4950311,
          "consumoRecebidoOuTransferido": -1,
          "consumoConvMovimentado": 161,
          "consumoConvMovimentadoRecebidoOuTranferido": -161,
          "consumoConvMovimentadoTransferidoPercentual": 100,
          "endereco": "RUA PRINCIPAL",
          "numeroImovel": "0",
          "complemento": "QD 37 LT 23",
          "uf": "MT",
          "nomeMunicipio": "SINOP",
          "bairro": "AQUARELA DAS ARTES",
          "codigoEmpresaWeb": 6,
          "digitoVerificador": 3
        }
      ],
      "chavePrimaria": "2711600.2025.10"
    }
  ],
  "errored": false
}
```

**Response 200 - UC BENEFICIÁRIA (dados reais):**
```json
{
  "infos": [
    {
      "cdc": 5036150,
      "anoReferencia": 2025,
      "mesReferencia": 10,
      "saldoAnteriorConv": 454,
      "injetadoConv": 0,
      "totalRecebidoRede": 0,
      "consumoRecebidoConv": 392,
      "consumoInjetadoCompensadoConv": 0,
      "consumoRecebidoCompensadoConv": 0,
      "saldoCompensadoAnteriorConv": 454,
      "consumoTransferidoConv": 0,
      "consumoCompensadoConv": 0,
      "estornoConvecional": 0,
      "composicaoEnergiaInjetadas": [
        {
          "cdc": 5036150,
          "anoReferencia": 2025,
          "mesReferencia": 8,
          "saldoAnteriorConv": 30
        },
        {
          "cdc": 5036150,
          "anoReferencia": 2025,
          "mesReferencia": 9,
          "saldoAnteriorConv": 424
        }
      ],
      "discriminacaoEnergiaInjetadas": [
        {
          "cdc": 5036150,
          "anoReferencia": 2025,
          "mesReferencia": 10,
          "numUcMovimento": 4076540,
          "consumoRecebidoOuTransferido": 1,
          "consumoConvMovimentado": 392,
          "consumoConvMovimentadoRecebidoOuTranferido": 392,
          "consumoConvMovimentadoTransferidoPercentual": null,
          "endereco": "AV DAS ITAUBAS",
          "numeroImovel": "2237",
          "uf": "MT",
          "nomeMunicipio": "SINOP",
          "bairro": "CENTRO",
          "codigoEmpresaWeb": 6,
          "digitoVerificador": 0
        }
      ],
      "chavePrimaria": "5036150.2025.10"
    }
  ],
  "errored": false
}
```

**Response 200 - UC SALDO HERDADO (dados reais):**
```json
{
  "infos": [
    {
      "cdc": 4859946,
      "anoReferencia": 2025,
      "mesReferencia": 12,
      "saldoAnteriorConv": 46062,
      "injetadoConv": 0,
      "totalRecebidoRede": -491,
      "consumoRecebidoConv": 0,
      "consumoInjetadoCompensadoConv": 0,
      "consumoRecebidoCompensadoConv": 0,
      "saldoCompensadoAnteriorConv": 491,
      "consumoTransferidoConv": 0,
      "consumoCompensadoConv": 0,
      "estornoConvecional": 0,
      "composicaoEnergiaInjetadas": [
        {
          "cdc": 4859946,
          "anoReferencia": 2025,
          "mesReferencia": 1,
          "saldoAnteriorConv": 46062
        }
      ],
      "discriminacaoEnergiaInjetadas": [],
      "chavePrimaria": "4859946.2025.12"
    }
  ],
  "errored": false
}
```

**Campos do `/gd/details` - Explicação Detalhada:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `saldoAnteriorConv` | int | Saldo de créditos no início do mês |
| `injetadoConv` | int | kWh gerados (injetados na rede) no mês - só > 0 para GERADORAS |
| `consumoInjetadoCompensadoConv` | int | kWh compensados na própria UC geradora |
| `consumoTransferidoConv` | int | kWh transferidos para beneficiárias - só > 0 para GERADORAS |
| `consumoRecebidoConv` | int | kWh recebidos de uma geradora - só > 0 para BENEFICIÁRIAS |
| `totalRecebidoRede` | int | Saldo líquido (positivo = recebeu, negativo = consumiu do saldo) |
| `saldoCompensadoAnteriorConv` | int | kWh compensados do saldo anterior |
| `composicaoEnergiaInjetadas` | array | **Origem dos créditos por mês (para cálculo de expiração 60 meses)** |
| `discriminacaoEnergiaInjetadas` | array | **Detalhes das transferências entre UCs** |

**Campos de `discriminacaoEnergiaInjetadas[]`:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `numUcMovimento` | int | CDC da outra UC envolvida na transferência |
| `consumoRecebidoOuTransferido` | int | **-1 = ENVIOU** (geradora), **1 = RECEBEU** (beneficiária) |
| `consumoConvMovimentado` | int | Quantidade em kWh movimentada |
| `consumoConvMovimentadoTransferidoPercentual` | int/null | Percentual da transferência (só para geradora) |

---

### Estratégia de Identificação de GD

```
┌─────────────────────────────────────────────────────────────────┐
│                    FLUXO DE IDENTIFICAÇÃO                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Verificar campo `geracaoDistribuida` em /ucs                │
│     │                                                           │
│     ├─► geracaoDistribuida == numeroUc                          │
│     │   └─► UC é GERADORA ✓                                     │
│     │       └─► Chamar /gd/info para listaBeneficiarias         │
│     │                                                           │
│     └─► geracaoDistribuida == null                              │
│         │                                                       │
│         └─► 2. Chamar /gd/details                               │
│             │                                                   │
│             ├─► consumoRecebidoConv > 0                         │
│             │   └─► UC é BENEFICIÁRIA ATIVA ✓                   │
│             │       (discriminacaoEnergiaInjetadas.             │
│             │        numUcMovimento = geradora)                 │
│             │                                                   │
│             ├─► saldoAnteriorConv > 0 e consumoRecebidoConv = 0 │
│             │   └─► UC tem SALDO HERDADO ✓                      │
│             │                                                   │
│             └─► Sem dados ou zerado                             │
│                 └─► UC SEM GD ✓                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### Expiração de Créditos (Lei 14.300/2022)

Os créditos expiram em **60 meses** a partir da injeção na rede.

O campo `composicaoEnergiaInjetadas[]` mostra a origem dos créditos por mês/ano:

```json
"composicaoEnergiaInjetadas": [
  {
    "cdc": 2711600,
    "anoReferencia": 2023,
    "mesReferencia": 11,
    "saldoAnteriorConv": 230
  },
  {
    "cdc": 2711600,
    "anoReferencia": 2024,
    "mesReferencia": 5,
    "saldoAnteriorConv": 307
  }
]
```

**Cálculo da expiração:**
- Crédito de 11/2023: expira em 11/2028
- Crédito de 05/2024: expira em 05/2029
- Créditos mais antigos são consumidos primeiro (FIFO)

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
    "custo_energisa_consumo": 280.00,
    "valor_midwest_consumo": 196.00,
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
├── router.py            # Endpoints FastAPI
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

*Documentação atualizada com dados reais da API Energisa*
*Última atualização: Janeiro 2026*
