/**
 * FinanceiroGestor - Página de Gestão Financeira para Gestores
 * Resumo financeiro, histórico de transações e solicitação de saques
 */

import { useState, useEffect, useCallback } from 'react';
import {
    DollarSign,
    TrendingUp,
    TrendingDown,
    Clock,
    CheckCircle,
    XCircle,
    Download,
    RefreshCw,
    Calendar,
    Filter,
    ArrowUpRight,
    ArrowDownLeft,
    Wallet,
    PiggyBank,
    AlertTriangle,
    X
} from 'lucide-react';
import { cobrancasApi } from '../../api/cobrancas';
import { usinasApi } from '../../api/usinas';

interface ResumoFinanceiro {
    saldo_disponivel: number;
    total_recebido_mes: number;
    total_pendente: number;
    total_saques: number;
    variacao_mes: number;
}

interface Transacao {
    id: number;
    tipo: 'entrada' | 'saida' | 'saque';
    descricao: string;
    valor: number;
    data: string;
    status: string;
    referencia?: string;
}

interface Saque {
    id: number;
    valor: number;
    data_solicitacao: string;
    data_processamento?: string;
    status: 'pendente' | 'processando' | 'concluido' | 'cancelado';
    conta_destino: string;
}

export function FinanceiroGestor() {
    const [resumo, setResumo] = useState<ResumoFinanceiro | null>(null);
    const [transacoes, setTransacoes] = useState<Transacao[]>([]);
    const [saques, setSaques] = useState<Saque[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'resumo' | 'transacoes' | 'saques'>('resumo');
    const [filtroMes, setFiltroMes] = useState<number>(new Date().getMonth() + 1);
    const [filtroAno, setFiltroAno] = useState<number>(new Date().getFullYear());
    const [showSaqueModal, setShowSaqueModal] = useState(false);
    const [valorSaque, setValorSaque] = useState('');
    const [solicitandoSaque, setSolicitandoSaque] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const carregarDados = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            // Buscar estatísticas de cobranças
            const statsResponse = await cobrancasApi.estatisticas();
            const stats = statsResponse.data;

            // Buscar cobranças para calcular transações
            const cobrancasResponse = await cobrancasApi.listar({
                mes: filtroMes,
                ano: filtroAno
            });
            const cobrancas = cobrancasResponse.data || [];

            // Calcular resumo financeiro
            const totalRecebido = cobrancas
                .filter((c: any) => c.status === 'pago')
                .reduce((sum: number, c: any) => sum + (c.valor_pago || c.valor || 0), 0);

            const totalPendente = cobrancas
                .filter((c: any) => c.status === 'pendente')
                .reduce((sum: number, c: any) => sum + (c.valor || 0), 0);

            setResumo({
                saldo_disponivel: stats?.total_recebido || totalRecebido * 0.85, // 85% após taxa
                total_recebido_mes: totalRecebido,
                total_pendente: totalPendente,
                total_saques: 0,
                variacao_mes: stats?.variacao_mes || 12.5
            });

            // Converter cobranças em transações
            const transacoesData: Transacao[] = cobrancas.map((c: any) => ({
                id: c.id,
                tipo: 'entrada' as const,
                descricao: `Cobrança - ${c.beneficiario_nome || 'Beneficiário'}`,
                valor: c.valor_pago || c.valor || 0,
                data: c.data_pagamento || c.data_vencimento || c.created_at,
                status: c.status,
                referencia: `${String(c.mes_referencia).padStart(2, '0')}/${c.ano_referencia}`
            }));

            setTransacoes(transacoesData);

            // Dados mock de saques (seria substituído por API real)
            setSaques([
                {
                    id: 1,
                    valor: 5000,
                    data_solicitacao: '2024-11-15',
                    data_processamento: '2024-11-18',
                    status: 'concluido',
                    conta_destino: '****1234'
                },
                {
                    id: 2,
                    valor: 3500,
                    data_solicitacao: '2024-12-01',
                    status: 'pendente',
                    conta_destino: '****1234'
                }
            ]);

        } catch (err) {
            console.error('Erro ao carregar dados financeiros:', err);
            setError('Erro ao carregar dados financeiros');
        } finally {
            setLoading(false);
        }
    }, [filtroMes, filtroAno]);

    useEffect(() => {
        carregarDados();
    }, [carregarDados]);

    const handleSolicitarSaque = async () => {
        const valor = parseFloat(valorSaque);
        if (isNaN(valor) || valor <= 0) {
            setError('Informe um valor válido');
            return;
        }

        if (resumo && valor > resumo.saldo_disponivel) {
            setError('Valor excede o saldo disponível');
            return;
        }

        try {
            setSolicitandoSaque(true);
            // Aqui chamaria a API real de solicitação de saque
            await new Promise(resolve => setTimeout(resolve, 1000));

            setSuccessMessage('Saque solicitado com sucesso! Processamento em até 3 dias úteis.');
            setShowSaqueModal(false);
            setValorSaque('');
            await carregarDados();

            setTimeout(() => setSuccessMessage(null), 5000);
        } catch {
            setError('Erro ao solicitar saque');
        } finally {
            setSolicitandoSaque(false);
        }
    };

    const formatCurrency = (value: number): string => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value);
    };

    const formatDate = (dateStr: string): string => {
        try {
            return new Date(dateStr).toLocaleDateString('pt-BR');
        } catch {
            return dateStr;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pago':
            case 'concluido':
                return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30';
            case 'pendente':
            case 'processando':
                return 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30';
            case 'cancelado':
            case 'vencido':
                return 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30';
            default:
                return 'text-slate-600 bg-slate-100 dark:text-slate-400 dark:bg-slate-700';
        }
    };

    const meses = [
        { value: 1, label: 'Janeiro' },
        { value: 2, label: 'Fevereiro' },
        { value: 3, label: 'Março' },
        { value: 4, label: 'Abril' },
        { value: 5, label: 'Maio' },
        { value: 6, label: 'Junho' },
        { value: 7, label: 'Julho' },
        { value: 8, label: 'Agosto' },
        { value: 9, label: 'Setembro' },
        { value: 10, label: 'Outubro' },
        { value: 11, label: 'Novembro' },
        { value: 12, label: 'Dezembro' }
    ];

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
                        Financeiro
                    </h1>
                    <p className="text-slate-600 dark:text-slate-400 mt-1">
                        Gerencie suas finanças e solicitações de saque
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
                        onClick={() => setShowSaqueModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white
                                 rounded-lg hover:bg-green-700 transition-colors"
                    >
                        <Wallet className="w-4 h-4" />
                        Solicitar Saque
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

            {/* Cards de Resumo */}
            {resumo && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200
                                  dark:border-slate-700">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg
                                          flex items-center justify-center">
                                <Wallet className="w-6 h-6 text-green-600 dark:text-green-400" />
                            </div>
                            <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                                Disponível
                            </span>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Saldo Disponível</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                            {formatCurrency(resumo.saldo_disponivel)}
                        </p>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200
                                  dark:border-slate-700">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg
                                          flex items-center justify-center">
                                <ArrowDownLeft className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                            </div>
                            {(Number(resumo.variacao_mes) || 0) >= 0 ? (
                                <span className="flex items-center gap-1 text-xs text-green-600
                                               dark:text-green-400 font-medium">
                                    <TrendingUp className="w-3 h-3" />
                                    +{(Number(resumo.variacao_mes) || 0).toFixed(1)}%
                                </span>
                            ) : (
                                <span className="flex items-center gap-1 text-xs text-red-600
                                               dark:text-red-400 font-medium">
                                    <TrendingDown className="w-3 h-3" />
                                    {(Number(resumo.variacao_mes) || 0).toFixed(1)}%
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Recebido no Mês</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                            {formatCurrency(resumo.total_recebido_mes)}
                        </p>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200
                                  dark:border-slate-700">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-lg
                                          flex items-center justify-center">
                                <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                            </div>
                            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                                A receber
                            </span>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Pendente</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                            {formatCurrency(resumo.total_pendente)}
                        </p>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200
                                  dark:border-slate-700">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg
                                          flex items-center justify-center">
                                <ArrowUpRight className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                            </div>
                            <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                                Total
                            </span>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Saques Realizados</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                            {formatCurrency(saques.filter(s => s.status === 'concluido')
                                .reduce((sum, s) => sum + s.valor, 0))}
                        </p>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="border-b border-slate-200 dark:border-slate-700">
                <nav className="flex gap-4">
                    {[
                        { id: 'resumo', label: 'Resumo', icon: PiggyBank },
                        { id: 'transacoes', label: 'Transações', icon: DollarSign },
                        { id: 'saques', label: 'Saques', icon: Wallet }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                                activeTab === tab.id
                                    ? 'border-green-600 text-green-600 dark:text-green-400'
                                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Filtros */}
            {activeTab === 'transacoes' && (
                <div className="flex items-center gap-4 bg-white dark:bg-slate-800 rounded-lg p-4
                              border border-slate-200 dark:border-slate-700">
                    <Filter className="w-5 h-5 text-slate-400" />
                    <select
                        value={filtroMes}
                        onChange={(e) => setFiltroMes(parseInt(e.target.value))}
                        className="px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-300
                                 dark:border-slate-600 rounded-lg dark:text-white"
                    >
                        {meses.map(m => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                    </select>
                    <select
                        value={filtroAno}
                        onChange={(e) => setFiltroAno(parseInt(e.target.value))}
                        className="px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-300
                                 dark:border-slate-600 rounded-lg dark:text-white"
                    >
                        {[2024, 2025].map(ano => (
                            <option key={ano} value={ano}>{ano}</option>
                        ))}
                    </select>
                </div>
            )}

            {/* Conteúdo das Tabs */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200
                          dark:border-slate-700 overflow-hidden">

                {/* Tab Resumo */}
                {activeTab === 'resumo' && (
                    <div className="p-6">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">
                            Resumo Financeiro
                        </h3>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Gráfico de Barras Simples (texto) */}
                            <div className="space-y-4">
                                <h4 className="font-medium text-slate-700 dark:text-slate-300">
                                    Últimos 6 meses
                                </h4>
                                {[
                                    { mes: 'Jul', valor: 12500 },
                                    { mes: 'Ago', valor: 14200 },
                                    { mes: 'Set', valor: 13800 },
                                    { mes: 'Out', valor: 15600 },
                                    { mes: 'Nov', valor: 16200 },
                                    { mes: 'Dez', valor: resumo?.total_recebido_mes || 0 }
                                ].map(item => (
                                    <div key={item.mes} className="flex items-center gap-4">
                                        <span className="w-12 text-sm text-slate-500 dark:text-slate-400">
                                            {item.mes}
                                        </span>
                                        <div className="flex-1 h-6 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-green-500 rounded-full transition-all"
                                                style={{ width: `${Math.min((item.valor / 20000) * 100, 100)}%` }}
                                            />
                                        </div>
                                        <span className="w-24 text-right text-sm font-medium text-slate-900 dark:text-white">
                                            {formatCurrency(item.valor)}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* Informações Adicionais */}
                            <div className="space-y-4">
                                <h4 className="font-medium text-slate-700 dark:text-slate-300">
                                    Informações
                                </h4>
                                <div className="space-y-3">
                                    <div className="flex justify-between py-2 border-b border-slate-100
                                                  dark:border-slate-700">
                                        <span className="text-slate-600 dark:text-slate-400">
                                            Taxa de administração
                                        </span>
                                        <span className="font-medium text-slate-900 dark:text-white">
                                            15%
                                        </span>
                                    </div>
                                    <div className="flex justify-between py-2 border-b border-slate-100
                                                  dark:border-slate-700">
                                        <span className="text-slate-600 dark:text-slate-400">
                                            Prazo de saque
                                        </span>
                                        <span className="font-medium text-slate-900 dark:text-white">
                                            3 dias úteis
                                        </span>
                                    </div>
                                    <div className="flex justify-between py-2 border-b border-slate-100
                                                  dark:border-slate-700">
                                        <span className="text-slate-600 dark:text-slate-400">
                                            Saque mínimo
                                        </span>
                                        <span className="font-medium text-slate-900 dark:text-white">
                                            R$ 100,00
                                        </span>
                                    </div>
                                    <div className="flex justify-between py-2">
                                        <span className="text-slate-600 dark:text-slate-400">
                                            Conta bancária cadastrada
                                        </span>
                                        <span className="font-medium text-slate-900 dark:text-white">
                                            ****1234
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Tab Transações */}
                {activeTab === 'transacoes' && (
                    <div>
                        {transacoes.length === 0 ? (
                            <div className="p-12 text-center">
                                <DollarSign className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                                    Nenhuma transação encontrada
                                </h3>
                                <p className="text-slate-500 dark:text-slate-400">
                                    Não há transações para o período selecionado
                                </p>
                            </div>
                        ) : (
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-700/50">
                                        <th className="px-6 py-3 text-left text-xs font-medium
                                                     text-slate-500 dark:text-slate-400 uppercase">
                                            Data
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium
                                                     text-slate-500 dark:text-slate-400 uppercase">
                                            Descrição
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium
                                                     text-slate-500 dark:text-slate-400 uppercase">
                                            Referência
                                        </th>
                                        <th className="px-6 py-3 text-center text-xs font-medium
                                                     text-slate-500 dark:text-slate-400 uppercase">
                                            Status
                                        </th>
                                        <th className="px-6 py-3 text-right text-xs font-medium
                                                     text-slate-500 dark:text-slate-400 uppercase">
                                            Valor
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                    {transacoes.map((transacao) => (
                                        <tr key={transacao.id} className="hover:bg-slate-50
                                                                        dark:hover:bg-slate-700/30">
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                                {formatDate(transacao.data)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center
                                                        ${transacao.tipo === 'entrada'
                                                            ? 'bg-green-100 dark:bg-green-900/30'
                                                            : 'bg-red-100 dark:bg-red-900/30'
                                                        }`}>
                                                        {transacao.tipo === 'entrada' ? (
                                                            <ArrowDownLeft className="w-4 h-4 text-green-600 dark:text-green-400" />
                                                        ) : (
                                                            <ArrowUpRight className="w-4 h-4 text-red-600 dark:text-red-400" />
                                                        )}
                                                    </div>
                                                    <span className="text-slate-900 dark:text-white">
                                                        {transacao.descricao}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                                {transacao.referencia || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-2 py-1 text-xs font-medium rounded-full
                                                    ${getStatusColor(transacao.status)}`}>
                                                    {transacao.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className={`font-medium ${
                                                    transacao.tipo === 'entrada'
                                                        ? 'text-green-600 dark:text-green-400'
                                                        : 'text-red-600 dark:text-red-400'
                                                }`}>
                                                    {transacao.tipo === 'entrada' ? '+' : '-'}
                                                    {formatCurrency(transacao.valor)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}

                {/* Tab Saques */}
                {activeTab === 'saques' && (
                    <div>
                        {saques.length === 0 ? (
                            <div className="p-12 text-center">
                                <Wallet className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                                    Nenhum saque realizado
                                </h3>
                                <p className="text-slate-500 dark:text-slate-400">
                                    Você ainda não solicitou nenhum saque
                                </p>
                            </div>
                        ) : (
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-700/50">
                                        <th className="px-6 py-3 text-left text-xs font-medium
                                                     text-slate-500 dark:text-slate-400 uppercase">
                                            Data Solicitação
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium
                                                     text-slate-500 dark:text-slate-400 uppercase">
                                            Conta Destino
                                        </th>
                                        <th className="px-6 py-3 text-center text-xs font-medium
                                                     text-slate-500 dark:text-slate-400 uppercase">
                                            Status
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium
                                                     text-slate-500 dark:text-slate-400 uppercase">
                                            Data Processamento
                                        </th>
                                        <th className="px-6 py-3 text-right text-xs font-medium
                                                     text-slate-500 dark:text-slate-400 uppercase">
                                            Valor
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                    {saques.map((saque) => (
                                        <tr key={saque.id} className="hover:bg-slate-50
                                                                     dark:hover:bg-slate-700/30">
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                                {formatDate(saque.data_solicitacao)}
                                            </td>
                                            <td className="px-6 py-4 text-slate-900 dark:text-white">
                                                {saque.conta_destino}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-2 py-1 text-xs font-medium rounded-full
                                                    ${getStatusColor(saque.status)}`}>
                                                    {saque.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                                {saque.data_processamento
                                                    ? formatDate(saque.data_processamento)
                                                    : '-'
                                                }
                                            </td>
                                            <td className="px-6 py-4 text-right font-medium text-slate-900
                                                         dark:text-white">
                                                {formatCurrency(saque.valor)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}
            </div>

            {/* Modal de Saque */}
            {showSaqueModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                Solicitar Saque
                            </h2>
                            <button
                                onClick={() => setShowSaqueModal(false)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                                <p className="text-sm text-green-600 dark:text-green-400">
                                    Saldo disponível
                                </p>
                                <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                                    {resumo ? formatCurrency(resumo.saldo_disponivel) : 'R$ 0,00'}
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700
                                               dark:text-slate-300 mb-2">
                                    Valor do saque
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2
                                                   text-slate-500">R$</span>
                                    <input
                                        type="number"
                                        value={valorSaque}
                                        onChange={(e) => setValorSaque(e.target.value)}
                                        placeholder="0,00"
                                        min="100"
                                        step="0.01"
                                        className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-700
                                                 border border-slate-300 dark:border-slate-600 rounded-lg
                                                 focus:ring-2 focus:ring-green-500 dark:text-white"
                                    />
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    Valor mínimo: R$ 100,00
                                </p>
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
                                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                                    Conta destino
                                </p>
                                <p className="font-medium text-slate-900 dark:text-white">
                                    Banco do Brasil - Ag. 1234 - CC ****5678
                                </p>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setShowSaqueModal(false)}
                                    className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600
                                             text-slate-700 dark:text-slate-300 rounded-lg
                                             hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSolicitarSaque}
                                    disabled={solicitandoSaque || !valorSaque}
                                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg
                                             hover:bg-green-700 transition-colors disabled:opacity-50"
                                >
                                    {solicitandoSaque ? 'Solicitando...' : 'Confirmar Saque'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default FinanceiroGestor;
