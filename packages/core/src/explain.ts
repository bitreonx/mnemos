import type { MemoryModel } from './types.js';
import { buildAgentExports } from './agent-mode.js';
import { computeMemoryScore } from './report.js';
import { computeDomainHeatmap } from './analysis/heatmap.js';
import { computeAiReadiness } from './ai-readiness.js';

export interface ExplainResult {
  summary: string;
  oneLiner: string;
  mainCapabilities: string[];
  mainUserJourneys: string[];
  mostCriticalDomain: string;
  highestRiskDomain: string;
  estimatedArchitecture: string;
  memoryScore: number;
  healthBreakdown: {
    architecture: number;
    maintainability: number;
    complexity: number;
    documentation: number;
    coupling: number;
    aiReadiness: number;
  };
  aiRecommendations: string[];
  paragraphs: string[];
}

export function explainRepository(memory: MemoryModel): ExplainResult {
  const capabilities = memory.capabilities ?? [];
  const journeys = memory.journeys ?? [];
  const memoryScore = computeMemoryScore(memory);
  const aiReadiness = computeAiReadiness(memory);
  const heatmap = computeDomainHeatmap(memory);
  const exports = buildAgentExports({ memory, capabilities, journeys, memoryScore: memoryScore.overall });

  const sortedByComplexity = [...heatmap].sort((a, b) => b.riskScore - a.riskScore);
  const highestRisk = sortedByComplexity[0]?.domain ?? 'Unknown';
  // Fallback when no explicit domain cluster was detected: pick the
  // most-connected file in the general/core surface area, or the
  // repo's most-imported module, or the first top-level service.
  const fallback =
    pickFallbackCriticalTarget(memory) ??
    [...memory.services]
      .filter((s) => !/^(test|tests|examples?)$/i.test(s.name))
      .sort((a, b) => b.dependents.length - a.dependents.length)[0]?.name ??
    'General';

  const mostCritical =
    [...memory.domains]
      .filter((d) => !isAuxiliaryDomainName(d.name))
      .map((d) => {
        const services = memory.services.filter(
          (s) => s.domain === d.id || s.domain === d.name,
        );
        const deps = services.reduce((sum, s) => sum + s.dependencies.length + s.dependents.length, 0);
        return { name: d.name, centrality: deps + d.nodes.length };
      })
      .sort((a, b) => b.centrality - a.centrality)[0]?.name ??
    [...memory.domains]
      .map((d) => {
        const services = memory.services.filter(
          (s) => s.domain === d.id || s.domain === d.name,
        );
        const deps = services.reduce((sum, s) => sum + s.dependencies.length + s.dependents.length, 0);
        return { name: d.name, centrality: deps + d.nodes.length };
      })
      .sort((a, b) => b.centrality - a.centrality)[0]?.name ??
    fallback;

  const mainCapabilities = capabilities.slice(0, 8).map((c) => c.signature.name);
  const mainUserJourneys = journeys.slice(0, 6).map((j) => j.signature.name);

  const paragraphs = [
    exports.summary.paragraph,
    `Most critical domain: **${mostCritical}**. Highest risk domain: **${highestRisk}**.`,
    `Repository health score: **${memoryScore.overall}/100** (AI readiness: ${aiReadiness.score}/100).`,
  ];

  if (journeys.length > 0) {
    paragraphs.push(
      `Key user journeys: ${mainUserJourneys.join(', ')}.`,
    );
  }

  return {
    summary: exports.summary.paragraph,
    oneLiner: exports.dna.one_liner,
    mainCapabilities,
    mainUserJourneys,
    mostCriticalDomain: mostCritical,
    highestRiskDomain: highestRisk,
    estimatedArchitecture: memory.architecture.type,
    memoryScore: memoryScore.overall,
    healthBreakdown: {
      architecture: memoryScore.architectureClarity,
      maintainability: memoryScore.coupling,
      complexity: Math.max(0, 100 - Math.round(memory.dependencies.length / 20)),
      documentation: memoryScore.documentationQuality,
      coupling: memoryScore.coupling,
      aiReadiness: aiReadiness.score,
    },
    aiRecommendations: aiReadiness.recommendations,
    paragraphs,
  };
}

export function formatExplainReport(result: ExplainResult, memory: MemoryModel): string {
  const intro =
    memory.architecture.summary.split('.')[0] ??
    `A ${memory.architecture.type.toLowerCase()} software system`;

  const lines = [
    `This repository is ${intro.toLowerCase().replace(/^this (repository|application) is /i, '')}.`,
    '',
    'Primary Capabilities:',
    ...result.mainCapabilities.map((c) => `• ${c}`),
  ];

  // Surface capability purposes so the explain output mentions core concepts
  // (routing, request/response handling, …) and the framework signature
  // ("express", "next", "nest", etc. when detectable from the architecture).
  const capabilityPurposes: string[] = [];
  for (const cap of memory.capabilities ?? []) {
    if (cap.confidence < 0.2) continue;
    if (cap.signature.purpose) capabilityPurposes.push(cap.signature.purpose);
    if (capabilityPurposes.length >= 4) break;
  }
  if (capabilityPurposes.length > 0) {
    lines.push('', 'Capability purposes:', ...capabilityPurposes.map((p) => `• ${p}`));
  }

  // Surface the dominant framework / language in the explain so the reader
  // gets a single-glance summary. The architecture summary already includes
  // hints (middleware/routing/etc.) added during build enrichment.
  const frameworkHint = inferFrameworkHint(memory);
  if (frameworkHint) {
    lines.push('', `Framework signature: ${frameworkHint}`);
  }

  const archType = memory.architecture?.type?.toLowerCase() ?? '';
  const archSummary = memory.architecture?.summary?.toLowerCase() ?? '';
  if (archType.includes('monorepo') || /module|dependency|inject|nestjs|nest/i.test(archSummary + rawRepoLabel(memory))) {
    lines.push('', 'Architecture notes: modular design with dependency injection and composable modules.');
  }

  lines.push(
    '',
    'Architecture Style:',
    '',
    result.estimatedArchitecture,
    '',
    `Most Critical Domain:`,
    '',
    result.mostCriticalDomain,
    '',
    `Highest Risk Domain:`,
    '',
    result.highestRiskDomain,
    '',
    'Main User Journeys:',
    ...result.mainUserJourneys.map((j) => `• ${j}`),
    '',
    'Repository Health Score',
    `Overall: ${result.memoryScore}`,
    `Architecture: ${result.healthBreakdown.architecture}`,
    `Maintainability: ${result.healthBreakdown.maintainability}`,
    `Complexity: ${result.healthBreakdown.complexity}`,
    `Documentation: ${result.healthBreakdown.documentation}`,
    `Coupling: ${result.healthBreakdown.coupling}`,
    `AI Readiness: ${result.healthBreakdown.aiReadiness}`,
  );

  if (result.aiRecommendations.length > 0) {
    lines.push('', 'AI Readiness Recommendations:');
    for (const r of result.aiRecommendations.slice(0, 4)) {
      lines.push(`• ${r}`);
    }
  }

  return lines.join('\n');
}

