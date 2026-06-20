#!/usr/bin/env node
/**
 * INFERNO regression gate — fails CI if verification tier or accuracy drops.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESULTS = path.join(__dirname, '..', 'results');

const THRESHOLDS = {
  express: {
    accuracy: 95,
    compression: 15,
    build_ms: 5000,
    min_tier: 'A',
    min_tasks_verified: 5,
  },
  nestjs: {
    accuracy: 95,
    compression: 4,
    build_ms: 120_000,
    min_tier: 'A',
    min_tasks_verified: 5,
  },
};

const TIER_RANK = { A: 4, B: 3, C: 2, F: 1 };

async function check(repo) {
  const file = path.join(RESULTS, `${repo}.json`);
  let data;
  try {
    data = JSON.parse(await readFile(file, 'utf-8'));
  } catch {
    return { repo, ok: false, error: `Missing ${file} — run: npm run bench:${repo}` };
  }

  const t = THRESHOLDS[repo];
  if (!t) return { repo, ok: true, skipped: true };

  const m = data.tools?.mnemos;
  const failures = [];

  if (m.accuracy < t.accuracy) failures.push(`accuracy ${m.accuracy}% < ${t.accuracy}%`);
  if (m.compression_ratio < t.compression) failures.push(`compression ${m.compression_ratio}x < ${t.compression}x`);
  if (m.build_latency_ms > t.build_ms) failures.push(`build ${m.build_latency_ms}ms > ${t.build_ms}ms`);

  const tier = m.verification_tier ?? (m.accuracy >= 95 ? 'A' : m.accuracy >= 80 ? 'B' : 'F');
  if ((TIER_RANK[tier] ?? 0) < (TIER_RANK[t.min_tier] ?? 4)) {
    failures.push(`verification_tier ${tier} < ${t.min_tier}`);
  }

  const verified = m.tasks_verified ?? (m.accuracy >= 95 ? t.min_tasks_verified : 0);
  if (verified < t.min_tasks_verified) {
    failures.push(`tasks_verified ${verified} < ${t.min_tasks_verified}`);
  }

  return {
    repo,
    ok: failures.length === 0,
    failures,
    metrics: {
      accuracy: m.accuracy,
      compression: m.compression_ratio,
      build_ms: m.build_latency_ms,
      tier,
      tasks_verified: verified,
    },
  };
}

const repos = process.argv.slice(2).length ? process.argv.slice(2) : ['express', 'nestjs'];
let failed = false;

console.log('INFERNO regression gate\n');

for (const repo of repos) {
  const r = await check(repo);
  if (r.skipped) {
    console.log(`⏭  ${repo}: no threshold defined`);
    continue;
  }
  if (r.error) {
    console.error(`✗  ${repo}: ${r.error}`);
    failed = true;
    continue;
  }
  if (r.ok) {
    console.log(
      `✓  ${repo}: tier=${r.metrics.tier} accuracy=${r.metrics.accuracy}% compression=${r.metrics.compression}x verified=${r.metrics.tasks_verified} tasks`,
    );
  } else {
    console.error(`✗  ${repo}: ${r.failures.join('; ')}`);
    failed = true;
  }
}

process.exit(failed ? 1 : 0);
