/**
 * Gestao de Faturas - Pagina unificada com Kanban e Lista
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    FileX, FileText, Zap, FileEdit, CreditCard, CheckCircle, Check,
    RefreshCw, LayoutGrid, List, Search, Filter, ChevronDown, ChevronRight,
    Eye, Copy, Loader2, AlertCircle, RotateCcw, RefreshCcw
} from 'lucide-react';
import { faturasApi, FaturaGestao, TotaisGestao, StatusFluxo } from '../../api/faturas';
import { usinasApi } from '../../api/usinas';
import { cobrancasApi } from '../../api/cobrancas';

// Configuracao dos status do fluxo
const STATUS_CONFIG: Record<StatusFluxo, { label: string; cor: string; corBg: string; icon: React.ElementType }> = {
    AGUARDANDO_PDF: { label: 'Aguardando PDF', cor: 'text-slate-500', corBg: 'bg-slate-100 dark:bg-slate-800', icon: FileX },
    PDF_RECEBIDO: { label: 'PDF Recebido', cor: 'text-yellow-600', corBg: 'bg-yellow-50 dark:bg-yellow-900/20', icon: FileText },
    EXTRAIDA: { label: 'Extraida', cor: 'text-blue-600', corBg: 'bg-blue-50 dark:bg-blue-900/20', icon: Zap },
    COBRANCA_RASCUNHO: { label: 'Rascunho', cor: 'text-purple-600', corBg: 'bg-purple-50 dark:bg-purple-900/20', icon: FileEdit },
    COBRANCA_EMITIDA: { label: 'Emitida', cor: 'text-orange-600', corBg: 'bg-orange-50 dark:bg-orange-900/20', icon: CreditCard },
    COBRANCA_PAGA: { label: 'Paga', cor: 'text-green-600', corBg: 'bg-green-50 dark:bg-green-900/20', icon: CheckCircle },
    FATURA_QUITADA: { label: 'Quitada', cor: 'text-emerald-700', corBg: 'bg-emerald-50 dark:bg-emerald-900/20', icon: Check },
};

const MESES = [
    { value: '', label: 'Todos os meses' },
    { value: 1, label: 'Janeiro' },
    { value: 2, label: 'Fevereiro' },
    { value: 3, label: 'Marco' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Maio' },
    { value: 6, label: 'Junho' },
    { value: 7, label: 'Julho' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Setembro' },
    { value: 10, label: 'Outubro' },
    { value: 11, label: 'Novembro' },
    { value: 12, label: 'Dezembro' },
];

interface Usina {
    id: number;
    nome: string;
}

type ViewMode = 'kanban' | 'lista';

export default function GestaoFaturas() {
    // Estados
    const [viewMode, setViewMode] = useState<ViewMode>('kanban');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [faturas, setFaturas] = useState<FaturaGestao[]>([]);
    const [totais, setTotais] = useState<TotaisGestao | null>(null);
    const [usinas, setUsinas] = useState<Usina[]>([]);
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [loadingAction, setLoadingAction] = useState<number | null>(null);
    const [previewHtml, setPreviewHtml] = useState<string | null>(null);
    const [selectedStatus, setSelectedStatus] = useState<StatusFluxo | null>(null);

    // Refs para colunas do Kanban (scroll)
    const kanbanRefs = useRef<Record<StatusFluxo, HTMLDivElement | null>>({
        AGUARDANDO_PDF: null,
        PDF_RECEBIDO: null,
        EXTRAIDA: null,
        COBRANCA_RASCUNHO: null,
        COBRANCA_EMITIDA: null,
        COBRANCA_PAGA: null,
        FATURA_QUITADA: null,
    });

    // Filtros
    const [filtroUsina, setFiltroUsina] = useState<number | ''>('');
    const [filtroMes, setFiltroMes] = useState<number | ''>('');
    const [filtroAno, setFiltroAno] = useState<number>(new Date().getFullYear());
    const [filtroBusca, setFiltroBusca] = useState('');

    // Anos disponiveis (ultimos 3 + atual + proximo)
    const anosDisponiveis = Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - 2 + i);

    // Carregar usinas
    useEffect(() => {
        const carregarUsinas = async () => {
            try {
                const response = await usinasApi.minhas();
                setUsinas(response.data || []);
            } catch (err) {
                console.error('Erro ao carregar usinas:', err);
            }
        };
        carregarUsinas();
    }, []);

    // Carregar faturas
    const carregarFaturas = useCallback(async () => {
        try {
            setRefreshing(true);
            const response = await faturasApi.gestao({
                usina_id: filtroUsina || undefined,
                mes_referencia: filtroMes || undefined,
                ano_referencia: filtroAno,
                busca: filtroBusca || undefined,
            });
            setFaturas(response.data.faturas || []);
            setTotais(response.data.totais || null);
        } catch (err) {
            console.error('Erro ao carregar faturas:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [filtroUsina, filtroMes, filtroAno, filtroBusca]);

    useEffect(() => {
        carregarFaturas();
    }, [carregarFaturas]);

    // Formatadores
    const formatCurrency = (value: number | undefined | null) => {
        if (value === undefined || value === null) return '-';
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    // Agrupar faturas por status para o Kanban
    const faturasPorStatus = React.useMemo(() => {
        const grupos: Record<StatusFluxo, FaturaGestao[]> = {
            AGUARDANDO_PDF: [],
            PDF_RECEBIDO: [],
            EXTRAIDA: [],
            COBRANCA_RASCUNHO: [],
            COBRANCA_EMITIDA: [],
            COBRANCA_PAGA: [],
            FATURA_QUITADA: [],
        };
        faturas.forEach(f => {
            if (grupos[f.status_fluxo]) {
                grupos[f.status_fluxo].push(f);
            }
        });
        return grupos;
    }, [faturas]);

    // Acoes
    const handleExtrair = async (faturaId: number) => {
        setLoadingAction(faturaId);
        try {
            await faturasApi.extrair(faturaId);
            await carregarFaturas();
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Erro ao extrair fatura');
        } finally {
            setLoadingAction(null);
        }
    };

    const handleGerarCobranca = async (fatura: FaturaGestao) => {
        if (!fatura.beneficiario) {
            alert('Fatura sem beneficiario vinculado');
            return;
        }
        setLoadingAction(fatura.id);
        try {
            await cobrancasApi.gerarAutomatica(fatura.id, fatura.beneficiario.id);
            await carregarFaturas();
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Erro ao gerar cobranca');
        } finally {
            setLoadingAction(null);
        }
    };

    const handleAprovar = async (cobrancaId: number) => {
        setLoadingAction(cobrancaId);
        try {
            await cobrancasApi.aprovar(cobrancaId, false);
            await carregarFaturas();
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Erro ao aprovar cobranca');
        } finally {
            setLoadingAction(null);
        }
    };

    const handleCopiarPix = (pix: string) => {
        navigator.clipboard.writeText(pix);
        alert('Codigo PIX copiado!');
    };

    const handleVerRelatorio = async (cobrancaId: number) => {
        try {
            const response = await cobrancasApi.obterRelatorioHTML(cobrancaId);
            setPreviewHtml(response.data);
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Erro ao carregar relatorio');
        }
    };

    const handleRefazer = async (faturaId: number) => {
        if (!confirm('Tem certeza que deseja refazer esta fatura? Isso ira resetar a fatura e excluir a cobranca associada.')) {
            return;
        }
        setLoadingAction(faturaId);
        try {
            await faturasApi.refazer(faturaId);
            await carregarFaturas();
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Erro ao refazer fatura');
        } finally {
            setLoadingAction(null);
        }
    };

    const handleReprocessar = async (faturaId: number) => {
        if (!confirm('Deseja reprocessar a extracao dos dados desta fatura?')) {
            return;
        }
        setLoadingAction(faturaId);
        try {
            await faturasApi.reprocessarExtracao(faturaId);
            await carregarFaturas();
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Erro ao reprocessar extracao');
        } finally {
            setLoadingAction(null);
        }
    };

    // Handler para clique nos cards de status
    const handleStatusClick = (status: StatusFluxo) => {
        if (selectedStatus === status) {
            // Se clicar no mesmo, desseleciona
            setSelectedStatus(null);
        } else {
            setSelectedStatus(status);
            // Se em Kanban, faz scroll para a coluna
            if (viewMode === 'kanban' && kanbanRefs.current[status]) {
                kanbanRefs.current[status]?.scrollIntoView({ behavior: 'smooth', inline: 'center' });
            }
        }
    };

    // Faturas filtradas por status selecionado (para Lista)
    const faturasFiltradas = React.useMemo(() => {
        if (!selectedStatus) return faturas;
        return faturas.filter(f => f.status_fluxo === selectedStatus);
    }, [faturas, selectedStatus]);

    // Renderizar card do Kanban
    const renderKanbanCard = (fatura: FaturaGestao) => {
        const config = STATUS_CONFIG[fatura.status_fluxo];
        const isLoading = loadingAction === fatura.id || loadingAction === fatura.cobranca?.id;

        return (
            <div
                key={fatura.id}
                className="bg-white dark:bg-slate-800 rounded-lg p-3 shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md transition"
            >
                {/* Cabecalho */}
                <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                            {fatura.beneficiario?.nome || 'Sem nome'}
                        </p>
                        <p className="text-xs text-slate-500">{fatura.uc_formatada}</p>
                    </div>
                    {fatura.tipo_gd && (
                        <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                            {fatura.tipo_gd}
                        </span>
                    )}
                </div>

                {/* Info Basica */}
                <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                    <p>Ref: {fatura.referencia_formatada}</p>
                    {fatura.valor_fatura && <p>Valor: {formatCurrency(fatura.valor_fatura)}</p>}
                    {fatura.cobranca && <p>Cobranca: {formatCurrency(fatura.cobranca.valor_total)}</p>}
                </div>

                {/* Dados Extraidos - Consumo e Energia */}
                {fatura.dados_extraidos && (
                    <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
                            {fatura.dados_extraidos.consumo_kwh != null && (
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Consumo:</span>
                                    <span className="font-medium text-slate-700 dark:text-slate-300">
                                        {fatura.dados_extraidos.consumo_kwh} kWh
                                    </span>
                                </div>
                            )}
                            {(fatura.dados_extraidos.injetada_kwh != null || fatura.dados_extraidos.injetada_ouc_kwh != null) && (
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Injetada:</span>
                                    <span className="font-medium text-green-600 dark:text-green-400">
                                        {fatura.dados_extraidos.injetada_kwh ?? fatura.dados_extraidos.injetada_ouc_kwh} kWh
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Bandeira Tarifaria */}
                        {(fatura.bandeira_tarifaria || fatura.dados_extraidos.bandeira_tarifaria) && (
                            <div className="mt-1 flex items-center gap-1">
                                <span className="text-xs text-slate-500">Bandeira:</span>
                                <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                                    (fatura.bandeira_tarifaria || fatura.dados_extraidos.bandeira_tarifaria)?.toUpperCase().includes('VERDE')
                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                        : (fatura.bandeira_tarifaria || fatura.dados_extraidos.bandeira_tarifaria)?.toUpperCase().includes('AMARELA')
                                            ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                }`}>
                                    {(fatura.bandeira_tarifaria || fatura.dados_extraidos.bandeira_tarifaria)}
                                </span>
                            </div>
                        )}

                        {/* Tipo Ligacao */}
                        {fatura.tipo_ligacao && (
                            <div className="mt-1 text-xs">
                                <span className="text-slate-500">Tipo: </span>
                                <span className="text-slate-700 dark:text-slate-300">{fatura.tipo_ligacao}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Score de Extracao */}
                {fatura.extracao_score !== undefined && fatura.extracao_score !== null && (
                    <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
                            <span>Score:</span>
                            <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div
                                    className={`h-full ${fatura.extracao_score >= 80 ? 'bg-green-500' : fatura.extracao_score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                    style={{ width: `${fatura.extracao_score}%` }}
                                />
                            </div>
                            <span>{fatura.extracao_score}%</span>
                        </div>
                    </div>
                )}

                {/* Acoes */}
                <div className="flex flex-wrap gap-1 mt-3">
                    {fatura.status_fluxo === 'PDF_RECEBIDO' && (
                        <button
                            onClick={() => handleExtrair(fatura.id)}
                            disabled={isLoading}
                            className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 flex items-center gap-1"
                        >
                            {isLoading ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                            Extrair
                        </button>
                    )}
                    {fatura.status_fluxo === 'EXTRAIDA' && (
                        <button
                            onClick={() => handleGerarCobranca(fatura)}
                            disabled={isLoading}
                            className="text-xs px-2 py-1 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50 flex items-center gap-1"
                        >
                            {isLoading ? <Loader2 size={12} className="animate-spin" /> : <FileEdit size={12} />}
                            Gerar
                        </button>
                    )}
                    {fatura.status_fluxo === 'COBRANCA_RASCUNHO' && fatura.cobranca && (
                        <button
                            onClick={() => handleAprovar(fatura.cobranca!.id)}
                            disabled={isLoading}
                            className="text-xs px-2 py-1 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50 flex items-center gap-1"
                        >
                            {isLoading ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                            Aprovar
                        </button>
                    )}
                    {fatura.status_fluxo === 'COBRANCA_EMITIDA' && fatura.cobranca && (
                        <>
                            <button
                                onClick={() => handleVerRelatorio(fatura.cobranca!.id)}
                                className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center gap-1"
                            >
                                <Eye size={12} />
                                Ver
                            </button>
                            {fatura.cobranca.qr_code_pix && (
                                <button
                                    onClick={() => handleCopiarPix(fatura.cobranca!.qr_code_pix!)}
                                    className="text-xs px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600 flex items-center gap-1"
                                >
                                    <Copy size={12} />
                                    PIX
                                </button>
                            )}
                        </>
                    )}
                    {(fatura.status_fluxo === 'COBRANCA_PAGA' || fatura.status_fluxo === 'FATURA_QUITADA') && fatura.cobranca && (
                        <button
                            onClick={() => handleVerRelatorio(fatura.cobranca!.id)}
                            className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center gap-1"
                        >
                            <Eye size={12} />
                            Ver
                        </button>
                    )}
                </div>
            </div>
        );
    };

    // Renderizar coluna do Kanban
    const renderKanbanColumn = (status: StatusFluxo, faturasList: FaturaGestao[], count: number) => {
        const config = STATUS_CONFIG[status];
        const Icon = config.icon;
        const isSelected = selectedStatus === status;

        return (
            <div
                key={status}
                ref={(el) => { kanbanRefs.current[status] = el; }}
                className={`flex-shrink-0 w-72 transition-all ${isSelected ? 'ring-2 ring-blue-500 rounded-lg' : ''}`}
            >
                {/* Header */}
                <div className={`${config.corBg} rounded-t-lg px-3 py-2 flex items-center gap-2`}>
                    <Icon size={16} className={config.cor} />
                    <span className={`text-sm font-medium ${config.cor}`}>{config.label}</span>
                    <span className={`ml-auto text-xs ${config.cor} bg-white dark:bg-slate-900 px-2 py-0.5 rounded-full`}>
                        {count}
                    </span>
                </div>

                {/* Cards */}
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-b-lg p-2 min-h-[200px] max-h-[calc(100vh-380px)] overflow-y-auto space-y-2">
                    {faturasList.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-4">Nenhuma fatura</p>
                    ) : (
                        faturasList.map(renderKanbanCard)
                    )}
                </div>
            </div>
        );
    };

    // Renderizar visualizacao Kanban
    const renderKanban = () => (
        <div className="overflow-x-auto pb-4">
            <div className="flex gap-4 min-w-max">
                {(Object.keys(STATUS_CONFIG) as StatusFluxo[]).map(status =>
                    renderKanbanColumn(status, faturasPorStatus[status], totais?.[
                        status === 'AGUARDANDO_PDF' ? 'aguardando_pdf' :
                        status === 'PDF_RECEBIDO' ? 'pdf_recebido' :
                        status === 'EXTRAIDA' ? 'extraida' :
                        status === 'COBRANCA_RASCUNHO' ? 'cobranca_rascunho' :
                        status === 'COBRANCA_EMITIDA' ? 'cobranca_emitida' :
                        status === 'COBRANCA_PAGA' ? 'cobranca_paga' : 'fatura_quitada'
                    ] || 0)
                )}
            </div>
        </div>
    );

    // Renderizar linha da Lista
    const renderListaRow = (fatura: FaturaGestao) => {
        const config = STATUS_CONFIG[fatura.status_fluxo];
        const Icon = config.icon;
        const isExpanded = expandedId === fatura.id;
        const isLoading = loadingAction === fatura.id || loadingAction === fatura.cobranca?.id;

        return (
            <React.Fragment key={fatura.id}>
                <tr
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : fatura.id)}
                >
                    <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                            {isExpanded ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
                            <div>
                                <p className="text-sm font-medium text-slate-900 dark:text-white">
                                    {fatura.beneficiario?.nome || 'Sem nome'}
                                </p>
                                <p className="text-xs text-slate-500">{fatura.uc_formatada}</p>
                            </div>
                        </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                        {fatura.referencia_formatada}
                    </td>
                    <td className="px-4 py-3">
                        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${config.corBg} ${config.cor}`}>
                            <Icon size={12} />
                            {config.label}
                        </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 dark:text-white">
                        {formatCurrency(fatura.cobranca?.valor_total || fatura.valor_fatura)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                        {fatura.cobranca?.vencimento ? new Date(fatura.cobranca.vencimento).toLocaleDateString('pt-BR') : '-'}
                    </td>
                    <td className="px-4 py-3">
                        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                            {fatura.status_fluxo === 'PDF_RECEBIDO' && (
                                <button
                                    onClick={() => handleExtrair(fatura.id)}
                                    disabled={isLoading}
                                    className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                                >
                                    {isLoading ? <Loader2 size={12} className="animate-spin" /> : 'Extrair'}
                                </button>
                            )}
                            {fatura.status_fluxo === 'EXTRAIDA' && (
                                <button
                                    onClick={() => handleGerarCobranca(fatura)}
                                    disabled={isLoading}
                                    className="text-xs px-2 py-1 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
                                >
                                    {isLoading ? <Loader2 size={12} className="animate-spin" /> : 'Gerar'}
                                </button>
                            )}
                            {fatura.status_fluxo === 'COBRANCA_RASCUNHO' && fatura.cobranca && (
                                <button
                                    onClick={() => handleAprovar(fatura.cobranca!.id)}
                                    disabled={isLoading}
                                    className="text-xs px-2 py-1 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50"
                                >
                                    {isLoading ? <Loader2 size={12} className="animate-spin" /> : 'Aprovar'}
                                </button>
                            )}
                            {fatura.cobranca?.qr_code_pix && (
                                <button
                                    onClick={() => handleCopiarPix(fatura.cobranca!.qr_code_pix!)}
                                    className="text-xs px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                                >
                                    PIX
                                </button>
                            )}
                            {fatura.cobranca && (
                                <button
                                    onClick={() => handleVerRelatorio(fatura.cobranca!.id)}
                                    className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-600"
                                >
                                    Ver
                                </button>
                            )}
                        </div>
                    </td>
                </tr>
                {isExpanded && (
                    <tr>
                        <td colSpan={6} className="px-4 py-4 bg-slate-50 dark:bg-slate-800/50">
                            <div className="space-y-4">
                                {/* Secao 1: Beneficiario e UC (sempre visivel) */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                                        <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-2">Beneficiario</h4>
                                        <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                                            <p><span className="text-slate-500">Nome:</span> {fatura.beneficiario?.nome || '-'}</p>
                                            <p><span className="text-slate-500">CPF:</span> {fatura.beneficiario?.cpf || '-'}</p>
                                            <p><span className="text-slate-500">Email:</span> {fatura.beneficiario?.email || '-'}</p>
                                            <p><span className="text-slate-500">Usina:</span> {fatura.usina?.nome || '-'}</p>
                                        </div>
                                    </div>
                                    <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                                        <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-2">Unidade Consumidora</h4>
                                        <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                                            <p><span className="text-slate-500">UC:</span> {fatura.uc_formatada}</p>
                                            <p><span className="text-slate-500">Referencia:</span> {fatura.referencia_formatada}</p>
                                            <p><span className="text-slate-500">Tipo Ligacao:</span> {fatura.tipo_ligacao || '-'}</p>
                                            <p><span className="text-slate-500">Tipo GD:</span> {fatura.tipo_gd || '-'}</p>
                                            <p><span className="text-slate-500">PDF:</span> {fatura.tem_pdf ? <span className="text-green-600">Disponivel</span> : <span className="text-red-500">Aguardando</span>}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Secao 2: Dados Extraidos (a partir de EXTRAIDA) */}
                                {['EXTRAIDA', 'COBRANCA_RASCUNHO', 'COBRANCA_EMITIDA', 'COBRANCA_PAGA', 'FATURA_QUITADA'].includes(fatura.status_fluxo) && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                                            <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-2">Dados Extraidos</h4>
                                            <div className="text-xs space-y-2">
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <span className="text-slate-500">Consumo:</span>
                                                        <span className="ml-1 font-medium text-slate-900 dark:text-white">
                                                            {fatura.dados_extraidos?.consumo_kwh ?? '-'} kWh
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-500">Valor Fatura:</span>
                                                        <span className="ml-1 font-medium text-slate-900 dark:text-white">
                                                            {formatCurrency(fatura.valor_fatura)}
                                                        </span>
                                                    </div>
                                                </div>
                                                {(fatura.dados_extraidos?.injetada_kwh || fatura.dados_extraidos?.injetada_ouc_kwh) && (
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div>
                                                            <span className="text-slate-500">Injetada oUC:</span>
                                                            <span className="ml-1 font-medium text-green-600">
                                                                {fatura.dados_extraidos?.injetada_ouc_kwh ?? fatura.dados_extraidos?.injetada_kwh ?? '-'} kWh
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="text-slate-500">Injetada mUC:</span>
                                                            <span className="ml-1 font-medium text-green-600">
                                                                {fatura.dados_extraidos?.injetada_muc_kwh ?? '-'} kWh
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-4">
                                                    <div>
                                                        <span className="text-slate-500">Bandeira:</span>
                                                        <span className={`ml-1 px-2 py-0.5 rounded text-xs font-medium ${
                                                            (fatura.bandeira_tarifaria || fatura.dados_extraidos?.bandeira_tarifaria)?.toUpperCase().includes('VERDE')
                                                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                                : (fatura.bandeira_tarifaria || fatura.dados_extraidos?.bandeira_tarifaria)?.toUpperCase().includes('AMARELA')
                                                                    ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                                                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                        }`}>
                                                            {fatura.bandeira_tarifaria || fatura.dados_extraidos?.bandeira_tarifaria || '-'}
                                                        </span>
                                                    </div>
                                                    {fatura.extracao_score !== undefined && (
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-slate-500">Score:</span>
                                                            <div className="w-20 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                                <div
                                                                    className={`h-full ${fatura.extracao_score >= 80 ? 'bg-green-500' : fatura.extracao_score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                                                    style={{ width: `${fatura.extracao_score}%` }}
                                                                />
                                                            </div>
                                                            <span className="font-medium">{fatura.extracao_score}%</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Comparacao API vs PDF */}
                                        {fatura.dados_api && (
                                            <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                                                <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-2">Comparacao API vs PDF</h4>
                                                <div className="text-xs space-y-1">
                                                    <div className="grid grid-cols-3 gap-1 font-medium text-slate-500 border-b pb-1">
                                                        <span>Campo</span>
                                                        <span>API</span>
                                                        <span>PDF</span>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-1">
                                                        <span className="text-slate-500">Consumo</span>
                                                        <span>{fatura.dados_api?.consumo ?? '-'}</span>
                                                        <span>{fatura.dados_extraidos?.consumo_kwh ?? '-'}</span>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-1">
                                                        <span className="text-slate-500">Valor</span>
                                                        <span>{formatCurrency(fatura.dados_api?.valor_fatura)}</span>
                                                        <span>{formatCurrency(fatura.valor_fatura)}</span>
                                                    </div>
                                                    {fatura.dados_api?.leitura_anterior && (
                                                        <div className="grid grid-cols-3 gap-1">
                                                            <span className="text-slate-500">Leit. Anterior</span>
                                                            <span>{fatura.dados_api?.leitura_anterior ?? '-'}</span>
                                                            <span>-</span>
                                                        </div>
                                                    )}
                                                    {fatura.dados_api?.leitura_atual && (
                                                        <div className="grid grid-cols-3 gap-1">
                                                            <span className="text-slate-500">Leit. Atual</span>
                                                            <span>{fatura.dados_api?.leitura_atual ?? '-'}</span>
                                                            <span>-</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Secao 3: Cobranca (a partir de COBRANCA_RASCUNHO) */}
                                {['COBRANCA_RASCUNHO', 'COBRANCA_EMITIDA', 'COBRANCA_PAGA', 'FATURA_QUITADA'].includes(fatura.status_fluxo) && fatura.cobranca && (
                                    <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                                        <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-2">Cobranca</h4>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                            <div>
                                                <span className="text-slate-500">Status:</span>
                                                <span className={`ml-1 px-2 py-0.5 rounded font-medium ${
                                                    fatura.cobranca.status === 'PAGA' ? 'bg-green-100 text-green-700' :
                                                    fatura.cobranca.status === 'EMITIDA' ? 'bg-orange-100 text-orange-700' :
                                                    'bg-purple-100 text-purple-700'
                                                }`}>
                                                    {fatura.cobranca.status}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-slate-500">Valor:</span>
                                                <span className="ml-1 font-medium text-slate-900 dark:text-white">
                                                    {formatCurrency(fatura.cobranca.valor_total)}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-slate-500">Vencimento:</span>
                                                <span className="ml-1 font-medium text-slate-900 dark:text-white">
                                                    {new Date(fatura.cobranca.vencimento).toLocaleDateString('pt-BR')}
                                                </span>
                                            </div>
                                            {fatura.cobranca.pago_em && (
                                                <div>
                                                    <span className="text-slate-500">Pago em:</span>
                                                    <span className="ml-1 font-medium text-green-600">
                                                        {new Date(fatura.cobranca.pago_em).toLocaleDateString('pt-BR')}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        {fatura.cobranca.qr_code_pix && (
                                            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                                                <button
                                                    onClick={() => handleCopiarPix(fatura.cobranca!.qr_code_pix!)}
                                                    className="text-xs px-3 py-1.5 bg-green-500 text-white rounded hover:bg-green-600 flex items-center gap-1"
                                                >
                                                    <Copy size={12} />
                                                    Copiar Codigo PIX
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Secao 4: Acoes Expandidas */}
                                <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                                    {/* Refazer - disponivel em PDF_RECEBIDO, EXTRAIDA, COBRANCA_RASCUNHO */}
                                    {['PDF_RECEBIDO', 'EXTRAIDA', 'COBRANCA_RASCUNHO'].includes(fatura.status_fluxo) && (
                                        <button
                                            onClick={() => handleRefazer(fatura.id)}
                                            disabled={isLoading}
                                            className="text-xs px-3 py-1.5 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-50 flex items-center gap-1"
                                        >
                                            {isLoading ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                                            Refazer
                                        </button>
                                    )}

                                    {/* Reprocessar - disponivel em EXTRAIDA, COBRANCA_RASCUNHO */}
                                    {['EXTRAIDA', 'COBRANCA_RASCUNHO'].includes(fatura.status_fluxo) && (
                                        <button
                                            onClick={() => handleReprocessar(fatura.id)}
                                            disabled={isLoading}
                                            className="text-xs px-3 py-1.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded hover:bg-amber-200 dark:hover:bg-amber-900/50 disabled:opacity-50 flex items-center gap-1"
                                        >
                                            {isLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCcw size={12} />}
                                            Reprocessar Extracao
                                        </button>
                                    )}

                                    {/* Ver Relatorio - quando tem cobranca */}
                                    {fatura.cobranca && (
                                        <button
                                            onClick={() => handleVerRelatorio(fatura.cobranca!.id)}
                                            className="text-xs px-3 py-1.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 flex items-center gap-1"
                                        >
                                            <Eye size={12} />
                                            Ver Relatorio
                                        </button>
                                    )}
                                </div>
                            </div>
                        </td>
                    </tr>
                )}
            </React.Fragment>
        );
    };

    // Renderizar visualizacao Lista
    const renderLista = () => (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-900/50">
                    <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Beneficiario</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Referencia</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Valor</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Vencimento</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Acoes</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {faturasFiltradas.length === 0 ? (
                        <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                                {selectedStatus ? `Nenhuma fatura em "${STATUS_CONFIG[selectedStatus].label}"` : 'Nenhuma fatura encontrada'}
                            </td>
                        </tr>
                    ) : (
                        faturasFiltradas.map(renderListaRow)
                    )}
                </tbody>
            </table>
        </div>
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 size={32} className="animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                    Gestao de Faturas
                </h1>

                <div className="flex items-center gap-2">
                    {/* Toggle View */}
                    <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                        <button
                            onClick={() => setViewMode('kanban')}
                            className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 transition ${
                                viewMode === 'kanban'
                                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            <LayoutGrid size={16} />
                            Kanban
                        </button>
                        <button
                            onClick={() => setViewMode('lista')}
                            className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 transition ${
                                viewMode === 'lista'
                                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            <List size={16} />
                            Lista
                        </button>
                    </div>

                    {/* Atualizar */}
                    <button
                        onClick={carregarFaturas}
                        disabled={refreshing}
                        className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 disabled:opacity-50"
                    >
                        <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Filtros */}
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
                    {/* Usina */}
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Usina</label>
                        <select
                            value={filtroUsina}
                            onChange={(e) => setFiltroUsina(e.target.value ? Number(e.target.value) : '')}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="">Todas</option>
                            {usinas.map(u => (
                                <option key={u.id} value={u.id}>{u.nome}</option>
                            ))}
                        </select>
                    </div>

                    {/* Mes */}
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Mes</label>
                        <select
                            value={filtroMes}
                            onChange={(e) => setFiltroMes(e.target.value ? Number(e.target.value) : '')}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            {MESES.map(m => (
                                <option key={String(m.value)} value={m.value}>{m.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Ano */}
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Ano</label>
                        <select
                            value={filtroAno}
                            onChange={(e) => setFiltroAno(Number(e.target.value))}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            {anosDisponiveis.map(a => (
                                <option key={a} value={a}>{a}</option>
                            ))}
                        </select>
                    </div>

                    {/* Busca */}
                    <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-slate-500 mb-1">Buscar</label>
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={filtroBusca}
                                onChange={(e) => setFiltroBusca(e.target.value)}
                                placeholder="Nome ou UC..."
                                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Cards de Estatisticas - Clicaveis */}
            {totais && (
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                    {(Object.keys(STATUS_CONFIG) as StatusFluxo[]).map(status => {
                        const config = STATUS_CONFIG[status];
                        const Icon = config.icon;
                        const count = totais[
                            status === 'AGUARDANDO_PDF' ? 'aguardando_pdf' :
                            status === 'PDF_RECEBIDO' ? 'pdf_recebido' :
                            status === 'EXTRAIDA' ? 'extraida' :
                            status === 'COBRANCA_RASCUNHO' ? 'cobranca_rascunho' :
                            status === 'COBRANCA_EMITIDA' ? 'cobranca_emitida' :
                            status === 'COBRANCA_PAGA' ? 'cobranca_paga' : 'fatura_quitada'
                        ];
                        const isSelected = selectedStatus === status;

                        return (
                            <div
                                key={status}
                                onClick={() => handleStatusClick(status)}
                                className={`${config.corBg} rounded-lg p-3 border-2 cursor-pointer transition-all hover:shadow-md ${
                                    isSelected
                                        ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800'
                                        : 'border-slate-200 dark:border-slate-700'
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    <Icon size={16} className={config.cor} />
                                    <span className={`text-lg font-bold ${config.cor}`}>{count}</span>
                                </div>
                                <p className={`text-xs ${config.cor} mt-1`}>{config.label}</p>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Indicador de filtro ativo */}
            {selectedStatus && (
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <span>Filtrando por: <strong className="text-slate-900 dark:text-white">{STATUS_CONFIG[selectedStatus].label}</strong></span>
                    <button
                        onClick={() => setSelectedStatus(null)}
                        className="text-blue-500 hover:text-blue-700 underline"
                    >
                        Limpar filtro
                    </button>
                </div>
            )}

            {/* Conteudo */}
            {viewMode === 'kanban' ? renderKanban() : renderLista()}

            {/* Modal Preview HTML */}
            {previewHtml && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                Preview do Relatorio
                            </h2>
                            <button
                                onClick={() => setPreviewHtml(null)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-2xl"
                            >
                                &times;
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-4">
                            <iframe
                                srcDoc={previewHtml}
                                className="w-full h-full min-h-[600px] border rounded-lg"
                                title="Preview do Relatorio"
                            />
                        </div>
                        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2 shrink-0">
                            <button
                                onClick={() => {
                                    const blob = new Blob([previewHtml], { type: 'text/html' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = 'relatorio-cobranca.html';
                                    a.click();
                                    URL.revokeObjectURL(url);
                                }}
                                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                            >
                                Baixar HTML
                            </button>
                            <button
                                onClick={() => setPreviewHtml(null)}
                                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
