/**
 * UCsGestor - Lista de UCs das usinas gerenciadas
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usinasApi } from '../../api/usinas';
import { beneficiariosApi } from '../../api/beneficiarios';
import type { Usina, Beneficiario } from '../../api/types';
import {
    Zap,
    Search,
    Loader2,
    RefreshCw,
    AlertCircle,
    MapPin,
    User,
    Building2,
    Filter,
    Eye,
    CheckCircle,
    XCircle,
    Home
} from 'lucide-react';

interface UCComBeneficiario {
    id: number;
    uc_formatada: string;
    endereco: string;
    cidade: string;
    uf: string;
    nome_titular: string;
    uc_ativa: boolean;
    is_geradora: boolean;
    beneficiario?: {
        id: number;
        nome: string;
        status: string;
    };
    usina?: {
        id: number;
        nome: string;
    };
}

export function UCsGestor() {
    const navigate = useNavigate();
    const [usinas, setUsinas] = useState<Usina[]>([]);
    const [ucs, setUcs] = useState<UCComBeneficiario[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filtros
    const [filtroUsina, setFiltroUsina] = useState<number | null>(null);
    const [filtroStatus, setFiltroStatus] = useState<'todas' | 'ativas' | 'inativas' | 'geradoras'>('todas');
    const [busca, setBusca] = useState('');

    useEffect(() => {
        fetchUsinas();
    }, []);

    useEffect(() => {
        if (usinas.length > 0) {
            fetchUCs();
        }
    }, [usinas, filtroUsina]);

    const fetchUsinas = async () => {
        try {
            const response = await usinasApi.minhas();
            setUsinas(response.data || []);
        } catch (err: any) {
            console.error('Erro ao carregar usinas:', err);
            setError('Erro ao carregar usinas');
        }
    };

    const fetchUCs = async () => {
        try {
            setLoading(true);
            setError(null);

            const usinasParaBuscar = filtroUsina
                ? usinas.filter(u => u.id === filtroUsina)
                : usinas;

            const todasUCs: UCComBeneficiario[] = [];
            const ucIdsAdicionados = new Set<number>();

            for (const usina of usinasParaBuscar) {
                try {
                    const benefResponse = await beneficiariosApi.porUsina(usina.id);
                    const beneficiarios = benefResponse.data?.beneficiarios || [];

                    for (const benef of beneficiarios) {
                        // Evitar duplicatas de UC
                        if (benef.uc_id && !ucIdsAdicionados.has(benef.uc_id)) {
                            ucIdsAdicionados.add(benef.uc_id);

                            // Formatar UC
                            const ucFormatada = benef.uc
                                ? `6/${benef.uc.cdc}-${benef.uc.digito_verificador}`
                                : `UC #${benef.uc_id}`;

                            // Montar endereço
                            const endereco = benef.uc
                                ? [benef.uc.endereco, benef.uc.numero_imovel].filter(Boolean).join(', ')
                                : '';

                            todasUCs.push({
                                id: benef.uc_id,
                                uc_formatada: ucFormatada,
                                endereco: endereco || 'Não informado',
                                cidade: benef.uc?.cidade || '',
                                uf: benef.uc?.uf || '',
                                nome_titular: benef.uc?.nome_titular || 'Não informado',
                                uc_ativa: benef.uc?.uc_ativa ?? true,
                                is_geradora: benef.uc?.is_geradora ?? false,
                                beneficiario: {
                                    id: benef.id,
                                    nome: benef.nome || 'Não informado',
                                    status: benef.status || 'ATIVO'
                                },
                                usina: {
                                    id: usina.id,
                                    nome: usina.nome || `Usina #${usina.id}`
                                }
                            });
                        }
                    }
                } catch (e) {
                    console.error(`Erro ao buscar beneficiários da usina ${usina.id}:`, e);
                }
            }

            setUcs(todasUCs);
        } catch (err: any) {
            console.error('Erro ao carregar UCs:', err);
            setError(err.response?.data?.detail || 'Erro ao carregar UCs');
        } finally {
            setLoading(false);
        }
    };

    // Filtrar UCs localmente
    const ucsFiltradas = ucs.filter(uc => {
        // Filtro por status
        if (filtroStatus === 'ativas' && !uc.uc_ativa) return false;
        if (filtroStatus === 'inativas' && uc.uc_ativa) return false;
        if (filtroStatus === 'geradoras' && !uc.is_geradora) return false;

        // Filtro por busca
        if (busca) {
            const termo = busca.toLowerCase();
            return (
                uc.uc_formatada.toLowerCase().includes(termo) ||
                uc.endereco.toLowerCase().includes(termo) ||
                uc.cidade.toLowerCase().includes(termo) ||
                uc.nome_titular.toLowerCase().includes(termo) ||
                uc.beneficiario?.nome.toLowerCase().includes(termo)
            );
        }

        return true;
    });

    // Resumo
    const resumo = {
        total: ucs.length,
        ativas: ucs.filter(uc => uc.uc_ativa).length,
        inativas: ucs.filter(uc => !uc.uc_ativa).length,
        geradoras: ucs.filter(uc => uc.is_geradora).length
    };

    if (loading && ucs.length === 0) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
                    <p className="text-slate-500 dark:text-slate-400">Carregando UCs...</p>
                </div>
            </div>
        );
    }

    if (error && ucs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
                    <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Erro ao carregar</h2>
                <p className="text-slate-500 dark:text-slate-400 mb-4">{error}</p>
                <button
                    onClick={fetchUCs}
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
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        Unidades Consumidoras
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        UCs das usinas sob sua gestão
                    </p>
                </div>
                <button
                    onClick={fetchUCs}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50"
                >
                    <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    Atualizar
                </button>
            </div>

            {/* Resumo */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                            <Home className="text-blue-600 dark:text-blue-400" size={20} />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Total</p>
                            <p className="text-xl font-bold text-slate-900 dark:text-white">{resumo.total}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                            <CheckCircle className="text-green-600 dark:text-green-400" size={20} />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Ativas</p>
                            <p className="text-xl font-bold text-slate-900 dark:text-white">{resumo.ativas}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                            <XCircle className="text-red-600 dark:text-red-400" size={20} />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Inativas</p>
                            <p className="text-xl font-bold text-slate-900 dark:text-white">{resumo.inativas}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center">
                            <Zap className="text-yellow-600 dark:text-yellow-400" size={20} />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Geradoras</p>
                            <p className="text-xl font-bold text-slate-900 dark:text-white">{resumo.geradoras}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filtros */}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                <div className="flex flex-col lg:flex-row gap-4">
                    {/* Busca */}
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input
                            type="text"
                            placeholder="Buscar por UC, endereço, titular ou beneficiário..."
                            value={busca}
                            onChange={(e) => setBusca(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-900 dark:text-white"
                        />
                    </div>

                    {/* Filtro por Usina */}
                    <select
                        value={filtroUsina || ''}
                        onChange={(e) => setFiltroUsina(e.target.value ? Number(e.target.value) : null)}
                        className="px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-900 dark:text-white"
                    >
                        <option value="">Todas as Usinas</option>
                        {usinas.map(usina => (
                            <option key={usina.id} value={usina.id}>
                                {usina.nome || `Usina #${usina.id}`}
                            </option>
                        ))}
                    </select>

                    {/* Filtro por status */}
                    <div className="flex gap-2">
                        {(['todas', 'ativas', 'inativas', 'geradoras'] as const).map((status) => (
                            <button
                                key={status}
                                onClick={() => setFiltroStatus(status)}
                                className={`px-4 py-2 rounded-lg transition whitespace-nowrap ${
                                    filtroStatus === status
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                                }`}
                            >
                                {status.charAt(0).toUpperCase() + status.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Lista de UCs */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                {ucsFiltradas.length === 0 ? (
                    <div className="p-8 text-center">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Home className="w-8 h-8 text-slate-400" />
                        </div>
                        <p className="text-slate-500 dark:text-slate-400">
                            Nenhuma UC encontrada
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Tabela para Desktop */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-50 dark:bg-slate-900">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                            UC
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                            Endereço
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                            Titular
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                            Beneficiário
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                            Usina
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                            Status
                                        </th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                            Ações
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                    {ucsFiltradas.map((uc) => (
                                        <tr
                                            key={uc.id}
                                            className="hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer"
                                            onClick={() => navigate(`/app/gestor/ucs/${uc.id}`)}
                                        >
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    {uc.is_geradora && (
                                                        <Zap size={16} className="text-yellow-500" />
                                                    )}
                                                    <span className="font-medium text-slate-900 dark:text-white">
                                                        {uc.uc_formatada}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <MapPin size={14} className="text-slate-400" />
                                                    <div>
                                                        <p className="text-sm text-slate-600 dark:text-slate-300">
                                                            {uc.endereco}
                                                        </p>
                                                        {uc.cidade && (
                                                            <p className="text-xs text-slate-400">
                                                                {uc.cidade}{uc.uf ? ` - ${uc.uf}` : ''}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <User size={14} className="text-slate-400" />
                                                    <span className="text-sm text-slate-600 dark:text-slate-300">
                                                        {uc.nome_titular}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-sm text-slate-600 dark:text-slate-300">
                                                    {uc.beneficiario?.nome || '-'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <Building2 size={14} className="text-slate-400" />
                                                    <span className="text-sm text-slate-600 dark:text-slate-300">
                                                        {uc.usina?.nome || '-'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                {uc.uc_ativa ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-xs rounded-full">
                                                        <CheckCircle size={12} />
                                                        Ativa
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs rounded-full">
                                                        <XCircle size={12} />
                                                        Inativa
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigate(`/app/gestor/ucs/${uc.id}`);
                                                    }}
                                                    className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition"
                                                    title="Ver detalhes"
                                                >
                                                    <Eye size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Cards para Mobile */}
                        <div className="md:hidden divide-y divide-slate-200 dark:divide-slate-700">
                            {ucsFiltradas.map((uc) => (
                                <div
                                    key={uc.id}
                                    className="p-4 hover:bg-slate-50 dark:hover:bg-slate-900"
                                    onClick={() => navigate(`/app/gestor/ucs/${uc.id}`)}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            {uc.is_geradora && (
                                                <Zap size={16} className="text-yellow-500" />
                                            )}
                                            <span className="font-medium text-slate-900 dark:text-white">
                                                {uc.uc_formatada}
                                            </span>
                                        </div>
                                        {uc.uc_ativa ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-xs rounded-full">
                                                Ativa
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs rounded-full">
                                                Inativa
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-sm text-slate-500 dark:text-slate-400 space-y-1">
                                        <p className="flex items-center gap-2">
                                            <MapPin size={14} />
                                            {uc.endereco}
                                        </p>
                                        <p className="flex items-center gap-2">
                                            <User size={14} />
                                            {uc.nome_titular}
                                        </p>
                                        <p className="flex items-center gap-2">
                                            <Building2 size={14} />
                                            {uc.usina?.nome || '-'}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default UCsGestor;
