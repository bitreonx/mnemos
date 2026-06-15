import { renderReport } from './report-template.js';
import type {
  ArchitectureSmell,
  ApiEndpoint,
  CriticalPath,
  DeadCodeEntry,
  Flow,
  MemoryModel,
  Service,
} from './types.js';
import type { Capability as EngineCapability } from './analysis/capabilities.js';
import type { DiscoveredJourney as EngineJourney } from './analysis/journeys.js';

export { renderReport } from './report-template.js';

export type Risk = 'low' | 'medium' | 'high';

export interface Capability {
  id: string;
  name: string;
  purpose: string;
  category: string;
  keyResponsibilities: string[];
  connectedSystems: string[];
  complexity: Risk;
  risk: Risk;
  domainIds: string[];
  confidence: number;
  services: string[];
  apis: string[];
  evidence: string[];
  reasons: string[];
}

export interface Journey {
  id: string;
  name: string;
  purpose: string;
  actors: string[];
  systems: string[];
  data: string[];
  outcomes: string[];
  preconditions: string[];
  confidence: number;
  entryPoint: string;
  entryRoute?: string;
  steps: { name: string; kind: string; path?: string }[];
  reason: string;
}

export interface DomainView {
  id: string;
  name: string;
  description: string;
  nodeCount: number;
  complexityScore: number;
  couplingScore: number;
  keyApis: ApiEndpoint[];
  services: Service[];
  dependencies: string[];
  risk: Risk;
  confidence: number;
}

export interface MemoryScore {
  overall: number;
  discoverability: number;
  architectureClarity: number;
  coupling: number;
  documentationQuality: number;
  dependencyComplexity: number;
}

export interface ArchitectureStory {
  summary: string;
  highlights: string[];
}

export interface ReportData {
  repository: string;
  builtAt: string;
  stats: MemoryModel['stats'];
  architecture: MemoryModel['architecture'];
  memoryScore: MemoryScore;
  story: ArchitectureStory;
  capabilities: Capability[];
  journeys: Journey[];
  domains: DomainView[];
  flows: Flow[];
  criticalPaths: CriticalPath[];
  smells: ArchitectureSmell[];
  deadCode: DeadCodeEntry[];
}

export function generateReport(memory: MemoryModel): string {
  return renderReport(buildReportData(memory));
}

export function computeMemoryScore(memory: MemoryModel): MemoryScore {
  // implementation below
  return _computeMemoryScore(memory);
}

export function buildReportData(memory: MemoryModel): ReportData {
  const memoryScore = computeMemoryScore(memory);
  return {
    repository: memory.repository,
    builtAt: memory.builtAt,
    stats: memory.stats,
    architecture: memory.architecture,
    memoryScore,
    story: buildStory(memory),
    capabilities: (memory.capabilities ?? []).map(toReportCapability),
    journeys: (memory.journeys ?? []).map(toReportJourney),
    domains: deriveDomainViews(memory),
    flows: memory.flows,
    criticalPaths: memory.criticalPaths,
    smells: memory.smells,
    deadCode: memory.deadCode,
  };
}

function toReportCapability(c: EngineCapability): Capability {
  const responsibilities = buildResponsibilities(c);
  return {
    id: c.id,
    name: c.signature.name,
    purpose: c.signature.purpose,
    category: c.signature.category,
    keyResponsibilities: responsibilities,
    connectedSystems: c.apis.slice(0, 4),
    complexity: deriveCapabilityComplexity(c),
    risk: deriveCapabilityRisk(c),
    domainIds: c.domains,
    confidence: c.confidence,
    services: c.services,
    apis: c.apis,
    evidence: c.evidence,
    reasons: c.reasons,
  };
}

function toReportJourney(j: EngineJourney): Journey {
  return {
    id: j.id,
    name: j.signature.name,
    purpose: j.signature.purpose,
    actors: j.actors,
    systems: j.systems,
    data: j.data,
    outcomes: j.outcomes,
    preconditions: j.preconditions,
    confidence: j.confidence,
    entryPoint: j.entryPoint,
    entryRoute: j.entryRoute,
    steps: j.steps.map((s) => ({ name: s.name, kind: s.kind, path: s.path })),
    reason: j.reason,
  };
}

function buildResponsibilities(c: EngineCapability): string[] {
  const out: string[] = [];
  if (c.services.length > 0) {
    out.push(`${c.services.length} service${c.services.length === 1 ? '' : 's'}: ${c.services.slice(0, 3).join(', ')}`);
  }
  if (c.apis.length > 0) {
    out.push(`${c.apis.length} endpoint${c.apis.length === 1 ? '' : 's'} exposed`);
  }
  out.push(c.signature.purpose);
  if (c.domains.length > 0) {
    out.push(`Spans domain${c.domains.length === 1 ? '' : 's'}: ${c.domains.join(', ')}`);
  }
  return out.slice(0, 5);
}

function deriveCapabilityComplexity(c: EngineCapability): Risk {
  const weight = c.services.length + c.apis.length;
  if (weight > 8) return 'high';
  if (weight > 3) return 'medium';
  return 'low';
}

function deriveCapabilityRisk(c: EngineCapability): Risk {
  if (c.confidence < 0.4) return 'high';
  if (c.services.length === 0) return 'medium';
  return 'low';
}

