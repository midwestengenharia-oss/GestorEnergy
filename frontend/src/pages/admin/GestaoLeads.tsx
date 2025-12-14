/**
 * GestaoLeads - Gestao de Leads do Sistema CRM
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Target,
    Search,
    Filter,
    ChevronLeft,
    ChevronRight,
    Loader2,
    Phone,
    Mail,
    MapPin,
    MessageCircle,
    DollarSign,
    TrendingUp,
    UserCheck,
    UserX,
    Clock,
    Eye,
    Plus,
    Zap,
    FileSignature,
    RefreshCw,
    Home,
    Check,
    User
} from 'lucide-react';
import { leadsApi, type Lead, type StatusLead, type FunilResponse, type EstatisticasResponse } from '../../api/leads';

// ========================
// Configuracoes
// ========================

const STATUS_CONFIG: Record<StatusLead, { label: string; color: string; bgColor: string }> = {
    NOVO: { label: 'Novo', color: 'text-blue-700', bgColor: 'bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400' },
    VINCULANDO: { label: 'Vinculando', color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400' },
    VINCULADO: { label: 'Vinculado', color: 'text-blue-800', bgColor: 'bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400' },
    SIMULACAO: { label: 'Simulado', color: 'text-purple-700', bgColor: 'bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400' },
    CONTATO: { label: 'Em Contato', color: 'text-yellow-700', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400' },
    NEGOCIACAO: { label: 'Negociando', color: 'text-orange-700', bgColor: 'bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400' },
    AGUARDANDO_ACEITE: { label: 'Aguard. Aceite', color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400' },
    ACEITO: { label: 'Aceito', color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30 dark:text-green-400' },
    AGUARDANDO_ASSINATURA: { label: 'Aguard. Assin.', color: 'text-green-700', bgColor: 'bg-green-100 dark:bg-green-900/30 dark:text-green-400' },
    ASSINADO: { label: 'Assinado', color: 'text-green-800', bgColor: 'bg-green-100 dark:bg-green-900/30 dark:text-green-400' },
    TROCA_TITULARIDADE: { label: 'Troca Titular.', color: 'text-teal-700', bgColor: 'bg-teal-100 dark:bg-teal-900/30 dark:text-teal-400' },
    CADASTRANDO: { label: 'Cadastrando', color: 'text-teal-800', bgColor: 'bg-teal-100 dark:bg-teal-900/30 dark:text-teal-400' },
    CONVERTIDO: { label: 'Convertido', color: 'text-emerald-700', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400' },
    PERDIDO: { label: 'Perdido', color: 'text-red-700', bgColor: 'bg-red-100 dark:bg-red-900/30 dark:text-red-400' },
};

const ORIGEM_LABELS: Record<string, string> = {
    LANDING_PAGE: 'Landing Page',
    INDICACAO: 'Indicacao',
    GOOGLE_ADS: 'Google Ads',
    FACEBOOK: 'Facebook',
    INSTAGRAM: 'Instagram',
    WHATSAPP: 'WhatsApp',
    TELEFONE: 'Telefone',
    EVENTO: 'Evento',
    PARCEIRO: 'Parceiro',
    OUTROS: 'Outros',
};

// ========================
// Componente Principal
// ========================

export function GestaoLeads() {
    const navigate = useNavigate();

    const [leads, setLeads] = useState<Lead[]>([]);
    const [estatisticas, setEstatisticas] = useState<EstatisticasResponse | null>(null);
    const [funil, setFunil] = useState<FunilResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Paginacao
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const perPage = 20;

    // Filtros
    const [searchBusca, setSearchBusca] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('');
    const [filterOrigem, setFilterOrigem] = useState<string>('');
    const [showFilters, setShowFilters] = useState(false);
    const [showFunil, setShowFunil] = useState(true);

    // ========================
    // Fetch Data
    // ========================

    const fetchLeads = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await leadsApi.listar({
                page,
                per_page: perPage,
                busca: searchBusca || undefined,
                status: filterStatus || undefined,
                origem: filterOrigem || undefined,
            });

            setLeads(response.data.leads);
            setTotalPages(response.data.total_pages);
            setTotal(response.data.total);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Erro ao carregar leads');
        } finally {
            setLoading(false);
        }
    };

    const fetchEstatisticas = async () => {
        try {
            const [estatRes, funilRes] = await Promise.all([
                leadsApi.estatisticas(),
                leadsApi.funil(),
            ]);
            setEstatisticas(estatRes.data);
            setFunil(funilRes.data);
        } catch (err) {
            console.error('Erro ao carregar estatisticas', err);
        }
    };

    useEffect(() => {
        fetchLeads();
        fetchEstatisticas();
    }, [page, filterStatus, filterOrigem]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        fetchLeads();
    };

    // ========================
    // Helpers
    // ========================

    const formatarData = (dataStr: string | null) => {
        if (!dataStr) return '-';
        return new Date(dataStr).toLocaleDateString('pt-BR');
    };

    const formatarMoeda = (valor: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
    };

    // ========================
    // Render
    // ========================

    if (loading && leads.length === 0) {
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
                        Gestao de Leads
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        {total} leads cadastrados
                    </p>
                </div>
                <button
                    onClick={() => setShowFunil(!showFunil)}
                    className={`px-4 py-2 rounded-lg border transition ${
                        showFunil
                            ? 'border-blue-500 text-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                >
                    <TrendingUp size={18} className="inline mr-2" />
                    Funil
                </button>
            </div>

            {/* Cards de Estatisticas */}
            {estatisticas && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Leads Novos</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                                    {estatisticas.leads_novos}
                                </p>
                            </div>
                            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                                <Target className="text-blue-600 dark:text-blue-400" size={24} />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Em Contato</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                                    {estatisticas.leads_em_contato}
                                </p>
                            </div>
                            <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl flex items-center justify-center">
                                <MessageCircle className="text-yellow-600 dark:text-yellow-400" size={24} />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Convertidos</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                                    {estatisticas.leads_convertidos}
                                </p>
                                <p className="text-xs text-green-500 mt-1">
                                    {estatisticas.taxa_conversao.toFixed(1)}% conversao
                                </p>
                            </div>
                            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                                <UserCheck className="text-green-600 dark:text-green-400" size={24} />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Economia Simulada</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                                    {formatarMoeda(estatisticas.economia_total_simulada)}
                                </p>
                                <p className="text-xs text-slate-400 mt-1">anual</p>
                            </div>
                            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
                                <DollarSign className="text-purple-600 dark:text-purple-400" size={24} />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Funil de Vendas */}
            {showFunil && funil && (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                        Funil de Vendas
                        <span className="text-sm font-normal text-slate-500 ml-2">
                            ({funil.taxa_conversao_geral.toFixed(1)}% conversao geral)
                        </span>
                    </h2>
                    <div className="flex items-end gap-2 overflow-x-auto pb-2">
                        {funil.etapas.map((etapa, index) => {
                            const maxQtd = Math.max(...funil.etapas.map(e => e.quantidade), 1);
                            const height = Math.max((etapa.quantidade / maxQtd) * 120, 20);
                            const config = STATUS_CONFIG[etapa.status as StatusLead];

                            return (
                                <div key={etapa.status} className="flex flex-col items-center min-w-[80px]">
                                    <span className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                                        {etapa.quantidade}
                                    </span>
                                    <div
                                        className={`w-full rounded-t-lg ${config?.bgColor || 'bg-slate-200'} transition-all`}
                                        style={{ height: `${height}px` }}
                                    />
                                    <span className="text-xs text-slate-500 mt-2 text-center whitespace-nowrap">
                                        {config?.label || etapa.nome}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Busca e Filtros */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar por nome, telefone ou email..."
                            value={searchBusca}
                            onChange={(e) => setSearchBusca(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                    <button
                        type="button"
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
                        type="submit"
                        className="flex items-center gap-2 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                    >
                        <Search size={18} />
                        Buscar
                    </button>
                </form>

                {/* Filtros expandidos */}
                {showFilters && (
                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 flex flex-wrap gap-4">
                        <div>
                            <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">Status</label>
                            <select
                                value={filterStatus}
                                onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
                                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                            >
                                <option value="">Todos</option>
                                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                                    <option key={key} value={key}>{config.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">Origem</label>
                            <select
                                value={filterOrigem}
                                onChange={(e) => { setFilterOrigem(e.target.value); setPage(1); }}
                                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                            >
                                <option value="">Todas</option>
                                {Object.entries(ORIGEM_LABELS).map(([key, label]) => (
                                    <option key={key} value={key}>{label}</option>
                                ))}
                            </select>
                        </div>
                        <button
                            onClick={() => {
                                setSearchBusca('');
                                setFilterStatus('');
                                setFilterOrigem('');
                                setPage(1);
                            }}
                            className="self-end px-4 py-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                        >
                            Limpar filtros
                        </button>
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
                                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500 dark:text-slate-400">Lead</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500 dark:text-slate-400">Contato</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500 dark:text-slate-400">Origem</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500 dark:text-slate-400">Status</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500 dark:text-slate-400">Criado em</th>
                                <th className="text-right py-3 px-4 text-sm font-medium text-slate-500 dark:text-slate-400">Acoes</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {leads.map((lead) => {
                                const statusConfig = STATUS_CONFIG[lead.status] || STATUS_CONFIG.NOVO;

                                return (
                                    <tr
                                        key={lead.id}
                                        className="hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer"
                                        onClick={() => navigate(`/app/admin/leads/${lead.id}`)}
                                    >
                                        <td className="py-3 px-4">
                                            <div>
                                                <p className="font-medium text-slate-900 dark:text-white">
                                                    {lead.nome}
                                                </p>
                                                {lead.cidade && lead.uf && (
                                                    <p className="text-sm text-slate-500 flex items-center gap-1">
                                                        <MapPin size={12} />
                                                        {lead.cidade}/{lead.uf}
                                                    </p>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="space-y-1">
                                                {lead.telefone && (
                                                    <p className="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-1">
                                                        <Phone size={12} />
                                                        {lead.telefone}
                                                    </p>
                                                )}
                                                {lead.email && (
                                                    <p className="text-sm text-slate-500 flex items-center gap-1">
                                                        <Mail size={12} />
                                                        {lead.email}
                                                    </p>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-300">
                                            {ORIGEM_LABELS[lead.origem] || lead.origem}
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}>
                                                {statusConfig.label}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-300">
                                            {formatarData(lead.criado_em)}
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(`/app/admin/leads/${lead.id}`);
                                                }}
                                                className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition"
                                            >
                                                <Eye size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {leads.length === 0 && !loading && (
                    <div className="text-center py-12 text-slate-500">
                        Nenhum lead encontrado
                    </div>
                )}

                {/* Paginacao */}
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
        </div>
    );
}

export default GestaoLeads;
