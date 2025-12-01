from fastapi import FastAPI, HTTPException, Response, Depends, status, UploadFile, File, Form, Request
from fastapi.middleware.cors import CORSMiddleware
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
from security_middleware import SecurityMiddleware, security_manager
import json
import httpx
import constants
import calculadora
import aneel_api

# Gerenciador de sessoes de login em threads separadas
# Cada login fica em sua propria thread ate o finish_login
_login_sessions = {}  # transaction_id -> {"thread": thread, "cmd_queue": queue, "result_queue": queue}

app = FastAPI(title="Energisa API Segura", version="2.1.0")

# Carrega variáveis de ambiente primeiro
load_dotenv()

# Configuração de CORS - Usa variável de ambiente para produção
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,  # Agora controlado por variável de ambiente
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-CSRF-Token"],
)

# Adiciona middleware de segurança
app.add_middleware(SecurityMiddleware)

# --- CONFIGURAÇÃO DE SEGURANÇA ---

# Chave secreta para assinar o token (Em produção, use variável de ambiente!)
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

class LoginStartRequest(BaseModel):
    cpf: str

class LoginSelectRequest(BaseModel):
    transaction_id: str
    opcao_selecionada: str # O número do celular (ex: "66*****7647")

class LoginFinishRequest(BaseModel):
    transaction_id: str
    sms_code: str

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


