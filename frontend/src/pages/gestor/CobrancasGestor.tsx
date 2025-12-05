/**
 * CobrancasGestor - Gestão de Cobranças do Gestor
 */

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usinasApi } from '../../api/usinas';
import { cobrancasApi } from '../../api/cobrancas';
import type { Usina, Cobranca } from '../../api/types';
import {
    FileText,
    Search,
    Filter,
    Plus,
    Loader2,
    RefreshCw,
    AlertCircle,
    CheckCircle,
    XCircle,
    Calendar,
    DollarSign,
    Building2,
    Users,
    Clock
} from 'lucide-react';

export function CobrancasGestor() {
    const [searchParams, setSearchParams] = useSearchParams();
    const usinaIdParam = searchParams.get('usina');

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [usinas, setUsinas] = useState<Usina[]>([]);
    const [cobrancas, setCobrancas] = useState<Cobranca[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const perPage = 20;

    // Filtros
    const [usinaFiltro, setUsinaFiltro] = useState<number | null>(usinaIdParam ? Number(usinaIdParam) : null);
    const [statusFiltro, setStatusFiltro] = useState<string>('todos');
    const [mesFiltro, setMesFiltro] = useState<number>(new Date().getMonth() + 1);
    const [anoFiltro, setAnoFiltro] = useState<number>(new Date().getFullYear());

    // Modal Gerar Lote
    const [modalGerarLote, setModalGerarLote] = useState(false);
    const [gerandoLote, setGerandoLote] = useState(false);

    // Modal Pagamento
    const [cobrancaPagamento, setCobrancaPagamento] = useState<Cobranca | null>(null);
    const [registrandoPagamento, setRegistrandoPagamento] = useState(false);

    useEffect(() => {
        fetchUsinas();
    }, []);

    useEffect(() => {
        fetchCobrancas();
    }, [usinaFiltro, statusFiltro, mesFiltro, anoFiltro, page]);

    const fetchUsinas = async () => {
        try {
            const response = await usinasApi.minhas();
            setUsinas(response.data || []);
        } catch (err) {
            console.error('Erro ao carregar usinas:', err);
        }
    };

    const fetchCobrancas = async () => {
        try {
            setLoading(true);
            setError(null);

            const params: any = {
                page,
                limit: perPage,
                mes: mesFiltro,
                ano: anoFiltro
            };

            if (usinaFiltro) params.usina_id = usinaFiltro;
            if (statusFiltro !== 'todos') params.status = statusFiltro;

            const response = await cobrancasApi.listar(params);
            const data = response.data;

            if (Array.isArray(data)) {
                setCobrancas(data);
                setTotal(data.length);
            } else {
                setCobrancas(data?.items || data?.cobrancas || []);
                setTotal(data?.total || 0);
            }
        } catch (err: any) {
            console.error('Erro ao carregar cobranças:', err);
            setError(err.response?.data?.detail || 'Erro ao carregar cobranças');
        } finally {
            setLoading(false);
        }
    };

    const handleGerarLote = async (usinaId: number, vencimento: string) => {
        try {
            setGerandoLote(true);
            await cobrancasApi.gerarLote({
                usina_id: usinaId,
                mes: mesFiltro,
                ano: anoFiltro,
                vencimento
            });
            setModalGerarLote(false);
            fetchCobrancas();
            alert('Cobranças geradas com sucesso!');
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Erro ao gerar cobranças');
        } finally {
            setGerandoLote(false);
        }
    };

    const handleRegistrarPagamento = async (cobrancaId: number, dataPagamento: string, valorPago: number) => {
        try {
            setRegistrandoPagamento(true);
            await cobrancasApi.registrarPagamento(cobrancaId, dataPagamento, valorPago);
            setCobrancaPagamento(null);
            fetchCobrancas();
            alert('Pagamento registrado com sucesso!');
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Erro ao registrar pagamento');
        } finally {
            setRegistrandoPagamento(false);
        }
    };

    const handleCancelar = async (cobranca: Cobranca) => {
        const motivo = prompt('Informe o motivo do cancelamento:');
        if (!motivo) return;

        try {
            await cobrancasApi.cancelar(cobranca.id, motivo);
            fetchCobrancas();
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Erro ao cancelar cobrança');
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value || 0);
    };

    const meses = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    const anos = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

    // Estatísticas
    const stats = {
        total: cobrancas.length,
        pendentes: cobrancas.filter(c => c.status === 'PENDENTE' || c.status === 'pendente').length,
        pagas: cobrancas.filter(c => c.status === 'PAGO' || c.status === 'pago').length,
        valorPendente: cobrancas.filter(c => c.status === 'PENDENTE' || c.status === 'pendente').reduce((acc, c) => acc + (c.valor_total || 0), 0),
        valorRecebido: cobrancas.filter(c => c.status === 'PAGO' || c.status === 'pago').reduce((acc, c) => acc + (c.valor_total || 0), 0)
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        Cobranças
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        Gerencie as cobranças dos beneficiários
                    </p>
                </div>
                <button
                    onClick={() => setModalGerarLote(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                >
                    <Plus size={18} />
                    Gerar Cobranças
                </button>
            </div>

            {/* Filtros */}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                <div className="flex flex-col lg:flex-row gap-4">
                    {/* Filtro por Usina */}
                    <select
                        value={usinaFiltro || ''}
                        onChange={(e) => {
                            setUsinaFiltro(e.target.value ? Number(e.target.value) : null);
                            setPage(1);
                        }}
                        className="px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
                    >
                        <option value="">Todas as Usinas</option>
                        {usinas.map(usina => (
                            <option key={usina.id} value={usina.id}>{usina.nome}</option>
                        ))}
                    </select>

                    {/* Filtro por Mês */}
                    <select
                        value={mesFiltro}
                        onChange={(e) => {
                            setMesFiltro(Number(e.target.value));
                            setPage(1);
                        }}
                        className="px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
                    >
                        {meses.map((mes, idx) => (
                            <option key={idx} value={idx + 1}>{mes}</option>
                        ))}
                    </select>

                    {/* Filtro por Ano */}
                    <select
                        value={anoFiltro}
                        onChange={(e) => {
                            setAnoFiltro(Number(e.target.value));
                            setPage(1);
                        }}
                        className="px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
                    >
                        {anos.map(ano => (
                            <option key={ano} value={ano}>{ano}</option>
                        ))}
                    </select>

                    {/* Filtro por Status */}
                    <select
                        value={statusFiltro}
                        onChange={(e) => {
                            setStatusFiltro(e.target.value);
                            setPage(1);
                        }}
                        className="px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
                    >
                        <option value="todos">Todos os Status</option>
                        <option value="PENDENTE">Pendentes</option>
                        <option value="PAGO">Pagas</option>
                        <option value="VENCIDA">Vencidas</option>
                        <option value="CANCELADA">Canceladas</option>
                    </select>

                    <button
                        onClick={fetchCobrancas}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition"
                    >
                        <RefreshCw size={18} />
                    </button>
                </div>
            </div>

            {/* Estatísticas */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                            <FileText className="text-blue-600 dark:text-blue-400" size={20} />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Total</p>
                            <p className="text-xl font-bold text-slate-900 dark:text-white">{stats.total}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                            <Clock className="text-orange-600 dark:text-orange-400" size={20} />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Pendentes</p>
                            <p className="text-xl font-bold text-orange-600 dark:text-orange-400">{stats.pendentes}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                            <DollarSign className="text-red-600 dark:text-red-400" size={20} />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">A Receber</p>
                            <p className="text-lg font-bold text-red-600 dark:text-red-400">{formatCurrency(stats.valorPendente)}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                            <DollarSign className="text-green-600 dark:text-green-400" size={20} />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Recebido</p>
                            <p className="text-lg font-bold text-green-600 dark:text-green-400">{formatCurrency(stats.valorRecebido)}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Lista */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                    </div>
                ) : error ? (
                    <div className="p-8 text-center">
                        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                        <p className="text-slate-500 dark:text-slate-400">{error}</p>
                    </div>
                ) : cobrancas.length === 0 ? (
                    <div className="p-8 text-center">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                            <FileText className="w-8 h-8 text-slate-400" />
                        </div>
                        <p className="text-slate-500 dark:text-slate-400">
                            Nenhuma cobrança para {meses[mesFiltro - 1]} de {anoFiltro}
                        </p>
                        <button
                            onClick={() => setModalGerarLote(true)}
                            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                        >
                            Gerar Cobranças
                        </button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50 dark:bg-slate-900">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                                        Beneficiário
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                                        Referência
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                                        Vencimento
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                                        Valor
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                                        Status
                                    </th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                                        Ações
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                {cobrancas.map((cobranca) => {
                                    const vencida = new Date(cobranca.data_vencimento) < new Date() &&
                                                   (cobranca.status === 'PENDENTE' || cobranca.status === 'pendente');
                                    const isPago = cobranca.status === 'PAGO' || cobranca.status === 'pago';
                                    const isPendente = cobranca.status === 'PENDENTE' || cobranca.status === 'pendente';
                                    const isCancelada = cobranca.status === 'CANCELADA' || cobranca.status === 'cancelada';

                                    return (
                                        <tr key={cobranca.id} className="hover:bg-slate-50 dark:hover:bg-slate-900">
                                            <td className="px-4 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
                                                        <Users className="text-slate-400" size={20} />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-slate-900 dark:text-white">
                                                            {cobranca.beneficiario?.nome || `Beneficiário #${cobranca.beneficiario_id}`}
                                                        </p>
                                                        {cobranca.usina && (
                                                            <p className="text-xs text-slate-500 flex items-center gap-1">
                                                                <Building2 size={12} />
                                                                {cobranca.usina.nome}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-300">
                                                {meses[cobranca.mes - 1]?.slice(0, 3)}/{cobranca.ano}
                                            </td>
                                            <td className="px-4 py-4">
                                                <p className={`text-sm ${vencida ? 'text-red-500 font-medium' : 'text-slate-600 dark:text-slate-300'}`}>
                                                    {new Date(cobranca.data_vencimento).toLocaleDateString('pt-BR')}
                                                </p>
                                                {vencida && (
                                                    <p className="text-xs text-red-500">Vencida</p>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 font-medium text-slate-900 dark:text-white">
                                                {formatCurrency(cobranca.valor_total)}
                                            </td>
                                            <td className="px-4 py-4">
                                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                                                    isPago
                                                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                                        : vencida
                                                        ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                                        : isPendente
                                                        ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                                                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                                                }`}>
                                                    {isPago ? <CheckCircle size={12} /> : isPendente ? <Clock size={12} /> : <XCircle size={12} />}
                                                    {cobranca.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {isPendente && (
                                                        <>
                                                            <button
                                                                onClick={() => setCobrancaPagamento(cobranca)}
                                                                className="px-3 py-1 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
                                                            >
                                                                Pagar
                                                            </button>
                                                            <button
                                                                onClick={() => handleCancelar(cobranca)}
                                                                className="px-3 py-1 text-sm bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition"
                                                            >
                                                                Cancelar
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal Gerar Lote */}
            {modalGerarLote && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-md">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                Gerar Cobranças em Lote
                            </h2>
                            <button
                                onClick={() => setModalGerarLote(false)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-2xl"
                            >
                                ×
                            </button>
                        </div>
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                const formData = new FormData(e.currentTarget);
                                const usinaId = Number(formData.get('usina_id'));
                                const vencimento = formData.get('vencimento') as string;
                                if (usinaId && vencimento) {
                                    handleGerarLote(usinaId, vencimento);
                                }
                            }}
                            className="p-4 space-y-4"
                        >
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Usina
                                </label>
                                <select
                                    name="usina_id"
                                    required
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
                                >
                                    <option value="">Selecione...</option>
                                    {usinas.map(usina => (
                                        <option key={usina.id} value={usina.id}>{usina.nome}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Referência
                                </label>
                                <p className="text-slate-900 dark:text-white font-medium">
                                    {meses[mesFiltro - 1]} de {anoFiltro}
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Data de Vencimento
                                </label>
                                <input
                                    type="date"
                                    name="vencimento"
                                    required
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
                                />
                            </div>
                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                                <p className="text-sm text-blue-700 dark:text-blue-300">
                                    Serão geradas cobranças para todos os beneficiários ativos da usina selecionada, com base no percentual de rateio de cada um.
                                </p>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setModalGerarLote(false)}
                                    className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={gerandoLote}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50"
                                >
                                    {gerandoLote && <Loader2 size={18} className="animate-spin" />}
                                    Gerar Cobranças
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Registrar Pagamento */}
            {cobrancaPagamento && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-md">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                Registrar Pagamento
                            </h2>
                            <button
                                onClick={() => setCobrancaPagamento(null)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-2xl"
                            >
                                ×
                            </button>
                        </div>
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                const formData = new FormData(e.currentTarget);
                                const dataPagamento = formData.get('data_pagamento') as string;
                                const valorPago = Number(formData.get('valor_pago'));
                                handleRegistrarPagamento(cobrancaPagamento.id, dataPagamento, valorPago);
                            }}
                            className="p-4 space-y-4"
                        >
                            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4">
                                <p className="text-sm text-slate-500 dark:text-slate-400">Beneficiário</p>
                                <p className="font-medium text-slate-900 dark:text-white">
                                    {cobrancaPagamento.beneficiario?.nome || 'Beneficiário'}
                                </p>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Valor da Cobrança</p>
                                <p className="text-xl font-bold text-slate-900 dark:text-white">
                                    {formatCurrency(cobrancaPagamento.valor_total)}
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Data do Pagamento
                                </label>
                                <input
                                    type="date"
                                    name="data_pagamento"
                                    defaultValue={new Date().toISOString().split('T')[0]}
                                    required
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Valor Pago
                                </label>
                                <input
                                    type="number"
                                    name="valor_pago"
                                    step="0.01"
                                    defaultValue={cobrancaPagamento.valor_total}
                                    required
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setCobrancaPagamento(null)}
                                    className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={registrandoPagamento}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition disabled:opacity-50"
                                >
                                    {registrandoPagamento && <Loader2 size={18} className="animate-spin" />}
                                    Confirmar Pagamento
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default CobrancasGestor;
