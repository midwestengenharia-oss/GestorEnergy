"""
Leads Router - Endpoints da API para Leads/CRM
Pipeline completo de vendas e onboarding de clientes
"""

from fastapi import APIRouter, Depends, Query
from typing import Optional, List
from ..core.security import get_current_active_user, require_perfil, CurrentUser
from .schemas import (
    # Request schemas
    LeadCreateRequest,
    LeadSimulacaoRequest,
    LeadContatoRequest,
    LeadUpdateRequest,
    LeadConverterRequest,
    LeadVincularUCRequest,
    LeadPropostaRequest,
    LeadAceitarPropostaRequest,
    LeadMarcarPerdidoRequest,
    LeadTitularidadeRequest,
    LeadDocumentoUploadRequest,
    # Response schemas
    LeadResponse,
    LeadListResponse,
    SimulacaoResponse,
    ContatoResponse,
    LeadUCResponse,
    LeadPropostaResponse,
    LeadDocumentoResponse,
    EstatisticasLeadResponse,
    FunilLeadResponse,
    MessageResponse
)
from .service import LeadsService

router = APIRouter()
service = LeadsService()


# ========================
# Endpoints Públicos (Landing Page)
# ========================

@router.post("/captura", response_model=LeadResponse, status_code=201)
async def capturar_lead(data: LeadCreateRequest):
    """
    Captura lead da landing page (público).

    Não requer autenticação.
    """
    return await service.criar(data=data.model_dump())


@router.post("/simular", response_model=SimulacaoResponse)
async def simular_economia(data: LeadSimulacaoRequest):
    """
    Cria simulação de economia para um lead (público).

    Não requer autenticação.
    """
    return await service.simular(data=data.model_dump())


# ========================
# Endpoints Autenticados
# ========================

@router.get("", response_model=LeadListResponse)
async def listar_leads(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    origem: Optional[str] = None,
    responsavel_id: Optional[str] = None,
    busca: Optional[str] = None,
    current_user: CurrentUser = Depends(require_perfil("superadmin", "proprietario", "gestor"))
):
    """Lista leads com filtros e paginação"""
    return await service.listar(
        page=page,
        per_page=per_page,
        status=status,
        origem=origem,
        responsavel_id=responsavel_id,
        busca=busca
    )


@router.get("/estatisticas", response_model=EstatisticasLeadResponse)
async def estatisticas_leads(
    current_user: CurrentUser = Depends(require_perfil("superadmin", "proprietario", "gestor"))
):
    """Retorna estatísticas de leads"""
    return await service.estatisticas()


@router.get("/funil", response_model=FunilLeadResponse)
async def funil_vendas(
    current_user: CurrentUser = Depends(require_perfil("superadmin", "proprietario", "gestor"))
):
    """Retorna funil de vendas"""
    return await service.funil()


@router.get("/{lead_id}", response_model=LeadResponse)
async def buscar_lead(
    lead_id: int,
    current_user: CurrentUser = Depends(require_perfil("superadmin", "proprietario", "gestor"))
):
    """Busca lead por ID"""
    return await service.buscar(lead_id=lead_id)


@router.put("/{lead_id}", response_model=LeadResponse)
async def atualizar_lead(
    lead_id: int,
    data: LeadUpdateRequest,
    current_user: CurrentUser = Depends(require_perfil("superadmin", "proprietario", "gestor"))
):
    """Atualiza dados do lead"""
    return await service.atualizar(
        lead_id=lead_id,
        data=data.model_dump(exclude_unset=True)
    )


@router.post("/{lead_id}/contato", response_model=ContatoResponse)
async def registrar_contato(
    lead_id: int,
    data: LeadContatoRequest,
    current_user: CurrentUser = Depends(require_perfil("superadmin", "proprietario", "gestor"))
):
    """Registra contato com lead"""
    contato_data = data.model_dump()
    contato_data["lead_id"] = lead_id
    return await service.registrar_contato(
        data=contato_data,
        user_id=current_user.id
    )


