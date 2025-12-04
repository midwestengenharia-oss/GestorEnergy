/**
 * LogsAuditoria - Logs de Auditoria do Sistema
 */

import { useState, useEffect } from 'react';
import {
    FileText,
    Search,
    Filter,
    ChevronLeft,
    ChevronRight,
    Loader2,
    X,
    User,
    Calendar,
    Clock,
    Activity,
    Eye,
    Globe,
    Monitor
} from 'lucide-react';
import api from '../../api/client';

interface LogAuditoria {
    id: number;
    usuario_id: string;
    usuario_nome: string | null;
    acao: string;
    entidade: string;
    entidade_id: string | null;
    dados_anteriores: Record<string, any> | null;
    dados_novos: Record<string, any> | null;
    ip_address: string | null;
    user_agent: string | null;
    criado_em: string;
}

interface LogListResponse {
    logs: LogAuditoria[];
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
}

const ACAO_CONFIG: Record<string, { label: string; color: string }> = {
    CREATE: { label: 'Criar', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    UPDATE: { label: 'Atualizar', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    DELETE: { label: 'Excluir', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    LOGIN: { label: 'Login', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
    LOGOUT: { label: 'Logout', color: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400' },
    SYNC: { label: 'Sincronizar', color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400' },
    EXPORT: { label: 'Exportar', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
    IMPORT: { label: 'Importar', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
};

const ENTIDADE_LABELS: Record<string, string> = {
    usuarios: 'Usuários',
    usinas: 'Usinas',
    ucs: 'UCs',
    faturas: 'Faturas',
    cobrancas: 'Cobranças',
    beneficiarios: 'Beneficiários',
    contratos: 'Contratos',
    leads: 'Leads',
    saques: 'Saques',
    configuracoes: 'Configurações',
    perfis: 'Perfis',
    sessoes: 'Sessões'
};

export function LogsAuditoria() {
    const [logs, setLogs] = useState<LogAuditoria[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Paginação
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const perPage = 50;

    // Filtros
    const [filterEntidade, setFilterEntidade] = useState<string>('');
    const [filterAcao, setFilterAcao] = useState<string>('');
    const [filterDataInicio, setFilterDataInicio] = useState<string>('');
    const [filterDataFim, setFilterDataFim] = useState<string>('');
    const [showFilters, setShowFilters] = useState(false);

    // Modal de detalhes
    const [selectedLog, setSelectedLog] = useState<LogAuditoria | null>(null);
    const [showModal, setShowModal] = useState(false);

    const fetchLogs = async () => {
        try {
            setLoading(true);
            setError(null);

            const params = new URLSearchParams();
            params.append('page', page.toString());
            params.append('per_page', perPage.toString());

            if (filterEntidade) params.append('entidade', filterEntidade);
            if (filterAcao) params.append('acao', filterAcao);
            if (filterDataInicio) params.append('data_inicio', filterDataInicio);
            if (filterDataFim) params.append('data_fim', filterDataFim);

            const response = await api.get<LogListResponse>(`/admin/logs?${params.toString()}`);
            setLogs(response.data.logs);
            setTotalPages(response.data.total_pages);
            setTotal(response.data.total);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Erro ao carregar logs');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [page, filterEntidade, filterAcao, filterDataInicio, filterDataFim]);

    const formatarDataHora = (dataStr: string) => {
        const data = new Date(dataStr);
        return data.toLocaleString('pt-BR');
    };

    const formatarData = (dataStr: string) => {
        const data = new Date(dataStr);
        return data.toLocaleDateString('pt-BR');
    };

    const formatarHora = (dataStr: string) => {
        const data = new Date(dataStr);
        return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    };

    const renderJson = (data: Record<string, any> | null) => {
        if (!data) return <span className="text-slate-400">-</span>;

        return (
            <pre className="text-xs bg-slate-100 dark:bg-slate-900 p-3 rounded-lg overflow-x-auto max-h-64">
                {JSON.stringify(data, null, 2)}
            </pre>
        );
    };

    if (loading && logs.length === 0) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        Logs de Auditoria
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        {total} registros encontrados
                    </p>
                </div>
            </div>

            {/* Filtros */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <div className="flex items-center justify-between">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition ${
                            showFilters
                                ? 'border-blue-500 text-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900'
                        }`}
                    >
                        <Filter size={18} />
                        Filtros
                    </button>
                    <button
                        onClick={fetchLogs}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                    >
                        <Search size={18} />
                        Atualizar
                    </button>
                </div>

                {/* Filtros expandidos */}
                {showFilters && (
                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">Entidade</label>
                            <select
                                value={filterEntidade}
                                onChange={(e) => { setFilterEntidade(e.target.value); setPage(1); }}
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                            >
                                <option value="">Todas</option>
                                <option value="usuarios">Usuários</option>
                                <option value="usinas">Usinas</option>
                                <option value="ucs">UCs</option>
                                <option value="faturas">Faturas</option>
                                <option value="cobrancas">Cobranças</option>
                                <option value="beneficiarios">Beneficiários</option>
                                <option value="contratos">Contratos</option>
                                <option value="leads">Leads</option>
                                <option value="saques">Saques</option>
                                <option value="configuracoes">Configurações</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">Ação</label>
                            <select
                                value={filterAcao}
                                onChange={(e) => { setFilterAcao(e.target.value); setPage(1); }}
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                            >
                                <option value="">Todas</option>
                                <option value="CREATE">Criar</option>
                                <option value="UPDATE">Atualizar</option>
                                <option value="DELETE">Excluir</option>
                                <option value="LOGIN">Login</option>
                                <option value="LOGOUT">Logout</option>
                                <option value="SYNC">Sincronizar</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">Data Início</label>
                            <input
                                type="date"
                                value={filterDataInicio}
                                onChange={(e) => { setFilterDataInicio(e.target.value); setPage(1); }}
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">Data Fim</label>
                            <input
                                type="date"
                                value={filterDataFim}
                                onChange={(e) => { setFilterDataFim(e.target.value); setPage(1); }}
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                            />
                        </div>
                        <div className="md:col-span-2 lg:col-span-4 flex justify-end">
                            <button
                                onClick={() => {
                                    setFilterEntidade('');
                                    setFilterAcao('');
                                    setFilterDataInicio('');
                                    setFilterDataFim('');
                                    setPage(1);
                                }}
                                className="px-4 py-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                            >
                                Limpar filtros
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Error */}
            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg text-red-600 dark:text-red-400">
                    {error}
                </div>
            )}

            {/* Tabela */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 dark:bg-slate-900">
                            <tr>
                                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500 dark:text-slate-400">Data/Hora</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500 dark:text-slate-400">Usuário</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500 dark:text-slate-400">Ação</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500 dark:text-slate-400">Entidade</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500 dark:text-slate-400">ID</th>
                                <th className="text-right py-3 px-4 text-sm font-medium text-slate-500 dark:text-slate-400">Detalhes</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {logs.map((log) => (
                                <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-900">
                                    <td className="py-3 px-4">
                                        <div>
                                            <p className="text-sm font-medium text-slate-900 dark:text-white">
                                                {formatarData(log.criado_em)}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                {formatarHora(log.criado_em)}
                                            </p>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center">
                                                <User size={14} className="text-slate-500" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-slate-900 dark:text-white">
                                                    {log.usuario_nome || 'Sistema'}
                                                </p>
                                                <p className="text-xs text-slate-500 font-mono">
                                                    {log.usuario_id.substring(0, 8)}...
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                            ACAO_CONFIG[log.acao]?.color || 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400'
                                        }`}>
                                            {ACAO_CONFIG[log.acao]?.label || log.acao}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-300">
                                        {ENTIDADE_LABELS[log.entidade] || log.entidade}
                                    </td>
                                    <td className="py-3 px-4 text-sm font-mono text-slate-500">
                                        {log.entidade_id ? `#${log.entidade_id.substring(0, 8)}` : '-'}
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                        <button
                                            onClick={() => { setSelectedLog(log); setShowModal(true); }}
                                            className="p-2 text-slate-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition"
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

                {logs.length === 0 && !loading && (
                    <div className="text-center py-12 text-slate-500">
                        Nenhum log encontrado
                    </div>
                )}

                {/* Paginação */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-700">
                        <p className="text-sm text-slate-500">
                            Mostrando {(page - 1) * perPage + 1} - {Math.min(page * perPage, total)} de {total}
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-900"
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <span className="text-sm text-slate-600 dark:text-slate-300">
                                {page} / {totalPages}
                            </span>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-900"
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal de Detalhes */}
            {showModal && selectedLog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-white dark:bg-slate-800 p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                Detalhes do Log
                            </h2>
                            <button
                                onClick={() => { setShowModal(false); setSelectedLog(null); }}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Info básica */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                        <Calendar size={12} />
                                        Data/Hora
                                    </label>
                                    <p className="font-medium text-slate-900 dark:text-white">
                                        {formatarDataHora(selectedLog.criado_em)}
                                    </p>
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                        <User size={12} />
                                        Usuário
                                    </label>
                                    <p className="font-medium text-slate-900 dark:text-white">
                                        {selectedLog.usuario_nome || 'Sistema'}
                                    </p>
                                    <p className="text-xs text-slate-500 font-mono">
                                        {selectedLog.usuario_id}
                                    </p>
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                        <Activity size={12} />
                                        Ação
                                    </label>
                                    <span className={`inline-block mt-1 px-2 py-1 rounded-full text-xs font-medium ${
                                        ACAO_CONFIG[selectedLog.acao]?.color || 'bg-slate-100 text-slate-700'
                                    }`}>
                                        {ACAO_CONFIG[selectedLog.acao]?.label || selectedLog.acao}
                                    </span>
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 dark:text-slate-400">Entidade</label>
                                    <p className="font-medium text-slate-900 dark:text-white">
                                        {ENTIDADE_LABELS[selectedLog.entidade] || selectedLog.entidade}
                                        {selectedLog.entidade_id && (
                                            <span className="text-xs text-slate-500 ml-2 font-mono">
                                                #{selectedLog.entidade_id}
                                            </span>
                                        )}
                                    </p>
                                </div>
                            </div>

                            {/* Informações de rede */}
                            {(selectedLog.ip_address || selectedLog.user_agent) && (
                                <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl space-y-3">
                                    {selectedLog.ip_address && (
                                        <div>
                                            <label className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                                <Globe size={12} />
                                                Endereço IP
                                            </label>
                                            <p className="font-mono text-sm text-slate-900 dark:text-white">
                                                {selectedLog.ip_address}
                                            </p>
                                        </div>
                                    )}
                                    {selectedLog.user_agent && (
                                        <div>
                                            <label className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                                <Monitor size={12} />
                                                User Agent
                                            </label>
                                            <p className="text-xs text-slate-600 dark:text-slate-300 break-all">
                                                {selectedLog.user_agent}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Dados anteriores */}
                            {selectedLog.dados_anteriores && Object.keys(selectedLog.dados_anteriores).length > 0 && (
                                <div>
                                    <label className="text-sm font-medium text-slate-900 dark:text-white mb-2 block">
                                        Dados Anteriores
                                    </label>
                                    {renderJson(selectedLog.dados_anteriores)}
                                </div>
                            )}

                            {/* Dados novos */}
                            {selectedLog.dados_novos && Object.keys(selectedLog.dados_novos).length > 0 && (
                                <div>
                                    <label className="text-sm font-medium text-slate-900 dark:text-white mb-2 block">
                                        Dados Novos
                                    </label>
                                    {renderJson(selectedLog.dados_novos)}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default LogsAuditoria;
