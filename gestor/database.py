from sqlalchemy import create_engine, Column, Integer, String, Float, ForeignKey, Boolean, DateTime, Date, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship, backref
from datetime import datetime

Base = declarative_base()


class Usuario(Base):
    """Modelo de usuario do sistema (autenticacao)"""
    __tablename__ = 'usuarios'

    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True, nullable=False, index=True)
    senha_hash = Column(String, nullable=False)
    nome_completo = Column(String, nullable=False)
    cpf = Column(String, unique=True, nullable=False)
    telefone = Column(String, nullable=False)

    # Controle de conta
    ativo = Column(Boolean, default=True)
    email_verificado = Column(Boolean, default=False)
    is_superadmin = Column(Boolean, default=False)  # Flag para super admin
    criado_em = Column(DateTime, default=datetime.utcnow)
    atualizado_em = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    ultimo_login = Column(DateTime, nullable=True)

    # Refresh tokens (para invalidacao)
    refresh_token_version = Column(Integer, default=0)

    # Relacionamento com empresas (multi-tenant)
    clientes = relationship("Cliente", back_populates="usuario", cascade="all, delete-orphan")


class Cliente(Base):
    """Empresa/Cliente cadastrado no sistema"""
    __tablename__ = 'clientes'

    id = Column(Integer, primary_key=True)

    # Vinculo com usuario (multi-tenant)
    usuario_id = Column(Integer, ForeignKey('usuarios.id'), nullable=False)

    nome_empresa = Column(String)
    responsavel_cpf = Column(String)  # Removido unique=True para permitir mesmo CPF em usuarios diferentes
    telefone_login = Column(String)
    ultimo_login = Column(DateTime)
    status_conexao = Column(String, default="DESCONECTADO")
    transaction_id = Column(String, nullable=True)

    # Campos de status de sincronizacao
    ultimo_sync = Column(DateTime, nullable=True)
    status_sync = Column(String, default="PENDENTE")  # PENDENTE, SINCRONIZANDO, CONCLUIDO, ERRO
    mensagem_sync = Column(String, nullable=True)

    # Relacionamentos
    usuario = relationship("Usuario", back_populates="clientes")
    unidades = relationship("UnidadeConsumidora", back_populates="cliente", cascade="all, delete-orphan")


class UnidadeConsumidora(Base):
    __tablename__ = 'unidades'
    id = Column(Integer, primary_key=True)
    cliente_id = Column(Integer, ForeignKey('clientes.id'))

    # Identificacao
    codigo_uc = Column(Integer)
    cdc = Column(Integer)
    digito_verificador = Column(Integer)
    empresa_web = Column(Integer, default=6)
    cpf_cnpj = Column(String, nullable=True)  # CPF/CNPJ do titular da UC
    endereco = Column(String)
    nome_titular = Column(String, nullable=True)

    # Detalhes do endereço
    numero_imovel = Column(String, nullable=True)
    complemento = Column(String, nullable=True)
    bairro = Column(String, nullable=True)
    nome_municipio = Column(String, nullable=True)
    uf = Column(String, nullable=True)

    # Status da UC
    uc_ativa = Column(Boolean, nullable=True)
    uc_cortada = Column(Boolean, nullable=True)
    uc_desligada = Column(Boolean, nullable=True)
    contrato_ativo = Column(Boolean, nullable=True)

    # Dados Solar
    is_geradora = Column(Boolean, default=False)
    saldo_acumulado = Column(Float, default=0.0)
    tipo_geracao = Column(String, nullable=True)
    percentual_rateio = Column(Float, default=0.0)

    # Relacionamento pai-filho (arvore)
    geradora_id = Column(Integer, ForeignKey('unidades.id'), nullable=True)

    beneficiarias = relationship("UnidadeConsumidora",
        backref=backref('geradora', remote_side=[id]),
        foreign_keys=[geradora_id]
    )

    cliente = relationship("Cliente", back_populates="unidades", foreign_keys=[cliente_id])
    faturas = relationship("Fatura", back_populates="uc", cascade="all, delete-orphan")


class Fatura(Base):
    __tablename__ = 'faturas'
    id = Column(Integer, primary_key=True)
    uc_id = Column(Integer, ForeignKey('unidades.id'))
    mes = Column(Integer)
    ano = Column(Integer)
    valor = Column(Float)
    vencimento = Column(Date, nullable=True)
    status = Column(String)
    numero_fatura = Column(Integer)
    arquivo_pdf_path = Column(String, nullable=True)
    data_leitura = Column(Date, nullable=True)
    consumo_kwh = Column(Integer, default=0)
    codigo_barras = Column(String, nullable=True)
    pix_copia_cola = Column(String, nullable=True)
    detalhes_json = Column(Text, nullable=True)

    uc = relationship("UnidadeConsumidora", back_populates="faturas")


