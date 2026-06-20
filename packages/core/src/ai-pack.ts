import type { ArchitectureSmell, BuildStats, MemoryModel } from './types.js';
import { computeMemoryScore } from './report.js';
import { computeAiReadiness, type AiReadinessResult } from './ai-readiness.js';
import { computeDomainHeatmap, type DomainHeatmapEntry } from './analysis/heatmap.js';
import type { DiscoveredJourney } from './analysis/journeys.js';
import { MNEMOS_VERSION } from './agent-runtime.js';

export const AI_PACK_VERSION = '1.0.0';
export const AI_PACK_SCHEMA = 'https://getmnemos.vercel.app/schemas/ai-pack/v1.json';

export type Mode = 'vibe' | 'ai' | 'coder';
export type IssueType = 'smell' | 'hotspot' | 'build' | 'deadcode' | 'complexity';

export interface AiPackRepository {
  id: string;
  name: string;
  label: string;
  description: string;
  root: string;
  fingerprint: string;
  architectureType: string;
  languages: Record<string, number>;
}

export interface AiPackSummary {
  architecture: {
    name: string;
    type: string;
    summary: string;
    layers: string[];
    packages: string[];
  };
  stats: BuildStats & {
    apis: number;
    capabilities: number;
    smells: number;
  };
  topCapabilities: string[];
  topJourneys: string[];
}

export interface AiPackHealthDimension {
  value: number;
  definition: string;
  formula: string;
}

export interface AiPackHealth {
  discoverability: AiPackHealthDimension;
  architectureClarity: AiPackHealthDimension;
  coupling: AiPackHealthDimension;
  documentationQuality: AiPackHealthDimension;
  dependencyComplexity: AiPackHealthDimension;
}

export interface AiPackAiReadiness {
  domainSeparation: AiPackHealthDimension;
  flowClarity: AiPackHealthDimension;
  dependencyQuality: AiPackHealthDimension;
  documentationQuality: AiPackHealthDimension;
  contextDensity: AiPackHealthDimension;
  contextDiscoverability: AiPackHealthDimension;
}

export interface AiPackScore {
  overall: number;
  aiReadinessOverall: number;
  tone: 'great' | 'good' | 'warn' | 'bad';
  narrative: string;
  health: AiPackHealth;
  aiReadiness: AiPackAiReadiness;
  strongest: { name: string; value: number } | null;
  weakest: { name: string; value: number } | null;
  factors: Array<{ name: string; delta: number; evidence: string }>;
}

export interface AiPackIssue {
  id: string;
  type: IssueType;
  severity: 'low' | 'medium' | 'high';
  title: string;
  summary: string;
  whyItMatters: string;
  files: string[];
  recommendation: string;
  evidence?: Record<string, unknown>;
}

export interface AiPackPrompts {
  fix: string;
  review: string;
  onboard: string;
  issue: string;
}

export interface AiPackIssuePromptInput {
  repository: string;
  mode: Mode;
  issue: AiPackIssue;
  score: AiPackScore;
}

export interface AiPackOptions {
  mode?: Mode;
  section?: AiPackSection;
  repoId?: string;
  root?: string;
  fingerprint?: string;
  buildHistory?: Array<{
    builtAt: string;
    files: number;
    domains: number;
    flows: number;
    health: number;
    aiReadiness: number;
    durationMs: number;
    capabilities: number;
    smells: number;
  }>;
  prompts?: Partial<AiPackPrompts>;
  suggestedPrompts?: string[];
  dna?: Record<string, unknown> | null;
  graph?: { nodes: Array<{ id: string; kind: string; name: string; path?: string }>; edges: Array<{ id: string; source: string; target: string; kind: string }> } | null;
}

export type AiPackSection = 'all' | 'summary' | 'score' | 'issues' | 'graph' | 'flows' | 'smells' | 'dna';

