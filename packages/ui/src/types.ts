export interface MemoryModel {
  repository: string;
  builtAt: string;
  stats: {
    filesScanned: number;
    nodesCreated: number;
    edgesCreated: number;
    domainsFound: number;
    flowsFound: number;
    durationMs: number;
  };
  architecture: {
    name: string;
    type: string;
    layers: string[];
    packages: string[];
    languages: Record<string, number>;
    summary: string;
  };
  domains: Domain[];
  flows: Flow[];
  services: Service[];
  apis: ApiEndpoint[];
  smells: Smell[];
  criticalPaths: CriticalPath[];
  capabilities?: Capability[];
  journeys?: DiscoveredJourney[];
  dependencies?: DependencyEntry[];
  deadCode?: DeadCodeEntry[];
}

export interface DependencyEntry {
  from: string;
  to: string;
  kind: string;
}

export interface DeadCodeEntry {
  nodeId: string;
  name: string;
  kind: string;
  path?: string;
  confidence: number;
  reason: string;
}

export interface Domain {
  id: string;
  name: string;
  confidence: number;
  nodes: string[];
  description: string;
  entryPoints: string[];
}

export interface Flow {
  id: string;
  name: string;
  type: string;
  confidence: number;
  steps: Array<{ nodeId: string; name: string; kind: string; path?: string }>;
  entryPoint: string;
  description: string;
}

export interface Service {
  id: string;
  name: string;
  path: string;
  domain?: string;
  exports: string[];
  dependencies: string[];
  dependents: string[];
}

export interface ApiEndpoint {
  id: string;
  method: string;
  path: string;
  handler: string;
  file: string;
  domain?: string;
}

export interface Smell {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high';
  nodes: string[];
  description: string;
  recommendation: string;
}

export interface CriticalPath {
  id: string;
  name: string;
  nodes: string[];
  risk: 'low' | 'medium' | 'high';
  description: string;
}

export interface CapabilitySignature {
  id: string;
  name: string;
  purpose: string;
  keywords: string[];
  actors: string[];
  data: string[];
  outcomes: string[];
  category: string;
  weight?: number;
}

export interface Capability {
  id: string;
  signature: CapabilitySignature;
  confidence: number;
  actors: string[];
  data: string[];
  outcomes: string[];
  services: string[];
  apis: string[];
  domains: string[];
  evidence: string[];
  reasons: string[];
}

export interface JourneySignature {
  id: string;
  name: string;
  purpose: string;
  patterns: string[];
}

export interface DiscoveredJourney {
  id: string;
  signature: JourneySignature;
  confidence: number;
  entryPoint: string;
  entryRoute?: string;
  steps: Array<{ nodeId: string; name: string; kind: string; path?: string }>;
  actors: string[];
  systems: string[];
  data: string[];
  outcomes: string[];
  preconditions: string[];
  reason: string;
}

export interface HealthScore {
  overall: number;
  discoverability: number;
  architectureClarity: number;
  coupling: number;
  documentationQuality: number;
  dependencyComplexity: number;
}

export interface HeatmapEntry {
  domain: string;
  domainId: string;
  riskScore: number;
  risk: 'low' | 'medium' | 'high';
  problems: string[];
  circularDependencies: number;
  deadModules: number;
  highSmells: number;
  coupling: number;
  services: number;
  apis: number;
}

export interface GraphData {
  nodes: Array<{ id: string; kind: string; name: string; path?: string }>;
  edges: Array<{ id: string; source: string; target: string; kind: string }>;
}

declare global {
  interface Window {
    __graph?: GraphData;
  }
}
