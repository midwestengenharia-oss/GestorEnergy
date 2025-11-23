import { useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import { SignIn } from './pages/SignIn';
import { SignUp } from './pages/SignUp';
import App from './App';
import { Loader2, Zap } from 'lucide-react';

type AuthPage = 'signin' | 'signup';

export function AppRouter() {
    const { isAuthenticated, isLoading } = useAuth();
    const [authPage, setAuthPage] = useState<AuthPage>('signin');

    // Tela de loading inicial
    if (isLoading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-[#00A3E0] rounded-2xl mb-6 shadow-lg shadow-blue-500/30 animate-pulse">
                    <Zap className="text-white" size={40} />
                </div>
                <Loader2 size={32} className="text-[#00A3E0] animate-spin mb-4" />
                <p className="text-slate-400">Carregando...</p>
            </div>
        );
    }

    // Se nao autenticado, mostra telas de auth
    if (!isAuthenticated) {
        if (authPage === 'signin') {
            return <SignIn onSwitchToSignUp={() => setAuthPage('signup')} />;
        }
        return <SignUp onSwitchToSignIn={() => setAuthPage('signin')} />;
    }

    // Autenticado - mostra o app principal
    return <App />;
}