@router.post("/{lead_id}/atribuir", response_model=LeadResponse)
async def atribuir_responsavel(
    lead_id: int,
    responsavel_id: str = Query(..., description="ID do usuário responsável"),
    current_user: CurrentUser = Depends(require_perfil("superadmin", "proprietario", "gestor"))
):
    """Atribui responsável ao lead"""
    return await service.atribuir_responsavel(
        lead_id=lead_id,
        responsavel_id=responsavel_id
    )


@router.post("/{lead_id}/converter", response_model=dict)
async def converter_lead(
    lead_id: int,
    data: LeadConverterRequest,
    current_user: CurrentUser = Depends(require_perfil("superadmin", "proprietario", "gestor"))
):
    """Converte lead em beneficiário"""
    converter_data = data.model_dump()
    converter_data["lead_id"] = lead_id
    return await service.converter(
        data=converter_data,
        user_id=current_user.id
    )


@router.post("/{lead_id}/perder", response_model=LeadResponse)
async def marcar_lead_perdido(
    lead_id: int,
    motivo: str = Query(..., min_length=5, description="Motivo da perda"),
    current_user: CurrentUser = Depends(require_perfil("superadmin", "proprietario", "gestor"))
):
    """Marca lead como perdido (metodo antigo)"""
    return await service.marcar_perdido(
        lead_id=lead_id,
        motivo=motivo
    )


# ========================
# Novos Endpoints - Pipeline CRM
# ========================

@router.post("/{lead_id}/perder-categorizado", response_model=LeadResponse)
async def marcar_lead_perdido_categorizado(
    lead_id: int,
    data: LeadMarcarPerdidoRequest,
    current_user: CurrentUser = Depends(require_perfil("superadmin", "proprietario", "gestor"))
):
    """
    Marca lead como perdido com categoria.

    Categorias: PRECO, LOCALIZACAO, UC_INCOMPATIVEL, DESISTENCIA, CONCORRENCIA, SEM_INTERESSE, OUTROS
    """
    perda_data = data.model_dump()
    perda_data["lead_id"] = lead_id
    return await service.marcar_perdido_categorizado(
        data=perda_data,
        user_id=current_user.id
    )


# ========================
# UCs do Lead
# ========================

@router.get("/{lead_id}/ucs", response_model=List[LeadUCResponse])
async def listar_ucs_lead(
    lead_id: int,
    current_user: CurrentUser = Depends(require_perfil("superadmin", "proprietario", "gestor"))
):
    """Lista UCs vinculadas ao lead"""
    return await service.listar_ucs(lead_id=lead_id)


@router.post("/{lead_id}/ucs", response_model=LeadUCResponse, status_code=201)
async def vincular_uc_lead(
    lead_id: int,
    data: LeadVincularUCRequest,
    current_user: CurrentUser = Depends(require_perfil("superadmin", "proprietario", "gestor"))
):
    """
    Vincula UC ao lead (apos autenticacao Energisa).

    Formato UC: 6/1234567-8
    """
    uc_data = data.model_dump()
    uc_data["lead_id"] = lead_id
    return await service.vincular_uc(
        data=uc_data,
        user_id=current_user.id
    )


# ========================
# Propostas do Lead
# ========================

@router.get("/{lead_id}/propostas", response_model=List[LeadPropostaResponse])
async def listar_propostas_lead(
    lead_id: int,
    current_user: CurrentUser = Depends(require_perfil("superadmin", "proprietario", "gestor"))
):
    """Lista propostas do lead"""
    return await service.listar_propostas(lead_id=lead_id)


@router.post("/{lead_id}/propostas", response_model=LeadPropostaResponse, status_code=201)
async def gerar_proposta_lead(
    lead_id: int,
    data: LeadPropostaRequest,
    current_user: CurrentUser = Depends(require_perfil("superadmin", "proprietario", "gestor"))
):
    """
    Gera proposta comercial para o lead.

    Informe consumo_kwh OU valor_fatura.
    Desconto padrao: 30%
    """
    proposta_data = data.model_dump()
    proposta_data["lead_id"] = lead_id
    return await service.gerar_proposta(
        data=proposta_data,
        user_id=current_user.id
    )


