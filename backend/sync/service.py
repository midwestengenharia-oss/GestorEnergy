"""
Sync Service - Serviço de sincronização automática com a Energisa
Executa a cada 10 minutos para manter os dados atualizados
"""

import asyncio
import logging
import base64
from datetime import datetime, timezone
from typing import Optional
from decimal import Decimal
import re

from backend.core.database import SupabaseClient
from backend.energisa.service import EnergisaService
from backend.energisa.session_manager import SessionManager
from backend.config import settings

logger = logging.getLogger(__name__)


def parse_date(date_str: str) -> Optional[str]:
    """
    Converte data da Energisa (DD/MM/YYYY ou DD/MM/YYYY HH:MM:SS) para ISO format.

    Args:
        date_str: Data no formato brasileiro

    Returns:
        Data no formato ISO (YYYY-MM-DD) ou None
    """
    if not date_str:
        return None

    try:
        # Tenta vários formatos
        formats = [
            "%d/%m/%Y %H:%M:%S",
            "%d/%m/%Y",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d",
        ]

        for fmt in formats:
            try:
                dt = datetime.strptime(date_str, fmt)
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                continue

        # Se nenhum formato funcionou, tenta extrair YYYY-MM-DD com regex
        match = re.search(r'(\d{4})-(\d{2})-(\d{2})', date_str)
        if match:
            return date_str[:10]

        return None

    except Exception:
        return None


