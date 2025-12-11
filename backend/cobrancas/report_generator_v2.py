"""
Gerador de Relatórios HTML V2 - Design Moderno e Surpreendente

Gera relatórios HTML com design profissional, gráficos visuais e animações.
"""

from typing import Optional
from decimal import Decimal
from datetime import date

from backend.cobrancas.calculator import CobrancaCalculada
from backend.faturas.extraction_schemas import FaturaExtraidaSchema


class ReportGeneratorV2:
    """Gerador de relatórios HTML com design moderno"""

    def __init__(self):
        self.logo_url = "https://baserow.simplexsolucoes.com.br/media/user_files/WE8kutKMAmL1PMICsfR9k56kUHaNYz8p_4566a63159be5bf535dc3a25811394b215dcd9a04a1a44d9f14321e296b6a9c3.png"

    def gerar_html(
        self,
        cobranca: CobrancaCalculada,
        dados_fatura: FaturaExtraidaSchema,
        beneficiario: dict,
        qr_code_pix: Optional[str] = None,
        pix_copia_cola: Optional[str] = None
    ) -> str:
        """Gera HTML do relatório com design moderno"""

        # Dados básicos
        titular = beneficiario.get("nome", "")
        endereco = self._formatar_endereco(beneficiario)
        ano, mes = dados_fatura.obter_mes_ano_tuple()
        mes_ano_ref = dados_fatura.mes_ano_referencia or f"{ano:04d}-{mes:02d}"
        leitura_txt = self._formatar_periodo_leitura(dados_fatura)
        vencimento_str = cobranca.vencimento.strftime("%d/%m/%Y") if cobranca.vencimento else ""

        # Percentual de economia
        if cobranca.valor_sem_assinatura > 0:
            perc_economia = (cobranca.economia_mes / cobranca.valor_sem_assinatura) * 100
        else:
            perc_economia = 0

        # Gerar seções
        grafico_economia = self._gerar_grafico_economia(cobranca, perc_economia)
        detalhamento = self._gerar_detalhamento_calculo(cobranca, dados_fatura)
        itens_tabela = self._gerar_itens_tabela(cobranca, dados_fatura)
        pix_section = self._gerar_secao_pix(qr_code_pix, pix_copia_cola)

        # Montar HTML
        html = f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Fatura de Energia por Assinatura - {mes_ano_ref}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
{self._get_css_moderno()}
</style>
</head>
<body>

<div class="page-container">
  <!-- Hero Header -->
  <div class="hero-header">
    <div class="header-top">
      <img src="{self.logo_url}" alt="Logo" class="logo">
      <div class="badge-modelo">{cobranca.modelo_gd}</div>
    </div>
    <h1 class="title">Fatura de Energia por Assinatura</h1>
    <div class="subtitle">Referência: {mes_ano_ref}</div>
    <div class="promo-tag">30% DE DESCONTO sobre a energia injetada</div>
  </div>

  <!-- Valor Total Destacado -->
  <div class="total-card">
    <div class="total-label">Valor Total</div>
    <div class="total-valor">{self._fmt_money(cobranca.valor_total)}</div>
    <div class="total-vencimento">Vencimento: <strong>{vencimento_str}</strong></div>
  </div>

  <!-- Informações do Cliente -->
  <div class="info-card">
    <div class="info-title">Informações do Cliente</div>
    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">Titular</div>
        <div class="info-value">{titular}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Endereço</div>
        <div class="info-value">{endereco}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Período</div>
        <div class="info-value">{leitura_txt}</div>
      </div>
    </div>
  </div>

  <!-- Gráfico de Economia -->
  {grafico_economia}

  <!-- Itens da Fatura -->
  <div class="section-card">
    <div class="section-title">Detalhamento da Fatura</div>
    <table class="items-table">
      <thead>
        <tr>
          <th>Descrição</th>
          <th class="text-center">kWh</th>
          <th class="text-right">Valor</th>
        </tr>
      </thead>
      <tbody>
        {itens_tabela}
      </tbody>
    </table>
  </div>

  <!-- Detalhamento do Cálculo -->
  {detalhamento}

  <!-- Seção PIX -->
  {pix_section}

  <!-- Footer -->
  <div class="footer">
    <div class="footer-text">
      Dúvidas? Entre em contato conosco pelo email suporte@simplexsolucoes.com.br
    </div>
    <div class="footer-small">
      Este é um documento gerado automaticamente. Verifique todas as informações antes do pagamento.
    </div>
  </div>
</div>

