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
const TOKEN_EXPIRY_KEY = 'gestor_token_expiry';

export function AuthProvider({ children }: { children: ReactNode }) {
    const [usuario, setUsuario] = useState<Usuario | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Salva tokens no localStorage
    const saveTokens = (data: TokenData) => {
        localStorage.setItem(TOKEN_KEY, data.access_token);
        localStorage.setItem(REFRESH_KEY, data.refresh_token);
        // Calcula quando o token expira (agora + expires_in - 5 minutos de margem)
        const expiryTime = Date.now() + (data.expires_in * 1000) - (5 * 60 * 1000);
        localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
        console.log('[Auth] Tokens salvos. Expira em:', new Date(expiryTime).toLocaleString());
    };

    // Remove tokens
    const clearTokens = () => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_KEY);
        localStorage.removeItem(TOKEN_EXPIRY_KEY);
    };

    // Verifica se o token está próximo de expirar
    const isTokenExpiringSoon = (): boolean => {
        const expiryTime = localStorage.getItem(TOKEN_EXPIRY_KEY);
        if (!expiryTime) return true;
        return Date.now() >= parseInt(expiryTime);
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
        // Evita múltiplos refreshes simultâneos
        if (isRefreshing) {
            console.log('[Auth] Refresh já em andamento, aguardando...');
            return false;
        }

        const refreshToken = localStorage.getItem(REFRESH_KEY);
        if (!refreshToken) {
            console.log('[Auth] Nenhum refresh token encontrado');
            return false;
        }

        setIsRefreshing(true);
        console.log('[Auth] Iniciando refresh do token...');

        try {
            const response = await api.post('/auth/refresh', {
                refresh_token: refreshToken
            });
            saveTokens(response.data);
            setAuthHeader(response.data.access_token);
            console.log('[Auth] Token renovado com sucesso');
            setIsRefreshing(false);
            return true;
        } catch (error) {
            console.error('[Auth] Erro ao renovar token:', error);
            clearTokens();
            setAuthHeader(null);
            setUsuario(null);
            setIsRefreshing(false);
            return false;
        }
    }, [isRefreshing]);

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

    // Timer de refresh automático (verifica a cada 1 minuto)
    useEffect(() => {
        if (!isAuthenticated) return;

        const checkTokenExpiry = async () => {
            if (isTokenExpiringSoon() && !isRefreshing) {
                console.log('[Auth] Timer: Token próximo de expirar, fazendo refresh...');
                await refreshAuth();
            }
        };

        // Verifica a cada 60 segundos
        const interval = setInterval(checkTokenExpiry, 60 * 1000);

        return () => clearInterval(interval);
    }, [isAuthenticated, refreshAuth, isRefreshing]);

    // Interceptor de REQUEST - verifica se token está expirando antes de fazer requisição
    useEffect(() => {
        const requestInterceptor = api.interceptors.request.use(
            async (config) => {
                // Ignora requisições de auth
                if (config.url?.includes('/auth/')) {
                    return config;
                }

                // Verifica se token está próximo de expirar
                if (isTokenExpiringSoon() && !isRefreshing) {
                    console.log('[Auth] Token próximo de expirar, fazendo refresh preventivo...');
                    await refreshAuth();
                }

                // Atualiza o header com o token atual (pode ter sido renovado)
                const token = localStorage.getItem(TOKEN_KEY);
                if (token) {
                    config.headers['Authorization'] = `Bearer ${token}`;
                }

                return config;
            },
            (error) => Promise.reject(error)
        );

        return () => {
            api.interceptors.request.eject(requestInterceptor);
        };
    }, [refreshAuth, isRefreshing]);

    // Interceptor de RESPONSE - tenta refresh em caso de 401
    useEffect(() => {
        const responseInterceptor = api.interceptors.response.use(
            (response) => response,
            async (error) => {
                const originalRequest = error.config;

                // Se for 401 e não for retry
                if (error.response?.status === 401 && !originalRequest._retry) {
                    originalRequest._retry = true;
                    console.log('[Auth] Erro 401 detectado, tentando refresh...');

                    const refreshed = await refreshAuth();
                    if (refreshed) {
                        console.log('[Auth] Refresh bem-sucedido, retentando requisição original...');
                        const token = localStorage.getItem(TOKEN_KEY);
                        originalRequest.headers['Authorization'] = `Bearer ${token}`;
                        return api(originalRequest);
                    } else {
                        console.log('[Auth] Refresh falhou, fazendo logout...');
                        logout();
                    }
                }

                return Promise.reject(error);
            }
        );

        return () => {
            api.interceptors.response.eject(responseInterceptor);
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
