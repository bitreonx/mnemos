import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { evaluateSpindleCapture, buildFrozenSnapshot } from './spindle.js';
import { defaultVeilPolicy, applyVeilToEpisodes } from './veil.js';
import { synthesizeProvenanceAnswer } from './provenance.js';
import { spiralfuseStart, spiralfuseTick, spiralfuseReset } from './spiralfuse.js';
import { chronoshiftImport } from './chronoshift.js';
import type { MemoryEpisode } from './types.js';
import { buildSearchIndex } from '../search/index.js';
import { build } from '../pipeline/build.js';
import { MnemosMemoryEngine } from './engine.js';

const tmpBase = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'test', 'tmp-agent-os');

describe('Spindle capture', () => {
  it('captures decision-like turns', () => {
    const r = evaluateSpindleCapture('We decided to use PostgreSQL for team memory with row-level security.');
    assert.equal(r.captured, true);
    assert.equal(r.promoteShortTerm, true);
  });

  it('filters noise', () => {
    const r = evaluateSpindleCapture('ok');
    assert.equal(r.captured, false);
  });
});

describe('Veil scoping', () => {
  it('owner sees all scoped episodes', () => {
    const policy = defaultVeilPolicy({ id: 'owner', role: 'owner' });
    const episodes: MemoryEpisode[] = [
      {
        id: '1', content: 'private', tags: [], source: 'user', createdAt: '', lastAccessedAt: '', accessCount: 0, weight: 1,
        scope: { owner: 'other', visibility: 'private' },
      },
    ];
    const filtered = applyVeilToEpisodes(episodes, policy);
    assert.equal(filtered.length, 1);
  });

  it('member cannot read other private episodes', () => {
    const policy = defaultVeilPolicy({ id: 'junior', role: 'member', teams: ['alpha'], clients: ['client-a'] });
    const episodes: MemoryEpisode[] = [
      {
        id: '1', content: 'secret', tags: [], source: 'user', createdAt: '', lastAccessedAt: '', accessCount: 0, weight: 1,
        scope: { owner: 'boss', visibility: 'private' },
      },
    ];
    const filtered = applyVeilToEpisodes(episodes, policy);
    assert.equal(filtered.length, 0);
  });
});

describe('Spiralfuse', () => {
  it('fuses when token budget exceeded', async () => {
    const dir = path.join(tmpBase, 'spiralfuse');
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
    await spiralfuseStart(dir, { maxTokens: 1000, maxIterations: 10 });
    const r = await spiralfuseTick(dir, { tokensDelta: 1500 });
    assert.equal(r.allowed, false);
    assert.equal(r.budget.fused, true);
    await spiralfuseReset(dir);
  });
});

describe('Chronoshift import', () => {
  it('imports JSONL turns with dedup', async () => {
    const dir = path.join(tmpBase, 'chronoshift');
    const sessionDir = path.join(dir, 'sessions');
    await rm(dir, { recursive: true, force: true });
    await mkdir(sessionDir, { recursive: true });
    const jsonl = path.join(sessionDir, 'test-session.jsonl');
    await writeFile(
      jsonl,
      [
        JSON.stringify({ type: 'user', message: { content: 'We decided to introduce a third pricing tier at $37.' }, timestamp: '2026-01-15T10:00:00Z' }),
        JSON.stringify({ type: 'user', message: { content: 'We decided to introduce a third pricing tier at $37.' }, timestamp: '2026-01-15T10:00:00Z' }),
      ].join('\n') + '\n',
      'utf-8',
    );
    const engineDir = path.join(dir, 'engine');
    await mkdir(engineDir, { recursive: true });
    const result = await chronoshiftImport(engineDir, sessionDir);
    assert.equal(result.episodesCreated, 1);
    assert.equal(result.episodesSkipped, 1);
  });
});

describe('Provenance honesty', () => {
  it('admits unknown on empty index', async () => {
    const index = {
      manifest: {
        $schema: 'mnemos/memory-engine/labyrinth',
        codename: 'Labyrinth',
        repository: 'test',
        builtAt: new Date().toISOString(),
        documentCount: 0,
        episodeCount: 0,
        factCount: 0,
        contradictionCount: 0,
        embeddingDims: 384,
        bm25DocumentCount: 0,
        stats: { buildDurationMs: 0, hybridIndexReady: true },
      },
      documents: [],
      vectors: new Map(),
      episodes: [],
      facts: [],
      contradictions: [],
    };
    const searchIndex = {
      documents: [],
      docById: new Map(),
      avgDocLength: 0,
      docFreq: new Map(),
      termFreq: new Map(),
      docLength: new Map(),
      postings: new Map(),
      idf: new Map(),
    };
    const answer = await synthesizeProvenanceAnswer(index as never, searchIndex as never, tmpBase, 'what did we agree on pricing?');
    assert.equal(answer.admitsUnknown, true);
    assert.equal(answer.synthesis, 'insufficient');
    assert.ok(answer.gaps.length > 0);
  });
});

describe('Frozen snapshot', () => {
  it('caps short-term memory block', () => {
    const episodes: MemoryEpisode[] = Array.from({ length: 60 }, (_, i) => ({
      id: `e${i}`,
      content: `Decision number ${i} about architecture`,
      tags: ['short-term'],
      source: 'user' as const,
      createdAt: new Date(Date.now() - i * 1000).toISOString(),
      lastAccessedAt: '',
      accessCount: 0,
      weight: 1,
      metadata: { promoteShortTerm: true },
    }));
    const snap = buildFrozenSnapshot(episodes, 'demo-repo');
    assert.ok(snap.memory.includes('Decision number'));
    assert.ok(snap.estimatedTokens > 0);
  });
});