class SyncService:
    """Serviço de sincronização de dados com a Energisa"""

    def __init__(self):
        self.db = SupabaseClient(admin=True)  # Usa admin para bypass RLS
        self._running = False

    async def sincronizar_todas_ucs(self) -> dict:
        """
        Sincroniza todas as UCs que possuem sessão ativa na Energisa.

        Returns:
            dict com estatísticas da sincronização
        """
        logger.info("🔄 Iniciando sincronização de todas as UCs...")

        stats = {
            "ucs_processadas": 0,
            "ucs_atualizadas": 0,
            "faturas_sincronizadas": 0,
            "gd_sincronizados": 0,
            "erros": 0,
            "inicio": datetime.now(timezone.utc).isoformat(),
            "fim": None
        }

        try:
            # Busca todas as UCs com seus usuários
            result = self.db.table("unidades_consumidoras").select(
                "*, usuarios!inner(cpf)"
            ).execute()

            ucs = result.data or []
            logger.info(f"   📋 {len(ucs)} UCs encontradas para sincronizar")

            # Agrupa UCs por CPF para otimizar uso de sessão
            ucs_por_cpf = {}
            for uc in ucs:
                cpf = uc.get("usuarios", {}).get("cpf")
                if cpf:
                    cpf_limpo = cpf.replace(".", "").replace("-", "")
                    if cpf_limpo not in ucs_por_cpf:
                        ucs_por_cpf[cpf_limpo] = []
                    ucs_por_cpf[cpf_limpo].append(uc)

            # Processa cada CPF
            for cpf, ucs_do_cpf in ucs_por_cpf.items():
                try:
                    # Verifica se existe sessão para este CPF (ignora expiração para tentar refresh)
                    cookies = SessionManager.load_session(cpf, ignore_expiry=True)
                    if not cookies:
                        logger.debug(f"   ⏭️ CPF {cpf[:3]}***{cpf[-2:]}: sem sessão salva")
                        continue

                    # Carrega cookies no serviço mesmo se expirados
                    svc = EnergisaService(cpf)
                    svc.cookies = cookies
                    svc._apply_cookies(cookies)

                    # Faz refresh token ANTES de começar a sincronizar
                    logger.info(f"   🔄 Renovando token para CPF {cpf[:3]}***{cpf[-2:]}...")
                    if not svc._refresh_token():
                        logger.warning(f"   ⏭️ CPF {cpf[:3]}***{cpf[-2:]}: falha no refresh, pulando")
                        continue

                    # Verifica se está autenticado após refresh
                    if not svc.is_authenticated():
                        logger.debug(f"   ⏭️ CPF {cpf[:3]}***{cpf[-2:]}: não autenticado após refresh")
                        continue

                    logger.info(f"   👤 Processando CPF {cpf[:3]}***{cpf[-2:]} ({len(ucs_do_cpf)} UCs)")

                    for uc in ucs_do_cpf:
                        try:
                            stats["ucs_processadas"] += 1

                            # Sincroniza dados da UC
                            uc_atualizada = await self._sincronizar_uc(svc, uc)
                            if uc_atualizada:
                                stats["ucs_atualizadas"] += 1

                            # Sincroniza faturas da UC
                            faturas_sync = await self._sincronizar_faturas(svc, uc)
                            stats["faturas_sincronizadas"] += faturas_sync

                            # Sincroniza dados de GD da UC
                            gd_sync = await self._sincronizar_gd(svc, uc)
                            stats["gd_sincronizados"] += gd_sync

                        except Exception as e:
                            error_msg = str(e).lower()
                            # Se for erro de autenticação, tenta refresh e retry uma vez
                            if "401" in error_msg or "unauthorized" in error_msg or "token" in error_msg:
                                logger.warning(f"   🔄 Token expirado durante sync da UC {uc.get('cdc')}, tentando refresh...")
                                if svc._refresh_token():
                                    try:
                                        # Retry após refresh
                                        uc_atualizada = await self._sincronizar_uc(svc, uc)
                                        if uc_atualizada:
                                            stats["ucs_atualizadas"] += 1
                                        faturas_sync = await self._sincronizar_faturas(svc, uc)
                                        stats["faturas_sincronizadas"] += faturas_sync
                                        gd_sync = await self._sincronizar_gd(svc, uc)
                                        stats["gd_sincronizados"] += gd_sync
                                        continue  # Sucesso no retry
                                    except Exception as retry_err:
                                        logger.warning(f"   ⚠️ Retry falhou para UC {uc.get('cdc')}: {retry_err}")

                            logger.warning(f"   ⚠️ Erro ao sincronizar UC {uc.get('cdc')}: {e}")
                            stats["erros"] += 1

                except Exception as e:
                    logger.error(f"   ❌ Erro ao processar CPF {cpf[:3]}***: {e}")
                    stats["erros"] += 1

        except Exception as e:
            logger.error(f"❌ Erro geral na sincronização: {e}")
            stats["erros"] += 1

        stats["fim"] = datetime.now(timezone.utc).isoformat()

        logger.info(
            f"✅ Sincronização concluída: "
            f"{stats['ucs_processadas']} UCs processadas, "
            f"{stats['ucs_atualizadas']} atualizadas, "
            f"{stats['faturas_sincronizadas']} faturas, "
            f"{stats['gd_sincronizados']} registros GD, "
            f"{stats['erros']} erros"
        )

        return stats

    async def _sincronizar_uc(self, svc: EnergisaService, uc: dict) -> bool:
        """
        Sincroniza informações de uma UC com a Energisa.

        Args:
            svc: Serviço Energisa autenticado
            uc: Dados da UC do banco

        Returns:
            True se houve atualização
        """
        uc_id = uc.get("id")
        cdc = uc.get("cdc")
        digito = uc.get("digito_verificador")
        empresa = uc.get("cod_empresa", 6)

        logger.debug(f"      🔍 Sincronizando UC {cdc}...")

        try:
            # Busca info atualizada na Energisa (em thread para não bloquear)
            uc_data = {
                "cdc": cdc,
                "digitoVerificadorCdc": digito,
                "codigoEmpresaWeb": empresa
            }

            info = await asyncio.to_thread(svc.get_uc_info, uc_data)

            if not info or info.get("errored"):
                logger.warning(f"      ⚠️ Não foi possível obter info da UC {cdc}")
                return False

            # Extrai dados do retorno
            infos = info.get("infos", {})
            if not infos:
                return False

            # Prepara dados para atualização
            update_data = {
                "ultima_sincronizacao": datetime.now(timezone.utc).isoformat()
            }

            # Mapeia campos da API para o banco
            field_mapping = {
                "nomeTitular": "nome_titular",
                "enderecoImovel": "endereco",
                "numeroImovel": "numero_imovel",
                "complementoImovel": "complemento",
                "bairro": "bairro",
                "nomeMunicipio": "cidade",
                "uf": "uf",
                "cep": "cep",
                "tipoLigacao": "tipo_ligacao",
                "classeLeitura": "classe_leitura",
                "grupoLeitura": "grupo_leitura",
                "numeroMedidor": "numero_medidor",
            }

            for api_field, db_field in field_mapping.items():
                if api_field in infos and infos[api_field]:
                    update_data[db_field] = infos[api_field]

            # Campos booleanos e especiais
            if "ucAtiva" in infos:
                update_data["uc_ativa"] = infos["ucAtiva"]
            if "ucCortada" in infos:
                update_data["uc_cortada"] = infos["ucCortada"]
            if "contratoAtivo" in infos:
                update_data["contrato_ativo"] = infos["contratoAtivo"]
            if "baixaRenda" in infos:
                update_data["baixa_renda"] = infos["baixaRenda"]

            # Coordenadas
            if "latitude" in infos and infos["latitude"]:
                update_data["latitude"] = str(infos["latitude"])
            if "longitude" in infos and infos["longitude"]:
                update_data["longitude"] = str(infos["longitude"])

            # Geração Distribuída
            if "geracaoDistribuida" in infos:
                update_data["is_geradora"] = infos["geracaoDistribuida"] is not None

            # Atualiza no banco
            self.db.table("unidades_consumidoras").update(
                update_data
            ).eq("id", uc_id).execute()

            logger.debug(f"      ✅ UC {cdc} atualizada")
            return True

        except Exception as e:
            logger.error(f"      ❌ Erro ao sincronizar UC {cdc}: {e}")
            return False

    async def _sincronizar_faturas(self, svc: EnergisaService, uc: dict) -> int:
        """
        Sincroniza faturas de uma UC com a Energisa.

        Args:
            svc: Serviço Energisa autenticado
            uc: Dados da UC do banco

        Returns:
            Número de faturas sincronizadas
        """
        uc_id = uc.get("id")
        cdc = uc.get("cdc")
        digito = uc.get("digito_verificador")
        empresa = uc.get("cod_empresa", 6)

        logger.debug(f"      📄 Sincronizando faturas da UC {cdc}...")

        try:
            uc_data = {
                "cdc": cdc,
                "digitoVerificadorCdc": digito,
                "codigoEmpresaWeb": empresa
            }

            # Executa em thread para não bloquear o event loop
            faturas = await asyncio.to_thread(svc.listar_faturas, uc_data)

            if not faturas:
                logger.debug(f"      ℹ️ Nenhuma fatura encontrada para UC {cdc}")
                return 0

            # Limita ao número máximo de faturas configurado (mais recentes)
            total_faturas_disponiveis = len(faturas)
            faturas = faturas[:settings.SYNC_MAX_FATURAS_POR_UC]

            if total_faturas_disponiveis > settings.SYNC_MAX_FATURAS_POR_UC:
                logger.debug(
                    f"      ⚡ Processando {len(faturas)} de {total_faturas_disponiveis} "
                    f"faturas disponíveis (limite: {settings.SYNC_MAX_FATURAS_POR_UC})"
                )

            faturas_salvas = 0

            for fatura_api in faturas:
                try:
                    # Prepara dados da fatura
                    mes = fatura_api.get("mesReferencia")
                    ano = fatura_api.get("anoReferencia")

                    if not mes or not ano:
                        continue

                    fatura_data = {
                        "uc_id": uc_id,
                        "numero_fatura": fatura_api.get("numeroFatura"),
                        "mes_referencia": mes,
                        "ano_referencia": ano,
                        "valor_fatura": fatura_api.get("valorFatura", 0),
                        "valor_liquido": fatura_api.get("valorLiquido"),
                        "consumo": fatura_api.get("consumo"),
                        "leitura_atual": fatura_api.get("leituraAtual"),
                        "leitura_anterior": fatura_api.get("leituraAnterior"),
                        "media_consumo": fatura_api.get("mediaConsumo"),
                        "quantidade_dias": fatura_api.get("quantidadeDiaConsumo"),
                        "valor_iluminacao_publica": fatura_api.get("valorIluminacaoPublica"),
                        "valor_icms": fatura_api.get("valorICMS"),
                        "bandeira_tarifaria": fatura_api.get("bandeiraTarifaria"),
                        "data_leitura": parse_date(fatura_api.get("dataLeitura")),
                        "data_vencimento": parse_date(fatura_api.get("dataVencimento")),
                        "data_pagamento": parse_date(fatura_api.get("dataPagamento")),
                        "indicador_situacao": fatura_api.get("indicadorSituacao"),
                        "indicador_pagamento": fatura_api.get("indicadorPagamento"),
                        "situacao_pagamento": fatura_api.get("situacaoPagamento"),
                        "qr_code_pix": fatura_api.get("qrCodePix"),
                        "qr_code_pix_image": fatura_api.get("qrCodePixImage64"),
                        "codigo_barras": fatura_api.get("codigoBarras"),
                        "dados_api": fatura_api,
                        "sincronizado_em": datetime.now(timezone.utc).isoformat()
                    }

                    # Remove valores None
                    fatura_data = {k: v for k, v in fatura_data.items() if v is not None}

                    # Verifica se já tem PDF baixado
                    existing_fatura = self.db.table("faturas").select(
                        "id, pdf_base64"
                    ).eq("uc_id", uc_id).eq(
                        "mes_referencia", mes
                    ).eq("ano_referencia", ano).execute()

                    has_pdf = existing_fatura.data and existing_fatura.data[0].get("pdf_base64")

                    # Upsert (insert ou update)
                    self.db.table("faturas").upsert(
                        fatura_data,
                        on_conflict="uc_id,mes_referencia,ano_referencia"
                    ).execute()

                    faturas_salvas += 1

                    # Baixa PDF se ainda não tem
                    if not has_pdf and fatura_api.get("numeroFatura"):
                        try:
                            pdf_request_data = {
                                "ano": ano,
                                "mes": mes,
                                "numeroFatura": fatura_api.get("numeroFatura")
                            }
                            pdf_bytes = await asyncio.to_thread(
                                svc.download_pdf, uc_data, pdf_request_data
                            )

                            if pdf_bytes:
                                pdf_base64_str = base64.b64encode(pdf_bytes).decode('utf-8')

                                self.db.table("faturas").update({
                                    "pdf_base64": pdf_base64_str,
                                    "pdf_baixado_em": datetime.now(timezone.utc).isoformat()
                                }).eq("uc_id", uc_id).eq(
                                    "mes_referencia", mes
                                ).eq("ano_referencia", ano).execute()

                                logger.debug(f"      📄 PDF baixado para fatura {mes:02d}/{ano}")
                        except Exception as pdf_err:
                            logger.warning(f"      ⚠️ Erro ao baixar PDF {mes:02d}/{ano}: {pdf_err}")

                except Exception as e:
                    logger.warning(f"      ⚠️ Erro ao salvar fatura: {e}")

            logger.debug(f"      ✅ {faturas_salvas} faturas sincronizadas para UC {cdc}")
            return faturas_salvas

        except Exception as e:
            logger.error(f"      ❌ Erro ao sincronizar faturas da UC {cdc}: {e}")
            return 0

    async def _sincronizar_gd(self, svc: EnergisaService, uc: dict) -> int:
        """
        Sincroniza histórico de Geração Distribuída de uma UC.

        Args:
            svc: Serviço Energisa autenticado
            uc: Dados da UC do banco

        Returns:
            Número de registros de GD sincronizados
        """
        uc_id = uc.get("id")
        cdc = uc.get("cdc")
        digito = uc.get("digito_verificador")
        empresa = uc.get("cod_empresa", 6)

        logger.debug(f"      ⚡ Sincronizando GD da UC {cdc}...")

        try:
            uc_data = {
                "cdc": cdc,
                "digitoVerificadorCdc": digito,
                "codigoEmpresaWeb": empresa
            }

            # Busca detalhes de GD (histórico de 13 meses) - em thread para não bloquear
            gd_data = await asyncio.to_thread(svc.get_gd_details, uc_data)

            if not gd_data:
                logger.debug(f"      ℹ️ Nenhum dado de GD para UC {cdc}")
                return 0

            # Extrai histórico (pode vir em diferentes formatos)
            historico = []
            if isinstance(gd_data, dict):
                # Formato {"infos": [...]} ou {"infos": {"historico": [...]}}
                infos = gd_data.get("infos")
                if isinstance(infos, list):
                    historico = infos
                elif isinstance(infos, dict):
                    historico = infos.get("historico", [])
                    # Se não tiver historico mas tiver dados diretos, usa infos como item único
                    if not historico and infos.get("mesReferencia"):
                        historico = [infos]

            if not historico:
                logger.debug(f"      ℹ️ Histórico GD vazio para UC {cdc}")
                return 0

            registros_salvos = 0

            for item in historico:
                try:
                    mes = item.get("mesReferencia") or item.get("mes")
                    ano = item.get("anoReferencia") or item.get("ano")

                    if not mes or not ano:
                        continue

                    gd_record = {
                        "uc_id": uc_id,
                        "mes_referencia": int(mes),
                        "ano_referencia": int(ano),
                        "saldo_anterior_conv": item.get("saldoAnteriorConv"),
                        "injetado_conv": item.get("injetadoConv"),
                        "total_recebido_rede": item.get("totalRecebidoRede"),
                        "consumo_recebido_conv": item.get("consumoRecebidoConv"),
                        "consumo_injetado_compensado": item.get("consumoInjetadoCompensadoConv"),
                        "consumo_transferido_conv": item.get("consumoTransferidoConv"),
                        "consumo_compensado_conv": item.get("consumoCompensadoConv"),
                        "saldo_compensado_anterior": item.get("saldoCompensadoAnteriorConv"),
                        "composicao_energia": item.get("composicaoEnergiaInjetadas"),
                        "discriminacao_energia": item.get("discriminacaoEnergiaInjetadas"),
                        "chave_primaria": item.get("chavePrimaria"),
                        "dados_api": item,
                        "sincronizado_em": datetime.now(timezone.utc).isoformat()
                    }

                    # Tenta capturar data de modificação
                    data_mod = item.get("dataModificacaoRegistro")
                    if data_mod:
                        gd_record["data_modificacao_registro"] = data_mod

                    # Remove valores None
                    gd_record = {k: v for k, v in gd_record.items() if v is not None}

                    # Upsert (insert ou update)
                    self.db.table("historico_gd").upsert(
                        gd_record,
                        on_conflict="uc_id,mes_referencia,ano_referencia"
                    ).execute()

                    registros_salvos += 1

                except Exception as e:
                    logger.warning(f"      ⚠️ Erro ao salvar registro GD: {e}")

            # Atualiza saldo acumulado na UC se disponível
            if registros_salvos > 0 and historico:
                # Pega o registro mais recente (primeiro da lista, que vem ordenada desc)
                primeiro = historico[0] if isinstance(historico, list) else historico
                saldo_atual = primeiro.get("saldoAnteriorConv") or primeiro.get("saldoCompensadoAnteriorConv") or 0

                # Verifica se UC é geradora ou beneficiária de usina
                is_geradora = uc.get("is_geradora", False)

                # Verifica se existe beneficiário ativo para esta UC (qualquer tipo)
                benef_result = self.db.table("beneficiarios").select(
                    "id, usina_id, tipo"
                ).eq("uc_id", uc_id).eq("status", "ATIVO").execute()
                beneficiarios_ativos = benef_result.data or []
                tem_usina_vinculada = any(b.get("usina_id") for b in beneficiarios_ativos)
                tem_beneficiario = len(beneficiarios_ativos) > 0

                # Se tem saldo mas não é geradora nem beneficiária de usina = GD Avulso
                tem_gd_avulso = saldo_atual > 0 and not is_geradora and not tem_usina_vinculada

                try:
                    self.db.table("unidades_consumidoras").update({
                        "saldo_acumulado": saldo_atual,
                        "saldo_creditos_gd": saldo_atual,
                        "tem_gd_avulso": tem_gd_avulso
                    }).eq("id", uc_id).execute()

                    if tem_gd_avulso:
                        logger.info(f"      🔶 UC {cdc} marcada como GD Avulso (saldo: {saldo_atual} kWh)")

                        # Se não tem beneficiário, cria automaticamente usando dados do titular
                        if not tem_beneficiario:
                            await self._criar_beneficiario_avulso_automatico(uc_id, uc, cdc)

                except Exception as e:
                    logger.warning(f"      ⚠️ Erro ao atualizar saldo/avulso UC: {e}")

            logger.debug(f"      ✅ {registros_salvos} registros GD sincronizados para UC {cdc}")
            return registros_salvos

        except Exception as e:
            logger.error(f"      ❌ Erro ao sincronizar GD da UC {cdc}: {e}")
            return 0

    async def _criar_beneficiario_avulso_automatico(
        self,
        uc_id: int,
        uc: dict,
        cdc: int
    ) -> bool:
        """
        Cria automaticamente um beneficiário AVULSO para UCs com GD por transferência.

        Usa os dados do titular da UC como dados do beneficiário.
        O CPF fica vazio pois o titular pode não ser quem paga (será preenchido depois).

        Args:
            uc_id: ID da UC
            uc: Dados da UC do banco
            cdc: Código da UC (para logs)

        Returns:
            True se criou com sucesso
        """
        try:
            # Busca dados completos da UC (pode não ter vindo todos os campos)
            uc_completa = self.db.table("unidades_consumidoras").select(
                "id, usuario_id, nome_titular, cpf_cnpj_titular"
            ).eq("id", uc_id).single().execute()

            if not uc_completa.data:
                logger.warning(f"      ⚠️ Não encontrou UC {uc_id} para criar beneficiário")
                return False

            uc_data = uc_completa.data
            nome_titular = uc_data.get("nome_titular") or "Titular da UC"
            usuario_id = uc_data.get("usuario_id")

            # Cria beneficiário avulso
            beneficiario_data = {
                "uc_id": uc_id,
                "usuario_id": usuario_id,  # Vincula ao mesmo usuário da UC
                "usina_id": None,  # Avulso não tem usina
                "tipo": "AVULSO",
                "nome": nome_titular,
                "cpf": "",  # CPF será preenchido manualmente depois
                "email": None,
                "telefone": None,
                "percentual_rateio": 100.00,  # 100% para avulso (não compartilha)
                "desconto": 0.30,  # Desconto padrão de 30%
                "status": "ATIVO",
                "ativado_em": datetime.now(timezone.utc).isoformat()
            }

            self.db.table("beneficiarios").insert(beneficiario_data).execute()
            logger.info(f"      ✅ Beneficiário AVULSO criado automaticamente para UC {cdc} ({nome_titular})")
            return True

        except Exception as e:
            logger.warning(f"      ⚠️ Erro ao criar beneficiário avulso para UC {cdc}: {e}")
            return False

    async def sincronizar_gd_usuario(self, usuario_id: str, cpf: str) -> dict:
        """
        Sincroniza apenas dados de GD de todas as UCs de um usuário.

        Args:
            usuario_id: ID do usuário
            cpf: CPF do usuário (para sessão Energisa)

        Returns:
            dict com estatísticas da sincronização
        """
        logger.info(f"🔄 Sincronizando GD do usuário {usuario_id}...")

        stats = {
            "success": True,
            "ucs_processadas": 0,
            "gd_sincronizados": 0,
            "erros": 0
        }

        try:
            # Busca UCs do usuário
            result = self.db.table("unidades_consumidoras").select(
                "id, cdc, digito_verificador, cod_empresa, apelido"
            ).eq("usuario_id", usuario_id).execute()

            ucs = result.data or []

            if not ucs:
                logger.info("   ℹ️ Usuário não tem UCs cadastradas")
                return stats

            # Cria serviço Energisa
            cpf_limpo = cpf.replace(".", "").replace("-", "").replace(" ", "")
            svc = EnergisaService(cpf_limpo)

            if not svc.is_authenticated():
                logger.warning("   ⚠️ Sessão Energisa não ativa")
                return {
                    "success": False,
                    "error": "Sessão da Energisa expirada. Faça login novamente.",
                    **stats
                }

            # Faz refresh token ANTES de sincronizar
            logger.info(f"   🔄 Renovando token...")
            if not svc._refresh_token():
                logger.warning("   ⚠️ Falha no refresh token")
                return {
                    "success": False,
                    "error": "Falha ao renovar sessão. Faça login novamente.",
                    **stats
                }

            # Sincroniza GD de cada UC
            for uc in ucs:
                stats["ucs_processadas"] += 1
                try:
                    gd_sync = await self._sincronizar_gd(svc, uc)
                    stats["gd_sincronizados"] += gd_sync
                except Exception as e:
                    logger.warning(f"   ⚠️ Erro ao sincronizar GD da UC {uc.get('cdc')}: {e}")
                    stats["erros"] += 1

            logger.info(
                f"✅ Sincronização de GD concluída: "
                f"{stats['ucs_processadas']} UCs, "
                f"{stats['gd_sincronizados']} registros GD, "
                f"{stats['erros']} erros"
            )

            return stats

        except Exception as e:
            logger.error(f"❌ Erro na sincronização de GD: {e}")
            return {
                "success": False,
                "error": str(e),
                **stats
            }

    async def sincronizar_uc_especifica(self, uc_id: int, cpf: str) -> dict:
        """
        Sincroniza uma UC específica.

        Args:
            uc_id: ID da UC
            cpf: CPF do usuário para autenticação

        Returns:
            dict com resultado da sincronização
        """
        logger.info(f"🔄 Sincronizando UC {uc_id}...")

        try:
            # Busca a UC
            result = self.db.table("unidades_consumidoras").select("*").eq(
                "id", uc_id
            ).single().execute()

            if not result.data:
                return {"success": False, "error": "UC não encontrada"}

            uc = result.data

            # Cria serviço Energisa
            cpf_limpo = cpf.replace(".", "").replace("-", "")
            svc = EnergisaService(cpf_limpo)

            if not svc.is_authenticated():
                return {"success": False, "error": "Sessão da Energisa expirada"}

            # Faz refresh token ANTES de sincronizar
            logger.info(f"   🔄 Renovando token...")
            if not svc._refresh_token():
                logger.warning("   ⚠️ Falha no refresh token")
                return {"success": False, "error": "Falha ao renovar sessão. Faça login novamente."}

            # Sincroniza
            uc_atualizada = await self._sincronizar_uc(svc, uc)
            faturas_sync = await self._sincronizar_faturas(svc, uc)
            gd_sync = await self._sincronizar_gd(svc, uc)

            return {
                "success": True,
                "uc_atualizada": uc_atualizada,
                "faturas_sincronizadas": faturas_sync,
                "gd_sincronizados": gd_sync
            }

        except Exception as e:
            logger.error(f"❌ Erro ao sincronizar UC {uc_id}: {e}")
            return {"success": False, "error": str(e)}


# Instância global do serviço
sync_service = SyncService()
