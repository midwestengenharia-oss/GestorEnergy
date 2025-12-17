/**
 * API - Leads / CRM
 * Pipeline completo de vendas e onboarding de clientes
 */

import { api } from './client';

// ========================
// Enums e Tipos
// ========================

export type StatusLead =
    | 'NOVO'
    | 'VINCULANDO'
    | 'VINCULADO'
    | 'SIMULACAO'
    | 'CONTATO'
    | 'NEGOCIACAO'
    | 'AGUARDANDO_ACEITE'
    | 'ACEITO'
    | 'AGUARDANDO_ASSINATURA'
    | 'ASSINADO'
    | 'TROCA_TITULARIDADE'
    | 'CADASTRANDO'
    | 'CONVERTIDO'
    | 'PERDIDO';

export type TipoPessoa = 'FISICA' | 'JURIDICA';

export type TitularidadeStatus =
    | 'PENDENTE'
    | 'SOLICITADO'
    | 'EM_ANALISE'
    | 'APROVADO'
    | 'REJEITADO';

export type MotivoPerdaCategoria =
    | 'PRECO'
    | 'LOCALIZACAO'
    | 'UC_INCOMPATIVEL'
    | 'DESISTENCIA'
    | 'CONCORRENCIA'
    | 'SEM_INTERESSE'
    | 'OUTROS';

export type OrigemLead =
    | 'LANDING_PAGE'
    | 'INDICACAO'
    | 'GOOGLE_ADS'
    | 'FACEBOOK'
    | 'INSTAGRAM'
    | 'WHATSAPP'
    | 'TELEFONE'
    | 'EVENTO'
    | 'PARCEIRO'
    | 'OUTROS';

export type TipoDocumentoLead =
    | 'RG'
    | 'CPF'
    | 'CNH'
    | 'CNPJ'
    | 'CONTRATO_SOCIAL'
    | 'COMPROVANTE_RESIDENCIA'
    | 'CONTA_ENERGIA'
    | 'PROCURACAO'
    | 'CONTRATO'
    | 'OUTROS';

export type TipoVinculoUC = 'GERADORA' | 'BENEFICIARIA' | 'SIMULACAO';

export type StatusProposta = 'GERADA' | 'ENVIADA' | 'VISUALIZADA' | 'ACEITA' | 'RECUSADA' | 'EXPIRADA';

// ========================
// Interfaces - Entidades
// ========================

export interface Simulacao {
    id: number;
    lead_id: number;
    valor_fatura_media: number;
    consumo_medio_kwh: number | null;
    quantidade_ucs: number;
    desconto_aplicado: number;
    economia_mensal: number;
    economia_anual: number;
    percentual_economia: number;
    criado_em: string | null;
}

export interface Contato {
    id: number;
    lead_id: number;
    tipo_contato: string;
    descricao: string;
    proximo_contato: string | null;
    realizado_por: string | null;
    criado_em: string;
}

export interface LeadUC {
    id: number;
    lead_id: number;
    uc_id: number;
    tipo: TipoVinculoUC;
    status: string;
    vinculado_em: string | null;
    uc_codigo: string | null;
    uc_endereco: string | null;
    dados_extras: Record<string, any> | null;
}

export interface LeadProposta {
    id: number;
    lead_id: number;
    versao: number;
    consumo_kwh: number | null;
    valor_fatura: number | null;
    quantidade_ucs: number;
    tarifa_aplicada: number | null;
    desconto_aplicado: number;
    custo_atual: number | null;
    custo_com_desconto: number | null;
    economia_mensal: number | null;
    economia_anual: number | null;
    economia_10_anos: number | null;
    status: StatusProposta;
    enviada_em: string | null;
    visualizada_em: string | null;
    aceita_em: string | null;
    recusada_em: string | null;
    motivo_recusa: string | null;
    html_proposta: string | null;
    criado_em: string;
}

export interface LeadDocumento {
    id: number;
    lead_id: number;
    tipo: TipoDocumentoLead;
    nome_arquivo: string;
    url_arquivo: string | null;
    tamanho_bytes: number | null;
    descricao: string | null;
    criado_em: string;
}

export interface Lead {
    id: number;
    nome: string;
    tipo_pessoa: TipoPessoa;

    // Documentos
    cpf: string | null;
    cnpj: string | null;
    rg: string | null;
    data_nascimento: string | null;
    nacionalidade: string | null;
    nome_mae: string | null;