export interface AiPack {
  $schema: string;
  version: string;
  generatedAt: string;
  mnemosVersion: string;
  mode: Mode;
  repository: AiPackRepository;
  summary: AiPackSummary;
  score: AiPackScore;
  issues: AiPackIssue[];
  flows: Array<{ id: string; name: string; type: string; confidence: number; entryPoint: string; stepCount: number }>;
  journeys: Array<{ id: string; name: string; confidence: number; actors: string[]; outcomes: string[]; entryPoint: string; stepCount: number }>;
  domains: Array<{ id: string; name: string; description: string; services: number; apis: number; confidence: number; risk: string }>;
  smells: Array<{ id: string; type: string; severity: string; nodes: string[]; description: string; recommendation: string }>;
  graph: AiPackOptions['graph'] | null;
  dna: Record<string, unknown> | null;
  prompts: AiPackPrompts;
  suggestedPrompts: string[];
  buildHistory: NonNullable<AiPackOptions['buildHistory']>;
}

const HEALTH_DEFS: Record<keyof AiPackHealth, { definition: string; formula: string }> = {
  discoverability: {
    definition: 'How quickly a human or AI can find the right files, domains, and entry points.',
    formula: 'round(servicesWithDomain / services * 100), with a 100 floor when there are no services.',
  },
  architectureClarity: {
    definition: 'How understandable the structure is after penalties from detected smells and design ambiguity.',
    formula: '100 - min(60, highSmells*6 + medSmells*2).',
  },
  coupling: {
    definition: 'How much the code pulls across services and modules instead of staying contained.',
    formula: 'round(100 - avgDependencies * 4).',
  },
  documentationQuality: {
    definition: 'How well domains and system shape are described in generated context and structure.',
    formula: 'round(domainsWithDescription / domains * 100), with a 100 floor when there are no domains.',
  },
  dependencyComplexity: {
    definition: 'How much cross-domain and dependency sprawl increases change risk.',
    formula: 'round(100 - crossDomainDependencies * 1.5).',
  },
};

const AI_DEFS: Record<keyof AiPackAiReadiness, { definition: string; formula: string }> = {
  domainSeparation: {
    definition: 'Share of services that are assigned to a domain.',
    formula: 'round(servicesWithDomain / services * 100), with a 100 floor when there are no services.',
  },
  flowClarity: {
    definition: 'Share of flows that have at least two steps and a clear entry point.',
    formula: 'round(flowsWithSteps / flows * 100), with a 50 floor when there are no flows.',
  },
  dependencyQuality: {
    definition: 'Alias of dependency complexity: how much cross-domain sprawl exists.',
    formula: 'round(100 - crossDomainDependencies * 1.5).',
  },
  documentationQuality: {
    definition: 'Alias of documentation quality: how well domains describe themselves.',
    formula: 'round(domainsWithDescription / domains * 100), with a 100 floor when there are no domains.',
  },
  contextDensity: {
    definition: 'How rich the generated context is per scanned file.',
    formula: 'min(100, round((domains*5 + flows*3 + apis*2 + capabilities*4) / max(1, filesScanned/50))).',
  },
  contextDiscoverability: {
    definition: 'Alias of discoverability for AI consumption.',
    formula: 'round(servicesWithDomain / services * 100), with a 100 floor when there are no services.',
  },
};

function toneFor(value: number): 'great' | 'good' | 'warn' | 'bad' {
  if (value >= 80) return 'great';
  if (value >= 60) return 'good';
  if (value >= 40) return 'warn';
  return 'bad';
}

function narrativeFor(value: number): string {
  if (value >= 80) return 'Strong and ready for fast onboarding.';
  if (value >= 60) return 'Usable, with a few blind spots to clean up.';
  if (value >= 40) return 'Understandable, but risky in day-to-day work.';
  return 'Needs attention before humans or AI can move safely.';
}

function buildHealth(score: ReturnType<typeof computeMemoryScore>): AiPackHealth {
  return {
    discoverability: { value: score.discoverability, ...HEALTH_DEFS.discoverability },
    architectureClarity: { value: score.architectureClarity, ...HEALTH_DEFS.architectureClarity },
    coupling: { value: score.coupling, ...HEALTH_DEFS.coupling },
    documentationQuality: { value: score.documentationQuality, ...HEALTH_DEFS.documentationQuality },
    dependencyComplexity: { value: score.dependencyComplexity, ...HEALTH_DEFS.dependencyComplexity },
  };
}

