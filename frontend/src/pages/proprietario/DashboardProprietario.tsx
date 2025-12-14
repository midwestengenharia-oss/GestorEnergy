/**
 * DashboardProprietario - Dashboard do Proprietário de Usinas
 * Com dados reais da API
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { usinasApi } from '../../api/usinas';
import { beneficiariosApi } from '../../api/beneficiarios';
import type { Usina, Beneficiario } from '../../api/types';
import {
    Building2,
    Users,
    Wallet,
    Zap,
    TrendingUp,
    Plus,
    Loader2,
    RefreshCw,
    AlertCircle,
    Eye,
    Settings,
    ChevronRight
} from 'lucide-react';

export function DashboardProprietario() {
    const { usuario } = useAuth();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [usinas, setUsinas] = useState<Usina[]>([]);
    const [totalBeneficiarios, setTotalBeneficiarios] = useState(0);

    useEffect(() => {
        fetchDados();
    }, []);

    const fetchDados = async () => {
        try {
            setLoading(true);
            setError(null);

            // Buscar usinas do proprietário
            const usinasResponse = await usinasApi.minhas();
            const usinasData = usinasResponse.data || [];
            setUsinas(usinasData);

            // Contar total de beneficiários
            let totalBenef = 0;
            for (const usina of usinasData) {
                try {
                    const benefResponse = await beneficiariosApi.porUsina(usina.id);
                    const benefData = benefResponse.data?.beneficiarios || benefResponse.data || [];
                    totalBenef += Array.isArray(benefData) ? benefData.length : 0;
                } catch (e) {
                    console.error(`Erro ao buscar beneficiários da usina ${usina.id}:`, e);
                }
            }
            setTotalBeneficiarios(totalBenef);
        } catch (err: any) {
            console.error('Erro ao carregar dados:', err);
            setError(err.response?.data?.detail || 'Erro ao carregar dados');
        } finally {
            setLoading(false);
        }
    };

    // Calcular estatísticas
    const totalCapacidade = usinas.reduce((acc, u) => acc + (Number(u.capacidade_kwp) || 0), 0);
    const usinasAtivas = usinas.filter(u => u.status === 'ativa').length;

    // Formatar energia
    const formatEnergy = (value: number) => {
        if (value >= 1000) {
            return `${(value / 1000).toFixed(1)} MWp`;
        }
        return `${value.toFixed(0)} kWp`;
    };

    const stats = [
        {
            label: 'Minhas Usinas',
            value: usinas.length,
            subvalue: `${usinasAtivas} ativa${usinasAtivas !== 1 ? 's' : ''}`,
            icon: Building2,
            color: 'purple',
            link: '/app/proprietario/usinas'
        },
        {
            label: 'Capacidade Total',
            value: formatEnergy(totalCapacidade),
            subvalue: 'Instalada',
            icon: Zap,
            color: 'yellow',
            link: '/app/proprietario/usinas'
        },
        {
            label: 'Beneficiários',
            value: totalBeneficiarios,
            subvalue: 'Vinculados',
            icon: Users,
            color: 'blue',
            link: '/app/proprietario/usinas'
        },
        {
            label: 'Gestores',
            value: '-',
            subvalue: 'Vinculados',
            icon: Settings,
            color: 'green',
            link: '/app/proprietario/gestores'
        },
    ];

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
                    onClick={fetchDados}
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
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        Dashboard do Proprietário
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        Bem-vindo, {usuario?.nome_completo?.split(' ')[0]}!
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchDados}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                    >
                        <RefreshCw size={18} />
                        Atualizar
                    </button>
                    <Link
                        to="/app/proprietario/usinas/nova"
                        className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                    >
                        <Plus size={18} />
                        Nova Usina
                    </Link>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat) => (
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
                                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                                    {stat.subvalue}
                                </p>
                            </div>
                            <div className={`w-12 h-12 bg-${stat.color}-100 dark:bg-${stat.color}-900/30 rounded-xl flex items-center justify-center group-hover:scale-110 transition`}>
                                <stat.icon className={`text-${stat.color}-600 dark:text-${stat.color}-400`} size={24} />
                            </div>
                        </div>
                    </Link>
                ))}
            </div>

            {/* Usinas Overview */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <h2 className="font-semibold text-slate-900 dark:text-white">Minhas Usinas</h2>
                    <Link
                        to="/app/proprietario/usinas"
                        className="text-sm text-blue-500 hover:text-blue-600 flex items-center gap-1"
                    >
                        Ver todas
                        <ChevronRight size={16} />
                    </Link>
                </div>
                <div className="p-4">
                    {usinas.length === 0 ? (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Building2 className="w-8 h-8 text-slate-400" />
                            </div>
                            <p className="text-slate-500 dark:text-slate-400 mb-4">
                                Você ainda não tem usinas cadastradas
                            </p>
                            <Link
                                to="/app/proprietario/usinas/nova"
                                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                            >
                                <Plus size={18} />
                                Cadastrar Primeira Usina
                            </Link>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="text-left text-sm text-slate-500 dark:text-slate-400">
                                        <th className="pb-3 font-medium">Usina</th>
                                        <th className="pb-3 font-medium">Capacidade</th>
                                        <th className="pb-3 font-medium">UC Geradora</th>
                                        <th className="pb-3 font-medium">Status</th>
                                        <th className="pb-3 font-medium text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                    {usinas.slice(0, 5).map((usina) => (
                                        <tr key={usina.id} className="text-sm">
                                            <td className="py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                                                        <Building2 className="text-purple-600 dark:text-purple-400" size={16} />
                                                    </div>
                                                    <div>
                                                        <span className="font-medium text-slate-900 dark:text-white">
                                                            {usina.nome || `Usina #${usina.id}`}
                                                        </span>
                                                        {usina.cidade && (
                                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                                {usina.cidade}{usina.uf ? `, ${usina.uf}` : ''}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-3 text-slate-600 dark:text-slate-300">
                                                {usina.capacidade_kwp ? `${usina.capacidade_kwp} kWp` : '-'}
                                            </td>
                                            <td className="py-3 text-slate-600 dark:text-slate-300 font-mono text-xs">
                                                {usina.uc_geradora?.cod_empresa}/{usina.uc_geradora?.cdc}-{usina.uc_geradora?.digito_verificador}
                                            </td>
                                            <td className="py-3">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                    usina.status === 'ativa'
                                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                        : usina.status === 'manutencao'
                                                        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                                        : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                                                }`}>
                                                    {usina.status === 'ativa' ? 'Ativa' : usina.status === 'manutencao' ? 'Manutenção' : 'Inativa'}
                                                </span>
                                            </td>
                                            <td className="py-3 text-right">
                                                <Link
                                                    to={`/app/proprietario/usinas?usina=${usina.id}`}
                                                    className="inline-flex items-center gap-1 px-3 py-1 text-sm text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition"
                                                >
                                                    <Eye size={16} />
                                                    Ver
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {usinas.length > 5 && (
                                <div className="pt-4 text-center">
                                    <Link
                                        to="/app/proprietario/usinas"
                                        className="text-sm text-blue-500 hover:text-blue-600"
                                    >
                                        Ver mais {usinas.length - 5} usina(s)
                                    </Link>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Link
                    to="/app/proprietario/usinas/nova"
                    className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white hover:shadow-lg transition group"
                >
                    <Plus className="w-8 h-8 mb-3 group-hover:scale-110 transition" />
                    <h3 className="font-semibold text-lg">Nova Usina</h3>
                    <p className="text-blue-100 text-sm mt-1">
                        Cadastre uma nova usina geradora
                    </p>
                </Link>

                <Link
                    to="/app/proprietario/usinas"
                    className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white hover:shadow-lg transition group"
                >
                    <Building2 className="w-8 h-8 mb-3 group-hover:scale-110 transition" />
                    <h3 className="font-semibold text-lg">Gerenciar Usinas</h3>
                    <p className="text-purple-100 text-sm mt-1">
                        Visualize e gerencie suas usinas
                    </p>
                </Link>

                <Link
                    to="/app/proprietario/gestores"
                    className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white hover:shadow-lg transition group"
                >
                    <Users className="w-8 h-8 mb-3 group-hover:scale-110 transition" />
                    <h3 className="font-semibold text-lg">Gestores</h3>
                    <p className="text-green-100 text-sm mt-1">
                        Gerencie os gestores vinculados
                    </p>
                </Link>
            </div>
        </div>
    );
}

export default DashboardProprietario;
