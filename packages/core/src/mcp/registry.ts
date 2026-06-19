import type { AgentEnvelope, MnemosRuntime } from '../agent-runtime.js';
import { MnemosAgentError, MNEMOS_VERSION } from '../agent-runtime.js';
import { assertNoUnknownFields, enumArg, expectArgsObject, numberArg, stringArg } from './validation.js';
import { buildMcpArchitectureGraphBundle } from '../context/graph-markdown.js';

const ENVELOPE_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    ok: { type: 'boolean' as const },
    tool: { type: 'string' as const },
    summary: { type: 'string' as const },
    data: {},
    meta: {
      type: 'object' as const,
      properties: {
        repository: { type: 'string' as const },
        confidence: { type: 'number' as const },
        tookMs: { type: 'number' as const },
        version: { type: 'string' as const },
      },
      required: ['repository', 'version'],
    },
  },
  required: ['ok', 'tool', 'summary', 'data', 'meta'],
} as const;

export type ToolRegistration<Args> = {
  definition: {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    outputSchema?: Record<string, unknown>;
    annotations?: Record<string, unknown>;
  };
  normalize: (raw: unknown) => Args;
  run: (runtime: MnemosRuntime, args: Args) => Promise<AgentEnvelope>;
};

const READONLY_TOOL_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
} as const;

const DIRECTION = ['in', 'out', 'both'] as const;

