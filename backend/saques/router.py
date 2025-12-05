"""
Saques Router - Endpoints da API para Saques/Comissões
"""

from fastapi import APIRouter, Depends, Query
from typing import Optional, List
from datetime import date
from ..core.security import get_current_active_user, require_perfil, CurrentUser
from .schemas import (
    SaqueCreateRequest,
    SaqueAprovarRequest,
    SaqueRejeitarRequest,
    SaquePagarRequest,
    SaqueResponse,
    SaqueListResponse,
    SaldoComissaoResponse,
    ComissaoListResponse,
    EstatisticasSaqueResponse,
    MessageResponse
)
from .service import SaquesService

router = APIRouter()
service = SaquesService()


@router.get("", response_model=SaqueListResponse)
async def listar_saques(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    tipo: Optional[str] = None,
    data_inicio: Optional[date] = None,
    data_fim: Optional[date] = None,
    current_user: CurrentUser = Depends(get_current_active_user)
):
    """
    Lista saques com filtros e paginação.

    Permissões:
    - superadmin/proprietario: todos os saques
    - outros: apenas seus próprios saques
    """
    return await service.listar(
        user_id=current_user.id,
        perfis=current_user.perfis,
        page=page,
        per_page=per_page,
        status=status,
        tipo=tipo,
        data_inicio=data_inicio,
        data_fim=data_fim
    )


@router.get("/meus", response_model=List[SaqueResponse])
async def meus_saques(current_user: CurrentUser = Depends(get_current_active_user)):
    """Lista saques do usuário logado"""
    return await service.meus_saques(user_id=current_user.id)


@router.get("/saldo", response_model=SaldoComissaoResponse)
async def obter_saldo(current_user: CurrentUser = Depends(get_current_active_user)):
    """Obtém saldo de comissões disponível para saque"""
    return await service.obter_saldo(user_id=current_user.id)


@router.get("/comissoes", response_model=ComissaoListResponse)
async def listar_comissoes(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: CurrentUser = Depends(get_current_active_user)
):
    """Lista comissões do usuário"""
    return await service.listar_comissoes(
        user_id=current_user.id,
        page=page,
        per_page=per_page
    )


@router.get("/estatisticas", response_model=EstatisticasSaqueResponse)
async def estatisticas_saques(
    current_user: CurrentUser = Depends(get_current_active_user)
):
    """Retorna estatísticas de saques"""
    return await service.estatisticas(
        user_id=current_user.id,
        perfis=current_user.perfis
    )


@router.get("/pendentes", response_model=SaqueListResponse)
async def listar_saques_pendentes(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: CurrentUser = Depends(require_perfil("superadmin", "proprietario"))
):
    """Lista saques pendentes de aprovação (admin)"""
    return await service.listar(
        user_id=current_user.id,
        perfis=current_user.perfis,
        page=page,
        per_page=per_page,
        status="PENDENTE"
    )


@router.get("/{saque_id}", response_model=SaqueResponse)
async def buscar_saque(
    saque_id: int,
    current_user: CurrentUser = Depends(get_current_active_user)
):
    """Busca saque por ID"""
    return await service.buscar(
        saque_id=saque_id,
        user_id=current_user.id,
        perfis=current_user.perfis
    )


@router.post("", response_model=SaqueResponse, status_code=201)
async def solicitar_saque(
    data: SaqueCreateRequest,
    current_user: CurrentUser = Depends(require_perfil("gestor", "parceiro"))
):
    """
    Solicita novo saque.

    Requer saldo de comissões disponível.
    Valor mínimo: R$ 50,00
    """
    return await service.solicitar(
        data=data.model_dump(),
        user_id=current_user.id
    )


@router.post("/{saque_id}/aprovar", response_model=SaqueResponse)
async def aprovar_saque(
    saque_id: int,
    data: SaqueAprovarRequest,
    current_user: CurrentUser = Depends(require_perfil("superadmin", "proprietario"))
):
    """Aprova saque pendente"""
    return await service.aprovar(
        saque_id=saque_id,
        data=data.model_dump(),
        user_id=current_user.id,
        perfis=current_user.perfis
    )


@router.post("/{saque_id}/rejeitar", response_model=SaqueResponse)
async def rejeitar_saque(
    saque_id: int,
    data: SaqueRejeitarRequest,
    current_user: CurrentUser = Depends(require_perfil("superadmin", "proprietario"))
):
    """Rejeita saque"""
    return await service.rejeitar(
        saque_id=saque_id,
        data=data.model_dump(),
        user_id=current_user.id,
        perfis=current_user.perfis
    )


@router.post("/{saque_id}/pagar", response_model=SaqueResponse)
async def registrar_pagamento(
    saque_id: int,
    data: SaquePagarRequest,
    current_user: CurrentUser = Depends(require_perfil("superadmin", "proprietario"))
):
    """Registra pagamento do saque"""
    return await service.registrar_pagamento(
        saque_id=saque_id,
        data=data.model_dump(),
        user_id=current_user.id,
        perfis=current_user.perfis
    )


@router.post("/{saque_id}/cancelar", response_model=SaqueResponse)
async def cancelar_saque(
    saque_id: int,
    motivo: str = Query(..., min_length=5, description="Motivo do cancelamento"),
    current_user: CurrentUser = Depends(get_current_active_user)
):
    """Cancela saque (próprio ou admin)"""
    return await service.cancelar(
        saque_id=saque_id,
        motivo=motivo,
        user_id=current_user.id,
        perfis=current_user.perfis
    )
