/**
 * DashboardUsuario - Dashboard Premium do Usuário
 * Design moderno com métricas avançadas e gráficos interativos
 */

import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { usePerfil } from '../../contexts/PerfilContext';
import { ucsApi } from '../../api/ucs';
import { faturasApi } from '../../api/faturas';
import type { UnidadeConsumidora, Fatura } from '../../api/types';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    Legend
} from 'recharts';
import {
    Zap,
    FileText,
    TrendingUp,
    TrendingDown,
    AlertCircle,
    Plus,
    ChevronRight,
    Loader2,
    RefreshCw,
    CheckCircle,
    Calendar,
    DollarSign,
    Activity,
    BarChart3,
    Sun,
    Bolt,
    Clock,
    ArrowUpRight,
    ArrowDownRight,
    Wallet,
    Receipt,
    AlertTriangle,
    Sparkles
} from 'lucide-react';

// Cores para gráficos
const COLORS = {
    primary: '#3B82F6',
    success: '#22C55E',
    warning: '#F59E0B',
    danger: '#EF4444',
    purple: '#8B5CF6',
    cyan: '#06B6D4',
    pink: '#EC4899',
    gradient: ['#3B82F6', '#8B5CF6']
};

const PIE_COLORS = ['#22C55E', '#F59E0B', '#EF4444', '#3B82F6'];

