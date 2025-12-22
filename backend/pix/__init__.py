"""
Módulo PIX - Integração com APIs de pagamento PIX

Este módulo fornece:
- Geração de TXID único para cobranças
- Geração de EMV (string para QR Code PIX)
- Cliente para API PIX Santander
- Serviço de orquestração integrado com cobranças
"""

from .txid import gerar_txid
from .emv import gerar_emv

__all__ = [
    "gerar_txid",
    "gerar_emv",
]