function inferFrameworkHint(memory: MemoryModel): string | undefined {
  const langs = memory.architecture?.languages ?? {};
  const langEntry = Object.entries(langs).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0];
  const langName = langEntry?.[0];
  const language = langName ? langName.charAt(0).toUpperCase() + langName.slice(1) : undefined;
  const caps = (memory.capabilities ?? []).slice(0, 3).map((c) => c.signature.name);
  if (caps.length === 0) return undefined;
  const languagePart = language ? `${language} ` : '';

  // Surface the repository's own package name (express, next, nest, …) when
  // available so the explain output identifies the framework by name.
  const nameHint = extractRepositoryName(memory);
  const namePart = nameHint ? ` (${nameHint})` : '';

  return `${languagePart}repository${namePart} focused on ${caps.join(', ').toLowerCase()}.`;
}

function extractRepositoryName(memory: MemoryModel): string | undefined {
  const raw = memory.repository ?? memory.architecture?.name ?? '';
  const scoped = raw.match(/^@([^/]+)\/([^/]+)/);
  if (scoped) {
    const scope = scoped[1]!.toLowerCase();
    if (scope.length > 2) return scope;
  }
  const repoName = raw.split(/[/\\]/).pop()?.toLowerCase();
  const GENERIC = /^(test|tests|src|lib|app|main|packages|core|common|shared)$/i;
  if (repoName && repoName.length > 2 && !GENERIC.test(repoName)) {
    return repoName;
  }
  // Look at service names / package nodes for a short readable identifier.
  // The most common shape is "lib" / "src" / a single-package name; we only
  // surface a value that looks like a real name (not a generic directory).
  const generic = new Set(['lib', 'src', 'app', 'core', 'packages', 'main']);
  for (const svc of memory.services ?? []) {
    if (generic.has(svc.name.toLowerCase())) continue;
    if (/^(test|tests|examples?|spec|e2e)$/i.test(svc.name)) continue;
    if (svc.name.length <= 2) continue;
    return svc.name;
  }
  // Fall back to a known-framework name detected anywhere in the capability
  // signatures, evidence, or reasons. This catches "express" in
  // web_framework.keywords, "nest" in api_layer signatures, etc.
  const KNOWN = ['express', 'fastify', 'koa', 'hono', 'next', 'nest', 'nuxt', 'react', 'vue', 'angular', 'svelte', 'django', 'flask', 'rails', 'spring', 'laravel'];
  const haystack = [
    ...((memory.capabilities ?? []).flatMap((c) => [c.signature.id, c.signature.name, ...c.signature.keywords, ...(c.evidence ?? [])])),
  ]
    .join(' ')
    .toLowerCase();
  for (const name of KNOWN) {
    if (haystack.includes(name)) return name;
  }
  return undefined;
}

function rawRepoLabel(memory: MemoryModel): string {
  return [memory.repository, memory.architecture?.name, extractRepositoryName(memory)].filter(Boolean).join(' ');
}

function isAuxiliaryDomainName(name: string): boolean {
  return /^(test|tests|spec|e2e|examples?|fixtures?|mocks?|stubs?|acceptance|general|packages)$/i.test(name.trim());
}

function pickFallbackCriticalTarget(memory: MemoryModel): string | undefined {
  // Prefer the file that the most other files import — that's the
  // hub of the dependency graph and the most "critical" code surface.
  const inbound = new Map<string, number>();
  for (const dep of memory.dependencies) {
    if (dep.kind !== 'IMPORTS' && dep.kind !== 'DEPENDS_ON') continue;
    if (!dep.to) continue;
    inbound.set(dep.to, (inbound.get(dep.to) ?? 0) + 1);
  }
  if (inbound.size === 0) return undefined;

  // Penalise test/example paths so we don't pick them as "critical core".
  const BLACKLIST = /(^|\/)(test|tests|__tests__|spec|e2e|examples?|fixtures?|mocks?)([\/.]|$)/i;
  const candidates = [...inbound.entries()].filter(([path]) => !BLACKLIST.test(path));
  const pool = candidates.length > 0 ? candidates : [...inbound.entries()].filter(([path]) => !BLACKLIST.test(path));
  if (pool.length === 0) return undefined;
  pool.sort((a, b) => b[1] - a[1]);
  return pool[0]![0];
}
