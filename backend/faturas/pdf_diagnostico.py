"""
Diagnóstico de PDF para avaliar viabilidade de extração por template.

Uso:
    python -m backend.faturas.pdf_diagnostico <caminho_pdf_ou_base64>

Analisa:
1. Se as tabelas são detectáveis por pdfplumber
2. Estrutura das tabelas encontradas
3. Coordenadas de elementos
4. Viabilidade de extração sem IA
"""

import sys
import base64
import io
import json
from pathlib import Path

try:
    import pdfplumber
except ImportError:
    print("Erro: pdfplumber não instalado. Execute: pip install pdfplumber")
    sys.exit(1)


def analisar_pdf(pdf_bytes: bytes) -> dict:
    """Analisa estrutura do PDF e retorna diagnóstico completo."""

    resultado = {
        "paginas": [],
        "tabelas_encontradas": 0,
        "tabelas_validas": 0,
        "texto_total_chars": 0,
        "viabilidade": "DESCONHECIDA",
        "recomendacao": ""
    }

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        resultado["total_paginas"] = len(pdf.pages)

        for i, pagina in enumerate(pdf.pages):
            info_pagina = {
                "numero": i + 1,
                "largura": pagina.width,
                "altura": pagina.height,
                "tabelas": [],
                "texto_amostra": ""
            }

            # 1. Tentar extrair tabelas
            tabelas = pagina.extract_tables()
            resultado["tabelas_encontradas"] += len(tabelas)

            for j, tabela in enumerate(tabelas):
                if not tabela:
                    continue

                # Analisar estrutura da tabela
                num_linhas = len(tabela)
                num_colunas = max(len(linha) for linha in tabela) if tabela else 0

                # Verificar se tem header reconhecível
                header = tabela[0] if tabela else []
                header_texto = " | ".join(str(c or "") for c in header)

                # Amostra das primeiras linhas
                amostra = []
                for linha in tabela[:5]:
                    amostra.append([str(c or "")[:30] for c in linha])

                info_tabela = {
                    "indice": j,
                    "linhas": num_linhas,
                    "colunas": num_colunas,
                    "header": header_texto[:200],
                    "amostra": amostra,
                    "parece_itens_fatura": any(
                        termo in header_texto.upper()
                        for termo in ["DESCRIÇÃO", "DESCRICAO", "VALOR", "QUANT", "UNID"]
                    )
                }

                if info_tabela["parece_itens_fatura"]:
                    resultado["tabelas_validas"] += 1

                info_pagina["tabelas"].append(info_tabela)

            # 2. Extrair texto com layout
            texto = pagina.extract_text(layout=True) or ""
            resultado["texto_total_chars"] += len(texto)
            info_pagina["texto_amostra"] = texto[:500] + "..." if len(texto) > 500 else texto

            # 3. Verificar se tem palavras-chave esperadas
            texto_upper = texto.upper()
            info_pagina["palavras_chave"] = {
                "CODIGO_CLIENTE": "CÓDIGO" in texto_upper or "CLIENTE" in texto_upper,
                "VENCIMENTO": "VENCIMENTO" in texto_upper,
                "TOTAL_PAGAR": "TOTAL A PAGAR" in texto_upper or "VALOR COBRADO" in texto_upper,
                "CONSUMO": "CONSUMO" in texto_upper,
                "ENERGIA_INJETADA": "INJETADA" in texto_upper,
                "LANCAMENTOS": "LANÇAMENTOS" in texto_upper or "LANCAMENTOS" in texto_upper,
                "BANDEIRA": "BANDEIRA" in texto_upper,
                "ILUMINACAO": "ILUM" in texto_upper,
            }

            resultado["paginas"].append(info_pagina)

    # Avaliar viabilidade
    if resultado["tabelas_validas"] >= 1:
        resultado["viabilidade"] = "ALTA"
        resultado["recomendacao"] = (
            "Tabelas estruturadas detectadas. "
            "Extração por template é viável e recomendada."
        )
    elif resultado["tabelas_encontradas"] >= 1:
        resultado["viabilidade"] = "MEDIA"
        resultado["recomendacao"] = (
            "Tabelas encontradas mas sem headers claros. "
            "Pode funcionar com ajustes nas regras de identificação."
        )
    elif resultado["texto_total_chars"] > 500:
        resultado["viabilidade"] = "BAIXA"
        resultado["recomendacao"] = (
            "Nenhuma tabela estruturada encontrada. "
            "PDF usa texto alinhado, não tabelas reais. "
            "Opções: regex no texto ou coordenadas fixas."
        )
    else:
        resultado["viabilidade"] = "MUITO_BAIXA"
        resultado["recomendacao"] = (
            "Pouco texto extraído. PDF pode ser imagem/escaneado. "
            "Necessário OCR."
        )

    return resultado