<script>
// Animação de entrada
document.addEventListener('DOMContentLoaded', function() {{
  const cards = document.querySelectorAll('.info-card, .section-card, .total-card, .economia-card');
  cards.forEach((card, index) => {{
    setTimeout(() => {{
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';
    }}, index * 100);
  }});
}});
</script>

</body>
</html>"""

        return html

    def _gerar_grafico_economia(self, cobranca: CobrancaCalculada, perc_economia: float) -> str:
        """Gera gráfico visual de economia"""
        sem_desc = float(cobranca.valor_sem_assinatura)
        com_desc = float(cobranca.valor_com_assinatura)
        max_val = sem_desc if sem_desc > 0 else 100

        # Calcular larguras das barras (percentual)
        largura_sem = 100
        largura_com = (com_desc / max_val * 100) if max_val > 0 else 0

        return f"""
  <div class="economia-card">
    <div class="economia-header">
      <div class="economia-title">Sua Economia com a Assinatura</div>
      <div class="economia-badge">{perc_economia:.0f}%</div>
    </div>

    <div class="grafico-container">
      <div class="grafico-item">
        <div class="grafico-label">Sem Assinatura</div>
        <div class="grafico-bar-wrapper">
          <div class="grafico-bar bar-sem" style="width: {largura_sem}%"></div>
          <span class="grafico-valor">{self._fmt_money(cobranca.valor_sem_assinatura)}</span>
        </div>
      </div>

      <div class="grafico-item">
        <div class="grafico-label">Com Assinatura</div>
        <div class="grafico-bar-wrapper">
          <div class="grafico-bar bar-com" style="width: {largura_com}%"></div>
          <span class="grafico-valor">{self._fmt_money(cobranca.valor_com_assinatura)}</span>
        </div>
      </div>
    </div>

    <div class="economia-footer">
      <div class="economia-valor-label">Você economiza</div>
      <div class="economia-valor-destaque">{self._fmt_money(cobranca.economia_mes)}</div>
      <div class="economia-valor-sublabel">neste mês com o desconto de 30%</div>
    </div>
  </div>"""

    def _gerar_detalhamento_calculo(self, cobranca: CobrancaCalculada, dados: FaturaExtraidaSchema) -> str:
        """Gera seção de detalhamento do cálculo"""
        return f"""
  <div class="section-card detalhamento">
    <div class="section-title">Como Calculamos Seu Desconto</div>

    <div class="calc-grid">
      <div class="calc-item">
        <div class="calc-icon">⚡</div>
        <div class="calc-label">Energia Injetada</div>
        <div class="calc-value">{self._fmt_number(cobranca.injetada_kwh)} kWh</div>
      </div>

      <div class="calc-item">
        <div class="calc-icon">💰</div>
        <div class="calc-label">Tarifa Base</div>
        <div class="calc-value">R$ {float(cobranca.tarifa_base):.4f}/kWh</div>
      </div>

      <div class="calc-item">
        <div class="calc-icon">🎯</div>
        <div class="calc-label">Tarifa com Desconto</div>
        <div class="calc-value">R$ {float(cobranca.tarifa_assinatura):.4f}/kWh</div>
      </div>

      <div class="calc-item highlight">
        <div class="calc-icon">✨</div>
        <div class="calc-label">Desconto Aplicado</div>
        <div class="calc-value">30%</div>
      </div>
    </div>

    <div class="calc-formula">
      <div class="formula-step">
        <span class="formula-label">Valor sem desconto:</span>
        <span class="formula-calc">{self._fmt_number(cobranca.injetada_kwh)} kWh × R$ {float(cobranca.tarifa_base):.4f} = {self._fmt_money(cobranca.valor_energia_base)}</span>
      </div>
      <div class="formula-step">
        <span class="formula-label">Valor com desconto:</span>
        <span class="formula-calc">{self._fmt_number(cobranca.injetada_kwh)} kWh × R$ {float(cobranca.tarifa_assinatura):.4f} = {self._fmt_money(cobranca.valor_energia_assinatura)}</span>
      </div>
    </div>
  </div>"""

    def _gerar_itens_tabela(self, cobranca: CobrancaCalculada, dados: FaturaExtraidaSchema) -> str:
        """Gera linhas da tabela de itens"""
        linhas = []

        # Energia injetada
        if cobranca.injetada_kwh > 0:
            linhas.append(f"""
        <tr>
          <td>Energia injetada no período (com 30% desconto)</td>
          <td class="text-center">{self._fmt_number(cobranca.injetada_kwh)}</td>
          <td class="text-right valor-destaque">{self._fmt_money(cobranca.valor_energia_assinatura)}</td>
        </tr>""")

        # GD I - Taxa mínima ou excedente
        if cobranca.modelo_gd == "GDI":
            if cobranca.energia_excedente_valor > 0:
                linhas.append(f"""
        <tr>
          <td>Energia excedente consumida da rede</td>
          <td class="text-center">{self._fmt_number(cobranca.energia_excedente_kwh)}</td>
          <td class="text-right">{self._fmt_money(cobranca.energia_excedente_valor)}</td>
        </tr>""")
            elif cobranca.taxa_minima_valor > 0:
                linhas.append(f"""
        <tr>
          <td>Taxa mínima ({cobranca.tipo_ligacao} - {cobranca.taxa_minima_kwh} kWh)</td>
          <td class="text-center">{cobranca.taxa_minima_kwh}</td>
          <td class="text-right">{self._fmt_money(cobranca.taxa_minima_valor)}</td>
        </tr>""")

        # GD II - Disponibilidade
        if cobranca.modelo_gd == "GDII" and cobranca.disponibilidade_valor > 0:
            kwh_disp = dados.itens_fatura.ajuste_lei_14300.quantidade if dados.itens_fatura.ajuste_lei_14300 else None
            linhas.append(f"""
        <tr>
          <td>Disponibilidade (Lei 14.300/2022)</td>
          <td class="text-center">{self._fmt_number(kwh_disp) if kwh_disp else '-'}</td>
          <td class="text-right">{self._fmt_money(cobranca.disponibilidade_valor)}</td>
        </tr>""")

        # Bandeiras
        if cobranca.bandeiras_valor > 0:
            linhas.append(f"""
        <tr>
          <td>Bandeiras e ajustes tarifários</td>
          <td class="text-center">-</td>
          <td class="text-right">{self._fmt_money(cobranca.bandeiras_valor)}</td>
        </tr>""")

        # Iluminação pública
        if cobranca.iluminacao_publica_valor > 0:
            linhas.append(f"""
        <tr>
          <td>Contribuição de Iluminação Pública</td>
          <td class="text-center">-</td>
          <td class="text-right">{self._fmt_money(cobranca.iluminacao_publica_valor)}</td>
        </tr>""")

        # Serviços
        if cobranca.servicos_valor > 0:
            linhas.append(f"""
        <tr>
          <td>Serviços e créditos diversos</td>
          <td class="text-center">-</td>
          <td class="text-right">{self._fmt_money(cobranca.servicos_valor)}</td>
        </tr>""")

        # Total
        linhas.append(f"""
        <tr class="row-total">
          <td><strong>TOTAL A PAGAR</strong></td>
          <td class="text-center">-</td>
          <td class="text-right"><strong>{self._fmt_money(cobranca.valor_total)}</strong></td>
        </tr>""")

        return "".join(linhas)

    def _gerar_secao_pix(self, qr_code_base64: Optional[str], pix_copia_cola: Optional[str]) -> str:
        """Gera seção de pagamento PIX"""
        if not qr_code_base64 and not pix_copia_cola:
            return ""

        qr_html = ""
        if qr_code_base64:
            qr_html = f'<img class="qr-image" src="data:image/png;base64,{qr_code_base64}" alt="QR Code PIX">'
        else:
            qr_html = '<div class="qr-placeholder">QR Code será disponibilizado em breve</div>'

        pix_texto = ""
        if pix_copia_cola:
            pix_texto = f"""
      <div class="pix-copia-cola">
        <div class="pix-copia-label">Código PIX Copia e Cola:</div>
        <div class="pix-copia-codigo">{pix_copia_cola}</div>
        <button class="btn-copiar" onclick="navigator.clipboard.writeText('{pix_copia_cola}')">Copiar Código</button>
      </div>"""

        return f"""
  <div class="pix-card">
    <div class="pix-header">
      <div class="pix-title">Pagar com PIX</div>
      <div class="pix-subtitle">Rápido, fácil e seguro</div>
    </div>

    <div class="pix-content">
      <div class="pix-qr">
        {qr_html}
      </div>

      <div class="pix-instrucoes">
        <h4>Como pagar:</h4>
        <ol>
          <li>Abra o app do seu banco</li>
          <li>Escolha pagar com PIX</li>
          <li>Escaneie o QR Code ou cole o código</li>
          <li>Confirme o pagamento</li>
        </ol>
      </div>
    </div>

    {pix_texto}
  </div>"""

    def _formatar_endereco(self, beneficiario: dict) -> str:
        """Formata endereço do beneficiário"""
        partes = []
        if beneficiario.get("endereco"):
            partes.append(beneficiario["endereco"])
        if beneficiario.get("numero"):
            partes.append(f"Nº {beneficiario['numero']}")
        endereco = ", ".join(partes) if partes else ""
        if beneficiario.get("cidade"):
            endereco += f" - {beneficiario['cidade']}"
        return endereco or "Endereço não informado"

    def _formatar_periodo_leitura(self, dados: FaturaExtraidaSchema) -> str:
        """Formata período de leitura"""
        if dados.leitura_anterior_data and dados.leitura_atual_data:
            leit_ant = dados.leitura_anterior_data.strftime("%d/%m/%Y")
            leit_atual = dados.leitura_atual_data.strftime("%d/%m/%Y")
            dias_txt = f" ({dados.dias} dias)" if dados.dias else ""
            return f"De {leit_ant} até {leit_atual}{dias_txt}"
        return "Período não informado"

    def _fmt_money(self, valor: Decimal) -> str:
        """Formata valor monetário"""
        return f"R$ {float(valor):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

    def _fmt_number(self, numero: float) -> str:
        """Formata número (sem símbolo de moeda)"""
        return f"{float(numero):,.0f}".replace(",", ".")

    def _get_css_moderno(self) -> str:
        """Retorna CSS moderno com gradientes, sombras e animações"""
        return """
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
  min-height: 100vh;
}

