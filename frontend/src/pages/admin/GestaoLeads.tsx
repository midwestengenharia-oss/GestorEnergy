/**
 * GestaoLeads - Gestão de Leads do Sistema
 */

import { useState, useEffect } from 'react';
import {
    Target,
    Search,
    Filter,
    ChevronLeft,
    ChevronRight,
    Loader2,
    X,
    Phone,
    Mail,
    MapPin,
    MessageCircle,
    DollarSign,
    TrendingUp,
    UserCheck,
    UserX,
    Clock,
    Calendar
} from 'lucide-react';
import api from '../../api/client';

interface Simulacao {
    id: number;
    lead_id: number;
    valor_fatura_media: number;
    consumo_medio_kwh: number | null;
    quantidade_ucs: number;
    desconto_aplicado: number;
    economia_mensal: number;
    economia_anual: number;
    percentual_economia: number;
    criado_em: string | null;
}

interface Contato {
    id: number;
    lead_id: number;
    tipo_contato: string;
    descricao: string;
    proximo_contato: string | null;
    realizado_por: string | null;
    criado_em: string;
}

interface Lead {
    id: number;
    nome: string;
    email: string | null;
    telefone: string | null;
    cpf: string;
    cidade: string | null;
    uf: string | null;
    status: string;
    origem: string;
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
    responsavel_id: string | null;
    responsavel_nome: string | null;
    observacoes: string | null;
    convertido_em: string | null;
    beneficiario_id: number | null;
    criado_em: string | null;
    atualizado_em: string | null;
    simulacoes: Simulacao[] | null;
    contatos: Contato[] | null;
}

interface LeadListResponse {
    leads: Lead[];
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
}

