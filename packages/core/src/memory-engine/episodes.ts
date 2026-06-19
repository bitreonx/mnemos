import { readFile, writeFile, mkdir, appendFile } from 'node:fs/promises';
import path from 'node:path';
import type { MemoryEpisode, RememberInput } from './types.js';
import { createEpisodeId, touchEpisode } from './decay.js';
import { cheapHash } from '../cache.js';

const EPISODES_FILE = 'episodes.jsonl';

export async function loadEpisodes(engineDir: string): Promise<MemoryEpisode[]> {
  const file = path.join(engineDir, EPISODES_FILE);
  try {
    const raw = await readFile(file, 'utf-8');
    return raw
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as MemoryEpisode);
  } catch {
    return [];
  }
}

export async function appendEpisode(engineDir: string, episode: MemoryEpisode): Promise<void> {
  await mkdir(engineDir, { recursive: true });
  await appendFile(path.join(engineDir, EPISODES_FILE), `${JSON.stringify(episode)}\n`, 'utf-8');
}

export async function saveEpisodes(engineDir: string, episodes: MemoryEpisode[]): Promise<void> {
  await mkdir(engineDir, { recursive: true });
  const content = episodes.map((e) => JSON.stringify(e)).join('\n') + (episodes.length ? '\n' : '');
  await writeFile(path.join(engineDir, EPISODES_FILE), content, 'utf-8');
}

export function createEpisode(input: RememberInput): MemoryEpisode {
  const now = new Date().toISOString();
  return {
    id: createEpisodeId(),
    content: input.content.trim(),
    tags: input.tags ?? [],
    source: input.source ?? 'agent',
    createdAt: now,
    lastAccessedAt: now,
    accessCount: 0,
    weight: 1,
    metadata: input.metadata,
  };
}

export function episodeToDocument(episode: MemoryEpisode): import('./types.js').MemoryDocument {
  return {
    id: episode.id,
    kind: 'episode',
    title: episode.content.slice(0, 80),
    body: episode.content,
    tags: ['episode', ...episode.tags],
    confidence: 0.7,
    contentHash: cheapHash(episode.content),
    builtAt: episode.createdAt,
    weight: episode.weight,
    source: 'episode',
  };
}

export { touchEpisode };
