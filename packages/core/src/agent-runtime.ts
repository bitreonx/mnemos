import path from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import type { MemoryModel } from './types.js';
import type { MnemosGraph } from './graph/graph.js';
import { getNeighbors } from './graph/graph.js';
import { resolveNodeQuery } from './graph/builder.js';
import { loadMemoryModel, loadPersistedGraph } from './pipeline/build.js';
import { loadOrBuildSearchIndex, searchMemory, type MemorySearchIndex } from './search/index.js';
import { routeQuery } from './routing/route-query.js';
import { findGraphPath, explainNode, formatPathResult } from './graph-query.js';
import { analyzeImpact, formatImpactReport } from './analysis/impact.js';
import { buildDnaReport, formatDnaReport } from './dna.js';
import { explainRepository, formatExplainReport } from './explain.js';
import { computeMemoryScore } from './report.js';
import { computeAiReadiness } from './ai-readiness.js';
import { computeDomainHeatmap } from './analysis/heatmap.js';
import { getNodeQueryIndex } from './graph/node-index.js';
import { buildOnboardGuide, formatOnboardGuide } from './onboard.js';
import { classifyIntent } from './search/index.js';
import { reviewDiff, formatReviewReport } from './review.js';
import { buildAgentExports } from './agent-mode.js';
import {
  buildDomainGraphMermaid,
  buildFlowGraphMermaid,
} from './graph/mermaid.js';
import { buildHealthGraphBundle } from './context/graph-markdown.js';

export const MNEMOS_VERSION = '0.2.0';
export const MNEMOS_MCP_URI = 'mnemos://';

export type AgentErrorCode =
  | 'NOT_BUILT'
  | 'NOT_FOUND'
  | 'GRAPH_UNAVAILABLE'
  | 'INVALID_INPUT'
  | 'INTERNAL';

export class MnemosAgentError extends Error {
  readonly code: AgentErrorCode;
  readonly hint?: string;
  readonly details?: unknown;

  constructor(code: AgentErrorCode, message: string, hint?: string, details?: unknown) {
    super(message);
    this.name = 'MnemosAgentError';
    this.code = code;
    this.hint = hint;
    this.details = details;
  }
}

export interface MnemosArtifacts {
  root: string;
  outputDir: string;
  memory: MemoryModel;
  graph?: MnemosGraph;
  searchIndex: MemorySearchIndex;
  loadedAt: string;
  buildStats: {
    filesScanned: number;
    nodes: number;
    edges: number;
    domains: number;
    flows: number;
  };
}

export interface AgentEnvelope<T = unknown> {
  ok: boolean;
  tool: string;
  summary: string;
  markdown: string;
  data: T;
  meta: {
    repository: string;
    confidence?: number;
    tookMs?: number;
    version: string;
  };
}

export interface MnemosResourceDescriptor {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

const CONTEXT_FILES = [
  'README.md',
  'repository_summary.md',
  'architecture.md',
  'languages.md',
  'graphs.md',
  'domains.md',
  'flows.md',
  'critical_paths.md',
] as const;

export class MnemosRuntime {
  private cache: MnemosArtifacts | null = null;
  readonly root: string;

  private static instances = new Map<string, MnemosRuntime>();

  constructor(root: string) {
    this.root = path.resolve(root);
    MnemosRuntime.instances.set(this.root, this);
  }

  static invalidate(root: string): void {
    MnemosRuntime.instances.get(path.resolve(root))?.invalidate();
    MnemosRuntime.instances.delete(path.resolve(root));
  }

  invalidate(): void {
    this.cache = null;
  }

  async load(force = false): Promise<MnemosArtifacts> {
    if (this.cache && !force) return this.cache;

    const loaded = await loadMemoryModel(this.root);
    if (!loaded) {
      throw new MnemosAgentError(
        'NOT_BUILT',
        'No Mnemos memory model found for this repository.',
        'Run `npx mnemos .` or `mnemos build` in the project root first.',
      );
    }

    const start = Date.now();
    const [graph, searchIndex] = await Promise.all([
      loadPersistedGraph(loaded.outputDir),
      loadOrBuildSearchIndex(loaded.memory, loaded.outputDir),
    ]);

    if (graph) getNodeQueryIndex(graph);

    this.cache = {
      root: this.root,
      outputDir: loaded.outputDir,
      memory: loaded.memory,
      graph,
      searchIndex,
      loadedAt: new Date().toISOString(),
      buildStats: {
        filesScanned: loaded.memory.stats.filesScanned,
        nodes: loaded.memory.stats.nodesCreated,
        edges: loaded.memory.stats.edgesCreated,
        domains: loaded.memory.domains.length,
        flows: loaded.memory.flows.length,
      },
    };

    return this.cache;
  }

