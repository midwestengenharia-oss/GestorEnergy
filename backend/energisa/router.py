"""
Energisa Router - Rotas de integração com Energisa
Extraído do gateway original main.py
"""

from fastapi import APIRouter, HTTPException, Response, Depends, status, UploadFile, File, Form, Request
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import base64
import threading
import queue
import time

from backend.core.security import get_current_active_user, CurrentUser, optional_auth
from backend.energisa.service import EnergisaService
from backend.energisa import constants, calculadora, aneel_api

router = APIRouter()

# Gerenciador de sessões de login em threads separadas
_login_sessions = {}


# ========================
# Pydantic Models
# ========================

class LoginStartRequest(BaseModel):
    cpf: str


class LoginSelectRequest(BaseModel):
    transaction_id: str
    opcao_selecionada: str


class LoginFinishRequest(BaseModel):
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


class BeneficiariaItem(BaseModel):
    codigoEmpresaWeb: int
    cdc: int
    digitoVerificador: int
    percentualDistribuicao: float


class AlteracaoGdRequest(BaseModel):
    cpf: str
    codigoEmpresaWeb: int
    cdc: int
    digitoVerificador: int
    cpfCnpj: str
    aceiteTermosAltaDistribuicao: bool
    tipoCompartilhamento: str = "AR"
    percentualCompensacao: Optional[int] = 100
    beneficiarias: List[BeneficiariaItem]
    anexos: Dict[str, str]


class GerenteContextoRequest(BaseModel):
    cpf: str
    numeroCpfCnpjCliente: Optional[str] = None
    codigoEmpresaWeb: int = 6
    cdc: int
    digitoVerificador: int
    descricaoComplementarImovel: Optional[str] = ""
    dataUltimoAcesso: Optional[str] = ""


class AutorizacaoPendenteRequest(BaseModel):
    cpf: str
    codigoEmpresaWeb: int = 6
    unidadeConsumidora: int
    codigo: int


# Modelos públicos (simulação)
class PublicSimulationStart(BaseModel):
    cpf: str


class PublicSimulationSelectPhone(BaseModel):
    transactionId: str
    telefone: str


class PublicSimulationSms(BaseModel):
    sessionId: str
    codigo: str


# ========================
# Worker Thread para Login
# ========================

def _has_display_available() -> bool:
    """Verifica se há um display X disponível (real ou xvfb)"""
    import os
    import subprocess

    # Verifica variável DISPLAY
    display = os.environ.get('DISPLAY')
    if not display:
        return False

    # Tenta verificar se o display está acessível
    try:
        result = subprocess.run(
            ['xdpyinfo'],
            capture_output=True,
            timeout=2
        )
        return result.returncode == 0
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return False


