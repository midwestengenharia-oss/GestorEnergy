"""
Auth Schemas - Modelos Pydantic para autenticação
"""

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator
from typing import Optional, List
from datetime import datetime
from enum import Enum
import re


class TipoPessoa(str, Enum):
    """Tipo de pessoa"""
    PF = "PF"  # Pessoa Física
    PJ = "PJ"  # Pessoa Jurídica


def validar_cpf(cpf: str) -> str:
    """Valida e formata CPF"""
    cpf = re.sub(r'\D', '', cpf)
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


def validar_cnpj(cnpj: str) -> str:
    """Valida e formata CNPJ"""
    cnpj = re.sub(r'\D', '', cnpj)
    if len(cnpj) != 14:
        raise ValueError("CNPJ deve ter 14 dígitos")
    if cnpj == cnpj[0] * 14:
        raise ValueError("CNPJ inválido")
    pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    soma = sum(int(cnpj[i]) * pesos1[i] for i in range(12))
    resto = soma % 11
    d1 = 0 if resto < 2 else 11 - resto
    pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    soma = sum(int(cnpj[i]) * pesos2[i] for i in range(13))
    resto = soma % 11
    d2 = 0 if resto < 2 else 11 - resto
    if cnpj[-2:] != f"{d1}{d2}":
        raise ValueError("CNPJ inválido")
    return f"{cnpj[:2]}.{cnpj[2:5]}.{cnpj[5:8]}/{cnpj[8:12]}-{cnpj[12:]}"


def validar_telefone(telefone: Optional[str]) -> Optional[str]:
    """Valida e formata telefone"""
    if telefone is None:
        return None
    tel = re.sub(r'\D', '', telefone)
    if len(tel) not in [10, 11]:
        raise ValueError("Telefone deve ter 10 ou 11 dígitos")
    if len(tel) == 11:
        return f"({tel[:2]}) {tel[2:7]}-{tel[7:]}"
    return f"({tel[:2]}) {tel[2:6]}-{tel[6:]}"


# ========================
# Request Schemas
# ========================

class SignUpRequest(BaseModel):
    """Requisição de cadastro"""
    email: EmailStr
    password: str = Field(..., min_length=6, description="Senha (mínimo 6 caracteres)")
    nome_completo: str = Field(..., min_length=3, max_length=255)
    telefone: Optional[str] = Field(None, description="Telefone no formato (00) 00000-0000")

    # Tipo de pessoa
    tipo_pessoa: TipoPessoa = TipoPessoa.PF

    # Pessoa Física
    cpf: Optional[str] = Field(None, description="CPF (obrigatório para PF)")

    # Pessoa Jurídica
    cnpj: Optional[str] = Field(None, description="CNPJ (obrigatório para PJ)")
    razao_social: Optional[str] = Field(None, max_length=300)
    nome_fantasia: Optional[str] = Field(None, max_length=200)

    @field_validator("cpf")
    @classmethod
    def validate_cpf_field(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        return validar_cpf(v)

    @field_validator("cnpj")
    @classmethod
    def validate_cnpj_field(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        return validar_cnpj(v)

    @field_validator("telefone")
    @classmethod
    def validate_telefone_field(cls, v: Optional[str]) -> Optional[str]:
        return validar_telefone(v)

    @model_validator(mode='after')
    def validate_documento(self):
        """Valida que PF tem CPF e PJ tem CNPJ"""
        if self.tipo_pessoa == TipoPessoa.PF and not self.cpf:
            raise ValueError("CPF é obrigatório para Pessoa Física")
        if self.tipo_pessoa == TipoPessoa.PJ and not self.cnpj:
            raise ValueError("CNPJ é obrigatório para Pessoa Jurídica")
        return self


class SignInRequest(BaseModel):
    """Requisição de login"""
    email: EmailStr
    password: str


class RefreshTokenRequest(BaseModel):
    """Requisição de refresh token"""
    refresh_token: str


class ChangePasswordRequest(BaseModel):
    """Requisição de troca de senha"""
    current_password: str
    new_password: str = Field(..., min_length=6)

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Nova senha deve ter no mínimo 6 caracteres")
        return v


class UpdateProfileRequest(BaseModel):
    """Requisição de atualização de perfil"""
    nome_completo: Optional[str] = Field(None, min_length=3, max_length=255)
    telefone: Optional[str] = None

    # Campos PJ
    razao_social: Optional[str] = Field(None, max_length=300)
    nome_fantasia: Optional[str] = Field(None, max_length=200)

    @field_validator("telefone")
    @classmethod
    def validate_telefone_field(cls, v: Optional[str]) -> Optional[str]:
        return validar_telefone(v)


class ForgotPasswordRequest(BaseModel):
    """Requisição de recuperação de senha"""
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    """Requisição de reset de senha"""
    token: str
    new_password: str = Field(..., min_length=6)


# ========================
# Response Schemas
# ========================

class PerfilResponse(BaseModel):
    """Perfil do usuário"""
    perfil: str
    ativo: bool


class UserResponse(BaseModel):
    """Resposta com dados do usuário"""
    id: str  # UUID do Supabase
    auth_id: str

    # Tipo de pessoa
    tipo_pessoa: str = "PF"

    # Dados comuns
    nome_completo: str
    email: str
    telefone: Optional[str] = None

    # Pessoa Física
    cpf: Optional[str] = None

    # Pessoa Jurídica
    cnpj: Optional[str] = None
    razao_social: Optional[str] = None
    nome_fantasia: Optional[str] = None

    # Status
    is_superadmin: bool = False
    ativo: bool = True
    email_verificado: bool = False
    perfis: List[str] = []

    # Timestamps
    criado_em: Optional[datetime] = None
    atualizado_em: Optional[datetime] = None

    class Config:
        from_attributes = True


class AuthTokens(BaseModel):
    """Tokens de autenticação"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # segundos


class SignUpResponse(BaseModel):
    """Resposta de cadastro"""
    message: str
    user: UserResponse
    tokens: AuthTokens


class SignInResponse(BaseModel):
    """Resposta de login"""
    message: str
    user: UserResponse
    tokens: AuthTokens
    perfis_disponiveis: List[str]


class RefreshResponse(BaseModel):
    """Resposta de refresh token"""
    tokens: AuthTokens


class MeResponse(BaseModel):
    """Resposta do endpoint /me"""
    user: UserResponse
    perfis: List[PerfilResponse]


class MessageResponse(BaseModel):
    """Resposta genérica com mensagem"""
    message: str
    success: bool = True


class PerfisResponse(BaseModel):
    """Resposta com perfis disponíveis"""
    perfis: List[PerfilResponse]
    perfil_ativo: Optional[str] = None
