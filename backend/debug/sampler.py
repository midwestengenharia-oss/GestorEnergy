"""
API Sampler - Lógica de seleção inteligente de amostras da API Energisa

Classifica UCs por tipo e seleciona amostras representativas para documentação.
"""

from typing import Dict, List, Optional, Any
from datetime import datetime
from backend.energisa.service import EnergisaService


class EnergisaSampler:
    """
    Captura amostras representativas das APIs da Energisa.
    
    Objetivo: Documentar retornos reais sem baixar todos os dados.
    """
    
    # Categorias que queremos amostras
    CATEGORIAS_DESEJADAS = [
        "sem_gd_monofasico",
        "sem_gd_bifasico",
        "sem_gd_trifasico",
        "gd_beneficiaria_monofasico",
        "gd_beneficiaria_bifasico",
        "gd_beneficiaria_trifasico",
        "gd_geradora_monofasico",
        "gd_geradora_bifasico",
        "gd_geradora_trifasico",
    ]
    
    def __init__(self, cpf: str):
        self.cpf = cpf.replace(".", "").replace("-", "")
        self.service = EnergisaService(self.cpf)
        self.amostras: Dict[str, Any] = {}
        self.erros: List[str] = []
        
    def _classificar_uc(self, uc: dict, uc_info: Optional[dict]) -> str:
        """
        Classifica uma UC baseado em suas características.
        
        Returns:
            String identificando a categoria (ex: "gd_beneficiaria_bifasico")
        """
        # Determina tipo de GD
        is_gd = uc.get("isGD", False)
        gd_info = uc.get("gdInfo", {})
        
        if not is_gd:
            tipo_gd = "sem_gd"
        elif gd_info and gd_info.get("ucGeradora"):
            tipo_gd = "gd_geradora"
        else:
            tipo_gd = "gd_beneficiaria"
        
        # Determina tipo de ligação
        tipo_ligacao = "bifasico"  # default
        
        if uc_info and not uc_info.get("errored"):
            infos = uc_info.get("infos", {})
            dados_instalacao = infos.get("dadosInstalacao", {})
            tipo_raw = dados_instalacao.get("tipoLigacao", "").upper()
            
            if "MONO" in tipo_raw:
                tipo_ligacao = "monofasico"
            elif "TRI" in tipo_raw:
                tipo_ligacao = "trifasico"
            else:
                tipo_ligacao = "bifasico"
        
        return f"{tipo_gd}_{tipo_ligacao}"
    
    def _sanitizar_dados(self, dados: Any) -> Any:
        """
        Remove dados sensíveis e muito grandes (base64, tokens, etc).
        """
        if dados is None:
            return None
            
        if isinstance(dados, dict):
            sanitizado = {}
            for key, value in dados.items():
                # Remove campos sensíveis
                key_lower = key.lower()
                if any(s in key_lower for s in ["token", "senha", "password", "secret", "base64", "ate", "udk", "utk", "rtk"]):
                    sanitizado[key] = "[REMOVIDO]"
                # Trunca strings muito grandes (provavelmente base64)
                elif isinstance(value, str) and len(value) > 1000:
                    sanitizado[key] = f"[STRING_TRUNCADA: {len(value)} chars]"
                else:
                    sanitizado[key] = self._sanitizar_dados(value)
            return sanitizado
            
        if isinstance(dados, list):
            return [self._sanitizar_dados(item) for item in dados]
            
        return dados
    
    def _capturar_dados_uc(self, uc: dict) -> Dict[str, Any]:
        """
        Captura todos os dados de uma UC específica.
        """
        numero_uc = uc.get("numeroUc")
        digito = uc.get("digitoVerificador")
        empresa = uc.get("codigoEmpresaWeb", 6)
        
        uc_data = {
            "cdc": numero_uc,
            "digitoVerificadorCdc": digito,
            "codigoEmpresaWeb": empresa
        }
        
        resultado = {
            "uc_raw": self._sanitizar_dados(uc),
            "uc_info": None,
            "gd_info": None,
            "gd_details": None,
            "faturas": None,
            "fatura_exemplo": None,
            "erros": []
        }
        
        # 1. UC Info
        try:
            uc_info = self.service.get_uc_info(uc_data)
            resultado["uc_info"] = self._sanitizar_dados(uc_info)
        except Exception as e:
            resultado["erros"].append(f"uc_info: {str(e)}")
        
        # 2. GD Info
        try:
            gd_info = self.service.get_gd_info(uc_data)
            resultado["gd_info"] = self._sanitizar_dados(gd_info)
        except Exception as e:
            resultado["erros"].append(f"gd_info: {str(e)}")
        
        # 3. GD Details (se tiver GD)
        if uc.get("isGD"):
            try:
                gd_details = self.service.get_gd_details(uc_data)
                resultado["gd_details"] = self._sanitizar_dados(gd_details)
            except Exception as e:
                resultado["erros"].append(f"gd_details: {str(e)}")
        
        # 4. Faturas (apenas lista, sem PDF)
        try:
            faturas = self.service.listar_faturas(uc_data)
            if faturas:
                # Pega só as 3 mais recentes como exemplo
                faturas_exemplo = faturas[:3] if len(faturas) > 3 else faturas
                resultado["faturas"] = {
                    "total": len(faturas),
                    "exemplos": self._sanitizar_dados(faturas_exemplo)
                }
                # Primeira fatura como exemplo completo
                resultado["fatura_exemplo"] = self._sanitizar_dados(faturas[0]) if faturas else None
        except Exception as e:
            resultado["erros"].append(f"faturas: {str(e)}")
        
        return resultado
    
    def capturar_amostras(self, max_por_categoria: int = 1) -> Dict[str, Any]:
        """
        Executa a captura inteligente de amostras.
        
        Args:
            max_por_categoria: Máximo de amostras por categoria (default: 1)
            
        Returns:
            Dict com todas as amostras organizadas por categoria
        """
        inicio = datetime.now()
        
        resultado_final = {
            "capturado_em": inicio.isoformat(),
            "cpf_masked": f"***{self.cpf[3:6]}***{self.cpf[-2:]}",
            "total_ucs_encontradas": 0,
            "categorias_encontradas": [],
            "categorias_faltando": [],
            "amostras_capturadas": 0,
            "amostras": {},
            "erros_globais": []
        }
        
        # Verifica autenticação
        if not self.service.is_authenticated():
            resultado_final["erros_globais"].append("Não autenticado na Energisa")
            return resultado_final
        
        # 1. Lista todas as UCs (com enriquecimento de GD)
        try:
            todas_ucs = self.service.listar_ucs(enriquecer_gd=True)
            resultado_final["total_ucs_encontradas"] = len(todas_ucs)
        except Exception as e:
            resultado_final["erros_globais"].append(f"Erro ao listar UCs: {str(e)}")
            return resultado_final
        
        # 2. Classifica e seleciona amostras
        categorias_preenchidas = set()
        ucs_por_categoria: Dict[str, List[dict]] = {}
        
        for uc in todas_ucs:
            # Pega UC info para classificar tipo de ligação
            uc_data = {
                "cdc": uc.get("numeroUc"),
                "digitoVerificadorCdc": uc.get("digitoVerificador"),
                "codigoEmpresaWeb": uc.get("codigoEmpresaWeb", 6)
            }
            
            try:
                uc_info = self.service.get_uc_info(uc_data)
            except:
                uc_info = None
            
            categoria = self._classificar_uc(uc, uc_info)
            
            if categoria not in ucs_por_categoria:
                ucs_por_categoria[categoria] = []
            
            # Armazena UC com seu info já capturado
            ucs_por_categoria[categoria].append({
                "uc": uc,
                "uc_info": uc_info
            })
        
        # 3. Captura dados completos de 1 UC de cada categoria
        for categoria, ucs_lista in ucs_por_categoria.items():
            if len(ucs_lista) == 0:
                continue
                
            # Pega a primeira UC da categoria
            uc_selecionada = ucs_lista[0]
            uc = uc_selecionada["uc"]
            
            print(f"   📸 Capturando amostra: {categoria} (UC {uc.get('numeroUc')})")
            
            try:
                dados_completos = self._capturar_dados_uc(uc)
                # Usa o uc_info já capturado na classificação
                if uc_selecionada.get("uc_info") and not dados_completos.get("uc_info"):
                    dados_completos["uc_info"] = self._sanitizar_dados(uc_selecionada["uc_info"])
                
                resultado_final["amostras"][categoria] = dados_completos
                categorias_preenchidas.add(categoria)
                resultado_final["amostras_capturadas"] += 1
                
            except Exception as e:
                resultado_final["erros_globais"].append(f"Erro capturando {categoria}: {str(e)}")
        
        # 4. Resumo final
        resultado_final["categorias_encontradas"] = list(categorias_preenchidas)
        resultado_final["categorias_faltando"] = [
            cat for cat in self.CATEGORIAS_DESEJADAS 
            if cat not in categorias_preenchidas
        ]
        
        fim = datetime.now()
        resultado_final["tempo_execucao_segundos"] = (fim - inicio).total_seconds()
        
        return resultado_final


def capturar_amostras_api(cpf: str) -> Dict[str, Any]:
    """
    Função helper para chamar a captura de amostras.
    
    Args:
        cpf: CPF do usuário autenticado na Energisa
        
    Returns:
        Dict com amostras capturadas
    """
    sampler = EnergisaSampler(cpf)
    return sampler.capturar_amostras()