# [gateway/main.py]
def _login_worker_thread(cpf: str, cmd_queue: queue.Queue, result_queue: queue.Queue):
    """
    Worker Completo: Akamai Bypass -> Extração Híbrida -> Login -> Captura de Tokens (Cookies + LocalStorage)
    """
    from playwright.sync_api import sync_playwright
    from session_manager import SessionManager
    import random
    import json
    import time

    playwright_instance = None
    browser = None
    page = None

    try:
        print(f"🚀 [Worker] Iniciando navegador para CPF {cpf}...")

        playwright_instance = sync_playwright().start()
        
        args = [
            "--no-sandbox", "--disable-infobars", "--start-maximized",
            "--disable-blink-features=AutomationControlled", "--disable-dev-shm-usage", "--disable-gpu"
        ]

        browser = playwright_instance.chromium.launch(
            headless=False,
            args=args,
            ignore_default_args=["--enable-automation"]
        )
        
        context = browser.new_context(viewport={'width': 1280, 'height': 1024}, locale='pt-BR')
        
        context.add_init_script("""
        () => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            window.chrome = { runtime: {} };
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        }
        """)
        
        page = context.new_page()

        print("   🌐 Acessando página de login...")
        page.goto("https://servicos.energisa.com.br/login", wait_until="domcontentloaded", timeout=60000)

        # --- VALIDAÇÃO AKAMAI ---
        print("   🛡️ Aguardando validação de segurança (troca de _abck)...")
        start_time = time.time()
        validated = False
        
        while time.time() - start_time < 20:
            cookies = context.cookies()
            abck = next((c['value'] for c in cookies if c['name'] == '_abck'), None)
            
            if abck and "~0~" in abck:
                print(f"   ✅ Cookie de segurança validado! (_abck contém ~0~)")
                validated = True
                break
            
            x, y = random.randint(100, 800), random.randint(100, 600)
            page.mouse.move(x, y, steps=10)
            if random.random() > 0.8: page.mouse.click(x, y)
            time.sleep(1.0)

        # --- PREENCHIMENTO ---
        if page.is_visible('input[name="cpf"]'):
            page.click('input[name="cpf"]')
            for char in cpf:
                page.keyboard.type(char, delay=random.randint(50, 150))
        else:
            raise Exception("Campo CPF não encontrado.")

        # --- INTERCEPTAÇÃO ---
        print("   👀 [Worker] Aguardando JSON de telefones...")
        
        with page.expect_response(lambda response: "selecionar-numero.json" in response.url and response.status == 200, timeout=30000) as response_info:
            time.sleep(1)
            page.click('button:has-text("ENTRAR"), button:has-text("Entrar")')
        
        response = response_info.value
        json_data = response.json()
        
        # --- EXTRAÇÃO DINÂMICA ---
        telefones = []
        try:
            data_obj = json_data.get("pageProps", {}).get("data", {})
            telefones = data_obj.get("listaTelefone", [])
            
            if not telefones:
                dados_user = data_obj.get("dadosUsuario", {})
                celular_unico = dados_user.get("celular")
                if celular_unico:
                    telefones.append({"celular": celular_unico, "cdc": 0, "posicao": 1})

        except Exception as e:
            print(f"   ❌ Erro extração telefones: {e}")

        transaction_id = f"{cpf}_{int(time.time())}"

        result_queue.put({
            "success": True,
            "phase": "selection_pending",
            "transaction_id": transaction_id,
            "listaTelefone": telefones,
            "full_data": json_data
        })

        # --- FASE 2: SELEÇÃO ---
        print("   ⏸️ [Worker] Aguardando escolha do telefone...")
        cmd = cmd_queue.get(timeout=300)
        if cmd.get("action") != "select_phone": raise Exception("Comando inválido")

        telefone_raw = cmd.get("telefone")
        tel_clean = telefone_raw.strip()[-4:] 
        
        print(f"   📞 [Worker] Buscando opção... {tel_clean}")

        page.wait_for_selector('text=/contato|telefone|sms/i', timeout=30000)
        
        clicked = False
        try:
            elements = page.get_by_text(tel_clean).all()
            for el in elements:
                if el.is_visible():
                    el.click()
                    clicked = True
                    break
        except: pass
        
        if not clicked:
            if page.is_visible('label'): page.click('label')
            elif page.is_visible('input[type="radio"]'): page.click('input[type="radio"]')

        time.sleep(1)
        if page.is_visible('button:has-text("AVANÇAR")'): page.click('button:has-text("AVANÇAR")')
        else: page.evaluate("() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.innerText.includes('AVANÇAR')); if(b) b.click() }")
        
        result_queue.put({"success": True, "phase": "sms_sent", "message": "SMS Enviado"})

        # --- FASE 3: FINISH SMS ---
        cmd = cmd_queue.get(timeout=300)
        if cmd.get("action") != "finish_sms": raise Exception("Comando inválido")
        
        sms = cmd.get("sms_code")
        print(f"   ⌨️ [Worker] Digitando SMS: {sms}")
        
        if page.is_visible('input'): page.click('input')
        page.keyboard.type(sms, delay=100)
        time.sleep(0.5)
        page.click('button:has-text("AVANÇAR")')

        print("   ⏳ Aguardando autenticação...")
        try: page.wait_for_url(lambda u: "listagem-ucs" in u or "home" in u, timeout=25000)
        except: pass
        
        # === MUDANÇA IMPORTANTE: CAPTURA COMPLETA DE TOKENS ===
        final_cookies = {c['name']: c['value'] for c in page.context.cookies()}
        
        print("   📥 Extraindo tokens do LocalStorage e Cookies...")
        try:
            # Script para pegar tokens que o React/Next.js guarda no navegador
            ls_data = page.evaluate("""() => {
                return {
                    accessTokenEnergisa: localStorage.getItem('accessTokenEnergisa') || localStorage.getItem('token'),
                    udk: localStorage.getItem('udk'),
                    rtk: localStorage.getItem('rtk'),
                    refreshToken: localStorage.getItem('refreshToken')
                }
            }""")
            
            # Adiciona os tokens do LocalStorage ao dicionário de cookies
            # Isso permite que o 'requests' no EnergisaService use eles como se fossem cookies
            if ls_data:
                for k, v in ls_data.items():
                    if v: 
                        final_cookies[k] = v
                        print(f"      + Token encontrado: {k}")
                        
        except Exception as e:
            print(f"   ⚠️ Erro ao ler LocalStorage: {e}")

        # Salva a sessão atualizada com TUDO
        SessionManager.save_session(cpf, final_cookies)
        print("   💾 Sessão salva com sucesso!")
        
        result_queue.put({"success": True, "tokens": list(final_cookies.keys()), "message": "Login OK"})

    except Exception as e:
        print(f"❌ [Worker Error] {e}")
        result_queue.put({"success": False, "error": str(e)})
    finally:
        if browser: browser.close()
        if playwright_instance: playwright_instance.stop()





