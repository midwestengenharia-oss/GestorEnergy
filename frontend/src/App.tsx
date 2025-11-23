import { useState, useEffect } from 'react';
import { api, Empresa, UnidadeConsumidora, Fatura } from './lib/api';
import {
  Activity, Plug, Plus, RefreshCw, ArrowLeft, Home, FileText, Download, Loader2, Sun, BatteryCharging, ChevronDown, ChevronUp, Barcode, QrCode, X, Share2
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
  // --- ESTADOS ---
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(false);

  // Navegação e Abas
  const [vendoEmpresa, setVendoEmpresa] = useState<Empresa | null>(null);
  const [abaAtiva, setAbaAtiva] = useState<'geral' | 'usinas'>('geral');

  // Dados da Empresa Selecionada
  const [ucsDoCliente, setUcsDoCliente] = useState<UnidadeConsumidora[]>([]);
  const [usinasDoCliente, setUsinasDoCliente] = useState<UnidadeConsumidora[]>([]); // Dados da árvore

  // Cache e Controle Visual
  const [faturasPorUc, setFaturasPorUc] = useState<Record<number, Fatura[]>>({});
  const [expandedUcs, setExpandedUcs] = useState<Record<number, boolean>>({}); // Controle do botão Ocultar/Ver
  const [loadingUcs, setLoadingUcs] = useState<Record<number, boolean>>({});

  // Modais
  const [faturaDetalhe, setFaturaDetalhe] = useState<Fatura | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [smsModalOpen, setSmsModalOpen] = useState(false);

  // Inputs
  const [novoNome, setNovoNome] = useState("");
  const [novoCpf, setNovoCpf] = useState("");
  const [novoTel, setNovoTel] = useState("");
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<number | null>(null);
  const [smsCode, setSmsCode] = useState("");

  // --- EFEITOS ---
  useEffect(() => { fetchEmpresas(); }, []);

  // --- API ---
  const fetchEmpresas = async () => {
    try {
      const res = await api.get('/empresas');
      setEmpresas(res.data);
    } catch (e) { console.error("Erro ao buscar empresas", e); }
  };

  const abrirDetalhesEmpresa = async (empresa: Empresa) => {
    setVendoEmpresa(empresa);
    setAbaAtiva('geral'); // Reseta para a primeira aba
    // Limpa estados anteriores
    setUcsDoCliente([]);
    setFaturasPorUc({});
    setExpandedUcs({});

    try {
      const res = await api.get(`/empresas/${empresa.id}/ucs`);
      setUcsDoCliente(res.data);
    } catch (e) { alert("Erro ao carregar UCs"); }
  };

  const carregarUsinas = async () => {
    if (!vendoEmpresa) return;
    setAbaAtiva('usinas');
    try {
      const res = await api.get(`/empresas/${vendoEmpresa.id}/usinas`);
      setUsinasDoCliente(res.data);
    } catch (e) { alert("Erro ao carregar usinas"); }
  };

  // Lógica de Toggle (Abrir/Fechar sanfona)
  const toggleFaturas = async (ucId: number) => {
    // 1. Se já estiver aberto, fecha
    if (expandedUcs[ucId]) {
      setExpandedUcs(prev => ({ ...prev, [ucId]: false }));
      return;
    }

    // 2. Se não tem dados em cache, baixa da API
    if (!faturasPorUc[ucId]) {
      setLoadingUcs(prev => ({ ...prev, [ucId]: true }));
      try {
        const res = await api.get(`/ucs/${ucId}/faturas`);
        setFaturasPorUc(prev => ({ ...prev, [ucId]: res.data }));
      } catch (e) {
        alert("Erro ao baixar faturas");
        return;
      } finally {
        setLoadingUcs(prev => ({ ...prev, [ucId]: false }));
      }
    }

    // 3. Abre a sanfona
    setExpandedUcs(prev => ({ ...prev, [ucId]: true }));
  };

  const handleDownloadPdf = async (faturaId: number) => {
    setDownloadingId(faturaId);
    try {
      const res = await api.get(`/faturas/${faturaId}/download`);
      if (res.data.file_base64) {
        downloadBase64File(res.data.file_base64, res.data.filename);
      } else {
        alert("Arquivo vazio.");
      }
    } catch (e) { alert("Erro ao baixar PDF."); }
    finally { setDownloadingId(null); }
  };

  // --- CADASTRO E CONEXÃO ---
  const handleRegister = async () => {
    if (!novoNome || !novoCpf || !novoTel) return alert("Preencha tudo!");
    try {
      await api.post('/empresas/novo', null, { params: { nome: novoNome, cpf: novoCpf, telefone_final: novoTel } });
      setNovoNome(""); setNovoCpf(""); setNovoTel("");
      alert("Cadastrado!"); fetchEmpresas();
    } catch (e) { alert("Erro ao criar"); }
  };

  const handleConnect = async (id: number) => {
    setLoading(true);
    try {
      await api.post(`/empresas/${id}/conectar`);
      setSelectedEmpresaId(id); setSmsModalOpen(true);
    } catch (e) { alert("Erro ao conectar."); } finally { setLoading(false); }
  };

  const handleValidateSms = async () => {
    if (!selectedEmpresaId) return;
    try {
      await api.post(`/empresas/${selectedEmpresaId}/validar-sms`, null, { params: { codigo_sms: smsCode } });
      alert("Conectado! Sincronizando...");
      setSmsModalOpen(false); fetchEmpresas();
    } catch (e) { alert("Erro SMS"); }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Copiado!");
  };

  const getStatusColor = (status: string) => {
    const s = status?.toLowerCase() || '';
    if (s.includes('fora do prazo') || s.includes('pendente') || s.includes('atrasado')) {
      return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    }
    if (s.includes('pago')) {
      return 'bg-green-50 text-green-700 border-green-200';
    }
    return 'bg-slate-50 text-slate-700 border-slate-200';
  };

  return (
    <div className="min-h-screen flex bg-slate-100 font-sans text-slate-900">
      {/* SIDEBAR */}
      <aside className="w-64 bg-[#0f172a] text-white p-6 hidden md:block fixed h-full">
        <div className="text-2xl font-bold text-[#00A3E0] mb-10 flex items-center gap-2">⚡ GestorEnergy</div>
        <nav className="space-y-4">
          <button onClick={() => setVendoEmpresa(null)} className="flex w-full items-center gap-3 text-slate-300 hover:text-white transition px-2 py-2 rounded hover:bg-slate-800">
            <Activity size={20} /> Dashboard Geral
          </button>
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-8 ml-0 md:ml-64 overflow-auto">

        {vendoEmpresa ? (

          /* ================= MODO DETALHES ================= */
          <div className="animate-fade-in">
            <button onClick={() => setVendoEmpresa(null)} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 mb-6 font-medium">
              <ArrowLeft size={20} /> Voltar
            </button>

            <header className="mb-8 flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-slate-800">{vendoEmpresa.nome_empresa}</h1>
                <p className="text-slate-500">Painel de Controle</p>
              </div>

              {/* MENU DE ABAS */}
              <div className="flex bg-white rounded-lg p-1 shadow-sm border border-slate-200">
                <button
                  onClick={() => setAbaAtiva('geral')}
                  className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition ${abaAtiva === 'geral' ? 'bg-[#00A3E0] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  <FileText size={16} /> Faturas
                </button>
                <button
                  onClick={carregarUsinas}
                  className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition ${abaAtiva === 'usinas' ? 'bg-[#00A3E0] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  <Sun size={16} /> Gestão Usinas
                </button>
              </div>
            </header>

            {/* ABA 1: GERAL (FATURAS) */}
            {abaAtiva === 'geral' && (
              <div className="space-y-6">
                {ucsDoCliente.map(uc => (
                  <div key={uc.id} className={`bg-white rounded-xl shadow-sm border overflow-hidden transition-all duration-300 ${uc.is_geradora ? 'border-orange-200 ring-1 ring-orange-100' : 'border-slate-200'}`}>
                    {/* Header UC */}
                    <div className={`p-5 flex flex-wrap justify-between items-center gap-4 ${uc.is_geradora ? 'bg-orange-50/50' : 'bg-slate-50/50'}`}>
                      <div>
                        <h3 className="font-bold text-lg flex items-center gap-2 text-slate-800">
                          {uc.is_geradora ? <Sun className="text-orange-500 fill-orange-500" size={24} /> : <Home className="text-slate-400" size={20} />}
                          UC: {uc.codigo_uc}
                          {uc.is_geradora && <span className="bg-orange-100 text-orange-700 text-[10px] px-2 py-0.5 rounded-full font-extrabold tracking-wide border border-orange-200">USINA SOLAR</span>}
                        </h3>
                        <p className="text-slate-500 text-sm ml-8">{uc.endereco}</p>
                      </div>
                      <div className="flex items-center gap-6">
                        {uc.is_geradora && <div className="flex items-center gap-1 text-orange-600 font-bold mr-4"><BatteryCharging size={18} /> {uc.saldo_acumulado} kWh</div>}
                        <button onClick={() => toggleFaturas(uc.id)} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:border-slate-400 transition text-sm font-medium shadow-sm active:scale-95">
                          {expandedUcs[uc.id] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          {expandedUcs[uc.id] ? 'Ocultar' : 'Ver Faturas'}
                        </button>
                      </div>
                    </div>

                    {/* Lista Faturas */}
                    {loadingUcs[uc.id] && <div className="p-8 text-center text-slate-500 bg-slate-50/30 border-t border-slate-100"><Loader2 className="animate-spin mx-auto mb-2 text-[#00A3E0]" size={24} /><p className="text-sm">Buscando faturas...</p></div>}

                    {expandedUcs[uc.id] && faturasPorUc[uc.id] && (
                      <div className="border-t border-slate-100 animate-fade-in-down">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                            <tr><th className="p-3 pl-6">Mês/Ano</th><th className="p-3">Vencimento</th><th className="p-3">Valor</th><th className="p-3">Status</th><th className="p-3 text-right pr-6">Ações</th></tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {faturasPorUc[uc.id].map(fat => (
                              <tr key={fat.id} className="hover:bg-slate-50 transition-colors group">
                                <td className="p-3 pl-6 font-medium text-slate-700">{fat.mes}/{fat.ano}</td>
                                <td className="p-3 text-slate-600">{fat.vencimento || '-'}</td>
                                <td className="p-3 font-bold text-slate-800">R$ {fat.valor.toFixed(2)}</td>
                                <td className="p-3">
                                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusColor(fat.status)}`}>{fat.status}</span>
                                </td>
                                <td className="p-3 pr-6 flex justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => setFaturaDetalhe(fat)} className="text-slate-600 hover:text-[#00A3E0] hover:bg-blue-50 border border-slate-200 hover:border-blue-200 px-3 py-1.5 rounded-md flex items-center gap-1.5 text-xs font-medium transition-all"><FileText size={14} /> Detalhes</button>
                                  <button onClick={() => handleDownloadPdf(fat.id)} disabled={downloadingId === fat.id} className="text-[#00A3E0] hover:text-blue-700 hover:bg-blue-50 px-2 py-1.5 rounded-md transition-colors flex items-center gap-1" title="Baixar PDF">
                                    {downloadingId === fat.id ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                                  </button>
                                </td>
                              </tr>
                            ))}
                            {faturasPorUc[uc.id].length === 0 && <tr><td colSpan={5} className="p-6 text-center text-slate-400 italic">Nenhuma fatura encontrada.</td></tr>}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* ABA 2: USINAS (ÁRVORE) */}
            {abaAtiva === 'usinas' && (
              <div className="space-y-8">
                {usinasDoCliente.length === 0 && <div className="text-center p-10 bg-white rounded-xl text-slate-500 border border-dashed border-slate-300">Nenhuma usina identificada para este cliente.</div>}

                {usinasDoCliente.map(usina => (
                  <div key={usina.id} className="bg-white rounded-xl shadow-md border border-orange-100 overflow-hidden">
                    <div className="bg-gradient-to-r from-orange-50 to-white p-6 border-b border-orange-100">
                      <div className="flex justify-between items-start">
                        <div className="flex gap-4">
                          <div className="bg-orange-100 p-3 rounded-full h-14 w-14 flex items-center justify-center shadow-sm">
                            <Sun className="text-orange-500" size={32} />
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-slate-800">Usina {usina.codigo_uc}</h3>
                            <p className="text-slate-500 text-sm flex items-center gap-1"><Home size={14} /> {usina.endereco}</p>
                            <div className="mt-3 flex gap-3">
                              <div className="bg-white px-3 py-1 rounded border border-orange-200 text-xs font-bold text-orange-700 flex items-center gap-1">
                                <BatteryCharging size={14} /> Saldo: {usina.saldo_acumulado} kWh
                              </div>
                              <div className="bg-white px-3 py-1 rounded border border-slate-200 text-xs font-bold text-slate-600">
                                {usina.beneficiarias?.length || 0} Beneficiárias
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="p-6 bg-slate-50">
                      <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2"><Share2 size={16} /> Rateio de Créditos</h4>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {usina.beneficiarias?.map(ben => (
                          <div key={ben.id} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex items-center justify-between relative overflow-hidden group hover:border-[#00A3E0] transition-colors">
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-200 group-hover:bg-[#00A3E0] transition-colors"></div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-700">UC {ben.codigo_uc}</span>
                                {ben.nome_titular && <span className="text-xs text-slate-400 truncate max-w-[150px]">- {ben.nome_titular}</span>}
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{ben.endereco}</p>
                            </div>
                            <div className="text-right">
                              <span className="block text-2xl font-bold text-slate-700">{ben.percentual_rateio}%</span>
                              <span className="text-[10px] text-slate-400 uppercase font-bold">do excedente</span>
                            </div>
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

          /* ================= MODO LISTA ================= */
          <>
            <header className="flex justify-between items-center mb-8">
              <h1 className="text-3xl font-bold text-slate-800">Visão Geral</h1>
              <button onClick={fetchEmpresas} className="p-2 hover:bg-slate-200 rounded-full text-slate-600 transition"><RefreshCw size={20} /></button>
            </header>

            <div className="bg-white p-6 rounded-xl shadow-sm mb-8 border border-slate-200">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-slate-700"><Plus className="text-[#00A3E0]" /> Nova Empresa</h2>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                <div className="md:col-span-4">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Nome da Empresa</label>
                  <input value={novoNome} placeholder="Ex: Padaria do João" className="w-full border p-2.5 rounded-lg mt-1 focus:ring-2 focus:ring-[#00A3E0] focus:border-transparent outline-none transition" onChange={e => setNovoNome(e.target.value)} />
                </div>
                <div className="md:col-span-4">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">CPF (Responsável)</label>
                  <input value={novoCpf} placeholder="000.000.000-00" className="w-full border p-2.5 rounded-lg mt-1 focus:ring-2 focus:ring-[#00A3E0] focus:border-transparent outline-none transition" onChange={e => setNovoCpf(e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Final Tel</label>
                  <input value={novoTel} placeholder="Ex: 1234" className="w-full border p-2.5 rounded-lg mt-1 focus:ring-2 focus:ring-[#00A3E0] focus:border-transparent outline-none transition" onChange={e => setNovoTel(e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <button onClick={handleRegister} className="w-full bg-[#00A3E0] text-white px-4 py-2.5 rounded-lg font-bold hover:bg-blue-500 transition shadow-sm active:transform active:scale-95">Salvar</button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {empresas.map(emp => (
                <div key={emp.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-lg transition-shadow duration-300 flex flex-col justify-between h-48">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-lg text-slate-800 line-clamp-1" title={emp.nome_empresa}>{emp.nome_empresa}</h3>
                      <Plug size={20} className={emp.status_conexao === 'CONECTADO' ? "text-green-500" : "text-slate-300"} />
                    </div>
                    <span className={`text-[10px] px-2 py-1 rounded-md font-bold uppercase tracking-wider inline-block ${emp.status_conexao === 'CONECTADO' ? 'bg-green-100 text-green-700' : emp.status_conexao === 'AGUARDANDO_SMS' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                      {emp.status_conexao}
                    </span>
                  </div>
                  <div className="mt-4">
                    {emp.status_conexao === 'CONECTADO' ? (
                      <button onClick={() => abrirDetalhesEmpresa(emp)} className="w-full border border-[#00A3E0] text-[#00A3E0] py-2.5 rounded-lg hover:bg-blue-50 transition text-sm font-bold flex items-center justify-center gap-2"><FileText size={18} /> Gerenciar Faturas</button>
                    ) : (
                      <button onClick={() => handleConnect(emp.id)} disabled={loading} className="w-full bg-slate-900 text-white py-2.5 rounded-lg hover:bg-slate-800 transition text-sm font-bold flex items-center justify-center gap-2">{loading ? <Loader2 className="animate-spin" size={18} /> : <Plug size={18} />} {loading ? "Conectando..." : "Conectar Energisa"}</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      {/* MODAL FATURA */}
      {faturaDetalhe && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden transform transition-all scale-100">
            <div className="bg-[#00A3E0] p-5 flex justify-between items-center text-white shadow-md">
              <div><h3 className="font-bold text-lg">Fatura {faturaDetalhe.mes}/{faturaDetalhe.ano}</h3><p className="text-blue-100 text-xs font-mono mt-0.5">ID: {faturaDetalhe.numero_fatura}</p></div>
              <button onClick={() => setFaturaDetalhe(null)} className="hover:bg-white/20 p-1 rounded-full transition"><X size={24} /></button>
            </div>
            <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              <div className="text-center pb-4 border-b border-slate-100">
                <p className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-1">Valor Total</p>
                <div className="text-4xl font-extrabold text-slate-800">R$ {faturaDetalhe.valor.toFixed(2)}</div>
                <span className={`inline-block mt-2 px-3 py-1 rounded-full text-sm font-bold border ${getStatusColor(faturaDetalhe.status)}`}>{faturaDetalhe.status}</span>
                <div className="mt-3 flex justify-center gap-3 text-sm">
                  <div className="flex flex-col items-center"><span className="text-slate-400 text-xs">Vencimento</span><span className="font-bold text-slate-700">{faturaDetalhe.vencimento || '-'}</span></div>
                  <div className="w-px bg-slate-200 h-8"></div>
                  <div className="flex flex-col items-center"><span className="text-slate-400 text-xs">Consumo</span><span className="font-bold text-slate-700">{faturaDetalhe.consumo_kwh || 0} kWh</span></div>
                </div>
              </div>
              {faturaDetalhe.codigo_barras ? (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors group">
                  <div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2 text-sm font-bold text-slate-700"><Barcode size={18} className="text-slate-400" /> Código de Barras</div><span className="text-[10px] text-slate-400 font-medium bg-white px-2 py-0.5 rounded border border-slate-100">BOLETO</span></div>
                  <p className="font-mono text-xs break-all text-slate-600 mb-3 bg-white p-2 rounded border border-slate-100 select-all">{faturaDetalhe.codigo_barras}</p>
                  <button onClick={() => copyToClipboard(faturaDetalhe.codigo_barras!)} className="w-full bg-white border border-slate-300 py-2.5 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition shadow-sm">Copiar Código</button>
                </div>
              ) : (<div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-400">Código de barras não disponível</div>)}
              {faturaDetalhe.pix_copia_cola ? (
                <div className="bg-green-50 p-4 rounded-xl border border-green-200 hover:border-green-300 transition-colors">
                  <div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2 text-sm font-bold text-green-800"><QrCode size={18} /> PIX Copia e Cola</div><span className="text-[10px] text-green-600 font-medium bg-white px-2 py-0.5 rounded border border-green-100">RÁPIDO</span></div>
                  <textarea readOnly className="w-full h-20 text-[10px] p-2 rounded border border-green-200 font-mono mb-2 bg-white/80 resize-none focus:outline-none focus:ring-1 focus:ring-green-500 text-slate-600" value={faturaDetalhe.pix_copia_cola} />
                  <button onClick={() => copyToClipboard(faturaDetalhe.pix_copia_cola!)} className="w-full bg-green-600 text-white py-2.5 rounded-lg text-sm font-bold hover:bg-green-700 transition shadow-sm flex items-center justify-center gap-2"><QrCode size={16} /> Copiar Chave PIX</button>
                </div>
              ) : (<div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-400">PIX não disponível</div>)}
              <button onClick={() => handleDownloadPdf(faturaDetalhe.id)} disabled={downloadingId === faturaDetalhe.id} className="w-full flex items-center justify-center gap-2 text-[#00A3E0] font-bold py-3 hover:bg-slate-50 rounded-xl transition border border-transparent hover:border-slate-100">
                {downloadingId === faturaDetalhe.id ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />}
                {downloadingId === faturaDetalhe.id ? "Baixando..." : "Baixar PDF Original"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SMS */}
      {smsModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-2xl w-full max-w-sm shadow-2xl">
            <h2 className="text-2xl font-bold mb-2 text-center text-slate-800">Validação SMS</h2>
            <p className="text-center text-slate-500 mb-6 text-sm">Digite o código que enviamos para o celular cadastrado.</p>
            <input className="w-full text-center text-4xl tracking-[0.5em] font-mono border-2 border-slate-200 rounded-xl p-4 mb-6 focus:border-[#00A3E0] outline-none transition" maxLength={6} placeholder="0000" onChange={e => setSmsCode(e.target.value)} />
            <button onClick={handleValidateSms} className="w-full bg-green-500 text-white py-3.5 rounded-xl font-bold hover:bg-green-600 transition shadow-lg shadow-green-200">Confirmar Acesso</button>
            <button onClick={() => setSmsModalOpen(false)} className="w-full text-slate-400 text-sm mt-4 hover:text-slate-600">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;