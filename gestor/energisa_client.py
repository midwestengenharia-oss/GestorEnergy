import requests
import os

class EnergisaGatewayClient:
    def __init__(self, base_url=os.getenv("GATEWAY_URL", "http://localhost:3000")):
        self.base_url = base_url
        self.token = None
        self.client_id = "7966649d-d20a-4129-afbd-341f51aa74d6" 
        self.client_secret = os.getenv("CRM_SECRET", "cnOOJJCg8VK3W11xOo6vhaHd4RNTP-ALT06#cs#I")

    def authenticate(self):
        try:
            resp = requests.post(f"{self.base_url}/api/token", json={
                "client_id": self.client_id,
                "client_secret": self.client_secret
            })
            if resp.status_code == 200:
                self.token = resp.json()["access_token"]
                return True
            print(f"Falha autenticação Gateway: {resp.text}")
            return False
        except Exception as e:
            print(f"Erro conexão Gateway: {e}")
            return False

    def _get_headers(self):
        if not self.token:
            self.authenticate()
        return {"Authorization": f"Bearer {self.token}"}

    

    def start_login(self, cpf, final_tel):
        resp = requests.post(
            f"{self.base_url}/auth/login/start",
            json={"cpf": cpf, "final_telefone": final_tel},
            headers=self._get_headers()
        )
        return resp.json()

    def finish_login(self, cpf, transaction_id, sms_code):
        resp = requests.post(
            f"{self.base_url}/auth/login/finish",
            json={"cpf": cpf, "transaction_id": transaction_id, "sms_code": sms_code},
            headers=self._get_headers()
        )
        return resp.json()

    def list_ucs(self, cpf):
        resp = requests.post(
            f"{self.base_url}/ucs",
            json={"cpf": cpf},
            headers=self._get_headers()
        )
        return resp.json()
        
    def _get_digito(self, uc_data):
        # Procura por qualquer variação do nome do campo
        chaves_possiveis = ['digitoVerificadorCdc', 'digitoVerificador', 'digito_verificador', 'digito']
        
        for chave in chaves_possiveis:
            if chave in uc_data and uc_data[chave] is not None:
                return uc_data[chave]
        
        # Se não achar nada, retorna 0 (padrão seguro)
        return 0

    def list_faturas(self, cpf, uc_data):
        payload = {
            "cpf": cpf,
            "cdc": uc_data['cdc'],
            "codigoEmpresaWeb": uc_data['empresa_web'],
            "digitoVerificadorCdc": self._get_digito(uc_data) # <--- CORREÇÃO AQUI
        }
        resp = requests.post(
            f"{self.base_url}/faturas/listar",
            json=payload,
            headers=self._get_headers()
        )
        if resp.status_code == 200:
            return resp.json()
        return [] 

    def download_fatura(self, cpf, uc_data, fatura_data):
        payload = {
            "cpf": cpf,
            "cdc": uc_data['cdc'],
            "codigoEmpresaWeb": uc_data['empresa_web'],
            "digitoVerificadorCdc": self._get_digito(uc_data), # <--- CORREÇÃO AQUI
            "ano": fatura_data['ano'],
            "mes": fatura_data['mes'],
            "numeroFatura": fatura_data['numero_fatura']
        }
        resp = requests.post(
            f"{self.base_url}/faturas/pdf",
            json=payload,
            headers=self._get_headers()
        )
        if resp.status_code == 200:
            return resp.json()
        return None

    def get_gd_info(self, cpf, uc_data):
        payload = {
            "cpf": cpf,
            "cdc": uc_data['cdc'],
            "codigoEmpresaWeb": uc_data['empresa_web'],
            "digitoVerificadorCdc": self._get_digito(uc_data) # <--- CORREÇÃO AQUI
        }
        resp = requests.post(
            f"{self.base_url}/gd/info",
            json=payload,
            headers=self._get_headers()
        )
        if resp.status_code == 200:
            return resp.json()
        return None

    def get_gd_details(self, cpf, uc_data):
        """
        Obtém detalhes completos de Geração Distribuída (histórico mensal).
        Retorna dados de produção, transferências, saldo e composição.
        """
        payload = {
            "cpf": cpf,
            "cdc": uc_data['cdc'],
            "codigoEmpresaWeb": uc_data['empresa_web'],
            "digitoVerificadorCdc": self._get_digito(uc_data)
        }
        resp = requests.post(
            f"{self.base_url}/gd/details",
            json=payload,
            headers=self._get_headers()
        )
        if resp.status_code == 200:
            return resp.json()
        return None

    def adicionar_gerente(self, cpf, dados):
        """
        Adiciona um gestor a uma UC (quando o usuario e proprietario).
        Chama o endpoint /imoveis/gerente/contexto do gateway.
        """
        payload = {
            "cpf": cpf,
            "codigoEmpresaWeb": dados.get('codigoEmpresaWeb', 6),
            "cdc": dados['cdc'],
            "digitoVerificador": dados['digitoVerificador'],
            "numeroCpfCnpjCliente": dados.get('numeroCpfCnpjCliente')
        }

        url = f"{self.base_url}/imoveis/gerente/contexto"
        print(f"\n[EnergisaClient] Adicionar Gerente")
        print(f"URL: {url}")
        print(f"Payload: {payload}")

        resp = requests.post(url, json=payload, headers=self._get_headers())

        print(f"Status Code: {resp.status_code}")
        print(f"Response: {resp.text[:500]}\n")

        if resp.status_code == 200:
            return resp.json()
        raise Exception(f"Erro ao adicionar gerente: {resp.text}")

    def autorizacao_pendente(self, cpf, dados):
        """
        Valida codigo de autorizacao pendente (quando o usuario nao e proprietario).
        Chama o endpoint /imoveis/autorizacao-pendente do gateway.
        """
        payload = {
            "cpf": cpf,
            "codigoEmpresaWeb": dados.get('codigoEmpresaWeb', 6),
            "unidadeConsumidora": dados['unidadeConsumidora'],
            "codigo": dados['codigo']
        }

        url = f"{self.base_url}/imoveis/autorizacao-pendente"
        print(f"\n[EnergisaClient] Autorizacao Pendente")
        print(f"URL: {url}")
        print(f"Payload: {payload}")

        resp = requests.post(url, json=payload, headers=self._get_headers())

        print(f"Status Code: {resp.status_code}")
        print(f"Response: {resp.text[:500]}\n")

        if resp.status_code == 200:
            return resp.json()
        raise Exception(f"Erro ao validar autorizacao: {resp.text}")