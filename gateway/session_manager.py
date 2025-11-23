import json
import time
from pathlib import Path

# Define a pasta onde os arquivos ficarão
SESSION_DIR = Path("sessions")
SESSION_DIR.mkdir(exist_ok=True)

class SessionManager:
    @staticmethod
    def get_session_path(cpf: str) -> Path:
        # Garante que o CPF seja apenas números no nome do arquivo
        cpf_clean = cpf.replace(".", "").replace("-", "")
        return SESSION_DIR / f"{cpf_clean}.json"

    @staticmethod
    def save_session(cpf: str, cookies: dict):
        data = {
            "cookies": cookies,
            "timestamp": time.time()
        }
        arquivo = SessionManager.get_session_path(cpf)
        with open(arquivo, 'w') as f:
            json.dump(data, f, indent=2)
        print(f"💾 Sessão salva em: {arquivo}")

    @staticmethod
    def load_session(cpf: str):
        arquivo = SessionManager.get_session_path(cpf)
        
        if not arquivo.exists():
            print(f"⚠️ Arquivo de sessão não encontrado: {arquivo}")
            return None
        
        try:
            with open(arquivo, 'r') as f:
                data = json.load(f)
            
            saved_time = data.get("timestamp", 0)
            current_time = time.time()
            age = current_time - saved_time
            
            # 24 horas em segundos
            MAX_AGE = 86400 
            
            print(f"🔍 Verificando sessão para {cpf}:")
            print(f"   📅 Criada em: {time.ctime(saved_time)}")
            print(f"   ⏱️ Idade: {age:.1f} segundos (Máx: {MAX_AGE}s)")
            
            if age > MAX_AGE:
                print("   ❌ Sessão expirada!")
                return None
                
            print("   ✅ Sessão válida (pelo horário).")
            return data.get("cookies")
        except Exception as e:
            print(f"   ❌ Erro ao ler sessão: {e}")
            return None