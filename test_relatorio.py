"""
Teste de geração de relatórios HTML de cobranças

Testa se o ReportGenerator está gerando HTML correto com dados mockados
"""

import sys
from pathlib import Path
from decimal import Decimal
from datetime import date, datetime

# Adicionar backend ao path
sys.path.insert(0, str(Path(__file__).parent / "backend"))

from backend.cobrancas.report_generator import ReportGenerator
from backend.cobrancas.calculator import CobrancaCalculada
from backend.faturas.extraction_schemas import (
    FaturaExtraidaSchema,
    ItensFaturaExtracted,
    ConsumoKwhExtracted,
    EnergiaInjetadaItemExtracted,
    LancamentoServicoExtracted,
    AjusteLei14300Extracted,
    TotaisExtracted
)


def criar_dados_teste_gdi():
    """Cria dados de teste para fatura GD I (sem Lei 14.300)"""

    # Dados extraídos da fatura
    dados_fatura = FaturaExtraidaSchema(
        codigo_cliente="6/5036150-0",
        ligacao="BIFASICO",
        data_apresentacao=date(2024, 12, 5),
        mes_ano_referencia="2024-11",
        vencimento=date(2024, 12, 20),
        total_a_pagar=Decimal("127.45"),
        leitura_anterior_data=date(2024, 10, 12),
        leitura_atual_data=date(2024, 11, 11),
        dias=30,
        itens_fatura=ItensFaturaExtracted(
            consumo_kwh=ConsumoKwhExtracted(
                unidade="kWh",
                quantidade=250,
                preco_unit_com_tributos=Decimal("0.75"),
                valor=Decimal("187.50")
            ),
            energia_injetada_ouc=[
                EnergiaInjetadaItemExtracted(
                    descricao="Energia Ativa Injetada oUC",
                    tipo_gd="GDI",
                    unidade="kWh",
                    quantidade=300,
                    preco_unit_com_tributos=Decimal("0.60"),
                    valor=Decimal("-180.00")
                )
            ],
            lancamentos_e_servicos=[
                LancamentoServicoExtracted(descricao="Iluminação Pública", valor=Decimal("35.82")),
                LancamentoServicoExtracted(descricao="Adicional Bandeira Vermelha", valor=Decimal("15.00"))
            ]
        ),
        totais=TotaisExtracted(
            adicionais_bandeira=Decimal("15.00"),
            lancamentos_e_servicos=Decimal("35.82")
        )
    )

    # Cobrança calculada (GD I)
    cobranca = CobrancaCalculada()
    # Modelo GD
    cobranca.modelo_gd = "GDI"
    cobranca.tipo_ligacao = "BIFASICO"

    # Energia
    cobranca.consumo_kwh = 250
    cobranca.injetada_kwh = 300
    cobranca.compensado_kwh = 250
    cobranca.gap_kwh = 0

    # Tarifas
    cobranca.tarifa_base = Decimal("0.75")
    cobranca.tarifa_assinatura = Decimal("0.525")  # 30% desconto
    cobranca.fio_b = Decimal("0")

    # Valores energia
    cobranca.valor_energia_base = Decimal("187.50")
    cobranca.valor_energia_assinatura = Decimal("131.25")

    # GD I - Taxa mínima (50 kWh para bifásico)
    cobranca.taxa_minima_kwh = 50
    cobranca.taxa_minima_valor = Decimal("37.50")
    cobranca.energia_excedente_kwh = 0
    cobranca.energia_excedente_valor = Decimal("0")

    # GD II - não aplicável
    cobranca.disponibilidade_valor = Decimal("0")

    # Adicionais
    cobranca.bandeiras_valor = Decimal("15.00")
    cobranca.iluminacao_publica_valor = Decimal("35.82")
    cobranca.servicos_valor = Decimal("0")

    # Totais
    cobranca.valor_sem_assinatura = Decimal("238.32")
    cobranca.valor_com_assinatura = Decimal("88.32")
    cobranca.economia_mes = Decimal("56.25")
    cobranca.valor_total = Decimal("88.32")

    # Datas
    cobranca.vencimento = date(2024, 12, 20)

    # Dados do beneficiário
    beneficiario = {
        "nome": "João da Silva Santos",
        "endereco": "Rua das Flores",
        "numero": "123",
        "cidade": "São Paulo - SP"
    }

    return dados_fatura, cobranca, beneficiario


