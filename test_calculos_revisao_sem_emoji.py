"""
Script para revisar clculos de cobranas com dados reais

Este script:
1. Busca uma fatura real do banco de dados
2. Executa o clculo de cobrana
3. Exibe detalhadamente cada passo do clculo
4. Gera o HTML do relatrio
5. Permite validar se os valores esto corretos
"""

import sys
import os
from pathlib import Path
from decimal import Decimal
from datetime import date
import json

# Adicionar backend ao path
sys.path.insert(0, str(Path(__file__).parent / "backend"))

from backend.cobrancas.calculator import CobrancaCalculator
from backend.cobrancas.report_generator_v3 import ReportGeneratorV3
from backend.faturas.extraction_schemas import FaturaExtraidaSchema
from backend.core.database import get_supabase_admin


def buscar_fatura_real(fatura_id: int = 40595):
    """Busca fatura real do banco de dados"""
    print(f"\n{'='*80}")
    print(f"BUSCANDO FATURA ID {fatura_id} DO BANCO DE DADOS")
    print(f"{'='*80}\n")

    supabase = get_supabase_admin()

    # Buscar fatura com dados extrados
    response = supabase.table("faturas").select(
        "id, numero_fatura, mes_referencia, ano_referencia, "
        "dados_extraidos, extracao_status, extracao_score, uc_id"
    ).eq("id", fatura_id).execute()

    if not response.data or len(response.data) == 0:
        print(f" Fatura {fatura_id} no encontrada!")
        return None

    fatura = response.data[0]

    print(f" Fatura encontrada:")
    print(f"   - ID: {fatura['id']}")
    print(f"   - Nmero: {fatura['numero_fatura']}")
    print(f"   - Referncia: {fatura['mes_referencia']:02d}/{fatura['ano_referencia']}")
    print(f"   - UC ID: {fatura['uc_id']}")
    print(f"   - Status extrao: {fatura['extracao_status']}")
    print(f"   - Score: {fatura['extracao_score']}")

    if not fatura.get("dados_extraidos"):
        print(f"\n Fatura no tem dados extrados!")
        return None

    return fatura


def analisar_dados_extraidos(dados_dict: dict):
    """Analisa e exibe os dados extrados"""
    print(f"\n{'='*80}")
    print("DADOS EXTRADOS DA FATURA")
    print(f"{'='*80}\n")

    # Informaes bsicas
    print(" INFORMAES BSICAS:")
    print(f"   - Cdigo Cliente: {dados_dict.get('codigo_cliente', 'N/A')}")
    print(f"   - Ligao: {dados_dict.get('ligacao', 'N/A')}")
    print(f"   - Referncia: {dados_dict.get('mes_ano_referencia', 'N/A')}")
    print(f"   - Vencimento: {dados_dict.get('vencimento', 'N/A')}")
    print(f"   - Total a pagar: R$ {dados_dict.get('total_a_pagar', 0)}")

    # Leitura
    print(f"\n LEITURA:")
    print(f"   - Anterior: {dados_dict.get('leitura_anterior_data', 'N/A')}")
    print(f"   - Atual: {dados_dict.get('leitura_atual_data', 'N/A')}")
    print(f"   - Dias: {dados_dict.get('dias', 'N/A')}")

    # Itens da fatura
    itens = dados_dict.get('itens_fatura', {})

    print(f"\n CONSUMO:")
    consumo = itens.get('consumo_kwh', {})
    if consumo:
        print(f"   - Quantidade: {consumo.get('quantidade', 0)} kWh")
        print(f"   - Preo unitrio: R$ {consumo.get('preco_unit_com_tributos', 0)}")
        print(f"   - Valor: R$ {consumo.get('valor', 0)}")

    print(f"\n ENERGIA INJETADA:")

    # GD I (oUC)
    injetada_ouc = itens.get('energia_injetada_ouc', [])
    if injetada_ouc:
        print(f"   GD I (Mesma UC):")
        for item in injetada_ouc:
            print(f"      - {item.get('descricao', 'N/A')}")
            print(f"        Quantidade: {item.get('quantidade', 0)} kWh")
            print(f"        Preo unit: R$ {item.get('preco_unit_com_tributos', 0)}")
            print(f"        Valor: R$ {item.get('valor', 0)}")

    # GD II (mUC)
    injetada_muc = itens.get('energia_injetada_muc', [])
    if injetada_muc:
        print(f"   GD II (Mltiplas UCs):")
        for item in injetada_muc:
            print(f"      - {item.get('descricao', 'N/A')}")
            print(f"        Quantidade: {item.get('quantidade', 0)} kWh")
            print(f"        Preo unit: R$ {item.get('preco_unit_com_tributos', 0)}")
            print(f"        Valor: R$ {item.get('valor', 0)}")

    # Lei 14.300
    ajuste = itens.get('ajuste_lei_14300')
    if ajuste:
        print(f"\n  AJUSTE LEI 14.300/2022 (GD II):")
        print(f"   - Descrio: {ajuste.get('descricao', 'N/A')}")
        print(f"   - Quantidade: {ajuste.get('quantidade', 0)} kWh")
        print(f"   - Preo unit: R$ {ajuste.get('preco_unit_com_tributos', 0)}")
        print(f"   - Valor: R$ {ajuste.get('valor', 0)}")

    # Lanamentos
    print(f"\n LANAMENTOS E SERVIOS:")
    lancamentos = itens.get('lancamentos_e_servicos', [])
    if lancamentos:
        for lanc in lancamentos:
            print(f"   - {lanc.get('descricao', 'N/A')}: R$ {lanc.get('valor', 0)}")

    # Totais
    print(f"\n TOTAIS:")
    totais = dados_dict.get('totais', {})
    print(f"   - Adicionais bandeira: R$ {totais.get('adicionais_bandeira', 0)}")
    print(f"   - Lanamentos e servios: R$ {totais.get('lancamentos_e_servicos', 0)}")


