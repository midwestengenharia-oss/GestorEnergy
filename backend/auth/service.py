"""
Auth Service - Lógica de autenticação com Supabase Auth
"""

from typing import Optional, Tuple
from supabase_auth.errors import AuthApiError
import logging

from backend.config import settings
from backend.core.database import db_admin, get_supabase
from backend.core.exceptions import (
    AuthenticationError,
    ConflictError,
    NotFoundError,
    ValidationError,
)
from backend.auth.schemas import (
    SignUpRequest,
    SignInRequest,
    UserResponse,
    AuthTokens,
    PerfilResponse,
)

logger = logging.getLogger(__name__)


class AuthService:
    """Serviço de autenticação híbrido (Supabase Auth + tabela usuarios)"""

    def __init__(self):
        self.supabase = get_supabase()
        self.db = db_admin

    async def signup(self, data: SignUpRequest) -> Tuple[UserResponse, AuthTokens]:
        """
        Cadastra novo usuário.

        1. Verifica se CPF/CNPJ já existe
        2. Cria usuário no Supabase Auth
        3. Cria registro na tabela usuarios
        4. Adiciona perfil 'usuario' padrão

        Args:
            data: Dados do cadastro

        Returns:
            Tupla (UserResponse, AuthTokens)

        Raises:
            ConflictError: Se email, CPF ou CNPJ já existem
            ValidationError: Se dados inválidos
        """
        # Verifica duplicidade baseado no tipo de pessoa
        if data.tipo_pessoa.value == "PF" and data.cpf:
            existing = self.db.usuarios().select("id").eq("cpf", data.cpf).execute()
            if existing.data:
                raise ConflictError("CPF já cadastrado no sistema")
        elif data.tipo_pessoa.value == "PJ" and data.cnpj:
            existing = self.db.usuarios().select("id").eq("cnpj", data.cnpj).execute()
            if existing.data:
                raise ConflictError("CNPJ já cadastrado no sistema")

        # Verifica se email já existe na tabela usuarios
        existing_email = self.db.usuarios().select("id").eq("email", data.email).execute()
        if existing_email.data:
            raise ConflictError("Email já cadastrado no sistema")

        try:
            # Cria usuário no Supabase Auth
            auth_response = self.supabase.auth.sign_up({
                "email": data.email,
                "password": data.password,
                "options": {
                    "data": {
                        "nome_completo": data.nome_completo
                    }
                }
            })

            if not auth_response.user:
                raise AuthenticationError("Erro ao criar usuário no Supabase Auth")

            # Se não há sessão, o email já existe no Supabase Auth
            if not auth_response.session:
                raise ConflictError("Email já cadastrado. Faça login ou recupere sua senha.")

            auth_id = auth_response.user.id

            # Cria registro na tabela usuarios
            user_data = {
                "auth_id": auth_id,
                "tipo_pessoa": data.tipo_pessoa.value,
                "nome_completo": data.nome_completo,
                "email": data.email,
                "telefone": data.telefone,
                "ativo": True,
                "email_verificado": False
            }

            # Campos específicos PF
            if data.tipo_pessoa.value == "PF":
                user_data["cpf"] = data.cpf

            # Campos específicos PJ
            if data.tipo_pessoa.value == "PJ":
                user_data["cnpj"] = data.cnpj
                user_data["razao_social"] = data.razao_social
                user_data["nome_fantasia"] = data.nome_fantasia
                # Endereço (preenchido via BrasilAPI)
                user_data["logradouro"] = data.logradouro
                user_data["numero"] = data.numero
                user_data["complemento"] = data.complemento
                user_data["bairro"] = data.bairro
                user_data["cidade"] = data.cidade
                user_data["uf"] = data.uf
                user_data["cep"] = data.cep
                # Dados empresariais (preenchido via BrasilAPI)
                user_data["porte"] = data.porte
                user_data["natureza_juridica"] = data.natureza_juridica
                user_data["cnae_codigo"] = data.cnae_codigo
                user_data["cnae_descricao"] = data.cnae_descricao
                user_data["situacao_cadastral"] = data.situacao_cadastral
                user_data["data_abertura"] = data.data_abertura.isoformat() if data.data_abertura else None

            user_result = self.db.usuarios().insert(user_data).execute()

            if not user_result.data:
                # Rollback: deleta usuário do Supabase Auth
                # Nota: Supabase não tem delete direto via cliente, fazer via admin
                logger.error(f"Erro ao criar registro de usuário para auth_id={auth_id}")
                raise ValidationError("Erro ao criar registro de usuário")

            user = user_result.data[0]
            user_id = user["id"]

            # Adiciona perfil 'usuario' padrão
            self.db.perfis_usuario().insert({
                "usuario_id": user_id,
                "perfil": "usuario",
                "ativo": True
            }).execute()

            # Vincular beneficiários pendentes por CPF (se PF)
            perfis_adicionados = ["usuario"]
            if data.tipo_pessoa.value == "PF" and data.cpf:
                try:
                    from backend.beneficiarios.service import beneficiarios_service
                    vinculados = await beneficiarios_service.vincular_por_cpf(
                        cpf=data.cpf,
                        usuario_id=user_id
                    )
                    if vinculados:
                        logger.info(f"Beneficiários vinculados automaticamente no signup: {vinculados}")
                        # Adicionar perfil beneficiário
                        self.db.perfis_usuario().insert({
                            "usuario_id": user_id,
                            "perfil": "beneficiario",
                            "ativo": True
                        }).execute()
                        perfis_adicionados.append("beneficiario")
                except Exception as e:
                    logger.error(f"Erro ao vincular beneficiários no signup: {e}")

            # Monta resposta
            user_response = UserResponse(
                id=user_id,
                auth_id=auth_id,
                tipo_pessoa=user.get("tipo_pessoa", "PF"),
                nome_completo=user["nome_completo"],
                email=user["email"],
                cpf=user.get("cpf"),
                cnpj=user.get("cnpj"),
                razao_social=user.get("razao_social"),
                nome_fantasia=user.get("nome_fantasia"),
                telefone=user.get("telefone"),
                # Endereço
                logradouro=user.get("logradouro"),
                numero=user.get("numero"),
                complemento=user.get("complemento"),
                bairro=user.get("bairro"),
                cidade=user.get("cidade"),
                uf=user.get("uf"),
                cep=user.get("cep"),
                # Dados empresariais
                porte=user.get("porte"),
                natureza_juridica=user.get("natureza_juridica"),
                cnae_codigo=user.get("cnae_codigo"),
                cnae_descricao=user.get("cnae_descricao"),
                situacao_cadastral=user.get("situacao_cadastral"),
                data_abertura=user.get("data_abertura"),
                # Status
                is_superadmin=user.get("is_superadmin", False),
                ativo=user.get("ativo", True),
                email_verificado=user.get("email_verificado", False),
                perfis=perfis_adicionados,
                criado_em=user.get("criado_em"),
                atualizado_em=user.get("atualizado_em")
            )

            tokens = AuthTokens(
                access_token=auth_response.session.access_token,
                refresh_token=auth_response.session.refresh_token,
                token_type="bearer",
                expires_in=auth_response.session.expires_in or 3600
            )

            return user_response, tokens

        except AuthApiError as e:
            logger.error(f"Erro Supabase Auth: {e}")
            if "already registered" in str(e).lower():
                raise ConflictError("Email já cadastrado")
            raise AuthenticationError(f"Erro na autenticação: {str(e)}")

    async def signin(self, data: SignInRequest) -> Tuple[UserResponse, AuthTokens, list]:
        """
        Realiza login do usuário.

        1. Autentica no Supabase Auth
        2. Busca dados na tabela usuarios
        3. Detecta perfis disponíveis

        Args:
            data: Credenciais de login

        Returns:
            Tupla (UserResponse, AuthTokens, perfis_disponiveis)

        Raises:
            AuthenticationError: Se credenciais inválidas
        """
        try:
            # Autentica no Supabase Auth
            auth_response = self.supabase.auth.sign_in_with_password({
                "email": data.email,
                "password": data.password
            })

            if not auth_response.user or not auth_response.session:
                raise AuthenticationError("Credenciais inválidas")

            auth_id = auth_response.user.id

            # Busca dados do usuário
            user_result = self.db.usuarios().select(
                "*",
                "perfis_usuario(perfil, ativo)"
            ).eq("auth_id", auth_id).single().execute()

            if not user_result.data:
                raise AuthenticationError("Usuário não encontrado no sistema")

            user = user_result.data

            if not user.get("ativo", True):
                raise AuthenticationError("Usuário desativado")

            # Extrai perfis
            perfis = []
            if user.get("perfis_usuario"):
                perfis = [
                    p["perfil"] for p in user["perfis_usuario"]
                    if p.get("ativo", True)
                ]

            # Detecta perfis automáticos (proprietário, gestor, beneficiário)
            perfis_detectados = await self._detectar_perfis(user["id"])
            perfis_disponiveis = list(set(perfis + perfis_detectados))

            user_response = UserResponse(
                id=user["id"],
                auth_id=auth_id,
                tipo_pessoa=user.get("tipo_pessoa", "PF"),
                nome_completo=user["nome_completo"],
                email=user["email"],
                cpf=user.get("cpf"),
                cnpj=user.get("cnpj"),
                razao_social=user.get("razao_social"),
                nome_fantasia=user.get("nome_fantasia"),
                telefone=user.get("telefone"),
                # Endereço
                logradouro=user.get("logradouro"),
                numero=user.get("numero"),
                complemento=user.get("complemento"),
                bairro=user.get("bairro"),
                cidade=user.get("cidade"),
                uf=user.get("uf"),
                cep=user.get("cep"),
                # Dados empresariais
                porte=user.get("porte"),
                natureza_juridica=user.get("natureza_juridica"),
                cnae_codigo=user.get("cnae_codigo"),
                cnae_descricao=user.get("cnae_descricao"),
                situacao_cadastral=user.get("situacao_cadastral"),
                data_abertura=user.get("data_abertura"),
                # Status
                is_superadmin=user.get("is_superadmin", False),
                ativo=user.get("ativo", True),
                email_verificado=user.get("email_verificado", False),
                perfis=perfis,
                criado_em=user.get("criado_em"),
                atualizado_em=user.get("atualizado_em")
            )

            tokens = AuthTokens(
                access_token=auth_response.session.access_token,
                refresh_token=auth_response.session.refresh_token,
                token_type="bearer",
                expires_in=auth_response.session.expires_in or 3600
            )

            return user_response, tokens, perfis_disponiveis

        except AuthApiError as e:
            logger.error(f"Erro Supabase Auth login: {e}")
            raise AuthenticationError("Email ou senha inválidos")

    async def refresh_token(self, refresh_token: str) -> AuthTokens:
        """
        Renova tokens usando refresh_token.

        Args:
            refresh_token: Refresh token atual

        Returns:
            Novos tokens

        Raises:
            AuthenticationError: Se token inválido
        """
        try:
            # Supabase-py refresh_session espera um dict ou apenas o refresh_token
            # Tentamos ambos os formatos para compatibilidade
            try:
                # Formato mais recente: passar refresh_token diretamente
                auth_response = self.supabase.auth.refresh_session(refresh_token)
            except TypeError:
                # Formato alternativo: setar sessão primeiro
                self.supabase.auth.set_session(access_token="", refresh_token=refresh_token)
                auth_response = self.supabase.auth.refresh_session()

            if not auth_response or not auth_response.session:
                raise AuthenticationError("Sessão inválida")

            return AuthTokens(
                access_token=auth_response.session.access_token,
                refresh_token=auth_response.session.refresh_token,
                token_type="bearer",
                expires_in=auth_response.session.expires_in or 3600
            )

        except AuthApiError as e:
            logger.error(f"Erro refresh token: {e}")
            raise AuthenticationError("Token de refresh inválido ou expirado")
        except Exception as e:
            logger.error(f"Erro inesperado no refresh: {e}")
            raise AuthenticationError("Erro ao renovar token")

    async def logout(self) -> bool:
        """
        Realiza logout do usuário atual.

        Returns:
            True se sucesso
        """
        try:
            self.supabase.auth.sign_out()
            return True
        except Exception as e:
            logger.error(f"Erro logout: {e}")
            return False

    async def get_user_by_id(self, user_id: int) -> Optional[UserResponse]:
        """
        Busca usuário por ID.

        Args:
            user_id: ID do usuário

        Returns:
            UserResponse ou None
        """
        result = self.db.usuarios().select(
            "*",
            "perfis_usuario(perfil, ativo)"
        ).eq("id", user_id).single().execute()

        if not result.data:
            return None

        user = result.data
        perfis = []
        if user.get("perfis_usuario"):
            perfis = [
                p["perfil"] for p in user["perfis_usuario"]
                if p.get("ativo", True)
            ]

        return UserResponse(
            id=user["id"],
            auth_id=user["auth_id"],
            tipo_pessoa=user.get("tipo_pessoa", "PF"),
            nome_completo=user["nome_completo"],
            email=user["email"],
            cpf=user.get("cpf"),
            cnpj=user.get("cnpj"),
            razao_social=user.get("razao_social"),
            nome_fantasia=user.get("nome_fantasia"),
            telefone=user.get("telefone"),
            # Endereço
            logradouro=user.get("logradouro"),
            numero=user.get("numero"),
            complemento=user.get("complemento"),
            bairro=user.get("bairro"),
            cidade=user.get("cidade"),
            uf=user.get("uf"),
            cep=user.get("cep"),
            # Dados empresariais
            porte=user.get("porte"),
            natureza_juridica=user.get("natureza_juridica"),
            cnae_codigo=user.get("cnae_codigo"),
            cnae_descricao=user.get("cnae_descricao"),
            situacao_cadastral=user.get("situacao_cadastral"),
            data_abertura=user.get("data_abertura"),
            # Status
            is_superadmin=user.get("is_superadmin", False),
            ativo=user.get("ativo", True),
            email_verificado=user.get("email_verificado", False),
            perfis=perfis,
            criado_em=user.get("criado_em"),
            atualizado_em=user.get("atualizado_em")
        )

    async def update_profile(
        self,
        user_id: int,
        nome_completo: Optional[str] = None,
        telefone: Optional[str] = None,
        razao_social: Optional[str] = None,
        nome_fantasia: Optional[str] = None,
        # Campos de endereço
        logradouro: Optional[str] = None,
        numero: Optional[str] = None,
        complemento: Optional[str] = None,
        bairro: Optional[str] = None,
        cidade: Optional[str] = None,
        uf: Optional[str] = None,
        cep: Optional[str] = None
    ) -> UserResponse:
        """
        Atualiza perfil do usuário.

        Args:
            user_id: ID do usuário
            nome_completo: Novo nome
            telefone: Novo telefone
            razao_social: Nova razão social (PJ)
            nome_fantasia: Novo nome fantasia (PJ)
            logradouro: Logradouro do endereço
            numero: Número do endereço
            complemento: Complemento do endereço
            bairro: Bairro
            cidade: Cidade
            uf: UF (sigla do estado)
            cep: CEP

        Returns:
            UserResponse atualizado
        """
        update_data = {}
        if nome_completo:
            update_data["nome_completo"] = nome_completo
        if telefone is not None:
            update_data["telefone"] = telefone
        if razao_social is not None:
            update_data["razao_social"] = razao_social
        if nome_fantasia is not None:
            update_data["nome_fantasia"] = nome_fantasia
        # Campos de endereço
        if logradouro is not None:
            update_data["logradouro"] = logradouro
        if numero is not None:
            update_data["numero"] = numero
        if complemento is not None:
            update_data["complemento"] = complemento
        if bairro is not None:
            update_data["bairro"] = bairro
        if cidade is not None:
            update_data["cidade"] = cidade
        if uf is not None:
            update_data["uf"] = uf.upper()[:2] if uf else None
        if cep is not None:
            update_data["cep"] = cep

        if not update_data:
            return await self.get_user_by_id(user_id)

        result = self.db.usuarios().update(update_data).eq("id", user_id).execute()

        if not result.data:
            raise NotFoundError("Usuário")

        return await self.get_user_by_id(user_id)

    async def change_password(
        self,
        current_password: str,
        new_password: str
    ) -> bool:
        """
        Troca senha do usuário atual.

        Args:
            current_password: Senha atual
            new_password: Nova senha

        Returns:
            True se sucesso

        Raises:
            AuthenticationError: Se senha atual incorreta
        """
        try:
            # Supabase requer autenticação ativa para trocar senha
            self.supabase.auth.update_user({
                "password": new_password
            })
            return True
        except AuthApiError as e:
            logger.error(f"Erro ao trocar senha: {e}")
            raise AuthenticationError("Erro ao trocar senha. Verifique a senha atual.")

    async def get_user_perfis(self, user_id: int) -> list[PerfilResponse]:
        """
        Busca perfis do usuário.

        Args:
            user_id: ID do usuário

        Returns:
            Lista de perfis
        """
        result = self.db.perfis_usuario().select("*").eq("usuario_id", user_id).execute()

        perfis = []
        if result.data:
            perfis = [
                PerfilResponse(perfil=p["perfil"], ativo=p.get("ativo", True))
                for p in result.data
            ]

        return perfis

    async def _detectar_perfis(self, user_id: str) -> list:
        """
        Detecta perfis automáticos baseado em relacionamentos.

        - proprietario: Tem empresa com usina OU tem UC geradora como titular
        - gestor: Está em gestores_usina
        - beneficiario: Está em beneficiarios
        - parceiro: Está em parceiros ou equipe_parceiro

        Args:
            user_id: ID do usuário (UUID string)

        Returns:
            Lista de perfis detectados
        """
        perfis = []

        try:
            # Verifica se é proprietário via empresa
            # empresas.proprietario_id -> usuarios.id
            empresas = self.db.table("empresas").select("id").eq(
                "proprietario_id", user_id
            ).limit(1).execute()
            if empresas.data:
                # Verifica se a empresa tem usinas
                empresa_id = empresas.data[0]["id"]
                usinas = self.db.usinas().select("id").eq(
                    "empresa_id", empresa_id
                ).limit(1).execute()
                if usinas.data:
                    perfis.append("proprietario")

            # Também verifica se tem UC geradora como titular
            if "proprietario" not in perfis:
                ucs_geradoras = self.db.table("unidades_consumidoras").select("id").eq(
                    "usuario_id", user_id
                ).eq("is_geradora", True).eq("usuario_titular", True).limit(1).execute()
                if ucs_geradoras.data:
                    perfis.append("proprietario")
        except Exception as e:
            logger.warning(f"Erro ao detectar perfil proprietário: {e}")

        try:
            # Verifica se é gestor
            gestores = self.db.table("gestores_usina").select("id").eq(
                "gestor_id", user_id
            ).eq("ativo", True).limit(1).execute()
            if gestores.data:
                perfis.append("gestor")
        except Exception as e:
            logger.warning(f"Erro ao detectar perfil gestor: {e}")

        try:
            # Verifica se é beneficiário
            beneficiarios = self.db.beneficiarios().select("id").eq(
                "usuario_id", user_id
            ).limit(1).execute()
            if beneficiarios.data:
                perfis.append("beneficiario")
        except Exception as e:
            logger.warning(f"Erro ao detectar perfil beneficiário: {e}")

        try:
            # Verifica se é parceiro (responsável)
            parceiros = self.db.table("parceiros").select("id").eq(
                "usuario_id", user_id
            ).limit(1).execute()
            if parceiros.data:
                perfis.append("parceiro")
        except Exception as e:
            logger.warning(f"Erro ao detectar perfil parceiro: {e}")

        try:
            # Verifica se é membro de equipe de parceiro
            if "parceiro" not in perfis:
                equipe = self.db.table("equipe_parceiro").select("id").eq(
                    "usuario_id", user_id
                ).eq("ativo", True).limit(1).execute()
                if equipe.data:
                    perfis.append("parceiro")
        except Exception as e:
            logger.warning(f"Erro ao detectar perfil equipe parceiro: {e}")

        return perfis


# Instância global do serviço
auth_service = AuthService()
