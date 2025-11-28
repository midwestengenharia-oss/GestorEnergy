import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { useTheme } from './contexts/ThemeContext';
import { SignIn } from './pages/SignIn';
import { SignUp } from './pages/SignUp';
import { LandingPage } from './pages/LandingPage';
import { SimulationFlow } from './pages/SimulationFlow';
import App from './App';
import { Loader2, Zap } from 'lucide-react';

type AuthPage = 'signin' | 'signup';

function AuthenticatedApp() {
    const { isAuthenticated } = useAuth();
    const [authPage, setAuthPage] = useState<AuthPage>('signin');

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

export function AppRouter() {
    const { isLoading } = useAuth();
    const { isDark } = useTheme();

    // Tela de loading inicial
    if (isLoading) {
        return (
            <div className={`min-h-screen flex flex-col items-center justify-center ${isDark ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900' : 'bg-gradient-to-br from-slate-100 via-white to-slate-100'}`}>
                <div className="inline-flex items-center justify-center w-20 h-20 bg-[#00A3E0] rounded-2xl mb-6 shadow-lg shadow-blue-500/30 animate-pulse">
                    <Zap className="text-white" size={40} />
                </div>
                <Loader2 size={32} className="text-[#00A3E0] animate-spin mb-4" />
                <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>Carregando...</p>
            </div>
        );
    }

    return (
        <BrowserRouter>
            <Routes>
                {/* Public Routes */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/simular" element={<SimulationFlow />} />

                {/* Auth Routes */}
                <Route path="/app/*" element={<AuthenticatedApp />} />

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    );
}
