import path from 'node:path';
import type { MemoryModel } from '../types.js';
import type { MemorySearchIndex } from '../search/index.js';
import { buildSearchIndex } from '../search/index.js';
import type {
  EngineManifest,
  HybridQueryResult,
  LoadedEngineIndex,
  MemoryEpisode,
  RememberInput,
  TaskContextPack,
} from './types.js';
import { compileMemoryDocuments, extractFacts } from './documents.js';
import { detectContradictions } from './contradictions.js';
import { applyDecayToEpisodes } from './decay.js';
import { createEpisode, appendEpisode, loadEpisodes, saveEpisodes, episodeToDocument, touchEpisode } from './episodes.js';
import {
  engineDirFor,
  engineExists,
  loadEngineIndex,
  loadPreviousFacts,
  persistEngineIndex,
} from './store.js';
import { hybridQuery, compileTaskContext } from './retrieval.js';
import { buildVectorIndexAsync, type EmbeddingMode } from './onnx-embeddings.js';
import { redactSecrets } from './redaction.js';
import {
  startSession,
  endSession,
  getActiveSession,
  logSessionEventAuto,
  listRecentSessions,
  type SessionSummary,
} from './sessions.js';
import {
  exportEncryptedBundle,
  importEncryptedBundle,
  SYNC_BUNDLE_EXT,
  type SyncBundleManifest,
} from './team-sync.js';

export interface BuildEngineOptions {
  embeddingMode?: EmbeddingMode;
}

/**
 * Mnemos Memory Engine — release codename: Labyrinth
 * M2 SQLite · M3 edge confidence · M4 ONNX · M5 sessions · M6 encrypted sync
 */
export class MnemosMemoryEngine {
  readonly root: string;
  readonly outputDir: string;
  readonly embeddingMode: EmbeddingMode;

  private cachedIndex: LoadedEngineIndex | null = null;
  private cachedSearchIndex: MemorySearchIndex | null = null;

  constructor(root: string, outputDir?: string, options: BuildEngineOptions = {}) {
    this.root = path.resolve(root);
    this.outputDir = outputDir ?? path.join(this.root, '.mnemos');
    this.embeddingMode = options.embeddingMode ?? 'auto';
  }

  get engineDir(): string {
    return engineDirFor(this.outputDir);
  }

  invalidate(): void {
    this.cachedIndex = null;
    this.cachedSearchIndex = null;
  }

  async exists(): Promise<boolean> {
    return engineExists(this.outputDir);
  }

  async load(force = false): Promise<LoadedEngineIndex> {
    if (this.cachedIndex && !force) return this.cachedIndex;
    const index = await loadEngineIndex(this.outputDir);
    if (!index) {
      throw new Error('Memory engine not built. Run `mnemos build .` first.');
    }
    this.cachedIndex = index;
    return index;
  }

  private async getSearchIndex(memory?: MemoryModel): Promise<MemorySearchIndex> {
    if (this.cachedSearchIndex) return this.cachedSearchIndex;
    if (memory) {
      this.cachedSearchIndex = buildSearchIndex(memory);
      return this.cachedSearchIndex;
    }
    const { loadMemoryModel } = await import('../pipeline/build.js');
    const loaded = await loadMemoryModel(this.root);
    if (!loaded) throw new Error('No memory model found.');
    this.cachedSearchIndex = buildSearchIndex(loaded.memory);
    return this.cachedSearchIndex;
  }

  async buildFromMemory(memory: MemoryModel, searchIndex?: MemorySearchIndex): Promise<EngineManifest> {
    const started = Date.now();
    this.invalidate();

    const previousFacts = await loadPreviousFacts(this.outputDir);
    const structuralDocs = compileMemoryDocuments(memory);

    const { episodes: decayedEpisodes, pruned } = applyDecayToEpisodes(await loadEpisodes(this.engineDir));
    if (pruned > 0) await saveEpisodes(this.engineDir, decayedEpisodes);

    const episodeDocs = decayedEpisodes.map(episodeToDocument);
    const documents = [...structuralDocs, ...episodeDocs];

    const { vectors, backend } = await buildVectorIndexAsync(documents, this.embeddingMode);

    const facts = extractFacts(structuralDocs);
    const contradictions = detectContradictions(facts, previousFacts);

    const idx = searchIndex ?? buildSearchIndex(memory);
    this.cachedSearchIndex = idx;

    const manifest = await persistEngineIndex(this.outputDir, {
      repository: memory.repository,
      documents,
      vectors,
      episodes: decayedEpisodes,
      facts,
      contradictions,
      bm25DocumentCount: idx.documents.length,
      buildDurationMs: Date.now() - started,
      embeddingBackend: backend,
    });

    this.cachedIndex = {
      manifest,
      documents,
      vectors,
      episodes: decayedEpisodes,
      facts,
      contradictions,
    };
    return manifest;
  }

