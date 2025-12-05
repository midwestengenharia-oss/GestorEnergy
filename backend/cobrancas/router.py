"""
Cobranças Router - Endpoints da API para Cobranças
"""

from fastapi import APIRouter, Depends, Query
from typing import Optional, List
from ..core.security import get_current_user, get_current_active_user, require_perfil, CurrentUser
from .schemas import (
    CobrancaCreateRequest,
    CobrancaUpdateRequest,
    CobrancaPagamentoRequest,
    CobrancaGerarLoteRequest,
    CobrancaResponse,
    CobrancaListResponse,
    EstatisticasCobrancaResponse,
    MessageResponse
)
from .service import CobrancasService

router = APIRouter()
service = CobrancasService()


@router.get("", response_model=CobrancaListResponse)
async def listar_cobrancas(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    usina_id: Optional[int] = None,
    beneficiario_id: Optional[int] = None,
    status: Optional[str] = None,
    mes_referencia: Optional[int] = Query(None, ge=1, le=12),
    ano_referencia: Optional[int] = Query(None, ge=2000, le=2100),
    current_user: CurrentUser = Depends(get_current_active_user)
):
    """
    Lista cobranças com filtros e paginação.

    Permissões:
    - superadmin/proprietario: todas as cobranças
    - gestor: cobranças das usinas que gerencia
    - beneficiario: apenas suas cobranças
    """
    return await service.listar(
        user_id=current_user.id,
        perfis=current_user.perfis,
        page=page,
        per_page=per_page,
        usina_id=usina_id,
        beneficiario_id=beneficiario_id,
        status=status,
        mes_referencia=mes_referencia,
        ano_referencia=ano_referencia
    )


@router.get("/minhas", response_model=List[CobrancaResponse])
async def minhas_cobrancas(current_user: CurrentUser = Depends(get_current_active_user)):
    """Lista cobranças do usuário logado (como beneficiário)"""
    return await service.minhas_cobrancas(user_id=current_user.id)


@router.get("/estatisticas", response_model=EstatisticasCobrancaResponse)
async def estatisticas_cobrancas(
    usina_id: Optional[int] = None,
    ano: Optional[int] = None,
    current_user: CurrentUser = Depends(require_perfil("superadmin", "proprietario", "gestor"))
):
    """Retorna estatísticas de cobranças"""
    return await service.estatisticas(
        user_id=current_user.id,
        perfis=current_user.perfis,
        usina_id=usina_id,
        ano=ano
    )


@router.get("/usina/{usina_id}", response_model=CobrancaListResponse)
async def cobrancas_por_usina(
    usina_id: int,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    mes_referencia: Optional[int] = Query(None, ge=1, le=12),
    ano_referencia: Optional[int] = Query(None, ge=2000, le=2100),
    current_user: CurrentUser = Depends(require_perfil("superadmin", "proprietario", "gestor"))
):
    """Lista cobranças de uma usina específica"""
    return await service.listar(
        user_id=current_user.id,
        perfis=current_user.perfis,
        page=page,
        per_page=per_page,
        usina_id=usina_id,
        status=status,
        mes_referencia=mes_referencia,
        ano_referencia=ano_referencia
    )


@router.get("/beneficiario/{beneficiario_id}", response_model=CobrancaListResponse)
async def cobrancas_por_beneficiario(
    beneficiario_id: int,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: CurrentUser = Depends(get_current_active_user)
):
    """Lista cobranças de um beneficiário específico"""
    return await service.listar(
        user_id=current_user.id,
        perfis=current_user.perfis,
        page=page,
        per_page=per_page,
        beneficiario_id=beneficiario_id
    )


@router.get("/{cobranca_id}", response_model=CobrancaResponse)
async def buscar_cobranca(
    cobranca_id: int,
    current_user: CurrentUser = Depends(get_current_active_user)
):
    """Busca cobrança por ID"""
    return await service.buscar(
        cobranca_id=cobranca_id,
        user_id=current_user.id,
        perfis=current_user.perfis
    )


@router.post("", response_model=CobrancaResponse, status_code=201)
async def criar_cobranca(
    data: CobrancaCreateRequest,
    current_user: CurrentUser = Depends(require_perfil("superadmin", "proprietario", "gestor"))
):
    """Cria nova cobrança"""
    return await service.criar(
        data=data.model_dump(),
        user_id=current_user.id
    )


@router.post("/lote", response_model=dict)
async def gerar_cobrancas_lote(
    data: CobrancaGerarLoteRequest,
    current_user: CurrentUser = Depends(require_perfil("superadmin", "proprietario", "gestor"))
):
    """
    Gera cobranças em lote para todos os beneficiários ativos de uma usina.

    Retorna quantidade de cobranças criadas e eventuais erros.
    """
    return await service.gerar_lote(
        data=data.model_dump(),
        user_id=current_user.id,
        perfis=current_user.perfis
    )


@router.put("/{cobranca_id}", response_model=CobrancaResponse)
async def atualizar_cobranca(
    cobranca_id: int,
    data: CobrancaUpdateRequest,
    current_user: CurrentUser = Depends(require_perfil("superadmin", "proprietario", "gestor"))
):
    """Atualiza dados da cobrança"""
    return await service.atualizar(
        cobranca_id=cobranca_id,
        data=data.model_dump(exclude_unset=True),
        user_id=current_user.id,
        perfis=current_user.perfis
    )


@router.post("/{cobranca_id}/pagamento", response_model=CobrancaResponse)
async def registrar_pagamento(
    cobranca_id: int,
    data: CobrancaPagamentoRequest,
    current_user: CurrentUser = Depends(require_perfil("superadmin", "proprietario", "gestor"))
):
    """Registra pagamento de uma cobrança"""
    return await service.registrar_pagamento(
        cobranca_id=cobranca_id,
        data=data.model_dump(),
        user_id=current_user.id,
        perfis=current_user.perfis
    )


@router.post("/{cobranca_id}/cancelar", response_model=CobrancaResponse)
async def cancelar_cobranca(
    cobranca_id: int,
    motivo: str = Query(..., min_length=5, description="Motivo do cancelamento"),
    current_user: CurrentUser = Depends(require_perfil("superadmin", "proprietario", "gestor"))
):
    """Cancela uma cobrança pendente"""
    return await service.cancelar(
        cobranca_id=cobranca_id,
        motivo=motivo,
        user_id=current_user.id,
        perfis=current_user.perfis
    )
