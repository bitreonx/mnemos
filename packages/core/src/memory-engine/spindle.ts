/**
 * Spindle — turn capture heuristics + Hermes frozen snapshot injection.
 * Evaluates agent turns for durable facts; builds soul/user/memory/today files.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { FrozenSnapshot, MemoryEpisode, RememberInput } from './types.js';
import { createEpisode } from './episodes.js';
import { redactSecrets } from './redaction.js';
import { resolveEpisodeScope, loadVeilPolicy } from './veil.js';
import { estimateTokens } from '../proxy/compress-output.js';

const SPINDLE_MARKER = '# mnemos-spindle-capture';
const SHORT_TERM_CAP = 48;
const TODAY_CAP = 24;

const DECISION_PATTERNS = [
  /\b(we|i)\s+(decided|agreed|chose|picked|will use|won't use|going with)\b/i,
  /\b(pricing|architecture|constraint|preference|approved|rejected)\b/i,
  /\b(remember|important|note:|must not|always|never)\b/i,
  /\b(fixed|resolved|root cause|verified)\b/i,
];

export interface SpindleCaptureResult {
  captured: boolean;
  reason: string;
  episode?: ReturnType<typeof createEpisode>;
  promoteShortTerm: boolean;
}

export function evaluateSpindleCapture(text: string): SpindleCaptureResult {
  const trimmed = text.trim();
  if (trimmed.length < 16) {
    return { captured: false, reason: 'too_short', promoteShortTerm: false };
  }

  const matches = DECISION_PATTERNS.filter((re) => re.test(trimmed)).length;
  const promoteShortTerm = matches >= 1 || trimmed.length > 280;

  if (matches === 0 && trimmed.length < 120) {
    return { captured: false, reason: 'not_durable_signal', promoteShortTerm: false };
  }

  return { captured: true, reason: matches >= 2 ? 'strong_decision' : 'likely_durable', promoteShortTerm };
}

export async function spindleRemember(
  engineDir: string,
  content: string,
  options: { tags?: string[]; source?: RememberInput['source'] } = {},
): Promise<SpindleCaptureResult> {
  const evalResult = evaluateSpindleCapture(content);
  if (!evalResult.captured) return evalResult;

  const redacted = redactSecrets(content);
  const veil = await loadVeilPolicy(engineDir);
  const episode = createEpisode({
    content: redacted.text,
    tags: ['spindle', ...(options.tags ?? []), ...(evalResult.promoteShortTerm ? ['short-term'] : [])],
    source: options.source ?? 'agent',
    metadata: { spindle: true, promoteShortTerm: evalResult.promoteShortTerm, redactionHits: redacted.hits },
  });

  episode.scope = resolveEpisodeScope(veil);
  episode.provenance = {
    importedAt: new Date().toISOString(),
    importSource: 'spindle',
    speaker: options.source === 'user' ? 'user' : 'assistant',
  };

  return { ...evalResult, episode };
}

function pickShortTerm(episodes: MemoryEpisode[]): MemoryEpisode[] {
  return episodes
    .filter((e) => e.tags.includes('short-term') || e.metadata?.promoteShortTerm)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, SHORT_TERM_CAP);
}

function pickToday(episodes: MemoryEpisode[]): MemoryEpisode[] {
  const today = new Date().toISOString().slice(0, 10);
  return episodes
    .filter((e) => e.createdAt.startsWith(today))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, TODAY_CAP);
}

export function buildFrozenSnapshot(
  episodes: MemoryEpisode[],
  repoName: string,
  soulOverride?: string,
  userOverride?: string,
): FrozenSnapshot {
  const shortTerm = pickShortTerm(episodes);
  const today = pickToday(episodes);

  const soul =
    soulOverride ??
    [
      '# Soul',
      '',
      'Be cautious, then decisive. Reason before acting. Verify before claiming done.',
      'Read Mnemos DNA before grepping. Cite sources. Admit gaps honestly.',
      'Repository: ' + repoName,
    ].join('\n');

  const user =
    userOverride ??
    [
      '# User context',
      '',
      'Engineer building with AI agents. Values honest memory, local-first tools, reproducible benchmarks.',
    ].join('\n');

  const memory =
    shortTerm.length === 0
      ? '# Memory\n\n_No curated short-term facts yet. Spindle will promote decisions automatically._'
      : [
          '# Memory (capped frozen snapshot)',
          '',
          ...shortTerm.map((e, i) => `${i + 1}. ${e.content.slice(0, 400)}`),
        ].join('\n');

  const todayBlock =
    today.length === 0
      ? '# Today\n\n_No episodes captured today._'
      : ['# Today', '', ...today.map((e) => `- ${e.content.slice(0, 200)}`)].join('\n');

  const full = [soul, user, memory, todayBlock].join('\n\n---\n\n');
  return {
    generatedAt: new Date().toISOString(),
    soul,
    user,
    memory,
    today: todayBlock,
    estimatedTokens: estimateTokens(full),
  };
}

export async function writeFrozenSnapshot(engineDir: string, snapshot: FrozenSnapshot): Promise<string> {
  const dir = path.join(engineDir, 'frozen');
  await mkdir(dir, { recursive: true });
  const base = path.join(dir, 'snapshot');
  await writeFile(`${base}.md`, [snapshot.soul, snapshot.user, snapshot.memory, snapshot.today].join('\n\n---\n\n'), 'utf-8');
  await writeFile(path.join(dir, 'soul.md'), snapshot.soul, 'utf-8');
  await writeFile(path.join(dir, 'user.md'), snapshot.user, 'utf-8');
  await writeFile(path.join(dir, 'memory.md'), snapshot.memory, 'utf-8');
  await writeFile(path.join(dir, 'today.md'), snapshot.today, 'utf-8');
  return `${base}.md`;
}

export function buildSpindleHookScript(): string {
  if (process.platform === 'win32') {
    return `@echo off
${SPINDLE_MARKER}
REM Spindle: optional stdin capture — pipe turn summary to mnemos memory spindle capture -
where mnemos >nul 2>&1
if %ERRORLEVEL% NEQ 0 exit /b 0
exit /b 0
`;
  }
  return `#!/bin/sh
${SPINDLE_MARKER}
# Spindle turn-capture hook placeholder — use: mnemos memory spindle capture "fact"
exit 0
`;
}

export { SPINDLE_MARKER };
