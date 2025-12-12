"""
Schemas Pydantic para Dados Extraídos de Faturas

Define a estrutura dos dados extraídos de PDFs de faturas pela IA,
seguindo rigorosamente o formato especificado no prompt de extração.
"""

from typing import Optional, List, Literal
from pydantic import BaseModel, Field, validator
from decimal import Decimal
from datetime import date


class ConsumoKwhExtracted(BaseModel):
    """Dados de consumo em kWh da fatura"""
    unidade: Optional[str] = None
    quantidade: Optional[float] = None
    preco_unit_com_tributos: Optional[Decimal] = None
    valor: Optional[Decimal] = None


class EnergiaInjetadaItemExtracted(BaseModel):
    """Item de energia injetada (oUC ou mUC)"""
    descricao: Optional[str] = None
    tipo_gd: Optional[Literal["GDI", "GDII", "NENHUM", "DESCONHECIDO"]] = None
    unidade: Optional[str] = None
    quantidade: Optional[float] = None
    preco_unit_com_tributos: Optional[Decimal] = None
    valor: Optional[Decimal] = None
    mes_ano_referencia_item: Optional[str] = Field(
        None,
        description="Mês/ano de referência deste item específico (formato YYYY-MM)"
    )

    @validator('mes_ano_referencia_item')
    def validate_mes_ano_format(cls, v):
        """Valida formato YYYY-MM"""
        if v is not None and v != "":
            parts = v.split('-')
            if len(parts) != 2:
                return None
            try:
                ano = int(parts[0])
                mes = int(parts[1])
                if not (1 <= mes <= 12):
                    return None
                if not (2000 <= ano <= 2100):
                    return None
            except ValueError:
                return None
        return v


class AjusteLei14300Extracted(BaseModel):
    """Ajuste GD II - Tarifa Reduzida Lei 14.300/22"""
    descricao: Optional[str] = None
    unidade: Optional[str] = None
    quantidade: Optional[float] = None
    preco_unit_com_tributos: Optional[Decimal] = None
    valor: Optional[Decimal] = None


class LancamentoServicoExtracted(BaseModel):
    """Item de lançamentos e serviços (iluminação, multas, etc)"""
    descricao: Optional[str] = None
    valor: Optional[Decimal] = None


class ItensFaturaExtracted(BaseModel):
    """Todos os itens da fatura estruturados"""
    consumo_kwh: Optional[ConsumoKwhExtracted] = None
    energia_injetada_ouc: List[EnergiaInjetadaItemExtracted] = Field(
        default_factory=list,
        alias="energia_injetada oUC",
        description="Energia injetada na própria UC (other UC)"
    )
    energia_injetada_muc: List[EnergiaInjetadaItemExtracted] = Field(
        default_factory=list,
        alias="energia_injetada mUC",
        description="Energia injetada em múltiplas UCs (multiple UC)"
    )
    ajuste_lei_14300: Optional[AjusteLei14300Extracted] = None
    lancamentos_e_servicos: List[LancamentoServicoExtracted] = Field(
        default_factory=list,
        description="Lista de todos os lançamentos e serviços da fatura"
    )

    class Config:
        populate_by_name = True  # Permite usar alias e nome original


class TotaisExtracted(BaseModel):
    """Totalizadores da fatura"""
    adicionais_bandeira: Optional[Decimal] = Field(
        None,
        description="Soma de todos os itens com 'Bandeira' no nome"
    )
    lancamentos_e_servicos: Optional[Decimal] = Field(
        None,
        description="Soma de todos os valores em lançamentos e serviços"
    )
    total_geral_fatura: Optional[Decimal] = Field(
        None,
        description="Total geral da fatura (TOTAL A PAGAR)"
    )


class QuadroAtencaoExtracted(BaseModel):
    """Informações do quadro de atenção (se existir)"""
    saldo_acumulado: Optional[Decimal] = None
    a_expirar_proximo_ciclo: Optional[Decimal] = None


