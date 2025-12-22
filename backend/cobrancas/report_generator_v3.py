"""
Gerador de Relatórios HTML V3 - Baseado no código n8n
Análise completa da fatura com todos os detalhes de GD I/II
"""

from typing import Optional
from decimal import Decimal
from datetime import date

from backend.cobrancas.calculator import CobrancaCalculada
from backend.faturas.extraction_schemas import FaturaExtraidaSchema


class ReportGeneratorV3:
    """Gerador de relatórios HTML baseado no código n8n"""

    def __init__(self):
        self.logo_url = "https://baserow.simplexsolucoes.com.br/media/user_files/WE8kutKMAmL1PMICsfR9k56kUHaNYz8p_4566a63159be5bf535dc3a25811394b215dcd9a04a1a44d9f14321e296b6a9c3.png"
        self.apontou_img = "https://baserow.simplexsolucoes.com.br/media/user_files/5v07HJhMjzvEmtcUCUnswsTMuP8flFcE_27154fb0fd0d64e7a375f5c78eba2a289604d297b46d93963bd25f875beee87f.png"

    def gerar_html(
        self,
        cobranca: CobrancaCalculada,
        dados_fatura: FaturaExtraidaSchema,
        beneficiario: dict,
        qr_code_pix: Optional[str] = None,
        pix_copia_cola: Optional[str] = None,
        economia_acumulada: float = 0.0,
        incluir_secao_pix: bool = True
    ) -> str:
        """Gera HTML do relatório completo baseado no código n8n

        Args:
            incluir_secao_pix: Se False, não inclui a seção de PIX no relatório.
                               Útil para RASCUNHO onde ainda não há PIX gerado.
        """

        # Dados básicos
        titular = beneficiario.get("nome", "")
        endereco = self._formatar_endereco(beneficiario)
        ano, mes = dados_fatura.obter_mes_ano_tuple()
        mes_ano_ref = dados_fatura.mes_ano_referencia or f"{ano:04d}-{mes:02d}"
        leitura_txt = self._formatar_periodo_leitura(dados_fatura)
        vencimento_str = cobranca.vencimento.strftime("%d/%m/%Y") if cobranca.vencimento else ""

        # Compensação (GD I ou GD II)
        compensacao_tipo = f"GD {cobranca.modelo_gd[2:]}" if cobranca.modelo_gd != "DESCONHECIDO" else "GD"

        # Economia acumulada
        economia_mes = float(cobranca.economia_mes)
        acumulado_atual = economia_acumulada + economia_mes

        # Gerar itens da tabela (seguindo padrão n8n)
        itens_tabela = self._gerar_itens_tabela_n8n(cobranca, dados_fatura)

        # HTML final
        html = f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Fatura de Energia por Assinatura - {mes_ano_ref}</title>
