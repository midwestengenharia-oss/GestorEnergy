import { Sun, TrendingDown, DollarSign, Zap, Calendar } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface EconomyBreakdownProps {
  calculoEconomia: any;
  projecao10Anos: any[];
  ucInfo: {
    tipo_ligacao: string;
    grupo_leitura: string;
  };
  faturasResumo: {
    consumo_kwh: number;
    tem_bandeira_vermelha: boolean;
    fatura_mais_recente: any;
  };
}

export function EconomyBreakdown({
  calculoEconomia,
  projecao10Anos,
  ucInfo,
  faturasResumo
}: EconomyBreakdownProps) {
  const { isDark } = useTheme();

  if (!calculoEconomia) {
    return (
      <div className={`p-6 rounded-xl ${isDark ? 'bg-slate-800 text-white' : 'bg-white text-slate-900'}`}>
        <p className="text-center text-slate-500">Calculando economia...</p>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatNumber = (value: number, decimals = 2) => {
    return value.toLocaleString('pt-BR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  };

  const { conta_atual, conta_midwest, economia, tarifas, dados_entrada, piso_detalhes } = calculoEconomia;

  return (
    <div className="space-y-6">
      {/* Hero Card - Consumo da Fatura Mais Recente */}
      <div className={`
        p-6 rounded-2xl text-center
        bg-gradient-to-br from-orange-50 to-orange-100
        border border-orange-200
        ${isDark ? 'bg-opacity-10 border-opacity-20' : ''}
      `}>
        <div className="flex items-center justify-center mb-2">
          <Sun className="text-orange-500 mr-2" size={24} />
          <span className="text-sm font-semibold text-slate-600 uppercase tracking-wider">
            Consumo da Última Fatura
          </span>
        </div>
        <div className={`text-4xl font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          {formatNumber(dados_entrada.consumo_kwh, 0)} kWh
        </div>
        <div className="text-sm text-slate-600">
          Tipo de Ligação: <span className="font-semibold text-orange-600">{ucInfo.tipo_ligacao}</span>
          {faturasResumo.fatura_mais_recente && (
            <span className="ml-2 text-xs text-slate-500">
              ({String(faturasResumo.fatura_mais_recente.mes).padStart(2, '0')}/{faturasResumo.fatura_mais_recente.ano})
            </span>
          )}
        </div>
      </div>

      {/* Cards Comparativos (2 colunas) - APENAS CONSUMO */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Custo Atual (Energisa) */}
        <div className={`
          p-6 rounded-xl border-2
          ${isDark
            ? 'bg-slate-800 border-slate-600'
            : 'bg-white border-slate-300'
          }
        `}>
          <div className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Custo Atual (Energisa)
          </div>
          <div className={`text-3xl font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {formatCurrency(calculoEconomia.custo_energisa_consumo)}
          </div>
          <div className="text-sm text-slate-600">
            Apenas consumo × tarifa atual
          </div>
        </div>

        {/* Valor Midwest */}
        <div className={`
          p-6 rounded-xl border-2
          bg-gradient-to-br from-orange-50 to-white
          border-orange-300
          ${isDark ? 'bg-opacity-10' : ''}
        `}>
          <div className="text-sm font-semibold text-orange-600 uppercase tracking-wide mb-3">
            Valor Midwest
          </div>
          <div className="text-3xl font-bold text-orange-600 mb-4">
            {formatCurrency(calculoEconomia.valor_midwest_consumo)}
          </div>
          <div className="text-sm text-slate-600">
            Consumo com 30% de desconto
          </div>
        </div>
      </div>

      {/* Highlight Box - Economia */}
      <div className={`
        p-6 rounded-xl
        bg-gradient-to-r from-slate-900 to-slate-800
        text-white
        shadow-xl
      `}>
        <div className="grid grid-cols-3 gap-4 text-center">
          {/* Desconto */}
          <div>
            <div className="text-xs uppercase tracking-wider opacity-75 mb-2">
              Desconto na Tarifa
            </div>
            <div className="text-2xl font-bold text-yellow-400">
              30%
            </div>
          </div>

          {/* Economia Mensal */}
          <div className="border-l border-r border-white border-opacity-20">
            <div className="text-xs uppercase tracking-wider opacity-75 mb-2">
              Economia Mensal
            </div>
            <div className="text-2xl font-bold">
              {formatCurrency(economia.mensal)}
            </div>
          </div>

          {/* Faturas Economizadas */}
          <div>
            <div className="text-xs uppercase tracking-wider opacity-75 mb-2">
              Faturas Economizadas/Ano
            </div>
            <div className="text-2xl font-bold text-green-400">
              {formatNumber(economia.faturas_economizadas_ano, 1)}
            </div>
          </div>
        </div>
      </div>

      {/* Detalhamento da Economia */}
      <div className={`p-6 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
        <h3 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          Detalhamento da Economia
        </h3>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Composição Atual */}
          <div>
            <div className="text-sm font-semibold text-slate-600 mb-3">
              Composição Atual (Energisa)
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Energia</span>
                <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {formatCurrency(conta_atual.energia)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Iluminação Pública</span>
                <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {formatCurrency(conta_atual.iluminacao_publica)}
                </span>
              </div>
              {conta_atual.bandeira > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Bandeira Vermelha</span>
                  <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {formatCurrency(conta_atual.bandeira)}
                  </span>
                </div>
              )}
              <div className="pt-2 border-t-2 border-slate-300 flex justify-between text-sm font-bold">
                <span className={isDark ? 'text-white' : 'text-slate-900'}>Total Mensal</span>
                <span className={isDark ? 'text-white' : 'text-slate-900'}>
                  {formatCurrency(conta_atual.total)}
                </span>
              </div>
            </div>
          </div>

          {/* Nova Composição */}
          <div>
            <div className="text-sm font-semibold text-orange-600 mb-3">
              Nova Composição (Midwest)
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Energia (c/ desconto)</span>
                <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {formatCurrency(conta_midwest.energia_com_desconto)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">
                  {piso_detalhes.tipo_usado === 'taxa_minima' ? 'Taxa Mínima' : 'Fio B'}
                </span>
                <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {formatCurrency(piso_detalhes.piso_regulatorio)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Iluminação Pública</span>
                <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {formatCurrency(conta_midwest.iluminacao_publica)}
                </span>
              </div>
              <div className="pt-2 border-t-2 border-orange-300 flex justify-between text-sm font-bold">
                <span className="text-orange-600">Total Mensal</span>
                <span className="text-orange-600">
                  {formatCurrency(conta_midwest.total)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Projeção 10 Anos */}
      {projecao10Anos && projecao10Anos.length > 0 && (
        <div className={`p-6 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-white border border-slate-200'}`}>
          <div className="mb-4">
            <h3 className={`text-lg font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Projeção de Economia - 10 Anos
            </h3>
            <p className="text-sm text-slate-600">
              Considerando reajuste médio anual de 8% nas tarifas de energia
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={`${isDark ? 'bg-slate-900' : 'bg-slate-900'} text-white`}>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase">Ano</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase">Gasto sem Midwest</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase">Gasto com Midwest</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase">Economia Anual</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase">Economia Total</th>
                </tr>
              </thead>
              <tbody>
                {projecao10Anos.map((row, index) => (
                  <tr
                    key={row.ano}
                    className={`
                      ${index % 2 === 0
                        ? (isDark ? 'bg-slate-900 bg-opacity-30' : 'bg-slate-50')
                        : (isDark ? 'bg-slate-800' : 'bg-white')
                      }
                      hover:bg-orange-50 hover:bg-opacity-10 transition-colors
                    `}
                  >
                    <td className={`px-3 py-2 font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {row.ano}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600">
                      {formatCurrency(row.custo_energisa)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600">
                      {formatCurrency(row.valor_midwest)}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-green-600">
                      {formatCurrency(row.economia_anual)}
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-orange-600">
                      {formatCurrency(row.economia_acumulada)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
