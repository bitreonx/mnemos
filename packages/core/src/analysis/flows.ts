import type { Flow, FlowStep, GraphNode } from '../types.js';
import type { ParsedFile } from '../types.js';
import type { MnemosGraph } from '../graph/graph.js';
import { getNodesByKind } from '../graph/graph.js';

export function discoverFlows(graph: MnemosGraph, parsedFiles: ParsedFile[]): Flow[] {
  const flows: Flow[] = [];

  flows.push(...discoverMiddlewareFlows(graph, parsedFiles));
  flows.push(...discoverRequestFlows(graph, parsedFiles));
  flows.push(...discoverEventFlows(graph, parsedFiles));
  flows.push(...discoverDependencyFlows(graph));
  flows.push(...discoverUserJourneyFlows(graph, parsedFiles));

  return flows.sort((a, b) => b.confidence - a.confidence);
}

function discoverMiddlewareFlows(graph: MnemosGraph, parsedFiles: ParsedFile[]): Flow[] {
  const appFile = parsedFiles.find((f) => /(?:^|\/)lib[/\\]application\.(js|ts|mjs|cjs)$/.test(f.relativePath));
  if (!appFile) return [];

  const steps = traceFlowFromFile(graph, appFile, 8);
  if (steps.length < 2) return [];

  return [{
    id: 'flow:middleware:pipeline',
    name: 'HTTP Middleware Pipeline',
    type: 'request',
    confidence: 0.92,
    steps,
    entryPoint: appFile.relativePath,
    description: 'HTTP request enters the middleware chain via Application dispatch (route → handler → response)',
  }];
}

function discoverRequestFlows(graph: MnemosGraph, parsedFiles: ParsedFile[]): Flow[] {
  const flows: Flow[] = [];
  const routeFiles = parsedFiles.filter((f) => f.isRoute || f.hasUseServer);

  for (const file of routeFiles.slice(0, 100)) {
    const steps = traceFlowFromFile(graph, file, 8);
    if (steps.length < 2) continue;

    flows.push({
      id: `flow:request:${file.relativePath}`,
      name: file.routePath ?? file.relativePath,
      type: 'request',
      confidence: file.routePath ? 0.9 : 0.7,
      steps,
      entryPoint: file.relativePath,
      description: buildFlowDescription(steps, 'HTTP request'),
    });
  }

  return flows;
}

function discoverEventFlows(graph: MnemosGraph, parsedFiles: ParsedFile[]): Flow[] {
  const flows: Flow[] = [];
  const eventFiles = parsedFiles.filter(
    (f) =>
      f.relativePath.includes('/events/') ||
      f.relativePath.includes('event') ||
      f.exports.some((e) => e.toLowerCase().includes('event')),
  );

  for (const file of eventFiles.slice(0, 30)) {
    const steps = traceFlowFromFile(graph, file, 6);
    if (steps.length < 2) continue;

    flows.push({
      id: `flow:event:${file.relativePath}`,
      name: `Event: ${file.relativePath.split('/').pop()?.replace(/\.\w+$/, '') ?? 'unknown'}`,
      type: 'event',
      confidence: 0.75,
      steps,
      entryPoint: file.relativePath,
      description: buildFlowDescription(steps, 'Event propagation'),
    });
  }

  // WebSocket service detection
  const wsFiles = parsedFiles.filter((f) => f.relativePath.includes('websocket'));
  for (const file of wsFiles.slice(0, 5)) {
    flows.push({
      id: `flow:event:ws:${file.relativePath}`,
      name: 'WebSocket Event Fan-out',
      type: 'event',
      confidence: 0.85,
      steps: traceFlowFromFile(graph, file, 5),
      entryPoint: file.relativePath,
      description: 'Database notification → WebSocket gateway → client apps',
    });
  }

  return flows;
}

function discoverDependencyFlows(graph: MnemosGraph): Flow[] {
  const flows: Flow[] = [];
  const services = getNodesByKind(graph, 'service');

  for (const service of services.slice(0, 20)) {
    const deps = graph.outNeighbors(service.id).filter((n: string) => {
      const attrs = graph.getNodeAttributes(n) as GraphNode;
      return attrs.kind === 'service' || attrs.kind === 'package';
    });

    if (deps.length === 0) continue;

    const steps: FlowStep[] = [
      { nodeId: service.id, name: service.name, kind: service.kind, path: service.path },
      ...deps.slice(0, 5).map((d: string) => {
        const attrs = graph.getNodeAttributes(d) as GraphNode;
        return { nodeId: d, name: attrs.name, kind: attrs.kind, path: attrs.path };
      }),
    ];

    flows.push({
      id: `flow:dep:${service.id}`,
      name: `${service.name} dependencies`,
      type: 'dependency',
      confidence: 0.65,
      steps,
      entryPoint: service.id,
      description: `Service dependency chain from ${service.name}`,
    });
  }

  return flows;
}