  async getStatus(): Promise<{
    ready: boolean;
    repository?: string;
    outputDir?: string;
    loadedAt?: string;
    buildStats?: MnemosArtifacts['buildStats'];
    graphAvailable: boolean;
    loadMs?: number;
  }> {
    const start = Date.now();
    try {
      const artifacts = await this.load();
      return {
        ready: true,
        repository: artifacts.memory.repository,
        outputDir: artifacts.outputDir,
        loadedAt: artifacts.loadedAt,
        buildStats: artifacts.buildStats,
        graphAvailable: !!artifacts.graph,
        loadMs: Date.now() - start,
      };
    } catch {
      return { ready: false, graphAvailable: false, loadMs: Date.now() - start };
    }
  }

  async getStatusEnvelope(): Promise<AgentEnvelope> {
    const status = await this.getStatus();
    const summary = status.ready
      ? `Ready · graph ${status.graphAvailable ? 'available' : 'unavailable'}`
      : 'Not ready (run mnemos build)';
    const markdown = [
      '# Mnemos Status',
      '',
      `- **Ready:** ${status.ready ? 'yes' : 'no'}`,
      `- **Graph:** ${status.graphAvailable ? 'available' : 'unavailable'}`,
      status.repository ? `- **Repository:** ${status.repository}` : '',
      status.outputDir ? `- **Output:** ${status.outputDir}` : '',
      status.loadedAt ? `- **Loaded:** ${status.loadedAt}` : '',
      status.loadMs !== undefined ? `- **Load time:** ${status.loadMs}ms` : '',
    ]
      .filter(Boolean)
      .join('\n');

    return this.envelope('get_status', summary, markdown, status);
  }

  listResources(): MnemosResourceDescriptor[] {
    const base = `${MNEMOS_MCP_URI}repository/`;
    const resources: MnemosResourceDescriptor[] = [
      {
        uri: `${base}dna`,
        name: 'Repository DNA',
        description: 'Compressed architecture fingerprint — start here before reading source files',
        mimeType: 'application/json',
      },
      {
        uri: `${base}summary`,
        name: 'Human Summary',
        description: 'Plain-language overview of what this repository does',
        mimeType: 'text/markdown',
      },
      {
        uri: `${base}agent-context`,
        name: 'Agent Context',
        description: 'Machine-optimized context for AI agents (capabilities, domains, journeys)',
        mimeType: 'application/json',
      },
      {
        uri: `${base}domains`,
        name: 'Domains',
        description: 'Business domains with entry points and node counts',
        mimeType: 'application/json',
      },
      {
        uri: `${base}flows`,
        name: 'Execution Flows',
        description: 'Request, event, and journey flows detected in the codebase',
        mimeType: 'application/json',
      },
      {
        uri: `${base}health`,
        name: 'Health & Readiness',
        description: 'Architecture health score, smells, and AI readiness',
        mimeType: 'application/json',
      },
    ];

    for (const file of CONTEXT_FILES) {
      resources.push({
        uri: `${base}context/${file}`,
        name: `Context: ${file}`,
        description: `Compiled architecture context — ${file}`,
        mimeType: 'text/markdown',
      });
    }

    return resources;
  }

