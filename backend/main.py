"""
Main - Aplicação FastAPI principal
"""

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from contextlib import asynccontextmanager
import logging

from backend.config import settings
from backend.core.exceptions import PlataformaException

# Configuração de logging
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifecycle da aplicação.
    Executa código na inicialização e finalização.
    """
    # Startup
    logger.info(f"Iniciando {settings.APP_NAME} v{settings.APP_VERSION}")
    logger.info(f"Ambiente: {settings.ENVIRONMENT}")
    logger.info(f"Supabase URL: {settings.SUPABASE_URL}")

    # Inicia o scheduler de sincronização (a cada 10 minutos)
    from backend.sync.scheduler import sync_scheduler
    sync_scheduler.start()
    logger.info("🔄 Sync Scheduler iniciado (intervalo: 10 minutos)")

    yield

    # Shutdown
    logger.info("Finalizando aplicação...")
    sync_scheduler.stop()
    logger.info("🛑 Sync Scheduler parado")


# Criação da aplicação FastAPI
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="""
## Plataforma GD - Backend Unificado

Sistema de gestão de Geração Distribuída de energia solar.

### Funcionalidades:
- **Autenticação**: Login via Supabase Auth com perfis customizados
- **Gateway Energisa**: Integração com portal da Energisa (scraping)
- **Gestão de UCs**: Vinculação e monitoramento de Unidades Consumidoras
- **Usinas**: Gestão de usinas solares e rateio de créditos
- **Beneficiários**: Cadastro e gestão de beneficiários de GD
- **Faturas**: Histórico e sincronização de faturas
- **Cobranças**: Geração de cobranças para beneficiários
- **Contratos**: Gestão de contratos digitais
- **Marketplace**: Parceiros e produtos (futuro)

### Perfis de Usuário:
- `superadmin`: Administrador da plataforma
- `proprietario`: Dono de usina solar
- `gestor`: Gerencia UCs de terceiros
- `beneficiario`: Recebe créditos de energia
- `usuario`: Usuário básico
- `parceiro`: Integrador solar (Marketplace)
    """,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    lifespan=lifespan
)


# ========================
# Middlewares
# ========================

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ========================
# Exception Handlers
# ========================

@app.exception_handler(PlataformaException)
async def plataforma_exception_handler(request: Request, exc: PlataformaException):
    """Handler para exceções customizadas da plataforma"""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": True,
            "message": exc.detail,
            "status_code": exc.status_code
        }
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handler para erros de validação do Pydantic"""
    errors = []
    for error in exc.errors():
        loc = " -> ".join(str(l) for l in error["loc"])
        errors.append(f"{loc}: {error['msg']}")

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": True,
            "message": "Erro de validação",
            "details": errors,
            "status_code": 422
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handler para exceções não tratadas"""
    logger.exception(f"Erro não tratado: {exc}")

    # Em produção, não expor detalhes do erro
    detail = str(exc) if settings.DEBUG else "Erro interno do servidor"

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": True,
            "message": detail,
            "status_code": 500
        }
    )


# ========================
# Rotas Base
# ========================

@app.get("/", tags=["Health"])
async def root():
    """Rota raiz - Health check básico"""
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "online",
        "environment": settings.ENVIRONMENT
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """Health check detalhado"""
    from backend.core.database import get_supabase

    # Testa conexão com Supabase
    supabase_status = "unknown"
    try:
        client = get_supabase()
        # Tenta uma query simples
        result = client.table("config_plataforma").select("chave").limit(1).execute()
        supabase_status = "connected" if result.data is not None else "error"
    except Exception as e:
        supabase_status = f"error: {str(e)}"

    return {
        "status": "healthy",
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "services": {
            "supabase": supabase_status
        }
    }


# ========================
# Registrar Routers
# ========================

# Auth - Autenticação com Supabase
from backend.auth.router import router as auth_router
app.include_router(auth_router, prefix="/api/auth", tags=["Auth"])

# Energisa - Gateway de integração (PRESERVADO do gateway original)
from backend.energisa.router import router as energisa_router
app.include_router(energisa_router, prefix="/api/energisa", tags=["Energisa"])

# Usuarios - Gestão de usuários
from backend.usuarios.router import router as usuarios_router
app.include_router(usuarios_router, prefix="/api/usuarios", tags=["Usuários"])

# UCs - Unidades Consumidoras
from backend.ucs.router import router as ucs_router
app.include_router(ucs_router, prefix="/api/ucs", tags=["UCs"])

# Usinas - Usinas de GD
from backend.usinas.router import router as usinas_router
app.include_router(usinas_router, prefix="/api/usinas", tags=["Usinas"])

# Beneficiários - Beneficiários de GD
from backend.beneficiarios.router import router as beneficiarios_router
app.include_router(beneficiarios_router, prefix="/api/beneficiarios", tags=["Beneficiários"])

# Faturas - Histórico de faturas
from backend.faturas.router import router as faturas_router
app.include_router(faturas_router, prefix="/api/faturas", tags=["Faturas"])

# Cobranças - Gestão de cobranças
from backend.cobrancas.router import router as cobrancas_router
app.include_router(cobrancas_router, prefix="/api/cobrancas", tags=["Cobranças"])

# Contratos - Gestão de contratos digitais
from backend.contratos.router import router as contratos_router
app.include_router(contratos_router, prefix="/api/contratos", tags=["Contratos"])

# Saques - Comissões e saques
from backend.saques.router import router as saques_router
app.include_router(saques_router, prefix="/api/saques", tags=["Saques"])

# Leads - Captação e simulação
from backend.leads.router import router as leads_router
app.include_router(leads_router, prefix="/api/leads", tags=["Leads"])

# Notificações - Sistema de notificações
from backend.notificacoes.router import router as notificacoes_router
app.include_router(notificacoes_router, prefix="/api/notificacoes", tags=["Notificações"])

# Admin - Administração do sistema
from backend.admin.router import router as admin_router
app.include_router(admin_router, prefix="/api/admin", tags=["Admin"])

# Configurações - Impostos e parâmetros do sistema
from backend.configuracoes.router import router as configuracoes_router
app.include_router(configuracoes_router, prefix="/api", tags=["Configurações"])

# Sync - Sincronização com Energisa
from backend.sync.router import router as sync_router
app.include_router(sync_router, prefix="/api/sync", tags=["Sync"])


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG
    )
