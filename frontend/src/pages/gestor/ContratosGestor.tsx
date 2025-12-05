/**
 * ContratosGestor - Página de Gestão de Contratos para Gestores
 * Permite criar, visualizar e gerenciar contratos com beneficiários
 */

import { useState, useEffect, useCallback } from 'react';
import {
    FileText,
    Plus,
    Search,
    Filter,
    Eye,
    Download,
    RefreshCw,
    Calendar,
    User,
    Building,
    CheckCircle,
    Clock,
    XCircle,
    AlertTriangle,
    X,
    ChevronRight
} from 'lucide-react';
import { usinasApi } from '../../api/usinas';
import { beneficiariosApi } from '../../api/beneficiarios';

interface Contrato {
    id: number;
    numero_contrato: string;
    beneficiario_id: number;
    beneficiario_nome: string;
    beneficiario_documento: string;
    usina_id: number;
    usina_nome: string;
    data_inicio: string;
    data_fim?: string;
    percentual_rateio: number;
    desconto_percentual: number;
    valor_mensal_estimado: number;
    status: 'ativo' | 'pendente' | 'suspenso' | 'encerrado';
    created_at: string;
}

interface Usina {
    id: number;
    nome: string;
    codigo_usina: string;
}

interface Beneficiario {
    id: number;
    nome: string;
    documento: string;
    usina_id: number;
    percentual_rateio: number;
    desconto: number;
    status: string;
}

