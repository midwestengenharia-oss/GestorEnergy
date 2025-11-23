"""
Rotas de autenticacao - SignUp, SignIn, Refresh Token
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from datetime import datetime
from pydantic import ValidationError

from database import SessionLocal, Usuario
from auth import (
    hash_senha,
    verificar_senha,
    autenticar_usuario,
    criar_tokens,
    decodificar_refresh_token,
    get_usuario_atual
)
from schemas import (
    UsuarioCreate,
    UsuarioLogin,
    TokenResponse,
    RefreshTokenRequest,
    UsuarioResponse,
    UsuarioUpdate,
    AlterarSenhaRequest,
    MensagemResponse
)

router = APIRouter(prefix="/auth", tags=["Autenticacao"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ==========================================
# ROTAS PUBLICAS
# ==========================================

@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def signup(dados: UsuarioCreate, db: Session = Depends(get_db)):
    """
    Cadastro de novo usuario.
    Retorna tokens JWT para login automatico apos cadastro.
    """
    try:
        # Verifica se email ja existe
        if db.query(Usuario).filter(Usuario.email == dados.email).first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email ja cadastrado"
            )

        # Verifica se CPF ja existe
        if db.query(Usuario).filter(Usuario.cpf == dados.cpf).first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="CPF ja cadastrado"
            )

        # Cria o usuario
        usuario = Usuario(
            email=dados.email,
            senha_hash=hash_senha(dados.senha),
            nome_completo=dados.nome_completo,
            cpf=dados.cpf,
            telefone=dados.telefone,
            ultimo_login=datetime.utcnow()
        )

        db.add(usuario)
        db.commit()
        db.refresh(usuario)

        # Retorna tokens para login automatico
        return criar_tokens(usuario)

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email ou CPF ja cadastrado"
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e.errors()[0]['msg'])
        )


@router.post("/signin", response_model=TokenResponse)
def signin(dados: UsuarioLogin, db: Session = Depends(get_db)):
    """
    Login de usuario.
    Retorna par de tokens (access + refresh).
    """
    usuario = autenticar_usuario(db, dados.email, dados.senha)

    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou senha incorretos",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Atualiza ultimo login
    usuario.ultimo_login = datetime.utcnow()
    db.commit()

    return criar_tokens(usuario)


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(dados: RefreshTokenRequest, db: Session = Depends(get_db)):
    """
    Renova os tokens usando o refresh token.
    """
    payload = decodificar_refresh_token(dados.refresh_token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token invalido ou expirado"
        )

    user_id = payload.get("sub")
    token_version = payload.get("version")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalido"
        )

    usuario = db.query(Usuario).filter(Usuario.id == int(user_id)).first()

    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario nao encontrado"
        )

    if not usuario.ativo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Conta desativada"
        )

    # Verifica versao do token (para invalidacao)
    if token_version != usuario.refresh_token_version:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token foi revogado"
        )

    return criar_tokens(usuario)


# ==========================================
# ROTAS PROTEGIDAS (REQUEREM AUTENTICACAO)
# ==========================================

@router.get("/me", response_model=UsuarioResponse)
def get_me(usuario: Usuario = Depends(get_usuario_atual)):
    """
    Retorna dados do usuario logado.
    """
    return usuario


@router.put("/me", response_model=UsuarioResponse)
def update_me(
    dados: UsuarioUpdate,
    usuario: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db)
):
    """
    Atualiza dados do usuario logado.
    """
    if dados.nome_completo:
        usuario.nome_completo = dados.nome_completo
    if dados.telefone:
        usuario.telefone = dados.telefone

    db.commit()
    db.refresh(usuario)
    return usuario


@router.post("/me/alterar-senha", response_model=MensagemResponse)
def alterar_senha(
    dados: AlterarSenhaRequest,
    usuario: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db)
):
    """
    Altera a senha do usuario logado.
    """
    if not verificar_senha(dados.senha_atual, usuario.senha_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Senha atual incorreta"
        )

    usuario.senha_hash = hash_senha(dados.nova_senha)
    # Incrementa versao do refresh token para invalidar tokens antigos
    usuario.refresh_token_version += 1
    db.commit()

    return MensagemResponse(msg="Senha alterada com sucesso")


@router.post("/logout", response_model=MensagemResponse)
def logout(
    usuario: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db)
):
    """
    Logout - invalida todos os refresh tokens do usuario.
    """
    usuario.refresh_token_version += 1
    db.commit()

    return MensagemResponse(msg="Logout realizado com sucesso")
