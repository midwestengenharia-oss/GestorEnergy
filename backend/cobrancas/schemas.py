"""
Cobranças Schemas - Modelos Pydantic para Cobranças
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date
from decimal import Decimal
from enum import Enum


class StatusCobranca(str, Enum):
    """Status possíveis de uma cobrança"""
    PENDENTE = "PENDENTE"
    EMITIDA = "EMITIDA"
    PAGA = "PAGA"
    VENCIDA = "VENCIDA"
    CANCELADA = "CANCELADA"
    PARCIAL = "PARCIAL"


class TipoCobranca(str, Enum):
    """Tipos de cobrança"""
    BENEFICIO_GD = "BENEFICIO_GD"
    ADESAO = "ADESAO"
    MULTA = "MULTA"
    OUTROS = "OUTROS"


# ========================
# Request Schemas
# ========================

class CobrancaCreateRequest(BaseModel):
    """Criar nova cobrança"""
    beneficiario_id: int = Field(..., description="ID do beneficiário")
    fatura_id: Optional[int] = Field(None, description="ID da fatura de referência")
    tipo: TipoCobranca = Field(default=TipoCobranca.BENEFICIO_GD)
    valor_energia_injetada: Decimal = Field(..., ge=0, description="Valor da energia injetada")
    desconto_percentual: Decimal = Field(..., ge=0, le=1, description="Desconto aplicado (0.30 = 30%)")
    valor_desconto: Optional[Decimal] = Field(None, ge=0)
    valor_final: Optional[Decimal] = Field(None, ge=0)
    mes_referencia: int = Field(..., ge=1, le=12)
    ano_referencia: int = Field(..., ge=2000, le=2100)
    data_vencimento: date
    observacoes: Optional[str] = None


class CobrancaUpdateRequest(BaseModel):
    """Atualizar cobrança"""
    valor_final: Optional[Decimal] = Field(None, ge=0)
    data_vencimento: Optional[date] = None
    status: Optional[StatusCobranca] = None
    observacoes: Optional[str] = None


class CobrancaPagamentoRequest(BaseModel):
    """Registrar pagamento de cobrança"""
    valor_pago: Decimal = Field(..., ge=0)
    data_pagamento: date
    forma_pagamento: Optional[str] = None
    comprovante: Optional[str] = None
    observacoes: Optional[str] = None


class CobrancaGerarLoteRequest(BaseModel):
    """Gerar cobranças em lote para uma usina"""
    usina_id: int
    mes_referencia: int = Field(..., ge=1, le=12)
    ano_referencia: int = Field(..., ge=2000, le=2100)
    data_vencimento: date
    sobrescrever_existentes: bool = False


class CamposEditaveisCobranca(BaseModel):
    """
    Campos que podem ser editados manualmente em uma cobrança.
    Usado para ajustes manuais pelo gestor.
    """
    # Valores monetários editáveis
    taxa_minima_valor: Optional[Decimal] = Field(None, ge=0, description="Valor da taxa mínima em R$")
    energia_excedente_valor: Optional[Decimal] = Field(None, ge=0, description="Valor da energia excedente em R$")
    disponibilidade_valor: Optional[Decimal] = Field(None, ge=0, description="Valor da disponibilidade GD2 em R$")
    bandeiras_valor: Optional[Decimal] = Field(None, ge=0, description="Valor das bandeiras tarifárias em R$")
    iluminacao_publica_valor: Optional[Decimal] = Field(None, ge=0, description="Valor da iluminação pública em R$")
    servicos_valor: Optional[Decimal] = Field(None, ge=0, description="Valor de serviços adicionais em R$")

    # Vencimento
    vencimento: Optional[date] = Field(None, description="Nova data de vencimento")

    # Observações
    observacoes_internas: Optional[str] = Field(None, max_length=1000, description="Observações internas do gestor")


# ========================
# Response Schemas
# ========================

class BeneficiarioCobrancaResponse(BaseModel):
    """Beneficiário resumido para cobrança"""
    id: int
    nome: Optional[str] = None
    cpf: str
    email: Optional[str] = None
    telefone: Optional[str] = None

    class Config:
        from_attributes = True


class FaturaCobrancaResponse(BaseModel):
    """Fatura resumida para cobrança"""
    id: int
    mes_referencia: int
    ano_referencia: int
    valor_fatura: Decimal
    consumo: Optional[int] = None

    class Config:
        from_attributes = True


class CobrancaResponse(BaseModel):
    """Dados completos da cobrança"""
    id: int
    beneficiario_id: int
    fatura_id: Optional[int] = None
    usina_id: Optional[int] = None

    # Tipo e referência
    tipo: Optional[str] = None
    mes: int  # Coluna real do banco
    ano: int  # Coluna real do banco
    referencia_formatada: Optional[str] = None

    # Valores - campos legados opcionais
    valor_energia_injetada: Optional[Decimal] = None
    desconto_percentual: Optional[Decimal] = None
    valor_desconto: Optional[Decimal] = None

    # Mapeia 'valor_total' do banco para 'valor_final' no schema
    valor_final: Optional[Decimal] = Field(None, alias="valor_total")

    # Pagamento
    valor_pago: Optional[Decimal] = None
    data_pagamento: Optional[date] = None
    forma_pagamento: Optional[str] = None

    # Status e datas
    status: str

    # Mapeia 'vencimento' do banco para 'data_vencimento' no schema
    data_vencimento: Optional[date] = Field(None, alias="vencimento")
    data_emissao: Optional[date] = None

    # PIX/Boleto
    qr_code_pix: Optional[str] = None
    codigo_barras: Optional[str] = None
    link_boleto: Optional[str] = None

    # Observações
    observacoes: Optional[str] = None

    # Timestamps
    criado_em: Optional[datetime] = None
    atualizado_em: Optional[datetime] = None

    # Relacionamentos
    beneficiario: Optional[BeneficiarioCobrancaResponse] = None
    fatura: Optional[FaturaCobrancaResponse] = None

    class Config:
        from_attributes = True
        populate_by_name = True  # Permite popular tanto pelo nome do campo quanto pelo alias

    def __init__(self, **data):
        super().__init__(**data)
        if not self.referencia_formatada:
            self.referencia_formatada = f"{self.mes:02d}/{self.ano}"


class CobrancaResumoResponse(BaseModel):
    """Resumo da cobrança para listagens"""
    id: int
    beneficiario_nome: Optional[str] = None
    mes: int  # Coluna real do banco
    ano: int  # Coluna real do banco
    referencia_formatada: str
    valor_final: Decimal
    status: str
    data_vencimento: date

    class Config:
        from_attributes = True


class CobrancaListResponse(BaseModel):
    """Lista de cobranças com paginação"""
    cobrancas: List[CobrancaResponse]
    total: int
    page: int
    per_page: int
    total_pages: int


# ========================
# Estatísticas
# ========================

class EstatisticasCobrancaResponse(BaseModel):
    """Estatísticas de cobranças"""
    total_cobrancas: int
    valor_total: Decimal
    valor_pago: Decimal
    valor_pendente: Decimal
    cobrancas_pagas: int
    cobrancas_pendentes: int
    cobrancas_vencidas: int
    taxa_inadimplencia: Decimal


class ResumoMensalCobrancaResponse(BaseModel):
    """Resumo mensal de cobranças"""
    mes_referencia: int
    ano_referencia: int
    referencia_formatada: str
    total_cobrancas: int
    valor_total: Decimal
    valor_pago: Decimal
    valor_pendente: Decimal


# ========================
# Relatórios
# ========================

class RelatorioCobrancasRequest(BaseModel):
    """Parâmetros para relatório de cobranças"""
    usina_id: Optional[int] = None
    beneficiario_id: Optional[int] = None
    mes_referencia: Optional[int] = None
    ano_referencia: Optional[int] = None
    status: Optional[StatusCobranca] = None
    data_inicio: Optional[date] = None
    data_fim: Optional[date] = None
    formato: str = Field(default="json", pattern="^(json|csv|pdf)$")


class MessageResponse(BaseModel):
    """Resposta genérica com mensagem"""
    message: str
    success: bool = True
