import type { MemoryModel } from './types.js';

export interface ReviewResult {
  changedFiles: string[];
  affectedDomains: string[];
  affectedFlows: string[];
  affectedCapabilities: string[];
  potentialRisks: string[];
  suggestedTests: string[];
  riskLevel: 'low' | 'medium' | 'high';
}

export function parseDiffPaths(diffContent: string): string[] {
  const paths = new Set<string>();
  for (const line of diffContent.split('\n')) {
    const match = line.match(/^(?:\+\+\+|---)\s+[ab]\/(.*)$/);
    if (match?.[1] && match[1] !== '/dev/null') {
      paths.add(match[1].replace(/\\/g, '/'));
    }
    const gitMatch = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
    if (gitMatch) {
      paths.add(gitMatch[2].replace(/\\/g, '/'));
    }
  }
  return [...paths];
}

export function reviewDiff(memory: MemoryModel, diffContent: string): ReviewResult {
  const changedFiles = parseDiffPaths(diffContent);
  const affectedDomains = new Set<string>();
  const affectedFlows = new Set<string>();
  const affectedCapabilities = new Set<string>();
  const potentialRisks: string[] = [];
  const suggestedTests: string[] = [];

  for (const file of changedFiles) {
    for (const domain of memory.domains) {
      const touches =
        domain.entryPoints.some((e) => file.includes(e) || e.includes(file)) ||
        domain.nodes.some((n) => n.includes(file) || file.includes(n));
      const serviceMatch = memory.services.some(
        (s) =>
          (s.path.includes(file) || file.includes(s.path)) &&
          (s.domain === domain.id || s.domain === domain.name),
      );
      if (touches || serviceMatch) {
        affectedDomains.add(domain.name);
      }
    }

    for (const flow of memory.flows) {
      const touches = flow.steps.some(
        (s) => s.path && (s.path.includes(file) || file.includes(s.path)),
      );
      if (touches || flow.entryPoint.includes(file)) {
        affectedFlows.add(flow.name);
      }
    }

    for (const cap of memory.capabilities ?? []) {
      const svcMatch = memory.services.some(
        (s) =>
          cap.services.includes(s.name) &&
          (s.path.includes(file) || file.includes(s.path)),
      );
      if (svcMatch) affectedCapabilities.add(cap.signature.name);
    }

    if (/test|spec|__tests__/i.test(file)) {
      suggestedTests.push(file);
    }
  }

  for (const domain of affectedDomains) {
    const critical = memory.criticalPaths.find((c) =>
      c.name.toLowerCase().includes(domain.toLowerCase()),
    );
    if (critical) {
      potentialRisks.push(`Breaks ${critical.name} critical path`);
    }
    const domainFlows = memory.flows.filter((f) =>
      f.description.toLowerCase().includes(domain.toLowerCase()),
    );
    if (domainFlows.length > 0) {
      potentialRisks.push(`May affect ${domain} flow (${domainFlows[0]?.name})`);
    }
  }

  for (const smell of memory.smells.filter((s) => s.severity === 'high')) {
    if (
      smell.type === 'layer_violation' &&
      changedFiles.some((f) => smell.description.includes(f))
    ) {
      potentialRisks.push('Removes or bypasses layer validation');
    }
  }

  for (const domain of affectedDomains) {
    for (const f of changedFiles.filter((file) => /test|spec/i.test(file)).slice(0, 3)) {
      suggestedTests.push(f);
    }

    const domainServices = memory.services.filter((s) => s.domain === domain);
    for (const svc of domainServices.slice(0, 2)) {
      suggestedTests.push(`tests for ${svc.name} (${svc.path})`);
    }
  }

  const riskLevel: ReviewResult['riskLevel'] =
    affectedDomains.size >= 3 || potentialRisks.length >= 3
      ? 'high'
      : affectedDomains.size >= 1 || affectedFlows.size >= 2
        ? 'medium'
        : 'low';

  return {
    changedFiles,
    affectedDomains: [...affectedDomains],
    affectedFlows: [...affectedFlows],
    affectedCapabilities: [...affectedCapabilities],
    potentialRisks: [...new Set(potentialRisks)].slice(0, 8),
    suggestedTests: [...new Set(suggestedTests)].slice(0, 12),
    riskLevel,
  };
}

export function formatReviewReport(result: ReviewResult): string {
  const lines = [
    'Pull Request Review',
    '='.repeat(50),
    '',
    `Risk Level: ${result.riskLevel.toUpperCase()}`,
    `Changed files: ${result.changedFiles.length}`,
    '',
    'Changes affect:',
    ...(result.affectedDomains.length > 0
      ? result.affectedDomains.map((d) => `- ${d}`)
      : ['- (no domains matched — may be config or docs)']),
    '',
    `Affected flows (${result.affectedFlows.length}):`,
    ...result.affectedFlows.slice(0, 8).map((f) => `  • ${f}`),
    '',
    `Affected capabilities (${result.affectedCapabilities.length}):`,
    ...result.affectedCapabilities.slice(0, 8).map((c) => `  • ${c}`),
    '',
    'Potential Risks:',
    ...(result.potentialRisks.length > 0
      ? result.potentialRisks.map((r) => `- ${r}`)
      : ['- None identified']),
    '',
    'Suggested Tests:',
    ...result.suggestedTests.slice(0, 10).map((t) => `- ${t}`),
  ];
  return lines.join('\n');
}
