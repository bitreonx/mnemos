#!/usr/bin/env node
/**
 * AI Model Evaluation Pack — golden Q&A dataset for testing LLMs against Mnemos Bench.
 * Usage: node mnemos-bench/scorer/ai-eval.mjs [repo]
 * Output: mnemos-bench/results/ai-eval-<repo>.json
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BENCH = path.resolve(__dirname, '..');
const MNEMOS_ROOT = path.resolve(BENCH, '..');
const MNEMOS_CLI = path.join(MNEMOS_ROOT, 'packages', 'cli', 'dist', 'index.js');

async function loadJson(p) {
  return JSON.parse(await readFile(p, 'utf-8'));
}

function runAsk(repoPath, question) {
  const r = spawnSync(process.execPath, [MNEMOS_CLI, 'ask', question, '-p', repoPath], {
    encoding: 'utf-8',
    cwd: MNEMOS_ROOT,
    timeout: 120_000,
  });
  const body = (r.stdout || '').split('Mnemos Copilot')[1] ?? r.stdout ?? '';
  return { ok: r.status === 0, answer: body.trim(), latency_ms: 0 };
}

function runExplain(repoPath) {
  const r = spawnSync(process.execPath, [MNEMOS_CLI, 'explain', repoPath], {
    encoding: 'utf-8',
    cwd: MNEMOS_ROOT,
    timeout: 120_000,
  });
  return { ok: r.status === 0, answer: (r.stdout || '').trim() };
}

async function buildEvalPack(repoId) {
  const repoPath = path.join(BENCH, 'repos', repoId);
  const universal = await loadJson(path.join(BENCH, 'tasks', 'universal.json'));
  const groundTruth = await loadJson(path.join(BENCH, 'tasks', 'ground-truth', `${repoId}.json`));
  const dna = await loadJson(path.join(repoPath, '.mnemos', 'project.dna.json'));

  const tasks = universal.tasks.map((t) => {
    let question = t.question;
    if (t.impact_target_field && groundTruth.impact_target) {
      question = question.replace('{impact_target}', groundTruth.impact_target);
    }
    return { id: t.id, question, intent: t.intent, expected_dimensions: t.expected_dimensions };
  });

  const mnemosAnswers = [];
  for (const t of tasks) {
    if (t.id === 'task3_explain') {
      const res = runExplain(repoPath);
      mnemosAnswers.push({ task: t.id, tool: 'mnemos', ...res });
      continue;
    }
    if (t.id === 'task6_context') {
      const ctxPath = path.join(repoPath, '.mnemos', 'project.dna.json');
      const agentPath = path.join(repoPath, '.mnemos', 'agent_context.json');
      mnemosAnswers.push({
        task: t.id,
        tool: 'mnemos',
        ok: true,
        answer: `DNA: ${ctxPath}\nAgent: ${agentPath}`,
        context_files: ['project.dna.json', 'agent_context.json', 'context/architecture.md'],
      });
      continue;
    }
    mnemosAnswers.push({ task: t.id, tool: 'mnemos', ...runAsk(repoPath, t.question) });
  }

  const gtKey = (id) => groundTruth[id.replace('task', 'task')] ?? groundTruth[id] ?? {};
  const groundTruthMap = {
    task1_login_start: groundTruth.task1_login_start,
    task2_impact: groundTruth.task2_impact,
    task3_explain: groundTruth.task3_explain,
    task4_critical: groundTruth.task4_critical,
    task5_capabilities: groundTruth.task5_capabilities,
  };

  const pack = {
    $schema: 'mnemos-bench/ai-eval/v1',
    repo: repoId,
    generated_at: new Date().toISOString(),
    purpose: 'Evaluate AI models: give model the Mnemos context package, then ask tasks. Score against ground_truth keywords.',
    protocol: {
      step1: 'Provide model with project.dna.json + agent_context.json only (no raw repo)',
      step2: 'Ask each task question verbatim',
      step3: 'Score response with mnemos-bench/scorer/run.mjs keyword scorer',
      step4: 'Compare model score vs mnemos baseline in this file',
    },
    context_for_ai: {
      dna_path: `.mnemos/project.dna.json`,
      agent_path: `.mnemos/agent_context.json`,
      repository: dna.repository,
      one_liner: dna.one_liner,
      token_estimate: Math.ceil(JSON.stringify(dna).length / 4),
    },
    tasks,
    ground_truth: groundTruthMap,
    mnemos_baseline: mnemosAnswers,
    scoring: {
      method: 'keyword_coverage',
      metrics: ['accuracy', 'coverage', 'latency_ms', 'token_count'],
      pass_threshold: { express: 70, nestjs: 55 },
    },
  };

  await mkdir(path.join(BENCH, 'results'), { recursive: true });
  const out = path.join(BENCH, 'results', `ai-eval-${repoId}.json`);
  await writeFile(out, JSON.stringify(pack, null, 2));
  console.log(`AI eval pack: ${out}`);
  return pack;
}

const repo = process.argv[2] ?? 'express';
buildEvalPack(repo).catch((e) => {
  console.error(e);
  process.exit(1);
});
