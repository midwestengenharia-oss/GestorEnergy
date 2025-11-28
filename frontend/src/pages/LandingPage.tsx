import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import {
  Zap, TrendingDown, Shield, Clock, CheckCircle2, ArrowRight,
  Sun, Leaf, DollarSign, BarChart3, Users, Award, ChevronRight
} from 'lucide-react';

export function LandingPage() {
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const handleSimular = () => {
    navigate('/simular');
  };

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900' : 'bg-gradient-to-br from-white via-slate-50 to-white'}`}>
      {/* Header/Navbar */}
      <nav className={`sticky top-0 z-50 backdrop-blur-lg ${isDark ? 'bg-slate-900/80 border-slate-700' : 'bg-white/80 border-slate-200'} border-b`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center justify-center w-10 h-10 bg-gradient-to-br from-[#00A3E0] to-blue-600 rounded-xl shadow-lg shadow-blue-500/30">
                <Zap className="text-white" size={24} />
              </div>
              <span className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Energia Compartilhada
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/app')}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                  isDark
                    ? 'text-slate-300 hover:bg-slate-800'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                Entrar
              </button>
              <button
                onClick={handleSimular}
                className="px-6 py-2 bg-gradient-to-r from-[#00A3E0] to-blue-600 text-white rounded-lg font-medium hover:shadow-lg hover:shadow-blue-500/30 transition-all duration-300"
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
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/20">
                <Leaf className="text-green-500" size={16} />
                <span className={`text-sm font-medium ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                  100% Sustentável
                </span>
              </div>

              <h1 className={`text-4xl lg:text-6xl font-bold leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Reduza sua conta de luz em até{' '}
                <span className="bg-gradient-to-r from-[#00A3E0] to-green-500 bg-clip-text text-transparent">
                  30%
                </span>
              </h1>

              <p className={`text-lg lg:text-xl ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Economize de verdade com energia solar compartilhada. Sem instalação, sem investimento inicial e sem burocracia.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={handleSimular}
                  className="group px-8 py-4 bg-gradient-to-r from-[#00A3E0] to-blue-600 text-white rounded-xl font-semibold text-lg hover:shadow-2xl hover:shadow-blue-500/40 transition-all duration-300 flex items-center justify-center gap-2"
                >
                  Simular Minha Economia
                  <ArrowRight className="group-hover:translate-x-1 transition-transform" size={20} />
                </button>
                <button
                  className={`px-8 py-4 rounded-xl font-semibold text-lg border-2 transition-all duration-300 ${
                    isDark
                      ? 'border-slate-700 text-white hover:bg-slate-800'
                      : 'border-slate-300 text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  Saiba Mais
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 pt-8">
                <div>
                  <div className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    30%
                  </div>
                  <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Economia Média
                  </div>
                </div>
                <div>
                  <div className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    0%
                  </div>
                  <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Investimento
                  </div>
                </div>
                <div>
                  <div className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    100%
                  </div>
                  <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Sustentável
                  </div>
                </div>
              </div>
            </div>

            {/* Right Content - Illustration/Image Placeholder */}
            <div className="relative">
              <div className={`relative rounded-2xl overflow-hidden ${isDark ? 'bg-gradient-to-br from-slate-800 to-slate-900' : 'bg-gradient-to-br from-blue-50 to-green-50'} p-8 lg:p-12 shadow-2xl`}>
                <div className="relative z-10 space-y-6">
                  <div className={`p-6 rounded-xl ${isDark ? 'bg-slate-800/50 border border-slate-700' : 'bg-white/80 border border-slate-200'} backdrop-blur`}>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="p-3 bg-gradient-to-br from-[#00A3E0] to-blue-600 rounded-lg">
                        <TrendingDown className="text-white" size={24} />
                      </div>
                      <div>
                        <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                          Conta Tradicional
                        </div>
                        <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          R$ 450,00
                        </div>
                      </div>
                    </div>
                    <div className="h-px bg-gradient-to-r from-transparent via-green-500 to-transparent mb-4"></div>
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-gradient-to-br from-green-500 to-green-600 rounded-lg">
                        <CheckCircle2 className="text-white" size={24} />
                      </div>
                      <div>
                        <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                          Com Energia Compartilhada
                        </div>
                        <div className="text-2xl font-bold text-green-500">
                          R$ 315,00
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                      <div className="text-sm font-medium text-green-500 text-center">
                        Economia de R$ 135,00/mês
                      </div>
                    </div>
                  </div>

                  <div className={`p-4 rounded-xl ${isDark ? 'bg-slate-800/50 border border-slate-700' : 'bg-white/80 border border-slate-200'} backdrop-blur`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Sun className="text-yellow-500" size={20} />
                        <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                          Energia Solar
                        </span>
                      </div>
                      <span className="px-3 py-1 bg-green-500/20 text-green-500 text-xs font-medium rounded-full">
                        Ativo
                      </span>
                    </div>
                  </div>
                </div>

                {/* Decorative elements */}
                <div className="absolute top-10 right-10 w-32 h-32 bg-gradient-to-br from-[#00A3E0]/20 to-green-500/20 rounded-full blur-3xl"></div>
                <div className="absolute bottom-10 left-10 w-40 h-40 bg-gradient-to-br from-green-500/20 to-blue-500/20 rounded-full blur-3xl"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className={`py-20 ${isDark ? 'bg-slate-800/50' : 'bg-slate-50/50'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className={`text-3xl lg:text-4xl font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Por que escolher Energia Compartilhada?
            </h2>
            <p className={`text-lg ${isDark ? 'text-slate-400' : 'text-slate-600'} max-w-2xl mx-auto`}>
              A forma mais inteligente e sustentável de economizar na conta de luz
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Benefit 1 */}
            <div className={`p-8 rounded-2xl ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'} hover:shadow-xl transition-all duration-300`}>
              <div className="inline-flex p-4 bg-gradient-to-br from-[#00A3E0]/20 to-blue-600/20 rounded-xl mb-6">
                <DollarSign className="text-[#00A3E0]" size={32} />
              </div>
              <h3 className={`text-xl font-bold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Economia Garantida
              </h3>
              <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                Economize até 30% na sua conta de luz todos os meses, sem nenhum investimento inicial.
              </p>
            </div>

            {/* Benefit 2 */}
            <div className={`p-8 rounded-2xl ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'} hover:shadow-xl transition-all duration-300`}>
              <div className="inline-flex p-4 bg-gradient-to-br from-green-500/20 to-green-600/20 rounded-xl mb-6">
                <Leaf className="text-green-500" size={32} />
              </div>
              <h3 className={`text-xl font-bold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                100% Sustentável
              </h3>
              <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                Energia limpa e renovável proveniente de usinas solares, contribuindo para um planeta melhor.
              </p>
            </div>

            {/* Benefit 3 */}
            <div className={`p-8 rounded-2xl ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'} hover:shadow-xl transition-all duration-300`}>
              <div className="inline-flex p-4 bg-gradient-to-br from-purple-500/20 to-purple-600/20 rounded-xl mb-6">
                <Shield className="text-purple-500" size={32} />
              </div>
              <h3 className={`text-xl font-bold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Sem Instalação
              </h3>
              <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                Não precisa instalar painéis solares. A energia vem direto da nossa usina para sua casa.
              </p>
            </div>

            {/* Benefit 4 */}
            <div className={`p-8 rounded-2xl ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'} hover:shadow-xl transition-all duration-300`}>
              <div className="inline-flex p-4 bg-gradient-to-br from-orange-500/20 to-orange-600/20 rounded-xl mb-6">
                <Clock className="text-orange-500" size={32} />
              </div>
              <h3 className={`text-xl font-bold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Rápido e Fácil
              </h3>
              <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                Processo 100% digital. Em poucos minutos você já pode começar a economizar.
              </p>
            </div>

            {/* Benefit 5 */}
            <div className={`p-8 rounded-2xl ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'} hover:shadow-xl transition-all duration-300`}>
              <div className="inline-flex p-4 bg-gradient-to-br from-red-500/20 to-red-600/20 rounded-xl mb-6">
                <BarChart3 className="text-red-500" size={32} />
              </div>
              <h3 className={`text-xl font-bold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Transparência Total
              </h3>
              <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                Acompanhe sua economia mês a mês com relatórios detalhados e transparentes.
              </p>
            </div>

            {/* Benefit 6 */}
            <div className={`p-8 rounded-2xl ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'} hover:shadow-xl transition-all duration-300`}>
              <div className="inline-flex p-4 bg-gradient-to-br from-cyan-500/20 to-cyan-600/20 rounded-xl mb-6">
                <Award className="text-cyan-500" size={32} />
              </div>
              <h3 className={`text-xl font-bold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Sem Contrato Longo
              </h3>
              <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                Flexibilidade total. Cancele quando quiser, sem multas ou taxas de cancelamento.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className={`text-3xl lg:text-4xl font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Como funciona?
            </h2>
            <p className={`text-lg ${isDark ? 'text-slate-400' : 'text-slate-600'} max-w-2xl mx-auto`}>
              Em 3 passos simples você começa a economizar
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Step 1 */}
            <div className="relative">
              <div className={`p-8 rounded-2xl ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'} text-center`}>
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#00A3E0] to-blue-600 rounded-full text-white text-2xl font-bold mb-6">
                  1
                </div>
                <h3 className={`text-xl font-bold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Simule sua Economia
                </h3>
                <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                  Informe seu CPF e veja quanto você pode economizar com base no seu histórico de consumo.
                </p>
              </div>
              <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2">
                <ChevronRight className={isDark ? 'text-slate-700' : 'text-slate-300'} size={32} />
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative">
              <div className={`p-8 rounded-2xl ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'} text-center`}>
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-full text-white text-2xl font-bold mb-6">
                  2
                </div>
                <h3 className={`text-xl font-bold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Escolha sua UC
                </h3>
                <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                  Selecione qual unidade consumidora deseja migrar para energia compartilhada.
                </p>
              </div>
              <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2">
                <ChevronRight className={isDark ? 'text-slate-700' : 'text-slate-300'} size={32} />
              </div>
            </div>

            {/* Step 3 */}
            <div>
              <div className={`p-8 rounded-2xl ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'} text-center`}>
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full text-white text-2xl font-bold mb-6">
                  3
                </div>
                <h3 className={`text-xl font-bold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Comece a Economizar
                </h3>
                <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                  Pronto! A partir do próximo mês você já começa a pagar menos na sua conta de luz.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className={`py-20 ${isDark ? 'bg-slate-800/50' : 'bg-slate-50/50'}`}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className={`text-3xl lg:text-4xl font-bold mb-6 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Pronto para economizar até 30%?
          </h2>
          <p className={`text-lg ${isDark ? 'text-slate-400' : 'text-slate-600'} mb-8 max-w-2xl mx-auto`}>
            Descubra em menos de 2 minutos quanto você pode economizar por mês
          </p>
          <button
            onClick={handleSimular}
            className="group px-8 py-4 bg-gradient-to-r from-[#00A3E0] to-blue-600 text-white rounded-xl font-semibold text-lg hover:shadow-2xl hover:shadow-blue-500/40 transition-all duration-300 inline-flex items-center gap-2"
          >
            Simular Minha Economia Agora
            <ArrowRight className="group-hover:translate-x-1 transition-transform" size={20} />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className={`py-12 border-t ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center justify-center w-10 h-10 bg-gradient-to-br from-[#00A3E0] to-blue-600 rounded-xl shadow-lg shadow-blue-500/30">
                <Zap className="text-white" size={24} />
              </div>
              <span className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Energia Compartilhada
              </span>
            </div>
            <div className="flex items-center gap-6">
              <button
                onClick={() => navigate('/app')}
                className={`text-sm hover:text-[#00A3E0] transition-colors ${isDark ? 'text-slate-400' : 'text-slate-600'}`}
              >
                Área do Gestor
              </button>
              <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                2025 Energia Compartilhada. Todos os direitos reservados.
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
