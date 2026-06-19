import type { EdgeKind } from '../types.js';
import { getLanguageTier } from '../languages/tiers.js';

/** Score graph edge reliability 0–1 for agent consumption. */
export function computeEdgeConfidence(
  kind: EdgeKind,
  metadata?: Record<string, unknown>,
  language?: string,
): number {
  let score: number;
  switch (kind) {
    case 'IMPORTS': {
      if (metadata?.isTypeOnly) score = 0.72;
      else if (metadata?.importSource?.toString().startsWith('.')) score = 0.92;
      else score = 0.78;
      break;
    }
    case 'DEPENDS_ON':
      score = 0.85;
      break;
    case 'CALLS':
      score = metadata?.resolved === true ? 0.88 : 0.45;
      break;
    case 'CONTAINS':
    case 'OWNS':
      score = 0.9;
      break;
    case 'EXPOSES':
      score = 0.93;
      break;
    case 'IMPLEMENTS':
      score = 0.8;
      break;
    default:
      score = 0.7;
  }

  if (language) {
    const tier = getLanguageTier(language);
    const langFactor = tier === 1 ? 1 : tier === 2 ? 0.88 : 0.72;
    score = Math.min(1, score * langFactor);
  }

  return score;
}

export function confidenceLabel(score: number): 'high' | 'medium' | 'low' {
  if (score >= 0.85) return 'high';
  if (score >= 0.65) return 'medium';
  return 'low';
}
