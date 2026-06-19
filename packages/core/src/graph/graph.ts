import Graph from 'graphology';
import type { AbstractGraph } from 'graphology-types';
import type { EdgeKind, GraphEdge, GraphNode, NodeKind } from '../types.js';
import { computeEdgeConfidence } from './edge-confidence.js';

export type MnemosGraph = AbstractGraph<GraphNode, GraphEdge>;

export function createGraph(): MnemosGraph {
  return new (Graph as unknown as { new (options?: object): MnemosGraph })({
    multi: true,
    type: 'directed',
  });
}

export function nodeId(kind: NodeKind, identifier: string): string {
  return `${kind}:${identifier}`;
}

export function addNode(
  graph: MnemosGraph,
  kind: NodeKind,
  name: string,
  opts: { path?: string; language?: string; metadata?: Record<string, unknown> } = {},
): string {
  const id = nodeId(kind, opts.path ?? name);
  if (!graph.hasNode(id)) {
    graph.addNode(id, { id, kind, name, ...opts });
  }
  return id;
}

export function addEdge(
  graph: MnemosGraph,
  source: string,
  target: string,
  kind: EdgeKind,
  metadata?: Record<string, unknown>,
  language?: string,
): void {
  if (!graph.hasNode(source) || !graph.hasNode(target)) return;
  const edgeId = `${source}->${target}:${kind}`;
  if (!graph.hasEdge(edgeId)) {
    const confidence = computeEdgeConfidence(kind, metadata, language);
    graph.addEdgeWithKey(edgeId, source, target, {
      id: edgeId,
      source,
      target,
      kind,
      metadata,
      confidence,
    });
  }
}

export function getNodesByKind(graph: MnemosGraph, kind: NodeKind): GraphNode[] {
  const cacheKey = `${kind}`;
  let byKind = nodesByKindCache.get(graph);
  if (!byKind) {
    byKind = new Map();
    nodesByKindCache.set(graph, byKind);
  }
  const cached = byKind.get(cacheKey);
  if (cached) return cached;

  const nodes: GraphNode[] = [];
  graph.forEachNode((_node: string, attrs: GraphNode) => {
    if (attrs.kind === kind) nodes.push(attrs);
  });
  byKind.set(cacheKey, nodes);
  return nodes;
}

const nodesByKindCache = new WeakMap<MnemosGraph, Map<string, GraphNode[]>>();

export function getNeighbors(
  graph: MnemosGraph,
  nodeId: string,
  edgeKind?: EdgeKind,
  direction: 'in' | 'out' | 'both' = 'both',
): GraphNode[] {
  const neighbors: GraphNode[] = [];
  const seen = new Set<string>();

  const collect = (id: string, dir: 'in' | 'out') => {
    const neighborIds = dir === 'out' ? graph.outNeighbors(id) : graph.inNeighbors(id);
    for (const nId of neighborIds) {
      if (seen.has(nId)) continue;
      const edgeKeys = dir === 'out' ? graph.outEdges(id, nId) : graph.inEdges(nId, id);
      if (edgeKeys.length === 0) continue;
      const edge = graph.getEdgeAttributes(edgeKeys[0]!) as GraphEdge;
      if (edgeKind && edge.kind !== edgeKind) continue;
      seen.add(nId);
      neighbors.push(graph.getNodeAttributes(nId) as GraphNode);
    }
  };

  if (direction === 'out' || direction === 'both') collect(nodeId, 'out');
  if (direction === 'in' || direction === 'both') collect(nodeId, 'in');

  return neighbors;
}

