"""
Beneficiarios Service - Lógica de negócio para Beneficiários de GD
"""

from typing import Optional, List, Tuple
from decimal import Decimal
import logging
import secrets
from datetime import datetime, timezone, timedelta

from backend.core.database import db_admin
from backend.core.exceptions import NotFoundError, ConflictError, ValidationError
from backend.config import settings
from backend.beneficiarios.schemas import (
    BeneficiarioCreateRequest,
    BeneficiarioUpdateRequest,
    BeneficiarioResponse,
    BeneficiarioFiltros,
    UCBeneficiarioResponse,
    UsinaResumoResponse,
    UsuarioResumoResponse,
    ContratoResumoResponse,
    ConviteResponse,
)

logger = logging.getLogger(__name__)


class BeneficiariosService:
    """Serviço de gestão de Beneficiários"""

    def __init__(self):
        self.db = db_admin

    def _formatar_uc(self, cod_empresa: int, cdc: int, digito: int) -> str:
        """Formata UC para exibição"""
        return f"{cod_empresa}/{cdc}-{digito}"

    async def listar(
        self,
        filtros: Optional[BeneficiarioFiltros] = None,
        page: int = 1,
        per_page: int = 20
    ) -> Tuple[List[BeneficiarioResponse], int]:
        """
        Lista beneficiários com filtros e paginação.

        Args:
            filtros: Filtros de busca
            page: Página atual
            per_page: Itens por página

        Returns:
            Tupla (lista de beneficiários, total)
        """
        query = self.db.beneficiarios().select(
            "*",
            "unidades_consumidoras!beneficiarios_uc_id_fkey(id, cod_empresa, cdc, digito_verificador, nome_titular, endereco, cidade, uf)",
            "usinas(id, nome, desconto_padrao)",
            "usuarios(id, nome_completo, email)",
            "contratos!contratos_beneficiario_id_fkey(id, status, vigencia_inicio, vigencia_fim)",
            count="exact"
        )

        # Aplicar filtros
        if filtros:
            if filtros.usina_id:
                query = query.eq("usina_id", filtros.usina_id)
            if filtros.uc_id:
                query = query.eq("uc_id", filtros.uc_id)
            if filtros.cpf:
                query = query.eq("cpf", filtros.cpf)
            if filtros.nome:
                query = query.ilike("nome", f"%{filtros.nome}%")
            if filtros.email:
                query = query.ilike("email", f"%{filtros.email}%")
            if filtros.status:
                query = query.eq("status", filtros.status.value)

        # Paginação
        offset = (page - 1) * per_page
        query = query.range(offset, offset + per_page - 1)

        # Ordenação
        query = query.order("criado_em", desc=True)

        result = query.execute()

        beneficiarios = []
        for b in result.data or []:
            beneficiarios.append(self._build_response(b))

        total = result.count if result.count else len(beneficiarios)
        return beneficiarios, total

    def _build_response(self, b: dict) -> BeneficiarioResponse:
        """Constrói resposta do beneficiário"""
        # UC
        uc = None
        if b.get("unidades_consumidoras"):
            uc_data = b["unidades_consumidoras"]
            uc = UCBeneficiarioResponse(
                id=uc_data["id"],
                uc_formatada=self._formatar_uc(
                    uc_data["cod_empresa"], uc_data["cdc"], uc_data["digito_verificador"]
                ),
                nome_titular=uc_data.get("nome_titular"),
                endereco=uc_data.get("endereco"),
                cidade=uc_data.get("cidade"),
                uf=uc_data.get("uf")
            )

        # Usina
        usina = None
        if b.get("usinas"):
            usina_data = b["usinas"]
            usina = UsinaResumoResponse(
                id=usina_data["id"],
                nome=usina_data["nome"],
                desconto_padrao=Decimal(str(usina_data.get("desconto_padrao", 0.30)))
            )

        # Usuário
        usuario = None
        if b.get("usuarios"):
            user_data = b["usuarios"]
            usuario = UsuarioResumoResponse(
                id=user_data["id"],
                nome_completo=user_data["nome_completo"],
                email=user_data["email"]
            )

        # Contrato
        contrato = None
        if b.get("contratos"):
            contrato_data = b["contratos"]
            contrato = ContratoResumoResponse(
                id=contrato_data["id"],
                status=contrato_data["status"],
                vigencia_inicio=contrato_data.get("vigencia_inicio"),
                vigencia_fim=contrato_data.get("vigencia_fim")
            )

        return BeneficiarioResponse(
            id=b["id"],
            usuario_id=b.get("usuario_id"),
            uc_id=b["uc_id"],
            usina_id=b["usina_id"],
            contrato_id=b.get("contrato_id"),
            cpf=b["cpf"],
            nome=b.get("nome"),
            email=b.get("email"),
            telefone=b.get("telefone"),
            percentual_rateio=Decimal(str(b.get("percentual_rateio", 0))),
            desconto=Decimal(str(b.get("desconto", 0))),
            status=b.get("status", "PENDENTE"),
            convite_enviado_em=b.get("convite_enviado_em"),
            ativado_em=b.get("ativado_em"),
            criado_em=b.get("criado_em"),
            atualizado_em=b.get("atualizado_em"),
            uc=uc,
            usina=usina,
            usuario=usuario,
            contrato=contrato
        )

    async def buscar_por_id(self, beneficiario_id: int) -> BeneficiarioResponse:
        """
        Busca beneficiário por ID.

        Args:
            beneficiario_id: ID do beneficiário

        Returns:
            BeneficiarioResponse

        Raises:
            NotFoundError: Se beneficiário não encontrado
        """
        result = self.db.beneficiarios().select(
            "*",
            "unidades_consumidoras!beneficiarios_uc_id_fkey(id, cod_empresa, cdc, digito_verificador, nome_titular, endereco, cidade, uf)",
            "usinas(id, nome, desconto_padrao)",
            "usuarios(id, nome_completo, email)",
            "contratos!contratos_beneficiario_id_fkey(id, status, vigencia_inicio, vigencia_fim)"
        ).eq("id", beneficiario_id).single().execute()

        if not result.data:
            raise NotFoundError("Beneficiário")

        return self._build_response(result.data)

    async def buscar_por_cpf(self, cpf: str) -> Optional[BeneficiarioResponse]:
        """
        Busca beneficiário por CPF.

        Args:
            cpf: CPF do beneficiário

        Returns:
            BeneficiarioResponse ou None
        """
        result = self.db.beneficiarios().select(
            "*",
            "unidades_consumidoras!beneficiarios_uc_id_fkey(id, cod_empresa, cdc, digito_verificador, nome_titular, endereco, cidade, uf)",
            "usinas(id, nome, desconto_padrao)"
        ).eq("cpf", cpf).execute()

        if not result.data:
            return None

        return self._build_response(result.data[0])

    async def criar(self, data: BeneficiarioCreateRequest) -> BeneficiarioResponse:
        """
        Cria novo beneficiário.

        Args:
            data: Dados do beneficiário

        Returns:
            BeneficiarioResponse

        Raises:
            ValidationError: Se percentual excede 100%
            ConflictError: Se UC já é beneficiária da usina
        """
        # Verifica se usina existe
        usina_result = self.db.usinas().select("id").eq("id", data.usina_id).single().execute()
        if not usina_result.data:
            raise NotFoundError("Usina")

        # Verifica se UC existe
        uc_result = self.db.unidades_consumidoras().select("id").eq("id", data.uc_id).single().execute()
        if not uc_result.data:
            raise NotFoundError("Unidade Consumidora")

        # Verifica se UC já é beneficiária desta usina
        existing = self.db.beneficiarios().select("id").eq(
            "uc_id", data.uc_id
        ).eq("usina_id", data.usina_id).execute()

        if existing.data:
            raise ConflictError("UC já cadastrada como beneficiária desta usina")

        # Verifica percentual total alocado
        current_result = self.db.beneficiarios().select("percentual_rateio").eq(
            "usina_id", data.usina_id
        ).execute()

        total_alocado = sum(
            Decimal(str(b.get("percentual_rateio", 0)))
            for b in current_result.data or []
        )

        if total_alocado + data.percentual_rateio > 100:
            raise ValidationError(
                f"Percentual excede 100%. Disponível: {100 - total_alocado}%"
            )

        # Cria beneficiário
        beneficiario_data = {
            "usina_id": data.usina_id,
            "uc_id": data.uc_id,
            "cpf": data.cpf,
            "nome": data.nome,
            "email": data.email,
            "telefone": data.telefone,
            "percentual_rateio": float(data.percentual_rateio),
            "desconto": float(data.desconto),
            "status": "PENDENTE"
        }

        result = self.db.beneficiarios().insert(beneficiario_data).execute()

        if not result.data:
            raise ValidationError("Erro ao criar beneficiário")

        # Atualiza UC com referência à geradora
        usina = self.db.usinas().select("uc_geradora_id").eq("id", data.usina_id).single().execute()
        if usina.data:
            self.db.unidades_consumidoras().update({
                "geradora_id": usina.data["uc_geradora_id"],
                "percentual_rateio": float(data.percentual_rateio)
            }).eq("id", data.uc_id).execute()

        return await self.buscar_por_id(result.data[0]["id"])

    async def atualizar(
        self,
        beneficiario_id: int,
        data: BeneficiarioUpdateRequest
    ) -> BeneficiarioResponse:
        """
        Atualiza dados do beneficiário.

        Args:
            beneficiario_id: ID do beneficiário
            data: Dados para atualizar

        Returns:
            BeneficiarioResponse atualizado
        """
        # Verifica se existe
        benef = await self.buscar_por_id(beneficiario_id)

        # Monta dados para atualização
        update_data = {}
        if data.nome is not None:
            update_data["nome"] = data.nome
        if data.email is not None:
            update_data["email"] = data.email
        if data.telefone is not None:
            update_data["telefone"] = data.telefone
        if data.status is not None:
            update_data["status"] = data.status.value
            if data.status.value == "ATIVO" and not benef.ativado_em:
                update_data["ativado_em"] = datetime.now(timezone.utc).isoformat()
        if data.desconto is not None:
            update_data["desconto"] = float(data.desconto)

        # Verifica percentual se alterado
        if data.percentual_rateio is not None:
            current_result = self.db.beneficiarios().select("percentual_rateio").eq(
                "usina_id", benef.usina_id
            ).neq("id", beneficiario_id).execute()

            total_outros = sum(
                Decimal(str(b.get("percentual_rateio", 0)))
                for b in current_result.data or []
            )

            if total_outros + data.percentual_rateio > 100:
                raise ValidationError(
                    f"Percentual excede 100%. Disponível: {100 - total_outros}%"
                )

            update_data["percentual_rateio"] = float(data.percentual_rateio)

            # Atualiza UC também
            self.db.unidades_consumidoras().update({
                "percentual_rateio": float(data.percentual_rateio)
            }).eq("id", benef.uc_id).execute()

        if not update_data:
            return benef

        self.db.beneficiarios().update(update_data).eq("id", beneficiario_id).execute()

        return await self.buscar_por_id(beneficiario_id)

    async def enviar_convite(
        self,
        beneficiario_id: int,
        convidado_por_id: str
    ) -> ConviteResponse:
        """
        Envia convite para beneficiário criar conta.

        Args:
            beneficiario_id: ID do beneficiário
            convidado_por_id: ID do usuário que convidou

        Returns:
            ConviteResponse
        """
        benef = await self.buscar_por_id(beneficiario_id)

        if not benef.email:
            raise ValidationError("Beneficiário não tem email cadastrado")

        # Gera token único
        token = secrets.token_urlsafe(32)
        expira_em = datetime.now(timezone.utc) + timedelta(
            days=settings.DIAS_EXPIRACAO_CONVITE
        )

        # Cria convite
        convite_data = {
            "tipo": "BENEFICIARIO",
            "email": benef.email,
            "cpf": benef.cpf,
            "nome": benef.nome,
            "beneficiario_id": beneficiario_id,
            "usina_id": benef.usina_id,
            "convidado_por_id": convidado_por_id,
            "token": token,
            "expira_em": expira_em.isoformat(),
            "status": "PENDENTE"
        }

        result = self.db.table("convites").insert(convite_data).execute()

        if not result.data:
            raise ValidationError("Erro ao criar convite")

        # Atualiza beneficiário
        self.db.beneficiarios().update({
            "convite_enviado_em": datetime.now(timezone.utc).isoformat()
        }).eq("id", beneficiario_id).execute()

        convite = result.data[0]
        return ConviteResponse(
            id=convite["id"],
            tipo=convite["tipo"],
            email=convite["email"],
            cpf=convite.get("cpf"),
            nome=convite.get("nome"),
            token=convite["token"],
            expira_em=convite["expira_em"],
            status=convite["status"],
            criado_em=convite.get("criado_em")
        )

    async def ativar(self, beneficiario_id: int) -> BeneficiarioResponse:
        """
        Ativa um beneficiário.

        Args:
            beneficiario_id: ID do beneficiário

        Returns:
            BeneficiarioResponse atualizado
        """
        from backend.beneficiarios.schemas import BeneficiarioStatus
        return await self.atualizar(
            beneficiario_id,
            BeneficiarioUpdateRequest(status=BeneficiarioStatus.ATIVO)
        )

    async def suspender(self, beneficiario_id: int) -> BeneficiarioResponse:
        """
        Suspende um beneficiário.

        Args:
            beneficiario_id: ID do beneficiário

        Returns:
            BeneficiarioResponse atualizado
        """
        from backend.beneficiarios.schemas import BeneficiarioStatus
        return await self.atualizar(
            beneficiario_id,
            BeneficiarioUpdateRequest(status=BeneficiarioStatus.SUSPENSO)
        )

    async def cancelar(self, beneficiario_id: int) -> BeneficiarioResponse:
        """
        Cancela um beneficiário.

        Args:
            beneficiario_id: ID do beneficiário

        Returns:
            BeneficiarioResponse atualizado
        """
        from backend.beneficiarios.schemas import BeneficiarioStatus
        return await self.atualizar(
            beneficiario_id,
            BeneficiarioUpdateRequest(status=BeneficiarioStatus.CANCELADO)
        )

    async def listar_por_usina(
        self,
        usina_id: int,
        page: int = 1,
        per_page: int = 20
    ) -> Tuple[List[BeneficiarioResponse], int]:
        """
        Lista beneficiários de uma usina.

        Args:
            usina_id: ID da usina
            page: Página
            per_page: Itens por página

        Returns:
            Tupla (lista de beneficiários, total)
        """
        filtros = BeneficiarioFiltros(usina_id=usina_id)
        return await self.listar(filtros=filtros, page=page, per_page=per_page)

    async def vincular_usuario(
        self,
        beneficiario_id: int,
        usuario_id: str
    ) -> BeneficiarioResponse:
        """
        Vincula um usuário ao beneficiário.

        Args:
            beneficiario_id: ID do beneficiário
            usuario_id: ID do usuário

        Returns:
            BeneficiarioResponse atualizado
        """
        self.db.beneficiarios().update({
            "usuario_id": usuario_id,
            "status": "ATIVO",
            "ativado_em": datetime.now(timezone.utc).isoformat()
        }).eq("id", beneficiario_id).execute()

        return await self.buscar_por_id(beneficiario_id)

    async def importar_beneficiarias_energisa(
        self,
        usina_id: int,
        uc_geradora_id: int,
        lista_beneficiarias: List[dict],
        desconto_padrao: float = 0.30
    ) -> dict:
        """
        Importa beneficiárias retornadas pela API Energisa.

        Args:
            usina_id: ID da usina criada
            uc_geradora_id: ID da UC geradora
            lista_beneficiarias: Lista de beneficiárias da API (listaBeneficiarias)
            desconto_padrao: Desconto padrão a aplicar

        Returns:
            {"importados": int, "existentes": int, "erros": list}
        """
        importados = 0
        existentes = 0
        erros = []

        for benef in lista_beneficiarias:
            try:
                cdc = benef.get("cdc")
                digito = benef.get("digitoVerificador")
                cod_empresa = benef.get("codigoEmpresaWeb", 6)

                # 1. Verificar se UC beneficiária já existe no banco
                uc_result = self.db.unidades_consumidoras().select(
                    "id", "usuario_id"
                ).eq("cdc", cdc).eq("digito_verificador", digito).execute()

                uc_id = None
                usuario_existente_id = None

                if uc_result.data:
                    uc_id = uc_result.data[0]["id"]
                    usuario_existente_id = uc_result.data[0].get("usuario_id")
                else:
                    # Criar UC beneficiária
                    uc_data = {
                        "cod_empresa": cod_empresa,
                        "cdc": cdc,
                        "digito_verificador": digito,
                        "nome_titular": benef.get("nome"),
                        "endereco": benef.get("endereco"),
                        "numero_imovel": benef.get("numero"),
                        "bairro": benef.get("bairro"),
                        "cidade": benef.get("cidade"),
                        "uf": benef.get("uf"),
                        "geradora_id": uc_geradora_id,
                        "is_geradora": False,
                        "usuario_titular": False
                    }
                    uc_insert = self.db.unidades_consumidoras().insert(uc_data).execute()
                    uc_id = uc_insert.data[0]["id"]

                # 2. Verificar se já existe beneficiário para esta UC/usina
                existing = self.db.beneficiarios().select("id").eq(
                    "uc_id", uc_id
                ).eq("usina_id", usina_id).execute()

                if existing.data:
                    existentes += 1
                    continue

                # 3. Extrair dados do beneficiário
                nome = benef.get("nome", "")
                percentual = float(benef.get("percentualRecebido", 0))

                # 4. Criar registro de beneficiário
                beneficiario_data = {
                    "usina_id": usina_id,
                    "uc_id": uc_id,
                    "cpf": "",  # Será preenchido pelo gestor
                    "nome": nome,
                    "percentual_rateio": percentual,
                    "desconto": desconto_padrao,
                    "status": "PENDENTE",
                    "usuario_id": usuario_existente_id
                }

                # Se já tem usuario_id, ativar automaticamente
                if usuario_existente_id:
                    beneficiario_data["status"] = "ATIVO"
                    beneficiario_data["ativado_em"] = datetime.now(timezone.utc).isoformat()

                self.db.beneficiarios().insert(beneficiario_data).execute()
                importados += 1

                logger.info(f"Beneficiária importada: UC {cod_empresa}/{cdc}-{digito}")

            except Exception as e:
                logger.error(f"Erro ao importar beneficiária CDC {benef.get('cdc')}: {e}")
                erros.append({"cdc": benef.get("cdc"), "erro": str(e)})

        return {
            "importados": importados,
            "existentes": existentes,
            "erros": erros
        }

    async def vincular_por_cpf(self, cpf: str, usuario_id: str) -> List[int]:
        """
        Vincula todos os beneficiários com este CPF ao usuário.
        Chamado automaticamente no signup.

        Args:
            cpf: CPF do usuário
            usuario_id: ID do usuário

        Returns:
            Lista de IDs de beneficiários vinculados
        """
        # Normalizar CPF (remover formatação)
        cpf_limpo = ''.join(filter(str.isdigit, cpf))
        logger.info(f"Tentando vincular beneficiários com CPF: {cpf_limpo} ao usuário: {usuario_id}")

        # Buscar beneficiários com este CPF (sem filtrar por usuario_id para debug)
        result = self.db.beneficiarios().select("id, cpf, usuario_id, status").eq(
            "cpf", cpf_limpo
        ).execute()

        logger.info(f"Beneficiários encontrados com CPF {cpf_limpo}: {result.data}")

        if not result.data:
            logger.info(f"Nenhum beneficiário encontrado com CPF {cpf_limpo}")
            return []

        vinculados = []
        for benef in result.data:
            # Verificar se já está vinculado
            if benef.get("usuario_id"):
                logger.info(f"Beneficiário {benef['id']} já está vinculado ao usuário {benef['usuario_id']}")
                continue

            # Vincular
            self.db.beneficiarios().update({
                "usuario_id": usuario_id,
                "status": "ATIVO",
                "ativado_em": datetime.now(timezone.utc).isoformat()
            }).eq("id", benef["id"]).execute()
            vinculados.append(benef["id"])
            logger.info(f"Beneficiário {benef['id']} vinculado ao usuário {usuario_id}")

        if vinculados:
            logger.info(f"Beneficiários vinculados por CPF {cpf_limpo}: {vinculados}")
        else:
            logger.info(f"Nenhum beneficiário disponível para vincular com CPF {cpf_limpo}")

        return vinculados

    async def atualizar_cpf_e_vincular(
        self,
        beneficiario_id: int,
        cpf: str
    ) -> BeneficiarioResponse:
        """
        Atualiza CPF do beneficiário e tenta vincular usuário existente.

        Args:
            beneficiario_id: ID do beneficiário
            cpf: CPF a ser vinculado

        Returns:
            BeneficiarioResponse atualizado
        """
        # Verifica se beneficiário existe
        benef = await self.buscar_por_id(beneficiario_id)

        # Atualiza CPF
        update_data = {"cpf": cpf}

        # Busca se existe usuário com este CPF
        usuario_result = self.db.table("usuarios").select("id").eq(
            "cpf", cpf
        ).execute()

        if usuario_result.data:
            # Usuário existe - vincular automaticamente
            update_data["usuario_id"] = usuario_result.data[0]["id"]
            update_data["status"] = "ATIVO"
            update_data["ativado_em"] = datetime.now(timezone.utc).isoformat()
            logger.info(f"Beneficiário {beneficiario_id} vinculado automaticamente ao usuário {update_data['usuario_id']}")

        self.db.beneficiarios().update(update_data).eq("id", beneficiario_id).execute()

        return await self.buscar_por_id(beneficiario_id)


# Instância global do serviço
beneficiarios_service = BeneficiariosService()
