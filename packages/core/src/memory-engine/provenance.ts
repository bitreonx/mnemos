/**
 * Provenance — cited synthesis with honest "I don't know" (GBrain pattern).
 * No LLM required: template synthesis from ranked hits + confidence math.
 */

import type {
  HybridQueryHit,
  LoadedEngineIndex,
  MemoryEpisode,
  ProvenanceAnswer,
  ProvenanceCitation,
} from './types.js';
import { applyVeilToEpisodes, loadVeilPolicy } from './veil.js';
import type { MemorySearchIndex } from '../search/index.js';
import { hybridQuery } from './retrieval.js';

const CONFIDENCE_FLOOR = 0.35;
const STRONG_CONFIDENCE = 0.72;

export interface AskOptions {
  limit?: number;
  minConfidence?: number;
  embeddingMode?: import('./onnx-embeddings.js').EmbeddingMode;
}

function episodeForHit(index: LoadedEngineIndex, hit: HybridQueryHit): MemoryEpisode | undefined {
  return index.episodes.find((e) => e.id === hit.id);
}

function buildCitation(hit: HybridQueryHit, episode?: MemoryEpisode): ProvenanceCitation {
  const prov = episode?.provenance;
  return {
    episodeId: hit.id,
    excerpt: hit.snippet,
    sourceFile: prov?.sessionFile,
    line: prov?.citedLine,
    sessionId: prov?.sessionId,
    decidedAt: episode?.createdAt ?? new Date().toISOString(),
    decidedBy: episode?.scope?.owner ?? prov?.speaker,
    relevanceScore: hit.score,
  };
}

function computeConfidence(hits: HybridQueryHit[], contradictions: number): number {
  if (!hits.length) return 0;
  const top = hits[0]!.score;
  const avg = hits.slice(0, 5).reduce((s, h) => s + h.score, 0) / Math.min(5, hits.length);
  let c = Math.min(0.95, top * 0.55 + avg * 0.35);
  if (hits.length < 2) c *= 0.75;
  if (contradictions > 0) c *= 0.6;
  return Math.round(c * 1000) / 1000;
}

function synthesisLabel(confidence: number, hitCount: number): ProvenanceAnswer['synthesis'] {
  if (hitCount === 0 || confidence < CONFIDENCE_FLOOR) return 'insufficient';
  if (confidence >= STRONG_CONFIDENCE && hitCount >= 2) return 'grounded';
  return 'partial';
}

function buildAnswerText(query: string, hits: HybridQueryHit[], episodes: MemoryEpisode[]): string {
  if (!hits.length) {
    return `I could not find grounded memory for: "${query}".`;
  }

  const lines: string[] = [`Based on ${hits.length} memory source(s) for "${query}":`, ''];

  for (let i = 0; i < Math.min(3, hits.length); i++) {
    const hit = hits[i]!;
    const ep = episodes.find((e) => e.id === hit.id);
    const when = ep?.createdAt ? new Date(ep.createdAt).toISOString().slice(0, 10) : 'unknown date';
    const who = ep?.scope?.owner ?? ep?.provenance?.speaker ?? 'unknown';
    lines.push(`${i + 1}. ${hit.snippet}`);
    lines.push(`   — source: ${who}, ${when}${ep?.provenance?.sessionId ? `, session ${ep.provenance.sessionId}` : ''}`);
    lines.push('');
  }

  return lines.join('\n').trim();
}

function identifyGaps(query: string, hits: HybridQueryHit[]): string[] {
  const gaps: string[] = [];
  if (!hits.length) {
    gaps.push('No episodic or structural memory matched this query.');
    gaps.push('Try importing past sessions: mnemos memory chronoshift <path>');
    gaps.push('Or store a fact: mnemos memory remember "..."');
    return gaps;
  }

  if (hits.every((h) => h.kind !== 'episode')) {
    gaps.push('Only structural/code memory matched — no conversation history for this topic.');
  }

  if (hits[0]!.confidence < 0.65) {
    gaps.push('Top hit confidence is low — verify against source files before acting.');
  }

  const q = query.toLowerCase();
  if (q.includes('when') && !hits.some((h) => h.snippet.match(/\d{4}-\d{2}/))) {
    gaps.push('No explicit date found in matching memories.');
  }

  return gaps;
}

