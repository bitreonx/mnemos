#!/usr/bin/env node
/**
 * Regression gate — fails CI if benchmark scores drop below verified thresholds.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESULTS = path.join(__dirname, '..', 'results');

const THRESHOLDS = {
  express: { accuracy: 75, compression: 28, build_ms: 5000 },
  nestjs: { accuracy: 65, compression: 25, build_ms: 120_000 },
};

async function check(repo) {
  const file = path.join(RESULTS, `${repo}.json`);
  let data;
  try {
    data = JSON.parse(await readFile(file, 'utf-8'));
  } catch {
    return { repo, ok: false, error: `Missing ${file} — run: node mnemos-bench/scorer/run.mjs ${repo}` };
  }

  const t = THRESHOLDS[repo];
  if (!t) return { repo, ok: true, skipped: true };

  const m = data.tools?.mnemos;
  const failures = [];
  if (m.accuracy < t.accuracy) failures.push(`accuracy ${m.accuracy}% < ${t.accuracy}%`);
  if (m.compression_ratio < t.compression) failures.push(`compression ${m.compression_ratio}x < ${t.compression}x`);
  if (m.build_latency_ms > t.build_ms) failures.push(`build ${m.build_latency_ms}ms > ${t.build_ms}ms`);

  return { repo, ok: failures.length === 0, failures, metrics: { accuracy: m.accuracy, compression: m.compression_ratio, build_ms: m.build_latency_ms } };
}

const repos = process.argv.slice(2).length ? process.argv.slice(2) : ['express', 'nestjs'];
let failed = false;

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
    console.log(`✓  ${repo}: accuracy=${r.metrics.accuracy}% compression=${r.metrics.compression}x build=${r.metrics.build_ms}ms`);
  } else {
    console.error(`✗  ${repo}: ${r.failures.join('; ')}`);
    failed = true;
  }
}

process.exit(failed ? 1 : 0);
