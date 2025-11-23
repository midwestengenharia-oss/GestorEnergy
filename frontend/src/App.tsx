import { useState, useEffect } from 'react';
import { api, Empresa, UnidadeConsumidora, Fatura } from './lib/api';
import { useToast } from './components/Toast';
import { useAuth } from './contexts/AuthContext';
import {
  Activity, Plug, Plus, RefreshCw, ArrowLeft, Home, FileText, Download, Loader2, Sun, BatteryCharging, ChevronDown, ChevronUp, Barcode, QrCode, X, Share2, LogOut, User
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

function App() {
  // --- HOOKS ---
  const toast = useToast();
  const { usuario, logout } = useAuth();

  // --- ESTADOS ---
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingEmpresas, setLoadingEmpresas] = useState(true);

  // Navegação e Abas
  const [vendoEmpresa, setVendoEmpresa] = useState<Empresa | null>(null);
  const [abaAtiva, setAbaAtiva] = useState<'geral' | 'usinas'>('geral');

  // Dados
  const [ucsDoCliente, setUcsDoCliente] = useState<UnidadeConsumidora[]>([]);
  const [usinasDoCliente, setUsinasDoCliente] = useState<UnidadeConsumidora[]>([]);

  // Controle Visual
  const [faturasPorUc, setFaturasPorUc] = useState<Record<number, Fatura[]>>({});
  const [expandedUcs, setExpandedUcs] = useState<Record<number, boolean>>({});
  const [loadingUcs, setLoadingUcs] = useState<Record<number, boolean>>({});

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

  useEffect(() => { fetchEmpresas(); }, []);

  // --- API ACTIONS ---
  const fetchEmpresas = async () => {
    setLoadingEmpresas(true);
    try {
      const res = await api.get('/empresas');
      setEmpresas(res.data);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao carregar empresas');
    } finally {
      setLoadingEmpresas(false);
    }
  };

  // Funcao para recarregar tudo da empresa atual (Botao Refresh)
  const refreshDadosEmpresa = async () => {
    if (!vendoEmpresa) return;
    setLoading(true);
    try {
      // Recarrega UCs
      const resUcs = await api.get(`/empresas/${vendoEmpresa.id}/ucs`);
      setUcsDoCliente(resUcs.data);

      // Recarrega Usinas (se estiver na aba)
      if (abaAtiva === 'usinas') {
        const resUsinas = await api.get(`/empresas/${vendoEmpresa.id}/usinas`);
        setUsinasDoCliente(resUsinas.data);
      }

      // Limpa caches para forcar atualizacao das faturas se abrir de novo
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

  // --- HELPERS ---
  const getStatusColor = (status: string) => {
    const s = status?.toLowerCase() || '';
    if (s.includes('fora do prazo') || s.includes('pendente') || s.includes('atrasado')) return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    if (s.includes('pago')) return 'bg-green-50 text-green-700 border-green-200';
    return 'bg-slate-50 text-slate-700 border-slate-200';
  };

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
  const TabelaFaturas = ({ ucId }: { ucId: number }) => {
    if (loadingUcs[ucId]) return <div className="p-8 text-center text-slate-500 bg-slate-50/30 border-t border-slate-100"><Loader2 className="animate-spin mx-auto mb-2 text-[#00A3E0]" size={24} /><p className="text-sm">Buscando faturas...</p></div>;
    if (!expandedUcs[ucId] || !faturasPorUc[ucId]) return null;

    return (
      <div className="border-t border-slate-100 animate-fade-in-down">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
            <tr><th className="p-3 pl-6">Mês/Ano</th><th className="p-3">Vencimento</th><th className="p-3">Valor</th><th className="p-3">Status</th><th className="p-3 text-right pr-6">Ações</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {faturasPorUc[ucId].map(fat => (
              <tr key={fat.id} className="hover:bg-slate-50 transition-colors group">
                <td className="p-3 pl-6 font-medium text-slate-700">{fat.mes}/{fat.ano}</td>
                <td className="p-3 text-slate-600">{fat.vencimento || '-'}</td>
                <td className="p-3 font-bold text-slate-800">R$ {fat.valor.toFixed(2)}</td>
                <td className="p-3"><span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusColor(fat.status)}`}>{fat.status}</span></td>
                <td className="p-3 pr-6 flex justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setFaturaDetalhe(fat)} className="text-slate-600 hover:text-[#00A3E0] hover:bg-blue-50 border border-slate-200 hover:border-blue-200 px-3 py-1.5 rounded-md flex items-center gap-1.5 text-xs font-medium transition-all"><FileText size={14} /> Detalhes</button>
                  <button onClick={() => handleDownloadPdf(fat.id)} disabled={downloadingId === fat.id} className="text-[#00A3E0] hover:text-blue-700 hover:bg-blue-50 px-2 py-1.5 rounded-md transition-colors flex items-center gap-1">{downloadingId === fat.id ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}</button>
                </td>
              </tr>
            ))}
            {faturasPorUc[ucId].length === 0 && <tr><td colSpan={5} className="p-6 text-center text-slate-400 italic">Nenhuma fatura encontrada.</td></tr>}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex bg-slate-100 font-sans text-slate-900">
      <aside className="w-64 bg-[#0f172a] text-white p-6 hidden md:block fixed h-full flex flex-col">
        <div className="text-2xl font-bold text-[#00A3E0] mb-8 flex items-center gap-2">⚡ GestorEnergy</div>

        {/* Info do usuario */}
        <div className="bg-slate-800/50 rounded-lg p-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#00A3E0] rounded-full flex items-center justify-center">
              <User size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{usuario?.nome_completo.split(' ')[0]}</p>
              <p className="text-xs text-slate-400 truncate">{usuario?.email}</p>
            </div>
          </div>
        </div>

        <nav className="space-y-2 flex-1">
          <button onClick={() => setVendoEmpresa(null)} className="flex w-full items-center gap-3 text-slate-300 hover:text-white transition px-3 py-2.5 rounded-lg hover:bg-slate-800"><Activity size={20} /> Dashboard</button>
        </nav>

        {/* Botao Logout */}
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 text-slate-400 hover:text-red-400 transition px-3 py-2.5 rounded-lg hover:bg-slate-800/50 mt-auto"
        >
          <LogOut size={20} /> Sair
        </button>
      </aside>

      <main className="flex-1 p-8 ml-0 md:ml-64 overflow-auto">
        {vendoEmpresa ? (
          <div className="animate-fade-in">
            <button onClick={() => setVendoEmpresa(null)} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 mb-6 font-medium"><ArrowLeft size={20} /> Voltar</button>

            <header className="mb-8 flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-slate-800">{vendoEmpresa.nome_empresa}</h1>
                <div className="flex items-center gap-3 mt-1">
                  <p className="text-slate-500 text-sm">Painel de Controle</p>
                  <button onClick={refreshDadosEmpresa} disabled={loading} className="text-[#00A3E0] hover:text-blue-700 p-1 rounded-full hover:bg-blue-50 transition" title="Atualizar Dados">
                    <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                  </button>
                </div>
              </div>
              <div className="flex bg-white rounded-lg p-1 shadow-sm border border-slate-200">
                <button onClick={() => setAbaAtiva('geral')} className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition ${abaAtiva === 'geral' ? 'bg-[#00A3E0] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><FileText size={16} /> Faturas</button>
                <button onClick={carregarUsinas} className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition ${abaAtiva === 'usinas' ? 'bg-[#00A3E0] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><Sun size={16} /> Gestão Usinas</button>
              </div>
            </header>

            {/* ABA 1: GERAL */}
            {abaAtiva === 'geral' && (
              <div className="space-y-6">
                {ucsDoCliente.map(uc => (
                  <div key={uc.id} className={`bg-white rounded-xl shadow-sm border overflow-hidden transition-all duration-300 ${uc.is_geradora ? 'border-orange-200 ring-1 ring-orange-100' : 'border-slate-200'}`}>
                    <div className={`p-5 flex flex-wrap justify-between items-center gap-4 ${uc.is_geradora ? 'bg-orange-50/50' : 'bg-slate-50/50'}`}>
                      <div>
                        <h3 className="font-bold text-lg flex items-center gap-2 text-slate-800">
                          {uc.is_geradora ? <Sun className="text-orange-500 fill-orange-500" size={24} /> : <Home className="text-slate-400" size={20} />} UC: {uc.codigo_uc}
                          {uc.is_geradora && <span className="bg-orange-100 text-orange-700 text-[10px] px-2 py-0.5 rounded-full font-extrabold tracking-wide border border-orange-200">USINA</span>}
                        </h3>
                        <p className="text-slate-500 text-sm ml-8">{uc.endereco}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        {uc.is_geradora && <div className="flex items-center gap-1 text-orange-600 font-bold mr-4"><BatteryCharging size={18} /> {uc.saldo_acumulado} kWh</div>}
                        <button onClick={() => toggleFaturas(uc.id)} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:border-slate-400 transition text-sm font-medium shadow-sm active:scale-95">
                          {expandedUcs[uc.id] ? <ChevronUp size={16} /> : <ChevronDown size={16} />} {expandedUcs[uc.id] ? 'Ocultar' : 'Ver Faturas'}
                        </button>
                      </div>
                    </div>
                    <TabelaFaturas ucId={uc.id} />
                  </div>
                ))}
              </div>
            )}

            {/* ABA 2: USINAS */}
            {abaAtiva === 'usinas' && (
              <div className="space-y-8">
                {usinasDoCliente.length === 0 && <div className="text-center p-10 bg-white rounded-xl text-slate-500 border border-dashed border-slate-300">Nenhuma usina identificada.</div>}

                {usinasDoCliente.map(usina => (
                  <div key={usina.id} className="bg-white rounded-xl shadow-md border border-orange-100 overflow-hidden">
                    <div className="bg-gradient-to-r from-orange-50 to-white p-6 border-b border-orange-100">
                      <div className="flex justify-between items-start">
                        <div className="flex gap-4">
                          <div className="bg-orange-100 p-3 rounded-full h-14 w-14 flex items-center justify-center shadow-sm"><Sun className="text-orange-500" size={32} /></div>
                          <div>
                            <h3 className="text-xl font-bold text-slate-800">Usina {usina.codigo_uc}</h3>
                            <p className="text-slate-500 text-sm flex items-center gap-1"><Home size={14} /> {usina.endereco}</p>
                            <div className="mt-3 flex gap-3">
                              <div className="bg-white px-3 py-1 rounded border border-orange-200 text-xs font-bold text-orange-700 flex items-center gap-1"><BatteryCharging size={14} /> Saldo: {usina.saldo_acumulado} kWh</div>
                              <button onClick={() => toggleFaturas(usina.id)} className="text-[#00A3E0] hover:underline text-xs font-bold flex items-center gap-1">
                                {expandedUcs[usina.id] ? 'Ocultar Faturas' : 'Ver Faturas da Usina'} <ChevronDown size={12} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Faturas da Usina (Aqui está o que você pediu!) */}
                    <TabelaFaturas ucId={usina.id} />

                    {/* Beneficiárias */}
                    <div className="p-6 bg-slate-50 border-t border-orange-100">
                      <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2"><Share2 size={16} /> Rateio de Créditos</h4>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {usina.beneficiarias?.map(ben => (
                          <div key={ben.id} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex items-center justify-between relative overflow-hidden group hover:border-[#00A3E0] transition-colors">
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-200 group-hover:bg-[#00A3E0] transition-colors"></div>
                            <div>
                              <div className="flex items-center gap-2"><span className="font-bold text-slate-700">UC {ben.codigo_uc}</span>{ben.nome_titular && <span className="text-xs text-slate-400 truncate max-w-[150px]">- {ben.nome_titular}</span>}</div>
                              <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{ben.endereco}</p>
                            </div>
                            <div className="text-right"><span className="block text-2xl font-bold text-slate-700">{ben.percentual_rateio}%</span><span className="text-[10px] text-slate-400 uppercase font-bold">do excedente</span></div>
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
          // MODO LISTA (Sem alterações)
          <>
            <header className="flex justify-between items-center mb-8"><h1 className="text-3xl font-bold text-slate-800">Visão Geral</h1><button onClick={fetchEmpresas} className="p-2 hover:bg-slate-200 rounded-full text-slate-600 transition"><RefreshCw size={20} /></button></header>
            <div className="bg-white p-6 rounded-xl shadow-sm mb-8 border border-slate-200">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-slate-700"><Plus className="text-[#00A3E0]" /> Nova Empresa</h2>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                <div className="md:col-span-4"><label className="text-xs font-bold text-slate-500 uppercase ml-1">Nome</label><input value={novoNome} className="w-full border p-2.5 rounded-lg mt-1" onChange={e => setNovoNome(e.target.value)} /></div>
                <div className="md:col-span-4"><label className="text-xs font-bold text-slate-500 uppercase ml-1">CPF</label><input value={novoCpf} className="w-full border p-2.5 rounded-lg mt-1" onChange={e => setNovoCpf(e.target.value)} /></div>
                <div className="md:col-span-2"><label className="text-xs font-bold text-slate-500 uppercase ml-1">Tel</label><input value={novoTel} className="w-full border p-2.5 rounded-lg mt-1" onChange={e => setNovoTel(e.target.value)} /></div>
                <div className="md:col-span-2"><button onClick={handleRegister} disabled={submitting} className="w-full bg-[#00A3E0] text-white px-4 py-2.5 rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">{submitting ? <><Loader2 size={18} className="animate-spin" /> Salvando...</> : 'Salvar'}</button></div>
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
                  <p className="text-sm text-slate-400 mt-1">Cadastre uma empresa acima para comecar</p>
                </div>
              ) : (
                empresas.map(emp => (
                  <div key={emp.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-lg transition-shadow duration-300 flex flex-col justify-between h-48">
                    <div><div className="flex justify-between items-start mb-2"><h3 className="font-bold text-lg text-slate-800 line-clamp-1" title={emp.nome_empresa}>{emp.nome_empresa}</h3><Plug size={20} className={emp.status_conexao === 'CONECTADO' ? "text-green-500" : "text-slate-300"} /></div><span className={`text-[10px] px-2 py-1 rounded-md font-bold uppercase tracking-wider inline-block ${emp.status_conexao === 'CONECTADO' ? 'bg-green-100 text-green-700' : emp.status_conexao === 'AGUARDANDO_SMS' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{emp.status_conexao}</span></div>
                    <div className="mt-4">{emp.status_conexao === 'CONECTADO' ? (<button onClick={() => abrirDetalhesEmpresa(emp)} className="w-full border border-[#00A3E0] text-[#00A3E0] py-2.5 rounded-lg hover:bg-blue-50 transition text-sm font-bold flex items-center justify-center gap-2"><FileText size={18} /> Gerenciar Faturas</button>) : (<button onClick={() => handleConnect(emp.id)} disabled={loading} className="w-full bg-slate-900 text-white py-2.5 rounded-lg hover:bg-slate-800 transition text-sm font-bold flex items-center justify-center gap-2">{loading ? <Loader2 className="animate-spin" size={18} /> : <Plug size={18} />} {loading ? "Conectando..." : "Conectar Energisa"}</button>)}</div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </main>

      {/* Modais de Detalhes e SMS (Mantidos) */}
      {faturaDetalhe && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-[#00A3E0] p-5 flex justify-between items-center text-white"><div><h3 className="font-bold text-lg">Fatura {faturaDetalhe.mes}/{faturaDetalhe.ano}</h3><p className="text-blue-100 text-xs font-mono mt-0.5">ID: {faturaDetalhe.numero_fatura}</p></div><button onClick={() => setFaturaDetalhe(null)} className="hover:bg-white/20 p-1 rounded-full"><X size={24} /></button></div>
            <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              <div className="text-center pb-4 border-b border-slate-100"><p className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-1">Valor Total</p><div className="text-4xl font-extrabold text-slate-800">R$ {faturaDetalhe.valor.toFixed(2)}</div><span className={`inline-block mt-2 px-3 py-1 rounded-full text-sm font-bold border ${getStatusColor(faturaDetalhe.status)}`}>{faturaDetalhe.status}</span></div>
              {faturaDetalhe.codigo_barras && <div className="bg-slate-50 p-4 rounded-xl border border-slate-200"><div className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2"><Barcode size={18} /> Código de Barras</div><p className="font-mono text-xs break-all text-slate-600 mb-3 bg-white p-2 rounded border border-slate-100 select-all">{faturaDetalhe.codigo_barras}</p><button onClick={() => copyToClipboard(faturaDetalhe.codigo_barras!)} className="w-full bg-white border border-slate-300 py-2.5 rounded-lg text-sm font-bold">Copiar</button></div>}
              {faturaDetalhe.pix_copia_cola && <div className="bg-green-50 p-4 rounded-xl border border-green-200"><div className="flex items-center gap-2 text-sm font-bold text-green-800 mb-2"><QrCode size={18} /> PIX</div><textarea readOnly className="w-full h-20 text-[10px] p-2 rounded border border-green-200 font-mono mb-2 bg-white/80 resize-none" value={faturaDetalhe.pix_copia_cola} /><button onClick={() => copyToClipboard(faturaDetalhe.pix_copia_cola!)} className="w-full bg-green-600 text-white py-2.5 rounded-lg text-sm font-bold">Copiar PIX</button></div>}
              <button onClick={() => handleDownloadPdf(faturaDetalhe.id)} disabled={downloadingId === faturaDetalhe.id} className="w-full flex items-center justify-center gap-2 text-[#00A3E0] font-bold py-3 hover:bg-slate-50 rounded-xl border border-transparent hover:border-slate-100">{downloadingId === faturaDetalhe.id ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />} {downloadingId === faturaDetalhe.id ? "Baixando..." : "Baixar PDF"}</button>
            </div>
          </div>
        </div>
      )}
      {smsModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 animate-fade-in">
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
            <button
              onClick={handleValidateSms}
              disabled={validatingSms || smsCode.length < 4}
              className="w-full bg-green-500 text-white py-3 rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:bg-green-600 transition"
            >
              {validatingSms ? <><Loader2 size={20} className="animate-spin" /> Validando...</> : 'Confirmar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;