  async readResource(uri: string): Promise<{ mimeType: string; text: string }> {
    const artifacts = await this.load();
    const { memory, outputDir } = artifacts;

    if (uri === `${MNEMOS_MCP_URI}repository/dna`) {
      try {
        const raw = await readFile(path.join(outputDir, 'project.dna.json'), 'utf-8');
        return { mimeType: 'application/json', text: raw };
      } catch {
        const dna = buildDnaReport(memory);
        return { mimeType: 'application/json', text: JSON.stringify(dna, null, 2) };
      }
    }

    if (uri === `${MNEMOS_MCP_URI}repository/summary`) {
      const explain = explainRepository(memory);
      return { mimeType: 'text/markdown', text: formatExplainReport(explain, memory) };
    }

    if (uri === `${MNEMOS_MCP_URI}repository/agent-context`) {
      const exports = buildAgentExports({
        memory,
        capabilities: memory.capabilities ?? [],
        journeys: memory.journeys ?? [],
        memoryScore: computeMemoryScore(memory).overall,
      });
      return {
        mimeType: 'application/json',
        text: JSON.stringify(exports.context, null, 2),
      };
    }

    if (uri === `${MNEMOS_MCP_URI}repository/domains`) {
      return {
        mimeType: 'application/json',
        text: JSON.stringify(memory.domains, null, 2),
      };
    }

    if (uri === `${MNEMOS_MCP_URI}repository/flows`) {
      return {
        mimeType: 'application/json',
        text: JSON.stringify(memory.flows, null, 2),
      };
    }

    if (uri === `${MNEMOS_MCP_URI}repository/health`) {
      const score = computeMemoryScore(memory);
      const ai = computeAiReadiness(memory);
      const heatmap = computeDomainHeatmap(memory);
      return {
        mimeType: 'application/json',
        text: JSON.stringify({ score, aiReadiness: ai, heatmap, smells: memory.smells }, null, 2),
      };
    }

    const contextMatch = uri.match(/^mnemos:\/\/repository\/context\/(.+)$/);
    if (contextMatch) {
      const file = contextMatch[1]!;
      if (!CONTEXT_FILES.includes(file as (typeof CONTEXT_FILES)[number])) {
        throw new MnemosAgentError('NOT_FOUND', `Unknown context file: ${file}`);
      }
      const text = await readFile(path.join(outputDir, 'context', file), 'utf-8');
      return { mimeType: 'text/markdown', text };
    }

    throw new MnemosAgentError('NOT_FOUND', `Unknown resource: ${uri}`);
  }

  private envelope<T>(tool: string, summary: string, markdown: string, data: T, extra?: Partial<AgentEnvelope['meta']>): AgentEnvelope<T> {
    return {
      ok: true,
      tool,
      summary,
      markdown,
      data,
      meta: {
        repository: this.cache?.memory.repository ?? path.basename(this.root),
        version: MNEMOS_VERSION,
        ...extra,
      },
    };
  }

  async queryGraph(question: string, options: { compact?: boolean; tokenBudget?: number } = {}): Promise<AgentEnvelope> {
    const start = Date.now();
    const { memory, graph, searchIndex } = await this.load();
    if (!question.trim()) {
      throw new MnemosAgentError('INVALID_INPUT', 'Question cannot be empty.');
    }

    const result = routeQuery(memory, question, {
      graph,
      searchIndex,
      compact: options.compact,
      tokenBudget: options.tokenBudget,
    });

    const markdown = [
      result.summary,
      '',
      result.answer,
      '',
      result.relatedTopics.length ? `Related: ${result.relatedTopics.slice(0, 5).join(' · ')}` : '',
      '',
      `Confidence ${(result.confidence * 100).toFixed(0)}% · ${result.route} · ${result.tokensAfter} tokens`,
    ]
      .filter(Boolean)
      .join('\n');

    return this.envelope('query_graph', result.summary, markdown, result, {
      confidence: result.confidence,
      tookMs: Date.now() - start,
    });
  }

  async getOnboard(): Promise<AgentEnvelope> {
    const { memory } = await this.load();
    const guide = buildOnboardGuide(memory);
    return this.envelope('onboard', guide.startHere.join(' → '), formatOnboardGuide(guide), guide);
  }

  async getExplain(): Promise<AgentEnvelope> {
    const { memory } = await this.load();
    const explain = explainRepository(memory);
    const formatted = formatExplainReport(explain, memory);
    return this.envelope('explain_repo', explain.oneLiner, formatted, explain);
  }

