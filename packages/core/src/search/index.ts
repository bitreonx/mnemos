import type { MemoryModel } from '../types.js';

export type SearchEntityKind =
  | 'domain'
  | 'service'
  | 'flow'
  | 'capability'
  | 'journey'
  | 'api'
  | 'critical_path'
  | 'smell';

export interface SearchDocument {
  id: string;
  kind: SearchEntityKind;
  title: string;
  body: string;
  path?: string;
  tags: string[];
}

export interface SearchHit {
  id: string;
  kind: SearchEntityKind;
  title: string;
  snippet: string;
  score: number;
  path?: string;
  tags: string[];
}

export interface SearchResult {
  query: string;
  hits: SearchHit[];
  tookMs: number;
}

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
  'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by',
  'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above',
  'below', 'between', 'out', 'off', 'over', 'under', 'again', 'further',
  'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all',
  'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
  'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just',
  'and', 'but', 'if', 'or', 'because', 'until', 'while', 'about', 'what',
  'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'it',
  'its', 'my', 'me', 'i', 'you', 'your', 'we', 'our', 'they', 'their',
  'show', 'list', 'get', 'find', 'tell', 'explain', 'describe',
]);

const BM25_K1 = 1.2;
const BM25_B = 0.75;

export interface MemorySearchIndex {
  documents: SearchDocument[];
  avgDocLength: number;
  docFreq: Map<string, number>;
  termFreq: Map<string, Map<string, number>>;
  docLength: Map<string, number>;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s:/.-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

export function buildSearchIndex(memory: MemoryModel): MemorySearchIndex {
  const documents: SearchDocument[] = [];

  for (const d of memory.domains) {
    documents.push({
      id: d.id,
      kind: 'domain',
      title: d.name,
      body: [d.description, d.entryPoints.join(' '), d.nodes.slice(0, 20).join(' ')].join(' '),
      tags: ['domain', d.name.toLowerCase()],
    });
  }

  for (const s of memory.services) {
    documents.push({
      id: s.id,
      kind: 'service',
      title: s.name,
      body: [s.path, s.domain, s.exports.join(' '), s.dependencies.join(' '), s.dependents.join(' ')].join(' '),
      path: s.path,
      tags: ['service', s.domain ?? ''],
    });
  }

  for (const f of memory.flows) {
    documents.push({
      id: f.id,
      kind: 'flow',
      title: f.name,
      body: [f.description, f.type, f.entryPoint, f.steps.map((s) => s.name).join(' ')].join(' '),
      path: f.entryPoint,
      tags: ['flow', f.type],
    });
  }

  for (const c of memory.capabilities ?? []) {
    documents.push({
      id: c.signature.id,
      kind: 'capability',
      title: c.signature.name,
      body: [c.signature.purpose, c.signature.category, c.reasons.join(' '), c.services.join(' '), c.apis.join(' ')].join(' '),
      tags: ['capability', c.signature.category],
    });
  }

  for (const j of memory.journeys ?? []) {
    documents.push({
      id: j.signature.id,
      kind: 'journey',
      title: j.signature.name,
      body: [j.signature.purpose, j.reason, j.actors.join(' '), j.outcomes.join(' '), j.systems.join(' '), j.entryRoute ?? j.entryPoint].join(' '),
      path: j.entryRoute ?? j.entryPoint,
      tags: ['journey', ...j.actors.map((a) => a.toLowerCase())],
    });
  }

  for (const a of memory.apis) {
    documents.push({
      id: a.id,
      kind: 'api',
      title: `${a.method} ${a.path}`,
      body: [a.file, a.domain ?? '', a.handler ?? ''].join(' '),
      path: a.file,
      tags: ['api', a.method.toLowerCase(), a.domain ?? ''],
    });
  }

  for (const c of memory.criticalPaths) {
    documents.push({
      id: c.id,
      kind: 'critical_path',
      title: c.name,
      body: [c.description, c.risk, c.nodes.join(' ')].join(' '),
      tags: ['critical', c.risk],
    });
  }

  for (const s of memory.smells) {
    documents.push({
      id: s.id,
      kind: 'smell',
      title: s.type.replace(/_/g, ' '),
      body: [s.description, s.recommendation, s.severity, ...(s.nodes ?? [])].join(' '),
      tags: ['smell', s.severity, s.type],
    });
  }

  documents.push({
    id: 'repo:summary',
    kind: 'domain',
    title: memory.repository,
    body: [
      memory.architecture.summary,
      memory.architecture.type,
      memory.architecture.layers.join(' '),
      memory.architecture.packages.join(' '),
    ].join(' '),
    tags: ['repository', 'architecture'],
  });

  const termFreq = new Map<string, Map<string, number>>();
  const docLength = new Map<string, number>();
  const docFreq = new Map<string, number>();
  let totalLength = 0;

  for (const doc of documents) {
    const text = `${doc.title} ${doc.body} ${doc.tags.join(' ')}`;
    const terms = tokenize(text);
    docLength.set(doc.id, terms.length);
    totalLength += terms.length;

    const tf = new Map<string, number>();
    for (const term of terms) {
      tf.set(term, (tf.get(term) ?? 0) + 1);
    }
    termFreq.set(doc.id, tf);

    for (const term of new Set(terms)) {
      docFreq.set(term, (docFreq.get(term) ?? 0) + 1);
    }
  }

  return {
    documents,
    avgDocLength: documents.length > 0 ? totalLength / documents.length : 0,
    docFreq,
    termFreq,
    docLength,
  };
}

function bm25Score(
  index: MemorySearchIndex,
  docId: string,
  queryTerms: string[],
  nDocs: number,
): number {
  const docLen = index.docLength.get(docId) ?? 0;
  const tfMap = index.termFreq.get(docId);
  if (!tfMap) return 0;

  let score = 0;
  for (const term of queryTerms) {
    const tf = tfMap.get(term) ?? 0;
    if (tf === 0) continue;

    const df = index.docFreq.get(term) ?? 0;
    const idf = Math.log(1 + (nDocs - df + 0.5) / (df + 0.5));
    const numerator = tf * (BM25_K1 + 1);
    const denominator = tf + BM25_K1 * (1 - BM25_B + BM25_B * (docLen / (index.avgDocLength || 1)));
    score += idf * (numerator / denominator);
  }
  return score;
}

function buildSnippet(body: string, queryTerms: string[], maxLen = 120): string {
  const lower = body.toLowerCase();
  for (const term of queryTerms) {
    const idx = lower.indexOf(term);
    if (idx >= 0) {
      const start = Math.max(0, idx - 40);
      const end = Math.min(body.length, idx + term.length + 60);
      const slice = body.slice(start, end).trim();
      return (start > 0 ? '…' : '') + slice + (end < body.length ? '…' : '');
    }
  }
  return body.slice(0, maxLen) + (body.length > maxLen ? '…' : '');
}

export function searchMemory(
  index: MemorySearchIndex,
  query: string,
  options: { limit?: number; kinds?: SearchEntityKind[] } = {},
): SearchResult {
  const start = Date.now();
  const limit = options.limit ?? 20;
  const queryTerms = tokenize(query);

  if (queryTerms.length === 0) {
    return { query, hits: [], tookMs: Date.now() - start };
  }

  const nDocs = index.documents.length;
  const hits: SearchHit[] = [];

  for (const doc of index.documents) {
    if (options.kinds && !options.kinds.includes(doc.kind)) continue;

    let score = bm25Score(index, doc.id, queryTerms, nDocs);

    const titleLower = doc.title.toLowerCase();
    for (const term of queryTerms) {
      if (titleLower.includes(term)) score += 2.5;
      if (doc.tags.some((t) => t.includes(term))) score += 1.0;
      if (doc.path?.toLowerCase().includes(term)) score += 1.5;
    }

    if (score > 0) {
      hits.push({
        id: doc.id,
        kind: doc.kind,
        title: doc.title,
        snippet: buildSnippet(doc.body, queryTerms),
        score,
        path: doc.path,
        tags: doc.tags,
      });
    }
  }

  hits.sort((a, b) => b.score - a.score);

  return {
    query,
    hits: hits.slice(0, limit),
    tookMs: Date.now() - start,
  };
}

export type CopilotIntent =
  | 'overview'
  | 'flow'
  | 'dependency'
  | 'health'
  | 'auth'
  | 'payment'
  | 'impact'
  | 'list'
  | 'search'
  | 'critical'
  | 'smell'
  | 'unknown';

export interface IntentClassification {
  intent: CopilotIntent;
  confidence: number;
  target?: string;
}

const INTENT_PATTERNS: Array<{ intent: CopilotIntent; patterns: RegExp[]; weight: number }> = [
  { intent: 'overview', patterns: [/what is this/, /what does this/, /overview/, /summary/, /about this repo/], weight: 0.95 },
  { intent: 'flow', patterns: [/how does .* work/, /how .* work/, /explain .* flow/, /show .* flow/, /^how\s+(does|do)\s+/], weight: 0.9 },
  { intent: 'health', patterns: [/health/, /score/, /risk/, /debt/, /quality/], weight: 0.92 },
  { intent: 'auth', patterns: [/login/, /auth/, /sign.?in/, /authentication/, /identity/], weight: 0.88 },
  { intent: 'payment', patterns: [/payment/, /billing/, /checkout/, /invoice/, /subscription/], weight: 0.88 },
  { intent: 'impact', patterns: [/what breaks/, /impact/, /blast/, /depends on/, /dependents/, /affect/], weight: 0.85 },
  { intent: 'critical', patterns: [/critical/, /why is .* important/, /most critical/, /central hub/], weight: 0.85 },
  { intent: 'smell', patterns: [/smell/, /problem/, /issues/, /anti.?pattern/, /violation/], weight: 0.85 },
  { intent: 'list', patterns: [/^list/, /^show all/, /what are the/, /enumerate/], weight: 0.8 },
  { intent: 'dependency', patterns: [/what depends/, /dependencies of/, /who uses/], weight: 0.82 },
];

export function classifyIntent(query: string): IntentClassification {
  const q = query.toLowerCase().trim();
  let best: IntentClassification = { intent: 'search', confidence: 0.3 };

  for (const { intent, patterns, weight } of INTENT_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(q)) {
        const target = extractIntentTarget(q, intent);
        if (weight > best.confidence) {
          best = { intent, confidence: weight, target };
        }
      }
    }
  }

  return best;
}