interface Estatisticas {
    total_leads: number;
    leads_novos: number;
    leads_em_contato: number;
    leads_convertidos: number;
    leads_perdidos: number;
    taxa_conversao: number;
    economia_total_simulada: number;
    por_origem: { origem: string; total: number }[];
    por_status: { status: string; total: number }[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    NOVO: { label: 'Novo', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    SIMULACAO: { label: 'Simulado', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
    CONTATO: { label: 'Em Contato', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
    NEGOCIACAO: { label: 'Negociando', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
    CONVERTIDO: { label: 'Convertido', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    PERDIDO: { label: 'Perdido', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' }
};

const ORIGEM_LABELS: Record<string, string> = {
    LANDING_PAGE: 'Landing Page',
    INDICACAO: 'Indicação',
    GOOGLE_ADS: 'Google Ads',
    FACEBOOK: 'Facebook',
    INSTAGRAM: 'Instagram',
    WHATSAPP: 'WhatsApp',
    TELEFONE: 'Telefone',
    OUTROS: 'Outros'
};

export function GestaoLeads() {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [estatisticas, setEstatisticas] = useState<Estatisticas | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Paginação
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const perPage = 20;

    // Filtros
    const [searchBusca, setSearchBusca] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('');
    const [filterOrigem, setFilterOrigem] = useState<string>('');
    const [showFilters, setShowFilters] = useState(false);

    // Modal
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    // Atualizar status
    const [newStatus, setNewStatus] = useState<string>('');
    const [perdidoMotivo, setPerdidoMotivo] = useState('');

    const fetchLeads = async () => {
        try {
            setLoading(true);
            setError(null);

            const params = new URLSearchParams();
            params.append('page', page.toString());
            params.append('per_page', perPage.toString());

            if (searchBusca) params.append('busca', searchBusca);
            if (filterStatus) params.append('status', filterStatus);
            if (filterOrigem) params.append('origem', filterOrigem);

            const response = await api.get<LeadListResponse>(`/leads?${params.toString()}`);
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
            const response = await api.get<Estatisticas>('/leads/estatisticas');
            setEstatisticas(response.data);
        } catch (err) {
            console.error('Erro ao carregar estatísticas', err);
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

    const handleUpdateStatus = async () => {
        if (!selectedLead || !newStatus) return;

        try {
            setActionLoading(true);

            if (newStatus === 'PERDIDO') {
                if (!perdidoMotivo || perdidoMotivo.length < 5) {
                    alert('Informe o motivo da perda (mínimo 5 caracteres)');
                    return;
                }
                await api.post(`/leads/${selectedLead.id}/perder?motivo=${encodeURIComponent(perdidoMotivo)}`);
            } else {
                await api.put(`/leads/${selectedLead.id}`, { status: newStatus });
            }

            await fetchLeads();
            await fetchEstatisticas();
            setShowModal(false);
            setSelectedLead(null);
            setNewStatus('');
            setPerdidoMotivo('');
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Erro ao atualizar status');
        } finally {
            setActionLoading(false);
        }
    };

    const formatarData = (dataStr: string | null) => {
        if (!dataStr) return '-';
        const data = new Date(dataStr);
        return data.toLocaleDateString('pt-BR');
    };

    const formatarDataHora = (dataStr: string | null) => {
        if (!dataStr) return '-';
        const data = new Date(dataStr);
        return data.toLocaleString('pt-BR');
    };

    const formatarMoeda = (valor: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
    };

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
                        Gestão de Leads
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        {total} leads cadastrados
                    </p>
                </div>
            </div>

            {/* Cards de Estatísticas */}
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
                                    {(estatisticas.taxa_conversao * 100).toFixed(1)}% conversão
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

            {/* Busca e Filtros */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar por nome, telefone ou CPF..."
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
                                <option value="NOVO">Novo</option>
                                <option value="SIMULACAO">Simulado</option>
                                <option value="CONTATO">Em Contato</option>
                                <option value="NEGOCIACAO">Negociando</option>
                                <option value="CONVERTIDO">Convertido</option>
                                <option value="PERDIDO">Perdido</option>
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
                                <option value="LANDING_PAGE">Landing Page</option>
                                <option value="INDICACAO">Indicação</option>
                                <option value="GOOGLE_ADS">Google Ads</option>
                                <option value="FACEBOOK">Facebook</option>
                                <option value="INSTAGRAM">Instagram</option>
                                <option value="WHATSAPP">WhatsApp</option>
                                <option value="TELEFONE">Telefone</option>
                                <option value="OUTROS">Outros</option>
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
                                <th className="text-right py-3 px-4 text-sm font-medium text-slate-500 dark:text-slate-400">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {leads.map((lead) => (
                                <tr key={lead.id} className="hover:bg-slate-50 dark:hover:bg-slate-900">
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
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                            STATUS_CONFIG[lead.status]?.color || 'bg-slate-100 text-slate-700'
                                        }`}>
                                            {STATUS_CONFIG[lead.status]?.label || lead.status}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-300">
                                        {formatarData(lead.criado_em)}
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                        <button
                                            onClick={() => { setSelectedLead(lead); setShowModal(true); setNewStatus(lead.status); }}
                                            className="px-3 py-1 text-sm text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition"
                                        >
                                            Ver detalhes
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {leads.length === 0 && !loading && (
                    <div className="text-center py-12 text-slate-500">
                        Nenhum lead encontrado
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
            {showModal && selectedLead && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-white dark:bg-slate-800 p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                Detalhes do Lead
                            </h2>
                            <button
                                onClick={() => { setShowModal(false); setSelectedLead(null); setNewStatus(''); setPerdidoMotivo(''); }}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Info do lead */}
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                                        {selectedLead.nome}
                                    </h3>
                                    <div className="mt-2 space-y-1">
                                        {selectedLead.telefone && (
                                            <p className="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-2">
                                                <Phone size={14} />
                                                {selectedLead.telefone}
                                            </p>
                                        )}
                                        {selectedLead.email && (
                                            <p className="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-2">
                                                <Mail size={14} />
                                                {selectedLead.email}
                                            </p>
                                        )}
                                        {selectedLead.cidade && selectedLead.uf && (
                                            <p className="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-2">
                                                <MapPin size={14} />
                                                {selectedLead.cidade}/{selectedLead.uf}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                    STATUS_CONFIG[selectedLead.status]?.color || 'bg-slate-100 text-slate-700'
                                }`}>
                                    {STATUS_CONFIG[selectedLead.status]?.label || selectedLead.status}
                                </span>
                            </div>

                            {/* Dados */}
                            <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl">
                                <div>
                                    <label className="text-xs text-slate-500 dark:text-slate-400">CPF</label>
                                    <p className="font-medium text-slate-900 dark:text-white">{selectedLead.cpf}</p>
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 dark:text-slate-400">Origem</label>
                                    <p className="font-medium text-slate-900 dark:text-white">
                                        {ORIGEM_LABELS[selectedLead.origem] || selectedLead.origem}
                                    </p>
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 dark:text-slate-400">Criado em</label>
                                    <p className="font-medium text-slate-900 dark:text-white">
                                        {formatarDataHora(selectedLead.criado_em)}
                                    </p>
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 dark:text-slate-400">Responsável</label>
                                    <p className="font-medium text-slate-900 dark:text-white">
                                        {selectedLead.responsavel_nome || 'Não atribuído'}
                                    </p>
                                </div>
                            </div>

                            {/* Simulações */}
                            {selectedLead.simulacoes && selectedLead.simulacoes.length > 0 && (
                                <div>
                                    <h4 className="font-medium text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                                        <TrendingUp size={18} />
                                        Simulações
                                    </h4>
                                    <div className="space-y-2">
                                        {selectedLead.simulacoes.map((sim) => (
                                            <div key={sim.id} className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="text-sm text-slate-600 dark:text-slate-300">
                                                            Fatura média: {formatarMoeda(sim.valor_fatura_media)}
                                                        </p>
                                                        <p className="text-xs text-slate-500">
                                                            {sim.quantidade_ucs} UC(s) - {formatarData(sim.criado_em)}
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-lg font-bold text-green-600 dark:text-green-400">
                                                            {formatarMoeda(sim.economia_anual)}/ano
                                                        </p>
                                                        <p className="text-xs text-green-500">
                                                            {(sim.percentual_economia * 100).toFixed(0)}% economia
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Histórico de contatos */}
                            {selectedLead.contatos && selectedLead.contatos.length > 0 && (
                                <div>
                                    <h4 className="font-medium text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                                        <MessageCircle size={18} />
                                        Histórico de Contatos
                                    </h4>
                                    <div className="space-y-2">
                                        {selectedLead.contatos.map((contato) => (
                                            <div key={contato.id} className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                                                <div className="flex items-start justify-between">
                                                    <div>
                                                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                                                            {contato.tipo_contato}
                                                        </p>
                                                        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                                                            {contato.descricao}
                                                        </p>
                                                    </div>
                                                    <p className="text-xs text-slate-500">
                                                        {formatarDataHora(contato.criado_em)}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Atualizar Status */}
                            {selectedLead.status !== 'CONVERTIDO' && selectedLead.status !== 'PERDIDO' && (
                                <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                                    <h4 className="font-medium text-slate-900 dark:text-white mb-3">
                                        Atualizar Status
                                    </h4>
                                    <div className="flex flex-col gap-3">
                                        <select
                                            value={newStatus}
                                            onChange={(e) => setNewStatus(e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                                        >
                                            <option value="NOVO">Novo</option>
                                            <option value="SIMULACAO">Simulado</option>
                                            <option value="CONTATO">Em Contato</option>
                                            <option value="NEGOCIACAO">Negociando</option>
                                            <option value="PERDIDO">Perdido</option>
                                        </select>

                                        {newStatus === 'PERDIDO' && (
                                            <textarea
                                                placeholder="Motivo da perda (obrigatório)"
                                                value={perdidoMotivo}
                                                onChange={(e) => setPerdidoMotivo(e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white resize-none"
                                                rows={3}
                                            />
                                        )}

                                        <button
                                            onClick={handleUpdateStatus}
                                            disabled={actionLoading || newStatus === selectedLead.status}
                                            className="w-full py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {actionLoading ? (
                                                <Loader2 className="animate-spin mx-auto" size={20} />
                                            ) : (
                                                'Atualizar Status'
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default GestaoLeads;
