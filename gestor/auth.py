"""
Modulo de autenticacao JWT + Refresh Token
"""
import os
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from database import SessionLocal, Usuario

# Configuracoes JWT
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "sua-chave-secreta-muito-segura-mude-em-producao")
REFRESH_SECRET_KEY = os.getenv("JWT_REFRESH_SECRET_KEY", "sua-chave-refresh-secreta-mude-em-producao")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7

# Configuracao de senha
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Security scheme
security = HTTPBearer()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ==========================================
# FUNCOES DE SENHA
# ==========================================

def hash_senha(senha: str) -> str:
    """Gera hash bcrypt da senha"""
    return pwd_context.hash(senha)


def verificar_senha(senha_plana: str, senha_hash: str) -> bool:
    """Verifica se a senha corresponde ao hash"""
    return pwd_context.verify(senha_plana, senha_hash)


# ==========================================
# FUNCOES DE TOKEN
# ==========================================

def criar_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Cria um access token JWT"""
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({
        "exp": expire,
        "type": "access"
    })
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def criar_refresh_token(data: dict, token_version: int) -> str:
    """Cria um refresh token JWT"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({
        "exp": expire,
        "type": "refresh",
        "version": token_version
    })
    return jwt.encode(to_encode, REFRESH_SECRET_KEY, algorithm=ALGORITHM)


def decodificar_access_token(token: str) -> Optional[dict]:
    """Decodifica e valida um access token"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "access":
            return None
        return payload
    except JWTError:
        return None


def decodificar_refresh_token(token: str) -> Optional[dict]:
    """Decodifica e valida um refresh token"""
    try:
        payload = jwt.decode(token, REFRESH_SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "refresh":
            return None
        return payload
    except JWTError:
        return None


# ==========================================
# FUNCOES DE AUTENTICACAO
# ==========================================

def autenticar_usuario(db: Session, email: str, senha: str) -> Optional[Usuario]:
    """Autentica usuario por email e senha"""
    usuario = db.query(Usuario).filter(Usuario.email == email.lower()).first()
    if not usuario:
        return None
    if not verificar_senha(senha, usuario.senha_hash):
        return None
    if not usuario.ativo:
        return None
    return usuario


def criar_tokens(usuario: Usuario) -> dict:
    """Cria par de tokens (access + refresh) para o usuario"""
    token_data = {
        "sub": str(usuario.id),
        "email": usuario.email,
        "nome": usuario.nome_completo
    }

    access_token = criar_access_token(token_data)
    refresh_token = criar_refresh_token(token_data, usuario.refresh_token_version)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60  # em segundos
    }


# ==========================================
# DEPENDENCIAS FASTAPI
# ==========================================

async def get_usuario_atual(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> Usuario:
    """Dependencia para obter o usuario autenticado"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token invalido ou expirado",
        headers={"WWW-Authenticate": "Bearer"},
    )

    token = credentials.credentials
    payload = decodificar_access_token(token)

    if payload is None:
        raise credentials_exception

    user_id = payload.get("sub")
    if user_id is None:
        raise credentials_exception

    usuario = db.query(Usuario).filter(Usuario.id == int(user_id)).first()
    if usuario is None:
        raise credentials_exception

    if not usuario.ativo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Conta desativada"
        )

    return usuario


async def get_usuario_opcional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False)),
    db: Session = Depends(get_db)
) -> Optional[Usuario]:
    """Dependencia para obter usuario opcionalmente (rotas publicas/privadas)"""
    if credentials is None:
        return None

    token = credentials.credentials
    payload = decodificar_access_token(token)

    if payload is None:
        return None

    user_id = payload.get("sub")
    if user_id is None:
        return None

    return db.query(Usuario).filter(Usuario.id == int(user_id)).first()
