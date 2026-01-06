"""
Debug Router - Endpoints de diagnóstico e documentação da API

ATENÇÃO: Endpoints sensíveis, apenas para superadmin
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from backend.core.security import get_current_active_user, CurrentUser
from backend.debug.sampler import capturar_amostras_api

router = APIRouter()


class CaptureRequest(BaseModel):
    """Request para captura de amostras"""
    cpf: str
    salvar_arquivo: Optional[bool] = False


class CaptureResponse(BaseModel):
    """Response da captura de amostras"""
    success: bool
    message: str
    data: Optional[dict] = None


@router.post("/capture-api-samples", summary="Capturar amostras das APIs Energisa")
async def capture_api_samples(
    req: CaptureRequest,
    current_user: CurrentUser = Depends(get_current_active_user)
):
    """
    Captura amostras representativas de cada tipo de UC para documentação.
    
    **REQUER: Usuário superadmin**
    
    Classifica UCs por:
    - Tipo de GD: sem_gd, gd_beneficiaria, gd_geradora
    - Tipo de ligação: monofasico, bifasico, trifasico
    
    Captura para cada categoria:
    - UC raw (dados básicos)
    - UC info (dados cadastrais)
    - GD info (se aplicável)
    - GD details (histórico de créditos, se GD)
    - Faturas (lista + 1 exemplo)
    
    **Dados sensíveis são removidos automaticamente.**
    """
    
    # Verifica se é superadmin
    if current_user.perfil != "superadmin":
        raise HTTPException(
            status_code=403, 
            detail="Apenas superadmin pode executar captura de amostras"
        )
    
    try:
        cpf_clean = req.cpf.replace(".", "").replace("-", "")
        
        print(f"🔍 Iniciando captura de amostras para CPF ***{cpf_clean[3:6]}***")
        
        resultado = capturar_amostras_api(cpf_clean)
        
        # Salvar em arquivo se solicitado
        if req.salvar_arquivo:
            import json
            import os
            
            # Cria diretório se não existir
            samples_dir = "docs/api-samples"
            os.makedirs(samples_dir, exist_ok=True)
            
            # Nome do arquivo com timestamp
            timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
            filename = f"{samples_dir}/amostras_{timestamp}.json"
            
            with open(filename, "w", encoding="utf-8") as f:
                json.dump(resultado, f, ensure_ascii=False, indent=2)
            
            resultado["arquivo_salvo"] = filename
            print(f"   💾 Amostras salvas em: {filename}")
        
        return {
            "success": True,
            "message": f"Capturadas {resultado.get('amostras_capturadas', 0)} amostras de {resultado.get('total_ucs_encontradas', 0)} UCs",
            "data": resultado
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api-samples-status", summary="Status das amostras capturadas")
async def get_samples_status(
    current_user: CurrentUser = Depends(get_current_active_user)
):
    """
    Retorna status das amostras já capturadas.
    
    Lista arquivos existentes em docs/api-samples/
    """
    
    if current_user.perfil != "superadmin":
        raise HTTPException(status_code=403, detail="Apenas superadmin")
    
    import os
    import glob
    
    samples_dir = "docs/api-samples"
    
    if not os.path.exists(samples_dir):
        return {
            "existe_diretorio": False,
            "arquivos": [],
            "total": 0
        }
    
    arquivos = glob.glob(f"{samples_dir}/*.json")
    
    info_arquivos = []
    for arq in arquivos:
        stat = os.stat(arq)
        info_arquivos.append({
            "nome": os.path.basename(arq),
            "tamanho_kb": round(stat.st_size / 1024, 2),
            "modificado_em": datetime.fromtimestamp(stat.st_mtime).isoformat()
        })
    
    # Ordena por data de modificação (mais recente primeiro)
    info_arquivos.sort(key=lambda x: x["modificado_em"], reverse=True)
    
    return {
        "existe_diretorio": True,
        "arquivos": info_arquivos,
        "total": len(info_arquivos)
    }


@router.get("/session-status/{cpf}", summary="Verificar status da sessão Energisa")
async def check_session_status(
    cpf: str,
    current_user: CurrentUser = Depends(get_current_active_user)
):
    """
    Verifica se existe sessão válida para o CPF na Energisa.
    
    Útil para diagnóstico antes de capturar amostras.
    """
    
    if current_user.perfil != "superadmin":
        raise HTTPException(status_code=403, detail="Apenas superadmin")
    
    from backend.energisa.service import EnergisaService
    from backend.energisa.session_manager import SessionManager
    
    cpf_clean = cpf.replace(".", "").replace("-", "")
    
    # Verifica sessão no banco
    session_exists = SessionManager.session_exists(cpf_clean)
    
    # Verifica se está autenticado
    service = EnergisaService(cpf_clean)
    is_authenticated = service.is_authenticated()
    
    return {
        "cpf_masked": f"***{cpf_clean[3:6]}***{cpf_clean[-2:]}",
        "sessao_existe": session_exists,
        "autenticado": is_authenticated,
        "pode_capturar": is_authenticated
    }
