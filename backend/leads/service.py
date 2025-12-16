"""
Leads Service - Logica de negocio para Leads/CRM
Pipeline completo de vendas e onboarding de clientes
"""

import logging
from typing import Optional, List, Dict, Any
from datetime import datetime
from decimal import Decimal
from ..core.database import get_supabase_admin
from ..core.exceptions import NotFoundError, ValidationError

logger = logging.getLogger(__name__)
from .schemas import (
    StatusLead, OrigemLead, TipoPessoa, TitularidadeStatus,
    MotivoPerdaCategoria, TipoVinculoUC, StatusProposta
)


class LeadsService:
    """Serviço para gerenciamento de leads e simulações"""

    def __init__(self):
        # Usar admin client para bypass de RLS (endpoint público /captura)
        self.supabase = get_supabase_admin()
        self.desconto_padrao = Decimal("0.30")  # 30% de desconto

    async def listar(
        self,
        page: int = 1,
        per_page: int = 20,
        status: Optional[str] = None,
        origem: Optional[str] = None,
        responsavel_id: Optional[str] = None,
        busca: Optional[str] = None
    ) -> Dict[str, Any]:
        """Lista leads com filtros e paginação"""

        query = self.supabase.table("leads").select(
            "*, simulacoes(*), contatos(*)",
            count="exact"
        )

        if status:
            query = query.eq("status", status)
        if origem:
            query = query.eq("origem", origem)
        if responsavel_id:
            query = query.eq("responsavel_id", responsavel_id)
        if busca:
            query = query.or_(f"nome.ilike.%{busca}%,telefone.ilike.%{busca}%,email.ilike.%{busca}%")

        offset = (page - 1) * per_page
        query = query.order("criado_em", desc=True).range(offset, offset + per_page - 1)

        result = query.execute()
        total = result.count or 0
        total_pages = (total + per_page - 1) // per_page

        return {
            "leads": result.data,
            "total": total,
            "page": page,
            "per_page": per_page,
            "total_pages": total_pages
        }

    async def buscar(self, lead_id: int) -> Dict[str, Any]:
        """Busca lead por ID"""

        result = self.supabase.table("leads").select(
            "*, simulacoes(*), contatos(*)"
        ).eq("id", lead_id).single().execute()

        if not result.data:
            raise NotFoundError("Lead não encontrado")

        return result.data

    async def criar(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Cria novo lead com dados basicos"""
        logger.info(f"Iniciando criação de lead: {data.get('nome')}")
        logger.debug(f"Dados recebidos: {data}")

        # Verificar se ja existe lead com mesmo CPF ou CNPJ
        cpf = data.get("cpf")
        cnpj = data.get("cnpj")

        if cpf:
            existente = self.supabase.table("leads").select("*").eq("cpf", cpf).execute()
            if existente.data:
                lead_existente = existente.data[0]
                if lead_existente["status"] not in [StatusLead.CONVERTIDO.value, StatusLead.PERDIDO.value]:
                    logger.info(f"Lead existente encontrado: ID {lead_existente['id']}")
                    return lead_existente

        if cnpj:
            existente = self.supabase.table("leads").select("*").eq("cnpj", cnpj).execute()
            if existente.data:
                lead_existente = existente.data[0]
                if lead_existente["status"] not in [StatusLead.CONVERTIDO.value, StatusLead.PERDIDO.value]:
                    logger.info(f"Lead existente encontrado: ID {lead_existente['id']}")
                    return lead_existente

        # Processar enum de origem
        origem = data.get("origem", OrigemLead.LANDING_PAGE)
        if hasattr(origem, 'value'):
            origem = origem.value

        # Processar UF (máximo 2 caracteres)
        uf = data.get("uf")
        if uf:
            uf = uf.upper().strip()[:2]  # Truncar para 2 caracteres

        # Campos obrigatórios (schema original)
        lead_data = {
            "nome": data["nome"],
            "email": data.get("email"),
            "telefone": data.get("telefone"),
            "cidade": data["cidade"],
            "uf": uf,
            "status": StatusLead.NOVO.value,
            "origem": origem,
            "utm_source": data.get("utm_source"),
            "utm_medium": data.get("utm_medium"),
            "utm_campaign": data.get("utm_campaign")
        }

        # CPF é opcional no schema original
        if cpf:
            lead_data["cpf"] = cpf

        # Campos opcionais do CRM expandido (migration 016)
        # Só incluir se fornecidos para evitar erros em DBs sem as colunas
        if cnpj:
            lead_data["cnpj"] = cnpj

        # tipo_pessoa e concessionaria são do CRM expandido
        if data.get("tipo_pessoa"):
            tipo_pessoa = data["tipo_pessoa"]
            if hasattr(tipo_pessoa, 'value'):
                tipo_pessoa = tipo_pessoa.value
            lead_data["tipo_pessoa"] = tipo_pessoa

        if data.get("concessionaria"):
            concessionaria = data["concessionaria"]
            if hasattr(concessionaria, 'value'):
                concessionaria = concessionaria.value
            lead_data["concessionaria"] = concessionaria

        # Remover valores None do dicionário
        lead_data = {k: v for k, v in lead_data.items() if v is not None}

        logger.info(f"Inserindo lead no banco: {lead_data}")
        try:
            result = self.supabase.table("leads").insert(lead_data).execute()
            logger.info(f"Lead inserido com sucesso: {result.data}")
            return result.data[0]
        except Exception as e:
            logger.error(f"Erro ao inserir lead no banco: {e}", exc_info=True)
            raise

    async def atualizar(self, lead_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
        """Atualiza lead"""

        lead = await self.buscar(lead_id)

        if lead.get("status") == StatusLead.CONVERTIDO.value:
            raise ValidationError("Lead já convertido não pode ser alterado")

        update_data = {k: v for k, v in data.items() if v is not None}
        update_data["atualizado_em"] = datetime.now().isoformat()

        result = self.supabase.table("leads").update(update_data).eq("id", lead_id).execute()
        return result.data[0]

    async def simular(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Cria simulação para um lead"""

        lead_id = data["lead_id"]
        lead = await self.buscar(lead_id)

        valor_fatura = Decimal(str(data["valor_fatura_media"]))
        quantidade_ucs = data.get("quantidade_ucs", 1)

        # Calcular economia
        economia_mensal = valor_fatura * self.desconto_padrao * quantidade_ucs
        economia_anual = economia_mensal * 12
        percentual = self.desconto_padrao * 100

        simulacao_data = {
            "lead_id": lead_id,
            "valor_fatura_media": float(valor_fatura),
            "consumo_medio_kwh": data.get("consumo_medio_kwh"),
            "quantidade_ucs": quantidade_ucs,
            "desconto_aplicado": float(self.desconto_padrao),
            "economia_mensal": float(economia_mensal),
            "economia_anual": float(economia_anual),
            "percentual_economia": float(percentual)
        }

        result = self.supabase.table("simulacoes").insert(simulacao_data).execute()

        # Atualizar status do lead
        self.supabase.table("leads").update({
            "status": StatusLead.SIMULACAO.value,
            "atualizado_em": datetime.now().isoformat()
        }).eq("id", lead_id).execute()

        return result.data[0]

    async def registrar_contato(self, data: Dict[str, Any], user_id: str) -> Dict[str, Any]:
        """Registra contato com lead"""

        lead_id = data["lead_id"]
        await self.buscar(lead_id)

        contato_data = {
            "lead_id": lead_id,
            "tipo_contato": data["tipo_contato"],
            "descricao": data["descricao"],
            "proximo_contato": str(data["proximo_contato"]) if data.get("proximo_contato") else None,
            "realizado_por": user_id
        }

        result = self.supabase.table("contatos").insert(contato_data).execute()

        # Atualizar status do lead para CONTATO se ainda não estiver
        self.supabase.table("leads").update({
            "status": StatusLead.CONTATO.value,
            "atualizado_em": datetime.now().isoformat()
        }).eq("id", lead_id).eq("status", StatusLead.SIMULACAO.value).execute()

        return result.data[0]

    async def converter(self, data: Dict[str, Any], user_id: str) -> Dict[str, Any]:
        """Converte lead em beneficiário"""

        lead_id = data["lead_id"]
        lead = await self.buscar(lead_id)

        if lead.get("status") == StatusLead.CONVERTIDO.value:
            raise ValidationError("Lead já foi convertido")

        usina_id = data["usina_id"]
        desconto = Decimal(str(data["desconto_percentual"]))

        # Verificar se usina existe
        usina = self.supabase.table("usinas").select("id").eq("id", usina_id).single().execute()
        if not usina.data:
            raise NotFoundError("Usina não encontrada")

        # Criar beneficiário
        beneficiario_data = {
            "usina_id": usina_id,
            "nome": lead["nome"],
            "email": lead.get("email"),
            "telefone": lead.get("telefone"),
            "cpf": lead["cpf"],
            "desconto": float(desconto),
            "percentual_rateio": float(data.get("percentual_rateio", 0)),
            "status": "PENDENTE",
            "origem": "LEAD",
            "lead_id": lead_id,
            "criado_por": user_id
        }

        beneficiario = self.supabase.table("beneficiarios").insert(beneficiario_data).execute()

        # Atualizar lead
        self.supabase.table("leads").update({
            "status": StatusLead.CONVERTIDO.value,
            "convertido_em": datetime.now().isoformat(),
            "beneficiario_id": beneficiario.data[0]["id"],
            "atualizado_em": datetime.now().isoformat()
        }).eq("id", lead_id).execute()

        return {
            "lead": lead,
            "beneficiario": beneficiario.data[0],
            "message": "Lead convertido com sucesso"
        }

    async def marcar_perdido(self, lead_id: int, motivo: str) -> Dict[str, Any]:
        """Marca lead como perdido"""

        lead = await self.buscar(lead_id)

        if lead.get("status") == StatusLead.CONVERTIDO.value:
            raise ValidationError("Lead já foi convertido")

        result = self.supabase.table("leads").update({
            "status": StatusLead.PERDIDO.value,
            "observacoes": f"{lead.get('observacoes') or ''}\n[Perdido] {motivo}".strip(),
            "atualizado_em": datetime.now().isoformat()
        }).eq("id", lead_id).execute()

        return result.data[0]

    async def atribuir_responsavel(self, lead_id: int, responsavel_id: str) -> Dict[str, Any]:
        """Atribui responsável ao lead"""

        await self.buscar(lead_id)

        # Verificar se responsável existe
        usuario = self.supabase.table("usuarios").select("id, nome_completo").eq("auth_id", responsavel_id).single().execute()
        if not usuario.data:
            raise NotFoundError("Usuário responsável não encontrado")

        result = self.supabase.table("leads").update({
            "responsavel_id": responsavel_id,
            "atualizado_em": datetime.now().isoformat()
        }).eq("id", lead_id).execute()

        return result.data[0]

    async def estatisticas(self) -> Dict[str, Any]:
        """Retorna estatísticas de leads"""

        leads = self.supabase.table("leads").select("id, status, origem").execute()
        simulacoes = self.supabase.table("simulacoes").select("economia_anual").execute()

        total = len(leads.data)
        novos = len([l for l in leads.data if l["status"] == StatusLead.NOVO.value])
        em_contato = len([l for l in leads.data if l["status"] in [StatusLead.CONTATO.value, StatusLead.NEGOCIACAO.value]])
        convertidos = len([l for l in leads.data if l["status"] == StatusLead.CONVERTIDO.value])
        perdidos = len([l for l in leads.data if l["status"] == StatusLead.PERDIDO.value])

        taxa_conversao = Decimal(str(convertidos)) / Decimal(str(total)) * 100 if total > 0 else Decimal("0")
        economia_total = sum(Decimal(str(s.get("economia_anual", 0))) for s in simulacoes.data)

        # Por origem
        por_origem = {}
        for l in leads.data:
            origem = l.get("origem", "OUTROS")
            por_origem[origem] = por_origem.get(origem, 0) + 1

        # Por status
        por_status = {}
        for l in leads.data:
            status = l.get("status", "NOVO")
            por_status[status] = por_status.get(status, 0) + 1

        return {
            "total_leads": total,
            "leads_novos": novos,
            "leads_em_contato": em_contato,
            "leads_convertidos": convertidos,
            "leads_perdidos": perdidos,
            "taxa_conversao": float(taxa_conversao),
            "economia_total_simulada": float(economia_total),
            "por_origem": [{"origem": k, "quantidade": v} for k, v in por_origem.items()],
            "por_status": [{"status": k, "quantidade": v} for k, v in por_status.items()]
        }

    async def funil(self) -> Dict[str, Any]:
        """Retorna funil de vendas completo"""

        leads = self.supabase.table("leads").select("status").execute()

        etapas = [
            {"nome": "Novo", "status": StatusLead.NOVO.value, "quantidade": 0},
            {"nome": "Vinculando", "status": StatusLead.VINCULANDO.value, "quantidade": 0},
            {"nome": "Vinculado", "status": StatusLead.VINCULADO.value, "quantidade": 0},
            {"nome": "Simulacao", "status": StatusLead.SIMULACAO.value, "quantidade": 0},
            {"nome": "Contato", "status": StatusLead.CONTATO.value, "quantidade": 0},
            {"nome": "Negociacao", "status": StatusLead.NEGOCIACAO.value, "quantidade": 0},
            {"nome": "Aguardando Aceite", "status": StatusLead.AGUARDANDO_ACEITE.value, "quantidade": 0},
            {"nome": "Aceito", "status": StatusLead.ACEITO.value, "quantidade": 0},
            {"nome": "Aguardando Assinatura", "status": StatusLead.AGUARDANDO_ASSINATURA.value, "quantidade": 0},
            {"nome": "Assinado", "status": StatusLead.ASSINADO.value, "quantidade": 0},
            {"nome": "Troca Titularidade", "status": StatusLead.TROCA_TITULARIDADE.value, "quantidade": 0},
            {"nome": "Cadastrando", "status": StatusLead.CADASTRANDO.value, "quantidade": 0},
            {"nome": "Convertido", "status": StatusLead.CONVERTIDO.value, "quantidade": 0}
        ]

        for l in leads.data:
            status = l.get("status")
            for etapa in etapas:
                if etapa["status"] == status:
                    etapa["quantidade"] += 1
                    break

        total = len(leads.data)
        convertidos = etapas[-1]["quantidade"]
        taxa = Decimal(str(convertidos)) / Decimal(str(total)) * 100 if total > 0 else Decimal("0")

        return {
            "etapas": etapas,
            "total": total,
            "taxa_conversao_geral": float(taxa)
        }

    # ========================
    # Novos metodos - Pipeline CRM
    # ========================

    async def vincular_uc(self, data: Dict[str, Any], user_id: str) -> Dict[str, Any]:
        """Vincula UC ao lead (apos autenticacao Energisa)"""

        lead_id = data["lead_id"]
        lead = await self.buscar(lead_id)

        uc_codigo = data["uc_codigo"]
        tipo = data.get("tipo", TipoVinculoUC.BENEFICIARIA.value)
        if hasattr(tipo, 'value'):
            tipo = tipo.value

        # Buscar ou criar UC pelo codigo
        # Formato: 6/1234567-8
        partes = uc_codigo.replace("/", "-").split("-")
        if len(partes) >= 2:
            cod_empresa = partes[0]
            cdc = partes[1] if len(partes) == 2 else partes[1]

        # Verificar se UC existe no sistema
        uc_result = self.supabase.table("unidades_consumidoras").select("id").eq("cdc", cdc).execute()

        if not uc_result.data:
            raise NotFoundError(f"UC {uc_codigo} nao encontrada no sistema")

        uc_id = uc_result.data[0]["id"]

        # Verificar se vinculo ja existe
        vinculo_existente = self.supabase.table("leads_ucs").select("id").eq(
            "lead_id", lead_id
        ).eq("uc_id", uc_id).execute()

        if vinculo_existente.data:
            raise ValidationError("UC ja vinculada a este lead")

        # Criar vinculo
        vinculo_data = {
            "lead_id": lead_id,
            "uc_id": uc_id,
            "tipo": tipo,
            "status": "ATIVO",
            "vinculado_por": user_id,
            "dados_extras": data.get("dados_extras")
        }

        result = self.supabase.table("leads_ucs").insert(vinculo_data).execute()

        # Atualizar status do lead se necessario
        if lead.get("status") == StatusLead.VINCULANDO.value:
            self.supabase.table("leads").update({
                "status": StatusLead.VINCULADO.value,
                "atualizado_em": datetime.now().isoformat()
            }).eq("id", lead_id).execute()

        return result.data[0]

    async def listar_ucs(self, lead_id: int) -> List[Dict[str, Any]]:
        """Lista UCs vinculadas ao lead"""

        await self.buscar(lead_id)  # Verifica se lead existe

        result = self.supabase.table("leads_ucs").select(
            "*, unidades_consumidoras(id, cdc, cod_empresa, digito_verificador, endereco, cidade, uf)"
        ).eq("lead_id", lead_id).execute()

        # Formatar resposta
        ucs = []
        for item in result.data:
            uc = item.get("unidades_consumidoras", {})
            ucs.append({
                "id": item["id"],
                "lead_id": item["lead_id"],
                "uc_id": item["uc_id"],
                "tipo": item["tipo"],
                "status": item["status"],
                "vinculado_em": item.get("vinculado_em"),
                "uc_codigo": f"{uc.get('cod_empresa', '')}/{uc.get('cdc', '')}-{uc.get('digito_verificador', '')}",
                "uc_endereco": f"{uc.get('endereco', '')} - {uc.get('cidade', '')}/{uc.get('uf', '')}",
                "dados_extras": item.get("dados_extras")
            })

        return ucs

    async def gerar_proposta(self, data: Dict[str, Any], user_id: str) -> Dict[str, Any]:
        """Gera proposta comercial para o lead"""

        lead_id = data["lead_id"]
        lead = await self.buscar(lead_id)

        consumo_kwh = data.get("consumo_kwh")
        valor_fatura = data.get("valor_fatura")
        quantidade_ucs = data.get("quantidade_ucs", 1)
        desconto_aplicado = Decimal(str(data.get("desconto_aplicado", "0.30")))

        # Buscar tarifa ANEEL (simplificado - usar valor padrao)
        tarifa_base = Decimal("0.76")  # R$/kWh aproximado

        # Calcular valores
        if valor_fatura:
            valor_fatura = Decimal(str(valor_fatura))
            custo_atual = valor_fatura * quantidade_ucs
        elif consumo_kwh:
            custo_atual = Decimal(str(consumo_kwh)) * tarifa_base * quantidade_ucs
        else:
            raise ValidationError("Informe consumo_kwh ou valor_fatura")

        custo_com_desconto = custo_atual * (1 - desconto_aplicado)
        economia_mensal = custo_atual - custo_com_desconto
        economia_anual = economia_mensal * 12
        economia_10_anos = economia_anual * 10 * Decimal("1.5")  # Fator de correcao

        # Contar versao
        versao_result = self.supabase.table("leads_propostas").select("versao").eq(
            "lead_id", lead_id
        ).order("versao", desc=True).limit(1).execute()

        versao = 1
        if versao_result.data:
            versao = versao_result.data[0]["versao"] + 1

        # Criar proposta
        proposta_data = {
            "lead_id": lead_id,
            "versao": versao,
            "consumo_kwh": consumo_kwh,
            "valor_fatura": float(valor_fatura) if valor_fatura else None,
            "quantidade_ucs": quantidade_ucs,
            "tarifa_aplicada": float(tarifa_base),
            "desconto_aplicado": float(desconto_aplicado),
            "custo_atual": float(custo_atual),
            "custo_com_desconto": float(custo_com_desconto),
            "economia_mensal": float(economia_mensal),
            "economia_anual": float(economia_anual),
            "economia_10_anos": float(economia_10_anos),
            "status": StatusProposta.GERADA.value,
            "criado_por": user_id
        }

        result = self.supabase.table("leads_propostas").insert(proposta_data).execute()

        # Atualizar status do lead
        self.supabase.table("leads").update({
            "status": StatusLead.SIMULACAO.value,
            "atualizado_em": datetime.now().isoformat()
        }).eq("id", lead_id).execute()

        return result.data[0]

    async def listar_propostas(self, lead_id: int) -> List[Dict[str, Any]]:
        """Lista propostas do lead"""

        await self.buscar(lead_id)

        result = self.supabase.table("leads_propostas").select("*").eq(
            "lead_id", lead_id
        ).order("versao", desc=True).execute()

        return result.data

    async def enviar_proposta(self, proposta_id: int) -> Dict[str, Any]:
        """Marca proposta como enviada"""

        result = self.supabase.table("leads_propostas").update({
            "status": StatusProposta.ENVIADA.value,
            "enviada_em": datetime.now().isoformat()
        }).eq("id", proposta_id).execute()

        if not result.data:
            raise NotFoundError("Proposta nao encontrada")

        # Atualizar status do lead
        lead_id = result.data[0]["lead_id"]
        self.supabase.table("leads").update({
            "status": StatusLead.AGUARDANDO_ACEITE.value,
            "atualizado_em": datetime.now().isoformat()
        }).eq("id", lead_id).execute()

        return result.data[0]

    async def aceitar_proposta(self, data: Dict[str, Any], user_id: str) -> Dict[str, Any]:
        """Cliente aceita proposta - inicia geracao de documentos"""

        lead_id = data["lead_id"]
        proposta_id = data["proposta_id"]

        lead = await self.buscar(lead_id)

        # Verificar proposta
        proposta = self.supabase.table("leads_propostas").select("*").eq(
            "id", proposta_id
        ).eq("lead_id", lead_id).single().execute()

        if not proposta.data:
            raise NotFoundError("Proposta nao encontrada")

        if proposta.data["status"] == StatusProposta.ACEITA.value:
            raise ValidationError("Proposta ja foi aceita")

        # Atualizar proposta
        self.supabase.table("leads_propostas").update({
            "status": StatusProposta.ACEITA.value,
            "aceita_em": datetime.now().isoformat()
        }).eq("id", proposta_id).execute()

        # Atualizar lead
        proposta_dados = {
            "proposta_id": proposta_id,
            "desconto": proposta.data["desconto_aplicado"],
            "economia_mensal": proposta.data["economia_mensal"],
            "economia_anual": proposta.data["economia_anual"]
        }

        self.supabase.table("leads").update({
            "status": StatusLead.ACEITO.value,
            "proposta_aceita_em": datetime.now().isoformat(),
            "proposta_dados": proposta_dados,
            "atualizado_em": datetime.now().isoformat()
        }).eq("id", lead_id).execute()

        return {
            "lead_id": lead_id,
            "proposta_id": proposta_id,
            "status": StatusLead.ACEITO.value,
            "message": "Proposta aceita! Proximo passo: gerar documentos"
        }

    async def atualizar_titularidade(self, data: Dict[str, Any], user_id: str) -> Dict[str, Any]:
        """Atualiza status do processo de troca de titularidade"""

        lead_id = data["lead_id"]
        lead = await self.buscar(lead_id)

        status = data["status"]
        if hasattr(status, 'value'):
            status = status.value

        update_data = {
            "titularidade_status": status,
            "atualizado_em": datetime.now().isoformat()
        }

        if data.get("protocolo"):
            update_data["titularidade_protocolo"] = data["protocolo"]

        if status == TitularidadeStatus.SOLICITADO.value:
            update_data["titularidade_data_solicitacao"] = datetime.now().date().isoformat()
            update_data["status"] = StatusLead.TROCA_TITULARIDADE.value

        if status == TitularidadeStatus.APROVADO.value:
            update_data["titularidade_data_conclusao"] = datetime.now().date().isoformat()
            update_data["status"] = StatusLead.CADASTRANDO.value

        if data.get("observacoes"):
            obs_atual = lead.get("observacoes") or ""
            update_data["observacoes"] = f"{obs_atual}\n[Titularidade] {data['observacoes']}".strip()

        result = self.supabase.table("leads").update(update_data).eq("id", lead_id).execute()
        return result.data[0]

    async def marcar_perdido_categorizado(self, data: Dict[str, Any], user_id: str) -> Dict[str, Any]:
        """Marca lead como perdido com categoria"""

        lead_id = data["lead_id"]
        lead = await self.buscar(lead_id)

        if lead.get("status") == StatusLead.CONVERTIDO.value:
            raise ValidationError("Lead ja foi convertido")

        categoria = data["motivo_categoria"]
        if hasattr(categoria, 'value'):
            categoria = categoria.value

        obs_atual = lead.get("observacoes") or ""
        observacoes = data.get("observacoes", "")

        result = self.supabase.table("leads").update({
            "status": StatusLead.PERDIDO.value,
            "motivo_perda_categoria": categoria,
            "observacoes": f"{obs_atual}\n[Perdido - {categoria}] {observacoes}".strip(),
            "atualizado_em": datetime.now().isoformat()
        }).eq("id", lead_id).execute()

        return result.data[0]

    async def converter_completo(self, data: Dict[str, Any], user_id: str) -> Dict[str, Any]:
        """Converte lead em beneficiario (fluxo completo)"""

        lead_id = data["lead_id"]
        lead = await self.buscar(lead_id)

        if lead.get("status") == StatusLead.CONVERTIDO.value:
            raise ValidationError("Lead ja foi convertido")

        usina_id = data["usina_id"]
        uc_id = data["uc_id"]
        desconto = Decimal(str(data["desconto_percentual"]))
        percentual_rateio = Decimal(str(data.get("percentual_rateio", 0)))
        criar_contrato = data.get("criar_contrato", True)
        enviar_convite = data.get("enviar_convite", True)

        # Verificar se usina existe
        usina = self.supabase.table("usinas").select("id, nome").eq("id", usina_id).single().execute()
        if not usina.data:
            raise NotFoundError("Usina nao encontrada")

        # Verificar se UC existe
        uc = self.supabase.table("unidades_consumidoras").select("id").eq("id", uc_id).single().execute()
        if not uc.data:
            raise NotFoundError("UC nao encontrada")

        # Criar beneficiario
        beneficiario_data = {
            "usina_id": usina_id,
            "uc_id": uc_id,
            "nome": lead["nome"],
            "email": lead.get("email"),
            "telefone": lead.get("telefone"),
            "cpf": lead.get("cpf") or lead.get("cnpj"),
            "desconto": float(desconto),
            "percentual_rateio": float(percentual_rateio),
            "status": "PENDENTE",
            "origem": "LEAD",
            "lead_id": lead_id,
            "criado_por": user_id
        }

        beneficiario = self.supabase.table("beneficiarios").insert(beneficiario_data).execute()
        beneficiario_id = beneficiario.data[0]["id"]

        contrato_id = None
        convite_id = None

        # Criar contrato se solicitado
        if criar_contrato:
            contrato_data = {
                "tipo": "BENEFICIO_GD",
                "usina_id": usina_id,
                "beneficiario_id": beneficiario_id,
                "desconto_percentual": float(desconto),
                "status": "RASCUNHO",
                "criado_por": user_id
            }
            contrato = self.supabase.table("contratos").insert(contrato_data).execute()
            contrato_id = contrato.data[0]["id"]

        # Criar convite se solicitado
        if enviar_convite and lead.get("email"):
            import secrets
            token = secrets.token_urlsafe(32)
            convite_data = {
                "tipo": "BENEFICIARIO",
                "email": lead["email"],
                "cpf": lead.get("cpf"),
                "beneficiario_id": beneficiario_id,
                "token": token,
                "status": "PENDENTE",
                "criado_por": user_id
            }
            convite = self.supabase.table("convites").insert(convite_data).execute()
            convite_id = convite.data[0]["id"]

            # Atualizar beneficiario com data do convite
            self.supabase.table("beneficiarios").update({
                "convite_enviado_em": datetime.now().isoformat()
            }).eq("id", beneficiario_id).execute()

        # Atualizar lead
        self.supabase.table("leads").update({
            "status": StatusLead.CONVERTIDO.value,
            "convertido_em": datetime.now().isoformat(),
            "beneficiario_id": beneficiario_id,
            "contrato_id": contrato_id,
            "atualizado_em": datetime.now().isoformat()
        }).eq("id", lead_id).execute()

        return {
            "lead_id": lead_id,
            "beneficiario_id": beneficiario_id,
            "contrato_id": contrato_id,
            "convite_id": convite_id,
            "message": "Lead convertido com sucesso!"
        }

    # ========================
    # Documentos do Lead
    # ========================

    async def listar_documentos(self, lead_id: int) -> List[Dict[str, Any]]:
        """Lista documentos do lead"""

        await self.buscar(lead_id)

        result = self.supabase.table("leads_documentos").select("*").eq(
            "lead_id", lead_id
        ).order("criado_em", desc=True).execute()

        return result.data

    async def adicionar_documento(self, data: Dict[str, Any], user_id: str) -> Dict[str, Any]:
        """Adiciona documento ao lead"""

        lead_id = data["lead_id"]
        await self.buscar(lead_id)

        tipo = data["tipo"]
        if hasattr(tipo, 'value'):
            tipo = tipo.value

        doc_data = {
            "lead_id": lead_id,
            "tipo": tipo,
            "nome_arquivo": data["nome_arquivo"],
            "url_arquivo": data.get("url_arquivo"),
            "tamanho_bytes": data.get("tamanho_bytes"),
            "mime_type": data.get("mime_type"),
            "descricao": data.get("descricao"),
            "enviado_por": user_id
        }

        result = self.supabase.table("leads_documentos").insert(doc_data).execute()
        return result.data[0]

    async def remover_documento(self, documento_id: int) -> bool:
        """Remove documento do lead"""

        result = self.supabase.table("leads_documentos").delete().eq("id", documento_id).execute()
        return len(result.data) > 0
