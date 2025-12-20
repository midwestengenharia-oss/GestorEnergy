/**
 * CobrancasGestor - Gestão de Cobranças do Gestor
 */

import React, { useState, useEffect } from 'react';
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
    Clock,
    ChevronDown,
    ChevronRight,
    Edit3,
    Save,
    Eye,
    X,
    MoreVertical,
    FileInput
} from 'lucide-react';

export function CobrancasGestor() {
    const [searchParams, setSearchParams] = useSearchParams();
    const usinaIdParam = searchParams.get('usina');
    const cobrancaIdParam = searchParams.get('cobranca');

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

    // Modal Baixa Manual (pagamento fora do PIX)
    const [cobrancaBaixaManual, setCobrancaBaixaManual] = useState<Cobranca | null>(null);
    const [registrandoBaixaManual, setRegistrandoBaixaManual] = useState(false);

    // Menu de acoes secundarias
    const [menuAbertoId, setMenuAbertoId] = useState<number | null>(null);

    // Expansão e Edição
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [editandoId, setEditandoId] = useState<number | null>(null);
    const [camposEditados, setCamposEditados] = useState<Record<string, any>>({});
    const [salvandoEdicao, setSalvandoEdicao] = useState(false);
    const [previewHtml, setPreviewHtml] = useState<string | null>(null);

    useEffect(() => {
        fetchUsinas();
    }, []);

    useEffect(() => {
        fetchCobrancas();
    }, [usinaFiltro, statusFiltro, mesFiltro, anoFiltro, page]);

    // Expandir cobranca automaticamente se o parametro estiver presente na URL
    useEffect(() => {
        if (cobrancaIdParam && cobrancas.length > 0) {
            const id = Number(cobrancaIdParam);
            const cobrancaEncontrada = cobrancas.find(c => c.id === id);
            if (cobrancaEncontrada) {
                setExpandedId(id);
            }
        }
    }, [cobrancaIdParam, cobrancas]);

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

    const handleBaixaManual = async (cobrancaId: number, dataPagamento: string, valorPago: number) => {
        try {
            setRegistrandoBaixaManual(true);
            await cobrancasApi.registrarPagamento(cobrancaId, dataPagamento, valorPago);
            setCobrancaBaixaManual(null);
            setMenuAbertoId(null);
            fetchCobrancas();
            alert('Baixa manual registrada com sucesso!');
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Erro ao registrar baixa manual');
        } finally {
            setRegistrandoBaixaManual(false);
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

    // Toggle expansão da linha
    const toggleExpand = (cobrancaId: number) => {
        if (expandedId === cobrancaId) {
            setExpandedId(null);
            setEditandoId(null);
            setCamposEditados({});
        } else {
            setExpandedId(cobrancaId);
            setEditandoId(null);
            setCamposEditados({});
        }
    };

    // Iniciar edição
    const iniciarEdicao = (cobranca: Cobranca) => {
        setEditandoId(cobranca.id);
        setCamposEditados({
            taxa_minima_valor: cobranca.taxa_minima_valor || 0,
            energia_excedente_valor: cobranca.energia_excedente_valor || 0,
            disponibilidade_valor: cobranca.disponibilidade_valor || 0,
            bandeiras_valor: cobranca.bandeiras_valor || 0,
            iluminacao_publica_valor: cobranca.iluminacao_publica_valor || 0,
            servicos_valor: cobranca.servicos_valor || 0,
            vencimento: cobranca.data_vencimento,
            observacoes_internas: cobranca.observacoes_internas || ''
        });
    };

    // Cancelar edição
    const cancelarEdicao = () => {
        setEditandoId(null);
        setCamposEditados({});
    };

    // Salvar edição
    const salvarEdicao = async (cobrancaId: number) => {
        try {
            setSalvandoEdicao(true);
            await cobrancasApi.editarCampos(cobrancaId, camposEditados);
            setEditandoId(null);
            setCamposEditados({});
            fetchCobrancas();
            alert('Alterações salvas com sucesso!');
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Erro ao salvar alterações');
        } finally {
            setSalvandoEdicao(false);
        }
    };

    // Ver preview do relatório
    const verPreview = async (cobrancaId: number) => {
        try {
            const response = await cobrancasApi.obterRelatorioHTML(cobrancaId);
            setPreviewHtml(response.data);
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Erro ao carregar relatório');
        }
    };

    // Atualizar campo editado
    const atualizarCampo = (campo: string, valor: any) => {
        setCamposEditados(prev => ({ ...prev, [campo]: valor }));
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
        pagas: cobrancas.filter(c => c.status === 'PAGA' || c.status === 'paga').length,
        valorPendente: cobrancas.filter(c => c.status === 'PENDENTE' || c.status === 'pendente').reduce((acc, c) => acc + (c.valor_total || 0), 0),
        valorRecebido: cobrancas.filter(c => c.status === 'PAGA' || c.status === 'paga').reduce((acc, c) => acc + (c.valor_total || 0), 0)
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
                        <option value="PAGA">Pagas</option>
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
                                    const vencida = cobranca.status === 'VENCIDA' || cobranca.status === 'vencida' ||
                                                   (new Date(cobranca.data_vencimento) < new Date() &&
                                                   (cobranca.status === 'PENDENTE' || cobranca.status === 'pendente'));
                                    const isPago = cobranca.status === 'PAGA' || cobranca.status === 'paga';
                                    const isPendente = cobranca.status === 'PENDENTE' || cobranca.status === 'pendente';
                                    const isCancelada = cobranca.status === 'CANCELADA' || cobranca.status === 'cancelada';
                                    const isEmitida = cobranca.status === 'EMITIDA' || cobranca.status === 'emitida';
                                    const isParcial = cobranca.status === 'PARCIAL' || cobranca.status === 'parcial';
                                    const isExpanded = expandedId === cobranca.id;
                                    const isEditing = editandoId === cobranca.id;
                                    // Pode editar se nao estiver PAGA ou CANCELADA
                                    const podeEditar = isPendente || isEmitida || isParcial;

                                    return (
                                        <React.Fragment key={cobranca.id}>
                                        <tr
                                            className={`hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer ${isExpanded ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                                            onClick={() => toggleExpand(cobranca.id)}
                                        >
                                            <td className="px-4 py-4">
                                                <div className="flex items-center gap-3">
                                                    <button className="text-slate-400 hover:text-slate-600">
                                                        {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                                    </button>
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
                                                        : isPendente || isEmitida
                                                        ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                                                        : isParcial
                                                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                                                }`}>
                                                    {isPago ? <CheckCircle size={12} /> : (isPendente || isEmitida || isParcial) ? <Clock size={12} /> : <XCircle size={12} />}
                                                    {cobranca.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center justify-end gap-2">
                                                    {(isPendente || isEmitida) && (
                                                        <>
                                                            <button
                                                                onClick={() => handleCancelar(cobranca)}
                                                                className="px-3 py-1 text-sm bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition"
                                                            >
                                                                Cancelar
                                                            </button>
                                                            {/* Menu de acoes secundarias */}
                                                            <div className="relative">
                                                                <button
                                                                    onClick={() => setMenuAbertoId(menuAbertoId === cobranca.id ? null : cobranca.id)}
                                                                    className="p-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
                                                                >
                                                                    <MoreVertical size={18} />
                                                                </button>
                                                                {menuAbertoId === cobranca.id && (
                                                                    <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-1 z-10">
                                                                        <button
                                                                            onClick={() => {
                                                                                setCobrancaBaixaManual(cobranca);
                                                                                setMenuAbertoId(null);
                                                                            }}
                                                                            className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                                                                        >
                                                                            <FileInput size={16} />
                                                                            Baixa Manual
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>

                                        {/* Conteúdo Expandido */}
                                        {isExpanded && (
                                            <tr>
                                                <td colSpan={6} className="bg-slate-50 dark:bg-slate-900 p-6">
                                                    <div className="space-y-6">
                                                        {/* Header com ações */}
                                                        <div className="flex items-center justify-between">
                                                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                                                                Detalhes da Cobrança
                                                            </h3>
                                                            <div className="flex gap-2">
                                                                <button
                                                                    onClick={() => verPreview(cobranca.id)}
                                                                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600"
                                                                >
                                                                    <Eye size={16} /> Preview
                                                                </button>
                                                                {podeEditar && !isEditing && (
                                                                    <button
                                                                        onClick={() => iniciarEdicao(cobranca)}
                                                                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                                                                    >
                                                                        <Edit3 size={16} /> Editar
                                                                    </button>
                                                                )}
                                                                {isEditing && (
                                                                    <>
                                                                        <button
                                                                            onClick={cancelarEdicao}
                                                                            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600"
                                                                        >
                                                                            <X size={16} /> Cancelar
                                                                        </button>
                                                                        <button
                                                                            onClick={() => salvarEdicao(cobranca.id)}
                                                                            disabled={salvandoEdicao}
                                                                            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
                                                                        >
                                                                            {salvandoEdicao ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                                                            Salvar
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                            {/* Seção 1: Dados do Beneficiário */}
                                                            <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                                                <h4 className="font-medium text-slate-900 dark:text-white mb-3">Beneficiário</h4>
                                                                <div className="space-y-2 text-sm">
                                                                    <p><span className="text-slate-500">Nome:</span> <span className="text-slate-900 dark:text-white">{cobranca.beneficiario?.nome || '-'}</span></p>
                                                                    <p><span className="text-slate-500">CPF:</span> <span className="text-slate-900 dark:text-white">{cobranca.beneficiario?.cpf || '-'}</span></p>
                                                                    <p><span className="text-slate-500">Email:</span> <span className="text-slate-900 dark:text-white">{cobranca.beneficiario?.email || '-'}</span></p>
                                                                    <p><span className="text-slate-500">Modelo GD:</span> <span className="text-slate-900 dark:text-white">{cobranca.modelo_gd || '-'}</span></p>
                                                                    <p><span className="text-slate-500">Tipo Ligação:</span> <span className="text-slate-900 dark:text-white">{cobranca.tipo_ligacao || '-'}</span></p>
                                                                </div>
                                                            </div>

                                                            {/* Seção 2: Métricas de Energia */}
                                                            <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                                                <h4 className="font-medium text-slate-900 dark:text-white mb-3">Métricas de Energia</h4>
                                                                <div className="space-y-2 text-sm">
                                                                    <p><span className="text-slate-500">Consumo:</span> <span className="text-slate-900 dark:text-white">{cobranca.consumo_kwh || 0} kWh</span></p>
                                                                    <p><span className="text-slate-500">Injetada:</span> <span className="text-slate-900 dark:text-white">{cobranca.injetada_kwh || 0} kWh</span></p>
                                                                    <p><span className="text-slate-500">Compensada:</span> <span className="text-slate-900 dark:text-white">{cobranca.compensado_kwh || 0} kWh</span></p>
                                                                    <p><span className="text-slate-500">Gap:</span> <span className="text-slate-900 dark:text-white">{cobranca.gap_kwh || 0} kWh</span></p>
                                                                    <p><span className="text-slate-500">Tarifa Base:</span> <span className="text-slate-900 dark:text-white">R$ {Number(cobranca.tarifa_base || 0).toFixed(6)}/kWh</span></p>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Seção 3: Valores da Cobrança (Editáveis) */}
                                                        <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                                            <h4 className="font-medium text-slate-900 dark:text-white mb-4">Valores da Cobrança</h4>
                                                            <div className="overflow-x-auto">
                                                                <table className="w-full text-sm">
                                                                    <thead>
                                                                        <tr className="border-b border-slate-200 dark:border-slate-700">
                                                                            <th className="text-left py-2 text-slate-500">Item</th>
                                                                            <th className="text-right py-2 text-slate-500">Valor</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                                                        <tr>
                                                                            <td className="py-2 text-slate-900 dark:text-white">Energia Compensada (30% desc.)</td>
                                                                            <td className="py-2 text-right text-green-600 font-medium">{formatCurrency(cobranca.energia_compensada_com_desconto || cobranca.energia_compensada_valor || 0)}</td>
                                                                        </tr>
                                                                        {(cobranca.modelo_gd === 'GDI' || !cobranca.modelo_gd) && (
                                                                            <>
                                                                                <tr>
                                                                                    <td className="py-2 text-slate-900 dark:text-white flex items-center gap-2">
                                                                                        Taxa Mínima ({cobranca.taxa_minima_kwh || 0} kWh)
                                                                                        {podeEditar && <Edit3 size={12} className="text-blue-500" />}
                                                                                    </td>
                                                                                    <td className="py-2 text-right">
                                                                                        {isEditing ? (
                                                                                            <input
                                                                                                type="number"
                                                                                                step="0.01"
                                                                                                value={camposEditados.taxa_minima_valor || 0}
                                                                                                onChange={(e) => atualizarCampo('taxa_minima_valor', parseFloat(e.target.value))}
                                                                                                className="w-24 px-2 py-1 text-right border rounded dark:bg-slate-900 dark:border-slate-600"
                                                                                            />
                                                                                        ) : (
                                                                                            <span className="text-slate-900 dark:text-white">{formatCurrency(cobranca.taxa_minima_valor || 0)}</span>
                                                                                        )}
                                                                                    </td>
                                                                                </tr>
                                                                                <tr>
                                                                                    <td className="py-2 text-slate-900 dark:text-white flex items-center gap-2">
                                                                                        Energia Excedente
                                                                                        {podeEditar && <Edit3 size={12} className="text-blue-500" />}
                                                                                    </td>
                                                                                    <td className="py-2 text-right">
                                                                                        {isEditing ? (
                                                                                            <input
                                                                                                type="number"
                                                                                                step="0.01"
                                                                                                value={camposEditados.energia_excedente_valor || 0}
                                                                                                onChange={(e) => atualizarCampo('energia_excedente_valor', parseFloat(e.target.value))}
                                                                                                className="w-24 px-2 py-1 text-right border rounded dark:bg-slate-900 dark:border-slate-600"
                                                                                            />
                                                                                        ) : (
                                                                                            <span className="text-slate-900 dark:text-white">{formatCurrency(cobranca.energia_excedente_valor || 0)}</span>
                                                                                        )}
                                                                                    </td>
                                                                                </tr>
                                                                            </>
                                                                        )}
                                                                        {cobranca.modelo_gd === 'GDII' && (
                                                                            <tr>
                                                                                <td className="py-2 text-slate-900 dark:text-white flex items-center gap-2">
                                                                                    Disponibilidade (Lei 14.300)
                                                                                    {podeEditar && <Edit3 size={12} className="text-blue-500" />}
                                                                                </td>
                                                                                <td className="py-2 text-right">
                                                                                    {isEditing ? (
                                                                                        <input
                                                                                            type="number"
                                                                                            step="0.01"
                                                                                            value={camposEditados.disponibilidade_valor || 0}
                                                                                            onChange={(e) => atualizarCampo('disponibilidade_valor', parseFloat(e.target.value))}
                                                                                            className="w-24 px-2 py-1 text-right border rounded dark:bg-slate-900 dark:border-slate-600"
                                                                                        />
                                                                                    ) : (
                                                                                        <span className="text-slate-900 dark:text-white">{formatCurrency(cobranca.disponibilidade_valor || 0)}</span>
                                                                                    )}
                                                                                </td>
                                                                            </tr>
                                                                        )}
                                                                        <tr>
                                                                            <td className="py-2 text-slate-900 dark:text-white flex items-center gap-2">
                                                                                Bandeiras Tarifárias
                                                                                {podeEditar && <Edit3 size={12} className="text-blue-500" />}
                                                                            </td>
                                                                            <td className="py-2 text-right">
                                                                                {isEditing ? (
                                                                                    <input
                                                                                        type="number"
                                                                                        step="0.01"
                                                                                        value={camposEditados.bandeiras_valor || 0}
                                                                                        onChange={(e) => atualizarCampo('bandeiras_valor', parseFloat(e.target.value))}
                                                                                        className="w-24 px-2 py-1 text-right border rounded dark:bg-slate-900 dark:border-slate-600"
                                                                                    />
                                                                                ) : (
                                                                                    <span className="text-slate-900 dark:text-white">{formatCurrency(cobranca.bandeiras_valor || 0)}</span>
                                                                                )}
                                                                            </td>
                                                                        </tr>
                                                                        <tr>
                                                                            <td className="py-2 text-slate-900 dark:text-white flex items-center gap-2">
                                                                                Iluminação Pública
                                                                                {podeEditar && <Edit3 size={12} className="text-blue-500" />}
                                                                            </td>
                                                                            <td className="py-2 text-right">
                                                                                {isEditing ? (
                                                                                    <input
                                                                                        type="number"
                                                                                        step="0.01"
                                                                                        value={camposEditados.iluminacao_publica_valor || 0}
                                                                                        onChange={(e) => atualizarCampo('iluminacao_publica_valor', parseFloat(e.target.value))}
                                                                                        className="w-24 px-2 py-1 text-right border rounded dark:bg-slate-900 dark:border-slate-600"
                                                                                    />
                                                                                ) : (
                                                                                    <span className="text-slate-900 dark:text-white">{formatCurrency(cobranca.iluminacao_publica_valor || 0)}</span>
                                                                                )}
                                                                            </td>
                                                                        </tr>
                                                                        <tr>
                                                                            <td className="py-2 text-slate-900 dark:text-white flex items-center gap-2">
                                                                                Serviços
                                                                                {podeEditar && <Edit3 size={12} className="text-blue-500" />}
                                                                            </td>
                                                                            <td className="py-2 text-right">
                                                                                {isEditing ? (
                                                                                    <input
                                                                                        type="number"
                                                                                        step="0.01"
                                                                                        value={camposEditados.servicos_valor || 0}
                                                                                        onChange={(e) => atualizarCampo('servicos_valor', parseFloat(e.target.value))}
                                                                                        className="w-24 px-2 py-1 text-right border rounded dark:bg-slate-900 dark:border-slate-600"
                                                                                    />
                                                                                ) : (
                                                                                    <span className="text-slate-900 dark:text-white">{formatCurrency(cobranca.servicos_valor || 0)}</span>
                                                                                )}
                                                                            </td>
                                                                        </tr>
                                                                        <tr className="border-t-2 border-slate-300 dark:border-slate-600">
                                                                            <td className="py-2 font-bold text-slate-900 dark:text-white">TOTAL</td>
                                                                            <td className="py-2 text-right font-bold text-lg text-slate-900 dark:text-white">{formatCurrency(cobranca.valor_total)}</td>
                                                                        </tr>
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                            {/* Seção 4: Economia */}
                                                            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
                                                                <h4 className="font-medium text-green-800 dark:text-green-400 mb-3">Economia</h4>
                                                                <div className="space-y-2 text-sm">
                                                                    <p><span className="text-green-700 dark:text-green-500">Economia do Mês:</span> <span className="text-green-800 dark:text-green-400 font-bold text-lg">{formatCurrency(cobranca.economia_mes || 0)}</span></p>
                                                                    <p><span className="text-green-700 dark:text-green-500">Economia Acumulada:</span> <span className="text-green-800 dark:text-green-400">{formatCurrency(cobranca.economia_acumulada || 0)}</span></p>
                                                                </div>
                                                            </div>

                                                            {/* Seção 5: Vencimento e Observações */}
                                                            <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                                                <h4 className="font-medium text-slate-900 dark:text-white mb-3">Vencimento e Observações</h4>
                                                                <div className="space-y-3 text-sm">
                                                                    <div>
                                                                        <span className="text-slate-500">Vencimento:</span>
                                                                        {isEditing ? (
                                                                            <input
                                                                                type="date"
                                                                                value={camposEditados.vencimento || ''}
                                                                                onChange={(e) => atualizarCampo('vencimento', e.target.value)}
                                                                                className="ml-2 px-2 py-1 border rounded dark:bg-slate-900 dark:border-slate-600"
                                                                            />
                                                                        ) : (
                                                                            <span className="ml-2 text-slate-900 dark:text-white">{new Date(cobranca.data_vencimento).toLocaleDateString('pt-BR')}</span>
                                                                        )}
                                                                    </div>
                                                                    <div>
                                                                        <span className="text-slate-500">Observações:</span>
                                                                        {isEditing ? (
                                                                            <textarea
                                                                                value={camposEditados.observacoes_internas || ''}
                                                                                onChange={(e) => atualizarCampo('observacoes_internas', e.target.value)}
                                                                                placeholder="Observações internas..."
                                                                                className="w-full mt-1 px-2 py-1 border rounded dark:bg-slate-900 dark:border-slate-600 text-sm"
                                                                                rows={2}
                                                                            />
                                                                        ) : (
                                                                            <p className="text-slate-900 dark:text-white mt-1">{cobranca.observacoes_internas || 'Nenhuma observação'}</p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                        </React.Fragment>
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

            {/* Modal Baixa Manual */}
            {cobrancaBaixaManual && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-md">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                <FileInput size={20} />
                                Baixa Manual
                            </h2>
                            <button
                                onClick={() => setCobrancaBaixaManual(null)}
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
                                handleBaixaManual(cobrancaBaixaManual.id, dataPagamento, valorPago);
                            }}
                            className="p-4 space-y-4"
                        >
                            {/* Aviso explicativo */}
                            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                                <p className="text-sm text-amber-800 dark:text-amber-200">
                                    <strong>Atencao:</strong> Use esta opcao apenas para pagamentos realizados fora do PIX
                                    (transferencia bancaria, dinheiro, etc). Pagamentos via PIX sao detectados automaticamente.
                                </p>
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4">
                                <p className="text-sm text-slate-500 dark:text-slate-400">Beneficiario</p>
                                <p className="font-medium text-slate-900 dark:text-white">
                                    {cobrancaBaixaManual.beneficiario?.nome || 'Beneficiario'}
                                </p>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Valor da Cobranca</p>
                                <p className="text-xl font-bold text-slate-900 dark:text-white">
                                    {formatCurrency(cobrancaBaixaManual.valor_total)}
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
                                    defaultValue={cobrancaBaixaManual.valor_total}
                                    required
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setCobrancaBaixaManual(null)}
                                    className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={registrandoBaixaManual}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition disabled:opacity-50"
                                >
                                    {registrandoBaixaManual && <Loader2 size={18} className="animate-spin" />}
                                    Confirmar Baixa
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Preview HTML */}
            {previewHtml && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                Preview do Relatório
                            </h2>
                            <button
                                onClick={() => setPreviewHtml(null)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-2xl"
                            >
                                ×
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-4">
                            <iframe
                                srcDoc={previewHtml}
                                className="w-full h-full min-h-[600px] border rounded-lg"
                                title="Preview do Relatório"
                            />
                        </div>
                        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2 shrink-0">
                            <button
                                onClick={() => {
                                    const blob = new Blob([previewHtml], { type: 'text/html' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = 'relatorio-cobranca.html';
                                    a.click();
                                    URL.revokeObjectURL(url);
                                }}
                                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                            >
                                Baixar HTML
                            </button>
                            <button
                                onClick={() => setPreviewHtml(null)}
                                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default CobrancasGestor;
