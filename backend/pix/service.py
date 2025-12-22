"""
Serviço de PIX - Orquestração de geração de cobranças PIX

Este serviço integra:
- Geração de TXID
- Criação de cobrança no Santander
- Geração de EMV/QR Code
- Atualização no banco de dados

É o ponto de entrada principal para operações PIX.
"""

import logging
import base64
from io import BytesIO
from decimal import Decimal
from datetime import datetime, date, timezone
from typing import Optional

from ..config import settings
from ..core.database import get_supabase_admin
from .txid import gerar_txid
from .emv import gerar_emv
from .santander.auth import SantanderAuth
from .santander.client import SantanderPixClient
from .santander.exceptions import (
    SantanderPixError,
    SantanderCobrancaJaExisteError,
)

logger = logging.getLogger(__name__)


class PixService:
    """
    Serviço de alto nível para geração de PIX.

    Orquestra todas as operações necessárias para gerar
    uma cobrança PIX completa a partir de uma cobrança existente.

    Uso:
        service = PixService()
        result = await service.gerar_pix_cobranca(cobranca_id=123)
    """

    def __init__(self):
        """Inicializa serviço com configurações do ambiente."""
        self._auth: Optional[SantanderAuth] = None
        self._client: Optional[SantanderPixClient] = None

    def _get_auth(self) -> SantanderAuth:
        """Obtém instância de autenticação (lazy loading)."""
        if not self._auth:
            self._auth = SantanderAuth(
                client_id=settings.SANTANDER_PIX_CLIENT_ID,
                client_secret=settings.SANTANDER_PIX_CLIENT_SECRET,
                pfx_password=settings.SANTANDER_PIX_PFX_PASSWORD,
                pfx_base64=settings.SANTANDER_PIX_PFX_BASE64,
            )
        return self._auth

    def _get_client(self) -> SantanderPixClient:
        """Obtém instância do cliente Santander (lazy loading)."""
        if not self._client:
            self._client = SantanderPixClient(self._get_auth())
        return self._client

    def _gerar_qrcode_base64(self, emv: str) -> str:
        """
        Gera imagem QR Code em base64.

        Args:
            emv: String EMV para codificar

        Returns:
            Imagem PNG em base64
        """
        try:
            import qrcode
        except ImportError:
            logger.error("Pacote qrcode não instalado. Instale com: pip install qrcode[pil]")
            return ""

        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(emv)
        qr.make(fit=True)

        img = qr.make_image(fill_color="black", back_color="white")
        buffer = BytesIO()
        img.save(buffer, format="PNG")

        return base64.b64encode(buffer.getvalue()).decode()

    async def gerar_pix_cobranca(
        self,
        cobranca_id: int,
        forcar_novo: bool = False
    ) -> dict:
        """
        Gera PIX para uma cobrança existente.

        Fluxo completo:
        1. Busca cobrança e beneficiário no banco
        2. Verifica se já tem PIX (retorna existente ou gera novo)
        3. Gera TXID único
        4. Cria cobrança no Santander
        5. Gera EMV e QR Code
        6. Atualiza cobrança no banco
        7. Retorna dados do PIX

        Args:
            cobranca_id: ID da cobrança
            forcar_novo: Se True, gera novo PIX mesmo se já existir

        Returns:
            Dict com dados do PIX:
            {
                "txid": "...",
                "status": "ATIVA",
                "qr_code_pix": "00020126...",
                "qr_code_pix_image": "base64...",
                "location": "...",
                "vencimento": "2025-01-15",
                "valor": 150.00
            }

        Raises:
            ValueError: Se cobrança não encontrada ou dados inválidos
            SantanderPixError: Se falhar comunicação com Santander
        """
        supabase = get_supabase_admin()

        # 1. Buscar cobrança com beneficiário
        logger.info(f"Gerando PIX para cobrança {cobranca_id}")

        cobranca_query = supabase.table("cobrancas").select(
            "*, beneficiarios(id, nome, cpf, cnpj)"
        ).eq("id", cobranca_id).single().execute()

        if not cobranca_query.data:
            raise ValueError(f"Cobrança {cobranca_id} não encontrada")

        cobranca = cobranca_query.data
        beneficiario = cobranca.get("beneficiarios") or {}

        # 2. Verificar se já tem PIX
        if cobranca.get("pix_txid") and not forcar_novo:
            logger.info(f"Cobrança {cobranca_id} já tem PIX: {cobranca['pix_txid']}")
            return {
                "txid": cobranca["pix_txid"],
                "status": cobranca.get("pix_status", "ATIVA"),
                "qr_code_pix": cobranca.get("qr_code_pix", ""),
                "qr_code_pix_image": cobranca.get("qr_code_pix_image", ""),
                "location": cobranca.get("pix_location"),
                "vencimento": cobranca.get("vencimento"),
                "valor": cobranca.get("valor_total"),
            }

        # Validar dados necessários
        valor = cobranca.get("valor_total")
        if not valor or Decimal(str(valor)) <= 0:
            raise ValueError(f"Valor inválido para cobrança {cobranca_id}: {valor}")

        vencimento = cobranca.get("vencimento")
        if not vencimento:
            raise ValueError(f"Vencimento não definido para cobrança {cobranca_id}")

        # Converter vencimento para date se necessário
        if isinstance(vencimento, str):
            vencimento = date.fromisoformat(vencimento)

        nome = beneficiario.get("nome", "")
        cpf = beneficiario.get("cpf", "")
        cnpj = beneficiario.get("cnpj")

        if not nome:
            raise ValueError(f"Beneficiário sem nome para cobrança {cobranca_id}")
        if not cpf and not cnpj:
            raise ValueError(f"Beneficiário sem CPF/CNPJ para cobrança {cobranca_id}")

        # 3. Gerar TXID
        documento = cnpj or cpf
        uc = cobranca.get("uc_id")  # Fallback
        txid = gerar_txid(nome=nome, documento=documento, uc=str(uc) if uc else None)

        logger.info(f"TXID gerado: {txid}")

        # 4. Criar cobrança no Santander
        client = self._get_client()

        try:
            resultado = await client.criar_cobranca_vencimento(
                txid=txid,
                valor=Decimal(str(valor)),
                cpf_devedor=cpf if not cnpj else None,
                cnpj_devedor=cnpj,
                nome_devedor=nome,
                chave_pix=settings.SANTANDER_PIX_CHAVE,
                data_vencimento=vencimento,
                validade_apos_vencimento=settings.PIX_VALIDADE_APOS_VENCIMENTO,
                multa_percentual=Decimal(str(settings.PIX_MULTA_PERCENTUAL)),
                juros_mensal=Decimal(str(settings.PIX_JUROS_MENSAL_PERCENTUAL)),
                descricao=f"Cobrança energia - {cobranca.get('mes', '')}/{cobranca.get('ano', '')}"
            )
        except SantanderCobrancaJaExisteError:
            # TXID já existe, gerar novo e tentar novamente
            logger.warning(f"TXID {txid} já existe, gerando novo")
            txid = gerar_txid(nome=nome, documento=documento)
            resultado = await client.criar_cobranca_vencimento(
                txid=txid,
                valor=Decimal(str(valor)),
                cpf_devedor=cpf if not cnpj else None,
                cnpj_devedor=cnpj,
                nome_devedor=nome,
                chave_pix=settings.SANTANDER_PIX_CHAVE,
                data_vencimento=vencimento,
                validade_apos_vencimento=settings.PIX_VALIDADE_APOS_VENCIMENTO,
                multa_percentual=Decimal(str(settings.PIX_MULTA_PERCENTUAL)),
                juros_mensal=Decimal(str(settings.PIX_JUROS_MENSAL_PERCENTUAL)),
            )

        # 5. Gerar EMV e QR Code
        pix_copia_cola = resultado.get("pixCopiaECola")
        location = resultado.get("location")

        emv = gerar_emv(
            pix_copia_cola=pix_copia_cola,
            location=location,
            valor=f"{valor:.2f}",
            recebedor_nome=settings.SANTANDER_PIX_RECEBEDOR_NOME,
            recebedor_cidade=settings.SANTANDER_PIX_RECEBEDOR_CIDADE,
        )

        qr_image = self._gerar_qrcode_base64(emv)

        # 6. Atualizar cobrança no banco
        update_data = {
            "pix_txid": txid,
            "pix_location": location,
            "pix_status": resultado.get("status", "ATIVA"),
            "pix_criado_em": datetime.now(timezone.utc).isoformat(),
            "qr_code_pix": emv,
            "qr_code_pix_image": qr_image,
        }

        supabase.table("cobrancas").update(update_data).eq("id", cobranca_id).execute()

        logger.info(f"PIX gerado e salvo para cobrança {cobranca_id}: TXID={txid}")

        # 7. Retornar resultado
        return {
            "txid": txid,
            "status": resultado.get("status", "ATIVA"),
            "qr_code_pix": emv,
            "qr_code_pix_image": qr_image,
            "location": location,
            "vencimento": vencimento,
            "valor": valor,
        }

    async def consultar_status(self, cobranca_id: int) -> dict:
        """
        Consulta status atual do PIX no Santander.

        Atualiza o status no banco de dados.

        Args:
            cobranca_id: ID da cobrança

        Returns:
            Dict com status atualizado
        """
        supabase = get_supabase_admin()

        # Buscar TXID da cobrança
        cobranca = supabase.table("cobrancas").select(
            "pix_txid, pix_status"
        ).eq("id", cobranca_id).single().execute()

        if not cobranca.data:
            raise ValueError(f"Cobrança {cobranca_id} não encontrada")

        txid = cobranca.data.get("pix_txid")
        if not txid:
            raise ValueError(f"Cobrança {cobranca_id} não tem PIX gerado")

        # Consultar no Santander
        client = self._get_client()
        resultado = await client.consultar_cobranca(txid)

        status = resultado.get("status", "ATIVA")

        # Verificar se foi pago
        pago = status == "CONCLUIDA"
        pagamento = None

        if pago:
            pix_list = resultado.get("pix", [])
            if pix_list:
                pagamento = pix_list[0]

        # Atualizar no banco
        update_data = {"pix_status": status}

        if pago and pagamento:
            update_data["pix_pago_em"] = pagamento.get("horario")
            update_data["pix_valor_pago"] = pagamento.get("valor")
            update_data["pix_e2e_id"] = pagamento.get("endToEndId")
            # Atualizar status da cobrança para PAGA
            update_data["status"] = "PAGA"

        supabase.table("cobrancas").update(update_data).eq("id", cobranca_id).execute()

        return {
            "txid": txid,
            "status": status,
            "pago": pago,
            "pagamento": pagamento,
            "valor_original": resultado.get("valor", {}).get("original"),
            "data_vencimento": resultado.get("calendario", {}).get("dataDeVencimento"),
        }

    async def verificar_e_atualizar_pagamentos(
        self,
        cobrancas_ids: list[int] = None
    ) -> dict:
        """
        Verifica pagamentos de múltiplas cobranças.

        Útil para reconciliação manual ou job periódico.

        Args:
            cobrancas_ids: Lista de IDs a verificar. Se None, verifica todas EMITIDAS.

        Returns:
            Dict com resumo: {
                "verificadas": 10,
                "pagas": 2,
                "erros": 1,
                "detalhes": [...]
            }
        """
        supabase = get_supabase_admin()

        # Buscar cobranças a verificar
        query = supabase.table("cobrancas").select("id, pix_txid")

        if cobrancas_ids:
            query = query.in_("id", cobrancas_ids)
        else:
            # Apenas cobranças emitidas com PIX
            query = query.eq("status", "EMITIDA").not_.is_("pix_txid", "null")

        result = query.execute()
        cobrancas = result.data or []

        resumo = {
            "verificadas": 0,
            "pagas": 0,
            "erros": 0,
            "detalhes": []
        }

        for cob in cobrancas:
            try:
                status = await self.consultar_status(cob["id"])
                resumo["verificadas"] += 1

                if status["pago"]:
                    resumo["pagas"] += 1

                resumo["detalhes"].append({
                    "cobranca_id": cob["id"],
                    "txid": cob["pix_txid"],
                    "status": status["status"],
                    "pago": status["pago"]
                })

            except Exception as e:
                logger.error(f"Erro ao verificar cobrança {cob['id']}: {e}")
                resumo["erros"] += 1
                resumo["detalhes"].append({
                    "cobranca_id": cob["id"],
                    "erro": str(e)
                })

        return resumo


# Singleton para uso global
pix_service = PixService()
