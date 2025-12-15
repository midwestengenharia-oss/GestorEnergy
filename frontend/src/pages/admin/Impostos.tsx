/**
 * Impostos - Gestão de Configurações de Impostos (PIS, COFINS, ICMS)
 */

import { useState, useEffect } from 'react';
import {
    Receipt,
    Plus,
    Edit2,
    Trash2,
    Loader2,
    X,
    CheckCircle2,
    AlertCircle,
    Calendar
} from 'lucide-react';
import { configuracoesApi, Imposto, ImpostoCreate } from '../../api/configuracoes';

export function Impostos() {
    const [impostos, setImpostos] = useState<Imposto[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Modal
    const [showModal, setShowModal] = useState(false);
    const [editingImposto, setEditingImposto] = useState<Imposto | null>(null);
    const [actionLoading, setActionLoading] = useState(false);

    // Form
    const [formData, setFormData] = useState<ImpostoCreate>({
        pis: 0,
        cofins: 0,
        icms: 0,
        vigencia_inicio: new Date().toISOString().split('T')[0],
        observacao: ''
    });

    const fetchImpostos = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await configuracoesApi.listarImpostos();
            setImpostos(response.data);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Erro ao carregar impostos');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchImpostos();
    }, []);

    const handleOpenModal = (imposto?: Imposto) => {
        if (imposto) {
            setEditingImposto(imposto);
            setFormData({
                pis: imposto.pis,
                cofins: imposto.cofins,
                icms: imposto.icms,
                vigencia_inicio: imposto.vigencia_inicio,
                observacao: imposto.observacao || ''
            });
        } else {
            setEditingImposto(null);
            setFormData({
                pis: 0,
                cofins: 0,
                icms: 0,
                vigencia_inicio: new Date().toISOString().split('T')[0],
                observacao: ''
            });
        }
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingImposto(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setActionLoading(true);
            if (editingImposto) {
                await configuracoesApi.atualizarImposto(editingImposto.id, formData);
            } else {
                await configuracoesApi.criarImposto(formData);
            }
            await fetchImpostos();
            handleCloseModal();
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Erro ao salvar imposto');
        } finally {
            setActionLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Tem certeza que deseja excluir este registro?')) return;

        try {
            setActionLoading(true);
            await configuracoesApi.excluirImposto(id);
            await fetchImpostos();
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Erro ao excluir imposto');
        } finally {
            setActionLoading(false);
        }
    };

    const formatPercent = (value: number) => {
        return `${(value * 100).toFixed(4)}%`;
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('pt-BR');
    };

    const isVigente = (imposto: Imposto) => {
        return !imposto.vigencia_fim;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <Receipt className="text-blue-500" />
                        Configurações de Impostos
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        Gerencie PIS, COFINS e ICMS para cálculos de cobranças
                    </p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                    <Plus size={18} />
                    Novo Registro
                </button>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                    <AlertCircle className="text-blue-500 flex-shrink-0 mt-0.5" size={20} />
                    <div className="text-sm text-blue-700 dark:text-blue-300">
                        <p className="font-medium mb-1">Como funciona:</p>
                        <ul className="list-disc list-inside space-y-1">
                            <li>Ao criar um novo registro, a vigência do anterior é encerrada automaticamente</li>
                            <li>O sistema detecta automaticamente mudanças de impostos durante a extração de faturas</li>
                            <li>Valores são usados na fórmula: valor_base / ((1 - PIS_COFINS) × (1 - ICMS))</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-300">
                    {error}
                </div>
            )}

            {/* Table */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center h-48">
                        <Loader2 className="animate-spin text-blue-500" size={32} />
                    </div>
                ) : impostos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-slate-500 dark:text-slate-400">
                        <Receipt size={40} className="mb-2 opacity-50" />
                        <p>Nenhum imposto cadastrado</p>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead className="bg-slate-50 dark:bg-slate-900/50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    PIS
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    COFINS
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    ICMS
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    Vigência
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    Observação
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    Ações
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {impostos.map((imposto) => (
                                <tr key={imposto.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/30">
                                    <td className="px-4 py-3">
                                        {isVigente(imposto) ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                                <CheckCircle2 size={12} />
                                                Vigente
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400">
                                                Encerrado
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-sm font-mono text-slate-900 dark:text-white">
                                        {formatPercent(imposto.pis)}
                                    </td>
                                    <td className="px-4 py-3 text-sm font-mono text-slate-900 dark:text-white">
                                        {formatPercent(imposto.cofins)}
                                    </td>
                                    <td className="px-4 py-3 text-sm font-mono text-slate-900 dark:text-white">
                                        {formatPercent(imposto.icms)}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                                        <div className="flex items-center gap-1">
                                            <Calendar size={14} className="text-slate-400" />
                                            {formatDate(imposto.vigencia_inicio)}
                                            {imposto.vigencia_fim && (
                                                <span> - {formatDate(imposto.vigencia_fim)}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 max-w-xs truncate">
                                        {imposto.observacao || '-'}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleOpenModal(imposto)}
                                                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400"
                                                title="Editar"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            {!isVigente(imposto) && (
                                                <button
                                                    onClick={() => handleDelete(imposto.id)}
                                                    className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500"
                                                    title="Excluir"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-md">
                        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                {editingImposto ? 'Editar Imposto' : 'Novo Imposto'}
                            </h2>
                            <button
                                onClick={handleCloseModal}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-4 space-y-4">
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        PIS (%)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.0001"
                                        min="0"
                                        max="100"
                                        value={formData.pis * 100}
                                        onChange={(e) => setFormData({ ...formData, pis: parseFloat(e.target.value) / 100 || 0 })}
                                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        COFINS (%)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.0001"
                                        min="0"
                                        max="100"
                                        value={formData.cofins * 100}
                                        onChange={(e) => setFormData({ ...formData, cofins: parseFloat(e.target.value) / 100 || 0 })}
                                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        ICMS (%)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        max="100"
                                        value={formData.icms * 100}
                                        onChange={(e) => setFormData({ ...formData, icms: parseFloat(e.target.value) / 100 || 0 })}
                                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Início da Vigência
                                </label>
                                <input
                                    type="date"
                                    value={formData.vigencia_inicio}
                                    onChange={(e) => setFormData({ ...formData, vigencia_inicio: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Observação
                                </label>
                                <textarea
                                    value={formData.observacao}
                                    onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                    rows={3}
                                    placeholder="Motivo da alteração..."
                                />
                            </div>

                            {/* Preview */}
                            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3">
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Preview dos valores:</p>
                                <div className="grid grid-cols-3 gap-2 text-sm">
                                    <div>
                                        <span className="text-slate-500">PIS:</span>
                                        <span className="ml-1 font-mono text-slate-900 dark:text-white">{(formData.pis * 100).toFixed(4)}%</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-500">COFINS:</span>
                                        <span className="ml-1 font-mono text-slate-900 dark:text-white">{(formData.cofins * 100).toFixed(4)}%</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-500">ICMS:</span>
                                        <span className="ml-1 font-mono text-slate-900 dark:text-white">{(formData.icms * 100).toFixed(2)}%</span>
                                    </div>
                                </div>
                                <p className="text-xs text-slate-500 mt-2">
                                    PIS+COFINS combinado: <span className="font-mono">{((formData.pis + formData.cofins) * 100).toFixed(4)}%</span>
                                </p>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={actionLoading}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {actionLoading && <Loader2 className="animate-spin" size={18} />}
                                    {editingImposto ? 'Salvar' : 'Criar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Impostos;
