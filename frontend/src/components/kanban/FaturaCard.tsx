/**
 * Card de Fatura para o Kanban
 */

import { FileText, Eye, Zap, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import type { FaturaKanban } from '../../api/faturas';

interface FaturaCardProps {
    fatura: FaturaKanban;
    onExtrair?: (faturaId: number) => void;
    onGerarRelatorio?: (faturaId: number, beneficiarioId: number) => void;
    onVisualizarPdf?: (faturaId: number) => void;
    onVisualizarRelatorio?: (cobrancaId: number) => void;
    onUploadPdf?: (faturaId: number) => void;
    loading?: boolean;
}

const meses = [
    '', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

export function FaturaCard({
    fatura,
    onExtrair,
    onGerarRelatorio,
    onVisualizarPdf,
    onVisualizarRelatorio,
    onUploadPdf,
    loading = false
}: FaturaCardProps) {
    const mesAno = `${meses[fatura.mes_referencia]}/${fatura.ano_referencia}`;

    const getScoreColor = (score?: number) => {
        if (!score) return 'text-slate-400';
        if (score >= 90) return 'text-green-600 dark:text-green-400';
        if (score >= 70) return 'text-yellow-600 dark:text-yellow-400';
        return 'text-red-600 dark:text-red-400';
    };

    const getTipoGdBadge = () => {
        if (!fatura.tipo_gd) return null;
        const isGD1 = fatura.tipo_gd === 'GDI';
        return (
            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                isGD1
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
            }`}>
                {fatura.tipo_gd}
            </span>
        );
    };

    return (
        <div className={`bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3 shadow-sm hover:shadow-md transition-shadow ${loading ? 'opacity-50' : ''}`}>
            {/* Header */}
            <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900 dark:text-white text-sm truncate">
                            {fatura.beneficiario.nome}
                        </span>
                        {getTipoGdBadge()}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        UC: {fatura.uc_formatada}
                    </div>
                </div>
                <div className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap ml-2">
                    {mesAno}
                </div>
            </div>

            {/* Dados extraídos (se disponível) */}
            {fatura.extracao_status === 'CONCLUIDA' && (
                <div className="grid grid-cols-2 gap-2 mb-2 text-xs">
                    <div>
                        <span className="text-slate-400 dark:text-slate-500">Consumo</span>
                        <div className="font-medium text-slate-700 dark:text-slate-300">
                            {fatura.consumo_kwh ? `${fatura.consumo_kwh.toLocaleString('pt-BR')} kWh` : '-'}
                        </div>
                    </div>
                    <div>
                        <span className="text-slate-400 dark:text-slate-500">Valor</span>
                        <div className="font-medium text-slate-700 dark:text-slate-300">
                            {fatura.valor_fatura
                                ? `R$ ${fatura.valor_fatura.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                                : '-'}
                        </div>
                    </div>
                </div>
            )}

            {/* Score de extração */}
            {fatura.extracao_score && (
                <div className="flex items-center gap-1 mb-2">
                    {fatura.extracao_score >= 90 ? (
                        <CheckCircle2 size={12} className="text-green-500" />
                    ) : (
                        <AlertCircle size={12} className="text-yellow-500" />
                    )}
                    <span className={`text-xs font-medium ${getScoreColor(fatura.extracao_score)}`}>
                        Score: {fatura.extracao_score}/100
                    </span>
                </div>
            )}

            {/* Ações */}
            <div className="flex items-center gap-1 pt-2 border-t border-slate-100 dark:border-slate-700">
                {/* Sem PDF - mostrar upload */}
                {!fatura.tem_pdf && onUploadPdf && (
                    <button
                        onClick={() => onUploadPdf(fatura.id)}
                        disabled={loading}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition"
                    >
                        <Upload size={12} />
                        Upload
                    </button>
                )}

                {/* PDF disponível - ver PDF */}
                {fatura.tem_pdf && onVisualizarPdf && (
                    <button
                        onClick={() => onVisualizarPdf(fatura.id)}
                        disabled={loading}
                        className="flex items-center justify-center gap-1 px-2 py-1.5 text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition"
                    >
                        <FileText size={12} />
                    </button>
                )}

                {/* PDF disponível mas não extraído - extrair */}
                {fatura.tem_pdf && fatura.extracao_status !== 'CONCLUIDA' && onExtrair && (
                    <button
                        onClick={() => onExtrair(fatura.id)}
                        disabled={loading}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition"
                    >
                        <Zap size={12} />
                        Extrair
                    </button>
                )}

                {/* Extraído mas sem cobrança - gerar relatório */}
                {fatura.extracao_status === 'CONCLUIDA' && !fatura.cobranca && onGerarRelatorio && (
                    <button
                        onClick={() => onGerarRelatorio(fatura.id, fatura.beneficiario.id)}
                        disabled={loading}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs bg-green-500 text-white rounded hover:bg-green-600 transition"
                    >
                        <Zap size={12} />
                        Gerar
                    </button>
                )}

                {/* Cobrança gerada - visualizar */}
                {fatura.cobranca && onVisualizarRelatorio && (
                    <button
                        onClick={() => onVisualizarRelatorio(fatura.cobranca!.id)}
                        disabled={loading}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs bg-emerald-500 text-white rounded hover:bg-emerald-600 transition"
                    >
                        <Eye size={12} />
                        Ver Relatório
                    </button>
                )}
            </div>
        </div>
    );
}

export default FaturaCard;
