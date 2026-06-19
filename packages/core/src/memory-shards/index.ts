/**
 * Shared Agent Memory — pre-sharded, agent-ready context files.
 *
 * The point: instead of every AI agent re-reading the source tree and
 * rebuilding its own understanding, Mnemos analyzes the repo ONCE and
 * writes a set of focused shards that any agent (main or subagent) can
 * load on demand.
 *
 * Each shard is a small JSON envelope optimized for token economy.
 * Subagents load only the shards they need — no repeated exploration.
 */

import type { MemoryModel, Domain, Flow, ApiEndpoint, Service, CriticalPath, ArchitectureSmell } from '../types.js';
import { estimateTokens } from '../proxy/compress-output.js';

export const SHARD_SCHEMA_VERSION = 'mnemos/shared-memory/v1';

export type ShardKind =
  | 'domain'
  | 'flow'
  | 'api'
  | 'service'
  | 'capability'
  | 'journey'
  | 'critical-path'
  | 'dna';

export interface MemoryShard {
  $schema: typeof SHARD_SCHEMA_VERSION;
  kind: ShardKind;
  name: string;
  filename: string;
  builtAt: string;
  repository: string;
  estimatedTokens: number;
  bytes: number;
  data: Record<string, unknown>;
}

export interface MemoryShardSet {
  $schema: typeof SHARD_SCHEMA_VERSION;
  builtAt: string;
  repository: string;
  totalBytes: number;
  totalEstimatedTokens: number;
  shards: MemoryShard[];
  /** Quick lookup index by `kind:name`. */
  index: Record<string, MemoryShard>;
}

export interface ShardSummary {
  kind: ShardKind;
  name: string;
  filename: string;
  estimatedTokens: number;
}

export interface MemoryBudgetBucket {
  label: string;
  allocatedTokens: number;
  description: string;
}

export interface MemoryBudgetAllocation {
  totalBudget: number;
  buckets: MemoryBudgetBucket[];
  /** Each shard assigned to a bucket. */
  assignments: Array<{
    shard: ShardSummary;
    bucket: string;
    allocatedTokens: number;
    truncated: boolean;
  }>;
  unallocated: number;
}

export interface MemoryShardStats {
  repository: string;
  builtAt: string;
  totalShards: number;
  totalBytes: number;
  totalEstimatedTokens: number;
  rawMemoryTokens: number;
  compressionRatio: number;
  byKind: Array<{ kind: ShardKind; count: number; tokens: number }>;
  topShards: Array<ShardSummary & { estimatedTokens: number }>;
  /** How many agent requests this run saves. */
  subagentSavings: {
    withoutMnemos: number;
    withMnemos: number;
    savedPerRun: number;
    savedPercent: number;
  };
  aiReadinessScore: number;
}

/** Slugify a domain / flow / service name into a safe filename stem. */
export function shardSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60) || 'shard';
}

/** Compute the estimated token count of an already-serialized JSON shard. */
function tokensOf(serialized: string): number {
  return estimateTokens(serialized);
}

function makeShard(
  kind: ShardKind,
  name: string,
  data: Record<string, unknown>,
): { shard: MemoryShard; serialized: string } {
  const slug = shardSlug(name);
  const payload: Omit<MemoryShard, 'estimatedTokens' | 'bytes'> = {
    $schema: SHARD_SCHEMA_VERSION,
    kind,
    name,
    filename: `${slug}.memory.json`,
    builtAt: new Date().toISOString(),
    repository: '',
    data,
  };
  const serialized = JSON.stringify(payload);
  const shard: MemoryShard = {
    ...payload,
    estimatedTokens: tokensOf(serialized),
    bytes: serialized.length,
  };
  return { shard, serialized };
}

/** Resolve the file path a shard will be written to inside the .mnemos dir. */
export function shardFilePath(outputDir: string, shard: MemoryShard): string {
  return `${outputDir.replace(/\\/g, '/')}/${shard.filename}`;
}

/* ---------- shard builders ---------- */

interface ShardDraft {
  kind: ShardKind;
  name: string;
  data: Record<string, unknown>;
}

