"""
Schemas Pydantic para validacao de dados no Gestor.
Garante que os dados recebidos pelo frontend estao corretos.
"""
from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime
import re


class ClienteCreate(BaseModel):
    """Schema para criacao de nova empresa/cliente"""
    nome: str
    cpf: str
    telefone_final: str

    @field_validator('nome')
    @classmethod
    def nome_nao_vazio(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError('Nome da empresa nao pode estar vazio')
        if len(v) < 2:
            raise ValueError('Nome da empresa deve ter pelo menos 2 caracteres')
        return v

    @field_validator('cpf')
    @classmethod
    def validar_cpf(cls, v: str) -> str:
        # Remove formatacao
        cpf_limpo = re.sub(r'[.\-\s]', '', v)

        if not cpf_limpo.isdigit():
            raise ValueError('CPF deve conter apenas numeros')

        if len(cpf_limpo) != 11:
            raise ValueError('CPF deve ter exatamente 11 digitos')

        # Verifica se todos os digitos sao iguais (CPF invalido)
        if len(set(cpf_limpo)) == 1:
            raise ValueError('CPF invalido')

        return cpf_limpo

    @field_validator('telefone_final')
    @classmethod
    def validar_telefone(cls, v: str) -> str:
        # Remove formatacao
        tel_limpo = re.sub(r'[\(\)\-\s\+]', '', v)

        if not tel_limpo.isdigit():
            raise ValueError('Telefone deve conter apenas numeros')

        # Aceita telefones de 8 a 13 digitos (com ou sem DDD/DDI)
        if len(tel_limpo) < 4 or len(tel_limpo) > 13:
            raise ValueError('Telefone deve ter entre 4 e 13 digitos')

        return tel_limpo


class ValidarSmsRequest(BaseModel):
    """Schema para validacao do codigo SMS"""
    codigo_sms: str

    @field_validator('codigo_sms')
    @classmethod
    def validar_codigo(cls, v: str) -> str:
        codigo = v.strip()

        if not codigo:
            raise ValueError('Codigo SMS nao pode estar vazio')

        if not codigo.isdigit():
            raise ValueError('Codigo SMS deve conter apenas numeros')

        if len(codigo) < 4 or len(codigo) > 8:
            raise ValueError('Codigo SMS deve ter entre 4 e 8 digitos')

        return codigo


class ClienteResponse(BaseModel):
    """Schema de resposta para Cliente"""
    id: int
    nome_empresa: str
    responsavel_cpf: str
    telefone_login: str
    status_conexao: str
    ultimo_login: Optional[datetime] = None
    ultimo_sync: Optional[datetime] = None
    status_sync: Optional[str] = None
    mensagem_sync: Optional[str] = None

    class Config:
        from_attributes = True


class UnidadeConsumidoraResponse(BaseModel):
    """Schema de resposta para Unidade Consumidora"""
    id: int
    codigo_uc: int
    cdc: int
    digito_verificador: int
    empresa_web: int
    endereco: str
    nome_titular: Optional[str] = None
    numero_imovel: Optional[str] = None
    complemento: Optional[str] = None
    bairro: Optional[str] = None
    nome_municipio: Optional[str] = None
    uf: Optional[str] = None
    uc_ativa: Optional[bool] = None
    uc_cortada: Optional[bool] = None
    uc_desligada: Optional[bool] = None
    contrato_ativo: Optional[bool] = None
    is_geradora: bool
    saldo_acumulado: float
    tipo_geracao: Optional[str] = None
    percentual_rateio: float
    geradora_id: Optional[int] = None

    class Config:
        from_attributes = True


class FaturaResponse(BaseModel):
    """Schema de resposta para Fatura"""
    id: int
    uc_id: int
    mes: int
    ano: int
    valor: float
    vencimento: Optional[str] = None
    status: str
    numero_fatura: int
    arquivo_pdf_path: Optional[str] = None
    data_leitura: Optional[str] = None
    consumo_kwh: int
    codigo_barras: Optional[str] = None
    pix_copia_cola: Optional[str] = None

    class Config:
        from_attributes = True


class SyncStatusResponse(BaseModel):
    """Schema para status de sincronizacao"""
    cliente_id: int
    status: str  # PENDENTE, SINCRONIZANDO, CONCLUIDO, ERRO
    ultimo_sync: Optional[datetime] = None
    mensagem: Optional[str] = None


class MensagemResponse(BaseModel):
    """Schema generico para respostas de mensagem"""
    msg: str
    id: Optional[int] = None
    details: Optional[str] = None


# ==========================================
# SCHEMAS DE AUTENTICACAO
# ==========================================

class UsuarioCreate(BaseModel):
    """Schema para cadastro de novo usuario"""
    email: str
    senha: str
    nome_completo: str
    cpf: str
    telefone: str

    @field_validator('email')
    @classmethod
    def validar_email(cls, v: str) -> str:
        email = v.strip().lower()
        if not email:
            raise ValueError('Email nao pode estar vazio')
        # Validacao basica de email
        if not re.match(r'^[\w\.-]+@[\w\.-]+\.\w+$', email):
            raise ValueError('Email invalido')
        return email

    @field_validator('senha')
    @classmethod
    def validar_senha(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError('Senha deve ter pelo menos 6 caracteres')
        if len(v) > 100:
            raise ValueError('Senha muito longa')
        return v

    @field_validator('nome_completo')
    @classmethod
    def validar_nome(cls, v: str) -> str:
        nome = v.strip()
        if not nome:
            raise ValueError('Nome completo nao pode estar vazio')
        if len(nome) < 3:
            raise ValueError('Nome completo deve ter pelo menos 3 caracteres')
        if len(nome.split()) < 2:
            raise ValueError('Informe nome e sobrenome')
        return nome

    @field_validator('cpf')
    @classmethod
    def validar_cpf(cls, v: str) -> str:
        cpf_limpo = re.sub(r'[.\-\s]', '', v)
        if not cpf_limpo.isdigit():
            raise ValueError('CPF deve conter apenas numeros')
        if len(cpf_limpo) != 11:
            raise ValueError('CPF deve ter exatamente 11 digitos')
        if len(set(cpf_limpo)) == 1:
            raise ValueError('CPF invalido')
        return cpf_limpo

    @field_validator('telefone')
    @classmethod
    def validar_telefone(cls, v: str) -> str:
        tel_limpo = re.sub(r'[\(\)\-\s\+]', '', v)
        if not tel_limpo.isdigit():
            raise ValueError('Telefone deve conter apenas numeros')
        if len(tel_limpo) < 10 or len(tel_limpo) > 13:
            raise ValueError('Telefone deve ter entre 10 e 13 digitos')
        return tel_limpo


class UsuarioLogin(BaseModel):
    """Schema para login"""
    email: str
    senha: str

    @field_validator('email')
    @classmethod
    def validar_email(cls, v: str) -> str:
        return v.strip().lower()


class TokenResponse(BaseModel):
    """Schema de resposta com tokens"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshTokenRequest(BaseModel):
    """Schema para refresh de token"""
    refresh_token: str


class UsuarioResponse(BaseModel):
    """Schema de resposta para dados do usuario"""
    id: int
    email: str
    nome_completo: str
    cpf: str
    telefone: str
    ativo: bool
    email_verificado: bool
    criado_em: datetime
    ultimo_login: Optional[datetime] = None

    class Config:
        from_attributes = True


class UsuarioUpdate(BaseModel):
    """Schema para atualizacao de dados do usuario"""
    nome_completo: Optional[str] = None
    telefone: Optional[str] = None

    @field_validator('nome_completo')
    @classmethod
    def validar_nome(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        nome = v.strip()
        if len(nome) < 3:
            raise ValueError('Nome completo deve ter pelo menos 3 caracteres')
        return nome

    @field_validator('telefone')
    @classmethod
    def validar_telefone(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        tel_limpo = re.sub(r'[\(\)\-\s\+]', '', v)
        if not tel_limpo.isdigit():
            raise ValueError('Telefone deve conter apenas numeros')
        if len(tel_limpo) < 10 or len(tel_limpo) > 13:
            raise ValueError('Telefone deve ter entre 10 e 13 digitos')
        return tel_limpo


class AlterarSenhaRequest(BaseModel):
    """Schema para alteracao de senha"""
    senha_atual: str
    nova_senha: str

    @field_validator('nova_senha')
    @classmethod
    def validar_nova_senha(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError('Nova senha deve ter pelo menos 6 caracteres')
        return v


# ==========================================
# SCHEMAS DE GESTORES DE UC
# ==========================================

class SolicitarGestorRequest(BaseModel):
    """Schema para solicitar/adicionar gestor a uma UC"""
    cliente_id: int  # Empresa/Cliente
    uc_id: Optional[int] = None  # ID da UC no banco local (opcional)
    cdc: int
    digito_verificador: int
    empresa_web: int = 6
    cpf_gestor: str  # CPF de quem sera o gestor
    nome_gestor: Optional[str] = None
    is_proprietario: bool  # True = adiciona direto, False = cria solicitacao pendente

    @field_validator('cpf_gestor')
    @classmethod
    def validar_cpf(cls, v: str) -> str:
        cpf_limpo = re.sub(r'[.\-\s]', '', v)
        if not cpf_limpo.isdigit():
            raise ValueError('CPF deve conter apenas numeros')
        if len(cpf_limpo) != 11:
            raise ValueError('CPF deve ter exatamente 11 digitos')
        return cpf_limpo


class ValidarCodigoGestorRequest(BaseModel):
    """Schema para validar codigo de autorizacao"""
    solicitacao_id: int
    codigo: str

    @field_validator('codigo')
    @classmethod
    def validar_codigo(cls, v: str) -> str:
        codigo = v.strip()
        if not codigo:
            raise ValueError('Codigo nao pode estar vazio')
        if not codigo.isdigit():
            raise ValueError('Codigo deve conter apenas numeros')
        return codigo


class SolicitacaoGestorResponse(BaseModel):
    """Schema de resposta para solicitacao de gestor"""
    id: int
    cliente_id: int
    uc_id: Optional[int] = None
    cdc: int
    digito_verificador: int
    empresa_web: int
    cpf_gestor: str
    nome_gestor: Optional[str] = None
    status: str
    criado_em: datetime
    expira_em: Optional[datetime] = None
    concluido_em: Optional[datetime] = None
    mensagem: Optional[str] = None
    # Dados extras para exibicao
    endereco_uc: Optional[str] = None
    nome_empresa: Optional[str] = None

    class Config:
        from_attributes = True


# ==========================================
# SCHEMAS DE LEADS (LANDING PAGE)
# ==========================================

class LeadCreate(BaseModel):
    """Schema para criacao de lead via landing page"""
    cpf: str
    nome: Optional[str] = None
    telefone: Optional[str] = None
    email: Optional[str] = None
    total_ucs: int = 0
    total_consumo_kwh: int = 0
    valor_total_faturas: float = 0.0
    dados_simulacao_json: Optional[str] = None
    ip_origem: Optional[str] = None
    user_agent: Optional[str] = None

    @field_validator('cpf')
    @classmethod
    def validar_cpf(cls, v: str) -> str:
        cpf_limpo = re.sub(r'[.\-\s]', '', v)
        if not cpf_limpo.isdigit():
            raise ValueError('CPF deve conter apenas numeros')
        if len(cpf_limpo) != 11:
            raise ValueError('CPF deve ter exatamente 11 digitos')
        return cpf_limpo


class LeadResponse(BaseModel):
    """Schema de resposta para Lead"""
    id: int
    cpf: str
    nome: Optional[str] = None
    telefone: Optional[str] = None
    email: Optional[str] = None
    total_ucs: int
    total_consumo_kwh: int
    valor_total_faturas: float
    status: str
    cliente_id: Optional[int] = None
    uc_geradora_id: Optional[int] = None
    observacoes: Optional[str] = None
    motivo_perda: Optional[str] = None
    criado_em: datetime
    atualizado_em: datetime
    convertido_em: Optional[datetime] = None
    origem: str

    class Config:
        from_attributes = True


class LeadUpdate(BaseModel):
    """Schema para atualizacao de lead"""
    nome: Optional[str] = None
    telefone: Optional[str] = None
    email: Optional[str] = None
    status: Optional[str] = None
    cliente_id: Optional[int] = None
    uc_geradora_id: Optional[int] = None
    observacoes: Optional[str] = None
    motivo_perda: Optional[str] = None


class InteracaoLeadCreate(BaseModel):
    """Schema para criar interacao com lead"""
    lead_id: int
    tipo: str  # NOTA, LIGACAO, EMAIL, WHATSAPP, REUNIAO, STATUS_CHANGE
    titulo: str
    descricao: Optional[str] = None
    status_anterior: Optional[str] = None
    status_novo: Optional[str] = None

    @field_validator('tipo')
    @classmethod
    def validar_tipo(cls, v: str) -> str:
        tipos_validos = ['NOTA', 'LIGACAO', 'EMAIL', 'WHATSAPP', 'REUNIAO', 'STATUS_CHANGE']
        if v.upper() not in tipos_validos:
            raise ValueError(f'Tipo deve ser um de: {", ".join(tipos_validos)}')
        return v.upper()


class InteracaoLeadResponse(BaseModel):
    """Schema de resposta para interacao"""
    id: int
    lead_id: int
    tipo: str
    titulo: str
    descricao: Optional[str] = None
    status_anterior: Optional[str] = None
    status_novo: Optional[str] = None
    usuario_id: Optional[int] = None
    criado_em: datetime

    class Config:
        from_attributes = True