export function shortestPath(
  graph: MnemosGraph,
  fromId: string,
  toId: string,
  maxDepth = 20,
): string[] | undefined {
  if (fromId === toId) return [fromId];
  if (!graph.hasNode(fromId) || !graph.hasNode(toId)) return undefined;

  const queue: Array<{ id: string; path: string[] }> = [{ id: fromId, path: [fromId] }];
  const visited = new Set<string>([fromId]);

  while (queue.length > 0) {
    const { id, path: currentPath } = queue.shift()!;
    if (currentPath.length > maxDepth) continue;

    for (const neighbor of graph.outNeighbors(id)) {
      if (neighbor === toId) return [...currentPath, neighbor];
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      queue.push({ id: neighbor, path: [...currentPath, neighbor] });
    }
  }

  // Try reverse direction (undirected fallback for dependency graphs)
  const reverseQueue: Array<{ id: string; path: string[] }> = [{ id: fromId, path: [fromId] }];
  const reverseVisited = new Set<string>([fromId]);

  while (reverseQueue.length > 0) {
    const { id, path: currentPath } = reverseQueue.shift()!;
    if (currentPath.length > maxDepth) continue;

    for (const neighbor of [...graph.outNeighbors(id), ...graph.inNeighbors(id)]) {
      if (neighbor === toId) return [...currentPath, neighbor];
      if (reverseVisited.has(neighbor)) continue;
      reverseVisited.add(neighbor);
      reverseQueue.push({ id: neighbor, path: [...currentPath, neighbor] });
    }
  }

  return undefined;
}

function bfsReachable(
  graph: MnemosGraph,
  startId: string,
  maxDepth: number,
  direction: 'out' | 'in',
): Map<string, string[]> {
  const paths = new Map<string, string[]>();
  const queue: Array<{ id: string; path: string[] }> = [{ id: startId, path: [startId] }];
  const visited = new Set<string>([startId]);

  while (queue.length > 0) {
    const { id, path: currentPath } = queue.shift()!;
    if (currentPath.length > maxDepth) continue;

    const neighbors = direction === 'out' ? graph.outNeighbors(id) : graph.inNeighbors(id);
    for (const neighbor of neighbors) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      const newPath = [...currentPath, neighbor];
      paths.set(neighbor, newPath);
      queue.push({ id: neighbor, path: newPath });
    }
  }

  return paths;
}

export function bfsPaths(
  graph: MnemosGraph,
  startId: string,
  maxDepth = 6,
): Map<string, string[]> {
  return bfsReachable(graph, startId, maxDepth, 'out');
}

export function reverseBfsPaths(
  graph: MnemosGraph,
  startId: string,
  maxDepth = 6,
): Map<string, string[]> {
  return bfsReachable(graph, startId, maxDepth, 'in');
}

export function toSerializable(graph: MnemosGraph): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  graph.forEachNode((_node: string, attrs: GraphNode) => nodes.push({ ...attrs }));
  graph.forEachEdge((_edge: string, attrs: GraphEdge) => edges.push({ ...attrs }));

  return { nodes, edges };
}

export function fromSerializable(data: { nodes: GraphNode[]; edges: GraphEdge[] }): MnemosGraph {
  const graph = createGraph();
  for (const node of data.nodes) {
    if (!graph.hasNode(node.id)) {
      graph.addNode(node.id, { ...node });
    }
  }
  for (const edge of data.edges) {
    if (!graph.hasNode(edge.source) || !graph.hasNode(edge.target)) continue;
    const edgeId = edge.id || `${edge.source}->${edge.target}:${edge.kind}`;
    if (!graph.hasEdge(edgeId)) {
      graph.addEdgeWithKey(edgeId, edge.source, edge.target, { ...edge, id: edgeId });
    }
  }
  return graph;
}

export function fanIn(graph: MnemosGraph, nodeId: string): number {
  return graph.inDegree(nodeId);
}

export function fanOut(graph: MnemosGraph, nodeId: string): number {
  return graph.outDegree(nodeId);
}

export function findCycles(graph: MnemosGraph, maxCycles = 20): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const stack = new Set<string>();

  const dfs = (node: string, path: string[]): void => {
    if (cycles.length >= maxCycles) return;
    visited.add(node);
    stack.add(node);

    for (const neighbor of graph.outNeighbors(node)) {
      if (stack.has(neighbor)) {
        const cycleStart = path.indexOf(neighbor);
        if (cycleStart >= 0) {
          cycles.push([...path.slice(cycleStart), neighbor]);
        }
      } else if (!visited.has(neighbor)) {
        dfs(neighbor, [...path, neighbor]);
      }
    }

    stack.delete(node);
  };

  graph.forEachNode((node: string) => {
    if (!visited.has(node)) dfs(node, [node]);
  });

  return cycles;
}
