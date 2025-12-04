/**
 * GestaoUsuarios - Gestão de Usuários do Sistema
 */

import { useState, useEffect } from 'react';
import {
    Users,
    Search,
    Filter,
    Plus,
    Edit2,
    UserCheck,
    UserX,
    ChevronLeft,
    ChevronRight,
    Loader2,
    X,
    Shield,
    Mail,
    Phone,
    Calendar,
    Building2,
    User
} from 'lucide-react';
import api from '../../api/axios';

interface Usuario {
    id: string;
    auth_id: string | null;
    tipo_pessoa: 'PF' | 'PJ';
    nome_completo: string;
    email: string;
    cpf: string | null;
    cnpj: string | null;
    razao_social: string | null;
    nome_fantasia: string | null;
    telefone: string | null;
    avatar_url: string | null;
    is_superadmin: boolean;
    ativo: boolean;
    email_verificado: boolean;
    perfis: string[];
    criado_em: string | null;
    atualizado_em: string | null;
    ultimo_acesso: string | null;
}

interface UsuarioListResponse {
    usuarios: Usuario[];
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
}

type PerfilTipo = 'superadmin' | 'proprietario' | 'gestor' | 'beneficiario' | 'usuario' | 'parceiro';

const PERFIL_LABELS: Record<PerfilTipo, string> = {
    superadmin: 'Super Admin',
    proprietario: 'Proprietário',
    gestor: 'Gestor',
    beneficiario: 'Beneficiário',
    usuario: 'Usuário',
    parceiro: 'Parceiro'
};

const PERFIL_COLORS: Record<PerfilTipo, string> = {
    superadmin: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    proprietario: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    gestor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    beneficiario: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    usuario: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400',
    parceiro: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
};

