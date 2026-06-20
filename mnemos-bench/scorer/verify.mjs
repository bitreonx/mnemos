#!/usr/bin/env node
/**
 * INFERNO verification harness — multi-signal scoring for codebase understanding.
 *
 * Design lineage (open, trusted benchmarks):
 *   SWE-bench  — deterministic pass/fail gates on repo test suites
 *   HumanEval  — functional correctness over single numeric scores
 *   MMLU       — exact-match with partial credit bands
 *   GAIA       — multi-step reasoning with structured rubrics
 *
 * INFERNO adds adversarial layers: keyword AND/OR, path assertions, forbidden traps,
 * artifact checks, and tiered verification (A/B/C/F) so weak answers cannot hide.
 */
export const INFERNO_VERSION = '1.0.0';
export const DATASET_VERSION = '1.0.0';

export function normalizeText(text) {
  return (text ?? '').toLowerCase();
}

/**
 * Score one task answer against ground-truth rubric.
 * required = ALL must match. required_any = OR (min_required_any hits).
 */
export function scoreTask(text, rubric = {}) {
  const {
    required_keywords: required = [],
    required_any = [],
    forbidden_keywords: forbidden = [],
    forbidden_any = [],
    forbidden_domains = [],
    required_paths = [],
    min_required_any = 1,
  } = rubric;

  const norm = normalizeText(text);
  const signals = [];

  const requiredHits = required.filter((k) => norm.includes(k.toLowerCase()));
  const requiredScore =
    required.length === 0 ? 100 : Math.round((requiredHits.length / required.length) * 100);
  if (required.length > 0) {
    signals.push({ id: 'keywords_required', score: requiredScore, hits: requiredHits, total: required.length });
  }

  let anyHits = [];
  if (required_any.length > 0) {
    anyHits = required_any.filter((k) => norm.includes(k.toLowerCase()));
    const anyScore =
      anyHits.length >= min_required_any
        ? 100
        : Math.round((anyHits.length / Math.max(min_required_any, 1)) * 100);
    signals.push({
      id: 'keywords_any',
      score: Math.min(100, anyScore),
      hits: anyHits,
      total: required_any.length,
      min: min_required_any,
    });
  }

  const allForbidden = [...forbidden, ...forbidden_any, ...forbidden_domains];
  const forbiddenHits = allForbidden.filter((k) => norm.includes(k.toLowerCase()));
  const penalty =
    allForbidden.length > 0 ? Math.round((forbiddenHits.length / allForbidden.length) * 30) : 0;

  const pathHits = required_paths.filter((p) =>
    norm.includes(p.toLowerCase().replace(/\\/g, '/')),
  );
  const pathScore =
    required_paths.length === 0 ? 100 : Math.round((pathHits.length / required_paths.length) * 100);
  if (required_paths.length > 0) {
    signals.push({ id: 'paths', score: pathScore, hits: pathHits, total: required_paths.length });
  }

  const activeSignals = signals.length > 0 ? signals : [{ id: 'empty_rubric', score: 100 }];
  const weights = activeSignals.map((s) => (s.id === 'paths' ? 1.5 : 1));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const composite = Math.round(
    activeSignals.reduce((sum, sig, i) => sum + sig.score * weights[i], 0) / totalWeight,
  );
  const accuracy = Math.max(0, composite - penalty);

  const anyOk = required_any.length === 0 || anyHits.length >= min_required_any;
  const pathsOk = required_paths.length === 0 || pathScore === 100;
  const forbiddenOk = forbiddenHits.length === 0;
  const requiredOk = required.length === 0 || requiredScore === 100;
  const verified = accuracy >= 95 && forbiddenOk && anyOk && pathsOk && requiredOk;

  return {
    accuracy,
    verified,
    coverage: requiredHits.length + anyHits.length + pathHits.length,
    required_hits: requiredHits,
    required_any_hits: anyHits,
    path_hits: pathHits,
    forbidden_hits: forbiddenHits,
    penalty,
    signals: activeSignals,
    verification_tier: verified ? 'A' : accuracy >= 80 ? 'B' : accuracy >= 50 ? 'C' : 'F',
    gates: { requiredOk, anyOk, pathsOk, forbiddenOk },
  };
}

/** Score AI context export (task6) — artifact presence + compression floor. */
export function scoreContextPackage(contextMeta, rawRepo, rubric = {}) {
  const requiredArtifacts = rubric.required_artifacts ?? ['project.dna.json', 'agent_context.json'];
  const minCompression = rubric.min_compression ?? 2;
  const maxTokens = rubric.max_tokens ?? 500_000;

  const sizes = contextMeta.sizes ?? {};
  const present = requiredArtifacts.filter((f) => (sizes[f] ?? 0) > 0);
  const artifactScore = Math.round((present.length / requiredArtifacts.length) * 100);

  const hasArchitecture = Object.keys(sizes).some((k) => k.includes('context/architecture'));
  const compression =
    rawRepo.tokens > 0 && contextMeta.tokens > 0 ? rawRepo.tokens / contextMeta.tokens : 0;
  const withinBudget = contextMeta.tokens > 0 && contextMeta.tokens <= maxTokens;

  const compressionOk = compression >= minCompression;
  const artifactsOk = present.length === requiredArtifacts.length;
  const accuracy = Math.round((artifactScore + (compressionOk ? 100 : Math.min(100, compression * 20))) / 2);

  const verified = artifactsOk && compressionOk && withinBudget;

  return {
    accuracy,
    verified,
    verification_tier: verified ? 'A' : accuracy >= 80 ? 'B' : 'F',
    compression_ratio: Math.round(compression * 10) / 10,
    artifacts_present: present,
    has_architecture_context: hasArchitecture,
    tokens: contextMeta.tokens,
    within_budget: withinBudget,
    gates: { artifactsOk, compressionOk, withinBudget },
  };
}

/** Aggregate per-task scores into run-level verification. */
export function aggregateVerification(taskScores) {
  if (taskScores.length === 0) {
    return { accuracy: 0, verified: false, verification_tier: 'F', tasks_verified: 0, tasks_total: 0 };
  }

  const accuracies = taskScores.map((t) => t.accuracy);
  const avg = accuracies.reduce((a, b) => a + b, 0) / accuracies.length;
  const allVerified = taskScores.every((t) => t.verified);
  const minAccuracy = Math.min(...accuracies);
  const verifiedCount = taskScores.filter((t) => t.verified).length;

  let tier = 'F';
  if (allVerified && minAccuracy >= 95) tier = 'A';
  else if (avg >= 80 && minAccuracy >= 70) tier = 'B';
  else if (avg >= 50) tier = 'C';

  return {
    accuracy: Math.round(avg * 10) / 10,
    verified: allVerified && minAccuracy >= 95,
    verification_tier: tier,
    tasks_verified: verifiedCount,
    tasks_total: taskScores.length,
    min_task_accuracy: minAccuracy,
  };
}

/** Search digest text for ground-truth keywords (fair Gitingest baseline). */
export function scoreDigestSearch(digestText, groundTruth) {
  const tasks = [
    groundTruth.task1_login_start,
    groundTruth.task2_impact,
    groundTruth.task3_explain,
    groundTruth.task4_critical,
    groundTruth.task5_capabilities,
  ].filter(Boolean);

  const scores = tasks.map((gt) => scoreTask(digestText, gt));
  return aggregateVerification(scores);
}
