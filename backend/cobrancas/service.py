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
