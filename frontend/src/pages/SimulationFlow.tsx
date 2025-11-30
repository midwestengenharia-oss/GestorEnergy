import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../components/Toast';
import { api, UnidadeConsumidora, Fatura } from '../lib/api';
import axios from 'axios';
import {
  Zap, ArrowLeft, Loader2, CheckCircle2, AlertCircle, Shield,
  Home, MapPin, Calendar, DollarSign, TrendingDown, BarChart3,
  Download, Share2, ChevronRight, MessageSquare, Phone, Sun
} from 'lucide-react';

// Logo Component inline
function MidwestLogo({ className = "h-10", variant = 'color' }: { className?: string; variant?: 'color' | 'white' | 'black' }) {
  if (variant === 'white') {
    return (
      <svg className={className} viewBox="0 0 200 60" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g fill="white">
          <path d="M10 20 L15 15 L25 15 L25 40 L15 45 L10 40 Z" />
          <path d="M20 20 L25 15 L35 15 L35 40 L25 45 L20 40 Z" opacity="0.9" />
          <path d="M30 20 L35 15 L45 15 L45 40 L35 45 L30 40 Z" opacity="0.8" />
          <text x="55" y="36" fontFamily="Arial, sans-serif" fontSize="26" fontWeight="bold" letterSpacing="-1">
            Midwest
          </text>
        </g>
      </svg>
    );
  }

  if (variant === 'black') {
    return (
      <svg className={className} viewBox="0 0 200 60" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g fill="#282828">
          <path d="M10 20 L15 15 L25 15 L25 40 L15 45 L10 40 Z" />
          <path d="M20 20 L25 15 L35 15 L35 40 L25 45 L20 40 Z" opacity="0.9" />
          <path d="M30 20 L35 15 L45 15 L45 40 L35 45 L30 40 Z" opacity="0.8" />
          <text x="55" y="36" fontFamily="Arial, sans-serif" fontSize="26" fontWeight="bold" letterSpacing="-1">
            Midwest
          </text>
        </g>
      </svg>
    );
  }

  return (
    <svg className={className} viewBox="0 0 200 60" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="goldGradientSim" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFD700" />
          <stop offset="50%" stopColor="#FFA500" />
          <stop offset="100%" stopColor="#F18A26" />
        </linearGradient>
      </defs>
      <path d="M10 20 L15 15 L25 15 L25 40 L15 45 L10 40 Z" fill="url(#goldGradientSim)" />
      <path d="M20 20 L25 15 L35 15 L35 40 L25 45 L20 40 Z" fill="url(#goldGradientSim)" opacity="0.9" />
      <path d="M30 20 L35 15 L45 15 L45 40 L35 45 L30 40 Z" fill="url(#goldGradientSim)" opacity="0.8" />
      <text x="55" y="36" fill="#282828" fontFamily="Arial, sans-serif" fontSize="26" fontWeight="bold" letterSpacing="-1">
        Midwest
      </text>
    </svg>
  );
}

// Gateway API para simulação pública
const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:3000';
const gatewayApi = axios.create({
  baseURL: GATEWAY_URL,
});

type SimulationStep = 'cpf' | 'phone-select' | 'sms' | 'select-uc' | 'report';

interface PhoneOption {
  codigoEmpresaWeb: number;
  cdc: number;
  digitoVerificador: number;
  posicao: number;
  celular: string;
}

interface SimulationData {
  cpf: string;
  telefone?: string;
  transactionId?: string;
  sessionId?: string;
  listaTelefone?: PhoneOption[];
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
  const [loading, setLoading] = useState(false);

  // Step 2: Phone Selection
  const [selectedPhone, setSelectedPhone] = useState<PhoneOption | null>(null);

  // Step 3: SMS Code
  const [smsCode, setSmsCode] = useState('');
  const [validatingSms, setValidatingSms] = useState(false);

  // Step 4: UCs Selection
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