def _login_worker_thread(cpf: str, cmd_queue: queue.Queue, result_queue: queue.Queue):
    """Worker para processo de login com Playwright"""
    from playwright.sync_api import sync_playwright
    from backend.energisa.session_manager import SessionManager
    import random
    import time

    playwright_instance = None
    browser = None
    page = None

    try:
        print(f"[Worker] Iniciando navegador para CPF {cpf}...")

        playwright_instance = sync_playwright().start()

        args = [
            "--no-sandbox", "--disable-infobars", "--start-maximized",
            "--disable-blink-features=AutomationControlled", "--disable-dev-shm-usage", "--disable-gpu"
        ]

        # Detecta automaticamente se há display disponível
        # Se houver xvfb/X server, usa headed para melhor bypass do Akamai
        # Caso contrário, usa headless como fallback
        use_headless = not _has_display_available()
        if use_headless:
            print("   [Browser] Modo headless (sem display X disponível)")
        else:
            print("   [Browser] Modo headed (display X detectado)")

        browser = playwright_instance.chromium.launch(
            headless=use_headless,
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

        print("   [Web] Acessando pagina de login...")
        page.goto("https://servicos.energisa.com.br/login", wait_until="domcontentloaded", timeout=60000)

        # Validação Akamai
        print("   [Security] Aguardando validacao de seguranca...")
        start_time = time.time()

        while time.time() - start_time < 20:
            cookies = context.cookies()
            abck = next((c['value'] for c in cookies if c['name'] == '_abck'), None)

            if abck and "~0~" in abck:
                print(f"   [OK] Cookie de seguranca validado!")
                break

            x, y = random.randint(100, 800), random.randint(100, 600)
            page.mouse.move(x, y, steps=10)
            if random.random() > 0.8:
                page.mouse.click(x, y)
            time.sleep(1.0)

        # Aguarda a página carregar completamente
        print("   [Page] Aguardando carregamento completo da pagina...")
        time.sleep(3)

        # Tenta aguardar por um input na página
        try:
            page.wait_for_selector('input', timeout=15000)
            print("   [Page] Input encontrado na pagina")
        except Exception as e:
            print(f"   [WARN] Timeout esperando input: {e}")
            # Tira screenshot para debug
            try:
                page.screenshot(path="/app/backend/sessions/page_state.png")
                print("   [Debug] Screenshot salvo em sessions/page_state.png")
            except:
                pass

        # Preenchimento CPF - múltiplos seletores para compatibilidade
        cpf_selectors = [
            'input[name="cpf"]',
            'input#cpf',
            'input[placeholder*="CPF"]',
            'input[placeholder*="cpf"]',
            'input[type="tel"]',
            'input[inputmode="numeric"]',
            'input.cpf-input',
            'input[data-testid*="cpf"]',
            'input[aria-label*="CPF"]',
            'input[aria-label*="cpf"]',
        ]

        cpf_input_found = False
        for selector in cpf_selectors:
            try:
                if page.is_visible(selector, timeout=2000):
                    page.click(selector)
                    cpf_input_found = True
                    print(f"   [CPF] Campo encontrado com seletor: {selector}")
                    break
            except:
                continue

        if not cpf_input_found:
            # Tenta encontrar qualquer input visível na página
            print("   [CPF] Tentando busca generica de inputs...")
            try:
                time.sleep(2)
                inputs = page.locator('input').all()
                print(f"   [CPF] Encontrados {len(inputs)} inputs na pagina")
                for idx, inp in enumerate(inputs):
                    try:
                        if inp.is_visible():
                            print(f"   [CPF] Input {idx} visivel, clicando...")
                            inp.click()
                            cpf_input_found = True
                            print("   [CPF] Campo encontrado via busca generica")
                            break
                    except Exception as inp_err:
                        print(f"   [CPF] Input {idx} erro: {inp_err}")
                        continue
            except Exception as e:
                print(f"   [CPF] Erro na busca generica: {e}")

        if not cpf_input_found:
            try:
                page.screenshot(path="/app/backend/sessions/cpf_not_found.png")
                print("   [Debug] Screenshot salvo em sessions/cpf_not_found.png")
                # Log do HTML da página para debug
                html_content = page.content()
                print(f"   [Debug] Tamanho do HTML: {len(html_content)} chars")
                print(f"   [Debug] URL atual: {page.url}")
            except Exception as e:
                print(f"   [Debug] Erro ao salvar debug: {e}")
            raise Exception("Campo CPF não encontrado. O layout da Energisa pode ter mudado.")

        for char in cpf:
            page.keyboard.type(char, delay=random.randint(50, 150))

        # Interceptação
        print("   [Worker] Aguardando JSON de telefones...")

        with page.expect_response(lambda response: "selecionar-numero.json" in response.url and response.status == 200, timeout=30000) as response_info:
            time.sleep(1)
            page.click('button:has-text("ENTRAR"), button:has-text("Entrar")')

        response = response_info.value
        json_data = response.json()

        # Extração
        telefones = []
        emails = []
        try:
            data_obj = json_data.get("pageProps", {}).get("data", {})
            telefones = data_obj.get("listaTelefone", [])

            # Processa listaEmail (estrutura aninhada)
            lista_email_raw = data_obj.get("listaEmail", [])
            for item_email in lista_email_raw:
                enderecos_array = item_email.get("endereco", [])
                for endereco_obj in enderecos_array:
                    email_texto = endereco_obj.get("endereco")
                    if email_texto:
                        emails.append({
                            "email": email_texto,
                            "codigoEmpresaWeb": item_email.get("codigoEmpresaWeb", 6),
                            "cdc": item_email.get("cdc", 0),
                            "digitoVerificador": item_email.get("digitoVerificador", 0),
                            "posicao": endereco_obj.get("posicaoDoEmail", 0)
                        })

            # Fallback: Se não tiver telefone, pega do dadosUsuario
            if not telefones:
                dados_user = data_obj.get("dadosUsuario", {})
                celular_unico = dados_user.get("celular")
                if celular_unico:
                    telefones.append({"celular": celular_unico, "cdc": 0, "posicao": 1})

            # Fallback: Se não tiver email na lista, pega do dadosUsuario
            if not emails:
                dados_user = data_obj.get("dadosUsuario", {})
                email_unico = dados_user.get("email")
                if email_unico:
                    emails.append({"email": email_unico, "cdc": 0, "posicao": 0})

        except Exception as e:
            print(f"   [ERROR] Erro extracao telefones/emails: {e}")

        # Log para debug
        print(f"   [DEBUG] Telefones extraidos: {len(telefones)}")
        print(f"   [DEBUG] Emails extraidos: {len(emails)}")
        if emails:
            print(f"   [DEBUG] Emails: {emails}")

        transaction_id = f"{cpf}_{int(time.time())}"

        result_queue.put({
            "success": True,
            "phase": "selection_pending",
            "transaction_id": transaction_id,
            "listaTelefone": telefones,
            "listaEmail": emails,
            "full_data": json_data
        })

        # Fase 2: Seleção
        print("   [Worker] Aguardando escolha do contato (telefone/e-mail)...")
        cmd = cmd_queue.get(timeout=300)
        if cmd.get("action") != "select_phone":
            raise Exception("Comando inválido")

        contato_raw = cmd.get("telefone")

        # Se for telefone, pega últimos 4 dígitos. Se for e-mail, usa completo
        if "@" in contato_raw:
            contato_busca = contato_raw.strip()
        else:
            contato_busca = contato_raw.strip()[-4:]

        print(f"   [Worker] Buscando opcao... {contato_busca}")

        page.wait_for_selector('text=/contato|telefone|sms|e-mail|email/i', timeout=30000)

        clicked = False
        try:
            elements = page.get_by_text(contato_busca).all()
            for el in elements:
                if el.is_visible():
                    el.click()
                    clicked = True
                    break
        except:
            pass

        if not clicked:
            if page.is_visible('label'):
                page.click('label')
            elif page.is_visible('input[type="radio"]'):
                page.click('input[type="radio"]')

        time.sleep(1)
        if page.is_visible('button:has-text("AVANÇAR")'):
            page.click('button:has-text("AVANÇAR")')
        else:
            page.evaluate("() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.innerText.includes('AVANÇAR')); if(b) b.click() }")

        result_queue.put({"success": True, "phase": "sms_sent", "message": "SMS Enviado"})

        # Fase 3: Finish SMS
        cmd = cmd_queue.get(timeout=300)
        if cmd.get("action") != "finish_sms":
            raise Exception("Comando inválido")

        sms = cmd.get("sms_code")
        print(f"   [Worker] Digitando SMS: {sms}")

        if page.is_visible('input'):
            page.click('input')
        page.keyboard.type(sms, delay=100)
        time.sleep(0.5)
        page.click('button:has-text("AVANÇAR")')

        print("   [Wait] Aguardando autenticacao...")
        try:
            page.wait_for_url(lambda u: "listagem-ucs" in u or "home" in u, timeout=25000)
        except:
            pass

        # Captura tokens
        final_cookies = {c['name']: c['value'] for c in page.context.cookies()}

        print("   [Tokens] Extraindo tokens do LocalStorage e Cookies...")
        try:
            ls_data = page.evaluate("""() => {
                return {
                    accessTokenEnergisa: localStorage.getItem('accessTokenEnergisa') || localStorage.getItem('token'),
                    udk: localStorage.getItem('udk'),
                    rtk: localStorage.getItem('rtk'),
                    refreshToken: localStorage.getItem('refreshToken')
                }
            }""")

            if ls_data:
                for k, v in ls_data.items():
                    if v:
                        final_cookies[k] = v
                        print(f"      + Token encontrado: {k}")
        except Exception as e:
            print(f"   [WARN] Erro ao ler LocalStorage: {e}")

        SessionManager.save_session(cpf, final_cookies)
        print("   [Save] Sessao salva com sucesso!")

        result_queue.put({"success": True, "tokens": list(final_cookies.keys()), "message": "Login OK"})

    except Exception as e:
        print(f"[Worker Error] {e}")
        result_queue.put({"success": False, "error": str(e)})
    finally:
        if browser:
            browser.close()
        if playwright_instance:
            playwright_instance.stop()


# ========================
# Rotas de Login (Protegidas)
# ========================

@router.post("/login/start", summary="Iniciar login na Energisa")
async def login_start(req: LoginStartRequest, current_user: CurrentUser = Depends(get_current_active_user)):
    """Inicia o navegador e retorna a lista de telefones interceptada."""
    cmd_q = queue.Queue()
    result_q = queue.Queue()

    cpf_clean = req.cpf.replace(".", "").replace("-", "")

    thread = threading.Thread(
        target=_login_worker_thread,
        args=(cpf_clean, cmd_q, result_q),
        daemon=True
    )
    thread.start()

    try:
        result = result_q.get(timeout=60)
    except queue.Empty:
        raise HTTPException(500, "Timeout ao carregar opções de login")

    if not result.get("success"):
        raise HTTPException(500, result.get("error", "Erro desconhecido"))

    transaction_id = result["transaction_id"]

    _login_sessions[transaction_id] = {
        "thread": thread,
        "cmd_queue": cmd_q,
        "result_queue": result_q
    }

    return {
        "transaction_id": transaction_id,
        "listaTelefone": result.get("listaTelefone", []),
        "listaEmail": result.get("listaEmail", [])
    }


@router.post("/login/select-option", summary="Selecionar telefone para SMS")
async def login_select_option(req: LoginSelectRequest, current_user: CurrentUser = Depends(get_current_active_user)):
    """Recebe o transaction_id e o telefone escolhido."""
    session = _login_sessions.get(req.transaction_id)
    if not session:
        raise HTTPException(400, "Sessão não encontrada")

    session["cmd_queue"].put({
        "action": "select_phone",
        "telefone": req.opcao_selecionada
    })

    try:
        result = session["result_queue"].get(timeout=60)
    except queue.Empty:
        raise HTTPException(500, "Timeout ao enviar SMS")

    if not result.get("success"):
        raise HTTPException(500, result.get("error"))

    return {"message": "SMS enviado com sucesso"}


@router.post("/login/finish", summary="Finalizar login com código SMS")
async def login_finish(req: LoginFinishRequest, current_user: CurrentUser = Depends(get_current_active_user)):
    """Recebe o código SMS e finaliza."""
    session = _login_sessions.pop(req.transaction_id, None)
    if not session:
        raise HTTPException(400, "Sessão expirada")

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


# ========================
# Rotas de UCs (Protegidas)
# ========================

@router.post("/ucs", summary="Listar UCs do usuário")
async def list_ucs(req: UcRequest, current_user: CurrentUser = Depends(get_current_active_user)):
    """
    Lista todas as UCs vinculadas ao CPF com informações enriquecidas.

    Retorna para cada UC:
    - Dados básicos (numeroUc, digitoVerificador, endereco, etc.)
    - isGD: boolean indicando se possui Geração Distribuída
    - gdInfo: detalhes da GD (se aplicável)
    - badge: badge de status (UC Inativa, GD, etc.)
    - badges: array de múltiplos badges (quando aplicável)
    """
    svc = EnergisaService(req.cpf)
    if not svc.is_authenticated():
        raise HTTPException(401, "Não autenticado na Energisa")
    try:
        return svc.listar_ucs()
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/ucs/info", summary="Detalhes da UC")
async def uc_info_detalhada(req: UcRequest, current_user: CurrentUser = Depends(get_current_active_user)):
    """Busca detalhes cadastrais da UC."""
    try:
        svc = EnergisaService(req.cpf)

        if not svc.is_authenticated():
            raise HTTPException(401, "Sessão inválida ou expirada. Faça login novamente.")

        result = svc.get_uc_info(req.model_dump())

        if result.get("errored"):
            raise HTTPException(400, detail=result.get("message", "Erro ao consultar dados da UC"))

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ========================
# Rotas de Faturas (Protegidas)
# ========================

@router.post("/faturas/listar", summary="Listar faturas da UC")
async def list_bills(req: UcRequest, current_user: CurrentUser = Depends(get_current_active_user)):
    """Lista faturas de uma UC específica."""
    if not req.cdc:
        raise HTTPException(400, "CDC obrigatório")
    try:
        return EnergisaService(req.cpf).listar_faturas(req.model_dump())
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/faturas/pdf", summary="Download PDF da fatura")
async def download_pdf(req: FaturaRequest, current_user: CurrentUser = Depends(get_current_active_user)):
    """Baixa o PDF de uma fatura específica."""
    try:
        content = EnergisaService(req.cpf).download_pdf(req.model_dump(), req.model_dump())
        b64_string = base64.b64encode(content).decode('utf-8')

        return {
            "filename": f"fatura_{req.cdc}_{req.mes}-{req.ano}.pdf",
            "content_type": "application/pdf",
            "file_base64": b64_string
        }
    except Exception as e:
        raise HTTPException(500, str(e))


# ========================
# Rotas de GD (Protegidas)
# ========================

@router.post("/gd/info", summary="Info de Geração Distribuída")
async def get_gd(req: UcRequest, current_user: CurrentUser = Depends(get_current_active_user)):
    """Busca informações de GD da UC."""
    try:
        return EnergisaService(req.cpf).get_gd_info(req.model_dump())
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/gd/details", summary="Detalhes de GD")
async def get_gd_details(req: UcRequest, current_user: CurrentUser = Depends(get_current_active_user)):
    """Busca histórico detalhado de créditos e geração."""
    try:
        data = EnergisaService(req.cpf).get_gd_details(req.model_dump())
        if not data:
            return {"infos": [], "errored": True}
        return data
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/gd/alterar-beneficiaria", summary="Alterar beneficiárias GD")
async def alterar_beneficiaria_gd(req: AlteracaoGdRequest, current_user: CurrentUser = Depends(get_current_active_user)):
    """Realiza alteração das UCs beneficiárias do rateio de créditos."""
    try:
        svc = EnergisaService(req.cpf)

        if not svc.is_authenticated():
            raise HTTPException(401, "Não autenticado na Energisa. Faça login primeiro.")

        dados = req.model_dump()
        del dados['cpf']

        result = svc.alterar_beneficiaria(dados)
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ========================
# Rotas Públicas (Simulação - Landing Page)
# ========================

@router.post("/simulacao/iniciar", summary="Iniciar simulação pública")
async def public_simulation_start(req: PublicSimulationStart, request: Request):
    """Endpoint público para iniciar simulação na landing page."""
    try:
        ip = request.headers.get("X-Forwarded-For", request.client.host if request.client else "unknown")
        if "," in ip:
            ip = ip.split(",")[0].strip()

        cpf_clean = req.cpf.replace(".", "").replace("-", "")

        cmd_queue = queue.Queue()
        result_queue = queue.Queue()

        worker_thread = threading.Thread(
            target=_login_worker_thread,
            args=(cpf_clean, cmd_queue, result_queue),
            daemon=True
        )
        worker_thread.start()

        try:
            result = result_queue.get(timeout=60)
        except queue.Empty:
            raise HTTPException(status_code=500, detail="Timeout aguardando lista de telefones")

        if not result.get("success"):
            raise HTTPException(status_code=500, detail=result.get("error", "Erro desconhecido"))

        transaction_id = result["transaction_id"]
        session_id = f"pub_{transaction_id}"

        _login_sessions[session_id] = {
            "thread": worker_thread,
            "cmd_queue": cmd_queue,
            "result_queue": result_queue,
            "cpf": cpf_clean,
            "ip": ip,
            "transaction_id": transaction_id,
            "created_at": time.time()
        }

        return {
            "transaction_id": session_id,
            "listaTelefone": result.get("listaTelefone", []),
            "listaEmail": result.get("listaEmail", [])
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/simulacao/enviar-sms", summary="Enviar SMS para simulação")
async def public_simulation_send_sms(req: PublicSimulationSelectPhone, request: Request):
    """Endpoint público para enviar SMS ao telefone selecionado."""
    try:
        session = _login_sessions.get(req.transactionId)
        if not session:
            raise HTTPException(400, "Sessão não encontrada ou expirada")

        session["cmd_queue"].put({
            "action": "select_phone",
            "telefone": req.telefone
        })

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
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/simulacao/validar-sms", summary="Validar código SMS")
async def public_simulation_validate_sms(req: PublicSimulationSms, request: Request):
    """Endpoint público para validar código SMS da simulação."""
    try:
        session_id = req.sessionId

        if session_id not in _login_sessions:
            raise HTTPException(status_code=404, detail="Sessão não encontrada ou expirada")

        session_data = _login_sessions[session_id]

        cmd_queue = session_data["cmd_queue"]
        result_queue = session_data["result_queue"]

        cmd_queue.put({"action": "finish_sms", "sms_code": req.codigo})

        try:
            result = result_queue.get(timeout=120)
        except queue.Empty:
            raise HTTPException(status_code=500, detail="Timeout aguardando finish_login")

        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error", "Erro na validação do SMS"))

        _login_sessions[session_id]["authenticated"] = True

        return {
            "success": True,
            "message": result.get("message", "Autenticação realizada com sucesso"),
            "session_id": session_id
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/simulacao/ucs/{session_id}", summary="Buscar UCs da simulação")
async def public_simulation_get_ucs(session_id: str, request: Request):
    """Endpoint público para buscar UCs após autenticação."""
    try:
        if session_id not in _login_sessions:
            raise HTTPException(status_code=404, detail="Sessão não encontrada")

        session_data = _login_sessions[session_id]

        if not session_data.get("authenticated"):
            raise HTTPException(status_code=401, detail="Sessão não autenticada")

        cpf = session_data["cpf"]
        svc = EnergisaService(cpf)

        if not svc.is_authenticated():
            raise HTTPException(status_code=401, detail="Sessão expirada")

        ucs_data = svc.listar_ucs()

        return {
            "success": True,
            "ucs": ucs_data
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/simulacao/faturas/{session_id}/{codigo_uc}", summary="Buscar faturas com economia")
async def public_simulation_get_faturas(session_id: str, codigo_uc: int, request: Request):
    """Endpoint público para buscar faturas de uma UC com cálculo de economia."""
    try:
        if session_id not in _login_sessions:
            raise HTTPException(status_code=404, detail="Sessão não encontrada")

        session_data = _login_sessions[session_id]

        if not session_data.get("authenticated"):
            raise HTTPException(status_code=401, detail="Sessão não autenticada")

        cpf = session_data["cpf"]
        svc = EnergisaService(cpf)

        if not svc.is_authenticated():
            raise HTTPException(status_code=401, detail="Sessão expirada")

        # Busca UCs
        ucs_data = svc.listar_ucs()

        uc_encontrada = None
        for uc in ucs_data:
            if uc.get('numeroUc') == codigo_uc:
                uc_encontrada = uc
                break

        if not uc_encontrada:
            raise HTTPException(status_code=404, detail="UC não encontrada")

        uc_mapeada = {
            'cdc': uc_encontrada.get('numeroUc'),
            'digitoVerificadorCdc': uc_encontrada.get('digitoVerificador'),
            'codigoEmpresaWeb': uc_encontrada.get('codigoEmpresaWeb', 6)
        }

        # Busca faturas
        faturas_data = svc.listar_faturas(uc_mapeada)
        faturas_12_meses = faturas_data[-13:] if len(faturas_data) > 13 else faturas_data

        # Busca info detalhada
        tipo_ligacao = "BIFASICO"
        grupo_leitura = "B"

        try:
            uc_info_response = svc.get_uc_info(uc_mapeada)
            if uc_info_response and not uc_info_response.get("errored"):
                infos = uc_info_response.get("infos", {})
                dados_instalacao = infos.get("dadosInstalacao", {})
                tipo_ligacao = dados_instalacao.get("tipoLigacao", "BIFASICO")
                grupo_leitura = dados_instalacao.get("grupoLeitura", "B")
        except:
            pass

        # Processa faturas
        faturas_processadas = calculadora.processar_faturas(faturas_12_meses)
        consumo_kwh = faturas_processadas["consumo_kwh"]
        iluminacao_publica = faturas_processadas["iluminacao_publica"]
        tem_bandeira = faturas_processadas["tem_bandeira_vermelha"]

        # Busca tarifas ANEEL
        tarifas_aneel = aneel_api.get_tarifas_com_fallback("EMT")
        tarifa_b1_sem_impostos = tarifas_aneel["tarifa_b1_sem_impostos"]
        fiob_base = tarifas_aneel["fiob_sem_impostos"]
        tarifa_b1_com_impostos = constants.aplicar_impostos(tarifa_b1_sem_impostos)

        # Calcula economia
        calculo_economia = None
        projecao_10_anos = None

        if consumo_kwh > 0 and grupo_leitura == "B":
            calculo_economia = calculadora.calcular_economia_mensal(
                consumo_kwh=consumo_kwh,
                tipo_ligacao=tipo_ligacao,
                iluminacao_publica=iluminacao_publica,
                tem_bandeira_vermelha=tem_bandeira,
                tarifa_b1_kwh_com_impostos=tarifa_b1_com_impostos,
                fiob_base_kwh=fiob_base
            )

            projecao_10_anos = calculadora.calcular_projecao_10_anos(
                conta_atual_mensal=calculo_economia["custo_energisa_consumo"],
                conta_midwest_mensal=calculo_economia["valor_midwest_consumo"]
            )

        return {
            "success": True,
            "faturas": faturas_12_meses,
            "uc_info": {
                "tipo_ligacao": tipo_ligacao,
                "grupo_leitura": grupo_leitura
            },
            "faturas_resumo": faturas_processadas,
            "calculo_economia": calculo_economia,
            "projecao_10_anos": projecao_10_anos,
            "total_pago_12_meses": faturas_processadas["total_pago_12_meses"]
        }

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
