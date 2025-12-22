---
name: fatura
description: |
  Trabalhar com extracao de dados de faturas PDF da Energisa. Use quando o usuario pedir para extrair dados de PDF, debugar extracao de fatura, melhorar parser de PDF, ou trabalhar com LLM/OCR de faturas.
---

# Extracao de Faturas PDF

Sistema de extracao de dados de faturas da Energisa usando LLM (OpenAI) e OCR.

## Arquivos Principais

- `backend/faturas/service.py` - Servico principal
- `backend/faturas/llm_extractor.py` - Extracao com OpenAI GPT-4o-mini
- `backend/faturas/python_parser.py` - Parser template-based (legado)
- `backend/faturas/pdf_diagnostico.py` - Diagnostico de PDFs
- `backend/faturas/schemas.py` - Schemas Pydantic

## Fluxo de Extracao

1. PDF recebido (base64 ou arquivo)
2. Extrai texto com `pdfplumber`
3. Envia para LLM (OpenAI) com prompt estruturado
4. Valida resposta com schema Pydantic
5. Armazena em `dados_extraidos` (JSON)

## Campos Extraidos

```python
class DadosExtraidos(BaseModel):
    # Identificacao
    numero_instalacao: str
    mes_referencia: str
    data_vencimento: str

    # Leituras
    leitura_anterior: int
    leitura_atual: int
    consumo_kwh: int

    # Geracao Distribuida
    energia_injetada_kwh: float
    energia_compensada_kwh: float
    saldo_creditos_kwh: float
    creditos_expirar_kwh: float

    # Valores
    valor_total: float
    valor_energia: float
    bandeira_tarifaria: str  # VERDE, AMARELA, VERMELHA_P1, VERMELHA_P2

    # Taxas
    iluminacao_publica: float
    pis_cofins: float
    icms: float

    # Tipo
    tipo_ligacao: str  # MONOFASICA, BIFASICA, TRIFASICA
    modelo_gd: str  # GD_I, GD_II
```

## Debugar Extracao

Ver log de extracao:
```python
# Em llm_extractor.py
logger.debug(f"Texto extraido: {texto[:500]}")
logger.debug(f"Resposta LLM: {resposta}")
```

## Melhorar Extracao

Para melhorar a extracao, editar o prompt em `llm_extractor.py`:

```python
PROMPT_EXTRACAO = """
Extraia os seguintes dados da fatura de energia:
...
"""
```

## Fallback OCR

Se pdfplumber falhar, usar LLMWhisperer:

```python
from llmwhisperer import LLMWhisperer

whisper = LLMWhisperer(api_key=os.getenv("LLMWHISPERER_API_KEY"))
texto = whisper.extract(pdf_bytes)
```

## Diagnostico de PDF

```python
from faturas.pdf_diagnostico import diagnosticar_pdf

resultado = diagnosticar_pdf(pdf_bytes)
print(resultado.qualidade)  # BOA, MEDIA, RUIM
print(resultado.texto_extraido[:500])
```

## Reprocessar Fatura

Endpoint: `POST /api/faturas/{id}/reprocessar`

Deleta dados extraidos e re-executa extracao.