export async function synthesizeProvenanceAnswer(
  index: LoadedEngineIndex,
  searchIndex: MemorySearchIndex,
  engineDir: string,
  query: string,
  options: AskOptions = {},
): Promise<ProvenanceAnswer> {
  const started = Date.now();
  const veil = await loadVeilPolicy(engineDir);
  const visibleEpisodes = applyVeilToEpisodes(index.episodes, veil);

  const filteredIndex: LoadedEngineIndex = {
    ...index,
    episodes: visibleEpisodes,
    documents: index.documents.filter((d) => d.kind !== 'episode' || visibleEpisodes.some((e) => e.id === d.id)),
  };

  const result = await hybridQuery(filteredIndex, searchIndex, query, {
    limit: options.limit ?? 8,
    minConfidence: options.minConfidence,
    includeContradictions: true,
    embeddingMode: options.embeddingMode,
  });

  const hits = result.hits;
  const confidence = computeConfidence(hits, result.contradictions.length);
  const synthesis = synthesisLabel(confidence, hits.length);
  const admitsUnknown = synthesis === 'insufficient' || confidence < CONFIDENCE_FLOOR;

  const citations = hits.slice(0, 5).map((h) => buildCitation(h, episodeForHit(index, h)));
  const gaps = identifyGaps(query, hits);

  let unknownReason: string | undefined;
  if (admitsUnknown) {
    unknownReason =
      hits.length === 0
        ? 'No accessible memory matches this query under current Veil policy.'
        : `Confidence ${confidence.toFixed(2)} is below the honesty threshold (${CONFIDENCE_FLOOR}).`;
  }

  return {
    query,
    answer: buildAnswerText(query, hits, visibleEpisodes),
    confidence,
    admitsUnknown,
    unknownReason,
    citations,
    gaps,
    contradictions: result.contradictions.length,
    tookMs: Date.now() - started,
    synthesis,
  };
}

export function formatProvenanceMarkdown(answer: ProvenanceAnswer): string {
  const lines = [
    `# Provenance Answer`,
    '',
    `**Query:** ${answer.query}`,
    `**Confidence:** ${(answer.confidence * 100).toFixed(1)}% · **Synthesis:** ${answer.synthesis}`,
    '',
  ];

  if (answer.admitsUnknown) {
    lines.push('## ⚠ Honest gap');
    lines.push(answer.unknownReason ?? 'Insufficient evidence.');
    lines.push('');
  }

  lines.push('## Answer', answer.answer, '');

  if (answer.citations.length) {
    lines.push('## Citations');
    for (const c of answer.citations) {
      lines.push(`- \`${c.episodeId}\` (${(c.relevanceScore * 100).toFixed(0)}%) — ${c.excerpt}`);
      if (c.sourceFile) lines.push(`  - file: ${c.sourceFile}${c.line ? `:${c.line}` : ''}`);
      if (c.sessionId) lines.push(`  - session: ${c.sessionId}`);
      lines.push(`  - decided: ${c.decidedAt}${c.decidedBy ? ` by ${c.decidedBy}` : ''}`);
    }
    lines.push('');
  }

  if (answer.gaps.length) {
    lines.push('## Gaps');
    for (const g of answer.gaps) lines.push(`- ${g}`);
    lines.push('');
  }

  if (answer.contradictions > 0) {
    lines.push(`## Contradictions: ${answer.contradictions} unresolved — resolve before high-stakes edits.`);
    lines.push('');
  }

  return lines.join('\n');
}
