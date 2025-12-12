/**
 * Kanban de Faturas - Visualização por status de processamento
 */

import { useState, useEffect, useCallback } from 'react';
import { faturasApi, KanbanResponse } from '../../api/faturas';
import { cobrancasApi } from '../../api/cobrancas';
import { usinasApi } from '../../api/usinas';
import { KanbanColumn } from '../../components/kanban';
import type { Usina } from '../../api/types';
import {
    Kanban,
    FileX,
    FileText,
    Zap,
    CheckCircle2,
    Search,
    RefreshCw,
    Loader2,
    X,
    Eye
} from 'lucide-react';

export function KanbanFaturas() {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingFaturaId, setLoadingFaturaId] = useState<number | null>(null);

    // Filtros
    const [usinas, setUsinas] = useState<Usina[]>([]);
    const [usinaId, setUsinaId] = useState<number | ''>('');
    const [mes, setMes] = useState<number | ''>('');
    const [ano, setAno] = useState<number | ''>(new Date().getFullYear());
    const [busca, setBusca] = useState('');

    // Dados do Kanban
    const [kanbanData, setKanbanData] = useState<KanbanResponse | null>(null);

    // Modal de relatório
    const [relatorioHtml, setRelatorioHtml] = useState<string | null>(null);
    const [relatorioNome, setRelatorioNome] = useState<string>('');

    const meses = [
        { value: '', label: 'Todos os meses' },
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

    const anos = Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - i);

    // Buscar usinas
    useEffect(() => {
        const fetchUsinas = async () => {
            try {
                const response = await usinasApi.minhas();
                setUsinas(response.data || []);
            } catch (err) {
                console.error('Erro ao carregar usinas:', err);
            }
        };
        fetchUsinas();
    }, []);

    // Buscar dados do Kanban
    const fetchKanban = useCallback(async () => {
        try {
            setRefreshing(true);
            const response = await faturasApi.kanban({
                usina_id: usinaId || undefined,
                mes_referencia: mes || undefined,
                ano_referencia: ano || undefined,
                busca: busca || undefined
            });
            setKanbanData(response.data);
        } catch (err) {
            console.error('Erro ao carregar kanban:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [usinaId, mes, ano, busca]);

    useEffect(() => {
        fetchKanban();
    }, [fetchKanban]);

    // Handlers
    const handleExtrair = async (faturaId: number) => {
        try {
            setLoadingFaturaId(faturaId);
            await faturasApi.extrair(faturaId);
            await fetchKanban();
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Erro ao extrair fatura');
        } finally {
            setLoadingFaturaId(null);
        }
    };

    const handleGerarRelatorio = async (faturaId: number, beneficiarioId: number) => {
        try {
            setLoadingFaturaId(faturaId);
            await cobrancasApi.gerarAutomatica(faturaId, beneficiarioId);
            await fetchKanban();
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Erro ao gerar relatório');
        } finally {
            setLoadingFaturaId(null);
        }
    };

    const handleVisualizarPdf = async (faturaId: number) => {
        try {
            const response = await faturasApi.buscarPdf(faturaId);
            if (response.data.pdf_base64) {
                const pdfWindow = window.open('', '_blank');
                if (pdfWindow) {
                    pdfWindow.document.write(`
                        <html>
                            <head><title>PDF da Fatura</title></head>
                            <body style="margin:0;padding:0;">
                                <embed src="data:application/pdf;base64,${response.data.pdf_base64}"
                                       type="application/pdf"
                                       width="100%"
                                       height="100%">
                            </body>
                        </html>
                    `);
                }
            }
        } catch (err) {
            alert('Erro ao carregar PDF');
        }
    };

    const handleVisualizarRelatorio = async (cobrancaId: number) => {
        try {
            const response = await cobrancasApi.obterRelatorioHTML(cobrancaId);
            setRelatorioHtml(response.data);
            setRelatorioNome(`Cobrança #${cobrancaId}`);
        } catch (err) {
            alert('Erro ao carregar relatório');
        }
    };

    const handleUploadPdf = async (faturaId: number) => {
        // TODO: Implementar upload de PDF
        alert('Funcionalidade de upload em desenvolvimento');
    };

    const totalFaturas = kanbanData
        ? kanbanData.totais.sem_pdf + kanbanData.totais.pdf_recebido + kanbanData.totais.extraida + kanbanData.totais.relatorio_gerado
        : 0;

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex-shrink-0 mb-4">
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                            <Kanban className="text-blue-500" />
                            Gestão de Faturas
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400">
                            Visualize e processe faturas por status
                        </p>
                    </div>
                    <button
                        onClick={fetchKanban}
                        disabled={refreshing}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition"
                    >
                        <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
                        Atualizar
                    </button>
                </div>

                {/* Filtros */}
                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        {/* Usina */}
                        <div>
                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                                Usina
                            </label>
                            <select
                                value={usinaId}
                                onChange={(e) => setUsinaId(e.target.value ? Number(e.target.value) : '')}
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                <option value="">Todas as usinas</option>
                                {usinas.map(usina => (
                                    <option key={usina.id} value={usina.id}>{usina.nome}</option>
                                ))}
                            </select>
                        </div>

                        {/* Mês */}
                        <div>
                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                                Mês
                            </label>
                            <select
                                value={mes}
                                onChange={(e) => setMes(e.target.value ? Number(e.target.value) : '')}
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                {meses.map(m => (
                                    <option key={m.value} value={m.value}>{m.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Ano */}
                        <div>
                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                                Ano
                            </label>
                            <select
                                value={ano}
                                onChange={(e) => setAno(e.target.value ? Number(e.target.value) : '')}
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                <option value="">Todos os anos</option>
                                {anos.map(a => (
                                    <option key={a} value={a}>{a}</option>
                                ))}
                            </select>
                        </div>

                        {/* Busca */}
                        <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                                Buscar
                            </label>
                            <div className="relative">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    value={busca}
                                    onChange={(e) => setBusca(e.target.value)}
                                    placeholder="Nome do beneficiário ou UC..."
                                    className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Resumo */}
                    <div className="flex items-center gap-6 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                        <span className="text-sm text-slate-500 dark:text-slate-400">
                            Total: <span className="font-semibold text-slate-900 dark:text-white">{totalFaturas}</span> faturas
                        </span>
                        {kanbanData && (
                            <>
                                <span className="text-xs text-slate-400">|</span>
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                    {kanbanData.totais.sem_pdf} sem PDF
                                </span>
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                    {kanbanData.totais.pdf_recebido} aguardando extração
                                </span>
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                    {kanbanData.totais.extraida} prontas
                                </span>
                                <span className="text-xs text-green-600 dark:text-green-400">
                                    {kanbanData.totais.relatorio_gerado} concluídas
                                </span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Kanban Board */}
            <div className="flex-1 overflow-x-auto">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <Loader2 className="animate-spin text-blue-500" size={40} />
                    </div>
                ) : (
                    <div className="flex gap-4 pb-4 min-h-[500px]">
                        <KanbanColumn
                            title="Sem PDF"
                            count={kanbanData?.totais.sem_pdf || 0}
                            color="slate"
                            icon={<FileX size={18} />}
                            faturas={kanbanData?.sem_pdf || []}
                            emptyMessage="Nenhuma fatura sem PDF"
                            loadingFaturaId={loadingFaturaId}
                            onUploadPdf={handleUploadPdf}
                        />

                        <KanbanColumn
                            title="PDF Recebido"
                            count={kanbanData?.totais.pdf_recebido || 0}
                            color="blue"
                            icon={<FileText size={18} />}
                            faturas={kanbanData?.pdf_recebido || []}
                            emptyMessage="Nenhuma fatura aguardando extração"
                            loadingFaturaId={loadingFaturaId}
                            onExtrair={handleExtrair}
                            onVisualizarPdf={handleVisualizarPdf}
                        />

                        <KanbanColumn
                            title="Extraída"
                            count={kanbanData?.totais.extraida || 0}
                            color="yellow"
                            icon={<Zap size={18} />}
                            faturas={kanbanData?.extraida || []}
                            emptyMessage="Nenhuma fatura pronta para gerar relatório"
                            loadingFaturaId={loadingFaturaId}
                            onGerarRelatorio={handleGerarRelatorio}
                            onVisualizarPdf={handleVisualizarPdf}
                        />

                        <KanbanColumn
                            title="Relatório Gerado"
                            count={kanbanData?.totais.relatorio_gerado || 0}
                            color="green"
                            icon={<CheckCircle2 size={18} />}
                            faturas={kanbanData?.relatorio_gerado || []}
                            emptyMessage="Nenhum relatório gerado"
                            loadingFaturaId={loadingFaturaId}
                            onVisualizarRelatorio={handleVisualizarRelatorio}
                            onVisualizarPdf={handleVisualizarPdf}
                        />
                    </div>
                )}
            </div>

            {/* Modal de Relatório */}
            {relatorioHtml && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                <Eye size={20} />
                                {relatorioNome}
                            </h2>
                            <button
                                onClick={() => {
                                    setRelatorioHtml(null);
                                    setRelatorioNome('');
                                }}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                                <X size={24} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-4">
                            <div dangerouslySetInnerHTML={{ __html: relatorioHtml }} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default KanbanFaturas;
