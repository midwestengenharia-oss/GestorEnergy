"""
Admin Router - Endpoints da API para Administração
"""

from fastapi import APIRouter, Depends, Query
from typing import Optional
from datetime import date
from ..core.security import require_perfil, CurrentUser
from .schemas import (
    DashboardStatsResponse,
    DashboardGraficoRequest,
    DashboardGraficoResponse,
    ConfiguracaoSistemaResponse,
    ConfiguracaoUpdateRequest,
    LogAuditoriaListResponse,
    RelatorioRequest,
    RelatorioResponse,
    IntegracoesSistemaResponse,
    MessageResponse
)
from .service import AdminService

router = APIRouter()
service = AdminService()


# ========================
# Dashboard
# ========================

@router.get("/dashboard/stats", response_model=DashboardStatsResponse)
async def dashboard_estatisticas(
    current_user: CurrentUser = Depends(require_perfil("superadmin", "proprietario"))
):
    """Retorna estatísticas gerais do dashboard"""
    return await service.dashboard_stats()


@router.post("/dashboard/grafico", response_model=DashboardGraficoResponse)
async def dashboard_grafico(
    data: DashboardGraficoRequest,
    current_user: CurrentUser = Depends(require_perfil("superadmin", "proprietario", "gestor"))
):
    """Gera dados para gráficos do dashboard"""
    return await service.dashboard_grafico(
        tipo=data.tipo,
        periodo=data.periodo,
        usina_id=data.usina_id
    )


# ========================
# Configurações
# ========================

@router.get("/configuracoes", response_model=list[ConfiguracaoSistemaResponse])
async def listar_configuracoes(
    current_user: CurrentUser = Depends(require_perfil("superadmin"))
):
    """Lista configurações do sistema"""
    return await service.listar_configuracoes()


@router.put("/configuracoes/{chave}", response_model=ConfiguracaoSistemaResponse)
async def atualizar_configuracao(
    chave: str,
    data: ConfiguracaoUpdateRequest,
    current_user: CurrentUser = Depends(require_perfil("superadmin"))
):
    """Atualiza uma configuração do sistema"""
    return await service.atualizar_configuracao(
        chave=chave,
        valor=data.valor,
        user_id=current_user.id
    )


# ========================
# Logs e Auditoria
# ========================

@router.get("/logs", response_model=LogAuditoriaListResponse)
async def listar_logs_auditoria(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    usuario_id: Optional[str] = None,
    entidade: Optional[str] = None,
    acao: Optional[str] = None,
    data_inicio: Optional[date] = None,
    data_fim: Optional[date] = None,
    current_user: CurrentUser = Depends(require_perfil("superadmin"))
):
    """Lista logs de auditoria do sistema"""
    return await service.listar_logs_auditoria(
        page=page,
        per_page=per_page,
        usuario_id=usuario_id,
        entidade=entidade,
        acao=acao,
        data_inicio=data_inicio,
        data_fim=data_fim
    )


# ========================
# Relatórios
# ========================

@router.post("/relatorios", response_model=RelatorioResponse)
async def gerar_relatorio(
    data: RelatorioRequest,
    current_user: CurrentUser = Depends(require_perfil("superadmin", "proprietario"))
):
    """Gera relatório do sistema"""
    return await service.gerar_relatorio(
        data=data.model_dump(),
        user_id=current_user.id
    )


# ========================
# Integrações
# ========================

@router.get("/integracoes", response_model=IntegracoesSistemaResponse)
async def verificar_integracoes(
    current_user: CurrentUser = Depends(require_perfil("superadmin"))
):
    """Verifica status das integrações externas"""
    return await service.verificar_integracoes()


# ========================
# Sincronização
# ========================

@router.get("/sync/status")
async def status_sincronizacao(
    current_user: CurrentUser = Depends(require_perfil("superadmin"))
):
    """Retorna status detalhado da sincronização com Energisa"""
    return await service.status_sincronizacao()


@router.post("/sync/forcar/{uc_id}")
async def forcar_sincronizacao(
    uc_id: int,
    current_user: CurrentUser = Depends(require_perfil("superadmin"))
):
    """Força sincronização de uma UC específica"""
    return await service.forcar_sincronizacao(uc_id, current_user.id)


# ========================
# Manutenção
# ========================

@router.get("/health-detailed")
async def health_check_detalhado(
    current_user: CurrentUser = Depends(require_perfil("superadmin"))
):
    """Health check detalhado do sistema"""
    integracoes = await service.verificar_integracoes()

    return {
        "status": "healthy",
        "timestamp": str(date.today()),
        "integracoes": integracoes,
        "versao": "1.0.0"
    }
