/**
 * UsinasGestor - Página de Usinas Gerenciadas pelo Gestor
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { usinasApi } from '../../api/usinas';
import { beneficiariosApi } from '../../api/beneficiarios';
import type { Usina, Beneficiario } from '../../api/types';
import {
    Building2,
    Users,
    Zap,
    MapPin,
    Calendar,
    Loader2,
    RefreshCw,
    AlertCircle,
    ChevronRight,
    Search,
    Eye
} from 'lucide-react';

export function UsinasGestor() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [usinas, setUsinas] = useState<Usina[]>([]);
    const [usinaDetalhes, setUsinaDetalhes] = useState<Usina | null>(null);
    const [beneficiariosUsina, setBeneficiariosUsina] = useState<Beneficiario[]>([]);
    const [loadingDetalhes, setLoadingDetalhes] = useState(false);
    const [busca, setBusca] = useState('');

    useEffect(() => {
        fetchUsinas();
    }, []);

    const fetchUsinas = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await usinasApi.minhas();
            setUsinas(response.data || []);
        } catch (err: any) {
            console.error('Erro ao carregar usinas:', err);
            setError(err.response?.data?.detail || 'Erro ao carregar usinas');
        } finally {
            setLoading(false);
        }
    };

    const handleVerDetalhes = async (usina: Usina) => {
        setUsinaDetalhes(usina);
        setLoadingDetalhes(true);
        try {
            const response = await beneficiariosApi.porUsina(usina.id);
            // O backend retorna { beneficiarios: [...], total: ..., ... }
            const benefData = response.data?.beneficiarios || response.data || [];
            setBeneficiariosUsina(Array.isArray(benefData) ? benefData : []);
        } catch (err) {
            console.error('Erro ao buscar beneficiários:', err);
            setBeneficiariosUsina([]);
        } finally {
            setLoadingDetalhes(false);
        }
    };

    const formatEnergy = (value: number | string | undefined) => {
        const num = Number(value) || 0;
        if (num >= 1000) {
            return `${(num / 1000).toFixed(1)} MWh`;
        }
        return `${num.toFixed(0)} kWh`;
    };

    const usinasFiltradas = usinas.filter(usina => {
        if (!busca) return true;
        const termo = busca.toLowerCase();
        return (
            usina.nome?.toLowerCase().includes(termo) ||
            usina.cidade?.toLowerCase().includes(termo) ||
            usina.uf?.toLowerCase().includes(termo)
        );
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
                    <p className="text-slate-500 dark:text-slate-400">Carregando usinas...</p>
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
                    onClick={fetchUsinas}
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
                        Usinas Gerenciadas
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        {usinas.length} usina{usinas.length !== 1 ? 's' : ''} sob sua gestão
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input
                            type="text"
                            placeholder="Buscar usina..."
                            value={busca}
                            onChange={(e) => setBusca(e.target.value)}
                            className="pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-900 dark:text-white w-64"
                        />
                    </div>
                    <button
                        onClick={fetchUsinas}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                    >
                        <RefreshCw size={18} />
                    </button>
                </div>
            </div>

            {/* Lista de Usinas */}
            {usinasFiltradas.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Building2 className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-slate-500 dark:text-slate-400">
                        {busca ? 'Nenhuma usina encontrada para esta busca' : 'Você ainda não tem usinas vinculadas'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {usinasFiltradas.map((usina) => (
                        <div
                            key={usina.id}
                            className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 hover:shadow-lg transition"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                                        <Building2 className="text-blue-600 dark:text-blue-400" size={24} />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-slate-900 dark:text-white">{usina.nome}</h3>
                                        {usina.empresa && (
                                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                                {usina.empresa.nome_fantasia || usina.empresa.razao_social}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <span className={`px-3 py-1 text-xs rounded-full font-medium ${
                                    usina.status === 'ativa'
                                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                        : usina.status === 'manutencao'
                                        ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                                }`}>
                                    {usina.status === 'ativa' ? 'Ativa' : usina.status === 'manutencao' ? 'Manutenção' : 'Inativa'}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="flex items-center gap-2 text-sm">
                                    <Zap className="text-yellow-500" size={16} />
                                    <span className="text-slate-600 dark:text-slate-300">
                                        {usina.capacidade_kwp || 0} kWp
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    <Users className="text-green-500" size={16} />
                                    <span className="text-slate-600 dark:text-slate-300">
                                        {usina.beneficiarios?.length || 0} beneficiários
                                    </span>
                                </div>
                                {usina.cidade && (
                                    <div className="flex items-center gap-2 text-sm col-span-2">
                                        <MapPin className="text-slate-400" size={16} />
                                        <span className="text-slate-500 dark:text-slate-400">
                                            {usina.cidade}{usina.uf ? `, ${usina.uf}` : ''}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {usina.uc_geradora && (
                                <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3 mb-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-slate-500 dark:text-slate-400">UC Geradora</span>
                                        <span className="text-sm font-medium text-slate-900 dark:text-white">
                                            {usina.uc_geradora.uc_formatada}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between mt-1">
                                        <span className="text-sm text-slate-500 dark:text-slate-400">Saldo Acumulado</span>
                                        <span className="text-sm font-medium text-green-600 dark:text-green-400">
                                            {formatEnergy(usina.uc_geradora.saldo_acumulado || 0)}
                                        </span>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleVerDetalhes(usina)}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                                >
                                    <Eye size={18} />
                                    Ver Detalhes
                                </button>
                                <Link
                                    to={`/app/gestor/beneficiarios?usina=${usina.id}`}
                                    className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition"
                                >
                                    <Users size={18} />
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal de Detalhes */}
            {usinaDetalhes && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-800">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                                    <Building2 className="text-blue-600 dark:text-blue-400" size={24} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                        {usinaDetalhes.nome}
                                    </h2>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        {usinaDetalhes.empresa?.nome_fantasia || usinaDetalhes.empresa?.razao_social}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setUsinaDetalhes(null)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-2xl"
                            >
                                ×
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Informações */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Capacidade</p>
                                    <p className="font-medium text-slate-900 dark:text-white">
                                        {usinaDetalhes.capacidade_kwp} kWp
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Tipo de Geração</p>
                                    <p className="font-medium text-slate-900 dark:text-white capitalize">
                                        {usinaDetalhes.tipo_geracao || 'Solar'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Status</p>
                                    <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                                        usinaDetalhes.status === 'ativa'
                                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                                    }`}>
                                        {usinaDetalhes.status}
                                    </span>
                                </div>
                                {usinaDetalhes.data_conexao && (
                                    <div>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Data de Conexão</p>
                                        <p className="font-medium text-slate-900 dark:text-white">
                                            {new Date(usinaDetalhes.data_conexao).toLocaleDateString('pt-BR')}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* UC Geradora */}
                            {usinaDetalhes.uc_geradora && (
                                <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4">
                                    <h3 className="font-medium text-slate-900 dark:text-white mb-3">UC Geradora</h3>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <p className="text-slate-500 dark:text-slate-400">Código</p>
                                            <p className="font-medium text-slate-900 dark:text-white">
                                                {usinaDetalhes.uc_geradora.uc_formatada}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-slate-500 dark:text-slate-400">Saldo Acumulado</p>
                                            <p className="font-medium text-green-600 dark:text-green-400">
                                                {formatEnergy(usinaDetalhes.uc_geradora.saldo_acumulado || 0)}
                                            </p>
                                        </div>
                                        {usinaDetalhes.uc_geradora.nome_titular && (
                                            <div className="col-span-2">
                                                <p className="text-slate-500 dark:text-slate-400">Titular</p>
                                                <p className="font-medium text-slate-900 dark:text-white">
                                                    {usinaDetalhes.uc_geradora.nome_titular}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Beneficiários */}
                            <div>
                                <h3 className="font-medium text-slate-900 dark:text-white mb-3">
                                    Beneficiários ({beneficiariosUsina.length})
                                </h3>
                                {loadingDetalhes ? (
                                    <div className="flex items-center justify-center py-4">
                                        <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                                    </div>
                                ) : beneficiariosUsina.length === 0 ? (
                                    <p className="text-center text-slate-500 dark:text-slate-400 py-4">
                                        Nenhum beneficiário vinculado
                                    </p>
                                ) : (
                                    <div className="space-y-2 max-h-60 overflow-y-auto">
                                        {beneficiariosUsina.map((beneficiario) => (
                                            <div
                                                key={beneficiario.id}
                                                className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg"
                                            >
                                                <div>
                                                    <p className="font-medium text-slate-900 dark:text-white">
                                                        {beneficiario.nome || beneficiario.usuario?.nome_completo || 'Beneficiário'}
                                                    </p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                                        UC: {beneficiario.uc?.uc_formatada || '-'}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                                                        {beneficiario.percentual_rateio}%
                                                    </p>
                                                    <span className={`text-xs ${
                                                        beneficiario.status === 'ativo'
                                                            ? 'text-green-500'
                                                            : 'text-slate-400'
                                                    }`}>
                                                        {beneficiario.status}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Ações */}
                            <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                                <Link
                                    to={`/app/gestor/beneficiarios?usina=${usinaDetalhes.id}`}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                                >
                                    <Users size={18} />
                                    Gerenciar Beneficiários
                                </Link>
                                <Link
                                    to={`/app/gestor/cobrancas?usina=${usinaDetalhes.id}`}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition"
                                >
                                    Ver Cobranças
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default UsinasGestor;
