import path from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';

import type { MemoryModel } from '../types.js';
import type { MnemosGraph } from '../graph/graph.js';
import { buildOnboardGuide, formatOnboardGuide } from '../onboard.js';
import { buildArchitectureNarrative, formatArchitectureStory } from '../story.js';
import { buildDnaReport, formatDnaReport } from '../dna.js';
import { computeDomainHeatmap } from '../analysis/heatmap.js';
import { computeMemoryScore } from '../report.js';
import { computeAiReadiness } from '../ai-readiness.js';
import { buildAiPack, aiPackToJson } from '../ai-pack.js';
import { SUPPORTED_LANGUAGE_COUNT } from '../languages/index.js';

/** Persona lens for Full Burn exports */
export type FullBurnPersona = 'pm' | 'dev' | 'ai';

export interface ArchitectureLayer {
  id: string;
  name: string;
  description: string;
  nodeIds: string[];
  fileCount: number;
}

export interface LanguageConcept {
  pattern: string;
  description: string;
  files: string[];
  count: number;
}

export interface IgnitionTourStep {
  order: number;
  title: string;
  description: string;
  domain?: string;
  layer?: string;
  entryPoints: string[];
  estimatedMinutes: number;
}

export interface FullBurnPack {
  version: '1.0.0';
  codename: 'Supernova';
  tagline: 'All fire. No half measures. Beast mode engaged.';
  generatedAt: string;
  repository: string;
  personas: FullBurnPersona[];
  tour: IgnitionTourStep[];
  layers: ArchitectureLayer[];
  languageConcepts: LanguageConcept[];
  health: ReturnType<typeof computeMemoryScore>;
  aiReadiness: ReturnType<typeof computeAiReadiness>;
  stats: {
    domains: number;
    capabilities: number;
    flows: number;
    languages: number;
    supportedLanguageCatalog: number;
  };
}

const LAYER_PATTERNS: Array<{ patterns: string[]; name: string; description: string }> = [
  { patterns: ['routes', 'controller', 'handler', 'endpoint', 'api'], name: 'API Layer', description: 'HTTP endpoints and route handlers' },
  { patterns: ['service', 'usecase', 'business'], name: 'Service Layer', description: 'Business logic and application services' },
  { patterns: ['model', 'entity', 'schema', 'database', 'db', 'repository'], name: 'Data Layer', description: 'Persistence and data models' },
  { patterns: ['component', 'view', 'page', 'layout', 'ui'], name: 'UI Layer', description: 'Presentation and UI components' },
  { patterns: ['middleware', 'interceptor', 'guard', 'filter'], name: 'Middleware Layer', description: 'Request pipeline cross-cutting concerns' },
  { patterns: ['util', 'helper', 'lib', 'common', 'shared'], name: 'Utility Layer', description: 'Shared helpers and libraries' },
  { patterns: ['test', 'spec', '__tests__'], name: 'Test Layer', description: 'Tests and fixtures' },
];

