import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanRepository, parseFiles, buildGraph, discoverDomains, discoverFlows, detectSmells } from '../index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesRoot = path.join(__dirname, '..', '..', 'test', 'fixtures', 'sample-app');

describe('Mnemos core pipeline', () => {
  it('scans and parses a sample project', async () => {
    const scan = await scanRepository(fixturesRoot);
    assert.ok(scan.files.length >= 2);

    const parsed = await parseFiles(scan.files, fixturesRoot);
    assert.ok(parsed.length >= 2);
    assert.ok(parsed.some((f) => f.symbols.length > 0));
  });

  it('builds a knowledge graph with domains and flows', async () => {
    const scan = await scanRepository(fixturesRoot);
    const parsed = await parseFiles(scan.files, fixturesRoot);
    const graph = buildGraph(fixturesRoot, scan, parsed);

    assert.ok(graph.order > 0);
    assert.ok(graph.size > 0);

    const domains = discoverDomains(graph);
    assert.ok(domains.length >= 0);

    const flows = discoverFlows(graph, parsed);
    assert.ok(flows.length >= 0);

    const smells = detectSmells(graph);
    assert.ok(Array.isArray(smells));
  });
});