  // Step 1: Submit CPF (get phone list)
  const handleSubmitCpf = async () => {
    const cpfNumbers = cpf.replace(/\D/g, '');

    if (cpfNumbers.length !== 11) {
      toast.error('CPF inválido. Digite um CPF válido.');
      return;
    }

    setLoading(true);
    try {
      // Call public simulation API to get available phones
      const response = await gatewayApi.post('/public/simulacao/iniciar', {
        cpf: cpfNumbers
      });

      if (response.data.transaction_id && response.data.listaTelefone) {
        setSimulationData({
          ...simulationData,
          cpf: cpfNumbers,
          transactionId: response.data.transaction_id,
          listaTelefone: response.data.listaTelefone
        });
        setCurrentStep('phone-select');
        toast.success('CPF encontrado! Selecione o telefone para receber o SMS.');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'CPF não encontrado ou erro ao buscar telefones');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Select Phone and Send SMS
  const handleSelectPhone = async () => {
    if (!selectedPhone) {
      toast.error('Selecione um telefone.');
      return;
    }

    setLoading(true);
    try {
      // Send SMS to selected phone - enviamos o número do celular
      const response = await gatewayApi.post('/public/simulacao/enviar-sms', {
        transactionId: simulationData.transactionId,
        telefone: selectedPhone.celular
      });

      if (response.data.success) {
        setSimulationData({
          ...simulationData,
          telefone: selectedPhone.celular,
          sessionId: simulationData.transactionId
        });
        setCurrentStep('sms');
        toast.success(`SMS enviado para ${selectedPhone.celular}!`);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Erro ao enviar SMS');
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
    if (currentStep === 'phone-select') setCurrentStep('cpf');
    else if (currentStep === 'sms') setCurrentStep('phone-select');
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
              <MidwestLogo variant={isDark ? 'white' : 'black'} className="h-10 w-auto" />
            </button>

            {currentStep !== 'cpf' && (
              <button
                onClick={handleBack}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${isDark
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
          {['CPF', 'Telefone', 'SMS', 'UC', 'Resultado'].map((label, index) => {
            const stepIndex = ['cpf', 'phone-select', 'sms', 'select-uc', 'report'].indexOf(currentStep);
            const isActive = index === stepIndex;
            const isCompleted = index < stepIndex;

            return (
              <div key={label} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${isCompleted
                      ? 'bg-[#10B981] text-white'
                      : isActive
                        ? 'bg-[#FFD700] text-slate-900'
                        : isDark
                          ? 'bg-slate-700 text-slate-400'
                          : 'bg-slate-200 text-slate-500'
                      }`}
                  >
                    {isCompleted ? <CheckCircle2 size={20} /> : index + 1}
                  </div>
                  <span className={`text-xs mt-2 ${isActive
                    ? isDark ? 'text-white' : 'text-slate-900'
                    : isDark ? 'text-slate-500' : 'text-slate-400'
                    }`}>
                    {label}
                  </span>
                </div>
                {index < 4 && (
                  <div className={`h-1 flex-1 mx-2 rounded ${isCompleted
                    ? 'bg-[#10B981]'
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
              <div className="inline-flex p-4 bg-gradient-to-br from-[#FFD700]/20 to-[#FFA500]/20 rounded-xl mb-4">
                <Sun className="text-[#FFD700]" size={48} />
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
                  CPF do Titular da Conta
                </label>
                <input
                  type="text"
                  value={cpf}
                  onChange={(e) => setCpf(formatCPF(e.target.value))}
                  placeholder="000.000.000-00"
                  className={`w-full px-4 py-3 rounded-lg border text-lg ${isDark
                    ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500'
                    : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                    } focus:ring-2 focus:ring-[#FFD700] focus:border-transparent transition-all`}
                  autoFocus
                />
              </div>

              <button
                onClick={handleSubmitCpf}
                disabled={loading}
                className="w-full px-6 py-4 bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-slate-900 rounded-xl font-bold text-lg hover:shadow-lg hover:shadow-yellow-500/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Buscando dados...
                  </>
                ) : (
                  <>
                    Continuar
                    <ChevronRight size={20} />
                  </>
                )}
              </button>

              <div className={`p-4 rounded-lg ${isDark ? 'bg-slate-900/50' : 'bg-[#FFD700]/5'} flex items-start gap-3`}>
                <Shield className="text-[#10B981] mt-0.5" size={20} />
                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Seus dados estão protegidos e serão usados apenas para gerar sua simulação de economia.
                  Processo 100% seguro via Energisa.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Phone Selection */}
        {currentStep === 'phone-select' && (
          <div className={`p-8 rounded-2xl ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'} shadow-xl`}>
            <div className="text-center mb-8">
              <div className="inline-flex p-4 bg-gradient-to-br from-[#1E3A8A]/20 to-[#2563EB]/20 rounded-xl mb-4">
                <Phone className="text-[#1E3A8A]" size={48} />
              </div>
              <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Selecione um telefone
              </h2>
              <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                Encontramos os seguintes telefones cadastrados na Energisa
              </p>
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                {simulationData.listaTelefone?.map((phone) => (
                  <button
                    key={`${phone.cdc}-${phone.digitoVerificador}-${phone.posicao}`}
                    onClick={() => setSelectedPhone(phone)}
                    className={`w-full p-4 rounded-lg border-2 text-left transition-all ${selectedPhone?.cdc === phone.cdc && selectedPhone?.posicao === phone.posicao
                      ? 'border-[#FFD700] bg-[#FFD700]/10'
                      : isDark
                        ? 'border-slate-700 hover:border-slate-600 bg-slate-900'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {phone.celular}
                        </div>
                        <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                          UC: {phone.cdc}-{phone.digitoVerificador}
                        </div>
                      </div>
                      {selectedPhone?.cdc === phone.cdc && selectedPhone?.posicao === phone.posicao && (
                        <CheckCircle2 className="text-[#FFD700]" size={24} />
                      )}
                    </div>
                  </button>
                ))}
              </div>

              <button
                onClick={handleSelectPhone}
                disabled={!selectedPhone || loading}
                className="w-full px-6 py-4 bg-gradient-to-r from-[#1E3A8A] to-[#2563EB] text-white rounded-xl font-bold text-lg hover:shadow-lg hover:shadow-blue-500/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Enviando SMS...
                  </>
                ) : (
                  <>
                    Enviar SMS
                    <ChevronRight size={20} />
                  </>
                )}
              </button>

              <p className={`text-xs text-center ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                Vamos enviar um código de verificação para confirmar sua identidade
              </p>
            </div>
          </div>
        )}

        {/* Step 3: SMS Validation */}
        {currentStep === 'sms' && (
          <div className={`p-8 rounded-2xl ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'} shadow-xl`}>
            <div className="text-center mb-8">
              <div className="inline-flex p-4 bg-gradient-to-br from-[#10B981]/20 to-[#059669]/20 rounded-xl mb-4">
                <MessageSquare className="text-[#10B981]" size={48} />
              </div>
              <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Verifique seu celular
              </h2>
              <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                Enviamos um código de verificação para {simulationData.telefone || 'seu celular'}
              </p>
            </div>

            <div className="space-y-6">
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  Digite o código SMS
                </label>
                <input
                  type="text"
                  value={smsCode}
                  onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className={`w-full px-4 py-3 rounded-lg border text-lg text-center tracking-widest font-mono ${isDark
                    ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500'
                    : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                    } focus:ring-2 focus:ring-[#10B981] focus:border-transparent transition-all`}
                  maxLength={6}
                  autoFocus
                />
              </div>

              <button
                onClick={handleValidateSms}
                disabled={validatingSms || smsCode.length < 4}
                className="w-full px-6 py-4 bg-gradient-to-r from-[#10B981] to-[#059669] text-white rounded-xl font-bold text-lg hover:shadow-lg hover:shadow-green-500/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                onClick={handleSelectPhone}
                disabled={loading}
                className={`w-full px-4 py-3 rounded-lg transition-colors ${isDark
                  ? 'text-slate-400 hover:bg-slate-900'
                  : 'text-slate-600 hover:bg-slate-50'
                  }`}
              >
                Não recebeu o código? Enviar novamente
              </button>

              <div className={`p-3 rounded-lg ${isDark ? 'bg-yellow-900/20' : 'bg-yellow-50'} border ${isDark ? 'border-yellow-700' : 'border-yellow-200'}`}>
                <p className={`text-xs ${isDark ? 'text-yellow-400' : 'text-yellow-700'}`}>
                  ⚠️ Verifique se o SMS não foi para a caixa de SPAM
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Select UC */}
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
                Escolha qual UC você deseja simular a economia
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
                    className={`w-full p-6 rounded-xl border-2 text-left transition-all ${!isUcAtiva
                      ? 'opacity-50 cursor-not-allowed border-slate-300'
                      : selectedUcId === ucId
                        ? 'border-[#FFD700] bg-[#FFD700]/10'
                        : isDark
                          ? 'border-slate-700 hover:border-slate-600 bg-slate-900'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <MapPin size={16} className={selectedUcId === ucId ? 'text-[#FFD700]' : isDark ? 'text-slate-400' : 'text-slate-500'} />
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
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${selectedUcId === ucId
                        ? 'border-[#FFD700] bg-[#FFD700]'
                        : isDark
                          ? 'border-slate-600'
                          : 'border-slate-300'
                        }`}>
                        {selectedUcId === ucId && (
                          <CheckCircle2 size={14} className="text-slate-900" />
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
              className="w-full px-6 py-4 bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-slate-900 rounded-xl font-bold text-lg hover:shadow-lg hover:shadow-yellow-500/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Calculando economia...
                </>
              ) : (
                <>
                  Ver Minha Economia
                  <ChevronRight size={20} />
                </>
              )}
            </button>
          </div>
        )}

        {/* Step 5: Report */}
        {currentStep === 'report' && (
          <div className="space-y-6">
            {/* Summary Card */}
            <div className={`p-8 rounded-2xl ${isDark ? 'bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700' : 'bg-gradient-to-br from-white to-slate-50 border border-slate-200'} shadow-xl`}>
              <div className="text-center mb-8">
                <div className="inline-flex p-4 bg-gradient-to-br from-[#10B981]/20 to-green-600/20 rounded-xl mb-4">
                  <TrendingDown className="text-[#10B981]" size={48} />
                </div>
                <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Sua Simulação de Economia
                </h2>
                <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                  Veja quanto você pode economizar com a Midwest
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6 mb-8">
                {/* Total Paid */}
                <div className={`p-6 rounded-xl ${isDark ? 'bg-slate-900/50 border border-slate-700' : 'bg-white border border-slate-200'}`}>
                  <div className="flex items-center gap-3 mb-2">
                    <DollarSign className={isDark ? 'text-slate-400' : 'text-slate-500'} size={24} />
                    <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Total Pago (últimos 12 meses)
                    </span>
                  </div>
                  <div className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {totalPago.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                </div>

                {/* Estimated Savings */}
                <div className="p-6 rounded-xl bg-gradient-to-br from-[#10B981]/10 to-green-600/10 border border-[#10B981]/20">
                  <div className="flex items-center gap-3 mb-2">
                    <TrendingDown className="text-[#10B981]" size={24} />
                    <span className="text-sm text-[#10B981]">
                      Economia com 30% de desconto
                    </span>
                  </div>
                  <div className="text-3xl font-bold text-[#10B981]">
                    {economiaEstimada.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                  <p className="text-xs text-[#10B981] mt-1">
                    Economia garantida em contrato!
                  </p>
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
                            <div className="text-sm font-semibold text-[#10B981]">
                              {valorComEconomia.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className={isDark ? 'text-slate-500' : 'text-slate-500'}>
                            Economia de 30%
                          </span>
                          <span className="text-[#10B981] font-medium">
                            -{economiaFatura.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Extra Benefits */}
              <div className={`mt-6 p-4 rounded-lg ${isDark ? 'bg-[#FFD700]/10' : 'bg-[#FFD700]/5'} border ${isDark ? 'border-[#FFD700]/30' : 'border-[#FFD700]/20'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="text-[#FFD700]" size={20} />
                  <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Programa Primeiros 100 Clientes
                  </span>
                </div>
                <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  Seja um dos primeiros e ganhe <strong>35% de desconto</strong> (5% extra!) nos primeiros 6 meses!
                </p>
              </div>
            </div>

            {/* CTA */}
            <div className={`p-8 rounded-2xl ${isDark ? 'bg-gradient-to-br from-[#FFD700]/10 to-[#FFA500]/10 border border-[#FFD700]/30' : 'bg-gradient-to-br from-[#FFD700]/5 to-[#FFA500]/5 border border-[#FFD700]/20'} text-center`}>
              <h3 className={`text-2xl font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Pronto para economizar {economiaEstimada.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} por ano?
              </h3>
              <p className={`mb-6 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Entre em contato agora e comece a economizar ainda este mês!
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a
                  href="https://wa.me/5565999999999?text=Quero%20economizar%2030%25%20na%20conta%20de%20luz!"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-3 bg-gradient-to-r from-[#10B981] to-[#059669] text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-green-500/30 transition-all duration-300 flex items-center justify-center gap-2"
                >
                  <MessageSquare size={20} />
                  Falar no WhatsApp
                </a>
                <button className={`px-6 py-3 rounded-xl font-semibold border-2 transition-all ${isDark
                  ? 'border-slate-700 text-white hover:bg-slate-800'
                  : 'border-slate-300 text-slate-900 hover:bg-slate-50'
                  } flex items-center justify-center gap-2`}>
                  <Download size={20} />
                  Baixar Simulação
                </button>
              </div>
            </div>

            <button
              onClick={handleBackToHome}
              className={`w-full px-4 py-3 rounded-lg transition-colors ${isDark
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