import type { MemoryModel, Domain, ApiEndpoint, Service, Flow, ArchitectureSmell, CriticalPath } from './types.js';
import type { Capability } from './analysis/capabilities.js';
import type { DiscoveredJourney } from './analysis/journeys.js';
import { computeMemoryScore } from './report.js';
import { computeAiReadiness } from './ai-readiness.js';

export interface RepositoryDna {
  $schema: 'mnemos/dna/v3';
  repository: string;
  builtAt: string;
  architecture: {
    type: string;
    languages: Record<string, number>;
    layers: string[];
    summary: string;
  };
  repository_health_score: number;
  ai_readiness_score: number;
  health_breakdown: {
    architecture: number;
    maintainability: number;
    complexity: number;
    documentation: number;
    coupling: number;
    ai_readiness: number;
  };
  ai_recommendations: string[];
  key_metrics: {
    files: number;
    services: number;
    apis: number;
    domains: number;
    flows: number;
    journeys: number;
    memory_score: number;
    duration_ms: number;
  };
  capabilities: Array<{
    id: string;
    name: string;
    confidence: number;
    category: string;
    services: string[];
    apis: string[];
  }>;
  journeys: Array<{
    id: string;
    name: string;
    confidence: number;
    entry: string;
    actors: string[];
    outcomes: string[];
  }>;
  domains: Array<{
    name: string;
    services: number;
    apis: number;
    risk: string;
    complexity: number;
  }>;
  critical_paths: Array<{
    name: string;
    risk: string;
  }>;
  risks: Array<{
    type: string;
    severity: string;
    description: string;
  }>;
  one_liner: string;
}

export interface AgentContext {
  $schema: 'mnemos/agent-context/v2';
  repository: string;
  builtAt: string;
  purpose: string;
  how_to_use: string[];
  summary: string;
  mental_model: {
    architecture: string;
    top_capabilities: string[];
    central_domains: string[];
    user_journeys: string[];
  };
  capabilities: Array<{ id: string; name: string; purpose: string; services: string[]; apis: string[]; confidence: number }>;
  domains: Array<{ name: string; description: string; services: string[]; apis: string[]; key_files: string[] }>;
  journeys: Array<{ name: string; entry: string; steps: string[]; actors: string[]; data: string[]; outcomes: string[] }>;
  search_hints: Record<string, string[]>;
}

export interface ArchitectureJson {
  $schema: 'mnemos/architecture/v2';
  repository: string;
  builtAt: string;
  name: string;
  type: string;
  layers: string[];
  packages: string[];
  languages: Record<string, number>;
  summary: string;
  services: Array<{ id: string; name: string; domain: string | undefined; deps: number; dependents: number; exports: string[] }>;
  apis: Array<{ id: string; method: string; path: string; domain: string | undefined }>;
  dependencies: Array<{ from: string; to: string; kind: string }>;
}

export interface RepositorySummaryJson {
  $schema: 'mnemos/repository-summary/v2';
  repository: string;
  builtAt: string;
  one_liner: string;
  paragraph: string;
  bullets: string[];
  stats: MemoryModel['stats'];
  architecture: MemoryModel['architecture'];
  top_capabilities: Array<{ name: string; purpose: string; confidence: number }>;
  top_journeys: Array<{ name: string; confidence: number }>;
  top_risks: Array<{ name: string; severity: string }>;
}

export interface AgentExports {
  dna: RepositoryDna;
  context: AgentContext;
  architecture: ArchitectureJson;
  summary: RepositorySummaryJson;
  criticalPaths: CriticalPath[];
}

export interface AgentInput {
  memory: MemoryModel;
  capabilities: Capability[];
  journeys: DiscoveredJourney[];
  memoryScore: number;
}

export function buildAgentExports(input: AgentInput): AgentExports {
  const { memory, capabilities, journeys, memoryScore } = input;
  return {
    dna: buildDna(memory, capabilities, journeys, memoryScore),
    context: buildAgentContext(memory, capabilities, journeys),
    architecture: buildArchitecture(memory),
    summary: buildRepositorySummary(memory, capabilities, journeys),
    criticalPaths: memory.criticalPaths,
  };
}

