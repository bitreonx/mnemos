export type NodeKind =
  | 'repository'
  | 'domain'
  | 'service'
  | 'module'
  | 'package'
  | 'file'
  | 'class'
  | 'function'
  | 'interface'
  | 'type'
  | 'api'
  | 'route'
  | 'model'
  | 'test'
  | 'event'
  | 'queue';

export type EdgeKind =
  | 'CALLS'
  | 'IMPORTS'
  | 'READS'
  | 'WRITES'
  | 'DEPENDS_ON'
  | 'OWNS'
  | 'EXPOSES'
  | 'IMPLEMENTS'
  | 'CONTAINS'
  | 'PART_OF';

export interface GraphNode {
  id: string;
  kind: NodeKind;
  name: string;
  path?: string;
  language?: string;
  metadata?: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  kind: EdgeKind;
  metadata?: Record<string, unknown>;
  /** Edge reliability 0–1 (M3). */
  confidence?: number;
}

export interface ParsedSymbol {
  name: string;
  kind: 'class' | 'function' | 'interface' | 'type' | 'export' | 'route' | 'model' | 'test';
  startLine: number;
  endLine: number;
  isExported: boolean;
  isDefaultExport: boolean;
}

export interface ParsedImport {
  source: string;
  specifiers: string[];
  isTypeOnly: boolean;
}

export interface ParsedCall {
  callee: string;
  line: number;
}

export interface ParsedFile {
  path: string;
  relativePath: string;
  language: string;
  symbols: ParsedSymbol[];
  imports: ParsedImport[];
  calls: ParsedCall[];
  exports: string[];
  isTest: boolean;
  isRoute: boolean;
  routePath?: string;
  hasUseServer: boolean;
  metadata: Record<string, unknown>;
}

export interface Domain {
  id: string;
  name: string;
  confidence: number;
  nodes: string[];
  description: string;
  entryPoints: string[];
}

export interface FlowStep {
  nodeId: string;
  name: string;
  kind: NodeKind;
  path?: string;
}

export interface Flow {
  id: string;
  name: string;
  type: 'request' | 'event' | 'dependency' | 'user_journey';
  confidence: number;
  steps: FlowStep[];
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

export interface DependencyEntry {
  from: string;
  to: string;
  kind: EdgeKind;
  weight: number;
}

export interface CriticalPath {
  id: string;
  name: string;
  nodes: string[];
  risk: 'low' | 'medium' | 'high';
  description: string;
}

export interface ImpactResult {
  node: string;
  affectedApis: string[];
  affectedDomains: string[];
  affectedTests: string[];
  affectedFiles: string[];
  totalAffected: number;
  paths: string[][];
}

export interface DeadCodeEntry {
  nodeId: string;
  name: string;
  kind: NodeKind;
  path?: string;
  confidence: number;
  reason: string;
}

export interface ArchitectureSmell {
  id: string;
  type:
    | 'circular_dependency'
    | 'god_service'
    | 'tight_coupling'
    | 'excessive_fan_in'
    | 'excessive_fan_out'
    | 'layer_violation';
  severity: 'low' | 'medium' | 'high';
  nodes: string[];
  description: string;
  recommendation: string;
}

export interface MemoryModel {
  repository: string;
  builtAt: string;
  stats: BuildStats;
  architecture: ArchitectureModel;
  domains: Domain[];
  flows: Flow[];
  services: Service[];
  apis: ApiEndpoint[];
  dependencies: DependencyEntry[];
  criticalPaths: CriticalPath[];
  deadCode: DeadCodeEntry[];
  smells: ArchitectureSmell[];
  capabilities: import('./analysis/capabilities.js').Capability[];
  journeys: import('./analysis/journeys.js').DiscoveredJourney[];
}

export interface BuildStats {
  filesScanned: number;
  nodesCreated: number;
  edgesCreated: number;
  domainsFound: number;
  flowsFound: number;
  durationMs: number;
}

export interface ArchitectureModel {
  name: string;
  type: string;
  layers: string[];
  packages: string[];
  languages: Record<string, number>;
  summary: string;
}

export interface BuildOptions {
  root: string;
  outputDir?: string;
  ignore?: string[];
  maxFiles?: number;
  verbose?: boolean;
  incremental?: boolean;
}

export interface BuildResult {
  memory: MemoryModel;
  outputDir: string;
}

export interface ScanResult {
  files: string[];
  packages: string[];
  rootPackageName?: string;
}
