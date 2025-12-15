"""
Faturas Router - Endpoints de Faturas
"""

from fastapi import APIRouter, Depends, Query, status, HTTPException
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
            # Extrair dados relevantes do JSON dados_extraidos
            dados_ex = fatura.get("dados_extraidos") or {}
            itens = dados_ex.get("itens_fatura") or {}
            totais = dados_ex.get("totais") or {}

            # Consumo
            consumo_obj = itens.get("consumo_kwh") or {}
            consumo_kwh = consumo_obj.get("quantidade")

            # Energia injetada total (oUC + mUC) - suporta ambos formatos de chave
            ouc_items = itens.get("energia_injetada oUC") or itens.get("energia_injetada_ouc") or []
            muc_items = itens.get("energia_injetada mUC") or itens.get("energia_injetada_muc") or []

            injetada_ouc = sum((item.get("quantidade") or 0) for item in ouc_items)
            injetada_muc = sum((item.get("quantidade") or 0) for item in muc_items)
            injetada_total = injetada_ouc + injetada_muc

            # Tipo GD (detectar dos itens)
            tipo_gd = None
            all_items = ouc_items + muc_items
            for item in all_items:
                if item.get("tipo_gd") in ["GDI", "GDII"]:
                    tipo_gd = item.get("tipo_gd")
                    break

            # Bandeira
            bandeira_valor = totais.get("adicionais_bandeira") or 0

            # Valor total fatura
            valor_fatura = dados_ex.get("total_a_pagar")

            faturas_com_benef.append({
                **fatura,
                "beneficiario": {
                    "id": beneficiario["id"],
                    "nome": beneficiario["nome"]
                },
                # Novos campos enriquecidos
                "consumo_kwh": consumo_kwh,
                "injetada_kwh": injetada_total if injetada_total > 0 else None,
                "tipo_gd": tipo_gd,
                "bandeira_valor": bandeira_valor,
                "valor_fatura": valor_fatura,
            })

    return {
        "faturas": faturas_com_benef,
        "total": len(faturas_com_benef)
    }


