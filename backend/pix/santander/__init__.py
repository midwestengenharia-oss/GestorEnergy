"""
Módulo Santander PIX - Cliente para API PIX do Santander

Fornece:
- SantanderAuth: Autenticação mTLS + OAuth2
- SantanderPixClient: Cliente para operações PIX
"""

from .auth import SantanderAuth
from .client import SantanderPixClient

__all__ = [
    "SantanderAuth",
    "SantanderPixClient",
]
