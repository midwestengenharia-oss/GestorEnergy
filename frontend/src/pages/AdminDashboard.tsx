import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Users, TrendingUp, DollarSign, Clock, CheckCircle } from 'lucide-react';

interface DashboardStats {
  total_leads: number;
  leads_por_status: Record<string, number>;
  leads_hoje: number;
  leads_semana: number;
  taxa_conversao: number;
  valor_total_potencial: number;
}

export function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarStats();
  }, []);

  const carregarStats = async () => {
    try {
      const response = await api.get('/admin/leads/stats/dashboard');
      setStats(response.data);
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600 dark:text-gray-400">Erro ao carregar estatísticas</p>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total de Leads',
      value: stats.total_leads,
      icon: Users,
      color: 'bg-blue-500',
      textColor: 'text-blue-600',
    },
    {
      title: 'Leads Hoje',
      value: stats.leads_hoje,
      icon: Clock,
      color: 'bg-green-500',
      textColor: 'text-green-600',
    },
    {
      title: 'Leads (7 dias)',
      value: stats.leads_semana,
      icon: TrendingUp,
      color: 'bg-purple-500',
      textColor: 'text-purple-600',
    },
    {
      title: 'Taxa de Conversão',
      value: `${stats.taxa_conversao}%`,
      icon: CheckCircle,
      color: 'bg-emerald-500',
      textColor: 'text-emerald-600',
    },
    {
      title: 'Valor Potencial',
      value: `R$ ${stats.valor_total_potencial.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: 'bg-amber-500',
      textColor: 'text-amber-600',
    },
  ];

  const statusLabels: Record<string, string> = {
    NOVO: 'Novos',
    CONTATADO: 'Contatados',
    QUALIFICADO: 'Qualificados',
    PROPOSTA_ENVIADA: 'Proposta Enviada',
    NEGOCIACAO: 'Em Negociação',
    CONVERTIDO: 'Convertidos',
    PERDIDO: 'Perdidos',
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard Super Admin</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Visão geral da plataforma e gerenciamento de leads
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-8">
          {statCards.map((card, index) => (
            <div
              key={index}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{card.title}</p>
                  <p className={`text-2xl font-bold ${card.textColor}`}>{card.value}</p>
                </div>
                <div className={`${card.color} p-3 rounded-lg`}>
                  <card.icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Leads por Status */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Funil de Conversão
            </h2>
            <div className="space-y-3">
              {Object.entries(stats.leads_por_status).map(([status, count]) => (
                <div key={status}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {statusLabels[status] || status}
                    </span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {count}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{
                        width: `${stats.total_leads > 0 ? (count / stats.total_leads) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Ações Rápidas
            </h2>
            <div className="space-y-3">
              <button
                onClick={() => navigate('/admin/leads?status=NOVO')}
                className="w-full flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
              >
                <span className="text-blue-700 dark:text-blue-300 font-medium">
                  Ver Leads Novos
                </span>
                <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm">
                  {stats.leads_por_status.NOVO || 0}
                </span>
              </button>

              <button
                onClick={() => navigate('/admin/leads')}
                className="w-full flex items-center justify-between p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
              >
                <span className="text-purple-700 dark:text-purple-300 font-medium">
                  Gerenciar Todos os Leads
                </span>
                <span className="bg-purple-600 text-white px-3 py-1 rounded-full text-sm">
                  {stats.total_leads}
                </span>
              </button>

              <button
                onClick={() => navigate('/admin/leads?status=NEGOCIACAO')}
                className="w-full flex items-center justify-between p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
              >
                <span className="text-amber-700 dark:text-amber-300 font-medium">
                  Em Negociação
                </span>
                <span className="bg-amber-600 text-white px-3 py-1 rounded-full text-sm">
                  {stats.leads_por_status.NEGOCIACAO || 0}
                </span>
              </button>

              <button
                onClick={() => navigate('/gestores')}
                className="w-full flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
              >
                <span className="text-green-700 dark:text-green-300 font-medium">
                  Gerenciar Usinas
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
