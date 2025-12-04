"""
Admin Service - Lógica de negócio para Administração
"""

from typing import Optional, List, Dict, Any
from datetime import date, datetime, timedelta
from decimal import Decimal
from ..core.database import get_supabase
from ..core.exceptions import NotFoundError, ValidationError, ForbiddenError


class AdminService:
    """Serviço para administração do sistema"""

    def __init__(self):
        self.supabase = get_supabase()

    async def dashboard_stats(self) -> Dict[str, Any]:
        """Retorna estatísticas gerais do dashboard"""

        hoje = datetime.now()
        inicio_mes = hoje.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        # Usuários
        usuarios = self.supabase.table("usuarios").select("id, ativo, criado_em", count="exact").execute()
        total_usuarios = usuarios.count or 0
        usuarios_ativos = len([u for u in usuarios.data if u.get("ativo")])
        novos_mes = len([u for u in usuarios.data if u.get("criado_em") and u["criado_em"] >= inicio_mes.isoformat()])

        # Usinas
        usinas = self.supabase.table("usinas").select("id, status, capacidade_kwp").execute()
        total_usinas = len(usinas.data)
        usinas_ativas = len([u for u in usinas.data if u.get("status") == "ATIVA"])
        capacidade_total = sum(Decimal(str(u.get("capacidade_kwp", 0) or 0)) for u in usinas.data)

        # Beneficiários
        beneficiarios = self.supabase.table("beneficiarios").select("id, status, criado_em", count="exact").execute()
        total_beneficiarios = beneficiarios.count or 0
        benef_ativos = len([b for b in beneficiarios.data if b.get("status") == "ATIVO"])
        novos_benef_mes = len([b for b in beneficiarios.data if b.get("criado_em") and b["criado_em"] >= inicio_mes.isoformat()])

        # UCs
        ucs = self.supabase.table("ucs").select("id, is_geradora").execute()
        total_ucs = len(ucs.data)
        ucs_geradoras = len([u for u in ucs.data if u.get("is_geradora")])
        ucs_beneficiarias = total_ucs - ucs_geradoras

        # Cobranças do mês
        cobrancas = self.supabase.table("cobrancas").select(
            "id, valor_final, valor_pago, status"
        ).eq("mes_referencia", hoje.month).eq("ano_referencia", hoje.year).execute()

        valor_total = sum(Decimal(str(c.get("valor_final", 0))) for c in cobrancas.data)
        valor_recebido = sum(Decimal(str(c.get("valor_pago", 0) or 0)) for c in cobrancas.data if c.get("valor_pago"))
        valor_pendente = valor_total - valor_recebido

        vencidas = len([c for c in cobrancas.data if c.get("status") == "VENCIDA"])
        taxa_inadimplencia = Decimal(str(vencidas)) / Decimal(str(len(cobrancas.data))) * 100 if cobrancas.data else Decimal("0")

        return {
            "total_usuarios": total_usuarios,
            "usuarios_ativos": usuarios_ativos,
            "novos_usuarios_mes": novos_mes,
            "total_usinas": total_usinas,
            "usinas_ativas": usinas_ativas,
            "capacidade_total_kwp": float(capacidade_total),
            "total_beneficiarios": total_beneficiarios,
            "beneficiarios_ativos": benef_ativos,
            "novos_beneficiarios_mes": novos_benef_mes,
            "total_ucs": total_ucs,
            "ucs_geradoras": ucs_geradoras,
            "ucs_beneficiarias": ucs_beneficiarias,
            "valor_total_cobrancas_mes": float(valor_total),
            "valor_recebido_mes": float(valor_recebido),
            "valor_pendente_mes": float(valor_pendente),
            "taxa_inadimplencia": float(taxa_inadimplencia)
        }

    async def dashboard_grafico(self, tipo: str, periodo: str, usina_id: Optional[int] = None) -> Dict[str, Any]:
        """Gera dados para gráficos do dashboard"""

        meses = int(periodo.replace("m", ""))
        hoje = datetime.now()

        labels = []
        for i in range(meses - 1, -1, -1):
            data = hoje - timedelta(days=30 * i)
            labels.append(data.strftime("%b/%Y"))

        if tipo == "cobrancas":
            return await self._grafico_cobrancas(labels, meses, usina_id)
        elif tipo == "usuarios":
            return await self._grafico_usuarios(labels, meses)
        elif tipo == "energia":
            return await self._grafico_energia(labels, meses, usina_id)
        else:
            raise ValidationError(f"Tipo de gráfico inválido: {tipo}")

    async def _grafico_cobrancas(self, labels: List[str], meses: int, usina_id: Optional[int]) -> Dict[str, Any]:
        """Gráfico de cobranças por mês"""

        query = self.supabase.table("cobrancas").select("mes_referencia, ano_referencia, valor_final, valor_pago, status")

        if usina_id:
            query = query.eq("usina_id", usina_id)

        result = query.execute()

        # Agrupar por mês
        valores_mes = {}
        recebido_mes = {}

        for c in result.data:
            chave = f"{c['mes_referencia']:02d}/{c['ano_referencia']}"
            valores_mes[chave] = valores_mes.get(chave, 0) + float(c.get("valor_final", 0))
            if c.get("valor_pago"):
                recebido_mes[chave] = recebido_mes.get(chave, 0) + float(c.get("valor_pago", 0))

        return {
            "labels": labels,
            "datasets": [
                {
                    "label": "Valor Total",
                    "data": [valores_mes.get(l.replace("/", "/20"), 0) for l in labels],
                    "borderColor": "#3B82F6",
                    "backgroundColor": "rgba(59, 130, 246, 0.1)"
                },
                {
                    "label": "Valor Recebido",
                    "data": [recebido_mes.get(l.replace("/", "/20"), 0) for l in labels],
                    "borderColor": "#10B981",
                    "backgroundColor": "rgba(16, 185, 129, 0.1)"
                }
            ]
        }

    async def _grafico_usuarios(self, labels: List[str], meses: int) -> Dict[str, Any]:
        """Gráfico de novos usuários por mês"""

        result = self.supabase.table("usuarios").select("criado_em").execute()

        usuarios_mes = {}
        for u in result.data:
            if u.get("criado_em"):
                data = datetime.fromisoformat(u["criado_em"].replace("Z", "+00:00"))
                chave = data.strftime("%b/%Y")
                usuarios_mes[chave] = usuarios_mes.get(chave, 0) + 1

        return {
            "labels": labels,
            "datasets": [
                {
                    "label": "Novos Usuários",
                    "data": [usuarios_mes.get(l, 0) for l in labels],
                    "borderColor": "#8B5CF6",
                    "backgroundColor": "rgba(139, 92, 246, 0.1)"
                }
            ]
        }

    async def _grafico_energia(self, labels: List[str], meses: int, usina_id: Optional[int]) -> Dict[str, Any]:
        """Gráfico de energia por mês"""

        query = self.supabase.table("faturas").select("mes_referencia, ano_referencia, consumo")

        if usina_id:
            # Filtrar por UCs da usina
            ucs = self.supabase.table("ucs").select("id").eq("geradora_id", usina_id).execute()
            uc_ids = [u["id"] for u in ucs.data]
            if uc_ids:
                query = query.in_("uc_id", uc_ids)

        result = query.execute()

        consumo_mes = {}
        for f in result.data:
            chave = f"{f['mes_referencia']:02d}/{f['ano_referencia']}"
            consumo_mes[chave] = consumo_mes.get(chave, 0) + (f.get("consumo") or 0)

        return {
            "labels": labels,
            "datasets": [
                {
                    "label": "Consumo (kWh)",
                    "data": [consumo_mes.get(l.replace("/", "/20"), 0) for l in labels],
                    "borderColor": "#F59E0B",
                    "backgroundColor": "rgba(245, 158, 11, 0.1)"
                }
            ]
        }

    async def listar_configuracoes(self) -> List[Dict[str, Any]]:
        """Lista configurações do sistema"""

        result = self.supabase.table("configuracoes_sistema").select("*").order("chave").execute()
        return result.data

    async def atualizar_configuracao(self, chave: str, valor: str, user_id: str) -> Dict[str, Any]:
        """Atualiza configuração do sistema"""

        config = self.supabase.table("configuracoes_sistema").select("*").eq("chave", chave).single().execute()

        if not config.data:
            raise NotFoundError(f"Configuração '{chave}' não encontrada")

        if not config.data.get("editavel"):
            raise ValidationError("Esta configuração não pode ser editada")

        # Validar tipo
        tipo = config.data.get("tipo", "string")
        if tipo == "number":
            try:
                float(valor)
            except ValueError:
                raise ValidationError("Valor deve ser numérico")
        elif tipo == "boolean":
            if valor.lower() not in ["true", "false", "1", "0"]:
                raise ValidationError("Valor deve ser true ou false")

        result = self.supabase.table("configuracoes_sistema").update({
            "valor": valor,
            "atualizado_em": datetime.now().isoformat(),
            "atualizado_por": user_id
        }).eq("chave", chave).execute()

        # Registrar log
        await self._registrar_log(
            user_id=user_id,
            acao="ATUALIZAR",
            entidade="configuracoes_sistema",
            entidade_id=chave,
            dados_anteriores={"valor": config.data.get("valor")},
            dados_novos={"valor": valor}
        )

        return result.data[0]

    async def listar_logs_auditoria(
        self,
        page: int = 1,
        per_page: int = 50,
        usuario_id: Optional[str] = None,
        entidade: Optional[str] = None,
        acao: Optional[str] = None,
        data_inicio: Optional[date] = None,
        data_fim: Optional[date] = None
    ) -> Dict[str, Any]:
        """Lista logs de auditoria"""

        query = self.supabase.table("logs_auditoria").select(
            "*, usuarios(nome_completo)",
            count="exact"
        )

        if usuario_id:
            query = query.eq("usuario_id", usuario_id)
        if entidade:
            query = query.eq("entidade", entidade)
        if acao:
            query = query.eq("acao", acao)
        if data_inicio:
            query = query.gte("criado_em", str(data_inicio))
        if data_fim:
            query = query.lte("criado_em", str(data_fim))

        offset = (page - 1) * per_page
        query = query.order("criado_em", desc=True).range(offset, offset + per_page - 1)

        result = query.execute()
        total = result.count or 0
        total_pages = (total + per_page - 1) // per_page

        return {
            "logs": result.data,
            "total": total,
            "page": page,
            "per_page": per_page,
            "total_pages": total_pages
        }

    async def gerar_relatorio(self, data: Dict[str, Any], user_id: str) -> Dict[str, Any]:
        """Gera relatório"""

        tipo = data["tipo"]
        data_inicio = data["data_inicio"]
        data_fim = data["data_fim"]

        if tipo == "financeiro":
            return await self._relatorio_financeiro(data_inicio, data_fim, data.get("usina_id"))
        elif tipo == "usuarios":
            return await self._relatorio_usuarios(data_inicio, data_fim)
        elif tipo == "usinas":
            return await self._relatorio_usinas(data_inicio, data_fim)
        elif tipo == "beneficiarios":
            return await self._relatorio_beneficiarios(data_inicio, data_fim, data.get("usina_id"))
        else:
            raise ValidationError(f"Tipo de relatório inválido: {tipo}")

    async def _relatorio_financeiro(self, data_inicio: date, data_fim: date, usina_id: Optional[int]) -> Dict[str, Any]:
        """Gera relatório financeiro"""

        query = self.supabase.table("cobrancas").select("*, usinas(nome)")

        if usina_id:
            query = query.eq("usina_id", usina_id)

        result = query.execute()
        cobrancas = result.data

        total = len(cobrancas)
        valor_total = sum(Decimal(str(c.get("valor_final", 0))) for c in cobrancas)
        valor_recebido = sum(Decimal(str(c.get("valor_pago", 0) or 0)) for c in cobrancas if c.get("valor_pago"))

        # Por usina
        por_usina = {}
        for c in cobrancas:
            usina_nome = c.get("usinas", {}).get("nome", "Sem Usina")
            if usina_nome not in por_usina:
                por_usina[usina_nome] = {"total": 0, "recebido": 0, "pendente": 0}
            por_usina[usina_nome]["total"] += float(c.get("valor_final", 0))
            if c.get("valor_pago"):
                por_usina[usina_nome]["recebido"] += float(c.get("valor_pago", 0))

        for usina in por_usina:
            por_usina[usina]["pendente"] = por_usina[usina]["total"] - por_usina[usina]["recebido"]

        # Por mês
        por_mes = {}
        for c in cobrancas:
            chave = f"{c['mes_referencia']:02d}/{c['ano_referencia']}"
            if chave not in por_mes:
                por_mes[chave] = {"total": 0, "recebido": 0}
            por_mes[chave]["total"] += float(c.get("valor_final", 0))
            if c.get("valor_pago"):
                por_mes[chave]["recebido"] += float(c.get("valor_pago", 0))

        return {
            "tipo": "financeiro",
            "periodo": f"{data_inicio} a {data_fim}",
            "gerado_em": datetime.now().isoformat(),
            "dados": {
                "total_cobrancas": total,
                "valor_total": float(valor_total),
                "valor_recebido": float(valor_recebido),
                "valor_pendente": float(valor_total - valor_recebido),
                "por_usina": [{"usina": k, **v} for k, v in por_usina.items()],
                "por_mes": [{"mes": k, **v} for k, v in sorted(por_mes.items())]
            },
            "total_registros": total
        }

    async def _relatorio_usuarios(self, data_inicio: date, data_fim: date) -> Dict[str, Any]:
        """Gera relatório de usuários"""

        result = self.supabase.table("usuarios").select("*, usuarios_perfis(perfil)").execute()

        usuarios = result.data
        total = len(usuarios)
        ativos = len([u for u in usuarios if u.get("ativo")])

        # Por perfil
        por_perfil = {}
        for u in usuarios:
            for p in u.get("usuarios_perfis", []):
                perfil = p.get("perfil", "usuario")
                por_perfil[perfil] = por_perfil.get(perfil, 0) + 1

        return {
            "tipo": "usuarios",
            "periodo": f"{data_inicio} a {data_fim}",
            "gerado_em": datetime.now().isoformat(),
            "dados": {
                "total_usuarios": total,
                "usuarios_ativos": ativos,
                "usuarios_inativos": total - ativos,
                "por_perfil": [{"perfil": k, "quantidade": v} for k, v in por_perfil.items()]
            },
            "total_registros": total
        }

    async def _relatorio_usinas(self, data_inicio: date, data_fim: date) -> Dict[str, Any]:
        """Gera relatório de usinas"""

        result = self.supabase.table("usinas").select("*, beneficiarios(id)").execute()

        usinas = result.data
        total = len(usinas)

        dados_usinas = []
        for u in usinas:
            dados_usinas.append({
                "id": u["id"],
                "nome": u.get("nome"),
                "capacidade_kwp": u.get("capacidade_kwp"),
                "status": u.get("status"),
                "total_beneficiarios": len(u.get("beneficiarios", []))
            })

        capacidade_total = sum(Decimal(str(u.get("capacidade_kwp", 0) or 0)) for u in usinas)

        return {
            "tipo": "usinas",
            "periodo": f"{data_inicio} a {data_fim}",
            "gerado_em": datetime.now().isoformat(),
            "dados": {
                "total_usinas": total,
                "capacidade_total_kwp": float(capacidade_total),
                "usinas": dados_usinas
            },
            "total_registros": total
        }

    async def _relatorio_beneficiarios(self, data_inicio: date, data_fim: date, usina_id: Optional[int]) -> Dict[str, Any]:
        """Gera relatório de beneficiários"""

        query = self.supabase.table("beneficiarios").select("*, usinas(nome)")

        if usina_id:
            query = query.eq("usina_id", usina_id)

        result = query.execute()

        beneficiarios = result.data
        total = len(beneficiarios)
        ativos = len([b for b in beneficiarios if b.get("status") == "ATIVO"])

        # Por status
        por_status = {}
        for b in beneficiarios:
            status = b.get("status", "PENDENTE")
            por_status[status] = por_status.get(status, 0) + 1

        return {
            "tipo": "beneficiarios",
            "periodo": f"{data_inicio} a {data_fim}",
            "gerado_em": datetime.now().isoformat(),
            "dados": {
                "total_beneficiarios": total,
                "beneficiarios_ativos": ativos,
                "por_status": [{"status": k, "quantidade": v} for k, v in por_status.items()]
            },
            "total_registros": total
        }

    async def verificar_integracoes(self) -> Dict[str, Any]:
        """Verifica status das integrações"""

        integracoes = {}

        # Supabase
        try:
            self.supabase.table("usuarios").select("id").limit(1).execute()
            integracoes["supabase"] = {
                "nome": "Supabase",
                "status": "online",
                "ultima_verificacao": datetime.now().isoformat(),
                "mensagem": "Conexão estabelecida"
            }
        except Exception as e:
            integracoes["supabase"] = {
                "nome": "Supabase",
                "status": "erro",
                "ultima_verificacao": datetime.now().isoformat(),
                "mensagem": str(e)
            }

        # Energisa (simulado)
        integracoes["energisa"] = {
            "nome": "Gateway Energisa",
            "status": "online",
            "ultima_verificacao": datetime.now().isoformat(),
            "mensagem": "API disponível"
        }

        # Email (simulado)
        integracoes["email"] = {
            "nome": "Serviço de Email",
            "status": "online",
            "ultima_verificacao": datetime.now().isoformat(),
            "mensagem": "SMTP configurado"
        }

        return integracoes

    async def _registrar_log(
        self,
        user_id: str,
        acao: str,
        entidade: str,
        entidade_id: Optional[str] = None,
        dados_anteriores: Optional[Dict] = None,
        dados_novos: Optional[Dict] = None,
        ip_address: Optional[str] = None
    ):
        """Registra log de auditoria"""

        try:
            self.supabase.table("logs_auditoria").insert({
                "usuario_id": user_id,
                "acao": acao,
                "entidade": entidade,
                "entidade_id": entidade_id,
                "dados_anteriores": dados_anteriores,
                "dados_novos": dados_novos,
                "ip_address": ip_address,
                "criado_em": datetime.now().isoformat()
            }).execute()
        except Exception:
            pass  # Não falhar se log não puder ser registrado

    # ========================
    # Sincronização
    # ========================

    async def status_sincronizacao(self) -> Dict[str, Any]:
        """Retorna status detalhado da sincronização"""

        # Total de UCs
        ucs_result = self.supabase.table("unidades_consumidoras").select(
            "id, cdc, cod_empresa, digito_verificador, ultima_sincronizacao, nome_titular, cidade, uf, usuario_id, usuarios!inner(cpf, nome_completo)"
        ).execute()

        ucs = ucs_result.data or []
        total_ucs = len(ucs)

        # Classificar UCs por status de sincronização
        agora = datetime.now()
        ucs_nunca_sync = []
        ucs_desatualizadas = []
        ucs_atualizadas = []

        for uc in ucs:
            ultima_sync = uc.get("ultima_sincronizacao")
            uc_info = {
                "id": uc["id"],
                "uc_formatada": f"{uc['cod_empresa']}/{uc['cdc']}-{uc['digito_verificador']}",
                "nome_titular": uc.get("nome_titular", "Não informado"),
                "cidade": uc.get("cidade"),
                "uf": uc.get("uf"),
                "usuario": uc.get("usuarios", {}).get("nome_completo", "Desconhecido"),
                "cpf_usuario": uc.get("usuarios", {}).get("cpf"),
                "ultima_sincronizacao": ultima_sync
            }

            if not ultima_sync:
                ucs_nunca_sync.append(uc_info)
            else:
                sync_time = datetime.fromisoformat(ultima_sync.replace("Z", "+00:00").replace("+00:00", ""))
                horas_desde_sync = (agora - sync_time).total_seconds() / 3600

                uc_info["horas_desde_sync"] = round(horas_desde_sync, 1)

                if horas_desde_sync > 24:
                    ucs_desatualizadas.append(uc_info)
                else:
                    ucs_atualizadas.append(uc_info)

        # Sessões ativas da Energisa
        sessoes_result = self.supabase.table("sessoes_energisa").select(
            "cpf, atualizado_em"
        ).execute()

        sessoes = []
        for s in sessoes_result.data or []:
            atualizado = s.get("atualizado_em")
            if atualizado:
                sess_time = datetime.fromisoformat(atualizado.replace("Z", "+00:00").replace("+00:00", ""))
                idade_horas = (agora - sess_time).total_seconds() / 3600
                sessoes.append({
                    "cpf": f"{s['cpf'][:3]}***{s['cpf'][-2:]}",
                    "atualizado_em": atualizado,
                    "idade_horas": round(idade_horas, 1),
                    "status": "ativa" if idade_horas < 24 else "expirada"
                })

        # Total de faturas
        faturas_result = self.supabase.faturas().select("id", count="exact").execute()
        total_faturas = faturas_result.count or 0

        # Faturas com PDF
        faturas_pdf_result = self.supabase.faturas().select(
            "id", count="exact"
        ).not_.is_("pdf_base64", "null").execute()
        faturas_com_pdf = faturas_pdf_result.count or 0

        return {
            "resumo": {
                "total_ucs": total_ucs,
                "ucs_atualizadas": len(ucs_atualizadas),
                "ucs_desatualizadas": len(ucs_desatualizadas),
                "ucs_nunca_sincronizadas": len(ucs_nunca_sync),
                "sessoes_ativas": len([s for s in sessoes if s["status"] == "ativa"]),
                "total_faturas": total_faturas,
                "faturas_com_pdf": faturas_com_pdf
            },
            "ucs_atualizadas": sorted(ucs_atualizadas, key=lambda x: x.get("horas_desde_sync", 0)),
            "ucs_desatualizadas": sorted(ucs_desatualizadas, key=lambda x: x.get("horas_desde_sync", 999), reverse=True),
            "ucs_nunca_sincronizadas": ucs_nunca_sync,
            "sessoes": sessoes
        }

    async def forcar_sincronizacao(self, uc_id: int, user_id: str) -> Dict[str, Any]:
        """Força sincronização de uma UC específica"""
        from backend.sync.service import SyncService

        # Busca a UC
        uc_result = self.supabase.unidades_consumidoras().select(
            "*", "usuarios!inner(cpf)"
        ).eq("id", uc_id).single().execute()

        if not uc_result.data:
            return {"success": False, "message": "UC não encontrada"}

        uc = uc_result.data
        cpf = uc.get("usuarios", {}).get("cpf")

        if not cpf:
            return {"success": False, "message": "CPF do usuário não encontrado"}

        # Executa sincronização
        try:
            sync_service = SyncService()
            resultado = await sync_service.sincronizar_uc(uc_id, cpf)

            # Registra log
            await self._registrar_log(
                user_id=user_id,
                acao="forcar_sync",
                entidade="unidades_consumidoras",
                entidade_id=str(uc_id),
                dados_novos={"resultado": resultado}
            )

            return {
                "success": True,
                "message": f"Sincronização concluída para UC {uc['cdc']}",
                "resultado": resultado
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Erro na sincronização: {str(e)}"
            }
