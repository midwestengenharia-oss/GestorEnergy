/**
 * Routes - Configuração centralizada de rotas
 */

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePerfil } from '../contexts/PerfilContext';

// Layouts
import { MainLayout } from '../layouts/MainLayout';
import { AuthLayout } from '../layouts/AuthLayout';

// Auth Pages
import { SignInPage, SignUpPage } from '../pages/auth';

// Dashboards
import { DashboardAdmin, SyncStatus, GestaoUsuarios, GestaoLeads, LeadDetail, LogsAuditoria, Impostos } from '../pages/admin';
import { DashboardProprietario, NovaUsina } from '../pages/proprietario';
import { DashboardGestor, UsinasGestor, BeneficiariosGestor, CobrancasGestor, RateioGestor, FinanceiroGestor, ContratosGestor, GestaoLeads as GestaoLeadsGestor, LeadDetail as LeadDetailGestor, KanbanLeads as KanbanLeadsGestor, ProcessamentoCobrancas, GestaoClientes } from '../pages/gestor';
import { CobrancasAutomaticas } from '../pages/gestor/CobrancasAutomaticas';
import { KanbanFaturas } from '../pages/gestor/KanbanFaturas';
import { DashboardBeneficiario } from '../pages/beneficiario';
import { DashboardUsuario, MinhasUCs, FaturasUsuario, DetalheUC, ConectarEnergisa, GeracaoDistribuida } from '../pages/usuario';
import { DashboardParceiro } from '../pages/parceiro';

// Public Pages (importar das existentes)
import { LandingPage } from '../pages/LandingPage';
import { SimulationFlow } from '../pages/SimulationFlow';

// Mapeamento de perfil para rota (quando são diferentes)
const PERFIL_ROTA_MAP: Record<string, string> = {
    superadmin: 'admin',  // perfil 'superadmin' vai para rota '/app/admin'
};

/**
 * Componente wrapper para decidir entre AuthLayout e MainLayout
 * Resolve o problema de conflito de rotas /app
 */
function AppLayoutWrapper() {
    const { isAuthenticated, isLoading } = useAuth();

    // Se está carregando, mostra loading do AuthLayout
    if (isLoading) {
        return <AuthLayout showLoading />;
    }

    // Se não autenticado, mostra AuthLayout (login/cadastro)
    if (!isAuthenticated) {
        return <AuthLayout />;
    }

    // Se autenticado, mostra MainLayout
    return <MainLayout />;
}

/**
 * Componente para redirecionar ao dashboard do perfil ativo
 */
function RedirectToDashboard() {
    const { isAuthenticated } = useAuth();
    const { perfilAtivo } = usePerfil();

    // Se não estiver autenticado, vai para login
    if (!isAuthenticated) {
        return <Navigate to="/app" replace />;
    }

    // Se não tem perfil ativo ainda, usa 'usuario' como padrão
    if (!perfilAtivo) {
        return <Navigate to="/app/usuario" replace />;
    }

    // Mapeia o perfil para a rota correta (ex: superadmin -> admin)
    const rota = PERFIL_ROTA_MAP[perfilAtivo] || perfilAtivo;
    return <Navigate to={`/app/${rota}`} replace />;
}

/**
 * Componente de rota protegida por perfil
 * Permite acesso se o usuário tiver o perfil nos perfisDisponiveis
 * E troca automaticamente para o perfil correto ao acessar a rota
 */
function ProtectedRoute({
    children,
    allowedPerfis
}: {
    children: React.ReactNode;
    allowedPerfis: string[];
}) {
    const { isAuthenticated } = useAuth();
    const { perfilAtivo, perfisDisponiveis, trocarPerfil } = usePerfil();

    // Troca automaticamente o perfil quando acessar uma rota de outro perfil que o usuário tem
    React.useEffect(() => {
        if (perfilAtivo && !allowedPerfis.includes(perfilAtivo)) {
            const perfilCorreto = allowedPerfis.find(p => perfisDisponiveis.includes(p as any));
            if (perfilCorreto) {
                trocarPerfil(perfilCorreto as any);
            }
        }
    }, [perfilAtivo, allowedPerfis, perfisDisponiveis, trocarPerfil]);

    if (!isAuthenticated) {
        return <Navigate to="/app" replace />;
    }

    // Verifica se o usuário tem algum dos perfis permitidos
    const temPerfilPermitido = allowedPerfis.some(p => perfisDisponiveis.includes(p as any));

    if (!temPerfilPermitido) {
        // Usuário não tem nenhum dos perfis necessários, redireciona para seu dashboard
        const rota = PERFIL_ROTA_MAP[perfilAtivo || 'usuario'] || perfilAtivo || 'usuario';
        return <Navigate to={`/app/${rota}`} replace />;
    }

    return <>{children}</>;
}

/**
 * Rotas da aplicação
 */
