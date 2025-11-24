from fastapi import FastAPI, HTTPException, Response, Depends, status, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
from jose import jwt, JWTError
import os
from dotenv import load_dotenv
from service import EnergisaService
import base64
from typing import List, Dict, Any
import threading
import queue
import time

# Gerenciador de sessoes de login em threads separadas
# Cada login fica em sua propria thread ate o finish_login
_login_sessions = {}  # transaction_id -> {"thread": thread, "cmd_queue": queue, "result_queue": queue}

app = FastAPI(title="Energisa API Segura", version="2.1.0")
# --- CONFIGURAÇÃO DE SEGURANÇA ---

# Chave secreta para assinar o token (Em produção, use variável de ambiente!)
load_dotenv()  # Carrega variáveis do .env
SECRET_KEY = os.getenv("API_SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 # Token vale por 1 hora

# "Banco de Dados" de clientes permitidos (Simulação)
# O cliente deve enviar esses dados para ganhar o token
CLIENTS_DB = {
    "7966649d-d20a-4129-afbd-341f51aa74d6": os.getenv("CRM_SECRET")
}

# Classe para validar o Token Bearer
security = HTTPBearer()

# Modelo para login na API
class ClientLogin(BaseModel):
    client_id: str
    client_secret: str
class BeneficiariaItem(BaseModel):
    codigoEmpresaWeb: int
    cdc: int
    digitoVerificador: int
    percentualDistribuicao: float # Pode ser decimal? Geralmente int, mas float é mais seguro

class AnexosGd(BaseModel):
    documentoFrente: str
    # Adicione outros documentos se necessário (ex: documentoVerso, procuracao)

class AlteracaoGdRequest(BaseModel):
    # Dados da UC Geradora
    cpf: str # Para identificar a sessão no servidor
    codigoEmpresaWeb: int
    cdc: int
    digitoVerificador: int
    
    # Dados da Solicitação
    cpfCnpj: str # CPF/CNPJ do Titular
    aceiteTermosAltaDistribuicao: bool
    tipoCompartilhamento: str = "AR" # Valor padrão
    percentualCompensacao: Optional[int] = 100 # Usado na URL (geralmente 100 para GD)
    
    # Listas e Objetos
    beneficiarias: List[BeneficiariaItem]
    anexos: Dict[str, str] # Ex: {"documentoFrente": "hash_do_arquivo"}

class GerenteContextoRequest(BaseModel):
    cpf: str # Dono da sessão
    numeroCpfCnpjCliente: Optional[str] = None # Se não enviar, usa o cpf da sessão
    codigoEmpresaWeb: int = 6
    cdc: int
    digitoVerificador: int
    descricaoComplementarImovel: Optional[str] = ""
    dataUltimoAcesso: Optional[str] = "" # Ex: "Fri Nov 21 2025..."

# Adicione junto com os outros modelos (Classes BaseModel)

class AutorizacaoPendenteRequest(BaseModel):
    cpf: str # Necessário para carregar a sessão
    codigoEmpresaWeb: int = 6
    unidadeConsumidora: int # Corresponde ao parâmetro da URL (pode ser o CDC)
    codigo: int # O código da autorização (ex: 5002)

# --- FUNÇÕES AUXILIARES DE AUTH ---

def create_access_token(data: dict):
    """Gera o JWT com tempo de expiração"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Dependência que protege as rotas.
    Lê o Header 'Authorization: Bearer ...' e valida o token.
    """
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        client_id: str = payload.get("sub")
        if client_id is None:
            raise HTTPException(status_code=401, detail="Token inválido: sem ID")
        return client_id
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )

# --- MODELS DA ENERGISA ---
class LoginStartRequest(BaseModel):
    cpf: str
    final_telefone: str

class LoginFinishRequest(BaseModel):
    cpf: str
    transaction_id: str
    sms_code: str

class UcRequest(BaseModel):
    cpf: str
    codigoEmpresaWeb: Optional[int] = 6
    cdc: Optional[int] = None
    digitoVerificadorCdc: Optional[int] = None

class FaturaRequest(UcRequest):
    ano: int
    mes: int
    numeroFatura: int

# --- ROTA DE AUTENTICAÇÃO DA API (GERAR TOKEN) ---

@app.post("/api/token")
def generate_token(req: ClientLogin):
    """
    Troca client_id e client_secret por um TOKEN Bearer.
    """
    # Verifica se o cliente existe e a senha bate
    if req.client_id in CLIENTS_DB and CLIENTS_DB[req.client_id] == req.client_secret:
        # Gera o token
        token = create_access_token(data={"sub": req.client_id})
        return {
            "access_token": token,
            "token_type": "bearer",
            "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60
        }
    
    raise HTTPException(status_code=401, detail="Credenciais de cliente inválidas")