function extractIntentTarget(q: string, intent: CopilotIntent): string | undefined {
  const cleaners: Record<CopilotIntent, RegExp[]> = {
    overview: [],
    flow: [/how does\s+/i, /how do\s+/i, /how\s+/i, /\s+work$/i, /explain\s+/i, /show\s+/i, /flow$/i],
    dependency: [/what depends on\s+/i, /dependencies of\s+/i, /who uses\s+/i],
    health: [],
    auth: [],
    payment: [],
    impact: [/what breaks if i change\s+/i, /impact of\s+/i, /what happens if i change\s+/i],
    list: [/^list\s+(all\s+)?/i, /^show\s+(all\s+)?/i, /^what are (the\s+)?/i],
    search: [/^find\s+/i, /^where is\s+/i, /^locate\s+/i, /^search\s+/i],
    critical: [/why is\s+/i, /why are\s+/i, /most critical\s+/i],
    smell: [],
    unknown: [],
  };

  let rest = q;
  for (const re of cleaners[intent] ?? []) {
    rest = rest.replace(re, '');
  }
  rest = rest.replace(/^the\s+/i, '').replace(/[?.!]+$/, '').trim();
  return rest.length > 1 ? rest : undefined;
}

export function findBestMatch<T>(
  items: T[],
  query: string,
  scorers: Array<(item: T, terms: string[]) => number>,
): T | undefined {
  const terms = tokenize(query);
  if (terms.length === 0) return items[0];

  let best: T | undefined;
  let bestScore = -1;

  for (const item of items) {
    let score = 0;
    for (const scorer of scorers) {
      score += scorer(item, terms);
    }
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }

  return bestScore > 0 ? best : undefined;
}
