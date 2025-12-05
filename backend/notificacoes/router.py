"""
Notificações Router - Endpoints da API para Notificações
"""

from fastapi import APIRouter, Depends, Query
from typing import Optional, List
from ..core.security import get_current_active_user, require_perfil, CurrentUser
from .schemas import (
    NotificacaoCreateRequest,
    NotificacaoLoteRequest,
    PreferenciaNotificacaoRequest,
    NotificacaoResponse,
    NotificacaoListResponse,
    PreferenciasNotificacaoResponse,
    EstatisticasNotificacaoResponse,
    ContadorNotificacoesResponse,
    MessageResponse
)
from .service import NotificacoesService

router = APIRouter()
service = NotificacoesService()


@router.get("", response_model=NotificacaoListResponse)
async def listar_notificacoes(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    apenas_nao_lidas: bool = False,
    tipo: Optional[str] = None,
    current_user: CurrentUser = Depends(get_current_active_user)
):
    """Lista notificações do usuário logado"""
    return await service.listar(
        user_id=current_user.id,
        page=page,
        per_page=per_page,
        apenas_nao_lidas=apenas_nao_lidas,
        tipo=tipo
    )


@router.get("/contador", response_model=ContadorNotificacoesResponse)
async def contar_nao_lidas(current_user: CurrentUser = Depends(get_current_active_user)):
    """Conta notificações não lidas"""
    count = await service.contar_nao_lidas(user_id=current_user.id)
    return {"nao_lidas": count}


@router.get("/preferencias", response_model=PreferenciasNotificacaoResponse)
async def obter_preferencias(current_user: CurrentUser = Depends(get_current_active_user)):
    """Obtém preferências de notificação do usuário"""
    return await service.obter_preferencias(user_id=current_user.id)


@router.put("/preferencias", response_model=PreferenciasNotificacaoResponse)
async def atualizar_preferencias(
    data: PreferenciaNotificacaoRequest,
    current_user: CurrentUser = Depends(get_current_active_user)
):
    """Atualiza preferências de notificação"""
    return await service.atualizar_preferencias(
        user_id=current_user.id,
        data=data.model_dump(exclude_unset=True)
    )


@router.get("/estatisticas", response_model=EstatisticasNotificacaoResponse)
async def estatisticas_notificacoes(
    current_user: CurrentUser = Depends(require_perfil("superadmin", "proprietario"))
):
    """Retorna estatísticas de notificações (admin)"""
    return await service.estatisticas()


@router.get("/{notificacao_id}", response_model=NotificacaoResponse)
async def buscar_notificacao(
    notificacao_id: int,
    current_user: CurrentUser = Depends(get_current_active_user)
):
    """Busca notificação por ID"""
    return await service.buscar(
        notificacao_id=notificacao_id,
        user_id=current_user.id
    )


@router.post("", response_model=NotificacaoResponse, status_code=201)
async def criar_notificacao(
    data: NotificacaoCreateRequest,
    current_user: CurrentUser = Depends(require_perfil("superadmin", "proprietario", "gestor"))
):
    """Cria nova notificação para um usuário (admin)"""
    return await service.criar(data=data.model_dump())


@router.post("/lote", response_model=dict)
async def enviar_lote(
    data: NotificacaoLoteRequest,
    current_user: CurrentUser = Depends(require_perfil("superadmin", "proprietario"))
):
    """Envia notificação em lote (admin)"""
    return await service.enviar_lote(data=data.model_dump())


@router.post("/{notificacao_id}/lida", response_model=NotificacaoResponse)
async def marcar_lida(
    notificacao_id: int,
    current_user: CurrentUser = Depends(get_current_active_user)
):
    """Marca notificação como lida"""
    return await service.marcar_lida(
        notificacao_id=notificacao_id,
        user_id=current_user.id
    )


@router.post("/marcar-todas-lidas", response_model=dict)
async def marcar_todas_lidas(current_user: CurrentUser = Depends(get_current_active_user)):
    """Marca todas as notificações como lidas"""
    return await service.marcar_todas_lidas(user_id=current_user.id)


@router.delete("/{notificacao_id}", response_model=MessageResponse)
async def excluir_notificacao(
    notificacao_id: int,
    current_user: CurrentUser = Depends(get_current_active_user)
):
    """Exclui notificação"""
    return await service.excluir(
        notificacao_id=notificacao_id,
        user_id=current_user.id
    )
