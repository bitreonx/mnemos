/**
 * M5 — Session trace ingest (local agent observability).
 * Records tool calls, queries, and remembers for cross-session learning.
 */

import { readFile, writeFile, mkdir, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export type SessionEventType = 'session_start' | 'session_end' | 'tool_call' | 'query' | 'remember' | 'context' | 'error';

export interface SessionEvent {
  id: string;
  sessionId: string;
  type: SessionEventType;
  timestamp: string;
  payload: Record<string, unknown>;
}

export interface SessionSummary {
  sessionId: string;
  startedAt: string;
  endedAt?: string;
  eventCount: number;
  toolCalls: number;
  queries: number;
  remembers: number;
}

const SESSIONS_FILE = 'sessions.jsonl';
const ACTIVE_FILE = 'session-active.json';

export function createSessionId(): string {
  return `session:${Date.now()}:${randomUUID().slice(0, 8)}`;
}

export async function startSession(engineDir: string, metadata?: Record<string, unknown>): Promise<string> {
  await mkdir(engineDir, { recursive: true });
  const sessionId = createSessionId();
  const startedAt = new Date().toISOString();
  await writeFile(path.join(engineDir, ACTIVE_FILE), JSON.stringify({ sessionId, startedAt, metadata }), 'utf-8');
  await logSessionEvent(engineDir, sessionId, 'session_start', { metadata });
  return sessionId;
}

export async function endSession(engineDir: string): Promise<SessionSummary | null> {
  const active = await getActiveSession(engineDir);
  if (!active) return null;
  await logSessionEvent(engineDir, active.sessionId, 'session_end', {});
  await writeFile(path.join(engineDir, ACTIVE_FILE), '', 'utf-8');
  return summarizeSession(await loadSessionEvents(engineDir, active.sessionId));
}

export async function getActiveSession(engineDir: string): Promise<{ sessionId: string; startedAt: string } | null> {
  try {
    const raw = await readFile(path.join(engineDir, ACTIVE_FILE), 'utf-8');
    if (!raw.trim()) return null;
    return JSON.parse(raw) as { sessionId: string; startedAt: string };
  } catch {
    return null;
  }
}

export async function logSessionEvent(
  engineDir: string,
  sessionId: string,
  type: SessionEventType,
  payload: Record<string, unknown>,
): Promise<SessionEvent> {
  await mkdir(engineDir, { recursive: true });
  const event: SessionEvent = {
    id: `evt:${Date.now()}:${randomUUID().slice(0, 6)}`,
    sessionId,
    type,
    timestamp: new Date().toISOString(),
    payload,
  };
  await appendFile(path.join(engineDir, SESSIONS_FILE), `${JSON.stringify(event)}\n`, 'utf-8');
  return event;
}

export async function logSessionEventAuto(
  engineDir: string,
  type: SessionEventType,
  payload: Record<string, unknown>,
): Promise<SessionEvent> {
  let active = await getActiveSession(engineDir);
  if (!active) {
    const sessionId = await startSession(engineDir);
    active = { sessionId, startedAt: new Date().toISOString() };
  }
  return logSessionEvent(engineDir, active.sessionId, type, payload);
}

export async function loadSessionEvents(engineDir: string, sessionId?: string): Promise<SessionEvent[]> {
  try {
    const raw = await readFile(path.join(engineDir, SESSIONS_FILE), 'utf-8');
    const events = raw.split('\n').filter(Boolean).map((l) => JSON.parse(l) as SessionEvent);
    return sessionId ? events.filter((e) => e.sessionId === sessionId) : events;
  } catch {
    return [];
  }
}

export function summarizeSession(events: SessionEvent[]): SessionSummary {
  const sessionId = events[0]?.sessionId ?? 'unknown';
  const startedAt = events.find((e) => e.type === 'session_start')?.timestamp ?? events[0]?.timestamp ?? '';
  const endedAt = events.find((e) => e.type === 'session_end')?.timestamp;
  return {
    sessionId,
    startedAt,
    endedAt,
    eventCount: events.length,
    toolCalls: events.filter((e) => e.type === 'tool_call').length,
    queries: events.filter((e) => e.type === 'query').length,
    remembers: events.filter((e) => e.type === 'remember').length,
  };
}

export async function listRecentSessions(engineDir: string, limit = 20): Promise<SessionSummary[]> {
  const events = await loadSessionEvents(engineDir);
  const bySession = new Map<string, SessionEvent[]>();
  for (const e of events) {
    const list = bySession.get(e.sessionId) ?? [];
    list.push(e);
    bySession.set(e.sessionId, list);
  }
  return [...bySession.values()]
    .map(summarizeSession)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, limit);
}
