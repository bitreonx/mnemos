#!/usr/bin/env node
/**
 * INFERNO leaderboard — aggregate committed results into a SWE-bench-style table.
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BENCH = path.resolve(__dirname, '..');
const RESULTS = path.join(BENCH, 'results');
const DATASET = path.join(BENCH, 'dataset', 'v1.0.0.json');

async function loadJson(p) {
  return JSON.parse(await readFile(p, 'utf-8'));
}

function summarizeTool(name, tool) {
  if (!tool) return null;
  const tier =
    tool.verification_tier ??
    (tool.verified ? 'A' : tool.accuracy >= 95 ? 'A' : tool.accuracy >= 80 ? 'B' : 'F');
  return {
    tool: name,
    accuracy: tool.accuracy,
    verification_tier: tier,
    verified: tool.verified ?? tool.accuracy >= 95,
    compression_ratio: tool.compression_ratio,
    build_latency_ms: tool.build_latency_ms ?? tool.latencyMs,
    tokens: tool.tokens,
    tasks_verified: tool.tasks_verified,
    tasks_total: tool.tasks_total,
  };
}

async function buildLeaderboard() {
  const dataset = await loadJson(DATASET);
  const files = (await readdir(RESULTS)).filter((f) => f.endsWith('.json') && !f.startsWith('ai-eval'));
  const entries = [];

  for (const file of files) {
    if (file.includes('-stress') || file.includes('-gitingest')) continue;
    const data = await loadJson(path.join(RESULTS, file));
    if (!data.tools) continue;

    const instance = dataset.instances.find((i) => i.id === data.repo);
    const row = {
      repo: data.repo,
      tier: instance?.tier,
      commit_sha: data.commit_sha ?? instance?.commit_sha,
      measured_at: data.measured_at,
      dataset_version: data.dataset_version ?? dataset.version,
      inferno_version: data.inferno_version,
      tools: {},
    };

    for (const [name, tool] of Object.entries(data.tools)) {
      row.tools[name] = summarizeTool(name, tool);
    }

    row.winner = data.winner;
    row.ttu = data.ttu;
    entries.push(row);
  }

  const leaderboard = {
    $schema: 'inferno-bench/leaderboard/v1',
    name: 'INFERNO-bench',
    generated_at: new Date().toISOString(),
    dataset_version: dataset.version,
    governance: 'mnemos-bench/GOVERNANCE.md',
    entries,
    ranking_note:
      'Primary sort: verification_tier (A > B > C > F), then accuracy, then compression_ratio. Report tier — not accuracy alone.',
  };

  const out = path.join(RESULTS, 'leaderboard.json');
  await writeFile(out, JSON.stringify(leaderboard, null, 2));
  console.log(`Leaderboard: ${out} (${entries.length} fixtures)`);

  for (const e of entries) {
    const m = e.tools.mnemos;
    if (!m) continue;
    console.log(
      `  ${e.repo}: mnemos tier=${m.verification_tier} accuracy=${m.accuracy}% compression=${m.compression_ratio}x`,
    );
  }

  return leaderboard;
}

buildLeaderboard().catch((err) => {
  console.error(err);
  process.exit(1);
});
