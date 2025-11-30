import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import {
  Zap, TrendingDown, Shield, Clock, CheckCircle2, ArrowRight,
  Sun, Leaf, DollarSign, BarChart3, Users, Award, ChevronRight,
  Calculator, MessageSquare, FileText, Building, X, Star,
  Phone, MapPin, AlertCircle
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
        <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFD700" />
          <stop offset="50%" stopColor="#FFA500" />
          <stop offset="100%" stopColor="#F18A26" />
        </linearGradient>
      </defs>
      <path d="M10 20 L15 15 L25 15 L25 40 L15 45 L10 40 Z" fill="url(#goldGradient)" />
      <path d="M20 20 L25 15 L35 15 L35 40 L25 45 L20 40 Z" fill="url(#goldGradient)" opacity="0.9" />
      <path d="M30 20 L35 15 L45 15 L45 40 L35 45 L30 40 Z" fill="url(#goldGradient)" opacity="0.8" />
      <text x="55" y="36" fill="#282828" fontFamily="Arial, sans-serif" fontSize="26" fontWeight="bold" letterSpacing="-1">
        Midwest
      </text>
    </svg>
  );
}

export function LandingPage() {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [showCalculator, setShowCalculator] = useState(false);
  const [valorConta, setValorConta] = useState('');
  const [economia, setEconomia] = useState(null);
  const [vagasRestantes, setVagasRestantes] = useState(27);
  const [showFAQ, setShowFAQ] = useState({});

  // Contador de economia em tempo real
  const [economiaTotal, setEconomiaTotal] = useState(45782);

  useEffect(() => {
    const interval = setInterval(() => {
      setEconomiaTotal(prev => prev + Math.floor(Math.random() * 100));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSimular = () => {
    navigate('/simular');
  };

  const calcularEconomia = () => {
    if (valorConta) {
      const valor = parseFloat(valorConta);
      setEconomia({
        mensal: valor * 0.3,
        anual: valor * 0.3 * 12,
        dezAnos: valor * 0.3 * 12 * 10
      });
      setShowCalculator(true);
    }
  };

  const toggleFAQ = (index) => {
    setShowFAQ(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900' : 'bg-gradient-to-br from-white via-slate-50 to-white'}`}>
      {/* Banner Flutuante Programa Primeiros 100 */}
      <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-pulse">
        <div className="bg-gradient-to-r from-[#FFD700] to-yellow-500 text-slate-900 p-4 rounded-xl shadow-2xl">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle size={20} />
            <span className="font-bold">OFERTA ESPECIAL</span>
          </div>
          <p className="text-sm font-medium mb-2">
            🔥 35% de desconto para os próximos <strong>{vagasRestantes}</strong> clientes!
          </p>
          <button
            onClick={handleSimular}
            className="w-full py-2 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-all"
          >
            GARANTIR MINHA VAGA
          </button>
        </div>
      </div>

      {/* Header/Navbar */}
      <nav className={`sticky top-0 z-50 backdrop-blur-lg ${isDark ? 'bg-slate-900/80 border-slate-700' : 'bg-white/80 border-slate-200'} border-b`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <MidwestLogo variant={isDark ? 'white' : 'black'} className="h-10 w-auto" />
            </div>
            <div className="flex items-center gap-3">
              <a
                href="https://wa.me/5565999999999?text=Quero%20economizar%2030%25%20na%20conta%20de%20luz!"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-[#10B981] text-white rounded-lg font-medium hover:bg-[#059669] transition-all"
              >
                <MessageSquare size={18} />
                WhatsApp
              </a>
              <button
                onClick={handleSimular}
                className="px-6 py-2 bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-slate-900 rounded-lg font-bold hover:shadow-lg hover:shadow-yellow-500/30 transition-all duration-300"
              >
                Simular Economia
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
          {/* Contador em tempo real */}
          <div className="text-center mb-8">
            <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-full ${isDark ? 'bg-slate-800/50' : 'bg-white/80'} backdrop-blur shadow-lg`}>
              <TrendingDown className="text-[#10B981]" size={24} />
              <span className={`text-lg font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                R$ {economiaTotal.toLocaleString('pt-BR')} economizados este mês
              </span>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div className="space-y-8">
              {/* Selos de confiança */}
              <div className="flex flex-wrap gap-3">
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20 text-sm font-medium">
                  Sem Fidelidade
                </span>
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#1E3A8A]/10 text-[#1E3A8A] border border-[#1E3A8A]/20 text-sm font-medium">
                  Sem Taxa de Adesão
                </span>
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#FFD700]/10 text-yellow-700 border border-[#FFD700]/20 text-sm font-medium">
                  Economia Garantida
                </span>
              </div>

              <h1 className={`text-4xl lg:text-6xl font-bold leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Economize <span className="text-[#FFD700]">30%</span> na Conta de Luz<br />
                <span className="text-2xl lg:text-3xl text-[#10B981]">
                  Sem Instalar Nada, Sem Investimento
                </span>
              </h1>

              <p className={`text-lg lg:text-xl ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Energia solar compartilhada que cabe no seu bolso.
                Mais de <strong className="text-[#1E3A8A]">100 famílias</strong> já estão economizando no Mato Grosso.
              </p>

              <div className="space-y-4">
                <button
                  onClick={handleSimular}
                  className="w-full sm:w-auto group px-8 py-4 bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-slate-900 rounded-xl font-bold text-lg hover:shadow-2xl hover:shadow-yellow-500/40 transition-all duration-300 flex items-center justify-center gap-2"
                >
                  SIMULAR MINHA ECONOMIA
                  <ArrowRight className="group-hover:translate-x-1 transition-transform" size={20} />
                </button>
                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'} text-center sm:text-left`}>
                  Descubra em 30 segundos quanto você vai economizar
                </p>
              </div>

              {/* Mini Depoimentos Rotativos */}
              <div className={`p-4 rounded-xl ${isDark ? 'bg-slate-800/50' : 'bg-slate-100'} border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="text-[#FFD700] fill-current" size={16} />
                  ))}
                  <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    4.9/5 (73 avaliações)
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  <p className={isDark ? 'text-slate-300' : 'text-slate-700'}>
                    "Economizei R$ 127 este mês!" - <strong>Maria S., Cuiabá</strong>
                  </p>
                  <p className={isDark ? 'text-slate-300' : 'text-slate-700'}>
                    "Melhor decisão que tomei!" - <strong>João P., Sinop</strong>
                  </p>
                </div>
              </div>
            </div>

            {/* Right Content - Visual da Economia */}
            <div className="relative">
              <div className={`relative rounded-2xl overflow-hidden ${isDark ? 'bg-gradient-to-br from-slate-800 to-slate-900' : 'bg-gradient-to-br from-[#FFD700]/10 to-[#10B981]/10'} p-8 lg:p-12 shadow-2xl`}>
                <div className="relative z-10 space-y-6">
                  <div className={`p-6 rounded-xl ${isDark ? 'bg-slate-800/50 border border-slate-700' : 'bg-white/90 border border-slate-200'} backdrop-blur`}>
                    <h3 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      Sua Economia Real
                    </h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <X className="text-red-500" size={20} />
                          <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>
                            Conta Atual
                          </span>
                        </div>
                        <span className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          R$ 420,00
                        </span>
                      </div>
                      <div className="h-px bg-gradient-to-r from-transparent via-[#10B981] to-transparent"></div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="text-[#10B981]" size={20} />
                          <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>
                            Com Midwest
                          </span>
                        </div>
                        <span className="text-xl font-bold text-[#10B981]">
                          R$ 294,00
                        </span>
                      </div>
                    </div>
                    <div className="mt-6 p-4 bg-[#10B981]/10 rounded-lg border border-[#10B981]/20">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-[#10B981]">
                          R$ 126,00
                        </div>
                        <div className="text-sm text-[#10B981]">
                          Economia mensal garantida
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Decorative elements */}
                <div className="absolute top-10 right-10 w-32 h-32 bg-gradient-to-br from-[#FFD700]/20 to-[#10B981]/20 rounded-full blur-3xl"></div>
                <div className="absolute bottom-10 left-10 w-40 h-40 bg-gradient-to-br from-[#1E3A8A]/20 to-[#10B981]/20 rounded-full blur-3xl"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Seção Problema */}
      <section className={`py-20 ${isDark ? 'bg-slate-800/50' : 'bg-slate-50/50'}`}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className={`text-3xl lg:text-4xl font-bold mb-8 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Sua Conta de Luz Está Cada Vez Mais Alta?
          </h2>
          <p className={`text-lg mb-8 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            Você não está sozinho. As tarifas de energia subiram mais de 50% nos últimos 5 anos no Mato Grosso.
          </p>
          <p className={`text-lg mb-8 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            E pior: as bandeiras tarifárias tornam impossível prever quanto você vai pagar no próximo mês.
          </p>

          <div className={`p-8 rounded-2xl ${isDark ? 'bg-slate-900' : 'bg-white'} shadow-xl max-w-2xl mx-auto`}>
            <h3 className={`text-xl font-bold mb-6 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Mas e se existisse um jeito de:
            </h3>
            <div className="space-y-4 text-left">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="text-[#10B981] mt-1 flex-shrink-0" size={20} />
                <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>
                  Pagar sempre 30% menos
                </span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="text-[#10B981] mt-1 flex-shrink-0" size={20} />
                <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>
                  Sem surpresas na fatura
                </span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="text-[#10B981] mt-1 flex-shrink-0" size={20} />
                <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>
                  Sem precisar instalar nada
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Calculadora Interativa */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className={`text-3xl lg:text-4xl font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Calcule Sua Economia Real
            </h2>
          </div>

          <div className={`p-8 rounded-2xl ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-xl`}>
            {!showCalculator ? (
              <div className="max-w-md mx-auto">
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  Qual o valor da sua conta de luz?
                </label>
                <div className="flex gap-3">
                  <input
                    type="number"
                    value={valorConta}
                    onChange={(e) => setValorConta(e.target.value)}
                    placeholder="Ex: 300"
                    className={`flex-1 px-4 py-3 rounded-lg border ${isDark
                      ? 'bg-slate-900 border-slate-700 text-white'
                      : 'bg-white border-slate-300 text-slate-900'
                      } focus:outline-none focus:ring-2 focus:ring-[#FFD700]`}
                  />
                  <button
                    onClick={calcularEconomia}
                    className="px-6 py-3 bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-slate-900 rounded-lg font-bold hover:shadow-lg transition-all"
                  >
                    Calcular
                  </button>
                </div>
                <p className={`text-sm mt-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  🔒 100% seguro - Integrado com Energisa
                </p>
              </div>
            ) : (
              <div className="text-center space-y-6">
                <div className="animate-fadeIn">
                  <h3 className={`text-2xl font-bold mb-6 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    🎉 Veja quanto você vai economizar!
                  </h3>

                  <div className="grid md:grid-cols-3 gap-4 mb-8">
                    <div className={`p-4 rounded-lg ${isDark ? 'bg-slate-700' : 'bg-[#FFD700]/10'}`}>
                      <DollarSign className="text-[#FFD700] mx-auto mb-2" size={32} />
                      <div className="text-2xl font-bold text-[#FFD700]">
                        R$ {economia.mensal.toFixed(2)}
                      </div>
                      <div className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                        por mês
                      </div>
                    </div>

                    <div className={`p-4 rounded-lg ${isDark ? 'bg-slate-700' : 'bg-[#10B981]/10'}`}>
                      <TrendingDown className="text-[#10B981] mx-auto mb-2" size={32} />
                      <div className="text-2xl font-bold text-[#10B981]">
                        R$ {economia.anual.toFixed(2)}
                      </div>
                      <div className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                        por ano
                      </div>
                    </div>

                    <div className={`p-4 rounded-lg ${isDark ? 'bg-slate-700' : 'bg-[#1E3A8A]/10'}`}>
                      <Award className="text-[#1E3A8A] mx-auto mb-2" size={32} />
                      <div className="text-2xl font-bold text-[#1E3A8A]">
                        R$ {economia.dezAnos.toFixed(2)}
                      </div>
                      <div className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                        em 10 anos
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleSimular}
                    className="px-8 py-4 bg-gradient-to-r from-[#10B981] to-[#059669] text-white rounded-lg font-bold text-lg hover:shadow-lg transition-all"
                  >
                    QUERO COMEÇAR A ECONOMIZAR
                  </button>

                  <button
                    onClick={() => {
                      setShowCalculator(false);
                      setValorConta('');
                      setEconomia(null);
                    }}
                    className={`block mx-auto mt-4 text-sm ${isDark ? 'text-slate-400 hover:text-slate-300' : 'text-slate-600 hover:text-slate-800'}`}
                  >
                    Calcular novamente
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Comparativo */}
      <section className={`py-20 ${isDark ? 'bg-slate-800/50' : 'bg-slate-50/50'}`}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className={`text-3xl lg:text-4xl font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Por Que Somos Diferentes?
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                  <th className="text-left py-4 px-4"></th>
                  <th className="text-center py-4 px-4">
                    <div className="inline-flex items-center justify-center px-4 py-2 bg-gradient-to-r from-[#FFD700] to-[#FFA500] rounded-lg">
                      <span className="font-bold text-slate-900">MIDWEST</span>
                    </div>
                  </th>
                  <th className={`text-center py-4 px-4 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    (RE)ENERGISA
                  </th>
                  <th className={`text-center py-4 px-4 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    OUTROS
                  </th>
                </tr>
              </thead>
              <tbody className={isDark ? 'text-slate-300' : 'text-slate-700'}>
                <tr className={`border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                  <td className="py-4 px-4 font-medium">Desconto Real</td>
                  <td className="text-center py-4 px-4">
                    <span className="text-[#10B981] font-bold">30%</span>
                  </td>
                  <td className="text-center py-4 px-4">10-15%</td>
                  <td className="text-center py-4 px-4">10-15%</td>
                </tr>
                <tr className={`border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                  <td className="py-4 px-4 font-medium">Sem Fidelidade</td>
                  <td className="text-center py-4 px-4">
                    <CheckCircle2 className="text-[#10B981] mx-auto" size={20} />
                  </td>
                  <td className="text-center py-4 px-4">
                    <X className="text-red-500 mx-auto" size={20} />
                  </td>
                  <td className="text-center py-4 px-4">
                    <X className="text-red-500 mx-auto" size={20} />
                  </td>
                </tr>
                <tr className={`border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                  <td className="py-4 px-4 font-medium">Sem Taxa Adesão</td>
                  <td className="text-center py-4 px-4">
                    <CheckCircle2 className="text-[#10B981] mx-auto" size={20} />
                  </td>
                  <td className="text-center py-4 px-4">
                    <X className="text-red-500 mx-auto" size={20} />
                  </td>
                  <td className="text-center py-4 px-4">
                    <X className="text-red-500 mx-auto" size={20} />
                  </td>
                </tr>
                <tr className={`border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                  <td className="py-4 px-4 font-medium">Sem Burocracia</td>
                  <td className="text-center py-4 px-4">
                    <CheckCircle2 className="text-[#10B981] mx-auto" size={20} />
                  </td>
                  <td className="text-center py-4 px-4">
                    <X className="text-red-500 mx-auto" size={20} />
                  </td>
                  <td className="text-center py-4 px-4">
                    <X className="text-red-500 mx-auto" size={20} />
                  </td>
                </tr>
                <tr>
                  <td className="py-4 px-4 font-medium">Economia Garantida</td>
                  <td className="text-center py-4 px-4">
                    <CheckCircle2 className="text-[#10B981] mx-auto" size={20} />
                  </td>
                  <td className="text-center py-4 px-4">
                    <X className="text-red-500 mx-auto" size={20} />
                  </td>
                  <td className="text-center py-4 px-4">
                    <X className="text-red-500 mx-auto" size={20} />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Depoimentos */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className={`text-3xl lg:text-4xl font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Nossos Clientes Falam Por Nós
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Depoimento 1 */}
            <div className={`p-6 rounded-2xl ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-xl`}>
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="text-[#FFD700] fill-current" size={20} />
                ))}
              </div>
              <p className={`mb-4 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                "De R$ 420 para R$ 294! Moro de aluguel e achava que nunca poderia ter energia solar.
                A Midwest provou que eu estava errado! Processo foi super simples."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#FFD700] to-[#FFA500] flex items-center justify-center text-white font-bold">
                  JS
                </div>
                <div>
                  <p className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    João Silva
                  </p>
                  <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Cuiabá - Cliente há 6 meses
                  </p>
                </div>
              </div>
            </div>

            {/* Depoimento 2 */}
            <div className={`p-6 rounded-2xl ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-xl`}>
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="text-[#FFD700] fill-current" size={20} />
                ))}
              </div>
              <p className={`mb-4 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                "Economizo R$ 180 todo mês sem instalar nada!
                Em 6 meses já economizei R$ 1.080 - deu pra quitar duas prestações do carro!"
              </p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#10B981] to-[#059669] flex items-center justify-center text-white font-bold">
                  AC
                </div>
                <div>
                  <p className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Ana Costa
                  </p>
                  <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Sinop - Cliente há 4 meses
                  </p>
                </div>
              </div>
            </div>

            {/* Depoimento 3 */}
            <div className={`p-6 rounded-2xl ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-xl`}>
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="text-[#FFD700] fill-current" size={20} />
                ))}
              </div>
              <p className={`mb-4 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                "No início achei que era pegadinha, mas é real!
                30% de desconto todo mês. Atendimento pelo WhatsApp é excelente."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#1E3A8A] to-[#2563EB] flex items-center justify-center text-white font-bold">
                  MS
                </div>
                <div>
                  <p className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Maria Santos
                  </p>
                  <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Rondonópolis - Cliente há 3 meses
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Garantias */}
      <section className={`py-20 ${isDark ? 'bg-slate-800/50' : 'bg-slate-50/50'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className={`text-3xl lg:text-4xl font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Sua Tranquilidade É Nossa Prioridade
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Garantia 1 */}
            <div className={`p-6 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-white'} border-2 border-[#10B981] text-center`}>
              <Shield className="text-[#10B981] mx-auto mb-4" size={40} />
              <h3 className={`font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                ECONOMIA GARANTIDA
              </h3>
              <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                30% de desconto ou devolvemos a diferença
              </p>
            </div>

            {/* Garantia 2 */}
            <div className={`p-6 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-white'} border-2 border-[#FFD700] text-center`}>
              <FileText className="text-[#FFD700] mx-auto mb-4" size={40} />
              <h3 className={`font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                SEM FIDELIDADE
              </h3>
              <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Cancele quando quiser com 60 dias de aviso
              </p>
            </div>

            {/* Garantia 3 */}
            <div className={`p-6 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-white'} border-2 border-[#1E3A8A] text-center`}>
              <DollarSign className="text-[#1E3A8A] mx-auto mb-4" size={40} />
              <h3 className={`font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                SEM TAXAS ESCONDIDAS
              </h3>
              <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Sem adesão, sem surpresas, só economia
              </p>
            </div>

            {/* Garantia 4 */}
            <div className={`p-6 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-white'} border-2 border-[#10B981] text-center`}>
              <Zap className="text-[#10B981] mx-auto mb-4" size={40} />
              <h3 className={`font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                FORNECIMENTO GARANTIDO
              </h3>
              <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Mesma energia Energisa, só o preço que muda
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className={`text-3xl lg:text-4xl font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Perguntas Frequentes
            </h2>
          </div>

          <div className="space-y-4">
            {[
              {
                pergunta: "É seguro mudar a titularidade?",
                resposta: "Totalmente! Você continua como gestor da unidade com acesso total no app da Energisa. É apenas uma formalidade para conseguirmos o desconto. Mais de 10.000 clientes no Brasil já usam esse modelo com sucesso."
              },
              {
                pergunta: "Quanto tempo demora para começar a economizar?",
                resposta: "O processo leva até 60 dias, que é o tempo da Energisa processar a mudança. Mas assim que ativar, você economiza para sempre! 60 dias de espera para anos de economia."
              },
              {
                pergunta: "E se eu mudar de casa?",
                resposta: "Sem problemas! Transferimos o benefício para seu novo endereço. É um dos benefícios de não ter nada instalado - sua economia te acompanha onde você for!"
              },
              {
                pergunta: "Qual a pegadinha?",
                resposta: "Não tem! Nosso modelo de negócio é volume. Ganhamos na escala, não em taxas escondidas. Por isso podemos oferecer 30% de desconto real e ainda ter lucro. Transparência total!"
              }
            ].map((item, index) => (
              <div
                key={index}
                className={`rounded-xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} overflow-hidden`}
              >
                <button
                  onClick={() => toggleFAQ(index)}
                  className={`w-full px-6 py-4 text-left flex items-center justify-between ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-50'
                    } transition-colors`}
                >
                  <span className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {item.pergunta}
                  </span>
                  <ChevronRight
                    className={`transform transition-transform ${showFAQ[index] ? 'rotate-90' : ''
                      } ${isDark ? 'text-slate-400' : 'text-slate-600'}`}
                    size={20}
                  />
                </button>
                {showFAQ[index] && (
                  <div className="px-6 pb-4">
                    <p className={isDark ? 'text-slate-300' : 'text-slate-600'}>
                      {item.resposta}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Como Funciona */}
      <section className={`py-20 ${isDark ? 'bg-slate-800/50' : 'bg-slate-50/50'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className={`text-3xl lg:text-4xl font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Como Funciona a Economia de 30%
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Step 1 */}
            <div className="relative">
              <div className={`p-8 rounded-2xl ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'} text-center`}>
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#FFD700] to-[#FFA500] rounded-full text-slate-900 text-2xl font-bold mb-6">
                  1
                </div>
                <div className="mb-4">
                  <Sun className="text-[#FFD700] mx-auto" size={48} />
                </div>
                <h3 className={`text-xl font-bold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Usina Solar Gera Energia
                </h3>
                <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                  Nossa usina em MT produz energia limpa todos os dias
                </p>
              </div>
              <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2">
                <ChevronRight className={`${isDark ? 'text-slate-700' : 'text-slate-300'}`} size={32} />
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative">
              <div className={`p-8 rounded-2xl ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'} text-center`}>
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#10B981] to-[#059669] rounded-full text-white text-2xl font-bold mb-6">
                  2
                </div>
                <div className="mb-4">
                  <ArrowRight className="text-[#10B981] mx-auto" size={48} />
                </div>
                <h3 className={`text-xl font-bold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Créditos São Seus
                </h3>
                <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                  Você recebe os créditos com 30% de desconto garantido
                </p>
              </div>
              <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2">
                <ChevronRight className={`${isDark ? 'text-slate-700' : 'text-slate-300'}`} size={32} />
              </div>
            </div>

            {/* Step 3 */}
            <div>
              <div className={`p-8 rounded-2xl ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'} text-center`}>
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#1E3A8A] to-[#2563EB] rounded-full text-white text-2xl font-bold mb-6">
                  3
                </div>
                <div className="mb-4">
                  <DollarSign className="text-[#1E3A8A] mx-auto" size={48} />
                </div>
                <h3 className={`text-xl font-bold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Economia na Fatura
                </h3>
                <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                  Pague uma única conta menor e economize todo mês
                </p>
              </div>
            </div>
          </div>

          <div className="text-center mt-12">
            <a
              href="https://youtube.com/watch?v=example"
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${isDark
                ? 'bg-slate-800 text-white hover:bg-slate-700'
                : 'bg-white text-slate-900 hover:bg-slate-100'
                } shadow-lg`}
            >
              <MessageSquare size={20} />
              VER VÍDEO EXPLICATIVO - 2 MIN
            </a>
          </div>
        </div>
      </section>

      {/* CTA Section - Oferta Limitada */}
      <section className={`py-20 ${isDark ? 'bg-gradient-to-r from-slate-900 to-slate-800' : 'bg-gradient-to-r from-[#FFD700]/10 to-[#FFA500]/10'}`}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${isDark ? 'bg-red-900/30' : 'bg-red-100'
            } text-red-600 mb-6`}>
            <AlertCircle size={20} />
            <span className="font-medium">PROGRAMA PRIMEIROS 100 CLIENTES</span>
          </div>

          <h2 className={`text-3xl lg:text-4xl font-bold mb-6 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            ⚡ Benefício Exclusivo: <span className="text-[#FFD700]">35% de desconto</span> (5% extra!)
          </h2>

          <div className="flex items-center justify-center gap-8 mb-8">
            <div>
              <div className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {vagasRestantes}
              </div>
              <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                vagas restantes
              </div>
            </div>
            <div className="h-12 w-px bg-slate-400"></div>
            <div>
              <div className="text-3xl font-bold text-[#10B981]">
                {100 - vagasRestantes}
              </div>
              <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                já aderiram
              </div>
            </div>
          </div>

          <p className={`text-lg mb-8 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            Não perca a chance de economizar ainda mais!
          </p>

          <button
            onClick={handleSimular}
            className="group px-8 py-4 bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-slate-900 rounded-xl font-bold text-lg hover:shadow-2xl hover:shadow-yellow-500/40 transition-all duration-300 inline-flex items-center gap-2"
          >
            QUERO FAZER PARTE
            <ArrowRight className="group-hover:translate-x-1 transition-transform" size={20} />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className={`py-12 border-t ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            {/* Logo e Info */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <MidwestLogo variant={isDark ? 'white' : 'black'} className="h-10 w-auto" />
              </div>
              <p className={`text-sm mb-4 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Empresa do MT para o MT. Energia compartilhada com economia real garantida.
              </p>
              <div className="space-y-2 text-sm">
                <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                  CNPJ: XX.XXX.XXX/0001-XX
                </p>
              </div>
            </div>

            {/* Links */}
            <div>
              <h4 className={`font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Links Importantes
              </h4>
              <div className="space-y-2">
                <a href="#" className={`block text-sm hover:text-[#FFD700] transition-colors ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Como Funciona
                </a>
                <a href="#" className={`block text-sm hover:text-[#FFD700] transition-colors ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Perguntas Frequentes
                </a>
                <a href="#" className={`block text-sm hover:text-[#FFD700] transition-colors ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Termos de Uso
                </a>
                <a href="#" className={`block text-sm hover:text-[#FFD700] transition-colors ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Política de Privacidade
                </a>
              </div>
            </div>

            {/* Contato */}
            <div>
              <h4 className={`font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Fale Conosco
              </h4>
              <div className="space-y-3">
                <a
                  href="https://wa.me/5565999999999"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-3 text-sm hover:text-[#10B981] transition-colors ${isDark ? 'text-slate-400' : 'text-slate-600'}`}
                >
                  <Phone size={16} />
                  (65) 99999-9999
                </a>
                <div className={`flex items-start gap-3 text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  <MapPin size={16} className="mt-0.5" />
                  <span>
                    Cuiabá, Sinop, Rondonópolis<br />
                    e todo Mato Grosso
                  </span>
                </div>
              </div>

              <h4 className={`font-bold mt-6 mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Horário de Atendimento
              </h4>
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Seg a Sex: 8h às 20h<br />
                Sábado: 9h às 13h
              </p>
            </div>
          </div>

          <div className={`pt-8 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'} text-center`}>
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              © 2025 Midwest Energia Compartilhada. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}