const CONCEPT_PATTERNS: Array<{ id: string; regex: RegExp; description: string }> = [
  { id: 'middleware', regex: /middleware|use\s*\(/i, description: 'Express-style middleware chain — composable request handlers' },
  { id: 'generics', regex: /<\s*[A-Z]\w*\s*>|extends\s+\w+/i, description: 'Generic types and constrained inheritance' },
  { id: 'closures', regex: /=>\s*\{|function\s*\([^)]*\)\s*\{/i, description: 'Closures and callback patterns' },
  { id: 'decorators', regex: /@\w+/i, description: 'Decorator metadata (NestJS, TypeScript)' },
  { id: 'async-await', regex: /async\s+function|await\s+/i, description: 'Async/await concurrency' },
  { id: 'dependency-injection', regex: /injectable|constructor\s*\([^)]*private|@inject/i, description: 'Dependency injection containers' },
  { id: 'routing', regex: /\.(get|post|put|delete|patch)\s*\(|router\.|app\.use\s*\(\s*['"]\//i, description: 'HTTP routing declarations' },
  { id: 'error-handling', regex: /catch\s*\(|next\s*\(\s*err|throw\s+new/i, description: 'Error propagation and handling' },
];

function matchLayer(filePath: string): string {
  const segments = filePath.replace(/\\/g, '/').toLowerCase().split('/');
  for (const { patterns, name } of LAYER_PATTERNS) {
    for (const seg of segments) {
      for (const p of patterns) {
        if (seg === p || seg === `${p}s`) return name;
      }
    }
  }
  return 'Core';
}

export function detectArchitectureLayers(memory: MemoryModel): ArchitectureLayer[] {
  const layerMap = new Map<string, Set<string>>();

  for (const domain of memory.domains) {
    for (const nodeId of domain.nodes) {
      const layer = matchLayer(nodeId);
      if (!layerMap.has(layer)) layerMap.set(layer, new Set());
      layerMap.get(layer)!.add(nodeId);
    }
  }

  if (layerMap.size === 0) {
    layerMap.set('Core', new Set(memory.domains.flatMap((d) => d.nodes.slice(0, 20))));
  }

  return [...layerMap.entries()].map(([name, ids]) => {
    const meta = LAYER_PATTERNS.find((p) => p.name === name);
    return {
      id: `layer:${name.toLowerCase().replace(/\s+/g, '-')}`,
      name,
      description: meta?.description ?? 'Core application files',
      nodeIds: [...ids].slice(0, 50),
      fileCount: ids.size,
    };
  });
}

export function detectLanguageConcepts(memory: MemoryModel): LanguageConcept[] {
  const corpus: string[] = [];
  for (const domain of memory.domains) {
    corpus.push(domain.name, domain.description ?? '', ...domain.nodes, ...domain.entryPoints);
  }
  for (const cap of memory.capabilities ?? []) {
    corpus.push(cap.signature.name, cap.signature.purpose, ...cap.signature.keywords);
  }
  for (const api of memory.apis) {
    corpus.push(api.path, api.method, api.handler ?? '');
  }
  for (const flow of memory.flows) {
    corpus.push(flow.name, flow.entryPoint ?? '');
  }
  const blob = corpus.join('\n');

  const concepts: LanguageConcept[] = [];
  for (const { id, regex, description } of CONCEPT_PATTERNS) {
    const files = memory.domains
      .flatMap((d) => [...d.nodes, ...d.entryPoints])
      .filter((fp) => regex.test(fp) || regex.test(path.basename(fp)));
    const textHit = regex.test(blob);
    if (files.length > 0 || textHit) {
      const unique = [...new Set(files)].slice(0, 12);
      concepts.push({
        pattern: id,
        description,
        files: unique.length > 0 ? unique : ['(inferred from architecture)'],
        count: Math.max(unique.length, textHit ? 1 : 0),
      });
    }
  }

  return concepts.sort((a, b) => b.count - a.count);
}

export function buildIgnitionTour(memory: MemoryModel, layers: ArchitectureLayer[]): IgnitionTourStep[] {
  const onboard = buildOnboardGuide(memory);
  const layerByNode = new Map<string, string>();
  for (const layer of layers) {
    for (const id of layer.nodeIds) layerByNode.set(id, layer.name);
  }

  return onboard.steps.map((step, i) => ({
    order: i + 1,
    title: step.title,
    description: step.description,
    domain: step.domain,
    layer: step.entryPoints.map((ep) => layerByNode.get(ep)).find(Boolean),
    entryPoints: step.entryPoints,
    estimatedMinutes: step.estimatedMinutes,
  }));
}

function buildPersonaPm(memory: MemoryModel, narrative: ReturnType<typeof buildArchitectureNarrative>): Record<string, unknown> {
  return {
    persona: 'pm',
    audience: 'Product managers, founders, vibecoders',
    productSummary: memory.architecture.summary,
    capabilities: (memory.capabilities ?? []).map((c) => ({
      name: c.signature.name,
      description: c.signature.purpose,
      keywords: c.signature.keywords,
    })),
    userJourneys: (memory.journeys ?? []).slice(0, 8).map((j) => j.signature.name),
    centralDomain: narrative.centralDomain,
    riskAreas: narrative.riskDomains,
    healthScore: computeMemoryScore(memory).overall,
  };
}

function buildPersonaDev(memory: MemoryModel, layers: ArchitectureLayer[]): Record<string, unknown> {
  return {
    persona: 'dev',
    audience: 'Human developers shipping code',
    architecture: memory.architecture,
    layers,
    domains: memory.domains.map((d) => ({
      name: d.name,
      description: d.description,
      entryPoints: d.entryPoints.slice(0, 5),
      nodeCount: d.nodes.length,
    })),
    criticalPaths: memory.criticalPaths?.slice(0, 10) ?? [],
    smells: (memory.smells ?? []).slice(0, 15).map((s) => ({
      type: s.type,
      severity: s.severity,
      description: s.description,
      nodes: s.nodes.slice(0, 5),
    })),
    heatmap: computeDomainHeatmap(memory).slice(0, 8),
  };
}

function buildPersonaAi(memory: MemoryModel): Record<string, unknown> {
  const pack = buildAiPack(memory, { mode: 'ai' });
  return {
    persona: 'ai',
    audience: 'Claude, Cursor, Codex, MCP agents',
    aiPackVersion: pack.version,
    summary: pack.summary,
    score: pack.score,
    issues: pack.issues.slice(0, 8),
    suggestedPrompts: pack.suggestedPrompts,
    dna: pack.dna,
  };
}

export function buildFullBurnPack(memory: MemoryModel, _graph?: MnemosGraph): FullBurnPack {
  const layers = detectArchitectureLayers(memory);
  const languageConcepts = detectLanguageConcepts(memory);
  const tour = buildIgnitionTour(memory, layers);

  return {
    version: '1.0.0',
  codename: 'Supernova',
  tagline: 'All fire. No half measures. Beast mode engaged.',
    generatedAt: new Date().toISOString(),
    repository: memory.repository,
    personas: ['pm', 'dev', 'ai'],
    tour,
    layers,
    languageConcepts,
    health: computeMemoryScore(memory),
    aiReadiness: computeAiReadiness(memory),
    stats: {
      domains: memory.domains.length,
      capabilities: memory.capabilities?.length ?? 0,
      flows: memory.flows.length,
      languages: Object.keys(memory.architecture.languages).length,
      supportedLanguageCatalog: SUPPORTED_LANGUAGE_COUNT,
    },
  };
}

export function formatFullBurnSummary(pack: FullBurnPack): string {
  const lines = [
    `${pack.codename} — ${pack.tagline}`,
    '='.repeat(40),
    '',
    `Repository: ${pack.repository}`,
    `Generated: ${pack.generatedAt}`,
    '',
    'Ignition Tour (dependency-ordered)',
    '',
    ...pack.tour.slice(0, 6).map(
      (s) => `${s.order}. ${s.title} (~${s.estimatedMinutes}m)${s.layer ? ` [${s.layer}]` : ''}\n   ${s.description}`,
    ),
    '',
    `Architecture Layers (${pack.layers.length})`,
    ...pack.layers.map((l) => `  • ${l.name}: ${l.fileCount} files — ${l.description}`),
    '',
    `Language Concepts (${pack.languageConcepts.length})`,
    ...pack.languageConcepts.slice(0, 6).map((c) => `  • ${c.pattern}: ${c.description} (${c.count} hits)`),
    '',
    `Health: ${pack.health.overall}/100 · AI Readiness: ${pack.aiReadiness.score}/100`,
    `Stats: ${pack.stats.domains} domains · ${pack.stats.capabilities} capabilities · ${pack.stats.flows} flows · ${pack.stats.languages} languages (${pack.stats.supportedLanguageCatalog}+ catalog)`,
    '',
    'Persona exports: pm.json · dev.json · ai.json',
    'Written to .mnemos/fullburn/',
  ];
  return lines.join('\n');
}

export async function writeFullBurnPack(
  memory: MemoryModel,
  outputDir: string,
  graph?: MnemosGraph,
): Promise<{ dir: string; files: string[] }> {
  const dir = path.join(outputDir, 'fullburn');
  await mkdir(dir, { recursive: true });

  const pack = buildFullBurnPack(memory, graph);
  const narrative = buildArchitectureNarrative(memory);
  const layers = pack.layers;

  const files: string[] = [];
  const writes: Array<[string, string]> = [
    ['fullburn.json', JSON.stringify(pack, null, 2)],
    ['persona-pm.json', JSON.stringify(buildPersonaPm(memory, narrative), null, 2)],
    ['persona-dev.json', JSON.stringify(buildPersonaDev(memory, layers), null, 2)],
    ['persona-ai.json', JSON.stringify(buildPersonaAi(memory), null, 2)],
    ['ignition-tour.md', formatOnboardGuide(buildOnboardGuide(memory))],
    ['architecture-story.md', formatArchitectureStory(memory)],
    ['dna.md', formatDnaReport(buildDnaReport(memory))],
    ['layers.json', JSON.stringify(layers, null, 2)],
    ['language-concepts.json', JSON.stringify(pack.languageConcepts, null, 2)],
    ['ai-pack.json', aiPackToJson(buildAiPack(memory, { mode: 'ai' }))],
  ];

  for (const [name, content] of writes) {
    const fp = path.join(dir, name);
    await writeFile(fp, content, 'utf-8');
    files.push(fp);
  }

  return { dir, files };
}
