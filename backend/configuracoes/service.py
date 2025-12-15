"""
Service para Configurações de Impostos
"""

from datetime import date
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from ..core.database import get_supabase


class ImpostosService:
    """Service para gerenciamento de impostos"""

    def __init__(self):
        self.supabase = get_supabase()

    def listar_todos(self) -> List[dict]:
        """Lista todos os impostos ordenados por vigência"""
        response = self.supabase.table("configuracoes_impostos").select(
            "*"
        ).order("vigencia_inicio", desc=True).execute()
        return response.data or []

    def buscar_por_id(self, imposto_id: int) -> Optional[dict]:
        """Busca imposto por ID"""
        response = self.supabase.table("configuracoes_impostos").select(
            "*"
        ).eq("id", imposto_id).single().execute()
        return response.data

    def buscar_vigente(self, data_referencia: Optional[date] = None) -> Optional[dict]:
        """
        Busca o imposto vigente para uma data específica.
        Se não informada data, usa a data atual.
        """
        if data_referencia is None:
            data_referencia = date.today()

        data_str = data_referencia.isoformat()

        # Buscar imposto onde:
        # - vigencia_inicio <= data_referencia
        # - vigencia_fim IS NULL ou vigencia_fim >= data_referencia
        response = self.supabase.table("configuracoes_impostos").select(
            "*"
        ).lte("vigencia_inicio", data_str).or_(
            f"vigencia_fim.is.null,vigencia_fim.gte.{data_str}"
        ).order("vigencia_inicio", desc=True).limit(1).execute()

        if response.data:
            imposto = response.data[0]
            # Adicionar pis_cofins combinado para facilitar cálculos
            imposto["pis_cofins"] = float(imposto["pis"]) + float(imposto["cofins"])
            return imposto
        return None

    def criar(self, dados: dict, usuario_id: Optional[UUID] = None) -> dict:
        """
        Cria novo registro de imposto.
        Encerra vigência do anterior automaticamente.
        """
        # Encerrar vigência do imposto anterior
        vigente = self.buscar_vigente()
        if vigente:
            nova_vigencia_inicio = dados.get("vigencia_inicio")
            if nova_vigencia_inicio:
                # Encerrar vigência do anterior um dia antes
                from datetime import timedelta
                vigencia_fim = nova_vigencia_inicio - timedelta(days=1)
                self.supabase.table("configuracoes_impostos").update({
                    "vigencia_fim": vigencia_fim.isoformat()
                }).eq("id", vigente["id"]).execute()

        # Criar novo registro
        insert_data = {
            "pis": float(dados["pis"]),
            "cofins": float(dados["cofins"]),
            "icms": float(dados["icms"]),
            "vigencia_inicio": dados["vigencia_inicio"].isoformat() if isinstance(dados["vigencia_inicio"], date) else dados["vigencia_inicio"],
            "observacao": dados.get("observacao")
        }

        if usuario_id:
            insert_data["criado_por"] = str(usuario_id)

        response = self.supabase.table("configuracoes_impostos").insert(
            insert_data
        ).execute()

        return response.data[0] if response.data else None

    def atualizar(self, imposto_id: int, dados: dict) -> Optional[dict]:
        """Atualiza um registro de imposto"""
        update_data = {}

        if "pis" in dados and dados["pis"] is not None:
            update_data["pis"] = float(dados["pis"])
        if "cofins" in dados and dados["cofins"] is not None:
            update_data["cofins"] = float(dados["cofins"])
        if "icms" in dados and dados["icms"] is not None:
            update_data["icms"] = float(dados["icms"])
        if "vigencia_inicio" in dados and dados["vigencia_inicio"] is not None:
            update_data["vigencia_inicio"] = dados["vigencia_inicio"].isoformat() if isinstance(dados["vigencia_inicio"], date) else dados["vigencia_inicio"]
        if "vigencia_fim" in dados and dados["vigencia_fim"] is not None:
            update_data["vigencia_fim"] = dados["vigencia_fim"].isoformat() if isinstance(dados["vigencia_fim"], date) else dados["vigencia_fim"]
        if "observacao" in dados:
            update_data["observacao"] = dados["observacao"]

        if not update_data:
            return self.buscar_por_id(imposto_id)

        response = self.supabase.table("configuracoes_impostos").update(
            update_data
        ).eq("id", imposto_id).execute()

        return response.data[0] if response.data else None

    def excluir(self, imposto_id: int) -> bool:
        """Exclui um registro de imposto (apenas se não for o vigente)"""
        # Verificar se é o vigente
        vigente = self.buscar_vigente()
        if vigente and vigente["id"] == imposto_id:
            raise ValueError("Não é possível excluir o imposto vigente")

        self.supabase.table("configuracoes_impostos").delete().eq(
            "id", imposto_id
        ).execute()
        return True

    def verificar_e_criar_se_diferente(
        self,
        pis_extraido: float,
        cofins_extraido: float,
        icms_extraido: float,
        tolerancia: float = 0.001,
        usuario_id: Optional[UUID] = None
    ) -> dict:
        """
        Verifica se os impostos extraídos são diferentes dos vigentes.
        Se forem, cria um novo registro automaticamente.

        Args:
            pis_extraido: Percentual PIS extraído da fatura
            cofins_extraido: Percentual COFINS extraído da fatura
            icms_extraido: Percentual ICMS extraído da fatura
            tolerancia: Tolerância para comparação (default 0.1%)
            usuario_id: ID do usuário para auditoria

        Returns:
            Imposto vigente (novo ou existente)
        """
        vigente = self.buscar_vigente()

        if not vigente:
            # Não existe imposto cadastrado, criar primeiro
            return self.criar({
                "pis": Decimal(str(pis_extraido)),
                "cofins": Decimal(str(cofins_extraido)),
                "icms": Decimal(str(icms_extraido)),
                "vigencia_inicio": date.today(),
                "observacao": "Criado automaticamente a partir de extração de fatura"
            }, usuario_id)

        # Verificar se há diferença significativa
        pis_diff = abs(float(vigente["pis"]) - pis_extraido)
        cofins_diff = abs(float(vigente["cofins"]) - cofins_extraido)
        icms_diff = abs(float(vigente["icms"]) - icms_extraido)

        if pis_diff > tolerancia or cofins_diff > tolerancia or icms_diff > tolerancia:
            # Criar novo registro
            return self.criar({
                "pis": Decimal(str(pis_extraido)),
                "cofins": Decimal(str(cofins_extraido)),
                "icms": Decimal(str(icms_extraido)),
                "vigencia_inicio": date.today(),
                "observacao": f"Atualizado automaticamente. Diferenças: PIS={pis_diff:.6f}, COFINS={cofins_diff:.6f}, ICMS={icms_diff:.6f}"
            }, usuario_id)

        return vigente


# Instância singleton
impostos_service = ImpostosService()
