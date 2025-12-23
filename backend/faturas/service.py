"""
Faturas Service - Lógica de negócio para Faturas
"""

from typing import Optional, List, Tuple
from decimal import Decimal
import logging
from datetime import datetime, timezone, date
import re
import json

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
    GestaoFaturasResponse,
    FaturaGestaoResponse,
    TotaisGestaoResponse,
    BeneficiarioGestaoResponse,
    UsinaGestaoResponse,
    CobrancaGestaoResponse,
)

logger = logging.getLogger(__name__)


class FaturasService:
    """Serviço de gestão de Faturas"""

    def __init__(self):
        self.db = db_admin

    def _formatar_uc(self, cod_empresa: int, cdc: int, digito: int) -> str:
        """Formata UC para exibição"""
        return f"{cod_empresa}/{cdc}-{digito}"

    def _parse_date_field(self, value) -> Optional[date]:
        """Converte valores de data para date, ignorando formatos inválidos."""

        if not value:
            return None

        if isinstance(value, date):
            return value

        if isinstance(value, str):
            try:
                return date.fromisoformat(value[:10])
            except ValueError:
                logger.warning("Data em formato inválido na gestão de faturas: %s", value)
                return None

        logger.warning("Tipo de dado inesperado para data na gestão de faturas: %s", type(value))
        return None

    def _parse_decimal_field(self, value, default: str = "0") -> Decimal:
        """Converte valores para Decimal de forma resiliente."""

        if value is None:
            return Decimal(default)

        try:
            return Decimal(str(value))
        except Exception:
            logger.warning("Valor numérico inválido na gestão de faturas: %s", value)
            return Decimal(default)

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
        # Seleciona apenas campos necessários, excluindo pdf_base64 e qr_code_pix_image (pesados)
        query = self.db.faturas().select(
            "id, uc_id, numero_fatura, mes_referencia, ano_referencia, valor_fatura, valor_liquido, "
            "consumo, leitura_atual, leitura_anterior, media_consumo, quantidade_dias, "
            "valor_iluminacao_publica, valor_icms, bandeira_tarifaria, data_leitura, data_vencimento, "
            "data_pagamento, indicador_situacao, indicador_pagamento, situacao_pagamento, "
            "servico_distribuicao, compra_energia, servico_transmissao, encargos_setoriais, "
            "impostos_encargos, qr_code_pix, codigo_barras, pdf_path, pdf_baixado_em, "
            "sincronizado_em, criado_em, atualizado_em, "
            "unidades_consumidoras!faturas_uc_id_fkey(id, cod_empresa, cdc, digito_verificador, nome_titular, cidade, uf, usuario_id)",
            count="exact"
        )

        # Aplicar filtros
        if filtros:
            # Filtro por usuário e/ou titularidade: busca UCs primeiro
            if filtros.usuario_id or filtros.usuario_titular is not None:
                uc_query = self.db.unidades_consumidoras().select("id")

                if filtros.usuario_id:
                    uc_query = uc_query.eq("usuario_id", filtros.usuario_id)

                # Filtrar por titularidade se especificado
                if filtros.usuario_titular is not None:
                    uc_query = uc_query.eq("usuario_titular", filtros.usuario_titular)

                uc_result = uc_query.execute()
                uc_ids = [uc["id"] for uc in (uc_result.data or [])]
                if uc_ids:
                    query = query.in_("uc_id", uc_ids)
                else:
                    # Não há UCs correspondentes, retorna lista vazia
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
            pdf_base64=f.get("pdf_base64"),
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

    async def buscar_pdf(self, fatura_id: int) -> dict:
        """
        Busca apenas o PDF da fatura.

        Args:
            fatura_id: ID da fatura

        Returns:
            Dict com pdf_base64

        Raises:
            NotFoundError: Se fatura não encontrada
        """
        result = self.db.faturas().select(
            "id, pdf_base64, mes_referencia, ano_referencia"
        ).eq("id", fatura_id).single().execute()

        if not result.data:
            raise NotFoundError("Fatura")

        return {
            "id": result.data["id"],
            "pdf_base64": result.data.get("pdf_base64"),
            "mes_referencia": result.data["mes_referencia"],
            "ano_referencia": result.data["ano_referencia"],
            "disponivel": result.data.get("pdf_base64") is not None
        }

    async def buscar_pix(self, fatura_id: int) -> dict:
        """
        Busca dados PIX da fatura.

        Args:
            fatura_id: ID da fatura

        Returns:
            Dict com qr_code_pix e qr_code_pix_image

        Raises:
            NotFoundError: Se fatura não encontrada
        """
        result = self.db.faturas().select(
            "id, qr_code_pix, qr_code_pix_image, codigo_barras, mes_referencia, ano_referencia"
        ).eq("id", fatura_id).single().execute()

        if not result.data:
            raise NotFoundError("Fatura")

        return {
            "id": result.data["id"],
            "qr_code_pix": result.data.get("qr_code_pix"),
            "qr_code_pix_image": result.data.get("qr_code_pix_image"),
            "codigo_barras": result.data.get("codigo_barras"),
            "mes_referencia": result.data["mes_referencia"],
            "ano_referencia": result.data["ano_referencia"],
            "pix_disponivel": result.data.get("qr_code_pix") is not None or result.data.get("qr_code_pix_image") is not None
        }

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

    # ========== MÉTODOS DE EXTRAÇÃO DE DADOS ==========

    async def processar_extracao_fatura(self, fatura_id: int) -> dict:
        """
        Processa extração de dados estruturados de uma fatura.

        Args:
            fatura_id: ID da fatura

        Returns:
            Dados extraídos estruturados

        Raises:
            NotFoundError: Se fatura não existir
            ValidationError: Se fatura não tiver PDF ou extração falhar
        """
        from backend.faturas.pdf_extractor import FaturaPDFExtractor
        from backend.faturas.python_parser import FaturaPythonParser

        # 1. Buscar fatura com PDF e metadados necessários para comparação com API
        result = self.db.table("faturas").select(
            "id, pdf_base64, extracao_status, uc_id, mes_referencia, ano_referencia, valor_fatura, consumo, dados_api"
        ).eq("id", fatura_id).single().execute()

        if not result.data:
            raise NotFoundError(f"Fatura {fatura_id} não encontrada")

        fatura = result.data

        if not fatura.get("pdf_base64"):
            raise ValidationError("Fatura não possui PDF armazenado")

        # 2. Atualizar status → PROCESSANDO
        self.db.table("faturas").update({
            "extracao_status": "PROCESSANDO"
        }).eq("id", fatura_id).execute()

        try:
            # 3. Extrair texto do PDF usando LLMWhisperer
            logger.info(f"Extraindo texto do PDF da fatura {fatura_id} com LLMWhisperer")
            from backend.faturas.llm_extractor import criar_extrator_llm

            llm_extractor, openai_parser = criar_extrator_llm()
            texto = llm_extractor.extract_from_pdf(fatura["pdf_base64"])

            # 4. Parsear texto para estrutura de dados usando OpenAI
            logger.info(f"Parseando texto da fatura {fatura_id} com OpenAI GPT-4o-mini")
            dados_dict = openai_parser.parse_fatura(texto)

            # 5. Validar dados extraídos
            logger.info(f"Validando dados extraídos da fatura {fatura_id}")
            from backend.faturas.validator import criar_validador

            validador = criar_validador()

            # Tentar obter dados da API Energisa (se disponível)
            dados_energisa = None
            try:
                dados_energisa = self._buscar_dados_energisa(fatura)
            except Exception as e:
                logger.warning(f"Não foi possível obter dados da API Energisa: {e}")

            # Executar validação
            resultado_validacao = validador.validar(
                dados_extraidos=dados_dict,
                fatura_db=fatura,
                dados_energisa=dados_energisa
            )

            logger.info(f"Validação concluída: Score={resultado_validacao.score}, Avisos={len(resultado_validacao.avisos)}")

            # Log dos avisos (se houver)
            if resultado_validacao.avisos:
                logger.warning(f"Avisos encontrados na validação da fatura {fatura_id}:")
                for aviso in resultado_validacao.avisos:
                    logger.warning(f"  [{aviso['severidade']}] {aviso['categoria']}.{aviso['campo']}: {aviso['mensagem']}")

            # 6. Salvar dados extraídos com validação
            logger.info(f"Dados extraídos: {json.dumps(dados_dict, indent=2, ensure_ascii=False)[:500]}...")

            self.db.table("faturas").update({
                "dados_extraidos": dados_dict,
                "extracao_avisos": resultado_validacao.avisos,
                "extracao_score": resultado_validacao.score,
                "extracao_status": "CONCLUIDA",
                "extracao_error": None,
                "extraido_em": datetime.now(timezone.utc).isoformat()
            }).eq("id", fatura_id).execute()

            # 7. Verificar impostos extraídos (detecção automática de mudanças)
            impostos = dados_dict.get("impostos_detalhados")
            if impostos and impostos.get("pis_aliquota"):
                try:
                    from backend.configuracoes.service import impostos_service

                    resultado_verificacao = impostos_service.verificar_e_criar_se_diferente(
                        pis_extraido=impostos.get("pis_aliquota"),
                        cofins_extraido=impostos.get("cofins_aliquota"),
                        icms_extraido=impostos.get("icms_aliquota"),
                        tolerancia=0.000001,  # 0.0001% - alta precisão para detectar qualquer variação
                        usuario_id=None  # Sistema
                    )

                    if resultado_verificacao.get("criado"):
                        logger.warning(
                            f"IMPOSTOS ALTERADOS! Detectado na fatura {fatura_id}. "
                            f"Novo registro criado: ID {resultado_verificacao.get('id')}"
                        )
                        # Adicionar aviso aos dados extraídos
                        avisos = resultado_validacao.avisos or []
                        avisos.append({
                            "severidade": "AVISO",
                            "categoria": "IMPOSTOS",
                            "campo": "impostos_detalhados",
                            "mensagem": "Alíquotas de impostos detectadas diferem das vigentes. Novo registro criado automaticamente."
                        })
                        # Atualizar avisos no banco
                        self.db.table("faturas").update({
                            "extracao_avisos": avisos
                        }).eq("id", fatura_id).execute()
                    else:
                        logger.info(f"Impostos da fatura {fatura_id} conferem com os vigentes")
                except Exception as e:
                    logger.warning(f"Erro ao verificar impostos da fatura {fatura_id}: {e}")

            logger.info(f"Extração da fatura {fatura_id} concluída com sucesso (Score: {resultado_validacao.score}/100)")
            return dados_dict

        except Exception as e:
            # 6. Em caso de erro, salvar erro no banco
            error_msg = str(e)
            logger.error(f"Erro ao extrair fatura {fatura_id}: {error_msg}")

            self.db.table("faturas").update({
                "extracao_status": "ERRO",
                "extracao_error": error_msg[:500]  # Limitar tamanho
            }).eq("id", fatura_id).execute()

            raise ValidationError(f"Erro ao extrair dados da fatura: {error_msg}")

    async def processar_lote_faturas(
        self,
        filtros: Optional[dict] = None,
        limite: int = 10,
        forcar_reprocessamento: bool = False
    ) -> dict:
        """
        Processa extração de múltiplas faturas em lote.

        Args:
            filtros: Filtros para selecionar faturas (uc_id, mes, ano, etc)
            limite: Número máximo de faturas a processar
            forcar_reprocessamento: Se True, reprocessa mesmo faturas já extraídas

        Returns:
            Resultado do processamento em lote
        """
        # 1. Buscar faturas pendentes de extração
        query = self.db.table("faturas").select("id, numero_fatura, uc_id, mes_referencia, ano_referencia, extracao_status")

        # Filtrar faturas com PDF
        query = query.not_.is_("pdf_base64", "null")

        # Se não forçar reprocessamento, filtrar apenas PENDENTE/ERRO
        if not forcar_reprocessamento:
            query = query.in_("extracao_status", ["PENDENTE", "ERRO", None])

        # Aplicar filtros adicionais
        if filtros:
            if filtros.get("uc_id"):
                query = query.eq("uc_id", filtros["uc_id"])
            if filtros.get("mes_referencia"):
                query = query.eq("mes_referencia", filtros["mes_referencia"])
            if filtros.get("ano_referencia"):
                query = query.eq("ano_referencia", filtros["ano_referencia"])

        # Limitar quantidade
        query = query.limit(limite).order("ano_referencia", desc=True).order("mes_referencia", desc=True)

        result = query.execute()
        faturas_pendentes = result.data or []

        if not faturas_pendentes:
            # Verificar se há faturas no período (com qualquer status)
            check_query = self.db.table("faturas").select("id, extracao_status").not_.is_("pdf_base64", "null")
            if filtros:
                if filtros.get("mes_referencia"):
                    check_query = check_query.eq("mes_referencia", filtros["mes_referencia"])
                if filtros.get("ano_referencia"):
                    check_query = check_query.eq("ano_referencia", filtros["ano_referencia"])

            check_result = check_query.limit(5).execute()
            total_periodo = len(check_result.data or [])

            logger.warning(f"Nenhuma fatura pendente encontrada. Total no período: {total_periodo}")

            return {
                "total": 0,
                "processadas": 0,
                "sucesso": 0,
                "erro": 0,
                "total_periodo": total_periodo,
                "mensagem": f"Nenhuma fatura pendente. Encontradas {total_periodo} faturas no período (já processadas ou sem necessidade).",
                "resultados": []
            }

        # 2. Processar cada fatura
        resultados = []
        sucesso_count = 0
        erro_count = 0

        for fatura in faturas_pendentes:
            try:
                dados = await self.processar_extracao_fatura(fatura["id"])
                sucesso_count += 1
                resultados.append({
                    "fatura_id": fatura["id"],
                    "numero_fatura": fatura.get("numero_fatura"),
                    "referencia": f"{fatura['mes_referencia']:02d}/{fatura['ano_referencia']}",
                    "status": "sucesso",
                    "dados": dados
                })
            except Exception as e:
                erro_count += 1
                resultados.append({
                    "fatura_id": fatura["id"],
                    "numero_fatura": fatura.get("numero_fatura"),
                    "referencia": f"{fatura['mes_referencia']:02d}/{fatura['ano_referencia']}",
                    "status": "erro",
                    "erro": str(e)
                })

        return {
            "total": len(faturas_pendentes),
            "processadas": len(resultados),
            "sucesso": sucesso_count,
            "erro": erro_count,
            "resultados": resultados
        }

    async def obter_dados_extraidos(self, fatura_id: int) -> Optional[dict]:
        """
        Obtém dados já extraídos de uma fatura.

        Args:
            fatura_id: ID da fatura

        Returns:
            Dados extraídos ou None se não existir

        Raises:
            NotFoundError: Se fatura não existir
        """
        result = self.db.table("faturas").select(
            "id, dados_extraidos, extracao_status, extracao_error, extraido_em"
        ).eq("id", fatura_id).single().execute()

        if not result.data:
            raise NotFoundError(f"Fatura {fatura_id} não encontrada")

        fatura = result.data

        if fatura["extracao_status"] != "CONCLUIDA":
            return None

        return fatura.get("dados_extraidos")

    async def reprocessar_extracao(self, fatura_id: int) -> dict:
        """
        Reprocessa extração de uma fatura (mesmo que já tenha sido processada).

        Args:
            fatura_id: ID da fatura

        Returns:
            Dados extraídos

        Raises:
            NotFoundError: Se fatura não existir
            ValidationError: Se extração falhar
        """
        # Resetar status para PENDENTE
        self.db.table("faturas").update({
            "extracao_status": "PENDENTE",
            "extracao_error": None
        }).eq("id", fatura_id).execute()

        # Processar novamente
        return await self.processar_extracao_fatura(fatura_id)

    async def refazer_fatura(self, fatura_id: int) -> dict:
        """
        Reseta fatura para aguardar nova extração.
        Exclui cobrança associada (se existir e não for PAGA).
        NÃO executa extração automaticamente.

        Args:
            fatura_id: ID da fatura

        Returns:
            Dict com status e se cobrança foi excluída

        Raises:
            NotFoundError: Se fatura não existir
            ValidationError: Se cobrança estiver PAGA
        """
        # Verificar se fatura existe
        fatura_result = self.db.table("faturas").select("id").eq("id", fatura_id).single().execute()
        if not fatura_result.data:
            raise NotFoundError(f"Fatura {fatura_id} não encontrada")

        # Buscar e excluir cobrança associada
        cobranca_result = self.db.table("cobrancas").select("id, status").eq("fatura_id", fatura_id).execute()
        cobranca_excluida = False

        if cobranca_result.data:
            for cobranca in cobranca_result.data:
                if cobranca.get("status") == "PAGA":
                    raise ValidationError(f"Não é possível refazer: cobrança {cobranca['id']} está PAGA")
                logger.info(f"Refazer fatura {fatura_id}: excluindo cobrança {cobranca['id']}")
                self.db.table("cobrancas").delete().eq("id", cobranca["id"]).execute()
                cobranca_excluida = True

        # Limpar dados extraídos e resetar status
        logger.info(f"Refazer fatura {fatura_id}: resetando para PENDENTE")
        self.db.table("faturas").update({
            "extracao_status": "PENDENTE",
            "dados_extraidos": None,
            "extracao_avisos": None,
            "extracao_score": None,
            "extraido_em": None,
            "extracao_error": None
        }).eq("id", fatura_id).execute()

        return {
            "fatura_id": fatura_id,
            "status": "resetado",
            "cobranca_excluida": cobranca_excluida
        }

    def _buscar_dados_energisa(self, fatura: dict) -> Optional[dict]:
        """Busca dados sincronizados da Energisa para comparação na validação.

        Prioriza o campo `dados_api` salvo na sincronização; caso ausente, usa
        colunas normalizadas (valor_fatura, consumo). Retorna None se nada útil
        for encontrado.
        """
        try:
            # Recarrega dados completos da fatura para garantir consistência
            result = self.db.table("faturas").select(
                "id, uc_id, mes_referencia, ano_referencia, valor_fatura, consumo, dados_api"
            ).eq("id", fatura["id"]).single().execute()

            if not result.data:
                return None

            dados = result.data
            dados_api = dados.get("dados_api") or {}

            valor_fatura = dados_api.get("valorFatura") if isinstance(dados_api, dict) else None
            consumo_kwh = dados_api.get("consumo") if isinstance(dados_api, dict) else None

            # Fallbacks para colunas já normalizadas
            if valor_fatura is None:
                valor_fatura = dados.get("valor_fatura")
            if consumo_kwh is None:
                consumo_kwh = dados.get("consumo")

            # Código do cliente pode vir da API ou da UC
            codigo_cliente = None
            if isinstance(dados_api, dict):
                codigo_cliente = dados_api.get("codigoCliente") or dados_api.get("codigoDoCliente")

            if not codigo_cliente and dados.get("uc_id"):
                uc_result = self.db.table("unidades_consumidoras").select(
                    "codigo_cliente, cod_empresa, cdc, digito_verificador"
                ).eq("id", dados["uc_id"]).single().execute()
                if uc_result.data:
                    codigo_cliente = uc_result.data.get("codigo_cliente")
                    if not codigo_cliente and all([
                        uc_result.data.get("cod_empresa"),
                        uc_result.data.get("cdc"),
                        uc_result.data.get("digito_verificador"),
                    ]):
                        codigo_cliente = f"{uc_result.data['cod_empresa']}/{uc_result.data['cdc']}-{uc_result.data['digito_verificador']}"

            if valor_fatura is None and consumo_kwh is None and codigo_cliente is None:
                return None

            return {
                "valor_fatura": valor_fatura,
                "consumo_kwh": consumo_kwh,
                "codigo_cliente": codigo_cliente,
                "mes_referencia": dados.get("mes_referencia"),
                "ano_referencia": dados.get("ano_referencia"),
            }
        except Exception as e:
            logger.warning(f"Erro ao buscar dados da Energisa para fatura {fatura.get('id')}: {e}")
            return None


    # ========== GESTÃO UNIFICADA ==========

    async def listar_gestao(
        self,
        user_id: str,
        perfis: List[str],
        usina_id: Optional[int] = None,
        beneficiario_id: Optional[int] = None,
        mes_referencia: Optional[int] = None,
        ano_referencia: Optional[int] = None,
        busca: Optional[str] = None,
        status_fluxo: Optional[List[str]] = None
    ) -> GestaoFaturasResponse:
        """
        Lista faturas com status unificado para gestão.
        Calcula o status do fluxo baseado no estado da fatura e cobrança.

        Status do fluxo:
        - AGUARDANDO_PDF: Fatura sem PDF
        - PDF_RECEBIDO: PDF disponível, aguarda extração
        - EXTRAIDA: Dados extraídos, pronta para cobrança
        - COBRANCA_RASCUNHO: Cobrança gerada em rascunho
        - COBRANCA_EMITIDA: Cobrança aprovada com PIX
        - COBRANCA_PAGA: Pagamento confirmado
        - FATURA_QUITADA: Ciclo completo

        Args:
            user_id: ID do usuário
            perfis: Lista de perfis do usuário
            usina_id: Filtrar por usina
            beneficiario_id: Filtrar por beneficiário
            mes_referencia: Filtrar por mês
            ano_referencia: Filtrar por ano
            busca: Buscar por nome ou UC
            status_fluxo: Filtrar por status do fluxo

        Returns:
            GestaoFaturasResponse com faturas e totais
        """
        try:
            logger.info(f"listar_gestao: user_id={user_id}, perfis={perfis}, usina_id={usina_id}, mes={mes_referencia}, ano={ano_referencia}")

            # 1. Buscar beneficiários do gestor (para filtrar faturas)
            # Inclui beneficiários de usinas E beneficiários avulsos (GD por transferência)
            is_admin = "superadmin" in perfis or "proprietario" in perfis

            beneficiarios = []

            if is_admin:
                # Admin/proprietário vê todos os beneficiários ativos
                beneficiarios_query = self.db.table("beneficiarios").select(
                    "id, usuario_id, uc_id, usina_id, tipo, cpf, nome, email, telefone, status, "
                    "unidades_consumidoras!beneficiarios_uc_id_fkey(id, cod_empresa, cdc, digito_verificador, endereco, numero_imovel, tipo_ligacao), "
                    "usinas(id, nome)"
                ).eq("status", "ATIVO")

                if usina_id:
                    beneficiarios_query = beneficiarios_query.eq("usina_id", usina_id)
                if beneficiario_id:
                    beneficiarios_query = beneficiarios_query.eq("id", beneficiario_id)

                beneficiarios_result = beneficiarios_query.execute()
                beneficiarios = beneficiarios_result.data or []
            else:
                # Gestor: beneficiários das usinas que gerencia + avulsos de usuários gerenciados
                gestoes_result = self.db.table("gestores_usina").select("usina_id").eq("gestor_id", user_id).eq("ativo", True).execute()
                usina_ids = [g["usina_id"] for g in (gestoes_result.data or [])]

                if usina_ids:
                    # 1a. Beneficiários de usinas gerenciadas (tipo USINA)
                    benef_usinas_query = self.db.table("beneficiarios").select(
                        "id, usuario_id, uc_id, usina_id, tipo, cpf, nome, email, telefone, status, "
                        "unidades_consumidoras!beneficiarios_uc_id_fkey(id, cod_empresa, cdc, digito_verificador, endereco, numero_imovel, tipo_ligacao, usuario_id), "
                        "usinas(id, nome)"
                    ).eq("status", "ATIVO").in_("usina_id", usina_ids)

                    if usina_id:
                        benef_usinas_query = benef_usinas_query.eq("usina_id", usina_id)
                    if beneficiario_id:
                        benef_usinas_query = benef_usinas_query.eq("id", beneficiario_id)

                    benef_usinas = benef_usinas_query.execute().data or []
                    beneficiarios.extend(benef_usinas)

                    # 1b. Buscar IDs de usuários das usinas gerenciadas (para incluir avulsos deles)
                    # Usinas -> uc_geradora_id -> unidades_consumidoras.usuario_id
                    usinas_result = self.db.table("usinas").select("uc_geradora_id").in_("id", usina_ids).execute()
                    uc_geradora_ids = [u["uc_geradora_id"] for u in (usinas_result.data or []) if u.get("uc_geradora_id")]

                    usuario_ids_usinas = []
                    if uc_geradora_ids:
                        ucs_geradora_result = self.db.table("unidades_consumidoras").select("usuario_id").in_("id", uc_geradora_ids).execute()
                        usuario_ids_usinas = list(set(u["usuario_id"] for u in (ucs_geradora_result.data or []) if u.get("usuario_id")))

                    if usuario_ids_usinas:
                        # UCs desses usuários
                        ucs_usuarios = self.db.table("unidades_consumidoras").select("id").in_("usuario_id", usuario_ids_usinas).execute()
                        uc_ids_usuarios = [u["id"] for u in (ucs_usuarios.data or [])]

                        if uc_ids_usuarios:
                            # 1c. Beneficiários AVULSO dessas UCs
                            benef_avulsos_query = self.db.table("beneficiarios").select(
                                "id, usuario_id, uc_id, usina_id, tipo, cpf, nome, email, telefone, status, "
                                "unidades_consumidoras!beneficiarios_uc_id_fkey(id, cod_empresa, cdc, digito_verificador, endereco, numero_imovel, tipo_ligacao), "
                                "usinas(id, nome)"
                            ).eq("status", "ATIVO").eq("tipo", "AVULSO").in_("uc_id", uc_ids_usuarios)

                            if beneficiario_id:
                                benef_avulsos_query = benef_avulsos_query.eq("id", beneficiario_id)

                            benef_avulsos = benef_avulsos_query.execute().data or []
                            beneficiarios.extend(benef_avulsos)
                else:
                    # Sem usinas, retorna vazio
                    return GestaoFaturasResponse(faturas=[], totais=TotaisGestaoResponse())

            if not beneficiarios:
                return GestaoFaturasResponse(faturas=[], totais=TotaisGestaoResponse())

            # Mapear beneficiários por UC
            beneficiarios_por_uc = {}
            for b in beneficiarios:
                uc_id = b.get("uc_id")
                if uc_id:
                    beneficiarios_por_uc[uc_id] = b

            uc_ids = list(beneficiarios_por_uc.keys())

            # Validar se há UCs para buscar (evita SQL inválido com IN vazio)
            if not uc_ids:
                logger.info("Nenhuma UC encontrada para os beneficiários filtrados")
                return GestaoFaturasResponse(faturas=[], totais=TotaisGestaoResponse())

            # 2. Buscar faturas das UCs (não seleciona pdf_base64 pois é muito pesado)
            # Usa LEFT JOIN (sem !inner) para não excluir faturas sem UC
            faturas_query = self.db.table("faturas").select(
                "id, uc_id, mes_referencia, ano_referencia, valor_fatura, "
                "consumo, leitura_atual, leitura_anterior, data_vencimento, quantidade_dias, "
                "pdf_path, extracao_status, extracao_score, dados_extraidos, dados_api, "
                "bandeira_tarifaria, indicador_pagamento, "
                "unidades_consumidoras(id, cod_empresa, cdc, digito_verificador, tipo_ligacao, endereco, numero_imovel)"
            ).in_("uc_id", uc_ids)

            # Filtros de período
            if mes_referencia:
                faturas_query = faturas_query.eq("mes_referencia", mes_referencia)
            if ano_referencia:
                faturas_query = faturas_query.eq("ano_referencia", ano_referencia)

            # Ordenação
            faturas_query = faturas_query.order("ano_referencia", desc=True).order("mes_referencia", desc=True)

            faturas_result = faturas_query.execute()
            faturas_raw = faturas_result.data or []

            if not faturas_raw:
                return GestaoFaturasResponse(faturas=[], totais=TotaisGestaoResponse())

            # 2.1. Verificar quais faturas têm pdf_base64 (sem carregar o conteúdo)
            # Isso é necessário porque não incluímos pdf_base64 na query principal (muito pesado)
            fatura_ids = [f["id"] for f in faturas_raw]

            # Query leve: apenas IDs das faturas que têm pdf_base64 preenchido
            pdf_check_query = self.db.table("faturas").select("id").in_("id", fatura_ids).not_.is_("pdf_base64", "null")
            pdf_check_result = pdf_check_query.execute()
            faturas_com_pdf_base64 = {f["id"] for f in (pdf_check_result.data or [])}

            # Adicionar flag tem_pdf_base64 em cada fatura
            for f in faturas_raw:
                f["_tem_pdf_base64"] = f["id"] in faturas_com_pdf_base64

            # 3. Buscar cobranças associadas
            cobrancas_query = self.db.table("cobrancas").select(
                "id, fatura_id, status, valor_total, vencimento, qr_code_pix, qr_code_pix_image, pago_em"
            ).in_("fatura_id", fatura_ids)

            cobrancas_result = cobrancas_query.execute()
            cobrancas_por_fatura = {}
            for c in (cobrancas_result.data or []):
                cobrancas_por_fatura[c["fatura_id"]] = c

            # 4. Montar resposta com status unificado
            faturas_gestao = []
            totais = TotaisGestaoResponse()

            for f in faturas_raw:
                try:
                    # Validar campos obrigatórios da fatura
                    fatura_id = f.get("id")
                    uc_id = f.get("uc_id")
                    mes_ref = f.get("mes_referencia")
                    ano_ref = f.get("ano_referencia")
                    if not fatura_id or not uc_id or not mes_ref or not ano_ref:
                        logger.warning(f"Fatura com campos obrigatórios faltando: id={fatura_id}, uc={uc_id}")
                        continue

                    beneficiario = beneficiarios_por_uc.get(uc_id)
                    if not beneficiario:
                        continue

                    # Formatar UC (pode ser None quando LEFT JOIN não encontra)
                    uc = f.get("unidades_consumidoras") or {}
                    uc_formatada = self._formatar_uc(
                        uc.get("cod_empresa", 0) if uc else 0,
                        uc.get("cdc", 0) if uc else 0,
                        uc.get("digito_verificador", 0) if uc else 0
                    )

                    # Buscar cobrança
                    cobranca = cobrancas_por_fatura.get(fatura_id)

                    # Calcular status do fluxo
                    status = self._calcular_status_fluxo(f, cobranca)

                    # Filtrar por status se especificado
                    if status_fluxo and status not in status_fluxo:
                        continue

                    # Atualizar totais
                    if status == "AGUARDANDO_PDF":
                        totais.aguardando_pdf += 1
                    elif status == "PDF_RECEBIDO":
                        totais.pdf_recebido += 1
                    elif status == "EXTRAIDA":
                        totais.extraida += 1
                    elif status == "COBRANCA_RASCUNHO":
                        totais.cobranca_rascunho += 1
                    elif status == "COBRANCA_EMITIDA":
                        totais.cobranca_emitida += 1
                    elif status == "COBRANCA_PAGA":
                        totais.cobranca_paga += 1
                    elif status == "FATURA_QUITADA":
                        totais.fatura_quitada += 1

                    # Determinar tipo GD
                    tipo_gd = None
                    dados_extraidos = f.get("dados_extraidos") or {}
                    if isinstance(dados_extraidos, dict):
                        tipo_gd = dados_extraidos.get("tipo_gd") or dados_extraidos.get("modelo_gd")
                        # Se não encontrou no nível raiz, buscar nos itens de energia injetada
                        if not tipo_gd:
                            itens = dados_extraidos.get("itens_fatura") or {}
                            for key in ["energia_injetada oUC", "energia_injetada_ouc", "energia_injetada mUC", "energia_injetada_muc"]:
                                items_list = itens.get(key) or []
                                for item in items_list:
                                    if isinstance(item, dict) and item.get("tipo_gd") in ["GDI", "GDII"]:
                                        tipo_gd = item.get("tipo_gd")
                                        break
                                if tipo_gd:
                                    break
                        # Se ainda não encontrou, verificar ajuste_lei_14300 (indica GDII)
                        if not tipo_gd:
                            itens = dados_extraidos.get("itens_fatura") or {}
                            ajuste = itens.get("ajuste_lei_14300")
                            if ajuste and (ajuste.get("valor") or ajuste.get("quantidade")):
                                tipo_gd = "GDII"

                    # Busca via busca textual
                    if busca:
                        busca_lower = busca.lower()
                        nome = (beneficiario.get("nome") or "").lower()
                        if busca_lower not in nome and busca_lower not in uc_formatada.lower():
                            continue

                    # Validar dados obrigatórios do beneficiário
                    beneficiario_id = beneficiario.get("id")
                    beneficiario_cpf = beneficiario.get("cpf") or ""  # CPF pode ser vazio
                    if not beneficiario_id:
                        logger.warning(f"Beneficiário sem id, pulando fatura {fatura_id}")
                        continue

                    # Validar usina_id (AVULSO não precisa ter usina)
                    usina_data = beneficiario.get("usinas") or {}
                    usina_id_val = usina_data.get("id") or beneficiario.get("usina_id")
                    tipo_beneficiario = beneficiario.get("tipo") or "USINA"

                    if not usina_id_val and tipo_beneficiario != "AVULSO":
                        logger.warning(f"Beneficiário {beneficiario_id} sem usina_id (tipo={tipo_beneficiario}), pulando fatura {fatura_id}")
                        continue

                    # Montar resposta do beneficiário
                    beneficiario_resp = BeneficiarioGestaoResponse(
                        id=beneficiario_id,
                        nome=beneficiario.get("nome"),
                        cpf=beneficiario_cpf,
                        email=beneficiario.get("email"),
                        telefone=beneficiario.get("telefone")
                    )

                    # Montar resposta da usina (None para AVULSO)
                    usina_resp = None
                    if usina_id_val:
                        usina_resp = UsinaGestaoResponse(
                            id=usina_id_val,
                            nome=usina_data.get("nome") if usina_data else None
                        )

                    # Montar resposta da cobrança
                    cobranca_resp = None
                    if cobranca and cobranca.get("id"):
                        vencimento = self._parse_date_field(cobranca.get("vencimento"))
                        pago_em = self._parse_date_field(cobranca.get("pago_em"))

                        # Só criar resposta se vencimento foi convertido com sucesso
                        if vencimento:
                            cobranca_resp = CobrancaGestaoResponse(
                                id=cobranca["id"],
                                status=cobranca.get("status") or "RASCUNHO",
                                valor_total=self._parse_decimal_field(cobranca.get("valor_total")),
                                vencimento=vencimento,
                                qr_code_pix=cobranca.get("qr_code_pix"),
                                qr_code_pix_image=cobranca.get("qr_code_pix_image"),
                                pago_em=pago_em
                            )

                    # Montar fatura
                    # tem_pdf considera pdf_path OU _tem_pdf_base64 (flag calculada na query auxiliar)
                    tem_pdf = f.get("pdf_path") is not None or f.get("_tem_pdf_base64", False)

                    # Montar endereço da UC
                    endereco_uc = None
                    if uc:
                        endereco = uc.get("endereco") or ""
                        numero = uc.get("numero_imovel") or ""
                        endereco_uc = f"{endereco}, {numero}".strip(", ") if endereco or numero else None

                    fatura_gestao = FaturaGestaoResponse(
                        id=fatura_id,
                        uc_id=uc_id,
                        uc_formatada=uc_formatada,
                        mes_referencia=mes_ref,
                        ano_referencia=ano_ref,
                        status_fluxo=status,
                        tem_pdf=tem_pdf,
                        valor_fatura=self._parse_decimal_field(f.get("valor_fatura")) if f.get("valor_fatura") is not None else None,
                        extracao_status=f.get("extracao_status"),
                        extracao_score=f.get("extracao_score"),
                        dados_extraidos=dados_extraidos if dados_extraidos else None,
                        dados_api=f.get("dados_api"),
                        consumo=f.get("consumo"),
                        leitura_atual=f.get("leitura_atual"),
                        leitura_anterior=f.get("leitura_anterior"),
                        data_vencimento=self._parse_date_field(f.get("data_vencimento")),
                        quantidade_dias=f.get("quantidade_dias"),
                        tipo_gd=tipo_gd,
                        tipo_ligacao=uc.get("tipo_ligacao") if uc else None,
                        bandeira_tarifaria=f.get("bandeira_tarifaria"),
                        endereco_uc=endereco_uc,
                        beneficiario=beneficiario_resp,
                        usina=usina_resp,
                        cobranca=cobranca_resp
                    )

                    faturas_gestao.append(fatura_gestao)

                except Exception as e:
                    logger.warning(f"Erro ao processar fatura {f.get('id')}: {e}")
                    continue

            return GestaoFaturasResponse(faturas=faturas_gestao, totais=totais)

        except Exception as e:
            logger.error(f"Erro em listar_gestao: {e}", exc_info=True)
            raise

    def _calcular_status_fluxo(self, fatura: dict, cobranca: Optional[dict]) -> str:
        """
        Calcula o status unificado do fluxo baseado no estado da fatura e cobrança.

        Fluxo:
        1. AGUARDANDO_PDF - Fatura sem PDF
        2. PDF_RECEBIDO - PDF disponível, extração pendente
        3. EXTRAIDA - Dados extraídos, sem cobrança
        4. COBRANCA_RASCUNHO - Cobrança em rascunho
        5. COBRANCA_EMITIDA - Cobrança aprovada
        6. COBRANCA_PAGA - Cobrança paga
        7. FATURA_QUITADA - Fatura marcada como paga
        """
        # Verifica pdf_path ou a flag _tem_pdf_base64 (calculada na listar_gestao)
        tem_pdf = fatura.get("pdf_path") is not None or fatura.get("_tem_pdf_base64", False)
        extracao_status = fatura.get("extracao_status")
        indicador_pagamento = fatura.get("indicador_pagamento")

        # Verificar se fatura está quitada
        if indicador_pagamento:
            return "FATURA_QUITADA"

        # Se tem cobrança, verificar status dela
        if cobranca:
            status_cobranca = (cobranca.get("status") or "").upper()

            # Cobrança cancelada = ignora, trata como se não existisse
            if status_cobranca == "CANCELADA":
                pass  # Vai cair no fluxo "sem cobrança" abaixo
            elif status_cobranca == "PAGA":
                return "COBRANCA_PAGA"
            elif status_cobranca == "EMITIDA":
                return "COBRANCA_EMITIDA"
            elif status_cobranca == "RASCUNHO":
                return "COBRANCA_RASCUNHO"
            # Outros status (PENDENTE, VENCIDA, PARCIAL) - trata como emitida se tiver PIX
            elif cobranca.get("qr_code_pix"):
                return "COBRANCA_EMITIDA"
            else:
                return "COBRANCA_RASCUNHO"

        # Sem cobrança (ou cobrança cancelada) - verificar estado da fatura
        if not tem_pdf:
            return "AGUARDANDO_PDF"

        if extracao_status == "CONCLUIDA":
            return "EXTRAIDA"

        # PDF disponível mas não extraído ainda
        return "PDF_RECEBIDO"


# Instância global do serviço
faturas_service = FaturasService()
