/**
 * Spiralfuse — loop token budget fuse (Theo loop cost guard).
 * Prevents runaway agent loops from burning millions of tokens unchecked.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { SpiralfuseBudget } from './types.js';

const SPIRALFUSE_SCHEMA = 'mnemos/spiralfuse/v1';
const SPIRALFUSE_FILE = 'spiralfuse-active.json';
const SPIRALFUSE_LOG = 'spiralfuse-log.jsonl';

export interface SpiralfuseTickInput {
  tokensDelta: number;
  label?: string;
}

export interface SpiralfuseTickResult {
  budget: SpiralfuseBudget;
  allowed: boolean;
  warning?: string;
}

function fusePath(engineDir: string): string {
  return path.join(engineDir, SPIRALFUSE_FILE);
}

function logPath(engineDir: string): string {
  return path.join(engineDir, SPIRALFUSE_LOG);
}

function createLoopId(): string {
  return `loop_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function spiralfuseStart(
  engineDir: string,
  options: { label?: string; maxTokens?: number; maxIterations?: number } = {},
): Promise<SpiralfuseBudget> {
  await mkdir(engineDir, { recursive: true });
  const now = new Date().toISOString();
  const budget: SpiralfuseBudget = {
    $schema: SPIRALFUSE_SCHEMA,
    loopId: createLoopId(),
    label: options.label ?? 'unnamed-loop',
    maxTokens: options.maxTokens ?? 250_000,
    tokensUsed: 0,
    maxIterations: options.maxIterations ?? 50,
    iterations: 0,
    fused: false,
    startedAt: now,
    lastTickAt: now,
  };
  await writeFile(fusePath(engineDir), JSON.stringify(budget, null, 2), 'utf-8');
  return budget;
}

export async function spiralfuseLoad(engineDir: string): Promise<SpiralfuseBudget | null> {
  try {
    const raw = await readFile(fusePath(engineDir), 'utf-8');
    return JSON.parse(raw) as SpiralfuseBudget;
  } catch {
    return null;
  }
}

async function appendFuseLog(engineDir: string, event: Record<string, unknown>): Promise<void> {
  await appendFileSafe(logPath(engineDir), `${JSON.stringify({ ...event, at: new Date().toISOString() })}\n`);
}

async function appendFileSafe(file: string, line: string): Promise<void> {
  const { appendFile } = await import('node:fs/promises');
  await appendFile(file, line, 'utf-8');
}

export async function spiralfuseTick(
  engineDir: string,
  input: SpiralfuseTickInput,
): Promise<SpiralfuseTickResult> {
  const budget = await spiralfuseLoad(engineDir);
  if (!budget) {
    throw new Error('No active Spiralfuse loop. Run `mnemos memory loop start` first.');
  }

  if (budget.fused) {
    return { budget, allowed: false, warning: budget.fuseReason ?? 'Loop already fused.' };
  }

  budget.iterations += 1;
  budget.tokensUsed += Math.max(0, input.tokensDelta);
  budget.lastTickAt = new Date().toISOString();
  if (input.label) budget.label = input.label;

  let fuseReason: string | undefined;
  if (budget.tokensUsed >= budget.maxTokens) {
    fuseReason = `Token budget exceeded (${budget.tokensUsed.toLocaleString()} / ${budget.maxTokens.toLocaleString()})`;
  } else if (budget.iterations >= budget.maxIterations) {
    fuseReason = `Iteration cap reached (${budget.iterations} / ${budget.maxIterations})`;
  }

  if (fuseReason) {
    budget.fused = true;
    budget.fuseReason = fuseReason;
    await writeFile(fusePath(engineDir), JSON.stringify(budget, null, 2), 'utf-8');
    await appendFuseLog(engineDir, { event: 'fuse', reason: fuseReason, budget });
    return { budget, allowed: false, warning: fuseReason };
  }

  await writeFile(fusePath(engineDir), JSON.stringify(budget, null, 2), 'utf-8');
  await appendFuseLog(engineDir, { event: 'tick', tokensDelta: input.tokensDelta, budget });

  const pct = budget.tokensUsed / budget.maxTokens;
  const warning = pct >= 0.85 ? `Approaching fuse (${(pct * 100).toFixed(0)}% tokens used)` : undefined;

  return { budget, allowed: true, warning };
}

export async function spiralfuseReset(engineDir: string): Promise<void> {
  const { unlink } = await import('node:fs/promises');
  try {
    await unlink(fusePath(engineDir));
  } catch {
    /* no active loop */
  }
}

export function formatSpiralfuseStatus(budget: SpiralfuseBudget | null): string {
  if (!budget) return 'Spiralfuse: no active loop';
  const pct = ((budget.tokensUsed / budget.maxTokens) * 100).toFixed(1);
  return [
    `Spiralfuse · ${budget.label} (${budget.loopId})`,
    `  tokens: ${budget.tokensUsed.toLocaleString()} / ${budget.maxTokens.toLocaleString()} (${pct}%)`,
    `  iterations: ${budget.iterations} / ${budget.maxIterations}`,
    `  fused: ${budget.fused}${budget.fuseReason ? ` — ${budget.fuseReason}` : ''}`,
    `  started: ${budget.startedAt}`,
  ].join('\n');
}
