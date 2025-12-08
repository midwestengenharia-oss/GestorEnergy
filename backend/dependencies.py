"""
Dependencies - Dependências globais da aplicação
"""

from typing import Optional, Generator
from fastapi import Depends, Query

from backend.core.database import SupabaseClient, db, db_admin
from backend.core.security import (
    CurrentUser,
    get_current_user,
    get_current_active_user,
    require_perfil,
    require_superadmin,
    optional_auth,
)


# ========================
# Re-exports para facilitar imports
# ========================

# Database
def get_db() -> SupabaseClient:
    """Dependency para obter cliente Supabase (usuário)"""
    return db


def get_db_admin() -> SupabaseClient:
    """Dependency para obter cliente Supabase (admin)"""
    return db_admin


# Auth re-exports
get_user = get_current_user
get_active_user = get_current_active_user


# ========================
# Pagination
# ========================

class PaginationParams:
    """Parâmetros de paginação padronizados"""

    def __init__(
        self,
        page: int = Query(1, ge=1, description="Número da página"),
        per_page: int = Query(20, ge=1, le=100, description="Itens por página")
    ):
        self.page = page
        self.per_page = per_page
        self.offset = (page - 1) * per_page

    @property
    def limit(self) -> int:
        return self.per_page


class PaginatedResponse:
    """Resposta paginada padronizada"""

    def __init__(
        self,
        items: list,
        total: int,
        page: int,
        per_page: int
    ):
        self.items = items
        self.total = total
        self.page = page
        self.per_page = per_page
        self.pages = (total + per_page - 1) // per_page if per_page > 0 else 0
        self.has_next = page < self.pages
        self.has_prev = page > 1

    def to_dict(self) -> dict:
        return {
            "items": self.items,
            "pagination": {
                "total": self.total,
                "page": self.page,
                "per_page": self.per_page,
                "pages": self.pages,
                "has_next": self.has_next,
                "has_prev": self.has_prev
            }
        }


# ========================
# Filtros comuns
# ========================

class DateRangeParams:
    """Parâmetros de filtro por data"""

    def __init__(
        self,
        data_inicio: Optional[str] = Query(None, description="Data início (YYYY-MM-DD)"),
        data_fim: Optional[str] = Query(None, description="Data fim (YYYY-MM-DD)")
    ):
        self.data_inicio = data_inicio
        self.data_fim = data_fim


class StatusFilterParams:
    """Parâmetros de filtro por status"""

    def __init__(
        self,
        status: Optional[str] = Query(None, description="Filtrar por status")
    ):
        self.status = status


# ========================
# Verificadores de propriedade
# ========================

async def verify_uc_ownership(
    uc_id: int,
    current_user: CurrentUser,
    db: SupabaseClient = Depends(get_db_admin)
) -> dict:
    """
    Verifica se o usuário tem acesso à UC.

    Args:
        uc_id: ID da UC
        current_user: Usuário atual
        db: Cliente Supabase

    Returns:
        Dados da UC

    Raises:
        NotFoundError: Se UC não encontrada
        AuthorizationError: Se usuário não tem acesso
    """
    from backend.core.exceptions import NotFoundError, AuthorizationError

    result = db.unidades_consumidoras().select("*").eq("id", uc_id).single().execute()

    if not result.data:
        raise NotFoundError("UC")

    uc = result.data

    # Superadmin sempre tem acesso
    if current_user.is_superadmin:
        return uc

    # Verifica se é o dono da UC
    if uc.get("usuario_id") == current_user.id:
        return uc

    # TODO: Verificar se é gestor da usina associada

    raise AuthorizationError("Você não tem acesso a esta UC")


async def verify_usina_ownership(
    usina_id: int,
    current_user: CurrentUser,
    db: SupabaseClient = Depends(get_db_admin)
) -> dict:
    """
    Verifica se o usuário tem acesso à usina.

    Args:
        usina_id: ID da usina
        current_user: Usuário atual
        db: Cliente Supabase

    Returns:
        Dados da usina

    Raises:
        NotFoundError: Se usina não encontrada
        AuthorizationError: Se usuário não tem acesso
    """
    from backend.core.exceptions import NotFoundError, AuthorizationError

    result = db.usinas().select("*").eq("id", usina_id).single().execute()

    if not result.data:
        raise NotFoundError("Usina")

    usina = result.data

    # Superadmin sempre tem acesso
    if current_user.is_superadmin:
        return usina

    # Verifica se é proprietário
    if usina.get("proprietario_id") == current_user.id:
        return usina

    # Verifica se é gestor (usa db_admin para evitar recursão de RLS)
    gestores = db_admin.table("gestores_usina").select("gestor_id").eq(
        "usina_id", usina_id
    ).eq("ativo", True).execute()

    if gestores.data:
        gestor_ids = [g["gestor_id"] for g in gestores.data]
        if str(current_user.id) in gestor_ids:
            return usina

    raise AuthorizationError("Você não tem acesso a esta usina")


# ========================
# Utilidades
# ========================

def format_uc(cod_empresa: int, cdc: int, digito_verificador: int) -> str:
    """
    Formata código de UC no padrão: cod_empresa/cdc-digito

    Args:
        cod_empresa: Código da empresa
        cdc: CDC da UC
        digito_verificador: Dígito verificador

    Returns:
        UC formatada (ex: "6/4242904-3")
    """
    return f"{cod_empresa}/{cdc}-{digito_verificador}"


def parse_uc(uc_formatada: str) -> tuple[int, int, int]:
    """
    Parse de UC formatada para componentes.

    Args:
        uc_formatada: UC no formato "6/4242904-3"

    Returns:
        Tupla (cod_empresa, cdc, digito_verificador)

    Raises:
        ValueError: Se formato inválido
    """
    try:
        empresa_cdc, digito = uc_formatada.split("-")
        empresa, cdc = empresa_cdc.split("/")
        return int(empresa), int(cdc), int(digito)
    except (ValueError, AttributeError):
        raise ValueError(f"Formato de UC inválido: {uc_formatada}. Use: cod_empresa/cdc-digito")