@router.post("/propostas/{proposta_id}/enviar", response_model=LeadPropostaResponse)
async def enviar_proposta(
    proposta_id: int,
    current_user: CurrentUser = Depends(require_perfil("superadmin", "proprietario", "gestor"))
):
    """Marca proposta como enviada ao cliente"""
    return await service.enviar_proposta(proposta_id=proposta_id)


@router.post("/{lead_id}/propostas/{proposta_id}/aceitar", response_model=dict)
async def aceitar_proposta_lead(
    lead_id: int,
    proposta_id: int,
    current_user: CurrentUser = Depends(require_perfil("superadmin", "proprietario", "gestor"))
):
    """
    Cliente aceita proposta.

    Inicia processo de geracao de documentos (procuracao + contrato).
    """
    return await service.aceitar_proposta(
        data={"lead_id": lead_id, "proposta_id": proposta_id},
        user_id=current_user.id
    )


# ========================
# Titularidade
# ========================

@router.post("/{lead_id}/titularidade", response_model=LeadResponse)
async def atualizar_titularidade_lead(
    lead_id: int,
    data: LeadTitularidadeRequest,
    current_user: CurrentUser = Depends(require_perfil("superadmin", "proprietario", "gestor"))
):
    """
    Atualiza status do processo de troca de titularidade.

    Status: PENDENTE, SOLICITADO, EM_ANALISE, APROVADO, REJEITADO
    """
    tit_data = data.model_dump()
    tit_data["lead_id"] = lead_id
    return await service.atualizar_titularidade(
        data=tit_data,
        user_id=current_user.id
    )


# ========================
# Documentos do Lead
# ========================

@router.get("/{lead_id}/documentos", response_model=List[LeadDocumentoResponse])
async def listar_documentos_lead(
    lead_id: int,
    current_user: CurrentUser = Depends(require_perfil("superadmin", "proprietario", "gestor"))
):
    """Lista documentos do lead"""
    return await service.listar_documentos(lead_id=lead_id)


@router.post("/{lead_id}/documentos", response_model=LeadDocumentoResponse, status_code=201)
async def adicionar_documento_lead(
    lead_id: int,
    data: LeadDocumentoUploadRequest,
    current_user: CurrentUser = Depends(require_perfil("superadmin", "proprietario", "gestor"))
):
    """
    Adiciona documento ao lead.

    Tipos: RG, CPF, CNH, CNPJ, CONTRATO_SOCIAL, COMPROVANTE_RESIDENCIA,
           CONTA_ENERGIA, PROCURACAO, CONTRATO, OUTROS
    """
    doc_data = data.model_dump()
    doc_data["lead_id"] = lead_id
    return await service.adicionar_documento(
        data=doc_data,
        user_id=current_user.id
    )


@router.delete("/documentos/{documento_id}", response_model=MessageResponse)
async def remover_documento_lead(
    documento_id: int,
    current_user: CurrentUser = Depends(require_perfil("superadmin", "proprietario", "gestor"))
):
    """Remove documento do lead"""
    success = await service.remover_documento(documento_id=documento_id)
    return {"message": "Documento removido" if success else "Documento nao encontrado", "success": success}


# ========================
# Conversao Completa
# ========================

@router.post("/{lead_id}/converter-completo", response_model=dict)
async def converter_lead_completo(
    lead_id: int,
    data: LeadConverterRequest,
    current_user: CurrentUser = Depends(require_perfil("superadmin", "proprietario", "gestor"))
):
    """
    Converte lead em beneficiario (fluxo completo).

    - Cria beneficiario com uc_id
    - Opcionalmente cria contrato (RASCUNHO)
    - Opcionalmente envia convite
    """
    converter_data = data.model_dump()
    converter_data["lead_id"] = lead_id
    return await service.converter_completo(
        data=converter_data,
        user_id=current_user.id
    )
