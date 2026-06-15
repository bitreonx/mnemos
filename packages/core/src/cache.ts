import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { existsSync } from 'node:fs';

export interface FileCacheEntry {
  mtimeMs: number;
  size: number;
  hash: string;
}

export interface FileCache {
  version: number;
  root: string;
  entries: Record<string, FileCacheEntry>;
}

const CACHE_VERSION = 1;
const CACHE_FILE = 'file-cache.json';

/**
 * Cheap rolling hash for content. Not cryptographic — just to detect
 * differences quickly without storing full content.
 */
export function cheapHash(content: string): string {
  let h1 = 0xdeadbeef ^ 0;
  let h2 = 0x41c6ce57 ^ 0;
  for (let i = 0; i < content.length; i++) {
    const ch = content.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

export async function loadFileCache(outputDir: string): Promise<FileCache | null> {
  const file = path.join(outputDir, CACHE_FILE);
  if (!existsSync(file)) return null;
  try {
    const raw = await readFile(file, 'utf-8');
    const parsed = JSON.parse(raw) as FileCache;
    if (parsed.version !== CACHE_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveFileCache(outputDir: string, cache: FileCache): Promise<void> {
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, CACHE_FILE), JSON.stringify(cache, null, 2), 'utf-8');
}

export function createFileCache(root: string): FileCache {
  return { version: CACHE_VERSION, root, entries: {} };
}

export function hasFileChanged(
  cache: FileCache | null,
  relativePath: string,
  content: string,
): boolean {
  if (!cache) return true;
  const entry = cache.entries[relativePath];
  if (!entry) return true;
  return entry.hash !== cheapHash(content);
}

export function recordFile(
  cache: FileCache,
  relativePath: string,
  content: string,
  mtimeMs: number,
): void {
  cache.entries[relativePath] = {
    mtimeMs,
    size: content.length,
    hash: cheapHash(content),
  };
}

export function removeFile(cache: FileCache, relativePath: string): void {
  delete cache.entries[relativePath];
}

const PARSE_CACHE_VERSION = 1;
const PARSE_CACHE_FILE = 'parse-cache.json';

export interface ParseCacheEntry {
  hash: string;
  parsed: import('./types.js').ParsedFile;
}

export interface ParseCache {
  version: number;
  entries: Record<string, ParseCacheEntry>;
}

export async function loadParseCache(outputDir: string): Promise<ParseCache> {
  const file = path.join(outputDir, PARSE_CACHE_FILE);
  if (!existsSync(file)) return { version: PARSE_CACHE_VERSION, entries: {} };
  try {
    const raw = await readFile(file, 'utf-8');
    const parsed = JSON.parse(raw) as ParseCache;
    if (parsed.version !== PARSE_CACHE_VERSION) return { version: PARSE_CACHE_VERSION, entries: {} };
    return parsed;
  } catch {
    return { version: PARSE_CACHE_VERSION, entries: {} };
  }
}

export async function saveParseCache(outputDir: string, cache: ParseCache): Promise<void> {
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, PARSE_CACHE_FILE), JSON.stringify(cache, null, 2), 'utf-8');
}