class Lead(Base):
    """Leads gerados pela landing page (simulacoes)"""
    __tablename__ = 'leads'

    id = Column(Integer, primary_key=True)

    # Dados basicos do lead
    cpf = Column(String, nullable=False, index=True)
    nome = Column(String, nullable=True)
    telefone = Column(String, nullable=True)
    email = Column(String, nullable=True)

    # Dados da simulacao
    total_ucs = Column(Integer, default=0)
    total_consumo_kwh = Column(Integer, default=0)
    valor_total_faturas = Column(Float, default=0.0)
    dados_simulacao_json = Column(Text, nullable=True)  # JSON com detalhes completos

    # Status do lead no funil
    # NOVO -> CONTATADO -> QUALIFICADO -> PROPOSTA_ENVIADA -> NEGOCIACAO -> CONVERTIDO -> PERDIDO
    status = Column(String, default="NOVO", index=True)

    # Gestor/Usina atribuido (quando voce faz a conexao)
    cliente_id = Column(Integer, ForeignKey('clientes.id'), nullable=True)
    uc_geradora_id = Column(Integer, ForeignKey('unidades.id'), nullable=True)

    # Anotacoes do super admin
    observacoes = Column(Text, nullable=True)
    motivo_perda = Column(String, nullable=True)  # Se status = PERDIDO

    # Controle
    criado_em = Column(DateTime, default=datetime.utcnow, index=True)
    atualizado_em = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    convertido_em = Column(DateTime, nullable=True)

    # Origem/tracking
    origem = Column(String, default="LANDING_PAGE")
    ip_origem = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)

    # Relacionamentos
    cliente_atribuido = relationship("Cliente", foreign_keys=[cliente_id])
    usina_atribuida = relationship("UnidadeConsumidora", foreign_keys=[uc_geradora_id])


class InteracaoLead(Base):
    """Historico de interacoes com leads (timeline do CRM)"""
    __tablename__ = 'interacoes_lead'

    id = Column(Integer, primary_key=True)
    lead_id = Column(Integer, ForeignKey('leads.id'), nullable=False)

    # Tipo: NOTA, LIGACAO, EMAIL, WHATSAPP, REUNIAO, STATUS_CHANGE
    tipo = Column(String, nullable=False)

    # Conteudo
    titulo = Column(String, nullable=False)
    descricao = Column(Text, nullable=True)

    # Status anterior/novo (para mudancas de status)
    status_anterior = Column(String, nullable=True)
    status_novo = Column(String, nullable=True)

    # Usuario que fez a interacao (super admin por enquanto)
    usuario_id = Column(Integer, ForeignKey('usuarios.id'), nullable=True)

    # Controle
    criado_em = Column(DateTime, default=datetime.utcnow)

    # Relacionamentos
    lead = relationship("Lead", backref="interacoes")
    usuario = relationship("Usuario")


class SolicitacaoGestor(Base):
    """Solicitacoes de acesso como gestor de UC"""
    __tablename__ = 'solicitacoes_gestor'

    id = Column(Integer, primary_key=True)

    # Quem esta solicitando
    usuario_id = Column(Integer, ForeignKey('usuarios.id'), nullable=False)
    cliente_id = Column(Integer, ForeignKey('clientes.id'), nullable=False)

    # UC alvo
    uc_id = Column(Integer, ForeignKey('unidades.id'), nullable=True)
    cdc = Column(Integer, nullable=False)
    digito_verificador = Column(Integer, nullable=False)
    empresa_web = Column(Integer, default=6)

    # Dados do gestor a ser adicionado
    cpf_gestor = Column(String, nullable=False)
    nome_gestor = Column(String, nullable=True)

    # Status: PENDENTE (proprietario adiciona direto), AGUARDANDO_CODIGO (gestor espera codigo), CONCLUIDA, EXPIRADA, CANCELADA
    status = Column(String, default="PENDENTE")

    # Codigo de autorizacao (preenchido quando gestor insere o codigo recebido)
    codigo_autorizacao = Column(String, nullable=True)

    # Controle de tempo
    criado_em = Column(DateTime, default=datetime.utcnow)
    expira_em = Column(DateTime, nullable=True)
    concluido_em = Column(DateTime, nullable=True)

    # Mensagem de erro/sucesso
    mensagem = Column(String, nullable=True)

    # Relacionamentos
    usuario = relationship("Usuario")
    cliente = relationship("Cliente")
    uc = relationship("UnidadeConsumidora")


# Configuracao
engine = create_engine('sqlite:///gestor_faturas.db', connect_args={"check_same_thread": False})
Base.metadata.create_all(engine)
SessionLocal = sessionmaker(bind=engine)