export function AppRoutes() {
    return (
        <Routes>
            {/* ===== Rotas Públicas ===== */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/simular" element={<SimulationFlow />} />

            {/* ===== Rotas /app (Auth + Autenticadas unificadas) ===== */}
            <Route path="/app" element={<AppLayoutWrapper />}>
                {/* Rotas de autenticação (quando não logado) */}
                <Route index element={<SignInPage />} />
                <Route path="cadastro" element={<SignUpPage />} />
                {/* Redirect para dashboard do perfil */}
                <Route path="dashboard" element={<RedirectToDashboard />} />

                {/* Admin Routes */}
                <Route path="admin" element={
                    <ProtectedRoute allowedPerfis={['superadmin']}>
                        <DashboardAdmin />
                    </ProtectedRoute>
                } />
                <Route path="admin/usuarios" element={
                    <ProtectedRoute allowedPerfis={['superadmin']}>
                        <GestaoUsuarios />
                    </ProtectedRoute>
                } />
                <Route path="admin/leads" element={
                    <ProtectedRoute allowedPerfis={['superadmin']}>
                        <GestaoLeads />
                    </ProtectedRoute>
                } />
                <Route path="admin/leads/:id" element={
                    <ProtectedRoute allowedPerfis={['superadmin']}>
                        <LeadDetail />
                    </ProtectedRoute>
                } />
                <Route path="admin/saques" element={
                    <ProtectedRoute allowedPerfis={['superadmin']}>
                        <PlaceholderPage title="Gestão de Saques" />
                    </ProtectedRoute>
                } />
                <Route path="admin/config" element={
                    <ProtectedRoute allowedPerfis={['superadmin']}>
                        <PlaceholderPage title="Configurações do Sistema" />
                    </ProtectedRoute>
                } />
                <Route path="admin/logs" element={
                    <ProtectedRoute allowedPerfis={['superadmin']}>
                        <LogsAuditoria />
                    </ProtectedRoute>
                } />
                <Route path="admin/sync" element={
                    <ProtectedRoute allowedPerfis={['superadmin']}>
                        <SyncStatus />
                    </ProtectedRoute>
                } />
                <Route path="admin/impostos" element={
                    <ProtectedRoute allowedPerfis={['superadmin']}>
                        <Impostos />
                    </ProtectedRoute>
                } />

                {/* Proprietário Routes */}
                <Route path="proprietario" element={
                    <ProtectedRoute allowedPerfis={['proprietario']}>
                        <DashboardProprietario />
                    </ProtectedRoute>
                } />
                <Route path="proprietario/usinas" element={
                    <ProtectedRoute allowedPerfis={['proprietario']}>
                        <UsinasGestor />
                    </ProtectedRoute>
                } />
                <Route path="proprietario/usinas/nova" element={
                    <ProtectedRoute allowedPerfis={['proprietario']}>
                        <NovaUsina />
                    </ProtectedRoute>
                } />
                <Route path="proprietario/gestores" element={
                    <ProtectedRoute allowedPerfis={['proprietario']}>
                        <PlaceholderPage title="Gestores Vinculados" />
                    </ProtectedRoute>
                } />
                <Route path="proprietario/financeiro" element={
                    <ProtectedRoute allowedPerfis={['proprietario']}>
                        <PlaceholderPage title="Financeiro" />
                    </ProtectedRoute>
                } />
                <Route path="proprietario/contratos" element={
                    <ProtectedRoute allowedPerfis={['proprietario']}>
                        <PlaceholderPage title="Contratos" />
                    </ProtectedRoute>
                } />

                {/* Gestor Routes */}
                <Route path="gestor" element={
                    <ProtectedRoute allowedPerfis={['gestor']}>
                        <DashboardGestor />
                    </ProtectedRoute>
                } />
                <Route path="gestor/usinas" element={
                    <ProtectedRoute allowedPerfis={['gestor']}>
                        <UsinasGestor />
                    </ProtectedRoute>
                } />
                <Route path="gestor/beneficiarios" element={
                    <ProtectedRoute allowedPerfis={['gestor']}>
                        <BeneficiariosGestor />
                    </ProtectedRoute>
                } />
                <Route path="gestor/rateio" element={
                    <ProtectedRoute allowedPerfis={['gestor']}>
                        <RateioGestor />
                    </ProtectedRoute>
                } />
                <Route path="gestor/cobrancas" element={
                    <ProtectedRoute allowedPerfis={['gestor']}>
                        <CobrancasGestor />
                    </ProtectedRoute>
                } />
                <Route path="gestor/cobrancas-automaticas" element={
                    <ProtectedRoute allowedPerfis={['gestor', 'superadmin', 'proprietario']}>
                        <CobrancasAutomaticas />
                    </ProtectedRoute>
                } />
                <Route path="gestor/processar-cobrancas" element={
                    <ProtectedRoute allowedPerfis={['gestor', 'superadmin', 'proprietario']}>
                        <ProcessamentoCobrancas />
                    </ProtectedRoute>
                } />
                <Route path="gestor/kanban" element={
                    <ProtectedRoute allowedPerfis={['gestor', 'superadmin', 'proprietario']}>
                        <KanbanFaturas />
                    </ProtectedRoute>
                } />
                <Route path="gestor/financeiro" element={
                    <ProtectedRoute allowedPerfis={['gestor']}>
                        <FinanceiroGestor />
                    </ProtectedRoute>
                } />
                <Route path="gestor/contratos" element={
                    <ProtectedRoute allowedPerfis={['gestor']}>
                        <ContratosGestor />
                    </ProtectedRoute>
                } />
                <Route path="gestor/leads" element={
                    <ProtectedRoute allowedPerfis={['gestor', 'superadmin']}>
                        <GestaoLeadsGestor />
                    </ProtectedRoute>
                } />
                <Route path="gestor/leads/:id" element={
                    <ProtectedRoute allowedPerfis={['gestor', 'superadmin']}>
                        <LeadDetailGestor />
                    </ProtectedRoute>
                } />
                <Route path="gestor/kanban-leads" element={
                    <ProtectedRoute allowedPerfis={['gestor', 'superadmin']}>
                        <KanbanLeadsGestor />
                    </ProtectedRoute>
                } />
                <Route path="gestor/clientes" element={
                    <ProtectedRoute allowedPerfis={['gestor', 'superadmin', 'proprietario']}>
                        <GestaoClientes />
                    </ProtectedRoute>
                } />

                {/* Beneficiário Routes */}
                <Route path="beneficiario" element={
                    <ProtectedRoute allowedPerfis={['beneficiario']}>
                        <DashboardBeneficiario />
                    </ProtectedRoute>
                } />
                <Route path="beneficiario/creditos" element={
                    <ProtectedRoute allowedPerfis={['beneficiario']}>
                        <PlaceholderPage title="Meus Créditos" />
                    </ProtectedRoute>
                } />
                <Route path="beneficiario/economia" element={
                    <ProtectedRoute allowedPerfis={['beneficiario']}>
                        <PlaceholderPage title="Economia" />
                    </ProtectedRoute>
                } />
                <Route path="beneficiario/pagamentos" element={
                    <ProtectedRoute allowedPerfis={['beneficiario']}>
                        <PlaceholderPage title="Pagamentos" />
                    </ProtectedRoute>
                } />
                <Route path="beneficiario/contrato" element={
                    <ProtectedRoute allowedPerfis={['beneficiario']}>
                        <PlaceholderPage title="Meu Contrato" />
                    </ProtectedRoute>
                } />

                {/* Usuário Routes */}
                <Route path="usuario" element={
                    <ProtectedRoute allowedPerfis={['usuario']}>
                        <DashboardUsuario />
                    </ProtectedRoute>
                } />
                <Route path="usuario/ucs" element={
                    <ProtectedRoute allowedPerfis={['usuario', 'gestor']}>
                        <MinhasUCs />
                    </ProtectedRoute>
                } />
                <Route path="usuario/ucs/:id" element={
                    <ProtectedRoute allowedPerfis={['usuario', 'gestor']}>
                        <DetalheUC />
                    </ProtectedRoute>
                } />
                <Route path="usuario/faturas" element={
                    <ProtectedRoute allowedPerfis={['usuario', 'gestor']}>
                        <FaturasUsuario />
                    </ProtectedRoute>
                } />
                <Route path="usuario/conectar-energisa" element={
                    <ProtectedRoute allowedPerfis={['usuario']}>
                        <ConectarEnergisa />
                    </ProtectedRoute>
                } />
                <Route path="usuario/gd" element={
                    <ProtectedRoute allowedPerfis={['usuario']}>
                        <GeracaoDistribuida />
                    </ProtectedRoute>
                } />

                {/* Parceiro Routes */}
                <Route path="parceiro" element={
                    <ProtectedRoute allowedPerfis={['parceiro']}>
                        <DashboardParceiro />
                    </ProtectedRoute>
                } />
                <Route path="parceiro/projetos" element={
                    <ProtectedRoute allowedPerfis={['parceiro']}>
                        <PlaceholderPage title="Projetos" />
                    </ProtectedRoute>
                } />
                <Route path="parceiro/leads" element={
                    <ProtectedRoute allowedPerfis={['parceiro']}>
                        <PlaceholderPage title="Meus Leads" />
                    </ProtectedRoute>
                } />
                <Route path="parceiro/comissoes" element={
                    <ProtectedRoute allowedPerfis={['parceiro']}>
                        <PlaceholderPage title="Comissões" />
                    </ProtectedRoute>
                } />

                {/* Rotas Comuns */}
                <Route path="perfil" element={<PlaceholderPage title="Meu Perfil" />} />
                <Route path="configuracoes" element={<PlaceholderPage title="Configurações" />} />
                <Route path="suporte" element={<PlaceholderPage title="Ajuda e Suporte" />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

/**
 * Componente placeholder para páginas não implementadas
 */
function PlaceholderPage({ title }: { title: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-20">
            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-6">
                <span className="text-4xl">🚧</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{title}</h1>
            <p className="text-slate-500 dark:text-slate-400">Esta página está em desenvolvimento</p>
        </div>
    );
}

export default AppRoutes;
