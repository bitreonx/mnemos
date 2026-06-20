#!/usr/bin/env node
/**
 * Pin benchmark fixtures to dataset commit SHAs.
 * Usage: node mnemos-bench/scripts/pin-fixtures.mjs [repoId...]
 */
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BENCH = path.resolve(__dirname, '..');
const DATASET = path.join(BENCH, 'dataset', 'v1.0.0.json');

async function loadDataset() {
  return JSON.parse(await readFile(DATASET, 'utf-8'));
}

function git(args, cwd) {
  const r = spawnSync('git', args, { encoding: 'utf-8', cwd, shell: true });
  return { ok: r.status === 0, stdout: (r.stdout || '').trim(), stderr: r.stderr || '' };
}

async function pinInstance(instance) {
  const repoDir = path.join(BENCH, 'repos', instance.id);
  const sha = instance.commit_sha;

  if (!sha) {
    console.log(`⏭  ${instance.id}: no commit_sha in dataset (status=${instance.status})`);
    return { id: instance.id, skipped: true };
  }

  await mkdir(path.join(BENCH, 'repos'), { recursive: true });

  if (!existsSync(repoDir)) {
    console.log(`  Cloning ${instance.repo} @ ${sha.slice(0, 7)}…`);
    const clone = git(
      ['clone', '--depth', '1', `https://github.com/${instance.repo}.git`, repoDir],
      BENCH,
    );
    if (!clone.ok) {
      throw new Error(`Clone failed for ${instance.id}: ${clone.stderr}`);
    }
  }

  const fetch = git(['fetch', '--depth', '1', 'origin', sha], repoDir);
  if (!fetch.ok) {
    throw new Error(`Fetch ${sha} failed for ${instance.id}: ${fetch.stderr}`);
  }

  const checkout = git(['checkout', sha], repoDir);
  if (!checkout.ok) {
    throw new Error(`Checkout ${sha} failed for ${instance.id}: ${checkout.stderr}`);
  }

  const head = git(['rev-parse', 'HEAD'], repoDir);
  const verified = head.stdout === sha;
  console.log(`${verified ? '✓' : '✗'}  ${instance.id}: HEAD=${head.stdout.slice(0, 12)} (pinned ${sha.slice(0, 12)})`);
  return { id: instance.id, sha: head.stdout, verified };
}

const dataset = await loadDataset();
const ids = process.argv.slice(2);
const targets = ids.length
  ? dataset.instances.filter((i) => ids.includes(i.id))
  : dataset.instances.filter((i) => i.commit_sha && i.status === 'verified');

let failed = false;
for (const instance of targets) {
  try {
    await pinInstance(instance);
  } catch (err) {
    console.error(`✗  ${instance.id}: ${err.message}`);
    failed = true;
  }
}

process.exit(failed ? 1 : 0);
