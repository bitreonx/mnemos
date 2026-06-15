import { useMemo, useState, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeProps,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { MemoryModel, Capability, DiscoveredJourney, Domain } from '../types';

interface ArchitectureCanvasProps {
  memory: MemoryModel;
}

type ZoomLevel = 1 | 2 | 3 | 4;

const ZOOM_LABELS: Record<ZoomLevel, string> = {
  1: 'Capabilities',
  2: 'Domains',
  3: 'Services',
  4: 'Files',
};

const CAPABILITY_COLORS: Record<string, string> = {
  identity: '#8b5cf6',
  commerce: '#10b981',
  communication: '#06b6d4',
  content: '#f59e0b',
  operations: '#3b82f6',
  platform: '#71717a',
  analytics: '#ec4899',
};

const RISK_COLORS: Record<string, string> = {
  low: '#22c55e',
  medium: '#f59e0b',
  high: '#ef4444',
};

interface CapabilityNodeData extends Record<string, unknown> {
  capability: Capability;
}

interface DomainNodeData extends Record<string, unknown> {
  domain: Domain;
  serviceCount: number;
  apiCount: number;
}

interface ServiceNodeData extends Record<string, unknown> {
  name: string;
  path: string;
  domain?: string;
  deps: number;
  dependents: number;
}

interface FileNodeData extends Record<string, unknown> {
  name: string;
  path: string;
  kind: string;
}

type CanvasNode = Node<CapabilityNodeData | DomainNodeData | ServiceNodeData | FileNodeData, string>;

function CapabilityNode({ data }: NodeProps<Node<CapabilityNodeData>>) {
  const { capability } = data;
  const color = CAPABILITY_COLORS[capability.signature.category] ?? '#71717a';
  const confidence = Math.round(capability.confidence * 100);
  return (
    <div
      className="capability-node"
      style={{
        background: `linear-gradient(135deg, ${color}cc, ${color}88)`,
        borderColor: color,
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: color, opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ background: color, opacity: 0 }} />
      <div className="node-eyebrow">{capability.signature.category.toUpperCase()}</div>
      <div className="node-title">{capability.signature.name}</div>
      <div className="node-meta">
        <span>{capability.services.length} svcs</span>
        <span>{capability.apis.length} apis</span>
        <span className="node-confidence">{confidence}%</span>
      </div>
    </div>
  );
}

function DomainNode({ data }: NodeProps<Node<DomainNodeData>>) {
  const { domain, serviceCount, apiCount } = data;
  return (
    <div className="domain-node">
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      <div className="node-eyebrow">DOMAIN</div>
      <div className="node-title">{domain.name}</div>
      <div className="node-meta">
        <span>{serviceCount} svcs</span>
        <span>{apiCount} apis</span>
        <span>{domain.nodes.length} nodes</span>
      </div>
    </div>
  );
}

function ServiceNode({ data }: NodeProps<Node<ServiceNodeData>>) {
  return (
    <div className="service-node">
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      <div className="node-eyebrow">SERVICE</div>
      <div className="node-title mono">{data.name}</div>
      <div className="node-meta">
        <span>{data.deps} in</span>
        <span>{data.dependents} out</span>
      </div>
    </div>
  );
}

function FileNode({ data }: NodeProps<Node<FileNodeData>>) {
  return (
    <div className="file-node">
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      <div className="node-eyebrow">{data.kind.toUpperCase()}</div>
      <div className="node-title mono small">{data.name}</div>
      <div className="node-path mono">{data.path}</div>
    </div>
  );
}

const NODE_TYPES = {
  capability: CapabilityNode,
  domain: DomainNode,
  service: ServiceNode,
  file: FileNode,
};

export function ArchitectureCanvas({ memory }: ArchitectureCanvasProps) {
  const [zoom, setZoom] = useState<ZoomLevel>(1);
  const [focused, setFocused] = useState<string | null>(null);

  const { initialNodes, initialEdges } = useMemo(
    () => buildLayout(memory, zoom, focused),
    [memory, zoom, focused],
  );

  const [nodes, , onNodesChange] = useNodesState<CanvasNode>(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState<Edge>(initialEdges);

  const handleNodeClick = useCallback((_evt: unknown, node: CanvasNode) => {
    setFocused((curr) => (curr === node.id ? null : node.id));
  }, []);

  return (
    <div className="canvas-wrapper">
      <div className="zoom-rail">
        <div className="zoom-rail-title">Zoom</div>
        {[1, 2, 3, 4].map((level) => (
          <button
            key={level}
            className={`zoom-step ${zoom === level ? 'active' : ''}`}
            onClick={() => {
              setZoom(level as ZoomLevel);
              setFocused(null);
            }}
          >
            <div className="zoom-step-num">{level}</div>
            <div className="zoom-step-label">{ZOOM_LABELS[level as ZoomLevel]}</div>
          </button>
        ))}
        {focused && (
          <button className="zoom-clear" onClick={() => setFocused(null)}>
            Clear focus
          </button>
        )}
      </div>

      <div className="canvas-stage">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          nodeTypes={NODE_TYPES}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.1}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
          nodesDraggable={true}
          nodesConnectable={false}
          elementsSelectable={true}
        >
          <Background color="#1f1f23" gap={24} size={1} />
          <Controls className="!bg-[var(--color-surface-raised)] !border-[var(--color-border)]" />
          <MiniMap
            className="!bg-[var(--color-surface-raised)] !border-[var(--color-border)]"
            nodeColor={(n) => {
              const kind = (n.data as { kind?: string })?.kind ?? 'service';
              if (kind in CAPABILITY_COLORS) return CAPABILITY_COLORS[kind]!;
              return '#71717a';
            }}
            maskColor="rgba(10, 10, 11, 0.85)"
            pannable
            zoomable
          />
        </ReactFlow>
      </div>

      <CanvasLegend zoom={zoom} />
    </div>
  );
}

function CanvasLegend({ zoom }: { zoom: ZoomLevel }) {
  const items = useMemo(() => {
    if (zoom === 1) {
      return Object.entries(CAPABILITY_COLORS).map(([k, v]) => ({ label: k, color: v }));
    }
    if (zoom === 2 || zoom === 3) {
      return [
        { label: 'low risk', color: RISK_COLORS.low! },
        { label: 'medium risk', color: RISK_COLORS.medium! },
        { label: 'high risk', color: RISK_COLORS.high! },
      ];
    }
    return [
      { label: 'file', color: '#71717a' },
      { label: 'function', color: '#06b6d4' },
      { label: 'class', color: '#f59e0b' },
      { label: 'api', color: '#ef4444' },
    ];
  }, [zoom]);

  return (
    <div className="canvas-legend">
      {items.map((it) => (
        <div key={it.label} className="legend-item">
          <span className="legend-dot" style={{ background: it.color }} />
          <span>{it.label}</span>
        </div>
      ))}
    </div>
  );
}

function buildLayout(
  memory: MemoryModel,
  zoom: ZoomLevel,
  focused: string | null,
): { initialNodes: CanvasNode[]; initialEdges: Edge[] } {
  if (zoom === 1) return buildCapabilitiesLayout(memory.capabilities ?? []);
  if (zoom === 2) return buildDomainsLayout(memory);
  if (zoom === 3) return buildServicesLayout(memory, focused);
  return buildFilesLayout(memory, focused);
}

function gridLayout<T extends { id: string }>(
  items: T[],
  cols: number,
  width: number,
  height: number,
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const rows = Math.ceil(items.length / cols);
  const offsetX = -((cols - 1) * width) / 2;
  const offsetY = -((rows - 1) * height) / 2;
  items.forEach((it, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions.set(it.id, { x: offsetX + col * width, y: offsetY + row * height });
  });
  return positions;
}

function buildCapabilitiesLayout(capabilities: Capability[]) {
  const cols = Math.max(1, Math.ceil(Math.sqrt(capabilities.length)));
  const positions = gridLayout(capabilities, cols, 280, 200);

  const nodes: CanvasNode[] = capabilities.map((c) => {
    const pos = positions.get(c.id) ?? { x: 0, y: 0 };
    return {
      id: c.id,
      type: 'capability',
      position: pos,
      data: { capability: c },
    };
  });

  // Edges: capabilities sharing services are connected
  const serviceToCaps = new Map<string, string[]>();
  for (const c of capabilities) {
    for (const svc of c.services) {
      if (!serviceToCaps.has(svc)) serviceToCaps.set(svc, []);
      serviceToCaps.get(svc)!.push(c.id);
    }
  }

  const edgeSet = new Set<string>();
  const edges: Edge[] = [];
  for (const capIds of serviceToCaps.values()) {
    for (let i = 0; i < capIds.length; i++) {
      for (let j = i + 1; j < capIds.length; j++) {
        const key = [capIds[i]!, capIds[j]!].sort().join('::');
        if (edgeSet.has(key)) continue;
        edgeSet.add(key);
        edges.push({
          id: key,
          source: capIds[i]!,
          target: capIds[j]!,
          style: { stroke: '#3f3f46', strokeWidth: 1, strokeOpacity: 0.5 },
          animated: false,
        });
      }
    }
  }

  return { initialNodes: nodes, initialEdges: edges };
}

function buildDomainsLayout(memory: MemoryModel) {
  const domains = memory.domains;
  const cols = Math.max(1, Math.ceil(Math.sqrt(domains.length)));
  const positions = gridLayout(domains, cols, 280, 180);

  const nodes: CanvasNode[] = domains.map((d) => {
    const pos = positions.get(d.id) ?? { x: 0, y: 0 };
    const services = memory.services.filter((s) => s.domain === d.id || s.domain === d.name);
    const apis = memory.apis.filter((a) => a.domain === d.id || a.domain === d.name);
    return {
      id: d.id,
      type: 'domain',
      position: pos,
      data: { domain: d, serviceCount: services.length, apiCount: apis.length },
    };
  });

  // Edges: services used by both domains connect them
  const depToDomains = new Map<string, Set<string>>();
  for (const svc of memory.services) {
    for (const dep of svc.dependencies) {
      const targetDomain = memory.services.find((s) => s.name === dep)?.domain;
      if (targetDomain && svc.domain && targetDomain !== svc.domain) {
        if (!depToDomains.has(svc.domain)) depToDomains.set(svc.domain, new Set());
        depToDomains.get(svc.domain)!.add(targetDomain);
      }
    }
  }

  const edgeSet = new Set<string>();
  const edges: Edge[] = [];
  for (const [from, targets] of depToDomains) {
    for (const to of targets) {
      const key = [from, to].sort().join('::');
      if (edgeSet.has(key)) continue;
      edgeSet.add(key);
      edges.push({
        id: key,
        source: from,
        target: to,
        style: { stroke: '#3f3f46', strokeWidth: 1.5 },
        animated: false,
      });
    }
  }

  return { initialNodes: nodes, initialEdges: edges };
}

function buildServicesLayout(memory: MemoryModel, focused: string | null) {
  let services = memory.services;
  if (focused) {
    // focus on a domain: show only services in that domain
    const d = memory.domains.find((x) => x.id === focused);
    if (d) {
      services = services.filter((s) => s.domain === d.id || s.domain === d.name);
    } else {
      // focus on a capability: show its services
      const c = memory.capabilities?.find((x) => x.id === focused);
      if (c) {
        services = services.filter((s) => c.services.includes(s.name));
      }
    }
  }
  services = services.slice(0, 80);

  const cols = Math.max(1, Math.ceil(Math.sqrt(services.length)));
  const positions = gridLayout(services, cols, 240, 140);

  const nodes: CanvasNode[] = services.map((s) => {
    const pos = positions.get(s.id) ?? { x: 0, y: 0 };
    return {
      id: s.id,
      type: 'service',
      position: pos,
      data: {
        name: s.name,
        path: s.path,
        domain: s.domain,
        deps: s.dependents.length,
        dependents: s.dependencies.length,
      },
    };
  });

  const idSet = new Set(services.map((s) => s.id));
  const edges: Edge[] = [];
  for (const s of services.slice(0, 30)) {
    for (const dep of s.dependencies.slice(0, 3)) {
      const target = memory.services.find((x) => x.name === dep);
      if (target && idSet.has(target.id)) {
        edges.push({
          id: `${s.id}->${target.id}`,
          source: s.id,
          target: target.id,
          style: { stroke: '#3f3f46', strokeWidth: 1 },
        });
      }
    }
  }

  return { initialNodes: nodes, initialEdges: edges };
}

function buildFilesLayout(memory: MemoryModel, focused: string | null) {
  // Get files from a focused capability, domain, or service
  let nodes: CanvasNode[] = [];
  let edges: Edge[] = [];

  if (focused) {
    const svc = memory.services.find((s) => s.id === focused);
    if (svc) {
      // For a focused service, show files from the entry points
      const domain = memory.domains.find((d) => d.id === svc.domain || d.name === svc.domain);
      const fileIds = domain?.nodes ?? [];
      const graphNodes = window.__graph?.nodes ?? [];
      const files = graphNodes
        .filter((n: { id: string; kind: string }) => fileIds.includes(n.id) && n.kind === 'file')
        .slice(0, 40);
      const cols = Math.max(1, Math.ceil(Math.sqrt(files.length)));
      const positions = gridLayout(files, cols, 220, 110);
      nodes = files.map((f: { id: string; name: string; path?: string; kind: string }) => {
        const pos = positions.get(f.id) ?? { x: 0, y: 0 };
        return {
          id: f.id,
          type: 'file' as const,
          position: pos,
          data: { name: f.name, path: f.path ?? f.name, kind: f.kind },
        };
      });
    }
  }

  if (nodes.length === 0) {
    // Show top entry points from journeys as file nodes
    const journeyEntries = (memory.journeys ?? []).slice(0, 12).map((j: DiscoveredJourney) => ({
      id: j.id,
      kind: 'journey',
      name: j.signature.name,
      path: j.entryRoute ?? j.entryPoint,
    }));
    const cols = Math.max(1, Math.ceil(Math.sqrt(journeyEntries.length)));
    const positions = gridLayout(journeyEntries, cols, 240, 110);
    nodes = journeyEntries.map((j) => {
      const pos = positions.get(j.id) ?? { x: 0, y: 0 };
      return {
        id: j.id,
        type: 'file' as const,
        position: pos,
        data: { name: j.name, path: j.path, kind: 'journey' },
      };
    });
  }

  return { initialNodes: nodes, initialEdges: edges };
}
