"""
Cobranças Service - Lógica de negócio para Cobranças
"""

from typing import Optional, List, Dict, Any
from datetime import date, datetime
from decimal import Decimal
from ..core.database import get_supabase_admin
from ..core.exceptions import NotFoundError, ValidationError, ForbiddenError
from .schemas import StatusCobranca, TipoCobranca


class CobrancasService:
    """Serviço para gerenciamento de cobranças"""

    def __init__(self):
        self.supabase = get_supabase_admin()

    async def listar(
        self,
        user_id: str,
        perfis: List[str],
        page: int = 1,
        per_page: int = 20,
        usina_id: Optional[int] = None,
        beneficiario_id: Optional[int] = None,
        status: Optional[str] = None,
        mes_referencia: Optional[int] = None,
        ano_referencia: Optional[int] = None
    ) -> Dict[str, Any]:
        """Lista cobranças com filtros e paginação"""

        query = self.supabase.table("cobrancas").select(
            "*, beneficiarios(id, nome, cpf, email, telefone)",
            count="exact"
        )

        # Filtros de acesso por perfil
        if "superadmin" not in perfis and "proprietario" not in perfis:
            if "gestor" in perfis:
                # Gestor vê cobranças das usinas que gerencia
                gestoes = self.supabase.table("gestores_usina").select("usina_id").eq("gestor_id", user_id).eq("ativo", True).execute()
                usina_ids = [g["usina_id"] for g in gestoes.data]
                if usina_ids:
                    # Buscar beneficiários dessas usinas
                    benefs = self.supabase.table("beneficiarios").select("id").in_("usina_id", usina_ids).execute()
                    benef_ids = [b["id"] for b in benefs.data] if benefs.data else []
                    if benef_ids:
                        query = query.in_("beneficiario_id", benef_ids)
                    else:
                        return {"cobrancas": [], "total": 0, "page": page, "per_page": per_page, "total_pages": 0}
                else:
                    return {"cobrancas": [], "total": 0, "page": page, "per_page": per_page, "total_pages": 0}
            elif "beneficiario" in perfis:
                # Beneficiário vê apenas suas cobranças
                beneficiarios = self.supabase.table("beneficiarios").select("id").eq("usuario_id", user_id).execute()
                benef_ids = [b["id"] for b in beneficiarios.data]
                if benef_ids:
                    query = query.in_("beneficiario_id", benef_ids)
                else:
                    return {"cobrancas": [], "total": 0, "page": page, "per_page": per_page, "total_pages": 0}
            else:
                return {"cobrancas": [], "total": 0, "page": page, "per_page": per_page, "total_pages": 0}

        # Filtros opcionais
        if usina_id:
            # Filtrar por usina através dos beneficiários
            benefs_usina = self.supabase.table("beneficiarios").select("id").eq("usina_id", usina_id).execute()
            benef_ids_usina = [b["id"] for b in benefs_usina.data] if benefs_usina.data else []
            if benef_ids_usina:
                query = query.in_("beneficiario_id", benef_ids_usina)
        if beneficiario_id:
            query = query.eq("beneficiario_id", beneficiario_id)
        if status:
            # Converter para uppercase para match com enum (PENDENTE, PAGA, etc.)
            query = query.eq("status", status.upper())
        if mes_referencia:
            query = query.eq("mes", mes_referencia)
        if ano_referencia:
            query = query.eq("ano", ano_referencia)

        # Paginação
        offset = (page - 1) * per_page
        query = query.order("ano", desc=True).order("mes", desc=True)
        query = query.range(offset, offset + per_page - 1)

        result = query.execute()
        total = result.count or 0
        total_pages = (total + per_page - 1) // per_page

        return {
            "cobrancas": result.data,
            "total": total,
            "page": page,
            "per_page": per_page,
            "total_pages": total_pages
        }

    async def buscar(self, cobranca_id: int, user_id: str, perfis: List[str]) -> Dict[str, Any]:
        """Busca cobrança por ID"""

        result = self.supabase.table("cobrancas").select(
            "*, beneficiarios(id, nome, cpf, email, telefone, usina_id), faturas(id, mes_referencia, ano_referencia, valor_fatura, consumo)"
        ).eq("id", cobranca_id).single().execute()

        if not result.data:
            raise NotFoundError("Cobrança não encontrada")

        # Verificar permissão de acesso
        if "superadmin" not in perfis and "proprietario" not in perfis:
            cobranca = result.data
            # Obter usina_id através do beneficiário
            beneficiario_data = cobranca.get("beneficiarios") or {}
            cobranca_usina_id = beneficiario_data.get("usina_id")

            if "gestor" in perfis:
                gestoes = self.supabase.table("gestores_usina").select("usina_id").eq("gestor_id", user_id).eq("ativo", True).execute()
                usina_ids = [g["usina_id"] for g in gestoes.data]
                if cobranca_usina_id not in usina_ids:
                    raise ForbiddenError("Acesso negado a esta cobrança")
            elif "beneficiario" in perfis:
                beneficiarios = self.supabase.table("beneficiarios").select("id").eq("usuario_id", user_id).execute()
                benef_ids = [b["id"] for b in beneficiarios.data]
                if cobranca.get("beneficiario_id") not in benef_ids:
                    raise ForbiddenError("Acesso negado a esta cobrança")
            else:
                raise ForbiddenError("Acesso negado")

        return result.data

    async def criar(self, data: Dict[str, Any], user_id: str) -> Dict[str, Any]:
        """Cria nova cobrança"""

        # Verificar se beneficiário existe
        beneficiario = self.supabase.table("beneficiarios").select("*, usinas(id, nome)").eq("id", data["beneficiario_id"]).single().execute()
        if not beneficiario.data:
            raise NotFoundError("Beneficiário não encontrado")

        # Calcular valores se não fornecidos
        valor_energia = Decimal(str(data["valor_energia_injetada"]))
        desconto_pct = Decimal(str(data["desconto_percentual"]))

        valor_desconto = data.get("valor_desconto") or valor_energia * desconto_pct
        valor_final = data.get("valor_final") or valor_energia - valor_desconto

        cobranca_data = {
            "beneficiario_id": data["beneficiario_id"],
            "fatura_id": data.get("fatura_id"),
            "tipo": data.get("tipo", TipoCobranca.BENEFICIO_GD.value),
            "mes": data["mes_referencia"],
            "ano": data["ano_referencia"],
            "valor_energia_injetada": float(valor_energia),
            "desconto_percentual": float(desconto_pct),
            "valor_desconto": float(valor_desconto),
            "valor_final": float(valor_final),
            "data_vencimento": str(data["data_vencimento"]),
            "status": StatusCobranca.PENDENTE.value,
            "observacoes": data.get("observacoes"),
            "criado_por": user_id
        }

        result = self.supabase.table("cobrancas").insert(cobranca_data).execute()
        return result.data[0]

    async def atualizar(self, cobranca_id: int, data: Dict[str, Any], user_id: str, perfis: List[str]) -> Dict[str, Any]:
        """Atualiza cobrança"""

        # Verificar se existe e tem permissão
        cobranca = await self.buscar(cobranca_id, user_id, perfis)

        # Não permitir atualizar cobrança paga
        if cobranca.get("status") == StatusCobranca.PAGA.value:
            raise ValidationError("Não é possível alterar cobrança já paga")

        update_data = {k: v for k, v in data.items() if v is not None}
        if "data_vencimento" in update_data:
            update_data["data_vencimento"] = str(update_data["data_vencimento"])
        update_data["atualizado_em"] = datetime.now().isoformat()

        result = self.supabase.table("cobrancas").update(update_data).eq("id", cobranca_id).execute()
        return result.data[0]

    async def registrar_pagamento(self, cobranca_id: int, data: Dict[str, Any], user_id: str, perfis: List[str]) -> Dict[str, Any]:
        """Registra pagamento de cobrança"""

        cobranca = await self.buscar(cobranca_id, user_id, perfis)

        if cobranca.get("status") == StatusCobranca.PAGA.value:
            raise ValidationError("Cobrança já foi paga")

        valor_pago = Decimal(str(data["valor_pago"]))
        valor_final = Decimal(str(cobranca.get("valor_final", 0)))

        # Determinar status
        if valor_pago >= valor_final:
            novo_status = StatusCobranca.PAGA.value
        else:
            novo_status = StatusCobranca.PARCIAL.value

        update_data = {
            "valor_pago": float(valor_pago),
            "data_pagamento": str(data["data_pagamento"]),
            "forma_pagamento": data.get("forma_pagamento"),
            "comprovante": data.get("comprovante"),
            "status": novo_status,
            "atualizado_em": datetime.now().isoformat()
        }

        if data.get("observacoes"):
            obs_anterior = cobranca.get("observacoes") or ""
            update_data["observacoes"] = f"{obs_anterior}\n[Pagamento] {data['observacoes']}".strip()

        result = self.supabase.table("cobrancas").update(update_data).eq("id", cobranca_id).execute()
        return result.data[0]

    async def cancelar(self, cobranca_id: int, motivo: str, user_id: str, perfis: List[str]) -> Dict[str, Any]:
        """Cancela cobrança"""

        cobranca = await self.buscar(cobranca_id, user_id, perfis)

        if cobranca.get("status") == StatusCobranca.PAGA.value:
            raise ValidationError("Não é possível cancelar cobrança já paga")

        update_data = {
            "status": StatusCobranca.CANCELADA.value,
            "observacoes": f"{cobranca.get('observacoes') or ''}\n[Cancelado] {motivo}".strip(),
            "atualizado_em": datetime.now().isoformat()
        }

        result = self.supabase.table("cobrancas").update(update_data).eq("id", cobranca_id).execute()
        return result.data[0]

    async def gerar_lote(self, data: Dict[str, Any], user_id: str, perfis: List[str]) -> Dict[str, Any]:
        """Gera cobranças em lote para uma usina"""

        usina_id = data["usina_id"]
        mes = data["mes_referencia"]
        ano = data["ano_referencia"]

        # Buscar beneficiários ativos da usina
        beneficiarios = self.supabase.table("beneficiarios").select(
            "*, ucs(id)"
        ).eq("usina_id", usina_id).eq("status", "ATIVO").execute()

        if not beneficiarios.data:
            raise ValidationError("Nenhum beneficiário ativo encontrado para esta usina")

        cobrancas_criadas = []
        erros = []

        for benef in beneficiarios.data:
            try:
                # Verificar se já existe cobrança para este mês
                if not data.get("sobrescrever_existentes"):
                    existente = self.supabase.table("cobrancas").select("id").eq(
                        "beneficiario_id", benef["id"]
                    ).eq("mes", mes).eq("ano", ano).execute()

                    if existente.data:
                        continue

                # Buscar fatura do beneficiário para o mês
                uc_id = benef.get("uc_id")
                fatura = None
                valor_energia = Decimal("0")

                if uc_id:
                    fatura_result = self.supabase.table("faturas").select("*").eq(
                        "uc_id", uc_id
                    ).eq("mes_referencia", mes).eq("ano_referencia", ano).single().execute()

                    if fatura_result.data:
                        fatura = fatura_result.data
                        valor_energia = Decimal(str(fatura.get("valor_fatura", 0)))

                desconto = Decimal(str(benef.get("desconto", 0.30)))
                valor_desconto = valor_energia * desconto
                valor_final = valor_energia - valor_desconto

                cobranca_data = {
                    "beneficiario_id": benef["id"],
                    "fatura_id": fatura["id"] if fatura else None,
                    "tipo": TipoCobranca.BENEFICIO_GD.value,
                    "mes": mes,
                    "ano": ano,
                    "valor_energia_injetada": float(valor_energia),
                    "desconto_percentual": float(desconto),
                    "valor_desconto": float(valor_desconto),
                    "valor_final": float(valor_final),
                    "data_vencimento": str(data["data_vencimento"]),
                    "status": StatusCobranca.PENDENTE.value,
                    "criado_por": user_id
                }

                result = self.supabase.table("cobrancas").insert(cobranca_data).execute()
                cobrancas_criadas.append(result.data[0])

            except Exception as e:
                erros.append({"beneficiario_id": benef["id"], "erro": str(e)})

        return {
            "cobrancas_criadas": len(cobrancas_criadas),
            "erros": erros,
            "cobrancas": cobrancas_criadas
        }

    async def estatisticas(
        self,
        user_id: str,
        perfis: List[str],
        usina_id: Optional[int] = None,
        ano: Optional[int] = None
    ) -> Dict[str, Any]:
        """Retorna estatísticas de cobranças"""

        # Se filtrar por usina, buscar beneficiários primeiro
        benef_ids = None
        if usina_id:
            benefs = self.supabase.table("beneficiarios").select("id").eq("usina_id", usina_id).execute()
            benef_ids = [b["id"] for b in benefs.data] if benefs.data else []
            if not benef_ids:
                return {
                    "total_cobrancas": 0,
                    "valor_total": 0.0,
                    "valor_pago": 0.0,
                    "valor_pendente": 0.0,
                    "cobrancas_pagas": 0,
                    "cobrancas_pendentes": 0,
                    "cobrancas_vencidas": 0,
                    "taxa_inadimplencia": 0.0
                }

        query = self.supabase.table("cobrancas").select("*")

        if benef_ids:
            query = query.in_("beneficiario_id", benef_ids)
        if ano:
            query = query.eq("ano", ano)

        result = query.execute()
        cobrancas = result.data

        total = len(cobrancas)
        valor_total = sum(Decimal(str(c.get("valor_final", 0))) for c in cobrancas)
        valor_pago = sum(Decimal(str(c.get("valor_pago", 0))) for c in cobrancas if c.get("valor_pago"))

        pagas = len([c for c in cobrancas if c.get("status") == StatusCobranca.PAGA.value])
        pendentes = len([c for c in cobrancas if c.get("status") == StatusCobranca.PENDENTE.value])
        vencidas = len([c for c in cobrancas if c.get("status") == StatusCobranca.VENCIDA.value])

        taxa_inadimplencia = Decimal("0")
        if total > 0:
            taxa_inadimplencia = Decimal(str(vencidas)) / Decimal(str(total)) * 100

        return {
            "total_cobrancas": total,
            "valor_total": float(valor_total),
            "valor_pago": float(valor_pago),
            "valor_pendente": float(valor_total - valor_pago),
            "cobrancas_pagas": pagas,
            "cobrancas_pendentes": pendentes,
            "cobrancas_vencidas": vencidas,
            "taxa_inadimplencia": float(taxa_inadimplencia)
        }

    async def minhas_cobrancas(self, user_id: str) -> List[Dict[str, Any]]:
        """Lista cobranças do beneficiário logado"""

        # Buscar beneficiários do usuário
        beneficiarios = self.supabase.table("beneficiarios").select("id").eq("usuario_id", user_id).execute()

        if not beneficiarios.data:
            return []

        benef_ids = [b["id"] for b in beneficiarios.data]

        result = self.supabase.table("cobrancas").select(
            "*, beneficiarios(id, nome, usina_id, usinas(nome))"
        ).in_("beneficiario_id", benef_ids).order("ano", desc=True).order("mes", desc=True).execute()

        return result.data

    # ========== GERAÇÃO AUTOMÁTICA DE COBRANÇAS ==========

    async def gerar_cobranca_automatica(
        self,
        fatura_id: int,
        beneficiario_id: int,
        tarifa_aneel: Optional[Decimal] = None,
        fio_b: Optional[Decimal] = None
    ) -> dict:
        """
        Gera cobrança automaticamente a partir de uma fatura.

        Fluxo completo:
        1. Verifica/processa extração da fatura
        2. Busca dados do beneficiário e UC
        3. Calcula cobrança usando dados extraídos
        4. Gera relatório HTML
        5. Prepara PIX
        6. Salva no banco com status RASCUNHO

        Args:
            fatura_id: ID da fatura
            beneficiario_id: ID do beneficiário
            tarifa_aneel: Tarifa ANEEL (busca automaticamente se não informada)
            fio_b: Valor Fio B (opcional)

        Returns:
            Dados da cobrança criada

        Raises:
            NotFoundError: Se fatura ou beneficiário não existir
            ValidationError: Se dados estiverem incompletos
        """
        from backend.faturas.service import faturas_service
        from backend.faturas.extraction_schemas import FaturaExtraidaSchema
        from backend.cobrancas.calculator import CobrancaCalculator
        from backend.cobrancas.report_generator_v3 import report_generator_v3
        from backend.core.exceptions import NotFoundError, ValidationError

        # 1. Verificar se fatura existe e tem dados extraídos
        fatura_result = self.supabase.table("faturas").select(
            "id, uc_id, dados_extraidos, extracao_status, qr_code_pix, qr_code_pix_image, numero_fatura, mes_referencia, ano_referencia"
        ).eq("id", fatura_id).single().execute()

        if not fatura_result.data:
            raise NotFoundError(f"Fatura {fatura_id} não encontrada")

        fatura = fatura_result.data

        # Se não tem dados extraídos, processar
        if not fatura.get("dados_extraidos") or fatura["extracao_status"] != "CONCLUIDA":
            logger.info(f"Processando extração da fatura {fatura_id} antes de gerar cobrança")
            await faturas_service.processar_extracao_fatura(fatura_id)

            # Recarregar fatura com dados extraídos
            fatura_result = self.supabase.table("faturas").select(
                "id, uc_id, dados_extraidos, extracao_status, qr_code_pix, qr_code_pix_image, numero_fatura, mes_referencia, ano_referencia"
            ).eq("id", fatura_id).single().execute()
            fatura = fatura_result.data

        # Validar dados extraídos
        try:
            dados_extraidos = FaturaExtraidaSchema(**fatura["dados_extraidos"])
        except Exception as e:
            raise ValidationError(f"Dados extraídos inválidos: {str(e)}")

        # 2. Buscar beneficiário
        benef_result = self.supabase.table("beneficiarios").select(
            "*, unidades_consumidoras!beneficiarios_uc_id_fkey(id, cod_empresa, cdc, digito_verificador, cidade, uf)"
        ).eq("id", beneficiario_id).single().execute()

        if not benef_result.data:
            raise NotFoundError(f"Beneficiário {beneficiario_id} não encontrado")

        beneficiario = benef_result.data
        uc = beneficiario.get("unidades_consumidoras")

        # 2.1 Verificar se já existe cobrança para este beneficiário/mês/ano
        mes_ref = fatura.get("mes_referencia")
        ano_ref = fatura.get("ano_referencia")

        cobranca_existente = self.supabase.table("cobrancas").select("id").eq(
            "beneficiario_id", beneficiario_id
        ).eq("mes", mes_ref).eq("ano", ano_ref).execute()

        if cobranca_existente.data and len(cobranca_existente.data) > 0:
            raise ValidationError(
                f"Já existe uma cobrança para o beneficiário {beneficiario_id} "
                f"no período {mes_ref:02d}/{ano_ref}"
            )

        # 3. Obter tarifa ANEEL se não informada
        if not tarifa_aneel:
            # TODO: Integrar com calculadora ANEEL existente
            # Por enquanto, usar tarifa extraída da fatura ou padrão
            tarifa_aneel = Decimal("0.76")  # Fallback

            # Tentar calcular da fatura
            if dados_extraidos.itens_fatura.consumo_kwh:
                consumo_item = dados_extraidos.itens_fatura.consumo_kwh
                if consumo_item.preco_unit_com_tributos:
                    tarifa_aneel = consumo_item.preco_unit_com_tributos

        # 4. Calcular cobrança
        calculator = CobrancaCalculator()

        # Validar dados mínimos
        valido, erro = calculator.validar_dados_minimos(dados_extraidos)
        if not valido:
            raise ValidationError(f"Dados da fatura incompletos: {erro}")

        cobranca_calc = calculator.calcular_cobranca(
            dados_extraidos=dados_extraidos,
            tarifa_aneel=tarifa_aneel,
            fio_b=fio_b
        )

        # 5. Gerar relatório HTML (usando V3 baseado no código n8n)
        # Buscar economia acumulada do beneficiário (se houver)
        economia_acumulada = 0.0
        if beneficiario.get("economia_acumulada"):
            economia_acumulada = float(beneficiario.get("economia_acumulada", 0))

        html_relatorio = report_generator_v3.gerar_html(
            cobranca=cobranca_calc,
            dados_fatura=dados_extraidos,
            beneficiario={
                "nome": beneficiario.get("nome"),
                "endereco": beneficiario.get("endereco"),
                "numero": beneficiario.get("numero"),
                "cidade": uc.get("cidade") if uc else None
            },
            qr_code_pix=fatura.get("qr_code_pix_image"),
            pix_copia_cola=fatura.get("qr_code_pix"),
            economia_acumulada=economia_acumulada
        )

        # 6. Preparar dados para salvar
        from datetime import datetime, timezone

        cobranca_data = {
            "beneficiario_id": beneficiario_id,
            "fatura_id": fatura_id,
            "fatura_dados_extraidos_id": fatura_id,

            "mes": fatura["mes_referencia"],
            "ano": fatura["ano_referencia"],

            # Modelo GD
            "tipo_modelo_gd": cobranca_calc.modelo_gd,
            "tipo_ligacao": cobranca_calc.tipo_ligacao,

            # Métricas
            "consumo_kwh": int(cobranca_calc.consumo_kwh),
            "injetada_kwh": int(cobranca_calc.injetada_kwh),
            "compensado_kwh": int(cobranca_calc.compensado_kwh),
            "gap_kwh": int(cobranca_calc.gap_kwh),

            # Tarifas
            "tarifa_base": float(cobranca_calc.tarifa_base),
            "tarifa_assinatura": float(cobranca_calc.tarifa_assinatura),
            "fio_b_valor": float(cobranca_calc.fio_b) if cobranca_calc.fio_b else None,

            # Valores energia
            "valor_energia_base": float(cobranca_calc.valor_energia_base),
            "valor_energia_assinatura": float(cobranca_calc.valor_energia_assinatura),

            # GD I
            "taxa_minima_kwh": cobranca_calc.taxa_minima_kwh if cobranca_calc.taxa_minima_kwh > 0 else None,
            "taxa_minima_valor": float(cobranca_calc.taxa_minima_valor) if cobranca_calc.taxa_minima_valor > 0 else None,
            "energia_excedente_kwh": cobranca_calc.energia_excedente_kwh if cobranca_calc.energia_excedente_kwh > 0 else None,
            "energia_excedente_valor": float(cobranca_calc.energia_excedente_valor) if cobranca_calc.energia_excedente_valor > 0 else None,

            # GD II
            "disponibilidade_valor": float(cobranca_calc.disponibilidade_valor) if cobranca_calc.disponibilidade_valor > 0 else None,

            # Extras
            "bandeiras_valor": float(cobranca_calc.bandeiras_valor),
            "iluminacao_publica_valor": float(cobranca_calc.iluminacao_publica_valor),
            "servicos_valor": float(cobranca_calc.servicos_valor),

            # Totais
            "valor_sem_assinatura": float(cobranca_calc.valor_sem_assinatura),
            "valor_com_assinatura": float(cobranca_calc.valor_com_assinatura),
            "economia_mes": float(cobranca_calc.economia_mes),
            "valor_total": float(cobranca_calc.valor_total),

            # PIX
            "qr_code_pix": fatura.get("qr_code_pix"),
            "qr_code_pix_image": fatura.get("qr_code_pix_image"),

            # Relatório
            "html_relatorio": html_relatorio,

            # Vencimento
            "vencimento": cobranca_calc.vencimento.isoformat() if cobranca_calc.vencimento else None,
            "vencimento_editavel": True,

            # Status
            "status": "RASCUNHO",
            "data_calculo": datetime.now(timezone.utc).isoformat()
        }

        # 7. Salvar no banco
        result = self.supabase.table("cobrancas").insert(cobranca_data).execute()

        if not result.data:
            raise ValidationError("Erro ao salvar cobrança no banco")

        cobranca_criada = result.data[0]

        logger.info(
            f"Cobrança gerada automaticamente - ID: {cobranca_criada['id']}, "
            f"Beneficiário: {beneficiario_id}, Fatura: {fatura_id}, "
            f"Total: R$ {cobranca_calc.valor_total:.2f}"
        )

        return cobranca_criada

    async def gerar_lote_usina_automatico(
        self,
        usina_id: int,
        mes_referencia: int,
        ano_referencia: int,
        tarifa_aneel: Optional[Decimal] = None,
        fio_b: Optional[Decimal] = None
    ) -> dict:
        """
        Gera cobranças automaticamente para todos os beneficiários de uma usina.

        Args:
            usina_id: ID da usina
            mes_referencia: Mês de referência
            ano_referencia: Ano de referência
            tarifa_aneel: Tarifa ANEEL opcional (R$/kWh)
            fio_b: Valor do Fio B opcional

        Returns:
            Resultado do processamento em lote
        """
        from backend.core.exceptions import NotFoundError

        # 1. Buscar beneficiários ativos da usina
        benef_result = self.supabase.table("beneficiarios").select(
            "id, nome, uc_id"
        ).eq("usina_id", usina_id).eq("status", "ATIVO").execute()

        if not benef_result.data:
            return {
                "total": 0,
                "processadas": 0,
                "sucesso": 0,
                "erro": 0,
                "ja_existentes": 0,
                "resultados": []
            }

        beneficiarios = benef_result.data

        resultados = []
        sucesso_count = 0
        erro_count = 0
        ja_existentes_count = 0

        # 2. Para cada beneficiário
        for benef in beneficiarios:
            try:
                # Verificar se já existe cobrança para este período
                existe = self.supabase.table("cobrancas").select("id").eq(
                    "beneficiario_id", benef["id"]
                ).eq("mes", mes_referencia).eq("ano", ano_referencia).execute()

                if existe.data:
                    ja_existentes_count += 1
                    resultados.append({
                        "beneficiario_id": benef["id"],
                        "beneficiario_nome": benef["nome"],
                        "status": "ja_existe",
                        "cobranca_id": existe.data[0]["id"]
                    })
                    continue

                # Buscar fatura do beneficiário para o período
                fatura_result = self.supabase.table("faturas").select("id").eq(
                    "uc_id", benef["uc_id"]
                ).eq("mes_referencia", mes_referencia).eq("ano_referencia", ano_referencia).execute()

                if not fatura_result.data:
                    erro_count += 1
                    resultados.append({
                        "beneficiario_id": benef["id"],
                        "beneficiario_nome": benef["nome"],
                        "status": "erro",
                        "erro": "Fatura não encontrada para o período"
                    })
                    continue

                fatura_id = fatura_result.data[0]["id"]

                # Gerar cobrança
                cobranca = await self.gerar_cobranca_automatica(
                    fatura_id=fatura_id,
                    beneficiario_id=benef["id"]
                )

                sucesso_count += 1
                resultados.append({
                    "beneficiario_id": benef["id"],
                    "beneficiario_nome": benef["nome"],
                    "status": "sucesso",
                    "cobranca_id": cobranca["id"],
                    "valor_total": cobranca["valor_total"]
                })

            except Exception as e:
                erro_count += 1
                resultados.append({
                    "beneficiario_id": benef["id"],
                    "beneficiario_nome": benef["nome"],
                    "status": "erro",
                    "erro": str(e)
                })

        return {
            "total": len(beneficiarios),
            "processadas": len(resultados),
            "sucesso": sucesso_count,
            "erro": erro_count,
            "ja_existentes": ja_existentes_count,
            "resultados": resultados
        }

    async def obter_html_relatorio(self, cobranca_id: int) -> Optional[str]:
        """
        Obtém o relatório HTML de uma cobrança.

        Args:
            cobranca_id: ID da cobrança

        Returns:
            HTML do relatório ou None se não existir
        """
        response = self.supabase.table("cobrancas").select(
            "html_relatorio"
        ).eq("id", cobranca_id).execute()

        if not response.data or len(response.data) == 0:
            return None

        return response.data[0].get("html_relatorio")

    async def editar_vencimento(
        self,
        cobranca_id: int,
        nova_data: date,
        user_id: str,
        perfis: list[str]
    ) -> dict:
        """
        Edita o vencimento de uma cobrança em rascunho.

        Args:
            cobranca_id: ID da cobrança
            nova_data: Nova data de vencimento
            user_id: ID do usuário que está editando
            perfis: Perfis do usuário

        Returns:
            Cobrança atualizada

        Raises:
            HTTPException: Se cobrança não encontrada, não editável ou sem permissão
        """
        from fastapi import HTTPException

        # Buscar cobrança
        response = self.supabase.table("cobrancas").select(
            "*, beneficiarios!inner(usina_id, usinas!inner(*))"
        ).eq("id", cobranca_id).execute()

        if not response.data or len(response.data) == 0:
            raise HTTPException(
                status_code=404,
                detail="Cobrança não encontrada"
            )

        cobranca = response.data[0]

        # Verificar permissões (gestor só edita suas usinas)
        if not self._pode_gerenciar_cobranca(cobranca, user_id, perfis):
            raise HTTPException(
                status_code=403,
                detail="Sem permissão para editar esta cobrança"
            )

        # Verificar se está em rascunho
        if cobranca["status"] != "RASCUNHO":
            raise HTTPException(
                status_code=400,
                detail="Só é possível editar vencimento de cobranças em rascunho"
            )

        # Verificar se vencimento é editável
        if not cobranca.get("vencimento_editavel", True):
            raise HTTPException(
                status_code=400,
                detail="Vencimento desta cobrança não pode ser editado"
            )

        # Atualizar vencimento
        update_response = self.supabase.table("cobrancas").update({
            "vencimento": nova_data.isoformat(),
            "updated_at": "now()"
        }).eq("id", cobranca_id).execute()

        logger.info(f"Vencimento da cobrança {cobranca_id} atualizado para {nova_data}")

        # Retornar cobrança atualizada
        return await self.buscar(cobranca_id, user_id, perfis)

    async def aprovar_cobranca(
        self,
        cobranca_id: int,
        enviar_email: bool,
        user_id: str,
        perfis: list[str]
    ) -> dict:
        """
        Aprova uma cobrança em rascunho.

        Args:
            cobranca_id: ID da cobrança
            enviar_email: Se deve enviar email ao beneficiário
            user_id: ID do usuário aprovando
            perfis: Perfis do usuário

        Returns:
            Cobrança aprovada

        Raises:
            HTTPException: Se cobrança não encontrada, já aprovada ou sem permissão
        """
        from fastapi import HTTPException

        # Buscar cobrança
        response = self.supabase.table("cobrancas").select(
            "*, beneficiarios!inner(usina_id, usinas!inner(*), user_id, usuarios!inner(email))"
        ).eq("id", cobranca_id).execute()

        if not response.data or len(response.data) == 0:
            raise HTTPException(
                status_code=404,
                detail="Cobrança não encontrada"
            )

        cobranca = response.data[0]

        # Verificar permissões
        if not self._pode_gerenciar_cobranca(cobranca, user_id, perfis):
            raise HTTPException(
                status_code=403,
                detail="Sem permissão para aprovar esta cobrança"
            )

        # Verificar se está em rascunho
        if cobranca["status"] != "RASCUNHO":
            raise HTTPException(
                status_code=400,
                detail=f"Cobrança já foi aprovada (status: {cobranca['status']})"
            )

        # Atualizar para EMITIDA
        update_response = self.supabase.table("cobrancas").update({
            "status": "EMITIDA",
            "vencimento_editavel": False,
            "data_emissao": "now()",
            "updated_at": "now()"
        }).eq("id", cobranca_id).execute()

        logger.info(f"Cobrança {cobranca_id} aprovada e emitida")

        # Enviar email se solicitado
        if enviar_email:
            try:
                await self._enviar_email_cobranca(cobranca)
                logger.info(f"Email enviado para cobrança {cobranca_id}")
            except Exception as e:
                logger.error(f"Erro ao enviar email da cobrança {cobranca_id}: {e}")
                # Não falha a aprovação por erro no email

        # Retornar cobrança atualizada
        return await self.buscar(cobranca_id, user_id, perfis)

    def _pode_gerenciar_cobranca(self, cobranca: dict, user_id: str, perfis: list[str]) -> bool:
        """
        Verifica se usuário tem permissão para gerenciar a cobrança.

        Args:
            cobranca: Dados da cobrança (com join de beneficiarios.usinas)
            user_id: ID do usuário
            perfis: Perfis do usuário

        Returns:
            True se pode gerenciar, False caso contrário
        """
        # Superadmin e proprietário podem tudo
        if "superadmin" in perfis or "proprietario" in perfis:
            return True

        # Gestor só pode gerenciar cobranças de suas usinas
        if "gestor" in perfis:
            try:
                usina = cobranca.get("beneficiarios", {}).get("usinas", {})
                usina_id = usina.get("id")

                # Verificar se gestor tem acesso a esta usina
                check_response = self.supabase.table("usinas_gestores").select(
                    "id"
                ).eq("usina_id", usina_id).eq("usuario_id", user_id).execute()

                return len(check_response.data) > 0
            except Exception as e:
                logger.error(f"Erro ao verificar permissão de gestor: {e}")
                return False

        return False

    async def _enviar_email_cobranca(self, cobranca: dict):
        """
        Envia email com cobrança para o beneficiário.

        TODO: Integrar com serviço de email (SendGrid, AWS SES, etc)

        Args:
            cobranca: Dados da cobrança (com join de beneficiarios.usuarios)
        """
        beneficiario = cobranca.get("beneficiarios", {})
        usuario = beneficiario.get("usuarios", {})
        email_destinatario = usuario.get("email")

        if not email_destinatario:
            logger.warning("Beneficiário sem email cadastrado, impossível enviar cobrança")
            return

        html_relatorio = cobranca.get("html_relatorio")
        valor_total = cobranca.get("valor_total")
        vencimento = cobranca.get("vencimento")

        logger.info(
            f"TODO: Enviar email para {email_destinatario} - "
            f"Valor: R$ {valor_total:.2f}, Vencimento: {vencimento}"
        )

        # TODO: Implementar envio de email
        # Exemplo com SendGrid:
        # from sendgrid import SendGridAPIClient
        # from sendgrid.helpers.mail import Mail
        #
        # message = Mail(
        #     from_email='noreply@suaempresa.com',
        #     to_emails=email_destinatario,
        #     subject=f'Cobrança - Vencimento {vencimento}',
        #     html_content=html_relatorio
        # )
        # sg = SendGridAPIClient(os.environ.get('SENDGRID_API_KEY'))
        # response = sg.send(message)

        pass
