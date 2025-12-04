"""
Faturas Router - Endpoints de Faturas
"""

from fastapi import APIRouter, Depends, Query, status
from typing import Annotated, Optional
from datetime import date
import math

from backend.faturas.schemas import (
    FaturaManualRequest,
    FaturaResponse,
    FaturaListResponse,
    FaturaFiltros,
    HistoricoGDResponse,
    EstatisticasFaturaResponse,
    ComparativoMensalResponse,
    MessageResponse,
)
from backend.faturas.service import faturas_service
from backend.core.security import (
    CurrentUser,
    get_current_active_user,
    require_perfil,
)

router = APIRouter()


@router.get(
    "",
    response_model=FaturaListResponse,
    summary="Listar faturas",
    description="Lista faturas com filtros e paginação"
)
async def listar_faturas(
    current_user: Annotated[CurrentUser, Depends(get_current_active_user)],
    uc_id: Optional[int] = Query(None, description="Filtrar por UC"),
    mes_referencia: Optional[int] = Query(None, ge=1, le=12, description="Mês de referência"),
    ano_referencia: Optional[int] = Query(None, ge=2000, le=2100, description="Ano de referência"),
    situacao_pagamento: Optional[str] = Query(None, description="Situação do pagamento"),
    data_vencimento_inicio: Optional[date] = Query(None, description="Vencimento a partir de"),
    data_vencimento_fim: Optional[date] = Query(None, description="Vencimento até"),
    page: int = Query(1, ge=1, description="Página"),
    per_page: int = Query(20, ge=1, le=100, description="Itens por página"),
):
    """
    Lista faturas da plataforma.

    - Superadmins e gestores veem todas
    - Usuários comuns veem apenas faturas de suas UCs
    """
    # Usuários comuns só veem faturas de suas próprias UCs
    usuario_id = None
    if not current_user.is_superadmin and "gestor" not in current_user.perfis:
        usuario_id = str(current_user.id)

    filtros = FaturaFiltros(
        uc_id=uc_id,
        usuario_id=usuario_id,
        mes_referencia=mes_referencia,
        ano_referencia=ano_referencia,
        situacao_pagamento=situacao_pagamento,
        data_vencimento_inicio=data_vencimento_inicio,
        data_vencimento_fim=data_vencimento_fim
    )

    faturas, total = await faturas_service.listar(
        filtros=filtros,
        page=page,
        per_page=per_page
    )

    total_pages = math.ceil(total / per_page) if total > 0 else 1

    return FaturaListResponse(
        faturas=faturas,
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages
    )


@router.get(
    "/uc/{uc_id}",
    response_model=FaturaListResponse,
    summary="Faturas por UC",
    description="Lista faturas de uma UC específica"
)
async def listar_faturas_uc(
    uc_id: int,
    current_user: Annotated[CurrentUser, Depends(get_current_active_user)],
    page: int = Query(1, ge=1),
    per_page: int = Query(13, ge=1, le=100),
):
    """
    Lista as faturas de uma UC específica.

    Por padrão retorna as últimas 13 faturas (último ano).
    """
    faturas, total = await faturas_service.listar_por_uc(
        uc_id=uc_id,
        page=page,
        per_page=per_page
    )

    total_pages = math.ceil(total / per_page) if total > 0 else 1

    return FaturaListResponse(
        faturas=faturas,
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages
    )


@router.get(
    "/uc/{uc_id}/estatisticas",
    response_model=EstatisticasFaturaResponse,
    summary="Estatísticas de faturas",
    description="Obtém estatísticas de faturas de uma UC"
)
async def obter_estatisticas(
    uc_id: int,
    current_user: Annotated[CurrentUser, Depends(get_current_active_user)],
    ano: Optional[int] = Query(None, description="Ano para filtrar"),
):
    """
    Obtém estatísticas agregadas das faturas de uma UC.

    Inclui:
    - Total de faturas
    - Valor total e médio
    - Consumo total e médio
    - Contagem por status
    """
    return await faturas_service.obter_estatisticas(uc_id=uc_id, ano=ano)


@router.get(
    "/uc/{uc_id}/comparativo",
    response_model=list[ComparativoMensalResponse],
    summary="Comparativo mensal",
    description="Obtém comparativo mensal de faturas"
)
async def obter_comparativo(
    uc_id: int,
    current_user: Annotated[CurrentUser, Depends(get_current_active_user)],
    meses: int = Query(12, ge=1, le=24, description="Quantidade de meses"),
):
    """
    Obtém comparativo mensal de consumo e valor.

    Útil para visualizar evolução ao longo do tempo.
    """
    return await faturas_service.obter_comparativo_mensal(uc_id=uc_id, meses=meses)


@router.get(
    "/uc/{uc_id}/gd",
    response_model=list[HistoricoGDResponse],
    summary="Histórico GD",
    description="Lista histórico de GD de uma UC"
)
async def listar_historico_gd(
    uc_id: int,
    current_user: Annotated[CurrentUser, Depends(get_current_active_user)],
    page: int = Query(1, ge=1),
    per_page: int = Query(12, ge=1, le=50),
):
    """
    Lista o histórico de Geração Distribuída de uma UC.

    Inclui saldos, injeção, compensação, etc.
    """
    historicos, _ = await faturas_service.listar_historico_gd(
        uc_id=uc_id,
        page=page,
        per_page=per_page
    )
    return historicos


@router.get(
    "/uc/{uc_id}/{ano}/{mes}",
    response_model=FaturaResponse,
    summary="Fatura por referência",
    description="Busca fatura por mês/ano de referência"
)
async def buscar_por_referencia(
    uc_id: int,
    ano: int,
    mes: int,
    current_user: Annotated[CurrentUser, Depends(get_current_active_user)],
):
    """
    Busca fatura específica pelo mês/ano de referência.
    """
    fatura = await faturas_service.buscar_por_referencia(uc_id, mes, ano)

    if not fatura:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Fatura não encontrada para {mes:02d}/{ano}"
        )

    return fatura


@router.get(
    "/{fatura_id}",
    response_model=FaturaResponse,
    summary="Buscar fatura",
    description="Busca fatura por ID"
)
async def buscar_fatura(
    fatura_id: int,
    current_user: Annotated[CurrentUser, Depends(get_current_active_user)],
):
    """
    Busca dados completos de uma fatura.
    """
    return await faturas_service.buscar_por_id(fatura_id)


@router.post(
    "/manual",
    response_model=FaturaResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Criar fatura manual",
    description="Cria fatura manualmente (sem sincronização)",
    dependencies=[Depends(require_perfil("superadmin", "gestor"))]
)
async def criar_fatura_manual(
    data: FaturaManualRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_active_user)],
):
    """
    Cria uma fatura manualmente.

    Útil para registrar faturas que não estão disponíveis na API.
    """
    return await faturas_service.criar_manual(data)
