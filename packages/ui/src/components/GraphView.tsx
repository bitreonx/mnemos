import { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { GraphData } from '../types';

interface GraphViewProps {
  graph: GraphData | null;
  highlightNodes?: string[];
}

const KIND_COLORS: Record<string, string> = {
  repository: '#6366f1',
  domain: '#22c55e',
  service: '#3b82f6',
  package: '#8b5cf6',
  file: '#71717a',
  class: '#f59e0b',
  function: '#06b6d4',
  api: '#ef4444',
  route: '#ec4899',
  test: '#a3a3a3',
  interface: '#14b8a6',
  event: '#f97316',
};

export function GraphView({ graph, highlightNodes }: GraphViewProps) {
  const { initialNodes, initialEdges } = useMemo(() => {
    if (!graph) return { initialNodes: [], initialEdges: [] };

    const filtered = graph.nodes.filter((n) =>
      ['domain', 'service', 'package', 'api', 'route'].includes(n.kind) ||
      (n.kind === 'file' && highlightNodes?.includes(n.id)),
    );

    const displayNodes = filtered.length > 200 ? filtered.slice(0, 200) : filtered;
    const nodeIds = new Set(displayNodes.map((n) => n.id));

    const nodes: Node[] = displayNodes.map((n, i) => {
      const cols = Math.ceil(Math.sqrt(displayNodes.length));
      const row = Math.floor(i / cols);
      const col = i % cols;

      return {
        id: n.id,
        position: { x: col * 220, y: row * 100 },
        data: {
          label: (
            <div className="text-center">
              <div className="text-[10px] uppercase opacity-60">{n.kind}</div>
              <div className="font-medium truncate max-w-[140px]">{n.name}</div>
            </div>
          ),
        },
        style: {
          background: KIND_COLORS[n.kind] ?? '#71717a',
          color: '#fff',
          border: highlightNodes?.includes(n.id) ? '2px solid #fff' : 'none',
          borderRadius: 8,
          padding: '8px 12px',
          fontSize: 11,
          width: 160,
        },
      };
    });

    const edges: Edge[] = graph.edges
      .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
      .slice(0, 500)
      .map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.kind,
        style: { stroke: '#3f3f46', strokeWidth: 1 },
        labelStyle: { fill: '#71717a', fontSize: 8 },
        animated: e.kind === 'CALLS',
      }));

    return { initialNodes: nodes, initialEdges: edges };
  }, [graph, highlightNodes]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  if (!graph) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
        No graph data available. Run <code className="mx-1 px-1.5 py-0.5 rounded bg-[var(--color-surface-overlay)]">mnemos build</code> first.
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#27272a" gap={20} />
        <Controls />
        <MiniMap
          nodeColor={(n) => {
            const kind = graph.nodes.find((gn) => gn.id === n.id)?.kind ?? 'file';
            return KIND_COLORS[kind] ?? '#71717a';
          }}
          maskColor="rgba(10, 10, 11, 0.8)"
        />
      </ReactFlow>
    </div>
  );
}