def executar_calculo_detalhado(dados_extraidos: FaturaExtraidaSchema, tarifa_aneel=None):
    """Executa clculo detalhado e exibe cada passo"""
    print(f"\n{'='*80}")
    print("EXECUTANDO CLCULO DE COBRANA")
    print(f"{'='*80}\n")

    calculator = CobrancaCalculator()

    # Validar dados mnimos
    print(" Validando dados mnimos...")
    valido, erro = calculator.validar_dados_minimos(dados_extraidos)
    if not valido:
        print(f" Dados insuficientes: {erro}")
        return None
    print(" Dados vlidos para clculo")

    # Executar clculo
    if tarifa_aneel:
        print(f"\n Calculando cobrana (Tarifa fornecida: R$ {tarifa_aneel}/kWh)...")
    else:
        print(f"\n Calculando cobrana (Tarifa ser EXTRAIDA DA FATURA)...")

    cobranca = calculator.calcular_cobranca(
        dados_extraidos=dados_extraidos,
        tarifa_aneel=tarifa_aneel
    )

    # Exibir resultado detalhado
    print(f"\n{'='*80}")
    print("RESULTADO DO CLCULO")
    print(f"{'='*80}\n")

    print(" MODELO E TIPO:")
    print(f"   - Modelo GD: {cobranca.modelo_gd}")
    print(f"   - Tipo ligao: {cobranca.tipo_ligacao}")

    print(f"\n MTRICAS DE ENERGIA:")
    print(f"   - Consumo total: {cobranca.consumo_kwh:.0f} kWh")
    print(f"   - Energia injetada: {cobranca.injetada_kwh:.0f} kWh")
    print(f"   - Compensado: {cobranca.compensado_kwh:.0f} kWh")
    print(f"   - Gap (consumo - compensado): {cobranca.gap_kwh:.0f} kWh")

    print(f"\n TARIFAS:")
    print(f"   - Tarifa base (ANEEL): R$ {cobranca.tarifa_base:.6f}/kWh")
    print(f"   - Tarifa assinatura (70%): R$ {cobranca.tarifa_assinatura:.6f}/kWh")
    print(f"   - Desconto: 30%")

    print(f"\n VALORES DE ENERGIA:")
    print(f"   - Energia sem desconto: {cobranca.injetada_kwh:.0f} kWh  R$ {cobranca.tarifa_base:.6f} = R$ {cobranca.valor_energia_base:.2f}")
    print(f"   - Energia com desconto: {cobranca.injetada_kwh:.0f} kWh  R$ {cobranca.tarifa_assinatura:.6f} = R$ {cobranca.valor_energia_assinatura:.2f}")

    if cobranca.modelo_gd == "GDI":
        print(f"\n ENCARGOS GD I:")
        if cobranca.taxa_minima_valor > 0:
            print(f"   - Taxa mnima: {cobranca.taxa_minima_kwh} kWh  R$ {cobranca.tarifa_base:.6f} = R$ {cobranca.taxa_minima_valor:.2f}")
        if cobranca.energia_excedente_valor > 0:
            print(f"   - Energia excedente: {cobranca.energia_excedente_kwh} kWh  R$ {cobranca.tarifa_base:.6f} = R$ {cobranca.energia_excedente_valor:.2f}")

    elif cobranca.modelo_gd == "GDII":
        print(f"\n  ENCARGOS GD II:")
        if cobranca.disponibilidade_valor > 0:
            print(f"   - Disponibilidade (Lei 14.300): R$ {cobranca.disponibilidade_valor:.2f}")

    print(f"\n ADICIONAIS:")
    if cobranca.bandeiras_valor > 0:
        print(f"   - Bandeiras: R$ {cobranca.bandeiras_valor:.2f}")
    if cobranca.iluminacao_publica_valor > 0:
        print(f"   - Iluminao pblica: R$ {cobranca.iluminacao_publica_valor:.2f}")
    if cobranca.servicos_valor > 0:
        print(f"   - Servios: R$ {cobranca.servicos_valor:.2f}")

    print(f"\n TOTAIS:")
    print(f"   - SEM assinatura: R$ {cobranca.valor_sem_assinatura:.2f}")
    print(f"   - COM assinatura: R$ {cobranca.valor_com_assinatura:.2f}")
    print(f"   - ECONOMIA: R$ {cobranca.economia_mes:.2f} (30%)")
    print(f"   - VALOR TOTAL A PAGAR: R$ {cobranca.valor_total:.2f}")

    print(f"\n VENCIMENTO:")
    print(f"   - Vencimento sugerido: {cobranca.vencimento}")

    return cobranca


