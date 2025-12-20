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
    RASCUNHO = "RASCUNHO"      # Cobrança gerada, aguardando aprovação
    PENDENTE = "PENDENTE"      # Legacy - manter para compatibilidade
    EMITIDA = "EMITIDA"        # Cobrança aprovada, PIX gerado
    PAGA = "PAGA"              # Pagamento confirmado
    VENCIDA = "VENCIDA"        # Passou do vencimento sem pagamento
    CANCELADA = "CANCELADA"    # Cancelada manualmente
    PARCIAL = "PARCIAL"        # Pagamento parcial recebido


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
    Todos os campos são opcionais - apenas os fornecidos serão atualizados.
    """
    # Métricas de energia (kWh)
    consumo_kwh: Optional[int] = Field(None, ge=0, description="Consumo em kWh")
    injetada_kwh: Optional[int] = Field(None, ge=0, description="Energia injetada em kWh")
    compensado_kwh: Optional[int] = Field(None, ge=0, description="Energia compensada em kWh")
    gap_kwh: Optional[int] = Field(None, ge=0, description="Gap (consumo - compensado) em kWh")

    # Tarifas
    tarifa_base: Optional[Decimal] = Field(None, ge=0, description="Tarifa base R$/kWh")
    tarifa_assinatura: Optional[Decimal] = Field(None, ge=0, description="Tarifa com assinatura R$/kWh")

    # Valores de energia
    valor_energia_base: Optional[Decimal] = Field(None, ge=0, description="Valor energia base R$")
    valor_energia_assinatura: Optional[Decimal] = Field(None, ge=0, description="Valor energia assinatura R$")

    # GD I - Taxa mínima e energia excedente
    taxa_minima_kwh: Optional[int] = Field(None, ge=0, description="Taxa mínima em kWh")
    taxa_minima_valor: Optional[Decimal] = Field(None, ge=0, description="Valor da taxa mínima em R$")
    energia_excedente_kwh: Optional[int] = Field(None, ge=0, description="Energia excedente em kWh")
    energia_excedente_valor: Optional[Decimal] = Field(None, ge=0, description="Valor da energia excedente em R$")

    # GD II - Disponibilidade
    disponibilidade_valor: Optional[Decimal] = Field(None, ge=0, description="Valor da disponibilidade GD2 em R$")

    # Extras
    bandeiras_valor: Optional[Decimal] = Field(None, ge=0, description="Valor das bandeiras tarifárias em R$")
    iluminacao_publica_valor: Optional[Decimal] = Field(None, ge=0, description="Valor da iluminação pública em R$")
    servicos_valor: Optional[Decimal] = Field(None, ge=0, description="Valor de serviços adicionais em R$")

    # Vencimento
    vencimento: Optional[date] = Field(None, description="Nova data de vencimento")

    # Observações
    observacoes_internas: Optional[str] = Field(None, max_length=1000, description="Observações internas do gestor")


class ReversaoCamposRequest(BaseModel):
    """Request para reverter campos editados para valores originais"""
    campos: Optional[List[str]] = Field(None, description="Lista de campos a reverter. Se vazio, reverte todos.")


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

    # Modelo GD e tipo de ligação
    tipo_modelo_gd: Optional[str] = None
    tipo_ligacao: Optional[str] = None

    # Métricas de energia (kWh)
    consumo_kwh: Optional[int] = None
    injetada_kwh: Optional[int] = None
    compensado_kwh: Optional[int] = None
    gap_kwh: Optional[int] = None

    # Tarifas
    tarifa_base: Optional[Decimal] = None
    tarifa_assinatura: Optional[Decimal] = None
    fio_b_valor: Optional[Decimal] = None

    # Valores energia
    valor_energia_base: Optional[Decimal] = None
    valor_energia_assinatura: Optional[Decimal] = None

    # GD I - Taxa mínima e energia excedente
    taxa_minima_kwh: Optional[int] = None
    taxa_minima_valor: Optional[Decimal] = None
    energia_excedente_kwh: Optional[int] = None
    energia_excedente_valor: Optional[Decimal] = None

    # GD II - Disponibilidade
    disponibilidade_valor: Optional[Decimal] = None

    # Extras
    bandeiras_valor: Optional[Decimal] = None
    iluminacao_publica_valor: Optional[Decimal] = None
    servicos_valor: Optional[Decimal] = None

    # Totais
    valor_sem_assinatura: Optional[Decimal] = None
    valor_com_assinatura: Optional[Decimal] = None
    economia_mes: Optional[Decimal] = None

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
    observacoes_internas: Optional[str] = None

    # Edição manual
    editado_manualmente: Optional[bool] = None
    valores_originais: Optional[dict] = None  # JSONB com valores originais antes da edição

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
