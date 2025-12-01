"""
Integração com API de Dados Abertos da ANEEL
Busca tarifas B1 e Fio B em tempo real
"""

import requests
from typing import Optional, Dict
import constants

# URL base da API ANEEL
ANEEL_API_URL = "https://dadosabertos.aneel.gov.br/api/3/action/datastore_search"

# Resource IDs
RESOURCE_ID_TARIFAS = "fcf2906c-7c32-4b9b-a637-054e7a5234f4"
RESOURCE_ID_FIOB = "a4060165-3a0c-404f-926c-83901088b67c"


def parseBR(value: str) -> float:
    """
    Converte string no formato brasileiro (1.234,56) para float
    """
    if not value or value == "null":
        return 0.0
    # Remove pontos (milhares) e substitui vírgula por ponto
    return float(value.replace(".", "").replace(",", "."))


def buscar_tarifa_b1(sigla_agente: str = "EMT") -> Optional[Dict[str, float]]:
    """
    Busca tarifa B1 Residencial Convencional da ANEEL

    Args:
        sigla_agente: Sigla da distribuidora (padrão: EMT - Energisa MT)
    Returns:
        Dict com tusd_kwh, te_kwh, total_kwh (SEM impostos) ou None se falhar
    """
    try:
        filters = {
            "SigAgente": sigla_agente,
            "DscBaseTarifaria": "Tarifa de Aplicação",
            "DscSubGrupo": "B1",
            "DscModalidadeTarifaria": "Convencional",
            "DscDetalhe": "Não se aplica",
            "NomPostoTarifario": "Não se aplica",
            "DscClasse": "Residencial",
            "DscSubClasse": "Residencial"
        }

        params = {
            "resource_id": RESOURCE_ID_TARIFAS,
            "filters": str(filters).replace("'", '"'),
            "sort": "DatInicioVigencia desc",
            "limit": 1
        }

        response = requests.get(ANEEL_API_URL, params=params, timeout=10)

        if response.status_code != 200:
            print(f"   [ERRO] ANEEL Tarifas: HTTP {response.status_code}")
            return None

        data = response.json()

        if not data.get("success"):
            print("   [ERRO] API ANEEL retornou success=false")
            return None

        records = data.get("result", {}).get("records", [])

        if not records:
            print("   [ERRO] Nenhuma tarifa encontrada na ANEEL")
            return None

        tarifa = records[0]

        # Valores vêm em R$/MWh, converter para R$/kWh
        tusd_mwh = parseBR(tarifa.get("VlrTUSD", "0"))
        te_mwh = parseBR(tarifa.get("VlrTE", "0"))

        tusd_kwh = tusd_mwh / 1000
        te_kwh = te_mwh / 1000
        total_kwh = tusd_kwh + te_kwh

        print(f"   [OK] Tarifa B1 ANEEL: TUSD={tusd_kwh:.5f} + TE={te_kwh:.5f} = {total_kwh:.5f} R$/kWh (sem impostos)")
        print(f"      Vigencia: {tarifa.get('DatInicioVigencia')} a {tarifa.get('DatFimVigencia')}")

        return {
            "tusd_kwh": tusd_kwh,
            "te_kwh": te_kwh,
            "total_kwh": total_kwh,
            "vigencia_inicio": tarifa.get("DatInicioVigencia"),
            "vigencia_fim": tarifa.get("DatFimVigencia"),
            "resolucao": tarifa.get("DscREH")
        }

    except requests.exceptions.Timeout:
        print("   [AVISO] Timeout ao buscar tarifa ANEEL (>10s)")
        return None
    except Exception as e:
        print(f"   [AVISO] Erro ao buscar tarifa ANEEL: {e}")
        return None


def buscar_fiob(sigla_agente: str = "EMT") -> Optional[Dict[str, float]]:
    """
    Busca componente Fio B da ANEEL

    Args:
        sigla_agente: Sigla da distribuidora (padrão: EMT - Energisa MT)
    Returns:
        Dict com valor_kwh (SEM impostos) ou None se falhar
    """
    try:
        filters = {
            "SigNomeAgente": sigla_agente,
            "DscComponenteTarifario": "TUSD_FioB",
            "DscBaseTarifaria": "Tarifa de Aplicação",
            "DscSubGrupoTarifario": "B1",
            "DscModalidadeTarifaria": "Convencional",
            "DscClasseConsumidor": "Residencial",
            "DscSubClasseConsumidor": "Residencial",
            "DscDetalheConsumidor": "Não se aplica",
            "DscPostoTarifario": "Não se aplica"
        }

        params = {
            "resource_id": RESOURCE_ID_FIOB,
            "filters": str(filters).replace("'", '"'),
            "sort": "DatInicioVigencia desc",
            "limit": 1
        }

        response = requests.get(ANEEL_API_URL, params=params, timeout=10)

        if response.status_code != 200:
            print(f"   [ERRO] ANEEL Fio B: HTTP {response.status_code}")
            return None

        data = response.json()

        if not data.get("success"):
            print("   [ERRO] API ANEEL Fio B retornou success=false")
            return None

        records = data.get("result", {}).get("records", [])

        if not records:
            print("   [ERRO] Nenhum Fio B encontrado na ANEEL")
            return None

        fiob = records[0]

        # Valor vem em R$/MWh, converter para R$/kWh
        valor_mwh = parseBR(fiob.get("VlrComponenteTarifario", "0"))
        valor_kwh = valor_mwh / 1000

        print(f"   [OK] Fio B ANEEL: {valor_kwh:.5f} R$/kWh (sem impostos)")
        print(f"      Vigencia: {fiob.get('DatInicioVigencia')} a {fiob.get('DatFimVigencia')}")

        return {
            "valor_kwh": valor_kwh,
            "vigencia_inicio": fiob.get("DatInicioVigencia"),
            "vigencia_fim": fiob.get("DatFimVigencia"),
            "resolucao": fiob.get("DscResolucaoHomologatoria")
        }

    except requests.exceptions.Timeout:
        print("   [AVISO] Timeout ao buscar Fio B ANEEL (>10s)")
        return None
    except Exception as e:
        print(f"   [AVISO] Erro ao buscar Fio B ANEEL: {e}")
        return None


def get_tarifas_com_fallback(sigla_agente: str = "EMT") -> Dict[str, float]:
    """
    Busca tarifas da ANEEL com fallback para valores hardcoded

    Returns:
        Dict com tarifa_b1_sem_impostos e fiob_sem_impostos
    """
    # Tenta buscar tarifa B1 da ANEEL
    tarifa_b1_data = buscar_tarifa_b1(sigla_agente)

    if tarifa_b1_data:
        tarifa_b1_sem_impostos = tarifa_b1_data["total_kwh"]
    else:
        print(f"   [AVISO] Usando tarifa B1 hardcoded como fallback: {constants.TARIFA_B1_SEM_IMPOSTOS}")
        tarifa_b1_sem_impostos = constants.TARIFA_B1_SEM_IMPOSTOS

    # Tenta buscar Fio B da ANEEL
    fiob_data = buscar_fiob(sigla_agente)

    if fiob_data:
        fiob_sem_impostos = fiob_data["valor_kwh"]
    else:
        print(f"   [AVISO] Usando Fio B hardcoded como fallback: {constants.FIOB_BASE_SEM_IMPOSTOS}")
        fiob_sem_impostos = constants.FIOB_BASE_SEM_IMPOSTOS

    return {
        "tarifa_b1_sem_impostos": tarifa_b1_sem_impostos,
        "fiob_sem_impostos": fiob_sem_impostos
    }
