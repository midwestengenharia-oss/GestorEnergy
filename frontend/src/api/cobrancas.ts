/**
 * API - Cobranças
 */

import { api } from './client';
import type { Cobranca } from './types';

export interface CobrancaFilters {
    beneficiario_id?: number;
    usina_id?: number;
    status?: 'pendente' | 'paga' | 'vencida' | 'cancelada';
    mes?: number;
    ano?: number;
    page?: number;
    limit?: number;
}

export interface CobrancaCreateRequest {
    beneficiario_id: number;
    usina_id: number;
    mes_referencia: number;
    ano_referencia: number;
    valor: number;
    data_vencimento: string;
    descricao?: string;
}

export interface CobrancaUpdateRequest {
    valor?: number;
    data_vencimento?: string;
    status?: 'PENDENTE' | 'PAGA' | 'VENCIDA' | 'CANCELADA';
    descricao?: string;
}

export interface GerarCobrancasLoteRequest {
    usina_id: number;
    mes: number;
    ano: number;
    vencimento: string;
}

export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
    pages: number;
}

export interface CobrancasPaginatedResponse {
    cobrancas: Cobranca[];
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
}

export const cobrancasApi = {
    // Listar cobranças
    listar: (filters?: CobrancaFilters) =>
        api.get<CobrancasPaginatedResponse>('/cobrancas', { params: filters }),

    // Minhas cobranças (beneficiário)
    minhas: () =>
        api.get<Cobranca[]>('/cobrancas/minhas'),

    // Buscar cobrança por ID
    buscar: (id: number) =>
        api.get<Cobranca>(`/cobrancas/${id}`),

    // Criar cobrança individual
    criar: (data: CobrancaCreateRequest) =>
        api.post<Cobranca>('/cobrancas', data),

    // Gerar cobranças em lote (para todos beneficiários da usina)
    gerarLote: (data: GerarCobrancasLoteRequest) =>
        api.post<{ geradas: number; cobrancas: Cobranca[] }>('/cobrancas/lote', data),

    // Atualizar cobrança
    atualizar: (id: number, data: CobrancaUpdateRequest) =>
        api.put<Cobranca>(`/cobrancas/${id}`, data),

    // Cancelar cobrança
    cancelar: (id: number, motivo: string) =>
        api.post(`/cobrancas/${id}/cancelar`, null, { params: { motivo } }),

    // Registrar pagamento
    registrarPagamento: (id: number, dataPagamento?: string, valorPago?: number) =>
        api.post(`/cobrancas/${id}/pagamento`, { data_pagamento: dataPagamento, valor_pago: valorPago }),

    // Estatísticas de cobranças
    estatisticas: () =>
        api.get<{
            total_pendente: number;
            total_pago: number;
            total_vencido: number;
            quantidade: { pendente: number; pago: number; vencido: number };
        }>('/cobrancas/estatisticas'),

    // Cobranças por usina
    porUsina: (usinaId: number) =>
        api.get<Cobranca[]>(`/cobrancas/usina/${usinaId}`),

    // Cobranças por beneficiário
    porBeneficiario: (beneficiarioId: number) =>
        api.get<Cobranca[]>(`/cobrancas/beneficiario/${beneficiarioId}`),

    // ========== NOVOS ENDPOINTS AUTOMÁTICOS ==========

    // Gerar cobrança automática a partir de fatura
    gerarAutomatica: (faturaId: number, beneficiarioId: number, tarifaAneel?: number, fioB?: number, forcarReprocessamento?: boolean) =>
        api.post<Cobranca>('/cobrancas/gerar-automatica', null, {
            params: {
                fatura_id: faturaId,
                beneficiario_id: beneficiarioId,
                tarifa_aneel: tarifaAneel,
                fio_b: fioB,
                forcar_reprocessamento: forcarReprocessamento || false
            }
        }),

    // Gerar cobranças automáticas em lote para toda usina
    gerarLoteUsina: (usinaId: number, mesReferencia: number, anoReferencia: number, tarifaAneel?: number, fioB?: number) =>
        api.post<{
            total: number;
            processadas: number;
            sucesso: number;
            erro: number;
            ja_existentes: number;
            resultados: any[];
        }>('/cobrancas/gerar-lote-usina', null, {
            params: {
                usina_id: usinaId,
                mes_referencia: mesReferencia,
                ano_referencia: anoReferencia,
                tarifa_aneel: tarifaAneel,
                fio_b: fioB
            }
        }),

    // Obter relatório HTML da cobrança
    obterRelatorioHTML: (id: number) =>
        api.get<string>(`/cobrancas/${id}/relatorio-html`, {
            headers: { 'Accept': 'text/html' },
            responseType: 'text' as any
        }),

    // Editar vencimento de cobrança em rascunho
    editarVencimento: (id: number, novaData: string) =>
        api.put<Cobranca>(`/cobrancas/${id}/vencimento`, null, {
            params: { nova_data: novaData }
        }),

    // Aprovar cobrança (RASCUNHO → EMITIDA)
    aprovar: (id: number, enviarEmail: boolean = false) =>
        api.post<Cobranca>(`/cobrancas/${id}/aprovar`, null, {
            params: { enviar_email: enviarEmail }
        }),

    // Editar campos específicos da cobrança
    editarCampos: (id: number, campos: CamposEditaveisCobranca) =>
        api.put<Cobranca>(`/cobrancas/${id}/editar-campos`, campos),

    // Reverter campos editados para valores originais
    reverterCampos: (id: number, campos?: string[]) =>
        api.post<Cobranca>(`/cobrancas/${id}/reverter-campos`, { campos }),
};

// Interface para campos editáveis da cobrança
export interface CamposEditaveisCobranca {
    // Métricas de energia (kWh)
    consumo_kwh?: number;
    injetada_kwh?: number;
    compensado_kwh?: number;
    gap_kwh?: number;

    // Tarifas
    tarifa_base?: number;
    tarifa_assinatura?: number;

    // Valores de energia
    valor_energia_base?: number;
    valor_energia_assinatura?: number;

    // GD I - Taxa mínima e energia excedente
    taxa_minima_kwh?: number;
    taxa_minima_valor?: number;
    energia_excedente_kwh?: number;
    energia_excedente_valor?: number;

    // GD II - Disponibilidade
    disponibilidade_valor?: number;

    // Extras
    bandeiras_valor?: number;
    iluminacao_publica_valor?: number;
    servicos_valor?: number;

    // Vencimento e observações
    vencimento?: string;
    observacoes_internas?: string;
}

export interface ReversaoCamposRequest {
    campos?: string[];  // Lista de campos a reverter. Se vazio, reverte todos.
}

export default cobrancasApi;
