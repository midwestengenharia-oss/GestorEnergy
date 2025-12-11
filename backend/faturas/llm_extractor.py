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
        """Cria o prompt para o OpenAI"""
        return f"""Extraia os seguintes dados desta fatura de energia elétrica e retorne um JSON:

TEXTO DA FATURA:
{texto}

RETORNE UM JSON COM ESTA ESTRUTURA EXATA:
{{
  "codigo_cliente": "string (ex: 6/5036150-0)",
  "ligacao": "string (MONOFASICO, BIFASICO ou TRIFASICO)",
  "data_apresentacao": "string (formato YYYY-MM-DD)",
  "mes_ano_referencia": "string (formato YYYY-MM, ex: 2024-11)",
  "vencimento": "string (formato YYYY-MM-DD)",
  "total_a_pagar": "number (decimal)",
  "leitura_anterior_data": "string (formato YYYY-MM-DD ou null)",
  "leitura_atual_data": "string (formato YYYY-MM-DD ou null)",
  "dias": "number (quantidade de dias do período)",
  "proxima_leitura_data": "string (formato YYYY-MM-DD ou null)",
  "itens_fatura": {{
    "consumo_kwh": {{
      "descricao": "string",
      "quantidade": "number",
      "preco_unitario": "number",
      "valor": "number"
    }},
    "energia_injetada_ouc": [
      {{
        "descricao": "string",
        "quantidade": "number",
        "preco_unitario": "number",
        "valor": "number"
      }}
    ],
    "energia_injetada_muc": [
      {{
        "descricao": "string",
        "quantidade": "number",
        "preco_unitario": "number",
        "valor": "number"
      }}
    ],
    "ajuste_lei_14300": {{
      "descricao": "string",
      "quantidade": "number",
      "preco_unitario": "number",
      "valor": "number"
    }},
    "lancamentos_e_servicos": [
      {{
        "descricao": "string",
        "valor": "number"
      }}
    ]
  }},
  "totais": {{
    "itens": "number",
    "adicionais_bandeira": "number",
    "total": "number"
  }},
  "historico_gd": [
    {{
      "mes_ano": "string (MM/YYYY)",
      "saldo_anterior": "number",
      "creditos_mes": "number",
      "energia_compensada": "number",
      "energia_injetada": "number",
      "saldo_final": "number"
    }}
  ]
}}

INSTRUÇÕES IMPORTANTES:
- Se um campo não for encontrado, use null
- Para valores monetários, use apenas números (ex: 123.45, não "R$ 123,45")
- Para datas, use formato YYYY-MM-DD
- Para mes_ano_referencia, extraia do formato "Referência: NOVEMBRO/2024" → "2024-11"
- Para tipo de ligação, procure por "BIFASICO", "MONOFASICO" ou "TRIFASICO"
- Energia injetada pode estar como "ENERGIA ATIVA INJETADA oUC" (outras unidades consumidoras) ou "mUC" (mesma unidade)
- Ajuste Lei 14.300 indica modelo GD II
- Extraia TODOS os lançamentos e serviços listados
- Para histórico GD, se houver tabela com meses anteriores, extraia todos os dados

Retorne APENAS o JSON, sem texto adicional."""


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
