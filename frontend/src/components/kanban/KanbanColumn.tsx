/**
 * Coluna do Kanban de Faturas
 */

import { ReactNode } from 'react';
import { FaturaCard } from './FaturaCard';
import type { FaturaKanban } from '../../api/faturas';
import { Loader2 } from 'lucide-react';

interface KanbanColumnProps {
    title: string;
    count: number;
    color: 'slate' | 'blue' | 'yellow' | 'green';
    icon: ReactNode;
    faturas: FaturaKanban[];
    emptyMessage?: string;
    loading?: boolean;
    loadingFaturaId?: number | null;
    onExtrair?: (faturaId: number) => void;
    onGerarRelatorio?: (faturaId: number, beneficiarioId: number) => void;
    onVisualizarPdf?: (faturaId: number) => void;
    onVisualizarRelatorio?: (cobrancaId: number) => void;
    onUploadPdf?: (faturaId: number) => void;
}

const colorClasses = {
    slate: {
        header: 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600',
        badge: 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300',
        icon: 'text-slate-500'
    },
    blue: {
        header: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
        badge: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
        icon: 'text-blue-500'
    },
    yellow: {
        header: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
        badge: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300',
        icon: 'text-yellow-500'
    },
    green: {
        header: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
        badge: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
        icon: 'text-green-500'
    }
};

export function KanbanColumn({
    title,
    count,
    color,
    icon,
    faturas,
    emptyMessage = 'Nenhuma fatura',
    loading = false,
    loadingFaturaId,
    onExtrair,
    onGerarRelatorio,
    onVisualizarPdf,
    onVisualizarRelatorio,
    onUploadPdf
}: KanbanColumnProps) {
    const colors = colorClasses[color];

    return (
        <div className="flex flex-col bg-slate-50 dark:bg-slate-900/50 rounded-xl min-w-[280px] max-w-[320px] h-full">
            {/* Header da coluna */}
            <div className={`flex items-center justify-between px-3 py-2 rounded-t-xl border-b ${colors.header}`}>
                <div className="flex items-center gap-2">
                    <span className={colors.icon}>{icon}</span>
                    <span className="font-medium text-slate-900 dark:text-white text-sm">
                        {title}
                    </span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${colors.badge}`}>
                    {count}
                </span>
            </div>

            {/* Lista de cards */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="animate-spin text-slate-400" size={24} />
                    </div>
                ) : faturas.length === 0 ? (
                    <div className="text-center py-8 text-sm text-slate-400 dark:text-slate-500">
                        {emptyMessage}
                    </div>
                ) : (
                    faturas.map(fatura => (
                        <FaturaCard
                            key={fatura.id}
                            fatura={fatura}
                            loading={loadingFaturaId === fatura.id}
                            onExtrair={onExtrair}
                            onGerarRelatorio={onGerarRelatorio}
                            onVisualizarPdf={onVisualizarPdf}
                            onVisualizarRelatorio={onVisualizarRelatorio}
                            onUploadPdf={onUploadPdf}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

export default KanbanColumn;
