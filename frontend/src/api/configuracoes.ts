/**
 * API - Configurações (Impostos)
 */

import { api } from './client';

export interface Imposto {
    id: number;
    pis: number;
    cofins: number;
    icms: number;
    vigencia_inicio: string;
    vigencia_fim: string | null;
    criado_por: string | null;
    criado_em: string;
    observacao: string | null;
}

export interface ImpostoVigente {
    id: number;
    pis: number;
    cofins: number;
    icms: number;
    pis_cofins: number;
    vigencia_inicio: string;
}

export interface ImpostoCreate {
    pis: number;
    cofins: number;
    icms: number;
    vigencia_inicio: string;
    observacao?: string;
}

export interface ImpostoUpdate {
    pis?: number;
    cofins?: number;
    icms?: number;
    vigencia_inicio?: string;
    vigencia_fim?: string;
    observacao?: string;
}

export const configuracoesApi = {
    // Listar todos os impostos
    listarImpostos: () =>
        api.get<Imposto[]>('/configuracoes/impostos'),

    // Buscar imposto vigente
    buscarVigente: (dataReferencia?: string) =>
        api.get<ImpostoVigente>('/configuracoes/impostos/vigente', {
            params: dataReferencia ? { data_referencia: dataReferencia } : undefined
        }),

    // Buscar imposto por ID
    buscarImposto: (id: number) =>
        api.get<Imposto>(`/configuracoes/impostos/${id}`),

    // Criar novo imposto
    criarImposto: (dados: ImpostoCreate) =>
        api.post<Imposto>('/configuracoes/impostos', dados),

    // Atualizar imposto
    atualizarImposto: (id: number, dados: ImpostoUpdate) =>
        api.put<Imposto>(`/configuracoes/impostos/${id}`, dados),

    // Excluir imposto
    excluirImposto: (id: number) =>
        api.delete(`/configuracoes/impostos/${id}`),
};

export default configuracoesApi;
