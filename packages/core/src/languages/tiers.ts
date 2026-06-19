/**
 * Language parse tiers — drives edge confidence and trust manifest honesty.
 * Tier 1: full AST · Tier 2: profile regex · Tier 3: lexical fallback
 */

export type LanguageTier = 1 | 2 | 3;

const TIER1 = new Set(['typescript', 'javascript', 'python', 'go']);
const TIER2 = new Set([
  'rust', 'java', 'kotlin', 'csharp', 'ruby', 'php', 'swift', 'scala',
  'dart', 'elixir', 'erlang', 'haskell', 'lua', 'perl', 'r', 'julia',
  'zig', 'c', 'cpp', 'objc', 'vue', 'svelte',
]);

export function getLanguageTier(languageId: string): LanguageTier {
  if (TIER1.has(languageId)) return 1;
  if (TIER2.has(languageId)) return 2;
  if (languageId === 'unknown') return 3;
  return 2;
}

/** Base parse confidence for graph edges originating from this language. */
export function parseConfidenceForLanguage(languageId: string, usedAst: boolean): number {
  const tier = getLanguageTier(languageId);
  if (tier === 1) return usedAst ? 0.92 : 0.78;
  if (tier === 2) return 0.72;
  return 0.55;
}

export function tierLabel(tier: LanguageTier): string {
  if (tier === 1) return 'AST';
  if (tier === 2) return 'profile';
  return 'lexical';
}
