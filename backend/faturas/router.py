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
    usuario_titular: Optional[bool] = Query(None, description="Filtrar por titularidade: true=titular, false=gestor"),
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

    - Superadmins e gestores veem todas (a menos que filtrem por titularidade)
    - Usuários comuns veem apenas faturas de suas UCs
    - usuario_titular=true: Apenas faturas de UCs onde o usuário é titular
    - usuario_titular=false: Apenas faturas de UCs onde o usuário NÃO é titular (gestor)
    """
    # Usuários comuns só veem faturas de suas próprias UCs
    usuario_id = None
    if not current_user.is_superadmin and "gestor" not in current_user.perfis:
        usuario_id = str(current_user.id)

    filtros = FaturaFiltros(
        uc_id=uc_id,
        usuario_id=usuario_id,
        usuario_titular=usuario_titular,
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
    "/por-usina/{usina_id}",
    summary="Faturas por usina",
    description="Lista faturas de todos beneficiários de uma usina"
)
async def listar_faturas_por_usina(
    usina_id: int,
    current_user: Annotated[CurrentUser, Depends(get_current_active_user)],
    mes_referencia: Optional[int] = Query(None, ge=1, le=12, description="Mês de referência"),
    ano_referencia: Optional[int] = Query(None, ge=2000, le=2100, description="Ano de referência"),
):
    """
    Busca faturas de todos os beneficiários de uma usina.

    Retorna lista de faturas com informações do beneficiário associado.
    Útil para geração de cobranças em lote.
    """
    from backend.core.database import get_supabase_admin
    supabase = get_supabase_admin()

    # Buscar beneficiários da usina
    benef_response = supabase.table("beneficiarios").select(
        "id, nome, uc_id"
    ).eq("usina_id", usina_id).eq("status", "ATIVO").execute()

    if not benef_response.data:
        return {"faturas": [], "total": 0}

    uc_ids = [b["uc_id"] for b in benef_response.data if b.get("uc_id")]

    if not uc_ids:
        return {"faturas": [], "total": 0}

    # Buscar faturas dessas UCs
    query = supabase.table("faturas").select(
        "id, uc_id, numero_fatura, mes_referencia, ano_referencia, extracao_status, extracao_score, dados_extraidos"
    ).in_("uc_id", uc_ids)

    if mes_referencia:
        query = query.eq("mes_referencia", mes_referencia)
    if ano_referencia:
        query = query.eq("ano_referencia", ano_referencia)

    faturas_response = query.execute()

    # Mapear beneficiários às faturas
    benef_map = {b["uc_id"]: b for b in benef_response.data}

    faturas_com_benef = []
    for fatura in faturas_response.data:
        beneficiario = benef_map.get(fatura["uc_id"])
        if beneficiario:
            faturas_com_benef.append({
                **fatura,
                "beneficiario": {
                    "id": beneficiario["id"],
                    "nome": beneficiario["nome"]
                }
            })

    return {
        "faturas": faturas_com_benef,
        "total": len(faturas_com_benef)
    }


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


@router.get(
    "/{fatura_id}/pdf",
    summary="Buscar PDF da fatura",
    description="Retorna o PDF em base64 da fatura"
)
async def buscar_pdf_fatura(
    fatura_id: int,
    current_user: Annotated[CurrentUser, Depends(get_current_active_user)],
):
    """
    Busca o PDF da fatura em base64.
    """
    return await faturas_service.buscar_pdf(fatura_id)


@router.get(
    "/{fatura_id}/pix",
    summary="Buscar dados PIX da fatura",
    description="Retorna QR Code PIX e código copia e cola"
)
async def buscar_pix_fatura(
    fatura_id: int,
    current_user: Annotated[CurrentUser, Depends(get_current_active_user)],
):
    """
    Busca os dados de pagamento PIX da fatura.
    """
    return await faturas_service.buscar_pix(fatura_id)


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


# ========== ENDPOINTS DE EXTRAÇÃO DE DADOS ==========

@router.post(
    "/{fatura_id}/extrair",
    summary="Extrair dados da fatura",
    description="Processa extração de dados estruturados do PDF da fatura",
    dependencies=[Depends(require_perfil("superadmin", "gestor"))]
)
async def extrair_dados_fatura(
    fatura_id: int,
    current_user: Annotated[CurrentUser, Depends(get_current_active_user)],
):
    """
    Extrai dados estruturados de uma fatura específica.

    Usa PDF armazenado no banco para extrair:
    - Informações básicas (código cliente, ligação, referência)
    - Consumo e energia injetada
    - Ajustes GD I/II
    - Lançamentos e serviços
    - Totais e valores
    """
    dados = await faturas_service.processar_extracao_fatura(fatura_id)
    return {
        "success": True,
        "fatura_id": fatura_id,
        "dados": dados
    }


@router.post(
    "/extrair-lote",
    summary="Extrair dados de múltiplas faturas",
    description="Processa extração em lote de faturas pendentes",
    dependencies=[Depends(require_perfil("superadmin", "gestor"))]
)
async def extrair_dados_lote(
    uc_id: Optional[int] = None,
    mes_referencia: Optional[int] = None,
    ano_referencia: Optional[int] = None,
    limite: int = 10,
    forcar_reprocessamento: bool = Query(False, description="Forçar reprocessamento de faturas já extraídas"),
    current_user: Annotated[CurrentUser, Depends(get_current_active_user)] = None,
):
    """
    Processa extração de múltiplas faturas em lote.

    Args:
        uc_id: Filtrar por UC (opcional)
        mes_referencia: Filtrar por mês (opcional)
        ano_referencia: Filtrar por ano (opcional)
        limite: Máximo de faturas a processar (padrão: 10)
        forcar_reprocessamento: Se true, reprocessa mesmo faturas já extraídas

    Returns:
        Resultado do processamento com contadores e detalhes
    """
    filtros = {}
    if uc_id:
        filtros["uc_id"] = uc_id
    if mes_referencia:
        filtros["mes_referencia"] = mes_referencia
    if ano_referencia:
        filtros["ano_referencia"] = ano_referencia

    resultado = await faturas_service.processar_lote_faturas(filtros, limite, forcar_reprocessamento)
    return resultado


@router.get(
    "/{fatura_id}/dados-extraidos",
    summary="Obter dados já extraídos",
    description="Retorna dados estruturados já extraídos de uma fatura"
)
async def obter_dados_extraidos(
    fatura_id: int,
    current_user: Annotated[CurrentUser, Depends(get_current_active_user)],
):
    """
    Obtém dados já extraídos de uma fatura.

    Retorna None se a extração ainda não foi processada.
    """
    dados = await faturas_service.obter_dados_extraidos(fatura_id)

    if dados is None:
        return {
            "success": False,
            "message": "Dados ainda não extraídos ou extração falhou",
            "dados": None
        }

    return {
        "success": True,
        "fatura_id": fatura_id,
        "dados": dados
    }


@router.post(
    "/{fatura_id}/reprocessar-extracao",
    summary="Reprocessar extração",
    description="Força reprocessamento da extração mesmo que já tenha sido feita",
    dependencies=[Depends(require_perfil("superadmin", "gestor"))]
)
async def reprocessar_extracao(
    fatura_id: int,
    current_user: Annotated[CurrentUser, Depends(get_current_active_user)],
):
    """
    Reprocessa extração de uma fatura.

    Útil quando:
    - A extração anterior teve erro
    - O parser foi melhorado
    - Dados precisam ser atualizados
    """
    dados = await faturas_service.reprocessar_extracao(fatura_id)
    return {
        "success": True,
        "fatura_id": fatura_id,
        "message": "Extração reprocessada com sucesso",
        "dados": dados
    }
