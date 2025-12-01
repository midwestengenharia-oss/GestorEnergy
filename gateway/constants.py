"""
Constantes para cálculos de tarifa e economia energética
Baseado nas regulamentações da ANEEL e tarifas vigentes
"""

from datetime import datetime

# ====== TRIBUTAÇÃO ======
PIS = 0.012102
COFINS = 0.055743
PIS_COFINS = 0.067845  # PIS + COFINS simplificado
ICMS = 0.17

# Divisor para brutalizar tarifas (aplicar impostos)
TRIB_DIVISOR = (1 - PIS_COFINS) * (1 - ICMS)

# ====== FIO B ESCALONADO ======
# Percentual do componente Fio B aplicado por ano
FIOB_RAMP = {
    2023: 0.15,
    2024: 0.30,
    2025: 0.45,
    2026: 0.60,
    2027: 0.75,
    2028: 0.90,
}

# Fallback para anos após 2028
FIOB_FALLBACK = 0.90

def get_fiob_fator():
    """Retorna o fator de Fio B para o ano atual"""
    ano_atual = datetime.now().year
    return FIOB_RAMP.get(ano_atual, FIOB_FALLBACK)

# ====== BANDEIRA TARIFÁRIA ======
# Valores em R$/kWh para bandeira vermelha (patamar 1)
BANDEIRA_VALOR_KWH = 0.04463

# ====== TAXA MÍNIMA POR TIPO DE LIGAÇÃO ======
# Valores em kWh/mês
TAXA_MINIMA = {
    "MONOFASICO": 30,
    "BIFASICO": 50,
    "TRIFASICO": 100,
}

def get_taxa_minima(tipo_ligacao: str) -> int:
    """
    Retorna a taxa mínima em kWh baseada no tipo de ligação
    Args:
        tipo_ligacao: String contendo o tipo (case-insensitive)
    Returns:
        Taxa mínima em kWh (30, 50 ou 100)
    """
    tipo_upper = tipo_ligacao.upper()

    if "MONO" in tipo_upper:
        return TAXA_MINIMA["MONOFASICO"]
    elif "BI" in tipo_upper:
        return TAXA_MINIMA["BIFASICO"]
    elif "TRI" in tipo_upper:
        return TAXA_MINIMA["TRIFASICO"]
    else:
        # Fallback para bifásico (mais comum)
        return TAXA_MINIMA["BIFASICO"]

# ====== TARIFAS ANEEL (FALLBACK HARDCODED) ======
# Última atualização: RESOLUÇÃO HOMOLOGATÓRIA Nº 3.440, DE 1 DE ABRIL DE 2025
# Energisa Mato Grosso (EMT)
# Valores em R$/kWh SEM impostos

# Tarifa B1 Residencial Convencional (TUSD + TE)
# Valores aproximados baseados em dados da ANEEL 2025
TARIFA_B1_SEM_IMPOSTOS = 0.58500  # R$/kWh (ajustar com valor real da API ANEEL)

# Componente Fio B
FIOB_BASE_SEM_IMPOSTOS = 0.18500  # R$/kWh (ajustar com valor real da API ANEEL)

def aplicar_impostos(valor_sem_impostos: float) -> float:
    """
    Aplica impostos (PIS, COFINS, ICMS) sobre valor sem impostos
    Args:
        valor_sem_impostos: Valor em R$/kWh sem tributos
    Returns:
        Valor com impostos aplicados
    """
    return valor_sem_impostos / TRIB_DIVISOR

# ====== DESCONTO MIDWEST ======
DESCONTO_MIDWEST = 0.30  # 30% de desconto sobre a tarifa de consumo

# ====== PROJEÇÃO ======
REAJUSTE_ANUAL = 0.08  # 8% ao ano (média histórica)
ANOS_PROJECAO = 10