  async query(text: string, options?: import('./retrieval.js').QueryOptions): Promise<HybridQueryResult> {
    const index = await this.load();
    const searchIndex = await this.getSearchIndex();
    await logSessionEventAuto(this.engineDir, 'query', { text, limit: options?.limit });
    return hybridQuery(index, searchIndex, text, {
      ...options,
      embeddingMode: options?.embeddingMode ?? this.embeddingMode,
    });
  }

  async remember(input: RememberInput): Promise<MemoryEpisode> {
    const redacted = redactSecrets(input.content);
    const episode = createEpisode({ ...input, content: redacted.text });
    await appendEpisode(this.engineDir, episode);
    await logSessionEventAuto(this.engineDir, 'remember', {
      content: redacted.redacted ? '[redacted]' : input.content.slice(0, 80),
      tags: input.tags,
      redactionHits: redacted.hits,
    });

    if (this.cachedIndex) {
      this.cachedIndex.episodes.push(episode);
      const doc = episodeToDocument(episode);
      this.cachedIndex.documents.push(doc);
      const { embedDocument } = await import('./onnx-embeddings.js');
      const { vector } = await embedDocument(`${doc.title}\n${doc.body}`, this.embeddingMode);
      this.cachedIndex.vectors.set(doc.id, vector);
    }

    return episode;
  }

  async compileContext(task: string, tokenBudget = 8000): Promise<TaskContextPack> {
    const index = await this.load();
    const searchIndex = await this.getSearchIndex();
    await logSessionEventAuto(this.engineDir, 'context', { task, tokenBudget });
    return compileTaskContext(index, searchIndex, task, tokenBudget, this.embeddingMode);
  }

  async getTrustManifest() {
    const { buildTrustManifest } = await import('../release/trust-manifest.js');
    return buildTrustManifest(await this.getManifest());
  }

  async getManifest(): Promise<EngineManifest | null> {
    const index = await loadEngineIndex(this.outputDir);
    return index?.manifest ?? null;
  }

  async touchEpisodeById(id: string): Promise<void> {
    const episodes = await loadEpisodes(this.engineDir);
    const idx = episodes.findIndex((e) => e.id === id);
    if (idx < 0) return;
    episodes[idx] = touchEpisode(episodes[idx]!);
    await saveEpisodes(this.engineDir, episodes);
  }

  // M5 — Session traces
  async sessionStart(metadata?: Record<string, unknown>): Promise<string> {
    return startSession(this.engineDir, metadata);
  }

  async sessionEnd(): Promise<SessionSummary | null> {
    return endSession(this.engineDir);
  }

  async getActiveSessionId(): Promise<string | null> {
    const s = await getActiveSession(this.engineDir);
    return s?.sessionId ?? null;
  }

  async listSessions(limit = 20): Promise<SessionSummary[]> {
    return listRecentSessions(this.engineDir, limit);
  }

  async logToolCall(tool: string, args: Record<string, unknown>): Promise<void> {
    await logSessionEventAuto(this.engineDir, 'tool_call', { tool, args });
  }

  // M6 — Encrypted team sync (local file, no cloud)
  async exportSync(password: string, outPath?: string): Promise<SyncBundleManifest> {
    const manifest = await this.getManifest();
    const target = outPath ?? path.join(this.root, `${path.basename(this.root)}${SYNC_BUNDLE_EXT}`);
    return exportEncryptedBundle({
      engineDir: this.engineDir,
      repository: manifest?.repository ?? path.basename(this.root),
      password,
      outPath: target,
    });
  }

  async importSync(bundlePath: string, password: string, merge = true): Promise<SyncBundleManifest> {
    const result = await importEncryptedBundle({
      bundlePath,
      password,
      engineDir: this.engineDir,
      merge,
    });
    this.invalidate();
    return result;
  }
}

export async function buildMemoryEngine(
  root: string,
  memory: MemoryModel,
  outputDir: string,
  searchIndex?: MemorySearchIndex,
  options?: BuildEngineOptions,
): Promise<EngineManifest> {
  const engine = new MnemosMemoryEngine(root, outputDir, options);
  return engine.buildFromMemory(memory, searchIndex);
}

export { engineExists, loadEngineIndex, engineDirFor };
