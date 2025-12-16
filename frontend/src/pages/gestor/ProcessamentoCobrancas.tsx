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
    Sparkles,
    RotateCcw,
    AlertTriangle,
    Save,
    XCircle,
    TrendingDown,
    Pencil
} from 'lucide-react';
import { faturasApi } from '../../api/faturas';
import { cobrancasApi, type Cobranca } from '../../api/cobrancas';

// ========================
// Types
// ========================

interface FaturaKanban {
    id: number;
    uc_id: number;
    uc_formatada: string;
    uc_apelido?: string;
    numero_fatura: number;
    mes_referencia: number;
    ano_referencia: number;
    valor_fatura: number;
    extracao_status: string;
    extracao_score: number | null;
    dados_extraidos: any;
    tem_pdf: boolean;
    // Campos de energia (vindos do backend)
    consumo_kwh?: number;
    injetada_kwh?: number;
    tipo_gd?: string;
    // Usina
    usina_id?: number;
    usina_nome?: string;
    // Beneficiario
    beneficiario: {
        id: number;
        nome: string;
    } | null;
    // Cobranca (agora com mais campos)
    cobranca: {
        id: number;
        status: string;
        valor_final: number;
        economia_mes: number;
        vencimento?: string;
    } | null;
    // Campos da API (disponíveis ANTES da extração)
    data_vencimento?: string;
    consumo_api?: number;
    bandeira_tarifaria?: string;
    quantidade_dias?: number;
    leitura_atual?: number;
    leitura_anterior?: number;
    situacao_pagamento?: string;
    data_pagamento?: string;
    valor_iluminacao_publica?: number;
    pdf_baixado_em?: string;
    // Cliente original (lead que foi convertido em beneficiário)
    cliente?: {
        id: number;
        nome: string;
        cpf?: string;
        email?: string;
        telefone?: string;
        convertido_em?: string;
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

// Tipos para validação de campos
type ValidacaoStatus = 'OK' | 'DIFERENTE' | 'AUSENTE';

interface CampoComparacao {
    label: string;
    valorApi: string | number | null;
    valorExtracao: string | number | null;
    status: ValidacaoStatus;
    editavel?: boolean;
}

// Interface para campos editáveis
interface CamposEditaveis {
    consumo_kwh?: number;
    injetada_ouc_kwh?: number;
    injetada_muc_kwh?: number;
}

// Helper para comparar valores com tolerância
const compararValores = (
    valorApi: number | null | undefined,
    valorExtracao: number | null | undefined,
    tolerancia: number = 0.05
): ValidacaoStatus => {
    if (valorApi === null || valorApi === undefined) return 'AUSENTE';
    if (valorExtracao === null || valorExtracao === undefined) return 'AUSENTE';

    const diff = Math.abs(valorApi - valorExtracao);
    const percentDiff = valorApi !== 0 ? diff / Math.abs(valorApi) : diff;

    return percentDiff <= tolerancia ? 'OK' : 'DIFERENTE';
};

// Helper para comparar strings
const compararStrings = (
    valorApi: string | null | undefined,
    valorExtracao: string | null | undefined
): ValidacaoStatus => {
    if (!valorApi && !valorExtracao) return 'OK';
    if (!valorApi || !valorExtracao) return 'AUSENTE';
    return valorApi.trim().toUpperCase() === valorExtracao.trim().toUpperCase() ? 'OK' : 'DIFERENTE';
};

// Helper para comparar datas
const compararDatas = (
    dataApi: string | null | undefined,
    dataExtracao: string | null | undefined
): ValidacaoStatus => {
    if (!dataApi && !dataExtracao) return 'OK';
    if (!dataApi || !dataExtracao) return 'AUSENTE';

    // Normalizar datas para comparação (formato ISO)
    const parseData = (d: string): string => {
        // Se já está em formato ISO
        if (d.includes('-')) return d.split('T')[0];
        // Se está em formato DD/MM/YYYY
        const partes = d.split('/');
        if (partes.length === 3) {
            return `${partes[2]}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}`;
        }
        return d;
    };

    return parseData(dataApi) === parseData(dataExtracao) ? 'OK' : 'DIFERENTE';
};

// Cores e ícones para status
const statusConfig: Record<ValidacaoStatus, { color: string; bgColor: string; icon: typeof CheckCircle2 }> = {
    OK: { color: 'text-green-600', bgColor: 'bg-green-50 dark:bg-green-900/20', icon: CheckCircle2 },
    DIFERENTE: { color: 'text-yellow-600', bgColor: 'bg-yellow-50 dark:bg-yellow-900/20', icon: AlertTriangle },
    AUSENTE: { color: 'text-red-600', bgColor: 'bg-red-50 dark:bg-red-900/20', icon: XCircle }
};

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

    const handleGerarCobranca = async (fatura: FaturaKanban, forcarReprocessamento: boolean = false) => {
        if (!fatura.beneficiario) {
            alert('Esta fatura nao tem beneficiario vinculado');
            return;
        }

        // Confirmação para reprocessamento
        if (forcarReprocessamento) {
            const confirmar = confirm(
                'Tem certeza que deseja reprocessar esta cobrança?\n\n' +
                'A cobrança existente será excluída e uma nova será gerada com os cálculos atualizados.'
            );
            if (!confirmar) return;
        }

        try {
            setLoadingAction(fatura.id);
            await cobrancasApi.gerarAutomatica(
                fatura.id,
                fatura.beneficiario.id,
                undefined,
                undefined,
                forcarReprocessamento
            );
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

    const handleRefazer = async (faturaId: number) => {
        const confirmar = confirm(
            'Deseja refazer esta fatura?\n\n' +
            'A cobranca existente sera excluida e voce precisara extrair novamente.'
        );
        if (!confirmar) return;

        try {
            setLoadingAction(faturaId);
            await faturasApi.refazer(faturaId);
            await fetchKanban();
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Erro ao refazer fatura');
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
                                onRefazer={handleRefazer}
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
    onGerarCobranca: (fatura: FaturaKanban, forcarReprocessamento?: boolean) => void;
    onAprovar: (cobrancaId: number, enviarEmail: boolean) => void;
    onVerRelatorio: (cobrancaId: number) => void;
    onRefazer: (faturaId: number) => void;
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
    onRefazer,
    formatarMoeda,
    formatarData,
    calcularInjetadaTotal,
    detectarModeloGD
}: FaturaAccordionItemProps) {
    const dados = fatura.dados_extraidos as DadosExtraidos;
    const isLoading = loadingAction === fatura.id || loadingAction === fatura.cobranca?.id;

    // Estado para campos editáveis
    const [editMode, setEditMode] = useState(false);
    const [camposEditados, setCamposEditados] = useState<CamposEditaveis>({});
    const [salvando, setSalvando] = useState(false);

    // Inicializar campos editados com valores extraídos
    useEffect(() => {
        if (dados && isExpanded) {
            const injetadaOuc = dados.itens_fatura?.energia_injetada_ouc?.reduce(
                (sum, item) => sum + (item.quantidade || 0), 0
            ) || 0;
            const injetadaMuc = dados.itens_fatura?.energia_injetada_muc?.reduce(
                (sum, item) => sum + (item.quantidade || 0), 0
            ) || 0;

            setCamposEditados({
                consumo_kwh: dados.itens_fatura?.consumo_kwh?.quantidade || 0,
                injetada_ouc_kwh: injetadaOuc,
                injetada_muc_kwh: injetadaMuc
            });
        }
    }, [dados, isExpanded]);

    // Função para renderizar indicador de status
    const renderStatusIndicador = (status: ValidacaoStatus) => {
        const config = statusConfig[status];
        const Icon = config.icon;
        return (
            <span className={`inline-flex items-center gap-1 text-xs ${config.color}`}>
                <Icon size={14} />
                {status === 'OK' ? 'OK' : status === 'DIFERENTE' ? 'Divergente' : 'N/A'}
            </span>
        );
    };

    // Calcular economia simulada com valores editados
    const calcularEconomiaSimulada = () => {
        const tarifaMedia = dados?.itens_fatura?.consumo_kwh?.preco_unit_com_tributos || 0.85;
        const injetadaTotal = (camposEditados.injetada_ouc_kwh || 0) + (camposEditados.injetada_muc_kwh || 0);
        return injetadaTotal * tarifaMedia;
    };

    return (
        <div className={`${isExpanded ? 'bg-slate-50 dark:bg-slate-900/50' : ''}`}>
            {/* Header do Accordion */}
            <div
                onClick={onToggle}
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/30 transition"
            >
                <div className="text-slate-400">
                    {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                </div>

                {/* Info UC + Beneficiario */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-slate-900 dark:text-white">
                            UC {fatura.uc_formatada || '-'}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            {fatura.mes_referencia?.toString().padStart(2, '0')}/{fatura.ano_referencia}
                        </span>
                        {fatura.extracao_score && (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                                fatura.extracao_score >= 90 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                fatura.extracao_score >= 70 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            }`}>
                                {fatura.extracao_score}%
                            </span>
                        )}
                        {fatura.tipo_gd && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                {fatura.tipo_gd}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                        {fatura.beneficiario && (
                            <span className="truncate">
                                <User size={12} className="inline mr-1" />
                                {fatura.beneficiario.nome}
                            </span>
                        )}
                        {/* Cliente (quando diferente do beneficiário) */}
                        {fatura.cliente && fatura.cliente.nome !== fatura.beneficiario?.nome && (
                            <span className="truncate text-xs text-blue-600" title="Cliente que contratou">
                                <span className="text-slate-400 mx-1">|</span>
                                Cliente: {fatura.cliente.nome}
                            </span>
                        )}
                        {fatura.usina_nome && (
                            <span className="truncate text-xs">
                                <MapPin size={10} className="inline mr-1" />
                                {fatura.usina_nome}
                            </span>
                        )}
                    </div>
                </div>

                {/* Dados de Energia (quando extraido) */}
                {(fatura.consumo_kwh || fatura.injetada_kwh) && (
                    <div className="hidden md:flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
                        {fatura.consumo_kwh && (
                            <span title="Consumo">
                                <Zap size={12} className="inline mr-1 text-orange-500" />
                                {fatura.consumo_kwh} kWh
                            </span>
                        )}
                        {fatura.injetada_kwh && (
                            <span title="Injetada">
                                <Zap size={12} className="inline mr-1 text-green-500" />
                                {fatura.injetada_kwh} kWh
                            </span>
                        )}
                    </div>
                )}

                {/* Dados da API (quando NAO extraido ainda) */}
                {!fatura.consumo_kwh && (fatura.consumo_api || fatura.data_vencimento || fatura.bandeira_tarifaria) && (
                    <div className="hidden md:flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
                        {fatura.data_vencimento && (
                            <span title="Vencimento" className="flex items-center">
                                <Calendar size={12} className="mr-1 text-slate-500" />
                                {new Date(fatura.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}
                            </span>
                        )}
                        {fatura.consumo_api && (
                            <span title="Consumo (API)">
                                <Zap size={12} className="inline mr-1 text-orange-400" />
                                {fatura.consumo_api} kWh
                            </span>
                        )}
                        {fatura.bandeira_tarifaria && (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                fatura.bandeira_tarifaria.includes('VERDE') ? 'bg-green-100 text-green-700' :
                                fatura.bandeira_tarifaria.includes('AMARELA') ? 'bg-yellow-100 text-yellow-700' :
                                fatura.bandeira_tarifaria.includes('VERMELHA') ? 'bg-red-100 text-red-700' :
                                'bg-slate-100 text-slate-700'
                            }`} title="Bandeira Tarifaria">
                                {fatura.bandeira_tarifaria}
                            </span>
                        )}
                    </div>
                )}

                {/* Valor Fatura */}
                <div className="text-right min-w-[90px]">
                    <p className="font-semibold text-slate-900 dark:text-white">
                        {formatarMoeda(fatura.valor_fatura)}
                    </p>
                    <p className="text-xs text-slate-500">Fatura</p>
                </div>

                {/* Valor Cobranca + Status */}
                {fatura.cobranca && (
                    <div className="text-right min-w-[100px]">
                        <div className="flex items-center justify-end gap-1.5 mb-0.5">
                            <span className={`text-xs px-2 py-0.5 rounded-full text-white ${
                                COBRANCA_STATUS_CONFIG[fatura.cobranca.status]?.color || 'bg-slate-500'
                            }`}>
                                {COBRANCA_STATUS_CONFIG[fatura.cobranca.status]?.label || fatura.cobranca.status}
                            </span>
                        </div>
                        {fatura.cobranca.valor_final > 0 && (
                            <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                                {formatarMoeda(fatura.cobranca.valor_final)}
                            </p>
                        )}
                        {fatura.cobranca.economia_mes > 0 && (
                            <p className="text-xs text-green-600 dark:text-green-400">
                                +{formatarMoeda(fatura.cobranca.economia_mes)}
                            </p>
                        )}
                    </div>
                )}

                {/* Botao Acao Rapida */}
                <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-2">
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
                        <>
                            <button
                                onClick={() => onRefazer(fatura.id)}
                                disabled={isLoading}
                                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
                                title="Refazer (volta para Aguardando Extracao)"
                            >
                                {isLoading ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                            </button>
                            <button
                                onClick={() => onGerarCobranca(fatura)}
                                disabled={isLoading || !fatura.beneficiario}
                                className="px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 text-sm flex items-center gap-1"
                            >
                                {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Receipt size={14} />}
                                Gerar Cobranca
                            </button>
                        </>
                    )}
                    {activeTab === 'relatorio_gerado' && fatura.cobranca && (
                        <>
                            <button
                                onClick={() => onVerRelatorio(fatura.cobranca!.id)}
                                disabled={isLoading}
                                className="px-3 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 text-sm flex items-center gap-1"
                            >
                                {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
                                Ver Relatorio
                            </button>
                            {fatura.cobranca.status !== 'PAGA' && (
                                <button
                                    onClick={() => onRefazer(fatura.id)}
                                    disabled={isLoading}
                                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
                                    title="Refazer (volta para Aguardando Extracao)"
                                >
                                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Conteudo Expandido */}
            {isExpanded && (
                <div className="px-4 pb-4 ml-10">
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">

                        {/* ========================================
                            NOVA SEÇÃO: Visualização para tab 'extraida'
                            Comparação API vs Extração com edição
                        ======================================== */}
                        {activeTab === 'extraida' && (
                            <div className="space-y-5">
                                {/* Header com Score e Modelo GD */}
                                <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-700">
                                    <div className="flex items-center gap-4">
                                        {/* Score de Confiança */}
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-slate-500">Score:</span>
                                            <div className="flex items-center gap-2">
                                                <div className="w-24 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${
                                                            (fatura.extracao_score || 0) >= 90 ? 'bg-green-500' :
                                                            (fatura.extracao_score || 0) >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                                                        }`}
                                                        style={{ width: `${fatura.extracao_score || 0}%` }}
                                                    />
                                                </div>
                                                <span className={`text-sm font-bold ${
                                                    (fatura.extracao_score || 0) >= 90 ? 'text-green-600' :
                                                    (fatura.extracao_score || 0) >= 70 ? 'text-yellow-600' : 'text-red-600'
                                                }`}>
                                                    {fatura.extracao_score || 0}%
                                                </span>
                                            </div>
                                        </div>
                                        {/* Modelo GD */}
                                        <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-sm font-medium">
                                            {dados ? detectarModeloGD(dados) : fatura.tipo_gd || 'GD I'}
                                        </span>
                                        {/* Tipo Ligação */}
                                        {dados?.ligacao && (
                                            <span className="px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full text-sm">
                                                {dados.ligacao}
                                            </span>
                                        )}
                                    </div>
                                    {/* Vencimento */}
                                    <div className="text-right">
                                        <span className="text-xs text-slate-500">Vencimento:</span>
                                        <p className="font-medium text-slate-900 dark:text-white">
                                            {fatura.data_vencimento
                                                ? new Date(fatura.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR')
                                                : dados?.vencimento || 'N/A'
                                            }
                                        </p>
                                    </div>
                                </div>

                                {/* COMPARAÇÃO API vs EXTRAÇÃO */}
                                <div>
                                    <h4 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                                        <BarChart3 size={18} />
                                        Comparacao API vs Extracao
                                    </h4>

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        {/* Coluna API */}
                                        <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                                            <div className="bg-slate-50 dark:bg-slate-900 px-4 py-2 border-b border-slate-200 dark:border-slate-700">
                                                <h5 className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                                    Dados API (Energisa)
                                                </h5>
                                            </div>
                                            <div className="p-4 space-y-3">
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-slate-500">Valor Fatura:</span>
                                                    <span className="font-medium">{formatarMoeda(fatura.valor_fatura)}</span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-slate-500">Consumo:</span>
                                                    <span className="font-medium">{fatura.consumo_api ? `${fatura.consumo_api} kWh` : 'N/A'}</span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-slate-500">Vencimento:</span>
                                                    <span className="font-medium">
                                                        {fatura.data_vencimento
                                                            ? new Date(fatura.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR')
                                                            : 'N/A'
                                                        }
                                                    </span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-slate-500">Bandeira:</span>
                                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                                        fatura.bandeira_tarifaria?.includes('VERDE') ? 'bg-green-100 text-green-700' :
                                                        fatura.bandeira_tarifaria?.includes('AMARELA') ? 'bg-yellow-100 text-yellow-700' :
                                                        fatura.bandeira_tarifaria?.includes('VERMELHA') ? 'bg-red-100 text-red-700' :
                                                        'bg-slate-100 text-slate-700'
                                                    }`}>
                                                        {fatura.bandeira_tarifaria || 'N/A'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-slate-500">Leitura:</span>
                                                    <span className="font-medium">
                                                        {fatura.leitura_anterior && fatura.leitura_atual
                                                            ? `${fatura.leitura_anterior} → ${fatura.leitura_atual}`
                                                            : 'N/A'
                                                        }
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Coluna Extração */}
                                        <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                                            <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-2 border-b border-slate-200 dark:border-slate-700">
                                                <h5 className="text-sm font-medium text-blue-700 dark:text-blue-400">
                                                    Dados Extraidos (PDF)
                                                </h5>
                                            </div>
                                            <div className="p-4 space-y-3">
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-slate-500">Total Fatura:</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium">{formatarMoeda(dados?.totais?.total_geral_fatura)}</span>
                                                        {renderStatusIndicador(
                                                            compararValores(fatura.valor_fatura, dados?.totais?.total_geral_fatura, 0.02)
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-slate-500">Consumo:</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium">
                                                            {dados?.itens_fatura?.consumo_kwh?.quantidade
                                                                ? `${dados.itens_fatura.consumo_kwh.quantidade} kWh`
                                                                : 'N/A'
                                                            }
                                                        </span>
                                                        {renderStatusIndicador(
                                                            compararValores(fatura.consumo_api, dados?.itens_fatura?.consumo_kwh?.quantidade)
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-slate-500">Vencimento:</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium">{dados?.vencimento || 'N/A'}</span>
                                                        {renderStatusIndicador(
                                                            compararDatas(fatura.data_vencimento, dados?.vencimento)
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-slate-500">Bandeira:</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                                            dados?.bandeira_tarifaria?.includes('VERDE') ? 'bg-green-100 text-green-700' :
                                                            dados?.bandeira_tarifaria?.includes('AMARELA') ? 'bg-yellow-100 text-yellow-700' :
                                                            dados?.bandeira_tarifaria?.includes('VERMELHA') ? 'bg-red-100 text-red-700' :
                                                            'bg-slate-100 text-slate-700'
                                                        }`}>
                                                            {dados?.bandeira_tarifaria || 'N/A'}
                                                        </span>
                                                        {renderStatusIndicador(
                                                            compararStrings(fatura.bandeira_tarifaria, dados?.bandeira_tarifaria)
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-slate-500">Leitura:</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium">
                                                            {dados?.leitura_anterior && dados?.leitura_atual
                                                                ? `${dados.leitura_anterior} → ${dados.leitura_atual}`
                                                                : 'N/A'
                                                            }
                                                        </span>
                                                        {renderStatusIndicador(
                                                            compararValores(fatura.leitura_atual, dados?.leitura_atual)
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* ENERGIA GD - Editável */}
                                {dados && (
                                    <div className="border border-blue-200 dark:border-blue-800 rounded-lg overflow-hidden">
                                        <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-2 border-b border-blue-200 dark:border-blue-800 flex justify-between items-center">
                                            <h5 className="text-sm font-medium text-blue-700 dark:text-blue-400 flex items-center gap-2">
                                                <Zap size={16} />
                                                Energia GD {editMode && <span className="text-xs">(Editando)</span>}
                                            </h5>
                                            <button
                                                onClick={() => setEditMode(!editMode)}
                                                className={`text-xs px-2 py-1 rounded flex items-center gap-1 transition ${
                                                    editMode
                                                        ? 'bg-blue-600 text-white'
                                                        : 'bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-200'
                                                }`}
                                            >
                                                <Pencil size={12} />
                                                {editMode ? 'Editando' : 'Editar'}
                                            </button>
                                        </div>
                                        <div className="p-4 space-y-4">
                                            {/* Consumo */}
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm text-slate-500 w-32">Consumo:</span>
                                                    {editMode ? (
                                                        <input
                                                            type="number"
                                                            value={camposEditados.consumo_kwh || 0}
                                                            onChange={(e) => setCamposEditados({
                                                                ...camposEditados,
                                                                consumo_kwh: parseFloat(e.target.value) || 0
                                                            })}
                                                            className="w-24 px-2 py-1 border border-blue-300 dark:border-blue-600 rounded bg-white dark:bg-slate-900 text-sm"
                                                        />
                                                    ) : (
                                                        <span className="font-medium">{dados.itens_fatura?.consumo_kwh?.quantidade || 0}</span>
                                                    )}
                                                    <span className="text-sm text-slate-500">kWh</span>
                                                </div>
                                                <span className="text-sm text-slate-600">
                                                    x R$ {(dados.itens_fatura?.consumo_kwh?.preco_unit_com_tributos || 0).toFixed(4)} = {formatarMoeda(dados.itens_fatura?.consumo_kwh?.valor_total)}
                                                </span>
                                            </div>

                                            {/* Injetada oUC (GD I) */}
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm text-slate-500 w-32">Injetada oUC:</span>
                                                    {editMode ? (
                                                        <input
                                                            type="number"
                                                            value={camposEditados.injetada_ouc_kwh || 0}
                                                            onChange={(e) => setCamposEditados({
                                                                ...camposEditados,
                                                                injetada_ouc_kwh: parseFloat(e.target.value) || 0
                                                            })}
                                                            className="w-24 px-2 py-1 border border-green-300 dark:border-green-600 rounded bg-white dark:bg-slate-900 text-sm"
                                                        />
                                                    ) : (
                                                        <span className="font-medium text-green-600">
                                                            {dados.itens_fatura?.energia_injetada_ouc?.reduce((s, i) => s + (i.quantidade || 0), 0) || 0}
                                                        </span>
                                                    )}
                                                    <span className="text-sm text-slate-500">kWh</span>
                                                </div>
                                                <span className="text-sm text-green-600">
                                                    Credito: {formatarMoeda(
                                                        dados.itens_fatura?.energia_injetada_ouc?.reduce((s, i) => s + (i.valor_total || 0), 0) || 0
                                                    )}
                                                </span>
                                            </div>

                                            {/* Injetada mUC (GD II) */}
                                            {(dados.itens_fatura?.energia_injetada_muc?.length || 0) > 0 && (
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm text-slate-500 w-32">Injetada mUC:</span>
                                                        {editMode ? (
                                                            <input
                                                                type="number"
                                                                value={camposEditados.injetada_muc_kwh || 0}
                                                                onChange={(e) => setCamposEditados({
                                                                    ...camposEditados,
                                                                    injetada_muc_kwh: parseFloat(e.target.value) || 0
                                                                })}
                                                                className="w-24 px-2 py-1 border border-blue-300 dark:border-blue-600 rounded bg-white dark:bg-slate-900 text-sm"
                                                            />
                                                        ) : (
                                                            <span className="font-medium text-blue-600">
                                                                {dados.itens_fatura?.energia_injetada_muc?.reduce((s, i) => s + (i.quantidade || 0), 0) || 0}
                                                            </span>
                                                        )}
                                                        <span className="text-sm text-slate-500">kWh</span>
                                                    </div>
                                                    <span className="text-sm text-blue-600">
                                                        Credito: {formatarMoeda(
                                                            dados.itens_fatura?.energia_injetada_muc?.reduce((s, i) => s + (i.valor_total || 0), 0) || 0
                                                        )}
                                                    </span>
                                                </div>
                                            )}

                                            {/* Totalizador Injetada */}
                                            <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                                    TOTAL INJETADO:
                                                </span>
                                                <span className="font-bold text-lg text-green-600">
                                                    {editMode
                                                        ? (camposEditados.injetada_ouc_kwh || 0) + (camposEditados.injetada_muc_kwh || 0)
                                                        : calcularInjetadaTotal(dados)
                                                    } kWh
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* RESUMO ECONOMIA GD */}
                                <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
                                    <h5 className="text-sm font-medium text-green-700 dark:text-green-400 mb-3 flex items-center gap-2">
                                        <TrendingDown size={16} />
                                        Resumo Economia GD
                                    </h5>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="text-center">
                                            <span className="text-xs text-slate-500 block mb-1">Fatura Original</span>
                                            <p className="font-bold text-lg text-slate-900 dark:text-white">
                                                {formatarMoeda(fatura.valor_fatura)}
                                            </p>
                                        </div>
                                        <div className="text-center">
                                            <span className="text-xs text-slate-500 block mb-1">Creditos GD</span>
                                            <p className="font-bold text-lg text-green-600">
                                                -{formatarMoeda(
                                                    editMode
                                                        ? calcularEconomiaSimulada()
                                                        : (dados?.itens_fatura?.energia_injetada_ouc?.reduce((s, i) => s + (i.valor_total || 0), 0) || 0) +
                                                          (dados?.itens_fatura?.energia_injetada_muc?.reduce((s, i) => s + (i.valor_total || 0), 0) || 0)
                                                )}
                                            </p>
                                        </div>
                                        <div className="text-center bg-white/50 dark:bg-slate-800/50 rounded-lg p-2">
                                            <span className="text-xs text-slate-500 block mb-1">Economia Estimada</span>
                                            <p className="font-bold text-xl text-green-600">
                                                {formatarMoeda(
                                                    editMode
                                                        ? calcularEconomiaSimulada()
                                                        : (dados?.itens_fatura?.energia_injetada_ouc?.reduce((s, i) => s + (i.valor_total || 0), 0) || 0) +
                                                          (dados?.itens_fatura?.energia_injetada_muc?.reduce((s, i) => s + (i.valor_total || 0), 0) || 0)
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Cliente Contratante */}
                                {fatura.cliente && (
                                    <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4">
                                        <h5 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                                            <User size={16} />
                                            Cliente Contratante
                                        </h5>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                            <div>
                                                <span className="text-slate-500">Nome:</span>
                                                <p className="font-medium">{fatura.cliente.nome}</p>
                                            </div>
                                            {fatura.cliente.cpf && (
                                                <div>
                                                    <span className="text-slate-500">CPF:</span>
                                                    <p className="font-medium">{fatura.cliente.cpf}</p>
                                                </div>
                                            )}
                                            {fatura.cliente.email && (
                                                <div>
                                                    <span className="text-slate-500">Email:</span>
                                                    <p className="font-medium">{fatura.cliente.email}</p>
                                                </div>
                                            )}
                                            {fatura.cliente.telefone && (
                                                <div>
                                                    <span className="text-slate-500">Telefone:</span>
                                                    <p className="font-medium">{fatura.cliente.telefone}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Acoes */}
                                <div className="flex justify-between items-center gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
                                    <div className="flex items-center gap-2">
                                        {editMode && (
                                            <button
                                                onClick={async () => {
                                                    setSalvando(true);
                                                    // TODO: Implementar salvamento no backend
                                                    await new Promise(r => setTimeout(r, 500));
                                                    setSalvando(false);
                                                    setEditMode(false);
                                                    alert('Funcionalidade em desenvolvimento. Valores serao considerados na geracao da cobranca.');
                                                }}
                                                disabled={salvando}
                                                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center gap-2"
                                            >
                                                {salvando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                                Salvar Alteracoes
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => onRefazer(fatura.id)}
                                            disabled={isLoading}
                                            className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 flex items-center gap-2"
                                            title="Volta para Aguardando Extracao"
                                        >
                                            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                                            Reprocessar PDF
                                        </button>
                                        <button
                                            onClick={() => onGerarCobranca(fatura)}
                                            disabled={isLoading || !fatura.beneficiario}
                                            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
                                        >
                                            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Receipt size={16} />}
                                            Gerar Cobranca
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ========================================
                            Seção original para 'pdf_recebido' e 'relatorio_gerado'
                        ======================================== */}

                        {/* Dados Extraidos - para pdf_recebido (quando já tem dados) */}
                        {dados && activeTab === 'pdf_recebido' && (
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

                                {/* Acoes pdf_recebido */}
                                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                                    <button
                                        onClick={() => onExtrair(fatura.id)}
                                        disabled={isLoading}
                                        className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                                        Extrair Dados
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Sem dados extraidos - mostra dados da API (pdf_recebido) */}
                        {!dados && activeTab === 'pdf_recebido' && (
                            <div className="py-4">
                                {/* Alerta + botao */}
                                <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-200 dark:border-slate-700">
                                    <div className="flex items-center gap-2 text-amber-600">
                                        <Clock size={16} />
                                        <span className="text-sm font-medium">PDF aguardando extracao</span>
                                    </div>
                                    <button
                                        onClick={() => onExtrair(fatura.id)}
                                        disabled={isLoading}
                                        className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                                        Extrair Agora
                                    </button>
                                </div>

                                {/* Dados da API */}
                                <h5 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                                    Dados da Fatura (via API)
                                </h5>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                    <div>
                                        <span className="text-slate-500">N Fatura:</span>
                                        <p className="font-medium">{fatura.numero_fatura || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <span className="text-slate-500">Vencimento:</span>
                                        <p className="font-medium">
                                            {fatura.data_vencimento
                                                ? new Date(fatura.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR')
                                                : 'N/A'
                                            }
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-slate-500">Consumo:</span>
                                        <p className="font-medium">{fatura.consumo_api ? `${fatura.consumo_api} kWh` : 'N/A'}</p>
                                    </div>
                                    <div>
                                        <span className="text-slate-500">Bandeira:</span>
                                        <p>
                                            {fatura.bandeira_tarifaria ? (
                                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                                    fatura.bandeira_tarifaria.includes('VERDE') ? 'bg-green-100 text-green-800' :
                                                    fatura.bandeira_tarifaria.includes('AMARELA') ? 'bg-yellow-100 text-yellow-800' :
                                                    fatura.bandeira_tarifaria.includes('VERMELHA') ? 'bg-red-100 text-red-800' :
                                                    'bg-slate-100 text-slate-800'
                                                }`}>
                                                    {fatura.bandeira_tarifaria}
                                                </span>
                                            ) : 'N/A'}
                                        </p>
                                    </div>
                                </div>

                                {/* Cliente Contratante */}
                                {fatura.cliente && (
                                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                                        <h5 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                            Cliente Contratante
                                        </h5>
                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                            <div>
                                                <span className="text-slate-500">Nome:</span>
                                                <p className="font-medium">{fatura.cliente.nome}</p>
                                            </div>
                                            {fatura.cliente.cpf && (
                                                <div>
                                                    <span className="text-slate-500">CPF:</span>
                                                    <p className="font-medium">{fatura.cliente.cpf}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Info do PDF */}
                                {fatura.pdf_baixado_em && (
                                    <p className="text-xs text-slate-400 mt-4">
                                        PDF recebido em: {new Date(fatura.pdf_baixado_em).toLocaleString('pt-BR')}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Cobranca Info - relatorio_gerado */}
                        {fatura.cobranca && activeTab === 'relatorio_gerado' && (
                            <div className="space-y-4">
                                <h4 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                    <Receipt size={18} />
                                    Dados da Cobranca
                                </h4>
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

                                {/* Acoes relatorio_gerado */}
                                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                                    {fatura.cobranca.status !== 'PAGA' && (
                                        <button
                                            onClick={() => onRefazer(fatura.id)}
                                            disabled={isLoading}
                                            className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 flex items-center gap-2"
                                            title="Exclui cobranca e volta para Aguardando Extracao"
                                        >
                                            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                                            Refazer
                                        </button>
                                    )}
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
