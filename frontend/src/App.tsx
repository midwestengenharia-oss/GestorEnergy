import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { api, Empresa, UnidadeConsumidora, Fatura, GDDetailsResponse, HistoricoMensalGD, DiscriminacaoEnergia, ComposicaoEnergia } from './lib/api';
import { useToast } from './components/Toast';
import { useAuth } from './contexts/AuthContext';
import { useTheme } from './contexts/ThemeContext';
import { GestoresPage } from './pages/GestoresPage';
import {
  Activity, Plug, Plus, RefreshCw, ArrowLeft, Home, FileText, Download, Loader2, Sun, BatteryCharging, ChevronDown, ChevronUp, Barcode, QrCode, X, Share2, LogOut, User, Building2, Zap, AlertCircle, CheckCircle2, Clock, DollarSign, BarChart3, PieChart, Eye, GitBranch, Move, ZoomIn, ZoomOut, Maximize2, TrendingUp, TrendingDown, Calendar, ArrowRightLeft, Layers, Timer, MapPin, ChevronRight, Menu, ChevronLeft, Moon, SunMedium, PanelLeftClose, PanelLeft, UserCog
} from 'lucide-react';

// Função auxiliar para converter Base64 em Download
const downloadBase64File = (base64Data: string, fileName: string) => {
  const linkSource = `data:application/pdf;base64,${base64Data}`;
  const downloadLink = document.createElement("a");
  downloadLink.href = linkSource;
  downloadLink.download = fileName;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
};

// Tipo para navegação
type NavPage = 'dashboard' | 'empresas' | 'usinas' | 'gestores';

// Interface para usina com empresa
interface UsinaComEmpresa extends UnidadeConsumidora {
  empresa_nome?: string;
  empresa_id?: number;
}

