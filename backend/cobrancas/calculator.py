"""
Calculadora de Cobranças GD

Implementa a lógica de cálculo de cobranças baseada em dados extraídos de faturas.
Segue as regras de GD I/II com desconto de assinatura de 30%.
"""

from typing import Optional, Literal
from decimal import Decimal
from datetime import date, timedelta
import logging

from backend.faturas.extraction_schemas import FaturaExtraidaSchema

logger = logging.getLogger(__name__)


class CobrancaCalculada:
    """Resultado do cálculo de uma cobrança"""

    def __init__(self):
        # Identificação
        self.modelo_gd: Literal["GDI", "GDII", "DESCONHECIDO"] = "DESCONHECIDO"
        self.tipo_ligacao: Optional[str] = None

        # Métricas base
        self.consumo_kwh: float = 0
        self.injetada_kwh: float = 0
        self.compensado_kwh: float = 0
        self.gap_kwh: float = 0  # consumo - compensado

        # Tarifas
        self.tarifa_base: Decimal = Decimal("0")
        self.tarifa_assinatura: Decimal = Decimal("0")  # com 30% desc
        self.fio_b: Decimal = Decimal("0")

        # Valores de energia
        self.valor_energia_base: Decimal = Decimal("0")  # injetada × tarifa_base
        self.valor_energia_assinatura: Decimal = Decimal("0")  # injetada × tarifa_assinatura

        # Encargos GD I
        self.taxa_minima_kwh: int = 0
        self.taxa_minima_valor: Decimal = Decimal("0")
        self.energia_excedente_kwh: int = 0
        self.energia_excedente_valor: Decimal = Decimal("0")

        # Encargos GD II
        self.disponibilidade_valor: Decimal = Decimal("0")

        # Extras
        self.bandeiras_valor: Decimal = Decimal("0")
        self.iluminacao_publica_valor: Decimal = Decimal("0")
        self.servicos_valor: Decimal = Decimal("0")

        # Totais
        self.valor_sem_assinatura: Decimal = Decimal("0")
        self.valor_com_assinatura: Decimal = Decimal("0")
        self.economia_mes: Decimal = Decimal("0")
        self.valor_total: Decimal = Decimal("0")

        # PIX/Vencimento
        self.vencimento: Optional[date] = None

    def to_dict(self) -> dict:
        """Converte para dicionário"""
        return {
            "modelo_gd": self.modelo_gd,
            "tipo_ligacao": self.tipo_ligacao,
            "consumo_kwh": self.consumo_kwh,
            "injetada_kwh": self.injetada_kwh,
            "compensado_kwh": self.compensado_kwh,
            "gap_kwh": self.gap_kwh,
            "tarifa_base": float(self.tarifa_base),
            "tarifa_assinatura": float(self.tarifa_assinatura),
            "fio_b": float(self.fio_b),
            "valor_energia_base": float(self.valor_energia_base),
            "valor_energia_assinatura": float(self.valor_energia_assinatura),
            "taxa_minima_kwh": self.taxa_minima_kwh,
            "taxa_minima_valor": float(self.taxa_minima_valor),
            "energia_excedente_kwh": self.energia_excedente_kwh,
            "energia_excedente_valor": float(self.energia_excedente_valor),
            "disponibilidade_valor": float(self.disponibilidade_valor),
            "bandeiras_valor": float(self.bandeiras_valor),
            "iluminacao_publica_valor": float(self.iluminacao_publica_valor),
            "servicos_valor": float(self.servicos_valor),
            "valor_sem_assinatura": float(self.valor_sem_assinatura),
            "valor_com_assinatura": float(self.valor_com_assinatura),
            "economia_mes": float(self.economia_mes),
            "valor_total": float(self.valor_total),
            "vencimento": self.vencimento.isoformat() if self.vencimento else None
        }