@app.post("/auth/login/start")
def login_start(req: LoginStartRequest):
    """
    Inicia o navegador e retorna a lista de telefones interceptada.
    """
    cmd_q = queue.Queue()
    result_q = queue.Queue()
    
    cpf_clean = req.cpf.replace(".", "").replace("-", "")

    # Inicia a thread
    thread = threading.Thread(
        target=_login_worker_thread,
        args=(cpf_clean, cmd_q, result_q),
        daemon=True
    )
    thread.start()

    # Aguarda o JSON (Fase 1)
    try:
        result = result_q.get(timeout=60)
    except queue.Empty:
        raise HTTPException(500, "Timeout ao carregar opções de login")

    if not result.get("success"):
        raise HTTPException(500, result.get("error", "Erro desconhecido"))

    transaction_id = result["transaction_id"]

    # Salva sessão
    _login_sessions[transaction_id] = {
        "thread": thread,
        "cmd_queue": cmd_q,
        "result_queue": result_q
    }

    # Retorna EXATAMENTE o que você pediu
    return {
        "transaction_id": transaction_id,
        "listaTelefone": result.get("listaTelefone", [])
    }

@app.post("/auth/login/select-option")
def login_select_option(req: LoginSelectRequest):
    """
    Recebe o transaction_id e o telefone escolhido.
    Avisa a thread para clicar e enviar o SMS.
    """
    session = _login_sessions.get(req.transaction_id)
    if not session:
        raise HTTPException(400, "Sessão não encontrada")

    # Envia comando para a thread (Fase 2)
    session["cmd_queue"].put({
        "action": "select_phone",
        "telefone": req.opcao_selecionada
    })

    # Aguarda confirmação de envio do SMS
    try:
        result = session["result_queue"].get(timeout=60)
    except queue.Empty:
        raise HTTPException(500, "Timeout ao enviar SMS")

    if not result.get("success"):
        raise HTTPException(500, result.get("error"))

    return {"message": "SMS enviado com sucesso"}


@app.post("/auth/login/finish")
def login_finish(req: LoginFinishRequest):
    """
    Recebe o código SMS e finaliza.
    """
    session = _login_sessions.pop(req.transaction_id, None) # Remove da memória ao finalizar
    if not session:
        raise HTTPException(400, "Sessão expirada")

    # Envia comando para a thread (Fase 3)
    session["cmd_queue"].put({
        "action": "finish_sms",
        "sms_code": req.sms_code
    })

    try:
        result = session["result_queue"].get(timeout=60)
    except queue.Empty:
        raise HTTPException(500, "Timeout na validação do SMS")

    if not result.get("success"):
        raise HTTPException(400, result.get("error"))

    return result

@app.post("/ucs", dependencies=[Depends(verify_token)])
def list_ucs(req: UcRequest):
    svc = EnergisaService(req.cpf)
    if not svc.is_authenticated():
        raise HTTPException(401, "Não autenticado na Energisa")
    try:
        return svc.listar_ucs()
    except Exception as e:
        raise HTTPException(500, str(e))

# [gateway/main.py]