export function GestaoUsuarios() {
    const [usuarios, setUsuarios] = useState<Usuario[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Paginação
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const perPage = 20;

    // Filtros
    const [searchNome, setSearchNome] = useState('');
    const [searchEmail, setSearchEmail] = useState('');
    const [filterPerfil, setFilterPerfil] = useState<string>('');
    const [filterAtivo, setFilterAtivo] = useState<string>('');
    const [showFilters, setShowFilters] = useState(false);

    // Modal
    const [selectedUser, setSelectedUser] = useState<Usuario | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    const fetchUsuarios = async () => {
        try {
            setLoading(true);
            setError(null);

            const params = new URLSearchParams();
            params.append('page', page.toString());
            params.append('per_page', perPage.toString());

            if (searchNome) params.append('nome', searchNome);
            if (searchEmail) params.append('email', searchEmail);
            if (filterPerfil) params.append('perfil', filterPerfil);
            if (filterAtivo) params.append('ativo', filterAtivo);

            const response = await api.get<UsuarioListResponse>(`/usuarios?${params.toString()}`);
            setUsuarios(response.data.usuarios);
            setTotalPages(response.data.total_pages);
            setTotal(response.data.total);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Erro ao carregar usuários');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsuarios();
    }, [page, filterPerfil, filterAtivo]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        fetchUsuarios();
    };

    const handleToggleStatus = async (usuario: Usuario) => {
        try {
            setActionLoading(true);
            const endpoint = usuario.ativo
                ? `/usuarios/${usuario.id}/desativar`
                : `/usuarios/${usuario.id}/ativar`;

            await api.post(endpoint);
            await fetchUsuarios();
            setShowModal(false);
            setSelectedUser(null);
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Erro ao alterar status');
        } finally {
            setActionLoading(false);
        }
    };

    const formatarData = (dataStr: string | null) => {
        if (!dataStr) return '-';
        const data = new Date(dataStr);
        return data.toLocaleDateString('pt-BR');
    };

    const formatarDataHora = (dataStr: string | null) => {
        if (!dataStr) return 'Nunca';
        const data = new Date(dataStr);
        return data.toLocaleString('pt-BR');
    };

    if (loading && usuarios.length === 0) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        Gestão de Usuários
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        {total} usuários cadastrados
                    </p>
                </div>
            </div>

            {/* Busca e Filtros */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar por nome..."
                            value={searchNome}
                            onChange={(e) => setSearchNome(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                    <div className="flex-1 relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar por email..."
                            value={searchEmail}
                            onChange={(e) => setSearchEmail(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition ${
                            showFilters
                                ? 'border-blue-500 text-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900'
                        }`}
                    >
                        <Filter size={18} />
                        Filtros
                    </button>
                    <button
                        type="submit"
                        className="flex items-center gap-2 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                    >
                        <Search size={18} />
                        Buscar
                    </button>
                </form>

                {/* Filtros expandidos */}
                {showFilters && (
                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 flex flex-wrap gap-4">
                        <div>
                            <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">Perfil</label>
                            <select
                                value={filterPerfil}
                                onChange={(e) => { setFilterPerfil(e.target.value); setPage(1); }}
                                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                            >
                                <option value="">Todos</option>
                                <option value="superadmin">Super Admin</option>
                                <option value="proprietario">Proprietário</option>
                                <option value="gestor">Gestor</option>
                                <option value="beneficiario">Beneficiário</option>
                                <option value="usuario">Usuário</option>
                                <option value="parceiro">Parceiro</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">Status</label>
                            <select
                                value={filterAtivo}
                                onChange={(e) => { setFilterAtivo(e.target.value); setPage(1); }}
                                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                            >
                                <option value="">Todos</option>
                                <option value="true">Ativos</option>
                                <option value="false">Inativos</option>
                            </select>
                        </div>
                        <button
                            onClick={() => {
                                setSearchNome('');
                                setSearchEmail('');
                                setFilterPerfil('');
                                setFilterAtivo('');
                                setPage(1);
                            }}
                            className="self-end px-4 py-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                        >
                            Limpar filtros
                        </button>
                    </div>
                )}
            </div>

            {/* Error */}
            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg text-red-600 dark:text-red-400">
                    {error}
                </div>
            )}

            {/* Tabela */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 dark:bg-slate-900">
                            <tr>
                                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500 dark:text-slate-400">Usuário</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500 dark:text-slate-400">Tipo</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500 dark:text-slate-400">CPF/CNPJ</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500 dark:text-slate-400">Perfis</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-slate-500 dark:text-slate-400">Status</th>
                                <th className="text-right py-3 px-4 text-sm font-medium text-slate-500 dark:text-slate-400">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {usuarios.map((usuario) => (
                                <tr key={usuario.id} className="hover:bg-slate-50 dark:hover:bg-slate-900">
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-[#00A3E0] rounded-full flex items-center justify-center text-white font-medium">
                                                {usuario.nome_completo.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-medium text-slate-900 dark:text-white">
                                                    {usuario.nome_completo}
                                                    {usuario.is_superadmin && (
                                                        <Shield className="inline ml-2 text-red-500" size={14} />
                                                    )}
                                                </p>
                                                <p className="text-sm text-slate-500">{usuario.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4">
                                        {usuario.tipo_pessoa === 'PJ' ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                                                <Building2 size={12} />
                                                PJ
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                                <User size={12} />
                                                PF
                                            </span>
                                        )}
                                    </td>
                                    <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-300">
                                        {usuario.tipo_pessoa === 'PJ' ? (usuario.cnpj || '-') : (usuario.cpf || '-')}
                                    </td>
                                    <td className="py-3 px-4">
                                        <div className="flex flex-wrap gap-1">
                                            {usuario.perfis.map((perfil) => (
                                                <span
                                                    key={perfil}
                                                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                                        PERFIL_COLORS[perfil as PerfilTipo] || 'bg-slate-100 text-slate-700'
                                                    }`}
                                                >
                                                    {PERFIL_LABELS[perfil as PerfilTipo] || perfil}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="py-3 px-4">
                                        {usuario.ativo ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                                <UserCheck size={12} />
                                                Ativo
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                                <UserX size={12} />
                                                Inativo
                                            </span>
                                        )}
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                        <button
                                            onClick={() => { setSelectedUser(usuario); setShowModal(true); }}
                                            className="p-2 text-slate-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition"
                                            title="Ver detalhes"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {usuarios.length === 0 && !loading && (
                    <div className="text-center py-12 text-slate-500">
                        Nenhum usuário encontrado
                    </div>
                )}

                {/* Paginação */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-700">
                        <p className="text-sm text-slate-500">
                            Mostrando {(page - 1) * perPage + 1} - {Math.min(page * perPage, total)} de {total}
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-900"
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <span className="text-sm text-slate-600 dark:text-slate-300">
                                {page} / {totalPages}
                            </span>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-900"
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal de Detalhes */}
            {showModal && selectedUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-white dark:bg-slate-800 p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                Detalhes do Usuário
                            </h2>
                            <button
                                onClick={() => { setShowModal(false); setSelectedUser(null); }}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Info do usuário */}
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 bg-[#00A3E0] rounded-full flex items-center justify-center text-white text-2xl font-bold">
                                    {selectedUser.nome_completo.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                                        {selectedUser.nome_completo}
                                        {selectedUser.is_superadmin && (
                                            <Shield className="inline ml-2 text-red-500" size={18} />
                                        )}
                                    </h3>
                                    <p className="text-slate-500">{selectedUser.email}</p>
                                </div>
                            </div>

                            {/* Tipo de Pessoa */}
                            <div className="flex items-center gap-2">
                                {selectedUser.tipo_pessoa === 'PJ' ? (
                                    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                                        <Building2 size={16} />
                                        Pessoa Jurídica
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                        <User size={16} />
                                        Pessoa Física
                                    </span>
                                )}
                            </div>

                            {/* Dados */}
                            <div className="grid grid-cols-2 gap-4">
                                {selectedUser.tipo_pessoa === 'PJ' ? (
                                    <>
                                        <div>
                                            <label className="text-xs text-slate-500 dark:text-slate-400">CNPJ</label>
                                            <p className="font-medium text-slate-900 dark:text-white">
                                                {selectedUser.cnpj || '-'}
                                            </p>
                                        </div>
                                        <div>
                                            <label className="text-xs text-slate-500 dark:text-slate-400">Telefone</label>
                                            <p className="font-medium text-slate-900 dark:text-white">
                                                {selectedUser.telefone || '-'}
                                            </p>
                                        </div>
                                        <div className="col-span-2">
                                            <label className="text-xs text-slate-500 dark:text-slate-400">Razão Social</label>
                                            <p className="font-medium text-slate-900 dark:text-white">
                                                {selectedUser.razao_social || '-'}
                                            </p>
                                        </div>
                                        <div className="col-span-2">
                                            <label className="text-xs text-slate-500 dark:text-slate-400">Nome Fantasia</label>
                                            <p className="font-medium text-slate-900 dark:text-white">
                                                {selectedUser.nome_fantasia || '-'}
                                            </p>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div>
                                            <label className="text-xs text-slate-500 dark:text-slate-400">CPF</label>
                                            <p className="font-medium text-slate-900 dark:text-white">
                                                {selectedUser.cpf || '-'}
                                            </p>
                                        </div>
                                        <div>
                                            <label className="text-xs text-slate-500 dark:text-slate-400">Telefone</label>
                                            <p className="font-medium text-slate-900 dark:text-white">
                                                {selectedUser.telefone || '-'}
                                            </p>
                                        </div>
                                    </>
                                )}
                                <div>
                                    <label className="text-xs text-slate-500 dark:text-slate-400">Criado em</label>
                                    <p className="font-medium text-slate-900 dark:text-white">
                                        {formatarData(selectedUser.criado_em)}
                                    </p>
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 dark:text-slate-400">Último acesso</label>
                                    <p className="font-medium text-slate-900 dark:text-white">
                                        {formatarDataHora(selectedUser.ultimo_acesso)}
                                    </p>
                                </div>
                            </div>

                            {/* Perfis */}
                            <div>
                                <label className="text-xs text-slate-500 dark:text-slate-400 block mb-2">Perfis</label>
                                <div className="flex flex-wrap gap-2">
                                    {selectedUser.perfis.map((perfil) => (
                                        <span
                                            key={perfil}
                                            className={`px-3 py-1 rounded-full text-sm font-medium ${
                                                PERFIL_COLORS[perfil as PerfilTipo] || 'bg-slate-100 text-slate-700'
                                            }`}
                                        >
                                            {PERFIL_LABELS[perfil as PerfilTipo] || perfil}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Status */}
                            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-xl">
                                <div>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Status atual</p>
                                    {selectedUser.ativo ? (
                                        <p className="font-medium text-green-600 dark:text-green-400 flex items-center gap-2">
                                            <UserCheck size={18} />
                                            Usuário Ativo
                                        </p>
                                    ) : (
                                        <p className="font-medium text-red-600 dark:text-red-400 flex items-center gap-2">
                                            <UserX size={18} />
                                            Usuário Inativo
                                        </p>
                                    )}
                                </div>
                                <button
                                    onClick={() => handleToggleStatus(selectedUser)}
                                    disabled={actionLoading}
                                    className={`px-4 py-2 rounded-lg font-medium transition disabled:opacity-50 ${
                                        selectedUser.ativo
                                            ? 'bg-red-500 text-white hover:bg-red-600'
                                            : 'bg-green-500 text-white hover:bg-green-600'
                                    }`}
                                >
                                    {actionLoading ? (
                                        <Loader2 className="animate-spin" size={18} />
                                    ) : selectedUser.ativo ? (
                                        'Desativar'
                                    ) : (
                                        'Ativar'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default GestaoUsuarios;
