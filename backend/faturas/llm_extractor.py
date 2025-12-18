"""
Extrator de Faturas usando LLMWhisperer + OpenAI
"""

import base64
import json
import logging
from typing import Optional

from unstract.llmwhisperer import LLMWhispererClientV2
from unstract.llmwhisperer.client_v2 import LLMWhispererClientException
from openai import OpenAI

logger = logging.getLogger(__name__)


class LLMWhispererExtractor:
    """Extrai texto de PDF usando LLMWhisperer"""

    def __init__(self, api_key: str):
        self.client = LLMWhispererClientV2(
            base_url="https://llmwhisperer-api.us-central.unstract.com/api/v2",
            api_key=api_key
        )

    def extract_from_pdf(self, pdf_base64: str) -> str:
        """
        Extrai texto do PDF usando LLMWhisperer.

        Args:
            pdf_base64: PDF em base64

        Returns:
            Texto extraído otimizado para LLMs
        """
        import tempfile
        import os

        temp_file = None
        try:
            # Decodificar base64
            pdf_bytes = base64.b64decode(pdf_base64)

            # Salvar PDF temporariamente
            with tempfile.NamedTemporaryFile(mode='wb', suffix='.pdf', delete=False) as f:
                f.write(pdf_bytes)
                temp_file = f.name

            logger.info(f"Chamando LLMWhisperer API (arquivo temp: {temp_file})...")

            # Usar cliente oficial V2 com file_path
            result = self.client.whisper(
                file_path=temp_file,
                mode="high_quality",
                output_mode="layout_preserving",
                page_seperator="<<<NOVA_PAGINA>>>",
                lang="por",  # Português para faturas brasileiras
                wait_for_completion=True,
                wait_timeout=180
            )

            # Obter o texto extraído
            # A API V2 retorna um dicionário com estrutura: result['extraction']['result_text']
            logger.debug(f"Tipo de resultado: {type(result)}")
            logger.debug(f"Chaves disponíveis: {list(result.keys()) if isinstance(result, dict) else 'N/A'}")

            if isinstance(result, dict):
                # Estrutura correta: result -> extraction -> result_text
                extraction = result.get("extraction", {})
                texto = extraction.get("result_text", "")

                if not texto:
                    logger.warning(f"Campo 'result_text' vazio ou ausente. Chaves de extraction: {list(extraction.keys())}")
            else:
                # Se retornar string diretamente
                texto = str(result)

            logger.info(f"LLMWhisperer extraiu {len(texto)} caracteres")

            if len(texto) == 0:
                logger.error("ERRO: LLMWhisperer retornou 0 caracteres! Possíveis causas:")
                logger.error("  1. PDF é uma imagem escaneada sem OCR")
                logger.error("  2. PDF corrompido ou protegido")
                logger.error("  3. Problema com parâmetros da API")
                logger.error(f"  4. Estrutura da resposta: {result.keys() if isinstance(result, dict) else 'não é dict'}")

            return texto

        except LLMWhispererClientException as e:
            logger.error(f"Erro LLMWhisperer API: {e.message}, Status: {e.status_code}")
            raise
        except Exception as e:
            logger.error(f"Erro no LLMWhisperer: {e}")
            raise
        finally:
            # Limpar arquivo temporário
            if temp_file and os.path.exists(temp_file):
                try:
                    os.unlink(temp_file)
                    logger.debug(f"Arquivo temporário {temp_file} removido")
                except Exception as e:
                    logger.warning(f"Não foi possível remover arquivo temporário {temp_file}: {e}")


