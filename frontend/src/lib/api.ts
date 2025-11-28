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
    numero_imovel?: string;
    complemento?: string;
    bairro?: string;
    nome_municipio?: string;
    uf?: string;
    uc_ativa?: boolean;
    uc_cortada?: boolean;
    uc_desligada?: boolean;
    contrato_ativo?: boolean;
    is_geradora: boolean;
    saldo_acumulado: number;
    percentual_rateio: number;
    tipo_geracao?: string;
    beneficiarias?: UnidadeConsumidora[];
    ucAtiva?: boolean;  // Alias para compatibilidade com API Energisa
    digito_verificador?: number;
    empresa_web?: number;
    usuarioGerenciandoCdcs?: any[];  // Se existe, usuário é proprietário
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

// Interfaces para Geração Distribuída (GD)
export interface DiscriminacaoEnergia {
    cdc: number;
    anoReferencia: number;
    mesReferencia: number;
    numUcMovimento: number;
    consumoRecebidoOuTransferido: number;
    consumoConvMovimentado: number;
    consumoConvMovimentadoRecebidoOuTranferido: number;
    consumoConvMovimentadoTransferidoPercentual: number;
    endereco: string;
    numeroImovel: string;
    complemento: string;
    uf: string;
    nomeMunicipio: string;
    bairro: string;
    codigoEmpresaWeb: number;
    digitoVerificador: number;
}

export interface ComposicaoEnergia {
    cdc: number;
    anoReferencia: number;
    mesReferencia: number;
    saldoAnteriorConv: number;
}

export interface HistoricoMensalGD {
    cdc: number;
    anoReferencia: number;
    mesReferencia: number;
    saldoAnteriorConv: number;
    injetadoConv: number;
    totalRecebidoRede: number;
    consumoRecebidoConv: number;
    consumoInjetadoCompensadoConv: number;
    consumoRecebidoCompensadoConv: number;
    consumoTransferidoConv: number;
    consumoCompensadoConv: number;
    estornoConvecional: number;
    composicaoEnergiaInjetadas: ComposicaoEnergia[];
    discriminacaoEnergiaInjetadas: DiscriminacaoEnergia[];
    chavePrimaria: string;
    dataModificacaoRegistro: string;
}

export interface UsinaDetalhes {
    id: number;
    codigo_uc: number;
    cdc: number;
    endereco: string;
    saldo_atual: number;
    tipo_geracao?: string;
    empresa_nome?: string;
    ucAtiva?: boolean;
}

export interface GDDetailsResponse {
    usina: UsinaDetalhes;
    historico_mensal: HistoricoMensalGD[];
    fonte: 'gateway' | 'banco_local';
}

// Interfaces para Gestores de UC
export interface SolicitacaoGestor {
    id: number;
    cliente_id: number;
    uc_id?: number;
    cdc: number;
    digito_verificador: number;
    empresa_web: number;
    cpf_gestor: string;
    nome_gestor?: string;
    status: 'PENDENTE' | 'AGUARDANDO_CODIGO' | 'CONCLUIDA' | 'EXPIRADA' | 'CANCELADA' | 'ERRO';
    criado_em: string;
    expira_em?: string;
    concluido_em?: string;
    mensagem?: string;
    endereco_uc?: string;
    nome_empresa?: string;
}

export interface SolicitarGestorPayload {
    cliente_id: number;
    uc_id?: number;
    cdc: number;
    digito_verificador: number;
    empresa_web?: number;
    cpf_gestor: string;
    nome_gestor?: string;
    is_proprietario: boolean;
}

export interface ValidarCodigoPayload {
    solicitacao_id: number;
    codigo: string;
}

// Funcoes de API para Gestores
export const gestoresApi = {
    // Criar solicitacao de gestor
    solicitar: (payload: SolicitarGestorPayload) =>
        api.post<SolicitacaoGestor>('/gestores/solicitar', payload),

    // Listar solicitacoes pendentes
    listarPendentes: () =>
        api.get<SolicitacaoGestor[]>('/gestores/pendentes'),

    // Validar codigo de autorizacao
    validarCodigo: (payload: ValidarCodigoPayload) =>
        api.post<SolicitacaoGestor>('/gestores/validar-codigo', payload),

    // Cancelar solicitacao
    cancelar: (solicitacaoId: number) =>
        api.delete(`/gestores/pendentes/${solicitacaoId}`)
};
