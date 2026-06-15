import type { Capability } from '../analysis/capabilities.js';
import type { DiscoveredJourney } from '../analysis/journeys.js';
import type {
  ApiEndpoint,
  ArchitectureModel,
  CriticalPath,
  DependencyEntry,
  Domain,
  Flow,
  GraphEdge,
  GraphNode,
  MemoryModel,
  Service,
} from '../types.js';
import type { ParsedFile } from '../types.js';
import type { MnemosGraph } from '../graph/graph.js';
import { getNodesByKind } from '../graph/graph.js';
import type { DeadCodeEntry } from '../types.js';
import type { ArchitectureSmell } from '../types.js';

export function buildArchitectureModel(
  repoName: string,
  parsedFiles: ParsedFile[],
  packages: string[],
): ArchitectureModel {
  const languages: Record<string, number> = {};
  for (const f of parsedFiles) {
    languages[f.language] = (languages[f.language] ?? 0) + 1;
  }

  const layers = new Set<string>();
  for (const f of parsedFiles) {
    if (f.relativePath.includes('/app/')) layers.add('Presentation (App Router)');
    if (f.relativePath.includes('/server/')) layers.add('Server Layer');
    if (f.relativePath.includes('/db/') || f.relativePath.includes('/supabase/')) layers.add('Data Layer');
    if (f.relativePath.includes('/shared/')) layers.add('Shared Contracts');
    if (f.relativePath.includes('/components/')) layers.add('UI Components');
    if (f.relativePath.includes('/features/')) layers.add('Feature Modules');
  }

  const type = packages.length > 1 ? 'Monorepo' : 'Single Package';

  return {
    name: repoName,
    type,
    layers: [...layers],
    packages,
    languages,
    summary: `${type} with ${parsedFiles.length} source files across ${Object.keys(languages).join(', ')}. ${packages.length} packages detected.`,
  };
}

export function extractServices(graph: MnemosGraph, domains: Domain[]): Service[] {
  const services: Service[] = [];
  const serviceNodes = getNodesByKind(graph, 'service');

  for (const svc of serviceNodes) {
    const owned = graph.outNeighbors(svc.id);
    const deps = new Set<string>();
    const dependents = new Set<string>();

    for (const ownedId of owned) {
      for (const neighbor of graph.outNeighbors(ownedId)) {
        const nAttrs = graph.getNodeAttributes(neighbor);
        if (nAttrs.kind === 'service' || nAttrs.kind === 'package') {
          deps.add(nAttrs.name);
        }
      }
      for (const neighbor of graph.inNeighbors(ownedId)) {
        const nAttrs = graph.getNodeAttributes(neighbor);
        if (nAttrs.kind === 'service' || nAttrs.kind === 'package') {
          dependents.add(nAttrs.name);
        }
      }
    }

    const domain = domains.find((d) => d.nodes.some((n) => owned.includes(n)))?.name;

    services.push({
      id: svc.id,
      name: svc.name,
      path: svc.path ?? svc.name,
      domain,
      exports: owned
        .filter((id: string) => (graph.getNodeAttributes(id) as GraphNode).kind === 'function')
        .map((id: string) => (graph.getNodeAttributes(id) as GraphNode).name)
        .slice(0, 20),
      dependencies: [...deps],
      dependents: [...dependents],
    });
  }

  return services.sort((a, b) => b.dependencies.length - a.dependencies.length);
}

export function extractApis(graph: MnemosGraph, domains: Domain[]): ApiEndpoint[] {
  const apis: ApiEndpoint[] = [];
  const apiNodes = getNodesByKind(graph, 'api');

  for (const api of apiNodes) {
    const domain = domains.find((d) => d.nodes.includes(api.id))?.name;

    apis.push({
      id: api.id,
      method: inferMethod(api.path ?? ''),
      path: api.metadata?.routePath as string ?? api.name,
      handler: api.path ?? api.name,
      file: api.path ?? '',
      domain,
    });
  }

  // Also route nodes
  const routeNodes = getNodesByKind(graph, 'route');
  for (const route of routeNodes) {
    if (apis.some((a) => a.path === route.name)) continue;
    apis.push({
      id: route.id,
      method: 'GET',
      path: route.name,
      handler: route.path ?? route.name,
      file: route.path?.split(':')[0] ?? '',
    });
  }

  return apis.sort((a, b) => a.path.localeCompare(b.path));
}

function inferMethod(filePath: string): string {
  if (filePath.includes('route.ts') || filePath.includes('route.tsx')) return 'API';
  return 'PAGE';
}

export function extractDependencies(graph: MnemosGraph): DependencyEntry[] {
  const deps: DependencyEntry[] = [];

  graph.forEachEdge((_edge: string, attrs: GraphEdge, source: string, target: string) => {
    if (['IMPORTS', 'DEPENDS_ON', 'CALLS'].includes(attrs.kind)) {
      deps.push({
        from: (graph.getNodeAttributes(source) as GraphNode).name,
        to: (graph.getNodeAttributes(target) as GraphNode).name,
        kind: attrs.kind,
        weight: 1,
      });
    }
  });

  return deps;
}

export function extractCriticalPaths(graph: MnemosGraph, flows: Flow[]): CriticalPath[] {
  const paths: CriticalPath[] = [];

  // High fan-in nodes are critical
  graph.forEachNode((id: string, attrs: GraphNode) => {
    const fi = graph.inDegree(id);
    if (fi >= 10) {
      paths.push({
        id: `critical:fanin:${id}`,
        name: `High-traffic: ${attrs.name}`,
        nodes: [id, ...graph.inNeighbors(id).slice(0, 5)],
        risk: fi >= 20 ? 'high' : 'medium',
        description: `${attrs.name} has ${fi} dependents — changes here have wide blast radius`,
      });
    }
  });

  // User journey flows are critical paths
  for (const flow of flows.filter((f) => f.type === 'user_journey').slice(0, 5)) {
    paths.push({
      id: `critical:journey:${flow.id}`,
      name: flow.name,
      nodes: flow.steps.map((s) => s.nodeId),
      risk: 'high',
      description: flow.description,
    });
  }

  return paths.slice(0, 20);
}

export function assembleMemoryModel(
  repoName: string,
  graph: MnemosGraph,
  parsedFiles: ParsedFile[],
  packages: string[],
  domains: Domain[],
  flows: Flow[],
  deadCode: DeadCodeEntry[],
  smells: ArchitectureSmell[],
  stats: MemoryModel['stats'],
  capabilities: Capability[],
  journeys: DiscoveredJourney[],
): MemoryModel {
  return {
    repository: repoName,
    builtAt: new Date().toISOString(),
    stats,
    architecture: buildArchitectureModel(repoName, parsedFiles, packages),
    domains,
    flows,
    services: extractServices(graph, domains),
    apis: extractApis(graph, domains),
    dependencies: extractDependencies(graph).slice(0, 5000),
    criticalPaths: extractCriticalPaths(graph, flows),
    deadCode: deadCode.slice(0, 200),
    smells: smells.slice(0, 50),
    capabilities,
    journeys,
  };
}
