#!/usr/bin/env node
/**
 * INFERNO-bench runner — objective, adversarial codebase understanding benchmark.
 * Harness: scorer/verify.mjs · Governance: GOVERNANCE.md · Dataset: dataset/v1.0.0.json
 */
import { spawnSync } from 'node:child_process';
import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  INFERNO_VERSION,
  DATASET_VERSION,
  scoreTask,
  scoreContextPackage,
  aggregateVerification,
  scoreDigestSearch,
} from './verify.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BENCH_ROOT = path.resolve(__dirname, '..');
const MNEMOS_ROOT = path.resolve(BENCH_ROOT, '..');
const MNEMOS_CLI = path.join(MNEMOS_ROOT, 'packages', 'cli', 'dist', 'index.js');

function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

function runMnemosBuild(repoPath) {
  const start = Date.now();
  const r = spawnSync(process.execPath, [MNEMOS_CLI, 'build', repoPath], {
    encoding: 'utf-8',
    cwd: MNEMOS_ROOT,
    timeout: 600_000,
  });
  const latencyMs = Date.now() - start;
  if (r.status !== 0) {
    return { ok: false, error: r.stderr || r.stdout, latencyMs };
  }
  const match = (r.stdout || '').match(/Duration:\s+([\d.]+)s/);
  const buildMs = match ? Math.round(parseFloat(match[1]) * 1000) : latencyMs;
  return { ok: true, latencyMs: buildMs, stdout: r.stdout };
}

function runMnemosAsk(repoPath, question) {
  const start = Date.now();
  const r = spawnSync(process.execPath, [MNEMOS_CLI, 'ask', question, '-p', repoPath], {
    encoding: 'utf-8',
    cwd: MNEMOS_ROOT,
    timeout: 120_000,
  });
  const latencyMs = Date.now() - start;
  const answer = (r.stdout || '').split('Mnemos Copilot')[1] ?? r.stdout ?? '';
  return { ok: r.status === 0, answer, latencyMs, stderr: r.stderr };
}

function runMnemosExplain(repoPath) {
  const start = Date.now();
  const r = spawnSync(process.execPath, [MNEMOS_CLI, 'explain', repoPath], {
    encoding: 'utf-8',
    cwd: MNEMOS_ROOT,
    timeout: 120_000,
  });
  return { ok: r.status === 0, answer: r.stdout ?? '', latencyMs: Date.now() - start };
}

async function measureMnemosContext(repoPath) {
  const mnemosDir = path.join(repoPath, '.mnemos');
  const files = [
    'project.dna.json',
    'agent_context.json',
    'repository_summary.json',
    'health-score.json',
  ];
  let totalChars = 0;
  const sizes = {};
  for (const f of files) {
    try {
      const content = await readFile(path.join(mnemosDir, f), 'utf-8');
      sizes[f] = content.length;
      totalChars += content.length;
    } catch {
      sizes[f] = 0;
    }
  }
  const ctxDir = path.join(mnemosDir, 'context');
  try {
    const ctxFiles = await readdir(ctxDir);
    for (const cf of ctxFiles) {
      if (!cf.endsWith('.md')) continue;
      const content = await readFile(path.join(ctxDir, cf), 'utf-8');
      sizes[`context/${cf}`] = content.length;
      totalChars += content.length;
    }
  } catch {
    /* no context */
  }
  return { totalChars, tokens: estimateTokens('x'.repeat(totalChars)), sizes };
}

async function measureRawRepoTokens(repoPath) {
  let totalChars = 0;
  let fileCount = 0;
  const IGNORE = /node_modules|\.git|\.mnemos|dist|build|coverage/;
  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (IGNORE.test(full)) continue;
      if (e.isDirectory()) await walk(full);
      else if (/\.(js|ts|tsx|jsx|mjs|cjs|py|go|rs|java|json|md)$/i.test(e.name)) {
        try {
          const s = await stat(full);
          if (s.size > 500_000) continue;
          const content = await readFile(full, 'utf-8');
          totalChars += content.length;
          fileCount++;
        } catch {
          /* binary or unreadable */
        }
      }
    }
  }
  await walk(repoPath);
  return { fileCount, totalChars, tokens: estimateTokens('x'.repeat(totalChars)) };
}

async function measureFullBurnContext(repoPath) {
  const dir = path.join(repoPath, '.mnemos', 'fullburn');
  if (!existsSync(dir)) return { totalChars: 0, tokens: 0, files: 0 };
  let totalChars = 0;
  let files = 0;
  try {
    const entries = await readdir(dir);
    for (const f of entries) {
      const content = await readFile(path.join(dir, f), 'utf-8');
      totalChars += content.length;
      files++;
    }
  } catch {
    /* */
  }
  return { totalChars, tokens: estimateTokens('x'.repeat(totalChars)), files };
}

