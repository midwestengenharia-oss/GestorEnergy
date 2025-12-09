/**
 * Cobranças Automáticas - Geração automática baseada em extração de faturas
 */

import { useState, useEffect } from 'react';
import { faturasApi } from '../../api/faturas';
import { cobrancasApi } from '../../api/cobrancas';
import { usinasApi } from '../../api/usinas';
import type { Usina } from '../../api/types';
import {
    Zap,
    FileText,
    Loader2,
    CheckCircle2,
    XCircle,
    AlertCircle,
    Eye,
    Send,
    Calendar,
    DollarSign,
} from 'lucide-react';

interface Cobranca {
    id: number;
    status: string;
    beneficiario_id: number;
    beneficiario?: { nome: string };
    valor_total: number;
    vencimento: string;
    economia_mes: number;
    tipo_modelo_gd?: string;
}

export function CobrancasAutomaticas() {
    const [loading, setLoading] = useState(false);
    const [usinas, setUsinas] = useState<Usina[]>([]);
    const [usinaId, setUsinaId] = useState<number | null>(null);
    const [mes, setMes] = useState(new Date().getMonth() + 1);
    const [ano, setAno] = useState(new Date().getFullYear());

    // Estados do processo
    const [etapa, setEtapa] = useState<'selecao' | 'extraindo' | 'gerando' | 'concluido'>('selecao');
    const [resultadoExtracao, setResultadoExtracao] = useState<any>(null);
    const [resultadoGeracao, setResultadoGeracao] = useState<any>(null);
    const [cobrancasGeradas, setCobrancasGeradas] = useState<Cobranca[]>([]);

    // Modal de detalhes
    const [cobrancaSelecionada, setCobrancaSelecionada] = useState<Cobranca | null>(null);
    const [htmlRelatorio, setHtmlRelatorio] = useState<string | null>(null);
    const [vencimentoEditando, setVencimentoEditando] = useState<string | null>(null);

    useEffect(() => {
        fetchUsinas();
    }, []);

    const fetchUsinas = async () => {
        try {
            const response = await usinasApi.minhas();
            setUsinas(response.data || []);
        } catch (err) {
            console.error('Erro ao carregar usinas:', err);
        }
    };

    const handleExtrairEGerar = async () => {
        if (!usinaId) {
            alert('Selecione uma usina');
            return;
        }

        try {
            setLoading(true);
            setEtapa('extraindo');

            // Passo 1: Extrair faturas em lote
            const extracaoResponse = await faturasApi.extrairLote(undefined, mes, ano, 50);
            setResultadoExtracao(extracaoResponse.data);

            if (extracaoResponse.data.sucesso === 0) {
                alert('Nenhuma fatura foi extraída com sucesso');
                setEtapa('selecao');
                return;
            }

            // Pequeno delay para feedback visual
            await new Promise(resolve => setTimeout(resolve, 1000));

            setEtapa('gerando');

            // Passo 2: Gerar cobranças automáticas
            const geracaoResponse = await cobrancasApi.gerarLoteUsina(usinaId, mes, ano);
            setResultadoGeracao(geracaoResponse.data);

            // Buscar cobranças geradas (status RASCUNHO)
            await fetchCobrancasRascunho();

            setEtapa('concluido');
        } catch (err: any) {
            console.error('Erro:', err);
            alert(err.response?.data?.detail || 'Erro ao processar');
            setEtapa('selecao');
        } finally {
            setLoading(false);
        }
    };

    const fetchCobrancasRascunho = async () => {
        try {
            const response = await cobrancasApi.listar({
                usina_id: usinaId!,
                mes,
                ano,
                page: 1,
                limit: 100
            });

            const data = response.data;
            const cobrancas = Array.isArray(data) ? data : (data?.items || data?.cobrancas || []);

            // Filtrar apenas RASCUNHO
            const rascunhos = cobrancas.filter((c: Cobranca) => c.status === 'RASCUNHO');
            setCobrancasGeradas(rascunhos);
        } catch (err) {
            console.error('Erro ao buscar cobranças:', err);
        }
    };

    const handleVisualizarRelatorio = async (cobranca: Cobranca) => {
        try {
            setCobrancaSelecionada(cobranca);
            const response = await cobrancasApi.obterRelatorioHTML(cobranca.id);
            setHtmlRelatorio(response.data);
        } catch (err) {
            alert('Erro ao carregar relatório');
        }
    };

    const handleEditarVencimento = async (cobrancaId: number, novaData: string) => {
        try {
            await cobrancasApi.editarVencimento(cobrancaId, novaData);
            setVencimentoEditando(null);
            fetchCobrancasRascunho();
            alert('Vencimento atualizado!');
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Erro ao atualizar vencimento');
        }
    };

    const handleAprovar = async (cobrancaId: number, enviarEmail: boolean = false) => {
        if (!confirm('Confirma a aprovação desta cobrança? Ela será marcada como EMITIDA e não poderá mais ser editada.')) {
            return;
        }

        try {
            await cobrancasApi.aprovar(cobrancaId, enviarEmail);
            fetchCobrancasRascunho();
            alert('Cobrança aprovada com sucesso!');
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Erro ao aprovar cobrança');
        }
    };

    const handleAprovarTodas = async (enviarEmail: boolean = false) => {
        if (!confirm(`Confirma a aprovação de ${cobrancasGeradas.length} cobranças?`)) {
            return;
        }

        let sucesso = 0;
        let erro = 0;

        for (const cobranca of cobrancasGeradas) {
            try {
                await cobrancasApi.aprovar(cobranca.id, enviarEmail);
                sucesso++;
            } catch (err) {
                erro++;
            }
        }

        alert(`Aprovação concluída!\nSucesso: ${sucesso}\nErros: ${erro}`);
        fetchCobrancasRascunho();
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

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                    <Zap className="text-yellow-500" />
                    Cobranças Automáticas
                </h1>
                <p className="text-slate-500 dark:text-slate-400">
                    Geração automática baseada em extração de faturas PDF
                </p>
            </div>

            {/* Etapa 1: Seleção */}
            {etapa === 'selecao' && (
                <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                        Configuração
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Usina
                            </label>
                            <select
                                value={usinaId || ''}
                                onChange={(e) => setUsinaId(e.target.value ? Number(e.target.value) : null)}
                                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
                            >
                                <option value="">Selecione...</option>
                                {usinas.map(usina => (
                                    <option key={usina.id} value={usina.id}>{usina.nome}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Mês
                            </label>
                            <select
                                value={mes}
                                onChange={(e) => setMes(Number(e.target.value))}
                                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
                            >
                                {meses.map((m, idx) => (
                                    <option key={idx} value={idx + 1}>{m}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Ano
                            </label>
                            <select
                                value={ano}
                                onChange={(e) => setAno(Number(e.target.value))}
                                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
                            >
                                {anos.map(a => (
                                    <option key={a} value={a}>{a}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6">
                        <h3 className="font-medium text-blue-900 dark:text-blue-300 mb-2">Como funciona:</h3>
                        <ol className="text-sm text-blue-700 dark:text-blue-300 space-y-1 list-decimal list-inside">
                            <li>Extrai dados das faturas PDF usando Python (OCR + Regex)</li>
                            <li>Detecta automaticamente modelo GD I ou GD II</li>
                            <li>Calcula cobranças com 30% de desconto</li>
                            <li>Gera relatórios HTML profissionais</li>
                            <li>Salva como RASCUNHO para revisão antes de enviar</li>
                        </ol>
                    </div>

                    <button
                        onClick={handleExtrairEGerar}
                        disabled={!usinaId || loading}
                        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                        <Zap size={20} />
                        Extrair Faturas e Gerar Cobranças
                    </button>
                </div>
            )}

            {/* Etapa 2: Extraindo */}
            {etapa === 'extraindo' && (
                <div className="bg-white dark:bg-slate-800 rounded-xl p-8 border border-slate-200 dark:border-slate-700 text-center">
                    <Loader2 className="w-16 h-16 text-blue-500 animate-spin mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                        Extraindo dados das faturas...
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400">
                        Processando PDFs com Python (pdfplumber + tesseract OCR)
                    </p>
                </div>
            )}

            {/* Etapa 3: Gerando */}
            {etapa === 'gerando' && (
                <div className="bg-white dark:bg-slate-800 rounded-xl p-8 border border-slate-200 dark:border-slate-700">
                    <div className="text-center mb-6">
                        <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                            Extração concluída!
                        </h2>
                        {resultadoExtracao && (
                            <div className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
                                <p>✓ {resultadoExtracao.sucesso} faturas extraídas com sucesso</p>
                                {resultadoExtracao.erro > 0 && (
                                    <p className="text-red-500">✗ {resultadoExtracao.erro} com erro</p>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="text-center">
                        <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
                        <h3 className="font-semibold text-slate-900 dark:text-white mb-2">
                            Gerando cobranças...
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Calculando valores com desconto de 30%
                        </p>
                    </div>
                </div>
            )}

            {/* Etapa 4: Concluído */}
            {etapa === 'concluido' && (
                <>
                    {/* Resumo */}
                    <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-xl p-6 border border-green-200 dark:border-green-800">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                                <CheckCircle2 className="text-white" size={24} />
                            </div>
                            <div className="flex-1">
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                                    Processo Concluído!
                                </h2>
                                {resultadoGeracao && (
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                        <div>
                                            <p className="text-slate-600 dark:text-slate-400">Total</p>
                                            <p className="text-lg font-bold text-slate-900 dark:text-white">
                                                {resultadoGeracao.total}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-green-600 dark:text-green-400">Sucesso</p>
                                            <p className="text-lg font-bold text-green-600 dark:text-green-400">
                                                {resultadoGeracao.sucesso}
                                            </p>
                                        </div>
                                        {resultadoGeracao.ja_existentes > 0 && (
                                            <div>
                                                <p className="text-blue-600 dark:text-blue-400">Já existiam</p>
                                                <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                                                    {resultadoGeracao.ja_existentes}
                                                </p>
                                            </div>
                                        )}
                                        {resultadoGeracao.erro > 0 && (
                                            <div>
                                                <p className="text-red-600 dark:text-red-400">Erros</p>
                                                <p className="text-lg font-bold text-red-600 dark:text-red-400">
                                                    {resultadoGeracao.erro}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Cobranças Geradas */}
                    {cobrancasGeradas.length > 0 && (
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                                <div>
                                    <h3 className="font-semibold text-slate-900 dark:text-white">
                                        Cobranças em Rascunho ({cobrancasGeradas.length})
                                    </h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        Revise e aprove antes de enviar aos beneficiários
                                    </p>
                                </div>
                                <button
                                    onClick={() => handleAprovarTodas(false)}
                                    className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
                                >
                                    <Send size={18} />
                                    Aprovar Todas
                                </button>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-slate-50 dark:bg-slate-900">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                                                Beneficiário
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                                                Modelo GD
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                                                Valor
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                                                Economia
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                                                Vencimento
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                                                Ações
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                        {cobrancasGeradas.map((cobranca) => (
                                            <tr key={cobranca.id} className="hover:bg-slate-50 dark:hover:bg-slate-900">
                                                <td className="px-4 py-4 text-sm text-slate-900 dark:text-white">
                                                    {cobranca.beneficiario?.nome || `Beneficiário #${cobranca.beneficiario_id}`}
                                                </td>
                                                <td className="px-4 py-4">
                                                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                                                        cobranca.tipo_modelo_gd === 'GDI'
                                                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                                            : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                                                    }`}>
                                                        {cobranca.tipo_modelo_gd || 'N/A'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 font-medium text-slate-900 dark:text-white">
                                                    {formatCurrency(cobranca.valor_total)}
                                                </td>
                                                <td className="px-4 py-4 font-medium text-green-600 dark:text-green-400">
                                                    {formatCurrency(cobranca.economia_mes)}
                                                </td>
                                                <td className="px-4 py-4">
                                                    {vencimentoEditando === `${cobranca.id}` ? (
                                                        <div className="flex gap-2">
                                                            <input
                                                                type="date"
                                                                defaultValue={cobranca.vencimento?.split('T')[0]}
                                                                id={`vencimento-${cobranca.id}`}
                                                                className="px-2 py-1 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded"
                                                            />
                                                            <button
                                                                onClick={() => {
                                                                    const input = document.getElementById(`vencimento-${cobranca.id}`) as HTMLInputElement;
                                                                    if (input?.value) {
                                                                        handleEditarVencimento(cobranca.id, input.value);
                                                                    }
                                                                }}
                                                                className="px-2 py-1 text-xs bg-blue-500 text-white rounded"
                                                            >
                                                                OK
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => setVencimentoEditando(`${cobranca.id}`)}
                                                            className="text-sm text-slate-600 dark:text-slate-300 hover:text-blue-500 flex items-center gap-1"
                                                        >
                                                            <Calendar size={14} />
                                                            {cobranca.vencimento ? new Date(cobranca.vencimento).toLocaleDateString('pt-BR') : 'N/A'}
                                                        </button>
                                                    )}
                                                </td>
                                                <td className="px-4 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => handleVisualizarRelatorio(cobranca)}
                                                            className="px-3 py-1 text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50"
                                                        >
                                                            <Eye size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleAprovar(cobranca.id, false)}
                                                            className="px-3 py-1 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600"
                                                        >
                                                            Aprovar
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    <div className="flex gap-3">
                        <button
                            onClick={() => {
                                setEtapa('selecao');
                                setResultadoExtracao(null);
                                setResultadoGeracao(null);
                                setCobrancasGeradas([]);
                            }}
                            className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600"
                        >
                            Gerar Novas Cobranças
                        </button>
                    </div>
                </>
            )}

            {/* Modal Visualizar Relatório */}
            {cobrancaSelecionada && htmlRelatorio && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                Relatório - {cobrancaSelecionada.beneficiario?.nome}
                            </h2>
                            <button
                                onClick={() => {
                                    setCobrancaSelecionada(null);
                                    setHtmlRelatorio(null);
                                }}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-2xl"
                            >
                                ×
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-4">
                            <div dangerouslySetInnerHTML={{ __html: htmlRelatorio }} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default CobrancasAutomaticas;
