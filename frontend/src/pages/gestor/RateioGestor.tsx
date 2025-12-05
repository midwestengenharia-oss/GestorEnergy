/**
 * RateioGestor - Página de Rateio de Energia para Gestores
 * Permite visualizar e configurar a distribuição de energia entre beneficiários
 */

import { useState, useEffect, useCallback } from 'react';
import {
    Zap,
    Users,
    Percent,
    AlertTriangle,
    CheckCircle,
    Save,
    RefreshCw,
    Search,
    ChevronDown,
    ChevronUp,
    Info
} from 'lucide-react';
import { usinasApi } from '../../api/usinas';
import { beneficiariosApi } from '../../api/beneficiarios';

interface Usina {
    id: number;
    nome: string;
    codigo_usina: string;
    capacidade_kwp: number;
    status: string;
    geracao_mensal_media?: number;
}

interface Beneficiario {
    id: number;
    usina_id: number;
    nome: string;
    documento: string;
    numero_uc: string;
    percentual_rateio: number;
    status: string;
    consumo_medio?: number;
}

interface RateioUsina {
    usina: Usina;
    beneficiarios: Beneficiario[];
    totalRateio: number;
    disponivel: number;
}

export function RateioGestor() {
    const [usinas, setUsinas] = useState<RateioUsina[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedUsinas, setExpandedUsinas] = useState<Set<number>>(new Set());
    const [editedRateios, setEditedRateios] = useState<Record<number, number>>({});
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const carregarDados = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            // Buscar usinas do gestor
            const usinasResponse = await usinasApi.minhas();
            const usinasData = usinasResponse.data || [];

            // Para cada usina, buscar beneficiários
            const usinasComBeneficiarios: RateioUsina[] = await Promise.all(
                usinasData.map(async (usina: Usina) => {
                    try {
                        const benefResponse = await beneficiariosApi.porUsina(usina.id);
                        const beneficiarios = (benefResponse.data || []).filter(
                            (b: Beneficiario) => b.status === 'ativo'
                        );
                        const totalRateio = beneficiarios.reduce(
                            (sum: number, b: Beneficiario) => sum + (b.percentual_rateio || 0),
                            0
                        );
                        return {
                            usina,
                            beneficiarios,
                            totalRateio,
                            disponivel: 100 - totalRateio
                        };
                    } catch {
                        return {
                            usina,
                            beneficiarios: [],
                            totalRateio: 0,
                            disponivel: 100
                        };
                    }
                })
            );

            setUsinas(usinasComBeneficiarios);
            // Expandir todas as usinas por padrão
            setExpandedUsinas(new Set(usinasComBeneficiarios.map(u => u.usina.id)));
        } catch (err) {
            console.error('Erro ao carregar dados:', err);
            setError('Erro ao carregar dados de rateio');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        carregarDados();
    }, [carregarDados]);

    const toggleUsina = (usinaId: number) => {
        const newExpanded = new Set(expandedUsinas);
        if (newExpanded.has(usinaId)) {
            newExpanded.delete(usinaId);
        } else {
            newExpanded.add(usinaId);
        }
        setExpandedUsinas(newExpanded);
    };

    const handleRateioChange = (beneficiarioId: number, valor: string) => {
        const numValue = parseFloat(valor) || 0;
        setEditedRateios(prev => ({
            ...prev,
            [beneficiarioId]: Math.min(100, Math.max(0, numValue))
        }));
    };

    const getEditedValue = (beneficiario: Beneficiario): number => {
        return editedRateios[beneficiario.id] ?? beneficiario.percentual_rateio;
    };

    const calcularTotalEditado = (rateioUsina: RateioUsina): number => {
        return rateioUsina.beneficiarios.reduce((sum, b) => {
            return sum + getEditedValue(b);
        }, 0);
    };

    const temAlteracoes = (): boolean => {
        return Object.keys(editedRateios).length > 0;
    };

    const salvarAlteracoes = async () => {
        if (!temAlteracoes()) return;

        try {
            setSaving(true);
            setError(null);
            setSuccessMessage(null);

            // Salvar cada alteração
            const promises = Object.entries(editedRateios).map(([id, valor]) =>
                beneficiariosApi.atualizar(parseInt(id), { percentual_rateio: valor })
            );

            await Promise.all(promises);

            setSuccessMessage('Rateio atualizado com sucesso!');
            setEditedRateios({});
            await carregarDados();

            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err) {
            console.error('Erro ao salvar:', err);
            setError('Erro ao salvar alterações de rateio');
        } finally {
            setSaving(false);
        }
    };

    const cancelarAlteracoes = () => {
        setEditedRateios({});
    };

    const usinasFiltradas = usinas.filter(u =>
        u.usina.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.usina.codigo_usina.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.beneficiarios.some(b =>
            b.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
            b.numero_uc.includes(searchTerm)
        )
    );

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
                        Rateio de Energia
                    </h1>
                    <p className="text-slate-600 dark:text-slate-400 mt-1">
                        Gerencie a distribuição de energia entre os beneficiários
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

                    {temAlteracoes() && (
                        <>
                            <button
                                onClick={cancelarAlteracoes}
                                className="px-4 py-2 text-slate-600 dark:text-slate-300
                                         bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600
                                         rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={salvarAlteracoes}
                                disabled={saving}
                                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white
                                         rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                            >
                                <Save className="w-4 h-4" />
                                {saving ? 'Salvando...' : 'Salvar Alterações'}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Mensagens */}
            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800
                              rounded-lg p-4 flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                    <span className="text-red-700 dark:text-red-300">{error}</span>
                </div>
            )}

            {successMessage && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800
                              rounded-lg p-4 flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <span className="text-green-700 dark:text-green-300">{successMessage}</span>
                </div>
            )}

            {/* Info Box */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800
                          rounded-lg p-4 flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div className="text-sm text-blue-700 dark:text-blue-300">
                    <p className="font-medium mb-1">Como funciona o rateio:</p>
                    <ul className="list-disc list-inside space-y-1">
                        <li>Cada beneficiário recebe uma porcentagem da energia gerada pela usina</li>
                        <li>O total de rateio por usina não pode ultrapassar 100%</li>
                        <li>Valores verdes indicam rateio válido, vermelho indica excesso</li>
                    </ul>
                </div>
            </div>

            {/* Busca */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                    type="text"
                    placeholder="Buscar usina ou beneficiário..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-300
                             dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500
                             dark:text-white"
                />
            </div>

            {/* Lista de Usinas */}
            {usinasFiltradas.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200
                              dark:border-slate-700 p-12 text-center">
                    <Zap className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                        Nenhuma usina encontrada
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400">
                        {searchTerm ? 'Tente ajustar o termo de busca' : 'Você ainda não possui usinas vinculadas'}
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {usinasFiltradas.map((rateioUsina) => {
                        const isExpanded = expandedUsinas.has(rateioUsina.usina.id);
                        const totalEditado = calcularTotalEditado(rateioUsina);
                        const isOverLimit = totalEditado > 100;

                        return (
                            <div
                                key={rateioUsina.usina.id}
                                className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200
                                         dark:border-slate-700 overflow-hidden"
                            >
                                {/* Header da Usina */}
                                <button
                                    onClick={() => toggleUsina(rateioUsina.usina.id)}
                                    className="w-full px-6 py-4 flex items-center justify-between
                                             hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30
                                                      rounded-lg flex items-center justify-center">
                                            <Zap className="w-6 h-6 text-green-600 dark:text-green-400" />
                                        </div>
                                        <div className="text-left">
                                            <h3 className="font-semibold text-slate-900 dark:text-white">
                                                {rateioUsina.usina.nome}
                                            </h3>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                                {rateioUsina.usina.codigo_usina} | {rateioUsina.usina.capacidade_kwp} kWp
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6">
                                        <div className="flex items-center gap-2">
                                            <Users className="w-4 h-4 text-slate-400" />
                                            <span className="text-sm text-slate-600 dark:text-slate-300">
                                                {rateioUsina.beneficiarios.length} beneficiários
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Percent className="w-4 h-4 text-slate-400" />
                                            <span className={`text-sm font-medium ${
                                                isOverLimit
                                                    ? 'text-red-600 dark:text-red-400'
                                                    : 'text-green-600 dark:text-green-400'
                                            }`}>
                                                {totalEditado.toFixed(1)}% / 100%
                                            </span>
                                        </div>

                                        {isExpanded ? (
                                            <ChevronUp className="w-5 h-5 text-slate-400" />
                                        ) : (
                                            <ChevronDown className="w-5 h-5 text-slate-400" />
                                        )}
                                    </div>
                                </button>

                                {/* Barra de Progresso */}
                                <div className="px-6 pb-2">
                                    <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full transition-all duration-300 ${
                                                isOverLimit
                                                    ? 'bg-red-500'
                                                    : 'bg-green-500'
                                            }`}
                                            style={{ width: `${Math.min(totalEditado, 100)}%` }}
                                        />
                                    </div>
                                    {isOverLimit && (
                                        <p className="text-xs text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                                            <AlertTriangle className="w-3 h-3" />
                                            Rateio excede 100% - ajuste os valores
                                        </p>
                                    )}
                                </div>

                                {/* Lista de Beneficiários */}
                                {isExpanded && (
                                    <div className="border-t border-slate-200 dark:border-slate-700">
                                        {rateioUsina.beneficiarios.length === 0 ? (
                                            <div className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                                                Nenhum beneficiário ativo nesta usina
                                            </div>
                                        ) : (
                                            <table className="w-full">
                                                <thead>
                                                    <tr className="bg-slate-50 dark:bg-slate-700/50">
                                                        <th className="px-6 py-3 text-left text-xs font-medium
                                                                     text-slate-500 dark:text-slate-400 uppercase">
                                                            Beneficiário
                                                        </th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium
                                                                     text-slate-500 dark:text-slate-400 uppercase">
                                                            UC
                                                        </th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium
                                                                     text-slate-500 dark:text-slate-400 uppercase">
                                                            Consumo Médio
                                                        </th>
                                                        <th className="px-6 py-3 text-center text-xs font-medium
                                                                     text-slate-500 dark:text-slate-400 uppercase">
                                                            Rateio (%)
                                                        </th>
                                                        <th className="px-6 py-3 text-right text-xs font-medium
                                                                     text-slate-500 dark:text-slate-400 uppercase">
                                                            Energia Estimada
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                                    {rateioUsina.beneficiarios.map((beneficiario) => {
                                                        const rateioAtual = getEditedValue(beneficiario);
                                                        const geracaoEstimada = rateioUsina.usina.geracao_mensal_media
                                                            ? (rateioUsina.usina.geracao_mensal_media * rateioAtual / 100)
                                                            : (rateioUsina.usina.capacidade_kwp * 120 * rateioAtual / 100);
                                                        const foiEditado = editedRateios[beneficiario.id] !== undefined;

                                                        return (
                                                            <tr key={beneficiario.id} className="hover:bg-slate-50
                                                                                               dark:hover:bg-slate-700/30">
                                                                <td className="px-6 py-4">
                                                                    <div className="font-medium text-slate-900 dark:text-white">
                                                                        {beneficiario.nome}
                                                                    </div>
                                                                    <div className="text-sm text-slate-500 dark:text-slate-400">
                                                                        {beneficiario.documento}
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                                                    {beneficiario.numero_uc}
                                                                </td>
                                                                <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                                                    {beneficiario.consumo_medio
                                                                        ? `${beneficiario.consumo_medio.toFixed(0)} kWh`
                                                                        : '-'
                                                                    }
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    <div className="flex items-center justify-center gap-2">
                                                                        <input
                                                                            type="number"
                                                                            min="0"
                                                                            max="100"
                                                                            step="0.1"
                                                                            value={rateioAtual}
                                                                            onChange={(e) => handleRateioChange(
                                                                                beneficiario.id,
                                                                                e.target.value
                                                                            )}
                                                                            className={`w-20 px-3 py-1.5 text-center border rounded-lg
                                                                                      focus:ring-2 focus:ring-green-500 dark:bg-slate-700
                                                                                      dark:text-white ${
                                                                                foiEditado
                                                                                    ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20'
                                                                                    : 'border-slate-300 dark:border-slate-600'
                                                                            }`}
                                                                        />
                                                                        <span className="text-slate-500">%</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4 text-right">
                                                                    <span className="font-medium text-green-600 dark:text-green-400">
                                                                        {geracaoEstimada.toFixed(0)} kWh/mês
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Resumo Geral */}
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                    Resumo Geral
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200
                                  dark:border-slate-700">
                        <p className="text-sm text-slate-500 dark:text-slate-400">Total de Usinas</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                            {usinas.length}
                        </p>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200
                                  dark:border-slate-700">
                        <p className="text-sm text-slate-500 dark:text-slate-400">Total de Beneficiários</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                            {usinas.reduce((sum, u) => sum + u.beneficiarios.length, 0)}
                        </p>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200
                                  dark:border-slate-700">
                        <p className="text-sm text-slate-500 dark:text-slate-400">Capacidade Total</p>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {usinas.reduce((sum, u) => sum + (u.usina.capacidade_kwp || 0), 0).toFixed(1)} kWp
                        </p>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200
                                  dark:border-slate-700">
                        <p className="text-sm text-slate-500 dark:text-slate-400">Usinas 100% Rateadas</p>
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                            {usinas.filter(u => Math.abs(calcularTotalEditado(u) - 100) < 0.01).length}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default RateioGestor;
