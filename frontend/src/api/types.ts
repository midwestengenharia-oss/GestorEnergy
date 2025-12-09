/**
 * Tipos compartilhados da API
 */

// ========================
// Auth
// ========================

export type PerfilTipo = 'superadmin' | 'proprietario' | 'gestor' | 'beneficiario' | 'usuario' | 'parceiro';

export interface Usuario {
    id: string;  // UUID do Supabase
    auth_id: string;
    nome_completo: string;
    email: string;
    cpf: string;
    telefone?: string;
    is_superadmin: boolean;
    ativo: boolean;
    email_verificado: boolean;
    perfis: PerfilTipo[];
    criado_em?: string;
    atualizado_em?: string;
}

export interface AuthTokens {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
}

export interface SignUpRequest {
    email: string;
    password: string;
    nome_completo: string;
    cpf: string;
    telefone?: string;
}

export interface SignInRequest {
    email: string;
    password: string;
}

export interface SignUpResponse {
    user: Usuario;
    tokens: AuthTokens;
}

export interface SignInResponse {
    user: Usuario;
    tokens: AuthTokens;
    perfis_disponiveis: PerfilTipo[];
}

export interface PerfilResponse {
    perfil: PerfilTipo;
    ativo: boolean;
}

// ========================
// UCs
// ========================

export interface UnidadeConsumidora {
    id: number;
    usuario_id: string;
    cod_empresa: number;
    cdc: number;
    digito_verificador: number;
    apelido?: string;  // Nome personalizado da UC
    cpf_cnpj_titular?: string;
    nome_titular?: string;
    usuario_titular: boolean;
    endereco?: string;
    numero_imovel?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
    cep?: string;
    tipo_ligacao?: string;
    classe_leitura?: string;
    grupo_leitura?: string;
    uc_ativa: boolean;
    uc_cortada: boolean;
    contrato_ativo: boolean;
    is_geradora: boolean;
    geradora_id?: number;
    percentual_rateio?: number;
    saldo_acumulado: number;
    criado_em?: string;
    atualizado_em?: string;
}

// ========================
// Usinas
// ========================

export interface Usina {
    id: number;
    empresa_id?: number;
    uc_geradora_id: number;
    nome?: string;
    capacidade_kwp?: number;
    tipo_geracao: string;
    data_conexao?: string;
    desconto_padrao: number;
    status: string;
    endereco?: string;
    latitude?: number;
    longitude?: number;
    criado_em?: string;
    atualizado_em?: string;
    // Relacionamentos
    uc_geradora?: UnidadeConsumidora;
    total_beneficiarios?: number;
}

// ========================
// Beneficiários
// ========================

export interface Beneficiario {
    id: number;
    usuario_id?: string;
    uc_id: number;
    usina_id: number;
    contrato_id?: number;
    cpf: string;
    nome?: string;
    email?: string;
    telefone?: string;
    percentual_rateio: number;
    desconto: number;
    status: string;
    convite_enviado_em?: string;
    ativado_em?: string;
    criado_em?: string;
    atualizado_em?: string;
    // Relacionamentos
    uc?: UnidadeConsumidora;
    usina?: Usina;
}

// ========================
// Faturas
// ========================

export interface FaturaAviso {
    categoria: string;
    campo: string;
    mensagem: string;
    severidade: 'warning' | 'error';
}

export interface Fatura {
    id: number;
    uc_id: number;
    numero_fatura?: number;
    mes_referencia: number;
    ano_referencia: number;
    referencia_formatada?: string;  // "01/2024"
    valor_fatura: number;
    valor_liquido?: number;
    consumo?: number;
    leitura_atual?: number;
    leitura_anterior?: number;
    media_consumo?: number;
    quantidade_dias?: number;
    valor_iluminacao_publica?: number;
    valor_icms?: number;
    bandeira_tarifaria?: string;
    data_leitura?: string;
    data_vencimento: string;
    data_pagamento?: string;
    indicador_situacao?: number;
    indicador_pagamento?: boolean;
    situacao_pagamento?: string;
    qr_code_pix?: string;
    qr_code_pix_image?: string;  // Imagem base64 do QR Code PIX
    codigo_barras?: string;
    pdf_path?: string;
    pdf_base64?: string;  // PDF da fatura em base64
    pdf_baixado_em?: string;
    sincronizado_em?: string;
    criado_em?: string;
    atualizado_em?: string;

