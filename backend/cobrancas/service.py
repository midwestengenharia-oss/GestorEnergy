"""
Cobranças Service - Lógica de negócio para Cobranças
"""

import logging
from typing import Optional, List, Dict, Any
from datetime import date, datetime
from decimal import Decimal
from ..core.database import get_supabase_admin
from ..core.exceptions import NotFoundError, ValidationError, ForbiddenError
from .schemas import StatusCobranca, TipoCobranca

logger = logging.getLogger(__name__)


class CobrancasService:
    """Serviço para gerenciamento de cobranças"""

    def __init__(self):
        self.supabase = get_supabase_admin()

    def _obter_uc_periodo(
        self,
        beneficiario_id: int,
        mes: int,
        ano: int,
        fallback_uc_id: Optional[int] = None
    ) -> Optional[int]:
        """
        Obtém a UC correta para um beneficiário em um determinado período.

        Com a troca de titularidade, um beneficiário pode ter múltiplas UCs ao longo do tempo:
        - UC ORIGEM: A UC original do cliente (antes da troca de titularidade)
        - UC ATIVA: A UC atual (após troca de titularidade, no nome da geradora)

        Esta função busca a UC que estava ATIVA no período especificado.

        Args:
            beneficiario_id: ID do beneficiário
            mes: Mês de referência (1-12)
            ano: Ano de referência
            fallback_uc_id: UC de fallback se não encontrar na tabela N:N

        Returns:
            ID da UC para o período, ou None se não encontrar
        """
        from datetime import datetime

        # Criar data de referência (primeiro dia do mês)
        data_referencia = datetime(ano, mes, 1)

        # Buscar UC ativa no período da tabela beneficiario_ucs
        # A UC válida é aquela onde:
        # - data_inicio <= data_referencia
        # - data_fim IS NULL ou data_fim > data_referencia
        # - tipo = 'ATIVA' (preferencialmente)
        try:
            result = self.supabase.table("beneficiario_ucs").select(
                "uc_id, tipo, data_inicio, data_fim"
            ).eq("beneficiario_id", beneficiario_id).execute()

            if result.data:
                ucs_validas = []

                for uc_rel in result.data:
                    # Verificar se a UC estava válida no período
                    data_inicio = uc_rel.get("data_inicio")
                    data_fim = uc_rel.get("data_fim")
                    tipo = uc_rel.get("tipo", "ATIVA")

                    # Parsear datas
                    if data_inicio:
                        if isinstance(data_inicio, str):
                            data_inicio = datetime.fromisoformat(data_inicio.replace("Z", "+00:00"))
                        if data_inicio.tzinfo:
                            data_inicio = data_inicio.replace(tzinfo=None)
                    else:
                        # Se não tem data_inicio, assumir que é válida desde sempre
                        data_inicio = datetime(2000, 1, 1)

                    if data_fim:
                        if isinstance(data_fim, str):
                            data_fim = datetime.fromisoformat(data_fim.replace("Z", "+00:00"))
                        if data_fim.tzinfo:
                            data_fim = data_fim.replace(tzinfo=None)

                    # Verificar se período é válido
                    inicio_valido = data_inicio <= data_referencia
                    fim_valido = data_fim is None or data_fim > data_referencia

                    if inicio_valido and fim_valido:
                        ucs_validas.append({
                            "uc_id": uc_rel["uc_id"],
                            "tipo": tipo,
                            "data_inicio": data_inicio
                        })

                if ucs_validas:
                    # Priorizar UC ATIVA sobre ORIGEM
                    ucs_ativas = [u for u in ucs_validas if u["tipo"] == "ATIVA"]
                    if ucs_ativas:
                        # Se múltiplas ativas, pegar a mais recente
                        ucs_ativas.sort(key=lambda x: x["data_inicio"], reverse=True)
                        return ucs_ativas[0]["uc_id"]

                    # Se não tem ATIVA, usar a ORIGEM mais recente
                    ucs_validas.sort(key=lambda x: x["data_inicio"], reverse=True)
                    return ucs_validas[0]["uc_id"]

        except Exception as e:
            logger.warning(f"Erro ao buscar UC do período via beneficiario_ucs: {e}")

        # Fallback: usar uc_id direto do beneficiário (compatibilidade legado)
        if fallback_uc_id:
            return fallback_uc_id

        # Última tentativa: buscar uc_id do beneficiário
        try:
            benef = self.supabase.table("beneficiarios").select("uc_id").eq(
                "id", beneficiario_id
            ).single().execute()

            if benef.data:
                return benef.data.get("uc_id")
        except Exception as e:
            logger.warning(f"Erro ao buscar uc_id do beneficiário: {e}")

        return None

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
            "*, beneficiarios(id, nome, cpf, email, telefone, usina_id), faturas!cobrancas_fatura_id_fkey(id, mes_referencia, ano_referencia, valor_fatura, consumo)"
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
            "observacoes_internas": data.get("observacoes"),
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
            obs_anterior = cobranca.get("observacoes_internas") or ""
            update_data["observacoes_internas"] = f"{obs_anterior}\n[Pagamento] {data['observacoes']}".strip()

        result = self.supabase.table("cobrancas").update(update_data).eq("id", cobranca_id).execute()
        return result.data[0]

    async def cancelar(self, cobranca_id: int, motivo: str, user_id: str, perfis: List[str]) -> Dict[str, Any]:
        """Cancela cobrança"""

        cobranca = await self.buscar(cobranca_id, user_id, perfis)

        if cobranca.get("status") == StatusCobranca.PAGA.value:
            raise ValidationError("Não é possível cancelar cobrança já paga")

        update_data = {
            "status": StatusCobranca.CANCELADA.value,
            "observacoes_internas": f"{cobranca.get('observacoes_internas') or ''}\n[Cancelado] {motivo}".strip(),
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

                # Buscar UC correta para o período (considera múltiplas UCs/troca de titularidade)
                uc_id = self._obter_uc_periodo(
                    beneficiario_id=benef["id"],
                    mes=mes,
                    ano=ano,
                    fallback_uc_id=benef.get("uc_id")
                )
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
        fio_b: Optional[Decimal] = None,
        forcar_reprocessamento: bool = False
    ) -> dict:
        """
        Gera cobrança automaticamente a partir de uma fatura.

        Fluxo completo:
        1. Verifica/processa extração da fatura
        2. Busca dados do beneficiário e UC
        3. Busca impostos vigentes do banco
        4. Calcula bandeira proporcional (se dados disponíveis)
        5. Calcula cobrança usando dados extraídos
        6. Gera relatório HTML
        7. Prepara PIX
        8. Salva no banco com status RASCUNHO

        Args:
            fatura_id: ID da fatura
            beneficiario_id: ID do beneficiário
            tarifa_aneel: Tarifa ANEEL (busca automaticamente se não informada)
            fio_b: Valor Fio B (opcional)
            forcar_reprocessamento: Se True, exclui cobrança existente antes de criar nova

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
        from backend.configuracoes.service import impostos_service

        # 1. Verificar se fatura existe e tem dados extraídos
        fatura_result = self.supabase.table("faturas").select(
            "id, uc_id, dados_extraidos, dados_api, extracao_status, qr_code_pix, qr_code_pix_image, numero_fatura, mes_referencia, ano_referencia"
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
                "id, uc_id, dados_extraidos, dados_api, extracao_status, qr_code_pix, qr_code_pix_image, numero_fatura, mes_referencia, ano_referencia"
            ).eq("id", fatura_id).single().execute()
            fatura = fatura_result.data

        # Validar dados extraídos
        try:
            dados_extraidos = FaturaExtraidaSchema(**fatura["dados_extraidos"])
        except Exception as e:
            raise ValidationError(f"Dados extraídos inválidos: {str(e)}")

        # 2. Buscar beneficiário
        benef_result = self.supabase.table("beneficiarios").select("*").eq(
            "id", beneficiario_id
        ).single().execute()

        if not benef_result.data:
            raise NotFoundError(f"Beneficiário {beneficiario_id} não encontrado")

        beneficiario = benef_result.data

        # 2.1 Buscar UC da fatura (não do beneficiário, pois pode ter mudado após troca de titularidade)
        # A UC da fatura é a UC correta para aquele período de cobrança
        uc_id_fatura = fatura.get("uc_id")
        uc = None
        if uc_id_fatura:
            uc_result = self.supabase.table("unidades_consumidoras").select(
                "id, cod_empresa, cdc, digito_verificador, endereco, numero_imovel, cidade, uf"
            ).eq("id", uc_id_fatura).single().execute()
            if uc_result.data:
                uc = uc_result.data

        # 2.1 Verificar se já existe cobrança ATIVA para este beneficiário/mês/ano
        # Ignora cobranças CANCELADAS - podem gerar nova cobrança normalmente
        mes_ref = fatura.get("mes_referencia")
        ano_ref = fatura.get("ano_referencia")

        cobranca_existente = self.supabase.table("cobrancas").select("id, status").eq(
            "beneficiario_id", beneficiario_id
        ).eq("mes", mes_ref).eq("ano", ano_ref).neq("status", "CANCELADA").execute()

        if cobranca_existente.data and len(cobranca_existente.data) > 0:
            if forcar_reprocessamento:
                # Excluir cobrança existente para reprocessar
                cobranca_id_existente = cobranca_existente.data[0]["id"]
                status_existente = cobranca_existente.data[0].get("status", "")

                # Não permitir excluir cobranças já pagas
                if status_existente == "PAGA":
                    raise ValidationError(
                        f"Não é possível reprocessar cobrança já paga (ID: {cobranca_id_existente})"
                    )

                logger.info(f"Reprocessamento: Excluindo cobrança existente ID {cobranca_id_existente}")
                self.supabase.table("cobrancas").delete().eq("id", cobranca_id_existente).execute()
            else:
                raise ValidationError(
                    f"Já existe uma cobrança para o beneficiário {beneficiario_id} "
                    f"no período {mes_ref:02d}/{ano_ref}. Use forcar_reprocessamento=true para recriar."
                )

        # 2.2 Excluir cobranças CANCELADAS do mesmo período (para evitar violação de unique constraint)
        # Isso permite gerar uma nova cobrança após cancelar a anterior
        self.supabase.table("cobrancas").delete().eq(
            "beneficiario_id", beneficiario_id
        ).eq("mes", mes_ref).eq("ano", ano_ref).eq("status", "CANCELADA").execute()

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

        # 4. Buscar impostos vigentes
        imposto_vigente = impostos_service.buscar_vigente()
        pis_cofins = Decimal("0.067845")  # Default
        icms = Decimal("0.17")  # Default

        if imposto_vigente:
            pis_cofins = Decimal(str(imposto_vigente["pis"])) + Decimal(str(imposto_vigente["cofins"]))
            icms = Decimal(str(imposto_vigente["icms"]))
            logger.info(f"Usando impostos vigentes: PIS+COFINS={pis_cofins}, ICMS={icms}")
        else:
            logger.warning("Nenhum imposto vigente encontrado, usando valores default")

        # 5. Calcular cobrança
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

        # 5.1 Bandeira: prioridade para dados do PDF, API apenas como fallback
        # O PDF pode ter o valor extraído em totais.adicionais_bandeira
        # Só usar cálculo da API se o PDF não tiver valor de bandeira
        dados_api = fatura.get("dados_api")
        if dados_api:
            # Verificar se PDF já tem valor de bandeira (prioridade)
            bandeira_pdf = cobranca_calc.bandeiras_valor
            if bandeira_pdf and float(bandeira_pdf) > 0:
                logger.info(f"Usando bandeira extraída do PDF: R$ {float(bandeira_pdf):.2f}")
            else:
                # Fallback: calcular bandeira proporcional com dados da API
                bandeira_proporcional = calculator.calcular_bandeira_com_dados_api(
                    dados_api=dados_api,
                    pis_cofins=pis_cofins,
                    icms=icms
                )
                if bandeira_proporcional is not None:
                    logger.info(f"Fallback API: Bandeira proporcional calculada: R$ {bandeira_proporcional:.2f}")
                    cobranca_calc.bandeiras_valor = bandeira_proporcional
                    # Recalcular totais
                    calculator._calcular_totais(cobranca_calc)
                else:
                    logger.info("Nenhum valor de bandeira disponível (PDF ou API)")

        # 6. Gerar relatório HTML (usando V3 baseado no código n8n)
        # Buscar economia acumulada do beneficiário (se houver)
        economia_acumulada = 0.0
        if beneficiario.get("economia_acumulada"):
            economia_acumulada = float(beneficiario.get("economia_acumulada", 0))

        html_relatorio = report_generator_v3.gerar_html(
            cobranca=cobranca_calc,
            dados_fatura=dados_extraidos,
            beneficiario={
                "nome": beneficiario.get("nome"),
                "endereco": uc.get("endereco") if uc else None,
                "numero": uc.get("numero_imovel") if uc else None,
                "cidade": uc.get("cidade") if uc else None
            },
            qr_code_pix=fatura.get("qr_code_pix_image"),
            pix_copia_cola=fatura.get("qr_code_pix"),
            economia_acumulada=economia_acumulada
        )

        # 7. Preparar dados para salvar
        from datetime import datetime, timezone

        cobranca_data = {
            "beneficiario_id": beneficiario_id,
            "fatura_id": fatura_id,
            "fatura_dados_extraidos_id": fatura_id,
            "uc_id": uc_id_fatura,  # UC usada para esta cobrança (pode diferir da UC atual do beneficiário)

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

        # 8. Salvar no banco
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

                # Buscar UC correta para o período (considera múltiplas UCs/troca de titularidade)
                uc_id = self._obter_uc_periodo(
                    beneficiario_id=benef["id"],
                    mes=mes_referencia,
                    ano=ano_referencia,
                    fallback_uc_id=benef.get("uc_id")
                )

                if not uc_id:
                    erro_count += 1
                    resultados.append({
                        "beneficiario_id": benef["id"],
                        "beneficiario_nome": benef["nome"],
                        "status": "erro",
                        "erro": "Nenhuma UC encontrada para o período"
                    })
                    continue

                # Buscar fatura do beneficiário para o período
                fatura_result = self.supabase.table("faturas").select("id").eq(
                    "uc_id", uc_id
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
            "vencimento": nova_data.isoformat()
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
            "*, beneficiarios!inner(usina_id, usinas!inner(*), usuario_id, usuarios(email))"
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

        # Gerar PIX Santander antes de aprovar
        pix_gerado = False
        pix_erro = None
        try:
            from backend.pix.service import pix_service
            from backend.config import settings

            # Só gerar PIX se as credenciais estiverem configuradas
            if settings.SANTANDER_PIX_CLIENT_ID and settings.SANTANDER_PIX_PFX_BASE64:
                logger.info(f"Gerando PIX Santander para cobrança {cobranca_id}")
                pix_data = await pix_service.gerar_pix_cobranca(cobranca_id)
                pix_gerado = True
                logger.info(f"PIX gerado com sucesso: TXID={pix_data['txid']}")
            else:
                logger.warning(
                    f"Credenciais PIX Santander não configuradas. "
                    f"Cobrança {cobranca_id} será aprovada sem PIX."
                )
        except Exception as e:
            pix_erro = str(e)
            logger.error(f"Erro ao gerar PIX para cobrança {cobranca_id}: {e}")
            # Por ora, não bloqueia a aprovação se o PIX falhar
            # Pode ser ajustado para raise HTTPException se quiser bloquear

        # Atualizar para EMITIDA
        update_data = {
            "status": "EMITIDA",
            "vencimento_editavel": False
        }

        # Adicionar observação se PIX falhou
        if pix_erro:
            obs_atual = cobranca.get("observacoes_internas") or ""
            update_data["observacoes_internas"] = f"{obs_atual}\n[PIX] Erro na geração: {pix_erro}".strip()

        update_response = self.supabase.table("cobrancas").update(update_data).eq("id", cobranca_id).execute()

        logger.info(f"Cobrança {cobranca_id} aprovada e emitida (PIX: {'sim' if pix_gerado else 'não'})")

        # Atualizar economia_acumulada do beneficiário
        beneficiario_id = cobranca.get("beneficiario_id")
        economia_mes = float(cobranca.get("economia_mes") or 0)

        if beneficiario_id and economia_mes > 0:
            try:
                # Buscar economia atual do beneficiário
                benef_resp = self.supabase.table("beneficiarios").select(
                    "economia_acumulada"
                ).eq("id", beneficiario_id).execute()

                economia_atual = float(benef_resp.data[0].get("economia_acumulada") or 0) if benef_resp.data else 0
                nova_economia = economia_atual + economia_mes

                # Atualizar beneficiário
                self.supabase.table("beneficiarios").update({
                    "economia_acumulada": nova_economia
                }).eq("id", beneficiario_id).execute()

                logger.info(f"Economia acumulada do beneficiário {beneficiario_id} atualizada: R$ {economia_atual:.2f} -> R$ {nova_economia:.2f}")
            except Exception as e:
                logger.error(f"Erro ao atualizar economia_acumulada do beneficiário {beneficiario_id}: {e}")
                # Não falha a aprovação por erro na atualização da economia

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
                check_response = self.supabase.table("gestores_usina").select(
                    "id"
                ).eq("usina_id", usina_id).eq("gestor_id", user_id).eq("ativo", True).execute()

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

    async def editar_campos_cobranca(
        self,
        cobranca_id: int,
        campos: dict,
        user_id: str,
        perfis: list[str]
    ) -> dict:
        """
        Edita campos específicos de uma cobrança e regenera o relatório HTML.

        Campos editáveis:
        - taxa_minima_valor
        - energia_excedente_valor
        - disponibilidade_valor
        - bandeiras_valor
        - iluminacao_publica_valor
        - servicos_valor
        - vencimento
        - observacoes_internas

        Args:
            cobranca_id: ID da cobrança
            campos: Dicionário com campos a editar
            user_id: ID do usuário
            perfis: Lista de perfis do usuário

        Returns:
            Cobrança atualizada

        Raises:
            NotFoundError: Se cobrança não existe
            ForbiddenError: Se usuário não tem permissão
            ValidationError: Se status não permite edição
        """
        from fastapi import HTTPException
        from .report_generator_v3 import ReportGeneratorV3
        from ..faturas.extraction_schemas import FaturaExtraidaSchema
        from .calculator import CobrancaCalculada

        # 1. Buscar cobrança com relacionamentos
        response = self.supabase.table("cobrancas").select(
            """
            *,
            beneficiarios!inner(
                id, nome, cpf, email, telefone, economia_acumulada,
                usinas(id, nome)
            ),
            unidades_consumidoras(id, cod_empresa, cdc, digito_verificador, endereco, numero_imovel, cidade, uf),
            faturas!cobrancas_fatura_id_fkey(id, dados_extraidos)
            """
        ).eq("id", cobranca_id).single().execute()

        if not response.data:
            raise NotFoundError(f"Cobrança {cobranca_id} não encontrada")

        cobranca = response.data

        # 2. Verificar permissão
        if not self._pode_gerenciar_cobranca(cobranca, user_id, perfis):
            raise ForbiddenError("Usuário não tem permissão para editar esta cobrança")

        # 3. Verificar status permite edição
        status_atual = cobranca.get("status")
        if status_atual in ["PAGA", "CANCELADA"]:
            raise HTTPException(
                status_code=400,
                detail=f"Cobrança com status '{status_atual}' não pode ser editada"
            )

        # 4. Lista completa de campos editáveis
        campos_kwh = ["consumo_kwh", "injetada_kwh", "compensado_kwh", "gap_kwh", "taxa_minima_kwh", "energia_excedente_kwh"]
        campos_tarifas = ["tarifa_base", "tarifa_assinatura"]
        campos_valores = [
            "valor_energia_base", "valor_energia_assinatura",
            "taxa_minima_valor", "energia_excedente_valor",
            "disponibilidade_valor", "bandeiras_valor",
            "iluminacao_publica_valor", "servicos_valor"
        ]
        todos_campos_editaveis = campos_kwh + campos_tarifas + campos_valores + ["vencimento", "observacoes_internas"]

        # 5. Salvar valores originais antes de editar (para permitir reversão)
        valores_originais = cobranca.get("valores_originais") or {}
        novos_originais = {}

        for campo in todos_campos_editaveis:
            if campo in campos and campos[campo] is not None:
                # Se nunca foi editado antes, salvar valor original
                if campo not in valores_originais:
                    valor_atual = cobranca.get(campo)
                    if valor_atual is not None:
                        novos_originais[campo] = valor_atual

        # Mesclar com valores originais existentes
        if novos_originais:
            valores_originais = {**valores_originais, **novos_originais}

        # 6. Preparar dados para atualização
        update_data = {}

        # Campos kWh (inteiros)
        for campo in campos_kwh:
            if campo in campos and campos[campo] is not None:
                update_data[campo] = int(campos[campo])

        # Campos de tarifas (decimais)
        for campo in campos_tarifas:
            if campo in campos and campos[campo] is not None:
                update_data[campo] = float(campos[campo])

        # Campos monetários (decimais)
        for campo in campos_valores:
            if campo in campos and campos[campo] is not None:
                update_data[campo] = float(campos[campo])

        # Vencimento
        if "vencimento" in campos and campos["vencimento"] is not None:
            update_data["vencimento"] = str(campos["vencimento"])

        # Observações
        if "observacoes_internas" in campos and campos["observacoes_internas"] is not None:
            update_data["observacoes_internas"] = campos["observacoes_internas"]

        # Salvar valores originais se houver novos
        if novos_originais:
            update_data["valores_originais"] = valores_originais

        if not update_data:
            logger.info(f"Nenhum campo para atualizar na cobrança {cobranca_id}")
            return await self.buscar(cobranca_id, user_id, perfis)

        # 5. Recalcular valor_total se algum campo monetário foi alterado
        campos_monetarios_alterados = any(c in update_data for c in campos_monetarios)

        if campos_monetarios_alterados:
            # Obter valores atuais e mesclar com os novos
            valor_energia_assinatura = float(cobranca.get("valor_energia_assinatura") or 0)
            taxa_minima = float(update_data.get("taxa_minima_valor", cobranca.get("taxa_minima_valor") or 0))
            energia_excedente = float(update_data.get("energia_excedente_valor", cobranca.get("energia_excedente_valor") or 0))
            disponibilidade = float(update_data.get("disponibilidade_valor", cobranca.get("disponibilidade_valor") or 0))
            bandeiras = float(update_data.get("bandeiras_valor", cobranca.get("bandeiras_valor") or 0))
            iluminacao = float(update_data.get("iluminacao_publica_valor", cobranca.get("iluminacao_publica_valor") or 0))
            servicos = float(update_data.get("servicos_valor", cobranca.get("servicos_valor") or 0))

            # Recalcular total
            modelo_gd = cobranca.get("tipo_modelo_gd", "GDI")
            if modelo_gd == "GDII":
                novo_total = valor_energia_assinatura + disponibilidade + bandeiras + iluminacao + servicos
            else:
                novo_total = valor_energia_assinatura + taxa_minima + energia_excedente + bandeiras + iluminacao + servicos

            update_data["valor_total"] = novo_total
            update_data["valor_com_assinatura"] = novo_total

            logger.info(f"Recalculando valor_total da cobrança {cobranca_id}: R$ {novo_total:.2f}")

        # 6. Marcar como editada manualmente
        update_data["editado_manualmente"] = True

        # 7. Atualizar no banco
        self.supabase.table("cobrancas").update(update_data).eq("id", cobranca_id).execute()

        # 8. Regenerar HTML do relatório
        try:
            # Buscar cobrança atualizada
            cobranca_atualizada = self.supabase.table("cobrancas").select("*").eq("id", cobranca_id).single().execute()
            cobranca_data = cobranca_atualizada.data

            # Montar objeto CobrancaCalculada com dados atualizados
            cobranca_calc = CobrancaCalculada()
            cobranca_calc.modelo_gd = cobranca_data.get("tipo_modelo_gd", "GDI")
            cobranca_calc.tipo_ligacao = cobranca_data.get("tipo_ligacao")
            cobranca_calc.consumo_kwh = float(cobranca_data.get("consumo_kwh") or 0)
            cobranca_calc.injetada_kwh = float(cobranca_data.get("injetada_kwh") or 0)
            cobranca_calc.compensado_kwh = float(cobranca_data.get("compensado_kwh") or 0)
            cobranca_calc.gap_kwh = float(cobranca_data.get("gap_kwh") or 0)
            cobranca_calc.tarifa_base = Decimal(str(cobranca_data.get("tarifa_base") or 0))
            cobranca_calc.tarifa_assinatura = Decimal(str(cobranca_data.get("tarifa_assinatura") or 0))
            cobranca_calc.valor_energia_assinatura = Decimal(str(cobranca_data.get("valor_energia_assinatura") or 0))
            cobranca_calc.taxa_minima_kwh = int(cobranca_data.get("taxa_minima_kwh") or 0)
            cobranca_calc.taxa_minima_valor = Decimal(str(cobranca_data.get("taxa_minima_valor") or 0))
            cobranca_calc.energia_excedente_kwh = int(cobranca_data.get("energia_excedente_kwh") or 0)
            cobranca_calc.energia_excedente_valor = Decimal(str(cobranca_data.get("energia_excedente_valor") or 0))
            cobranca_calc.disponibilidade_valor = Decimal(str(cobranca_data.get("disponibilidade_valor") or 0))
            cobranca_calc.bandeiras_valor = Decimal(str(cobranca_data.get("bandeiras_valor") or 0))
            cobranca_calc.iluminacao_publica_valor = Decimal(str(cobranca_data.get("iluminacao_publica_valor") or 0))
            cobranca_calc.servicos_valor = Decimal(str(cobranca_data.get("servicos_valor") or 0))
            cobranca_calc.valor_total = Decimal(str(cobranca_data.get("valor_total") or 0))
            cobranca_calc.economia_mes = Decimal(str(cobranca_data.get("economia_mes") or 0))

            # Campos de energia compensada
            cobranca_calc.energia_compensada_kwh = float(cobranca_data.get("energia_compensada_kwh") or cobranca_calc.compensado_kwh)
            cobranca_calc.energia_compensada_sem_desconto = Decimal(str(cobranca_data.get("energia_compensada_sem_desconto") or 0))
            cobranca_calc.energia_compensada_com_desconto = Decimal(str(cobranca_data.get("energia_compensada_com_desconto") or 0))

            # Vencimento
            if cobranca_data.get("vencimento"):
                from datetime import datetime
                venc_str = cobranca_data.get("vencimento")
                if isinstance(venc_str, str):
                    cobranca_calc.vencimento = datetime.strptime(venc_str[:10], "%Y-%m-%d").date()
                else:
                    cobranca_calc.vencimento = venc_str

            # Buscar dados da fatura para gerar HTML
            fatura = cobranca.get("faturas")
            dados_extraidos = None
            if fatura and fatura.get("dados_extraidos"):
                try:
                    dados_extraidos = FaturaExtraidaSchema(**fatura["dados_extraidos"])
                except Exception as e:
                    logger.warning(f"Erro ao parsear dados_extraidos: {e}")

            # Buscar UC e beneficiário
            uc = cobranca.get("unidades_consumidoras") or {}
            beneficiario = cobranca.get("beneficiarios") or {}

            # Gerar novo HTML
            report_generator = ReportGeneratorV3()
            economia_acumulada = float(beneficiario.get("economia_acumulada") or 0)

            novo_html = report_generator.gerar_html(
                cobranca=cobranca_calc,
                dados_fatura=dados_extraidos,
                beneficiario={
                    "nome": beneficiario.get("nome"),
                    "endereco": uc.get("endereco"),
                    "numero": uc.get("numero_imovel"),
                    "cidade": uc.get("cidade")
                },
                qr_code_pix=cobranca_data.get("qr_code_pix_image"),
                pix_copia_cola=cobranca_data.get("qr_code_pix"),
                economia_acumulada=economia_acumulada
            )

            # Atualizar HTML no banco
            self.supabase.table("cobrancas").update({
                "html_relatorio": novo_html
            }).eq("id", cobranca_id).execute()

            logger.info(f"HTML do relatório regenerado para cobrança {cobranca_id}")

        except Exception as e:
            logger.error(f"Erro ao regenerar HTML da cobrança {cobranca_id}: {e}")
            # Não falha a edição por erro no HTML

        # 9. Retornar cobrança atualizada
        return await self.buscar(cobranca_id, user_id, perfis)

    async def reverter_campos_cobranca(
        self,
        cobranca_id: int,
        campos: list[str] | None,
        user_id: str,
        perfis: list[str]
    ) -> dict:
        """
        Reverte campos editados para seus valores originais.

        Args:
            cobranca_id: ID da cobrança
            campos: Lista de campos a reverter. Se None ou vazio, reverte todos.
            user_id: ID do usuário
            perfis: Lista de perfis do usuário

        Returns:
            Cobrança atualizada
        """
        from fastapi import HTTPException

        # 1. Buscar cobrança
        response = self.supabase.table("cobrancas").select("*").eq("id", cobranca_id).single().execute()

        if not response.data:
            raise NotFoundError(f"Cobrança {cobranca_id} não encontrada")

        cobranca = response.data

        # 2. Verificar permissão
        if not self._pode_gerenciar_cobranca(cobranca, user_id, perfis):
            raise ForbiddenError("Usuário não tem permissão para editar esta cobrança")

        # 3. Verificar status permite edição
        status_atual = cobranca.get("status")
        if status_atual in ["PAGA", "CANCELADA"]:
            raise HTTPException(
                status_code=400,
                detail=f"Cobrança com status '{status_atual}' não pode ser editada"
            )

        # 4. Obter valores originais
        valores_originais = cobranca.get("valores_originais") or {}

        if not valores_originais:
            raise HTTPException(
                status_code=400,
                detail="Nenhum campo foi editado anteriormente. Nada a reverter."
            )

        # 5. Determinar campos a reverter
        campos_a_reverter = campos if campos else list(valores_originais.keys())

        # 6. Preparar atualização
        update_data = {}
        novos_valores_originais = dict(valores_originais)

        for campo in campos_a_reverter:
            if campo in valores_originais:
                # Reverter para valor original
                update_data[campo] = valores_originais[campo]
                # Remover do registro de valores originais
                del novos_valores_originais[campo]

        if not update_data:
            raise HTTPException(
                status_code=400,
                detail="Nenhum dos campos especificados foi editado anteriormente."
            )

        # Atualizar valores_originais (remover os revertidos)
        if novos_valores_originais:
            update_data["valores_originais"] = novos_valores_originais
        else:
            # Todos os campos foram revertidos - limpar o campo
            update_data["valores_originais"] = None
            update_data["editado_manualmente"] = False

        update_data["updated_at"] = "now()"

        # 7. Atualizar no banco
        self.supabase.table("cobrancas").update(update_data).eq("id", cobranca_id).execute()

        logger.info(f"Campos revertidos na cobrança {cobranca_id}: {list(update_data.keys())}")

        # 8. Retornar cobrança atualizada
        return await self.buscar(cobranca_id, user_id, perfis)