@router.get("/kanban-debug")
async def kanban_debug(
    current_user: Annotated[CurrentUser, Depends(get_current_active_user)],
    ano_referencia: Optional[int] = Query(None, ge=2000, le=2100, description="Ano para testar"),
):
    """Debug do kanban - retorna info detalhada sobre cada etapa."""
    import traceback

    resultado = {
        "status": "ok",
        "etapas": {},
        "user": {
            "id": str(current_user.id),
            "is_superadmin": current_user.is_superadmin,
            "perfis": current_user.perfis if hasattr(current_user, 'perfis') else []
        }
    }

    try:
        from backend.core.database import get_supabase_admin
        supabase = get_supabase_admin()
        resultado["etapas"]["conexao_db"] = {"status": "ok"}
    except Exception as e:
        resultado["etapas"]["conexao_db"] = {"status": "erro", "erro": str(e)}
        resultado["status"] = "erro"
        return resultado

    # Etapa 1: Buscar usinas
    try:
        gestores_response = supabase.table("gestores_usina").select(
            "usina_id"
        ).eq("usuario_id", str(current_user.id)).execute()

        usina_ids = [g["usina_id"] for g in (gestores_response.data or [])]

        if current_user.is_superadmin and not usina_ids:
            usinas_response = supabase.table("usinas").select("id").execute()
            usina_ids = [u["id"] for u in (usinas_response.data or [])]

        resultado["etapas"]["buscar_usinas"] = {
            "status": "ok",
            "usina_ids": usina_ids,
            "count": len(usina_ids)
        }
    except Exception as e:
        resultado["etapas"]["buscar_usinas"] = {"status": "erro", "erro": str(e), "traceback": traceback.format_exc()}
        resultado["status"] = "erro"
        return resultado

    if not usina_ids:
        resultado["etapas"]["buscar_usinas"]["aviso"] = "Nenhuma usina encontrada para este usuário"
        return resultado

    # Etapa 2: Buscar beneficiários
    try:
        benef_response = supabase.table("beneficiarios").select(
            "id, nome, uc_id, usina_id, status"
        ).in_("usina_id", usina_ids).execute()

        benef_data = benef_response.data or []
        status_values = list(set([b.get("status") for b in benef_data]))

        # Filtrar ativos
        beneficiarios_ativos = [
            b for b in benef_data
            if str(b.get("status", "")).upper() == "ATIVO"
        ]

        uc_ids = [b["uc_id"] for b in beneficiarios_ativos if b.get("uc_id")]

        resultado["etapas"]["buscar_beneficiarios"] = {
            "status": "ok",
            "total": len(benef_data),
            "ativos": len(beneficiarios_ativos),
            "status_values_encontrados": status_values,
            "uc_ids_count": len(uc_ids),
            "amostra": benef_data[:3] if benef_data else []
        }
    except Exception as e:
        resultado["etapas"]["buscar_beneficiarios"] = {"status": "erro", "erro": str(e), "traceback": traceback.format_exc()}
        resultado["status"] = "erro"
        return resultado

    if not uc_ids:
        resultado["etapas"]["buscar_beneficiarios"]["aviso"] = "Nenhum beneficiário ativo com UC encontrado"
        return resultado

    # Etapa 3: Buscar UCs
    try:
        ucs_response = supabase.table("unidades_consumidoras").select(
            "id, cdc, digito_verificador, apelido"
        ).in_("id", uc_ids[:10]).execute()  # Limitar a 10 para teste

        resultado["etapas"]["buscar_ucs"] = {
            "status": "ok",
            "count": len(ucs_response.data or []),
            "amostra": (ucs_response.data or [])[:2]
        }
    except Exception as e:
        resultado["etapas"]["buscar_ucs"] = {"status": "erro", "erro": str(e), "traceback": traceback.format_exc()}
        resultado["status"] = "erro"
        return resultado

    # Etapa 4: Buscar faturas
    try:
        query = supabase.table("faturas").select(
            "id, uc_id, mes_referencia, ano_referencia, extracao_status"
        ).in_("uc_id", uc_ids[:10])  # Limitar

        if ano_referencia:
            query = query.eq("ano_referencia", ano_referencia)

        faturas_response = query.limit(5).execute()

        resultado["etapas"]["buscar_faturas"] = {
            "status": "ok",
            "count": len(faturas_response.data or []),
            "amostra": (faturas_response.data or [])[:2]
        }
    except Exception as e:
        resultado["etapas"]["buscar_faturas"] = {"status": "erro", "erro": str(e), "traceback": traceback.format_exc()}
        resultado["status"] = "erro"
        return resultado

    # Etapa 5: Buscar cobranças
    try:
        fatura_ids = [f["id"] for f in (faturas_response.data or [])]
        if fatura_ids:
            cobrancas_response = supabase.table("cobrancas").select(
                "id, fatura_id, status"
            ).in_("fatura_id", fatura_ids).execute()

            resultado["etapas"]["buscar_cobrancas"] = {
                "status": "ok",
                "count": len(cobrancas_response.data or [])
            }
        else:
            resultado["etapas"]["buscar_cobrancas"] = {
                "status": "ok",
                "count": 0,
                "aviso": "Sem faturas para buscar cobranças"
            }
    except Exception as e:
        resultado["etapas"]["buscar_cobrancas"] = {"status": "erro", "erro": str(e), "traceback": traceback.format_exc()}
        resultado["status"] = "erro"
        return resultado

    resultado["conclusao"] = "Todas as etapas passaram com sucesso!"
    return resultado


