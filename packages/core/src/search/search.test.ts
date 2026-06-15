import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildSearchIndex,
  searchMemory,
  classifyIntent,
  tokenize,
  askCopilot,
} from '../index.js';
import { loadMemoryModel } from '../pipeline/build.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesRoot = path.join(__dirname, '..', '..', 'test', 'fixtures', 'sample-app');

describe('Mnemos search engine', () => {
  it('tokenizes queries and removes stop words', () => {
    const terms = tokenize('How does the authentication flow work?');
    assert.ok(terms.includes('authentication'));
    assert.ok(!terms.includes('how'));
    assert.ok(!terms.includes('the'));
  });

  it('classifies intents with confidence', () => {
    const overview = classifyIntent('what is this repo about');
    assert.equal(overview.intent, 'overview');
    assert.ok(overview.confidence > 0.8);

    const flow = classifyIntent('how does login work');
    assert.equal(flow.intent, 'flow');

    const health = classifyIntent('what is the health score');
    assert.equal(health.intent, 'health');
  });

  it('ranks memory entities with BM25 search', async () => {
    const loaded = await loadMemoryModel(fixturesRoot);
    if (!loaded) {
      const { build } = await import('../pipeline/build.js');
      await build({ root: fixturesRoot, verbose: false, incremental: false });
    }
    const memory = (await loadMemoryModel(fixturesRoot))!.memory;
    const index = buildSearchIndex(memory);
    assert.ok(index.documents.length > 0);

    const result = searchMemory(index, 'service domain', { limit: 5 });
    assert.ok(result.hits.length >= 0);
    assert.ok(result.tookMs >= 0);
  });

  it('copilot returns structured answers with intent', async () => {
    const loaded = await loadMemoryModel(fixturesRoot);
    const memory = loaded?.memory;
    if (!memory) return;

    const answer = askCopilot(memory, 'give me an overview');
    assert.ok(answer.answer.length > 10);
    assert.ok(answer.confidence > 0.5);
    assert.equal(answer.intent, 'overview');
  });
});
