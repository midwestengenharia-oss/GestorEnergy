/**
 * LeadDetail - Pagina de detalhe completo do lead com pipeline CRM
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    Loader2,
    User,
    Building2,
    Phone,
    Mail,
    MapPin,
    Calendar,
    FileText,
    Zap,
    DollarSign,
    Send,
    Check,
    X,
    Plus,
    Upload,
    Trash2,
    Edit3,
    MessageCircle,
    TrendingUp,
    Clock,
    AlertCircle,
    ChevronRight,
    RefreshCw,
    UserCheck,
    FileSignature,
    Home
} from 'lucide-react';
import { leadsApi, type Lead, type LeadUC, type LeadProposta, type LeadDocumento, type StatusLead } from '../../api/leads';

// ========================
// Configuracoes
// ========================

const STATUS_CONFIG: Record<StatusLead, { label: string; color: string; icon: any; step: number }> = {
    NOVO: { label: 'Novo', color: 'bg-blue-500', icon: User, step: 1 },
    VINCULANDO: { label: 'Vinculando UC', color: 'bg-blue-400', icon: Zap, step: 2 },
    VINCULADO: { label: 'UC Vinculada', color: 'bg-blue-600', icon: Home, step: 3 },
    SIMULACAO: { label: 'Simulacao', color: 'bg-purple-500', icon: TrendingUp, step: 4 },
    CONTATO: { label: 'Em Contato', color: 'bg-yellow-500', icon: MessageCircle, step: 5 },
    NEGOCIACAO: { label: 'Negociando', color: 'bg-orange-500', icon: DollarSign, step: 6 },
    AGUARDANDO_ACEITE: { label: 'Aguardando Aceite', color: 'bg-orange-400', icon: Clock, step: 7 },
    ACEITO: { label: 'Aceito', color: 'bg-green-400', icon: Check, step: 8 },
    AGUARDANDO_ASSINATURA: { label: 'Aguardando Assinatura', color: 'bg-green-500', icon: FileSignature, step: 9 },
    ASSINADO: { label: 'Assinado', color: 'bg-green-600', icon: FileText, step: 10 },
    TROCA_TITULARIDADE: { label: 'Troca Titularidade', color: 'bg-teal-500', icon: RefreshCw, step: 11 },
    CADASTRANDO: { label: 'Cadastrando', color: 'bg-teal-600', icon: UserCheck, step: 12 },
    CONVERTIDO: { label: 'Convertido', color: 'bg-emerald-500', icon: Check, step: 13 },
    PERDIDO: { label: 'Perdido', color: 'bg-red-500', icon: X, step: 0 },
};

const ORIGEM_LABELS: Record<string, string> = {
    LANDING_PAGE: 'Landing Page',
    INDICACAO: 'Indicacao',
    GOOGLE_ADS: 'Google Ads',
    FACEBOOK: 'Facebook',
    INSTAGRAM: 'Instagram',
    WHATSAPP: 'WhatsApp',
    TELEFONE: 'Telefone',
    EVENTO: 'Evento',
    PARCEIRO: 'Parceiro',
    OUTROS: 'Outros',
};

const TITULARIDADE_STATUS_LABELS: Record<string, { label: string; color: string }> = {
    PENDENTE: { label: 'Pendente', color: 'bg-slate-500' },
    SOLICITADO: { label: 'Solicitado', color: 'bg-blue-500' },
    EM_ANALISE: { label: 'Em Analise', color: 'bg-yellow-500' },
    APROVADO: { label: 'Aprovado', color: 'bg-green-500' },
    REJEITADO: { label: 'Rejeitado', color: 'bg-red-500' },
};

const PROPOSTA_STATUS_LABELS: Record<string, { label: string; color: string }> = {
    GERADA: { label: 'Gerada', color: 'bg-slate-500' },
    ENVIADA: { label: 'Enviada', color: 'bg-blue-500' },
    VISUALIZADA: { label: 'Visualizada', color: 'bg-purple-500' },
    ACEITA: { label: 'Aceita', color: 'bg-green-500' },
    RECUSADA: { label: 'Recusada', color: 'bg-red-500' },
    EXPIRADA: { label: 'Expirada', color: 'bg-slate-400' },
};

// ========================
// Componente Principal
// ========================

export function LeadDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [lead, setLead] = useState<Lead | null>(null);
    const [ucs, setUCs] = useState<LeadUC[]>([]);
    const [propostas, setPropostas] = useState<LeadProposta[]>([]);
    const [documentos, setDocumentos] = useState<LeadDocumento[]>([]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState(false);

    // Modais
    const [showContatoModal, setShowContatoModal] = useState(false);
    const [showPropostaModal, setShowPropostaModal] = useState(false);
    const [showVincularUCModal, setShowVincularUCModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);

    // Formularios
    const [contatoForm, setContatoForm] = useState({ tipo_contato: 'whatsapp', descricao: '' });
    const [propostaForm, setPropostaForm] = useState({ valor_fatura: '', consumo_kwh: '', quantidade_ucs: 1, desconto_aplicado: 0.30 });
    const [vincularUCForm, setVincularUCForm] = useState({ uc_codigo: '', tipo: 'BENEFICIARIA' });

    // ========================
    // Fetch Data
    // ========================

    const fetchLead = async () => {
        if (!id) return;

        try {
            setLoading(true);
            setError(null);

            const response = await leadsApi.buscar(parseInt(id));
            setLead(response.data);

            // Buscar dados relacionados
            const [ucsRes, propostasRes, docsRes] = await Promise.all([
                leadsApi.listarUCs(parseInt(id)).catch(() => ({ data: [] })),
                leadsApi.listarPropostas(parseInt(id)).catch(() => ({ data: [] })),
                leadsApi.listarDocumentos(parseInt(id)).catch(() => ({ data: [] })),
            ]);

            setUCs(ucsRes.data || []);
            setPropostas(propostasRes.data || []);
            setDocumentos(docsRes.data || []);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Erro ao carregar lead');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLead();
    }, [id]);

    // ========================
    // Acoes
    // ========================

    const handleRegistrarContato = async () => {
        if (!lead || !contatoForm.descricao) return;

        try {
            setActionLoading(true);
            await leadsApi.registrarContato(lead.id, contatoForm);
            await fetchLead();
            setShowContatoModal(false);
            setContatoForm({ tipo_contato: 'whatsapp', descricao: '' });
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Erro ao registrar contato');
        } finally {
            setActionLoading(false);
        }
    };

    const handleGerarProposta = async () => {
        if (!lead) return;

        try {
            setActionLoading(true);
            await leadsApi.gerarProposta(lead.id, {
                valor_fatura: propostaForm.valor_fatura ? parseFloat(propostaForm.valor_fatura) : undefined,
                consumo_kwh: propostaForm.consumo_kwh ? parseInt(propostaForm.consumo_kwh) : undefined,
                quantidade_ucs: propostaForm.quantidade_ucs,
                desconto_aplicado: propostaForm.desconto_aplicado,
            });
            await fetchLead();
            setShowPropostaModal(false);
            setPropostaForm({ valor_fatura: '', consumo_kwh: '', quantidade_ucs: 1, desconto_aplicado: 0.30 });
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Erro ao gerar proposta');
        } finally {
            setActionLoading(false);
        }
    };

    const handleEnviarProposta = async (propostaId: number) => {
        try {
            setActionLoading(true);
            await leadsApi.enviarProposta(propostaId);
            await fetchLead();
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Erro ao enviar proposta');
        } finally {
            setActionLoading(false);
        }
    };

    const handleAceitarProposta = async (propostaId: number) => {
        if (!lead) return;

        try {
            setActionLoading(true);
            await leadsApi.aceitarProposta(lead.id, propostaId);
            await fetchLead();
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Erro ao aceitar proposta');
        } finally {
            setActionLoading(false);
        }
    };

    const handleVincularUC = async () => {
        if (!lead || !vincularUCForm.uc_codigo) return;

        try {
            setActionLoading(true);
            await leadsApi.vincularUC(lead.id, {
                uc_codigo: vincularUCForm.uc_codigo,
                tipo: vincularUCForm.tipo as any,
            });
            await fetchLead();
            setShowVincularUCModal(false);
            setVincularUCForm({ uc_codigo: '', tipo: 'BENEFICIARIA' });
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Erro ao vincular UC');
        } finally {
            setActionLoading(false);
        }
    };

    const handleAtualizarStatus = async (novoStatus: StatusLead) => {
        if (!lead) return;

        try {
            setActionLoading(true);
            await leadsApi.atualizar(lead.id, { status: novoStatus });
            await fetchLead();
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Erro ao atualizar status');
        } finally {
            setActionLoading(false);
        }
    };

    const handleMarcarPerdido = async () => {
        if (!lead) return;
        const motivo = prompt('Motivo da perda:');
        if (!motivo) return;

        try {
            setActionLoading(true);
            await leadsApi.marcarPerdido(lead.id, motivo);
            await fetchLead();
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Erro ao marcar como perdido');
        } finally {
            setActionLoading(false);
        }
    };

    // ========================
    // Helpers
    // ========================

    const formatarData = (dataStr: string | null) => {
        if (!dataStr) return '-';
        return new Date(dataStr).toLocaleDateString('pt-BR');
    };

    const formatarDataHora = (dataStr: string | null) => {
        if (!dataStr) return '-';
        return new Date(dataStr).toLocaleString('pt-BR');
    };

    const formatarMoeda = (valor: number | null) => {
        if (valor === null) return '-';
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
    };

    // ========================
    // Render
    // ========================

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    if (error || !lead) {
        return (
            <div className="p-6">
                <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-4">
                    <ArrowLeft size={20} />
                    Voltar
                </button>
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg text-red-600 dark:text-red-400">
                    {error || 'Lead nao encontrado'}
                </div>
            </div>
        );
    }

    const statusConfig = STATUS_CONFIG[lead.status] || STATUS_CONFIG.NOVO;
    const StatusIcon = statusConfig.icon;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                            {lead.tipo_pessoa === 'JURIDICA' ? <Building2 size={28} /> : <User size={28} />}
                            {lead.nome}
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400">
                            Lead #{lead.id} - {ORIGEM_LABELS[lead.origem] || lead.origem}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className={`px-4 py-2 rounded-full text-white text-sm font-medium flex items-center gap-2 ${statusConfig.color}`}>
                        <StatusIcon size={16} />
                        {statusConfig.label}
                    </span>
                </div>
            </div>

            {/* Pipeline Visual */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Pipeline de Vendas</h2>
                <div className="flex items-center overflow-x-auto pb-2">
                    {Object.entries(STATUS_CONFIG)
                        .filter(([key]) => key !== 'PERDIDO')
                        .sort((a, b) => a[1].step - b[1].step)
                        .map(([status, config], index) => {
                            const Icon = config.icon;
                            const isActive = lead.status === status;
                            const isPast = config.step < statusConfig.step && lead.status !== 'PERDIDO';

                            return (
                                <div key={status} className="flex items-center flex-shrink-0">
                                    <div className={`flex flex-col items-center ${index > 0 ? 'ml-2' : ''}`}>
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                                            isActive ? `${config.color} text-white ring-4 ring-offset-2 ring-${config.color.replace('bg-', '')}/30` :
                                            isPast ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' :
                                            'bg-slate-100 text-slate-400 dark:bg-slate-700'
                                        }`}>
                                            {isPast ? <Check size={18} /> : <Icon size={18} />}
                                        </div>
                                        <span className={`text-xs mt-1 whitespace-nowrap ${
                                            isActive ? 'font-semibold text-slate-900 dark:text-white' :
                                            isPast ? 'text-green-600 dark:text-green-400' :
                                            'text-slate-400'
                                        }`}>
                                            {config.label}
                                        </span>
                                    </div>
                                    {index < 12 && (
                                        <ChevronRight className={`mx-1 flex-shrink-0 ${isPast ? 'text-green-400' : 'text-slate-300'}`} size={16} />
                                    )}
                                </div>
                            );
                        })}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Coluna Principal */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Dados do Lead */}
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Dados do Lead</h2>
                            <button
                                onClick={() => setShowEditModal(true)}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                            >
                                <Edit3 size={18} />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs text-slate-500 dark:text-slate-400">Tipo</label>
                                    <p className="font-medium text-slate-900 dark:text-white">
                                        {lead.tipo_pessoa === 'JURIDICA' ? 'Pessoa Juridica' : 'Pessoa Fisica'}
                                    </p>
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 dark:text-slate-400">
                                        {lead.tipo_pessoa === 'JURIDICA' ? 'CNPJ' : 'CPF'}
                                    </label>
                                    <p className="font-medium text-slate-900 dark:text-white">
                                        {lead.cnpj || lead.cpf || '-'}
                                    </p>
                                </div>
                                {lead.tipo_pessoa === 'FISICA' && (
                                    <>
                                        <div>
                                            <label className="text-xs text-slate-500 dark:text-slate-400">RG</label>
                                            <p className="font-medium text-slate-900 dark:text-white">{lead.rg || '-'}</p>
                                        </div>
                                        <div>
                                            <label className="text-xs text-slate-500 dark:text-slate-400">Data Nascimento</label>
                                            <p className="font-medium text-slate-900 dark:text-white">{formatarData(lead.data_nascimento)}</p>
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <Phone size={14} className="text-slate-400" />
                                    <div>
                                        <label className="text-xs text-slate-500 dark:text-slate-400">Telefone</label>
                                        <p className="font-medium text-slate-900 dark:text-white">{lead.telefone || '-'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Mail size={14} className="text-slate-400" />
                                    <div>
                                        <label className="text-xs text-slate-500 dark:text-slate-400">Email</label>
                                        <p className="font-medium text-slate-900 dark:text-white">{lead.email || '-'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <MapPin size={14} className="text-slate-400" />
                                    <div>
                                        <label className="text-xs text-slate-500 dark:text-slate-400">Cidade</label>
                                        <p className="font-medium text-slate-900 dark:text-white">
                                            {lead.cidade ? `${lead.cidade}/${lead.uf}` : '-'}
                                        </p>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 dark:text-slate-400">Concessionaria</label>
                                    <p className="font-medium text-slate-900 dark:text-white">{lead.concessionaria || '-'}</p>
                                </div>
                            </div>
                        </div>

                        {/* Endereco completo */}
                        {lead.logradouro && (
                            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                                <label className="text-xs text-slate-500 dark:text-slate-400">Endereco Completo</label>
                                <p className="font-medium text-slate-900 dark:text-white">
                                    {lead.logradouro}, {lead.numero}
                                    {lead.complemento && ` - ${lead.complemento}`}
                                    {lead.bairro && `, ${lead.bairro}`}
                                    {lead.cep && ` - CEP: ${lead.cep}`}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* UCs Vinculadas */}
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                <Zap size={20} className="text-yellow-500" />
                                UCs Vinculadas ({ucs.length})
                            </h2>
                            <button
                                onClick={() => setShowVincularUCModal(true)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm"
                            >
                                <Plus size={16} />
                                Vincular UC
                            </button>
                        </div>

                        {ucs.length === 0 ? (
                            <p className="text-slate-500 text-center py-8">Nenhuma UC vinculada</p>
                        ) : (
                            <div className="space-y-3">
                                {ucs.map((uc) => (
                                    <div key={uc.id} className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-medium text-slate-900 dark:text-white">{uc.uc_codigo}</p>
                                                <p className="text-sm text-slate-500">{uc.uc_endereco}</p>
                                            </div>
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                uc.tipo === 'GERADORA' ? 'bg-green-100 text-green-700' :
                                                uc.tipo === 'BENEFICIARIA' ? 'bg-blue-100 text-blue-700' :
                                                'bg-slate-100 text-slate-700'
                                            }`}>
                                                {uc.tipo}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Propostas */}
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                <TrendingUp size={20} className="text-purple-500" />
                                Propostas ({propostas.length})
                            </h2>
                            <button
                                onClick={() => setShowPropostaModal(true)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-purple-500 text-white rounded-lg hover:bg-purple-600 text-sm"
                            >
                                <Plus size={16} />
                                Nova Proposta
                            </button>
                        </div>

                        {propostas.length === 0 ? (
                            <p className="text-slate-500 text-center py-8">Nenhuma proposta gerada</p>
                        ) : (
                            <div className="space-y-3">
                                {propostas.map((proposta) => (
                                    <div key={proposta.id} className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm font-medium text-slate-500">v{proposta.versao}</span>
                                                <span className={`px-2 py-1 rounded text-xs font-medium text-white ${
                                                    PROPOSTA_STATUS_LABELS[proposta.status]?.color || 'bg-slate-500'
                                                }`}>
                                                    {PROPOSTA_STATUS_LABELS[proposta.status]?.label || proposta.status}
                                                </span>
                                            </div>
                                            <span className="text-xs text-slate-500">{formatarData(proposta.criado_em)}</span>
                                        </div>

                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                            <div>
                                                <label className="text-xs text-slate-500">Valor Fatura</label>
                                                <p className="font-medium">{formatarMoeda(proposta.valor_fatura)}</p>
                                            </div>
                                            <div>
                                                <label className="text-xs text-slate-500">Desconto</label>
                                                <p className="font-medium">{(proposta.desconto_aplicado * 100).toFixed(0)}%</p>
                                            </div>
                                            <div>
                                                <label className="text-xs text-slate-500">Economia Mensal</label>
                                                <p className="font-medium text-green-600">{formatarMoeda(proposta.economia_mensal)}</p>
                                            </div>
                                            <div>
                                                <label className="text-xs text-slate-500">Economia Anual</label>
                                                <p className="font-medium text-green-600">{formatarMoeda(proposta.economia_anual)}</p>
                                            </div>
                                        </div>

                                        {/* Acoes da Proposta */}
                                        {proposta.status === 'GERADA' && (
                                            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 flex gap-2">
                                                <button
                                                    onClick={() => handleEnviarProposta(proposta.id)}
                                                    disabled={actionLoading}
                                                    className="flex items-center gap-1 px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:opacity-50"
                                                >
                                                    <Send size={14} />
                                                    Enviar
                                                </button>
                                            </div>
                                        )}
                                        {proposta.status === 'ENVIADA' && (
                                            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 flex gap-2">
                                                <button
                                                    onClick={() => handleAceitarProposta(proposta.id)}
                                                    disabled={actionLoading}
                                                    className="flex items-center gap-1 px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 disabled:opacity-50"
                                                >
                                                    <Check size={14} />
                                                    Marcar Aceita
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Historico de Contatos */}
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                <MessageCircle size={20} className="text-blue-500" />
                                Historico de Contatos
                            </h2>
                            <button
                                onClick={() => setShowContatoModal(true)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm"
                            >
                                <Plus size={16} />
                                Registrar Contato
                            </button>
                        </div>

                        {(!lead.contatos || lead.contatos.length === 0) ? (
                            <p className="text-slate-500 text-center py-8">Nenhum contato registrado</p>
                        ) : (
                            <div className="space-y-3">
                                {lead.contatos.map((contato) => (
                                    <div key={contato.id} className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded text-xs font-medium">
                                                {contato.tipo_contato}
                                            </span>
                                            <span className="text-xs text-slate-500">{formatarDataHora(contato.criado_em)}</span>
                                        </div>
                                        <p className="text-sm text-slate-700 dark:text-slate-300">{contato.descricao}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Coluna Lateral */}
                <div className="space-y-6">
                    {/* Acoes Rapidas */}
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Acoes</h2>
                        <div className="space-y-2">
                            {lead.status !== 'CONVERTIDO' && lead.status !== 'PERDIDO' && (
                                <>
                                    {lead.status === 'NOVO' && (
                                        <button
                                            onClick={() => handleAtualizarStatus('VINCULANDO')}
                                            disabled={actionLoading}
                                            className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            <Zap size={18} />
                                            Iniciar Vinculacao
                                        </button>
                                    )}

                                    {lead.status === 'VINCULADO' && (
                                        <button
                                            onClick={() => setShowPropostaModal(true)}
                                            disabled={actionLoading}
                                            className="w-full px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            <TrendingUp size={18} />
                                            Gerar Proposta
                                        </button>
                                    )}

                                    {lead.status === 'ACEITO' && (
                                        <button
                                            onClick={() => handleAtualizarStatus('AGUARDANDO_ASSINATURA')}
                                            disabled={actionLoading}
                                            className="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            <FileSignature size={18} />
                                            Gerar Documentos
                                        </button>
                                    )}

                                    {lead.status === 'ASSINADO' && (
                                        <button
                                            onClick={() => handleAtualizarStatus('TROCA_TITULARIDADE')}
                                            disabled={actionLoading}
                                            className="w-full px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            <RefreshCw size={18} />
                                            Iniciar Troca Titularidade
                                        </button>
                                    )}

                                    <button
                                        onClick={handleMarcarPerdido}
                                        disabled={actionLoading}
                                        className="w-full px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        <X size={18} />
                                        Marcar Perdido
                                    </button>
                                </>
                            )}

                            {lead.status === 'PERDIDO' && (
                                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg text-center">
                                    <AlertCircle className="mx-auto mb-2 text-red-500" size={24} />
                                    <p className="text-red-600 dark:text-red-400 text-sm">Lead perdido</p>
                                    {lead.motivo_perda_categoria && (
                                        <p className="text-xs text-red-500 mt-1">{lead.motivo_perda_categoria}</p>
                                    )}
                                </div>
                            )}

                            {lead.status === 'CONVERTIDO' && (
                                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                                    <Check className="mx-auto mb-2 text-green-500" size={24} />
                                    <p className="text-green-600 dark:text-green-400 text-sm">Lead convertido!</p>
                                    {lead.beneficiario_id && (
                                        <p className="text-xs text-green-500 mt-1">Beneficiario #{lead.beneficiario_id}</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Titularidade */}
                    {lead.titularidade_status && (
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Titularidade</h2>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-slate-500">Status</span>
                                    <span className={`px-2 py-1 rounded text-xs font-medium text-white ${
                                        TITULARIDADE_STATUS_LABELS[lead.titularidade_status]?.color || 'bg-slate-500'
                                    }`}>
                                        {TITULARIDADE_STATUS_LABELS[lead.titularidade_status]?.label || lead.titularidade_status}
                                    </span>
                                </div>
                                {lead.titularidade_protocolo && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-slate-500">Protocolo</span>
                                        <span className="text-sm font-medium">{lead.titularidade_protocolo}</span>
                                    </div>
                                )}
                                {lead.titularidade_data_solicitacao && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-slate-500">Solicitado em</span>
                                        <span className="text-sm">{formatarData(lead.titularidade_data_solicitacao)}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Info */}
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Informacoes</h2>
                        <div className="space-y-3 text-sm">
                            <div className="flex items-center justify-between">
                                <span className="text-slate-500">Criado em</span>
                                <span>{formatarData(lead.criado_em)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-500">Atualizado em</span>
                                <span>{formatarData(lead.atualizado_em)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-500">Responsavel</span>
                                <span>{lead.responsavel_nome || 'Nao atribuido'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Observacoes */}
                    {lead.observacoes && (
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Observacoes</h2>
                            <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{lead.observacoes}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal Registrar Contato */}
            {showContatoModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Registrar Contato</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-slate-500 mb-1">Tipo de Contato</label>
                                <select
                                    value={contatoForm.tipo_contato}
                                    onChange={(e) => setContatoForm({ ...contatoForm, tipo_contato: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                                >
                                    <option value="whatsapp">WhatsApp</option>
                                    <option value="telefone">Telefone</option>
                                    <option value="email">Email</option>
                                    <option value="presencial">Presencial</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-slate-500 mb-1">Descricao</label>
                                <textarea
                                    value={contatoForm.descricao}
                                    onChange={(e) => setContatoForm({ ...contatoForm, descricao: e.target.value })}
                                    rows={4}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 resize-none"
                                    placeholder="Descreva o contato realizado..."
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setShowContatoModal(false)}
                                className="px-4 py-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleRegistrarContato}
                                disabled={actionLoading || !contatoForm.descricao}
                                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
                            >
                                {actionLoading ? <Loader2 className="animate-spin" size={20} /> : 'Registrar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Gerar Proposta */}
            {showPropostaModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Gerar Proposta</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-slate-500 mb-1">Valor Fatura Media (R$)</label>
                                <input
                                    type="number"
                                    value={propostaForm.valor_fatura}
                                    onChange={(e) => setPropostaForm({ ...propostaForm, valor_fatura: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                                    placeholder="Ex: 500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-500 mb-1">Consumo Medio (kWh)</label>
                                <input
                                    type="number"
                                    value={propostaForm.consumo_kwh}
                                    onChange={(e) => setPropostaForm({ ...propostaForm, consumo_kwh: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                                    placeholder="Ex: 400"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-500 mb-1">Quantidade de UCs</label>
                                <input
                                    type="number"
                                    min={1}
                                    value={propostaForm.quantidade_ucs}
                                    onChange={(e) => setPropostaForm({ ...propostaForm, quantidade_ucs: parseInt(e.target.value) || 1 })}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-500 mb-1">Desconto (%)</label>
                                <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={propostaForm.desconto_aplicado * 100}
                                    onChange={(e) => setPropostaForm({ ...propostaForm, desconto_aplicado: (parseInt(e.target.value) || 30) / 100 })}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setShowPropostaModal(false)}
                                className="px-4 py-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleGerarProposta}
                                disabled={actionLoading || (!propostaForm.valor_fatura && !propostaForm.consumo_kwh)}
                                className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50"
                            >
                                {actionLoading ? <Loader2 className="animate-spin" size={20} /> : 'Gerar Proposta'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Vincular UC */}
            {showVincularUCModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Vincular UC</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-slate-500 mb-1">Codigo da UC</label>
                                <input
                                    type="text"
                                    value={vincularUCForm.uc_codigo}
                                    onChange={(e) => setVincularUCForm({ ...vincularUCForm, uc_codigo: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                                    placeholder="Ex: 6/1234567-8"
                                />
                                <p className="text-xs text-slate-400 mt-1">Formato: codigo_empresa/cdc-digito</p>
                            </div>
                            <div>
                                <label className="block text-sm text-slate-500 mb-1">Tipo de Vinculo</label>
                                <select
                                    value={vincularUCForm.tipo}
                                    onChange={(e) => setVincularUCForm({ ...vincularUCForm, tipo: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                                >
                                    <option value="BENEFICIARIA">Beneficiaria</option>
                                    <option value="GERADORA">Geradora</option>
                                    <option value="SIMULACAO">Simulacao</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setShowVincularUCModal(false)}
                                className="px-4 py-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleVincularUC}
                                disabled={actionLoading || !vincularUCForm.uc_codigo}
                                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                            >
                                {actionLoading ? <Loader2 className="animate-spin" size={20} /> : 'Vincular'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default LeadDetail;