def criar_dados_teste_gdii():
    """Cria dados de teste para fatura GD II (com Lei 14.300)"""

    dados_fatura = FaturaExtraidaSchema(
        codigo_cliente="6/5036151-1",
        ligacao="TRIFASICO",
        data_apresentacao=date(2024, 12, 5),
        mes_ano_referencia="2024-11",
        vencimento=date(2024, 12, 20),
        total_a_pagar=Decimal("156.82"),
        leitura_anterior_data=date(2024, 10, 12),
        leitura_atual_data=date(2024, 11, 11),
        dias=30,
        itens_fatura=ItensFaturaExtracted(
            consumo_kwh=ConsumoKwhExtracted(
                unidade="kWh",
                quantidade=180,
                preco_unit_com_tributos=Decimal("0.76"),
                valor=Decimal("136.80")
            ),
            energia_injetada_muc=[
                EnergiaInjetadaItemExtracted(
                    descricao="Energia Ativa Injetada mUC",
                    tipo_gd="GDII",
                    unidade="kWh",
                    quantidade=180,
                    preco_unit_com_tributos=Decimal("0.60"),
                    valor=Decimal("-108.00")
                )
            ],
            ajuste_lei_14300=AjusteLei14300Extracted(
                descricao="Ajuste Lei 14.300/2022",
                unidade="kWh",
                quantidade=50,
                preco_unit_com_tributos=Decimal("0.76"),
                valor=Decimal("38.00")
            ),
            lancamentos_e_servicos=[
                LancamentoServicoExtracted(descricao="Iluminação Pública", valor=Decimal("42.50")),
                LancamentoServicoExtracted(descricao="Adicional Bandeira Amarela", valor=Decimal("8.50"))
            ]
        ),
        totais=TotaisExtracted(
            adicionais_bandeira=Decimal("8.50"),
            lancamentos_e_servicos=Decimal("42.50")
        )
    )

    cobranca = CobrancaCalculada()
    cobranca.modelo_gd = "GDII"
    cobranca.tipo_ligacao = "TRIFASICO"
    cobranca.consumo_kwh = 180
    cobranca.injetada_kwh = 180
    cobranca.compensado_kwh = 180
    cobranca.gap_kwh = 0
    cobranca.tarifa_base = Decimal("0.76")
    cobranca.tarifa_assinatura = Decimal("0.532")
    cobranca.fio_b = Decimal("0")
    cobranca.valor_energia_base = Decimal("136.80")
    cobranca.valor_energia_assinatura = Decimal("95.76")

    # GD I - não aplicável
    cobranca.taxa_minima_kwh = 0
    cobranca.taxa_minima_valor = Decimal("0")
    cobranca.energia_excedente_kwh = 0
    cobranca.energia_excedente_valor = Decimal("0")

    # GD II - Disponibilidade Lei 14.300
    cobranca.disponibilidade_valor = Decimal("38.00")

    cobranca.bandeiras_valor = Decimal("8.50")
    cobranca.iluminacao_publica_valor = Decimal("42.50")
    cobranca.servicos_valor = Decimal("0")

    cobranca.valor_sem_assinatura = Decimal("187.80")
    cobranca.valor_com_assinatura = Decimal("142.26")
    cobranca.economia_mes = Decimal("41.04")
    cobranca.valor_total = Decimal("184.76")

    cobranca.vencimento = date(2024, 12, 20)

    beneficiario = {
        "nome": "Maria Oliveira Costa",
        "endereco": "Av. Principal",
        "numero": "456",
        "cidade": "Belo Horizonte - MG"
    }

    return dados_fatura, cobranca, beneficiario


def testar_geracao_gdi():
    """Testa geração de relatório GD I"""
    print("\n" + "="*80)
    print("TESTE 1: Geração de Relatório GD I (Taxa Mínima)")
    print("="*80)

    dados_fatura, cobranca, beneficiario = criar_dados_teste_gdi()
    generator = ReportGenerator()

    html = generator.gerar_html(
        cobranca=cobranca,
        dados_fatura=dados_fatura,
        beneficiario=beneficiario,
        qr_code_pix=None,
        pix_copia_cola="00020126580014br.gov.bcb.pix0136teste@exemplo.com.br5204000053039865802BR5925SIMPLEX SOLUCOES LTDA6009SAO PAULO62070503***6304ABCD"
    )

    # Validações
    assert html, "❌ HTML não foi gerado"
    assert "GDI" in html, "❌ Modelo GD I não aparece no HTML"
    assert "João da Silva Santos" in html, "❌ Nome do beneficiário não aparece"
    assert "R$ 88,32" in html, "❌ Valor total incorreto"
    assert "Taxa mínima" in html, "❌ Taxa mínima não aparece (GD I)"
    assert "BIFASICO" in html or "50 kWh" in html, "❌ Tipo de ligação não aparece"
    assert "R$ 56,25" in html, "❌ Economia do mês incorreta"
    assert "Iluminação Pública" in html, "❌ Iluminação pública não aparece"
    assert "QR CODE" in html.upper(), "❌ Seção PIX não aparece"

    print("✅ Todos os testes de GD I passaram!")
    print(f"   - Tamanho do HTML: {len(html)} caracteres")
    print(f"   - Modelo GD: {cobranca.modelo_gd}")
    print(f"   - Valor Total: R$ {cobranca.valor_total}")
    print(f"   - Economia: R$ {cobranca.economia_mes}")

    # Salvar HTML para inspeção visual
    with open("test_relatorio_gdi.html", "w", encoding="utf-8") as f:
        f.write(html)
    print("   - HTML salvo em: test_relatorio_gdi.html")

    return True


