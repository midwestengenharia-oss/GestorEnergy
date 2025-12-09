"""
Extrator de Faturas usando LLMWhisperer + OpenAI
"""

import base64
import json
import logging
from typing import Optional

from unstract.llmwhisperer import LLMWhispererClient, LLMWhispererClientException
from openai import OpenAI

logger = logging.getLogger(__name__)


class LLMWhispererExtractor:
    """Extrai texto de PDF usando LLMWhisperer"""

    def __init__(self, api_key: str):
        self.client = LLMWhispererClient(api_key=api_key)

    def extract_from_pdf(self, pdf_base64: str) -> str:
        """
        Extrai texto do PDF usando LLMWhisperer.

        Args:
            pdf_base64: PDF em base64

        Returns:
            Texto extraído otimizado para LLMs
        """
        try:
            # Decodificar base64
            pdf_bytes = base64.b64decode(pdf_base64)

            logger.info("Chamando LLMWhisperer API...")

            # Usar cliente oficial
            result = self.client.whisper(
                file_data=pdf_bytes,
                processing_mode="high_quality",
                output_mode="line-printer",
                page_seperator="<<<NOVA_PAGINA>>>",
                force_text_processing=False
            )

            # Obter o texto extraído
            texto = result.get("extracted_text", "")
            logger.info(f"LLMWhisperer extraiu {len(texto)} caracteres")
            return texto

        except LLMWhispererClientException as e:
            logger.error(f"Erro no LLMWhisperer: {e}")
            raise
        except Exception as e:
            logger.error(f"Erro inesperado no LLMWhisperer: {e}")
            raise


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