  async getDna(): Promise<AgentEnvelope> {
    const { memory } = await this.load();
    const dna = buildDnaReport(memory);
    const formatted = formatDnaReport(dna);
    return this.envelope('get_dna', dna.oneLiner, formatted, dna);
  }

  async getNode(name: string): Promise<AgentEnvelope> {
    const { memory, graph } = await this.load();
    if (!name.trim()) throw new MnemosAgentError('INVALID_INPUT', 'Node name is required.');
    const result = explainNode(memory, name, graph);
    if (!result.nodeId && !result.service && !result.domain) {
      throw new MnemosAgentError(
        'NOT_FOUND',
        `No node matching "${name}".`,
        'Try mnemos search or list_domains to find valid names.',
      );
    }
    return this.envelope('get_node', `${result.name} — ${result.domain ?? 'unknown domain'}`, result.text, result);
  }

  async getNeighbors(name: string, direction: 'in' | 'out' | 'both' = 'both'): Promise<AgentEnvelope> {
    const { memory, graph } = await this.load();
    if (!graph) throw new MnemosAgentError('GRAPH_UNAVAILABLE', 'Knowledge graph not available.', 'Run mnemos build to generate graph.json.');

    const nodeId = resolveNodeQuery(graph, name);
    if (!nodeId) throw new MnemosAgentError('NOT_FOUND', `Node not found: ${name}`);

    const attrs = graph.getNodeAttributes(nodeId);
    const incoming = direction === 'out' ? [] : getNeighbors(graph, nodeId, undefined, 'in');
    const outgoing = direction === 'in' ? [] : getNeighbors(graph, nodeId, undefined, 'out');

    const data = {
      node: { id: nodeId, name: attrs.name, kind: attrs.kind, path: attrs.path },
      incoming: incoming.map((n) => ({ name: n.name, kind: n.kind, path: n.path })),
      outgoing: outgoing.map((n) => ({ name: n.name, kind: n.kind, path: n.path })),
    };

    const markdown = [
      `# Neighbors: ${attrs.name}`,
      '',
      '## Dependents (incoming)',
      ...(data.incoming.length ? data.incoming.map((n) => `- **${n.name}** (${n.kind})`) : ['- none']),
      '',
      '## Dependencies (outgoing)',
      ...(data.outgoing.length ? data.outgoing.map((n) => `- **${n.name}** (${n.kind})`) : ['- none']),
    ].join('\n');

    return this.envelope('get_neighbors', `${data.incoming.length} in · ${data.outgoing.length} out`, markdown, data);
  }

  async shortestPath(from: string, to: string): Promise<AgentEnvelope> {
    const { graph } = await this.load();
    if (!graph) throw new MnemosAgentError('GRAPH_UNAVAILABLE', 'Knowledge graph not available.');
    const result = findGraphPath(graph, from, to);
    const markdown = formatPathResult(result);
    return this.envelope(
      'shortest_path',
      result.found ? `${result.labels.length} hops: ${result.from} → ${result.to}` : `No path: ${from} → ${to}`,
      markdown,
      result,
    );
  }

  async impactAnalysis(node: string): Promise<AgentEnvelope> {
    const { graph } = await this.load();
    if (!graph) throw new MnemosAgentError('GRAPH_UNAVAILABLE', 'Knowledge graph not available.');
    const result = analyzeImpact(graph, node);
    if (!result) throw new MnemosAgentError('NOT_FOUND', `Node not found: ${node}`);
    const formatted = formatImpactReport(result, graph);
    const nodeName = graph.getNodeAttributes(result.node).name;
    return this.envelope(
      'impact_analysis',
      `Changing ${nodeName} affects ${result.totalAffected} nodes`,
      formatted,
      result,
    );
  }

  async listDomains(): Promise<AgentEnvelope> {
    const { memory } = await this.load();
    const domains = memory.domains.map((d) => ({
      name: d.name,
      description: d.description,
      confidence: d.confidence,
      nodeCount: d.nodes.length,
      entryPoints: d.entryPoints.slice(0, 5),
    }));

    const markdown = [
      `# Domains (${domains.length})`,
      '',
      buildDomainGraphMermaid(memory),
      '',
      ...domains.slice(0, 15).map(
        (d) => `- **${d.name}** (${d.nodeCount} nodes) — ${d.description}\n  Entry: ${d.entryPoints.join(', ') || 'none'}`,
      ),
    ].join('\n');

    return this.envelope('list_domains', `${domains.length} domains`, markdown, domains);
  }

