"""
UCs Router - Endpoints de Unidades Consumidoras
"""

from fastapi import APIRouter, Depends, Query, status, HTTPException
from typing import Annotated, Optional
from pydantic import BaseModel
import math
import logging

from backend.ucs.schemas import (
    UCVincularRequest,
    UCVincularPorFormatoRequest,
    UCUpdateRequest,
    UCConfigGDRequest,
    UCResponse,
    UCListResponse,
    UCFiltros,
    UCGDInfoResponse,
    MessageResponse,
    HistoricoGDResponse,
    UCComGDResponse,
    GDResumoResponse,
)
from backend.ucs.service import ucs_service
from backend.core.security import (
    CurrentUser,
    get_current_active_user,
    require_perfil,
)

logger = logging.getLogger(__name__)


class SincronizarFaturasRequest(BaseModel):
    """Request para sincronizar faturas"""
    cpf: str

router = APIRouter()


@router.get(
    "",
    response_model=UCListResponse,
    summary="Listar UCs",
    description="Lista Unidades Consumidoras com filtros e paginação"
)
async def listar_ucs(
    current_user: Annotated[CurrentUser, Depends(get_current_active_user)],
    usuario_id: Optional[str] = Query(None, description="Filtrar por usuário"),
    cdc: Optional[int] = Query(None, description="Filtrar por CDC"),
    cidade: Optional[str] = Query(None, description="Filtrar por cidade"),
    uf: Optional[str] = Query(None, description="Filtrar por UF"),
    is_geradora: Optional[bool] = Query(None, description="Filtrar por geradoras"),
    uc_ativa: Optional[bool] = Query(None, description="Filtrar por status ativo"),
    page: int = Query(1, ge=1, description="Página"),
    per_page: int = Query(20, ge=1, le=100, description="Itens por página"),
):
    """
    Lista UCs da plataforma.

    - Superadmins e gestores veem todas
    - Usuários comuns veem apenas suas próprias UCs
    """
    filtros = UCFiltros(
        usuario_id=usuario_id,
        cdc=cdc,
        cidade=cidade,
        uf=uf,
        is_geradora=is_geradora,
        uc_ativa=uc_ativa
    )

    # Usuários comuns só veem suas próprias UCs
    if not current_user.is_superadmin and "gestor" not in current_user.perfis:
        filtros.usuario_id = str(current_user.id)

    ucs, total = await ucs_service.listar(
        filtros=filtros,
        page=page,
        per_page=per_page
    )

    total_pages = math.ceil(total / per_page) if total > 0 else 1

    return UCListResponse(
        ucs=ucs,
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages
    )


@router.get(
    "/minhas",
    response_model=UCListResponse,
    summary="Minhas UCs",
    description="Lista UCs do usuário logado"
)
async def listar_minhas_ucs(
    current_user: Annotated[CurrentUser, Depends(get_current_active_user)],
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    usuario_titular: Optional[bool] = Query(None, description="Filtrar por titularidade: true=titular, false=gestor"),
):
    """
    Lista as UCs vinculadas ao usuário logado.

    - usuario_titular=true: Apenas UCs onde o usuário é titular (perfil "usuario")
    - usuario_titular=false: Apenas UCs onde o usuário NÃO é titular (perfil "gestor")
    - Sem filtro: Todas as UCs do usuário
    """
    filtros = UCFiltros(
        usuario_id=str(current_user.id),
        usuario_titular=usuario_titular
    )

    ucs, total = await ucs_service.listar(
        filtros=filtros,
        page=page,
        per_page=per_page
    )

    total_pages = math.ceil(total / per_page) if total > 0 else 1

    return UCListResponse(
        ucs=ucs,
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages
    )


@router.get(
    "/geradoras",
    response_model=list[UCResponse],
    summary="Listar geradoras",
    description="Lista UCs geradoras (GD)"
)
async def listar_geradoras(
    current_user: Annotated[CurrentUser, Depends(get_current_active_user)],
    usuario_id: Optional[str] = Query(None, description="Filtrar por usuário"),
):
    """
    Lista todas as UCs configuradas como geradoras.
    """
    # Usuários comuns só veem suas próprias geradoras
    if not current_user.is_superadmin and "gestor" not in current_user.perfis:
        usuario_id = str(current_user.id)

    return await ucs_service.listar_geradoras(usuario_id=usuario_id)


@router.post(
    "/vincular",
    response_model=UCResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Vincular UC",
    description="Vincula uma UC ao usuário"
)
async def vincular_uc(
    data: UCVincularRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_active_user)],
):
    """
    Vincula uma nova UC ao usuário logado.

    Use os dados: cod_empresa, cdc e digito_verificador.
    """
    return await ucs_service.vincular(
        usuario_id=str(current_user.id),
        data=data
    )


