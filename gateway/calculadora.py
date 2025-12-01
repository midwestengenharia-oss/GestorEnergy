"""
Calculadora de economia para simulação energética
Baseado na lógica do fluxo N8N da Midwest Energias
"""

from typing import Dict, List, Any
import constants as const

def calcular_bandeira_vermelha(consumo_kwh: float) -> float:
    """
    Calcula o valor da bandeira vermelha com impostos aplicados
    Fórmula: (consumo × 0,04463) / ((1 - PIS_COFINS) × (1 - ICMS))

    Args:
        consumo_kwh: Consumo em kWh
    Returns:
        Valor da bandeira vermelha em R$
    """
    valor_sem_impostos = consumo_kwh * const.BANDEIRA_VALOR_KWH
    valor_com_impostos = valor_sem_impostos / const.TRIB_DIVISOR
    return valor_com_impostos


def calcular_fiob_mensal(consumo_kwh: float, fiob_base_kwh: float) -> float:
    """
    Calcula o valor do Fio B escalonado mensal

    Args:
        consumo_kwh: Consumo em kWh
        fiob_base_kwh: Valor base do Fio B em R$/kWh (sem impostos)
    Returns:
        Valor do Fio B escalonado em R$ (sem impostos - não aplica tributos no Fio B)
    """
    fator_fiob = const.get_fiob_fator()
    fiob_escalonado_kwh = fiob_base_kwh * fator_fiob
    valor_fiob = consumo_kwh * fiob_escalonado_kwh
    return valor_fiob


def calcular_taxa_minima(consumo_kwh: float, tipo_ligacao: str, tarifa_kwh_com_impostos: float) -> float:
    """
    Calcula o valor da taxa mínima baseada no tipo de ligação

    Args:
        consumo_kwh: Consumo em kWh
        tipo_ligacao: Tipo de ligação (MONOFASICO, BIFASICO, TRIFASICO)
        tarifa_kwh_com_impostos: Tarifa em R$/kWh COM impostos
    Returns:
        Valor da taxa mínima em R$
    """
    taxa_min_kwh = const.get_taxa_minima(tipo_ligacao)
    # A taxa mínima não pode ser maior que o consumo
    taxa_aplicada_kwh = min(consumo_kwh, taxa_min_kwh)
    valor_taxa_minima = taxa_aplicada_kwh * tarifa_kwh_com_impostos
    return valor_taxa_minima


def calcular_piso_regulatorio(
    consumo_kwh: float,
    tipo_ligacao: str,
    tarifa_kwh_com_impostos: float,
    fiob_base_kwh: float
) -> Dict[str, float]:
    """
    Calcula o piso regulatório (maior entre taxa mínima e Fio B)

    Args:
        consumo_kwh: Consumo em kWh
        tipo_ligacao: Tipo de ligação
        tarifa_kwh_com_impostos: Tarifa COM impostos
        fiob_base_kwh: Fio B base SEM impostos
    Returns:
        Dict com: piso_regulatorio, taxa_minima, fiob_escalonado
    """
    taxa_minima = calcular_taxa_minima(consumo_kwh, tipo_ligacao, tarifa_kwh_com_impostos)
    fiob_escalonado = calcular_fiob_mensal(consumo_kwh, fiob_base_kwh)

    piso_regulatorio = max(taxa_minima, fiob_escalonado)

    return {
        "piso_regulatorio": piso_regulatorio,
        "taxa_minima": taxa_minima,
        "fiob_escalonado": fiob_escalonado,
        "tipo_usado": "taxa_minima" if taxa_minima >= fiob_escalonado else "fiob"
    }


