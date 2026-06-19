import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import type {
  EngineManifest,
  LoadedEngineIndex,
  MemoryContradiction,
  MemoryDocument,
  MemoryEpisode,
  MemoryFact,
} from './types.js';
import { MEMORY_ENGINE_SCHEMA, MEMORY_ENGINE_CODENAME, EMBEDDING_DIMS } from './types.js';
import { normalizeEngineManifest } from './manifest-normalize.js';
import { embedLocal, serializeVector, deserializeVector } from './embeddings.js';
import { persistToSqlite, loadFromSqlite } from './sqlite-store.js';

const MANIFEST = 'manifest.json';
const DOCUMENTS = 'documents.json';
const VECTORS = 'vector-index.json';
const FACTS = 'facts.json';
const CONTRADICTIONS = 'contradictions.json';

export function engineDirFor(outputDir: string): string {
  return path.join(outputDir, 'engine');
}

export async function engineExists(outputDir: string): Promise<boolean> {
  const dir = engineDirFor(outputDir);
  for (const f of [MANIFEST, 'memory.db']) {
    try {
      await access(path.join(dir, f));
      return true;
    } catch {
      // try next
    }
  }
  return false;
}

interface VectorIndexFile {
  version: 1;
  dims: number;
  entries: Array<{ id: string; v: string }>;
}

/** M2 primary path: SQLite. JSON fallback when SQLite unavailable. */
export async function persistEngineIndex(
  outputDir: string,
  data: {
    repository: string;
    documents: MemoryDocument[];
    vectors: Map<string, Float32Array>;
    episodes: MemoryEpisode[];
    facts: MemoryFact[];
    contradictions: MemoryContradiction[];
    bm25DocumentCount: number;
    buildDurationMs: number;
    embeddingBackend?: 'onnx' | 'hash';
  },
): Promise<EngineManifest> {
  const dir = engineDirFor(outputDir);
  await mkdir(dir, { recursive: true });

  let manifest: EngineManifest;
  try {
    manifest = await persistToSqlite(dir, data);
    manifest.episodeCount = data.episodes.length;
    if (data.embeddingBackend) manifest.stats.embeddingBackend = data.embeddingBackend;
    await writeFile(path.join(dir, MANIFEST), JSON.stringify(manifest, null, 2), 'utf-8');
    return manifest;
  } catch {
    // JSON fallback
  }

  manifest = {
    $schema: MEMORY_ENGINE_SCHEMA,
    codename: MEMORY_ENGINE_CODENAME,
    generation: 3,
    repository: data.repository,
    builtAt: new Date().toISOString(),
    documentCount: data.documents.length,
    episodeCount: data.episodes.length,
    factCount: data.facts.length,
    contradictionCount: data.contradictions.filter((c) => !c.resolved).length,
    embeddingDims: EMBEDDING_DIMS,
    bm25DocumentCount: data.bm25DocumentCount,
    stats: {
      buildDurationMs: data.buildDurationMs,
      hybridIndexReady: true,
      storeBackend: 'json-fallback',
      embeddingBackend: data.embeddingBackend,
    },
  };

  const vectorFile: VectorIndexFile = {
    version: 1,
    dims: EMBEDDING_DIMS,
    entries: [...data.vectors.entries()].map(([id, vec]) => ({ id, v: serializeVector(vec) })),
  };

  await Promise.all([
    writeFile(path.join(dir, MANIFEST), JSON.stringify(manifest, null, 2), 'utf-8'),
    writeFile(path.join(dir, DOCUMENTS), JSON.stringify(data.documents, null, 2), 'utf-8'),
    writeFile(path.join(dir, VECTORS), JSON.stringify(vectorFile), 'utf-8'),
    writeFile(path.join(dir, FACTS), JSON.stringify(data.facts, null, 2), 'utf-8'),
    writeFile(path.join(dir, CONTRADICTIONS), JSON.stringify(data.contradictions, null, 2), 'utf-8'),
  ]);

  return manifest;
}

export async function loadEngineIndex(outputDir: string): Promise<LoadedEngineIndex | null> {
  const dir = engineDirFor(outputDir);

  const sqlite = await loadFromSqlite(dir);
  if (sqlite) return sqlite;

  try {
    const [manifestRaw, docsRaw, vecRaw, factsRaw, contradictionsRaw] = await Promise.all([
      readFile(path.join(dir, MANIFEST), 'utf-8'),
      readFile(path.join(dir, DOCUMENTS), 'utf-8'),
      readFile(path.join(dir, VECTORS), 'utf-8'),
      readFile(path.join(dir, FACTS), 'utf-8'),
      readFile(path.join(dir, CONTRADICTIONS), 'utf-8'),
    ]);

    const manifest = normalizeEngineManifest(JSON.parse(manifestRaw) as Record<string, unknown>);
    const documents = JSON.parse(docsRaw) as MemoryDocument[];
    const vectorFile = JSON.parse(vecRaw) as VectorIndexFile;
    const facts = JSON.parse(factsRaw) as MemoryFact[];
    const contradictions = JSON.parse(contradictionsRaw) as MemoryContradiction[];

    const vectors = new Map<string, Float32Array>();
    for (const entry of vectorFile.entries) {
      vectors.set(entry.id, deserializeVector(entry.v, vectorFile.dims));
    }

    const { loadEpisodes } = await import('./episodes.js');
    const episodes = await loadEpisodes(dir);

    return { manifest, documents, vectors, episodes, facts, contradictions };
  } catch {
    return null;
  }
}

/** Sync hash embeddings (legacy fast path). */
export function buildVectorIndex(documents: MemoryDocument[]): Map<string, Float32Array> {
  const map = new Map<string, Float32Array>();
  for (const d of documents) {
    map.set(d.id, embedLocal(`${d.title}\n${d.body}\n${d.tags.join(' ')}`));
  }
  return map;
}

export async function loadPreviousFacts(outputDir: string): Promise<MemoryFact[]> {
  const index = await loadEngineIndex(outputDir);
  if (index) return index.facts;
  try {
    const raw = await readFile(path.join(engineDirFor(outputDir), FACTS), 'utf-8');
    return JSON.parse(raw) as MemoryFact[];
  } catch {
    return [];
  }
}