function buildAiReadiness(result: AiReadinessResult): AiPackAiReadiness {
  return {
    domainSeparation: { value: result.breakdown.domainSeparation, ...AI_DEFS.domainSeparation },
    flowClarity: { value: result.breakdown.flowClarity, ...AI_DEFS.flowClarity },
    dependencyQuality: { value: result.breakdown.dependencyQuality, ...AI_DEFS.dependencyQuality },
    documentationQuality: { value: result.breakdown.documentationQuality, ...AI_DEFS.documentationQuality },
    contextDensity: { value: result.breakdown.contextDensity, ...AI_DEFS.contextDensity },
    contextDiscoverability: { value: result.breakdown.contextDiscoverability, ...AI_DEFS.contextDiscoverability },
  };
}

function buildFactors(memory: MemoryModel, score: ReturnType<typeof computeMemoryScore>): AiPackScore['factors'] {
  const factors: AiPackScore['factors'] = [];
  const high = memory.smells.filter((s) => s.severity === 'high').length;
  const med = memory.smells.filter((s) => s.severity === 'medium').length;
  if (high) factors.push({ name: 'High-severity smells', delta: -high * 6, evidence: `${high} high-severity architecture smells.` });
  if (med) factors.push({ name: 'Medium-severity smells', delta: -med * 2, evidence: `${med} medium-severity architecture smells.` });
  const crossDomainDeps = countCrossDomainDeps(memory);
  if (crossDomainDeps) factors.push({ name: 'Cross-domain dependencies', delta: -Math.round(crossDomainDeps * 1.5), evidence: `${crossDomainDeps} cross-domain dependencies.` });
  const undomained = memory.services.filter((s) => !s.domain).length;
  if (undomained) factors.push({ name: 'Undomained services', delta: -undomained * 2, evidence: `${undomained} services have no domain label.` });
  const undocumented = memory.domains.filter((d) => !d.description || d.description.length < 20).length;
  if (undocumented) factors.push({ name: 'Undocumented domains', delta: -undocumented * 3, evidence: `${undocumented} domains have no description.` });
  if (memory.capabilities && memory.capabilities.length >= 5) {
    factors.push({ name: 'Discovered capabilities', delta: Math.min(10, memory.capabilities.length), evidence: `${memory.capabilities.length} capabilities detected.` });
  }
  if (memory.journeys && memory.journeys.length >= 3) {
    factors.push({ name: 'Discovered user journeys', delta: Math.min(8, memory.journeys.length * 2), evidence: `${memory.journeys.length} journeys detected.` });
  }
  return factors;
}

function countCrossDomainDeps(memory: MemoryModel): number {
  const byId = new Map(memory.services.map((s) => [s.id, s.domain]));
  return memory.dependencies.filter((d) => {
    const from = byId.get(d.from);
    const to = byId.get(d.to);
    return from && to && from !== to;
  }).length;
}

function pickExtreme(
  rows: Array<{ name: string; value: number }>,
  pick: 'max' | 'min',
): { name: string; value: number } | null {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => (pick === 'max' ? b.value - a.value : a.value - b.value));
  return sorted[0]!;
}

function buildIssues(memory: MemoryModel, heatmap: DomainHeatmapEntry[]): AiPackIssue[] {
  const issues: AiPackIssue[] = [];

  for (const smell of memory.smells) {
    issues.push({
      id: `smell-${smell.id}`,
      type: 'smell',
      severity: smell.severity,
      title: humanize(smell.type),
      summary: smell.description,
      whyItMatters: whySmellMatters(smell),
      files: smell.nodes,
      recommendation: smell.recommendation,
      evidence: { smellType: smell.type },
    });
  }

  for (const heat of heatmap) {
    if (heat.risk === 'low' && heat.problems.length === 0) continue;
    issues.push({
      id: `hotspot-${heat.domainId}`,
      type: 'hotspot',
      severity: heat.risk,
      title: `${heat.domain} risk hotspot`,
      summary:
        heat.problems[0] ??
        `${heat.domain} has elevated coupling (${heat.coupling}) and ${heat.circularDependencies} circular dependencies.`,
      whyItMatters:
        'Hotspots concentrate risk: changes here ripple across services, domains, and tests more than anywhere else.',
      files: [],
      recommendation: `Review ${heat.domain} first. Circular dependencies: ${heat.circularDependencies}. High smells: ${heat.highSmells}. Dead modules: ${heat.deadModules}.`,
      evidence: {
        coupling: heat.coupling,
        circularDependencies: heat.circularDependencies,
        highSmells: heat.highSmells,
        deadModules: heat.deadModules,
      },
    });
  }

  for (const dead of memory.deadCode ?? []) {
    if (dead.confidence < 0.6) continue;
    issues.push({
      id: `dead-${dead.nodeId}`,
      type: 'deadcode',
      severity: dead.confidence >= 0.85 ? 'medium' : 'low',
      title: `Likely dead: ${dead.name}`,
      summary: dead.reason,
      whyItMatters: 'Dead code is a tax: every reader pays the cost of an unused symbol that may still be loaded at runtime.',
      files: dead.path ? [dead.path] : [],
      recommendation: 'Confirm there are no dynamic imports or runtime references, then delete or document why it is kept.',
      evidence: { kind: dead.kind, confidence: dead.confidence },
    });
  }

  return issues.slice(0, 24);
}