function buildDomainShards(memory: MemoryModel): ShardDraft[] {
  return memory.domains.slice(0, 80).map((d) => {
    const services = memory.services.filter(
      (s) => s.domain === d.id || s.domain === d.name,
    );
    const apis = memory.apis.filter(
      (a) => a.domain === d.id || a.domain === d.name,
    );
    const capabilities = (memory.capabilities ?? [])
      .filter((c) => c.domains.includes(d.id) || c.domains.includes(d.name))
      .map((c) => ({
        id: c.id,
        name: c.signature.name,
        confidence: c.confidence,
        services: c.services.slice(0, 6),
        apis: c.apis.slice(0, 6),
      }));
    const journeys = (memory.journeys ?? [])
      .filter((j) =>
        j.steps.some((s) => d.nodes.includes(s.nodeId) || services.some((sv) => sv.name === s.name)),
      )
      .map((j) => ({ id: j.id, name: j.signature.name, confidence: j.confidence }));

    return {
      kind: 'domain' as const,
      name: d.name,
      data: {
        id: d.id,
        name: d.name,
        description: d.description,
        confidence: d.confidence,
        entryPoints: d.entryPoints,
        services: services.map((s) => ({
          id: s.id,
          name: s.name,
          path: s.path,
          dependencies: s.dependencies,
          exports: s.exports.slice(0, 10),
        })),
        apis: apis.map((a) => ({
          id: a.id,
          method: a.method,
          path: a.path,
          handler: a.handler,
          file: a.file,
        })),
        capabilities,
        journeys,
        nodeCount: d.nodes.length,
      },
    };
  });
}

function buildFlowShards(memory: MemoryModel): ShardDraft[] {
  return memory.flows.slice(0, 80).map((f) => ({
    kind: 'flow' as const,
    name: f.name,
    data: {
      id: f.id,
      name: f.name,
      type: f.type,
      description: f.description,
      confidence: f.confidence,
      entryPoint: f.entryPoint,
      steps: f.steps.map((s) => ({
        name: s.name,
        kind: s.kind,
        path: s.path,
      })),
      stepCount: f.steps.length,
    },
  }));
}

function buildApiShards(memory: MemoryModel): ShardDraft[] {
  return memory.apis.slice(0, 80).map((a) => ({
    kind: 'api' as const,
    name: `${a.method} ${a.path}`,
    data: {
      id: a.id,
      method: a.method,
      path: a.path,
      handler: a.handler,
      file: a.file,
      domain: a.domain,
    },
  }));
}

function buildServiceShards(memory: MemoryModel): ShardDraft[] {
  return memory.services.slice(0, 80).map((s) => ({
    kind: 'service' as const,
    name: s.name,
    data: {
      id: s.id,
      name: s.name,
      path: s.path,
      domain: s.domain,
      exports: s.exports.slice(0, 15),
      dependencies: s.dependencies,
      dependents: s.dependents,
    },
  }));
}

function buildCapabilityShards(memory: MemoryModel): ShardDraft[] {
  return (memory.capabilities ?? []).slice(0, 80).map((c) => ({
    kind: 'capability' as const,
    name: c.signature.name,
    data: {
      id: c.id,
      name: c.signature.name,
      purpose: c.signature.purpose,
      category: c.signature.category,
      confidence: c.confidence,
      services: c.services,
      apis: c.apis,
      domains: c.domains,
    },
  }));
}

function buildJourneyShards(memory: MemoryModel): ShardDraft[] {
  return (memory.journeys ?? []).slice(0, 60).map((j) => ({
    kind: 'journey' as const,
    name: j.signature.name,
    data: {
      id: j.id,
      name: j.signature.name,
      purpose: j.signature.purpose,
      actors: j.actors,
      outcomes: j.outcomes,
      entryPoint: j.entryPoint,
      entryRoute: j.entryRoute,
      confidence: j.confidence,
      steps: j.steps.map((s) => ({ name: s.name, kind: s.kind, path: s.path })),
    },
  }));
}

function buildCriticalPathShards(memory: MemoryModel): ShardDraft[] {
  return memory.criticalPaths.slice(0, 40).map((c) => ({
    kind: 'critical-path' as const,
    name: c.name,
    data: {
      id: c.id,
      name: c.name,
      risk: c.risk,
      description: c.description,
      nodeCount: c.nodes.length,
    },
  }));
}

function buildDnaShard(memory: MemoryModel): ShardDraft[] {
  return [
    {
      kind: 'dna' as const,
      name: 'repository.dna',
      data: {
        repository: memory.repository,
        builtAt: memory.builtAt,
        architecture: memory.architecture,
        stats: memory.stats,
        domainCount: memory.domains.length,
        flowCount: memory.flows.length,
        apiCount: memory.apis.length,
        serviceCount: memory.services.length,
        journeyCount: (memory.journeys ?? []).length,
        capabilityCount: (memory.capabilities ?? []).length,
        criticalPathCount: memory.criticalPaths.length,
        smellCount: memory.smells.length,
        smells: memory.smells.slice(0, 12).map((s: ArchitectureSmell) => ({
          id: s.id,
          type: s.type,
          severity: s.severity,
          description: s.description,
        })),
      },
    },
  ];
}

