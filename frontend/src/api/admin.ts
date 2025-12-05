/**
 * API - Admin
 */

import { api } from './client';

// ==================== TIPOS ====================

export interface DashboardStats {
    // Usuários
    total_usuarios: number;
    usuarios_ativos: number;
    novos_usuarios_mes: number;

    // Usinas
    total_usinas: number;
    usinas_ativas: number;
    capacidade_total_kwp: number;

    // Beneficiários
    total_beneficiarios: number;
    beneficiarios_ativos: number;
    novos_beneficiarios_mes: number;

    // UCs
    total_ucs: number;
    ucs_geradoras: number;
    ucs_beneficiarias: number;

    // Financeiro
    valor_total_cobrancas_mes: number;
    valor_recebido_mes: number;
    valor_pendente_mes: number;
    taxa_inadimplencia: number;
}

export interface ConfiguracaoSistema {
    chave: string;
    valor: string;
    descricao?: string;
    tipo: 'string' | 'number' | 'boolean' | 'json';
}

export interface LogAuditoria {
    id: number;
    usuario_id: string;
    usuario_nome: string;
    acao: string;
    entidade: string;
    entidade_id?: number;
    dados_antes?: any;
    dados_depois?: any;
    ip?: string;
    criado_em: string;
}

export interface LogFilters {
    usuario_id?: string;
    acao?: string;
    entidade?: string;
    page?: number;
    per_page?: number;
}

export interface GraficoRequest {
    tipo: string;
    periodo?: string;
    usina_id?: number;
}

export interface GraficoResponse {
    labels: string[];
    datasets: {
        label: string;
        data: number[];
        borderColor?: string;
        backgroundColor?: string;
    }[];
}

export interface RelatorioRequest {
    tipo: string;
    data_inicio: string;
    data_fim: string;
    usina_id?: number;
    formato?: 'json' | 'pdf' | 'xlsx' | 'csv';
    filtros?: Record<string, any>;
}

export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
}

export interface Lead {
    id: number;
    nome: string;
    email?: string;
    telefone?: string;
    status: string;
    origem?: string;
    criado_em: string;
}

export interface IntegracaoStatus {
    nome: string;
    status: 'online' | 'offline' | 'erro';
    ultima_verificacao: string;
    mensagem?: string;
}

export const adminApi = {
    // ==================== DASHBOARD ====================

    // Estatísticas gerais do dashboard
    estatisticas: () =>
        api.get<DashboardStats>('/admin/dashboard/stats'),

    // Gerar dados para gráficos
    grafico: (data: GraficoRequest) =>
        api.post<GraficoResponse>('/admin/dashboard/grafico', data),

    // ==================== CONFIGURAÇÕES ====================

    // Listar configurações
    listarConfiguracoes: () =>
        api.get<ConfiguracaoSistema[]>('/admin/configuracoes'),

    // Atualizar configuração
    atualizarConfiguracao: (chave: string, valor: string) =>
        api.put(`/admin/configuracoes/${chave}`, { valor }),

    // ==================== LOGS ====================

    // Listar logs de auditoria
    listarLogs: (filters?: LogFilters) =>
        api.get<{ logs: LogAuditoria[]; total: number; page: number; per_page: number; total_pages: number }>('/admin/logs', { params: filters }),

    // ==================== RELATÓRIOS ====================

    // Gerar relatório
    gerarRelatorio: (data: RelatorioRequest) =>
        api.post<{ tipo: string; periodo: string; gerado_em: string; dados: any; total_registros: number }>('/admin/relatorios', data),

    // ==================== INTEGRAÇÕES ====================

    // Verificar status das integrações
    verificarIntegracoes: () =>
        api.get<{
            supabase: IntegracaoStatus;
            energisa: IntegracaoStatus;
            email: IntegracaoStatus;
        }>('/admin/integracoes'),

    // Health check detalhado
    healthDetailed: () =>
        api.get<{
            status: string;
            timestamp: string;
            integracoes: Record<string, IntegracaoStatus>;
            versao: string;
        }>('/admin/health-detailed'),

    // ==================== SINCRONIZAÇÃO ====================

    // Status da sincronização
    syncStatus: () =>
        api.get<{
            resumo: {
                total_ucs: number;
                ucs_atualizadas: number;
                ucs_desatualizadas: number;
                ucs_nunca_sincronizadas: number;
                sessoes_ativas: number;
                total_faturas: number;
                faturas_com_pdf: number;
            };
            ucs_atualizadas: any[];
            ucs_desatualizadas: any[];
            ucs_nunca_sincronizadas: any[];
            sessoes: any[];
        }>('/admin/sync/status'),

    // Forçar sincronização de uma UC
    forcarSync: (ucId: number) =>
        api.post<{ success: boolean; message: string; resultado?: any }>(`/admin/sync/forcar/${ucId}`),
};

export default adminApi;
