/**
 * M6 — Encrypted team sync bundle (local file transfer, no cloud).
 * Export/import .mnemos/engine via AES-256-GCM + scrypt passphrase.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';

export const SYNC_BUNDLE_MAGIC = 'MNEMOS-SYNC-v1';
export const SYNC_BUNDLE_EXT = '.mnemos-sync';

export interface SyncBundleManifest {
  magic: typeof SYNC_BUNDLE_MAGIC;
  version: 1;
  repository: string;
  exportedAt: string;
  documentCount: number;
  episodeCount: number;
  sessionCount: number;
  encrypted: true;
}

export interface ExportSyncOptions {
  engineDir: string;
  repository: string;
  password: string;
  outPath: string;
}

export interface ImportSyncOptions {
  bundlePath: string;
  password: string;
  engineDir: string;
  merge?: boolean;
}

function deriveKey(password: string, salt: Buffer): Buffer {
  return scryptSync(password, salt, 32);
}

function encryptPayload(plaintext: Buffer, password: string): Buffer {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = deriveKey(password, salt);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([salt, iv, tag, encrypted]);
}

function decryptPayload(data: Buffer, password: string): Buffer {
  const salt = data.subarray(0, 16);
  const iv = data.subarray(16, 28);
  const tag = data.subarray(28, 44);
  const encrypted = data.subarray(44);
  const key = deriveKey(password, salt);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

async function collectEngineFiles(engineDir: string): Promise<Record<string, Buffer>> {
  const { readdir } = await import('node:fs/promises');
  const files: Record<string, Buffer> = {};
  try {
    const names = await readdir(engineDir);
    for (const name of names) {
      if (name.endsWith('.json') || name.endsWith('.jsonl') || name.endsWith('.db')) {
        files[name] = await readFile(path.join(engineDir, name));
      }
    }
  } catch {
    // empty dir ok
  }
  return files;
}

export async function exportEncryptedBundle(opts: ExportSyncOptions): Promise<SyncBundleManifest> {
  const files = await collectEngineFiles(opts.engineDir);
  const { loadEpisodes } = await import('./episodes.js');
  const { loadSessionEvents } = await import('./sessions.js');
  const episodes = await loadEpisodes(opts.engineDir);
  const sessions = await loadSessionEvents(opts.engineDir);

  let documentCount = 0;
  try {
    const manifest = JSON.parse(files['manifest.json']?.toString('utf-8') ?? '{}') as { documentCount?: number };
    documentCount = manifest.documentCount ?? 0;
  } catch {
    documentCount = 0;
  }

  const manifest: SyncBundleManifest = {
    magic: SYNC_BUNDLE_MAGIC,
    version: 1,
    repository: opts.repository,
    exportedAt: new Date().toISOString(),
    documentCount,
    episodeCount: episodes.length,
    sessionCount: sessions.length,
    encrypted: true,
  };

  const payload = gzipSync(
    Buffer.from(JSON.stringify({ manifest, files: Object.fromEntries(
      Object.entries(files).map(([k, v]) => [k, v.toString('base64')]),
    ) }), 'utf-8'),
  );

  const encrypted = encryptPayload(payload, opts.password);
  const bundle = Buffer.concat([
    Buffer.from(`${SYNC_BUNDLE_MAGIC}\n`),
    encrypted,
  ]);

  await mkdir(path.dirname(opts.outPath), { recursive: true });
  await writeFile(opts.outPath, bundle);
  return manifest;
}

export async function importEncryptedBundle(opts: ImportSyncOptions): Promise<SyncBundleManifest> {
  const raw = await readFile(opts.bundlePath);
  const header = SYNC_BUNDLE_MAGIC + '\n';
  if (!raw.subarray(0, header.length).equals(Buffer.from(header))) {
    throw new Error('Invalid Mnemos sync bundle');
  }
  const decrypted = decryptPayload(raw.subarray(header.length), opts.password);
  const { manifest, files } = JSON.parse(gunzipSync(decrypted).toString('utf-8')) as {
    manifest: SyncBundleManifest;
    files: Record<string, string>;
  };

  await mkdir(opts.engineDir, { recursive: true });
  for (const [name, b64] of Object.entries(files)) {
    const target = path.join(opts.engineDir, name);
    if (!opts.merge && (name === 'memory.db' || name === 'manifest.json')) {
      await writeFile(target, Buffer.from(b64, 'base64'));
      continue;
    }
    if (opts.merge && name.endsWith('.jsonl')) {
      try {
        const existing = await readFile(target, 'utf-8');
        const incoming = Buffer.from(b64, 'base64').toString('utf-8');
        await writeFile(target, existing + incoming, 'utf-8');
        continue;
      } catch {
        // fall through
      }
    }
    await writeFile(target, Buffer.from(b64, 'base64'));
  }

  return manifest;
}
