import type { MemoryModel } from './types.js';
import { computeMemoryScore } from './report.js';
import { computeAiReadiness } from './ai-readiness.js';
import { computeDomainHeatmap } from './analysis/heatmap.js';

export interface DnaReport {
  repository: string;
  oneLiner: string;
  healthScore: number;
  aiReadiness: number;
  metrics: {
    files: number;
    services: number;
    apis: number;
    domains: number;
    flows: number;
    journeys: number;
    capabilities: number;
  };
  topCapabilities: string[];
  topJourneys: string[];
  architecture: {
    type: string;
    languages: string[];
    layers: string[];
  };
  mostCriticalDomain: string;
  highestRiskDomain: string;
  oneLinerDescription: string;
  paragraphs: string[];
  recommendations: string[];
}

/**
 * Build a polished "Repository DNA" summary — the viral output of `mnemos dna`.
 *
 * Designed to be the moment a developer pastes a link in Slack and everyone
 * instantly understands what the codebase is.
 */
export function buildDnaReport(memory: MemoryModel): DnaReport {
  const score = computeMemoryScore(memory);
  const ai = computeAiReadiness(memory);
  const heatmap = computeDomainHeatmap(memory);
  const capabilities = memory.capabilities ?? [];
  const journeys = memory.journeys ?? [];

  // Most critical domain: highest centrality (services + dependents)
  const centrality = memory.domains
    .map((d) => {
      const services = memory.services.filter(
        (s) => s.domain === d.id || s.domain === d.name,
      );
      const depWeight = services.reduce(
        (sum, s) => sum + s.dependencies.length + s.dependents.length,
        0,
      );
      return { name: d.name, weight: depWeight + d.nodes.length };
    })
    .sort((a, b) => b.weight - a.weight);
  const mostCritical = centrality[0]?.name ?? '—';

  // Highest risk domain: highest riskScore from heatmap
  const highestRisk =
    [...heatmap].sort((a, b) => b.riskScore - a.riskScore)[0]?.domain ?? '—';

  const topCapabilities = capabilities
    .slice()
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 6)
    .map((c) => c.signature.name);

  const topJourneys = journeys
    .slice()
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5)
    .map((j) => j.signature.name);

  const languages = Object.entries(memory.architecture.languages ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([lang]) => lang);

  // Generate the headline one-liner that captures the project
  const oneLiner = `${memory.repository} is a ${
    memory.architecture.type.toLowerCase()
  } with ${capabilities.length} capabilities, ${
    memory.domains.length
  } domains, and ${memory.apis.length} APIs.`;

  const paragraphs = [
    `${memory.repository} is a ${
      memory.architecture.type.toLowerCase()
    } built primarily with ${languages.join(', ') || 'a mixed stack'}.`,
    `It exposes ${memory.apis.length} APIs across ${
      memory.domains.length
    } domains, with ${journeys.length} discovered user journeys.`,
    `Most critical domain: ${mostCritical}.`,
    `Highest risk domain: ${highestRisk}.`,
    `Repository health: ${score.overall}/100. AI readiness: ${ai.score}/100.`,
  ];

  return {
    repository: memory.repository,
    oneLiner,
    healthScore: score.overall,
    aiReadiness: ai.score,
    metrics: {
      files: memory.stats.filesScanned,
      services: memory.services.length,
      apis: memory.apis.length,
      domains: memory.domains.length,
      flows: memory.flows.length,
      journeys: journeys.length,
      capabilities: capabilities.length,
    },
    topCapabilities,
    topJourneys,
    architecture: {
      type: memory.architecture.type,
      languages,
      layers: memory.architecture.layers ?? [],
    },
    mostCriticalDomain: mostCritical,
    highestRiskDomain: highestRisk,
    oneLinerDescription: memory.architecture.summary,
    paragraphs,
    recommendations: ai.recommendations,
  };
}

/**
 * Format the DNA report as the polished terminal output used by `mnemos dna`.
 * Designed for screenshots — looks identical in any modern terminal.
 */
export function formatDnaReport(dna: DnaReport): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('━'.repeat(72));
  lines.push(`  REPOSITORY DNA  ·  ${dna.repository}`);
  lines.push('━'.repeat(72));
  lines.push('');
  lines.push(`  ${dna.oneLiner}`);
  lines.push('');

  // Key metrics block
  const w = 18;
  const pad = (s: string, n: number) => s + ' '.repeat(Math.max(0, n - s.length));
  lines.push(
    `  ${pad('Capabilities', w)}${pad('Domains', w)}${pad('Journeys', w)}${pad(
      'APIs',
      w,
    )}`,
  );
  lines.push(
    `  ${pad(String(dna.metrics.capabilities), w)}${pad(
      String(dna.metrics.domains),
      w,
    )}${pad(String(dna.metrics.journeys), w)}${pad(String(dna.metrics.apis), w)}`,
  );
  lines.push('');

  // Health + AI readiness
  lines.push('  ┌─────────────────────────────────────┐');
  lines.push(`  │  Health Score:    ${String(dna.healthScore).padStart(3)} / 100        │`);
  lines.push(`  │  AI Readiness:    ${String(dna.aiReadiness).padStart(3)} / 100        │`);
  lines.push('  └─────────────────────────────────────┘');
  lines.push('');

  // Architecture
  lines.push(`  Architecture: ${dna.architecture.type}`);
  if (dna.architecture.languages.length > 0) {
    lines.push(`  Languages:    ${dna.architecture.languages.join(', ')}`);
  }
  lines.push('');

  // Critical insights
  lines.push('  Most Critical Domain:');
  lines.push(`    ${dna.mostCriticalDomain}`);
  lines.push('');
  lines.push('  Highest Risk Domain:');
  lines.push(`    ${dna.highestRiskDomain}`);
  lines.push('');

  // Capabilities
  if (dna.topCapabilities.length > 0) {
    lines.push('  Top Capabilities:');
    for (const c of dna.topCapabilities) {
      lines.push(`    • ${c}`);
    }
    lines.push('');
  }

  // Journeys
  if (dna.topJourneys.length > 0) {
    lines.push('  User Journeys:');
    for (const j of dna.topJourneys) {
      lines.push(`    • ${j}`);
    }
    lines.push('');
  }

  // Recommendations
  if (dna.recommendations.length > 0) {
    lines.push('  AI Recommendations:');
    for (const r of dna.recommendations.slice(0, 3)) {
      lines.push(`    ▸ ${r}`);
    }
    lines.push('');
  }

  lines.push('━'.repeat(72));
  lines.push(`  Drag .mnemos/project.dna.json into Claude, Cursor, or Codex.`);
  lines.push('━'.repeat(72));
  lines.push('');

  return lines.join('\n');
}
