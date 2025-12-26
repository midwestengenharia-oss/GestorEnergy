/**
 * FaturasGestor - Página de faturas para o Gestor
 * Mostra faturas das UCs vinculadas às usinas que o gestor gerencia
 */

import { useState, useEffect } from 'react';
import { usinasApi } from '../../api/usinas';
import { faturasApi, FaturaGestao, GestaoFaturasResponse } from '../../api/faturas';
import type { Usina } from '../../api/types';
import {
    FileText,
    Search,
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
    QrCode,
    Building2,
    User,
    Filter,
    Eye
} from 'lucide-react';

export function FaturasGestor() {
    const [usinas, setUsinas] = useState<Usina[]>([]);
    const [faturas, setFaturas] = useState<FaturaGestao[]>([]);
    const [totais, setTotais] = useState<GestaoFaturasResponse['totais'] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filtros
    const [filtroUsina, setFiltroUsina] = useState<number | null>(null);
    const [filtroStatus, setFiltroStatus] = useState<'todas' | 'pendentes' | 'pagas'>('todas');
    const [filtroAno, setFiltroAno] = useState<number>(new Date().getFullYear());
    const [filtroMes, setFiltroMes] = useState<number | null>(null);
    const [busca, setBusca] = useState('');

    // Modal de detalhes
    const [faturaDetalhe, setFaturaDetalhe] = useState<FaturaGestao | null>(null);

    // Loading de download
    const [downloadingId, setDownloadingId] = useState<number | null>(null);

    // Anos disponíveis para filtro
    const anosDisponiveis = Array.from(
        { length: 5 },
        (_, i) => new Date().getFullYear() - i
    );

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
        { value: 12, label: 'Dezembro' },
    ];

    useEffect(() => {
        fetchUsinas();
    }, []);

    useEffect(() => {
        fetchFaturas();
    }, [filtroUsina, filtroAno, filtroMes, filtroStatus]);

    const fetchUsinas = async () => {
        try {
            const response = await usinasApi.minhas();
            setUsinas(response.data || []);
        } catch (err: any) {
            console.error('Erro ao carregar usinas:', err);
        }
    };

    const fetchFaturas = async () => {
        try {
            setLoading(true);
            setError(null);

            // Mapear status para o filtro do backend
            let statusFluxo: string | undefined;
            if (filtroStatus === 'pendentes') {
                statusFluxo = 'AGUARDANDO_PDF,PDF_RECEBIDO,EXTRAIDA,COBRANCA_RASCUNHO,COBRANCA_EMITIDA';
            } else if (filtroStatus === 'pagas') {
                statusFluxo = 'COBRANCA_PAGA,FATURA_QUITADA';
            }

            const response = await faturasApi.gestao({
                usina_id: filtroUsina || undefined,
                ano_referencia: filtroAno,
                mes_referencia: filtroMes || undefined,
                status_fluxo: statusFluxo,
                busca: busca || undefined
            });

            setFaturas(response.data.faturas || []);
            setTotais(response.data.totais || null);
        } catch (err: any) {
            console.error('Erro ao carregar faturas:', err);
            setError(err.response?.data?.detail || 'Erro ao carregar faturas');
        } finally {
            setLoading(false);
        }
    };

    // Formatar mês/ano
    const formatarReferencia = (fatura: FaturaGestao) => {
        const mesesAbrev = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        return `${mesesAbrev[fatura.mes_referencia - 1]}/${fatura.ano_referencia}`;
    };

    // Formatar referência completa
    const formatarReferenciaCompleta = (fatura: FaturaGestao) => {
        const mesesNome = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                          'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        return `${mesesNome[fatura.mes_referencia - 1]} de ${fatura.ano_referencia}`;
    };

    // Formatar data
    const formatarData = (data: string | undefined) => {
        if (!data) return '-';
        return new Date(data).toLocaleDateString('pt-BR');
    };

    // Formatar valor
    const formatarValor = (valor: number | undefined) => {
        if (valor === undefined || valor === null) return '-';
        return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    // Verificar se é pendente
    const isPendente = (fatura: FaturaGestao) => {
        return !['COBRANCA_PAGA', 'FATURA_QUITADA'].includes(fatura.status_fluxo);
    };

    // Status badge
    const getStatusBadge = (status: string) => {
        const statusMap: Record<string, { label: string; color: string }> = {
            'AGUARDANDO_PDF': { label: 'Aguardando PDF', color: 'bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400' },
            'PDF_RECEBIDO': { label: 'PDF Recebido', color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
            'EXTRAIDA': { label: 'Extraída', color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' },
            'COBRANCA_RASCUNHO': { label: 'Rascunho', color: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400' },
            'COBRANCA_EMITIDA': { label: 'Emitida', color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' },
            'COBRANCA_PAGA': { label: 'Paga', color: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' },
            'FATURA_QUITADA': { label: 'Quitada', color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' },
        };
        const config = statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-600' };
        return (
            <span className={`inline-flex items-center px-2 py-1 text-xs rounded-full ${config.color}`}>
                {config.label}
            </span>
        );
    };

    // Copiar PIX
    const copiarPix = (pix: string) => {
        navigator.clipboard.writeText(pix);
        alert('Código PIX copiado!');
    };

    // Baixar PDF da fatura
    const handleDownloadPdf = async (fatura: FaturaGestao) => {
        try {
            setDownloadingId(fatura.id);
            const response = await faturasApi.buscarPdf(fatura.id);

            if (!response.data.disponivel || !response.data.pdf_base64) {
                alert('PDF não disponível para esta fatura.');
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

    // Filtrar faturas localmente por busca
    const faturasFiltradas = faturas.filter(fatura => {
        if (busca) {
            const termo = busca.toLowerCase();
            const referencia = formatarReferencia(fatura).toLowerCase();
            const beneficiario = fatura.beneficiario?.nome?.toLowerCase() || '';
            const uc = fatura.uc_formatada?.toLowerCase() || '';
            return referencia.includes(termo) || beneficiario.includes(termo) || uc.includes(termo);
        }
        return true;
    });

    // Calcular resumo
    const resumo = {
        totalFaturas: faturas.length,
        totalPendentes: faturas.filter(isPendente).length,
        valorTotal: faturas.reduce((acc, f) => acc + (f.valor_fatura || 0), 0),
        valorPendente: faturas.filter(isPendente).reduce((acc, f) => acc + (f.valor_fatura || 0), 0)
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
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        Faturas
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        Faturas das usinas sob sua gestão
                    </p>
                </div>
                <button
                    onClick={fetchFaturas}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50"
                >
                    <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    Atualizar
                </button>
            </div>

            {/* Resumo */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                        <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                            <Zap className="text-green-600 dark:text-green-400" size={20} />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Valor Total</p>
                            <p className="text-xl font-bold text-slate-900 dark:text-white">{formatarValor(resumo.valorTotal)}</p>
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
                            placeholder="Buscar por beneficiário, UC ou referência..."
                            value={busca}
                            onChange={(e) => setBusca(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-900 dark:text-white"
                        />
                    </div>

                    {/* Filtro por Usina */}
                    <select
                        value={filtroUsina || ''}
                        onChange={(e) => setFiltroUsina(e.target.value ? Number(e.target.value) : null)}
                        className="px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-900 dark:text-white"
                    >
                        <option value="">Todas as Usinas</option>
                        {usinas.map(usina => (
                            <option key={usina.id} value={usina.id}>
                                {usina.nome || `Usina #${usina.id}`}
                            </option>
                        ))}
                    </select>

                    {/* Filtro por mês */}
                    <select
                        value={filtroMes || ''}
                        onChange={(e) => setFiltroMes(e.target.value ? Number(e.target.value) : null)}
                        className="px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-900 dark:text-white"
                    >
                        <option value="">Todos os meses</option>
                        {meses.map(mes => (
                            <option key={mes.value} value={mes.value}>{mes.label}</option>
                        ))}
                    </select>

                    {/* Filtro por ano */}
                    <select
                        value={filtroAno}
                        onChange={(e) => setFiltroAno(Number(e.target.value))}
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
                                onClick={() => setFiltroStatus(status)}
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
                                            Beneficiário
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                            UC
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                            Usina
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                            Vencimento
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
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <User size={16} className="text-slate-400" />
                                                        <span className="text-sm text-slate-600 dark:text-slate-300">
                                                            {fatura.beneficiario?.nome || '-'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                                                    {fatura.uc_formatada || '-'}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <Building2 size={16} className="text-slate-400" />
                                                        <span className="text-sm text-slate-600 dark:text-slate-300">
                                                            {fatura.usina?.nome || '-'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                                                    {formatarData(fatura.data_vencimento)}
                                                </td>
                                                <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                                                    {formatarValor(fatura.valor_fatura)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {getStatusBadge(fatura.status_fluxo)}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        {/* Botão Ver PIX - só se tiver cobrança */}
                                                        {fatura.cobranca?.qr_code_pix && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setFaturaDetalhe(fatura);
                                                                }}
                                                                className="p-2 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition"
                                                                title="Ver PIX"
                                                            >
                                                                <QrCode size={16} />
                                                            </button>
                                                        )}
                                                        {/* Botão Download PDF */}
                                                        {fatura.tem_pdf && (
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
                                                        )}
                                                        <button
                                                            onClick={() => setFaturaDetalhe(fatura)}
                                                            className="p-2 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition"
                                                            title="Ver detalhes"
                                                        >
                                                            <Eye size={16} />
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
                                            {getStatusBadge(fatura.status_fluxo)}
                                        </div>
                                        <div className="text-sm text-slate-500 dark:text-slate-400 space-y-1">
                                            <p className="flex items-center gap-2">
                                                <User size={14} />
                                                {fatura.beneficiario?.nome || '-'}
                                            </p>
                                            <p>UC: {fatura.uc_formatada}</p>
                                            <p>Vencimento: {formatarData(fatura.data_vencimento)}</p>
                                        </div>
                                        <div className="mt-2 text-lg font-bold text-slate-900 dark:text-white">
                                            {formatarValor(fatura.valor_fatura)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
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
                                {getStatusBadge(faturaDetalhe.status_fluxo)}
                            </div>

                            {/* Valor */}
                            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4">
                                <p className="text-sm text-slate-500 dark:text-slate-400">Valor da Fatura</p>
                                <p className="text-3xl font-bold text-slate-900 dark:text-white">
                                    {formatarValor(faturaDetalhe.valor_fatura)}
                                </p>
                            </div>

                            {/* Beneficiário e UC */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Beneficiário</p>
                                    <p className="font-medium text-slate-900 dark:text-white">
                                        {faturaDetalhe.beneficiario?.nome || '-'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">UC</p>
                                    <p className="font-medium text-slate-900 dark:text-white">
                                        {faturaDetalhe.uc_formatada}
                                    </p>
                                </div>
                            </div>

                            {/* Usina e Vencimento */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Usina</p>
                                    <p className="font-medium text-slate-900 dark:text-white">
                                        {faturaDetalhe.usina?.nome || '-'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Vencimento</p>
                                    <p className="font-medium text-slate-900 dark:text-white">
                                        {formatarData(faturaDetalhe.data_vencimento)}
                                    </p>
                                </div>
                            </div>

                            {/* Consumo e GD */}
                            {(faturaDetalhe.consumo || faturaDetalhe.tipo_gd) && (
                                <div className="grid grid-cols-2 gap-4">
                                    {faturaDetalhe.consumo && (
                                        <div>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">Consumo</p>
                                            <p className="font-medium text-slate-900 dark:text-white">
                                                {faturaDetalhe.consumo} kWh
                                            </p>
                                        </div>
                                    )}
                                    {faturaDetalhe.tipo_gd && (
                                        <div>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">Tipo GD</p>
                                            <p className="font-medium text-slate-900 dark:text-white">
                                                {faturaDetalhe.tipo_gd}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Cobrança */}
                            {faturaDetalhe.cobranca && (
                                <div className="border-t border-slate-200 dark:border-slate-700 pt-4 space-y-3">
                                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Cobrança</p>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">Valor</p>
                                            <p className="font-medium text-slate-900 dark:text-white">
                                                {formatarValor(faturaDetalhe.cobranca.valor_total)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">Vencimento</p>
                                            <p className="font-medium text-slate-900 dark:text-white">
                                                {formatarData(faturaDetalhe.cobranca.vencimento)}
                                            </p>
                                        </div>
                                    </div>

                                    {/* PIX Copia e Cola */}
                                    {faturaDetalhe.cobranca.qr_code_pix && (
                                        <div className="space-y-2">
                                            <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">
                                                PIX Copia e Cola:
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={faturaDetalhe.cobranca.qr_code_pix}
                                                    readOnly
                                                    className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white truncate"
                                                />
                                                <button
                                                    onClick={() => copiarPix(faturaDetalhe.cobranca!.qr_code_pix!)}
                                                    className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition whitespace-nowrap"
                                                >
                                                    <Copy size={16} />
                                                    Copiar
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* QR Code PIX */}
                                    {faturaDetalhe.cobranca.qr_code_pix_image && (
                                        <div className="flex flex-col items-center gap-3">
                                            <p className="text-sm text-slate-600 dark:text-slate-300">
                                                Escaneie o QR Code para pagar via PIX
                                            </p>
                                            <div className="bg-white p-3 rounded-lg shadow-sm border">
                                                <img
                                                    src={`data:image/png;base64,${faturaDetalhe.cobranca.qr_code_pix_image}`}
                                                    alt="QR Code PIX"
                                                    className="w-48 h-48"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Ações */}
                            <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                                {faturaDetalhe.tem_pdf && (
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
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default FaturasGestor;
