import type { ArchitectureSmell, GraphEdge, GraphNode } from '../types.js';
import type { MnemosGraph } from '../graph/graph.js';
import { fanIn, fanOut, findCycles } from '../graph/graph.js';

const FAN_IN_THRESHOLD = 15;
const FAN_OUT_THRESHOLD = 20;
const GOD_SERVICE_THRESHOLD = 50;

export function detectSmells(graph: MnemosGraph): ArchitectureSmell[] {
  const smells: ArchitectureSmell[] = [];

  smells.push(...detectCircularDependencies(graph));
  smells.push(...detectGodServices(graph));
  smells.push(...detectFanInOut(graph));
  smells.push(...detectLayerViolations(graph));
  smells.push(...detectTightCoupling(graph));

  return smells.sort((a, b) => severityScore(b.severity) - severityScore(a.severity));
}

function severityScore(s: ArchitectureSmell['severity']): number {
  return { high: 3, medium: 2, low: 1 }[s];
}

function detectCircularDependencies(graph: MnemosGraph): ArchitectureSmell[] {
  const cycles = findCycles(graph, 10);

  return cycles.map((cycle, i) => ({
    id: `smell:circular:${i}`,
    type: 'circular_dependency' as const,
    severity: cycle.length <= 3 ? 'high' : 'medium',
    nodes: cycle,
    description: `Circular dependency detected: ${cycle.map((n) => graph.getNodeAttributes(n).name).join(' → ')}`,
    recommendation: 'Extract shared interfaces or introduce dependency inversion to break the cycle',
  }));
}

function detectGodServices(graph: MnemosGraph): ArchitectureSmell[] {
  const smells: ArchitectureSmell[] = [];

  graph.forEachNode((id: string, attrs: GraphNode) => {
    if (attrs.kind !== 'service' && attrs.kind !== 'file') return;

    const owned = graph.outNeighbors(id).filter((n: string) =>
      graph.outEdges(id, n).some((edgeKey) => (graph.getEdgeAttributes(edgeKey) as GraphEdge).kind === 'OWNS'),
    );

    const totalOwned = graph.outNeighbors(id).length;
    if (totalOwned >= GOD_SERVICE_THRESHOLD) {
      smells.push({
        id: `smell:god:${id}`,
        type: 'god_service',
        severity: 'high',
        nodes: [id, ...owned.slice(0, 5)],
        description: `${attrs.name} owns ${totalOwned} nodes — potential god service`,
        recommendation: 'Split into focused modules with single responsibilities',
      });
    }
  });

  return smells;
}

function detectFanInOut(graph: MnemosGraph): ArchitectureSmell[] {
  const smells: ArchitectureSmell[] = [];

  graph.forEachNode((id: string, attrs: GraphNode) => {
    if (!['file', 'function', 'class', 'service'].includes(attrs.kind)) return;

    const fi = fanIn(graph, id);
    const fo = fanOut(graph, id);

    if (fi >= FAN_IN_THRESHOLD) {
      smells.push({
        id: `smell:fanin:${id}`,
        type: 'excessive_fan_in',
        severity: fi >= FAN_IN_THRESHOLD * 2 ? 'high' : 'medium',
        nodes: [id],
        description: `${attrs.name} has ${fi} incoming dependencies — high fan-in`,
        recommendation: 'Consider splitting this module or introducing a facade pattern',
      });
    }

    if (fo >= FAN_OUT_THRESHOLD) {
      smells.push({
        id: `smell:fanout:${id}`,
        type: 'excessive_fan_out',
        severity: fo >= FAN_OUT_THRESHOLD * 2 ? 'high' : 'medium',
        nodes: [id],
        description: `${attrs.name} depends on ${fo} other nodes — high fan-out`,
        recommendation: 'Reduce dependencies by extracting shared utilities or applying dependency injection',
      });
    }
  });

  return smells;
}

function detectLayerViolations(graph: MnemosGraph): ArchitectureSmell[] {
  const smells: ArchitectureSmell[] = [];

  graph.forEachEdge((_edge: string, attrs: GraphEdge, source: string, target: string) => {
    if (attrs.kind !== 'IMPORTS') return;

    const sourceAttrs = graph.getNodeAttributes(source) as GraphNode;
    const targetAttrs = graph.getNodeAttributes(target) as GraphNode;

    if (!sourceAttrs.path || !targetAttrs.path) return;

    const sourceLayer = inferLayer(sourceAttrs.path);
    const targetLayer = inferLayer(targetAttrs.path);

    if (sourceLayer && targetLayer && layerIndex(sourceLayer) < layerIndex(targetLayer)) {
      smells.push({
        id: `smell:layer:${source}:${target}`,
        type: 'layer_violation',
        severity: 'medium',
        nodes: [source, target],
        description: `${sourceLayer} layer (${sourceAttrs.name}) imports from ${targetLayer} layer (${targetAttrs.name})`,
        recommendation: 'Respect architectural layers: UI → Server → Data. Move shared logic to a common layer',
      });
    }
  });

  return smells.slice(0, 20);
}

function detectTightCoupling(graph: MnemosGraph): ArchitectureSmell[] {
  const smells: ArchitectureSmell[] = [];
  const pairCounts = new Map<string, number>();

  graph.forEachEdge((_edge: string, attrs: GraphEdge, source: string, target: string) => {
    if (attrs.kind !== 'IMPORTS') return;
    const sAttrs = graph.getNodeAttributes(source) as GraphNode;
    const tAttrs = graph.getNodeAttributes(target) as GraphNode;
    if (sAttrs.kind !== 'file' || tAttrs.kind !== 'file') return;

    const sDomain = inferDomainFromPath(sAttrs.path ?? '');
    const tDomain = inferDomainFromPath(tAttrs.path ?? '');
    if (!sDomain || !tDomain || sDomain === tDomain) return;

    const key = [sDomain, tDomain].sort().join('↔');
    pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
  });

  for (const [pair, count] of pairCounts) {
    if (count >= 10) {
      smells.push({
        id: `smell:coupling:${pair}`,
        type: 'tight_coupling',
        severity: count >= 20 ? 'high' : 'medium',
        nodes: [],
        description: `Tight coupling between ${pair} (${count} cross-imports)`,
        recommendation: 'Introduce shared contracts or event-based communication between domains',
      });
    }
  }

  return smells;
}

function inferLayer(filePath: string): string | null {
  if (filePath.includes('/components/') || filePath.includes('/app/')) return 'presentation';
  if (filePath.includes('/server/') || filePath.includes('/features/')) return 'application';
  if (filePath.includes('/db/') || filePath.includes('/supabase/')) return 'data';
  if (filePath.includes('/shared/') || filePath.includes('/lib/')) return 'shared';
  return null;
}

function layerIndex(layer: string): number {
  return { presentation: 0, application: 1, shared: 2, data: 3 }[layer] ?? 2;
}

function inferDomainFromPath(filePath: string): string | null {
  const match = filePath.match(/(?:features|domains|modules)\/([^/]+)/);
  return match?.[1] ?? null;
}
