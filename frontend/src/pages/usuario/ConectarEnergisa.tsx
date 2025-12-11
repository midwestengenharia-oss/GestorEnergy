/**
 * ConectarEnergisa - Página para conectar conta da Energisa
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { energisaApi, UcEnergisa } from '../../api/energisa';
import { ucsApi } from '../../api/ucs';
import {
    Zap,
    Phone,
    MessageSquare,
    CheckCircle,
    AlertCircle,
    Loader2,
    ArrowLeft,
    ArrowRight,
    RefreshCw,
    Plus,
    Check,
    Mail
} from 'lucide-react';

type Step = 'cpf' | 'contato' | 'sms' | 'ucs' | 'sucesso';

interface Telefone {
    celular: string;
    cdc?: number;
    posicao?: number;
}

interface Email {
    email: string;
    codigoEmpresaWeb?: number;
    cdc?: number;
    digitoVerificador?: number;
    posicao?: number;
}

type ContatoOpcao =
    | { tipo: 'telefone'; dados: Telefone }
    | { tipo: 'email'; dados: Email };

export function ConectarEnergisa() {
    const navigate = useNavigate();
    const { usuario } = useAuth();

    const [step, setStep] = useState<Step>('cpf');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Dados do fluxo
    const [cpf, setCpf] = useState(usuario?.cpf || '');
    const [transactionId, setTransactionId] = useState<string | null>(null);
    const [telefones, setTelefones] = useState<Telefone[]>([]);
    const [emails, setEmails] = useState<Email[]>([]);
    const [contatoSelecionado, setContatoSelecionado] = useState<string | null>(null);
    const [codigoSms, setCodigoSms] = useState('');
    const [ucsEnergisa, setUcsEnergisa] = useState<UcEnergisa[]>([]);
    const [ucsSelecionadas, setUcsSelecionadas] = useState<number[]>([]);
    const [ucsVinculadas, setUcsVinculadas] = useState<number>(0);

    // Formatar CPF
    const formatarCpf = (value: string) => {
        const numbers = value.replace(/\D/g, '');
        if (numbers.length <= 3) return numbers;
        if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
        if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
        return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`;
    };

    // Mascarar telefone
    const mascararTelefone = (tel: string) => {
        if (!tel) return '';
        const limpo = tel.replace(/\D/g, '');
        if (limpo.length >= 4) {
            return `(**) *****-${limpo.slice(-4)}`;
        }
        return tel;
    };

    // Step 1: Iniciar login
    const iniciarLogin = async () => {
        if (!cpf || cpf.replace(/\D/g, '').length !== 11) {
            setError('Informe um CPF válido');
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const response = await energisaApi.loginStart(cpf);
            setTransactionId(response.data.transaction_id);
            setTelefones(response.data.listaTelefone || []);
            setEmails(response.data.listaEmail || []);
            setStep('contato');
        } catch (err: any) {
            console.error('Erro ao iniciar login:', err);
            setError(err.response?.data?.detail || 'Erro ao conectar com a Energisa. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    // Step 2: Selecionar contato (telefone ou e-mail) e enviar código
    const enviarCodigo = async () => {
        if (!contatoSelecionado || !transactionId) {
            setError('Selecione um contato');
            return;
        }

        try {
            setLoading(true);
            setError(null);

            await energisaApi.loginSelectOption(transactionId, contatoSelecionado);
            setStep('sms');
        } catch (err: any) {
            console.error('Erro ao enviar SMS:', err);
            setError(err.response?.data?.detail || 'Erro ao enviar SMS. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    // Step 3: Validar código SMS
    const validarSms = async () => {
        if (!codigoSms || codigoSms.length < 4 || !transactionId) {
            setError('Informe o código SMS');
            return;
        }

        try {
            setLoading(true);
            setError(null);

            await energisaApi.loginFinish(transactionId, codigoSms);

            // Buscar UCs
            const ucsResponse = await energisaApi.listarUcs(cpf);
            setUcsEnergisa(ucsResponse.data || []);
            setStep('ucs');
        } catch (err: any) {
            console.error('Erro ao validar SMS:', err);
            setError(err.response?.data?.detail || 'Código SMS inválido. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    // Step 4: Vincular UCs selecionadas
    const vincularUcs = async () => {
        if (ucsSelecionadas.length === 0) {
            setError('Selecione pelo menos uma UC');
            return;
        }

        try {
            setLoading(true);
            setError(null);

            let vinculadas = 0;
            const cpfLimpo = cpf.replace(/\D/g, '');

            for (const ucIndex of ucsSelecionadas) {
                const uc = ucsEnergisa[ucIndex];
                try {
                    // Garante que os valores sejam números válidos (0 é válido)
                    const codEmpresa = uc.codigoEmpresaWeb ?? 6;
                    const numeroUc = uc.numeroUc ?? 0;
                    const digito = uc.digitoVerificador ?? 0;
                    const ucFormatada = `${codEmpresa}/${numeroUc}-${digito}`;
                    console.log('Vinculando UC:', ucFormatada);

                    // Envia dados completos da Energisa
                    const response = await ucsApi.vincularFormato({
                        uc_formatada: ucFormatada,
                        usuario_titular: uc.usuarioTitular || false,
                        nome_titular: uc.nomeTitular,
                        endereco: uc.endereco,
                        numero_imovel: uc.numeroImovel,
                        complemento: uc.complemento,
                        bairro: uc.bairro,
                        cidade: uc.nomeMunicipio || uc.cidade,
                        uf: uc.uf,
                        latitude: uc.latitude,
                        longitude: uc.longitude,
                        classe_leitura: uc.classeLeitura,
                        grupo_leitura: uc.grupoLeitura,
                        is_geradora: uc.geracaoDistribuida != null, // Se tem valor, é geradora
                    });

                    // Sincroniza faturas automaticamente após vincular
                    if (response.data?.id) {
                        try {
                            console.log(`Sincronizando faturas da UC ${response.data.id}...`);
                            await ucsApi.sincronizarFaturas(response.data.id, cpfLimpo);
                            console.log(`Faturas sincronizadas para UC ${response.data.id}`);
                        } catch (syncErr: any) {
                            console.warn(`Aviso: Não foi possível sincronizar faturas da UC ${response.data.id}:`, syncErr);
                            // Não falha a vinculação se a sincronização falhar
                        }
                    }

                    vinculadas++;
                } catch (err: any) {
                    console.warn(`Erro ao vincular UC ${uc.numeroUc}:`, err);
                }
            }

            setUcsVinculadas(vinculadas);
            setStep('sucesso');
        } catch (err: any) {
            console.error('Erro ao vincular UCs:', err);
            setError(err.response?.data?.detail || 'Erro ao vincular UCs. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    // Toggle seleção de UC
    const toggleUc = (index: number) => {
        setUcsSelecionadas(prev =>
            prev.includes(index)
                ? prev.filter(i => i !== index)
                : [...prev, index]
        );
    };

    // Selecionar todas
    const selecionarTodas = () => {
        if (ucsSelecionadas.length === ucsEnergisa.length) {
            setUcsSelecionadas([]);
        } else {
            setUcsSelecionadas(ucsEnergisa.map((_, i) => i));
        }
    };

    // Voltar
    const voltar = () => {
        setError(null);
        if (step === 'contato') setStep('cpf');
        else if (step === 'sms') setStep('contato');
        else if (step === 'ucs') setStep('sms');
    };

    // Reiniciar
    const reiniciar = () => {
        setStep('cpf');
        setError(null);
        setTransactionId(null);
        setTelefones([]);
        setEmails([]);
        setContatoSelecionado(null);
        setCodigoSms('');
        setUcsEnergisa([]);
        setUcsSelecionadas([]);
    };

    return (
        <div className="max-w-2xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <button
                    onClick={() => navigate('/app/usuario/ucs')}
                    className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mb-4"
                >
                    <ArrowLeft size={20} />
                    Voltar para UCs
                </button>

                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-2xl flex items-center justify-center">
                        <Zap className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                            Conectar com Energisa
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400">
                            Vincule suas UCs automaticamente
                        </p>
                    </div>
                </div>
            </div>

            {/* Progress Steps */}
            <div className="flex items-center justify-between mb-8">
                {['CPF', 'Contato', 'SMS', 'UCs'].map((label, index) => {
                    const stepNames: Step[] = ['cpf', 'contato', 'sms', 'ucs'];
                    const currentIndex = stepNames.indexOf(step);
                    const isActive = index <= currentIndex;
                    const isCurrent = stepNames[index] === step;

                    return (
                        <div key={label} className="flex items-center">
                            <div className={`
                                w-10 h-10 rounded-full flex items-center justify-center font-medium
                                ${isActive
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}
                                ${isCurrent ? 'ring-4 ring-blue-200 dark:ring-blue-900' : ''}
                            `}>
                                {index + 1}
                            </div>
                            {index < 3 && (
                                <div className={`w-16 h-1 mx-2 ${isActive ? 'bg-blue-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Error */}
            {error && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3">
                    <AlertCircle className="text-red-500 flex-shrink-0" size={20} />
                    <p className="text-red-600 dark:text-red-400">{error}</p>
                </div>
            )}

            {/* Content */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                {/* Step: CPF */}
                {step === 'cpf' && (
                    <div className="space-y-6">
                        <div className="text-center">
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                                Informe seu CPF
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400">
                                Vamos buscar suas UCs cadastradas na Energisa
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                CPF
                            </label>
                            <input
                                type="text"
                                value={cpf}
                                onChange={(e) => setCpf(formatarCpf(e.target.value))}
                                placeholder="000.000.000-00"
                                maxLength={14}
                                className="w-full px-4 py-3 text-lg text-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-900 dark:text-white"
                            />
                        </div>

                        <button
                            onClick={iniciarLogin}
                            disabled={loading || cpf.replace(/\D/g, '').length !== 11}
                            className="w-full flex items-center justify-center gap-2 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={20} className="animate-spin" />
                                    Conectando...
                                </>
                            ) : (
                                <>
                                    Continuar
                                    <ArrowRight size={20} />
                                </>
                            )}
                        </button>
                    </div>
                )}

                {/* Step: Contato */}
                {step === 'contato' && (
                    <div className="space-y-6">
                        <div className="text-center">
                            <div className="flex items-center justify-center gap-2 mb-4">
                                <Phone className="w-12 h-12 text-blue-500" />
                                <Mail className="w-12 h-12 text-purple-500" />
                            </div>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                                Selecione como receber o código
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400">
                                Escolha um telefone ou e-mail para receber o código de verificação
                            </p>
                        </div>

                        <div className="space-y-3">
                            {/* Telefones */}
                            {telefones.length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 px-2">
                                        <Phone size={16} />
                                        <span>Telefones</span>
                                    </div>
                                    {telefones.map((tel, index) => (
                                        <button
                                            key={`tel-${index}`}
                                            onClick={() => setContatoSelecionado(tel.celular)}
                                            className={`w-full p-4 rounded-lg border-2 transition flex items-center gap-4 ${
                                                contatoSelecionado === tel.celular
                                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                            }`}
                                        >
                                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                                                contatoSelecionado === tel.celular
                                                    ? 'border-blue-500 bg-blue-500'
                                                    : 'border-slate-300 dark:border-slate-600'
                                            }`}>
                                                {contatoSelecionado === tel.celular && (
                                                    <Check className="text-white" size={14} />
                                                )}
                                            </div>
                                            <Phone size={18} className="text-blue-500" />
                                            <span className="text-lg text-slate-900 dark:text-white">
                                                {mascararTelefone(tel.celular)}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* E-mails */}
                            {emails.length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 px-2 mt-4">
                                        <Mail size={16} />
                                        <span>E-mails</span>
                                    </div>
                                    {emails.map((emailObj, index) => {
                                        // Mascara o e-mail: m***@***.com
                                        const mascararEmail = (email: string) => {
                                            const [local, domain] = email.split('@');
                                            if (!local || !domain) return email;
                                            const localMascarado = local[0] + '***';
                                            const domainParts = domain.split('.');
                                            const domainMascarado = domainParts.map((part, idx) =>
                                                idx === domainParts.length - 1 ? part : '***'
                                            ).join('.');
                                            return `${localMascarado}@${domainMascarado}`;
                                        };

                                        return (
                                            <button
                                                key={`email-${index}`}
                                                onClick={() => setContatoSelecionado(emailObj.email)}
                                                className={`w-full p-4 rounded-lg border-2 transition flex items-center gap-4 ${
                                                    contatoSelecionado === emailObj.email
                                                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                                                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                                }`}
                                            >
                                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                                                    contatoSelecionado === emailObj.email
                                                        ? 'border-purple-500 bg-purple-500'
                                                        : 'border-slate-300 dark:border-slate-600'
                                                }`}>
                                                    {contatoSelecionado === emailObj.email && (
                                                        <Check className="text-white" size={14} />
                                                    )}
                                                </div>
                                                <Mail size={18} className="text-purple-500" />
                                                <span className="text-lg text-slate-900 dark:text-white">
                                                    {mascararEmail(emailObj.email)}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {telefones.length === 0 && emails.length === 0 && (
                                <div className="text-center py-8">
                                    <AlertCircle className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                                    <p className="text-slate-500 dark:text-slate-400">
                                        Nenhum contato disponível
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={voltar}
                                className="flex-1 py-3 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                            >
                                Voltar
                            </button>
                            <button
                                onClick={enviarCodigo}
                                disabled={loading || !contatoSelecionado}
                                className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 size={20} className="animate-spin" />
                                        Enviando...
                                    </>
                                ) : (
                                    <>
                                        Enviar código
                                        <ArrowRight size={20} />
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* Step: SMS */}
                {step === 'sms' && (
                    <div className="space-y-6">
                        <div className="text-center">
                            <MessageSquare className="w-12 h-12 text-blue-500 mx-auto mb-4" />
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                                Digite o código de verificação
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400">
                                {contatoSelecionado?.includes('@')
                                    ? `Enviamos um código para ${contatoSelecionado}`
                                    : `Enviamos um código SMS para ${mascararTelefone(contatoSelecionado || '')}`
                                }
                            </p>
                        </div>

                        <div>
                            <input
                                type="text"
                                value={codigoSms}
                                onChange={(e) => setCodigoSms(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                placeholder="000000"
                                maxLength={6}
                                className="w-full px-4 py-4 text-2xl text-center tracking-widest bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-900 dark:text-white"
                            />
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={voltar}
                                className="flex-1 py-3 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                            >
                                Voltar
                            </button>
                            <button
                                onClick={validarSms}
                                disabled={loading || codigoSms.length < 4}
                                className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 size={20} className="animate-spin" />
                                        Validando...
                                    </>
                                ) : (
                                    <>
                                        Validar
                                        <ArrowRight size={20} />
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* Step: UCs */}
                {step === 'ucs' && (
                    <div className="space-y-6">
                        <div className="text-center">
                            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                                Selecione as UCs para vincular
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400">
                                Encontramos {ucsEnergisa.length} UC(s) no seu CPF
                            </p>
                        </div>

                        {ucsEnergisa.length > 0 && (
                            <div className="flex justify-end">
                                <button
                                    onClick={selecionarTodas}
                                    className="text-sm text-blue-500 hover:text-blue-600"
                                >
                                    {ucsSelecionadas.length === ucsEnergisa.length ? 'Desmarcar todas' : 'Selecionar todas'}
                                </button>
                            </div>
                        )}

                        <div className="space-y-4 max-h-96 overflow-y-auto">
                            {/* Seção: UCs onde é titular (perfil "usuario") */}
                            {ucsEnergisa.some(uc => uc.usuarioTitular) && (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                                        <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full">
                                            Titular
                                        </span>
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                            Suas UCs (você é o titular)
                                        </span>
                                    </div>
                                    {ucsEnergisa.map((uc, index) => uc.usuarioTitular && (
                                        <button
                                            key={index}
                                            onClick={() => toggleUc(index)}
                                            className={`w-full p-4 rounded-lg border-2 transition flex items-start gap-4 text-left ${
                                                ucsSelecionadas.includes(index)
                                                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                                                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                            }`}
                                        >
                                            <div className={`w-6 h-6 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                                ucsSelecionadas.includes(index)
                                                    ? 'border-green-500 bg-green-500'
                                                    : 'border-slate-300 dark:border-slate-600'
                                            }`}>
                                                {ucsSelecionadas.includes(index) && (
                                                    <Check className="text-white" size={14} />
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-medium text-slate-900 dark:text-white">
                                                        UC {uc.codigoEmpresaWeb}/{uc.numeroUc}-{uc.digitoVerificador}
                                                    </p>
                                                    {uc.geracaoDistribuida != null && (
                                                        <span className="px-1.5 py-0.5 text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 rounded">
                                                            GD
                                                        </span>
                                                    )}
                                                </div>
                                                {uc.endereco && (
                                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                                        {uc.endereco}
                                                        {uc.cidade && `, ${uc.cidade}`}
                                                        {uc.uf && `/${uc.uf}`}
                                                    </p>
                                                )}
                                                {uc.nomeTitular && (
                                                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                                                        {uc.nomeTitular}
                                                    </p>
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Seção: UCs onde não é titular (perfil "gestor") */}
                            {ucsEnergisa.some(uc => !uc.usuarioTitular) && (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                                        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-full">
                                            Gestor
                                        </span>
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                            UCs que você gerencia (não é titular)
                                        </span>
                                    </div>
                                    {ucsEnergisa.map((uc, index) => !uc.usuarioTitular && (
                                        <button
                                            key={index}
                                            onClick={() => toggleUc(index)}
                                            className={`w-full p-4 rounded-lg border-2 transition flex items-start gap-4 text-left ${
                                                ucsSelecionadas.includes(index)
                                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                            }`}
                                        >
                                            <div className={`w-6 h-6 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                                ucsSelecionadas.includes(index)
                                                    ? 'border-blue-500 bg-blue-500'
                                                    : 'border-slate-300 dark:border-slate-600'
                                            }`}>
                                                {ucsSelecionadas.includes(index) && (
                                                    <Check className="text-white" size={14} />
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-medium text-slate-900 dark:text-white">
                                                        UC {uc.codigoEmpresaWeb}/{uc.numeroUc}-{uc.digitoVerificador}
                                                    </p>
                                                    {uc.geracaoDistribuida != null && (
                                                        <span className="px-1.5 py-0.5 text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 rounded">
                                                            GD
                                                        </span>
                                                    )}
                                                </div>
                                                {uc.endereco && (
                                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                                        {uc.endereco}
                                                        {uc.cidade && `, ${uc.cidade}`}
                                                        {uc.uf && `/${uc.uf}`}
                                                    </p>
                                                )}
                                                {uc.nomeTitular && (
                                                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                                                        Titular: {uc.nomeTitular}
                                                    </p>
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {ucsEnergisa.length === 0 && (
                                <div className="text-center py-8">
                                    <Zap className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                                    <p className="text-slate-500 dark:text-slate-400">
                                        Nenhuma UC encontrada
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Info sobre perfis */}
                        {ucsSelecionadas.length > 0 && (
                            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 text-sm">
                                <p className="text-slate-600 dark:text-slate-400">
                                    Ao vincular, você receberá automaticamente:
                                </p>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {ucsSelecionadas.some(i => ucsEnergisa[i]?.usuarioTitular) && (
                                        <span className="px-2 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full text-xs font-medium">
                                            Perfil Usuário
                                        </span>
                                    )}
                                    {ucsSelecionadas.some(i => !ucsEnergisa[i]?.usuarioTitular) && (
                                        <span className="px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-full text-xs font-medium">
                                            Perfil Gestor
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={reiniciar}
                                className="flex-1 py-3 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                            >
                                <RefreshCw size={18} className="inline mr-2" />
                                Recomeçar
                            </button>
                            <button
                                onClick={vincularUcs}
                                disabled={loading || ucsSelecionadas.length === 0}
                                className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 size={20} className="animate-spin" />
                                        Vinculando...
                                    </>
                                ) : (
                                    <>
                                        <Plus size={20} />
                                        Vincular {ucsSelecionadas.length} UC(s)
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* Step: Sucesso */}
                {step === 'sucesso' && (
                    <div className="text-center py-8">
                        <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle className="w-10 h-10 text-green-500" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                            UCs vinculadas com sucesso!
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 mb-8">
                            {ucsVinculadas} UC(s) foram adicionadas à sua conta
                        </p>
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={reiniciar}
                                className="px-6 py-3 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                            >
                                Vincular mais UCs
                            </button>
                            <button
                                onClick={() => navigate('/app/usuario/ucs')}
                                className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                            >
                                Ver minhas UCs
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ConectarEnergisa;