.page-container {
  max-width: 900px;
  margin: 0 auto;
  background: #fff;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

/* Hero Header */
.hero-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 40px 30px;
  text-align: center;
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.logo {
  height: 50px;
  filter: brightness(0) invert(1);
}

.badge-modelo {
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 1px;
}

.title {
  font-size: 32px;
  font-weight: 800;
  margin-bottom: 8px;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
}

.subtitle {
  font-size: 16px;
  opacity: 0.95;
  margin-bottom: 16px;
}

.promo-tag {
  display: inline-block;
  background: #ffd700;
  color: #333;
  padding: 10px 24px;
  border-radius: 25px;
  font-weight: 700;
  font-size: 14px;
  box-shadow: 0 4px 15px rgba(255, 215, 0, 0.4);
}

/* Total Card */
.total-card {
  background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
  color: white;
  padding: 30px;
  text-align: center;
  margin: -30px 30px 30px;
  border-radius: 15px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  opacity: 0;
  transform: translateY(20px);
  transition: all 0.6s ease;
}

.total-label {
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 2px;
  opacity: 0.9;
  margin-bottom: 8px;
}

.total-valor {
  font-size: 48px;
  font-weight: 800;
  margin-bottom: 8px;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
}

.total-vencimento {
  font-size: 14px;
  opacity: 0.95;
}

/* Info Card */
.info-card,
.section-card,
.economia-card,
.pix-card {
  background: white;
  margin: 0 30px 20px;
  padding: 25px;
  border-radius: 15px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
  opacity: 0;
  transform: translateY(20px);
  transition: all 0.6s ease;
}

.info-title,
.section-title {
  font-size: 18px;
  font-weight: 700;
  color: #333;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 3px solid #667eea;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 15px;
}

.info-item {
  padding: 15px;
  background: #f8f9fa;
  border-radius: 10px;
  border-left: 4px solid #667eea;
}

.info-label {
  font-size: 12px;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 5px;
}

.info-value {
  font-size: 15px;
  color: #333;
  font-weight: 600;
}

/* Economia Card */
.economia-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 25px;
}

