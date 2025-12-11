import playwright
from playwright.sync_api import sync_playwright
import requests
import time
import re
from session_manager import SessionManager

# Armazena navegadores abertos temporariamente aguardando o SMS
# Chave: transaction_id | Valor: contexto do playwright
PENDING_LOGINS = {}

class EnergisaService:
    def get_uc_info(self, uc_data: dict):
        """
        Consulta informações detalhadas da Unidade Consumidora.
        URL: /api/clientes/UnidadeConsumidora/Informacao?codigoEmpresaWeb=...&uc=...&digitoVerificador=...
        Body: Tokens de autenticação.
        """
        try:
            # Mapeia os dados do seu sistema para os parâmetros da URL da Energisa
            empresa = int(uc_data.get('codigoEmpresaWeb', 6))
            # O parâmetro na URL é 'uc', mas no seu payload/request vem como 'cdc'
            uc_numero = int(uc_data.get('cdc')) 
            # O parâmetro na URL é 'digitoVerificador', no request vem como 'digitoVerificadorCdc'
            dv = int(uc_data.get('digitoVerificadorCdc'))
        except (ValueError, TypeError):
            raise Exception("Dados da UC inválidos. Certifique-se de que CDC e Dígito são números.")

        # Monta a URL com os Query Params
        url = f"{self.base_url}/api/clientes/UnidadeConsumidora/Informacao?codigoEmpresaWeb={empresa}&uc={uc_numero}&digitoVerificador={dv}"
        
        # Prepara o Payload (Body) com os tokens de sessão
        payload = self._get_tokens_payload()
        headers = self._get_headers()

        print(f"   ℹ️ Consultando detalhes cadastrais da UC {uc_numero}...")

        try:
            # POST Request
            resp = self.session.post(url, json=payload, headers=headers)

            # Lógica de Retry (Refresh Token) se der 401
            if resp.status_code == 401:
                print("   ⚠️ 401 ao consultar UC Info. Tentando renovar token...")
                if self._refresh_token():
                    # Atualiza os tokens no payload e tenta de novo
                    payload = self._get_tokens_payload()
                    resp = self.session.post(url, json=payload, headers=headers)

            if resp.status_code == 200:
                return resp.json()
            else:
                print(f"   ❌ Erro UC Info: {resp.status_code} - {resp.text[:200]}")
                # Tenta retornar o erro formatado se for JSON, senão cria um objeto de erro
                try: 
                    return resp.json()
                except: 
                    return {"errored": True, "message": f"Erro HTTP {resp.status_code}", "details": resp.text}

        except Exception as e:
            print(f"   ❌ Exceção UC Info: {e}")
            return {"errored": True, "message": str(e)}


    def __init__(self, cpf: str):
        self.cpf = cpf.replace(".", "").replace("-", "")
        self.base_url = "https://servicos.energisa.com.br"
        self.session = requests.Session()
        
        # Carrega cookies existentes se houver
        self.cookies = SessionManager.load_session(self.cpf)
        if self.cookies:
            self._apply_cookies(self.cookies)

    def _apply_cookies(self, cookies):
        for name, value in cookies.items():
            self.session.cookies.set(name, value)

    def _get_build_id(self):
        """Busca o identificador da versão atual do site (necessário para rotas _next)"""
        # Tenta pegar do cache local primeiro
        if hasattr(self, '_cached_build_id'):
            return self._cached_build_id

        print("   🔍 Buscando buildId do Next.js...")
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": f"{self.base_url}/faturas"
        }
        
        try:
            # Acessa a página de faturas para ler o HTML
            resp = self.session.get(f"{self.base_url}/faturas", headers=headers)
            if resp.status_code != 200:
                return None
            
            # Procura o buildId no HTML usando Regex
            match = re.search(r'"buildId"\s*:\s*"([^"]+)"', resp.text)
            if match:
                bid = match.group(1)
                self._cached_build_id = bid
                print(f"   ✅ BuildId encontrado: {bid}")
                return bid
        except Exception as e:
            print(f"   ⚠️ Erro ao buscar buildId: {e}")
            
        return None


    # Dentro da classe EnergisaService no arquivo service.py

    def is_authenticated(self):
        if not self.cookies:
            return False
            
        # CORREÇÃO: Verifica se temos tokens essenciais (UTK ou RTK ou AccessToken)
        # O seu JSON tem 'utk' e 'rtk', então isso agora retornará True
        has_token = (
            "accessTokenEnergisa" in self.cookies or 
            "utk" in self.cookies or 
            "rtk" in self.cookies
        )
        
        return has_token

    # --- LOGIN (Versão Camuflada Anti-WAF) ---
    # --- LOGIN (Versão HEADED / VISUAL rodando no Xvfb) ---
    def start_login(self, final_telefone: str):
        print(f"🚀 Login: CPF {self.cpf} | Tel Final: {final_telefone}")
        
        playwright = sync_playwright().start()
        
        # 1. Argumentos para simular um PC real
        args = [
            "--no-sandbox",
            "--disable-infobars",
            "--start-maximized",
            "--disable-blink-features=AutomationControlled", # Esconde automação
            "--disable-dev-shm-usage",
            "--disable-gpu"
        ]

        # Rodando em modo headless para compatibilidade com Docker
        browser = playwright.chromium.launch(
            headless=True,
            args=args,
            ignore_default_args=["--enable-automation"] # Remove barra amarela do Chrome
        )
        
        # 2. Contexto com a mesma resolução do Xvfb (1280x1024)
        context = browser.new_context(
            viewport={'width': 1280, 'height': 1024},
            locale='pt-BR',
            timezone_id='America/Sao_Paulo',
            user_agent='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )
        
        # 3. Scripts de Camuflagem (Evasão de Bot)
        init_script = """
        () => {
            // Remove flag de webdriver
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            
            // Cria objeto window.chrome fake
            window.chrome = { runtime: {} };
            
            // Mascara Plugins
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            
            // Mascara Permissões
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

        try:
            print("   🌐 Acessando página de login (Modo Visual/Xvfb)...")
            
            # (Opcional) Acessa Google antes para 'aquecer' o navegador
            try: page.goto("https://www.google.com.br", timeout=10000)
            except: pass

            # Acessa a Energisa
            page.goto(f"{self.base_url}/login", wait_until="domcontentloaded", timeout=60000)
            
            # Pausa humanizada para scripts de segurança rodarem
            time.sleep(5)
            
            # Verifica se fomos bloqueados
            title = page.title()
            print(f"   🔎 Título da página: {title}")
            
            if "Access Denied" in title or "Bloqueio" in title:
                try: page.screenshot(path="sessions/access_denied.png")
                except: pass
                raise Exception(f"Bloqueio WAF detectado (Access Denied). Título: {title}")

            # Verifica se o campo CPF apareceu
            try:
                page.wait_for_selector('input[name="cpf"]', state="visible", timeout=20000)
            except:
                # Verifica se tem Captcha (iframe)
                if page.locator("iframe").count() > 0:
                    raise Exception("Captcha detectado na tela.")
                
                # Tenta tirar print do erro
                try: page.screenshot(path="sessions/erro_login_no_input.png")
                except: pass
                
                raise Exception(f"Campo CPF não carregou. Título: {title}")

            print("   ✍️ Preenchendo CPF...")
            # Clica e digita lentamente
            page.click('input[name="cpf"]')
            for char in self.cpf:
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
            
            # Salva estado para o passo 2 (finish_login)
            transaction_id = f"{self.cpf}_{int(time.time())}"
            PENDING_LOGINS[transaction_id] = {"pw": playwright, "br": browser, "pg": page}
            
            return {"transaction_id": transaction_id, "message": "SMS enviado (Modo Visual)"}

        except Exception as e:
            # Se der erro, fecha o navegador para não travar memória
            browser.close()
            playwright.stop()
            raise Exception(f"Erro no login: {str(e)}")

    def _extract_tokens_from_browser(self, page):
        """Tenta extrair tokens de Cookies e LocalStorage insistentemente"""
        tokens = {}
        
        # 1. Tenta Cookies
        cookies = page.context.cookies()
        for c in cookies:
            tokens[c['name']] = c['value']
            
        # 2. Tenta LocalStorage (Onde o token costuma ficar em SPAs modernas)
        try:
            ls_data = page.evaluate("""() => {
                return {
                    accessToken: localStorage.getItem('accessTokenEnergisa') || localStorage.getItem('token'),
                    udk: localStorage.getItem('udk'),
                    rtk: localStorage.getItem('rtk')
                }
            }""")
            
            if ls_data.get('accessToken'):
                tokens['accessTokenEnergisa'] = ls_data['accessToken']
            if ls_data.get('udk'):
                tokens['udk'] = ls_data['udk']
            if ls_data.get('rtk'):
                tokens['rtk'] = ls_data['rtk']
                
        except Exception as e:
            print(f"⚠️ Erro ao ler LocalStorage: {e}")
            
        return tokens

    def finish_login(self, transaction_id: str, sms_code: str):
        if transaction_id not in PENDING_LOGINS: raise Exception("Transação expirada")
        
        # Recupera usando as chaves curtas definidas no start_login
        ctx = PENDING_LOGINS.pop(transaction_id)
        page = ctx["pg"]
        browser = ctx["br"]
        playwright = ctx["pw"]

        try:
            # Clica no input (necessário em modo visual)
            try:
                if page.is_visible('input[type="tel"]'): page.click('input[type="tel"]')
                elif page.is_visible('input[type="number"]'): page.click('input[type="number"]')
                else: page.mouse.click(640, 512)
            except: pass

            for d in sms_code: page.keyboard.type(d, delay=150)
            time.sleep(1)
            
            # Clica Avançar
            if page.is_visible('button:has-text("AVANÇAR")'):
                page.click('button:has-text("AVANÇAR")')
            else:
                page.evaluate("() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.innerText.includes('AVANÇAR')); if(b) b.click() }")

            print("   ⏳ Aguardando tokens...")
            try: page.wait_for_url(lambda u: "listagem-ucs" in u or "home" in u, timeout=25000)
            except: pass
            
            final_cookies = {}
            for _ in range(10):
                final_cookies = self._extract_tokens_from_browser(page)
                if 'rtk' in final_cookies or 'accessTokenEnergisa' in final_cookies: break
                time.sleep(1)
            
            if 'rtk' not in final_cookies and 'accessTokenEnergisa' not in final_cookies:
                raise Exception("Falha ao capturar tokens")
            
            SessionManager.save_session(self.cpf, final_cookies)
            self._apply_cookies(final_cookies)
            return {"status": "success", "message": "Login OK", "tokens": list(final_cookies.keys())}
        except Exception as e:
            raise e
        finally:
            browser.close()
            playwright.stop()

    def _get_headers(self, json_content=True):
        h = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Origin": self.base_url,
        }
        if json_content:
            h["Content-Type"] = "application/json"
        return h

    def _get_tokens_payload(self):
        """Monta o payload padrão de autenticação"""
        return {
            "ate": self.cookies.get("accessTokenEnergisa", ""),
            "udk": self.cookies.get("udk", ""),
            "utk": self.cookies.get("utk", ""),
            "refreshToken": self.cookies.get("rtk", "") or self.cookies.get("refreshToken", ""),
            "retk": ""
        }

    # --- NOVO MÉTODO PARA GERAR TOKEN USANDO O RTK ---
    def _refresh_token(self):
        print("   🔄 Tentando renovar Access Token com RTK...")
        url = f"{self.base_url}/api/autenticacao/UsuarioClienteEnergisa/Autenticacao/AtualizarToken"
        
        # Precisamos enviar o Refresh Token e o UTK (como 'token')
        payload = {
            "refreshToken": self.cookies.get("rtk"),
            "token": self.cookies.get("accessTokenEnergisa") or self.cookies.get("utk")
        }
        
        headers = self._get_headers()
        # Remove ispublic para refresh, as vezes ajuda
        if "ispublic" in headers: del headers["ispublic"]

        try:
            resp = self.session.post(url, json=payload, headers=headers)
            
            if resp.status_code == 200:
                data = resp.json()
                if 'infos' in data and 'token' in data['infos']:
                    new_token = data['infos']['token']
                    new_rtk = data['infos'].get('refreshToken')
                    
                    # Atualiza os cookies em memória
                    self.cookies['accessTokenEnergisa'] = new_token
                    if new_rtk:
                        self.cookies['rtk'] = new_rtk
                    
                    # Salva no arquivo para não precisar fazer de novo
                    SessionManager.save_session(self.cpf, self.cookies)
                    self._apply_cookies(self.cookies)
                    print("   ✅ Token renovado com sucesso!")
                    return True
            
            print(f"   ❌ Falha ao renovar token: {resp.status_code} - {resp.text}")
            return False
        except Exception as e:
            print(f"   ❌ Erro na renovação: {e}")
            return False

    # --- ATUALIZAR O LISTAR_UCS PARA USAR O REFRESH ---
    def listar_ucs(self):
        url = f"{self.base_url}/api/usuarios/UnidadeConsumidora?doc={self.cpf}"
        
        # Tentativa 1
        payload = self._get_tokens_payload()
        resp = self.session.post(url, json=payload, headers=self._get_headers())
        
        # Se der 401 (Não autorizado), tenta renovar e chamar de novo
        if resp.status_code == 401:
            print("   ⚠️ Recebeu 401. Tentando Refresh automático...")
            if self._refresh_token():
                # Tentativa 2 com token novo
                payload = self._get_tokens_payload()
                resp = self.session.post(url, json=payload, headers=self._get_headers())
            else:
                raise Exception("Sessão expirada e falha ao renovar token.")

        if resp.status_code == 200:
            return resp.json().get('infos', [])
        
        raise Exception(f"Erro API Energisa: {resp.status_code} - {resp.text}")

    # No arquivo service.py, substitua o listar_faturas existente:

    def listar_faturas(self, uc_data: dict):
        # 1. Validação e Conversão de Dados
        try:
            cdc = int(uc_data.get('cdc', 0))
            digito = int(uc_data.get('digitoVerificadorCdc', 0))
            empresa = int(uc_data.get('codigoEmpresaWeb', 6))
        except ValueError:
            print("   ❌ Erro: Dados da UC inválidos (não numéricos).")
            return []

        if cdc == 0:
            print("   ❌ Erro: CDC zerado.")
            return []

        # 2. DEFINIR COOKIES DE CONTEXTO (CRUCIAL PARA O NEXT.JS)
        # O site sabe qual fatura listar olhando esses cookies, não o payload
        self.session.cookies.set("NumeroUc", str(cdc))
        self.session.cookies.set("Digito", str(digito))
        self.session.cookies.set("CodigoEmpresaWeb", str(empresa))
        
        # Atualiza também no dicionário de cookies da classe para persistência
        self.cookies["NumeroUc"] = str(cdc)
        self.cookies["Digito"] = str(digito)
        self.cookies["CodigoEmpresaWeb"] = str(empresa)
        
        # 3. Tenta a rota via Next.js (Método Preferencial - GET)
        build_id = self._get_build_id()
        
        if build_id:
            url_next = f"{self.base_url}/_next/data/{build_id}/faturas.json"
            headers_next = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Referer": f"{self.base_url}/faturas",
                "Accept": "*/*"
            }
            
            print(f"   📤 Consultando faturas via Next.js (UC {cdc})...")
            resp = self.session.get(url_next, headers=headers_next)
            
            if resp.status_code == 200:
                try:
                    data = resp.json()
                    # O caminho do JSON no Next.js é pageProps -> data -> faturas
                    if "pageProps" in data and "data" in data["pageProps"]:
                         faturas = data["pageProps"]["data"].get("faturas", [])
                         print(f"   ✅ Sucesso via Next.js! {len(faturas)} faturas encontradas.")
                         return faturas
                except:
                    print("   ⚠️ Erro ao processar JSON do Next.js")

        # 4. Fallback para API antiga (POST) - Caso o Next falhe
        # Nota: Se a API estiver dando 405, isso aqui vai falhar também, mas mantemos como reserva
        print("   ⚠️ Next.js falhou ou buildId não encontrado. Tentando API Legacy...")
        
        url_api = f"{self.base_url}/api/clientes/Fatura/ListarFaturasCliente"
        payload = self._get_tokens_payload()
        payload.update({
            "codigoEmpresaWeb": empresa,
            "cdc": cdc,
            "digitoVerificadorCdc": digito
        })
        
        headers_api = {
            "Content-Type": "application/json",
            "Referer": f"{self.base_url}/faturas",
            "Origin": self.base_url
        }
        
        resp = self.session.post(url_api, json=payload, headers=headers_api)
        
        if resp.status_code == 401:
             # Se der 401, tenta refresh e chama recursivamente (apenas uma vez)
             if self._refresh_token():
                 return self.listar_faturas(uc_data)

        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, dict) and 'infos' in data:
                return data['infos']
            if isinstance(data, list):
                return data
        
        print(f"   ❌ Todas as tentativas falharam. Status API: {resp.status_code}")
        return []

    # Substitua o método download_pdf existente por este:

    
    # --- NOVO MÉTODO: Sincronizar Sessão via Navegação (GET) ---
    def _sincronizar_sessao_via_navegacao(self, uc_data: dict):
        """
        Simula o navegador entrando na página de faturas da UC específica.
        Isso força o servidor a ler os cookies e atualizar a sessão ASP.NET/Next.js.
        """
        cdc = uc_data.get('cdc')
        print(f"   🔄 Sincronizando sessão para UC {cdc} via navegação...")

        # Define os cookies de alvo ANTES de navegar
        cookies_uc = {
            "NumeroUc": str(cdc),
            "Digito": str(uc_data.get('digitoVerificadorCdc')),
            "CodigoEmpresaWeb": str(uc_data.get('codigoEmpresaWeb', 6))
        }
        
        for k, v in cookies_uc.items():
            self.session.cookies.set(k, v)
            self.cookies[k] = v

        # Faz um GET na página de Faturas (não é API, é a página HTML)
        # Isso ativa os middlewares do site que configuram a sessão
        url_navegacao = f"{self.base_url}/faturas"
        
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Referer": f"{self.base_url}/home"
        }

        try:
            resp = self.session.get(url_navegacao, headers=headers)
            if resp.status_code == 200:
                return True
            print(f"   ⚠️ Aviso: Navegação retornou {resp.status_code}")
        except Exception as e:
            print(f"   ⚠️ Erro na sincronização via navegação: {e}")
            
        return False

    # --- MÉTODO DE DOWNLOAD ATUALIZADO ---
    def download_pdf(self, uc_data: dict, fatura_data: dict):
        # 1. Validação
        try:
            cdc = int(uc_data.get('cdc', 0))
            digito = int(uc_data.get('digitoVerificadorCdc', 0))
            empresa = int(uc_data.get('codigoEmpresaWeb', 6))
            ano = int(fatura_data.get('ano', 0))
            mes = int(fatura_data.get('mes', 0))
            num_fatura = int(fatura_data.get('numeroFatura', 0))
        except ValueError:
            raise Exception("Dados inválidos. Devem ser numéricos.")

        # 2. SINCRONIZAÇÃO (A Correção)
        # Em vez de chamar a API 405, navegamos para a página
        self._sincronizar_sessao_via_navegacao({
            "cdc": cdc,
            "digitoVerificadorCdc": digito,
            "codigoEmpresaWeb": empresa
        })

        # 3. Prepara Download
        url = f"{self.base_url}/api/clientes/SegundaVia/Download"
        
        payload = self._get_tokens_payload()
        payload.update({
            "codigoEmpresaWeb": empresa,
            "cdc": cdc,
            "digitoVerificadorCdc": digito,
            "ano": ano,
            "mes": mes,
            "fatura": num_fatura,
            "cdcRed": None # Importante enviar como None/null
        })
        
        headers = self._get_headers()
        headers["Accept"] = "application/pdf, application/json" # Aceita ambos para ver erro
        headers["Referer"] = f"{self.base_url}/faturas"
        
        print(f"   📥 Baixando PDF: {mes}/{ano} - UC {cdc}...")
        
        resp = self.session.post(url, json=payload, headers=headers)
        
        # Retry 401 (Refresh Token)
        if resp.status_code == 401:
            print("   ⚠️ 401 detectado. Renovando token...")
            if self._refresh_token():
                payload = self._get_tokens_payload()
                payload.update({
                    "codigoEmpresaWeb": empresa, "cdc": cdc, "digitoVerificadorCdc": digito,
                    "ano": ano, "mes": mes, "fatura": num_fatura, "cdcRed": None
                })
                resp = self.session.post(url, json=payload, headers=headers)

        # 4. Validação de Sucesso
        if resp.status_code == 200:
            # Verifica assinatura PDF (%PDF)
            if resp.content.startswith(b'%PDF'):
                print("   ✅ PDF baixado com sucesso!")
                return resp.content
            else:
                # Tenta decodificar erro HTML ou JSON
                try:
                    content_str = resp.content.decode('utf-8', errors='ignore')
                    if "json" in resp.headers.get("Content-Type", ""):
                        err = resp.json()
                        msg = err.get("mensagem") or err.get("message") or str(err)
                        raise Exception(f"Erro lógico API: {msg}")
                    elif "<html" in content_str.lower():
                        raise Exception("Erro 500: O servidor retornou uma página de erro HTML (Crash interno).")
                except Exception as e:
                    raise Exception(f"Conteúdo inválido recebido: {str(e)}")

        raise Exception(f"Falha download. Status: {resp.status_code}")
            # 1. Validação de tipos
        try:
            cdc = int(uc_data.get('cdc', 0))
            digito = int(uc_data.get('digitoVerificadorCdc', 0))
            empresa = int(uc_data.get('codigoEmpresaWeb', 6))
            ano = int(fatura_data.get('ano', 0))
            mes = int(fatura_data.get('mes', 0))
            num_fatura = int(fatura_data.get('numeroFatura', 0))
        except ValueError:
            raise Exception("Dados inválidos. Certifique-se de que são números.")

        # 2. ATIVA O CONTEXTO NO SERVIDOR (Correção do 412)
        # Primeiro definimos os cookies locais
        self.session.cookies.set("NumeroUc", str(cdc))
        self.session.cookies.set("Digito", str(digito))
        self.session.cookies.set("CodigoEmpresaWeb", str(empresa))
        
        # AGORA: Chamamos a API para avisar o backend
        self._ativar_contexto_uc({
            "codigoEmpresaWeb": empresa,
            "cdc": cdc,
            "digitoVerificadorCdc": digito
        })

        # 3. Prepara o Download
        url = f"{self.base_url}/api/clientes/SegundaVia/Download"
        
        payload = self._get_tokens_payload()
        payload.update({
            "codigoEmpresaWeb": empresa,
            "cdc": cdc,
            "digitoVerificadorCdc": digito,
            "ano": ano,
            "mes": mes,
            "fatura": num_fatura,
            "cdcRed": None
        })
        
        headers = self._get_headers()
        headers["Accept"] = "application/pdf"
        headers["Referer"] = f"{self.base_url}/faturas"
        
        print(f"   📥 Baixando PDF: {mes}/{ano} - UC {cdc}...")
        
        # 4. Executa Request
        resp = self.session.post(url, json=payload, headers=headers)
        
        # Retry 401
        if resp.status_code == 401:
            if self._refresh_token():
                payload = self._get_tokens_payload()
                payload.update({
                    "codigoEmpresaWeb": empresa, "cdc": cdc, "digitoVerificadorCdc": digito,
                    "ano": ano, "mes": mes, "fatura": num_fatura, "cdcRed": None
                })
                resp = self.session.post(url, json=payload, headers=headers)

        # 5. Validação Final
        if resp.status_code == 200:
            if resp.content[:4] == b'%PDF':
                print("   ✅ PDF baixado com sucesso!")
                return resp.content
            else:
                # Tenta ler erro JSON escondido no 200 OK
                try:
                    err = resp.json()
                    msg = err.get("mensagem") or err.get("message")
                    raise Exception(f"Erro lógico da Energisa: {msg}")
                except:
                    # Se não for JSON e não for PDF, é erro genérico
                    raise Exception(f"Conteúdo inválido recebido (não é PDF). Início: {resp.content[:20]}")

        if resp.status_code == 412:
             raise Exception("Erro 412: O servidor rejeitou a troca de contexto. Tente listar as faturas novamente antes de baixar.")

        raise Exception(f"Falha download: {resp.status_code} - {resp.text[:100]}")
    
    def _ativar_contexto_uc(self, uc_data: dict):
        """
        Avisa o servidor que estamos trocando de UC. 
        Isso previne o erro 412 no download.
        """
        url = f"{self.base_url}/api/clientes/Padrao/SelecionarUc"
        
        payload = self._get_tokens_payload()
        payload.update({
            "codigoEmpresaWeb": int(uc_data.get('codigoEmpresaWeb', 6)),
            "cdc": int(uc_data.get('cdc')),
            "digitoVerificadorCdc": int(uc_data.get('digitoVerificadorCdc'))
        })
        
        print(f"   🔄 Sincronizando contexto do servidor para UC {uc_data.get('cdc')}...")
        
        try:
            # Headers padrão
            headers = self._get_headers()
            resp = self.session.post(url, json=payload, headers=headers)
            
            if resp.status_code == 200:
                # Atualiza cookies que podem ter vindo na resposta
                self._extract_tokens_from_response(resp)
                return True
            elif resp.status_code == 401:
                if self._refresh_token():
                    return self._ativar_contexto_uc(uc_data) # Tenta 1 vez recursivamente
            
            print(f"   ⚠️ Aviso: Falha ao selecionar UC no servidor (Status {resp.status_code}). O download pode falhar.")
            return False
        except Exception as e:
            print(f"   ⚠️ Erro ao selecionar UC: {e}")
            return False

    # Helper para atualizar cookies vindo de respostas Requests
    def _extract_tokens_from_response(self, response):
        for cookie in response.cookies:
            self.cookies[cookie.name] = cookie.value
            self.session.cookies.set(cookie.name, cookie.value)

    def get_gd_info(self, uc_data: dict):
        """Pega dados de Geração Distribuída"""
        codigo = uc_data.get('codigoEmpresaWeb', 6)
        numero = uc_data.get('cdc')
        digito = uc_data.get('digitoVerificadorCdc')
        
        url = f"{self.base_url}/api/clientes/Gd/VerificaContextoGDByUC?codigoEmpresaWeb={codigo}&numeroUc={numero}&digitoVerificador={digito}"
        
        payload = self._get_tokens_payload()
        resp = self.session.post(url, json=payload, headers=self._get_headers())
        
        if resp.status_code == 200:
            return resp.json()
        return None

    def get_gd_details(self, uc_data: dict):
        """
        Consulta histórico detalhado de créditos e geração (VerificaContextoNaoAutenticado).
        Retorna saldos anteriores, energia injetada, etc.
        """
        try:
            cdc = int(uc_data.get('cdc', 0))
            digito = int(uc_data.get('digitoVerificadorCdc', 0))
            empresa = int(uc_data.get('codigoEmpresaWeb', 6))
        except: return None

        # Nota: A query string pede 'numeroCdc' em vez de 'numeroUc'
        url = (f"{self.base_url}/api/clientes/Gd/GetHistoricoDemonstrativoGd"
               f"?codigoEmpresaWeb={empresa}&numeroCdc={cdc}&digitoVerificador={digito}&periodo=13")

        payload = self._get_tokens_payload()
        headers = self._get_headers()

        try:
            print(f"   📊 Consultando detalhes GD para CDC {cdc}...")
            resp = self.session.post(url, json=payload, headers=headers)

            # Retry automático em caso de 401
            if resp.status_code == 401:
                if self._refresh_token():
                    payload = self._get_tokens_payload()
                    resp = self.session.post(url, json=payload, headers=headers)

            if resp.status_code == 200:
                return resp.json()
            else:
                print(f"   ❌ Erro GD Details: {resp.status_code}")
        except Exception as e:
            print(f"   ❌ Exceção GD Details: {e}")

        return None
    
    def enviar_anexo(self, arquivo_bytes, nome_arquivo, content_type, categoria, fluxo, reducao):
        """
        Envia um arquivo para a API da Energisa usando multipart/form-data.
        Os tokens de autenticação vão no CORPO da requisição, não só nos headers.
        """
        url = f"{self.base_url}/api/AnexoArquivo/enviarAnexo"
        
        # Pega os tokens atuais
        tokens = self._get_tokens_payload()
        
        # Monta os campos de texto do formulário (Body)
        # Nota: Requests lida automaticamente com o Content-Type multipart
        data = {
            "categoria": categoria,
            "fluxo": fluxo,
            "reducaoImagem": str(reducao).lower(), # garante "false" ou "true"
            # Tokens injetados no corpo conforme especificação
            "ate": tokens.get('ate', ''),
            "udk": tokens.get('udk', ''),
            "utk": tokens.get('utk', ''),
            "refreshToken": tokens.get('refreshToken', ''),
            "retk": tokens.get('retk', '') if tokens.get('retk') else ""
        }
        
        # Monta o arquivo
        files = {
            "anexo": (nome_arquivo, arquivo_bytes, content_type)
        }
        
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Origin": self.base_url,
            # NÃO defina Content-Type aqui, o requests faz isso sozinho com o boundary correto
        }
        
        print(f"   📎 Enviando anexo: {nome_arquivo}...")
        
        try:
            resp = self.session.post(url, data=data, files=files, headers=headers)
            
            # Se der 401, renova e tenta de novo
            if resp.status_code == 401:
                print("   ⚠️ 401 no envio de anexo. Renovando token...")
                if self._refresh_token():
                    # Atualiza os tokens no corpo da requisição
                    tokens = self._get_tokens_payload()
                    data["ate"] = tokens.get('ate', '')
                    data["udk"] = tokens.get('udk', '')
                    data["utk"] = tokens.get('utk', '')
                    data["refreshToken"] = tokens.get('refreshToken', '')
                    
                    # Reenvia (precisamos recriar o dict files pois streams podem ter sido consumidos)
                    files = {"anexo": (nome_arquivo, arquivo_bytes, content_type)}
                    resp = self.session.post(url, data=data, files=files, headers=headers)

            if resp.status_code == 200:
                print("   ✅ Anexo enviado com sucesso!")
                return resp.json()
            else:
                print(f"   ❌ Erro envio anexo: {resp.status_code} - {resp.text}")
                # Tenta retornar o erro em JSON se possível
                try: return resp.json()
                except: return {"errored": True, "message": resp.text}
                
        except Exception as e:
            print(f"   ❌ Exceção envio anexo: {e}")
            raise e
    def alterar_beneficiaria(self, dados_alteracao: dict):
        """
        Realiza a alteração de beneficiárias de Geração Distribuída.
        Endpoint: AlteracaoBeneficiaria
        """
        # Validação básica dos dados obrigatórios
        required_fields = ['codigoEmpresaWeb', 'cdc', 'digitoVerificador', 'percentualCompensacao']
        # Verifica se percentualCompensacao está nos dados ou na query string implícita
        # O endpoint parece exigir isso na URL também, vamos garantir
        
        try:
            empresa = int(dados_alteracao.get('codigoEmpresaWeb', 6))
            cdc = int(dados_alteracao.get('cdc'))
            digito = int(dados_alteracao.get('digitoVerificador'))
            # O percentual de compensação geralmente é 100 para o gerador, mas pode variar
            percentual = int(dados_alteracao.get('percentualCompensacao', 100)) 
        except (ValueError, TypeError):
            return {"errored": True, "message": "Dados da UC inválidos (devem ser numéricos)."}

        # Monta a URL com os parâmetros de Query String (conforme seu exemplo)
        url = (f"{self.base_url}/api/clientes/Gd/AlteracaoBeneficiaria"
               f"?CodigoEmpresaWeb={empresa}&Cdc={cdc}&DigitoVerificador={digito}&PercentualCompensacao={percentual}")

        # Prepara o Payload (Corpo da Requisição)
        # Injetamos os tokens de autenticação dentro do JSON, como nos outros métodos
        payload = dados_alteracao.copy()
        tokens = self._get_tokens_payload()
        
        # Adiciona/Sobrescreve os tokens no payload
        payload.update({
            "ate": tokens.get('ate', ''),
            "udk": tokens.get('udk', ''),
            "utk": tokens.get('utk', ''),
            "refreshToken": tokens.get('refreshToken', ''),
            "retk": tokens.get('retk', '')
        })

        # Remove campos que talvez não devam ir no corpo se já foram na URL (opcional, mas seguro manter)
        # A API da Energisa costuma aceitar redundância.

        headers = self._get_headers()
        # Esse endpoint geralmente é sensível, vamos adicionar o Referer correto
        headers["Referer"] = f"{self.base_url}/servicos/geracao-distribuida/alteracao-beneficiaria"

        print(f"   ⚡ Solicitando alteração de beneficiária para UC {cdc}...")

        try:
            resp = self.session.post(url, json=payload, headers=headers)

            # Lógica de Retry para 401 (Token Expirado)
            if resp.status_code == 401:
                print("   ⚠️ 401 na Alteração de Beneficiária. Renovando token...")
                if self._refresh_token():
                    # Atualiza os tokens no payload e tenta novamente
                    tokens = self._get_tokens_payload()
                    payload.update({
                        "ate": tokens.get('ate', ''),
                        "udk": tokens.get('udk', ''),
                        "utk": tokens.get('utk', ''),
                        "refreshToken": tokens.get('refreshToken', '')
                    })
                    resp = self.session.post(url, json=payload, headers=headers)

            if resp.status_code == 200:
                return resp.json()
            else:
                print(f"   ❌ Erro Alteração Beneficiária: {resp.status_code} - {resp.text[:200]}")
                # Tenta retornar o erro formatado se for JSON
                try: return resp.json()
                except: return {"errored": True, "message": f"Erro HTTP {resp.status_code}", "details": resp.text}

        except Exception as e:
            print(f"   ❌ Exceção Alteração Beneficiária: {e}")
            return {"errored": True, "message": str(e)}

    def adicionar_gerente_get(self, dados: dict):
        """
        Executa o GET de preparação para 'Adicionar Gerente'.
        Essa rota é importante para atualizar cookies de segurança (Akamai) e validar a sessão.
        """
        try:
            empresa = int(dados.get('codigoEmpresaWeb', 6))
            cdc = int(dados.get('cdc'))
            digito = int(dados.get('digitoVerificador'))
            cpf_cliente = dados.get('numeroCpfCnpjCliente') or self.cpf # Usa o da sessão se não vier
            descricao = dados.get('descricaoComplementarImovel', '')
            data_acesso = dados.get('dataUltimoAcesso', '') # Se vazio, manda vazio ou string data
        except:
            return {"errored": True, "message": "Dados inválidos para contexto gerente."}

        # Endpoint GET
        url = f"{self.base_url}/gerenciar-imoveis/adicionar-gerente"
        
        # Parâmetros da URL
        params = {
            "numeroCpfCnpjCliente": cpf_cliente,
            "cdc": cdc,
            "codigoEmpresaWeb": empresa,
            "digitoVerificador": digito,
            "descricaoComplementarImovel": descricao,
            "dataUltimoAcesso": data_acesso
        }

        headers = self._get_headers(json_content=False)
        headers["Referer"] = f"{self.base_url}/home"

        print(f"\n{'='*70}")
        print(f"[SERVICE] adicionar_gerente_get - Chamando Energisa")
        print(f"{'='*70}")
        print(f"URL: {url}")
        print(f"Params: {params}")
        print(f"Headers: {dict(list(headers.items())[:5])}...")  # Mostra alguns headers
        print(f"{'='*70}\n")

        try:
            # GET REQUEST
            resp = self.session.get(url, params=params, headers=headers)

            print(f"[SERVICE] Resposta da Energisa:")
            print(f"Status Code: {resp.status_code}")
            print(f"Response (primeiros 300 chars): {resp.text[:300]}")
            print(f"{'='*70}\n")
            
            # Verifica e salva os novos cookies recebidos (bm_sz, bm_sv)
            if resp.cookies:
                self._apply_cookies(resp.cookies.get_dict())
                SessionManager.save_session(self.cpf, self.cookies)
                print("   ✅ Cookies atualizados com sucesso.")

            # Como é um GET de navegação, o sucesso geralmente é 200
            if resp.status_code == 200:
                return {
                    "status": "success", 
                    "message": "Contexto definido e cookies atualizados.",
                    "http_code": 200
                }
            
            # Se der 401, tenta refresh
            if resp.status_code == 401 and self._refresh_token():
                 return self.adicionar_gerente_get(dados)

            return {"errored": True, "status": resp.status_code, "message": "Falha na requisição GET"}

        except Exception as e:
            print(f"   ❌ Erro adicionar_gerente_get: {e}")
            return {"errored": True, "message": str(e)}
    
    # Adicione este método na classe EnergisaService, logo após o adicionar_gerente_get
    
    def autorizacao_pendente_get(self, dados: dict):
        """
        Executa a rota GET /gerenciar-imoveis/autorizacao-pendente.
        Geralmente usada para confirmar vinculações ou aceitar convites de gestão.
        """
        try:
            empresa = int(dados.get('codigoEmpresaWeb', 6))
            # Mapeia unidadeConsumidora ou cdc para o parametro da URL
            uc = int(dados.get('unidadeConsumidora') or dados.get('cdc'))
            codigo = int(dados.get('codigo'))
        except (ValueError, TypeError):
            return {"errored": True, "message": "Dados inválidos. Campos obrigatórios: codigoEmpresaWeb, unidadeConsumidora (ou cdc) e codigo."}

        # Endpoint
        url = f"{self.base_url}/gerenciar-imoveis/autorizacao-pendente"
        
        # Parâmetros da Query String
        params = {
            "codigoEmpresaWeb": empresa,
            "unidadeConsumidora": uc,
            "codigo": codigo
        }

        # Headers (simulando navegação real para aceitar HTML)
        headers = self._get_headers(json_content=False)
        headers.update({
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Referer": f"{self.base_url}/home"
        })

        print(f"\n{'='*70}")
        print(f"[SERVICE] autorizacao_pendente_get - Chamando Energisa")
        print(f"{'='*70}")
        print(f"URL: {url}")
        print(f"Params: {params}")
        print(f"Headers: {dict(list(headers.items())[:5])}...")  # Mostra alguns headers
        print(f"{'='*70}\n")

        try:
            # GET REQUEST
            resp = self.session.get(url, params=params, headers=headers)

            print(f"[SERVICE] Resposta da Energisa:")
            print(f"Status Code: {resp.status_code}")
            print(f"Response (primeiros 300 chars): {resp.text[:300]}")
            print(f"{'='*70}\n")
            
            # Verifica e salva cookies de sessão atualizados (crucial para manter o login vivo)
            if resp.cookies:
                self._apply_cookies(resp.cookies.get_dict())
                SessionManager.save_session(self.cpf, self.cookies)

            if resp.status_code == 200:
                return {
                    "status": "success", 
                    "message": "Requisição de autorização realizada com sucesso.",
                    "http_code": 200,
                    # Se quiser, pode retornar o HTML ou verificar se deu certo via texto
                    # "html_preview": resp.text[:100] 
                }
            
            # Retry automático se o token expirou (401)
            if resp.status_code == 401 and self._refresh_token():
                 return self.autorizacao_pendente_get(dados)

            return {"errored": True, "status": resp.status_code, "message": f"Falha na requisição: {resp.text[:200]}"}

        except Exception as e:
            print(f"   ❌ Erro autorizacao_pendente_get: {e}")
            return {"errored": True, "message": str(e)}
    def _get_build_id(self):
        """Busca o identificador da versão atual do site (necessário para rotas _next)"""
        if hasattr(self, '_cached_build_id'):
            return self._cached_build_id

        print("   🔍 Buscando buildId do Next.js...")
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        }
        
        # Tenta buscar em rotas públicas primeiro (Login ou Home)
        urls_to_try = [f"{self.base_url}/login", f"{self.base_url}/home"]
        
        for url in urls_to_try:
            try:
                resp = self.session.get(url, headers=headers, timeout=10)
                if resp.status_code == 200:
                    match = re.search(r'"buildId"\s*:\s*"([^"]+)"', resp.text)
                    if match:
                        bid = match.group(1)
                        self._cached_build_id = bid
                        print(f"   ✅ BuildId encontrado em {url}: {bid}")
                        return bid
            except Exception as e:
                print(f"   ⚠️ Erro ao buscar buildId em {url}: {e}")
            
        return None

    def get_login_options(self):
        """
        Busca as opções de contato (Telefone/Email) para o CPF informado.
        Usa a API interna do Next.js da Energisa.
        """
        build_id = self._get_build_id()
        if not build_id:
            raise Exception("Não foi possível obter o BuildId da aplicação Energisa.")

        # Monta a URL do JSON de dados da página de seleção
        url = f"{self.base_url}/_next/data/{build_id}/login/selecionar-numero.json"

        # IMPORTANTE: Define o cookie do CPF para o servidor saber quem somos
        self.session.cookies.set("cpf", self.cpf)

        headers = self._get_headers(json_content=False)
        headers.update({
            "Accept": "*/*",
            "x-nextjs-data": "1"
        })

        print(f"   📋 Buscando opções de login para CPF {self.cpf}...")
        
        try:
            resp = self.session.get(url, headers=headers)
            
            if resp.status_code == 200:
                data = resp.json()
                page_props = data.get("pageProps", {}).get("data", {})
                
                return {
                    "listaTelefone": page_props.get("listaTelefone", []),
                    "listaEmail": page_props.get("listaEmail", []),
                    "dadosUsuario": page_props.get("dadosUsuario", {})
                }
            else:
                # Se falhar, tenta verificar se não é um redirecionamento ou erro de cookie
                print(f"   ❌ Erro ao buscar opções: {resp.status_code} - {resp.text[:100]}")
                raise Exception(f"Falha ao obter opções de login. HTTP {resp.status_code}")
                
        except Exception as e:
            raise Exception(f"Erro na requisição de opções: {str(e)}")
    
    def listar_faturas_ssr(self, uc_data: dict):
        """
        Nova rota GET via SSR (Server Side Rendering) para buscar faturas.
        Não interfere no método listar_faturas padrão.
        """
        try:
            # 1. Preparar dados
            cdc = uc_data.get('cdc')
            digito = uc_data.get('digitoVerificadorCdc')
            empresa = uc_data.get('codigoEmpresaWeb', 6)
            grupoleitura = uc_data.get('grupoLeitura', 'B')  # Hardcoded conforme seu exemplo
            
            # 2. Obter Build ID (Necessário para montar a URL do Next.js)
            build_id = self._get_build_id()
            if not build_id:
                return {"errored": True, "message": "Não foi possível obter o Build ID"}

            # 3. Montar URL
            # Ex: https://servicos.energisa.com.br/_next/data/{build_id}/login/login-faturas-ssr.json
            url = f"{self.base_url}/_next/data/{build_id}/login/login-faturas-ssr.json"

            # 4. Configurar Cookies Obrigatórios para esta requisição
            # O servidor valida se o cookie bate com a UC solicitada
            self.session.cookies.set("NumeroUc", str(cdc))
            self.session.cookies.set("Digito", str(digito))
            self.session.cookies.set("CodigoEmpresaWeb", str(empresa))

            # 5. Parâmetros da URL (Query String)
            params = {
                "codigoEmpresaWeb": empresa,
                "numeroCdc": cdc,           # Atenção: aqui usa 'numeroCdc'
                "digitoVerificador": digito,
                "GrupoLeitura": grupoleitura,        # Hardcoded conforme seu exemplo
                "Redirect": ""
            }

            # 6. Headers Específicos
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Referer": f"{self.base_url}/login",
                "x-nextjs-data": "1" # Importante para indicar chamada de dados do Next
            }

            print(f"   🚀 [SSR] Buscando faturas (Novo GET): UC {cdc}")
            
            # Requisição GET
            resp = self.session.get(url, params=params, headers=headers)

            if resp.status_code == 200:
                data = resp.json()
                
                # O retorno tem a estrutura: pageProps -> dadosServerSide -> faturas
                page_props = data.get("pageProps", {})
                dados_server = page_props.get("dadosServerSide", {})
                
                if dados_server.get("errored"):
                    return {"errored": True, "message": dados_server.get("mensagem")}
                
                dados_usuario = dados_server.get("dadosUsuario", [])
                print(f"   ✅ [SSR] Sucesso! {len(dados_usuario)} faturas encontradas.")
                return data
            else:
                print(f"   ❌ [SSR] Erro: HTTP {resp.status_code}")
                return {"errored": True, "status": resp.status_code, "content": resp.text[:200]}

        except Exception as e:
            print(f"   ❌ [SSR] Exceção: {str(e)}")
            return {"errored": True, "message": str(e)}
    

    