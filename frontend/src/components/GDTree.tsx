import { useCallback, useEffect, useMemo } from 'react';
import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    addEdge,
    useNodesState,
    useEdgesState,
    Position,
    type Node,
    type Edge,
    type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { RefreshCw, Sun, Home, Zap, TrendingUp } from 'lucide-react';

interface Beneficiaria {
    id: number;
    uc_formatada?: string;
    codigo_uc?: number;
    cdc?: number;
    endereco?: string;
    percentual_rateio: number;
    saldo_acumulado?: number;
    nome?: string;
}

interface Usina {
    id: number;
    nome?: string;
    uc_formatada?: string;
    codigo_uc?: number;
    cdc?: number;
    endereco?: string;
    saldo_acumulado?: number;
    tipo_geracao?: string;
    beneficiarias?: Beneficiaria[];
    empresa_nome?: string;
}

interface GDTreeProps {
    usina: Usina;
    onRefresh?: () => void;
    loading?: boolean;
    isDark?: boolean;
}

export function GDTree({ usina, onRefresh, loading, isDark = false }: GDTreeProps) {
    const beneficiarias = usina.beneficiarias || [];

    // Calcula métricas
    const metrics = useMemo(() => {
        const totalBeneficiarias = beneficiarias.length;
        const totalPercentual = beneficiarias.reduce((sum, b) => sum + (b.percentual_rateio || 0), 0);
        const saldoGeradora = usina.saldo_acumulado || 0;

        return {
            total_ucs: 1 + totalBeneficiarias,
            total_geradoras: 1,
            total_beneficiarias: totalBeneficiarias,
            total_kwh_excedente: saldoGeradora,
            total_percentual_compensacao: totalPercentual,
            total_conexoes: totalBeneficiarias,
        };
    }, [usina, beneficiarias]);

    // Gera os nós do grafo
    const generatedNodes = useMemo<Node[]>(() => {
        const nodes: Node[] = [];

        // Nó da usina geradora (centralizado no topo)
        nodes.push({
            id: `usina-${usina.id}`,
            position: { x: 300, y: 50 },
            data: {
                label: (
                    <div className="flex flex-col items-center gap-1">
                        <Sun size={20} className="text-white" />
                        <span className="font-bold text-sm">GERADORA</span>
                        <span className="text-xs">UC {usina.uc_formatada || usina.codigo_uc}</span>
                        <span className="text-xs opacity-80 truncate max-w-[180px]">{usina.endereco || ''}</span>
                        <div className="flex items-center gap-1 mt-1 bg-white/20 px-2 py-0.5 rounded-full">
                            <Zap size={12} />
                            <span className="text-xs font-bold">{Number(usina.saldo_acumulado) || 0} kWh</span>
                        </div>
                    </div>
                ),
            },
            style: {
                background: 'linear-gradient(135deg, #f97316 0%, #f59e0b 100%)',
                color: 'white',
                border: '3px solid #fff',
                borderRadius: 16,
                fontSize: 12,
                fontWeight: 600,
                width: 220,
                minHeight: 100,
                padding: 12,
                textAlign: 'center' as const,
                boxShadow: '0 10px 25px -5px rgba(249, 115, 22, 0.4)',
            },
            sourcePosition: Position.Bottom,
            targetPosition: Position.Top,
        });

        // Nós das beneficiárias (distribuídos abaixo)
        const spacing = 280;
        const startX = 300 - ((beneficiarias.length - 1) * spacing) / 2;

        beneficiarias.forEach((ben, index) => {
            nodes.push({
                id: `beneficiaria-${ben.id}`,
                position: { x: startX + index * spacing, y: 250 },
                data: {
                    label: (
                        <div className="flex flex-col items-center gap-1">
                            <Home size={18} className="text-slate-600" />
                            <span className="font-bold text-sm text-slate-800">UC {ben.uc_formatada || ben.codigo_uc}</span>
                            <span className="text-xs text-slate-500 truncate max-w-[160px]">{ben.nome || ben.endereco || ''}</span>
                            <div className="flex items-center gap-1 mt-1 bg-blue-100 px-2 py-0.5 rounded-full">
                                <TrendingUp size={12} className="text-blue-600" />
                                <span className="text-xs font-bold text-blue-700">{Number(ben.percentual_rateio) || 0}%</span>
                            </div>
                        </div>
                    ),
                },
                style: {
                    background: 'white',
                    color: '#1e293b',
                    border: '2px solid #e2e8f0',
                    borderRadius: 12,
                    fontSize: 12,
                    width: 200,
                    minHeight: 90,
                    padding: 10,
                    textAlign: 'center' as const,
                    boxShadow: '0 4px 15px -3px rgba(0, 0, 0, 0.1)',
                },
                sourcePosition: Position.Bottom,
                targetPosition: Position.Top,
            });
        });

        return nodes;
    }, [usina, beneficiarias]);

    // Gera as arestas (conexões)
    const generatedEdges = useMemo<Edge[]>(() => {
        return beneficiarias.map((ben) => ({
            id: `edge-${usina.id}-${ben.id}`,
            source: `usina-${usina.id}`,
            target: `beneficiaria-${ben.id}`,
            label: `${Number(ben.percentual_rateio) || 0}%`,
            animated: true,
            style: {
                stroke: '#10b981',
                strokeWidth: 3,
            },
            labelStyle: {
                fill: '#059669',
                fontWeight: 700,
                fontSize: 12,
                background: 'white',
            },
            labelBgStyle: {
                fill: 'white',
            },
            labelBgPadding: [8, 4] as [number, number],
            labelBgBorderRadius: 4,
        }));
    }, [usina, beneficiarias]);

    const [nodes, setNodes, onNodesChange] = useNodesState(generatedNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(generatedEdges);

    useEffect(() => {
        setNodes(generatedNodes);
    }, [generatedNodes, setNodes]);

    useEffect(() => {
        setEdges(generatedEdges);
    }, [generatedEdges, setEdges]);

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge(params, eds)),
        [setEdges]
    );

    const cardClass = `rounded-xl border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'} shadow-sm`;
    const textPrimary = isDark ? 'text-white' : 'text-slate-900';
    const textMuted = isDark ? 'text-slate-400' : 'text-slate-600';

    return (
        <div className="w-full h-full space-y-4">
            {/* Métricas */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className={cardClass}>
                    <div className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className={`text-sm ${textMuted}`}>Total UCs</p>
                                <p className={`text-2xl font-bold ${textPrimary}`}>{metrics.total_ucs}</p>
                            </div>
                            <div className={`px-2 py-1 rounded-full text-xs font-medium ${isDark ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-100 text-orange-700'}`}>
                                {metrics.total_conexoes} conexões
                            </div>
                        </div>
                    </div>
                </div>

                <div className={cardClass}>
                    <div className="p-4">
                        <p className={`text-sm ${textMuted}`}>Geradora</p>
                        <p className={`text-2xl font-bold ${textPrimary}`}>{metrics.total_geradoras}</p>
                    </div>
                </div>

                <div className={cardClass}>
                    <div className="p-4">
                        <p className={`text-sm ${textMuted}`}>Beneficiárias</p>
                        <p className={`text-2xl font-bold ${textPrimary}`}>{metrics.total_beneficiarias}</p>
                    </div>
                </div>

                <div className={cardClass}>
                    <div className="p-4">
                        <p className={`text-sm ${textMuted}`}>Saldo kWh</p>
                        <p className={`text-2xl font-bold ${textPrimary}`}>{metrics.total_kwh_excedente.toLocaleString()}</p>
                    </div>
                </div>
            </div>

            {/* Grafo */}
            <div className={cardClass}>
                <div className={`flex items-center justify-between p-4 border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                    <div>
                        <h3 className={`font-semibold ${textPrimary}`}>Árvore de Relacionamentos (GD)</h3>
                        <p className={`text-sm ${textMuted}`}>Geradora → Beneficiárias</p>
                    </div>
                    {onRefresh && (
                        <button
                            onClick={onRefresh}
                            disabled={loading}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition ${
                                isDark
                                    ? 'border-slate-600 text-slate-300 hover:bg-slate-700'
                                    : 'border-slate-300 text-slate-600 hover:bg-slate-100'
                            } disabled:opacity-50`}
                        >
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                            Atualizar
                        </button>
                    )}
                </div>

                <div className="p-4">
                    <div
                        className={`w-full border rounded-lg overflow-hidden ${isDark ? 'border-slate-700' : 'border-slate-200'}`}
                        style={{ height: 450 }}
                    >
                        <ReactFlow
                            nodes={nodes}
                            edges={edges}
                            onNodesChange={onNodesChange}
                            onEdgesChange={onEdgesChange}
                            onConnect={onConnect}
                            fitView
                            fitViewOptions={{ padding: 0.3 }}
                            minZoom={0.3}
                            maxZoom={1.5}
                            defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
                        >
                            <MiniMap
                                nodeColor={(node) => {
                                    if (node.id.startsWith('usina')) return '#f97316';
                                    return '#94a3b8';
                                }}
                                maskColor={isDark ? 'rgba(15, 23, 42, 0.8)' : 'rgba(241, 245, 249, 0.8)'}
                                style={{
                                    backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                                }}
                            />
                            <Controls
                                style={{
                                    backgroundColor: isDark ? '#1e293b' : 'white',
                                    borderColor: isDark ? '#475569' : '#e2e8f0',
                                }}
                            />
                            <Background
                                gap={16}
                                size={1}
                                color={isDark ? '#334155' : '#e2e8f0'}
                            />
                        </ReactFlow>
                    </div>
                </div>
            </div>

            {/* Legenda */}
            <div className={`flex items-center justify-center gap-6 py-2 ${textMuted} text-sm`}>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-gradient-to-br from-orange-500 to-amber-500"></div>
                    <span>Usina Geradora</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-white border-2 border-slate-300"></div>
                    <span>Beneficiária</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-8 h-0.5 bg-emerald-500"></div>
                    <span>Fluxo de Energia</span>
                </div>
            </div>
        </div>
    );
}