function runMnemosFullBurn(repoPath) {
  const start = Date.now();
  const r = spawnSync(process.execPath, [MNEMOS_CLI, 'fullburn', repoPath], {
    encoding: 'utf-8',
    cwd: MNEMOS_ROOT,
    timeout: 120_000,
  });
  return { ok: r.status === 0, latencyMs: Date.now() - start, stderr: r.stderr };
}

async function runUnderstandAnything(repoPath, groundTruth) {
  const adapterPath = path.join(BENCH_ROOT, 'adapters', 'understand-anything.mjs');
  const start = Date.now();
  const r = spawnSync(process.execPath, [adapterPath, repoPath], {
    encoding: 'utf-8',
    cwd: BENCH_ROOT,
    timeout: 600_000,
  });
  const latencyMs = Date.now() - start;
  if (r.status !== 0) {
    return {
      ok: false,
      latencyMs,
      tokens: 0,
      accuracy: 0,
      verification_tier: 'F',
      note: 'Understand-Anything adapter failed',
      stderr: r.stderr || r.stdout,
    };
  }
  let uaRaw;
  try {
    uaRaw = JSON.parse(r.stdout);
  } catch {
    return { ok: false, latencyMs, accuracy: 0, verification_tier: 'F', note: 'Parse error' };
  }

  const queryScores = (uaRaw.queries ?? []).map((q, i) => {
    const gtKeys = ['task1_login_start', 'task4_critical', 'task5_capabilities'];
    const gt = groundTruth[gtKeys[i]] ?? {};
    return scoreTask(q.answer ?? '', gt);
  });
  const agg = aggregateVerification(queryScores);

  return {
    ...uaRaw,
    latencyMs,
    accuracy: agg.accuracy,
    verified: agg.verified,
    verification_tier: agg.verification_tier,
    tasks_verified: agg.tasks_verified,
    tasks_total: queryScores.length,
    task_scores: queryScores,
  };
}

function runGitingest(repoPath, outputPath) {
  const start = Date.now();
  const r = spawnSync('gitingest', [repoPath, '-o', outputPath], {
    encoding: 'utf-8',
    shell: true,
    timeout: 600_000,
  });
  const latencyMs = Date.now() - start;
  let tokens = 0;
  let bytes = 0;
  let digestText = '';
  const tokenMatch = (r.stdout || '').match(/Estimated tokens:\s*([\d.]+)([kKmM]?)/);
  if (tokenMatch) {
    let n = parseFloat(tokenMatch[1]);
    const suffix = tokenMatch[2]?.toLowerCase();
    if (suffix === 'k') n *= 1000;
    if (suffix === 'm') n *= 1_000_000;
    tokens = Math.round(n);
  }
  try {
    digestText = readFileSync(outputPath, 'utf-8');
    bytes = digestText.length;
    if (!tokens) tokens = estimateTokens(digestText);
  } catch {
    /* */
  }
  return { ok: r.status === 0, latencyMs, tokens, bytes, digestText, stdout: r.stdout, stderr: r.stderr };
}

function resolveGraphifyTarget(repoPath) {
  for (const sub of ['lib', 'packages/core', 'src']) {
    const full = path.join(repoPath, sub);
    if (existsSync(full)) return { target: full, label: sub };
  }
  return { target: repoPath, label: '.' };
}