def formatar_resultado(resultado: dict) -> str:
    """Formata o resultado para exibição."""

    linhas = [
        "=" * 70,
        "DIAGNÓSTICO DE PDF - VIABILIDADE DE EXTRAÇÃO SEM IA",
        "=" * 70,
        "",
        f"Total de páginas: {resultado['total_paginas']}",
        f"Caracteres de texto: {resultado['texto_total_chars']}",
        f"Tabelas encontradas: {resultado['tabelas_encontradas']}",
        f"Tabelas válidas (com header): {resultado['tabelas_validas']}",
        "",
        f"VIABILIDADE: {resultado['viabilidade']}",
        f"Recomendação: {resultado['recomendacao']}",
        "",
        "-" * 70,
        "DETALHES POR PÁGINA",
        "-" * 70,
    ]

    for pagina in resultado["paginas"]:
        linhas.append(f"\n📄 Página {pagina['numero']} ({pagina['largura']:.0f} x {pagina['altura']:.0f} pts)")

        # Palavras-chave
        palavras = pagina.get("palavras_chave", {})
        encontradas = [k for k, v in palavras.items() if v]
        if encontradas:
            linhas.append(f"   Palavras-chave: {', '.join(encontradas)}")

        # Tabelas
        if pagina["tabelas"]:
            for tab in pagina["tabelas"]:
                status = "✅" if tab["parece_itens_fatura"] else "⚠️"
                linhas.append(f"\n   {status} Tabela {tab['indice']}: {tab['linhas']} linhas x {tab['colunas']} colunas")
                linhas.append(f"      Header: {tab['header'][:80]}...")
                linhas.append(f"      Amostra:")
                for linha in tab["amostra"][:3]:
                    linhas.append(f"        | {' | '.join(linha[:5])} |")
        else:
            linhas.append("   ⚠️ Nenhuma tabela estruturada encontrada")

        # Amostra de texto
        linhas.append(f"\n   Texto (amostra):")
        for linha_texto in pagina["texto_amostra"].split("\n")[:10]:
            if linha_texto.strip():
                linhas.append(f"      {linha_texto[:70]}")

    linhas.append("\n" + "=" * 70)

    return "\n".join(linhas)


def main():
    if len(sys.argv) < 2:
        print("Uso: python -m backend.faturas.pdf_diagnostico <arquivo.pdf ou base64>")
        print("\nExemplo com arquivo:")
        print("  python -m backend.faturas.pdf_diagnostico fatura.pdf")
        print("\nExemplo com base64 (de um arquivo):")
        print("  python -m backend.faturas.pdf_diagnostico base64.txt")
        sys.exit(1)

    entrada = sys.argv[1]

    # Verificar se é arquivo ou base64
    if Path(entrada).exists():
        with open(entrada, "rb") as f:
            conteudo = f.read()

        # Se for arquivo de texto, assumir que é base64
        if entrada.endswith(".txt"):
            pdf_bytes = base64.b64decode(conteudo)
        else:
            pdf_bytes = conteudo
    else:
        # Assumir que é base64 direto
        try:
            pdf_bytes = base64.b64decode(entrada)
        except Exception:
            print(f"Erro: '{entrada}' não é um arquivo válido nem base64")
            sys.exit(1)

    print(f"Analisando PDF ({len(pdf_bytes)} bytes)...\n")

    resultado = analisar_pdf(pdf_bytes)
    print(formatar_resultado(resultado))

    # Salvar JSON completo
    json_path = Path("diagnostico_pdf.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(resultado, f, indent=2, ensure_ascii=False)
    print(f"\nDiagnóstico completo salvo em: {json_path}")


if __name__ == "__main__":
    main()
