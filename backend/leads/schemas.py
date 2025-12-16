"""
Leads Schemas - Modelos Pydantic para Leads/Simulacoes
CRM completo com pipeline de vendas e onboarding de clientes
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from decimal import Decimal
from enum import Enum
import re


# ========================
# Enums
# ========================

class StatusLead(str, Enum):
    """Status possiveis de um lead - Pipeline completo"""
    # Fase inicial
    NOVO = "NOVO"                           # Cadastro inicial
    # Vinculacao Energisa
    VINCULANDO = "VINCULANDO"               # Processo Energisa em andamento
    VINCULADO = "VINCULADO"                 # UC vinculada, pronto para simular
    # Simulacao e proposta
    SIMULACAO = "SIMULACAO"                 # Simulacao/proposta gerada
    CONTATO = "CONTATO"                     # Em contato com lead
    NEGOCIACAO = "NEGOCIACAO"               # Negociando termos
    AGUARDANDO_ACEITE = "AGUARDANDO_ACEITE" # Proposta enviada, aguardando aceite
    # Pos-aceite
    ACEITO = "ACEITO"                       # Cliente aceitou, gerando docs
    AGUARDANDO_ASSINATURA = "AGUARDANDO_ASSINATURA"  # Docs gerados, aguardando assinatura
    ASSINADO = "ASSINADO"                   # Contrato assinado
    # Finalizacao
    TROCA_TITULARIDADE = "TROCA_TITULARIDADE"  # Em processo de troca
    CADASTRANDO = "CADASTRANDO"             # Cadastrando como beneficiario
    CONVERTIDO = "CONVERTIDO"               # Processo completo
    PERDIDO = "PERDIDO"                     # Desistiu/perdido


class TipoPessoa(str, Enum):
    """Tipo de pessoa - valores conforme constraint do banco (PF/PJ)"""
    FISICA = "PF"
    JURIDICA = "PJ"


class TitularidadeStatus(str, Enum):
    """Status do processo de troca de titularidade"""
    PENDENTE = "PENDENTE"
    SOLICITADO = "SOLICITADO"
    EM_ANALISE = "EM_ANALISE"
    APROVADO = "APROVADO"
    REJEITADO = "REJEITADO"


class MotivoPerdaCategoria(str, Enum):
    """Categorias de motivo de perda"""
    PRECO = "PRECO"
    LOCALIZACAO = "LOCALIZACAO"
    UC_INCOMPATIVEL = "UC_INCOMPATIVEL"
    DESISTENCIA = "DESISTENCIA"
    CONCORRENCIA = "CONCORRENCIA"
    SEM_INTERESSE = "SEM_INTERESSE"
    OUTROS = "OUTROS"


class OrigemLead(str, Enum):
    """Origem do lead"""
    LANDING_PAGE = "LANDING_PAGE"
    INDICACAO = "INDICACAO"
    GOOGLE_ADS = "GOOGLE_ADS"
    FACEBOOK = "FACEBOOK"
    INSTAGRAM = "INSTAGRAM"
    WHATSAPP = "WHATSAPP"
    TELEFONE = "TELEFONE"
    EVENTO = "EVENTO"
    PARCEIRO = "PARCEIRO"
    OUTROS = "OUTROS"


class TipoDocumentoLead(str, Enum):
    """Tipos de documento do lead"""
    RG = "RG"
    CPF = "CPF"
    CNH = "CNH"
    CNPJ = "CNPJ"
    CONTRATO_SOCIAL = "CONTRATO_SOCIAL"
    COMPROVANTE_RESIDENCIA = "COMPROVANTE_RESIDENCIA"
    CONTA_ENERGIA = "CONTA_ENERGIA"
    PROCURACAO = "PROCURACAO"
    CONTRATO = "CONTRATO"
    OUTROS = "OUTROS"


class TipoVinculoUC(str, Enum):
    """Tipo de vinculo entre lead e UC"""
    GERADORA = "GERADORA"
    BENEFICIARIA = "BENEFICIARIA"
    SIMULACAO = "SIMULACAO"


class StatusProposta(str, Enum):
    """Status da proposta"""
    GERADA = "GERADA"
    ENVIADA = "ENVIADA"
    VISUALIZADA = "VISUALIZADA"
    ACEITA = "ACEITA"
    RECUSADA = "RECUSADA"
    EXPIRADA = "EXPIRADA"


class Concessionaria(str, Enum):
    """Concessionarias suportadas"""
    ENERGISA_MT = "ENERGISA_MT"
    ENERGISA_MS = "ENERGISA_MS"
    ENERGISA_TO = "ENERGISA_TO"
    ENERGISA_AC = "ENERGISA_AC"
    ENERGISA_RO = "ENERGISA_RO"
    ENERGISA_SE = "ENERGISA_SE"
    ENERGISA_PB = "ENERGISA_PB"
    ENERGISA_MG = "ENERGISA_MG"
    ENERGISA_SP = "ENERGISA_SP"
    OUTRA = "OUTRA"


# ========================
# Request Schemas
# ========================

def validar_cpf(cpf: str) -> bool:
    """Valida CPF"""
    cpf_limpo = re.sub(r"\D", "", cpf)
    if len(cpf_limpo) != 11:
        return False
    if cpf_limpo == cpf_limpo[0] * 11:
        return False
    soma = sum(int(cpf_limpo[i]) * (10 - i) for i in range(9))
    resto = soma % 11
    digito1 = 0 if resto < 2 else 11 - resto
    if int(cpf_limpo[9]) != digito1:
        return False
    soma = sum(int(cpf_limpo[i]) * (11 - i) for i in range(10))
    resto = soma % 11
    digito2 = 0 if resto < 2 else 11 - resto
    return int(cpf_limpo[10]) == digito2


def validar_cnpj(cnpj: str) -> bool:
    """Valida CNPJ"""
    cnpj_limpo = re.sub(r"\D", "", cnpj)
    if len(cnpj_limpo) != 14:
        return False
    if cnpj_limpo == cnpj_limpo[0] * 14:
        return False
    # Primeiro digito
    pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    soma = sum(int(cnpj_limpo[i]) * pesos1[i] for i in range(12))
    resto = soma % 11
    digito1 = 0 if resto < 2 else 11 - resto
    if int(cnpj_limpo[12]) != digito1:
        return False
    # Segundo digito
    pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    soma = sum(int(cnpj_limpo[i]) * pesos2[i] for i in range(13))
    resto = soma % 11
    digito2 = 0 if resto < 2 else 11 - resto
    return int(cnpj_limpo[13]) == digito2


class LeadCreateRequest(BaseModel):
    """Criar novo lead - Dados basicos obrigatorios"""
    # Dados obrigatorios
    nome: str = Field(..., min_length=3, max_length=200, description="Nome ou Razao Social")
    cidade: str = Field(..., min_length=2, max_length=100)
    concessionaria: Optional[Concessionaria] = Field(default=Concessionaria.ENERGISA_MT)

    # Dados complementares
    tipo_pessoa: TipoPessoa = Field(default=TipoPessoa.FISICA)
    cpf: Optional[str] = Field(None, min_length=11, max_length=14)
    cnpj: Optional[str] = Field(None, min_length=14, max_length=18)
    email: Optional[str] = None
    telefone: Optional[str] = None
    uf: Optional[str] = Field(None, max_length=2)

    # Origem e tracking
    origem: OrigemLead = Field(default=OrigemLead.LANDING_PAGE)
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    utm_campaign: Optional[str] = None

    @field_validator("cpf")
    @classmethod
    def validar_cpf_field(cls, v):
        if v is None:
            return v
        if not validar_cpf(v):
            raise ValueError("CPF invalido")
        return v

    @field_validator("cnpj")
    @classmethod
    def validar_cnpj_field(cls, v):
        if v is None:
            return v
        if not validar_cnpj(v):
            raise ValueError("CNPJ invalido")
        return v

    @field_validator("uf")
    @classmethod
    def validar_uf_field(cls, v):
        if v is None:
            return v
        # Limpar e converter para uppercase
        v = v.strip().upper()
        if len(v) > 2:
            v = v[:2]  # Truncar para 2 caracteres
        return v

    @field_validator("tipo_pessoa", mode="before")
    @classmethod
    def converter_tipo_pessoa(cls, v):
        """Aceita FISICA/JURIDICA e converte para PF/PJ"""
        if v is None:
            return TipoPessoa.FISICA
        if isinstance(v, TipoPessoa):
            return v
        v_upper = str(v).upper().strip()
        # Mapear valores alternativos
        mapeamento = {
            "FISICA": TipoPessoa.FISICA,
            "JURIDICA": TipoPessoa.JURIDICA,
            "PF": TipoPessoa.FISICA,
            "PJ": TipoPessoa.JURIDICA,
        }
        if v_upper in mapeamento:
            return mapeamento[v_upper]
        return TipoPessoa.FISICA  # Default


class LeadUpdateRequest(BaseModel):
    """Atualizar dados do lead - Campos completos"""
    # Dados basicos
    nome: Optional[str] = Field(None, min_length=3, max_length=200)
    tipo_pessoa: Optional[TipoPessoa] = None
    cpf: Optional[str] = None
    cnpj: Optional[str] = None
    email: Optional[str] = None
    telefone: Optional[str] = None
    telefones_adicionais: Optional[List[str]] = None

    # Documentos PF
    rg: Optional[str] = None
    data_nascimento: Optional[date] = None
    nacionalidade: Optional[str] = None
    nome_mae: Optional[str] = None

    # Endereco completo
    logradouro: Optional[str] = None
    numero: Optional[str] = None
    complemento: Optional[str] = None
    bairro: Optional[str] = None
    cidade: Optional[str] = None
    uf: Optional[str] = Field(None, max_length=2)
    cep: Optional[str] = None

    # Outros
    concessionaria: Optional[Concessionaria] = None
    renda_faturamento: Optional[Decimal] = None

    # Status e atribuicao
    status: Optional[StatusLead] = None
    responsavel_id: Optional[str] = None
    observacoes: Optional[str] = None

    # Titularidade
    titularidade_status: Optional[TitularidadeStatus] = None
    titularidade_protocolo: Optional[str] = None
    titularidade_data_solicitacao: Optional[date] = None
    titularidade_data_conclusao: Optional[date] = None

    @field_validator("tipo_pessoa", mode="before")
    @classmethod
    def converter_tipo_pessoa(cls, v):
        """Aceita FISICA/JURIDICA e converte para PF/PJ"""
        if v is None:
            return None
        if isinstance(v, TipoPessoa):
            return v
        v_upper = str(v).upper().strip()
        mapeamento = {
            "FISICA": TipoPessoa.FISICA,
            "JURIDICA": TipoPessoa.JURIDICA,
            "PF": TipoPessoa.FISICA,
            "PJ": TipoPessoa.JURIDICA,
        }
        return mapeamento.get(v_upper)


class LeadSimulacaoRequest(BaseModel):
    """Dados da simulação do lead"""
    lead_id: int
    valor_fatura_media: Decimal = Field(..., gt=0)
    consumo_medio_kwh: Optional[int] = None
    quantidade_ucs: int = Field(default=1, ge=1)


class LeadContatoRequest(BaseModel):
    """Registrar contato com lead"""
    # lead_id vem do path parameter, não do body
    tipo_contato: str = Field(..., description="whatsapp, telefone, email")
    descricao: str = Field(..., min_length=10)
    proximo_contato: Optional[datetime] = None


class LeadVincularUCRequest(BaseModel):
    """Vincular UC ao lead (apos autenticacao Energisa)"""
    # lead_id vem do path parameter, não do body
    uc_codigo: str = Field(..., description="Codigo UC formato 6/1234567-8")
    tipo: TipoVinculoUC = Field(default=TipoVinculoUC.BENEFICIARIA)
    dados_extras: Optional[Dict[str, Any]] = None


class LeadPropostaRequest(BaseModel):
    """Gerar proposta para o lead"""
    # lead_id vem do path parameter, não do body
    consumo_kwh: Optional[int] = None
    valor_fatura: Optional[Decimal] = None
    quantidade_ucs: int = Field(default=1, ge=1)
    desconto_aplicado: Decimal = Field(default=Decimal("0.30"), ge=0, le=1)
    enviar_proposta: bool = Field(default=False, description="Enviar proposta por email/whatsapp")


class LeadAceitarPropostaRequest(BaseModel):
    """Aceitar proposta e iniciar geracao de documentos"""
    lead_id: int
    proposta_id: int


class LeadMarcarPerdidoRequest(BaseModel):
    """Marcar lead como perdido com motivo categorizado"""
    # lead_id vem do path parameter, não do body
    motivo_categoria: MotivoPerdaCategoria
    observacoes: Optional[str] = None


class LeadConverterRequest(BaseModel):
    """Converter lead em beneficiario (etapa final)"""
    # lead_id vem do path parameter, não do body
    usina_id: int
    uc_id: int = Field(..., description="UC que sera beneficiaria")
    desconto_percentual: Decimal = Field(..., ge=0, le=1)
    percentual_rateio: Optional[Decimal] = Field(default=Decimal("0"), ge=0, le=100)
    criar_contrato: bool = Field(default=True)
    enviar_convite: bool = Field(default=True)


class LeadDocumentoUploadRequest(BaseModel):
    """Upload de documento do lead"""
    # lead_id vem do path parameter, não do body
    tipo: TipoDocumentoLead
    nome_arquivo: str
    descricao: Optional[str] = None


class LeadTitularidadeRequest(BaseModel):
    """Atualizar status de titularidade"""
    # lead_id vem do path parameter, não do body
    status: TitularidadeStatus
    protocolo: Optional[str] = None
    observacoes: Optional[str] = None


# ========================
# Response Schemas
# ========================

class SimulacaoResponse(BaseModel):
    """Resultado da simulação"""
    id: int
    lead_id: int
    valor_fatura_media: Decimal
    consumo_medio_kwh: Optional[int] = None
    quantidade_ucs: int

    # Economia calculada
    desconto_aplicado: Decimal
    economia_mensal: Decimal
    economia_anual: Decimal
    percentual_economia: Decimal

    criado_em: Optional[datetime] = None

    class Config:
        from_attributes = True


class ContatoResponse(BaseModel):
    """Registro de contato"""
    id: int
    lead_id: int
    tipo_contato: str
    descricao: str
    proximo_contato: Optional[datetime] = None
    realizado_por: Optional[str] = None
    criado_em: datetime

    class Config:
        from_attributes = True


class LeadUCResponse(BaseModel):
    """UC vinculada ao lead"""
    id: int
    lead_id: int
    uc_id: int
    tipo: str
    status: str
    vinculado_em: Optional[datetime] = None
    # Dados da UC
    uc_codigo: Optional[str] = None
    uc_endereco: Optional[str] = None
    dados_extras: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True


class LeadDocumentoResponse(BaseModel):
    """Documento do lead"""
    id: int
    lead_id: int
    tipo: str
    nome_arquivo: str
    url_arquivo: Optional[str] = None
    tamanho_bytes: Optional[int] = None
    descricao: Optional[str] = None
    criado_em: datetime

    class Config:
        from_attributes = True


class LeadPropostaResponse(BaseModel):
    """Proposta gerada para o lead"""
    id: int
    lead_id: int
    versao: int
    # Dados de entrada
    consumo_kwh: Optional[int] = None
    valor_fatura: Optional[Decimal] = None
    quantidade_ucs: int
    # Calculos
    tarifa_aplicada: Optional[Decimal] = None
    desconto_aplicado: Decimal
    custo_atual: Optional[Decimal] = None
    custo_com_desconto: Optional[Decimal] = None
    economia_mensal: Optional[Decimal] = None
    economia_anual: Optional[Decimal] = None
    economia_10_anos: Optional[Decimal] = None
    # Status
    status: str
    enviada_em: Optional[datetime] = None
    visualizada_em: Optional[datetime] = None
    aceita_em: Optional[datetime] = None
    recusada_em: Optional[datetime] = None
    motivo_recusa: Optional[str] = None
    # HTML
    html_proposta: Optional[str] = None
    criado_em: datetime

    class Config:
        from_attributes = True


class LeadResponse(BaseModel):
    """Dados completos do lead"""
    id: int
    nome: str
    tipo_pessoa: Optional[str] = "FISICA"

    @field_validator("tipo_pessoa", mode="before")
    @classmethod
    def converter_tipo_pessoa_response(cls, v):
        """Converte PF/PJ para FISICA/JURIDICA na resposta"""
        if v is None:
            return "FISICA"
        v_upper = str(v).upper().strip()
        mapeamento = {"PF": "FISICA", "PJ": "JURIDICA"}
        return mapeamento.get(v_upper, v_upper)

    # Documentos
    cpf: Optional[str] = None
    cnpj: Optional[str] = None
    rg: Optional[str] = None
    data_nascimento: Optional[date] = None
    nacionalidade: Optional[str] = None
    nome_mae: Optional[str] = None

    # Contato
    email: Optional[str] = None
    telefone: Optional[str] = None
    telefones_adicionais: Optional[List[str]] = None

    # Endereco
    logradouro: Optional[str] = None
    numero: Optional[str] = None
    complemento: Optional[str] = None
    bairro: Optional[str] = None
    cidade: Optional[str] = None
    uf: Optional[str] = None
    cep: Optional[str] = None

    # Dados adicionais
    concessionaria: Optional[str] = None
    renda_faturamento: Optional[Decimal] = None

    # Status e origem
    status: str
    origem: str

    # UTM
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    utm_campaign: Optional[str] = None

    # Responsavel
    responsavel_id: Optional[str] = None
    responsavel_nome: Optional[str] = None

    # Observacoes
    observacoes: Optional[str] = None

    # Titularidade
    titularidade_status: Optional[str] = None
    titularidade_protocolo: Optional[str] = None
    titularidade_data_solicitacao: Optional[date] = None
    titularidade_data_conclusao: Optional[date] = None

    # Proposta
    proposta_aceita_em: Optional[datetime] = None
    proposta_dados: Optional[Dict[str, Any]] = None

    # Conversao
    convertido_em: Optional[datetime] = None
    beneficiario_id: Optional[int] = None
    contrato_id: Optional[int] = None
    motivo_perda_categoria: Optional[str] = None

    # Timestamps
    criado_em: Optional[datetime] = None
    atualizado_em: Optional[datetime] = None

    # Relacionamentos
    simulacoes: Optional[List[SimulacaoResponse]] = None
    contatos: Optional[List[ContatoResponse]] = None
    ucs: Optional[List[LeadUCResponse]] = None
    documentos: Optional[List[LeadDocumentoResponse]] = None
    propostas: Optional[List[LeadPropostaResponse]] = None

    class Config:
        from_attributes = True


class LeadResumoResponse(BaseModel):
    """Resumo do lead para listagens"""
    id: int
    nome: str
    telefone: Optional[str] = None
    cidade: Optional[str] = None
    status: str
    origem: str
    criado_em: datetime

    class Config:
        from_attributes = True


class LeadListResponse(BaseModel):
    """Lista de leads com paginação"""
    leads: List[LeadResponse]
    total: int
    page: int
    per_page: int
    total_pages: int


# ========================
# Estatísticas
# ========================

class EstatisticasLeadResponse(BaseModel):
    """Estatísticas de leads"""
    total_leads: int
    leads_novos: int
    leads_em_contato: int
    leads_convertidos: int
    leads_perdidos: int
    taxa_conversao: Decimal
    economia_total_simulada: Decimal

    por_origem: List[Dict[str, Any]]
    por_status: List[Dict[str, Any]]


class FunilLeadResponse(BaseModel):
    """Funil de vendas"""
    etapas: List[Dict[str, Any]]
    total: int
    taxa_conversao_geral: Decimal


# ========================
# Respostas genéricas
# ========================

class MessageResponse(BaseModel):
    """Resposta genérica com mensagem"""
    message: str
    success: bool = True