<style>
{self._get_css_n8n()}
</style>
</head>
<body>
<div class="container">
  <!-- Cabeçalho -->
  <div class="content-block">
    <div class="header-block">
      <img src="{self.logo_url}" alt="Logo" class="logo-img">
      <div class="stamp-box">
        <h2>Fatura de Energia por Assinatura</h2>
        <div class="ref">REF: {mes_ano_ref} <span class="badge">Compensação: {compensacao_tipo}</span></div>
        <div class="discount">Desconto de 30% sobre a energia injetada!</div>
      </div>
    </div>
  </div>

  <!-- Cliente -->
  <div class="content-block">
    <div class="customer-block">
      <div class="customer-details">
        <div class="info-row"><div class="info-label">Titular:</div><div class="info-value">{titular}</div></div>
        <div class="info-row"><div class="info-label">Endereço:</div><div class="info-value">{endereco}</div></div>
        <div class="info-row"><div class="info-label">Data da leitura:</div><div class="info-value">{leitura_txt}</div></div>
      </div>
      <div class="total-box">
        <h3>Total a pagar com desconto</h3>
        <div class="total-value">{self._fmt_money(cobranca.valor_total)}</div>
        {f'<div class="due-date">Vencimento: <strong>{vencimento_str}</strong></div>' if vencimento_str else ''}
      </div>
    </div>
  </div>

  <!-- Tabela -->
  <div class="content-block">
    <div class="billing-block">
      <table class="billing-table">
        <thead>
          <tr><th>Itens da Fatura - Dados de faturamento</th><th class="center">kWh</th><th class="value-col">Valor</th></tr>
        </thead>
        <tbody>
          {itens_tabela}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Comparação energia compensada (onde o desconto de 30% é aplicado) -->
  <div class="content-block">
    <div class="comparison-block">
      <div class="comparison-grid">
        <div class="comparison-row">
          <div class="comparison-label">Sem a assinatura você pagaria:</div>
          <div class="comparison-value value-without">{self._fmt_money(cobranca.energia_compensada_sem_desconto)}</div>
        </div>
        <div class="comparison-row">
          <div class="comparison-label">Com a assinatura você pagará:</div>
          <div class="comparison-value value-with">{self._fmt_money(cobranca.energia_compensada_com_desconto)}</div>
        </div>
      </div>
      <div class="savings-row">
        <div class="savings-label">Sua economia de 30% em energia será:</div>
        <div class="savings-value">{self._fmt_money(cobranca.economia_mes)}</div>
      </div>
    </div>
  </div>

  <!-- Acumulado -->
  <div class="content-block">
    <div class="accumulated-row">
      <div class="accumulated-label">Economia acumulada desde a adesão:</div>
      <div class="accumulated-value">{self._fmt_money(Decimal(str(acumulado_atual)))}</div>
    </div>
  </div>

  <!-- PIX -->
  {self._gerar_secao_pix_n8n(qr_code_pix, pix_copia_cola) if incluir_secao_pix else ''}

