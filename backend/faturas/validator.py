"""
Validador de Faturas Extraídas
Valida dados extraídos usando informações das APIs Energisa e ANEEL
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from decimal import Decimal

logger = logging.getLogger(__name__)


class ValidationResult:
    """Resultado de validação"""

    def __init__(self):
        self.avisos: List[Dict[str, str]] = []
        self.score: int = 100

    def adicionar_aviso(self, categoria: str, campo: str, mensagem: str, severidade: str = "warning"):
        """
        Adiciona um aviso de validação.

        Args:
            categoria: Categoria do aviso (datas, valores, calculos, etc)
            campo: Campo afetado
            mensagem: Descrição do problema
            severidade: warning ou error
        """
        self.avisos.append({
            "categoria": categoria,
            "campo": campo,
            "mensagem": mensagem,
            "severidade": severidade
        })

        # Reduzir score baseado na severidade
        if severidade == "error":
            self.score = max(0, self.score - 20)
        else:
            self.score = max(0, self.score - 5)

    def to_dict(self) -> dict:
        """Converte para dicionário"""
        return {
            "score": self.score,
            "avisos": self.avisos,
            "total_avisos": len(self.avisos)
        }


class FaturaValidator:
    """Validador de faturas extraídas"""

    def __init__(self):
        pass

    def _safe_float(self, valor) -> Optional[float]:
        """Converte valor para float de forma resiliente.

        A API da Energisa pode retornar strings vazias, valores com vírgula
        ou None. Para evitar que a validação quebre durante a comparação,
        convertemos de forma segura e retornamos None se não for possível.
        """
        if valor is None:
            return None

        try:
            if isinstance(valor, str):
                valor = valor.strip().replace(",", ".")
                if valor == "":
                    return None

            return float(valor)
        except (ValueError, TypeError):
            logger.debug(f"Não foi possível converter valor '{valor}' para float durante validação")
            return None

    def validar(
        self,
        dados_extraidos: dict,
        fatura_db: dict,
        dados_energisa: Optional[dict] = None
    ) -> ValidationResult:
        """
        Valida dados extraídos de uma fatura.

        Args:
            dados_extraidos: Dados extraídos pela IA
            fatura_db: Dados da fatura do banco de dados
            dados_energisa: Dados obtidos via API Energisa (se disponível)

        Returns:
            ValidationResult com score e avisos
        """
        resultado = ValidationResult()

        # 1. Validar datas
        self._validar_datas(dados_extraidos, fatura_db, resultado)

        # 2. Validar valores
        self._validar_valores(dados_extraidos, fatura_db, dados_energisa, resultado)

        # 3. Validar campos obrigatórios
        self._validar_campos_obrigatorios(dados_extraidos, resultado)

        # 4. Validar coerência de cálculos
        self._validar_calculos(dados_extraidos, resultado)

        # 5. Validar contra dados da Energisa (se disponível)
        if dados_energisa:
            self._validar_contra_energisa(dados_extraidos, dados_energisa, resultado)

        logger.info(f"Validação concluída: Score={resultado.score}, Avisos={len(resultado.avisos)}")
        return resultado

    def _validar_datas(self, dados: dict, fatura_db: dict, resultado: ValidationResult):
        """Valida datas extraídas"""

        # Validar formato e existência
        campos_data = [
            ("data_apresentacao", "Data de Apresentação"),
            ("vencimento", "Vencimento"),
            ("leitura_anterior_data", "Leitura Anterior"),
            ("leitura_atual_data", "Leitura Atual"),
            ("proxima_leitura_data", "Próxima Leitura")
        ]

        datas_validas = {}

        for campo, nome in campos_data:
            valor = dados.get(campo)

            if not valor and campo in ["data_apresentacao", "vencimento"]:
                resultado.adicionar_aviso(
                    "datas", campo,
                    f"{nome} não foi extraída (campo obrigatório)",
                    "error"
                )
                continue

            if valor:
                try:
                    data = datetime.fromisoformat(valor.replace('Z', '+00:00'))
                    datas_validas[campo] = data
                except ValueError:
                    resultado.adicionar_aviso(
                        "datas", campo,
                        f"{nome} possui formato inválido: {valor}",
                        "error"
                    )

        # Validar coerência entre datas
        if "leitura_anterior_data" in datas_validas and "leitura_atual_data" in datas_validas:
            if datas_validas["leitura_atual_data"] <= datas_validas["leitura_anterior_data"]:
                resultado.adicionar_aviso(
                    "datas", "leitura_atual_data",
                    "Leitura atual não pode ser anterior ou igual à leitura anterior",
                    "error"
                )

        # Validar quantidade de dias
        if "leitura_anterior_data" in datas_validas and "leitura_atual_data" in datas_validas:
            dias_calculados = (datas_validas["leitura_atual_data"] - datas_validas["leitura_anterior_data"]).days
            dias_extraidos = dados.get("dias")

            if dias_extraidos:
                # Aceitar diferença de até 2 dias (tolerância)
                if abs(dias_calculados - dias_extraidos) > 2:
                    resultado.adicionar_aviso(
                        "datas", "dias",
                        f"Dias informados ({dias_extraidos}) diferem dos calculados ({dias_calculados})",
                        "warning"
                    )

        # Validar vencimento vs data de apresentação
        if "data_apresentacao" in datas_validas and "vencimento" in datas_validas:
            if datas_validas["vencimento"] < datas_validas["data_apresentacao"]:
                resultado.adicionar_aviso(
                    "datas", "vencimento",
                    "Vencimento anterior à data de apresentação",
                    "error"
                )

        # Validar mes_ano_referencia
        mes_ano_ref = dados.get("mes_ano_referencia")
        if mes_ano_ref:
            try:
                ano_ref, mes_ref = map(int, mes_ano_ref.split("-"))

                # Verificar se bate com o banco
                if fatura_db.get("mes_referencia") and fatura_db.get("ano_referencia"):
                    if mes_ref != fatura_db["mes_referencia"] or ano_ref != fatura_db["ano_referencia"]:
                        resultado.adicionar_aviso(
                            "datas", "mes_ano_referencia",
                            f"Referência extraída ({mes_ano_ref}) difere do banco ({fatura_db['ano_referencia']}-{fatura_db['mes_referencia']:02d})",
                            "error"
                        )
            except ValueError:
                resultado.adicionar_aviso(
                    "datas", "mes_ano_referencia",
                    f"Formato de referência inválido: {mes_ano_ref}",
                    "error"
                )

    def _validar_valores(self, dados: dict, fatura_db: dict, dados_energisa: Optional[dict], resultado: ValidationResult):
        """Valida valores monetários"""

        # Validar total_a_pagar
        total_extraido = self._safe_float(dados.get("total_a_pagar"))

        if total_extraido is None:
            resultado.adicionar_aviso(
                "valores", "total_a_pagar",
                "Total a pagar não foi extraído",
                "error"
            )
            return

        # Comparar com valor do banco (se disponível)
        valor_fatura_db = self._safe_float(fatura_db.get("valor_fatura"))
        if valor_fatura_db is not None and valor_fatura_db > 0:
            diferenca = abs(total_extraido - valor_fatura_db)
            percentual = (diferenca / valor_fatura_db) * 100

            if percentual > 1:  # Tolerância de 1%
                resultado.adicionar_aviso(
                    "valores", "total_a_pagar",
                    f"Total extraído (R$ {total_extraido:.2f}) difere do banco (R$ {valor_fatura_db:.2f}) em {percentual:.2f}%",
                    "warning"
                )

        # Comparar com dados da Energisa (se disponível)
        valor_fatura_api = self._safe_float(dados_energisa.get("valor_fatura")) if dados_energisa else None
        if valor_fatura_api is not None and valor_fatura_api > 0:
            diferenca = abs(total_extraido - valor_fatura_api)
            percentual = (diferenca / valor_fatura_api) * 100

            if percentual > 1:
                resultado.adicionar_aviso(
                    "valores", "total_a_pagar",
                    f"Total extraído (R$ {total_extraido:.2f}) difere da API Energisa (R$ {valor_fatura_api:.2f}) em {percentual:.2f}%",
                    "error"
                )

        # Validar valores não negativos
        if total_extraido < 0:
            resultado.adicionar_aviso(
                "valores", "total_a_pagar",
                "Total a pagar não pode ser negativo",
                "error"
            )

    def _validar_campos_obrigatorios(self, dados: dict, resultado: ValidationResult):
        """Valida presença de campos obrigatórios"""

        campos_obrigatorios = [
            ("codigo_cliente", "Código do Cliente"),
            ("data_apresentacao", "Data de Apresentação"),
            ("mes_ano_referencia", "Mês/Ano de Referência"),
            ("vencimento", "Vencimento"),
            ("total_a_pagar", "Total a Pagar")
        ]

        for campo, nome in campos_obrigatorios:
            if not dados.get(campo):
                resultado.adicionar_aviso(
                    "campos_obrigatorios", campo,
                    f"{nome} não foi extraído",
                    "error"
                )

    def _validar_calculos(self, dados: dict, resultado: ValidationResult):
        """Valida coerência de cálculos internos"""

        totais = dados.get("totais", {})

        if not totais:
            resultado.adicionar_aviso(
                "calculos", "totais",
                "Seção de totais não foi extraída",
                "warning"
            )
            return

        # Validar soma dos itens
        total_calculado = 0.0

        itens = dados.get("itens_fatura", {})

        # Somar consumo (usando _safe_float para evitar erros com None)
        if itens.get("consumo_kwh") and itens["consumo_kwh"].get("valor"):
            valor = self._safe_float(itens["consumo_kwh"]["valor"])
            if valor is not None:
                total_calculado += valor

        # Somar energia injetada OUC
        if itens.get("energia_injetada_ouc"):
            for item in itens["energia_injetada_ouc"]:
                if item.get("valor"):
                    valor = self._safe_float(item["valor"])
                    if valor is not None:
                        total_calculado += valor

        # Somar energia injetada MUC
        if itens.get("energia_injetada_muc"):
            for item in itens["energia_injetada_muc"]:
                if item.get("valor"):
                    valor = self._safe_float(item["valor"])
                    if valor is not None:
                        total_calculado += valor

        # Somar ajuste lei 14300
        if itens.get("ajuste_lei_14300") and itens["ajuste_lei_14300"].get("valor"):
            valor = self._safe_float(itens["ajuste_lei_14300"]["valor"])
            if valor is not None:
                total_calculado += valor

        # Somar lançamentos e serviços
        if itens.get("lancamentos_e_servicos"):
            for item in itens["lancamentos_e_servicos"]:
                if item.get("valor"):
                    valor = self._safe_float(item["valor"])
                    if valor is not None:
                        total_calculado += valor

        # Comparar com total informado
        # Usar "or 0" para tratar casos onde a chave existe mas o valor é null
        total_itens = self._safe_float(totais.get("itens")) or 0

        if total_itens > 0:
            diferenca = abs(total_calculado - total_itens)
            if diferenca > 0.02:  # Tolerância de 2 centavos
                resultado.adicionar_aviso(
                    "calculos", "totais.itens",
                    f"Soma dos itens calculada (R$ {total_calculado:.2f}) difere do total informado (R$ {total_itens:.2f})",
                    "warning"
                )

        # Validar total final
        # Usar "or 0" para tratar casos onde a chave existe mas o valor é null
        total_final = self._safe_float(totais.get("total")) or 0
        adicionais_bandeira = self._safe_float(totais.get("adicionais_bandeira")) or 0

        total_esperado = total_itens + adicionais_bandeira

        if total_final > 0:
            diferenca = abs(total_esperado - total_final)
            if diferenca > 0.02:
                resultado.adicionar_aviso(
                    "calculos", "totais.total",
                    f"Total calculado (R$ {total_esperado:.2f}) difere do total informado (R$ {total_final:.2f})",
                    "warning"
                )

    def _validar_contra_energisa(self, dados: dict, dados_energisa: dict, resultado: ValidationResult):
        """Valida dados extraídos contra API Energisa"""

        # Validar consumo
        consumo_api = self._safe_float(dados_energisa.get("consumo_kwh"))
        consumo_extraido = None
        if dados.get("itens_fatura", {}).get("consumo_kwh"):
            consumo_extraido = self._safe_float(dados["itens_fatura"]["consumo_kwh"].get("quantidade", 0))

        if consumo_api is not None and consumo_api > 0 and consumo_extraido is not None:
            diferenca_percentual = abs(consumo_api - consumo_extraido) / consumo_api * 100

            if diferenca_percentual > 5:  # Tolerância 5%
                resultado.adicionar_aviso(
                    "energisa_api", "consumo_kwh",
                    f"Consumo extraído ({consumo_extraido} kWh) difere da API Energisa ({consumo_api} kWh) em {diferenca_percentual:.1f}%",
                    "warning"
                )

        # Validar código do cliente
        if dados_energisa.get("codigo_cliente"):
            codigo_api = str(dados_energisa["codigo_cliente"]).strip()
            codigo_extraido = str(dados.get("codigo_cliente", "")).strip()

            if codigo_api != codigo_extraido:
                resultado.adicionar_aviso(
                    "energisa_api", "codigo_cliente",
                    f"Código do cliente extraído ({codigo_extraido}) difere da API Energisa ({codigo_api})",
                    "error"
                )

        # Validar tipo de ligação
        if dados_energisa.get("tipo_ligacao"):
            tipo_api = dados_energisa["tipo_ligacao"].upper()
            tipo_extraido = str(dados.get("ligacao", "")).upper()

            if tipo_api != tipo_extraido:
                resultado.adicionar_aviso(
                    "energisa_api", "ligacao",
                    f"Tipo de ligação extraído ({tipo_extraido}) difere da API Energisa ({tipo_api})",
                    "warning"
                )


def criar_validador() -> FaturaValidator:
    """Factory para criar validador"""
    return FaturaValidator()
