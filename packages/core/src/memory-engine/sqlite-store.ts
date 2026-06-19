/**
 * M2 — SQLite incremental memory store (100% local).
 * Uses node:sqlite when available (Node 22+), else sql.js WASM fallback.
 */

/// <reference path="./sql-js.d.ts" />
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import type {
  EngineManifest,
  LoadedEngineIndex,
  MemoryContradiction,
  MemoryDocument,
  MemoryEpisode,
  MemoryFact,
} from './types.js';
import { MEMORY_ENGINE_SCHEMA, MEMORY_ENGINE_CODENAME, EMBEDDING_DIMS } from './types.js';
import { normalizeEngineManifest } from './manifest-normalize.js';
import { deserializeVector } from './embeddings.js';

const DB_FILE = 'memory.db';
const MANIFEST = 'manifest.json';

export interface SqliteBackend {
  kind: 'node-sqlite' | 'sqljs' | 'json-fallback';
}

type DbHandle = {
  kind: SqliteBackend['kind'];
  exec(sql: string, params?: unknown[]): void;
  query(sql: string, params?: unknown[]): Record<string, unknown>[];
  close(): void;
  export?(): Uint8Array;
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  path TEXT,
  tags TEXT NOT NULL,
  confidence REAL NOT NULL,
  content_hash TEXT NOT NULL,
  built_at TEXT NOT NULL,
  weight REAL NOT NULL,
  source TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS vectors (
  doc_id TEXT PRIMARY KEY,
  dims INTEGER NOT NULL,
  vector BLOB NOT NULL,
  FOREIGN KEY(doc_id) REFERENCES documents(id)
);
CREATE TABLE IF NOT EXISTS facts (
  key TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  predicate TEXT NOT NULL,
  object TEXT NOT NULL,
  confidence REAL NOT NULL,
  document_id TEXT NOT NULL,
  built_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS contradictions (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL,
  subject TEXT NOT NULL,
  predicate TEXT NOT NULL,
  values_json TEXT NOT NULL,
  detected_at TEXT NOT NULL,
  severity TEXT NOT NULL,
  resolved INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS parse_cache (
  path TEXT PRIMARY KEY,
  content_hash TEXT NOT NULL,
  parsed_at TEXT NOT NULL,
  language TEXT
);
CREATE INDEX IF NOT EXISTS idx_documents_kind ON documents(kind);
CREATE INDEX IF NOT EXISTS idx_documents_hash ON documents(content_hash);
CREATE INDEX IF NOT EXISTS idx_facts_key ON facts(key);
`;

async function openNodeSqlite(dbPath: string): Promise<DbHandle | null> {
  try {
    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(dbPath);
    return {
      kind: 'node-sqlite',
      exec(sql, params = []) {
        db.prepare(sql).run(...(params as never[]));
      },
      query(sql, params = []) {
        return db.prepare(sql).all(...(params as never[])) as Record<string, unknown>[];
      },
      close() {
        db.close();
      },
    };
  } catch {
    return null;
  }
}

async function openSqlJs(dbPath: string): Promise<DbHandle | null> {
  try {
    const initSqlJs = (await import('sql.js')).default;
    const { fileURLToPath } = await import('node:url');
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    let wasmPath: string;
    try {
      wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm');
    } catch {
      wasmPath = path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        '..',
        '..',
        '..',
        '..',
        'node_modules',
        'sql.js',
        'dist',
        'sql-wasm.wasm',
      );
    }
    let buffer: Uint8Array | undefined;
    try {
      buffer = new Uint8Array(await readFile(dbPath));
    } catch {
      buffer = undefined;
    }
    const SQL = await initSqlJs({ locateFile: () => wasmPath });
    const db = buffer ? new SQL.Database(buffer) : new SQL.Database();
    return {
      kind: 'sqljs',
      exec(sql, params = []) {
        db.run(sql, params as never[]);
      },
      query(sql, params = []) {
        const stmt = db.prepare(sql);
        if (params.length) stmt.bind(params as never[]);
        const rows: Record<string, unknown>[] = [];
        while (stmt.step()) rows.push(stmt.getAsObject() as Record<string, unknown>);
        stmt.free();
        return rows;
      },
      close() {
        db.close();
      },
      export() {
        return db.export();
      },
    };
  } catch {
    return null;
  }
}

async function openDb(engineDir: string): Promise<{ db: DbHandle; dbPath: string }> {
  await mkdir(engineDir, { recursive: true });
  const dbPath = path.join(engineDir, DB_FILE);
  const db = (await openNodeSqlite(dbPath)) ?? (await openSqlJs(dbPath));
  if (!db) throw new Error('No SQLite backend available');
  for (const stmt of SCHEMA.split(';').map((s) => s.trim()).filter(Boolean)) {
    try {
      db.exec(stmt);
    } catch {
      // table/index may already exist
    }
  }
  return { db, dbPath };
}

async function saveDb(db: DbHandle, dbPath: string): Promise<void> {
  if (db.export) {
    await writeFile(dbPath, Buffer.from(db.export()));
  }
  db.close();
}

function rowToDocument(row: Record<string, unknown>): MemoryDocument {
  return {
    id: String(row.id),
    kind: row.kind as MemoryDocument['kind'],
    title: String(row.title),
    body: String(row.body),
    path: row.path ? String(row.path) : undefined,
    tags: JSON.parse(String(row.tags)) as string[],
    confidence: Number(row.confidence),
    contentHash: String(row.content_hash),
    builtAt: String(row.built_at),
    weight: Number(row.weight),
    source: row.source as MemoryDocument['source'],
  };
}

/** Upsert only documents whose content_hash changed (incremental M2). */
export async function persistToSqlite(
  engineDir: string,
  data: {
    repository: string;
    documents: MemoryDocument[];
    vectors: Map<string, Float32Array>;
    facts: MemoryFact[];
    contradictions: MemoryContradiction[];
    bm25DocumentCount: number;
    buildDurationMs: number;
  },
): Promise<EngineManifest> {
  const { db, dbPath } = await openDb(engineDir);

  const existingHashes = new Map(
    db.query('SELECT id, content_hash FROM documents').map((r) => [
      String(r.id),
      String(r.content_hash),
    ]),
  );

  let upserted = 0;
  let skipped = 0;

  db.exec('BEGIN');
  try {
    for (const doc of data.documents) {
      if (existingHashes.get(doc.id) === doc.contentHash) {
        skipped++;
        continue;
      }
      db.exec(
        `INSERT OR REPLACE INTO documents (id, kind, title, body, path, tags, confidence, content_hash, built_at, weight, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          doc.id,
          doc.kind,
          doc.title,
          doc.body,
          doc.path ?? null,
          JSON.stringify(doc.tags),
          doc.confidence,
          doc.contentHash,
          doc.builtAt,
          doc.weight,
          doc.source,
        ],
      );
      const vec = data.vectors.get(doc.id);
      if (vec) {
        db.exec(
          `INSERT OR REPLACE INTO vectors (doc_id, dims, vector) VALUES (?, ?, ?)`,
          [doc.id, vec.length, Buffer.from(vec.buffer, vec.byteOffset, vec.byteLength)],
        );
      }
      upserted++;
    }

    db.exec('DELETE FROM facts');
    for (const f of data.facts) {
      db.exec(
        `INSERT OR REPLACE INTO facts (key, subject, predicate, object, confidence, document_id, built_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [f.key, f.subject, f.predicate, f.object, f.confidence, f.documentId, f.builtAt],
      );
    }

    db.exec('DELETE FROM contradictions');
    for (const c of data.contradictions) {
      db.exec(
        `INSERT OR REPLACE INTO contradictions (id, key, subject, predicate, values_json, detected_at, severity, resolved)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [c.id, c.key, c.subject, c.predicate, JSON.stringify(c.values), c.detectedAt, c.severity, c.resolved ? 1 : 0],
      );
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  const manifest: EngineManifest = {
    $schema: MEMORY_ENGINE_SCHEMA,
    codename: MEMORY_ENGINE_CODENAME,
    generation: 3,
    repository: data.repository,
    builtAt: new Date().toISOString(),
    documentCount: data.documents.length,
    episodeCount: 0,
    factCount: data.facts.length,
    contradictionCount: data.contradictions.filter((c) => !c.resolved).length,
    embeddingDims: EMBEDDING_DIMS,
    bm25DocumentCount: data.bm25DocumentCount,
    stats: {
      buildDurationMs: data.buildDurationMs,
      hybridIndexReady: true,
      storeBackend: db.kind,
      incrementalUpserted: upserted,
      incrementalSkipped: skipped,
    },
  };

  await writeFile(path.join(engineDir, MANIFEST), JSON.stringify(manifest, null, 2), 'utf-8');
  await saveDb(db, dbPath);
  return manifest;
}

export async function loadFromSqlite(engineDir: string): Promise<LoadedEngineIndex | null> {
  const dbPath = path.join(engineDir, DB_FILE);
  try {
    await access(dbPath);
  } catch {
    return null;
  }

  const manifestRaw = await readFile(path.join(engineDir, MANIFEST), 'utf-8').catch(() => null);
  if (!manifestRaw) return null;
  const manifest = normalizeEngineManifest(JSON.parse(manifestRaw) as Record<string, unknown>);

  try {
    const { db } = await openDb(engineDir);
    const documents = db.query('SELECT * FROM documents').map(rowToDocument);
    const vectors = new Map<string, Float32Array>();
    for (const row of db.query('SELECT doc_id, dims, vector FROM vectors')) {
      const buf = row.vector as Buffer;
      const arr = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
      vectors.set(String(row.doc_id), arr);
    }
    const facts: MemoryFact[] = db.query('SELECT * FROM facts').map((r) => ({
      key: String(r.key),
      subject: String(r.subject),
      predicate: String(r.predicate),
      object: String(r.object),
      confidence: Number(r.confidence),
      documentId: String(r.document_id),
      builtAt: String(r.built_at),
    }));
    const contradictions: MemoryContradiction[] = db.query('SELECT * FROM contradictions').map((r) => ({
      id: String(r.id),
      key: String(r.key),
      subject: String(r.subject),
      predicate: String(r.predicate),
      values: JSON.parse(String(r.values_json)),
      detectedAt: String(r.detected_at),
      severity: r.severity as MemoryContradiction['severity'],
      resolved: Boolean(r.resolved),
    }));
    db.close();

    const { loadEpisodes } = await import('./episodes.js');
    const episodes = await loadEpisodes(engineDir);
    manifest.episodeCount = episodes.length;

    return { manifest, documents, vectors, episodes, facts, contradictions };
  } catch {
    return null;
  }
}

export async function recordParseCache(
  engineDir: string,
  entries: Array<{ path: string; contentHash: string; language?: string }>,
): Promise<void> {
  try {
    const { db, dbPath } = await openDb(engineDir);
    const now = new Date().toISOString();
    for (const e of entries) {
      db.exec(
        `INSERT OR REPLACE INTO parse_cache (path, content_hash, parsed_at, language) VALUES (?, ?, ?, ?)`,
        [e.path, e.contentHash, now, e.language ?? null],
      );
    }
    await saveDb(db, dbPath);
  } catch {
    // non-fatal
  }
}