function humanize(s: string): string {
  return s.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function whySmellMatters(smell: ArchitectureSmell): string {
  switch (smell.type) {
    case 'circular_dependency':
      return 'Cycles make the order of changes unpredictable; refactors cascade.';
    case 'god_service':
      return 'A god service is the single point of failure for many features; testing it gets expensive.';
    case 'tight_coupling':
      return 'Tight coupling means a small change in one place forces coordinated changes elsewhere.';
    case 'excessive_fan_in':
      return 'High fan-in modules are widely depended on; one regression breaks many features.';
    case 'excessive_fan_out':
      return 'High fan-out modules are fragile to any change in their dependencies.';
    case 'layer_violation':
      return 'Layer violations break the implicit contract that lets new contributors reason about the system.';
    default:
      return 'This pattern makes the system harder to read, change, or trust.';
  }
}

function buildPrompts(input: {
  repository: string;
  mode: Mode;
  overall: number;
  topIssues: AiPackIssue[];
  factors: AiPackScore['factors'];
}): AiPackPrompts {
  const topBullets = input.topIssues
    .slice(0, 6)
    .map((issue, i) => `${i + 1}. ${issue.title} [${issue.severity}] — ${issue.summary}\n   Recommendation: ${issue.recommendation}`)
    .join('\n');
  const factors = input.factors
    .slice(0, 6)
    .map((f) => `• ${f.name} (${f.delta >= 0 ? '+' : ''}${f.delta}): ${f.evidence}`)
    .join('\n');

  return {
    fix: [
      `You are helping fix repository intelligence issues for "${input.repository}".`,
      `Mode: ${input.mode}. Overall health score: ${input.overall}.`,
      '',
      'Top issues:',
      topBullets || 'No major issues detected.',
      '',
      'Score factors (positive = good, negative = penalty):',
      factors || 'No penalty factors detected.',
      '',
      'Use project.dna.json, agent_context.json, and generated context docs first.',
      'Return a concrete repair plan, the files to inspect, and the exact edits you would make.',
    ].join('\n'),
    review: [
      `You are doing a code review for "${input.repository}".`,
      `Mode: ${input.mode}. Health score: ${input.overall}.`,
      '',
      'Read project.dna.json, agent_context.json, and the relevant context doc first.',
      'Review the diff in the standard way. For each finding, cite the file, line, and reason.',
      'Group findings as: must-fix, should-fix, nit. End with a one-sentence summary verdict.',
    ].join('\n'),
    onboard: [
      `You are onboarding a new contributor to "${input.repository}".`,
      '',
      'Read project.dna.json and agent_context.json first. Then read the architecture.md context doc.',
      'Produce a 30-minute onboarding plan: 5 ordered steps, the entry point of each, and the question the step answers.',
      'End with a checklist of 5 "ask the maintainer" questions.',
    ].join('\n'),
    issue: [
      `You are fixing one specific issue in "${input.repository}".`,
      `Mode: ${input.mode}.`,
      '',
      'Issue JSON:',
      '{{ISSUE_JSON}}',
      '',
      'Use project.dna.json, agent_context.json, and the matching context doc.',
      'Return the fix, the file and line numbers, the risk of the change, and a one-sentence test suggestion.',
    ].join('\n'),
  };
}

export function renderIssuePrompt(template: string, issue: AiPackIssue): string {
  return template.replace(
    '{{ISSUE_JSON}}',
    JSON.stringify(
      {
        id: issue.id,
        type: issue.type,
        severity: issue.severity,
        title: issue.title,
        summary: issue.summary,
        whyItMatters: issue.whyItMatters,
        files: issue.files,
        recommendation: issue.recommendation,
        evidence: issue.evidence,
      },
      null,
      2,
    ),
  );
}

function projectToDomains(memory: MemoryModel, heatmap: DomainHeatmapEntry[]): AiPack['domains'] {
  const heatById = new Map(heatmap.map((h) => [h.domainId, h]));
  return memory.domains.map((d) => {
    const services = memory.services.filter((s) => s.domain === d.id || s.domain === d.name).length;
    const apis = memory.apis.filter((a) => a.domain === d.id || a.domain === d.name).length;
    return {
      id: d.id,
      name: d.name,
      description: d.description,
      services,
      apis,
      confidence: d.confidence,
      risk: heatById.get(d.id)?.risk ?? 'low',
    };
  });
}

function projectToSmells(memory: MemoryModel): AiPack['smells'] {
  return memory.smells.map((s) => ({
    id: s.id,
    type: s.type,
    severity: s.severity,
    nodes: s.nodes,
    description: s.description,
    recommendation: s.recommendation,
  }));
}

function projectToFlows(memory: MemoryModel): AiPack['flows'] {
  return memory.flows.map((f) => ({
    id: f.id,
    name: f.name,
    type: f.type,
    confidence: f.confidence,
    entryPoint: f.entryPoint,
    stepCount: f.steps.length,
  }));
}

function projectToJourneys(memory: MemoryModel): AiPack['journeys'] {
  const journeys: DiscoveredJourney[] = memory.journeys ?? [];
  return journeys.map((j) => ({
    id: j.id,
    name: j.signature.name,
    confidence: j.confidence,
    actors: j.actors,
    outcomes: j.outcomes,
    entryPoint: j.entryPoint,
    stepCount: j.steps.length,
  }));
}

function fingerprintFor(memory: MemoryModel, root: string | undefined): string {
  const input = `${memory.repository}|${memory.builtAt}|${memory.stats.filesScanned}|${memory.stats.domainsFound}|${memory.stats.flowsFound}|${memory.services.length}|${memory.apis.length}|${memory.smells.length}|${root ?? ''}`;
  // FNV-1a 32-bit — small, dependency-free, deterministic.
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function countApis(memory: MemoryModel): number {
  return memory.apis.length;
}

function countCapabilities(memory: MemoryModel): number {
  return memory.capabilities?.length ?? 0;
}

function countSmells(memory: MemoryModel): number {
  return memory.smells.length;
}

function buildSummary(memory: MemoryModel, heatmap: DomainHeatmapEntry[]): AiPackSummary {
  const topCapabilities = (memory.capabilities ?? []).slice(0, 5).map((c) => c.signature.name);
  const topJourneys = (memory.journeys ?? []).slice(0, 5).map((j) => j.signature.name);
  return {
    architecture: {
      name: memory.architecture.name,
      type: memory.architecture.type,
      summary: memory.architecture.summary,
      layers: memory.architecture.layers,
      packages: memory.architecture.packages,
    },
    stats: {
      ...memory.stats,
      apis: countApis(memory),
      capabilities: countCapabilities(memory),
      smells: countSmells(memory),
    },
    topCapabilities,
    topJourneys,
  };
}

function buildRepository(input: {
  memory: MemoryModel;
  repoId?: string;
  root?: string;
}): AiPackRepository {
  const id = input.repoId ?? input.memory.repository;
  return {
    id,
    name: input.memory.repository,
    label: titleCase(input.memory.repository),
    description: input.memory.architecture.summary,
    root: input.root ?? '.',
    fingerprint: fingerprintFor(input.memory, input.root),
    architectureType: input.memory.architecture.type,
    languages: input.memory.architecture.languages,
  };
}

function titleCase(s: string): string {
  return s
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function buildAiPack(memory: MemoryModel, options: AiPackOptions = {}): AiPack {
  const mode: Mode = options.mode ?? 'coder';
  const heatmap = computeDomainHeatmap(memory);
  const memoryScore = computeMemoryScore(memory);
  const aiReadiness = computeAiReadiness(memory);
  const health = buildHealth(memoryScore);
  const aiHealth = buildAiReadiness(aiReadiness);
  const factors = buildFactors(memory, memoryScore);

  const allHealthRows: Array<{ name: string; value: number }> = [
    { name: 'Discoverability', value: memoryScore.discoverability },
    { name: 'Architecture clarity', value: memoryScore.architectureClarity },
    { name: 'Coupling', value: memoryScore.coupling },
    { name: 'Documentation', value: memoryScore.documentationQuality },
    { name: 'Dependency complexity', value: memoryScore.dependencyComplexity },
  ];
  const strongest = pickExtreme(allHealthRows, 'max');
  const weakest = pickExtreme(allHealthRows, 'min');

  const issues = buildIssues(memory, heatmap);
  const prompts = buildPrompts({
    repository: memory.repository,
    mode,
    overall: memoryScore.overall,
    topIssues: issues,
    factors,
  });
  const mergedPrompts: AiPackPrompts = { ...prompts, ...(options.prompts ?? {}) };

  const pack: AiPack = {
    $schema: AI_PACK_SCHEMA,
    version: AI_PACK_VERSION,
    generatedAt: new Date().toISOString(),
    mnemosVersion: MNEMOS_VERSION,
    mode,
    repository: buildRepository({ memory, repoId: options.repoId, root: options.root }),
    summary: buildSummary(memory, heatmap),
    score: {
      overall: memoryScore.overall,
      aiReadinessOverall: aiReadiness.score,
      tone: toneFor(memoryScore.overall),
      narrative: narrativeFor(memoryScore.overall),
      health,
      aiReadiness: aiHealth,
      strongest,
      weakest,
      factors,
    },
    issues,
    flows: projectToFlows(memory),
    journeys: projectToJourneys(memory),
    domains: projectToDomains(memory, heatmap),
    smells: projectToSmells(memory),
    graph: options.graph ?? null,
    dna: options.dna ?? null,
    prompts: mergedPrompts,
    suggestedPrompts: options.suggestedPrompts ?? [],
    buildHistory: options.buildHistory ?? [],
  };

  return filterBySection(pack, options.section ?? 'all');
}

export function filterBySection(pack: AiPack, section: AiPackSection): AiPack {
  if (section === 'all' || !section) return pack;
  // Always keep the contract shell so consumers can introspect mode, version, etc.
  const base: AiPack = {
    ...pack,
    issues: section === 'issues' ? pack.issues : [],
    flows: section === 'flows' ? pack.flows : [],
    smells: section === 'smells' ? pack.smells : [],
    graph: section === 'graph' ? pack.graph : null,
    dna: section === 'dna' ? pack.dna : null,
    domains: ['issues', 'flows', 'smells', 'graph', 'dna'].includes(section) ? [] : pack.domains,
    journeys: ['issues', 'flows', 'smells', 'graph', 'dna'].includes(section) ? [] : pack.journeys,
    summary: section === 'summary' ? pack.summary : ({} as AiPackSummary),
    score: section === 'score' ? pack.score : emptyScore(),
  };
  return base;
}

function emptyScore(): AiPackScore {
  return {
    overall: 0,
    aiReadinessOverall: 0,
    tone: 'bad',
    narrative: '',
    health: {
      discoverability: { value: 0, definition: '', formula: '' },
      architectureClarity: { value: 0, definition: '', formula: '' },
      coupling: { value: 0, definition: '', formula: '' },
      documentationQuality: { value: 0, definition: '', formula: '' },
      dependencyComplexity: { value: 0, definition: '', formula: '' },
    },
    aiReadiness: {
      domainSeparation: { value: 0, definition: '', formula: '' },
      flowClarity: { value: 0, definition: '', formula: '' },
      dependencyQuality: { value: 0, definition: '', formula: '' },
      documentationQuality: { value: 0, definition: '', formula: '' },
      contextDensity: { value: 0, definition: '', formula: '' },
      contextDiscoverability: { value: 0, definition: '', formula: '' },
    },
    strongest: null,
    weakest: null,
    factors: [],
  };
}

export function aiPackToJson(pack: AiPack): string {
  return JSON.stringify(pack, null, 2);
}

export const __test = {
  buildHealth,
  buildAiReadiness,
  buildFactors,
  buildIssues,
  fingerprintFor,
  toneFor,
  narrativeFor,
};
