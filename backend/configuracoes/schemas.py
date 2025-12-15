"""
Schemas Pydantic para Configurações de Impostos
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, Field, validator


class ImpostoBase(BaseModel):
    """Schema base para impostos"""
    pis: Decimal = Field(..., ge=0, le=1, description="Percentual PIS em decimal (ex: 0.012102)")
    cofins: Decimal = Field(..., ge=0, le=1, description="Percentual COFINS em decimal (ex: 0.055743)")
    icms: Decimal = Field(..., ge=0, le=1, description="Percentual ICMS em decimal (ex: 0.17)")
    vigencia_inicio: date = Field(..., description="Data de início da vigência")
    observacao: Optional[str] = Field(None, max_length=500)

    @validator('pis', 'cofins', 'icms', pre=True)
    def convert_to_decimal(cls, v):
        if v is not None:
            return Decimal(str(v))
        return v


class ImpostoCreate(ImpostoBase):
    """Schema para criação de imposto"""
    pass


class ImpostoUpdate(BaseModel):
    """Schema para atualização de imposto"""
    pis: Optional[Decimal] = Field(None, ge=0, le=1)
    cofins: Optional[Decimal] = Field(None, ge=0, le=1)
    icms: Optional[Decimal] = Field(None, ge=0, le=1)
    vigencia_inicio: Optional[date] = None
    vigencia_fim: Optional[date] = None
    observacao: Optional[str] = Field(None, max_length=500)


class ImpostoResponse(ImpostoBase):
    """Schema de resposta para imposto"""
    id: int
    vigencia_fim: Optional[date] = None
    criado_por: Optional[str] = None
    criado_em: datetime

    class Config:
        from_attributes = True


class ImpostoVigente(BaseModel):
    """Schema para imposto vigente (usado em cálculos)"""
    id: int
    pis: Decimal
    cofins: Decimal
    icms: Decimal
    pis_cofins: Decimal  # PIS + COFINS combinados
    vigencia_inicio: date

    class Config:
        from_attributes = True
