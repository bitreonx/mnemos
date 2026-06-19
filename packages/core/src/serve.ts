import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  MnemosRuntime,
  MNEMOS_VERSION,
  errorToMcpContent,
  type AgentEnvelope,
} from './agent-runtime.js';
import { buildMcpSetupMarkdown } from './mcp-config.js';
import { buildAiPack, AI_PACK_VERSION, AI_PACK_SCHEMA, type AiPackSection, type Mode } from './ai-pack.js';
import {
  loadMemoryShardSet,
  findDomainShard,
  findFlowShard,
  findShard,
  analyzeShardImpact,
  getMemoryStats,
  allocateTokenBudget,
  type MemoryShardSet,
} from './memory-shards/index.js';

export interface ServeOptions {
  root: string;
  port?: number;
  host?: string;
  /** Allow CORS from these origins. Default: same-origin only (no header). */
  corsOrigins?: string[];
}

export interface ServeHandle {
  port: number;
  close: () => Promise<void>;
}

export async function startMemoryServer(options: ServeOptions): Promise<ServeHandle> {
  const root = path.resolve(options.root);
  const port = options.port ?? 4000;
  const host = options.host ?? '127.0.0.1';
  const runtime = new MnemosRuntime(root);
  const outputDir = path.join(root, '.mnemos');
  let cachedShards: { set: MemoryShardSet | null; loadedAt: number } | null = null;
  const loadShardsCached = async (): Promise<MemoryShardSet | null> => {
    const now = Date.now();
    if (cachedShards && now - cachedShards.loadedAt < 5000) return cachedShards.set;
    const set = await loadMemoryShardSet(outputDir);
    cachedShards = { set, loadedAt: now };
    return set;
  };

  const corsOrigins = options.corsOrigins ?? [];
  const server = http.createServer(async (req, res) => {
    const origin = req.headers.origin;
    if (origin && corsOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    } else if (corsOrigins.includes('*')) {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('X-Mnemos-Version', MNEMOS_VERSION);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url ?? '/', `http://${host}:${port}`);
    const pathname = url.pathname;

    try {
      if (pathname === '/health' || pathname === '/status') {
        const status = await runtime.getStatus();
        return json(res, {
          status: status.ready ? 'ok' : 'not_built',
          service: 'mnemos-memory-server',
          version: MNEMOS_VERSION,
          ...status,
        }, status.ready ? 200 : 503);
      }

      if (pathname === '/mcp-setup') {
        return text(res, buildMcpSetupMarkdown(root), 'text/markdown');
      }

      if (pathname === '/resources') {
        return json(res, { resources: runtime.listResources() });
      }

      const resourceMatch = pathname.match(/^\/resource\/(.+)$/);
      if (resourceMatch) {
        const uri = decodeURIComponent(resourceMatch[1]!);
        const resource = await runtime.readResource(uri.startsWith('mnemos://') ? uri : `mnemos://repository/${uri}`);
        res.setHeader('Content-Type', resource.mimeType);
        res.end(resource.text);
        return;
      }

      // -------- Shared Memory (shard-based) endpoints --------
      if (pathname === '/shards' || pathname === '/memory') {
        const set = await loadShardsCached();
        if (!set) return json(res, { error: 'Shared memory shards not built yet. Run `mnemos memory build`.' }, 404);
        return json(res, {
          $schema: set.$schema,
          repository: set.repository,
          builtAt: set.builtAt,
          totalShards: set.shards.length,
          totalBytes: set.totalBytes,
          totalEstimatedTokens: set.totalEstimatedTokens,
          shards: set.shards.map((s) => ({
            kind: s.kind,
            name: s.name,
            filename: s.filename,
            estimatedTokens: s.estimatedTokens,
            bytes: s.bytes,
          })),
        });
      }

      if (pathname === '/memory/stats' || pathname === '/stats') {
        const set = await loadShardsCached();
        if (!set) return json(res, { error: 'Shared memory shards not built yet.' }, 404);
        return json(res, getMemoryStats(set));
      }

      if (pathname === '/memory/budget') {
        const set = await loadShardsCached();
        if (!set) return json(res, { error: 'Shared memory shards not built yet.' }, 404);
        const budget = Number(url.searchParams.get('budget') ?? 10000);
        if (!Number.isFinite(budget) || budget <= 0) return json(res, { error: 'Missing or invalid budget query param.' }, 400);
        return json(res, allocateTokenBudget(set, budget));
      }

      const shardFileMatch = pathname.match(/^\/shards\/file\/(.+)$/);
      if (shardFileMatch) {
        const set = await loadShardsCached();
        if (!set) return json(res, { error: 'Shared memory shards not built yet.' }, 404);
        const filename = decodeURIComponent(shardFileMatch[1]!);
        const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '');
        if (safe !== filename || safe.includes('..')) {
          return json(res, { error: 'Invalid shard filename.' }, 400);
        }
        try {
          const raw = await readFile(path.join(outputDir, safe), 'utf-8');
          res.setHeader('Content-Type', 'application/json');
          res.end(raw);
          return;
        } catch {
          return json(res, { error: `Shard not found: ${safe}` }, 404);
        }
      }

      const domainShardMatch = pathname.match(/^\/domain\/(.+)$/);
      if (domainShardMatch) {
        const set = await loadShardsCached();
        if (!set) return json(res, { error: 'Shared memory shards not built yet. Run `mnemos memory build`.' }, 404);
        const name = decodeURIComponent(domainShardMatch[1]!);
        const shard = findDomainShard(set, name);
        if (!shard) return json(res, { error: `No domain shard matching "${name}".` }, 404);
        return json(res, shard);
      }

      const flowShardMatch = pathname.match(/^\/flow\/(.+)$/);
      if (flowShardMatch) {
        const set = await loadShardsCached();
        if (!set) return json(res, { error: 'Shared memory shards not built yet. Run `mnemos memory build`.' }, 404);
        const name = decodeURIComponent(flowShardMatch[1]!);
        const shard = findFlowShard(set, name);
        if (!shard) return json(res, { error: `No flow shard matching "${name}".` }, 404);
        return json(res, shard);
      }

      const shardByKindMatch = pathname.match(/^\/shard\/(domain|flow|api|service|capability|journey|critical-path)\/(.+)$/);
      if (shardByKindMatch) {
        const set = await loadShardsCached();
        if (!set) return json(res, { error: 'Shared memory shards not built yet.' }, 404);
        const kind = shardByKindMatch[1] as 'domain' | 'flow' | 'api' | 'service' | 'capability' | 'journey' | 'critical-path';
        const name = decodeURIComponent(shardByKindMatch[2]!);
        const shard = findShard(set, kind, name);
        if (!shard) return json(res, { error: `No ${kind} shard matching "${name}".` }, 404);
        return json(res, shard);
      }

      let envelope: AgentEnvelope;

      if (pathname === '/dna' || pathname === '/project.dna.json' || pathname === '/repository.dna.json') {
        try {
          const artifacts = await runtime.load();
          const raw = await readFile(path.join(artifacts.outputDir, 'project.dna.json'), 'utf-8');
          res.setHeader('Content-Type', 'application/json');
          res.end(raw);
          return;
        } catch {
          envelope = await runtime.getDna();
          return json(res, envelope.data);
        }
      }

      const packMatch = pathname.match(/^\/copilot\/pack\/(.+)$/);
      if (packMatch) {
        const repoId = decodeURIComponent(packMatch[1]!);
        const sectionRaw = (url.searchParams.get('section') ?? 'all').toLowerCase() as AiPackSection;
        const modeRaw = (url.searchParams.get('mode') ?? 'coder').toLowerCase() as Mode;
        const section: AiPackSection = (['all', 'summary', 'score', 'issues', 'graph', 'flows', 'smells', 'dna'] as AiPackSection[]).includes(sectionRaw)
          ? sectionRaw
          : 'all';
        const mode: Mode = (['vibe', 'ai', 'coder'] as Mode[]).includes(modeRaw) ? modeRaw : 'coder';
        const artifacts = await runtime.load();
        const dnaRaw = await readFile(path.join(artifacts.outputDir, 'project.dna.json'), 'utf-8').catch(() => null);
        const dna = dnaRaw ? (JSON.parse(dnaRaw) as Record<string, unknown>) : null;
        const pack = buildAiPack(artifacts.memory, {
          mode,
          section,
          repoId,
          root: artifacts.root,
          dna,
          graph: artifacts.graph
            ? {
                nodes: artifacts.graph
                  .mapNodes((id, attrs) => ({ id, kind: attrs.kind, name: attrs.name, path: attrs.path }))
                  .map((n) => ({ id: String(n.id), kind: String(n.kind), name: String(n.name), path: n.path as string | undefined })),
                edges: artifacts.graph
                  .mapEdges((id, attrs, source, target) => ({ id, source, target, kind: attrs.kind }))
                  .map((e) => ({
                    id: String(e.id),
                    source: String(e.source),
                    target: String(e.target),
                    kind: String(e.kind),
                  })),
              }
            : null,
        });
        res.setHeader('X-Mnemos-AiPack-Version', AI_PACK_VERSION);
        res.setHeader('X-Mnemos-AiPack-Schema', AI_PACK_SCHEMA);
        return json(res, pack);
      }

      if (pathname === '/copilot' || pathname === '/query') {
        const q = url.searchParams.get('q') ?? '';
        if (!q.trim()) return json(res, { error: 'Missing query param: q' }, 400);
        envelope = await runtime.queryGraph(q);
        return json(res, envelope);
      }

      if (pathname === '/focus' || pathname === '/compile_focus') {
        const task = url.searchParams.get('task') ?? url.searchParams.get('q') ?? '';
        if (!task.trim()) return json(res, { error: 'Missing query param: task or q' }, 400);
        const budget = Number(url.searchParams.get('tokenBudget') ?? url.searchParams.get('budget') ?? 8000);
        envelope = await runtime.compileFocus(task, budget);
        return json(res, envelope);
      }

      if (pathname === '/search') {
        const q = url.searchParams.get('q') ?? '';
        if (!q.trim()) return json(res, { error: 'Missing query param: q' }, 400);
        envelope = await runtime.search(q, Number(url.searchParams.get('limit') ?? 25));
        return json(res, envelope);
      }

      // -------- Memory Engine (local hybrid retrieval) --------
      if (pathname === '/engine/status' || pathname === '/memory/engine') {
        envelope = await runtime.getMemoryEngineStatus();
        return json(res, envelope);
      }

      if (pathname === '/engine/trust' || pathname === '/trust') {
        envelope = await runtime.getTrustManifest();
        return json(res, envelope);
      }

      if (pathname === '/engine/query' || pathname === '/memory/query') {
        const q = url.searchParams.get('q') ?? url.searchParams.get('question') ?? '';
        if (!q.trim()) return json(res, { error: 'Missing query param: q' }, 400);
        envelope = await runtime.memoryQuery(q, Number(url.searchParams.get('limit') ?? 12));
        return json(res, envelope);
      }

      if (pathname === '/engine/context' || pathname === '/memory/context') {
        const task = url.searchParams.get('task') ?? url.searchParams.get('q') ?? '';
        if (!task.trim()) return json(res, { error: 'Missing query param: task' }, 400);
        envelope = await runtime.compileFocus(task, Number(url.searchParams.get('budget') ?? 8000));
        return json(res, envelope);
      }

      if (pathname === '/engine/remember' && req.method === 'POST') {
        let body = '';
        for await (const chunk of req) body += chunk;
        let parsed: { content?: string; tags?: string[] };
        try {
          parsed = JSON.parse(body || '{}') as { content?: string; tags?: string[] };
        } catch {
          return json(res, { error: 'Invalid JSON body' }, 400);
        }
        if (!parsed.content?.trim()) return json(res, { error: 'Missing content field' }, 400);
        envelope = await runtime.memoryRemember(parsed.content, parsed.tags ?? []);
        return json(res, envelope);
      }

      if (pathname === '/explain') {
        envelope = await runtime.getDna();
        const artifacts = await runtime.load();
        return json(res, {
          ...(typeof envelope.data === 'object' && envelope.data ? envelope.data : {}),
          formatted: envelope.markdown,
          repository: artifacts.memory.repository,
        });
      }

      if (pathname === '/score' || pathname === '/health') {
        envelope = await runtime.getHealth();
        return json(res, envelope);
      }

      if (pathname === '/domains') {
        envelope = await runtime.listDomains();
        return json(res, envelope);
      }

      if (pathname === '/flows') {
        envelope = await runtime.listFlows();
        return json(res, envelope);
      }

      if (pathname === '/capabilities') {
        envelope = await runtime.listCapabilities();
        return json(res, envelope);
      }

      if (pathname === '/focus') {
        const task = url.searchParams.get('task') ?? url.searchParams.get('q') ?? '';
        if (!task.trim()) return json(res, { error: 'Missing query param: task or q' }, 400);
        const budget = Number(url.searchParams.get('budget') ?? 8000);
        envelope = await runtime.compileFocus(task, budget);
        return json(res, envelope);
      }

      if (pathname === '/diff') {
        envelope = await runtime.getDnaDiff();
        return json(res, envelope);
      }

      if (pathname === '/hotspots') {
        envelope = await runtime.getGitHotspots(Number(url.searchParams.get('limit') ?? 20));
        return json(res, envelope);
      }

      if (pathname === '/history') {
        envelope = await runtime.getBuildHistory();
        return json(res, envelope);
      }

      const pathMatch = pathname.match(/^\/path\/([^/]+)\/([^/]+)$/);
      if (pathMatch) {
        envelope = await runtime.shortestPath(
          decodeURIComponent(pathMatch[1]!),
          decodeURIComponent(pathMatch[2]!),
        );
        return json(res, envelope);
      }

      const nodeMatch = pathname.match(/^\/node\/(.+)$/);
      if (nodeMatch) {
        envelope = await runtime.getNode(decodeURIComponent(nodeMatch[1]!));
        return json(res, envelope);
      }

      const neighborsMatch = pathname.match(/^\/neighbors\/(.+)$/);
      if (neighborsMatch) {
        envelope = await runtime.getNeighbors(decodeURIComponent(neighborsMatch[1]!));
        return json(res, envelope);
      }

      const impactMatch = pathname.match(/^\/impact\/(.+)$/);
      if (impactMatch) {
        const target = decodeURIComponent(impactMatch[1]!);
        const fast = url.searchParams.get('fast');
        if (fast === '1' || fast === 'true') {
          const set = await loadShardsCached();
          if (!set) return json(res, { error: 'Shared memory shards not built yet.' }, 404);
          return json(res, analyzeShardImpact(set, target));
        }
        envelope = await runtime.impactAnalysis(target);
        return json(res, envelope);
      }

      if (pathname === '/review' && req.method === 'POST') {
        const body = await readBody(req);
        const diff = body.diff ?? body.content ?? '';
        envelope = await runtime.reviewDiffContent(diff);
        return json(res, envelope);
      }

      if (pathname === '/refresh' && req.method === 'POST') {
        runtime.invalidate();
        envelope = await runtime.getDna();
        return json(res, { refreshed: true, dna: envelope.data });
      }

      return json(res, {
        service: 'mnemos-memory-server',
        version: MNEMOS_VERSION,
        localFirst: true,
        requiresApiKeys: false,
        aiPack: {
          version: AI_PACK_VERSION,
          schema: AI_PACK_SCHEMA,
          example: `GET /copilot/pack/:repoId?section=score|issues|graph|flows|smells|dna|all&mode=vibe|ai|coder`,
        },
        sharedMemory: {
          description: 'Pre-sharded, agent-ready memory. Each shard is one JSON file agents can load directly.',
          example: `GET /domain/auth  · GET /flow/login  · GET /impact/UserService?fast=1`,
          schema: 'mnemos/shared-memory/v1',
        },
        endpoints: [
          'GET /health · /status',
          'GET /dna · /project.dna.json · /repository.dna.json',
          'GET /query?q= · /copilot?q=',
          'GET /focus?task= · /compile_focus?task=',
          'GET /search?q=&limit=',
          'GET /copilot/pack/:repoId?section=&mode=  (AI Pack v1)',
          'GET /node/:name · /neighbors/:name · /impact/:node',
          'GET /path/:from/:to',
          'GET /domains · /flows · /capabilities · /health',
          'GET /focus?task= · /diff · /hotspots · /history',
          'GET /resources · /resource/:uri',
          'GET /mcp-setup',
          'GET /shards · /memory                 — shared memory manifest',
          'GET /memory/stats · /stats             — compression + savings',
          'GET /memory/budget?budget=10000        — token budget allocation',
          'GET /shards/file/:filename             — raw shard JSON',
          'GET /domain/:name                      — domain shard (auth, payments, …)',
          'GET /flow/:name                        — flow shard',
          'GET /shard/:kind/:name                 — typed shard lookup',
          'GET /impact/:node?fast=1               — shard-based impact (no graph)',
          'POST /review { diff } · POST /refresh',
        ],
        mcp: 'Run `mnemos mcp` for stdio MCP (Cursor, Claude Desktop, VS Code)',
      });
    } catch (err) {
      const { content } = errorToMcpContent(err);
      const message = content[0]?.text ?? String(err);
      const status = message.includes('NOT_BUILT') ? 404 : 500;
      return json(res, { error: message, version: MNEMOS_VERSION }, status);
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(port, host, () => resolve());
    server.on('error', reject);
  });

  return {
    port,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

function json(res: http.ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data, null, 2));
}

function text(res: http.ServerResponse, body: string, mimeType: string): void {
  res.writeHead(200, { 'Content-Type': mimeType });
  res.end(body);
}

function readBody(req: http.IncomingMessage): Promise<{ diff?: string; content?: string }> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8')));
      } catch {
        resolve({ diff: Buffer.concat(chunks).toString('utf-8') });
      }
    });
    req.on('error', reject);
  });
}
