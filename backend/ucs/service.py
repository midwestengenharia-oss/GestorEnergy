"""
UCs Service - Lógica de negócio para Unidades Consumidoras
"""

from typing import Optional, List, Tuple
import logging
import math

from backend.core.database import db_admin
from backend.core.exceptions import NotFoundError, ConflictError, ValidationError
from backend.ucs.schemas import (
    UCVincularRequest,
    UCVincularPorFormatoRequest,
    UCUpdateRequest,
    UCConfigGDRequest,
    UCResponse,
    UCFiltros,
    UCResumoResponse,
    UCGDInfoResponse,
    UCBeneficiariaResponse,
    HistoricoGDResponse,
    UCComGDResponse,
    GDResumoResponse,
)

logger = logging.getLogger(__name__)


class UCsService:
    """Serviço de gestão de Unidades Consumidoras"""

    def __init__(self):
        self.db = db_admin

    def _parse_uc_formatada(self, uc_formatada: str) -> tuple:
        """
        Parse do formato de UC para componentes.

        Args:
            uc_formatada: UC no formato 6/4242904-3

        Returns:
            Tupla (cod_empresa, cdc, digito_verificador)
        """
        import re
        partes = re.split(r'[/-]', uc_formatada)
        return int(partes[0]), int(partes[1]), int(partes[2])

    def _formatar_uc(self, cod_empresa: int, cdc: int, digito: int) -> str:
        """Formata UC para exibição"""
        return f"{cod_empresa}/{cdc}-{digito}"

    async def listar(
        self,
        filtros: Optional[UCFiltros] = None,
        page: int = 1,
        per_page: int = 20
    ) -> Tuple[List[UCResponse], int]:
        """
        Lista UCs com filtros e paginação.

        Args:
            filtros: Filtros de busca
            page: Página atual
            per_page: Itens por página

        Returns:
            Tupla (lista de UCs, total)
        """
        query = self.db.unidades_consumidoras().select("*", count="exact")

        # Aplicar filtros
        if filtros:
            if filtros.usuario_id:
                query = query.eq("usuario_id", filtros.usuario_id)
            if filtros.cdc:
                query = query.eq("cdc", filtros.cdc)
            if filtros.cidade:
                query = query.ilike("cidade", f"%{filtros.cidade}%")
            if filtros.uf:
                query = query.eq("uf", filtros.uf)
            if filtros.is_geradora is not None:
                query = query.eq("is_geradora", filtros.is_geradora)
            if filtros.uc_ativa is not None:
                query = query.eq("uc_ativa", filtros.uc_ativa)
            if filtros.usuario_titular is not None:
                query = query.eq("usuario_titular", filtros.usuario_titular)

        # Paginação
        offset = (page - 1) * per_page
        query = query.range(offset, offset + per_page - 1)

        # Ordenação
        query = query.order("criado_em", desc=True)

        result = query.execute()

        ucs = []
        for uc in result.data or []:
            ucs.append(UCResponse(
                id=uc["id"],
                usuario_id=uc["usuario_id"],
                cod_empresa=uc["cod_empresa"],
                cdc=uc["cdc"],
                digito_verificador=uc["digito_verificador"],
                uc_formatada=self._formatar_uc(
                    uc["cod_empresa"], uc["cdc"], uc["digito_verificador"]
                ),
                apelido=uc.get("apelido"),
                cpf_cnpj_titular=uc.get("cpf_cnpj_titular"),
                nome_titular=uc.get("nome_titular"),
                usuario_titular=uc.get("usuario_titular", False),
                endereco=uc.get("endereco"),
                numero_imovel=uc.get("numero_imovel"),
                complemento=uc.get("complemento"),
                bairro=uc.get("bairro"),
                cidade=uc.get("cidade"),
                uf=uc.get("uf"),
                cep=uc.get("cep"),
                latitude=uc.get("latitude"),
                longitude=uc.get("longitude"),
                tipo_ligacao=uc.get("tipo_ligacao"),
                classe_leitura=uc.get("classe_leitura"),
                grupo_leitura=uc.get("grupo_leitura"),
                numero_medidor=uc.get("numero_medidor"),
                uc_ativa=uc.get("uc_ativa", True),
                uc_cortada=uc.get("uc_cortada", False),
                contrato_ativo=uc.get("contrato_ativo", True),
                baixa_renda=uc.get("baixa_renda", False),
                is_geradora=uc.get("is_geradora", False),
                geradora_id=uc.get("geradora_id"),
                percentual_rateio=uc.get("percentual_rateio"),
                saldo_acumulado=uc.get("saldo_acumulado", 0),
                ultima_sincronizacao=uc.get("ultima_sincronizacao"),
                criado_em=uc.get("criado_em"),
                atualizado_em=uc.get("atualizado_em")
            ))

        total = result.count if result.count else len(ucs)
        return ucs, total

    async def listar_por_usuario(
        self,
        usuario_id: str,
        page: int = 1,
        per_page: int = 20
    ) -> Tuple[List[UCResponse], int]:
        """
        Lista UCs de um usuário específico.

        Args:
            usuario_id: ID do usuário
            page: Página
            per_page: Itens por página

        Returns:
            Tupla (lista de UCs, total)
        """
        filtros = UCFiltros(usuario_id=usuario_id)
        return await self.listar(filtros=filtros, page=page, per_page=per_page)

    async def buscar_por_id(self, uc_id: int) -> UCResponse:
        """
        Busca UC por ID.

        Args:
            uc_id: ID da UC

        Returns:
            UCResponse

        Raises:
            NotFoundError: Se UC não encontrada
        """
        result = self.db.unidades_consumidoras().select("*").eq(
            "id", uc_id
        ).single().execute()

        if not result.data:
            raise NotFoundError("Unidade Consumidora")

        uc = result.data
        return UCResponse(
            id=uc["id"],
            usuario_id=uc["usuario_id"],
            cod_empresa=uc["cod_empresa"],
            cdc=uc["cdc"],
            digito_verificador=uc["digito_verificador"],
            uc_formatada=self._formatar_uc(
                uc["cod_empresa"], uc["cdc"], uc["digito_verificador"]
            ),
            apelido=uc.get("apelido"),
            cpf_cnpj_titular=uc.get("cpf_cnpj_titular"),
            nome_titular=uc.get("nome_titular"),
            usuario_titular=uc.get("usuario_titular", False),
            endereco=uc.get("endereco"),
            numero_imovel=uc.get("numero_imovel"),
            complemento=uc.get("complemento"),
            bairro=uc.get("bairro"),
            cidade=uc.get("cidade"),
            uf=uc.get("uf"),
            cep=uc.get("cep"),
            latitude=uc.get("latitude"),
            longitude=uc.get("longitude"),
            tipo_ligacao=uc.get("tipo_ligacao"),
            classe_leitura=uc.get("classe_leitura"),
            grupo_leitura=uc.get("grupo_leitura"),
            numero_medidor=uc.get("numero_medidor"),
            uc_ativa=uc.get("uc_ativa", True),
            uc_cortada=uc.get("uc_cortada", False),
            contrato_ativo=uc.get("contrato_ativo", True),
            baixa_renda=uc.get("baixa_renda", False),
            is_geradora=uc.get("is_geradora", False),
            geradora_id=uc.get("geradora_id"),
            percentual_rateio=uc.get("percentual_rateio"),
            saldo_acumulado=uc.get("saldo_acumulado", 0),
            ultima_sincronizacao=uc.get("ultima_sincronizacao"),
            criado_em=uc.get("criado_em"),
            atualizado_em=uc.get("atualizado_em")
        )

    async def buscar_por_formato(
        self,
        uc_formatada: str
    ) -> Optional[UCResponse]:
        """
        Busca UC pelo formato de exibição (6/4242904-3).

        Args:
            uc_formatada: UC formatada

        Returns:
            UCResponse ou None
        """
        cod_empresa, cdc, digito = self._parse_uc_formatada(uc_formatada)

        result = self.db.unidades_consumidoras().select("*").eq(
            "cod_empresa", cod_empresa
        ).eq("cdc", cdc).eq("digito_verificador", digito).single().execute()

        if not result.data:
            return None

        uc = result.data
        return UCResponse(
            id=uc["id"],
            usuario_id=uc["usuario_id"],
            cod_empresa=uc["cod_empresa"],
            cdc=uc["cdc"],
            digito_verificador=uc["digito_verificador"],
            uc_formatada=uc_formatada,
            apelido=uc.get("apelido"),
            cpf_cnpj_titular=uc.get("cpf_cnpj_titular"),
            nome_titular=uc.get("nome_titular"),
            usuario_titular=uc.get("usuario_titular", False),
            endereco=uc.get("endereco"),
            numero_imovel=uc.get("numero_imovel"),
            complemento=uc.get("complemento"),
            bairro=uc.get("bairro"),
            cidade=uc.get("cidade"),
            uf=uc.get("uf"),
            cep=uc.get("cep"),
            latitude=uc.get("latitude"),
            longitude=uc.get("longitude"),
            tipo_ligacao=uc.get("tipo_ligacao"),
            classe_leitura=uc.get("classe_leitura"),
            grupo_leitura=uc.get("grupo_leitura"),
            numero_medidor=uc.get("numero_medidor"),
            uc_ativa=uc.get("uc_ativa", True),
            uc_cortada=uc.get("uc_cortada", False),
            contrato_ativo=uc.get("contrato_ativo", True),
            baixa_renda=uc.get("baixa_renda", False),
            is_geradora=uc.get("is_geradora", False),
            geradora_id=uc.get("geradora_id"),
            percentual_rateio=uc.get("percentual_rateio"),
            saldo_acumulado=uc.get("saldo_acumulado", 0),
            ultima_sincronizacao=uc.get("ultima_sincronizacao"),
            criado_em=uc.get("criado_em"),
            atualizado_em=uc.get("atualizado_em")
        )

    async def vincular(
        self,
        usuario_id: str,
        data: UCVincularRequest
    ) -> UCResponse:
        """
        Vincula uma UC a um usuário.

        Args:
            usuario_id: ID do usuário
            data: Dados da UC

        Returns:
            UCResponse

        Raises:
            ConflictError: Se UC já vinculada
        """
        # Verifica se já existe para ESTE usuário
        existing = self.db.unidades_consumidoras().select("id, usuario_id").eq(
            "cod_empresa", data.cod_empresa
        ).eq("cdc", data.cdc).eq("digito_verificador", data.digito_verificador).execute()

        if existing.data:
            # Se já existe para o mesmo usuário, erro
            for uc in existing.data:
                if uc["usuario_id"] == usuario_id:
                    raise ConflictError("UC já vinculada à sua conta")
            # Se existe para outro usuário, permite vincular (compartilhamento)

        # Cria vinculação
        uc_data = {
            "usuario_id": usuario_id,
            "cod_empresa": data.cod_empresa,
            "cdc": data.cdc,
            "digito_verificador": data.digito_verificador,
            "usuario_titular": data.usuario_titular,
            "uc_ativa": True
        }

        result = self.db.unidades_consumidoras().insert(uc_data).execute()

        if not result.data:
            raise ValidationError("Erro ao vincular UC")

        return await self.buscar_por_id(result.data[0]["id"])

    async def _atribuir_perfil_por_titularidade(self, usuario_id: str, is_titular: bool) -> None:
        """
        Atribui perfil automaticamente baseado na titularidade da UC.

        - Se é titular da UC → perfil "usuario"
        - Se NÃO é titular da UC → perfil "gestor"

        Args:
            usuario_id: ID do usuário
            is_titular: Se o usuário é titular da UC
        """
        perfil = "usuario" if is_titular else "gestor"

        try:
            # Verificar se já tem o perfil
            existing = self.db.perfis_usuario().select("*").eq(
                "usuario_id", usuario_id
            ).eq("perfil", perfil).execute()

            if existing.data:
                # Se existe mas está inativo, reativar
                if not existing.data[0].get("ativo"):
                    self.db.perfis_usuario().update({"ativo": True}).eq(
                        "id", existing.data[0]["id"]
                    ).execute()
                    logger.info(f"Perfil '{perfil}' reativado para usuário {usuario_id}")
            else:
                # Criar novo perfil
                self.db.perfis_usuario().insert({
                    "usuario_id": usuario_id,
                    "perfil": perfil,
                    "ativo": True
                }).execute()
                logger.info(f"Perfil '{perfil}' atribuído ao usuário {usuario_id}")
        except Exception as e:
            # Não falha a vinculação por erro de perfil
            logger.error(f"Erro ao atribuir perfil '{perfil}' ao usuário {usuario_id}: {e}")

    async def vincular_por_formato(
        self,
        usuario_id: str,
        data: UCVincularPorFormatoRequest
    ) -> UCResponse:
        """
        Vincula UC usando formato de exibição.

        Args:
            usuario_id: ID do usuário
            data: Dados com UC formatada

        Returns:
            UCResponse
        """
        cod_empresa, cdc, digito = self._parse_uc_formatada(data.uc_formatada)

        uc = await self.vincular(
            usuario_id,
            UCVincularRequest(
                cod_empresa=cod_empresa,
                cdc=cdc,
                digito_verificador=digito,
                usuario_titular=data.usuario_titular
            )
        )

        # Atribuir perfil automaticamente baseado na titularidade
        await self._atribuir_perfil_por_titularidade(usuario_id, data.usuario_titular)

        # Se tiver dados extras da Energisa, atualiza a UC
        update_data = {}
        if data.nome_titular:
            update_data["nome_titular"] = data.nome_titular
        if data.endereco:
            update_data["endereco"] = data.endereco
        if data.numero_imovel:
            update_data["numero_imovel"] = data.numero_imovel
        if data.complemento:
            update_data["complemento"] = data.complemento
        if data.bairro:
            update_data["bairro"] = data.bairro
        if data.cidade:
            update_data["cidade"] = data.cidade
        if data.uf:
            update_data["uf"] = data.uf
        if data.latitude is not None:
            update_data["latitude"] = float(data.latitude)
        if data.longitude is not None:
            update_data["longitude"] = float(data.longitude)
        if data.classe_leitura:
            update_data["classe_leitura"] = data.classe_leitura
        if data.grupo_leitura:
            update_data["grupo_leitura"] = data.grupo_leitura
        if data.is_geradora is not None:
            update_data["is_geradora"] = data.is_geradora

        if update_data:
            self.db.unidades_consumidoras().update(update_data).eq(
                "id", uc.id
            ).execute()
            uc = await self.buscar_por_id(uc.id)

        # Se usuário NÃO é titular e UC é geradora -> criar usina automaticamente
        if not data.usuario_titular and data.is_geradora:
            await self._criar_usina_para_gestor(
                uc_id=uc.id,
                gestor_id=usuario_id,
                uc_formatada=data.uc_formatada,
                nome_titular=data.nome_titular,
                cidade=data.cidade,
                uf=data.uf,
                cod_empresa=cod_empresa,
                cdc=cdc,
                digito=digito
            )

        return uc

    async def _criar_usina_para_gestor(
        self,
        uc_id: int,
        gestor_id: str,
        uc_formatada: str,
        nome_titular: Optional[str] = None,
        cidade: Optional[str] = None,
        uf: Optional[str] = None,
        cod_empresa: int = 6,
        cdc: int = 0,
        digito: int = 0
    ) -> None:
        """
        Cria usina automaticamente para gestor que vincula UC geradora.
        Também busca beneficiárias da Energisa para importar automaticamente.
        """
        from backend.usinas.service import usinas_service

        # Buscar beneficiárias da Energisa
        lista_beneficiarias = []
        try:
            from backend.energisa.service import EnergisaService

            # Obter CPF do gestor
            user_result = self.db.table("usuarios").select("cpf").eq(
                "id", gestor_id
            ).single().execute()

            logger.info(f"Buscando beneficiárias para gestor {gestor_id}")

            if user_result.data and user_result.data.get("cpf"):
                cpf_gestor = user_result.data["cpf"]
                logger.info(f"CPF do gestor: {cpf_gestor}")

                svc = EnergisaService(cpf_gestor)

                # Tentar refresh do token antes
                if not svc.is_authenticated():
                    logger.warning(f"Token não autenticado, tentando refresh...")
                    svc._refresh_token()

                if svc.is_authenticated():
                    logger.info(f"Autenticado na Energisa, buscando GD info...")
                    uc_data = {
                        "cdc": cdc,
                        "digitoVerificadorCdc": digito,
                        "codigoEmpresaWeb": cod_empresa
                    }
                    logger.info(f"UC data para GD: {uc_data}")

                    gd_info = svc.get_gd_info(uc_data)
                    logger.info(f"Resposta GD info: {gd_info}")

                    if gd_info:
                        infos = gd_info.get("infos", {})
                        objeto = infos.get("objeto", {}) if isinstance(infos, dict) else {}
                        lista_beneficiarias = objeto.get("listaBeneficiarias", [])

                        logger.info(f"Lista beneficiárias encontrada: {len(lista_beneficiarias)} itens")

                        if lista_beneficiarias:
                            logger.info(
                                f"Encontradas {len(lista_beneficiarias)} beneficiárias "
                                f"da Energisa para UC {uc_formatada}"
                            )
                    else:
                        logger.warning(f"get_gd_info retornou None para UC {uc_formatada}")
                else:
                    logger.warning(f"Não foi possível autenticar na Energisa para CPF {cpf_gestor}")
            else:
                logger.warning(f"Gestor {gestor_id} não tem CPF cadastrado")
        except Exception as e:
            logger.error(f"Erro ao buscar beneficiárias da Energisa: {e}", exc_info=True)

        # Criar usina com beneficiárias
        try:
            await usinas_service.criar_usina_automatica_para_gestor(
                uc_id=uc_id,
                gestor_id=gestor_id,
                uc_formatada=uc_formatada,
                nome_titular=nome_titular,
                cidade=cidade,
                uf=uf,
                lista_beneficiarias=lista_beneficiarias
            )
            logger.info(f"Usina criada automaticamente para gestor {gestor_id}")
        except Exception as e:
            # Não falha a vinculação se der erro na criação da usina
            logger.error(f"Erro ao criar usina automática para gestor {gestor_id}: {e}")

    async def atualizar(
        self,
        uc_id: int,
        data: UCUpdateRequest
    ) -> UCResponse:
        """
        Atualiza dados da UC.

        Args:
            uc_id: ID da UC
            data: Dados para atualizar

        Returns:
            UCResponse atualizada
        """
        # Verifica se existe
        await self.buscar_por_id(uc_id)

        # Monta dados para atualização
        update_data = {}
        for field, value in data.model_dump(exclude_unset=True).items():
            if value is not None:
                update_data[field] = value

        if not update_data:
            return await self.buscar_por_id(uc_id)

        self.db.unidades_consumidoras().update(update_data).eq(
            "id", uc_id
        ).execute()

        return await self.buscar_por_id(uc_id)

    async def atualizar_dados_api(
        self,
        uc_id: int,
        dados_api: dict
    ) -> UCResponse:
        """
        Atualiza UC com dados da API da Energisa.

        Args:
            uc_id: ID da UC
            dados_api: Dados retornados pela API

        Returns:
            UCResponse atualizada
        """
        from datetime import datetime, timezone

        # Mapeia campos da API para campos da tabela
        update_data = {
            "dados_api": dados_api,
            "ultima_sincronizacao": datetime.now(timezone.utc).isoformat()
        }

        # Extrai campos conhecidos
        if "cpfCnpjTitularPrincipal" in dados_api:
            update_data["cpf_cnpj_titular"] = dados_api["cpfCnpjTitularPrincipal"]
        if "nomeTitular" in dados_api:
            update_data["nome_titular"] = dados_api["nomeTitular"]
        if "endereco" in dados_api:
            update_data["endereco"] = dados_api["endereco"]
        if "numeroImovel" in dados_api:
            update_data["numero_imovel"] = dados_api["numeroImovel"]
        if "complemento" in dados_api:
            update_data["complemento"] = dados_api["complemento"]
        if "bairro" in dados_api:
            update_data["bairro"] = dados_api["bairro"]
        if "cidade" in dados_api:
            update_data["cidade"] = dados_api["cidade"]
        if "uf" in dados_api:
            update_data["uf"] = dados_api["uf"]
        if "cep" in dados_api:
            update_data["cep"] = dados_api["cep"]
        if "tipoLigacao" in dados_api:
            update_data["tipo_ligacao"] = dados_api["tipoLigacao"]
        if "classeLeitura" in dados_api:
            update_data["classe_leitura"] = dados_api["classeLeitura"]
        if "grupoLeitura" in dados_api:
            update_data["grupo_leitura"] = dados_api["grupoLeitura"]
        if "numeroMedidor" in dados_api:
            update_data["numero_medidor"] = dados_api["numeroMedidor"]

        self.db.unidades_consumidoras().update(update_data).eq(
            "id", uc_id
        ).execute()

        return await self.buscar_por_id(uc_id)

    async def configurar_gd(
        self,
        uc_id: int,
        config: UCConfigGDRequest
    ) -> UCResponse:
        """
        Configura UC para GD (geradora ou beneficiária).

        Args:
            uc_id: ID da UC
            config: Configuração de GD

        Returns:
            UCResponse atualizada
        """
        # Verifica se existe
        await self.buscar_por_id(uc_id)

        update_data = {
            "is_geradora": config.is_geradora,
            "geradora_id": config.geradora_id,
            "percentual_rateio": float(config.percentual_rateio) if config.percentual_rateio else None
        }

        self.db.unidades_consumidoras().update(update_data).eq(
            "id", uc_id
        ).execute()

        return await self.buscar_por_id(uc_id)

    async def listar_geradoras(
        self,
        usuario_id: Optional[str] = None
    ) -> List[UCResponse]:
        """
        Lista UCs geradoras.

        Args:
            usuario_id: Opcional - filtrar por usuário

        Returns:
            Lista de UCs geradoras
        """
        query = self.db.unidades_consumidoras().select("*").eq(
            "is_geradora", True
        )

        if usuario_id:
            query = query.eq("usuario_id", usuario_id)

        result = query.execute()

        ucs = []
        for uc in result.data or []:
            ucs.append(UCResponse(
                id=uc["id"],
                usuario_id=uc["usuario_id"],
                cod_empresa=uc["cod_empresa"],
                cdc=uc["cdc"],
                digito_verificador=uc["digito_verificador"],
                uc_formatada=self._formatar_uc(
                    uc["cod_empresa"], uc["cdc"], uc["digito_verificador"]
                ),
                apelido=uc.get("apelido"),
                cpf_cnpj_titular=uc.get("cpf_cnpj_titular"),
                nome_titular=uc.get("nome_titular"),
                usuario_titular=uc.get("usuario_titular", False),
                endereco=uc.get("endereco"),
                cidade=uc.get("cidade"),
                uf=uc.get("uf"),
                is_geradora=True,
                saldo_acumulado=uc.get("saldo_acumulado", 0),
                criado_em=uc.get("criado_em"),
                atualizado_em=uc.get("atualizado_em")
            ))

        return ucs

    async def listar_beneficiarias(
        self,
        geradora_id: int
    ) -> List[UCResponse]:
        """
        Lista UCs beneficiárias de uma geradora.

        Args:
            geradora_id: ID da UC geradora

        Returns:
            Lista de UCs beneficiárias
        """
        result = self.db.unidades_consumidoras().select("*").eq(
            "geradora_id", geradora_id
        ).execute()

        ucs = []
        for uc in result.data or []:
            ucs.append(UCResponse(
                id=uc["id"],
                usuario_id=uc["usuario_id"],
                cod_empresa=uc["cod_empresa"],
                cdc=uc["cdc"],
                digito_verificador=uc["digito_verificador"],
                uc_formatada=self._formatar_uc(
                    uc["cod_empresa"], uc["cdc"], uc["digito_verificador"]
                ),
                apelido=uc.get("apelido"),
                nome_titular=uc.get("nome_titular"),
                percentual_rateio=uc.get("percentual_rateio"),
                is_geradora=False,
                geradora_id=geradora_id
            ))

        return ucs

    async def obter_info_gd(self, uc_id: int) -> UCGDInfoResponse:
        """
        Obtém informações de GD de uma UC.

        Args:
            uc_id: ID da UC

        Returns:
            UCGDInfoResponse
        """
        uc = await self.buscar_por_id(uc_id)

        beneficiarias = []
        if uc.is_geradora:
            beneficiarias_ucs = await self.listar_beneficiarias(uc_id)
            beneficiarias = [
                UCBeneficiariaResponse(
                    id=b.id,
                    uc_formatada=b.uc_formatada,
                    nome_titular=b.nome_titular,
                    percentual_rateio=b.percentual_rateio
                )
                for b in beneficiarias_ucs
            ]

        return UCGDInfoResponse(
            uc_id=uc.id,
            uc_formatada=uc.uc_formatada,
            is_geradora=uc.is_geradora,
            saldo_acumulado=uc.saldo_acumulado,
            beneficiarias=beneficiarias
        )

    async def desvincular(self, uc_id: int) -> bool:
        """
        Desvincula (remove) uma UC.

        Args:
            uc_id: ID da UC

        Returns:
            True se sucesso

        Raises:
            ValidationError: Se a UC for geradora de uma usina
        """
        # Verifica se existe
        await self.buscar_por_id(uc_id)

        # Verifica se é geradora de alguma usina (não pode desvincular)
        usina_result = self.db.table("usinas").select("id, nome").eq(
            "uc_geradora_id", uc_id
        ).execute()
        if usina_result.data:
            usina = usina_result.data[0]
            raise ValidationError(
                f"Esta UC é geradora da usina '{usina.get('nome', usina['id'])}'. "
                "Remova a usina primeiro."
            )

        # Remove dependências na ordem correta (devido às foreign keys)

        # 1. Buscar IDs dos beneficiários dessa UC
        benef_result = self.db.table("beneficiarios").select("id").eq(
            "uc_id", uc_id
        ).execute()
        benef_ids = [b["id"] for b in (benef_result.data or [])]

        # 2. Deletar cobranças dos beneficiários
        if benef_ids:
            self.db.table("cobrancas").delete().in_(
                "beneficiario_id", benef_ids
            ).execute()

        # 3. Deletar cobranças vinculadas diretamente à UC (campo uc_id)
        self.db.table("cobrancas").delete().eq("uc_id", uc_id).execute()

        # 4. Deletar beneficiario_ucs (tabela N:N)
        self.db.table("beneficiario_ucs").delete().eq("uc_id", uc_id).execute()

        # 5. Deletar beneficiários
        self.db.table("beneficiarios").delete().eq("uc_id", uc_id).execute()

        # 6. Deletar faturas
        self.db.table("faturas").delete().eq("uc_id", uc_id).execute()

        # 7. Deletar histórico GD
        self.db.table("historico_gd").delete().eq("uc_id", uc_id).execute()

        # 8. Limpar referência geradora_id em outras UCs
        self.db.unidades_consumidoras().update(
            {"geradora_id": None}
        ).eq("geradora_id", uc_id).execute()

        # 9. Limpar referência uc_substituta_id em outras UCs
        self.db.unidades_consumidoras().update(
            {"uc_substituta_id": None}
        ).eq("uc_substituta_id", uc_id).execute()

        # 10. Limpar referência uc_id_origem em beneficiários
        self.db.table("beneficiarios").update(
            {"uc_id_origem": None}
        ).eq("uc_id_origem", uc_id).execute()

        # 11. Finalmente, deletar a UC
        self.db.unidades_consumidoras().delete().eq("id", uc_id).execute()

        return True

    async def buscar_historico_gd(self, uc_id: int) -> List[HistoricoGDResponse]:
        """
        Busca histórico de GD de uma UC do banco de dados.

        Args:
            uc_id: ID da UC

        Returns:
            Lista de registros de histórico GD ordenados por data
        """
        result = self.db.table("historico_gd").select("*").eq(
            "uc_id", uc_id
        ).order("ano_referencia", desc=True).order("mes_referencia", desc=True).execute()

        historico = []
        for item in result.data or []:
            historico.append(HistoricoGDResponse(
                id=item["id"],
                uc_id=item["uc_id"],
                mes_referencia=item["mes_referencia"],
                ano_referencia=item["ano_referencia"],
                saldo_anterior_conv=item.get("saldo_anterior_conv"),
                injetado_conv=item.get("injetado_conv"),
                total_recebido_rede=item.get("total_recebido_rede"),
                consumo_recebido_conv=item.get("consumo_recebido_conv"),
                consumo_injetado_compensado=item.get("consumo_injetado_compensado"),
                consumo_transferido_conv=item.get("consumo_transferido_conv"),
                consumo_compensado_conv=item.get("consumo_compensado_conv"),
                saldo_compensado_anterior=item.get("saldo_compensado_anterior"),
                dados_api=item.get("dados_api"),
                sincronizado_em=item.get("sincronizado_em")
            ))

        return historico

    def _calcular_saldo_real(self, h: HistoricoGDResponse) -> int:
        """
        Calcula o saldo real de créditos após os movimentos do mês.

        Fórmula: saldoAnterior + injetado + recebido - transferido - compensado + recebidoRede
        """
        return (
            (h.saldo_anterior_conv or 0)
            + (h.injetado_conv or 0)
            + (h.consumo_recebido_conv or 0)
            - (h.consumo_transferido_conv or 0)
            - (h.consumo_compensado_conv or 0)
            + (h.total_recebido_rede or 0)
        )

    def _tem_dados_completos(self, h: HistoricoGDResponse) -> bool:
        """
        Verifica se o registro de GD tem dados completos (não é mês em aberto).

        O último mês geralmente tem zeros porque ainda não foi processado.
        """
        return (
            (h.injetado_conv or 0) != 0
            or (h.consumo_recebido_conv or 0) != 0
            or (h.consumo_transferido_conv or 0) != 0
            or (h.total_recebido_rede or 0) != 0
        )

    async def obter_gd_completo(self, uc_id: int) -> UCComGDResponse:
        """
        Obtém dados completos de GD de uma UC.

        Args:
            uc_id: ID da UC

        Returns:
            UCComGDResponse com todos os dados de GD
        """
        uc = await self.buscar_por_id(uc_id)
        historico = await self.buscar_historico_gd(uc_id)

        # Verifica se tem dados de GD
        tem_dados_gd = len(historico) > 0 or uc.is_geradora

        # Se for geradora, busca beneficiárias
        beneficiarias = []
        if uc.is_geradora:
            beneficiarias_ucs = await self.listar_beneficiarias(uc_id)
            beneficiarias = [
                UCBeneficiariaResponse(
                    id=b.id,
                    uc_formatada=b.uc_formatada,
                    nome_titular=b.nome_titular,
                    percentual_rateio=b.percentual_rateio
                )
                for b in beneficiarias_ucs
            ]

        # Se for beneficiária, busca geradora
        geradora = None
        if uc.geradora_id:
            try:
                geradora_uc = await self.buscar_por_id(uc.geradora_id)
                geradora = UCBeneficiariaResponse(
                    id=geradora_uc.id,
                    uc_formatada=geradora_uc.uc_formatada,
                    nome_titular=geradora_uc.nome_titular,
                    percentual_rateio=None
                )
            except NotFoundError:
                pass

        # O saldo atual é o saldo_anterior_conv do mês mais recente
        # pois representa o saldo no INÍCIO do mês atual (saldo corrente)
        saldo_creditos = 0
        if historico:
            saldo_creditos = historico[0].saldo_anterior_conv or 0

        return UCComGDResponse(
            uc=uc,
            is_geradora=uc.is_geradora,
            is_beneficiaria=uc.geradora_id is not None,
            tem_dados_gd=tem_dados_gd,
            saldo_creditos=saldo_creditos,
            historico=historico,
            beneficiarias=beneficiarias,
            geradora=geradora,
            percentual_rateio=uc.percentual_rateio
        )

    async def obter_resumo_gd_usuario(
        self,
        usuario_id: str,
        usuario_titular: Optional[bool] = None
    ) -> GDResumoResponse:
        """
        Obtém resumo de GD de todas as UCs do usuário.

        Args:
            usuario_id: ID do usuário
            usuario_titular: Filtro de titularidade (True=titular, False=gestor)

        Returns:
            GDResumoResponse com resumo consolidado
        """
        # Busca UCs do usuário com filtro de titularidade se especificado
        filtros = UCFiltros(usuario_id=usuario_id, usuario_titular=usuario_titular)
        ucs, _ = await self.listar(filtros=filtros, page=1, per_page=100)

        ucs_com_gd = []
        total_creditos = 0
        total_gerado_mes = 0
        total_compensado_mes = 0

        for uc in ucs:
            gd_data = await self.obter_gd_completo(uc.id)

            if gd_data.tem_dados_gd:
                ucs_com_gd.append(gd_data)
                total_creditos += gd_data.saldo_creditos

                # Soma valores do mês com dados completos (penúltimo)
                if gd_data.historico:
                    # Encontra o primeiro registro com dados completos
                    for h in gd_data.historico:
                        if self._tem_dados_completos(h):
                            if h.injetado_conv:
                                total_gerado_mes += h.injetado_conv
                            if h.consumo_compensado_conv:
                                total_compensado_mes += h.consumo_compensado_conv
                            break

        return GDResumoResponse(
            total_ucs_com_gd=len(ucs_com_gd),
            total_creditos=total_creditos,
            total_gerado_mes=total_gerado_mes,
            total_compensado_mes=total_compensado_mes,
            ucs=ucs_com_gd
        )


# Instância global do serviço
ucs_service = UCsService()
