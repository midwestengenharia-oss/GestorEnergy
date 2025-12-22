"""
Exceções específicas para integração PIX Santander
"""


class SantanderPixError(Exception):
    """Erro base para operações PIX Santander."""

    def __init__(self, message: str, status_code: int = None, response: dict = None):
        self.message = message
        self.status_code = status_code
        self.response = response
        super().__init__(self.message)


class SantanderAuthError(SantanderPixError):
    """Erro de autenticação com Santander."""
    pass


class SantanderTokenExpiredError(SantanderAuthError):
    """Token OAuth expirou."""
    pass


class SantanderCertificateError(SantanderAuthError):
    """Erro relacionado ao certificado PFX."""
    pass


class SantanderCobrancaError(SantanderPixError):
    """Erro ao criar/consultar cobrança."""
    pass


class SantanderCobrancaJaExisteError(SantanderCobrancaError):
    """TXID já existe no Santander."""
    pass


class SantanderCobrancaNaoEncontradaError(SantanderCobrancaError):
    """Cobrança não encontrada."""
    pass


class SantanderValidationError(SantanderPixError):
    """Erro de validação nos dados enviados."""
    pass


class SantanderRateLimitError(SantanderPixError):
    """Rate limit atingido."""
    pass


class SantanderServiceUnavailableError(SantanderPixError):
    """Serviço Santander indisponível."""
    pass