def calcular_economia_mensal(
    consumo_kwh: float,
    tipo_ligacao: str,
    iluminacao_publica: float,
    tem_bandeira_vermelha: bool,
    tarifa_b1_kwh_com_impostos: float,
    fiob_base_kwh: float
) -> Dict[str, Any]:
    """
    Calcula a economia mensal completa comparando conta atual vs Midwest

    Args:
        consumo_kwh: Consumo médio mensal em kWh
        tipo_ligacao: Tipo de ligação (MONO/BI/TRIFASICO)
        iluminacao_publica: Valor da iluminação pública em R$
        tem_bandeira_vermelha: Se o mês tem bandeira vermelha
        tarifa_b1_kwh_com_impostos: Tarifa B1 COM impostos em R$/kWh
        fiob_base_kwh: Fio B base SEM impostos em R$/kWh
    Returns:
        Dict com breakdown completo da economia
    """

    # ====== VALORES APENAS DE CONSUMO (PARA CARDS PRINCIPAIS) ======
    # Custo atual energisa - apenas consumo × tarifa
    valor_consumo_energisa = consumo_kwh * tarifa_b1_kwh_com_impostos

    # Valor midwest - apenas consumo × tarifa com 30% desconto
    tarifa_midwest_kwh = tarifa_b1_kwh_com_impostos * (1 - const.DESCONTO_MIDWEST)
    valor_consumo_midwest = consumo_kwh * tarifa_midwest_kwh

    # Economia mensal simples (apenas diferença de consumo)
    economia_mensal_consumo = valor_consumo_energisa - valor_consumo_midwest
    economia_anual_consumo = economia_mensal_consumo * 12

    # Faturas economizadas/ano = economia anual / valor midwest (só consumo)
    faturas_economizadas = economia_anual_consumo / valor_consumo_midwest if valor_consumo_midwest > 0 else 0

    # ====== VALORES COMPLETOS (PARA DETALHAMENTO) ======
    # Bandeira (apenas na conta atual)
    bandeira = calcular_bandeira_vermelha(consumo_kwh) if tem_bandeira_vermelha else 0.0

    # Piso regulatório (apenas na conta midwest)
    piso_info = calcular_piso_regulatorio(
        consumo_kwh,
        tipo_ligacao,
        tarifa_b1_kwh_com_impostos,
        fiob_base_kwh
    )

    # Contas completas (para detalhamento)
    conta_atual_completa = valor_consumo_energisa + iluminacao_publica + bandeira
    conta_midwest_completa = valor_consumo_midwest + piso_info["piso_regulatorio"] + iluminacao_publica

    return {
        # ====== CARDS PRINCIPAIS (APENAS CONSUMO) ======
        "custo_energisa_consumo": valor_consumo_energisa,  # Apenas consumo × tarifa
        "valor_midwest_consumo": valor_consumo_midwest,    # Apenas consumo × tarifa com desconto

        # ====== ECONOMIA (APENAS CONSUMO) ======
        "economia": {
            "mensal": economia_mensal_consumo,
            "anual": economia_anual_consumo,
            "faturas_economizadas_ano": faturas_economizadas
        },

        # ====== DETALHAMENTO COMPLETO ======
        "conta_atual": {
            "energia": valor_consumo_energisa,
            "iluminacao_publica": iluminacao_publica,
            "bandeira": bandeira,
            "total": conta_atual_completa
        },

        "conta_midwest": {
            "energia_com_desconto": valor_consumo_midwest,
            "piso_regulatorio": piso_info["piso_regulatorio"],
            "iluminacao_publica": iluminacao_publica,
            "total": conta_midwest_completa
        },

        # Detalhes do Piso
        "piso_detalhes": piso_info,

        # Tarifas
        "tarifas": {
            "tarifa_energisa_kwh": tarifa_b1_kwh_com_impostos,
            "tarifa_midwest_kwh": tarifa_midwest_kwh,
            "desconto_percentual": const.DESCONTO_MIDWEST
        },

        # Dados de entrada
        "dados_entrada": {
            "consumo_kwh": consumo_kwh,
            "tipo_ligacao": tipo_ligacao,
            "tem_bandeira_vermelha": tem_bandeira_vermelha
        }
    }


def calcular_projecao_10_anos(
    conta_atual_mensal: float,
    conta_midwest_mensal: float
) -> List[Dict[str, Any]]:
    """
    Calcula projeção de economia para 10 anos com reajuste anual

    Args:
        conta_atual_mensal: Conta atual mensal em R$
        conta_midwest_mensal: Conta Midwest mensal em R$
    Returns:
        Lista com projeção ano a ano
    """
    projecao = []
    economia_acumulada = 0.0

    for ano in range(1, const.ANOS_PROJECAO + 1):
        fator = (1 + const.REAJUSTE_ANUAL) ** (ano - 1)

        custo_energisa_ano = conta_atual_mensal * 12 * fator
        valor_midwest_ano = conta_midwest_mensal * 12 * fator

        economia_ano = max(custo_energisa_ano - valor_midwest_ano, 0)
        economia_acumulada += economia_ano

        projecao.append({
            "ano": ano,
            "custo_energisa": custo_energisa_ano,
            "valor_midwest": valor_midwest_ano,
            "economia_anual": economia_ano,
            "economia_acumulada": economia_acumulada
        })

    return projecao


def processar_faturas(faturas: List[Dict]) -> Dict[str, Any]:
    """
    Processa lista de faturas usando a FATURA MAIS RECENTE para o cálculo

    Args:
        faturas: Lista de faturas da Energisa (última posição = mais recente)
    Returns:
        Dict com dados da fatura mais recente
    """
    if not faturas:
        return {
            "consumo_kwh": 0,
            "total_pago_12_meses": 0,
            "iluminacao_publica": 0,
            "tem_bandeira_vermelha": False,
            "faturas_count": 0,
            "fatura_mais_recente": None
        }

    # PEGA A FATURA MAIS RECENTE (primeira da lista - vem ordenada desc)
    fatura_recente = faturas[0]

    # Consumo em kWh da fatura mais recente
    consumo_kwh = fatura_recente.get("consumo", 0) or fatura_recente.get("consumoKwh", 0) or 0

    # Iluminação pública da fatura mais recente
    iluminacao = fatura_recente.get("iluminacaoPublica", 0) or fatura_recente.get("valorIluminacaoPublica", 0) or 0

    # Bandeira da fatura mais recente
    bandeira = fatura_recente.get("bandeiraTarifaria", "")
    tem_bandeira = isinstance(bandeira, str) and "VERMELHA" in bandeira.upper()

    # Total pago nos últimos 12 meses (para referência)
    total_pago = sum(f.get("valorFatura", 0) or 0 for f in faturas)

    return {
        "consumo_kwh": consumo_kwh,
        "total_pago_12_meses": total_pago,
        "iluminacao_publica": iluminacao,
        "tem_bandeira_vermelha": tem_bandeira,
        "faturas_count": len(faturas),
        "fatura_mais_recente": {
            "mes": fatura_recente.get("mesReferencia"),
            "ano": fatura_recente.get("anoReferencia"),
            "valor": fatura_recente.get("valorFatura", 0),
            "consumo": consumo_kwh,
            "bandeira": bandeira
        }
    }
