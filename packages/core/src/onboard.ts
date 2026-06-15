import type { MemoryModel } from './types.js';
import { computeDomainHeatmap } from './analysis/heatmap.js';

export interface OnboardStep {
  order: number;
  title: string;
  domain: string;
  description: string;
  entryPoints: string[];
  estimatedMinutes: number;
}

export interface OnboardGuide {
  title: string;
  repository: string;
  steps: OnboardStep[];
  estimatedLearningHours: number;
  startHere: string[];
}

export function buildOnboardGuide(memory: MemoryModel): OnboardGuide {
  const heatmap = computeDomainHeatmap(memory);
  const heatById = new Map(heatmap.map((h) => [h.domainId, h]));

  const ranked = [...memory.domains]
    .map((d) => {
      const heat = heatById.get(d.id);
      const services = memory.services.filter(
        (s) => s.domain === d.id || s.domain === d.name,
      );
      const centrality = services.reduce((sum, s) => sum + s.dependents.length, 0);
      const isAuth =
        /auth|login|user|identity|session/i.test(d.name) ||
        /auth|login|user/i.test(d.description);
      return {
        domain: d,
        centrality,
        risk: heat?.riskScore ?? 0,
        isAuth,
        entryPoints: d.entryPoints.slice(0, 4),
      };
    })
    .sort((a, b) => {
      if (a.isAuth !== b.isAuth) return a.isAuth ? -1 : 1;
      return b.centrality - a.centrality;
    });

  const steps: OnboardStep[] = ranked.slice(0, 8).map((item, i) => ({
    order: i + 1,
    title: item.domain.name,
    domain: item.domain.name,
    description: item.domain.description || `Explore the ${item.domain.name} domain.`,
    entryPoints: item.entryPoints,
    estimatedMinutes: 15 + Math.min(30, item.domain.nodes.length),
  }));

  const totalMinutes = steps.reduce((sum, s) => sum + s.estimatedMinutes, 0);

  return {
    title: `Onboarding: ${memory.repository}`,
    repository: memory.repository,
    steps,
    estimatedLearningHours: Math.round((totalMinutes / 60) * 10) / 10,
    startHere: steps.slice(0, 4).map((s) => s.title),
  };
}

export function formatOnboardGuide(guide: OnboardGuide): string {
  const lines = [
    guide.title,
    '='.repeat(guide.title.length),
    '',
    'Start Here',
    '',
    ...guide.startHere.map((s, i) => `${i + 1}. ${s}`),
    '',
    `Expected learning time: ${guide.estimatedLearningHours} hours`,
    '',
    'Full Path',
    '',
    ...guide.steps.map(
      (s) =>
        `${s.order}. ${s.title} (~${s.estimatedMinutes} min)\n   ${s.description}\n   Entry: ${s.entryPoints.join(', ') || 'see domain files'}`,
    ),
  ];
  return lines.join('\n');
}
