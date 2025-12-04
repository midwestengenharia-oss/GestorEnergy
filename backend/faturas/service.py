"""
Faturas Service - Lógica de negócio para Faturas
"""

from typing import Optional, List, Tuple
from decimal import Decimal
import logging
from datetime import datetime, timezone, date
import re

from backend.core.database import db_admin


def parse_date(date_str: str) -> Optional[str]:
    """
    Converte data da Energisa (DD/MM/YYYY ou DD/MM/YYYY HH:MM:SS) para ISO format.
    """
    if not date_str:
        return None

    try:
        formats = [
            "%d/%m/%Y %H:%M:%S",
            "%d/%m/%Y",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d",
        ]

        for fmt in formats:
            try:
                dt = datetime.strptime(date_str, fmt)
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                continue

        match = re.search(r'(\d{4})-(\d{2})-(\d{2})', date_str)
        if match:
            return date_str[:10]

        return None
    except Exception:
        return None


from backend.core.exceptions import NotFoundError, ValidationError
from backend.faturas.schemas import (
    FaturaManualRequest,
    FaturaResponse,
    FaturaFiltros,
    FaturaResumoResponse,
    UCFaturaResponse,
    HistoricoGDResponse,
    EstatisticasFaturaResponse,
    ComparativoMensalResponse,
)

logger = logging.getLogger(__name__)


