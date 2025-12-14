/**
 * KanbanLeads - Visualizacao Kanban do Pipeline de Leads
 * Modulo do GESTOR para gerenciar leads com drag & drop
 */

import { useState, useEffect, DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Loader2,
    Phone,
    MapPin,
    Calendar,
    User,
    GripVertical,
    RefreshCw,
    Filter,
    Eye
} from 'lucide-react';
import { leadsApi, type Lead, type StatusLead } from '../../api/leads';

// ========================
// Configuracao das Colunas
// ========================

interface KanbanColumn {
    id: string;
    title: string;
    statuses: StatusLead[];
    color: string;
    bgColor: string;
}

const KANBAN_COLUMNS: KanbanColumn[] = [
    {
        id: 'novos',
        title: 'Novos',
        statuses: ['NOVO', 'VINCULANDO', 'VINCULADO'],
        color: 'text-blue-600',
        bgColor: 'bg-blue-500'
    },
    {
        id: 'contato',
        title: 'Em Contato',
        statuses: ['SIMULACAO', 'CONTATO', 'NEGOCIACAO'],
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-500'
    },
    {
        id: 'proposta',
        title: 'Proposta',
        statuses: ['AGUARDANDO_ACEITE'],
        color: 'text-orange-600',
        bgColor: 'bg-orange-500'
    },
    {
        id: 'fechamento',
        title: 'Fechamento',
        statuses: ['ACEITO', 'AGUARDANDO_ASSINATURA', 'ASSINADO'],
        color: 'text-green-600',
        bgColor: 'bg-green-500'
    },
    {
        id: 'onboarding',
        title: 'Onboarding',
        statuses: ['TROCA_TITULARIDADE', 'CADASTRANDO'],
        color: 'text-teal-600',
        bgColor: 'bg-teal-500'
    },
    {
        id: 'convertidos',
        title: 'Convertidos',
        statuses: ['CONVERTIDO'],
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-500'
    },
    {
        id: 'perdidos',
        title: 'Perdidos',
        statuses: ['PERDIDO'],
        color: 'text-red-600',
        bgColor: 'bg-red-500'
    }
];

const STATUS_LABELS: Record<StatusLead, string> = {
    NOVO: 'Novo',
    VINCULANDO: 'Vinculando',
    VINCULADO: 'Vinculado',
    SIMULACAO: 'Simulado',
    CONTATO: 'Em Contato',
    NEGOCIACAO: 'Negociando',
    AGUARDANDO_ACEITE: 'Aguard. Aceite',
    ACEITO: 'Aceito',
    AGUARDANDO_ASSINATURA: 'Aguard. Assin.',
    ASSINADO: 'Assinado',
    TROCA_TITULARIDADE: 'Troca Titular.',
    CADASTRANDO: 'Cadastrando',
    CONVERTIDO: 'Convertido',
    PERDIDO: 'Perdido'
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
    OUTROS: 'Outros'
};

// ========================
// Componente Principal
// ========================

