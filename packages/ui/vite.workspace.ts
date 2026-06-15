import type { Plugin } from 'vite';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

interface BuildHistoryEntry {
  builtAt: string;
  files: number;
  domains: number;
  flows: number;
  health: number;
  aiReadiness: number;
  durationMs: number;
  capabilities: number;
  smells: number;
}

interface WorkspaceRepo {
  id: string;
  name: string;
  label: string;
  path: string;
  description: string;
  accent: string;
}

interface WorkspaceConfig {
  name: string;
  root: string;
  repos: WorkspaceRepo[];
}

const building = new Map<string, Promise<void>>();

function json(res: import('http').ServerResponse, data: unknown, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(JSON.stringify(data));
}

async function readJsonSafe<T>(filePath: string): Promise<T | null> {
  try {
    if (!existsSync(filePath)) return null;
    return JSON.parse(await readFile(filePath, 'utf-8')) as T;
  } catch {
    return null;
  }
}

async function repoSnapshot(repo: WorkspaceRepo): Promise<Record<string, unknown>> {
  const mnemosDir = path.join(repo.path, '.mnemos');
  const memory = await readJsonSafe<{
    builtAt: string;
    stats: Record<string, number>;
    capabilities?: unknown[];
    smells: unknown[];
    domains: unknown[];
  }>(path.join(mnemosDir, 'memory.json'));
  const dna = await readJsonSafe<{
    repository_health_score: number;
    ai_readiness_score: number;
    domains: Array<{ name: string; risk: string }>;
    capabilities: Array<{ name: string }>;
  }>(path.join(mnemosDir, 'project.dna.json'));
  const health = await readJsonSafe<{ overall: number }>(path.join(mnemosDir, 'health-score.json'));

  if (building.has(repo.id)) {
    return { ...repo, status: 'building' };
  }

  if (!memory) {
    return { ...repo, status: 'missing' };
  }

  const critical = dna?.domains?.[0]?.name;
  const risks = dna?.domains?.filter((d) => d.risk === 'high') ?? [];

  return {
    ...repo,
    status: 'ready',
    builtAt: memory.builtAt,
    health: health?.overall ?? dna?.repository_health_score ?? 0,
    aiReadiness: dna?.ai_readiness_score ?? 0,
    stats: {
      files: memory.stats.filesScanned,
      domains: memory.stats.domainsFound,
      flows: memory.stats.flowsFound,
      apis: (memory.stats as { apis?: number }).apis ?? 0,
      capabilities: memory.capabilities?.length ?? dna?.capabilities?.length ?? 0,
      smells: memory.smells?.length ?? 0,
      durationMs: memory.stats.durationMs,
    },
    mostCritical: critical,
    highestRisk: risks[0]?.name,
    topCapabilities: dna?.capabilities?.slice(0, 4).map((c) => c.name) ?? [],
  };
}

async function appendBuildHistory(repo: WorkspaceRepo): Promise<void> {
  const mnemosDir = path.join(repo.path, '.mnemos');
  const memory = await readJsonSafe<{ builtAt: string; stats: Record<string, number>; smells?: unknown[]; capabilities?: unknown[] }>(
    path.join(mnemosDir, 'memory.json'),
  );
  const health = await readJsonSafe<{ overall: number }>(path.join(mnemosDir, 'health-score.json'));
  const dna = await readJsonSafe<{ ai_readiness_score?: number }>(path.join(mnemosDir, 'project.dna.json'));
  if (!memory) return;

  const historyPath = path.join(mnemosDir, 'build-history.json');
  const existing = (await readJsonSafe<BuildHistoryEntry[]>(historyPath)) ?? [];
  const entry: BuildHistoryEntry = {
    builtAt: memory.builtAt,
    files: memory.stats.filesScanned,
    domains: memory.stats.domainsFound,
    flows: memory.stats.flowsFound,
    health: health?.overall ?? 0,
    aiReadiness: dna?.ai_readiness_score ?? 0,
    durationMs: memory.stats.durationMs,
    capabilities: memory.capabilities?.length ?? 0,
    smells: memory.smells?.length ?? 0,
  };
  const next = [entry, ...existing.filter((e) => e.builtAt !== entry.builtAt)].slice(0, 30);
  await writeFile(historyPath, JSON.stringify(next, null, 2), 'utf-8');
}

function runCli(cliPath: string, args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      stdio: 'pipe',
      env: { ...process.env },
      shell: false,
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d) => { stdout += String(d); });
    child.stderr?.on('data', (d) => { stderr += String(d); });
    child.on('close', (code) => resolve({ stdout, stderr, code: code ?? 1 }));
  });
}

