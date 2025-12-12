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
        """Cria o prompt para o OpenAI - Versão alinhada com n8n"""
        return f"""Você é um extrator rigoroso de dados de faturas de energia recebendo como entrada texto cru obtido de OCR/parsers. Sua tarefa é identificar, normalizar e estruturar os campos abaixo exatamente no formato JSON especificado.

Regras:

Campos ausentes → null.
Datas → YYYY-MM-DD. Mês/ano → YYYY-MM.
Números → ponto decimal (ex.: 99.90). Não inclua "R$". Preserve sinal (linhas de energia injetada geralmente são negativas no "Valor").
ligacao ∈ MONOFASICO|BIFASICO|TRIFASICO|null.
tipo_gd ∈ GDI|GDII|NENHUM|DESCONHECIDO|null. Detecte "GD I/GDI" e "GD II/GDII" (variações de espaço/caixa).

TEXTO DA FATURA:
{texto}

Coleta de dados:

Código do Cliente → Geralmente número no padrão 6/XXXXXXXX-X (ex.: 6/4998834-8).

Tipo de ligação → a partir de LIGAÇÃO (ex.: MONOFASICO, BIFASICO ou TRIFASICO).

Mês e ano de referência → extraia e normalize (ex.: "Setembro / 2025" → 2025-09).

Datas → data de apresentação, data de vencimento, data da leitura atual, data da leitura anterior, data da próxima leitura e quantidade de dias.

Leituras → valores em kWh da leitura anterior e da leitura atual.

Itens da fatura:

Quadro típico com colunas:
[Descrição] | Unid. | Quant. | Preço unit (R$) com tributos | Valor (R$) | PIS/COFINS (R$) - Evitar utilizar | Base Calc. ICMS (R$) - Evitar utilizar | % Alíq. ICMS - Evitar utilizar | ICMS (R$) - Evitar utilizar | Tarifa Unit (R$) - Evitar utilizar

Consumo:

Linha "Consumo em kWh" → {{ unidade, quantidade, preco_unit_com_tributos, valor }}.

Energia Injetada (múltiplas linhas, oUC e mUC, de meses distintos):

Reconhecer descrições tipo: "Energia Atv/Ativa Injetada ...", com marcações "GDII/GDI", e escopo "oUC" ou "mUC", possivelmente com referência de mês "... 9/2025 ...", "... 07/2025 ...".

Classificação por token com limites de palavra:
• oUC → regex: \\b[oO]\\s?UC\\b (aceitar "oUC", "o UC", "OUC").
• mUC → regex: \\b[mM]\\s?UC\\b (aceitar "mUC", "m UC", "MUC").

Para cada linha encontrada, crie um item:
{{
"descricao": "string original do item",
"tipo_gd": "GDI|GDII|NENHUM|DESCONHECIDO|null",
"unidade": "KWH|null",
"quantidade": number|null,
"preco_unit_com_tributos": number|null,
"valor": number|null,
"mes_ano_referencia_item": "YYYY-MM|null"
}}

Separe SEMPRE em listas:
itens_fatura["energia_injetada oUC"]: []
itens_fatura["energia_injetada mUC"]: []

tipo_gd: se a linha mencionar GD II/GDII → GDII; se GD I/GDI → GDI. Sem evidência → DESCONHECIDO.

IMPORTANTE - DIFERENCIAÇÃO BANDEIRA vs AJUSTE LEI 14.300:

NÃO CONFUNDIR:

| Item | Vai para | Exemplos de descrição |
|------|----------|----------------------|
| Bandeira Tarifária | totais.adicionais_bandeira | "Adic. B. Vermelha", "Adic. B. Amarela", "Adic Bandeira Vermelha", "Bandeira Tarifária" |
| Ajuste Lei 14.300 | itens_fatura.ajuste_lei_14300 | "Ajuste GDII - TRF Reduzida(Lei 14.300/22)", "Ajuste GD II - Tarifa Reduzida Lei 14.300" |

REGRAS:
1. ajuste_lei_14300 SOMENTE se a descrição contiver:
   - "Lei 14.300" OU
   - "TRF Reduzida" OU
   - "Tarifa Reduzida" OU
   - "GDII" junto com "Ajuste"

2. Itens com "Bandeira" ou "B. Vermelha/Amarela/Verde" → SEMPRE vão para totais.adicionais_bandeira

3. Se a fatura for GD I (não tem ajuste 14.300), o campo ajuste_lei_14300 deve ter todos os valores como null

Ajuste Lei 14.300/22 (SOMENTE GDII – tarifa reduzida):

Linhas tipo: "Ajuste GDII - TRF Reduzida (Lei 14.300/22) - ...".
Preencher itens_fatura.ajuste_lei_14300: {{ descricao, unidade, quantidade, preco_unit_com_tributos, valor }}.

Lançamentos e Serviços:

Capturar todas as linhas do bloco "LANÇAMENTOS E SERVIÇOS" (ex.: "Contrib de Ilum Pub", "JUROS DE MORA …", "MULTA …", etc.).
itens_fatura.lancamentos_e_servicos = lista de {{ descricao, valor }} com sinal conforme a fatura.
totais.lancamentos_e_servicos = soma dos valores em itens_fatura.lancamentos_e_servicos.

TOTAIS

totais.adicionais_bandeira: soma de itens com "Bandeira" no nome (0 se não houver). NUNCA colocar ajuste Lei 14.300 aqui.
totais.total_geral_fatura: valor total geral exibido (preferir "TOTAL A PAGAR", senão "VALOR COBRADO/VALOR DO DOCUMENTO").

QUADRO ATENÇÃO (se existir)

quadro_atencao.saldo_acumulado (ex.: "Saldo Acumulado: 140" → 140.00)
quadro_atencao.a_expirar_proximo_ciclo (ex.: "A expirar no próximo ciclo: 0" → 0.00)

MÉDIA DOS ÚLTIMOS 13 MESES (se existir)

Ler "CONSUMO DOS ÚLTIMOS 13 MESES". Converter "SET/25" → 2025-09, "AGO/25" → 2025-08, etc.
media_consumo_13m.meses = lista (ordem cronológica quando claro, senão a da fatura).
media_consumo_13m.media_kwh = média simples dos kWh capturados (se nenhum mês for numérico, null).

Não invente. Não explique. Apenas JSON com as chaves especificadas.

Formato de resposta JSON

{{
  "codigo_cliente": "string|null",
  "ligacao": "MONOFASICO|BIFASICO|TRIFASICO|null",
  "data_apresentacao": "string|null",
  "mes_ano_referencia": "string|null",
  "vencimento": "string|null",
  "total_a_pagar": "number|null",

  "leitura_anterior_data": "string|null",
  "leitura_atual_data": "string|null",
  "dias": "number|null",
  "proxima_leitura_data": "string|null",
  "leitura_anterior": "number|null",
  "leitura_atual": "number|null",

  "itens_fatura": {{
    "consumo_kwh": {{
      "unidade": "string|null",
      "quantidade": "number|null",
      "preco_unit_com_tributos": "number|null",
      "valor": "number|null"
    }},
    "energia_injetada oUC": [
      {{
        "descricao": "string|null",
        "tipo_gd": "GDI|GDII|NENHUM|DESCONHECIDO|null",
        "unidade": "string|null",
        "quantidade": "number|null",
        "preco_unit_com_tributos": "number|null",
        "valor": "number|null",
        "mes_ano_referencia_item": "string|null"
      }}
    ],
    "energia_injetada mUC": [
      {{
        "descricao": "string|null",
        "tipo_gd": "GDI|GDII|NENHUM|DESCONHECIDO|null",
        "unidade": "string|null",
        "quantidade": "number|null",
        "preco_unit_com_tributos": "number|null",
        "valor": "number|null",
        "mes_ano_referencia_item": "string|null"
      }}
    ],
    "ajuste_lei_14300": {{
      "descricao": "string|null",
      "unidade": "string|null",
      "quantidade": "number|null",
      "preco_unit_com_tributos": "number|null",
      "valor": "number|null"
    }},
    "lancamentos_e_servicos": [
      {{
        "descricao": "string|null",
        "valor": "number|null"
      }}
    ]
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

  "media_consumo_13m": {{
    "media_kwh": "number|null",
    "meses": [
      {{
        "mes": "string|null",
        "kwh": "number|null"
      }}
    ]
  }}
}}

JSON"""


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