@app.post("/ucs/info", dependencies=[Depends(verify_token)])
def uc_info_detalhada(req: UcRequest):
    """
    Endpoint para buscar detalhes cadastrais da UC.
    Payload Entrada: { "cpf": "...", "cdc": 123, "digitoVerificadorCdc": 1, "codigoEmpresaWeb": 6 }
    """
    try:
        svc = EnergisaService(req.cpf)
        
        if not svc.is_authenticated():
             raise HTTPException(401, "Sessão inválida ou expirada. Faça login novamente.")
             
        # O service converte 'cdc' -> 'uc' internamente
        result = svc.get_uc_info(req.model_dump())
        
        if result.get("errored"):
            raise HTTPException(400, detail=result.get("message", "Erro ao consultar dados da UC"))
            
        return result

    except HTTPException:
        raise
    except Exception as e:
        print(f"ERRO CRÍTICO /ucs/info: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

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

# --- ROTAS PÚBLICAS PARA SIMULAÇÃO (LANDING PAGE) ---
# Estas rotas não requerem token de autenticação da API

class PublicSimulationStart(BaseModel):
    cpf: str

class PublicSimulationSelectPhone(BaseModel):
    transactionId: str
    telefone: str  # Número do telefone selecionado (ex: "66*****7647")

class PublicSimulationSms(BaseModel):
    sessionId: str
    codigo: str

@app.post("/public/simulacao/iniciar")
def public_simulation_start(req: PublicSimulationStart, request: Request):
    """
    Endpoint público para iniciar simulação na landing page.
    Agora retorna lista de telefones para o usuário escolher.
    PROTEGIDO: Rate limiting, validação de IP, session segura
    """
    try:
        # Obtém IP real do cliente
        ip = request.headers.get("X-Forwarded-For", request.client.host if request.client else "unknown")
        if "," in ip:
            ip = ip.split(",")[0].strip()

        # Remove formatação do CPF
        cpf_clean = req.cpf.replace(".", "").replace("-", "")

        # Cria filas de comunicação
        cmd_queue = queue.Queue()
        result_queue = queue.Queue()

        # Inicia thread do worker (novo fluxo - sem telefone)
        worker_thread = threading.Thread(
            target=_login_worker_thread,
            args=(cpf_clean, cmd_queue, result_queue),
            daemon=True
        )
        worker_thread.start()

        # Aguarda resultado do start_login (FASE 1 - lista de telefones)
        try:
            result = result_queue.get(timeout=60)  # 1 minuto
        except queue.Empty:
            raise HTTPException(
                status_code=500,
                detail="Timeout aguardando lista de telefones"
            )

        if not result.get("success"):
            # Registra falha de autenticação
            security_manager.register_auth_failure(ip)
            raise HTTPException(status_code=500, detail=result.get("error", "Erro desconhecido"))

        transaction_id = result["transaction_id"]

        # Cria session segura vinculada ao IP
        secure_session_id = security_manager.create_session(ip, cpf_clean, expires_minutes=30)

        # Armazena a sessão com session seguro
        _login_sessions[secure_session_id] = {
            "thread": worker_thread,
            "cmd_queue": cmd_queue,
            "result_queue": result_queue,
            "cpf": cpf_clean,
            "ip": ip,  # Armazena IP para validação posterior
            "transaction_id": transaction_id,  # ID original da Energisa
            "created_at": time.time()
        }

        # Retorna lista de telefones para o frontend
        return {
            "transaction_id": secure_session_id,  # Retorna session seguro, não o transaction_id original
            "listaTelefone": result.get("listaTelefone", [])
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"ERRO no endpoint público iniciar: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/public/simulacao/enviar-sms")
def public_simulation_send_sms(req: PublicSimulationSelectPhone, request: Request):
    """
    Endpoint público para enviar SMS ao telefone selecionado.
    Fase 2 do processo de autenticação.
    PROTEGIDO: Validação de sessão e IP
    """
    try:
        # Obtém IP real do cliente
        ip = request.headers.get("X-Forwarded-For", request.client.host if request.client else "unknown")
        if "," in ip:
            ip = ip.split(",")[0].strip()

        # Valida session segura vinculada ao IP
        if not security_manager.validate_session(req.transactionId, ip):
            raise HTTPException(401, "Sessão inválida, expirada ou não pertence a este dispositivo")

        session = _login_sessions.get(req.transactionId)
        if not session:
            raise HTTPException(400, "Sessão não encontrada ou expirada")

        # Verifica se o IP da sessão bate com o IP atual (proteção contra session hijacking)
        if session.get("ip") != ip:
            security_manager.invalidate_session(req.transactionId)
            security_manager.block_ip(ip, "Tentativa de session hijacking no envio de SMS")
            raise HTTPException(403, "Acesso negado - dispositivo não autorizado")

        # Envia comando para a thread (FASE 2) com o número do telefone
        session["cmd_queue"].put({
            "action": "select_phone",
            "telefone": req.telefone  # Passa o telefone diretamente (ex: "66*****7647")
        })

        # Aguarda confirmação de envio do SMS
        try:
            result = session["result_queue"].get(timeout=60)
        except queue.Empty:
            raise HTTPException(500, "Timeout ao enviar SMS")

        if not result.get("success"):
            raise HTTPException(500, result.get("error", "Erro ao enviar SMS"))

        return {"success": True, "message": "SMS enviado com sucesso"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"ERRO ao enviar SMS: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/public/simulacao/validar-sms")
def public_simulation_validate_sms(req: PublicSimulationSms, request: Request):
    """
    Endpoint público para validar código SMS da simulação.
    PROTEGIDO: Validação de sessão e IP
    """
    try:
        # Obtém IP real do cliente
        ip = request.headers.get("X-Forwarded-For", request.client.host if request.client else "unknown")
        if "," in ip:
            ip = ip.split(",")[0].strip()

        session_id = req.sessionId

        # Valida session segura vinculada ao IP
        if not security_manager.validate_session(session_id, ip):
            raise HTTPException(401, "Sessão inválida, expirada ou não pertence a este dispositivo")

        if session_id not in _login_sessions:
            raise HTTPException(status_code=404, detail="Sessão não encontrada ou expirada")

        session_data = _login_sessions[session_id]

        # Verifica se o IP da sessão bate com o IP atual
        if session_data.get("ip") != ip:
            security_manager.invalidate_session(session_id)
            security_manager.block_ip(ip, "Tentativa de session hijacking na validação SMS")
            raise HTTPException(403, "Acesso negado - dispositivo não autorizado")

        cmd_queue = session_data["cmd_queue"]
        result_queue = session_data["result_queue"]

        # Envia comando para finalizar login (FASE 3 - validação SMS)
        cmd_queue.put({"action": "finish_sms", "sms_code": req.codigo})

        # Aguarda resultado
        try:
            result = result_queue.get(timeout=120)
        except queue.Empty:
            raise HTTPException(status_code=500, detail="Timeout aguardando finish_login")

        if not result.get("success"):
            # Registra falha de autenticação
            security_manager.register_auth_failure(ip)
            raise HTTPException(status_code=400, detail=result.get("error", "Erro na validação do SMS"))

        # Armazena dados adicionais na sessão
        _login_sessions[session_id]["authenticated"] = True

        return {
            "success": True,
            "message": result.get("message", "Autenticação realizada com sucesso"),
            "session_id": session_id
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"ERRO no endpoint validar SMS: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/public/simulacao/ucs/{session_id}")
def public_simulation_get_ucs(session_id: str, request: Request):
    """
    Endpoint público para buscar UCs após autenticação.
    PROTEGIDO: Validação de sessão e IP
    """
    try:
        # Obtém IP real do cliente
        ip = request.headers.get("X-Forwarded-For", request.client.host if request.client else "unknown")
        if "," in ip:
            ip = ip.split(",")[0].strip()

        # Valida session segura vinculada ao IP
        if not security_manager.validate_session(session_id, ip):
            raise HTTPException(401, "Sessão inválida, expirada ou não pertence a este dispositivo")

        if session_id not in _login_sessions:
            raise HTTPException(status_code=404, detail="Sessão não encontrada")

        session_data = _login_sessions[session_id]

        # Verifica se o IP da sessão bate com o IP atual
        if session_data.get("ip") != ip:
            security_manager.invalidate_session(session_id)
            security_manager.block_ip(ip, "Tentativa de session hijacking ao buscar UCs")
            raise HTTPException(403, "Acesso negado - dispositivo não autorizado")

        if not session_data.get("authenticated"):
            raise HTTPException(status_code=401, detail="Sessão não autenticada")

        cpf = session_data["cpf"]

        # Cria uma instância do EnergisaService (que carrega a sessão automaticamente)
        svc = EnergisaService(cpf)

        if not svc.is_authenticated():
            raise HTTPException(status_code=401, detail="Sessão expirada")

        # Busca as UCs
        ucs_data = svc.listar_ucs()

        return {
            "success": True,
            "ucs": ucs_data
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"ERRO ao buscar UCs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/public/simulacao/faturas/{session_id}/{codigo_uc}")
def public_simulation_get_faturas(session_id: str, codigo_uc: int, request: Request):
    """
    Endpoint público para buscar faturas de uma UC específica.
    Retorna faturas dos últimos 12 meses + cálculo detalhado de economia.
    PROTEGIDO: Validação de sessão e IP
    """
    try:
        # Obtém IP real do cliente
        ip = request.headers.get("X-Forwarded-For", request.client.host if request.client else "unknown")
        if "," in ip:
            ip = ip.split(",")[0].strip()

        # Valida session segura vinculada ao IP
        if not security_manager.validate_session(session_id, ip):
            raise HTTPException(401, "Sessão inválida, expirada ou não pertence a este dispositivo")

        if session_id not in _login_sessions:
            raise HTTPException(status_code=404, detail="Sessão não encontrada")

        session_data = _login_sessions[session_id]

        # Verifica se o IP da sessão bate com o IP atual
        if session_data.get("ip") != ip:
            security_manager.invalidate_session(session_id)
            security_manager.block_ip(ip, "Tentativa de session hijacking ao buscar faturas")
            raise HTTPException(403, "Acesso negado - dispositivo não autorizado")

        if not session_data.get("authenticated"):
            raise HTTPException(status_code=401, detail="Sessão não autenticada")

        cpf = session_data["cpf"]

        # Cria uma instância do EnergisaService (que carrega a sessão automaticamente)
        svc = EnergisaService(cpf)

        if not svc.is_authenticated():
            raise HTTPException(status_code=401, detail="Sessão expirada")

        # Busca todas as UCs para encontrar a UC específica
        ucs_data = svc.listar_ucs()

        # Encontra a UC pelo código (numeroUc)
        uc_encontrada = None
        for uc in ucs_data:
            if uc.get('numeroUc') == codigo_uc:
                uc_encontrada = uc
                break

        if not uc_encontrada:
            raise HTTPException(status_code=404, detail="UC não encontrada")

        # Mapeia os campos da UC para o formato esperado pelo service
        # A UC retornada por listar_ucs usa 'numeroUc' e 'digitoVerificador'
        # Mas listar_faturas espera 'cdc' e 'digitoVerificadorCdc'
        uc_mapeada = {
            'cdc': uc_encontrada.get('numeroUc'),
            'digitoVerificadorCdc': uc_encontrada.get('digitoVerificador'),
            'codigoEmpresaWeb': uc_encontrada.get('codigoEmpresaWeb', 6)
        }

        # Busca as faturas da UC
        faturas_data = svc.listar_faturas(uc_mapeada)

        # Limita aos últimos 12 meses
        faturas_12_meses = faturas_data[-13:] if len(faturas_data) > 13 else faturas_data

        # ====== NOVO: BUSCAR INFORMAÇÕES DETALHADAS DA UC ======
        uc_info_detalhada = None
        tipo_ligacao = "BIFASICO"  # Fallback padrão
        grupo_leitura = "B"

        try:
            uc_info_response = svc.get_uc_info(uc_mapeada)

            if uc_info_response and not uc_info_response.get("errored"):
                uc_info_detalhada = uc_info_response

                # Extrai tipo de ligação dos dados detalhados
                infos = uc_info_response.get("infos", {})
                dados_instalacao = infos.get("dadosInstalacao", {})

                tipo_ligacao = dados_instalacao.get("tipoLigacao", "BIFASICO")
                grupo_leitura = dados_instalacao.get("grupoLeitura", "B")

                print(f"   [OK] UC Info detalhada obtida: Tipo={tipo_ligacao}, Grupo={grupo_leitura}")
            else:
                print(f"   [AVISO] UC Info retornou erro, usando fallback")
        except Exception as e:
            print(f"   [AVISO] Erro ao buscar UC info detalhada: {e}. Usando fallback.")

        # ====== PROCESSA FATURAS E CALCULA ECONOMIA ======
        # Usa a FATURA MAIS RECENTE para o cálculo (não média)
        faturas_processadas = calculadora.processar_faturas(faturas_12_meses)

        consumo_kwh = faturas_processadas["consumo_kwh"]
        iluminacao_publica = faturas_processadas["iluminacao_publica"]
        tem_bandeira = faturas_processadas["tem_bandeira_vermelha"]

        print(f"   [INFO] Fatura mais recente: Consumo={consumo_kwh} kWh, Ilum={iluminacao_publica}, Bandeira={tem_bandeira}")

        # ====== BUSCA TARIFAS DA ANEEL EM TEMPO REAL ======
        print(f"   [INFO] Buscando tarifas da ANEEL...")
        tarifas_aneel = aneel_api.get_tarifas_com_fallback("EMT")

        tarifa_b1_sem_impostos = tarifas_aneel["tarifa_b1_sem_impostos"]
        fiob_base = tarifas_aneel["fiob_sem_impostos"]

        # Aplica impostos sobre a tarifa B1
        tarifa_b1_com_impostos = constants.aplicar_impostos(tarifa_b1_sem_impostos)

        # Calcula economia detalhada
        calculo_economia = None
        projecao_10_anos = None

        # Só calcula se tiver consumo válido
        if consumo_kwh > 0:
            # Verifica se é Grupo B (suportado)
            if grupo_leitura == "B":
                calculo_economia = calculadora.calcular_economia_mensal(
                    consumo_kwh=consumo_kwh,
                    tipo_ligacao=tipo_ligacao,
                    iluminacao_publica=iluminacao_publica,
                    tem_bandeira_vermelha=tem_bandeira,
                    tarifa_b1_kwh_com_impostos=tarifa_b1_com_impostos,
                    fiob_base_kwh=fiob_base
                )

                # Projeção 10 anos (APENAS CONSUMO, sem iluminação/piso)
                projecao_10_anos = calculadora.calcular_projecao_10_anos(
                    conta_atual_mensal=calculo_economia["custo_energisa_consumo"],
                    conta_midwest_mensal=calculo_economia["valor_midwest_consumo"]
                )
            else:
                print(f"   [AVISO] Grupo de leitura '{grupo_leitura}' não suportado. Apenas Grupo B é aceito.")

        # ====== RETORNA DADOS ENRIQUECIDOS ======
        return {
            "success": True,
            "faturas": faturas_12_meses,

            # Informações da UC
            "uc_info": {
                "tipo_ligacao": tipo_ligacao,
                "grupo_leitura": grupo_leitura,
                "dados_completos": uc_info_detalhada
            },

            # Dados processados das faturas
            "faturas_resumo": faturas_processadas,

            # Cálculo de economia detalhado
            "calculo_economia": calculo_economia,

            # Projeção 10 anos
            "projecao_10_anos": projecao_10_anos,

            # Fallback para compatibilidade
            "total_pago_12_meses": faturas_processadas["total_pago_12_meses"]
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"ERRO ao buscar faturas: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# ENDPOINTS DE LEADS (SUPER ADMIN)
# ============================================

class LeadSalvarRequest(BaseModel):
    """Schema para salvar lead da simulacao"""
    cpf: str
    nome: Optional[str] = None
    telefone: Optional[str] = None
    email: Optional[str] = None
    total_ucs: int = 0
    total_consumo_kwh: int = 0
    valor_total_faturas: float = 0.0
    dados_simulacao: Optional[Dict[str, Any]] = None  # Objeto JSON com detalhes


@app.post("/public/simulacao/salvar-lead")
async def public_simulation_save_lead(req: LeadSalvarRequest, request: Request):
    """
    Endpoint para salvar lead quando usuario conclui a simulacao.
    Este lead fica disponivel para o SUPER ADMIN fazer a conversao.

    IMPORTANTE: Este endpoint encaminha a requisição para o serviço gestor,
    que possui acesso ao banco de dados de leads.
    """
    try:
        # Obtém IP e User-Agent para tracking
        ip = request.headers.get("X-Forwarded-For", request.client.host if request.client else "unknown")
        if "," in ip:
            ip = ip.split(",")[0].strip()

        user_agent = request.headers.get("User-Agent", "")

        # Prepara payload para enviar ao gestor
        payload = {
            "cpf": req.cpf,
            "nome": req.nome,
            "telefone": req.telefone,
            "email": req.email,
            "total_ucs": req.total_ucs,
            "total_consumo_kwh": req.total_consumo_kwh,
            "valor_total_faturas": req.valor_total_faturas,
            "dados_simulacao_json": json.dumps(req.dados_simulacao) if req.dados_simulacao else None,
            "ip_origem": ip,
            "user_agent": user_agent
        }

        # Chama o serviço gestor para salvar o lead
        # URL do gestor no docker: http://gestor:8000
        gestor_url = os.getenv("GESTOR_URL", "http://gestor:8000")

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{gestor_url}/public/leads/salvar",
                json=payload
            )

            if response.status_code == 200:
                return response.json()
            else:
                print(f"Erro ao salvar lead no gestor: {response.status_code} - {response.text}")
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Erro ao processar lead: {response.text}"
                )

    except httpx.RequestError as e:
        print(f"Erro de conexão com o serviço gestor: {str(e)}")
        raise HTTPException(
            status_code=503,
            detail="Sistema de leads temporariamente indisponível. Tente novamente mais tarde."
        )
    except Exception as e:
        print(f"ERRO ao salvar lead: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao salvar lead: {str(e)}")


# [gateway/main.py]



if __name__ == "__main__":
    import uvicorn
    # MUDANÇA AQUI: De 8000 para 3000
    uvicorn.run(app, host="0.0.0.0", port=3000)