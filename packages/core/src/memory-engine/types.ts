/**
 * Mnemos Memory Engine — local-first AI memory infrastructure.
 * Release codename: Labyrinth (see release/codenames.ts).
 */

import { MEMORY_ENGINE } from '../release/codenames.js';

export const MEMORY_ENGINE_SCHEMA = MEMORY_ENGINE.schema;
export const MEMORY_ENGINE_CODENAME = MEMORY_ENGINE.codename;
/** @deprecated Use MEMORY_ENGINE_CODENAME — numeric generation kept for migration only */
export const MEMORY_ENGINE_VERSION = 3;
export const EMBEDDING_DIMS = 384;

export type MemoryDocumentKind =
  | 'domain'
  | 'service'
  | 'flow'
  | 'capability'
  | 'journey'
  | 'api'
  | 'critical_path'
  | 'smell'
  | 'file'
  | 'symbol'
  | 'episode'
  | 'fact';

export interface MemoryDocument {
  id: string;
  kind: MemoryDocumentKind;
  title: string;
  body: string;
  path?: string;
  tags: string[];
  /** Source confidence 0–1 (parser / inference quality). */
  confidence: number;
  /** Content hash for change detection. */
  contentHash: string;
  builtAt: string;
  /** Episodic documents use decay weight; structural docs stay at 1. */
  weight: number;
  source: 'build' | 'episode' | 'agent';
}

export interface MemoryFact {
  key: string;
  subject: string;
  predicate: string;
  object: string;
  confidence: number;
  documentId: string;
  builtAt: string;
}

export interface MemoryContradiction {
  id: string;
  key: string;
  subject: string;
  predicate: string;
  values: Array<{ object: string; documentId: string; builtAt: string; confidence: number }>;
  detectedAt: string;
  severity: 'low' | 'medium' | 'high';
  resolved: boolean;
}

export interface MemoryEpisode {
  id: string;
  content: string;
  tags: string[];
  source: 'agent' | 'user' | 'build';
  createdAt: string;
  lastAccessedAt: string;
  accessCount: number;
  weight: number;
  metadata?: Record<string, unknown>;
}

export interface EngineManifest {
  $schema: typeof MEMORY_ENGINE_SCHEMA;
  codename: typeof MEMORY_ENGINE_CODENAME;
  /** Migration generation — internal only */
  generation?: number;
  repository: string;
  builtAt: string;
  documentCount: number;
  episodeCount: number;
  factCount: number;
  contradictionCount: number;
  embeddingDims: number;
  bm25DocumentCount: number;
  stats: {
    buildDurationMs: number;
    hybridIndexReady: boolean;
    storeBackend?: 'node-sqlite' | 'sqljs' | 'json-fallback';
    embeddingBackend?: 'onnx' | 'hash';
    incrementalUpserted?: number;
    incrementalSkipped?: number;
  };
}

export interface HybridQueryHit {
  id: string;
  kind: MemoryDocumentKind;
  title: string;
  snippet: string;
  path?: string;
  score: number;
  bm25Rank?: number;
  vectorRank?: number;
  confidence: number;
  weight: number;
  tags: string[];
}

export interface HybridQueryResult {
  query: string;
  hits: HybridQueryHit[];
  contradictions: MemoryContradiction[];
  tookMs: number;
  retrievers: { bm25: number; vector: number; fused: number };
  warnings?: import('./quality-gate.js').QualityWarning[];
  embeddingBackend?: 'onnx' | 'hash';
}

export interface TaskContextPack {
  task: string;
  tokenBudget: number;
  estimatedTokens: number;
  documents: Array<{
    id: string;
    kind: MemoryDocumentKind;
    title: string;
    content: string;
    score: number;
  }>;
  contradictions: MemoryContradiction[];
  markdown: string;
}

export interface RememberInput {
  content: string;
  tags?: string[];
  source?: MemoryEpisode['source'];
  metadata?: Record<string, unknown>;
}

export interface BuildEngineOptions {
  outputDir: string;
  repository: string;
  verbose?: boolean;
}

export interface LoadedEngineIndex {
  manifest: EngineManifest;
  documents: MemoryDocument[];
  vectors: Map<string, Float32Array>;
  episodes: MemoryEpisode[];
  facts: MemoryFact[];
  contradictions: MemoryContradiction[];
}