export function ContratosGestor() {
    const [contratos, setContratos] = useState<Contrato[]>([]);
    const [usinas, setUsinas] = useState<Usina[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filtroUsina, setFiltroUsina] = useState<number | ''>('');
    const [filtroStatus, setFiltroStatus] = useState<string>('');
    const [selectedContrato, setSelectedContrato] = useState<Contrato | null>(null);
    const [showDetalheModal, setShowDetalheModal] = useState(false);
    const [showNovoModal, setShowNovoModal] = useState(false);
    const [beneficiariosSemContrato, setBeneficiariosSemContrato] = useState<Beneficiario[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Dados do novo contrato
    const [novoContrato, setNovoContrato] = useState({
        beneficiario_id: '',
        data_inicio: new Date().toISOString().split('T')[0]
    });

    const carregarDados = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            // Buscar usinas do gestor
            const usinasResponse = await usinasApi.minhas();
            const usinasData = usinasResponse.data || [];
            setUsinas(usinasData);

            // Buscar beneficiários de todas as usinas e transformar em "contratos"
            const todosContratos: Contrato[] = [];
            let contratoId = 1;

            for (const usina of usinasData) {
                try {
                    const benefResponse = await beneficiariosApi.porUsina(usina.id);
                    const beneficiarios = benefResponse.data || [];

                    for (const benef of beneficiarios) {
                        // Cada beneficiário representa um "contrato" ativo
                        todosContratos.push({
                            id: contratoId++,
                            numero_contrato: `CTR-${usina.id}-${benef.id}-${new Date().getFullYear()}`,
                            beneficiario_id: benef.id,
                            beneficiario_nome: benef.nome,
                            beneficiario_documento: benef.documento || benef.cpf_cnpj || '',
                            usina_id: usina.id,
                            usina_nome: usina.nome,
                            data_inicio: benef.data_adesao || benef.created_at || new Date().toISOString(),
                            percentual_rateio: benef.percentual_rateio || 0,
                            desconto_percentual: benef.desconto || 15,
                            valor_mensal_estimado: ((usina.capacidade_kwp || 100) * 120 * (benef.percentual_rateio || 0) / 100) * 0.85,
                            status: benef.status === 'ativo' ? 'ativo' :
                                   benef.status === 'suspenso' ? 'suspenso' : 'pendente',
                            created_at: benef.created_at || new Date().toISOString()
                        });
                    }
                } catch (err) {
                    console.error(`Erro ao buscar beneficiários da usina ${usina.id}:`, err);
                }
            }

            setContratos(todosContratos);
        } catch (err) {
            console.error('Erro ao carregar dados:', err);
            setError('Erro ao carregar contratos');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        carregarDados();
    }, [carregarDados]);

    const carregarBeneficiariosSemContrato = async () => {
        try {
            const todosDisp: Beneficiario[] = [];

            for (const usina of usinas) {
                const response = await beneficiariosApi.porUsina(usina.id);
                const beneficiarios = response.data || [];
                // Filtrar beneficiários com status pendente (ainda não tem contrato efetivo)
                const pendentes = beneficiarios.filter((b: Beneficiario) => b.status === 'pendente');
                todosDisp.push(...pendentes);
            }

            setBeneficiariosSemContrato(todosDisp);
        } catch (err) {
            console.error('Erro ao buscar beneficiários disponíveis:', err);
        }
    };

    const handleAbrirNovoModal = async () => {
        await carregarBeneficiariosSemContrato();
        setShowNovoModal(true);
    };

    const handleCriarContrato = async () => {
        if (!novoContrato.beneficiario_id) {
            setError('Selecione um beneficiário');
            return;
        }

        try {
            const benefId = parseInt(novoContrato.beneficiario_id);

            // Ativar o beneficiário (transformando em contrato ativo)
            await beneficiariosApi.atualizar(benefId, { status: 'ativo' });

            setSuccessMessage('Contrato criado com sucesso!');
            setShowNovoModal(false);
            setNovoContrato({
                beneficiario_id: '',
                data_inicio: new Date().toISOString().split('T')[0]
            });

            await carregarDados();
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err) {
            console.error('Erro ao criar contrato:', err);
            setError('Erro ao criar contrato');
        }
    };

    const handleSuspenderContrato = async (contrato: Contrato) => {
        if (!confirm(`Deseja suspender o contrato de ${contrato.beneficiario_nome}?`)) return;

        try {
            await beneficiariosApi.suspender(contrato.beneficiario_id);
            setSuccessMessage('Contrato suspenso com sucesso');
            setShowDetalheModal(false);
            await carregarDados();
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err) {
            setError('Erro ao suspender contrato');
        }
    };

    const handleReativarContrato = async (contrato: Contrato) => {
        try {
            await beneficiariosApi.ativar(contrato.beneficiario_id);
            setSuccessMessage('Contrato reativado com sucesso');
            setShowDetalheModal(false);
            await carregarDados();
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err) {
            setError('Erro ao reativar contrato');
        }
    };

    const formatDate = (dateStr: string): string => {
        try {
            return new Date(dateStr).toLocaleDateString('pt-BR');
        } catch {
            return dateStr;
        }
    };

    const formatCurrency = (value: number): string => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value);
    };

    const getStatusBadge = (status: string) => {
        const configs: Record<string, { color: string; icon: any; label: string }> = {
            ativo: {
                color: 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30',
                icon: CheckCircle,
                label: 'Ativo'
            },
            pendente: {
                color: 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30',
                icon: Clock,
                label: 'Pendente'
            },
            suspenso: {
                color: 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30',
                icon: XCircle,
                label: 'Suspenso'
            },
            encerrado: {
                color: 'text-slate-600 bg-slate-100 dark:text-slate-400 dark:bg-slate-700',
                icon: XCircle,
                label: 'Encerrado'
            }
        };

        const config = configs[status] || configs.pendente;
        const Icon = config.icon;

        return (
            <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${config.color}`}>
                <Icon className="w-3 h-3" />
                {config.label}
            </span>
        );
    };

    const contratosFiltrados = contratos.filter(c => {
        const matchSearch = searchTerm === '' ||
            c.beneficiario_nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.numero_contrato.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.beneficiario_documento.includes(searchTerm);

        const matchUsina = filtroUsina === '' || c.usina_id === filtroUsina;
        const matchStatus = filtroStatus === '' || c.status === filtroStatus;

        return matchSearch && matchUsina && matchStatus;
    });

    // Estatísticas
    const stats = {
        total: contratos.length,
        ativos: contratos.filter(c => c.status === 'ativo').length,
        pendentes: contratos.filter(c => c.status === 'pendente').length,
        suspensos: contratos.filter(c => c.status === 'suspenso').length,
        valorTotal: contratos
            .filter(c => c.status === 'ativo')
            .reduce((sum, c) => sum + c.valor_mensal_estimado, 0)
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        Contratos
                    </h1>
                    <p className="text-slate-600 dark:text-slate-400 mt-1">
                        Gerencie os contratos com seus beneficiários
                    </p>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={carregarDados}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 text-slate-600 dark:text-slate-300
                                 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600
                                 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Atualizar
                    </button>

                    <button
                        onClick={handleAbrirNovoModal}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white
                                 rounded-lg hover:bg-green-700 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Novo Contrato
                    </button>
                </div>
            </div>

            {/* Mensagens */}
            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800
                              rounded-lg p-4 flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                    <span className="text-red-700 dark:text-red-300">{error}</span>
                    <button onClick={() => setError(null)} className="ml-auto">
                        <X className="w-4 h-4 text-red-600" />
                    </button>
                </div>
            )}

            {successMessage && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800
                              rounded-lg p-4 flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <span className="text-green-700 dark:text-green-300">{successMessage}</span>
                </div>
            )}

            {/* Cards de Estatísticas */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200
                              dark:border-slate-700">
                    <p className="text-sm text-slate-500 dark:text-slate-400">Total</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200
                              dark:border-slate-700">
                    <p className="text-sm text-slate-500 dark:text-slate-400">Ativos</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.ativos}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200
                              dark:border-slate-700">
                    <p className="text-sm text-slate-500 dark:text-slate-400">Pendentes</p>
                    <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.pendentes}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200
                              dark:border-slate-700">
                    <p className="text-sm text-slate-500 dark:text-slate-400">Suspensos</p>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.suspensos}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200
                              dark:border-slate-700">
                    <p className="text-sm text-slate-500 dark:text-slate-400">Receita Mensal</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {formatCurrency(stats.valorTotal)}
                    </p>
                </div>
            </div>

            {/* Filtros */}
            <div className="flex flex-col sm:flex-row gap-4 bg-white dark:bg-slate-800 rounded-lg p-4
                          border border-slate-200 dark:border-slate-700">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar por nome, documento ou número..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-700 border
                                 border-slate-300 dark:border-slate-600 rounded-lg dark:text-white"
                    />
                </div>

                <select
                    value={filtroUsina}
                    onChange={(e) => setFiltroUsina(e.target.value ? parseInt(e.target.value) : '')}
                    className="px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-300
                             dark:border-slate-600 rounded-lg dark:text-white"
                >
                    <option value="">Todas as usinas</option>
                    {usinas.map(u => (
                        <option key={u.id} value={u.id}>{u.nome}</option>
                    ))}
                </select>

                <select
                    value={filtroStatus}
                    onChange={(e) => setFiltroStatus(e.target.value)}
                    className="px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-300
                             dark:border-slate-600 rounded-lg dark:text-white"
                >
                    <option value="">Todos os status</option>
                    <option value="ativo">Ativos</option>
                    <option value="pendente">Pendentes</option>
                    <option value="suspenso">Suspensos</option>
                </select>
            </div>

            {/* Lista de Contratos */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200
                          dark:border-slate-700 overflow-hidden">
                {contratosFiltrados.length === 0 ? (
                    <div className="p-12 text-center">
                        <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                            Nenhum contrato encontrado
                        </h3>
                        <p className="text-slate-500 dark:text-slate-400">
                            {searchTerm || filtroUsina || filtroStatus
                                ? 'Tente ajustar os filtros'
                                : 'Clique em "Novo Contrato" para criar o primeiro'}
                        </p>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-700/50">
                                <th className="px-6 py-3 text-left text-xs font-medium
                                             text-slate-500 dark:text-slate-400 uppercase">
                                    Contrato
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium
                                             text-slate-500 dark:text-slate-400 uppercase">
                                    Beneficiário
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium
                                             text-slate-500 dark:text-slate-400 uppercase">
                                    Usina
                                </th>
                                <th className="px-6 py-3 text-center text-xs font-medium
                                             text-slate-500 dark:text-slate-400 uppercase">
                                    Rateio
                                </th>
                                <th className="px-6 py-3 text-center text-xs font-medium
                                             text-slate-500 dark:text-slate-400 uppercase">
                                    Status
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium
                                             text-slate-500 dark:text-slate-400 uppercase">
                                    Valor Estimado
                                </th>
                                <th className="px-6 py-3 text-center text-xs font-medium
                                             text-slate-500 dark:text-slate-400 uppercase">
                                    Ações
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {contratosFiltrados.map((contrato) => (
                                <tr key={contrato.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30
                                                          rounded-lg flex items-center justify-center">
                                                <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-slate-900 dark:text-white">
                                                    {contrato.numero_contrato}
                                                </p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    Desde {formatDate(contrato.data_inicio)}
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div>
                                            <p className="text-slate-900 dark:text-white">
                                                {contrato.beneficiario_nome}
                                            </p>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                                {contrato.beneficiario_documento}
                                            </p>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                        {contrato.usina_nome}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="font-medium text-slate-900 dark:text-white">
                                            {contrato.percentual_rateio.toFixed(1)}%
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {getStatusBadge(contrato.status)}
                                    </td>
                                    <td className="px-6 py-4 text-right font-medium text-green-600
                                                 dark:text-green-400">
                                        {formatCurrency(contrato.valor_mensal_estimado)}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <button
                                            onClick={() => {
                                                setSelectedContrato(contrato);
                                                setShowDetalheModal(true);
                                            }}
                                            className="p-2 text-slate-600 dark:text-slate-400
                                                     hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                                            title="Ver detalhes"
                                        >
                                            <Eye className="w-5 h-5" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modal de Detalhes do Contrato */}
            {showDetalheModal && selectedContrato && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl max-w-2xl w-full max-h-[90vh]
                                  overflow-y-auto">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                    Detalhes do Contrato
                                </h2>
                                <button
                                    onClick={() => setShowDetalheModal(false)}
                                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Cabeçalho do Contrato */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-xl
                                                  flex items-center justify-center">
                                        <FileText className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                                            {selectedContrato.numero_contrato}
                                        </h3>
                                        <p className="text-slate-500 dark:text-slate-400">
                                            Criado em {formatDate(selectedContrato.created_at)}
                                        </p>
                                    </div>
                                </div>
                                {getStatusBadge(selectedContrato.status)}
                            </div>

                            {/* Informações do Beneficiário */}
                            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
                                <h4 className="font-medium text-slate-700 dark:text-slate-300 mb-3
                                             flex items-center gap-2">
                                    <User className="w-4 h-4" />
                                    Beneficiário
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Nome</p>
                                        <p className="font-medium text-slate-900 dark:text-white">
                                            {selectedContrato.beneficiario_nome}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Documento</p>
                                        <p className="font-medium text-slate-900 dark:text-white">
                                            {selectedContrato.beneficiario_documento}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Informações da Usina */}
                            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
                                <h4 className="font-medium text-slate-700 dark:text-slate-300 mb-3
                                             flex items-center gap-2">
                                    <Building className="w-4 h-4" />
                                    Usina
                                </h4>
                                <p className="font-medium text-slate-900 dark:text-white">
                                    {selectedContrato.usina_nome}
                                </p>
                            </div>

                            {/* Condições do Contrato */}
                            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
                                <h4 className="font-medium text-slate-700 dark:text-slate-300 mb-3
                                             flex items-center gap-2">
                                    <Calendar className="w-4 h-4" />
                                    Condições
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Data de Início</p>
                                        <p className="font-medium text-slate-900 dark:text-white">
                                            {formatDate(selectedContrato.data_inicio)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Percentual de Rateio</p>
                                        <p className="font-medium text-slate-900 dark:text-white">
                                            {selectedContrato.percentual_rateio.toFixed(1)}%
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Desconto</p>
                                        <p className="font-medium text-slate-900 dark:text-white">
                                            {selectedContrato.desconto_percentual}%
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Valor Estimado/Mês</p>
                                        <p className="font-medium text-green-600 dark:text-green-400">
                                            {formatCurrency(selectedContrato.valor_mensal_estimado)}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Ações */}
                            <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                                <button
                                    onClick={() => setShowDetalheModal(false)}
                                    className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600
                                             text-slate-700 dark:text-slate-300 rounded-lg
                                             hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                                >
                                    Fechar
                                </button>

                                {selectedContrato.status === 'ativo' && (
                                    <button
                                        onClick={() => handleSuspenderContrato(selectedContrato)}
                                        className="px-4 py-2 bg-red-600 text-white rounded-lg
                                                 hover:bg-red-700 transition-colors"
                                    >
                                        Suspender
                                    </button>
                                )}

                                {selectedContrato.status === 'suspenso' && (
                                    <button
                                        onClick={() => handleReativarContrato(selectedContrato)}
                                        className="px-4 py-2 bg-green-600 text-white rounded-lg
                                                 hover:bg-green-700 transition-colors"
                                    >
                                        Reativar
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Novo Contrato */}
            {showNovoModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                Novo Contrato
                            </h2>
                            <button
                                onClick={() => setShowNovoModal(false)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {beneficiariosSemContrato.length === 0 ? (
                                <div className="text-center py-8">
                                    <User className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                                    <p className="text-slate-600 dark:text-slate-400">
                                        Todos os beneficiários já possuem contratos ativos.
                                    </p>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                                        Adicione novos beneficiários na página de Beneficiários.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700
                                                       dark:text-slate-300 mb-2">
                                            Beneficiário
                                        </label>
                                        <select
                                            value={novoContrato.beneficiario_id}
                                            onChange={(e) => setNovoContrato({
                                                ...novoContrato,
                                                beneficiario_id: e.target.value
                                            })}
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700
                                                     border border-slate-300 dark:border-slate-600 rounded-lg
                                                     dark:text-white"
                                        >
                                            <option value="">Selecione...</option>
                                            {beneficiariosSemContrato.map(b => (
                                                <option key={b.id} value={b.id}>
                                                    {b.nome} - {b.documento}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700
                                                       dark:text-slate-300 mb-2">
                                            Data de Início
                                        </label>
                                        <input
                                            type="date"
                                            value={novoContrato.data_inicio}
                                            onChange={(e) => setNovoContrato({
                                                ...novoContrato,
                                                data_inicio: e.target.value
                                            })}
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700
                                                     border border-slate-300 dark:border-slate-600 rounded-lg
                                                     dark:text-white"
                                        />
                                    </div>

                                    <div className="flex gap-3 pt-4">
                                        <button
                                            onClick={() => setShowNovoModal(false)}
                                            className="flex-1 px-4 py-2 border border-slate-300
                                                     dark:border-slate-600 text-slate-700 dark:text-slate-300
                                                     rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            onClick={handleCriarContrato}
                                            disabled={!novoContrato.beneficiario_id}
                                            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg
                                                     hover:bg-green-700 disabled:opacity-50"
                                        >
                                            Criar Contrato
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ContratosGestor;