function buildDna(
  memory: MemoryModel,
  capabilities: Capability[],
  journeys: DiscoveredJourney[],
  memoryScore: number,
): RepositoryDna {
  const scores = computeMemoryScore(memory);
  const aiReadiness = computeAiReadiness(memory);
  const dnaJourneys = journeys.slice(0, 8).map((j) => ({
    id: j.signature.id,
    name: j.signature.name,
    confidence: Math.round(j.confidence * 100) / 100,
    entry: j.entryRoute ?? j.entryPoint,
    actors: j.actors,
    outcomes: j.outcomes,
  }));

  const dnaCapabilities = capabilities.slice(0, 16).map((c) => ({
    id: c.signature.id,
    name: c.signature.name,
    confidence: c.confidence,
    category: c.signature.category,
    services: c.services.slice(0, 4),
    apis: c.apis.slice(0, 4),
  }));

  const domainComplexity = (d: Domain) => {
    const services = memory.services.filter((s) => s.domain === d.id || s.domain === d.name);
    const apis = memory.apis.filter((a) => a.domain === d.id || a.domain === d.name);
    return d.nodes.length + services.length * 2 + apis.length * 3;
  };

  return {
    $schema: 'mnemos/dna/v3',
    repository: memory.repository,
    builtAt: memory.builtAt,
    architecture: {
      type: memory.architecture.type,
      languages: memory.architecture.languages,
      layers: memory.architecture.layers,
      summary: memory.architecture.summary,
    },
    repository_health_score: scores.overall,
    ai_readiness_score: aiReadiness.score,
    health_breakdown: {
      architecture: scores.architectureClarity,
      maintainability: scores.coupling,
      complexity: scores.dependencyComplexity,
      documentation: scores.documentationQuality,
      coupling: scores.coupling,
      ai_readiness: aiReadiness.score,
    },
    ai_recommendations: aiReadiness.recommendations,
    key_metrics: {
      files: memory.stats.filesScanned,
      services: memory.services.length,
      apis: memory.apis.length,
      domains: memory.domains.length,
      flows: memory.flows.length,
      journeys: dnaJourneys.length,
      memory_score: memoryScore,
      duration_ms: memory.stats.durationMs,
    },
    capabilities: dnaCapabilities,
    journeys: dnaJourneys,
    domains: memory.domains.slice(0, 12).map((d) => ({
      name: d.name,
      services: memory.services.filter((s) => s.domain === d.id || s.domain === d.name).length,
      apis: memory.apis.filter((a) => a.domain === d.id || a.domain === d.name).length,
      risk: domainComplexity(d) > 50 ? 'high' : domainComplexity(d) > 20 ? 'medium' : 'low',
      complexity: domainComplexity(d),
    })),
    critical_paths: memory.criticalPaths.slice(0, 8).map((c) => ({ name: c.name, risk: c.risk })),
    risks: memory.smells.slice(0, 6).map((s) => ({
      type: s.type,
      severity: s.severity,
      description: s.description,
    })),
    one_liner: buildOneLiner(memory, capabilities, journeys),
  };
}

function buildOneLiner(
  memory: MemoryModel,
  capabilities: Capability[],
  journeys: DiscoveredJourney[],
): string {
  const top = capabilities[0];
  const journey = journeys[0];
  if (!top && !journey) {
    return `${memory.repository}: ${memory.services.length} services, ${memory.apis.length} APIs, ${memory.domains.length} domains.`;
  }
  const parts: string[] = [];
  if (top) parts.push(`centered on ${top.signature.name.toLowerCase()}`);
  if (journey) parts.push(`with a ${journey.signature.name.toLowerCase()} journey`);
  return `${memory.repository} (${memory.architecture.type.toLowerCase()}) ${parts.join(' ')}.`;
}

function buildAgentContext(
  memory: MemoryModel,
  capabilities: Capability[],
  journeys: DiscoveredJourney[],
): AgentContext {
  return {
    $schema: 'mnemos/agent-context/v2',
    repository: memory.repository,
    builtAt: memory.builtAt,
    purpose:
      'Compressed, machine-optimized representation of the repository. Use this before reading source files to form a mental model.',
    how_to_use: [
      'Read summary first to understand the project.',
      'Use search_hints to locate files for a topic (auth, payments, etc.).',
      'Inspect capabilities, journeys, and domains to know what exists.',
      'For a node, use the impact and flow tools in Mnemos CLI.',
    ],
    summary: memory.architecture.summary,
    mental_model: {
      architecture: memory.architecture.summary,
      top_capabilities: capabilities.slice(0, 5).map((c) => c.signature.name),
      central_domains: memory.domains.slice(0, 3).map((d) => d.name),
      user_journeys: journeys.slice(0, 5).map((j) => j.signature.name),
    },
    capabilities: capabilities.slice(0, 16).map((c) => ({
      id: c.signature.id,
      name: c.signature.name,
      purpose: c.signature.purpose,
      services: c.services,
      apis: c.apis,
      confidence: c.confidence,
    })),
    domains: memory.domains.slice(0, 20).map((d) => ({
      name: d.name,
      description: d.description,
      services: memory.services
        .filter((s) => s.domain === d.id || s.domain === d.name)
        .slice(0, 6)
        .map((s) => s.name),
      apis: memory.apis
        .filter((a) => a.domain === d.id || a.domain === d.name)
        .slice(0, 8)
        .map((a) => `${a.method} ${a.path}`),
      key_files: d.entryPoints.slice(0, 6),
    })),
    journeys: journeys.slice(0, 12).map((j) => ({
      name: j.signature.name,
      entry: j.entryRoute ?? j.entryPoint,
      steps: j.steps.map((s) => s.name),
      actors: j.actors,
      data: j.data,
      outcomes: j.outcomes,
    })),
    search_hints: buildSearchHints(memory, capabilities),
  };
}