class OpenAIParser:
    """Parser de faturas usando OpenAI GPT-4o-mini"""

    def __init__(self, api_key: str):
        self.client = OpenAI(api_key=api_key)
        self.model = "gpt-4o-mini"

    def parse_fatura(self, texto: str) -> dict:
        """
        Parse o texto da fatura usando OpenAI.

        Args:
            texto: Texto extraído da fatura

        Returns:
            Dados estruturados da fatura
        """
        try:
            prompt = self._criar_prompt(texto)

            logger.info("Chamando OpenAI API...")

            # Usar cliente oficial
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "Você é um assistente especializado em extrair dados estruturados de faturas de energia elétrica da Energisa. Retorne APENAS um JSON válido, sem comentários ou texto adicional."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                response_format={"type": "json_object"},
                temperature=0.1
            )

            # Extrair o JSON da resposta
            content = response.choices[0].message.content
            dados = json.loads(content)

            logger.info("OpenAI parseou a fatura com sucesso")
            return dados

        except Exception as e:
            logger.error(f"Erro no OpenAI: {e}")
            raise

    def _criar_prompt(self, texto: str) -> str:
        """Prompt robusto para extrair bandeiras, lançamentos e GD"""
        return f"""Você é um extrator rigoroso de dados de faturas de energia recebendo como entrada texto cru obtido de OCR/parsers. Sua tarefa é identificar, normalizar e estruturar os campos abaixo exatamente no formato JSON especificado.

Regras gerais
- Campos ausentes → null.
- Datas → YYYY-MM-DD. Mês/ano → YYYY-MM.
- Números → ponto decimal (ex.: 99.90). Não inclua "R$". Preserve sinal (linhas de energia injetada podem ser negativas).
- ligacao ∈ MONOFASICO|BIFASICO|TRIFASICO|null.
- tipo_gd ∈ GDI|GDII|NENHUM|DESCONHECIDO|null. Detecte "GD I/GDI" e "GD II/GDII".

Coleta de dados essenciais
- Código do Cliente (padrão 6/XXXXXXXX-X).
- Tipo de ligação.
- Mês/ano de referência (normalize ex.: "Setembro / 2025" → 2025-09).
- Datas: apresentação, vencimento, leitura atual, leitura anterior, próxima leitura, quantidade de dias.
- Leituras: valores de leitura anterior e atual (kWh).

Itens da fatura
Quadro típico: [Descrição] | Unid. | Quant. | Preço unit | Valor | ...

1) Consumo
Linha "Consumo em kWh" → {{ unidade, quantidade, preco_unit_com_tributos, valor }}.

2) Energia Injetada (múltiplas linhas, oUC e mUC)
- Descrições "Energia Atv/Ativa Injetada ..." com "GDII/GDI" e token oUC ou mUC (regex: oUC → \b[oO]\sUC\b; mUC → \b[mM]\sUC\b). Se não tiver token, não classifique em oUC/mUC.
- Para cada linha: {{ descricao, tipo_gd, unidade, quantidade, preco_unit_com_tributos, valor, mes_ano_referencia_item }}.
- Separe SEMPRE em listas distintas: "energia_injetada oUC" e "energia_injetada mUC".
- tipo_gd: GDII se mencionar GDII; GDI se mencionar GDI; se houver "Ajuste ... Lei 14.300/22" mas não houver GD explícito, assuma GDII; sem evidência → DESCONHECIDO.

3) Ajuste Lei 14.300 (GDII – tarifa reduzida)
- Linhas como "Ajuste GDII - TRF Reduzida (Lei 14.300/22) ...". Preencher ajuste_lei_14300 {{ descricao, unidade, quantidade, preco_unit_com_tributos, valor }}.

4) Lançamentos e Serviços
- Capturar TODAS as linhas do bloco "LANÇAMENTOS E SERVIÇOS" (Contrib de Ilum Pub, JUROS, MULTA, etc.).
- itens_fatura.lancamentos_e_servicos = lista de {{ descricao, valor }} com o sinal da fatura.
- totais.lancamentos_e_servicos = soma dessa lista.

5) Bandeiras Tarifárias (monetário e tipo)
- Itens com "Bandeira" ou "Adic. B. Vermelha/Amarela/Verde" devem entrar em itens_fatura.lancamentos_e_servicos (valor monetário) e somar em totais.adicionais_bandeira.
- bandeira_tarifaria (campo raiz) deve refletir a cor encontrada:
  "Adic. B. Vermelha"/"Bandeira Vermelha" → VERMELHA
  "Adic. B. Amarela"/"Bandeira Amarela" → AMARELA
  Se houver itens de bandeira mas sem cor identificável → null
  Se não houver itens de bandeira → VERDE

6) TOTAIS
- totais.adicionais_bandeira: soma dos itens de bandeira (0 se não houver). NÃO misturar ajuste Lei 14.300.
- totais.total_geral_fatura: valor total exibido (preferir "TOTAL A PAGAR", senão "VALOR COBRADO/VALOR DO DOCUMENTO"). Apenas reporte.

7) Quadros adicionais
- quadro_atencao: saldo_acumulado, a_expirar_proximo_ciclo (se existir).
- estrutura_consumo: kwh_ponta e inj_ponta quando houver tabela de estrutura/consumo faturado.
- media_consumo_13m: ler "CONSUMO DOS ÚLTIMOS 13 MESES", converter "SET/25" → 2025-09; média simples dos kWh capturados (ou null se nenhum for numérico).

Itens sem unidade/quantidade (bandeiras, iluminação, outros serviços): normalmente só têm valor. Use a coluna "Valor (R$)" (não use PIS/COFINS/Base/ICMS para valor). Preserve o sinal.

Formato de resposta JSON (preencher exatamente as chaves abaixo):

{{
  "codigo_cliente": "string|null",
  "ligacao": "MONOFASICO|BIFASICO|TRIFASICO|null",
  "data_apresentacao": "string|null",
  "mes_ano_referencia": "string|null",
  "vencimento": "string|null",
  "total_a_pagar": "number|null",
  "bandeira_tarifaria": "VERMELHA|AMARELA|VERDE|null",

  "leitura_anterior_data": "string|null",
  "leitura_atual_data": "string|null",
  "dias": "number|null",
  "proxima_leitura_data": "string|null",
  "leitura_anterior": "number|null",
  "leitura_atual": "number|null",

  "itens_fatura": {{
    "consumo_kwh": {{"unidade": "string|null", "quantidade": "number|null", "preco_unit_com_tributos": "number|null", "valor": "number|null"}},
    "energia_injetada oUC": [{{"descricao": "string|null", "tipo_gd": "GDI|GDII|NENHUM|DESCONHECIDO|null", "unidade": "string|null", "quantidade": "number|null", "preco_unit_com_tributos": "number|null", "valor": "number|null", "mes_ano_referencia_item": "string|null"}}],
    "energia_injetada mUC": [{{"descricao": "string|null", "tipo_gd": "GDI|GDII|NENHUM|DESCONHECIDO|null", "unidade": "string|null", "quantidade": "number|null", "preco_unit_com_tributos": "number|null", "valor": "number|null", "mes_ano_referencia_item": "string|null"}}],
    "ajuste_lei_14300": {{"descricao": "string|null", "unidade": "string|null", "quantidade": "number|null", "preco_unit_com_tributos": "number|null", "valor": "number|null"}},
    "lancamentos_e_servicos": [{{"descricao": "string|null", "valor": "number|null"}}]
  }},

  "totais": {{
    "adicionais_bandeira": "number|null",
    "lancamentos_e_servicos": "number|null",
    "total_geral_fatura": "number|null"
  }},

  "quadro_atencao": {{
    "saldo_acumulado": "number|null",
    "a_expirar_proximo_ciclo": "number|null"
  }},

  "estrutura_consumo": {{
    "kwh_ponta": {{"atual": "number|null", "anterior": "number|null", "medido": "number|null", "faturado": "number|null"}},
    "inj_ponta": {{"atual": "number|null", "anterior": "number|null", "medido": "number|null", "faturado": "number|null"}}
  }},

  "media_consumo_13m": {{
    "media_kwh": "number|null",
    "meses": [{{"mes": "string|null", "kwh": "number|null"}}]
  }},

  "impostos_detalhados": {{
    "pis_aliquota": "number|null",
    "pis_valor": "number|null",
    "cofins_aliquota": "number|null",
    "cofins_valor": "number|null",
    "icms_aliquota": "number|null",
    "icms_valor": "number|null",
    "base_calculo": "number|null"
  }}
}}

Responda apenas o JSON válido, sem texto adicional.
"""


def criar_extrator_llm():
    """
    Cria instância do extrator LLM.
    Usa variáveis de ambiente via settings.
    """
    from backend.config import settings

    if not settings.LLMWHISPERER_API_KEY:
        raise ValueError("LLMWHISPERER_API_KEY não configurada. Configure no .env")

    if not settings.OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY não configurada. Configure no .env")

    return LLMWhispererExtractor(settings.LLMWHISPERER_API_KEY), OpenAIParser(settings.OPENAI_API_KEY)
