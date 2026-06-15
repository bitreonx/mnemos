import type { DeadCodeEntry, GraphEdge, GraphNode } from '../types.js';
import type { MnemosGraph } from '../graph/graph.js';

const ENTRY_POINT_PATTERNS = [
  /\/index\.(tsx?|jsx?|mjs|cjs)$/,
  /\/main\.(tsx?|jsx?|ts|js)$/,
  /\/app\.(tsx?|jsx?)$/,
  /\/_app\.(tsx?|jsx?)$/,
  /\/layout\.(tsx?|jsx?)$/,
  /\/page\.(tsx?|jsx?)$/,
  /\/route\.(tsx?|jsx?)$/,
  /\/middleware\.(tsx?|ts)$/,
  /\/server\.(tsx?|ts)$/,
  /\/cli\.(tsx?|ts)$/,
  /\/bin\//,
  /\/cmd\//,
  /\/main\.go$/,
  /\/__init__\.py$/,
  /\/manage\.py$/,
];

function isEntryPoint(attrs: GraphNode): boolean {
  if (attrs.metadata?.isRoute || attrs.metadata?.hasUseServer) return true;
  const p = attrs.path ?? attrs.name;
  return ENTRY_POINT_PATTERNS.some((re) => re.test(p));
}

export function detectDeadCode(graph: MnemosGraph): DeadCodeEntry[] {
  const dead: DeadCodeEntry[] = [];

  graph.forEachNode((id: string, attrs: GraphNode) => {
    if (!['function', 'class', 'interface', 'type'].includes(attrs.kind)) return;

    const inDegree = graph.inDegree(id);
    const isExported = attrs.metadata?.exported === true;
    const hasIncomingCalls = graph.someInEdge(id, (_e: string, edgeAttrs: GraphEdge) => edgeAttrs.kind === 'CALLS');
    const hasIncomingImports = graph.someInEdge(id, (_e: string, edgeAttrs: GraphEdge) => edgeAttrs.kind === 'IMPORTS');

    if (inDegree === 0 && !isExported) {
      dead.push({
        nodeId: id,
        name: attrs.name,
        kind: attrs.kind,
        path: attrs.path,
        confidence: 0.9,
        reason: 'Never referenced and not exported',
      });
      return;
    }

    if (isExported && !hasIncomingCalls && !hasIncomingImports && inDegree <= 1) {
      dead.push({
        nodeId: id,
        name: attrs.name,
        kind: attrs.kind,
        path: attrs.path,
        confidence: 0.55,
        reason: 'Exported but never imported or called within analyzed scope',
      });
    }
  });

  graph.forEachNode((id: string, attrs: GraphNode) => {
    if (attrs.kind !== 'file') return;
    if (attrs.metadata?.isRoute || attrs.metadata?.isTest || isEntryPoint(attrs)) return;

    const importers = graph.inNeighbors(id).filter((n: string) =>
      graph.inEdges(n, id).some((edgeKey) => (graph.getEdgeAttributes(edgeKey) as GraphEdge).kind === 'IMPORTS'),
    );

    if (importers.length === 0 && graph.outDegree(id) === 0) {
      dead.push({
        nodeId: id,
        name: attrs.name,
        kind: 'file',
        path: attrs.path,
        confidence: 0.45,
        reason: 'File has no imports or dependents (may be dynamically loaded)',
      });
    }
  });

  return dead.sort((a, b) => b.confidence - a.confidence);
}