@router.post(
    "/vincular-formato",
    response_model=UCResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Vincular UC por formato",
    description="Vincula UC usando formato de exibição (6/4242904-3)"
)
async def vincular_uc_por_formato(
    data: UCVincularPorFormatoRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_active_user)],
):
    """
    Vincula UC usando o formato de exibição (ex: 6/4242904-3).
    """
    return await ucs_service.vincular_por_formato(
        usuario_id=str(current_user.id),
        data=data
    )


@router.get(
    "/{uc_id}",
    response_model=UCResponse,
    summary="Buscar UC",
    description="Busca UC por ID"
)
async def buscar_uc(
    uc_id: int,
    current_user: Annotated[CurrentUser, Depends(get_current_active_user)],
):
    """
    Busca dados completos de uma UC.
    """
    uc = await ucs_service.buscar_por_id(uc_id)

    # Verifica permissão (superadmin, gestor ou dono da UC)
    if not current_user.is_superadmin and "gestor" not in current_user.perfis:
        if uc.usuario_id != str(current_user.id):
            from fastapi import HTTPException
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Sem permissão para acessar esta UC"
            )

    return uc


@router.put(
    "/{uc_id}",
    response_model=UCResponse,
    summary="Atualizar UC",
    description="Atualiza dados da UC"
)
async def atualizar_uc(
    uc_id: int,
    data: UCUpdateRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_active_user)],
):
    """
    Atualiza dados de uma UC.
    """
    uc = await ucs_service.buscar_por_id(uc_id)

    # Verifica permissão
    if not current_user.is_superadmin and "gestor" not in current_user.perfis:
        if uc.usuario_id != str(current_user.id):
            from fastapi import HTTPException
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Sem permissão para editar esta UC"
            )

    return await ucs_service.atualizar(uc_id, data)


@router.post(
    "/{uc_id}/gd",
    response_model=UCResponse,
    summary="Configurar GD",
    description="Configura UC para Geração Distribuída",
    dependencies=[Depends(require_perfil("superadmin", "gestor", "proprietario"))]
)
async def configurar_gd(
    uc_id: int,
    config: UCConfigGDRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_active_user)],
):
    """
    Configura uma UC como geradora ou beneficiária de GD.
    """
    return await ucs_service.configurar_gd(uc_id, config)


@router.get(
    "/{uc_id}/gd",
    response_model=UCGDInfoResponse,
    summary="Info GD",
    description="Obtém informações de GD da UC"
)
async def obter_info_gd(
    uc_id: int,
    current_user: Annotated[CurrentUser, Depends(get_current_active_user)],
):
    """
    Obtém informações de Geração Distribuída de uma UC.

    Se for geradora, inclui lista de beneficiárias.
    """
    return await ucs_service.obter_info_gd(uc_id)


@router.get(
    "/{uc_id}/beneficiarias",
    response_model=list[UCResponse],
    summary="Listar beneficiárias",
    description="Lista UCs beneficiárias de uma geradora"
)
async def listar_beneficiarias(
    uc_id: int,
    current_user: Annotated[CurrentUser, Depends(get_current_active_user)],
):
    """
    Lista as UCs beneficiárias vinculadas a uma UC geradora.
    """
    return await ucs_service.listar_beneficiarias(uc_id)


@router.delete(
    "/{uc_id}",
    response_model=MessageResponse,
    summary="Desvincular UC",
    description="Remove vinculação de UC"
)
async def desvincular_uc(
    uc_id: int,
    current_user: Annotated[CurrentUser, Depends(get_current_active_user)],
):
    """
    Remove (desvincula) uma UC do sistema.

    ATENÇÃO: Isso remove a UC e todos os dados relacionados.
    """
    uc = await ucs_service.buscar_por_id(uc_id)

    # Apenas superadmin ou dono pode remover
    if not current_user.is_superadmin:
        if uc.usuario_id != str(current_user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Sem permissão para remover esta UC"
            )

    await ucs_service.desvincular(uc_id)

    return MessageResponse(
        message="UC desvinculada com sucesso",
        success=True
    )


