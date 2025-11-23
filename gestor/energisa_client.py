import requests
import os

class EnergisaGatewayClient:
    # Pega o URL do ambiente ou usa localhost como fallback
    def __init__(self, base_url=os.getenv("GATEWAY_URL", "http://localhost:3000")): 
        self.base_url = base_url
        self.token = None
        # Credenciais definidas no seu main.py original (CLIENTS_DB)
        self.client_id = "7966649d-d20a-4129-afbd-341f51aa74d6" 
        self.client_secret = os.getenv("CRM_SECRET", "cnOOJJCg8VK3W11xOo6vhaHd4RNTP-ALT06#cs#I")

    def authenticate(self):
        """Obtém o Token Bearer da sua API Gateway"""
        resp = requests.post(f"{self.base_url}/api/token", json={
            "client_id": self.client_id,
            "client_secret": self.client_secret
        })
        if resp.status_code == 200:
            self.token = resp.json()["access_token"]
            return True
        return False

    def _get_headers(self):
        if not self.token:
            self.authenticate()
        return {"Authorization": f"Bearer {self.token}"}

    def start_login(self, cpf, final_tel):
        """Inicia o processo e pede SMS"""
        resp = requests.post(
            f"{self.base_url}/auth/login/start",
            json={"cpf": cpf, "final_telefone": final_tel},
            headers=self._get_headers()
        )
        return resp.json() # Retorna transaction_id

    def finish_login(self, cpf, transaction_id, sms_code):
        """Envia o SMS para finalizar"""
        resp = requests.post(
            f"{self.base_url}/auth/login/finish",
            json={"cpf": cpf, "transaction_id": transaction_id, "sms_code": sms_code},
            headers=self._get_headers()
        )
        return resp.json()

    def list_ucs(self, cpf):
        """Busca UCs da API Gateway"""
        resp = requests.post(
            f"{self.base_url}/ucs",
            json={"cpf": cpf},
            headers=self._get_headers()
        )
        return resp.json()

    def list_faturas(self, cpf, uc_data):
        """Busca faturas de uma UC específica"""
        payload = {
            "cpf": cpf,
            "cdc": uc_data['cdc'],
            "codigoEmpresaWeb": uc_data['empresa_web'],
            "digitoVerificadorCdc": uc_data['digito_verificador']
        }
        resp = requests.post(
            f"{self.base_url}/faturas/listar",
            json=payload,
            headers=self._get_headers()
        )
        return resp.json()

    def download_fatura(self, cpf, uc_data, fatura_data):
        """Baixa o PDF e retorna em Base64"""
        payload = {
            "cpf": cpf,
            "cdc": uc_data['cdc'],
            "codigoEmpresaWeb": uc_data['empresa_web'],
            "digitoVerificadorCdc": uc_data['digito_verificador'],
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
            return resp.json() # {filename, file_base64}
        return None
    # Adicione este método na classe EnergisaGatewayClient
    def get_gd_info(self, cpf, uc_data):
        """Busca dados detalhados de Geração Distribuída"""
        payload = {
            "cpf": cpf,
            "cdc": uc_data['cdc'],
            "codigoEmpresaWeb": uc_data['empresa_web'],
            "digitoVerificadorCdc": uc_data['digito_verificador']
        }
        resp = requests.post(
            f"{self.base_url}/gd/info", # Endpoint do Gateway
            json=payload,
            headers=self._get_headers()
        )
        if resp.status_code == 200:
            return resp.json()
        return None