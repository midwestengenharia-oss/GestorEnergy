from sqlalchemy import create_engine, Column, Integer, String, Float, ForeignKey, Boolean, DateTime, Date, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship, backref
from datetime import datetime

Base = declarative_base()

class Cliente(Base):
    __tablename__ = 'clientes'
    id = Column(Integer, primary_key=True)
    nome_empresa = Column(String)
    responsavel_cpf = Column(String, unique=True)
    telefone_login = Column(String)
    ultimo_login = Column(DateTime)
    status_conexao = Column(String, default="DESCONECTADO")
    transaction_id = Column(String, nullable=True)
    unidades = relationship("UnidadeConsumidora", back_populates="cliente")

class UnidadeConsumidora(Base):
    __tablename__ = 'unidades'
    id = Column(Integer, primary_key=True)
    cliente_id = Column(Integer, ForeignKey('clientes.id'))
    
    # Identificação
    codigo_uc = Column(Integer)
    cdc = Column(Integer)
    digito_verificador = Column(Integer)
    empresa_web = Column(Integer, default=6)
    endereco = Column(String)
    nome_titular = Column(String, nullable=True) # Novo: Para saber quem é o dono da beneficiária
    
    # Dados Solar
    is_geradora = Column(Boolean, default=False)
    saldo_acumulado = Column(Float, default=0.0)
    tipo_geracao = Column(String, nullable=True)
    percentual_rateio = Column(Float, default=0.0) # Quanto ela recebe (se for beneficiária)
    
    # --- RELACIONAMENTO PAI-FILHO (ÁRVORE) ---
    # Se este campo tiver valor, esta UC é "filha" (beneficiária) da UC com este ID
    geradora_id = Column(Integer, ForeignKey('unidades.id'), nullable=True)
    
    # Propriedade mágica: uc.beneficiarias retorna a lista de filhos
    beneficiarias = relationship("UnidadeConsumidora", 
        backref=backref('geradora', remote_side=[id]),
        foreign_keys=[geradora_id]
    )
    
    cliente = relationship("Cliente", back_populates="unidades", foreign_keys=[cliente_id])
    faturas = relationship("Fatura", back_populates="uc")

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

# Configuração
engine = create_engine('sqlite:///gestor_faturas.db', connect_args={"check_same_thread": False})
Base.metadata.create_all(engine)
SessionLocal = sessionmaker(bind=engine)