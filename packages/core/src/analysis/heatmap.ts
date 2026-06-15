import type { ArchitectureSmell, DeadCodeEntry, Domain, MemoryModel } from '../types.js';

export interface DomainHeatmapEntry {
  domain: string;
  domainId: string;
  riskScore: number;
  risk: 'low' | 'medium' | 'high';
  problems: string[];
  circularDependencies: number;
  deadModules: number;
  highSmells: number;
  coupling: number;
  services: number;
  apis: number;
}

export function computeDomainHeatmap(memory: MemoryModel): DomainHeatmapEntry[] {
  return memory.domains.map((domain) => buildDomainHeatEntry(domain, memory));
}

function buildDomainHeatEntry(domain: Domain, memory: MemoryModel): DomainHeatmapEntry {
  const services = memory.services.filter(
    (s) => s.domain === domain.id || s.domain === domain.name,
  );
  const apis = memory.apis.filter(
    (a) => a.domain === domain.id || a.domain === domain.name,
  );
  const domainPaths = new Set(domain.entryPoints);
  for (const s of services) domainPaths.add(s.path);
  for (const a of apis) domainPaths.add(a.file);

  const smells = memory.smells.filter((s) => smellTouchesDomain(s, domainPaths, domain));
  const circular = smells.filter((s) => s.type === 'circular_dependency').length;
  const highSmells = smells.filter((s) => s.severity === 'high').length;
  const deadModules = countDeadInDomain(memory.deadCode, domainPaths);
  const coupling =
    services.length > 0
      ? services.reduce((sum, s) => sum + s.dependencies.length, 0) / services.length
      : 0;

  const problems: string[] = [];
  if (circular > 0) problems.push(`${circular} circular dependenc${circular === 1 ? 'y' : 'ies'}`);
  if (deadModules > 0) problems.push(`${deadModules} dead module${deadModules === 1 ? '' : 's'}`);
  if (highSmells > 0) problems.push(`${highSmells} high-severity smell${highSmells === 1 ? '' : 's'}`);
  if (coupling > 5) problems.push('High coupling');
  if (services.length === 0 && apis.length > 0) problems.push('APIs without backing services');

  const complexity = domain.nodes.length + services.length * 2 + apis.length * 3;
  let riskScore = Math.min(
    100,
    Math.round(
      circular * 12 +
        deadModules * 6 +
        highSmells * 10 +
        coupling * 4 +
        complexity * 0.3,
    ),
  );
  if (problems.length === 0) riskScore = Math.max(5, Math.round(complexity * 0.15));

  const risk: DomainHeatmapEntry['risk'] =
    riskScore >= 70 ? 'high' : riskScore >= 40 ? 'medium' : 'low';

  return {
    domain: domain.name,
    domainId: domain.id,
    riskScore,
    risk,
    problems,
    circularDependencies: circular,
    deadModules,
    highSmells,
    coupling: Math.round(coupling * 10) / 10,
    services: services.length,
    apis: apis.length,
  };
}

function smellTouchesDomain(
  smell: ArchitectureSmell,
  domainPaths: Set<string>,
  domain: Domain,
): boolean {
  if (smell.nodes.some((n) => domain.nodes.includes(n))) return true;
  return smell.description.toLowerCase().includes(domain.name.toLowerCase());
}

function countDeadInDomain(deadCode: DeadCodeEntry[], domainPaths: Set<string>): number {
  return deadCode.filter((d) => d.path && [...domainPaths].some((p) => d.path!.includes(p))).length;
}