function discoverUserJourneyFlows(graph: MnemosGraph, parsedFiles: ParsedFile[]): Flow[] {
  const journeys = [
    { pattern: /login|signin|auth/i, name: 'Login Flow' },
    { pattern: /register|signup/i, name: 'Registration Flow' },
    { pattern: /checkout|payment|billing/i, name: 'Checkout Flow' },
    { pattern: /pickup|guardian/i, name: 'Pickup Flow' },
    { pattern: /attendance|absence/i, name: 'Attendance Flow' },
    { pattern: /transport|bus|route/i, name: 'Transport Flow' },
  ];

  const flows: Flow[] = [];

  for (const journey of journeys) {
    const matching = parsedFiles.filter(
      (f) =>
        journey.pattern.test(f.relativePath) &&
        (f.isRoute || f.hasUseServer) &&
        !/(?:^|\/)(?:test|tests|__tests__|spec|e2e|examples?)(?:\/|$)/i.test(f.relativePath),
    );

    if (matching.length === 0) continue;

    const primary = matching[0]!;
    const steps = traceFlowFromFile(graph, primary, 10);

    flows.push({
      id: `flow:journey:${journey.name.replace(/\s/g, '_').toLowerCase()}`,
      name: journey.name,
      type: 'user_journey',
      confidence: Math.min(0.95, 0.6 + matching.length * 0.05),
      steps,
      entryPoint: primary.relativePath,
      description: `${journey.name} spanning ${matching.length} related files`,
    });
  }

  return flows;
}

function traceFlowFromFile(graph: MnemosGraph, file: ParsedFile, maxDepth: number): FlowStep[] {
  const steps: FlowStep[] = [];
  const visited = new Set<string>();
  const edgePriority: Record<string, number> = {
    DEPENDS_ON: 4,
    IMPORTS: 3,
    CALLS: 2,
    EXPOSES: 2,
    CONTAINS: 1,
    OWNS: 1,
  };

  const fileNode = [...graph.nodes()].find((id) => {
    const attrs = graph.getNodeAttributes(id);
    return attrs.kind === 'file' && attrs.path === file.relativePath;
  });

  if (!fileNode) return steps;

  const queue: Array<{ id: string; depth: number; priority: number }> = [
    { id: fileNode, depth: 0, priority: 0 },
  ];

  while (queue.length > 0) {
    queue.sort((a, b) => b.priority - a.priority || a.depth - b.depth);
    const { id, depth } = queue.shift()!;
    if (visited.has(id) || depth > maxDepth) continue;
    visited.add(id);

    const attrs = graph.getNodeAttributes(id);
    steps.push({
      nodeId: id,
      name: attrs.name,
      kind: attrs.kind,
      path: attrs.path,
    });

    for (const neighbor of graph.outNeighbors(id)) {
      const edgeKeys = graph.outEdges(id, neighbor);
      let maxPri = 0;
      for (const ek of edgeKeys) {
        const kind = graph.getEdgeAttributes(ek).kind as string;
        maxPri = Math.max(maxPri, edgePriority[kind] ?? 0);
      }
      if (maxPri > 0) {
        queue.push({ id: neighbor, depth: depth + 1, priority: maxPri });
      }
    }
  }

  return steps;
}

function buildFlowDescription(steps: FlowStep[], prefix: string): string {
  const kinds = steps.map((s) => s.kind);
  const unique = [...new Set(kinds)];
  return `${prefix}: ${steps.length} steps through ${unique.join(' → ')}`;
}

export function findFlow(flows: Flow[], query: string): Flow[] {
  const normalized = query.toLowerCase();
  return flows.filter(
    (f) =>
      f.name.toLowerCase().includes(normalized) ||
      f.type.includes(normalized) ||
      f.entryPoint.toLowerCase().includes(normalized),
  );
}