/* ---------- public API ---------- */

/**
 * Build the full set of memory shards from a built memory model.
 * No I/O. Cheap to recompute.
 */
export function buildMemoryShards(memory: MemoryModel): MemoryShardSet {
  const raw = JSON.stringify(memory);
  const rawTokens = estimateTokens(raw);
  void rawTokens;

  const builders: Array<() => ShardDraft[]> = [
    () => buildDomainShards(memory),
    () => buildFlowShards(memory),
    () => buildApiShards(memory),
    () => buildServiceShards(memory),
    () => buildCapabilityShards(memory),
    () => buildJourneyShards(memory),
    () => buildCriticalPathShards(memory),
    () => buildDnaShard(memory),
  ];

  const drafts: ShardDraft[] = [];
  for (const build of builders) {
    for (const draft of build()) drafts.push(draft);
  }

  const builtAt = new Date().toISOString();
  // Deduplicate by filename so we never write the same file twice. Falls back
  // to `kind:name` to catch purely-same-name shards that happen to slugify
  // differently.
  const seen = new Map<string, MemoryShard>();

  for (const d of drafts) {
    const { shard } = makeShard(d.kind, d.name, d.data);
    shard.builtAt = builtAt;
    shard.repository = memory.repository;
    const primaryKey = `file:${shard.filename}`;
    const secondaryKey = `${shard.kind}:${shard.name}`;
    if (seen.has(primaryKey)) continue;
    if (seen.has(secondaryKey)) continue;
    seen.set(primaryKey, shard);
    seen.set(secondaryKey, shard);
  }

  const unique = [...new Set(seen.values())].sort((a, b) => a.filename.localeCompare(b.filename));

  const index: Record<string, MemoryShard> = {};
  let totalBytes = 0;
  let totalTokens = 0;
  for (const s of unique) {
    index[`${s.kind}:${s.name}`] = s;
    totalBytes += s.bytes;
    totalTokens += s.estimatedTokens;
  }

  return {
    $schema: SHARD_SCHEMA_VERSION,
    builtAt,
    repository: memory.repository,
    totalBytes,
    totalEstimatedTokens: totalTokens,
    shards: unique,
    index,
  };
}

/**
 * Write every shard to disk as `<outputDir>/<slug>.memory.json`,
 * plus `repository.dna.json` for the canonical DNA shard.
 * Returns the list of file paths written.
 */
export async function writeMemoryShards(
  set: MemoryShardSet,
  outputDir: string,
): Promise<{ files: string[]; manifestPath: string }> {
  const { writeFile, mkdir } = await import('node:fs/promises');
  const { join } = await import('node:path');
  await mkdir(outputDir, { recursive: true });

  const files: string[] = [];
  for (const shard of set.shards) {
    const path = join(outputDir, shard.filename);
    await writeFile(path, JSON.stringify(shard, null, 2), 'utf-8');
    files.push(path);

    if (shard.kind === 'dna') {
      // Stable alias name for backward compatibility with the existing
      // `project.dna.json` / `repository.dna.json` consumers.
      await writeFile(join(outputDir, 'repository.dna.json'), JSON.stringify(shard, null, 2), 'utf-8');
      files.push(join(outputDir, 'repository.dna.json'));
    }
  }

  const manifestPath = join(outputDir, 'shared-memory.manifest.json');
  const manifest = {
    $schema: SHARD_SCHEMA_VERSION,
    repository: set.repository,
    builtAt: set.builtAt,
    totalShards: set.shards.length,
    totalBytes: set.totalBytes,
    totalEstimatedTokens: set.totalEstimatedTokens,
    shards: set.shards.map((s) => ({
      kind: s.kind,
      name: s.name,
      filename: s.filename,
      estimatedTokens: s.estimatedTokens,
      bytes: s.bytes,
    })),
  };
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  files.push(manifestPath);

  return { files, manifestPath };
}

/**
 * Load a previously written shard set from disk.
 * Returns null if the manifest is missing.
 */
