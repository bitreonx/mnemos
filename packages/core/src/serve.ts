import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { MemoryModel } from './types.js';
import { loadMemoryModel } from './pipeline/build.js';
import { buildGraph } from './graph/builder.js';
import { scanRepository } from './scanner/index.js';
import { parseFiles } from './parser/index.js';
import { analyzeImpact, formatImpactReport } from './analysis/impact.js';
import { explainRepository, formatExplainReport } from './explain.js';
import { buildOnboardGuide } from './onboard.js';
import { reviewDiff } from './review.js';
import { askCopilot } from './copilot.js';
import { computeDomainHeatmap } from './analysis/heatmap.js';
import { computeMemoryScore } from './report.js';
import { buildSearchIndex, searchMemory } from './search/index.js';

export interface ServeOptions {
  root: string;
  port?: number;
  host?: string;
}

export interface ServeHandle {
  port: number;
  close: () => Promise<void>;
}

export async function startMemoryServer(options: ServeOptions): Promise<ServeHandle> {
  const root = path.resolve(options.root);
  const port = options.port ?? 4000;
  const host = options.host ?? '127.0.0.1';

  let cached: { memory: MemoryModel; outputDir: string } | null = null;

  async function getMemory(): Promise<{ memory: MemoryModel; outputDir: string } | null> {
    if (cached) return cached;
    cached = await loadMemoryModel(root);
    return cached;
  }

  const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url ?? '/', `http://${host}:${port}`);
    const pathname = url.pathname;

    try {
      if (pathname === '/health') {
        return json(res, { status: 'ok', service: 'mnemos-memory-server', version: '0.1.0' });
      }

      const loaded = await getMemory();
      if (!loaded && pathname !== '/health') {
        return json(res, { error: 'No memory model. Run mnemos build first.' }, 404);
      }

      const { memory, outputDir } = loaded!;

      if (pathname === '/dna' || pathname === '/project.dna.json' || pathname === '/repository.dna.json') {
        try {
          const raw = await readFile(path.join(outputDir, 'project.dna.json'), 'utf-8');
          res.setHeader('Content-Type', 'application/json');
          res.end(raw);
          return;
        } catch {
          const raw = await readFile(path.join(outputDir, 'repository.dna.json'), 'utf-8');
          res.setHeader('Content-Type', 'application/json');
          res.end(raw);
          return;
        }
      }

      if (pathname === '/memory') {
        return json(res, memory);
      }

      if (pathname === '/explain') {
        const result = explainRepository(memory);
        return json(res, result);
      }

      if (pathname === '/heatmap') {
        return json(res, computeDomainHeatmap(memory));
      }

      if (pathname === '/score') {
        return json(res, computeMemoryScore(memory));
      }

      if (pathname === '/onboard') {
        return json(res, buildOnboardGuide(memory));
      }

      if (pathname === '/copilot') {
        const q = url.searchParams.get('q') ?? '';
        if (!q) return json(res, { error: 'Missing query param: q' }, 400);
        return json(res, askCopilot(memory, q));
      }

      if (pathname === '/search') {
        const q = url.searchParams.get('q') ?? '';
        if (!q.trim()) return json(res, { error: 'Missing query param: q' }, 400);

        const index = buildSearchIndex(memory);
        const result = searchMemory(index, q, {
          limit: Number(url.searchParams.get('limit') ?? 25),
        });

        const legacyDomains = memory.domains.filter(
          (d) => d.name.toLowerCase().includes(q.toLowerCase()) || d.description.toLowerCase().includes(q.toLowerCase()),
        );
        const legacyServices = memory.services.filter(
          (s) => s.name.toLowerCase().includes(q.toLowerCase()) || s.path.toLowerCase().includes(q.toLowerCase()),
        );
        const legacyFlows = memory.flows.filter(
          (f) => f.name.toLowerCase().includes(q.toLowerCase()) || f.description.toLowerCase().includes(q.toLowerCase()),
        );

        return json(res, {
          query: q,
          hits: result.hits,
          tookMs: result.tookMs,
          domains: legacyDomains,
          services: legacyServices.slice(0, 20),
          flows: legacyFlows.slice(0, 20),
        });
      }

      const impactMatch = pathname.match(/^\/impact\/(.+)$/);
      if (impactMatch) {
        const node = decodeURIComponent(impactMatch[1]!);
        const scan = await scanRepository(root);
        const parsed = await parseFiles(scan.files, root);
        const graph = buildGraph(root, scan, parsed);
        const result = analyzeImpact(graph, node);
        if (!result) return json(res, { error: `No node matching "${node}"` }, 404);
        return json(res, { ...result, formatted: formatImpactReport(result, graph) });
      }

      if (pathname === '/review' && req.method === 'POST') {
        const body = await readBody(req);
        const diff = body.diff ?? body.content ?? '';
        return json(res, reviewDiff(memory, diff));
      }

      if (pathname === '/context') {
        const contextDir = path.join(outputDir, 'context');
        return json(res, {
          path: contextDir,
          files: [
            'repository_summary.md',
            'architecture.md',
            'domains.md',
            'flows.md',
            'critical_paths.md',
          ],
        });
      }

      return json(res, {
        endpoints: [
          'GET /health',
          'GET /dna',
          'GET /memory',
          'GET /explain',
          'GET /score',
          'GET /heatmap',
          'GET /onboard',
          'GET /copilot?q=...',
          'GET /search?q=...',
          'GET /impact/:node',
          'POST /review { diff }',
          'GET /context',
        ],
      });
    } catch (err) {
      return json(res, { error: String(err) }, 500);
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