@router.get(
    "/kanban",
    summary="Kanban de faturas",
    description="Retorna faturas organizadas por status para visualização Kanban"
)
async def listar_faturas_kanban(
    current_user: Annotated[CurrentUser, Depends(get_current_active_user)],
    usina_id: Optional[int] = Query(None, description="Filtrar por usina"),
    mes_referencia: Optional[int] = Query(None, ge=1, le=12, description="Mês de referência"),
    ano_referencia: Optional[int] = Query(None, ge=2000, le=2100, description="Ano de referência"),
    busca: Optional[str] = Query(None, description="Buscar por nome do beneficiário ou UC"),
):
    """
    Retorna faturas organizadas em colunas para Kanban.
    """
    import logging
    import traceback

    logger = logging.getLogger(__name__)
    etapa_atual = "inicio"
    logger.info(f"[KANBAN] Iniciando: user={current_user.id}, mes={mes_referencia}, ano={ano_referencia}")

    # Resposta vazia padrão
    empty_response = {
        "sem_pdf": [],
        "pdf_recebido": [],
        "extraida": [],
        "relatorio_gerado": [],
        "totais": {"sem_pdf": 0, "pdf_recebido": 0, "extraida": 0, "relatorio_gerado": 0}
    }

    try:
        etapa_atual = "conexao_db"
        from backend.core.database import get_supabase_admin
        supabase = get_supabase_admin()
        logger.info(f"[KANBAN] Conexão DB OK")

        # 1. Buscar usinas que o gestor tem acesso
        etapa_atual = "buscar_usinas"
        if usina_id:
            usina_ids = [usina_id]
        else:
            gestores_response = supabase.table("gestores_usina").select(
                "usina_id"
            ).eq("usuario_id", str(current_user.id)).execute()

            usina_ids = [g["usina_id"] for g in (gestores_response.data or [])]

            # Se superadmin, buscar todas
            if current_user.is_superadmin and not usina_ids:
                usinas_response = supabase.table("usinas").select("id").execute()
                usina_ids = [u["id"] for u in (usinas_response.data or [])]

        if not usina_ids:
            logger.info(f"[KANBAN] Nenhuma usina encontrada")
            return empty_response

        logger.info(f"[KANBAN] Usinas encontradas: {len(usina_ids)}")

        # 2. Buscar beneficiários das usinas
        etapa_atual = "buscar_beneficiarios"
        benef_response = supabase.table("beneficiarios").select(
            "id, nome, uc_id, usina_id, status"
        ).in_("usina_id", usina_ids).execute()

        # Filtrar ativos (case insensitive)
        beneficiarios_ativos = [
            b for b in (benef_response.data or [])
            if str(b.get("status", "")).upper() == "ATIVO"
        ]

        if not beneficiarios_ativos:
            logger.info(f"[KANBAN] Nenhum beneficiário ativo")
            return empty_response

        logger.info(f"[KANBAN] Beneficiários ativos: {len(beneficiarios_ativos)}")

        # Filtrar por busca se fornecido
        etapa_atual = "filtrar_busca"
        beneficiarios = beneficiarios_ativos
        busca_lower = ""
        if busca:
            busca_lower = busca.lower()
            beneficiarios = [
                b for b in beneficiarios
                if b.get("nome") and busca_lower in str(b["nome"]).lower()
            ]

        uc_ids = [b["uc_id"] for b in beneficiarios if b.get("uc_id")]
        benef_map = {b["uc_id"]: b for b in beneficiarios if b.get("uc_id")}

        if not uc_ids:
            logger.info(f"[KANBAN] Nenhuma UC encontrada")
            return empty_response

        logger.info(f"[KANBAN] UCs encontradas: {len(uc_ids)}")

        # 3. Buscar UCs para ter o código formatado
        etapa_atual = "buscar_ucs"
        ucs_response = supabase.table("unidades_consumidoras").select(
            "id, cdc, digito_verificador, apelido"
        ).in_("id", uc_ids).execute()

        uc_map = {}
        for uc in (ucs_response.data or []):
            uc_formatada = f"6/{uc['cdc']}-{uc['digito_verificador']}" if uc.get('cdc') else f"ID {uc['id']}"
            uc_map[uc["id"]] = {
                "uc_formatada": uc_formatada,
                "apelido": uc.get("apelido")
            }

        logger.info(f"[KANBAN] UCs mapeadas: {len(uc_map)}")

        # 4. Buscar faturas
        etapa_atual = "buscar_faturas"
        query = supabase.table("faturas").select(
            "id, uc_id, numero_fatura, mes_referencia, ano_referencia, pdf_base64, extracao_status, extracao_score, dados_extraidos"
        ).in_("uc_id", uc_ids)

        if mes_referencia:
            query = query.eq("mes_referencia", mes_referencia)
        if ano_referencia:
            query = query.eq("ano_referencia", ano_referencia)

        faturas_response = query.order("ano_referencia", desc=True).order("mes_referencia", desc=True).execute()
        logger.info(f"[KANBAN] Faturas encontradas: {len(faturas_response.data or [])}")

        # 5. Buscar cobranças existentes para essas faturas
        etapa_atual = "buscar_cobrancas"
        fatura_ids = [f["id"] for f in (faturas_response.data or [])]

        cobrancas_map = {}
        if fatura_ids:
            cobrancas_response = supabase.table("cobrancas").select(
                "id, fatura_id, status"
            ).in_("fatura_id", fatura_ids).execute()

            for c in (cobrancas_response.data or []):
                cobrancas_map[c["fatura_id"]] = {"id": c["id"], "status": c["status"]}
            logger.info(f"[KANBAN] Cobranças encontradas: {len(cobrancas_map)}")

        # 6. Classificar faturas por status
        etapa_atual = "classificar_faturas"
        sem_pdf = []
        pdf_recebido = []
        extraida = []
        relatorio_gerado = []

        for fatura in (faturas_response.data or []):
            beneficiario = benef_map.get(fatura["uc_id"])
            if not beneficiario:
                continue

            uc_info = uc_map.get(fatura["uc_id"], {})

            # Extrair dados se disponíveis
            dados_ex = fatura.get("dados_extraidos") or {}
            itens = dados_ex.get("itens_fatura") or {}

            consumo_obj = itens.get("consumo_kwh") or {}
            consumo_kwh = consumo_obj.get("quantidade")

            # Suportar ambos os formatos de chave
            ouc_items = itens.get("energia_injetada oUC") or itens.get("energia_injetada_ouc") or []
            muc_items = itens.get("energia_injetada mUC") or itens.get("energia_injetada_muc") or []

            injetada_ouc = sum((item.get("quantidade") or 0) for item in ouc_items)
            injetada_muc = sum((item.get("quantidade") or 0) for item in muc_items)
            injetada_total = injetada_ouc + injetada_muc

            tipo_gd = None
            for item in (ouc_items + muc_items):
                if item.get("tipo_gd") in ["GDI", "GDII"]:
                    tipo_gd = item.get("tipo_gd")
                    break

            valor_fatura = dados_ex.get("total_a_pagar")

            item_fatura = {
                "id": fatura["id"],
                "uc_id": fatura["uc_id"],
                "uc_formatada": uc_info.get("uc_formatada", f"ID {fatura['uc_id']}"),
                "uc_apelido": uc_info.get("apelido"),
                "numero_fatura": fatura.get("numero_fatura"),
                "mes_referencia": fatura["mes_referencia"],
                "ano_referencia": fatura["ano_referencia"],
                "beneficiario": {
                    "id": beneficiario["id"],
                    "nome": beneficiario.get("nome", "")
                },
                "usina_id": beneficiario.get("usina_id"),
                "extracao_status": fatura.get("extracao_status"),
                "extracao_score": fatura.get("extracao_score"),
                "consumo_kwh": consumo_kwh,
                "injetada_kwh": injetada_total if injetada_total > 0 else None,
                "tipo_gd": tipo_gd,
                "valor_fatura": valor_fatura,
                "cobranca": cobrancas_map.get(fatura["id"]),
                "tem_pdf": fatura.get("pdf_base64") is not None
            }

            # Filtrar por busca na UC
            if busca and busca_lower:
                uc_match = busca_lower in item_fatura["uc_formatada"].lower()
                nome_match = busca_lower in str(beneficiario.get("nome", "")).lower()
                if not uc_match and not nome_match:
                    continue

            # Classificar
            cobranca = cobrancas_map.get(fatura["id"])

            if cobranca:
                relatorio_gerado.append(item_fatura)
            elif fatura.get("extracao_status") == "CONCLUIDA":
                extraida.append(item_fatura)
            elif fatura.get("pdf_base64"):
                pdf_recebido.append(item_fatura)
            else:
                sem_pdf.append(item_fatura)

        return {
            "sem_pdf": sem_pdf,
            "pdf_recebido": pdf_recebido,
            "extraida": extraida,
            "relatorio_gerado": relatorio_gerado,
            "totais": {
                "sem_pdf": len(sem_pdf),
                "pdf_recebido": len(pdf_recebido),
                "extraida": len(extraida),
                "relatorio_gerado": len(relatorio_gerado)
            }
        }

    except Exception as e:
        logger.error(f"[KANBAN] Erro na etapa '{etapa_atual}': {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Erro na etapa '{etapa_atual}': {str(e)}")


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
