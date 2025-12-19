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
    TrendingUp,
    Pencil,
    Info,
    CheckCircle
} from 'lucide-react';
import { faturasApi } from '../../api/faturas';
import { cobrancasApi, type Cobranca } from '../../api/cobrancas';

// ========================
// Types
// ========================

// Interface para períodos de bandeira
interface PeriodoBandeira {
    bandeira: string;
    data_inicio: string;
    data_fim: string;
    dias: number;
    consumo_proporcional: number;
    valor_kwh: number;
    valor_sem_impostos: number;
}

// Interface para previsão de bandeira
interface BandeiraPrevista {
    valor_total: number;
    valor_sem_impostos: number;
    periodos: PeriodoBandeira[];
}

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
    dados_extraidos: DadosExtraidos | null;
    dados_api?: Record<string, any> | null;
    dados_extraidos_editados?: Record<string, any> | null;
    tem_pdf: boolean;
    // Campos de energia (vindos do backend)
    consumo_kwh?: number;
    injetada_kwh?: number;
    injetada_ouc?: number;
    injetada_muc?: number;
    tipo_gd?: string;
    tipo_ligacao?: string;
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
    // Campos extraídos do PDF (bandeira)
    bandeira_extraida?: number;
    bandeira_tarifaria_pdf?: string;
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
    // Previsão de bandeira calculada pelo backend
    bandeira_prevista?: BandeiraPrevista | null;
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

// Interface para item de energia injetada
interface EnergiaInjetadaItem {
    descricao?: string;
    tipo_gd?: string;
    quantidade?: number;
    preco_unit_com_tributos?: number;
    valor?: number;
    valor_total?: number;
    mes_ano_referencia_item?: string;
}

// Interface para lançamento/serviço
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
    leitura_anterior_data?: string;
    leitura_atual_data?: string;
    proxima_leitura_data?: string;
    dias?: number;
    itens_fatura?: {
        consumo_kwh?: {
            quantidade?: number;
            preco_unit_com_tributos?: number;
            valor?: number;
            valor_total?: number;
        };
        // Suporta ambos os formatos de chave (espaço e underscore)
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
        bandeiras_detalhamento?: Array<{
            cor?: 'VERDE' | 'AMARELA' | 'VERMELHA' | string;
            valor?: number;
        }>;
        lancamentos_e_servicos?: number;
        total_geral_fatura?: number;
    };
    bandeira_tarifaria?: string;
    quadro_atencao?: {
        saldo_acumulado?: number;
        a_expirar_proximo_ciclo?: number;
    };
}

// Tipos para validação de campos
type ValidacaoStatus = 'OK' | 'DIFERENTE' | 'AUSENTE' | 'INFO';

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
    AUSENTE: { color: 'text-red-600', bgColor: 'bg-red-50 dark:bg-red-900/20', icon: XCircle },
    INFO: { color: 'text-blue-600', bgColor: 'bg-blue-50 dark:bg-blue-900/20', icon: Info }
};

// ===========================================
// Helpers para acessar dados de energia injetada
// Suporta ambos os formatos de chave: espaço e underscore
// ===========================================

// Pega items de energia injetada oUC
const getEnergiaInjetadaOUC = (itens: DadosExtraidos['itens_fatura']): EnergiaInjetadaItem[] => {
    if (!itens) return [];
    // Tenta primeiro com espaço (formato do backend), depois com underscore
    return itens['energia_injetada oUC'] || itens.energia_injetada_ouc || [];
};

// Pega items de energia injetada mUC
const getEnergiaInjetadaMUC = (itens: DadosExtraidos['itens_fatura']): EnergiaInjetadaItem[] => {
    if (!itens) return [];
    return itens['energia_injetada mUC'] || itens.energia_injetada_muc || [];
};

// Calcula total de kWh injetados (oUC)
const calcularInjetadaOUC = (itens: DadosExtraidos['itens_fatura']): number => {
    return getEnergiaInjetadaOUC(itens).reduce((sum, item) => sum + Math.abs(item.quantidade || 0), 0);
};

// Calcula total de kWh injetados (mUC)
const calcularInjetadaMUC = (itens: DadosExtraidos['itens_fatura']): number => {
    return getEnergiaInjetadaMUC(itens).reduce((sum, item) => sum + Math.abs(item.quantidade || 0), 0);
};

// Calcula valor total de injetada (oUC)
const calcularValorInjetadaOUC = (itens: DadosExtraidos['itens_fatura']): number => {
    return getEnergiaInjetadaOUC(itens).reduce(
        (sum, item) => sum + Math.abs(item.valor || item.valor_total || 0), 0
    );
};

// Calcula valor total de injetada (mUC)
const calcularValorInjetadaMUC = (itens: DadosExtraidos['itens_fatura']): number => {
    return getEnergiaInjetadaMUC(itens).reduce(
        (sum, item) => sum + Math.abs(item.valor || item.valor_total || 0), 0
    );
};

