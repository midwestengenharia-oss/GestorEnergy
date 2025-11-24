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
    endereco = Column(String)
    nome_titular = Column(String, nullable=True)

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
