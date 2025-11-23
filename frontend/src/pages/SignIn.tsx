import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../components/Toast';
import { Loader2, Mail, Lock, Zap, Moon, SunMedium } from 'lucide-react';

interface SignInProps {
    onSwitchToSignUp: () => void;
}

export function SignIn({ onSwitchToSignUp }: SignInProps) {
    const { login } = useAuth();
    const { isDark, toggleTheme } = useTheme();
    const toast = useToast();

    const [email, setEmail] = useState('');
    const [senha, setSenha] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email || !senha) {
            toast.warning('Preencha todos os campos');
            return;
        }

        setLoading(true);
        try {
            await login(email, senha);
            toast.success('Login realizado com sucesso!');
        } catch (err: any) {
            toast.error(err.message || 'Email ou senha incorretos');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`min-h-screen flex items-center justify-center p-4 transition-colors duration-300 ${isDark ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900' : 'bg-gradient-to-br from-slate-100 via-white to-slate-200'}`}>
            {/* Toggle Theme Button */}
            <button
                onClick={toggleTheme}
                className={`absolute top-4 right-4 p-3 rounded-full transition ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-400' : 'bg-white hover:bg-slate-100 text-slate-600 shadow-md'}`}
            >
                {isDark ? <SunMedium size={20} /> : <Moon size={20} />}
            </button>

            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-[#00A3E0] rounded-2xl mb-4 shadow-lg shadow-blue-500/30">
                        <Zap className="text-white" size={32} />
                    </div>
                    <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>GestorEnergy</h1>
                    <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>Gerencie suas faturas de energia</p>
                </div>

                {/* Card de Login */}
                <div className={`rounded-2xl shadow-2xl p-8 ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
                    <h2 className={`text-2xl font-bold mb-6 ${isDark ? 'text-white' : 'text-slate-800'}`}>Entrar</h2>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                Email
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#00A3E0] focus:border-transparent outline-none transition ${isDark ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400' : 'bg-white border-slate-200 text-slate-900'}`}
                                    placeholder="seu@email.com"
                                />
                            </div>
                        </div>

                        <div>
                            <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                Senha
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                                <input
                                    type="password"
                                    value={senha}
                                    onChange={(e) => setSenha(e.target.value)}
                                    className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#00A3E0] focus:border-transparent outline-none transition ${isDark ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400' : 'bg-white border-slate-200 text-slate-900'}`}
                                    placeholder="Digite sua senha"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-[#00A3E0] text-white py-3 rounded-lg font-bold hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={20} className="animate-spin" />
                                    Entrando...
                                </>
                            ) : (
                                'Entrar'
                            )}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                            Nao tem uma conta?{' '}
                            <button
                                onClick={onSwitchToSignUp}
                                className="text-[#00A3E0] font-bold hover:underline"
                            >
                                Criar conta
                            </button>
                        </p>
                    </div>
                </div>

                <p className={`text-center text-sm mt-6 ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>
                    Plataforma segura para gestao de faturas de energia
                </p>
            </div>
        </div>
    );
}
