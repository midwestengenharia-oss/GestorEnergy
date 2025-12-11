"""
Teste direto do LLMWhisperer com a fatura download-480.pdf
"""
import base64
import sys
from unstract.llmwhisperer import LLMWhispererClientV2

# Fix encoding on Windows
sys.stdout.reconfigure(encoding='utf-8')

# API Key
API_KEY = "E3hBWCdCZoCLZas_fpeAbHaIxbcMz1OZMIV7cL1pJ_g"

# Carregar PDF
pdf_path = "gestor_faturas/download-480.pdf"
with open(pdf_path, "rb") as f:
    pdf_bytes = f.read()

print(f"PDF carregado: {len(pdf_bytes)} bytes")

# Criar cliente
client = LLMWhispererClientV2(
    base_url="https://llmwhisperer-api.us-central.unstract.com/api/v2",
    api_key=API_KEY
)

print("Enviando para LLMWhisperer...")

# Chamar API
result = client.whisper(
    file_path=pdf_path,
    mode="high_quality",
    output_mode="layout_preserving",
    page_seperator="<<<NOVA_PAGINA>>>",
    lang="por",
    wait_for_completion=True,
    wait_timeout=180
)

print(f"\nTipo de resultado: {type(result)}")
print(f"Resultado completo: {result}")

if isinstance(result, dict):
    print(f"\nChaves disponiveis: {list(result.keys())}")
    texto = result.get("extracted_text", "")
    print(f"\nTexto extraido ({len(texto)} caracteres):")
    print(texto[:500] if texto else "VAZIO!")
else:
    texto = str(result)
    print(f"\nTexto direto ({len(texto)} caracteres):")
    print(texto[:500] if texto else "VAZIO!")
