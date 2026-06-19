import type { MemoryEpisode } from './types.js';

/** Default half-life: 7 days — episodic memories fade unless re-accessed. */
export const DEFAULT_HALF_LIFE_HOURS = 168;
export const MIN_EPISODE_WEIGHT = 0.05;

export function decayWeight(
  episode: MemoryEpisode,
  halfLifeHours = DEFAULT_HALF_LIFE_HOURS,
  now = Date.now(),
): number {
  const lambda = Math.LN2 / halfLifeHours;
  const hoursSinceAccess = (now - new Date(episode.lastAccessedAt).getTime()) / 3_600_000;
  const hoursSinceCreate = (now - new Date(episode.createdAt).getTime()) / 3_600_000;
  const accessDecay = Math.exp(-lambda * hoursSinceAccess);
  const createDecay = Math.exp(-lambda * 0.25 * hoursSinceCreate);
  const accessBoost = 1 + Math.log1p(episode.accessCount) * 0.15;
  return episode.weight * accessDecay * createDecay * accessBoost;
}

export function applyDecayToEpisodes(
  episodes: MemoryEpisode[],
  halfLifeHours = DEFAULT_HALF_LIFE_HOURS,
): { episodes: MemoryEpisode[]; pruned: number } {
  const now = Date.now();
  const kept: MemoryEpisode[] = [];
  let pruned = 0;

  for (const ep of episodes) {
    const w = decayWeight(ep, halfLifeHours, now);
    if (w < MIN_EPISODE_WEIGHT) {
      pruned++;
      continue;
    }
    kept.push({ ...ep, weight: w });
  }

  return { episodes: kept, pruned };
}

export function touchEpisode(episode: MemoryEpisode): MemoryEpisode {
  return {
    ...episode,
    lastAccessedAt: new Date().toISOString(),
    accessCount: episode.accessCount + 1,
    weight: Math.min(1, episode.weight * 1.05),
  };
}

export function createEpisodeId(): string {
  return `episode:${Date.now()}:${Math.random().toString(36).slice(2, 9)}`;
}