export const TOOL_REGISTRY: ToolRegistration<any>[] = [
  {
    definition: {
      name: 'get_status',
      description: 'MCP introspection: readiness, graph availability, and connected repository metadata.',
      inputSchema: {
        type: 'object' as const,
        properties: {},
        additionalProperties: false,
      },
      outputSchema: ENVELOPE_OUTPUT_SCHEMA,
      annotations: READONLY_TOOL_ANNOTATIONS,
    },
    normalize: (raw) => {
      const args = expectArgsObject(raw);
      assertNoUnknownFields(args, []);
      return {};
    },
    run: async (runtime) => runtime.getStatusEnvelope(),
  },
  {
    definition: {
      name: 'query_graph',
      description:
        'Primary architecture copilot — domains, flows, auth, dependencies, onboarding. Uses persisted graph + inverted BM25 index.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          question: {
            type: 'string' as const,
            minLength: 1,
            description: 'e.g. "what connects auth to the database?" or "what breaks if UserService changes?"',
          },
        },
        required: ['question'],
        additionalProperties: false,
      },
      outputSchema: ENVELOPE_OUTPUT_SCHEMA,
      annotations: READONLY_TOOL_ANNOTATIONS,
    },
    normalize: (raw) => {
      const args = expectArgsObject(raw);
      assertNoUnknownFields(args, ['question']);
      return { question: stringArg(args, 'question') };
    },
    run: async (runtime, args: { question: string }) => runtime.queryGraph(args.question),
  },
  {
    definition: {
      name: 'get_dna',
      description: 'Compressed repository DNA — read this first in any new session.',
      inputSchema: { type: 'object' as const, properties: {}, additionalProperties: false },
      outputSchema: ENVELOPE_OUTPUT_SCHEMA,
      annotations: READONLY_TOOL_ANNOTATIONS,
    },
    normalize: (raw) => {
      const args = expectArgsObject(raw);
      assertNoUnknownFields(args, []);
      return {};
    },
    run: async (runtime) => runtime.getDna(),
  },
  {
    definition: {
      name: 'get_node',
      description: 'Deep-dive a service, file, or symbol: neighbors, domain, impact, related flows.',
      inputSchema: {
        type: 'object' as const,
        properties: { name: { type: 'string' as const, minLength: 1, description: 'Service name, path fragment, or symbol' } },
        required: ['name'],
        additionalProperties: false,
      },
      outputSchema: ENVELOPE_OUTPUT_SCHEMA,
      annotations: READONLY_TOOL_ANNOTATIONS,
    },
    normalize: (raw) => {
      const args = expectArgsObject(raw);
      assertNoUnknownFields(args, ['name']);
      return { name: stringArg(args, 'name') };
    },
    run: async (runtime, args: { name: string }) => runtime.getNode(args.name),
  },
  {
    definition: {
      name: 'get_neighbors',
      description: 'Direct dependents (incoming) and dependencies (outgoing) for a graph node.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          name: { type: 'string' as const, minLength: 1 },
          direction: { type: 'string' as const, enum: [...DIRECTION], default: 'both' },
        },
        required: ['name'],
        additionalProperties: false,
      },
      outputSchema: ENVELOPE_OUTPUT_SCHEMA,
      annotations: READONLY_TOOL_ANNOTATIONS,
    },
    normalize: (raw) => {
      const args = expectArgsObject(raw);
      assertNoUnknownFields(args, ['name', 'direction']);
      return {
        name: stringArg(args, 'name'),
        direction: enumArg(args, 'direction', DIRECTION, { required: false, default: 'both' }),
      };
    },
    run: async (runtime, args: { name: string; direction: (typeof DIRECTION)[number] }) =>
      runtime.getNeighbors(args.name, args.direction),
  },
  {
    definition: {
      name: 'shortest_path',
      description: 'Shortest dependency path between two nodes.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          from: { type: 'string' as const, minLength: 1, description: 'Source node or service' },
          to: { type: 'string' as const, minLength: 1, description: 'Target node or service' },
        },
        required: ['from', 'to'],
        additionalProperties: false,
      },
      outputSchema: ENVELOPE_OUTPUT_SCHEMA,
      annotations: READONLY_TOOL_ANNOTATIONS,
    },
    normalize: (raw) => {
      const args = expectArgsObject(raw);
      assertNoUnknownFields(args, ['from', 'to']);
      return { from: stringArg(args, 'from'), to: stringArg(args, 'to') };
    },
    run: async (runtime, args: { from: string; to: string }) => runtime.shortestPath(args.from, args.to),
  },
  {
    definition: {
      name: 'impact_analysis',
      description: 'Blast-radius analysis — affected files, APIs, domains, and tests before editing.',
      inputSchema: {
        type: 'object' as const,
        properties: { node: { type: 'string' as const, minLength: 1 } },
        required: ['node'],
        additionalProperties: false,
      },
      outputSchema: ENVELOPE_OUTPUT_SCHEMA,
      annotations: READONLY_TOOL_ANNOTATIONS,
    },
    normalize: (raw) => {
      const args = expectArgsObject(raw);
      assertNoUnknownFields(args, ['node']);
      return { node: stringArg(args, 'node') };
    },
    run: async (runtime, args: { node: string }) => runtime.impactAnalysis(args.node),
  },
  {
    definition: {
      name: 'list_domains',
      description: 'Business domains with entry points.',
      inputSchema: { type: 'object' as const, properties: {}, additionalProperties: false },
      outputSchema: ENVELOPE_OUTPUT_SCHEMA,
      annotations: READONLY_TOOL_ANNOTATIONS,
    },
    normalize: (raw) => {
      const args = expectArgsObject(raw);
      assertNoUnknownFields(args, []);
      return {};
    },
    run: async (runtime) => runtime.listDomains(),
  },
  {
    definition: {
      name: 'list_flows',
      description: 'Execution flows and user journeys.',
      inputSchema: { type: 'object' as const, properties: {}, additionalProperties: false },
      outputSchema: ENVELOPE_OUTPUT_SCHEMA,
      annotations: READONLY_TOOL_ANNOTATIONS,
    },
    normalize: (raw) => {
      const args = expectArgsObject(raw);
      assertNoUnknownFields(args, []);
      return {};
    },
    run: async (runtime) => runtime.listFlows(),
  },
  {
    definition: {
      name: 'list_capabilities',
      description: 'Product capabilities (auth, payments, etc.) mapped to services.',
      inputSchema: { type: 'object' as const, properties: {}, additionalProperties: false },
      outputSchema: ENVELOPE_OUTPUT_SCHEMA,
      annotations: READONLY_TOOL_ANNOTATIONS,
    },
    normalize: (raw) => {
      const args = expectArgsObject(raw);
      assertNoUnknownFields(args, []);
      return {};
    },
    run: async (runtime) => runtime.listCapabilities(),
  },
  {
    definition: {
      name: 'onboard',
      description: 'Developer onboarding — where to start without scanning the repo.',
      inputSchema: { type: 'object' as const, properties: {}, additionalProperties: false },
      outputSchema: ENVELOPE_OUTPUT_SCHEMA,
      annotations: READONLY_TOOL_ANNOTATIONS,
    },
    normalize: (raw) => {
      const args = expectArgsObject(raw);
      assertNoUnknownFields(args, []);
      return {};
    },
    run: async (runtime) => runtime.getOnboard(),
  },
  {
    definition: {
      name: 'explain_repo',
      description: 'Plain-language repository summary and health scores.',
      inputSchema: { type: 'object' as const, properties: {}, additionalProperties: false },
      outputSchema: ENVELOPE_OUTPUT_SCHEMA,
      annotations: READONLY_TOOL_ANNOTATIONS,
    },
    normalize: (raw) => {
      const args = expectArgsObject(raw);
      assertNoUnknownFields(args, []);
      return {};
    },
    run: async (runtime) => runtime.getExplain(),
  },
  {
    definition: {
      name: 'get_health',
      description: 'Health score, architecture smells, AI readiness, risk heatmap.',
      inputSchema: { type: 'object' as const, properties: {}, additionalProperties: false },
      outputSchema: ENVELOPE_OUTPUT_SCHEMA,
      annotations: READONLY_TOOL_ANNOTATIONS,
    },
    normalize: (raw) => {
      const args = expectArgsObject(raw);
      assertNoUnknownFields(args, []);
      return {};
    },
    run: async (runtime) => runtime.getHealth(),
  },
  {
    definition: {
      name: 'search',
      description: 'BM25 hybrid search — domains, services, flows, APIs, files, and exported symbols.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          query: { type: 'string' as const, minLength: 1 },
          limit: { type: 'integer' as const, minimum: 1, maximum: 50, default: 10, description: '1–50, default 10' },
        },
        required: ['query'],
        additionalProperties: false,
      },
      outputSchema: ENVELOPE_OUTPUT_SCHEMA,
      annotations: READONLY_TOOL_ANNOTATIONS,
    },
    normalize: (raw) => {
      const args = expectArgsObject(raw);
      assertNoUnknownFields(args, ['query', 'limit']);
      return {
        query: stringArg(args, 'query'),
        limit: numberArg(args, 'limit', { required: false, min: 1, max: 50, integer: true, default: 10 }),
      };
    },
    run: async (runtime, args: { query: string; limit: number }) => runtime.search(args.query, args.limit),
  },
  {
    definition: {
      name: 'review_diff',
      description: 'PR blast-radius review from unified diff content.',
      inputSchema: {
        type: 'object' as const,
        properties: { diff: { type: 'string' as const, minLength: 1 } },
        required: ['diff'],
        additionalProperties: false,
      },
      outputSchema: ENVELOPE_OUTPUT_SCHEMA,
      annotations: READONLY_TOOL_ANNOTATIONS,
    },
    normalize: (raw) => {
      const args = expectArgsObject(raw);
      assertNoUnknownFields(args, ['diff']);
      return { diff: stringArg(args, 'diff') };
    },
    run: async (runtime, args: { diff: string }) => runtime.reviewDiffContent(args.diff),
  },
  {
    definition: {
      name: 'compile_focus',
      description:
        'Task-scoped minimal context pack for an edit — subgraph + domains + flows + risks within a token budget. Revolutionary vs dumping whole DNA.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          task: { type: 'string' as const, minLength: 1, description: 'e.g. "fix login redirect bug" or "add billing webhook"' },
          tokenBudget: { type: 'integer' as const, minimum: 500, maximum: 32000, default: 8000 },
        },
        required: ['task'],
        additionalProperties: false,
      },
      outputSchema: ENVELOPE_OUTPUT_SCHEMA,
      annotations: READONLY_TOOL_ANNOTATIONS,
    },
    normalize: (raw) => {
      const args = expectArgsObject(raw);
      assertNoUnknownFields(args, ['task', 'tokenBudget']);
      return {
        task: stringArg(args, 'task'),
        tokenBudget: numberArg(args, 'tokenBudget', { required: false, min: 500, max: 32000, integer: true, default: 8000 }),
      };
    },
    run: async (runtime, args: { task: string; tokenBudget: number }) =>
      runtime.compileFocus(args.task, args.tokenBudget),
  },
  {
    definition: {
      name: 'dna_diff',
      description: 'Structural diff since last build — domains, flows, health, smells regression guard.',
      inputSchema: { type: 'object' as const, properties: {}, additionalProperties: false },
      outputSchema: ENVELOPE_OUTPUT_SCHEMA,
      annotations: READONLY_TOOL_ANNOTATIONS,
    },
    normalize: (raw) => {
      const args = expectArgsObject(raw);
      assertNoUnknownFields(args, []);
      return {};
    },
    run: async (runtime) => runtime.getDnaDiff(),
  },
  {
    definition: {
      name: 'git_hotspots',
      description: 'Git churn hotspots mapped to services/domains — who changed what recently.',
      inputSchema: {
        type: 'object' as const,
        properties: { limit: { type: 'integer' as const, minimum: 5, maximum: 50, default: 20 } },
        additionalProperties: false,
      },
      outputSchema: ENVELOPE_OUTPUT_SCHEMA,
      annotations: READONLY_TOOL_ANNOTATIONS,
    },
    normalize: (raw) => {
      const args = expectArgsObject(raw);
      assertNoUnknownFields(args, ['limit']);
      return { limit: numberArg(args, 'limit', { required: false, min: 5, max: 50, integer: true, default: 20 }) };
    },
    run: async (runtime, args: { limit: number }) => runtime.getGitHotspots(args.limit),
  },
  {
    definition: {
      name: 'build_history',
      description: 'Timeline of DNA snapshots from each mnemos build.',
      inputSchema: { type: 'object' as const, properties: {}, additionalProperties: false },
      outputSchema: ENVELOPE_OUTPUT_SCHEMA,
      annotations: READONLY_TOOL_ANNOTATIONS,
    },
    normalize: (raw) => {
      const args = expectArgsObject(raw);
      assertNoUnknownFields(args, []);
      return {};
    },
    run: async (runtime) => runtime.getBuildHistory(),
  },
  {
    definition: {
      name: 'memory_query',
      description:
        'Hybrid local memory retrieval — BM25 + on-device embeddings. No cloud. Best for semantic architecture questions.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          question: { type: 'string' as const, minLength: 1 },
          limit: { type: 'integer' as const, minimum: 1, maximum: 50, default: 12 },
        },
        required: ['question'],
        additionalProperties: false,
      },
      outputSchema: ENVELOPE_OUTPUT_SCHEMA,
      annotations: READONLY_TOOL_ANNOTATIONS,
    },
    normalize: (raw) => {
      const args = expectArgsObject(raw);
      assertNoUnknownFields(args, ['question', 'limit']);
      return {
        question: stringArg(args, 'question'),
        limit: numberArg(args, 'limit', { required: false, min: 1, max: 50, integer: true, default: 12 }),
      };
    },
    run: async (runtime, args: { question: string; limit: number }) =>
      runtime.memoryQuery(args.question, args.limit),
  },
  {
    definition: {
      name: 'memory_remember',
      description: 'Store episodic memory locally — agent observations, decisions, failures. Persists across sessions with decay.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          content: { type: 'string' as const, minLength: 1 },
          tags: { type: 'array' as const, items: { type: 'string' as const } },
        },
        required: ['content'],
        additionalProperties: false,
      },
      outputSchema: ENVELOPE_OUTPUT_SCHEMA,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
      },
    },
    normalize: (raw) => {
      const args = expectArgsObject(raw);
      assertNoUnknownFields(args, ['content', 'tags']);
      const tagsRaw = args.tags;
      const tags = Array.isArray(tagsRaw) ? tagsRaw.map(String) : [];
      return { content: stringArg(args, 'content'), tags };
    },
    run: async (runtime, args: { content: string; tags: string[] }) =>
      runtime.memoryRemember(args.content, args.tags),
  },
  {
    definition: {
      name: 'memory_engine_status',
      description: 'Memory engine Labyrinth status — documents, episodes, contradictions, local embedding index.',
      inputSchema: { type: 'object' as const, properties: {}, additionalProperties: false },
      outputSchema: ENVELOPE_OUTPUT_SCHEMA,
      annotations: READONLY_TOOL_ANNOTATIONS,
    },
    normalize: (raw) => {
      const args = expectArgsObject(raw);
      assertNoUnknownFields(args, []);
      return {};
    },
    run: async (runtime) => runtime.getMemoryEngineStatus(),
  },
  {
    definition: {
      name: 'trust_manifest',
      description: 'Honest capabilities and known limitations — verifiable trust manifest for agents.',
      inputSchema: { type: 'object' as const, properties: {}, additionalProperties: false },
      outputSchema: ENVELOPE_OUTPUT_SCHEMA,
      annotations: READONLY_TOOL_ANNOTATIONS,
    },
    normalize: (raw) => {
      const args = expectArgsObject(raw);
      assertNoUnknownFields(args, []);
      return {};
    },
    run: async (runtime) => runtime.getTrustManifest(),
  },
  {
    definition: {
      name: 'memory_session_start',
      description: 'Start a local agent session trace — records tool calls and queries on-device.',
      inputSchema: { type: 'object' as const, properties: {}, additionalProperties: false },
      outputSchema: ENVELOPE_OUTPUT_SCHEMA,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    normalize: (raw) => {
      const args = expectArgsObject(raw);
      assertNoUnknownFields(args, []);
      return {};
    },
    run: async (runtime) => runtime.memorySessionStart(),
  },
  {
    definition: {
      name: 'memory_session_end',
      description: 'End the active local session trace and return summary.',
      inputSchema: { type: 'object' as const, properties: {}, additionalProperties: false },
      outputSchema: ENVELOPE_OUTPUT_SCHEMA,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    normalize: (raw) => {
      const args = expectArgsObject(raw);
      assertNoUnknownFields(args, []);
      return {};
    },
    run: async (runtime) => runtime.memorySessionEnd(),
  },
  {
    definition: {
      name: 'memory_session_list',
      description: 'List recent local agent session traces.',
      inputSchema: { type: 'object' as const, properties: {}, additionalProperties: false },
      outputSchema: ENVELOPE_OUTPUT_SCHEMA,
      annotations: READONLY_TOOL_ANNOTATIONS,
    },
    normalize: (raw) => {
      const args = expectArgsObject(raw);
      assertNoUnknownFields(args, []);
      return {};
    },
    run: async (runtime) => runtime.memorySessionList(),
  },
  {
    definition: {
      name: 'refresh_memory',
      description: 'Invalidate cache and reload from .mnemos/ after mnemos build.',
      inputSchema: { type: 'object' as const, properties: {}, additionalProperties: false },
      outputSchema: ENVELOPE_OUTPUT_SCHEMA,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    normalize: (raw) => {
      const args = expectArgsObject(raw);
      assertNoUnknownFields(args, []);
      return {};
    },
    run: async (runtime) => {
      runtime.invalidate();
      const reloaded = await runtime.load(true);
      return {
        ok: true,
        tool: 'refresh_memory',
        summary: `Reloaded ${reloaded.memory.repository}`,
        markdown: `# Memory Refreshed\n\n- **Repository:** ${reloaded.memory.repository}\n- **Domains:** ${reloaded.buildStats.domains}\n- **Graph:** ${reloaded.graph ? 'available' : 'unavailable'}`,
        data: { loadedAt: reloaded.loadedAt, buildStats: reloaded.buildStats },
        meta: { repository: reloaded.memory.repository, version: MNEMOS_VERSION },
      };
    },
  },
];

export const TOOL_MAP = new Map<string, ToolRegistration<any>>(TOOL_REGISTRY.map((t) => [t.definition.name, t]));

export function getToolOrThrow(name: string): ToolRegistration<any> {
  const tool = TOOL_MAP.get(name);
  if (!tool) {
    throw new MnemosAgentError('INVALID_INPUT', `Unknown tool: ${name}`);
  }
  return tool;
}

export const PROMPTS = [
  {
    name: 'architecture-overview',
    description: 'Architecture briefing for a new engineer or AI session',
    arguments: [],
  },
  {
    name: 'pre-edit-impact-check',
    description: 'Assess blast radius before editing a service or file',
    arguments: [{ name: 'target', description: 'Service, file, or symbol', required: true }],
  },
  {
    name: 'explore-domain',
    description: 'Deep-dive a business domain',
    arguments: [{ name: 'domain', description: 'Domain name', required: true }],
  },
  {
    name: 'task-focus-pack',
    description: 'Minimal subgraph context for a specific edit task',
    arguments: [{ name: 'task', description: 'What you are trying to do', required: true }],
  },
] as const;

export async function buildPromptMessages(
  runtime: MnemosRuntime,
  name: string,
  rawArgs: unknown,
): Promise<{ messages: { role: 'user'; content: { type: 'text'; text: string } }[] }> {
  const args = expectArgsObject(rawArgs);

  await runtime.load();

  if (name === 'architecture-overview') {
    assertNoUnknownFields(args, []);
    const artifacts = await runtime.load();
    const [dna, health, domains, explain] = await Promise.all([
      runtime.getDna(),
      runtime.getHealth(),
      runtime.listDomains(),
      runtime.getExplain(),
    ]);
    return {
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: [
            explain.markdown,
            '',
            buildMcpArchitectureGraphBundle(artifacts.memory),
            '',
            dna.markdown,
            '',
            health.markdown,
            '',
            domains.markdown,
          ].join('\n'),
        },
      }],
    };
  }

  if (name === 'pre-edit-impact-check') {
    assertNoUnknownFields(args, ['target']);
    const target = stringArg(args, 'target');
    const [node, impact] = await Promise.all([
      runtime.getNode(target).catch(() => null),
      runtime.impactAnalysis(target).catch(() => null),
    ]);
    return {
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: [
            `Assess blast radius before editing **${target}**.`,
            '',
            node?.markdown ?? `_Node not found: ${target}_`,
            '',
            impact?.markdown ?? `_Impact unavailable — run mnemos build_`,
          ].join('\n'),
        },
      }],
    };
  }

  if (name === 'explore-domain') {
    assertNoUnknownFields(args, ['domain']);
    const domain = stringArg(args, 'domain');
    const result = await runtime.queryGraph(`Everything about the ${domain} domain: entry points, services, flows, risks.`);
    return {
      messages: [{ role: 'user', content: { type: 'text', text: result.markdown } }],
    };
  }

  if (name === 'task-focus-pack') {
    assertNoUnknownFields(args, ['task']);
    const task = stringArg(args, 'task');
    const result = await runtime.compileFocus(task);
    return {
      messages: [{ role: 'user', content: { type: 'text', text: result.markdown } }],
    };
  }

  throw new Error(`Unknown prompt: ${name}`);
}
