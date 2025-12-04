/**
 * AuthLayout - Layout para páginas de autenticação (SignIn/SignUp)
 */

import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePerfil } from '../contexts/PerfilContext';
import { useTheme } from '../contexts/ThemeContext';
import { Zap, Loader2 } from 'lucide-react';

export function AuthLayout() {
    const { isAuthenticated, isLoading } = useAuth();
    const { perfilAtivo } = usePerfil();
    const { isDark } = useTheme();

    // Loading
    if (isLoading) {
        return (
            <div className={`min-h-screen flex flex-col items-center justify-center ${isDark ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900' : 'bg-gradient-to-br from-slate-100 via-white to-slate-100'}`}>
                <div className="w-16 h-16 bg-[#00A3E0] rounded-2xl flex items-center justify-center mb-4">
                    <Zap className="text-white" size={32} />
                </div>
                <Loader2 className="animate-spin text-[#00A3E0]" size={32} />
            </div>
        );
    }

    // Se já autenticado, redireciona para o dashboard do perfil
    if (isAuthenticated) {
        // Se perfilAtivo está definido, vai direto para o dashboard do perfil
        if (perfilAtivo) {
            return <Navigate to={`/app/${perfilAtivo}`} replace />;
        }
        // Senão, vai para a rota de redirecionamento que resolverá o perfil
        return <Navigate to="/app/dashboard" replace />;
    }

    return <Outlet />;
}

export default AuthLayout;
