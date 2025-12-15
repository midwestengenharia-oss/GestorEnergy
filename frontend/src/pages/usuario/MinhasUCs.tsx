/**
 * MinhasUCs - Página de gestão de Unidades Consumidoras do Usuário
 */

import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { usePerfil } from '../../contexts/PerfilContext';
import { ucsApi } from '../../api/ucs';
import type { UnidadeConsumidora } from '../../api/types';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
    Zap,
    Plus,
    Search,
    ChevronRight,
    Loader2,
    RefreshCw,
    AlertCircle,
    X,
    Trash2,
    MapPin,
    CheckCircle,
    XCircle,
    Pencil,
    Check,
    Map,
    List,
    Sun
} from 'lucide-react';

// Fix para ícones do Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Ícone customizado para UC geradora (solar)
const geradoraIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

// Ícone para UC ativa
const ativaIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

// Ícone para UC inativa
const inativaIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

export function MinhasUCs() {
    const { usuario } = useAuth();
    const { perfilAtivo } = usePerfil();
    const [ucs, setUcs] = useState<UnidadeConsumidora[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filtroStatus, setFiltroStatus] = useState<'todas' | 'ativas' | 'inativas'>('todas');
    const [busca, setBusca] = useState('');
    const [visualizacao, setVisualizacao] = useState<'lista' | 'mapa'>('lista');

    // Modal de vincular UC
    const [showVincularModal, setShowVincularModal] = useState(false);
    const [codigoUC, setCodigoUC] = useState('');
    const [vinculando, setVinculando] = useState(false);
    const [erroVincular, setErroVincular] = useState<string | null>(null);

    // Modal de confirmação de exclusão
    const [ucParaExcluir, setUcParaExcluir] = useState<UnidadeConsumidora | null>(null);
    const [excluindo, setExcluindo] = useState(false);

    // Edição de apelido
    const [ucEditandoApelido, setUcEditandoApelido] = useState<number | null>(null);
    const [novoApelido, setNovoApelido] = useState('');
    const [salvandoApelido, setSalvandoApelido] = useState(false);

    useEffect(() => {
        fetchUCs();
    }, [perfilAtivo]);

    const fetchUCs = async () => {
        try {
            setLoading(true);
            setError(null);
            // Filtrar UCs por titularidade baseado no perfil ativo
            const isTitular = perfilAtivo === 'usuario' ? true : perfilAtivo === 'gestor' ? false : undefined;
            const response = await ucsApi.minhas(isTitular);
            setUcs(response.data.ucs || []);
        } catch (err: any) {
            console.error('Erro ao carregar UCs:', err);
            setError(err.response?.data?.detail || 'Erro ao carregar unidades consumidoras');
        } finally {
            setLoading(false);
        }
    };

    const vincularUC = async () => {
        if (!codigoUC.trim()) {
            setErroVincular('Informe o código da UC');
            return;
        }

        try {
            setVinculando(true);
            setErroVincular(null);
            await ucsApi.vincularFormato({ uc_formatada: codigoUC.trim() });
            setShowVincularModal(false);
            setCodigoUC('');
            fetchUCs();
        } catch (err: any) {
            console.error('Erro ao vincular UC:', err);
            setErroVincular(err.response?.data?.detail || 'Erro ao vincular UC');
        } finally {
            setVinculando(false);
        }
    };

    const desvincularUC = async () => {
        if (!ucParaExcluir) return;

        try {
            setExcluindo(true);
            await ucsApi.desvincular(ucParaExcluir.id);
            setUcParaExcluir(null);
            fetchUCs();
        } catch (err: any) {
            console.error('Erro ao desvincular UC:', err);
            alert(err.response?.data?.detail || 'Erro ao desvincular UC');
        } finally {
            setExcluindo(false);
        }
    };

    const iniciarEdicaoApelido = (uc: UnidadeConsumidora) => {
        setUcEditandoApelido(uc.id);
        setNovoApelido(uc.apelido || '');
    };

    const salvarApelido = async (ucId: number) => {
        try {
            setSalvandoApelido(true);
            await ucsApi.atualizar(ucId, { apelido: novoApelido.trim() || undefined });
            setUcEditandoApelido(null);
            setNovoApelido('');
            fetchUCs();
        } catch (err: any) {
            console.error('Erro ao salvar apelido:', err);
            alert(err.response?.data?.detail || 'Erro ao salvar apelido');
        } finally {
            setSalvandoApelido(false);
        }
    };

    const cancelarEdicaoApelido = () => {
        setUcEditandoApelido(null);
        setNovoApelido('');
    };

    // Formatar código da UC
    const formatarCodigoUC = (uc: UnidadeConsumidora) => {
        return `${uc.cod_empresa}/${uc.cdc}-${uc.digito_verificador}`;
    };

    // Formatar endereço
    const formatarEndereco = (uc: UnidadeConsumidora) => {
        const partes = [uc.endereco, uc.numero_imovel, uc.bairro, uc.cidade].filter(Boolean);
        return partes.join(', ') || 'Endereço não informado';
    };

    // Filtrar UCs
    const ucsFiltradas = ucs.filter(uc => {
        // Filtro por status
        if (filtroStatus === 'ativas' && !uc.uc_ativa) return false;
        if (filtroStatus === 'inativas' && uc.uc_ativa) return false;

        // Filtro por busca
        if (busca) {
            const termo = busca.toLowerCase();
            const codigo = formatarCodigoUC(uc).toLowerCase();
            const endereco = formatarEndereco(uc).toLowerCase();
            const apelido = (uc.apelido || '').toLowerCase();
            return codigo.includes(termo) || endereco.includes(termo) || apelido.includes(termo);
        }

        return true;
    });

    // UCs com coordenadas válidas para o mapa
    const ucsComCoordenadas = useMemo(() => {
        return ucsFiltradas.filter(uc =>
            uc.latitude && uc.longitude &&
            !isNaN(Number(uc.latitude)) && !isNaN(Number(uc.longitude))
        );
    }, [ucsFiltradas]);

    // Centro do mapa (média das coordenadas ou Brasil por padrão)
    const centroMapa = useMemo((): [number, number] => {
        if (ucsComCoordenadas.length === 0) {
            return [-15.7801, -47.9292]; // Brasília como padrão
        }

        const latMedia = ucsComCoordenadas.reduce((acc, uc) => acc + Number(uc.latitude), 0) / ucsComCoordenadas.length;
        const lngMedia = ucsComCoordenadas.reduce((acc, uc) => acc + Number(uc.longitude), 0) / ucsComCoordenadas.length;

        return [latMedia, lngMedia];
    }, [ucsComCoordenadas]);

    // Selecionar ícone baseado no status da UC
    const getMarkerIcon = (uc: UnidadeConsumidora) => {
        if (uc.is_geradora) return geradoraIcon;
        if (uc.uc_ativa) return ativaIcon;
        return inativaIcon;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
                    <p className="text-slate-500 dark:text-slate-400">Carregando UCs...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
                    <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Erro ao carregar</h2>
                <p className="text-slate-500 dark:text-slate-400 mb-4">{error}</p>
                <button
                    onClick={fetchUCs}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                >
                    <RefreshCw size={18} />
                    Tentar novamente
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        Minhas Unidades Consumidoras
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        Gerencie suas UCs vinculadas à plataforma
                    </p>
                </div>
                <div className="flex gap-3">
                    <Link
                        to="/app/usuario/conectar-energisa"
                        className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition"
                    >
                        <Zap size={18} />
                        Conectar Energisa
                    </Link>
                    <button
                        onClick={() => setShowVincularModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                    >
                        <Plus size={18} />
                        Vincular Manual
                    </button>
                </div>
            </div>

            {/* Filtros */}
            <div className="flex flex-col sm:flex-row gap-4">
                {/* Busca */}
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar por código ou endereço..."
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-900 dark:text-white"
                    />
                </div>

                {/* Filtro de status */}
                <div className="flex gap-2">
                    {(['todas', 'ativas', 'inativas'] as const).map((status) => (
                        <button
                            key={status}
                            onClick={() => setFiltroStatus(status)}
                            className={`px-4 py-2 rounded-lg transition ${
                                filtroStatus === status
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                            }`}
                        >
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                        </button>
                    ))}
                </div>

                {/* Toggle Lista/Mapa */}
                <div className="flex bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                    <button
                        onClick={() => setVisualizacao('lista')}
                        className={`flex items-center gap-2 px-4 py-2 transition ${
                            visualizacao === 'lista'
                                ? 'bg-blue-500 text-white'
                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                    >
                        <List size={18} />
                        Lista
                    </button>
                    <button
                        onClick={() => setVisualizacao('mapa')}
                        className={`flex items-center gap-2 px-4 py-2 transition ${
                            visualizacao === 'mapa'
                                ? 'bg-blue-500 text-white'
                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                    >
                        <Map size={18} />
                        Mapa
                    </button>
                </div>
            </div>

            {/* Visualização de Mapa */}
            {visualizacao === 'mapa' && (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    {/* Legenda do Mapa */}
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-4">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Legenda:</span>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full bg-blue-500"></div>
                            <span className="text-sm text-slate-600 dark:text-slate-400">UC Ativa</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
                            <span className="text-sm text-slate-600 dark:text-slate-400">UC Geradora (GD)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full bg-red-500"></div>
                            <span className="text-sm text-slate-600 dark:text-slate-400">UC Inativa</span>
                        </div>
                        <span className="text-sm text-slate-500 dark:text-slate-400 ml-auto">
                            {ucsComCoordenadas.length} de {ucsFiltradas.length} UCs com localização
                        </span>
                    </div>

                    {ucsComCoordenadas.length === 0 ? (
                        <div className="p-8 text-center">
                            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                                <MapPin className="w-8 h-8 text-slate-400" />
                            </div>
                            <p className="text-slate-500 dark:text-slate-400">
                                Nenhuma UC com coordenadas de localização disponíveis
                            </p>
                            <p className="text-sm text-slate-400 dark:text-slate-500 mt-2">
                                As coordenadas são obtidas automaticamente ao conectar com a Energisa
                            </p>
                        </div>
                    ) : (
                        <div className="h-[calc(100vh-280px)] min-h-[500px]">
                            <MapContainer
                                center={centroMapa}
                                zoom={ucsComCoordenadas.length === 1 ? 15 : 10}
                                style={{ height: '100%', width: '100%' }}
                            >
                                <TileLayer
                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                />
                                {ucsComCoordenadas.map((uc) => (
                                    <Marker
                                        key={uc.id}
                                        position={[Number(uc.latitude), Number(uc.longitude)]}
                                        icon={getMarkerIcon(uc)}
                                    >
                                        <Popup>
                                            <div className="min-w-[220px]">
                                                {/* Apelido em destaque */}
                                                {uc.apelido && (
                                                    <p className="text-base font-bold text-slate-800 mb-1">
                                                        {uc.apelido}
                                                    </p>
                                                )}
                                                {/* Código da UC */}
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Zap className="text-blue-500" size={16} />
                                                    <span className={`${uc.apelido ? 'text-sm text-slate-600' : 'font-semibold text-slate-800'}`}>
                                                        UC {formatarCodigoUC(uc)}
                                                    </span>
                                                </div>
                                                {/* Endereço */}
                                                <p className="text-sm text-slate-600 mb-2">
                                                    {formatarEndereco(uc)}
                                                </p>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                                        uc.uc_ativa
                                                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                                            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                                    }`}>
                                                        {uc.uc_ativa ? 'Ativa' : 'Inativa'}
                                                    </span>
                                                    {uc.is_geradora && (
                                                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">
                                                            Geradora
                                                        </span>
                                                    )}
                                                </div>
                                                <Link
                                                    to={`/app/usuario/ucs/${uc.id}`}
                                                    className="text-sm text-blue-500 hover:text-blue-600 font-medium"
                                                >
                                                    Ver detalhes →
                                                </Link>
                                            </div>
                                        </Popup>
                                    </Marker>
                                ))}
                            </MapContainer>
                        </div>
                    )}
                </div>
            )}

            {/* Lista de UCs */}
            {visualizacao === 'lista' && ucsFiltradas.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Zap className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 mb-4">
                        {busca || filtroStatus !== 'todas'
                            ? 'Nenhuma UC encontrada com os filtros aplicados'
                            : 'Você ainda não possui nenhuma UC vinculada'}
                    </p>
                    {!busca && filtroStatus === 'todas' && (
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <Link
                                to="/app/usuario/conectar-energisa"
                                className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition"
                            >
                                <Zap size={18} />
                                Conectar Energisa
                            </Link>
                            <button
                                onClick={() => setShowVincularModal(true)}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition"
                            >
                                <Plus size={18} />
                                Vincular Manualmente
                            </button>
                        </div>
                    )}
                </div>
            ) : visualizacao === 'lista' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {ucsFiltradas.map((uc) => (
                        <div
                            key={uc.id}
                            className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-lg transition"
                        >
                            {/* Header do Card */}
                            <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                                            <Zap className="text-blue-600 dark:text-blue-400" size={20} />
                                        </div>
                                        <div>
                                            {/* Apelido editável */}
                                            {ucEditandoApelido === uc.id ? (
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="text"
                                                        value={novoApelido}
                                                        onChange={(e) => setNovoApelido(e.target.value)}
                                                        placeholder="Ex: Casa do Pai"
                                                        className="px-2 py-1 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white w-32"
                                                        autoFocus
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') salvarApelido(uc.id);
                                                            if (e.key === 'Escape') cancelarEdicaoApelido();
                                                        }}
                                                    />
                                                    <button
                                                        onClick={() => salvarApelido(uc.id)}
                                                        disabled={salvandoApelido}
                                                        className="p-1 text-green-500 hover:text-green-600"
                                                    >
                                                        {salvandoApelido ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                                    </button>
                                                    <button
                                                        onClick={cancelarEdicaoApelido}
                                                        className="p-1 text-slate-400 hover:text-slate-600"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <p className="font-medium text-slate-900 dark:text-white">
                                                        UC {formatarCodigoUC(uc)}{uc.apelido ? ` - ${uc.apelido}` : ''}
                                                    </p>
                                                    <button
                                                        onClick={() => iniciarEdicaoApelido(uc)}
                                                        className="p-1 text-slate-400 hover:text-blue-500 transition"
                                                        title="Editar apelido"
                                                    >
                                                        <Pencil size={14} />
                                                    </button>
                                                </div>
                                            )}
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                                    uc.uc_ativa
                                                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                                        : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                                }`}>
                                                    {uc.uc_ativa ? 'Ativa' : 'Inativa'}
                                                </span>
                                                {uc.is_geradora && (
                                                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                                                        Geradora
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Corpo do Card */}
                            <div className="p-4 space-y-3">
                                <div className="flex items-start gap-2">
                                    <MapPin className="text-slate-400 mt-0.5 flex-shrink-0" size={16} />
                                    <p className="text-sm text-slate-600 dark:text-slate-300">
                                        {formatarEndereco(uc)}
                                    </p>
                                </div>

                                {uc.nome_titular && (
                                    <div className="text-sm">
                                        <span className="text-slate-500 dark:text-slate-400">Titular: </span>
                                        <span className="text-slate-700 dark:text-slate-200">{uc.nome_titular}</span>
                                    </div>
                                )}

                                {uc.tipo_ligacao && (
                                    <div className="text-sm">
                                        <span className="text-slate-500 dark:text-slate-400">Tipo: </span>
                                        <span className="text-slate-700 dark:text-slate-200">{uc.tipo_ligacao}</span>
                                    </div>
                                )}
                            </div>

                            {/* Footer do Card */}
                            <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                                <button
                                    onClick={() => setUcParaExcluir(uc)}
                                    className="flex items-center gap-1 text-sm text-red-500 hover:text-red-600 transition"
                                >
                                    <Trash2 size={16} />
                                    Desvincular
                                </button>
                                <Link
                                    to={`/app/usuario/ucs/${uc.id}`}
                                    className="flex items-center gap-1 text-sm text-blue-500 hover:text-blue-600 transition"
                                >
                                    Ver detalhes
                                    <ChevronRight size={16} />
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal de Vincular UC */}
            {showVincularModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-md">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                Vincular Nova UC
                            </h2>
                            <button
                                onClick={() => {
                                    setShowVincularModal(false);
                                    setCodigoUC('');
                                    setErroVincular(null);
                                }}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Código da UC
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ex: 6/4242904-3"
                                    value={codigoUC}
                                    onChange={(e) => setCodigoUC(e.target.value)}
                                    className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-900 dark:text-white"
                                />
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    Informe o código no formato: empresa/cdc-dígito
                                </p>
                            </div>

                            {erroVincular && (
                                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                                    <p className="text-sm text-red-600 dark:text-red-400">{erroVincular}</p>
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex gap-3 justify-end">
                            <button
                                onClick={() => {
                                    setShowVincularModal(false);
                                    setCodigoUC('');
                                    setErroVincular(null);
                                }}
                                className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={vincularUC}
                                disabled={vinculando}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50"
                            >
                                {vinculando ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin" />
                                        Vinculando...
                                    </>
                                ) : (
                                    <>
                                        <Plus size={18} />
                                        Vincular
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Confirmação de Exclusão */}
            {ucParaExcluir && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-md">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                Confirmar Desvinculação
                            </h2>
                        </div>
                        <div className="p-4">
                            <p className="text-slate-600 dark:text-slate-300">
                                Tem certeza que deseja desvincular a UC{' '}
                                <strong>{formatarCodigoUC(ucParaExcluir)}</strong>?
                            </p>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                                Esta ação não pode ser desfeita.
                            </p>
                        </div>
                        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex gap-3 justify-end">
                            <button
                                onClick={() => setUcParaExcluir(null)}
                                className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={desvincularUC}
                                disabled={excluindo}
                                className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition disabled:opacity-50"
                            >
                                {excluindo ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin" />
                                        Excluindo...
                                    </>
                                ) : (
                                    <>
                                        <Trash2 size={18} />
                                        Desvincular
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default MinhasUCs;