function App() {
  // --- HOOKS ---
  const toast = useToast();
  const { usuario, logout } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();

  // --- ESTADOS DE LAYOUT ---
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // --- ESTADOS ---
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingEmpresas, setLoadingEmpresas] = useState(true);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [loadingUsinas, setLoadingUsinas] = useState(false);

  // Navegação principal (menu lateral)
  const [paginaAtual, setPaginaAtual] = useState<NavPage>('dashboard');
  const [menuEmpresasAberto, setMenuEmpresasAberto] = useState(false);

  // Navegação e Abas dentro de empresa
  const [vendoEmpresa, setVendoEmpresa] = useState<Empresa | null>(null);
  const [abaAtiva, setAbaAtiva] = useState<'geral' | 'usinas'>('geral');

  // Dados
  const [ucsDoCliente, setUcsDoCliente] = useState<UnidadeConsumidora[]>([]);
  const [usinasDoCliente, setUsinasDoCliente] = useState<UnidadeConsumidora[]>([]);
  const [todasUcs, setTodasUcs] = useState<UnidadeConsumidora[]>([]);
  const [todasFaturas, setTodasFaturas] = useState<Fatura[]>([]);
  const [todasUsinas, setTodasUsinas] = useState<UsinaComEmpresa[]>([]);

  // Controle Visual
  const [faturasPorUc, setFaturasPorUc] = useState<Record<number, Fatura[]>>({});
  const [expandedUcs, setExpandedUcs] = useState<Record<number, boolean>>({});
  const [loadingUcs, setLoadingUcs] = useState<Record<number, boolean>>({});

  // Seleção múltipla de faturas
  const [faturasSelecionadas, setFaturasSelecionadas] = useState<Record<number, Set<number>>>({});
  const [downloadingMultiple, setDownloadingMultiple] = useState(false);

  // Modais e Inputs
  const [faturaDetalhe, setFaturaDetalhe] = useState<Fatura | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [smsModalOpen, setSmsModalOpen] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novoCpf, setNovoCpf] = useState("");
  const [novoTel, setNovoTel] = useState("");
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<number | null>(null);
  const [smsCode, setSmsCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [validatingSms, setValidatingSms] = useState(false);

  // Modal da árvore de beneficiárias
  const [usinaArvoreModal, setUsinaArvoreModal] = useState<UsinaComEmpresa | null>(null);

  // Modal de detalhes GD da usina
  const [usinaDetalhesModal, setUsinaDetalhesModal] = useState<UsinaComEmpresa | null>(null);
  const [gdDetails, setGdDetails] = useState<GDDetailsResponse | null>(null);
  const [loadingGdDetails, setLoadingGdDetails] = useState(false);

  // --- API ACTIONS ---
  const fetchDadosDashboard = useCallback(async (empresasList: Empresa[]) => {
    setLoadingDashboard(true);
    try {
      const empresasConectadas = empresasList.filter(e => e.status_conexao === 'CONECTADO');
      const todasUcsTemp: UnidadeConsumidora[] = [];
      const todasFaturasTemp: Fatura[] = [];

      for (const emp of empresasConectadas) {
        try {
          const resUcs = await api.get(`/empresas/${emp.id}/ucs`);
          const ucs = resUcs.data || [];
          todasUcsTemp.push(...ucs);

          for (const uc of ucs) {
            try {
              const resFat = await api.get(`/ucs/${uc.id}/faturas`);
              if (resFat.data && Array.isArray(resFat.data)) {
                todasFaturasTemp.push(...resFat.data);
              }
            } catch (err) {
              console.log(`Erro ao buscar faturas da UC ${uc.id}:`, err);
            }
          }
        } catch (err) {
          console.log(`Erro ao buscar UCs da empresa ${emp.id}:`, err);
        }
      }

      setTodasUcs(todasUcsTemp);
      setTodasFaturas(todasFaturasTemp);
    } catch (e) {
      console.error('Erro ao buscar dados do dashboard:', e);
    } finally {
      setLoadingDashboard(false);
    }
  }, []);

  const fetchTodasUsinas = useCallback(async (empresasList: Empresa[]) => {
    setLoadingUsinas(true);
    try {
      const empresasConectadas = empresasList.filter(e => e.status_conexao === 'CONECTADO');
      const usinasTemp: UsinaComEmpresa[] = [];

      for (const emp of empresasConectadas) {
        try {
          const res = await api.get(`/empresas/${emp.id}/usinas`);
          const usinas = res.data || [];
          usinas.forEach((u: UnidadeConsumidora) => {
            usinasTemp.push({
              ...u,
              empresa_nome: emp.nome_empresa,
              empresa_id: emp.id
            });
          });
        } catch (err) {
          console.log(`Erro ao buscar usinas da empresa ${emp.id}:`, err);
        }
      }

      setTodasUsinas(usinasTemp);
    } catch (e) {
      console.error('Erro ao buscar usinas:', e);
    } finally {
      setLoadingUsinas(false);
    }
  }, []);

  const fetchGdDetails = useCallback(async (usinaId: number) => {
    setLoadingGdDetails(true);
    setGdDetails(null);
    try {
      const res = await api.get(`/usinas/${usinaId}/gd-details`);
      setGdDetails(res.data);
    } catch (e: any) {
      console.error('Erro ao buscar detalhes GD:', e);
      toast.error(e.message || 'Erro ao buscar detalhes da usina');
    } finally {
      setLoadingGdDetails(false);
    }
  }, [toast]);

  const abrirDetalhesUsina = useCallback((usina: UsinaComEmpresa) => {
    setUsinaDetalhesModal(usina);
    fetchGdDetails(usina.id);
  }, [fetchGdDetails]);

  const fetchEmpresas = useCallback(async () => {
    setLoadingEmpresas(true);
    try {
      const res = await api.get('/empresas');
      const empresasList = res.data || [];
      setEmpresas(empresasList);
      if (empresasList.length > 0) {
        fetchDadosDashboard(empresasList);
        fetchTodasUsinas(empresasList);
      }
    } catch (e: any) {
      toast.error(e.message || 'Erro ao carregar empresas');
    } finally {
      setLoadingEmpresas(false);
    }
  }, [toast, fetchDadosDashboard, fetchTodasUsinas]);

  useEffect(() => {
    fetchEmpresas();
  }, []);

  // Funcao para recarregar tudo da empresa atual (Botao Refresh)
  const refreshDadosEmpresa = async () => {
    if (!vendoEmpresa) return;
    setLoading(true);
    try {
      const resUcs = await api.get(`/empresas/${vendoEmpresa.id}/ucs`);
      setUcsDoCliente(resUcs.data);

      if (abaAtiva === 'usinas') {
        const resUsinas = await api.get(`/empresas/${vendoEmpresa.id}/usinas`);
        setUsinasDoCliente(resUsinas.data);
      }

      setFaturasPorUc({});
      toast.success('Dados atualizados com sucesso');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao atualizar dados');
    } finally {
      setLoading(false);
    }
  };

  const abrirDetalhesEmpresa = async (empresa: Empresa) => {
    setVendoEmpresa(empresa);
    setAbaAtiva('geral');
    setUcsDoCliente([]); setFaturasPorUc({}); setExpandedUcs({});
    setLoading(true);
    try {
      const res = await api.get(`/empresas/${empresa.id}/ucs`);
      setUcsDoCliente(res.data);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao carregar UCs');
    } finally {
      setLoading(false);
    }
  };

  const carregarUsinas = async () => {
    if (!vendoEmpresa) return;
    setAbaAtiva('usinas');
    setLoading(true);
    try {
      const res = await api.get(`/empresas/${vendoEmpresa.id}/usinas`);
      setUsinasDoCliente(res.data);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao carregar usinas');
    } finally {
      setLoading(false);
    }
  };

  const toggleFaturas = async (ucId: number) => {
    if (expandedUcs[ucId]) {
      setExpandedUcs(prev => ({ ...prev, [ucId]: false }));
      return;
    }
    if (!faturasPorUc[ucId]) {
      setLoadingUcs(prev => ({ ...prev, [ucId]: true }));
      try {
        const res = await api.get(`/ucs/${ucId}/faturas`);
        setFaturasPorUc(prev => ({ ...prev, [ucId]: res.data }));
      } catch (e: any) {
        toast.error(e.message || 'Erro ao carregar faturas');
        return;
      } finally {
        setLoadingUcs(prev => ({ ...prev, [ucId]: false }));
      }
    }
    setExpandedUcs(prev => ({ ...prev, [ucId]: true }));
  };

  const handleDownloadPdf = async (faturaId: number) => {
    setDownloadingId(faturaId);
    try {
      const res = await api.get(`/faturas/${faturaId}/download`);
      if (res.data.file_base64) {
        downloadBase64File(res.data.file_base64, res.data.filename);
        toast.success('PDF baixado com sucesso');
      } else {
        toast.warning('Arquivo vazio ou indisponivel');
      }
    } catch (e: any) {
      toast.error(e.message || 'Erro ao baixar PDF');
    } finally {
      setDownloadingId(null);
    }
  };

  // --- SELEÇÃO MÚLTIPLA DE FATURAS ---
  const toggleFaturaSelecionada = (ucId: number, faturaId: number) => {
    setFaturasSelecionadas(prev => {
      const ucSelecionadas = new Set(prev[ucId] || []);
      if (ucSelecionadas.has(faturaId)) {
        ucSelecionadas.delete(faturaId);
      } else {
        ucSelecionadas.add(faturaId);
      }
      return { ...prev, [ucId]: ucSelecionadas };
    });
  };

  const toggleTodasFaturas = (ucId: number) => {
    const faturas = faturasPorUc[ucId] || [];
    const selecionadas = faturasSelecionadas[ucId] || new Set();

    if (selecionadas.size === faturas.length) {
      // Desseleciona todas
      setFaturasSelecionadas(prev => ({ ...prev, [ucId]: new Set() }));
    } else {
      // Seleciona todas
      setFaturasSelecionadas(prev => ({
        ...prev,
        [ucId]: new Set(faturas.map(f => f.id))
      }));
    }
  };

  const downloadFaturasSelecionadas = async (ucId: number) => {
    const selecionadas = faturasSelecionadas[ucId];
    if (!selecionadas || selecionadas.size === 0) {
      toast.warning('Selecione pelo menos uma fatura');
      return;
    }

    setDownloadingMultiple(true);
    let sucessos = 0;
    let erros = 0;

    for (const faturaId of Array.from(selecionadas)) {
      try {
        const res = await api.get(`/faturas/${faturaId}/download`);
        if (res.data.file_base64) {
          downloadBase64File(res.data.file_base64, res.data.filename);
          sucessos++;
          // Pequeno delay entre downloads
          await new Promise(resolve => setTimeout(resolve, 300));
        } else {
          erros++;
        }
      } catch (e) {
        erros++;
      }
    }

    setDownloadingMultiple(false);

    if (sucessos > 0) {
      toast.success(`${sucessos} fatura(s) baixada(s) com sucesso${erros > 0 ? `, ${erros} erro(s)` : ''}`);
    } else {
      toast.error('Erro ao baixar faturas');
    }

    // Limpa seleção após download
    setFaturasSelecionadas(prev => ({ ...prev, [ucId]: new Set() }));
  };

  // --- HELPERS ---
  const getStatusColor = (status: string) => {
    const s = status?.toLowerCase() || '';
    if (s.includes('fora do prazo') || s.includes('pendente') || s.includes('atrasado')) return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    if (s.includes('pago')) return 'bg-green-50 text-green-700 border-green-200';
    return 'bg-slate-50 text-slate-700 border-slate-200';
  };

  // --- MÉTRICAS DO DASHBOARD ---
  const metricas = useMemo(() => {
    const totalEmpresas = empresas.length;
    const empresasConectadas = empresas.filter(e => e.status_conexao === 'CONECTADO').length;
    const empresasPendentes = empresas.filter(e => e.status_conexao !== 'CONECTADO').length;
    const totalUcs = todasUcs.length;
    const totalUsinas = todasUcs.filter(uc => uc.is_geradora).length;
    const totalFaturas = todasFaturas.length;
    const faturasPendentes = todasFaturas.filter(f => {
      const s = f.status?.toLowerCase() || '';
      return s.includes('pendente') || s.includes('fora do prazo') || s.includes('atrasado');
    }).length;
    const faturasPagas = todasFaturas.filter(f => f.status?.toLowerCase().includes('pago')).length;
    const valorTotal = todasFaturas.reduce((acc, f) => acc + (f.valor || 0), 0);
    const valorPendente = todasFaturas
      .filter(f => {
        const s = f.status?.toLowerCase() || '';
        return s.includes('pendente') || s.includes('fora do prazo') || s.includes('atrasado');
      })
      .reduce((acc, f) => acc + (f.valor || 0), 0);
    const saldoTotalKwh = todasUcs.filter(uc => uc.is_geradora).reduce((acc, uc) => acc + (uc.saldo_acumulado || 0), 0);

    return {
      totalEmpresas,
      empresasConectadas,
      empresasPendentes,
      totalUcs,
      totalUsinas,
      totalFaturas,
      faturasPendentes,
      faturasPagas,
      valorTotal,
      valorPendente,
      saldoTotalKwh
    };
  }, [empresas, todasUcs, todasFaturas]);

  // --- HANDLERS (Cadastro/Login) ---
  const handleRegister = async () => {
    if (!novoNome || !novoCpf) {
      toast.warning('Preencha nome e CPF');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/empresas/novo', null, { params: { nome: novoNome, cpf: novoCpf, telefone_final: novoTel } });
      toast.success('Empresa cadastrada com sucesso');
      fetchEmpresas();
      setNovoNome(""); setNovoCpf(""); setNovoTel("");
    } catch (e: any) {
      toast.error(e.message || 'Erro ao cadastrar empresa');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConnect = async (id: number) => {
    setLoading(true);
    try {
      await api.post(`/empresas/${id}/conectar`);
      setSelectedEmpresaId(id);
      setSmsModalOpen(true);
      toast.info('SMS enviado! Digite o codigo recebido');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao conectar');
    } finally {
      setLoading(false);
    }
  };

  const handleValidateSms = async () => {
    if (!selectedEmpresaId) return;
    if (!smsCode || smsCode.length < 4) {
      toast.warning('Digite o codigo SMS completo');
      return;
    }
    setValidatingSms(true);
    try {
      await api.post(`/empresas/${selectedEmpresaId}/validar-sms`, null, { params: { codigo_sms: smsCode } });
      setSmsModalOpen(false);
      setSmsCode("");
      fetchEmpresas();
      toast.success('Conectado com sucesso! Os dados serao sincronizados em breve');
    } catch (e: any) {
      toast.error(e.message || 'Codigo SMS invalido');
    } finally {
      setValidatingSms(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado para a area de transferencia');
  };

  // --- COMPONENTE DA TABELA DE FATURAS (REUTILIZÁVEL) ---
  const renderTabelaFaturas = (ucId: number) => {
    if (loadingUcs[ucId]) return <div className="p-8 text-center text-slate-500 bg-slate-50/30 border-t border-slate-100"><Loader2 className="animate-spin mx-auto mb-2 text-[#00A3E0]" size={24} /><p className="text-sm">Buscando faturas...</p></div>;
    if (!expandedUcs[ucId] || !faturasPorUc[ucId]) return null;

    const faturas = faturasPorUc[ucId];
    const selecionadas = faturasSelecionadas[ucId] || new Set();
    const todasSelecionadas = faturas.length > 0 && selecionadas.size === faturas.length;

    return (
      <div className="border-t border-slate-100 animate-fade-in-down">
        {/* Barra de ações de seleção múltipla */}
        {faturas.length > 0 && (
          <div className={`flex items-center justify-between px-4 py-3 ${isDark ? 'bg-slate-800/50 border-b border-slate-700' : 'bg-slate-50 border-b border-slate-200'}`}>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={todasSelecionadas}
                  onChange={() => toggleTodasFaturas(ucId)}
                  className="w-4 h-4 text-[#00A3E0] border-slate-300 rounded focus:ring-[#00A3E0]"
                />
                <span className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {todasSelecionadas ? 'Desselecionar todas' : 'Selecionar todas'}
                </span>
              </label>
              {selecionadas.size > 0 && (
                <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {selecionadas.size} selecionada{selecionadas.size !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            {selecionadas.size > 0 && (
              <button
                onClick={() => downloadFaturasSelecionadas(ucId)}
                disabled={downloadingMultiple}
                className="flex items-center gap-2 px-4 py-2 bg-[#00A3E0] text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {downloadingMultiple ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Baixando...
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    Baixar Selecionadas ({selecionadas.size})
                  </>
                )}
              </button>
            )}
          </div>
        )}

        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
            <tr><th className="p-3 pl-6 w-10"></th><th className="p-3">Mês/Ano</th><th className="p-3">Vencimento</th><th className="p-3">Valor</th><th className="p-3">Status</th><th className="p-3 text-right pr-6">Ações</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {faturas.map(fat => (
              <tr key={fat.id} className="hover:bg-slate-50 transition-colors group">
                <td className="p-3 pl-6">
                  <input
                    type="checkbox"
                    checked={selecionadas.has(fat.id)}
                    onChange={() => toggleFaturaSelecionada(ucId, fat.id)}
                    className="w-4 h-4 text-[#00A3E0] border-slate-300 rounded focus:ring-[#00A3E0]"
                  />
                </td>
                <td className="p-3 font-medium text-slate-700">{fat.mes}/{fat.ano}</td>
                <td className="p-3 text-slate-600">{fat.vencimento || '-'}</td>
                <td className="p-3 font-bold text-slate-800">R$ {fat.valor.toFixed(2)}</td>
                <td className="p-3"><span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusColor(fat.status)}`}>{fat.status}</span></td>
                <td className="p-3 pr-6 flex justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setFaturaDetalhe(fat)} className="text-slate-600 hover:text-[#00A3E0] hover:bg-blue-50 border border-slate-200 hover:border-blue-200 px-3 py-1.5 rounded-md flex items-center gap-1.5 text-xs font-medium transition-all"><FileText size={14} /> Detalhes</button>
                  <button onClick={() => handleDownloadPdf(fat.id)} disabled={downloadingId === fat.id} className="text-[#00A3E0] hover:text-blue-700 hover:bg-blue-50 px-2 py-1.5 rounded-md transition-colors flex items-center gap-1">{downloadingId === fat.id ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}</button>
                </td>
              </tr>
            ))}
            {faturas.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-slate-400 italic">Nenhuma fatura encontrada.</td></tr>}
          </tbody>
        </table>
      </div>
    );
  };

  // --- COMPONENTE ÁRVORE DE BENEFICIÁRIAS ---
  const ArvoreModal = ({ usina, onClose }: { usina: UsinaComEmpresa; onClose: () => void }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [scale, setScale] = useState(1);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    const handleMouseDown = (e: React.MouseEvent) => {
      if (e.target === containerRef.current || (e.target as HTMLElement).closest('.tree-container')) {
        setIsDragging(true);
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
      }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    const zoomIn = () => setScale(s => Math.min(s + 0.2, 2));
    const zoomOut = () => setScale(s => Math.max(s - 0.2, 0.5));
    const resetView = () => { setScale(1); setPosition({ x: 0, y: 0 }); };

    const beneficiarias = usina.beneficiarias || [];
    const totalBeneficiarias = beneficiarias.length;

    return (
      <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center z-50 backdrop-blur-sm p-4">
        <div className="bg-white w-full max-w-5xl h-[80vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
          {/* Header */}
          <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-5 flex justify-between items-center text-white">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <GitBranch size={24} />
              </div>
              <div>
                <h3 className="font-bold text-lg">Árvore de Rateio</h3>
                <p className="text-orange-100 text-sm">Usina {usina.codigo_uc} • {totalBeneficiarias} beneficiária(s)</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={zoomOut} className="p-2 hover:bg-white/20 rounded-lg transition" title="Diminuir zoom">
                <ZoomOut size={20} />
              </button>
              <span className="text-sm font-mono bg-white/20 px-2 py-1 rounded">{Math.round(scale * 100)}%</span>
              <button onClick={zoomIn} className="p-2 hover:bg-white/20 rounded-lg transition" title="Aumentar zoom">
                <ZoomIn size={20} />
              </button>
              <button onClick={resetView} className="p-2 hover:bg-white/20 rounded-lg transition" title="Resetar visualização">
                <Maximize2 size={20} />
              </button>
              <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition ml-2">
                <X size={24} />
              </button>
            </div>
          </div>

          {/* Toolbar */}
          <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex items-center gap-2 text-sm text-slate-600">
            <Move size={16} />
            <span>Arraste para mover a visualização</span>
          </div>

          {/* Canvas da árvore */}
          <div
            ref={containerRef}
            className="flex-1 overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100 cursor-grab active:cursor-grabbing"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <div
              className="tree-container w-full h-full flex items-center justify-center"
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                transformOrigin: 'center center',
                transition: isDragging ? 'none' : 'transform 0.1s ease-out'
              }}
            >
              <div className="flex flex-col items-center py-12">
                {/* Nó da Usina (Raiz) */}
                <div className="relative">
                  <div className="bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl p-6 shadow-xl text-white min-w-[280px] transform hover:scale-105 transition-transform">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center">
                        <Sun size={32} />
                      </div>
                      <div>
                        <span className="text-xs bg-white/30 px-2 py-0.5 rounded-full font-bold">GERADORA</span>
                        <h4 className="text-xl font-bold mt-1">UC {usina.codigo_uc}</h4>
                        <p className="text-orange-100 text-sm truncate max-w-[180px]">{usina.endereco}</p>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-white/20 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BatteryCharging size={18} />
                        <span className="font-bold">{usina.saldo_acumulado || 0} kWh</span>
                      </div>
                      <span className="text-xs bg-white/20 px-2 py-1 rounded">Saldo</span>
                    </div>
                  </div>

                  {/* Linha vertical para beneficiárias */}
                  {totalBeneficiarias > 0 && (
                    <div className="absolute left-1/2 -translate-x-1/2 top-full w-1 h-16 bg-gradient-to-b from-orange-400 to-slate-300"></div>
                  )}
                </div>

                {/* Beneficiárias */}
                {totalBeneficiarias > 0 && (
                  <div className="mt-16 relative">
                    {/* Linha horizontal conectando todas as beneficiárias */}
                    <div
                      className="absolute top-0 left-0 right-0 h-1 bg-slate-300"
                      style={{
                        width: `${Math.max(totalBeneficiarias * 280, 280)}px`,
                        left: '50%',
                        transform: 'translateX(-50%)'
                      }}
                    ></div>

                    <div className="flex gap-8 justify-center pt-1">
                      {beneficiarias.map((ben, index) => (
                        <div key={ben.id} className="relative flex flex-col items-center">
                          {/* Linha vertical para cada beneficiária */}
                          <div className="w-1 h-12 bg-slate-300"></div>

                          {/* Card da beneficiária */}
                          <div className="bg-white rounded-xl p-5 shadow-lg border-2 border-slate-200 min-w-[250px] hover:border-[#00A3E0] hover:shadow-xl transition-all transform hover:scale-105 relative group">
                            {/* Badge de porcentagem na aresta */}
                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-[#00A3E0] text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg">
                              {ben.percentual_rateio}%
                            </div>

                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                                <Home size={24} className="text-slate-500 group-hover:text-[#00A3E0] transition-colors" />
                              </div>
                              <div>
                                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">BENEFICIÁRIA</span>
                                <h5 className="font-bold text-slate-800 mt-1">UC {ben.codigo_uc}</h5>
                              </div>
                            </div>

                            {ben.nome_titular && (
                              <p className="text-sm text-slate-600 mt-3 truncate" title={ben.nome_titular}>
                                {ben.nome_titular}
                              </p>
                            )}

                            <p className="text-xs text-slate-400 mt-1 truncate" title={ben.endereco}>
                              {ben.endereco}
                            </p>

                            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                              <div className="flex items-center gap-1 text-[#00A3E0]">
                                <Share2 size={14} />
                                <span className="text-xs font-medium">Recebe</span>
                              </div>
                              <span className="text-lg font-bold text-slate-800">{ben.percentual_rateio}%</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sem beneficiárias */}
                {totalBeneficiarias === 0 && (
                  <div className="mt-12 text-center text-slate-500 bg-white p-8 rounded-xl border-2 border-dashed border-slate-300">
                    <Home size={40} className="mx-auto mb-3 text-slate-300" />
                    <p className="font-medium">Nenhuma beneficiária cadastrada</p>
                    <p className="text-sm text-slate-400 mt-1">Esta usina não possui rateio de créditos</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer com legenda */}
          <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between text-sm">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-gradient-to-br from-orange-500 to-amber-500 rounded"></div>
                <span className="text-slate-600">Usina Geradora</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-white border-2 border-slate-300 rounded"></div>
                <span className="text-slate-600">Beneficiária</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-4 bg-[#00A3E0] rounded-full text-white text-[10px] flex items-center justify-center font-bold">%</div>
                <span className="text-slate-600">Percentual de rateio</span>
              </div>
            </div>
            <p className="text-slate-400">{usina.empresa_nome}</p>
          </div>
        </div>
      </div>
    );
  };

  // --- COMPONENTE MODAL DE DETALHES GD ---
  const UsinaDetalhesModal = ({ usina, onClose }: { usina: UsinaComEmpresa; onClose: () => void }) => {
    const [abaAtiva, setAbaAtiva] = useState<'resumo' | 'historico' | 'transferencias'>('resumo');

    // Helpers para nomes de meses
    const getNomeMes = (mes: number) => {
      const meses = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      return meses[mes] || '';
    };

    // Calcula métricas do histórico
    const calcularMetricas = () => {
      if (!gdDetails || !gdDetails.historico_mensal || gdDetails.historico_mensal.length === 0) {
        return {
          producaoTotal: 0,
          transferidoTotal: 0,
          consumoProprio: 0,
          saldoAtual: usina.saldo_acumulado || 0,
          eficiencia: 0,
          mesesComDados: 0
        };
      }

      const historico = gdDetails.historico_mensal;
      const producaoTotal = historico.reduce((acc, h) => acc + (h.injetadoConv || 0), 0);
      const transferidoTotal = historico.reduce((acc, h) => acc + (h.consumoTransferidoConv || 0), 0);
      const consumoProprio = historico.reduce((acc, h) => acc + (h.consumoInjetadoCompensadoConv || 0), 0);
      const saldoAtual = historico[0]?.saldoAnteriorConv || usina.saldo_acumulado || 0;
      const eficiencia = producaoTotal > 0 ? ((transferidoTotal + consumoProprio) / producaoTotal) * 100 : 0;

      return {
        producaoTotal,
        transferidoTotal,
        consumoProprio,
        saldoAtual,
        eficiencia,
        mesesComDados: historico.length
      };
    };

    const metricas = calcularMetricas();

    // Pega últimos 12 meses para o gráfico
    const dadosGrafico = gdDetails?.historico_mensal?.slice(0, 12).reverse() || [];

    // Altura máxima para normalização do gráfico
    const maxProducao = Math.max(...dadosGrafico.map(d => d.injetadoConv || 0), 1);
    const maxTransferido = Math.max(...dadosGrafico.map(d => d.consumoTransferidoConv || 0), 1);
    const maxValor = Math.max(maxProducao, maxTransferido);

    // Agrupa transferências por beneficiária
    const transferenciasAgrupadas = () => {
      if (!gdDetails?.historico_mensal) return [];

      const map = new Map<number, {
        cdc: number;
        endereco: string;
        total: number;
        bairro: string;
        municipio: string;
        transferencias: { mes: number; ano: number; valor: number }[]
      }>();

      gdDetails.historico_mensal.forEach(h => {
        h.discriminacaoEnergiaInjetadas?.forEach(d => {
          const key = d.numUcMovimento;
          const atual = map.get(key) || {
            cdc: d.numUcMovimento,
            endereco: `${d.endereco}, ${d.numeroImovel}`,
            bairro: d.bairro,
            municipio: d.nomeMunicipio,
            total: 0,
            transferencias: []
          };
          atual.total += Math.abs(d.consumoConvMovimentado || 0);
          atual.transferencias.push({
            mes: h.mesReferencia,
            ano: h.anoReferencia,
            valor: Math.abs(d.consumoConvMovimentado || 0)
          });
          map.set(key, atual);
        });
      });

      return Array.from(map.values()).sort((a, b) => b.total - a.total);
    };

    // Composição do saldo com alertas de expiração
    const composicaoSaldo = () => {
      if (!gdDetails?.historico_mensal || gdDetails.historico_mensal.length === 0) return [];

      const ultimoMes = gdDetails.historico_mensal[0];
      const composicao = ultimoMes.composicaoEnergiaInjetadas || [];

      const agora = new Date();
      const anoAtual = agora.getFullYear();
      const mesAtual = agora.getMonth() + 1;

      return composicao
        .filter(c => c.saldoAnteriorConv > 0)
        .map(c => {
          // Calcula meses até expirar (60 meses)
          const mesesDesdeInjecao = (anoAtual - c.anoReferencia) * 12 + (mesAtual - c.mesReferencia);
          const mesesRestantes = 60 - mesesDesdeInjecao;
          const expirando = mesesRestantes <= 6;
          const expirado = mesesRestantes <= 0;

          return {
            ...c,
            mesesRestantes,
            expirando,
            expirado
          };
        })
        .sort((a, b) => a.mesesRestantes - b.mesesRestantes);
    };

    const beneficiariasAgrupadas = transferenciasAgrupadas();
    const saldoComposicao = composicaoSaldo();

    return (
      <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center z-50 backdrop-blur-sm p-4">
        <div className="bg-white w-full max-w-6xl h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
          {/* Header */}
          <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-5 flex justify-between items-center text-white shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                <Sun size={28} />
              </div>
              <div>
                <h3 className="font-bold text-xl">Usina UC {usina.codigo_uc}</h3>
                <p className="text-orange-100 text-sm">{usina.endereco}</p>
                <p className="text-orange-200 text-xs mt-1">{usina.empresa_nome}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => fetchGdDetails(usina.id)}
                disabled={loadingGdDetails}
                className="p-2 hover:bg-white/20 rounded-lg transition"
                title="Atualizar dados"
              >
                <RefreshCw size={20} className={loadingGdDetails ? "animate-spin" : ""} />
              </button>
              <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition">
                <X size={24} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-slate-100 px-6 py-2 border-b border-slate-200 flex gap-2 shrink-0">
            <button
              onClick={() => setAbaAtiva('resumo')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${abaAtiva === 'resumo' ? 'bg-white shadow text-orange-600' : 'text-slate-600 hover:bg-white/50'}`}
            >
              <BarChart3 size={16} className="inline mr-2" />Resumo
            </button>
            <button
              onClick={() => setAbaAtiva('historico')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${abaAtiva === 'historico' ? 'bg-white shadow text-orange-600' : 'text-slate-600 hover:bg-white/50'}`}
            >
              <Calendar size={16} className="inline mr-2" />Histórico
            </button>
            <button
              onClick={() => setAbaAtiva('transferencias')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${abaAtiva === 'transferencias' ? 'bg-white shadow text-orange-600' : 'text-slate-600 hover:bg-white/50'}`}
            >
              <ArrowRightLeft size={16} className="inline mr-2" />Transferências
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
            {loadingGdDetails ? (
              <div className="flex flex-col items-center justify-center h-full">
                <Loader2 size={48} className="animate-spin text-orange-500 mb-4" />
                <p className="text-slate-600">Carregando dados de geração distribuída...</p>
              </div>
            ) : (
              <>
                {/* ABA RESUMO */}
                {abaAtiva === 'resumo' && (
                  <div className="space-y-6 animate-fade-in">
                    {/* Cards de métricas */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                            <TrendingUp className="text-green-600" size={20} />
                          </div>
                          <span className="text-xs text-slate-500 uppercase font-bold">Produção Total</span>
                        </div>
                        <h4 className="text-2xl font-bold text-slate-800">{metricas.producaoTotal.toLocaleString('pt-BR')} kWh</h4>
                        <p className="text-xs text-slate-400 mt-1">Últimos {metricas.mesesComDados} meses</p>
                      </div>

                      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Share2 className="text-[#00A3E0]" size={20} />
                          </div>
                          <span className="text-xs text-slate-500 uppercase font-bold">Transferido</span>
                        </div>
                        <h4 className="text-2xl font-bold text-slate-800">{metricas.transferidoTotal.toLocaleString('pt-BR')} kWh</h4>
                        <p className="text-xs text-slate-400 mt-1">Para beneficiárias</p>
                      </div>

                      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                            <Home className="text-purple-600" size={20} />
                          </div>
                          <span className="text-xs text-slate-500 uppercase font-bold">Consumo Próprio</span>
                        </div>
                        <h4 className="text-2xl font-bold text-slate-800">{metricas.consumoProprio.toLocaleString('pt-BR')} kWh</h4>
                        <p className="text-xs text-slate-400 mt-1">Compensado na usina</p>
                      </div>

                      <div className="bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl p-5 shadow-sm text-white">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                            <BatteryCharging className="text-white" size={20} />
                          </div>
                          <span className="text-xs text-orange-100 uppercase font-bold">Saldo Atual</span>
                        </div>
                        <h4 className="text-2xl font-bold">{metricas.saldoAtual.toLocaleString('pt-BR')} kWh</h4>
                        <p className="text-xs text-orange-100 mt-1">Disponível para compensação</p>
                      </div>
                    </div>

                    {/* Gráfico de barras */}
                    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                      <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <BarChart3 size={20} className="text-orange-500" />
                        Produção vs Transferência Mensal
                      </h4>

                      {dadosGrafico.length > 0 ? (
                        <div className="relative">
                          {/* Legenda */}
                          <div className="flex items-center gap-6 mb-4 text-sm">
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 bg-orange-400 rounded"></div>
                              <span className="text-slate-600">Produção (Injetado)</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 bg-[#00A3E0] rounded"></div>
                              <span className="text-slate-600">Transferido</span>
                            </div>
                          </div>

                          {/* Gráfico */}
                          <div className="flex items-end gap-2 h-48 border-b border-l border-slate-200 pl-2 pb-2">
                            {dadosGrafico.map((d, i) => (
                              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                <div className="flex gap-0.5 items-end h-40 w-full justify-center">
                                  {/* Barra de produção */}
                                  <div
                                    className="w-3 bg-orange-400 rounded-t transition-all hover:bg-orange-500"
                                    style={{ height: `${(d.injetadoConv / maxValor) * 100}%` }}
                                    title={`Produção: ${d.injetadoConv} kWh`}
                                  ></div>
                                  {/* Barra de transferido */}
                                  <div
                                    className="w-3 bg-[#00A3E0] rounded-t transition-all hover:bg-blue-600"
                                    style={{ height: `${(d.consumoTransferidoConv / maxValor) * 100}%` }}
                                    title={`Transferido: ${d.consumoTransferidoConv} kWh`}
                                  ></div>
                                </div>
                                <span className="text-[10px] text-slate-500 font-medium">
                                  {getNomeMes(d.mesReferencia)}/{String(d.anoReferencia).slice(-2)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-12 text-slate-400">
                          <BarChart3 size={48} className="mx-auto mb-3 opacity-30" />
                          <p>Sem dados de produção disponíveis</p>
                        </div>
                      )}
                    </div>

                    {/* Composição do Saldo e Distribuição */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Composição do Saldo */}
                      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                        <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                          <Layers size={20} className="text-orange-500" />
                          Composição do Saldo
                          <span className="text-xs font-normal text-slate-400 ml-auto">Créditos expiram em 60 meses</span>
                        </h4>

                        {saldoComposicao.length > 0 ? (
                          <div className="space-y-3">
                            {saldoComposicao.map((c, i) => (
                              <div
                                key={i}
                                className={`flex items-center justify-between p-3 rounded-lg border ${
                                  c.expirado ? 'bg-red-50 border-red-200' :
                                  c.expirando ? 'bg-amber-50 border-amber-200' :
                                  'bg-slate-50 border-slate-200'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                    c.expirado ? 'bg-red-100' :
                                    c.expirando ? 'bg-amber-100' :
                                    'bg-green-100'
                                  }`}>
                                    {c.expirado ? <AlertCircle size={16} className="text-red-600" /> :
                                     c.expirando ? <Timer size={16} className="text-amber-600" /> :
                                     <CheckCircle2 size={16} className="text-green-600" />}
                                  </div>
                                  <div>
                                    <p className="font-medium text-slate-700">
                                      {getNomeMes(c.mesReferencia)}/{c.anoReferencia}
                                    </p>
                                    <p className={`text-xs ${
                                      c.expirado ? 'text-red-600 font-bold' :
                                      c.expirando ? 'text-amber-600 font-bold' :
                                      'text-slate-500'
                                    }`}>
                                      {c.expirado ? 'EXPIRADO!' :
                                       c.expirando ? `Expira em ${c.mesesRestantes} meses` :
                                       `${c.mesesRestantes} meses restantes`}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-slate-800">{c.saldoAnteriorConv} kWh</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-slate-400">
                            <Layers size={40} className="mx-auto mb-3 opacity-30" />
                            <p>Sem dados de composição</p>
                          </div>
                        )}
                      </div>

                      {/* Distribuição por Beneficiária */}
                      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                        <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                          <PieChart size={20} className="text-[#00A3E0]" />
                          Distribuição por Beneficiária
                        </h4>

                        {beneficiariasAgrupadas.length > 0 ? (
                          <div className="space-y-3">
                            {beneficiariasAgrupadas.slice(0, 5).map((b, i) => {
                              const percentual = metricas.transferidoTotal > 0
                                ? ((b.total / metricas.transferidoTotal) * 100).toFixed(1)
                                : '0';
                              return (
                                <div key={i} className="relative">
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                      <Home size={14} className="text-slate-400" />
                                      <span className="text-sm font-medium text-slate-700">UC {b.cdc}</span>
                                    </div>
                                    <span className="text-sm font-bold text-slate-800">{b.total.toLocaleString('pt-BR')} kWh</span>
                                  </div>
                                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-gradient-to-r from-[#00A3E0] to-blue-400 rounded-full transition-all"
                                      style={{ width: `${percentual}%` }}
                                    ></div>
                                  </div>
                                  <p className="text-[10px] text-slate-400 mt-1">{b.bairro}, {b.municipio} • {percentual}%</p>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-slate-400">
                            <PieChart size={40} className="mx-auto mb-3 opacity-30" />
                            <p>Sem transferências registradas</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ABA HISTÓRICO */}
                {abaAtiva === 'historico' && (
                  <div className="animate-fade-in">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="text-left p-4 font-bold text-slate-600">Mês/Ano</th>
                            <th className="text-right p-4 font-bold text-slate-600">Saldo Anterior</th>
                            <th className="text-right p-4 font-bold text-slate-600">Produção</th>
                            <th className="text-right p-4 font-bold text-slate-600">Consumo Próprio</th>
                            <th className="text-right p-4 font-bold text-slate-600">Transferido</th>
                            <th className="text-right p-4 font-bold text-slate-600">Compensado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {gdDetails?.historico_mensal && gdDetails.historico_mensal.length > 0 ? (
                            gdDetails.historico_mensal.map((h, i) => (
                              <tr key={i} className="hover:bg-slate-50 transition-colors">
                                <td className="p-4 font-medium text-slate-800">
                                  <div className="flex items-center gap-2">
                                    <Calendar size={16} className="text-orange-400" />
                                    {getNomeMes(h.mesReferencia)}/{h.anoReferencia}
                                  </div>
                                </td>
                                <td className="p-4 text-right text-slate-600">{h.saldoAnteriorConv?.toLocaleString('pt-BR')} kWh</td>
                                <td className="p-4 text-right">
                                  <span className={`font-bold ${h.injetadoConv > 0 ? 'text-green-600' : 'text-slate-400'}`}>
                                    {h.injetadoConv > 0 ? '+' : ''}{h.injetadoConv?.toLocaleString('pt-BR')} kWh
                                  </span>
                                </td>
                                <td className="p-4 text-right text-purple-600">{h.consumoInjetadoCompensadoConv?.toLocaleString('pt-BR')} kWh</td>
                                <td className="p-4 text-right">
                                  <span className={`font-bold ${h.consumoTransferidoConv > 0 ? 'text-[#00A3E0]' : 'text-slate-400'}`}>
                                    {h.consumoTransferidoConv?.toLocaleString('pt-BR')} kWh
                                  </span>
                                </td>
                                <td className="p-4 text-right text-slate-600">{h.consumoCompensadoConv?.toLocaleString('pt-BR')} kWh</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={6} className="p-8 text-center text-slate-400">
                                Sem histórico disponível
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ABA TRANSFERÊNCIAS */}
                {abaAtiva === 'transferencias' && (
                  <div className="space-y-6 animate-fade-in">
                    {beneficiariasAgrupadas.length > 0 ? (
                      beneficiariasAgrupadas.map((b, i) => (
                        <div key={i} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                          <div className="bg-gradient-to-r from-slate-50 to-white p-5 border-b border-slate-100">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                                  <Home className="text-[#00A3E0]" size={24} />
                                </div>
                                <div>
                                  <h5 className="font-bold text-lg text-slate-800">UC {b.cdc}</h5>
                                  <p className="text-sm text-slate-500 flex items-center gap-1">
                                    <MapPin size={14} />
                                    {b.endereco} - {b.bairro}, {b.municipio}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-2xl font-bold text-[#00A3E0]">{b.total.toLocaleString('pt-BR')} kWh</p>
                                <p className="text-xs text-slate-500">Total recebido</p>
                              </div>
                            </div>
                          </div>

                          <div className="p-4">
                            <p className="text-xs font-bold text-slate-500 uppercase mb-3">Histórico de Transferências</p>
                            <div className="flex flex-wrap gap-2">
                              {b.transferencias.slice(0, 12).map((t, j) => (
                                <div key={j} className="bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
                                  <p className="text-xs text-slate-500">{getNomeMes(t.mes)}/{t.ano}</p>
                                  <p className="font-bold text-slate-800">{t.valor.toLocaleString('pt-BR')} kWh</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="bg-white rounded-xl p-12 text-center text-slate-400 border border-dashed border-slate-300">
                        <ArrowRightLeft size={48} className="mx-auto mb-4 opacity-30" />
                        <p className="font-medium">Nenhuma transferência registrada</p>
                        <p className="text-sm mt-1">As transferências para beneficiárias aparecerão aqui</p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between text-sm shrink-0">
            <div className="flex items-center gap-4 text-slate-500">
              <span className="flex items-center gap-1">
                <Sun size={14} className="text-orange-400" />
                {usina.tipo_geracao || 'Solar'}
              </span>
              <span>CDC: {usina.cdc}</span>
            </div>
            <span className="text-slate-400">
              Fonte: {gdDetails?.fonte === 'gateway' ? 'Energisa (tempo real)' : 'Dados locais'}
            </span>
          </div>
        </div>
      </div>
    );
  };

  // --- RENDER DASHBOARD ---
  const renderDashboard = () => (
    <div className="animate-fade-in">
      <header className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={`text-2xl sm:text-3xl font-bold ${textPrimary}`}>Dashboard</h1>
          <p className={`${textMuted} mt-1`}>Visão geral do seu sistema de gestão de energia</p>
        </div>
        <button
          onClick={() => fetchDadosDashboard(empresas)}
          disabled={loadingDashboard}
          className={`p-2 rounded-full transition ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-200 text-slate-600'}`}
        >
          <RefreshCw size={20} className={loadingDashboard ? "animate-spin" : ""} />
        </button>
      </header>

      {loadingDashboard && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 text-sm ${isDark ? 'bg-blue-900/30 border border-blue-800 text-blue-300' : 'bg-blue-50 border border-blue-200 text-blue-700'}`}>
          <Loader2 size={16} className="animate-spin" />
          Carregando dados do dashboard...
        </div>
      )}

      {/* Cards de Métricas Principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
        <div className={`rounded-xl p-4 sm:p-6 shadow-sm border hover:shadow-md transition-shadow ${cardStyle}`}>
          <div className="flex items-center justify-between mb-4">
            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center ${isDark ? 'bg-blue-900/50' : 'bg-blue-100'}`}>
              <Building2 className="text-[#00A3E0]" size={24} />
            </div>
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${isDark ? 'text-green-400 bg-green-900/30' : 'text-green-600 bg-green-50'}`}>
              {metricas.empresasConectadas} conectadas
            </span>
          </div>
          <h3 className={`text-2xl sm:text-3xl font-bold ${textPrimary}`}>{metricas.totalEmpresas}</h3>
          <p className={`${textMuted} text-sm mt-1`}>Empresas cadastradas</p>
        </div>

        <div className={`rounded-xl p-4 sm:p-6 shadow-sm border hover:shadow-md transition-shadow ${cardStyle}`}>
          <div className="flex items-center justify-between mb-4">
            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center ${isDark ? 'bg-purple-900/50' : 'bg-purple-100'}`}>
              <Home className="text-purple-600" size={24} />
            </div>
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${isDark ? 'text-purple-400 bg-purple-900/30' : 'text-purple-600 bg-purple-50'}`}>
              {metricas.totalUsinas} usinas
            </span>
          </div>
          <h3 className={`text-2xl sm:text-3xl font-bold ${textPrimary}`}>{metricas.totalUcs}</h3>
          <p className={`${textMuted} text-sm mt-1`}>Unidades Consumidoras</p>
        </div>

        <div className={`rounded-xl p-4 sm:p-6 shadow-sm border hover:shadow-md transition-shadow ${cardStyle}`}>
          <div className="flex items-center justify-between mb-4">
            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center ${isDark ? 'bg-amber-900/50' : 'bg-amber-100'}`}>
              <FileText className="text-amber-600" size={24} />
            </div>
            {metricas.faturasPendentes > 0 && (
              <span className={`text-xs font-bold px-2 py-1 rounded-full animate-pulse ${isDark ? 'text-amber-400 bg-amber-900/30' : 'text-amber-600 bg-amber-50'}`}>
                {metricas.faturasPendentes} pendentes
              </span>
            )}
          </div>
          <h3 className={`text-2xl sm:text-3xl font-bold ${textPrimary}`}>{metricas.totalFaturas}</h3>
          <p className={`${textMuted} text-sm mt-1`}>Faturas registradas</p>
        </div>

        <div className="bg-gradient-to-br from-[#00A3E0] to-blue-600 rounded-xl p-4 sm:p-6 shadow-sm text-white hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <DollarSign className="text-white" size={24} />
            </div>
          </div>
          <h3 className="text-2xl sm:text-3xl font-bold">R$ {metricas.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
          <p className="text-blue-100 text-sm mt-1">Valor total em faturas</p>
        </div>
      </div>

      {/* Segunda linha */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-8">
        <div className="bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl p-4 sm:p-6 shadow-sm text-white">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Sun className="text-white" size={24} />
            </div>
            <div>
              <h4 className="font-bold text-lg">Energia Solar</h4>
              <p className="text-orange-100 text-sm">Saldo acumulado</p>
            </div>
          </div>
          <h3 className="text-4xl font-bold">{metricas.saldoTotalKwh.toLocaleString('pt-BR')}</h3>
          <p className="text-orange-100 text-sm mt-1">kWh disponíveis para compensação</p>
        </div>

        <div className={`rounded-xl p-4 sm:p-6 shadow-sm border lg:col-span-2 ${cardStyle}`}>
          <div className="flex items-center justify-between mb-4">
            <h4 className={`font-bold ${textPrimary} flex items-center gap-2`}>
              <PieChart size={20} className="text-[#00A3E0]" /> Status das Conexões
            </h4>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <div className={`text-center p-2 sm:p-4 rounded-xl border ${isDark ? 'bg-green-900/30 border-green-800' : 'bg-green-50 border-green-100'}`}>
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 className="text-white" size={18} />
              </div>
              <h5 className={`text-xl sm:text-2xl font-bold ${isDark ? 'text-green-400' : 'text-green-700'}`}>{metricas.empresasConectadas}</h5>
              <p className={`text-xs ${isDark ? 'text-green-400' : 'text-green-600'}`}>Conectadas</p>
            </div>
            <div className={`text-center p-2 sm:p-4 rounded-xl border ${isDark ? 'bg-amber-900/30 border-amber-800' : 'bg-amber-50 border-amber-100'}`}>
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-amber-500 rounded-full flex items-center justify-center mx-auto mb-2">
                <Clock className="text-white" size={18} />
              </div>
              <h5 className={`text-xl sm:text-2xl font-bold ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
                {empresas.filter(e => e.status_conexao === 'AGUARDANDO_SMS').length}
              </h5>
              <p className={`text-xs ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>Aguardando</p>
            </div>
            <div className={`text-center p-2 sm:p-4 rounded-xl border ${isDark ? 'bg-red-900/30 border-red-800' : 'bg-red-50 border-red-100'}`}>
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-2">
                <AlertCircle className="text-white" size={18} />
              </div>
              <h5 className={`text-xl sm:text-2xl font-bold ${isDark ? 'text-red-400' : 'text-red-700'}`}>
                {empresas.filter(e => !['CONECTADO', 'AGUARDANDO_SMS'].includes(e.status_conexao || '')).length}
              </h5>
              <p className={`text-xs ${isDark ? 'text-red-400' : 'text-red-600'}`}>Desconectadas</p>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de empresas */}
      <div className={`rounded-xl shadow-sm border overflow-hidden ${cardStyle}`}>
        <div className={`p-4 sm:p-6 border-b flex items-center justify-between ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
          <h4 className={`font-bold ${textPrimary} flex items-center gap-2`}>
            <BarChart3 size={20} className="text-[#00A3E0]" /> Suas Empresas
          </h4>
          <button onClick={() => setPaginaAtual('empresas')} className="text-sm text-[#00A3E0] hover:text-blue-700 font-medium">
            Ver todas
          </button>
        </div>
        <div className={`divide-y ${isDark ? 'divide-slate-700' : 'divide-slate-100'}`}>
          {empresas.slice(0, 5).map(emp => (
            <div key={emp.id} className={`p-4 flex items-center justify-between transition-colors ${isDark ? 'hover:bg-slate-700/50' : 'hover:bg-slate-50'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${emp.status_conexao === 'CONECTADO' ? (isDark ? 'bg-green-900/50' : 'bg-green-100') : (isDark ? 'bg-slate-700' : 'bg-slate-100')}`}>
                  <Plug size={18} className={emp.status_conexao === 'CONECTADO' ? 'text-green-500' : 'text-slate-400'} />
                </div>
                <div>
                  <h5 className={`font-medium ${textPrimary}`}>{emp.nome_empresa}</h5>
                  <p className={`text-xs ${textMuted}`}>CPF: {emp.responsavel_cpf}</p>
                </div>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-bold ${emp.status_conexao === 'CONECTADO' ? (isDark ? 'bg-green-900/50 text-green-400' : 'bg-green-100 text-green-700') : (isDark ? 'bg-red-900/50 text-red-400' : 'bg-red-100 text-red-700')}`}>
                {emp.status_conexao || 'PENDENTE'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // --- RENDER EMPRESAS ---
  const renderEmpresas = () => (
    <>
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Empresas</h1>
          <p className="text-slate-500 mt-1">Gerencie suas empresas e conexões com a Energisa</p>
        </div>
        <button onClick={fetchEmpresas} className="p-2 hover:bg-slate-200 rounded-full text-slate-600 transition">
          <RefreshCw size={20} />
        </button>
      </header>

      <div className="bg-white p-6 rounded-xl shadow-sm mb-8 border border-slate-200">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-slate-700"><Plus className="text-[#00A3E0]" /> Nova Empresa</h2>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-4">
            <label className="text-xs font-bold text-slate-500 uppercase ml-1">Nome</label>
            <input value={novoNome} className="w-full border border-slate-300 p-2.5 rounded-lg mt-1 focus:outline-none focus:ring-2 focus:ring-[#00A3E0]" onChange={e => setNovoNome(e.target.value)} placeholder="Nome da empresa" />
          </div>
          <div className="md:col-span-4">
            <label className="text-xs font-bold text-slate-500 uppercase ml-1">CPF</label>
            <input value={novoCpf} className="w-full border border-slate-300 p-2.5 rounded-lg mt-1 focus:outline-none focus:ring-2 focus:ring-[#00A3E0]" onChange={e => setNovoCpf(e.target.value)} placeholder="000.000.000-00" />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-bold text-slate-500 uppercase ml-1">Tel</label>
            <input value={novoTel} className="w-full border border-slate-300 p-2.5 rounded-lg mt-1 focus:outline-none focus:ring-2 focus:ring-[#00A3E0]" onChange={e => setNovoTel(e.target.value)} placeholder="0000" />
          </div>
          <div className="md:col-span-2">
            <button onClick={handleRegister} disabled={submitting} className="w-full bg-[#00A3E0] text-white px-4 py-2.5 rounded-lg font-bold disabled:opacity-50 flex items-center justify-center gap-2">
              {submitting ? <Loader2 size={18} className="animate-spin" /> : 'Salvar'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loadingEmpresas ? (
          <div className="col-span-full flex flex-col items-center justify-center py-12 text-slate-500">
            <Loader2 size={32} className="animate-spin text-[#00A3E0] mb-3" />
            <p>Carregando empresas...</p>
          </div>
        ) : empresas.length === 0 ? (
          <div className="col-span-full text-center py-12 text-slate-500 bg-white rounded-xl border border-dashed border-slate-300">
            <Activity size={40} className="mx-auto mb-3 text-slate-300" />
            <p>Nenhuma empresa cadastrada</p>
          </div>
        ) : (
          empresas.map(emp => (
            <div key={emp.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-lg transition-shadow flex flex-col justify-between h-48">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-lg text-slate-800 line-clamp-1">{emp.nome_empresa}</h3>
                  <Plug size={20} className={emp.status_conexao === 'CONECTADO' ? "text-green-500" : "text-slate-300"} />
                </div>
                <span className={`text-[10px] px-2 py-1 rounded-md font-bold uppercase ${emp.status_conexao === 'CONECTADO' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {emp.status_conexao || 'PENDENTE'}
                </span>
              </div>
              <div className="mt-4">
                {emp.status_conexao === 'CONECTADO' ? (
                  <button onClick={() => abrirDetalhesEmpresa(emp)} className="w-full border border-[#00A3E0] text-[#00A3E0] py-2.5 rounded-lg hover:bg-blue-50 transition text-sm font-bold flex items-center justify-center gap-2">
                    <FileText size={18} /> Gerenciar Faturas
                  </button>
                ) : (
                  <button onClick={() => handleConnect(emp.id)} disabled={loading} className="w-full bg-slate-900 text-white py-2.5 rounded-lg hover:bg-slate-800 transition text-sm font-bold flex items-center justify-center gap-2">
                    {loading ? <Loader2 className="animate-spin" size={18} /> : <Plug size={18} />} Conectar Energisa
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );

  // --- RENDER USINAS (NOVA PÁGINA) ---
  const renderUsinas = () => (
    <div className="animate-fade-in">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Usinas Geradoras</h1>
          <p className="text-slate-500 mt-1">Visualize todas as usinas e suas beneficiárias</p>
        </div>
        <button
          onClick={() => fetchTodasUsinas(empresas)}
          disabled={loadingUsinas}
          className="p-2 hover:bg-slate-200 rounded-full text-slate-600 transition"
        >
          <RefreshCw size={20} className={loadingUsinas ? "animate-spin" : ""} />
        </button>
      </header>

      {loadingUsinas && (
        <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg flex items-center gap-2 text-orange-700 text-sm">
          <Loader2 size={16} className="animate-spin" />
          Carregando usinas...
        </div>
      )}

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <div className="bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl p-6 text-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Sun size={24} />
            </div>
            <div>
              <h3 className="text-3xl font-bold">{todasUsinas.length}</h3>
              <p className="text-orange-100 text-sm">Usinas Geradoras</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Home className="text-[#00A3E0]" size={24} />
            </div>
            <div>
              <h3 className="text-3xl font-bold text-slate-800">
                {todasUsinas.reduce((acc, u) => acc + (u.beneficiarias?.length || 0), 0)}
              </h3>
              <p className="text-slate-500 text-sm">Beneficiárias</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <BatteryCharging className="text-green-600" size={24} />
            </div>
            <div>
              <h3 className="text-3xl font-bold text-slate-800">
                {todasUsinas.reduce((acc, u) => acc + (u.saldo_acumulado || 0), 0).toLocaleString('pt-BR')}
              </h3>
              <p className="text-slate-500 text-sm">kWh Total</p>
            </div>
          </div>
        </div>
      </div>

      {/* Grid de cards de usinas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {todasUsinas.length === 0 && !loadingUsinas ? (
          <div className="col-span-full text-center py-12 text-slate-500 bg-white rounded-xl border border-dashed border-slate-300">
            <Sun size={48} className="mx-auto mb-3 text-slate-300" />
            <p className="font-medium">Nenhuma usina encontrada</p>
            <p className="text-sm text-slate-400 mt-1">Conecte empresas para visualizar suas usinas</p>
          </div>
        ) : (
          todasUsinas.map(usina => (
            <div key={usina.id} className="bg-white rounded-xl shadow-sm border border-orange-100 overflow-hidden hover:shadow-lg transition-shadow group">
              {/* Header do card */}
              <div className="bg-gradient-to-r from-orange-50 to-amber-50 p-5 border-b border-orange-100">
                <div className="flex items-start justify-between">
                  <div className="flex gap-3">
                    <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center group-hover:bg-orange-200 transition-colors">
                      <Sun className="text-orange-500" size={24} />
                    </div>
                    <div>
                      <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold">GERADORA</span>
                      <h3 className="font-bold text-lg text-slate-800 mt-1">UC {usina.codigo_uc}</h3>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => abrirDetalhesUsina(usina)}
                      className="p-2 bg-white rounded-lg border border-orange-200 hover:bg-orange-50 hover:border-orange-300 transition-all shadow-sm"
                      title="Ver detalhes de geração"
                    >
                      <BarChart3 size={20} className="text-orange-500" />
                    </button>
                    <button
                      onClick={() => setUsinaArvoreModal(usina)}
                      className="p-2 bg-white rounded-lg border border-orange-200 hover:bg-orange-50 hover:border-orange-300 transition-all shadow-sm"
                      title="Ver árvore de beneficiárias"
                    >
                      <GitBranch size={20} className="text-orange-500" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Body do card */}
              <div className="p-5">
                <p className="text-sm text-slate-600 truncate mb-3" title={usina.endereco}>
                  {usina.endereco}
                </p>

                {/* Info empresa */}
                <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
                  <Building2 size={14} />
                  <span className="truncate">{usina.empresa_nome}</span>
                </div>

                {/* Métricas */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-orange-50 rounded-lg p-3 text-center">
                    <div className="flex items-center justify-center gap-1 text-orange-600 mb-1">
                      <BatteryCharging size={16} />
                    </div>
                    <p className="text-lg font-bold text-slate-800">{usina.saldo_acumulado || 0}</p>
                    <p className="text-[10px] text-slate-500 uppercase">kWh Saldo</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <div className="flex items-center justify-center gap-1 text-[#00A3E0] mb-1">
                      <Share2 size={16} />
                    </div>
                    <p className="text-lg font-bold text-slate-800">{usina.beneficiarias?.length || 0}</p>
                    <p className="text-[10px] text-slate-500 uppercase">Beneficiárias</p>
                  </div>
                </div>

                {/* Lista preview de beneficiárias */}
                {usina.beneficiarias && usina.beneficiarias.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-2">Rateio:</p>
                    <div className="flex flex-wrap gap-1">
                      {usina.beneficiarias.slice(0, 3).map(ben => (
                        <span key={ben.id} className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
                          {ben.codigo_uc}: {ben.percentual_rateio}%
                        </span>
                      ))}
                      {usina.beneficiarias.length > 3 && (
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
                          +{usina.beneficiarias.length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  // Sidebar width based on collapsed state
  const sidebarWidth = sidebarCollapsed ? 'w-20' : 'w-64';
  const mainMargin = sidebarCollapsed ? 'md:ml-20' : 'md:ml-64';

  // Dark mode styles
  const cardStyle = isDark
    ? 'bg-slate-800 border-slate-700 text-slate-100'
    : 'bg-white border-slate-200 text-slate-900';
  const inputStyle = isDark
    ? 'bg-slate-700 border-slate-600 text-slate-100 placeholder-slate-400'
    : 'bg-white border-slate-300 text-slate-900 placeholder-slate-500';
  const textMuted = isDark ? 'text-slate-400' : 'text-slate-500';
  const textPrimary = isDark ? 'text-slate-100' : 'text-slate-800';

  return (
    <div className={`min-h-screen flex font-sans transition-colors duration-300 ${isDark ? 'bg-slate-900 text-slate-100' : 'bg-slate-100 text-slate-900'}`}>
      {/* Overlay mobile */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`${sidebarWidth} bg-[#0f172a] text-white flex flex-col fixed h-full z-50 transition-all duration-300 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        {/* Header da Sidebar */}
        <div className={`p-4 flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} border-b border-slate-800`}>
          <div className={`flex items-center gap-2 ${sidebarCollapsed ? 'justify-center' : ''}`}>
            <div className="w-10 h-10 bg-[#00A3E0] rounded-xl flex items-center justify-center shrink-0">
              <Zap size={22} className="text-white" />
            </div>
            {!sidebarCollapsed && <span className="text-xl font-bold text-white">GestorEnergy</span>}
          </div>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden md:flex p-2 hover:bg-slate-800 rounded-lg transition text-slate-400 hover:text-white"
            title={sidebarCollapsed ? "Expandir menu" : "Recolher menu"}
          >
            {sidebarCollapsed ? <PanelLeft size={20} /> : <PanelLeftClose size={20} />}
          </button>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden p-2 hover:bg-slate-800 rounded-lg transition text-slate-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Info do usuario */}
        <div className={`${sidebarCollapsed ? 'p-2' : 'p-4'}`}>
          <div className={`bg-slate-800/50 rounded-lg ${sidebarCollapsed ? 'p-2' : 'p-3'}`}>
            <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
              <div className="w-10 h-10 bg-[#00A3E0] rounded-full flex items-center justify-center shrink-0">
                <User size={18} />
              </div>
              {!sidebarCollapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{usuario?.nome_completo.split(' ')[0]}</p>
                  <p className="text-xs text-slate-400 truncate">{usuario?.email}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className={`flex-1 overflow-y-auto ${sidebarCollapsed ? 'px-2' : 'px-4'} space-y-1`}>
          {/* Dashboard */}
          <button
            onClick={() => { setPaginaAtual('dashboard'); setVendoEmpresa(null); setMobileMenuOpen(false); }}
            className={`flex w-full items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} transition px-3 py-2.5 rounded-lg ${
              paginaAtual === 'dashboard' && !vendoEmpresa
                ? 'bg-[#00A3E0] text-white'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title={sidebarCollapsed ? "Dashboard" : ""}
          >
            <Activity size={20} />
            {!sidebarCollapsed && <span>Dashboard</span>}
          </button>

          {/* Empresas com submenu */}
          <div>
            <button
              onClick={() => setMenuEmpresasAberto(!menuEmpresasAberto)}
              className={`flex w-full items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} transition px-3 py-2.5 rounded-lg ${
                (paginaAtual === 'empresas' || paginaAtual === 'usinas') && !vendoEmpresa
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
              title={sidebarCollapsed ? "Empresas" : ""}
            >
              <span className={`flex items-center ${sidebarCollapsed ? '' : 'gap-3'}`}>
                <Building2 size={20} />
                {!sidebarCollapsed && <span>Empresas</span>}
              </span>
              {!sidebarCollapsed && <ChevronDown size={16} className={`transition-transform ${menuEmpresasAberto ? 'rotate-180' : ''}`} />}
            </button>

            {/* Submenu */}
            {menuEmpresasAberto && !sidebarCollapsed && (
              <div className="ml-4 mt-1 space-y-1 border-l-2 border-slate-700 pl-4">
                <button
                  onClick={() => { setPaginaAtual('empresas'); setVendoEmpresa(null); setMobileMenuOpen(false); }}
                  className={`flex w-full items-center gap-3 transition px-3 py-2 rounded-lg text-sm ${
                    paginaAtual === 'empresas' && !vendoEmpresa
                      ? 'bg-[#00A3E0] text-white'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Plug size={16} /> Gerenciar
                </button>
                <button
                  onClick={() => { setPaginaAtual('usinas'); setVendoEmpresa(null); setMobileMenuOpen(false); }}
                  className={`flex w-full items-center gap-3 transition px-3 py-2 rounded-lg text-sm ${
                    paginaAtual === 'usinas' && !vendoEmpresa
                      ? 'bg-[#00A3E0] text-white'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Sun size={16} /> Usinas
                </button>
              </div>
            )}
          </div>

          {/* Gestores */}
          <button
            onClick={() => { setPaginaAtual('gestores'); setVendoEmpresa(null); setMobileMenuOpen(false); }}
            className={`flex w-full items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} transition px-3 py-2.5 rounded-lg ${
              paginaAtual === 'gestores' && !vendoEmpresa
                ? 'bg-[#00A3E0] text-white'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title={sidebarCollapsed ? "Gestores" : ""}
          >
            <UserCog size={20} />
            {!sidebarCollapsed && <span>Gestores</span>}
          </button>
        </nav>

        {/* Footer da Sidebar */}
        <div className={`border-t border-slate-800 ${sidebarCollapsed ? 'p-2' : 'p-4'} space-y-2`}>
          {/* Toggle Dark Mode */}
          <button
            onClick={toggleTheme}
            className={`flex w-full items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} text-slate-400 hover:text-white transition px-3 py-2.5 rounded-lg hover:bg-slate-800/50`}
            title={sidebarCollapsed ? (isDark ? "Modo claro" : "Modo escuro") : ""}
          >
            {isDark ? <SunMedium size={20} /> : <Moon size={20} />}
            {!sidebarCollapsed && <span>{isDark ? 'Modo Claro' : 'Modo Escuro'}</span>}
          </button>

          {/* Logout */}
          <button
            onClick={logout}
            className={`flex w-full items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} text-slate-400 hover:text-red-400 transition px-3 py-2.5 rounded-lg hover:bg-slate-800/50`}
            title={sidebarCollapsed ? "Sair" : ""}
          >
            <LogOut size={20} />
            {!sidebarCollapsed && <span>Sair</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className={`flex-1 ${mainMargin} flex flex-col min-h-screen transition-all duration-300`}>
        {/* Header Mobile */}
        <header className={`md:hidden sticky top-0 z-30 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} border-b px-4 py-3 flex items-center justify-between`}>
          <button
            onClick={() => setMobileMenuOpen(true)}
            className={`p-2 rounded-lg ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-100'} transition`}
          >
            <Menu size={24} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#00A3E0] rounded-lg flex items-center justify-center">
              <Zap size={18} className="text-white" />
            </div>
            <span className="font-bold">GestorEnergy</span>
          </div>
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-lg ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-100'} transition`}
          >
            {isDark ? <SunMedium size={20} /> : <Moon size={20} />}
          </button>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-8 overflow-auto">
        {vendoEmpresa ? (
          <div className="animate-fade-in">
            <button onClick={() => setVendoEmpresa(null)} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 mb-6 font-medium"><ArrowLeft size={20} /> Voltar</button>

            <header className="mb-8 flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-slate-800">{vendoEmpresa.nome_empresa}</h1>
                <div className="flex items-center gap-3 mt-1">
                  <p className="text-slate-500 text-sm">Painel de Controle</p>
                  <button onClick={refreshDadosEmpresa} disabled={loading} className="text-[#00A3E0] hover:text-blue-700 p-1 rounded-full hover:bg-blue-50 transition">
                    <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                  </button>
                </div>
              </div>
              <div className="flex bg-white rounded-lg p-1 shadow-sm border border-slate-200">
                <button onClick={() => setAbaAtiva('geral')} className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition ${abaAtiva === 'geral' ? 'bg-[#00A3E0] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><FileText size={16} /> Faturas</button>
                <button onClick={carregarUsinas} className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition ${abaAtiva === 'usinas' ? 'bg-[#00A3E0] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><Sun size={16} /> Usinas</button>
              </div>
            </header>

            {abaAtiva === 'geral' && (
              <div className="space-y-6">
                {ucsDoCliente.map(uc => (
                  <div key={uc.id} className={`bg-white rounded-xl shadow-sm border overflow-hidden ${uc.is_geradora ? 'border-orange-200' : 'border-slate-200'}`}>
                    <div className={`p-5 flex flex-wrap justify-between items-center gap-4 ${uc.is_geradora ? 'bg-orange-50/50' : 'bg-slate-50/50'}`}>
                      <div>
                        <h3 className="font-bold text-lg flex items-center gap-2 text-slate-800">
                          {uc.is_geradora ? <Sun className="text-orange-500" size={24} /> : <Home className="text-slate-400" size={20} />} UC: {uc.codigo_uc}
                          {uc.is_geradora && <span className="bg-orange-100 text-orange-700 text-[10px] px-2 py-0.5 rounded-full font-extrabold">USINA</span>}
                        </h3>
                        <p className="text-slate-500 text-sm ml-8">{uc.endereco}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        {uc.is_geradora && <div className="flex items-center gap-1 text-orange-600 font-bold"><BatteryCharging size={18} /> {uc.saldo_acumulado} kWh</div>}
                        <button onClick={() => toggleFaturas(uc.id)} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium">
                          {expandedUcs[uc.id] ? <ChevronUp size={16} /> : <ChevronDown size={16} />} {expandedUcs[uc.id] ? 'Ocultar' : 'Ver Faturas'}
                        </button>
                      </div>
                    </div>
                    {renderTabelaFaturas(uc.id)}
                  </div>
                ))}
              </div>
            )}

            {abaAtiva === 'usinas' && (
              <div className="space-y-8">
                {usinasDoCliente.length === 0 && <div className="text-center p-10 bg-white rounded-xl text-slate-500 border border-dashed border-slate-300">Nenhuma usina identificada.</div>}
                {usinasDoCliente.map(usina => (
                  <div key={usina.id} className="bg-white rounded-xl shadow-md border border-orange-100 overflow-hidden">
                    <div className="bg-gradient-to-r from-orange-50 to-white p-6 border-b border-orange-100">
                      <div className="flex justify-between items-start">
                        <div className="flex gap-4">
                          <div className="bg-orange-100 p-3 rounded-full h-14 w-14 flex items-center justify-center"><Sun className="text-orange-500" size={32} /></div>
                          <div>
                            <h3 className="text-xl font-bold text-slate-800">Usina {usina.codigo_uc}</h3>
                            <p className="text-slate-500 text-sm">{usina.endereco}</p>
                            <div className="mt-3 flex gap-3">
                              <div className="bg-white px-3 py-1 rounded border border-orange-200 text-xs font-bold text-orange-700 flex items-center gap-1"><BatteryCharging size={14} /> Saldo: {usina.saldo_acumulado} kWh</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="p-6 bg-slate-50">
                      <h4 className="text-sm font-bold text-slate-500 uppercase mb-4 flex items-center gap-2"><Share2 size={16} /> Rateio de Créditos</h4>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {usina.beneficiarias?.map(ben => (
                          <div key={ben.id} className="bg-white p-4 rounded-lg border border-slate-200 flex items-center justify-between">
                            <div>
                              <span className="font-bold text-slate-700">UC {ben.codigo_uc}</span>
                              <p className="text-xs text-slate-500">{ben.endereco}</p>
                            </div>
                            <span className="text-2xl font-bold text-slate-700">{ben.percentual_rateio}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          paginaAtual === 'dashboard' ? renderDashboard() :
          paginaAtual === 'usinas' ? renderUsinas() :
          paginaAtual === 'gestores' ? <GestoresPage empresas={empresas} /> :
          renderEmpresas()
        )}
        </main>
      </div>

      {/* Modais */}
      {faturaDetalhe && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-[#00A3E0] p-5 flex justify-between items-center text-white">
              <div>
                <h3 className="font-bold text-lg">Fatura {faturaDetalhe.mes}/{faturaDetalhe.ano}</h3>
                <p className="text-blue-100 text-xs font-mono">{faturaDetalhe.numero_fatura}</p>
              </div>
              <button onClick={() => setFaturaDetalhe(null)} className="hover:bg-white/20 p-1 rounded-full"><X size={24} /></button>
            </div>
            <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              <div className="text-center pb-4 border-b border-slate-100">
                <div className="text-4xl font-extrabold text-slate-800">R$ {faturaDetalhe.valor.toFixed(2)}</div>
                <span className={`inline-block mt-2 px-3 py-1 rounded-full text-sm font-bold border ${getStatusColor(faturaDetalhe.status)}`}>{faturaDetalhe.status}</span>
              </div>
              {faturaDetalhe.codigo_barras && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2"><Barcode size={18} /> Código de Barras</div>
                  <p className="font-mono text-xs break-all text-slate-600 mb-3 bg-white p-2 rounded border">{faturaDetalhe.codigo_barras}</p>
                  <button onClick={() => copyToClipboard(faturaDetalhe.codigo_barras!)} className="w-full bg-white border border-slate-300 py-2.5 rounded-lg text-sm font-bold">Copiar</button>
                </div>
              )}
              {faturaDetalhe.pix_copia_cola && (
                <div className="bg-green-50 p-4 rounded-xl border border-green-200">
                  <div className="flex items-center gap-2 text-sm font-bold text-green-800 mb-2"><QrCode size={18} /> PIX</div>
                  <textarea readOnly className="w-full h-20 text-[10px] p-2 rounded border border-green-200 font-mono mb-2" value={faturaDetalhe.pix_copia_cola} />
                  <button onClick={() => copyToClipboard(faturaDetalhe.pix_copia_cola!)} className="w-full bg-green-600 text-white py-2.5 rounded-lg text-sm font-bold">Copiar PIX</button>
                </div>
              )}
              <button onClick={() => handleDownloadPdf(faturaDetalhe.id)} disabled={downloadingId === faturaDetalhe.id} className="w-full flex items-center justify-center gap-2 text-[#00A3E0] font-bold py-3 hover:bg-slate-50 rounded-xl">
                {downloadingId === faturaDetalhe.id ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />} Baixar PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {smsModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Codigo SMS</h2>
              <button onClick={() => { setSmsModalOpen(false); setSmsCode(""); }} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
            </div>
            <p className="text-slate-500 text-sm mb-4">Digite o codigo de 6 digitos enviado por SMS</p>
            <input
              className="w-full text-center text-3xl border-2 p-3 mb-6 rounded-lg tracking-widest font-mono"
              maxLength={6}
              value={smsCode}
              onChange={e => setSmsCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              autoFocus
            />
            <button onClick={handleValidateSms} disabled={validatingSms || smsCode.length < 4} className="w-full bg-green-500 text-white py-3 rounded-lg font-bold disabled:opacity-50 flex items-center justify-center gap-2">
              {validatingSms ? <Loader2 size={20} className="animate-spin" /> : 'Confirmar'}
            </button>
          </div>
        </div>
      )}

      {/* Modal da árvore de beneficiárias */}
      {usinaArvoreModal && (
        <ArvoreModal usina={usinaArvoreModal} onClose={() => setUsinaArvoreModal(null)} />
      )}

      {/* Modal de detalhes de GD */}
      {usinaDetalhesModal && (
        <UsinaDetalhesModal usina={usinaDetalhesModal} onClose={() => { setUsinaDetalhesModal(null); setGdDetails(null); }} />
      )}
    </div>
  );
}

export default App;
