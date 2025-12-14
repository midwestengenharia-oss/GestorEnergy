/**
 * NovaUsina - Wizard para cadastro de nova usina
 * Fluxo completo: Dados Básicos -> UC Geradora -> Gestores -> Beneficiários -> Revisão
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usinasApi, UsinaCreateRequest } from '../../api/usinas';
import { ucsApi } from '../../api/ucs';
import { beneficiariosApi, BeneficiarioCreateRequest } from '../../api/beneficiarios';
import type { UnidadeConsumidora, Usuario } from '../../api/types';
import {
    Building2,
    Zap,
    Users,
    CheckCircle,
    ChevronLeft,
    ChevronRight,
    Loader2,
    AlertCircle,
    Plus,
    Trash2,
    Search,
    RefreshCw,
    MapPin,
    Calendar,
    Percent,
    Sun,
    Wind,
    Droplets,
    UserPlus,
    FileText,
    Check
} from 'lucide-react';

// Tipos
interface DadosBasicos {
    nome: string;
    capacidade_kwp: number;
    tipo_geracao: string;
    data_conexao: string;
    endereco: string;
    cidade: string;
    uf: string;
}

interface UCGeradora {
    modo: 'existente' | 'nova';
    uc_id?: number;
    uc_formatada?: string;
    cod_empresa?: number;
    cdc?: number;
    digito_verificador?: number;
}

interface Gestor {
    usuario_id: string;
    nome: string;
    email: string;
    comissao: number;
}

interface NovoBeneficiario {
    id?: string; // ID temporário
    cpf: string;
    nome: string;
    email: string;
    telefone: string;
    percentual_rateio: number;
    uc_id?: number;
    uc_formatada?: string;
}

// Constantes
const TIPOS_GERACAO = [
    { value: 'SOLAR', label: 'Solar Fotovoltaica', icon: Sun },
    { value: 'EOLICA', label: 'Eólica', icon: Wind },
    { value: 'HIDRAULICA', label: 'Hidráulica', icon: Droplets },
];

const UFS = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'];

export function NovaUsina() {
    const navigate = useNavigate();

    // Estado do wizard
    const [etapaAtual, setEtapaAtual] = useState(1);
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState<string | null>(null);
    const [sucesso, setSucesso] = useState(false);
    const [usinaIdCriada, setUsinaIdCriada] = useState<number | null>(null);

    // Dados do formulário
    const [dadosBasicos, setDadosBasicos] = useState<DadosBasicos>({
        nome: '',
        capacidade_kwp: 0,
        tipo_geracao: 'SOLAR',
        data_conexao: '',
        endereco: '',
        cidade: '',
        uf: 'MT'
    });

    const [ucGeradora, setUcGeradora] = useState<UCGeradora>({
        modo: 'existente',
    });

    const [gestores, setGestores] = useState<Gestor[]>([]);
    const [beneficiarios, setBeneficiarios] = useState<NovoBeneficiario[]>([]);

    // Estado para busca de UCs
    const [ucsDisponiveis, setUcsDisponiveis] = useState<UnidadeConsumidora[]>([]);
    const [loadingUcs, setLoadingUcs] = useState(false);

    // Estado para adicionar gestores/beneficiários
    const [novoGestorEmail, setNovoGestorEmail] = useState('');
    const [novoBeneficiario, setNovoBeneficiario] = useState<NovoBeneficiario>({
        cpf: '',
        nome: '',
        email: '',
        telefone: '',
        percentual_rateio: 0
    });

    // Carregar UCs geradoras disponíveis
    useEffect(() => {
        fetchUcsGeradoras();
    }, []);

    const fetchUcsGeradoras = async () => {
        try {
            setLoadingUcs(true);
            const response = await ucsApi.minhas(true);
            // Filtrar UCs que são geradoras e não estão vinculadas a uma usina
            const geradoras = (response.data || []).filter(uc => uc.is_geradora);
            setUcsDisponiveis(geradoras);
        } catch (err) {
            console.error('Erro ao carregar UCs:', err);
        } finally {
            setLoadingUcs(false);
        }
    };

    // Calcular total de rateio
    const totalRateio = beneficiarios.reduce((acc, b) => acc + (Number(b.percentual_rateio) || 0), 0);

    // Validação por etapa
    const validarEtapa = (etapa: number): boolean => {
        switch (etapa) {
            case 1:
                return dadosBasicos.nome.length >= 3 && dadosBasicos.capacidade_kwp > 0;
            case 2:
                if (ucGeradora.modo === 'existente') {
                    return !!ucGeradora.uc_id;
                }
                return !!(ucGeradora.cod_empresa && ucGeradora.cdc && ucGeradora.digito_verificador);
            case 3:
                return true; // Gestores são opcionais
            case 4:
                return totalRateio <= 100;
            case 5:
                return true;
            default:
                return false;
        }
    };

    // Navegação entre etapas
    const proximaEtapa = () => {
        if (validarEtapa(etapaAtual) && etapaAtual < 5) {
            setEtapaAtual(etapaAtual + 1);
        }
    };

    const etapaAnterior = () => {
        if (etapaAtual > 1) {
            setEtapaAtual(etapaAtual - 1);
        }
    };

    // Adicionar gestor
    const adicionarGestor = () => {
        if (!novoGestorEmail) return;

        // Por enquanto, adicionar com dados básicos (em produção, buscar usuário por email)
        setGestores([...gestores, {
            usuario_id: `temp-${Date.now()}`,
            nome: novoGestorEmail.split('@')[0],
            email: novoGestorEmail,
            comissao: 5 // Comissão padrão de 5%
        }]);
        setNovoGestorEmail('');
    };

    const removerGestor = (index: number) => {
        setGestores(gestores.filter((_, i) => i !== index));
    };

    // Adicionar beneficiário
    const adicionarBeneficiario = () => {
        if (!novoBeneficiario.cpf || !novoBeneficiario.nome || novoBeneficiario.percentual_rateio <= 0) {
            return;
        }

        // Validar CPF
        const cpfLimpo = novoBeneficiario.cpf.replace(/\D/g, '');
        if (cpfLimpo.length !== 11) {
            setErro('CPF deve ter 11 dígitos');
            return;
        }

        // Validar rateio
        if (totalRateio + novoBeneficiario.percentual_rateio > 100) {
            setErro('O total de rateio não pode exceder 100%');
            return;
        }

        setBeneficiarios([...beneficiarios, {
            ...novoBeneficiario,
            id: `temp-${Date.now()}`,
            cpf: cpfLimpo
        }]);

        // Limpar formulário
        setNovoBeneficiario({
            cpf: '',
            nome: '',
            email: '',
            telefone: '',
            percentual_rateio: 0
        });
        setErro(null);
    };

    const removerBeneficiario = (id: string) => {
        setBeneficiarios(beneficiarios.filter(b => b.id !== id));
    };

    // Formatação de CPF
    const formatarCpf = (cpf: string) => {
        const numeros = cpf.replace(/\D/g, '');
        if (numeros.length <= 3) return numeros;
        if (numeros.length <= 6) return `${numeros.slice(0, 3)}.${numeros.slice(3)}`;
        if (numeros.length <= 9) return `${numeros.slice(0, 3)}.${numeros.slice(3, 6)}.${numeros.slice(6)}`;
        return `${numeros.slice(0, 3)}.${numeros.slice(3, 6)}.${numeros.slice(6, 9)}-${numeros.slice(9, 11)}`;
    };

    // Criar usina
    const criarUsina = async () => {
        try {
            setSalvando(true);
            setErro(null);

            // Determinar UC geradora
            let cod_empresa = ucGeradora.cod_empresa;
            let cdc = ucGeradora.cdc;
            let digito_verificador = ucGeradora.digito_verificador;

            if (ucGeradora.modo === 'existente' && ucGeradora.uc_id) {
                const ucSelecionada = ucsDisponiveis.find(uc => uc.id === ucGeradora.uc_id);
                if (ucSelecionada) {
                    cod_empresa = ucSelecionada.cod_empresa;
                    cdc = ucSelecionada.cdc;
                    digito_verificador = ucSelecionada.digito_verificador;
                }
            }

            if (!cod_empresa || !cdc || !digito_verificador) {
                throw new Error('Dados da UC geradora incompletos');
            }

            // 1. Criar a usina
            const usinaData: UsinaCreateRequest = {
                nome: dadosBasicos.nome,
                cod_empresa,
                cdc,
                digito_verificador,
                capacidade_kwp: dadosBasicos.capacidade_kwp,
                tipo_geracao: dadosBasicos.tipo_geracao,
                endereco: dadosBasicos.endereco,
                cidade: dadosBasicos.cidade,
                uf: dadosBasicos.uf,
                data_conexao: dadosBasicos.data_conexao || undefined
            };

            const usinaResponse = await usinasApi.criar(usinaData);
            const usinaId = usinaResponse.data.id;
            setUsinaIdCriada(usinaId);

            // 2. Adicionar gestores (se houver)
            for (const gestor of gestores) {
                try {
                    await usinasApi.adicionarGestor(usinaId, {
                        usuario_id: gestor.usuario_id,
                        permissoes: ['gerenciar_beneficiarios', 'gerar_cobrancas']
                    });
                } catch (err) {
                    console.error(`Erro ao adicionar gestor ${gestor.email}:`, err);
                }
            }

            // 3. Adicionar beneficiários (se houver)
            for (const beneficiario of beneficiarios) {
                try {
                    // Primeiro, precisamos de uma UC para o beneficiário
                    // Por enquanto, usamos a UC geradora como referência
                    const beneficiarioData: BeneficiarioCreateRequest = {
                        usina_id: usinaId,
                        uc_id: beneficiario.uc_id || ucGeradora.uc_id || 0,
                        cpf: beneficiario.cpf,
                        nome: beneficiario.nome,
                        email: beneficiario.email || undefined,
                        telefone: beneficiario.telefone || undefined,
                        percentual_rateio: beneficiario.percentual_rateio,
                        desconto: 30 // Desconto padrão de 30%
                    };

                    await beneficiariosApi.criar(beneficiarioData);
                } catch (err) {
                    console.error(`Erro ao adicionar beneficiário ${beneficiario.nome}:`, err);
                }
            }

            setSucesso(true);
        } catch (err: any) {
            console.error('Erro ao criar usina:', err);
            setErro(err.response?.data?.detail || err.message || 'Erro ao criar usina');
        } finally {
            setSalvando(false);
        }
    };

    // Se sucesso, mostrar mensagem
    if (sucesso) {
        return (
            <div className="max-w-2xl mx-auto py-12">
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-8 text-center">
                    <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                        Usina Criada com Sucesso!
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 mb-6">
                        A usina "{dadosBasicos.nome}" foi cadastrada com sucesso.
                        {beneficiarios.length > 0 && ` ${beneficiarios.length} beneficiário(s) foram vinculados.`}
                    </p>
                    <div className="flex gap-3 justify-center">
                        <button
                            onClick={() => navigate('/app/proprietario/usinas')}
                            className="px-6 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition"
                        >
                            Ver Minhas Usinas
                        </button>
                        <button
                            onClick={() => {
                                // Reset form
                                setSucesso(false);
                                setEtapaAtual(1);
                                setDadosBasicos({
                                    nome: '',
                                    capacidade_kwp: 0,
                                    tipo_geracao: 'SOLAR',
                                    data_conexao: '',
                                    endereco: '',
                                    cidade: '',
                                    uf: 'MT'
                                });
                                setUcGeradora({ modo: 'existente' });
                                setGestores([]);
                                setBeneficiarios([]);
                            }}
                            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                        >
                            Cadastrar Outra
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                    Nova Usina
                </h1>
                <p className="text-slate-500 dark:text-slate-400">
                    Cadastre uma nova usina geradora
                </p>
            </div>

            {/* Progress Bar */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <div className="flex items-center justify-between mb-2">
                    {[
                        { num: 1, label: 'Dados Básicos', icon: FileText },
                        { num: 2, label: 'UC Geradora', icon: Zap },
                        { num: 3, label: 'Gestores', icon: Users },
                        { num: 4, label: 'Beneficiários', icon: UserPlus },
                        { num: 5, label: 'Revisão', icon: Check }
                    ].map((etapa, idx) => (
                        <div key={etapa.num} className="flex items-center">
                            <div className={`flex items-center gap-2 ${idx > 0 ? 'ml-4' : ''}`}>
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition ${
                                    etapaAtual >= etapa.num
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-slate-100 dark:bg-slate-700 text-slate-400'
                                }`}>
                                    <etapa.icon size={18} />
                                </div>
                                <span className={`hidden md:block text-sm font-medium ${
                                    etapaAtual >= etapa.num
                                        ? 'text-blue-600 dark:text-blue-400'
                                        : 'text-slate-400'
                                }`}>
                                    {etapa.label}
                                </span>
                            </div>
                            {idx < 4 && (
                                <div className={`w-8 lg:w-16 h-1 mx-2 rounded ${
                                    etapaAtual > etapa.num
                                        ? 'bg-blue-500'
                                        : 'bg-slate-200 dark:bg-slate-700'
                                }`} />
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Erro */}
            {erro && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-center gap-3">
                    <AlertCircle className="text-red-500" size={20} />
                    <p className="text-red-700 dark:text-red-400">{erro}</p>
                    <button
                        onClick={() => setErro(null)}
                        className="ml-auto text-red-500 hover:text-red-700"
                    >
                        ×
                    </button>
                </div>
            )}

            {/* Conteúdo da Etapa */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                {/* Etapa 1: Dados Básicos */}
                {etapaAtual === 1 && (
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                                Dados Básicos da Usina
                            </h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Nome da Usina *
                                </label>
                                <input
                                    type="text"
                                    value={dadosBasicos.nome}
                                    onChange={(e) => setDadosBasicos({ ...dadosBasicos, nome: e.target.value })}
                                    placeholder="Ex: Usina Solar Norte"
                                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-900 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Capacidade (kWp) *
                                </label>
                                <input
                                    type="number"
                                    value={dadosBasicos.capacidade_kwp || ''}
                                    onChange={(e) => setDadosBasicos({ ...dadosBasicos, capacidade_kwp: Number(e.target.value) })}
                                    placeholder="Ex: 500"
                                    min="0"
                                    step="0.1"
                                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-900 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Tipo de Geração
                                </label>
                                <div className="flex gap-2">
                                    {TIPOS_GERACAO.map(tipo => (
                                        <button
                                            key={tipo.value}
                                            type="button"
                                            onClick={() => setDadosBasicos({ ...dadosBasicos, tipo_geracao: tipo.value })}
                                            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border transition ${
                                                dadosBasicos.tipo_geracao === tipo.value
                                                    ? 'bg-blue-500 text-white border-blue-500'
                                                    : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-300'
                                            }`}
                                        >
                                            <tipo.icon size={18} />
                                            <span className="hidden sm:inline">{tipo.label.split(' ')[0]}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Data de Conexão
                                </label>
                                <input
                                    type="date"
                                    value={dadosBasicos.data_conexao}
                                    onChange={(e) => setDadosBasicos({ ...dadosBasicos, data_conexao: e.target.value })}
                                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-900 dark:text-white"
                                />
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Endereço
                                </label>
                                <input
                                    type="text"
                                    value={dadosBasicos.endereco}
                                    onChange={(e) => setDadosBasicos({ ...dadosBasicos, endereco: e.target.value })}
                                    placeholder="Ex: Rodovia BR-163, Km 5"
                                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-900 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Cidade
                                </label>
                                <input
                                    type="text"
                                    value={dadosBasicos.cidade}
                                    onChange={(e) => setDadosBasicos({ ...dadosBasicos, cidade: e.target.value })}
                                    placeholder="Ex: Cuiabá"
                                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-900 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    UF
                                </label>
                                <select
                                    value={dadosBasicos.uf}
                                    onChange={(e) => setDadosBasicos({ ...dadosBasicos, uf: e.target.value })}
                                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-900 dark:text-white"
                                >
                                    {UFS.map(uf => (
                                        <option key={uf} value={uf}>{uf}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                )}

                {/* Etapa 2: UC Geradora */}
                {etapaAtual === 2 && (
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                                UC Geradora
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Selecione ou cadastre a Unidade Consumidora geradora da usina
                            </p>
                        </div>

                        {/* Seletor de modo */}
                        <div className="flex gap-4">
                            <button
                                type="button"
                                onClick={() => setUcGeradora({ ...ucGeradora, modo: 'existente' })}
                                className={`flex-1 p-4 rounded-lg border-2 transition ${
                                    ucGeradora.modo === 'existente'
                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                        : 'border-slate-200 dark:border-slate-700'
                                }`}
                            >
                                <Search className={ucGeradora.modo === 'existente' ? 'text-blue-500' : 'text-slate-400'} size={24} />
                                <p className={`font-medium mt-2 ${ucGeradora.modo === 'existente' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-300'}`}>
                                    Selecionar Existente
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    Escolha uma UC já cadastrada
                                </p>
                            </button>
                            <button
                                type="button"
                                onClick={() => setUcGeradora({ ...ucGeradora, modo: 'nova' })}
                                className={`flex-1 p-4 rounded-lg border-2 transition ${
                                    ucGeradora.modo === 'nova'
                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                        : 'border-slate-200 dark:border-slate-700'
                                }`}
                            >
                                <Plus className={ucGeradora.modo === 'nova' ? 'text-blue-500' : 'text-slate-400'} size={24} />
                                <p className={`font-medium mt-2 ${ucGeradora.modo === 'nova' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-300'}`}>
                                    Cadastrar Nova
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    Informe os dados da UC
                                </p>
                            </button>
                        </div>

                        {ucGeradora.modo === 'existente' ? (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Selecione a UC Geradora
                                    </label>
                                    <button
                                        onClick={fetchUcsGeradoras}
                                        className="text-sm text-blue-500 hover:text-blue-600 flex items-center gap-1"
                                    >
                                        <RefreshCw size={14} />
                                        Atualizar
                                    </button>
                                </div>

                                {loadingUcs ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                                    </div>
                                ) : ucsDisponiveis.length === 0 ? (
                                    <div className="text-center py-8 bg-slate-50 dark:bg-slate-900 rounded-lg">
                                        <Zap className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                                        <p className="text-slate-500 dark:text-slate-400">
                                            Nenhuma UC geradora disponível
                                        </p>
                                        <p className="text-sm text-slate-400 dark:text-slate-500">
                                            Cadastre uma nova UC ou vincule via Energisa
                                        </p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {ucsDisponiveis.map(uc => (
                                            <button
                                                key={uc.id}
                                                type="button"
                                                onClick={() => setUcGeradora({
                                                    ...ucGeradora,
                                                    uc_id: uc.id,
                                                    uc_formatada: `${uc.cod_empresa}/${uc.cdc}-${uc.digito_verificador}`
                                                })}
                                                className={`p-4 rounded-lg border-2 text-left transition ${
                                                    ucGeradora.uc_id === uc.id
                                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                                        : 'border-slate-200 dark:border-slate-700 hover:border-blue-300'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="font-mono font-medium text-slate-900 dark:text-white">
                                                        {uc.cod_empresa}/{uc.cdc}-{uc.digito_verificador}
                                                    </span>
                                                    {ucGeradora.uc_id === uc.id && (
                                                        <CheckCircle className="text-blue-500" size={20} />
                                                    )}
                                                </div>
                                                {uc.endereco && (
                                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                                                        <MapPin size={14} />
                                                        {uc.endereco}
                                                    </p>
                                                )}
                                                {uc.nome_titular && (
                                                    <p className="text-xs text-slate-400 mt-1">
                                                        Titular: {uc.nome_titular}
                                                    </p>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
                                    Informe os dados da UC no formato da Energisa: Empresa/CDC-Dígito (ex: 6/4242904-3)
                                </p>

                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                            Cód. Empresa
                                        </label>
                                        <input
                                            type="number"
                                            value={ucGeradora.cod_empresa || ''}
                                            onChange={(e) => setUcGeradora({ ...ucGeradora, cod_empresa: Number(e.target.value) })}
                                            placeholder="6"
                                            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-900 dark:text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                            CDC
                                        </label>
                                        <input
                                            type="number"
                                            value={ucGeradora.cdc || ''}
                                            onChange={(e) => setUcGeradora({ ...ucGeradora, cdc: Number(e.target.value) })}
                                            placeholder="4242904"
                                            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-900 dark:text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                            Dígito
                                        </label>
                                        <input
                                            type="number"
                                            value={ucGeradora.digito_verificador || ''}
                                            onChange={(e) => setUcGeradora({ ...ucGeradora, digito_verificador: Number(e.target.value) })}
                                            placeholder="3"
                                            max="9"
                                            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-900 dark:text-white"
                                        />
                                    </div>
                                </div>

                                {ucGeradora.cod_empresa && ucGeradora.cdc && ucGeradora.digito_verificador && (
                                    <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                                        <p className="text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
                                            <CheckCircle size={16} />
                                            UC: {ucGeradora.cod_empresa}/{ucGeradora.cdc}-{ucGeradora.digito_verificador}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Etapa 3: Gestores */}
                {etapaAtual === 3 && (
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                                Gestores
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Adicione gestores para gerenciar a usina (opcional)
                            </p>
                        </div>

                        {/* Adicionar Gestor */}
                        <div className="flex gap-2">
                            <input
                                type="email"
                                value={novoGestorEmail}
                                onChange={(e) => setNovoGestorEmail(e.target.value)}
                                placeholder="Email do gestor"
                                className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-900 dark:text-white"
                            />
                            <button
                                type="button"
                                onClick={adicionarGestor}
                                disabled={!novoGestorEmail}
                                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50 flex items-center gap-2"
                            >
                                <Plus size={18} />
                                Adicionar
                            </button>
                        </div>

                        {/* Lista de Gestores */}
                        {gestores.length === 0 ? (
                            <div className="text-center py-8 bg-slate-50 dark:bg-slate-900 rounded-lg">
                                <Users className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                                <p className="text-slate-500 dark:text-slate-400">
                                    Nenhum gestor adicionado
                                </p>
                                <p className="text-sm text-slate-400 dark:text-slate-500">
                                    Você pode adicionar gestores depois
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {gestores.map((gestor, index) => (
                                    <div
                                        key={gestor.usuario_id}
                                        className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                                                <Users className="text-blue-600 dark:text-blue-400" size={20} />
                                            </div>
                                            <div>
                                                <p className="font-medium text-slate-900 dark:text-white">
                                                    {gestor.email}
                                                </p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    Comissão: {gestor.comissao}%
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removerGestor(index)}
                                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Etapa 4: Beneficiários */}
                {etapaAtual === 4 && (
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                                Beneficiários
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Adicione os beneficiários que receberão créditos da usina
                            </p>
                        </div>

                        {/* Formulário para adicionar */}
                        <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        CPF *
                                    </label>
                                    <input
                                        type="text"
                                        value={formatarCpf(novoBeneficiario.cpf)}
                                        onChange={(e) => setNovoBeneficiario({ ...novoBeneficiario, cpf: e.target.value.replace(/\D/g, '') })}
                                        placeholder="000.000.000-00"
                                        maxLength={14}
                                        className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-900 dark:text-white font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Nome *
                                    </label>
                                    <input
                                        type="text"
                                        value={novoBeneficiario.nome}
                                        onChange={(e) => setNovoBeneficiario({ ...novoBeneficiario, nome: e.target.value })}
                                        placeholder="Nome completo"
                                        className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-900 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        value={novoBeneficiario.email}
                                        onChange={(e) => setNovoBeneficiario({ ...novoBeneficiario, email: e.target.value })}
                                        placeholder="email@exemplo.com"
                                        className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-900 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Telefone
                                    </label>
                                    <input
                                        type="tel"
                                        value={novoBeneficiario.telefone}
                                        onChange={(e) => setNovoBeneficiario({ ...novoBeneficiario, telefone: e.target.value })}
                                        placeholder="(65) 99999-9999"
                                        className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-900 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Percentual de Rateio (%) *
                                    </label>
                                    <input
                                        type="number"
                                        value={novoBeneficiario.percentual_rateio || ''}
                                        onChange={(e) => setNovoBeneficiario({ ...novoBeneficiario, percentual_rateio: Number(e.target.value) })}
                                        placeholder="Ex: 10"
                                        min="0"
                                        max={100 - totalRateio}
                                        step="0.1"
                                        className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-900 dark:text-white"
                                    />
                                </div>
                                <div className="flex items-end">
                                    <button
                                        type="button"
                                        onClick={adicionarBeneficiario}
                                        disabled={!novoBeneficiario.cpf || !novoBeneficiario.nome || novoBeneficiario.percentual_rateio <= 0}
                                        className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        <Plus size={18} />
                                        Adicionar Beneficiário
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Resumo de Rateio */}
                        <div className={`p-3 rounded-lg border ${
                            totalRateio > 100
                                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                                : totalRateio === 100
                                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                                : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                        }`}>
                            <div className="flex items-center justify-between">
                                <span className={`text-sm font-medium ${
                                    totalRateio > 100
                                        ? 'text-red-700 dark:text-red-400'
                                        : totalRateio === 100
                                        ? 'text-green-700 dark:text-green-400'
                                        : 'text-amber-700 dark:text-amber-400'
                                }`}>
                                    Total de Rateio
                                </span>
                                <span className={`text-lg font-bold ${
                                    totalRateio > 100
                                        ? 'text-red-700 dark:text-red-400'
                                        : totalRateio === 100
                                        ? 'text-green-700 dark:text-green-400'
                                        : 'text-amber-700 dark:text-amber-400'
                                }`}>
                                    {totalRateio.toFixed(1)}%
                                </span>
                            </div>
                            <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full mt-2 overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all ${
                                        totalRateio > 100
                                            ? 'bg-red-500'
                                            : totalRateio === 100
                                            ? 'bg-green-500'
                                            : 'bg-amber-500'
                                    }`}
                                    style={{ width: `${Math.min(totalRateio, 100)}%` }}
                                />
                            </div>
                        </div>

                        {/* Lista de Beneficiários */}
                        {beneficiarios.length === 0 ? (
                            <div className="text-center py-8 bg-slate-50 dark:bg-slate-900 rounded-lg">
                                <UserPlus className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                                <p className="text-slate-500 dark:text-slate-400">
                                    Nenhum beneficiário adicionado
                                </p>
                                <p className="text-sm text-slate-400 dark:text-slate-500">
                                    Adicione beneficiários usando o formulário acima
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {beneficiarios.map((beneficiario) => (
                                    <div
                                        key={beneficiario.id}
                                        className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                                                <Users className="text-green-600 dark:text-green-400" size={20} />
                                            </div>
                                            <div>
                                                <p className="font-medium text-slate-900 dark:text-white">
                                                    {beneficiario.nome}
                                                </p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    CPF: {formatarCpf(beneficiario.cpf)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                                                {beneficiario.percentual_rateio}%
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => removerBeneficiario(beneficiario.id!)}
                                                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Etapa 5: Revisão */}
                {etapaAtual === 5 && (
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                                Revisão e Confirmação
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Confira os dados antes de criar a usina
                            </p>
                        </div>

                        {/* Dados Básicos */}
                        <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4">
                            <h3 className="font-medium text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                                <Building2 size={18} className="text-blue-500" />
                                Dados da Usina
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                                <div>
                                    <p className="text-slate-500 dark:text-slate-400">Nome</p>
                                    <p className="font-medium text-slate-900 dark:text-white">{dadosBasicos.nome}</p>
                                </div>
                                <div>
                                    <p className="text-slate-500 dark:text-slate-400">Capacidade</p>
                                    <p className="font-medium text-slate-900 dark:text-white">{dadosBasicos.capacidade_kwp} kWp</p>
                                </div>
                                <div>
                                    <p className="text-slate-500 dark:text-slate-400">Tipo</p>
                                    <p className="font-medium text-slate-900 dark:text-white">
                                        {TIPOS_GERACAO.find(t => t.value === dadosBasicos.tipo_geracao)?.label || dadosBasicos.tipo_geracao}
                                    </p>
                                </div>
                                {dadosBasicos.data_conexao && (
                                    <div>
                                        <p className="text-slate-500 dark:text-slate-400">Data Conexão</p>
                                        <p className="font-medium text-slate-900 dark:text-white">
                                            {new Date(dadosBasicos.data_conexao).toLocaleDateString('pt-BR')}
                                        </p>
                                    </div>
                                )}
                                {dadosBasicos.cidade && (
                                    <div>
                                        <p className="text-slate-500 dark:text-slate-400">Localização</p>
                                        <p className="font-medium text-slate-900 dark:text-white">
                                            {dadosBasicos.cidade}, {dadosBasicos.uf}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* UC Geradora */}
                        <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4">
                            <h3 className="font-medium text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                                <Zap size={18} className="text-yellow-500" />
                                UC Geradora
                            </h3>
                            <p className="font-mono text-slate-900 dark:text-white">
                                {ucGeradora.modo === 'existente' && ucGeradora.uc_formatada
                                    ? ucGeradora.uc_formatada
                                    : `${ucGeradora.cod_empresa}/${ucGeradora.cdc}-${ucGeradora.digito_verificador}`
                                }
                            </p>
                        </div>

                        {/* Gestores */}
                        {gestores.length > 0 && (
                            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4">
                                <h3 className="font-medium text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                                    <Users size={18} className="text-blue-500" />
                                    Gestores ({gestores.length})
                                </h3>
                                <div className="space-y-2">
                                    {gestores.map((gestor, idx) => (
                                        <div key={idx} className="flex items-center justify-between text-sm">
                                            <span className="text-slate-600 dark:text-slate-300">{gestor.email}</span>
                                            <span className="text-slate-500 dark:text-slate-400">{gestor.comissao}% comissão</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Beneficiários */}
                        {beneficiarios.length > 0 && (
                            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4">
                                <h3 className="font-medium text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                                    <UserPlus size={18} className="text-green-500" />
                                    Beneficiários ({beneficiarios.length})
                                </h3>
                                <div className="space-y-2">
                                    {beneficiarios.map((beneficiario, idx) => (
                                        <div key={idx} className="flex items-center justify-between text-sm">
                                            <span className="text-slate-600 dark:text-slate-300">{beneficiario.nome}</span>
                                            <span className="text-blue-600 dark:text-blue-400 font-medium">{beneficiario.percentual_rateio}%</span>
                                        </div>
                                    ))}
                                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between font-medium">
                                        <span className="text-slate-700 dark:text-slate-300">Total de Rateio</span>
                                        <span className={totalRateio <= 100 ? 'text-green-600' : 'text-red-600'}>
                                            {totalRateio.toFixed(1)}%
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Aviso */}
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                            <p className="text-sm text-blue-700 dark:text-blue-400">
                                Ao confirmar, a usina será criada e os gestores/beneficiários serão vinculados automaticamente.
                                Você poderá editar esses dados posteriormente.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Botões de Navegação */}
            <div className="flex items-center justify-between">
                <button
                    type="button"
                    onClick={etapaAtual === 1 ? () => navigate(-1) : etapaAnterior}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition"
                >
                    <ChevronLeft size={18} />
                    {etapaAtual === 1 ? 'Cancelar' : 'Voltar'}
                </button>

                {etapaAtual < 5 ? (
                    <button
                        type="button"
                        onClick={proximaEtapa}
                        disabled={!validarEtapa(etapaAtual)}
                        className="flex items-center gap-2 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50"
                    >
                        Próximo
                        <ChevronRight size={18} />
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={criarUsina}
                        disabled={salvando || totalRateio > 100}
                        className="flex items-center gap-2 px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition disabled:opacity-50"
                    >
                        {salvando ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                Criando...
                            </>
                        ) : (
                            <>
                                <CheckCircle size={18} />
                                Criar Usina
                            </>
                        )}
                    </button>
                )}
            </div>
        </div>
    );
}

export default NovaUsina;
