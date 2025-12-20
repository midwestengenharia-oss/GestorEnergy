/**
 * Gestao de Faturas - Pagina unificada com Kanban e Lista
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FileX, FileText, Zap, FileEdit, CreditCard, CheckCircle, Check,
    RefreshCw, LayoutGrid, List, Search, Filter, ChevronDown, ChevronRight,
    Eye, Copy, Loader2, AlertCircle, RotateCcw, RefreshCcw, User, BarChart3,
    Receipt, TrendingUp, CheckCircle2, AlertTriangle, XCircle, Info, ExternalLink
} from 'lucide-react';
import { faturasApi, FaturaGestao, TotaisGestao, StatusFluxo } from '../../api/faturas';
import { usinasApi } from '../../api/usinas';
import { cobrancasApi } from '../../api/cobrancas';

// ========================
// Tipos para dados extraidos
// ========================

interface EnergiaInjetadaItem {
    descricao?: string;
    tipo_gd?: string;
    quantidade?: number;
    preco_unit_com_tributos?: number;
    valor?: number;
    valor_total?: number;
}

interface LancamentoServico {
    descricao?: string;
    valor?: number;
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
    consumo_kwh?: number;
    injetada_kwh?: number;
    injetada_ouc_kwh?: number;
    injetada_muc_kwh?: number;
    bandeira_tarifaria?: string;
    itens_fatura?: {
        consumo_kwh?: {
            quantidade?: number;
            preco_unit_com_tributos?: number;
            valor?: number;
            valor_total?: number;
        };
        'energia_injetada oUC'?: EnergiaInjetadaItem[];
        'energia_injetada mUC'?: EnergiaInjetadaItem[];
        energia_injetada_ouc?: EnergiaInjetadaItem[];
        energia_injetada_muc?: EnergiaInjetadaItem[];
        ajuste_lei_14300?: {
            descricao?: string;
            quantidade?: number;
            preco_unit_com_tributos?: number;
            valor?: number;
        };
        lancamentos_e_servicos?: LancamentoServico[];
    };
    totais?: {
        adicionais_bandeira?: number;
        bandeiras_detalhamento?: Array<{ cor?: string; valor?: number }>;
        lancamentos_e_servicos?: number;
        total_geral_fatura?: number;
    };
    quadro_atencao?: {
        saldo_acumulado?: number;
        a_expirar_proximo_ciclo?: number;
    };
}

// ========================
// Helpers de comparacao
// ========================

type ValidacaoStatus = 'OK' | 'DIFERENTE' | 'AUSENTE' | 'INFO';

const compararValores = (v1: number | null | undefined, v2: number | null | undefined, tolerancia = 0.05): ValidacaoStatus => {
    if (v1 == null) return 'AUSENTE';
    if (v2 == null) return 'AUSENTE';
    const diff = Math.abs(v1 - v2);
    const percentDiff = v1 !== 0 ? diff / Math.abs(v1) : diff;
    return percentDiff <= tolerancia ? 'OK' : 'DIFERENTE';
};

const compararStrings = (s1: string | null | undefined, s2: string | null | undefined): ValidacaoStatus => {
    if (!s1 && !s2) return 'OK';
    if (!s1 || !s2) return 'AUSENTE';
    return s1.trim().toUpperCase() === s2.trim().toUpperCase() ? 'OK' : 'DIFERENTE';
};

const compararDatas = (d1: string | null | undefined, d2: string | null | undefined): ValidacaoStatus => {
    if (!d1 && !d2) return 'OK';
    if (!d1 || !d2) return 'AUSENTE';
    const parseData = (d: string): string => {
        if (d.includes('-')) return d.split('T')[0];
        const partes = d.split('/');
        if (partes.length === 3) return `${partes[2]}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}`;
        return d;
    };
    return parseData(d1) === parseData(d2) ? 'OK' : 'DIFERENTE';
};

// ========================
// Helpers de energia
// ========================

const getEnergiaInjetadaOUC = (itens: DadosExtraidos['itens_fatura']): EnergiaInjetadaItem[] => {
    if (!itens) return [];
    return itens['energia_injetada oUC'] || itens.energia_injetada_ouc || [];
};

const getEnergiaInjetadaMUC = (itens: DadosExtraidos['itens_fatura']): EnergiaInjetadaItem[] => {
    if (!itens) return [];
    return itens['energia_injetada mUC'] || itens.energia_injetada_muc || [];
};

const calcularInjetadaOUC = (itens: DadosExtraidos['itens_fatura']): number => {
    return getEnergiaInjetadaOUC(itens).reduce((sum, item) => sum + Math.abs(item.quantidade || 0), 0);
};

const calcularInjetadaMUC = (itens: DadosExtraidos['itens_fatura']): number => {
    return getEnergiaInjetadaMUC(itens).reduce((sum, item) => sum + Math.abs(item.quantidade || 0), 0);
};

const calcularValorInjetadaOUC = (itens: DadosExtraidos['itens_fatura']): number => {
    return getEnergiaInjetadaOUC(itens).reduce((sum, item) => sum + Math.abs(item.valor || item.valor_total || 0), 0);
};

const calcularValorInjetadaMUC = (itens: DadosExtraidos['itens_fatura']): number => {
    return getEnergiaInjetadaMUC(itens).reduce((sum, item) => sum + Math.abs(item.valor || item.valor_total || 0), 0);
};

const getLancamentosSemIluminacao = (itens: DadosExtraidos['itens_fatura']): LancamentoServico[] => {
    if (!itens?.lancamentos_e_servicos) return [];
    const ilumItem = itens.lancamentos_e_servicos.find(s => s.descricao?.toLowerCase().includes('ilum'));
    const valorIlum = Number(ilumItem?.valor) || 0;
    return itens.lancamentos_e_servicos.filter(s => {
        const desc = s.descricao?.toLowerCase() || '';
        const valorItem = Number(s.valor) || 0;
        if (desc.includes('ilum')) return false;
        if (desc.includes('bandeira') || desc.includes('b. verm') || desc.includes('b. amar')) return false;
        if ((desc.includes('outros') || desc.includes('servi')) && valorIlum > 0 && Math.abs(valorItem - valorIlum) < 0.02) return false;
        if (valorIlum > 0 && valorItem === valorIlum) return false;
        return true;
    });
};

const getValorIluminacaoPublica = (itens: DadosExtraidos['itens_fatura']): number => {
    if (!itens?.lancamentos_e_servicos) return 0;
    const ilum = itens.lancamentos_e_servicos.find(s => s.descricao?.toLowerCase().includes('ilum'));
    return ilum?.valor || 0;
};

const getTaxaMinima = (tipoLigacao: string | undefined): number => {
    switch (tipoLigacao?.toUpperCase()) {
        case 'MONOFASICO': return 30;
        case 'BIFASICO': return 50;
        case 'TRIFASICO': return 100;
        default: return 0;
    }
};

// Icones e cores para status de validacao
const statusValidacaoConfig: Record<ValidacaoStatus, { color: string; bgColor: string; icon: React.ElementType }> = {
    OK: { color: 'text-green-600', bgColor: 'bg-green-50 dark:bg-green-900/20', icon: CheckCircle2 },
    DIFERENTE: { color: 'text-yellow-600', bgColor: 'bg-yellow-50 dark:bg-yellow-900/20', icon: AlertTriangle },
    AUSENTE: { color: 'text-red-600', bgColor: 'bg-red-50 dark:bg-red-900/20', icon: XCircle },
    INFO: { color: 'text-blue-600', bgColor: 'bg-blue-50 dark:bg-blue-900/20', icon: Info }
};

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
    const navigate = useNavigate();

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
                className="bg-white dark:bg-slate-800 rounded-lg p-3 shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md transition cursor-pointer"
                onClick={() => {
                    setViewMode('lista');
                    setExpandedId(fatura.id);
                }}
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

                {/* Acoes - apenas acoes primarias de fatura */}
                <div className="flex flex-wrap gap-1 mt-3" onClick={e => e.stopPropagation()}>
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
                    {fatura.status_fluxo === 'EXTRAIDA' && fatura.beneficiario && (
                        <button
                            onClick={() => handleGerarCobranca(fatura)}
                            disabled={isLoading}
                            className="text-xs px-2 py-1 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50 flex items-center gap-1"
                        >
                            {isLoading ? <Loader2 size={12} className="animate-spin" /> : <FileEdit size={12} />}
                            Gerar
                        </button>
                    )}
                    {['COBRANCA_RASCUNHO', 'COBRANCA_EMITIDA', 'COBRANCA_PAGA', 'FATURA_QUITADA'].includes(fatura.status_fluxo) && fatura.cobranca && (
                        <button
                            onClick={() => navigate('/app/gestor/cobrancas')}
                            className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center gap-1"
                        >
                            <ExternalLink size={12} />
                            Ver Cobranca
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
                            {/* Acoes primarias de fatura */}
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
                            {fatura.status_fluxo === 'EXTRAIDA' && fatura.beneficiario && (
                                <button
                                    onClick={() => handleGerarCobranca(fatura)}
                                    disabled={isLoading}
                                    className="text-xs px-2 py-1 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50 flex items-center gap-1"
                                >
                                    {isLoading ? <Loader2 size={12} className="animate-spin" /> : <FileEdit size={12} />}
                                    Gerar
                                </button>
                            )}
                            {/* Link para gestao de cobrancas */}
                            {['COBRANCA_RASCUNHO', 'COBRANCA_EMITIDA', 'COBRANCA_PAGA', 'FATURA_QUITADA'].includes(fatura.status_fluxo) && fatura.cobranca && (
                                <button
                                    onClick={() => navigate('/app/gestor/cobrancas')}
                                    className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center gap-1"
                                >
                                    <ExternalLink size={12} />
                                    Cobrancas
                                </button>
                            )}
                        </div>
                    </td>
                </tr>
                {isExpanded && (() => {
                    const dados = fatura.dados_extraidos as DadosExtraidos | undefined;
                    const dadosApi = fatura.dados_api as Record<string, any> | undefined;

                    // Dados da API - priorizar campos diretos da fatura, fallback para dados_api
                    const consumoApi = fatura.consumo ?? dadosApi?.consumo;
                    const leituraAtualApi = fatura.leitura_atual ?? dadosApi?.leitura_atual;
                    const leituraAnteriorApi = fatura.leitura_anterior ?? dadosApi?.leitura_anterior;
                    const dataVencimentoApi = fatura.data_vencimento ?? dadosApi?.data_vencimento;
                    const bandeiraApi = fatura.bandeira_tarifaria ?? dadosApi?.bandeira_tarifaria;

                    // Helper para renderizar indicador de status
                    const renderStatusIndicador = (status: ValidacaoStatus) => {
                        const cfg = statusValidacaoConfig[status];
                        const IconComp = cfg.icon;
                        return <IconComp size={14} className={cfg.color} />;
                    };

                    // Calculos para as tabelas detalhadas
                    const consumo = dados?.itens_fatura?.consumo_kwh || {};
                    const consumoKwh = consumo.quantidade || dados?.consumo_kwh || 0;
                    const consumoTarifa = consumo.preco_unit_com_tributos || 0.85;
                    const consumoValor = consumo.valor || (consumoKwh * consumoTarifa);

                    const injetadaOucKwh = calcularInjetadaOUC(dados?.itens_fatura) || dados?.injetada_ouc_kwh || 0;
                    const injetadaMucKwh = calcularInjetadaMUC(dados?.itens_fatura) || dados?.injetada_muc_kwh || 0;
                    const injetadaOucValor = calcularValorInjetadaOUC(dados?.itens_fatura);
                    const injetadaMucValor = calcularValorInjetadaMUC(dados?.itens_fatura);
                    const injetadaTotalKwh = injetadaOucKwh + injetadaMucKwh;
                    const injetadaTotalValor = injetadaOucValor + injetadaMucValor;

                    const ajuste = dados?.itens_fatura?.ajuste_lei_14300;
                    const tipoLigacao = fatura.tipo_ligacao || dados?.ligacao;
                    const taxaMinimaKwh = getTaxaMinima(tipoLigacao);
                    const taxaMinimaValor = taxaMinimaKwh * consumoTarifa;

                    const bandeirasDetalhamento = dados?.totais?.bandeiras_detalhamento || [];
                    const bandeiras = bandeirasDetalhamento.length > 0
                        ? bandeirasDetalhamento.reduce((sum, b) => sum + (b.valor || 0), 0)
                        : (dados?.totais?.adicionais_bandeira || 0);

                    const iluminacao = getValorIluminacaoPublica(dados?.itens_fatura);
                    const outrosServicos = getLancamentosSemIluminacao(dados?.itens_fatura);
                    const valorOutros = outrosServicos.reduce((s, item) => s + (item.valor || 0), 0);
                    const totalFatura = dados?.totais?.total_geral_fatura || fatura.valor_fatura || 0;

                    // Calculos para previa da cobranca
                    const tarifaBase = consumoTarifa;
                    const energiaSemDesconto = injetadaTotalKwh * tarifaBase;
                    const energiaComDesconto = injetadaTotalKwh * tarifaBase * 0.70;
                    const disponibilidade = ajuste?.valor || 0;
                    const gapKwh = Math.max(0, consumoKwh - injetadaTotalKwh);
                    const energiaExcedenteValor = gapKwh * tarifaBase;
                    const temConsumoNaoCompensado = gapKwh > 0;
                    const bandeirasCobranca = (fatura.tipo_gd === 'GDI' || temConsumoNaoCompensado) ? bandeiras : 0;

                    let totalCobranca = energiaComDesconto + energiaExcedenteValor + iluminacao + valorOutros + bandeirasCobranca;
                    if (fatura.tipo_gd === 'GDII') {
                        totalCobranca += disponibilidade;
                    } else {
                        totalCobranca += taxaMinimaValor;
                    }

                    const economiaMes = energiaSemDesconto - energiaComDesconto;
                    const saldoAcumulado = dados?.quadro_atencao?.saldo_acumulado || 0;
                    const aExpirar = dados?.quadro_atencao?.a_expirar_proximo_ciclo || 0;

                    return (
                        <tr>
                            <td colSpan={6} className="px-4 py-4 bg-slate-50 dark:bg-slate-800/50">
                                <div className="space-y-4">
                                    {/* ==================== SECAO 1: CLIENTE CONTRATANTE ==================== */}
                                    <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                                        <div className="bg-slate-100 dark:bg-slate-900 px-4 py-2 border-b border-slate-200 dark:border-slate-700">
                                            <h5 className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                                <User size={16} />
                                                Cliente Contratante
                                            </h5>
                                        </div>
                                        <div className="p-4 bg-white dark:bg-slate-800">
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                                <div>
                                                    <span className="text-slate-500 block text-xs">Nome</span>
                                                    <span className="font-medium">{fatura.beneficiario?.nome || '-'}</span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-500 block text-xs">CPF</span>
                                                    <span className="font-medium">{fatura.beneficiario?.cpf || '-'}</span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-500 block text-xs">Email</span>
                                                    <span className="font-medium text-xs">{fatura.beneficiario?.email || '-'}</span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-500 block text-xs">Telefone</span>
                                                    <span className="font-medium">{fatura.beneficiario?.telefone || '-'}</span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-500 block text-xs">UC</span>
                                                    <span className="font-medium">{fatura.uc_formatada}</span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-500 block text-xs">Usina</span>
                                                    <span className="font-medium">{fatura.usina?.nome || '-'}</span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-500 block text-xs">Tipo GD</span>
                                                    <span className={`font-medium ${fatura.tipo_gd === 'GDII' ? 'text-purple-600' : 'text-blue-600'}`}>
                                                        {fatura.tipo_gd || '-'}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-500 block text-xs">Tipo Ligacao</span>
                                                    <span className="font-medium">{fatura.tipo_ligacao || '-'}</span>
                                                </div>
                                            </div>
                                            {fatura.endereco_uc && (
                                                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                                                    <span className="text-slate-500 text-xs">Endereco da UC: </span>
                                                    <span className="text-sm font-medium">{fatura.endereco_uc}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* ==================== SECAO 2: COMPARACAO API vs EXTRACAO ==================== */}
                                    {['EXTRAIDA', 'COBRANCA_RASCUNHO', 'COBRANCA_EMITIDA', 'COBRANCA_PAGA', 'FATURA_QUITADA'].includes(fatura.status_fluxo) && (
                                        <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                                            <div className="bg-slate-100 dark:bg-slate-900 px-4 py-2 border-b border-slate-200 dark:border-slate-700">
                                                <h5 className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                                    <BarChart3 size={16} />
                                                    Comparacao API vs Extracao
                                                    {fatura.extracao_score !== undefined && (
                                                        <span className={`ml-auto text-xs px-2 py-0.5 rounded ${
                                                            fatura.extracao_score >= 80 ? 'bg-green-100 text-green-700' :
                                                            fatura.extracao_score >= 50 ? 'bg-yellow-100 text-yellow-700' :
                                                            'bg-red-100 text-red-700'
                                                        }`}>
                                                            Score: {fatura.extracao_score}%
                                                        </span>
                                                    )}
                                                </h5>
                                            </div>
                                            <div className="p-4 bg-white dark:bg-slate-800">
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="border-b border-slate-200 dark:border-slate-700">
                                                            <th className="text-left py-2 font-medium text-slate-600 dark:text-slate-400">Campo</th>
                                                            <th className="text-center py-2 font-medium text-slate-600 dark:text-slate-400">API (Energisa)</th>
                                                            <th className="text-center py-2 font-medium text-slate-600 dark:text-slate-400">Extracao (PDF)</th>
                                                            <th className="text-center py-2 font-medium text-slate-600 dark:text-slate-400 w-16">Status</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        <tr className="border-b border-slate-100 dark:border-slate-800">
                                                            <td className="py-2 text-slate-700 dark:text-slate-300">Valor Fatura</td>
                                                            <td className="py-2 text-center">{formatCurrency(dadosApi?.valor_fatura || fatura.valor_fatura)}</td>
                                                            <td className="py-2 text-center">{formatCurrency(dados?.totais?.total_geral_fatura || dados?.total_a_pagar)}</td>
                                                            <td className="py-2 text-center">{renderStatusIndicador(compararValores(fatura.valor_fatura, dados?.totais?.total_geral_fatura, 0.02))}</td>
                                                        </tr>
                                                        <tr className="border-b border-slate-100 dark:border-slate-800">
                                                            <td className="py-2 text-slate-700 dark:text-slate-300">Consumo Bruto</td>
                                                            <td className="py-2 text-center">{leituraAtualApi && leituraAnteriorApi ? `${leituraAtualApi - leituraAnteriorApi} kWh` : '-'}</td>
                                                            <td className="py-2 text-center">{consumoKwh ? `${consumoKwh} kWh` : '-'}</td>
                                                            <td className="py-2 text-center">{renderStatusIndicador(compararValores(leituraAtualApi && leituraAnteriorApi ? leituraAtualApi - leituraAnteriorApi : null, consumoKwh))}</td>
                                                        </tr>
                                                        <tr className="border-b border-slate-100 dark:border-slate-800">
                                                            <td className="py-2 text-slate-700 dark:text-slate-300">Consumo Faturado</td>
                                                            <td className="py-2 text-center">{consumoApi ? `${consumoApi} kWh` : '-'}</td>
                                                            <td className="py-2 text-center">{`${Math.max(0, consumoKwh - injetadaTotalKwh).toFixed(0)} kWh`}</td>
                                                            <td className="py-2 text-center">{renderStatusIndicador(compararValores(consumoApi, Math.max(0, consumoKwh - injetadaTotalKwh)))}</td>
                                                        </tr>
                                                        <tr className="border-b border-slate-100 dark:border-slate-800">
                                                            <td className="py-2 text-slate-700 dark:text-slate-300">Bandeira</td>
                                                            <td className="py-2 text-center">
                                                                {bandeiraApi ? (
                                                                    <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${
                                                                        bandeiraApi.toLowerCase().includes('verde') ? 'bg-green-100 text-green-700' :
                                                                        bandeiraApi.toLowerCase().includes('amarela') ? 'bg-yellow-100 text-yellow-700' :
                                                                        'bg-red-100 text-red-700'
                                                                    }`}>{bandeiraApi.toLowerCase()}</span>
                                                                ) : '-'}
                                                            </td>
                                                            <td className="py-2 text-center">
                                                                {dados?.bandeira_tarifaria ? (
                                                                    <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${
                                                                        dados.bandeira_tarifaria.toLowerCase().includes('verde') ? 'bg-green-100 text-green-700' :
                                                                        dados.bandeira_tarifaria.toLowerCase().includes('amarela') ? 'bg-yellow-100 text-yellow-700' :
                                                                        'bg-red-100 text-red-700'
                                                                    }`}>{dados.bandeira_tarifaria.toLowerCase()}</span>
                                                                ) : '-'}
                                                            </td>
                                                            <td className="py-2 text-center">{renderStatusIndicador(compararStrings(bandeiraApi, dados?.bandeira_tarifaria))}</td>
                                                        </tr>
                                                        <tr className="border-b border-slate-100 dark:border-slate-800">
                                                            <td className="py-2 text-slate-700 dark:text-slate-300">Leituras</td>
                                                            <td className="py-2 text-center">{leituraAnteriorApi && leituraAtualApi ? `${leituraAnteriorApi} → ${leituraAtualApi}` : '-'}</td>
                                                            <td className="py-2 text-center">{dados?.leitura_anterior && dados?.leitura_atual ? `${dados.leitura_anterior} → ${dados.leitura_atual}` : '-'}</td>
                                                            <td className="py-2 text-center">{renderStatusIndicador(compararValores(leituraAtualApi, dados?.leitura_atual))}</td>
                                                        </tr>
                                                        <tr>
                                                            <td className="py-2 text-slate-700 dark:text-slate-300">Vencimento</td>
                                                            <td className="py-2 text-center">{dataVencimentoApi ? new Date(dataVencimentoApi + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}</td>
                                                            <td className="py-2 text-center">{dados?.vencimento || '-'}</td>
                                                            <td className="py-2 text-center">{renderStatusIndicador(compararDatas(dataVencimentoApi, dados?.vencimento))}</td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    {/* ==================== SECAO 3: RESUMO DA FATURA ==================== */}
                                    {['EXTRAIDA', 'COBRANCA_RASCUNHO', 'COBRANCA_EMITIDA', 'COBRANCA_PAGA', 'FATURA_QUITADA'].includes(fatura.status_fluxo) && dados && (
                                        <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                                            <div className="bg-slate-100 dark:bg-slate-900 px-4 py-2 border-b border-slate-200 dark:border-slate-700">
                                                <h5 className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                                    <FileText size={16} />
                                                    Resumo da Fatura (Composicao Original)
                                                </h5>
                                            </div>
                                            <div className="p-4 bg-white dark:bg-slate-800">
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="border-b border-slate-200 dark:border-slate-700">
                                                            <th className="text-left py-2 font-medium text-slate-600 dark:text-slate-400">Item</th>
                                                            <th className="text-center py-2 font-medium text-slate-600 dark:text-slate-400 w-20">kWh</th>
                                                            <th className="text-center py-2 font-medium text-slate-600 dark:text-slate-400 w-28">Tarifa</th>
                                                            <th className="text-right py-2 font-medium text-slate-600 dark:text-slate-400 w-28">Valor (R$)</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        <tr className="border-b border-slate-100 dark:border-slate-800">
                                                            <td className="py-2 text-slate-700 dark:text-slate-300">Consumo</td>
                                                            <td className="py-2 text-center">{consumoKwh.toFixed(0)}</td>
                                                            <td className="py-2 text-center">{consumoTarifa.toFixed(6)}</td>
                                                            <td className="py-2 text-right font-medium">{formatCurrency(consumoValor)}</td>
                                                        </tr>
                                                        {injetadaTotalKwh > 0 && (
                                                            <tr className="border-b border-slate-100 dark:border-slate-800 bg-red-50 dark:bg-red-900/10">
                                                                <td className="py-2 text-red-700 dark:text-red-400">Creditos GD (oUC + mUC)</td>
                                                                <td className="py-2 text-center text-red-600">-{injetadaTotalKwh.toFixed(0)}</td>
                                                                <td className="py-2 text-center text-red-600">{consumoTarifa.toFixed(6)}</td>
                                                                <td className="py-2 text-right font-medium text-red-600">-{formatCurrency(Math.abs(injetadaTotalValor))}</td>
                                                            </tr>
                                                        )}
                                                        {fatura.tipo_gd === 'GDII' && ajuste && ajuste.valor ? (
                                                            <tr className="border-b border-slate-100 dark:border-slate-800">
                                                                <td className="py-2 text-slate-700 dark:text-slate-300">Ajuste Lei 14.300/22</td>
                                                                <td className="py-2 text-center">{ajuste.quantidade?.toFixed(0) || '-'}</td>
                                                                <td className="py-2 text-center">{ajuste.preco_unit_com_tributos?.toFixed(6) || '-'}</td>
                                                                <td className="py-2 text-right font-medium">{formatCurrency(ajuste.valor)}</td>
                                                            </tr>
                                                        ) : fatura.tipo_gd === 'GDI' ? (
                                                            <tr className="border-b border-slate-100 dark:border-slate-800">
                                                                <td className="py-2 text-slate-700 dark:text-slate-300">Taxa Minima ({tipoLigacao || '-'})</td>
                                                                <td className="py-2 text-center">{taxaMinimaKwh}</td>
                                                                <td className="py-2 text-center">{consumoTarifa.toFixed(6)}</td>
                                                                <td className="py-2 text-right font-medium">{formatCurrency(taxaMinimaValor)}</td>
                                                            </tr>
                                                        ) : null}
                                                        {bandeirasDetalhamento.length > 0 ? (
                                                            bandeirasDetalhamento.map((b, idx) => (
                                                                <tr key={`band-${idx}`} className="border-b border-slate-100 dark:border-slate-800">
                                                                    <td className="py-2 text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                                                        <span className={`w-2 h-2 rounded-full ${
                                                                            b.cor?.toLowerCase() === 'verde' ? 'bg-green-500' :
                                                                            b.cor?.toLowerCase() === 'amarela' ? 'bg-yellow-500' : 'bg-red-500'
                                                                        }`}></span>
                                                                        Bandeira {b.cor}
                                                                    </td>
                                                                    <td className="py-2 text-center">-</td>
                                                                    <td className="py-2 text-center">-</td>
                                                                    <td className="py-2 text-right font-medium">{formatCurrency(b.valor || 0)}</td>
                                                                </tr>
                                                            ))
                                                        ) : bandeiras > 0 ? (
                                                            <tr className="border-b border-slate-100 dark:border-slate-800">
                                                                <td className="py-2 text-slate-700 dark:text-slate-300">Bandeiras Tarifarias</td>
                                                                <td className="py-2 text-center">-</td>
                                                                <td className="py-2 text-center">-</td>
                                                                <td className="py-2 text-right font-medium">{formatCurrency(bandeiras)}</td>
                                                            </tr>
                                                        ) : null}
                                                        {iluminacao > 0 && (
                                                            <tr className="border-b border-slate-100 dark:border-slate-800">
                                                                <td className="py-2 text-slate-700 dark:text-slate-300">Iluminacao Publica</td>
                                                                <td className="py-2 text-center">-</td>
                                                                <td className="py-2 text-center">-</td>
                                                                <td className="py-2 text-right font-medium">{formatCurrency(iluminacao)}</td>
                                                            </tr>
                                                        )}
                                                        {outrosServicos.map((item, idx) => (
                                                            <tr key={`outros-${idx}`} className="border-b border-slate-100 dark:border-slate-800">
                                                                <td className="py-2 text-slate-700 dark:text-slate-300">{item.descricao || 'Outros'}</td>
                                                                <td className="py-2 text-center">-</td>
                                                                <td className="py-2 text-center">-</td>
                                                                <td className="py-2 text-right font-medium">{formatCurrency(item.valor || 0)}</td>
                                                            </tr>
                                                        ))}
                                                        <tr className="bg-slate-100 dark:bg-slate-800 font-bold">
                                                            <td className="py-2 text-slate-900 dark:text-white" colSpan={3}>TOTAL DA FATURA</td>
                                                            <td className="py-2 text-right text-slate-900 dark:text-white">{formatCurrency(totalFatura)}</td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    {/* ==================== SECAO 4: PREVIA DA COBRANCA ==================== */}
                                    {['EXTRAIDA', 'COBRANCA_RASCUNHO', 'COBRANCA_EMITIDA', 'COBRANCA_PAGA', 'FATURA_QUITADA'].includes(fatura.status_fluxo) && dados && (
                                        <div className="border-2 border-indigo-200 dark:border-indigo-800 rounded-lg overflow-hidden">
                                            <div className="bg-indigo-50 dark:bg-indigo-900/20 px-4 py-2 border-b border-indigo-200 dark:border-indigo-800">
                                                <h5 className="text-sm font-medium text-indigo-700 dark:text-indigo-400 flex items-center gap-2">
                                                    <Receipt size={16} />
                                                    Previa da Cobranca (Com Desconto 30%)
                                                </h5>
                                            </div>
                                            <div className="p-4 bg-white dark:bg-slate-800">
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="border-b border-slate-200 dark:border-slate-700">
                                                            <th className="text-left py-2 font-medium text-slate-600 dark:text-slate-400">Item</th>
                                                            <th className="text-center py-2 font-medium text-slate-600 dark:text-slate-400 w-20">kWh</th>
                                                            <th className="text-center py-2 font-medium text-slate-600 dark:text-slate-400 w-28">Tarifa</th>
                                                            <th className="text-right py-2 font-medium text-slate-600 dark:text-slate-400 w-28">Valor (R$)</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        <tr className="border-b border-slate-100 dark:border-slate-800 bg-green-50 dark:bg-green-900/10">
                                                            <td className="py-2 text-green-700 dark:text-green-400">Energia GD (30% desc.)</td>
                                                            <td className="py-2 text-center text-green-600">{injetadaTotalKwh.toFixed(0)}</td>
                                                            <td className="py-2 text-center text-green-600">{(tarifaBase * 0.70).toFixed(6)}</td>
                                                            <td className="py-2 text-right font-medium text-green-600">{formatCurrency(energiaComDesconto)}</td>
                                                        </tr>
                                                        {gapKwh > 0 && (
                                                            <tr className="border-b border-slate-100 dark:border-slate-800 bg-orange-50 dark:bg-orange-900/10">
                                                                <td className="py-2 text-orange-700 dark:text-orange-400">Energia Excedente (nao compensada)</td>
                                                                <td className="py-2 text-center text-orange-600">{gapKwh.toFixed(0)}</td>
                                                                <td className="py-2 text-center text-orange-600">{tarifaBase.toFixed(6)}</td>
                                                                <td className="py-2 text-right font-medium text-orange-600">{formatCurrency(energiaExcedenteValor)}</td>
                                                            </tr>
                                                        )}
                                                        {fatura.tipo_gd === 'GDII' && disponibilidade > 0 ? (
                                                            <tr className="border-b border-slate-100 dark:border-slate-800">
                                                                <td className="py-2 text-slate-700 dark:text-slate-300">Disponibilidade (Lei 14.300)</td>
                                                                <td className="py-2 text-center">{ajuste?.quantidade?.toFixed(0) || '-'}</td>
                                                                <td className="py-2 text-center">{ajuste?.preco_unit_com_tributos?.toFixed(6) || '-'}</td>
                                                                <td className="py-2 text-right font-medium">{formatCurrency(disponibilidade)}</td>
                                                            </tr>
                                                        ) : fatura.tipo_gd === 'GDI' ? (
                                                            <tr className="border-b border-slate-100 dark:border-slate-800">
                                                                <td className="py-2 text-slate-700 dark:text-slate-300">Taxa Minima ({tipoLigacao || '-'})</td>
                                                                <td className="py-2 text-center">{taxaMinimaKwh}</td>
                                                                <td className="py-2 text-center">{tarifaBase.toFixed(6)}</td>
                                                                <td className="py-2 text-right font-medium">{formatCurrency(taxaMinimaValor)}</td>
                                                            </tr>
                                                        ) : null}
                                                        {bandeirasCobranca > 0 && (
                                                            <tr className="border-b border-slate-100 dark:border-slate-800">
                                                                <td className="py-2 text-slate-700 dark:text-slate-300">Bandeiras Tarifarias</td>
                                                                <td className="py-2 text-center">-</td>
                                                                <td className="py-2 text-center">-</td>
                                                                <td className="py-2 text-right font-medium">{formatCurrency(bandeirasCobranca)}</td>
                                                            </tr>
                                                        )}
                                                        {iluminacao > 0 && (
                                                            <tr className="border-b border-slate-100 dark:border-slate-800">
                                                                <td className="py-2 text-slate-700 dark:text-slate-300">Iluminacao Publica</td>
                                                                <td className="py-2 text-center">-</td>
                                                                <td className="py-2 text-center">-</td>
                                                                <td className="py-2 text-right font-medium">{formatCurrency(iluminacao)}</td>
                                                            </tr>
                                                        )}
                                                        {outrosServicos.map((item, idx) => (
                                                            <tr key={`outros-cob-${idx}`} className="border-b border-slate-100 dark:border-slate-800">
                                                                <td className="py-2 text-slate-700 dark:text-slate-300">{item.descricao || 'Outros'}</td>
                                                                <td className="py-2 text-center">-</td>
                                                                <td className="py-2 text-center">-</td>
                                                                <td className="py-2 text-right font-medium">{formatCurrency(item.valor || 0)}</td>
                                                            </tr>
                                                        ))}
                                                        <tr className="bg-indigo-100 dark:bg-indigo-900/30 font-bold">
                                                            <td className="py-2 text-indigo-900 dark:text-indigo-200" colSpan={3}>TOTAL DA COBRANCA</td>
                                                            <td className="py-2 text-right text-indigo-900 dark:text-indigo-200">{formatCurrency(totalCobranca)}</td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    {/* ==================== SECAO 5: RESUMO GD (ECONOMIA) ==================== */}
                                    {['EXTRAIDA', 'COBRANCA_RASCUNHO', 'COBRANCA_EMITIDA', 'COBRANCA_PAGA', 'FATURA_QUITADA'].includes(fatura.status_fluxo) && dados && (
                                        <div className="border border-emerald-200 dark:border-emerald-800 rounded-lg overflow-hidden">
                                            <div className="bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2 border-b border-emerald-200 dark:border-emerald-800">
                                                <h5 className="text-sm font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                                                    <TrendingUp size={16} />
                                                    Resumo GD (Economia)
                                                </h5>
                                            </div>
                                            <div className="p-4 bg-white dark:bg-slate-800 space-y-4">
                                                <div>
                                                    <p className="text-xs text-slate-500 mb-2 font-medium">Economia do Mes (Energia Injetada)</p>
                                                    <div className="grid grid-cols-3 gap-3">
                                                        <div className="bg-slate-100 dark:bg-slate-700 rounded-lg p-3 text-center">
                                                            <p className="text-xs text-slate-500 mb-1">Sem Assinatura</p>
                                                            <p className="font-bold text-slate-700 dark:text-slate-300">{formatCurrency(energiaSemDesconto)}</p>
                                                        </div>
                                                        <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-3 text-center">
                                                            <p className="text-xs text-green-600 mb-1">Com Assinatura (30% desc.)</p>
                                                            <p className="font-bold text-green-700 dark:text-green-400">{formatCurrency(energiaComDesconto)}</p>
                                                        </div>
                                                        <div className="bg-emerald-100 dark:bg-emerald-900/30 rounded-lg p-3 text-center">
                                                            <p className="text-xs text-emerald-600 mb-1">Economia</p>
                                                            <p className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center justify-center gap-1">
                                                                {formatCurrency(economiaMes)}
                                                                <CheckCircle size={14} className="text-emerald-500" />
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                                {(saldoAcumulado > 0 || aExpirar > 0) && (
                                                    <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                                                        <p className="text-xs text-slate-500 mb-2 font-medium">Informacoes de Credito</p>
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                                                                <span className="text-sm text-slate-600 dark:text-slate-400">Saldo Acumulado:</span>
                                                                <span className="font-medium text-slate-900 dark:text-white">{saldoAcumulado.toLocaleString('pt-BR')} kWh</span>
                                                            </div>
                                                            <div className="flex items-center justify-between bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3">
                                                                <span className="text-sm text-orange-600 dark:text-orange-400">A Expirar:</span>
                                                                <span className="font-medium text-orange-700 dark:text-orange-300">{aExpirar.toLocaleString('pt-BR')} kWh</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* ==================== SECAO 6: COBRANCA EXISTENTE ==================== */}
                                    {['COBRANCA_RASCUNHO', 'COBRANCA_EMITIDA', 'COBRANCA_PAGA', 'FATURA_QUITADA'].includes(fatura.status_fluxo) && fatura.cobranca && (
                                        <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                            <div className="flex items-center justify-between mb-3">
                                                <h5 className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-2">
                                                    <CreditCard size={16} />
                                                    Cobranca #{fatura.cobranca.id}
                                                </h5>
                                                <button
                                                    onClick={() => navigate('/app/gestor/cobrancas')}
                                                    className="text-xs px-3 py-1.5 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 flex items-center gap-1.5"
                                                >
                                                    <ExternalLink size={14} />
                                                    Gerenciar Cobranca
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                                <div>
                                                    <span className="text-slate-500 block text-xs">Status</span>
                                                    <span className={`font-medium px-2 py-0.5 rounded inline-block mt-1 ${
                                                        fatura.cobranca.status === 'PAGA' ? 'bg-green-100 text-green-700' :
                                                        fatura.cobranca.status === 'EMITIDA' ? 'bg-orange-100 text-orange-700' :
                                                        'bg-purple-100 text-purple-700'
                                                    }`}>
                                                        {fatura.cobranca.status}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-500 block text-xs">Valor Total</span>
                                                    <span className="font-bold text-lg text-slate-900 dark:text-white">{formatCurrency(fatura.cobranca.valor_total)}</span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-500 block text-xs">Vencimento</span>
                                                    <span className="font-medium">{new Date(fatura.cobranca.vencimento).toLocaleDateString('pt-BR')}</span>
                                                </div>
                                                {fatura.cobranca.pago_em && (
                                                    <div>
                                                        <span className="text-slate-500 block text-xs">Pago em</span>
                                                        <span className="font-medium text-green-600">{new Date(fatura.cobranca.pago_em).toLocaleDateString('pt-BR')}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* ==================== ACOES SECUNDARIAS (correcao/retrabalho) ==================== */}
                                    {['PDF_RECEBIDO', 'EXTRAIDA', 'COBRANCA_RASCUNHO'].includes(fatura.status_fluxo) && (
                                        <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
                                            <span className="text-xs text-slate-500 dark:text-slate-400 w-full mb-1">Acoes de correcao:</span>
                                            {fatura.status_fluxo === 'PDF_RECEBIDO' && (
                                                <button
                                                    onClick={() => handleExtrair(fatura.id)}
                                                    disabled={isLoading}
                                                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
                                                >
                                                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                                                    Extrair Dados
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleRefazer(fatura.id)}
                                                disabled={isLoading}
                                                className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 flex items-center gap-2"
                                            >
                                                {isLoading ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                                                Refazer
                                            </button>
                                            {['EXTRAIDA', 'COBRANCA_RASCUNHO'].includes(fatura.status_fluxo) && (
                                                <button
                                                    onClick={() => handleReprocessar(fatura.id)}
                                                    disabled={isLoading}
                                                    className="px-4 py-2 border border-amber-300 dark:border-amber-600 text-amber-600 dark:text-amber-400 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 disabled:opacity-50 flex items-center gap-2"
                                                >
                                                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
                                                    Reprocessar
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </td>
                        </tr>
                    );
                })()}
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