    // Contato
    email: string | null;
    telefone: string | null;
    telefones_adicionais: string[] | null;

    // Endereco
    logradouro: string | null;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
    cidade: string | null;
    uf: string | null;
    cep: string | null;

    // Dados adicionais
    concessionaria: string | null;
    renda_faturamento: number | null;

    // Status e origem
    status: StatusLead;
    origem: OrigemLead;

    // UTM
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;

    // Responsavel
    responsavel_id: string | null;
    responsavel_nome: string | null;

    // Observacoes
    observacoes: string | null;

    // Titularidade
    titularidade_status: TitularidadeStatus | null;
    titularidade_protocolo: string | null;
    titularidade_data_solicitacao: string | null;
    titularidade_data_conclusao: string | null;

    // Proposta
    proposta_aceita_em: string | null;
    proposta_dados: Record<string, any> | null;

    // Conversao
    convertido_em: string | null;
    beneficiario_id: number | null;
    contrato_id: number | null;
    motivo_perda_categoria: MotivoPerdaCategoria | null;

    // Timestamps
    criado_em: string | null;
    atualizado_em: string | null;

    // Relacionamentos
    simulacoes: Simulacao[] | null;
    contatos: Contato[] | null;
    ucs: LeadUC[] | null;
    documentos: LeadDocumento[] | null;
    propostas: LeadProposta[] | null;
}

// ========================
// Interfaces - Requests
// ========================

export interface LeadFilters {
    status?: string;
    origem?: string;
    responsavel_id?: string;
    busca?: string;
    page?: number;
    per_page?: number;
}

export interface LeadCreateRequest {
    nome: string;
    cidade: string;
    concessionaria?: string;
    tipo_pessoa?: TipoPessoa;
    cpf?: string;
    cnpj?: string;
    email?: string;
    telefone?: string;
    uf?: string;
    origem?: OrigemLead;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
}

export interface LeadUpdateRequest {
    nome?: string;
    tipo_pessoa?: TipoPessoa;
    cpf?: string;
    cnpj?: string;
    email?: string;
    telefone?: string;
    telefones_adicionais?: string[];
    rg?: string;
    data_nascimento?: string;
    nacionalidade?: string;
    nome_mae?: string;
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
    cep?: string;
    concessionaria?: string;
    renda_faturamento?: number;
    status?: StatusLead;
    responsavel_id?: string;
    observacoes?: string;
    titularidade_status?: TitularidadeStatus;
    titularidade_protocolo?: string;
    titularidade_data_solicitacao?: string;
    titularidade_data_conclusao?: string;
}

export interface LeadSimulacaoRequest {
    lead_id: number;
    valor_fatura_media: number;
    consumo_medio_kwh?: number;
    quantidade_ucs?: number;
}

export interface LeadContatoRequest {
    tipo_contato: string;
    descricao: string;
    proximo_contato?: string;
}

export interface LeadVincularUCRequest {
    uc_codigo: string;
    tipo?: TipoVinculoUC;
    dados_extras?: Record<string, any>;
}

export interface LeadPropostaRequest {
    consumo_kwh?: number;
    valor_fatura?: number;
    quantidade_ucs?: number;
    desconto_aplicado?: number;
    enviar_proposta?: boolean;
}

export interface LeadTitularidadeRequest {
    status: TitularidadeStatus;
    protocolo?: string;
    observacoes?: string;
}

export interface LeadDocumentoRequest {
    tipo: TipoDocumentoLead;
    nome_arquivo: string;
    url_arquivo?: string;
    tamanho_bytes?: number;
    mime_type?: string;
    descricao?: string;
}

export interface LeadMarcarPerdidoRequest {
    motivo_categoria: MotivoPerdaCategoria;
    observacoes?: string;
}

export interface LeadConverterRequest {
    usina_id: number;
    uc_id: number;                  // UC nova (pos-titularidade, no nome da geradora)
    uc_id_origem?: number;          // UC original do cliente (antes da troca de titularidade)
    desconto_percentual: number;
    percentual_rateio?: number;
    criar_contrato?: boolean;
    enviar_convite?: boolean;
}

// ========================
// Interfaces - Responses
// ========================

export interface LeadListResponse {
    leads: Lead[];
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
}

