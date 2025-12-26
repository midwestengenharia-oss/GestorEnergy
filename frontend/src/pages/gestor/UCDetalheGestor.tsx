/**
 * UCDetalheGestor - Página de detalhes de uma UC para o Gestor
 * Versão melhorada com mais informações e histórico completo
 */

import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ucsApi } from '../../api/ucs';
import { faturasApi, downloadFaturaPdf } from '../../api/faturas';
import { beneficiariosApi } from '../../api/beneficiarios';
import type { UnidadeConsumidora, Fatura, Beneficiario } from '../../api/types';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    Legend
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
    Download,
    Building2,
    Eye,
    Gauge,
    Sun,
    DollarSign
} from 'lucide-react';

const COLORS = {
    primary: '#3B82F6',
    success: '#22C55E',
    warning: '#F59E0B',
    purple: '#8B5CF6'
};

interface Estatisticas {
    total_faturas: number;
    valor_total: number;
    consumo_total: number;
    media_mensal: number;
}

export function UCDetalheGestor() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [uc, setUc] = useState<UnidadeConsumidora | null>(null);
    const [faturas, setFaturas] = useState<Fatura[]>([]);
    const [beneficiario, setBeneficiario] = useState<Beneficiario | null>(null);
    const [estatisticas, setEstatisticas] = useState<Estatisticas | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [periodoGrafico, setPeriodoGrafico] = useState<'6m' | '12m' | '24m'>('12m');
    const [abaAtiva, setAbaAtiva] = useState<'info' | 'faturas' | 'gd'>('info');

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

            const [ucResponse, faturasResponse, estatisticasResponse] = await Promise.all([
                ucsApi.buscar(ucId),
                faturasApi.porUC(ucId),
                faturasApi.estatisticas(ucId).catch(() => ({ data: null }))
            ]);

            setUc(ucResponse.data);
            setFaturas(faturasResponse.data.faturas || []);
            setEstatisticas(estatisticasResponse.data);

            // Buscar beneficiário vinculado a esta UC
            try {
                const benefResponse = await beneficiariosApi.listar({ limit: 100 });
                const beneficiarios = benefResponse.data?.items || [];
                const benefVinculado = beneficiarios.find((b: Beneficiario) => b.uc_id === ucId);
                if (benefVinculado) {
                    setBeneficiario(benefVinculado);
                }
            } catch (e) {
                console.error('Erro ao buscar beneficiário:', e);
            }
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
    const isPendente = (fatura: Fatura) => {
        return fatura.situacao_pagamento === 'PENDENTE' ||
               fatura.situacao_pagamento === 'EM_ABERTO' ||
               !fatura.indicador_pagamento;
    };

    // Dados para gráfico de consumo mensal
    const dadosConsumoMensal = useMemo(() => {
        const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const limite = periodoGrafico === '6m' ? 6 : periodoGrafico === '12m' ? 12 : 24;

        const faturasAgrupadas = faturas.reduce((acc, f) => {
            const key = `${f.ano_referencia}-${String(f.mes_referencia).padStart(2, '0')}`;
            if (!acc[key]) {
                acc[key] = { consumo: 0, valor: 0, injetada: 0 };
            }
            acc[key].consumo += Number(f.consumo) || 0;
            acc[key].valor += Number(f.valor_fatura) || 0;
            // Tentar extrair energia injetada dos dados extraídos
            const dados = f.dados_extraidos as any;
            if (dados?.itens_fatura) {
                const ouc = dados.itens_fatura['energia_injetada oUC'] || dados.itens_fatura['energia_injetada_ouc'] || [];
                const muc = dados.itens_fatura['energia_injetada mUC'] || dados.itens_fatura['energia_injetada_muc'] || [];
                const totalInjetada = [...ouc, ...muc].reduce((sum: number, item: any) => sum + (item?.quantidade || 0), 0);
                acc[key].injetada += totalInjetada;
            }
            return acc;
        }, {} as Record<string, { consumo: number; valor: number; injetada: number }>);

        const resultado = [];
        const hoje = new Date();

        for (let i = limite - 1; i >= 0; i--) {
            const data = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
            const key = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
            const dados = faturasAgrupadas[key] || { consumo: 0, valor: 0, injetada: 0 };

            resultado.push({
                mes: meses[data.getMonth()],
                ano: data.getFullYear(),
                consumo: dados.consumo,
                valor: dados.valor,
                injetada: dados.injetada
            });
        }

        return resultado;
    }, [faturas, periodoGrafico]);

    // Calcular economia GD total
    const economiaGD = useMemo(() => {
        let totalInjetada = 0;
        let totalEconomia = 0;

        faturas.forEach(f => {
            const dados = f.dados_extraidos as any;
            if (dados?.itens_fatura) {
                const ouc = dados.itens_fatura['energia_injetada oUC'] || dados.itens_fatura['energia_injetada_ouc'] || [];
                const muc = dados.itens_fatura['energia_injetada mUC'] || dados.itens_fatura['energia_injetada_muc'] || [];
                [...ouc, ...muc].forEach((item: any) => {
                    totalInjetada += item?.quantidade || 0;
                    totalEconomia += Math.abs(item?.valor || 0);
                });
            }
        });

        return { totalInjetada, totalEconomia };
    }, [faturas]);

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
                        onClick={() => navigate('/app/gestor/ucs')}
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
                    onClick={() => navigate('/app/gestor/ucs')}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
                >
                    <ArrowLeft className="text-slate-600 dark:text-slate-300" size={24} />
                </button>
                <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
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
                            <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-sm rounded-full flex items-center gap-1">
                                <Sun size={14} />
                                Geradora
                            </span>
                        )}
                    </div>
                    <p className="text-slate-500 dark:text-slate-400">
                        Detalhes e histórico da unidade consumidora
                    </p>
                </div>
                <button
                    onClick={fetchData}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50"
                >
                    <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    Atualizar
                </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
                        <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center">
                            <Sun className="text-yellow-600 dark:text-yellow-400" size={20} />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Energia Injetada</p>
                            <p className="text-xl font-bold text-slate-900 dark:text-white">
                                {economiaGD.totalInjetada.toFixed(0)} kWh
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
                            <DollarSign className="text-emerald-600 dark:text-emerald-400" size={20} />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Economia GD</p>
                            <p className="text-xl font-bold text-slate-900 dark:text-white">
                                {formatarValor(economiaGD.totalEconomia)}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Abas */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="border-b border-slate-200 dark:border-slate-700">
                    <div className="flex gap-4 px-4">
                        {[
                            { id: 'info', label: 'Informações', icon: MapPin },
                            { id: 'faturas', label: 'Histórico de Faturas', icon: FileText },
                            { id: 'gd', label: 'Geração Distribuída', icon: Sun }
                        ].map((aba) => (
                            <button
                                key={aba.id}
                                onClick={() => setAbaAtiva(aba.id as any)}
                                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition ${
                                    abaAtiva === aba.id
                                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                        : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                }`}
                            >
                                <aba.icon size={18} />
                                {aba.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="p-4">
                    {/* Aba Informações */}
                    {abaAtiva === 'info' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Dados da UC */}
                            <div className="space-y-4">
                                <h3 className="font-semibold text-slate-900 dark:text-white">Dados da UC</h3>

                                <div className="flex items-start gap-3">
                                    <MapPin className="text-slate-400 mt-0.5" size={20} />
                                    <div>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Endereço</p>
                                        <p className="text-slate-900 dark:text-white">{formatarEnderecoCompleto(uc)}</p>
                                    </div>
                                </div>

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

                            {/* Beneficiário Vinculado */}
                            <div className="space-y-4">
                                <h3 className="font-semibold text-slate-900 dark:text-white">Beneficiário Vinculado</h3>

                                {beneficiario ? (
                                    <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                                                    <User className="text-green-600 dark:text-green-400" size={20} />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-slate-900 dark:text-white">
                                                        {beneficiario.nome || 'Não informado'}
                                                    </p>
                                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                                        {beneficiario.cpf}
                                                    </p>
                                                </div>
                                            </div>
                                            <span className={`px-2 py-1 text-xs rounded-full ${
                                                beneficiario.status === 'ATIVO'
                                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                                                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                            }`}>
                                                {beneficiario.status}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-200 dark:border-slate-700">
                                            {beneficiario.email && (
                                                <div>
                                                    <p className="text-sm text-slate-500 dark:text-slate-400">Email</p>
                                                    <p className="text-sm text-slate-900 dark:text-white">{beneficiario.email}</p>
                                                </div>
                                            )}
                                            {beneficiario.telefone && (
                                                <div>
                                                    <p className="text-sm text-slate-500 dark:text-slate-400">Telefone</p>
                                                    <p className="text-sm text-slate-900 dark:text-white">{beneficiario.telefone}</p>
                                                </div>
                                            )}
                                            {beneficiario.economia_acumulada !== undefined && (
                                                <div>
                                                    <p className="text-sm text-slate-500 dark:text-slate-400">Economia Acumulada</p>
                                                    <p className="text-sm font-medium text-green-600 dark:text-green-400">
                                                        {formatarValor(beneficiario.economia_acumulada)}
                                                    </p>
                                                </div>
                                            )}
                                            {beneficiario.percentual_rateio !== undefined && (
                                                <div>
                                                    <p className="text-sm text-slate-500 dark:text-slate-400">Rateio</p>
                                                    <p className="text-sm text-slate-900 dark:text-white">
                                                        {beneficiario.percentual_rateio}%
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        <button
                                            onClick={() => navigate(`/app/gestor/clientes/${beneficiario.id}`)}
                                            className="flex items-center gap-2 text-sm text-blue-500 hover:text-blue-600 transition"
                                        >
                                            Ver perfil completo
                                            <ChevronRight size={16} />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 text-center">
                                        <User className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                                        <p className="text-slate-500 dark:text-slate-400">Nenhum beneficiário vinculado</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Aba Faturas */}
                    {abaAtiva === 'faturas' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="font-semibold text-slate-900 dark:text-white">
                                    Histórico de Faturas ({faturas.length})
                                </h3>
                                <Link
                                    to="/app/gestor/faturas"
                                    className="flex items-center gap-1 text-sm text-blue-500 hover:text-blue-600 transition"
                                >
                                    Ver todas as faturas
                                    <ChevronRight size={16} />
                                </Link>
                            </div>

                            {faturas.length === 0 ? (
                                <div className="p-8 text-center">
                                    <FileText className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                                    <p className="text-slate-500 dark:text-slate-400">Nenhuma fatura encontrada</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-slate-50 dark:bg-slate-900">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                                                    Referência
                                                </th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                                                    Vencimento
                                                </th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                                                    Consumo
                                                </th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                                                    Leitura
                                                </th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                                                    Injetada
                                                </th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                                                    Bandeira
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
                                            {faturas.map((fatura) => {
                                                const pendente = isPendente(fatura);
                                                const dados = fatura.dados_extraidos as any;

                                                // Calcular energia injetada
                                                let injetadaTotal = 0;
                                                if (dados?.itens_fatura) {
                                                    const ouc = dados.itens_fatura['energia_injetada oUC'] || dados.itens_fatura['energia_injetada_ouc'] || [];
                                                    const muc = dados.itens_fatura['energia_injetada mUC'] || dados.itens_fatura['energia_injetada_muc'] || [];
                                                    injetadaTotal = [...ouc, ...muc].reduce((sum: number, item: any) => sum + (item?.quantidade || 0), 0);
                                                }

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
                                                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                                                            {fatura.leitura_anterior && fatura.leitura_atual
                                                                ? `${fatura.leitura_anterior} → ${fatura.leitura_atual}`
                                                                : '-'}
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                                                            {injetadaTotal > 0 ? `${injetadaTotal} kWh` : '-'}
                                                        </td>
                                                        <td className="px-4 py-3 text-sm">
                                                            {fatura.bandeira_tarifaria ? (
                                                                <span className={`px-2 py-1 rounded text-xs capitalize ${
                                                                    fatura.bandeira_tarifaria.toLowerCase().includes('verde')
                                                                        ? 'bg-green-100 dark:bg-green-900/30 text-green-600'
                                                                        : fatura.bandeira_tarifaria.toLowerCase().includes('amarela')
                                                                        ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600'
                                                                        : 'bg-red-100 dark:bg-red-900/30 text-red-600'
                                                                }`}>
                                                                    {fatura.bandeira_tarifaria.toLowerCase()}
                                                                </span>
                                                            ) : '-'}
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
                    )}

                    {/* Aba Geração Distribuída */}
                    {abaAtiva === 'gd' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <h3 className="font-semibold text-slate-900 dark:text-white">
                                    Histórico de Geração Distribuída
                                </h3>
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

                            {/* Gráfico Consumo vs Injetada */}
                            <div className="h-80">
                                {dadosConsumoMensal.every(d => d.consumo === 0 && d.injetada === 0) ? (
                                    <div className="flex items-center justify-center h-full">
                                        <div className="text-center">
                                            <TrendingUp className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                                            <p className="text-slate-500 dark:text-slate-400">Sem dados de consumo/geração</p>
                                        </div>
                                    </div>
                                ) : (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={dadosConsumoMensal}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                                            <XAxis dataKey="mes" stroke="#94A3B8" fontSize={12} />
                                            <YAxis stroke="#94A3B8" fontSize={12} />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: '#1E293B',
                                                    border: 'none',
                                                    borderRadius: '12px'
                                                }}
                                                labelStyle={{ color: '#F8FAFC' }}
                                                formatter={(value: number, name: string) => {
                                                    if (name === 'consumo') return [`${value} kWh`, 'Consumo'];
                                                    if (name === 'injetada') return [`${value} kWh`, 'Energia Injetada'];
                                                    return [value, name];
                                                }}
                                            />
                                            <Legend />
                                            <Bar dataKey="consumo" name="Consumo" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
                                            <Bar dataKey="injetada" name="Energia Injetada" fill={COLORS.success} radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </div>

                            {/* Resumo GD */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4">
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Saldo Acumulado</p>
                                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                        {(uc.saldo_acumulado || 0).toFixed(0)} kWh
                                    </p>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4">
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Total Energia Injetada</p>
                                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                                        {economiaGD.totalInjetada.toFixed(0)} kWh
                                    </p>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4">
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Economia Total</p>
                                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                                        {formatarValor(economiaGD.totalEconomia)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default UCDetalheGestor;