export function KanbanLeads() {
    const navigate = useNavigate();

    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [updating, setUpdating] = useState<number | null>(null);

    // Filtros
    const [filterOrigem, setFilterOrigem] = useState<string>('');
    const [showFilters, setShowFilters] = useState(false);

    // Drag state
    const [draggedLead, setDraggedLead] = useState<Lead | null>(null);
    const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

    // ========================
    // Fetch Data
    // ========================

    const fetchLeads = async () => {
        try {
            setLoading(true);
            setError(null);

            // Buscar todos os leads (sem paginacao para o kanban)
            const response = await leadsApi.listar({
                per_page: 500,
                origem: filterOrigem || undefined
            });

            setLeads(response.data.leads);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Erro ao carregar leads');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLeads();
    }, [filterOrigem]);

    // ========================
    // Drag & Drop Handlers
    // ========================

    const handleDragStart = (e: DragEvent<HTMLDivElement>, lead: Lead) => {
        setDraggedLead(lead);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', lead.id.toString());

        // Adicionar classe de arrasto
        if (e.currentTarget) {
            e.currentTarget.classList.add('opacity-50');
        }
    };

    const handleDragEnd = (e: DragEvent<HTMLDivElement>) => {
        setDraggedLead(null);
        setDragOverColumn(null);

        if (e.currentTarget) {
            e.currentTarget.classList.remove('opacity-50');
        }
    };

    const handleDragOver = (e: DragEvent<HTMLDivElement>, columnId: string) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverColumn(columnId);
    };

    const handleDragLeave = () => {
        setDragOverColumn(null);
    };

    const handleDrop = async (e: DragEvent<HTMLDivElement>, column: KanbanColumn) => {
        e.preventDefault();
        setDragOverColumn(null);

        if (!draggedLead) return;

        // Se o lead ja esta na coluna, nao fazer nada
        if (column.statuses.includes(draggedLead.status)) {
            setDraggedLead(null);
            return;
        }

        // Pegar o primeiro status da coluna de destino
        const newStatus = column.statuses[0];

        try {
            setUpdating(draggedLead.id);

            await leadsApi.atualizar(draggedLead.id, { status: newStatus });

            // Atualizar localmente
            setLeads(prev =>
                prev.map(lead =>
                    lead.id === draggedLead.id
                        ? { ...lead, status: newStatus }
                        : lead
                )
            );
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Erro ao atualizar status');
        } finally {
            setUpdating(null);
            setDraggedLead(null);
        }
    };

    // ========================
    // Helpers
    // ========================

    const getLeadsByColumn = (column: KanbanColumn): Lead[] => {
        return leads.filter(lead => column.statuses.includes(lead.status));
    };

    const formatarData = (dataStr: string | null) => {
        if (!dataStr) return '-';
        const date = new Date(dataStr);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Hoje';
        if (diffDays === 1) return 'Ontem';
        if (diffDays < 7) return `${diffDays} dias`;
        return date.toLocaleDateString('pt-BR');
    };

    // ========================
    // Render
    // ========================

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="space-y-4 h-full">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        Kanban de Leads
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        {leads.length} leads no pipeline
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition ${
                            showFilters
                                ? 'border-blue-500 text-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                    >
                        <Filter size={18} />
                        Filtros
                    </button>
                    <button
                        onClick={fetchLeads}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition"
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                        Atualizar
                    </button>
                </div>
            </div>

            {/* Filtros */}
            {showFilters && (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex flex-wrap gap-4">
                    <div>
                        <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">Origem</label>
                        <select
                            value={filterOrigem}
                            onChange={(e) => setFilterOrigem(e.target.value)}
                            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                        >
                            <option value="">Todas</option>
                            {Object.entries(ORIGEM_LABELS).map(([key, label]) => (
                                <option key={key} value={key}>{label}</option>
                            ))}
                        </select>
                    </div>
                    <button
                        onClick={() => setFilterOrigem('')}
                        className="self-end px-4 py-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    >
                        Limpar filtros
                    </button>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg text-red-600 dark:text-red-400">
                    {error}
                    <button
                        onClick={() => setError(null)}
                        className="ml-2 underline"
                    >
                        Fechar
                    </button>
                </div>
            )}

            {/* Kanban Board */}
            <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: 'calc(100vh - 280px)' }}>
                {KANBAN_COLUMNS.map((column) => {
                    const columnLeads = getLeadsByColumn(column);
                    const isOver = dragOverColumn === column.id;

                    return (
                        <div
                            key={column.id}
                            className={`flex-shrink-0 w-72 flex flex-col rounded-xl border transition-colors ${
                                isOver
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'
                            }`}
                            onDragOver={(e) => handleDragOver(e, column.id)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, column)}
                        >
                            {/* Column Header */}
                            <div className="p-3 border-b border-slate-200 dark:border-slate-700">
                                <div className="flex items-center gap-2">
                                    <div className={`w-3 h-3 rounded-full ${column.bgColor}`} />
                                    <h3 className={`font-semibold ${column.color} dark:text-slate-200`}>
                                        {column.title}
                                    </h3>
                                    <span className="ml-auto bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs px-2 py-0.5 rounded-full">
                                        {columnLeads.length}
                                    </span>
                                </div>
                            </div>

                            {/* Column Content */}
                            <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-380px)]">
                                {columnLeads.map((lead) => (
                                    <div
                                        key={lead.id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, lead)}
                                        onDragEnd={handleDragEnd}
                                        className={`bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow ${
                                            updating === lead.id ? 'opacity-50' : ''
                                        }`}
                                    >
                                        {/* Card Header */}
                                        <div className="flex items-start gap-2">
                                            <GripVertical size={16} className="text-slate-400 mt-0.5 flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-slate-900 dark:text-white truncate">
                                                    {lead.nome}
                                                </p>
                                                <span className="text-xs text-slate-500 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                                                    {STATUS_LABELS[lead.status]}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => navigate(`/app/gestor/leads/${lead.id}`)}
                                                className="p-1 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition"
                                            >
                                                <Eye size={14} />
                                            </button>
                                        </div>

                                        {/* Card Body */}
                                        <div className="mt-2 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                                            {lead.telefone && (
                                                <div className="flex items-center gap-1">
                                                    <Phone size={12} />
                                                    <span className="truncate">{lead.telefone}</span>
                                                </div>
                                            )}
                                            {lead.cidade && (
                                                <div className="flex items-center gap-1">
                                                    <MapPin size={12} />
                                                    <span className="truncate">
                                                        {lead.cidade}{lead.uf ? `/${lead.uf}` : ''}
                                                    </span>
                                                </div>
                                            )}
                                            <div className="flex items-center gap-1">
                                                <Calendar size={12} />
                                                <span>{formatarData(lead.criado_em)}</span>
                                            </div>
                                        </div>

                                        {/* Card Footer */}
                                        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                                            <span className="text-xs text-slate-400">
                                                {ORIGEM_LABELS[lead.origem] || lead.origem}
                                            </span>
                                            {lead.responsavel_nome && (
                                                <div className="flex items-center gap-1 text-xs text-slate-500">
                                                    <User size={12} />
                                                    <span className="truncate max-w-[80px]">
                                                        {lead.responsavel_nome}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Loading indicator */}
                                        {updating === lead.id && (
                                            <div className="absolute inset-0 bg-white/50 dark:bg-slate-800/50 flex items-center justify-center rounded-lg">
                                                <Loader2 size={20} className="animate-spin text-blue-500" />
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {columnLeads.length === 0 && (
                                    <div className="text-center py-8 text-slate-400 text-sm">
                                        Nenhum lead
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default KanbanLeads;
