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
    """Parser de faturas usando OpenAI GPT-5-mini"""

    def __init__(self, api_key: str):
        self.client = OpenAI(api_key=api_key)
        self.model = "gpt-5-mini"

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
        """Cria o prompt para o OpenAI - Baseado no N8N que funcionava bem"""
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

Precisam ser coletados todos os itens, como consumo em kWh, Energia Ativa Injetada oUC ou mUC referente ao mês atual ou meses anteriores (em alguns casos podem haver vários itens de Energia Atv Injetada) e ajuste tarifário em casos GD2 - TRF Reduzida pela Lei 14.300/22.

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

Se a descrição não contiver explicitamente o token oUC ou mUC (pelas regex acima), não inclua em nenhuma das duas listas.

tipo_gd: se a linha mencionar GD II/GDII → GDII; se GD I/GDI → GDI. Se não mencionar mas houver "Ajuste ... Lei 14.300/22" na fatura, assuma GDII para as linhas sem indicação explícita. Sem evidência → DESCONHECIDO.

Ajuste Lei 14.300/22 (GDII – tarifa reduzida):

Linhas tipo: "Ajuste GDII - TRF Reduzida (Lei 14.300/22) - ...".
Preencher itens_fatura.ajuste_lei_14300: {{ descricao, unidade, quantidade, preco_unit_com_tributos, valor }}.

Lançamentos e Serviços:

Capturar TODAS as linhas do bloco "LANÇAMENTOS E SERVIÇOS" (ex.: "Contrib de Ilum Pub", "JUROS DE MORA …", "MULTA …", "Adic. B. Amarela", "Adic. B. Vermelha", etc.).

IMPORTANTE para itens de BANDEIRA e ILUMINAÇÃO:
Entenda que Consumo, Energia Injetada, Ajuste GDII e alguns outros possuem informações em todas as colunas do quadro de itens da fatura. Utilize apenas a descrição, unidade, quantidade e valor.
Já os Adicionais de Bandeiras, Iluminação Pública e outros lançamentos ou serviços NÃO possuem unidade, quantidade e preço unitário, apenas valor, pis/cofins, base de cálculo, alíquota e valor do ICMS e tarifa unitária.
Portanto, atente-se para estes itens onde a PRIMEIRA informação numérica já é o VALOR. Ou seja, evite utilizar os demais valores.

itens_fatura.lancamentos_e_servicos = lista de {{ descricao, valor }} com sinal conforme a fatura.
totais.lancamentos_e_servicos = soma de TODOS os valores em itens_fatura.lancamentos_e_servicos.

TOTAIS

totais.adicionais_bandeira: soma de TODOS os itens com "Bandeira", "B. Vermelha", "B. Amarela", "B. Verde" no nome.
totais.total_geral_fatura: valor total geral exibido (preferir "TOTAL A PAGAR", senão "VALOR COBRADO/VALOR DO DOCUMENTO").

Quando possível, totais.total_geral_fatura deve bater com total_a_pagar (tolerância ±0.05). Não compute, apenas reporte.

BANDEIRAS TARIFÁRIAS - DETALHAMENTO:

Para CADA bandeira encontrada (Amarela, Vermelha, Verde), criar um objeto em totais.bandeiras_detalhamento:
- Identificar a COR: VERDE, AMARELA ou VERMELHA
- Extrair o VALOR da coluna "Valor (R$)" (primeira coluna numérica após descrição)
- Adicionar {{"cor": "COR", "valor": VALOR_EXTRAIDO}}

Se não houver bandeiras na fatura → totais.bandeiras_detalhamento = []

Preencher no JSON raiz: "bandeira_tarifaria":
- Se houver bandeira vermelha → "VERMELHA"
- Se só houver amarela → "AMARELA"
- Se não houver bandeiras → "VERDE"

QUADRO ATENÇÃO (se existir)

Capturar em blocos de GD/compensação:
• quadro_atencao.saldo_acumulado (ex.: "Saldo Acumulado: 140" → 140.00)
• quadro_atencao.a_expirar_proximo_ciclo (ex.: "A expirar no próximo ciclo: 0" → 0.00)

ESTRUTURA/COMPOSIÇÃO DO CONSUMO (se existir)

Em "DADOS/ESTRUTURA DO CONSUMO" com "Ponta/Intermediário/Fora de Ponta", preencher quando possível:
• estrutura_consumo.kwh_ponta: {{ atual, anterior, medido, faturado }}
• estrutura_consumo.inj_ponta: {{ atual, anterior, medido, faturado }}

Campos ausentes → null.

MÉDIA DOS ÚLTIMOS 13 MESES (se existir)

Ler "CONSUMO DOS ÚLTIMOS 13 MESES". Converter "SET/25" → 2025-09, "AGO/25" → 2025-08, etc.
media_consumo_13m.meses = lista (ordem cronológica quando claro, senão a da fatura).
media_consumo_13m.media_kwh = média simples dos kWh capturados (se nenhum mês for numérico, null).

IMPOSTOS E TRIBUTOS (extrair se existir)

Busque a seção "Base de Cálculo dos Tributos", "Composição dos Tributos" ou "Impostos e Contribuições".
Se encontrar, preencha impostos_detalhados com:
- pis_aliquota: decimal (ex: 1.2102% → 0.012102)
- pis_valor: valor em R$
- cofins_aliquota: decimal (ex: 5.5743% → 0.055743)
- cofins_valor: valor em R$
- icms_aliquota: decimal (ex: 17% → 0.17)
- icms_valor: valor em R$
- base_calculo: valor total da base de cálculo

Se a seção NÃO existir na fatura → impostos_detalhados = null

Não invente. Não explique. Apenas JSON com as chaves especificadas.
Certifique-se de verificar todos os possíveis itens da fatura antes e depois de "Lançamentos e Serviços".

Formato de resposta JSON

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
    "bandeiras_detalhamento": [
      {{
        "cor": "VERDE|AMARELA|VERMELHA",
        "valor": "number"
      }}
    ],
    "lancamentos_e_servicos": "number|null",
    "total_geral_fatura": "number|null"
  }},

  "quadro_atencao": {{
    "saldo_acumulado": "number|null",
    "a_expirar_proximo_ciclo": "number|null"
  }},

  "estrutura_consumo": {{
    "kwh_ponta": {{
      "atual": "number|null",
      "anterior": "number|null",
      "medido": "number|null",
      "faturado": "number|null"
    }},
    "inj_ponta": {{
      "atual": "number|null",
      "anterior": "number|null",
      "medido": "number|null",
      "faturado": "number|null"
    }}
  }},

  "media_consumo_13m": {{
    "media_kwh": "number|null",
    "meses": [
      {{
        "mes": "string|null",
        "kwh": "number|null"
      }}
    ]
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
