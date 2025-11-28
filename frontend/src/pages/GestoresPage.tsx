import { useState, useEffect, useCallback } from 'react';
import { api, gestoresApi, SolicitacaoGestor, Empresa, UnidadeConsumidora } from '../lib/api';
import { useToast } from '../components/Toast';
import { useTheme } from '../contexts/ThemeContext';
import {
    UserPlus, Clock, CheckCircle2, XCircle, AlertCircle, Loader2,
    ChevronDown, ChevronUp, Building2, MapPin, Send, Trash2, Key,
    Users, Shield, UserCheck, TrendingUp, Bell
} from 'lucide-react';

interface UCComPropriedade extends UnidadeConsumidora {
    is_proprietario: boolean;
    empresa_id: number;
    empresa_nome: string;
}

interface Props {
    empresas: Empresa[];
}

export function GestoresPage({ empresas }: Props) {
    const toast = useToast();
    const { isDark } = useTheme();

    // Estados
    const [loading, setLoading] = useState(true);
    const [ucs, setUcs] = useState<UCComPropriedade[]>([]);
    const [solicitacoesPendentes, setSolicitacoesPendentes] = useState<SolicitacaoGestor[]>([]);
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        'adicionar': true,
        'pendentes': true,
        'proprietario': true,
        'gestor': true
    });

    // Modal de adicionar gestor
    const [modalAberto, setModalAberto] = useState(false);
    const [ucSelecionada, setUcSelecionada] = useState<UCComPropriedade | null>(null);
    const [cpfGestor, setCpfGestor] = useState('');
    const [nomeGestor, setNomeGestor] = useState('');
    const [enviando, setEnviando] = useState(false);

    // Modal de solicitar acesso manual
    const [modalSolicitarManual, setModalSolicitarManual] = useState(false);
    const [empresaSelecionada, setEmpresaSelecionada] = useState<number | null>(null);
    const [cdcManual, setCdcManual] = useState('');
    const [digitoManual, setDigitoManual] = useState('');
    const [empresaWebManual, setEmpresaWebManual] = useState('6');

    // Modal de validar codigo
    const [modalCodigoAberto, setModalCodigoAberto] = useState(false);
    const [solicitacaoSelecionada, setSolicitacaoSelecionada] = useState<SolicitacaoGestor | null>(null);
    const [codigoAutorizacao, setCodigoAutorizacao] = useState('');
    const [validando, setValidando] = useState(false);

    // Carregar dados
    const carregarDados = useCallback(async () => {
        setLoading(true);
        try {
            const empresasConectadas = empresas.filter(e => e.status_conexao === 'CONECTADO');
            const todasUcs: UCComPropriedade[] = [];

            for (const emp of empresasConectadas) {
                try {
                    const res = await api.get(`/empresas/${emp.id}/ucs`);
                    const ucsEmpresa = res.data || [];

                    for (const uc of ucsEmpresa) {
                        // Lógica correta:
                        // Proprietário: quando o CPF da empresa é igual ao CPF/CNPJ da UC
                        // Gestor: quando o CPF da empresa é diferente do CPF/CNPJ da UC

                        // Remove caracteres não numéricos para comparação
                        const cpfEmpresa = uc.cpf_empresa?.toString().replace(/\D/g, '');
                        const cpfCnpjUC = uc.cpf_cnpj_uc?.toString().replace(/\D/g, '');

                        // Se temos o cpf_cnpj_uc, usamos para comparação
                        // Caso contrário, usa a lógica antiga (usuarioGerenciandoCdcs)
                        let isProprietario;
                        if (cpfCnpjUC) {
                            isProprietario = cpfEmpresa === cpfCnpjUC;
                        } else {
                            // Fallback: se não tem cpf_cnpj_uc, usa a lógica antiga
                            isProprietario = uc.usuarioGerenciandoCdcs !== undefined && uc.usuarioGerenciandoCdcs !== null;
                        }


                        todasUcs.push({
                            ...uc,
                            is_proprietario: isProprietario,
                            empresa_id: emp.id,
                            empresa_nome: emp.nome_empresa
                        });
                    }
                } catch (err) {
                }
            }

            setUcs(todasUcs);

            // Carregar solicitacoes pendentes
            const resPendentes = await gestoresApi.listarPendentes();
            setSolicitacoesPendentes(resPendentes.data || []);

        } catch (e) {
            console.error('Erro ao carregar dados:', e);
            toast.error('Erro ao carregar dados');
        } finally {
            setLoading(false);
        }
    }, [empresas, toast]);

    useEffect(() => {
        carregarDados();
    }, [carregarDados]);

    // Toggle de secoes
    const toggleSection = (section: string) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    // Abrir modal de adicionar gestor
    const abrirModalAdicionar = (uc: UCComPropriedade) => {
        setUcSelecionada(uc);
        setCpfGestor('');
        setNomeGestor('');
        setModalAberto(true);
    };

    // Enviar solicitacao
    const enviarSolicitacao = async () => {
        if (!ucSelecionada || !cpfGestor) {
            toast.error('Preencha o CPF do gestor');
            return;
        }

        setEnviando(true);
        try {
            const payload = {
                cliente_id: ucSelecionada.empresa_id,
                uc_id: ucSelecionada.id,
                cdc: ucSelecionada.cdc,
                digito_verificador: ucSelecionada.digito_verificador,
                empresa_web: ucSelecionada.empresa_web || 6,
                cpf_gestor: cpfGestor.replace(/\D/g, ''),
                nome_gestor: nomeGestor || undefined,
                is_proprietario: ucSelecionada.is_proprietario
            };

            const res = await gestoresApi.solicitar(payload);

            if (res.data.status === 'CONCLUIDA') {
                toast.success('Gestor adicionado com sucesso! Atualizando dados...');
                setModalAberto(false);

                // Aguarda 2 segundos e recarrega (backend sincroniza automaticamente)
                setTimeout(async () => {
                    await carregarDados();
                    toast.success('Dados atualizados!');
                }, 2000);

            } else if (res.data.status === 'AGUARDANDO_CODIGO') {
                toast.success('Solicitacao criada! Aguarde o codigo do proprietario.');
                setSolicitacoesPendentes(prev => [res.data, ...prev]);
                setModalAberto(false);
            } else {
                setModalAberto(false);
            }
        } catch (e: any) {
            toast.error(e.message || 'Erro ao enviar solicitacao');
        } finally {
            setEnviando(false);
        }
    };

    // Abrir modal de solicitacao manual
    const abrirModalSolicitarManual = () => {
        if (empresas.length === 0) {
            toast.error('Cadastre uma empresa primeiro');
            return;
        }
        setEmpresaSelecionada(empresas[0]?.id || null);
        setCdcManual('');
        setDigitoManual('');
        setEmpresaWebManual('6');
        setModalSolicitarManual(true);
    };

    // Enviar solicitacao manual
    const enviarSolicitacaoManual = async () => {
        if (!empresaSelecionada || !cdcManual || !digitoManual) {
            toast.error('Preencha todos os campos obrigatorios');
            return;
        }

        setEnviando(true);
        try {
            const empresa = empresas.find(e => e.id === empresaSelecionada);
            if (!empresa) {
                toast.error('Empresa nao encontrada');
                return;
            }

            const payload = {
                cliente_id: empresaSelecionada,
                cdc: parseInt(cdcManual),
                digito_verificador: parseInt(digitoManual),
                empresa_web: parseInt(empresaWebManual),
                cpf_gestor: empresa.responsavel_cpf, // CPF do usuario logado
                is_proprietario: false // Sempre sera gestor (solicita acesso)
            };

            const res = await gestoresApi.solicitar(payload);

            if (res.data.status === 'AGUARDANDO_CODIGO') {
                toast.success('Solicitacao criada! Aguarde o codigo do proprietario.');
                setSolicitacoesPendentes(prev => [res.data, ...prev]);
                setModalSolicitarManual(false);
            } else if (res.data.status === 'CONCLUIDA') {
                toast.success('Acesso concedido! Atualizando dados...');
                setModalSolicitarManual(false);

                // Aguarda 2 segundos e recarrega
                setTimeout(async () => {
                    await carregarDados();
                    toast.success('Dados atualizados!');
                }, 2000);
            } else {
                setModalSolicitarManual(false);
            }
        } catch (e: any) {
            toast.error(e.message || 'Erro ao enviar solicitacao');
        } finally {
            setEnviando(false);
        }
    };

    // Abrir modal de validar codigo
    const abrirModalCodigo = (solicitacao: SolicitacaoGestor) => {
        setSolicitacaoSelecionada(solicitacao);
        setCodigoAutorizacao('');
        setModalCodigoAberto(true);
    };

    // Validar codigo
    const validarCodigo = async () => {
        if (!solicitacaoSelecionada || !codigoAutorizacao) {
            toast.error('Digite o codigo de autorizacao');
            return;
        }

        setValidando(true);
        try {
            const res = await gestoresApi.validarCodigo({
                solicitacao_id: solicitacaoSelecionada.id,
                codigo: codigoAutorizacao
            });

            toast.success('Codigo validado! Atualizando suas UCs...');

            // Remove da lista de pendentes
            setSolicitacoesPendentes(prev =>
                prev.filter(s => s.id !== solicitacaoSelecionada.id)
            );

            setModalCodigoAberto(false);

            // Aguarda 2 segundos para o backend sincronizar e recarrega
            setTimeout(async () => {
                toast.success('Recarregando unidades consumidoras...');
                await carregarDados();
                toast.success('Acesso concedido! Voce ja pode gerenciar esta UC.');
            }, 2000);

        } catch (e: any) {
            toast.error(e.message || 'Codigo invalido');
        } finally {
            setValidando(false);
        }
    };

    // Cancelar solicitacao
    const cancelarSolicitacao = async (id: number) => {
        if (!confirm('Deseja cancelar esta solicitacao?')) return;

        try {
            await gestoresApi.cancelar(id);
            toast.success('Solicitacao cancelada');
            setSolicitacoesPendentes(prev => prev.filter(s => s.id !== id));
        } catch (e: any) {
            toast.error(e.message || 'Erro ao cancelar');
        }
    };

    // Formatar CPF
    const formatarCPF = (cpf: string) => {
        const numeros = cpf.replace(/\D/g, '');
        return numeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    };

    // Calcular dias restantes
    const diasRestantes = (expiraEm?: string) => {
        if (!expiraEm) return null;
        const diff = new Date(expiraEm).getTime() - Date.now();
        const dias = Math.ceil(diff / (1000 * 60 * 60 * 24));
        return dias > 0 ? dias : 0;
    };

    // Classes de estilo
    const cardClass = `rounded-xl border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'} shadow-sm`;
    const headerClass = `flex items-center justify-between p-4 cursor-pointer ${isDark ? 'hover:bg-slate-700/50' : 'hover:bg-slate-50'}`;
    const inputClass = `w-full px-3 py-2 rounded-lg border ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'} focus:ring-2 focus:ring-blue-500 focus:border-transparent`;
    const btnPrimaryClass = 'px-4 py-2 bg-[#00A3E0] text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2 disabled:opacity-50';
    const btnSecondaryClass = `px-4 py-2 rounded-lg border ${isDark ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'border-slate-300 text-slate-600 hover:bg-slate-100'} transition-colors`;

    // Calcular métricas
    const totalUcs = ucs.length;
    const ucsProprietario = ucs.filter(uc => uc.is_proprietario).length;
    const ucsGestor = ucs.filter(uc => !uc.is_proprietario).length;
    const totalGestoresAtivos = ucs
        .filter(uc => uc.is_proprietario && uc.usuarioGerenciandoCdcs)
        .reduce((total, uc) => total + (uc.usuarioGerenciandoCdcs?.length || 0), 0);
    const autorizacoesExpirando = solicitacoesPendentes.filter(sol => {
        const dias = diasRestantes(sol.expira_em);
        return dias !== null && dias <= 2 && dias > 0;
    }).length;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 text-[#00A3E0] animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Gestores de Imoveis
                </h1>
                <p className={`mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Gerencie quem pode acessar suas unidades consumidoras
                </p>
            </div>

            {/* Dashboard de Métricas */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Total de UCs */}
                <div className={`${cardClass} p-5`}>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                Total de UCs
                            </p>
                            <p className={`text-3xl font-bold mt-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                {totalUcs}
                            </p>
                        </div>
                        <div className={`p-3 rounded-lg ${isDark ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
                            <Building2 className="text-[#00A3E0]" size={24} />
                        </div>
                    </div>
                </div>

                {/* UCs Proprietário */}
                <div className={`${cardClass} p-5`}>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                Proprietário
                            </p>
                            <p className={`text-3xl font-bold mt-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                {ucsProprietario}
                            </p>
                        </div>
                        <div className={`p-3 rounded-lg ${isDark ? 'bg-green-500/20' : 'bg-green-100'}`}>
                            <Shield className="text-green-600" size={24} />
                        </div>
                    </div>
                </div>

                {/* UCs Gestor */}
                <div className={`${cardClass} p-5`}>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                Gestor
                            </p>
                            <p className={`text-3xl font-bold mt-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                {ucsGestor}
                            </p>
                        </div>
                        <div className={`p-3 rounded-lg ${isDark ? 'bg-purple-500/20' : 'bg-purple-100'}`}>
                            <UserCheck className="text-purple-600" size={24} />
                        </div>
                    </div>
                </div>

                {/* Gestores Ativos */}
                <div className={`${cardClass} p-5`}>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                Gestores Ativos
                            </p>
                            <p className={`text-3xl font-bold mt-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                {totalGestoresAtivos}
                            </p>
                        </div>
                        <div className={`p-3 rounded-lg ${isDark ? 'bg-cyan-500/20' : 'bg-cyan-100'}`}>
                            <Users className="text-cyan-600" size={24} />
                        </div>
                    </div>
                </div>

                {/* Alertas */}
                <div className={`${cardClass} p-5 ${autorizacoesExpirando > 0 ? 'ring-2 ring-amber-500' : ''}`}>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                Expirando
                            </p>
                            <p className={`text-3xl font-bold mt-1 ${autorizacoesExpirando > 0 ? 'text-amber-500' : isDark ? 'text-white' : 'text-slate-900'}`}>
                                {autorizacoesExpirando}
                            </p>
                        </div>
                        <div className={`p-3 rounded-lg ${autorizacoesExpirando > 0 ? 'bg-amber-500/20' : isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
                            <Bell className={autorizacoesExpirando > 0 ? 'text-amber-500' : isDark ? 'text-slate-500' : 'text-slate-400'} size={24} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Secao: Solicitacoes Pendentes */}
            <div className={cardClass}>
                <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={() => toggleSection('pendentes')}>
                        <div className={`p-2 rounded-lg ${solicitacoesPendentes.length > 0 ? 'bg-amber-100 text-amber-600' : isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                            <Clock size={20} />
                        </div>
                        <div>
                            <h2 className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                Solicitacoes Pendentes
                            </h2>
                            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                {solicitacoesPendentes.length > 0
                                    ? `${solicitacoesPendentes.length} aguardando codigo`
                                    : 'Nenhuma solicitacao pendente'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={abrirModalSolicitarManual}
                            className={`${btnPrimaryClass} text-sm`}
                        >
                            <UserPlus size={16} />
                            Solicitar Acesso
                        </button>
                        <button onClick={() => toggleSection('pendentes')} className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                            {expandedSections['pendentes'] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </button>
                    </div>
                </div>

                {expandedSections['pendentes'] && (
                    <div className="p-4 pt-0 space-y-3">
                        {solicitacoesPendentes.length === 0 ? (
                            <div className={`text-center py-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                <Clock size={40} className="mx-auto mb-3 opacity-40" />
                                <p>Voce nao tem solicitacoes</p>
                                <p className="text-sm mt-1">
                                    Quando voce solicitar acesso a uma UC como gestor,<br />
                                    a solicitacao aparecera aqui.
                                </p>
                            </div>
                        ) : solicitacoesPendentes.map(sol => {
                            const isConcluida = sol.status === 'CONCLUIDA';
                            const isAguardando = sol.status === 'AGUARDANDO_CODIGO';

                            return (
                                <div
                                    key={sol.id}
                                    className={`p-4 rounded-lg border ${isConcluida
                                        ? isDark ? 'bg-green-900/20 border-green-700' : 'bg-green-50 border-green-200'
                                        : isDark ? 'bg-slate-700/50 border-slate-600' : 'bg-slate-50 border-slate-200'
                                        }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="space-y-1 flex-1">
                                            <div className="flex items-center gap-2">
                                                <Building2 size={16} className={isDark ? 'text-slate-400' : 'text-slate-500'} />
                                                <span className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                                    {sol.nome_empresa}
                                                </span>
                                                {/* Badge de status */}
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${isConcluida ? 'bg-green-100 text-green-700' :
                                                        isAguardando ? 'bg-amber-100 text-amber-700' :
                                                            'bg-blue-100 text-blue-700'
                                                    }`}>
                                                    {isConcluida ? 'Concluída' : isAguardando ? 'Aguardando Código' : 'Pendente'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <MapPin size={16} className={isDark ? 'text-slate-400' : 'text-slate-500'} />
                                                <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                                                    CDC: {sol.cdc} | {sol.endereco_uc || 'Endereço não informado'}
                                                </span>
                                            </div>
                                            <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                                CPF Gestor: {formatarCPF(sol.cpf_gestor)}
                                                {sol.nome_gestor && ` (${sol.nome_gestor})`}
                                            </div>
                                            {sol.expira_em && !isConcluida && (
                                                <div className="flex items-center gap-1 text-sm text-amber-500">
                                                    <AlertCircle size={14} />
                                                    Expira em {diasRestantes(sol.expira_em)} dias
                                                </div>
                                            )}
                                            {isConcluida && sol.concluido_em && (
                                                <div className="flex items-center gap-1 text-sm text-green-600">
                                                    <CheckCircle2 size={14} />
                                                    Concluída em {new Date(sol.concluido_em).toLocaleDateString()}
                                                </div>
                                            )}
                                            {sol.mensagem && (
                                                <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'} italic`}>
                                                    {sol.mensagem}
                                                </p>
                                            )}
                                        </div>
                                        {!isConcluida && (
                                            <div className="flex items-center gap-2">
                                                {isAguardando && (
                                                    <button
                                                        onClick={() => abrirModalCodigo(sol)}
                                                        className={btnPrimaryClass}
                                                    >
                                                        <Key size={16} />
                                                        Inserir Código
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => cancelarSolicitacao(sol.id)}
                                                    className="p-2 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                                                    title="Cancelar"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Secao: Adicionar Gestor */}
            <div className={cardClass}>
                <div className={headerClass} onClick={() => toggleSection('adicionar')}>
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                            <UserPlus size={20} />
                        </div>
                        <div>
                            <h2 className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                Adicionar Gestor
                            </h2>
                            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                Selecione uma UC para adicionar um gestor
                            </p>
                        </div>
                    </div>
                    {expandedSections['adicionar'] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>

                {expandedSections['adicionar'] && (
                    <div className="p-4 pt-0">
                        {ucs.length === 0 ? (
                            <div className={`text-center py-8 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                <Building2 size={48} className="mx-auto mb-4 opacity-50" />
                                <p>Nenhuma unidade consumidora encontrada</p>
                                <p className="text-sm">Conecte uma empresa primeiro</p>
                            </div>
                        ) : (
                            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                                {ucs.map(uc => (
                                    <div
                                        key={uc.id}
                                        className={`p-4 rounded-lg border cursor-pointer transition-all ${isDark
                                            ? 'bg-slate-700/30 border-slate-600 hover:border-blue-500'
                                            : 'bg-white border-slate-200 hover:border-blue-500'
                                            }`}
                                        onClick={() => abrirModalAdicionar(uc)}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="space-y-1 flex-1 min-w-0">
                                                <div className={`font-medium truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                                    {uc.empresa_nome}
                                                </div>
                                                <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                                    CDC: {uc.cdc}
                                                </div>
                                                <div className={`text-xs truncate ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                                    {uc.numero_imovel && uc.bairro && uc.nome_municipio && uc.uf
                                                        ? `${uc.endereco}, ${uc.numero_imovel}${uc.complemento ? ' - ' + uc.complemento : ''} - ${uc.bairro}, ${uc.nome_municipio}/${uc.uf}`
                                                        : uc.endereco
                                                    }
                                                </div>
                                                {uc.nome_titular && (
                                                    <div className={`text-xs ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                                                        Titular: {uc.nome_titular}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex flex-col gap-1.5 items-end">
                                                {/* Badge Ativo/Inativo */}
                                                <div className={`px-2 py-1 rounded text-xs font-semibold ${(uc.uc_ativa === true && uc.contrato_ativo === true)
                                                        ? 'bg-green-100 text-green-700'
                                                        : 'bg-red-100 text-red-700'
                                                    }`}>
                                                    {(uc.uc_ativa === true && uc.contrato_ativo === true) ? 'Ativa' : 'Inativa'}
                                                </div>
                                                {/* Badge Proprietário/Gestor */}
                                                <div className={`px-2 py-1 rounded text-xs ${uc.is_proprietario
                                                    ? 'bg-blue-100 text-blue-700'
                                                    : 'bg-amber-100 text-amber-700'
                                                    }`}>
                                                    {uc.is_proprietario ? 'Proprietario' : 'Gestor'}
                                                </div>
                                            </div>
                                        </div>
                                        <button className={`mt-3 w-full ${btnPrimaryClass} justify-center`}>
                                            <UserPlus size={16} />
                                            {uc.is_proprietario ? 'Adicionar Gestor' : 'Solicitar Acesso'}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Secao: Minhas UCs como Proprietário */}
            <div className={cardClass}>
                <div className={headerClass} onClick={() => toggleSection('proprietario')}>
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-green-100 text-green-600">
                            <Shield size={20} />
                        </div>
                        <div>
                            <h2 className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                Minhas UCs (Proprietário)
                            </h2>
                            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                {ucsProprietario} {ucsProprietario === 1 ? 'unidade' : 'unidades'} onde você é proprietário
                            </p>
                        </div>
                    </div>
                    {expandedSections['proprietario'] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>

                {expandedSections['proprietario'] && (
                    <div className="p-4 pt-0">
                        {ucs.filter(uc => uc.is_proprietario).length === 0 ? (
                            <div className={`text-center py-8 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                <Shield size={48} className="mx-auto mb-4 opacity-50" />
                                <p>Você não é proprietário de nenhuma UC</p>
                            </div>
                        ) : (
                            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                                {ucs.filter(uc => uc.is_proprietario).map(uc => (
                                    <div
                                        key={uc.id}
                                        className={`p-4 rounded-lg border ${isDark
                                            ? 'bg-slate-700/30 border-slate-600'
                                            : 'bg-white border-slate-200'
                                            }`}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="space-y-1 flex-1 min-w-0">
                                                <div className={`font-medium truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                                    {uc.empresa_nome}
                                                </div>
                                                <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                                    CDC: {uc.cdc}-{uc.digito_verificador}
                                                </div>
                                                <div className={`text-xs truncate ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                                    {uc.numero_imovel && uc.bairro && uc.nome_municipio && uc.uf
                                                        ? `${uc.endereco}, ${uc.numero_imovel}${uc.complemento ? ' - ' + uc.complemento : ''} - ${uc.bairro}, ${uc.nome_municipio}/${uc.uf}`
                                                        : uc.endereco
                                                    }
                                                </div>
                                                {uc.nome_titular && (
                                                    <div className={`text-xs ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                                                        Titular: {uc.nome_titular}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex flex-col gap-1.5 items-end">
                                                <div className={`px-2 py-1 rounded text-xs font-semibold ${(uc.uc_ativa === true && uc.contrato_ativo === true)
                                                        ? 'bg-green-100 text-green-700'
                                                        : 'bg-red-100 text-red-700'
                                                    }`}>
                                                    {(uc.uc_ativa === true && uc.contrato_ativo === true) ? 'Ativa' : 'Inativa'}
                                                </div>
                                            </div>
                                        </div>
                                        {uc.usuarioGerenciandoCdcs && uc.usuarioGerenciandoCdcs.length > 0 && (
                                            <div className={`mt-3 pt-3 border-t ${isDark ? 'border-slate-600' : 'border-slate-200'}`}>
                                                <div className={`text-xs font-semibold mb-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                                    Gestores ({uc.usuarioGerenciandoCdcs.length}):
                                                </div>
                                                <div className="space-y-1">
                                                    {uc.usuarioGerenciandoCdcs.map((gestor, idx) => (
                                                        <div key={idx} className={`text-xs flex items-center gap-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                                                            <UserCheck size={12} className="text-cyan-600" />
                                                            <span className="truncate">{gestor.nome}</span>
                                                            {gestor.statusAtivo && (
                                                                <span className="ml-auto px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-semibold">Ativo</span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Secao: UCs onde sou Gestor */}
            <div className={cardClass}>
                <div className={headerClass} onClick={() => toggleSection('gestor')}>
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-purple-100 text-purple-600">
                            <UserCheck size={20} />
                        </div>
                        <div>
                            <h2 className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                UCs onde sou Gestor
                            </h2>
                            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                {ucsGestor} {ucsGestor === 1 ? 'unidade' : 'unidades'} que você gerencia
                            </p>
                        </div>
                    </div>
                    {expandedSections['gestor'] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>

                {expandedSections['gestor'] && (
                    <div className="p-4 pt-0">
                        {ucs.filter(uc => !uc.is_proprietario).length === 0 ? (
                            <div className={`text-center py-8 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                <UserCheck size={48} className="mx-auto mb-4 opacity-50" />
                                <p>Você não é gestor de nenhuma UC</p>
                                <p className="text-sm mt-1">Solicite acesso a uma UC acima</p>
                            </div>
                        ) : (
                            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                                {ucs.filter(uc => !uc.is_proprietario).map(uc => (
                                    <div
                                        key={uc.id}
                                        className={`p-4 rounded-lg border ${isDark
                                            ? 'bg-slate-700/30 border-slate-600'
                                            : 'bg-white border-slate-200'
                                            }`}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="space-y-1 flex-1 min-w-0">
                                                <div className={`font-medium truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                                    {uc.empresa_nome}
                                                </div>
                                                <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                                    CDC: {uc.cdc}-{uc.digito_verificador}
                                                </div>
                                                <div className={`text-xs truncate ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                                    {uc.numero_imovel && uc.bairro && uc.nome_municipio && uc.uf
                                                        ? `${uc.endereco}, ${uc.numero_imovel}${uc.complemento ? ' - ' + uc.complemento : ''} - ${uc.bairro}, ${uc.nome_municipio}/${uc.uf}`
                                                        : uc.endereco
                                                    }
                                                </div>
                                                {uc.nome_titular && (
                                                    <div className={`text-xs ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                                                        Proprietário: {uc.nome_titular}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex flex-col gap-1.5 items-end">
                                                <div className={`px-2 py-1 rounded text-xs font-semibold ${(uc.uc_ativa === true && uc.contrato_ativo === true)
                                                        ? 'bg-green-100 text-green-700'
                                                        : 'bg-red-100 text-red-700'
                                                    }`}>
                                                    {(uc.uc_ativa === true && uc.contrato_ativo === true) ? 'Ativa' : 'Inativa'}
                                                </div>
                                                <div className="px-2 py-1 rounded text-xs bg-purple-100 text-purple-700">
                                                    Gestor
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modal: Adicionar Gestor */}
            {modalAberto && ucSelecionada && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className={`w-full max-w-md rounded-xl ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-xl`}>
                        <div className={`p-4 border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                            <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                {ucSelecionada.is_proprietario ? 'Adicionar Gestor' : 'Solicitar Acesso'}
                            </h3>
                            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                CDC: {ucSelecionada.cdc} | {ucSelecionada.empresa_nome}
                            </p>
                        </div>

                        <div className="p-4 space-y-4">
                            {!ucSelecionada.is_proprietario && (
                                <div className={`p-3 rounded-lg ${isDark ? 'bg-amber-900/30 border border-amber-700' : 'bg-amber-50 border border-amber-200'}`}>
                                    <div className="flex items-start gap-2">
                                        <AlertCircle size={18} className="text-amber-500 mt-0.5" />
                                        <div className={`text-sm ${isDark ? 'text-amber-200' : 'text-amber-800'}`}>
                                            Voce nao e o proprietario desta UC. Sera criada uma solicitacao
                                            e o proprietario recebera um codigo de autorizacao (valido por 5 dias).
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                    CPF do Gestor *
                                </label>
                                <input
                                    type="text"
                                    value={cpfGestor}
                                    onChange={e => setCpfGestor(e.target.value)}
                                    placeholder="000.000.000-00"
                                    className={inputClass}
                                    maxLength={14}
                                />
                            </div>

                            <div>
                                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                    Nome do Gestor (opcional)
                                </label>
                                <input
                                    type="text"
                                    value={nomeGestor}
                                    onChange={e => setNomeGestor(e.target.value)}
                                    placeholder="Nome para identificacao"
                                    className={inputClass}
                                />
                            </div>
                        </div>

                        <div className={`p-4 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'} flex justify-end gap-3`}>
                            <button
                                onClick={() => setModalAberto(false)}
                                className={btnSecondaryClass}
                                disabled={enviando}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={enviarSolicitacao}
                                className={btnPrimaryClass}
                                disabled={enviando || !cpfGestor}
                            >
                                {enviando ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        Enviando...
                                    </>
                                ) : (
                                    <>
                                        <Send size={16} />
                                        {ucSelecionada.is_proprietario ? 'Adicionar' : 'Solicitar'}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Validar Codigo */}
            {modalCodigoAberto && solicitacaoSelecionada && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className={`w-full max-w-md rounded-xl ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-xl`}>
                        <div className={`p-4 border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                            <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                Validar Codigo de Autorizacao
                            </h3>
                            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                CDC: {solicitacaoSelecionada.cdc}
                            </p>
                        </div>

                        <div className="p-4 space-y-4">
                            <div className={`p-3 rounded-lg ${isDark ? 'bg-blue-900/30 border border-blue-700' : 'bg-blue-50 border border-blue-200'}`}>
                                <div className={`text-sm ${isDark ? 'text-blue-200' : 'text-blue-800'}`}>
                                    Digite o codigo que o proprietario da UC recebeu.
                                    Este codigo e enviado por SMS ou email para o titular.
                                </div>
                            </div>

                            <div>
                                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                    Codigo de Autorizacao *
                                </label>
                                <input
                                    type="text"
                                    value={codigoAutorizacao}
                                    onChange={e => setCodigoAutorizacao(e.target.value.replace(/\D/g, ''))}
                                    placeholder="Digite o codigo"
                                    className={`${inputClass} text-center text-2xl tracking-widest`}
                                    maxLength={10}
                                />
                            </div>
                        </div>

                        <div className={`p-4 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'} flex justify-end gap-3`}>
                            <button
                                onClick={() => setModalCodigoAberto(false)}
                                className={btnSecondaryClass}
                                disabled={validando}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={validarCodigo}
                                className={btnPrimaryClass}
                                disabled={validando || !codigoAutorizacao}
                            >
                                {validando ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        Validando...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 size={16} />
                                        Validar
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Solicitar Acesso Manual */}
            {modalSolicitarManual && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className={`w-full max-w-md rounded-xl ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-xl`}>
                        <div className={`p-4 border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                            <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                Solicitar Acesso a UC
                            </h3>
                            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                Informe os dados da unidade consumidora
                            </p>
                        </div>

                        <div className="p-4 space-y-4">
                            <div className={`p-3 rounded-lg ${isDark ? 'bg-blue-900/30 border border-blue-700' : 'bg-blue-50 border border-blue-200'}`}>
                                <div className="flex items-start gap-2">
                                    <AlertCircle size={18} className="text-blue-500 mt-0.5" />
                                    <div className={`text-sm ${isDark ? 'text-blue-200' : 'text-blue-800'}`}>
                                        Sera criada uma solicitacao de acesso como gestor.
                                        O proprietario da UC recebera um codigo que voce devera inserir aqui.
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                    Empresa *
                                </label>
                                <select
                                    value={empresaSelecionada || ''}
                                    onChange={e => setEmpresaSelecionada(parseInt(e.target.value))}
                                    className={inputClass}
                                >
                                    {empresas.map(emp => (
                                        <option key={emp.id} value={emp.id}>
                                            {emp.nome_empresa} - {emp.responsavel_cpf}
                                        </option>
                                    ))}
                                </select>
                                <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                    Selecione a empresa pela qual voce deseja solicitar acesso
                                </p>
                            </div>

                            <div>
                                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                    CDC *
                                </label>
                                <input
                                    type="text"
                                    value={cdcManual}
                                    onChange={e => setCdcManual(e.target.value.replace(/\D/g, ''))}
                                    placeholder="Ex: 123456789"
                                    className={inputClass}
                                    maxLength={15}
                                />
                            </div>

                            <div>
                                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                    Digito Verificador *
                                </label>
                                <input
                                    type="text"
                                    value={digitoManual}
                                    onChange={e => setDigitoManual(e.target.value.replace(/\D/g, ''))}
                                    placeholder="Ex: 5"
                                    className={inputClass}
                                    maxLength={2}
                                />
                            </div>

                            <div>
                                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                    Codigo Empresa Web
                                </label>
                                <input
                                    type="text"
                                    value={empresaWebManual}
                                    onChange={e => setEmpresaWebManual(e.target.value.replace(/\D/g, ''))}
                                    placeholder="Ex: 6"
                                    className={inputClass}
                                    maxLength={2}
                                />
                                <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                    Geralmente 6 (Energisa)
                                </p>
                            </div>
                        </div>

                        <div className={`p-4 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'} flex justify-end gap-3`}>
                            <button
                                onClick={() => setModalSolicitarManual(false)}
                                className={btnSecondaryClass}
                                disabled={enviando}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={enviarSolicitacaoManual}
                                className={btnPrimaryClass}
                                disabled={enviando || !cdcManual || !digitoManual || !empresaSelecionada}
                            >
                                {enviando ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        Enviando...
                                    </>
                                ) : (
                                    <>
                                        <Send size={16} />
                                        Solicitar
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
