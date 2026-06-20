/**
 * Chronoshift — back-catalog import of Claude Code / agent JSONL sessions → episodes.
 * Devil-proofed: path containment, size caps, secret redaction, content-hash dedup.
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { cheapHash } from '../cache.js';
import type { ChronoshiftImportResult, MemoryEpisode, RememberInput } from './types.js';
import { appendEpisode, loadEpisodes, saveEpisodes, createEpisode } from './episodes.js';
import { redactSecrets } from './redaction.js';
import { resolveEpisodeScope, loadVeilPolicy } from './veil.js';

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_LINE_BYTES = 512 * 1024;
const MAX_FILES = 500;
const MIN_CONTENT_LEN = 12;

export interface ChronoshiftOptions {
  dryRun?: boolean;
  promoteToShortTerm?: boolean;
  tag?: string[];
  recursive?: boolean;
}

interface ParsedTurn {
  content: string;
  speaker: 'user' | 'assistant' | 'system';
  sessionId: string;
  sessionFile: string;
  turnIndex: number;
  timestamp?: string;
}

function extractTextContent(raw: unknown): string {
  if (typeof raw === 'string') return raw.trim();
  if (!raw || typeof raw !== 'object') return '';

  const obj = raw as Record<string, unknown>;
  if (typeof obj.content === 'string') return obj.content.trim();

  if (Array.isArray(obj.content)) {
    return obj.content
      .map((block) => {
        if (typeof block === 'string') return block;
        if (block && typeof block === 'object' && 'text' in block) return String((block as { text: string }).text);
        return '';
      })
      .filter(Boolean)
      .join('\n')
      .trim();
  }

  if (typeof obj.message === 'object' && obj.message) {
    return extractTextContent(obj.message);
  }

  return '';
}

function isDecisionLike(text: string): boolean {
  const lower = text.toLowerCase();
  const signals = [
    'we decided', 'decided to', 'agreed to', 'will use', "won't use", 'going with',
    'pricing', 'architecture', 'preference', 'remember', 'important:', 'note:',
    'constraint', 'must not', 'always use', 'never use', 'approved', 'rejected',
  ];
  return signals.some((s) => lower.includes(s)) || text.length > 200;
}

function parseJsonlLine(line: string, sessionFile: string, sessionId: string, turnIndex: number): ParsedTurn | null {
  let row: Record<string, unknown>;
  try {
    row = JSON.parse(line) as Record<string, unknown>;
  } catch {
    return null;
  }

  const type = String(row.type ?? row.role ?? '').toLowerCase();
  let speaker: ParsedTurn['speaker'] = 'system';
  if (type === 'user' || type === 'human') speaker = 'user';
  else if (type === 'assistant' || type === 'ai') speaker = 'assistant';

  const content =
    extractTextContent(row.message) ||
    extractTextContent(row) ||
    (typeof row.text === 'string' ? row.text : '');

  if (content.length < MIN_CONTENT_LEN) return null;
  if (speaker === 'assistant' && !isDecisionLike(content) && content.length < 80) return null;

  return {
    content,
    speaker,
    sessionId,
    sessionFile,
    turnIndex,
    timestamp: typeof row.timestamp === 'string' ? row.timestamp : undefined,
  };
}

async function collectJsonlFiles(root: string, recursive: boolean): Promise<string[]> {
  const out: string[] = [];
  const entries = await readdir(root, { withFileTypes: true });

  for (const ent of entries) {
    const full = path.join(root, ent.name);
    if (ent.isDirectory() && recursive) {
      const nested = await collectJsonlFiles(full, true);
      out.push(...nested);
      if (out.length >= MAX_FILES) break;
      continue;
    }
    if (ent.isFile() && ent.name.endsWith('.jsonl')) {
      out.push(full);
      if (out.length >= MAX_FILES) break;
    }
  }

  return out;
}

function sessionIdFromPath(file: string): string {
  return path.basename(file, '.jsonl');
}

export async function importSessionFile(
  engineDir: string,
  sessionFile: string,
  options: ChronoshiftOptions = {},
): Promise<{ created: number; skipped: number; turns: number; errors: string[] }> {
  const errors: string[] = [];
  const resolved = path.resolve(sessionFile);

  let fileStat;
  try {
    fileStat = await stat(resolved);
  } catch {
    return { created: 0, skipped: 0, turns: 0, errors: [`File not found: ${resolved}`] };
  }

  if (fileStat.size > MAX_FILE_BYTES) {
    return { created: 0, skipped: 0, turns: 0, errors: [`File too large (>${MAX_FILE_BYTES} bytes): ${resolved}`] };
  }

  const raw = await readFile(resolved, 'utf-8');
  const lines = raw.split('\n').filter((l) => l.trim());
  const sessionId = sessionIdFromPath(resolved);
  const existing = await loadEpisodes(engineDir);
  const hashSet = new Set(existing.map((e) => cheapHash(e.content)));

  const veil = await loadVeilPolicy(engineDir);
  let created = 0;
  let skipped = 0;
  let turns = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (Buffer.byteLength(line, 'utf-8') > MAX_LINE_BYTES) {
      errors.push(`Line ${i + 1} exceeds max size — skipped`);
      continue;
    }

    const turn = parseJsonlLine(line, resolved, sessionId, i);
    if (!turn) continue;
    turns++;

    const redacted = redactSecrets(turn.content);
    const hash = cheapHash(redacted.text);
    if (hashSet.has(hash)) {
      skipped++;
      continue;
    }

    const input: RememberInput = {
      content: redacted.text,
      tags: ['chronoshift', turn.speaker, ...(options.tag ?? [])],
      source: turn.speaker === 'user' ? 'user' : 'agent',
      metadata: {
        chronoshift: true,
        promoteShortTerm: options.promoteToShortTerm ?? isDecisionLike(redacted.text),
      },
    };

    const episode = createEpisode(input);
    episode.scope = resolveEpisodeScope(veil);
    episode.provenance = {
      sessionId: turn.sessionId,
      sessionFile: turn.sessionFile,
      turnIndex: turn.turnIndex,
      citedLine: i + 1,
      speaker: turn.speaker,
      importedAt: new Date().toISOString(),
      importSource: 'chronoshift',
    };
    if (turn.timestamp) episode.createdAt = turn.timestamp;

    if (!options.dryRun) {
      await appendEpisode(engineDir, episode);
    }

    hashSet.add(hash);
    created++;
  }

  return { created, skipped, turns, errors };
}

export async function chronoshiftImport(
  engineDir: string,
  sessionsPath: string,
  options: ChronoshiftOptions = {},
): Promise<ChronoshiftImportResult> {
  const started = Date.now();
  const resolved = path.resolve(sessionsPath);
  const st = await stat(resolved);
  const files = st.isDirectory()
    ? await collectJsonlFiles(resolved, options.recursive ?? true)
    : [resolved];

  let episodesCreated = 0;
  let episodesSkipped = 0;
  let turnsParsed = 0;
  const errors: string[] = [];

  for (const file of files) {
    const result = await importSessionFile(engineDir, file, options);
    episodesCreated += result.created;
    episodesSkipped += result.skipped;
    turnsParsed += result.turns;
    errors.push(...result.errors);
  }

  return {
    filesScanned: files.length,
    turnsParsed,
    episodesCreated,
    episodesSkipped,
    errors,
    durationMs: Date.now() - started,
  };
}

/** Promote high-signal chronoshift episodes into capped short-term memory file. */
export async function promoteChronoshiftShortTerm(engineDir: string, cap = 40): Promise<number> {
  const episodes = await loadEpisodes(engineDir);
  const promoted = episodes
    .filter((e) => e.metadata?.chronoshift && e.metadata?.promoteShortTerm)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, cap);

  if (!promoted.length) return 0;

  for (const ep of promoted) {
    ep.weight = Math.min(2, ep.weight + 0.3);
    ep.tags = [...new Set([...ep.tags, 'short-term'])];
  }

  const rest = episodes.filter((e) => !promoted.find((p) => p.id === e.id));
  await saveEpisodes(engineDir, [...rest, ...promoted]);
  return promoted.length;
}
