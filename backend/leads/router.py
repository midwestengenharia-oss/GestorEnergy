"""
Leads Router - Endpoints da API para Leads/Simulações
"""

from fastapi import APIRouter, Depends, Query
from typing import Optional, List
from ..core.security import get_current_active_user, require_perfil, CurrentUser
from .schemas import (
    LeadCreateRequest,
    LeadSimulacaoRequest,
    LeadContatoRequest,
    LeadUpdateRequest,
    LeadConverterRequest,
    LeadResponse,
    LeadListResponse,
    SimulacaoResponse,
    ContatoResponse,
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
    current_user: CurrentUser = Depends(require_perfil("superadmin", "proprietario", "gestor", "parceiro"))
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
    current_user: CurrentUser = Depends(require_perfil("superadmin", "proprietario", "gestor", "parceiro"))
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
    current_user: CurrentUser = Depends(require_perfil("superadmin", "proprietario", "gestor", "parceiro"))
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
    """Marca lead como perdido"""
    return await service.marcar_perdido(
        lead_id=lead_id,
        motivo=motivo
    )
