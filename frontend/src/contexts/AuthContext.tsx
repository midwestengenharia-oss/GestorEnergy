import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { api } from '../lib/api';

interface Usuario {
    id: number;
    email: string;
    nome_completo: string;
    cpf: string;
    telefone: string;
}

interface AuthContextType {
    usuario: Usuario | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (email: string, senha: string) => Promise<void>;
    signup: (dados: SignupData) => Promise<void>;
    logout: () => void;
    refreshAuth: () => Promise<boolean>;
}

interface SignupData {
    email: string;
    senha: string;
    nome_completo: string;
    cpf: string;
    telefone: string;
}

interface TokenData {
    access_token: string;
    refresh_token: string;
    expires_in: number;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = 'gestor_access_token';
const REFRESH_KEY = 'gestor_refresh_token';

export function AuthProvider({ children }: { children: ReactNode }) {
    const [usuario, setUsuario] = useState<Usuario | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Salva tokens no localStorage
    const saveTokens = (data: TokenData) => {
        localStorage.setItem(TOKEN_KEY, data.access_token);
        localStorage.setItem(REFRESH_KEY, data.refresh_token);
    };

    // Remove tokens
    const clearTokens = () => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_KEY);
    };

    // Configura header de autorizacao
    const setAuthHeader = (token: string | null) => {
        if (token) {
            api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        } else {
            delete api.defaults.headers.common['Authorization'];
        }
    };

    // Busca dados do usuario logado
    const fetchUsuario = async (): Promise<Usuario | null> => {
        try {
            const response = await api.get('/auth/me');
            return response.data;
        } catch {
            return null;
        }
    };

    // Refresh do token
    const refreshAuth = useCallback(async (): Promise<boolean> => {
        const refreshToken = localStorage.getItem(REFRESH_KEY);
        if (!refreshToken) return false;

        try {
            const response = await api.post('/auth/refresh', {
                refresh_token: refreshToken
            });
            saveTokens(response.data);
            setAuthHeader(response.data.access_token);
            return true;
        } catch {
            clearTokens();
            setAuthHeader(null);
            setUsuario(null);
            return false;
        }
    }, []);

    // Login
    const login = async (email: string, senha: string) => {
        const response = await api.post('/auth/signin', { email, senha });
        saveTokens(response.data);
        setAuthHeader(response.data.access_token);

        const user = await fetchUsuario();
        if (user) {
            setUsuario(user);
        } else {
            throw new Error('Erro ao carregar dados do usuario');
        }
    };

    // Signup
    const signup = async (dados: SignupData) => {
        const response = await api.post('/auth/signup', dados);
        saveTokens(response.data);
        setAuthHeader(response.data.access_token);

        const user = await fetchUsuario();
        if (user) {
            setUsuario(user);
        } else {
            throw new Error('Erro ao carregar dados do usuario');
        }
    };

    // Logout
    const logout = useCallback(() => {
        // Tenta fazer logout no servidor (nao critico se falhar)
        api.post('/auth/logout').catch(() => {});
        clearTokens();
        setAuthHeader(null);
        setUsuario(null);
    }, []);

    // Inicializacao - verifica se ha token salvo
    useEffect(() => {
        const initAuth = async () => {
            const token = localStorage.getItem(TOKEN_KEY);

            if (token) {
                setAuthHeader(token);
                const user = await fetchUsuario();

                if (user) {
                    setUsuario(user);
                } else {
                    // Token expirado, tenta refresh
                    const refreshed = await refreshAuth();
                    if (refreshed) {
                        const refreshedUser = await fetchUsuario();
                        setUsuario(refreshedUser);
                    }
                }
            }

            setIsLoading(false);
        };

        initAuth();
    }, [refreshAuth]);

    // Interceptor para refresh automatico em 401
    useEffect(() => {
        const interceptor = api.interceptors.response.use(
            (response) => response,
            async (error) => {
                const originalRequest = error.config;

                // Se for 401 e nao for retry, tenta refresh
                if (error.response?.status === 401 && !originalRequest._retry) {
                    originalRequest._retry = true;

                    const refreshed = await refreshAuth();
                    if (refreshed) {
                        const token = localStorage.getItem(TOKEN_KEY);
                        originalRequest.headers['Authorization'] = `Bearer ${token}`;
                        return api(originalRequest);
                    } else {
                        logout();
                    }
                }

                return Promise.reject(error);
            }
        );

        return () => {
            api.interceptors.response.eject(interceptor);
        };
    }, [refreshAuth, logout]);

    const value: AuthContextType = {
        usuario,
        isAuthenticated: !!usuario,
        isLoading,
        login,
        signup,
        logout,
        refreshAuth
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth deve ser usado dentro de AuthProvider');
    }
    return context;
}
