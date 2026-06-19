import type { HybridQueryHit, HybridQueryResult } from './types.js';

export interface QualityWarning {
  code: string;
  message: string;
  severity: 'info' | 'warn' | 'critical';
}

export function assessQueryQuality(
  hits: HybridQueryHit[],
  contradictions: number,
  embeddingBackend?: 'onnx' | 'hash',
): QualityWarning[] {
  const warnings: QualityWarning[] = [];

  if (embeddingBackend === 'hash') {
    warnings.push({
      code: 'LEXICAL_EMBEDDINGS',
      message: 'Using lexical hash embeddings — semantic paraphrases may rank lower. Install @xenova/transformers for local neural embeddings.',
      severity: 'info',
    });
  }

  const lowConf = hits.filter((h) => h.confidence < 0.65);
  if (lowConf.length > hits.length / 2 && hits.length > 0) {
    warnings.push({
      code: 'LOW_CONFIDENCE_HITS',
      message: `${lowConf.length}/${hits.length} hits have confidence < 0.65 — verify against source before acting.`,
      severity: 'warn',
    });
  }

  if (contradictions > 0) {
    warnings.push({
      code: 'CONTRADICTIONS',
      message: `${contradictions} architecture contradiction(s) detected — resolve before high-stakes edits.`,
      severity: 'critical',
    });
  }

  if (hits.length === 0) {
    warnings.push({
      code: 'NO_HITS',
      message: 'No memory hits — try broader terms or run mnemos build after recent changes.',
      severity: 'warn',
    });
  }

  return warnings;
}

export function attachQualityWarnings(result: HybridQueryResult, embeddingBackend?: 'onnx' | 'hash'): HybridQueryResult {
  const warnings = assessQueryQuality(result.hits, result.contradictions.length, embeddingBackend);
  return { ...result, warnings };
}

export function formatWarningsMarkdown(warnings: QualityWarning[]): string {
  if (!warnings.length) return '';
  return ['## Quality signals', ...warnings.map((w) => `- **${w.severity}** \`${w.code}\`: ${w.message}`)].join('\n');
}
