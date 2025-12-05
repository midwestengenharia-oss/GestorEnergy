"""
Contratos Router - Endpoints da API para Contratos
"""

from fastapi import APIRouter, Depends, Query, Request
from typing import Optional, List
from ..core.security import get_current_active_user, require_perfil, CurrentUser
from .schemas import (
    ContratoCreateRequest,
    ContratoUpdateRequest,
    ContratoAssinarRequest,
    ContratoRescindirRequest,
    ContratoResponse,
    ContratoListResponse,
    EstatisticasContratoResponse,
    MessageResponse
)
from .service import ContratosService

router = APIRouter()
service = ContratosService()


@router.get("", response_model=ContratoListResponse)
async def listar_contratos(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    usina_id: Optional[int] = None,
    beneficiario_id: Optional[int] = None,
    status: Optional[str] = None,
    tipo: Optional[str] = None,
    current_user: CurrentUser = Depends(get_current_active_user)
):
    """
    Lista contratos com filtros e paginação.

    Permissões:
    - superadmin/proprietario: todos os contratos
    - gestor: contratos das usinas que gerencia
    - beneficiario: seus próprios contratos
    - parceiro: contratos onde é parceiro
    """
    return await service.listar(
        user_id=current_user.id,
        perfis=current_user.perfis,
        page=page,
        per_page=per_page,
        usina_id=usina_id,
        beneficiario_id=beneficiario_id,
        status=status,
        tipo=tipo
    )


@router.get("/meus", response_model=List[ContratoResponse])
async def meus_contratos(current_user: CurrentUser = Depends(get_current_active_user)):
    """Lista contratos do usuário logado"""
    return await service.meus_contratos(user_id=current_user.id)


@router.get("/estatisticas", response_model=EstatisticasContratoResponse)
async def estatisticas_contratos(
    usina_id: Optional[int] = None,
    current_user: CurrentUser = Depends(require_perfil("superadmin", "proprietario", "gestor"))
):
    """Retorna estatísticas de contratos"""
    return await service.estatisticas(
        user_id=current_user.id,
        perfis=current_user.perfis,
        usina_id=usina_id
    )


@router.get("/usina/{usina_id}", response_model=ContratoListResponse)
async def contratos_por_usina(
    usina_id: int,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    current_user: CurrentUser = Depends(require_perfil("superadmin", "proprietario", "gestor"))
):
    """Lista contratos de uma usina específica"""
    return await service.listar(
        user_id=current_user.id,
        perfis=current_user.perfis,
        page=page,
        per_page=per_page,
        usina_id=usina_id,
        status=status
    )


@router.get("/{contrato_id}", response_model=ContratoResponse)
async def buscar_contrato(
    contrato_id: int,
    current_user: CurrentUser = Depends(get_current_active_user)
):
    """Busca contrato por ID"""
    return await service.buscar(
        contrato_id=contrato_id,
        user_id=current_user.id,
        perfis=current_user.perfis
    )


@router.post("", response_model=ContratoResponse, status_code=201)
async def criar_contrato(
    data: ContratoCreateRequest,
    current_user: CurrentUser = Depends(require_perfil("superadmin", "proprietario", "gestor"))
):
    """Cria novo contrato"""
    return await service.criar(
        data=data.model_dump(),
        user_id=current_user.id
    )


@router.put("/{contrato_id}", response_model=ContratoResponse)
async def atualizar_contrato(
    contrato_id: int,
    data: ContratoUpdateRequest,
    current_user: CurrentUser = Depends(require_perfil("superadmin", "proprietario", "gestor"))
):
    """Atualiza dados do contrato (apenas rascunho)"""
    return await service.atualizar(
        contrato_id=contrato_id,
        data=data.model_dump(exclude_unset=True),
        user_id=current_user.id,
        perfis=current_user.perfis
    )


@router.post("/{contrato_id}/enviar-assinatura", response_model=ContratoResponse)
async def enviar_para_assinatura(
    contrato_id: int,
    current_user: CurrentUser = Depends(require_perfil("superadmin", "proprietario", "gestor"))
):
    """Envia contrato para assinatura do beneficiário"""
    return await service.enviar_para_assinatura(
        contrato_id=contrato_id,
        user_id=current_user.id,
        perfis=current_user.perfis
    )


@router.post("/{contrato_id}/assinar", response_model=ContratoResponse)
async def assinar_contrato(
    contrato_id: int,
    data: ContratoAssinarRequest,
    request: Request,
    current_user: CurrentUser = Depends(get_current_active_user)
):
    """Assina contrato (beneficiário)"""
    assinatura_data = data.model_dump()
    assinatura_data["ip_assinatura"] = request.client.host if request.client else None

    return await service.assinar(
        contrato_id=contrato_id,
        data=assinatura_data,
        user_id=current_user.id,
        perfis=current_user.perfis
    )


@router.post("/{contrato_id}/rescindir", response_model=ContratoResponse)
async def rescindir_contrato(
    contrato_id: int,
    data: ContratoRescindirRequest,
    current_user: CurrentUser = Depends(require_perfil("superadmin", "proprietario", "gestor"))
):
    """Rescinde contrato"""
    return await service.rescindir(
        contrato_id=contrato_id,
        data=data.model_dump(),
        user_id=current_user.id,
        perfis=current_user.perfis
    )


@router.post("/{contrato_id}/suspender", response_model=ContratoResponse)
async def suspender_contrato(
    contrato_id: int,
    motivo: str = Query(..., min_length=5, description="Motivo da suspensão"),
    current_user: CurrentUser = Depends(require_perfil("superadmin", "proprietario", "gestor"))
):
    """Suspende contrato temporariamente"""
    return await service.suspender(
        contrato_id=contrato_id,
        motivo=motivo,
        user_id=current_user.id,
        perfis=current_user.perfis
    )


@router.post("/{contrato_id}/reativar", response_model=ContratoResponse)
async def reativar_contrato(
    contrato_id: int,
    current_user: CurrentUser = Depends(require_perfil("superadmin", "proprietario", "gestor"))
):
    """Reativa contrato suspenso"""
    return await service.reativar(
        contrato_id=contrato_id,
        user_id=current_user.id,
        perfis=current_user.perfis
    )
