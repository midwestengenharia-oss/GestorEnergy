---
name: cobranca
description: |
  Trabalhar com calculo de cobrancas do sistema GestorEnergy. Use quando o usuario pedir para debugar calculo de cobranca, entender formula de cobranca, verificar valores de cobranca, ou modificar logica de calculo.
---

# Calculo de Cobrancas

Sistema de calculo automatico de cobrancas para beneficiarios de geracao distribuida.

## Arquivos Principais

- `backend/cobrancas/service.py` - Servico principal
- `backend/cobrancas/calculadora.py` - Logica de calculo
- `backend/cobrancas/schemas.py` - Schemas Pydantic
- `backend/routers/cobrancas.py` - Endpoints API

## Formula de Calculo

### GD I (Modelo Antigo)

```
Economia = energia_compensada * tarifa_energia * 0.70  # 30% desconto
Taxa Minima = taxa_disponibilidade * tarifa_energia
Valor Cobranca = max(Economia - Taxa Minima, 0)
```

### GD II (Modelo Novo - apos Jan/2024)

```
Economia = energia_compensada * tarifa_energia * 0.70
Valor Cobranca = Economia  # Sem taxa minima
```

## Bandeira Tarifaria

Valores por kWh (adicional):
- Verde: R$ 0,00
- Amarela: R$ 0,0188
- Vermelha P1: R$ 0,0446
- Vermelha P2: R$ 0,0787

Calculo proporcional:
```python
adicional_bandeira = consumo_kwh * valor_bandeira_por_kwh
```

## Taxa de Disponibilidade (GD I)

Por tipo de ligacao:
- Monofasica: 30 kWh
- Bifasica: 50 kWh
- Trifasica: 100 kWh

## Impostos

Impostos dinamicos (tabela `config_plataforma`):
- PIS: 1.2102%
- COFINS: 5.5743%
- ICMS: 17%

Formula com impostos:
```python
valor_com_impostos = valor_base / ((1 - pis_cofins) * (1 - icms))
```

## Campos da Cobranca

```python
class Cobranca(BaseModel):
    id: UUID
    fatura_id: UUID
    beneficiario_id: UUID

    # Valores calculados
    energia_compensada_kwh: float
    valor_energia: float
    valor_bandeira: float
    valor_impostos: float
    valor_total: float

    # Desconto
    desconto_percentual: float  # 30%
    valor_desconto: float

    # Status
    status: str  # RASCUNHO, EMITIDA, PAGA, VENCIDA

    # PIX
    txid: str
    qr_code_pix: str
    qr_code_pix_image: str
    status_pix: str
```

## Debugar Calculo

Para debugar, adicionar logs em `calculadora.py`:

```python
logger.debug(f"Energia compensada: {energia_compensada}")
logger.debug(f"Tarifa: {tarifa}")
logger.debug(f"Desconto 30%: {desconto}")
logger.debug(f"Valor final: {valor_final}")
```

## Endpoints

- `GET /api/cobrancas` - Listar cobrancas
- `POST /api/cobrancas` - Criar cobranca
- `POST /api/cobrancas/lote` - Criar em lote
- `PUT /api/cobrancas/{id}` - Atualizar
- `POST /api/cobrancas/{id}/reprocessar` - Recalcular
- `POST /api/cobrancas/{id}/emitir` - Emitir e enviar

## Reprocessar Cobranca

Endpoint: `POST /api/cobrancas/{id}/reprocessar`

Deleta cobranca existente e recalcula com dados atuais da fatura.