function _computeMemoryScore(memory: MemoryModel): MemoryScore {
  const servicesWithDomain = memory.services.filter((s) => s.domain).length;
  const discoverability = memory.services.length > 0
    ? Math.round((servicesWithDomain / memory.services.length) * 100)
    : 100;

  const highSmells = memory.smells.filter((s) => s.severity === 'high').length;
  const medSmells = memory.smells.filter((s) => s.severity === 'medium').length;
  const smellPenalty = highSmells * 8 + medSmells * 3;
  const architectureClarity = Math.max(0, Math.min(100, 100 - smellPenalty));

  const avgDeps = memory.services.length > 0
    ? memory.services.reduce((sum, s) => sum + s.dependencies.length, 0) / memory.services.length
    : 0;
  const coupling = Math.max(0, Math.min(100, Math.round(100 - avgDeps * 4)));

  const domainsWithDesc = memory.domains.filter((d) => d.description && d.description.length > 20).length;
  const documentationQuality = memory.domains.length > 0
    ? Math.round((domainsWithDesc / memory.domains.length) * 100)
    : 100;

  const serviceDomainById = new Map(memory.services.map((s) => [s.id, s.domain]));
  const crossDomainDeps = memory.dependencies.filter((d) => {
    const fromDomain = serviceDomainById.get(d.from);
    const toDomain = serviceDomainById.get(d.to);
    return fromDomain && toDomain && fromDomain !== toDomain;
  }).length;
  const dependencyComplexity = Math.max(0, Math.min(100, Math.round(100 - crossDomainDeps * 1.5)));

  const overall = Math.round(
    discoverability * 0.25 +
      architectureClarity * 0.25 +
      coupling * 0.2 +
      documentationQuality * 0.15 +
      dependencyComplexity * 0.15,
  );

  return {
    overall,
    discoverability,
    architectureClarity,
    coupling,
    documentationQuality,
    dependencyComplexity,
  };
}

function deriveDomainViews(memory: MemoryModel): DomainView[] {
  return memory.domains.map((domain) => {
    const services = memory.services.filter(
      (s) => s.domain === domain.id || s.domain === domain.name,
    );
    const apis = memory.apis.filter(
      (a) => a.domain === domain.id || a.domain === domain.name,
    );
    const totalDeps = services.reduce((sum, s) => sum + s.dependencies.length, 0);
    const coupling = services.length > 0 ? totalDeps / services.length : 0;
    const complexity = domain.nodes.length + services.length * 2 + apis.length * 3;

    return {
      id: domain.id,
      name: domain.name,
      description: domain.description,
      nodeCount: domain.nodes.length,
      complexityScore: complexity,
      couplingScore: Math.round(coupling * 10) / 10,
      keyApis: apis.slice(0, 10),
      services: services.slice(0, 10),
      dependencies: [...new Set(services.flatMap((s) => s.dependencies))].slice(0, 10),
      risk: complexity > 50 ? 'high' : complexity > 20 ? 'medium' : 'low',
      confidence: domain.confidence,
    };
  });
}

export function buildStory(memory: MemoryModel): ArchitectureStory {
  const highlights: string[] = [];
  const capabilities = memory.capabilities ?? [];
  const journeys = memory.journeys ?? [];

  const centrality = memory.domains.map((d) => {
    const services = memory.services.filter(
      (s) => s.domain === d.id || s.domain === d.name,
    );
    const depCount = services.reduce((sum, s) => sum + s.dependencies.length, 0);
    return { domain: d, services: services.length, deps: depCount };
  });

  const mostCentral = [...centrality].sort((a, b) => b.deps - a.deps)[0];

  const domainCount = memory.domains.length;
  const domainWord = domainCount === 1 ? 'domain' : 'domains';
  let summary = `${memory.repository} is a ${memory.architecture.type.toLowerCase()} with ${memory.stats.filesScanned} source files, ${memory.services.length} services, and ${memory.apis.length} APIs.`;

  if (mostCentral && mostCentral.deps > 0) {
    summary += ` The most central domain is **${mostCentral.domain.name}**`;
    const others = centrality
      .filter((d) => d.domain.id !== mostCentral.domain.id && d.deps > 0)
      .slice(0, 3)
      .map((d) => d.domain.name);
    if (others.length > 0) {
      summary += `, which interacts with ${others.join(', ')}`;
    }
    summary += '.';
  }

  if (capabilities.length > 0) {
    const top = capabilities.slice(0, 3).map((c) => c.signature.name).join(', ');
    summary += ` Core capabilities: ${top}.`;
  }

  if (journeys.length > 0) {
    const top = journeys.slice(0, 3).map((j) => j.signature.name).join(', ');
    summary += ` User journeys discovered: ${top}.`;
  }

  if (memory.criticalPaths.length > 0) {
    summary += ` ${memory.criticalPaths.length} critical path${memory.criticalPaths.length > 1 ? 's' : ''} detected.`;
  }

  const highSmells = memory.smells.filter((s) => s.severity === 'high').length;
  if (highSmells > 0) {
    summary += ` ${highSmells} high-severity architecture smell${highSmells > 1 ? 's' : ''} flagged.`;
  }

  for (const c of capabilities.slice(0, 5)) {
    highlights.push(`${c.signature.name} — confidence ${(c.confidence * 100).toFixed(0)}%`);
  }

  return { summary, highlights };
}
