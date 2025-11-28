import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../components/Toast';
import { api, UnidadeConsumidora, Fatura } from '../lib/api';
import axios from 'axios';
import {
  Zap, ArrowLeft, Loader2, CheckCircle2, AlertCircle, Shield,
  Home, MapPin, Calendar, DollarSign, TrendingDown, BarChart3,
  Download, Share2, ChevronRight
} from 'lucide-react';

// Gateway API para simulação pública
const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:3000';
const gatewayApi = axios.create({
  baseURL: GATEWAY_URL,
});

type SimulationStep = 'cpf' | 'sms' | 'select-uc' | 'report';

interface SimulationData {
  cpf: string;
  telefone?: string;
  sessionId?: string;
  ucs?: UnidadeConsumidora[];
  selectedUc?: UnidadeConsumidora;
  faturas?: Fatura[];
}

export function SimulationFlow() {
  const { isDark } = useTheme();
  const toast = useToast();
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState<SimulationStep>('cpf');
  const [simulationData, setSimulationData] = useState<SimulationData>({
    cpf: ''
  });

  // Step 1: CPF Input
  const [cpf, setCpf] = useState('');
  const [telefone, setTelefone] = useState('');
  const [loading, setLoading] = useState(false);

  // Step 2: SMS Code
  const [smsCode, setSmsCode] = useState('');
  const [validatingSms, setValidatingSms] = useState(false);

  // Step 3: UCs Selection
  const [selectedUcId, setSelectedUcId] = useState<number | null>(null);

  // Step 4: Report Data
  const [totalPago, setTotalPago] = useState(0);
  const [economiaEstimada, setEconomiaEstimada] = useState(0);

  // Format CPF
  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      return numbers
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    }
    return numbers.slice(0, 11);
  };

  // Format Phone
  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      return numbers
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d)/, '$1-$2');
    }
    return numbers.slice(0, 11);
  };

  // Step 1: Submit CPF and Phone
  const handleSubmitCpf = async () => {
    const cpfNumbers = cpf.replace(/\D/g, '');
    const telefoneNumbers = telefone.replace(/\D/g, '');

    if (cpfNumbers.length !== 11) {
      toast.error('CPF inválido. Digite um CPF válido.');
      return;
    }

    if (telefoneNumbers.length < 10) {
      toast.error('Telefone inválido. Digite um telefone válido.');
      return;
    }

    setLoading(true);
    try {
      // Call public API to start authentication process
      const response = await gatewayApi.post('/public/simulacao/iniciar', {
        cpf: cpfNumbers,
        telefone: telefoneNumbers
      });

      if (response.data.success) {
        setSimulationData({
          ...simulationData,
          cpf: cpfNumbers,
          telefone: telefoneNumbers,
          sessionId: response.data.sessionId
        });
        setCurrentStep('sms');
        toast.success('SMS enviado! Verifique seu celular.');
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao iniciar autenticação');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Validate SMS
  const handleValidateSms = async () => {
    if (smsCode.length < 4) {
      toast.error('Código inválido. Digite o código recebido por SMS.');
      return;
    }

    setValidatingSms(true);
    try {
      const response = await gatewayApi.post('/public/simulacao/validar-sms', {
        sessionId: simulationData.sessionId,
        codigo: smsCode
      });

      if (response.data.success) {
        // Fetch UCs from the authenticated session
        const ucsResponse = await gatewayApi.get(`/public/simulacao/ucs/${simulationData.sessionId}`);

        setSimulationData({
          ...simulationData,
          ucs: ucsResponse.data.ucs
        });
        setCurrentStep('select-uc');
        toast.success('Autenticação realizada com sucesso!');
      }
    } catch (error: any) {
      toast.error(error.message || 'Código SMS inválido');
    } finally {
      setValidatingSms(false);
    }
  };

  // Step 3: Select UC and Generate Report
  const handleSelectUc = async () => {
    if (!selectedUcId) {
      toast.error('Selecione uma unidade consumidora.');
      return;
    }

    const selectedUc = simulationData.ucs?.find((uc: any) => uc.numeroUc === selectedUcId);
    if (!selectedUc) return;

    setLoading(true);
    try {
      // Fetch faturas for the selected UC
      const faturasResponse = await gatewayApi.get(`/public/simulacao/faturas/${simulationData.sessionId}/${selectedUcId}`);

      const faturas = faturasResponse.data.faturas || [];

      // Log para debug
      console.log('Faturas recebidas:', faturas);
      if (faturas.length > 0) {
        console.log('Primeira fatura:', faturas[0]);
      }

      // Calculate total paid and estimated savings
      const total = faturas.reduce((sum: number, f: any) => {
        return sum + (f.valorFatura || 0);
      }, 0);
      const economia = total * 0.30; // 30% savings

      setTotalPago(total);
      setEconomiaEstimada(economia);
      setSimulationData({
        ...simulationData,
        selectedUc,
        faturas
      });
      setCurrentStep('report');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao gerar simulação');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (currentStep === 'sms') setCurrentStep('cpf');
    else if (currentStep === 'select-uc') setCurrentStep('sms');
    else if (currentStep === 'report') setCurrentStep('select-uc');
  };

  const handleBackToHome = () => {
    navigate('/');
  };

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900' : 'bg-gradient-to-br from-white via-slate-50 to-white'}`}>
      {/* Header */}
      <nav className={`sticky top-0 z-50 backdrop-blur-lg ${isDark ? 'bg-slate-900/80 border-slate-700' : 'bg-white/80 border-slate-200'} border-b`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={handleBackToHome}
              className="flex items-center gap-3 group"
            >
              <div className="inline-flex items-center justify-center w-10 h-10 bg-gradient-to-br from-[#00A3E0] to-blue-600 rounded-xl shadow-lg shadow-blue-500/30">
                <Zap className="text-white" size={24} />
              </div>
              <span className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Energia Compartilhada
              </span>
            </button>

            {currentStep !== 'cpf' && (
              <button
                onClick={handleBack}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  isDark
                    ? 'text-slate-300 hover:bg-slate-800'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <ArrowLeft size={20} />
                Voltar
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Progress Bar */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-2">
          {['CPF', 'SMS', 'UC', 'Resultado'].map((label, index) => {
            const stepIndex = ['cpf', 'sms', 'select-uc', 'report'].indexOf(currentStep);
            const isActive = index === stepIndex;
            const isCompleted = index < stepIndex;

            return (
              <div key={label} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                      isCompleted
                        ? 'bg-green-500 text-white'
                        : isActive
                        ? 'bg-[#00A3E0] text-white'
                        : isDark
                        ? 'bg-slate-700 text-slate-400'
                        : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {isCompleted ? <CheckCircle2 size={20} /> : index + 1}
                  </div>
                  <span className={`text-xs mt-2 ${
                    isActive
                      ? isDark ? 'text-white' : 'text-slate-900'
                      : isDark ? 'text-slate-500' : 'text-slate-400'
                  }`}>
                    {label}
                  </span>
                </div>
                {index < 3 && (
                  <div className={`h-1 flex-1 mx-2 rounded ${
                    isCompleted
                      ? 'bg-green-500'
                      : isDark ? 'bg-slate-700' : 'bg-slate-200'
                  }`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        {/* Step 1: CPF Input */}
        {currentStep === 'cpf' && (
          <div className={`p-8 rounded-2xl ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'} shadow-xl`}>
            <div className="text-center mb-8">
              <div className="inline-flex p-4 bg-gradient-to-br from-[#00A3E0]/20 to-blue-600/20 rounded-xl mb-4">
                <Shield className="text-[#00A3E0]" size={48} />
              </div>
              <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Descubra sua Economia
              </h2>
              <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                Informe seus dados para simular quanto você pode economizar
              </p>
            </div>

            <div className="space-y-6">
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  CPF do Titular
                </label>
                <input
                  type="text"
                  value={cpf}
                  onChange={(e) => setCpf(formatCPF(e.target.value))}
                  placeholder="000.000.000-00"
                  className={`w-full px-4 py-3 rounded-lg border text-lg ${
                    isDark
                      ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500'
                      : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                  } focus:ring-2 focus:ring-[#00A3E0] focus:border-transparent transition-all`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  Telefone (com DDD)
                </label>
                <input
                  type="text"
                  value={telefone}
                  onChange={(e) => setTelefone(formatPhone(e.target.value))}
                  placeholder="(00) 00000-0000"
                  className={`w-full px-4 py-3 rounded-lg border text-lg ${
                    isDark
                      ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500'
                      : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                  } focus:ring-2 focus:ring-[#00A3E0] focus:border-transparent transition-all`}
                />
                <p className={`text-xs mt-2 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                  Enviaremos um código de verificação por SMS
                </p>
              </div>

              <button
                onClick={handleSubmitCpf}
                disabled={loading}
                className="w-full px-6 py-4 bg-gradient-to-r from-[#00A3E0] to-blue-600 text-white rounded-xl font-semibold text-lg hover:shadow-lg hover:shadow-blue-500/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Enviando SMS...
                  </>
                ) : (
                  <>
                    Continuar
                    <ChevronRight size={20} />
                  </>
                )}
              </button>

              <div className={`p-4 rounded-lg ${isDark ? 'bg-slate-900/50' : 'bg-slate-50'} flex items-start gap-3`}>
                <Shield className={`${isDark ? 'text-green-400' : 'text-green-600'} mt-0.5`} size={20} />
                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Seus dados estão protegidos e serão usados apenas para gerar sua simulação de economia.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: SMS Validation */}
        {currentStep === 'sms' && (
          <div className={`p-8 rounded-2xl ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'} shadow-xl`}>
            <div className="text-center mb-8">
              <div className="inline-flex p-4 bg-gradient-to-br from-green-500/20 to-green-600/20 rounded-xl mb-4">
                <CheckCircle2 className="text-green-500" size={48} />
              </div>
              <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Verifique seu celular
              </h2>
              <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                Enviamos um código de verificação para {telefone}
              </p>
            </div>

            <div className="space-y-6">
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  Código SMS
                </label>
                <input
                  type="text"
                  value={smsCode}
                  onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className={`w-full px-4 py-3 rounded-lg border text-lg text-center tracking-widest font-mono ${
                    isDark
                      ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500'
                      : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                  } focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all`}
                  maxLength={6}
                  autoFocus
                />
              </div>

              <button
                onClick={handleValidateSms}
                disabled={validatingSms || smsCode.length < 4}
                className="w-full px-6 py-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-semibold text-lg hover:shadow-lg hover:shadow-green-500/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {validatingSms ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Validando...
                  </>
                ) : (
                  <>
                    Validar Código
                    <ChevronRight size={20} />
                  </>
                )}
              </button>

              <button
                onClick={handleSubmitCpf}
                disabled={loading}
                className={`w-full px-4 py-3 rounded-lg transition-colors ${
                  isDark
                    ? 'text-slate-400 hover:bg-slate-900'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                Não recebeu o código? Enviar novamente
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Select UC */}
        {currentStep === 'select-uc' && (
          <div className={`p-8 rounded-2xl ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'} shadow-xl`}>
            <div className="text-center mb-8">
              <div className="inline-flex p-4 bg-gradient-to-br from-purple-500/20 to-purple-600/20 rounded-xl mb-4">
                <Home className="text-purple-500" size={48} />
              </div>
              <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Selecione sua Unidade Consumidora
              </h2>
              <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                Escolha qual UC você deseja simular
              </p>
            </div>

            <div className="space-y-4 mb-6">
              {simulationData.ucs?.map((uc: any) => {
                const ucId = uc.numeroUc;
                const enderecoCompleto = `${uc.endereco}, ${uc.numeroImovel}${uc.complemento ? ' - ' + uc.complemento : ''} - ${uc.bairro}, ${uc.nomeMunicipio}/${uc.uf}`;
                const isUcAtiva = uc.ucAtiva === true && uc.contratoAtivo === true;

                return (
                  <button
                    key={ucId}
                    onClick={() => setSelectedUcId(ucId)}
                    disabled={!isUcAtiva}
                    className={`w-full p-6 rounded-xl border-2 text-left transition-all ${
                      !isUcAtiva
                        ? 'opacity-50 cursor-not-allowed border-slate-300'
                        : selectedUcId === ucId
                        ? 'border-[#00A3E0] bg-[#00A3E0]/10'
                        : isDark
                        ? 'border-slate-700 hover:border-slate-600 bg-slate-900'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <MapPin size={16} className={selectedUcId === ucId ? 'text-[#00A3E0]' : isDark ? 'text-slate-400' : 'text-slate-500'} />
                          <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            UC {ucId}-{uc.digitoVerificador}
                          </span>
                          {!isUcAtiva && (
                            <span className="px-2 py-1 bg-red-500/20 text-red-500 text-xs rounded-full">
                              Inativa
                            </span>
                          )}
                        </div>
                        <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                          {enderecoCompleto}
                        </p>
                        {uc.nomeTitular && (
                          <p className={`text-xs mt-2 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                            Titular: {uc.nomeTitular}
                          </p>
                        )}
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        selectedUcId === ucId
                          ? 'border-[#00A3E0] bg-[#00A3E0]'
                          : isDark
                          ? 'border-slate-600'
                          : 'border-slate-300'
                      }`}>
                        {selectedUcId === ucId && (
                          <CheckCircle2 size={14} className="text-white" />
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleSelectUc}
              disabled={!selectedUcId || loading}
              className="w-full px-6 py-4 bg-gradient-to-r from-[#00A3E0] to-blue-600 text-white rounded-xl font-semibold text-lg hover:shadow-lg hover:shadow-blue-500/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Gerando Simulação...
                </>
              ) : (
                <>
                  Gerar Simulação
                  <ChevronRight size={20} />
                </>
              )}
            </button>
          </div>
        )}

        {/* Step 4: Report */}
        {currentStep === 'report' && (
          <div className="space-y-6">
            {/* Summary Card */}
            <div className={`p-8 rounded-2xl ${isDark ? 'bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700' : 'bg-gradient-to-br from-white to-slate-50 border border-slate-200'} shadow-xl`}>
              <div className="text-center mb-8">
                <div className="inline-flex p-4 bg-gradient-to-br from-green-500/20 to-green-600/20 rounded-xl mb-4">
                  <TrendingDown className="text-green-500" size={48} />
                </div>
                <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Sua Simulação de Economia
                </h2>
                <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                  Veja quanto você poderia ter economizado nos últimos 12 meses
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6 mb-8">
                {/* Total Paid */}
                <div className={`p-6 rounded-xl ${isDark ? 'bg-slate-900/50 border border-slate-700' : 'bg-white border border-slate-200'}`}>
                  <div className="flex items-center gap-3 mb-2">
                    <DollarSign className={isDark ? 'text-slate-400' : 'text-slate-500'} size={24} />
                    <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Total Pago (12 meses)
                    </span>
                  </div>
                  <div className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {totalPago.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                </div>

                {/* Estimated Savings */}
                <div className={`p-6 rounded-xl bg-gradient-to-br from-green-500/10 to-green-600/10 border ${isDark ? 'border-green-500/30' : 'border-green-500/20'}`}>
                  <div className="flex items-center gap-3 mb-2">
                    <TrendingDown className="text-green-500" size={24} />
                    <span className="text-sm text-green-600 dark:text-green-400">
                      Economia Estimada (30%)
                    </span>
                  </div>
                  <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                    {economiaEstimada.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                </div>
              </div>

              {/* UC Info */}
              {simulationData.selectedUc && (() => {
                const uc = simulationData.selectedUc as any;
                const enderecoCompleto = `${uc.endereco}, ${uc.numeroImovel}${uc.complemento ? ' - ' + uc.complemento : ''} - ${uc.bairro}, ${uc.nomeMunicipio}/${uc.uf}`;

                return (
                  <div className={`p-6 rounded-xl ${isDark ? 'bg-slate-900/50 border border-slate-700' : 'bg-slate-50 border border-slate-200'} mb-6`}>
                    <div className="flex items-start gap-3">
                      <Home className={isDark ? 'text-slate-400' : 'text-slate-500'} size={20} />
                      <div className="flex-1">
                        <div className={`font-semibold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          UC {uc.numeroUc}-{uc.digitoVerificador}
                        </div>
                        <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                          {enderecoCompleto}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Monthly Breakdown */}
              <div className="space-y-3">
                <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'} flex items-center gap-2`}>
                  <BarChart3 size={20} />
                  Detalhamento Mensal
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {simulationData.faturas?.map((fatura: any, index: number) => {
                    const valor = fatura.valorFatura || 0;
                    const economiaFatura = valor * 0.30;
                    const valorComEconomia = valor - economiaFatura;
                    const mes = fatura.mesReferencia || 0;
                    const ano = fatura.anoReferencia || 0;

                    return (
                      <div
                        key={index}
                        className={`p-4 rounded-lg ${isDark ? 'bg-slate-900/50' : 'bg-slate-50'}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Calendar size={16} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
                            <span className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                              {mes ? String(mes).padStart(2, '0') : '??'}/{ano || '????'}
                            </span>
                          </div>
                          <div className="text-right">
                            <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'} line-through`}>
                              {valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </div>
                            <div className="text-sm font-semibold text-green-500">
                              {valorComEconomia.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className={isDark ? 'text-slate-500' : 'text-slate-500'}>
                            Economia de 30%
                          </span>
                          <span className="text-green-500 font-medium">
                            -{economiaFatura.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className={`p-8 rounded-2xl ${isDark ? 'bg-gradient-to-br from-[#00A3E0]/10 to-blue-600/10 border border-[#00A3E0]/30' : 'bg-gradient-to-br from-blue-50 to-green-50 border border-blue-200'} text-center`}>
              <h3 className={`text-2xl font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Gostou da simulação?
              </h3>
              <p className={`mb-6 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Entre em contato conosco e comece a economizar ainda este mês!
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button className="px-6 py-3 bg-gradient-to-r from-[#00A3E0] to-blue-600 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-blue-500/30 transition-all duration-300 flex items-center justify-center gap-2">
                  <Share2 size={20} />
                  Entrar em Contato
                </button>
                <button className={`px-6 py-3 rounded-xl font-semibold border-2 transition-all ${
                  isDark
                    ? 'border-slate-700 text-white hover:bg-slate-800'
                    : 'border-slate-300 text-slate-900 hover:bg-slate-50'
                } flex items-center justify-center gap-2`}>
                  <Download size={20} />
                  Baixar Relatório
                </button>
              </div>
            </div>

            <button
              onClick={handleBackToHome}
              className={`w-full px-4 py-3 rounded-lg transition-colors ${
                isDark
                  ? 'text-slate-400 hover:bg-slate-800'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              Voltar ao Início
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
