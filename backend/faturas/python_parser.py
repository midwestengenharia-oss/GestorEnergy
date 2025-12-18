"""
Parser Python Puro para Faturas da Energisa

Extrai dados estruturados do texto de faturas usando regex e parsing de texto.
NÃO usa IA - apenas Python puro.
"""

import re
from typing import Optional, List, Tuple
from decimal import Decimal
from datetime import datetime, date
from .extraction_schemas import (
    FaturaExtraidaSchema,
    ConsumoKwhExtracted,
    EnergiaInjetadaItemExtracted,
    AjusteLei14300Extracted,
    LancamentoServicoExtracted,
    ItensFaturaExtracted,
    TotaisExtracted,
    QuadroAtencaoExtracted
)


class FaturaPythonParser:
    """Parser de faturas da Energisa usando Python puro"""

    # Mapeamento de meses em português
    MESES_PT = {
        'janeiro': 1, 'jan': 1,
        'fevereiro': 2, 'fev': 2,
        'março': 3, 'mar': 3, 'marco': 3,
        'abril': 4, 'abr': 4,
        'maio': 5, 'mai': 5,
        'junho': 6, 'jun': 6,
        'julho': 7, 'jul': 7,
        'agosto': 8, 'ago': 8,
        'setembro': 9, 'set': 9,
        'outubro': 10, 'out': 10,
        'novembro': 11, 'nov': 11,
        'dezembro': 12, 'dez': 12
    }

    def parse(self, texto: str) -> FaturaExtraidaSchema:
        """
        Faz o parsing completo do texto da fatura.

        Args:
            texto: Texto extraído do PDF

        Returns:
            Dados estruturados da fatura
        """
        # Normalizar texto
        texto = texto.upper()  # Facilita regex

        # Extrair cada seção
        codigo_cliente = self._extrair_codigo_cliente(texto)
        ligacao = self._extrair_tipo_ligacao(texto)
        data_apresentacao = self._extrair_data_apresentacao(texto)
        mes_ano_ref = self._extrair_mes_ano_referencia(texto)
        vencimento = self._extrair_vencimento(texto)
        total_pagar = self._extrair_total_pagar(texto)

        # Datas de leitura
        leitura_ant_data = self._extrair_leitura_anterior_data(texto)
        leitura_atual_data = self._extrair_leitura_atual_data(texto)
        dias = self._extrair_dias(texto)
        proxima_leitura = self._extrair_proxima_leitura(texto)

        # Leituras do medidor
        leitura_ant = self._extrair_leitura_anterior(texto)
        leitura_atual = self._extrair_leitura_atual(texto)

        # Itens da fatura
        itens = self._extrair_itens_fatura(texto)

        # Totais
        totais = self._extrair_totais(texto, itens)

        # Quadro de atenção
        quadro_atencao = self._extrair_quadro_atencao(texto)

        # Bandeira
        bandeira = self._extrair_bandeira(texto)

        return FaturaExtraidaSchema(
            codigo_cliente=codigo_cliente,
            ligacao=ligacao,
            data_apresentacao=data_apresentacao,
            mes_ano_referencia=mes_ano_ref,
            vencimento=vencimento,
            total_a_pagar=total_pagar,
            leitura_anterior_data=leitura_ant_data,
            leitura_atual_data=leitura_atual_data,
            dias=dias,
            proxima_leitura_data=proxima_leitura,
            leitura_anterior=leitura_ant,
            leitura_atual=leitura_atual,
            itens_fatura=itens,
            totais=totais,
            quadro_atencao=quadro_atencao,
            bandeira_tarifaria=bandeira
        )

    def _extrair_codigo_cliente(self, texto: str) -> Optional[str]:
        """Extrai código do cliente (formato 6/XXXXXXXX-X)"""
        patterns = [
            r'(?:C[ÓO]DIGO\s+(?:DO\s+)?CLIENTE|CLIENTE)[:\s]+(\d/\d{7,8}-\d)',
            r'(\d/\d{7,8}-\d)',  # Padrão direto
        ]

        for pattern in patterns:
            match = re.search(pattern, texto)
            if match:
                return match.group(1).replace(' ', '')

        return None

    def _extrair_tipo_ligacao(self, texto: str) -> Optional[str]:
        """Extrai tipo de ligação"""
        patterns = [
            r'(?:LIGA[ÇC][ÃA]O|TIPO\s+DE\s+LIGA[ÇC][ÃA]O)[:\s]+(MONOF[ÁA]SIC[OA]|BIF[ÁA]SIC[OA]|TRIF[ÁA]SIC[OA])',
            r'\b(MONOF[ÁA]SIC[OA]|BIF[ÁA]SIC[OA]|TRIF[ÁA]SIC[OA])\b'
        ]

        for pattern in patterns:
            match = re.search(pattern, texto)
            if match:
                tipo = match.group(1)
                # Normalizar
                if 'MONO' in tipo:
                    return "MONOFASICO"
                elif 'BIF' in tipo:
                    return "BIFASICO"
                elif 'TRIF' in tipo:
                    return "TRIFASICO"

        return None

    def _extrair_data_apresentacao(self, texto: str) -> Optional[date]:
        """Extrai data de apresentação"""
        patterns = [
            r'(?:DATA\s+DE\s+)?APRESENTA[ÇC][ÃA]O[:\s]+(\d{2}[/\-]\d{2}[/\-]\d{4})',
            r'EMISS[ÃA]O[:\s]+(\d{2}[/\-]\d{2}[/\-]\d{4})'
        ]

        for pattern in patterns:
            match = re.search(pattern, texto)
            if match:
                return self._parse_data_br(match.group(1))

        return None

    def _extrair_mes_ano_referencia(self, texto: str) -> Optional[str]:
        """Extrai mês/ano de referência (retorna YYYY-MM)"""
        # Padrão: SETEMBRO / 2025 ou SET/25
        patterns = [
            r'REFER[ÊE]NCIA[:\s]+([A-Z]+)\s*[/\-]\s*(\d{4})',
            r'([A-Z]+)\s*[/\-]\s*(\d{2,4})',
            r'M[ÊE]S[:\s]+([A-Z]+)[/\s]+(\d{4})'
        ]

        for pattern in patterns:
            match = re.search(pattern, texto)
            if match:
                mes_nome = match.group(1).lower()
                ano_str = match.group(2)

                # Converter mês nome para número
                mes_num = None
                for nome, num in self.MESES_PT.items():
                    if nome in mes_nome:
                        mes_num = num
                        break

                if mes_num:
                    # Normalizar ano (se vier 25, converter para 2025)
                    ano = int(ano_str)
                    if ano < 100:
                        ano = 2000 + ano

                    return f"{ano:04d}-{mes_num:02d}"

        return None

    def _extrair_vencimento(self, texto: str) -> Optional[date]:
        """Extrai data de vencimento"""
        patterns = [
            r'VENCIMENTO[:\s]+(\d{2}[/\-]\d{2}[/\-]\d{4})',
            r'VENC[:\s]+(\d{2}[/\-]\d{2}[/\-]\d{4})'
        ]

        for pattern in patterns:
            match = re.search(pattern, texto)
            if match:
                return self._parse_data_br(match.group(1))

        return None

    def _extrair_total_pagar(self, texto: str) -> Optional[Decimal]:
        """Extrai total a pagar"""
        patterns = [
            r'TOTAL\s+A\s+PAGAR[:\s]+R?\$?\s*([\d.,]+)',
            r'VALOR\s+(?:COBRADO|DO\s+DOCUMENTO)[:\s]+R?\$?\s*([\d.,]+)'
        ]

        for pattern in patterns:
            match = re.search(pattern, texto)
            if match:
                return self._parse_decimal_br(match.group(1))

        return None

    def _extrair_leitura_anterior_data(self, texto: str) -> Optional[date]:
        """Extrai data da leitura anterior"""
        pattern = r'LEITURA\s+ANTERIOR[:\s]+(\d{2}[/\-]\d{2}[/\-]\d{4})'
        match = re.search(pattern, texto)
        if match:
            return self._parse_data_br(match.group(1))
        return None

    def _extrair_leitura_atual_data(self, texto: str) -> Optional[date]:
        """Extrai data da leitura atual"""
        pattern = r'LEITURA\s+ATUAL[:\s]+(\d{2}[/\-]\d{2}[/\-]\d{4})'
        match = re.search(pattern, texto)
        if match:
            return self._parse_data_br(match.group(1))
        return None

    def _extrair_dias(self, texto: str) -> Optional[int]:
        """Extrai quantidade de dias"""
        patterns = [
            r'(\d+)\s+DIAS?',
            r'DIAS?[:\s]+(\d+)'
        ]

        for pattern in patterns:
            match = re.search(pattern, texto)
            if match:
                return int(match.group(1))

        return None

    def _extrair_proxima_leitura(self, texto: str) -> Optional[date]:
        """Extrai data da próxima leitura"""
        pattern = r'PR[ÓO]XIMA\s+LEITURA[:\s]+(\d{2}[/\-]\d{2}[/\-]\d{4})'
        match = re.search(pattern, texto)
        if match:
            return self._parse_data_br(match.group(1))
        return None

    def _extrair_leitura_anterior(self, texto: str) -> Optional[int]:
        """Extrai valor da leitura anterior do medidor"""
        # Procurar em contexto de tabela de leituras
        pattern = r'(?:ANTERIOR|ANT\.?)[:\s|]+(\d+)\s*KWH'
        match = re.search(pattern, texto)
        if match:
            return int(match.group(1))
        return None

    def _extrair_leitura_atual(self, texto: str) -> Optional[int]:
        """Extrai valor da leitura atual do medidor"""
        pattern = r'(?:ATUAL|AT\.?)[:\s|]+(\d+)\s*KWH'
        match = re.search(pattern, texto)
        if match:
            return int(match.group(1))
        return None

    def _extrair_itens_fatura(self, texto: str) -> ItensFaturaExtracted:
        """Extrai todos os itens da fatura"""

        # 1. Consumo em kWh
        consumo = self._extrair_consumo_kwh(texto)

        # 2. Energia Injetada oUC
        injetada_ouc = self._extrair_energia_injetada_ouc(texto)

        # 3. Energia Injetada mUC
        injetada_muc = self._extrair_energia_injetada_muc(texto)

        # 4. Ajuste Lei 14.300
        ajuste = self._extrair_ajuste_lei_14300(texto)

        # 5. Lançamentos e Serviços
        lancamentos = self._extrair_lancamentos_servicos(texto)

        return ItensFaturaExtracted(
            consumo_kwh=consumo,
            energia_injetada_ouc=injetada_ouc,
            energia_injetada_muc=injetada_muc,
            ajuste_lei_14300=ajuste,
            lancamentos_e_servicos=lancamentos
        )

    def _extrair_consumo_kwh(self, texto: str) -> Optional[ConsumoKwhExtracted]:
        """Extrai linha de consumo em kWh"""
        # Padrão: CONSUMO EM KWH | KWH | 150 | 0,85 | 127,50
        pattern = r'CONSUMO\s+(?:EM\s+)?KWH[|\s]+KWH[|\s]+([\d.,]+)[|\s]+([\d.,]+)[|\s]+([\d.,]+)'

        match = re.search(pattern, texto)
        if match:
            return ConsumoKwhExtracted(
                unidade="KWH",
                quantidade=self._parse_float_br(match.group(1)),
                preco_unit_com_tributos=self._parse_decimal_br(match.group(2)),
                valor=self._parse_decimal_br(match.group(3))
            )

        return None

    def _extrair_energia_injetada_ouc(self, texto: str) -> List[EnergiaInjetadaItemExtracted]:
        """Extrai itens de energia injetada oUC"""
        return self._extrair_energia_injetada(texto, tipo="OUC")

    def _extrair_energia_injetada_muc(self, texto: str) -> List[EnergiaInjetadaItemExtracted]:
        """Extrai itens de energia injetada mUC"""
        return self._extrair_energia_injetada(texto, tipo="MUC")

    def _extrair_energia_injetada(self, texto: str, tipo: str) -> List[EnergiaInjetadaItemExtracted]:
        """
        Extrai itens de energia injetada (oUC ou mUC).

        Padrão esperado:
        ENERGIA AT[IVA] INJETADA [GDII|GDI] [o|m]UC [referência] | KWH | quantidade | preço | valor
        """
        itens = []

        # Regex mais flexível para capturar variações
        tipo_pattern = r'[OM]\s*UC' if tipo == "OUC" else r'M\s*UC'

        # Encontrar todas as linhas de energia injetada
        pattern = (
            r'ENERGIA\s+AT(?:IVA|V)?\s+INJETADA.*?' +
            tipo_pattern +
            r'.*?\|?\s*KWH\s*\|?\s*([\d.,]+)\s*\|?\s*([\d.,]+)\s*\|?\s*([\-\d.,]+)'
        )

        for match in re.finditer(pattern, texto):
            # Capturar a linha completa para análise
            linha_completa = match.group(0)

            # Detectar tipo GD
            tipo_gd = None
            if 'GD' in linha_completa:
                if 'GDII' in linha_completa or 'GD II' in linha_completa or 'GD 2' in linha_completa:
                    tipo_gd = "GDII"
                elif 'GDI' in linha_completa or 'GD I' in linha_completa or 'GD 1' in linha_completa:
                    tipo_gd = "GDI"

            # Tentar extrair mês/ano de referência (ex: 09/2025, SET/25)
            mes_ano_item = self._extrair_mes_ano_item(linha_completa)

            itens.append(EnergiaInjetadaItemExtracted(
                descricao=linha_completa.strip()[:100],  # Limitar tamanho
                tipo_gd=tipo_gd,
                unidade="KWH",
                quantidade=self._parse_float_br(match.group(1)),
                preco_unit_com_tributos=self._parse_decimal_br(match.group(2)),
                valor=self._parse_decimal_br(match.group(3)),
                mes_ano_referencia_item=mes_ano_item
            ))

        return itens

    def _extrair_mes_ano_item(self, linha: str) -> Optional[str]:
        """Extrai mês/ano de referência de um item específico"""
        # Padrão: 09/2025 ou SET/25
        patterns = [
            r'(\d{2})/(\d{4})',  # 09/2025
            r'(\d{2})/(\d{2})',  # 09/25
            r'([A-Z]{3})/(\d{2,4})'  # SET/25
        ]

        for pattern in patterns:
            match = re.search(pattern, linha)
            if match:
                mes_str = match.group(1)
                ano_str = match.group(2)

                # Se mês é texto, converter
                if mes_str.isalpha():
                    mes = self.MESES_PT.get(mes_str.lower())
                    if not mes:
                        continue
                else:
                    mes = int(mes_str)

                ano = int(ano_str)
                if ano < 100:
                    ano = 2000 + ano

                return f"{ano:04d}-{mes:02d}"

        return None

    def _extrair_ajuste_lei_14300(self, texto: str) -> Optional[AjusteLei14300Extracted]:
        """Extrai ajuste GD II - Lei 14.300/22"""
        pattern = r'AJUSTE.*?LEI\s+14\.?300.*?\|?\s*KWH\s*\|?\s*([\d.,]+)\s*\|?\s*([\d.,]+)\s*\|?\s*([\d.,]+)'

        match = re.search(pattern, texto)
        if match:
            return AjusteLei14300Extracted(
                descricao=match.group(0)[:100],
                unidade="KWH",
                quantidade=self._parse_float_br(match.group(1)),
                preco_unit_com_tributos=self._parse_decimal_br(match.group(2)),
                valor=self._parse_decimal_br(match.group(3))
            )

        return None

    def _extrair_lancamentos_servicos(self, texto: str) -> List[LancamentoServicoExtracted]:
        """Extrai lançamentos e serviços"""
        lancamentos = []

        # Procurar seção de lançamentos
        secao_pattern = r'LAN[ÇC]AMENTOS\s+E\s+SERVI[ÇC]OS(.*?)(?:TOTAL|RESUMO|$)'
        secao_match = re.search(secao_pattern, texto, re.DOTALL)

        if not secao_match:
            # Tentar padrões comuns de lançamentos mesmo fora da seção
            secao_texto = texto
        else:
            secao_texto = secao_match.group(1)

        # Padrões comuns de lançamentos
        # Formato: CONTRIB DE ILUM PUB | 35,00
        patterns = [
            r'(CONTRIB.*?ILUM.*?PUB.*?)[|\s]+([\d.,]+)',
            r'((?:MULTA|JUROS).*?)[|\s]+([\d.,]+)',
            r'(BANDEIRA.*?)[|\s]+([\d.,]+)',
            r'(ADIC\.\s*B\.?\s*(?:AMARELA|VERMELHA)[^\d\n]*)\s+([\d.,]+)',
            r'([A-Z\s]{10,50}?)[|\s]+(\-?[\d.,]+)'  # Genérico
        ]

        encontrados = set()  # Evitar duplicatas
        for pattern in patterns:
            for match in re.finditer(pattern, secao_texto):
                descricao = match.group(1).strip()
                valor_str = match.group(2)

                # Evitar duplicatas
                key = (descricao, valor_str)
                if key in encontrados:
                    continue
                encontrados.add(key)

                lancamentos.append(LancamentoServicoExtracted(
                    descricao=descricao,
                    valor=self._parse_decimal_br(valor_str)
                ))

        return lancamentos

    def _extrair_totais(self, texto: str, itens: ItensFaturaExtracted) -> TotaisExtracted:
        """Extrai totais calculados"""

        # Adicionais de bandeira
        adicionais_bandeira = Decimal("0")
        for lanc in itens.lancamentos_e_servicos:
            if lanc.descricao and 'BANDEIRA' in lanc.descricao:
                adicionais_bandeira += (lanc.valor or Decimal("0"))

        # Soma de lançamentos
        total_lancamentos = sum(
            (lanc.valor or Decimal("0"))
            for lanc in itens.lancamentos_e_servicos
        )

        # Total geral (já foi extraído em _extrair_total_pagar)
        total_geral = self._extrair_total_pagar(texto)

        return TotaisExtracted(
            adicionais_bandeira=adicionais_bandeira if adicionais_bandeira != 0 else None,
            lancamentos_e_servicos=total_lancamentos if total_lancamentos != 0 else None,
            total_geral_fatura=total_geral
        )

    def _extrair_quadro_atencao(self, texto: str) -> Optional[QuadroAtencaoExtracted]:
        """Extrai informações do quadro de atenção (GD)"""
        saldo_acum = None
        a_expirar = None

        # Saldo acumulado
        pattern_saldo = r'SALDO\s+ACUMULADO[:\s]+([\d.,]+)'
        match = re.search(pattern_saldo, texto)
        if match:
            saldo_acum = self._parse_decimal_br(match.group(1))

        # A expirar
        pattern_expirar = r'A\s+EXPIRAR.*?CICLO[:\s]+([\d.,]+)'
        match = re.search(pattern_expirar, texto)
        if match:
            a_expirar = self._parse_decimal_br(match.group(1))

        if saldo_acum is not None or a_expirar is not None:
            return QuadroAtencaoExtracted(
                saldo_acumulado=saldo_acum,
                a_expirar_proximo_ciclo=a_expirar
            )

        return None

    def _extrair_bandeira(self, texto: str) -> Optional[str]:
        """Extrai bandeira tarifária"""
        pattern = r'BANDEIRA[:\s]+(VERDE|AMARELA|VERMELHA\s+(?:I|II)?)'
        match = re.search(pattern, texto)
        if match:
            return match.group(1).strip()
        return None

    # ===== Utilitários =====

    def _parse_data_br(self, data_str: str) -> Optional[date]:
        """Converte data BR (DD/MM/YYYY) para date"""
        try:
            # Limpar e normalizar
            data_str = data_str.strip().replace('-', '/')
            dia, mes, ano = data_str.split('/')
            return date(int(ano), int(mes), int(dia))
        except:
            return None

    def _parse_decimal_br(self, valor_str: str) -> Optional[Decimal]:
        """Converte número BR (1.234,56) para Decimal"""
        try:
            # Limpar
            valor_str = valor_str.strip().replace('R$', '').replace(' ', '')

            # Se tem vírgula, é BR
            if ',' in valor_str:
                # Remover pontos (milhares) e trocar vírgula por ponto
                valor_str = valor_str.replace('.', '').replace(',', '.')
            # Senão, já está no formato correto

            return Decimal(valor_str)
        except:
            return None

    def _parse_float_br(self, valor_str: str) -> Optional[float]:
        """Converte número BR para float"""
        decimal_val = self._parse_decimal_br(valor_str)
        return float(decimal_val) if decimal_val is not None else None