// Filtra lançamentos (exclui iluminação pública e duplicatas)
const getLancamentosSemIluminacao = (itens: DadosExtraidos['itens_fatura']): LancamentoServico[] => {
    if (!itens?.lancamentos_e_servicos) return [];

    // Primeiro encontra o valor de iluminação para detectar duplicatas
    const ilumItem = itens.lancamentos_e_servicos.find(
        s => s.descricao?.toLowerCase().includes('ilum')
    );
    const valorIlum = Number(ilumItem?.valor) || 0;

    return itens.lancamentos_e_servicos.filter(s => {
        const desc = s.descricao?.toLowerCase() || '';
        const valorItem = Number(s.valor) || 0;

        // Excluir iluminação pública
        if (desc.includes('ilum')) return false;

        // Excluir bandeiras (já são contabilizadas separadamente)
        if (desc.includes('bandeira') || desc.includes('b. verm') || desc.includes('b. amar') || desc.includes('b. verde')) return false;

        // Excluir "outros serviços" se valor for igual (ou muito próximo) ao de iluminação
        // Verifica múltiplas variações: "outros", "serviço", "servico", "serviços", "servicos"
        const isOutrosServicos = desc.includes('outros') ||
                                 desc.includes('servi') ||  // Captura serviço, servico, serviços, servicos
                                 desc === '';  // Descrição vazia também é suspeita

        if (isOutrosServicos && valorIlum > 0 && Math.abs(valorItem - valorIlum) < 0.02) {
            return false;
        }

        // Fallback: Se o valor é EXATAMENTE igual ao de iluminação, provavelmente é duplicata
        // (isso pega casos onde a descrição é diferente mas o valor é idêntico)
        if (valorIlum > 0 && valorItem === valorIlum) {
            return false;
        }

        return true;
    });
};

// Pega valor de iluminação pública
const getValorIluminacaoPublica = (itens: DadosExtraidos['itens_fatura']): number => {
    if (!itens?.lancamentos_e_servicos) return 0;
    const ilum = itens.lancamentos_e_servicos.find(
        s => s.descricao?.toLowerCase().includes('ilum')
    );
    return ilum?.valor || 0;
};

// Taxa mínima por tipo de ligação (GD I)
const getTaxaMinima = (tipoLigacao: string | undefined): number => {
    switch (tipoLigacao?.toUpperCase()) {
        case 'MONOFASICO': return 30;
        case 'BIFASICO': return 50;
        case 'TRIFASICO': return 100;
        default: return 0;
    }
};

// ===========================================
// Cálculo de Economia GD (Regras de Negócio)
// ===========================================
// GD1: economia = min(consumo_liquido, injetada) × diferença_tarifa
//      onde consumo_liquido = consumo - taxa_minima
// GD2: economia = injetada × diferença_tarifa
// diferença_tarifa = tarifa_base × 0.30 (30% de desconto)

interface CalculoEconomiaParams {
    consumoKwh: number;
    injetadaKwh: number;
    tipoGd?: string;
    tipoLigacao?: string;
    tarifaBase: number;
}

