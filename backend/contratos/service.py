"""
Contratos Service - Lógica de negócio para Contratos
"""

from typing import Optional, List, Dict, Any
from datetime import date, datetime
from decimal import Decimal
import hashlib
import uuid
from ..core.database import get_supabase_admin
from ..core.exceptions import NotFoundError, ValidationError, ForbiddenError
from .schemas import StatusContrato, TipoContrato


class ContratosService:
    """Serviço para gerenciamento de contratos"""

    def __init__(self):
        self.supabase = get_supabase_admin()

    def _gerar_numero_contrato(self, tipo: str) -> str:
        """Gera número único do contrato"""
        prefixo = {
            TipoContrato.BENEFICIO_GD.value: "BGD",
            TipoContrato.GESTAO_USINA.value: "GUS",
            TipoContrato.PARCERIA.value: "PAR",
            TipoContrato.OUTROS.value: "OUT"
        }.get(tipo, "CTR")

        ano = datetime.now().year
        uid = str(uuid.uuid4())[:8].upper()
        return f"{prefixo}-{ano}-{uid}"

    async def listar(
        self,
        user_id: str,
        perfis: List[str],
        page: int = 1,
        per_page: int = 20,
        usina_id: Optional[int] = None,
        beneficiario_id: Optional[int] = None,
        status: Optional[str] = None,
        tipo: Optional[str] = None
    ) -> Dict[str, Any]:
        """Lista contratos com filtros e paginação"""

        query = self.supabase.table("contratos").select(
            "*, beneficiarios(id, nome, cpf, email), usinas(id, nome, capacidade_kwp)",
            count="exact"
        )

        # Filtros de acesso por perfil
        if "superadmin" not in perfis and "proprietario" not in perfis:
            if "gestor" in perfis:
                gestoes = self.supabase.table("gestores_usina").select("usina_id").eq("gestor_id", user_id).eq("ativo", True).execute()
                usina_ids = [g["usina_id"] for g in gestoes.data]
                if usina_ids:
                    query = query.in_("usina_id", usina_ids)
                else:
                    return {"contratos": [], "total": 0, "page": page, "per_page": per_page, "total_pages": 0}
            elif "beneficiario" in perfis:
                beneficiarios = self.supabase.table("beneficiarios").select("id").eq("usuario_id", user_id).execute()
                benef_ids = [b["id"] for b in beneficiarios.data]
                if benef_ids:
                    query = query.in_("beneficiario_id", benef_ids)
                else:
                    return {"contratos": [], "total": 0, "page": page, "per_page": per_page, "total_pages": 0}
            elif "parceiro" in perfis:
                query = query.eq("parceiro_id", user_id)
            else:
                return {"contratos": [], "total": 0, "page": page, "per_page": per_page, "total_pages": 0}

        # Filtros opcionais
        if usina_id:
            query = query.eq("usina_id", usina_id)
        if beneficiario_id:
            query = query.eq("beneficiario_id", beneficiario_id)
        if status:
            query = query.eq("status", status)
        if tipo:
            query = query.eq("tipo", tipo)

        # Paginação
        offset = (page - 1) * per_page
        query = query.order("criado_em", desc=True)
        query = query.range(offset, offset + per_page - 1)

        result = query.execute()
        total = result.count or 0
        total_pages = (total + per_page - 1) // per_page

        return {
            "contratos": result.data,
            "total": total,
            "page": page,
            "per_page": per_page,
            "total_pages": total_pages
        }

    async def buscar(self, contrato_id: int, user_id: str, perfis: List[str]) -> Dict[str, Any]:
        """Busca contrato por ID"""

        result = self.supabase.table("contratos").select(
            "*, beneficiarios(id, nome, cpf, email), usinas(id, nome, capacidade_kwp)"
        ).eq("id", contrato_id).single().execute()

        if not result.data:
            raise NotFoundError("Contrato não encontrado")

        contrato = result.data

        # Verificar permissão de acesso
        if "superadmin" not in perfis and "proprietario" not in perfis:
            if "gestor" in perfis:
                gestoes = self.supabase.table("gestores_usina").select("usina_id").eq("gestor_id", user_id).eq("ativo", True).execute()
                usina_ids = [g["usina_id"] for g in gestoes.data]
                if contrato.get("usina_id") not in usina_ids:
                    raise ForbiddenError("Acesso negado a este contrato")
            elif "beneficiario" in perfis:
                beneficiarios = self.supabase.table("beneficiarios").select("id").eq("usuario_id", user_id).execute()
                benef_ids = [b["id"] for b in beneficiarios.data]
                if contrato.get("beneficiario_id") not in benef_ids:
                    raise ForbiddenError("Acesso negado a este contrato")
            elif "parceiro" in perfis:
                if contrato.get("parceiro_id") != user_id:
                    raise ForbiddenError("Acesso negado a este contrato")
            else:
                raise ForbiddenError("Acesso negado")

        return contrato

    async def criar(self, data: Dict[str, Any], user_id: str) -> Dict[str, Any]:
        """Cria novo contrato"""

        tipo = data.get("tipo", TipoContrato.BENEFICIO_GD.value)

        # Validar partes do contrato
        if data.get("beneficiario_id"):
            benef = self.supabase.table("beneficiarios").select("id, usina_id").eq("id", data["beneficiario_id"]).single().execute()
            if not benef.data:
                raise NotFoundError("Beneficiário não encontrado")
            data["usina_id"] = data.get("usina_id") or benef.data.get("usina_id")

        if data.get("usina_id"):
            usina = self.supabase.table("usinas").select("id").eq("id", data["usina_id"]).single().execute()
            if not usina.data:
                raise NotFoundError("Usina não encontrada")

        # Calcular data fim se não fornecida
        if not data.get("data_fim") and data.get("prazo_meses"):
            from dateutil.relativedelta import relativedelta
            data_inicio = data["data_inicio"]
            if isinstance(data_inicio, str):
                data_inicio = date.fromisoformat(data_inicio)
            data["data_fim"] = data_inicio + relativedelta(months=data["prazo_meses"])

        contrato_data = {
            "tipo": tipo,
            "numero_contrato": self._gerar_numero_contrato(tipo),
            "beneficiario_id": data.get("beneficiario_id"),
            "usina_id": data.get("usina_id"),
            "parceiro_id": data.get("parceiro_id"),
            "desconto_percentual": float(data["desconto_percentual"]),
            "taxa_administrativa": float(data["taxa_administrativa"]) if data.get("taxa_administrativa") else None,
            "prazo_meses": data.get("prazo_meses", 12),
            "data_inicio": str(data["data_inicio"]),
            "data_fim": str(data["data_fim"]) if data.get("data_fim") else None,
            "valor_adesao": float(data["valor_adesao"]) if data.get("valor_adesao") else None,
            "multa_rescisao": float(data["multa_rescisao"]) if data.get("multa_rescisao") else None,
            "status": StatusContrato.RASCUNHO.value,
            "clausulas": data.get("clausulas"),
            "observacoes": data.get("observacoes"),
            "criado_por": user_id
        }

        result = self.supabase.table("contratos").insert(contrato_data).execute()
        return result.data[0]

    async def atualizar(self, contrato_id: int, data: Dict[str, Any], user_id: str, perfis: List[str]) -> Dict[str, Any]:
        """Atualiza contrato"""

        contrato = await self.buscar(contrato_id, user_id, perfis)

        # Não permitir atualizar contrato ativo ou encerrado
        if contrato.get("status") in [StatusContrato.ATIVO.value, StatusContrato.ENCERRADO.value]:
            raise ValidationError("Não é possível alterar contrato ativo ou encerrado")

        update_data = {k: v for k, v in data.items() if v is not None}

        # Converter datas para string
        for campo in ["data_fim"]:
            if campo in update_data and update_data[campo]:
                update_data[campo] = str(update_data[campo])

        # Converter decimais
        for campo in ["desconto_percentual", "taxa_administrativa"]:
            if campo in update_data and update_data[campo]:
                update_data[campo] = float(update_data[campo])

        update_data["atualizado_em"] = datetime.now().isoformat()

        result = self.supabase.table("contratos").update(update_data).eq("id", contrato_id).execute()
        return result.data[0]

    async def enviar_para_assinatura(self, contrato_id: int, user_id: str, perfis: List[str]) -> Dict[str, Any]:
        """Envia contrato para assinatura"""

        contrato = await self.buscar(contrato_id, user_id, perfis)

        if contrato.get("status") != StatusContrato.RASCUNHO.value:
            raise ValidationError("Apenas contratos em rascunho podem ser enviados para assinatura")

        update_data = {
            "status": StatusContrato.AGUARDANDO_ASSINATURA.value,
            "atualizado_em": datetime.now().isoformat()
        }

        result = self.supabase.table("contratos").update(update_data).eq("id", contrato_id).execute()

        # TODO: Enviar email/notificação para o beneficiário

        return result.data[0]

    async def assinar(self, contrato_id: int, data: Dict[str, Any], user_id: str, perfis: List[str]) -> Dict[str, Any]:
        """Assina contrato"""

        contrato = await self.buscar(contrato_id, user_id, perfis)

        if contrato.get("status") != StatusContrato.AGUARDANDO_ASSINATURA.value:
            raise ValidationError("Contrato não está aguardando assinatura")

        if not data.get("aceite_termos"):
            raise ValidationError("É necessário aceitar os termos do contrato")

        # Gerar hash da assinatura
        assinatura_dados = f"{contrato_id}:{user_id}:{datetime.now().isoformat()}"
        assinatura_hash = hashlib.sha256(assinatura_dados.encode()).hexdigest()

        update_data = {
            "status": StatusContrato.ATIVO.value,
            "data_assinatura": datetime.now().isoformat(),
            "ip_assinatura": data.get("ip_assinatura"),
            "dispositivo_assinatura": data.get("dispositivo"),
            "assinatura_hash": assinatura_hash,
            "atualizado_em": datetime.now().isoformat()
        }

        result = self.supabase.table("contratos").update(update_data).eq("id", contrato_id).execute()

        # Atualizar status do beneficiário se houver
        if contrato.get("beneficiario_id"):
            self.supabase.table("beneficiarios").update({
                "status": "ATIVO",
                "contrato_assinado": True
            }).eq("id", contrato["beneficiario_id"]).execute()

        return result.data[0]

    async def rescindir(self, contrato_id: int, data: Dict[str, Any], user_id: str, perfis: List[str]) -> Dict[str, Any]:
        """Rescinde contrato"""

        contrato = await self.buscar(contrato_id, user_id, perfis)

        if contrato.get("status") not in [StatusContrato.ATIVO.value, StatusContrato.SUSPENSO.value]:
            raise ValidationError("Apenas contratos ativos ou suspensos podem ser rescindidos")

        update_data = {
            "status": StatusContrato.CANCELADO.value,
            "data_rescisao": str(data["data_rescisao"]),
            "motivo_rescisao": data["motivo"],
            "atualizado_em": datetime.now().isoformat()
        }

        result = self.supabase.table("contratos").update(update_data).eq("id", contrato_id).execute()

        # Atualizar status do beneficiário
        if contrato.get("beneficiario_id"):
            self.supabase.table("beneficiarios").update({
                "status": "CANCELADO"
            }).eq("id", contrato["beneficiario_id"]).execute()

        # Criar cobrança de multa se aplicável
        if data.get("aplicar_multa") and contrato.get("multa_rescisao"):
            multa_data = {
                "beneficiario_id": contrato["beneficiario_id"],
                "usina_id": contrato.get("usina_id"),
                "tipo": "MULTA",
                "mes_referencia": datetime.now().month,
                "ano_referencia": datetime.now().year,
                "valor_energia_injetada": 0,
                "desconto_percentual": 0,
                "valor_desconto": 0,
                "valor_final": float(contrato["multa_rescisao"]),
                "data_vencimento": str(data["data_rescisao"]),
                "status": "PENDENTE",
                "observacoes": f"Multa por rescisão do contrato {contrato.get('numero_contrato')}",
                "criado_por": user_id
            }
            self.supabase.table("cobrancas").insert(multa_data).execute()

        return result.data[0]

    async def suspender(self, contrato_id: int, motivo: str, user_id: str, perfis: List[str]) -> Dict[str, Any]:
        """Suspende contrato temporariamente"""

        contrato = await self.buscar(contrato_id, user_id, perfis)

        if contrato.get("status") != StatusContrato.ATIVO.value:
            raise ValidationError("Apenas contratos ativos podem ser suspensos")

        update_data = {
            "status": StatusContrato.SUSPENSO.value,
            "observacoes": f"{contrato.get('observacoes') or ''}\n[Suspenso] {motivo}".strip(),
            "atualizado_em": datetime.now().isoformat()
        }

        result = self.supabase.table("contratos").update(update_data).eq("id", contrato_id).execute()

        # Atualizar status do beneficiário
        if contrato.get("beneficiario_id"):
            self.supabase.table("beneficiarios").update({
                "status": "SUSPENSO"
            }).eq("id", contrato["beneficiario_id"]).execute()

        return result.data[0]

    async def reativar(self, contrato_id: int, user_id: str, perfis: List[str]) -> Dict[str, Any]:
        """Reativa contrato suspenso"""

        contrato = await self.buscar(contrato_id, user_id, perfis)

        if contrato.get("status") != StatusContrato.SUSPENSO.value:
            raise ValidationError("Apenas contratos suspensos podem ser reativados")

        update_data = {
            "status": StatusContrato.ATIVO.value,
            "observacoes": f"{contrato.get('observacoes') or ''}\n[Reativado em {datetime.now().strftime('%d/%m/%Y')}]".strip(),
            "atualizado_em": datetime.now().isoformat()
        }

        result = self.supabase.table("contratos").update(update_data).eq("id", contrato_id).execute()

        # Reativar beneficiário
        if contrato.get("beneficiario_id"):
            self.supabase.table("beneficiarios").update({
                "status": "ATIVO"
            }).eq("id", contrato["beneficiario_id"]).execute()

        return result.data[0]

    async def estatisticas(self, user_id: str, perfis: List[str], usina_id: Optional[int] = None) -> Dict[str, Any]:
        """Retorna estatísticas de contratos"""

        query = self.supabase.table("contratos").select("*")

        if usina_id:
            query = query.eq("usina_id", usina_id)

        result = query.execute()
        contratos = result.data

        total = len(contratos)
        ativos = len([c for c in contratos if c.get("status") == StatusContrato.ATIVO.value])
        aguardando = len([c for c in contratos if c.get("status") == StatusContrato.AGUARDANDO_ASSINATURA.value])
        cancelados = len([c for c in contratos if c.get("status") == StatusContrato.CANCELADO.value])

        valor_adesao = sum(Decimal(str(c.get("valor_adesao", 0) or 0)) for c in contratos)
        descontos = [Decimal(str(c.get("desconto_percentual", 0))) for c in contratos if c.get("desconto_percentual")]
        desconto_medio = sum(descontos) / len(descontos) if descontos else Decimal("0")

        return {
            "total_contratos": total,
            "contratos_ativos": ativos,
            "contratos_aguardando": aguardando,
            "contratos_cancelados": cancelados,
            "valor_total_adesao": float(valor_adesao),
            "desconto_medio": float(desconto_medio)
        }

    async def meus_contratos(self, user_id: str) -> List[Dict[str, Any]]:
        """Lista contratos do usuário logado"""

        # Buscar como beneficiário
        beneficiarios = self.supabase.table("beneficiarios").select("id").eq("usuario_id", user_id).execute()
        benef_ids = [b["id"] for b in beneficiarios.data] if beneficiarios.data else []

        contratos = []

        if benef_ids:
            result = self.supabase.table("contratos").select(
                "*, beneficiarios(id, nome), usinas(id, nome)"
            ).in_("beneficiario_id", benef_ids).execute()
            contratos.extend(result.data)

        # Buscar como parceiro
        result_parceiro = self.supabase.table("contratos").select(
            "*, usinas(id, nome)"
        ).eq("parceiro_id", user_id).execute()
        contratos.extend(result_parceiro.data)

        return contratos
