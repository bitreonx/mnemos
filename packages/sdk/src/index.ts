/**
 * @mnemos/sdk — Local-first AI memory client.
 *
 * Designed for Cursor, Claude Code, and any agent runtime that needs
 * privacy-first repository memory without cloud APIs.
 *
 * @example
 * ```ts
 * import { MnemosClient } from '@mnemos/sdk';
 *
 * const client = new MnemosClient('.');
 * await client.build();
 * const ctx = await client.context('fix auth redirect bug', 8000);
 * await client.remember('Login flow uses JWT in httpOnly cookie', ['auth']);
 * const hits = await client.query('authentication middleware');
 * ```
 */

import path from 'node:path';
import {
  build,
  loadMemoryModel,
  MnemosMemoryEngine,
  engineExists,
  type HybridQueryResult,
  type TaskContextPack,
  type MemoryEpisode,
  type EngineManifest,
  type RememberInput,
  type BuildResult,
} from '@mnemos/core';

export interface MnemosClientOptions {
  /** Repository root. Default: process.cwd() */
  root?: string;
  /** Output directory for .mnemos artifacts. Default: `<root>/.mnemos` */
  outputDir?: string;
}

export interface QueryOptions {
  limit?: number;
  minConfidence?: number;
}

/**
 * High-level SDK for Mnemos Memory Engine (Labyrinth).
 * Product release: Mneme 0.3.0 · Ariadne's Thread
 */
export class MnemosClient {
  readonly root: string;
  readonly outputDir: string;
  private engine: MnemosMemoryEngine;

  constructor(options: MnemosClientOptions | string = {}) {
    const opts = typeof options === 'string' ? { root: options } : options;
    this.root = path.resolve(opts.root ?? process.cwd());
    this.outputDir = opts.outputDir ?? path.join(this.root, '.mnemos');
    this.engine = new MnemosMemoryEngine(this.root, this.outputDir);
  }

  /** Full repository analysis + memory engine build. */
  async build(verbose = false): Promise<BuildResult> {
    return build({ root: this.root, outputDir: this.outputDir, verbose });
  }

  /** Check if memory model exists. */
  async isBuilt(): Promise<boolean> {
    const loaded = await loadMemoryModel(this.root);
    return !!loaded;
  }

  /** Check if hybrid memory engine index exists. */
  async isEngineReady(): Promise<boolean> {
    return engineExists(this.outputDir);
  }

  /** Engine manifest stats. */
  async manifest(): Promise<EngineManifest | null> {
    return this.engine.getManifest();
  }

  /**
   * Hybrid retrieval — BM25 + local embeddings (RRF fusion).
   * Runs entirely on-device.
   */
  async query(text: string, options: QueryOptions = {}): Promise<HybridQueryResult> {
    return this.engine.query(text, {
      limit: options.limit ?? 12,
      minConfidence: options.minConfidence,
    });
  }

  /**
   * Task-scoped context compiler — minimal token pack for an agent task.
   * This is the primary integration point for Cursor / Claude Code.
   */
  async context(task: string, tokenBudget = 8000): Promise<TaskContextPack> {
    return this.engine.compileContext(task, tokenBudget);
  }

  /** Persist episodic memory — agent observations persist locally with temporal decay. */
  async remember(content: string, tags?: string[]): Promise<MemoryEpisode> {
    return this.engine.remember({ content, tags, source: 'agent' });
  }

  async sessionStart(): Promise<string> {
    return this.engine.sessionStart({ sdk: true });
  }

  async sessionEnd() {
    return this.engine.sessionEnd();
  }

  async listSessions(limit = 20) {
    return this.engine.listSessions(limit);
  }

  async exportSync(password: string, outPath?: string) {
    return this.engine.exportSync(password, outPath);
  }

  async importSync(bundlePath: string, password: string, merge = true) {
    return this.engine.importSync(bundlePath, password, merge);
  }

  getEngine(): MnemosMemoryEngine {
    return this.engine;
  }
}

export type {
  HybridQueryResult,
  HybridQueryHit,
  TaskContextPack,
  MemoryEpisode,
  EngineManifest,
  RememberInput,
} from '@mnemos/core';

export { MnemosMemoryEngine, MEMORY_ENGINE_SCHEMA, EMBEDDING_DIMS } from '@mnemos/core';
