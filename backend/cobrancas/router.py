"""
Cobranças Router - Endpoints da API para Cobranças
"""

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import HTMLResponse
from typing import Optional, List, Annotated
from decimal import Decimal
from datetime import date
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


# ========== ENDPOINTS DE GERAÇÃO AUTOMÁTICA ==========

@router.post(
    "/gerar-automatica",
    response_model=CobrancaResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Gerar cobrança automática",
    description="Gera cobrança automaticamente a partir de fatura com dados extraídos",
    dependencies=[Depends(require_perfil("superadmin", "proprietario", "gestor"))]
)
async def gerar_cobranca_automatica(
    fatura_id: int = Query(..., description="ID da fatura"),
    beneficiario_id: int = Query(..., description="ID do beneficiário"),
    tarifa_aneel: Optional[Decimal] = Query(None, description="Tarifa ANEEL (R$/kWh). Se não fornecida, será extraída da fatura"),
    fio_b: Optional[Decimal] = Query(None, description="Valor do Fio B (opcional)"),
    forcar_reprocessamento: bool = Query(False, description="Se True, exclui cobrança existente e recria"),
    current_user: Annotated[CurrentUser, Depends(get_current_active_user)] = None,
):
    """
    Gera cobrança automaticamente a partir de fatura.

    Fluxo completo:
    1. Verifica se fatura tem dados extraídos (processa se necessário)
    2. Calcula cobrança usando CobrancaCalculator (GD I/II, 30% desconto)
    3. Gera relatório HTML profissional
    4. Salva no banco com status RASCUNHO

    Se forcar_reprocessamento=True, exclui a cobrança existente antes de criar nova.

    Args:
        fatura_id: ID da fatura de origem
        beneficiario_id: ID do beneficiário
        tarifa_aneel: Tarifa base (opcional, extrai da fatura se não fornecida)
        fio_b: Valor Fio B (opcional)
        forcar_reprocessamento: Se True, permite reprocessar mesmo se já existir cobrança

    Returns:
        Cobrança criada com todos os campos calculados
    """
    resultado = await service.gerar_cobranca_automatica(
        fatura_id=fatura_id,
        beneficiario_id=beneficiario_id,
        tarifa_aneel=tarifa_aneel,
        fio_b=fio_b,
        forcar_reprocessamento=forcar_reprocessamento
    )
    return resultado


@router.post(
    "/gerar-lote-usina",
    summary="Gerar cobranças em lote por usina",
    description="Gera cobranças automaticamente para todos beneficiários ativos de uma usina",
    dependencies=[Depends(require_perfil("superadmin", "proprietario", "gestor"))]
)
async def gerar_lote_usina(
    usina_id: int = Query(..., description="ID da usina"),
    mes_referencia: int = Query(..., ge=1, le=12, description="Mês de referência"),
    ano_referencia: int = Query(..., ge=2000, le=2100, description="Ano de referência"),
    tarifa_aneel: Optional[Decimal] = Query(None, description="Tarifa ANEEL (R$/kWh)"),
    fio_b: Optional[Decimal] = Query(None, description="Valor do Fio B"),
    current_user: Annotated[CurrentUser, Depends(get_current_active_user)] = None,
):
    """
    Gera cobranças em lote para todos beneficiários de uma usina.

    Para cada beneficiário ativo:
    - Busca fatura do mês/ano especificado
    - Verifica se já existe cobrança (pula se existir)
    - Gera cobrança automaticamente

    Args:
        usina_id: ID da usina
        mes_referencia: Mês (1-12)
        ano_referencia: Ano
        tarifa_aneel: Tarifa base (opcional)
        fio_b: Valor Fio B (opcional)

    Returns:
        Resumo com total processado, sucessos, erros e detalhes
    """
    resultado = await service.gerar_lote_usina_automatico(
        usina_id=usina_id,
        mes_referencia=mes_referencia,
        ano_referencia=ano_referencia,
        tarifa_aneel=tarifa_aneel,
        fio_b=fio_b
    )
    return resultado


@router.get(
    "/{cobranca_id}/relatorio-html",
    response_class=HTMLResponse,
    summary="Obter relatório HTML",
    description="Retorna o relatório HTML gerado da cobrança"
)
async def obter_relatorio_html(
    cobranca_id: int,
    current_user: Annotated[CurrentUser, Depends(get_current_active_user)] = None,
):
    """
    Retorna o relatório HTML da cobrança.

    O HTML já vem formatado e pronto para:
    - Visualização no navegador
    - Envio por email
    - Download como arquivo
    """
    html = await service.obter_html_relatorio(cobranca_id)

    if not html:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Relatório HTML não encontrado"
        )

    return HTMLResponse(content=html)


@router.put(
    "/{cobranca_id}/vencimento",
    response_model=CobrancaResponse,
    summary="Editar vencimento",
    description="Altera a data de vencimento de uma cobrança em rascunho",
    dependencies=[Depends(require_perfil("superadmin", "proprietario", "gestor"))]
)
async def editar_vencimento(
    cobranca_id: int,
    nova_data: date = Query(..., description="Nova data de vencimento"),
    current_user: Annotated[CurrentUser, Depends(get_current_active_user)] = None,
):
    """
    Edita o vencimento de uma cobrança.

    Só permite edição de cobranças com:
    - Status RASCUNHO
    - vencimento_editavel = true

    Args:
        cobranca_id: ID da cobrança
        nova_data: Nova data de vencimento

    Returns:
        Cobrança atualizada
    """
    resultado = await service.editar_vencimento(
        cobranca_id=cobranca_id,
        nova_data=nova_data,
        user_id=current_user.id,
        perfis=current_user.perfis
    )
    return resultado


@router.post(
    "/{cobranca_id}/aprovar",
    response_model=CobrancaResponse,
    summary="Aprovar cobrança",
    description="Aprova cobrança em rascunho e muda status para EMITIDA",
    dependencies=[Depends(require_perfil("superadmin", "proprietario", "gestor"))]
)
async def aprovar_cobranca(
    cobranca_id: int,
    enviar_email: bool = Query(False, description="Enviar email ao beneficiário após aprovar"),
    current_user: Annotated[CurrentUser, Depends(get_current_active_user)] = None,
):
    """
    Aprova cobrança em rascunho.

    Ações:
    - Valida que cobrança está em RASCUNHO
    - Muda status para EMITIDA
    - Define vencimento_editavel = false
    - Opcionalmente envia email ao beneficiário

    Args:
        cobranca_id: ID da cobrança
        enviar_email: Se true, envia relatório por email

    Returns:
        Cobrança aprovada
    """
    resultado = await service.aprovar_cobranca(
        cobranca_id=cobranca_id,
        enviar_email=enviar_email,
        user_id=current_user.id,
        perfis=current_user.perfis
    )
    return resultado
