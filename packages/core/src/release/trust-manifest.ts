/**
 * Honest trust manifest — preempts enemy FUD with verifiable facts.
 * Every agent reads this before trusting memory output.
 */

import type { EngineManifest } from '../memory-engine/types.js';
import { MEMORY_ENGINE, PRODUCT } from './codenames.js';

export interface TrustClaim {
  id: string;
  claim: string;
  verified: boolean;
  detail: string;
}

export interface TrustLimitation {
  id: string;
  limitation: string;
  mitigation: string;
}

export interface TrustManifest {
  product: string;
  engine: string;
  privacy: 'local-only';
  generatedAt: string;
  claims: TrustClaim[];
  limitations: TrustLimitation[];
  honestyScore: number;
}

export function buildTrustManifest(manifest?: EngineManifest | null): TrustManifest {
  const embeddingBackend = manifest?.stats.embeddingBackend ?? 'hash';
  const storeBackend = manifest?.stats.storeBackend ?? 'unknown';

  const claims: TrustClaim[] = [
    {
      id: 'local-only',
      claim: 'No cloud, no telemetry, no external API calls during build or query',
      verified: true,
      detail: 'All indexing and retrieval runs on-device. Optional ONNX models cache locally after first download.',
    },
    {
      id: 'hybrid-retrieval',
      claim: 'Hybrid BM25 + vector search with reciprocal rank fusion',
      verified: !!manifest?.stats.hybridIndexReady,
      detail: manifest
        ? `${manifest.documentCount} documents · ${manifest.bm25DocumentCount} BM25 docs`
        : 'Engine not built yet',
    },
    {
      id: 'incremental',
      claim: 'SQLite incremental upserts by content hash',
      verified: storeBackend === 'node-sqlite' || storeBackend === 'sqljs',
      detail: `Store backend: ${storeBackend}`,
    },
    {
      id: 'contradictions',
      claim: 'Cross-build contradiction detection on structured facts',
      verified: (manifest?.factCount ?? 0) > 0,
      detail: manifest ? `${manifest.contradictionCount} active contradictions` : 'Not built',
    },
  ];

  const limitations: TrustLimitation[] = [
    {
      id: 'hash-embeddings',
      limitation:
        embeddingBackend === 'hash'
          ? 'Default embeddings are feature-hash (lexical), not neural semantic'
          : 'ONNX embeddings improve semantics but require optional @xenova/transformers',
      mitigation: 'Install @xenova/transformers for local MiniLM, or treat hash results as lexical match',
    },
    {
      id: 'graph-confidence',
      limitation: 'Graph edges carry confidence scores; low-confidence paths may be wrong on dynamic imports',
      mitigation: 'Check edge.confidence before impact analysis; prefer Tier-1 languages (TS, Python, Go)',
    },
    {
      id: 'benchmark-scope',
      limitation: 'Benchmarks cover Express and NestJS fixtures only — not proof for all codebases',
      mitigation: 'Run mnemos build on your repo; use mnemos doctor and trust manifest',
    },
    {
      id: 'dashboard-preview',
      limitation: 'Dashboard UI is preview; CLI, report, and AI Pack are stable surfaces',
      mitigation: 'Use mnemos pack, mnemos serve, and MCP tools for production agent workflows',
    },
  ];

  const verifiedCount = claims.filter((c) => c.verified).length;
  const honestyScore = Math.round((verifiedCount / claims.length) * 100);

  return {
    product: `${PRODUCT.codename} ${PRODUCT.semver}`,
    engine: MEMORY_ENGINE.codename,
    privacy: 'local-only',
    generatedAt: new Date().toISOString(),
    claims,
    limitations,
    honestyScore,
  };
}

export function formatTrustMarkdown(trust: TrustManifest): string {
  return [
    `# Mnemos Trust Manifest`,
    '',
    `- **Product:** ${trust.product}`,
    `- **Engine:** ${trust.engine}`,
    `- **Privacy:** ${trust.privacy}`,
    `- **Honesty score:** ${trust.honestyScore}/100 (verified claims only)`,
    '',
    '## Verified claims',
    ...trust.claims.map((c) => `- [${c.verified ? 'x' : ' '}] **${c.claim}** — ${c.detail}`),
    '',
    '## Known limitations (we do not hide these)',
    ...trust.limitations.map((l) => `- **${l.limitation}** → ${l.mitigation}`),
  ].join('\n');
}
