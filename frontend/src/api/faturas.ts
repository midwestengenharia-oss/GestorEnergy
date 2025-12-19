/**
 * API - Faturas
 */

import { api } from './client';
import type { Fatura } from './types';

export interface FaturaFilters {
    uc_id?: number;
    usuario_titular?: boolean;  // Filtrar por titularidade: true=titular, false=gestor
    status?: 'pendente' | 'paga' | 'vencida' | 'cancelada';
    mes?: number;
    ano?: number;
    page?: number;
    limit?: number;
}

export interface FaturaManualRequest {
    uc_id: number;
    mes_referencia: number;
    ano_referencia: number;
    valor_fatura: number;
    consumo?: number;
    data_vencimento: string;
    observacoes?: string;
}

export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
    pages: number;
}

export interface FaturaPdfResponse {
    id: number;
    pdf_base64: string | null;
    mes_referencia: number;
    ano_referencia: number;
    disponivel: boolean;
}

export interface FaturaPixResponse {
    id: number;
    qr_code_pix: string | null;
    qr_code_pix_image: string | null;
    codigo_barras: string | null;
    mes_referencia: number;
    ano_referencia: number;
    pix_disponivel: boolean;
}

export const faturasApi = {
    // Listar faturas
    listar: (filters?: FaturaFilters) =>
        api.get<PaginatedResponse<Fatura>>('/faturas', { params: filters }),

    // Buscar fatura por ID
    buscar: (id: number) =>
        api.get<Fatura>(`/faturas/${id}`),

    // Buscar PDF da fatura
    buscarPdf: (id: number) =>
        api.get<FaturaPdfResponse>(`/faturas/${id}/pdf`),

    // Buscar dados PIX da fatura
    buscarPix: (id: number) =>
        api.get<FaturaPixResponse>(`/faturas/${id}/pix`),

    // Faturas por UC
    porUC: (ucId: number) =>
        api.get<Fatura[]>(`/faturas/uc/${ucId}`),

    // Estatísticas da UC
    estatisticas: (ucId: number) =>
        api.get<{
            total_faturas: number;
            valor_total: number;
            consumo_total: number;
            media_mensal: number;
        }>(`/faturas/uc/${ucId}/estatisticas`),

    // Comparativo mensal
    comparativo: (ucId: number) =>
        api.get<any>(`/faturas/uc/${ucId}/comparativo`),

    // Histórico de GD (Geração Distribuída)
    historicoGD: (ucId: number) =>
        api.get<any[]>(`/faturas/uc/${ucId}/gd`),

    // Buscar fatura por referência (mês/ano)
    porReferencia: (ucId: number, ano: number, mes: number) =>
        api.get<Fatura>(`/faturas/uc/${ucId}/${ano}/${mes}`),

    // Criar fatura manual
    criarManual: (data: FaturaManualRequest) =>
        api.post<Fatura>('/faturas/manual', data),

    // ========== ENDPOINTS DE EXTRAÇÃO ==========

    // Extrair dados de uma fatura
    extrair: (faturaId: number) =>
        api.post<{ success: boolean; fatura_id: number; dados: any }>(`/faturas/${faturaId}/extrair`),

    // Extrair dados em lote
    extrairLote: (ucId?: number, mesReferencia?: number, anoReferencia?: number, limite: number = 10, forcarReprocessamento: boolean = false) =>
        api.post<{
            total: number;
            processadas: number;
            sucesso: number;
            erro: number;
            detalhes: any[];
        }>('/faturas/extrair-lote', null, {
            params: {
                uc_id: ucId,
                mes_referencia: mesReferencia,
                ano_referencia: anoReferencia,
                limite,
                forcar_reprocessamento: forcarReprocessamento
            }
        }),

    // Obter dados já extraídos
    dadosExtraidos: (faturaId: number) =>
        api.get<{ success: boolean; fatura_id: number; dados: any | null }>(`/faturas/${faturaId}/dados-extraidos`),

    // Reprocessar extração
    reprocessarExtracao: (faturaId: number) =>
        api.post<{ success: boolean; fatura_id: number; message: string; dados: any }>(`/faturas/${faturaId}/reprocessar-extracao`),

    // Refazer fatura (reset para aguardar extração + exclui cobrança)
    refazer: (faturaId: number) =>
        api.post<{ success: boolean; fatura_id: number; status: string; cobranca_excluida: boolean; message: string }>(`/faturas/${faturaId}/refazer`),

    // Salvar dados editados (correções manuais)
    salvarDadosEditados: (faturaId: number, dados: {
        consumo_kwh?: number;
        injetada_ouc_kwh?: number;
        injetada_muc_kwh?: number;
        bandeira_tarifaria?: string;
        valor_bandeira?: number;
        total_a_pagar?: number;
    }) =>
        api.patch<{ success: boolean; fatura_id: number; dados_editados: any }>(`/faturas/${faturaId}/dados-editados`, dados),

    // Buscar faturas por usina
    porUsina: (usinaId: number, mesReferencia?: number, anoReferencia?: number) =>
        api.get<{ faturas: any[]; total: number }>(`/faturas/por-usina/${usinaId}`, {
            params: {
                mes_referencia: mesReferencia,
                ano_referencia: anoReferencia
            }
        }),

    // Kanban de faturas
    kanban: (params?: { usina_id?: number; mes_referencia?: number; ano_referencia?: number; busca?: string }) =>
        api.get<KanbanResponse>('/faturas/kanban', { params }),

    // Gestão unificada de faturas
    gestao: (params?: GestaoFaturasParams) =>
        api.get<GestaoFaturasResponse>('/faturas/gestao', { params }),
};

