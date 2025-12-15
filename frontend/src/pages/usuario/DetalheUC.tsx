/**
 * DetalheUC - Página de detalhes de uma Unidade Consumidora
 */

import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ucsApi } from '../../api/ucs';
import { faturasApi, downloadFaturaPdf } from '../../api/faturas';
import type { UnidadeConsumidora, Fatura } from '../../api/types';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import {
    Zap,
    ArrowLeft,
    Loader2,
    RefreshCw,
    AlertCircle,
    MapPin,
    User,
    FileText,
    TrendingUp,
    Calendar,
    CheckCircle,
    XCircle,
    ChevronRight,
    Download
} from 'lucide-react';

// Cores para gráficos
const COLORS = {
    primary: '#3B82F6',
    success: '#22C55E'
};

interface Estatisticas {
    total_faturas: number;
    valor_total: number;
    consumo_total: number;
    media_mensal: number;
}

interface ComparativoMensal {
    mes: number;
    ano: number;
    consumo: number;
    valor: number;
}

export function DetalheUC() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { usuario } = useAuth();

    const [uc, setUc] = useState<UnidadeConsumidora | null>(null);
    const [faturas, setFaturas] = useState<Fatura[]>([]);
    const [estatisticas, setEstatisticas] = useState<Estatisticas | null>(null);
    const [comparativo, setComparativo] = useState<ComparativoMensal[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [periodoGrafico, setPeriodoGrafico] = useState<'6m' | '12m' | '24m'>('12m');

    useEffect(() => {
        if (id) {
            fetchData();
        }
    }, [id]);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);

            const ucId = Number(id);

            const [ucResponse, faturasResponse, estatisticasResponse, comparativoResponse] = await Promise.all([
                ucsApi.buscar(ucId),
                faturasApi.porUC(ucId),
                faturasApi.estatisticas(ucId).catch(() => ({ data: null })),
                faturasApi.comparativo(ucId).catch(() => ({ data: [] }))
            ]);

            setUc(ucResponse.data);
            setFaturas(faturasResponse.data.faturas || []);
            setEstatisticas(estatisticasResponse.data);
            setComparativo(comparativoResponse.data || []);
        } catch (err: any) {
            console.error('Erro ao carregar UC:', err);
            setError(err.response?.data?.detail || 'Erro ao carregar detalhes da UC');
        } finally {
            setLoading(false);
        }
    };

    // Formatar código da UC
    const formatarCodigoUC = (uc: UnidadeConsumidora) => {
        return `${uc.cod_empresa}/${uc.cdc}-${uc.digito_verificador}`;
    };

    // Formatar endereço completo
    const formatarEnderecoCompleto = (uc: UnidadeConsumidora) => {
        const partes = [];
        if (uc.endereco) partes.push(uc.endereco);
        if (uc.numero_imovel) partes.push(uc.numero_imovel);
        if (uc.complemento) partes.push(uc.complemento);
        if (uc.bairro) partes.push(uc.bairro);
        if (uc.cidade && uc.uf) partes.push(`${uc.cidade}/${uc.uf}`);
        if (uc.cep) partes.push(`CEP: ${uc.cep}`);
        return partes.length > 0 ? partes.join(', ') : 'Endereço não informado';
    };

    // Formatar mês/ano
    const formatarReferencia = (fatura: Fatura) => {
        const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        return `${meses[fatura.mes_referencia - 1]}/${fatura.ano_referencia}`;
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

    // Calcular valor máximo para gráfico
    const maxConsumo = Math.max(...comparativo.map(c => c.consumo || 0), 1);

    // Dados para gráfico de consumo mensal (recharts)
    const dadosConsumoMensal = useMemo(() => {
        const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const limite = periodoGrafico === '6m' ? 6 : periodoGrafico === '12m' ? 12 : 24;

        // Agrupa faturas por mês/ano
        const faturasAgrupadas = faturas.reduce((acc, f) => {
            const key = `${f.ano_referencia}-${String(f.mes_referencia).padStart(2, '0')}`;
            if (!acc[key]) {
                acc[key] = { consumo: 0, valor: 0, count: 0 };
            }
            acc[key].consumo += Number(f.consumo) || 0;
            acc[key].valor += Number(f.valor_fatura) || 0;
            acc[key].count += 1;
            return acc;
        }, {} as Record<string, { consumo: number; valor: number; count: number }>);

        // Gera os últimos N meses
        const resultado = [];
        const hoje = new Date();

        for (let i = limite - 1; i >= 0; i--) {
            const data = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
            const key = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
            const dados = faturasAgrupadas[key] || { consumo: 0, valor: 0, count: 0 };

            resultado.push({
                mes: meses[data.getMonth()],
                ano: data.getFullYear(),
                consumo: dados.consumo,
                valor: dados.valor
            });
        }

        return resultado;
    }, [faturas, periodoGrafico]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
                    <p className="text-slate-500 dark:text-slate-400">Carregando detalhes...</p>
                </div>
            </div>
        );
    }

    if (error || !uc) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
                    <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Erro ao carregar</h2>
                <p className="text-slate-500 dark:text-slate-400 mb-4">{error || 'UC não encontrada'}</p>
                <div className="flex gap-3">
                    <button
                        onClick={() => navigate('/app/usuario/ucs')}
                        className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                    >
                        <ArrowLeft size={18} />
                        Voltar
                    </button>
                    <button
                        onClick={fetchData}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                    >
                        <RefreshCw size={18} />
                        Tentar novamente
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate('/app/usuario/ucs')}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
                >
                    <ArrowLeft className="text-slate-600 dark:text-slate-300" size={24} />
                </button>
                <div className="flex-1">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                            UC {formatarCodigoUC(uc)}
                        </h1>
                        <span className={`px-2 py-1 text-sm font-medium rounded-full ${
                            uc.uc_ativa
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                        }`}>
                            {uc.uc_ativa ? 'Ativa' : 'Inativa'}
                        </span>
                        {uc.is_geradora && (
                            <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-sm rounded-full">
                                Geradora
                            </span>
                        )}
                    </div>
                    <p className="text-slate-500 dark:text-slate-400">
                        Detalhes e histórico da unidade consumidora
                    </p>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                            <FileText className="text-blue-600 dark:text-blue-400" size={20} />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Total Faturas</p>
                            <p className="text-xl font-bold text-slate-900 dark:text-white">
                                {estatisticas?.total_faturas || faturas.length}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                            <TrendingUp className="text-green-600 dark:text-green-400" size={20} />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Consumo Total</p>
                            <p className="text-xl font-bold text-slate-900 dark:text-white">
                                {estatisticas?.consumo_total || 0} kWh
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                            <Calendar className="text-purple-600 dark:text-purple-400" size={20} />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Média Mensal</p>
                            <p className="text-xl font-bold text-slate-900 dark:text-white">
                                {(Number(estatisticas?.media_mensal) || 0).toFixed(0)} kWh
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                            <Zap className="text-orange-600 dark:text-orange-400" size={20} />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Valor Total</p>
                            <p className="text-xl font-bold text-slate-900 dark:text-white">
                                {formatarValor(estatisticas?.valor_total || 0)}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Informações da UC */}
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                        <h2 className="font-semibold text-slate-900 dark:text-white">Informações da UC</h2>
                    </div>
                    <div className="p-4 space-y-4">
                        {/* Endereço */}
                        <div className="flex items-start gap-3">
                            <MapPin className="text-slate-400 mt-0.5" size={20} />
                            <div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Endereço</p>
                                <p className="text-slate-900 dark:text-white">{formatarEnderecoCompleto(uc)}</p>
                            </div>
                        </div>

                        {/* Titular */}
                        {uc.nome_titular && (
                            <div className="flex items-start gap-3">
                                <User className="text-slate-400 mt-0.5" size={20} />
                                <div>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Titular</p>
                                    <p className="text-slate-900 dark:text-white">{uc.nome_titular}</p>
                                    {uc.cpf_cnpj_titular && (
                                        <p className="text-sm text-slate-500 dark:text-slate-400">{uc.cpf_cnpj_titular}</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Informações técnicas */}
                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                            {uc.tipo_ligacao && (
                                <div>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Tipo de Ligação</p>
                                    <p className="font-medium text-slate-900 dark:text-white">{uc.tipo_ligacao}</p>
                                </div>
                            )}
                            {uc.classe_leitura && (
                                <div>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Classe</p>
                                    <p className="font-medium text-slate-900 dark:text-white">{uc.classe_leitura}</p>
                                </div>
                            )}
                            {uc.grupo_leitura && (
                                <div>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Grupo</p>
                                    <p className="font-medium text-slate-900 dark:text-white">{uc.grupo_leitura}</p>
                                </div>
                            )}
                            <div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Contrato</p>
                                <p className="font-medium text-slate-900 dark:text-white">
                                    {uc.contrato_ativo ? 'Ativo' : 'Inativo'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Gráfico de Consumo - Interativo com Recharts */}
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                        <h2 className="font-semibold text-slate-900 dark:text-white">Histórico de Consumo</h2>
                        <div className="flex gap-2">
                            {(['6m', '12m', '24m'] as const).map((periodo) => (
                                <button
                                    key={periodo}
                                    onClick={() => setPeriodoGrafico(periodo)}
                                    className={`px-3 py-1 rounded-lg text-sm font-medium transition ${
                                        periodoGrafico === periodo
                                            ? 'bg-blue-500 text-white'
                                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                                    }`}
                                >
                                    {periodo}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="p-4">
                        {dadosConsumoMensal.every(d => d.consumo === 0) ? (
                            <div className="text-center py-8">
                                <TrendingUp className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                                <p className="text-slate-500 dark:text-slate-400">Sem dados de consumo</p>
                            </div>
                        ) : (
                            <div className="h-72 min-h-[288px]">
                                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                    <AreaChart data={dadosConsumoMensal}>
                                        <defs>
                                            <linearGradient id="colorConsumoUC" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3}/>
                                                <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                                        <XAxis dataKey="mes" stroke="#94A3B8" fontSize={12} />
                                        <YAxis stroke="#94A3B8" fontSize={12} />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: '#1E293B',
                                                border: 'none',
                                                borderRadius: '12px',
                                                boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
                                            }}
                                            labelStyle={{ color: '#F8FAFC' }}
                                            itemStyle={{ color: '#F8FAFC' }}
                                            formatter={(value: number, name: string) => {
                                                if (name === 'consumo') return [`${value} kWh`, 'Consumo'];
                                                if (name === 'valor') return [`R$ ${(Number(value) || 0).toFixed(2)}`, 'Valor'];
                                                return [value, name];
                                            }}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="consumo"
                                            stroke={COLORS.primary}
                                            strokeWidth={3}
                                            fillOpacity={1}
                                            fill="url(#colorConsumoUC)"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Histórico de Faturas */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <h2 className="font-semibold text-slate-900 dark:text-white">Histórico de Faturas</h2>
                    <Link
                        to="/app/usuario/faturas"
                        className="flex items-center gap-1 text-sm text-blue-500 hover:text-blue-600 transition"
                    >
                        Ver todas
                        <ChevronRight size={16} />
                    </Link>
                </div>

                {faturas.length === 0 ? (
                    <div className="p-8 text-center">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                            <FileText className="w-8 h-8 text-slate-400" />
                        </div>
                        <p className="text-slate-500 dark:text-slate-400">
                            Nenhuma fatura encontrada para esta UC
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50 dark:bg-slate-900">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        Referência
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
                                {faturas.slice(0, 12).map((fatura) => {
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
                                                {fatura.pdf_base64 && (
                                                    <button
                                                        onClick={() => downloadFaturaPdf(fatura)}
                                                        className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition"
                                                        title="Baixar PDF"
                                                    >
                                                        <Download size={16} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

export default DetalheUC;
