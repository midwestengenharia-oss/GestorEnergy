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
    cancelar: (id: number, motivo?: string) =>
        api.post(`/cobrancas/${id}/cancelar`, { motivo }),

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
};

export default cobrancasApi;
