/**
 * UsinaDetalheGD - Detalhamento de Geração Distribuída da Usina
 * Mostra histórico de créditos, composição mensal e distribuição por beneficiária
 */

import { useState, useEffect } from 'react';
import {
    Zap,
    TrendingUp,
    TrendingDown,
    ArrowRightLeft,
    Calendar,
    RefreshCw,
    Loader2,
    AlertCircle,
    ChevronDown,
    ChevronUp,
    Battery,
    Users
} from 'lucide-react';
import { gdApi, type HistoricoGD } from '../api/gd';

interface Beneficiario {
    id: number;
    nome?: string;
    percentual_rateio: number;
    uc?: {
        uc_formatada?: string;
    };
    usuario?: {
        nome_completo?: string;
    };
}

interface UsinaDetalheGDProps {
    ucGeradoraId?: number;
    beneficiarios: Beneficiario[];
    onRefresh?: () => void;
}

interface MesAgrupado {
    mes: number;
    ano: number;
    label: string;
    injetado: number;
    compensado: number;
    transferido: number;
    recebido: number;
    saldoAnterior: number;
    saldoFinal: number;
}

export function UsinaDetalheGD({ ucGeradoraId, beneficiarios, onRefresh }: UsinaDetalheGDProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [historico, setHistorico] = useState<HistoricoGD[]>([]);
    const [expandido, setExpandido] = useState(true);

    const fetchHistorico = async () => {
        if (!ucGeradoraId) return;

        setLoading(true);
        setError(null);

        try {
            const response = await gdApi.getHistorico(ucGeradoraId);
            setHistorico(response.data || []);
        } catch (err: any) {
            console.error('Erro ao buscar histórico GD:', err);
            setError(err.response?.data?.detail || 'Erro ao carregar histórico');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistorico();
    }, [ucGeradoraId]);

    // Formatar nome do mês
    const formatMes = (mes: number, ano: number) => {
        const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        return `${meses[mes - 1]}/${ano}`;
    };

    // Agrupar e processar histórico
    const historicoAgrupado: MesAgrupado[] = historico
        .sort((a, b) => {
            if (a.ano_referencia !== b.ano_referencia) {
                return b.ano_referencia - a.ano_referencia;
            }
            return b.mes_referencia - a.mes_referencia;
        })
        .map(h => ({
            mes: h.mes_referencia,
            ano: h.ano_referencia,
            label: formatMes(h.mes_referencia, h.ano_referencia),
            injetado: Number(h.injetado_conv) || 0,
            compensado: Number(h.consumo_compensado_conv) || 0,
            transferido: Number(h.consumo_transferido_conv) || 0,
            recebido: Number(h.consumo_recebido_conv) || 0,
            saldoAnterior: Number(h.saldo_anterior_conv) || 0,
            saldoFinal: Number(h.saldo_compensado_anterior) || 0
        }));

    // Calcular totais
    const totais = historicoAgrupado.reduce((acc, h) => ({
        injetado: acc.injetado + h.injetado,
        compensado: acc.compensado + h.compensado,
        transferido: acc.transferido + h.transferido,
        recebido: acc.recebido + h.recebido
    }), { injetado: 0, compensado: 0, transferido: 0, recebido: 0 });

    // Saldo atual (último registro)
    const saldoAtual = historicoAgrupado.length > 0 ? historicoAgrupado[0].saldoFinal : 0;

    // Calcular distribuição por beneficiária
    const distribuicaoBeneficiarios = beneficiarios.map(b => {
        const percentual = Number(b.percentual_rateio) || 0;
        const creditosEstimados = Math.round(totais.transferido * (percentual / 100));
        return {
            ...b,
            percentual,
            creditosEstimados
        };
    });

    const formatNumber = (value: number) => {
        return value.toLocaleString('pt-BR');
    };

    if (!ucGeradoraId) {
        return (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Nenhuma UC geradora vinculada</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header com toggle */}
            <div className="flex items-center justify-between">
                <button
                    onClick={() => setExpandido(!expandido)}
                    className="flex items-center gap-2 text-slate-900 dark:text-white font-medium hover:text-blue-600 dark:hover:text-blue-400 transition"
                >
                    {expandido ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    Detalhamento de Créditos (GD)
                </button>
                <button
                    onClick={() => {
                        fetchHistorico();
                        onRefresh?.();
                    }}
                    disabled={loading}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition disabled:opacity-50"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    Atualizar
                </button>
            </div>

            {expandido && (
                <>
                    {loading ? (
                        <div className="flex items-center justify-center py-10">
                            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                        </div>
                    ) : error ? (
                        <div className="text-center py-8 text-red-500">
                            <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                            <p>{error}</p>
                        </div>
                    ) : (
                        <>
                            {/* Cards de Totais */}
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                <div className="bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl p-4 text-white">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Zap size={18} />
                                        <span className="text-sm opacity-90">Injetado</span>
                                    </div>
                                    <p className="text-2xl font-bold">{formatNumber(totais.injetado)}</p>
                                    <p className="text-xs opacity-75">kWh total</p>
                                </div>

                                <div className="bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl p-4 text-white">
                                    <div className="flex items-center gap-2 mb-1">
                                        <TrendingDown size={18} />
                                        <span className="text-sm opacity-90">Compensado</span>
                                    </div>
                                    <p className="text-2xl font-bold">{formatNumber(totais.compensado)}</p>
                                    <p className="text-xs opacity-75">kWh utilizado</p>
                                </div>

                                <div className="bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl p-4 text-white">
                                    <div className="flex items-center gap-2 mb-1">
                                        <ArrowRightLeft size={18} />
                                        <span className="text-sm opacity-90">Transferido</span>
                                    </div>
                                    <p className="text-2xl font-bold">{formatNumber(totais.transferido)}</p>
                                    <p className="text-xs opacity-75">kWh p/ beneficiárias</p>
                                </div>

                                <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl p-4 text-white">
                                    <div className="flex items-center gap-2 mb-1">
                                        <TrendingUp size={18} />
                                        <span className="text-sm opacity-90">Recebido</span>
                                    </div>
                                    <p className="text-2xl font-bold">{formatNumber(totais.recebido)}</p>
                                    <p className="text-xs opacity-75">kWh de outras UCs</p>
                                </div>

                                <div className="bg-gradient-to-br from-slate-600 to-slate-700 rounded-xl p-4 text-white">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Battery size={18} />
                                        <span className="text-sm opacity-90">Saldo Atual</span>
                                    </div>
                                    <p className="text-2xl font-bold">{formatNumber(saldoAtual)}</p>
                                    <p className="text-xs opacity-75">kWh disponível</p>
                                </div>
                            </div>

                            {/* Distribuição por Beneficiária */}
                            {distribuicaoBeneficiarios.length > 0 && (
                                <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Users size={18} className="text-blue-500" />
                                        <h4 className="font-medium text-slate-900 dark:text-white">
                                            Distribuição por Beneficiária
                                        </h4>
                                    </div>
                                    <div className="space-y-2">
                                        {distribuicaoBeneficiarios.map((b) => (
                                            <div
                                                key={b.id}
                                                className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-lg"
                                            >
                                                <div className="flex-1">
                                                    <p className="font-medium text-slate-900 dark:text-white">
                                                        {b.nome || b.usuario?.nome_completo || 'Beneficiário'}
                                                    </p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                                        UC: {b.uc?.uc_formatada || '-'}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <div className="flex items-center gap-3">
                                                        <div className="text-center">
                                                            <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                                                                {b.percentual}%
                                                            </p>
                                                            <p className="text-xs text-slate-500">rateio</p>
                                                        </div>
                                                        <div className="text-center min-w-[80px]">
                                                            <p className="text-lg font-bold text-green-600 dark:text-green-400">
                                                                {formatNumber(b.creditosEstimados)}
                                                            </p>
                                                            <p className="text-xs text-slate-500">kWh est.</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Tabela de Histórico Mensal */}
                            {historicoAgrupado.length > 0 ? (
                                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                                    <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                                        <div className="flex items-center gap-2">
                                            <Calendar size={18} className="text-slate-500" />
                                            <h4 className="font-medium text-slate-900 dark:text-white">
                                                Histórico Mensal de Créditos
                                            </h4>
                                        </div>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-50 dark:bg-slate-900">
                                                <tr>
                                                    <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-400">
                                                        Mês/Ano
                                                    </th>
                                                    <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-400">
                                                        Saldo Anterior
                                                    </th>
                                                    <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-400">
                                                        <span className="text-orange-500">Injetado</span>
                                                    </th>
                                                    <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-400">
                                                        <span className="text-green-500">Compensado</span>
                                                    </th>
                                                    <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-400">
                                                        <span className="text-blue-500">Transferido</span>
                                                    </th>
                                                    <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-400">
                                                        Saldo Final
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                                {historicoAgrupado.map((h, idx) => (
                                                    <tr
                                                        key={`${h.ano}-${h.mes}`}
                                                        className={idx === 0 ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}
                                                    >
                                                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                                                            {h.label}
                                                            {idx === 0 && (
                                                                <span className="ml-2 px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded">
                                                                    Atual
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                                                            {formatNumber(h.saldoAnterior)}
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-orange-600 dark:text-orange-400 font-medium">
                                                            +{formatNumber(h.injetado)}
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-green-600 dark:text-green-400">
                                                            -{formatNumber(h.compensado)}
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-blue-600 dark:text-blue-400">
                                                            -{formatNumber(h.transferido)}
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">
                                                            {formatNumber(h.saldoFinal)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                                    <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                    <p>Nenhum histórico de créditos disponível</p>
                                    <p className="text-sm mt-1">Sincronize os dados da Energisa para ver o histórico</p>
                                </div>
                            )}
                        </>
                    )}
                </>
            )}
        </div>
    );
}

export default UsinaDetalheGD;