function buildSearchHints(
  memory: MemoryModel,
  capabilities: Capability[],
): Record<string, string[]> {
  const hints: Record<string, string[]> = {};
  for (const c of capabilities) {
    const files = new Set<string>();
    for (const svc of memory.services.filter((s) => c.services.includes(s.name))) {
      files.add(svc.path);
    }
    if (files.size > 0) {
      hints[c.signature.id] = [...files].slice(0, 8);
    }
  }
  return hints;
}

function buildArchitecture(memory: MemoryModel): ArchitectureJson {
  return {
    $schema: 'mnemos/architecture/v2',
    repository: memory.repository,
    builtAt: memory.builtAt,
    name: memory.architecture.name,
    type: memory.architecture.type,
    layers: memory.architecture.layers,
    packages: memory.architecture.packages,
    languages: memory.architecture.languages,
    summary: memory.architecture.summary,
    services: memory.services.slice(0, 200).map((s: Service) => ({
      id: s.id,
      name: s.name,
      domain: s.domain,
      deps: s.dependencies.length,
      dependents: s.dependents.length,
      exports: s.exports.slice(0, 10),
    })),
    apis: memory.apis.slice(0, 200).map((a: ApiEndpoint) => ({
      id: a.id,
      method: a.method,
      path: a.path,
      domain: a.domain,
    })),
    dependencies: memory.dependencies.slice(0, 1000).map((d) => ({
      from: d.from,
      to: d.to,
      kind: d.kind,
    })),
  };
}

function buildRepositorySummary(
  memory: MemoryModel,
  capabilities: Capability[],
  journeys: DiscoveredJourney[],
): RepositorySummaryJson {
  const highSmells = memory.smells.filter((s: ArchitectureSmell) => s.severity === 'high');
  return {
    $schema: 'mnemos/repository-summary/v2',
    repository: memory.repository,
    builtAt: memory.builtAt,
    one_liner: buildOneLiner(memory, capabilities, journeys),
    paragraph: composeParagraph(memory, capabilities, journeys),
    bullets: buildBullets(memory, capabilities, journeys),
    stats: memory.stats,
    architecture: memory.architecture,
    top_capabilities: capabilities.slice(0, 8).map((c) => ({
      name: c.signature.name,
      purpose: c.signature.purpose,
      confidence: c.confidence,
    })),
    top_journeys: journeys.slice(0, 8).map((j) => ({
      name: j.signature.name,
      confidence: j.confidence,
    })),
    top_risks: highSmells.slice(0, 6).map((s: ArchitectureSmell) => ({ name: s.type, severity: s.severity })),
  };
}

function composeParagraph(
  memory: MemoryModel,
  capabilities: Capability[],
  journeys: DiscoveredJourney[],
): string {
  const lines: string[] = [];
  lines.push(
    `${memory.repository} is a ${memory.architecture.type.toLowerCase()} with ${memory.stats.filesScanned} source files.`,
  );
  if (capabilities.length > 0) {
    const names = capabilities
      .slice(0, 3)
      .map((c) => c.signature.name.toLowerCase())
      .join(', ');
    lines.push(`Its core capabilities include ${names}.`);
  }
  if (journeys.length > 0) {
    const names = journeys
      .slice(0, 3)
      .map((j) => j.signature.name.toLowerCase())
      .join(', ');
    lines.push(`The product supports user journeys such as ${names}.`);
  }
  if (memory.criticalPaths.length > 0) {
    lines.push(
      `${memory.criticalPaths.length} critical path${memory.criticalPaths.length > 1 ? 's' : ''} identified; the highest-risk is "${
        memory.criticalPaths[0]?.name ?? 'unknown'
      }".`,
    );
  }
  return lines.join(' ');
}

function buildBullets(
  memory: MemoryModel,
  capabilities: Capability[],
  journeys: DiscoveredJourney[],
): string[] {
  const bullets: string[] = [];
  bullets.push(`${memory.stats.filesScanned} source files indexed in ${(memory.stats.durationMs / 1000).toFixed(1)}s`);
  bullets.push(`${memory.stats.nodesCreated} nodes, ${memory.stats.edgesCreated} edges in knowledge graph`);
  bullets.push(`${memory.domains.length} domains discovered, ${memory.services.length} services, ${memory.apis.length} APIs`);
  bullets.push(`${capabilities.length} business capabilities detected, ${journeys.length} user journeys mapped`);
  bullets.push(`${memory.flows.length} execution flows, ${memory.criticalPaths.length} critical paths, ${memory.smells.length} architecture smells`);
  return bullets;
}
