import type { HybridQueryHit } from './types.js';

/** Reciprocal Rank Fusion — merges multiple ranked lists without score normalization. */
export function reciprocalRankFusion<T extends { id: string }>(
  lists: Array<Array<T & { score?: number }>>,
  k = 60,
): Array<T & { score: number }> {
  const scores = new Map<string, number>();
  const items = new Map<string, T>();

  for (const list of lists) {
    list.forEach((item, rank) => {
      const prev = scores.get(item.id) ?? 0;
      scores.set(item.id, prev + 1 / (k + rank + 1));
      if (!items.has(item.id)) items.set(item.id, item);
    });
  }

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, score]) => ({ ...items.get(id)!, score }));
}

/** Apply confidence, decay weight, and recency boost to fused hits. */
export function rankHits(
  hits: HybridQueryHit[],
  opts: { recencyBoost?: boolean; builtAt?: string } = {},
): HybridQueryHit[] {
  const now = Date.now();
  return hits
    .map((h) => {
      let score = h.score * h.confidence * h.weight;
      if (opts.recencyBoost && h.kind === 'episode') {
        const ageHours = (now - new Date(opts.builtAt ?? h.snippet).getTime()) / 3_600_000;
        score *= Math.exp(-ageHours / 168); // 1-week half-life for episodes in ranking
      }
      return { ...h, score };
    })
    .sort((a, b) => b.score - a.score);
}

export function snippet(text: string, maxLen = 160): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen - 1)}…`;
}
