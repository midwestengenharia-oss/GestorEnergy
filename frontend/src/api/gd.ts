/**
 * API - Geração Distribuída (GD)
 * Integração com endpoints de GD (banco local e Energisa)
 */

import { api } from './client';

// Request para endpoints de GD da Energisa
export interface GDRequest {
    cpf: string;
    codigoEmpresaWeb?: number;
    cdc: number;
    digitoVerificadorCdc: number;
}

// Histórico mensal de GD (formato do banco)
export interface HistoricoGD {
    id: number;
    uc_id: number;
    mes_referencia: number;
    ano_referencia: number;
    saldo_anterior_conv?: number;
    injetado_conv?: number;
    total_recebido_rede?: number;
    consumo_recebido_conv?: number;
    consumo_injetado_compensado?: number;
    consumo_transferido_conv?: number;
    consumo_compensado_conv?: number;
    saldo_compensado_anterior?: number;
    dados_api?: Record<string, unknown>;
    sincronizado_em?: string;
}

// UC base para GD
interface UCBase {
    id: number;
    usuario_id: string;
    cod_empresa: number;
    cdc: number;
    digito_verificador: number;
    uc_formatada?: string;
    apelido?: string;
    nome_titular?: string;
    is_geradora: boolean;
    saldo_acumulado: number;
}

// Beneficiária de uma UC geradora
export interface GDBeneficiaria {
    id: number;
    uc_formatada: string;
    nome_titular?: string;
    percentual_rateio?: number;
}

// UC com dados completos de GD (resposta do banco)
export interface UCComGD {
    uc: UCBase;
    is_geradora: boolean;
    is_beneficiaria: boolean;
    tem_dados_gd: boolean;
    saldo_creditos: number;
    historico: HistoricoGD[];
    beneficiarias: GDBeneficiaria[];
    geradora?: GDBeneficiaria;
    percentual_rateio?: number;
}

// Resumo de GD do usuário
export interface GDResumo {
    total_ucs_com_gd: number;
    total_creditos: number;
    total_gerado_mes: number;
    total_compensado_mes: number;
    ucs: UCComGD[];
}

// Resposta do endpoint gd/info (Energisa)
export interface GDInfoResponse {
    infos?: {
        isGeradora?: boolean;
        isBeneficiaria?: boolean;
        temContextoGD?: boolean;
        geradora?: {
            codigoEmpresaWeb: number;
            cdc: number;
            digitoVerificador: number;
            ucFormatada?: string;
        };
        beneficiarias?: Array<{
            codigoEmpresaWeb: number;
            cdc: number;
            digitoVerificador: number;
            ucFormatada?: string;
            nomeTitular?: string;
            percentualRateio: number;
            saldoCreditos?: number;
        }>;
        percentualRateio?: number;
        saldoCreditos?: number;
    };
    errored?: boolean;
    message?: string;
}

// Resposta do endpoint gd/details (Energisa)
export interface GDDetailsResponse {
    infos?: {
        historico?: Array<{
            mes: number;
            ano: number;
            creditosGerados?: number;
            creditosRecebidos?: number;
            creditosUtilizados?: number;
            saldoMes?: number;
            saldoAcumulado?: number;
            consumoKwh?: number;
        }>;
        saldoAtual?: number;
        totalGerado?: number;
        totalCompensado?: number;
        totalCreditos?: number;
        [key: string]: unknown;
    };
    errored?: boolean;
    message?: string;
}

// Resposta de sincronização
export interface SyncResponse {
    success: boolean;
    message: string;
    stats?: {
        ucs_processadas?: number;
        gd_sincronizados?: number;
        erros?: number;
    };
}

export const gdApi = {
    // =====================
    // Endpoints do Banco Local
    // =====================

    /**
     * Busca resumo de GD de todas as UCs do usuário (do banco)
     * Retorna dados consolidados sem consultar Energisa
     * @param usuario_titular - Filtro de titularidade: true=titular, false=gestor
     */
    getResumo: (usuario_titular?: boolean) =>
        api.get<GDResumo>('/ucs/gd/resumo', {
            params: usuario_titular !== undefined ? { usuario_titular } : undefined
        }),

    /**
     * Sincroniza dados de GD de todas as UCs do usuário
     * Requer sessão ativa na Energisa
     */
    sincronizar: () =>
        api.post<SyncResponse>('/sync/gd/minhas-ucs'),

    /**
     * Busca histórico de GD de uma UC (do banco)
     */
    getHistorico: (ucId: number) =>
        api.get<HistoricoGD[]>(`/ucs/${ucId}/gd/historico`),

    /**
     * Busca dados completos de GD de uma UC (do banco)
     */
    getCompleto: (ucId: number) =>
        api.get<UCComGD>(`/ucs/${ucId}/gd/completo`),

    // =====================
    // Endpoints da Energisa (tempo real)
    // =====================

    /**
     * Busca informações de GD de uma UC na Energisa
     * Retorna se é geradora, beneficiária e lista de beneficiárias
     */
    getInfo: (data: GDRequest) =>
        api.post<GDInfoResponse>('/energisa/gd/info', data),

    /**
     * Busca histórico detalhado de GD (13 meses) na Energisa
     * Funciona para geradoras E beneficiárias
     * Se retornar dados para UC não-geradora = ela participou de GD
     */
    getDetails: (data: GDRequest) =>
        api.post<GDDetailsResponse>('/energisa/gd/details', data),
};

export default gdApi;
