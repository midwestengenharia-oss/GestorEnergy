/**
 * API - Integração com Energisa
 * Endpoints para autenticação e sincronização com a Energisa
 */

import { api } from './client';

export interface LoginStartResponse {
    transaction_id: string;
    listaTelefone: Array<{
        celular: string;
        cdc?: number;
        posicao?: number;
    }>;
    listaEmail: Array<{
        email: string;
        codigoEmpresaWeb?: number;
        cdc?: number;
        digitoVerificador?: number;
        posicao?: number;
    }>;
}

export interface UcEnergisa {
    numeroUc: number;
    digitoVerificador: number;
    codigoEmpresaWeb: number;
    endereco?: string;
    numeroImovel?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    nomeMunicipio?: string;
    uf?: string;
    tipoLigacao?: string;
    status?: string;
    nomeTitular?: string;
    usuarioTitular?: boolean;
    latitude?: number;
    longitude?: number;
    classeLeitura?: string;
    grupoLeitura?: string;
    ucAtiva?: boolean;
    geracaoDistribuida?: number | null; // Se != null, é geradora
}

export interface FaturaEnergisa {
    numeroFatura: number;
    mesReferencia: number;
    anoReferencia: number;
    valorFatura: number;
    consumo: number;
    dataVencimento: string;
    dataPagamento?: string;
    situacaoPagamento: string;
}

export const energisaApi = {
    // ==================
    // Login na Energisa
    // ==================

    /**
     * Inicia o processo de login na Energisa
     * Retorna lista de telefones para envio do SMS
     */
    loginStart: (cpf: string) =>
        api.post<LoginStartResponse>('/energisa/login/start', { cpf }),

    /**
     * Seleciona o telefone para receber o SMS
     */
    loginSelectOption: (transaction_id: string, telefone: string) =>
        api.post<{ message: string }>('/energisa/login/select-option', {
            transaction_id,
            opcao_selecionada: telefone
        }),

    /**
     * Finaliza o login com o código SMS
     */
    loginFinish: (transaction_id: string, sms_code: string) =>
        api.post<{ success: boolean; tokens: string[]; message: string }>('/energisa/login/finish', {
            transaction_id,
            sms_code
        }),

    // ==================
    // UCs da Energisa
    // ==================

    /**
     * Lista todas as UCs do CPF na Energisa
     */
    listarUcs: (cpf: string) =>
        api.post<UcEnergisa[]>('/energisa/ucs', { cpf }),

    /**
     * Busca informações detalhadas de uma UC
     */
    infoUc: (cpf: string, cdc: number, digitoVerificador: number, codigoEmpresaWeb: number = 6) =>
        api.post<any>('/energisa/ucs/info', {
            cpf,
            cdc,
            digitoVerificadorCdc: digitoVerificador,
            codigoEmpresaWeb
        }),

    // ==================
    // Faturas da Energisa
    // ==================

    /**
     * Lista faturas de uma UC na Energisa
     */
    listarFaturas: (cpf: string, cdc: number, digitoVerificador: number, codigoEmpresaWeb: number = 6) =>
        api.post<FaturaEnergisa[]>('/energisa/faturas/listar', {
            cpf,
            cdc,
            digitoVerificadorCdc: digitoVerificador,
            codigoEmpresaWeb
        }),

    /**
     * Baixa PDF de uma fatura
     */
    downloadPdf: (cpf: string, cdc: number, digitoVerificador: number, ano: number, mes: number, numeroFatura: number) =>
        api.post<{ filename: string; content_type: string; file_base64: string }>('/energisa/faturas/pdf', {
            cpf,
            cdc,
            digitoVerificadorCdc: digitoVerificador,
            codigoEmpresaWeb: 6,
            ano,
            mes,
            numeroFatura
        }),

    // ==================
    // GD (Geração Distribuída)
    // ==================

    /**
     * Busca informações de GD de uma UC
     */
    gdInfo: (cpf: string, cdc: number, digitoVerificador: number, codigoEmpresaWeb: number = 6) =>
        api.post<any>('/energisa/gd/info', {
            cpf,
            cdc,
            digitoVerificadorCdc: digitoVerificador,
            codigoEmpresaWeb
        }),

    /**
     * Busca detalhes de GD (histórico de créditos)
     */
    gdDetails: (cpf: string, cdc: number, digitoVerificador: number, codigoEmpresaWeb: number = 6) =>
        api.post<any>('/energisa/gd/details', {
            cpf,
            cdc,
            digitoVerificadorCdc: digitoVerificador,
            codigoEmpresaWeb
        }),
};

export default energisaApi;
