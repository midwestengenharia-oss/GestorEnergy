/**
 * API - Leads
 */

import { api } from './client';
import type { Lead } from './types';

export interface LeadFilters {
    status?: string;
    origem?: string;
    responsavel_id?: string;
    busca?: string;
    page?: number;
    per_page?: number;
    limit?: number; // alias para per_page
}

export interface LeadCapturaRequest {
    nome: string;
    email: string;
    telefone: string;
    cpf?: string;
    cidade?: string;
    uf?: string;
    consumo_medio?: number;
    valor_conta?: number;
    origem?: string;
    observacoes?: string;
}

export interface LeadSimularRequest {
    cpf: string;
    consumo_medio?: number;
    valor_conta?: number;
}

export interface LeadUpdateRequest {
    nome?: string;
    email?: string;
    telefone?: string;
    status?: 'novo' | 'contato' | 'proposta' | 'negociacao' | 'convertido' | 'perdido';
    observacoes?: string;
    parceiro_id?: number;
}

export interface LeadAtribuirRequest {
    responsavel_id: string;
}

export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
    pages: number;
}

export const leadsApi = {
    // Listar leads
    listar: (filters?: LeadFilters) => {
        // Converte limit para per_page se necessário
        const params = filters ? { ...filters } : {};
        if (params.limit && !params.per_page) {
            params.per_page = params.limit;
            delete params.limit;
        }
        return api.get<{ leads: Lead[]; total: number; page: number; per_page: number; total_pages: number }>('/leads', { params });
    },

    // Buscar lead por ID
    buscar: (id: number) =>
        api.get<Lead>(`/leads/${id}`),

    // Capturar novo lead (público - simulador)
    capturar: (data: LeadCapturaRequest) =>
        api.post<Lead>('/leads/captura', data),

    // Simular economia (público)
    simular: (data: LeadSimularRequest) =>
        api.post<any>('/leads/simular', data),

    // Atualizar lead
    atualizar: (id: number, data: LeadUpdateRequest) =>
        api.put<Lead>(`/leads/${id}`, data),

    // Atribuir responsável
    atribuir: (id: number, data: LeadAtribuirRequest) =>
        api.post(`/leads/${id}/atribuir`, data),

    // Registrar contato/interação
    registrarContato: (id: number, tipo: string, descricao: string) =>
        api.post(`/leads/${id}/contato`, { tipo, descricao }),

    // Converter em beneficiário
    converter: (id: number, dados?: any) =>
        api.post(`/leads/${id}/converter`, dados),

    // Marcar como perdido
    perder: (id: number, motivo: string) =>
        api.post(`/leads/${id}/perder`, { motivo }),

    // Estatísticas do funil
    estatisticas: () =>
        api.get<{
            total: number;
            por_status: Record<string, number>;
            taxa_conversao: number;
            tempo_medio_conversao: number;
        }>('/leads/estatisticas'),

    // Funil de vendas
    funil: () =>
        api.get<any>('/leads/funil'),
};

export default leadsApi;