# --- ROTAS DA ENERGISA (AGORA PROTEGIDAS) ---
# Note o: dependencies=[Depends(verify_token)]

def _login_worker_thread(cpf: str, final_telefone: str, cmd_queue: queue.Queue, result_queue: queue.Queue):
    """
    Thread worker que executa start_login e aguarda comando para finish_login.
    Mantem o Playwright vivo na mesma thread entre start e finish.
    """
    from playwright.sync_api import sync_playwright
    from session_manager import SessionManager

    playwright_instance = None
    browser = None
    page = None

    try:
        # ========== START LOGIN (codigo original do service.py) ==========
        print(f"🚀 Login: CPF {cpf} | Tel Final: {final_telefone}")

        playwright_instance = sync_playwright().start()

        args = [
            "--no-sandbox",
            "--disable-infobars",
            "--start-maximized",
            "--disable-blink-features=AutomationControlled",
            "--disable-dev-shm-usage",
            "--disable-gpu"
        ]

        browser = playwright_instance.chromium.launch(
            headless=False,
            args=args,
            ignore_default_args=["--enable-automation"]
        )

        context = browser.new_context(
            viewport={'width': 1280, 'height': 1024},
            locale='pt-BR',
            timezone_id='America/Sao_Paulo',
            user_agent='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )

        init_script = """
        () => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            window.chrome = { runtime: {} };
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                Promise.resolve({ state: Notification.permission }) :
                originalQuery(parameters)
            );
        }
        """
        context.add_init_script(init_script)

        page = context.new_page()

        print("   🌐 Acessando página de login (Modo Visual/Xvfb)...")

        try:
            page.goto("https://www.google.com.br", timeout=10000)
        except:
            pass

        page.goto("https://servicos.energisa.com.br/login", wait_until="domcontentloaded", timeout=60000)

        time.sleep(5)

        title = page.title()
        print(f"   🔎 Título da página: {title}")

        if "Access Denied" in title or "Bloqueio" in title:
            try:
                page.screenshot(path="sessions/access_denied.png")
            except:
                pass
            raise Exception(f"Bloqueio WAF detectado (Access Denied). Título: {title}")

        try:
            page.wait_for_selector('input[name="cpf"]', state="visible", timeout=20000)
        except:
            if page.locator("iframe").count() > 0:
                raise Exception("Captcha detectado na tela.")
            try:
                page.screenshot(path="sessions/erro_login_no_input.png")
            except:
                pass
            raise Exception(f"Campo CPF não carregou. Título: {title}")

        print("   ✍️ Preenchendo CPF...")
        page.click('input[name="cpf"]')
        for char in cpf:
            page.keyboard.type(char, delay=150)

        time.sleep(1)
        page.click('button:has-text("ENTRAR"), button:has-text("Entrar")')

        print("   📞 Selecionando telefone...")
        page.wait_for_selector('text=/contato|telefone|sms/i', timeout=30000)
        time.sleep(2)

        found = False
        for sel in [f'label:has-text("{final_telefone}")', f'div:has-text("{final_telefone}")', f'text={final_telefone}']:
            if page.is_visible(sel):
                page.click(sel)
                found = True
                break

        if not found:
            if page.is_visible('label'):
                print("   ⚠️ Telefone exato não achado, clicando no primeiro disponível...")
                page.click('label')
            else:
                raise Exception("Opção de telefone não encontrada")

        time.sleep(1)
        page.click('button:has-text("AVANÇAR")')

        transaction_id = f"{cpf}_{int(time.time())}"

        # Retorna sucesso do start_login
        result_queue.put({
            "success": True,
            "result": {"transaction_id": transaction_id, "message": "SMS enviado (Modo Visual)"}
        })

        # ========== AGUARDA COMANDO FINISH ==========
        try:
            cmd = cmd_queue.get(timeout=300)  # Timeout 5 minutos
        except queue.Empty:
            raise Exception("Timeout aguardando código SMS")

        if cmd.get("action") != "finish":
            raise Exception("Comando inválido")

        sms_code = cmd.get("sms_code")

        # ========== FINISH LOGIN (codigo original do service.py) ==========
        try:
            if page.is_visible('input[type="tel"]'):
                page.click('input[type="tel"]')
            elif page.is_visible('input[type="number"]'):
                page.click('input[type="number"]')
            else:
                page.mouse.click(640, 512)
        except:
            pass

        for d in sms_code:
            page.keyboard.type(d, delay=150)
        time.sleep(1)

        if page.is_visible('button:has-text("AVANÇAR")'):
            page.click('button:has-text("AVANÇAR")')
        else:
            page.evaluate("() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.innerText.includes('AVANÇAR')); if(b) b.click() }")

        print("   ⏳ Aguardando tokens...")
        try:
            page.wait_for_url(lambda u: "listagem-ucs" in u or "home" in u, timeout=25000)
        except:
            pass

        # Extrai tokens
        final_cookies = {}
        for _ in range(10):
            cookies = page.context.cookies()
            for c in cookies:
                final_cookies[c['name']] = c['value']

            try:
                ls_data = page.evaluate("""() => {
                    return {
                        accessToken: localStorage.getItem('accessTokenEnergisa') || localStorage.getItem('token'),
                        udk: localStorage.getItem('udk'),
                        rtk: localStorage.getItem('rtk')
                    }
                }""")
                if ls_data.get('accessToken'):
                    final_cookies['accessTokenEnergisa'] = ls_data['accessToken']
                if ls_data.get('udk'):
                    final_cookies['udk'] = ls_data['udk']
                if ls_data.get('rtk'):
                    final_cookies['rtk'] = ls_data['rtk']
            except:
                pass

            if 'rtk' in final_cookies or 'accessTokenEnergisa' in final_cookies:
                break
            time.sleep(1)

        if 'rtk' not in final_cookies and 'accessTokenEnergisa' not in final_cookies:
            raise Exception("Falha ao capturar tokens")

        SessionManager.save_session(cpf, final_cookies)

        result_queue.put({
            "success": True,
            "result": {"status": "success", "message": "Login OK", "tokens": list(final_cookies.keys())}
        })

    except Exception as e:
        result_queue.put({"success": False, "error": str(e)})
    finally:
        if browser:
            try:
                browser.close()
            except:
                pass
        if playwright_instance:
            try:
                playwright_instance.stop()
            except:
                pass


@app.post("/auth/login/start", dependencies=[Depends(verify_token)])
def login_start(req: LoginStartRequest):
    """
    Inicia o login (envia SMS).
    Cria uma thread dedicada que fica viva ate o finish_login.
    """
    cmd_q = queue.Queue()
    result_q = queue.Queue()

    # Inicia thread worker
    thread = threading.Thread(
        target=_login_worker_thread,
        args=(req.cpf.replace(".", "").replace("-", ""), req.final_telefone, cmd_q, result_q),
        daemon=True
    )
    thread.start()

    # Aguarda resultado do start_login
    try:
        result = result_q.get(timeout=120)  # 2 minutos timeout
    except queue.Empty:
        raise HTTPException(500, "Timeout no login")

    if not result.get("success"):
        raise HTTPException(500, result.get("error", "Erro desconhecido"))

    # Guarda referencia da sessao
    transaction_id = result["result"]["transaction_id"]
    _login_sessions[transaction_id] = {
        "thread": thread,
        "cmd_queue": cmd_q,
        "result_queue": result_q
    }

    return result["result"]


@app.post("/auth/login/finish", dependencies=[Depends(verify_token)])
def login_finish(req: LoginFinishRequest):
    """
    Finaliza o login com codigo SMS.
    Envia comando para a thread que esta aguardando.
    """
    session = _login_sessions.pop(req.transaction_id, None)

    if not session:
        raise HTTPException(400, "Transação expirada ou não encontrada")

    # Envia comando finish para a thread
    session["cmd_queue"].put({
        "action": "finish",
        "sms_code": req.sms_code
    })

    # Aguarda resultado do finish_login
    try:
        result = session["result_queue"].get(timeout=60)
    except queue.Empty:
        raise HTTPException(500, "Timeout finalizando login")

    if not result.get("success"):
        raise HTTPException(400, result.get("error", "Erro desconhecido"))

    return result["result"]

@app.post("/ucs", dependencies=[Depends(verify_token)])
def list_ucs(req: UcRequest):
    svc = EnergisaService(req.cpf)
    if not svc.is_authenticated():
        raise HTTPException(401, "Não autenticado na Energisa")
    try:
        return svc.listar_ucs()
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/faturas/listar", dependencies=[Depends(verify_token)])
def list_bills(req: UcRequest):
    if not req.cdc: raise HTTPException(400, "CDC obrigatório")
    try:
        return EnergisaService(req.cpf).listar_faturas(req.model_dump())
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/faturas/pdf", dependencies=[Depends(verify_token)])
def download_pdf(req: FaturaRequest):
    try:
        # Pega os bytes do PDF
        content = EnergisaService(req.cpf).download_pdf(req.model_dump(), req.model_dump())
        
        # Converte para Base64
        b64_string = base64.b64encode(content).decode('utf-8')
        
        return {
            "filename": f"fatura_{req.cdc}_{req.mes}-{req.ano}.pdf",
            "content_type": "application/pdf",
            "file_base64": b64_string
        }
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/gd/info", dependencies=[Depends(verify_token)])
def get_gd(req: UcRequest):
    try:
        return EnergisaService(req.cpf).get_gd_info(req.model_dump())
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/gd/details", dependencies=[Depends(verify_token)])
def get_gd_details(req: UcRequest):
    try:
        data = EnergisaService(req.cpf).get_gd_details(req.model_dump())
        if not data: return {"infos": [], "errored": True}
        return data
    except Exception as e:
        raise HTTPException(500, str(e))
    
@app.post("/anexos/enviar", dependencies=[Depends(verify_token)])
async def enviar_anexo(
    cpf: str = Form(...),
    categoria: str = Form("documentoFrente"),
    fluxo: str = Form("jornadaBeneficiaria"),
    reducaoImagem: str = Form("false"),
    anexo: UploadFile = File(...)
):
    """
    Envia um arquivo para a API da Energisa (ex: CNH, Identidade).
    Recebe o arquivo e campos via multipart/form-data.
    """
    try:
        # Lê o conteúdo do arquivo em memória
        conteudo_arquivo = await anexo.read()
        
        svc = EnergisaService(cpf)
        
        # Verifica se tem sessão
        if not svc.is_authenticated():
             raise HTTPException(401, "Não autenticado na Energisa. Faça login primeiro.")

        result = svc.enviar_anexo(
            arquivo_bytes=conteudo_arquivo,
            nome_arquivo=anexo.filename,
            content_type=anexo.content_type,
            categoria=categoria,
            fluxo=fluxo,
            reducao=reducaoImagem
        )
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.post("/gd/alterar-beneficiaria", dependencies=[Depends(verify_token)])
def alterar_beneficiaria_gd(req: AlteracaoGdRequest):
    """
    Realiza a alteração das UCs beneficiárias do rateio de créditos.
    Exige que o anexo já tenha sido enviado (rota /anexos/enviar) para obter o hash.
    """
    try:
        svc = EnergisaService(req.cpf)
        
        if not svc.is_authenticated():
             raise HTTPException(401, "Não autenticado na Energisa. Faça login primeiro.")

        # Converte o modelo para dicionário
        dados = req.model_dump()
        
        # Remove o CPF do payload, pois ele é usado apenas para instanciar o serviço
        del dados['cpf']
        
        # Chama o serviço
        result = svc.alterar_beneficiaria(dados)
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/imoveis/gerente/contexto", dependencies=[Depends(verify_token)])
def contexto_adicionar_gerente(req: GerenteContextoRequest):
    """
    Chama a rota GET /gerenciar-imoveis/adicionar-gerente.
    Útil para 'aquecer' a sessão e obter cookies de segurança antes de gerenciar imóveis.
    """
    try:
        print(f"\n{'='*60}")
        print(f"[GATEWAY] Endpoint: /imoveis/gerente/contexto")
        print(f"{'='*60}")
        print(f"Request recebido: {req.model_dump()}")
        print(f"{'='*60}\n")

        svc = EnergisaService(req.cpf)
        if not svc.is_authenticated():
             raise HTTPException(401, "Não autenticado na Energisa. Faça login primeiro.")

        dados = req.model_dump()
        del dados['cpf'] # Remove para não ir nos params

        print(f"Dados que serao enviados para service: {dados}\n")

        result = svc.adicionar_gerente_get(dados)

        print(f"Resultado recebido do service: {result}\n")

        return result

    except Exception as e:
        print(f"ERRO no endpoint: {str(e)}\n")
        raise HTTPException(status_code=500, detail=str(e))

# Adicione no final do arquivo main.py, antes do if __name__ == "__main__":

@app.post("/imoveis/autorizacao-pendente", dependencies=[Depends(verify_token)])
def autorizacao_pendente(req: AutorizacaoPendenteRequest):
    """
    Rota para processar autorizações pendentes de gerenciamento de imóveis.
    Realiza um GET autenticado em /gerenciar-imoveis/autorizacao-pendente.
    """
    try:
        print(f"\n{'='*60}")
        print(f"[GATEWAY] Endpoint: /imoveis/autorizacao-pendente")
        print(f"{'='*60}")
        print(f"Request recebido: {req.model_dump()}")
        print(f"{'='*60}\n")

        svc = EnergisaService(req.cpf)
        if not svc.is_authenticated():
             raise HTTPException(401, "Não autenticado na Energisa. Faça login primeiro.")

        # Prepara os dados
        dados = req.model_dump()
        del dados['cpf'] # Remove CPF para não enviar na query string

        print(f"Dados que serao enviados para service: {dados}\n")

        result = svc.autorizacao_pendente_get(dados)

        print(f"Resultado recebido do service: {result}\n")

        return result

    except Exception as e:
        print(f"ERRO no endpoint: {str(e)}\n")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    # MUDANÇA AQUI: De 8000 para 3000
    uvicorn.run(app, host="0.0.0.0", port=3000)