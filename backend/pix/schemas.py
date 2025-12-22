"""
Schemas públicos do módulo PIX

Modelos para uso externo (routers, outros serviços).
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, date
from decimal import Decimal


class PixGerarRequest(BaseModel):
    """Request para gerar PIX de uma cobrança."""
    cobranca_id: int = Field(..., description="ID da cobrança")


class PixGerarResponse(BaseModel):
    """Response da geração de PIX."""
    txid: str = Field(..., description="TXID único da cobrança")
    status: str = Field(..., description="Status no Santander (ATIVA, CONCLUIDA, etc)")
    qr_code_pix: str = Field(..., description="String EMV (copia e cola)")
    qr_code_pix_image: str = Field(..., description="QR Code em base64")
    location: Optional[str] = Field(None, description="URL do payload PIX")
    vencimento: Optional[date] = Field(None, description="Data de vencimento")
    valor: Optional[Decimal] = Field(None, description="Valor da cobrança")


class PixConsultarResponse(BaseModel):
    """Response da consulta de status PIX."""
    txid: str
    status: str
    valor_original: Optional[str] = None
    data_vencimento: Optional[str] = None
    pago: bool = False
    pagamento: Optional[dict] = None  # Dados do pagamento se pago


class PixStatusResponse(BaseModel):
    """Status resumido do PIX de uma cobrança."""
    cobranca_id: int
    tem_pix: bool = False
    txid: Optional[str] = None
    status: Optional[str] = None
    qr_code_pix: Optional[str] = None
    pago: bool = False
    pago_em: Optional[datetime] = None
    valor_pago: Optional[Decimal] = None
