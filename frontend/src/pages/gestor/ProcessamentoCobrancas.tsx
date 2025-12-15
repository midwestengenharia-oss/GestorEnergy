/**
 * ProcessamentoCobrancas - Interface integrada para processamento de faturas e cobrancas
 * Visualizacao completa do fluxo: Fatura -> Extracao -> Cobranca -> Relatorio
 */

import { useState, useEffect } from 'react';
import {
    FileText,
    Loader2,
    ChevronDown,
    ChevronRight,
    CheckCircle2,
    AlertCircle,
    Clock,
    Zap,
    DollarSign,
    Calendar,
    User,
    MapPin,
    Eye,
    RefreshCw,
    FileCheck,
    Send,
    Edit3,
    X,
    Filter,
    BarChart3,
    Receipt,
    Sparkles
} from 'lucide-react';
import { faturasApi } from '../../api/faturas';
import { cobrancasApi, type Cobranca } from '../../api/cobrancas';

// ========================
// Types
// ========================

interface FaturaKanban {
    id: number;
    numero_fatura: number;
    mes_referencia: number;
    ano_referencia: number;
    valor_fatura: number;
    data_vencimento: string;
    extracao_status: string;
    extracao_score: number | null;
    pdf_base64: string | null;
    dados_extraidos: any;
    uc: {
        id: number;
        codigo: string;
        endereco: string;
    };
    beneficiario: {
        id: number;
        nome: string;
    } | null;
    cobranca: {
        id: number;
        status: string;
        valor_final: number;
        economia_mes: number;
    } | null;
}

interface KanbanData {
    sem_pdf: FaturaKanban[];
    pdf_recebido: FaturaKanban[];
    extraida: FaturaKanban[];
    relatorio_gerado: FaturaKanban[];
    totais: {
        sem_pdf: number;
        pdf_recebido: number;
        extraida: number;
        relatorio_gerado: number;
    };
}

interface DadosExtraidos {
    codigo_cliente?: string;
    ligacao?: string;
    mes_ano_referencia?: string;
    vencimento?: string;
    total_a_pagar?: number;
    leitura_anterior?: number;
    leitura_atual?: number;
    dias?: number;
    itens_fatura?: {
        consumo_kwh?: {
            quantidade?: number;
            preco_unit_com_tributos?: number;
            valor_total?: number;
        };
        energia_injetada_ouc?: Array<{
            quantidade?: number;
            preco_unit_com_tributos?: number;
            valor_total?: number;
        }>;
        energia_injetada_muc?: Array<{
            quantidade?: number;
            valor_total?: number;
        }>;
    };
    totais?: {
        adicionais_bandeira?: number;
        lancamentos_e_servicos?: number;
        total_geral_fatura?: number;
    };
    bandeira_tarifaria?: string;
}

// ========================
// Configuracoes
// ========================

const STATUS_CONFIG = {
    sem_pdf: { label: 'Aguardando PDF', color: 'bg-slate-500', icon: FileText },
    pdf_recebido: { label: 'Aguardando Extracao', color: 'bg-yellow-500', icon: Clock },
    extraida: { label: 'Pronta p/ Cobranca', color: 'bg-blue-500', icon: Sparkles },
    relatorio_gerado: { label: 'Cobranca Gerada', color: 'bg-green-500', icon: CheckCircle2 },
};

const COBRANCA_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    RASCUNHO: { label: 'Rascunho', color: 'bg-slate-500' },
    PENDENTE: { label: 'Pendente', color: 'bg-yellow-500' },
    EMITIDA: { label: 'Emitida', color: 'bg-blue-500' },
    PAGA: { label: 'Paga', color: 'bg-green-500' },
    VENCIDA: { label: 'Vencida', color: 'bg-red-500' },
    CANCELADA: { label: 'Cancelada', color: 'bg-slate-400' },
};

// ========================
// Componente Principal
// ========================

