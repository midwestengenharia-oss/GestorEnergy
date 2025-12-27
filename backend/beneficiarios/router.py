"""
Beneficiarios Router - Endpoints de Beneficiários de GD
"""

from fastapi import APIRouter, Depends, Query, status
from typing import Annotated, Optional
import math

from backend.beneficiarios.schemas import (
    BeneficiarioCreateRequest,
    BeneficiarioAvulsoCreateRequest,
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


@router.post(
    "/avulso",
    response_model=BeneficiarioResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Criar beneficiário avulso",
    description="Cadastra beneficiário para UC com GD por transferência de créditos",
    dependencies=[Depends(require_perfil("superadmin", "gestor", "proprietario"))]
)
async def criar_beneficiario_avulso(
    data: BeneficiarioAvulsoCreateRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_active_user)],
):
    """
    Cadastra um beneficiário avulso (GD por transferência de créditos).

    Usado quando uma UC possui créditos GD mas não participa do rateio de uma usina.
    Exemplo: créditos adquiridos por transferência de titularidade.

    - Não requer usina_id
    - tipo = 'AVULSO'
    - A UC deve ter flag tem_gd_avulso = true ou ter histórico em historico_gd
    """
    return await beneficiarios_service.criar_avulso(
        data=data,
        gestor_id=str(current_user.id)
    )


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


@router.get(
    "/portfolio/clientes",
    summary="Portfolio de Clientes",
    description="Lista clientes com UCs vinculadas e métricas consolidadas",
    dependencies=[Depends(require_perfil("superadmin", "gestor", "proprietario"))]
)
async def portfolio_clientes(
    current_user: Annotated[CurrentUser, Depends(get_current_active_user)],
    busca: Optional[str] = Query(None, description="Buscar por nome, CPF ou email"),
    usina_id: Optional[int] = Query(None, description="Filtrar por usina"),
):
    """
    Retorna visão cliente-cêntrica para gestão do portfolio.

    Cada cliente (beneficiário) inclui:
    - Dados de contato
    - UCs vinculadas
    - Métricas consolidadas (economia, faturas, cobranças)
    - Flag indicando se é cliente legado (sem lead) ou convertido
    """
    from backend.core.database import db_admin

    # 1. Buscar todos os beneficiários
    query = db_admin.beneficiarios().select(
        "id, nome, cpf, email, telefone, status, criado_em, economia_acumulada",
        "unidades_consumidoras!beneficiarios_uc_id_fkey(id, cod_empresa, cdc, digito_verificador, nome_titular, endereco, cidade, uf, apelido)",
        "usinas(id, nome)"
    )

    if usina_id:
        query = query.eq("usina_id", usina_id)

    if busca:
        busca_lower = busca.lower()
        query = query.or_(f"nome.ilike.%{busca}%,cpf.ilike.%{busca}%,email.ilike.%{busca}%")

    beneficiarios_response = query.execute()
    beneficiarios = beneficiarios_response.data or []

    if not beneficiarios:
        return {"clientes": []}

    # 2. Buscar leads associados aos beneficiários (para identificar origem)
    beneficiario_ids = [b["id"] for b in beneficiarios]
    leads_response = db_admin.table("leads").select(
        "id, nome, beneficiario_id, convertido_em"
    ).in_("beneficiario_id", beneficiario_ids).execute()

    leads_map = {}
    for lead in (leads_response.data or []):
        leads_map[lead["beneficiario_id"]] = {
            "id": lead["id"],
            "nome": lead["nome"],
            "convertido_em": lead.get("convertido_em")
        }

    # 3. Buscar cobranças para métricas (agrupadas por beneficiário)
    cobrancas_response = db_admin.cobrancas().select(
        "id, beneficiario_id, status, economia_mes, valor_total, criado_em"
    ).in_("beneficiario_id", beneficiario_ids).execute()

    # Agrupar cobranças por beneficiário
    cobrancas_por_benef = {}
    for cob in (cobrancas_response.data or []):
        bid = cob["beneficiario_id"]
        if bid not in cobrancas_por_benef:
            cobrancas_por_benef[bid] = []
        cobrancas_por_benef[bid].append(cob)

    # 4. Montar resposta
    clientes = []
    for b in beneficiarios:
        uc_data = b.get("unidades_consumidoras") or {}
        usina_data = b.get("usinas") or {}
        lead_info = leads_map.get(b["id"])
        cobrancas = cobrancas_por_benef.get(b["id"], [])

        # Calcular métricas
        economia_total = sum(float(c.get("economia_mes") or 0) for c in cobrancas)
        faturas_processadas = len([c for c in cobrancas if c.get("status") in ["ENVIADA", "PAGA"]])
        faturas_pendentes = len([c for c in cobrancas if c.get("status") == "PENDENTE"])
        ultima_cobranca = max([c.get("criado_em") for c in cobrancas], default=None) if cobrancas else None

        # Formatar UC
        uc_formatada = None
        if uc_data and uc_data.get("cod_empresa"):
            uc_formatada = f"{uc_data['cod_empresa']}/{uc_data['cdc']}-{uc_data['digito_verificador']}"

        cliente = {
            "id": b["id"],
            "nome": b.get("nome") or uc_data.get("nome_titular", "Sem nome"),
            "cpf": b.get("cpf"),
            "email": b.get("email"),
            "telefone": b.get("telefone"),
            "status": b.get("status"),
            "created_at": b.get("criado_em"),

            # Origem do cliente
            "origem": "LEAD" if lead_info else "LEGADO",
            "lead_id": lead_info.get("id") if lead_info else None,
            "convertido_em": lead_info.get("convertido_em") if lead_info else None,

            # UC vinculada
            "uc": {
                "id": uc_data.get("id"),
                "numero_uc": uc_formatada,
                "apelido": uc_data.get("apelido"),
                "nome_titular": uc_data.get("nome_titular"),
                "endereco": uc_data.get("endereco"),
                "cidade": uc_data.get("cidade"),
                "uf": uc_data.get("uf")
            } if uc_data else None,

            # Usina
            "usina": {
                "id": usina_data.get("id"),
                "nome": usina_data.get("nome")
            } if usina_data else None,

            # Métricas consolidadas (usa valor do banco, fallback para cálculo)
            "metricas": {
                "economia_acumulada": b.get("economia_acumulada") or economia_total,
                "faturas_processadas": faturas_processadas,
                "faturas_pendentes": faturas_pendentes,
                "total_cobrancas": len(cobrancas),
                "ultima_cobranca": ultima_cobranca
            }
        }

        clientes.append(cliente)

    # Ordenar por nome
    clientes.sort(key=lambda x: (x.get("nome") or "").lower())

    return {
        "clientes": clientes,
        "total": len(clientes)
    }
