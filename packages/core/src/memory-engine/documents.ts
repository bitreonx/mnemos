import type { MemoryModel } from '../types.js';
import { cheapHash } from '../cache.js';
import type { MemoryDocument, MemoryDocumentKind, MemoryFact } from './types.js';

function doc(
  id: string,
  kind: MemoryDocumentKind,
  title: string,
  body: string,
  builtAt: string,
  opts: { path?: string; tags?: string[]; confidence?: number } = {},
): MemoryDocument {
  const text = `${title}\n${body}`;
  return {
    id,
    kind,
    title,
    body,
    path: opts.path,
    tags: opts.tags ?? [kind],
    confidence: opts.confidence ?? 0.85,
    contentHash: cheapHash(text),
    builtAt,
    weight: 1,
    source: 'build',
  };
}

/** Compile all retrievable documents from a built memory model. */
export function compileMemoryDocuments(memory: MemoryModel): MemoryDocument[] {
  const builtAt = memory.builtAt;
  const docs: MemoryDocument[] = [];

  for (const d of memory.domains) {
    docs.push(doc(d.id, 'domain', d.name, [d.description, d.entryPoints.join(' ')].join(' '), builtAt, {
      tags: ['domain', d.name.toLowerCase()],
      confidence: d.confidence,
    }));
  }

  for (const s of memory.services) {
    docs.push(doc(s.id, 'service', s.name, [s.path, s.domain, s.exports.join(' '), s.dependencies.join(' ')].join(' '), builtAt, {
      path: s.path,
      tags: ['service', s.domain ?? ''],
      confidence: 0.9,
    }));
    docs.push(doc(`file:${s.path}`, 'file', s.path, [s.name, s.exports.join(' ')].join(' '), builtAt, {
      path: s.path,
      tags: ['file'],
      confidence: 0.88,
    }));
  }

  for (const f of memory.flows) {
    docs.push(doc(f.id, 'flow', f.name, [f.description, f.type, f.steps.map((s) => s.name).join(' ')].join(' '), builtAt, {
      path: f.entryPoint,
      tags: ['flow', f.type],
      confidence: f.confidence,
    }));
  }

  for (const c of memory.capabilities ?? []) {
    docs.push(doc(c.signature.id, 'capability', c.signature.name, [c.signature.purpose, c.reasons.join(' ')].join(' '), builtAt, {
      tags: ['capability', c.signature.category],
      confidence: 0.8,
    }));
  }

  for (const j of memory.journeys ?? []) {
    docs.push(doc(j.signature.id, 'journey', j.signature.name, [j.signature.purpose, j.reason, j.actors.join(' ')].join(' '), builtAt, {
      path: j.entryRoute ?? j.entryPoint,
      tags: ['journey'],
      confidence: 0.78,
    }));
  }

  for (const a of memory.apis) {
    docs.push(doc(a.id, 'api', `${a.method} ${a.path}`, [a.file, a.handler, a.domain ?? ''].join(' '), builtAt, {
      path: a.file,
      tags: ['api', a.method.toLowerCase()],
      confidence: 0.92,
    }));
  }

  for (const c of memory.criticalPaths) {
    docs.push(doc(c.id, 'critical_path', c.name, [c.description, c.nodes.join(' ')].join(' '), builtAt, {
      tags: ['critical_path', c.risk],
      confidence: 0.85,
    }));
  }

  for (const s of memory.smells) {
    docs.push(doc(s.id, 'smell', s.type, [s.description, s.recommendation].join(' '), builtAt, {
      tags: ['smell', s.severity],
      confidence: s.severity === 'high' ? 0.95 : 0.75,
    }));
  }

  return docs;
}

/** Extract structured facts for contradiction detection. */
export function extractFacts(documents: MemoryDocument[]): MemoryFact[] {
  const facts: MemoryFact[] = [];

  for (const d of documents) {
    if (d.kind === 'domain') {
      facts.push({
        key: `domain:${d.title}:description`,
        subject: d.title,
        predicate: 'description',
        object: d.body.slice(0, 500),
        confidence: d.confidence,
        documentId: d.id,
        builtAt: d.builtAt,
      });
    }
    if (d.kind === 'api') {
      const [method, ...pathParts] = d.title.split(' ');
      facts.push({
        key: `api:${pathParts.join(' ')}:method`,
        subject: pathParts.join(' '),
        predicate: 'method',
        object: method ?? 'GET',
        confidence: d.confidence,
        documentId: d.id,
        builtAt: d.builtAt,
      });
    }
    if (d.kind === 'service') {
      facts.push({
        key: `service:${d.title}:path`,
        subject: d.title,
        predicate: 'path',
        object: d.path ?? '',
        confidence: d.confidence,
        documentId: d.id,
        builtAt: d.builtAt,
      });
    }
  }

  return facts;
}
