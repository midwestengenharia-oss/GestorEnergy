/**
 * BeneficiariosGestor - Gestão de Beneficiários do Gestor
 */

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usinasApi } from '../../api/usinas';
import { beneficiariosApi } from '../../api/beneficiarios';
import type { Usina, Beneficiario } from '../../api/types';
import {
    Users,
    Search,
    Filter,
    Plus,
    Edit2,
    Trash2,
    Loader2,
    RefreshCw,
    AlertCircle,
    Building2,
    Mail,
    Phone,
    CheckCircle,
    XCircle,
    Percent,
    CreditCard,
    UserCheck
} from 'lucide-react';

export function BeneficiariosGestor() {
    const [searchParams, setSearchParams] = useSearchParams();
    const usinaIdParam = searchParams.get('usina');

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [usinas, setUsinas] = useState<Usina[]>([]);
    const [beneficiarios, setBeneficiarios] = useState<Beneficiario[]>([]);
    const [usinaFiltro, setUsinaFiltro] = useState<number | null>(usinaIdParam ? Number(usinaIdParam) : null);
    const [statusFiltro, setStatusFiltro] = useState<string>('todos');
    const [busca, setBusca] = useState('');

    // Modal
    const [modalAberto, setModalAberto] = useState(false);
    const [beneficiarioEditando, setBeneficiarioEditando] = useState<Beneficiario | null>(null);
    const [salvando, setSalvando] = useState(false);
    const [cpfEditando, setCpfEditando] = useState('');
    const [salvandoCpf, setSalvandoCpf] = useState(false);

    useEffect(() => {
        fetchUsinas();
    }, []);

    useEffect(() => {
        // Só busca beneficiários quando usinas já foram carregadas
        // ou quando há um filtro de usina específico
        if (usinas.length > 0 || usinaFiltro) {
            fetchBeneficiarios();
        }
    }, [usinaFiltro, usinas]);

    const fetchUsinas = async () => {
        try {
            const response = await usinasApi.minhas();
            setUsinas(response.data || []);
        } catch (err) {
            console.error('Erro ao carregar usinas:', err);
        }
    };

    const fetchBeneficiarios = async () => {
        try {
            setLoading(true);
            setError(null);

            if (usinaFiltro) {
                const response = await beneficiariosApi.porUsina(usinaFiltro);
                // O backend retorna { beneficiarios: [...], total: ..., ... }
                const benefData = response.data?.beneficiarios || response.data || [];
                setBeneficiarios(Array.isArray(benefData) ? benefData : []);
            } else {
                // Busca beneficiários de todas as usinas
                let allBeneficiarios: Beneficiario[] = [];
                for (const usina of usinas) {
                    try {
                        const response = await beneficiariosApi.porUsina(usina.id);
                        // O backend retorna { beneficiarios: [...], total: ..., ... }
                        const benefData = response.data?.beneficiarios || response.data || [];
                        allBeneficiarios = [...allBeneficiarios, ...(Array.isArray(benefData) ? benefData : [])];
                    } catch (e) {
                        console.error(`Erro ao buscar beneficiários da usina ${usina.id}:`, e);
                    }
                }
                setBeneficiarios(allBeneficiarios);
            }
        } catch (err: any) {
            console.error('Erro ao carregar beneficiários:', err);
            setError(err.response?.data?.detail || 'Erro ao carregar beneficiários');
        } finally {
            setLoading(false);
        }
    };

    const handleUsinaChange = (usinaId: string) => {
        const id = usinaId ? Number(usinaId) : null;
        setUsinaFiltro(id);
        if (id) {
            setSearchParams({ usina: String(id) });
        } else {
            setSearchParams({});
        }
    };

    const handleAtivar = async (beneficiario: Beneficiario) => {
        try {
            await beneficiariosApi.ativar(beneficiario.id);
            fetchBeneficiarios();
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Erro ao ativar beneficiário');
        }
    };

    const handleSuspender = async (beneficiario: Beneficiario) => {
        const motivo = prompt('Informe o motivo da suspensão:');
        if (!motivo) return;

        try {
            await beneficiariosApi.suspender(beneficiario.id, motivo);
            fetchBeneficiarios();
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Erro ao suspender beneficiário');
        }
    };

    const handleEditar = (beneficiario: Beneficiario) => {
        setBeneficiarioEditando(beneficiario);
        setCpfEditando(beneficiario.cpf || '');
        setModalAberto(true);
    };

    const handleSalvarCpf = async () => {
        if (!beneficiarioEditando || !cpfEditando) return;

        // Remover formatação do CPF
        const cpfLimpo = cpfEditando.replace(/\D/g, '');
        if (cpfLimpo.length !== 11) {
            alert('CPF deve ter 11 dígitos');
            return;
        }

        try {
            setSalvandoCpf(true);
            await beneficiariosApi.atualizarCpf(beneficiarioEditando.id, cpfLimpo);
            alert('CPF atualizado com sucesso! Se já existir um usuário com este CPF, o beneficiário será vinculado automaticamente.');
            setModalAberto(false);
            setBeneficiarioEditando(null);
            fetchBeneficiarios();
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Erro ao atualizar CPF');
        } finally {
            setSalvandoCpf(false);
        }
    };

    const formatarCpf = (cpf: string) => {
        const numeros = cpf.replace(/\D/g, '');
        if (numeros.length <= 3) return numeros;
        if (numeros.length <= 6) return `${numeros.slice(0, 3)}.${numeros.slice(3)}`;
        if (numeros.length <= 9) return `${numeros.slice(0, 3)}.${numeros.slice(3, 6)}.${numeros.slice(6)}`;
        return `${numeros.slice(0, 3)}.${numeros.slice(3, 6)}.${numeros.slice(6, 9)}-${numeros.slice(9, 11)}`;
    };

    const handleSalvar = async (dados: any) => {
        try {
            setSalvando(true);
            if (beneficiarioEditando) {
                await beneficiariosApi.atualizar(beneficiarioEditando.id, dados);
            }
            setModalAberto(false);
            setBeneficiarioEditando(null);
            fetchBeneficiarios();
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Erro ao salvar');
        } finally {
            setSalvando(false);
        }
    };

    // Filtrar beneficiários
    const beneficiariosFiltrados = beneficiarios.filter(beneficiario => {
        // Filtro por status
        if (statusFiltro !== 'todos' && beneficiario.status !== statusFiltro) {
            return false;
        }

        // Filtro por busca
        if (busca) {
            const termo = busca.toLowerCase();
            const nome = (beneficiario.nome || beneficiario.usuario?.nome_completo || '').toLowerCase();
            const email = (beneficiario.email || beneficiario.usuario?.email || '').toLowerCase();
            return nome.includes(termo) || email.includes(termo);
        }

        return true;
    });

    // Calcular total de percentual por usina
    const totalPercentual = beneficiariosFiltrados.reduce((acc, b) => acc + (Number(b.percentual_rateio) || 0), 0);

    if (loading && usinas.length === 0) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
                    <p className="text-slate-500 dark:text-slate-400">Carregando beneficiários...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        Beneficiários
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        Gerencie os beneficiários das suas usinas
                    </p>
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
                            placeholder="Buscar por nome ou email..."
                            value={busca}
                            onChange={(e) => setBusca(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-900 dark:text-white"
                        />
                    </div>

                    {/* Filtro por Usina */}
                    <select
                        value={usinaFiltro || ''}
                        onChange={(e) => handleUsinaChange(e.target.value)}
                        className="px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-900 dark:text-white"
                    >
                        <option value="">Todas as Usinas</option>
                        {usinas.map(usina => (
                            <option key={usina.id} value={usina.id}>{usina.nome}</option>
                        ))}
                    </select>

                    {/* Filtro por Status */}
                    <select
                        value={statusFiltro}
                        onChange={(e) => setStatusFiltro(e.target.value)}
                        className="px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-900 dark:text-white"
                    >
                        <option value="todos">Todos os Status</option>
                        <option value="ativo">Ativos</option>
                        <option value="inativo">Inativos</option>
                        <option value="pendente">Pendentes</option>
                    </select>

                    <button
                        onClick={fetchBeneficiarios}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition"
                    >
                        <RefreshCw size={18} />
                    </button>
                </div>
            </div>

            {/* Resumo */}
            {usinaFiltro && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                                <Users className="text-blue-600 dark:text-blue-400" size={20} />
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Total</p>
                                <p className="text-xl font-bold text-slate-900 dark:text-white">
                                    {beneficiariosFiltrados.length}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                                <CheckCircle className="text-green-600 dark:text-green-400" size={20} />
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Ativos</p>
                                <p className="text-xl font-bold text-slate-900 dark:text-white">
                                    {beneficiariosFiltrados.filter(b => b.status === 'ativo').length}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                totalPercentual > 100
                                    ? 'bg-red-100 dark:bg-red-900/30'
                                    : totalPercentual === 100
                                    ? 'bg-green-100 dark:bg-green-900/30'
                                    : 'bg-yellow-100 dark:bg-yellow-900/30'
                            }`}>
                                <Percent className={
                                    totalPercentual > 100
                                        ? 'text-red-600 dark:text-red-400'
                                        : totalPercentual === 100
                                        ? 'text-green-600 dark:text-green-400'
                                        : 'text-yellow-600 dark:text-yellow-400'
                                } size={20} />
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Rateio Total</p>
                                <p className={`text-xl font-bold ${
                                    totalPercentual > 100
                                        ? 'text-red-600 dark:text-red-400'
                                        : totalPercentual === 100
                                        ? 'text-green-600 dark:text-green-400'
                                        : 'text-yellow-600 dark:text-yellow-400'
                                }`}>
                                    {totalPercentual.toFixed(1)}%
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Lista */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                    </div>
                ) : error ? (
                    <div className="p-8 text-center">
                        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                        <p className="text-slate-500 dark:text-slate-400">{error}</p>
                        <button
                            onClick={fetchBeneficiarios}
                            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                        >
                            Tentar novamente
                        </button>
                    </div>
                ) : beneficiariosFiltrados.length === 0 ? (
                    <div className="p-8 text-center">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Users className="w-8 h-8 text-slate-400" />
                        </div>
                        <p className="text-slate-500 dark:text-slate-400">
                            {busca ? 'Nenhum beneficiário encontrado' : 'Nenhum beneficiário cadastrado'}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50 dark:bg-slate-900">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        Beneficiário
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        CPF
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        Contato
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        Usina
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        Rateio
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        Vínculo
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
                                {beneficiariosFiltrados.map((beneficiario) => {
                                    const usina = usinas.find(u => u.id === beneficiario.usina_id);
                                    return (
                                        <tr key={beneficiario.id} className="hover:bg-slate-50 dark:hover:bg-slate-900">
                                            <td className="px-4 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
                                                        <Users className="text-slate-400" size={20} />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-slate-900 dark:text-white">
                                                            {beneficiario.nome || beneficiario.usuario?.nome_completo || 'Sem nome'}
                                                        </p>
                                                        {beneficiario.uc && (
                                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                                UC: {beneficiario.uc.uc_formatada}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                {beneficiario.cpf ? (
                                                    <span className="text-sm font-mono text-slate-600 dark:text-slate-300">
                                                        {formatarCpf(beneficiario.cpf)}
                                                    </span>
                                                ) : (
                                                    <span className="text-sm text-orange-500 italic">
                                                        Não informado
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="space-y-1">
                                                    {(beneficiario.email || beneficiario.usuario?.email) && (
                                                        <p className="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-1">
                                                            <Mail size={14} className="text-slate-400" />
                                                            {beneficiario.email || beneficiario.usuario?.email}
                                                        </p>
                                                    )}
                                                    {beneficiario.telefone && (
                                                        <p className="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-1">
                                                            <Phone size={14} className="text-slate-400" />
                                                            {beneficiario.telefone}
                                                        </p>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="flex items-center gap-2">
                                                    <Building2 className="text-slate-400" size={16} />
                                                    <span className="text-sm text-slate-600 dark:text-slate-300">
                                                        {usina?.nome || '-'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-16 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-blue-500 rounded-full"
                                                            style={{ width: `${Math.min(beneficiario.percentual_rateio || 0, 100)}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-sm font-medium text-slate-900 dark:text-white">
                                                        {beneficiario.percentual_rateio}%
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                {beneficiario.usuario_id ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                                                        <UserCheck size={12} />
                                                        Vinculado
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400">
                                                        <AlertCircle size={12} />
                                                        Pendente
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-4">
                                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                                                    beneficiario.status === 'ativo'
                                                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                                        : beneficiario.status === 'pendente'
                                                        ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                                                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                                                }`}>
                                                    {beneficiario.status === 'ativo' ? (
                                                        <CheckCircle size={12} />
                                                    ) : beneficiario.status === 'pendente' ? (
                                                        <AlertCircle size={12} />
                                                    ) : (
                                                        <XCircle size={12} />
                                                    )}
                                                    {beneficiario.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleEditar(beneficiario)}
                                                        className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
                                                        title="Editar"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    {beneficiario.status === 'ativo' ? (
                                                        <button
                                                            onClick={() => handleSuspender(beneficiario)}
                                                            className="p-2 text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition"
                                                            title="Suspender"
                                                        >
                                                            <XCircle size={16} />
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleAtivar(beneficiario)}
                                                            className="p-2 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition"
                                                            title="Ativar"
                                                        >
                                                            <CheckCircle size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal de Edição */}
            {modalAberto && beneficiarioEditando && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-md">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                Editar Beneficiário
                            </h2>
                            <button
                                onClick={() => {
                                    setModalAberto(false);
                                    setBeneficiarioEditando(null);
                                }}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-2xl"
                            >
                                ×
                            </button>
                        </div>
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                const formData = new FormData(e.currentTarget);
                                handleSalvar({
                                    percentual_rateio: Number(formData.get('percentual_rateio')),
                                    desconto: formData.get('desconto') ? Number(formData.get('desconto')) : undefined
                                });
                            }}
                            className="p-4 space-y-4"
                        >
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Nome
                                </label>
                                <input
                                    type="text"
                                    value={beneficiarioEditando.nome || beneficiarioEditando.usuario?.nome_completo || ''}
                                    disabled
                                    className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500"
                                />
                            </div>

                            {/* CPF Section */}
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                <label className="block text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">
                                    <CreditCard className="inline-block mr-1" size={14} />
                                    CPF do Beneficiário
                                </label>
                                <p className="text-xs text-blue-600 dark:text-blue-400 mb-2">
                                    Preencha o CPF para vincular automaticamente quando o beneficiário criar conta
                                </p>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={cpfEditando}
                                        onChange={(e) => setCpfEditando(formatarCpf(e.target.value))}
                                        placeholder="000.000.000-00"
                                        maxLength={14}
                                        className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white font-mono"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleSalvarCpf}
                                        disabled={salvandoCpf || !cpfEditando}
                                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {salvandoCpf ? (
                                            <Loader2 size={16} className="animate-spin" />
                                        ) : (
                                            <UserCheck size={16} />
                                        )}
                                        Salvar CPF
                                    </button>
                                </div>
                                {beneficiarioEditando.usuario_id && (
                                    <p className="mt-2 text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                                        <CheckCircle size={12} />
                                        Beneficiário já vinculado a um usuário
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Percentual de Rateio (%)
                                </label>
                                <input
                                    type="number"
                                    name="percentual_rateio"
                                    defaultValue={beneficiarioEditando.percentual_rateio}
                                    min="0"
                                    max="100"
                                    step="0.1"
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Desconto (%)
                                </label>
                                <input
                                    type="number"
                                    name="desconto"
                                    defaultValue={beneficiarioEditando.desconto || 0}
                                    min="0"
                                    max="100"
                                    step="0.1"
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white"
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setModalAberto(false);
                                        setBeneficiarioEditando(null);
                                    }}
                                    className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={salvando}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50"
                                >
                                    {salvando && <Loader2 size={18} className="animate-spin" />}
                                    Salvar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default BeneficiariosGestor;