class FaturasService:
    """Serviço de gestão de Faturas"""

    def __init__(self):
        self.db = db_admin

    def _formatar_uc(self, cod_empresa: int, cdc: int, digito: int) -> str:
        """Formata UC para exibição"""
        return f"{cod_empresa}/{cdc}-{digito}"

    async def listar(
        self,
        filtros: Optional[FaturaFiltros] = None,
        page: int = 1,
        per_page: int = 20
    ) -> Tuple[List[FaturaResponse], int]:
        """
        Lista faturas com filtros e paginação.

        Args:
            filtros: Filtros de busca
            page: Página atual
            per_page: Itens por página

        Returns:
            Tupla (lista de faturas, total)
        """
        query = self.db.faturas().select(
            "*",
            "unidades_consumidoras!faturas_uc_id_fkey(id, cod_empresa, cdc, digito_verificador, nome_titular, cidade, uf, usuario_id)",
            count="exact"
        )

        # Aplicar filtros
        if filtros:
            # Filtro por usuário: busca UCs do usuário primeiro
            if filtros.usuario_id:
                uc_result = self.db.unidades_consumidoras().select("id").eq(
                    "usuario_id", filtros.usuario_id
                ).execute()
                uc_ids = [uc["id"] for uc in (uc_result.data or [])]
                if uc_ids:
                    query = query.in_("uc_id", uc_ids)
                else:
                    # Usuário não tem UCs, retorna lista vazia
                    return [], 0

            if filtros.uc_id:
                query = query.eq("uc_id", filtros.uc_id)
            if filtros.mes_referencia:
                query = query.eq("mes_referencia", filtros.mes_referencia)
            if filtros.ano_referencia:
                query = query.eq("ano_referencia", filtros.ano_referencia)
            if filtros.situacao_pagamento:
                query = query.eq("situacao_pagamento", filtros.situacao_pagamento)
            if filtros.data_vencimento_inicio:
                query = query.gte("data_vencimento", filtros.data_vencimento_inicio.isoformat())
            if filtros.data_vencimento_fim:
                query = query.lte("data_vencimento", filtros.data_vencimento_fim.isoformat())

        # Paginação
        offset = (page - 1) * per_page
        query = query.range(offset, offset + per_page - 1)

        # Ordenação (mais recentes primeiro)
        query = query.order("ano_referencia", desc=True).order("mes_referencia", desc=True)

        result = query.execute()

        faturas = []
        for f in result.data or []:
            faturas.append(self._build_response(f))

        total = result.count if result.count else len(faturas)
        return faturas, total

    def _build_response(self, f: dict) -> FaturaResponse:
        """Constrói resposta da fatura"""
        uc = None
        if f.get("unidades_consumidoras"):
            uc_data = f["unidades_consumidoras"]
            uc = UCFaturaResponse(
                id=uc_data["id"],
                uc_formatada=self._formatar_uc(
                    uc_data["cod_empresa"], uc_data["cdc"], uc_data["digito_verificador"]
                ),
                nome_titular=uc_data.get("nome_titular"),
                cidade=uc_data.get("cidade"),
                uf=uc_data.get("uf")
            )

        return FaturaResponse(
            id=f["id"],
            uc_id=f["uc_id"],
            numero_fatura=f.get("numero_fatura"),
            mes_referencia=f["mes_referencia"],
            ano_referencia=f["ano_referencia"],
            referencia_formatada=f"{f['mes_referencia']:02d}/{f['ano_referencia']}",
            valor_fatura=Decimal(str(f["valor_fatura"])),
            valor_liquido=Decimal(str(f["valor_liquido"])) if f.get("valor_liquido") else None,
            consumo=f.get("consumo"),
            leitura_atual=f.get("leitura_atual"),
            leitura_anterior=f.get("leitura_anterior"),
            media_consumo=f.get("media_consumo"),
            quantidade_dias=f.get("quantidade_dias"),
            valor_iluminacao_publica=Decimal(str(f["valor_iluminacao_publica"])) if f.get("valor_iluminacao_publica") else None,
            valor_icms=Decimal(str(f["valor_icms"])) if f.get("valor_icms") else None,
            bandeira_tarifaria=f.get("bandeira_tarifaria"),
            data_leitura=f.get("data_leitura"),
            data_vencimento=f["data_vencimento"],
            data_pagamento=f.get("data_pagamento"),
            indicador_situacao=f.get("indicador_situacao"),
            indicador_pagamento=f.get("indicador_pagamento"),
            situacao_pagamento=f.get("situacao_pagamento"),
            servico_distribuicao=Decimal(str(f["servico_distribuicao"])) if f.get("servico_distribuicao") else None,
            compra_energia=Decimal(str(f["compra_energia"])) if f.get("compra_energia") else None,
            servico_transmissao=Decimal(str(f["servico_transmissao"])) if f.get("servico_transmissao") else None,
            encargos_setoriais=Decimal(str(f["encargos_setoriais"])) if f.get("encargos_setoriais") else None,
            impostos_encargos=Decimal(str(f["impostos_encargos"])) if f.get("impostos_encargos") else None,
            qr_code_pix=f.get("qr_code_pix"),
            qr_code_pix_image=f.get("qr_code_pix_image"),
            codigo_barras=f.get("codigo_barras"),
            pdf_path=f.get("pdf_path"),
            pdf_baixado_em=f.get("pdf_baixado_em"),
            sincronizado_em=f.get("sincronizado_em"),
            criado_em=f.get("criado_em"),
            atualizado_em=f.get("atualizado_em"),
            uc=uc
        )

    async def buscar_por_id(self, fatura_id: int) -> FaturaResponse:
        """
        Busca fatura por ID.

        Args:
            fatura_id: ID da fatura

        Returns:
            FaturaResponse

        Raises:
            NotFoundError: Se fatura não encontrada
        """
        result = self.db.faturas().select(
            "*",
            "unidades_consumidoras!faturas_uc_id_fkey(id, cod_empresa, cdc, digito_verificador, nome_titular, cidade, uf)"
        ).eq("id", fatura_id).single().execute()

        if not result.data:
            raise NotFoundError("Fatura")

        return self._build_response(result.data)

    async def listar_por_uc(
        self,
        uc_id: int,
        page: int = 1,
        per_page: int = 13  # Último ano
    ) -> Tuple[List[FaturaResponse], int]:
        """
        Lista faturas de uma UC.

        Args:
            uc_id: ID da UC
            page: Página
            per_page: Itens por página

        Returns:
            Tupla (lista de faturas, total)
        """
        filtros = FaturaFiltros(uc_id=uc_id)
        return await self.listar(filtros=filtros, page=page, per_page=per_page)

    async def buscar_por_referencia(
        self,
        uc_id: int,
        mes: int,
        ano: int
    ) -> Optional[FaturaResponse]:
        """
        Busca fatura por mês/ano de referência.

        Args:
            uc_id: ID da UC
            mes: Mês (1-12)
            ano: Ano

        Returns:
            FaturaResponse ou None
        """
        result = self.db.faturas().select(
            "*",
            "unidades_consumidoras!faturas_uc_id_fkey(id, cod_empresa, cdc, digito_verificador, nome_titular, cidade, uf)"
        ).eq("uc_id", uc_id).eq("mes_referencia", mes).eq("ano_referencia", ano).single().execute()

        if not result.data:
            return None

        return self._build_response(result.data)

    async def criar_manual(self, data: FaturaManualRequest) -> FaturaResponse:
        """
        Cria fatura manualmente.

        Args:
            data: Dados da fatura

        Returns:
            FaturaResponse
        """
        # Verifica se UC existe
        uc_result = self.db.unidades_consumidoras().select("id").eq("id", data.uc_id).single().execute()
        if not uc_result.data:
            raise NotFoundError("Unidade Consumidora")

        # Verifica duplicata
        existing = self.db.faturas().select("id").eq(
            "uc_id", data.uc_id
        ).eq("mes_referencia", data.mes_referencia).eq("ano_referencia", data.ano_referencia).execute()

        if existing.data:
            raise ValidationError(f"Já existe fatura para {data.mes_referencia:02d}/{data.ano_referencia}")

        # Cria fatura
        fatura_data = {
            "uc_id": data.uc_id,
            "mes_referencia": data.mes_referencia,
            "ano_referencia": data.ano_referencia,
            "valor_fatura": float(data.valor_fatura),
            "data_vencimento": data.data_vencimento.isoformat(),
            "consumo": data.consumo,
            "valor_iluminacao_publica": float(data.valor_iluminacao_publica) if data.valor_iluminacao_publica else None,
            "dados_api": {},  # Fatura manual não tem dados da API
            "sincronizado_em": datetime.now(timezone.utc).isoformat()
        }

        result = self.db.faturas().insert(fatura_data).execute()

        if not result.data:
            raise ValidationError("Erro ao criar fatura")

        return await self.buscar_por_id(result.data[0]["id"])

    async def salvar_da_api(
        self,
        uc_id: int,
        dados_api: dict
    ) -> FaturaResponse:
        """
        Salva ou atualiza fatura a partir dos dados da API.

        Args:
            uc_id: ID da UC
            dados_api: Dados retornados pela API da Energisa

        Returns:
            FaturaResponse
        """
        mes = dados_api.get("mesReferencia")
        ano = dados_api.get("anoReferencia")

        if not mes or not ano:
            raise ValidationError("Dados da API não contêm mês/ano de referência")

        # Monta dados da fatura (com parse de datas)
        fatura_data = {
            "uc_id": uc_id,
            "numero_fatura": dados_api.get("numeroFatura"),
            "mes_referencia": mes,
            "ano_referencia": ano,
            "valor_fatura": dados_api.get("valorFatura", 0),
            "valor_liquido": dados_api.get("valorLiquido"),
            "consumo": dados_api.get("consumo"),
            "leitura_atual": dados_api.get("leituraAtual"),
            "leitura_anterior": dados_api.get("leituraAnterior"),
            "media_consumo": dados_api.get("mediaConsumo"),
            "quantidade_dias": dados_api.get("quantidadeDiaConsumo"),
            "valor_iluminacao_publica": dados_api.get("valorIluminacaoPublica"),
            "valor_icms": dados_api.get("valorICMS"),
            "bandeira_tarifaria": dados_api.get("bandeiraTarifaria"),
            "data_leitura": parse_date(dados_api.get("dataLeitura")),
            "data_vencimento": parse_date(dados_api.get("dataVencimento")),
            "data_pagamento": parse_date(dados_api.get("dataPagamento")),
            "indicador_situacao": dados_api.get("indicadorSituacao"),
            "indicador_pagamento": dados_api.get("indicadorPagamento"),
            "situacao_pagamento": dados_api.get("situacaoPagamento"),
            "qr_code_pix": dados_api.get("qrCodePix"),
            "qr_code_pix_image": dados_api.get("qrCodePixImage64"),
            "codigo_barras": dados_api.get("codigoBarras"),
            "dados_api": dados_api,
            "sincronizado_em": datetime.now(timezone.utc).isoformat()
        }

        # Remove valores None
        fatura_data = {k: v for k, v in fatura_data.items() if v is not None}

        # Upsert (insert ou update)
        result = self.db.faturas().upsert(
            fatura_data,
            on_conflict="uc_id,mes_referencia,ano_referencia"
        ).execute()

        if not result.data:
            raise ValidationError("Erro ao salvar fatura")

        return await self.buscar_por_id(result.data[0]["id"])

    async def obter_estatisticas(
        self,
        uc_id: int,
        ano: Optional[int] = None
    ) -> EstatisticasFaturaResponse:
        """
        Obtém estatísticas de faturas de uma UC.

        Args:
            uc_id: ID da UC
            ano: Ano para filtrar (opcional)

        Returns:
            EstatisticasFaturaResponse
        """
        query = self.db.faturas().select("*").eq("uc_id", uc_id)

        if ano:
            query = query.eq("ano_referencia", ano)

        result = query.execute()

        faturas = result.data or []

        if not faturas:
            return EstatisticasFaturaResponse(
                total_faturas=0,
                valor_total=Decimal("0"),
                valor_medio=Decimal("0"),
                consumo_total=0,
                consumo_medio=0,
                faturas_pagas=0,
                faturas_pendentes=0,
                faturas_vencidas=0
            )

        total = len(faturas)
        valor_total = sum(Decimal(str(f.get("valor_fatura", 0))) for f in faturas)
        consumo_total = sum(f.get("consumo", 0) or 0 for f in faturas)

        hoje = date.today()
        pagas = sum(1 for f in faturas if f.get("indicador_pagamento"))
        vencidas = sum(
            1 for f in faturas
            if not f.get("indicador_pagamento") and f.get("data_vencimento") and
            datetime.fromisoformat(f["data_vencimento"]).date() < hoje
        )
        pendentes = total - pagas - vencidas

        return EstatisticasFaturaResponse(
            total_faturas=total,
            valor_total=valor_total,
            valor_medio=valor_total / total if total > 0 else Decimal("0"),
            consumo_total=consumo_total,
            consumo_medio=consumo_total // total if total > 0 else 0,
            faturas_pagas=pagas,
            faturas_pendentes=pendentes,
            faturas_vencidas=vencidas
        )

    async def obter_comparativo_mensal(
        self,
        uc_id: int,
        meses: int = 12
    ) -> List[ComparativoMensalResponse]:
        """
        Obtém comparativo mensal de faturas.

        Args:
            uc_id: ID da UC
            meses: Quantidade de meses para comparar

        Returns:
            Lista de comparativos mensais
        """
        result = self.db.faturas().select(
            "mes_referencia, ano_referencia, valor_fatura, consumo"
        ).eq("uc_id", uc_id).order(
            "ano_referencia", desc=True
        ).order("mes_referencia", desc=True).limit(meses).execute()

        faturas = result.data or []
        faturas.reverse()  # Ordem cronológica

        comparativos = []
        for i, f in enumerate(faturas):
            variacao_valor = None
            variacao_consumo = None

            if i > 0:
                prev = faturas[i - 1]
                valor_atual = Decimal(str(f.get("valor_fatura", 0)))
                valor_anterior = Decimal(str(prev.get("valor_fatura", 0)))
                if valor_anterior > 0:
                    variacao_valor = ((valor_atual - valor_anterior) / valor_anterior * 100)

                consumo_atual = f.get("consumo", 0) or 0
                consumo_anterior = prev.get("consumo", 0) or 0
                variacao_consumo = consumo_atual - consumo_anterior

            comparativos.append(ComparativoMensalResponse(
                mes_referencia=f["mes_referencia"],
                ano_referencia=f["ano_referencia"],
                referencia_formatada=f"{f['mes_referencia']:02d}/{f['ano_referencia']}",
                valor_fatura=Decimal(str(f.get("valor_fatura", 0))),
                consumo=f.get("consumo", 0) or 0,
                variacao_valor=variacao_valor,
                variacao_consumo=variacao_consumo
            ))

        return comparativos

    async def listar_historico_gd(
        self,
        uc_id: int,
        page: int = 1,
        per_page: int = 12
    ) -> Tuple[List[HistoricoGDResponse], int]:
        """
        Lista histórico de GD de uma UC.

        Args:
            uc_id: ID da UC
            page: Página
            per_page: Itens por página

        Returns:
            Tupla (lista de históricos, total)
        """
        query = self.db.table("historico_gd").select("*", count="exact").eq("uc_id", uc_id)

        offset = (page - 1) * per_page
        query = query.range(offset, offset + per_page - 1)
        query = query.order("ano_referencia", desc=True).order("mes_referencia", desc=True)

        result = query.execute()

        historicos = []
        for h in result.data or []:
            historicos.append(HistoricoGDResponse(
                id=h["id"],
                uc_id=h["uc_id"],
                mes_referencia=h["mes_referencia"],
                ano_referencia=h["ano_referencia"],
                referencia_formatada=f"{h['mes_referencia']:02d}/{h['ano_referencia']}",
                saldo_anterior_conv=h.get("saldo_anterior_conv"),
                injetado_conv=h.get("injetado_conv"),
                total_recebido_rede=h.get("total_recebido_rede"),
                consumo_recebido_conv=h.get("consumo_recebido_conv"),
                consumo_injetado_compensado=h.get("consumo_injetado_compensado"),
                consumo_transferido_conv=h.get("consumo_transferido_conv"),
                consumo_compensado_conv=h.get("consumo_compensado_conv"),
                saldo_compensado_anterior=h.get("saldo_compensado_anterior"),
                composicao_energia=h.get("composicao_energia"),
                discriminacao_energia=h.get("discriminacao_energia"),
                sincronizado_em=h.get("sincronizado_em")
            ))

        total = result.count if result.count else len(historicos)
        return historicos, total


# Instância global do serviço
faturas_service = FaturasService()
