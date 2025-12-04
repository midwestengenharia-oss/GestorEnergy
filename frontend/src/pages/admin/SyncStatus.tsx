/**
 * SyncStatus - Status de Sincronização com Energisa
 */

import { useState, useEffect } from 'react';
import {
    RefreshCw,
    CheckCircle,
    XCircle,
    Clock,
    AlertTriangle,
    Zap,
    FileText,
    Users,
    Loader2,
    Play
} from 'lucide-react';
import api from '../../api/client';

interface UCInfo {
    id: number;
    uc_formatada: string;
    nome_titular: string;
    cidade: string | null;
    uf: string | null;
    usuario: string;
    cpf_usuario: string;
    ultima_sincronizacao: string | null;
    horas_desde_sync?: number;
}

interface SessaoInfo {
    cpf: string;
    atualizado_em: string;
    idade_horas: number;
    status: 'ativa' | 'expirada';
}

interface SyncStatusData {
    resumo: {
        total_ucs: number;
        ucs_atualizadas: number;
        ucs_desatualizadas: number;
        ucs_nunca_sincronizadas: number;
        sessoes_ativas: number;
        total_faturas: number;
        faturas_com_pdf: number;
    };
    ucs_atualizadas: UCInfo[];
    ucs_desatualizadas: UCInfo[];
    ucs_nunca_sincronizadas: UCInfo[];
    sessoes: SessaoInfo[];
}

