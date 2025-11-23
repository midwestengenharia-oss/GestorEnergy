import axios from 'axios';

export const api = axios.create({
    baseURL: 'http://localhost:8000',
});

export interface Fatura {
    id: number;
    mes: number;
    ano: number;
    valor: number;
    status: string;
    numero_fatura: number;
    // Novos campos para o Modal
    codigo_barras?: string;
    pix_copia_cola?: string;
    consumo_kwh?: number;
    data_leitura?: string;
    vencimento?: string;
    detalhes_json?: string; // Vem como string do banco
}

export interface UnidadeConsumidora {
    id: number;
    codigo_uc: number;
    endereco: string;
    is_geradora: boolean;
    saldo_acumulado: number;
    // Não trazemos mais faturas aqui direto
}

export interface Empresa {
    id: number;
    nome_empresa: string;
    status_conexao: string;
}
// frontend/src/lib/api.ts

export interface UnidadeConsumidora {
    id: number;
    codigo_uc: number;
    cdc: number;
    endereco: string;
    nome_titular?: string;
    is_geradora: boolean;
    saldo_acumulado: number;
    percentual_rateio: number;
    // A mágica do auto-relacionamento no frontend
    beneficiarias?: UnidadeConsumidora[];
}
// ... outros interfaces ...