def testar_geracao_gdii():
    """Testa geração de relatório GD II"""
    print("\n" + "="*80)
    print("TESTE 2: Geração de Relatório GD II (Lei 14.300)")
    print("="*80)

    dados_fatura, cobranca, beneficiario = criar_dados_teste_gdii()
    generator = ReportGenerator()

    html = generator.gerar_html(
        cobranca=cobranca,
        dados_fatura=dados_fatura,
        beneficiario=beneficiario,
        qr_code_pix="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        pix_copia_cola=None
    )

    # Validações
    assert html, "❌ HTML não foi gerado"
    assert "GDII" in html or "GD II" in html, "❌ Modelo GD II não aparece no HTML"
    assert "Maria Oliveira Costa" in html, "❌ Nome do beneficiário não aparece"
    assert "R$ 184,76" in html, "❌ Valor total incorreto"
    assert "Disponibilidade" in html or "Lei 14.300" in html, "❌ Disponibilidade GD II não aparece"
    assert "TRIFASICO" in html or "50" in html, "❌ Referência à disponibilidade não aparece"
    assert "R$ 41,04" in html, "❌ Economia do mês incorreta"
    assert "data:image/png;base64" in html, "❌ QR Code base64 não aparece"

    print("✅ Todos os testes de GD II passaram!")
    print(f"   - Tamanho do HTML: {len(html)} caracteres")
    print(f"   - Modelo GD: {cobranca.modelo_gd}")
    print(f"   - Valor Total: R$ {cobranca.valor_total}")
    print(f"   - Economia: R$ {cobranca.economia_mes}")
    print(f"   - Disponibilidade: R$ {cobranca.disponibilidade_valor}")

    # Salvar HTML para inspeção visual
    with open("test_relatorio_gdii.html", "w", encoding="utf-8") as f:
        f.write(html)
    print("   - HTML salvo em: test_relatorio_gdii.html")

    return True


def testar_formatacoes():
    """Testa formatações específicas"""
    print("\n" + "="*80)
    print("TESTE 3: Formatações e Edge Cases")
    print("="*80)

    generator = ReportGenerator()

    # Testar formatação de moeda
    assert generator._fmt_money(Decimal("1234.56")) == "R$ 1.234,56", "❌ Formatação de moeda incorreta"
    assert generator._fmt_money(Decimal("0.99")) == "R$ 0,99", "❌ Formatação de centavos incorreta"
    assert generator._fmt_money(Decimal("1000000.00")) == "R$ 1.000.000,00", "❌ Formatação de milhão incorreta"

    # Testar formatação de números
    assert generator._fmt_number(1234.5) == "1.235", "❌ Formatação de número incorreta"
    assert generator._fmt_number(999) == "999", "❌ Formatação de número pequeno incorreta"

    print("✅ Todos os testes de formatação passaram!")
    print("   - Formatação de moeda: OK")
    print("   - Formatação de números: OK")

    return True


def main():
    """Executa todos os testes"""
    print("\n" + "="*80)
    print("INICIANDO TESTES DE GERAÇÃO DE RELATÓRIOS")
    print("="*80)

    try:
        # Executar testes
        resultado_gdi = testar_geracao_gdi()
        resultado_gdii = testar_geracao_gdii()
        resultado_format = testar_formatacoes()

        # Resumo
        print("\n" + "="*80)
        print("RESUMO DOS TESTES")
        print("="*80)
        print(f"✅ Teste GD I (Taxa Mínima): {'PASSOU' if resultado_gdi else 'FALHOU'}")
        print(f"✅ Teste GD II (Lei 14.300): {'PASSOU' if resultado_gdii else 'FALHOU'}")
        print(f"✅ Teste de Formatações: {'PASSOU' if resultado_format else 'FALHOU'}")
        print("\n🎉 TODOS OS TESTES PASSARAM COM SUCESSO!")
        print("\nArquivos gerados:")
        print("  - test_relatorio_gdi.html")
        print("  - test_relatorio_gdii.html")
        print("\nAbra os arquivos HTML no navegador para inspeção visual.")

        return 0

    except AssertionError as e:
        print(f"\n❌ ERRO: {str(e)}")
        return 1
    except Exception as e:
        print(f"\n❌ ERRO INESPERADO: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit(main())
