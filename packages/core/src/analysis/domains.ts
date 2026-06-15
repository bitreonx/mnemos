import type { Domain } from '../types.js';
import type { MnemosGraph } from '../graph/graph.js';
import { getNodesByKind } from '../graph/graph.js';
import { formatDomainName } from '../scanner/index.js';

export function discoverDomains(graph: MnemosGraph): Domain[] {
  const pathDomains = discoverPathBasedDomains(graph);
  const clusterDomains = discoverClusterDomains(graph);

  return mergeDomains(pathDomains, clusterDomains);
}

function discoverPathBasedDomains(graph: MnemosGraph): Domain[] {
  const domainMap = new Map<string, Set<string>>();

  graph.forEachNode((id: string, attrs: { metadata?: Record<string, unknown> }) => {
    const hint = attrs.metadata?.domainHint as string | undefined;
    if (!hint) return;
    if (!domainMap.has(hint)) domainMap.set(hint, new Set());
    domainMap.get(hint)!.add(id);
  });

  return [...domainMap.entries()].map(([name, nodes], i) => ({
    id: `domain:path:${i}`,
    name,
    confidence: 0.85,
    nodes: [...nodes],
    description: `Feature module detected from directory structure: ${name}`,
    entryPoints: findEntryPoints(graph, [...nodes]),
  }));
}

function discoverClusterDomains(graph: MnemosGraph): Domain[] {
  const fileNodes = getNodesByKind(graph, 'file').filter((n) => {
    const p = (n.path ?? n.name).replace(/\\/g, '/');
    return !/(?:^|\/)(?:test|tests|__tests__|spec|e2e|examples?|fixtures?)(?:\/|$)/i.test(p);
  });
  if (fileNodes.length < 3) return [];

  const fileIds = fileNodes.map((n) => n.id);
  const idSet = new Set(fileIds);

  const subgraph = graph.copy();
  subgraph.forEachNode((node: string) => {
    if (!idSet.has(node)) subgraph.dropNode(node);
  });

  if (subgraph.order < 3) return [];

  try {
    const communities = labelPropagation(subgraph);
    const groups = new Map<number, string[]>();

    for (const [nodeId, community] of Object.entries(communities)) {
      if (!groups.has(community)) groups.set(community, []);
      groups.get(community)!.push(nodeId);
    }

    return [...groups.entries()]
      .filter(([, nodes]) => nodes.length >= 2)
      .map(([community, nodes], i) => {
        const name = inferDomainName(graph, nodes);
        return {
          id: `domain:cluster:${community}`,
          name,
          confidence: Math.min(0.95, 0.5 + nodes.length * 0.02),
          nodes,
          description: `Import-graph cluster of ${nodes.length} files`,
          entryPoints: findEntryPoints(graph, nodes),
        };
      });
  } catch {
    return [];
  }
}

function inferDomainName(graph: MnemosGraph, nodeIds: string[]): string {
  const pkgSegments: string[] = [];
  const pathSegments: string[] = [];
  const SKIP = new Set(['src', 'app', 'lib', 'server', 'features', 'components', 'hooks', 'packages', 'sample', 'integration', 'test', 'tests', 'spec', 'e2e', 'examples', 'example', 'fixtures', 'mocks', 'acceptance']);

  for (const id of nodeIds) {
    const attrs = graph.getNodeAttributes(id);
    if (!attrs.path) continue;
    const parts = attrs.path.replace(/\\/g, '/').split('/');
    const pkgIdx = parts.indexOf('packages');
    if (pkgIdx >= 0 && parts[pkgIdx + 1] && !SKIP.has(parts[pkgIdx + 1]!)) {
      pkgSegments.push(parts[pkgIdx + 1]!);
    }
    for (const part of parts) {
      if (SKIP.has(part)) continue;
      if (part.includes('.')) continue;
      pathSegments.push(part);
    }
  }

  const pkgFreq = countFreq(pkgSegments);
  if (pkgFreq.length > 0) {
    return formatDomainName(pkgFreq[0]![0]);
  }

  const freq = countFreq(pathSegments);
  if (freq.length > 0) {
    return formatDomainName(freq[0]![0]);
  }

  return 'General';
}

function countFreq(items: string[]): Array<[string, number]> {
  const freq = new Map<string, number>();
  for (const item of items) {
    freq.set(item, (freq.get(item) ?? 0) + 1);
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]);
}

function findEntryPoints(graph: MnemosGraph, nodeIds: string[]): string[] {
  const idSet = new Set(nodeIds);
  const entries: string[] = [];

  for (const id of nodeIds) {
    const attrs = graph.getNodeAttributes(id);
    if (attrs.metadata?.isRoute || attrs.metadata?.hasUseServer) {
      entries.push(id);
      continue;
    }

    const hasExternalImport = graph.someInEdge(id, (_edge: string, _attrs: unknown, source: string) => !idSet.has(source));
    if (!hasExternalImport && graph.outDegree(id) > 0) {
      entries.push(id);
    }
  }

  return entries.slice(0, 10);
}

function mergeDomains(pathDomains: Domain[], clusterDomains: Domain[]): Domain[] {
  const merged = new Map<string, Domain>();

  for (const d of pathDomains) {
    merged.set(d.name.toLowerCase(), d);
  }

  for (const d of clusterDomains) {
    const key = d.name.toLowerCase();
    const existing = merged.get(key);
    if (existing) {
      const combined = new Set([...existing.nodes, ...d.nodes]);
      merged.set(key, {
        ...existing,
        nodes: [...combined],
        confidence: Math.max(existing.confidence, d.confidence),
        description: `${existing.description}; reinforced by import clustering`,
      });
    } else if (d.nodes.length >= 3) {
      merged.set(key, d);
    }
  }

  return [...merged.values()].sort((a, b) => b.nodes.length - a.nodes.length);
}

function labelPropagation(graph: MnemosGraph): Record<string, number> {
  const labels = new Map<string, number>();
  let nextLabel = 0;

  graph.forEachNode((node: string) => {
    labels.set(node, nextLabel++);
  });

  const nodes = graph.nodes();
  for (let iter = 0; iter < 25; iter++) {
    let changed = false;
    const shuffled = [...nodes].sort(() => Math.random() - 0.5);

    for (const node of shuffled) {
      const neighborLabels = new Map<number, number>();
      for (const neighbor of graph.outNeighbors(node)) {
        const label = labels.get(neighbor)!;
        neighborLabels.set(label, (neighborLabels.get(label) ?? 0) + 2);
      }
      for (const neighbor of graph.inNeighbors(node)) {
        const label = labels.get(neighbor)!;
        neighborLabels.set(label, (neighborLabels.get(label) ?? 0) + 1);
      }
      if (neighborLabels.size === 0) continue;

      const best = [...neighborLabels.entries()].sort((a, b) => b[1] - a[1])[0]![0];
      if (labels.get(node) !== best) {
        labels.set(node, best);
        changed = true;
      }
    }
    if (!changed) break;
  }

  const result: Record<string, number> = {};
  for (const [node, label] of labels) {
    result[node] = label;
  }
  return result;
}

export function findDomain(domains: Domain[], query: string): Domain | undefined {
  const normalized = query.toLowerCase();
  return domains.find(
    (d) =>
      d.name.toLowerCase().includes(normalized) ||
      d.id.toLowerCase().includes(normalized),
  );
}
