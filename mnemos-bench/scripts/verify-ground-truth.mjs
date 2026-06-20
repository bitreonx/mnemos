#!/usr/bin/env node
/**
 * Independent ground-truth verification — grep fixture WITHOUT running Mnemos.
 * Usage: node mnemos-bench/scripts/verify-ground-truth.mjs [repoId]
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BENCH = path.resolve(__dirname, '..');

const IGNORE = /node_modules|\.git|\.mnemos|dist|build|coverage/;

async function walkSourceFiles(dir) {
  const files = [];
  async function walk(d) {
    const entries = await readdir(d, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (IGNORE.test(full)) continue;
      if (e.isDirectory()) await walk(full);
      else if (/\.(js|ts|tsx|jsx|mjs|cjs|json|md)$/i.test(e.name)) {
        try {
          const s = await stat(full);
          if (s.size <= 500_000) files.push(full);
        } catch {
          /* unreadable */
        }
      }
    }
  }
  await walk(dir);
  return files;
}

async function grepRepo(repoPath, pattern) {
  const re = new RegExp(pattern, 'i');
  const hits = [];
  const files = await walkSourceFiles(repoPath);
  for (const f of files) {
    const content = await readFile(f, 'utf-8');
    if (re.test(content)) {
      hits.push(path.relative(repoPath, f).replace(/\\/g, '/'));
    }
  }
  return hits;
}

async function verifyRepo(repoId) {
  const repoPath = path.join(BENCH, 'repos', repoId);
  const gtPath = path.join(BENCH, 'tasks', 'ground-truth', `${repoId}.json`);
  const groundTruth = JSON.parse(await readFile(gtPath, 'utf-8'));
  const checks = groundTruth.independent_checks ?? [];
  const results = [];

  console.log(`\n━━━ Independent verification: ${repoId} ━━━`);

  for (const check of checks) {
    const hits = await grepRepo(repoPath, check.pattern);
    const ok = check.expect === 'hit' ? hits.length > 0 : hits.length === 0;
    results.push({ id: check.id, ok, hits: hits.slice(0, 5), pattern: check.pattern });
    console.log(`  ${ok ? '✓' : '✗'}  ${check.id}: ${hits.length} file(s) — ${check.description ?? check.pattern}`);
    if (!ok && hits.length) console.log(`      sample: ${hits.slice(0, 3).join(', ')}`);
  }

  const failed = results.filter((r) => !r.ok);
  return { repo: repoId, ok: failed.length === 0, results, verified_at: groundTruth.verified_at };
}

const repo = process.argv[2] ?? 'express';
verifyRepo(repo)
  .then((r) => {
    if (!r.ok) {
      console.error(`\n✗ Ground truth failed ${r.results.filter((x) => !x.ok).length} independent check(s)`);
      process.exit(1);
    }
    console.log(`\n✓ All independent checks passed (ground truth verified_at=${r.verified_at})`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
