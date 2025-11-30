import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import {
  User, Phone, Mail, TrendingUp, Eye, Edit,
  Calendar, DollarSign, Zap, ArrowLeft
} from 'lucide-react';

interface Lead {
  id: number;
  cpf: string;
  nome: string | null;
  telefone: string | null;
  email: string | null;
  total_ucs: number;
  total_consumo_kwh: number;
  valor_total_faturas: number;
  status: string;
  cliente_id: number | null;
  uc_geradora_id: number | null;
  observacoes: string | null;
  motivo_perda: string | null;
  criado_em: string;
  atualizado_em: string;
  convertido_em: string | null;
  origem: string;
}

const STATUS_COLORS: Record<string, string> = {
  NOVO: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  CONTATADO: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  QUALIFICADO: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  PROPOSTA_ENVIADA: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  NEGOCIACAO: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  CONVERTIDO: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  PERDIDO: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

const STATUS_LABELS: Record<string, string> = {
  NOVO: 'Novo',
  CONTATADO: 'Contatado',
  QUALIFICADO: 'Qualificado',
  PROPOSTA_ENVIADA: 'Proposta Enviada',
  NEGOCIACAO: 'Em Negociação',
  CONVERTIDO: 'Convertido',
  PERDIDO: 'Perdido',
};

export function AdminLeads() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const statusFilter = searchParams.get('status');

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<string>(statusFilter || '');
  const [leadSelecionado, setLeadSelecionado] = useState<Lead | null>(null);
  const [mostrarModal, setMostrarModal] = useState(false);

  useEffect(() => {
    carregarLeads();
  }, [filtroStatus]);

  const carregarLeads = async () => {
    try {
      setLoading(true);
      const params = filtroStatus ? { status: filtroStatus } : {};
      const response = await api.get('/admin/leads', { params });
      setLeads(response.data);
    } catch (error) {
      console.error('Erro ao carregar leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatarData = (data: string) => {
    return new Date(data).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatarCPF = (cpf: string) => {
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const formatarTelefone = (tel: string) => {
    if (tel.length === 11) {
      return tel.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
    return tel;
  };

  const abrirDetalhes = (lead: Lead) => {
    setLeadSelecionado(lead);
    setMostrarModal(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/admin/dashboard')}
              className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Gerenciar Leads
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {leads.length} lead(s) encontrado(s)
              </p>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-6">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFiltroStatus('')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filtroStatus === ''
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Todos
            </button>
            {Object.entries(STATUS_LABELS).map(([status, label]) => (
              <button
                key={status}
                onClick={() => setFiltroStatus(status)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filtroStatus === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        )}

        {/* Lista de Leads */}
        {!loading && (
          <div className="grid grid-cols-1 gap-4">
            {leads.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-12 text-center">
                <p className="text-gray-600 dark:text-gray-400">
                  Nenhum lead encontrado com os filtros selecionados
                </p>
              </div>
            ) : (
              leads.map((lead) => (
                <div
                  key={lead.id}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {lead.nome || 'Nome não informado'}
                        </h3>
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-medium ${
                            STATUS_COLORS[lead.status] || STATUS_COLORS.NOVO
                          }`}
                        >
                          {STATUS_LABELS[lead.status] || lead.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <User className="w-4 h-4" />
                          <span>{formatarCPF(lead.cpf)}</span>
                        </div>

                        {lead.telefone && (
                          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <Phone className="w-4 h-4" />
                            <span>{formatarTelefone(lead.telefone)}</span>
                          </div>
                        )}

                        {lead.email && (
                          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <Mail className="w-4 h-4" />
                            <span>{lead.email}</span>
                          </div>
                        )}

                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <Calendar className="w-4 h-4" />
                          <span>{formatarData(lead.criado_em)}</span>
                        </div>

                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <Zap className="w-4 h-4" />
                          <span>{lead.total_ucs} UC(s)</span>
                        </div>

                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <TrendingUp className="w-4 h-4" />
                          <span>{lead.total_consumo_kwh} kWh/mês</span>
                        </div>

                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <DollarSign className="w-4 h-4" />
                          <span>
                            R$ {lead.valor_total_faturas.toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                      </div>

                      {lead.observacoes && (
                        <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                          <p className="text-sm text-gray-700 dark:text-gray-300">
                            <strong>Observações:</strong> {lead.observacoes}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => abrirDetalhes(lead)}
                        className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                        title="Ver detalhes"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => navigate(`/admin/leads/${lead.id}/editar`)}
                        className="p-2 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                        title="Editar"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Modal de Detalhes (implementar posteriormente) */}
      {mostrarModal && leadSelecionado && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Detalhes do Lead
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Implementar visualização detalhada e timeline de interações
            </p>
            <button
              onClick={() => setMostrarModal(false)}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