const ALLOWED_CLI = new Set(['build', 'ask', 'flows', 'explain', 'score', 'dna', 'inspect', 'context', 'story', 'impact']);

function parseTerminalCommand(raw: string): string[] | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parts = trimmed.match(/(?:[^\s"]+|"[^"]*")+/g)?.map((p) => p.replace(/^"|"$/g, '')) ?? [];
  if (parts[0] === 'mnemos') parts.shift();
  if (parts.length === 0) return null;
  if (!ALLOWED_CLI.has(parts[0])) return null;
  return parts;
}

function runMnemosBuild(repoPath: string, cliPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath, 'build', repoPath], {
      stdio: 'pipe',
      env: { ...process.env },
    });
    let stderr = '';
    child.stderr?.on('data', (d) => { stderr += String(d); });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr || `Build failed with code ${code}`));
    });
  });
}

async function readBody(req: import('http').IncomingMessage): Promise<string> {
  let body = '';
  for await (const chunk of req) body += chunk;
  return body;
}

export function workspacePlugin(workspaceFile: string, cliPath: string): Plugin {
  let config: WorkspaceConfig | null = null;

  return {
    name: 'mnemos-workspace',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url) return next();

        if (req.method === 'OPTIONS') {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
          res.statusCode = 204;
          res.end();
          return;
        }

        if (req.url === '/api/workspace') {
          if (!config) {
            try {
              config = JSON.parse(await readFile(workspaceFile, 'utf-8')) as WorkspaceConfig;
            } catch {
              return json(res, { error: 'Invalid workspace config' }, 500);
            }
          }
          const repos = await Promise.all(config.repos.map(repoSnapshot));
          const ready = repos.filter((r) => r.status === 'ready');
          const aggregateHealth = ready.length
            ? Math.round(ready.reduce((s, r) => s + ((r.health as number) ?? 0), 0) / ready.length)
            : 0;
          return json(res, {
            workspace: config.name,
            repos,
            aggregateHealth,
            totalFiles: ready.reduce((s, r) => s + ((r.stats as { files: number })?.files ?? 0), 0),
            totalDomains: ready.reduce((s, r) => s + ((r.stats as { domains: number })?.domains ?? 0), 0),
            totalFlows: ready.reduce((s, r) => s + ((r.stats as { flows: number })?.flows ?? 0), 0),
          });
        }

        if (req.url === '/api/build' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => { body += chunk; });
          req.on('end', async () => {
            try {
              if (!config) {
                config = JSON.parse(await readFile(workspaceFile, 'utf-8')) as WorkspaceConfig;
              }
              const { repoId } = JSON.parse(body) as { repoId: string };
              const repo = config.repos.find((r) => r.id === repoId);
              if (!repo) return json(res, { ok: false, message: 'Unknown repo' }, 404);

              if (building.has(repoId)) {
                return json(res, { ok: true, message: 'Build already in progress' });
              }

              const buildPromise = runMnemosBuild(repo.path, cliPath)
                .then(() => appendBuildHistory(repo))
                .finally(() => building.delete(repoId));
              building.set(repoId, buildPromise);

              json(res, { ok: true, message: `Building ${repo.name}…` });

              buildPromise.catch(() => {});
            } catch (err) {
              json(res, { ok: false, message: String(err) }, 500);
            }
          });
          return;
        }

        const historyMatch = req.url.match(/^\/api\/history\/([^/?]+)/);
        if (historyMatch && req.method === 'GET') {
          if (!config) {
            try {
              config = JSON.parse(await readFile(workspaceFile, 'utf-8')) as WorkspaceConfig;
            } catch {
              return json(res, { error: 'Invalid workspace config' }, 500);
            }
          }
          const repo = config.repos.find((r) => r.id === historyMatch[1]);
          if (!repo) return json(res, { error: 'Unknown repo' }, 404);
          const historyPath = path.join(repo.path, '.mnemos', 'build-history.json');
          let history = (await readJsonSafe<BuildHistoryEntry[]>(historyPath)) ?? [];
          if (history.length === 0) {
            const snap = await repoSnapshot(repo);
            if (snap.status === 'ready') {
              history = [{
                builtAt: snap.builtAt as string,
                files: (snap.stats as { files: number }).files,
                domains: (snap.stats as { domains: number }).domains,
                flows: (snap.stats as { flows: number }).flows,
                health: snap.health as number,
                aiReadiness: snap.aiReadiness as number,
                durationMs: (snap.stats as { durationMs: number }).durationMs,
                capabilities: (snap.stats as { capabilities: number }).capabilities,
                smells: (snap.stats as { smells: number }).smells,
              }];
            }
          }
          return json(res, { repoId: repo.id, history });
        }

        if (req.url === '/api/terminal' && req.method === 'POST') {
          try {
            if (!config) {
              config = JSON.parse(await readFile(workspaceFile, 'utf-8')) as WorkspaceConfig;
            }
            const body = JSON.parse(await readBody(req)) as { repoId: string; command: string };
            const repo = config.repos.find((r) => r.id === body.repoId);
            if (!repo) return json(res, { ok: false, output: 'Unknown repository' }, 404);

            const cmd = body.command.trim();
            if (cmd === 'help') {
              return json(res, {
                ok: true,
                output: `Mnemos commands (repo: ${repo.name}):
  build              Re-analyze repository
  ask "<question>"   Architecture copilot (e.g. ask "how does auth work?")
  flows [query]      List execution flows
  explain            Repository explanation
  score              Health score breakdown
  dna                Project DNA summary
  inspect <query>    Inspect a node or domain
  context            Export context paths
  impact <node>      Blast radius analysis`,
              });
            }

            const args = parseTerminalCommand(cmd);
            if (!args) {
              return json(res, { ok: false, output: `Unknown command: ${cmd}\nType "help" for available commands.` });
            }

            const cliArgs = [...args, '--path', repo.path];
            const result = await runCli(cliPath, cliArgs);
            const output = (result.stdout || result.stderr || 'Done.').trim();
            return json(res, { ok: result.code === 0, output, code: result.code });
          } catch (err) {
            return json(res, { ok: false, output: String(err) }, 500);
          }
        }

        if (req.url === '/api/ask' && req.method === 'POST') {
          try {
            if (!config) {
              config = JSON.parse(await readFile(workspaceFile, 'utf-8')) as WorkspaceConfig;
            }
            const body = JSON.parse(await readBody(req)) as { repoId: string; question: string };
            const repo = config.repos.find((r) => r.id === body.repoId);
            if (!repo) return json(res, { ok: false, answer: 'Unknown repository' }, 404);

            const result = await runCli(cliPath, ['ask', body.question, '--path', repo.path]);
            const text = (result.stdout || result.stderr).trim();
            const confidenceMatch = text.match(/Confidence:\s*(\d+)%/);
            const answer = text.split('\n').slice(3).join('\n').trim() || text;
            return json(res, {
              ok: result.code === 0,
              answer,
              confidence: confidenceMatch ? Number(confidenceMatch[1]) / 100 : 0.8,
              raw: text,
            });
          } catch (err) {
            return json(res, { ok: false, answer: String(err) }, 500);
          }
        }

        const contextMatch = req.url.match(/^\/\.mnemos\/([^/]+)\/context\/(.+)$/);
        if (contextMatch) {
          if (!config) {
            try {
              config = JSON.parse(await readFile(workspaceFile, 'utf-8')) as WorkspaceConfig;
            } catch {
              return next();
            }
          }
          const [, repoId, file] = contextMatch;
          const repo = config.repos.find((r) => r.id === repoId);
          if (!repo) {
            res.statusCode = 404;
            res.end('Repo not found');
            return;
          }
          const filePath = path.join(repo.path, '.mnemos', 'context', file);
          if (!existsSync(filePath)) {
            res.statusCode = 404;
            res.end('Not found');
            return;
          }
          try {
            const content = await readFile(filePath, 'utf-8');
            res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(content);
          } catch {
            res.statusCode = 500;
            res.end('Error');
          }
          return;
        }

        const multiMatch = req.url.match(/^\/\.mnemos\/([^/]+)\/(.+)$/);
        if (multiMatch) {
          if (!config) {
            try {
              config = JSON.parse(await readFile(workspaceFile, 'utf-8')) as WorkspaceConfig;
            } catch {
              return next();
            }
          }
          const [, repoId, file] = multiMatch;
          const repo = config.repos.find((r) => r.id === repoId);
          if (!repo) {
            res.statusCode = 404;
            res.end('Repo not found');
            return;
          }
          const filePath = path.join(repo.path, '.mnemos', file);
          if (!existsSync(filePath)) {
            res.statusCode = 404;
            res.end('Not found');
            return;
          }
          try {
            const content = await readFile(filePath, 'utf-8');
            res.setHeader('Content-Type', file.endsWith('.html') ? 'text/html' : 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(content);
          } catch {
            res.statusCode = 500;
            res.end('Error');
          }
          return;
        }

        return next();
      });
    },
  };
}

export function resolveCliPath(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '../cli/dist/index.js');
}

export function resolveWorkspaceFile(): string | undefined {
  const env = process.env.MNEMOS_WORKSPACE;
  if (env && existsSync(env)) return path.resolve(env);
  const defaultPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'dabt.workspace.json');
  if (existsSync(defaultPath)) return defaultPath;
  return undefined;
}