  async listFlows(): Promise<AgentEnvelope> {
    const { memory } = await this.load();
    const flows = memory.flows.map((f) => ({
      name: f.name,
      type: f.type,
      entryPoint: f.entryPoint,
      stepCount: f.steps.length,
      description: f.description,
    }));

    const markdown = [
      `# Flows (${flows.length})`,
      '',
      buildFlowGraphMermaid(memory, 0),
      '',
      ...flows.slice(0, 15).map((f) => `- **${f.name}** (${f.type}) — ${f.entryPoint}\n  ${f.description}`),
    ].join('\n');

    return this.envelope('list_flows', `${flows.length} flows`, markdown, flows);
  }

  async listCapabilities(): Promise<AgentEnvelope> {
    const { memory } = await this.load();
    const caps = (memory.capabilities ?? []).map((c) => ({
      name: c.signature.name,
      purpose: c.signature.purpose,
      confidence: c.confidence,
      services: c.services.slice(0, 5),
    }));

    const markdown = [
      `# Capabilities (${caps.length})`,
      '',
      ...caps.map((c) => `- **${c.name}** — ${c.purpose} (${(c.confidence * 100).toFixed(0)}%)`),
    ].join('\n');

    return this.envelope('list_capabilities', `${caps.length} capabilities`, markdown, caps);
  }

  async search(query: string, limit = 10): Promise<AgentEnvelope> {
    const start = Date.now();
    const { memory, searchIndex } = await this.load();
    if (!query.trim()) throw new MnemosAgentError('INVALID_INPUT', 'Search query cannot be empty.');

    const result = searchMemory(searchIndex, query, { limit: Math.min(limit, 50) });
    const markdown = [
      `# Search: "${query}"`,
      '',
      result.hits.length
        ? result.hits.map((h) => `- **${h.title}** (${h.kind}, score ${h.score.toFixed(2)})\n  ${h.snippet}`).join('\n')
        : '_No matches._',
    ].join('\n');

    return this.envelope('search', `${result.hits.length} hits for "${query}"`, markdown, result, {
      tookMs: Date.now() - start,
    });
  }

  async getHealth(): Promise<AgentEnvelope> {
    const { memory } = await this.load();
    const score = computeMemoryScore(memory);
    const ai = computeAiReadiness(memory);
    const heatmap = computeDomainHeatmap(memory).slice(0, 5);
    const data = { score, aiReadiness: ai, topRiskDomains: heatmap, smellCount: memory.smells.length };

    const markdown = [
      `# Repository Health`,
      '',
      `- **Overall:** ${score.overall}/100`,
      `- **Architecture clarity:** ${score.architectureClarity}`,
      `- **AI readiness:** ${ai.score}/100`,
      `- **Smells:** ${memory.smells.length}`,
      '',
      buildHealthGraphBundle(memory),
      '',
      '## Top risk domains',
      ...heatmap.map((h) => `- **${h.domain}** — ${h.riskScore}/100`),
    ].join('\n');

    return this.envelope('get_health', `Health ${score.overall}/100 · AI readiness ${ai.score}/100`, markdown, data);
  }

  async reviewDiffContent(diff: string): Promise<AgentEnvelope> {
    const { memory } = await this.load();
    if (!diff.trim()) throw new MnemosAgentError('INVALID_INPUT', 'Diff content is required.');
    const result = reviewDiff(memory, diff);
    return this.envelope(
      'review_diff',
      `Risk ${result.riskLevel} · ${result.changedFiles.length} files`,
      formatReviewReport(result),
      result,
    );
  }

  async compileFocus(task: string, tokenBudget = 8000): Promise<AgentEnvelope> {
    const start = Date.now();
    const { memory, graph, searchIndex } = await this.load();
    if (!task.trim()) throw new MnemosAgentError('INVALID_INPUT', 'Task description is required.');

    const { compileSubgraphContext, formatSubgraphContext } = await import('./context/subgraph-compiler.js');
    const ctx = compileSubgraphContext(memory, task, graph, { tokenBudget, searchIndex });

    return this.envelope(
      'compile_focus',
      `Focus pack for "${task}" (~${ctx.estimatedTokens} tokens)`,
      formatSubgraphContext(ctx),
      ctx.json,
      { tookMs: Date.now() - start },
    );
  }

