"""
Faturas Schemas - Modelos Pydantic para Faturas
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date
from decimal import Decimal


# ========================
# Request Schemas
# ========================

class FaturaSincronizarRequest(BaseModel):
    """Sincronizar faturas de uma UC"""
    uc_id: int = Field(..., description="ID da UC")
    session_id: Optional[str] = Field(None, description="ID da sessão Energisa")


class FaturaManualRequest(BaseModel):
    """Criar fatura manualmente"""
    uc_id: int
    mes_referencia: int = Field(..., ge=1, le=12)
    ano_referencia: int = Field(..., ge=2000, le=2100)
    valor_fatura: Decimal = Field(..., ge=0)
    data_vencimento: date
    consumo: Optional[int] = None
    valor_iluminacao_publica: Optional[Decimal] = None


# ========================
# Response Schemas
# ========================

class UCFaturaResponse(BaseModel):
    """UC da fatura"""
    id: int
    uc_formatada: str
    nome_titular: Optional[str] = None
    cidade: Optional[str] = None
    uf: Optional[str] = None

    class Config:
        from_attributes = True


class FaturaResponse(BaseModel):
    """Dados completos da fatura"""
    id: int
    uc_id: int

    # Identificação
    numero_fatura: Optional[int] = None
    mes_referencia: int
    ano_referencia: int
    referencia_formatada: Optional[str] = None  # "01/2024"

    # Valores principais
    valor_fatura: Decimal
    valor_liquido: Optional[Decimal] = None
    consumo: Optional[int] = None
    leitura_atual: Optional[int] = None
    leitura_anterior: Optional[int] = None
    media_consumo: Optional[int] = None
    quantidade_dias: Optional[int] = None

    # Impostos e taxas
    valor_iluminacao_publica: Optional[Decimal] = None
    valor_icms: Optional[Decimal] = None
    bandeira_tarifaria: Optional[str] = None

    # Datas
    data_leitura: Optional[date] = None
    data_vencimento: date
    data_pagamento: Optional[date] = None

    # Status
    indicador_situacao: Optional[int] = None
    indicador_pagamento: Optional[bool] = None
    situacao_pagamento: Optional[str] = None

    # Detalhamento
    servico_distribuicao: Optional[Decimal] = None
    compra_energia: Optional[Decimal] = None
    servico_transmissao: Optional[Decimal] = None
    encargos_setoriais: Optional[Decimal] = None
    impostos_encargos: Optional[Decimal] = None

    # PIX/Boleto
    qr_code_pix: Optional[str] = None
    qr_code_pix_image: Optional[str] = None  # Imagem base64 do QR Code PIX
    codigo_barras: Optional[str] = None

    # PDF
    pdf_path: Optional[str] = None
    pdf_base64: Optional[str] = None
    pdf_baixado_em: Optional[datetime] = None

    # Sincronização
    sincronizado_em: Optional[datetime] = None
    criado_em: Optional[datetime] = None
    atualizado_em: Optional[datetime] = None

    # Relacionamento
    uc: Optional[UCFaturaResponse] = None

    class Config:
        from_attributes = True

    def __init__(self, **data):
        super().__init__(**data)
        if not self.referencia_formatada:
            self.referencia_formatada = f"{self.mes_referencia:02d}/{self.ano_referencia}"


class FaturaListResponse(BaseModel):
    """Lista de faturas com paginação"""
    faturas: List[FaturaResponse]
    total: int
    page: int
    per_page: int
    total_pages: int


class FaturaResumoResponse(BaseModel):
    """Resumo da fatura para listagens"""
    id: int
    mes_referencia: int
    ano_referencia: int
    referencia_formatada: str
    valor_fatura: Decimal
    data_vencimento: date
    situacao_pagamento: Optional[str] = None
    consumo: Optional[int] = None

    class Config:
        from_attributes = True


# ========================
# Histórico GD
# ========================

class HistoricoGDResponse(BaseModel):
    """Histórico de GD de uma UC"""
    id: int
    uc_id: int
    mes_referencia: int
    ano_referencia: int
    referencia_formatada: str

    # Saldos
    saldo_anterior_conv: Optional[int] = None
    injetado_conv: Optional[int] = None
    total_recebido_rede: Optional[int] = None
    consumo_recebido_conv: Optional[int] = None
    consumo_injetado_compensado: Optional[int] = None
    consumo_transferido_conv: Optional[int] = None
    consumo_compensado_conv: Optional[int] = None
    saldo_compensado_anterior: Optional[int] = None

    # Composição
    composicao_energia: Optional[dict] = None
    discriminacao_energia: Optional[dict] = None

    sincronizado_em: Optional[datetime] = None

    class Config:
        from_attributes = True


# ========================
# Filtros
# ========================

class FaturaFiltros(BaseModel):
    """Filtros para busca de faturas"""
    uc_id: Optional[int] = None
    usuario_id: Optional[str] = None  # Filtra faturas das UCs do usuário
    usuario_titular: Optional[bool] = None  # Filtra por titularidade: True=titular, False=gestor
    mes_referencia: Optional[int] = None
    ano_referencia: Optional[int] = None
    situacao_pagamento: Optional[str] = None
    data_vencimento_inicio: Optional[date] = None
    data_vencimento_fim: Optional[date] = None


# ========================
# Estatísticas
# ========================

class EstatisticasFaturaResponse(BaseModel):
    """Estatísticas de faturas"""
    total_faturas: int
    valor_total: Decimal
    valor_medio: Decimal
    consumo_total: int
    consumo_medio: int
    faturas_pagas: int
    faturas_pendentes: int
    faturas_vencidas: int


class ComparativoMensalResponse(BaseModel):
    """Comparativo mensal de consumo/valor"""
    mes_referencia: int
    ano_referencia: int
    referencia_formatada: str
    valor_fatura: Decimal
    consumo: int
    variacao_valor: Optional[Decimal] = None
    variacao_consumo: Optional[int] = None


# ========================
# Respostas genéricas
# ========================

class MessageResponse(BaseModel):
    """Resposta genérica com mensagem"""
    message: str
    success: bool = True