// Tipos para o Kanban
export interface FaturaKanban {
    id: number;
    uc_id: number;
    uc_formatada: string;
    uc_apelido?: string;
    numero_fatura?: string;
    mes_referencia: number;
    ano_referencia: number;
    beneficiario: {
        id: number;
        nome: string;
    };
    usina_id?: number;
    extracao_status?: string;
    extracao_score?: number;
    consumo_kwh?: number;
    injetada_kwh?: number;
    tipo_gd?: 'GDI' | 'GDII' | null;
    valor_fatura?: number;
    cobranca?: {
        id: number;
        status: string;
    } | null;
    tem_pdf: boolean;
}

export interface KanbanResponse {
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

// Tipos para Gestão Unificada de Faturas
export type StatusFluxo =
    | 'AGUARDANDO_PDF'
    | 'PDF_RECEBIDO'
    | 'EXTRAIDA'
    | 'COBRANCA_RASCUNHO'
    | 'COBRANCA_EMITIDA'
    | 'COBRANCA_PAGA'
    | 'FATURA_QUITADA';

export interface BeneficiarioGestao {
    id: number;
    nome?: string;
    cpf: string;
    email?: string;
    telefone?: string;
}

export interface UsinaGestao {
    id: number;
    nome?: string;
}

export interface CobrancaGestao {
    id: number;
    status: string;
    valor_total: number;
    vencimento: string;
    qr_code_pix?: string;
    qr_code_pix_image?: string;
    pago_em?: string;
}

export interface FaturaGestao {
    id: number;
    uc_id: number;
    uc_formatada: string;
    mes_referencia: number;
    ano_referencia: number;
    referencia_formatada?: string;
    status_fluxo: StatusFluxo;
    tem_pdf: boolean;
    valor_fatura?: number;
    extracao_status?: string;
    extracao_score?: number;
    dados_extraidos?: any;
    dados_api?: any;
    tipo_gd?: string;
    tipo_ligacao?: string;
    bandeira_tarifaria?: string;
    beneficiario?: BeneficiarioGestao;
    usina?: UsinaGestao;
    cobranca?: CobrancaGestao;
}

export interface TotaisGestao {
    aguardando_pdf: number;
    pdf_recebido: number;
    extraida: number;
    cobranca_rascunho: number;
    cobranca_emitida: number;
    cobranca_paga: number;
    fatura_quitada: number;
}

export interface GestaoFaturasResponse {
    faturas: FaturaGestao[];
    totais: TotaisGestao;
}

export interface GestaoFaturasParams {
    usina_id?: number;
    beneficiario_id?: number;
    mes_referencia?: number;
    ano_referencia?: number;
    busca?: string;
    status_fluxo?: string;
}

/**
 * Helper para download do PDF da fatura a partir do base64
 */
export const downloadFaturaPdf = (fatura: Fatura): boolean => {
    if (!fatura.pdf_base64) {
        return false;
    }

    try {
        const link = document.createElement('a');
        link.href = `data:application/pdf;base64,${fatura.pdf_base64}`;
        link.download = `fatura_${fatura.mes_referencia.toString().padStart(2, '0')}_${fatura.ano_referencia}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return true;
    } catch (error) {
        console.error('Erro ao baixar PDF:', error);
        return false;
    }
};

export default faturasApi;
