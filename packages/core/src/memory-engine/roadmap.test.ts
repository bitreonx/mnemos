import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, rm } from 'node:fs/promises';
import { computeEdgeConfidence, confidenceLabel } from '../graph/edge-confidence.js';
import { exportEncryptedBundle, importEncryptedBundle } from './team-sync.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { redactSecrets } from './redaction.js';

describe('secret redaction', () => {
  it('redacts tokens before episodic storage', () => {
    const r = redactSecrets('Authorization: Bearer ghp_abcdefghijklmnopqrstuvwxyz1234567890');
    assert.ok(r.redacted);
    assert.match(r.text, /REDACTED/);
  });
});

describe('edge confidence M3', () => {
  it('scores resolved calls higher than unresolved', () => {
    const resolved = computeEdgeConfidence('CALLS', { resolved: true });
    const unresolved = computeEdgeConfidence('CALLS', { resolved: false });
    assert.ok(resolved > unresolved);
    assert.equal(confidenceLabel(resolved), 'high');
  });

  it('lowers confidence for non-tier1 languages', () => {
    const ts = computeEdgeConfidence('IMPORTS', {}, 'typescript');
    const rb = computeEdgeConfidence('IMPORTS', {}, 'ruby');
    assert.ok(ts >= rb);
  });
});

describe('team sync M6', () => {
  it('round-trips encrypted bundle locally', async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), 'mnemos-sync-'));
    const engineDir = path.join(tmp, 'engine');
    await mkdir(engineDir, { recursive: true });
    await writeFile(path.join(engineDir, 'manifest.json'), JSON.stringify({ documentCount: 1 }), 'utf-8');
    await writeFile(path.join(engineDir, 'episodes.jsonl'), '{"id":"e1"}\n', 'utf-8');

    const bundlePath = path.join(tmp, 'test.mnemos-sync');
    const password = 'test-passphrase-local';

    const exported = await exportEncryptedBundle({
      engineDir,
      repository: 'test-repo',
      password,
      outPath: bundlePath,
    });
    assert.equal(exported.magic, 'MNEMOS-SYNC-v1');

    const importDir = path.join(tmp, 'imported');
    const imported = await importEncryptedBundle({
      bundlePath,
      password,
      engineDir: importDir,
      merge: false,
    });
    assert.equal(imported.repository, 'test-repo');

    await rm(tmp, { recursive: true, force: true });
  });
});
