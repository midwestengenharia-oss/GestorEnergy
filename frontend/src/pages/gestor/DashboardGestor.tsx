/**
 * DashboardGestor - Dashboard do Gestor de Usinas
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { usinasApi } from '../../api/usinas';
import { beneficiariosApi } from '../../api/beneficiarios';
import { cobrancasApi } from '../../api/cobrancas';
import type { Usina, Beneficiario, Cobranca } from '../../api/types';
import {
    Building2,
    Users,
    FileText,
    PieChart,
    Zap,
    TrendingUp,
    AlertCircle,
    Loader2,
    RefreshCw,
    ChevronRight,
    DollarSign,
    Calendar,
    CheckCircle
} from 'lucide-react';

interface DashboardStats {
    totalUsinas: number;
    totalBeneficiarios: number;
    totalCobrancasPendentes: number;
    valorPendente: number;
    valorRecebido: number;
    energiaDistribuida: number;
}

export function DashboardGestor() {
    const { usuario } = useAuth();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Dados
    const [usinas, setUsinas] = useState<Usina[]>([]);
    const [beneficiarios, setBeneficiarios] = useState<Beneficiario[]>([]);
    const [cobrancasPendentes, setCobrancasPendentes] = useState<Cobranca[]>([]);
    const [stats, setStats] = useState<DashboardStats>({
        totalUsinas: 0,
        totalBeneficiarios: 0,
        totalCobrancasPendentes: 0,
        valorPendente: 0,
        valorRecebido: 0,
        energiaDistribuida: 0
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);

            // Buscar usinas do gestor
            const usinasResponse = await usinasApi.minhas();
            const usinasData = usinasResponse.data || [];
            setUsinas(usinasData);

            // Buscar beneficiários de todas as usinas
            let allBeneficiarios: Beneficiario[] = [];
            for (const usina of usinasData) {
                try {
                    const benefResponse = await beneficiariosApi.porUsina(usina.id);
                    // O backend retorna { beneficiarios: [...], total: ..., ... }
                    const benefData = benefResponse.data?.beneficiarios || benefResponse.data || [];
                    allBeneficiarios = [...allBeneficiarios, ...(Array.isArray(benefData) ? benefData : [])];
                } catch (e) {
                    console.error(`Erro ao buscar beneficiários da usina ${usina.id}:`, e);
                }
            }
            setBeneficiarios(allBeneficiarios);

            // Buscar cobranças pendentes
            const cobrancasResponse = await cobrancasApi.listar({ status: 'pendente', limit: 10 });
            // O backend retorna { cobrancas: [...], total: ..., ... }
            const cobrancasData = cobrancasResponse.data?.cobrancas || cobrancasResponse.data?.items || cobrancasResponse.data || [];
            setCobrancasPendentes(Array.isArray(cobrancasData) ? cobrancasData : []);

            // Buscar estatísticas
            let statsData = { total_pendente: 0, total_pago: 0, total_vencido: 0, quantidade: { pendente: 0, pago: 0, vencido: 0 } };
            try {
                const statsResponse = await cobrancasApi.estatisticas();
                statsData = statsResponse.data || statsData;
            } catch (e) {
                console.error('Erro ao buscar estatísticas:', e);
            }

            // Calcular energia distribuída (soma dos saldos das UCs geradoras)
            const energiaTotal = usinasData.reduce((acc, usina) => {
                return acc + (usina.uc_geradora?.saldo_acumulado || 0);
            }, 0);

            setStats({
                totalUsinas: usinasData.length,
                totalBeneficiarios: allBeneficiarios.length,
                totalCobrancasPendentes: statsData.quantidade?.pendente || 0,
                valorPendente: statsData.total_pendente || 0,
                valorRecebido: statsData.total_pago || 0,
                energiaDistribuida: energiaTotal
            });

        } catch (err: any) {
            console.error('Erro ao carregar dados:', err);
            setError(err.response?.data?.detail || 'Erro ao carregar dados do dashboard');
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value || 0);
    };

    const formatEnergy = (value: number | string | undefined) => {
        const num = Number(value) || 0;
        if (num >= 1000) {
            return `${(num / 1000).toFixed(1)} MWh`;
        }
        return `${num.toFixed(0)} kWh`;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
                    <p className="text-slate-500 dark:text-slate-400">Carregando dashboard...</p>
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

    const statsCards = [
        {
            label: 'Usinas Gerenciadas',
            value: stats.totalUsinas,
            icon: Building2,
            color: 'blue',
            link: '/app/gestor/usinas'
        },
        {
            label: 'Beneficiários',
            value: stats.totalBeneficiarios,
            icon: Users,
            color: 'green',
            link: '/app/gestor/beneficiarios'
        },
        {
            label: 'Cobranças Pendentes',
            value: stats.totalCobrancasPendentes,
            icon: FileText,
            color: 'orange',
            link: '/app/gestor/cobrancas'
        },
        {
            label: 'Energia Distribuída',
            value: formatEnergy(stats.energiaDistribuida),
            icon: Zap,
            color: 'yellow',
            link: '/app/gestor/rateio'
        },
    ];

    const colorClasses: Record<string, { bg: string; text: string }> = {
        blue: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400' },
        green: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400' },
        orange: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400' },
        yellow: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-600 dark:text-yellow-400' },
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        Dashboard do Gestor
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        Bem-vindo, {usuario?.nome_completo?.split(' ')[0]}!
                    </p>
                </div>
                <button
                    onClick={fetchData}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                >
                    <RefreshCw size={18} />
                    Atualizar
                </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {statsCards.map((stat) => (
                    <Link
                        key={stat.label}
                        to={stat.link}
                        className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 hover:shadow-lg transition group"
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">{stat.label}</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                                    {stat.value}
                                </p>
                            </div>
                            <div className={`w-12 h-12 ${colorClasses[stat.color].bg} rounded-xl flex items-center justify-center`}>
                                <stat.icon className={colorClasses[stat.color].text} size={24} />
                            </div>
                        </div>
                        <div className="mt-3 flex items-center text-sm text-blue-500 opacity-0 group-hover:opacity-100 transition">
                            Ver detalhes <ChevronRight size={16} />
                        </div>
                    </Link>
                ))}
            </div>

            {/* Resumo Financeiro */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                            <DollarSign className="text-orange-600 dark:text-orange-400" size={20} />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Valor Pendente</p>
                            <p className="text-xl font-bold text-slate-900 dark:text-white">
                                {formatCurrency(stats.valorPendente)}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                            <TrendingUp className="text-green-600 dark:text-green-400" size={20} />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Valor Recebido (mês)</p>
                            <p className="text-xl font-bold text-slate-900 dark:text-white">
                                {formatCurrency(stats.valorRecebido)}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Grid de conteúdo */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Usinas */}
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                        <h2 className="font-semibold text-slate-900 dark:text-white">Minhas Usinas</h2>
                        <Link to="/app/gestor/usinas" className="text-blue-500 hover:text-blue-600 text-sm">
                            Ver todas
                        </Link>
                    </div>
                    <div className="p-4">
                        {usinas.length === 0 ? (
                            <p className="text-center text-slate-500 dark:text-slate-400 py-4">
                                Nenhuma usina vinculada
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {usinas.slice(0, 4).map((usina) => (
                                    <div key={usina.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                                                <Building2 className="text-blue-600 dark:text-blue-400" size={20} />
                                            </div>
                                            <div>
                                                <p className="font-medium text-slate-900 dark:text-white">{usina.nome}</p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    {usina.capacidade_kwp} kWp • {usina.beneficiarios?.length || 0} beneficiários
                                                </p>
                                            </div>
                                        </div>
                                        <span className={`px-2 py-1 text-xs rounded-full ${
                                            usina.status === 'ativa'
                                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                                        }`}>
                                            {usina.status}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Cobranças Pendentes */}
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                        <h2 className="font-semibold text-slate-900 dark:text-white">Cobranças Pendentes</h2>
                        {stats.totalCobrancasPendentes > 0 && (
                            <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-full text-xs font-medium">
                                {stats.totalCobrancasPendentes} pendentes
                            </span>
                        )}
                    </div>
                    <div className="p-4">
                        {cobrancasPendentes.length === 0 ? (
                            <div className="text-center py-8">
                                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                                <p className="text-slate-500 dark:text-slate-400">
                                    Nenhuma cobrança pendente!
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {cobrancasPendentes.slice(0, 5).map((cobranca) => {
                                    const vencida = new Date(cobranca.data_vencimento) < new Date();
                                    return (
                                        <div key={cobranca.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                                            <div>
                                                <p className="font-medium text-slate-900 dark:text-white">
                                                    {cobranca.beneficiario?.nome || `Beneficiário #${cobranca.beneficiario_id}`}
                                                </p>
                                                <p className="text-xs text-slate-500 flex items-center gap-1">
                                                    <Calendar size={12} />
                                                    Vence: {new Date(cobranca.data_vencimento).toLocaleDateString('pt-BR')}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-medium text-slate-900 dark:text-white">
                                                    {formatCurrency(cobranca.valor_total)}
                                                </p>
                                                <span className={`text-xs ${vencida ? 'text-red-500' : 'text-yellow-500'}`}>
                                                    {vencida ? 'Vencida' : 'Pendente'}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                                {stats.totalCobrancasPendentes > 5 && (
                                    <Link
                                        to="/app/gestor/cobrancas"
                                        className="block text-center text-blue-500 hover:text-blue-600 text-sm py-2"
                                    >
                                        Ver todas as {stats.totalCobrancasPendentes} cobranças
                                    </Link>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Rateio de Energia (se houver usinas) */}
            {usinas.length > 0 && beneficiarios.length > 0 && (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                        <h2 className="font-semibold text-slate-900 dark:text-white">Distribuição de Energia</h2>
                        <Link to="/app/gestor/rateio" className="text-blue-500 hover:text-blue-600 text-sm">
                            Gerenciar rateio
                        </Link>
                    </div>
                    <div className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {beneficiarios.slice(0, 6).map((beneficiario) => (
                                <div key={beneficiario.id} className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                                    <div className="flex justify-between items-start mb-2">
                                        <p className="font-medium text-slate-900 dark:text-white text-sm truncate">
                                            {beneficiario.nome || beneficiario.usuario?.nome_completo || 'Beneficiário'}
                                        </p>
                                        <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                                            {beneficiario.percentual_rateio}%
                                        </span>
                                    </div>
                                    <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-[#00A3E0] rounded-full transition-all"
                                            style={{ width: `${Math.min(beneficiario.percentual_rateio || 0, 100)}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                        {beneficiarios.length > 6 && (
                            <Link
                                to="/app/gestor/rateio"
                                className="block text-center text-blue-500 hover:text-blue-600 text-sm py-3 mt-4 border-t border-slate-200 dark:border-slate-700"
                            >
                                Ver todos os {beneficiarios.length} beneficiários
                            </Link>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default DashboardGestor;
