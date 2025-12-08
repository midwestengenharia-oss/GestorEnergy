"""
Beneficiarios Router - Endpoints de Beneficiários de GD
"""

from fastapi import APIRouter, Depends, Query, status
from typing import Annotated, Optional
import math

from backend.beneficiarios.schemas import (
    BeneficiarioCreateRequest,
    BeneficiarioUpdateRequest,
    ConviteEnviarRequest,
    BeneficiarioResponse,
    BeneficiarioListResponse,
    BeneficiarioFiltros,
    BeneficiarioStatus,
    ConviteResponse,
    MessageResponse,
)
from backend.beneficiarios.service import beneficiarios_service
from backend.core.security import (
    CurrentUser,
    get_current_active_user,
    require_perfil,
)

router = APIRouter()


@router.get(
    "",
    response_model=BeneficiarioListResponse,
    summary="Listar beneficiários",
    description="Lista beneficiários com filtros e paginação",
    dependencies=[Depends(require_perfil("superadmin", "gestor", "proprietario"))]
)
async def listar_beneficiarios(
    current_user: Annotated[CurrentUser, Depends(get_current_active_user)],
    usina_id: Optional[int] = Query(None, description="Filtrar por usina"),
    uc_id: Optional[int] = Query(None, description="Filtrar por UC"),
    cpf: Optional[str] = Query(None, description="Filtrar por CPF"),
    nome: Optional[str] = Query(None, description="Filtrar por nome"),
    email: Optional[str] = Query(None, description="Filtrar por email"),
    status: Optional[BeneficiarioStatus] = Query(None, description="Filtrar por status"),
    page: int = Query(1, ge=1, description="Página"),
    per_page: int = Query(20, ge=1, le=100, description="Itens por página"),
):
    """
    Lista beneficiários da plataforma.

    Acesso restrito a gestores, proprietários e superadmins.
    """
    filtros = BeneficiarioFiltros(
        usina_id=usina_id,
        uc_id=uc_id,
        cpf=cpf,
        nome=nome,
        email=email,
        status=status
    )

    beneficiarios, total = await beneficiarios_service.listar(
        filtros=filtros,
        page=page,
        per_page=per_page
    )

    total_pages = math.ceil(total / per_page) if total > 0 else 1

    return BeneficiarioListResponse(
        beneficiarios=beneficiarios,
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages
    )


@router.post(
    "",
    response_model=BeneficiarioResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Criar beneficiário",
    description="Cadastra novo beneficiário",
    dependencies=[Depends(require_perfil("superadmin", "gestor", "proprietario"))]
)
async def criar_beneficiario(
    data: BeneficiarioCreateRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_active_user)],
):
    """
    Cadastra um novo beneficiário de GD.

    O beneficiário precisa ter uma UC vinculada e estar associado a uma usina.
    """
    return await beneficiarios_service.criar(data)


@router.get(
    "/meus",
    response_model=list[BeneficiarioResponse],
    summary="Meus benefícios",
    description="Lista os benefícios do usuário logado"
)
async def meus_beneficios(
    current_user: Annotated[CurrentUser, Depends(get_current_active_user)],
):
    """
    Lista os benefícios de GD vinculados ao usuário logado.
    """
    filtros = BeneficiarioFiltros()
    beneficiarios, _ = await beneficiarios_service.listar(
        filtros=filtros,
        per_page=100
    )

    # Filtra pelo usuário (por CPF se não tiver vínculo direto)
    meus = []
    for b in beneficiarios:
        if b.usuario_id == str(current_user.id):
            meus.append(b)

    return meus


