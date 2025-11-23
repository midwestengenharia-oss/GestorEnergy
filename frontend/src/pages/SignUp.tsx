import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { Loader2, Mail, Lock, User, Phone, CreditCard, Zap, ArrowLeft } from 'lucide-react';

interface SignUpProps {
    onSwitchToSignIn: () => void;
}

// Funcao para formatar CPF
const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 11);
    return numbers
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};

// Funcao para formatar telefone
const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 11);
    if (numbers.length <= 10) {
        return numbers
            .replace(/(\d{2})(\d)/, '($1) $2')
            .replace(/(\d{4})(\d)/, '$1-$2');
    }
    return numbers
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d)/, '$1-$2');
};

export function SignUp({ onSwitchToSignIn }: SignUpProps) {
    const { signup } = useAuth();
    const toast = useToast();

    const [formData, setFormData] = useState({
        nome_completo: '',
        email: '',
        cpf: '',
        telefone: '',
        senha: '',
        confirmarSenha: ''
    });
    const [loading, setLoading] = useState(false);

    const handleChange = (field: string, value: string) => {
        let formattedValue = value;

        if (field === 'cpf') {
            formattedValue = formatCPF(value);
        } else if (field === 'telefone') {
            formattedValue = formatPhone(value);
        }

        setFormData(prev => ({ ...prev, [field]: formattedValue }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validacoes basicas
        if (!formData.nome_completo || !formData.email || !formData.cpf || !formData.telefone || !formData.senha) {
            toast.warning('Preencha todos os campos');
            return;
        }

        if (formData.nome_completo.split(' ').length < 2) {
            toast.warning('Informe nome e sobrenome');
            return;
        }

        if (formData.senha.length < 6) {
            toast.warning('Senha deve ter pelo menos 6 caracteres');
            return;
        }

        if (formData.senha !== formData.confirmarSenha) {
            toast.warning('As senhas nao conferem');
            return;
        }

        setLoading(true);
        try {
            await signup({
                nome_completo: formData.nome_completo,
                email: formData.email,
                cpf: formData.cpf.replace(/\D/g, ''),
                telefone: formData.telefone.replace(/\D/g, ''),
                senha: formData.senha
            });
            toast.success('Conta criada com sucesso!');
        } catch (err: any) {
            toast.error(err.message || 'Erro ao criar conta');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 py-8">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-14 h-14 bg-[#00A3E0] rounded-2xl mb-3 shadow-lg shadow-blue-500/30">
                        <Zap className="text-white" size={28} />
                    </div>
                    <h1 className="text-2xl font-bold text-white">GestorEnergy</h1>
                </div>

                {/* Card de Cadastro */}
                <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8">
                    <div className="flex items-center gap-3 mb-6">
                        <button
                            onClick={onSwitchToSignIn}
                            className="p-2 hover:bg-slate-100 rounded-lg transition"
                        >
                            <ArrowLeft size={20} className="text-slate-600" />
                        </button>
                        <h2 className="text-xl font-bold text-slate-800">Criar conta</h2>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Nome completo
                            </label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    value={formData.nome_completo}
                                    onChange={(e) => handleChange('nome_completo', e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#00A3E0] focus:border-transparent outline-none transition text-sm"
                                    placeholder="Seu nome completo"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Email
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => handleChange('email', e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#00A3E0] focus:border-transparent outline-none transition text-sm"
                                    placeholder="seu@email.com"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    CPF
                                </label>
                                <div className="relative">
                                    <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <input
                                        type="text"
                                        value={formData.cpf}
                                        onChange={(e) => handleChange('cpf', e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#00A3E0] focus:border-transparent outline-none transition text-sm"
                                        placeholder="000.000.000-00"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Telefone
                                </label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <input
                                        type="text"
                                        value={formData.telefone}
                                        onChange={(e) => handleChange('telefone', e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#00A3E0] focus:border-transparent outline-none transition text-sm"
                                        placeholder="(00) 00000-0000"
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Senha
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="password"
                                    value={formData.senha}
                                    onChange={(e) => handleChange('senha', e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#00A3E0] focus:border-transparent outline-none transition text-sm"
                                    placeholder="Minimo 6 caracteres"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Confirmar senha
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="password"
                                    value={formData.confirmarSenha}
                                    onChange={(e) => handleChange('confirmarSenha', e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#00A3E0] focus:border-transparent outline-none transition text-sm"
                                    placeholder="Repita a senha"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-[#00A3E0] text-white py-3 rounded-lg font-bold hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-6"
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={20} className="animate-spin" />
                                    Criando conta...
                                </>
                            ) : (
                                'Criar conta'
                            )}
                        </button>
                    </form>

                    <div className="mt-4 text-center">
                        <p className="text-slate-600 text-sm">
                            Ja tem uma conta?{' '}
                            <button
                                onClick={onSwitchToSignIn}
                                className="text-[#00A3E0] font-bold hover:underline"
                            >
                                Entrar
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
