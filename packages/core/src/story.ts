import type { MemoryModel } from './types.js';
import { computeMemoryScore } from './report.js';
import { computeDomainHeatmap } from './analysis/heatmap.js';

export interface ArchitectureNarrative {
  title: string;
  paragraphs: string[];
  highlights: string[];
  centralDomain: string;
  impactPercentage: number;
  connectedDomains: string[];
  criticalJourneys: string[];
  riskDomains: string[];
}

export function buildArchitectureNarrative(memory: MemoryModel): ArchitectureNarrative {
  const capabilities = memory.capabilities ?? [];
  const journeys = memory.journeys ?? [];
  const heatmap = computeDomainHeatmap(memory);

  const domainCentrality = memory.domains.map((d) => {
    const services = memory.services.filter(
      (s) => s.domain === d.id || s.domain === d.name,
    );
    const apis = memory.apis.filter(
      (a) => a.domain === d.id || a.domain === d.name,
    );
    const deps = services.reduce((sum, s) => sum + s.dependencies.length + s.dependents.length, 0);
    return {
      domain: d,
      services: services.length,
      apis: apis.length,
      centrality: deps + d.nodes.length + apis.length * 2,
    };
  });

  const sorted = [...domainCentrality].sort((a, b) => b.centrality - a.centrality);
  const central = sorted[0];
  const centralDomain = central?.domain.name ?? 'Core';
  const totalCentrality = sorted.reduce((sum, d) => sum + d.centrality, 0);
  const impactPercentage =
    totalCentrality > 0 && central
      ? Math.min(99, Math.round((central.centrality / totalCentrality) * 100))
      : 0;

  const connectedDomains = sorted
    .slice(1, 4)
    .filter((d) => d.centrality > 0)
    .map((d) => d.domain.name);

  const criticalJourneys = journeys.slice(0, 5).map((j) => j.signature.name);
  const riskDomains = [...heatmap]
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 3)
    .map((h) => h.domain);

  const paragraphs: string[] = [];

  paragraphs.push(
    `${centralDomain} is the central domain of ${memory.repository}.`,
  );

  if (connectedDomains.length > 0) {
    paragraphs.push(
      `${centralDomain} connects ${connectedDomains.join(', ')} across the ${memory.architecture.type.toLowerCase()}.`,
    );
  }

  if (criticalJourneys.length > 0) {
    const count = criticalJourneys.length;
    paragraphs.push(
      `${count} critical user ${count === 1 ? 'journey depends' : 'journeys depend'} on ${centralDomain}: ${criticalJourneys.join(', ')}.`,
    );
  }

  if (impactPercentage > 0) {
    paragraphs.push(
      `A failure in ${centralDomain} impacts approximately ${impactPercentage}% of system functionality.`,
    );
  }

  if (capabilities.length > 0) {
    const top = capabilities.slice(0, 4).map((c) => c.signature.name);
    paragraphs.push(
      `The product delivers ${top.join(', ')} through ${memory.services.length} services and ${memory.apis.length} APIs.`,
    );
  }

  const highSmells = memory.smells.filter((s) => s.severity === 'high');
  if (highSmells.length > 0) {
    paragraphs.push(
      `${highSmells.length} high-severity architecture ${highSmells.length === 1 ? 'smell requires' : 'smells require'} attention — start with ${highSmells[0]?.type.replace(/_/g, ' ') ?? 'coupling issues'}.`,
    );
  } else if (memory.criticalPaths.length > 0) {
    paragraphs.push(
      `Watch ${memory.criticalPaths[0]?.name ?? 'critical paths'} — the highest-risk execution path in the system.`,
    );
  }

  const highlights: string[] = [];
  if (central) {
    highlights.push(`${centralDomain}: ${central.services} services, ${central.apis} APIs`);
  }
  for (const j of journeys.slice(0, 3)) {
    highlights.push(`${j.signature.name} journey`);
  }
  for (const c of capabilities.slice(0, 3)) {
    highlights.push(`${c.signature.name} capability`);
  }

  return {
    title: `Architecture Story — ${memory.repository}`,
    paragraphs,
    highlights,
    centralDomain,
    impactPercentage,
    connectedDomains,
    criticalJourneys,
    riskDomains,
  };
}

export function formatArchitectureStory(memory: MemoryModel): string {
  const narrative = buildArchitectureNarrative(memory);
  const score = computeMemoryScore(memory);
  const lines = [
    narrative.title,
    '',
    ...narrative.paragraphs,
    '',
    '—',
    `Repository Health: ${score.overall}/100`,
    `Domains: ${memory.domains.length} · Flows: ${memory.flows.length} · Journeys: ${(memory.journeys ?? []).length}`,
  ];
  return lines.join('\n');
}
