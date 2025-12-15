"""
Router para Configurações de Impostos
"""

from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from backend.auth.dependencies import get_current_user, require_admin
from backend.auth.schemas import UsuarioLogado
from .schemas import ImpostoCreate, ImpostoUpdate, ImpostoResponse, ImpostoVigente
from .service import impostos_service

router = APIRouter(prefix="/configuracoes", tags=["Configurações"])


@router.get("/impostos", response_model=List[ImpostoResponse])
async def listar_impostos(
    current_user: UsuarioLogado = Depends(get_current_user)
):
    """Lista todos os registros de impostos"""
    return impostos_service.listar_todos()


@router.get("/impostos/vigente", response_model=ImpostoVigente)
async def buscar_imposto_vigente(
    data_referencia: Optional[date] = Query(None, description="Data de referência (default: hoje)"),
    current_user: UsuarioLogado = Depends(get_current_user)
):
    """Busca o imposto vigente para uma data específica"""
    imposto = impostos_service.buscar_vigente(data_referencia)
    if not imposto:
        raise HTTPException(status_code=404, detail="Nenhum imposto vigente encontrado")
    return imposto


@router.get("/impostos/{imposto_id}", response_model=ImpostoResponse)
async def buscar_imposto(
    imposto_id: int,
    current_user: UsuarioLogado = Depends(get_current_user)
):
    """Busca um imposto por ID"""
    imposto = impostos_service.buscar_por_id(imposto_id)
    if not imposto:
        raise HTTPException(status_code=404, detail="Imposto não encontrado")
    return imposto


@router.post("/impostos", response_model=ImpostoResponse)
async def criar_imposto(
    dados: ImpostoCreate,
    current_user: UsuarioLogado = Depends(require_admin)
):
    """
    Cria novo registro de imposto (apenas admin).
    Encerra automaticamente a vigência do anterior.
    """
    imposto = impostos_service.criar(dados.model_dump(), current_user.id)
    if not imposto:
        raise HTTPException(status_code=500, detail="Erro ao criar imposto")
    return imposto


@router.put("/impostos/{imposto_id}", response_model=ImpostoResponse)
async def atualizar_imposto(
    imposto_id: int,
    dados: ImpostoUpdate,
    current_user: UsuarioLogado = Depends(require_admin)
):
    """Atualiza um registro de imposto (apenas admin)"""
    imposto = impostos_service.atualizar(imposto_id, dados.model_dump(exclude_unset=True))
    if not imposto:
        raise HTTPException(status_code=404, detail="Imposto não encontrado")
    return imposto


@router.delete("/impostos/{imposto_id}")
async def excluir_imposto(
    imposto_id: int,
    current_user: UsuarioLogado = Depends(require_admin)
):
    """Exclui um registro de imposto (apenas admin, não pode ser o vigente)"""
    try:
        impostos_service.excluir(imposto_id)
        return {"message": "Imposto excluído com sucesso"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