export async function loadMemoryShardSet(outputDir: string): Promise<MemoryShardSet | null> {
  const { readFile } = await import('node:fs/promises');
  const { join } = await import('node:path');

  try {
    const raw = await readFile(join(outputDir, 'shared-memory.manifest.json'), 'utf-8');
    const manifest = JSON.parse(raw) as {
      repository: string;
      builtAt: string;
      totalShards: number;
      totalBytes: number;
      totalEstimatedTokens: number;
      shards: Array<{ kind: ShardKind; name: string; filename: string; estimatedTokens: number; bytes: number }>;
    };

    const shards: MemoryShard[] = [];
    const index: Record<string, MemoryShard> = {};
    for (const ref of manifest.shards) {
      try {
        const shardRaw = await readFile(join(outputDir, ref.filename), 'utf-8');
        const shard = JSON.parse(shardRaw) as MemoryShard;
        shards.push(shard);
        index[`${shard.kind}:${shard.name}`] = shard;
      } catch {
        // skip missing shards but keep going
      }
    }

    return {
      $schema: SHARD_SCHEMA_VERSION,
      builtAt: manifest.builtAt,
      repository: manifest.repository,
      totalBytes: manifest.totalBytes,
      totalEstimatedTokens: manifest.totalEstimatedTokens,
      shards,
      index,
    };
  } catch {
    return null;
  }
}

/**
 * Allocate a token budget across the most-important buckets.
 * Buckets: Architecture, Flows, Domains, APIs, Critical Paths.
 * The remainder is reported as `unallocated`.
 */
export function allocateTokenBudget(set: MemoryShardSet, budget: number): MemoryBudgetAllocation {
  const buckets: MemoryBudgetBucket[] = [
    { label: 'Architecture', allocatedTokens: 0, description: 'High-level shape: layers, languages, dna.' },
    { label: 'Flows', allocatedTokens: 0, description: 'Execution flows through the call graph.' },
    { label: 'Domains', allocatedTokens: 0, description: 'Per-domain services, APIs, capabilities.' },
    { label: 'APIs', allocatedTokens: 0, description: 'Routes and endpoints.' },
    { label: 'Critical Paths', allocatedTokens: 0, description: 'High-fan-in / blast-radius hotspots.' },
  ];

  const totalEstimated = set.totalEstimatedTokens || 1;
  const ratios: Record<string, number> = {
    Architecture: 0.3,
    Flows: 0.2,
    Domains: 0.25,
    APIs: 0.15,
    'Critical Paths': 0.1,
  };

  for (const b of buckets) {
    const ratio = ratios[b.label] ?? 0;
    b.allocatedTokens = Math.round(budget * ratio);
  }

  const assignments: MemoryBudgetAllocation['assignments'] = [];
  const used: Record<string, number> = Object.fromEntries(buckets.map((b) => [b.label, 0]));

  // Sort shards by descending importance: dna > flow > domain > critical-path > capability > api > service > journey
  const weight: Record<ShardKind, number> = {
    dna: 10,
    flow: 8,
    domain: 7,
    'critical-path': 6,
    capability: 5,
    api: 4,
    service: 3,
    journey: 2,
  };

  const ordered = [...set.shards].sort((a, b) => (weight[b.kind] ?? 0) - (weight[a.kind] ?? 0));

  for (const shard of ordered) {
    const bucketLabel = bucketFor(shard);
    if (!bucketLabel) continue;
    const bucketObj = buckets.find((b) => b.label === bucketLabel);
    if (!bucketObj) continue;
    const remaining = bucketObj.allocatedTokens - used[bucketLabel];
    if (remaining <= 0) continue;
    const tokens = shard.estimatedTokens;
    const fits = Math.min(tokens, remaining);
    const truncated = fits < tokens;
    used[bucketLabel] += fits;
    assignments.push({
      shard: {
        kind: shard.kind,
        name: shard.name,
        filename: shard.filename,
        estimatedTokens: shard.estimatedTokens,
      },
      bucket: bucketLabel,
      allocatedTokens: fits,
      truncated,
    });
  }

  const totalAllocated = assignments.reduce((sum, a) => sum + a.allocatedTokens, 0);
  const unallocated = Math.max(0, budget - totalAllocated);

  // Touch totalEstimated to keep the symbol referenced for future use.
  void totalEstimated;

  return { totalBudget: budget, buckets, assignments, unallocated };
}

