"""
Configurações do Backend Unificado - Plataforma GD
"""

from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional


class Settings(BaseSettings):
    """Configurações da aplicação carregadas de variáveis de ambiente"""

    # ========================
    # Supabase
    # ========================
    SUPABASE_URL: str = "https://supabase.midwestengenharia.com.br"
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""

    # ========================
    # JWT / Segurança
    # ========================
    JWT_SECRET_KEY: str = "sua-chave-secreta-muito-segura-mude-em-producao"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ========================
    # Aplicação
    # ========================
    APP_NAME: str = "Plataforma GD - Backend"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"  # development, staging, production

    # ========================
    # CORS
    # ========================
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:3000,https://app.midwestengenharia.com.br"

    @property
    def cors_origins(self) -> list[str]:
        """Retorna lista de origens permitidas para CORS"""
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]

    # ========================
    # Rate Limiting
    # ========================
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_WINDOW: int = 60  # segundos

    # ========================
    # Energisa Gateway
    # ========================
    ENERGISA_SESSION_TIMEOUT: int = 300  # 5 minutos
    ENERGISA_TOKEN_EXPIRATION_HOURS: int = 24

    # ========================
    # LLM / AI Extraction
    # ========================
    LLMWHISPERER_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"

    # ========================
    # Database (PostgreSQL via Supabase)
    # ========================
    DATABASE_URL: Optional[str] = None

    @property
    def database_url(self) -> str:
        """Constrói URL do banco se não fornecida diretamente"""
        if self.DATABASE_URL:
            return self.DATABASE_URL
        # URL padrão para desenvolvimento local
        return "postgresql://postgres:postgres@localhost:54322/postgres"

    # ========================
    # Configurações de Negócio
    # ========================
    TAXA_PLATAFORMA_PERCENTUAL: float = 0.05  # 5%
    DIAS_EXPIRACAO_CONVITE: int = 7
    MAX_BENEFICIARIOS_POR_USINA: int = 100
    MAX_UCS_POR_USUARIO: int = 50

    # ========================
    # Sincronização de Faturas
    # ========================
    SYNC_MAX_FATURAS_POR_UC: int = 3  # Número máximo de faturas a verificar por UC em cada sincronização

    # ========================
    # PIX Santander
    # ========================
    SANTANDER_PIX_CLIENT_ID: str = ""
    SANTANDER_PIX_CLIENT_SECRET: str = ""
    SANTANDER_PIX_PFX_BASE64: str = ""  # Certificado PFX em base64
    SANTANDER_PIX_PFX_PASSWORD: str = ""
    SANTANDER_PIX_CHAVE: str = "61902316000163"  # CNPJ Midwest
    SANTANDER_PIX_RECEBEDOR_NOME: str = "MIDWEST ENERGIAS LTDA"
    SANTANDER_PIX_RECEBEDOR_CIDADE: str = "CUIABA"

    # Configurações de cobrança PIX
    PIX_MULTA_PERCENTUAL: float = 1.00  # 1%
    PIX_JUROS_MENSAL_PERCENTUAL: float = 1.00  # 1% ao mês
    PIX_VALIDADE_APOS_VENCIMENTO: int = 30  # dias

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """
    Retorna instância única das configurações (singleton).
    Usa cache para evitar recarregar o .env a cada chamada.
    """
    return Settings()


# Instância global para uso direto
settings = get_settings()
