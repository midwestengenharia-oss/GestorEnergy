"""
Beneficiarios Schemas - Modelos Pydantic para Beneficiários de GD
"""

from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, List
from datetime import datetime
from decimal import Decimal
from enum import Enum
import re


class BeneficiarioStatus(str, Enum):
    """Status do beneficiário"""
    PENDENTE = "PENDENTE"
    ATIVO = "ATIVO"
    SUSPENSO = "SUSPENSO"
    CANCELADO = "CANCELADO"


class BeneficiarioTipo(str, Enum):
    """Tipo do beneficiário"""
    USINA = "USINA"      # Participa do rateio de uma usina
    AVULSO = "AVULSO"    # Créditos transferidos (não participa de rateio)


# ========================
# Request Schemas
# ========================

class BeneficiarioCreateRequest(BaseModel):
    """Criar novo beneficiário"""
    usina_id: int = Field(..., description="ID da usina")
    uc_id: int = Field(..., description="ID da UC beneficiária")
    cpf: str = Field(..., description="CPF do beneficiário")
    nome: Optional[str] = Field(None, max_length=200)
    email: Optional[EmailStr] = None
    telefone: Optional[str] = None
    percentual_rateio: Decimal = Field(..., ge=0, le=100, description="Percentual do rateio (0-100)")
    desconto: Decimal = Field(..., ge=0, le=1, description="Desconto oferecido (0-1)")

    @field_validator("cpf")
    @classmethod
    def validate_cpf(cls, v: str) -> str:
        cpf = re.sub(r'\D', '', v)
        if len(cpf) != 11:
            raise ValueError("CPF deve ter 11 dígitos")
        if cpf == cpf[0] * 11:
            raise ValueError("CPF inválido")
        # Calcula primeiro dígito
        soma = sum(int(cpf[i]) * (10 - i) for i in range(9))
        d1 = (soma * 10 % 11) % 10
        # Calcula segundo dígito
        soma = sum(int(cpf[i]) * (11 - i) for i in range(10))
        d2 = (soma * 10 % 11) % 10
        if cpf[-2:] != f"{d1}{d2}":
            raise ValueError("CPF inválido")
        return f"{cpf[:3]}.{cpf[3:6]}.{cpf[6:9]}-{cpf[9:]}"

    @field_validator("telefone")
    @classmethod
    def validate_telefone(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        tel = re.sub(r'\D', '', v)
        if len(tel) not in [10, 11]:
            raise ValueError("Telefone deve ter 10 ou 11 dígitos")
        if len(tel) == 11:
            return f"({tel[:2]}) {tel[2:7]}-{tel[7:]}"
        return f"({tel[:2]}) {tel[2:6]}-{tel[6:]}"


class BeneficiarioUpdateRequest(BaseModel):
    """Atualizar beneficiário"""
    nome: Optional[str] = Field(None, max_length=200)
    email: Optional[EmailStr] = None
    telefone: Optional[str] = None
    percentual_rateio: Optional[Decimal] = Field(None, ge=0, le=100)
    desconto: Optional[Decimal] = Field(None, ge=0, le=1)
    status: Optional[BeneficiarioStatus] = None

    @field_validator("telefone")
    @classmethod
    def validate_telefone(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        tel = re.sub(r'\D', '', v)
        if len(tel) not in [10, 11]:
            raise ValueError("Telefone deve ter 10 ou 11 dígitos")
        if len(tel) == 11:
            return f"({tel[:2]}) {tel[2:7]}-{tel[7:]}"
        return f"({tel[:2]}) {tel[2:6]}-{tel[6:]}"


class BeneficiarioAvulsoCreateRequest(BaseModel):
    """Criar beneficiário avulso (GD por transferência de créditos)"""
    uc_id: int = Field(..., description="ID da UC com créditos GD")
    cpf: str = Field(..., description="CPF do cliente que vai pagar")
    nome: Optional[str] = Field(None, max_length=200, description="Nome do cliente")
    email: Optional[EmailStr] = Field(None, description="Email do cliente")
    telefone: Optional[str] = Field(None, description="Telefone do cliente")
    desconto: Decimal = Field(default=Decimal("0.30"), ge=0, le=1, description="Desconto oferecido (padrão 30%)")

    @field_validator("cpf")
    @classmethod
    def validate_cpf(cls, v: str) -> str:
        cpf = re.sub(r'\D', '', v)
        if len(cpf) != 11:
            raise ValueError("CPF deve ter 11 dígitos")
        if cpf == cpf[0] * 11:
            raise ValueError("CPF inválido")
        soma = sum(int(cpf[i]) * (10 - i) for i in range(9))
        d1 = (soma * 10 % 11) % 10
        soma = sum(int(cpf[i]) * (11 - i) for i in range(10))
        d2 = (soma * 10 % 11) % 10
        if cpf[-2:] != f"{d1}{d2}":
            raise ValueError("CPF inválido")
        return f"{cpf[:3]}.{cpf[3:6]}.{cpf[6:9]}-{cpf[9:]}"

    @field_validator("telefone")
    @classmethod
    def validate_telefone(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        tel = re.sub(r'\D', '', v)
        if len(tel) not in [10, 11]:
            raise ValueError("Telefone deve ter 10 ou 11 dígitos")
        if len(tel) == 11:
            return f"({tel[:2]}) {tel[2:7]}-{tel[7:]}"
        return f"({tel[:2]}) {tel[2:6]}-{tel[6:]}"


class ConviteEnviarRequest(BaseModel):
    """Enviar convite ao beneficiário"""
    beneficiario_id: int
    mensagem_personalizada: Optional[str] = None


# ========================
# Response Schemas
# ========================

class UCBeneficiarioResponse(BaseModel):
    """UC do beneficiário"""
    id: int
    uc_formatada: str
    nome_titular: Optional[str] = None
    endereco: Optional[str] = None
    cidade: Optional[str] = None
    uf: Optional[str] = None

    class Config:
        from_attributes = True


class UsinaResumoResponse(BaseModel):
    """Resumo da usina"""
    id: int
    nome: str
    desconto_padrao: Decimal

    class Config:
        from_attributes = True


class UsuarioResumoResponse(BaseModel):
    """Resumo do usuário vinculado"""
    id: str
    nome_completo: str
    email: str

    class Config:
        from_attributes = True


class ContratoResumoResponse(BaseModel):
    """Resumo do contrato"""
    id: int
    status: str
    vigencia_inicio: Optional[datetime] = None
    vigencia_fim: Optional[datetime] = None

    class Config:
        from_attributes = True


class BeneficiarioResponse(BaseModel):
    """Dados completos do beneficiário"""
    id: int
    usuario_id: Optional[str] = None
    uc_id: int
    usina_id: Optional[int] = None  # NULL para beneficiários avulsos
    contrato_id: Optional[int] = None

    # Tipo do beneficiário
    tipo: str = "USINA"  # USINA ou AVULSO

    # Dados cadastrais
    cpf: str
    nome: Optional[str] = None
    email: Optional[str] = None
    telefone: Optional[str] = None

    # Configurações
    percentual_rateio: Optional[Decimal] = None  # NULL para avulsos
    desconto: Decimal

    # Status
    status: str = "PENDENTE"
    convite_enviado_em: Optional[datetime] = None
    ativado_em: Optional[datetime] = None

    # Timestamps
    criado_em: Optional[datetime] = None
    atualizado_em: Optional[datetime] = None

    # Relacionamentos
    uc: Optional[UCBeneficiarioResponse] = None
    usina: Optional[UsinaResumoResponse] = None
    usuario: Optional[UsuarioResumoResponse] = None
    contrato: Optional[ContratoResumoResponse] = None

    class Config:
        from_attributes = True


class BeneficiarioListResponse(BaseModel):
    """Lista de beneficiários com paginação"""
    beneficiarios: List[BeneficiarioResponse]
    total: int
    page: int
    per_page: int
    total_pages: int


class BeneficiarioResumoResponse(BaseModel):
    """Resumo do beneficiário para listagens"""
    id: int
    cpf: str
    nome: Optional[str] = None
    email: Optional[str] = None
    percentual_rateio: Decimal
    desconto: Decimal
    status: str
    uc_formatada: Optional[str] = None
    usina_nome: Optional[str] = None

    class Config:
        from_attributes = True


# ========================
# Convites
# ========================

class ConviteResponse(BaseModel):
    """Resposta do convite"""
    id: int
    tipo: str
    email: str
    cpf: Optional[str] = None
    nome: Optional[str] = None
    token: str
    expira_em: datetime
    status: str
    criado_em: Optional[datetime] = None

    class Config:
        from_attributes = True


class ConviteAceitarRequest(BaseModel):
    """Aceitar convite"""
    token: str
    senha: str = Field(..., min_length=6)


# ========================
# Filtros
# ========================

class BeneficiarioFiltros(BaseModel):
    """Filtros para busca de beneficiários"""
    usina_id: Optional[int] = None
    uc_id: Optional[int] = None
    cpf: Optional[str] = None
    nome: Optional[str] = None
    email: Optional[str] = None
    status: Optional[BeneficiarioStatus] = None


# ========================
# Respostas genéricas
# ========================

class MessageResponse(BaseModel):
    """Resposta genérica com mensagem"""
    message: str
    success: bool = True