class ConsumoMesExtracted(BaseModel):
    """Consumo de um mês específico (para média 13 meses)"""
    mes: Optional[str] = Field(
        None,
        description="Formato YYYY-MM (ex: 2025-09 para Setembro/2025)"
    )
    kwh: Optional[float] = None


class MediaConsumo13MExtracted(BaseModel):
    """Média de consumo dos últimos 13 meses"""
    media_kwh: Optional[float] = Field(
        None,
        description="Média simples dos kWh dos 13 meses"
    )
    meses: List[ConsumoMesExtracted] = Field(
        default_factory=list,
        description="Lista dos meses com consumo"
    )


class ConsumoDetalhado(BaseModel):
    """Detalhamento de consumo (ponta/fora ponta)"""
    atual: Optional[float] = None
    anterior: Optional[float] = None
    medido: Optional[float] = None
    faturado: Optional[float] = None


class EstruturaConsumoExtracted(BaseModel):
    """Estrutura/composição do consumo (se existir)"""
    kwh_ponta: Optional[ConsumoDetalhado] = None
    inj_ponta: Optional[ConsumoDetalhado] = None
    # Pode expandir com kwh_intermediario, kwh_fora_ponta, etc se necessário


class FaturaExtraidaSchema(BaseModel):
    """
    Schema completo dos dados extraídos de uma fatura de energia.

    Este é o formato de saída esperado do parser de IA que processa
    o texto OCR da fatura.
    """

    # Informações básicas
    codigo_cliente: Optional[str] = Field(
        None,
        description="Código do cliente no formato 6/XXXXXXXX-X"
    )
    ligacao: Optional[Literal["MONOFASICO", "BIFASICO", "TRIFASICO"]] = Field(
        None,
        description="Tipo de ligação da UC"
    )
    data_apresentacao: Optional[date] = None
    mes_ano_referencia: Optional[str] = Field(
        None,
        description="Mês e ano de referência da fatura (formato YYYY-MM)"
    )
    vencimento: Optional[date] = Field(
        None,
        description="Data de vencimento da fatura"
    )
    total_a_pagar: Optional[Decimal] = Field(
        None,
        description="Valor total a pagar da fatura"
    )

    # Datas de leitura
    leitura_anterior_data: Optional[date] = None
    leitura_atual_data: Optional[date] = None
    dias: Optional[int] = Field(
        None,
        description="Quantidade de dias do ciclo de faturamento"
    )
    proxima_leitura_data: Optional[date] = None

    # Leituras (valores do medidor)
    leitura_anterior: Optional[int] = Field(
        None,
        description="Valor da leitura anterior do medidor"
    )
    leitura_atual: Optional[int] = Field(
        None,
        description="Valor da leitura atual do medidor"
    )

    # Itens estruturados
    itens_fatura: ItensFaturaExtracted

    # Totalizadores
    totais: TotaisExtracted

    # Informações adicionais (opcionais)
    quadro_atencao: Optional[QuadroAtencaoExtracted] = None
    estrutura_consumo: Optional[EstruturaConsumoExtracted] = None
    media_consumo_13m: Optional[MediaConsumo13MExtracted] = None

    # Classe para Bandeira tarifária (se vier separado)
    bandeira_tarifaria: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "codigo_cliente": "6/4998834-8",
                "ligacao": "MONOFASICO",
                "mes_ano_referencia": "2025-09",
                "vencimento": "2025-10-15",
                "total_a_pagar": 250.50,
                "leitura_anterior_data": "2025-08-20",
                "leitura_atual_data": "2025-09-20",
                "dias": 31,
                "itens_fatura": {
                    "consumo_kwh": {
                        "unidade": "KWH",
                        "quantidade": 150,
                        "preco_unit_com_tributos": 0.85,
                        "valor": 127.50
                    },
                    "energia_injetada oUC": [
                        {
                            "descricao": "Energia Ativa Injetada GDII oUC - 09/2025",
                            "tipo_gd": "GDII",
                            "unidade": "KWH",
                            "quantidade": 100,
                            "preco_unit_com_tributos": 0.85,
                            "valor": -85.00,
                            "mes_ano_referencia_item": "2025-09"
                        }
                    ],
                    "energia_injetada mUC": [],
                    "ajuste_lei_14300": {
                        "descricao": "Ajuste GDII - TRF Reduzida Lei 14.300/22",
                        "unidade": "KWH",
                        "quantidade": 100,
                        "preco_unit_com_tributos": 0.20,
                        "valor": 20.00
                    },
                    "lancamentos_e_servicos": [
                        {
                            "descricao": "Contrib de Ilum Pub",
                            "valor": 35.00
                        }
                    ]
                },
                "totais": {
                    "adicionais_bandeira": 0,
                    "lancamentos_e_servicos": 35.00,
                    "total_geral_fatura": 250.50
                }
            }
        }

    @validator('mes_ano_referencia')
    def validate_mes_ano_referencia(cls, v):
        """Valida formato YYYY-MM"""
        if v is not None and v != "":
            parts = v.split('-')
            if len(parts) != 2:
                return None
            try:
                ano = int(parts[0])
                mes = int(parts[1])
                if not (1 <= mes <= 12):
                    return None
                if not (2000 <= ano <= 2100):
                    return None
            except ValueError:
                return None
        return v

    def obter_mes_ano_tuple(self) -> tuple[int, int]:
        """Retorna tupla (ano, mes) a partir de mes_ano_referencia"""
        if not self.mes_ano_referencia:
            return (0, 0)
        try:
            ano, mes = self.mes_ano_referencia.split('-')
            return (int(ano), int(mes))
        except:
            return (0, 0)

    def calcular_injetada_total(self) -> float:
        """Calcula total de energia injetada (oUC + mUC)"""
        total = 0.0

        for item in self.itens_fatura.energia_injetada_ouc:
            if item.quantidade:
                total += abs(item.quantidade)  # abs porque pode vir negativo

        for item in self.itens_fatura.energia_injetada_muc:
            if item.quantidade:
                total += abs(item.quantidade)

        return total

    def detectar_modelo_gd(self) -> Literal["GDI", "GDII", "DESCONHECIDO"]:
        """
        Detecta o modelo de geração distribuída (GD I ou GD II)

        Lógica (alinhada com N8N):
        1. Verifica tipo_gd dos itens de energia injetada (prioridade)
        2. Valida ajuste Lei 14.300 verificando descrição
        3. Senão → DESCONHECIDO
        """
        import re

        # Verifica itens de energia injetada (prioridade)
        todos_itens = (
            self.itens_fatura.energia_injetada_ouc +
            self.itens_fatura.energia_injetada_muc
        )

        # Primeiro verifica se algum item tem tipo_gd=GDII
        for item in todos_itens:
            if item.tipo_gd == "GDII":
                return "GDII"

        # Depois verifica se algum item tem tipo_gd=GDI
        for item in todos_itens:
            if item.tipo_gd == "GDI":
                return "GDI"

        # Verifica ajuste Lei 14.300 COM VALIDAÇÃO de descrição
        if self.itens_fatura.ajuste_lei_14300 and self.itens_fatura.ajuste_lei_14300.valor:
            desc = self.itens_fatura.ajuste_lei_14300.descricao or ""
            # Só considera GD II se descrição menciona Lei 14.300 ou GDII
            if re.search(r'Lei\s*14\.?300|GDII|GD\s*II', desc, re.IGNORECASE):
                return "GDII"

        return "DESCONHECIDO"

    def extrair_valor_iluminacao_publica(self) -> Decimal:
        """Extrai valor de iluminação pública dos lançamentos"""
        for item in self.itens_fatura.lancamentos_e_servicos:
            if item.descricao and "ilum" in item.descricao.lower():
                return item.valor or Decimal("0")
        return Decimal("0")
