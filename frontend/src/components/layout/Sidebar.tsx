/**
 * Sidebar - Menu lateral dinâmico por perfil
 */

import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard,
    Zap,
    FileText,
    Users,
    Building2,
    Wallet,
    Settings,
    HelpCircle,
    PieChart,
    FileSignature,
    Bell,
    UserCog,
    Target,
    Package,
    ChevronLeft,
    ChevronRight,
    PlugZap,
    Sun,
    RefreshCw,
    Kanban,
    DollarSign,
    Receipt,
} from 'lucide-react';
import { usePerfil, PERFIL_LABELS, PERFIL_CORES } from '../../contexts/PerfilContext';
import type { PerfilTipo } from '../../api/types';

interface MenuItem {
    label: string;
    path: string;
    icon: React.ElementType;
}

interface MenuSection {
    title?: string;
    items: MenuItem[];
}

// Menus por perfil
const MENUS: Record<PerfilTipo, MenuSection[]> = {
    superadmin: [
        {
            items: [
                { label: 'Dashboard', path: '/app/admin', icon: LayoutDashboard },
            ],
        },
        {
            title: 'Gestão',
            items: [
                { label: 'Usuários', path: '/app/admin/usuarios', icon: Users },
                { label: 'Leads', path: '/app/admin/leads', icon: Target },
                { label: 'Saques', path: '/app/admin/saques', icon: Wallet },
            ],
        },
        {
            title: 'Sistema',
            items: [
                { label: 'Sincronização', path: '/app/admin/sync', icon: RefreshCw },
                { label: 'Impostos', path: '/app/admin/impostos', icon: Receipt },
                { label: 'Configurações', path: '/app/admin/config', icon: Settings },
                { label: 'Logs', path: '/app/admin/logs', icon: FileText },
            ],
        },
    ],
    proprietario: [
        {
            items: [
                { label: 'Dashboard', path: '/app/proprietario', icon: LayoutDashboard },
            ],
        },
        {
            title: 'Usinas',
            items: [
                { label: 'Minhas Usinas', path: '/app/proprietario/usinas', icon: Building2 },
                { label: 'Gestores', path: '/app/proprietario/gestores', icon: Users },
            ],
        },
        {
            title: 'Financeiro',
            items: [
                { label: 'Financeiro', path: '/app/proprietario/financeiro', icon: Wallet },
                { label: 'Contratos', path: '/app/proprietario/contratos', icon: FileSignature },
            ],
        },
    ],
    gestor: [
        {
            items: [
                { label: 'Dashboard', path: '/app/gestor', icon: LayoutDashboard },
            ],
        },
        {
            title: 'CRM',
            items: [
                { label: 'Leads', path: '/app/gestor/leads', icon: Target },
                { label: 'Kanban Leads', path: '/app/gestor/kanban-leads', icon: Kanban },
                { label: 'Kanban Faturas', path: '/app/gestor/kanban', icon: Kanban },
            ],
        },
        {
            title: 'Gestão',
            items: [
                { label: 'Usinas', path: '/app/gestor/usinas', icon: Building2 },
                { label: 'UCs Gerenciadas', path: '/app/usuario/ucs', icon: Zap },
                { label: 'Clientes', path: '/app/gestor/clientes', icon: Users },
                { label: 'Beneficiários', path: '/app/gestor/beneficiarios', icon: Users },
                { label: 'Rateio', path: '/app/gestor/rateio', icon: PieChart },
            ],
        },
        {
            title: 'Financeiro',
            items: [
                { label: 'Processar Faturas', path: '/app/gestor/processar-cobrancas', icon: FileText },
                { label: 'Cobranças', path: '/app/gestor/cobrancas', icon: Wallet },
                { label: 'Financeiro', path: '/app/gestor/financeiro', icon: DollarSign },
                { label: 'Contratos', path: '/app/gestor/contratos', icon: FileSignature },
            ],
        },
    ],
    beneficiario: [
        {
            items: [
                { label: 'Dashboard', path: '/app/beneficiario', icon: LayoutDashboard },
            ],
        },
        {
            title: 'Energia',
            items: [
                { label: 'Meus Créditos', path: '/app/beneficiario/creditos', icon: Zap },
                { label: 'Economia', path: '/app/beneficiario/economia', icon: PieChart },
            ],
        },
        {
            title: 'Financeiro',
            items: [
                { label: 'Pagamentos', path: '/app/beneficiario/pagamentos', icon: Wallet },
                { label: 'Contrato', path: '/app/beneficiario/contrato', icon: FileSignature },
            ],
        },
    ],
    usuario: [
        {
            items: [
                { label: 'Dashboard', path: '/app/usuario', icon: LayoutDashboard },
            ],
        },
        {
            title: 'Minhas UCs',
            items: [
                { label: 'Unidades', path: '/app/usuario/ucs', icon: Zap },
                { label: 'Faturas', path: '/app/usuario/faturas', icon: FileText },
                { label: 'Geração Distribuída', path: '/app/usuario/gd', icon: Sun },
            ],
        },
        {
            title: 'Integrações',
            items: [
                { label: 'Conectar Energisa', path: '/app/usuario/conectar-energisa', icon: PlugZap },
            ],
        },
    ],
    parceiro: [
        {
            items: [
                { label: 'Dashboard', path: '/app/parceiro', icon: LayoutDashboard },
            ],
        },
    ],
};

