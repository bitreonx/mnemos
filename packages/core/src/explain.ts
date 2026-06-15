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
    'Unknown';

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
  ];

  if (result.aiRecommendations.length > 0) {
    lines.push('', 'AI Readiness Recommendations:');
    for (const r of result.aiRecommendations.slice(0, 4)) {
      lines.push(`• ${r}`);
    }
  }

  return lines.join('\n');
}

function isAuxiliaryDomainName(name: string): boolean {
  return /^(test|tests|spec|e2e|examples?|fixtures?|mocks?|stubs?|acceptance|general|packages)$/i.test(name.trim());
}