def gerar_relatorio_html(cobranca, dados_fatura, beneficiario):
    """Gera relatrio HTML"""
    print(f"\n{'='*80}")
    print("GERANDO RELATRIO HTML")
    print(f"{'='*80}\n")

    generator = ReportGeneratorV3()

    html = generator.gerar_html(
        cobranca=cobranca,
        dados_fatura=dados_fatura,
        beneficiario=beneficiario,
        qr_code_pix=None,
        pix_copia_cola=None,
        economia_acumulada=0.0  # Pode ser buscado do banco de dados
    )

    # Salvar HTML
    filename = f"revisao_calculo_fatura_{dados_fatura.mes_ano_referencia or 'teste'}.html"
    with open(filename, "w", encoding="utf-8") as f:
        f.write(html)

    print(f" Relatrio HTML gerado:")
    print(f"   - Arquivo: {filename}")
    print(f"   - Tamanho: {len(html)} caracteres")
    print(f"   - Abra o arquivo no navegador para visualizar")

    return filename


def main():
    """Funo principal"""
    print("\n" + "="*80)
    print("REVISO DE CLCULOS DE COBRANAS")
    print("="*80)

    # 1. Buscar fatura real
    fatura = buscar_fatura_real(40595)
    if not fatura:
        return 1

    dados_dict = fatura['dados_extraidos']

    # 2. Analisar dados extrados
    analisar_dados_extraidos(dados_dict)

    # 3. Converter para schema
    print(f"\n{'='*80}")
    print("CONVERTENDO PARA SCHEMA")
    print(f"{'='*80}\n")

    try:
        dados_fatura = FaturaExtraidaSchema(**dados_dict)
        print(" Dados convertidos com sucesso")
    except Exception as e:
        print(f" Erro ao converter dados: {e}")
        return 1

    # 4. Executar clculo detalhado (SEM passar tarifa - ser extraída da fatura)
    cobranca = executar_calculo_detalhado(dados_fatura, None)

    if not cobranca:
        return 1

    # 5. Buscar informaes do beneficirio
    print(f"\n{'='*80}")
    print("BUSCANDO INFORMAES DO BENEFICIRIO")
    print(f"{'='*80}\n")

    supabase = get_supabase_admin()

    # Buscar UC para pegar beneficirio
    uc_response = supabase.table("unidades_consumidoras").select(
        "id, endereco, cidade"
    ).eq("id", fatura['uc_id']).execute()

    # Buscar beneficirios da UC
    benef_response = supabase.table("beneficiarios").select(
        "id, nome, cpf, email, telefone"
    ).eq("uc_id", fatura['uc_id']).eq("status", "ATIVO").execute()

    if benef_response.data and len(benef_response.data) > 0:
        beneficiario = benef_response.data[0]
        # Adicionar dados da UC ao beneficiario
        if uc_response.data and len(uc_response.data) > 0:
            uc_data = uc_response.data[0]
            beneficiario["endereco"] = uc_data.get("endereco", "")
            beneficiario["cidade"] = uc_data.get("cidade", "")
            beneficiario["numero"] = ""
        print(f" Beneficirio encontrado:")
        print(f"   - Nome: {beneficiario.get('nome', 'N/A')}")
        print(f"   - CPF: {beneficiario.get('cpf', 'N/A')}")
    else:
        # Mock de beneficirio
        beneficiario = {
            "nome": "Beneficirio Teste",
            "endereco": "Endereo no cadastrado",
            "numero": "",
            "cidade": "Cidade"
        }
        print("  Beneficirio no encontrado, usando dados mock")

    # 6. Gerar relatrio HTML
    arquivo_html = gerar_relatorio_html(cobranca, dados_fatura, beneficiario)

    # 7. Resumo final
    print(f"\n{'='*80}")
    print("RESUMO DA REVISO")
    print(f"{'='*80}\n")
    print(f" Fatura processada: ID {fatura['id']}")
    print(f" Modelo detectado: {cobranca.modelo_gd}")
    print(f" Clculo executado com sucesso")
    print(f" Relatrio HTML gerado: {arquivo_html}")
    print(f"\n VALORES FINAIS:")
    print(f"   - Energia injetada: {cobranca.injetada_kwh:.0f} kWh")
    print(f"   - Valor sem assinatura: R$ {cobranca.valor_sem_assinatura:.2f}")
    print(f"   - Valor com assinatura: R$ {cobranca.valor_com_assinatura:.2f}")
    print(f"   - Economia: R$ {cobranca.economia_mes:.2f}")
    print(f"   - TOTAL A PAGAR: R$ {cobranca.valor_total:.2f}")

    print(f"\n{'='*80}")
    print("REVISO CONCLUDA!")
    print(f"{'='*80}\n")

    return 0


if __name__ == "__main__":
    exit(main())
