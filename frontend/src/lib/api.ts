import axios from 'axios';

// URL da API configuravel por ambiente
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const api = axios.create({
    baseURL: API_URL,
});

// Interceptor para tratamento global de erros
api.interceptors.response.use(
    (response) => response,
    (error) => {
        // Extrai mensagem de erro do backend
        const message = error.response?.data?.detail || error.message || 'Erro desconhecido';

        // Cria erro com mensagem mais amigavel
        const enhancedError = new Error(message);
        (enhancedError as any).status = error.response?.status;
        (enhancedError as any).originalError = error;

        return Promise.reject(enhancedError);
    }
);

export interface Fatura {
    id: number;
    mes: number;
    ano: number;
    valor: number;
    status: string;
    numero_fatura: number;
    codigo_barras?: string;
    pix_copia_cola?: string;
    consumo_kwh?: number;
    data_leitura?: string;
    vencimento?: string;
    detalhes_json?: string;
}

export interface UnidadeConsumidora {
    id: number;
    codigo_uc: number;
    cdc: number;
    endereco: string;
    nome_titular?: string;
    is_geradora: boolean;
    saldo_acumulado: number;
    percentual_rateio: number;
    tipo_geracao?: string;
    beneficiarias?: UnidadeConsumidora[];
}

export interface Empresa {
    id: number;
    nome_empresa: string;
    responsavel_cpf: string;
    telefone_login: string;
    status_conexao: string;
    ultimo_login?: string;
    ultimo_sync?: string;
    status_sync?: string;
    mensagem_sync?: string;
}

export interface SyncStatus {
    cliente_id: number;
    status: 'PENDENTE' | 'SINCRONIZANDO' | 'CONCLUIDO' | 'ERRO';
    ultimo_sync?: string;
    mensagem?: string;
}