</div>
</body>
</html>"""

        return html

    def _gerar_itens_tabela_n8n(self, cobranca: CobrancaCalculada, dados: FaturaExtraidaSchema) -> str:
        """Gera itens da tabela seguindo exatamente o padrão do código n8n (linhas 343-367)"""
        linhas = []

        # 1. Energia injetada no período (assinatura) - SEMPRE
        if cobranca.injetada_kwh > 0:
            linhas.append(f"""
          <tr>
            <td>Energia injetada no período (assinatura)</td>
            <td class="center">{self._fmt_number(cobranca.injetada_kwh)}</td>
            <td class="right">{self._fmt_money(cobranca.valor_energia_assinatura)}</td>
          </tr>""")

        # 2. Disponibilidade (GD II – Lei 14.300/22)
        if cobranca.modelo_gd == "GDII" and cobranca.disponibilidade_valor != 0:
            kwh_disp = dados.itens_fatura.ajuste_lei_14300.quantidade if dados.itens_fatura.ajuste_lei_14300 else None
            linhas.append(f"""
          <tr>
            <td>Disponibilidade (GD II – Lei 14.300/22)</td>
            <td class="center">{self._fmt_number(kwh_disp) if kwh_disp else '-'}</td>
            <td class="right">{self._fmt_money(cobranca.disponibilidade_valor)}</td>
          </tr>""")

        # 3. GD I - Energia excedente OU Taxa mínima (NUNCA os dois)
        if cobranca.modelo_gd == "GDI":
            kwhGapLocal = max(0, cobranca.consumo_kwh - cobranca.injetada_kwh)

            if cobranca.energia_excedente_valor != 0:
                # Energia excedente (consumo acima dos créditos)
                linhas.append(f"""
          <tr>
            <td>Energia excedente consumida da rede (consumo acima dos créditos)</td>
            <td class="center">{self._fmt_number(kwhGapLocal)}</td>
            <td class="right">{self._fmt_money(cobranca.energia_excedente_valor)}</td>
          </tr>""")

            if cobranca.taxa_minima_valor != 0:
                # Taxa mínima
                ligacao_str = cobranca.tipo_ligacao or '-'
                min_kwh = cobranca.taxa_minima_kwh
                linhas.append(f"""
          <tr>
            <td>Taxa mínima (GD I • {ligacao_str} • {min_kwh} kWh)</td>
            <td class="center">{min_kwh}</td>
            <td class="right">{self._fmt_money(cobranca.taxa_minima_valor)}</td>
          </tr>""")

        # 4. Bandeiras e ajustes (itens)
        if cobranca.bandeiras_valor != 0:
            linhas.append(f"""
          <tr>
            <td>Bandeiras e ajustes (itens)</td>
            <td class="center">-</td>
            <td class="right">{self._fmt_money(cobranca.bandeiras_valor)}</td>
          </tr>""")

        # 5. Serviços e créditos (iluminação, etc.) - consolidado
        servicos_total = cobranca.iluminacao_publica_valor + cobranca.servicos_valor
        if servicos_total != 0:
            linhas.append(f"""
          <tr>
            <td>Serviços e créditos (iluminação, etc.)</td>
            <td class="center">-</td>
            <td class="right">{self._fmt_money(servicos_total)}</td>
          </tr>""")

        return "".join(linhas)

    def _gerar_secao_pix_n8n(self, qr_code_base64: Optional[str], pix_copia_cola: Optional[str]) -> str:
        """Gera seção PIX seguindo o padrão do código n8n"""

        qr_html = ""
        if qr_code_base64:
            qr_data_uri = f"data:image/png;base64,{qr_code_base64}"
            qr_html = f'<img class="qr-img" src="{qr_data_uri}" alt="QR Code PIX">'
        else:
            qr_html = '''<div style="width:200px;height:200px;display:flex;align-items:center;justify-content:center;border:2px dashed #999;border-radius:8px;color:#777;font-size:12px;text-align:center;padding:8px">
                   QR não disponível
                 </div>'''

        copia_cola_html = ""
        if pix_copia_cola:
            copia_cola_html = f'<div class="copia-cola">{pix_copia_cola}</div>'

        return f"""
  <div class="content-block pix-block">
    <div class="pix-wrap">
      <div class="pix-left">
        <img class="apontou-img" src="{self.apontou_img}" alt="Apontou, pagou!">
      </div>
      <div class="pix-right">
        <div class="qr-card">
          <div class="qr-title">QR CODE PARA PAGAMENTO DA FATURA</div>
          {qr_html}
        </div>
        {copia_cola_html}
      </div>
    </div>
  </div>"""

    def _formatar_endereco(self, beneficiario: dict) -> str:
        """Formata endereço do beneficiário"""
        partes = []
        if beneficiario.get("endereco"):
            partes.append(beneficiario["endereco"])
        if beneficiario.get("numero"):
            partes.append(str(beneficiario["numero"]))

        endereco_base = ", ".join(partes) if partes else "Endereço não cadastrado"

        if beneficiario.get("cidade"):
            return f"{endereco_base} - {beneficiario['cidade']}"
        return endereco_base

    def _formatar_periodo_leitura(self, dados: FaturaExtraidaSchema) -> str:
        """Formata período de leitura"""
        if dados.leitura_anterior_data and dados.leitura_atual_data:
            ant = dados.leitura_anterior_data.strftime("%d/%m/%Y")
            atu = dados.leitura_atual_data.strftime("%d/%m/%Y")
            dias_txt = f" ({dados.dias} dias)" if dados.dias else ""
            return f"De {ant} à {atu}{dias_txt}"
        return "Período não disponível"

    def _fmt_money(self, valor: Decimal) -> str:
        """Formata valor monetário"""
        return f"R$ {float(valor):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

    def _fmt_number(self, num: float) -> str:
        """Formata número"""
        return f"{num:,.0f}".replace(",", ".")

    def _get_css_n8n(self) -> str:
        """Retorna CSS seguindo padrão do código n8n"""
        return """
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial, sans-serif;background:#f5f5f5;padding:20px;color:#333}
.container{max-width:900px;margin:0 auto;background:transparent}
.content-block{background:#fff;border:2px solid #333;margin-bottom:12px;box-shadow:0 2px 4px rgba(0,0,0,.1)}
.header-block{display:flex;justify-content:space-between;align-items:center;padding:16px}
.logo-img{height:46px;width:auto;object-fit:contain}
.stamp-box{border:2px solid #333;padding:10px 16px;background:#fff;box-shadow:inset 0 0 0 1px #ddd}
.stamp-box h2{font-size:15px;font-weight:600;margin-bottom:4px}
.stamp-box .ref{font-size:13px;margin-bottom:4px;color:#555}
.stamp-box .discount{font-size:13px;color:#d4a017;font-weight:bold}
.badge{display:inline-block;padding:2px 8px;border:1px solid #333;border-radius:6px;font-size:12px;margin-left:8px;background:#f9f9f9}

.customer-block{display:flex;justify-content:space-between;padding:16px;gap:20px}
.customer-details{flex:1}
.info-row{display:flex;margin-bottom:8px;font-size:13px}
.info-label{background:#FFE599;padding:6px 10px;width:140px;border:1px solid #333;font-weight:bold}
.info-value{padding:6px 10px;border:1px solid #333;border-left:none;flex:1;background:#fff}
.total-box{border:2px solid #333;padding:14px;text-align:center;background:#FFE599;align-self:stretch;width:230px;display:flex;flex-direction:column;justify-content:center}
.total-box h3{font-size:13px;font-weight:600;margin-bottom:6px}
.total-value{font-size:24px;font-weight:bold}
.due-date{margin-top:6px;font-size:11px}

.billing-block{padding:14px}
.billing-table{width:100%;border-collapse:collapse}
.billing-table th{background:#FFE599;padding:10px;text-align:left;font-size:13px;font-weight:bold;border:1px solid #333}
.billing-table th.center{text-align:center;width:110px}
.billing-table th.value-col{text-align:center;width:120px}
.billing-table td{padding:8px 10px;font-size:13px;border:1px solid #333;background:#fff}
.billing-table td.center{text-align:center}
.billing-table td.right{text-align:right}

.comparison-block{padding:0}
.comparison-grid{display:grid;grid-template-columns:1fr 220px}
.comparison-row{display:contents}
.comparison-label{padding:12px 14px;font-size:14px;font-weight:bold;background:#FFE599;border-bottom:1px solid #333;border-right:1px solid #333}
.comparison-value{width:220px;padding:12px 14px;text-align:right;font-size:15px;font-weight:bold;border-bottom:1px solid #333;color:#fff}
.value-without{background:#FF7744}
.value-with{background:#5588DD}

.savings-row{display:grid;grid-template-columns:1fr 220px}
.savings-label{padding:12px 14px;font-size:14px;font-weight:bold;background:#FFE599;border-right:1px solid #333}
.savings-value{width:220px;padding:12px 14px;text-align:right;font-size:15px;font-weight:bold;background:#55BB55;color:#fff}

.accumulated-row{display:grid;grid-template-columns:1fr 220px}
.accumulated-label{padding:12px 14px;font-size:15px;font-weight:bold;background:#FFE599;border-right:1px solid #333}
.accumulated-value{width:220px;padding:12px 14px;text-align:right;font-size:15px;font-weight:bold;background:#55BB55;color:#fff}

.content-block.pix-block{
  background:#fcf8f5;
  border-color:#333;
  padding:10px 14px;
}
.pix-wrap{
  display:grid;
  grid-template-columns:1fr 260px;
  gap:14px;
  align-items:center;
  min-height:220px;
}
.pix-left{
  display:flex;
  align-items:center;
  justify-content:flex-start;
  padding:4px 12px;
}
.apontou-img{
  height:220px;
  max-height:none;
  width:auto;
  object-fit:contain;
  display:block;
}
.pix-right{
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  padding:4px 0;
}
.qr-card{
  width:260px;
  text-align:center;
  background:#fff;
  border:2px solid #333;
  border-radius:12px;
  padding:10px 12px;
  box-sizing:border-box;
}
.qr-title{
  text-align:center;
  font-size:11px;
  margin-bottom:8px;
  color:#555;
}
.qr-img{
  width:200px;
  height:200px;
  display:block;
  margin:0 auto;
  image-rendering:crisp-edges;
}
.copia-cola{
  font-family:monospace;
  font-size:10px;
  word-break:break-all;
  line-height:1.2;
  background:#f4f4f4;
  border:1px dashed #ccc;
  border-radius:6px;
  padding:6px;
  max-height:48px;
  overflow:auto;
  margin-top:8px;
}

.content-block, .pix-block, .pix-wrap{page-break-inside:avoid}
@media(max-width:768px){
  .pix-wrap{ grid-template-columns:1fr; }
  .qr-card{ width:240px; }
  .qr-img{ width:190px; height:190px; }
}
@media print {
  body{background:#fff;padding:0}
  .content-block{box-shadow:none;page-break-inside:avoid}
}
"""


# Instância singleton para uso no service
report_generator_v3 = ReportGeneratorV3()