@router.get(
    "/usina/{usina_id}",
    response_model=BeneficiarioListResponse,
    summary="Beneficiários por usina",
    description="Lista beneficiários de uma usina específica"
)
async def listar_por_usina(
    usina_id: int,
    current_user: Annotated[CurrentUser, Depends(get_current_active_user)],
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    """
    Lista os beneficiários de uma usina específica.
    """
    beneficiarios, total = await beneficiarios_service.listar_por_usina(
        usina_id=usina_id,
        page=page,
        per_page=per_page
    )

    total_pages = math.ceil(total / per_page) if total > 0 else 1

    return BeneficiarioListResponse(
        beneficiarios=beneficiarios,
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages
    )


@router.get(
    "/{beneficiario_id}",
    response_model=BeneficiarioResponse,
    summary="Buscar beneficiário",
    description="Busca beneficiário por ID"
)
async def buscar_beneficiario(
    beneficiario_id: int,
    current_user: Annotated[CurrentUser, Depends(get_current_active_user)],
):
    """
    Busca dados completos de um beneficiário.
    """
    return await beneficiarios_service.buscar_por_id(beneficiario_id)


@router.put(
    "/{beneficiario_id}",
    response_model=BeneficiarioResponse,
    summary="Atualizar beneficiário",
    description="Atualiza dados do beneficiário",
    dependencies=[Depends(require_perfil("superadmin", "gestor", "proprietario"))]
)
async def atualizar_beneficiario(
    beneficiario_id: int,
    data: BeneficiarioUpdateRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_active_user)],
):
    """
    Atualiza dados de um beneficiário.
    """
    return await beneficiarios_service.atualizar(beneficiario_id, data)


@router.post(
    "/{beneficiario_id}/convite",
    response_model=ConviteResponse,
    summary="Enviar convite",
    description="Envia convite para beneficiário criar conta",
    dependencies=[Depends(require_perfil("superadmin", "gestor", "proprietario"))]
)
async def enviar_convite(
    beneficiario_id: int,
    current_user: Annotated[CurrentUser, Depends(get_current_active_user)],
):
    """
    Envia convite por email para o beneficiário criar conta na plataforma.
    """
    return await beneficiarios_service.enviar_convite(
        beneficiario_id=beneficiario_id,
        convidado_por_id=str(current_user.id)
    )


@router.post(
    "/{beneficiario_id}/ativar",
    response_model=BeneficiarioResponse,
    summary="Ativar beneficiário",
    description="Ativa um beneficiário",
    dependencies=[Depends(require_perfil("superadmin", "gestor", "proprietario"))]
)
async def ativar_beneficiario(
    beneficiario_id: int,
    current_user: Annotated[CurrentUser, Depends(get_current_active_user)],
):
    """
    Ativa um beneficiário para começar a receber créditos.
    """
    return await beneficiarios_service.ativar(beneficiario_id)


@router.post(
    "/{beneficiario_id}/suspender",
    response_model=BeneficiarioResponse,
    summary="Suspender beneficiário",
    description="Suspende um beneficiário",
    dependencies=[Depends(require_perfil("superadmin", "gestor", "proprietario"))]
)
async def suspender_beneficiario(
    beneficiario_id: int,
    current_user: Annotated[CurrentUser, Depends(get_current_active_user)],
):
    """
    Suspende temporariamente um beneficiário.
    """
    return await beneficiarios_service.suspender(beneficiario_id)


@router.post(
    "/{beneficiario_id}/cancelar",
    response_model=BeneficiarioResponse,
    summary="Cancelar beneficiário",
    description="Cancela um beneficiário",
    dependencies=[Depends(require_perfil("superadmin", "gestor", "proprietario"))]
)
async def cancelar_beneficiario(
    beneficiario_id: int,
    current_user: Annotated[CurrentUser, Depends(get_current_active_user)],
):
    """
    Cancela definitivamente um beneficiário.
    """
    return await beneficiarios_service.cancelar(beneficiario_id)


@router.patch(
    "/{beneficiario_id}/cpf",
    response_model=BeneficiarioResponse,
    summary="Atualizar CPF do beneficiário",
    description="Atualiza CPF e tenta vincular usuário existente automaticamente",
    dependencies=[Depends(require_perfil("superadmin", "gestor", "proprietario"))]
)
async def atualizar_cpf_beneficiario(
    beneficiario_id: int,
    cpf: str = Query(..., min_length=11, max_length=14, description="CPF do beneficiário"),
    current_user: Annotated[CurrentUser, Depends(get_current_active_user)] = None,
):
    """
    Atualiza o CPF de um beneficiário.

    Se já existir um usuário com este CPF, o beneficiário será vinculado
    automaticamente ao usuário e seu status será atualizado para ATIVO.
    """
    return await beneficiarios_service.atualizar_cpf_e_vincular(
        beneficiario_id=beneficiario_id,
        cpf=cpf
    )