@router.post(
    "/{uc_id}/sincronizar-faturas",
    response_model=MessageResponse,
    summary="Sincronizar faturas da UC",
    description="Busca faturas da Energisa e salva no banco de dados"
)
async def sincronizar_faturas(
    uc_id: int,
    req: SincronizarFaturasRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_active_user)],
):
    """
    Sincroniza as faturas de uma UC com a Energisa.

    Busca faturas no portal da Energisa e salva/atualiza no banco de dados.
    Requer que o usuário esteja autenticado na Energisa (sessão ativa).
    """
    from backend.energisa.service import EnergisaService
    from backend.faturas.service import faturas_service

    # Busca a UC
    uc = await ucs_service.buscar_por_id(uc_id)

    # Verifica permissão
    if not current_user.is_superadmin and "gestor" not in current_user.perfis:
        if uc.usuario_id != str(current_user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Sem permissão para sincronizar faturas desta UC"
            )

    # Cria serviço Energisa com CPF
    svc = EnergisaService(req.cpf)

    if not svc.is_authenticated():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessão da Energisa expirada. Faça login novamente."
        )

    # Monta dados da UC para API da Energisa
    uc_data = {
        'cdc': uc.cdc,
        'digitoVerificadorCdc': uc.digito_verificador,
        'codigoEmpresaWeb': uc.cod_empresa
    }

    try:
        # Busca faturas na Energisa
        logger.info(f"Buscando faturas da UC {uc.cdc} na Energisa...")
        faturas_energisa = svc.listar_faturas(uc_data)

        if not faturas_energisa:
            return MessageResponse(
                message="Nenhuma fatura encontrada na Energisa",
                success=True
            )

        # Salva cada fatura no banco
        faturas_salvas = 0
        for fatura_api in faturas_energisa:
            try:
                await faturas_service.salvar_da_api(uc.id, fatura_api)
                faturas_salvas += 1
            except Exception as e:
                logger.warning(f"Erro ao salvar fatura: {e}")
                continue

        logger.info(f"Sincronizadas {faturas_salvas} faturas da UC {uc.cdc}")

        return MessageResponse(
            message=f"{faturas_salvas} fatura(s) sincronizada(s) com sucesso",
            success=True
        )

    except Exception as e:
        logger.error(f"Erro ao sincronizar faturas: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao sincronizar faturas: {str(e)}"
        )


# ========================
# Endpoints de GD do banco
# ========================

@router.get(
    "/gd/resumo",
    response_model=GDResumoResponse,
    summary="Resumo de GD do usuário",
    description="Retorna resumo consolidado de GD de todas as UCs do usuário"
)
async def obter_resumo_gd(
    current_user: Annotated[CurrentUser, Depends(get_current_active_user)],
    usuario_titular: Optional[bool] = Query(None, description="Filtrar por titularidade: true=titular, false=gestor"),
):
    """
    Obtém resumo de Geração Distribuída do usuário.

    Retorna dados consolidados de todas as UCs que participam de GD,
    lidos do banco de dados local (não consulta Energisa em tempo real).

    - usuario_titular=true: Apenas UCs onde o usuário é titular
    - usuario_titular=false: Apenas UCs onde o usuário NÃO é titular (gestor)
    """
    return await ucs_service.obter_resumo_gd_usuario(str(current_user.id), usuario_titular)


@router.get(
    "/{uc_id}/gd/historico",
    response_model=list[HistoricoGDResponse],
    summary="Histórico de GD da UC",
    description="Retorna histórico mensal de GD da UC"
)
async def obter_historico_gd(
    uc_id: int,
    current_user: Annotated[CurrentUser, Depends(get_current_active_user)],
):
    """
    Obtém histórico de Geração Distribuída de uma UC.

    Retorna registros mensais de créditos, injeção e compensação,
    lidos do banco de dados local.
    """
    uc = await ucs_service.buscar_por_id(uc_id)

    # Verifica permissão
    if not current_user.is_superadmin and "gestor" not in current_user.perfis:
        if uc.usuario_id != str(current_user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Sem permissão para acessar dados de GD desta UC"
            )

    return await ucs_service.buscar_historico_gd(uc_id)


@router.get(
    "/{uc_id}/gd/completo",
    response_model=UCComGDResponse,
    summary="Dados completos de GD da UC",
    description="Retorna todos os dados de GD da UC incluindo histórico e beneficiárias"
)
async def obter_gd_completo(
    uc_id: int,
    current_user: Annotated[CurrentUser, Depends(get_current_active_user)],
):
    """
    Obtém dados completos de Geração Distribuída de uma UC.

    Inclui: UC, histórico, beneficiárias (se geradora), geradora (se beneficiária).
    Lido do banco de dados local.
    """
    uc = await ucs_service.buscar_por_id(uc_id)

    # Verifica permissão
    if not current_user.is_superadmin and "gestor" not in current_user.perfis:
        if uc.usuario_id != str(current_user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Sem permissão para acessar dados de GD desta UC"
            )

    return await ucs_service.obter_gd_completo(uc_id)
