#!/usr/bin/env node
/**
 * Delete cached .mnemos for a benchmark repo, then re-run the scorer.
 * Usage: node mnemos-bench/scripts/fresh.mjs express
 */
import { rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = process.argv[2];
if (!repo) {
  console.error('Usage: node mnemos-bench/scripts/fresh.mjs <express|nestjs>');
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mnemosDir = path.join(root, 'repos', repo, '.mnemos');

rmSync(mnemosDir, { recursive: true, force: true });
console.log(`Removed ${mnemosDir}`);

const scorer = path.join(root, 'scorer', 'run.mjs');
const r = spawnSync(process.execPath, [scorer, repo], { stdio: 'inherit', cwd: path.resolve(root, '..') });
process.exit(r.status ?? 1);