interface SidebarProps {
    isCollapsed: boolean;
    onToggle: () => void;
}

export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
    const { perfilAtivo } = usePerfil();

    if (!perfilAtivo) return null;

    const menu = MENUS[perfilAtivo] || [];
    const perfilCor = PERFIL_CORES[perfilAtivo];

    return (
        <aside
            className={`
                fixed left-0 top-0 z-40 h-screen bg-white dark:bg-slate-900
                border-r border-slate-200 dark:border-slate-700
                transition-all duration-300 ease-in-out
                ${isCollapsed ? 'w-16' : 'w-64'}
            `}
        >
            {/* Logo */}
            <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200 dark:border-slate-700">
                {!isCollapsed && (
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-[#00A3E0] rounded-lg flex items-center justify-center">
                            <Zap className="text-white" size={20} />
                        </div>
                        <span className="font-bold text-slate-900 dark:text-white">
                            Plataforma GD
                        </span>
                    </div>
                )}
                <button
                    onClick={onToggle}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                >
                    {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
                </button>
            </div>

            {/* Perfil ativo */}
            {!isCollapsed && (
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Atuando como</span>
                    <div className={`mt-1 text-sm font-medium text-${perfilCor}-600 dark:text-${perfilCor}-400`}>
                        {PERFIL_LABELS[perfilAtivo]}
                    </div>
                </div>
            )}

            {/* Menu */}
            <nav className="p-3 space-y-4 overflow-y-auto h-[calc(100vh-8rem)]">
                {menu.map((section, idx) => (
                    <div key={idx}>
                        {section.title && !isCollapsed && (
                            <h3 className="px-3 mb-2 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                {section.title}
                            </h3>
                        )}
                        <ul className="space-y-1">
                            {section.items.map((item) => (
                                <li key={item.path}>
                                    <NavLink
                                        to={item.path}
                                        className={({ isActive }) => `
                                            flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
                                            transition-colors duration-150
                                            ${isActive
                                                ? 'bg-[#00A3E0] text-white'
                                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                            }
                                            ${isCollapsed ? 'justify-center' : ''}
                                        `}
                                        title={isCollapsed ? item.label : undefined}
                                    >
                                        <item.icon size={20} />
                                        {!isCollapsed && <span>{item.label}</span>}
                                    </NavLink>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </nav>

            {/* Footer */}
            <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-slate-200 dark:border-slate-700">
                <NavLink
                    to="/app/suporte"
                    className={`
                        flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
                        text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800
                        ${isCollapsed ? 'justify-center' : ''}
                    `}
                    title={isCollapsed ? 'Ajuda' : undefined}
                >
                    <HelpCircle size={20} />
                    {!isCollapsed && <span>Ajuda</span>}
                </NavLink>
            </div>
        </aside>
    );
}

export default Sidebar;
