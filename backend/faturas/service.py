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

        # 1. Buscar fatura com PDF
        result = self.db.table("faturas").select("id, pdf_base64, extracao_status").eq("id", fatura_id).single().execute()

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
                # TODO: Implementar busca de dados da API Energisa
                # dados_energisa = await self._buscar_dados_energisa(fatura)
                pass
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


# Instância global do serviço
faturas_service = FaturasService()