.economia-title {
  font-size: 20px;
  font-weight: 700;
  color: #333;
}

.economia-badge {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
  padding: 10px 20px;
  border-radius: 25px;
  font-size: 24px;
  font-weight: 800;
  box-shadow: 0 4px 15px rgba(245, 87, 108, 0.3);
}

.grafico-container {
  margin-bottom: 25px;
}

.grafico-item {
  margin-bottom: 20px;
}

.grafico-label {
  font-size: 14px;
  font-weight: 600;
  color: #666;
  margin-bottom: 8px;
}

.grafico-bar-wrapper {
  position: relative;
  background: #f0f0f0;
  border-radius: 10px;
  overflow: hidden;
  height: 50px;
}

.grafico-bar {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 15px;
  transition: width 1.5s cubic-bezier(0.4, 0, 0.2, 1);
  animation: slideIn 1.5s ease-out;
}

@keyframes slideIn {
  from { width: 0 !important; }
}

.bar-sem {
  background: linear-gradient(90deg, #ff6b6b 0%, #ff8787 100%);
}

.bar-com {
  background: linear-gradient(90deg, #51cf66 0%, #69db7c 100%);
}

.grafico-valor {
  color: white;
  font-weight: 700;
  font-size: 16px;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.economia-footer {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
  border-radius: 12px;
  text-align: center;
  color: white;
}

.economia-valor-label {
  font-size: 14px;
  opacity: 0.9;
  margin-bottom: 5px;
}

.economia-valor-destaque {
  font-size: 36px;
  font-weight: 800;
  margin-bottom: 5px;
}

.economia-valor-sublabel {
  font-size: 13px;
  opacity: 0.85;
}

/* Tabela */
.items-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 15px;
}

.items-table thead th {
  background: #f8f9fa;
  padding: 12px;
  text-align: left;
  font-size: 13px;
  font-weight: 700;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 1px;
  border-bottom: 2px solid #667eea;
}

.items-table tbody td {
  padding: 15px 12px;
  border-bottom: 1px solid #e9ecef;
  font-size: 14px;
}

.items-table tbody tr:hover {
  background: #f8f9fa;
}

.row-total td {
  background: #f8f9fa;
  font-weight: 700;
  font-size: 16px;
  padding-top: 20px !important;
  padding-bottom: 20px !important;
}

.text-center {
  text-align: center !important;
}

.text-right {
  text-align: right !important;
}

.valor-destaque {
  color: #11998e;
  font-weight: 700;
}

/* Detalhamento */
.calc-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 15px;
  margin-bottom: 25px;
}

.calc-item {
  text-align: center;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 12px;
  transition: transform 0.3s ease;
}

.calc-item:hover {
  transform: translateY(-5px);
}

.calc-item.highlight {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.calc-icon {
  font-size: 32px;
  margin-bottom: 10px;
}

.calc-label {
  font-size: 12px;
  opacity: 0.7;
  margin-bottom: 5px;
}

.calc-value {
  font-size: 18px;
  font-weight: 700;
}

.calc-formula {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 10px;
  border-left: 4px solid #667eea;
}

.formula-step {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
  font-size: 14px;
}

.formula-step:last-child {
  margin-bottom: 0;
}

.formula-label {
  color: #666;
}

.formula-calc {
  font-weight: 600;
  color: #333;
}

/* PIX */
.pix-header {
  text-align: center;
  margin-bottom: 25px;
}

.pix-title {
  font-size: 24px;
  font-weight: 700;
  color: #333;
  margin-bottom: 5px;
}

.pix-subtitle {
  color: #666;
  font-size: 14px;
}

.pix-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 30px;
  margin-bottom: 25px;
}

.pix-qr {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 12px;
}

.qr-image {
  width: 200px;
  height: 200px;
  border-radius: 10px;
}

.qr-placeholder {
  width: 200px;
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #e9ecef;
  border-radius: 10px;
  color: #666;
  text-align: center;
  padding: 20px;
  font-size: 14px;
}

.pix-instrucoes {
  padding: 20px;
}

.pix-instrucoes h4 {
  color: #333;
  margin-bottom: 15px;
  font-size: 16px;
}

.pix-instrucoes ol {
  padding-left: 20px;
}

.pix-instrucoes li {
  margin-bottom: 10px;
  color: #666;
  line-height: 1.6;
}

.pix-copia-cola {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 10px;
  margin-top: 20px;
}

.pix-copia-label {
  font-size: 12px;
  color: #666;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.pix-copia-codigo {
  font-family: 'Courier New', monospace;
  font-size: 11px;
  background: white;
  padding: 12px;
  border-radius: 8px;
  border: 2px dashed #dee2e6;
  word-break: break-all;
  margin-bottom: 12px;
  max-height: 100px;
  overflow-y: auto;
}

.btn-copiar {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  width: 100%;
  transition: transform 0.2s ease;
}

.btn-copiar:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}

/* Footer */
.footer {
  background: #f8f9fa;
  padding: 30px;
  text-align: center;
  margin-top: 30px;
}

.footer-text {
  color: #666;
  margin-bottom: 10px;
  font-size: 14px;
}

.footer-small {
  color: #999;
  font-size: 12px;
}

/* Responsivo */
@media (max-width: 768px) {
  .page-container {
    border-radius: 0;
  }

  .total-valor {
    font-size: 36px;
  }

  .info-grid,
  .calc-grid {
    grid-template-columns: 1fr;
  }

  .pix-content {
    grid-template-columns: 1fr;
  }

  .hero-header {
    padding: 30px 20px;
  }

  .title {
    font-size: 24px;
  }
}

/* Impressão */
@media print {
  body {
    background: white;
    padding: 0;
  }

  .page-container {
    box-shadow: none;
    border-radius: 0;
  }

  .btn-copiar {
    display: none;
  }
}
"""


# Instância global
report_generator_v2 = ReportGeneratorV2()
