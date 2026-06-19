/**
 * Impact lookup against a pre-built shard set.
 * No graph traversal — uses the pre-computed fan-in / dependents that already
 * exist in service / domain shards. Fast, read-only.
 */

import type { MemoryShard, MemoryShardSet } from './index.js';

export interface ShardImpactResult {
  node: string;
  matchedShard: { kind: string; name: string } | null;
  affectedDomains: string[];
  affectedApis: string[];
  affectedServices: string[];
  affectedFlows: string[];
  totalAffected: number;
  risk: 'low' | 'medium' | 'high';
  reason: string;
}

/**
 * Find a shard by free-text node name (kind:service / kind:domain / kind:api).
 * Returns the matched shard (if any) and the impact propagation through the set.
 */
export function analyzeShardImpact(
  set: MemoryShardSet,
  query: string,
): ShardImpactResult {
  const lower = query.toLowerCase();
  let matchedShard: MemoryShard | null = null;

  for (const s of set.shards) {
    if (s.kind === 'service' && (s.name.toLowerCase() === lower || s.name.toLowerCase().includes(lower))) {
      matchedShard = s;
      break;
    }
  }

  if (!matchedShard) {
    for (const s of set.shards) {
      if (s.kind === 'domain' && (s.name.toLowerCase() === lower || s.name.toLowerCase().includes(lower))) {
        matchedShard = s;
        break;
      }
    }
  }

  if (!matchedShard) {
    for (const s of set.shards) {
      if (s.kind === 'api' && s.name.toLowerCase().includes(lower)) {
        matchedShard = s;
        break;
      }
    }
  }

  if (!matchedShard) {
    for (const s of set.shards) {
      if (s.name.toLowerCase().includes(lower)) {
        matchedShard = s;
        break;
      }
    }
  }

  if (!matchedShard) {
    return {
      node: query,
      matchedShard: null,
      affectedDomains: [],
      affectedApis: [],
      affectedServices: [],
      affectedFlows: [],
      totalAffected: 0,
      risk: 'low',
      reason: 'No shard matched the requested node.',
    };
  }

  const affectedDomains = new Set<string>();
  const affectedApis = new Set<string>();
  const affectedServices = new Set<string>();
  const affectedFlows = new Set<string>();

  if (matchedShard.kind === 'service') {
    const data = matchedShard.data as {
      name: string;
      domain?: string;
      dependencies?: string[];
      dependents?: string[];
    };
    if (data.domain) affectedDomains.add(data.domain);
    for (const dep of data.dependents ?? []) affectedServices.add(dep);

    // Reverse propagate: any domain shard that lists this service as a dependency.
    for (const s of set.shards) {
      if (s.kind !== 'domain') continue;
      const dData = s.data as { services?: Array<{ name: string; dependencies?: string[] }> };
      const referenced = dData.services?.some((sv) =>
        sv.name === data.name || (sv.dependencies ?? []).includes(data.name),
      );
      if (referenced) affectedDomains.add(s.name);
    }
    // APIs in the same domain are also impacted.
    for (const s of set.shards) {
      if (s.kind !== 'api') continue;
      const aData = s.data as { domain?: string };
      if (aData.domain && aData.domain === data.domain) affectedApis.add(s.name);
    }
  } else if (matchedShard.kind === 'domain') {
    affectedDomains.add(matchedShard.name);
    const data = matchedShard.data as { services?: Array<{ name: string }>; apis?: Array<{ method: string; path: string }> };
    for (const sv of data.services ?? []) affectedServices.add(sv.name);
    for (const api of data.apis ?? []) affectedApis.add(`${api.method} ${api.path}`);

    // Any flow that references the domain name in its steps.
    for (const s of set.shards) {
      if (s.kind !== 'flow') continue;
      const fData = s.data as { steps?: Array<{ name: string }> };
      const flowSteps = fData.steps ?? [];
      if (flowSteps.some((st) => affectedServices.has(st.name) || st.name.toLowerCase().includes(matchedShard!.name.toLowerCase()))) {
        affectedFlows.add(s.name);
      }
    }
  } else if (matchedShard.kind === 'api') {
    affectedApis.add(matchedShard.name);
    const data = matchedShard.data as { domain?: string };
    if (data.domain) affectedDomains.add(data.domain);
  }

  // Final tally
  const totalAffected =
    affectedDomains.size + affectedApis.size + affectedServices.size + affectedFlows.size;
  const risk: ShardImpactResult['risk'] = totalAffected > 30 ? 'high' : totalAffected > 10 ? 'medium' : 'low';

  return {
    node: query,
    matchedShard: { kind: matchedShard.kind, name: matchedShard.name },
    affectedDomains: [...affectedDomains],
    affectedApis: [...affectedApis],
    affectedServices: [...affectedServices],
    affectedFlows: [...affectedFlows],
    totalAffected,
    risk,
    reason: `Propagation through ${matchedShard.kind} shard "${matchedShard.name}".`,
  };
}