export function ProcessamentoCobrancas() {
    const [kanbanData, setKanbanData] = useState<KanbanData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filtros
    const [activeTab, setActiveTab] = useState<'pdf_recebido' | 'extraida' | 'relatorio_gerado'>('extraida');
    const [filterMes, setFilterMes] = useState<number>(new Date().getMonth() + 1);
    const [filterAno, setFilterAno] = useState<number>(new Date().getFullYear());

    // Accordion
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [loadingAction, setLoadingAction] = useState<number | null>(null);

    // Preview HTML
    const [previewHtml, setPreviewHtml] = useState<string | null>(null);
    const [previewCobrancaId, setPreviewCobrancaId] = useState<number | null>(null);

    // ========================
    // Fetch Data
    // ========================

    const fetchKanban = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await faturasApi.kanban({
                mes_referencia: filterMes,
                ano_referencia: filterAno
            });

            setKanbanData(response.data);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Erro ao carregar dados');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchKanban();
    }, [filterMes, filterAno]);

    // ========================
    // Actions
    // ========================

    const handleExtrair = async (faturaId: number) => {
        try {
            setLoadingAction(faturaId);
            await faturasApi.extrair(faturaId);
            await fetchKanban();
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Erro ao extrair dados');
        } finally {
            setLoadingAction(null);
        }
    };

    const handleGerarCobranca = async (fatura: FaturaKanban) => {
        if (!fatura.beneficiario) {
            alert('Esta fatura nao tem beneficiario vinculado');
            return;
        }

        try {
            setLoadingAction(fatura.id);
            await cobrancasApi.gerarAutomatica(fatura.id, fatura.beneficiario.id);
            await fetchKanban();
            setExpandedId(null);
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Erro ao gerar cobranca');
        } finally {
            setLoadingAction(null);
        }
    };

    const handleAprovar = async (cobrancaId: number, enviarEmail: boolean = false) => {
        try {
            setLoadingAction(cobrancaId);
            await cobrancasApi.aprovar(cobrancaId, enviarEmail);
            await fetchKanban();
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Erro ao aprovar cobranca');
        } finally {
            setLoadingAction(null);
        }
    };

    const handleVerRelatorio = async (cobrancaId: number) => {
        try {
            setLoadingAction(cobrancaId);
            const response = await cobrancasApi.obterRelatorioHTML(cobrancaId);
            // API retorna HTML como string diretamente
            setPreviewHtml(typeof response.data === 'string' ? response.data : response.data.html_relatorio);
            setPreviewCobrancaId(cobrancaId);
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Erro ao carregar relatorio');
        } finally {
            setLoadingAction(null);
        }
    };

    // ========================
    // Helpers
    // ========================

    const formatarMoeda = (valor: number | null | undefined) => {
        if (valor === null || valor === undefined) return 'R$ 0,00';
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
    };

    const formatarData = (dataStr: string | null) => {
        if (!dataStr) return '-';
        return new Date(dataStr).toLocaleDateString('pt-BR');
    };

    const getMesNome = (mes: number) => {
        const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        return meses[mes - 1] || '';
    };

    const getCurrentList = (): FaturaKanban[] => {
        if (!kanbanData) return [];
        return kanbanData[activeTab] || [];
    };

    const calcularInjetadaTotal = (dados: DadosExtraidos): number => {
        let total = 0;
        if (dados.itens_fatura?.energia_injetada_ouc) {
            total += dados.itens_fatura.energia_injetada_ouc.reduce((sum, item) => sum + (item.quantidade || 0), 0);
        }
        if (dados.itens_fatura?.energia_injetada_muc) {
            total += dados.itens_fatura.energia_injetada_muc.reduce((sum, item) => sum + (item.quantidade || 0), 0);
        }
        return total;
    };

    const detectarModeloGD = (dados: DadosExtraidos): string => {
        if (dados.itens_fatura?.energia_injetada_muc && dados.itens_fatura.energia_injetada_muc.length > 0) {
            return 'GD II';
        }
        return 'GD I';
    };

    // ========================
    // Render
    // ========================

    if (loading && !kanbanData) {
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
                        Processamento de Cobrancas
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        Gerencie faturas e gere cobrancas de forma interativa
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Filtro Mes/Ano */}
                    <div className="flex items-center gap-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
                        <Calendar size={18} className="text-slate-400" />
                        <select
                            value={filterMes}
                            onChange={(e) => setFilterMes(parseInt(e.target.value))}
                            className="bg-transparent text-slate-900 dark:text-white text-sm focus:outline-none"
                        >
                            {Array.from({ length: 12 }, (_, i) => (
                                <option key={i + 1} value={i + 1}>{getMesNome(i + 1)}</option>
                            ))}
                        </select>
                        <select
                            value={filterAno}
                            onChange={(e) => setFilterAno(parseInt(e.target.value))}
                            className="bg-transparent text-slate-900 dark:text-white text-sm focus:outline-none"
                        >
                            {[2024, 2025, 2026].map(ano => (
                                <option key={ano} value={ano}>{ano}</option>
                            ))}
                        </select>
                    </div>
                    <button
                        onClick={fetchKanban}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition"
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                        Atualizar
                    </button>
                </div>
            </div>

            {/* Cards de Estatisticas */}
            {kanbanData && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Aguardando PDF</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">{kanbanData.totais.sem_pdf}</p>
                            </div>
                            <div className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center">
                                <FileText className="text-slate-500" size={20} />
                            </div>
                        </div>
                    </div>

                    <div
                        className={`bg-white dark:bg-slate-800 rounded-xl p-4 border-2 cursor-pointer transition ${
                            activeTab === 'pdf_recebido' ? 'border-yellow-500' : 'border-slate-200 dark:border-slate-700'
                        }`}
                        onClick={() => setActiveTab('pdf_recebido')}
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Aguardando Extracao</p>
                                <p className="text-2xl font-bold text-yellow-600">{kanbanData.totais.pdf_recebido}</p>
                            </div>
                            <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center">
                                <Clock className="text-yellow-600" size={20} />
                            </div>
                        </div>
                    </div>

                    <div
                        className={`bg-white dark:bg-slate-800 rounded-xl p-4 border-2 cursor-pointer transition ${
                            activeTab === 'extraida' ? 'border-blue-500' : 'border-slate-200 dark:border-slate-700'
                        }`}
                        onClick={() => setActiveTab('extraida')}
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Prontas p/ Cobranca</p>
                                <p className="text-2xl font-bold text-blue-600">{kanbanData.totais.extraida}</p>
                            </div>
                            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                                <Sparkles className="text-blue-600" size={20} />
                            </div>
                        </div>
                    </div>

                    <div
                        className={`bg-white dark:bg-slate-800 rounded-xl p-4 border-2 cursor-pointer transition ${
                            activeTab === 'relatorio_gerado' ? 'border-green-500' : 'border-slate-200 dark:border-slate-700'
                        }`}
                        onClick={() => setActiveTab('relatorio_gerado')}
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Cobrancas Geradas</p>
                                <p className="text-2xl font-bold text-green-600">{kanbanData.totais.relatorio_gerado}</p>
                            </div>
                            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                                <CheckCircle2 className="text-green-600" size={20} />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg text-red-600 dark:text-red-400 flex items-center gap-2">
                    <AlertCircle size={20} />
                    {error}
                </div>
            )}

            {/* Tab Header */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="flex border-b border-slate-200 dark:border-slate-700">
                    <button
                        onClick={() => setActiveTab('pdf_recebido')}
                        className={`flex-1 px-4 py-3 text-sm font-medium transition ${
                            activeTab === 'pdf_recebido'
                                ? 'text-yellow-600 border-b-2 border-yellow-500 bg-yellow-50 dark:bg-yellow-900/10'
                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                    >
                        <Clock size={16} className="inline mr-2" />
                        Aguardando Extracao ({kanbanData?.totais.pdf_recebido || 0})
                    </button>
                    <button
                        onClick={() => setActiveTab('extraida')}
                        className={`flex-1 px-4 py-3 text-sm font-medium transition ${
                            activeTab === 'extraida'
                                ? 'text-blue-600 border-b-2 border-blue-500 bg-blue-50 dark:bg-blue-900/10'
                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                    >
                        <Sparkles size={16} className="inline mr-2" />
                        Prontas p/ Cobranca ({kanbanData?.totais.extraida || 0})
                    </button>
                    <button
                        onClick={() => setActiveTab('relatorio_gerado')}
                        className={`flex-1 px-4 py-3 text-sm font-medium transition ${
                            activeTab === 'relatorio_gerado'
                                ? 'text-green-600 border-b-2 border-green-500 bg-green-50 dark:bg-green-900/10'
                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                    >
                        <CheckCircle2 size={16} className="inline mr-2" />
                        Cobrancas Geradas ({kanbanData?.totais.relatorio_gerado || 0})
                    </button>
                </div>

                {/* Lista de Faturas */}
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    {getCurrentList().length === 0 ? (
                        <div className="p-8 text-center text-slate-500">
                            Nenhuma fatura nesta etapa para {getMesNome(filterMes)}/{filterAno}
                        </div>
                    ) : (
                        getCurrentList().map((fatura) => (
                            <FaturaAccordionItem
                                key={fatura.id}
                                fatura={fatura}
                                isExpanded={expandedId === fatura.id}
                                onToggle={() => setExpandedId(expandedId === fatura.id ? null : fatura.id)}
                                activeTab={activeTab}
                                loadingAction={loadingAction}
                                onExtrair={handleExtrair}
                                onGerarCobranca={handleGerarCobranca}
                                onAprovar={handleAprovar}
                                onVerRelatorio={handleVerRelatorio}
                                formatarMoeda={formatarMoeda}
                                formatarData={formatarData}
                                calcularInjetadaTotal={calcularInjetadaTotal}
                                detectarModeloGD={detectarModeloGD}
                            />
                        ))
                    )}
                </div>
            </div>

            {/* Modal Preview Relatorio */}
            {previewHtml && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                                Preview do Relatorio
                            </h3>
                            <div className="flex items-center gap-2">
                                {previewCobrancaId && (
                                    <button
                                        onClick={() => handleAprovar(previewCobrancaId, true)}
                                        disabled={loadingAction === previewCobrancaId}
                                        className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center gap-2"
                                    >
                                        <Send size={16} />
                                        Aprovar e Enviar Email
                                    </button>
                                )}
                                <button
                                    onClick={() => { setPreviewHtml(null); setPreviewCobrancaId(null); }}
                                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto p-4">
                            <iframe
                                srcDoc={previewHtml}
                                className="w-full h-full min-h-[600px] border border-slate-200 dark:border-slate-700 rounded-lg"
                                title="Preview Relatorio"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ========================
// Subcomponente: Accordion Item
// ========================

interface FaturaAccordionItemProps {
    fatura: FaturaKanban;
    isExpanded: boolean;
    onToggle: () => void;
    activeTab: string;
    loadingAction: number | null;
    onExtrair: (id: number) => void;
    onGerarCobranca: (fatura: FaturaKanban) => void;
    onAprovar: (cobrancaId: number, enviarEmail: boolean) => void;
    onVerRelatorio: (cobrancaId: number) => void;
    formatarMoeda: (valor: number | null | undefined) => string;
    formatarData: (data: string | null) => string;
    calcularInjetadaTotal: (dados: DadosExtraidos) => number;
    detectarModeloGD: (dados: DadosExtraidos) => string;
}

function FaturaAccordionItem({
    fatura,
    isExpanded,
    onToggle,
    activeTab,
    loadingAction,
    onExtrair,
    onGerarCobranca,
    onAprovar,
    onVerRelatorio,
    formatarMoeda,
    formatarData,
    calcularInjetadaTotal,
    detectarModeloGD
}: FaturaAccordionItemProps) {
    const dados = fatura.dados_extraidos as DadosExtraidos;
    const isLoading = loadingAction === fatura.id || loadingAction === fatura.cobranca?.id;

    return (
        <div className={`${isExpanded ? 'bg-slate-50 dark:bg-slate-900/50' : ''}`}>
            {/* Header do Accordion */}
            <div
                onClick={onToggle}
                className="flex items-center gap-4 p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/30 transition"
            >
                <div className="text-slate-400">
                    {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                </div>

                {/* Info UC */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900 dark:text-white">
                            UC {fatura.uc?.codigo || '-'}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            {fatura.mes_referencia?.toString().padStart(2, '0')}/{fatura.ano_referencia}
                        </span>
                        {fatura.extracao_score && (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                                fatura.extracao_score >= 90 ? 'bg-green-100 text-green-700' :
                                fatura.extracao_score >= 70 ? 'bg-yellow-100 text-yellow-700' :
                                'bg-red-100 text-red-700'
                            }`}>
                                Score: {fatura.extracao_score}%
                            </span>
                        )}
                    </div>
                    {fatura.beneficiario && (
                        <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                            <User size={12} className="inline mr-1" />
                            {fatura.beneficiario.nome}
                        </p>
                    )}
                </div>

                {/* Valor Fatura */}
                <div className="text-right">
                    <p className="font-semibold text-slate-900 dark:text-white">
                        {formatarMoeda(fatura.valor_fatura)}
                    </p>
                    <p className="text-xs text-slate-500">Venc: {formatarData(fatura.data_vencimento)}</p>
                </div>

                {/* Status Cobranca */}
                {fatura.cobranca && (
                    <div className="text-right">
                        <span className={`text-xs px-2 py-1 rounded-full text-white ${
                            COBRANCA_STATUS_CONFIG[fatura.cobranca.status]?.color || 'bg-slate-500'
                        }`}>
                            {COBRANCA_STATUS_CONFIG[fatura.cobranca.status]?.label || fatura.cobranca.status}
                        </span>
                        {fatura.cobranca.economia_mes > 0 && (
                            <p className="text-xs text-green-600 mt-1">
                                Economia: {formatarMoeda(fatura.cobranca.economia_mes)}
                            </p>
                        )}
                    </div>
                )}

                {/* Botao Acao Rapida */}
                <div onClick={(e) => e.stopPropagation()}>
                    {activeTab === 'pdf_recebido' && (
                        <button
                            onClick={() => onExtrair(fatura.id)}
                            disabled={isLoading}
                            className="px-3 py-1.5 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 text-sm flex items-center gap-1"
                        >
                            {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                            Extrair
                        </button>
                    )}
                    {activeTab === 'extraida' && (
                        <button
                            onClick={() => onGerarCobranca(fatura)}
                            disabled={isLoading || !fatura.beneficiario}
                            className="px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 text-sm flex items-center gap-1"
                        >
                            {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Receipt size={14} />}
                            Gerar Cobranca
                        </button>
                    )}
                    {activeTab === 'relatorio_gerado' && fatura.cobranca && (
                        <button
                            onClick={() => onVerRelatorio(fatura.cobranca!.id)}
                            disabled={isLoading}
                            className="px-3 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 text-sm flex items-center gap-1"
                        >
                            {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
                            Ver Relatorio
                        </button>
                    )}
                </div>
            </div>

            {/* Conteudo Expandido */}
            {isExpanded && (
                <div className="px-4 pb-4 ml-10">
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                        {/* Dados Extraidos */}
                        {dados && (
                            <div className="space-y-4">
                                <h4 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                    <BarChart3 size={18} />
                                    Dados Extraidos da Fatura
                                </h4>

                                {/* Grid de informacoes */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3">
                                        <p className="text-xs text-slate-500 mb-1">Modelo GD</p>
                                        <p className="font-semibold text-slate-900 dark:text-white">
                                            {detectarModeloGD(dados)}
                                        </p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3">
                                        <p className="text-xs text-slate-500 mb-1">Tipo Ligacao</p>
                                        <p className="font-semibold text-slate-900 dark:text-white">
                                            {dados.ligacao || '-'}
                                        </p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3">
                                        <p className="text-xs text-slate-500 mb-1">Consumo (kWh)</p>
                                        <p className="font-semibold text-slate-900 dark:text-white">
                                            {dados.itens_fatura?.consumo_kwh?.quantidade || 0}
                                        </p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3">
                                        <p className="text-xs text-slate-500 mb-1">Injetada Total (kWh)</p>
                                        <p className="font-semibold text-blue-600">
                                            {calcularInjetadaTotal(dados)}
                                        </p>
                                    </div>
                                </div>

                                {/* Detalhes de Energia */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Consumo */}
                                    <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                                        <h5 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                            Consumo
                                        </h5>
                                        <div className="space-y-1 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Quantidade:</span>
                                                <span className="font-medium">{dados.itens_fatura?.consumo_kwh?.quantidade || 0} kWh</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Tarifa c/ tributos:</span>
                                                <span className="font-medium">
                                                    R$ {(dados.itens_fatura?.consumo_kwh?.preco_unit_com_tributos || 0).toFixed(6)}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Valor:</span>
                                                <span className="font-medium">
                                                    {formatarMoeda(dados.itens_fatura?.consumo_kwh?.valor_total)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Energia Injetada */}
                                    <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                                        <h5 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                            Energia Injetada
                                        </h5>
                                        <div className="space-y-1 text-sm">
                                            {dados.itens_fatura?.energia_injetada_ouc?.map((item, idx) => (
                                                <div key={`ouc-${idx}`} className="flex justify-between">
                                                    <span className="text-slate-500">oUC #{idx + 1}:</span>
                                                    <span className="font-medium text-green-600">
                                                        {item.quantidade} kWh ({formatarMoeda(item.valor_total)})
                                                    </span>
                                                </div>
                                            ))}
                                            {dados.itens_fatura?.energia_injetada_muc?.map((item, idx) => (
                                                <div key={`muc-${idx}`} className="flex justify-between">
                                                    <span className="text-slate-500">mUC #{idx + 1}:</span>
                                                    <span className="font-medium text-blue-600">
                                                        {item.quantidade} kWh ({formatarMoeda(item.valor_total)})
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Totalizadores */}
                                <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                                    <h5 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Totalizadores
                                    </h5>
                                    <div className="grid grid-cols-3 gap-4 text-sm">
                                        <div>
                                            <span className="text-slate-500">Bandeira:</span>
                                            <p className="font-medium">{formatarMoeda(dados.totais?.adicionais_bandeira)}</p>
                                        </div>
                                        <div>
                                            <span className="text-slate-500">Servicos:</span>
                                            <p className="font-medium">{formatarMoeda(dados.totais?.lancamentos_e_servicos)}</p>
                                        </div>
                                        <div>
                                            <span className="text-slate-500">Total Fatura:</span>
                                            <p className="font-bold text-lg">{formatarMoeda(dados.totais?.total_geral_fatura)}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Acoes */}
                                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                                    {activeTab === 'pdf_recebido' && (
                                        <button
                                            onClick={() => onExtrair(fatura.id)}
                                            disabled={isLoading}
                                            className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 flex items-center gap-2"
                                        >
                                            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                                            Extrair Dados
                                        </button>
                                    )}
                                    {activeTab === 'extraida' && (
                                        <button
                                            onClick={() => onGerarCobranca(fatura)}
                                            disabled={isLoading || !fatura.beneficiario}
                                            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
                                        >
                                            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Receipt size={16} />}
                                            Gerar Cobranca
                                        </button>
                                    )}
                                    {activeTab === 'relatorio_gerado' && fatura.cobranca && (
                                        <>
                                            <button
                                                onClick={() => onVerRelatorio(fatura.cobranca!.id)}
                                                disabled={isLoading}
                                                className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 disabled:opacity-50 flex items-center gap-2"
                                            >
                                                <Eye size={16} />
                                                Ver Relatorio
                                            </button>
                                            {fatura.cobranca.status === 'RASCUNHO' && (
                                                <button
                                                    onClick={() => onAprovar(fatura.cobranca!.id, false)}
                                                    disabled={isLoading}
                                                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center gap-2"
                                                >
                                                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                                                    Aprovar
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Sem dados extraidos */}
                        {!dados && activeTab === 'pdf_recebido' && (
                            <div className="text-center py-8">
                                <FileText className="mx-auto text-slate-400 mb-2" size={40} />
                                <p className="text-slate-500">PDF ainda nao foi extraido</p>
                                <button
                                    onClick={() => onExtrair(fatura.id)}
                                    disabled={isLoading}
                                    className="mt-4 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 flex items-center gap-2 mx-auto"
                                >
                                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                                    Extrair Agora
                                </button>
                            </div>
                        )}

                        {/* Cobranca Info */}
                        {fatura.cobranca && activeTab === 'relatorio_gerado' && (
                            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                                <h5 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Dados da Cobranca
                                </h5>
                                <div className="grid grid-cols-3 gap-4 text-sm">
                                    <div>
                                        <span className="text-slate-500">Valor Final:</span>
                                        <p className="font-bold text-lg">{formatarMoeda(fatura.cobranca.valor_final)}</p>
                                    </div>
                                    <div>
                                        <span className="text-slate-500">Economia:</span>
                                        <p className="font-bold text-lg text-green-600">
                                            {formatarMoeda(fatura.cobranca.economia_mes)}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-slate-500">Status:</span>
                                        <p>
                                            <span className={`px-2 py-1 rounded-full text-white text-xs ${
                                                COBRANCA_STATUS_CONFIG[fatura.cobranca.status]?.color || 'bg-slate-500'
                                            }`}>
                                                {COBRANCA_STATUS_CONFIG[fatura.cobranca.status]?.label || fatura.cobranca.status}
                                            </span>
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default ProcessamentoCobrancas;
