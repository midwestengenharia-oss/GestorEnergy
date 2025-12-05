/**
 * DashboardAdmin - Dashboard do Super Administrador
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { adminApi, DashboardStats } from '../../api/admin';
import { leadsApi } from '../../api/leads';
import {
    Users,
    Building2,
    Target,
    Wallet,
    TrendingUp,
    TrendingDown,
    AlertCircle,
    CheckCircle,
    Clock,
    Loader2,
    Zap,
    DollarSign,
    RefreshCw,
    BarChart3
} from 'lucide-react';

interface Lead {
    id: number;
    nome: string;
    status: string;
    criado_em: string;
}

export function DashboardAdmin() {
    const { usuario } = useAuth();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [leads, setLeads] = useState<Lead[]>([]);
    const [integracoes, setIntegracoes] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchData = async (showRefresh = false) => {
        try {
            if (showRefresh) setRefreshing(true);
            setError(null);

            // Buscar dados em paralelo
            const [statsRes, leadsRes, integracoesRes] = await Promise.all([
                adminApi.estatisticas(),
                leadsApi.listar({ limit: 5 }),
                adminApi.verificarIntegracoes().catch(() => null)
            ]);

            setStats(statsRes.data);
            setLeads(leadsRes.data.leads || leadsRes.data.items || []);
            if (integracoesRes) setIntegracoes(integracoesRes.data);
        } catch (err: any) {
            console.error('Erro ao carregar dashboard:', err);
            setError(err.message || 'Erro ao carregar dados do dashboard');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const formatCurrency = (value: number | null | undefined) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value || 0);
    };

    // Helper para valores numéricos seguros (converte strings e trata null/undefined)
    const safeNumber = (value: any, defaultValue = 0): number => {
        if (value === null || value === undefined) return defaultValue;
        const num = Number(value);
        return isNaN(num) ? defaultValue : num;
    };

    const formatTimeAgo = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 60) return `${diffMins} min`;
        if (diffHours < 24) return `${diffHours}h`;
        return `${diffDays}d`;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-[#00A3E0]" size={40} />
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
                <AlertCircle className="text-red-500 mx-auto mb-3" size={40} />
                <h3 className="text-lg font-semibold text-red-700 dark:text-red-400 mb-2">
                    Erro ao carregar dashboard
                </h3>
                <p className="text-red-600 dark:text-red-300 mb-4">{error}</p>
                <button
                    onClick={() => fetchData()}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                >
                    Tentar novamente
                </button>
            </div>
        );
    }

    const statsCards = stats ? [
        {
            label: 'Usuários Ativos',
            value: stats.usuarios_ativos,
            total: stats.total_usuarios,
            icon: Users,
            color: 'blue',
            change: stats.novos_usuarios_mes > 0 ? `+${stats.novos_usuarios_mes} este mês` : null
        },
        {
            label: 'Usinas Ativas',
            value: stats.usinas_ativas,
            total: stats.total_usinas,
            icon: Building2,
            color: 'green',
            extra: `${safeNumber(stats.capacidade_total_kwp).toFixed(0)} kWp total`
        },
        {
            label: 'Beneficiários',
            value: stats.beneficiarios_ativos,
            total: stats.total_beneficiarios,
            icon: Target,
            color: 'purple',
            change: stats.novos_beneficiarios_mes > 0 ? `+${stats.novos_beneficiarios_mes} este mês` : null
        },
        {
            label: 'Receita do Mês',
            value: formatCurrency(stats.valor_recebido_mes),
            icon: Wallet,
            color: 'orange',
            extra: `${formatCurrency(stats.valor_pendente_mes)} pendente`
        },
    ] : [];

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'novo': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
            case 'contato': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
            case 'proposta': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
            case 'negociacao': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
            case 'convertido': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
            case 'perdido': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
            default: return 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400';
        }
    };

    const getIntegracaoStatus = (status: string) => {
        switch (status) {
            case 'online': return { color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20', icon: CheckCircle };
            case 'erro': return { color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20', icon: AlertCircle };
            default: return { color: 'text-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-900/20', icon: Clock };
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        Dashboard Administrativo
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        Bem-vindo, {usuario?.nome_completo?.split(' ')[0]}!
                    </p>
                </div>
                <button
                    onClick={() => fetchData(true)}
                    disabled={refreshing}
                    className="flex items-center gap-2 px-4 py-2 bg-[#00A3E0] text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50"
                >
                    <RefreshCw className={refreshing ? 'animate-spin' : ''} size={18} />
                    Atualizar
                </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {statsCards.map((stat) => (
                    <div
                        key={stat.label}
                        className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700"
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">{stat.label}</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                                    {stat.value}
                                </p>
                                {stat.total && (
                                    <p className="text-xs text-slate-400 dark:text-slate-500">
                                        de {stat.total} total
                                    </p>
                                )}
                                {stat.change && (
                                    <p className="text-sm text-green-500 mt-1 flex items-center gap-1">
                                        <TrendingUp size={14} />
                                        {stat.change}
                                    </p>
                                )}
                                {stat.extra && (
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                        {stat.extra}
                                    </p>
                                )}
                            </div>
                            <div className={`w-12 h-12 bg-${stat.color}-100 dark:bg-${stat.color}-900/30 rounded-xl flex items-center justify-center`}>
                                <stat.icon className={`text-${stat.color}-600 dark:text-${stat.color}-400`} size={24} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* UCs e Financeiro */}
            {stats && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                                <Zap className="text-blue-600 dark:text-blue-400" size={20} />
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Total de UCs</p>
                                <p className="text-xl font-bold text-slate-900 dark:text-white">{stats.total_ucs}</p>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Geradoras</span>
                                <span className="font-medium text-slate-900 dark:text-white">{stats.ucs_geradoras}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Beneficiárias</span>
                                <span className="font-medium text-slate-900 dark:text-white">{stats.ucs_beneficiarias}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                                <DollarSign className="text-green-600 dark:text-green-400" size={20} />
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Cobranças do Mês</p>
                                <p className="text-xl font-bold text-slate-900 dark:text-white">
                                    {formatCurrency(stats.valor_total_cobrancas_mes)}
                                </p>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-green-500">Recebido</span>
                                <span className="font-medium text-green-600">{formatCurrency(stats.valor_recebido_mes)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-orange-500">Pendente</span>
                                <span className="font-medium text-orange-600">{formatCurrency(stats.valor_pendente_mes)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                                <BarChart3 className="text-red-600 dark:text-red-400" size={20} />
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Taxa de Inadimplência</p>
                                <p className="text-xl font-bold text-slate-900 dark:text-white">
                                    {safeNumber(stats.taxa_inadimplencia).toFixed(1)}%
                                </p>
                            </div>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                            <div
                                className={`h-2 rounded-full ${safeNumber(stats.taxa_inadimplencia) > 10 ? 'bg-red-500' : safeNumber(stats.taxa_inadimplencia) > 5 ? 'bg-yellow-500' : 'bg-green-500'}`}
                                style={{ width: `${Math.min(safeNumber(stats.taxa_inadimplencia), 100)}%` }}
                            />
                        </div>
                        <p className="text-xs text-slate-500 mt-2">
                            {safeNumber(stats.taxa_inadimplencia) <= 5 ? 'Excelente' : safeNumber(stats.taxa_inadimplencia) <= 10 ? 'Atenção' : 'Crítico'}
                        </p>
                    </div>
                </div>
            )}

            {/* Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Últimos Leads */}
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                        <h2 className="font-semibold text-slate-900 dark:text-white">Últimos Leads</h2>
                        <a href="/app/admin/leads" className="text-sm text-[#00A3E0] hover:underline">
                            Ver todos
                        </a>
                    </div>
                    <div className="p-4 space-y-3">
                        {leads.length === 0 ? (
                            <p className="text-center text-slate-500 py-4">Nenhum lead encontrado</p>
                        ) : (
                            leads.map((lead) => (
                                <div key={lead.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-[#00A3E0] rounded-full flex items-center justify-center text-white font-medium">
                                            {lead.nome.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-medium text-slate-900 dark:text-white">{lead.nome}</p>
                                            <p className="text-xs text-slate-500">{formatTimeAgo(lead.criado_em)} atrás</p>
                                        </div>
                                    </div>
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(lead.status)}`}>
                                        {lead.status}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Status das Integrações */}
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                        <h2 className="font-semibold text-slate-900 dark:text-white">Status das Integrações</h2>
                    </div>
                    <div className="p-4 space-y-3">
                        {integracoes ? (
                            Object.entries(integracoes).map(([key, value]: [string, any]) => {
                                const statusInfo = getIntegracaoStatus(value.status);
                                return (
                                    <div key={key} className={`flex items-center gap-3 p-3 rounded-lg ${statusInfo.bg}`}>
                                        <statusInfo.icon className={statusInfo.color} size={20} />
                                        <div className="flex-1">
                                            <p className="font-medium text-slate-900 dark:text-white">{value.nome}</p>
                                            <p className="text-xs text-slate-500">{value.mensagem}</p>
                                        </div>
                                        <span className={`text-sm font-medium ${statusInfo.color}`}>
                                            {value.status}
                                        </span>
                                    </div>
                                );
                            })
                        ) : (
                            <>
                                <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                    <CheckCircle className="text-green-500" size={20} />
                                    <span className="text-sm text-green-800 dark:text-green-300">
                                        Sistema operando normalmente
                                    </span>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default DashboardAdmin;
