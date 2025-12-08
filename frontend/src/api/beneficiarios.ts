/**
 * API - Beneficiários
 */

import { api } from './client';
import type { Beneficiario } from './types';

export interface BeneficiarioFilters {
    usina_id?: number;
    status?: 'ativo' | 'inativo' | 'pendente';
    page?: number;
    limit?: number;
}

export interface BeneficiarioCreateRequest {
    usuario_id?: string;
    usina_id: number;
    uc_id: number;
    cpf: string;
    nome?: string;
    email?: string;
    telefone?: string;
    percentual_rateio: number;
    desconto?: number;
}

export interface BeneficiarioUpdateRequest {
    nome?: string;
    email?: string;
    telefone?: string;
    percentual_rateio?: number;
    desconto?: number;
    status?: 'ativo' | 'inativo' | 'pendente';
}

export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
    pages: number;
}

export interface BeneficiariosPaginatedResponse {
    beneficiarios: Beneficiario[];
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
}

export const beneficiariosApi = {
    // Listar beneficiários
    listar: (filters?: BeneficiarioFilters) =>
        api.get<PaginatedResponse<Beneficiario>>('/beneficiarios', { params: filters }),

    // Meus benefícios (como beneficiário)
    meus: () =>
        api.get<Beneficiario[]>('/beneficiarios/meus'),

    // Beneficiários por usina
    porUsina: (usinaId: number) =>
        api.get<BeneficiariosPaginatedResponse>(`/beneficiarios/usina/${usinaId}`),

    // Buscar beneficiário por ID
    buscar: (id: number) =>
        api.get<Beneficiario>(`/beneficiarios/${id}`),

    // Criar novo beneficiário
    criar: (data: BeneficiarioCreateRequest) =>
        api.post<Beneficiario>('/beneficiarios', data),

    // Atualizar beneficiário
    atualizar: (id: number, data: BeneficiarioUpdateRequest) =>
        api.put<Beneficiario>(`/beneficiarios/${id}`, data),

    // Excluir beneficiário
    excluir: (id: number) =>
        api.delete(`/beneficiarios/${id}`),

    // Enviar convite para beneficiário
    enviarConvite: (id: number) =>
        api.post(`/beneficiarios/${id}/convite`),

    // Ativar beneficiário
    ativar: (id: number) =>
        api.post(`/beneficiarios/${id}/ativar`),

    // Suspender beneficiário
    suspender: (id: number, motivo?: string) =>
        api.post(`/beneficiarios/${id}/suspender`, { motivo }),

    // Cancelar beneficiário
    cancelar: (id: number, motivo?: string) =>
        api.post(`/beneficiarios/${id}/cancelar`, { motivo }),

    // Atualizar CPF do beneficiário (e vincular usuário se existir)
    atualizarCpf: (id: number, cpf: string) =>
        api.patch<Beneficiario>(`/beneficiarios/${id}/cpf`, null, { params: { cpf } }),
};

export default beneficiariosApi;
