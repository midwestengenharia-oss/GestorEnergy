"""
Schemas Pydantic para API PIX Santander

Modelos para request e response das operações PIX.
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date
from decimal import Decimal
from enum import Enum


# ========================
# Enums
# ========================

class StatusCobrancaPix(str, Enum):
    """Status de uma cobrança PIX no Santander."""
    ATIVA = "ATIVA"
    CONCLUIDA = "CONCLUIDA"
    REMOVIDA_PELO_USUARIO_RECEBEDOR = "REMOVIDA_PELO_USUARIO_RECEBEDOR"
    REMOVIDA_PELO_PSP = "REMOVIDA_PELO_PSP"


class ModalidadeMulta(str, Enum):
    """Modalidades de multa."""
    VALOR_FIXO = "1"
    PERCENTUAL = "2"


class ModalidadeJuros(str, Enum):
    """Modalidades de juros."""
    VALOR_DIA = "1"
    PERCENTUAL_DIA = "2"
    PERCENTUAL_MES = "3"


# ========================
# Request Schemas
# ========================

class Calendario(BaseModel):
    """Calendário da cobrança."""
    dataDeVencimento: str = Field(..., description="Data de vencimento (YYYY-MM-DD)")
    validadeAposVencimento: int = Field(30, ge=1, description="Dias válidos após vencimento")


class Devedor(BaseModel):
    """Dados do devedor."""
    cpf: Optional[str] = Field(None, min_length=11, max_length=11, description="CPF (apenas números)")
    cnpj: Optional[str] = Field(None, min_length=14, max_length=14, description="CNPJ (apenas números)")
    nome: str = Field(..., max_length=200, description="Nome do devedor")


class Multa(BaseModel):
    """Configuração de multa."""
    modalidade: str = Field("2", description="1=valor fixo, 2=percentual")
    valorPerc: str = Field(..., description="Valor ou percentual da multa")


class Juros(BaseModel):
    """Configuração de juros."""
    modalidade: str = Field("3", description="1=valor/dia, 2=%/dia, 3=%/mês")
    valorPerc: str = Field(..., description="Valor ou percentual dos juros")


class Valor(BaseModel):
    """Valor e encargos da cobrança."""
    original: str = Field(..., description="Valor original (ex: '150.00')")
    multa: Optional[Multa] = None
    juros: Optional[Juros] = None


class CriarCobrancaRequest(BaseModel):
    """Request para criar cobrança com vencimento (COBV)."""
    calendario: Calendario
    devedor: Devedor
    valor: Valor
    chave: str = Field(..., description="Chave PIX do recebedor")
    solicitacaoPagador: Optional[str] = Field(
        "Cobrança dos serviços prestados.",
        max_length=140,
        description="Mensagem para o pagador"
    )


class RevisarCobrancaRequest(BaseModel):
    """Request para revisar cobrança existente."""
    devedor: Optional[Devedor] = None
    valor: Optional[Valor] = None
    solicitacaoPagador: Optional[str] = Field(None, max_length=140)


# ========================
# Response Schemas
# ========================

class CalendarioResponse(BaseModel):
    """Calendário na resposta."""
    criacao: Optional[datetime] = None
    dataDeVencimento: Optional[str] = None
    validadeAposVencimento: Optional[int] = None


class LocationResponse(BaseModel):
    """Location do payload PIX."""
    id: Optional[int] = None
    location: Optional[str] = None
    tipoCob: Optional[str] = None


class PixResponse(BaseModel):
    """Informações de pagamento PIX."""
    endToEndId: Optional[str] = None
    txid: Optional[str] = None
    valor: Optional[str] = None
    horario: Optional[datetime] = None


class CobrancaResponse(BaseModel):
    """Resposta de cobrança PIX."""
    txid: str
    revisao: Optional[int] = None
    status: StatusCobrancaPix
    calendario: Optional[CalendarioResponse] = None
    devedor: Optional[Devedor] = None
    valor: Optional[Valor] = None
    chave: Optional[str] = None
    solicitacaoPagador: Optional[str] = None
    loc: Optional[LocationResponse] = None
    location: Optional[str] = None
    pixCopiaECola: Optional[str] = None
    pix: Optional[List[PixResponse]] = None

    class Config:
        use_enum_values = True


class TokenResponse(BaseModel):
    """Resposta do endpoint de token OAuth."""
    access_token: str
    token_type: str = "Bearer"
    expires_in: int = 300


# ========================
# Internal Schemas
# ========================

class PixCobrancaResult(BaseModel):
    """Resultado interno da criação de PIX."""
    txid: str
    status: str
    location: Optional[str] = None
    pix_copia_cola: Optional[str] = None
    qr_code_base64: Optional[str] = None
    vencimento: Optional[date] = None
    valor: Optional[Decimal] = None
