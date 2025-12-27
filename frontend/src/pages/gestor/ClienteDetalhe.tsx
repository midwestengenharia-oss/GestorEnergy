/**
 * ClienteDetalhe - Visão 360° do Cliente/Beneficiário
 *
 * Abas:
 * - Dados: Info pessoal, documentos
 * - UC: Unidade consumidora vinculada
 * - Contrato: Contrato, rateio, desconto
 * - Financeiro: Cobranças, economia acumulada
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { beneficiariosApi } from '../../api/beneficiarios';
import { cobrancasApi } from '../../api/cobrancas';
import { leadsApi, LeadDocumento } from '../../api/leads';
import type { Beneficiario, Cobranca, UnidadeConsumidora } from '../../api/types';
import {
    ArrowLeft,
    User,
    FileText,
    Zap,
    DollarSign,
    Loader2,
    AlertCircle,
    Mail,
    Phone,
    Calendar,
    MapPin,
    Building2,
    Download,
    Eye,
    TrendingUp,
    Clock,
    CheckCircle,
    XCircle,
    CreditCard,
    BadgeCheck,
    BadgeAlert,
    FileCheck,
    FileX,
    ExternalLink,
    Percent,
    Receipt
} from 'lucide-react';

type TabId = 'dados' | 'uc' | 'contrato' | 'financeiro';

interface TabConfig {
    id: TabId;
    label: string;
    icon: React.ReactNode;
}

const tabs: TabConfig[] = [
    { id: 'dados', label: 'Dados', icon: <User className="h-4 w-4" /> },
    { id: 'uc', label: 'Unidade Consumidora', icon: <Zap className="h-4 w-4" /> },
    { id: 'contrato', label: 'Contrato', icon: <FileText className="h-4 w-4" /> },
    { id: 'financeiro', label: 'Financeiro', icon: <DollarSign className="h-4 w-4" /> },
];

export function ClienteDetalhe() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<TabId>('dados');

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [beneficiario, setBeneficiario] = useState<Beneficiario | null>(null);
    const [cobrancas, setCobrancas] = useState<Cobranca[]>([]);
    const [documentos, setDocumentos] = useState<LeadDocumento[]>([]);
    const [leadId, setLeadId] = useState<number | null>(null);

    useEffect(() => {
        if (id) {
            fetchData();
        }
    }, [id]);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);

            // Buscar beneficiário
            const benefResponse = await beneficiariosApi.buscar(Number(id));
            setBeneficiario(benefResponse.data);

            // Buscar cobranças do beneficiário (retorna paginado)
            const cobrancasResponse = await cobrancasApi.porBeneficiario(Number(id));
            setCobrancas(cobrancasResponse.data?.cobrancas || []);

            // Tentar buscar documentos se vier de lead (precisamos verificar no portfolio)
            // Por ora, deixamos vazio - será preenchido se houver lead_id
            try {
                const portfolioResponse = await beneficiariosApi.portfolio({ busca: benefResponse.data.cpf });
                const cliente = portfolioResponse.data?.clientes?.find(c => c.id === Number(id));
                if (cliente?.lead_id) {
                    setLeadId(cliente.lead_id);
                    const docsResponse = await leadsApi.listarDocumentos(cliente.lead_id);
                    setDocumentos(docsResponse.data || []);
                }
            } catch (e) {
                // Sem documentos disponíveis
                console.log('Documentos não disponíveis');
            }

        } catch (err: any) {
            console.error('Erro ao carregar cliente:', err);
            setError(err.response?.data?.detail || 'Erro ao carregar dados do cliente');
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (value?: number) => {
        if (value === undefined || value === null) return 'R$ 0,00';
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value);
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('pt-BR');
    };

    const formatCPF = (cpf?: string) => {
        if (!cpf) return '-';
        const cleaned = cpf.replace(/\D/g, '');
        if (cleaned.length !== 11) return cpf;
        return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    };

    const formatUC = (uc?: UnidadeConsumidora) => {
        if (!uc) return '-';
        const cod = String(uc.cod_empresa || '').padStart(1, '0');
        const cdc = String(uc.cdc || '').padStart(8, '0');
        const dv = uc.digito_verificador || 0;
        return `${cod}/${cdc}-${dv}`;
    };

    const getStatusBadge = (status: string) => {
        const statusMap: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
            'ATIVO': { label: 'Ativo', className: 'bg-green-100 text-green-800', icon: <CheckCircle className="h-3 w-3" /> },
            'PENDENTE': { label: 'Pendente', className: 'bg-yellow-100 text-yellow-800', icon: <Clock className="h-3 w-3" /> },
            'SUSPENSO': { label: 'Suspenso', className: 'bg-orange-100 text-orange-800', icon: <AlertCircle className="h-3 w-3" /> },
            'CANCELADO': { label: 'Cancelado', className: 'bg-red-100 text-red-800', icon: <XCircle className="h-3 w-3" /> },
        };
        const config = statusMap[status] || { label: status, className: 'bg-gray-100 text-gray-800', icon: null };
        return (
            <span className={`px-2 py-1 text-xs font-medium rounded-full flex items-center gap-1 ${config.className}`}>
                {config.icon}
                {config.label}
            </span>
        );
    };

    const getCobrancaStatusBadge = (status: string) => {
        const statusMap: Record<string, { label: string; className: string }> = {
            'PENDENTE': { label: 'Pendente', className: 'bg-yellow-100 text-yellow-800' },
            'EMITIDA': { label: 'Emitida', className: 'bg-blue-100 text-blue-800' },
            'PAGA': { label: 'Paga', className: 'bg-green-100 text-green-800' },
            'VENCIDA': { label: 'Vencida', className: 'bg-red-100 text-red-800' },
            'CANCELADA': { label: 'Cancelada', className: 'bg-gray-100 text-gray-800' },
        };
        const config = statusMap[status] || { label: status, className: 'bg-gray-100 text-gray-800' };
        return (
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${config.className}`}>
                {config.label}
            </span>
        );
    };

    const getDocumentoIcon = (tipo: string) => {
        const hasDoc = true; // Simplificado - assumimos que se está na lista, existe
        return hasDoc ? <FileCheck className="h-4 w-4 text-green-500" /> : <FileX className="h-4 w-4 text-gray-400" />;
    };

    // Calcular métricas financeiras
    const economiaTotal = cobrancas.reduce((acc, c) => acc + (c.economia_mes || c.economia || 0), 0);
    const totalCobrancas = cobrancas.length;
    const cobrancasPagas = cobrancas.filter(c => c.status === 'PAGA').length;
    const cobrancasPendentes = cobrancas.filter(c => c.status === 'PENDENTE' || c.status === 'EMITIDA').length;
    const valorTotalPago = cobrancas.filter(c => c.status === 'PAGA').reduce((acc, c) => acc + (c.valor_pago || c.valor_total || 0), 0);

    if (loading) {
        return (
            <div className="p-6 flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <span className="ml-2 text-gray-600">Carregando dados do cliente...</span>
            </div>
        );
    }

    if (error || !beneficiario) {
        return (
            <div className="p-6">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    <span className="text-red-700">{error || 'Cliente não encontrado'}</span>
                </div>
                <button
                    onClick={() => navigate(-1)}
                    className="mt-4 flex items-center gap-2 text-blue-600 hover:text-blue-800"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar
                </button>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5 text-gray-600" />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-gray-900">
                                {beneficiario.nome || 'Cliente sem nome'}
                            </h1>
                            {getStatusBadge(beneficiario.status)}
                            {leadId ? (
                                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700 flex items-center gap-1">
                                    <BadgeCheck className="h-3 w-3" />
                                    Convertido
                                </span>
                            ) : (
                                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-orange-100 text-orange-700 flex items-center gap-1">
                                    <BadgeAlert className="h-3 w-3" />
                                    Legado
                                </span>
                            )}
                        </div>
                        <p className="text-gray-500 mt-1">
                            CPF: {formatCPF(beneficiario.cpf)} • UC: {formatUC(beneficiario.uc)}
                        </p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
                <nav className="flex space-x-8">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                                activeTab === tab.id
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Tab Content */}
            <div className="bg-white rounded-lg shadow">
                {/* Aba Dados */}
                {activeTab === 'dados' && (
                    <div className="p-6 space-y-6">
                        {/* Informações Pessoais */}
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <User className="h-5 w-5 text-blue-600" />
                                Informações Pessoais
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <p className="text-xs text-gray-500 uppercase tracking-wide">Nome Completo</p>
                                    <p className="font-medium text-gray-900 mt-1">{beneficiario.nome || '-'}</p>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <p className="text-xs text-gray-500 uppercase tracking-wide">CPF</p>
                                    <p className="font-medium text-gray-900 mt-1">{formatCPF(beneficiario.cpf)}</p>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <p className="text-xs text-gray-500 uppercase tracking-wide">Status</p>
                                    <div className="mt-1">{getStatusBadge(beneficiario.status)}</div>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <p className="text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1">
                                        <Mail className="h-3 w-3" /> Email
                                    </p>
                                    <p className="font-medium text-gray-900 mt-1">{beneficiario.email || '-'}</p>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <p className="text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1">
                                        <Phone className="h-3 w-3" /> Telefone
                                    </p>
                                    <p className="font-medium text-gray-900 mt-1">{beneficiario.telefone || '-'}</p>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <p className="text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1">
                                        <Calendar className="h-3 w-3" /> Cadastrado em
                                    </p>
                                    <p className="font-medium text-gray-900 mt-1">{formatDate(beneficiario.criado_em)}</p>
                                </div>
                            </div>
                        </div>

                        {/* Documentos */}
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <FileText className="h-5 w-5 text-blue-600" />
                                Documentos
                                {documentos.length > 0 && (
                                    <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                                        {documentos.length}
                                    </span>
                                )}
                            </h3>
                            {documentos.length === 0 ? (
                                <div className="bg-gray-50 rounded-lg p-6 text-center">
                                    <FileX className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                                    <p className="text-gray-500">
                                        {leadId ? 'Nenhum documento enviado' : 'Cliente legado - sem documentos no sistema'}
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {documentos.map((doc) => (
                                        <div key={doc.id} className="bg-gray-50 rounded-lg p-4 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                {getDocumentoIcon(doc.tipo)}
                                                <div>
                                                    <p className="font-medium text-gray-900">{doc.tipo}</p>
                                                    <p className="text-xs text-gray-500">{doc.nome_arquivo}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {doc.url_arquivo && (
                                                    <>
                                                        <a
                                                            href={doc.url_arquivo}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                                                            title="Visualizar"
                                                        >
                                                            <Eye className="h-4 w-4 text-gray-600" />
                                                        </a>
                                                        <a
                                                            href={doc.url_arquivo}
                                                            download
                                                            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                                                            title="Baixar"
                                                        >
                                                            <Download className="h-4 w-4 text-gray-600" />
                                                        </a>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Aba UC */}
                {activeTab === 'uc' && (
                    <div className="p-6 space-y-6">
                        {beneficiario.uc ? (
                            <>
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                        <Zap className="h-5 w-5 text-yellow-500" />
                                        Unidade Consumidora
                                    </h3>
                                    <Link
                                        to={`/app/gestor/ucs/${beneficiario.uc.id}`}
                                        className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm"
                                    >
                                        Ver detalhes da UC
                                        <ExternalLink className="h-4 w-4" />
                                    </Link>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <div className="bg-gray-50 rounded-lg p-4">
                                        <p className="text-xs text-gray-500 uppercase tracking-wide">Código UC</p>
                                        <p className="font-medium text-gray-900 mt-1 text-lg">{formatUC(beneficiario.uc)}</p>
                                    </div>
                                    <div className="bg-gray-50 rounded-lg p-4">
                                        <p className="text-xs text-gray-500 uppercase tracking-wide">Titular</p>
                                        <p className="font-medium text-gray-900 mt-1">{beneficiario.uc.nome_titular || '-'}</p>
                                    </div>
                                    <div className="bg-gray-50 rounded-lg p-4">
                                        <p className="text-xs text-gray-500 uppercase tracking-wide">Status</p>
                                        <div className="mt-1">
                                            {beneficiario.uc.uc_ativa ? (
                                                <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                                                    Ativa
                                                </span>
                                            ) : (
                                                <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                                                    Inativa
                                                </span>
                                            )}
                                            {beneficiario.uc.is_geradora && (
                                                <span className="ml-2 px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                                                    Geradora
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Endereço */}
                                <div>
                                    <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                                        <MapPin className="h-4 w-4 text-gray-500" />
                                        Endereço
                                    </h4>
                                    <div className="bg-gray-50 rounded-lg p-4">
                                        <p className="text-gray-900">
                                            {beneficiario.uc.endereco || 'Endereço não cadastrado'}
                                            {beneficiario.uc.numero_imovel && `, ${beneficiario.uc.numero_imovel}`}
                                            {beneficiario.uc.complemento && ` - ${beneficiario.uc.complemento}`}
                                        </p>
                                        <p className="text-gray-600 mt-1">
                                            {beneficiario.uc.bairro && `${beneficiario.uc.bairro} - `}
                                            {beneficiario.uc.cidade || ''}{beneficiario.uc.uf && ` / ${beneficiario.uc.uf}`}
                                            {beneficiario.uc.cep && ` - CEP: ${beneficiario.uc.cep}`}
                                        </p>
                                    </div>
                                </div>

                                {/* Dados Técnicos */}
                                <div>
                                    <h4 className="font-medium text-gray-900 mb-3">Dados Técnicos</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="bg-gray-50 rounded-lg p-4">
                                            <p className="text-xs text-gray-500 uppercase tracking-wide">Tipo de Ligação</p>
                                            <p className="font-medium text-gray-900 mt-1">{beneficiario.uc.tipo_ligacao || '-'}</p>
                                        </div>
                                        <div className="bg-gray-50 rounded-lg p-4">
                                            <p className="text-xs text-gray-500 uppercase tracking-wide">Classe</p>
                                            <p className="font-medium text-gray-900 mt-1">{beneficiario.uc.classe_leitura || '-'}</p>
                                        </div>
                                        <div className="bg-gray-50 rounded-lg p-4">
                                            <p className="text-xs text-gray-500 uppercase tracking-wide">Saldo Acumulado</p>
                                            <p className="font-medium text-green-600 mt-1">{beneficiario.uc.saldo_acumulado?.toFixed(2) || '0.00'} kWh</p>
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="text-center py-8">
                                <Zap className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                                <p className="text-gray-500">Nenhuma UC vinculada a este cliente</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Aba Contrato */}
                {activeTab === 'contrato' && (
                    <div className="p-6 space-y-6">
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <FileText className="h-5 w-5 text-blue-600" />
                            Contrato e Condições
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-gray-50 rounded-lg p-4">
                                <p className="text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1">
                                    <Building2 className="h-3 w-3" /> Usina
                                </p>
                                <p className="font-medium text-gray-900 mt-1">{beneficiario.usina?.nome || '-'}</p>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-4">
                                <p className="text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1">
                                    <Percent className="h-3 w-3" /> Rateio
                                </p>
                                <p className="font-medium text-gray-900 mt-1">
                                    {beneficiario.percentual_rateio ? `${(beneficiario.percentual_rateio * 100).toFixed(1)}%` : '-'}
                                </p>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-4">
                                <p className="text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1">
                                    <TrendingUp className="h-3 w-3" /> Desconto
                                </p>
                                <p className="font-medium text-green-600 mt-1">
                                    {beneficiario.desconto ? `${(beneficiario.desconto * 100).toFixed(0)}%` : '30%'}
                                </p>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-4">
                                <p className="text-xs text-gray-500 uppercase tracking-wide">Tipo</p>
                                <p className="font-medium text-gray-900 mt-1">{beneficiario.tipo || 'USINA'}</p>
                            </div>
                        </div>

                        {/* Status do Contrato */}
                        <div className="bg-blue-50 rounded-lg p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 rounded-lg">
                                    <FileCheck className="h-5 w-5 text-blue-600" />
                                </div>
                                <div>
                                    <p className="font-medium text-blue-900">
                                        {beneficiario.contrato_id ? 'Contrato Ativo' : 'Sem Contrato Formal'}
                                    </p>
                                    <p className="text-sm text-blue-700">
                                        {beneficiario.contrato_id
                                            ? `Contrato #${beneficiario.contrato_id}`
                                            : 'Este beneficiário não possui contrato formalizado no sistema'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Convite */}
                        {beneficiario.convite_enviado_em && (
                            <div className="bg-gray-50 rounded-lg p-4">
                                <div className="flex items-center gap-3">
                                    <Mail className="h-5 w-5 text-gray-500" />
                                    <div>
                                        <p className="font-medium text-gray-900">Convite Enviado</p>
                                        <p className="text-sm text-gray-600">
                                            Enviado em {formatDate(beneficiario.convite_enviado_em)}
                                            {beneficiario.ativado_em && ` • Ativado em ${formatDate(beneficiario.ativado_em)}`}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Aba Financeiro */}
                {activeTab === 'financeiro' && (
                    <div className="p-6 space-y-6">
                        {/* Cards de Resumo */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-green-50 rounded-lg p-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-green-100 rounded-lg">
                                        <TrendingUp className="h-5 w-5 text-green-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-green-700">Economia Total</p>
                                        <p className="text-xl font-bold text-green-600">{formatCurrency(economiaTotal)}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-blue-50 rounded-lg p-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-100 rounded-lg">
                                        <Receipt className="h-5 w-5 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-blue-700">Total Cobranças</p>
                                        <p className="text-xl font-bold text-blue-600">{totalCobrancas}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-purple-50 rounded-lg p-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-purple-100 rounded-lg">
                                        <CheckCircle className="h-5 w-5 text-purple-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-purple-700">Pagas</p>
                                        <p className="text-xl font-bold text-purple-600">{cobrancasPagas}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-yellow-50 rounded-lg p-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-yellow-100 rounded-lg">
                                        <Clock className="h-5 w-5 text-yellow-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-yellow-700">Pendentes</p>
                                        <p className="text-xl font-bold text-yellow-600">{cobrancasPendentes}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Lista de Cobranças */}
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <CreditCard className="h-5 w-5 text-blue-600" />
                                Histórico de Cobranças
                            </h3>

                            {cobrancas.length === 0 ? (
                                <div className="bg-gray-50 rounded-lg p-8 text-center">
                                    <Receipt className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                                    <p className="text-gray-500">Nenhuma cobrança registrada</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Referência
                                                </th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Vencimento
                                                </th>
                                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Valor
                                                </th>
                                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Economia
                                                </th>
                                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Status
                                                </th>
                                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    PIX
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {cobrancas.map((cobranca) => (
                                                <tr key={cobranca.id} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                                        {cobranca.referencia_formatada || `${String(cobranca.mes).padStart(2, '0')}/${cobranca.ano}`}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-600">
                                                        {formatDate(cobranca.vencimento || cobranca.data_vencimento)}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                                                        {formatCurrency(cobranca.valor_total)}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-right font-medium text-green-600">
                                                        {formatCurrency(cobranca.economia_mes || cobranca.economia)}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        {getCobrancaStatusBadge(cobranca.status)}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        {cobranca.qr_code_pix ? (
                                                            <span className="text-green-600" title="PIX disponível">
                                                                <CheckCircle className="h-4 w-4 mx-auto" />
                                                            </span>
                                                        ) : (
                                                            <span className="text-gray-400">-</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ClienteDetalhe;