class CobrancaCalculator:
    """Calculadora de cobranças GD"""

    # Constantes
    DESCONTO_ASSINATURA = Decimal("0.30")  # 30%

    # Taxa mínima por tipo de ligação (GD I)
    TAXA_MINIMA = {
        "MONOFASICO": 30,
        "BIFASICO": 50,
        "TRIFASICO": 100
    }

    def extrair_tarifa_real_fatura(self, dados: FaturaExtraidaSchema) -> Decimal:
        """
        Extrai a tarifa REAL da fatura (já com impostos PIS/COFINS/ICMS).

        Calcula a partir de: valor_energia_injetada / kwh_injetado
        ou valor_consumo / kwh_consumo

        Returns:
            Tarifa efetiva em R$/kWh (já com todos os tributos)
        """
        # Tentar pegar da energia injetada primeiro (mais preciso)
        injetada_total = dados.calcular_injetada_total()

        # GD II (mUC)
        if dados.itens_fatura.energia_injetada_muc:
            for item in dados.itens_fatura.energia_injetada_muc:
                if item.quantidade and item.quantidade > 0 and item.valor:
                    tarifa = abs(item.valor) / Decimal(str(item.quantidade))
                    logger.info(f"Tarifa extraída da injetada mUC: R$ {tarifa:.6f}/kWh")
                    return tarifa

        # GD I (oUC)
        if dados.itens_fatura.energia_injetada_ouc:
            for item in dados.itens_fatura.energia_injetada_ouc:
                if item.quantidade and item.quantidade > 0 and item.valor:
                    tarifa = abs(item.valor) / Decimal(str(item.quantidade))
                    logger.info(f"Tarifa extraída da injetada oUC: R$ {tarifa:.6f}/kWh")
                    return tarifa

        # Fallback: usar consumo
        if dados.itens_fatura.consumo_kwh:
            consumo = dados.itens_fatura.consumo_kwh
            if consumo.quantidade and consumo.quantidade > 0 and consumo.valor:
                tarifa = abs(consumo.valor) / Decimal(str(consumo.quantidade))
                logger.info(f"Tarifa extraída do consumo: R$ {tarifa:.6f}/kWh")
                return tarifa

        logger.warning("Não foi possível extrair tarifa da fatura, usando padrão R$ 0.76")
        return Decimal("0.76")

    def calcular_cobranca(
        self,
        dados_extraidos: FaturaExtraidaSchema,
        tarifa_aneel: Optional[Decimal] = None,
        fio_b: Optional[Decimal] = None,
        desconto_personalizado: Optional[Decimal] = None
    ) -> CobrancaCalculada:
        """
        Calcula cobrança baseada nos dados extraídos da fatura.

        Args:
            dados_extraidos: Dados estruturados da fatura
            tarifa_aneel: Tarifa base da ANEEL (R$/kWh) - OPCIONAL, será extraída da fatura se não fornecida
            fio_b: Valor do Fio B (opcional)
            desconto_personalizado: Desconto diferente de 30% (opcional)

        Returns:
            Objeto com todos os valores calculados
        """
        resultado = CobrancaCalculada()

        # 1. Detectar modelo GD
        resultado.modelo_gd = dados_extraidos.detectar_modelo_gd()
        resultado.tipo_ligacao = dados_extraidos.ligacao

        logger.info(f"Calculando cobrança - Modelo: {resultado.modelo_gd}, Ligação: {resultado.tipo_ligacao}")

        # 2. Métricas de energia
        resultado.consumo_kwh = float(dados_extraidos.itens_fatura.consumo_kwh.quantidade or 0)
        resultado.injetada_kwh = dados_extraidos.calcular_injetada_total()

        # Compensado é o que foi efetivamente usado dos créditos
        # Em GD, nem sempre injetada = compensada (pode haver perdas, transferências, etc)
        resultado.compensado_kwh = self._calcular_compensado(dados_extraidos)

        resultado.gap_kwh = max(0, resultado.consumo_kwh - resultado.compensado_kwh)

        # 3. Tarifas - USAR TARIFA REAL DA FATURA (com impostos)
        desconto = desconto_personalizado or self.DESCONTO_ASSINATURA

        # Extrair tarifa real da fatura se não foi fornecida
        if tarifa_aneel is None:
            resultado.tarifa_base = self.extrair_tarifa_real_fatura(dados_extraidos)
            logger.info(f"Usando tarifa REAL extraída da fatura: R$ {resultado.tarifa_base:.6f}/kWh (JÁ COM IMPOSTOS)")
        else:
            resultado.tarifa_base = tarifa_aneel
            logger.info(f"Usando tarifa fornecida: R$ {resultado.tarifa_base:.6f}/kWh")

        resultado.tarifa_assinatura = resultado.tarifa_base * (Decimal("1") - desconto)
        resultado.fio_b = fio_b or Decimal("0")

        # 4. Valores de energia (base vs assinatura)
        resultado.valor_energia_base = Decimal(str(resultado.injetada_kwh)) * resultado.tarifa_base
        resultado.valor_energia_assinatura = Decimal(str(resultado.injetada_kwh)) * resultado.tarifa_assinatura

        # 5. Calcular encargos baseado no modelo GD
        if resultado.modelo_gd == "GDI":
            self._calcular_gd1(resultado, dados_extraidos)
        elif resultado.modelo_gd == "GDII":
            self._calcular_gd2(resultado, dados_extraidos)

        # 6. Extras (bandeiras, iluminação, serviços)
        self._calcular_extras(resultado, dados_extraidos)

        # 7. Totais finais
        self._calcular_totais(resultado)

        # 8. Vencimento (1 dia antes da fatura)
        if dados_extraidos.vencimento:
            resultado.vencimento = dados_extraidos.vencimento - timedelta(days=1)

        logger.info(f"Cobrança calculada - Total: R$ {resultado.valor_total:.2f}, Economia: R$ {resultado.economia_mes:.2f}")

        return resultado

    def _calcular_compensado(self, dados: FaturaExtraidaSchema) -> float:
        """
        Calcula kWh efetivamente compensado.

        Por enquanto, usa injetada total. Futuramente pode considerar
        dados de histórico_gd para pegar compensado real.
        """
        return dados.calcular_injetada_total()

    def _calcular_gd1(self, resultado: CobrancaCalculada, dados: FaturaExtraidaSchema):
        """
        Calcula encargos para GD I (modelo antigo).

        Regra:
        - Se gap > taxa_minima → cobra gap como energia excedente
        - Se gap <= taxa_minima → cobra taxa_minima fixa
        """
        if not resultado.tipo_ligacao:
            logger.warning("Tipo de ligação não identificado, assumindo MONOFASICO")
            resultado.tipo_ligacao = "MONOFASICO"

        taxa_min_kwh = self.TAXA_MINIMA.get(resultado.tipo_ligacao, 30)
        resultado.taxa_minima_kwh = taxa_min_kwh

        gap = resultado.gap_kwh

        if gap > taxa_min_kwh:
            # Cobra excedente
            resultado.energia_excedente_kwh = int(gap)
            resultado.energia_excedente_valor = Decimal(str(gap)) * resultado.tarifa_base
            resultado.taxa_minima_valor = Decimal("0")
            logger.debug(f"GD I: Cobrando excedente de {gap:.0f} kWh")
        else:
            # Cobra taxa mínima
            resultado.taxa_minima_valor = Decimal(str(taxa_min_kwh)) * resultado.tarifa_base
            resultado.energia_excedente_kwh = 0
            resultado.energia_excedente_valor = Decimal("0")
            logger.debug(f"GD I: Cobrando taxa mínima de {taxa_min_kwh} kWh")

    def _calcular_gd2(self, resultado: CobrancaCalculada, dados: FaturaExtraidaSchema):
        """
        Calcula encargos para GD II (Lei 14.300/22).

        Cobra disponibilidade (ajuste tarifário).
        """
        if dados.itens_fatura.ajuste_lei_14300 and dados.itens_fatura.ajuste_lei_14300.valor:
            resultado.disponibilidade_valor = abs(dados.itens_fatura.ajuste_lei_14300.valor)
            logger.debug(f"GD II: Disponibilidade R$ {resultado.disponibilidade_valor:.2f}")
        else:
            resultado.disponibilidade_valor = Decimal("0")
            logger.warning("GD II detectado mas sem ajuste Lei 14.300 na fatura")

    def _calcular_extras(self, resultado: CobrancaCalculada, dados: FaturaExtraidaSchema):
        """Calcula valores extras (bandeiras, iluminação, serviços)"""

        # Bandeiras
        resultado.bandeiras_valor = dados.totais.adicionais_bandeira or Decimal("0")

        # Iluminação pública
        resultado.iluminacao_publica_valor = dados.extrair_valor_iluminacao_publica()

        # Serviços (outros lançamentos, exceto iluminação)
        servicos_total = Decimal("0")
        for lanc in dados.itens_fatura.lancamentos_e_servicos:
            if lanc.descricao and "ilum" not in lanc.descricao.lower():
                servicos_total += (lanc.valor or Decimal("0"))

        resultado.servicos_valor = servicos_total

        logger.debug(
            f"Extras - Bandeiras: R$ {resultado.bandeiras_valor:.2f}, "
            f"Iluminação: R$ {resultado.iluminacao_publica_valor:.2f}, "
            f"Serviços: R$ {resultado.servicos_valor:.2f}"
        )

    def _calcular_totais(self, resultado: CobrancaCalculada):
        """Calcula totais finais e economia"""

        # Encargos fixos (independente de assinatura)
        encargos_fixos = (
            resultado.taxa_minima_valor +
            resultado.energia_excedente_valor +
            resultado.disponibilidade_valor +
            resultado.bandeiras_valor +
            resultado.iluminacao_publica_valor +
            resultado.servicos_valor
        )

        # Sem assinatura (tarifa cheia)
        resultado.valor_sem_assinatura = resultado.valor_energia_base + encargos_fixos

        # Com assinatura (tarifa com desconto)
        resultado.valor_com_assinatura = resultado.valor_energia_assinatura + encargos_fixos

        # Economia mensal
        resultado.economia_mes = resultado.valor_sem_assinatura - resultado.valor_com_assinatura

        # Valor total a pagar (com assinatura)
        resultado.valor_total = resultado.valor_com_assinatura

    def calcular_vencimento_sugerido(self, vencimento_fatura: date) -> date:
        """
        Calcula vencimento sugerido para a cobrança.

        Regra: 1 dia antes do vencimento da fatura.

        Args:
            vencimento_fatura: Data de vencimento da fatura da Energisa

        Returns:
            Data sugerida para vencimento da cobrança
        """
        return vencimento_fatura - timedelta(days=1)

    def validar_dados_minimos(self, dados: FaturaExtraidaSchema) -> tuple[bool, Optional[str]]:
        """
        Valida se os dados extraídos têm informação mínima para cálculo.

        Args:
            dados: Dados extraídos

        Returns:
            Tupla (válido, mensagem_erro)
        """
        # Verificar campos críticos
        if not dados.itens_fatura.consumo_kwh:
            return False, "Consumo em kWh não encontrado"

        if dados.itens_fatura.consumo_kwh.quantidade is None:
            return False, "Quantidade de consumo não encontrada"

        # Verificar se tem energia injetada OU é fatura sem GD
        tem_injetada = (
            len(dados.itens_fatura.energia_injetada_ouc) > 0 or
            len(dados.itens_fatura.energia_injetada_muc) > 0
        )

        if not tem_injetada:
            return False, "Nenhuma energia injetada encontrada (não é fatura GD?)"

        # Verificar vencimento
        if not dados.vencimento:
            return False, "Data de vencimento não encontrada"

        return True, None
