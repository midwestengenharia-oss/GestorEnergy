/**
 * API - Unidades Consumidoras (UCs)
 */

import { api } from './client';
import type { UnidadeConsumidora } from './types';

export interface UCFilters {
    is_geradora?: boolean;
    uc_ativa?: boolean;
    cidade?: string;
    page?: number;
    limit?: number;
}

export interface UCVincularRequest {
    cod_empresa: number;
    cdc: number;
    digito_verificador: number;
}

export interface UCVincularFormatoRequest {
    uc_formatada: string; // Ex: "6/4242904-3"
    usuario_titular?: boolean;
    // Dados opcionais da Energisa para preencher automaticamente
    nome_titular?: string;
    endereco?: string;
    numero_imovel?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
    latitude?: number;
    longitude?: number;
    classe_leitura?: string;
    grupo_leitura?: string;
    is_geradora?: boolean; // Se geracaoDistribuida != null
}

export interface UCUpdateRequest {
    apelido?: string;  // Nome personalizado da UC
    nome_titular?: string;
    endereco?: string;
    numero_imovel?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
    cep?: string;
}

export interface UCConfigurarGDRequest {
    is_geradora: boolean;
    capacidade_kwp?: number;
    tipo_geracao?: string;
}

export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
    pages: number;
}

export const ucsApi = {
    // Listar UCs
    listar: (filters?: UCFilters) =>
        api.get<PaginatedResponse<UnidadeConsumidora>>('/ucs', { params: filters }),

    // Minhas UCs (filtro opcional por titularidade)
    minhas: (usuario_titular?: boolean) =>
        api.get<UnidadeConsumidora[]>('/ucs/minhas', {
            params: usuario_titular !== undefined ? { usuario_titular } : undefined
        }),

    // Listar geradoras
    geradoras: () =>
        api.get<UnidadeConsumidora[]>('/ucs/geradoras'),

    // Buscar UC por ID
    buscar: (id: number) =>
        api.get<UnidadeConsumidora>(`/ucs/${id}`),

    // Vincular UC
    vincular: (data: UCVincularRequest) =>
        api.post<UnidadeConsumidora>('/ucs/vincular', data),

    // Vincular UC por formato (Ex: "01-123456-7")
    vincularFormato: (data: UCVincularFormatoRequest) =>
        api.post<UnidadeConsumidora>('/ucs/vincular-formato', data),

    // Atualizar UC
    atualizar: (id: number, data: UCUpdateRequest) =>
        api.put<UnidadeConsumidora>(`/ucs/${id}`, data),

    // Desvincular UC
    desvincular: (id: number) =>
        api.delete(`/ucs/${id}`),

    // Configurar como geradora (GD)
    configurarGD: (id: number, data: UCConfigurarGDRequest) =>
        api.post<UnidadeConsumidora>(`/ucs/${id}/gd`, data),

    // Obter informações de GD
    infoGD: (id: number) =>
        api.get<any>(`/ucs/${id}/gd`),

    // Listar UCs beneficiárias (de uma geradora)
    listarBeneficiarias: (id: number) =>
        api.get<UnidadeConsumidora[]>(`/ucs/${id}/beneficiarias`),

    // Sincronizar faturas de uma UC com a Energisa
    sincronizarFaturas: (id: number, cpf: string) =>
        api.post<{ message: string; success: boolean }>(`/ucs/${id}/sincronizar-faturas`, { cpf }),
};

export default ucsApi;