export interface EstatisticasResponse {
    total_leads: number;
    leads_novos: number;
    leads_em_contato: number;
    leads_convertidos: number;
    leads_perdidos: number;
    taxa_conversao: number;
    economia_total_simulada: number;
    por_origem: { origem: string; quantidade: number }[];
    por_status: { status: string; quantidade: number }[];
}

export interface FunilEtapa {
    nome: string;
    status: StatusLead;
    quantidade: number;
}

export interface FunilResponse {
    etapas: FunilEtapa[];
    total: number;
    taxa_conversao_geral: number;
}

export interface ConversaoResponse {
    lead_id: number;
    beneficiario_id: number;
    contrato_id: number | null;
    convite_id: number | null;
    message: string;
}

// ========================
// API
// ========================

export const leadsApi = {
    // ========================
    // CRUD Basico
    // ========================

    listar: (filters?: LeadFilters) =>
        api.get<LeadListResponse>('/leads', { params: filters }),

    buscar: (id: number) =>
        api.get<Lead>(`/leads/${id}`),

    criar: (data: LeadCreateRequest) =>
        api.post<Lead>('/leads/captura', data),

    atualizar: (id: number, data: LeadUpdateRequest) =>
        api.put<Lead>(`/leads/${id}`, data),

    // ========================
    // Endpoints Publicos
    // ========================

    capturar: (data: LeadCreateRequest) =>
        api.post<Lead>('/leads/captura', data),

    simular: (data: LeadSimulacaoRequest) =>
        api.post<Simulacao>('/leads/simular', data),

    // ========================
    // Estatisticas e Funil
    // ========================

    estatisticas: () =>
        api.get<EstatisticasResponse>('/leads/estatisticas'),

    funil: () =>
        api.get<FunilResponse>('/leads/funil'),

    // ========================
    // Contatos e Atribuicao
    // ========================

    registrarContato: (id: number, data: LeadContatoRequest) =>
        api.post<Contato>(`/leads/${id}/contato`, data),

    atribuir: (id: number, responsavel_id: string) =>
        api.post<Lead>(`/leads/${id}/atribuir?responsavel_id=${responsavel_id}`),

    // ========================
    // UCs do Lead
    // ========================

    listarUCs: (leadId: number) =>
        api.get<LeadUC[]>(`/leads/${leadId}/ucs`),

    vincularUC: (leadId: number, data: LeadVincularUCRequest) =>
        api.post<LeadUC>(`/leads/${leadId}/ucs`, data),

    // ========================
    // Propostas
    // ========================

    listarPropostas: (leadId: number) =>
        api.get<LeadProposta[]>(`/leads/${leadId}/propostas`),

    gerarProposta: (leadId: number, data: LeadPropostaRequest) =>
        api.post<LeadProposta>(`/leads/${leadId}/propostas`, data),

    enviarProposta: (propostaId: number) =>
        api.post<LeadProposta>(`/leads/propostas/${propostaId}/enviar`),

    aceitarProposta: (leadId: number, propostaId: number) =>
        api.post<{ lead_id: number; proposta_id: number; status: string; message: string }>(
            `/leads/${leadId}/propostas/${propostaId}/aceitar`
        ),

    // ========================
    // Titularidade
    // ========================

    atualizarTitularidade: (leadId: number, data: LeadTitularidadeRequest) =>
        api.post<Lead>(`/leads/${leadId}/titularidade`, data),

    // ========================
    // Documentos
    // ========================

    listarDocumentos: (leadId: number) =>
        api.get<LeadDocumento[]>(`/leads/${leadId}/documentos`),

    adicionarDocumento: (leadId: number, data: LeadDocumentoRequest) =>
        api.post<LeadDocumento>(`/leads/${leadId}/documentos`, data),

    removerDocumento: (documentoId: number) =>
        api.delete<{ message: string; success: boolean }>(`/leads/documentos/${documentoId}`),

    // ========================
    // Perda e Conversao
    // ========================

    marcarPerdido: (id: number, motivo: string) =>
        api.post<Lead>(`/leads/${id}/perder?motivo=${encodeURIComponent(motivo)}`),

    marcarPerdidoCategorizado: (leadId: number, data: LeadMarcarPerdidoRequest) =>
        api.post<Lead>(`/leads/${leadId}/perder-categorizado`, data),

    converter: (leadId: number, data: LeadConverterRequest) =>
        api.post<ConversaoResponse>(`/leads/${leadId}/converter-completo`, data),
};

export default leadsApi;