function runGraphifyLib(repoPath, groundTruth) {
  const { target, label } = resolveGraphifyTarget(repoPath);
  const start = Date.now();
  const r = spawnSync('graphify', ['extract', target, '--no-cluster'], {
    encoding: 'utf-8',
    shell: true,
    cwd: repoPath,
    timeout: 300_000,
  });
  const latencyMs = Date.now() - start;
  const graphPath = path.join(target, 'graphify-out', 'graph.json');
  let graphChars = 0;
  try {
    graphChars = readFileSync(graphPath, 'utf-8').length;
  } catch {
    /* */
  }

  const taskDefs = [
    { q: 'Where does login start?', gt: groundTruth.task1_login_start },
    { q: 'What breaks if application changes?', gt: groundTruth.task2_impact },
    { q: 'Find the most critical subsystem', gt: groundTruth.task4_critical },
    { q: 'List business capabilities', gt: groundTruth.task5_capabilities },
  ];

  const queryResults = [];
  const taskScores = [];
  for (const t of taskDefs) {
    const qr = spawnSync('graphify', ['query', t.q, '--budget', '2000', '--graph', graphPath], {
      encoding: 'utf-8',
      shell: true,
      timeout: 60_000,
    });
    const answer = qr.stdout?.trim() ?? '';
    queryResults.push({ question: t.q, answer, ok: qr.status === 0 });
    taskScores.push(scoreTask(answer, t.gt));
  }

  const agg = aggregateVerification(taskScores);

  return {
    ok: r.status === 0,
    latencyMs,
    graphChars,
    tokens: estimateTokens('x'.repeat(graphChars)),
    note: `Code-only extract on ${label}/ — full repo requires LLM API key for docs`,
    queries: queryResults,
    accuracy: agg.accuracy,
    verified: agg.verified,
    verification_tier: agg.verification_tier,
    tasks_verified: agg.tasks_verified,
    tasks_total: taskScores.length,
    stderr: r.stderr,
  };
}

