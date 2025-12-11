from unstract.llmwhisperer import LLMWhispererClientV2

API_KEY = "E3hBWCdCZoCLZas_fpeAbHaIxbcMz1OZMIV7cL1pJ_g"

client = LLMWhispererClientV2(
    base_url="https://llmwhisperer-api.us-central.unstract.com/api/v2",
    api_key=API_KEY
)

result = client.whisper(
    file_path="gestor_faturas/download-480.pdf",
    mode="high_quality",
    output_mode="layout_preserving",
    lang="por",
    wait_for_completion=True,
    wait_timeout=180
)

# Acesso correto: result['extraction']['result_text']
texto = result.get("extraction", {}).get("result_text", "")

print(f"Caracteres extraidos: {len(texto)}")
print("\nPrimeiros 500 caracteres:")
print(texto[:500])
print("\n...")
print("\nUltimos 500 caracteres:")
print(texto[-500:])
