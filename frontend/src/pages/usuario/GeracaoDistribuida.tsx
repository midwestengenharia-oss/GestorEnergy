/**
 * GeracaoDistribuida - Página de Geração Distribuída do Usuário
 * Mostra UCs geradoras, beneficiárias e histórico de créditos
 * Dados lidos do banco local (sincronizados periodicamente)
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { usePerfil } from '../../contexts/PerfilContext';
import { gdApi, type GDResumo, type HistoricoGD } from '../../api/gd';
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
    Legend
} from 'recharts';
import {
    Sun,
    Zap,
    TrendingUp,
    Users,
    Loader2,
    AlertCircle,
    RefreshCw,
    ChevronDown,
    ChevronUp,
    Battery,
    ArrowRight,
    Leaf,
    Database,
    CloudDownload,
    Check
} from 'lucide-react';

// Cores para gráficos
const COLORS = {
    gerado: '#22C55E',
    utilizado: '#3B82F6',
    saldo: '#F59E0B',
    recebido: '#8B5CF6'
};

// Nomes dos meses
const MESES_NOMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export function GeracaoDistribuida() {
    const { perfilAtivo } = usePerfil();
    const [resumoGD, setResumoGD] = useState<GDResumo | null>(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [ucExpandida, setUcExpandida] = useState<number | null>(null);

    // Busca resumo de GD do banco
    const fetchResumoGD = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            // Filtrar por titularidade baseado no perfil ativo
            const isTitular = perfilAtivo === 'usuario' ? true : perfilAtivo === 'gestor' ? false : undefined;
            const response = await gdApi.getResumo(isTitular);
            setResumoGD(response.data);
        } catch (err: any) {
            console.error('Erro ao carregar dados de GD:', err);
            setError(err.response?.data?.detail || err.message || 'Erro ao carregar dados de GD');
        } finally {
            setLoading(false);
        }
    }, [perfilAtivo]);

    useEffect(() => {
        fetchResumoGD();
    }, [fetchResumoGD]);

    // Sincroniza dados de GD da Energisa
    const handleSincronizar = async () => {
        try {
            setSyncing(true);
            setSyncMessage(null);
            const response = await gdApi.sincronizar();

            if (response.data.success) {
                setSyncMessage({
                    type: 'success',
                    text: response.data.message || 'Dados sincronizados com sucesso!'
                });
                // Recarrega os dados após sincronização
                await fetchResumoGD();
            } else {
                setSyncMessage({
                    type: 'error',
                    text: 'Falha na sincronização'
                });
            }
        } catch (err: any) {
            console.error('Erro ao sincronizar GD:', err);
            setSyncMessage({
                type: 'error',
                text: err.response?.data?.detail || 'Erro ao sincronizar. Verifique se está conectado na Energisa.'
            });
        } finally {
            setSyncing(false);
            // Limpa mensagem após 5 segundos
            setTimeout(() => setSyncMessage(null), 5000);
        }
    };

    // Métricas do resumo
    const metricas = useMemo(() => {
        if (!resumoGD) {
            return {
                totalUcs: 0,
                geradoras: 0,
                beneficiarias: 0,
                saldoTotal: 0,
                creditosMes: 0,
                consumoCompensado: 0
            };
        }

        const geradoras = resumoGD.ucs.filter(uc => uc.is_geradora).length;
        const beneficiarias = resumoGD.ucs.filter(uc => !uc.is_geradora && uc.tem_dados_gd).length;

        return {
            totalUcs: resumoGD.total_ucs_com_gd,
            geradoras,
            beneficiarias,
            saldoTotal: resumoGD.total_creditos,
            creditosMes: resumoGD.total_gerado_mes,
            consumoCompensado: resumoGD.total_compensado_mes
        };
    }, [resumoGD]);

    // Dados para gráfico consolidado
    const dadosGraficoConsolidado = useMemo(() => {
        if (!resumoGD || resumoGD.ucs.length === 0) return [];

        const mesesMap = new Map<string, { mes: string; gerado: number; utilizado: number; saldo: number }>();

        resumoGD.ucs.forEach(ucGD => {
            ucGD.historico?.forEach(h => {
                const key = `${h.ano_referencia}-${String(h.mes_referencia).padStart(2, '0')}`;
                const mesNome = `${MESES_NOMES[h.mes_referencia - 1]}/${String(h.ano_referencia).slice(-2)}`;

                if (!mesesMap.has(key)) {
                    mesesMap.set(key, { mes: mesNome, gerado: 0, utilizado: 0, saldo: 0 });
                }

                const atual = mesesMap.get(key)!;
                atual.gerado += (h.injetado_conv || 0) + (h.consumo_recebido_conv || 0);
                atual.utilizado += h.consumo_compensado_conv || 0;
                atual.saldo += h.saldo_compensado_anterior || h.saldo_anterior_conv || 0;
            });
        });

        // Ordena por data e retorna últimos 12
        return Array.from(mesesMap.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .slice(-12)
            .map(([, value]) => value);
    }, [resumoGD]);

    // Toggle expansão de UC
    const toggleExpansao = (ucId: number) => {
        setUcExpandida(ucExpandida === ucId ? null : ucId);
    };

    // Formata número com separador de milhar
    const formatarNumero = (num: number) => {
        return num.toLocaleString('pt-BR');
    };

    // Prepara dados do histórico para o gráfico de uma UC
    const prepararDadosGrafico = (historico: HistoricoGD[]) => {
        return [...historico].reverse().map(h => ({
            mes: `${MESES_NOMES[h.mes_referencia - 1]}/${String(h.ano_referencia).slice(-2)}`,
            gerado: (h.injetado_conv || 0) + (h.consumo_recebido_conv || 0),
            utilizado: h.consumo_compensado_conv || 0,
            saldo: h.saldo_compensado_anterior || h.saldo_anterior_conv || 0
        }));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 text-yellow-500 animate-spin mx-auto mb-4" />
                    <p className="text-slate-500 dark:text-slate-400">Carregando dados de GD...</p>
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
                    onClick={fetchResumoGD}
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
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <Sun className="text-yellow-500" />
                        Geração Distribuída
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-1">
                        <Database size={14} />
                        Dados sincronizados do banco local
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleSincronizar}
                        disabled={syncing || loading}
                        className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition disabled:opacity-50"
                        title="Sincronizar dados da Energisa"
                    >
                        {syncing ? (
                            <Loader2 size={18} className="animate-spin" />
                        ) : (
                            <CloudDownload size={18} />
                        )}
                        {syncing ? 'Sincronizando...' : 'Sincronizar Energisa'}
                    </button>
                    <button
                        onClick={fetchResumoGD}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-500 text-white rounded-lg hover:bg-slate-600 transition disabled:opacity-50"
                        title="Recarregar dados do banco"
                    >
                        {loading ? (
                            <Loader2 size={18} className="animate-spin" />
                        ) : (
                            <RefreshCw size={18} />
                        )}
                    </button>
                </div>
            </div>

            {/* Mensagem de Sincronização */}
            {syncMessage && (
                <div className={`flex items-center gap-3 p-4 rounded-lg ${
                    syncMessage.type === 'success'
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                }`}>
                    {syncMessage.type === 'success' ? (
                        <Check size={20} />
                    ) : (
                        <AlertCircle size={20} />
                    )}
                    <span>{syncMessage.text}</span>
                </div>
            )}

            {/* Cards de Métricas */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total UCs com GD */}
                <div className="bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl p-5 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-white/80 text-sm">UCs com GD</p>
                            <p className="text-3xl font-bold mt-1">{metricas.totalUcs}</p>
                        </div>
                        <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                            <Sun size={24} />
                        </div>
                    </div>
                    <p className="text-white/80 text-sm mt-2">
                        {metricas.geradoras} geradora(s) | {metricas.beneficiarias} com créditos
                    </p>
                </div>

                {/* Saldo Total */}
                <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-5 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-white/80 text-sm">Saldo de Créditos</p>
                            <p className="text-3xl font-bold mt-1">{formatarNumero(metricas.saldoTotal)}</p>
                        </div>
                        <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                            <Battery size={24} />
                        </div>
                    </div>
                    <p className="text-white/80 text-sm mt-2">kWh disponíveis</p>
                </div>

                {/* Créditos do Mês */}
                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl p-5 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-white/80 text-sm">Injetado (Mês)</p>
                            <p className="text-3xl font-bold mt-1">{formatarNumero(metricas.creditosMes)}</p>
                        </div>
                        <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                            <TrendingUp size={24} />
                        </div>
                    </div>
                    <p className="text-white/80 text-sm mt-2">kWh no último mês</p>
                </div>

                {/* Consumo Compensado */}
                <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl p-5 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-white/80 text-sm">Consumo Compensado</p>
                            <p className="text-3xl font-bold mt-1">{formatarNumero(metricas.consumoCompensado)}</p>
                        </div>
                        <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                            <Leaf size={24} />
                        </div>
                    </div>
                    <p className="text-white/80 text-sm mt-2">kWh compensados no mês</p>
                </div>
            </div>

            {/* Gráfico Consolidado */}
            {dadosGraficoConsolidado.length > 0 && (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                        <h2 className="font-semibold text-slate-900 dark:text-white">
                            Histórico de Créditos - Consolidado
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Visão geral de todas as UCs nos últimos 12 meses
                        </p>
                    </div>
                    <div className="p-4">
                        <div className="h-72 min-h-[288px]">
                            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                <BarChart data={dadosGraficoConsolidado}>
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
                                        formatter={(value: number, name: string) => {
                                            const labels: Record<string, string> = {
                                                gerado: 'Injetado/Recebido',
                                                utilizado: 'Compensado'
                                            };
                                            return [`${formatarNumero(value)} kWh`, labels[name] || name];
                                        }}
                                    />
                                    <Legend />
                                    <Bar dataKey="gerado" name="Injetado/Recebido" fill={COLORS.gerado} radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="utilizado" name="Compensado" fill={COLORS.utilizado} radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}

            {/* Lista de UCs com GD */}
            <div className="space-y-4">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Unidades Consumidoras
                </h2>

                {!resumoGD || resumoGD.ucs.length === 0 ? (
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center">
                        <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Sun className="w-8 h-8 text-yellow-500" />
                        </div>
                        <h3 className="font-semibold text-slate-900 dark:text-white mb-2">
                            Nenhuma UC com Geração Distribuída
                        </h3>
                        <p className="text-slate-500 dark:text-slate-400">
                            Suas unidades consumidoras não possuem dados de GD sincronizados.
                        </p>
                        <p className="text-sm text-slate-400 dark:text-slate-500 mt-2">
                            Os dados são sincronizados automaticamente quando você conecta na Energisa.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {resumoGD.ucs.map((ucGD) => (
                            <div
                                key={ucGD.uc.id}
                                className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
                            >
                                {/* Header do Card */}
                                <div
                                    className="p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition"
                                    onClick={() => toggleExpansao(ucGD.uc.id)}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                                                ucGD.is_geradora
                                                    ? 'bg-yellow-100 dark:bg-yellow-900/30'
                                                    : 'bg-purple-100 dark:bg-purple-900/30'
                                            }`}>
                                                {ucGD.is_geradora ? (
                                                    <Sun className="text-yellow-600 dark:text-yellow-400" size={24} />
                                                ) : (
                                                    <Zap className="text-purple-600 dark:text-purple-400" size={24} />
                                                )}
                                            </div>
                                            <div>
                                                {ucGD.uc.apelido && (
                                                    <p className="font-bold text-slate-900 dark:text-white">
                                                        {ucGD.uc.apelido}
                                                    </p>
                                                )}
                                                <p className={`${ucGD.uc.apelido ? 'text-sm text-slate-500 dark:text-slate-400' : 'font-medium text-slate-900 dark:text-white'}`}>
                                                    UC {ucGD.uc.uc_formatada}
                                                </p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                                                        ucGD.is_geradora
                                                            ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                                                            : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                                                    }`}>
                                                        {ucGD.is_geradora ? 'Geradora' : 'Com Créditos'}
                                                    </span>
                                                    {ucGD.beneficiarias && ucGD.beneficiarias.length > 0 && (
                                                        <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                                            <Users size={12} />
                                                            {ucGD.beneficiarias.length} beneficiária(s)
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <p className="text-sm text-slate-500 dark:text-slate-400">Saldo</p>
                                                <p className="text-xl font-bold text-green-600 dark:text-green-400">
                                                    {formatarNumero(ucGD.saldo_creditos)} kWh
                                                </p>
                                            </div>
                                            {ucExpandida === ucGD.uc.id ? (
                                                <ChevronUp className="text-slate-400" size={24} />
                                            ) : (
                                                <ChevronDown className="text-slate-400" size={24} />
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Conteúdo Expandido */}
                                {ucExpandida === ucGD.uc.id && (
                                    <div className="border-t border-slate-200 dark:border-slate-700">
                                        {/* Beneficiárias (para geradoras) */}
                                        {ucGD.is_geradora && ucGD.beneficiarias && ucGD.beneficiarias.length > 0 && (
                                            <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                                                <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                                                    <Users size={16} />
                                                    Beneficiárias
                                                </h4>
                                                <div className="space-y-2">
                                                    {ucGD.beneficiarias.map((ben) => (
                                                        <div
                                                            key={ben.id}
                                                            className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg"
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <ArrowRight className="text-slate-400" size={16} />
                                                                <div>
                                                                    <p className="font-medium text-slate-900 dark:text-white">
                                                                        UC {ben.uc_formatada}
                                                                    </p>
                                                                    {ben.nome_titular && (
                                                                        <p className="text-sm text-slate-500 dark:text-slate-400">
                                                                            {ben.nome_titular}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="font-semibold text-blue-600 dark:text-blue-400">
                                                                    {ben.percentual_rateio}%
                                                                </p>
                                                                <p className="text-xs text-slate-500">do rateio</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Gráfico de Histórico */}
                                        {ucGD.historico && ucGD.historico.length > 0 && (
                                            <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                                                <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                                                    <TrendingUp size={16} />
                                                    Histórico de Créditos
                                                </h4>
                                                <div className="h-64 min-h-[256px]">
                                                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                                        <AreaChart data={prepararDadosGrafico(ucGD.historico)}>
                                                            <defs>
                                                                <linearGradient id={`gradSaldo_${ucGD.uc.id}`} x1="0" y1="0" x2="0" y2="1">
                                                                    <stop offset="5%" stopColor={COLORS.saldo} stopOpacity={0.3}/>
                                                                    <stop offset="95%" stopColor={COLORS.saldo} stopOpacity={0}/>
                                                                </linearGradient>
                                                            </defs>
                                                            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                                                            <XAxis dataKey="mes" stroke="#94A3B8" fontSize={11} />
                                                            <YAxis stroke="#94A3B8" fontSize={11} />
                                                            <Tooltip
                                                                contentStyle={{
                                                                    backgroundColor: '#1E293B',
                                                                    border: 'none',
                                                                    borderRadius: '8px'
                                                                }}
                                                                labelStyle={{ color: '#F8FAFC' }}
                                                                formatter={(value: number, name: string) => {
                                                                    const labels: Record<string, string> = {
                                                                        gerado: 'Injetado/Recebido',
                                                                        utilizado: 'Compensado',
                                                                        saldo: 'Saldo Acumulado'
                                                                    };
                                                                    return [`${formatarNumero(value)} kWh`, labels[name] || name];
                                                                }}
                                                            />
                                                            <Area
                                                                type="monotone"
                                                                dataKey="saldo"
                                                                stroke={COLORS.saldo}
                                                                strokeWidth={2}
                                                                fill={`url(#gradSaldo_${ucGD.uc.id})`}
                                                            />
                                                        </AreaChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            </div>
                                        )}

                                        {/* Tabela de Histórico */}
                                        {ucGD.historico && ucGD.historico.length > 0 && (
                                            <div className="p-4">
                                                <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                                                    Detalhamento Mensal
                                                </h4>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-sm">
                                                        <thead>
                                                            <tr className="border-b border-slate-200 dark:border-slate-700">
                                                                <th className="text-left py-2 px-3 text-slate-500 dark:text-slate-400 font-medium">Mês/Ano</th>
                                                                <th className="text-right py-2 px-3 text-slate-500 dark:text-slate-400 font-medium">Injetado</th>
                                                                <th className="text-right py-2 px-3 text-slate-500 dark:text-slate-400 font-medium">Recebido</th>
                                                                <th className="text-right py-2 px-3 text-slate-500 dark:text-slate-400 font-medium">Compensado</th>
                                                                <th className="text-right py-2 px-3 text-slate-500 dark:text-slate-400 font-medium">Transferido</th>
                                                                <th className="text-right py-2 px-3 text-slate-500 dark:text-slate-400 font-medium">Saldo</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {ucGD.historico.slice(0, 13).map((h) => (
                                                                <tr
                                                                    key={h.id}
                                                                    className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30"
                                                                >
                                                                    <td className="py-2 px-3 text-slate-900 dark:text-white">
                                                                        {MESES_NOMES[h.mes_referencia - 1]}/{h.ano_referencia}
                                                                    </td>
                                                                    <td className="py-2 px-3 text-right text-green-600 dark:text-green-400">
                                                                        {formatarNumero(h.injetado_conv || 0)}
                                                                    </td>
                                                                    <td className="py-2 px-3 text-right text-purple-600 dark:text-purple-400">
                                                                        {formatarNumero(h.consumo_recebido_conv || 0)}
                                                                    </td>
                                                                    <td className="py-2 px-3 text-right text-blue-600 dark:text-blue-400">
                                                                        {formatarNumero(h.consumo_compensado_conv || 0)}
                                                                    </td>
                                                                    <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-400">
                                                                        {formatarNumero(h.consumo_transferido_conv || 0)}
                                                                    </td>
                                                                    <td className="py-2 px-3 text-right font-semibold text-amber-600 dark:text-amber-400">
                                                                        {formatarNumero(h.saldo_compensado_anterior || h.saldo_anterior_conv || 0)}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default GeracaoDistribuida;