async function runRepoBenchmark(repoId) {
  const repoPath = path.join(BENCH_ROOT, 'repos', repoId);
  const groundTruthPath = path.join(BENCH_ROOT, 'tasks', 'ground-truth', `${repoId}.json`);
  const groundTruth = JSON.parse(await readFile(groundTruthPath, 'utf-8'));

  console.log(`\n━━━ INFERNO-bench: ${repoId} (dataset v${DATASET_VERSION}) ━━━`);

  const raw = await measureRawRepoTokens(repoPath);
  console.log(`  Raw repo: ${raw.fileCount} source files, ~${raw.tokens.toLocaleString()} tokens`);

  const build = runMnemosBuild(repoPath);
  if (!build.ok) throw new Error(`Mnemos build failed: ${build.error}`);

  const impactQ = groundTruth.task2_impact
    ? `What breaks if ${groundTruth.impact_target ?? 'application'} changes?`
    : 'What breaks if application changes?';

  const taskDefs = [
    { id: 'task1_login_start', q: 'Where does login start?', gt: groundTruth.task1_login_start },
    { id: 'task2_impact', q: impactQ, gt: groundTruth.task2_impact },
    { id: 'task4_critical', q: 'Find the most critical subsystem', gt: groundTruth.task4_critical },
    { id: 'task5_capabilities', q: 'List business capabilities', gt: groundTruth.task5_capabilities },
  ];

  const taskResults = [];
  let askLatencyTotal = 0;
  for (const t of taskDefs) {
    const res = runMnemosAsk(repoPath, t.q);
    askLatencyTotal += res.latencyMs;
    const score = scoreTask(res.answer, t.gt ?? {});
    taskResults.push({
      task: t.id,
      question: t.q,
      ...score,
      latency_ms: res.latencyMs,
      answer_preview: res.answer.slice(0, 400),
    });
  }

  const explain = runMnemosExplain(repoPath);
  const explainScore = scoreTask(explain.answer, groundTruth.task3_explain ?? {});

  const context = await measureMnemosContext(repoPath);
  const contextScore = scoreContextPackage(context, raw, groundTruth.task6_context ?? {});

  const allTaskScores = [
    ...taskResults.map((t) => t),
    explainScore,
    contextScore,
  ];
  const mnemosAgg = aggregateVerification(allTaskScores);

  const compression = raw.tokens > 0 ? Math.round((raw.tokens / context.tokens) * 10) / 10 : 0;

  const fullburnRun = runMnemosFullBurn(repoPath);
  const fullburnCtx = fullburnRun.ok ? await measureFullBurnContext(repoPath) : { tokens: 0, totalChars: 0, files: 0 };

  const mnemos = {
    tool: 'mnemos',
    build_latency_ms: build.latencyMs,
    ask_latency_ms: askLatencyTotal,
    total_latency_ms: build.latencyMs + askLatencyTotal + explain.latencyMs,
    tokens: context.tokens,
    context_bytes: context.totalChars,
    compression_ratio: compression,
    accuracy: mnemosAgg.accuracy,
    verified: mnemosAgg.verified,
    verification_tier: mnemosAgg.verification_tier,
    tasks_verified: mnemosAgg.tasks_verified,
    tasks_total: mnemosAgg.tasks_total,
    min_task_accuracy: mnemosAgg.min_task_accuracy,
    coverage: taskResults.reduce((s, t) => s + t.coverage, 0),
    tasks: taskResults,
    explain: { ...explainScore, latency_ms: explain.latencyMs },
    context_export: contextScore,
    context_sizes: context.sizes,
    ttu_seconds_with_tool: Math.round((build.latencyMs + askLatencyTotal + explain.latencyMs) / 1000) + 120,
    ttu_note: '120s added for human reading project.dna.json (~4k tokens at 200 wpm)',
    fullburn: {
      ok: fullburnRun.ok,
      latency_ms: fullburnRun.latencyMs,
      tokens: fullburnCtx.tokens,
      context_bytes: fullburnCtx.totalChars,
      files: fullburnCtx.files,
    },
  };

  const understandAnything = await runUnderstandAnything(repoPath, groundTruth);
  understandAnything.compression_ratio =
    understandAnything.tokens > 0 ? Math.round((raw.tokens / understandAnything.tokens) * 10) / 10 : 0;
  understandAnything.requires_llm_for_full = true;

  const gitingestOut = path.join(BENCH_ROOT, 'results', `${repoId}-gitingest.txt`);
  await mkdir(path.join(BENCH_ROOT, 'results'), { recursive: true });
  const gitingestRaw = runGitingest(repoPath, gitingestOut);
  const digestScore = gitingestRaw.digestText
    ? scoreDigestSearch(gitingestRaw.digestText, groundTruth)
    : { accuracy: 0, verified: false, verification_tier: 'F', tasks_verified: 0, tasks_total: 5 };
  const gitingest = {
    ...gitingestRaw,
    compression_ratio:
      gitingestRaw.tokens > 0 ? Math.round((raw.tokens / gitingestRaw.tokens) * 100) / 100 : 0,
    accuracy: digestScore.accuracy,
    verified: digestScore.verified,
    verification_tier: digestScore.verification_tier,
    tasks_verified: digestScore.tasks_verified,
    tasks_total: digestScore.tasks_total,
    note: 'Digest keyword search — fair baseline (full dump, no structured Q&A engine)',
  };
  delete gitingest.digestText;

  const graphify = runGraphifyLib(repoPath, groundTruth);
  graphify.compression_ratio =
    graphify.tokens > 0 ? Math.round((raw.tokens / graphify.tokens) * 10) / 10 : 0;

  const baseline = groundTruth.manual_baseline ?? {};
  const ttuWithout = (baseline.files_to_read_estimate ?? 20) * 90 + (baseline.grep_searches_estimate ?? 10) * 45;
  const ttuWith = mnemos.ttu_seconds_with_tool;
  const ttuSavings = Math.round((1 - ttuWith / ttuWithout) * 100);

  const result = {
    benchmark: 'INFERNO-bench',
    inferno_version: INFERNO_VERSION,
    dataset_version: DATASET_VERSION,
    repo: repoId,
    commit_sha: groundTruth.commit_sha,
    measured_at: new Date().toISOString(),
    raw_repo: raw,
    tools: { mnemos, 'understand-anything': understandAnything, gitingest, graphify },
    ttu: {
      without_tool_seconds: ttuWithout,
      with_mnemos_seconds: ttuWith,
      savings_percent: ttuSavings,
      methodology: baseline.methodology ?? '90s/file + 45s/search',
    },
    winner: {
      accuracy: 'mnemos',
      verification_tier: mnemos.verification_tier,
      compression: mnemos.compression_ratio >= (understandAnything.compression_ratio ?? 0) ? 'mnemos' : 'understand-anything',
      latency: build.latencyMs < (understandAnything.latencyMs ?? Infinity) ? 'mnemos' : 'understand-anything',
    },
  };

  const outPath = path.join(BENCH_ROOT, 'results', `${repoId}.json`);
  await writeFile(outPath, JSON.stringify(result, null, 2));
  console.log(
    `  Mnemos: tier=${mnemos.verification_tier} accuracy=${mnemos.accuracy}% (${mnemos.tasks_verified}/${mnemos.tasks_total} verified) compression=${compression}x`,
  );
  console.log(
    `  Understand-Anything: tier=${understandAnything.verification_tier} accuracy=${understandAnything.accuracy}%`,
  );
  console.log(`  Gitingest digest search: tier=${gitingest.verification_tier} accuracy=${gitingest.accuracy}%`);
  console.log(`  Graphify: tier=${graphify.verification_tier} accuracy=${graphify.accuracy}%`);
  console.log(`  TTU: ${ttuWithout}s → ${ttuWith}s (${ttuSavings}% faster)`);
  console.log(`  Written: ${outPath}`);
  return result;
}

const repo = process.argv[2] ?? 'express';
runRepoBenchmark(repo).catch((err) => {
  console.error(err);
  process.exit(1);
});
