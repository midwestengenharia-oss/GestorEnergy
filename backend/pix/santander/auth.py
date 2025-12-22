"""
Autenticação mTLS + OAuth2 para API PIX Santander

O Santander exige:
1. Certificado digital A1 (PFX) para mTLS
2. OAuth2 client_credentials para obter access_token
3. Token tem vida curta (~5 min), precisa renovar frequentemente
"""

import ssl
import base64
import tempfile
import asyncio
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Tuple
import httpx
from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.hazmat.primitives.serialization import (
    Encoding,
    PrivateFormat,
    NoEncryption,
)
from cryptography.hazmat.backends import default_backend
from cryptography.x509 import Certificate

from .exceptions import (
    SantanderAuthError,
    SantanderTokenExpiredError,
    SantanderCertificateError,
)

logger = logging.getLogger(__name__)


class SantanderAuth:
    """
    Gerencia autenticação com API PIX Santander.

    Responsabilidades:
    - Carregar certificado PFX (de arquivo ou base64)
    - Criar contexto SSL para mTLS
    - Obter e renovar access_token OAuth2
    - Cache do token com renovação automática

    Uso:
        auth = SantanderAuth(
            client_id="...",
            client_secret="...",
            pfx_base64="...",  # ou pfx_path="/path/to/cert.pfx"
            pfx_password="..."
        )
        token = await auth.get_token()
    """

    TOKEN_URL = "https://trust-pix.santander.com.br/oauth/token"
    TOKEN_MARGIN_SECONDS = 60  # Renovar 1 minuto antes de expirar

    def __init__(
        self,
        client_id: str,
        client_secret: str,
        pfx_password: str,
        pfx_base64: str = None,
        pfx_path: str = None,
    ):
        """
        Inicializa autenticação Santander.

        Args:
            client_id: Client ID da aplicação no Santander
            client_secret: Client Secret da aplicação
            pfx_password: Senha do certificado PFX
            pfx_base64: Certificado PFX em base64 (preferencial para containers)
            pfx_path: Caminho do arquivo PFX (alternativa ao base64)
        """
        if not pfx_base64 and not pfx_path:
            raise SantanderCertificateError(
                "Necessário fornecer pfx_base64 ou pfx_path"
            )

        self.client_id = client_id
        self.client_secret = client_secret
        self.pfx_password = pfx_password
        self.pfx_base64 = pfx_base64
        self.pfx_path = pfx_path

        # Cache do token
        self._token: Optional[str] = None
        self._expires_at: Optional[datetime] = None
        self._lock = asyncio.Lock()

        # Cache dos arquivos temporários de certificado
        self._cert_file: Optional[str] = None
        self._key_file: Optional[str] = None

    def _load_pfx_data(self) -> bytes:
        """Carrega dados do PFX de arquivo ou base64."""
        if self.pfx_base64:
            try:
                return base64.b64decode(self.pfx_base64)
            except Exception as e:
                raise SantanderCertificateError(
                    f"Erro ao decodificar PFX base64: {e}"
                )

        if self.pfx_path:
            path = Path(self.pfx_path)
            if not path.exists():
                raise SantanderCertificateError(
                    f"Arquivo PFX não encontrado: {self.pfx_path}"
                )
            return path.read_bytes()

        raise SantanderCertificateError("Nenhuma fonte de certificado configurada")

    def _extract_cert_and_key(self) -> Tuple[str, str]:
        """
        Extrai certificado e chave privada do PFX.

        Salva em arquivos temporários (necessário para httpx).

        Returns:
            Tuple (cert_path, key_path)
        """
        if self._cert_file and self._key_file:
            # Verificar se ainda existem
            if Path(self._cert_file).exists() and Path(self._key_file).exists():
                return self._cert_file, self._key_file

        pfx_data = self._load_pfx_data()

        try:
            private_key, certificate, chain = pkcs12.load_key_and_certificates(
                pfx_data,
                self.pfx_password.encode(),
                default_backend()
            )
        except Exception as e:
            raise SantanderCertificateError(
                f"Erro ao carregar certificado PFX: {e}"
            )

        if not private_key or not certificate:
            raise SantanderCertificateError(
                "Certificado PFX não contém chave privada ou certificado"
            )

        # Salvar certificado em arquivo temporário
        cert_pem = certificate.public_bytes(Encoding.PEM)
        cert_file = tempfile.NamedTemporaryFile(
            mode='wb',
            suffix='.pem',
            delete=False
        )
        cert_file.write(cert_pem)
        cert_file.close()

        # Salvar chave privada em arquivo temporário
        key_pem = private_key.private_bytes(
            Encoding.PEM,
            PrivateFormat.TraditionalOpenSSL,
            NoEncryption()
        )
        key_file = tempfile.NamedTemporaryFile(
            mode='wb',
            suffix='.pem',
            delete=False
        )
        key_file.write(key_pem)
        key_file.close()

        self._cert_file = cert_file.name
        self._key_file = key_file.name

        logger.debug(f"Certificado extraído para: {self._cert_file}")

        return self._cert_file, self._key_file

    def get_ssl_context(self) -> ssl.SSLContext:
        """
        Cria contexto SSL com certificado mTLS.

        Returns:
            SSLContext configurado para mTLS
        """
        cert_path, key_path = self._extract_cert_and_key()

        ctx = ssl.create_default_context()
        ctx.load_cert_chain(certfile=cert_path, keyfile=key_path)

        return ctx

    def get_httpx_cert(self) -> Tuple[str, str]:
        """
        Retorna tupla (cert, key) para uso com httpx.

        Returns:
            Tuple (cert_path, key_path)
        """
        return self._extract_cert_and_key()

    async def get_token(self) -> str:
        """
        Obtém access_token válido.

        Usa cache e renova automaticamente quando necessário.

        Returns:
            Access token válido

        Raises:
            SantanderAuthError: Se falhar ao obter token
        """
        async with self._lock:
            if self._is_token_valid():
                return self._token

            await self._refresh_token()
            return self._token

    def _is_token_valid(self) -> bool:
        """Verifica se token ainda é válido."""
        if not self._token or not self._expires_at:
            return False

        # Considera inválido se vai expirar em menos de TOKEN_MARGIN_SECONDS
        margin = timedelta(seconds=self.TOKEN_MARGIN_SECONDS)
        return datetime.now() < (self._expires_at - margin)

    async def _refresh_token(self) -> None:
        """
        Obtém novo token do Santander.

        Raises:
            SantanderAuthError: Se falhar na autenticação
        """
        cert_path, key_path = self._extract_cert_and_key()

        try:
            async with httpx.AsyncClient(
                cert=(cert_path, key_path),
                verify=True,
                timeout=30.0
            ) as client:
                response = await client.post(
                    f"{self.TOKEN_URL}?grant_type=client_credentials",
                    data={
                        "client_id": self.client_id,
                        "client_secret": self.client_secret,
                    },
                    headers={
                        "Content-Type": "application/x-www-form-urlencoded"
                    }
                )

                if response.status_code != 200:
                    error_msg = f"Erro ao obter token: {response.status_code}"
                    try:
                        error_data = response.json()
                        error_msg += f" - {error_data}"
                    except Exception:
                        error_msg += f" - {response.text}"
                    raise SantanderAuthError(error_msg, response.status_code)

                data = response.json()

                self._token = data["access_token"]
                expires_in = int(data.get("expires_in", 300))
                self._expires_at = datetime.now() + timedelta(seconds=expires_in)

                logger.info(
                    f"Token Santander obtido, expira em {expires_in}s "
                    f"(às {self._expires_at.strftime('%H:%M:%S')})"
                )

        except httpx.RequestError as e:
            raise SantanderAuthError(f"Erro de conexão com Santander: {e}")

    def invalidate_token(self) -> None:
        """Invalida token em cache (força renovação na próxima chamada)."""
        self._token = None
        self._expires_at = None

    def cleanup(self) -> None:
        """Remove arquivos temporários de certificado."""
        import os
        for path in [self._cert_file, self._key_file]:
            if path and Path(path).exists():
                try:
                    os.unlink(path)
                except Exception as e:
                    logger.warning(f"Erro ao remover arquivo temporário {path}: {e}")

        self._cert_file = None
        self._key_file = None