export function SyncStatus() {
    const [data, setData] = useState<SyncStatusData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [syncingUc, setSyncingUc] = useState<number | null>(null);
    const [activeTab, setActiveTab] = useState<'atualizadas' | 'desatualizadas' | 'nunca'>('atualizadas');

    const fetchStatus = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await api.get('/admin/sync/status');
            setData(response.data);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Erro ao carregar status');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
    }, []);

    const forcarSync = async (ucId: number) => {
        try {
            setSyncingUc(ucId);
            await api.post(`/admin/sync/forcar/${ucId}`);
            await fetchStatus();
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Erro ao sincronizar');
        } finally {
            setSyncingUc(null);
        }
    };

    const formatarData = (dataStr: string | null) => {
        if (!dataStr) return 'Nunca';
        const data = new Date(dataStr);
        return data.toLocaleString('pt-BR');
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg text-red-600 dark:text-red-400">
                {error}
            </div>
        );
    }

    if (!data) return null;

    const tabs = [
        { key: 'atualizadas', label: 'Atualizadas', count: data.resumo.ucs_atualizadas, color: 'green' },
        { key: 'desatualizadas', label: 'Desatualizadas', count: data.resumo.ucs_desatualizadas, color: 'yellow' },
        { key: 'nunca', label: 'Nunca Sincronizadas', count: data.resumo.ucs_nunca_sincronizadas, color: 'red' },
    ] as const;

    const currentUcs = activeTab === 'atualizadas' ? data.ucs_atualizadas :
                       activeTab === 'desatualizadas' ? data.ucs_desatualizadas :
                       data.ucs_nunca_sincronizadas;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        Status de Sincronização
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        Monitoramento da integração com a Energisa
                    </p>
                </div>
                <button
                    onClick={fetchStatus}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                >
                    <RefreshCw size={18} />
                    Atualizar
                </button>
            </div>

            {/* Cards de Resumo */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Total de UCs</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                                {data.resumo.total_ucs}
                            </p>
                        </div>
                        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                            <Zap className="text-blue-600 dark:text-blue-400" size={24} />
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Sessões Ativas</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                                {data.resumo.sessoes_ativas}
                            </p>
                        </div>
                        <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                            <Users className="text-green-600 dark:text-green-400" size={24} />
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Total de Faturas</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                                {data.resumo.total_faturas}
                            </p>
                        </div>
                        <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
                            <FileText className="text-purple-600 dark:text-purple-400" size={24} />
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">PDFs Baixados</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                                {data.resumo.faturas_com_pdf}
                            </p>
                            <p className="text-xs text-slate-400 mt-1">
                                {data.resumo.total_faturas > 0 ?
                                    `${Math.round(data.resumo.faturas_com_pdf / data.resumo.total_faturas * 100)}%` :
                                    '0%'}
                            </p>
                        </div>
                        <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center">
                            <FileText className="text-orange-600 dark:text-orange-400" size={24} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Sessões Energisa */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                    <h2 className="font-semibold text-slate-900 dark:text-white">Sessões da Energisa</h2>
                </div>
                <div className="p-4">
                    {data.sessoes.length === 0 ? (
                        <p className="text-slate-500 text-center py-4">Nenhuma sessão encontrada</p>
                    ) : (
                        <div className="space-y-2">
                            {data.sessoes.map((sessao, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        {sessao.status === 'ativa' ? (
                                            <CheckCircle className="text-green-500" size={20} />
                                        ) : (
                                            <XCircle className="text-red-500" size={20} />
                                        )}
                                        <div>
                                            <p className="font-medium text-slate-900 dark:text-white">CPF: {sessao.cpf}</p>
                                            <p className="text-xs text-slate-500">{formatarData(sessao.atualizado_em)}</p>
                                        </div>
                                    </div>
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                        sessao.status === 'ativa'
                                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                    }`}>
                                        {sessao.status === 'ativa' ? `${sessao.idade_horas}h atrás` : 'Expirada'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Tabs de UCs */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="border-b border-slate-200 dark:border-slate-700">
                    <div className="flex">
                        {tabs.map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex-1 px-4 py-3 text-sm font-medium transition ${
                                    activeTab === tab.key
                                        ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                }`}
                            >
                                <span className="flex items-center justify-center gap-2">
                                    {tab.key === 'atualizadas' && <CheckCircle size={16} className="text-green-500" />}
                                    {tab.key === 'desatualizadas' && <Clock size={16} className="text-yellow-500" />}
                                    {tab.key === 'nunca' && <AlertTriangle size={16} className="text-red-500" />}
                                    {tab.label}
                                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                                        tab.color === 'green' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                        tab.color === 'yellow' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                        'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                    }`}>
                                        {tab.count}
                                    </span>
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="p-4">
                    {currentUcs.length === 0 ? (
                        <p className="text-slate-500 text-center py-8">Nenhuma UC nesta categoria</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-slate-200 dark:border-slate-700">
                                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-500 dark:text-slate-400">UC</th>
                                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-500 dark:text-slate-400">Titular</th>
                                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-500 dark:text-slate-400">Localização</th>
                                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-500 dark:text-slate-400">Usuário</th>
                                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-500 dark:text-slate-400">Última Sync</th>
                                        <th className="text-right py-3 px-4 text-sm font-medium text-slate-500 dark:text-slate-400">Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentUcs.map((uc) => (
                                        <tr key={uc.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900">
                                            <td className="py-3 px-4">
                                                <span className="font-mono text-sm text-slate-900 dark:text-white">
                                                    {uc.uc_formatada}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-300">
                                                {uc.nome_titular}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-300">
                                                {uc.cidade && uc.uf ? `${uc.cidade}/${uc.uf}` : '-'}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-300">
                                                {uc.usuario}
                                            </td>
                                            <td className="py-3 px-4 text-sm">
                                                {uc.horas_desde_sync !== undefined ? (
                                                    <span className={`${
                                                        uc.horas_desde_sync < 12 ? 'text-green-600 dark:text-green-400' :
                                                        uc.horas_desde_sync < 24 ? 'text-yellow-600 dark:text-yellow-400' :
                                                        'text-red-600 dark:text-red-400'
                                                    }`}>
                                                        {uc.horas_desde_sync}h atrás
                                                    </span>
                                                ) : (
                                                    <span className="text-red-600 dark:text-red-400">Nunca</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <button
                                                    onClick={() => forcarSync(uc.id)}
                                                    disabled={syncingUc === uc.id}
                                                    className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition disabled:opacity-50"
                                                    title="Forçar sincronização"
                                                >
                                                    {syncingUc === uc.id ? (
                                                        <Loader2 size={16} className="animate-spin" />
                                                    ) : (
                                                        <Play size={16} />
                                                    )}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default SyncStatus;
