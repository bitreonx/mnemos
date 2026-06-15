import type { MemoryModel } from './types.js';
import { computeMemoryScore } from './report.js';

export interface AiReadinessResult {
  score: number;
  breakdown: {
    domainSeparation: number;
    flowClarity: number;
    dependencyQuality: number;
    documentationQuality: number;
    contextDensity: number;
    contextDiscoverability: number;
  };
  recommendations: string[];
}

export function computeAiReadiness(memory: MemoryModel): AiReadinessResult {
  const memoryScore = computeMemoryScore(memory);

  const servicesWithDomain = memory.services.filter((s) => s.domain).length;
  const domainSeparation =
    memory.services.length > 0
      ? Math.round((servicesWithDomain / memory.services.length) * 100)
      : 100;

  const flowsWithSteps = memory.flows.filter((f) => f.steps.length >= 2).length;
  const flowClarity =
    memory.flows.length > 0
      ? Math.round((flowsWithSteps / memory.flows.length) * 100)
      : 50;

  const dependencyQuality = memoryScore.dependencyComplexity;

  const documentationQuality = memoryScore.documentationQuality;

  const contextDensity = Math.min(
    100,
    Math.round(
      (memory.domains.length * 5 +
        memory.flows.length * 3 +
        memory.apis.length * 2 +
        (memory.capabilities?.length ?? 0) * 4) /
        Math.max(1, memory.stats.filesScanned / 50),
    ),
  );

  const contextDiscoverability = memoryScore.discoverability;

  const score = Math.round(
    domainSeparation * 0.2 +
      flowClarity * 0.15 +
      dependencyQuality * 0.15 +
      documentationQuality * 0.15 +
      contextDensity * 0.15 +
      contextDiscoverability * 0.2,
  );

  const recommendations = buildRecommendations(memory, {
    domainSeparation,
    flowClarity,
    documentationQuality,
    dependencyQuality,
  });

  return {
    score,
    breakdown: {
      domainSeparation,
      flowClarity,
      dependencyQuality,
      documentationQuality,
      contextDensity,
      contextDiscoverability,
    },
    recommendations,
  };
}

function buildRecommendations(
  memory: MemoryModel,
  scores: {
    domainSeparation: number;
    flowClarity: number;
    documentationQuality: number;
    dependencyQuality: number;
  },
): string[] {
  const recs: string[] = [];

  if (scores.documentationQuality < 70) {
    const weak = memory.domains
      .filter((d) => !d.description || d.description.length < 20)
      .slice(0, 2);
    for (const d of weak) {
      recs.push(`Add documentation to ${d.name} domain.`);
    }
  }

  if (scores.domainSeparation < 75) {
    const undomain = memory.services.filter((s) => !s.domain).slice(0, 2);
    if (undomain.length > 0) {
      recs.push(`Assign domain labels to services like ${undomain.map((s) => s.name).join(', ')}.`);
    }
  }

  if (scores.dependencyQuality < 70 && memory.domains.length >= 2) {
    const [a, b] = memory.domains.slice(0, 2);
    if (a && b) {
      recs.push(`Reduce coupling between ${a.name} and ${b.name}.`);
    }
  }

  if (scores.flowClarity < 60) {
    recs.push('Add clear entry points (routes, handlers) to improve flow discoverability.');
  }

  const highSmells = memory.smells.filter((s) => s.severity === 'high').slice(0, 2);
  for (const s of highSmells) {
    recs.push(s.recommendation);
  }

  if (recs.length === 0) {
    recs.push('Repository is well-structured for AI agents. Point agents at project.dna.json first.');
  }

  return recs.slice(0, 6);
}
