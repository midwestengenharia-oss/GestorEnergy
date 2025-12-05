/**
 * FaturasUsuario - Página de faturas do Usuário
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { usePerfil } from '../../contexts/PerfilContext';
import { ucsApi } from '../../api/ucs';
import { faturasApi, FaturaPixResponse } from '../../api/faturas';
import type { UnidadeConsumidora, Fatura } from '../../api/types';
import {
    FileText,
    Search,
    Filter,
    Loader2,
    RefreshCw,
    AlertCircle,
    CheckCircle,
    Calendar,
    Download,
    Copy,
    X,
    ChevronLeft,
    ChevronRight,
    Zap,
    QrCode
} from 'lucide-react';

export function FaturasUsuario() {
    const { usuario } = useAuth();
    const { perfilAtivo } = usePerfil();
    const [ucs, setUcs] = useState<UnidadeConsumidora[]>([]);
    const [faturas, setFaturas] = useState<Fatura[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filtros
    const [filtroUC, setFiltroUC] = useState<number | null>(null);
    const [filtroStatus, setFiltroStatus] = useState<'todas' | 'pendentes' | 'pagas'>('todas');
    const [filtroAno, setFiltroAno] = useState<number>(new Date().getFullYear());
    const [busca, setBusca] = useState('');

    // Paginação
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const perPage = 10;

    // Modal de detalhes
    const [faturaDetalhe, setFaturaDetalhe] = useState<Fatura | null>(null);

    // Modal de PIX
    const [pixModal, setPixModal] = useState<{ fatura: Fatura; dados: FaturaPixResponse | null; loading: boolean } | null>(null);

    // Loading de download
    const [downloadingId, setDownloadingId] = useState<number | null>(null);

    // Anos disponíveis para filtro
    const anosDisponiveis = Array.from(
        { length: 5 },
        (_, i) => new Date().getFullYear() - i
    );

    useEffect(() => {
        fetchUCs();
    }, [perfilAtivo]);

    useEffect(() => {
        fetchFaturas();
    }, [filtroUC, filtroStatus, filtroAno, page, perfilAtivo]);

    const fetchUCs = async () => {
        try {
            // Filtrar UCs por titularidade baseado no perfil ativo
            const isTitular = perfilAtivo === 'usuario' ? true : perfilAtivo === 'gestor' ? false : undefined;
            const response = await ucsApi.minhas(isTitular);
            setUcs(response.data.ucs || []);

            // Reset filtro de UC quando mudar o perfil
            setFiltroUC(null);
        } catch (err: any) {
            console.error('Erro ao carregar UCs:', err);
        }
    };

    const fetchFaturas = async () => {
        try {
            setLoading(true);
            setError(null);

            // Filtrar faturas por titularidade baseado no perfil ativo
            const isTitular = perfilAtivo === 'usuario' ? true : perfilAtivo === 'gestor' ? false : undefined;

            const params: any = {
                page,
                limit: perPage,
                ano_referencia: filtroAno
            };

            // Adicionar filtro de titularidade
            if (isTitular !== undefined) {
                params.usuario_titular = isTitular;
            }

            if (filtroUC) {
                params.uc_id = filtroUC;
            }

            if (filtroStatus === 'pendentes') {
                params.situacao_pagamento = 'PENDENTE';
            } else if (filtroStatus === 'pagas') {
                params.situacao_pagamento = 'PAGA';
            }

            const response = await faturasApi.listar(params);
            setFaturas(response.data.faturas || []);
            setTotal(response.data.total || 0);
            setTotalPages(response.data.total_pages || 1);
        } catch (err: any) {
            console.error('Erro ao carregar faturas:', err);
            setError(err.response?.data?.detail || 'Erro ao carregar faturas');
        } finally {
            setLoading(false);
        }
    };

    // Formatar código da UC
    const formatarCodigoUC = (uc: UnidadeConsumidora) => {
        return `${uc.cod_empresa}/${uc.cdc}-${uc.digito_verificador}`;
    };

    // Formatar mês/ano
    const formatarReferencia = (fatura: Fatura) => {
        const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        return `${meses[fatura.mes_referencia - 1]}/${fatura.ano_referencia}`;
    };

    // Formatar referência completa
    const formatarReferenciaCompleta = (fatura: Fatura) => {
        const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                       'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        return `${meses[fatura.mes_referencia - 1]} de ${fatura.ano_referencia}`;
    };

    // Formatar data
    const formatarData = (data: string) => {
        return new Date(data).toLocaleDateString('pt-BR');
    };

    // Formatar valor
    const formatarValor = (valor: number) => {
        return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    // Verificar se é pendente
    const isPendente = (fatura: Fatura) => {
        return fatura.situacao_pagamento === 'PENDENTE' ||
               fatura.situacao_pagamento === 'EM_ABERTO' ||
               !fatura.indicador_pagamento;
    };

    // Copiar código de barras
    const copiarCodigoBarras = (codigo: string) => {
        navigator.clipboard.writeText(codigo);
        alert('Código de barras copiado!');
    };

    // Copiar PIX
    const copiarPix = (pix: string) => {
        navigator.clipboard.writeText(pix);
        alert('Código PIX copiado!');
    };

    // Baixar PDF da fatura
    const handleDownloadPdf = async (fatura: Fatura) => {
        try {
            setDownloadingId(fatura.id);
            const response = await faturasApi.buscarPdf(fatura.id);

            if (!response.data.disponivel || !response.data.pdf_base64) {
                alert('PDF não disponível para esta fatura. Sincronize as faturas para baixar o PDF.');
                return;
            }

            const link = document.createElement('a');
            link.href = `data:application/pdf;base64,${response.data.pdf_base64}`;
            link.download = `fatura_${response.data.mes_referencia.toString().padStart(2, '0')}_${response.data.ano_referencia}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err: any) {
            console.error('Erro ao baixar PDF:', err);
            alert('Erro ao baixar PDF da fatura');
        } finally {
            setDownloadingId(null);
        }
    };

    // Abrir modal PIX
    const handleOpenPix = async (fatura: Fatura) => {
        setPixModal({ fatura, dados: null, loading: true });
        try {
            const response = await faturasApi.buscarPix(fatura.id);
            setPixModal({ fatura, dados: response.data, loading: false });
        } catch (err: any) {
            console.error('Erro ao buscar PIX:', err);
            alert('Erro ao carregar dados de pagamento');
            setPixModal(null);
        }
    };

    // Filtrar faturas localmente por busca
    const faturasFiltradas = faturas.filter(fatura => {
        if (busca) {
            const termo = busca.toLowerCase();
            const referencia = formatarReferencia(fatura).toLowerCase();
            return referencia.includes(termo);
        }
        return true;
    });

    // Calcular resumo
    const resumo = {
        totalFaturas: total,
        totalPendentes: faturas.filter(isPendente).length,
        valorPendente: faturas.filter(isPendente).reduce((acc, f) => acc + (Number(f.valor_fatura) || 0), 0)
    };

    if (loading && faturas.length === 0) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
                    <p className="text-slate-500 dark:text-slate-400">Carregando faturas...</p>
                </div>
            </div>
        );
    }

    if (error && faturas.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
                    <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Erro ao carregar</h2>
                <p className="text-slate-500 dark:text-slate-400 mb-4">{error}</p>
                <button
                    onClick={fetchFaturas}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                >
                    <RefreshCw size={18} />
                    Tentar novamente
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                    Minhas Faturas
                </h1>
                <p className="text-slate-500 dark:text-slate-400">
                    Visualize e gerencie suas faturas de energia
                </p>
            </div>

            {/* Resumo */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                            <FileText className="text-blue-600 dark:text-blue-400" size={20} />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Total de Faturas</p>
                            <p className="text-xl font-bold text-slate-900 dark:text-white">{resumo.totalFaturas}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                            <AlertCircle className="text-orange-600 dark:text-orange-400" size={20} />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Pendentes</p>
                            <p className="text-xl font-bold text-slate-900 dark:text-white">{resumo.totalPendentes}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                            <Calendar className="text-red-600 dark:text-red-400" size={20} />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Valor Pendente</p>
                            <p className="text-xl font-bold text-slate-900 dark:text-white">{formatarValor(resumo.valorPendente)}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filtros */}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                <div className="flex flex-col lg:flex-row gap-4">
                    {/* Busca */}
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input
                            type="text"
                            placeholder="Buscar por referência..."
                            value={busca}
                            onChange={(e) => setBusca(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-900 dark:text-white"
                        />
                    </div>

                    {/* Filtro por UC */}
                    <select
                        value={filtroUC || ''}
                        onChange={(e) => {
                            setFiltroUC(e.target.value ? Number(e.target.value) : null);
                            setPage(1);
                        }}
                        className="px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-900 dark:text-white"
                    >
                        <option value="">Todas as UCs</option>
                        {ucs.map(uc => (
                            <option key={uc.id} value={uc.id}>
                                UC {formatarCodigoUC(uc)}{uc.apelido ? ` - ${uc.apelido}` : ''}
                            </option>
                        ))}
                    </select>

                    {/* Filtro por ano */}
                    <select
                        value={filtroAno}
                        onChange={(e) => {
                            setFiltroAno(Number(e.target.value));
                            setPage(1);
                        }}
                        className="px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-900 dark:text-white"
                    >
                        {anosDisponiveis.map(ano => (
                            <option key={ano} value={ano}>{ano}</option>
                        ))}
                    </select>

                    {/* Filtro por status */}
                    <div className="flex gap-2">
                        {(['todas', 'pendentes', 'pagas'] as const).map((status) => (
                            <button
                                key={status}
                                onClick={() => {
                                    setFiltroStatus(status);
                                    setPage(1);
                                }}
                                className={`px-4 py-2 rounded-lg transition whitespace-nowrap ${
                                    filtroStatus === status
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                                }`}
                            >
                                {status.charAt(0).toUpperCase() + status.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Lista de Faturas */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                {faturasFiltradas.length === 0 ? (
                    <div className="p-8 text-center">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                            <FileText className="w-8 h-8 text-slate-400" />
                        </div>
                        <p className="text-slate-500 dark:text-slate-400">
                            Nenhuma fatura encontrada
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Tabela para Desktop */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-50 dark:bg-slate-900">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                            Referência
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                            UC
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                            Vencimento
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                            Consumo
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                            Valor
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                            Status
                                        </th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                            Ações
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                    {faturasFiltradas.map((fatura) => {
                                        const pendente = isPendente(fatura);
                                        const uc = ucs.find(u => u.id === fatura.uc_id);
                                        return (
                                            <tr
                                                key={fatura.id}
                                                className={`hover:bg-slate-50 dark:hover:bg-slate-900 ${
                                                    pendente ? 'bg-orange-50/50 dark:bg-orange-900/10' : ''
                                                }`}
                                            >
                                                <td className="px-4 py-3">
                                                    <span className="font-medium text-slate-900 dark:text-white">
                                                        {formatarReferencia(fatura)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                                                    {uc ? formatarCodigoUC(uc) : `UC #${fatura.uc_id}`}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                                                    {formatarData(fatura.data_vencimento)}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                                                    {fatura.consumo ? `${fatura.consumo} kWh` : '-'}
                                                </td>
                                                <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                                                    {formatarValor(fatura.valor_fatura)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {pendente ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-xs rounded-full">
                                                            <AlertCircle size={12} />
                                                            Pendente
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-xs rounded-full">
                                                            <CheckCircle size={12} />
                                                            Paga
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        {/* Botão PIX - só para pendentes */}
                                                        {pendente && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleOpenPix(fatura);
                                                                }}
                                                                className="p-2 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition"
                                                                title="Ver PIX/Código de Barras"
                                                            >
                                                                <QrCode size={16} />
                                                            </button>
                                                        )}
                                                        {/* Botão Download PDF */}
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDownloadPdf(fatura);
                                                            }}
                                                            disabled={downloadingId === fatura.id}
                                                            className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition disabled:opacity-50"
                                                            title="Baixar PDF"
                                                        >
                                                            {downloadingId === fatura.id ? (
                                                                <Loader2 size={16} className="animate-spin" />
                                                            ) : (
                                                                <Download size={16} />
                                                            )}
                                                        </button>
                                                        <button
                                                            onClick={() => setFaturaDetalhe(fatura)}
                                                            className="text-blue-500 hover:text-blue-600 text-sm ml-1"
                                                        >
                                                            Detalhes
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Cards para Mobile */}
                        <div className="md:hidden divide-y divide-slate-200 dark:divide-slate-700">
                            {faturasFiltradas.map((fatura) => {
                                const pendente = isPendente(fatura);
                                const uc = ucs.find(u => u.id === fatura.uc_id);
                                return (
                                    <div
                                        key={fatura.id}
                                        className={`p-4 ${pendente ? 'bg-orange-50/50 dark:bg-orange-900/10' : ''}`}
                                        onClick={() => setFaturaDetalhe(fatura)}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="font-medium text-slate-900 dark:text-white">
                                                {formatarReferencia(fatura)}
                                            </span>
                                            {pendente ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-xs rounded-full">
                                                    <AlertCircle size={12} />
                                                    Pendente
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-xs rounded-full">
                                                    <CheckCircle size={12} />
                                                    Paga
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-sm text-slate-500 dark:text-slate-400 space-y-1">
                                            <p>UC: {uc ? formatarCodigoUC(uc) : `#${fatura.uc_id}`}</p>
                                            <p>Vencimento: {formatarData(fatura.data_vencimento)}</p>
                                        </div>
                                        <div className="mt-2 text-lg font-bold text-slate-900 dark:text-white">
                                            {formatarValor(fatura.valor_fatura)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Paginação */}
                        {totalPages > 1 && (
                            <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Mostrando {((page - 1) * perPage) + 1} a {Math.min(page * perPage, total)} de {total}
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page === 1}
                                        className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <ChevronLeft size={20} />
                                    </button>
                                    <button
                                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                        disabled={page === totalPages}
                                        className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <ChevronRight size={20} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Modal de Detalhes */}
            {faturaDetalhe && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-800">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                Detalhes da Fatura
                            </h2>
                            <button
                                onClick={() => setFaturaDetalhe(null)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-4 space-y-4">
                            {/* Referência e Status */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Referência</p>
                                    <p className="text-xl font-bold text-slate-900 dark:text-white">
                                        {formatarReferenciaCompleta(faturaDetalhe)}
                                    </p>
                                </div>
                                {isPendente(faturaDetalhe) ? (
                                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full">
                                        <AlertCircle size={16} />
                                        Pendente
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full">
                                        <CheckCircle size={16} />
                                        Paga
                                    </span>
                                )}
                            </div>

                            {/* Valor */}
                            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4">
                                <p className="text-sm text-slate-500 dark:text-slate-400">Valor da Fatura</p>
                                <p className="text-3xl font-bold text-slate-900 dark:text-white">
                                    {formatarValor(faturaDetalhe.valor_fatura)}
                                </p>
                            </div>

                            {/* Informações */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Vencimento</p>
                                    <p className="font-medium text-slate-900 dark:text-white">
                                        {formatarData(faturaDetalhe.data_vencimento)}
                                    </p>
                                </div>
                                {faturaDetalhe.data_leitura && (
                                    <div>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Data da Leitura</p>
                                        <p className="font-medium text-slate-900 dark:text-white">
                                            {formatarData(faturaDetalhe.data_leitura)}
                                        </p>
                                    </div>
                                )}
                                {faturaDetalhe.consumo && (
                                    <div>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Consumo</p>
                                        <p className="font-medium text-slate-900 dark:text-white">
                                            {faturaDetalhe.consumo} kWh
                                        </p>
                                    </div>
                                )}
                                {faturaDetalhe.quantidade_dias && (
                                    <div>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Dias</p>
                                        <p className="font-medium text-slate-900 dark:text-white">
                                            {faturaDetalhe.quantidade_dias} dias
                                        </p>
                                    </div>
                                )}
                                {faturaDetalhe.bandeira_tarifaria && (
                                    <div>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Bandeira</p>
                                        <p className="font-medium text-slate-900 dark:text-white">
                                            {faturaDetalhe.bandeira_tarifaria}
                                        </p>
                                    </div>
                                )}
                                {faturaDetalhe.leitura_atual && (
                                    <div>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Leitura Atual</p>
                                        <p className="font-medium text-slate-900 dark:text-white">
                                            {faturaDetalhe.leitura_atual}
                                        </p>
                                    </div>
                                )}
                                {faturaDetalhe.leitura_anterior && (
                                    <div>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Leitura Anterior</p>
                                        <p className="font-medium text-slate-900 dark:text-white">
                                            {faturaDetalhe.leitura_anterior}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Detalhes de valores */}
                            {(faturaDetalhe.valor_iluminacao_publica || faturaDetalhe.valor_icms) && (
                                <div className="border-t border-slate-200 dark:border-slate-700 pt-4 space-y-2">
                                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Detalhamento</p>
                                    {faturaDetalhe.valor_iluminacao_publica && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-600 dark:text-slate-300">Iluminação Pública</span>
                                            <span className="text-slate-900 dark:text-white">
                                                {formatarValor(faturaDetalhe.valor_iluminacao_publica)}
                                            </span>
                                        </div>
                                    )}
                                    {faturaDetalhe.valor_icms && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-600 dark:text-slate-300">ICMS</span>
                                            <span className="text-slate-900 dark:text-white">
                                                {formatarValor(faturaDetalhe.valor_icms)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Código de Barras e PIX */}
                            {isPendente(faturaDetalhe) && (
                                <div className="border-t border-slate-200 dark:border-slate-700 pt-4 space-y-4">
                                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Pagamento</p>

                                    {/* QR Code PIX - Imagem */}
                                    {faturaDetalhe.qr_code_pix_image && (
                                        <div className="flex flex-col items-center gap-3">
                                            <p className="text-sm text-slate-600 dark:text-slate-300">
                                                Escaneie o QR Code para pagar via PIX
                                            </p>
                                            <div className="bg-white p-3 rounded-lg shadow-sm">
                                                <img
                                                    src={`data:image/png;base64,${faturaDetalhe.qr_code_pix_image}`}
                                                    alt="QR Code PIX"
                                                    className="w-48 h-48"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* PIX Copia e Cola */}
                                    {faturaDetalhe.qr_code_pix && (
                                        <div className="space-y-2">
                                            <p className="text-sm text-slate-600 dark:text-slate-300">
                                                Ou copie o código PIX:
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={faturaDetalhe.qr_code_pix}
                                                    readOnly
                                                    className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white truncate"
                                                />
                                                <button
                                                    onClick={() => copiarPix(faturaDetalhe.qr_code_pix!)}
                                                    className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition whitespace-nowrap"
                                                >
                                                    <Copy size={16} />
                                                    Copiar
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Código de Barras */}
                                    {faturaDetalhe.codigo_barras && (
                                        <div className="space-y-2">
                                            <p className="text-sm text-slate-600 dark:text-slate-300">
                                                Código de Barras:
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={faturaDetalhe.codigo_barras}
                                                    readOnly
                                                    className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                                                />
                                                <button
                                                    onClick={() => copiarCodigoBarras(faturaDetalhe.codigo_barras!)}
                                                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition whitespace-nowrap"
                                                >
                                                    <Copy size={16} />
                                                    Copiar
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Ações */}
                            <div className="border-t border-slate-200 dark:border-slate-700 pt-4 space-y-3">
                                {/* PIX - só para pendentes */}
                                {isPendente(faturaDetalhe) && (
                                    <button
                                        onClick={() => {
                                            setFaturaDetalhe(null);
                                            handleOpenPix(faturaDetalhe);
                                        }}
                                        className="flex items-center justify-center gap-2 w-full py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
                                    >
                                        <QrCode size={18} />
                                        Ver PIX / Código de Barras
                                    </button>
                                )}

                                {/* PDF */}
                                <button
                                    onClick={() => handleDownloadPdf(faturaDetalhe)}
                                    disabled={downloadingId === faturaDetalhe.id}
                                    className="flex items-center justify-center gap-2 w-full py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50"
                                >
                                    {downloadingId === faturaDetalhe.id ? (
                                        <Loader2 size={18} className="animate-spin" />
                                    ) : (
                                        <Download size={18} />
                                    )}
                                    Baixar PDF da Fatura
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de PIX */}
            {pixModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-md">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                Pagamento - {formatarReferencia(pixModal.fatura)}
                            </h2>
                            <button
                                onClick={() => setPixModal(null)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-4">
                            {pixModal.loading ? (
                                <div className="flex flex-col items-center py-8">
                                    <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
                                    <p className="text-slate-500 dark:text-slate-400">Carregando dados de pagamento...</p>
                                </div>
                            ) : pixModal.dados ? (
                                <div className="space-y-4">
                                    {/* Valor */}
                                    <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 text-center">
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Valor a pagar</p>
                                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                            {formatarValor(pixModal.fatura.valor_fatura)}
                                        </p>
                                    </div>

                                    {/* QR Code PIX */}
                                    {pixModal.dados.qr_code_pix_image && (
                                        <div className="flex flex-col items-center gap-3">
                                            <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">
                                                Escaneie o QR Code para pagar via PIX
                                            </p>
                                            <div className="bg-white p-3 rounded-lg shadow-sm border">
                                                <img
                                                    src={`data:image/png;base64,${pixModal.dados.qr_code_pix_image}`}
                                                    alt="QR Code PIX"
                                                    className="w-48 h-48"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* PIX Copia e Cola */}
                                    {pixModal.dados.qr_code_pix && (
                                        <div className="space-y-2">
                                            <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">
                                                PIX Copia e Cola:
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={pixModal.dados.qr_code_pix}
                                                    readOnly
                                                    className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white truncate"
                                                />
                                                <button
                                                    onClick={() => copiarPix(pixModal.dados!.qr_code_pix!)}
                                                    className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition whitespace-nowrap"
                                                >
                                                    <Copy size={16} />
                                                    Copiar
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Código de Barras */}
                                    {pixModal.dados.codigo_barras && (
                                        <div className="space-y-2">
                                            <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">
                                                Código de Barras:
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={pixModal.dados.codigo_barras}
                                                    readOnly
                                                    className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                                                />
                                                <button
                                                    onClick={() => copiarCodigoBarras(pixModal.dados!.codigo_barras!)}
                                                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition whitespace-nowrap"
                                                >
                                                    <Copy size={16} />
                                                    Copiar
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Sem dados disponíveis */}
                                    {!pixModal.dados.pix_disponivel && !pixModal.dados.codigo_barras && (
                                        <div className="text-center py-4">
                                            <AlertCircle className="w-12 h-12 text-orange-400 mx-auto mb-3" />
                                            <p className="text-slate-500 dark:text-slate-400">
                                                Dados de pagamento não disponíveis para esta fatura.
                                            </p>
                                            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                                                Sincronize as faturas para atualizar os dados.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-4">
                                    <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
                                    <p className="text-slate-500 dark:text-slate-400">
                                        Erro ao carregar dados de pagamento.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default FaturasUsuario;