function bucketFor(shard: MemoryShard): string | null {
  switch (shard.kind) {
    case 'dna':
      return 'Architecture';
    case 'flow':
      return 'Flows';
    case 'domain':
      return 'Domains';
    case 'api':
      return 'APIs';
    case 'critical-path':
      return 'Critical Paths';
    case 'service':
    case 'capability':
    case 'journey':
      // These fall through to whichever bucket has remaining capacity.
      return 'Domains';
    default:
      return null;
  }
}

/**
 * Compute headline stats for the Shared Agent Memory feature.
 */
export function getMemoryStats(set: MemoryShardSet): MemoryShardStats {
  const byKindMap = new Map<ShardKind, { count: number; tokens: number }>();
  for (const s of set.shards) {
    const cur = byKindMap.get(s.kind) ?? { count: 0, tokens: 0 };
    cur.count += 1;
    cur.tokens += s.estimatedTokens;
    byKindMap.set(s.kind, cur);
  }
  const byKind = [...byKindMap.entries()]
    .map(([kind, v]) => ({ kind, count: v.count, tokens: v.tokens }))
    .sort((a, b) => b.tokens - a.tokens);

  const topShards = [...set.shards]
    .sort((a, b) => b.estimatedTokens - a.estimatedTokens)
    .slice(0, 8)
    .map((s) => ({
      kind: s.kind,
      name: s.name,
      filename: s.filename,
      estimatedTokens: s.estimatedTokens,
    }));

  // Heuristic: a subagent without Mnemos would re-read 5-20 relevant files
  // per task (~6k tokens average). With Mnemos it loads a single shard.
  const SHARDS_LOADED_PER_AGENT = 1;
  const FILES_READ_WITHOUT_MNEMOS = 8;
  const TOKENS_PER_FILE_AVG = 800;
  const withoutMnemos = FILES_READ_WITHOUT_MNEMOS * TOKENS_PER_FILE_AVG;
  const topShardTokens = topShards[0]?.estimatedTokens ?? 600;
  const withMnemos = topShardTokens;
  const savedPerRun = Math.max(0, withoutMnemos - withMnemos);
  const savedPercent = withoutMnemos > 0 ? Math.round((savedPerRun / withoutMnemos) * 100) : 0;

  return {
    repository: set.repository,
    builtAt: set.builtAt,
    totalShards: set.shards.length,
    totalBytes: set.totalBytes,
    totalEstimatedTokens: set.totalEstimatedTokens,
    rawMemoryTokens: estimateTokens(JSON.stringify(set.shards)),
    compressionRatio: set.totalBytes > 0 ? Math.round((set.totalEstimatedTokens / (set.totalBytes / 4)) * 100) / 100 : 0,
    byKind,
    topShards,
    subagentSavings: {
      withoutMnemos,
      withMnemos,
      savedPerRun,
      savedPercent,
    },
    aiReadinessScore: Math.min(
      100,
      Math.round(
        40 +
          Math.min(30, set.shards.length / 2) +
          Math.min(30, set.totalEstimatedTokens / 400),
      ),
    ),
  };
}

/** Find a shard by `kind:name`, with case-insensitive partial matching. */
export function findShard(set: MemoryShardSet, kind: ShardKind, name: string): MemoryShard | null {
  const direct = set.index[`${kind}:${name}`];
  if (direct) return direct;

  const lower = name.toLowerCase();
  for (const s of set.shards) {
    if (s.kind !== kind) continue;
    if (s.name.toLowerCase() === lower) return s;
  }
  for (const s of set.shards) {
    if (s.kind !== kind) continue;
    const sl = s.name.toLowerCase();
    if (sl.includes(lower) || lower.includes(sl)) return s;
  }
  return null;
}

/**
 * Resolve a domain shard by name (case-insensitive, partial match).
 */
export function findDomainShard(set: MemoryShardSet, name: string): MemoryShard | null {
  const lower = name.toLowerCase();
  for (const s of set.shards) {
    if (s.kind !== 'domain') continue;
    if (s.name.toLowerCase() === lower) return s;
  }
  for (const s of set.shards) {
    if (s.kind !== 'domain') continue;
    const sl = s.name.toLowerCase();
    if (sl.includes(lower) || lower.includes(sl)) return s;
  }
  return null;
}

/** Resolve a flow shard by name. */
export function findFlowShard(set: MemoryShardSet, name: string): MemoryShard | null {
  return findShard(set, 'flow', name);
}

export { analyzeShardImpact } from './impact.js';
export type { ShardImpactResult } from './impact.js';
