"""
Cliente HTTP para API PIX Santander

Implementa as operações:
- Criar cobrança com vencimento (COBV)
- Consultar cobrança
- Revisar cobrança
"""

import logging
from decimal import Decimal
from datetime import date
from typing import Optional
import httpx

from .auth import SantanderAuth
from .schemas import (
    CriarCobrancaRequest,
    RevisarCobrancaRequest,
    CobrancaResponse,
    Calendario,
    Devedor,
    Valor,
    Multa,
    Juros,
)
from .exceptions import (
    SantanderPixError,
    SantanderCobrancaError,
    SantanderCobrancaJaExisteError,
    SantanderCobrancaNaoEncontradaError,
    SantanderValidationError,
    SantanderRateLimitError,
    SantanderServiceUnavailableError,
)

logger = logging.getLogger(__name__)


class SantanderPixClient:
    """
    Cliente para API PIX Santander.

    Todas as operações usam mTLS (certificado) + Bearer token.

    Endpoints:
    - PUT /api/v1/cobv/{txid} - Criar cobrança com vencimento
    - GET /cobv/{txid} - Consultar cobrança
    - PATCH /cobv/{txid} - Revisar cobrança

    Uso:
        auth = SantanderAuth(...)
        client = SantanderPixClient(auth)
        result = await client.criar_cobranca_vencimento(...)
    """

    BASE_URL = "https://trust-pix.santander.com.br"

    def __init__(self, auth: SantanderAuth, timeout: float = 30.0):
        """
        Inicializa cliente Santander.

        Args:
            auth: Instância de SantanderAuth para autenticação
            timeout: Timeout para requisições em segundos
        """
        self.auth = auth
        self.timeout = timeout

    async def _get_client(self) -> httpx.AsyncClient:
        """Cria cliente httpx configurado com certificado."""
        cert = self.auth.get_httpx_cert()
        return httpx.AsyncClient(
            cert=cert,
            verify=True,
            timeout=self.timeout
        )

    def _handle_error_response(self, response: httpx.Response, operation: str) -> None:
        """
        Trata erros da API Santander.

        Args:
            response: Response do httpx
            operation: Nome da operação para log

        Raises:
            Exceção apropriada baseada no status code
        """
        status = response.status_code

        try:
            error_data = response.json()
        except Exception:
            error_data = {"detail": response.text}

        error_msg = f"{operation} falhou ({status}): {error_data}"
        logger.error(error_msg)

        if status == 400:
            raise SantanderValidationError(error_msg, status, error_data)
        elif status == 401:
            # Token pode ter expirado, invalidar cache
            self.auth.invalidate_token()
            raise SantanderPixError(f"Não autorizado: {error_msg}", status, error_data)
        elif status == 404:
            raise SantanderCobrancaNaoEncontradaError(error_msg, status, error_data)
        elif status == 409:
            raise SantanderCobrancaJaExisteError(error_msg, status, error_data)
        elif status == 429:
            raise SantanderRateLimitError(error_msg, status, error_data)
        elif status >= 500:
            raise SantanderServiceUnavailableError(error_msg, status, error_data)
        else:
            raise SantanderCobrancaError(error_msg, status, error_data)

    async def criar_cobranca_vencimento(
        self,
        txid: str,
        valor: Decimal,
        cpf_devedor: str,
        nome_devedor: str,
        chave_pix: str,
        data_vencimento: date,
        validade_apos_vencimento: int = 30,
        multa_percentual: Decimal = Decimal("1.00"),
        juros_mensal: Decimal = Decimal("1.00"),
        descricao: str = "Cobrança dos serviços prestados.",
        cnpj_devedor: str = None,
    ) -> dict:
        """
        Cria cobrança PIX com vencimento (COBV).

        Args:
            txid: Identificador único da transação (26-35 chars)
            valor: Valor da cobrança
            cpf_devedor: CPF do devedor (apenas números)
            nome_devedor: Nome do devedor
            chave_pix: Chave PIX do recebedor
            data_vencimento: Data de vencimento
            validade_apos_vencimento: Dias válidos após vencimento
            multa_percentual: Percentual de multa (ex: 1.00 = 1%)
            juros_mensal: Percentual de juros ao mês (ex: 1.00 = 1%)
            descricao: Mensagem para o pagador
            cnpj_devedor: CNPJ do devedor (se PJ)

        Returns:
            Dict com dados da cobrança criada, incluindo pixCopiaECola

        Raises:
            SantanderCobrancaJaExisteError: Se TXID já existe
            SantanderValidationError: Se dados inválidos
            SantanderCobrancaError: Outros erros
        """
        token = await self.auth.get_token()

        # Montar payload
        devedor_data = {"nome": nome_devedor[:200]}
        if cnpj_devedor:
            devedor_data["cnpj"] = cnpj_devedor.replace(".", "").replace("-", "").replace("/", "")
        else:
            devedor_data["cpf"] = cpf_devedor.replace(".", "").replace("-", "")

        payload = {
            "calendario": {
                "dataDeVencimento": data_vencimento.isoformat(),
                "validadeAposVencimento": validade_apos_vencimento
            },
            "devedor": devedor_data,
            "valor": {
                "original": f"{valor:.2f}",
                "multa": {
                    "modalidade": "2",  # Percentual
                    "valorPerc": f"{multa_percentual:.2f}"
                },
                "juros": {
                    "modalidade": "3",  # Percentual ao mês
                    "valorPerc": f"{juros_mensal:.2f}"
                }
            },
            "chave": chave_pix,
            "solicitacaoPagador": descricao[:140]
        }

        logger.info(f"Criando cobrança PIX: TXID={txid}, valor={valor}")
        logger.debug(f"Payload: {payload}")

        async with await self._get_client() as client:
            response = await client.put(
                f"{self.BASE_URL}/api/v1/cobv/{txid}",
                json=payload,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                }
            )

            if response.status_code not in (200, 201):
                self._handle_error_response(response, "Criar cobrança")

            result = response.json()
            logger.info(f"Cobrança criada: TXID={txid}, status={result.get('status')}")

            return result

    async def consultar_cobranca(
        self,
        txid: str,
        revisao: int = None
    ) -> dict:
        """
        Consulta uma cobrança PIX.

        Args:
            txid: Identificador da transação
            revisao: Número da revisão (opcional)

        Returns:
            Dict com dados da cobrança

        Raises:
            SantanderCobrancaNaoEncontradaError: Se não encontrada
        """
        token = await self.auth.get_token()

        url = f"{self.BASE_URL}/cobv/{txid}"
        if revisao is not None:
            url += f"?revisao={revisao}"

        logger.info(f"Consultando cobrança PIX: TXID={txid}")

        async with await self._get_client() as client:
            response = await client.get(
                url,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/json"
                }
            )

            if response.status_code != 200:
                self._handle_error_response(response, "Consultar cobrança")

            result = response.json()
            logger.info(f"Cobrança consultada: TXID={txid}, status={result.get('status')}")

            return result

    async def revisar_cobranca(
        self,
        txid: str,
        valor: Decimal = None,
        cpf_devedor: str = None,
        cnpj_devedor: str = None,
        nome_devedor: str = None,
        descricao: str = None,
    ) -> dict:
        """
        Revisa uma cobrança PIX existente.

        Apenas campos fornecidos serão atualizados.

        Args:
            txid: Identificador da transação
            valor: Novo valor (opcional)
            cpf_devedor: Novo CPF (opcional)
            cnpj_devedor: Novo CNPJ (opcional)
            nome_devedor: Novo nome (opcional)
            descricao: Nova descrição (opcional)

        Returns:
            Dict com dados atualizados da cobrança
        """
        token = await self.auth.get_token()

        # Montar payload apenas com campos fornecidos
        payload = {}

        if nome_devedor or cpf_devedor or cnpj_devedor:
            devedor = {}
            if nome_devedor:
                devedor["nome"] = nome_devedor[:200]
            if cnpj_devedor:
                devedor["cnpj"] = cnpj_devedor.replace(".", "").replace("-", "").replace("/", "")
            elif cpf_devedor:
                devedor["cpf"] = cpf_devedor.replace(".", "").replace("-", "")
            payload["devedor"] = devedor

        if valor is not None:
            payload["valor"] = {"original": f"{valor:.2f}"}

        if descricao:
            payload["solicitacaoPagador"] = descricao[:140]

        if not payload:
            raise SantanderValidationError("Nenhum campo para atualizar")

        logger.info(f"Revisando cobrança PIX: TXID={txid}")
        logger.debug(f"Payload revisão: {payload}")

        async with await self._get_client() as client:
            response = await client.patch(
                f"{self.BASE_URL}/cobv/{txid}",
                json=payload,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                }
            )

            if response.status_code != 200:
                self._handle_error_response(response, "Revisar cobrança")

            result = response.json()
            logger.info(f"Cobrança revisada: TXID={txid}")

            return result

    async def verificar_pagamento(self, txid: str) -> Optional[dict]:
        """
        Verifica se uma cobrança foi paga.

        Args:
            txid: Identificador da transação

        Returns:
            Dict com dados do pagamento se pago, None se não pago
        """
        result = await self.consultar_cobranca(txid)

        if result.get("status") == "CONCLUIDA":
            # Cobrança foi paga
            pix_list = result.get("pix", [])
            if pix_list:
                return pix_list[0]  # Retorna primeiro pagamento

        return None
