/**
 * GestaoClientes - Visão Cliente-Cêntrica para Gestão do Portfolio
 *
 * Diferente de BeneficiariosGestor (foco em UC), esta página foca no CLIENTE:
 * - Lista clientes com suas UCs vinculadas
 * - Mostra métricas consolidadas (economia, faturas, etc.)
 * - Identifica clientes legados vs convertidos de leads
 */

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usinasApi } from '../../api/usinas';
import { beneficiariosApi, ClientePortfolio } from '../../api/beneficiarios';
import type { Usina } from '../../api/types';
import {
    Users,
    Search,
    Filter,
    Loader2,
    RefreshCw,
    AlertCircle,
    Building2,
    Mail,
    Phone,
    TrendingUp,
    FileText,
    Clock,
    ChevronDown,
    ChevronUp,
    UserCheck,
    UserX,
    Zap,
    MapPin,
    Calendar,
    BadgeCheck,
    BadgeAlert
} from 'lucide-react';

export function GestaoClientes() {
    const [searchParams, setSearchParams] = useSearchParams();
    const usinaIdParam = searchParams.get('usina');

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [usinas, setUsinas] = useState<Usina[]>([]);
    const [clientes, setClientes] = useState<ClientePortfolio[]>([]);
    const [usinaFiltro, setUsinaFiltro] = useState<number | null>(usinaIdParam ? Number(usinaIdParam) : null);
    const [busca, setBusca] = useState('');
    const [expandido, setExpandido] = useState<number | null>(null);
    const [filtroOrigem, setFiltroOrigem] = useState<'todos' | 'LEAD' | 'LEGADO'>('todos');

    useEffect(() => {
        fetchUsinas();
        fetchClientes();
    }, []);

    useEffect(() => {
        fetchClientes();
    }, [usinaFiltro]);

    const fetchUsinas = async () => {
        try {
            const response = await usinasApi.minhas();
            setUsinas(response.data || []);
        } catch (err) {
            console.error('Erro ao carregar usinas:', err);
        }
    };

    const fetchClientes = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await beneficiariosApi.portfolio({
                usina_id: usinaFiltro || undefined,
                busca: busca || undefined
            });

            setClientes(response.data?.clientes || []);
        } catch (err: any) {
            console.error('Erro ao carregar clientes:', err);
            setError(err.response?.data?.detail || 'Erro ao carregar clientes');
        } finally {
            setLoading(false);
        }
    };

    const handleBusca = () => {
        fetchClientes();
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleBusca();
        }
    };

    const handleUsinaChange = (usinaId: string) => {
        const id = usinaId ? Number(usinaId) : null;
        setUsinaFiltro(id);
        if (id) {
            setSearchParams({ usina: String(id) });
        } else {
            setSearchParams({});
        }
    };

    const toggleExpandido = (id: number) => {
        setExpandido(expandido === id ? null : id);
    };

    // Filtrar clientes por origem
    const clientesFiltrados = clientes.filter(c => {
        if (filtroOrigem === 'todos') return true;
        return c.origem === filtroOrigem;
    });

    // Calcular totais
    const totalEconomia = clientesFiltrados.reduce((acc, c) => acc + (c.metricas.economia_acumulada || 0), 0);
    const totalFaturasProcessadas = clientesFiltrados.reduce((acc, c) => acc + c.metricas.faturas_processadas, 0);
    const totalFaturasPendentes = clientesFiltrados.reduce((acc, c) => acc + c.metricas.faturas_pendentes, 0);
    const clientesLegados = clientes.filter(c => c.origem === 'LEGADO').length;
    const clientesConvertidos = clientes.filter(c => c.origem === 'LEAD').length;

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value);
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('pt-BR');
    };

    const getStatusBadge = (status: string) => {
        const statusMap: Record<string, { label: string; className: string }> = {
            'ATIVO': { label: 'Ativo', className: 'bg-green-100 text-green-800' },
            'PENDENTE': { label: 'Pendente', className: 'bg-yellow-100 text-yellow-800' },
            'SUSPENSO': { label: 'Suspenso', className: 'bg-orange-100 text-orange-800' },
            'CANCELADO': { label: 'Cancelado', className: 'bg-red-100 text-red-800' },
        };
        const config = statusMap[status] || { label: status, className: 'bg-gray-100 text-gray-800' };
        return (
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${config.className}`}>
                {config.label}
            </span>
        );
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Users className="h-7 w-7 text-blue-600" />
                        Gestão de Clientes
                    </h1>
                    <p className="text-gray-500 mt-1">
                        Visão consolidada do portfolio de clientes
                    </p>
                </div>
                <button
                    onClick={fetchClientes}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    Atualizar
                </button>
            </div>

            {/* Cards de Resumo */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-white rounded-lg shadow p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <Users className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Total Clientes</p>
                            <p className="text-xl font-bold text-gray-900">{clientes.length}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                            <TrendingUp className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Economia Total</p>
                            <p className="text-xl font-bold text-green-600">{formatCurrency(totalEconomia)}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-lg">
                            <FileText className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Faturas Processadas</p>
                            <p className="text-xl font-bold text-gray-900">{totalFaturasProcessadas}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-yellow-100 rounded-lg">
                            <Clock className="h-5 w-5 text-yellow-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Faturas Pendentes</p>
                            <p className="text-xl font-bold text-yellow-600">{totalFaturasPendentes}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-100 rounded-lg">
                            <UserX className="h-5 w-5 text-orange-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Clientes Legados</p>
                            <p className="text-xl font-bold text-orange-600">{clientesLegados}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filtros */}
            <div className="bg-white rounded-lg shadow p-4">
                <div className="flex flex-wrap items-center gap-4">
                    {/* Busca */}
                    <div className="flex-1 min-w-[200px]">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Buscar por nome, CPF ou email..."
                                value={busca}
                                onChange={(e) => setBusca(e.target.value)}
                                onKeyPress={handleKeyPress}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>

                    {/* Filtro Usina */}
                    <div className="min-w-[200px]">
                        <div className="relative">
                            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <select
                                value={usinaFiltro || ''}
                                onChange={(e) => handleUsinaChange(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 appearance-none bg-white"
                            >
                                <option value="">Todas as usinas</option>
                                {usinas.map((usina) => (
                                    <option key={usina.id} value={usina.id}>
                                        {usina.nome}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Filtro Origem */}
                    <div className="min-w-[180px]">
                        <div className="relative">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <select
                                value={filtroOrigem}
                                onChange={(e) => setFiltroOrigem(e.target.value as any)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 appearance-none bg-white"
                            >
                                <option value="todos">Todas as origens</option>
                                <option value="LEAD">Convertidos (Lead)</option>
                                <option value="LEGADO">Legados</option>
                            </select>
                        </div>
                    </div>

                    <button
                        onClick={handleBusca}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Buscar
                    </button>
                </div>
            </div>

            {/* Lista de Clientes */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    <span className="ml-2 text-gray-600">Carregando clientes...</span>
                </div>
            ) : error ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    <span className="text-red-700">{error}</span>
                </div>
            ) : clientesFiltrados.length === 0 ? (
                <div className="bg-gray-50 rounded-lg p-8 text-center">
                    <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">Nenhum cliente encontrado</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {clientesFiltrados.map((cliente) => (
                        <div
                            key={cliente.id}
                            className="bg-white rounded-lg shadow overflow-hidden"
                        >
                            {/* Card Header - Clicável para expandir */}
                            <div
                                className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                                onClick={() => toggleExpandido(cliente.id)}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        {/* Avatar/Ícone */}
                                        <div className={`p-3 rounded-full ${cliente.origem === 'LEAD' ? 'bg-green-100' : 'bg-orange-100'}`}>
                                            {cliente.origem === 'LEAD' ? (
                                                <UserCheck className="h-6 w-6 text-green-600" />
                                            ) : (
                                                <UserX className="h-6 w-6 text-orange-600" />
                                            )}
                                        </div>

                                        {/* Info Principal */}
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-semibold text-gray-900">
                                                    {cliente.nome}
                                                </h3>
                                                {getStatusBadge(cliente.status)}
                                                {cliente.origem === 'LEGADO' && (
                                                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-orange-100 text-orange-700 flex items-center gap-1">
                                                        <BadgeAlert className="h-3 w-3" />
                                                        Legado
                                                    </span>
                                                )}
                                                {cliente.origem === 'LEAD' && (
                                                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700 flex items-center gap-1">
                                                        <BadgeCheck className="h-3 w-3" />
                                                        Convertido
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                                                {cliente.cpf && (
                                                    <span>CPF: {cliente.cpf}</span>
                                                )}
                                                {cliente.uc?.numero_uc && (
                                                    <span className="flex items-center gap-1">
                                                        <Zap className="h-3 w-3" />
                                                        UC: {cliente.uc.numero_uc}
                                                    </span>
                                                )}
                                                {cliente.usina?.nome && (
                                                    <span className="flex items-center gap-1">
                                                        <Building2 className="h-3 w-3" />
                                                        {cliente.usina.nome}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Métricas Resumidas */}
                                    <div className="flex items-center gap-6">
                                        <div className="text-right">
                                            <p className="text-xs text-gray-500">Economia</p>
                                            <p className="font-semibold text-green-600">
                                                {formatCurrency(cliente.metricas.economia_acumulada || 0)}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-gray-500">Cobranças</p>
                                            <p className="font-semibold text-gray-900">
                                                {cliente.metricas.total_cobrancas}
                                            </p>
                                        </div>
                                        {expandido === cliente.id ? (
                                            <ChevronUp className="h-5 w-5 text-gray-400" />
                                        ) : (
                                            <ChevronDown className="h-5 w-5 text-gray-400" />
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Card Expandido */}
                            {expandido === cliente.id && (
                                <div className="border-t border-gray-200 p-4 bg-gray-50">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        {/* Contato */}
                                        <div>
                                            <h4 className="font-medium text-gray-900 mb-3">Contato</h4>
                                            <div className="space-y-2 text-sm">
                                                {cliente.email && (
                                                    <div className="flex items-center gap-2 text-gray-600">
                                                        <Mail className="h-4 w-4 text-gray-400" />
                                                        {cliente.email}
                                                    </div>
                                                )}
                                                {cliente.telefone && (
                                                    <div className="flex items-center gap-2 text-gray-600">
                                                        <Phone className="h-4 w-4 text-gray-400" />
                                                        {cliente.telefone}
                                                    </div>
                                                )}
                                                {cliente.convertido_em && (
                                                    <div className="flex items-center gap-2 text-gray-600">
                                                        <Calendar className="h-4 w-4 text-gray-400" />
                                                        Convertido em: {formatDate(cliente.convertido_em)}
                                                    </div>
                                                )}
                                                {!cliente.email && !cliente.telefone && (
                                                    <p className="text-gray-400 italic">Sem contato cadastrado</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* UC */}
                                        <div>
                                            <h4 className="font-medium text-gray-900 mb-3">Unidade Consumidora</h4>
                                            {cliente.uc ? (
                                                <div className="space-y-2 text-sm">
                                                    <div className="flex items-center gap-2 text-gray-600">
                                                        <Zap className="h-4 w-4 text-gray-400" />
                                                        <span className="font-medium">{cliente.uc.numero_uc}</span>
                                                        {cliente.uc.apelido && (
                                                            <span className="text-gray-400">({cliente.uc.apelido})</span>
                                                        )}
                                                    </div>
                                                    {cliente.uc.nome_titular && (
                                                        <div className="text-gray-600">
                                                            Titular: {cliente.uc.nome_titular}
                                                        </div>
                                                    )}
                                                    {cliente.uc.endereco && (
                                                        <div className="flex items-center gap-2 text-gray-600">
                                                            <MapPin className="h-4 w-4 text-gray-400" />
                                                            {cliente.uc.endereco}
                                                            {cliente.uc.cidade && `, ${cliente.uc.cidade}`}
                                                            {cliente.uc.uf && ` - ${cliente.uc.uf}`}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <p className="text-gray-400 italic text-sm">Sem UC vinculada</p>
                                            )}
                                        </div>

                                        {/* Métricas */}
                                        <div>
                                            <h4 className="font-medium text-gray-900 mb-3">Métricas</h4>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="bg-white rounded-lg p-3 border">
                                                    <p className="text-xs text-gray-500">Economia Acumulada</p>
                                                    <p className="font-semibold text-green-600">
                                                        {formatCurrency(cliente.metricas.economia_acumulada || 0)}
                                                    </p>
                                                </div>
                                                <div className="bg-white rounded-lg p-3 border">
                                                    <p className="text-xs text-gray-500">Total Cobranças</p>
                                                    <p className="font-semibold text-gray-900">
                                                        {cliente.metricas.total_cobrancas}
                                                    </p>
                                                </div>
                                                <div className="bg-white rounded-lg p-3 border">
                                                    <p className="text-xs text-gray-500">Processadas</p>
                                                    <p className="font-semibold text-blue-600">
                                                        {cliente.metricas.faturas_processadas}
                                                    </p>
                                                </div>
                                                <div className="bg-white rounded-lg p-3 border">
                                                    <p className="text-xs text-gray-500">Pendentes</p>
                                                    <p className="font-semibold text-yellow-600">
                                                        {cliente.metricas.faturas_pendentes}
                                                    </p>
                                                </div>
                                            </div>
                                            {cliente.metricas.ultima_cobranca && (
                                                <p className="text-xs text-gray-500 mt-2">
                                                    Última cobrança: {formatDate(cliente.metricas.ultima_cobranca)}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default GestaoClientes;
