import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { embedLocal, cosineSimilarity, serializeVector, deserializeVector } from './embeddings.js';
import { reciprocalRankFusion } from './ranking.js';
import { detectContradictions } from './contradictions.js';
import { decayWeight, applyDecayToEpisodes } from './decay.js';
import type { MemoryEpisode, MemoryFact } from './types.js';
import { build } from '../pipeline/build.js';
import { engineExists } from './engine.js';
import { MnemosMemoryEngine } from './engine.js';

const fixturesRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'test', 'fixtures', 'sample-app');

describe('memory-engine embeddings', () => {
  it('produces deterministic unit vectors', () => {
    const a = embedLocal('authentication middleware login handler');
    const b = embedLocal('authentication middleware login handler');
    assert.ok(Math.abs(cosineSimilarity(a, b) - 1) < 1e-5);
    assert.ok(a.length === 384);
  });

  it('similar code terms score higher than unrelated', () => {
    const auth = embedLocal('UserService authenticate JWT token session');
    const related = embedLocal('auth middleware validate bearer token');
    const unrelated = embedLocal('database migration schema version');
    assert.ok(cosineSimilarity(auth, related) > cosineSimilarity(auth, unrelated));
  });

  it('round-trips vector serialization', () => {
    const vec = embedLocal('test round trip');
    const restored = deserializeVector(serializeVector(vec));
    assert.ok(Math.abs(cosineSimilarity(vec, restored) - 1) < 1e-5);
  });
});

describe('memory-engine ranking', () => {
  it('fuses BM25 and vector ranks via RRF', () => {
    const fused = reciprocalRankFusion([
      [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      [{ id: 'b' }, { id: 'a' }, { id: 'd' }],
    ]);
    assert.ok(fused[0]!.id === 'a' || fused[0]!.id === 'b');
    assert.ok(fused.length === 4);
  });
});

describe('memory-engine contradictions', () => {
  it('detects conflicting facts with same key', () => {
    const facts: MemoryFact[] = [
      { key: 'domain:Auth:description', subject: 'Auth', predicate: 'description', object: 'Handles login', confidence: 0.9, documentId: '1', builtAt: '2026-01-01' },
      { key: 'domain:Auth:description', subject: 'Auth', predicate: 'description', object: 'Handles OAuth only', confidence: 0.85, documentId: '2', builtAt: '2026-01-02' },
    ];
    const c = detectContradictions(facts);
    assert.equal(c.length, 1);
    assert.equal(c[0]!.severity, 'medium');
  });
});

describe('memory-engine decay', () => {
  it('decays old episodic memories', () => {
    const old: MemoryEpisode = {
      id: 'e1',
      content: 'old note',
      tags: [],
      source: 'agent',
      createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
      lastAccessedAt: new Date(Date.now() - 30 * 86400000).toISOString(),
      accessCount: 0,
      weight: 1,
    };
    const w = decayWeight(old);
    assert.ok(w < 0.5);
  });

  it('prunes very weak episodes', () => {
    const episodes: MemoryEpisode[] = [{
      id: 'e1',
      content: 'x',
      tags: [],
      source: 'agent',
      createdAt: new Date(Date.now() - 365 * 86400000).toISOString(),
      lastAccessedAt: new Date(Date.now() - 365 * 86400000).toISOString(),
      accessCount: 0,
      weight: 0.01,
    }];
    const { pruned } = applyDecayToEpisodes(episodes);
    assert.ok(pruned >= 1);
  });
});

describe('memory-engine integration', () => {
  it('builds hybrid index on sample fixture', async () => {
    await build({ root: fixturesRoot, verbose: false, incremental: false });
    const outputDir = path.join(fixturesRoot, '.mnemos');
    assert.ok(await engineExists(outputDir));
    const engine = new MnemosMemoryEngine(fixturesRoot, outputDir);
    const result = await engine.query('authentication login', { limit: 5 });
    assert.ok(result.hits.length > 0);
    const episode = await engine.remember({ content: 'Test episodic note', tags: ['test'] });
    assert.ok(episode.id.startsWith('episode:'));
  });
});