    // Campos de extração com IA
    dados_extraidos?: any;  // Dados estruturados extraídos do PDF
    extracao_status?: 'PENDENTE' | 'PROCESSANDO' | 'CONCLUIDA' | 'ERRO';
    extracao_error?: string;
    extraido_em?: string;
    extracao_score?: number;  // Score de confiança (0-100)
    extracao_avisos?: FaturaAviso[];  // Avisos da validação
}

// ========================
// Cobrancas
// ========================

export type CobrancaStatus = 'PENDENTE' | 'PAGA' | 'VENCIDA' | 'CANCELADA';

export interface Cobranca {
    id: number;
    beneficiario_id: number;
    fatura_id?: number;
    mes: number;
    ano: number;
    kwh_creditado: number;
    tarifa_energisa: number;
    desconto_aplicado: number;
    valor_energia: number;
    valor_piso: number;
    valor_iluminacao: number;
    valor_total: number;
    valor_sem_desconto?: number;
    economia?: number;
    vencimento: string;
    status: CobrancaStatus;
    pago_em?: string;
    forma_pagamento?: string;
    codigo_barras?: string;
    pix_copia_cola?: string;
    criado_em?: string;
}

// ========================
// Contratos
// ========================

export type ContratoTipo = 'GESTOR_PROPRIETARIO' | 'GESTOR_BENEFICIARIO' | 'PROPRIETARIO_BENEFICIARIO';
export type ContratoStatus = 'RASCUNHO' | 'AGUARDANDO_ASSINATURA' | 'ATIVO' | 'EXPIRADO' | 'CANCELADO';

export interface Contrato {
    id: number;
    tipo: ContratoTipo;
    parte_a_id: string;
    parte_b_id: string;
    usina_id?: number;
    beneficiario_id?: number;
    conteudo_html?: string;
    hash_documento?: string;
    assinado_a_em?: string;
    assinado_b_em?: string;
    status: ContratoStatus;
    vigencia_inicio?: string;
    vigencia_fim?: string;
    percentual_rateio?: number;
    desconto?: number;
    comissao?: number;
    criado_em?: string;
}

// ========================
// Saques
// ========================

export type SaqueStatus = 'PENDENTE' | 'APROVADO' | 'REJEITADO' | 'PAGO';

export interface Saque {
    id: number;
    usuario_id: string;
    valor: number;
    banco?: string;
    agencia?: string;
    conta?: string;
    tipo_conta?: string;
    pix_chave?: string;
    nf_numero?: string;
    nf_path?: string;
    nf_validada: boolean;
    status: SaqueStatus;
    aprovado_por_id?: string;
    aprovado_em?: string;
    motivo_rejeicao?: string;
    pago_em?: string;
    comprovante_path?: string;
    criado_em?: string;
}

// ========================
// Leads
// ========================

export type LeadStatus = 'NOVO' | 'SIMULACAO' | 'CONTATO' | 'NEGOCIACAO' | 'CONVERTIDO' | 'PERDIDO';
export type LeadOrigem = 'LANDING_PAGE' | 'INDICACAO' | 'GOOGLE_ADS' | 'FACEBOOK' | 'INSTAGRAM' | 'WHATSAPP' | 'TELEFONE' | 'OUTROS';

export interface Lead {
    id: number;
    nome: string;
    email?: string;
    telefone?: string;
    cpf: string;
    cidade?: string;
    uf?: string;
    status: LeadStatus;
    origem: LeadOrigem;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    responsavel_id?: string;
    observacoes?: string;
    convertido_em?: string;
    beneficiario_id?: number;
    criado_em?: string;
    atualizado_em?: string;
}

// ========================
// Notificacoes
// ========================

export type NotificacaoTipo = 'FATURA' | 'CONTRATO' | 'SAQUE' | 'CONVITE' | 'COBRANCA' | 'GD' | 'SISTEMA';

export interface Notificacao {
    id: number;
    usuario_id: string;
    tipo: NotificacaoTipo;
    titulo: string;
    mensagem?: string;
    link?: string;
    acao?: string;
    referencia_tipo?: string;
    referencia_id?: number;
    lida: boolean;
    lida_em?: string;
    criado_em?: string;
}

// ========================
// Paginação
// ========================

export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
}