const calcularEconomiaGD = ({
    consumoKwh,
    injetadaKwh,
    tipoGd,
    tipoLigacao,
    tarifaBase
}: CalculoEconomiaParams): { economia: number; energiaCompensada: number } => {
    // Desconto GD = 30% sobre a tarifa
    const DESCONTO_GD = 0.30;

    // Determinar energia compensada baseado no modelo GD
    let energiaCompensada: number;

    if (tipoGd?.toUpperCase() === 'GDII' || tipoGd?.toUpperCase() === 'GD2') {
        // GD2: toda energia injetada recebe desconto (sem taxa mínima)
        energiaCompensada = injetadaKwh;
    } else {
        // GD1 (default): desconta taxa mínima do consumo
        const taxaMinima = getTaxaMinima(tipoLigacao);
        const consumoLiquido = Math.max(0, consumoKwh - taxaMinima);
        energiaCompensada = Math.min(consumoLiquido, injetadaKwh);
    }

    // Economia = energia compensada × (tarifa_base × 30%)
    const economia = energiaCompensada * tarifaBase * DESCONTO_GD;

    return { economia, energiaCompensada };
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
        if (!dados?.itens_fatura) return 0;
        return calcularInjetadaOUC(dados.itens_fatura) + calcularInjetadaMUC(dados.itens_fatura);
    };

    // Função detectarModeloGD removida - agora usa fatura.tipo_gd do backend (unificado)

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
    calcularInjetadaTotal
}: FaturaAccordionItemProps) {
    const dados = fatura.dados_extraidos as DadosExtraidos;
    const isLoading = loadingAction === fatura.id || loadingAction === fatura.cobranca?.id;

    // Estado para campos editáveis
    const [editMode, setEditMode] = useState(false);
    const [camposEditados, setCamposEditados] = useState<CamposEditaveis>({});
    const [salvando, setSalvando] = useState(false);

    // Inicializar campos editados com valores extraídos (usando helpers)
    useEffect(() => {
        if (dados && isExpanded) {
            setCamposEditados({
                consumo_kwh: dados.itens_fatura?.consumo_kwh?.quantidade || 0,
                injetada_ouc_kwh: calcularInjetadaOUC(dados.itens_fatura),
                injetada_muc_kwh: calcularInjetadaMUC(dados.itens_fatura)
            });
        }
    }, [dados, isExpanded]);

    // Função para renderizar indicador de status
    const renderStatusIndicador = (status: ValidacaoStatus) => {
        const config = statusConfig[status];
        const Icon = config.icon;
        const labels: Record<ValidacaoStatus, string> = {
            OK: 'OK',
            DIFERENTE: 'Divergente',
            AUSENTE: 'N/A',
            INFO: 'Info'
        };
        return (
            <span className={`inline-flex items-center gap-1 text-xs ${config.color}`} title={
                status === 'INFO' ? 'Métricas diferentes (API = líquido, PDF = bruto)' : undefined
            }>
                <Icon size={14} />
                {labels[status]}
            </span>
        );
    };

    // Calcular economia simulada com valores editados (usando lógica GD correta)
    const calcularEconomiaSimulada = () => {
        const consumoKwh = fatura.consumo_kwh || dados?.itens_fatura?.consumo_kwh?.quantidade || 0;
        const injetadaKwh = (camposEditados.injetada_ouc_kwh || 0) + (camposEditados.injetada_muc_kwh || 0);
        const tarifaBase = dados?.itens_fatura?.consumo_kwh?.preco_unit_com_tributos || 0.85;

        const { economia } = calcularEconomiaGD({
            consumoKwh,
            injetadaKwh,
            tipoGd: fatura.tipo_gd,
            tipoLigacao: fatura.tipo_ligacao,
            tarifaBase
        });
        return economia;
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
                            SEÇÕES REESTRUTURADAS: 5 Seções Organizadas
                        ======================================== */}
                        {activeTab === 'extraida' && (
                            <div className="space-y-4">
                                {/* Header com Score, Modelo GD e Referência */}
                                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-slate-500">Score:</span>
                                            <div className="w-20 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                <div className={`h-full rounded-full ${(fatura.extracao_score || 0) >= 90 ? 'bg-green-500' : (fatura.extracao_score || 0) >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${fatura.extracao_score || 0}%` }} />
                                            </div>
                                            <span className={`text-xs font-bold ${(fatura.extracao_score || 0) >= 90 ? 'text-green-600' : (fatura.extracao_score || 0) >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>{fatura.extracao_score || 0}%</span>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${fatura.tipo_gd === 'GDII' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'}`}>
                                            {fatura.tipo_gd === 'GDII' ? 'GD II' : fatura.tipo_gd === 'GDI' ? 'GD I' : 'GD ?'}
                                        </span>
                                        {(fatura.tipo_ligacao || dados?.ligacao) && (
                                            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full text-xs">
                                                {fatura.tipo_ligacao || dados?.ligacao}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-right text-xs">
                                        <span className="text-slate-500">Ref: </span>
                                        <span className="font-medium">{dados?.mes_ano_referencia || `${fatura.mes_referencia}/${fatura.ano_referencia}`}</span>
                                    </div>
                                </div>

                                {/* ==================== SEÇÃO 1: CLIENTE CONTRATANTE ==================== */}
                                <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                                    <div className="bg-slate-50 dark:bg-slate-900 px-4 py-2 border-b border-slate-200 dark:border-slate-700">
                                        <h5 className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                            <User size={16} />
                                            Cliente Contratante
                                        </h5>
                                    </div>
                                    <div className="p-4">
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                            <div>
                                                <span className="text-slate-500 block text-xs">Nome</span>
                                                <span className="font-medium">{fatura.cliente?.nome || fatura.beneficiario?.nome || 'N/A'}</span>
                                            </div>
                                            <div>
                                                <span className="text-slate-500 block text-xs">CPF/CNPJ</span>
                                                <span className="font-medium">{fatura.cliente?.cpf || 'N/A'}</span>
                                            </div>
                                            <div>
                                                <span className="text-slate-500 block text-xs">Email</span>
                                                <span className="font-medium text-xs">{fatura.cliente?.email || 'N/A'}</span>
                                            </div>
                                            <div>
                                                <span className="text-slate-500 block text-xs">Telefone</span>
                                                <span className="font-medium">{fatura.cliente?.telefone || 'N/A'}</span>
                                            </div>
                                            <div>
                                                <span className="text-slate-500 block text-xs">UC</span>
                                                <span className="font-medium">{fatura.uc_formatada}</span>
                                            </div>
                                            <div>
                                                <span className="text-slate-500 block text-xs">Usina</span>
                                                <span className="font-medium">{fatura.usina_nome || 'N/A'}</span>
                                            </div>
                                            <div>
                                                <span className="text-slate-500 block text-xs">Cliente desde</span>
                                                <span className="font-medium">{fatura.cliente?.convertido_em ? new Date(fatura.cliente.convertido_em).toLocaleDateString('pt-BR') : 'N/A'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* ==================== SEÇÃO 2: COMPARAÇÃO API vs EXTRAÇÃO ==================== */}
                                <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                                    <div className="bg-slate-50 dark:bg-slate-900 px-4 py-2 border-b border-slate-200 dark:border-slate-700">
                                        <h5 className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                            <BarChart3 size={16} />
                                            Comparacao API vs Extracao
                                        </h5>
                                    </div>
                                    <div className="p-4">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-slate-200 dark:border-slate-700">
                                                    <th className="text-left py-2 font-medium text-slate-600 dark:text-slate-400">Campo</th>
                                                    <th className="text-center py-2 font-medium text-slate-600 dark:text-slate-400">API (Energisa)</th>
                                                    <th className="text-center py-2 font-medium text-slate-600 dark:text-slate-400">Extracao (PDF)</th>
                                                    <th className="text-center py-2 font-medium text-slate-600 dark:text-slate-400 w-20">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr className="border-b border-slate-100 dark:border-slate-800">
                                                    <td className="py-2 text-slate-700 dark:text-slate-300">Valor Fatura</td>
                                                    <td className="py-2 text-center">{formatarMoeda(fatura.valor_fatura)}</td>
                                                    <td className="py-2 text-center">{formatarMoeda(dados?.totais?.total_geral_fatura)}</td>
                                                    <td className="py-2 text-center">{renderStatusIndicador(compararValores(fatura.valor_fatura, dados?.totais?.total_geral_fatura, 0.02))}</td>
                                                </tr>
                                                <tr className="border-b border-slate-100 dark:border-slate-800">
                                                    <td className="py-2 text-slate-700 dark:text-slate-300">Consumo Bruto</td>
                                                    <td className="py-2 text-center">{fatura.leitura_atual && fatura.leitura_anterior ? `${fatura.leitura_atual - fatura.leitura_anterior} kWh` : 'N/A'}</td>
                                                    <td className="py-2 text-center">{dados?.itens_fatura?.consumo_kwh?.quantidade ? `${dados.itens_fatura.consumo_kwh.quantidade} kWh` : 'N/A'}</td>
                                                    <td className="py-2 text-center">{renderStatusIndicador(compararValores(fatura.leitura_atual && fatura.leitura_anterior ? fatura.leitura_atual - fatura.leitura_anterior : null, dados?.itens_fatura?.consumo_kwh?.quantidade))}</td>
                                                </tr>
                                                <tr className="border-b border-slate-100 dark:border-slate-800">
                                                    <td className="py-2 text-slate-700 dark:text-slate-300">Consumo Faturado</td>
                                                    <td className="py-2 text-center">{fatura.consumo_api ? `${fatura.consumo_api} kWh` : 'N/A'}</td>
                                                    <td className="py-2 text-center">{(() => { const consumo = dados?.itens_fatura?.consumo_kwh?.quantidade || 0; const inj = calcularInjetadaOUC(dados?.itens_fatura) + calcularInjetadaMUC(dados?.itens_fatura); return `${Math.max(0, consumo - inj).toFixed(0)} kWh`; })()}</td>
                                                    <td className="py-2 text-center">{renderStatusIndicador('INFO')}</td>
                                                </tr>
                                                <tr className="border-b border-slate-100 dark:border-slate-800">
                                                    <td className="py-2 text-slate-700 dark:text-slate-300">Bandeira</td>
                                                    <td className="py-2 text-center">
                                                        {fatura.bandeira_prevista?.periodos?.length ? fatura.bandeira_prevista.periodos.map((p, i) => <span key={i} className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium mr-1 capitalize ${p.bandeira?.toLowerCase().includes('verde') ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : p.bandeira?.toLowerCase().includes('amarela') ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'}`}>{p.bandeira?.toLowerCase()}</span>) : fatura.bandeira_tarifaria ? <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium capitalize ${fatura.bandeira_tarifaria.toLowerCase().includes('verde') ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : fatura.bandeira_tarifaria.toLowerCase().includes('amarela') ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'}`}>{fatura.bandeira_tarifaria.toLowerCase()}</span> : 'N/A'}
                                                    </td>
                                                    <td className="py-2 text-center">
                                                        {dados?.totais?.bandeiras_detalhamento?.length ? dados.totais.bandeiras_detalhamento.map((b: {cor?: string; valor?: number}, i: number) => <span key={i} className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium mr-1 capitalize ${b.cor?.toLowerCase() === 'verde' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : b.cor?.toLowerCase() === 'amarela' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'}`}>{b.cor?.toLowerCase()}</span>) : dados?.bandeira_tarifaria ? <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium capitalize ${dados.bandeira_tarifaria.toLowerCase().includes('verde') ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : dados.bandeira_tarifaria.toLowerCase().includes('amarela') ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'}`}>{dados.bandeira_tarifaria.toLowerCase()}</span> : 'N/A'}
                                                    </td>
                                                    <td className="py-2 text-center">{renderStatusIndicador(compararStrings(fatura.bandeira_tarifaria, dados?.bandeira_tarifaria))}</td>
                                                </tr>
                                                <tr className="border-b border-slate-100 dark:border-slate-800">
                                                    <td className="py-2 text-slate-700 dark:text-slate-300">Leituras</td>
                                                    <td className="py-2 text-center">{fatura.leitura_anterior && fatura.leitura_atual ? `${fatura.leitura_anterior} → ${fatura.leitura_atual}` : 'N/A'}</td>
                                                    <td className="py-2 text-center">{dados?.leitura_anterior && dados?.leitura_atual ? `${dados.leitura_anterior} → ${dados.leitura_atual}` : 'N/A'}</td>
                                                    <td className="py-2 text-center">{renderStatusIndicador(compararValores(fatura.leitura_atual, dados?.leitura_atual))}</td>
                                                </tr>
                                                <tr>
                                                    <td className="py-2 text-slate-700 dark:text-slate-300">Vencimento</td>
                                                    <td className="py-2 text-center">{fatura.data_vencimento ? new Date(fatura.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR') : 'N/A'}</td>
                                                    <td className="py-2 text-center">{dados?.vencimento || 'N/A'}</td>
                                                    <td className="py-2 text-center">{renderStatusIndicador(compararDatas(fatura.data_vencimento, dados?.vencimento))}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* ==================== SEÇÃO 3: RESUMO DA FATURA ==================== */}
                                {dados && (() => {
                                    // Cálculos para a tabela de composição da fatura
                                    const consumo = dados?.itens_fatura?.consumo_kwh || {};
                                    const consumoKwh = consumo.quantidade || 0;
                                    const consumoTarifa = consumo.preco_unit_com_tributos || 0;
                                    const consumoValor = consumo.valor || (consumoKwh * consumoTarifa);

                                    // Energia injetada (créditos - valores negativos)
                                    const injetadaOucKwh = calcularInjetadaOUC(dados?.itens_fatura);
                                    const injetadaMucKwh = calcularInjetadaMUC(dados?.itens_fatura);
                                    const injetadaOucValor = calcularValorInjetadaOUC(dados?.itens_fatura);
                                    const injetadaMucValor = calcularValorInjetadaMUC(dados?.itens_fatura);
                                    const injetadaTotalKwh = injetadaOucKwh + injetadaMucKwh;
                                    const injetadaTotalValor = injetadaOucValor + injetadaMucValor;

                                    // Taxa mínima (GDI) ou Ajuste Lei 14.300 (GDII)
                                    const ajuste = dados?.itens_fatura?.ajuste_lei_14300;
                                    const tipoLigacao = fatura.tipo_ligacao || dados?.ligacao;
                                    const taxaMinimaKwh = getTaxaMinima(tipoLigacao);
                                    const taxaMinimaValor = taxaMinimaKwh * consumoTarifa;

                                    // Bandeiras - priorizar detalhamento (soma individual) sobre total
                                    const bandeirasDetalhamento = dados?.totais?.bandeiras_detalhamento || [];
                                    const bandeiras = bandeirasDetalhamento.length > 0
                                        ? bandeirasDetalhamento.reduce((sum: number, b: { valor?: number }) => sum + (b.valor || 0), 0)
                                        : (dados?.totais?.adicionais_bandeira || 0);

                                    // Iluminação pública
                                    const iluminacao = getValorIluminacaoPublica(dados?.itens_fatura) || 0;

                                    // Outros serviços
                                    const outrosServicos = getLancamentosSemIluminacao(dados?.itens_fatura);
                                    const valorOutros = outrosServicos.reduce((s, item) => s + (item.valor || 0), 0);

                                    // Total da fatura
                                    const totalFatura = dados?.totais?.total_geral_fatura || 0;

                                    return (
                                        <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                                            <div className="bg-slate-50 dark:bg-slate-900 px-4 py-2 border-b border-slate-200 dark:border-slate-700">
                                                <h5 className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                                    <FileText size={16} />
                                                    Resumo da Fatura (Composicao Original)
                                                </h5>
                                            </div>
                                            <div className="p-4">
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="border-b border-slate-200 dark:border-slate-700">
                                                            <th className="text-left py-2 font-medium text-slate-600 dark:text-slate-400">Item</th>
                                                            <th className="text-center py-2 font-medium text-slate-600 dark:text-slate-400 w-20">kWh</th>
                                                            <th className="text-center py-2 font-medium text-slate-600 dark:text-slate-400 w-28">Tarifa (R$/kWh)</th>
                                                            <th className="text-right py-2 font-medium text-slate-600 dark:text-slate-400 w-28">Valor (R$)</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {/* Consumo */}
                                                        <tr className="border-b border-slate-100 dark:border-slate-800">
                                                            <td className="py-2 text-slate-700 dark:text-slate-300">Consumo</td>
                                                            <td className="py-2 text-center">{consumoKwh.toFixed(0)}</td>
                                                            <td className="py-2 text-center">{consumoTarifa.toFixed(4)}</td>
                                                            <td className="py-2 text-right font-medium">{formatarMoeda(consumoValor)}</td>
                                                        </tr>
                                                        {/* Créditos GD (energia injetada) - valores negativos */}
                                                        {injetadaTotalKwh > 0 && (
                                                            <tr className="border-b border-slate-100 dark:border-slate-800 bg-red-50 dark:bg-red-900/10">
                                                                <td className="py-2 text-red-700 dark:text-red-400">Creditos GD (oUC + mUC)</td>
                                                                <td className="py-2 text-center text-red-600">-{injetadaTotalKwh.toFixed(0)}</td>
                                                                <td className="py-2 text-center text-red-600">{consumoTarifa.toFixed(4)}</td>
                                                                <td className="py-2 text-right font-medium text-red-600">-{formatarMoeda(Math.abs(injetadaTotalValor))}</td>
                                                            </tr>
                                                        )}
                                                        {/* Taxa Mínima (GDI) ou Ajuste Lei 14.300 (GDII) */}
                                                        {fatura.tipo_gd === 'GDII' && ajuste && ajuste.valor ? (
                                                            <tr className="border-b border-slate-100 dark:border-slate-800">
                                                                <td className="py-2 text-slate-700 dark:text-slate-300">Ajuste Lei 14.300/22 (Fio B)</td>
                                                                <td className="py-2 text-center">{ajuste.quantidade?.toFixed(0) || '-'}</td>
                                                                <td className="py-2 text-center">{ajuste.preco_unit_com_tributos?.toFixed(4) || '-'}</td>
                                                                <td className="py-2 text-right font-medium">{formatarMoeda(ajuste.valor)}</td>
                                                            </tr>
                                                        ) : fatura.tipo_gd === 'GDI' ? (
                                                            <tr className="border-b border-slate-100 dark:border-slate-800">
                                                                <td className="py-2 text-slate-700 dark:text-slate-300">Taxa Minima ({tipoLigacao || 'N/A'})</td>
                                                                <td className="py-2 text-center">{taxaMinimaKwh}</td>
                                                                <td className="py-2 text-center">{consumoTarifa.toFixed(4)}</td>
                                                                <td className="py-2 text-right font-medium">{formatarMoeda(taxaMinimaValor)}</td>
                                                            </tr>
                                                        ) : null}
                                                        {/* Bandeiras - mostrar detalhamento quando disponível */}
                                                        {bandeirasDetalhamento.length > 0 ? (
                                                            bandeirasDetalhamento.map((b: { cor?: string; valor?: number }, idx: number) => (
                                                                <tr key={`bandeira-${idx}`} className="border-b border-slate-100 dark:border-slate-800">
                                                                    <td className="py-2 text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                                                        <span className={`w-2 h-2 rounded-full ${
                                                                            b.cor?.toLowerCase() === 'verde' ? 'bg-green-500' :
                                                                            b.cor?.toLowerCase() === 'amarela' ? 'bg-yellow-500' :
                                                                            'bg-red-500'
                                                                        }`}></span>
                                                                        Bandeira {b.cor}
                                                                    </td>
                                                                    <td className="py-2 text-center">-</td>
                                                                    <td className="py-2 text-center">-</td>
                                                                    <td className="py-2 text-right font-medium">{formatarMoeda(b.valor || 0)}</td>
                                                                </tr>
                                                            ))
                                                        ) : bandeiras > 0 ? (
                                                            <tr className="border-b border-slate-100 dark:border-slate-800">
                                                                <td className="py-2 text-slate-700 dark:text-slate-300">Bandeiras Tarifarias</td>
                                                                <td className="py-2 text-center">-</td>
                                                                <td className="py-2 text-center">-</td>
                                                                <td className="py-2 text-right font-medium">{formatarMoeda(bandeiras)}</td>
                                                            </tr>
                                                        ) : null}
                                                        {/* Iluminação Pública */}
                                                        {iluminacao > 0 && (
                                                            <tr className="border-b border-slate-100 dark:border-slate-800">
                                                                <td className="py-2 text-slate-700 dark:text-slate-300">Iluminacao Publica</td>
                                                                <td className="py-2 text-center">-</td>
                                                                <td className="py-2 text-center">-</td>
                                                                <td className="py-2 text-right font-medium">{formatarMoeda(iluminacao)}</td>
                                                            </tr>
                                                        )}
                                                        {/* Outros Serviços */}
                                                        {outrosServicos.map((item, idx) => (
                                                            <tr key={idx} className="border-b border-slate-100 dark:border-slate-800">
                                                                <td className="py-2 text-slate-700 dark:text-slate-300">{item.descricao || 'Outros'}</td>
                                                                <td className="py-2 text-center">-</td>
                                                                <td className="py-2 text-center">-</td>
                                                                <td className="py-2 text-right font-medium">{formatarMoeda(item.valor || 0)}</td>
                                                            </tr>
                                                        ))}
                                                        {/* TOTAL */}
                                                        <tr className="bg-slate-100 dark:bg-slate-800 font-bold">
                                                            <td className="py-2 text-slate-900 dark:text-white" colSpan={3}>TOTAL DA FATURA</td>
                                                            <td className="py-2 text-right text-slate-900 dark:text-white">{formatarMoeda(totalFatura)}</td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* ==================== SEÇÃO 4: PRÉVIA DA COBRANÇA ==================== */}
                                {dados && (() => {
                                    // Cálculos para prévia da cobrança (com desconto 30%)
                                    const injetadaKwh = calcularInjetadaOUC(dados?.itens_fatura) + calcularInjetadaMUC(dados?.itens_fatura);
                                    const tarifaBase = dados?.itens_fatura?.consumo_kwh?.preco_unit_com_tributos || 0.85;
                                    const consumoKwh = dados?.itens_fatura?.consumo_kwh?.quantidade || 0;

                                    // Energia com desconto (30%): kWh × tarifa × 0.70
                                    const energiaSemDesconto = injetadaKwh * tarifaBase;
                                    const energiaComDesconto = injetadaKwh * tarifaBase * 0.70;
                                    const economiaEnergia = energiaSemDesconto - energiaComDesconto;

                                    // GDI: Taxa mínima / GDII: Disponibilidade
                                    const ajuste = dados?.itens_fatura?.ajuste_lei_14300;
                                    const tipoLigacao = fatura.tipo_ligacao || dados?.ligacao;
                                    const taxaMinimaKwh = getTaxaMinima(tipoLigacao);
                                    const taxaMinimaValor = taxaMinimaKwh * tarifaBase;
                                    const disponibilidade = ajuste?.valor || 0;

                                    // Bandeiras (só GDI se consumo > injetada) - priorizar detalhamento
                                    const gapKwh = Math.max(0, consumoKwh - injetadaKwh);
                                    const temConsumoNaoCompensado = gapKwh > 0;
                                    const bandeirasDetalhamentoPrev = dados?.totais?.bandeiras_detalhamento || [];
                                    const bandeirasTotalPrev = bandeirasDetalhamentoPrev.length > 0
                                        ? bandeirasDetalhamentoPrev.reduce((sum: number, b: { valor?: number }) => sum + (b.valor || 0), 0)
                                        : (dados?.totais?.adicionais_bandeira || 0);
                                    const bandeiras = (fatura.tipo_gd === 'GDI' || temConsumoNaoCompensado) ? bandeirasTotalPrev : 0;

                                    // Iluminação pública
                                    const iluminacao = getValorIluminacaoPublica(dados?.itens_fatura) || 0;

                                    // Outros serviços
                                    const outrosServicos = getLancamentosSemIluminacao(dados?.itens_fatura);
                                    const valorOutros = outrosServicos.reduce((s, item) => s + (item.valor || 0), 0);

                                    // Total da cobrança
                                    let totalCobranca = energiaComDesconto + iluminacao + valorOutros;
                                    if (fatura.tipo_gd === 'GDII') {
                                        totalCobranca += disponibilidade;
                                    } else {
                                        totalCobranca += taxaMinimaValor + bandeiras;
                                    }

                                    return (
                                        <div className="border-2 border-indigo-200 dark:border-indigo-800 rounded-lg overflow-hidden">
                                            <div className="bg-indigo-50 dark:bg-indigo-900/20 px-4 py-2 border-b border-indigo-200 dark:border-indigo-800">
                                                <h5 className="text-sm font-medium text-indigo-700 dark:text-indigo-400 flex items-center gap-2">
                                                    <Receipt size={16} />
                                                    Previa da Cobranca (Com Desconto 30%)
                                                </h5>
                                            </div>
                                            <div className="p-4">
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="border-b border-slate-200 dark:border-slate-700">
                                                            <th className="text-left py-2 font-medium text-slate-600 dark:text-slate-400">Item</th>
                                                            <th className="text-center py-2 font-medium text-slate-600 dark:text-slate-400 w-20">kWh</th>
                                                            <th className="text-center py-2 font-medium text-slate-600 dark:text-slate-400 w-28">Tarifa (R$/kWh)</th>
                                                            <th className="text-right py-2 font-medium text-slate-600 dark:text-slate-400 w-28">Valor (R$)</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {/* Energia Injetada com desconto */}
                                                        <tr className="border-b border-slate-100 dark:border-slate-800 bg-green-50 dark:bg-green-900/10">
                                                            <td className="py-2 text-green-700 dark:text-green-400">Energia GD (30% desc.)</td>
                                                            <td className="py-2 text-center text-green-600">{injetadaKwh.toFixed(0)}</td>
                                                            <td className="py-2 text-center text-green-600">{(tarifaBase * 0.70).toFixed(4)}</td>
                                                            <td className="py-2 text-right font-medium text-green-600">{formatarMoeda(energiaComDesconto)}</td>
                                                        </tr>
                                                        {/* Taxa Mínima (GDI) ou Disponibilidade (GDII) */}
                                                        {fatura.tipo_gd === 'GDII' && disponibilidade > 0 ? (
                                                            <tr className="border-b border-slate-100 dark:border-slate-800">
                                                                <td className="py-2 text-slate-700 dark:text-slate-300">Disponibilidade (Lei 14.300)</td>
                                                                <td className="py-2 text-center">{ajuste?.quantidade?.toFixed(0) || '-'}</td>
                                                                <td className="py-2 text-center">{ajuste?.preco_unit_com_tributos?.toFixed(4) || '-'}</td>
                                                                <td className="py-2 text-right font-medium">{formatarMoeda(disponibilidade)}</td>
                                                            </tr>
                                                        ) : fatura.tipo_gd === 'GDI' ? (
                                                            <tr className="border-b border-slate-100 dark:border-slate-800">
                                                                <td className="py-2 text-slate-700 dark:text-slate-300">Taxa Minima ({tipoLigacao || 'N/A'})</td>
                                                                <td className="py-2 text-center">{taxaMinimaKwh}</td>
                                                                <td className="py-2 text-center">{tarifaBase.toFixed(4)}</td>
                                                                <td className="py-2 text-right font-medium">{formatarMoeda(taxaMinimaValor)}</td>
                                                            </tr>
                                                        ) : null}
                                                        {/* Bandeiras (se aplicável) - mostrar detalhamento quando disponível */}
                                                        {bandeiras > 0 && (fatura.tipo_gd === 'GDI' || temConsumoNaoCompensado) && (
                                                            bandeirasDetalhamentoPrev.length > 0 ? (
                                                                bandeirasDetalhamentoPrev.map((b: { cor?: string; valor?: number }, idx: number) => (
                                                                    <tr key={`bandeira-prev-${idx}`} className="border-b border-slate-100 dark:border-slate-800">
                                                                        <td className="py-2 text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                                                            <span className={`w-2 h-2 rounded-full ${
                                                                                b.cor?.toLowerCase() === 'verde' ? 'bg-green-500' :
                                                                                b.cor?.toLowerCase() === 'amarela' ? 'bg-yellow-500' :
                                                                                'bg-red-500'
                                                                            }`}></span>
                                                                            Bandeira {b.cor}
                                                                        </td>
                                                                        <td className="py-2 text-center">-</td>
                                                                        <td className="py-2 text-center">-</td>
                                                                        <td className="py-2 text-right font-medium">{formatarMoeda(b.valor || 0)}</td>
                                                                    </tr>
                                                                ))
                                                            ) : (
                                                                <tr className="border-b border-slate-100 dark:border-slate-800">
                                                                    <td className="py-2 text-slate-700 dark:text-slate-300">Bandeiras Tarifarias</td>
                                                                    <td className="py-2 text-center">-</td>
                                                                    <td className="py-2 text-center">-</td>
                                                                    <td className="py-2 text-right font-medium">{formatarMoeda(bandeiras)}</td>
                                                                </tr>
                                                            )
                                                        )}
                                                        {/* Iluminação Pública */}
                                                        {iluminacao > 0 && (
                                                            <tr className="border-b border-slate-100 dark:border-slate-800">
                                                                <td className="py-2 text-slate-700 dark:text-slate-300">Iluminacao Publica</td>
                                                                <td className="py-2 text-center">-</td>
                                                                <td className="py-2 text-center">-</td>
                                                                <td className="py-2 text-right font-medium">{formatarMoeda(iluminacao)}</td>
                                                            </tr>
                                                        )}
                                                        {/* Outros Serviços */}
                                                        {outrosServicos.map((item, idx) => (
                                                            <tr key={idx} className="border-b border-slate-100 dark:border-slate-800">
                                                                <td className="py-2 text-slate-700 dark:text-slate-300">{item.descricao || 'Outros'}</td>
                                                                <td className="py-2 text-center">-</td>
                                                                <td className="py-2 text-center">-</td>
                                                                <td className="py-2 text-right font-medium">{formatarMoeda(item.valor || 0)}</td>
                                                            </tr>
                                                        ))}
                                                        {/* TOTAL */}
                                                        <tr className="bg-indigo-100 dark:bg-indigo-900/30 font-bold">
                                                            <td className="py-2 text-indigo-900 dark:text-indigo-200" colSpan={3}>TOTAL DA COBRANCA</td>
                                                            <td className="py-2 text-right text-indigo-900 dark:text-indigo-200">{formatarMoeda(totalCobranca)}</td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* ==================== SEÇÃO 5: RESUMO GD (ECONOMIA) ==================== */}
                                {dados && (() => {
                                    // Cálculos de economia
                                    const injetadaKwh = calcularInjetadaOUC(dados?.itens_fatura) + calcularInjetadaMUC(dados?.itens_fatura);
                                    const tarifaBase = dados?.itens_fatura?.consumo_kwh?.preco_unit_com_tributos || 0.85;

                                    const semAssinatura = injetadaKwh * tarifaBase;
                                    const comAssinatura = injetadaKwh * tarifaBase * 0.70;
                                    const economiaMes = semAssinatura - comAssinatura;

                                    // Saldo acumulado e a expirar (do quadro de atenção)
                                    const saldoAcumulado = dados?.quadro_atencao?.saldo_acumulado || 0;
                                    const aExpirar = dados?.quadro_atencao?.a_expirar_proximo_ciclo || 0;

                                    // Economia acumulada (do beneficiário)
                                    const economiaAcumulada = fatura.beneficiario?.economia_acumulada || 0;

                                    return (
                                        <div className="border border-emerald-200 dark:border-emerald-800 rounded-lg overflow-hidden">
                                            <div className="bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2 border-b border-emerald-200 dark:border-emerald-800">
                                                <h5 className="text-sm font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                                                    <TrendingUp size={16} />
                                                    Resumo GD (Economia)
                                                </h5>
                                            </div>
                                            <div className="p-4 space-y-4">
                                                {/* Economia do Mês */}
                                                <div>
                                                    <p className="text-xs text-slate-500 mb-2 font-medium">Economia do Mes (Energia Injetada)</p>
                                                    <div className="grid grid-cols-3 gap-3">
                                                        <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-3 text-center">
                                                            <p className="text-xs text-slate-500 mb-1">Sem Assinatura</p>
                                                            <p className="font-bold text-slate-700 dark:text-slate-300">{formatarMoeda(semAssinatura)}</p>
                                                        </div>
                                                        <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-3 text-center">
                                                            <p className="text-xs text-green-600 mb-1">Com Assinatura (30% desc.)</p>
                                                            <p className="font-bold text-green-700 dark:text-green-400">{formatarMoeda(comAssinatura)}</p>
                                                        </div>
                                                        <div className="bg-emerald-100 dark:bg-emerald-900/30 rounded-lg p-3 text-center">
                                                            <p className="text-xs text-emerald-600 mb-1">Economia</p>
                                                            <p className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center justify-center gap-1">
                                                                {formatarMoeda(economiaMes)}
                                                                <CheckCircle size={14} className="text-emerald-500" />
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Informações de Crédito (do quadro de atenção) */}
                                                <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                                                    <p className="text-xs text-slate-500 mb-2 font-medium">Informacoes de Credito (da Fatura)</p>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                                                            <span className="text-sm text-slate-600 dark:text-slate-400">Saldo Acumulado:</span>
                                                            <span className="font-medium text-slate-900 dark:text-white">{formatarMoeda(saldoAcumulado)}</span>
                                                        </div>
                                                        <div className="flex items-center justify-between bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3">
                                                            <span className="text-sm text-orange-600 dark:text-orange-400">A Expirar (prox. ciclo):</span>
                                                            <span className="font-medium text-orange-700 dark:text-orange-300">{formatarMoeda(aExpirar)}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Economia Acumulada (do cliente) */}
                                                <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                                                    <div className="flex items-center justify-between bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 rounded-lg p-4">
                                                        <div>
                                                            <p className="text-xs text-emerald-600 font-medium">Economia Acumulada Total</p>
                                                            <p className="text-xs text-slate-500">(desde o inicio da assinatura)</p>
                                                        </div>
                                                        <p className="font-bold text-2xl text-emerald-700 dark:text-emerald-400">{formatarMoeda(economiaAcumulada)}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Acoes */}
                                <div className="flex justify-between items-center gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
                                    <div className="flex items-center gap-2">
                                        {editMode && (
                                            <button
                                                onClick={async () => {
                                                    setSalvando(true);
                                                    try {
                                                        await faturasApi.salvarDadosEditados(fatura.id, {
                                                            consumo_kwh: camposEditados.consumo_kwh,
                                                            injetada_ouc_kwh: camposEditados.injetada_ouc_kwh,
                                                            injetada_muc_kwh: camposEditados.injetada_muc_kwh
                                                        });
                                                        setEditMode(false);
                                                        alert('Alteracoes salvas com sucesso! Os valores serao considerados na geracao da cobranca.');
                                                    } catch (err: any) {
                                                        alert(err.response?.data?.detail || 'Erro ao salvar alteracoes');
                                                    } finally {
                                                        setSalvando(false);
                                                    }
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
                                        <p className={`font-semibold ${
                                            fatura.tipo_gd === 'GDII' ? 'text-purple-600' : 'text-blue-600'
                                        }`}>
                                            {fatura.tipo_gd === 'GDII' ? 'GD II' : fatura.tipo_gd === 'GDI' ? 'GD I' : 'GD ?'}
                                        </p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3">
                                        <p className="text-xs text-slate-500 mb-1">Tipo Ligacao</p>
                                        <p className="font-semibold text-slate-900 dark:text-white">
                                            {fatura.tipo_ligacao || dados.ligacao || '-'}
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
                                            {dados.totais?.bandeiras_detalhamento?.length > 0 ? (
                                                <div className="space-y-1">
                                                    {dados.totais.bandeiras_detalhamento.map((b: { cor?: string; valor?: number }, idx: number) => (
                                                        <p key={idx} className="font-medium flex items-center gap-1">
                                                            <span className={`w-2 h-2 rounded-full ${
                                                                b.cor?.toLowerCase() === 'verde' ? 'bg-green-500' :
                                                                b.cor?.toLowerCase() === 'amarela' ? 'bg-yellow-500' :
                                                                'bg-red-500'
                                                            }`}></span>
                                                            {b.cor}: {formatarMoeda(b.valor || 0)}
                                                        </p>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="font-medium">{formatarMoeda(dados.totais?.adicionais_bandeira)}</p>
                                            )}
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