export function DashboardUsuario() {
    const { usuario } = useAuth();
    const { perfilAtivo } = usePerfil();
    const [ucs, setUcs] = useState<UnidadeConsumidora[]>([]);
    const [faturas, setFaturas] = useState<Fatura[]>([]);
    const [todasFaturas, setTodasFaturas] = useState<Fatura[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [periodoGrafico, setPeriodoGrafico] = useState<'6m' | '12m' | '24m'>('12m');

    useEffect(() => {
        fetchData();
    }, [perfilAtivo]);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);

            // Filtrar UCs por titularidade baseado no perfil ativo
            // usuario = apenas UCs onde é titular (usuario_titular=true)
            // gestor = apenas UCs onde NÃO é titular (usuario_titular=false)
            const isTitular = perfilAtivo === 'usuario' ? true : perfilAtivo === 'gestor' ? false : undefined;
            const ucsResponse = await ucsApi.minhas(isTitular);
            setUcs(ucsResponse.data.ucs || []);

            // Buscar faturas apenas uma vez (24 meses = 2 anos de histórico)
            const faturasResponse = await faturasApi.listar({ limit: 24 });
            const todasFaturas = faturasResponse.data.faturas || [];
            setFaturas(todasFaturas.slice(0, 10)); // Primeiras 10 para lista
            setTodasFaturas(todasFaturas); // Todas para gráficos
        } catch (err: any) {
            console.error('Erro ao carregar dados:', err);
            setError(err.response?.data?.detail || 'Erro ao carregar dados');
        } finally {
            setLoading(false);
        }
    };

    // Calcular métricas avançadas
    const metricas = useMemo(() => {
        // Faturas pendentes: não pagas (indicador_pagamento false ou null)
        const faturasPendentes = faturas.filter(f => !f.indicador_pagamento);

        // Faturas pagas: indicador_pagamento === true
        const faturasPagas = faturas.filter(f => f.indicador_pagamento === true);

        const valorTotalPendente = faturasPendentes.reduce((acc, f) => acc + (Number(f.valor_fatura) || 0), 0);
        const valorTotalPago = faturasPagas.reduce((acc, f) => acc + (Number(f.valor_fatura) || 0), 0);

        // Consumo total e médio
        const consumoTotal = todasFaturas.reduce((acc, f) => acc + (Number(f.consumo) || 0), 0);
        const consumoMedio = todasFaturas.length > 0 ? Math.round(consumoTotal / todasFaturas.length) : 0;

        // Ordenar faturas por data (mais recente primeiro)
        const faturasOrdenadas = [...todasFaturas].sort((a, b) => {
            const dataA = a.ano_referencia * 12 + a.mes_referencia;
            const dataB = b.ano_referencia * 12 + b.mes_referencia;
            return dataB - dataA;
        });

        // Pegar os últimos 2 meses com dados (não necessariamente o mês corrente)
        const ultimaFatura = faturasOrdenadas[0];
        const penultimaFatura = faturasOrdenadas[1];

        const consumoAtual = Number(ultimaFatura?.consumo) || 0;
        const consumoAnterior = Number(penultimaFatura?.consumo) || 0;
        const variacaoConsumo = consumoAnterior > 0 ? ((consumoAtual - consumoAnterior) / consumoAnterior * 100) : 0;

        // Labels para variação (mostrar qual mês está comparando)
        const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const labelUltimoMes = ultimaFatura ? `${mesesNomes[ultimaFatura.mes_referencia - 1]}/${ultimaFatura.ano_referencia}` : '';
        const labelPenultimoMes = penultimaFatura ? `${mesesNomes[penultimaFatura.mes_referencia - 1]}/${penultimaFatura.ano_referencia}` : '';

        // Valor médio da fatura
        const valorMedioFatura = todasFaturas.length > 0
            ? todasFaturas.reduce((acc, f) => acc + (Number(f.valor_fatura) || 0), 0) / todasFaturas.length
            : 0;

        // UCs geradoras
        const ucsGeradoras = ucs.filter(uc => uc.is_geradora);
        const ucsBeneficiarias = ucs.filter(uc => !uc.is_geradora);

        // Próximo vencimento
        const proximaFatura = faturasPendentes
            .filter(f => f.data_vencimento)
            .sort((a, b) => new Date(a.data_vencimento).getTime() - new Date(b.data_vencimento).getTime())[0];

        const diasAteVencimento = proximaFatura
            ? Math.ceil((new Date(proximaFatura.data_vencimento).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
            : null;

        return {
            totalUcs: ucs.length,
            ucsAtivas: ucs.filter(uc => uc.uc_ativa).length,
            ucsGeradoras: ucsGeradoras.length,
            ucsBeneficiarias: ucsBeneficiarias.length,
            faturasPendentes: faturasPendentes.length,
            faturasPagas: faturasPagas.length,
            valorTotalPendente,
            valorTotalPago,
            consumoTotal,
            consumoMedio,
            consumoAtual,
            consumoAnterior,
            variacaoConsumo,
            valorMedioFatura,
            proximaFatura,
            diasAteVencimento,
            labelUltimoMes,
            labelPenultimoMes
        };
    }, [ucs, faturas, todasFaturas]);

    // Dados para gráfico de consumo mensal
    const dadosConsumoMensal = useMemo(() => {
        const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const limite = periodoGrafico === '6m' ? 6 : periodoGrafico === '12m' ? 12 : 24;

        // Agrupa faturas por mês/ano
        const faturasAgrupadas = todasFaturas.reduce((acc, f) => {
            const key = `${f.ano_referencia}-${String(f.mes_referencia).padStart(2, '0')}`;
            if (!acc[key]) {
                acc[key] = { consumo: 0, valor: 0, count: 0 };
            }
            acc[key].consumo += Number(f.consumo) || 0;
            acc[key].valor += Number(f.valor_fatura) || 0;
            acc[key].count += 1;
            return acc;
        }, {} as Record<string, { consumo: number; valor: number; count: number }>);

        // Gera os últimos N meses
        const resultado = [];
        const hoje = new Date();

        for (let i = limite - 1; i >= 0; i--) {
            const data = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
            const key = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
            const dados = faturasAgrupadas[key] || { consumo: 0, valor: 0, count: 0 };

            resultado.push({
                mes: meses[data.getMonth()],
                ano: data.getFullYear(),
                consumo: dados.consumo,
                valor: dados.valor,
                media: dados.count > 0 ? Math.round(dados.consumo / dados.count) : 0
            });
        }

        return resultado;
    }, [todasFaturas, periodoGrafico]);

    // Dados para gráfico de pizza (status faturas)
    const dadosStatusFaturas = useMemo(() => {
        // Usar indicador_pagamento como fonte de verdade
        const pagas = faturas.filter(f => f.indicador_pagamento === true).length;

        // Pendentes são as que não foram pagas
        const todasPendentes = faturas.filter(f => !f.indicador_pagamento);

        // Vencidas são pendentes com data de vencimento no passado
        const vencidas = todasPendentes.filter(f => {
            const vencimento = new Date(f.data_vencimento);
            return vencimento < new Date();
        }).length;

        // Pendentes (ainda não vencidas)
        const pendentes = todasPendentes.length - vencidas;

        return [
            { name: 'Pagas', value: pagas, color: COLORS.success },
            { name: 'Pendentes', value: pendentes, color: COLORS.warning },
            { name: 'Vencidas', value: vencidas, color: COLORS.danger },
        ].filter(d => d.value > 0);
    }, [faturas]);

    // Formatadores
    const formatarCodigoUC = (uc: UnidadeConsumidora) => {
        return `${uc.cod_empresa}/${uc.cdc}-${uc.digito_verificador}`;
    };

    const formatarValor = (valor: number) => {
        return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const formatarData = (data: string) => {
        return new Date(data).toLocaleDateString('pt-BR');
    };

    const formatarReferencia = (fatura: Fatura) => {
        const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        return `${meses[fatura.mes_referencia - 1]}/${fatura.ano_referencia}`;
    };

    // Saudação baseada no horário
    const getSaudacao = () => {
        const hora = new Date().getHours();
        if (hora < 12) return 'Bom dia';
        if (hora < 18) return 'Boa tarde';
        return 'Boa noite';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="text-center">
                    <div className="relative">
                        <div className="w-16 h-16 border-4 border-blue-200 dark:border-blue-900 rounded-full animate-pulse"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Zap className="w-8 h-8 text-blue-500 animate-pulse" />
                        </div>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 mt-4">Carregando seu dashboard...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
                    <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Erro ao carregar</h2>
                <p className="text-slate-500 dark:text-slate-400 mb-4">{error}</p>
                <button
                    onClick={fetchData}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                >
                    <RefreshCw size={18} />
                    Tentar novamente
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header com Saudação */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white">
                            {getSaudacao()}, {usuario?.nome_completo?.split(' ')[0]}!
                        </h1>
                        <Sparkles className="text-yellow-500" size={24} />
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        Aqui está o resumo das suas unidades consumidoras
                    </p>
                </div>
                <div className="flex gap-3">
                    <Link
                        to="/app/usuario/conectar-energisa"
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-xl hover:from-yellow-600 hover:to-orange-600 transition shadow-lg shadow-yellow-500/25"
                    >
                        <Zap size={18} />
                        Conectar Energisa
                    </Link>
                    <button
                        onClick={fetchData}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                    >
                        <RefreshCw size={18} />
                        Atualizar
                    </button>
                </div>
            </div>

            {/* Alerta de Vencimento Próximo */}
            {metricas.diasAteVencimento !== null && metricas.diasAteVencimento <= 5 && metricas.diasAteVencimento >= 0 && (
                <div className={`p-4 rounded-xl border ${
                    metricas.diasAteVencimento <= 2
                        ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                        : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                }`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            metricas.diasAteVencimento <= 2 ? 'bg-red-100 dark:bg-red-900/50' : 'bg-yellow-100 dark:bg-yellow-900/50'
                        }`}>
                            <AlertTriangle className={metricas.diasAteVencimento <= 2 ? 'text-red-500' : 'text-yellow-500'} size={20} />
                        </div>
                        <div className="flex-1">
                            <p className={`font-medium ${metricas.diasAteVencimento <= 2 ? 'text-red-700 dark:text-red-400' : 'text-yellow-700 dark:text-yellow-400'}`}>
                                {metricas.diasAteVencimento === 0
                                    ? 'Fatura vence hoje!'
                                    : metricas.diasAteVencimento === 1
                                        ? 'Fatura vence amanhã!'
                                        : `Fatura vence em ${metricas.diasAteVencimento} dias`
                                }
                            </p>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                Valor: {formatarValor(Number(metricas.proximaFatura?.valor_fatura) || 0)} - Vencimento: {formatarData(metricas.proximaFatura?.data_vencimento || '')}
                            </p>
                        </div>
                        <Link
                            to="/app/usuario/faturas"
                            className={`px-4 py-2 rounded-lg text-white text-sm font-medium ${
                                metricas.diasAteVencimento <= 2 ? 'bg-red-500 hover:bg-red-600' : 'bg-yellow-500 hover:bg-yellow-600'
                            }`}
                        >
                            Ver Fatura
                        </Link>
                    </div>
                </div>
            )}

            {/* Cards de Métricas Principais */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total de UCs */}
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg shadow-blue-500/25">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-blue-100 text-sm font-medium">Minhas UCs</p>
                            <p className="text-4xl font-bold mt-2">{metricas.totalUcs}</p>
                            <p className="text-blue-100 text-sm mt-2">
                                {metricas.ucsAtivas} ativa{metricas.ucsAtivas !== 1 ? 's' : ''}
                            </p>
                        </div>
                        <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
                            <Zap size={28} />
                        </div>
                    </div>
                </div>

                {/* Valor Pendente */}
                <div className="bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl p-6 text-white shadow-lg shadow-orange-500/25">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-orange-100 text-sm font-medium">Valor Pendente</p>
                            <p className="text-3xl font-bold mt-2">{formatarValor(metricas.valorTotalPendente)}</p>
                            <p className="text-orange-100 text-sm mt-2">
                                {metricas.faturasPendentes} fatura{metricas.faturasPendentes !== 1 ? 's' : ''}
                            </p>
                        </div>
                        <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
                            <Receipt size={28} />
                        </div>
                    </div>
                </div>

                {/* Consumo Médio */}
                <div className="bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl p-6 text-white shadow-lg shadow-green-500/25">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-green-100 text-sm font-medium">Consumo Médio</p>
                            <p className="text-4xl font-bold mt-2">{metricas.consumoMedio}</p>
                            <p className="text-green-100 text-sm mt-2">kWh/mês</p>
                        </div>
                        <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
                            <Activity size={28} />
                        </div>
                    </div>
                </div>

                {/* Variação de Consumo */}
                <div className={`bg-gradient-to-br ${
                    metricas.variacaoConsumo <= 0
                        ? 'from-emerald-500 to-teal-500 shadow-emerald-500/25'
                        : 'from-purple-500 to-pink-500 shadow-purple-500/25'
                } rounded-2xl p-6 text-white shadow-lg`}>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-white/80 text-sm font-medium">Variação Mensal</p>
                            <div className="flex items-center gap-2 mt-2">
                                <p className="text-4xl font-bold">
                                    {(Number(metricas.variacaoConsumo) || 0) > 0 ? '+' : ''}{(Number(metricas.variacaoConsumo) || 0).toFixed(1)}%
                                </p>
                                {metricas.variacaoConsumo <= 0 ? (
                                    <ArrowDownRight size={24} />
                                ) : (
                                    <ArrowUpRight size={24} />
                                )}
                            </div>
                            <p className="text-white/80 text-sm mt-2">
                                {metricas.labelUltimoMes && metricas.labelPenultimoMes
                                    ? `${metricas.labelUltimoMes} vs ${metricas.labelPenultimoMes}`
                                    : 'vs. mês anterior'}
                            </p>
                        </div>
                        <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
                            {metricas.variacaoConsumo <= 0 ? <TrendingDown size={28} /> : <TrendingUp size={28} />}
                        </div>
                    </div>
                </div>
            </div>

            {/* Gráfico de Consumo e Status */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Gráfico de Consumo */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Histórico de Consumo</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Evolução do consumo em kWh</p>
                        </div>
                        <div className="flex gap-2">
                            {(['6m', '12m', '24m'] as const).map((periodo) => (
                                <button
                                    key={periodo}
                                    onClick={() => setPeriodoGrafico(periodo)}
                                    className={`px-3 py-1 rounded-lg text-sm font-medium transition ${
                                        periodoGrafico === periodo
                                            ? 'bg-blue-500 text-white'
                                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                                    }`}
                                >
                                    {periodo}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="h-72 min-h-[288px]">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                            <AreaChart data={dadosConsumoMensal}>
                                <defs>
                                    <linearGradient id="colorConsumo" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                                <XAxis dataKey="mes" stroke="#94A3B8" fontSize={12} />
                                <YAxis stroke="#94A3B8" fontSize={12} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#1E293B',
                                        border: 'none',
                                        borderRadius: '12px',
                                        boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
                                    }}
                                    labelStyle={{ color: '#F8FAFC' }}
                                    itemStyle={{ color: '#F8FAFC' }}
                                    formatter={(value: number) => [`${value} kWh`, 'Consumo']}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="consumo"
                                    stroke={COLORS.primary}
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorConsumo)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Status das Faturas */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Status das Faturas</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Distribuição por situação</p>

                    {dadosStatusFaturas.length > 0 ? (
                        <>
                            <div className="h-48 min-h-[192px]">
                                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                    <PieChart>
                                        <Pie
                                            data={dadosStatusFaturas}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={50}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {dadosStatusFaturas.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: '#1E293B',
                                                border: 'none',
                                                borderRadius: '8px'
                                            }}
                                            itemStyle={{ color: '#F8FAFC' }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="space-y-3 mt-4">
                                {dadosStatusFaturas.map((item, index) => (
                                    <div key={index} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                                            <span className="text-sm text-slate-600 dark:text-slate-300">{item.name}</span>
                                        </div>
                                        <span className="text-sm font-semibold text-slate-900 dark:text-white">{item.value}</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="h-48 flex items-center justify-center">
                            <p className="text-slate-400">Nenhuma fatura encontrada</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Cards Secundários */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Valor Médio Fatura */}
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
                            <Wallet className="text-purple-600 dark:text-purple-400" size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Valor Médio/Fatura</p>
                            <p className="text-xl font-bold text-slate-900 dark:text-white">
                                {formatarValor(metricas.valorMedioFatura)}
                            </p>
                        </div>
                    </div>
                </div>

                {/* UCs Geradoras */}
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl flex items-center justify-center">
                            <Sun className="text-yellow-600 dark:text-yellow-400" size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">UCs Geradoras</p>
                            <p className="text-xl font-bold text-slate-900 dark:text-white">
                                {metricas.ucsGeradoras}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Consumo Atual */}
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-cyan-100 dark:bg-cyan-900/30 rounded-xl flex items-center justify-center">
                            <Bolt className="text-cyan-600 dark:text-cyan-400" size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Consumo Este Mês</p>
                            <p className="text-xl font-bold text-slate-900 dark:text-white">
                                {metricas.consumoAtual} kWh
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Seção de UCs e Faturas */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Minhas UCs */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                                <Zap className="text-blue-600 dark:text-blue-400" size={20} />
                            </div>
                            <div>
                                <h3 className="font-semibold text-slate-900 dark:text-white">Minhas UCs</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{metricas.totalUcs} unidades</p>
                            </div>
                        </div>
                        <Link
                            to="/app/usuario/ucs"
                            className="flex items-center gap-1 text-sm text-blue-500 hover:text-blue-600 transition font-medium"
                        >
                            Ver todas
                            <ChevronRight size={16} />
                        </Link>
                    </div>

                    {ucs.length === 0 ? (
                        <div className="p-8 text-center">
                            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Zap className="w-8 h-8 text-slate-400" />
                            </div>
                            <p className="text-slate-500 dark:text-slate-400 mb-4">
                                Você ainda não possui nenhuma UC vinculada
                            </p>
                            <Link
                                to="/app/usuario/conectar-energisa"
                                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                            >
                                <Plus size={18} />
                                Vincular UC
                            </Link>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-200 dark:divide-slate-700 max-h-80 overflow-y-auto">
                            {ucs.slice(0, 5).map((uc) => (
                                <Link
                                    key={uc.id}
                                    to={`/app/usuario/ucs/${uc.id}`}
                                    className="p-4 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition block"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-2 h-2 rounded-full ${uc.uc_ativa ? 'bg-green-500' : 'bg-red-500'}`} />
                                            <div>
                                                <p className="font-medium text-slate-900 dark:text-white text-sm">
                                                    UC {formatarCodigoUC(uc)}{uc.apelido ? ` - ${uc.apelido}` : ''}
                                                </p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    {uc.cidade || 'Local não informado'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {uc.is_geradora && (
                                                <span className="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                    <Sun size={10} />
                                                    GD
                                                </span>
                                            )}
                                            <ChevronRight className="text-slate-400" size={16} />
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>

                {/* Faturas Recentes */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                                <FileText className="text-green-600 dark:text-green-400" size={20} />
                            </div>
                            <div>
                                <h3 className="font-semibold text-slate-900 dark:text-white">Faturas Recentes</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{metricas.faturasPendentes} pendentes</p>
                            </div>
                        </div>
                        <Link
                            to="/app/usuario/faturas"
                            className="flex items-center gap-1 text-sm text-blue-500 hover:text-blue-600 transition font-medium"
                        >
                            Ver todas
                            <ChevronRight size={16} />
                        </Link>
                    </div>

                    {faturas.length === 0 ? (
                        <div className="p-8 text-center">
                            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle className="w-8 h-8 text-green-500" />
                            </div>
                            <p className="text-slate-500 dark:text-slate-400">
                                Nenhuma fatura encontrada
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-200 dark:divide-slate-700 max-h-80 overflow-y-auto">
                            {faturas.slice(0, 5).map((fatura) => {
                                const isPendente = fatura.situacao_pagamento === 'PENDENTE' ||
                                                  fatura.situacao_pagamento === 'EM_ABERTO' ||
                                                  !fatura.indicador_pagamento;
                                const isVencida = isPendente && new Date(fatura.data_vencimento) < new Date();

                                return (
                                    <div
                                        key={fatura.id}
                                        className={`p-4 ${isVencida ? 'bg-red-50 dark:bg-red-900/10' : isPendente ? 'bg-orange-50 dark:bg-orange-900/10' : ''}`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                {isVencida ? (
                                                    <AlertTriangle className="text-red-500" size={20} />
                                                ) : isPendente ? (
                                                    <Clock className="text-orange-500" size={20} />
                                                ) : (
                                                    <CheckCircle className="text-green-500" size={20} />
                                                )}
                                                <div>
                                                    <p className="font-medium text-slate-900 dark:text-white text-sm">
                                                        {formatarReferencia(fatura)}
                                                    </p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                                        Venc: {formatarData(fatura.data_vencimento)}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-slate-900 dark:text-white">
                                                    {formatarValor(Number(fatura.valor_fatura) || 0)}
                                                </p>
                                                <span className={`text-xs font-medium ${
                                                    isVencida ? 'text-red-500' : isPendente ? 'text-orange-500' : 'text-green-500'
                                                }`}>
                                                    {isVencida ? 'Vencida' : isPendente ? 'Pendente' : 'Paga'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Ações Rápidas */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 dark:from-slate-900 dark:to-black rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Ações Rápidas</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Link
                        to="/app/usuario/ucs"
                        className="bg-white/10 hover:bg-white/20 rounded-xl p-4 text-center transition group"
                    >
                        <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition">
                            <Zap className="text-blue-400" size={24} />
                        </div>
                        <p className="text-white text-sm font-medium">Minhas UCs</p>
                    </Link>
                    <Link
                        to="/app/usuario/faturas"
                        className="bg-white/10 hover:bg-white/20 rounded-xl p-4 text-center transition group"
                    >
                        <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition">
                            <FileText className="text-green-400" size={24} />
                        </div>
                        <p className="text-white text-sm font-medium">Faturas</p>
                    </Link>
                    <Link
                        to="/app/usuario/conectar-energisa"
                        className="bg-white/10 hover:bg-white/20 rounded-xl p-4 text-center transition group"
                    >
                        <div className="w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition">
                            <Plus className="text-yellow-400" size={24} />
                        </div>
                        <p className="text-white text-sm font-medium">Vincular UC</p>
                    </Link>
                    <button
                        onClick={fetchData}
                        className="bg-white/10 hover:bg-white/20 rounded-xl p-4 text-center transition group"
                    >
                        <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition">
                            <RefreshCw className="text-purple-400" size={24} />
                        </div>
                        <p className="text-white text-sm font-medium">Sincronizar</p>
                    </button>
                </div>
            </div>
        </div>
    );
}

export default DashboardUsuario;