  async getDnaDiff(): Promise<AgentEnvelope> {
    const { memory, outputDir } = await this.load();
    const { loadBuildHistory, compareDnaSnapshots, snapshotFromMemory, formatDnaDiffReport } = await import('./snapshot/dna-diff.js');
    const history = await loadBuildHistory(outputDir);
    const current = snapshotFromMemory(memory);

    if (history.length < 2) {
      return this.envelope(
        'dna_diff',
        history.length === 0 ? 'No build history yet' : 'First snapshot — run build again to diff',
        formatDnaDiffReport({
          hasPrevious: false,
          currentBuiltAt: current.builtAt,
          changes: [],
          summary: 'Need at least two builds for diff.',
          regressionRisk: 'none',
        }),
        { historyLength: history.length, current },
      );
    }

    const diff = compareDnaSnapshots(history[history.length - 2]!, current);
    return this.envelope('dna_diff', diff.summary, formatDnaDiffReport(diff), diff);
  }

  async getGitHotspots(limit = 20): Promise<AgentEnvelope> {
    const start = Date.now();
    const { memory } = await this.load();
    const { analyzeGitHotspots, formatGitIntelReport } = await import('./analysis/git-intel.js');
    const intel = await analyzeGitHotspots(this.root, memory, { limit });
    return this.envelope(
      'git_hotspots',
      intel.available ? `Top ${intel.hotspots.length} churn hotspots` : 'Git unavailable',
      formatGitIntelReport(intel),
      intel,
      { tookMs: Date.now() - start },
    );
  }

  async getBuildHistory(): Promise<AgentEnvelope> {
    const { outputDir } = await this.load();
    const { loadBuildHistory } = await import('./snapshot/dna-diff.js');
    const history = await loadBuildHistory(outputDir);
    const markdown = [
      `# Build History (${history.length} snapshots)`,
      '',
      ...history.slice(-15).reverse().map((s, i) =>
        `- **${s.builtAt}** — health ${s.healthScore}/100 · ${s.domainNames.length} domains · ${s.smellCount} smells`,
      ),
    ].join('\n');
    return this.envelope('build_history', `${history.length} snapshots`, markdown, history);
  }
}

export function invalidateMnemosRuntime(root: string): void {
  MnemosRuntime.invalidate(root);
}

export function envelopeToMcpContent(envelope: AgentEnvelope): { type: 'text'; text: string }[] {
  // Markdown only — structuredContent on CallToolResult carries the JSON payload.
  // Duplicating JSON here tripled token cost per MCP tool call.
  return [{ type: 'text', text: envelope.markdown }];
}

export function errorToMcpContent(
  err: unknown,
  tool = 'unknown',
  runtime?: MnemosRuntime,
): {
  content: { type: 'text'; text: string }[];
  isError: true;
  structuredContent: Record<string, unknown>;
} {
  const repository = runtime ? path.basename(runtime.root) : 'unknown';

  if (err instanceof MnemosAgentError) {
    return {
      content: [
        {
          type: 'text',
          text: [
            `# Mnemos Error: ${err.code}`,
            '',
            err.message,
            err.hint ? `\n**Hint:** ${err.hint}` : '',
          ]
            .filter(Boolean)
            .join('\n'),
        },
      ],
      isError: true,
      structuredContent: {
        ok: false,
        tool,
        summary: err.message,
        data: {
          error: {
            code: err.code,
            message: err.message,
            hint: err.hint,
            details: err.details,
          },
        },
        meta: { repository, version: MNEMOS_VERSION },
      },
    };
  }

  return {
    content: [{ type: 'text', text: `# Error\n\n${String(err)}` }],
    isError: true,
    structuredContent: {
      ok: false,
      tool,
      summary: String(err),
      data: { error: { code: 'INTERNAL', message: String(err) } },
      meta: { repository, version: MNEMOS_VERSION },
    },
  };
}
