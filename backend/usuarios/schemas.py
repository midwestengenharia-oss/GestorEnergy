"""
Usuarios Schemas - Modelos Pydantic para gestão de usuários
"""

from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, List
from datetime import datetime
from enum import Enum
import re


class PerfilTipo(str, Enum):
    """Tipos de perfil do usuário"""
    SUPERADMIN = "superadmin"
    PROPRIETARIO = "proprietario"
    GESTOR = "gestor"
    BENEFICIARIO = "beneficiario"
    USUARIO = "usuario"
    PARCEIRO = "parceiro"


class TipoPessoa(str, Enum):
    """Tipo de pessoa"""
    PF = "PF"  # Pessoa Física
    PJ = "PJ"  # Pessoa Jurídica


# ========================
# Request Schemas
# ========================

def validar_cpf(cpf: str) -> str:
    """Valida e formata CPF"""
    cpf = re.sub(r'\D', '', cpf)
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


def validar_cnpj(cnpj: str) -> str:
    """Valida e formata CNPJ"""
    cnpj = re.sub(r'\D', '', cnpj)
    if len(cnpj) != 14:
        raise ValueError("CNPJ deve ter 14 dígitos")
    if cnpj == cnpj[0] * 14:
        raise ValueError("CNPJ inválido")

    # Calcula primeiro dígito verificador
    pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    soma = sum(int(cnpj[i]) * pesos1[i] for i in range(12))
    resto = soma % 11
    d1 = 0 if resto < 2 else 11 - resto

    # Calcula segundo dígito verificador
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


class UsuarioCreateRequest(BaseModel):
    """Criar novo usuário (admin)"""
    tipo_pessoa: TipoPessoa = TipoPessoa.PF
    nome_completo: str = Field(..., min_length=3, max_length=200)
    email: EmailStr

    # Pessoa Física
    cpf: Optional[str] = Field(None, description="CPF (obrigatório para PF)")

    # Pessoa Jurídica
    cnpj: Optional[str] = Field(None, description="CNPJ (obrigatório para PJ)")
    razao_social: Optional[str] = Field(None, max_length=300)
    nome_fantasia: Optional[str] = Field(None, max_length=200)

    telefone: Optional[str] = None
    is_superadmin: bool = False
    perfis: List[PerfilTipo] = [PerfilTipo.USUARIO]

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

    def model_post_init(self, __context) -> None:
        """Valida que PF tem CPF e PJ tem CNPJ"""
        if self.tipo_pessoa == TipoPessoa.PF and not self.cpf:
            raise ValueError("CPF é obrigatório para Pessoa Física")
        if self.tipo_pessoa == TipoPessoa.PJ and not self.cnpj:
            raise ValueError("CNPJ é obrigatório para Pessoa Jurídica")


class UsuarioUpdateRequest(BaseModel):
    """Atualizar usuário"""
    nome_completo: Optional[str] = Field(None, min_length=3, max_length=200)
    telefone: Optional[str] = None
    avatar_url: Optional[str] = None
    preferencias: Optional[dict] = None
    ativo: Optional[bool] = None

    # Campos PJ (podem ser atualizados)
    razao_social: Optional[str] = Field(None, max_length=300)
    nome_fantasia: Optional[str] = Field(None, max_length=200)

    @field_validator("telefone")
    @classmethod
    def validate_telefone_field(cls, v: Optional[str]) -> Optional[str]:
        return validar_telefone(v)


class PerfilUpdateRequest(BaseModel):
    """Atualizar perfis do usuário"""
    perfis: List[PerfilTipo]


class AtribuirPerfilRequest(BaseModel):
    """Atribuir perfil a usuário"""
    perfil: PerfilTipo
    dados_perfil: Optional[dict] = None


# ========================
# Response Schemas
# ========================

class PerfilUsuarioResponse(BaseModel):
    """Perfil do usuário"""
    id: int
    perfil: str
    ativo: bool
    dados_perfil: Optional[dict] = None
    criado_em: Optional[datetime] = None

    class Config:
        from_attributes = True


class UsuarioResponse(BaseModel):
    """Dados completos do usuário"""
    id: str  # UUID
    auth_id: Optional[str] = None

    # Tipo de pessoa
    tipo_pessoa: str = "PF"

    # Dados comuns
    nome_completo: str
    email: str
    telefone: Optional[str] = None
    avatar_url: Optional[str] = None

    # Pessoa Física
    cpf: Optional[str] = None

    # Pessoa Jurídica
    cnpj: Optional[str] = None
    razao_social: Optional[str] = None
    nome_fantasia: Optional[str] = None

    # Status e permissões
    is_superadmin: bool = False
    ativo: bool = True
    email_verificado: bool = False
    perfis: List[str] = []

    # Timestamps
    criado_em: Optional[datetime] = None
    atualizado_em: Optional[datetime] = None
    ultimo_acesso: Optional[datetime] = None

    class Config:
        from_attributes = True


class UsuarioListResponse(BaseModel):
    """Lista de usuários com paginação"""
    usuarios: List[UsuarioResponse]
    total: int
    page: int
    per_page: int
    total_pages: int


class UsuarioResumoResponse(BaseModel):
    """Resumo do usuário para listagens"""
    id: str
    nome_completo: str
    email: str
    ativo: bool
    perfis: List[str] = []

    class Config:
        from_attributes = True


# ========================
# Filtros
# ========================

class UsuarioFiltros(BaseModel):
    """Filtros para busca de usuários"""
    nome: Optional[str] = None
    email: Optional[str] = None
    cpf: Optional[str] = None
    cnpj: Optional[str] = None
    tipo_pessoa: Optional[TipoPessoa] = None
    perfil: Optional[PerfilTipo] = None
    ativo: Optional[bool] = None
    is_superadmin: Optional[bool] = None


# ========================
# Respostas genéricas
# ========================

class MessageResponse(BaseModel):
    """Resposta genérica com mensagem"""
    message: str
    success: bool = True
